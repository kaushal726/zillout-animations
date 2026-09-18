/* Frame sequence loader.

   Two things make an image sequence feel like a slideshow instead of motion:

     1. The frame you need has not arrived, so the canvas keeps redrawing a
        neighbour. Scrubbing then dwells and jumps: 20 → 24 → 24 → 29.
     2. The frame has arrived but has never been decoded, so the first
        drawImage() pays for a full decode on the main thread, right at the
        moment it has to be on screen.

   So: load in priority waves, then keep the background queue pointed at
   wherever the playhead actually is — not at index order — and never treat
   a frame as ready until it is decoded. */

const CONCURRENCY = 6;
/* Long enough that a real decode always wins; short enough that a stalled
   one (backgrounded tab) cannot wedge a worker forever. Frames that time
   out are retried rather than being trusted. */
const DECODE_TIMEOUT = 4000;
/* Absolute ceiling on the opening wave, so a slow network can never leave
   the page sitting black. */
const ESSENTIAL_TIMEOUT = 9000;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class FrameLoader {
  constructor({ total = 240, step = 1, base = 'assets/frames/frame-', ext = '.jpg', pad = 3 }) {
    this.total = total;
    this.base = base;
    this.ext = ext;
    this.pad = pad;

    this.indices = [];
    for (let i = 1; i <= total; i += step) this.indices.push(i);
    if (this.indices[this.indices.length - 1] !== total) this.indices.push(total);

    this.images = new Map();
    /* loaded: bytes are here. decoded: safe to draw without a hitch. */
    this.loaded = new Uint8Array(total + 1);
    this.decoded = new Uint8Array(total + 1);

    this.pending = new Set();
    this.playhead = 1;
    this.essentialCount = 0;
    this.essentialDone = 0;
  }

  url(n) {
    return `${this.base}${String(n).padStart(this.pad, '0')}${this.ext}`;
  }

  /** Where the scrub currently is, so loading follows the viewer. */
  setPlayhead(n) {
    this.playhead = n;
  }

  #buildWaves() {
    const opening = this.indices.filter((n) => n <= 34);
    // Sample by position, not by frame number: on devices loading every
    // second frame, testing the number itself would never match.
    const coarse = this.indices.filter((n, i) => n > 34 && i % 4 === 0);
    const essential = [...new Set([...opening, ...coarse])];
    const essentialSet = new Set(essential);
    return { essential, rest: this.indices.filter((n) => !essentialSet.has(n)) };
  }

  #decode(img, n) {
    if (!img.decode) {
      this.decoded[n] = 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        if (ok) this.decoded[n] = 1;
        resolve();
      };
      img.decode().then(() => done(true), () => done(false));
      setTimeout(() => done(false), DECODE_TIMEOUT);
    });
  }

  #fetch(n) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        this.images.set(n, img);
        this.loaded[n] = 1;
        await this.#decode(img, n);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.url(n);
    });
  }

  async #run(queue, onProgress) {
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        await this.#fetch(queue[cursor++]);
        onProgress?.();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  /** Whichever pending frame is closest to the playhead. */
  #nearestPending() {
    let best = null;
    let bestDistance = Infinity;
    for (const n of this.pending) {
      const d = Math.abs(n - this.playhead);
      if (d < bestDistance) {
        bestDistance = d;
        best = n;
      }
    }
    return best;
  }

  /** Background fill that always works outwards from where the viewer is,
      so the frames about to be needed are the ones being fetched. */
  async #runFollowingPlayhead(queue) {
    queue.forEach((n) => this.pending.add(n));
    const worker = async () => {
      for (;;) {
        const n = this.#nearestPending();
        if (n === null) return;
        this.pending.delete(n);
        await this.#fetch(n);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    // Anything whose decode timed out earlier gets another attempt.
    await this.#redecodeStragglers();
  }

  async #redecodeStragglers() {
    for (const n of this.indices) {
      if (this.loaded[n] && !this.decoded[n]) await this.#decode(this.images.get(n), n);
    }
  }

  async start(onProgress) {
    const { essential, rest } = this.#buildWaves();
    this.essentialCount = essential.length;

    const opening = this.#run(essential, () => {
      this.essentialDone += 1;
      onProgress?.(this.essentialDone / this.essentialCount);
    });

    await Promise.race([opening, delay(ESSENTIAL_TIMEOUT)]);
    opening.then(() => this.#runFollowingPlayhead(rest));
  }

  /**
   * Nearest frame that is safe to draw. Decoded frames win outright; a
   * loaded-but-undecoded one is only used if nothing decoded is close,
   * because drawing it would cost a synchronous decode.
   */
  nearest(n) {
    const target = Math.round(Math.min(this.total, Math.max(1, n)));
    if (this.decoded[target]) return this.images.get(target);

    let fallback = this.loaded[target] ? this.images.get(target) : null;
    for (let d = 1; d <= this.total; d += 1) {
      const lo = target - d;
      const hi = target + d;
      if (lo >= 1 && this.decoded[lo]) return this.images.get(lo);
      if (hi <= this.total && this.decoded[hi]) return this.images.get(hi);
      if (!fallback) {
        if (lo >= 1 && this.loaded[lo]) fallback = this.images.get(lo);
        else if (hi <= this.total && this.loaded[hi]) fallback = this.images.get(hi);
      }
    }
    return fallback;
  }

  /** Diagnostics for the ?debug overlay. */
  stats() {
    let loaded = 0;
    let decoded = 0;
    for (const n of this.indices) {
      if (this.loaded[n]) loaded += 1;
      if (this.decoded[n]) decoded += 1;
    }
    return { loaded, decoded, total: this.indices.length };
  }
}

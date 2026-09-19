/* Frame sequence loader.

   Two things make an image sequence feel like a slideshow instead of motion:

     1. The frame you need has not arrived, so the canvas keeps redrawing a
        neighbour. Scrubbing then dwells and jumps: 20 → 24 → 24 → 29.
     2. The frame has arrived but has never been decoded, so the first
        drawImage() pays for a full decode on the main thread, right at the
        moment it has to be on screen.

   So: load in priority waves, then keep the background queue pointed at
   wherever the playhead actually is — not at index order — and never treat
   a frame as ready until it is decoded.

   Decoded is not forever: the browser keeps decoded images in a bounded,
   evictable cache, so a frame decoded at load can be cold again by the time
   the viewer reaches it. A sliding window ahead of the playhead, in the
   direction of travel, is re-decoded off the main thread as it approaches.
   The cache itself stays the browser's: 240 compressed images are held
   (~15MB), and decoded memory stays bounded by the browser, not by us. */

const CONCURRENCY = 6;
/* Long enough that a real decode always wins; short enough that a stalled
   one (backgrounded tab) cannot wedge a worker forever. Frames that time
   out are retried rather than being trusted. */
const DECODE_TIMEOUT = 4000;
/* Absolute ceiling on the opening wave, so a slow network can never leave
   the page sitting black. */
const ESSENTIAL_TIMEOUT = 9000;
/* How far a decoded frame may be from the one asked for and still be
   preferred over a closer, undecoded one. Three frames is invisible in
   motion; much more and the pose itself visibly jumps. */
const DECODED_REACH = 3;

/* Decode-ahead window, in frames. Upcoming frames matter far more than the
   ones just passed, so the window leans in the direction of travel. */
const WARM_AHEAD = 12;
const WARM_BEHIND = 4;
/* A frame re-requested within this long is assumed still decoded. */
const REWARM_MS = 2000;

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
    this.direction = 1;
    this.warmedAt = new Float64Array(total + 1);
    this.essentialCount = 0;
    this.essentialDone = 0;
  }

  url(n) {
    return `${this.base}${String(n).padStart(this.pad, '0')}${this.ext}`;
  }

  /** Where the scrub currently is, so loading and decoding follow the
      viewer. Cheap to call every frame: it only acts when the frame moves. */
  setPlayhead(n) {
    const next = Math.round(n);
    if (next === this.playhead) return;
    this.direction = next > this.playhead ? 1 : -1;
    this.playhead = next;
    this.#warm();
  }

  /** Ask for the frames just ahead to be decoded before they are drawn. */
  #warm() {
    const now = performance.now();
    const from = this.playhead - (this.direction > 0 ? WARM_BEHIND : WARM_AHEAD);
    const to = this.playhead + (this.direction > 0 ? WARM_AHEAD : WARM_BEHIND);
    for (let n = Math.max(1, from); n <= Math.min(this.total, to); n += 1) {
      if (!this.loaded[n] || now - this.warmedAt[n] < REWARM_MS) continue;
      this.warmedAt[n] = now;
      const img = this.images.get(n);
      if (!img?.decode) continue;
      img.decode().then(() => { this.decoded[n] = 1; }, () => {});
    }
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

  /** Whichever pending frame is closest to the playhead — frames ahead in
      the direction of travel count as twice as close as those behind. */
  #nearestPending() {
    let best = null;
    let bestDistance = Infinity;
    for (const n of this.pending) {
      const ahead = Math.sign(n - this.playhead) === this.direction;
      const d = Math.abs(n - this.playhead) * (ahead ? 1 : 2);
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
   * The frame to draw for `n`. A decoded frame is preferred — drawing one
   * that is not yet decoded costs a synchronous decode on the main thread —
   * but only within DECODED_REACH frames. Beyond that the nearest loaded
   * frame wins even if undecoded: a one-off decode is a small hitch, while
   * a decoded frame from far along the sequence is simply the wrong pose.
   */
  nearest(n) {
    const target = Math.round(Math.min(this.total, Math.max(1, n)));
    if (this.decoded[target]) return this.images.get(target);

    for (let d = 1; d <= DECODED_REACH; d += 1) {
      if (target - d >= 1 && this.decoded[target - d]) return this.images.get(target - d);
      if (target + d <= this.total && this.decoded[target + d]) return this.images.get(target + d);
    }

    if (this.loaded[target]) return this.images.get(target);
    for (let d = 1; d <= this.total; d += 1) {
      if (target - d >= 1 && this.loaded[target - d]) return this.images.get(target - d);
      if (target + d <= this.total && this.loaded[target + d]) return this.images.get(target + d);
    }
    return null;
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

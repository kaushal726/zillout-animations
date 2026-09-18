/* ZILLOUT — generated bundle. Do not edit.
   Source lives in js/ as ES modules; regenerate with ./build.sh
   This exists so index.html also works when opened from file://  */

;(function () {
'use strict';

/* ── js/core/utils.js ─────────────────────────────── */
/* Small pure helpers. No DOM, no state. */

const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

const lerp = (a, b, t) => a + (b - a) * t;

/** Normalise v from [inMin,inMax] into [outMin,outMax], clamped at both ends. */
function mapRange(v, inMin, inMax, outMin = 0, outMax = 1) {
  if (inMax === inMin) return outMin;
  const t = clamp((v - inMin) / (inMax - inMin));
  return outMin + (outMax - outMin) * t;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Frame-rate independent lerp factor, so motion feels the same at 60 and 120Hz. */
const damp = (factor, dt) => 1 - Math.pow(1 - factor, dt / 16.667);

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = () => reducedQuery.matches;

const coarseQuery = matchMedia('(pointer: coarse)');
const isCoarsePointer = () => coarseQuery.matches;

const onResize = (fn, wait = 150) => {
  let t;
  const run = () => { clearTimeout(t); t = setTimeout(fn, wait); };
  addEventListener('resize', run, { passive: true });
  addEventListener('orientationchange', run, { passive: true });
  return run;
};

/* ── js/core/ticker.js ─────────────────────────────── */
/* One requestAnimationFrame loop for the whole page.
   Every animated system subscribes here rather than starting its own. */

const subscribers = new Set();
let running = false;
let last = 0;

function frame(now) {
  const dt = Math.min(64, now - last); // cap after a tab-switch stall
  last = now;

  for (const fn of subscribers) {
    try {
      fn(dt, now);
    } catch (error) {
      // One bad subscriber must not take the whole page's motion with it:
      // without this, a single throw stops the loop permanently and every
      // scroll-driven animation freezes at once.
      console.error('[zillout] ticker subscriber failed, dropping it:', error);
      subscribers.delete(fn);
    }
  }

  if (subscribers.size > 0) requestAnimationFrame(frame);
  else running = false;
}

/** Subscribe to the shared loop. Returns an unsubscribe function. */
function onTick(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  return () => subscribers.delete(fn);
}

/* ── js/core/hidpi.js ─────────────────────────────── */
/* Size a canvas to the device pixel ratio and return its CSS dimensions.
   Shared by the film canvas and both FX layers. */

function sizeCanvas(canvas, ctx, maxDpr = 2) {
  const dpr = clamp(devicePixelRatio || 1, 1, maxDpr);
  const w = innerWidth;
  const h = innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

/* ── js/core/scroll.js ─────────────────────────────── */
/* Scroll state.

   Native scrolling is left completely intact — we never transform <body>.
   Instead we keep a *smoothed* scroll value that every animation reads from.
   That is what gives the film its weight without breaking trackpads,
   scrollbars, keyboard paging or mobile momentum. */


/* The sticky layout follows the raw scroll position while the film follows
   this eased one. Too much easing and the two visibly disagree, which reads
   as the page lagging behind the wheel rather than as weight. */
const SMOOTHING = 0.2;

const scroll = {
  y: 0,          // raw scrollY
  smooth: 0,     // eased scrollY — drives all animation
  progress: 0,   // 0..1 over the whole document
  velocity: 0,   // px/frame, signed
  vh: 0,
  vw: 0,
};

/** @type {{id:string, el:HTMLElement, top:number, span:number, progress:number, active:boolean}[]} */
const acts = [];

let maxScroll = 1;

function registerActs(nodes) {
  acts.length = 0;
  nodes.forEach((el) => {
    acts.push({
      id: el.dataset.act,
      el,
      sticky: el.firstElementChild,
      top: 0,
      height: 1,
      span: 1,
      progress: 0,
      active: false,
    });
  });
  measure();
}

/** Cache layout. Called on load and on resize only — never per frame. */
function measure() {
  scroll.vh = innerHeight;
  scroll.vw = innerWidth;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - scroll.vh);

  for (const act of acts) {
    // Every layout read happens here and nowhere else. Reading geometry
    // from inside the animation loop forces a synchronous reflow on each
    // access, and there is one of these per act per frame to get wrong.
    act.top = act.el.offsetTop;
    act.height = act.el.offsetHeight;
    // While an act's sticky child is pinned, the act travels (height - vh).
    act.span = Math.max(1, act.height - scroll.vh);
  }
}

let lastRawY = 0;
let snapNext = false;

/** A jump this large in one frame is never a scroll gesture — it is an
    anchor link, a restored position or a programmatic scroll. Following it
    with the easing would send the film sliding through half the sequence. */
function isDiscontinuous(y) {
  return Math.abs(y - lastRawY) > scroll.vh * 1.5;
}

function update(dt) {
  const previous = scroll.smooth;
  scroll.y = window.scrollY || window.pageYOffset || 0;

  // A throttled tab (backgrounded, or low-power) runs this loop at a few
  // frames a second, so the easing would take seconds to catch up and the
  // film would visibly slide on return. Snap instead.
  if (snapNext || isDiscontinuous(scroll.y) || prefersReducedMotion()) {
    scroll.smooth = scroll.y;
    snapNext = false;
  } else {
    scroll.smooth = lerp(scroll.smooth, scroll.y, damp(SMOOTHING, dt));
  }
  lastRawY = scroll.y;

  // Settle exactly, so nothing drifts by a fraction of a pixel forever
  if (Math.abs(scroll.smooth - scroll.y) < 0.08) scroll.smooth = scroll.y;

  scroll.velocity = scroll.smooth - previous;
  scroll.progress = clamp(scroll.smooth / maxScroll);

  for (const act of acts) {
    act.progress = clamp((scroll.smooth - act.top) / act.span);
    act.active = scroll.smooth >= act.top - scroll.vh && scroll.smooth < act.top + act.height;
  }
}

function initScroll() {
  scroll.y = scroll.smooth = lastRawY = window.scrollY || 0;
  measure();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) snapNext = true;
  });
  onResize(measure);
  // Late relayout: web fonts and the first frames both change nothing
  // structurally, but images decoding can, so re-measure once settled.
  addEventListener('load', () => setTimeout(measure, 120));
  onTick(update);
}

const actById = (id) => acts.find((a) => a.id === id);

/* ── js/film/stops.js ─────────────────────────────── */
/* Piecewise keyframes.

   A stop is [progress, value]. Sampling eases between neighbouring stops,
   so two stops sharing a value create a genuine hold — the pause that makes
   a disassembly read as mechanical rather than as an explosion, and the
   stillness that makes the camera feel like it is mounted on something
   heavy. */

/**
 * @param {[number, number][]} stops ascending by progress
 * @param {number} p 0..1
 * @param {boolean} ease ease within each segment (default) or move linearly
 *
 * Frame indices must pass ease=false. An eased segment flattens at both
 * ends, and once the result is rounded to a whole frame that flat part
 * becomes a visible dwell — a pause at *every* keyframe rather than only
 * where one was intended. Linear keeps scroll-to-frame constant, so the
 * only pauses are the ones written as explicit flat segments.
 */
function sampleStops(stops, p, ease = true) {
  if (p <= stops[0][0]) return stops[0][1];

  for (let i = 1; i < stops.length; i += 1) {
    const [p1, v1] = stops[i];
    if (p > p1) continue;
    const [p0, v0] = stops[i - 1];
    const span = p1 - p0;
    if (span <= 0) return v1;
    const t = clamp((p - p0) / span);
    return lerp(v0, v1, ease ? easeInOut(t) : t);
  }
  return stops[stops.length - 1][1];
}

/* ── js/film/loader.js ─────────────────────────────── */
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

class FrameLoader {
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

/* ── js/film/canvas.js ─────────────────────────────── */
/* The film canvas — draws one still, correctly framed, at device resolution. */


/* The stills are 1920px wide. Filling a retina backing store means drawing
   them at 2x their own resolution — four times the pixels to push, for no
   detail that exists in the source. Cap the backing store at the source
   width and let the compositor do the final upscale, which is free. */
const SOURCE_WIDTH = 1920;

class FilmCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.current = null;
    this.resize();
  }

  resize() {
    const maxDpr = clamp(SOURCE_WIDTH / innerWidth, 1, 2);
    const { w, h } = sizeCanvas(this.canvas, this.ctx, maxDpr);
    this.w = w;
    this.h = h;
    // 'high' forces an expensive resample on every blit. The source is
    // 1920px being drawn at roughly that size, so the extra quality is
    // invisible while the cost is not.
    this.ctx.imageSmoothingQuality = 'medium';
    if (this.current) this.draw(this.current, true);
  }

  /**
   * Wide screens get a full cover crop. Portrait screens ease towards a
   * contained fit instead — the exploded components spread far to the left
   * and right, and a cover crop on a phone would throw them off screen.
   * The artwork sits on pure black, so the letterboxing is invisible.
   */
  #scaleFor(iw, ih) {
    const cover = Math.max(this.w / iw, this.h / ih);
    const contain = Math.min(this.w / iw, this.h / ih);
    // Just past a contained fit: enough overscan to kill the side letterbox
    // without cropping the outermost exploded parts, which sit at roughly
    // 10% in from each edge of the artwork.
    const portrait = contain * 1.15;
    return lerp(portrait, cover, mapRange(this.w / this.h, 0.72, 1.25));
  }

  /** Where the artwork's centre sits vertically. On portrait the band is
      much shorter than the screen, so it is lifted off dead centre to leave
      the copy below it room to breathe. */
  #anchorFor() {
    return lerp(0.45, 0.5, mapRange(this.w / this.h, 0.72, 1.25));
  }

  draw(img, force = false) {
    if (!img) return;
    if (img === this.current && !force) return;
    this.current = img;

    const { ctx } = this;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const s = this.#scaleFor(iw, ih);
    const dw = iw * s;
    const dh = ih * s;

    ctx.fillStyle = '#030303';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(img, (this.w - dw) / 2, (this.h - dh) * this.#anchorFor(), dw, dh);
  }
}

/* ── js/film/timeline.js ─────────────────────────────── */
/* The timeline — one continuous shot, choreographed as story beats.

   Each act declares, as piecewise stops over its own scroll progress:

     frames  which still is on screen. Flat segments are deliberate holds,
             which is what turns the disassembly into a staged engineering
             reveal instead of everything flying apart at once.
     product opacity / brightness / scale / blur of the film.
     text    opacity of that act's typography.

   The rule the whole page obeys: product and text are never both fully
   present. One leads, the other recedes — and it recedes through opacity
   and brightness, not through heavy blur, so nothing ever looks broken.

   Blur is capped deliberately low (1.5px) and used only where the film is
   deep background. */

const TIMELINE = [
  {
    id: 'hero',
    // Almost still. The opening should breathe, not move.
    frames:     [[0, 1], [1, 22]],
    opacity:    [[0, 1], [0.30, 1], [0.66, 0.5]],
    brightness: [[0, 1], [0.30, 1], [0.66, 0.78]],
    scale:      [[0, 1.05], [0.5, 1], [1, 1]],
    blur:       [[0, 0]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'form',
    // Text leads. The product sits back and dims, but stays legible.
    frames:     [[0, 22], [1, 80]],
    opacity:    [[0, 0.5], [0.2, 0.3], [0.8, 0.3], [1, 0.55]],
    brightness: [[0, 0.8], [0.2, 0.62], [0.8, 0.62], [1, 0.8]],
    scale:      [[0, 1], [1, 1.015]],
    blur:       [[0, 0]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'energy',
    // Handover: the product recedes to a glow, the field takes the frame.
    frames:     [[0, 80], [1, 88]],
    opacity:    [[0, 0.55], [0.5, 0.12], [1, 0.1]],
    brightness: [[0, 0.8], [1, 0.6]],
    scale:      [[0, 1.015], [1, 1.04]],
    blur:       [[0, 0], [0.5, 1.2], [1, 1.2]],
    text:       [[0, 1], [0.85, 1], [1, 0.45]],
  },
  {
    id: 'explode',
    // PRODUCT MOMENT. Staged disassembly with a pause at every stage, and
    // the typography pulled right back so the engineering can be read.
    frames: [
      [0, 88], [0.17, 104], [0.19, 104],   // outer shell, settles
      [0.39, 124], [0.41, 124],            // structure, settles
      [0.61, 144], [0.63, 144],            // internals, settles
      [0.86, 168], [1, 176],               // full configuration
    ],
    opacity:    [[0, 0.15], [0.18, 1], [1, 1]],
    brightness: [[0, 0.7], [0.18, 1], [1, 1]],
    // Push in, then the camera stops entirely for the middle of the act.
    scale:      [[0, 1.04], [0.25, 1], [0.78, 1], [1, 0.99]],
    blur:       [[0, 1.2], [0.18, 0], [1, 0]],
    text:       [[0, 1], [0.14, 0.3], [0.9, 0.3], [1, 0.5]],
  },
  {
    id: 'purpose',
    // Text leads again, one statement at a time.
    frames:     [[0, 176], [1, 214]],
    opacity:    [[0, 1], [0.16, 0.42], [0.85, 0.42], [1, 0.6]],
    brightness: [[0, 1], [0.16, 0.7], [0.85, 0.7], [1, 0.8]],
    scale:      [[0, 0.99], [1, 1.01]],
    blur:       [[0, 0]],
    text:       [[0, 0.5], [0.16, 1], [1, 1]],
  },
  {
    id: 'system',
    // The gallery is the content; the film drops to a backdrop.
    frames:     [[0, 214], [1, 232]],
    opacity:    [[0, 0.6], [0.2, 0.16], [0.85, 0.16], [1, 0.1]],
    brightness: [[0, 0.8], [0.2, 0.5], [1, 0.45]],
    scale:      [[0, 1.01], [1, 1.05]],
    blur:       [[0, 0], [0.2, 1.5], [1, 1.5]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'presence',
    frames:     [[0, 232], [1, 240]],
    opacity:    [[0, 0.1], [0.3, 0.28], [1, 0.3]],
    brightness: [[0, 0.5], [0.3, 0.7], [1, 0.7]],
    scale:      [[0, 1.05], [1, 1.02]],
    blur:       [[0, 1.5], [0.3, 0.6], [1, 0.6]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'visualizer',
    // Instrument moment. The dial and the line are the subject; the render
    // drops right back so both can actually be read against it. Brightening
    // the render here buries the instrument drawn on top of it.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0.3], [0.25, 0.26], [0.8, 0.26], [1, 0.34]],
    brightness: [[0, 0.7], [0.25, 0.55], [0.8, 0.55], [1, 0.68]],
    scale:      [[0, 1.02], [1, 1.02]],
    blur:       [[0, 0]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'philosophy',
    // Text only. Near-empty black.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0.3], [0.25, 0.06], [0.8, 0.06], [1, 0.12]],
    brightness: [[0, 0.7], [1, 0.5]],
    scale:      [[0, 1.02], [1, 1.03]],
    blur:       [[0, 0.6], [0.25, 1.5], [1, 1.5]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'reassembly',
    // PRODUCT MOMENT. The reveal run backwards, with the same held stages.
    frames: [
      [0, 240], [0.19, 176], [0.21, 176],
      [0.43, 144], [0.45, 144],
      [0.67, 120], [0.69, 120],
      [0.90, 40], [1, 1],
    ],
    opacity:    [[0, 0.12], [0.15, 1], [1, 1]],
    brightness: [[0, 0.5], [0.15, 1], [1, 1]],
    // Settles and holds, then the faintest push at the end.
    scale:      [[0, 1.03], [0.35, 1], [0.82, 1], [1, 1.02]],
    blur:       [[0, 1.5], [0.15, 0], [1, 0]],
    text:       [[0, 0.8], [0.2, 0.28], [0.85, 0.28], [1, 0.6]],
  },
  {
    id: 'finale',
    frames:     [[0, 1], [1, 1]],
    opacity:    [[0, 1], [0.3, 0.62], [1, 0.55]],
    brightness: [[0, 1], [0.3, 0.85], [1, 0.8]],
    scale:      [[0, 1], [1, 1.06]],
    blur:       [[0, 0]],
    text:       [[0, 0.6], [0.25, 1], [1, 1]],
  },
];

const timelineFor = (id) => TIMELINE.find((t) => t.id === id);

/* ── js/fx/energy.js ─────────────────────────────── */
/* Act 03 — sound as energy.

   A single point of charge appears, pulses, and expands into concentric
   rings that resolve into the structure of the product. Everything is
   driven by act progress, so it scrubs backwards as cleanly as forwards. */


const RING_COUNT = 7;

class EnergyField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.progress = 0;
    this.on = false;
    this.particles = [];
    this.resize();
  }

  resize() {
    // 1.5x is indistinguishable from full retina for thin strokes,
    // and clears less than half the pixels each frame.
    const { w, h } = sizeCanvas(this.canvas, this.ctx, 1.5);
    this.w = w;
    this.h = h;
    this.max = Math.hypot(w, h) * 0.5;

    const count = w < 780 ? 26 : 54;
    this.particles = Array.from({ length: count }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random(),
      speed: 0.12 + Math.random() * 0.4,
      size: 0.6 + Math.random() * 1.5,
    }));
  }

  setProgress(p) {
    this.progress = clamp(p);
    const on = this.progress > 0.001 && this.progress < 0.999;
    if (on !== this.on) {
      this.on = on;
      this.canvas.classList.toggle('is-on', on);
    }
  }

  render(_dt, now) {
    if (!this.on) return;

    const { ctx, w, h } = this;
    const p = this.progress;
    const cx = w / 2;
    const cy = h * 0.46;
    const t = now * 0.001;

    ctx.clearRect(0, 0, w, h);

    // Overall presence: in quickly, out at the very end as the product arrives
    const alpha = mapRange(p, 0, 0.12) * (1 - mapRange(p, 0.88, 1));

    // ── The point of charge ────────────────────────────────────────────
    const pulse = prefersReducedMotion() ? 0 : Math.sin(t * 2.4) * 0.5 + 0.5;
    const coreR = (2.5 + pulse * 2.2) * (1 + p * 1.5);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 26);
    glow.addColorStop(0, `rgba(190, 210, 255, ${0.9 * alpha})`);
    glow.addColorStop(0.18, `rgba(110, 140, 255, ${0.38 * alpha})`);
    glow.addColorStop(1, 'rgba(47, 85, 232, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - coreR * 26, cy - coreR * 26, coreR * 52, coreR * 52);

    // ── Expanding rings ────────────────────────────────────────────────
    const spread = easeOut(mapRange(p, 0.1, 0.92));
    for (let i = 0; i < RING_COUNT; i += 1) {
      const phase = i / RING_COUNT;
      const drift = prefersReducedMotion() ? 0 : (t * 0.08) % 1;
      const r = ((phase + drift + spread) % 1) * this.max * (0.35 + spread * 0.8);
      if (r < 4) continue;

      const fade = (1 - r / (this.max * 1.15)) * alpha;
      if (fade <= 0) continue;

      // A copper undertone on the outermost rings keeps it from going cold
      const warm = mapRange(r, this.max * 0.5, this.max * 1.1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${110 + warm * 130}, ${140 - warm * 30}, ${255 - warm * 180}, ${fade * 0.34})`;
      ctx.lineWidth = 1 + (1 - warm) * 0.6;
      ctx.stroke();
    }

    // ── Particles riding the wavefront ─────────────────────────────────
    ctx.fillStyle = `rgba(200, 216, 255, ${0.5 * alpha})`;
    for (const particle of this.particles) {
      const r = ((particle.r + spread * particle.speed) % 1) * this.max;
      const x = cx + Math.cos(particle.a) * r;
      const y = cy + Math.sin(particle.a) * r * 0.82;
      const fade = (1 - r / this.max) * alpha;
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/* ── js/fx/visualizer.js ─────────────────────────────── */
/* Act 08 — see the system.

   A circular readout that answers the pointer. There is no audio element
   here (nothing to autoplay, and nothing we could honestly claim to be
   measuring), so the signal is synthesised: layered sines whose amplitude
   follows how fast and where the pointer moves. It should read as an
   instrument in a laboratory, not as a music player.

   Drawing is batched. Every bar is pushed into one of a few Path2D buckets
   and each bucket is stroked once, so the whole dial costs about a dozen
   draw calls a frame rather than one per bar. */


const ALPHA_BUCKETS = 4;
const TICKS = 84;

class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.progress = 0;
    this.on = false;

    this.pointer = { x: 0.5, y: 0.5 };
    this.eased = { x: 0.5, y: 0.5 };
    this.energy = 0;
    this.resize();
  }

  resize() {
    // 1.5x is indistinguishable from full retina for thin strokes,
    // and clears less than half the pixels each frame.
    const { w, h } = sizeCanvas(this.canvas, this.ctx, 1.5);
    this.w = w;
    this.h = h;
    const narrow = w < 780;
    /* Sized so the outer graduations, the bars at full swing and the copy
       beneath the dial all fit the viewport without colliding:
       dial reaches 1.76R and bars peak at 1.64R, both inside the viewport
       when centred, with the headline sitting inside the bar ring. */
    this.radius = Math.min(w, h) * (narrow ? 0.3 : 0.24);
    this.bars = narrow ? 84 : 156;
  }

  setProgress(p) {
    this.progress = clamp(p);
    const on = this.progress > 0.001 && this.progress < 0.999;
    if (on !== this.on) {
      this.on = on;
      this.canvas.classList.toggle('is-on', on);
    }
  }

  movePointer(x, y) {
    const nx = x / this.w;
    const ny = y / this.h;
    const travel = Math.hypot(nx - this.pointer.x, ny - this.pointer.y);
    this.energy = clamp(this.energy + travel * 5.5, 0, 1);
    this.pointer.x = nx;
    this.pointer.y = ny;
  }

  /** Outer boundary and its graduations — the dial the bars sit on. */
  #drawDial(cx, cy, R, alpha) {
    const { ctx } = this;
    const inner = R * 1.68;
    const outer = R * 1.76;

    const ticks = new Path2D();
    const majors = new Path2D();
    for (let i = 0; i < TICKS; i += 1) {
      const a = (i / TICKS) * Math.PI * 2;
      const major = i % 7 === 0;
      const from = major ? inner - R * 0.06 : inner;
      const path = major ? majors : ticks;
      path.moveTo(cx + Math.cos(a) * from, cy + Math.sin(a) * from);
      path.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(150, 175, 255, ${0.16 * alpha})`;
    ctx.stroke(ticks);
    ctx.strokeStyle = `rgba(190, 210, 255, ${0.4 * alpha})`;
    ctx.stroke(majors);

    const ring = new Path2D();
    ring.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 175, 255, ${0.22 * alpha})`;
    ctx.stroke(ring);
  }

  render(dt, now) {
    if (!this.on) return;

    const { ctx, w, h } = this;
    const t = now * 0.001;
    const still = prefersReducedMotion();

    const k = damp(0.08, dt);
    this.eased.x = lerp(this.eased.x, this.pointer.x, k);
    this.eased.y = lerp(this.eased.y, this.pointer.y, k);
    this.energy *= Math.pow(0.94, dt / 16.667);

    const alpha = mapRange(this.progress, 0, 0.18) * (1 - mapRange(this.progress, 0.82, 1));
    const drive = 0.42 + this.energy * 0.58;

    const cx = w / 2 + (this.eased.x - 0.5) * w * 0.06;
    // Concentric with the centred copy.
    const cy = h * 0.5 + (this.eased.y - 0.5) * h * 0.05;
    const R = this.radius;

    ctx.clearRect(0, 0, w, h);

    this.#drawDial(cx, cy, R, alpha);

    // ── Radiating bars ─────────────────────────────────────────────────
    // Bucketed by brightness, and split cool/warm, so the whole ring is a
    // handful of stroke calls instead of one per bar.
    const cool = Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
    const warmPaths = Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
    const toPointer = Math.atan2(this.eased.y - 0.5, this.eased.x - 0.5);
    const phase = still ? 0 : t * 1.5;
    // A slow highlight travelling the ring, so it breathes without the
    // pointer. Folded into brightness rather than drawn as a sweep.
    const highlight = still ? -9 : (t * 0.35) % (Math.PI * 2);

    for (let i = 0; i < this.bars; i += 1) {
      const a = (i / this.bars) * Math.PI * 2 - Math.PI / 2;

      const signal =
        Math.sin(a * 3 + phase) * 0.5 +
        Math.sin(a * 7 - phase * 0.7) * 0.3 +
        Math.sin(a * 13 + phase * 1.3) * 0.2;

      const proximity = Math.cos(a - toPointer) * 0.5 + 0.5;
      const sweep = still ? 0 : Math.pow(Math.max(0, Math.cos(a - highlight)), 8) * 0.5;

      const len = R * (0.1 + Math.abs(signal) * 0.3 * drive * (0.6 + proximity * 0.8) + sweep * 0.12);
      const x1 = cx + Math.cos(a) * R;
      const y1 = cy + Math.sin(a) * R;
      const x2 = cx + Math.cos(a) * (R + len);
      const y2 = cy + Math.sin(a) * (R + len);

      const strength = clamp(0.3 + Math.abs(signal) * 0.75 + sweep);
      const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(strength * ALPHA_BUCKETS));
      const path = proximity * this.energy > 0.45 ? warmPaths[bucket] : cool[bucket];
      path.moveTo(x1, y1);
      path.lineTo(x2, y2);
    }

    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let b = 0; b < ALPHA_BUCKETS; b += 1) {
      const level = (b + 1) / ALPHA_BUCKETS;
      ctx.strokeStyle = `rgba(150, 178, 255, ${0.62 * level * alpha})`;
      ctx.stroke(cool[b]);
      ctx.strokeStyle = `rgba(240, 150, 90, ${0.6 * level * alpha})`;
      ctx.stroke(warmPaths[b]);
    }
    ctx.lineCap = 'butt';

    // ── Inner waveform ─────────────────────────────────────────────────
    const wave = new Path2D();
    for (let i = 0; i <= 200; i += 1) {
      const a = (i / 200) * Math.PI * 2 - Math.PI / 2;
      const wob = still ? 0 : Math.sin(a * 6 + t * 2.2) * 0.022 + Math.sin(a * 11 - t * 1.4) * 0.014;
      const r = R * (0.72 + wob * drive * 3.4);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i === 0 ? wave.moveTo(x, y) : wave.lineTo(x, y);
    }
    wave.closePath();
    ctx.strokeStyle = `rgba(214, 228, 255, ${0.6 * alpha})`;
    ctx.lineWidth = 1.2;
    ctx.stroke(wave);

    // A second, quieter trace just inside it adds depth without noise.
    const inner = new Path2D();
    inner.arc(cx, cy, R * 0.58, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 178, 255, ${0.1 * alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke(inner);

    // ── Centre bloom ───────────────────────────────────────────────────
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    bloom.addColorStop(0, `rgba(58, 100, 255, ${0.3 * alpha * (0.55 + this.energy)})`);
    bloom.addColorStop(1, 'rgba(58, 100, 255, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
  }
}

/* ── js/ui/preloader.js ─────────────────────────────── */
/* Preloader — a black screen, a hairline meter and a count.
   Holds the page still until the opening frames are decoded. */

const LABELS = [
  [0.0, 'Initialising system'],
  [0.35, 'Loading sequence'],
  [0.75, 'Calibrating'],
  [0.99, 'Ready'],
];

class Preloader {
  constructor(root) {
    this.root = root;
    this.fill = root.querySelector('#preloader-fill');
    this.count = root.querySelector('#preloader-count');
    this.label = root.querySelector('#preloader-label');
    document.body.classList.add('is-locked');
  }

  set(ratio) {
    const pct = Math.round(ratio * 100);
    this.fill.style.transform = `scaleX(${ratio})`;
    this.count.textContent = String(Math.min(99, pct)).padStart(2, '0');

    const match = LABELS.filter(([at]) => ratio >= at).pop();
    if (match && this.label.textContent !== match[1]) this.label.textContent = match[1];
  }

  async done() {
    this.set(1);
    this.count.textContent = '100';
    await new Promise((r) => setTimeout(r, 420));
    this.root.classList.add('is-done');
    document.body.classList.remove('is-locked');
    setTimeout(() => this.root.remove(), 1300);
  }
}

/* ── js/ui/nav.js ─────────────────────────────── */
/* Navigation — invisible at rest, earns a surface once you leave the hero,
   and hides itself while you scroll down so the film stays unobstructed. */


const STICK_AT = 80;

function initNav(nav, links) {
  const toggle = nav.querySelector('#nav-toggle');
  let hidden = false;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('.nav__links a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );

  onTick(() => {
    nav.classList.toggle('is-stuck', scroll.y > STICK_AT);

    // Only hide on a deliberate downward scroll, never near the top
    const shouldHide =
      !nav.classList.contains('is-open') && scroll.velocity > 1.4 && scroll.y > scroll.vh * 0.9;
    const shouldShow = scroll.velocity < -0.6 || scroll.y < STICK_AT;

    if (shouldHide && !hidden) { hidden = true; nav.classList.add('is-hidden'); }
    else if (shouldShow && hidden) { hidden = false; nav.classList.remove('is-hidden'); }
  });

  // Highlight the section you are actually in
  const targets = links
    .map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((t) => t.el);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const match = targets.find((t) => t.el === entry.target);
        if (match) match.a.classList.toggle('is-active', entry.isIntersecting);
      });
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  targets.forEach((t) => io.observe(t.el));
}

/* ── js/ui/cursor.js ─────────────────────────────── */
/* A soft light that trails the pointer. Pointer devices only. */


function initCursor(el) {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const eased = { ...target };

  addEventListener('pointermove', (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    el.classList.add('is-on');
  }, { passive: true });

  addEventListener('pointerleave', () => el.classList.remove('is-on'), { passive: true });

  onTick((dt) => {
    const k = damp(0.12, dt);
    eased.x = lerp(eased.x, target.x, k);
    eased.y = lerp(eased.y, target.y, k);
    el.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0)`;
  });
}

/* ── js/ui/magnetic.js ─────────────────────────────── */
/* Magnetic hover — elements lean towards the pointer within a radius.
   Subtle on purpose: a few pixels, never a jump. */


const RADIUS = 90;
const PULL = 0.32;
/* How often geometry is re-read. Reading layout in the animation loop
   forces a synchronous reflow, and doing it per element per frame was
   costing several forced layouts every single frame. These elements barely
   move, so measuring a few times a second is indistinguishable. */
const MEASURE_INTERVAL = 120;

function initMagnetic(nodes) {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const items = nodes.map((el) => ({ el, x: 0, y: 0, cx: 0, cy: 0, reach: 0 }));
  const pointer = { x: -9999, y: -9999 };
  let lastMeasure = 0;

  const measure = () => {
    for (const item of items) {
      const r = item.el.getBoundingClientRect();
      item.cx = r.left + r.width / 2;
      item.cy = r.top + r.height / 2;
      item.reach = RADIUS + Math.max(r.width, r.height) / 2;
    }
  };

  measure();
  onResize(measure);

  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });

  onTick((dt, now) => {
    // One batched read, well apart from the writes below.
    if (now - lastMeasure > MEASURE_INTERVAL) {
      lastMeasure = now;
      measure();
    }

    const k = damp(0.16, dt);
    for (const item of items) {
      const dx = pointer.x - item.cx;
      const dy = pointer.y - item.cy;
      const near = Math.hypot(dx, dy) < item.reach;

      item.x = lerp(item.x, near ? dx * PULL : 0, k);
      item.y = lerp(item.y, near ? dy * PULL : 0, k);

      item.el.style.transform =
        Math.abs(item.x) < 0.05 && Math.abs(item.y) < 0.05
          ? ''
          : `translate3d(${item.x}px, ${item.y}px, 0)`;
    }
  });
}

/* ── js/ui/reveal.js ─────────────────────────────── */
/* Text and block reveals.

   Words ride up out of their own clip mask, staggered. Everything is
   triggered once, by IntersectionObserver, so reveals never re-fire and
   never fight the scroll. */

const WORD_MARGIN = '0px 0px -12% 0px';

/** Wrap each word in a mask, leaving <br> and other elements untouched. */
function splitWords(el) {
  const original = [...el.childNodes];
  el.textContent = '';
  let index = 0;

  for (const node of original) {
    if (node.nodeType !== Node.TEXT_NODE) {
      el.appendChild(node);
      continue;
    }
    for (const part of node.textContent.split(/(\s+)/)) {
      if (part === '') continue;
      if (!part.trim()) {
        el.appendChild(document.createTextNode(part));
        continue;
      }
      const mask = document.createElement('span');
      mask.className = 'word';
      const inner = document.createElement('span');
      inner.className = 'word__in';
      inner.textContent = part;
      inner.style.setProperty('--i', String(index));
      index += 1;
      mask.appendChild(inner);
      el.appendChild(mask);
    }
  }
}

function applyDelay(el) {
  const delay = el.dataset.revealDelay;
  if (delay) el.style.setProperty('--d', `${delay}ms`);
}

function initReveal() {
  const words = [...document.querySelectorAll('[data-reveal-words]')];
  words.forEach((el) => {
    splitWords(el);
    applyDelay(el);
  });

  const plain = [...document.querySelectorAll('[data-reveal]')];
  plain.forEach(applyDelay);

  const groups = [...document.querySelectorAll('[data-stagger]')];
  groups.forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty('--i', String(i)));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: WORD_MARGIN, threshold: 0.1 }
  );

  [...words, ...plain, ...groups].forEach((el) => observer.observe(el));
}

/* ── js/ui/rail.js ─────────────────────────────── */
/* Act 06 — the horizontal rail.

   Vertical scroll inside the pinned act drives the track sideways, so the
   gallery reads as a continuation of the same movement rather than a
   separate widget with its own scrollbar. */



function initRail(rail, track) {
  const act = actById('system');
  if (!act) return;

  let distance = 0;
  const measure = () => {
    distance = Math.max(0, track.scrollWidth - rail.clientWidth);
  };
  measure();
  onResize(measure);
  addEventListener('load', () => setTimeout(measure, 200));

  onTick(() => {
    if (!act.active) return;
    // Hold briefly at each end so the cards are readable before they move
    const p = easeInOut(clamp(mapRange(act.progress, 0.12, 0.88)));
    track.style.transform = `translate3d(${-distance * p}px, 0, 0)`;
  });
}

/* ── js/ui/parallax.js ─────────────────────────────── */
/* Act 07 — depth. Layers travel at different rates through the pinned act. */



const RANGE = 420;

function initParallax(layers) {
  const act = actById('presence');
  if (!act || prefersReducedMotion()) return;

  const items = layers.map((el) => ({ el, depth: parseFloat(el.dataset.depth) || 0.2 }));

  onTick(() => {
    if (!act.active) return;
    const centred = act.progress - 0.5;
    for (const { el, depth } of items) {
      el.style.transform = `translate3d(0, ${-centred * RANGE * depth * 2}px, 0)`;
    }
  });
}

/* ── js/ui/beats.js ─────────────────────────────── */
/* Scroll beats — things that switch on at a given point inside an act.

   All of these share one job: read an act's progress, toggle a state. */



/** Act 05 — the three statements, each arriving at its own moment. */
function initStatements(nodes) {
  const act = actById('purpose');
  if (!act) return;
  const cues = [0.16, 0.4, 0.64];

  onTick(() => {
    if (!act.active) return;
    nodes.forEach((el, i) => {
      el.classList.toggle('is-on', act.progress >= cues[i] && act.progress < 0.97);
    });
  });
}

/** Act 04 — hotspots and the component ticker, live only while fully exploded. */
function initExplodeOverlay(hotspots, ticker, tickerText) {
  const act = actById('explode');
  if (!act || !hotspots) return;

  const labels = [...hotspots.querySelectorAll('.hotspot')].map((h) => h.dataset.kind);
  let shown = '';

  hotspots.querySelectorAll('.hotspot').forEach((spot) => {
    spot.setAttribute('aria-label', spot.dataset.label);
    spot.addEventListener('pointerenter', () => {
      tickerText.textContent = spot.dataset.label;
      shown = spot.dataset.label;
    });
    spot.addEventListener('pointerleave', () => { shown = ''; });
  });

  onTick(() => {
    if (!act.active) return;
    const live = act.progress > 0.52 && act.progress < 0.96;
    hotspots.classList.toggle('is-on', live);
    ticker.classList.toggle('is-on', live);

    if (!live || shown) return;
    const i = Math.min(labels.length - 1, Math.floor(mapRange(act.progress, 0.52, 0.96) * labels.length));
    if (tickerText.textContent !== labels[i]) tickerText.textContent = labels[i];
  });
}

/** Act 09 — the creed, one word at a time, extremely slowly. */
function initCreed(creed) {
  const act = actById('philosophy');
  if (!act || !creed) return;

  const words = [...creed.querySelectorAll('span')];

  onTick(() => {
    if (!act.active) return;
    // Spread the words across the middle of the act, then hold
    const reached = mapRange(act.progress, 0.12, 0.72) * words.length;
    words.forEach((word, i) => word.classList.toggle('is-on', reached > i));
  });
}

/** The top progress bar. */
function initProgressBar(bar) {
  onTick(() => {
    bar.style.transform = `scaleX(${clamp(scroll.progress)})`;
  });
}

function initBeats(refs) {
  initStatements(refs.statements);
  initExplodeOverlay(refs.hotspots, refs.ticker, refs.tickerText);
  initCreed(refs.creed);
  initProgressBar(refs.progressBar);
}

/* ── js/ui/debug.js ─────────────────────────────── */
/* Frame-timing probe. Off unless the URL carries ?debug.

   Measures the things that actually make a sequence feel like a slideshow:

     stall     longest gap between animation frames (micro-freezes)
     jump      largest frame-index step between two draws
     fallback  draws that showed a neighbouring frame because the exact
               one was not decoded yet — the real cause of 20 → 24 → 24
     decoded   how much of the sequence is ready to draw with no hitch

   A healthy run: stall under ~32ms, jump in single digits at normal scroll
   speed, fallback at or near 0 once loading settles. */

function initDebug(loader) {
  if (!/[?&]debug/.test(location.search)) return null;

  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed', 'left:12px', 'bottom:12px', 'z-index:200',
    'font:11px/1.5 ui-monospace,SF Mono,Menlo,monospace',
    'color:#9fb4ff', 'background:rgba(3,3,3,.82)', 'border:1px solid rgba(255,255,255,.12)',
    'border-radius:8px', 'padding:8px 10px', 'white-space:pre', 'pointer-events:none',
    'backdrop-filter:blur(8px)',
  ].join(';');
  document.body.appendChild(box);

  let frames = 0;
  let fps = 0;
  let windowStart = performance.now();
  let maxStall = 0;
  let maxJump = 0;
  let fallbacks = 0;
  let draws = 0;
  let lastDrawn = null;

  // Rolling reset so a single early hiccup does not poison the readout.
  const RESET_AFTER = 4000;
  let lastReset = performance.now();

  return function report({ requested, drawn, dt, now }) {
    frames += 1;
    if (dt > maxStall) maxStall = dt;

    if (drawn !== null && drawn !== lastDrawn) {
      draws += 1;
      if (lastDrawn !== null) {
        const jump = Math.abs(drawn - lastDrawn);
        if (jump > maxJump) maxJump = jump;
      }
      if (drawn !== requested) fallbacks += 1;
      lastDrawn = drawn;
    }

    if (now - windowStart >= 500) {
      fps = Math.round((frames * 1000) / (now - windowStart));
      frames = 0;
      windowStart = now;

      const s = loader.stats();
      box.textContent = [
        `fps       ${fps}`,
        `frame     ${requested}  (drawn ${drawn ?? '—'})`,
        `stall     ${maxStall.toFixed(1)}ms`,
        `max jump  ${maxJump}`,
        `fallback  ${fallbacks}/${draws}`,
        `decoded   ${s.decoded}/${s.total}   loaded ${s.loaded}/${s.total}`,
      ].join('\n');
    }

    if (now - lastReset > RESET_AFTER) {
      lastReset = now;
      maxStall = 0;
      maxJump = 0;
      fallbacks = 0;
      draws = 0;
    }
  };
}

/* ── js/main.js ─────────────────────────────── */
/* ZILLOUT — entry point.

   The whole page is one continuous shot. A single fixed canvas plays a
   240-frame sequence; each act owns a stretch of that sequence and a
   visual treatment. Nothing else on the page has a background, so the
   film shows through from the first pixel to the last. */















const TOTAL_FRAMES = 240;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/** Phones and metered connections load half the sequence — same frames,
    every second one, so quality never drops, only the byte count. */
function frameStep() {
  const saveData = navigator.connection?.saveData === true;
  if (saveData) return 4;
  // Width, not touch capability — a touchscreen laptop still deserves
  // the full sequence.
  return innerWidth < 860 ? 2 : 1;
}

function boot() {
  // Always open on frame one
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  const filmEl = $('#film');
  const film = new FilmCanvas($('#film-canvas'));
  const energy = new EnergyField($('#fx-energy'));
  const visualizer = new Visualizer($('#fx-visualizer'));

  const actNodes = $$('.act');
  initScroll();
  registerActs(actNodes);

  const energyAct = actById('energy');
  const visualAct = actById('visualizer');

  const loader = new FrameLoader({ total: TOTAL_FRAMES, step: frameStep() });
  const debug = initDebug(loader);

  // ── The film loop ────────────────────────────────────────────────────
  let lastFrame = -1;
  let activeSticky = null;

  const written = new Map();
  const write = (prop, value) => {
    if (written.get(prop) === value) return;
    written.set(prop, value);
    filmEl.style.setProperty(prop, value);
  };

  onTick((dt, now) => {
    // Which act is the camera in?
    let index = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (scroll.smooth >= acts[i].top) index = i;
    }
    const act = acts[index];
    const cue = timelineFor(act.id);
    if (!cue) return;

    const p = act.progress;

    // Redraw only when the frame actually changes
    const rounded = Math.round(sampleStops(cue.frames, p, false));
    // Point background loading at where the scrub is, so the frames about
    // to be needed are the ones being fetched.
    loader.setPlayhead(rounded);
    let drawnFrame = lastFrame;
    if (rounded !== lastFrame) {
      lastFrame = rounded;
      const img = loader.nearest(rounded);
      film.draw(img);
      drawnFrame = img ? Number(img.src.match(/(\d+)\.jpg$/)?.[1] ?? rounded) : null;
    }

    const blur = sampleStops(cue.blur, p);
    const bright = sampleStops(cue.brightness, p);
    const filter =
      blur < 0.05 && Math.abs(bright - 1) < 0.004
        ? 'none'
        : blur < 0.05
          ? `brightness(${bright.toFixed(3)})`
          : `blur(${blur.toFixed(2)}px) brightness(${bright.toFixed(3)})`;

    // Only touch the DOM when a value actually changed: style writes on a
    // fixed full-screen element invalidate every frame otherwise.
    write('--film-opacity', sampleStops(cue.opacity, p).toFixed(3));
    write('--film-scale', sampleStops(cue.scale, p).toFixed(4));
    write('--film-filter', filter);

    // The focus shift: typography recedes while the product leads, and
    // returns as the product steps back. Only the act in frame is touched.
    const sticky = act.sticky;
    if (sticky !== activeSticky) {
      if (activeSticky) {
        activeSticky.style.removeProperty('--text-focus');
        activeSticky.classList.remove('is-live');
      }
      // Promote only the act on screen, so its opacity animates on the
      // compositor instead of repainting a full-viewport block of text.
      sticky.classList.add('is-live');
      activeSticky = sticky;
    }
    sticky.style.setProperty('--text-focus', sampleStops(cue.text, p).toFixed(3));

    energy.setProgress(energyAct.progress);
    visualizer.setProgress(visualAct.progress);
    energy.render(dt, now);
    visualizer.render(dt, now);

    debug?.({ requested: rounded, drawn: drawnFrame, dt, now });
  });

  addEventListener('pointermove', (e) => visualizer.movePointer(e.clientX, e.clientY), { passive: true });

  onResize(() => {
    film.resize();
    energy.resize();
    visualizer.resize();
    measure();
    lastFrame = -1;
  });

  // ── Chrome that does not depend on the sequence ──────────────────────
  initNav($('#nav'), $$('.nav__links a'));
  initCursor($('#cursor'));
  initRail($('#rail'), $('#rail-track'));
  initParallax($$('.parallax__l'));
  initBeats({
    statements: $$('.statement'),
    hotspots: $('#hotspots'),
    ticker: $('#explode-ticker'),
    tickerText: $('#explode-ticker-text'),
    creed: $('[data-creed]'),
    progressBar: $('#progress-bar'),
  });

  // ── Load, then let the film start ────────────────────────────────────
  const preloader = new Preloader($('#preloader'));

  loader.start((ratio) => preloader.set(ratio)).then(async () => {
    film.draw(loader.nearest(1));
    await preloader.done();
    // Reveals wait for the curtain, so the opening plays where it is seen
    initReveal();
    initMagnetic($$('[data-magnetic]'));
    measure();
  });
}

document.readyState === 'loading'
  ? addEventListener('DOMContentLoaded', boot, { once: true })
  : boot();

})();

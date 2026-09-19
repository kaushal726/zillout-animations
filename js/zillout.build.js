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

   Every animated system subscribes here rather than starting its own, and
   each frame runs in two phases:

     read    anything that measures — scroll position, element geometry.
             Runs first, while layout is still clean from the last frame.
     write   everything else: compute, then touch the DOM and canvases.

   Reading layout after something has written styles in the same frame
   forces the browser to recalculate style and layout synchronously, on the
   spot. Keeping all reads ahead of all writes means that never happens. */

const readers = new Set();
const writers = new Set();
let running = false;
let last = 0;

function run(set, dt, now) {
  for (const fn of set) {
    try {
      fn(dt, now);
    } catch (error) {
      // One bad subscriber must not take the whole page's motion with it:
      // without this, a single throw stops the loop permanently.
      console.error('[zillout] ticker subscriber failed, dropping it:', error);
      set.delete(fn);
    }
  }
}

function frame(now) {
  const dt = Math.min(64, now - last); // cap after a tab-switch stall
  last = now;

  run(readers, dt, now);
  run(writers, dt, now);

  if (readers.size + writers.size > 0) requestAnimationFrame(frame);
  else running = false;
}

/**
 * Subscribe to the shared loop. Returns an unsubscribe function.
 * @param {(dt:number, now:number) => void} fn
 * @param {{ phase?: 'read' | 'write' }} [options]
 */
function onTick(fn, { phase = 'write' } = {}) {
  const set = phase === 'read' ? readers : writers;
  set.add(fn);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  return () => set.delete(fn);
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
/* Scroll state — the single clock the whole film runs on.

   Native scrolling is left completely intact; nothing transforms <body>.
   The position is sampled exactly once per frame, in the ticker's read
   phase, and every scroll-linked visual on the page — the film, its
   lighting, text focus, reveals, hotspots, parallax, the progress ring —
   is computed from that one number in that same frame.

   There is deliberately no easing here. The sticky layout is moved by the
   browser from the real scroll position; an eased copy driving the film
   made the product trail the text by several frames and finish moving on
   its own after the hand had stopped. Smoothness comes from the browser's
   own scrolling (trackpad momentum, animated wheel scrolling), and every
   layer follows the same value, so they can never disagree. */


const scroll = {
  y: 0,          // scrollY, sampled once per frame
  progress: 0,   // 0..1 over the whole document
  velocity: 0,   // px/frame, signed
  vh: 0,
  vw: 0,
};

/**
 * @type {{
 *   id:string, el:HTMLElement, sticky:HTMLElement, cue:object|null,
 *   top:number, height:number, span:number,
 *   progress:number,  // 0..1 while the act is pinned
 *   local:number,     // viewport-heights from the pin point: -1 → 0 while
 *                     // scrolling in, then 0 → span/vh while pinned
 *   active:boolean,   // any part of the act is on screen
 * }[]}
 */
const acts = [];

let maxScroll = 1;

function registerActs(nodes, cueFor) {
  acts.length = 0;
  for (const el of nodes) {
    acts.push({
      id: el.dataset.act,
      el,
      sticky: el.firstElementChild,
      cue: cueFor ? cueFor(el.dataset.act) ?? null : null,
      top: 0,
      height: 1,
      span: 1,
      progress: 0,
      local: -1,
      active: false,
    });
  }
  measure();
}

/** Cache layout. Called on load and on resize only — never per frame. */
function measure() {
  scroll.vh = innerHeight;
  scroll.vw = innerWidth;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - scroll.vh);
  for (const act of acts) {
    act.top = act.el.offsetTop;
    act.height = act.el.offsetHeight;
    // While an act's sticky child is pinned, the act travels (height - vh).
    act.span = Math.max(1, act.height - scroll.vh);
  }
}

function sample() {
  const y = window.scrollY || window.pageYOffset || 0;
  scroll.velocity = y - scroll.y;
  scroll.y = y;
  scroll.progress = clamp(y / maxScroll);

  for (const act of acts) {
    act.progress = clamp((y - act.top) / act.span);
    act.local = (y - act.top) / scroll.vh;
    act.active = y >= act.top - scroll.vh && y < act.top + act.height;
  }
}

function initScroll() {
  scroll.y = window.scrollY || 0;
  measure();
  onResize(measure);
  // Fonts and images can shift layout after first paint; re-measure once.
  addEventListener('load', () => setTimeout(measure, 120));
  onTick(sample, { phase: 'read' });
}

const actById = (id) => acts.find((a) => a.id === id);

/* ── js/core/stage.js ─────────────────────────────── */
/* Shared per-frame state.

   Several systems need the same few facts — where the pointer is, where the
   camera is, where the product sits on screen, which component is under the
   light. They live here, each field with exactly one writer, instead of every
   module tracking its own copy and drifting out of step.

     pointer   written here
     camera    written by the film loop (main.js)
     product   written by the film loop
     hotspot   written by ui/hotspots.js */


const stage = {
  // x/y are raw; ex/ey are an eased copy, for anything that should drift
  // after the pointer rather than snap to it (light, halo).
  pointer: { x: 0, y: 0, ex: 0, ey: 0, inside: false, fine: false },
  camera: { scale: 1, tx: 0, ty: 0 },
  // Screen-space centre of the product, how visible it is (0..1), and how
  // much this moment invites studio light and the product halo (0..1).
  product: { x: 0, y: 0, presence: 0, studio: 0 },
  // The component under the light, how far the light has come up (amount),
  // and how far into focus mode it is (focus).
  hotspot: { id: null, amount: 0, focus: 0 },
};

function initStage() {
  const p = stage.pointer;
  p.fine = !isCoarsePointer();
  p.x = p.ex = innerWidth / 2;
  p.y = p.ey = innerHeight / 2;

  addEventListener('pointermove', (e) => {
    p.x = e.clientX;
    p.y = e.clientY;
    p.inside = true;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { p.inside = false; });
  addEventListener('blur', () => { p.inside = false; });

  onTick((dt) => {
    const k = damp(0.07, dt);
    p.ex = lerp(p.ex, p.x, k);
    p.ey = lerp(p.ey, p.y, k);
  });
}

/* ── js/core/quality.js ─────────────────────────────── */
/* Quality governor — protects the film when the device is struggling.

   Priorities, highest first:
     1  the image sequence              never degraded
     2  typography and its focus shift  never degraded
     3  interaction (hotspots, callout) never degraded
     4  ambient (sound field, studio light, cursor halo)
     5  decoration (grain movement)

   The governor watches real frame pacing. If a large share of frames in a
   window arrive late, it steps quality down one level, shedding priority 5
   and then priority 4 work. It steps back up only after a long run of good
   windows, so it cannot flicker between levels.

     level 2   everything
     level 1   ambient reduced: fewer motes, no studio light, grain still
     level 0   ambient off

   Phones start at level 1: the same film, with lighter atmosphere. */

/** A frame counts as late past this — two-thirds of a 60Hz frame over. */
const LATE_FRAME_MS = 26;
const WINDOW_MS = 600;
/** Share of late frames in a window that means sustained pressure. */
const DEGRADE_AT = 0.35;
/** Good windows in a row needed before stepping back up. */
const RECOVER_AFTER = 8;

const quality = { level: 2, max: 2 };

function initQuality() {
  const narrow = innerWidth < 860;
  quality.max = narrow ? 1 : 2;
  quality.level = quality.max;
  document.documentElement.dataset.quality = String(quality.level);

  let elapsed = 0;
  let frames = 0;
  let late = 0;
  let calm = 0;

  const set = (level) => {
    if (level === quality.level) return;
    quality.level = level;
    document.documentElement.dataset.quality = String(level);
  };

  onTick((dt) => {
    // The ticker caps dt at 64ms after a stall (tab switch, first paint);
    // those are not evidence of steady pressure.
    if (dt >= 64) return;
    frames += 1;
    if (dt > LATE_FRAME_MS) late += 1;
    elapsed += dt;
    if (elapsed < WINDOW_MS) return;

    const share = late / frames;
    if (share > DEGRADE_AT && quality.level > 0) {
      set(quality.level - 1);
      calm = 0;
    } else if (share < 0.05) {
      calm += 1;
      if (calm >= RECOVER_AFTER && quality.level < quality.max) {
        set(quality.level + 1);
        calm = 0;
      }
    } else {
      calm = 0;
    }
    elapsed = 0;
    frames = 0;
    late = 0;
  }, { phase: 'read' });
}

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

/* ── js/film/camera.js ─────────────────────────────── */
/* The film's three coordinate spaces.

     art     0..1 across the source still
     canvas  CSS pixels of the film canvas, before its CSS transform
     screen  viewport pixels, after the camera: scale about ORIGIN, then
             translate

   Anything that has to sit on a component — a hotspot, a light, a marker —
   is defined once in art space and mapped through here, so it stays locked
   to the render on every aspect ratio and through every camera move. */

/** Must match `.film__canvas { transform-origin }`. */
const ORIGIN = { x: 0.5, y: 0.46 };

function canvasToScreen(cam, x, y, w, h) {
  const ox = w * ORIGIN.x;
  const oy = h * ORIGIN.y;
  return { x: ox + (x - ox) * cam.scale + cam.tx, y: oy + (y - oy) * cam.scale + cam.ty };
}

function screenToCanvas(cam, x, y, w, h) {
  const ox = w * ORIGIN.x;
  const oy = h * ORIGIN.y;
  return { x: ox + (x - cam.tx - ox) / cam.scale, y: oy + (y - cam.ty - oy) / cam.scale };
}

/**
 * Translation that carries the canvas point (px, py) a fraction `pull` of
 * the way from where the plain scale would put it towards the centre of the
 * frame. pull = 0 is exactly the un-aimed camera, so aiming can ease in and
 * out with no jump.
 */
function aimTranslate(px, py, scale, pull, w, h) {
  const landedX = w * ORIGIN.x + (px - w * ORIGIN.x) * scale;
  const landedY = h * ORIGIN.y + (py - h * ORIGIN.y) * scale;
  return {
    tx: lerp(landedX, w * 0.5, pull) - landedX,
    ty: lerp(landedY, h * 0.5, pull) - landedY,
  };
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

/* ── js/film/canvas.js ─────────────────────────────── */
/* The film canvas — draws one still, correctly framed, then lights it.

   Lighting is how every "focus" moment on this page works. The render is a
   flat image sequence with no separate layers, so a component cannot really
   step forward. What can be done honestly is what a lighting director does:
   put light on one thing and let shadow take the rest. Three passes, all
   drawn over the untouched frame:

     lights  soft-light highlights. Soft-light leaves black black, so light
             only lands on the product, never on the empty studio around it.
     rim     a band of light at a radius, for light that travels.
     shade   darkness outside a circle, with a soft falloff.

   Then two things that used to be separate full-screen layers, baked into
   the same draw so the compositor no longer blends them every frame:

     vignette  rendered once per resize into an offscreen canvas and blitted.
     dim       the film's brightness, as one black fill. A CSS filter on this
               canvas cost an extra offscreen pass at device resolution on
               every frame, whether or not anything had changed.            */


/* The stills are 1920x1080. Filling a retina backing store means drawing
   them at 2x their own resolution — four times the pixels to push, for no
   detail that exists in the source. Cap the backing store at the source
   width and let the compositor do the final upscale, which is free. */
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

const LIGHT = '214, 226, 255';
const RIM = '222, 232, 255';
const SHADE = '3, 3, 3';

class FilmCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.current = null;
    this.lighting = null;
    this.lightKey = '';
    this.brightness = 1;
    this.vignette = document.createElement('canvas');
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
    this.fit = this.#fitFor(SOURCE_WIDTH, SOURCE_HEIGHT);
    this.#renderVignette();
    if (this.current) this.draw(this.current, this.lighting, this.brightness, true);
  }

  /** The corner falloff and the top/bottom scrims (for the nav above and
      the copy below), rendered once at the canvas's own resolution. */
  #renderVignette() {
    const v = this.vignette;
    v.width = this.canvas.width;
    v.height = this.canvas.height;
    const g = v.getContext('2d');
    const w = v.width;
    const h = v.height;

    // Elliptical corner falloff: a circular gradient in a scaled space.
    const rx = w * 0.8;
    const ry = h * 0.64;
    g.save();
    g.translate(w * 0.5, h * 0.46);
    g.scale(rx / ry, 1);
    const radial = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    radial.addColorStop(0.34, `rgba(${SHADE}, 0)`);
    radial.addColorStop(0.74, `rgba(${SHADE}, 0.5)`);
    radial.addColorStop(1, `rgba(${SHADE}, 0.9)`);
    g.fillStyle = radial;
    g.fillRect(-w * 2, -h * 2, w * 4, h * 4); // over-covers; clipped to the canvas
    g.restore();

    const linear = g.createLinearGradient(0, 0, 0, h);
    linear.addColorStop(0, `rgba(${SHADE}, 0.82)`);
    linear.addColorStop(0.15, `rgba(${SHADE}, 0.28)`);
    linear.addColorStop(0.32, `rgba(${SHADE}, 0)`);
    linear.addColorStop(0.5, `rgba(${SHADE}, 0)`);
    linear.addColorStop(0.8, `rgba(${SHADE}, 0.58)`);
    linear.addColorStop(1, `rgba(${SHADE}, 0.9)`);
    g.fillStyle = linear;
    g.fillRect(0, 0, w, h);
  }

  /**
   * Wide screens get a full cover crop. Portrait screens ease towards a
   * contained fit instead — the exploded components spread far to the left
   * and right, and a cover crop on a phone would throw them off screen.
   * The artwork sits on pure black, so the letterboxing is invisible.
   */
  #fitFor(iw, ih) {
    const cover = Math.max(this.w / iw, this.h / ih);
    const contain = Math.min(this.w / iw, this.h / ih);
    // Just past a contained fit: enough overscan to kill the side letterbox
    // without cropping the outermost exploded parts, which sit at roughly
    // 10% in from each edge of the artwork.
    const portrait = contain * 1.15;
    const aspect = mapRange(this.w / this.h, 0.72, 1.25);
    const s = lerp(portrait, cover, aspect);
    // On portrait the band is much shorter than the screen, so it is lifted
    // off dead centre to leave the copy below it room to breathe.
    const anchor = lerp(0.45, 0.5, aspect);
    return { s, x: (this.w - iw * s) / 2, y: (this.h - ih * s) * anchor };
  }

  /** Art space (0..1 of the source still) to canvas pixels. */
  artToCanvas(u, v) {
    const { s, x, y } = this.fit;
    return { x: x + u * SOURCE_WIDTH * s, y: y + v * SOURCE_HEIGHT * s };
  }

  /** A length in art-width units, in canvas pixels. */
  artLength(units) {
    return units * SOURCE_WIDTH * this.fit.s;
  }

  /**
   * Redraws only when the still, the lighting or the brightness actually
   * changed. Lighting carries a precomputed key and brightness is bucketed,
   * so an idle page costs nothing here.
   */
  draw(img, lighting = null, brightness = 1, force = false) {
    if (!img) return;
    const bright = Math.min(1, brightness);
    const key = `${lighting ? lighting.key : ''}|${Math.round(bright * 200)}`;
    if (!force && img === this.current && key === this.lightKey) return;
    this.current = img;
    this.lighting = lighting;
    this.lightKey = key;
    this.brightness = bright;

    const { ctx } = this;
    const fit = img.naturalWidth === SOURCE_WIDTH ? this.fit : this.#fitFor(img.naturalWidth, img.naturalHeight);

    ctx.fillStyle = `rgb(${SHADE})`;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(img, fit.x, fit.y, img.naturalWidth * fit.s, img.naturalHeight * fit.s);

    if (lighting) this.#light(lighting);

    // Blitted in device pixels, so reset to identity for this one draw.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.vignette, 0, 0);
    ctx.restore();

    if (bright < 0.998) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - bright).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  #light({ lights, rim, shade }) {
    const { ctx } = this;

    // Light first, then shadow: light that falls outside the pool is then
    // taken back by the shade, so it reads as a lit edge, not a glow.
    if (lights.length || rim) {
      ctx.globalCompositeOperation = 'soft-light';

      for (const l of lights) {
        if (l.strength < 0.004 || l.r < 1) continue;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(${LIGHT}, ${l.strength})`);
        g.addColorStop(1, `rgba(${LIGHT}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }

      if (rim && rim.strength > 0.004) {
        const inner = Math.max(0, rim.r - rim.width);
        const outer = rim.r + rim.width;
        const g = ctx.createRadialGradient(rim.x, rim.y, inner, rim.x, rim.y, outer);
        g.addColorStop(0, `rgba(${RIM}, 0)`);
        g.addColorStop(0.5, `rgba(${RIM}, ${rim.strength})`);
        g.addColorStop(1, `rgba(${RIM}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(rim.x - outer, rim.y - outer, outer * 2, outer * 2);
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    if (shade && shade.alpha > 0.004) {
      const r = Math.max(0, shade.r);
      const g = ctx.createRadialGradient(shade.x, shade.y, r, shade.x, shade.y, r + Math.max(1, shade.soft));
      g.addColorStop(0, `rgba(${SHADE}, 0)`);
      g.addColorStop(1, `rgba(${SHADE}, ${shade.alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }
}

/* ── js/film/cues.js ─────────────────────────────── */
/* Cinematic cues — where the light falls, and the transition wave.

   Every cue is a pure function of act progress (plus the pointer, for the
   studio light), so each one scrubs backwards exactly as it plays forwards.
   None of them redraws or moves a component: the film is still the original
   render. They only decide where the light goes.

     powerup    Act 03. A converged acoustic ring releases outward, and the
                product is revealed inside it, lit by its passing edge.
     focus      Act 06 opening. Shadow closes in until only the crown ring
                is left, the camera travels to it, and its circle leaves as a
                wave that carries into the gallery.
     spotlight  Act 04. A hovered component comes up into light while the
                rest of the assembly drops back.
     reveal     Act 12. The finished product in darkness, uncovered by a
                light that travels head, then body, then everything.
     studio     A soft key light that leans towards the pointer, only in
                moments where the product is the subject.                    */


/* Components that can be put under the light, in art space. Measured on the
   fully exploded frames (176–214), where they barely move. r is the radius
   of the part in art-width units. */
const COMPONENTS = {
  crown: { u: 0.5, v: 0.078, r: 0.07 },
  power: { u: 0.5, v: 0.665, r: 0.068 },
  control: { u: 0.71, v: 0.333, r: 0.045 },
  plating: { u: 0.262, v: 0.655, r: 0.066 },
};

/* ── Power-up geometry, shared with the energy field that draws the ring ── */

const POWERUP = { converge: 0.62, reveal: 0.78 };

/** The acoustic ring at the end of Act 03, in screen space. null before it
    releases. */
function powerupRing(p, w, h) {
  if (p < POWERUP.reveal) return null;
  const t = mapRange(p, POWERUP.reveal, 1);
  const eased = t * t; // accelerates outward, like a released wave
  const cx = w * ORIGIN.x;
  const cy = h * ORIGIN.y;
  const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 1.04;
  return {
    x: cx,
    y: cy,
    t,
    r: lerp(Math.min(w, h) * 0.09, far, eased),
    soft: lerp(12, 240, eased),
  };
}

/* ── Individual cues ─────────────────────────────────────────────────── */

function powerup({ p, w, h, cam }) {
  const ring = powerupRing(p, w, h);
  if (!ring) return null;
  const c = screenToCanvas(cam, ring.x, ring.y, w, h);
  const r = ring.r / cam.scale;
  return {
    // The product exists only inside the ring…
    shade: { x: c.x, y: c.y, r, soft: ring.soft / cam.scale, alpha: 1 },
    // …and the ring's own edge is what lights it as it passes.
    rim: {
      x: c.x,
      y: c.y,
      r,
      width: lerp(18, 90, ring.t) / cam.scale,
      strength: 0.62 * (1 - ring.t),
    },
    lights: [],
  };
}

function focusZoom({ p, w, h, cam, film }) {
  const crown = COMPONENTS.crown;
  const c = film.artToCanvas(crown.u, crown.v);
  const partR = film.artLength(crown.r);
  const screen = canvasToScreen(cam, c.x, c.y, w, h);
  // The ring is wide and the head sits just beneath it, so the pool of
  // light is lifted a little above the ring's centre to keep the head out.
  const pool = film.artToCanvas(crown.u, crown.v - 0.022);
  const diag = Math.hypot(w, h);

  // Shadow closes in until only the crown ring is left in the light.
  const isolate = easeInOut(mapRange(p, 0.05, 0.24));
  const lighting =
    p < 0.4
      ? {
          shade: {
            x: pool.x,
            y: pool.y,
            r: lerp(diag, partR * 1.12, isolate),
            soft: lerp(diag * 0.4, partR * 0.62, isolate),
            alpha: 0.94 * mapRange(p, 0.03, 0.14),
          },
          rim: null,
          lights: [{ x: c.x, y: c.y, r: partR * 1.8, strength: 0.34 * isolate }],
        }
      : null;

  // Engineering marker: arrives once the part is isolated, leaves as the
  // camera commits to it.
  const markerOpacity = mapRange(p, 0.12, 0.2) * (1 - mapRange(p, 0.27, 0.32));
  const marker = markerOpacity > 0.002
    ? { x: screen.x, y: screen.y, r: partR * cam.scale, opacity: markerOpacity }
    : null;

  // The ring's circle becomes the wave that carries the viewer onward.
  const waveT = mapRange(p, 0.3, 0.46);
  const wave =
    waveT > 0 && waveT < 1
      ? {
          x: screen.x,
          y: screen.y,
          r: lerp(partR * cam.scale, diag * 0.75, waveT * waveT),
          alpha: 0.85 * mapRange(waveT, 0, 0.12) * (1 - waveT),
        }
      : null;

  return { lighting, wave, marker };
}

function spotlight({ film, stage }) {
  const spot = stage.hotspot;
  if (!spot.id || spot.amount < 0.004) return null;
  const part = COMPONENTS[spot.id];
  const c = film.artToCanvas(part.u, part.v);
  const r = film.artLength(part.r);
  const a = spot.amount;
  const f = spot.focus;
  return {
    // The rest of the assembly drops back but stays readable.
    shade: { x: c.x, y: c.y, r: r * lerp(1.5, 1.2, f), soft: r * lerp(2.6, 1.8, f), alpha: a * lerp(0.42, 0.66, f) },
    rim: null,
    lights: [{ x: c.x, y: c.y, r: r * 1.9, strength: a * lerp(0.3, 0.5, f) }],
  };
}

function reveal({ p, film }) {
  const head = film.artToCanvas(0.52, 0.31);
  const body = film.artToCanvas(0.5, 0.6);
  const artW = film.artLength(1);
  const diag = Math.hypot(film.w, film.h);

  const move = easeInOut(mapRange(p, 0.4, 0.66));
  const x = lerp(head.x, body.x, move);
  const y = lerp(head.y, body.y, move);

  // Darkness, then the head, then the body, then everything.
  let r = 0;
  if (p >= 0.66) r = lerp(artW * 0.33, diag, easeInOut(mapRange(p, 0.66, 0.88)));
  else if (p >= 0.4) r = lerp(artW * 0.13, artW * 0.33, move);
  else if (p >= 0.18) r = lerp(0, artW * 0.13, easeInOut(mapRange(p, 0.18, 0.4)));

  const dark = mapRange(p, 0, 0.14) * (1 - mapRange(p, 0.8, 0.9));
  if (dark < 0.004) return null;

  // The soft edge grows in with the light. A fixed minimum would punch a
  // small hole in the darkness before the light has started to travel.
  const soft = lerp(1, Math.max(40, r * 0.55), mapRange(p, 0.18, 0.24));

  return {
    // 0.93, not 1: the silhouette stays just readable in the dark.
    shade: { x, y, r, soft, alpha: 0.93 * dark },
    rim: {
      x,
      y,
      r,
      width: Math.max(24, r * 0.18),
      strength: 0.56 * mapRange(p, 0.18, 0.24) * (1 - mapRange(p, 0.8, 0.9)),
    },
    lights: [],
  };
}

/** A soft key light that leans towards the pointer but stays with the
    product, so it reads as a light being moved, not a torch. */
function studioLight({ w, h, cam, stage, studio }) {
  const ptr = stage.pointer;
  if (!ptr.fine || !ptr.inside || studio < 0.01) return null;
  const prod = stage.product;
  const reach = Math.min(w, h) * 0.55;
  const closeness = 1 - clamp(Math.hypot(ptr.ex - prod.x, ptr.ey - prod.y) / reach);
  const c = screenToCanvas(cam, lerp(prod.x, ptr.ex, 0.35), lerp(prod.y, ptr.ey, 0.35), w, h);
  return {
    x: c.x,
    y: c.y,
    r: (Math.min(w, h) * 0.42) / cam.scale,
    strength: studio * (0.1 + 0.1 * closeness),
  };
}

/* ── Assembly ────────────────────────────────────────────────────────── */

const q = (v) => Math.round(v);
const qa = (v) => Math.round(v * 200);

function keyOf({ shade, rim, lights }) {
  const parts = [];
  if (shade) parts.push('s', q(shade.x), q(shade.y), q(shade.r), q(shade.soft), qa(shade.alpha));
  if (rim) parts.push('r', q(rim.x), q(rim.y), q(rim.r), q(rim.width), qa(rim.strength));
  for (const l of lights) parts.push('l', q(l.x), q(l.y), q(l.r), qa(l.strength));
  return parts.join(',');
}

/**
 * @param {object} ctx  { cue, p, w, h, cam, film, stage, studio }
 * @returns {{ lighting: object|null, wave: object|null, marker: object|null }}
 */
function computeCues(ctx) {
  let base = null;
  let wave = null;
  let marker = null;

  switch (ctx.cue.cue) {
    case 'powerup': base = powerup(ctx); break;
    case 'spotlight': base = spotlight(ctx); break;
    case 'reveal': base = reveal(ctx); break;
    case 'focus': ({ lighting: base, wave, marker } = focusZoom(ctx)); break;
    default: break;
  }

  const key = studioLight(ctx);
  const lights = key ? [...(base?.lights ?? []), key] : base?.lights ?? [];
  const shade = base?.shade ?? null;
  const rim = base?.rim ?? null;

  if (!shade && !rim && lights.length === 0) return { lighting: null, wave, marker };

  const lighting = { shade, rim, lights };
  lighting.key = keyOf(lighting);
  return { lighting, wave, marker };
}

/* ── js/film/timeline.js ─────────────────────────────── */
/* The timeline — one continuous shot, choreographed as story beats.

   Each act declares, as piecewise stops over its own scroll progress:

     frames     which still is on screen. Flat segments are deliberate holds,
                which is what turns the disassembly into a staged engineering
                reveal instead of everything flying apart at once.
     opacity / brightness / scale
                the film itself.
     text       opacity of that act's typography.

   Optional channels:

     aim + pull a point in art space the camera travels towards, and how far
                (0 = the plain camera, so aiming eases in with no jump).
     cue        a named lighting moment, see film/cues.js.
     field      intensity of the ambient sound field around the product.
     studio     how much this moment invites the pointer-led key light.

   The rule the whole page obeys: product and text are never both fully
   present. One leads, the other recedes — through opacity and brightness.
   There is no blur: a live filter on the full-screen film cost an extra
   compositing pass every frame, and at the opacities where it was used
   (a backdrop at 12–30%) the 1.5px of defocus was not visible.

   The emotional arc the acts are ordered around:
     curiosity → discovery → energy → engineering → immersion → silence
     → reveal → desire */

const TIMELINE = [
  {
    id: 'hero',
    // CURIOSITY. Almost still. The opening should breathe, not move.
    frames:     [[0, 1], [1, 22]],
    opacity:    [[0, 1], [0.30, 1], [0.66, 0.5]],
    brightness: [[0, 1], [0.30, 1], [0.66, 0.78]],
    scale:      [[0, 1.05], [0.5, 1], [1, 1]],
    text:       [[0, 1], [1, 1]],
    field:      [[0, 0.3], [0.6, 0.18], [1, 0.12]],
    studio:     [[0, 0.8], [0.6, 0.3]],
  },
  {
    id: 'form',
    // DISCOVERY. Text leads. The product sits back and dims, but stays legible.
    frames:     [[0, 22], [1, 80]],
    opacity:    [[0, 0.5], [0.2, 0.3], [0.8, 0.3], [1, 0.55]],
    brightness: [[0, 0.8], [0.2, 0.62], [0.8, 0.62], [1, 0.8]],
    scale:      [[0, 1], [1, 1.015]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'energy',
    // ENERGY — the power-up. The product goes, a point of light remains,
    // it becomes waves, the waves collapse into one acoustic ring, and the
    // ring releases outward with the product formed inside it. The film is
    // invisible from 0.3 until the ring releases at 0.78, where it cuts in
    // behind a shade that only lets the inside of the ring through.
    frames:     [[0, 80], [0.3, 86], [0.78, 88], [1, 88]],
    opacity:    [[0, 0.55], [0.3, 0], [0.779, 0], [0.78, 1], [1, 1]],
    // Silhouette first, then lit.
    brightness: [[0, 0.8], [0.3, 0.6], [0.78, 0.18], [0.92, 0.7], [1, 1]],
    scale:      [[0, 1.015], [1, 1.04]],
    text:       [[0, 1], [0.52, 1], [0.64, 0], [1, 0]],
    cue:        'powerup',
  },
  {
    id: 'explode',
    // ENGINEERING. Staged disassembly with a settle at every stage, and the
    // typography pulled right back so the engineering can be read. Once the
    // assembly is fully open, its components can be put under the light.
    frames: [
      [0, 88], [0.17, 104], [0.19, 104],   // outer shell, settles
      [0.39, 124], [0.41, 124],            // structure, settles
      [0.61, 144], [0.63, 144],            // internals, settles
      [0.86, 168], [1, 176],               // full configuration
    ],
    opacity:    [[0, 1]],
    brightness: [[0, 1]],
    // Push in, then the camera stops entirely for the middle of the act.
    scale:      [[0, 1.04], [0.25, 1], [0.78, 1], [1, 0.99]],
    text:       [[0, 0.7], [0.14, 0.3], [0.9, 0.3], [1, 0.5]],
    cue:        'spotlight',
    field:      [[0, 0.5], [0.2, 0.75], [1, 0.7]],
    studio:     [[0, 0.8]],
  },
  {
    id: 'purpose',
    // Text leads again, one statement at a time — then hands straight back
    // to the product for the move into the crown ring.
    frames:     [[0, 176], [1, 214]],
    opacity:    [[0, 1], [0.16, 0.42], [0.84, 0.42], [1, 1]],
    brightness: [[0, 1], [0.16, 0.7], [0.84, 0.7], [1, 1]],
    scale:      [[0, 0.99], [0.84, 1.01], [1, 1.04]],
    text:       [[0, 0.5], [0.16, 1], [0.84, 1], [1, 0.35]],
    field:      [[0, 0.4], [1, 0.25]],
  },
  {
    id: 'system',
    // IMMERSION, by way of the one transition nobody expects. Shadow closes
    // in until only the crown ring remains; the camera travels into it; its
    // circle leaves as a wave; the wave clears the frame for the gallery.
    // The film is dark by the time the camera snaps back at 0.4.
    // Held through the zoom: at 2.4x, every small frame change would be
    // magnified into a visible pop. It resumes once the frame is dark.
    frames:     [[0, 214], [0.46, 214], [1, 232]],
    aim:        [0.5, 0.078],
    pull:       [[0, 0], [0.06, 0], [0.22, 0.8], [0.34, 1], [0.4, 1], [0.4, 0], [1, 0]],
    scale:      [[0, 1.04], [0.06, 1.04], [0.34, 2.4], [0.4, 2.4], [0.4, 1.06], [1, 1.05]],
    opacity:    [[0, 1], [0.3, 1], [0.38, 0], [0.46, 0], [0.56, 0.16], [1, 0.12]],
    brightness: [[0, 1], [0.4, 0.8], [0.56, 0.5], [1, 0.45]],
    text:       [[0, 0], [0.44, 0], [0.54, 1], [1, 1]],
    cue:        'focus',
  },
  {
    id: 'presence',
    frames:     [[0, 232], [1, 240]],
    opacity:    [[0, 0.1], [0.3, 0.28], [1, 0.3]],
    brightness: [[0, 0.5], [0.3, 0.7], [1, 0.7]],
    scale:      [[0, 1.05], [1, 1.02]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'visualizer',
    // Instrument moment. The dial and the line are the subject; the render
    // drops right back so both can be read. It goes fully dark at the end,
    // handing over to silence.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0.3], [0.25, 0.26], [0.8, 0.26], [1, 0]],
    brightness: [[0, 0.7], [0.25, 0.55], [0.8, 0.55], [1, 0.6]],
    scale:      [[0, 1.02], [1, 1.02]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'silence',
    // SILENCE. Nothing moves. The absence is the point. Its two lines are
    // paced by ui/beats.js, far slower than anything else on the page.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0]],
    brightness: [[0, 0.6]],
    scale:      [[0, 1.02]],
    text:       [[0, 1]],
  },
  {
    id: 'philosophy',
    // Text only. Near-empty black.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0], [0.3, 0.06], [0.8, 0.06], [1, 0.12]],
    brightness: [[0, 0.6], [1, 0.5]],
    scale:      [[0, 1.02], [1, 1.03]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'reassembly',
    // PRODUCT MOMENT. The disassembly run backwards with the same held
    // stages, ending on the assembled pose the reveal is built around.
    frames: [
      [0, 240], [0.19, 176], [0.21, 176],
      [0.43, 144], [0.45, 144],
      [0.67, 120], [0.69, 120],
      [1, 72],
    ],
    opacity:    [[0, 0.12], [0.15, 1], [1, 1]],
    brightness: [[0, 0.5], [0.15, 1], [1, 1]],
    // Settles and holds, then the faintest push at the end.
    scale:      [[0, 1.03], [0.35, 1], [0.82, 1], [1, 1.02]],
    text:       [[0, 0.8], [0.2, 0.28], [0.85, 0.28], [1, 0.6]],
    field:      [[0, 0], [0.2, 0.7], [1, 0.6]],
    studio:     [[0, 0.8]],
  },
  {
    id: 'reveal',
    // REVEAL. Everything goes dark, and a light travels the finished product
    // — head, then body, then everything — while the line arrives. The
    // headline recedes again once the product is fully lit.
    frames:     [[0, 72], [1, 68]],
    opacity:    [[0, 1]],
    brightness: [[0, 1], [0.14, 0.85], [1, 1]],
    scale:      [[0, 1.02], [0.14, 1], [1, 1.03]],
    text:       [[0, 0], [0.42, 0], [0.56, 1], [0.72, 1], [0.84, 0.55], [1, 0.55]],
    cue:        'reveal',
    field:      [[0, 0], [0.84, 0], [1, 0.5]],
    studio:     [[0, 0], [0.86, 0], [1, 0.8]],
  },
  {
    id: 'finale',
    // DESIRE. The hands close back over the face — the opening shot, in
    // reverse, as the last frame of the film.
    frames:     [[0, 68], [1, 1]],
    opacity:    [[0, 1], [0.3, 0.62], [1, 0.55]],
    brightness: [[0, 1], [0.3, 0.85], [1, 0.8]],
    scale:      [[0, 1.03], [1, 1.08]],
    text:       [[0, 0.6], [0.25, 1], [1, 1]],
    field:      [[0, 0.5], [1, 0.35]],
    studio:     [[0, 0.8], [0.3, 0.4]],
  },
];

const timelineFor = (id) => TIMELINE.find((t) => t.id === id);

/* ── js/fx/energy.js ─────────────────────────────── */
/* Act 03 — the power-up.

   The product is gone and a single point of charge is all that is left. It
   pulses, then pushes out waves. The waves collapse back onto one acoustic
   ring, and the ring releases outward — and the product is inside it,
   formed from the sound, lit by the ring's own edge as it passes (that
   lighting lives in film/cues.js; this layer draws the sound).

     0.00 – 0.30   the point of charge
     0.10 – 0.62   waves expand
     0.62 – 0.78   waves collapse onto one ring
     0.78 – 1.00   the ring releases

   Driven entirely by act progress, so it plays backwards as cleanly as
   forwards. */




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
    this.r0 = Math.min(w, h) * 0.09;

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

  #ring(cx, cy, r, alpha, width = 1.2) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200, 216, 255, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  render(_dt, now) {
    if (!this.on) return;

    const { ctx, w, h, r0 } = this;
    const p = this.progress;
    const cx = w * ORIGIN.x;
    const cy = h * ORIGIN.y;
    const t = now * 0.001;
    const still = prefersReducedMotion();

    ctx.clearRect(0, 0, w, h);

    const enter = mapRange(p, 0, 0.1);
    const collapse = easeInOut(mapRange(p, POWERUP.converge, POWERUP.reveal));

    // ── The point of charge ────────────────────────────────────────────
    // Holds until the waves have collapsed onto the ring, then it is spent.
    const pointAlpha = enter * (1 - mapRange(p, POWERUP.converge + 0.08, POWERUP.reveal));
    if (pointAlpha > 0.002) {
      const pulse = still ? 0.5 : Math.sin(t * 2.4) * 0.5 + 0.5;
      const coreR = (2.5 + pulse * 2.2) * (1 + Math.min(p, POWERUP.converge) * 1.5);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 26);
      glow.addColorStop(0, `rgba(190, 210, 255, ${0.9 * pointAlpha})`);
      glow.addColorStop(0.18, `rgba(110, 140, 255, ${0.38 * pointAlpha})`);
      glow.addColorStop(1, 'rgba(47, 85, 232, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - coreR * 26, cy - coreR * 26, coreR * 52, coreR * 52);
    }

    // ── Waves, then their collapse onto one ring ───────────────────────
    const wavesAlpha = enter * (1 - mapRange(p, POWERUP.reveal - 0.03, POWERUP.reveal));
    if (wavesAlpha > 0.002) {
      const spread = easeOut(mapRange(p, 0.1, POWERUP.converge));
      const drift = still ? 0 : (t * 0.08) % 1;
      for (let i = 0; i < RING_COUNT; i += 1) {
        const free = ((i / RING_COUNT + drift + spread) % 1) * this.max * (0.35 + spread * 0.8);
        const r = lerp(free, r0, collapse);
        if (r < 4) continue;
        const fade = lerp(1 - r / (this.max * 1.15), 0.9, collapse) * wavesAlpha;
        if (fade <= 0) continue;
        // A copper undertone on the outermost waves keeps it from going cold.
        const warm = mapRange(r, this.max * 0.5, this.max * 1.1) * (1 - collapse);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${110 + warm * 130}, ${140 - warm * 30}, ${255 - warm * 180}, ${fade * lerp(0.34, 0.22, collapse)})`;
        ctx.lineWidth = 1 + (1 - warm) * 0.6;
        ctx.stroke();
      }
      // The ring they collapse into, gaining definition as they arrive.
      if (collapse > 0) this.#ring(cx, cy, r0, 0.75 * collapse * wavesAlpha, 1.4);
    }

    // ── The ring releases ──────────────────────────────────────────────
    const ring = powerupRing(p, w, h);
    if (ring) {
      const fade = Math.pow(1 - ring.t, 1.2);
      this.#ring(ring.x, ring.y, ring.r, 0.75 * fade, 1.4);
      this.#ring(ring.x, ring.y, ring.r * 0.94, 0.25 * fade, 1);
    }

    // ── Particles ride the wavefront, and fall away before the collapse ─
    const dustAlpha = enter * (1 - mapRange(p, POWERUP.converge - 0.04, POWERUP.converge + 0.08));
    if (dustAlpha > 0.002) {
      const spread = easeOut(mapRange(p, 0.1, 0.92));
      ctx.fillStyle = 'rgb(200, 216, 255)';
      for (const particle of this.particles) {
        const r = ((particle.r + spread * particle.speed) % 1) * this.max;
        const fade = (1 - r / this.max) * dustAlpha;
        if (fade <= 0) continue;
        ctx.globalAlpha = fade * 0.3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(particle.a) * r, cy + Math.sin(particle.a) * r * 0.82, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
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
/* Bars around the dial at quality levels 0, 1, 2. */
const BAR_COUNTS = [84, 156, 156];
const TICKS = 84;

class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.progress = 0;
    this.on = false;

    this.pointer = { x: 0.5, y: 0.5 };
    this.eased = { x: 0.5, y: 0.5 };
    this.bars = BAR_COUNTS[2];
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
  }

  setProgress(p) {
    this.progress = clamp(p);
    const on = this.progress > 0.001 && this.progress < 0.999;
    if (on !== this.on) {
      this.on = on;
      this.canvas.classList.toggle('is-on', on);
    }
  }

  /** Reads the shared pointer once a frame. How far it travelled since the
      last frame is what charges the instrument. */
  #sense() {
    const p = stage.pointer;
    if (!p.inside) return;
    const nx = p.x / this.w;
    const ny = p.y / this.h;
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

    this.#sense();
    // The dial is this act's subject, so it keeps its detail at level 1 and
    // only thins out when the device is genuinely struggling.
    this.bars = this.w < 780 ? BAR_COUNTS[0] : BAR_COUNTS[quality.level];

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

/* ── js/fx/field.js ─────────────────────────────── */
/* The sound field — the invisible field the product gives off.

   Only ever a supporting layer. Three hairline rings leave the product and
   dissolve, and a little dust hangs in the air around it. The dust has
   depth: each mote lags behind the scroll by an amount set by how far back
   it sits, so the 2D frame reads as having space in front of and behind it.
   Hard ceilings keep it quiet — no ring above 7% opacity, no mote above 30%.

   Also carries the transition wave: the crown ring's circle travelling out
   across the frame at the start of Act 06.

   Drawn at 1x. Everything here is soft, and a full-screen layer that repaints
   every frame should cost as little as possible. When there is nothing to
   draw the layer is switched off entirely, so the compositor stops blending
   an empty full-screen canvas. Priority 4 in the quality governor: it thins
   out, then stops, before the film is ever touched. */



const RINGS = 3;
const DEPTH_BUCKETS = 3;

class SoundField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dirty = false;
    this.visible = false;
    this.inertia = 0;
    this.resize();
  }

  resize() {
    const { w, h } = sizeCanvas(this.canvas, this.ctx, 1);
    this.w = w;
    this.h = h;
    const count = w < 780 ? 16 : 36;
    this.motes = Array.from({ length: count }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.3 + Math.random() * 0.45,
      depth: 0.25 + Math.random() * 0.75,
      size: 0.6 + Math.random() * 0.9,
      // Very slow orbit, in both directions, so nothing reads as a swirl.
      spin: (Math.random() - 0.5) * 0.00006,
    }));
  }

  #clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  #show(on) {
    if (on === this.visible) return;
    this.visible = on;
    this.canvas.classList.toggle('is-on', on);
  }

  /**
   * @param {number} dt
   * @param {number} now
   * @param {{ intensity:number, x:number, y:number, scale:number, velocity:number,
   *           wave: { x:number, y:number, r:number, alpha:number } | null }} state
   */
  render(dt, now, { intensity, x, y, scale, velocity, wave }) {
    const ambient = prefersReducedMotion() || quality.level === 0 ? 0 : intensity;
    if (ambient < 0.005 && !wave) {
      if (this.dirty) {
        this.#clear();
        this.dirty = false;
      }
      this.#show(false);
      return;
    }
    this.#show(true);

    const { ctx, w, h } = this;
    this.#clear();
    this.dirty = true;

    if (ambient >= 0.005) {
      const t = now * 0.001;
      const m = Math.min(w, h) * scale;

      // ── Rings leaving the product ────────────────────────────────────
      ctx.lineWidth = 1;
      for (let i = 0; i < RINGS; i += 1) {
        const phase = (t * 0.075 + i / RINGS) % 1;
        const r = lerp(0.2, 0.72, phase) * m;
        const alpha = Math.sin(phase * Math.PI) * 0.07 * ambient;
        if (alpha < 0.003) continue;
        // A barely-there breathing of the ellipse — field, not geometry.
        const wobble = 1 + Math.sin(t * 0.6 + i * 2.1) * 0.015;
        ctx.beginPath();
        ctx.ellipse(x, y, r * wobble, r * 0.9, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150, 178, 255, ${alpha})`;
        ctx.stroke();
      }

      // ── Dust, with depth ─────────────────────────────────────────────
      // Motes trail the scroll and settle back: nearer ones trail further.
      this.inertia = lerp(this.inertia, clamp(-velocity * 6, -60, 60), damp(0.06, dt));
      const buckets = Array.from({ length: DEPTH_BUCKETS }, () => new Path2D());
      // Under pressure, every second mote.
      const stride = quality.level >= 2 ? 1 : 2;
      for (let i = 0; i < this.motes.length; i += stride) {
        const mote = this.motes[i];
        mote.a += mote.spin * dt;
        const mx = x + Math.cos(mote.a) * mote.r * m * 1.25;
        const my = y + Math.sin(mote.a) * mote.r * m * 0.8 + this.inertia * mote.depth;
        const size = mote.size * (0.6 + mote.depth * 0.6);
        const path = buckets[Math.min(DEPTH_BUCKETS - 1, Math.floor(mote.depth * DEPTH_BUCKETS))];
        path.moveTo(mx + size, my);
        path.arc(mx, my, size, 0, Math.PI * 2);
      }
      buckets.forEach((path, b) => {
        ctx.fillStyle = `rgba(200, 216, 255, ${0.3 * ambient * ((b + 1) / DEPTH_BUCKETS)})`;
        ctx.fill(path);
      });
    }

    // ── The transition wave ────────────────────────────────────────────
    if (wave && wave.alpha > 0.003) {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 216, 255, ${wave.alpha})`;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r * 0.93, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150, 178, 255, ${wave.alpha * 0.35})`;
      ctx.stroke();
    }
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
    // Just long enough for the count to read 100 — not a wait.
    await new Promise((r) => setTimeout(r, 120));
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
/* Custom cursor — fine pointers only, and deliberately small.

     default   a soft 6px dot with a quiet ring trailing it
     link      the ring opens a little over anything clickable
     focus     over a hotspot the ring tightens into a crosshair
     product   over the product in a studio moment, a faint halo of light
               follows — as if the pointer were carrying a small lamp

   The dot is drawn exactly where the pointer is, every frame, with no
   easing: a replacement cursor that lags behind the hand feels broken. Only
   the ring and the halo are allowed to trail. */



const INTERACTIVE = 'a, button, [data-magnetic], .card';

function initCursor(root) {
  if (!root || isCoarsePointer() || prefersReducedMotion()) return;

  document.documentElement.classList.add('has-cursor');

  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const halo = root.querySelector('.cursor__halo');

  const ringAt = { x: stage.pointer.x, y: stage.pointer.y };
  const haloAt = { ...ringAt };
  const last = { dot: '', ring: '', halo: '' };
  let hover = 'default';
  let shown = null;

  document.addEventListener('pointerover', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    hover = el?.closest('.hotspot') ? 'focus' : el?.closest(INTERACTIVE) ? 'link' : 'default';
  });

  // The individual `translate` property, not `transform`: each part also
  // takes a per-state CSS `scale`, and with transform the scale would
  // multiply the translation and pull the ring away from the pointer.
  const place = (node, key, x, y) => {
    const t = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    if (last[key] !== t) {
      last[key] = t;
      node.style.translate = t;
    }
  };

  onTick((dt) => {
    const p = stage.pointer;
    if (p.inside !== shown) {
      shown = p.inside;
      root.classList.toggle('is-on', shown);
    }
    if (!shown) return;

    ringAt.x = lerp(ringAt.x, p.x, damp(0.3, dt));
    ringAt.y = lerp(ringAt.y, p.y, damp(0.3, dt));
    haloAt.x = lerp(haloAt.x, p.x, damp(0.12, dt));
    haloAt.y = lerp(haloAt.y, p.y, damp(0.12, dt));

    place(dot, 'dot', p.x, p.y);
    place(ring, 'ring', ringAt.x, ringAt.y);
    place(halo, 'halo', haloAt.x, haloAt.y);

    // "Over the product" only means something while the product is the
    // subject and actually lit.
    const prod = stage.product;
    const reach = Math.min(innerWidth, innerHeight) * 0.34 * stage.camera.scale;
    const overProduct =
      prod.studio > 0.3 && prod.presence > 0.6 && Math.hypot(p.x - prod.x, p.y - prod.y) < reach;

    const state = hover !== 'default' ? hover : overProduct ? 'product' : 'default';
    if (root.dataset.state !== state) root.dataset.state = state;
  });
}

/* ── js/ui/magnetic.js ─────────────────────────────── */
/* Magnetic hover — elements lean towards the pointer within a radius.
   Subtle on purpose: a few pixels, never a jump.

   Geometry is read in the ticker's read phase, before anything in the
   frame has written styles, so measuring never forces a synchronous
   layout. It is re-read a few times a second, not every frame: these
   elements barely move. The pointer comes from the shared stage. */



const RADIUS = 90;
const PULL = 0.32;
const MEASURE_INTERVAL = 120;

function initMagnetic(nodes) {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const items = nodes.map((el) => ({ el, x: 0, y: 0, cx: 0, cy: 0, reach: 0, last: '' }));
  let lastMeasure = -Infinity;

  const measure = () => {
    for (const item of items) {
      const r = item.el.getBoundingClientRect();
      item.cx = r.left + r.width / 2;
      item.cy = r.top + r.height / 2;
      item.reach = RADIUS + Math.max(r.width, r.height) / 2;
    }
  };

  onResize(() => { lastMeasure = -Infinity; });

  onTick((dt, now) => {
    if (now - lastMeasure > MEASURE_INTERVAL) {
      lastMeasure = now;
      measure();
    }
  }, { phase: 'read' });

  onTick((dt) => {
    const p = stage.pointer;
    const k = damp(0.16, dt);
    for (const item of items) {
      const dx = p.x - item.cx;
      const dy = p.y - item.cy;
      const near = p.inside && Math.hypot(dx, dy) < item.reach;

      item.x = lerp(item.x, near ? dx * PULL : 0, k);
      item.y = lerp(item.y, near ? dy * PULL : 0, k);

      const settled = Math.abs(item.x) < 0.05 && Math.abs(item.y) < 0.05;
      const transform = settled ? '' : `translate3d(${item.x.toFixed(2)}px, ${item.y.toFixed(2)}px, 0)`;
      if (transform !== item.last) {
        item.last = transform;
        item.el.style.transform = transform;
      }
    }
  });
}

/* ── js/ui/reveal.js ─────────────────────────────── */
/* Reveals.

   Two kinds, deliberately:

     intro   the hero's opening lines. Played once, on a timeline, when the
             curtain lifts — there is no scroll yet to drive them, and the
             first seconds should play like a title sequence.
     scroll  everything else. A pure function of scroll position: no
             duration, no delay, no one-shot class. A line arrives as its
             act slides into view, is complete as the act pins, and plays
             backwards when scrolled back — always in step with the film,
             because it reads the same clock in the same frame.

   A scroll reveal writes one number, --reveal (0..1), on its element. CSS
   turns that into opacity and transform; words and staggered children
   offset it by their own index, so a whole line cascades from a single
   write per frame. */



/* Entry window, in viewport-heights relative to the act's pin point: from
   half a screen before it pins until it pins. */
const ENTRY_FROM = -0.5;
const ENTRY_TO = -0.02;
/* Each later reveal in the same act starts this much later. */
const SEQUENCE_STEP = 0.07;
/* data-reveal-at="p": starts at act progress p and takes this long. For
   lines that must wait for something inside a pinned act. */
const TIMED_SPAN = 0.08;

const SELECTOR = '[data-reveal], [data-reveal-words], [data-stagger]';

/**
 * Writes --reveal (0..1) on an element, only when it changed, and marks it
 * .is-revealing while it is part-way — the only time it is worth giving it
 * its own compositor layer. Shared with ui/beats.js.
 */
function createRevealWriter() {
  const last = new WeakMap();
  return (el, amount) => {
    const value = amount.toFixed(3);
    if (last.get(el) === value) return;
    last.set(el, value);
    el.style.setProperty('--reveal', value);
    el.classList.toggle('is-revealing', amount > 0.0005 && amount < 0.9995);
  };
}

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
  el.style.setProperty('--n', String(index));
}

function indexChildren(group) {
  const children = [...group.children];
  children.forEach((child, i) => child.style.setProperty('--i', String(i)));
  group.style.setProperty('--n', String(children.length));
}

function playIntro(nodes) {
  for (const el of nodes) {
    el.classList.add('is-intro');
    if (el.dataset.revealDelay) el.style.setProperty('--d', `${el.dataset.revealDelay}ms`);
  }
  // Next frame, so the starting state is committed before it transitions.
  requestAnimationFrame(() => nodes.forEach((el) => el.classList.add('is-in')));
}

function bindScroll(nodes) {
  const order = new Map();
  const items = [];

  for (const el of nodes) {
    const act = actById(el.closest('.act')?.dataset.act);
    if (!act) {
      el.style.setProperty('--reveal', '1');
      continue;
    }
    if (el.dataset.revealAt !== undefined) {
      const from = Number(el.dataset.revealAt);
      items.push({ el, act, from, to: from + TIMED_SPAN, onPin: true });
    } else {
      const k = order.get(act) ?? 0;
      order.set(act, k + 1);
      items.push({
        el,
        act,
        from: ENTRY_FROM + k * SEQUENCE_STEP,
        to: ENTRY_TO + k * SEQUENCE_STEP,
        onPin: false,
      });
    }
  }

  const write = createRevealWriter();
  onTick(() => {
    for (const item of items) {
      if (!item.act.active) continue;
      const at = item.onPin ? item.act.progress : item.act.local;
      write(item.el, mapRange(at, item.from, item.to));
    }
  });
}

function initReveal() {
  const nodes = [...document.querySelectorAll(SELECTOR)];
  nodes.filter((el) => el.hasAttribute('data-reveal-words')).forEach(splitWords);
  nodes.filter((el) => el.hasAttribute('data-stagger')).forEach(indexChildren);

  playIntro(nodes.filter((el) => el.closest('.act--hero')));
  bindScroll(nodes.filter((el) => !el.closest('.act--hero')));
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
    // The act opens on the crown-ring transition; the gallery only arrives
    // after it. Hold briefly at each end so cards are readable before and
    // after they travel.
    const p = easeInOut(clamp(mapRange(act.progress, 0.58, 0.94)));
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
/* Scroll beats — moments inside an act.

   All of these share one job: read the act's progress and write how far in
   each element is, as --reveal (0..1). No classes that trigger a timed CSS
   transition: a beat decided by scroll is animated by scroll, so it can
   never lag behind it or play on after the hand has stopped. */




/** Act 05 — the three statements, each arriving at its own moment. */
function initStatements(nodes) {
  const act = actById('purpose');
  if (!act) return;
  const cues = [0.16, 0.4, 0.64];
  const set = createRevealWriter();

  onTick(() => {
    if (!act.active) return;
    const p = act.progress;
    const leaving = 1 - mapRange(p, 0.9, 0.97);
    nodes.forEach((el, i) => set(el, mapRange(p, cues[i], cues[i] + 0.1) * leaving));
  });
}

/** Act 09 — the creed, one word at a time, extremely slowly. */
function initCreed(creed) {
  const act = actById('philosophy');
  if (!act || !creed) return;

  const words = [...creed.querySelectorAll('span')];
  const set = createRevealWriter();

  onTick(() => {
    if (!act.active) return;
    // Spread the words across the middle of the act, then hold. Each word
    // takes one word's worth of scroll to arrive.
    const reached = mapRange(act.progress, 0.12, 0.72) * words.length;
    words.forEach((word, i) => set(word, clamp(reached - i)));
  });
}

/** Silence — two small lines on black, paced slower than anything else on
    the page. Nothing else moves while they arrive. */
function initSilence(root) {
  const act = actById('silence');
  if (!act || !root) return;

  const listen = root.querySelector('.silence__listen');
  const wait = root.querySelector('.silence__wait');
  const last = { listen: '', wait: '' };

  const set = (el, key, amount) => {
    const value = `${amount.toFixed(3)}|${((1 - amount) * 10).toFixed(1)}`;
    if (last[key] === value) return;
    last[key] = value;
    el.style.opacity = amount.toFixed(3);
    el.style.transform = `translate3d(0, ${((1 - amount) * 10).toFixed(1)}px, 0)`;
  };

  onTick(() => {
    if (!act.active) return;
    const p = act.progress;
    const leaving = 1 - mapRange(p, 0.88, 1);
    set(listen, 'listen', mapRange(p, 0.1, 0.36) * leaving);
    set(wait, 'wait', mapRange(p, 0.48, 0.72) * leaving);
  });
}

function initBeats(refs) {
  initStatements(refs.statements);
  initCreed(refs.creed);
  initSilence(refs.silence);
}

/* ── js/ui/hotspots.js ─────────────────────────────── */
/* Act 04 — components you can put under the light.

   Four parts, no more. Hovering one brings it up into light and lets the
   rest of the assembly drop back (film/cues.js draws that); a hairline
   leader carries a small technical label out to the side. On the two parts
   that matter most, holding the hover — or a click / tap — goes one step
   further into focus mode: the light tightens, the camera leans in, and a
   line of supporting copy arrives. Leave, and everything settles back.

   Each hotspot is placed from its component's art-space position, through
   the live camera, every frame — so it stays on the part through the push
   and on every aspect ratio. */






/** Act progress over which the assembly is open enough to explore. */
const LIVE_FROM = 0.52;
const LIVE_TO = 0.96;
/** Hover time before a focusable part goes into focus mode. */
const HOLD_TO_FOCUS = 650;
/** Below this width the callout docks at the bottom of the frame instead
    of following the part. */
const NARROW = 860;

function initHotspots({ root, callout, film }) {
  const act = actById('explode');
  if (!act || !root || !callout) return;

  const spots = [...root.querySelectorAll('.hotspot')]
    .map((el) => ({ el, id: el.dataset.id, part: COMPONENTS[el.dataset.id], x: 0, y: 0, last: '' }))
    .filter((s) => s.part);

  const text = {
    kind: callout.querySelector('.callout__kind'),
    label: callout.querySelector('.callout__label'),
    note: callout.querySelector('.callout__note'),
    coords: callout.querySelector('.callout__coords'),
    focus: callout.querySelector('.callout__focus'),
  };

  const spot = stage.hotspot;
  let hovered = null;
  let pinned = null;
  let focusTarget = 0;
  let holdTimer = 0;
  let live = false;
  let layerOpacity = '';
  let calloutKey = '';

  const fill = (s) => {
    const { dataset } = s.el;
    text.kind.textContent = dataset.kind;
    text.label.textContent = dataset.label;
    text.note.textContent = dataset.note;
    text.coords.textContent = `U ${s.part.u.toFixed(3)} · V ${s.part.v.toFixed(3)}`;
    text.focus.textContent = dataset.focusNote ?? '';
    callout.classList.toggle('callout--left', dataset.side === 'left');
  };

  const enter = (s) => {
    hovered = s;
    fill(s);
    clearTimeout(holdTimer);
    if (s.el.dataset.focusNote) {
      holdTimer = setTimeout(() => { if (hovered === s) focusTarget = 1; }, HOLD_TO_FOCUS);
    }
  };

  const leave = (s) => {
    if (hovered === s) hovered = null;
    clearTimeout(holdTimer);
    if (!pinned) focusTarget = 0;
  };

  const release = () => {
    if (pinned) pinned.el.setAttribute('aria-pressed', 'false');
    pinned = null;
    focusTarget = 0;
  };

  for (const s of spots) {
    // Touch gets click only — a tap fires pointerenter too, and hover makes
    // no sense without a pointer that can rest.
    s.el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') enter(s); });
    s.el.addEventListener('pointerleave', () => leave(s));
    s.el.addEventListener('focus', () => enter(s));
    s.el.addEventListener('blur', () => leave(s));
    s.el.addEventListener('click', () => {
      if (pinned === s) return release();
      release();
      pinned = s;
      hovered = s;
      fill(s);
      focusTarget = s.el.dataset.focusNote ? 1 : 0;
      s.el.setAttribute('aria-pressed', 'true');
    });
  }

  addEventListener('keydown', (e) => { if (e.key === 'Escape') release(); });

  onTick((dt) => {
    // The layer fades with scroll, not on a timer, so it arrives and leaves
    // in step with the assembly opening and closing.
    const fade = act.active
      ? mapRange(act.progress, LIVE_FROM, LIVE_FROM + 0.04) * (1 - mapRange(act.progress, LIVE_TO - 0.04, LIVE_TO))
      : 0;
    const layer = fade.toFixed(3);
    if (layer !== layerOpacity) {
      layerOpacity = layer;
      root.style.opacity = layer;
    }

    const nowLive = fade > 0.5;
    if (nowLive !== live) {
      live = nowLive;
      root.classList.toggle('is-on', live);
      if (!live) {
        hovered = null;
        clearTimeout(holdTimer);
        release();
      }
    }

    // Ease the light up and down; focus mode moves slower than hover.
    const active = pinned ?? hovered;
    spot.amount = lerp(spot.amount, active ? 1 : 0, damp(0.1, dt));
    spot.focus = lerp(spot.focus, active ? focusTarget : 0, damp(0.06, dt));
    if (active) spot.id = active.id;
    else if (spot.amount < 0.01) {
      spot.id = null;
      spot.amount = 0;
      spot.focus = 0;
    }

    if (!act.active) return;

    // Keep every hotspot pinned to its part through the live camera.
    const cam = stage.camera;
    for (const s of spots) {
      const c = film.artToCanvas(s.part.u, s.part.v);
      const p = canvasToScreen(cam, c.x, c.y, film.w, film.h);
      s.x = p.x;
      s.y = p.y;
      const transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (transform !== s.last) {
        s.last = transform;
        s.el.style.transform = transform;
      }
    }

    // The callout rides with the part under the light.
    const target = spot.id ? spots.find((s) => s.id === spot.id) : null;
    const docked = innerWidth < NARROW;
    const transform = target && !docked ? `translate3d(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px, 0)` : '';
    const opacity = target ? spot.amount.toFixed(3) : '0';
    const focus = spot.focus.toFixed(3);
    const key = `${transform}|${opacity}|${focus}`;
    if (key !== calloutKey) {
      calloutKey = key;
      callout.style.transform = transform;
      callout.style.opacity = opacity;
      callout.style.setProperty('--focus', focus);
    }
  });
}

/* ── js/ui/markers.js ─────────────────────────────── */
/* Engineering marker — the crosshair, hairlines and figure label that
   annotate the crown ring as it is isolated at the start of Act 06.
   Positioned from film/cues.js; this only writes what changed. */

function initMarker(el) {
  if (!el) return () => {};
  let last = '';

  return (marker) => {
    const opacity = marker ? marker.opacity : 0;
    const key = marker
      ? `${opacity.toFixed(3)}|${Math.round(marker.x)}|${Math.round(marker.y)}|${Math.round(marker.r)}`
      : 'off';
    if (key === last) return;
    last = key;

    el.style.opacity = opacity.toFixed(3);
    if (!marker) return;
    el.style.transform = `translate3d(${marker.x.toFixed(1)}px, ${marker.y.toFixed(1)}px, 0)`;
    // Sized rather than scaled: scaling would thicken the 1px border with it.
    // It is one small absolutely-positioned box, live for a fraction of one
    // act, so the layout it costs is negligible.
    el.style.setProperty('--r', `${marker.r.toFixed(1)}px`);
  };
}

/* ── js/ui/kinetic.js ─────────────────────────────── */
/* Kinetic headlines.

   On the handful of lines that carry the story, a pool of emphasis travels
   across the words as the act plays — the word in the light at full, the
   words around it a little quieter — so the line reads as if it is being
   spoken rather than printed. Opacity only: the reveal owns the transform,
   and nothing here can reflow.

   data-kinetic="from,to" sets the stretch of act progress the emphasis
   travels over. Outside it, every word is at full strength. */



/** How far the words outside the light drop: 1 - DEPTH is the floor. */
const DEPTH = 0.42;
/** Width of the pool of light, in words. */
const SPREAD = 0.7;

function initKinetic() {
  if (prefersReducedMotion()) return;

  const lines = [...document.querySelectorAll('[data-kinetic]')]
    .map((el) => {
      const [from = 0.1, to = 0.85] = (el.dataset.kinetic || '').split(',').filter(Boolean).map(Number);
      return {
        act: actById(el.closest('.act')?.dataset.act),
        words: [...el.querySelectorAll('.word')],
        from,
        to,
        last: [],
      };
    })
    .filter((line) => line.act && line.words.length > 1);

  onTick(() => {
    for (const line of lines) {
      if (!line.act.active) continue;
      const p = line.act.progress;
      const engage = mapRange(p, line.from - 0.04, line.from + 0.04) * (1 - mapRange(p, line.to - 0.04, line.to + 0.04));
      const lead = mapRange(p, line.from, line.to) * (line.words.length - 1);

      line.words.forEach((word, i) => {
        const d = lead - i;
        const lit = Math.exp(-(d * d) / SPREAD);
        const opacity = (1 - engage * DEPTH * (1 - lit)).toFixed(2);
        if (line.last[i] !== opacity) {
          line.last[i] = opacity;
          word.style.opacity = opacity;
        }
      });
    }
  });
}

/* ── js/ui/ring.js ─────────────────────────────── */
/* Scroll progress, as a small instrument rather than a bar: a hairline
   ring around the ZILLOUT mark that closes as the film plays. It fades in
   with scroll as the opening hands over — the hero owns the frame first. */



function initRing(el, fill) {
  const hero = actById('hero');
  if (!el || !fill || !hero) return;

  let opacity = '';
  let offset = '';

  onTick(() => {
    const nextOpacity = mapRange(scroll.y, hero.top + hero.height * 0.7, hero.top + hero.height * 0.9).toFixed(3);
    if (nextOpacity !== opacity) {
      opacity = nextOpacity;
      el.style.opacity = nextOpacity;
    }
    // pathLength="1" on the circle, so the offset is simply what is left.
    const nextOffset = (1 - scroll.progress).toFixed(4);
    if (nextOffset !== offset) {
      offset = nextOffset;
      fill.style.strokeDashoffset = nextOffset;
    }
  });
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
   240-frame sequence; each act owns a stretch of that sequence, a camera, a
   visual treatment and, at the key moments, a lighting cue. Nothing else on
   the page has a background, so the film shows through from the first
   pixel to the last. */
























const TOTAL_FRAMES = 240;
/** Focus mode: how far the camera leans in, and towards, the part. */
const FOCUS_LEAN = 0.04;
const FOCUS_PULL = 0.12;
/** Where the product's body sits in the frame, in art space — the source
    of the sound field and the anchor of the studio light. */
const PRODUCT_CENTRE = [0.5, 0.48];

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
  // Scroll-driven content starts hidden only once JS is known to be running,
  // so the page never blanks out if the script fails.
  document.documentElement.classList.add('js');

  // Always open on frame one
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  initStage();
  initQuality();

  const filmEl = $('#film');
  const film = new FilmCanvas($('#film-canvas'));
  const energy = new EnergyField($('#fx-energy'));
  const visualizer = new Visualizer($('#fx-visualizer'));
  const field = new SoundField($('#fx-field'));

  const actNodes = $$('.act');
  initScroll();
  registerActs(actNodes, timelineFor);

  const energyAct = actById('energy');
  const visualAct = actById('visualizer');

  const loader = new FrameLoader({ total: TOTAL_FRAMES, step: frameStep() });
  const debug = initDebug(loader);
  const updateMarker = initMarker($('#marker'));

  // ── The film loop ────────────────────────────────────────────────────
  let lastFrame = -1;
  let drawnFrame = null;

  const written = new Map();
  const write = (prop, value) => {
    if (written.get(prop) === value) return;
    written.set(prop, value);
    filmEl.style.setProperty(prop, value);
  };

  onTick((dt, now) => {
    // Which act is the camera in? Same scroll value, same frame, as every
    // other scroll-linked thing on the page.
    let index = 0;
    for (let i = 0; i < acts.length; i += 1) {
      if (scroll.y >= acts[i].top) index = i;
    }
    const act = acts[index];
    const { cue } = act;
    if (!cue) return;

    const p = act.progress;
    const { w, h } = film;
    const spot = stage.hotspot;

    // ── Camera ──────────────────────────────────────────────────────────
    let scale = sampleStops(cue.scale, p);
    let tx = 0;
    let ty = 0;
    if (cue.aim) {
      const pull = cue.pull ? sampleStops(cue.pull, p) : 0;
      const a = film.artToCanvas(cue.aim[0], cue.aim[1]);
      ({ tx, ty } = aimTranslate(a.x, a.y, scale, pull, w, h));
    }
    if (spot.id && spot.focus > 0.001) {
      // Focus mode: the part cannot step forward in a flat render, so the
      // camera leans a few percent in towards it instead.
      const part = COMPONENTS[spot.id];
      const a = film.artToCanvas(part.u, part.v);
      scale *= 1 + FOCUS_LEAN * spot.focus;
      const lean = aimTranslate(a.x, a.y, scale, FOCUS_PULL * spot.focus, w, h);
      tx += lean.tx;
      ty += lean.ty;
    }
    const cam = stage.camera;
    cam.scale = scale;
    cam.tx = tx;
    cam.ty = ty;

    // ── The product on screen ───────────────────────────────────────────
    const opacity = sampleStops(cue.opacity, p);
    const bright = sampleStops(cue.brightness, p);
    const centre = film.artToCanvas(PRODUCT_CENTRE[0], PRODUCT_CENTRE[1]);
    const onScreen = canvasToScreen(cam, centre.x, centre.y, w, h);
    // Studio light is priority 4: only at full quality.
    const studio = cue.studio && quality.level >= 2 ? sampleStops(cue.studio, p) * (1 - 0.7 * spot.amount) : 0;
    Object.assign(stage.product, {
      x: onScreen.x,
      y: onScreen.y,
      presence: opacity * Math.min(1, bright),
      studio,
    });

    // ── Frame and light ─────────────────────────────────────────────────
    const rounded = Math.round(sampleStops(cue.frames, p, false));
    // Point background loading at where the scrub is, so the frames about
    // to be needed are the ones being fetched.
    loader.setPlayhead(rounded);
    const img = loader.nearest(rounded);
    if (rounded !== lastFrame) {
      lastFrame = rounded;
      drawnFrame = img ? Number(img.src.match(/(\d+)\.jpg$/)?.[1] ?? rounded) : null;
    }
    const { lighting, wave, marker } = computeCues({ cue, p, w, h, cam, film, stage, studio });
    // Brightness is baked into the draw rather than applied as a CSS filter.
    // Redraws only if the still, the lighting or the brightness changed.
    film.draw(img, lighting, bright);

    // Only touch the DOM when a value actually changed. Opacity and
    // transform are the only properties the compositor sees on this layer.
    write('--film-opacity', opacity.toFixed(3));
    write('--film-scale', scale.toFixed(4));
    write('--film-tx', `${tx.toFixed(1)}px`);
    write('--film-ty', `${ty.toFixed(1)}px`);

    // ── Atmosphere ──────────────────────────────────────────────────────
    const ambient = cue.field ? sampleStops(cue.field, p) * opacity * (1 - 0.5 * spot.amount) : 0;
    field.render(dt, now, {
      intensity: ambient,
      x: onScreen.x,
      y: onScreen.y,
      scale,
      velocity: scroll.velocity,
      wave,
    });
    updateMarker(marker);

    // ── The focus shift ─────────────────────────────────────────────────
    // Typography recedes while the product leads and returns as it steps
    // back. Every act on screen gets its *own* value — an act scrolling in
    // shows its opening state, not a default of full strength.
    for (const a of acts) {
      if (a.active !== a.live) {
        a.live = a.active;
        // Promote only acts on screen, so opacity animates on the
        // compositor without holding eleven full-viewport layers.
        a.sticky.classList.toggle('is-live', a.active);
      }
      if (!a.active || !a.cue) continue;
      const value = sampleStops(a.cue.text, a.progress).toFixed(3);
      if (value !== a.focus) {
        a.focus = value;
        a.sticky.style.setProperty('--text-focus', value);
      }
    }

    energy.setProgress(energyAct.progress);
    visualizer.setProgress(visualAct.progress);
    energy.render(dt, now);
    visualizer.render(dt, now);

    debug?.({ requested: rounded, drawn: drawnFrame, dt, now });
  });

  onResize(() => {
    film.resize();
    energy.resize();
    visualizer.resize();
    field.resize();
    measure();
    lastFrame = -1;
  });

  // ── Chrome that does not depend on the sequence ──────────────────────
  initNav($('#nav'), $$('.nav__links a'));
  initCursor($('#cursor'));
  initRail($('#rail'), $('#rail-track'));
  initParallax($$('.parallax__l'));
  initHotspots({ root: $('#hotspots'), callout: $('#callout'), film });
  initRing($('#ring'), $('#ring-fill'));
  initBeats({
    statements: $$('.statement'),
    creed: $('[data-creed]'),
    silence: $('[data-silence]'),
  });

  // ── Load, then let the film start ────────────────────────────────────
  const preloader = new Preloader($('#preloader'));

  loader.start((ratio) => preloader.set(ratio)).then(async () => {
    film.draw(loader.nearest(1));
    await preloader.done();
    // Reveals wait for the curtain, so the opening plays where it is seen.
    // Kinetic lines need the words the reveal splits out.
    initReveal();
    initKinetic();
    initMagnetic($$('[data-magnetic]'));
    measure();
  });
}

document.readyState === 'loading'
  ? addEventListener('DOMContentLoaded', boot, { once: true })
  : boot();

})();

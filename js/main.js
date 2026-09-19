/* ZILLOUT — entry point.

   The whole page is one continuous shot. A single fixed canvas plays a
   240-frame sequence; each act owns a stretch of that sequence, a camera, a
   visual treatment and, at the key moments, a lighting cue. Nothing else on
   the page has a background, so the film shows through from the first
   pixel to the last. */

import { onTick } from './core/ticker.js';
import { initScroll, registerActs, measure, acts, actById, scroll } from './core/scroll.js';
import { initStage, stage } from './core/stage.js';
import { initQuality, quality } from './core/quality.js';
import { onResize } from './core/utils.js';

import { FrameLoader } from './film/loader.js';
import { FilmCanvas } from './film/canvas.js';
import { timelineFor } from './film/timeline.js';
import { sampleStops } from './film/stops.js';
import { canvasToScreen, aimTranslate } from './film/camera.js';
import { computeCues, COMPONENTS } from './film/cues.js';

import { EnergyField } from './fx/energy.js';
import { Visualizer } from './fx/visualizer.js';
import { SoundField } from './fx/field.js';

import { Preloader } from './ui/preloader.js';
import { initNav } from './ui/nav.js';
import { initCursor } from './ui/cursor.js';
import { initMagnetic } from './ui/magnetic.js';
import { initReveal } from './ui/reveal.js';
import { initRail } from './ui/rail.js';
import { initParallax } from './ui/parallax.js';
import { initBeats } from './ui/beats.js';
import { initHotspots } from './ui/hotspots.js';
import { initMarker } from './ui/markers.js';
import { initKinetic } from './ui/kinetic.js';
import { initRing } from './ui/ring.js';
import { initDebug } from './ui/debug.js';

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

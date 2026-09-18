/* ZILLOUT — entry point.

   The whole page is one continuous shot. A single fixed canvas plays a
   240-frame sequence; each act owns a stretch of that sequence and a
   visual treatment. Nothing else on the page has a background, so the
   film shows through from the first pixel to the last. */

import { onTick } from './core/ticker.js';
import { initScroll, registerActs, measure, acts, actById, scroll } from './core/scroll.js';
import { onResize } from './core/utils.js';

import { FrameLoader } from './film/loader.js';
import { FilmCanvas } from './film/canvas.js';
import { timelineFor } from './film/timeline.js';
import { sampleStops } from './film/stops.js';

import { EnergyField } from './fx/energy.js';
import { Visualizer } from './fx/visualizer.js';

import { Preloader } from './ui/preloader.js';
import { initNav } from './ui/nav.js';
import { initCursor } from './ui/cursor.js';
import { initMagnetic } from './ui/magnetic.js';
import { initReveal } from './ui/reveal.js';
import { initRail } from './ui/rail.js';
import { initParallax } from './ui/parallax.js';
import { initBeats } from './ui/beats.js';
import { initDebug } from './ui/debug.js';

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

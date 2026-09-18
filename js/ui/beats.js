/* Scroll beats — things that switch on at a given point inside an act.

   All of these share one job: read an act's progress, toggle a state. */

import { onTick } from '../core/ticker.js';
import { actById, scroll } from '../core/scroll.js';
import { clamp, mapRange } from '../core/utils.js';

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

/** The chapter marker in the corner. */
function initChapterMarker(marker, label, actNodes) {
  const entries = actNodes
    .map((el) => ({ act: actById(el.dataset.act), text: el.dataset.chapter }))
    .filter((e) => e.act && e.text && e.text !== '—');

  onTick(() => {
    const current = entries.find((e) => e.act.active);
    if (!current) { marker.classList.remove('is-on'); return; }
    marker.classList.add('is-on');
    if (label.textContent !== current.text) label.textContent = current.text;
  });
}

/** The top progress bar. */
function initProgressBar(bar) {
  onTick(() => {
    bar.style.transform = `scaleX(${clamp(scroll.progress)})`;
  });
}

export function initBeats(refs) {
  initStatements(refs.statements);
  initExplodeOverlay(refs.hotspots, refs.ticker, refs.tickerText);
  initCreed(refs.creed);
  initChapterMarker(refs.chapter, refs.chapterLabel, refs.actNodes);
  initProgressBar(refs.progressBar);
}

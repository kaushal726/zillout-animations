/* Scroll beats — moments inside an act.

   All of these share one job: read the act's progress and write how far in
   each element is, as --reveal (0..1). No classes that trigger a timed CSS
   transition: a beat decided by scroll is animated by scroll, so it can
   never lag behind it or play on after the hand has stopped. */

import { onTick } from '../core/ticker.js';
import { actById } from '../core/scroll.js';
import { clamp, mapRange } from '../core/utils.js';
import { createRevealWriter } from './reveal.js';

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

export function initBeats(refs) {
  initStatements(refs.statements);
  initCreed(refs.creed);
  initSilence(refs.silence);
}

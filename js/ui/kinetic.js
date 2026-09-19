/* Kinetic headlines.

   On the handful of lines that carry the story, a pool of emphasis travels
   across the words as the act plays — the word in the light at full, the
   words around it a little quieter — so the line reads as if it is being
   spoken rather than printed. Opacity only: the reveal owns the transform,
   and nothing here can reflow.

   data-kinetic="from,to" sets the stretch of act progress the emphasis
   travels over. Outside it, every word is at full strength. */

import { onTick } from '../core/ticker.js';
import { actById } from '../core/scroll.js';
import { mapRange, prefersReducedMotion } from '../core/utils.js';

/** How far the words outside the light drop: 1 - DEPTH is the floor. */
const DEPTH = 0.42;
/** Width of the pool of light, in words. */
const SPREAD = 0.7;

export function initKinetic() {
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

/* Scroll progress, as a small instrument rather than a bar: a hairline
   ring around the ZILLOUT mark that closes as the film plays. It fades in
   with scroll as the opening hands over — the hero owns the frame first. */

import { onTick } from '../core/ticker.js';
import { actById, scroll } from '../core/scroll.js';
import { mapRange } from '../core/utils.js';

export function initRing(el, fill) {
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

/* Act 06 — the horizontal rail.

   Vertical scroll inside the pinned act drives the track sideways, so the
   gallery reads as a continuation of the same movement rather than a
   separate widget with its own scrollbar. */

import { onTick } from '../core/ticker.js';
import { actById } from '../core/scroll.js';
import { clamp, mapRange, easeInOut, onResize } from '../core/utils.js';

export function initRail(rail, track) {
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

/* Act 07 — depth. Layers travel at different rates through the pinned act. */

import { onTick } from '../core/ticker.js';
import { actById } from '../core/scroll.js';
import { prefersReducedMotion } from '../core/utils.js';

const RANGE = 420;

export function initParallax(layers) {
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

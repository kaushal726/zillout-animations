/* Magnetic hover — elements lean towards the pointer within a radius.
   Subtle on purpose: a few pixels, never a jump. */

import { onTick } from '../core/ticker.js';
import { lerp, damp, isCoarsePointer, prefersReducedMotion, onResize } from '../core/utils.js';

const RADIUS = 90;
const PULL = 0.32;
/* How often geometry is re-read. Reading layout in the animation loop
   forces a synchronous reflow, and doing it per element per frame was
   costing several forced layouts every single frame. These elements barely
   move, so measuring a few times a second is indistinguishable. */
const MEASURE_INTERVAL = 120;

export function initMagnetic(nodes) {
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

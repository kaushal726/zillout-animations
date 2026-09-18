/* Magnetic hover — elements lean towards the pointer within a radius.
   Subtle on purpose: a few pixels, never a jump. */

import { onTick } from '../core/ticker.js';
import { lerp, damp, isCoarsePointer, prefersReducedMotion } from '../core/utils.js';

const RADIUS = 90;
const PULL = 0.32;

export function initMagnetic(nodes) {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const items = nodes.map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
  const pointer = { x: -9999, y: -9999 };

  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });

  onTick((dt) => {
    const k = damp(0.16, dt);
    for (const item of items) {
      const r = item.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const near = Math.hypot(dx, dy) < RADIUS + Math.max(r.width, r.height) / 2;

      item.tx = near ? dx * PULL : 0;
      item.ty = near ? dy * PULL : 0;
      item.x = lerp(item.x, item.tx, k);
      item.y = lerp(item.y, item.ty, k);

      item.el.style.transform =
        Math.abs(item.x) < 0.05 && Math.abs(item.y) < 0.05
          ? ''
          : `translate3d(${item.x}px, ${item.y}px, 0)`;
    }
  });
}

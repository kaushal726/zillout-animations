/* Magnetic hover — elements lean towards the pointer within a radius.
   Subtle on purpose: a few pixels, never a jump.

   Geometry is read in the ticker's read phase, before anything in the
   frame has written styles, so measuring never forces a synchronous
   layout. It is re-read a few times a second, not every frame: these
   elements barely move. The pointer comes from the shared stage. */

import { onTick } from '../core/ticker.js';
import { stage } from '../core/stage.js';
import { lerp, damp, isCoarsePointer, prefersReducedMotion, onResize } from '../core/utils.js';

const RADIUS = 90;
const PULL = 0.32;
const MEASURE_INTERVAL = 120;

export function initMagnetic(nodes) {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const items = nodes.map((el) => ({ el, x: 0, y: 0, cx: 0, cy: 0, reach: 0, last: '' }));
  let lastMeasure = -Infinity;

  const measure = () => {
    for (const item of items) {
      const r = item.el.getBoundingClientRect();
      item.cx = r.left + r.width / 2;
      item.cy = r.top + r.height / 2;
      item.reach = RADIUS + Math.max(r.width, r.height) / 2;
    }
  };

  onResize(() => { lastMeasure = -Infinity; });

  onTick((dt, now) => {
    if (now - lastMeasure > MEASURE_INTERVAL) {
      lastMeasure = now;
      measure();
    }
  }, { phase: 'read' });

  onTick((dt) => {
    const p = stage.pointer;
    const k = damp(0.16, dt);
    for (const item of items) {
      const dx = p.x - item.cx;
      const dy = p.y - item.cy;
      const near = p.inside && Math.hypot(dx, dy) < item.reach;

      item.x = lerp(item.x, near ? dx * PULL : 0, k);
      item.y = lerp(item.y, near ? dy * PULL : 0, k);

      const settled = Math.abs(item.x) < 0.05 && Math.abs(item.y) < 0.05;
      const transform = settled ? '' : `translate3d(${item.x.toFixed(2)}px, ${item.y.toFixed(2)}px, 0)`;
      if (transform !== item.last) {
        item.last = transform;
        item.el.style.transform = transform;
      }
    }
  });
}

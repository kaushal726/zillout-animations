/* A soft light that trails the pointer. Pointer devices only. */

import { onTick } from '../core/ticker.js';
import { lerp, damp, isCoarsePointer, prefersReducedMotion } from '../core/utils.js';

export function initCursor(el) {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const eased = { ...target };

  addEventListener('pointermove', (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    el.classList.add('is-on');
  }, { passive: true });

  addEventListener('pointerleave', () => el.classList.remove('is-on'), { passive: true });

  onTick((dt) => {
    const k = damp(0.12, dt);
    eased.x = lerp(eased.x, target.x, k);
    eased.y = lerp(eased.y, target.y, k);
    el.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0)`;
  });
}

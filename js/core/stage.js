/* Shared per-frame state.

   Several systems need the same few facts — where the pointer is, where the
   camera is, where the product sits on screen, which component is under the
   light. They live here, each field with exactly one writer, instead of every
   module tracking its own copy and drifting out of step.

     pointer   written here
     camera    written by the film loop (main.js)
     product   written by the film loop
     hotspot   written by ui/hotspots.js */

import { onTick } from './ticker.js';
import { lerp, damp, isCoarsePointer } from './utils.js';

export const stage = {
  // x/y are raw; ex/ey are an eased copy, for anything that should drift
  // after the pointer rather than snap to it (light, halo).
  pointer: { x: 0, y: 0, ex: 0, ey: 0, inside: false, fine: false },
  camera: { scale: 1, tx: 0, ty: 0 },
  // Screen-space centre of the product, how visible it is (0..1), and how
  // much this moment invites studio light and the product halo (0..1).
  product: { x: 0, y: 0, presence: 0, studio: 0 },
  // The component under the light, how far the light has come up (amount),
  // and how far into focus mode it is (focus).
  hotspot: { id: null, amount: 0, focus: 0 },
};

export function initStage() {
  const p = stage.pointer;
  p.fine = !isCoarsePointer();
  p.x = p.ex = innerWidth / 2;
  p.y = p.ey = innerHeight / 2;

  addEventListener('pointermove', (e) => {
    p.x = e.clientX;
    p.y = e.clientY;
    p.inside = true;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { p.inside = false; });
  addEventListener('blur', () => { p.inside = false; });

  onTick((dt) => {
    const k = damp(0.07, dt);
    p.ex = lerp(p.ex, p.x, k);
    p.ey = lerp(p.ey, p.y, k);
  });
}

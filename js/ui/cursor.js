/* Custom cursor — fine pointers only, and deliberately small.

     default   a soft 6px dot with a quiet ring trailing it
     link      the ring opens a little over anything clickable
     focus     over a hotspot the ring tightens into a crosshair
     product   over the product in a studio moment, a faint halo of light
               follows — as if the pointer were carrying a small lamp

   The dot is drawn exactly where the pointer is, every frame, with no
   easing: a replacement cursor that lags behind the hand feels broken. Only
   the ring and the halo are allowed to trail. */

import { onTick } from '../core/ticker.js';
import { stage } from '../core/stage.js';
import { lerp, damp, isCoarsePointer, prefersReducedMotion } from '../core/utils.js';

const INTERACTIVE = 'a, button, [data-magnetic], .card';

export function initCursor(root) {
  if (!root || isCoarsePointer() || prefersReducedMotion()) return;

  document.documentElement.classList.add('has-cursor');

  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const halo = root.querySelector('.cursor__halo');

  const ringAt = { x: stage.pointer.x, y: stage.pointer.y };
  const haloAt = { ...ringAt };
  const last = { dot: '', ring: '', halo: '' };
  let hover = 'default';
  let shown = null;

  document.addEventListener('pointerover', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    hover = el?.closest('.hotspot') ? 'focus' : el?.closest(INTERACTIVE) ? 'link' : 'default';
  });

  // The individual `translate` property, not `transform`: each part also
  // takes a per-state CSS `scale`, and with transform the scale would
  // multiply the translation and pull the ring away from the pointer.
  const place = (node, key, x, y) => {
    const t = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    if (last[key] !== t) {
      last[key] = t;
      node.style.translate = t;
    }
  };

  onTick((dt) => {
    const p = stage.pointer;
    if (p.inside !== shown) {
      shown = p.inside;
      root.classList.toggle('is-on', shown);
    }
    if (!shown) return;

    ringAt.x = lerp(ringAt.x, p.x, damp(0.3, dt));
    ringAt.y = lerp(ringAt.y, p.y, damp(0.3, dt));
    haloAt.x = lerp(haloAt.x, p.x, damp(0.12, dt));
    haloAt.y = lerp(haloAt.y, p.y, damp(0.12, dt));

    place(dot, 'dot', p.x, p.y);
    place(ring, 'ring', ringAt.x, ringAt.y);
    place(halo, 'halo', haloAt.x, haloAt.y);

    // "Over the product" only means something while the product is the
    // subject and actually lit.
    const prod = stage.product;
    const reach = Math.min(innerWidth, innerHeight) * 0.34 * stage.camera.scale;
    const overProduct =
      prod.studio > 0.3 && prod.presence > 0.6 && Math.hypot(p.x - prod.x, p.y - prod.y) < reach;

    const state = hover !== 'default' ? hover : overProduct ? 'product' : 'default';
    if (root.dataset.state !== state) root.dataset.state = state;
  });
}

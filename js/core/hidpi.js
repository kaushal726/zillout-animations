/* Size a canvas to the device pixel ratio and return its CSS dimensions.
   Shared by the film canvas and both FX layers. */

import { clamp } from './utils.js';

export function sizeCanvas(canvas, ctx, maxDpr = 2) {
  const dpr = clamp(devicePixelRatio || 1, 1, maxDpr);
  const w = innerWidth;
  const h = innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

/* The film's three coordinate spaces.

     art     0..1 across the source still
     canvas  CSS pixels of the film canvas, before its CSS transform
     screen  viewport pixels, after the camera: scale about ORIGIN, then
             translate

   Anything that has to sit on a component — a hotspot, a light, a marker —
   is defined once in art space and mapped through here, so it stays locked
   to the render on every aspect ratio and through every camera move. */

import { lerp } from '../core/utils.js';

/** Must match `.film__canvas { transform-origin }`. */
export const ORIGIN = { x: 0.5, y: 0.46 };

export function canvasToScreen(cam, x, y, w, h) {
  const ox = w * ORIGIN.x;
  const oy = h * ORIGIN.y;
  return { x: ox + (x - ox) * cam.scale + cam.tx, y: oy + (y - oy) * cam.scale + cam.ty };
}

export function screenToCanvas(cam, x, y, w, h) {
  const ox = w * ORIGIN.x;
  const oy = h * ORIGIN.y;
  return { x: ox + (x - cam.tx - ox) / cam.scale, y: oy + (y - cam.ty - oy) / cam.scale };
}

/**
 * Translation that carries the canvas point (px, py) a fraction `pull` of
 * the way from where the plain scale would put it towards the centre of the
 * frame. pull = 0 is exactly the un-aimed camera, so aiming can ease in and
 * out with no jump.
 */
export function aimTranslate(px, py, scale, pull, w, h) {
  const landedX = w * ORIGIN.x + (px - w * ORIGIN.x) * scale;
  const landedY = h * ORIGIN.y + (py - h * ORIGIN.y) * scale;
  return {
    tx: lerp(landedX, w * 0.5, pull) - landedX,
    ty: lerp(landedY, h * 0.5, pull) - landedY,
  };
}

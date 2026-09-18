/* Piecewise keyframes.

   A stop is [progress, value]. Sampling eases between neighbouring stops,
   so two stops sharing a value create a genuine hold — the pause that makes
   a disassembly read as mechanical rather than as an explosion, and the
   stillness that makes the camera feel like it is mounted on something
   heavy. */

import { clamp, lerp, easeInOut } from '../core/utils.js';

/**
 * @param {[number, number][]} stops ascending by progress
 * @param {number} p 0..1
 * @param {boolean} ease ease within each segment (default) or move linearly
 *
 * Frame indices must pass ease=false. An eased segment flattens at both
 * ends, and once the result is rounded to a whole frame that flat part
 * becomes a visible dwell — a pause at *every* keyframe rather than only
 * where one was intended. Linear keeps scroll-to-frame constant, so the
 * only pauses are the ones written as explicit flat segments.
 */
export function sampleStops(stops, p, ease = true) {
  if (p <= stops[0][0]) return stops[0][1];

  for (let i = 1; i < stops.length; i += 1) {
    const [p1, v1] = stops[i];
    if (p > p1) continue;
    const [p0, v0] = stops[i - 1];
    const span = p1 - p0;
    if (span <= 0) return v1;
    const t = clamp((p - p0) / span);
    return lerp(v0, v1, ease ? easeInOut(t) : t);
  }
  return stops[stops.length - 1][1];
}

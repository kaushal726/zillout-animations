/* Small pure helpers. No DOM, no state. */

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalise v from [inMin,inMax] into [outMin,outMax], clamped at both ends. */
export function mapRange(v, inMin, inMax, outMin = 0, outMax = 1) {
  if (inMax === inMin) return outMin;
  const t = clamp((v - inMin) / (inMax - inMin));
  return outMin + (outMax - outMin) * t;
}

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Frame-rate independent lerp factor, so motion feels the same at 60 and 120Hz. */
export const damp = (factor, dt) => 1 - Math.pow(1 - factor, dt / 16.667);

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reducedQuery.matches;

const coarseQuery = matchMedia('(pointer: coarse)');
export const isCoarsePointer = () => coarseQuery.matches;

export const onResize = (fn, wait = 150) => {
  let t;
  const run = () => { clearTimeout(t); t = setTimeout(fn, wait); };
  addEventListener('resize', run, { passive: true });
  addEventListener('orientationchange', run, { passive: true });
  return run;
};

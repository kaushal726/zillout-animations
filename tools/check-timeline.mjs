globalThis.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
const BASE = new URL('../js/film/', import.meta.url).href;
const { TIMELINE } = await import(BASE + 'timeline.js');
const { sampleStops } = await import(BASE + 'stops.js');

const SAMPLES = 200;
let maxBlur = 0, maxBlurAt = '';
const clashes = [];
const rows = [];

for (const act of TIMELINE) {
  let minText = 1, maxText = 0, minProd = 1, maxProd = 0, frames = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = i / SAMPLES;
    const o = sampleStops(act.opacity, p);
    const t = sampleStops(act.text, p);
    const b = sampleStops(act.blur, p);
    const f = sampleStops(act.frames, p, false);
    frames.push(f);
    if (b > maxBlur) { maxBlur = b; maxBlurAt = `${act.id}@${p.toFixed(2)}`; }
    // The invariant: never both fully present at once.
    if (o > 0.75 && t > 0.75 && act.id !== 'hero' && act.id !== 'finale') {
      clashes.push(`${act.id}@${p.toFixed(2)} product=${o.toFixed(2)} text=${t.toFixed(2)}`);
    }
    minText = Math.min(minText, t); maxText = Math.max(maxText, t);
    minProd = Math.min(minProd, o); maxProd = Math.max(maxProd, o);
  }
  // Frame monotonicity within each act (no jitter back and forth)
  let reversals = 0;
  const dir = Math.sign(frames[frames.length - 1] - frames[0]);
  for (let i = 1; i < frames.length; i++) {
    const d = Math.sign(frames[i] - frames[i - 1]);
    if (d !== 0 && dir !== 0 && d !== dir) reversals++;
  }
  const holds = frames.filter((f, i) => i > 0 && Math.abs(f - frames[i-1]) < 0.01).length;
  rows.push({
    act: act.id,
    product: `${minProd.toFixed(2)}–${maxProd.toFixed(2)}`,
    text: `${minText.toFixed(2)}–${maxText.toFixed(2)}`,
    frames: `${frames[0].toFixed(0)}→${frames.at(-1).toFixed(0)}`,
    holdPct: `${Math.round(holds / SAMPLES * 100)}%`,
    reversals,
  });
}

console.table(rows);
console.log(`\nmax blur: ${maxBlur.toFixed(2)}px  (${maxBlurAt})   [cap 1.5px]`);
console.log(`hierarchy clashes (product>0.75 AND text>0.75): ${clashes.length ? clashes.slice(0,5).join(', ') : 'none'}`);

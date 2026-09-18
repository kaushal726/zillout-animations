globalThis.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
const B = new URL('../js/film/', import.meta.url).href;
const { TIMELINE } = await import(B+'timeline.js');
const { sampleStops } = await import(B+'stops.js');
const VH = 900;
const HEIGHTS = { hero:150, form:210, energy:140, explode:320, purpose:210, system:280,
                  presence:200, visualizer:200, philosophy:180, reassembly:300, finale:170 };
const rows = TIMELINE.map(act => {
  const span = Math.max(1, HEIGHTS[act.id]/100*VH - VH);
  let changes = 0, prev = null, maxRun = 0, run = 0, peakOpacity = 0;
  for (let px = 0; px <= span; px++) {
    const p = px/span;
    const f = Math.round(sampleStops(act.frames, p, false));
    peakOpacity = Math.max(peakOpacity, sampleStops(act.opacity, p));
    if (f !== prev) { if (prev!==null) changes++; maxRun = Math.max(maxRun, run); run = 0; }
    else run++;
    prev = f;
  }
  return { act: act.id, spanPx: Math.round(span), frameChanges: changes,
    pxPerFrame: changes ? +(span/changes).toFixed(1) : '—',
    longestHoldPx: maxRun, peakOpacity: +peakOpacity.toFixed(2) };
});
console.table(rows);
const visible = rows.filter(r => r.peakOpacity >= 0.5 && r.frameChanges > 0);
console.log('\nVisible-film acts, px of scroll per frame change:');
visible.forEach(r => console.log(`  ${r.act.padEnd(12)} ${String(r.pxPerFrame).padStart(6)} px/frame   longest hold ${r.longestHoldPx}px`));

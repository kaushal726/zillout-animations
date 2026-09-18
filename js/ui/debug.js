/* Frame-timing probe. Off unless the URL carries ?debug.

   Measures the things that actually make a sequence feel like a slideshow:

     stall     longest gap between animation frames (micro-freezes)
     jump      largest frame-index step between two draws
     fallback  draws that showed a neighbouring frame because the exact
               one was not decoded yet — the real cause of 20 → 24 → 24
     decoded   how much of the sequence is ready to draw with no hitch

   A healthy run: stall under ~32ms, jump in single digits at normal scroll
   speed, fallback at or near 0 once loading settles. */

export function initDebug(loader) {
  if (!/[?&]debug/.test(location.search)) return null;

  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed', 'left:12px', 'bottom:12px', 'z-index:200',
    'font:11px/1.5 ui-monospace,SF Mono,Menlo,monospace',
    'color:#9fb4ff', 'background:rgba(3,3,3,.82)', 'border:1px solid rgba(255,255,255,.12)',
    'border-radius:8px', 'padding:8px 10px', 'white-space:pre', 'pointer-events:none',
    'backdrop-filter:blur(8px)',
  ].join(';');
  document.body.appendChild(box);

  let frames = 0;
  let fps = 0;
  let windowStart = performance.now();
  let maxStall = 0;
  let maxJump = 0;
  let fallbacks = 0;
  let draws = 0;
  let lastDrawn = null;

  // Rolling reset so a single early hiccup does not poison the readout.
  const RESET_AFTER = 4000;
  let lastReset = performance.now();

  return function report({ requested, drawn, dt, now }) {
    frames += 1;
    if (dt > maxStall) maxStall = dt;

    if (drawn !== null && drawn !== lastDrawn) {
      draws += 1;
      if (lastDrawn !== null) {
        const jump = Math.abs(drawn - lastDrawn);
        if (jump > maxJump) maxJump = jump;
      }
      if (drawn !== requested) fallbacks += 1;
      lastDrawn = drawn;
    }

    if (now - windowStart >= 500) {
      fps = Math.round((frames * 1000) / (now - windowStart));
      frames = 0;
      windowStart = now;

      const s = loader.stats();
      box.textContent = [
        `fps       ${fps}`,
        `frame     ${requested}  (drawn ${drawn ?? '—'})`,
        `stall     ${maxStall.toFixed(1)}ms`,
        `max jump  ${maxJump}`,
        `fallback  ${fallbacks}/${draws}`,
        `decoded   ${s.decoded}/${s.total}   loaded ${s.loaded}/${s.total}`,
      ].join('\n');
    }

    if (now - lastReset > RESET_AFTER) {
      lastReset = now;
      maxStall = 0;
      maxJump = 0;
      fallbacks = 0;
      draws = 0;
    }
  };
}

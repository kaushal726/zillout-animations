/* One requestAnimationFrame loop for the whole page.

   Every animated system subscribes here rather than starting its own, and
   each frame runs in two phases:

     read    anything that measures — scroll position, element geometry.
             Runs first, while layout is still clean from the last frame.
     write   everything else: compute, then touch the DOM and canvases.

   Reading layout after something has written styles in the same frame
   forces the browser to recalculate style and layout synchronously, on the
   spot. Keeping all reads ahead of all writes means that never happens. */

const readers = new Set();
const writers = new Set();
let running = false;
let last = 0;

function run(set, dt, now) {
  for (const fn of set) {
    try {
      fn(dt, now);
    } catch (error) {
      // One bad subscriber must not take the whole page's motion with it:
      // without this, a single throw stops the loop permanently.
      console.error('[zillout] ticker subscriber failed, dropping it:', error);
      set.delete(fn);
    }
  }
}

function frame(now) {
  const dt = Math.min(64, now - last); // cap after a tab-switch stall
  last = now;

  run(readers, dt, now);
  run(writers, dt, now);

  if (readers.size + writers.size > 0) requestAnimationFrame(frame);
  else running = false;
}

/**
 * Subscribe to the shared loop. Returns an unsubscribe function.
 * @param {(dt:number, now:number) => void} fn
 * @param {{ phase?: 'read' | 'write' }} [options]
 */
export function onTick(fn, { phase = 'write' } = {}) {
  const set = phase === 'read' ? readers : writers;
  set.add(fn);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  return () => set.delete(fn);
}

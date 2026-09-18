/* One requestAnimationFrame loop for the whole page.
   Every animated system subscribes here rather than starting its own. */

const subscribers = new Set();
let running = false;
let last = 0;

function frame(now) {
  const dt = Math.min(64, now - last); // cap after a tab-switch stall
  last = now;

  for (const fn of subscribers) {
    try {
      fn(dt, now);
    } catch (error) {
      // One bad subscriber must not take the whole page's motion with it:
      // without this, a single throw stops the loop permanently and every
      // scroll-driven animation freezes at once.
      console.error('[zillout] ticker subscriber failed, dropping it:', error);
      subscribers.delete(fn);
    }
  }

  if (subscribers.size > 0) requestAnimationFrame(frame);
  else running = false;
}

/** Subscribe to the shared loop. Returns an unsubscribe function. */
export function onTick(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  return () => subscribers.delete(fn);
}

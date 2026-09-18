/* Scroll state.

   Native scrolling is left completely intact — we never transform <body>.
   Instead we keep a *smoothed* scroll value that every animation reads from.
   That is what gives the film its weight without breaking trackpads,
   scrollbars, keyboard paging or mobile momentum. */

import { onTick } from './ticker.js';
import { clamp, damp, lerp, prefersReducedMotion, onResize } from './utils.js';

/* The sticky layout follows the raw scroll position while the film follows
   this eased one. Too much easing and the two visibly disagree, which reads
   as the page lagging behind the wheel rather than as weight. */
const SMOOTHING = 0.2;

export const scroll = {
  y: 0,          // raw scrollY
  smooth: 0,     // eased scrollY — drives all animation
  progress: 0,   // 0..1 over the whole document
  velocity: 0,   // px/frame, signed
  vh: 0,
  vw: 0,
};

/** @type {{id:string, el:HTMLElement, top:number, span:number, progress:number, active:boolean}[]} */
export const acts = [];

let maxScroll = 1;

export function registerActs(nodes) {
  acts.length = 0;
  nodes.forEach((el) => {
    acts.push({
      id: el.dataset.act,
      el,
      sticky: el.firstElementChild,
      top: 0,
      height: 1,
      span: 1,
      progress: 0,
      active: false,
    });
  });
  measure();
}

/** Cache layout. Called on load and on resize only — never per frame. */
export function measure() {
  scroll.vh = innerHeight;
  scroll.vw = innerWidth;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - scroll.vh);

  for (const act of acts) {
    // Every layout read happens here and nowhere else. Reading geometry
    // from inside the animation loop forces a synchronous reflow on each
    // access, and there is one of these per act per frame to get wrong.
    act.top = act.el.offsetTop;
    act.height = act.el.offsetHeight;
    // While an act's sticky child is pinned, the act travels (height - vh).
    act.span = Math.max(1, act.height - scroll.vh);
  }
}

let lastRawY = 0;
let snapNext = false;

/** A jump this large in one frame is never a scroll gesture — it is an
    anchor link, a restored position or a programmatic scroll. Following it
    with the easing would send the film sliding through half the sequence. */
function isDiscontinuous(y) {
  return Math.abs(y - lastRawY) > scroll.vh * 1.5;
}

function update(dt) {
  const previous = scroll.smooth;
  scroll.y = window.scrollY || window.pageYOffset || 0;

  // A throttled tab (backgrounded, or low-power) runs this loop at a few
  // frames a second, so the easing would take seconds to catch up and the
  // film would visibly slide on return. Snap instead.
  if (snapNext || isDiscontinuous(scroll.y) || prefersReducedMotion()) {
    scroll.smooth = scroll.y;
    snapNext = false;
  } else {
    scroll.smooth = lerp(scroll.smooth, scroll.y, damp(SMOOTHING, dt));
  }
  lastRawY = scroll.y;

  // Settle exactly, so nothing drifts by a fraction of a pixel forever
  if (Math.abs(scroll.smooth - scroll.y) < 0.08) scroll.smooth = scroll.y;

  scroll.velocity = scroll.smooth - previous;
  scroll.progress = clamp(scroll.smooth / maxScroll);

  for (const act of acts) {
    act.progress = clamp((scroll.smooth - act.top) / act.span);
    act.active = scroll.smooth >= act.top - scroll.vh && scroll.smooth < act.top + act.height;
  }
}

export function initScroll() {
  scroll.y = scroll.smooth = lastRawY = window.scrollY || 0;
  measure();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) snapNext = true;
  });
  onResize(measure);
  // Late relayout: web fonts and the first frames both change nothing
  // structurally, but images decoding can, so re-measure once settled.
  addEventListener('load', () => setTimeout(measure, 120));
  onTick(update);
}

export const actById = (id) => acts.find((a) => a.id === id);

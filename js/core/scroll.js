/* Scroll state — the single clock the whole film runs on.

   Native scrolling is left completely intact; nothing transforms <body>.
   The position is sampled exactly once per frame, in the ticker's read
   phase, and every scroll-linked visual on the page — the film, its
   lighting, text focus, reveals, hotspots, parallax, the progress ring —
   is computed from that one number in that same frame.

   There is deliberately no easing here. The sticky layout is moved by the
   browser from the real scroll position; an eased copy driving the film
   made the product trail the text by several frames and finish moving on
   its own after the hand had stopped. Smoothness comes from the browser's
   own scrolling (trackpad momentum, animated wheel scrolling), and every
   layer follows the same value, so they can never disagree. */

import { onTick } from './ticker.js';
import { clamp, onResize } from './utils.js';

export const scroll = {
  y: 0,          // scrollY, sampled once per frame
  progress: 0,   // 0..1 over the whole document
  velocity: 0,   // px/frame, signed
  vh: 0,
  vw: 0,
};

/**
 * @type {{
 *   id:string, el:HTMLElement, sticky:HTMLElement, cue:object|null,
 *   top:number, height:number, span:number,
 *   progress:number,  // 0..1 while the act is pinned
 *   local:number,     // viewport-heights from the pin point: -1 → 0 while
 *                     // scrolling in, then 0 → span/vh while pinned
 *   active:boolean,   // any part of the act is on screen
 * }[]}
 */
export const acts = [];

let maxScroll = 1;

export function registerActs(nodes, cueFor) {
  acts.length = 0;
  for (const el of nodes) {
    acts.push({
      id: el.dataset.act,
      el,
      sticky: el.firstElementChild,
      cue: cueFor ? cueFor(el.dataset.act) ?? null : null,
      top: 0,
      height: 1,
      span: 1,
      progress: 0,
      local: -1,
      active: false,
    });
  }
  measure();
}

/** Cache layout. Called on load and on resize only — never per frame. */
export function measure() {
  scroll.vh = innerHeight;
  scroll.vw = innerWidth;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - scroll.vh);
  for (const act of acts) {
    act.top = act.el.offsetTop;
    act.height = act.el.offsetHeight;
    // While an act's sticky child is pinned, the act travels (height - vh).
    act.span = Math.max(1, act.height - scroll.vh);
  }
}

function sample() {
  const y = window.scrollY || window.pageYOffset || 0;
  scroll.velocity = y - scroll.y;
  scroll.y = y;
  scroll.progress = clamp(y / maxScroll);

  for (const act of acts) {
    act.progress = clamp((y - act.top) / act.span);
    act.local = (y - act.top) / scroll.vh;
    act.active = y >= act.top - scroll.vh && y < act.top + act.height;
  }
}

export function initScroll() {
  scroll.y = window.scrollY || 0;
  measure();
  onResize(measure);
  // Fonts and images can shift layout after first paint; re-measure once.
  addEventListener('load', () => setTimeout(measure, 120));
  onTick(sample, { phase: 'read' });
}

export const actById = (id) => acts.find((a) => a.id === id);

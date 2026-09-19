/* Reveals.

   Two kinds, deliberately:

     intro   the hero's opening lines. Played once, on a timeline, when the
             curtain lifts — there is no scroll yet to drive them, and the
             first seconds should play like a title sequence.
     scroll  everything else. A pure function of scroll position: no
             duration, no delay, no one-shot class. A line arrives as its
             act slides into view, is complete as the act pins, and plays
             backwards when scrolled back — always in step with the film,
             because it reads the same clock in the same frame.

   A scroll reveal writes one number, --reveal (0..1), on its element. CSS
   turns that into opacity and transform; words and staggered children
   offset it by their own index, so a whole line cascades from a single
   write per frame. */

import { onTick } from '../core/ticker.js';
import { actById } from '../core/scroll.js';
import { mapRange } from '../core/utils.js';

/* Entry window, in viewport-heights relative to the act's pin point: from
   half a screen before it pins until it pins. */
const ENTRY_FROM = -0.5;
const ENTRY_TO = -0.02;
/* Each later reveal in the same act starts this much later. */
const SEQUENCE_STEP = 0.07;
/* data-reveal-at="p": starts at act progress p and takes this long. For
   lines that must wait for something inside a pinned act. */
const TIMED_SPAN = 0.08;

const SELECTOR = '[data-reveal], [data-reveal-words], [data-stagger]';

/**
 * Writes --reveal (0..1) on an element, only when it changed, and marks it
 * .is-revealing while it is part-way — the only time it is worth giving it
 * its own compositor layer. Shared with ui/beats.js.
 */
export function createRevealWriter() {
  const last = new WeakMap();
  return (el, amount) => {
    const value = amount.toFixed(3);
    if (last.get(el) === value) return;
    last.set(el, value);
    el.style.setProperty('--reveal', value);
    el.classList.toggle('is-revealing', amount > 0.0005 && amount < 0.9995);
  };
}

/** Wrap each word in a mask, leaving <br> and other elements untouched. */
function splitWords(el) {
  const original = [...el.childNodes];
  el.textContent = '';
  let index = 0;

  for (const node of original) {
    if (node.nodeType !== Node.TEXT_NODE) {
      el.appendChild(node);
      continue;
    }
    for (const part of node.textContent.split(/(\s+)/)) {
      if (part === '') continue;
      if (!part.trim()) {
        el.appendChild(document.createTextNode(part));
        continue;
      }
      const mask = document.createElement('span');
      mask.className = 'word';
      const inner = document.createElement('span');
      inner.className = 'word__in';
      inner.textContent = part;
      inner.style.setProperty('--i', String(index));
      index += 1;
      mask.appendChild(inner);
      el.appendChild(mask);
    }
  }
  el.style.setProperty('--n', String(index));
}

function indexChildren(group) {
  const children = [...group.children];
  children.forEach((child, i) => child.style.setProperty('--i', String(i)));
  group.style.setProperty('--n', String(children.length));
}

function playIntro(nodes) {
  for (const el of nodes) {
    el.classList.add('is-intro');
    if (el.dataset.revealDelay) el.style.setProperty('--d', `${el.dataset.revealDelay}ms`);
  }
  // Next frame, so the starting state is committed before it transitions.
  requestAnimationFrame(() => nodes.forEach((el) => el.classList.add('is-in')));
}

function bindScroll(nodes) {
  const order = new Map();
  const items = [];

  for (const el of nodes) {
    const act = actById(el.closest('.act')?.dataset.act);
    if (!act) {
      el.style.setProperty('--reveal', '1');
      continue;
    }
    if (el.dataset.revealAt !== undefined) {
      const from = Number(el.dataset.revealAt);
      items.push({ el, act, from, to: from + TIMED_SPAN, onPin: true });
    } else {
      const k = order.get(act) ?? 0;
      order.set(act, k + 1);
      items.push({
        el,
        act,
        from: ENTRY_FROM + k * SEQUENCE_STEP,
        to: ENTRY_TO + k * SEQUENCE_STEP,
        onPin: false,
      });
    }
  }

  const write = createRevealWriter();
  onTick(() => {
    for (const item of items) {
      if (!item.act.active) continue;
      const at = item.onPin ? item.act.progress : item.act.local;
      write(item.el, mapRange(at, item.from, item.to));
    }
  });
}

export function initReveal() {
  const nodes = [...document.querySelectorAll(SELECTOR)];
  nodes.filter((el) => el.hasAttribute('data-reveal-words')).forEach(splitWords);
  nodes.filter((el) => el.hasAttribute('data-stagger')).forEach(indexChildren);

  playIntro(nodes.filter((el) => el.closest('.act--hero')));
  bindScroll(nodes.filter((el) => !el.closest('.act--hero')));
}

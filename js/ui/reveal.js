/* Text and block reveals.

   Words ride up out of their own clip mask, staggered. Everything is
   triggered once, by IntersectionObserver, so reveals never re-fire and
   never fight the scroll. */

const WORD_MARGIN = '0px 0px -12% 0px';

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
}

function applyDelay(el) {
  const delay = el.dataset.revealDelay;
  if (delay) el.style.setProperty('--d', `${delay}ms`);
}

export function initReveal() {
  const words = [...document.querySelectorAll('[data-reveal-words]')];
  words.forEach((el) => {
    splitWords(el);
    applyDelay(el);
  });

  const plain = [...document.querySelectorAll('[data-reveal]')];
  plain.forEach(applyDelay);

  const groups = [...document.querySelectorAll('[data-stagger]')];
  groups.forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty('--i', String(i)));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: WORD_MARGIN, threshold: 0.1 }
  );

  [...words, ...plain, ...groups].forEach((el) => observer.observe(el));
}

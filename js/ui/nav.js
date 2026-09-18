/* Navigation — invisible at rest, earns a surface once you leave the hero,
   and hides itself while you scroll down so the film stays unobstructed. */

import { onTick } from '../core/ticker.js';
import { scroll } from '../core/scroll.js';

const STICK_AT = 80;

export function initNav(nav, links) {
  const toggle = nav.querySelector('#nav-toggle');
  let hidden = false;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('.nav__links a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );

  onTick(() => {
    nav.classList.toggle('is-stuck', scroll.y > STICK_AT);

    // Only hide on a deliberate downward scroll, never near the top
    const shouldHide =
      !nav.classList.contains('is-open') && scroll.velocity > 1.4 && scroll.y > scroll.vh * 0.9;
    const shouldShow = scroll.velocity < -0.6 || scroll.y < STICK_AT;

    if (shouldHide && !hidden) { hidden = true; nav.classList.add('is-hidden'); }
    else if (shouldShow && hidden) { hidden = false; nav.classList.remove('is-hidden'); }
  });

  // Highlight the section you are actually in
  const targets = links
    .map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((t) => t.el);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const match = targets.find((t) => t.el === entry.target);
        if (match) match.a.classList.toggle('is-active', entry.isIntersecting);
      });
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  targets.forEach((t) => io.observe(t.el));
}

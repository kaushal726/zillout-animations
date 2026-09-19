/* Act 04 — components you can put under the light.

   Four parts, no more. Hovering one brings it up into light and lets the
   rest of the assembly drop back (film/cues.js draws that); a hairline
   leader carries a small technical label out to the side. On the two parts
   that matter most, holding the hover — or a click / tap — goes one step
   further into focus mode: the light tightens, the camera leans in, and a
   line of supporting copy arrives. Leave, and everything settles back.

   Each hotspot is placed from its component's art-space position, through
   the live camera, every frame — so it stays on the part through the push
   and on every aspect ratio. */

import { onTick } from '../core/ticker.js';
import { actById } from '../core/scroll.js';
import { stage } from '../core/stage.js';
import { lerp, damp, mapRange } from '../core/utils.js';
import { COMPONENTS } from '../film/cues.js';
import { canvasToScreen } from '../film/camera.js';

/** Act progress over which the assembly is open enough to explore. */
const LIVE_FROM = 0.52;
const LIVE_TO = 0.96;
/** Hover time before a focusable part goes into focus mode. */
const HOLD_TO_FOCUS = 650;
/** Below this width the callout docks at the bottom of the frame instead
    of following the part. */
const NARROW = 860;

export function initHotspots({ root, callout, film }) {
  const act = actById('explode');
  if (!act || !root || !callout) return;

  const spots = [...root.querySelectorAll('.hotspot')]
    .map((el) => ({ el, id: el.dataset.id, part: COMPONENTS[el.dataset.id], x: 0, y: 0, last: '' }))
    .filter((s) => s.part);

  const text = {
    kind: callout.querySelector('.callout__kind'),
    label: callout.querySelector('.callout__label'),
    note: callout.querySelector('.callout__note'),
    coords: callout.querySelector('.callout__coords'),
    focus: callout.querySelector('.callout__focus'),
  };

  const spot = stage.hotspot;
  let hovered = null;
  let pinned = null;
  let focusTarget = 0;
  let holdTimer = 0;
  let live = false;
  let layerOpacity = '';
  let calloutKey = '';

  const fill = (s) => {
    const { dataset } = s.el;
    text.kind.textContent = dataset.kind;
    text.label.textContent = dataset.label;
    text.note.textContent = dataset.note;
    text.coords.textContent = `U ${s.part.u.toFixed(3)} · V ${s.part.v.toFixed(3)}`;
    text.focus.textContent = dataset.focusNote ?? '';
    callout.classList.toggle('callout--left', dataset.side === 'left');
  };

  const enter = (s) => {
    hovered = s;
    fill(s);
    clearTimeout(holdTimer);
    if (s.el.dataset.focusNote) {
      holdTimer = setTimeout(() => { if (hovered === s) focusTarget = 1; }, HOLD_TO_FOCUS);
    }
  };

  const leave = (s) => {
    if (hovered === s) hovered = null;
    clearTimeout(holdTimer);
    if (!pinned) focusTarget = 0;
  };

  const release = () => {
    if (pinned) pinned.el.setAttribute('aria-pressed', 'false');
    pinned = null;
    focusTarget = 0;
  };

  for (const s of spots) {
    // Touch gets click only — a tap fires pointerenter too, and hover makes
    // no sense without a pointer that can rest.
    s.el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') enter(s); });
    s.el.addEventListener('pointerleave', () => leave(s));
    s.el.addEventListener('focus', () => enter(s));
    s.el.addEventListener('blur', () => leave(s));
    s.el.addEventListener('click', () => {
      if (pinned === s) return release();
      release();
      pinned = s;
      hovered = s;
      fill(s);
      focusTarget = s.el.dataset.focusNote ? 1 : 0;
      s.el.setAttribute('aria-pressed', 'true');
    });
  }

  addEventListener('keydown', (e) => { if (e.key === 'Escape') release(); });

  onTick((dt) => {
    // The layer fades with scroll, not on a timer, so it arrives and leaves
    // in step with the assembly opening and closing.
    const fade = act.active
      ? mapRange(act.progress, LIVE_FROM, LIVE_FROM + 0.04) * (1 - mapRange(act.progress, LIVE_TO - 0.04, LIVE_TO))
      : 0;
    const layer = fade.toFixed(3);
    if (layer !== layerOpacity) {
      layerOpacity = layer;
      root.style.opacity = layer;
    }

    const nowLive = fade > 0.5;
    if (nowLive !== live) {
      live = nowLive;
      root.classList.toggle('is-on', live);
      if (!live) {
        hovered = null;
        clearTimeout(holdTimer);
        release();
      }
    }

    // Ease the light up and down; focus mode moves slower than hover.
    const active = pinned ?? hovered;
    spot.amount = lerp(spot.amount, active ? 1 : 0, damp(0.1, dt));
    spot.focus = lerp(spot.focus, active ? focusTarget : 0, damp(0.06, dt));
    if (active) spot.id = active.id;
    else if (spot.amount < 0.01) {
      spot.id = null;
      spot.amount = 0;
      spot.focus = 0;
    }

    if (!act.active) return;

    // Keep every hotspot pinned to its part through the live camera.
    const cam = stage.camera;
    for (const s of spots) {
      const c = film.artToCanvas(s.part.u, s.part.v);
      const p = canvasToScreen(cam, c.x, c.y, film.w, film.h);
      s.x = p.x;
      s.y = p.y;
      const transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (transform !== s.last) {
        s.last = transform;
        s.el.style.transform = transform;
      }
    }

    // The callout rides with the part under the light.
    const target = spot.id ? spots.find((s) => s.id === spot.id) : null;
    const docked = innerWidth < NARROW;
    const transform = target && !docked ? `translate3d(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px, 0)` : '';
    const opacity = target ? spot.amount.toFixed(3) : '0';
    const focus = spot.focus.toFixed(3);
    const key = `${transform}|${opacity}|${focus}`;
    if (key !== calloutKey) {
      calloutKey = key;
      callout.style.transform = transform;
      callout.style.opacity = opacity;
      callout.style.setProperty('--focus', focus);
    }
  });
}

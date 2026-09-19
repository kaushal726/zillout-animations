/* Cinematic cues — where the light falls, and the transition wave.

   Every cue is a pure function of act progress (plus the pointer, for the
   studio light), so each one scrubs backwards exactly as it plays forwards.
   None of them redraws or moves a component: the film is still the original
   render. They only decide where the light goes.

     powerup    Act 03. A converged acoustic ring releases outward, and the
                product is revealed inside it, lit by its passing edge.
     focus      Act 06 opening. Shadow closes in until only the crown ring
                is left, the camera travels to it, and its circle leaves as a
                wave that carries into the gallery.
     spotlight  Act 04. A hovered component comes up into light while the
                rest of the assembly drops back.
     reveal     Act 12. The finished product in darkness, uncovered by a
                light that travels head, then body, then everything.
     studio     A soft key light that leans towards the pointer, only in
                moments where the product is the subject.                    */

import { clamp, lerp, mapRange, easeInOut } from '../core/utils.js';
import { canvasToScreen, screenToCanvas, ORIGIN } from './camera.js';

/* Components that can be put under the light, in art space. Measured on the
   fully exploded frames (176–214), where they barely move. r is the radius
   of the part in art-width units. */
export const COMPONENTS = {
  crown: { u: 0.5, v: 0.078, r: 0.07 },
  power: { u: 0.5, v: 0.665, r: 0.068 },
  control: { u: 0.71, v: 0.333, r: 0.045 },
  plating: { u: 0.262, v: 0.655, r: 0.066 },
};

/* ── Power-up geometry, shared with the energy field that draws the ring ── */

export const POWERUP = { converge: 0.62, reveal: 0.78 };

/** The acoustic ring at the end of Act 03, in screen space. null before it
    releases. */
export function powerupRing(p, w, h) {
  if (p < POWERUP.reveal) return null;
  const t = mapRange(p, POWERUP.reveal, 1);
  const eased = t * t; // accelerates outward, like a released wave
  const cx = w * ORIGIN.x;
  const cy = h * ORIGIN.y;
  const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 1.04;
  return {
    x: cx,
    y: cy,
    t,
    r: lerp(Math.min(w, h) * 0.09, far, eased),
    soft: lerp(12, 240, eased),
  };
}

/* ── Individual cues ─────────────────────────────────────────────────── */

function powerup({ p, w, h, cam }) {
  const ring = powerupRing(p, w, h);
  if (!ring) return null;
  const c = screenToCanvas(cam, ring.x, ring.y, w, h);
  const r = ring.r / cam.scale;
  return {
    // The product exists only inside the ring…
    shade: { x: c.x, y: c.y, r, soft: ring.soft / cam.scale, alpha: 1 },
    // …and the ring's own edge is what lights it as it passes.
    rim: {
      x: c.x,
      y: c.y,
      r,
      width: lerp(18, 90, ring.t) / cam.scale,
      strength: 0.62 * (1 - ring.t),
    },
    lights: [],
  };
}

function focusZoom({ p, w, h, cam, film }) {
  const crown = COMPONENTS.crown;
  const c = film.artToCanvas(crown.u, crown.v);
  const partR = film.artLength(crown.r);
  const screen = canvasToScreen(cam, c.x, c.y, w, h);
  // The ring is wide and the head sits just beneath it, so the pool of
  // light is lifted a little above the ring's centre to keep the head out.
  const pool = film.artToCanvas(crown.u, crown.v - 0.022);
  const diag = Math.hypot(w, h);

  // Shadow closes in until only the crown ring is left in the light.
  const isolate = easeInOut(mapRange(p, 0.05, 0.24));
  const lighting =
    p < 0.4
      ? {
          shade: {
            x: pool.x,
            y: pool.y,
            r: lerp(diag, partR * 1.12, isolate),
            soft: lerp(diag * 0.4, partR * 0.62, isolate),
            alpha: 0.94 * mapRange(p, 0.03, 0.14),
          },
          rim: null,
          lights: [{ x: c.x, y: c.y, r: partR * 1.8, strength: 0.34 * isolate }],
        }
      : null;

  // Engineering marker: arrives once the part is isolated, leaves as the
  // camera commits to it.
  const markerOpacity = mapRange(p, 0.12, 0.2) * (1 - mapRange(p, 0.27, 0.32));
  const marker = markerOpacity > 0.002
    ? { x: screen.x, y: screen.y, r: partR * cam.scale, opacity: markerOpacity }
    : null;

  // The ring's circle becomes the wave that carries the viewer onward.
  const waveT = mapRange(p, 0.3, 0.46);
  const wave =
    waveT > 0 && waveT < 1
      ? {
          x: screen.x,
          y: screen.y,
          r: lerp(partR * cam.scale, diag * 0.75, waveT * waveT),
          alpha: 0.85 * mapRange(waveT, 0, 0.12) * (1 - waveT),
        }
      : null;

  return { lighting, wave, marker };
}

function spotlight({ film, stage }) {
  const spot = stage.hotspot;
  if (!spot.id || spot.amount < 0.004) return null;
  const part = COMPONENTS[spot.id];
  const c = film.artToCanvas(part.u, part.v);
  const r = film.artLength(part.r);
  const a = spot.amount;
  const f = spot.focus;
  return {
    // The rest of the assembly drops back but stays readable.
    shade: { x: c.x, y: c.y, r: r * lerp(1.5, 1.2, f), soft: r * lerp(2.6, 1.8, f), alpha: a * lerp(0.42, 0.66, f) },
    rim: null,
    lights: [{ x: c.x, y: c.y, r: r * 1.9, strength: a * lerp(0.3, 0.5, f) }],
  };
}

function reveal({ p, film }) {
  const head = film.artToCanvas(0.52, 0.31);
  const body = film.artToCanvas(0.5, 0.6);
  const artW = film.artLength(1);
  const diag = Math.hypot(film.w, film.h);

  const move = easeInOut(mapRange(p, 0.4, 0.66));
  const x = lerp(head.x, body.x, move);
  const y = lerp(head.y, body.y, move);

  // Darkness, then the head, then the body, then everything.
  let r = 0;
  if (p >= 0.66) r = lerp(artW * 0.33, diag, easeInOut(mapRange(p, 0.66, 0.88)));
  else if (p >= 0.4) r = lerp(artW * 0.13, artW * 0.33, move);
  else if (p >= 0.18) r = lerp(0, artW * 0.13, easeInOut(mapRange(p, 0.18, 0.4)));

  const dark = mapRange(p, 0, 0.14) * (1 - mapRange(p, 0.8, 0.9));
  if (dark < 0.004) return null;

  // The soft edge grows in with the light. A fixed minimum would punch a
  // small hole in the darkness before the light has started to travel.
  const soft = lerp(1, Math.max(40, r * 0.55), mapRange(p, 0.18, 0.24));

  return {
    // 0.93, not 1: the silhouette stays just readable in the dark.
    shade: { x, y, r, soft, alpha: 0.93 * dark },
    rim: {
      x,
      y,
      r,
      width: Math.max(24, r * 0.18),
      strength: 0.56 * mapRange(p, 0.18, 0.24) * (1 - mapRange(p, 0.8, 0.9)),
    },
    lights: [],
  };
}

/** A soft key light that leans towards the pointer but stays with the
    product, so it reads as a light being moved, not a torch. */
function studioLight({ w, h, cam, stage, studio }) {
  const ptr = stage.pointer;
  if (!ptr.fine || !ptr.inside || studio < 0.01) return null;
  const prod = stage.product;
  const reach = Math.min(w, h) * 0.55;
  const closeness = 1 - clamp(Math.hypot(ptr.ex - prod.x, ptr.ey - prod.y) / reach);
  const c = screenToCanvas(cam, lerp(prod.x, ptr.ex, 0.35), lerp(prod.y, ptr.ey, 0.35), w, h);
  return {
    x: c.x,
    y: c.y,
    r: (Math.min(w, h) * 0.42) / cam.scale,
    strength: studio * (0.1 + 0.1 * closeness),
  };
}

/* ── Assembly ────────────────────────────────────────────────────────── */

const q = (v) => Math.round(v);
const qa = (v) => Math.round(v * 200);

function keyOf({ shade, rim, lights }) {
  const parts = [];
  if (shade) parts.push('s', q(shade.x), q(shade.y), q(shade.r), q(shade.soft), qa(shade.alpha));
  if (rim) parts.push('r', q(rim.x), q(rim.y), q(rim.r), q(rim.width), qa(rim.strength));
  for (const l of lights) parts.push('l', q(l.x), q(l.y), q(l.r), qa(l.strength));
  return parts.join(',');
}

/**
 * @param {object} ctx  { cue, p, w, h, cam, film, stage, studio }
 * @returns {{ lighting: object|null, wave: object|null, marker: object|null }}
 */
export function computeCues(ctx) {
  let base = null;
  let wave = null;
  let marker = null;

  switch (ctx.cue.cue) {
    case 'powerup': base = powerup(ctx); break;
    case 'spotlight': base = spotlight(ctx); break;
    case 'reveal': base = reveal(ctx); break;
    case 'focus': ({ lighting: base, wave, marker } = focusZoom(ctx)); break;
    default: break;
  }

  const key = studioLight(ctx);
  const lights = key ? [...(base?.lights ?? []), key] : base?.lights ?? [];
  const shade = base?.shade ?? null;
  const rim = base?.rim ?? null;

  if (!shade && !rim && lights.length === 0) return { lighting: null, wave, marker };

  const lighting = { shade, rim, lights };
  lighting.key = keyOf(lighting);
  return { lighting, wave, marker };
}

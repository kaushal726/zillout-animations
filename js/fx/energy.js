/* Act 03 — the power-up.

   The product is gone and a single point of charge is all that is left. It
   pulses, then pushes out waves. The waves collapse back onto one acoustic
   ring, and the ring releases outward — and the product is inside it,
   formed from the sound, lit by the ring's own edge as it passes (that
   lighting lives in film/cues.js; this layer draws the sound).

     0.00 – 0.30   the point of charge
     0.10 – 0.62   waves expand
     0.62 – 0.78   waves collapse onto one ring
     0.78 – 1.00   the ring releases

   Driven entirely by act progress, so it plays backwards as cleanly as
   forwards. */

import { sizeCanvas } from '../core/hidpi.js';
import { clamp, lerp, mapRange, easeOut, easeInOut, prefersReducedMotion } from '../core/utils.js';
import { POWERUP, powerupRing } from '../film/cues.js';
import { ORIGIN } from '../film/camera.js';

const RING_COUNT = 7;

export class EnergyField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.progress = 0;
    this.on = false;
    this.particles = [];
    this.resize();
  }

  resize() {
    // 1.5x is indistinguishable from full retina for thin strokes,
    // and clears less than half the pixels each frame.
    const { w, h } = sizeCanvas(this.canvas, this.ctx, 1.5);
    this.w = w;
    this.h = h;
    this.max = Math.hypot(w, h) * 0.5;
    this.r0 = Math.min(w, h) * 0.09;

    const count = w < 780 ? 26 : 54;
    this.particles = Array.from({ length: count }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random(),
      speed: 0.12 + Math.random() * 0.4,
      size: 0.6 + Math.random() * 1.5,
    }));
  }

  setProgress(p) {
    this.progress = clamp(p);
    const on = this.progress > 0.001 && this.progress < 0.999;
    if (on !== this.on) {
      this.on = on;
      this.canvas.classList.toggle('is-on', on);
    }
  }

  #ring(cx, cy, r, alpha, width = 1.2) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200, 216, 255, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  render(_dt, now) {
    if (!this.on) return;

    const { ctx, w, h, r0 } = this;
    const p = this.progress;
    const cx = w * ORIGIN.x;
    const cy = h * ORIGIN.y;
    const t = now * 0.001;
    const still = prefersReducedMotion();

    ctx.clearRect(0, 0, w, h);

    const enter = mapRange(p, 0, 0.1);
    const collapse = easeInOut(mapRange(p, POWERUP.converge, POWERUP.reveal));

    // ── The point of charge ────────────────────────────────────────────
    // Holds until the waves have collapsed onto the ring, then it is spent.
    const pointAlpha = enter * (1 - mapRange(p, POWERUP.converge + 0.08, POWERUP.reveal));
    if (pointAlpha > 0.002) {
      const pulse = still ? 0.5 : Math.sin(t * 2.4) * 0.5 + 0.5;
      const coreR = (2.5 + pulse * 2.2) * (1 + Math.min(p, POWERUP.converge) * 1.5);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 26);
      glow.addColorStop(0, `rgba(190, 210, 255, ${0.9 * pointAlpha})`);
      glow.addColorStop(0.18, `rgba(110, 140, 255, ${0.38 * pointAlpha})`);
      glow.addColorStop(1, 'rgba(47, 85, 232, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - coreR * 26, cy - coreR * 26, coreR * 52, coreR * 52);
    }

    // ── Waves, then their collapse onto one ring ───────────────────────
    const wavesAlpha = enter * (1 - mapRange(p, POWERUP.reveal - 0.03, POWERUP.reveal));
    if (wavesAlpha > 0.002) {
      const spread = easeOut(mapRange(p, 0.1, POWERUP.converge));
      const drift = still ? 0 : (t * 0.08) % 1;
      for (let i = 0; i < RING_COUNT; i += 1) {
        const free = ((i / RING_COUNT + drift + spread) % 1) * this.max * (0.35 + spread * 0.8);
        const r = lerp(free, r0, collapse);
        if (r < 4) continue;
        const fade = lerp(1 - r / (this.max * 1.15), 0.9, collapse) * wavesAlpha;
        if (fade <= 0) continue;
        // A copper undertone on the outermost waves keeps it from going cold.
        const warm = mapRange(r, this.max * 0.5, this.max * 1.1) * (1 - collapse);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${110 + warm * 130}, ${140 - warm * 30}, ${255 - warm * 180}, ${fade * lerp(0.34, 0.22, collapse)})`;
        ctx.lineWidth = 1 + (1 - warm) * 0.6;
        ctx.stroke();
      }
      // The ring they collapse into, gaining definition as they arrive.
      if (collapse > 0) this.#ring(cx, cy, r0, 0.75 * collapse * wavesAlpha, 1.4);
    }

    // ── The ring releases ──────────────────────────────────────────────
    const ring = powerupRing(p, w, h);
    if (ring) {
      const fade = Math.pow(1 - ring.t, 1.2);
      this.#ring(ring.x, ring.y, ring.r, 0.75 * fade, 1.4);
      this.#ring(ring.x, ring.y, ring.r * 0.94, 0.25 * fade, 1);
    }

    // ── Particles ride the wavefront, and fall away before the collapse ─
    const dustAlpha = enter * (1 - mapRange(p, POWERUP.converge - 0.04, POWERUP.converge + 0.08));
    if (dustAlpha > 0.002) {
      const spread = easeOut(mapRange(p, 0.1, 0.92));
      ctx.fillStyle = 'rgb(200, 216, 255)';
      for (const particle of this.particles) {
        const r = ((particle.r + spread * particle.speed) % 1) * this.max;
        const fade = (1 - r / this.max) * dustAlpha;
        if (fade <= 0) continue;
        ctx.globalAlpha = fade * 0.3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(particle.a) * r, cy + Math.sin(particle.a) * r * 0.82, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

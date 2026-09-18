/* Act 03 — sound as energy.

   A single point of charge appears, pulses, and expands into concentric
   rings that resolve into the structure of the product. Everything is
   driven by act progress, so it scrubs backwards as cleanly as forwards. */

import { sizeCanvas } from '../core/hidpi.js';
import { clamp, mapRange, easeOut, prefersReducedMotion } from '../core/utils.js';

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

  render(_dt, now) {
    if (!this.on) return;

    const { ctx, w, h } = this;
    const p = this.progress;
    const cx = w / 2;
    const cy = h * 0.46;
    const t = now * 0.001;

    ctx.clearRect(0, 0, w, h);

    // Overall presence: in quickly, out at the very end as the product arrives
    const alpha = mapRange(p, 0, 0.12) * (1 - mapRange(p, 0.88, 1));

    // ── The point of charge ────────────────────────────────────────────
    const pulse = prefersReducedMotion() ? 0 : Math.sin(t * 2.4) * 0.5 + 0.5;
    const coreR = (2.5 + pulse * 2.2) * (1 + p * 1.5);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 26);
    glow.addColorStop(0, `rgba(190, 210, 255, ${0.9 * alpha})`);
    glow.addColorStop(0.18, `rgba(110, 140, 255, ${0.38 * alpha})`);
    glow.addColorStop(1, 'rgba(47, 85, 232, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - coreR * 26, cy - coreR * 26, coreR * 52, coreR * 52);

    // ── Expanding rings ────────────────────────────────────────────────
    const spread = easeOut(mapRange(p, 0.1, 0.92));
    for (let i = 0; i < RING_COUNT; i += 1) {
      const phase = i / RING_COUNT;
      const drift = prefersReducedMotion() ? 0 : (t * 0.08) % 1;
      const r = ((phase + drift + spread) % 1) * this.max * (0.35 + spread * 0.8);
      if (r < 4) continue;

      const fade = (1 - r / (this.max * 1.15)) * alpha;
      if (fade <= 0) continue;

      // A copper undertone on the outermost rings keeps it from going cold
      const warm = mapRange(r, this.max * 0.5, this.max * 1.1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${110 + warm * 130}, ${140 - warm * 30}, ${255 - warm * 180}, ${fade * 0.34})`;
      ctx.lineWidth = 1 + (1 - warm) * 0.6;
      ctx.stroke();
    }

    // ── Particles riding the wavefront ─────────────────────────────────
    ctx.fillStyle = `rgba(200, 216, 255, ${0.5 * alpha})`;
    for (const particle of this.particles) {
      const r = ((particle.r + spread * particle.speed) % 1) * this.max;
      const x = cx + Math.cos(particle.a) * r;
      const y = cy + Math.sin(particle.a) * r * 0.82;
      const fade = (1 - r / this.max) * alpha;
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

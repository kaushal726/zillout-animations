/* The sound field — the invisible field the product gives off.

   Only ever a supporting layer. Three hairline rings leave the product and
   dissolve, and a little dust hangs in the air around it. The dust has
   depth: each mote lags behind the scroll by an amount set by how far back
   it sits, so the 2D frame reads as having space in front of and behind it.
   Hard ceilings keep it quiet — no ring above 7% opacity, no mote above 30%.

   Also carries the transition wave: the crown ring's circle travelling out
   across the frame at the start of Act 06.

   Drawn at 1x. Everything here is soft, and a full-screen layer that repaints
   every frame should cost as little as possible. When there is nothing to
   draw the layer is switched off entirely, so the compositor stops blending
   an empty full-screen canvas. Priority 4 in the quality governor: it thins
   out, then stops, before the film is ever touched. */

import { sizeCanvas } from '../core/hidpi.js';
import { clamp, lerp, damp, prefersReducedMotion } from '../core/utils.js';
import { quality } from '../core/quality.js';

const RINGS = 3;
const DEPTH_BUCKETS = 3;

export class SoundField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dirty = false;
    this.visible = false;
    this.inertia = 0;
    this.resize();
  }

  resize() {
    const { w, h } = sizeCanvas(this.canvas, this.ctx, 1);
    this.w = w;
    this.h = h;
    const count = w < 780 ? 16 : 36;
    this.motes = Array.from({ length: count }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.3 + Math.random() * 0.45,
      depth: 0.25 + Math.random() * 0.75,
      size: 0.6 + Math.random() * 0.9,
      // Very slow orbit, in both directions, so nothing reads as a swirl.
      spin: (Math.random() - 0.5) * 0.00006,
    }));
  }

  #clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  #show(on) {
    if (on === this.visible) return;
    this.visible = on;
    this.canvas.classList.toggle('is-on', on);
  }

  /**
   * @param {number} dt
   * @param {number} now
   * @param {{ intensity:number, x:number, y:number, scale:number, velocity:number,
   *           wave: { x:number, y:number, r:number, alpha:number } | null }} state
   */
  render(dt, now, { intensity, x, y, scale, velocity, wave }) {
    const ambient = prefersReducedMotion() || quality.level === 0 ? 0 : intensity;
    if (ambient < 0.005 && !wave) {
      if (this.dirty) {
        this.#clear();
        this.dirty = false;
      }
      this.#show(false);
      return;
    }
    this.#show(true);

    const { ctx, w, h } = this;
    this.#clear();
    this.dirty = true;

    if (ambient >= 0.005) {
      const t = now * 0.001;
      const m = Math.min(w, h) * scale;

      // ── Rings leaving the product ────────────────────────────────────
      ctx.lineWidth = 1;
      for (let i = 0; i < RINGS; i += 1) {
        const phase = (t * 0.075 + i / RINGS) % 1;
        const r = lerp(0.2, 0.72, phase) * m;
        const alpha = Math.sin(phase * Math.PI) * 0.07 * ambient;
        if (alpha < 0.003) continue;
        // A barely-there breathing of the ellipse — field, not geometry.
        const wobble = 1 + Math.sin(t * 0.6 + i * 2.1) * 0.015;
        ctx.beginPath();
        ctx.ellipse(x, y, r * wobble, r * 0.9, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150, 178, 255, ${alpha})`;
        ctx.stroke();
      }

      // ── Dust, with depth ─────────────────────────────────────────────
      // Motes trail the scroll and settle back: nearer ones trail further.
      this.inertia = lerp(this.inertia, clamp(-velocity * 6, -60, 60), damp(0.06, dt));
      const buckets = Array.from({ length: DEPTH_BUCKETS }, () => new Path2D());
      // Under pressure, every second mote.
      const stride = quality.level >= 2 ? 1 : 2;
      for (let i = 0; i < this.motes.length; i += stride) {
        const mote = this.motes[i];
        mote.a += mote.spin * dt;
        const mx = x + Math.cos(mote.a) * mote.r * m * 1.25;
        const my = y + Math.sin(mote.a) * mote.r * m * 0.8 + this.inertia * mote.depth;
        const size = mote.size * (0.6 + mote.depth * 0.6);
        const path = buckets[Math.min(DEPTH_BUCKETS - 1, Math.floor(mote.depth * DEPTH_BUCKETS))];
        path.moveTo(mx + size, my);
        path.arc(mx, my, size, 0, Math.PI * 2);
      }
      buckets.forEach((path, b) => {
        ctx.fillStyle = `rgba(200, 216, 255, ${0.3 * ambient * ((b + 1) / DEPTH_BUCKETS)})`;
        ctx.fill(path);
      });
    }

    // ── The transition wave ────────────────────────────────────────────
    if (wave && wave.alpha > 0.003) {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 216, 255, ${wave.alpha})`;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r * 0.93, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150, 178, 255, ${wave.alpha * 0.35})`;
      ctx.stroke();
    }
  }
}

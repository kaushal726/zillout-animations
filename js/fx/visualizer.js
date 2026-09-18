/* Act 08 — see the system.

   A circular readout that answers the pointer. There is no audio element
   here (nothing to autoplay, and nothing we could honestly claim to be
   measuring), so the signal is synthesised: layered sines whose amplitude
   follows how fast and where the pointer moves. It should read as an
   instrument in a laboratory, not as a music player.

   Drawing is batched. Every bar is pushed into one of a few Path2D buckets
   and each bucket is stroked once, so the whole dial costs about a dozen
   draw calls a frame rather than one per bar. */

import { sizeCanvas } from '../core/hidpi.js';
import { clamp, lerp, mapRange, damp, prefersReducedMotion } from '../core/utils.js';

const ALPHA_BUCKETS = 4;
const TICKS = 84;

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.progress = 0;
    this.on = false;

    this.pointer = { x: 0.5, y: 0.5 };
    this.eased = { x: 0.5, y: 0.5 };
    this.energy = 0;
    this.resize();
  }

  resize() {
    // 1.5x is indistinguishable from full retina for thin strokes,
    // and clears less than half the pixels each frame.
    const { w, h } = sizeCanvas(this.canvas, this.ctx, 1.5);
    this.w = w;
    this.h = h;
    const narrow = w < 780;
    /* Sized so the outer graduations, the bars at full swing and the copy
       beneath the dial all fit the viewport without colliding:
       dial reaches 1.76R and bars peak at 1.64R, both inside the viewport
       when centred, with the headline sitting inside the bar ring. */
    this.radius = Math.min(w, h) * (narrow ? 0.3 : 0.24);
    this.bars = narrow ? 84 : 156;
  }

  setProgress(p) {
    this.progress = clamp(p);
    const on = this.progress > 0.001 && this.progress < 0.999;
    if (on !== this.on) {
      this.on = on;
      this.canvas.classList.toggle('is-on', on);
    }
  }

  movePointer(x, y) {
    const nx = x / this.w;
    const ny = y / this.h;
    const travel = Math.hypot(nx - this.pointer.x, ny - this.pointer.y);
    this.energy = clamp(this.energy + travel * 5.5, 0, 1);
    this.pointer.x = nx;
    this.pointer.y = ny;
  }

  /** Outer boundary and its graduations — the dial the bars sit on. */
  #drawDial(cx, cy, R, alpha) {
    const { ctx } = this;
    const inner = R * 1.68;
    const outer = R * 1.76;

    const ticks = new Path2D();
    const majors = new Path2D();
    for (let i = 0; i < TICKS; i += 1) {
      const a = (i / TICKS) * Math.PI * 2;
      const major = i % 7 === 0;
      const from = major ? inner - R * 0.06 : inner;
      const path = major ? majors : ticks;
      path.moveTo(cx + Math.cos(a) * from, cy + Math.sin(a) * from);
      path.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(150, 175, 255, ${0.16 * alpha})`;
    ctx.stroke(ticks);
    ctx.strokeStyle = `rgba(190, 210, 255, ${0.4 * alpha})`;
    ctx.stroke(majors);

    const ring = new Path2D();
    ring.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 175, 255, ${0.22 * alpha})`;
    ctx.stroke(ring);
  }

  render(dt, now) {
    if (!this.on) return;

    const { ctx, w, h } = this;
    const t = now * 0.001;
    const still = prefersReducedMotion();

    const k = damp(0.08, dt);
    this.eased.x = lerp(this.eased.x, this.pointer.x, k);
    this.eased.y = lerp(this.eased.y, this.pointer.y, k);
    this.energy *= Math.pow(0.94, dt / 16.667);

    const alpha = mapRange(this.progress, 0, 0.18) * (1 - mapRange(this.progress, 0.82, 1));
    const drive = 0.42 + this.energy * 0.58;

    const cx = w / 2 + (this.eased.x - 0.5) * w * 0.06;
    // Concentric with the centred copy.
    const cy = h * 0.5 + (this.eased.y - 0.5) * h * 0.05;
    const R = this.radius;

    ctx.clearRect(0, 0, w, h);

    this.#drawDial(cx, cy, R, alpha);

    // ── Radiating bars ─────────────────────────────────────────────────
    // Bucketed by brightness, and split cool/warm, so the whole ring is a
    // handful of stroke calls instead of one per bar.
    const cool = Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
    const warmPaths = Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
    const toPointer = Math.atan2(this.eased.y - 0.5, this.eased.x - 0.5);
    const phase = still ? 0 : t * 1.5;
    // A slow highlight travelling the ring, so it breathes without the
    // pointer. Folded into brightness rather than drawn as a sweep.
    const highlight = still ? -9 : (t * 0.35) % (Math.PI * 2);

    for (let i = 0; i < this.bars; i += 1) {
      const a = (i / this.bars) * Math.PI * 2 - Math.PI / 2;

      const signal =
        Math.sin(a * 3 + phase) * 0.5 +
        Math.sin(a * 7 - phase * 0.7) * 0.3 +
        Math.sin(a * 13 + phase * 1.3) * 0.2;

      const proximity = Math.cos(a - toPointer) * 0.5 + 0.5;
      const sweep = still ? 0 : Math.pow(Math.max(0, Math.cos(a - highlight)), 8) * 0.5;

      const len = R * (0.1 + Math.abs(signal) * 0.3 * drive * (0.6 + proximity * 0.8) + sweep * 0.12);
      const x1 = cx + Math.cos(a) * R;
      const y1 = cy + Math.sin(a) * R;
      const x2 = cx + Math.cos(a) * (R + len);
      const y2 = cy + Math.sin(a) * (R + len);

      const strength = clamp(0.3 + Math.abs(signal) * 0.75 + sweep);
      const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(strength * ALPHA_BUCKETS));
      const path = proximity * this.energy > 0.45 ? warmPaths[bucket] : cool[bucket];
      path.moveTo(x1, y1);
      path.lineTo(x2, y2);
    }

    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let b = 0; b < ALPHA_BUCKETS; b += 1) {
      const level = (b + 1) / ALPHA_BUCKETS;
      ctx.strokeStyle = `rgba(150, 178, 255, ${0.62 * level * alpha})`;
      ctx.stroke(cool[b]);
      ctx.strokeStyle = `rgba(240, 150, 90, ${0.6 * level * alpha})`;
      ctx.stroke(warmPaths[b]);
    }
    ctx.lineCap = 'butt';

    // ── Inner waveform ─────────────────────────────────────────────────
    const wave = new Path2D();
    for (let i = 0; i <= 200; i += 1) {
      const a = (i / 200) * Math.PI * 2 - Math.PI / 2;
      const wob = still ? 0 : Math.sin(a * 6 + t * 2.2) * 0.022 + Math.sin(a * 11 - t * 1.4) * 0.014;
      const r = R * (0.72 + wob * drive * 3.4);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i === 0 ? wave.moveTo(x, y) : wave.lineTo(x, y);
    }
    wave.closePath();
    ctx.strokeStyle = `rgba(214, 228, 255, ${0.6 * alpha})`;
    ctx.lineWidth = 1.2;
    ctx.stroke(wave);

    // A second, quieter trace just inside it adds depth without noise.
    const inner = new Path2D();
    inner.arc(cx, cy, R * 0.58, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 178, 255, ${0.1 * alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke(inner);

    // ── Centre bloom ───────────────────────────────────────────────────
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    bloom.addColorStop(0, `rgba(58, 100, 255, ${0.3 * alpha * (0.55 + this.energy)})`);
    bloom.addColorStop(1, 'rgba(58, 100, 255, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
  }
}

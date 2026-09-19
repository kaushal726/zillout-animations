/* The film canvas — draws one still, correctly framed, then lights it.

   Lighting is how every "focus" moment on this page works. The render is a
   flat image sequence with no separate layers, so a component cannot really
   step forward. What can be done honestly is what a lighting director does:
   put light on one thing and let shadow take the rest. Three passes, all
   drawn over the untouched frame:

     lights  soft-light highlights. Soft-light leaves black black, so light
             only lands on the product, never on the empty studio around it.
     rim     a band of light at a radius, for light that travels.
     shade   darkness outside a circle, with a soft falloff.

   Then two things that used to be separate full-screen layers, baked into
   the same draw so the compositor no longer blends them every frame:

     vignette  rendered once per resize into an offscreen canvas and blitted.
     dim       the film's brightness, as one black fill. A CSS filter on this
               canvas cost an extra offscreen pass at device resolution on
               every frame, whether or not anything had changed.            */

import { clamp, lerp, mapRange } from '../core/utils.js';
import { sizeCanvas } from '../core/hidpi.js';

/* The stills are 1920x1080. Filling a retina backing store means drawing
   them at 2x their own resolution — four times the pixels to push, for no
   detail that exists in the source. Cap the backing store at the source
   width and let the compositor do the final upscale, which is free. */
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

const LIGHT = '214, 226, 255';
const RIM = '222, 232, 255';
const SHADE = '3, 3, 3';

export class FilmCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.current = null;
    this.lighting = null;
    this.lightKey = '';
    this.brightness = 1;
    this.vignette = document.createElement('canvas');
    this.resize();
  }

  resize() {
    const maxDpr = clamp(SOURCE_WIDTH / innerWidth, 1, 2);
    const { w, h } = sizeCanvas(this.canvas, this.ctx, maxDpr);
    this.w = w;
    this.h = h;
    // 'high' forces an expensive resample on every blit. The source is
    // 1920px being drawn at roughly that size, so the extra quality is
    // invisible while the cost is not.
    this.ctx.imageSmoothingQuality = 'medium';
    this.fit = this.#fitFor(SOURCE_WIDTH, SOURCE_HEIGHT);
    this.#renderVignette();
    if (this.current) this.draw(this.current, this.lighting, this.brightness, true);
  }

  /** The corner falloff and the top/bottom scrims (for the nav above and
      the copy below), rendered once at the canvas's own resolution. */
  #renderVignette() {
    const v = this.vignette;
    v.width = this.canvas.width;
    v.height = this.canvas.height;
    const g = v.getContext('2d');
    const w = v.width;
    const h = v.height;

    // Elliptical corner falloff: a circular gradient in a scaled space.
    const rx = w * 0.8;
    const ry = h * 0.64;
    g.save();
    g.translate(w * 0.5, h * 0.46);
    g.scale(rx / ry, 1);
    const radial = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    radial.addColorStop(0.34, `rgba(${SHADE}, 0)`);
    radial.addColorStop(0.74, `rgba(${SHADE}, 0.5)`);
    radial.addColorStop(1, `rgba(${SHADE}, 0.9)`);
    g.fillStyle = radial;
    g.fillRect(-w * 2, -h * 2, w * 4, h * 4); // over-covers; clipped to the canvas
    g.restore();

    const linear = g.createLinearGradient(0, 0, 0, h);
    linear.addColorStop(0, `rgba(${SHADE}, 0.82)`);
    linear.addColorStop(0.15, `rgba(${SHADE}, 0.28)`);
    linear.addColorStop(0.32, `rgba(${SHADE}, 0)`);
    linear.addColorStop(0.5, `rgba(${SHADE}, 0)`);
    linear.addColorStop(0.8, `rgba(${SHADE}, 0.58)`);
    linear.addColorStop(1, `rgba(${SHADE}, 0.9)`);
    g.fillStyle = linear;
    g.fillRect(0, 0, w, h);
  }

  /**
   * Wide screens get a full cover crop. Portrait screens ease towards a
   * contained fit instead — the exploded components spread far to the left
   * and right, and a cover crop on a phone would throw them off screen.
   * The artwork sits on pure black, so the letterboxing is invisible.
   */
  #fitFor(iw, ih) {
    const cover = Math.max(this.w / iw, this.h / ih);
    const contain = Math.min(this.w / iw, this.h / ih);
    // Just past a contained fit: enough overscan to kill the side letterbox
    // without cropping the outermost exploded parts, which sit at roughly
    // 10% in from each edge of the artwork.
    const portrait = contain * 1.15;
    const aspect = mapRange(this.w / this.h, 0.72, 1.25);
    const s = lerp(portrait, cover, aspect);
    // On portrait the band is much shorter than the screen, so it is lifted
    // off dead centre to leave the copy below it room to breathe.
    const anchor = lerp(0.45, 0.5, aspect);
    return { s, x: (this.w - iw * s) / 2, y: (this.h - ih * s) * anchor };
  }

  /** Art space (0..1 of the source still) to canvas pixels. */
  artToCanvas(u, v) {
    const { s, x, y } = this.fit;
    return { x: x + u * SOURCE_WIDTH * s, y: y + v * SOURCE_HEIGHT * s };
  }

  /** A length in art-width units, in canvas pixels. */
  artLength(units) {
    return units * SOURCE_WIDTH * this.fit.s;
  }

  /**
   * Redraws only when the still, the lighting or the brightness actually
   * changed. Lighting carries a precomputed key and brightness is bucketed,
   * so an idle page costs nothing here.
   */
  draw(img, lighting = null, brightness = 1, force = false) {
    if (!img) return;
    const bright = Math.min(1, brightness);
    const key = `${lighting ? lighting.key : ''}|${Math.round(bright * 200)}`;
    if (!force && img === this.current && key === this.lightKey) return;
    this.current = img;
    this.lighting = lighting;
    this.lightKey = key;
    this.brightness = bright;

    const { ctx } = this;
    const fit = img.naturalWidth === SOURCE_WIDTH ? this.fit : this.#fitFor(img.naturalWidth, img.naturalHeight);

    ctx.fillStyle = `rgb(${SHADE})`;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(img, fit.x, fit.y, img.naturalWidth * fit.s, img.naturalHeight * fit.s);

    if (lighting) this.#light(lighting);

    // Blitted in device pixels, so reset to identity for this one draw.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.vignette, 0, 0);
    ctx.restore();

    if (bright < 0.998) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - bright).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  #light({ lights, rim, shade }) {
    const { ctx } = this;

    // Light first, then shadow: light that falls outside the pool is then
    // taken back by the shade, so it reads as a lit edge, not a glow.
    if (lights.length || rim) {
      ctx.globalCompositeOperation = 'soft-light';

      for (const l of lights) {
        if (l.strength < 0.004 || l.r < 1) continue;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(${LIGHT}, ${l.strength})`);
        g.addColorStop(1, `rgba(${LIGHT}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }

      if (rim && rim.strength > 0.004) {
        const inner = Math.max(0, rim.r - rim.width);
        const outer = rim.r + rim.width;
        const g = ctx.createRadialGradient(rim.x, rim.y, inner, rim.x, rim.y, outer);
        g.addColorStop(0, `rgba(${RIM}, 0)`);
        g.addColorStop(0.5, `rgba(${RIM}, ${rim.strength})`);
        g.addColorStop(1, `rgba(${RIM}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(rim.x - outer, rim.y - outer, outer * 2, outer * 2);
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    if (shade && shade.alpha > 0.004) {
      const r = Math.max(0, shade.r);
      const g = ctx.createRadialGradient(shade.x, shade.y, r, shade.x, shade.y, r + Math.max(1, shade.soft));
      g.addColorStop(0, `rgba(${SHADE}, 0)`);
      g.addColorStop(1, `rgba(${SHADE}, ${shade.alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }
}

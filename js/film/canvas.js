/* The film canvas — draws one still, correctly framed, at device resolution. */

import { lerp, mapRange } from '../core/utils.js';
import { sizeCanvas } from '../core/hidpi.js';

export class FilmCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.current = null;
    this.resize();
  }

  resize() {
    const { w, h } = sizeCanvas(this.canvas, this.ctx);
    this.w = w;
    this.h = h;
    // 'high' forces an expensive resample on every blit. The source is
    // 1920px being drawn at roughly that size, so the extra quality is
    // invisible while the cost is not.
    this.ctx.imageSmoothingQuality = 'medium';
    if (this.current) this.draw(this.current, true);
  }

  /**
   * Wide screens get a full cover crop. Portrait screens ease towards a
   * contained fit instead — the exploded components spread far to the left
   * and right, and a cover crop on a phone would throw them off screen.
   * The artwork sits on pure black, so the letterboxing is invisible.
   */
  #scaleFor(iw, ih) {
    const cover = Math.max(this.w / iw, this.h / ih);
    const contain = Math.min(this.w / iw, this.h / ih);
    // Just past a contained fit: enough overscan to kill the side letterbox
    // without cropping the outermost exploded parts, which sit at roughly
    // 10% in from each edge of the artwork.
    const portrait = contain * 1.15;
    return lerp(portrait, cover, mapRange(this.w / this.h, 0.72, 1.25));
  }

  /** Where the artwork's centre sits vertically. On portrait the band is
      much shorter than the screen, so it is lifted off dead centre to leave
      the copy below it room to breathe. */
  #anchorFor() {
    return lerp(0.45, 0.5, mapRange(this.w / this.h, 0.72, 1.25));
  }

  draw(img, force = false) {
    if (!img) return;
    if (img === this.current && !force) return;
    this.current = img;

    const { ctx } = this;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const s = this.#scaleFor(iw, ih);
    const dw = iw * s;
    const dh = ih * s;

    ctx.fillStyle = '#030303';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(img, (this.w - dw) / 2, (this.h - dh) * this.#anchorFor(), dw, dh);
  }
}

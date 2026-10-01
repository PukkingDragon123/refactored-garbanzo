// V9 art kit: shared helpers for the beach props. Every prop is painted on a canvas with generous
// margins and trimmed to its content (nothing ever touches a buffer edge), anchored at its ground
// contact, and usually half-buried: a sand lip in the tone of the sand it lies on (the wet swash zone,
// the damp margin or dry sand) is painted over its base so it sits IN the beach, not on it.

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { Rng, bayer, clamp, hash2, noise1 } from '../../core/math';
import { outlineSel, trimSprite, Sprite, Ramp } from '../jungle-core';

export type { Sprite, Ramp };
export const ramp = (...h: string[]): Ramp => h.map(x => hex(x));

/** the sand an object lies in */
export type Bed = 'wet' | 'damp' | 'dry' | 'none';
const BEDS: Record<Exclude<Bed, 'none'>, C[]> = {
  // shadow, body, lit, crest
  wet: ramp('#5a5244', '#6e6452', '#857860', '#9c8c6e'),
  damp: ramp('#9a8462', '#b0986e', '#c4aa7e', '#d4bc8e'),
  dry: ramp('#c4a06a', '#dcbe88', '#ecd29e', '#f6e2b2'),
};
export const bedTone = (bed: Exclude<Bed, 'none'>, i: number) => BEDS[bed][clamp(i, 0, 3)];

/** canvas for a w x h object with margin m all round; returns the buffer and the origin offset */
export function canvas(w: number, h: number, m = 8) {
  return { buf: new PixelBuffer(Math.ceil(w + m * 2), Math.ceil(h + m * 2)), o: m };
}

/** outline, trim and anchor (ax, ay in canvas pixels) */
export function done(buf: PixelBuffer, ax: number, ay: number, outline = 0.5): Sprite {
  if (outline > 0) outlineSel(buf, outline);
  return trimSprite({ buf, ax: Math.round(ax), ay: Math.round(ay) }, 0);
}

/**
 * A low drift of sand over an object's base between x0 and x1 at ground line gy: a lumpy mound up to
 * h px high that tapers to nothing at both ends, lit along its crest. Paints over whatever is there.
 */
export function sandLip(buf: PixelBuffer, x0: number, x1: number, gy: number, h: number, bed: Bed, seed = 1, rough = 1) {
  if (bed === 'none') return;
  const w = x1 - x0;
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const u = (x - x0) / w;
    if (u < 0 || u > 1) continue;
    const hh = h * Math.pow(Math.sin(u * Math.PI), 0.6) * (0.75 + noise1(x / 5, seed) * 0.5 * rough);
    if (hh < 0.5) continue;
    const top = gy - hh;
    for (let y = Math.floor(top); y <= gy; y++) {
      const d = y - top;
      let c = d < 1 ? bedTone(bed, 3) : d < 2 ? bedTone(bed, 2) : bedTone(bed, 1);
      if (hash2(x, y, seed + 3) < 0.08) c = shade(c, -0.08);
      if (u < 0.12 || u > 0.88) c = mix(c, bedTone(bed, 0), 0.25);
      buf.set(x, y, c);
    }
  }
}

/** soft dark contact shadow under an object, only onto empty (sand) pixels or its own base */
export function contact(buf: PixelBuffer, cx: number, gy: number, rx: number, ry: number, bed: Bed) {
  if (bed === 'none') return;
  for (let y = Math.floor(gy - ry); y <= gy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x - cx) / rx, ny = (y - gy) / ry;
    const q = nx * nx + ny * ny;
    if (q > 1 || y < gy - 1) continue;
    if (!buf.opaque(x, y) && bayer(x, y) < (1 - q) * 0.9) buf.set(x, y, bedTone(bed, 0));
  }
}

/** shade a ramp index from a surface normal-ish value (lit from the upper left) with dithering */
export function tone(rp: Ramp, l: number, x: number, y: number, dither = 0.7): C {
  return rp[clamp(Math.round(l * (rp.length - 1) + (bayer(x, y) - 0.5) * dither), 0, rp.length - 1)];
}

export { Rng, hex, mix, shade };
export type { C };

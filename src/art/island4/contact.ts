// Contact shadows for things lying on the sand: a hand-pixel cookie hugging the sprite's own footprint
// (the opaque extent of its lowest rows), darkest right under it, a ragged second row and the sun-side
// end trimmed, drawn in the renderer's shadow pass so props sit IN the sand instead of floating on it.

import { PixelBuffer } from '../pixel';
import { hex, withAlpha } from '../color';
import { hash2 } from '../../core/math';

export interface Contact {
  /** the cookie (black with alpha), its left edge and top row relative to the sprite's anchor */
  buf: PixelBuffer;
  dx: number;
  dy: number;
}

/** contact shadow for a sprite anchored at (ax, ay); null if it has no opaque pixels */
export function contactFor(buf: PixelBuffer, ax: number, ay: number, seed = 1): Contact | null {
  const { w, h, data } = buf;
  let bottom = -1;
  for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (data[y * w + x] >>> 24 > 96) { bottom = y; break; }
  if (bottom < 0) return null;
  // footprint: the opaque span of the lowest three rows
  let x0 = w, x1 = -1;
  for (let y = Math.max(0, bottom - 2); y <= bottom; y++) for (let x = 0; x < w; x++) if (data[y * w + x] >>> 24 > 96) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const fw = x1 - x0 + 1;
  const cw = fw + 4;
  const b = new PixelBuffer(cw, 3);
  const k = hex('#000000');
  for (let x = 0; x < cw; x++) {
    const e = Math.min(x, cw - 1 - x);
    // row 0 tucks under the base; row 1 is the cast shadow, a pixel longer on the side away from the sun
    if (e >= 1) b.data[x] = withAlpha(k, e === 1 ? 60 : 110);
    if (e >= 2 || (x > cw / 2 && e >= 1)) b.data[cw + x] = withAlpha(k, e < 3 ? 46 : 80 - (hash2(x, seed, 3) < 0.3 ? 24 : 0));
    if (e >= 3 + (hash2(x, seed, 4) < 0.5 ? 1 : 0) && fw > 6) b.data[cw * 2 + x] = withAlpha(k, 34);
  }
  return { buf: b, dx: x0 - 2 - ax, dy: bottom - ay };
}

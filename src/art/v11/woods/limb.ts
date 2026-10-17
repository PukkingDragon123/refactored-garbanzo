// V11 woods: the Emerald Canopy's walkway, a road of colossal branches high in the old forest. Painted
// per column in chunks along the walk line: the round body of the limb (lit across its top, its belly in
// shade, bark furrows running along it, knots and burls), a carpet of moss on top sprinkled with ferns
// and lichen, tufts standing over the walk line, and beard moss and roots trailing from its underside.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix } from '../../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import { FP, pick } from '../forest/kit';

export interface LimbChunk { x0: number; y0: number; buf: PixelBuffer }

/** paint the branch road for world x in [x0, x0 + w): top(x) the walk line, thick(x) the limb's depth */
export function paintBranchRoad(x0: number, w: number, top: (x: number) => number, thick: (x: number) => number, seed: number): LimbChunk {
  let minT = 1e9, maxB = -1e9;
  for (let x = x0; x < x0 + w; x++) { minT = Math.min(minT, top(x)); maxB = Math.max(maxB, top(x) + thick(x) + 40); }
  const y0 = Math.floor(minT) - 8;
  const h = Math.ceil(maxB - y0);
  const b = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const t = top(x), th = thick(x);
    const bx = x - x0;
    // tufts standing over the walk line
    const lip = Math.round(noise1(x * 0.8, seed) * 3 + noise1(x / 6, seed + 1) * 2);
    for (let k = 1; k <= lip; k++) { const y = Math.round(t) - k; if (y >= y0) b.data[(y - y0) * w + bx] = pick(FP.moss, 5 + k * 0.5 + noise1(x * 1.3, seed + 2) * 2); }
    const mossD = 3 + noise1(x / 9, seed + 3) * 4 + (fbm2(x / 60, 0.5, 2, seed + 4) > 0.55 ? 3 : 0);
    for (let y = Math.round(t); y < t + th; y++) {
      const v = (y - t) / th;
      // the round body: lit across its top, its belly dark; furrows run along the limb
      const ny = v * 2 - 1;
      let l = 6.2 - (ny + 0.35) * 3.4 - Math.max(0, ny) * 1.6;
      const furrow = noise2(x / 14, y / 1.6, seed + 5);
      l += (furrow - 0.5) * 2.4 + (fbm2(x / 30, y / 8, 2, seed + 6) - 0.5) * 1.4;
      if (Math.abs(noise2(x / 22, y / 2.2, seed + 7) - 0.5) < 0.03) l -= 2.2;
      // a burl now and then
      const burl = noise1(x / 70, seed + 8);
      if (burl > 0.72 && v > 0.3 && v < 0.8) l += (burl - 0.72) * 8 * Math.sin(v * Math.PI);
      let c = pick(FP.kauri, l + (bayer(x, y) - 0.5) * 0.9);
      // moss carpet on top, ferns and lichen in it
      const d = y - t;
      if (d < mossD) {
        c = pick(FP.moss, 6 - d * 0.6 + (noise2(x / 1.8, y / 1.2, seed + 9) - 0.5) * 2.4 + (bayer(x, y) - 0.5));
        if (hash2(x >> 1, y, seed + 10) < 0.05) c = pick(FP.fern, 7);
      } else if (v < 0.5 && fbm2(x / 16, y / 6, 2, seed + 11) > 0.66) c = mix(c, pick(FP.lichen, 2 + (bayer(x, y) - 0.5) * 2), 0.7);
      else if (v > 0.55 && fbm2(x / 20, y / 6, 2, seed + 12) > 0.6) c = pick(FP.moss, 2 + (1 - v) * 2 + (bayer(x, y) - 0.5));
      // the outline of the belly
      if (y >= t + th - 1) c = FP.kauri[0];
      b.data[(y - y0) * w + bx] = c;
    }
    // beard moss and fine roots trailing from the underside
    if (hash2(x, 3, seed) < 0.22) {
      const len = 4 + hash2(x, 4, seed) * 30 * (0.5 + noise1(x / 40, seed + 13));
      const lich = hash2(x, 5, seed) < 0.4;
      for (let k = 0; k < len; k++) {
        const y = Math.round(t + th + k), xx = bx + Math.round(Math.sin(k * 0.4 + x) * 0.6);
        if (y - y0 >= h || xx < 0 || xx >= w) break;
        b.data[(y - y0) * w + xx] = lich ? pick(FP.lichen, 3 - k / len * 2) : pick(FP.moss, 4 - (k / len) * 3);
      }
    }
  }
  return { x0, y0, buf: b };
}

/** a vine bridge sagging between two points (rope rails and plank slats) */
export function paintVineBridge(len: number, sag: number): { buf: PixelBuffer; ax: number; ay: number } {
  const H = Math.ceil(sag + 30);
  const b = new PixelBuffer(len + 4, H);
  const rope = (t: number) => 18 + Math.sin(t * Math.PI) * sag;
  for (let x = 0; x < len; x++) {
    const t = x / len, y = rope(t);
    // the deck: slats every few px
    if (x % 5 < 3) for (let k = 0; k < 2; k++) b.set(x + 2, Math.round(y) + k, pick(FP.podo, 5 - k * 2 + (bayer(x, k) - 0.5)));
    b.set(x + 2, Math.round(y) + 2, FP.podo[1]);
    // the hand rope above, and the ties down to the deck
    const hy = Math.round(y - 14 - Math.sin(t * Math.PI) * 2);
    b.set(x + 2, hy, pick(FP.moss, 4)); b.set(x + 2, hy + 1, FP.moss[2]);
    if (x % 12 === 0) for (let k = hy; k < y; k++) b.set(x + 2, k, FP.moss[3]);
    // leaves on the vines
    if (hash2(x, 7, 1) < 0.18) { b.set(x + 2, hy - 1, FP.fern[6]); b.set(x + 3, hy - 1, FP.fern[5]); }
  }
  b.outline(hex('#0a0d0b'));
  void clamp; void smoothstep;
  return { buf: b, ax: 2, ay: 18 };
}

export type { C };

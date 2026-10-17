// V11 woods: Thunder Falls' cliff and its water. A towering wall of columnar basalt (hexagonal columns
// split by cross-joints, black where the spray keeps it wet, hung with moss, ferns and kidney ferns, a
// fringe of bush along the far-off lip), the notch the river pours through and the dark wet hollow
// behind the curtain; ledges the cliff birds nest on; and the falling water itself: tileable curtain
// textures (a slower dim back sheet, a fast bright front one with ropes of white water) and foam.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, withAlpha } from '../../color';
import { bayer, clamp, fbm2, hash2, noise1, smoothstep } from '../../../core/math';
import { FP, pick } from '../forest/kit';

const BASALT: C[] = ['#0f1113', '#16191c', '#1e2226', '#272c31', '#31373d', '#3c434a', '#4a525a', '#59626a', '#6b747b', '#818a90'].map(h => hex(h));

export interface FallsCliff { buf: PixelBuffer; ledges: { x0: number; x1: number; y: number }[] }

/**
 * The cliff (w x h, top-left anchored). notch: the falls' x range (buffer coords); ledges: [x0, x1, y]
 * in buffer coords, painted as lit lips with moss and shadow under them.
 */
export function paintFallsCliff(w: number, h: number, seed: number, notch: [number, number], ledges: [number, number, number][]): FallsCliff {
  const b = new PixelBuffer(w, h);
  const [n0, n1] = notch;
  const nc = (n0 + n1) / 2, nw = (n1 - n0) / 2;
  // the left edge: the cliff steps out of the bush in buttresses
  const leftEdge = (y: number) => 18 + fbm2(y * 0.012, 0.3, 3, seed) * 60 + Math.max(0, (h - y) - h * 0.6) * 0.08;
  for (let y = 0; y < h; y++) {
    const le = leftEdge(y);
    for (let x = 0; x < w; x++) {
      if (x < le) continue;
      // hexagonal-ish columns: a column index from a jittered x, cross-joints every few px of height
      const jx = x + fbm2(x * 0.01, y * 0.004, 2, seed) * 30;
      const col = Math.floor(jx / 15), u = (jx / 15) % 1;
      const cross = Math.floor((y + hash2(col, 0, seed) * 40) / (26 + hash2(col, 1, seed) * 20));
      const v = ((y + hash2(col, 0, seed) * 40) / (26 + hash2(col, 1, seed) * 20)) % 1;
      // each column face lit from the left, the cross-joints dark lines, big weathering mottles
      let l = 5 + (0.5 - u) * 3.4 + (hash2(col, cross, seed + 2) - 0.5) * 1.6 + (fbm2(x * 0.03, y * 0.03, 3, seed + 4) - 0.5) * 2.4;
      if (u > 0.9 || v < 0.06) l -= 3;
      // wet near the falls and down the seeps: black, glossy
      const wet = Math.exp(-(((x - nc) / (nw * 2.6)) ** 2)) * 0.9 + smoothstep(0.66, 0.8, fbm2(x * 0.05, y * 0.004, 2, seed + 6)) * 0.6;
      l -= wet * 2.6;
      // the deep shade toward the foot and in the hollow behind the curtain
      l -= smoothstep(h * 0.55, h, y) * 1.2;
      let c = pick(BASALT, l + (bayer(x, y) - 0.5) * 0.9);
      if (wet > 0.5 && hash2(x, y, seed + 7) < 0.05) c = BASALT[8];
      // moss and ferns hanging off the columns
      const m = fbm2(x * 0.045, y * 0.03, 3, seed + 8);
      if (m > 0.6 - wet * 0.15) c = pick(FP.moss, 2.6 + (m - 0.6) * 12 + (0.5 - u) * 2 + (bayer(x, y) - 0.5));
      if (m > 0.7 && hash2(x >> 1, y >> 1, seed + 9) < 0.18) c = pick(FP.fern, 5 + (0.5 - u) * 3);
      b.data[y * w + x] = c;
    }
  }
  // the notch and the dark wet hollow behind the falls
  for (let y = 0; y < h; y++) for (let x = Math.max(0, n0 - 16); x < Math.min(w, n1 + 16); x++) {
    const e = Math.abs(x - nc) / (nw + 10);
    if (e > 1) continue;
    const k = (1 - e * e);
    const hollow = smoothstep(h * 0.45, h * 0.9, y) * k;
    if (hollow > 0.1) b.data[y * w + x] = mix(b.data[y * w + x], hex('#06090a'), clamp(hollow * 1.2));
  }
  // the ledges: a lit lip, moss and tussock on top, a shadow band under it
  const out: FallsCliff['ledges'] = [];
  for (const [x0, x1, ly] of ledges) {
    for (let x = x0; x < x1; x++) {
      if (!b.opaque(x, ly)) continue;
      const lip = Math.round(noise1(x * 0.2, seed) * 2);
      for (let k = -2; k < 9; k++) {
        const y = ly + k + lip;
        if (y < 0 || y >= h) continue;
        if (k < 0) { if (hash2(x, k, seed + 10) < 0.6) b.data[y * w + x] = pick(FP.moss, 5 + (bayer(x, y) - 0.5) * 2 + (k === -2 ? 1 : 0)); }
        else if (k < 2) b.data[y * w + x] = pick(BASALT, 8 - k + (bayer(x, y) - 0.5));
        else b.data[y * w + x] = mix(b.data[y * w + x], hex('#07080a'), 0.55 - (k - 2) * 0.06);
      }
    }
    out.push({ x0, x1, y: ly });
  }
  b.outline(hex('#08090a'));
  return { buf: b, ledges: out };
}

/** one tileable curtain sheet (w x h, tiles vertically): streaks of falling water, ropes of white */
export function paintCurtain(w: number, h: number, seed: number, front: boolean): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const cols = front
    ? ['#3a7f92', '#5aa2b4', '#86c4d0', '#b6e2e8', '#e4fafc', '#ffffff'].map(c => hex(c))
    : ['#1e4a58', '#2e6474', '#46818f', '#6aa0aa', '#94c0c6'].map(c => hex(c));
  for (let x = 0; x < w; x++) {
    const cx = x / (w - 1);
    const edge = Math.min(cx, 1 - cx);
    const rope = noise1(x * 0.32, seed) * 0.6 + noise1(x * 0.11, seed + 1) * 0.5;
    for (let y = 0; y < h; y++) {
      const a = (y / h) * Math.PI * 2;
      // periodic in y: streaks that stretch with the fall
      const s = fbm2(x * 0.3, Math.cos(a) * 2.2 + 7, 2, seed + 3) * 0.6 + fbm2(x * 0.3 + 40, Math.sin(a) * 2.2 + 7, 2, seed + 3) * 0.6;
      let v = rope * 0.8 + s * 0.8 - 0.35 + (bayer(x, y) - 0.5) * 0.2;
      if (edge < 0.12) v -= (0.12 - edge) * 6;
      const i = clamp(Math.floor(v * cols.length), 0, cols.length - 1);
      const alpha = edge < 0.06 ? 110 : edge < 0.12 ? 180 : front ? 235 : 255;
      if (front && v < 0.2) continue;
      b.data[y * w + x] = withAlpha(cols[i], alpha);
    }
  }
  return b;
}

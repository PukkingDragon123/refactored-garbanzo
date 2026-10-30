// The old pā, painted stone by stone: dry-stone terrace walls of fitted, irregular stones (each lit on
// its top-left edge and shadowed under, dark gaps between, moss and little ferns in the joints, turf
// overhanging the top, roots hanging), the storage pits with crumbling earth lips, a hearth ring of
// fire-blackened stones, and the collapsed stair: broken steps going down into the dark under a
// ragged lip of earth and roots.

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { hex } from './color';
import { Rng, bayer, clamp, fbm1, hash2 } from '../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));
const STONE = r('#1e1e1a', '#2e2e28', '#42423a', '#56564c', '#6c6a5e', '#848272', '#9c9a88', '#b6b29e');
const EARTH = r('#140e0a', '#21170f', '#2e2016', '#3e2c1e', '#503a28', '#644a34');
const MOSS = r('#1a2610', '#263a16', '#34501c', '#446824', '#58802e', '#6e9a3a');
const ROOT = r('#2a1c12', '#3e2a1a', '#56402a');
const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];

/** a dry-stone terrace wall (anchor bottom left) */
export function paintTerraceWall(w: number, h: number, seed: number): { buf: PixelBuffer; ax: number; ay: number } {
  const rng = new Rng(seed * 13 + 1);
  const b = new PixelBuffer(w, h);
  const id = new Int32Array(w * h).fill(-1);
  // courses of stones: irregular heights, each stone a chipped block with a bulging face
  let y = 3, n = 0;
  while (y < h) {
    const rh = rng.int(5, 10);
    let x = -rng.int(0, 10);
    while (x < w) {
      const sw = rng.int(7, 18), tone = rng.range(-1, 1), sink = rng.int(0, 1);
      for (let yy = y + sink; yy < Math.min(h, y + rh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + sw); xx++) {
        const lx = xx - x, ly = yy - y - sink, rx = x + sw - 1 - xx, by = y + rh - 1 - yy;
        // round off the corners, knock chips out of the edges, leave a dark joint
        if (lx + ly < 2 || rx + ly < 2 || lx + by < 2 || rx + by < 1) continue;
        if (rx === 0 || by === 0) continue;
        if ((ly === 0 || lx === 0) && hp(xx, yy, seed) < 0.15) continue;
        id[yy * w + xx] = n;
        const u = lx / sw, v = ly / rh;
        let l = 3.6 + tone - u * 1.2 - v * 1.4 + (ly === 0 ? 1.6 : 0) + (lx === 0 ? 0.9 : 0) + (by === 1 ? -1 : 0) + (bayer(xx, yy) - 0.5) * 0.7;
        if (hp(xx, yy, seed + 1) < 0.05) l -= 1.2;
        b.data[yy * w + xx] = pick(STONE, l);
      }
      x += sw;
      n++;
    }
    y += rh;
  }
  // the joints: dark, with moss and tiny ferns growing out of some
  for (let yy = 3; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if (id[yy * w + xx] >= 0) continue;
    b.data[yy * w + xx] = pick(EARTH, 0.6 + hp(xx, yy, seed + 2) * 1.2);
    if (hp(xx, yy, seed + 3) < 0.09) b.data[yy * w + xx] = pick(MOSS, 2 + hp(xx, yy, seed + 4) * 3);
  }
  // the turf over the top: a ragged overhang of earth, moss and grass blades
  for (let xx = 0; xx < w; xx++) {
    const t = Math.round(fbm1(xx * 0.15, 2, seed) * 3);
    for (let yy = 0; yy < 4 + t; yy++) b.set(xx, yy, yy < 2 + t * 0.5 ? pick(MOSS, 4 - yy * 0.5 + (bayer(xx, yy) - 0.5)) : pick(EARTH, 3 - (yy - 2) * 0.4));
    // roots hanging over the face
    if (hp(xx, 7, seed) < 0.05) { const len = 4 + Math.floor(hp(xx, 8, seed) * (h * 0.5)); for (let k = 0; k < len; k++) b.set(xx + (k > len / 2 && hp(xx, k, seed) < 0.3 ? 1 : 0), 4 + t + k, pick(ROOT, 1 + (k % 3 === 0 ? 1 : 0))); }
  }
  b.outline(hex('#100c08'));
  return { buf: b, ax: 0, ay: h - 1 };
}

/** a storage pit (rua) in the turf: a dark hole with crumbling lips, its back wall lit (anchor: surface row 2, centre) */
export function paintRuaPit(w: number, seed: number): { buf: PixelBuffer; ax: number; ay: number } {
  const H = 10, b = new PixelBuffer(w, H);
  for (let x = 0; x < w; x++) {
    const e = Math.min(x, w - 1 - x);
    const lip = 2 + (e < 3 ? 0 : Math.round(hp(x, 1, seed) * 1.4));
    const depth = e < 2 ? 0 : Math.min(H - lip, 2 + e * 1.2);
    for (let y = 1; y < H; y++) {
      let c: C;
      if (y <= lip || y > lip + depth) {
        if (y < 2 && e > 1) c = pick(MOSS, 3 + hp(x, y, seed) * 2);
        else if (y < lip + depth + 2 || y <= lip) c = pick(EARTH, 3.2 - (y - 1) * 0.2 + (bayer(x, y) - 0.5));
        else continue;
      } else {
        // the hole: the far wall catches a little light near its rim, the rest is dark
        const d = y - lip;
        c = d < 2 && x > w * 0.5 ? pick(EARTH, 3 - d) : pick(EARTH, 0.4 + (bayer(x, y) < 0.2 ? 0.6 : 0));
      }
      b.set(x, y, c);
    }
    // crumbs fallen from the lip, grass leaning over it
    if (e > 2 && hp(x, 3, seed) < 0.15) b.set(x, lip + 1, pick(EARTH, 3));
    if (hp(x, 4, seed) < 0.25 && (x < 4 || x > w - 5)) for (let k = 0; k < 3; k++) b.set(x + (x < 4 ? k > 1 ? 1 : 0 : k > 1 ? -1 : 0), 1 - k, pick(MOSS, 4 - k * 0.5));
  }
  return { buf: b, ax: Math.round(w / 2), ay: 2 };
}

/** the hearth: a ring of fire-blackened stones round ash and charcoal (anchor bottom centre) */
export function paintHearth(seed: number): { buf: PixelBuffer; ax: number; ay: number } {
  const rng = new Rng(seed);
  const W = 34, H = 9, b = new PixelBuffer(W, H);
  // ash and charcoal in the middle
  for (let x = 6; x < W - 6; x++) for (let y = H - 3; y < H; y++) {
    const h0 = hp(x, y, seed);
    b.set(x, y, h0 < 0.2 ? hex('#141010') : h0 < 0.35 ? hex('#2a2422') : h0 < 0.4 ? hex('#7a3a1a') : pick(STONE, 4 + h0 * 2));
  }
  // the stones: squat chipped blocks, sooty on their inner faces
  let x = 0;
  while (x < W - 3) {
    const sw = rng.int(4, 7), sh = rng.int(3, 6);
    const inner = x > 4 && x < W - 10;
    if (!(inner && rng.chance(0.5))) {
      for (let xx = x; xx < Math.min(W, x + sw); xx++) for (let yy = H - sh; yy < H; yy++) {
        const lx = xx - x, ly = yy - (H - sh), rx = x + sw - 1 - xx;
        if (lx + ly < 1 || rx + ly < 1) continue;
        let l = 3.6 - lx / sw * 1.4 + (ly === 0 ? 1.4 : 0) - (yy === H - 1 ? 1 : 0) + (bayer(xx, yy) - 0.5) * 0.6;
        if (inner || (x > W / 2 ? lx < 2 : rx < 2)) l -= 1.6;
        b.set(xx, yy, pick(STONE, l));
      }
    }
    x += sw + (rng.chance(0.3) ? 1 : 0);
  }
  b.outline(hex('#100c08'));
  return { buf: b, ax: W / 2, ay: H - 1 };
}

/** the collapsed stair: broken stone steps going down into the dark under a ragged lip (anchor top left) */
export function paintCollapsedStair(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  // the hole: its sides break away irregularly; dark below, darker with depth (dithered steps)
  // a funnel: wide at the lip, narrowing as it goes down, its foot dissolving into the earth
  const left = (y: number) => 2 + Math.round(fbm1(y * 0.15, 2, seed) * 6 + y * 0.3);
  const right = (y: number) => w - 3 - Math.round(fbm1(y * 0.15, 2, seed + 1) * 8 + y * 0.42);
  for (let y = 0; y < h; y++) for (let x = left(y); x <= right(y); x++) {
    const k = y / h;
    if (k > 0.6 && bayer(x, y) < (k - 0.6) * 2.5) continue;
    const e = Math.min(x - left(y), right(y) - x);
    b.set(x, y, e < 2 ? pick(EARTH, 2 - e) : bayer(x, y) < 0.5 - k * 0.6 ? hex('#1a140e') : hex('#080605'));
  }
  // the broken steps: five slabs going down and back, each chipped, the lower ones fading into the dark
  for (let i = 0; i < 5; i++) {
    const sx = 6 + i * 9, sy = 3 + i * 7, sw = 13 - (i === 2 ? 4 : 0);
    for (let x = sx; x < sx + sw; x++) for (let y = sy; y < sy + 4; y++) {
      const lx = x - sx, ly = y - sy, rx = sx + sw - 1 - x;
      if ((lx + ly < 1) || (rx + ly < 2 && hp(i, 0, seed) < 0.7) || (rx < 3 && ly > 1 && i === 3)) continue;
      const fade = i / 5;
      let l = (ly === 0 ? 6.4 : 4.2 - ly * 0.4) - lx / sw - fade * 2.4;
      if (bayer(x, y) < fade * 0.5) l -= 1;
      b.set(x, y, pick(STONE, l));
    }
    // moss on the top step or two
    if (i < 2) for (let x = sx + 1; x < sx + sw - 2; x++) if (hp(x, i, seed + 2) < 0.4) b.set(x, sy, pick(MOSS, 3 + hp(x, i, seed + 3) * 2));
  }
  // the lip: turf and earth overhanging the hole, roots hanging down into it
  for (let x = 0; x < w; x++) {
    const t = 2 + Math.round(hp(x >> 1, 1, seed) * 2);
    for (let y = 0; y < t; y++) b.set(x, y, y === 0 ? pick(MOSS, 4 + hp(x, 0, seed) * 1.5) : pick(EARTH, 3.4 - y * 0.6));
    if (hp(x, 2, seed) < 0.12 && x > 4 && x < w - 4) { const len = 3 + Math.floor(hp(x, 3, seed) * 16); for (let k = 0; k < len; k++) b.set(x + (k > len * 0.6 ? 1 : 0), t + k, pick(ROOT, 2 - (k / len) * 2)); }
  }
  return b;
}

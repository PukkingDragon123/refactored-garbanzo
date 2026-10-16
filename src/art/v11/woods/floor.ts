// V11 woods: the forest floor painter of Te Wao Nui (src/art/v11/forest/ground.ts), generalised for the
// other forest places (Fernwood Floor, Thunder Falls' bush): the ground plane from the walk line down
// toward the camera, painted per pixel in chunks: a trodden path under the walk line, moss carpets and
// leaf-litter drifts in perspective, roots snaking out from the trees, stones half sunk in humus,
// fern sprinkles, streams crossing the walk line and running off toward the camera over pebble beds,
// still pools; water pixels also go into a twin buffer so the renderer draws them as reflective water.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import { FP, pick } from '../forest/kit';

/** rows from the walk line up to the vanishing horizon (the forest's pinhole) */
export const WHOR = 80;
export const wpersp = (dd: number) => (WHOR + Math.max(0, dd)) / WHOR;
export const wrealZ = (dd: number) => Math.max(0, dd) / (WHOR + Math.max(0, dd));
export const wrowOf = (z: number) => (WHOR * z) / Math.max(1e-4, 1 - z);

export interface Channel {
  /** where it crosses the walk line, and how far around it to test */
  x: number; reach: number;
  /** centre x and half width at row dd in front of the walk line */
  at: (dd: number) => [number, number];
  rocky: boolean;
  seed: number;
}
export interface Pool { x: number; rx: number; dd: number; rdd: number; seed: number }
export interface WoodsFloor {
  /** walk line (with the water dips) and the walk line without them (the water surface) */
  ground: (x: number) => number;
  base: (x: number) => number;
  /** rows painted below the walk line */
  depth: number;
  channels: Channel[];
  pools?: Pool[];
  /** -1..1 more moss (wet gullies) or more litter (dry ridges) by x */
  moss?: (x: number) => number;
  /** 0..1 fern sprinkles and tiny seedlings in the moss */
  ferns?: (x: number) => number;
  /** red rātā blossom / gold litter tint by x (0..1) */
  blossom?: (x: number) => number;
  seed: number;
}
export interface WoodsChunk { x0: number; y0: number; base: PixelBuffer; water: PixelBuffer }

const dith = (x: number, y: number, k = 0.9) => (bayer(x, y) - 0.5) * k;
const CL = { r: 0, nx: 0, ny: 0 };
function cell(x: number, y: number, sx: number, sy: number, seed: number, fill: number): number {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let best = 9, id = -1;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hash2(cx, cy, seed);
    if (h > fill) continue;
    const px = (cx + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * sx, py = (cy + 0.2 + hash2(cx, cy, seed + 2) * 0.6) * sy;
    const rr = 0.3 + hash2(cx, cy, seed + 3) * 0.32;
    const dx = (x - px) / (sx * rr), dy = (y - py) / (sy * rr);
    const q = dx * dx + dy * dy;
    if (q < 1 && q < best) { best = q; id = h; CL.nx = dx; CL.ny = dy; }
  }
  CL.r = best;
  return id;
}

const OUT = { c: 0 as C, water: false };

function water(x: number, y: number, v: number, depth: number, near: number, seed: number) {
  // clear water over a pebble bed: dark in the channel, the bed showing through in the shallows
  let i = 6.4 - depth * 5;
  const pid = cell(x * 0.8, v, 3.6, 2.8, seed, 0.85);
  if (pid >= 0 && depth < 0.85) i += ((-CL.nx * 0.4 - CL.ny * 0.6) * 0.8 + (pid - 0.45) * 1.4) * (1 - depth) * near - (CL.r > 0.7 ? 0.7 : 0);
  let c = pick(FP.water, i + dith(x, y, 0.5));
  if (depth < 0.35) c = mix(c, hex('#5a4a2e'), (0.35 - depth) * 0.9);
  OUT.c = c; OUT.water = true;
}

function channel(F: WoodsFloor, x: number, y: number, dd: number, ch: Channel): boolean {
  const P = wpersp(dd);
  const [cx, hw] = ch.at(dd);
  const e = (x - cx) / hw, ae = Math.abs(e);
  if (ae > 2.4) return false;
  const v = wrealZ(dd) * 260;
  const wob = (noise1(dd / 4 + (e > 0 ? 50 : 0), ch.seed) - 0.5) * 0.14;
  const ee = ae - wob;
  if (ee < 1) {
    const depth = (1 - e * e) * (0.55 + 0.45 * smoothstep(0, 24, dd));
    water(x, y, v, depth, clamp(dd / 60, 0.2, 1), ch.seed + 5);
    return true;
  }
  // banks: dark wet earth at the waterline, moss and gravel, stones
  const b = (ee - 1) * hw / P;
  const reach = 6 + noise1(dd / 6 + (e > 0 ? 40 : 0), ch.seed + 7) * 6 + (ch.rocky ? 6 : 0);
  if (b > reach) return false;
  let c = b < 1 ? FP.soil[1] : pick(FP.soil, 2 + b * 0.35 + dith(x, y));
  const m = noise2(x / 5, v / 3, ch.seed + 9);
  if (m > 0.52 - b * 0.03) c = pick(FP.moss, 2 + (m - 0.5) * 9 + dith(x, y));
  if (b > 0.8 && b < reach * 0.8 && cell(x, v, ch.rocky ? 5 : 3.4, ch.rocky ? 3.6 : 2.6, ch.seed + 11, ch.rocky ? 0.6 : 0.35) >= 0) {
    c = pick(FP.stone, 3 + (1 - CL.r) * 3 + (-CL.nx * 0.4 - CL.ny * 0.6) * 2);
    if (CL.ny < -0.4 && hash2(x, y, ch.seed + 12) < 0.5) c = FP.moss[5];
  }
  OUT.c = c; OUT.water = b < 1.6;
  void F;
  return true;
}

/** a still pool in front of the walk line (> 0 inside) */
export function poolAt(p: Pool, x: number, dd: number) {
  const u = (x - p.x) / p.rx, w = (dd - p.dd) / p.rdd;
  return 1 - (u * u + w * w) - (noise1(x / 19, p.seed) - 0.5) * 0.2;
}

function floorPixel(F: WoodsFloor, x: number, y: number, d: number, dd: number) {
  const v = wrealZ(dd) * 300;
  const s = F.seed;
  // still pools: dark water with a mossy, stony rim
  for (const p of F.pools ?? []) {
    const e = poolAt(p, x, dd);
    if (e > 0.12) { water(x, y, v, clamp(e * 1.6, 0.2, 1), 1, p.seed); return; }
    if (e > -0.08) { OUT.c = e > 0.04 ? FP.soil[1] : pick(FP.moss, 3 + (noise2(x / 3, v / 2, p.seed) - 0.5) * 4 + dith(x, y)); OUT.water = e > 0.06; return; }
  }
  // the trodden path along the walk line
  if (d < 8 + noise1(x / 30, s + 421) * 5) {
    let c = pick(FP.soil, 6.6 - d * 0.18 + (fbm2(x / 8, y / 3, 2, s + 422) - 0.5) * 1.6 + dith(x, y));
    if (d < 1) c = pick(FP.moss, 4 + noise1(x / 3, s + 423) * 3);
    if (Math.abs(Math.sin(x * 0.07 + noise1(x / 40, s + 424) * 4)) < 0.05 && noise1(x / 90, s + 425) > 0.5) c = d < 3 ? FP.podo[6] : FP.podo[4];
    OUT.c = c; OUT.water = false;
    return;
  }
  // moss carpets and leaf litter drifts
  const moss = fbm2(x / 26, v / 11, 3, s + 431) + (F.moss ? F.moss(x) * 0.18 : 0);
  let c: C;
  if (moss > 0.6) {
    const t = (moss - 0.6) * 6;
    c = pick(FP.moss, 3.6 + t * 2.6 + (noise2(x / 1.7, v / 1.2, s + 432) - 0.5) * 1.8 + dith(x, y));
    if (hash2(x, y, s + 433) < 0.025) c = FP.moss[8];
    if (hash2(x >> 1, Math.floor(v), s + 434) < 0.02 + (F.ferns ? F.ferns(x) * 0.05 : 0)) c = FP.fern[7];
  } else {
    c = pick(FP.soil, 4.9 + (noise2(x / 6, v / 4, s + 435) - 0.5) * 2 + dith(x, y));
    const drift = noise2(x / 14 + 40, v / 7, s + 436);
    const lid = drift < 0.22 ? -1 : cell(x * 1.2, v * 1.6, 2.7, 1.7, s + 437, 0.08 + drift * drift * 0.75);
    if (lid >= 0 && CL.r < 0.9) {
      c = shade(pick(FP.litter, 1 + lid * 7), -0.08);
      if (CL.ny < -0.3) c = shade(c, 0.14);
      if (CL.r > 0.6) c = shade(c, -0.15);
      if (F.blossom && lid < 0.18 * F.blossom(x)) c = pick(FP.red, 3 + (CL.ny < 0 ? 2 : 0));
    }
    // fern sprinkles on the bare litter (crown fern sporelings, kidney ferns)
    if (F.ferns && hash2(x >> 1, Math.floor(v * 0.7), s + 438) < F.ferns(x) * 0.035) c = pick(FP.fern, 5 + (hash2(x, y, s + 439) - 0.5) * 4);
  }
  // roots snaking toward the camera
  if (d < 80 && noise1(x / 26, s + 441) > 0.4) {
    const root = Math.abs(Math.sin(x * 0.09 + fbm2(x / 40, v / 30, 2, s + 442) * 7));
    if (root < 0.05) c = root < 0.022 ? FP.podo[6] : FP.podo[2];
  }
  // stones half sunk in the humus
  if (cell(x, v, 19, 12, s + 443, 0.05) >= 0) {
    const l = -CL.nx * 0.4 - CL.ny * 0.6 + (1 - CL.r) * 0.4;
    c = pick(FP.stone, 3 + l * 3);
    if (CL.ny < -0.35 && hash2(x, y, s + 444) < 0.6) c = FP.moss[5];
  }
  if (dd > 80) c = shade(c, -smoothstep(80, 200, dd) * 0.22);
  OUT.c = c; OUT.water = false;
}

/** moss and grass blades poking up over the walk line */
function lipPixel(F: WoodsFloor, x: number, d: number): boolean {
  const h = noise1(x * 0.9, F.seed + 451) * 3 + noise1(x / 7, F.seed + 452) * 1.6;
  if (-d > h) return false;
  OUT.c = pick(FP.moss, 4.5 + d * 0.4 + noise1(x * 1.3, F.seed + 453) * 2.5);
  OUT.water = false;
  return true;
}

/** Paint the floor for world x in [x0, x0 + w). */
export function paintWoodsFloor(F: WoodsFloor, x0: number, w: number): WoodsChunk {
  let minTop = 1e9, maxTop = -1e9;
  for (let x = x0; x < x0 + w; x++) { const t = F.ground(x); minTop = Math.min(minTop, t); maxTop = Math.max(maxTop, t); }
  const y0 = Math.floor(minTop) - 6;
  const h = Math.ceil(maxTop + F.depth - y0);
  const base = new PixelBuffer(w, h), wat = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const top = Math.round(F.ground(x));
    const wl = F.base(x);
    const bot = Math.round(F.ground(x)) + F.depth;
    for (let y = top - 4; y < bot; y++) {
      if (y < y0) continue;
      const d = y - top, dd = y - wl;
      OUT.c = 0;
      let ok = false;
      for (const ch of F.channels) {
        if (Math.abs(x - ch.x) > ch.reach || dd <= -2) continue;
        if (channel(F, x, y, Math.max(0, dd), ch)) { ok = true; break; }
      }
      if (!ok && d < 0) { if (!lipPixel(F, x, d)) continue; ok = true; }
      if (!ok) floorPixel(F, x, y, d, Math.max(0, dd));
      const i = (y - y0) * w + (x - x0);
      base.data[i] = OUT.c;
      if (OUT.water) wat.data[i] = OUT.c;
    }
  }
  return { x0, y0, base, water: wat };
}

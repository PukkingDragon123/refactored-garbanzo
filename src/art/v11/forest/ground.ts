// V11 Te Wao Nui, the forest floor: the ground plane from the walk line down toward the camera,
// painted per pixel in chunks. A trodden path under the walk line; moss carpets and leaf-litter
// drifts in perspective; roots snaking out of the trees; stones half sunk in humus; the stream
// coming down to the ford and running off toward the camera over a pebble bed; the gully's creek
// between wet rocks; and the mud wallows, glossy, churned with hoof and claw prints. Water and mud
// pixels also go into their own buffers so the renderer can draw them again as reflective material.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import { FP, pick } from './kit';
import {
  FOREST, FORD, GULLY, MUD, WALLOWS, fgroundY, baseY, persp, realZ, fordAt, creekAt, fzoneAt,
} from '../../../game/v11/forest/layout';

export interface FGroundChunk { x0: number; y0: number; base: PixelBuffer; water: PixelBuffer; mud: PixelBuffer }

const dith = (x: number, y: number, k = 0.9) => (bayer(x, y) - 0.5) * k;

/** jittered grid cells (pebbles, leaves): the cell id hash or -1, CL.r = normalised distance */
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

const OUT = { c: 0 as C, water: false, mud: false };

/** the mud wallow pools in front of the walk line (> 0 inside a pool, how deep) */
export function mudPoolAt(x: number, dd: number): number {
  if (x < MUD.x0 || x > MUD.x1 || dd < 2) return -1;
  const zone = smoothstep(MUD.x0, MUD.x0 + 80, x) * (1 - smoothstep(MUD.x1 - 80, MUD.x1, x));
  const v = realZ(dd) * 220;
  const n = fbm2(x / 46, v / 16, 3, 401) + (noise2(x / 9, v / 5, 402) - 0.5) * 0.12;
  // pools strung along the wallows, fading out toward the camera
  let on = 0;
  for (const [a, b] of WALLOWS) on = Math.max(on, smoothstep(a - 40, a + 30, x) * (1 - smoothstep(b - 30, b + 40, x)));
  return (n - 0.5 + on * 0.16 - smoothstep(50, 150, dd) * 0.22) * zone;
}

function water(x: number, y: number, e: number, v: number, depth: number, near: number, seed: number) {
  // clear water over a pebble bed: dark in the channel, the bed showing through in the shallows
  let i = 6.4 - depth * 5;
  const pid = cell(x * 0.8, v, 3.6, 2.8, seed, 0.85);
  if (pid >= 0 && depth < 0.85) i += ((-CL.nx * 0.4 - CL.ny * 0.6) * 0.8 + (pid - 0.45) * 1.4) * (1 - depth) * near - (CL.r > 0.7 ? 0.7 : 0);
  let c = pick(FP.water, i + dith(x, y, 0.5));
  // tea-coloured tannins from the leaf litter warm the shallows
  if (depth < 0.35) c = mix(c, hex('#5a4a2e'), (0.35 - depth) * 0.9);
  if (Math.abs(e) > 0.9 && bayer(x, y) < (Math.abs(e) - 0.9) * 10) c = FP.water[8];
  OUT.c = c; OUT.water = true; OUT.mud = false;
}

/** the stream and the creek: water inside the channel, wet banks around it */
function channel(x: number, y: number, dd: number, cx: number, hw: number, seed: number, rocky: boolean): boolean {
  const P = persp(dd);
  const e = (x - cx) / hw, ae = Math.abs(e);
  if (ae > 2.4) return false;
  const v = realZ(dd) * 260;
  const wob = (noise1(dd / 4 + (e > 0 ? 50 : 0), seed) - 0.5) * 0.14;
  const ee = ae - wob;
  if (ee < 1) {
    const depth = (1 - e * e) * (0.55 + 0.45 * smoothstep(0, 24, dd));
    water(x, y, e, v, depth, clamp(dd / 60, 0.2, 1), seed + 5);
    return true;
  }
  // banks: dark wet earth at the waterline, moss and gravel, roots dipping in
  const b = (ee - 1) * hw / P;
  const reach = 6 + noise1(dd / 6 + (e > 0 ? 40 : 0), seed + 7) * 6 + (rocky ? 6 : 0);
  if (b > reach) return false;
  let c = b < 1 ? FP.soil[1] : pick(FP.soil, 2 + b * 0.35 + dith(x, y));
  const m = noise2(x / 5, v / 3, seed + 9);
  if (m > 0.52 - b * 0.03) c = pick(FP.moss, 2 + (m - 0.5) * 9 + dith(x, y));
  if (b > 0.8 && b < reach * 0.8 && cell(x, v, rocky ? 5 : 3.4, rocky ? 3.6 : 2.6, seed + 11, rocky ? 0.6 : 0.35) >= 0) {
    c = pick(FP.stone, 3 + (1 - CL.r) * 3 + (-CL.nx * 0.4 - CL.ny * 0.6) * 2);
    if (CL.ny < -0.4 && hash2(x, y, seed + 12) < 0.5) c = FP.moss[5];
  }
  OUT.c = c; OUT.water = b < 1.6; OUT.mud = false;
  return true;
}

/** the mud wallows: on the walk line and in pools in front of it */
function mudPixel(x: number, y: number, d: number, dd: number): boolean {
  const onLine = d < 10 ? WALLOWS.some(([a, b]) => x > a + 6 && x < b - 6) : false;
  const pool = mudPoolAt(x, dd);
  if (!onLine && pool <= -0.06) return false;
  const v = realZ(dd) * 220;
  if (pool > 0 || onLine) {
    // glossy mud: darkest in the middle, a sheen of standing water, prints and drag marks
    const k = onLine ? 0.5 : clamp(pool * 6, 0, 1);
    let i = 4.6 - k * 3 + (noise2(x / 7, v / 3, 411) - 0.5) * 1.6;
    const pr = cell(x * 1.1, v * 1.6, 7, 4.4, 413, 0.34);
    if (pr >= 0 && CL.r < 0.7) i -= 1.4;
    let c = pick(FP.mud, i + dith(x, y, 0.6));
    if (noise2(x / 16, v / 4, 415) > 0.66) c = mix(c, FP.water[3], 0.35);
    OUT.c = c; OUT.water = false; OUT.mud = true;
    return true;
  }
  // the churned rim around a pool: lumps of mud, crushed fern, puddles in prints
  const t = (pool + 0.06) / 0.06;
  let c = pick(FP.mud, 5 + t * 1.5 + (noise2(x / 3, v / 2, 417) - 0.5) * 2 + dith(x, y));
  if (cell(x, v * 1.4, 4.4, 2.8, 419, 0.3) >= 0 && CL.r < 0.6) c = FP.mud[1];
  OUT.c = c; OUT.water = false; OUT.mud = t < 0.4;
  return true;
}

function floorPixel(x: number, y: number, d: number, dd: number) {
  const v = realZ(dd) * 300;
  const zone = fzoneAt(x);
  // the trodden path along the walk line
  if (d < 8 + noise1(x / 30, 421) * 5) {
    let c = pick(FP.soil, 6.6 - d * 0.18 + (fbm2(x / 8, y / 3, 2, 422) - 0.5) * 1.6 + dith(x, y));
    if (d < 1) c = pick(FP.moss, 4 + noise1(x / 3, 423) * 3);
    // roots worn smooth by feet
    if (Math.abs(Math.sin(x * 0.07 + noise1(x / 40, 424) * 4)) < 0.05 && noise1(x / 90, 425) > 0.5) c = d < 3 ? FP.podo[6] : FP.podo[4];
    if (zone === 'edge' && x < 260 && noise2(x / 6, y / 3, 426) > 0.58) c = mix(c, hex('#b8a27a'), 0.45); // beach sand carried in on feet
    OUT.c = c; OUT.water = false; OUT.mud = false;
    return;
  }
  // moss carpets and leaf litter drifts
  const moss = fbm2(x / 26, v / 11, 3, 431) + (zone === 'gully' ? 0.12 : zone === 'rata' ? 0.06 : 0);
  let c: C;
  if (moss > 0.6) {
    const t = (moss - 0.6) * 6;
    c = pick(FP.moss, 3.6 + t * 2.6 + (noise2(x / 1.7, v / 1.2, 432) - 0.5) * 1.8 + dith(x, y));
    if (hash2(x, y, 433) < 0.025) c = FP.moss[8];
    // tiny ferns and liverworts in the moss
    if (hash2(x >> 1, Math.floor(v), 434) < 0.02) c = FP.fern[7];
  } else {
    c = pick(FP.soil, 4.9 + (noise2(x / 6, v / 4, 435) - 0.5) * 2 + dith(x, y));
    const drift = noise2(x / 14 + 40, v / 7, 436);
    const lid = drift < 0.22 ? -1 : cell(x * 1.2, v * 1.6, 2.7, 1.7, 437, 0.08 + drift * drift * 0.75);
    if (lid >= 0 && CL.r < 0.9) {
      c = shade(pick(FP.litter, 1 + lid * 7), -0.08);
      if (CL.ny < -0.3) c = shade(c, 0.14);
      if (CL.r > 0.6) c = shade(c, -0.15);
      // rātā blossom fallen on the floor of the grove
      if (zone === 'rata' && lid < 0.18) c = pick(FP.red, 3 + (CL.ny < 0 ? 2 : 0));
    }
  }
  // roots snaking toward the camera from the trees on the walk line
  if (d < 80 && noise1(x / 26, 441) > 0.4) {
    const root = Math.abs(Math.sin(x * 0.09 + fbm2(x / 40, v / 30, 2, 442) * 7));
    if (root < 0.05) c = root < 0.022 ? FP.podo[6] : FP.podo[2];
  }
  // stones half sunk in the humus
  if (cell(x, v, 19, 12, 443, 0.05) >= 0) {
    const l = -CL.nx * 0.4 - CL.ny * 0.6 + (1 - CL.r) * 0.4;
    c = pick(FP.stone, 3 + l * 3);
    if (CL.ny < -0.35 && hash2(x, y, 444) < 0.6) c = FP.moss[5];
  }
  // shade deepening toward the camera, under the foreground ferns
  if (dd > 80) c = shade(c, -smoothstep(80, 200, dd) * 0.22);
  OUT.c = c; OUT.water = false; OUT.mud = false;
}

/** moss and grass blades poking up over the walk line (rows just above it) */
function lipPixel(x: number, d: number): boolean {
  const h = noise1(x * 0.9, 451) * 3 + noise1(x / 7, 452) * 1.6;
  if (-d > h) return false;
  OUT.c = pick(FP.moss, 4.5 + d * 0.4 + noise1(x * 1.3, 453) * 2.5);
  OUT.water = false; OUT.mud = false;
  return true;
}

/** Paint the forest floor for world x in [x0, x0 + w). */
export function paintForestGround(x0: number, w: number): FGroundChunk {
  let minTop = 1e9;
  for (let x = x0; x < x0 + w; x++) minTop = Math.min(minTop, fgroundY(x));
  const y0 = Math.floor(minTop) - 6;
  const h = FOREST.BOT - y0;
  const base = new PixelBuffer(w, h), wat = new PixelBuffer(w, h), mud = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const top = Math.round(fgroundY(x));
    const wl = baseY(x);
    for (let y = top - 4; y < FOREST.BOT; y++) {
      const d = y - top;
      if (y < y0) continue;
      const dd = y - wl;
      OUT.c = 0;
      let ok = false;
      if (Math.abs(x - FORD.x) < 140) { const [cx, hw] = fordAt(Math.max(0, dd)); if (dd > -2) ok = channel(x, y, Math.max(0, dd), cx, hw, 461, false); }
      if (!ok && Math.abs(x - GULLY.x) < 150) { const [cx, hw] = creekAt(Math.max(0, dd)); if (dd > -2) ok = channel(x, y, Math.max(0, dd), cx, hw, 471, true); }
      if (!ok && x > MUD.x0 - 40 && x < MUD.x1 + 40) ok = mudPixel(x, y, d, Math.max(0, dd));
      if (!ok && d < 0) { if (!lipPixel(x, d)) continue; ok = true; }
      if (!ok) floorPixel(x, y, d, Math.max(0, dd));
      const i = (y - y0) * w + (x - x0);
      base.data[i] = OUT.c;
      if (OUT.water) wat.data[i] = OUT.c;
      if (OUT.mud) mud.data[i] = OUT.c;
    }
  }
  return { x0, y0, base, water: wat, mud };
}

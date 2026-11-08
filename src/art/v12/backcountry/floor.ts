// V12 Te Tuawhenua, the ground plane: from the walk line down toward the camera, painted per pixel in
// 1000 px chunks, in perspective (rows bunch up at the walk line and spread out toward the camera, so
// every texture is laid out in real depth and foreshortens on its own). Each stretch has its own
// ground and they dissolve into each other through a dithered, noise-warped boundary, never a seam:
//
//   the kānuka scrub   dry thatch, bare dusty earth, the shrubs' papery litter, lichen crust, stones
//   the river flats    sorted river cobbles (blue-grey greywacke, white quartz, the odd warm stone),
//                      sand with ripple marks, silt on the banks, the braids of milky water running
//                      off toward the camera and splitting around the bars
//   the burnt ridge    ash, charcoal chunks with a silver sheen, scorched red earth, white flecks,
//                      charred twigs, the first green sprigs of the regrowth
//   the fern gully     moss carpets and leaf litter, fern sprinkles, roots, dark wet soil, the creek
//   the tussock        a field of tussock clumps in perspective, peat and herbs between them
//   the claw gorge     bedded rock pavement split by fractures, scree in the gaps, moss in the cracks
//
// A trodden footpad runs along the walk line; the animals' signs are pressed into the ground: the
// feathered boa's drag trail across the gravel, the Bearer's prints (four toes and the one great hooked
// claw scoring ahead of the inner toe) in the gravel and the ash. Water pixels go into a twin buffer
// so the renderer draws them as reflective water.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import { wpersp, wrealZ } from '../../v11/woods/floor';
import type { Channel } from '../../v11/woods/floor';
import { FP } from '../../v11/forest/kit';
import { HP } from '../../v11/hills/kit';
import { TP, pick, hp, dz, cell, CL, vgrid } from './kit';
import { TUA, bioPick, tuaBase, tuaGround } from '../../../game/v12/backcountry/gen';
import type { Biome, Stream, Braid } from '../../../game/v12/backcountry/gen';

/** rows painted below the walk line */
export const TUA_DEPTH = 172;

// ---------------------------------------------------------------- the streams in perspective
/** a stream's centre and half width at row dd in front of the walk line */
export function streamAt(s: Stream, dd: number): [number, number] {
  const z = wrealZ(dd), P = wpersp(dd);
  const wig = s.kind === 'braid' ? 16 : 10;
  return [s.x + (Math.sin(z * 7 + s.seed) * wig + z * 160 * s.skew) * P, s.hw * P * (1 + (noise1(dd / 7, s.seed) - 0.5) * 0.34) + 6 * Math.exp(-(((dd - 6) / 9) ** 2))];
}
function braidAt(b: Braid, dd: number): [number, number] {
  const z = wrealZ(dd), P = wpersp(dd);
  const grow = smoothstep(b.dd0, b.dd0 + 34, dd);
  return [b.x + (Math.sin(z * 6 + b.seed) * 14 + z * 190 * b.skew) * P, b.hw * P * grow * (1 + (noise1(dd / 6, b.seed) - 0.5) * 0.4)];
}
/** the streams as woods-kit channels (the glints that run down them use these) */
export function tuaChannels(): Channel[] {
  return TUA.streams.map(s => ({ x: s.x, reach: s.hw * 3 + 160, rocky: s.kind !== 'creek', seed: s.seed, at: (dd: number) => streamAt(s, dd) }));
}

const OUT = { c: 0 as C, water: false };
const RIVER_DEEP = hex('#0d2a30');

function water(x: number, y: number, v: number, depth: number, kind: Stream['kind'], seed: number) {
  // milky blue braids over a cobble bed, the creek dark as tea, the gorge stream clear and green
  const ramp = kind === 'creek' ? TP.creek : TP.river;
  let i = (kind === 'creek' ? 5.6 : 8.6) - depth * (kind === 'creek' ? 4.4 : 6.4);
  const pid = cell(x * 0.8, v, 3.4, 2.4, seed, 0.8);
  if (pid >= 0 && depth < 0.8) i += ((-CL.nx * 0.4 - CL.ny * 0.6) * 0.9 + (pid - 0.45) * 1.4) * (1 - depth) - (CL.r > 0.7 ? 0.8 : 0);
  // ripples: bright crests across the current, broken up
  const rip = Math.sin(v * 1.9 + noise1(x / 5, seed) * 5 + x * 0.12);
  if (rip > 0.86 && hp(x, y, seed + 3) < 0.6) i += 1.4;
  let c = pick(ramp, i + dz(x, y, 0.5));
  if (kind !== 'creek' && depth > 0.75) c = mix(c, RIVER_DEEP, (depth - 0.75) * 1.2);
  OUT.c = c; OUT.water = true;
}

function bank(x: number, y: number, v: number, b: number, reach: number, kind: Stream['kind'], seed: number) {
  // wet stones at the waterline, a fringe of silt and sand, then the bar's dry cobbles
  let c: C;
  if (kind === 'creek') {
    c = b < 1.2 ? FP.mud[2] : pick(FP.soil, 2.4 + b * 0.3 + dz(x, y));
    if (noise2(x / 5, v / 3, seed + 9) > 0.5 - b * 0.03) c = pick(FP.moss, 3 + noise2(x / 2, v, seed) * 3 + dz(x, y));
  } else {
    const id = cell(x, v, 4.6, 2.8, seed + 11, 0.85, 0.5);
    const wet = b < reach * 0.45;
    if (id >= 0 && CL.r < 0.92) {
      const l = -CL.nx * 0.5 - CL.ny * 0.8;
      c = pick(TP.gravel, (wet ? 3 : 5) + l * 1.8 + (id - 0.5) * 2.4 + dz(x, y, 0.6) - (CL.r > 0.7 ? 1.4 : 0));
      if (wet && CL.ny < -0.5) c = pick(TP.gravel, 7 + l);
    } else c = wet ? pick(TP.sand, 1.6 + noise1(x / 3, seed) * 1.4 + dz(x, y)) : pick(TP.silt, 1.2 + noise2(x / 4, v / 2, seed) * 2.4 + dz(x, y));
  }
  OUT.c = c; OUT.water = b < 1.1;
}

/** stream or bank at this pixel? */
function streams(x: number, y: number, dd: number, v: number): boolean {
  for (const s of TUA.streams) {
    if (Math.abs(x - s.x) > s.hw * 3 + 170) continue;
    const [cx, hw] = streamAt(s, dd);
    const P = wpersp(dd);
    const e = (x - cx) / hw, ae = Math.abs(e);
    if (ae > 3) continue;
    const wob = (noise1(dd / 4 + (e > 0 ? 50 : 0), s.seed) - 0.5) * 0.16;
    const ee = ae - wob;
    if (ee < 1) {
      const depth = (1 - e * e) * (0.5 + 0.5 * smoothstep(0, 22, dd)) * (s.kind === 'braid' ? 0.5 + s.depth / 14 : 1);
      water(x, y, v, depth, s.kind, s.seed + 5);
      return true;
    }
    const b = (ee - 1) * hw / P;
    const reach = (s.kind === 'braid' ? 12 : 7) + noise1(dd / 6 + (e > 0 ? 40 : 0), s.seed + 7) * 7;
    if (b > reach) continue;
    bank(x, y, v, b, reach, s.kind, s.seed);
    return true;
  }
  for (const br of TUA.braids) {
    if (dd < br.dd0 || Math.abs(x - br.x) > 220) continue;
    const [cx, hw] = braidAt(br, dd);
    if (hw < 0.6) continue;
    const e = Math.abs(x - cx) / hw - (noise1(dd / 4, br.seed) - 0.5) * 0.2;
    if (e < 1) { water(x, y, v, (1 - e * e) * 0.55, 'braid', br.seed); return true; }
    const b = (e - 1) * hw / wpersp(dd);
    if (b < 8) { bank(x, y, v, b, 8, 'braid', br.seed); return true; }
  }
  return false;
}

// ---------------------------------------------------------------- the animals' signs in the ground
/** -1 none, else how deep the sign is pressed (0..1); SIGN.lit: the trough's lit edge */
const SIGN = { k: 0, lit: 0 };
function signs(x: number, dd: number, v: number): boolean {
  for (const t of TUA.tracks) {
    if (Math.abs(x - t.x) > 150 || dd < 4) continue;
    const P = wpersp(dd), z = wrealZ(dd);
    if (t.kind === 'boa') {
      // a smooth, sinuous trough as wide as a man's chest, crossing toward the camera
      const cx = t.x + (Math.sin(z * 11 + t.seed) * 26 + z * 60) * P, hw = 6.5 * P;
      const e = (x - cx) / hw;
      if (Math.abs(e) > 1.5 || dd > t.len) continue;
      SIGN.k = Math.abs(e) < 1 ? 1 - e * e * 0.6 : 0;
      SIGN.lit = Math.abs(e) >= 1 ? (e < 0 ? -1 : 1) : e < -0.6 ? 0.5 : e > 0.6 ? -0.5 : 0;
      return true;
    }
    // the Bearer's prints: big pads in a walking line, four toes, and one huge hooked claw scoring the
    // ground ahead of the inner toe
    const stride = 15;
    const k = Math.round(v / stride);
    if (k < 1 || k * stride > wrealZ(t.len) * 300) continue;
    const pv = k * stride;
    const side = k % 2 ? 1 : -1;
    const ddp = (80 * (pv / 300)) / Math.max(0.05, 1 - pv / 300);
    const Pp = wpersp(ddp);
    const cx = t.x + (side * 7 + (pv / 300) * 30) * Pp;
    const ux = (x - cx) / Pp, uv = (v - pv) * 1.6;
    // the pad: a broad kidney
    const pad = (ux / 5.2) ** 2 + (uv / 3) ** 2;
    if (pad < 1) { SIGN.k = 0.9; SIGN.lit = uv < -2 ? 0.6 : 0; return true; }
    // four toes in an arc ahead of the pad
    for (let i = 0; i < 4; i++) {
      const tx = (i - 1.5) * 3.2 * side, tv = -4.6 - (i === 1 || i === 2 ? 1 : 0);
      if ((ux - tx) ** 2 / 2.6 + (uv - tv) ** 2 / 2.2 < 1) { SIGN.k = 0.8; SIGN.lit = 0; return true; }
    }
    // the hooked claw: a long gouge raked forward from the inner toe
    const gx = -1.5 * 3.2 * side;
    if (uv < -6 && uv > -15 && Math.abs(ux - gx - (uv + 6) * 0.18 * side) < 0.9) { SIGN.k = 1; SIGN.lit = -1; return true; }
  }
  return false;
}


// ---------------------------------------------------------------- noise fields, per chunk
// (coarse value-noise lattices in place of noise2 / fbm2 per pixel: the floor is 14,000 px of it)
type Fn2 = (x: number, y: number) => number;
let FLD: (Fn2 | undefined)[] = [];
let FX0 = 0, FW = 0;
function N2(x: number, y: number, cx: number, cy: number, seed: number): number {
  let f = FLD[seed - 500];
  if (!f) f = FLD[seed - 500] = vgrid(FX0, FW, -8, 330, cx, cy, seed, 40);
  return f(x, y);
}
function F2(x: number, y: number, cx: number, cy: number, seed: number): number {
  let f = FLD[seed - 500], g = FLD[seed - 400], q = FLD[seed - 300];
  if (!f) f = FLD[seed - 500] = vgrid(FX0, FW, -8, 330, cx, cy, seed, 40);
  if (!g) g = FLD[seed - 400] = vgrid(FX0, FW, -8, 330, cx * 0.47, cy * 0.47, seed + 31, 40);
  if (!q) q = FLD[seed - 300] = vgrid(FX0, FW, -8, 330, Math.max(1.5, cx * 0.2), Math.max(1, cy * 0.2), seed + 57, 40);
  // (three octaves: the patches' edges come out ragged, never boxy)
  return f(x, y) * 0.56 + g(x, y) * 0.28 + q(x, y) * 0.16;
}

// ---------------------------------------------------------------- the stretches' ground
function scrubPx(x: number, y: number, dd: number, v: number, far: number): C {
  const big = F2(x, v, 44, 18, 501), mid = N2(x, v, 9, 5, 502);
  let c = pick(TP.dust, 2.8 + (mid - 0.5) * 2.4 + far + dz(x, y));
  if (big > 0.5) {
    // dry thatch: straw clumps lit on top
    const id = cell(x, v, 5.5, 3.2, 503, 0.85);
    if (id >= 0) c = pick(id > 0.8 ? HP.tussockDry : HP.tussock, 2.6 + clamp(-CL.ny * 0.5 + 0.5) * 3.6 + (hp(x, Math.floor(id * 99), 504) > 0.5 ? 0.6 : -0.5) + far + dz(x, y, 0.5) - (CL.r > 0.7 ? 1.2 : 0));
  } else if (big < 0.36) {
    // the kānuka's papery litter
    const id = cell(x * 1.3, v * 1.7, 2.5, 1.6, 505, 0.4);
    if (id >= 0 && CL.r < 0.85) c = pick(id < 0.5 ? TP.kpaper : TP.kbark, 1.4 + id * 3 + (CL.ny < -0.3 ? 1 : 0) + far);
  }
  // lichen crust, a few stones
  if (F2(x, v, 30, 12, 506) > 0.68 && hp(x, y, 507) < 0.7) c = pick(TP.lichen, 1.6 + mid * 2 + dz(x, y));
  if (cell(x, v, 17, 9, 508, 0.045, 0.5) >= 0) { const l = -CL.nx * 0.45 - CL.ny * 0.75; c = pick(TP.rockWarm, 5 + l * 2.6 + (CL.r > 0.7 ? -1.2 : 0)); }
  return c;
}
function flatsPx(x: number, y: number, dd: number, v: number, far: number): C {
  const sand = F2(x, v, 64, 26, 511);
  if (sand < 0.34) {
    // river sand, rippled by the last flood
    const rip = Math.sin(x * 0.22 + v * 0.5 + noise1(x / 30, 512) * 6);
    return pick(TP.sand, 4.2 + (rip > 0.6 ? 1 : rip < -0.7 ? -0.8 : 0) + (N2(x, v, 6, 3, 513) - 0.5) * 1.4 + far + dz(x, y));
  }
  // cobbles, sorted by the water: bigger toward the camera (they're laid out in real depth)
  const id = cell(x, v, 6.4, 3.6, 514, 0.92, 0.45);
  let c: C;
  if (id >= 0 && CL.r < 0.96) {
    const l = -CL.nx * 0.5 - CL.ny * 0.85;
    const ramp = id > 0.93 ? TP.quartz : id < 0.12 ? TP.rockWarm : TP.gravel;
    c = pick(ramp, (ramp === TP.quartz ? 1.6 : ramp === TP.rockWarm ? 4.6 : 5.2) + l * (ramp === TP.quartz ? 0.8 : 1.9) + (id - 0.5) * 2 + far + dz(x, y, 0.5) - (CL.r > 0.72 ? 1.6 : 0));
    if (CL.ny < -0.55 && CL.nx < 0 && CL.r < 0.5 && hp(x, y, 515) < 0.3) c = pick(TP.gravel, 9);
  } else {
    const g = cell(x + 2, v + 1, 2.4, 1.5, 516, 0.6);
    c = g >= 0 ? pick(TP.gravel, 3.2 + (1 - CL.r) * 2 - CL.ny + far) : pick(TP.sand, 1.6 + N2(x, v, 3, 1, 517) * 1.6 + far + dz(x, y));
  }
  // patches of moss and clover on the old bars, away from the water
  if (sand > 0.7 && F2(x, v, 26, 10, 518) > 0.62) c = pick(FP.moss, 3.2 + (N2(x, v, 2, 1, 519) - 0.5) * 3 + far + dz(x, y));
  return c;
}
function burntPx(x: number, y: number, dd: number, v: number, far: number): C {
  const mid = N2(x, v, 8, 4, 521), big = F2(x, v, 50, 20, 522);
  let c = pick(TP.ash, 3.2 + (mid - 0.5) * 2.6 + far + dz(x, y));
  // scorched red earth where the fire burned hottest
  if (big > 0.66) c = pick(big > 0.72 ? TP.ember : TP.earth, (big > 0.72 ? 1.2 : 3) + (mid - 0.5) * 2 + dz(x, y));
  // charcoal: chunks with a silver sheen on their lit faces
  const id = cell(x, v, 4.4, 2.6, 523, 0.42, 0.6);
  if (id >= 0 && CL.r < 0.9) {
    c = pick(TP.char, 2.6 + (-CL.nx * 0.4 - CL.ny * 0.6) * 2.4 + far);
    if (CL.ny < -0.45 && CL.nx < 0.2 && hp(x, y, 524) < 0.55) c = pick(TP.charSheen, 1 + hp(x, y, 525) * 2);
  }
  // charred twigs lying in the ash
  if (Math.abs(Math.sin(x * 0.11 + F2(x, v, 30, 16, 526) * 7)) < 0.035 && noise1(x / 50, 527) > 0.45) c = TP.char[2];
  // white ash flecks, the first green of the regrowth
  if (hp(x, y, 528) < 0.03) c = pick(TP.ash, 8 + hp(x, y, 529) * 2);
  const green = F2(x, v, 34, 13, 530);
  if (green > 0.6 && hp(x >> 1, Math.floor(v * 0.8), 531) < (green - 0.6) * 2.2) c = pick(TP.bracken, 3.6 + hp(x, y, 532) * 3 + far);
  return c;
}
function boaPx(x: number, y: number, d: number, dd: number, v: number, far: number): C {
  const moss = F2(x, v, 24, 10, 541) + 0.12;
  let c: C;
  if (moss > 0.56) {
    const t = (moss - 0.56) * 6;
    c = pick(FP.moss, 3.4 + t * 2.4 + (N2(x, v, 1.7, 1.2, 542) - 0.5) * 1.8 + far + dz(x, y));
    if (hash2(x, y, 543) < 0.025) c = FP.moss[8];
    if (hash2(x >> 1, Math.floor(v), 544) < 0.06) c = FP.fern[6 + (hp(x, y, 545) < 0.4 ? 1 : 0)];
  } else {
    c = pick(FP.soil, 4.4 + (N2(x, v, 6, 4, 546) - 0.5) * 2 + far + dz(x, y));
    const drift = N2(x, v, 14, 7, 547);
    const lid = drift < 0.24 ? -1 : cell(x * 1.2, v * 1.6, 2.7, 1.7, 548, 0.1 + drift * drift * 0.7);
    if (lid >= 0 && CL.r < 0.9) { c = shade(pick(FP.litter, 1 + lid * 6), -0.12); if (CL.ny < -0.3) c = shade(c, 0.12); }
    if (hash2(x >> 1, Math.floor(v * 0.7), 549) < 0.04) c = pick(FP.fern, 5 + (hp(x, y, 550) - 0.5) * 4);
  }
  // roots snaking toward the camera
  if (d < 90 && noise1(x / 26, 551) > 0.42) {
    const root = Math.abs(Math.sin(x * 0.09 + F2(x, v, 40, 30, 552) * 7));
    if (root < 0.045) c = root < 0.02 ? FP.podo[6] : FP.podo[2];
  }
  return c;
}
function tussockPx(x: number, y: number, dd: number, v: number, far: number): C {
  const big = F2(x, v, 90, 44, 561), mid = N2(x, v, 11, 6, 562);
  const red = big > 0.68, herb = F2(x, v, 70, 36, 563) < 0.3;
  const id = cell(x, v, 11, 6.2, 564, 0.74);
  let c: C;
  if (id >= 0) {
    const top = clamp(-CL.ny * 0.5 + 0.5);
    const blade = hash2(x, Math.floor(id * 999), 565) > 0.45 ? 0.8 : -0.6;
    const ramp = herb ? HP.spaniard : (red || id < 0.07) ? HP.tussockRed : id > 0.86 ? HP.tussockDry : HP.tussock;
    c = pick(ramp, 2.4 + top * 4.4 + blade + far - (CL.r > 0.7 ? 1.4 : 0) + dz(x, y, 0.5));
  } else c = herb ? pick(HP.spaniard, 2 + mid * 2 + far + dz(x, y)) : pick(HP.peat, 2.6 + mid * 2.4 + far + dz(x, y));
  return c;
}
function gorgePx(x: number, y: number, dd: number, v: number, far: number): C {
  // bedded rock pavement, split into slabs by fractures; scree and grit in the gaps; moss in the cracks
  const id = cell(x, v, 15, 7, 571, 0.7, 0.62);
  const mid = N2(x, v, 7, 4, 572);
  let c: C;
  if (id >= 0 && CL.r < 0.86) {
    const l = -CL.nx * 0.45 - CL.ny * 0.8;
    c = pick(id < 0.25 ? TP.rockWarm : TP.rock, 5 + l * 1.6 + (id - 0.5) * 2 + (mid - 0.5) * 1.2 + far + dz(x, y, 0.6));
    // strata lines across the slab
    if (Math.abs(Math.sin((v + x * 0.08) * 0.9 + id * 20)) < 0.08) c = shade(c, -0.18);
    if (CL.r > 0.7) c = shade(c, -0.22);
    if (hp(x, y, 573) < 0.03) c = pick(TP.lichen, 2 + hp(x, y, 574) * 3);
    if (hp(x >> 1, y >> 1, 575) < 0.012) c = pick(TP.lichenGold, 2);
  } else {
    const g = cell(x, v, 3.2, 1.9, 576, 0.75, 0.5);
    c = g >= 0 ? pick(TP.gravel, 3.6 + (-CL.nx * 0.4 - CL.ny * 0.7) * 1.6 + (g - 0.5) * 2 + far) : pick(TP.gravel, 1.6 + mid + far + dz(x, y));
    if (F2(x, v, 20, 8, 577) > 0.6) c = pick(FP.moss, 2.6 + mid * 3 + far + dz(x, y));
  }
  return c;
}

/** the trodden footpad along the walk line, per stretch */
function trackPx(b: Biome, x: number, y: number, d: number, v: number): C {
  const n = (F2(x, d, 8, 3, 581) - 0.5) * 1.6 + dz(x, y);
  switch (b) {
    case 'scrub': return cell(x, v, 4, 2.4, 582, 0.25) >= 0 ? pick(TP.gravel, 5 - CL.ny) : pick(TP.dust, 4.4 - d * 0.16 + n);
    case 'flats': return cell(x, v, 4, 2.4, 583, 0.5, 0.5) >= 0 ? pick(TP.gravel, 4.6 - CL.ny * 1.2) : pick(TP.sand, 4 - d * 0.12 + n);
    case 'burnt': return hp(x, y, 584) < 0.08 ? pick(TP.char, 3) : pick(TP.ash, 2.4 - d * 0.1 + n);
    case 'boa': return d < 1 ? pick(FP.moss, 4 + noise1(x / 3, 585) * 3) : pick(FP.mud, 4.6 - d * 0.18 + n);
    case 'tussock': return cell(x, v, 4, 2.6, 586, 0.3) >= 0 ? pick(HP.scree, 4.6 - CL.ny) : pick(HP.peat, 4.4 + n);
    case 'gorge': return cell(x, v, 3.6, 2.2, 587, 0.6, 0.5) >= 0 ? pick(TP.gravel, 5.2 - CL.ny * 1.4) : pick(TP.gravel, 3 + n);
  }
}
/** grass blades, pebbles and ash bumps poking up over the walk line */
function lipPx(b: Biome, x: number, d: number): C | 0 {
  const h = noise1(x * 0.9, 591) * 3 + noise1(x / 7, 592) * 1.6;
  switch (b) {
    case 'scrub': case 'tussock': if (-d > h * 1.1) return 0; return pick(hp(x, 0, 593) < 0.4 ? HP.tussockDry : HP.tussock, 5 + d * 0.5 + noise1(x * 1.3, 594) * 2.4);
    case 'boa': if (-d > h) return 0; return pick(FP.moss, 4.5 + d * 0.4 + noise1(x * 1.3, 595) * 2.5);
    case 'burnt': if (-d > h * 0.5) return 0; return hp(x, 1, 596) < 0.3 ? pick(TP.bracken, 5) : pick(TP.ash, 4 + d);
    case 'flats': case 'gorge': if (-d > h * 0.45) return 0; return pick(TP.gravel, 6 + d * 0.8 + noise1(x * 1.7, 597) * 2);
  }
}

/** Paint the backcountry's ground for world x in [x0, x0 + w). */
export function paintTuaFloor(x0: number, w: number): { x0: number; y0: number; base: PixelBuffer; water: PixelBuffer } {
  let minTop = 1e9, maxTop = -1e9;
  for (let x = x0; x < x0 + w; x++) { const t = tuaGround(x); minTop = Math.min(minTop, t); maxTop = Math.max(maxTop, t); }
  const y0 = Math.floor(minTop) - 6;
  const h = Math.ceil(maxTop + TUA_DEPTH - y0);
  const base = new PixelBuffer(w, h), wat = new PixelBuffer(w, h);
  FLD = []; FX0 = x0 - 160; FW = w + 320;
  for (let x = x0; x < x0 + w; x++) {
    const g = tuaGround(x);
    const top = Math.round(g), wl = tuaBase(x);
    for (let y = top - 4; y < top + TUA_DEPTH; y++) {
      if (y < y0) continue;
      const d = y - top, dd = Math.max(0, y - wl);
      const v = wrealZ(dd) * 300;
      // which stretch's ground (noise-warped and dithered at the boundaries)
      const b = bioPick(x + (N2(x, v, 46, 22, 599) - 0.5) * 150, hp(x, y, 598) * 0.55 + (dz(x, y, 1) + 0.5) * 0.45);
      OUT.c = 0; OUT.water = false;
      let ok = false;
      if (y - wl > -2 && streams(x, y, dd, v)) ok = true;
      if (!ok && d < 0) { const c = lipPx(b, x, d); if (!c) continue; OUT.c = c; ok = true; }
      if (!ok) {
        const far = (1 - wrealZ(dd)) * -0.35;
        const tr = d < 5 + noise1(x / 30, 600) * 4 + (b === 'flats' || b === 'gorge' ? -1 : 0);
        let c: C = tr ? trackPx(b, x, y, d, v)
          : b === 'scrub' ? scrubPx(x, y, dd, v, far) : b === 'flats' ? flatsPx(x, y, dd, v, far) : b === 'burnt' ? burntPx(x, y, dd, v, far)
            : b === 'boa' ? boaPx(x, y, d, dd, v, far) : b === 'tussock' ? tussockPx(x, y, dd, v, far) : gorgePx(x, y, dd, v, far);
        if (signs(x, dd, v)) c = shade(c, SIGN.lit > 0 ? 0.12 * SIGN.lit : SIGN.lit < 0 ? 0.22 * SIGN.lit : -0.2 * SIGN.k);
        if (dd > 90) c = shade(c, -smoothstep(90, 170, dd) * 0.2);
        OUT.c = c;
      }
      const i = (y - y0) * w + (x - x0);
      base.data[i] = OUT.c;
      if (OUT.water) wat.data[i] = OUT.c;
    }
  }
  return { x0, y0, base, water: wat };
}

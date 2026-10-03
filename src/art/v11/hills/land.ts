// V11 Rocky Hills, the land: rolling tussock ranges fading into the distance (golden slopes shaded by
// the light, gullies running down them, beech forest pooled in the valleys below the bush line, grey
// outcrops and tors on the crests) and the ground plane of the walk itself, from the walk line down to
// the camera: a trodden track, tussock thatch, peat and moss at the bush line, sorted grey scree, rock
// pavement among the tors, wind-shorn turf and cushions on the ridge, and the tarn (also painted into
// a water twin for the renderer's reflections).

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix } from '../../color';
import { bayer, clamp, fbm1, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import { HP, pick, hp, hazeRamp } from './kit';
import { HILLS, SCREE, BLUFF, hgroundY, hzoneAt, tarnAt, persp, realZ } from '../../../game/v11/hills/layout';
import type { HZone } from '../../../game/v11/hills/layout';

export interface HillBandOpts {
  W: number;
  H: number;
  seed: number;
  /** row of the band's lowest crests, and how high the hills rise above it */
  base: number;
  amp: number;
  /** hill size (lower = broader hills) */
  freq: number;
  /** 0 the farthest .. 1 the nearest band: detail, contrast */
  k: number;
  fog: C;
  haze: number;
  /** beech forest pooled in the valleys (0..1) */
  bush?: number;
  /** rock outcrops and little tors on the crests (0..1) */
  rock?: number;
  /** an extra rise of the crest line (world-aligned shape, e.g. the land climbing east) */
  rise?: (x: number) => number;
  /** red tussock share */
  red?: number;
}

/** a band of rolling hills (top-left anchored; the band is solid below its crest) */
export function paintHillBand(o: HillBandOpts): PixelBuffer {
  const { W, H, seed, k } = o;
  const b = new PixelBuffer(W, H);
  const tus = hazeRamp(HP.tussock, o.fog, o.haze), red = hazeRamp(HP.tussockRed, o.fog, o.haze);
  const bush = hazeRamp(HP.beech, o.fog, o.haze * 0.9), rock = hazeRamp(HP.greywacke, o.fog, o.haze);
  const crest = new Float32Array(W + 8);
  for (let x = -4; x < W + 4; x++) {
    const n = fbm1(x * o.freq, 4, seed);
    const ridged = 1 - Math.abs(n * 2 - 1);
    // rolling, rounded hills with the odd sharper crest
    const v = n * 0.55 + ridged * 0.3 + fbm1(x * o.freq * 3.1, 2, seed + 9) * 0.15;
    crest[x + 4] = o.base - v * o.amp - (o.rise ? o.rise(x) : 0);
  }
  const T = (x: number) => crest[clamp(Math.round(x), -4, W + 3) + 4];
  for (let x = 0; x < W; x++) {
    const top = Math.round(T(x));
    const slope = (T(x + 4) - T(x - 4)) / 8;
    for (let y = Math.max(0, top); y < H; y++) {
      const d = y - top;
      // facing the light (upper left) or away from it; the shading fades down the slope
      const sx = x + d * 0.6 * Math.sign(slope || 1);
      const s2 = (T(sx + 4) - T(sx - 4)) / 8;
      let lit = -(s2 * 0.6 + slope * 0.4) * 2.4;
      // gullies running down the slopes
      const g = fbm2(x * 0.02 + d * 0.012, d * 0.01, 3, seed + 3);
      lit += (g - 0.5) * 1.6 * Math.min(1, d / 20);
      lit = clamp(lit, -1.5, 1.5);
      let i = 5 + lit * 2.2 - Math.min(2, d / 90) + (bayer(x, y) - 0.5) * 0.8;
      // tussock texture: short vertical flecks
      if (k > 0.3 && hp(x, y, seed) > 0.82) i += 0.9;
      if (k > 0.3 && hp(x, y + 1, seed + 1) > 0.9) i -= 1;
      const redK = (o.red ?? 0.25) > fbm2(x * 0.01, y * 0.02, 2, seed + 7) ? 1 : 0;
      let c = pick(redK ? red : tus, redK ? i - 1.5 : i);
      // beech forest pooled in the valleys, below a ragged bush line
      const bushLine = 26 + fbm1(x * 0.02, 3, seed + 11) * 40 + (1 - (o.bush ?? 0)) * 400;
      if (d > bushLine) {
        const bump = fbm2(x * 0.2, y * 0.25, 2, seed + 13);
        c = pick(bush, 2.5 + lit * 1.4 + (bump - 0.5) * 3 + (bayer(x, y) - 0.5) * 0.8 - Math.min(1.5, (d - bushLine) / 60));
      }
      // rock outcrops near the crests and on the steep faces
      const ro = fbm2(x * 0.03, y * 0.05, 3, seed + 17);
      if ((o.rock ?? 0.5) > 0 && ro > 1 - (o.rock ?? 0.5) * 0.3 - Math.abs(slope) * 0.2 && d < 40 + Math.abs(slope) * 60) {
        c = pick(rock, 4 + lit * 2.6 + (fbm2(x * 0.15, y * 0.15, 2, seed) - 0.5) * 2 + (bayer(x, y) - 0.5));
      }
      b.data[y * W + x] = c;
    }
  }
  // little tors standing on the crests
  if ((o.rock ?? 0) > 0.2) {
    for (let x = 30; x < W - 30; x += 40 + Math.floor(hash2(x, 3, seed) * 140)) {
      if (hash2(x, 4, seed) > (o.rock ?? 0.5) * 0.8) continue;
      const top = T(x), s = 4 + k * 10 + hash2(x, 5, seed) * (4 + k * 8);
      let yy = top + 2;
      let rw = s;
      for (let r = 0; r < 3; r++) {
        const rh = s * 0.45;
        b.ellipseFn(x + (hash2(x, r, seed) - 0.5) * 3, yy - rh * 0.5, rw * 0.55, rh * 0.6, (px, py) => pick(rock, 4 + ((px - x) * -0.5 + (py - yy) * -0.4) / rw * 3 + (bayer(px, py) - 0.5)));
        yy -= rh * 0.85;
        rw *= 0.7;
      }
    }
  }
  return b;
}

// ------------------------------------------------------------------ the ground plane

export interface HGroundChunk { x0: number; y0: number; base: PixelBuffer; water: PixelBuffer }

const dith = (x: number, y: number, k = 0.9) => (bayer(x, y) - 0.5) * k;

/** jittered cells (stones): the cell id hash or -1; CL.r normalised distance, CL.nx/ny the offset */
const CL = { r: 0, nx: 0, ny: 0 };
function cell(x: number, y: number, sx: number, sy: number, seed: number, fill: number): number {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let best = 9, id = -1;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hash2(cx, cy, seed);
    if (h > fill) continue;
    const px = (cx + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * sx, py = (cy + 0.2 + hash2(cx, cy, seed + 2) * 0.6) * sy;
    const rr = 0.32 + hash2(cx, cy, seed + 3) * 0.3;
    const dx = (x - px) / (sx * rr), dy = (y - py) / (sy * rr);
    // angular stones: a squarish metric
    const q = Math.max(dx * dx + dy * dy, (Math.abs(dx) + Math.abs(dy)) ** 2 * 0.62);
    if (q < 1 && q < best) { best = q; id = h; CL.nx = dx; CL.ny = dy; }
  }
  CL.r = best;
  return id;
}

/** zone weights blended over ~80 px either side of each boundary */
function zoneW(x: number): Record<HZone, number> {
  const w: Record<HZone, number> = { bush: 0, basin: 0, scree: 0, tors: 0, bluff: 0, ridge: 0 };
  const zs: [HZone, number, number][] = [['bush', -999, 520], ['basin', 520, SCREE.x0], ['scree', SCREE.x0, SCREE.x1], ['tors', SCREE.x1, BLUFF.x0 + 20], ['bluff', BLUFF.x0 + 20, 2920], ['ridge', 2920, 9999]];
  let sum = 0;
  for (const [z, a, b] of zs) { const v = smoothstep(a - 60, a + 60, x) * (1 - smoothstep(b - 60, b + 60, x)); w[z] = v; sum += v; }
  if (sum > 0) for (const z of Object.keys(w) as HZone[]) w[z] /= sum;
  return w;
}

/** one ground pixel: x world, dd rows in front of the walk line, d rows below the local walk line */
function groundPixel(x: number, y: number, dd: number, zw: Record<HZone, number>, out: { c: C; water: boolean }) {
  const P = persp(dd), z = realZ(dd);
  const v = z * 260; // row coordinate in "real" depth units (evenly spaced toward the camera)
  const u = x / P;
  // the trodden track along the walk line
  const track = (1 - smoothstep(4, 12 + noise1(x / 40, 61) * 6, dd));
  // pick the zone by weights with a dithered threshold (no muddy blending of textures)
  let r = hp(x, y, 71) * 0.6 + bayer(x, y) * 0.4, zone: HZone = 'basin';
  for (const k of Object.keys(zw) as HZone[]) { r -= zw[k]; if (r <= 0) { zone = k; break; } }
  const shadeFar = (1 - z) * -0.35;
  let c: C;
  const n1 = fbm2(u / 60, v / 18, 3, 81), n2 = noise2(u / 7, v / 2.4, 82);
  // tarn
  if (zw.basin > 0.3 && tarnAt(x, dd) > 0) {
    const e = tarnAt(x, dd);
    const shore = e < 0.12;
    c = shore ? pick(HP.peat, 3 + n2 * 2 + dith(x, y)) : mix(hex('#30474e'), hex('#162629'), clamp(e * 1.4 + dith(x, y, 0.2)));
    out.water = !shore;
    out.c = c;
    return;
  }
  switch (zone) {
    case 'bush': {
      // peat, moss and leaf litter under the last beech, tussock creeping in
      const moss = n1 > 0.52;
      c = moss ? pick(HP.beech, 3.6 + n2 * 2.4 + shadeFar + dith(x, y)) : pick(HP.peat, 4 + n2 * 2.5 + shadeFar + dith(x, y));
      if (!moss && hp(x, y, 83) > 0.93) c = pick(HP.tussock, 3 + n2 * 2);
      break;
    }
    case 'basin': case 'ridge': {
      // tussock thatch: blades in perspective rows, red patches, herb-green hollows, peat between
      const red = fbm2(u / 70, v / 34, 3, 84) > 0.62;
      const herb = fbm2(u / 60, v / 28, 3, 85) < 0.3;
      const blade = noise2(u / 1.6, v / (0.9 + z), 86);
      let i = 4 + (blade - 0.5) * 3.4 + (n1 - 0.5) * 2 + shadeFar + dith(x, y, 0.7);
      if (zone === 'ridge') i -= 0.6;
      c = herb ? pick(HP.spaniard, i - 0.3) : red ? pick(HP.tussockRed, i - 0.6) : pick(HP.tussock, i);
      if (blade < 0.2) c = pick(HP.peat, 3 + n2 * 2);
      // ridge: wind-shorn turf with gravel scars and cushions
      if (zone === 'ridge' && fbm2(u / 40, v / 10, 3, 87) > 0.62) c = pick(HP.scree, 4 + n2 * 3 + dith(x, y));
      break;
    }
    case 'scree': case 'tors': case 'bluff': {
      const big = zone === 'scree' ? 1 : 0.7;
      const id = cell(u, v, 7 * big, 3.4 * big, zone === 'scree' ? 91 : 93, zone === 'scree' ? 0.95 : 0.55);
      if (id >= 0) {
        const l = -CL.nx * 0.5 - CL.ny * 0.8;
        const ramp = zone === 'tors' && id < 0.3 ? HP.granite : HP.scree;
        c = pick(ramp, 5.3 + l * 1.8 + (id - 0.5) * 3 + shadeFar + dith(x, y, 0.6) - (CL.r > 0.75 ? 1.6 : 0));
      } else {
        // between the stones: grit, and tussock where it can hold on
        const tuft = fbm2(u / 30, v / 8, 2, 95) > (zone === 'scree' ? 0.66 : 0.48);
        c = tuft ? pick(HP.tussock, 3.4 + n2 * 2.4 + shadeFar + dith(x, y)) : pick(HP.scree, 2 + n2 * 2 + shadeFar + dith(x, y));
      }
      if (zone === 'bluff' && fbm2(u / 50, v / 14, 2, 97) > 0.6) c = pick(HP.peat, 3 + n2 * 2 + dith(x, y));
      break;
    }
  }
  // the track: bare peat and grit, stones pressed in
  if (track > 0.5 - dith(x, y, 0.5)) {
    const st = cell(u, v, 4, 2.2, 99, 0.4);
    c = st >= 0 ? pick(HP.scree, 4.5 - CL.ny + (st - 0.5) * 2) : pick(zone === 'scree' ? HP.scree : HP.peat, 4.2 + (n2 - 0.5) * 2.4 + dith(x, y));
  }
  out.c = c;
  out.water = false;
}

/** Paint the ground for world x in [x0, x0 + w). */
export function paintHillsGround(x0: number, w: number): HGroundChunk {
  let minTop = 1e9, maxTop = -1e9;
  for (let x = x0; x < x0 + w; x++) { const t = hgroundY(x); minTop = Math.min(minTop, t); maxTop = Math.max(maxTop, t); }
  const y0 = Math.floor(minTop) - 4;
  const h = Math.ceil(maxTop + HILLS.DEPTH - y0);
  const base = new PixelBuffer(w, h), wat = new PixelBuffer(w, h);
  const out = { c: 0 as C, water: false };
  for (let x = x0; x < x0 + w; x++) {
    const top = hgroundY(x);
    const zw = zoneW(x);
    const ti = Math.round(top);
    // the lip: a ragged edge of tussock tips / stones standing above the walk line
    const lip = Math.round(hp(x, 0, 101) * 3 * (zw.basin + zw.ridge + zw.bush) + hp(x, 1, 103) * 1.5);
    for (let y = ti - lip; y < ti + HILLS.DEPTH; y++) {
      if (y < y0) continue;
      const dd = Math.max(0, y - top);
      if (y < ti) {
        out.c = (zw.scree + zw.tors > 0.5) ? pick(HP.scree, 5 + (bayer(x, y) - 0.5)) : pick(HP.tussock, 6 + (bayer(x, y) - 0.5) * 2);
        out.water = false;
      } else groundPixel(x, y, dd, zw, out);
      const i = (y - y0) * w + (x - x0);
      base.data[i] = out.c;
      if (out.water) wat.data[i] = out.c;
    }
  }
  return { x0, y0, base, water: wat };
}

export { noise2 };

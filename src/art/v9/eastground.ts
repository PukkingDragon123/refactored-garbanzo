// V9 ground for the east half (x >= EAST_X0): a per-pixel pass the island ground painter
// (art/island4/ground.ts) runs after its own sand / rock / soil, so the east keeps the shared beach
// sand and adds what is special out here:
//   the stream mouth: a real channel coming down out of the land toward the camera, a clear bed of
//     pebbles under teal water, wet sand banks with gravel and wrack, boulders, a braided delta;
//   the seal rocks: basalt shelves in front of the walk line with tide pools, weed and barnacles;
//   under the cliffs: fallen rubble and damp shingle;
//   the sea cave: wet flowstone floor, puddles and the still pool with a rimstone lip;
//   the hidden cove: soft sheltered sand, shell drifts, a trickle of seep water from the cliff;
//   the bush track and the plateau: a worn track, leaf litter drifts, moss carpets, roots and stones
//     receding in perspective, and the creek running off toward the camera over stones.
// Everything is deterministic (hash / noise with fixed seeds). Results go out through EG (no
// allocation per pixel).

import type { C } from '../color';
import { hex, mix, shade } from '../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';
import { SPOT } from '../island4/layout';
import {
  MAX_DD, MOUTH, CREEK, DELTA_THREADS, CREEK_STONES, CAVE_POOL, Stone, shelfAt, tidePoolAt,
  baseTop, persp, realZ, mouthCx, mouthHw, mouthBend, threadE, creekCx, creekHw, creekStoneAt, cavePoolHw,
} from './eastgeo';

/** the east half starts here (the stream mouth zone) */
export const EAST_X0 = 3300;

/** output of eastGround() */
export const EG = { c: 0 as C, wet: false };

const H = (s: string) => hex(s);
// clear stream water over a pebble bed, darkest in the channel, lightest in the shallows
const WATER = ['#1c4650', '#23555c', '#2d6668', '#3a7876', '#4c8a84', '#62a092', '#80b6a2', '#a4cab4'].map(H);
const PEB = ['#5a5448', '#746c5c', '#8e8470', '#a89c84', '#6a6252', '#847a66'].map(H);
const WETSAND = [H('#6a5e4a'), H('#7e705a'), H('#94836a'), H('#a8967a')];
const GRAVEL = ['#6e685e', '#8a8274', '#a49a88', '#5c564c', '#c0b49c'].map(H);
const ROCK = ['#26222a', '#353038', '#463e44', '#595052', '#6e6462', '#857a72'].map(H);
const BARN = [H('#d8d2c2'), H('#b8b0a0'), H('#8e877a')];
const WEED = [H('#2e4a26'), H('#40602c'), H('#587a34'), H('#7a8a3a'), H('#5a3a22')];
const POOL = ['#15303a', '#1c3e48', '#26505a', '#34646c', '#4a7c80'].map(H);
const SOIL = ['#241a14', '#302218', '#3e2c1e', '#4e3824', '#62472c', '#7a5a36'].map(H);
const LITTER = ['#6e3e1e', '#8a5226', '#a8682e', '#c08a3e', '#7a6a2a', '#5a4a22', '#9a4a24'].map(H);
const MOSS = ['#1e3418', '#2a4a1e', '#3a6224', '#4e7a2a', '#6a9432', '#8aac3e'].map(H);
const CREEKW = ['#16323a', '#1d4046', '#265052', '#326260', '#447670', '#5c8c82', '#7aa696'].map(H);
const TRACK = ['#4a3622', '#5a4228', '#6c5032', '#7e6040'].map(H);

const pick = (ramp: C[], v: number) => ramp[clamp(Math.floor(v), 0, ramp.length - 1)];
const dith = (x: number, y: number, k = 0.9) => (bayer(x, y) - 0.5) * k;

/**
 * Rounded pebbles on a jittered grid (cell size s): returns the pebble's id hash (or -1 between
 * pebbles) and writes the normalised distance to its centre in PB.r.
 */
const PB = { r: 0, nx: 0, ny: 0 };
function pebble(x: number, y: number, sx: number, sy: number, seed: number, fill = 0.8): number {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let best = 9, id = -1;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hash2(cx, cy, seed);
    if (h > fill) continue;
    const px = (cx + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * sx, py = (cy + 0.2 + hash2(cx, cy, seed + 2) * 0.6) * sy;
    const rr = 0.32 + hash2(cx, cy, seed + 3) * 0.3;
    const dx = (x - px) / (sx * rr), dy = (y - py) / (sy * rr);
    const q = dx * dx + dy * dy;
    if (q < 1 && q < best) { best = q; id = h; PB.nx = dx; PB.ny = dy; }
  }
  PB.r = best;
  return id;
}

/** a stone in a stream (x, row, radius): rock shading, pale dry cap, dark wet waterline */
function stonePx(x: number, dd: number, st: Stone, sx: number, sd: number, r: number): C | -1 {
  const nx = (x - sx) / r, ny = (dd - sd) / (r * 0.55);
  const lump = (noise2(x / 2.2, dd / 1.6, st.seed * 7) - 0.5) * 0.35;
  const q = nx * nx + ny * ny + lump;
  if (q > 1) return -1;
  // lit from the upper left; wet (dark, glossy) along the lower half where the water laps
  const l = -nx * 0.35 - ny * 0.75 + (1 - q) * 0.4;
  let c = pick(ROCK, 2.4 + l * 2.6 + dith(x, dd, 0.8));
  if (ny > 0.25) c = shade(c, -0.22);
  if (ny > 0.1 && ny < 0.3 && hash2(x, dd, st.seed) < 0.5) c = H('#8ab6ae');
  if (ny < -0.45 && hash2(x, dd, st.seed + 3) < 0.28) c = H('#9a9484');
  if (st.seed % 3 === 0 && ny < -0.2 && noise2(x / 2, dd / 2, st.seed) > 0.55) c = pick(MOSS, 3 + l * 2);
  return c;
}

// ------------------------------------------------------------------ the stream mouth

/**
 * The water over the stream bed: `depth` 0..1 sets the tone (the channel darkest), `clear` 0..1 how
 * much of the pebble bed shows through (near the camera we look down into the water; far off it
 * only mirrors the sky), at perspective-scaled coords (u, v).
 */
function streamBed(x: number, y: number, u: number, v: number, depth: number, clear: number, sand: C): C {
  let i = 6.3 - depth * 4.9;
  if (clear > 0.04) {
    const pid = pebble(u, v, 3.8, 2.9, 90, 0.8);
    if (pid >= 0) {
      const l = -PB.nx * 0.5 - PB.ny * 0.7;
      i += (PB.r > 0.66 ? -1.1 : 0.25 + l * 0.6 + (pid - 0.4) * 0.9) * clear;
    }
  }
  let c = pick(WATER, i + dith(x, y, 0.45));
  // the sandy bed warms the shallows (the fresh water carries a faint tea colour)
  if (depth < 0.3) c = mix(c, sand, clamp((0.3 - depth) * 1.6));
  return c;
}

function stream(x: number, y: number, dd: number, c0: C, wet0: boolean): boolean {
  if (dd < -3 || dd > MAX_DD) return false;
  const cx = mouthCx(dd), hw = mouthHw(dd), P = persp(dd);
  const e = (x - cx) / hw, ae = Math.abs(e);
  if (ae > 2.2) return false;
  // ripple scale follows the perspective
  const u = (x - MOUTH.x) / P, v = realZ(dd) * 260;
  const bend = mouthBend(dd);
  // a wobbly waterline (sub-row noise so the banks never run as straight curbs)
  const wob = (noise1(dd / 4 + (e > 0 ? 50 : 0), 80) - 0.5) * 0.12 + (noise1(dd / 1.3 + (e > 0 ? 9 : 0), 79) - 0.5) * 0.05;
  const ee = ae - wob;
  if (ee >= 1) {
    // the banks, in bank widths b (real px): the lit face of the right bank or the shaded face of the
    // left one, dark wet sand, gravel on the inside of bends, damp sand fading into the beach
    const b = (ee - 1) * hw / P;
    const inside = Math.sign(e) !== Math.sign(bend) ? Math.abs(bend) : 0;
    const reach = 5 + noise1(dd / 6 + (e > 0 ? 40 : 0), 81) * 5 + inside * 6;
    if (b > reach) return false;
    let c: C;
    const rag = (noise2(u / 2.2, v / 1.4, 78) - 0.5) * 3;
    if (b < 0.9) c = e < 0 ? H('#5c5040') : H('#b8a684');
    else if (b < 2) c = WETSAND[1];
    else if (b + rag > reach * 0.72) c = mix(c0, WETSAND[3], 0.25);
    else c = pick(WETSAND, 1.6 + b * 0.3 + (noise2(u / 3, v / 2, 77) - 0.5) * 1.2);
    // gravel in patches: a bar on the inside of each bend, scattered stones elsewhere
    const patch = noise2(u / 9, v / 6, 76) * (0.5 + inside);
    const pid = pebble(u, v, 3, 2.3, 83, patch > 0.42 ? 0.75 * (1 - b / reach) : 0.06);
    if (pid >= 0 && b > 1) {
      const l = -PB.nx * 0.45 - PB.ny * 0.6 + (1 - PB.r) * 0.5;
      c = pick(GRAVEL, 1 + l * 2.2 + pid * 2);
      if (PB.r > 0.72) c = shade(c, -0.2);
    }
    // wrack caught at the high-water mark: twigs, leaves, a pale shell
    const wr = Math.abs(b - reach * 0.7 - (noise1(dd / 4, 84) - 0.5) * 2.2);
    if (wr < 0.6 && noise1(dd / 2.5 + x * 0.3, 85) > 0.62) c = pick(LITTER, hash2(x, y, 86) * 6);
    if (b > 1 && hash2(x, y, 87) < 0.005) c = H('#efe6d8');
    EG.c = c;
    EG.wet = b < reach * 0.45 || wet0;
    return true;
  }
  // the delta: thin sheets over rippled sand, braided threads of current, low bars
  if (dd < MOUTH.delta) {
    const k = 1 - clamp(dd / MOUTH.delta);
    let th = 9;
    for (const t of DELTA_THREADS) th = Math.min(th, Math.abs(e - threadE(t, dd)) / (t[1] * (0.7 + (1 - k) * 0.9)));
    // the main channel's own current runs into the head of the delta
    th = Math.min(th, Math.abs(e) / (0.5 * (1 - k) + 0.02) + k * 0.8);
    const sandBed = sandRipple(x, y, dd, P);
    EG.wet = true;
    if (th < 1) {
      EG.c = streamBed(x, y, u, v, (1 - th * th) * (0.55 + (1 - k) * 0.4), 0, sandBed);
      if (th > 0.8 && bayer(x, y) < 0.5) EG.c = mix(EG.c, WATER[7], 0.35);
    } else {
      // a film of water over sand; low bars break the surface further from the threads (drier, so
      // they don't mirror like the water around them)
      const bar = fbm2(u / 5, v / 3, 2, 88) + (th - 1) * 0.08;
      if (bar > 0.7) { EG.c = mix(sandBed, WETSAND[3], 0.4); EG.wet = false; }
      else EG.c = mix(sandBed, WATER[5], 0.35 + (0.7 - bar) * 0.5);
      if (bar > 0.64 && bar <= 0.7) EG.c = WATER[7];
    }
    return true;
  }
  // the channel: deep pools against the outer bank of each bend, riffles over the crossings
  const off = bend * 0.45;
  const de = (e - off) / (1 + Math.abs(off));
  const riffle = 1 - Math.abs(bend);
  let depth = (1 - de * de) * (0.45 + 0.55 * smoothstep(MOUTH.delta, 70, dd)) * (1 - riffle * 0.35);
  depth += (fbm2(u / 16, v / 10, 2, 91) - 0.5) * 0.16;
  let c = streamBed(x, y, u, v, clamp(depth), smoothstep(50, 150, dd) * (1 - clamp(depth) * 0.4), WETSAND[3]);
  // the lip of the waterline: the lit side sparkles, the shaded side is a dark line of wet sand
  if (ee > 0.9 && bayer(x, y) < (ee - 0.9) * 10) c = e > 0 ? WATER[7] : WATER[5];
  EG.c = c;
  EG.wet = true;
  return true;
}

/** rippled wet sand under the delta's film of water */
function sandRipple(x: number, y: number, dd: number, P: number): C {
  const r = Math.sin(((x - MOUTH.x) / P) * 0.9 + Math.sin(dd * 0.35) * 2 + fbm2(x / 30, dd / 8, 2, 92) * 5);
  return r > 0.6 ? WETSAND[3] : r > -0.2 ? WETSAND[2] : WETSAND[1];
}

// ------------------------------------------------------------------ seal rocks: shelves and tide pools

function tidePools(x: number, y: number, dd: number, c0: C): boolean {
  const sh = shelfAt(x, dd);
  if (sh <= 0) return false;
  const P = persp(dd), u = (x - 4350) / P, v = realZ(dd) * 200;
  const pool = tidePoolAt(x, dd);
  let c: C;
  if (pool > 0) {
    // the pool: dark clear water over a floor of weed, anemones and pebbles
    const k = clamp(pool * 6);
    c = pick(POOL, 4.2 - k * 3.6 + (fbm2(u / 5, v / 5, 2, 103) - 0.5) * 1.2 + dith(x, y, 0.5));
    const g = noise2(u / 3, v / 3, 104);
    if (g > 0.7) c = mix(c, WEED[1 + (Math.floor(g * 10) % 2)], 0.5);
    if (hash2(x, y, 105) < 0.01) c = mix(c, hash2(x, y, 106) < 0.5 ? H('#c8384a') : H('#58b070'), 0.7);
    if (pool < 0.03) c = mix(c, POOL[4], 0.6);
    EG.c = c; EG.wet = true;
    return true;
  }
  // the shelf: lumpy basalt, each lump lit on its upper side; weed round the pools, barnacle crusts
  const lump = noise2(u / 5, v / 5, 112);
  const above = noise2(u / 5, (v - 1.6) / 5, 112);
  c = pick(ROCK, 2.3 + (lump - 0.5) * 3 + (above < lump - 0.06 ? 1.4 : 0) + Math.min(1, sh * 8) * 0.6 + dith(x, y, 0.5));
  if (pool > -0.05 && noise2(u / 3, v / 3, 108) > 0.38) c = pick(WEED, noise2(u / 6, v / 6, 109) * 4);
  else if (noise2(u / 3, v / 3, 110) > 0.7 && hash2(x, y, 111) < 0.55) c = pick(BARN, hash2(x, y, 113) * 3);
  // the shelf's edge sinks into the sand
  if (sh < 0.025) c = mix(c, c0, 0.45);
  EG.c = c; EG.wet = sh < 0.06 || pool > -0.08;
  return true;
}

// ------------------------------------------------------------------ the sea cave: floor and pool

function cavePool(x: number, y: number, dd: number): boolean {
  const hw = cavePoolHw(Math.max(0, dd));
  const dx = Math.abs(x - CAVE_POOL.x);
  const rim = hw + 3 + noise1(dd / 3 + 7, 121) * 3;
  if (dd < -2 || dd > CAVE_POOL.depth + 6 || dx > rim + 2) return false;
  if (dx < hw && dd <= CAVE_POOL.depth) {
    // still black water: a faint teal lift toward the far edge, the drowned floor near the rim
    const k = dx / Math.max(1, hw);
    let c = pick(POOL, 0.6 + k * 1.6 + (1 - dd / CAVE_POOL.depth) * 0.5 + dith(x, y, 0.7));
    if (k > 0.82) c = mix(c, ROCK[2], 0.35);
    EG.c = c; EG.wet = true;
    return true;
  }
  if (dx < rim) {
    // rimstone lip: pale wet calcite ridges catching the light
    const c = hash2(x, y, 122) < 0.4 ? H('#6e6a62') : H('#8a847a');
    EG.c = dd < 1 ? H('#a09a8e') : c; EG.wet = true;
    return true;
  }
  return false;
}

function caveFloor(x: number, y: number, d: number, c0: C, wet0: boolean): boolean {
  if (cavePool(x, y, y - baseTop(x))) return true;
  // flowstone ridges running toward the camera and shallow puddles that mirror the shafts (only on
  // the rock the shared painter laid down: same test as its cave floor)
  const k = Math.min(smoothstep(5030, 5100, x), 1 - smoothstep(5400, 5470, x));
  if (k <= 0 || fbm2(x / 20, y / 11, 2, 72) * 0.9 + 0.05 >= k) return false;
  const P = persp(d);
  const u = (x - CAVE_POOL.x) / P;
  const puddle = fbm2(u / 16, d / 7, 3, 123);
  if (puddle > 0.7 && d > 6) {
    EG.c = mix(POOL[1], POOL[3], clamp((puddle - 0.7) * 6));
    EG.wet = true;
    return true;
  }
  const ridge = Math.abs(Math.sin(u * 0.16 + fbm2(u / 30, d / 20, 2, 124) * 5));
  let c = c0;
  if (ridge < 0.1) c = shade(c0, 0.12);
  if (puddle > 0.65) { c = mix(c, H('#3a4a4e'), 0.5); EG.c = c; EG.wet = true; return true; }
  // damp sheen: glossy patches shimmer with the water material
  EG.c = c;
  EG.wet = wet0 || noise2(u / 6, d / 3, 125) > 0.66;
  return c !== c0 || EG.wet !== wet0;
}

// ------------------------------------------------------------------ under the cliffs: shingle and rubble

function shingle(x: number, y: number, d: number, c0: C, wet0: boolean): boolean {
  const k = Math.min(smoothstep(4680, 4760, x), 1 - smoothstep(5030, 5060, x)) * (1 - smoothstep(30, 90, d));
  const k2 = Math.min(smoothstep(5440, 5500, x), 1 - smoothstep(5560, 5620, x)) * (1 - smoothstep(20, 60, d));
  const kk = Math.max(k, k2);
  if (kk <= 0.05) return false;
  const P = persp(d);
  const pid = pebble(x - (x - 4880) * (1 - 1 / P) * 0.15, realZ(d) * 240, 4.2, 3, 131, 0.7 * kk);
  if (pid < 0) return false;
  const l = -PB.nx * 0.45 - PB.ny * 0.6 + (1 - PB.r) * 0.5;
  let c = pick(GRAVEL, 0.6 + l * 2.6 + pid * 1.5);
  if (PB.r > 0.75) c = shade(c, -0.2);
  if (wet0) c = shade(c, -0.12);
  EG.c = c; EG.wet = wet0;
  return true;
}

// ------------------------------------------------------------------ the hidden cove

function cove(x: number, y: number, d: number, c0: C, wet0: boolean): boolean {
  if (wet0 || d < 26) return false;
  // shell drifts along an old tide line and a seep of fresh water from the cliff foot
  const P = persp(d);
  const line = Math.abs(d - 40 - (noise1(x / 60, 141) - 0.5) * 14);
  if (line < 2.5 * P * 0.5 && hash2(x, y, 142) < 0.22) {
    EG.c = hash2(x, y, 143) < 0.5 ? H('#f2e8d8') : hash2(x, y, 144) < 0.5 ? H('#d8b8a0') : H('#8a8478');
    EG.wet = false;
    return true;
  }
  const seepX = 5520 + (d - 26) * 0.35;
  const sd = Math.abs(x - seepX - Math.sin(d * 0.12) * 5);
  if (d > 30 && sd < 1.4 + d * 0.02) {
    EG.c = mix(c0, WETSAND[1], 0.75); EG.wet = true;
    return true;
  }
  if (d > 30 && sd < 4 + d * 0.05) { EG.c = mix(c0, WETSAND[3], 0.45); EG.wet = false; return true; }
  return false;
}

// ------------------------------------------------------------------ the bush track and the plateau

function creek(x: number, y: number, dd: number): boolean {
  if (dd < -3 || dd > MAX_DD) return false;
  const cx = creekCx(dd), hw = creekHw(dd), P = persp(dd);
  const e = (x - cx) / hw, ae = Math.abs(e);
  if (ae > 1.9) return false;
  const u = (x - CREEK.x) / P, v = realZ(dd) * 260;
  if (ae >= 1) {
    // mossy banks: dark wet earth, moss cushions and fern shade, roots dipping in
    const b = (ae - 1) * hw / P;
    if (b > 8 + noise1(dd / 5 + (e > 0 ? 30 : 0), 151) * 6) return false;
    let c = b < 1.2 ? SOIL[0] : pick(SOIL, 1 + b * 0.35 + dith(x, y));
    const m = noise2(u / 4, v / 3, 152);
    if (m > 0.5 - b * 0.03) c = pick(MOSS, 1.2 + (m - 0.5) * 9 + dith(x, y));
    if (b > 1 && b < 5 && pebble(u, v, 3.4, 2.6, 153, 0.35) >= 0) c = pick(GRAVEL, 1 + (1 - PB.r) * 2);
    EG.c = c; EG.wet = b < 2.2;
    return true;
  }
  const deep = (1 - e * e) * (0.4 + 0.6 * smoothstep(0, 30, Math.abs(dd - 8)) * (dd < 20 ? 0.6 : 1));
  let v0 = 5.4 - deep * 4.2 + (fbm2(u / 7, v / 5, 2, 154) - 0.5) * 1.2;
  const pid = pebble(u, v, 3, 2.4, 155, 0.85);
  if (pid >= 0 && deep < 0.8) v0 += ((-PB.nx * 0.4 - PB.ny * 0.6) * 0.8 + (pid - 0.45) * 1.4) * (1 - deep) - (PB.r > 0.7 ? 0.8 : 0);
  let c = pick(CREEKW, v0 + dith(x, y));
  if (ae > 0.92 && bayer(x, y) < (ae - 0.92) * 12) c = CREEKW[6];
  EG.c = c; EG.wet = true;
  return true;
}

function forestFloor(x: number, y: number, d: number, c0: C): boolean {
  const k = smoothstep(5930, 6030, x);
  if (k <= 0 || fbm2(x / 26, y / 14, 3, 73) * 1.1 <= 1.02 - smoothstep(5900, 6080, x)) return false;
  const P = persp(d);
  const u = x, v = realZ(d) * 300;
  // the worn track right under the walk line: trodden earth, a few roots across it
  if (d < 9 + noise1(x / 30, 161) * 4) {
    let c = pick(TRACK, 2.6 - d * 0.18 + (fbm2(x / 8, y / 3, 2, 162) - 0.5) * 1.6 + dith(x, y));
    if (d < 1) c = pick(MOSS, 3 + noise1(x / 3, 163) * 2);
    if (Math.abs(Math.sin(x * 0.07 + noise1(x / 40, 164) * 4)) < 0.05 && noise1(x / 90, 165) > 0.5) c = H('#7a5a38');
    EG.c = c; EG.wet = false;
    return true;
  }
  // moss carpets and leaf litter drifts, both scaled by the perspective
  const moss = fbm2(u / 22, v / 10, 3, 166);
  const drift = fbm2(u / 14 + 40, v / 7, 3, 167);
  let c: C;
  if (moss > 0.6) {
    const t = (moss - 0.6) * 6;
    c = pick(MOSS, 0.9 + t * 2 + (noise2(u / 1.6, v / 1.2, 168) - 0.5) * 1.6 + dith(x, y));
    if (hash2(x, y, 169) < 0.03) c = MOSS[5];
  } else {
    c = pick(SOIL, 2.2 + (fbm2(u / 6, v / 4, 2, 170) - 0.5) * 2 + dith(x, y));
    // fallen leaves: little lens shapes in autumn colours, denser in drifts
    const lid = pebble(u * 1.2, v * 1.6, 2.6, 1.7, 171, 0.08 + drift * drift * 0.7);
    if (lid >= 0 && PB.r < 0.9) {
      c = shade(pick(LITTER, lid * 7), -0.18);
      if (PB.ny < -0.3) c = shade(c, 0.12);
      if (PB.r > 0.6) c = shade(c, -0.15);
    }
  }
  // roots snaking toward the camera from the trees on the walk line
  const root = Math.abs(Math.sin(u * 0.09 + fbm2(u / 40, v / 30, 2, 172) * 7));
  if (root < 0.045 && d < 70 && noise1(u / 26, 173) > 0.42) c = root < 0.02 ? H('#8a6a44') : H('#4e3622');
  // stones half sunk in the humus
  if (pebble(u, v, 17, 11, 174, 0.05) >= 0) {
    const l = -PB.nx * 0.4 - PB.ny * 0.6 + (1 - PB.r) * 0.4;
    c = pick(ROCK, 2 + l * 2.6);
    if (PB.ny < -0.35 && hash2(x, y, 175) < 0.5) c = MOSS[3];
  }
  // shade deepening toward the camera (under the foreground ferns)
  if (d > 60) c = shade(c, -smoothstep(60, 160, d) * 0.28);
  void c0;
  EG.c = c; EG.wet = false;
  return true;
}

/** grass blades and moss tufts poking up over the plateau's edge (rows just above the walk line) */
function turfLip(x: number, d: number): boolean {
  if (d > 0 || x < 5960) return false;
  const h = noise1(x * 0.9, 181) * 3.2 + noise1(x / 7, 182) * 1.4;
  if (-d > h) return false;
  EG.c = pick(MOSS, 3.5 + d * 0.4 + noise1(x * 1.3, 183) * 2);
  EG.wet = false;
  return true;
}

// ------------------------------------------------------------------ entry point

/**
 * Called for every ground pixel (x, y) with d rows below the chunk's top edge, the zone, and the
 * shared painter's colour / wet flag. Returns true when it changed them (read EG.c / EG.wet).
 */
export function eastGround(x: number, y: number, d: number, zone: string, c0: C, wet0: boolean): boolean {
  if (x < EAST_X0) return false;
  switch (zone) {
    case 'seal': case 'stream': if (x >= 3990 && tidePools(x, y, y - baseTop(x), c0)) return true;
      return zone === 'stream' && stream(x, y, y - baseTop(x), c0, wet0);
    case 'cliffs': return shingle(x, y, d, c0, wet0);
    case 'cave': return caveFloor(x, y, d, c0, wet0);
    case 'cove': return shingle(x, y, d, c0, wet0) || cove(x, y, d, c0, wet0);
    case 'forest': {
      if (Math.abs(x - SPOT.creek) < 120 && creek(x, y, y - baseTop(x))) return true;
      if (turfLip(x, d)) return true;
      return d >= 0 && forestFloor(x, y, d, c0);
    }
  }
  return false;
}

export { MOUTH };

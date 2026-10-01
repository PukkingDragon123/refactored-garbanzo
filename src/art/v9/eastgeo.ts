// V9 east-half water geometry, shared by the ground painter (art/v9/eastground.ts), the animated water
// (game/v9/streamfx.ts) and the wading physics (game/v9/water.ts).
//
// The ground below the walk line is the land running toward the camera, so a row `dd` pixels below
// the walk line is nearer than the walk line. A simple pinhole mapping gives the perspective used by
// everything here: horizontal sizes grow by persp(dd) = (HOR + dd) / HOR toward the bottom of the
// screen, and realZ(dd) is the (normalised) real distance from the walk line, so things moving at a
// constant real speed cover more rows per second near the camera.
//
//   the stream mouth (SPOT.stream): comes down out of the land in the foreground, meanders, narrows
//   as it runs back, fans into a braided delta and crosses the walk line (the ford) into the surf.
//   the creek (SPOT.creek): tumbles over a mossy ledge behind the walk line into a pool (the ford)
//   and runs off toward the camera over stones.
//   the cave pool (x 5250): a still pool in the cave floor, fed by drips from the roof.
//   tide pools: rock pools in front of the walk line at the seal rocks.

import { clamp, noise1, smoothstep } from '../../core/math';
import { ISL, SPOT, groundY } from '../island4/layout';

/** rows from the walk line up to the vanishing horizon (world px on the gameplay plane) */
export const HOR = 80;
export const persp = (dd: number) => (HOR + Math.max(0, dd)) / HOR;
/** normalised real distance in front of the walk line (0 at the walk line, -> 1 far toward the camera) */
export const realZ = (dd: number) => Math.max(0, dd) / (HOR + Math.max(0, dd));
/** inverse of realZ: the row for a real distance */
export const rowOf = (z: number) => (HOR * z) / Math.max(1e-4, 1 - z);

/** deepest row any water feature is painted to (the ground ends at ISL.BOT) */
export const MAX_DD = 190;

// ------------------------------------------------------------------ the stream mouth

export const MOUTH = {
  x: SPOT.stream,
  /** half width at the walk line before the delta fans out (P = 1) */
  w0: 23,
  /** rows over which the delta fans out */
  delta: 36,
  /** real flow speed (realZ units per second) toward the sea */
  flow: 0.055,
};

/** how far the walk line dips at the ford (copy of the dip in layout.ts groundY) */
export function fordDip(x: number): number {
  const s = Math.abs(x - SPOT.stream);
  return s < 60 ? 5 * (1 - smoothstep(20, 60, s)) : 0;
}
/** the creek pool dip (copy of layout.ts) */
export function creekDip(x: number): number {
  const c = Math.abs(x - SPOT.creek);
  return c < 50 ? 7 * (1 - smoothstep(14, 50, c)) : 0;
}
/** the cave pool dip (copy of layout.ts) */
export function cavePoolDip(x: number): number {
  const c = Math.abs(x - CAVE_POOL.x);
  return c < 50 ? 4 * (1 - smoothstep(20, 50, c)) : 0;
}

/** the walk line without the ford / pool dips (the water surface level there) */
export function baseTop(x: number): number {
  return groundY(x) - fordDip(x) - creekDip(x) - cavePoolDip(x);
}

const CXS = new Float32Array(MAX_DD + 1), HWS = new Float32Array(MAX_DD + 1), BEND = new Float32Array(MAX_DD + 1);
for (let dd = 0; dd <= MAX_DD; dd++) {
  const z = realZ(dd), P = persp(dd);
  // an S-bend that swings wider as it comes toward the camera, entering from the lower left
  CXS[dd] = MOUTH.x - 2 + (Math.sin(z * 10.5 - 1.2) * 19 - z * 40) * P;
  const fl = 1 - smoothstep(0, MOUTH.delta, dd);
  HWS[dd] = MOUTH.w0 * P * (1 + (noise1(dd / 11, 91) - 0.5) * 0.16) + 44 * fl * fl;
}
// the side of the outer bank of each bend (+1 right): the deep pool hugs it, a gravel bar builds on
// the inside of the bend (the sign of -X''(z) of the centre line above)
for (let dd = 0; dd <= MAX_DD; dd++) BEND[dd] = Math.sin(realZ(dd) * 10.5 - 1.2) * smoothstep(8, 40, dd);
/** -1..1: which way the channel bends at dd (the outer bank is on the side of the sign) */
export const mouthBend = (dd: number) => BEND[clamp(Math.round(dd), 0, MAX_DD)];
/** stream centre x at dd rows below the walk line */
export const mouthCx = (dd: number) => CXS[clamp(Math.round(dd), 0, MAX_DD)];
/** stream half width at dd */
export const mouthHw = (dd: number) => HWS[clamp(Math.round(dd), 0, MAX_DD)];
/** smooth (sub-row) versions for moving things */
export function mouthAt(dd: number): [number, number] {
  const i = clamp(Math.floor(dd), 0, MAX_DD - 1), f = clamp(dd - i, 0, 1);
  return [CXS[i] + (CXS[i + 1] - CXS[i]) * f, HWS[i] + (HWS[i + 1] - HWS[i]) * f];
}

/** boulders in the stream: real depth z, cross position e (-1..1), real radius (px at P = 1) */
export interface Stone { z: number; e: number; r: number; seed: number }
export const MOUTH_STONES: Stone[] = [
  { z: 0.38, e: -0.42, r: 4.2, seed: 1 },
  { z: 0.5, e: 0.46, r: 5.2, seed: 2 },
  { z: 0.6, e: -0.16, r: 6.4, seed: 3 },
  { z: 0.3, e: 0.2, r: 2.6, seed: 4 },
  { z: 0.66, e: 0.72, r: 3.6, seed: 5 },
  { z: 0.46, e: -0.8, r: 2.4, seed: 6 },
  { z: 0.56, e: 0.12, r: 2, seed: 7 },
];
/** screen placement of a stone: centre x, row, radius */
export function stoneAt(s: Stone): [number, number, number] {
  const dd = rowOf(s.z);
  const [cx, hw] = mouthAt(dd);
  return [cx + s.e * hw, dd, s.r * persp(dd)];
}

/** sand bars of the braided delta: cross position, first/last row, half width in e units */
export const MOUTH_BARS: [number, number, number, number][] = [[-0.52, 4, 24, 0.13], [0.2, 2, 15, 0.1], [0.66, 1, 11, 0.08], [-0.12, 1, 7, 0.06]];
/** the delta's braided threads: where they reach the walk line (e at dd 0) and their width (e) */
export const DELTA_THREADS: [number, number][] = [[-0.78, 0.1], [-0.3, 0.13], [0.24, 0.11], [0.7, 0.09]];
/** e of a delta thread at row dd (they all leave the main channel's middle at the delta's head) */
export function threadE(t: [number, number], dd: number): number {
  const k = 1 - clamp(dd / MOUTH.delta);
  return t[0] * Math.pow(k, 0.7) + Math.sin(dd * 0.4 + t[0] * 7) * 0.04;
}

/** is (x, dd) inside the stream's water (0 = no, else how far from the bank, 0..1) */
export function mouthWater(x: number, dd: number): number {
  if (dd < -1 || dd > MAX_DD) return 0;
  const cx = mouthCx(dd), hw = mouthHw(dd);
  const e = (x - cx) / hw;
  if (Math.abs(e) >= 1) return 0;
  return 1 - Math.abs(e);
}

// ------------------------------------------------------------------ the creek on the plateau

export const CREEK = {
  x: SPOT.creek,
  /** half width at the walk line (P = 1) */
  w0: 13,
  /** the ledge the creek falls over, behind the walk line: height above the walk line */
  fall: 30,
  /** half width of the falling sheet */
  fallW: 9,
  /** flow speed toward the camera (realZ units per second) */
  flow: 0.07,
};

const CCX = new Float32Array(MAX_DD + 1), CHW = new Float32Array(MAX_DD + 1);
for (let dd = 0; dd <= MAX_DD; dd++) {
  const z = realZ(dd), P = persp(dd);
  CCX[dd] = CREEK.x + 3 + (Math.sin(z * 9 + 0.5) * 9 + z * 22) * P;
  // the pool at the walk line bulges, then the run narrows between stones
  const pool = Math.exp(-(((dd - 8) / 12) ** 2)) * 16;
  CHW[dd] = CREEK.w0 * P * (1 + (noise1(dd / 7, 93) - 0.5) * 0.3) + pool;
}
export function creekAt(dd: number): [number, number] {
  const i = clamp(Math.floor(dd), 0, MAX_DD - 1), f = clamp(dd - i, 0, 1);
  return [CCX[i] + (CCX[i + 1] - CCX[i]) * f, CHW[i] + (CHW[i + 1] - CHW[i]) * f];
}
export const creekCx = (dd: number) => CCX[clamp(Math.round(dd), 0, MAX_DD)];
export const creekHw = (dd: number) => CHW[clamp(Math.round(dd), 0, MAX_DD)];
export const CREEK_STONES: Stone[] = [
  { z: 0.24, e: 0.5, r: 3.6, seed: 11 },
  { z: 0.36, e: -0.38, r: 4.4, seed: 12 },
  { z: 0.47, e: 0.3, r: 5, seed: 13 },
  { z: 0.55, e: -0.6, r: 3.4, seed: 14 },
  { z: 0.62, e: 0.05, r: 5.6, seed: 15 },
  { z: 0.3, e: 0.0, r: 2.2, seed: 16 },
];
export function creekStoneAt(s: Stone): [number, number, number] {
  const dd = rowOf(s.z);
  const [cx, hw] = creekAt(dd);
  return [cx + s.e * hw, dd, s.r * persp(dd)];
}

// ------------------------------------------------------------------ the cave pool

export const CAVE_POOL = { x: 5250, hw: 46, depth: 30 };
/** half width of the cave pool at dd (0 outside its rows) */
export function cavePoolHw(dd: number): number {
  if (dd < -1 || dd > CAVE_POOL.depth) return 0;
  const k = dd / CAVE_POOL.depth;
  return CAVE_POOL.hw * Math.sqrt(Math.max(0, 1 - k * k)) * (1 + (noise1(dd / 5, 97) - 0.5) * 0.25) * persp(dd) * 0.8;
}

// ------------------------------------------------------------------ tide pools at the seal rocks

/** rock pools in front of the walk line: centre x, centre row, half width, half height */
export const TIDE_POOLS: [number, number, number, number][] = [
  [4070, 34, 24, 7], [4190, 58, 34, 10], [4440, 30, 20, 6], [4560, 64, 40, 11], [4660, 40, 22, 7],
];

// ------------------------------------------------------------------ water at the walk line

export type WaterKind = 'stream' | 'creek' | 'pool' | 'swash';

/** static water depth (px) at the walk line at x (the swash is added live by game/v9/water.ts) */
export function walkWater(x: number): number {
  const s = Math.abs(x - MOUTH.x);
  if (s < 76) return Math.max(fordDip(x), 1.2 * (1 - smoothstep(52, 76, s)));
  const c = Math.abs(x - CREEK.x);
  if (c < 40) return Math.max(creekDip(x), 1 - smoothstep(26, 40, c));
  const p = Math.abs(x - CAVE_POOL.x);
  if (p < 48) return Math.max(cavePoolDip(x), 0.8 * (1 - smoothstep(34, 48, p)));
  return 0;
}
export function walkWaterKind(x: number): WaterKind | null {
  if (Math.abs(x - MOUTH.x) < 76) return 'stream';
  if (Math.abs(x - CREEK.x) < 40) return 'creek';
  if (Math.abs(x - CAVE_POOL.x) < 48) return 'pool';
  return null;
}

export { ISL };

// V11 Te Wao Nui, the Great Forest: the geometry shared by the forest's painters (src/art/v11/forest),
// its dressing, physics and story. One long side-view walk inland of the beach (world x 0..W, west to
// east), the land running down toward the camera in front of the walk line (the 2.5D ground plane, the
// same pinhole mapping as the island's east half: a row `dd` below the walk line is nearer).
//
//   0 ─ Te Tomokanga, the forest edge (the beach light behind) ─ 480 ─ Te Awa, the stream flats and
//   the ford ─ 1360 ─ Ngā Kauri, the giants and the fallen kauri you can climb ─ 2240 ─ Te Repo, the mud
//   wallows ─ 3080 ─ Te Kōawa, the gully and its creek ─ 3820 ─ Te Uru Rātā, the rātā grove ─ 4880 ─
//   Te Pae, up toward the ridge (the way on, deeper) ─ 6000

import { clamp, noise1, smoothstep } from '../../../core/math';

export const FOREST = {
  W: 6000,
  /** the walk line's base height (world y on the gameplay plane) */
  G: 214,
  /** bottom of the painted ground plane */
  BOT: 418,
  /** camera bounds */
  minY: -120,
  maxY: 410,
};

/** rows from the walk line up to the vanishing horizon (world px on the gameplay plane) */
export const HOR = 80;
export const persp = (dd: number) => (HOR + Math.max(0, dd)) / HOR;
/** normalised real distance in front of the walk line (0 at the walk line .. -> 1 toward the camera) */
export const realZ = (dd: number) => Math.max(0, dd) / (HOR + Math.max(0, dd));
export const rowOf = (z: number) => (HOR * z) / Math.max(1e-4, 1 - z);

export type FZone = 'edge' | 'stream' | 'giants' | 'wallows' | 'gully' | 'rata' | 'ridge';
export const FZONES: [FZone, number, number, string, string][] = [
  ['edge', 0, 480, 'Te Tomokanga', 'The forest edge'],
  ['stream', 480, 1360, 'Te Awa', 'The stream flats'],
  ['giants', 1360, 2240, 'Ngā Kauri', 'The giants'],
  ['wallows', 2240, 3080, 'Te Repo', 'The mud wallows'],
  ['gully', 3080, 3820, 'Te Kōawa', 'The gully'],
  ['rata', 3820, 4880, 'Te Uru Rātā', 'The rātā grove'],
  ['ridge', 4880, 6001, 'Te Pae', 'Up toward the ridge'],
];
export function fzoneAt(x: number): FZone {
  for (const [z, a, b] of FZONES) if (x >= a && x < b) return z;
  return x < 0 ? 'edge' : 'ridge';
}
export function fzoneName(x: number): [string, string] {
  for (const [, a, b, n, s] of FZONES) if (x >= a && x < b) return [n, s];
  return ['Te Wao Nui', 'The Great Forest'];
}

/** the stream: comes out of the ferns behind the walk line, crosses it (the ford) and runs off
 *  toward the camera; it is the same water that fans out over the beach at the stream mouth */
export const FORD = { x: 770, w: 24, flow: 0.06 };
/** the gully: the walk line drops into a creek valley and climbs out again */
export const GULLY = { x: 3462, top0: 3200, bot0: 3392, bot1: 3540, top1: 3730, depth: 50, w: 15, flow: 0.075 };
/** the fallen kauri: a colossal log lying behind the walk line, climbable up its root plate */
export const LOG = { x0: 1488, x1: 2018, h: 70, roots: 1512 };
/** the mud wallows on the walk line (slow going) */
export const WALLOWS: [number, number][] = [[2318, 2482], [2556, 2742], [2810, 2900]];
export const MUD = { x0: 2280, x1: 2960 };

/** story and dressing spots (world x) */
export const FSPOT = {
  exit: 30,
  enter: 92,
  /** Joshu's boot prints in the mud by the ford */
  prints: 812,
  /** a scrap of navy wool on the brambles */
  scrap: 1196,
  /** the lookout at the broken top end of the fallen kauri */
  lookout: 1992,
  /** one sea boot stuck fast in the mud */
  boot: 2648,
  /** where the snoring is first heard */
  snore: 3110,
  /** Joshu, out cold at the bottom of the gully by the creek */
  joshu: 3508,
  /** the Cerebral Tiger's first ambush (Day 2+, with Aroha) */
  tiger: 2196,
  /** the way on, deeper (Day 2+) */
  deeper: 5890,
};

const bump = (x: number, a: number, b: number, h: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI) * h);

/** how far the walk line dips at the ford */
export function fordDip(x: number): number {
  const s = Math.abs(x - FORD.x);
  return s < FORD.w + 40 ? 6 * (1 - smoothstep(FORD.w * 0.55, FORD.w + 40, s)) : 0;
}
/** how far the walk line drops into the gully valley */
export function gullyDip(x: number): number {
  if (x <= GULLY.top0 || x >= GULLY.top1) return 0;
  return GULLY.depth * smoothstep(GULLY.top0, GULLY.bot0, x) * (1 - smoothstep(GULLY.bot1, GULLY.top1, x));
}
/** the creek's own channel at the bottom of the gully */
export function creekDip(x: number): number {
  const c = Math.abs(x - GULLY.x);
  return c < GULLY.w + 26 ? 5 * (1 - smoothstep(GULLY.w * 0.5, GULLY.w + 26, c)) : 0;
}

/** the walk line without the water dips (the water surface level at the fords) */
export function baseY(x: number): number {
  const G = FOREST.G;
  let y = G + Math.sin(x * 0.0042 + 0.7) * 4 + Math.sin(x * 0.013 + 2) * 1.6 + (noise1(x / 90, 7) - 0.5) * 4;
  // the edge: up the bank from the beach path
  y -= 4 * (1 - smoothstep(0, 360, x));
  // root humps where the giants stand close to the path
  y -= bump(x, 1360, 1440, 3) + bump(x, 2090, 2190, 4) + bump(x, 4120, 4220, 3) + bump(x, 4520, 4630, 4);
  // the wallows sit a little low and flat
  y += 3 * smoothstep(MUD.x0, MUD.x0 + 60, x) * (1 - smoothstep(MUD.x1 - 60, MUD.x1, x));
  // the climb toward the ridge
  y -= 44 * smoothstep(4300, 5900, x) + bump(x, 5200, 5420, 6);
  return y + gullyDip(x);
}

/** world y of the walkable surface at x */
export function fgroundY(x: number): number {
  return baseY(x) + fordDip(x) + creekDip(x);
}

/** the top of the fallen kauri (a one-way platform) at x */
export function logTop(x: number): number {
  const t = clamp((x - LOG.x0) / (LOG.x1 - LOG.x0));
  // the root end is the thick end; it tapers a little toward the broken top
  return baseY(LOG.x0 + 30) - LOG.h + 6 + t * 12 + Math.sin(t * 9) * 1.2;
}

/** mud on the walk line (0..1): slows walking, squelches */
export function mudAt(x: number): number {
  let k = 0;
  for (const [a, b] of WALLOWS) k = Math.max(k, smoothstep(a, a + 18, x) * (1 - smoothstep(b - 18, b, x)));
  return k;
}

/** shallow water at the walk line (the fords) */
export function wetAt(x: number): number {
  const s = Math.abs(x - FORD.x);
  if (s < FORD.w + 10) return 1 - smoothstep(FORD.w - 4, FORD.w + 10, s);
  const c = Math.abs(x - GULLY.x);
  if (c < GULLY.w + 8) return 1 - smoothstep(GULLY.w - 3, GULLY.w + 8, c);
  return 0;
}

/** canopy cover overhead, 0..1 (thin at the forest edge and over the stream, deepest in the rātā grove) */
export function canopyAt(x: number): number {
  const edge = smoothstep(80, 520, x);
  const gapStream = 1 - 0.35 * Math.exp(-(((x - FORD.x) / 120) ** 2));
  const gapGully = 1 - 0.25 * Math.exp(-(((x - GULLY.x) / 150) ** 2));
  return clamp((0.55 + 0.45 * edge) * gapStream * gapGully + (fzoneAt(x) === 'rata' ? 0.08 : 0), 0, 1);
}

/** the stream channel in front of the walk line: centre x and half width at row dd */
export function fordAt(dd: number): [number, number] {
  const z = realZ(dd), P = persp(dd);
  const cx = FORD.x + (Math.sin(z * 9 + 0.6) * 15 - z * 30) * P;
  const hw = FORD.w * P * (1 + (noise1(dd / 9, 301) - 0.5) * 0.22) + 6 * Math.exp(-(((dd - 6) / 9) ** 2));
  return [cx, hw];
}
/** the gully creek in front of the walk line */
export function creekAt(dd: number): [number, number] {
  const z = realZ(dd), P = persp(dd);
  const cx = GULLY.x + (Math.sin(z * 8 + 2.2) * 11 + z * 26) * P;
  const hw = GULLY.w * P * (1 + (noise1(dd / 6, 302) - 0.5) * 0.3) + 8 * Math.exp(-(((dd - 7) / 10) ** 2));
  return [cx, hw];
}

/** where the camera rests over the walk line for the layers behind it (screen y of each far layer's
 *  ground line at the base zoom, converging toward eye level the further off it is) */
export function farGroundScreenY(p: number) {
  return 125 + (222.5 - 125) * p;
}

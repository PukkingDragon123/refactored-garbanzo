// V11 Ngā Puke Kōhatu, the Rocky Hills: the geometry shared by the hills' painters (src/art/v11/hills),
// the site (src/game/sites10/hills.ts) and its effects. One long side-view walk up out of the bush
// above Thunder Falls (world x 0..W, west to east), the land running down toward the camera in front
// of the walk line (rows `dd` below the walk line are nearer, the same pinhole mapping as the forest):
//
//   0 ─ Te Tapa Ngahere, the bush line (the last wind-bent beech) ─ 520 ─ Te Pātītī, the tussock basin
//   and its tarn ─ 1150 ─ Te Ara Kirikiri, the scree slope (it slides underfoot) ─ 1620 ─ Ngā Tōka, the
//   tors ─ 2380 ─ Te Pari, the bluff and its overhang (the hunters' camp) ─ 2920 ─ Te Tihi, the ridge
//   top and the long view ─ 3400

import { clamp, noise1, smoothstep } from '../../../core/math';

export const HILLS = {
  W: 3400,
  /** camera bounds */
  minY: -300,
  maxY: 470,
  /** rows of ground plane painted below the walk line */
  DEPTH: 170,
};

/** rows from the walk line up to the vanishing horizon */
export const HOR = 80;
export const persp = (dd: number) => (HOR + Math.max(0, dd)) / HOR;
export const realZ = (dd: number) => Math.max(0, dd) / (HOR + Math.max(0, dd));

export type HZone = 'bush' | 'basin' | 'scree' | 'tors' | 'bluff' | 'ridge';
export const HZONES: [HZone, number, number, string, string][] = [
  ['bush', 0, 520, 'Te Tapa Ngahere', 'The bush line'],
  ['basin', 520, 1150, 'Te Pātītī', 'The tussock basin'],
  ['scree', 1150, 1620, 'Te Ara Kirikiri', 'The scree slope'],
  ['tors', 1620, 2380, 'Ngā Tōka', 'The tors'],
  ['bluff', 2380, 2920, 'Te Pari', 'The bluff'],
  ['ridge', 2920, 3401, 'Te Tihi', 'The ridge top'],
];
export function hzoneAt(x: number): HZone {
  for (const [z, a, b] of HZONES) if (x >= a && x < b) return z;
  return x < 0 ? 'bush' : 'ridge';
}
export function hzoneName(x: number): [string, string] {
  for (const [, a, b, n, s] of HZONES) if (x >= a && x < b) return [n, s];
  return ['Ngā Puke Kōhatu', 'The Rocky Hills'];
}

/** the scree slope: the walk line climbs ~95 px over it, and the loose stones slide downhill */
export const SCREE = { x0: 1150, x1: 1620, rise: 94 };
/** the tarn in the tussock basin, in front of the walk line (ellipse in x and ground-plane rows) */
export const TARN = { x: 905, rx: 120, dd: 44, rdd: 26 };
/** the tors on the walk line: x, base width, height (the first one can be scrambled up) */
export const TORS: [number, number, number][] = [[1790, 156, 150], [2150, 112, 104], [3250, 128, 112]];
/** the bluff behind the walk line and the overhang at its foot */
export const BLUFF = { x0: 2360, x1: 2990, h: 300, mouthX: 2556, mouthW: 230, mouthH: 92 };

/** named spots (world x): other modules hang things off these */
export const HSPOT = {
  exit: 30,
  enter: 90,
  /** the tarn's near shore */
  tarn: TARN.x,
  /** foot of the scramble up the big tor, and its summit */
  torClimb: TORS[0][0] - 54,
  torTop: TORS[0][0],
  /** the hunters' camp under the overhang: fire ring, lean-to, drying rack */
  fire: 2640,
  leanTo: 2716,
  rack: 2580,
  /** the lookout on the ridge top, and the ways on */
  lookout: 3180,
  /** the way on down into the Bone Cliffs gorge (east end) */
  gorge: 3360,
};

const bump = (x: number, a: number, b: number, h: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI) * h);

/** world y of the walk line at x */
export function hgroundY(x: number): number {
  let y = 300 + Math.sin(x * 0.0051 + 0.4) * 3 + Math.sin(x * 0.017 + 1.3) * 1.4 + (noise1(x / 70, 41) - 0.5) * 3.2;
  // up the basin a little, then the scree climb, the tor plateau, the ridge rise
  y -= 8 * smoothstep(380, 1100, x);
  y -= SCREE.rise * smoothstep(SCREE.x0, SCREE.x1, x);
  y -= 52 * smoothstep(2860, 3200, x);
  // humps: a knoll in the basin, the tors' aprons, the bluff's fallen blocks
  y -= bump(x, 640, 780, 5) + bump(x, 1700, 1880, 6) + bump(x, 2080, 2220, 4) + bump(x, 2440, 2520, 3) + bump(x, 3180, 3320, 4);
  return y;
}

/** scree underfoot (0..1): slides downhill, slows the climb */
export function screeAt(x: number): number {
  return smoothstep(SCREE.x0 - 20, SCREE.x0 + 50, x) * (1 - smoothstep(SCREE.x1 - 60, SCREE.x1 + 10, x));
}
/** how exposed to the wind (0..1): sheltered at the bush line and under the bluff, wild on the ridge */
export function windAt(x: number): number {
  const shelter = 1 - 0.5 * Math.exp(-(((x - (BLUFF.mouthX + BLUFF.mouthW / 2)) / 160) ** 2));
  return clamp((0.35 + 0.65 * smoothstep(200, 900, x)) * shelter + 0.25 * smoothstep(2900, 3250, x), 0, 1.2);
}
/** the tarn's water in front of the walk line (> 0 inside) */
export function tarnAt(x: number, dd: number): number {
  const u = (x - TARN.x) / TARN.rx, v = (dd - TARN.dd) / TARN.rdd;
  return 1 - (u * u + v * v) - (noise1(x / 23, 51) - 0.5) * 0.18;
}

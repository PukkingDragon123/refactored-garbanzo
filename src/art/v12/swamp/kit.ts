// V12 Te Repo Raupō, the swamp's art kit: palette ramps (dark → light) for the tannin-black peat water,
// the peat mud, sphagnum, raupō and sedge, duckweed and lily pads, bleached drowned wood, and the
// old planks; and the small helpers every swamp painter shares.

import type { C } from '../../color';
import { hex } from '../../color';
import { clamp, hash2 } from '../../../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));

export const SWP = {
  /** peat water: tea-black, a little olive where the light gets into it */
  peat: r('#050706', '#090c0a', '#0d110d', '#121811', '#182015', '#1f2a1a', '#29361f', '#344326', '#43532f'),
  /** the sky's sheen on the water's skin (the ripple lines) */
  sheen: r('#3c4c48', '#55665e', '#71837a', '#93a49a', '#b8c6bc'),
  mud: r('#0b0806', '#130e0a', '#1c150e', '#261c13', '#312418', '#3d2d1e', '#4a3725', '#5a432d', '#6b5136'),
  /** wet shine on the mud at the waterline */
  wetmud: r('#1a1612', '#2c2620', '#433b31', '#5f564a', '#7f7668'),
  sphag: r('#25300f', '#3b4a1c', '#56682a', '#73883a', '#93a84c', '#b5c464', '#d6dc86'),
  sphagRed: r('#4a1414', '#6e2018', '#93321e', '#b84e2a'),
  /** raupō leaves, green to the yellowed tips */
  raupo: r('#1a240e', '#273616', '#36491c', '#475d22', '#5a722a', '#6f8834', '#879e42', '#a3b556', '#c2cc72'),
  raupoDry: r('#3a2a12', '#56401a', '#735a24', '#927532', '#ae9044', '#c8ab5c', '#e0c87c'),
  /** the brown velvet cigar heads */
  cigar: r('#1a0e08', '#2a170c', '#3c2212', '#4f2e18', '#633b1f', '#784a28', '#8e5c34'),
  /** the pale pollen spike above the head, and the fluff of a seeding head */
  pollen: r('#8a7a3a', '#b0a050', '#d2c46a', '#ece08e'),
  fluff: r('#9a9286', '#bcb6aa', '#dcd8ce', '#f2f0ea'),
  /** carex / pukio sedge: olive, bronze and straw */
  sedge: r('#1e1f0c', '#2f3112', '#434518', '#5a5a1e', '#737226', '#8d8a32', '#a8a244', '#c2ba5c'),
  duck: r('#1c3410', '#2d4a12', '#3f6418', '#55801e', '#6e9a28', '#8cb238', '#aed054'),
  lily: r('#0f2010', '#173018', '#21421f', '#2c5527', '#386a2f', '#468039', '#579645', '#6dac55'),
  lilyRed: r('#3a1418', '#55201f', '#723028', '#8e4232'),
  bloom: r('#8a7a86', '#b8a8b6', '#dcd0da', '#f4eef2', '#fffaff'),
  bloomPink: r('#7a3a52', '#a85272', '#cc7494', '#e8a0b8', '#f8cadc'),
  bloomGold: r('#a87a18', '#d8a828', '#f4d04c'),
  /** bleached drowned wood: silver-grey with a dark, waterlogged foot */
  bone: r('#0f1112', '#1a1d1e', '#272b2b', '#363b39', '#474d49', '#5b615b', '#717770', '#8b9087', '#a6aaa0', '#c3c6bb', '#dfe0d6'),
  /** wet dark wood: stumps, stilts, the hut's poles */
  wood: r('#0c0806', '#160f0a', '#21170f', '#2d2015', '#3a2a1b', '#493522', '#59422b', '#6b5135', '#7e6240'),
  /** old planks, sun-greyed on top */
  plank: r('#14100c', '#211a13', '#30261b', '#413425', '#534431', '#67563f', '#7c6b52', '#928268', '#a99c82', '#c2b79e'),
  rust: r('#2a120a', '#4a2010', '#6e3418', '#924a22'),
  thatch: r('#2a1c0c', '#3e2a12', '#55391a', '#6e4c22', '#89622e', '#a37a3c', '#bb9450', '#d2ae6a'),
  flaxRope: r('#3a2c14', '#5a461e', '#7c6428', '#9e8236', '#bea24a'),
  lichen: r('#4a564c', '#6a786a', '#8c9a88', '#afbba7', '#d0d8c4'),
  stone: r('#121416', '#1c1f21', '#272b2c', '#343938', '#434946', '#545a55', '#676d66', '#7c827a'),
  ink: hex('#07090a'),
};

export const pk = (ramp: C[], v: number): C => ramp[clamp(Math.round(v), 0, ramp.length - 1)];
/** ordered dither offset (±k/2) */
export const dz = (x: number, y: number, k = 0.9) => ((((x & 3) * 4 + (y & 3)) * 7 % 16) / 16 - 0.5) * k;
export const hh = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);

/** jittered cells: id >= 0 when (x, y) is inside a blob of the cell grid; CELL.r, nx, ny describe it */
export const CELL = { r: 0, nx: 0, ny: 0, cx: 0, cy: 0 };
export function cellAt(x: number, y: number, sx: number, sy: number, seed: number, fill: number, rmin = 0.3, rmax = 0.62): number {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let best = 9, id = -1;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hash2(cx, cy, seed);
    if (h > fill) continue;
    const px = (cx + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * sx, py = (cy + 0.2 + hash2(cx, cy, seed + 2) * 0.6) * sy;
    const rr = rmin + hash2(cx, cy, seed + 3) * (rmax - rmin);
    const dx = (x - px) / (sx * rr), dy = (y - py) / (sy * rr);
    const q = dx * dx + dy * dy;
    if (q < 1 && q < best) { best = q; id = h / Math.max(1e-6, fill); CELL.nx = dx; CELL.ny = dy; CELL.cx = px; CELL.cy = py; }
  }
  CELL.r = best;
  return id;
}

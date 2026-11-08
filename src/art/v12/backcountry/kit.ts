// V12 Te Tuawhenua, the backcountry art kit: the palette of the open interior (kānuka bark that peels in
// papery strips and its grey-green fine leaves, mānuka blossom, the charcoal of the burnt ridge with its
// silver sheen, ash, sun-silvered dead wood, braided-river gravel and its milky blue water, river sand,
// the gully's ferns and moss, old bone, the feathered boa's bronze-green plumes and its papery shed
// skin, raked earth at the den, fireweed and bracken in the regrowth) and small shared helpers.

import type { C } from '../../color';
import { hex, mix } from '../../color';
import { bayer, clamp, hash2 } from '../../../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));

/** backcountry ramps, dark -> light */
export const TP = {
  kbark: r('#17120f', '#241d18', '#33291f', '#443628', '#574533', '#6c5640', '#83694f', '#9b7f62', '#b39777', '#cab08f'),
  kpaper: r('#5e4c38', '#7b664c', '#9a8364', '#b6a07e', '#d0bc99', '#e6d6b6'),
  kleaf: r('#0d150f', '#142016', '#1c2c1d', '#253925', '#30472e', '#3d5638', '#4c6643', '#5d774f', '#70885d', '#869a6e'),
  bloom: r('#8a7478', '#b8a2a6', '#dccbcd', '#f1e5e5', '#fffafa'),
  bloomPink: r('#7a3a4c', '#a8566c', '#cc7e92', '#e6a8b6', '#f6d0d8'),
  char: r('#050404', '#0b0909', '#121010', '#1a1716', '#231f1d', '#2e2825', '#3a332e', '#463e37'),
  charSheen: r('#3a3a40', '#55555c', '#76767c', '#9a9aa0'),
  ember: r('#2a0c06', '#4a160a', '#6e240e', '#963a14', '#b8561e'),
  ash: r('#1e1c1b', '#2c2a28', '#3b3835', '#4c4844', '#5f5a55', '#746e67', '#8a837b', '#a19990', '#b8b0a6', '#cec7bd'),
  silver: r('#24211e', '#35312c', '#48433c', '#5d564d', '#736b60', '#8b8275', '#a3998b', '#bbb1a2', '#d1c8b8', '#e4ddcf'),
  gravel: r('#15181b', '#1e2327', '#282e33', '#333a40', '#3f474d', '#4c555b', '#5b646a', '#6c757a', '#7e868a', '#92999c', '#a7adae'),
  quartz: r('#8a8a84', '#b0b0a8', '#d2d2ca', '#ecece4'),
  sand: r('#2e281e', '#3f3828', '#524a35', '#665d44', '#7b7155', '#918667', '#a79c7b', '#bcb190', '#d0c6a6'),
  silt: r('#5a5a50', '#77766a', '#959384', '#b2af9e', '#ccc9b6'),
  river: r('#0c2329', '#123139', '#183f48', '#1f4e57', '#285e66', '#336f75', '#438284', '#589695', '#72aaa6', '#93c0b8', '#b8d8cf'),
  creek: r('#0a1714', '#0f211c', '#152c25', '#1c382f', '#25463a', '#305546', '#3e6553', '#507762'),
  earth: r('#120c08', '#1c140d', '#281c12', '#352518', '#432f1e', '#523a25', '#62462d', '#735336', '#856241'),
  dust: r('#3a3024', '#4e4232', '#645642', '#7a6b54', '#908067', '#a6967c', '#bbad93'),
  bone: r('#2e281f', '#4a4233', '#675d49', '#857a62', '#a3987c', '#bfb597', '#d8cfb2', '#ebe4cd', '#f8f4e6'),
  marrow: r('#3a1e14', '#5a3020', '#7a4a32'),
  plume: r('#0b120e', '#132019', '#1b2e23', '#233d2d', '#2c4d37', '#365e42', '#41704d', '#4e8358', '#5d9664', '#6ea86f'),
  sheen: r('#2a6a6a', '#3c8a86', '#55aaa0', '#7ccab8', '#aee8d6'),
  plumeBar: r('#6a5a34', '#9a8650', '#c6b276', '#e6d8a2', '#f6eed0'),
  skin: r('#3c3628', '#58503c', '#766d54', '#958b6e', '#b2a988', '#ccc4a4', '#e2dcc0', '#f2eedc'),
  blood: r('#1e0a08', '#32100c', '#4a1812', '#62221a'),
  fire: r('#3a0c22', '#5e1638', '#8a2652', '#b43c70', '#d85e92', '#f08cb8', '#fcc0da'),
  bracken: r('#1b220c', '#283212', '#374418', '#48581e', '#5a6c26', '#6e8030', '#84943c', '#9cab4a'),
  brackenDry: r('#3a2410', '#563618', '#734a22', '#8e5e2e', '#a8743c', '#c08c4e'),
  lichen: r('#4c564a', '#6a7666', '#8a9884', '#aab8a2', '#c8d4bc', '#e0e8d4'),
  lichenGold: r('#5a4410', '#866418', '#b08a24', '#d4b03a', '#ecd060'),
  rock: r('#141619', '#1c1f23', '#25292d', '#2f3439', '#3a4045', '#474d52', '#555b60', '#656b6f', '#777c7e', '#8b8f90', '#a1a4a3', '#b8bab7'),
  rockWarm: r('#19161a', '#231f22', '#2e292b', '#3a3435', '#474041', '#564e4d', '#665d5b', '#786e6a', '#8b807a', '#a0948c', '#b6aaa0'),
};

export const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];
export const hazeRamp = (rp: C[], fog: C, k: number) => rp.map(c => mix(c, fog, k));
/** a stable 0..1 hash for integer pixel coords */
export const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
/** a 4x4 ordered dither offset centred on 0 */
export const dz = (x: number, y: number, k = 0.9) => (bayer(Math.floor(x), Math.floor(y)) - 0.5) * k;

/** jittered cells (stones, clumps, litter): the cell's hash or -1; CL.r normalised distance, CL.nx/ny offset */
export const CL = { r: 0, nx: 0, ny: 0 };
export function cell(x: number, y: number, sx: number, sy: number, seed: number, fill: number, square = 0): number {
  const fx = x / sx, fy = y / sy, gx = Math.floor(fx), gy = Math.floor(fy);
  // (a blob's centre sits 0.2..0.8 into its cell and reaches at most 0.62 of a cell, so only the
  // neighbours on this pixel's side of the cell can reach it: 2 x 2 cells, not 3 x 3)
  const i0 = fx - gx < 0.5 ? -1 : 0, j0 = fy - gy < 0.5 ? -1 : 0;
  let best = 9, id = -1;
  for (let j = j0; j <= j0 + 1; j++) for (let i = i0; i <= i0 + 1; i++) {
    const cx = gx + i, cy = gy + j;
    const h = hash2(cx, cy, seed);
    if (h > fill) continue;
    const px = (cx + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * sx, py = (cy + 0.2 + hash2(cx, cy, seed + 2) * 0.6) * sy;
    const rr = 0.3 + hash2(cx, cy, seed + 3) * 0.32;
    const dx = (x - px) / (sx * rr), dy = (y - py) / (sy * rr);
    const q = square ? Math.max(dx * dx + dy * dy, (Math.abs(dx) + Math.abs(dy)) ** 2 * square) : dx * dx + dy * dy;
    if (q < 1 && q < best) { best = q; id = h; CL.nx = dx; CL.ny = dy; }
  }
  CL.r = best;
  return id;
}

/**
 * A coarse value-noise field for big painters (far bands, the floor): hashes on a cx x cy lattice over
 * world x [x0, x0 + W + mx) and rows [y0, y0 + H), sampled with a smoothed bilinear blend. Several times
 * cheaper than noise2 per pixel, and seamless across chunks (the lattice is in absolute coordinates).
 */
export function vgrid(x0: number, W: number, y0: number, H: number, cx: number, cy: number, seed: number, mx = 0): (x: number, y: number) => number {
  const i0 = Math.floor(x0 / cx) - 2, j0 = Math.floor(y0 / cy) - 2;
  const gw = Math.ceil((W + mx) / cx) + 6, gh = Math.ceil(H / cy) + 6;
  const g = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g[j * gw + i] = hash2(i + i0, j + j0, seed);
  return (x: number, y: number) => {
    const fx = x / cx - i0, fy = y / cy - j0;
    let i = Math.floor(fx), j = Math.floor(fy);
    let u = fx - i, v = fy - j;
    if (i < 0) { i = 0; u = 0; } else if (i > gw - 2) { i = gw - 2; u = 1; }
    if (j < 0) { j = 0; v = 0; } else if (j > gh - 2) { j = gh - 2; v = 1; }
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const k = j * gw + i, a = g[k], b = g[k + 1], c = g[k + gw], d = g[k + gw + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** a Voronoi partition (every pixel in some cell): VO.id the cell's hash, VO.e how far to the nearest
 *  edge (px, small = on a crack), VO.dx/dy the offset from the cell's centre over the cell size */
export const VO = { id: 0, e: 9, dx: 0, dy: 0 };
export function vor(x: number, y: number, sx: number, sy: number, seed: number) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let d1 = 1e9, d2 = 1e9, id = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const qx = gx + i, qy = gy + j;
    const px = (qx + 0.1 + hash2(qx, qy, seed) * 0.8) * sx, py = (qy + 0.1 + hash2(qx, qy, seed + 1) * 0.8) * sy;
    const dx = x - px, dy = (y - py) * (sx / sy);
    const d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = hash2(qx, qy, seed + 2); bx = dx; by = dy; } else if (d < d2) d2 = d;
  }
  VO.id = id; VO.e = Math.sqrt(d2) - Math.sqrt(d1); VO.dx = bx / sx; VO.dy = by / sx;
}

// Region Map painter kit: map size, palette ramps (borrowed from the palm beach, the great forest and
// the sea so the map reads as the same world), time slicing, and the screen buffer the diorama is
// painted into (colour, the sketch's outline mask, animation tags, the sprite-shadow mask).

import { C, hex, mix, rgba, R, G, B as BL, A } from '../../../art/color';
import { bayer, clamp } from '../../../core/math';
import { MAP_W, MAP_H } from '../../../game/v10/atlasgeo';

export const W = MAP_W, H = MAP_H, N = W * H;

/** the pen's inks (the paper sketch, notes, marks) */
export const INK = hex('#3a2614'), INK2 = hex('#5e4026'), INK3 = hex('#8a6c48'), INK_RED = hex('#a8382a'), INK_BLUE = hex('#2e5a78');

/** pixel tags: what the live map animates */
export const TAG = { gust: 1, glow: 2, crown: 3, lava: 4, fall: 5, fungi: 6, lights: 7, ember: 8 } as const;
/** water kinds */
export const WK = { none: 0, sea: 1, river: 2, lake: 3, channel: 4, pool: 5, fall: 6, hot: 7 } as const;

const r = (...h: string[]): C[] => h.map(x => hex(x));

/** ramps, dark -> light */
export const P = {
  // ground
  grass: r('#1c3a20', '#244a26', '#2f5c2a', '#3d6e2e', '#4e8434', '#649a3a', '#7eb044', '#9cc452'),
  meadow: r('#2a4a22', '#365c26', '#456e2a', '#56822e', '#6a9634', '#82aa3e', '#9cbe4c', '#b8d262'),
  floor: r('#0c1a12', '#112218', '#172c1c', '#1e3622', '#264228'),
  sand: r('#9a7448', '#b48c5a', '#cea872', '#e2c48c', '#f0d8a2', '#f6e4b2', '#fbf0cc'),
  wetsand: r('#7a6040', '#8e7250', '#a48660', '#b89a72'),
  dune: r('#a08454', '#b89a64', '#ccb076', '#dcc488', '#e8d49a'),
  tuss: r('#4c3c1c', '#665024', '#80682e', '#9a823a', '#b49c4a', '#cab45e', '#dcca74', '#ecdc90'),
  alpine: r('#3a4228', '#4a5430', '#5c663a', '#707a46', '#868e54', '#9ca264'),
  rock: r('#24231e', '#34322c', '#46433b', '#5a564c', '#706b5e', '#878172', '#a09a88', '#bcb6a2', '#d6d0bc'),
  granite: r('#3a3832', '#4e4b44', '#646058', '#7c776c', '#958f82', '#aea89a', '#c6c0b0', '#dedac8'),
  basalt: r('#141313', '#1e1c1b', '#2a2725', '#373330', '#46413c', '#58524a', '#6c655a'),
  snow: r('#7c8eae', '#93a6c4', '#acbed6', '#c6d6e6', '#dde8f2', '#eef4f9', '#ffffff'),
  mud: r('#1e160e', '#2a2014', '#382a1c', '#463624', '#56442e', '#685438'),
  swamp: r('#1a2216', '#222c1c', '#2c3822', '#36442a', '#425032', '#4e5c3a'),
  strata: r('#6a3220', '#8a4428', '#a85a32', '#c27640', '#d49456', '#e2b070', '#ecca90', '#f4e0b4'),
  earth: r('#2a1a10', '#3a2616', '#4c341e', '#604428', '#765634', '#8c6a42'),
  silica: r('#a49c88', '#bcb4a0', '#d4ceba', '#e8e4d4', '#f6f4ea', '#ffffff'),
  sulphur: r('#8a7c20', '#a89a2a', '#c8b836', '#e2d24a', '#f2e670'),
  ochre: r('#7a3a14', '#9c4c1a', '#be6422', '#d8802e', '#e8a040', '#f0c060'),
  garden: r('#3e5a22', '#4c6c28', '#5e7e30', '#70903a', '#86a444'),
  soilrow: r('#4a3218', '#5e4020', '#74502a', '#8a6234'),
  marae: r('#6a5a3a', '#7e6c48', '#928056', '#a69466', '#b8a878'),
  glowfloor: r('#040c12', '#06121a', '#0a1a22', '#0e222c', '#142c36'),
  // trees
  tawa: r('#0a1c14', '#11291a', '#183822', '#21482a', '#2c5a30', '#386e36', '#48823c', '#5e9846', '#7aae52'),
  puriri: r('#081812', '#0e2418', '#14321e', '#1c4226', '#25522c', '#2f6434', '#3c763c', '#4e8a46'),
  mahoe: r('#10241a', '#183420', '#224628', '#2e5a30', '#3c6e36', '#4e843c', '#649a46', '#80b252', '#9cc85e'),
  rimu: r('#0a1c16', '#10281c', '#183622', '#22462a', '#2e5832', '#3c6a3a', '#4e7e44', '#64924e'),
  kauri: r('#0c2020', '#12302c', '#1a4036', '#245240', '#30644a', '#3e7654', '#50885e', '#689c6c', '#84b082'),
  fern: r('#0e2a14', '#163c1a', '#205022', '#2c662a', '#3a7e32', '#4c963a', '#62ae44', '#80c454', '#a2d86a'),
  beech: r('#1c2a14', '#26381a', '#324820', '#405a26', '#506e2c', '#628234', '#78983e', '#90ae4a', '#aac25c'),
  mang: r('#141e14', '#1c2a1a', '#263620', '#304428', '#3c5230', '#4a6238', '#5a7242', '#6c844e'),
  pohu: r('#0c1a12', '#122418', '#1a321e', '#224026', '#2c502e', '#386036', '#467040'),
  bloom: r('#4a0a10', '#6e1018', '#94161e', '#b81e24', '#d82c2c', '#ee4a3a'),
  kowhai: r('#5a4a0e', '#8a7414', '#b89a1c', '#dcbe2a', '#f2da48', '#fff08a'),
  palm: r('#143018', '#1e421e', '#2a5824', '#386e2a', '#4a8632', '#5e9c3a', '#78b246', '#96c858', '#b4da6e'),
  glowc: r('#03080e', '#061018', '#0a1a24', '#0e2430', '#14303c', '#1c3e4a', '#264e58'),
  trunk: r('#1a120c', '#2a1c12', '#3c2a1a', '#503a24', '#664c30'),
  bark: r('#3a3a34', '#504e46', '#686458', '#827c6e', '#9c9686', '#b6b0a0'),
  // built
  wood: r('#1c1208', '#2c1e10', '#3e2c18', '#544022', '#6c542e', '#86683a', '#a0804a'),
  thatch: r('#3e2a12', '#5a3e1a', '#785424', '#966c30', '#b4883e', '#ccA052', '#e0bc6c'),
  carve: r('#4a0e0a', '#6e1610', '#942418', '#b83622', '#d64e30'),
  canvas: r('#6e6a5e', '#8e8a7c', '#aeaa9a', '#ccc8b8', '#e4e0d0', '#f6f4ea'),
  stone: r('#4a4840', '#5e5b52', '#747066', '#8a857a', '#a29c90', '#bab4a6', '#d0cabc'),
  bone: r('#6e604c', '#8e806a', '#ae9e84', '#cabca0', '#e2d6bc', '#f2eada'),
};

/** the sea, shallow -> deep (from the lagoon water and the calm open sea) */
export const SEA = {
  foam: r('#bfe9e8', '#e2f8f5', '#ffffff'),
  lagoon: r('#9ae8dc', '#7fe3d2', '#62d4cc', '#4cc4c6', '#3bb2be', '#2f9db6'),
  mid: r('#2c8cb4', '#2a7eae', '#2670a6', '#22649c', '#1e5890', '#1a4c84'),
  deep: r('#184478', '#163e6e', '#143864', '#12325a', '#102c50', '#0e2646'),
  abyss: r('#0c2040', '#0a1a36', '#08152c', '#071224', '#06101e'),
  reef: r('#2a9a94', '#3cb0a0', '#52c4ac', '#6cd6b8', '#90e6c8'),
  coral: r('#f06a6a', '#f4a050', '#f2d050', '#e47ac0', '#b86ae0', '#f4f0d8'),
  kelp: r('#1a2a14', '#24381a', '#304620', '#3e5628', '#4e6430'),
  murk: r('#1c2a22', '#24342a', '#2c3e30', '#364836', '#40523c'),
  sandbed: r('#8ad8c8', '#a2e4d0', '#b8eed8', '#cef4e0'),
  wave: hex('#5aa8d4'), wave2: hex('#8ccce8'), glint: hex('#f4fcff'),
};
export const RIVER = r('#173c52', '#1e4c64', '#26607a', '#2e7290', '#3c86a4', '#5aa0bc', '#84bed2', '#b6dce8');
export const HOTW = r('#1a7a8a', '#2496a4', '#36b2b8', '#56cccc', '#86e2dc', '#b8f2ea');

// ------------------------------------------------------------------ helpers
export const lum = (c: C) => (R(c) * 0.299 + G(c) * 0.587 + BL(c) * 0.114) / 255;
export const darken = (c: C, k: number) => rgba(R(c) * k, G(c) * k, BL(c) * k, A(c));
/** tint toward a colour */
export const tint = (c: C, t: C, k: number) => mix(c, t, k);
export const SHADE = hex('#0a1430');
/** a cast shadow on a colour: darker and cooler */
export const shadowed = (c: C, k = 0.62) => { const d = mix(c, SHADE, 0.22); return rgba(R(d) * k, G(d) * k, BL(d) * (k + 0.08)); };

/** posterised ramp lookup: flat bands with an ordered-dither seam between them */
export function band(ramp: C[], v: number, x: number, y: number, seam = 2.4): C {
  const n = ramp.length - 1;
  const f = clamp(v) * n;
  const i = Math.floor(f), t = f - i;
  const th = clamp((t - 0.5) * seam + 0.5);
  return ramp[Math.min(n, i + (th > bayer(x, y) ? 1 : 0))];
}
/** plain nearest ramp entry */
export const pickR = (ramp: C[], v: number) => ramp[clamp(Math.round(clamp(v) * (ramp.length - 1)), 0, ramp.length - 1)];

let tSlice = 0, noYield = false;
/** in a worker: never yield (nothing else needs the thread) */
export const setNoYield = (v: boolean) => { noYield = v; };
/** yield to the browser when this slice has run long enough */
export async function slice(budget = 12) {
  if (noYield) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - tSlice < budget) return;
  await new Promise<void>(res => setTimeout(res, 0));
  tSlice = typeof performance !== 'undefined' ? performance.now() : Date.now();
}
export const resetSlice = () => { tSlice = typeof performance !== 'undefined' ? performance.now() : Date.now(); };

// ------------------------------------------------------------------ the screen buffer
/** the painted map in screen space (after the 3/4 lift) */
export class Scr {
  readonly col = new Uint32Array(N);
  /** sketch outline: 0 none, 1 ink, 2 blue (water), 3 light */
  readonly edge = new Uint8Array(N);
  readonly tag = new Uint8Array(N);
  /** 1: already darkened by a sprite shadow (no double shadows) */
  readonly shd = new Uint8Array(N);
  /** what each screen pixel shows: 0 land surface, 1 cliff face, 2 water, 3 sprite */
  readonly kind = new Uint8Array(N);
  /** ground row each screen pixel shows (-1 none) */
  readonly gy = new Int16Array(N);
  /** water kind under each screen pixel */
  readonly wat = new Uint8Array(N);
  /** screen-space distance to the visible coastline (sea pixels; 255 far) */
  readonly sea = new Uint8Array(N);
  /** river flow phase (screen) */
  readonly flow = new Uint8Array(N);

  set(x: number, y: number, c: C, tag = 0, edge = 0) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    this.col[i] = c; this.tag[i] = tag; this.edge[i] = edge; this.shd[i] = 0; this.kind[i] = 3;
  }
  get(x: number, y: number): C { x = x | 0; y = y | 0; return x < 0 || y < 0 || x >= W || y >= H ? 0 : this.col[y * W + x]; }
  /** blend toward c by k */
  mixAt(x: number, y: number, c: C, k: number) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    this.col[i] = mix(this.col[i], c, k);
  }
  /** a cast shadow (once per pixel until something is painted over it) */
  shadow(x: number, y: number, k = 0.62) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (this.shd[i]) return;
    this.shd[i] = 1;
    this.col[i] = shadowed(this.col[i], k);
  }
}

// Shared toolkit for the V2 environment art kit (jungle-*.ts and castaway-*.ts).
//
// Not part of the public game API (use jungle.ts / castaway.ts), but everything here is typed and
// reusable: the Sprite type, jungle palettes, periodic noise for tileable strips, a cached
// leaf-stamp rasteriser, the tone-pass leaf-mass painter (layered clusters lit from the top-left),
// fern fronds, strap leaves, tubes, vines, moss, cleanup passes (despeckle, selective outline,
// rim light) and a tiny pixel font.
//
// Conventions
// - Light comes from the top-left. Shadows shift toward cool teal/blue, highlights toward warm
//   yellow-green (see the JP ramps: index 0 = darkest).
// - "Tone" = ramp index offset. Leaf stamps store per-pixel tones (-2..+1) that are added to a
//   base index, so one stamp shape can be painted at any brightness of any ramp.
// - Everything is deterministic: Rng / hash2 with fixed seeds, never Math.random().

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, rgba, R, G, B, A } from './color';
import { Rng, clamp, hash2, TAU } from '../core/math';

/** A sprite: pixels plus an anchor (usually the bottom-centre ground contact), optional emissive layer. */
export interface Sprite {
  buf: PixelBuffer;
  /** anchor x in pixels from the left edge of buf */
  ax: number;
  /** anchor y in pixels from the top edge of buf */
  ay: number;
  /** emissive pixels (same size & anchor as buf), drawn additively / unlit by the game */
  glow?: PixelBuffer;
}

export type Ramp = C[];
const r = (...h: string[]): Ramp => h.map(x => hex(x));

/** Jungle palette ramps, dark -> light, hue-shifted (cool teal shadows, warm lime highlights). */
export const JP = {
  canopy: r('#061217', '#0a1f24', '#0f2e2e', '#15413a', '#1d5843', '#2a714b', '#3f8b50', '#62a853', '#96c65c', '#cde27c'),
  canopyOlive: r('#0b1612', '#142419', '#1f3420', '#2d4725', '#3e5c2a', '#52732f', '#6b8b35', '#8aa53e', '#b1c254', '#d9df7c'),
  fern: r('#07170f', '#0c2517', '#133a20', '#1b5128', '#266b30', '#358638', '#4fa23e', '#74bd48', '#a6d65e', '#d4ec86'),
  silver: r('#2c3a39', '#445856', '#63797a', '#88a0a0', '#afc6c3', '#d4e6e1', '#f0faf5'),
  flax: r('#10160c', '#1b2512', '#283618', '#37481c', '#475b20', '#5a6d25', '#6f802b', '#899534', '#a8ab45', '#cbc566'),
  flaxEdge: r('#3a160b', '#5c2410', '#853616', '#ab4c1d', '#cc6a2a'),
  kawakawa: r('#0b2013', '#123219', '#1b4820', '#276226', '#357e2d', '#469a34', '#5db53d', '#80cc4c', '#addf69', '#dcf29a'),
  taro: r('#06141a', '#0a2123', '#0f312e', '#154437', '#1c5a41', '#28724b', '#398c55', '#53a760', '#7ac273', '#b0dc96'),
  moss: r('#121c0c', '#1b2a10', '#283c14', '#365018', '#46661c', '#577c22', '#6b922b', '#83aa36', '#a2c24c', '#c6da74'),
  youngFrond: r('#2a0e0c', '#46181a', '#652520', '#853628', '#a44a32', '#bf643f', '#d4834f', '#e3a267', '#eec38a', '#f5dfae'),
  mossBright: r('#131e0b', '#1e3010', '#2c4514', '#3c5c18', '#4f761c', '#65901f', '#7fab26', '#9dc435', '#c1da55', '#e3ee8a'),
  lichen: r('#4e5c52', '#71806f', '#96a48c', '#bac7a9', '#dde6c8'),
  kauri: r('#121517', '#1c2124', '#262d30', '#333b3d', '#434c4c', '#555f5d', '#6a7470', '#818a82', '#9ea497', '#c0c3b1'),
  rata: r('#130c0a', '#21140f', '#301d16', '#41281e', '#533428', '#664233', '#7b523f', '#92654e', '#ab7d63', '#c79c80'),
  astelia: r('#18241f', '#253830', '#344c40', '#466251', '#5a7a64', '#729379', '#8fae92', '#b2c9ae', '#d5e4cd'),
  kauriLeaf: r('#0a1511', '#122119', '#1b3021', '#264128', '#33542e', '#436834', '#577d3a', '#6f9442', '#8cab4f', '#b1c66a'),
  fig: r('#12100e', '#1e1a16', '#2b261f', '#3a332a', '#4c4337', '#605545', '#766954', '#8f8166', '#ab9d7f', '#cabd9f'),
  fernTrunk: r('#0b0706', '#150e0a', '#20150e', '#2d1d13', '#3c2819', '#4e3520', '#634429', '#7b5633'),
  skirt: r('#1f1109', '#351c0d', '#4f2a10', '#6b3a15', '#8a4e1b', '#a86624', '#c38436', '#d9a454'),
  nikau: r('#161a16', '#242922', '#343b30', '#474f40', '#5c6552', '#737c66', '#8e967d', '#adb398'),
  nikauShaft: r('#0d2118', '#153322', '#1f482b', '#2c6135', '#3d7c3f', '#53974a', '#71b25a', '#98cb72'),
  palmTrunk: r('#1a1510', '#2a2219', '#3c3024', '#51412f', '#68543d', '#81694e', '#9c8262', '#b89e7c', '#d3bd9c'),
  palmLeaf: r('#0c1b0f', '#142b16', '#1f401d', '#2c5724', '#3c702a', '#508a31', '#69a439', '#88bd45', '#afd35c', '#d8e785'),
  bark: r('#140e0b', '#211712', '#2f2119', '#3f2d21', '#523b2b', '#684b36', '#7f5d43', '#997352', '#b58e69', '#cfad8a'),
  wood: r('#1c120c', '#2f1e13', '#442c1b', '#5a3c25', '#724e30', '#8c633d', '#a67b4f', '#c09666', '#d9b384', '#ecd1a7'),
  deadwood: r('#15100d', '#231a15', '#33271f', '#45362b', '#594738', '#6e5a48', '#85705c', '#9f8a73', '#baa68e'),
  soil: r('#0c0806', '#170f0b', '#231710', '#312017', '#402b1e', '#523826', '#674830', '#7e5b3c', '#977149'),
  litter: r('#2a1a0e', '#452a13', '#633c18', '#80511f', '#9c6a2b', '#b5853e', '#cba259', '#dcbf7e'),
  rock: r('#0e1013', '#171a1e', '#20242a', '#2b3037', '#373d45', '#454c54', '#565e65', '#6a7277', '#80888b', '#9ea4a4'),
  rockWarm: r('#15110f', '#211b18', '#2e2622', '#3c332d', '#4b4139', '#5c5146', '#706456', '#877a69', '#a0937f'),
  red: r('#300709', '#4f0c10', '#741317', '#9c1c1d', '#c32a24', '#e2412c', '#f5663d', '#ff9460', '#ffc08c'),
  pink: r('#3d0f24', '#651a3a', '#902a52', '#b93f6a', '#dc5f85', '#f089a3', '#fbb9c6', '#fde2e6'),
  violet: r('#150b26', '#241240', '#351b5c', '#4a267b', '#613499', '#7c49b6', '#9b68cf', '#bd91e2', '#dcbff2'),
  blueShroom: r('#07142e', '#0c2150', '#12337c', '#1b49a8', '#2863cf', '#3f83e8', '#66a6f5', '#9ccafb', '#d2e9ff'),
  glowCyan: r('#062226', '#0a3a3f', '#0e5a5c', '#12817c', '#1aa99c', '#3fd1c1', '#8ff0e0', '#dafff5'),
  glowWarm: r('#2a1204', '#4f2206', '#7c3a0a', '#ab5a12', '#d8801e', '#f3a93a', '#ffd070', '#fff0b8'),
  cream: r('#2e2a22', '#4a4334', '#686049', '#8a8062', '#aca27f', '#cbc29f', '#e6dfc1', '#f8f4e2'),
  tan: r('#23150c', '#3b2413', '#56361b', '#724a25', '#8f6232', '#ab7d44', '#c59a5c', '#dcb97c', '#efd8a4'),
  orange: r('#301005', '#521b07', '#79290b', '#a13b10', '#c95117', '#e86d22', '#f79238', '#fdb95e', '#ffdb94'),
  gold: r('#2e1e05', '#4f3308', '#77500d', '#9e6c14', '#c48b1f', '#e2ab33', '#f4c955', '#fde38c'),
  bone: r('#2e2a24', '#4d463b', '#6e6655', '#908671', '#b0a68e', '#cdc4ab', '#e5dec9', '#f7f3e6'),
  canvas: r('#1f1d13', '#2f2c1b', '#413d25', '#554f2f', '#6a6339', '#7f7745', '#968d55', '#ada46a', '#c6bd86', '#ddd6a8'),
  khaki: r('#211e12', '#34301b', '#4a4424', '#615a2e', '#79713a', '#918948', '#aaa15a', '#c3ba74', '#dad395'),
  metal: r('#0e1114', '#191e22', '#252c31', '#333b41', '#434c52', '#566066', '#6c767b', '#879094', '#a8b0b1', '#cdd2d0'),
  rust: r('#1d0d07', '#33170b', '#4d220f', '#693014', '#85401b', '#a05426', '#b86c36', '#cd8a50'),
  sand: r('#3d3122', '#5a4a33', '#7a6647', '#9b845c', '#b89f72', '#cfb68a', '#e0caa0', '#ecdab6', '#f6ead0'),
  sandWet: r('#2a2219', '#3a3024', '#4c3f2f', '#5f503c', '#72614a', '#877459', '#9c886b'),
  sea: r('#061321', '#0a1f33', '#0f2d48', '#153d5d', '#1d5073', '#276487', '#337a99', '#4692ab', '#63abbb', '#8cc6cc', '#c0e3de'),
  white: r('#23262c', '#3c414a', '#5a606a', '#7c828c', '#a0a6ad', '#c3c8cb', '#e0e3e1', '#f7f7f0'),
  navy: r('#0a0f1f', '#111a33', '#1a274a', '#243662', '#30477b', '#405c94', '#5775ad', '#7593c4'),
  skin: r('#3b2219', '#5c3524', '#82503a', '#a86d4f', '#c98e68', '#e4b287', '#f5d3aa'),
};

/** Direction toward the key light (top-left), normalised. */
export const LIGHT: [number, number] = [-0.6, -0.8];

/** Clamped ramp lookup (rounds i). */
export const rc = (rp: Ramp, i: number): C => rp[i <= 0 ? 0 : i >= rp.length - 1 ? rp.length - 1 : Math.round(i)];

/** Mix every colour of a ramp toward a fog colour (for pre-hazed background layers). */
export function haze(rp: Ramp, fog: C, k: number): Ramp {
  return rp.map(c => mix(c, fog, k));
}

/** Re-sample a ramp to lower contrast: keep n steps between indices a..b (inclusive). */
export function subRamp(rp: Ramp, a: number, b: number, n = b - a + 1): Ramp {
  const out: Ramp = [];
  for (let i = 0; i < n; i++) out.push(rp[Math.round(a + ((b - a) * i) / Math.max(1, n - 1))]);
  return out;
}

/** Saturation / value boost for "collectible" accents. */
export function vivid(c: C, k = 0.12): C {
  const r0 = R(c), g0 = G(c), b0 = B(c);
  const m = (r0 + g0 + b0) / 3;
  const f = (v: number) => clamp(m + (v - m) * (1 + k) + k * 22, 0, 255);
  return rgba(f(r0), f(g0), f(b0), A(c));
}

export const mod = (a: number, n: number) => ((a % n) + n) % n;

// ------------------------------------------------------------------ periodic noise (tileable strips)

/** 1D value noise periodic with `period` lattice cells. */
export function pnoise1(x: number, period: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(mod(i, period), 0, seed), b = hash2(mod(i + 1, period), 0, seed);
  return a + (b - a) * u;
}
/** Periodic fBm: x in lattice units at the base octave, exactly periodic over `period` cells. */
export function pfbm1(x: number, period: number, oct = 4, seed = 0): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += pnoise1(x * f, period * f, seed + i * 17) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}
/** 2D value noise periodic in x only. */
export function pnoise2(x: number, y: number, period: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = mod(ix, period), x1 = mod(ix + 1, period);
  const a = hash2(x0, iy, seed), b = hash2(x1, iy, seed), c = hash2(x0, iy + 1, seed), d = hash2(x1, iy + 1, seed);
  const top = a + (b - a) * ux, bot = c + (d - c) * ux;
  return top + (bot - top) * uy;
}
export function pfbm2(x: number, y: number, period: number, oct = 3, seed = 0): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += pnoise2(x * f, y * f, period * f, seed + i * 31) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

/** Cheap smooth 1D noise (non periodic) for silhouettes. */
export function n1(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(i, 7, seed), b = hash2(i + 1, 7, seed);
  return a + (b - a) * u;
}

/**
 * Call fn at x, and again at x ± W when the item (half-extent `ext`) crosses a strip edge.
 * Used for seamless horizontal tiling while keeping painter's order.
 */
export function wrapX(W: number | undefined, x: number, ext: number, fn: (x: number) => void) {
  fn(x);
  if (!W) return;
  if (x - ext < 0) fn(x + W);
  if (x + ext >= W) fn(x - W);
}

/** Set a pixel, wrapping x into [0, W) when W is given (closure-free hot path). */
export function setW(buf: PixelBuffer, x: number, y: number, c: C, W?: number) {
  const yy = Math.floor(y);
  if (yy < 0 || yy >= buf.h) return;
  let xx = Math.floor(x);
  if (W) xx = ((xx % W) + W) % W;
  else if (xx < 0 || xx >= buf.w) return;
  buf.data[yy * buf.w + xx] = c;
}

// ------------------------------------------------------------------ leaf stamps

export type LeafShape = 'oval' | 'point' | 'heart' | 'blade' | 'round' | 'lance' | 'drop';

export interface Stamp {
  w: number;
  h: number;
  /** pixel offset of the leaf base inside the stamp */
  ox: number;
  oy: number;
  /** per-pixel tone, EMPTY = transparent */
  t: Int8Array;
}
export const EMPTY = -128;
const stampCache = new Map<number, Stamp>();
const ANG = 32;
const SHAPE_ID: Record<LeafShape, number> = { oval: 1, point: 2, heart: 3, blade: 4, round: 5, lance: 6, drop: 7 };

function profile(shape: LeafShape, t: number): number {
  switch (shape) {
    case 'oval': return Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
    case 'round': return Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));
    case 'point': return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.75))), 0.75);
    case 'lance': return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.62))), 0.9);
    case 'heart': {
      // wide rounded base with a notch at the stem, tapering to a point
      const s = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.55))), 0.7);
      return t < 0.1 ? s * (0.55 + t * 4.5) : s;
    }
    case 'drop': return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.5))), 0.6);
    case 'blade': return Math.pow(Math.max(0, 1 - t), 0.6) * (t < 0.08 ? 0.7 + t * 3.7 : 1);
  }
}

/**
 * Rasterise (and cache) a leaf of length len / width wid pointing along angle ang (radians, 0 = +x,
 * PI/2 = down). Tones: +1 lit edge / tip, 0 lit half, -1 shadow half & midrib, -2 shadow edge.
 */
export function leafStamp(shape: LeafShape, len: number, wid: number, ang: number): Stamp {
  const L = Math.max(2, Math.round(len)), W = Math.max(1, Math.round(wid * 2) / 2);
  let ai = Math.round((ang / TAU) * ANG) % ANG;
  if (ai < 0) ai += ANG;
  const key = ((SHAPE_ID[shape] * 64 + Math.min(63, L)) * 64 + Math.min(63, W * 2)) * ANG + ai;
  const hit = stampCache.get(key);
  if (hit) return hit;
  const a = (ai / ANG) * TAU, ca = Math.cos(a), sa = Math.sin(a);
  const hw = W / 2;
  const x0 = Math.floor(Math.min(0, ca * L) - hw - 1), x1 = Math.ceil(Math.max(0, ca * L) + hw + 1);
  const y0 = Math.floor(Math.min(0, sa * L) - hw - 1), y1 = Math.ceil(Math.max(0, sa * L) + hw + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const t = new Int8Array(w * h).fill(EMPTY);
  const nvx = -sa, nvy = ca;
  const plusLit = nvx * LIGHT[0] + nvy * LIGHT[1] > 0;
  const facing = Math.abs(nvx * LIGHT[0] + nvy * LIGHT[1]);
  let count = 0;
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const dx = px + x0, dy = py + y0;
      const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (u < -0.4 || u > L + 0.2) continue;
      const tt = clamp(u / L, 0, 1);
      const half = Math.max(W <= 1.5 ? 0.55 : 0.5, profile(shape, tt) * hw);
      const av = Math.abs(v);
      if (av > half) continue;
      const lit = (v >= 0) === plusLit;
      let tone: number;
      if (W <= 1.5) tone = tt > 0.7 ? 0 : -1;
      else if (W <= 2.5) tone = lit ? 0 : -1;
      else {
        const edge = av > half - 1;
        tone = lit ? (edge && facing > 0.25 ? 1 : 0) : edge ? -2 : -1;
        if (W >= 4.5 && av < 0.5 && tt > 0.08 && tt < 0.82) tone = -1;
      }
      if (tt > 0.86 && L >= 5 && lit) tone = Math.max(tone, 0);
      t[py * w + px] = tone;
      count++;
    }
  if (count === 0) t[(-y0) * w + -x0] = 0;
  const s: Stamp = { w, h, ox: -x0, oy: -y0, t };
  stampCache.set(key, s);
  return s;
}

/** Stamp draw counter (debug/perf). */
export const STATS = { stamps: 0 };
const LUT = new Uint32Array(8);

/** Paint a stamp with base ramp index `base`. mode: 0 set (default), 1 only transparent dest, 2 only opaque dest. */
export function drawStamp(buf: PixelBuffer, s: Stamp, x: number, y: number, rp: Ramp, base: number, mode: 0 | 1 | 2 = 0, toneK = 1) {
  STATS.stamps++;
  const bx = Math.round(x) - s.ox, by = Math.round(y) - s.oy;
  const n = rp.length - 1;
  // tone -> colour lookup for tones -2..+2 (index tone + 2)
  for (let t = -2; t <= 2; t++) {
    let k = Math.round(base + t * toneK);
    k = k < 0 ? 0 : k > n ? n : k;
    LUT[t + 2] = rp[k];
  }
  const d = buf.data, W = buf.w, H = buf.h;
  const j0 = Math.max(0, -by), j1 = Math.min(s.h, H - by);
  const i0 = Math.max(0, -bx), i1 = Math.min(s.w, W - bx);
  const t = s.t, sw = s.w;
  for (let j = j0; j < j1; j++) {
    const row = (by + j) * W + bx;
    const srow = j * sw;
    for (let i = i0; i < i1; i++) {
      const tv = t[srow + i];
      if (tv === EMPTY) continue;
      if (mode === 1 && d[row + i] >>> 24) continue;
      if (mode === 2 && !(d[row + i] >>> 24)) continue;
      d[row + i] = LUT[tv + 2];
    }
  }
}

/** Draw a stamp with optional horizontal wrap (no closures). */
export function stampW(buf: PixelBuffer, st: Stamp, x: number, y: number, rp: Ramp, base: number, W?: number, ext = 16) {
  drawStamp(buf, st, x, y, rp, base);
  if (!W) return;
  if (x - ext < 0) drawStamp(buf, st, x + W, y, rp, base);
  if (x + ext >= W) drawStamp(buf, st, x - W, y, rp, base);
}

/** Convenience: stamp a leaf. */
export function leaf(buf: PixelBuffer, x: number, y: number, ang: number, len: number, wid: number, rp: Ramp, base: number, shape: LeafShape = 'point', wrapW?: number) {
  stampW(buf, leafStamp(shape, len, wid, ang), x, y, rp, base, wrapW, len + wid);
}

// ------------------------------------------------------------------ leaf masses (layered clusters)

export interface MassOpts {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  ramp: Ramp;
  /** ramp index of the deepest (interior) tone */
  base?: number;
  /** number of brighter tone passes above base */
  steps?: number;
  shape?: LeafShape;
  len?: [number, number];
  wid?: [number, number];
  density?: number;
  /** 0 = leaves point outward, 1 = leaves hang straight down */
  droop?: number;
  /** each tone region shifts this fraction of the radius toward the light */
  shift?: number;
  /** each tone region shrinks by this fraction */
  shrink?: number;
  /** fill a dark core first so the mass has no holes */
  core?: boolean;
  /** silhouette lumpiness 0..1 */
  jag?: number;
  /** tile width for seamless strips */
  wrapW?: number;
  /** darkest colour used for the core (defaults to ramp[max(0, base-1)]) */
  coreColor?: C;
  /** extra top highlight pass (sunlit sprinkles) */
  sparkle?: number;
  /** flatten the bottom (0..1) so masses sit on a line */
  flatBottom?: number;
}

const LUMP_N = 96;
const lumpCache = new Map<number, Float32Array>();
/** Radial lump profile for a blob seed (cached). */
function lumpTable(seed: number): Float32Array {
  let t = lumpCache.get(seed);
  if (t) return t;
  t = new Float32Array(LUMP_N + 1);
  for (let i = 0; i <= LUMP_N; i++) {
    const k = (i / LUMP_N) * 7;
    t[i] = pnoise1(k, 7, seed) * 0.65 + pnoise1(k * (16 / 7), 16, seed + 5) * 0.35;
  }
  if (lumpCache.size > 4096) lumpCache.clear();
  lumpCache.set(seed, t);
  return t;
}
/** Deterministic lumpy blob test: returns normalised radius (<1 inside). */
function blobR(nx: number, ny: number, jag: number, tab: Float32Array) {
  const a = Math.atan2(ny, nx);
  const f = ((a / TAU + 1) % 1) * LUMP_N;
  const i = f | 0;
  const lump = tab[i] + (tab[i + 1] - tab[i]) * (f - i);
  return Math.sqrt(nx * nx + ny * ny) / (1 - jag * 0.5 + jag * lump);
}

/**
 * Paint a dense leaf mass: a dark core, then `steps` tone passes whose regions shift toward the
 * light and shrink, each made of individual leaf stamps (so tone borders are leafy, not smooth).
 */
export function leafMass(buf: PixelBuffer, rng: Rng, o: MassOpts) {
  const rp = o.ramp;
  const base = o.base ?? 2;
  const steps = o.steps ?? 4;
  const shape = o.shape ?? 'oval';
  const len = o.len ?? [4, 7];
  const wid = o.wid ?? [3, 4];
  const dens = o.density ?? 1;
  const droop = o.droop ?? 0.35;
  const shift = o.shift ?? 0.13;
  const shrink = o.shrink ?? 0.15;
  const jag = o.jag ?? 0.35;
  const seed = rng.int(0, 1 << 20);
  const tab = lumpTable(seed & 1023);
  const W = o.wrapW;
  const fb = o.flatBottom ?? 0;
  const lumpAt = (a: number) => {
    const f = ((a / TAU + 1) % 1) * LUMP_N;
    const i = f | 0;
    return 1 - jag * 0.5 + jag * (tab[i] + (tab[i + 1] - tab[i]) * (f - i));
  };
  let lumpMin = 1;
  for (let i = 0; i < LUMP_N; i++) lumpMin = Math.min(lumpMin, 1 - jag * 0.5 + jag * tab[i]);
  // core fill: plain ellipse (the leafy edge comes from the leaves)
  if (o.core !== false) {
    const cc = o.coreColor ?? rc(rp, base - 1);
    const k = 0.8;
    const y0 = Math.max(0, Math.floor(o.cy - o.ry * k)), y1 = Math.min(buf.h - 1, Math.ceil(o.cy + o.ry * k));
    for (let y = y0; y <= y1; y++) {
      let ny = (y + 0.5 - o.cy) / (o.ry * k);
      if (fb > 0 && ny > 0) ny *= 1 + fb * 2;
      if (ny * ny >= 1) continue;
      const hx = Math.sqrt(1 - ny * ny) * o.rx * k;
      const xa = Math.ceil(o.cx - hx - 0.5), xb = Math.floor(o.cx + hx - 0.5);
      const row = y * buf.w;
      for (let x = xa; x <= xb; x++) {
        const xx = W ? mod(x, W) : x;
        if (xx < 0 || xx >= buf.w) continue;
        buf.data[row + xx] = cc;
      }
    }
  }
  const avgL = (len[0] + len[1]) / 2, avgW = (wid[0] + wid[1]) / 2;
  const leafArea = Math.max(2, avgL * avgW * 0.62);
  // skip region: leaves that would be fully covered by the next (brighter) pass
  let skx = 0, sky = 0, skrx = 0, skry = 0;
  const place = (cx: number, cy: number, rx: number, ry: number, tone: number, lenK: number, widD: number) => {
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * lumpAt(a);
    const sa = Math.sin(a);
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + sa * ry * d / (fb > 0 && sa > 0 ? 1 + fb * 2 : 1);
    if (skrx > 0) {
      const qx = (x - skx) / skrx, qy = (y - sky) / skry;
      if (qx * qx + qy * qy < 0.5) return;
    }
    let ang = Math.atan2(y - o.cy, (x - o.cx) * (o.ry / o.rx));
    const dv = Math.PI / 2 - ang;
    ang += Math.atan2(Math.sin(dv), Math.cos(dv)) * droop + rng.range(-0.45, 0.45);
    const L = rng.range(len[0], len[1]) * lenK;
    const Wd = Math.max(1.5, rng.range(wid[0], wid[1]) - widD);
    const sx = x - Math.cos(ang) * L * 0.45, sy = y - Math.sin(ang) * L * 0.45;
    stampW(buf, leafStamp(shape, L, Wd, ang), sx, sy, rp, tone, W, L + Wd);
  };
  for (let k = 0; k <= steps; k++) {
    const f = 1 - shrink * k;
    if (f <= 0.05) break;
    const cx = o.cx + LIGHT[0] * o.rx * shift * k * 1.1;
    const cy = o.cy + LIGHT[1] * o.ry * shift * k;
    const rx = o.rx * f, ry = o.ry * f;
    const n = Math.ceil(((Math.PI * rx * ry) / leafArea) * dens * (k === 0 ? 1.05 : 0.9)) + 1;
    const fn = 1 - shrink * (k + 1);
    if (k < steps && fn > 0.05) {
      skx = o.cx + LIGHT[0] * o.rx * shift * (k + 1) * 1.1;
      sky = o.cy + LIGHT[1] * o.ry * shift * (k + 1);
      skrx = o.rx * fn * lumpMin;
      skry = o.ry * fn * lumpMin;
    } else skrx = 0;
    for (let i = 0; i < n; i++) place(cx, cy, rx, ry, base + k, k === 0 ? 1.08 : 1, 0);
  }
  skrx = 0;
  // sunlit sprinkles on the very top-left
  const sp = o.sparkle ?? 0;
  if (sp > 0) {
    const k = steps + 1;
    const cx = o.cx + LIGHT[0] * o.rx * (shift * k * 1.1 + 0.05);
    const cy = o.cy + LIGHT[1] * o.ry * (shift * k + 0.05);
    const rx = o.rx * Math.max(0.12, 1 - shrink * k), ry = o.ry * Math.max(0.12, 1 - shrink * k);
    const n = Math.ceil(((Math.PI * rx * ry) / leafArea) * sp * 0.6);
    for (let i = 0; i < n; i++) place(cx, cy, rx, ry, base + steps + 1, 0.85, 0.5);
  }
}

// ------------------------------------------------------------------ strokes, fronds, blades, tubes

export type P = [number, number];

/** Ballistic arc: launch angle + gravity droop. Returns points every ~0.5px. */
export function arc(x0: number, y0: number, ang: number, len: number, droop: number, curl = 0): P[] {
  const pts: P[] = [];
  const steps = Math.max(2, Math.ceil(len * 2));
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * len, t = s / len;
    let x = x0 + dx * s, y = y0 + dy * s + droop * len * 0.5 * t * t;
    if (curl && t > 0.75) {
      const c = (t - 0.75) / 0.25;
      x += -dx * c * c * len * 0.08 * curl;
      y -= c * c * len * 0.1 * curl;
    }
    pts.push([x, y]);
  }
  return pts;
}

/** Sample a polyline at parameter t (0..1) -> point & tangent angle. */
export function along(pts: P[], t: number): { x: number; y: number; a: number } {
  const n = pts.length - 1;
  const f = clamp(t, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(f)), k = f - i;
  const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, a: Math.atan2(by - ay, bx - ax) };
}

export interface FrondOpts {
  x: number;
  y: number;
  ang: number;
  len: number;
  droop: number;
  ramp: Ramp;
  /** ramp index of the lit upper pinnae */
  base: number;
  /** ramp for the underside pinnae (e.g. silver fern), defaults to ramp */
  under?: Ramp;
  underBase?: number;
  /** max pinna length */
  pinna: number;
  pinnaW?: number;
  /** distance between pinna pairs */
  gap?: number;
  /** pinna angle away from the rachis (radians) */
  sweep?: number;
  curl?: number;
  rachis?: C;
  shape?: LeafShape;
  /** pinna hang (0..1) */
  hang?: number;
  wrapW?: number;
  /** skip pinnae near the base (fraction) */
  bare?: number;
  /** random pinna gaps (old/eaten fronds) */
  ragged?: number;
  rng?: Rng;
  /** redraw the rachis on top in a light tone (front fronds) */
  rachisTop?: boolean;
}

/** Fern / palm frond: an arching rachis with tapered pinnae on both sides. Returns the rachis points. */
export function frond(buf: PixelBuffer, o: FrondOpts): P[] {
  const pts = arc(o.x, o.y, o.ang, o.len, o.droop, o.curl ?? 0);
  const gap = o.gap ?? Math.max(1.5, o.pinna * 0.3);
  const sweep = o.sweep ?? 0.75;
  const under = o.under ?? o.ramp;
  const ub = o.underBase ?? o.base - 2;
  const shape = o.shape ?? 'lance';
  const pw = o.pinnaW ?? Math.max(1.5, o.pinna * 0.3);
  const hang = o.hang ?? 0.12;
  const bare = o.bare ?? 0.12;
  const n = Math.floor(o.len / gap);
  const draws: { x: number; y: number; a: number; l: number; up: boolean; t: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    if (t < bare) continue;
    if (o.ragged && o.rng && o.rng.chance(o.ragged)) continue;
    const p = along(pts, t);
    const tt = (t - bare) / (1 - bare);
    const pl = o.pinna * Math.sin(Math.min(1, tt * 1.6 + 0.25) * Math.PI * 0.5) * (1 - tt * 0.7) + 1;
    // normal of the rachis pointing toward the sky (upper side of the frond)
    let nx = -Math.sin(p.a), ny = Math.cos(p.a);
    if (ny > 0) { nx = -nx; ny = -ny; }
    for (const side of [-1, 1]) {
      let pa = p.a + side * sweep;
      const dv = Math.PI / 2 - pa;
      pa += Math.atan2(Math.sin(dv), Math.cos(dv)) * hang;
      const up = Math.cos(pa) * nx + Math.sin(pa) * ny > 0;
      draws.push({ x: p.x, y: p.y, a: pa, l: pl, up, t });
    }
  }
  // lower-side pinnae first, then rachis, then upper-side pinnae
  for (const d of draws) if (!d.up) stampW(buf, leafStamp(shape, d.l, pw, d.a), d.x, d.y, under, ub, o.wrapW, d.l + 2);
  const rch = o.rachis ?? rc(o.ramp, o.base - 1);
  for (const [x, y] of pts) setW(buf, x, y, rch, o.wrapW);
  for (const d of draws) if (d.up) stampW(buf, leafStamp(shape, d.l, pw, d.a), d.x, d.y, o.ramp, o.base + (d.t > 0.8 ? 1 : 0), o.wrapW, d.l + 2);
  if (o.rachisTop) {
    const c = rc(o.ramp, o.base + 1);
    for (let i = Math.floor(pts.length * 0.12); i < pts.length * 0.85; i++) setW(buf, pts[i][0], pts[i][1], c, o.wrapW);
  }
  return pts;
}

export interface BladeOpts {
  x: number;
  y: number;
  ang: number;
  len: number;
  droop: number;
  /** width at the base */
  w0: number;
  ramp: Ramp;
  base: number;
  /** colour of the edge line (e.g. flax's orange margin) */
  edge?: C;
  /** fold highlight: lit half +1 tone */
  fold?: boolean;
  wrapW?: number;
  curl?: number;
}

/** A long strap/sword leaf (flax, grasses, kiekie) drawn as a tapered, folded stroke. */
export function blade(buf: PixelBuffer, o: BladeOpts): P[] {
  const pts = arc(o.x, o.y, o.ang, o.len, o.droop, o.curl ?? 0);
  const n = pts.length;
  const rp = o.ramp;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [x, y] = pts[i];
    const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
    const ta = Math.atan2(pts[j][1] - pts[k][1], pts[j][0] - pts[k][0]);
    const nx = -Math.sin(ta), ny = Math.cos(ta);
    const hw = Math.max(0.5, (o.w0 / 2) * Math.pow(1 - t, 0.75));
    const litSide = nx * LIGHT[0] + ny * LIGHT[1] > 0 ? 1 : -1;
    const steps = Math.ceil(hw * 2) + 1;
    for (let s = 0; s <= steps; s++) {
      const v = -hw + (2 * hw * s) / steps;
      const px = x + nx * v, py = y + ny * v;
      const lit = Math.sign(v) === litSide;
      let tone = o.fold !== false ? (lit ? 0 : -1) : 0;
      const edge = Math.abs(v) > hw - 0.7 && hw > 1.2;
      if (edge && lit) tone += 1;
      if (edge && !lit) tone -= 1;
      if (t > 0.9) tone = Math.min(tone, 0);
      let c = rc(rp, o.base + tone);
      if (o.edge && edge && hw > 1.2 && !lit) c = o.edge;
      setW(buf, px, py, c, o.wrapW);
    }
  }
  return pts;
}

/**
 * Shaded tube along a polyline (roots, branches, lianas, fig roots). Tone from the surface normal
 * vs the light; `rim` darkens the far edge for separation.
 */
export function tube(buf: PixelBuffer, pts: P[], rad: (t: number) => number, rp: Ramp, base: number, o: { spread?: number; texture?: (x: number, y: number) => number; wrapW?: number; rim?: boolean; mode?: 0 | 1 | 2 } = {}) {
  const spread = o.spread ?? 2;
  let total = 0;
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(total);
  }
  if (total === 0) return;
  let j = 1;
  const nR = rp.length - 1;
  for (let d = 0; ; ) {
    while (j < pts.length - 1 && seg[j] < d) j++;
    const k = (d - seg[j - 1]) / Math.max(1e-6, seg[j] - seg[j - 1]);
    const x = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * k;
    const y = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * k;
    const t = d / total;
    const rr = Math.max(0.5, rad(t));
    const ta = Math.atan2(pts[j][1] - pts[j - 1][1], pts[j][0] - pts[j - 1][0]);
    const last = d >= total;
    d = Math.min(total, d + Math.max(0.5, rr * 0.4));
    const nx = -Math.sin(ta), ny = Math.cos(ta);
    const draw = (cx: number) => {
      const x0 = Math.floor(cx - rr), x1 = Math.ceil(cx + rr), y0 = Math.floor(y - rr), y1 = Math.ceil(y + rr);
      for (let py = y0; py <= y1; py++) {
        if (py < 0 || py >= buf.h) continue;
        for (let px = x0; px <= x1; px++) {
          if (px < 0 || px >= buf.w) continue;
          const ddx = px + 0.5 - cx, ddy = py + 0.5 - y;
          if (ddx * ddx + ddy * ddy > rr * rr) continue;
          const idx = py * buf.w + px;
          if (o.mode === 1 && buf.data[idx] >>> 24) continue;
          if (o.mode === 2 && !(buf.data[idx] >>> 24)) continue;
          // across-tube coordinate
          const v = (ddx * nx + ddy * ny) / rr;
          const facing = nx * LIGHT[0] + ny * LIGHT[1];
          // surface normal ~ v * n: the +v side faces the light when facing > 0
          let l = v * facing * 1.5 + Math.sqrt(Math.max(0, 1 - v * v)) * 0.3 - 0.15;
          if (o.texture) l += o.texture(px, py);
          let tone = Math.round(base + l * spread);
          if (o.rim !== false && v * (facing >= 0 ? 1 : -1) < -0.74) tone -= 1;
          buf.data[idx] = rp[tone < 0 ? 0 : tone > nR ? nR : tone];
        }
      }
    };
    if (o.wrapW) wrapX(o.wrapW, x, rr + 1, draw);
    else draw(x);
    if (last) break;
  }
}

/** Catenary-ish sagging curve between two points. */
export function sag(x0: number, y0: number, x1: number, y1: number, depth: number, n = 24): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * depth]);
  }
  return pts;
}

/** Hanging vine strand with small alternating leaves. */
export function vine(buf: PixelBuffer, rng: Rng, x: number, y: number, len: number, rp: Ramp, base: number, o: { wave?: number; leafEvery?: number; leafLen?: number; shape?: LeafShape; wrapW?: number; stem?: C; phase?: number } = {}) {
  const wave = o.wave ?? 2;
  const every = o.leafEvery ?? 4;
  const ll = o.leafLen ?? 4;
  const ph = o.phase ?? rng.range(0, TAU);
  const stem = o.stem ?? rc(rp, base - 2);
  let side = rng.sign();
  for (let s = 0; s < len; s++) {
    const t = s / len;
    const xx = x + Math.sin(s * 0.07 + ph) * wave * (0.4 + t);
    setW(buf, xx, y + s, stem, o.wrapW);
    if (s > 2 && s % every === 0 && rng.chance(0.85)) {
      side = -side;
      const a = Math.PI / 2 + side * rng.range(0.5, 1.1);
      const L = ll * rng.range(0.75, 1.25) * (1 - t * 0.3);
      const st = leafStamp(o.shape ?? 'heart', L, Math.max(2, L * 0.62), a);
      const tone = base + (side < 0 ? 1 : 0) - (t > 0.8 ? 1 : 0);
      stampW(buf, st, xx, y + s, rp, tone, o.wrapW, L + 2);
    }
  }
}

/** Lumpy moss cushion painted over existing opaque pixels (or anywhere if `free`). */
export function mossBlob(buf: PixelBuffer, rng: Rng, cx: number, cy: number, rx: number, ry: number, rp: Ramp, base: number, free = false) {
  const n = Math.max(3, Math.round((rx * ry) / 3));
  const lumps: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next());
    lumps.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: rng.range(1.2, 2.6) });
  }
  lumps.sort((p, q) => p.y - q.y);
  for (const l of lumps) {
    const ny = (l.y - cy) / Math.max(1, ry);
    const t = base + (ny < -0.3 ? 1 : ny > 0.4 ? -1 : 0);
    buf.discFn(l.x, l.y, l.r, (px, py, dx, dy) => {
      if (!free && !buf.opaque(px, py)) return -1;
      const l2 = -dx * 0.5 - dy * 0.8;
      return rc(rp, t + (l2 > 0.45 ? 1 : l2 < -0.5 ? -1 : 0));
    });
  }
}

// ------------------------------------------------------------------ cleanup / lighting passes

/** Remove isolated single pixels: a pixel whose 4 neighbours are all one other colour takes it. */
export function despeckle(buf: PixelBuffer, x0 = 0, y0 = 0, x1 = buf.w, y1 = buf.h) {
  const w = buf.w, d = buf.data;
  const src = d.slice();
  for (let y = Math.max(1, y0); y < Math.min(buf.h - 1, y1); y++)
    for (let x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
      const i = y * w + x;
      const c = src[i];
      if (!(c >>> 24)) continue;
      const a = src[i - 1], b = src[i + 1], u = src[i - w], v = src[i + w];
      if (a === c || b === c || u === c || v === c) continue;
      // majority of neighbours
      if (a === b && (a === u || a === v)) d[i] = a;
      else if (u === v && (u === a || u === b)) d[i] = u;
      else if (a === u && a === v) d[i] = a;
      else if (b === u && b === v) d[i] = b;
    }
}

/**
 * Selective outline on transparent pixels next to the shape. Pixels to the lower/right side get
 * a dark outline (shade(neighbour, -dark)); pixels on the lit upper/left side get a lighter one
 * or none (light <= 0).
 */
export function outlineSel(buf: PixelBuffer, dark = 0.55, light = 0, fixed?: C) {
  const w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 200;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] >>> 24) continue;
      // neighbour above or to the left means this pixel is on the lower/right side of the shape
      let nb = -1, lower = false;
      if (op(x, y - 1)) { nb = (y - 1) * w + x; lower = true; }
      else if (op(x - 1, y)) { nb = y * w + x - 1; lower = true; }
      else if (op(x + 1, y)) nb = y * w + x + 1;
      else if (op(x, y + 1)) nb = (y + 1) * w + x;
      if (nb < 0) continue;
      if (lower) d[y * w + x] = fixed ?? shade(src[nb], -dark);
      else if (light > 0) d[y * w + x] = shade(src[nb], -light);
    }
}

/** Inner rim light: brighten top/left exposed pixels, darken bottom/right ones. */
export function rimLight(buf: PixelBuffer, up = 0.18, down = -0.2, x0 = 0, y0 = 0, x1 = buf.w, y1 = buf.h) {
  const w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const tr = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || src[y * w + x] >>> 24 === 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const c = src[y * w + x];
      if (!(c >>> 24)) continue;
      const top = tr(x, y - 1), left = tr(x - 1, y), bot = tr(x, y + 1), right = tr(x + 1, y);
      if ((top || left) && !(bot && right)) d[y * w + x] = shade(c, up);
      else if (bot || right) d[y * w + x] = shade(c, down);
    }
}

/** Multiply-darken existing pixels by k inside a soft ellipse (ambient occlusion / contact shadow). */
export function occlude(buf: PixelBuffer, cx: number, cy: number, rx: number, ry: number, k: number) {
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!buf.inside(x, y)) continue;
      const i = y * buf.w + x;
      const c = buf.data[i];
      if (!(c >>> 24)) continue;
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const dd = nx * nx + ny * ny;
      if (dd > 1) continue;
      const q = Math.round((1 - dd) * 3) / 3;
      if (q <= 0) continue;
      buf.data[i] = shade(c, -k * q);
    }
}

/** Trim transparent borders and move the anchor accordingly (glow is cropped identically). */
export function trimSprite(s: Sprite, pad = 1): Sprite {
  const t = s.buf.trim(pad);
  let glow: PixelBuffer | undefined;
  if (s.glow) {
    glow = new PixelBuffer(t.buf.w, t.buf.h);
    for (let y = 0; y < t.buf.h; y++)
      for (let x = 0; x < t.buf.w; x++) glow.data[y * glow.w + x] = s.glow.get(x + t.ox, y + t.oy);
  }
  return { buf: t.buf, ax: s.ax - t.ox, ay: s.ay - t.oy, glow };
}

/** Recolour every opaque pixel (e.g. silhouettes, fog tint). */
export function tint(buf: PixelBuffer, fn: (c: C) => C) {
  const d = buf.data;
  for (let i = 0; i < d.length; i++) if (d[i] >>> 24) d[i] = fn(d[i]);
}

/** Small glint (4-point sparkle) for collectibles. */
export function glint(buf: PixelBuffer, x: number, y: number, big = false) {
  const hi = hex('#fffbe8'), mid = hex('#fff1b0');
  buf.set(x, y, hi);
  buf.set(x - 1, y, mid);
  buf.set(x + 1, y, mid);
  buf.set(x, y - 1, mid);
  buf.set(x, y + 1, mid);
  if (big) {
    buf.set(x, y - 2, withA(mid, 190));
    buf.set(x, y + 2, withA(mid, 190));
  }
}
const withA = (c: C, a: number): C => ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0;
export { withA };

// ------------------------------------------------------------------ tiny pixel fonts

/** 3x5 font rows (3 bits each, MSB = left). */
const F3: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
  '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2], '!': [2, 2, 2, 0, 2], ' ': [0, 0, 0, 0, 0], "'": [2, 2, 0, 0, 0], '?': [6, 1, 2, 0, 2],
};
/** 5x7 font subset for painted signs (5 bits per row, MSB = left). */
const F5: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], C: [14, 17, 16, 16, 16, 17, 14], E: [31, 16, 16, 30, 16, 16, 31], I: [14, 4, 4, 4, 4, 4, 14],
  K: [17, 18, 20, 24, 20, 18, 17], M: [17, 27, 21, 21, 17, 17, 17], P: [30, 17, 17, 30, 16, 16, 16], T: [31, 4, 4, 4, 4, 4, 4],
  W: [17, 17, 17, 21, 21, 21, 10], O: [14, 17, 17, 17, 17, 17, 14], S: [15, 16, 16, 14, 1, 1, 30], N: [17, 25, 21, 19, 17, 17, 17],
  R: [30, 17, 17, 30, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], H: [17, 17, 17, 31, 17, 17, 17], D: [28, 18, 17, 17, 17, 18, 28],
  U: [17, 17, 17, 17, 17, 17, 14], B: [30, 17, 17, 30, 17, 17, 30], G: [14, 17, 16, 23, 17, 17, 15], Y: [17, 17, 10, 4, 4, 4, 4],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

/**
 * Draw text. font 3 = 3x5 (advance 4), font 5 = 5x7 (advance 6). Supports macrons via 'Ē', 'Ā'
 * (drawn as a bar above) and '♥' (5x5 heart, font 3 only). jitter: per-letter baseline wobble
 * (hand painted). Returns the advance width.
 */
export function text(buf: PixelBuffer, x: number, y: number, s: string, c: C, font: 3 | 5 = 3, o: { jitter?: number; seed?: number; shadow?: C; spacing?: number } = {}): number {
  const gw = font === 3 ? 3 : 5, gh = font === 3 ? 5 : 7;
  const adv = gw + (o.spacing ?? 1);
  let cx = Math.round(x);
  let i = 0;
  for (const raw of s) {
    let ch = raw.toUpperCase();
    let macron = false;
    if (ch === 'Ē') { ch = 'E'; macron = true; }
    if (ch === 'Ā') { ch = 'A'; macron = true; }
    const jy = o.jitter ? Math.round((hash2(i, 3, o.seed ?? 0) - 0.5) * 2 * o.jitter) : 0;
    if (ch === '♥') {
      const H = [10, 31, 31, 14, 4];
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (H[yy] & (16 >> xx)) buf.set(cx + xx, y + yy + jy, hex('#e2412c'));
      cx += 6;
      i++;
      continue;
    }
    const g = (font === 3 ? F3 : F5)[ch] ?? (font === 3 ? F3 : F5)[' '];
    const top = 1 << (gw - 1);
    for (let yy = 0; yy < gh; yy++)
      for (let xx = 0; xx < gw; xx++)
        if (g[yy] & (top >> xx)) {
          if (o.shadow !== undefined) buf.set(cx + xx + 1, y + yy + jy + 1, o.shadow);
          buf.set(cx + xx, y + yy + jy, c);
        }
    if (macron) for (let xx = 0; xx < gw; xx++) buf.set(cx + xx, y + jy - 2, c);
    cx += adv;
    i++;
  }
  return cx - Math.round(x);
}

/** Width in pixels of a string in the given font. */
export function textWidth(s: string, font: 3 | 5 = 3, spacing = 1) {
  let n = 0;
  for (const ch of s) n += ch === '♥' ? 6 : (font === 3 ? 3 : 5) + spacing;
  return n - spacing;
}

export { mix, shade, hex, rgba };

// ------------------------------------------------------------------ crowns (clumps of leaf masses)

export interface Clump { x: number; y: number; rx: number; ry: number; lit: number }

export interface CrownOpts {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  ramp: Ramp;
  /** number of sub-clumps */
  n?: number;
  /** clump radius as a fraction of the crown radius */
  size?: [number, number];
  /** darkest base index used for the shadowed underside clumps */
  lo?: number;
  /** brightest base index used for the sunlit top clumps */
  hi?: number;
  steps?: number;
  shape?: LeafShape;
  len?: [number, number];
  wid?: [number, number];
  density?: number;
  droop?: number;
  jag?: number;
  wrapW?: number;
  /** keep clumps inside this vertical fraction band (0 = top only) */
  spreadY?: number;
  /** sparkle on the sunniest clumps */
  sparkle?: number;
  /** explicit clump list (overrides random placement) */
  clumps?: { x: number; y: number; rx: number; ry: number }[];
  flatBottom?: number;
}

/**
 * A cauliflower crown: sub-clumps drawn top-to-bottom so each clump's lit top overlaps the dark
 * underside of the one above; clump brightness follows its position (top-left = sunniest).
 */
export function crown(buf: PixelBuffer, rng: Rng, o: CrownOpts): Clump[] {
  const n = o.n ?? 9;
  const size = o.size ?? [0.32, 0.5];
  const lo = o.lo ?? 1, hi = o.hi ?? 4;
  let list: { x: number; y: number; rx: number; ry: number }[];
  if (o.clumps) list = o.clumps.slice();
  else {
    list = [];
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * 0.7;
      const s = rng.range(size[0], size[1]);
      list.push({ x: o.cx + Math.cos(a) * o.rx * d, y: o.cy + Math.sin(a) * o.ry * d * (o.spreadY ?? 1), rx: o.rx * s, ry: o.ry * s * 0.85 });
    }
  }
  list.sort((p, q) => p.y - q.y + (p.x - q.x) * 0.1);
  const out: Clump[] = [];
  for (const c of list) {
    const nx = (c.x - o.cx) / o.rx, ny = (c.y - o.cy) / o.ry;
    const lit = clamp(-nx * 0.45 - ny * 0.8, -1, 1);
    const base = Math.round(lo + ((lit + 1) / 2) * (hi - lo));
    leafMass(buf, rng, {
      cx: c.x, cy: c.y, rx: c.rx, ry: c.ry, ramp: o.ramp, base, steps: o.steps ?? 4,
      len: o.len ?? [5, 8], wid: o.wid ?? [3, 4.5], shape: o.shape ?? 'oval', droop: o.droop ?? 0.18,
      density: o.density ?? 0.75, shift: 0.16, shrink: 0.17, jag: o.jag ?? 0.35, wrapW: o.wrapW,
      sparkle: lit > 0.35 ? o.sparkle ?? 0.8 : 0, flatBottom: o.flatBottom,
    });
    out.push({ ...c, lit });
  }
  return out;
}

// ------------------------------------------------------------------ big leaves

export interface BigLeafOpts {
  /** base (stem attachment) */
  x: number;
  y: number;
  ang: number;
  len: number;
  wid: number;
  ramp: Ramp;
  base: number;
  shape?: LeafShape;
  /** bend of the axis toward gravity (0..1+) */
  droop?: number;
  /** lateral vein spacing (px), 0 = none */
  veins?: number;
  /** midrib tone offset (+1 light vein, -1 dark) */
  rib?: number;
  /** caterpillar holes (count) */
  holes?: number;
  rng?: Rng;
  /** split/torn slits along the edge (banana-like), count */
  tears?: number;
  /** edge rim highlight on the lit side (default true) */
  rim?: boolean;
  /** darken toward the stem (ambient occlusion) */
  ao?: number;
  /** only paint where the destination is empty (0) / everywhere (default) */
  mode?: 0 | 1;
  wrapW?: number;
}

/**
 * A large single leaf swept along a (drooping) axis: lit and shadow halves, midrib, chevron
 * lateral veins, bright rim on the lit edge, dark edge on the shadow side, optional holes/tears.
 */
export function bigLeaf(buf: PixelBuffer, o: BigLeafOpts) {
  const rp = o.ramp;
  const shape = o.shape ?? 'point';
  const L = o.len, hw0 = o.wid / 2;
  const droop = o.droop ?? 0.3;
  const veins = o.veins ?? Math.max(0, Math.round(L / 7));
  const ribT = o.rib ?? 1;
  const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
  // bend direction: perpendicular toward "down"
  let px = -sa, py = ca;
  if (py < 0) { px = -px; py = -py; }
  const holes: { u: number; v: number; r: number }[] = [];
  const hs = Math.max(1, L / 22);
  if (o.holes && o.rng) for (let i = 0; i < o.holes; i++) holes.push({ u: o.rng.range(0.25, 0.8) * L, v: o.rng.range(-0.6, 0.6) * hw0, r: o.rng.range(0.6, 1.4) * hs });
  const tears: number[] = [];
  if (o.tears && o.rng) for (let i = 0; i < o.tears; i++) tears.push(o.rng.range(0.2, 0.9) * L);
  const tw = Math.max(0.5, L / 90);
  const W = buf.w, Hb = buf.h, d = buf.data, nR = rp.length - 1;
  const wrapW = o.wrapW;
  const mode1 = o.mode === 1;
  const step = L > 40 ? 0.7 : 0.5;
  const vsp = veins > 0 ? L / (veins + 1) : 0;
  for (let u = 0; u <= L; u += step) {
    const t = u / L;
    const bend = droop * L * 0.5 * t * t;
    const cx = o.x + ca * u + px * bend, cy = o.y + sa * u + py * bend;
    const dt = droop * t;
    const tx = ca + px * dt, ty = sa + py * dt;
    const tl = Math.hypot(tx, ty);
    const nx = -ty / tl, ny = tx / tl;
    const facing = nx * LIGHT[0] + ny * LIGHT[1];
    const hw = Math.max(0.6, profile(shape, t) * hw0);
    const aoT = o.ao ? o.ao * Math.max(0, 1 - t * 3) : 0;
    for (let v = -hw; v <= hw; v += step) {
      const lit = v * facing > 0;
      const av = Math.abs(v);
      let tone = lit ? 0 : -1;
      if (av < 0.6 && t < 0.92) tone = lit ? ribT : ribT - 1;
      else if (vsp > 0) {
        const w = (u - av * 0.9) / vsp;
        if (w - Math.floor(w) < 0.12 && av < hw - 1 && t > 0.06) tone += lit ? 1 : -1;
      }
      if (av > hw - 1) {
        if (lit) { if (o.rim !== false) tone = Math.max(tone, 1); }
        else tone = -2;
      }
      tone -= aoT;
      let hole = false;
      for (let i = 0; i < holes.length; i++) { const h = holes[i]; const qx = (u - h.u) * 0.55, qy = v - h.v; if (qx * qx + qy * qy < h.r * h.r) { hole = true; break; } }
      if (!hole) for (let i = 0; i < tears.length; i++) if (Math.abs(u - tears[i] - av * 0.6) < tw && av > hw * 0.35) { hole = true; break; }
      if (hole) continue;
      let k = Math.round(o.base + tone);
      k = k < 0 ? 0 : k > nR ? nR : k;
      const c = rp[k];
      let X = Math.floor(cx + nx * v);
      const Y = Math.floor(cy + ny * v);
      if (Y < 0 || Y >= Hb) continue;
      if (wrapW) X = mod(X, wrapW);
      if (X < 0 || X >= W) continue;
      const idx = Y * W + X;
      if (mode1 && d[idx] >>> 24) continue;
      d[idx] = c;
    }
  }
}

/** 5-petal flower / star (radius r) centred at x,y. */
export function flower(buf: PixelBuffer, x: number, y: number, r: number, petal: Ramp, pi: number, centre: C, petals = 5, rot = 0) {
  if (r < 1.2) {
    buf.set(x, y, rc(petal, pi + 1));
    buf.set(x - 1, y, rc(petal, pi));
    buf.set(x + 1, y, rc(petal, pi - 1));
    buf.set(x, y - 1, rc(petal, pi + 1));
    buf.set(x, y + 1, rc(petal, pi - 1));
    return;
  }
  for (let k = 0; k < petals; k++) {
    const a = rot + (k / petals) * TAU - Math.PI / 2;
    const ex = x + Math.cos(a) * r, ey = y + Math.sin(a) * r;
    const lit = Math.cos(a) * LIGHT[0] + Math.sin(a) * LIGHT[1];
    const st = leafStamp('oval', r + 1, Math.max(2, r * 0.9), a);
    drawStamp(buf, st, x, y, petal, pi + (lit > 0.3 ? 1 : lit < -0.3 ? -1 : 0));
    void ex; void ey;
  }
  buf.set(x, y, centre);
}

// V10 art: Motu Ahi, the smoking islet. Black volcanic sand with olivine glints and pumice pebbles,
// columnar basalt, red scoria and ash, lemon sulphur crusts round steaming vents, guano-white
// colony ledges, rata (pōhutukawa) scrub on the rim, and the cone itself behind it all.
//
// Geometry lives here too (the site and the art must agree): MA.W, groundIsle(x), the zones, the
// colony ledges and the vents. Ground is painted in chunks with a 'wet' twin (the wet black sand
// at the water's edge is drawn again with the water material so it mirrors the cast).

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';

export const MA = {
  W: 2640,
  /** walk line on the beach */
  GY: 252,
  BOT: 400,
  /** the sea in the landing cove (x < SEA_X) */
  SEA_X: 150,
  WATER: 262,
  /** the colony cliff */
  CLIFF: [840, 1400] as [number, number],
  /** the fumarole terrace */
  VENTS: [1460, 1960] as [number, number],
  /** the rim trail up to the lookout */
  RIM: [1960, 2640] as [number, number],
  LOOK: 2470,
};
export type IsleZone = 'cove' | 'beach' | 'boulders' | 'colony' | 'vents' | 'rim';
export function isleZone(x: number): IsleZone {
  if (x < MA.SEA_X) return 'cove';
  if (x < 560) return 'beach';
  if (x < MA.CLIFF[0]) return 'boulders';
  if (x < MA.CLIFF[1]) return 'colony';
  if (x < MA.VENTS[1]) return 'vents';
  return 'rim';
}
/** the walkable surface */
export function groundIsle(x: number): number {
  const G = MA.GY;
  if (x < MA.SEA_X) return G + 6 + (MA.SEA_X - x) * 0.36; // the beach shelves into the cove
  if (x < 560) return G + Math.sin(x * 0.013) * 1.2;
  if (x < MA.CLIFF[0]) return G - smoothstep(560, 840, x) * 6 + (noise1(x / 30, 3) - 0.5) * 3;
  if (x < MA.CLIFF[1]) return G - 6 - smoothstep(840, 1400, x) * 18 + (noise1(x / 26, 5) - 0.5) * 4;
  if (x < MA.VENTS[1]) return G - 24 + Math.sin(x * 0.01) * 2 + (noise1(x / 40, 7) - 0.5) * 2;
  // the rim trail climbs, steep then easing out at the lookout
  const u = smoothstep(MA.RIM[0], MA.LOOK, x);
  return G - 24 - u * 104 + (noise1(x / 22, 9) - 0.5) * 3 * (1 - u * 0.5);
}
/** colony ledges on the cliff: [y, x0, x1] (platforms the auks nest on) */
export const LEDGES: [number, number, number][] = [[118, 900, 1060], [146, 1080, 1340], [170, 880, 1010], [192, 1040, 1250], [96, 1130, 1300]];
export const VENT_XS = [1500, 1588, 1712, 1838];
export const POOLS: [number, number][] = [[1630, 1676], [1880, 1932]];

const BLACK = ['#16161c', '#202028', '#2c2c36', '#3a3a46', '#4a4a58', '#5e5e6c'].map(h => hex(h));
const WETB = ['#121418', '#1a1e24', '#262c34'].map(h => hex(h));
const BASALT = ['#1a1c24', '#262a34', '#323846', '#424a58', '#56606e'].map(h => hex(h));
const SCORIA = ['#2a1612', '#3e1e16', '#56281a', '#6e3820', '#8a4a2a'].map(h => hex(h));
const ASH = ['#4a4644', '#5e5a56', '#76706a', '#8e8880'].map(h => hex(h));
const SULF = ['#a07a10', '#c89a18', '#e8c430', '#f8e070', '#fff4b0'].map(h => hex(h));
const GUANO = ['#b8b8a8', '#d4d4c4', '#ecece0'].map(h => hex(h));
const SCRUB = ['#2a3a1c', '#3a5024', '#4c682c', '#628038'].map(h => hex(h));
const pick = (r: C[], f: number) => r[clamp(Math.floor(f), 0, r.length - 1)];

export interface IsleChunk { x0: number; y0: number; base: PixelBuffer; wet: PixelBuffer }
/** the ground under the walk line for world x in [x0, x0 + w) */
export function paintIsleGround(x0: number, w: number): IsleChunk {
  let top = 1e9;
  for (let x = x0; x < x0 + w; x++) top = Math.min(top, groundIsle(x));
  const y0 = Math.floor(top) - 4, h = MA.BOT - y0;
  const base = new PixelBuffer(w, h), wet = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const gy = groundIsle(x), z = isleZone(x);
    for (let y = Math.max(y0, Math.floor(gy)); y < MA.BOT; y++) {
      const d = y - gy;
      let c: C, isWet = false;
      if (z === 'cove') {
        // wet black sand shelving into the water (the sea itself is drawn by the site)
        c = pick(WETB, 1 + noise2(x / 9, y / 4, 3) * 2);
        isWet = d < 30;
      } else if (z === 'beach' || (z === 'boulders' && d > 12)) {
        // black sand: a dark wet band at the water's edge, dry rippled sand toward the camera
        const wetBand = 16 + noise1(x / 40, 11) * 6;
        if (d < wetBand) { c = pick(WETB, 0.5 + d / wetBand * 2.4 + (bayer(x, y) - 0.5) * 0.6); isWet = true; }
        else {
          c = pick(BLACK, 2.6 + Math.sin(x * 0.21 + y * 0.9 + noise1(x / 13, 4) * 3) * 0.7 + (bayer(x, y) - 0.5) * 0.8 - Math.min(1.4, (d - wetBand) * 0.02));
          const g = hash2(x, y, 17);
          if (g < 0.012) c = hex('#6a9a4a'); // olivine
          else if (g < 0.02) c = ASH[3]; // pumice grit
          else if (g < 0.023) c = hex('#e8e0d0'); // shell
        }
        if (d < 1.2) c = isWet ? WETB[2] : BLACK[4];
      } else if (z === 'boulders' || z === 'colony') {
        // basalt talus, columns jointed in hexagons, guano running down under the ledges
        const col = Math.floor((x + Math.floor(y / 9) * 3) / 7);
        const edge = (x + Math.floor(y / 9) * 3) % 7 === 0 || y % 9 === 0;
        c = pick(BASALT, 2.2 + noise1(col * 0.7, 21) * 1.8 - (edge ? 1.2 : 0) + (d < 3 ? 1 : 0) - Math.min(1.2, d * 0.012));
        if (z === 'colony' && fbm2(x / 5, y / 22, 2, 23) > 0.62 && d < 80) c = pick(GUANO, 1 + noise1(x / 3, 24) * 2);
        if (d < 1.2) c = BASALT[4];
      } else if (z === 'vents') {
        // warm ash terrace: grey ash, red scoria, yellow sulphur round the vents, steaming cracks
        const nearVent = Math.min(...VENT_XS.map(v => Math.abs(x - v)));
        const pool = POOLS.some(([a, b]) => x > a - 6 && x < b + 6);
        c = noise2(x / 18, y / 10, 31) > 0.55 ? pick(SCORIA, 1.5 + noise1(x / 5 + y, 32) * 2.5) : pick(ASH, 1 + noise2(x / 7, y / 5, 33) * 2.4);
        if (nearVent < 26 && d < 26 && fbm2(x / 4, y / 4, 2, 34) > 0.38 - (26 - nearVent) / 60) c = pick(SULF, 1 + (1 - nearVent / 26) * 3 + (bayer(x, y) - 0.5));
        if (pool && d < 6) c = pick(SULF, 2 + d * 0.3);
        if (d < 1.2) c = shade(c, 0.2);
      } else {
        // the rim: scoria and ash with scrub clinging to it
        c = pick(SCORIA, 1.2 + noise2(x / 9, y / 6, 41) * 3);
        if (d < 4 + noise1(x / 6, 42) * 4 && noise1(x / 11, 43) > 0.35) c = pick(SCRUB, 1 + noise2(x / 3, y / 2, 44) * 3);
        if (hash2(x, y, 45) < 0.01) c = ASH[3];
      }
      const i = (y - y0) * w + (x - x0);
      base.data[i] = c;
      if (isWet) wet.data[i] = c;
    }
  }
  return { x0, y0, base, wet };
}

/** the colony cliff: a wall of columnar basalt behind the walk line, ledges streaked with guano */
export function paintColonyCliff(): { buf: PixelBuffer; x: number; y: number } {
  const [cx0, cx1] = MA.CLIFF;
  const x0 = cx0 - 60, x1 = cx1 + 80, top = 40;
  const W = x1 - x0, H = 230;
  const b = new PixelBuffer(W, H);
  for (let i = 0; i < W; i++) {
    const x = x0 + i;
    // the skyline: a ragged crest, highest over the middle of the colony
    const u = (x - x0) / W;
    const crest = top + 26 - Math.sin(u * Math.PI) * 30 + (noise1(x / 24, 51) - 0.5) * 18 + (noise1(x / 7, 52) - 0.5) * 4;
    const foot = groundIsle(Math.max(cx0, Math.min(cx1, x))) - 2;
    const edgeK = Math.min(smoothstep(x0, cx0 + 20, x), 1 - smoothstep(cx1 - 30, x1, x));
    const t = crest + (1 - edgeK) * (foot - crest);
    for (let y = Math.floor(t); y < foot && y - top < H; y++) {
      const Y = y - top;
      if (Y < 0) continue;
      const colW = 9;
      const col = Math.floor((x + Math.floor(y / 30) * 4) / colW);
      const seam = (x + Math.floor(y / 30) * 4) % colW === 0;
      const joint = (y + col * 5) % 30 === 0;
      let c = pick(BASALT, 1.6 + noise1(col * 0.9, 53) * 2 + (seam || joint ? -1.1 : 0) + (y - t < 3 ? 1.2 : 0) - (y - t) * 0.004);
      // the lit faces of the columns
      if (!seam && (x + Math.floor(y / 30) * 4) % colW === 1) c = shade(c, 0.12);
      // guano streaks below every ledge
      for (const [ly, lx0, lx1] of LEDGES) {
        if (x < lx0 - 4 || x > lx1 + 4) continue;
        if (y >= ly - 1 && y <= ly + 1) c = y === ly - 1 ? BASALT[4] : BASALT[0];
        const below = y - ly;
        if (below > 1 && below < 40 && fbm2(x / 2.5, y / 24, 2, 54 + ly) > 0.5 + below * 0.008) c = pick(GUANO, 2 - below * 0.03 + noise1(x / 2, 55) * 1.2);
      }
      // scrub and moss on the crest
      if (y - t < 3 && noise1(x / 5, 56) > 0.4) c = pick(SCRUB, 1 + noise1(x / 3, 57) * 2.5);
      b.set(i, Y, c);
    }
  }
  return { buf: b, x: x0, y: top };
}

/** the cone of Motu Ahi behind the terrace and the rim (back layer) */
export function paintCone(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let x = 0; x < w; x++) {
    const u = x / w;
    const peak = Math.max(0, 1 - Math.abs(u - 0.55) / 0.5) ** 1.2;
    const notch = Math.exp(-((u - 0.57) ** 2) / 0.0016) * 0.12;
    const t = h - (peak - notch) * h * 0.96 - 2 + (noise1(x / 9, 61) - 0.5) * 3;
    for (let y = Math.floor(t); y < h; y++) {
      const d = y - t;
      const slope = (u < 0.55 ? 1 : -1);
      let c = pick(SCORIA, 1.4 + slope * 0.6 + noise2(x / 12, y / 20, 62) * 1.4 - d * 0.004);
      // gullies and lava ribs running down the cone
      if (Math.abs(Math.sin(x * 0.11 + y * 0.02 + noise1(y / 30, 63) * 3)) < 0.08) c = SCORIA[0];
      // ash fields, the green skirt of scrub at the foot
      if (noise2(x / 30, y / 18, 64) > 0.62) c = pick(ASH, 1 + noise1(x / 5, 65) * 2);
      if (y > h * 0.72 && noise2(x / 14, y / 9, 66) > 0.42) c = pick(SCRUB, 1 + noise2(x / 4, y / 3, 67) * 2.5);
      if (d < 2) c = shade(c, 0.15);
      b.set(x, y, c);
    }
  }
  return b;
}

/** the crater lake seen from the rim: a milky turquoise lake in a steaming bowl (far layer) */
export function paintCrater(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let x = 0; x < w; x++) {
    const u = x / w;
    const rim = h * 0.28 + Math.abs(u - 0.5) * h * 0.2 + (noise1(x / 14, 71) - 0.5) * 6;
    for (let y = Math.floor(rim); y < h; y++) {
      const v = (y - rim) / (h - rim);
      let c: C;
      const lakeTop = 0.42 + Math.abs(u - 0.5) * 0.4;
      if (v > lakeTop && Math.abs(u - 0.5) < 0.36) c = mix(hex('#5ac8c0'), hex('#a8e8d8'), noise2(x / 20, y / 3, 72) * 0.6 + (bayer(x, y) - 0.5) * 0.2);
      else c = pick(SCORIA, 1 + v * 2 + noise2(x / 8, y / 6, 73) * 1.6);
      if (v > lakeTop - 0.03 && v < lakeTop + 0.01 && Math.abs(u - 0.5) < 0.36) c = SULF[2];
      b.set(x, y, c);
    }
  }
  return b;
}

export interface PSpr { buf: PixelBuffer; ax: number; ay: number }
const outline = (b: PixelBuffer) => { b.outline((c: C) => mix(shade(c, -0.7), hex('#100c10'), 0.6)); return b; };
/** a fumarole: a low mound of crusted rock with a dark mouth */
export function ventSprite(seed: number): PSpr {
  const W = 34, H = 16;
  const b = new PixelBuffer(W, H);
  b.ellipseFn(17, 15, 15, 9, (x, y, nx, ny) => (ny > -0.1 && Math.abs(nx) < 0.18 ? hex('#140c08') : fbm2(x / 3, y / 3, 2, seed) > 0.45 - (1 - Math.abs(nx)) * 0.3 ? pick(SULF, 1.5 + (-ny) * 2) : pick(ASH, 1.5 - ny)));
  return { buf: outline(b), ax: 17, ay: 15 };
}
/** a hot pool's sulphur-crusted lip (the water is drawn live) */
export function poolLip(w: number): PSpr {
  const b = new PixelBuffer(w + 8, 6);
  for (let x = 0; x < w + 8; x++) for (let y = 0; y < 6; y++) {
    const e = Math.min(x, w + 7 - x);
    if (y < 2 && e > 3) continue;
    b.set(x, y, pick(SULF, 1 + (bayer(x, y)) * 2 + (y > 3 ? -1 : 0)));
  }
  return { buf: b, ax: 4, ay: 3 };
}
/** a lump of pumice, an obsidian shard, a sulphur crust (harvest spots) */
export function findSprite(kind: 'pumice' | 'obsidian' | 'sulphur' | 'down' | 'boulder', seed = 1): PSpr {
  if (kind === 'boulder') {
    const W = 30 + (seed % 3) * 8, H = 16 + (seed % 2) * 6;
    const b = new PixelBuffer(W, H);
    b.ellipseFn(W / 2, H - 1, W / 2 - 1, H - 1, (x, y, nx, ny) => pick(BASALT, 2.2 - nx * 0.8 - ny * 1.2 + (bayer(x, y) - 0.5) * 0.6));
    return { buf: outline(b), ax: Math.round(W / 2), ay: H - 1 };
  }
  const b = new PixelBuffer(12, 9);
  if (kind === 'pumice') b.ellipseFn(6, 5, 5, 3.4, (x, y, nx, ny) => (hash2(x, y, seed) < 0.2 ? ASH[1] : pick(ASH, 3 - ny - nx * 0.5)));
  else if (kind === 'obsidian') b.polyFn([2, 8, 5, 1, 10, 3, 9, 8], (x, y) => (x + y < 9 ? hex('#5a5a72') : y < 5 ? hex('#26263a') : hex('#121220')));
  else if (kind === 'sulphur') for (let i = 0; i < 5; i++) b.ellipseFn(3 + i * 1.6, 6 - (i % 2) * 2, 2, 2, (x, y, nx, ny) => pick(SULF, 3 - ny * 1.4));
  else { b.ellipseFn(6, 5, 4, 3, (x, y, nx, ny) => (ny < 0 ? hex('#d8d8d0') : hex('#a8a8a0'))); b.set(9, 2, hex('#e8e8e0')); b.set(10, 1, hex('#e8e8e0')); }
  return { buf: outline(b), ax: 6, ay: 8 };
}
/** a little nesting auk for the background colony (2 frames: settled / wings up) */
export function colonyBird(frame: number): PixelBuffer {
  const b = new PixelBuffer(5, 5);
  const k = hex('#1a1a20'), w = hex('#f0f0ea'), g = hex('#e8b830');
  if (frame === 0) { for (const [x, y, c] of [[1, 1, k], [2, 1, k], [1, 2, k], [2, 2, w], [3, 2, k], [1, 3, k], [2, 3, w], [3, 3, w], [2, 0, k], [3, 1, g]] as [number, number, C][]) b.set(x, y, c); }
  else { for (const [x, y, c] of [[0, 0, k], [4, 0, k], [1, 1, k], [3, 1, k], [2, 1, k], [2, 2, w], [2, 3, w], [3, 2, g]] as [number, number, C][]) b.set(x, y, c); }
  return b;
}

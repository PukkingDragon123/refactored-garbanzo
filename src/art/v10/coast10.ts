// V10 art: the far coast, a day's sail south. Grey shingle at the landing, a river running out
// across the beach with kelp washed up on its bars, a wave-cut platform of grey mudstone at the
// foot of tall layered sea cliffs (rock pools, a waterfall dropping straight off the cliff top
// onto the platform), then a track climbing into coastal forest to a lookout over the coast.
//
// Geometry lives here too (the site and the art must agree): FC, groundCoast(x), the zones.

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';

export const FC = {
  W: 2500,
  GY: 252,
  BOT: 400,
  SEA_X: 150,
  WATER: 262,
  /** the river crossing the beach (wading) */
  RIVER: [580, 790] as [number, number],
  RIVER_Y: 256,
  /** the wave-cut platform under the cliffs */
  PLAT: [800, 1580] as [number, number],
  FALL: [1288, 1314] as [number, number],
  /** the forest track */
  FOREST: [1580, 2500] as [number, number],
  LOOK: 2380,
};
export type CoastZone = 'cove' | 'shingle' | 'river' | 'platform' | 'forest';
export function coastZone(x: number): CoastZone {
  if (x < FC.SEA_X) return 'cove';
  if (x < FC.RIVER[0]) return 'shingle';
  if (x < FC.PLAT[0]) return 'river';
  if (x < FC.PLAT[1]) return 'platform';
  return 'forest';
}
export function groundCoast(x: number): number {
  const G = FC.GY;
  if (x < FC.SEA_X) return G + 6 + (FC.SEA_X - x) * 0.36;
  if (x < FC.RIVER[0]) return G + Math.sin(x * 0.011) * 1.5;
  if (x < FC.PLAT[0]) return G + Math.sin(Math.PI * clamp((x - FC.RIVER[0]) / (FC.RIVER[1] - FC.RIVER[0]))) * 9;
  if (x < FC.PLAT[1]) return G - 4 - Math.floor((x - FC.PLAT[0]) / 190) % 2 * 2 + (noise1(x / 40, 3) - 0.5) * 2;
  const u = smoothstep(FC.PLAT[1], FC.LOOK, x);
  return G - 4 - u * 96 + (noise1(x / 30, 5) - 0.5) * 3 * (1 - u * 0.4);
}
/** rock pools on the platform [x0, x1] */
export const ROCKPOOLS: [number, number][] = [[880, 930], [1060, 1120], [1262, 1340], [1440, 1484]];
/** ledges on the sea cliff (auks nest here): [y, x0, x1] */
export const CLEDGES: [number, number, number][] = [[116, 860, 1060], [150, 1380, 1560], [92, 1410, 1530], [178, 900, 1010]];

const SHINGLE = ['#3a3e44', '#4e545c', '#666c74', '#828890', '#a0a6ac'].map(h => hex(h));
const WETS = ['#24282e', '#30363e', '#40464e'].map(h => hex(h));
const MUD = ['#3a3c3a', '#4c4e4a', '#60625c', '#767870', '#8e9086'].map(h => hex(h));
const CLIFF = ['#4a4238', '#5e5446', '#766a56', '#908468', '#aaa080'].map(h => hex(h));
const SOIL = ['#2a1e16', '#3a2a1c', '#4c3824', '#5e4830'].map(h => hex(h));
const ALGAE = ['#2e4a2a', '#3e6234', '#567e40'].map(h => hex(h));
const SCRUB = ['#2a3a1c', '#3a5024', '#4c682c', '#628038'].map(h => hex(h));
const pick = (r: C[], f: number) => r[clamp(Math.floor(f), 0, r.length - 1)];

export interface CoastChunk { x0: number; y0: number; base: PixelBuffer; wet: PixelBuffer }
export function paintCoastGround(x0: number, w: number): CoastChunk {
  let top = 1e9;
  for (let x = x0; x < x0 + w; x++) top = Math.min(top, groundCoast(x));
  const y0 = Math.floor(top) - 4, h = FC.BOT - y0;
  const base = new PixelBuffer(w, h), wet = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const gy = groundCoast(x), z0 = coastZone(x);
    const pool = ROCKPOOLS.find(([a, b]) => x >= a && x <= b);
    for (let y = Math.max(y0, Math.floor(gy)); y < FC.BOT; y++) {
      const d = y - gy;
      // zones meet in a ragged, dithered seam rather than a straight cut (below the top rows)
      const z = d < 3 || z0 === 'cove' ? z0 : coastZone(x + (bayer(x, y) - 0.5) * 30 + (noise1(y / 6, 8) - 0.5) * 16);
      let c: C, isWet = false;
      if (z === 'cove' || z === 'river') {
        c = pick(WETS, 0.6 + noise2(x / 6, y / 3, 3) * 1.6 + (bayer(x, y) - 0.5) * 0.6);
        isWet = d < 26;
        if (hash2(x, y, 4) < 0.06) c = SHINGLE[1];
      } else if (z === 'shingle') {
        // rounded grey pebbles: a cell pattern, each stone lit on top, a wet dark band at the edge
        const cx = Math.floor(x / 5 + Math.floor(y / 3) * 0.5), cy = Math.floor(y / 3);
        const ph = hash2(cx, cy, 7);
        const tl = ((x % 5) + 5) % 5 < 2 && y % 3 === 0;
        const wetBand = 12 + noise1(x / 40, 9) * 5;
        if (d < wetBand) { c = pick(WETS, 0.6 + ph * 2 + (tl ? 1 : 0)); isWet = true; }
        else c = pick(SHINGLE, 1.2 + ph * 2.6 + (tl ? 0.9 : 0) - Math.min(1.2, (d - wetBand) * 0.012));
        if (d < 1.2) c = isWet ? WETS[2] : SHINGLE[3];
      } else if (z === 'platform') {
        // flat beds of mudstone, the strata cut level by the waves, green weed near the sea edge
        const bed = Math.floor((y + noise1(x / 60, 11) * 3) / 4);
        c = pick(MUD, 1.6 + hash2(bed, 1, 12) * 1.6 + noise2(x / 9, y / 3, 13) * 0.6 + (bayer(x, y) - 0.5) * 0.5 - Math.min(1.2, d * 0.01));
        if ((y + Math.round(noise1(x / 60, 11) * 3)) % 4 === 0) c = shade(c, -0.12);
        if (d < 3 && noise1(x / 7, 14) > 0.45) c = pick(ALGAE, 1 + noise1(x / 3, 15) * 2);
        if (pool && d < 7) {
          const e = Math.min(x - pool[0], pool[1] - x);
          if (d < Math.min(6, e * 0.6)) { c = d < 1 ? hex('#a8d8dc') : mix(hex('#2a5a66'), hex('#5a8a90'), noise2(x / 8, y, 16) * 0.6); isWet = true; }
        }
        if (d < 1.2 && !pool) c = MUD[4];
      } else {
        // the forest track: dark soil, roots, leaf litter, ferns at the edge
        c = pick(SOIL, 1.2 + noise2(x / 6, y / 4, 21) * 1.6 + (bayer(x, y) - 0.5) * 0.6 - Math.min(1, d * 0.01));
        if (d < 3 + noise1(x / 5, 22) * 3) c = pick(SCRUB, 1 + noise2(x / 3, y / 2, 23) * 2.6);
        if (hash2(x, y, 24) < 0.015) c = hex('#8a5a30');
      }
      const i = (y - y0) * w + (x - x0);
      base.data[i] = c;
      if (isWet) wet.data[i] = c;
    }
  }
  return { x0, y0, base, wet };
}

/** the sea cliff behind the platform: layered sandstone and mudstone, forest on the crest, the
 *  waterfall's wet black gully, guano under the auk ledges */
export function paintSeaCliff(): { buf: PixelBuffer; x: number; y: number } {
  const x0 = FC.PLAT[0] - 70, x1 = FC.PLAT[1] + 60, top = 30;
  const W = x1 - x0, H = 240;
  const b = new PixelBuffer(W, H);
  for (let i = 0; i < W; i++) {
    const x = x0 + i;
    const u = i / W;
    const crest = top + 22 + (noise1(x / 30, 31) - 0.5) * 18 + (noise1(x / 8, 32) - 0.5) * 4 - Math.sin(u * Math.PI) * 10;
    const foot = groundCoast(clamp(x, FC.PLAT[0], FC.PLAT[1])) - 2;
    const edgeK = Math.min(smoothstep(x0, x0 + 80, x), 1 - smoothstep(x1 - 60, x1, x));
    const t = crest + (1 - edgeK) * (foot - crest);
    const fall = x >= FC.FALL[0] - 4 && x <= FC.FALL[1] + 4;
    for (let y = Math.floor(t); y < foot && y - top < H; y++) {
      const Y = y - top;
      if (Y < 0) continue;
      const d = y - t;
      // strata: thick pale sandstone beds between thin dark mudstone, gently dipping
      const s = y + (x - x0) * 0.04 + noise1(x / 50, 33) * 4;
      const bed = Math.floor(s / 9);
      const thin = ((s % 9) + 9) % 9 < 2;
      let c = pick(CLIFF, 1.6 + hash2(bed, 2, 34) * 1.8 - (thin ? 1.2 : 0) + noise2(x / 6, y / 4, 35) * 0.6 + (bayer(x, y) - 0.5) * 0.5);
      // vertical joints and the shade of overhangs
      if (noise1(x / 3, 36) > 0.86) c = shade(c, -0.18);
      if (fall) c = mix(hex('#1c2224'), hex('#2a3436'), noise2(x, y / 6, 37));
      for (const [ly, lx0, lx1] of CLEDGES) {
        if (x < lx0 - 3 || x > lx1 + 3) continue;
        if (y >= ly - 1 && y <= ly) c = y === ly - 1 ? CLIFF[4] : CLIFF[0];
        const below = y - ly;
        if (below > 1 && below < 26 && fbm2(x / 2.5, y / 20, 2, 38 + ly) > 0.55 + below * 0.01) c = mix(hex('#e8e8dc'), c, 0.25);
      }
      if (d < 4 + noise1(x / 5, 39) * 4) c = pick(SCRUB, 1 + noise2(x / 3, y / 2, 40) * 2.6);
      b.set(i, Y, c);
    }
  }
  return { buf: b, x: x0, y: top };
}

/** a strand of kelp washed up on the river bar (harvest art) */
export function holdfastSprite(seed: number): { buf: PixelBuffer; ax: number; ay: number } {
  const b = new PixelBuffer(26, 10);
  const k = [hex('#3a2e10'), hex('#5a4818'), hex('#7a6624'), hex('#9a8434')];
  for (let i = 0; i < 22; i++) { const y = 6 + Math.sin(i * 0.5 + seed) * 2; b.set(2 + i, Math.round(y), k[2]); b.set(2 + i, Math.round(y) + 1, k[1]); }
  b.ellipseFn(5, 6, 4, 3, (x, y, nx, ny) => (hash2(x, y, seed) < 0.3 ? k[3] : ny < 0 ? k[2] : k[1]));
  b.outline(hex('#1a1408'));
  return { buf: b, ax: 13, ay: 9 };
}
/** kelp fronds lying on the swell out past the river mouth */
export function kelpRaft(w: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, 6);
  for (let x = 0; x < w; x++) {
    const n = noise1(x / 9, seed);
    if (n < 0.4) continue;
    const hh = Math.round((n - 0.4) * 8);
    for (let y = 5 - hh; y < 6; y++) b.set(x, y, y === 5 - hh ? hex('#8a7a30') : hex('#5a4a1c'));
  }
  return b;
}

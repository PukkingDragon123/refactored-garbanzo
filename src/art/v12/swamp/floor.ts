// V12 Te Repo Raupō, the swamp floor: the plane from the walk line down toward the camera, painted per
// pixel in perspective (the woods floor's pinhole: src/art/v11/woods/floor.ts). Tannin-black peat
// water with the sky's sheen running along its skin in thin ripple lines, rafts of duckweed packed
// into the still corners along the banks, lily pads (each cut with its notch, veined, a few curling up
// red at the rim, one in bloom here and there), drifting raupō leaves; and between the water the peat
// mud, black and glossy at the waterline with bird tracks pressed into it, sphagnum cushions with red
// tips, sedge litter and raupō stubble. Water pixels also go into a twin buffer, so the renderer draws
// them as reflective water: the kahikatea, the raupō and Mori are all mirrored in it.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { mix, shade } from '../../color';
import { clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import { wrealZ } from '../../v11/woods/floor';
import { SWP, pk, dz, cellAt, CELL } from './kit';

export interface SwampFloor {
  /** the walk line (the water's surface or the bank) */
  base: (x: number) => number;
  /** 0..1 how much of the plane in front is water, by x */
  wet: (x: number) => number;
  /** wading depth at the walk line (> 1: the walk line itself is water) */
  depth: (x: number) => number;
  /** rows painted below the walk line */
  rows: number;
  seed: number;
}
export interface SwampChunk { x0: number; y0: number; base: PixelBuffer; water: PixelBuffer }

const OUT = { c: 0 as C, water: false };

/** how watery the plane is at (x, row): > 0 open water, < 0 bank; ~0 the waterline */
export function swampWaterAt(F: SwampFloor, x: number, dd: number): number {
  const v = wrealZ(dd) * 300;
  const W = F.wet(x);
  // at the walk line the water follows the wading depth exactly (where Mori wades, it's water)
  const atLine = F.depth(x) > 1 ? 0.6 * (1 - smoothstep(0, 18, dd)) : F.depth(x) < -1 ? -0.6 * (1 - smoothstep(0, 10, dd)) : 0;
  const n = fbm2(x / 46, v / 13, 3, F.seed) - 0.5 + (noise2(x / 9, v / 4, F.seed + 1) - 0.5) * 0.18;
  return W * 1.05 - 0.5 + n * 0.95 + atLine;
}

function waterPixel(F: SwampFloor, x: number, y: number, dd: number, e: number) {
  const s = F.seed, v = wrealZ(dd) * 300;
  // deeper (darker) away from the banks, with a little olive where the light gets in near the camera
  let i = 3.2 - clamp(e * 3, 0, 2.2) + smoothstep(40, 200, dd) * 1.1 + (noise2(x / 30, v / 9, s + 3) - 0.5) * 1.2;
  // the sky's sheen in thin ripple lines along the skin, longer and further apart toward the camera
  const rl = noise2(x / (14 + dd * 0.08), v * 1.7, s + 4);
  let c = pk(SWP.peat, i + dz(x, y, 0.7));
  if (rl > 0.74 && e > 0.04) c = mix(c, pk(SWP.sheen, (rl - 0.74) * 12), 0.28 + (rl - 0.74) * 1.3);
  // a raupō leaf drifting, flat on the water (a thin strip, straw on top, dark at the edges)
  const leaf = hash2(Math.floor(x / 7), Math.floor(v / 2.2), s + 5);
  if (leaf < 0.012 && e > 0.1) { OUT.c = pk(SWP.raupoDry, 2 + ((x + y) & 1) * 2); OUT.water = false; return; }
  // scum and bubble lines in the stillest corners
  if (e < 0.12 && hash2(x, y, s + 6) < 0.05) c = pk(SWP.sheen, 1);
  OUT.c = c; OUT.water = true;
  // duckweed rafts, packed into the still water along the banks and drifting out in islands
  const dk = fbm2(x / 20, v / 7, 2, s + 7) + (1 - clamp(e * 4, 0, 1)) * 0.42;
  if (dk > 0.84) {
    const fr = hash2(x, y, s + 8);
    if (fr < 0.82) {
      // each frond a pixel or two, lit on top; gaps of black water between them toward the edge of a raft
      const lit = hash2(x, y - 1, s + 8) >= 0.82;
      OUT.c = pk(SWP.duck, 3 + (dk - 0.84) * 14 + (lit ? 1.4 : 0) + (fr < 0.1 ? -2 : 0) + dz(x, y, 0.6));
      OUT.water = false;
      return;
    }
  }
  // lily pads in the open water, in perspective (squashed), each with its notch and veins
  if (e > 0.12) {
    const id = cellAt(x, v * 2.7, 13, 13, s + 9, 0.34, 0.34, 0.5);
    if (id >= 0) {
      const ang = Math.atan2(CELL.ny, CELL.nx), notch = hash2(Math.floor(CELL.cx), Math.floor(CELL.cy), s + 10) * Math.PI * 2;
      let da = Math.abs(((ang - notch + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da > 0.32 || CELL.r < 0.12) {
        const rim = CELL.r > 0.72;
        const curl = id < 0.18 && rim && CELL.ny < 0;
        let t = 4.2 - CELL.r * 1.6 + (-CELL.nx * 0.6 - CELL.ny * 0.9) * 1.1 + dz(x, y, 0.5);
        // veins: lines radiating from the centre
        const vein = Math.abs(Math.sin(ang * 4 + notch)) < 0.1 && CELL.r > 0.08 && !rim;
        if (vein) t += 1;
        let c2 = curl ? pk(SWP.lilyRed, 2 + (CELL.ny < -0.5 ? 1 : 0)) : pk(SWP.lily, t);
        if (rim && !curl) c2 = shade(c2, -0.12);
        // a bloom on one pad in eight: white or pink petals round a gold heart
        if (id > 0.88 && CELL.r < 0.2) c2 = CELL.r < 0.05 ? pk(SWP.bloomGold, 1 + (CELL.ny < 0 ? 1 : 0)) : pk(id > 0.94 ? SWP.bloomPink : SWP.bloom, 3 - CELL.r * 8 + (CELL.ny < 0 ? 1 : 0));
        OUT.c = c2; OUT.water = false;
        return;
      }
      void da; da = 0;
    }
  }
}

function bankPixel(F: SwampFloor, x: number, y: number, dd: number, e: number) {
  const s = F.seed, v = wrealZ(dd) * 300;
  // black glossy mud at the waterline, its wet shine catching the sky
  if (e > -0.08) {
    const k = (e + 0.08) / 0.08;
    let c = pk(SWP.mud, 2.4 - k * 1.6 + dz(x, y));
    if (hash2(x, y, s + 11) < 0.12 + k * 0.1) c = pk(SWP.wetmud, 1 + k * 2 + (hash2(x + 1, y, s + 11) < 0.3 ? 1 : 0));
    // bird tracks pressed into the soft mud
    const tr = cellAt(x, v * 2, 9, 9, s + 12, 0.12, 0.22, 0.3);
    if (tr >= 0 && (Math.abs(CELL.nx) < 0.18 || Math.abs(CELL.nx + CELL.ny * 0.9) < 0.16 || Math.abs(CELL.nx - CELL.ny * 0.9) < 0.16) && CELL.ny < 0.2) c = pk(SWP.mud, 0);
    OUT.c = c; OUT.water = k > 0.6;
    return;
  }
  // sphagnum cushions, red-tipped, on the wetter banks
  const sp = fbm2(x / 24, v / 9, 3, s + 13) + (F.wet(x) - 0.4) * 0.3;
  if (sp > 0.6) {
    const t = (sp - 0.6) * 8;
    let c = pk(SWP.sphag, 2.6 + t + (noise2(x / 1.6, v / 1.1, s + 14) - 0.5) * 2.2 + dz(x, y, 0.7));
    if (hash2(x, y, s + 15) < 0.05) c = pk(SWP.sphagRed, 1 + hash2(x, y, s + 16) * 3);
    OUT.c = c; OUT.water = false;
    return;
  }
  // peat with sedge litter and raupō stubble
  let c = pk(SWP.mud, 3.6 + (noise2(x / 6, v / 4, s + 17) - 0.5) * 2.4 + dz(x, y));
  const straw = noise2(x / 13 + 30, v / 6, s + 18);
  if (straw > 0.5) {
    // fallen sedge blades lying every which way: short diagonal strokes
    const a = Math.sin(x * 0.9 + v * 2.1 + noise1(x / 8, s) * 6);
    if (Math.abs(a) < 0.24) c = pk(straw > 0.66 ? SWP.raupoDry : SWP.sedge, 2.5 + (a > 0 ? 1.4 : 0) + (straw - 0.5) * 6);
  }
  // raupō stubble: dark broken stems poking up out of the peat
  if (hash2(x, Math.floor(v / 2.5), s + 19) < 0.022) c = pk(SWP.raupoDry, 1);
  if (hash2(x, Math.floor(v / 2.5) - 1, s + 19) < 0.022) c = pk(SWP.raupoDry, 3);
  OUT.c = c; OUT.water = false;
}

/** sedge and grass tips poking up over a dry walk line */
function lipPixel(F: SwampFloor, x: number, d: number): boolean {
  if (F.depth(x) > 0.5) return false;
  const h = noise1(x * 0.8, F.seed + 21) * 3.2 + noise1(x / 7, F.seed + 22) * 1.8;
  if (-d > h) return false;
  OUT.c = pk(hash2(x, 1, F.seed) < 0.3 ? SWP.raupoDry : SWP.sedge, 3.5 + d * 0.5 + noise1(x * 1.3, F.seed + 23) * 2.5);
  OUT.water = false;
  return true;
}

/** Paint the swamp floor for world x in [x0, x0 + w). */
export function paintSwampFloor(F: SwampFloor, x0: number, w: number): SwampChunk {
  let minTop = 1e9, maxTop = -1e9;
  for (let x = x0; x < x0 + w; x++) { const t = F.base(x); minTop = Math.min(minTop, t); maxTop = Math.max(maxTop, t); }
  const y0 = Math.floor(minTop) - 6;
  const h = Math.ceil(maxTop + F.rows - y0);
  const base = new PixelBuffer(w, h), wat = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const top = Math.round(F.base(x));
    const bot = top + F.rows;
    for (let y = top - 4; y < bot; y++) {
      if (y < y0) continue;
      const d = y - top;
      OUT.c = 0;
      if (d < 0) { if (!lipPixel(F, x, d)) continue; }
      else {
        const e = swampWaterAt(F, x, d);
        if (e > 0) waterPixel(F, x, y, d, e); else bankPixel(F, x, y, d, e);
        if (d > 90) OUT.c = shade(OUT.c, -smoothstep(90, 220, d) * 0.2);
      }
      const i = (y - y0) * w + (x - x0);
      base.data[i] = OUT.c;
      if (OUT.water) wat.data[i] = OUT.c;
    }
  }
  return { x0, y0, base, water: wat };
}

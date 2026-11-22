// V12 cave floors: what lies on the floor of a cave, painted per pixel as a ground plane in perspective
// (the rows bunch up at the walk line, far away, and spread toward the camera, so every texture
// foreshortens on its own), shared by every cave: the deep dark cave's section painter
// (./rock.ts paintCaveRock runs it in the band under each walk line), the side-view caves (the sea
// grotto and the deep: paintFloorStrip) and the glowworm cave's floor (src/art/v9/eastground.ts).
//
//   slabs      limestone broken along its joints into irregular slabs (cellular noise, never a grid):
//              each its own tone, a lit far lip and a shadowed near lip, dark cracks between them,
//              grit and pebbles packed into the wider cracks
//   rubble     the same, broken small: scree, chips and pebbles heaped in the gaps
//   wet        dark wet rock with puddles: black water with a pale reflected rim at its far edge,
//              glints of sheen on the wet stone round it
//   flow       flowstone: banded cream and rust ripples running across, glossy, with tiny gours
//   rim        rimstone terraces: curved dams of pale calcite holding shallow pools behind them
//   mud        glossy brown mud, slide streaks, sunk pebbles, brown puddles
//   guano      the bats' leavings: crumbly black-brown, pale flecks of moth wing and beetle shell
//   crystal    dark rock crusted white, scattered with fallen crystal blades that glint
//   shingle    pebbles of every size and tone, each lit on its top and shadowed under, wet by water
//   moon       moonmilk: soft white paste over wet rock, pocked by drips
//   seabed     (the deep) rock slabs drowned in rippled sand, shell grit in the hollows
//
// Mineral streaks (iron rust, white calcite) wander across some floors; little stalagmite stubs
// stand in the band (src/art/v12/cave/rock.ts places them). Every tone steps through a hand-picked
// ramp with ordered dithering between the steps: no smooth gradients.

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import { bayer, clamp, hash2, noise1, noise2 } from '../../../core/math';
import type { FloorMat } from '../../../game/v12/cave/layout';

export type CaveFloorMat = FloorMat | 'seabed';

const R = (...s: string[]) => s.map(c => hex(c));
export const FP = {
  slab: R('#0c0a0e', '#17141a', '#221e24', '#2e282d', '#3b3438', '#494043', '#584d4e', '#695c5a', '#7c6d67', '#918174', '#a69482', '#bcaa94'),
  wet: R('#08090d', '#0f1217', '#161b22', '#1f262e', '#29323b', '#343f48', '#414e57', '#525f68', '#66747b', '#7f8e94', '#a2b2b6'),
  mud: R('#100b08', '#1b130d', '#271b12', '#352518', '#44301f', '#543d28', '#664b31', '#7a5b3d', '#8e6d4b'),
  guano: R('#0c0806', '#17100b', '#221810', '#2e2116', '#3a2b1d', '#4a3826'),
  fleck: R('#8a7c62', '#b4a382', '#d8c8a2'),
  flow: R('#1e140d', '#2e1f14', '#43301e', '#5a4128', '#735534', '#8c6a42', '#a68252', '#be9c68', '#d4b886', '#e8d2a8'),
  calc: R('#4a4440', '#6c645c', '#8e857a', '#b0a796', '#cec6b2', '#e8e2d0'),
  pool: R('#04080b', '#081117', '#0e1c24', '#152a33', '#1e3b45', '#2c5058', '#40686e'),
  mudpool: R('#0c0907', '#16110c', '#221a12', '#30251a'),
  crys: R('#10202c', '#1a3a4c', '#28607a', '#3e8aa6', '#6cbcd4', '#aae4f0', '#e6fcff'),
  crysV: R('#1c1430', '#30244e', '#4a3a74', '#6a5a9e', '#9a8cc8', '#d0c8f0'),
  peb: R('#16151a', '#24222a', '#33303a', '#43404a', '#55515a', '#69646c', '#7f797e', '#979091', '#b0a8a6'),
  pebW: R('#2a2016', '#3c2e20', '#4e3e2c', '#64503a', '#7a644a', '#927a5c'),
  moon: R('#3e423f', '#5c605b', '#7e817a', '#a2a49b', '#c4c4ba', '#dedcd2', '#f2f0e6'),
  rust: R('#3a1c0c', '#5a2c12', '#7a3e1a', '#9a5626'),
  sand: R('#2a2a24', '#3c3c32', '#504e40', '#66624e', '#7e785e', '#968e70', '#aea484'),
};

/** a ramp step with ordered dithering between steps */
const pk = (ramp: C[], v: number, x: number, y: number, k = 0.9) => ramp[clamp(Math.floor(v + (bayer(x, y) - 0.5) * k + 0.5), 0, ramp.length - 1)];
const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);

/** Worley cells on a jittered grid (sx by sz): nearest and second-nearest distances, the cell's id and centre */
const WC = { f1: 0, f2: 0, id: 0, cx: 0, cz: 0 };
function worley(x: number, z: number, sx: number, sz: number, s: number) {
  const gx = Math.floor(x / sx), gz = Math.floor(z / sz);
  let f1 = 1e9, f2 = 1e9, id = 0, cx = 0, cz = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ax = gx + i, az = gz + j;
    const px = (ax + 0.12 + hash2(ax, az, s) * 0.76) * sx, pz = (az + 0.12 + hash2(ax, az, s + 1) * 0.76) * sz;
    const d = Math.hypot((x - px) / sx, (z - pz) / sz);
    if (d < f1) { f2 = f1; f1 = d; id = hash2(ax, az, s + 2); cx = px; cz = pz; } else if (d < f2) f2 = d;
  }
  WC.f1 = f1; WC.f2 = f2; WC.id = id; WC.cx = cx; WC.cz = cz;
}

/** small jittered blobs (pebbles, flecks): the blob's hash or -1; PB.nx, PB.nz its offset, PB.r normalised distance */
const PB = { nx: 0, nz: 0, r: 0 };
function blob(x: number, z: number, sx: number, sz: number, s: number, fill: number): number {
  const fx = x / sx, fz = z / sz, gx = Math.floor(fx), gz = Math.floor(fz);
  const i0 = fx - gx < 0.5 ? -1 : 0, j0 = fz - gz < 0.5 ? -1 : 0;
  let best = 9, id = -1;
  for (let j = j0; j <= j0 + 1; j++) for (let i = i0; i <= i0 + 1; i++) {
    const ax = gx + i, az = gz + j, h = hash2(ax, az, s);
    if (h > fill) continue;
    const px = (ax + 0.2 + hash2(ax, az, s + 1) * 0.6) * sx, pz = (az + 0.2 + hash2(ax, az, s + 2) * 0.6) * sz;
    const rr = 0.32 + hash2(ax, az, s + 3) * 0.3;
    // a lumpy outline: never a clean ellipse
    const ang = Math.atan2(z - pz, x - px);
    const lump = 1 + Math.sin(ang * 3 + h * 20) * 0.16 + Math.sin(ang * 5 + h * 9) * 0.08;
    const dx = (x - px) / (sx * rr * lump), dz = (z - pz) / (sz * rr * lump);
    const q = dx * dx + dz * dz;
    if (q < 1 && q < best) { best = q; id = h; PB.nx = dx; PB.nz = dz; }
  }
  PB.r = best;
  return id;
}

/**
 * One floor pixel. (x, z): its place on the ground (x across, z the real distance in from the far edge,
 * in px of the floor itself); P: how big things look on this row (1 at a middle distance); v: 0 at
 * the far edge .. 1 at the near edge (shading); wy: the screen row (for dithering). Returns a colour.
 */
export function floorTex(x: number, z: number, P: number, v: number, wy: number, mat: CaveFloorMat, seed: number): C {
  const dl = -v * 0.9; // the near rows a little darker (the light is up by the walk line)
  // ---- the slabs everything lies on
  const slabW = mat === 'rubble' ? 18 : mat === 'shingle' ? 20 : mat === 'crystal' ? 28 : 36;
  const slabZ = mat === 'rubble' ? 6.5 : mat === 'shingle' ? 7 : 11;
  worley(x + (noise1(z / 9, seed) - 0.5) * 8, z, slabW, slabZ, seed + 3);
  const f1 = WC.f1, f2 = WC.f2, id = WC.id, cz = WC.cz;
  const edge = f2 - f1;
  const crackW = (mat === 'rubble' ? 0.085 : 0.055) / Math.max(0.6, P);
  const inCrack = edge < crackW;
  // which side of its slab this pixel is on: the far lip (lit) or the near lip (in shadow)
  const lipFar = !inCrack && edge < crackW * 2.2 && z < cz;
  const lipNear = !inCrack && edge < crackW * 2.2 && z > cz;
  // each slab its own tone (a few warm, iron-stained ones), tilted a little: lighter toward its far side
  const base: C[] = FP.slab;
  let l = 6 + (id - 0.5) * 3 + (cz - z) / slabZ * 0.9 + (noise2(x / 40, z / 14, seed + 5) - 0.5) * 1.4 + dl;
  if (lipFar) l += 1.4; else if (lipNear) l -= 1.6;
  // the slab's own grain: fine pits and a few crazing lines
  const g = hp(x, wy, seed + 7);
  if (g > 0.93) l += 0.7; else if (g < 0.05) l -= 0.9;
  if (Math.abs(noise2(x / 11, z / 4, seed + 8) - 0.5) < 0.012) l -= 1.4;
  let c: C;
  if (inCrack) {
    // the crack: dark, packed with grit where it's wide
    c = pk(FP.slab, 1.4 + dl * 0.5 + (hp(x, wy, seed + 9) > 0.7 ? 1.2 : 0), x, wy, 0.5);
    if (mat === 'rubble' || mat === 'dry' || mat === 'shingle') {
      const pid = blob(x, z, 3.2, 1.6, seed + 11, 0.7);
      if (pid >= 0) c = pk(FP.peb, 4.2 - PB.nx * 1.4 - PB.nz * 1.8 + (pid - 0.5) * 2 + dl, x, wy);
    }
  } else {
    c = pk(base, l, x, wy);
    if (id > 0.82 && mat !== 'wet' && mat !== 'moon') c = mix(c, FP.pebW[Math.min(5, Math.max(0, Math.round(l * 0.45)))], 0.45);
  }
  // ---- the material on top
  switch (mat) {
    case 'rubble': case 'dry': {
      // scree and chips scattered over the slabs (thicker on rubble)
      const pid = blob(x, z, mat === 'rubble' ? 7 : 9, mat === 'rubble' ? 4 : 4.5, seed + 21, mat === 'rubble' ? 0.36 : 0.16);
      if (pid >= 0 && PB.r < 1) {
        const lit = -PB.nx * 1.5 - PB.nz * 2.1;
        c = pk(pid > 0.75 ? FP.slab : FP.peb, (pid > 0.75 ? 7.5 : 4.8) + lit + (pid - 0.5) * 2.4 + dl, x, wy);
        if (PB.nz > 0.55 && PB.r > 0.5) c = pk(FP.slab, 1.2, x, wy, 0.4); // its shadow on the slab
      }
      // dust drifted into the hollows (dry): pale and flat
      if (mat === 'dry' && noise2(x / 30, z / 8, seed + 22) > 0.7 && !inCrack) c = mix(c, FP.slab[7], 0.2);
      break;
    }
    case 'guano': {
      const n = noise2(x / 22, z / 7, seed + 30);
      if (n > 0.38) {
        // crumbly heaps, darker in their hollows, flecked pale
        const crumb = blob(x, z, 2.6, 1.4, seed + 31, 0.8);
        c = pk(FP.guano, 2.6 + (n - 0.38) * 5 + (crumb >= 0 ? 1 - PB.nz * 0.8 : -0.6) + dl, x, wy, 0.7);
        if (hp(x, wy, seed + 32) > 0.978) c = FP.fleck[Math.floor(hp(x, wy, seed + 33) * 2)];
        // its rim crusting pale where it dries out
        if (n < 0.42) c = mix(c, FP.fleck[0], 0.3);
      }
      break;
    }
    case 'wet': case 'moon': {
      c = mix(c, pk(FP.wet, 5 + (id - 0.5) * 2 + dl + (lipFar ? 1 : 0), x, wy), 0.72);
      const pud = noise2(x / 34, z / 12, seed + 40) + (noise1(x / 7, seed + 41) - 0.5) * 0.06;
      if (pud > 0.66) {
        // a puddle: black water, a pale reflected rim along its far edge, a glint or two
        const depth = (pud - 0.66) * 9;
        const farEdge = noise2(x / 34, (z - 2.2) / 12, seed + 40) <= 0.66;
        c = farEdge ? pk(FP.wet, 8.4, x, wy, 0.4) : pk(FP.pool, 3.4 - depth * 1.2 + dl * 0.5, x, wy, 0.6);
        if (!farEdge && hp(x, wy, seed + 42) > 0.985) c = FP.wet[9];
      } else if (pud > 0.62) c = pk(FP.wet, 2.2 + dl, x, wy, 0.4); // the wet dark ring round it
      else if (hp(x, wy, seed + 43) > 0.975 && !inCrack) c = FP.wet[8]; // sheen glints
      if (mat === 'moon') {
        const m = noise2(x / 18, z / 5, seed + 44) + (noise1(x / 5, seed + 45) - 0.5) * 0.08;
        if (m > 0.5 && pud <= 0.62) {
          c = pk(FP.moon, 2.8 + (m - 0.5) * 5 + (lipFar ? 0.7 : 0) + dl, x, wy, 0.8);
          if (blob(x, z, 4, 2, seed + 46, 0.35) >= 0 && PB.r < 0.4) c = pk(FP.moon, 2.2, x, wy, 0.4); // drip pocks
        }
      }
      break;
    }
    case 'flow': {
      // banded ripples running across, each crest catching the light; the slabs show through it thinly
      const w = x + noise1(z / 6, seed + 50) * 18 + noise2(x / 50, z / 10, seed + 51) * 24;
      const band = Math.sin(w * 0.2 + z * 0.3);
      const ridge = Math.sin(z * 0.9 / Math.max(0.6, P) + noise1(x / 13, seed + 52) * 6);
      let fl = 3.9 + band * 0.7 + (ridge > 0.82 ? 1.4 : ridge < -0.86 ? -1.3 : 0) + (noise2(x / 60, z / 20, seed + 53) - 0.5) * 2 + dl;
      if (inCrack) fl -= 1.5;
      c = mix(mix(pk(FP.flow, fl, x, wy, 0.8), pk(FP.calc, fl * 0.55, x, wy, 0.6), 0.35), FP.wet[3], 0.18);
      // tiny gours: crescent lips of calcite with a skin of water behind
      const gour = noise2(x / 22, z / 8, seed + 54);
      if (Math.abs(gour - 0.64) < 0.012) c = pk(FP.calc, 3.8 + dl, x, wy, 0.4);
      else if (gour > 0.64 && gour < 0.7) c = mix(c, FP.pool[4], 0.5);
      if (hp(x, wy, seed + 55) > 0.99) c = FP.flow[9];
      break;
    }
    case 'rim': {
      // rimstone terraces: contour dams of pale calcite, still pools held behind them
      // (crescent dams running across the floor, scalloped into lobes, each terrace a little lower)
      // (the lobes and the wander have a real size on the ground, so they stay crescents near the camera)
      const lvl = (z + (noise1(x / 26, seed + 60) - 0.5) * 16 + Math.abs(Math.sin(x / 11 + noise1(x / 40, seed + 61) * 3)) * 6) / ((7 + noise1(x / 60, seed + 62) * 5) * (0.5 + Math.min(1.6, P) * 0.6));
      const fr = lvl - Math.floor(lvl);
      if (fr > 0.9) {
        // the dam's crest: lit on top, its face dark below
        c = pk(FP.calc, 3.2 + (fr > 0.95 ? 1.3 : 0) + dl, x, wy, 0.6);
      } else if (fr > 0.28) {
        // a pool: dark water, lighter toward its dam (shallow), a glint
        c = pk(FP.pool, 1.4 + (fr - 0.28) * 5 + dl * 0.6, x, wy, 0.8);
        if (hp(x, wy, seed + 62) > 0.988) c = FP.wet[9];
      } else {
        c = mix(c, pk(FP.calc, 1.4 + fr * 3 + dl, x, wy), 0.6);
        if (inCrack) c = shade(c, -0.25);
      }
      break;
    }
    case 'mud': {
      // glossy mud: a slow wash of tones, slide streaks across, sunk pebbles, brown puddles
      const n = noise2(x / 26, z / 8, seed + 70);
      let ml = 3.6 + (n - 0.5) * 3 + dl;
      const streak = Math.sin(z * 2.2 / Math.max(0.6, P) + noise1(x / 20, seed + 71) * 4);
      if (streak > 0.9) ml += 1.1; else if (streak < -0.9) ml -= 0.8;
      c = pk(FP.mud, ml, x, wy, 0.9);
      if (n > 0.7) c = pk(FP.mudpool, 1.4 + (n - 0.7) * 6, x, wy, 0.6);
      else if (hp(x, wy, seed + 72) > 0.972) c = FP.mud[8]; // the gloss
      const pid = blob(x, z, 9, 3, seed + 73, 0.18);
      if (pid >= 0 && PB.r < 0.8) c = pk(FP.pebW, 2.6 - PB.nx - PB.nz * 1.4 + dl, x, wy);
      break;
    }
    case 'crystal': {
      // a white calcite crust in patches, fallen crystal blades glinting all over
      if (noise2(x / 20, z / 6, seed + 80) > 0.56) c = pk(FP.calc, 2 + (lipFar ? 1 : 0) + (id - 0.5) * 1.4 + dl, x, wy, 0.7);
      const pid = blob(x, z, 4.2, 1.8, seed + 81, 0.42);
      if (pid >= 0 && PB.r < 0.7) {
        const ramp = pid > 0.55 ? FP.crysV : FP.crys;
        // a blade lying flat: long across, one lit facet, one dark
        c = pk(ramp, (PB.nz < 0 ? 4.2 : 2.4) + (PB.r < 0.15 ? 1.5 : 0) + dl * 0.5, x, wy, 0.5);
      }
      break;
    }
    case 'shingle': {
      // pebbles of every size and tone packed tight, each lit on top and shadowed under
      const big = blob(x, z, 7, 2.8, seed + 90, 0.62);
      if (big >= 0) {
        const warm = big > 0.7;
        c = pk(warm ? FP.pebW : FP.peb, (warm ? 2.8 : 4.2) - PB.nx * 1.3 - PB.nz * 2.2 + (big - 0.5) * 3 + (PB.r > 0.7 ? -1 : 0) + dl, x, wy);
        if (PB.r < 0.08 && PB.nz < 0) c = warm ? FP.pebW[5] : FP.peb[8];
      } else {
        const sm = blob(x, z, 3, 1.3, seed + 91, 0.8);
        c = sm >= 0 ? pk(FP.peb, 3 - PB.nz * 1.6 + (sm - 0.5) * 2.4 + dl, x, wy) : pk(FP.peb, 0.8, x, wy, 0.5);
      }
      // wet near the water: darker, glossy
      if (noise2(x / 40, z / 10, seed + 92) > 0.6) { c = shade(c, -0.22); if (hp(x, wy, seed + 93) > 0.975) c = FP.wet[9]; }
      break;
    }
    case 'seabed': {
      // drowned slabs half-buried in rippled sand, shell grit in the hollows
      const sandy = noise2(x / 30, z / 8, seed + 100) + (inCrack ? 0.3 : 0) > 0.55;
      if (sandy) {
        const rip = Math.sin(x * 0.4 + noise1(z / 5, seed + 101) * 3 + z * 0.3);
        c = pk(FP.sand, 3.4 + (rip > 0.6 ? 1.2 : rip < -0.7 ? -1 : 0) + dl, x, wy, 0.8);
        if (hp(x, wy, seed + 102) > 0.988) c = FP.calc[4];
        else if (hp(x, wy, seed + 103) > 0.992) c = FP.rust[2];
      } else c = mix(c, FP.wet[4], 0.3);
      break;
    }
  }
  // ---- mineral streaks wandering across (iron rust, white calcite)
  if (mat !== 'guano' && mat !== 'mud' && mat !== 'seabed') {
    const sx = x + noise1(z / 7, seed + 110) * 14;
    const sw = Math.abs(noise1(sx / 46, seed + 111) - 0.5);
    if (sw < 0.01 * P && (mat === 'dry' || mat === 'rubble' || mat === 'wet' || mat === 'flow')) c = mix(c, noise1(sx / 300, seed + 112) > 0.5 ? FP.rust[2] : FP.calc[4], 0.3);
  }
  return c;
}

/** how deep (rows) the floor band is under the walk line at x: ragged, chipped, never a ruler line */
export function bandDepth(x: number, mat: CaveFloorMat, seed: number): number {
  const base = mat === 'rubble' ? 25 : mat === 'shingle' ? 24 : mat === 'mud' ? 20 : mat === 'flow' || mat === 'rim' ? 19 : mat === 'crystal' ? 21 : 22;
  let d = base + (noise1(x / 17, seed + 120) - 0.5) * 10 + (noise1(x / 6.3, seed + 121) - 0.5) * 3;
  // chips and bites out of the front edge: broken lengths of slab, each a few px wide, stepped
  const ci = Math.floor((x + noise1(x / 11, seed + 124) * 6) / 7);
  const ch = hash2(ci, 0, seed + 122);
  if (ch > 0.72) d -= 1 + Math.round((ch - 0.72) * 9);
  if (noise1(x / 29, seed + 123) < 0.2) d -= 5;
  return Math.max(8, Math.round(d));
}

/** a band row d under the walk line (band depth D) as a place on the floor: [z, P, v] */
export function bandCoords(d: number, D: number): [number, number, number] {
  const v = clamp(d / D, 0, 1);
  // rows near the walk line cover more ground than rows near the front edge (2.2 to 1 px of floor a row)
  const P = 0.55 + 0.9 * v;
  const z = 2.2 * d - 0.6 * d * d / Math.max(1, D);
  return [z, P, v];
}

/** the front edge of a band: the slab's broken lip catching the light, then shadow under it */
export function bandEdge(x: number, wy: number, k: number, mat: CaveFloorMat, seed: number): C {
  const ramp = mat === 'mud' ? FP.mud : mat === 'guano' ? FP.guano : mat === 'flow' ? FP.flow : mat === 'crystal' || mat === 'rim' || mat === 'moon' ? FP.calc : mat === 'wet' ? FP.wet : FP.slab;
  // k: 0 the lip row itself, 1, 2... the shadow under it
  if (k === 0) return pk(ramp, ramp.length * 0.62 + (hp(x, wy, seed + 130) - 0.5) * 1.4, x, wy, 0.6);
  return pk(FP.slab, k === 1 ? 0.4 : 1.1, x, wy, 0.5);
}

/** a crumb sitting on the walk line (h rows above it at x): pebbles, chips, crystal points, mud lumps; -1 none */
export function crumbAt(x: number, h: number, mat: CaveFloorMat, seed: number): C | -1 {
  const cellW = mat === 'rubble' || mat === 'shingle' ? 9 : mat === 'mud' || mat === 'flow' || mat === 'rim' ? 16 : 12;
  const cx = Math.floor((x + noise1(x / 9, seed + 140) * 4) / cellW);
  const hh = hash2(cx, 0, seed + 141);
  const fill = mat === 'rubble' ? 0.5 : mat === 'shingle' ? 0.55 : mat === 'crystal' ? 0.4 : mat === 'guano' ? 0.35 : mat === 'mud' ? 0.2 : 0.22;
  if (hh > fill) return -1;
  // a pebble: wider than it is tall, a flat underside, a lumpy rounded top
  const w = 3 + hash2(cx, 1, seed + 141) * (cellW - 4), mid = cx * cellW + cellW / 2 + (hash2(cx, 2, seed + 141) - 0.5) * 3;
  const u = (x + 0.5 - mid) / (w / 2);
  if (Math.abs(u) > 1) return -1;
  const top = Math.min(mat === 'crystal' ? 4 : 3, w * (mat === 'crystal' ? 0.6 : 0.34)) * (0.7 + hash2(cx, 3, seed + 141) * 0.4);
  const prof = mat === 'crystal' ? top * (1 - Math.abs(u) * 0.9) : top * Math.pow(1 - u * u, 0.6) + (noise1(x * 0.9, seed + 142) - 0.5) * 0.6;
  if (h > prof) return -1;
  const lit = h > prof - 1 ? 1.4 : 0;
  switch (mat) {
    case 'crystal': return pk(hh > 0.25 ? FP.crys : FP.crysV, 3 + lit - u * 0.8, x, h, 0.4);
    case 'mud': return pk(FP.mud, 4 + lit - u * 0.6, x, h, 0.4);
    case 'guano': return pk(FP.guano, 3 + lit, x, h, 0.4);
    case 'flow': case 'rim': case 'moon': return pk(FP.calc, 1.6 + lit * 0.8 - u * 0.8, x, h, 0.4);
    case 'shingle': return pk(hh > 0.5 ? FP.peb : FP.pebW, 4.4 + lit - u, x, h, 0.4);
    case 'seabed': return pk(FP.sand, 3 + lit - u, x, h, 0.4);
    default: return pk(FP.slab, 6.6 + lit - u * 1.2, x, h, 0.4);
  }
}

/** a little stalagmite stub standing in the band: is (lx, ly) inside one of height h, width w? (lx from its axis, ly up from its foot) */
export function stubPx(lx: number, ly: number, h: number, w: number, seed: number, wet: boolean): C | -1 {
  const t = ly / h;
  if (t < 0 || t > 1) return -1;
  // a squat stump of dripstone: a flared foot, a lumpy waist, a rounded wet top
  let half = (w / 2) * (1 - Math.pow(t, 1.7) * 0.5) * (1 + (noise1(ly / 2.2, seed) - 0.5) * 0.3) + (t < 0.25 ? (0.25 - t) * w * 1.1 : 0);
  if (t > 0.78) half *= Math.sqrt(Math.max(0, (1 - t) / 0.22));
  if (Math.abs(lx + 0.5) > half + 0.2) return -1;
  const u = (lx + 0.5) / Math.max(0.6, half);
  const ring = Math.sin(ly * 1.4 + seed) > 0.75 ? 0.8 : 0;
  const ramp = wet ? FP.calc : FP.slab;
  return pk(ramp, ramp.length * (0.62 - u * 0.24 - (1 - t) * 0.1) + ring + (t > 0.8 ? 1.2 : 0), lx, ly, 0.5);
}

/**
 * A side-view cave floor for a whole site (the sea grotto, the deep): the floor plane from the walk line
 * down toward the camera (`h` rows), crumbs on the walk line, the front edge ragged into the dark
 * rock under it. Returns the buffer and the world row its top sits at.
 */
export function paintFloorStrip(width: number, ground: (x: number) => number, o: { mat: (x: number) => CaveFloorMat; seed: number; h?: number; depth?: number; dark?: C }): { buf: PixelBuffer; y0: number } {
  const h = o.h ?? 130;
  let yTop = 1e9;
  for (let x = 0; x <= width; x += 6) yTop = Math.min(yTop, ground(x));
  yTop = Math.floor(yTop) - 6;
  const buf = new PixelBuffer(width, h);
  const D0 = o.depth ?? Math.round(h * 0.78);
  const dark = o.dark ?? FP.slab[0];
  for (let x = 0; x < width; x++) {
    const mat = o.mat(x);
    const edgeCol = o.mat(x - 22) !== mat || o.mat(x + 22) !== mat;
    const gy = Math.round(ground(x) - yTop);
    const D = Math.max(16, D0 + Math.round((bandDepth(x, mat, o.seed) - 22) * 1.4));
    // crumbs on the walk line
    for (let hh = 1; hh <= 4; hh++) { const c = crumbAt(x, hh - 0.5, mat, o.seed); if (c !== -1 && gy - hh >= 0) buf.data[(gy - hh) * width + x] = c; }
    for (let y = Math.max(0, gy); y < h; y++) {
      const d = y - gy;
      let c: C;
      if (d < D) {
        const [z, P, v] = bandCoords(d, D);
        // (a deep strip of floor reaches toward the camera: its ground is drawn at a larger scale)
        const m = edgeCol && d > 0 ? o.mat(x + (noise2(x / 7, d / 4, o.seed + 170) - 0.5) * 48 + (hash2(x, y, o.seed + 171) - 0.5) * 8) : mat;
        c = floorTex(x, z * 0.55, P, v, y + yTop, m, o.seed);
        if (d === 0) c = shade(c, -0.12);
      } else if (d < D + 3) c = bandEdge(x, y + yTop, d - D, mat, o.seed);
      else {
        // the rock under it, falling away into the dark: bedding lines, cracks, a little grit
        const dd = d - D - 3;
        const bed = Math.floor((y + yTop + noise1(x / 30, o.seed + 150) * 6) / 9);
        let l = 2.6 - dd * 0.06 + (noise1(x / 40 + bed * 3.1, o.seed + 151) - 0.5) * 1.4;
        if ((y + yTop + Math.round(noise1(x / 30, o.seed + 150) * 6)) % 9 === 0 && noise1(x / 14 + bed, o.seed + 152) > 0.35) l -= 1.2;
        if (Math.abs(noise2(x / 12, y / 9, o.seed + 153) - 0.5) < 0.014) l -= 1.2;
        c = l < 0.4 ? dark : pk(FP.slab, l, x, y);
      }
      buf.data[y * width + x] = c;
    }
  }
  // stalagmite stubs and loose stones standing on the floor (inside the band, never over the walk line)
  for (let cx = 0; cx < width; cx += 23) {
    const hh = hash2(cx, 7, o.seed + 160);
    if (hh > 0.42) continue;
    const x = Math.round(cx + hash2(cx, 8, o.seed + 160) * 18);
    if (x < 3 || x > width - 4) continue;
    const mat = o.mat(x);
    const gy = Math.round(ground(x) - yTop);
    const D = Math.max(16, D0 + Math.round((bandDepth(x, mat, o.seed) - 22) * 1.4));
    const foot = gy + 6 + Math.round(hash2(cx, 9, o.seed + 160) * (D - 12));
    const sh = Math.min(foot - gy - 2, 4 + Math.round(hash2(cx, 10, o.seed + 160) * 7 * (0.5 + (foot - gy) / D)));
    const sw = 3 + Math.round(hash2(cx, 11, o.seed + 160) * 3 * (0.6 + (foot - gy) / D));
    if (sh < 3) continue;
    for (let ly = 0; ly <= sh; ly++) for (let lx = -sw; lx <= sw; lx++) {
      const c = stubPx(lx, ly, sh, sw, cx, mat === 'flow' || mat === 'rim');
      const X = x + lx, Y = foot - ly;
      if (c !== -1 && X >= 0 && X < width && Y >= 0 && Y < h) buf.data[Y * width + X] = c;
    }
    // its shadow cast toward the camera
    for (let lx = -sw + 1; lx <= sw; lx++) { const X = x + lx + 1, Y = foot + 1; if (X >= 0 && X < width && Y < h) buf.data[Y * width + X] = shade(buf.data[Y * width + X], -0.3); }
  }
  return { buf, y0: yTop };
}

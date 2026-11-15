// V12 Te Moana Rimurimu, the floor: painted in chunks along the stage, from the floor line down.
//
// Sand under the Kitten and through the kelp (warm and rippled in the shallows, pale and grey-blue in the
// blue), coralline-crusted reef rock, the boulders (each its own rock: form-lit from the surface,
// plated and cracked, pink coralline crust with a lit lip, turf algae standing off the crown, a dark
// crevice where two meet), crayfish slots under them, the drop-off walls (strata, joints, ledges and
// sponges and jewel anemones on the face, the overhang's shadow under each lip, caves), the groper's
// cave mouth. Everything is pulled toward the water's colour with depth.

import { PixelBuffer } from '../../pixel';
import { C, hex, mix, rgba, shade } from '../../color';
import { bayer, clamp, hash2, noise1, noise2 } from '../../../core/math';
import {
  BOULDERS, CRAY_HOLES, GROPER_CAVE, PPM, SURF, WALL_CAVES, WALLS, baseY, boulderAt, boulderShape, depthAt, floorAt, groveAt, inWall, waterRGB, zoneAt,
} from '../../../game/v12/dive/layout';

const r = (...h: string[]) => h.map(x => hex(x));
export const SAND = r('#2e2c22', '#47432f', '#625c40', '#7c7452', '#948b64', '#a8a076', '#bab38a', '#ccc6a2');
const SAND_DEEP = r('#26303a', '#36434e', '#4a5862', '#5e6e76', '#74858a', '#8c9c9e', '#a6b4b4', '#c0cccb');
const GRAVEL = r('#2a2a24', '#3e3c32', '#545044', '#6a6656', '#827d6a', '#9a947e', '#b2ab94');
export const ROCK = r('#121512', '#1c211c', '#262d26', '#323a30', '#3f493c', '#4d5848', '#5d6956', '#6f7b66', '#848f78', '#9aa48c');
const ROCK_BLUE = r('#0e1418', '#161e24', '#1f2a32', '#2a3740', '#36454e', '#43545e', '#52646c', '#64767c', '#7a8a8e', '#94a2a2');
export const CORAL = r('#4a1e30', '#6e2c46', '#94405e', '#b85a78', '#d27c96', '#e6a0b4', '#f4c4d0');
const TURF = r('#2c3412', '#3a4418', '#55601e', '#727c2a', '#8e9638');
const TURF_RED = r('#3a1414', '#5a1e1e', '#7c2c26', '#9c4030');
const SPONGE = [r('#7a3416', '#c0602a', '#e08a3a', '#f4b05a'), r('#7a6418', '#c8a830', '#e6cc4a', '#f6e27a'), r('#3a1a48', '#5a2a6a', '#7c3e8e', '#a05ab0')];
const JEWEL = r('#f088b0', '#f0a050', '#f0f0e0', '#80e0a0', '#b080f0', '#f05a6a');
const EARTH = r('#07090a', '#0d1110', '#141915', '#1c221c', '#252b23', '#2f352b');
const VOID = r('#020406', '#05090c', '#0a1014', '#111a20', '#1a262e');

const pick = (rp: C[], f: number) => rp[f <= 0 ? 0 : f >= rp.length - 1 ? rp.length - 1 : Math.round(f)];
const toC = (c: [number, number, number]) => rgba(c[0] * 255, c[1] * 255, c[2] * 255);

/** how much of the water colour a surface at depth d (m) takes */
const fogK = (d: number) => clamp(0.12 + d * 0.012, 0, 0.44);

export interface Chunk { x0: number; y0: number; buf: PixelBuffer }

/** how deep (px below the floor line) the seabed plane runs toward the viewer before the dark */
export const PLANE = 64;

/** each drop-off wall's face: for every row from its lip to its foot, the x where the water starts */
let faces: { yTop: number; yBot: number; fx: number[] }[] | null = null;
function wallFaces() {
  if (faces) return faces;
  faces = WALLS.map(([a, e]) => {
    const yTop = Math.round(floorAt(a - 6)), yBot = Math.round(floorAt(e + 6));
    const fx: number[] = [];
    let x = a - 8;
    for (let y = yTop; y <= yBot; y++) {
      while (x < e + 8 && floorAt(x) < y) x++;
      fx.push(x);
    }
    return { yTop, yBot, fx };
  });
  return faces;
}
/** how far (px) left of a wall's face a point is (Infinity when it is not behind a face) */
function faceDist(x: number, y: number): number {
  let best = Infinity;
  for (const f of wallFaces()) {
    if (y < f.yTop || y > f.yBot) continue;
    const d = f.fx[y - f.yTop] - x;
    if (d >= 0 && d < best) best = d;
  }
  return best;
}

/** sediment the floor is made of at x, y (0 sand, 1 gravel and shell hash between the boulders, 2 bedrock);
 *  the borders wander with depth so no material ends in a straight line */
function sediment(x: number, y = 0): number {
  const xx = x + (noise1(y * 0.045 + x * 0.004, 5) - 0.5) * 18 + (y > 0 ? 0 : 0);
  if (xx > 1420 && xx < 2380) return 1;
  if (xx > 2640 && xx < 3800) return xx > 3380 ? 1 : 2;
  // reef rock platforms in the shallows, crusted pink
  if (xx > 440 && xx < 1420) return noise1(xx * 0.012, 7) > 0.62 ? 2 : 0;
  return 0;
}

/**
 * Paint the floor from x0 over w columns, from just above the floor line to `bot` (world y).
 * Returns the chunk and where its top-left sits in the world.
 */
export function paintFloor(x0: number, w: number, bot: number): Chunk {
  let top = 1e9;
  for (let x = x0 - 2; x < x0 + w + 2; x++) top = Math.min(top, floorAt(x));
  const y0 = Math.floor(top) - 6;
  const H = Math.max(8, Math.ceil(bot - y0));
  const b = new PixelBuffer(w, H);
  const set = (x: number, y: number, c: C) => b.set(x - x0, y - y0, c);
  const get = (x: number, y: number) => b.get(x - x0, y - y0);
  // per column: the floor, the sediment line, the boulder on top (one column of margin each side)
  const F: number[] = [], BY: number[] = [], BO: (ReturnType<typeof boulderAt>)[] = [];
  for (let x = x0 - 8; x <= x0 + w + 8; x++) { F.push(floorAt(x)); BY.push(baseY(x)); BO.push(boulderAt(x)); }
  const col = (x: number) => x - x0 + 8;
  /** how close a boulder's foot is (0..1): the sand darkens in its shadow */
  const nearBoulder = (i: number) => {
    let k = 0;
    for (let j = -7; j <= 7; j++) { const o = BO[i + j]; if (o && o.y < BY[i + j] - 2) k = Math.max(k, 1 - Math.abs(j) / 8); }
    return k;
  };
  for (let x = x0; x < x0 + w; x++) {
    const i = col(x);
    const fy = F[i], by = BY[i], bo = BO[i];
    const z = zoneAt(x);
    const wall = inWall(x);
    const slope = Math.abs(F[i + 1] - F[i - 1]) * 0.5;
    const ao = bo && bo.y < by - 2 ? 0 : nearBoulder(i);
    const fy0 = Math.round(fy);
    const onBoulder = !!bo && bo.y < by - 0.5;
    const dF = depthAt(fy), waterF = toC(waterRGB(z, dF));
    // the floor plane: below the floor line the seabed runs toward the viewer (sand ripples widening as
    // they come closer, pebbles and shells, rock platforms crusted pink), lit like the line itself; only
    // well below it, and behind the drop-off walls, does it turn to the rock's dark body
    const pTop = onBoulder ? by + 2 : fy;
    // (toward a drop-off's lip the plane thins to a ledge and the cliff's face takes over)
    let plane = PLANE;
    for (const f of wallFaces()) if (x < f.fx[0] + 2 && fy < f.yTop + 6) plane = Math.min(plane, 9 + (PLANE - 9) * clamp((f.fx[0] - x - 16) / 150));
    for (let y = fy0; y < y0 + H; y++) {
      const fd = faceDist(x, y);
      let c: C;
      let fogMul = 1;
      const inBoulder = onBoulder && y < by + 3;
      const e = y - pTop;
      if (inBoulder) c = boulderPx(x, y, bo!.i, fy, by, i, BO);
      else if (e < plane) {
        const v = clamp(e / plane);
        const sed = sediment(x, y);
        c = sed === 2 || wall ? rockPlane(x, y, e, z) : sedPx(x, y, e, sed, z);
        // the sand in a boulder's shadow, just in front of it
        if (ao > 0 && e < 10) c = shade(c, -0.24 * ao * (1 - e / 10));
        // under the kelp the floor lies in the canopy's dappled shade (blotches with gaps of light)
        const gv = groveAt(x);
        if (gv > 0.05 && x < 1450) {
          const blot = noise2(x * 0.035, e * 0.09 + x * 0.004, 141);
          const k = blot > 0.42 ? 1 : blot > 0.34 ? ((x + y) & 1) : 0;
          if (k) c = shade(c, -0.24 * gv);
        }
        // the far edge of the plane is hazier than its near rows
        fogMul = 1 - 0.4 * v;
        // the plane's near rows shade off into the dark under it (banded)
        const k = clamp((e - plane * 0.72) / (plane * 0.28));
        if (k > 0) c = mix(c, under(x, y, 0, z), Math.round((k * 0.85 + (bayer(x, y) - 0.5) * 0.25) * 4) / 4);
      } else {
        // the rock's body (and the drop-off's faces, lit from the water side)
        const dy = Math.min(Math.max(0, e - plane), fd * 0.8);
        c = rockPx(x, y, dy, z, wall || slope > 1.6 || fd < 120);
        const deepK = clamp((dy - 4) / 30);
        if (deepK > 0) c = mix(c, under(x, y, dy, z), Math.round((Math.pow(deepK, 0.8) * 0.95 + (bayer(x, y) - 0.5) * 0.2) * 5) / 5);
        fogMul = 1 - 0.6 * deepK;
      }
      set(x, y, mix(c, waterF, fogK(dF) * fogMul));
    }
  }
  // details on top of the painted ground
  detailWalls(b, x0, y0, w);
  for (const hx of CRAY_HOLES) if (hx > x0 - 20 && hx < x0 + w + 20) crayHole(b, x0, y0, hx);
  for (const [cx, dm, cw, ch] of WALL_CAVES) if (cx > x0 - 60 && cx < x0 + w + 60) cave(b, x0, y0, cx, SURF + dm * PPM, cw, ch, 3);
  if (GROPER_CAVE.x > x0 - 80 && GROPER_CAVE.x < x0 + w + 80) groperCave(b, x0, y0);
  turfAndCrust(b, x0, y0, w, F, BO, col);
  void get;
  return { x0, y0, buf: b };
}

/** the nearest of a jittered grid of seeds (cells cw x ch): which cell, and how far from its border */
function cellOf(px: number, py: number, cw: number, ch: number, seed: number, xs = 0.62) {
  const gx = Math.floor(px / cw), gy = Math.floor(py / ch);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const sx = cx * cw + hash2(cx, cy, seed) * cw * 0.82 + cw * 0.09, sy = cy * ch + hash2(cx, cy, seed + 2) * ch * 0.7 + ch * 0.15;
    const ddx = (px - sx) * xs, ddy = py - sy;
    const d = ddx * ddx + ddy * ddy;
    if (d < d1) { d2 = d1; d1 = d; id = cx * 7919 + cy * 31 + seed; } else if (d < d2) d2 = d;
  }
  return { id, gap: Math.sqrt(d2) - Math.sqrt(d1) };
}

/** the dark earth under every material: faint strata, the odd buried stone, deepening to black */
function under(x: number, y: number, e: number, z: number): C {
  const blue = clamp((z - 1.4) / 1.4);
  const st = Math.sin(y * 0.22 + noise1(x * 0.01, 101) * 4);
  let f = 3.2 - Math.min(2.6, e * 0.022) + (st > 0.8 ? 0.4 : 0) + (bayer(x, y) - 0.5) * 0.35;
  if (hash2(x >> 2, y >> 1, 103) < 0.02) f += 0.8;
  return blue > 0 ? mix(pick(EARTH, f), pick(ROCK_BLUE, f - 0.6), blue) : pick(EARTH, f);
}

/** sand, gravel: ripples across the top, grit and shell flecks, settling darker with depth */
function sedPx(x: number, y: number, dy: number, sed: number, z: number): C {
  const deep = clamp((z - 1.6) / 1.2);
  if (sed === 1) {
    // gravel and shell hash: a field of little pebbles, each lit on top and shadowed under, growing as
    // the plane comes toward the viewer
    const cs = dy > 34 ? 5 : dy > 14 ? 4 : 3;
    const cy = Math.floor(y / (cs - 1)), cx = Math.floor((x + (cy % 2) * 2) / cs);
    const hx = hash2(cx, cy, 17);
    const px = cx * cs - (cy % 2) * 2 + 1 + Math.floor(hx * (cs - 2)), py = cy * (cs - 1) + 1;
    const ddx = x - px, ddy = y - py;
    let f = 3.4 + (noise2(x * 0.05, y * 0.1, 21) - 0.5) * 1.6 + (bayer(x, y) - 0.5) * 0.5;
    if (hx > 0.25 && ddx >= -1 && ddx <= 1 && ddy >= -1 && ddy <= 0) f += ddy < 0 ? (ddx < 1 ? 2.2 : 1.4) : (ddx > 0 ? 0.4 : 1.2);
    else if (hx > 0.25 && ddy === 1 && ddx >= -1 && ddx <= 1) f -= 1.2;
    if (dy < 1) f = 6;
    let c = pick(GRAVEL, f);
    if (hx < 0.05 && ddx === 0 && ddy === 0) c = hex('#e6dccc');
    else if (hx > 0.97 && ddy <= 0 && Math.abs(ddx) <= 1) c = CORAL[4];
    return deep > 0 ? mix(c, pick(SAND_DEEP, f), deep) : c;
  }
  // sand ripples on the plane: crests run across, their spacing widening as they come toward the viewer;
  // each a lit crest row and a shadowed trough under it
  const q = Math.pow(Math.max(0, dy), 0.78) * 0.62 + noise1(x * 0.05, 29) * 1.8 + Math.sin(x * 0.11 + noise1(x * 0.02, 30) * 4) * 0.45;
  const ph = q - Math.floor(q);
  // patches: darker sand where the swell has sorted it finer, pale where shell has collected
  const patch = noise2(x * 0.025, y * 0.06, 27);
  let f = 4.2 + (patch > 0.62 ? -0.8 : patch < 0.3 ? 0.6 : 0) + (bayer(x, y) - 0.5) * 0.7;
  // (crests break up here and there)
  const broken = noise2(x * 0.09, dy * 0.25, 31) < 0.3;
  if (ph < 0.16 && !broken) f += 1.1;
  else if (ph > 0.74 && !broken) f -= 0.9;
  if (dy < 1.2) f = 7;
  else if (dy < 2.4) f = 6;
  const g = hash2(x >> 1, y, 31);
  let c = deep > 0 ? mix(pick(SAND, f), pick(SAND_DEEP, f), deep) : pick(SAND, f);
  // shell grit and pebbles: bigger (two px) toward the viewer
  const big = dy > 22;
  const g2 = big ? hash2(x >> 1, y >> 1, 35) : g;
  if (g2 < 0.01 && dy > 1) c = hex('#f0e8d8');
  else if (g2 > 0.991 && dy > 1) c = pick(ROCK, 3 + (y % 2));
  else if (g2 > 0.986 && dy > 1) c = pick(SAND, 3);
  return c;
}

/** reef rock seen from above on the plane: plates and pits, pink crust patches with lit lips, turf tufts */
function rockPlane(x: number, y: number, e: number, z: number): C {
  const blue = clamp((z - 1.4) / 1.4);
  // plates of rock seen from above, foreshortened: the cells widen and deepen toward the viewer
  const u = x / (1 + e * 0.012), v = Math.pow(Math.max(0, e), 0.85) * 1.5;
  const c0 = cellOf(u, v, 15, 9, 121, 0.55);
  let f = 4.5 + (hash2(c0.id, 1, 123) - 0.5) * 1.5 + (bayer(x, y) - 0.5) * 0.45;
  if (c0.gap < 0.8) f = 2.2;
  else {
    const c1 = cellOf(u, Math.pow(Math.max(0, e - 1), 0.85) * 1.5, 15, 9, 121, 0.55);
    if (c1.id !== c0.id) f += 1.5;
  }
  if (e < 1.2) f = 7.4; else if (e < 2.4) f = 6.4;
  let c = blue > 0 ? mix(pick(ROCK, f), pick(ROCK_BLUE, f), blue) : pick(ROCK, f);
  // a pink crust along some plates' lit lips, tufts of turf on others (their seams stay rock)
  const kind = hash2(c0.id, 5, 125);
  if (c0.gap >= 0.8 && e >= 2.4 && f > 5.4) {
    if (kind < 0.35 * clamp(2.4 - z) && z < 2.4) c = pick(CORAL, 4 + (bayer(x, y) - 0.5) * 0.8);
    else if (kind > 0.75 && z < 2 && ((x * 3 + y) % 4 === 0)) c = pick(TURF, 3);
  } else if (c0.gap >= 0.8 && kind > 0.8 && z < 2 && hash2(x, y, 127) < 0.18) c = pick(TURF, 1.6 + hash2(x, y, 129) * 2);
  return c;
}

/** bedrock and wall rock: muted plates and strata, a face texture on the walls (vertical joints, ledges) */
function rockPx(x: number, y: number, dy: number, z: number, face: boolean): C {
  const blue = clamp((z - 1.4) / 1.4);
  let f: number;
  if (face) f = blockRock(x, y) - Math.min(1.2, dy * 0.03);
  else {
    const strata = Math.sin(y * 0.3 + noise1(x * 0.015, 37) * 5);
    const plate = noise2(x * 0.07, y * 0.1, 41);
    f = 4.2 + (plate - 0.5) * 1.4 + (strata > 0.85 ? 0.5 : 0) - Math.min(1.5, dy * 0.06) + (bayer(x, y) - 0.5) * 0.5;
    if (dy < 1.2) f += 2;
    else if (dy < 2.5) f += 0.8;
  }
  return blue > 0 ? mix(pick(ROCK, f), pick(ROCK_BLUE, f), blue) : pick(ROCK, f);
}

/**
 * The drop-off's walls are fractured blocks: every pixel belongs to the nearest of a jittered grid of
 * seeds (blocks wider than tall, like bedding); the seams between blocks are dark cracks, the top rows
 * of each block catch the light from above (a lit ledge), the bottom rows sit in the shadow of the one
 * below it, and each block has its own tone. Returns a ROCK ramp index.
 */
function blockRock(x: number, y: number): number {
  const C0 = cellOf(x, y, 30, 11, 111, 0.42);
  if (C0.gap < 0.9) return 1.2;
  const above = cellOf(x, y - 1, 30, 11, 111, 0.42).id !== C0.id || cellOf(x, y - 2, 30, 11, 111, 0.42).id !== C0.id;
  const below = cellOf(x, y + 1, 30, 11, 111, 0.42).id !== C0.id;
  let f = 4.2 + (hash2(C0.id, 3, 117) - 0.5) * 1.5 + (bayer(x, y) - 0.5) * 0.45;
  if (above) f += 1.9;
  else if (below) f -= 1.3;
  return f;
}

/**
 * One boulder's pixel. Seen from the side: a lit band along its top edge (the face toward the surface),
 * facets lit by their slope (left-facing ones catch the light), the body turning darker and cooler down to
 * the shadowed foot, a few bold cracks with a lit lip, mottled lichen-like patches, a crevice where two meet.
 */
function boulderPx(x: number, y: number, bi: number, fy: number, by: number, ci: number, BO: (ReturnType<typeof boulderAt>)[]): C {
  const [cx, hw] = BOULDERS[bi];
  const u = (x - cx) / hw;
  const sh = boulderShape(bi, u);
  const e = y - fy;
  const span = Math.max(4, by + 3 - fy);
  const v = clamp(e / span);
  // the facet's light: flat tops and left-facing slopes bright, right-facing slopes turned away
  const facet = clamp(0.5 + sh.slope * 0.35, 0, 1);
  let f = 4.6 - v * 2.8 - u * 0.7 + (facet - 0.5) * 1.6;
  if (e < 1.2) f = 7.6 + (facet - 0.5) * 1.6;
  else if (e < 3.5) f = 6.4 + (facet - 0.5) * 2 - e * 0.15;
  // mottling: lichen-like patches in clusters
  const m = noise2(x * 0.16 + bi * 7, y * 0.19, 47);
  if (m > 0.64) f += 0.9; else if (m < 0.3) f -= 0.7;
  f += (bayer(x, y) - 0.5) * 0.45;
  // a few bold cracks, each with a lit lip above it
  const cr = Math.abs(noise2(x * 0.05 + bi * 3, y * 0.035, 51) - 0.5);
  if (cr < 0.009 && e > 3) f -= 3;
  else if (cr < 0.02 && e > 3 && noise2(x * 0.05 + bi * 3, (y - 1) * 0.035, 51) > 0.5) f += 1;
  // the edge against the water on the right turns away (a dark rim)
  if (floorAt(x + 1) > y + 0.5 && e > 2) f -= 1.6;
  // the foot of the boulder sits in its own shadow; a crevice where two boulders meet
  if (y > by - 2) f -= 1.8 + (y - by + 2) * 0.4;
  const l = BO[ci - 1], rr = BO[ci + 1];
  if (((l && l.i !== bi) || (rr && rr.i !== bi)) && e < 9) f -= 3.2 - e * 0.25;
  const blue = clamp((zoneAt(x) - 1.4) / 1.4);
  return blue > 0 ? mix(pick(ROCK, f), pick(ROCK_BLUE, f), blue) : pick(ROCK, f);
}

/** coralline crust, turf algae standing off the crown, sponges and pebbles along the floor line */
function turfAndCrust(b: PixelBuffer, x0: number, y0: number, w: number, F: number[], BO: (ReturnType<typeof boulderAt>)[], col: (x: number) => number) {
  const set = (x: number, y: number, c: C) => b.set(x - x0, y - y0, c);
  const get = (x: number, y: number) => b.get(x - x0, y - y0);
  for (let x = x0; x < x0 + w; x++) {
    const i = col(x), fy = Math.round(F[i]);
    const bo = BO[i];
    const rock = !!bo || sediment(x, fy) === 2 || inWall(x);
    if (!rock) continue;
    // (not down a steep face: the life there is the walls' own)
    if (Math.abs(F[i + 1] - F[i - 1]) > 2.4) continue;
    const d = depthAt(fy), fk = fogK(d), z = zoneAt(x);
    // coralline needs light: thick in the shallows, thinning out below 14 m, rare in the blue
    const lightK = clamp(1.4 - d / 16);
    const water = toC(waterRGB(z, d));
    const fade = (c: C) => mix(c, water, fk);
    // coralline crust: a pink skin along the top in patches (knobbly, its lip lit), and spots down the faces
    const seed = 53 + (bo ? bo.i : 0);
    const patch = noise1(x * 0.07, seed);
    if (patch > 0.42 + (1 - lightK) * 0.5) {
      const th = 1 + Math.floor((patch - 0.42) * 7);
      for (let k = 0; k < th; k++) if (get(x, fy + k) >>> 24) set(x, fy + k, fade(pick(CORAL, 5.6 - k * 1.3 + (bayer(x, fy + k) - 0.5) * 0.5)));
      if (hash2(x, 1, seed) < 0.3) set(x, fy - 1, fade(CORAL[hash2(x, 2, seed) < 0.5 ? 4 : 6]));
    }
    for (let k = 3; k < 16; k++) {
      const y = fy + k;
      const n = noise2(x * 0.2, y * 0.24, seed + 2);
      if (n < 0.7 + (1 - lightK) * 0.25 || !(get(x, y) >>> 24)) continue;
      const lip = noise2(x * 0.2, (y - 1) * 0.24, seed + 2) < 0.7;
      set(x, y, fade(pick(CORAL, (lip ? 4.6 : 2.6) - k * 0.08)));
    }
    // turf algae: little strands standing off the crown (only where the light reaches)
    if (d < 22 && hash2(x, 3, 57) < 0.5) {
      const red = noise1(x * 0.05, 59) > 0.6;
      const tf = red ? TURF_RED : TURF;
      const hgt = 1 + Math.floor(hash2(x, 5, 61) * (d < 12 ? 4 : 2.5));
      const lean = noise1(x * 0.3, 63) > 0.5 ? 1 : 0;
      for (let k = 1; k <= hgt; k++) set(x + (k > 2 ? lean : 0), fy - k, fade(pick(tf, tf.length - 1 - (hgt - k) * 0.8 - (x % 2) * 0.6)));
    }
    // sponges and jewel anemones along the boulder and ledge tops, deeper down mostly
    if (hash2(x, 7, 67) < (d > 14 ? 0.045 : 0.018)) {
      const sp = SPONGE[Math.floor(hash2(x, 9, 69) * 3)];
      const n = 2 + Math.floor(hash2(x, 11, 71) * 3);
      for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) set(x + j, fy - k, fade(sp[clamp(3 - k + (j ? -1 : 0), 0, 3)]));
      set(x, fy - n, fade(sp[1]));
    }
  }
}

/** the drop-off walls: ledges with a lit lip and a shadowed band under each, sponges and jewel anemones in colonies on the face */
function detailWalls(b: PixelBuffer, x0: number, y0: number, w: number) {
  for (const f of wallFaces()) {
    const fx0 = f.fx[0];
    // colonies on the face: jewel anemones (a patch of one colour, a lit pixel in it), little finger sponges
    for (let y = f.yTop + 4; y <= f.yBot; y += 3) {
      const fx = f.fx[y - f.yTop];
      for (let x = fx - 40; x < fx; x += 4) {
        const hc = hash2(x >> 2, y, 131);
        if (hc > 0.11) continue;
        const k = (fx - x) / 40;
        if (hash2(x, y, 133) < k * 1.2) continue;
        const px = x + Math.floor(hash2(x, y, 135) * 4), py = y;
        if (px < x0 || px >= x0 + w) continue;
        const d = depthAt(py), water = toC(waterRGB(zoneAt(px), d)), fk = fogK(d) * 0.7;
        if (hc < 0.075) {
          const jc = JEWEL[Math.floor(hash2(px >> 3, py >> 3, 137) * JEWEL.length)];
          const pts: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [2, 0, -0.2], [0, 1, -0.25], [1, 1, -0.2], [1, -1, 0.25]];
          for (const [dx, dy, l] of pts) if (b.get(px + dx - x0, py + dy - y0) >>> 24) b.set(px + dx - x0, py + dy - y0, mix(shade(jc, l), water, fk));
        } else {
          const sp = SPONGE[Math.floor(hash2(px >> 3, py >> 3, 139) * 3)];
          for (let k2 = 0; k2 < 3; k2++) {
            if (b.get(px - x0, py - k2 - y0) >>> 24 || k2 > 0) b.set(px - x0, py - k2 - y0, mix(sp[3 - k2], water, fk));
            b.set(px + 1 - x0, py - k2 - y0, mix(sp[2 - Math.min(2, k2)], water, fk));
          }
        }
      }
    }
    void fx0;
  }
}

/** a dark irregular opening into the rock: rings of darkness to a black heart, a lit lip over it */
function cave(b: PixelBuffer, x0: number, y0: number, cx: number, cy: number, cw: number, ch: number, seed: number) {
  const rx = cw / 2, ry = ch / 2;
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 2; y++) {
    for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
      const c = b.get(x - x0, y - y0);
      if (!(c >>> 24)) continue;
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
      const wob = 1 + (noise1(a * 2.2 + seed, 89 + seed) - 0.5) * 0.45 + (noise1(a * 6 + seed, 91) - 0.5) * 0.12;
      // a flatter floor to the opening, a ragged arch over it
      const dd = Math.hypot((x - cx) / rx, (y - cy) / (ry * (y > cy ? 0.7 : 1))) / wob;
      if (dd > 1.12) continue;
      if (dd > 1) { b.set(x - x0, y - y0, shade(c, y < cy ? 0.18 : -0.3)); continue; }
      const ring = Math.floor((1 - dd) * 5 + (bayer(x, y) - 0.5) * 0.8);
      b.set(x - x0, y - y0, VOID[clamp(4 - ring, 0, 4)]);
    }
  }
}

/** a crayfish slot: a low dark gap under the boulder's foot */
function crayHole(b: PixelBuffer, x0: number, y0: number, hx: number) {
  const by = baseY(hx);
  cave(b, x0, y0, hx, by - 4, 16, 8, hx % 7);
}

/** the groper's cave: a big dark mouth at the outcrop's foot, a rubble sill, life crowding the rim */
function groperCave(b: PixelBuffer, x0: number, y0: number) {
  const { x, w, h } = GROPER_CAVE;
  const by = baseY(x);
  cave(b, x0, y0, x, by - h * 0.42, w, h, 5);
  // the sill: rubble at the mouth
  for (let i = 0; i < 9; i++) {
    const rx = Math.round(x - w * 0.45 + i * w * 0.11 + noise1(i, 93) * 3), ry = Math.round(by - 2 - noise1(i * 1.7, 95) * 3);
    for (let k = -2; k <= 2; k++) for (let j = 0; j < 3; j++) {
      if (Math.abs(k) + j > 3) continue;
      const c = b.get(rx + k - x0, ry + j - y0);
      if (!(c >>> 24)) continue;
      b.set(rx + k - x0, ry + j - y0, pick(ROCK_BLUE, 6 - j * 1.4 - k * 0.4));
    }
  }
}

// ------------------------------------------------------------------ the water behind everything
/** a vertical strip of the water's colour for zone z, from the surface down `h` rows (one row = `mPerRow`
 *  metres): quantised bands with a dithered seam between each, tiling across in 4 px */
export function waterStrip(z: number, h: number, mPerRow: number): PixelBuffer {
  const W = 16;
  const b = new PixelBuffer(W, h);
  const BANDS = 22;
  for (let y = 0; y < h; y++) {
    const d = y * mPerRow;
    for (let x = 0; x < W; x++) {
      // which band: the depth in band units, the seam dithered over a couple of rows
      const t = Math.pow(clamp(d / 34), 0.85) * BANDS;
      const q = Math.floor(t + (bayer(x, y) - 0.5) * 0.9);
      const dq = (q / BANDS) ** (1 / 0.85) * 34;
      b.set(x, y, toC(waterRGB(z, dq)));
    }
  }
  return b;
}

export { toC };

// V12 Te Moana Rimurimu, the kelp-forest dive: the stage's geometry, which the scene (./scene.ts), the
// painters (src/art/v12/dive/*) and the dive's life (through DIVE_CTX) all read. Pure numbers, no art.
//
// World y runs down from the water surface (SURF = 0); depth is PPM world px per metre. Four zones,
// left to right and deeper (KELP_ZONES in ./ctx.ts):
//   shallows  0..1400     sand under the Kitten (a seagrass meadow), then the giant-kelp forest at 7..10 m,
//                         pink coralline rocks and the bull-kelp pinnacle that reaches up to 4 m
//   reef      1400..2800  a boulder reef at 10..14 m: crayfish holes under the boulders, stalked-kelp
//                         patches, a sand channel the eagle ray glides over
//   dropoff   2800..3800  the reef's lip at 14 m, a cliff down to a ledge at 20 m, a second cliff to
//                         27 m; caves in both walls; a talus of fallen boulders at the foot
//   blue      3800..4800  the deep floor at 28..30 m: open water, the outcrop with the groper's cave

import { KELP_ZONES } from './ctx';
import { clamp, fbm1, noise1 } from '../../../core/math';

export const W = KELP_ZONES.W;
/** world y of the water surface */
export const SURF = 0;
/** world px per metre of depth */
export const PPM = 22;
/** the lowest world y anything is painted to (below the deepest floor) */
export const BOT = 900;
/** the dive's camera zoom */
export const ZOOM = 1.3;
/** the art's reference row (the renderer's REF_Y): parallax layers pivot on it */
const REF = 180;
/**
 * Where a parallax layer (p, py) draws its stand-in for the surface: the layer y that sits on the stage's
 * own surface line when the camera is near the top (so far kelp reaches the surface where you see it
 * most; deeper down the far canopies lag behind, as they would in perspective).
 */
export function layerSurface(p: number, py: number): number {
  const c0 = 112, z = Math.pow(ZOOM, p);
  return REF + (c0 - REF) * py + (SURF - c0) * ZOOM / z;
}

/** the Kitten at anchor: hull from its transom (x) to its stem (x + 118) */
export const BOAT_X = 112;
export const BOAT_LEN = 118;
/** the boarding ladder hangs off the transom into the water */
export const LADDER = { x: BOAT_X + 8, top: SURF - 8, bot: SURF + 46 };
/** the anchor on the sand, and the line up to the Kitten's bow */
export const ANCHOR_X = 410;

// ------------------------------------------------------------------ the floor
/** the floor's depth in metres along x, before the boulders: keyframes eased into each other */
const KEYS: [number, number][] = [
  [-200, 7.0], [0, 7.0], [300, 7.3], [620, 8.2], [900, 8.6], [1200, 9.3], [1400, 10.1],
  [1700, 10.9], [2000, 11.6], [2300, 12.2], [2400, 12.4], [2650, 12.7], [2800, 13.4], [3010, 13.8],
  // the reef's lip, then the first wall down to the 20 m ledge
  [3058, 13.3], [3080, 14.4], [3096, 17.6], [3112, 20.1], [3190, 20.5], [3290, 20.9],
  // the ledge's lip, the second wall to the talus
  [3322, 20.5], [3345, 22.6], [3366, 26.2], [3392, 27.4], [3600, 28.1], [3800, 28.6],
  [4100, 29.2], [4500, 29.8], [4800, 30.2], [5000, 30.2],
];
/** the walls: x spans where the floor drops steeply (they get their own rock painting) */
export const WALLS: [number, number][] = [[3070, 3118], [3330, 3394]];

/** boulders and outcrops sitting on the floor: [centre x, half-width, height in metres] */
export const BOULDERS: [number, number, number][] = [
  // shallows: low coralline rocks, and the pinnacle the bull kelp grows on
  [520, 46, 1.3], [655, 54, 3.2], [724, 60, 4.5], [792, 42, 2.3], [1060, 58, 1.7], [1105, 34, 1.1], [1290, 44, 1.4],
  // the boulder reef (the sand channel 2380..2640 stays clear)
  [1470, 40, 1.6], [1556, 56, 2.5], [1610, 30, 1.3], [1680, 34, 1.2], [1770, 48, 2.6], [1830, 52, 3.3], [1940, 44, 1.8], [2050, 62, 2.7],
  [2105, 30, 1.6], [2165, 36, 1.4], [2250, 50, 2.9], [2320, 58, 3.7], [2700, 52, 2.0], [2790, 38, 1.5], [2930, 46, 1.6],
  // the 20 m ledge and the talus at the foot of the second wall
  [3170, 30, 1.0], [3250, 38, 1.4], [3430, 40, 1.8], [3500, 30, 1.1], [3590, 46, 1.6],
  // the blue: the groper's outcrop, a lone rock further out
  [4110, 64, 3.6], [4196, 84, 6.2], [4300, 62, 3.9], [4430, 30, 1.2], [4640, 58, 1.7],
];
/** the groper's cave: the dark mouth in the foot of the big outcrop's seaward boulder (painted into its
 *  face; the groper hangs in front of it, where Mori can come at it from the open floor beside) */
export const GROPER_CAVE = { x: 4322, w: 46, h: 34 };
/** caves in the drop-off walls (painted into the rock): [x, y (metres), w, h] */
export const WALL_CAVES: [number, number, number, number][] = [[3088, 16.6, 30, 22], [3356, 24.4, 34, 26], [3080, 19.0, 16, 12]];
/** crayfish holes: dark slots under the reef's boulders (world x of each mouth) */
export const CRAY_HOLES = [1530, 1838, 2010, 2325, 2742];

const ease = (t: number) => t * t * (3 - 2 * t);
/** the floor's depth (m) before the boulders */
export function baseDepth(x: number): number {
  let i = 1;
  while (i < KEYS.length - 1 && KEYS[i][0] < x) i++;
  const [x0, d0] = KEYS[i - 1], [x1, d1] = KEYS[i];
  const t = clamp((x - x0) / Math.max(1, x1 - x0));
  const steep = Math.abs(d1 - d0) / Math.max(1, x1 - x0) > 0.05;
  let d = d0 + (d1 - d0) * (steep ? t : ease(t));
  // a little relief everywhere (more on the walls: broken rock)
  d += (fbm1(x * 0.011, 3, 41) - 0.5) * 0.55 + (noise1(x * 0.09, 43) - 0.5) * 0.12;
  if (inWall(x)) d += (noise1(x * 0.35, 47) - 0.5) * 0.9;
  return d;
}
export const inWall = (x: number) => WALLS.some(([a, b]) => x >= a && x <= b);
/** world y of the floor before the boulders */
export function baseY(x: number): number {
  return SURF + baseDepth(x) * PPM;
}
/**
 * A boulder's profile, 0..1 across its width (u -1..1): hand-shaped from knots, not a dome. Steep
 * shoulders, a crown of two or three flattish facets meeting at soft corners, faces bulging a little,
 * and a lump here and there. Each boulder has its own (from its index).
 */
const PROFILES: [number, number][][] = [];
function profile(i: number): [number, number][] {
  if (PROFILES[i]) return PROFILES[i];
  const h = (k: number) => noise1(i * 13.7 + k * 3.1, 67);
  const k: [number, number][] = [
    [-1, 0],
    [-0.94 + h(1) * 0.08, 0.3 + h(2) * 0.35],
    [-0.62 + h(3) * 0.25, 0.62 + h(4) * 0.3],
    [-0.18 + h(5) * 0.3, 0.86 + h(6) * 0.14],
    [0.32 + h(7) * 0.25, 0.62 + h(8) * 0.34],
    [0.9 - h(9) * 0.08, 0.28 + h(10) * 0.4],
    [1, 0],
  ];
  return (PROFILES[i] = k);
}
/** 0..1: the boulder's height at u, and the slope of the facet there (for its light) */
export function boulderShape(i: number, u: number): { h: number; slope: number } {
  const k = profile(i);
  let j = 1;
  while (j < k.length - 1 && k[j][0] < u) j++;
  const [u0, h0] = k[j - 1], [u1, h1] = k[j];
  const t = clamp((u - u0) / Math.max(1e-6, u1 - u0));
  const h = h0 + (h1 - h0) * t + Math.sin(Math.PI * t) * 0.025 * (u1 - u0);
  return { h, slope: (h1 - h0) / Math.max(1e-6, u1 - u0) };
}
/** the boulder whose top is highest at x (and that top's world y), or null */
export function boulderAt(x: number): { i: number; y: number; u: number } | null {
  let best: { i: number; y: number; u: number } | null = null;
  for (let i = 0; i < BOULDERS.length; i++) {
    const [cx, hw, h] = BOULDERS[i];
    const u = (x - cx) / hw;
    if (u <= -1 || u >= 1) continue;
    const s = boulderShape(i, u).h;
    const lump = 1 + (noise1(x * 0.09 + i * 11, 59) - 0.5) * 0.08;
    const y = baseY(cx) + 4 - h * PPM * s * lump;
    if (!best || y < best.y) best = { i, y, u };
  }
  return best;
}
/** world y of the floor at x (the sand, the rock, the boulder tops) */
export function floorAt(x: number): number {
  const b = baseY(x);
  const bo = boulderAt(x);
  return bo && bo.y < b ? bo.y : b;
}
/** metres of depth at world y */
export const depthAt = (y: number) => Math.max(0, (y - SURF) / PPM);

// ------------------------------------------------------------------ zones and water
/** 0 shallows .. 1 reef .. 2 drop-off .. 3 the blue, eased across each border */
export function zoneAt(x: number): number {
  const B = [KELP_ZONES.shallows[1], KELP_ZONES.reef[1], KELP_ZONES.dropoff[1]];
  let z = 0;
  for (let i = 0; i < B.length; i++) z += ease(clamp((x - (B[i] - 160)) / 320));
  return z;
}
export type RGB = [number, number, number];
/** the water's colour (0..1 rgb): warm green over the kelp, teal over the reef, then deep blue */
const WATER: { top: RGB; bot: RGB }[] = [
  { top: [0.56, 0.76, 0.62], bot: [0.16, 0.34, 0.32] },
  { top: [0.46, 0.74, 0.74], bot: [0.1, 0.3, 0.38] },
  { top: [0.32, 0.6, 0.78], bot: [0.06, 0.19, 0.35] },
  { top: [0.26, 0.54, 0.8], bot: [0.05, 0.15, 0.31] },
];
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** the water colour at zone z and depth d (m): bright toward the surface, darker and bluer down */
export function waterRGB(z: number, d: number): RGB {
  const i = Math.min(2, Math.floor(clamp(z, 0, 2.999))), t = clamp(z - i);
  const top = lerp3(WATER[i].top, WATER[i + 1].top, t), bot = lerp3(WATER[i].bot, WATER[i + 1].bot, t);
  return lerp3(top, bot, clamp(Math.pow(d / 32, 0.8)));
}

// ------------------------------------------------------------------ the kelp
/** 0..1 how thick the kelp is around x (the main layer's groves), and how high up it reaches */
const GROVES: [number, number, number][] = [
  // [x0, x1, density]: the giant-kelp forest in the shallows, kelp patches on the reef
  [470, 640, 0.95], [760, 1010, 0.9], [1110, 1390, 1], [1420, 1500, 0.55], [1620, 1720, 0.6],
  [1870, 1990, 0.6], [2100, 2240, 0.65], [2660, 2860, 0.5], [2880, 3040, 0.45],
];
export function groveAt(x: number): number {
  let k = 0;
  for (const [a, b, d] of GROVES) {
    const e = 40;
    const t = Math.min(clamp((x - a + e) / (2 * e)), clamp((b + e - x) / (2 * e)));
    k = Math.max(k, d * ease(t));
  }
  return k;
}
export { GROVES };
/** giant kelp (towering to the surface) grows where the grove is in the shallows; on the reef the kelp
 *  is the stalked kind, a metre or two tall */
export const giantAt = (x: number) => x < 1420;
/** 0..1 how thick the kelp is at a point (sharks avoid it; Mori hides in it) */
export function kelpAt(x: number, y: number): number {
  const g = groveAt(x);
  if (g <= 0) return 0;
  const f = floorAt(x);
  if (y > f + 4) return 0;
  if (giantAt(x)) return g * (y < SURF + 26 ? 1 : 0.85);
  // the stalked kelp stands about 2 m off the floor
  return g * clamp(1 - (f - y - 40) / 30);
}

// ------------------------------------------------------------------ named places
/** what the dive's life uses (DIVE_CTX.spots): world coords, the floor or mid-water there */
export function spots(): Record<string, { x: number; y: number }> {
  const at = (x: number, up: number) => ({ x, y: Math.round(floorAt(x) - up) });
  const S: Record<string, { x: number; y: number }> = {
    // the seals play in the open water between the first groves, near the surface
    sealPlay: { x: 690, y: SURF + 70 },
    // the kingfish school cruises the reef's mid-water; blue cod sit by the boulders
    kingfish: { x: 2060, y: Math.round(SURF + 9 * PPM) },
    cod: at(1760, 10),
    // the eagle ray glides over the sand channel in the reef
    ray: at(2510, 18),
    // the groper hangs in the mouth of its cave
    groperCave: { x: GROPER_CAVE.x + 6, y: Math.round(baseY(GROPER_CAVE.x) - GROPER_CAVE.h * 0.45) },
    // the sunfish drifts in open water out in the blue
    sunfish: { x: 4520, y: Math.round(SURF + 13 * PPM) },
    // the sharks patrol along the drop-off and out over the blue
    sharkPatrol: { x: 3640, y: Math.round(SURF + 19 * PPM) },
    crayHoles: craySpot(CRAY_HOLES[1]),
    ladder: { x: LADDER.x, y: LADDER.bot },
    anchor: at(ANCHOR_X, 4),
  };
  CRAY_HOLES.forEach((x, i) => (S['crayHole' + i] = craySpot(x)));
  WALL_CAVES.forEach(([x, d], i) => (S['wallCave' + i] = { x, y: Math.round(SURF + d * PPM) }));
  return S;
}
function craySpot(x: number) {
  return { x, y: Math.round(baseY(x) - 3) };
}

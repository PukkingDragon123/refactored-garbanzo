// Deterministic procedural island for the 3D expedition map: heightmap, biomes and vertex colours,
// carved rivers with a waterfall cliff, sun shadows, sea-floor info, A* trails and tree placement.
// Everything is built once from a fixed seed. Coordinates are normalized map units: u (x) runs east,
// v (y) runs south, both 0..1. Heights are unitless: sea level is 0 and the volcano rim is about 0.9.

export const GRID = 192;
export const VN = GRID + 1;
export const CELL = 1 / GRID;
const SEED = 7331;

export type P2 = [number, number];

// Biomes (plain numbers so they survive isolatedModules).
export const B_SEA = 0, B_SAND = 1, B_GRASS = 2, B_FOREST = 3, B_CANOPY = 4, B_MANGROVE = 5, B_ROCK = 6,
  B_ALPINE = 7, B_ASH = 8, B_SNOW = 9, B_RIVER = 10, B_CRATER = 11, B_SCRUB = 12, B_FERN = 13, B_CLIFF = 14,
  B_WETSAND = 15, B_MUD = 16;

// Tree types (shared with the tree shader).
export const T_BROAD = 0, T_CONIFER = 1, T_PALM = 2, T_MANGROVE = 3, T_FERN = 4, T_KAURI = 5;
/** Floats per tree: u, v, h, size (map units), type, seed, sun visibility, tint. */
export const TREE_STRIDE = 8;

export interface RiverLine {
  /** Packed points: u, v, bed height, half width (map units), distance along (map units). */
  pts: Float32Array;
  count: number;
}

export interface MapFeature {
  id: string;
  name: string;
  kind: 'cave' | 'snare' | 'hazard';
  note: string;
  u: number;
  v: number;
}

export interface MapLabel { text: string; u: number; v: number; lift: number; size: number }

export interface Terrain {
  h: Float32Array;
  biome: Uint8Array;
  /** RGB per vertex. */
  color: Uint8Array;
  /** Direct-sun visibility per vertex (0 = cast shadow). */
  sun: Float32Array;
  /** Per vertex: 1 = draw contour lines. */
  contour: Uint8Array;
  /** Per vertex: glowing lava amount. */
  lava: Uint8Array;
  /** RGBA per vertex for the ocean shader: depth, reef, distance to shore, sun on the water. */
  sea: Uint8Array;
  rivers: RiverLine[];
  falls: { lip: [number, number, number]; pool: [number, number, number]; half: number };
  trees: Float32Array;
  treeCount: number;
  trails: P2[][];
  features: MapFeature[];
  labels: MapLabel[];
  sites: Record<string, P2>;
  camp: { tents: [number, number, number, number][]; fire: P2; wreck: [number, number, number] };
  volcano: P2;
  mudPools: P2;
  heightAt(u: number, v: number): number;
  sunAt(u: number, v: number): number;
  /** Walking route between two map points (follows trails, avoids cliffs and the sea). */
  route(a: P2, b: P2): P2[];
  /** Trap/hazard features within `r` map units of a polyline. */
  hazardsNear(line: P2[], r?: number): MapFeature[];
}

// ------------------------------------------------------------------ noise & small helpers

function hash(ix: number, iy: number, s: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number, oct: number, s: number): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += vnoise(x * f + i * 17.31, y * f - i * 9.17, s + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}
function ridged(x: number, y: number, oct: number, s: number): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0, w = 1;
  for (let i = 0; i < oct; i++) {
    let r = 1 - Math.abs(vnoise(x * f + i * 5.71, y * f + i * 3.37, s + i * 131) * 2 - 1);
    r *= r;
    sum += r * amp * w;
    norm += amp;
    w = Math.min(1, r * 1.8);
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}
/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (u: number, v: number, cu: number, cv: number, ru: number, rv: number) => {
  const a = (u - cu) / ru, b = (v - cv) / rv;
  return Math.exp(-(a * a + b * b));
};
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function polyDist(px: number, py: number, pts: P2[]) {
  let d = 1e9;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d;
}

/** Catmull-Rom through control points (each [u, v, ...extra]); extra values interpolate linearly. */
function spline(ctrl: number[][], per: number): number[][] {
  const out: number[][] = [];
  const P = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const pt = [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
      for (let e = 2; e < p1.length; e++) pt.push(mix(p1[e], p2[e], t));
      out.push(pt);
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}
/** Resample a polyline (with extra per-point values) at a uniform spacing. */
function resample(pts: number[][], spacing: number): number[][] {
  const out: number[][] = [pts[0].slice()];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = spacing - carry;
    while (s <= L) {
      const t = s / L;
      out.push(a.map((x, k) => mix(x, b[k], t)));
      s += spacing;
    }
    carry = L - (s - spacing);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > spacing * 0.35) out.push(last.slice());
  return out;
}
function chaikin(pts: P2[], iters: number): P2[] {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    if (p.length < 3) return p;
    const q: P2[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

// ------------------------------------------------------------------ layout of the island

export const SITE_POS: Record<string, P2> = {
  camp: [0.118, 0.607],
  fernwood: [0.28, 0.52],
  canopy: [0.42, 0.35],
  falls: [0.612, 0.224],
  mangrove: [0.55, 0.848],
  coast: [0.872, 0.5],
};
const VOLC: P2 = [0.655, 0.4];
const PLAT: P2 = [0.42, 0.35];
const RIDGE: P2[] = [[0.12, 0.3], [0.18, 0.22], [0.26, 0.168], [0.36, 0.14], [0.47, 0.125], [0.56, 0.118], [0.66, 0.118], [0.75, 0.135], [0.83, 0.16], [0.9, 0.2]];
const WRECK: [number, number, number] = [0.083, 0.638, 0.5];
const SINK: P2 = [0.352, 0.445];
const QUICK: P2 = [0.47, 0.8];
const MUD: P2 = [0.745, 0.54];

/** Escarpment line (the Thunder Falls cliff) as a function of u. */
const escarp = (u: number) => 0.203 + 0.012 * Math.sin((u - 0.58) * 26) + 0.006 * Math.sin((u - 0.5) * 61);
const FALLS_U = 0.58;

// Main river: u, v, bed height, half width, valley side slope.
const RIVER_MAIN: number[][] = [
  [0.612, 0.118, 0.7, 0.0022, 3.5],
  [0.603, 0.15, 0.62, 0.0025, 3.5],
  [0.591, 0.178, 0.575, 0.0028, 3.2],
  [FALLS_U + 0.001, escarp(FALLS_U) - 0.006, 0.555, 0.003, 9],
  [FALLS_U, escarp(FALLS_U) + 0.018, 0.135, 0.0055, 6],
  [0.572, 0.262, 0.127, 0.0038, 4],
  [0.552, 0.33, 0.11, 0.004, 2.4],
  [0.54, 0.4, 0.092, 0.0042, 2.0],
  [0.522, 0.47, 0.073, 0.0045, 1.7],
  [0.536, 0.55, 0.056, 0.0047, 1.5],
  [0.552, 0.63, 0.04, 0.005, 1.3],
  [0.556, 0.71, 0.027, 0.0052, 1.1],
  [0.553, 0.775, 0.016, 0.0052, 0.9],
];
const DELTA_BRANCHES: number[][][] = [
  [[0.553, 0.775, 0.016, 0.004, 0.8], [0.53, 0.815, 0.01, 0.0036, 0.7], [0.507, 0.86, 0.006, 0.0034, 0.6], [0.492, 0.912, -0.02, 0.0034, 0.6]],
  [[0.553, 0.775, 0.016, 0.004, 0.8], [0.557, 0.83, 0.009, 0.0036, 0.7], [0.556, 0.875, 0.005, 0.0034, 0.6], [0.558, 0.925, -0.02, 0.0034, 0.6]],
  [[0.553, 0.775, 0.016, 0.004, 0.8], [0.583, 0.815, 0.01, 0.0034, 0.7], [0.605, 0.855, 0.006, 0.0032, 0.6], [0.622, 0.905, -0.02, 0.0032, 0.6]],
];
// A small creek from the plateau's west side, through Fernwood, to the sea north of camp.
const CREEK: number[][] = [
  [0.335, 0.37, 0.22, 0.0014, 2.4],
  [0.3, 0.43, 0.13, 0.0017, 1.8],
  [0.25, 0.49, 0.075, 0.002, 1.4],
  [0.2, 0.535, 0.045, 0.0022, 1.2],
  [0.155, 0.553, 0.022, 0.0024, 1.0],
  [0.095, 0.556, -0.02, 0.0026, 0.8],
];

const FEATURES: MapFeature[] = [
  { id: 'echo', name: 'Echo Cave', kind: 'cave', note: 'A long gallery in the ridge. Every footstep comes back twice.', u: 0.285, v: 0.19 },
  { id: 'glowworm', name: 'Glowworm Grotto', kind: 'cave', note: 'Behind the spray of the falls; the ceiling glows blue-green at night.', u: 0.527, v: 0.212 },
  { id: 'throat', name: "Serpent's Throat", kind: 'cave', note: 'An old lava tube on the volcano. Warm air breathes out of it.', u: 0.735, v: 0.455 },
  { id: 'snare-w', name: "Aroha's snare line", kind: 'snare', note: 'Aroha’s old snares. She knows every loop; step where she steps.', u: 0.205, v: 0.47 },
  { id: 'snare-s', name: 'Old snare line', kind: 'snare', note: 'Rotten rope and hidden loops beside the delta track.', u: 0.445, v: 0.655 },
  { id: 'sinkhole', name: 'Sinkhole', kind: 'hazard', note: 'The forest floor has fallen into a limestone shaft.', u: SINK[0], v: SINK[1] },
  { id: 'quicksand', name: 'Quicksand', kind: 'hazard', note: 'Grey silt that looks solid until it isn’t.', u: QUICK[0], v: QUICK[1] },
  { id: 'mud', name: 'Boiling mud', kind: 'hazard', note: 'Hot springs and spitting mud pools on the volcano’s flank.', u: MUD[0], v: MUD[1] },
];

const LABELS: MapLabel[] = [
  { text: 'Ember Peak', u: 0.605, v: 0.47, lift: 0.02, size: 1 },
  { text: "Serpent's Spine", u: 0.4, v: 0.1, lift: 0.08, size: 0.95 },
  { text: 'Thunder River', u: 0.515, v: 0.56, lift: 0.01, size: 0.85 },
  { text: 'Castaway Cove', u: 0.05, v: 0.7, lift: 0, size: 0.85 },
  { text: 'Coral Reef', u: 0.955, v: 0.6, lift: 0, size: 0.85 },
];

// ------------------------------------------------------------------ height field

const ISLETS: [number, number, number][] = [[0.925, 0.79, 0.016], [0.075, 0.27, 0.012], [0.38, 0.945, 0.01], [0.13, 0.12, 0.009]];

/** Signed "inland" distance: > 0 on land, < 0 at sea, roughly in map units. */
function coast(u: number, v: number): number {
  const dx = u - 0.5, dy = v - 0.5;
  const a = Math.atan2(dy, dx);
  const d = Math.hypot(dx, dy);
  const R = 0.392 + 0.018 * Math.sin(2 * a + 0.6) + 0.014 * Math.sin(3 * a - 0.4) + 0.008 * Math.sin(5 * a + 2.1);
  let c = R - d;
  const east = smooth(0.72, 0.88, u);
  const beach = gauss(u, v, 0.1, 0.6, 0.07, 0.13);
  c += (fbm(u * 5.1, v * 5.1, 4, SEED + 1) - 0.5) * (0.075 + east * 0.02) * (1 - beach * 0.8);
  c += (fbm(u * 17, v * 17, 3, SEED + 2) - 0.5) * (0.018 + east * 0.03) * (1 - beach * 0.85);
  // delta lobe on the south coast, a gentle cove at camp, a bay on the south-east
  c += 0.05 * gauss(u, v, 0.555, 0.878, 0.085, 0.04);
  c -= 0.018 * gauss(u, v, 0.06, 0.63, 0.04, 0.07);
  c -= 0.04 * gauss(u, v, 0.76, 0.85, 0.06, 0.05);
  c += 0.02 * gauss(u, v, 0.86, 0.5, 0.03, 0.08);
  // the northern range pushes the coast north; capes, bays and a south-west peninsula
  c += 0.04 * gauss(u, v, 0.52, 0.07, 0.3, 0.06);
  c += 0.035 * gauss(u, v, 0.87, 0.18, 0.05, 0.035);
  c -= 0.045 * gauss(u, v, 0.17, 0.14, 0.06, 0.05);
  c += 0.03 * gauss(u, v, 0.2, 0.84, 0.05, 0.035);
  c -= 0.03 * gauss(u, v, 0.34, 0.91, 0.05, 0.03);
  c -= 0.025 * gauss(u, v, 0.08, 0.42, 0.03, 0.05);
  // offshore islets
  for (const [iu, iv, ir] of ISLETS) c = Math.max(c, ir - Math.hypot(u - iu, v - iv) + (fbm(u * 60, v * 60, 2, SEED + 14) - 0.5) * 0.01);
  return c;
}

interface Raw { h: number; c: number }

function rawHeight(u: number, v: number): Raw {
  const c = coast(u, v);
  const east = smooth(0.74, 0.86, u) * (1 - smooth(0.66, 0.78, v)) * smooth(0.2, 0.3, v);
  let h: number;
  if (c < 0) {
    // sea floor: a shallow turquoise shelf, then a drop-off into deep water
    const s = -c;
    const shelf = 0.03 + (fbm(u * 6, v * 6, 3, SEED + 3) - 0.5) * 0.035 + gauss(u, v, 0.55, 0.9, 0.12, 0.04) * 0.03 + east * 0.03;
    h = s < shelf ? -0.004 - s * 0.9 : -0.004 - shelf * 0.9 - (s - shelf) * 5.5;
    h = Math.max(h, -0.34 + (fbm(u * 9, v * 9, 2, SEED + 4) - 0.5) * 0.04);
    // barrier reef off the east coast
    const reef = east * Math.exp(-Math.pow((s - 0.042) / 0.008, 2));
    h -= east * 0.05 * Math.exp(-Math.pow((s - 0.022) / 0.009, 2));
    h = mix(h, -0.004, reef * 0.95);
  } else {
    const inland = smooth(0, 0.2, c);
    h = 0.012 + inland * 0.085 + (fbm(u * 7, v * 7, 4, SEED + 5) - 0.42) * 0.07 * inland;
    // flat beaches
    h = mix(0.014 + c * 0.35, h, smooth(0.01, 0.045, c));
    // rocky east coast: the land rises straight out of the sea
    h += east * 0.1 * smooth(0.0, 0.03, c) * (0.7 + fbm(u * 20, v * 20, 2, SEED + 6) * 0.6);
  }
  const landK = smooth(-0.02, 0.05, c);

  // northern range
  const dm = polyDist(u, v, RIDGE);
  const amp = smooth(0.06, 0.2, u) * (1 - smooth(0.84, 0.92, u));
  const rid = ridged(u * 8.5, v * 8.5, 5, SEED + 7);
  h += Math.exp(-(dm * dm) / (0.068 * 0.068)) * amp * (0.22 + 0.56 * rid) * landK;
  // foothills
  h += Math.exp(-(dm * dm) / (0.13 * 0.13)) * amp * 0.08 * fbm(u * 12, v * 12, 3, SEED + 8) * landK;

  // hanging shelf above the Thunder Falls escarpment
  const shelfK = smooth(0.43, 0.49, u) * (1 - smooth(0.68, 0.74, u)) * smooth(0.06, 0.1, v);
  const edge = smooth(escarp(u) + 0.004, escarp(u) - 0.005, v);
  const shelfH = 0.565 + (fbm(u * 14, v * 14, 3, SEED + 9) - 0.5) * 0.05;
  const sk = shelfK * edge * landK;
  if (shelfH > h) h = mix(h, shelfH, sk);

  // volcano with a crater and radial gullies
  const dv = Math.hypot(u - VOLC[0], v - VOLC[1]);
  const prof = (d: number) => 1.08 * Math.exp(-Math.pow(d / 0.112, 1.32));
  const rimR = 0.021;
  let cone: number;
  if (dv < rimR) cone = prof(rimR) - 0.16 * (1 - Math.pow(dv / rimR, 2)) * smooth(0, 0.004, rimR - dv) - 0.006;
  else cone = prof(dv);
  const ang = Math.atan2(v - VOLC[1], u - VOLC[0]);
  const gully = Math.pow(Math.abs(Math.sin(ang * 9 + fbm(u * 10, v * 10, 2, SEED + 10) * 5)), 3);
  cone *= 1 - 0.08 * gully * smooth(0.035, 0.09, dv) * (1 - smooth(0.14, 0.22, dv));
  h = Math.max(h, h * 0.4 + cone);

  // forested plateau (mesa) with gentle ramps to the south-west and north-east
  const dp = Math.hypot(u - PLAT[0], (v - PLAT[1]) * 1.12) * (1 + (fbm(u * 7, v * 7, 3, SEED + 11) - 0.5) * 0.4);
  const pa = Math.atan2(v - PLAT[1], u - PLAT[0]);
  const ramp = Math.max(Math.pow(Math.max(0, Math.cos(pa - 2.35)), 6), Math.pow(Math.max(0, Math.cos(pa + 0.9)), 8));
  const ew = mix(0.012, 0.075, ramp);
  const mesa = smooth(0.1 + ew * 0.5, 0.1 - ew * 0.5, dp);
  const top = 0.33 + (fbm(u * 11, v * 11, 3, SEED + 12) - 0.5) * 0.05;
  if (top > h) h = mix(h, top, mesa);

  // camp beach and the rocks the boat struck
  const campK = gauss(u, v, 0.138, 0.6, 0.045, 0.05);
  h = mix(h, Math.max(0.016, Math.min(h, 0.03)), campK * 0.9);
  const rock = gauss(u, v, WRECK[0], WRECK[1], 0.011, 0.008) + 0.6 * gauss(u, v, WRECK[0] - 0.012, WRECK[1] + 0.012, 0.006, 0.006);
  h = Math.max(h, mix(h, 0.02 + fbm(u * 90, v * 90, 2, SEED + 13) * 0.035, clamp(rock * 1.3)));

  // sinkhole and quicksand hollow
  h -= 0.05 * gauss(u, v, SINK[0], SINK[1], 0.006, 0.006);
  const q = gauss(u, v, QUICK[0], QUICK[1], 0.02, 0.013);
  h = mix(h, Math.min(h, 0.01), q);
  return { h, c };
}

// ------------------------------------------------------------------ rivers

interface Dense { pts: number[][] }

function buildRiver(ctrl: number[][], meander: number, seed: number, keepStraight?: (i: number, n: number) => number): Dense {
  const sp = spline(ctrl, 14);
  const rs = resample(sp, 0.0022);
  // meanders: offset perpendicular to the flow
  const n = rs.length;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = rs[Math.max(0, i - 1)], b = rs[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1];
    const L = Math.hypot(tx, ty) || 1;
    const nx = -ty / L, ny = tx / L;
    const end = Math.min(i, n - 1 - i) / 6;
    const k = Math.min(1, end) * (keepStraight ? keepStraight(i, n) : 1);
    const m = (fbm(i * 0.035, 0.5, 3, seed) - 0.5) * 2 * meander * k;
    out.push([rs[i][0] + nx * m, rs[i][1] + ny * m, ...rs[i].slice(2)]);
  }
  return { pts: out };
}

// ------------------------------------------------------------------ A* on the vertex grid

function astar(cost: Float32Array, n: number, start: number, goal: number, minCost: number): number[] | null {
  const N2 = n * n;
  const g = new Float32Array(N2).fill(Infinity);
  const came = new Int32Array(N2).fill(-1);
  const closed = new Uint8Array(N2);
  // binary heap
  let hn: number[] = [], hf: number[] = [];
  const push = (node: number, f: number) => {
    let i = hn.length;
    hn.push(node);
    hf.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= hf[i]) break;
      [hn[p], hn[i]] = [hn[i], hn[p]];
      [hf[p], hf[i]] = [hf[i], hf[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = hn[0];
    const ln = hn.pop()!, lf = hf.pop()!;
    if (hn.length) {
      hn[0] = ln;
      hf[0] = lf;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < hn.length && hf[l] < hf[m]) m = l;
        if (r < hn.length && hf[r] < hf[m]) m = r;
        if (m === i) break;
        [hn[m], hn[i]] = [hn[i], hn[m]];
        [hf[m], hf[i]] = [hf[i], hf[m]];
        i = m;
      }
    }
    return top;
  };
  const gx = goal % n, gy = (goal / n) | 0;
  const heur = (k: number) => Math.hypot((k % n) - gx, ((k / n) | 0) - gy) * minCost;
  g[start] = 0;
  push(start, heur(start));
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  while (hn.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const cx = cur % n, cy = (cur / n) | 0;
    for (let d = 0; d < 8; d++) {
      const x = cx + DX[d], y = cy + DY[d];
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const nb = y * n + x;
      if (closed[nb] || !isFinite(cost[nb])) continue;
      const ng = g[cur] + (d < 4 ? 1 : Math.SQRT2) * (cost[cur] + cost[nb]) * 0.5;
      if (ng < g[nb]) {
        g[nb] = ng;
        came[nb] = cur;
        push(nb, ng + heur(nb));
      }
    }
  }
  if (!closed[goal]) return null;
  const path: number[] = [];
  for (let k = goal; k !== -1; k = came[k]) path.push(k);
  hn = [];
  hf = [];
  return path.reverse();
}

// ------------------------------------------------------------------ palette

const hexRGB = (s: string): [number, number, number] => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const COL: Record<number, [number, number, number][]> = {
  [B_SEA]: [hexRGB('#c7b27a'), hexRGB('#8a9a86')],
  [B_SAND]: [hexRGB('#ecd79a'), hexRGB('#e2c985')],
  [B_WETSAND]: [hexRGB('#cdb679'), hexRGB('#c2aa6e')],
  [B_GRASS]: [hexRGB('#8fbd4c'), hexRGB('#7aac44')],
  [B_SCRUB]: [hexRGB('#7d9c48'), hexRGB('#6c8c40')],
  [B_FOREST]: [hexRGB('#2d5a31'), hexRGB('#28502d')],
  [B_CANOPY]: [hexRGB('#2a5530'), hexRGB('#244a2c')],
  [B_FERN]: [hexRGB('#35653a'), hexRGB('#2c5733')],
  [B_MANGROVE]: [hexRGB('#5d6a37'), hexRGB('#4f5c30')],
  [B_MUD]: [hexRGB('#7d7258'), hexRGB('#6e654e')],
  [B_ROCK]: [hexRGB('#8c8070'), hexRGB('#7a6f61')],
  [B_CLIFF]: [hexRGB('#74695b'), hexRGB('#665c50')],
  [B_ALPINE]: [hexRGB('#b3a262'), hexRGB('#9e9058')],
  [B_ASH]: [hexRGB('#6e5a4e'), hexRGB('#5e4d44')],
  [B_SNOW]: [hexRGB('#eeede8'), hexRGB('#d9d8d4')],
  [B_CRATER]: [hexRGB('#3a3131'), hexRGB('#2c2525')],
  [B_RIVER]: [hexRGB('#4c6a62'), hexRGB('#44605a')],
};
const TRAIL_COL = hexRGB('#b89c68');

// ------------------------------------------------------------------ build

export interface BuildOpts {
  /** World height of one height unit, relative to the map width. */
  hRel: number;
  /** Direction towards the sun in map axes (x east, y up, z south), normalized. */
  sun: [number, number, number];
}

let cache: { key: string; t: Terrain } | null = null;

export function buildTerrain(o: BuildOpts): Terrain {
  const key = o.hRel + ':' + o.sun.join(',');
  if (cache && cache.key === key) return cache.t;
  const n = VN, N2 = n * n;
  const h = new Float32Array(N2), cst = new Float32Array(N2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const r = rawHeight(i / GRID, j / GRID);
      h[j * n + i] = r.h;
      cst[j * n + i] = r.c;
    }

  // ---- rivers: dense polylines, stamped distance field, carving
  const falIdx = 3; // index of the lip control point in RIVER_MAIN
  const main = buildRiver(RIVER_MAIN, 0.009, SEED + 20, (i, cnt) => {
    const lipT = i / cnt;
    return smooth(0.02, 0.06, Math.abs(lipT - 0.2));
  });
  const branches = DELTA_BRANCHES.map((b, k) => buildRiver(b, 0.004, SEED + 30 + k));
  const creek = buildRiver(CREEK, 0.005, SEED + 40);
  const all = [main, ...branches, creek];
  const rd = new Float32Array(N2).fill(1), rb = new Float32Array(N2), rw = new Float32Array(N2), rsl = new Float32Array(N2);
  const RMAX = 0.075, rc = Math.ceil(RMAX * GRID);
  for (const r of all)
    for (const p of r.pts) {
      const ci = Math.round(p[0] * GRID), cj = Math.round(p[1] * GRID);
      for (let j = Math.max(0, cj - rc); j <= Math.min(GRID, cj + rc); j++)
        for (let i = Math.max(0, ci - rc); i <= Math.min(GRID, ci + rc); i++) {
          const d = Math.hypot(i / GRID - p[0], j / GRID - p[1]);
          const k = j * n + i;
          if (d < rd[k]) {
            rd[k] = d;
            rb[k] = p[2];
            rw[k] = p[3];
            rsl[k] = p[4];
          }
        }
    }
  for (let k = 0; k < N2; k++) {
    const d = rd[k];
    if (d >= RMAX) continue;
    const bed = rb[k], w = rw[k] + CELL * 0.85;
    const floor = bed > 0.008 ? Math.max(bed - 0.014, 0.002) : bed - 0.012;
    let target: number;
    if (d < w) target = floor;
    else {
      const e = d - w;
      target = bed + 0.004 + e * rsl[k] + e * e * 9;
    }
    h[k] = smin(h[k], target, 0.012);
  }
  // make the falls plunge pool a little basin
  const lipCtrl = RIVER_MAIN[falIdx], poolCtrl = RIVER_MAIN[falIdx + 1];

  const at = (i: number, j: number) => h[Math.max(0, Math.min(GRID, j)) * n + Math.max(0, Math.min(GRID, i))];
  const heightAt = (u: number, v: number) => {
    const x = clamp(u) * GRID, y = clamp(v) * GRID;
    const i = Math.min(GRID - 1, Math.floor(x)), j = Math.min(GRID - 1, Math.floor(y));
    const fx = x - i, fy = y - j;
    return mix(mix(at(i, j), at(i + 1, j), fx), mix(at(i, j + 1), at(i + 1, j + 1), fx), fy);
  };

  // ---- slope (world rise/run with the vertical scale)
  const slope = new Float32Array(N2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) * o.hRel / (2 * CELL);
      const dy = (at(i, j + 1) - at(i, j - 1)) * o.hRel / (2 * CELL);
      slope[j * n + i] = Math.hypot(dx, dy);
    }

  // ---- forest density
  const inDelta = (u: number, v: number) => gauss(u, v, 0.553, 0.855, 0.12, 0.06);
  const forest = new Float32Array(N2);
  const clear = (u: number, v: number) => {
    let c = 0;
    for (const id in SITE_POS) {
      const s = SITE_POS[id];
      c = Math.max(c, gauss(u, v, s[0], s[1], id === 'camp' ? 0.03 : 0.014, id === 'camp' ? 0.035 : 0.014));
    }
    return c;
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = i / GRID, v = j / GRID, k = j * n + i;
      const hh = h[k];
      let f = 0.22 + (fbm(u * 9, v * 9, 4, SEED + 50) - 0.5) * 1.2;
      f += 0.75 * gauss(u, v, 0.28, 0.51, 0.16, 0.12);
      f += 0.8 * smooth(0.26, 0.3, hh) * gauss(u, v, PLAT[0], PLAT[1], 0.11, 0.1);
      f += 0.4 * smooth(0.014, 0.024, rd[k]) * (1 - smooth(0.035, 0.07, rd[k])) * (1 - smooth(0.25, 0.4, hh));
      f -= 1.2 * (1 - smooth(rw[k] + 0.004, rw[k] + 0.011, rd[k]));
      f += 0.3 * smooth(0.1, 0.2, hh) * (1 - smooth(0.45, 0.55, hh));
      f += 0.35 * gauss(u, v, 0.78, 0.62, 0.08, 0.12);
      f -= 0.7 * smooth(0.5, 0.6, hh);
      f -= 0.6 * smooth(0.035, 0.012, cst[k]);
      f -= 1.0 * gauss(u, v, VOLC[0], VOLC[1], 0.1, 0.1);
      f -= 1.2 * clear(u, v);
      forest[k] = clamp(f);
    }

  // ---- biomes
  const biome = new Uint8Array(N2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = i / GRID, v = j / GRID, k = j * n + i;
      const hh = h[k], sl = slope[k], c = cst[k];
      const dv = Math.hypot(u - VOLC[0], v - VOLC[1]);
      const eastRock = smooth(0.76, 0.84, u) * (1 - smooth(0.66, 0.74, v)) * smooth(0.22, 0.3, v);
      const n1 = fbm(u * 30, v * 30, 2, SEED + 60);
      let b: number;
      if (hh < 0) b = B_SEA;
      else if (rd[k] < rw[k] + CELL * 0.3) b = B_RIVER;
      else if (dv < 0.019) b = B_CRATER;
      else if ((dv < 0.2 && hh > 0.84 + (n1 - 0.5) * 0.08) || (hh > 0.74 + (n1 - 0.5) * 0.06 && dv > 0.2)) b = B_SNOW;
      else if (sl > 1.9) b = B_CLIFF;
      else if (hh < 0.03 && inDelta(u, v) > 0.35) b = gauss(u, v, QUICK[0], QUICK[1], 0.02, 0.013) > 0.5 ? B_MUD : B_MANGROVE;
      else if (eastRock > 0.45 && c < 0.022 + (n1 - 0.5) * 0.016) b = sl > 0.9 ? B_CLIFF : B_ROCK;
      else if (hh < 0.028 && c < 0.04 && eastRock < 0.5 && sl < 0.5) b = hh < 0.012 ? B_WETSAND : B_SAND;
      else if (Math.hypot(u - WRECK[0], v - WRECK[1]) < 0.02 && hh < 0.05) b = B_ROCK;
      else if (sl > 1.15 || eastRock * smooth(0.0, 0.04, c) > 0.6 && sl > 0.5) b = B_ROCK;
      else if (dv < 0.2 && hh > 0.42 + (n1 - 0.5) * 0.1) b = B_ASH;
      else if (hh > 0.5) b = n1 > 0.62 ? B_ROCK : B_ALPINE;
      else if (forest[k] > 0.5) {
        if (hh > 0.27 && gauss(u, v, PLAT[0], PLAT[1], 0.12, 0.11) > 0.4) b = B_CANOPY;
        else if (gauss(u, v, 0.28, 0.51, 0.13, 0.1) > 0.5) b = B_FERN;
        else b = B_FOREST;
      } else if (gauss(u, v, MUD[0], MUD[1], 0.012, 0.01) > 0.45) b = B_MUD;
      else if (forest[k] > 0.3 || sl > 0.8) b = B_SCRUB;
      else b = B_GRASS;
      biome[k] = b;
    }

  // ---- sun visibility (soft cast shadows) on land and on the water surface
  const sun = new Float32Array(N2), seaSun = new Float32Array(N2);
  {
    const [sx, sy, sz] = o.sun;
    const horiz = Math.hypot(sx, sz);
    const ux = sx / horiz, uz = sz / horiz;
    const rise = (sy / horiz) / o.hRel; // height units per map unit
    const step = CELL * 0.6;
    const hmax = 1.05;
    const march = (u0: number, v0: number, h0: number) => {
      let vis = 1;
      for (let s = step; s < 0.5; s += step) {
        const u = u0 + ux * s, v = v0 + uz * s;
        if (u < 0 || v < 0 || u > 1 || v > 1) break;
        const ray = h0 + rise * s;
        if (ray > hmax) break;
        const th = heightAt(u, v);
        const k = (ray - th) / (s * rise * 0.35 + 0.004);
        if (k < vis) {
          vis = k;
          if (vis <= 0) return 0;
        }
      }
      return clamp(vis);
    };
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const u = i / GRID, v = j / GRID;
        sun[k] = march(u, v, Math.max(h[k], 0) + 0.003);
        seaSun[k] = h[k] < 0.01 ? march(u, v, 0.002) : 1;
      }
  }

  // ---- distance to shore (cells) over the water
  const shore = new Float32Array(N2).fill(1e9);
  {
    // two-pass chamfer distance transform
    for (let k = 0; k < N2; k++) if (h[k] >= 0) shore[k] = 0;
    const A = 1, D = Math.SQRT2;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        let d = shore[k];
        if (i > 0) d = Math.min(d, shore[k - 1] + A);
        if (j > 0) {
          d = Math.min(d, shore[k - n] + A);
          if (i > 0) d = Math.min(d, shore[k - n - 1] + D);
          if (i < n - 1) d = Math.min(d, shore[k - n + 1] + D);
        }
        shore[k] = d;
      }
    for (let j = n - 1; j >= 0; j--)
      for (let i = n - 1; i >= 0; i--) {
        const k = j * n + i;
        let d = shore[k];
        if (i < n - 1) d = Math.min(d, shore[k + 1] + A);
        if (j < n - 1) {
          d = Math.min(d, shore[k + n] + A);
          if (i < n - 1) d = Math.min(d, shore[k + n + 1] + D);
          if (i > 0) d = Math.min(d, shore[k + n - 1] + D);
        }
        shore[k] = d;
      }
  }

  // ---- trails: A* between sites over a walking-cost field
  const walk = new Float32Array(N2);
  for (let k = 0; k < N2; k++) {
    const hh = h[k], b = biome[k], sl = slope[k];
    if (hh < 0.004 && b !== B_RIVER) { walk[k] = Infinity; continue; }
    if (sl > 1.35) { walk[k] = Infinity; continue; }
    let c = 1 + 3.2 * sl * sl;
    if (b === B_RIVER) c += 7;
    else if (b === B_FOREST || b === B_CANOPY || b === B_FERN) c += 0.5;
    else if (b === B_MANGROVE || b === B_MUD) c += 1.2;
    else if (b === B_SNOW || b === B_ASH || b === B_CRATER) c += 2.5;
    else if (b === B_ROCK || b === B_ALPINE) c += 0.8;
    walk[k] = c;
  }
  const toIdx = (p: P2) => {
    let best = -1, bd = 1e9;
    const ci = Math.round(clamp(p[0]) * GRID), cj = Math.round(clamp(p[1]) * GRID);
    for (let r = 0; r <= 12 && best < 0; r++)
      for (let j = cj - r; j <= cj + r; j++)
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || j < 0 || i > GRID || j > GRID) continue;
          const k = j * n + i;
          if (!isFinite(walk[k])) continue;
          const d = Math.hypot(i - ci, j - cj);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
    return best < 0 ? cj * n + ci : best;
  };
  const pathFor = (a: P2, b: P2): P2[] => {
    const s = toIdx(a), g = toIdx(b);
    const idx = astar(walk, n, s, g, 0.45);
    let pts: P2[];
    if (!idx) pts = [a, b];
    else {
      pts = idx.map(k => [(k % n) / GRID, ((k / n) | 0) / GRID] as P2);
      // thin out the staircase before smoothing
      const thin: P2[] = [pts[0]];
      for (let i = 2; i < pts.length; i += 2) thin.push(pts[i]);
      thin.push(pts[pts.length - 1]);
      pts = [a, ...thin.slice(1, -1), b];
    }
    pts = chaikin(pts, 3);
    return resample(pts, 0.003) as P2[];
  };
  const EDGES: [string, string][] = [
    ['camp', 'fernwood'], ['fernwood', 'canopy'], ['canopy', 'falls'], ['fernwood', 'mangrove'], ['mangrove', 'coast'], ['falls', 'coast'],
  ];
  const trails: P2[][] = [];
  const trailD = new Float32Array(N2).fill(1);
  const stampTrail = (line: P2[]) => {
    const R = 0.012, rcx = Math.ceil(R * GRID);
    for (const p of line) {
      const ci = Math.round(p[0] * GRID), cj = Math.round(p[1] * GRID);
      for (let j = Math.max(0, cj - rcx); j <= Math.min(GRID, cj + rcx); j++)
        for (let i = Math.max(0, ci - rcx); i <= Math.min(GRID, ci + rcx); i++) {
          const k = j * n + i;
          const d = Math.hypot(i / GRID - p[0], j / GRID - p[1]);
          if (d < trailD[k]) trailD[k] = d;
        }
    }
  };
  for (const [a, b] of EDGES) {
    const line = pathFor(SITE_POS[a], SITE_POS[b]);
    trails.push(line);
    stampTrail(line);
    // later paths (and travel routes) prefer existing trails
    for (let k = 0; k < N2; k++) if (trailD[k] < CELL * 1.2 && isFinite(walk[k])) walk[k] = Math.min(walk[k], 0.45 + (walk[k] - 1) * 0.3);
  }

  // ---- vertex colours
  const color = new Uint8Array(N2 * 3);
  const contour = new Uint8Array(N2);
  const lava = new Uint8Array(N2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = i / GRID, v = j / GRID, k = j * n + i;
      const b = biome[k];
      const pal = COL[b];
      const nz = fbm(u * 38, v * 38, 2, SEED + 70);
      let [r, g, bl] = nz > 0.55 ? pal[1] : pal[0];
      const var1 = 1 + (fbm(u * 13, v * 13, 3, SEED + 71) - 0.5) * 0.16;
      r *= var1; g *= var1; bl *= var1;
      // snow line blends through grey scree; beaches get a wet edge
      if (b === B_ALPINE || b === B_ROCK) {
        const t = smooth(0.62, 0.76, h[k]) * 0.5;
        r = mix(r, 205, t); g = mix(g, 200, t); bl = mix(bl, 192, t);
      }
      if (b === B_ASH || b === B_SNOW) {
        const dv = Math.hypot(u - VOLC[0], v - VOLC[1]);
        const a = Math.atan2(v - VOLC[1], u - VOLC[0]);
        const flow = Math.max(Math.exp(-Math.pow((a - 1.25 + Math.sin(dv * 60) * 0.08) / 0.07, 2)), Math.exp(-Math.pow((a + 0.2 + Math.sin(dv * 50) * 0.1) / 0.06, 2)));
        const t = b === B_ASH ? smooth(0.5, 0.8, h[k]) : 0;
        r = mix(r, 160, t * 0.45); g = mix(g, 112, t * 0.45); bl = mix(bl, 92, t * 0.45);
        if (flow > 0.4 && dv > 0.03) { r = mix(r, 52, 0.75); g = mix(g, 44, 0.75); bl = mix(bl, 46, 0.75); }
      }
      // canopy darkens the ground under forests
      if (forest[k] > 0.35 && (b === B_GRASS || b === B_SCRUB)) {
        const t = smooth(0.35, 0.5, forest[k]) * 0.5;
        r = mix(r, 50, t); g = mix(g, 92, t); bl = mix(bl, 52, t);
      }
      // gravel and reed banks along the rivers
      if (rd[k] < rw[k] + 0.008 && b !== B_RIVER && h[k] > 0.004) {
        const t = (1 - smooth(rw[k] + 0.003, rw[k] + 0.008, rd[k])) * 0.65;
        r = mix(r, 168, t); g = mix(g, 166, t); bl = mix(bl, 112, t);
      }
      // trails: bare dirt
      const td = trailD[k];
      if (td < 0.0045 && h[k] > 0.004 && b !== B_RIVER) {
        const t = (1 - smooth(0.0025, 0.0045, td)) * 0.8;
        r = mix(r, TRAIL_COL[0], t); g = mix(g, TRAIL_COL[1], t); bl = mix(bl, TRAIL_COL[2], t);
      }
      color[k * 3] = clamp(r, 0, 255);
      color[k * 3 + 1] = clamp(g, 0, 255);
      color[k * 3 + 2] = clamp(bl, 0, 255);
      contour[k] = h[k] > 0.02 && b !== B_RIVER ? 255 : 0;
      const dv = Math.hypot(u - VOLC[0], v - VOLC[1]);
      lava[k] = dv < 0.013 ? Math.round(clamp(1 - dv / 0.013) * 255 * (0.55 + 0.45 * fbm(u * 200, v * 200, 2, SEED + 72))) : 0;
      if (gauss(u, v, MUD[0], MUD[1], 0.007, 0.006) > 0.5) lava[k] = Math.max(lava[k], 40);
    }

  // ---- sea info texture
  const sea = new Uint8Array(N2 * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = i / GRID, v = j / GRID, k = j * n + i;
      const east = smooth(0.74, 0.86, u) * (1 - smooth(0.66, 0.78, v)) * smooth(0.2, 0.3, v);
      const s = -cst[k];
      const reef = h[k] < 0 ? east * Math.exp(-Math.pow((s - 0.042) / 0.01, 2)) : 0;
      sea[k * 4] = Math.round(clamp(-h[k] / 0.34) * 255);
      sea[k * 4 + 1] = Math.round(clamp(reef * 1.2) * 255);
      sea[k * 4 + 2] = Math.round(clamp(shore[k] / 40) * 255);
      sea[k * 4 + 3] = Math.round(seaSun[k] * 255);
    }

  // ---- trees
  const treeArr: number[] = [];
  {
    const R = rng(SEED + 80);
    const SP = 0.0042;
    const cnt = Math.floor(1 / SP);
    for (let gj = 0; gj < cnt; gj++)
      for (let gi = 0; gi < cnt; gi++) {
        const u = (gi + 0.5 + (R() - 0.5) * 0.9) * SP, v = (gj + 0.5 + (R() - 0.5) * 0.9) * SP;
        const r1 = R(), r2 = R(), r3 = R();
        const i = Math.round(u * GRID), j = Math.round(v * GRID);
        const k = j * n + i;
        const b = biome[k];
        const hh = heightAt(u, v);
        if (hh < 0.006 || trailD[k] < 0.0088) continue;
        if (rd[k] < rw[k] + CELL * 1.3) continue;
        const sl = slope[k];
        if (sl > 1.2) continue;
        const f = forest[k];
        let type = -1, size = 0;
        if (b === B_FOREST || b === B_FERN || b === B_CANOPY) {
          if (r1 < 0.2 + f * 0.8) {
            if (b === B_CANOPY) { type = r2 < 0.14 ? T_KAURI : T_BROAD; }
            else if (b === B_FERN) { type = r2 < 0.38 ? T_FERN : T_BROAD; }
            else type = hh > 0.3 && r2 < smooth(0.3, 0.45, hh) ? T_CONIFER : T_BROAD;
          }
        } else if (b === B_MANGROVE) {
          if (r1 < 0.75) type = T_MANGROVE;
        } else if (b === B_SCRUB) {
          if (r1 < 0.2) type = hh > 0.3 ? T_CONIFER : T_BROAD;
        } else if (b === B_GRASS) {
          if (r1 < 0.05) type = T_BROAD;
        } else if (b === B_ALPINE) {
          if (r1 < 0.08 && hh < 0.58) type = T_CONIFER;
        } else if (b === B_SAND) {
          const campNear = gauss(u, v, 0.12, 0.6, 0.06, 0.12);
          if (cst[k] > 0.012 && r1 < 0.05 + campNear * 0.25) type = T_PALM;
        } else if (b === B_ASH) {
          if (r1 < 0.02 && hh < 0.45) type = T_CONIFER;
        }
        if (type < 0) continue;
        if (clear(u, v) > 0.45) continue;
        switch (type) {
          case T_BROAD: size = 0.0105 + r3 * 0.0055; break;
          case T_KAURI: size = 0.0175 + r3 * 0.005; break;
          case T_CONIFER: size = 0.0095 + r3 * 0.0045; break;
          case T_PALM: size = 0.0095 + r3 * 0.0025; break;
          case T_FERN: size = 0.0075 + r3 * 0.003; break;
          case T_MANGROVE: size = 0.007 + r3 * 0.003; break;
        }
        const sv = Math.max(0.25, bilinear(sun, u, v));
        let tint = Math.floor(R() * 4);
        // pōhutukawa: red-flowering trees on the coastal fringe
        if (type === T_BROAD && cst[k] < 0.06 && hh < 0.2 && R() < 0.14) tint = 4;
        treeArr.push(u, v, hh, size, type, R(), sv, tint);
      }
  }
  const trees = new Float32Array(treeArr);

  function bilinear(arr: Float32Array, u: number, v: number) {
    const x = clamp(u) * GRID, y = clamp(v) * GRID;
    const i = Math.min(GRID - 1, Math.floor(x)), j = Math.min(GRID - 1, Math.floor(y));
    const fx = x - i, fy = y - j;
    const A = arr[j * n + i], B = arr[j * n + i + 1], C = arr[(j + 1) * n + i], D = arr[(j + 1) * n + i + 1];
    return mix(mix(A, B, fx), mix(C, D, fx), fy);
  }

  // ---- river lines for the renderer (water surface slightly above the carved bed)
  const lipI = main.pts.findIndex(p => p[1] >= lipCtrl[1]);
  const poolI = main.pts.findIndex(p => p[1] >= poolCtrl[1] - 0.004);
  const pack = (pts: number[][]): RiverLine => {
    const arr = new Float32Array(pts.length * 5);
    let along = 0;
    pts.forEach((p, i) => {
      if (i > 0) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      arr.set([p[0], p[1], p[2], p[3] * 1.3, along], i * 5);
    });
    return { pts: arr, count: pts.length };
  };
  const rivers: RiverLine[] = [];
  if (lipI > 1) rivers.push(pack(main.pts.slice(0, lipI)));
  if (poolI > 0) rivers.push(pack(main.pts.slice(poolI)));
  for (const b of branches) rivers.push(pack(b.pts.slice(3)));
  rivers.push(pack(creek.pts));
  const lipP = main.pts[Math.max(0, lipI - 1)], poolP = main.pts[Math.min(main.pts.length - 1, poolI)];
  const falls = {
    lip: [lipP[0], lipP[1], lipP[2]] as [number, number, number],
    pool: [poolP[0], poolP[1], poolP[2]] as [number, number, number],
    half: 0.0072,
  };

  // ---- caves snap to the steepest nearby slope that faces south (towards the default camera)
  const features = FEATURES.map(f => ({ ...f }));
  for (const f of features) {
    if (f.kind !== 'cave') continue;
    let best = -1, bu = f.u, bv = f.v;
    const ci = Math.round(f.u * GRID), cj = Math.round(f.v * GRID);
    for (let j = cj - 5; j <= cj + 5; j++)
      for (let i = ci - 5; i <= ci + 5; i++) {
        if (i < 1 || j < 1 || i >= GRID || j >= GRID) continue;
        const k = j * n + i;
        if (h[k] < 0.05 || rd[k] < rw[k] + CELL * 2) continue;
        const facing = at(i, j - 1) - at(i, j + 1); // > 0 when the slope faces south
        const score = slope[k] * (facing > 0 ? 1 : 0.3) - Math.hypot(i - ci, j - cj) * 0.08;
        if (score > best) {
          best = score;
          bu = i / GRID;
          bv = j / GRID;
        }
      }
    f.u = bu;
    f.v = bv;
  }

  const hazardsNear = (line: P2[], r = 0.02) =>
    features.filter(f => f.kind !== 'cave' && line.some(p => Math.hypot(p[0] - f.u, p[1] - f.v) < r));

  const routeCache = new Map<string, P2[]>();
  const route = (a: P2, b: P2) => {
    const key = a.map(x => x.toFixed(4)).join(',') + '>' + b.map(x => x.toFixed(4)).join(',');
    let r = routeCache.get(key);
    if (!r) {
      r = pathFor(a, b);
      routeCache.set(key, r);
    }
    return r;
  };

  const c0 = SITE_POS.camp;
  const t: Terrain = {
    h, biome, color, sun, contour, lava, sea, rivers, falls, trees, treeCount: trees.length / TREE_STRIDE, trails,
    features, labels: LABELS, sites: SITE_POS,
    camp: {
      tents: [[c0[0] + 0.02, c0[1] - 0.012, 0.6, 0], [c0[0] + 0.034, c0[1] - 0.004, -0.4, 1], [c0[0] + 0.023, c0[1] + 0.008, 1.3, 2]],
      fire: [c0[0] + 0.025, c0[1] - 0.001], wreck: WRECK,
    },
    volcano: VOLC, mudPools: MUD,
    heightAt, sunAt: (u, v) => bilinear(sun, u, v), route, hazardsNear,
  };
  cache = { key, t };
  return t;
}

/** Top-down hill-shaded pixel image of the terrain (RGBA, size x size) for the 2D fallback map. */
export function paintTopDown(t: Terrain, size: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(size * size * 4);
  const n = VN;
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const i = Math.min(GRID, Math.round(u * GRID)), j = Math.min(GRID, Math.round(v * GRID));
      const k = j * n + i;
      const hh = t.heightAt(u, v);
      const d = (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      let r: number, g: number, b: number;
      if (hh < 0) {
        const depth = t.sea[k * 4] / 255, shore = t.sea[k * 4 + 2] / 255;
        const lv = depth * 5.5 + (d - 0.5) * 0.8;
        const ramp = [[122, 222, 204], [84, 196, 186], [52, 158, 168], [36, 118, 146], [28, 86, 122], [22, 66, 104]];
        const c = ramp[Math.max(0, Math.min(5, Math.floor(lv)))];
        [r, g, b] = c;
        if (shore < 0.03) [r, g, b] = [232, 244, 228];
      } else {
        r = t.color[k * 3];
        g = t.color[k * 3 + 1];
        b = t.color[k * 3 + 2];
        const e = 1 / size;
        const sx = (t.heightAt(u + e, v) - t.heightAt(u - e, v)) * 60;
        const sy = (t.heightAt(u, v + e) - t.heightAt(u, v - e)) * 60;
        let l = 0.78 + (-sx - sy) * 0.9;
        l *= 0.7 + 0.3 * t.sunAt(u, v);
        l = Math.floor(l * 4 + d) / 4;
        l = Math.max(0.45, Math.min(1.25, l));
        r *= l; g *= l; b *= l;
        if (t.biome[k] === B_RIVER) [r, g, b] = [72, 140, 176];
      }
      const o = (y * size + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  // trees as dark specks
  for (let q = 0; q < t.treeCount; q++) {
    const u = t.trees[q * TREE_STRIDE], v = t.trees[q * TREE_STRIDE + 1];
    const x = Math.floor(u * size), y = Math.floor(v * size);
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    const o = (y * size + x) * 4;
    const type = t.trees[q * TREE_STRIDE + 4];
    const k = type === T_MANGROVE ? 0.72 : type === T_PALM ? 0.85 : 0.62;
    out[o] *= k;
    out[o + 1] *= k * 1.04;
    out[o + 2] *= k;
  }
  return out;
}

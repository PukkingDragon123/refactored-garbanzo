// V10 Region Map painter: the island as a detailed pixel-art overworld map (shaded mountain ranges,
// a vast forest of individually painted trees, rocky hills with tors and scree, mangroves, the
// glowing valley, the hot valley, the sinkhole, rivers and waterfalls, beaches and sea cliffs, the
// village, the camp, the pā, the wreck, a dark sea with reefs and kelp), plus two companions that
// share its geometry exactly:
//   paper  aged parchment with Joshu's old chart traced on it (a faint coastline, rhumb lines, a
//          compass rose, a cartouche, a sea serpent): what an unexplored place looks like
//   ink    the pen sketch of the painted map (outlines and hatching): a place glimpsed but not yet
//          walked, and the first stage of the reveal (sketched ink, then the colour washes in)
// Everything is generated at runtime, once per session, in time slices (paintMap() never blocks a
// frame for long). The painted land is assembled from sprites stamped back to front: each stamp
// also writes the sketch's outline mask and tags pixels the live map animates (canopy highlights
// that sway in a gust, glowing fungi, rivers, falls). regionmap-fx.ts composes and animates it.

import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix, rgba, R, G, B as BL, A } from '../../art/color';
import { fbm2, noise2, hash2, bayer, clamp, Rng } from '../../core/math';
import { MAP_W, MAP_H, COAST, ISLETS, RIVERS } from '../../game/v10/atlas';
import { B, BIOME_N, SHAPES, HEIGHTS, CLIFFS, RIDGES, LM, WALLOWS, POOLS } from './mapgeo';
import type { Shape } from './mapgeo';

export const W = MAP_W, H = MAP_H;
export const INK = hex('#3a2614'), INK2 = hex('#5e4026'), INK3 = hex('#8a6c48'), INK_RED = hex('#a8382a'), INK_BLUE = hex('#2e5a78');

/** pixel tags: what the live map animates */
export const TAG = { gust: 1, glow: 2, crown: 3, lava: 4 } as const;
/** water kinds */
export const WK = { none: 0, sea: 1, river: 2, lake: 3, channel: 4, pool: 5, fall: 6 } as const;

export interface MapArt {
  /** parchment (alpha 0 off the torn sheet) */
  paper: Uint32Array;
  /** the painted map */
  color: Uint32Array;
  /** the pen sketch (alpha 0: no ink) */
  ink: Uint32Array;
  land: Uint8Array;
  /** distance to the coast (either side) */
  coast: Float32Array;
  biome: Uint8Array;
  water: Uint8Array;
  /** flow phase along rivers (0..255, repeating) */
  flow: Uint8Array;
  tag: Uint32Array | Uint8Array;
  /** 0..1 how sheltered / deep inside its biome a pixel is */
  depth: Float32Array;
}

// ------------------------------------------------------------------ helpers
const hx = hex;
const lumOf = (c: C) => (R(c) * 0.299 + G(c) * 0.587 + BL(c) * 0.114) / 255;
const pick = (ramp: C[], t: number) => ramp[clamp(Math.round(t * (ramp.length - 1)), 0, ramp.length - 1)];
const dith = (x: number, y: number, ramp: C[], t: number) => ramp[clamp(Math.floor(t * (ramp.length - 1) + bayer(x, y)), 0, ramp.length - 1)];
const darken = (c: C, k: number) => rgba(R(c) * k, G(c) * k, BL(c) * k, A(c));

let tSlice = 0;
/** yield to the browser when this slice has run long enough */
async function slice() {
  if (performance.now() - tSlice < 10) return;
  await new Promise<void>(r => setTimeout(r, 0));
  tSlice = performance.now();
}

// ------------------------------------------------------------------ palettes
const PAL = {
  con: [hx('#0b1b12'), hx('#102618'), hx('#16321f'), hx('#1e4027'), hx('#2a5332'), hx('#3a6a3e'), hx('#52844c')],
  brd: [hx('#0f2318'), hx('#15301e'), hx('#1d4026'), hx('#285230'), hx('#36663a'), hx('#4a7e46'), hx('#669a54')],
  fern: [hx('#132c18'), hx('#1c3e1e'), hx('#285426'), hx('#386c2e'), hx('#4c8438'), hx('#669e44'), hx('#88ba58')],
  kauri: [hx('#0d241e'), hx('#133226'), hx('#1b4230'), hx('#26543a'), hx('#336846'), hx('#468054'), hx('#629c66')],
  beech: [hx('#21381a'), hx('#2c4a20'), hx('#395c26'), hx('#48702e'), hx('#5a8638'), hx('#729e44'), hx('#8eb656')],
  mang: [hx('#132618'), hx('#1c3620'), hx('#284828'), hx('#365a30'), hx('#466e3a'), hx('#5c8646')],
  glowc: [hx('#05121a'), hx('#091c26'), hx('#0e2832'), hx('#153642'), hx('#1e4854'), hx('#2a5e68')],
  pohu: [hx('#11241a'), hx('#183320'), hx('#224428'), hx('#2e5630'), hx('#3e6a3a')],
  red: [hx('#8a1e18'), hx('#b02c20'), hx('#d4442c'), hx('#ec6a3e')],
  palm: [hx('#163418'), hx('#224c24'), hx('#32682e'), hx('#4a863a'), hx('#68a24a')],
  trunk: [hx('#1e140c'), hx('#322214'), hx('#4a321e'), hx('#62482c')],
  bark: [hx('#4a443c'), hx('#686056'), hx('#888070'), hx('#a8a08c')],
  rock: [hx('#272523'), hx('#3a3734'), hx('#504c47'), hx('#68635b'), hx('#827c72'), hx('#9e978a'), hx('#bcb5a6')],
  granite: [hx('#34322e'), hx('#4a4842'), hx('#615e56'), hx('#7b776c'), hx('#979285'), hx('#b4af9f'), hx('#d2cdbb')],
  basalt: [hx('#161414'), hx('#221f1e'), hx('#302b29'), hx('#433c38'), hx('#58504a')],
  snowL: [hx('#c6d2de'), hx('#dfe7ef'), hx('#f2f6f9'), hx('#ffffff')],
  snowD: [hx('#7f8ea4'), hx('#96a6ba'), hx('#adbccd')],
  mtnL: [hx('#5c5852'), hx('#77726a'), hx('#938d82'), hx('#ada699'), hx('#c4bdae')],
  mtnD: [hx('#26262e'), hx('#32323b'), hx('#3f3f49'), hx('#4d4c55')],
  tuss: [hx('#5e5430'), hx('#766a38'), hx('#8e8042'), hx('#a6964e'), hx('#bcab5e'), hx('#d0c074')],
  thatch: [hx('#4e3418'), hx('#6c4a22'), hx('#8c642e'), hx('#ac7e3c'), hx('#c8984e')],
  roof: [hx('#5a1c14'), hx('#7a2a1a'), hx('#9a3a22'), hx('#b84e2c')],
  wood: [hx('#20140a'), hx('#352212'), hx('#4e341c'), hx('#6c4c2a'), hx('#8a6638')],
  canvas: [hx('#8a8476'), hx('#aea898'), hx('#d2ccbc'), hx('#eeeadc'), hx('#fbf8ee')],
  bone: [hx('#7c6e58'), hx('#a49678'), hx('#cabd9e'), hx('#ece2c6')],
  mud: [hx('#261d13'), hx('#35291b'), hx('#463624'), hx('#58472f'), hx('#6a5839')],
  mush: [hx('#2e1c44'), hx('#452c62'), hx('#5e4282'), hx('#7c5ea4'), hx('#9c80c2')],
  mush2: [hx('#0e3236'), hx('#164a4c'), hx('#206464'), hx('#2e807c'), hx('#46a098')],
  strata: [hx('#7a3c28'), hx('#9c5634'), hx('#b87444'), hx('#cc935c'), hx('#dcb07a'), hx('#e8c896'), hx('#a0663c'), hx('#8a4a30')],
  silica: [hx('#bcb4a0'), hx('#d8d2c0'), hx('#ece8da'), hx('#fbf9f0')],
  sulphur: [hx('#a89a2a'), hx('#c8b836'), hx('#e2d24a'), hx('#f2e670')],
  hot: [hx('#1e7a84'), hx('#2a9aa0'), hx('#3cb8b4'), hx('#62d2c8'), hx('#9ae8dc')],
  orange: [hx('#8a3a18'), hx('#b0541e'), hx('#cc7428'), hx('#e09a3a')],
  reed: [hx('#4a4a24'), hx('#66642e'), hx('#86803c'), hx('#a49a4c')],
};
const GROUND: C[][] = [];
GROUND[B.sea] = [hx('#152c40')];
GROUND[B.meadow] = [hx('#355f27'), hx('#3e6b2d'), hx('#487734'), hx('#52833a'), hx('#5e8f40'), hx('#6c9b47'), hx('#7ca850')];
GROUND[B.forest] = [hx('#0c1d14'), hx('#112619'), hx('#16301e'), hx('#1b3923'), hx('#214328')];
GROUND[B.fern] = [hx('#102818'), hx('#16321c'), hx('#1c3e22'), hx('#244a28'), hx('#2c562c')];
GROUND[B.canopy] = [hx('#0b2019'), hx('#102a1f'), hx('#153426'), hx('#1b3e2c'), hx('#214832')];
GROUND[B.beech] = [hx('#1d3218'), hx('#253d1d'), hx('#2e4a22'), hx('#385628'), hx('#42622e')];
GROUND[B.swamp] = [hx('#262a1c'), hx('#2e3322'), hx('#373c28'), hx('#41462e'), hx('#4b5034')];
GROUND[B.garden] = [hx('#4f7030'), hx('#5c7e36'), hx('#698c3c'), hx('#789a44'), hx('#88a84c')];
GROUND[B.terraces] = [hx('#40642c'), hx('#4a7032'), hx('#567c38'), hx('#628840'), hx('#6e9448')];
GROUND[B.hills] = [hx('#5e5e34'), hx('#706c3a'), hx('#827c42'), hx('#948c4c'), hx('#a69c56'), hx('#b8ac62'), hx('#c8bc70')];
GROUND[B.mountain] = [hx('#43443e'), hx('#505148'), hx('#5e5e54'), hx('#6c6a5e'), hx('#7a7668'), hx('#888272')];
GROUND[B.gorge] = PAL.strata;
GROUND[B.glow] = [hx('#050f14'), hx('#08161c'), hx('#0b1d24'), hx('#0f252c'), hx('#132d34')];
GROUND[B.thermal] = [hx('#7e5830'), hx('#966c3a'), hx('#ac8046'), hx('#c09452'), hx('#d2aa64'), hx('#e0c07c'), hx('#ead29a')];
GROUND[B.sink] = [hx('#16301c'), hx('#1c3a22'), hx('#224428'), hx('#2a4e2e')];
GROUND[B.plain] = [hx('#4d6e30'), hx('#5a7a36'), hx('#68863c'), hx('#769244'), hx('#869e4e'), hx('#96aa58')];
GROUND[B.scrub] = [hx('#2f4c24'), hx('#38582a'), hx('#426430'), hx('#4c7036'), hx('#567c3c')];
GROUND[B.dunes] = [hx('#ad9764'), hx('#bea872'), hx('#ccb780'), hx('#d8c48e'), hx('#e2d09e')];
GROUND[B.beach] = [hx('#bc9e68'), hx('#c9ad76'), hx('#d6bc86'), hx('#e2ca96'), hx('#ecd6a6'), hx('#f4e2b8')];
GROUND[B.rock] = [hx('#34302c'), hx('#433e38'), hx('#544d45'), hx('#665e54'), hx('#7a7064')];
const SEA = {
  deep: [hx('#0e1e2e'), hx('#112334'), hx('#14283a'), hx('#172e41'), hx('#1a3347')],
  mid: [hx('#183650'), hx('#1c3d58'), hx('#20445f'), hx('#244b66')],
  shal: [hx('#25556a'), hx('#2a6072'), hx('#306b7a'), hx('#377682')],
  lagoon: [hx('#348084'), hx('#3e8e8c'), hx('#4a9c94'), hx('#5aaa9c'), hx('#6eb8a4')],
  murk: [hx('#24362c'), hx('#2c4032'), hx('#344a38'), hx('#3c543e')],
  foam: [hx('#b8d0cc'), hx('#d6e6e2'), hx('#f0f6f2')],
  wave: hx('#2c5a74'), wave2: hx('#3a6e86'),
  abyss: [hx('#0a1624'), hx('#0c1a2a'), hx('#0f1f30')],
  reef: [hx('#3ea89c'), hx('#52b8a6'), hx('#6ccab2'), hx('#8adcc0')],
};
const RIVER = [hx('#1d4258'), hx('#26536c'), hx('#306480'), hx('#3e7894'), hx('#5592ac'), hx('#78b0c6')];
const PAPER = [hx('#c4a670'), hx('#d0b47e'), hx('#dbc18e'), hx('#e5cd9d'), hx('#eed8ac'), hx('#f5e3bc')];
const PAPER_SEA = [hx('#b8ae8a'), hx('#c4b994'), hx('#cfc39f'), hx('#d9cdab')];

// ------------------------------------------------------------------ the sprite stamp
/** a little sprite painted in local coordinates, anchored at (ax, ay) = where it stands */
class Spr {
  readonly b: PixelBuffer;
  readonly t: Uint8Array;
  constructor(w: number, h: number, readonly ax: number, readonly ay: number) {
    this.b = new PixelBuffer(w, h);
    this.t = new Uint8Array(this.b.w * this.b.h);
  }
  set(x: number, y: number, c: C, tag = 0) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.b.w || y >= this.b.h) return;
    const i = y * this.b.w + x;
    this.b.data[i] = c;
    this.t[i] = tag;
  }
  has(x: number, y: number) { return x >= 0 && y >= 0 && x < this.b.w && y < this.b.h && (this.b.data[y * this.b.w + x] >>> 24) > 0; }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.b.w && y < this.b.h ? this.b.data[y * this.b.w + x] : 0; }
}

interface Ctx {
  col: Uint32Array; edge: Uint8Array; tag: Uint8Array; land: Uint8Array; cd: Float32Array; bio: Uint8Array; bw: Float32Array;
  elev: Float32Array; water: Uint8Array; flow: Uint8Array; nA: Float32Array; nB: Float32Array; occ: Uint8Array;
}

/** paint a sprite into the map: colour, the sketch's outline (its silhouette), animation tags */
function stamp(cx: Ctx, s: Spr, x: number, y: number, o: { ink?: number; noEdge?: boolean; occ?: number } = {}) {
  const ox = Math.round(x) - s.ax, oy = Math.round(y) - s.ay;
  const bw = s.b.w, bh = s.b.h, d = s.b.data;
  const ink = o.ink ?? 1;
  for (let ly = 0; ly < bh; ly++) {
    const gy = oy + ly;
    if (gy < 0 || gy >= H) continue;
    for (let lx = 0; lx < bw; lx++) {
      const c = d[ly * bw + lx];
      const a = c >>> 24;
      if (!a) continue;
      const gx = ox + lx;
      if (gx < 0 || gx >= W) continue;
      const g = gy * W + gx;
      cx.col[g] = a >= 250 ? c : mix(cx.col[g], c | 0xff000000, a / 255);
      if (a >= 200) {
        // trees sketch only the bumpy top of their crowns (a pen forest); everything else its silhouette
        const edge = !o.noEdge && (ink === 3 ? !s.has(lx, ly - 1) || (!s.has(lx - 1, ly) && ly < bh * 0.6) : !s.has(lx - 1, ly) || !s.has(lx + 1, ly) || !s.has(lx, ly - 1) || !s.has(lx, ly + 1));
        cx.edge[g] = edge ? ink : 0;
        cx.tag[g] = s.t[ly * bw + lx];
        if (o.occ) cx.occ[g] = o.occ;
      }
    }
  }
}

// ------------------------------------------------------------------ geometry: land, coast, biomes
let landM: Uint8Array | null = null;
let distM: Float32Array | null = null;
/** 1 where there is land (the coastline polygon roughened, plus the islets) */
export function landMask(): Uint8Array {
  if (landM) return landM;
  const poly = new PixelBuffer(W, H);
  poly.poly(COAST.flat(), 0xffffffff);
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (fbm2(x * 0.028, y * 0.028, 3, 11) - 0.5) * 18 + (fbm2(x * 0.11, y * 0.11, 2, 4) - 0.5) * 4;
    const dy = (fbm2(x * 0.028 + 7.3, y * 0.028 + 3.1, 3, 12) - 0.5) * 18 + (fbm2(x * 0.11 + 2, y * 0.11 + 9, 2, 5) - 0.5) * 4;
    const sx = Math.round(x + dx), sy = Math.round(y + dy);
    let on = sx >= 0 && sy >= 0 && sx < W && sy < H && poly.data[sy * W + sx] !== 0;
    if (!on) for (const [cx, cy, r] of ISLETS) { const d = Math.hypot(x + dx * 0.4 - cx, (y + dy * 0.4 - cy) * 1.15); if (d < r) { on = true; break; } }
    if (on) m[y * W + x] = 1;
  }
  landM = m;
  return m;
}

/** distance (map px) from each pixel to the nearest pixel of the other kind (land <-> sea) */
export function coastDist(): Float32Array {
  if (distM) return distM;
  const m = landMask();
  const d = new Float32Array(W * H).fill(1e6);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = m[i];
    if ((x > 0 && m[i - 1] !== v) || (x < W - 1 && m[i + 1] !== v) || (y > 0 && m[i - W] !== v) || (y < H - 1 && m[i + W] !== v)) d[i] = 1;
  }
  const A1 = 1, B1 = 1.414;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = m[i];
    let b = d[i];
    if (x > 0 && m[i - 1] === v) b = Math.min(b, d[i - 1] + A1);
    if (y > 0 && m[i - W] === v) b = Math.min(b, d[i - W] + A1);
    if (x > 0 && y > 0 && m[i - W - 1] === v) b = Math.min(b, d[i - W - 1] + B1);
    if (x < W - 1 && y > 0 && m[i - W + 1] === v) b = Math.min(b, d[i - W + 1] + B1);
    d[i] = b;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x, v = m[i];
    let b = d[i];
    if (x < W - 1 && m[i + 1] === v) b = Math.min(b, d[i + 1] + A1);
    if (y < H - 1 && m[i + W] === v) b = Math.min(b, d[i + W] + A1);
    if (x < W - 1 && y < H - 1 && m[i + W + 1] === v) b = Math.min(b, d[i + W + 1] + B1);
    if (x > 0 && y < H - 1 && m[i + W - 1] === v) b = Math.min(b, d[i + W - 1] + B1);
    d[i] = b;
  }
  distM = d;
  return d;
}

/** what kind of shore each stretch of the coast is */
type Shore = 'beach' | 'rock' | 'cliff' | 'mangrove';
const SHORES: [number, number, number, number, Shore][] = [
  [40, 86, 106, 142, 'rock'], [106, 84, 300, 128, 'beach'], [300, 80, 472, 132, 'cliff'], [472, 70, 640, 104, 'rock'], [640, 66, 724, 112, 'beach'],
  [724, 60, 930, 252, 'cliff'], [870, 252, 930, 470, 'cliff'], [756, 460, 920, 570, 'rock'], [620, 516, 756, 580, 'beach'], [372, 516, 620, 590, 'cliff'],
  [186, 510, 372, 580, 'beach'], [30, 396, 186, 560, 'beach'], [40, 276, 166, 342, 'mangrove'], [20, 140, 74, 276, 'beach'], [20, 342, 74, 396, 'beach'],
  [100, 14, 170, 80, 'beach'], [190, 10, 240, 50, 'rock'], [780, 20, 840, 70, 'rock'],
];
function shoreAt(x: number, y: number): Shore {
  for (const [x0, y0, x1, y1, k] of SHORES) if (x >= x0 && x < x1 && y >= y0 && y < y1) return k;
  return 'rock';
}

function shapeW(s: Shape, x: number, y: number): number {
  if ('e' in s) {
    const [cx, cy, rx, ry, rot = 0] = s.e;
    const a = (rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const dx = x - cx, dy = y - cy;
    const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
    return 1 - Math.sqrt(u * u + v * v);
  }
  let best = 1e9;
  const p = s.s;
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i];
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / l2);
    const d = Math.hypot(x - ax - vx * t, y - ay - vy * t);
    if (d < best) best = d;
  }
  return 1 - best / s.r;
}
function shapeBox(s: Shape): [number, number, number, number] {
  if ('e' in s) { const [cx, cy, rx, ry] = s.e; const r = Math.max(rx, ry) * 1.45 + 6; return [cx - r, cy - r, cx + r, cy + r]; }
  const xs = s.s.map(p => p[0]), ys = s.s.map(p => p[1]);
  return [Math.min(...xs) - s.r * 1.45 - 6, Math.min(...ys) - s.r * 1.45 - 6, Math.max(...xs) + s.r * 1.45 + 6, Math.max(...ys) + s.r * 1.45 + 6];
}

// ------------------------------------------------------------------ the cache
let artP: Promise<MapArt> | null = null;
let artV: MapArt | null = null;
let paperV: Uint32Array | null = null;
let paperP: Promise<Uint32Array> | null = null;
/** the painted map, if it is ready */
export const mapArt = () => artV;
/** the parchment alone (quick: the map unrolls on it while the rest paints) */
export function paintPaper(): Promise<Uint32Array> {
  if (!paperP) paperP = (async () => { tSlice = performance.now(); const p = await buildPaper(); paperV = p; return p; })();
  return paperP;
}
export const paperNow = () => paperV;
/** paint the whole map (once per session; later calls get the same promise) */
export function paintMap(): Promise<MapArt> {
  if (!artP) artP = (async () => {
    const t0 = performance.now();
    const paper = await paintPaper();
    const a = await buildArt(paper);
    artV = a;
    (window as unknown as { __rmPaint?: number }).__rmPaint = performance.now() - t0;
    return a;
  })();
  return artP;
}

// ------------------------------------------------------------------ the parchment
async function buildPaper(): Promise<Uint32Array> {
  const m = landMask(), d = coastDist();
  const out = new Uint32Array(W * H);
  // the torn, deckled edge of the sheet
  const edgeIn = (x: number, y: number) => {
    const t = x + y * 0.7;
    return 2.5 + fbm2(t * 0.06, 3.3, 3, 71) * 7 + (hash2(Math.floor(t / 3), 1, 72) > 0.93 ? 2 : 0);
  };
  for (let y = 0; y < H; y++) {
    if ((y & 15) === 0) await slice();
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      const ei = edgeIn(x < W / 2 ? x : W - x, y < H / 2 ? y : H - y);
      if (e < ei - 1.2) { out[i] = 0; continue; }
      const n = fbm2(x * 0.03, y * 0.03, 4, 5), st = fbm2(x * 0.009 + 4, y * 0.009, 3, 9), gr = hash2(x, y, 33);
      const burn = clamp(1 - (e - ei) / 26) ** 2;
      let t = 0.66 + (n - 0.5) * 0.55 - burn * 0.75 - (st > 0.66 ? (st - 0.66) * 1.6 : 0) + (gr - 0.5) * 0.12;
      const sea = !m[i];
      let c = sea ? dith(x, y, PAPER_SEA, clamp(t + 0.1)) : dith(x, y, PAPER, clamp(t));
      if (e < ei + 0.6) c = mix(c, hx('#6e4a26'), 0.55);
      else if (burn > 0.5 && hash2(x >> 1, y >> 1, 3) < burn * 0.18) c = mix(c, hx('#7a5430'), 0.4);
      // foxing and the odd fleck
      const fox = fbm2(x * 0.08, y * 0.08, 2, 44);
      if (fox > 0.74 && hash2(x, y, 45) < (fox - 0.74) * 5) c = mix(c, hx('#a07848'), 0.45);
      if (hash2(x, y, 77) > 0.9993) c = INK2;
      // creases where it has been folded
      const fx = Math.abs(x - Math.round(W / 3)), fx2 = Math.abs(x - Math.round((2 * W) / 3)), fy = Math.abs(y - Math.round(H / 2));
      if (fx === 0 || fx2 === 0 || fy === 0) c = mix(c, hx('#8c6c44'), 0.16);
      else if (fx === 1 || fx2 === 1 || fy === 1) c = mix(c, hx('#fbefd2'), 0.18);
      // Joshu's chart: a faint coastline with ripple lines in the sea
      if (!sea && d[i] <= 1.2) c = mix(c, INK2, 0.72);
      else if (sea) {
        const dd = d[i];
        if (dd <= 1.3) c = mix(c, INK2, 0.6);
        for (const [r, k] of [[4, 0.9], [8, 0.7], [13, 0.45], [19, 0.25]] as const) {
          if (Math.abs(dd - r) < 0.55 && hash2(Math.floor(x / 5), Math.floor(y / 5), r) < k) c = mix(c, INK3, r < 9 ? 0.7 : 0.45);
        }
      }
      out[i] = c;
    }
  }
  const pb = { data: out, set(x: number, y: number, c: C) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < W && y < H && out[y * W + x]) out[y * W + x] = c; }, get(x: number, y: number) { return out[(y | 0) * W + (x | 0)]; } };
  const blendSet = (x: number, y: number, c: C, k: number) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (out[i]) out[i] = mix(out[i], c, k); };
  // rhumb lines from the compass rose, faint, across the whole sheet
  const [rx0, ry0] = [878, 572];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let t = 36; t < 1300; t += 1) {
      const x = rx0 + ca * t, y = ry0 + sa * t;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      if ((t >> 1) % 3 === 2) continue;
      blendSet(x, y, k % 4 === 0 ? INK3 : hx('#a88a5e'), k % 4 === 0 ? 0.32 : 0.18);
    }
  }
  await slice();
  // little wave strokes over the open sea
  for (let y = 18; y < H - 18; y += 13) for (let x = 18; x < W - 18; x += 17) {
    const jx = x + Math.floor(hash2(x, y, 3) * 10), jy = y + Math.floor(hash2(x, y, 4) * 8);
    const i = jy * W + jx;
    if (m[i] || d[i] < 24 || hash2(x, y, 5) < 0.55) continue;
    for (let k = 0; k < 7; k++) blendSet(jx + k, jy - Math.round(Math.sin((k / 6) * Math.PI) * 1.5), INK3, 0.75);
    for (let k = 0; k < 5; k++) blendSet(jx + 6 + k, jy - Math.round(Math.sin((k / 4) * Math.PI) * 1.2), INK3, 0.75);
  }
  compassRose(pb as never, rx0, ry0);
  seaSerpent(blendSet, 40, 600);
  shipSketch(blendSet, 896, 112);
  whaleSketch(blendSet, 420, 30);
  cartouche(blendSet, 520, 606);
  scaleBar(blendSet, 676, 604);
  border(blendSet);
  return out;
}

type BS = (x: number, y: number, c: C, k: number) => void;
/** a compass rose: a ring with ticks, 16 points in ink, gold and red, north in red */
function compassRose(b: { set(x: number, y: number, c: C): void }, cx: number, cy: number) {
  const R1 = 31;
  for (let a = 0; a < 720; a++) {
    const t = (a / 720) * Math.PI * 2;
    b.set(cx + Math.cos(t) * R1, cy + Math.sin(t) * R1, INK2);
    b.set(cx + Math.cos(t) * (R1 - 3), cy + Math.sin(t) * (R1 - 3), INK3);
    if (a % 20 === 0) for (let r = R1 - 3; r <= R1; r++) b.set(cx + Math.cos(t) * r, cy + Math.sin(t) * r, INK);
  }
  const point = (ang: number, len: number, wid: number, fill: C, fill2: C) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let t = 0; t <= len; t += 0.5) {
      const w = wid * (1 - t / len);
      for (let s = -w; s <= w; s += 0.5) {
        const x = cx + ca * t - sa * s, y = cy + sa * t + ca * s;
        b.set(x, y, Math.abs(s) > w - 0.7 ? INK : s < 0 ? fill : fill2);
      }
    }
  };
  for (let k = 0; k < 8; k++) point(Math.PI / 8 + (k * Math.PI) / 4, 16, 2.4, hx('#e2cc96'), hx('#b89a62'));
  for (let k = 0; k < 4; k++) point(Math.PI / 4 + (k * Math.PI) / 2, 21, 3.4, hx('#e0b040'), hx('#a8781c'));
  point(Math.PI / 2, 28, 4.4, hx('#f0e2b8'), hx('#bba274'));
  point(0, 28, 4.4, hx('#f0e2b8'), hx('#bba274'));
  point(Math.PI, 28, 4.4, hx('#f0e2b8'), hx('#bba274'));
  point(-Math.PI / 2, 30, 4.6, hx('#d0402c'), hx('#8a2018'));
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) b.set(cx + x, cy + y, INK);
  b.set(cx, cy, hx('#f2e4bc'));
  // a fleur-de-lis at north
  const fy = cy - R1 - 8;
  for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [-1, 1], [1, 1], [-2, 2], [2, 2], [-2, 3], [2, 3], [-1, 4], [1, 4], [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5], [0, 6]]) b.set(cx + dx, fy + dy, dy < 2 ? INK_RED : INK);
}
/** a sea serpent, sketched in the south-west sea as old charts have */
function seaSerpent(set: BS, x0: number, y0: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 74; i++) pts.push([x0 + i * 1.55, y0 + Math.sin(i * 0.22) * 6]);
  pts.forEach(([x, y], i) => {
    const above = Math.sin(i * 0.22) < -0.15 || i > 64;
    if (!above) { if (i % 3 === 0) set(x, y + 4, INK3, 0.8); return; }
    const r = i > 64 ? 2.6 : 2;
    for (let s = -r; s <= r; s += 0.5) set(x, y + s, Math.abs(s) > r - 0.6 ? INK : i % 4 === 0 ? hx('#7a8a6a') : hx('#a4ae8a'), 0.9);
    if (i % 5 === 0) set(x, y - r - 1, INK2, 0.8);
  });
  const [hx0, hy] = pts[pts.length - 1];
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) set(hx0 + 3 + x, hy - 1 + y, Math.abs(x * x + y * y - 9) < 3 ? INK : hx('#a4ae8a'), 0.95);
  set(hx0 + 4, hy - 2, INK, 1);
  for (let k = 0; k < 4; k++) set(hx0 + 7 + k, hy + (k % 2), INK_RED, 1);
}
/** a little three-masted ship in ink */
function shipSketch(set: BS, x0: number, y0: number) {
  for (let x = -9; x <= 9; x++) { const yb = y0 + Math.round((x * x) / 30); set(x0 + x, yb, INK, 0.9); if (Math.abs(x) < 8) set(x0 + x, yb - 1, INK3, 0.6); }
  for (const [mx, mh] of [[-5, 10], [0, 13], [5, 9]]) {
    for (let y = 0; y < mh; y++) set(x0 + mx, y0 - 1 - y, INK, 0.85);
    for (let s = 0; s < 3; s++) { const sy = y0 - mh + 2 + s * 3, sw = 3 - (s === 0 ? 1 : 0); for (let x = -sw; x <= sw; x++) set(x0 + mx + x, sy + Math.abs(x) * 0.3, INK2, 0.75); }
  }
  set(x0, y0 - 15, INK_RED, 1); set(x0 + 1, y0 - 15, INK_RED, 1); set(x0 + 1, y0 - 14, INK_RED, 1);
  for (let x = -12; x <= 12; x += 3) set(x0 + x, y0 + 3 + ((x / 3) & 1), INK3, 0.6);
}
/** a whale spouting, in ink */
function whaleSketch(set: BS, x0: number, y0: number) {
  for (let x = -8; x <= 8; x++) { const t = x / 8; const top = y0 - Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 4); set(x0 + x, top, INK, 0.85); if (x > -7 && x < 7) set(x0 + x, top + 1, hx('#8a8a7a'), 0.4); }
  for (let x = -8; x <= 8; x++) set(x0 + x, y0 + 1, INK3, 0.5);
  for (const [dx, dy] of [[9, 0], [10, -1], [11, -2], [10, 1], [11, 2]]) set(x0 + dx, y0 + dy, INK, 0.8);
  for (const [dx, dy] of [[-3, -6], [-4, -8], [-2, -8], [-5, -10], [-1, -10], [-3, -9]]) set(x0 + dx, y0 + dy, INK2, 0.75);
  set(x0 - 5, y0 - 2, INK, 1);
}
/** the title ribbon in the south sea (the name itself is a hand-written label on top) */
function cartouche(set: BS, cx: number, cy: number) {
  const w = 120, h2 = 11;
  for (let y = -h2; y <= h2; y++) for (let x = -w; x <= w; x++) {
    const wave = Math.round(Math.sin((x / w) * Math.PI * 1.5) * 1.5);
    const yy = y + wave;
    if (Math.abs(yy) > h2) continue;
    const edge = Math.abs(yy) >= h2 - 0.5 || Math.abs(x) >= w - 0.5;
    set(cx + x, cy + y, edge ? INK2 : Math.abs(yy) >= h2 - 2.5 ? hx('#e8d6aa') : hx('#f4e6c2'), edge ? 0.9 : 0.85);
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 18; k++) {
      const t = k / 17, a = t * Math.PI * 2.2;
      const x = cx + side * (w + 4 + Math.cos(a) * (6 - t * 3)), y = cy + Math.sin(a) * (6 - t * 3) * side;
      set(x, y, INK2, 0.9);
    }
    for (let k = 0; k < 10; k++) set(cx + side * (w + k * 0.9), cy + h2 - 2 + k * 0.6, INK2, 0.8);
  }
}
/** a scale bar: four hours on foot */
function scaleBar(set: BS, x0: number, y0: number) {
  const seg = 26;
  for (let k = 0; k < 4; k++) for (let x = 0; x < seg; x++) for (let y = 0; y < 3; y++) set(x0 + k * seg + x, y0 + y, y === 0 || y === 2 ? INK : k % 2 ? hx('#f4e6c2') : INK2, 0.9);
  for (let k = 0; k <= 4; k++) for (let y = -2; y <= 4; y++) set(x0 + k * seg, y0 + y, INK, 0.95);
}
/** a double ink rule inside the edge, ticks and corner pieces */
function border(set: BS) {
  const m1 = 14, m2 = 18;
  for (let x = m1; x < W - m1; x++) { set(x, m1, INK2, 0.75); set(x, H - 1 - m1, INK2, 0.75); set(x, m2, INK3, 0.6); set(x, H - 1 - m2, INK3, 0.6); if (x % 40 === 0) for (let k = m1; k <= m2; k++) { set(x, k, INK2, 0.8); set(x, H - 1 - k, INK2, 0.8); } }
  for (let y = m1; y < H - m1; y++) { set(m1, y, INK2, 0.75); set(W - 1 - m1, y, INK2, 0.75); set(m2, y, INK3, 0.6); set(W - 1 - m2, y, INK3, 0.6); if (y % 40 === 0) for (let k = m1; k <= m2; k++) { set(k, y, INK2, 0.8); set(W - 1 - k, y, INK2, 0.8); } }
  for (const [cx, cy] of [[m1 + 2, m1 + 2], [W - 3 - m1, m1 + 2], [m1 + 2, H - 3 - m1], [W - 3 - m1, H - 3 - m1]]) {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.abs(x) + Math.abs(y) <= 3) set(cx + x, cy + y, Math.abs(x) + Math.abs(y) === 3 ? INK : INK_RED, 0.9);
  }
}

// ------------------------------------------------------------------ the painted map
async function buildArt(paper: Uint32Array): Promise<MapArt> {
  tSlice = performance.now();
  const land = landMask(), cd = coastDist();
  const N = W * H;
  const cx: Ctx = {
    col: new Uint32Array(N), edge: new Uint8Array(N), tag: new Uint8Array(N), land, cd, bio: new Uint8Array(N), bw: new Float32Array(N),
    elev: new Float32Array(N), water: new Uint8Array(N), flow: new Uint8Array(N), nA: new Float32Array(N), nB: new Float32Array(N), occ: new Uint8Array(N),
  };
  await fields(cx);
  await ground(cx);
  await waters(cx);
  await cliffsAndShores(cx);
  await features(cx);
  await slice();
  const ink = await sketch(cx, paper);
  return { paper, color: cx.col, ink, land, coast: cd, biome: cx.bio, water: cx.water, flow: cx.flow, tag: cx.tag, depth: cx.bw };
}

/** noise fields, biomes and elevation */
async function fields(cx: Ctx) {
  const { land, bio, bw, nA, nB, elev } = cx;
  const boxes = SHAPES.map(shapeBox);
  const sign = SHAPES.map((s, k) => (hash2(k, s.b, 9) < 0.5 ? -1 : 1));
  for (let y = 0; y < H; y++) {
    if ((y & 7) === 0) await slice();
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = fbm2(x * 0.032, y * 0.032, 3, 21), b = noise2(x * 0.16, y * 0.16, 22);
      nA[i] = a; nB[i] = b;
      if (!land[i]) { bio[i] = B.sea; continue; }
      let best = 0, bb: B = B.meadow;
      for (let k = 0; k < SHAPES.length; k++) {
        const bx = boxes[k];
        if (x < bx[0] || x > bx[2] || y < bx[1] || y > bx[3]) continue;
        const w = shapeW(SHAPES[k], x, y) + (a - 0.5) * 0.62 * sign[k] + (b - 0.5) * 0.14;
        if (w > best) { best = w; bb = SHAPES[k].b; }
      }
      bio[i] = bb;
      bw[i] = bb === B.meadow ? 0 : clamp(best * 2.2);
      // elevation: gentle lowland, plateaus with steep edges, the range
      let e = 0.1 + (a - 0.5) * 0.12;
      for (const f of HEIGHTS) {
        const [ex, ey, rx, ry] = f.e;
        const k = 1 - Math.hypot((x - ex) / rx, (y - ey) / ry) + (a - 0.5) * 0.3;
        if (k > 0) e += f.h * clamp(k / f.edge) ** 1.5;
      }
      elev[i] = e;
    }
  }
}

/** the ground: biome colours, light from the north-west, the shore */
async function ground(cx: Ctx) {
  const { land, cd, bio, bw, nA, nB, elev, col } = cx;
  for (let y = 0; y < H; y++) {
    if ((y & 7) === 0) await slice();
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = nA[i], b = nB[i], d = cd[i];
      if (!land[i]) { col[i] = seaColor(cx, x, y, i, d, a, b); continue; }
      const e0 = elev[i], ex = x > 0 ? elev[i - 1] : e0, ey = y > 0 ? elev[i - W] : e0;
      const lit = clamp((e0 - ex) * 0.7 + (e0 - ey) * 1.0, -0.08, 0.08) * 6;
      let bb = bio[i] as B;
      const shore = d < 14 ? shoreAt(x, y) : null;
      // the shore: sand, dunes, rocks, mud
      if (shore === 'beach' && d <= 4.2 + (a - 0.5) * 4) bb = B.beach;
      else if (shore === 'beach' && d <= 9 + (a - 0.5) * 6 && (bb === B.meadow || bb === B.forest || bb === B.beech)) bb = B.dunes;
      else if ((shore === 'rock' || shore === 'cliff') && d <= 2.6 + b * 2) bb = B.rock;
      else if (shore === 'mangrove' && d <= 5) bb = B.swamp;
      else if (d <= 11 && (bb === B.meadow) && shore !== 'mangrove') bb = B.scrub;
      bio[i] = bb;
      const ramp = GROUND[bb] ?? GROUND[B.meadow];
      let t = 0.5 + (a - 0.5) * 0.9 + (b - 0.5) * 0.45 + lit * 0.5;
      if (bb === B.gorge) {
        // layered rock: bands that follow the slope
        const band = Math.floor((y * 1 + x * 0.36 + (a - 0.5) * 12) / 2.3);
        const k = ((band % 8) + 8) % 8;
        col[i] = darken(ramp[k], 0.82 + bw[i] * 0.18 + lit * 0.12);
        continue;
      }
      if (bb === B.beach) t = 0.55 + (b - 0.5) * 0.5 + (d - 2) * 0.08 - (d < 1.6 ? 0.45 : 0);
      if (bb === B.forest || bb === B.fern || bb === B.canopy || bb === B.beech || bb === B.glow) t = 0.35 + (a - 0.5) * 0.6 + (b - 0.5) * 0.5 - bw[i] * 0.2;
      if (bb === B.hills) t += (fbm2(x * 0.09, y * 0.09, 2, 61) - 0.5) * 0.8;
      if (bb === B.thermal) t += (fbm2(x * 0.07, y * 0.07, 2, 62) - 0.5) * 0.9;
      let c = dith(x, y, ramp, clamp(t));
      // meadow: grass tufts and the odd flower
      if (bb === B.meadow || bb === B.plain || bb === B.garden) {
        const hh = hash2(x, y, 81);
        if (hh > 0.985) c = hx('#8cb85a');
        else if (hh > 0.978) c = hx('#2e5422');
        else if (hh < 0.0025) c = [hx('#e8d24a'), hx('#e88a9a'), hx('#f2f0e4')][Math.floor(hash2(x, y, 82) * 3)];
      }
      if (bb === B.hills && hash2(x, y, 83) > 0.975) c = hx('#d8ca86');
      if (bb === B.mountain && hash2(x, y, 84) > 0.97) c = hx('#9a9484');
      if (bb === B.thermal) {
        const s = fbm2(x * 0.11 + 3, y * 0.11, 2, 63);
        if (s > 0.66) c = dith(x, y, PAL.silica, clamp((s - 0.66) * 4));
        else if (s < 0.3) c = dith(x, y, PAL.sulphur, clamp((0.3 - s) * 3));
      }
      if (bb === B.swamp) {
        // black-water channels winding through the mud
        const ch = Math.abs(fbm2(x * 0.06, y * 0.06, 3, 64) - 0.5);
        if (ch < 0.032 || fbm2(x * 0.05 + 9, y * 0.05, 2, 65) > 0.7) { cx.water[i] = WK.channel; c = dith(x, y, SEA.murk, clamp(0.3 + (b - 0.5) * 0.6)); }
      }
      col[i] = c;
    }
  }
}

function seaColor(cx: Ctx, x: number, y: number, i: number, d: number, a: number, b: number): C {
  cx.water[i] = WK.sea;
  const shore = d < 16 ? shoreAt(x, y) : null;
  let c: C;
  if (d < 1.6 && shore === 'beach') c = dith(x, y, SEA.foam, clamp(0.5 + (b - 0.5)));
  else if (d < 8 && shore === 'beach') c = dith(x, y, SEA.lagoon, clamp(1 - d / 8 + (a - 0.5) * 0.4));
  else if (d < 7 && shore === 'mangrove') c = dith(x, y, SEA.murk, clamp(0.6 - d / 12 + (a - 0.5) * 0.4));
  else if (d < 14) c = dith(x, y, SEA.shal, clamp(1 - d / 14 + (a - 0.5) * 0.5));
  else if (d < 34) c = dith(x, y, SEA.mid, clamp(1 - (d - 14) / 20 + (a - 0.5) * 0.5));
  else c = dith(x, y, SEA.deep, clamp(0.5 + (a - 0.5) * 1.2 + (b - 0.5) * 0.3));
  // the reef, the shelf's drop-off, the Deep
  const reef = 1 - Math.hypot((x - 244) / 30, (y - 54) / 12);
  if (reef > 0) {
    const n = fbm2(x * 0.18, y * 0.18, 2, 91);
    if (n > 0.55 - reef * 0.25) c = dith(x, y, SEA.reef, clamp((n - 0.4) * 2));
    if (hash2(x, y, 92) > 0.94 && reef > 0.2) c = [hx('#e87a6a'), hx('#f0c050'), hx('#e2e0c8'), hx('#c870a8')][Math.floor(hash2(x, y, 93) * 4)];
  }
  const shelf = 1 - Math.hypot((x - 300) / 52, (y - 38) / 16);
  if (shelf > 0 && y < 40 + Math.sin(x / 9) * 2.5) c = dith(x, y, SEA.abyss, clamp(0.4 + (a - 0.5)));
  const deep = 1 - Math.hypot((x - 534) / 96, (y - 64) / 22);
  if (deep > 0) c = mix(c, hx('#0a1622'), clamp(deep * 1.4) * 0.55);
  // wave strokes on the open sea
  if (d > 12) {
    const gx = Math.floor(x / 11), gy = Math.floor(y / 7);
    const hh = hash2(gx, gy, 94);
    if (hh > 0.6) {
      const ox = gx * 11 + Math.floor(hash2(gx, gy, 95) * 6), oy = gy * 7 + Math.floor(hash2(gx, gy, 96) * 4);
      const lx = x - ox;
      if (lx >= 0 && lx < 5 && y === oy - (lx === 1 || lx === 3 ? 1 : lx === 2 ? 1 : 0)) c = hh > 0.85 ? SEA.wave2 : SEA.wave;
    }
  }
  return c;
}

// ------------------------------------------------------------------ rivers, lakes, the falls
async function waters(cx: Ctx) {
  const { water, flow, col, edge } = cx;
  const widths = [1.4, 2.2, 2.0, 1.9, 1.5, 1.6, 1.8, 1.2, 1.3];
  const extra: [number, number][][] = [
    [[836, 300], [858, 326], [878, 342], [902, 352]],
    [[502, 488], [490, 512], [478, 534], [470, 552]],
    [[338, 418], [306, 404], [276, 392], [250, 378]],
    [[734, 250], [714, 270], [698, 288], [686, 300]],
    [[760, 300], [770, 340], [778, 380], [790, 420], [812, 470], [826, 512]],
  ];
  const all = [...RIVERS, ...extra];
  all.forEach((pts, ri) => {
    const w0 = widths[ri] ?? 1.4;
    // densify with a gentle meander
    const dense: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const m = (noise2((i * n + k) * 0.045, ri * 3.1, 120 + ri) - 0.5) * 6 * Math.sin(t * Math.PI);
        dense.push([ax + (bx - ax) * t + (nx / nl) * m, ay + (by - ay) * t + (ny / nl) * m]);
      }
    }
    dense.push(pts[pts.length - 1]);
    let dist = 0;
    for (let k = 0; k < dense.length; k++) {
      const [x, y] = dense[k];
      if (k) dist += Math.hypot(x - dense[k - 1][0], y - dense[k - 1][1]);
      const t = k / dense.length;
      const r = w0 * (0.6 + t * 0.6);
      for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++) for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (water[i] === WK.sea) continue;
        const dd = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
        if (dd > r + 0.6) continue;
        if (water[i] !== WK.river) { water[i] = WK.river; flow[i] = Math.floor(dist * 3) & 255; }
        const core = dd < r - 0.8;
        col[i] = core ? dith(xx, yy, RIVER, 0.55 + (hash2(xx, yy, 7) - 0.5) * 0.3) : RIVER[1];
        edge[i] = core ? 0 : 2;
      }
    }
  });
  // lakes and pools
  const lake = (x0: number, y0: number, rx: number, ry: number, ramp: C[], kind: number) => {
    for (let y = Math.floor(y0 - ry - 1); y <= y0 + ry + 1; y++) for (let x = Math.floor(x0 - rx - 1); x <= x0 + rx + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = Math.hypot((x + 0.5 - x0) / rx, (y + 0.5 - y0) / ry) + (hash2(x, y, 5) - 0.5) * 0.12;
      if (k > 1) continue;
      const i = y * W + x;
      water[i] = kind;
      col[i] = k > 0.82 ? ramp[0] : dith(x, y, ramp, clamp(0.25 + (1 - k) * 0.7 - (y - y0) / ry * 0.15));
      edge[i] = k > 0.82 ? 2 : 0;
    }
  };
  lake(LM.plunge[0], LM.plunge[1], 6.5, 4, RIVER, WK.lake);
  lake(742, 252, 5, 3, RIVER, WK.lake);
  lake(792, 266, 4, 2.2, RIVER, WK.lake);
  lake(586, 168, 3.2, 2, RIVER, WK.lake);
  for (const [x, y, r, k] of POOLS) lake(x, y, r, r * 0.65, k === 0 ? PAL.hot : k === 1 ? PAL.orange : PAL.mud, WK.pool);
  for (const [x, y, r] of WALLOWS) lake(x, y, r, r * 0.6, PAL.mud, WK.pool);
  await slice();
}

/** the escarpments and the coast's cliff faces */
async function cliffsAndShores(cx: Ctx) {
  const { col, edge, land, cd, water } = cx;
  for (const cl of CLIFFS) {
    const p = cl.pts;
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / n), y0 = Math.round(ay + ((by - ay) * k) / n);
        const hh = cl.h + Math.round((hash2(x, 3, 17) - 0.5) * 2);
        for (let j = 0; j <= hh; j++) {
          const y = y0 + j;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i2 = y * W + x;
          if (!land[i2] || water[i2] === WK.river || water[i2] === WK.lake) continue;
          const t = j / hh;
          const streak = hash2(x, 5, 18) > 0.6 ? -0.18 : 0;
          col[i2] = j === 0 ? PAL.granite[6] : pick(PAL.granite, clamp(0.78 - t * 0.62 + streak + (hash2(x, y, 19) - 0.5) * 0.15));
          edge[i2] = j === 0 || j === hh ? 1 : 0;
        }
      }
    }
  }
  // Thunder Falls: a white curtain over the escarpment
  const [fx, fy] = LM.falls;
  for (let y = fy - 2; y <= fy + 8; y++) for (let x = fx - 1; x <= fx + 1; x++) {
    const i = y * W + x;
    col[i] = x === fx + 1 ? hx('#9ac8dc') : (y + x) % 3 === 0 ? hx('#ffffff') : hx('#dcecf2');
    water[i] = WK.fall; edge[i] = x === fx - 1 || x === fx + 1 ? 2 : 0;
  }
  // the far coast: a waterfall straight into the sea; sea cliffs facing south and east
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (land[i]) continue;
    const sh = cd[i] < 12 ? shoreAt(x, y) : null;
    if (sh !== 'cliff') continue;
    // the land just above this sea pixel: a visible cliff face
    let up = 0;
    for (let k = 1; k <= 6; k++) { const j = (y - k) * W + x; if (y - k >= 0 && land[j]) { up = k; break; } }
    if (!up) continue;
    const face = 5 + Math.floor(hash2(x >> 2, 9, 20) * 3);
    if (up > face) continue;
    const t = up / face;
    col[i] = pick(PAL.rock, clamp(0.7 - t * 0.55 + (hash2(x, 2, 21) > 0.7 ? -0.15 : 0) + (hash2(x, y, 22) - 0.5) * 0.12));
    water[i] = 0;
    edge[i] = up === face ? 1 : 0;
    if (up === face && hash2(x, y, 23) > 0.45) { const j = (y + 1) * W + x; if (y + 1 < H && !land[j]) col[j] = SEA.foam[1]; }
  }
  const [wx, wy] = LM.farfall;
  for (let y = wy - 6; y <= wy + 3; y++) for (let x = wx - 1; x <= wx + 1; x++) { const i = y * W + x; col[i] = (x + y) % 3 ? hx('#e4f0f4') : hx('#ffffff'); water[i] = WK.fall; }
  await slice();
}

// ------------------------------------------------------------------ the sprites
type Feat = { y: number; x: number; z: number; f: () => void };

function conifer(rng: Rng, h: number, hw: number, pal: C[], light = 0): Spr {
  const w = Math.ceil(hw * 2) + 3, sh = h + 3;
  const s = new Spr(w, sh, Math.floor(w / 2), sh - 1);
  const cxl = s.ax + 0.5;
  const ph = Math.floor(rng.next() * 3);
  for (let row = 0; row < h; row++) {
    const t = row / Math.max(1, h - 1);
    let half = hw * (0.12 + 0.88 * Math.pow(t, 0.85));
    const tier = (row + ph) % 3;
    half *= tier === 0 ? 0.78 : tier === 1 ? 0.94 : 1.04;
    const y = s.ay - 1 - (h - row);
    const x0 = Math.round(cxl - half - 0.5), x1 = Math.round(cxl + half - 0.5);
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - cxl) / Math.max(0.8, half);
      let l = 0.62 - u * 0.45 - t * 0.2 + (tier === 0 ? 0.12 : 0) + light;
      if (x === x1 || row === h - 1) l -= 0.25;
      const k = clamp(Math.floor(l * (pal.length - 1) + bayer(x, y) * 0.9), 0, pal.length - 1);
      const top = row < h * 0.45 && x === x0 + Math.max(0, Math.floor((x1 - x0) * 0.25));
      s.set(x, y, pal[top ? Math.min(pal.length - 1, k + 1) : k], top ? TAG.gust : TAG.crown);
    }
  }
  s.set(s.ax, s.ay - 1, PAL.trunk[1]);
  s.set(s.ax, s.ay - 2, PAL.trunk[2]);
  return s;
}
function broadleaf(rng: Rng, r: number, pal: C[], light = 0, trunkH = 2): Spr {
  const w = Math.ceil(r * 2.4) + 4, sh = Math.ceil(r * 2.1) + trunkH + 3;
  const s = new Spr(w, sh, Math.floor(w / 2), sh - 1);
  const cx0 = s.ax + 0.5, cy0 = s.ay - trunkH - r * 0.9;
  for (let k = 0; k < trunkH + 1; k++) s.set(s.ax, s.ay - k, PAL.trunk[k === 0 ? 0 : 2]);
  // two or three blobs make a cauliflower crown
  const blobs: [number, number, number][] = [[0, 0, r]];
  const nb = r > 2.6 ? 2 + Math.floor(rng.next() * 2) : 1;
  for (let b = 0; b < nb; b++) { const a = rng.range(-Math.PI, 0); blobs.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.45 + 0.4, r * rng.range(0.55, 0.75)]); }
  for (const [bx, by, br] of blobs) {
    for (let y = Math.floor(cy0 + by - br - 1); y <= cy0 + by + br + 1; y++) for (let x = Math.floor(cx0 + bx - br - 1); x <= cx0 + bx + br + 1; x++) {
      const nx = (x + 0.5 - cx0 - bx) / br, ny = (y + 0.5 - cy0 - by) / (br * 0.92);
      const d2 = nx * nx + ny * ny;
      const bump = (hash2(x * 3 + 1, y * 7, 31) - 0.5) * 0.35;
      if (d2 > 1 + bump) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d2));
      let l = 0.5 + (-nx * 0.5 - ny * 0.6 + nz * 0.6) * 0.5 + light;
      if (d2 > 0.8 && (nx > 0 || ny > 0.2)) l -= 0.18;
      const k = clamp(Math.floor(l * (pal.length - 1) + bayer(x, y) * 0.9 - 0.2), 0, pal.length - 1);
      const hi = nx < -0.2 && ny < -0.3 && k >= pal.length - 2;
      s.set(x, y, pal[k], hi ? TAG.gust : TAG.crown);
    }
  }
  return s;
}
function treeFern(rng: Rng, size: number): Spr {
  const th = 2 + Math.floor(rng.next() * 3) + Math.floor(size);
  const len = 3 + size;
  const w = Math.ceil(len * 2) + 5, sh = th + Math.ceil(len) + 4;
  const s = new Spr(w, sh, Math.floor(w / 2), sh - 1);
  for (let k = 0; k < th; k++) s.set(s.ax, s.ay - k, k % 2 ? PAL.trunk[2] : PAL.trunk[1]);
  const tx = s.ax, ty = s.ay - th;
  const n = 7;
  for (let f = 0; f < n; f++) {
    const a = -Math.PI * (0.02 + (f / (n - 1)) * 0.96) + rng.range(-0.12, 0.12);
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let t = 1; t <= len; t++) {
      const droop = (t / len) ** 2 * 1.6;
      const x = tx + ca * t, y = ty + sa * t * 0.75 + droop;
      const k = t >= len - 0.5 ? 2 : t < 1.6 ? 6 : 4 + (f % 2);
      s.set(x, y, PAL.fern[k], t < 2.2 && sa < -0.5 ? TAG.gust : TAG.crown);
      if (t > 1 && t < len) s.set(x + (ca > 0 ? 0 : 0), y + 1, PAL.fern[2], TAG.crown);
    }
  }
  s.set(tx, ty, PAL.fern[6], TAG.gust);
  s.set(tx, ty - 1, PAL.fern[5], TAG.crown);
  return s;
}
function kauri(rng: Rng, size: number): Spr {
  const r = 2.6 + size * 1.2, th = 4 + Math.floor(size * 2.5);
  const w = Math.ceil(r * 5) + 4, sh = th + Math.ceil(r * 2.4) + 3;
  const s = new Spr(w, sh, Math.floor(w / 2), sh - 1);
  for (let k = 0; k < th; k++) { s.set(s.ax, s.ay - k, PAL.bark[k % 3 === 0 ? 1 : 2]); s.set(s.ax + 1, s.ay - k, PAL.bark[0]); }
  const cy0 = s.ay - th - r * 0.6;
  const blobs: [number, number, number][] = [[0, 0, r], [-r * 1.05, 0.6, r * 0.78], [r * 1.05, 0.5, r * 0.8], [-r * 0.45, -r * 0.55, r * 0.7], [r * 0.5, -r * 0.5, r * 0.66]];
  if (rng.next() < 0.5) blobs.push([-r * 1.7, 1.2, r * 0.55]);
  if (rng.next() < 0.5) blobs.push([r * 1.75, 1.1, r * 0.55]);
  const cx0 = s.ax + 0.5;
  for (const [bx, by, br] of blobs) {
    for (let y = Math.floor(cy0 + by - br - 1); y <= cy0 + by + br + 1; y++) for (let x = Math.floor(cx0 + bx - br - 1); x <= cx0 + bx + br + 1; x++) {
      const nx = (x + 0.5 - cx0 - bx) / br, ny = (y + 0.5 - cy0 - by) / (br * 0.85);
      const d2 = nx * nx + ny * ny;
      if (d2 > 1 + (hash2(x * 5, y * 3, 32) - 0.5) * 0.3) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d2));
      const l = 0.48 + (-nx * 0.5 - ny * 0.65 + nz * 0.55) * 0.5 - (d2 > 0.75 && ny > 0 ? 0.15 : 0);
      const k = clamp(Math.floor(l * (PAL.kauri.length - 1) + bayer(x, y) * 0.9 - 0.15), 0, PAL.kauri.length - 1);
      s.set(x, y, PAL.kauri[k], nx < -0.25 && ny < -0.35 && k >= 4 ? TAG.gust : TAG.crown);
    }
  }
  return s;
}
function palm(rng: Rng): Spr {
  const th = 5 + Math.floor(rng.next() * 3);
  const s = new Spr(13, th + 7, 6, th + 6);
  const lean = rng.range(-0.25, 0.25);
  for (let k = 0; k < th; k++) s.set(s.ax + Math.round(lean * k), s.ay - k, k % 2 ? hx('#7a7262') : hx('#5e584c'));
  const tx = s.ax + Math.round(lean * th), ty = s.ay - th;
  for (let f = 0; f < 6; f++) {
    const a = -Math.PI * (0.05 + f * 0.18) + rng.range(-0.1, 0.1);
    for (let t = 1; t <= 4; t++) s.set(tx + Math.cos(a) * t, ty + Math.sin(a) * t * 0.6 + (t * t) / 6, PAL.palm[t > 3 ? 1 : 3 + (f % 2)], TAG.crown);
  }
  s.set(tx, ty, PAL.palm[4], TAG.gust);
  s.set(tx, ty + 1, hx('#a83a2a'));
  return s;
}
function pohutukawa(rng: Rng): Spr {
  const s = broadleaf(rng, 3 + rng.next(), PAL.pohu, 0.05, 1);
  // red blossom on the sunny side
  for (let y = 0; y < s.b.h; y++) for (let x = 0; x < s.b.w; x++) {
    if (!s.has(x, y) || s.t[y * s.b.w + x] === 0) continue;
    if (hash2(x, y, Math.floor(rng.next() * 1000)) < 0.28 && (x < s.ax + 2 || y < s.ay - 4)) s.set(x, y, PAL.red[1 + Math.floor(hash2(x, y, 3) * 3)], TAG.crown);
  }
  return s;
}
function mangrove(rng: Rng): Spr {
  const rx = 3 + rng.next() * 1.5, ry = 2 + rng.next();
  const w = Math.ceil(rx * 2) + 4, sh = Math.ceil(ry * 2) + 5;
  const s = new Spr(w, sh, Math.floor(w / 2), sh - 1);
  // roots arching into the water
  for (let k = -2; k <= 2; k++) { s.set(s.ax + k * 1.2, s.ay, PAL.wood[1]); s.set(s.ax + k * 0.8, s.ay - 1, PAL.wood[2]); }
  const cy0 = s.ay - 2 - ry;
  for (let y = Math.floor(cy0 - ry - 1); y <= cy0 + ry + 1; y++) for (let x = Math.floor(s.ax - rx - 1); x <= s.ax + rx + 1; x++) {
    const nx = (x + 0.5 - s.ax - 0.5) / rx, ny = (y + 0.5 - cy0) / ry;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1 + (hash2(x, y, 33) - 0.5) * 0.3) continue;
    const l = 0.55 - nx * 0.3 - ny * 0.35;
    s.set(x, y, PAL.mang[clamp(Math.floor(l * 5 + bayer(x, y)), 0, 5)], ny < -0.4 && nx < 0 ? TAG.gust : TAG.crown);
  }
  return s;
}
function snag(rng: Rng): Spr {
  const th = 5 + Math.floor(rng.next() * 3);
  const s = new Spr(9, th + 3, 4, th + 2);
  const c0 = hx('#8a8070'), c1 = hx('#5e564a');
  for (let k = 0; k < th; k++) s.set(s.ax, s.ay - k, k % 2 ? c0 : c1);
  s.set(s.ax - 1, s.ay - th + 2, c0); s.set(s.ax - 2, s.ay - th + 1, c0);
  s.set(s.ax + 1, s.ay - th + 3, c1); s.set(s.ax + 2, s.ay - th + 2, c0);
  if (rng.next() < 0.5) { s.set(s.ax + 1, s.ay - th, c0); }
  return s;
}
function glowTree(rng: Rng): Spr {
  const s = broadleaf(rng, 2.4 + rng.next() * 1.4, PAL.glowc, -0.05, 2);
  for (let k = 0; k < 3; k++) {
    const x = Math.floor(rng.range(1, s.b.w - 1)), y = Math.floor(rng.range(1, s.b.h - 4));
    if (s.has(x, y)) s.set(x, y, rng.next() < 0.5 ? hx('#7affe6') : hx('#3fd8c8'), TAG.glow);
  }
  return s;
}
function mushroom(rng: Rng): Spr {
  const sh = 3 + Math.floor(rng.next() * 3), cr = 2 + rng.next() * 2;
  const w = Math.ceil(cr * 2) + 3;
  const s = new Spr(w, sh + 5, Math.floor(w / 2), sh + 4);
  for (let k = 0; k < sh; k++) s.set(s.ax, s.ay - k, k % 2 ? hx('#d8d0bc') : hx('#bcb4a0'));
  const pal = rng.next() < 0.5 ? PAL.mush : PAL.mush2;
  const cy0 = s.ay - sh;
  for (let y = Math.floor(cy0 - cr * 0.7); y <= cy0; y++) for (let x = Math.floor(s.ax - cr); x <= s.ax + cr + 1; x++) {
    const nx = (x - s.ax) / cr, ny = (y - cy0) / (cr * 0.7);
    if (nx * nx + ny * ny > 1.05) continue;
    const l = 0.6 - nx * 0.3 - ny * 0.2 - (y === cy0 ? 0.35 : 0);
    s.set(x, y, pal[clamp(Math.floor(l * 4 + bayer(x, y)), 0, 4)], 0);
  }
  for (let k = 0; k < 3; k++) { const x = Math.round(s.ax + rng.range(-cr + 0.5, cr - 0.5)), y = Math.round(cy0 - rng.range(0.5, cr * 0.6)); if (s.has(x, y)) s.set(x, y, hx('#b0fff2'), TAG.glow); }
  return s;
}
function bush(rng: Rng, pal: C[], flowers?: C): Spr {
  const s = new Spr(6, 5, 3, 4);
  for (let y = 1; y <= 4; y++) for (let x = 0; x < 6; x++) {
    const nx = (x - 2.5) / 2.6, ny = (y - 2.8) / 1.8;
    if (nx * nx + ny * ny > 1 + (hash2(x, y, Math.floor(rng.next() * 99)) - 0.5) * 0.4) continue;
    s.set(x, y, pal[clamp(Math.floor((0.6 - nx * 0.3 - ny * 0.4) * (pal.length - 1) + bayer(x, y)), 0, pal.length - 1)], TAG.crown);
  }
  if (flowers) for (let k = 0; k < 2; k++) { const x = 1 + Math.floor(rng.next() * 4), y = 1 + Math.floor(rng.next() * 2); if (s.has(x, y)) s.set(x, y, flowers); }
  return s;
}
function tussock(rng: Rng): Spr {
  const s = new Spr(5, 4, 2, 3);
  const c = PAL.tuss;
  s.set(1, 3, c[2]); s.set(2, 3, c[2]); s.set(3, 3, c[1]);
  s.set(0, 2, c[4]); s.set(2, 2, c[5]); s.set(4, 2, c[3]); s.set(1, 1, c[5]); s.set(3, 1, c[4]);
  if (rng.next() < 0.5) s.set(2, 0, c[5]);
  return s;
}
function reeds(rng: Rng): Spr {
  const s = new Spr(7, 6, 3, 5);
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(rng.range(0, 7)), h = 2 + Math.floor(rng.next() * 3);
    for (let j = 0; j < h; j++) s.set(x, 5 - j, PAL.reed[j === h - 1 ? 3 : 1 + (j % 2)]);
    if (rng.next() < 0.4) s.set(x, 5 - h, hx('#5a3a1e'));
  }
  return s;
}
function boulder(rng: Rng, r: number, pal: C[]): Spr {
  const w = Math.ceil(r * 2) + 3, sh = Math.ceil(r * 1.6) + 3;
  const s = new Spr(w, sh, Math.floor(w / 2), sh - 1);
  const cy0 = s.ay - r * 0.7;
  for (let y = Math.floor(cy0 - r); y <= cy0 + r * 0.8; y++) for (let x = Math.floor(s.ax - r - 1); x <= s.ax + r + 1; x++) {
    const nx = (x + 0.5 - s.ax - 0.5) / r, ny = (y + 0.5 - cy0) / (r * 0.75);
    const d2 = nx * nx + ny * ny;
    if (d2 > 1 + (hash2(x, y, 34) - 0.5) * 0.25) continue;
    const l = 0.55 - nx * 0.35 - ny * 0.45 + Math.sqrt(Math.max(0, 1 - d2)) * 0.2;
    s.set(x, y, pal[clamp(Math.floor(l * (pal.length - 1) + bayer(x, y) * 0.8), 0, pal.length - 1)]);
  }
  void rng;
  return s;
}
/** a granite tor: boulders stacked into a little tower */
function tor(rng: Rng, n: number): Spr {
  const w = 18, sh = 18;
  const s = new Spr(w, sh, 9, sh - 1);
  const stones: [number, number, number][] = [];
  let y = s.ay - 1.5, wid = 2 + n * 0.6;
  for (let row = 0; row < n; row++) {
    const k = row === 0 ? 2 + Math.floor(rng.next() * 2) : row < n - 1 ? 1 + Math.floor(rng.next() * 2) : 1;
    for (let j = 0; j < k; j++) {
      const r = rng.range(1.3, 2.4) * (1 - row * 0.12);
      stones.push([s.ax + (k === 1 ? rng.range(-0.8, 0.8) : (j - (k - 1) / 2) * wid), y, r]);
    }
    y -= 2.4 - row * 0.1;
    wid *= 0.7;
  }
  for (const [sx, sy, r] of stones) {
    for (let yy = Math.floor(sy - r); yy <= sy + r; yy++) for (let xx = Math.floor(sx - r - 1); xx <= sx + r + 1; xx++) {
      const nx = (xx + 0.5 - sx) / (r * 1.15), ny = (yy + 0.5 - sy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const l = 0.6 - nx * 0.4 - ny * 0.45 + Math.sqrt(1 - d2) * 0.15;
      s.set(xx, yy, PAL.granite[clamp(Math.floor(l * 6 + bayer(xx, yy) * 0.8), 0, 6)]);
    }
    // the crack between stones
    s.set(Math.round(sx + r * 0.9), Math.round(sy + r * 0.4), PAL.granite[0]);
  }
  // lichen
  for (let k = 0; k < 3; k++) { const xx = Math.floor(rng.range(3, 15)), yy = Math.floor(rng.range(4, 16)); if (s.has(xx, yy)) s.set(xx, yy, hx('#b8b46a')); }
  return s;
}
/** a rounded hill of tussock (with a rocky crown) */
function dome(rng: Rng, w: number, h: number, pal: C[]): Spr {
  const W2 = Math.ceil(w) + 4, H2 = Math.ceil(h) + 3;
  const s = new Spr(W2, H2, Math.floor(W2 / 2), H2 - 1);
  const ph = rng.next() * 10;
  for (let x = 0; x < W2; x++) {
    const u = (x + 0.5 - s.ax) / (w / 2);
    if (Math.abs(u) > 1) continue;
    const top = s.ay - h * Math.sqrt(1 - u * u) * (1 + (noise2(x * 0.3 + ph, 0, 35) - 0.5) * 0.25);
    for (let y = Math.ceil(top); y <= s.ay; y++) {
      const v = (s.ay - y) / h;
      const l = 0.55 - u * 0.42 + v * 0.18 - (y >= s.ay - 1 ? 0.2 : 0);
      s.set(x, y, pal[clamp(Math.floor(l * (pal.length - 1) + bayer(x, y) * 0.9), 0, pal.length - 1)]);
    }
  }
  return s;
}
/** a mountain: a jagged silhouette, a lit west face, a shadowed east face, gullies and a snow cap */
function mountain(rng: Rng, w: number, h: number, snowy: boolean): Spr {
  const W2 = Math.ceil(w) + 6, H2 = Math.ceil(h) + 4;
  const s = new Spr(W2, H2, Math.floor(W2 / 2), H2 - 1);
  const base = s.ay, cx0 = s.ax + 0.5;
  const px = cx0 + (rng.next() - 0.5) * w * 0.22, py = base - h;
  const ph = rng.next() * 100;
  const sh1 = rng.range(0.22, 0.4) * (rng.next() < 0.5 ? -1 : 1), sh1h = rng.range(0.12, 0.22);
  const topY = (x: number) => {
    const u = x < px ? (px - x) / (px - (cx0 - w / 2)) : (x - px) / (cx0 + w / 2 - px);
    if (u > 1) return 1e9;
    let y = base - h * Math.pow(1 - u, 1.18);
    y += (noise2(x * 0.4 + ph, 0.5, 36) - 0.5) * h * 0.16 * Math.min(1, u * 3) + (noise2(x * 1.3 + ph, 1.5, 37) - 0.5) * 2.2 * Math.min(1, u * 4);
    const us = (x - (px + sh1 * w)) / (w * 0.12);
    y -= Math.max(0, 1 - us * us) * h * sh1h * u * 2;
    return Math.max(py, y);
  };
  const snowLine = py + h * rng.range(0.28, 0.46);
  for (let x = 0; x < W2; x++) {
    const ty = topY(x + 0.5);
    if (ty > base) continue;
    for (let y = Math.ceil(ty); y <= base; y++) {
      const spine = px + ((y - py) / h) * w * 0.14 + (noise2(y * 0.25 + ph, 2.5, 38) - 0.5) * 3;
      const lit = x + 0.5 < spine;
      const dEdge = y - ty;
      const v = (base - y) / h;
      // gullies: streaks running down and to the east
      const g = noise2((x - y * 0.42) * 0.42 + ph, 3.5, 39);
      const gully = g > 0.7 ? 1 : g < 0.26 ? -1 : 0;
      let c: C;
      if (snowy && y < snowLine + (g - 0.5) * 10 + (hash2(x, y, 40) - 0.5) * 2) {
        c = lit ? PAL.snowL[clamp(Math.floor(2.6 - (spine - x) * 0.04 + bayer(x, y) * 0.8 - (gully > 0 ? 1.2 : 0) - (dEdge < 1 ? 0 : 0)), 0, 3)]
          : PAL.snowD[clamp(Math.floor(1.6 + (x - spine) * 0.06 + bayer(x, y) * 0.8 - (gully > 0 ? 1 : 0)), 0, 2)];
      } else if (lit) {
        const l = 0.45 + v * 0.35 - (spine - x) / w * 0.4 + (gully < 0 ? 0.2 : gully > 0 ? -0.28 : 0) - (y > base - 2 ? 0.2 : 0);
        c = PAL.mtnL[clamp(Math.floor(l * 5 + bayer(x, y) * 0.9), 0, 4)];
      } else {
        const l = 0.35 + (x - spine) / w * 0.5 + (gully < 0 ? 0.3 : 0) - (y > base - 2 ? 0.15 : 0);
        c = PAL.mtnD[clamp(Math.floor(l * 4 + bayer(x, y) * 0.9), 0, 3)];
      }
      if (dEdge < 1 && !lit) c = hx('#1c1c22');
      s.set(x, y, c);
    }
  }
  return s;
}
/** a whare: thatched gable roof, dark walls, a door */
function whare(rng: Rng, big: boolean): Spr {
  if (big) {
    const s = new Spr(13, 10, 6, 9);
    const rows = ['.....rr.....', '....rTTr....', '...rTTTTr...', '..rTTTTTTr..', '.rTTTTTTTTr.', 'rTTTTTTTTTTr', '.pWWWDDWWWp.', '.pWWWDDWWWp.', '.pkkkkkkkkp.'];
    const m: Record<string, C> = { r: hx('#b0281e'), T: PAL.thatch[3], W: PAL.wood[2], D: PAL.wood[0], p: hx('#c8402e'), k: PAL.wood[1] };
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = m[r[x]]; if (c) s.set(x, y, r[x] === 'T' ? PAL.thatch[clamp(4 - Math.floor(x / 4) - (y > 4 ? 1 : 0), 1, 4)] : c); } });
    return s;
  }
  const s = new Spr(8, 7, 3, 6);
  const tall = rng.next() < 0.5;
  const rows = tall ? ['..kk...', '.kTTk..', 'kTTTTk.', 'TTTTTT.', '.WDDW..', '.WDDW..'] : ['.......', '..kk...', '.kTTk..', 'kTTTTk.', '.WDWW..', '.WDWW..'];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.') continue; s.set(x, y, ch === 'k' ? PAL.thatch[1] : ch === 'T' ? PAL.thatch[x < 3 ? 4 : 2] : ch === 'W' ? PAL.wood[x < 2 ? 3 : 2] : PAL.wood[0]); } });
  return s;
}
function tent(): Spr {
  const s = new Spr(11, 8, 5, 7);
  const rows = ['....k......', '...kwk.....', '..kwwlk....', '.kwwwllk...', 'kwwwdllkk..', 'kwwddlllk..', 'kkkkkkkkkk.'];
  const m: Record<string, C> = { k: hx('#5a5244'), w: PAL.canvas[4], l: PAL.canvas[2], d: hx('#2a2420') };
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = m[r[x]]; if (c) s.set(x, y, c); } });
  return s;
}
function wreck(): Spr {
  const s = new Spr(20, 14, 9, 12);
  const hull = PAL.wood, wh = hx('#e8e0cc');
  for (let x = 0; x < 18; x++) {
    const tilt = Math.round(x * 0.22);
    const top = 7 - tilt + (x < 3 ? 2 - x : 0), bot = 11 - Math.round(tilt * 0.5);
    for (let y = top; y <= bot; y++) s.set(x + 1, y, y === top ? hull[4] : y === bot ? hull[0] : x > 13 && y > top + 2 ? hull[1] : hull[2 + ((x + y) % 2)]);
  }
  for (let y = 0; y < 6; y++) s.set(7 + Math.round(y * 0.3), 6 - y, hull[1]);
  for (let y = 0; y < 3; y++) s.set(13, 3 + y, hull[1]);
  s.set(10, 3, wh); s.set(11, 3, wh); s.set(10, 4, wh); s.set(11, 4, hx('#9a9284'));
  s.set(4, 7, hx('#c8402e')); s.set(5, 7, hx('#c8402e'));
  return s;
}
function whaleBones(): Spr {
  const s = new Spr(16, 7, 8, 6);
  const c = PAL.bone;
  for (let x = 0; x < 14; x++) s.set(x + 1, 5, c[x % 2 ? 2 : 3]);
  for (let k = 0; k < 6; k++) { const x = 3 + k * 2; s.set(x, 4, c[3]); s.set(x - 1, 3, c[2]); s.set(x - 1, 2, c[3]); s.set(x, 1, c[2]); }
  s.set(14, 4, c[3]); s.set(15, 4, c[2]); s.set(15, 5, c[1]);
  return s;
}
function seaArch(): Spr {
  const s = new Spr(12, 9, 6, 8);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
    const inArch = x >= 4 && x <= 7 && y >= 4;
    const outer = Math.abs(x - 5.5) / 6 + (y < 3 ? (3 - y) * 0.18 : 0);
    if (outer > 1 || inArch) continue;
    s.set(x, y, PAL.rock[clamp(Math.floor(5 - x * 0.35 - (y > 6 ? 1.2 : 0) + bayer(x, y)), 1, 6)]);
  }
  return s;
}
function volcano(): Spr {
  const s = new Spr(30, 20, 15, 19);
  for (let x = 0; x < 30; x++) {
    const u = (x - 14.5) / 14;
    if (Math.abs(u) > 1) continue;
    const top = 19 - 15 * Math.pow(1 - Math.abs(u), 1.1) + (Math.abs(u) < 0.14 ? 2 : 0);
    for (let y = Math.ceil(top); y < 20; y++) {
      const l = 0.55 - u * 0.5 + (19 - y) / 40;
      s.set(x, y, PAL.basalt[clamp(Math.floor(l * 4 + bayer(x, y) * 0.9), 0, 4)]);
    }
  }
  for (let x = 12; x <= 17; x++) s.set(x, 6, x === 12 || x === 17 ? PAL.basalt[0] : hx('#e8602a'), x > 12 && x < 17 ? TAG.lava : 0);
  s.set(14, 7, hx('#f0a040'), TAG.lava); s.set(15, 7, hx('#e8602a'), TAG.lava);
  for (let k = 0; k < 4; k++) s.set(14 + k * 0.4, 8 + k * 2, hx('#a8401e'), TAG.lava);
  return s;
}
function seaStack(): Spr {
  const s = new Spr(9, 13, 4, 12);
  for (let y = 1; y < 13; y++) for (let x = 0; x < 9; x++) {
    const wd = 2.4 + (y > 9 ? (y - 9) * 0.6 : 0);
    if (Math.abs(x - 4) > wd) continue;
    s.set(x, y, y < 3 ? PAL.bone[3] : PAL.rock[clamp(Math.floor(5 - (x - 2) * 0.8 + bayer(x, y)), 1, 6)]);
  }
  return s;
}
function signpost(): Spr {
  const s = new Spr(7, 9, 3, 8);
  for (let y = 2; y < 9; y++) s.set(3, y, PAL.wood[2]);
  for (let x = 0; x < 6; x++) { s.set(x, 2, PAL.wood[4]); s.set(x, 3, PAL.wood[3]); }
  s.set(6, 2, PAL.wood[4]);
  s.set(1, 5, hx('#c8402e'));
  return s;
}
function bones(rng: Rng): Spr {
  const s = new Spr(7, 4, 3, 3);
  const c = PAL.bone;
  for (let k = 0; k < 6; k++) s.set(k, 2 + (k % 2 ? 0 : 0), c[3]);
  for (let k = 0; k < 3; k++) s.set(1 + k * 2, 1, c[2]);
  if (rng.next() < 0.5) { s.set(6, 1, c[3]); s.set(6, 0, c[2]); }
  return s;
}
function crate(): Spr {
  const s = new Spr(4, 4, 1, 3);
  for (let y = 1; y < 4; y++) for (let x = 0; x < 3; x++) s.set(x, y, y === 1 ? PAL.wood[4] : x === 2 ? PAL.wood[1] : PAL.wood[3]);
  return s;
}
function fireRing(): Spr {
  const s = new Spr(5, 3, 2, 2);
  s.set(0, 1, PAL.rock[4]); s.set(4, 1, PAL.rock[4]); s.set(1, 2, PAL.rock[3]); s.set(3, 2, PAL.rock[3]); s.set(2, 2, PAL.rock[4]);
  s.set(1, 1, hx('#e86a2a')); s.set(2, 1, hx('#f8c24a')); s.set(3, 1, hx('#d04a20')); s.set(2, 0, hx('#f0902e'));
  return s;
}
function rack(): Spr {
  const s = new Spr(7, 6, 3, 5);
  for (let y = 1; y < 6; y++) { s.set(0, y, PAL.wood[2]); s.set(6, y, PAL.wood[2]); }
  for (let x = 0; x < 7; x++) s.set(x, 1, PAL.wood[3]);
  s.set(2, 2, hx('#c8b8a0')); s.set(2, 3, hx('#9a8a74')); s.set(4, 2, hx('#7a8aa0')); s.set(4, 3, hx('#7a8aa0'));
  return s;
}
function palisade(len: number, vertical = false): Spr {
  const s = new Spr(vertical ? 3 : len, vertical ? len : 4, 0, vertical ? len - 1 : 3);
  for (let k = 0; k < len; k += 2) {
    if (vertical) { s.set(1, k, PAL.wood[2]); s.set(1, k + 1, PAL.wood[1]); }
    else { s.set(k, 3, PAL.wood[1]); s.set(k, 2, PAL.wood[2]); s.set(k, 1, PAL.wood[3]); }
  }
  return s;
}
function waka(): Spr {
  const s = new Spr(9, 3, 4, 2);
  for (let x = 1; x < 8; x++) { s.set(x, 1, PAL.wood[3]); s.set(x, 2, PAL.wood[1]); }
  s.set(0, 0, hx('#b0281e')); s.set(8, 0, hx('#b0281e')); s.set(0, 1, PAL.wood[2]); s.set(8, 1, PAL.wood[2]);
  return s;
}

// ------------------------------------------------------------------ placing everything
const TREE = { ink: 3 };
async function features(cx: Ctx) {
  const { land, cd, bio, bw, water } = cx;
  const feats: Feat[] = [];
  const add = (x: number, y: number, f: () => void, z = 0) => feats.push({ x, y, z, f });
  const at = (x: number, y: number) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return -1;
    return y * W + x;
  };
  const dry = (i: number) => i >= 0 && land[i] && !water[i] && !water[i - 1] && !water[i + 1] && !water[i + W];
  const near = (x: number, y: number, pts: readonly (readonly number[])[], r: number) => pts.some(p => Math.hypot(x - p[0], y - p[1]) < r);
  // keep the trees out of clearings: landmarks, wallows, pools, the village
  const clear: [number, number, number][] = [
    [LM.tent[0] + 4, LM.tent[1], 13], [LM.wreck[0], LM.wreck[1], 9], [LM.village[0], LM.village[1] - 2, 26], [LM.pa[0], LM.pa[1], 24], [LM.sink[0], LM.sink[1], 0],
    ...WALLOWS.map(([x, y, r]) => [x, y, r + 3] as [number, number, number]), [LM.plunge[0], LM.plunge[1], 8], [LM.signpost[0], LM.signpost[1], 4], [LM.whale[0], LM.whale[1], 9],
  ];
  const inClear = (x: number, y: number) => clear.some(([cx0, cy0, r]) => Math.hypot(x - cx0, (y - cy0) * 1.3) < r);
  const sinkK = (x: number, y: number) => Math.hypot((x - LM.sink[0]) / 44, (y - LM.sink[1]) / 21);

  // ---- trees, scattered on a jittered grid; denser deep inside their biome
  const step = 4;
  for (let gy = 0; gy < H; gy += step) {
    if ((gy & 31) === 0) await slice();
    for (let gx = 0; gx < W; gx += step) {
      const x = gx + hash2(gx, gy, 101) * step, y = gy + hash2(gx, gy, 102) * step;
      const i = at(x, y);
      if (i < 0 || !dry(i)) continue;
      const b = bio[i] as B, dep = bw[i], r0 = hash2(gx, gy, 103), r1 = hash2(gx, gy, 104);
      const rng = new Rng((gx * 73856093) ^ (gy * 19349663) ^ 0x5eed);
      if (inClear(x, y)) continue;
      const dens = (base: number) => r0 < base * clamp(0.25 + dep * 1.4);
      switch (b) {
        case B.forest: {
          if (!dens(0.95)) break;
          const k = r1;
          if (k < 0.5) { const hh = 7 + Math.floor(rng.next() * 4); add(x, y, () => stamp(cx, conifer(rng, hh, 2.4 + rng.next() * 0.9, PAL.con), x, y, TREE)); }
          else if (k < 0.88) add(x, y, () => stamp(cx, broadleaf(rng, 2.4 + rng.next() * 1.1, PAL.brd), x, y, TREE));
          else if (k < 0.97) add(x, y, () => stamp(cx, treeFern(rng, 0.6), x, y, TREE));
          else add(x, y, () => stamp(cx, kauri(rng, 0.8), x, y, TREE));
          break;
        }
        case B.fern: {
          if (!dens(0.95)) break;
          if (r1 < 0.62) add(x, y, () => stamp(cx, treeFern(rng, 0.5 + rng.next()), x, y, TREE));
          else if (r1 < 0.9) add(x, y, () => stamp(cx, broadleaf(rng, 2.2 + rng.next(), PAL.brd, 0.05), x, y, TREE));
          else add(x, y, () => stamp(cx, conifer(rng, 8, 2.6, PAL.con), x, y, TREE));
          break;
        }
        case B.canopy: {
          if (!dens(0.9) || (gx / step + gy / step) % 2 === 1 && r1 < 0.35) break;
          if (r1 < 0.36) add(x, y, () => stamp(cx, kauri(rng, 0.7 + rng.next() * 0.9), x, y, TREE));
          else if (r1 < 0.8) add(x, y, () => stamp(cx, broadleaf(rng, 2.6 + rng.next() * 1.2, PAL.kauri), x, y, TREE));
          else add(x, y, () => stamp(cx, treeFern(rng, 0.8), x, y, TREE));
          break;
        }
        case B.beech: {
          if (!dens(0.92)) break;
          if (r1 < 0.72) add(x, y, () => stamp(cx, broadleaf(rng, 1.9 + rng.next() * 0.9, PAL.beech, 0.05, 1), x, y, TREE));
          else if (r1 < 0.9) add(x, y, () => stamp(cx, conifer(rng, 7, 2.2, PAL.con, 0.05), x, y, TREE));
          else add(x, y, () => stamp(cx, broadleaf(rng, 2.6, PAL.brd), x, y, TREE));
          break;
        }
        case B.swamp: {
          if (r0 > 0.42) break;
          // mangroves along the channels, dead snags and reeds in the mud
          let wet = false;
          for (let k = 0; k < 8 && !wet; k++) { const j = at(x + Math.cos(k) * 4, y + Math.sin(k) * 3); if (j >= 0 && water[j]) wet = true; }
          if (wet && r1 < 0.7) add(x, y, () => stamp(cx, mangrove(rng), x, y, TREE));
          else if (r1 < 0.8) add(x, y, () => stamp(cx, reeds(rng), x, y));
          else if (r1 < 0.9) add(x, y, () => stamp(cx, snag(rng), x, y));
          else add(x, y, () => stamp(cx, broadleaf(rng, 2.2, PAL.mang), x, y, TREE));
          break;
        }
        case B.glow: {
          if (!dens(0.9)) break;
          if (r1 < 0.62) add(x, y, () => stamp(cx, glowTree(rng), x, y, TREE));
          else if (r1 < 0.9) add(x, y, () => stamp(cx, mushroom(rng), x, y, TREE));
          else add(x, y, () => stamp(cx, treeFern(rng, 0.4), x, y, TREE));
          break;
        }
        case B.scrub: {
          if (r0 > 0.42) break;
          const north = y < 140 && x < 480;
          if (north && r1 < 0.16) add(x, y, () => stamp(cx, pohutukawa(rng), x, y, TREE));
          else if (north && r1 < 0.3 && x > 190 && x < 240) add(x, y, () => stamp(cx, palm(rng), x, y, TREE));
          else if (r1 < 0.75) add(x, y, () => stamp(cx, bush(rng, PAL.mang, hx('#f2eee2')), x, y, TREE));
          else add(x, y, () => stamp(cx, broadleaf(rng, 2.2, PAL.brd, 0.08), x, y, TREE));
          break;
        }
        case B.dunes: if (r0 < 0.1) add(x, y, () => stamp(cx, tussock(rng), x, y)); break;
        case B.meadow: case B.plain: {
          if (r0 < 0.045) add(x, y, () => stamp(cx, broadleaf(rng, 2 + rng.next() * 1.4, b === B.plain ? PAL.beech : PAL.brd, 0.08), x, y, TREE));
          else if (r0 < 0.07) add(x, y, () => stamp(cx, bush(rng, PAL.brd), x, y, TREE));
          else if (b === B.plain && r0 < 0.16) add(x, y, () => stamp(cx, tussock(rng), x, y));
          break;
        }
        case B.hills: {
          if (r0 < 0.14) add(x, y, () => stamp(cx, tussock(rng), x, y));
          else if (r0 < 0.17) add(x, y, () => stamp(cx, boulder(rng, 1.2 + rng.next(), PAL.granite), x, y));
          else if (r0 < 0.19 && dep < 0.5) add(x, y, () => stamp(cx, conifer(rng, 6, 2, PAL.con, 0.05), x, y, TREE));
          break;
        }
        case B.mountain: if (r0 < 0.05) add(x, y, () => stamp(cx, boulder(rng, 1 + rng.next(), PAL.rock), x, y)); else if (r0 < 0.1 && dep < 0.3) add(x, y, () => stamp(cx, conifer(rng, 6, 2, PAL.con), x, y, TREE)); break;
        case B.thermal: if (r0 < 0.025) add(x, y, () => stamp(cx, snag(rng), x, y)); break;
        case B.terraces: if (r0 < 0.12 && Math.hypot(x - LM.pa[0], y - LM.pa[1]) > 20) add(x, y, () => stamp(cx, broadleaf(rng, 2.4, PAL.brd), x, y, TREE)); break;
        case B.garden: break;
        case B.sink: {
          const k = sinkK(x, y);
          if (k < 1.05) break;
          if (r0 < 0.8) add(x, y, () => stamp(cx, r1 < 0.6 ? treeFern(rng, 0.6) : broadleaf(rng, 2.3, PAL.brd), x, y, TREE));
          break;
        }
        default: break;
      }
    }
  }
  // the islets: a little forest and a beach
  const [ix, iy, ir] = ISLETS[0];
  for (let k = 0; k < 70; k++) {
    const a = hash2(k, 1, 7) * Math.PI * 2, rr = Math.sqrt(hash2(k, 2, 7)) * (ir - 7);
    const x = ix + Math.cos(a) * rr, y = iy + Math.sin(a) * rr * 0.85;
    const i = at(x, y);
    if (i < 0 || !land[i] || cd[i] < 4) continue;
    const rng = new Rng(k * 977 + 3);
    add(x, y, () => stamp(cx, rng.next() < 0.5 ? conifer(rng, 7, 2.4, PAL.con) : rng.next() < 0.7 ? broadleaf(rng, 2.4, PAL.brd) : palm(rng), x, y, TREE));
  }
  // ---- the rocky hills: domes crowned with tors, scree fans, a cairn
  for (let gy = 140; gy < 250; gy += 15) for (let gx = 488; gx < 664; gx += 19) {
    const x = gx + hash2(gx, gy, 111) * 12, y = gy + hash2(gx, gy, 112) * 10;
    const i = at(x, y);
    if (i < 0 || bio[i] !== B.hills || water[i]) continue;
    const rng = new Rng(gx * 31 + gy * 977);
    const w = 14 + rng.next() * 14, h = 6 + rng.next() * 6;
    add(x, y, () => {
      stamp(cx, dome(rng, w, h, PAL.tuss), x, y);
      if (rng.next() < 0.75) stamp(cx, tor(rng, 2 + Math.floor(rng.next() * 3)), x + rng.range(-w * 0.2, w * 0.2), y - h + 2);
      if (rng.next() < 0.45) scree(cx, rng, x + w * 0.3, y - h * 0.4, 4 + rng.next() * 4);
    });
  }
  for (let k = 0; k < 26; k++) {
    const x = 500 + hash2(k, 3, 113) * 150, y = 150 + hash2(k, 4, 113) * 90;
    const i = at(x, y);
    if (i < 0 || bio[i] !== B.hills || water[i]) continue;
    const rng = new Rng(k * 7919 + 11);
    add(x, y, () => stamp(cx, tor(rng, 1 + Math.floor(rng.next() * 3)), x, y));
  }
  // ---- the range, ridge by ridge, and foothills at its feet
  for (const rd of RIDGES) {
    const p = rd.pts;
    let acc = 0;
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      const seg = Math.hypot(bx - ax, by - ay);
      for (let t = 0; t < seg;) {
        const u = t / seg;
        const sw = rd.size[i - 1][0] + (rd.size[i][0] - rd.size[i - 1][0]) * u, shh = rd.size[i - 1][1] + (rd.size[i][1] - rd.size[i - 1][1]) * u;
        const rng = new Rng(Math.floor(ax * 13 + ay * 7 + t * 101 + acc));
        const w = sw * rng.range(0.82, 1.12), hh = shh * rng.range(0.82, 1.12);
        const x = ax + (bx - ax) * u + rng.range(-5, 5), y = ay + (by - ay) * u + rng.range(-4, 4) + hh * 0.35;
        const snowy = hh > 27;
        add(x, y, () => stamp(cx, mountain(rng, w, hh, snowy), x, y, { occ: 1 }));
        // smaller peaks tucked in front
        if (rng.next() < 0.6) { const w2 = w * 0.55, h2 = hh * 0.5, x2 = x + rng.range(-w * 0.5, w * 0.5), y2 = y + rng.range(5, 10); add(x2, y2, () => stamp(cx, mountain(rng, w2, h2, h2 > 27), x2, y2, { occ: 1 })); }
        t += w * 0.5;
      }
      acc += seg;
    }
  }
  for (let k = 0; k < 60; k++) {
    const x = 640 + hash2(k, 5, 114) * 250, y = 110 + hash2(k, 6, 114) * 330;
    const i = at(x, y);
    if (i < 0 || bio[i] !== B.mountain || water[i]) continue;
    const rng = new Rng(k * 104729 + 5);
    if (bw[i] < 0.35) { const w = 12 + rng.next() * 12, h = 6 + rng.next() * 5; add(x, y, () => stamp(cx, dome(rng, w, h, GROUND[B.plain]), x, y)); }
    else { const w = 18 + rng.next() * 14, h = 14 + rng.next() * 12; add(x, y, () => stamp(cx, mountain(rng, w, h, false), x, y, { occ: 1 })); }
  }
  // ---- landmarks
  const lm = (x: number, y: number, f: () => void, z = 0) => add(x, y, f, z);
  lm(LM.tent[0], LM.tent[1], () => stamp(cx, tent(), LM.tent[0], LM.tent[1]));
  lm(LM.fire[0], LM.fire[1], () => stamp(cx, fireRing(), LM.fire[0], LM.fire[1], { noEdge: true }));
  lm(LM.tent[0] - 7, LM.tent[1] + 2, () => { stamp(cx, crate(), LM.tent[0] - 7, LM.tent[1] + 2); stamp(cx, crate(), LM.tent[0] - 4, LM.tent[1] + 3); });
  lm(LM.tent[0] + 15, LM.tent[1] - 1, () => stamp(cx, rack(), LM.tent[0] + 15, LM.tent[1] - 1));
  lm(LM.wreck[0], LM.wreck[1], () => stamp(cx, wreck(), LM.wreck[0], LM.wreck[1]));
  lm(LM.whale[0], LM.whale[1], () => stamp(cx, whaleBones(), LM.whale[0], LM.whale[1]));
  lm(LM.arch[0], LM.arch[1], () => stamp(cx, seaArch(), LM.arch[0], LM.arch[1]));
  lm(LM.volcano[0], LM.volcano[1] + 8, () => stamp(cx, volcano(), LM.volcano[0], LM.volcano[1] + 8));
  lm(LM.stack[0], LM.stack[1] + 5, () => stamp(cx, seaStack(), LM.stack[0], LM.stack[1] + 5));
  lm(700, 76, () => stamp(cx, seaStack(), 700, 76)); lm(732, 70, () => stamp(cx, seaStack(), 732, 70));
  lm(LM.signpost[0], LM.signpost[1], () => stamp(cx, signpost(), LM.signpost[0], LM.signpost[1]));
  // the glowworm cave: a dark mouth in the headland
  lm(LM.cave[0], LM.cave[1], () => { for (let y = -4; y <= 0; y++) for (let x = -3; x <= 3; x++) if (x * x / 9 + (y + 0.5) * (y + 0.5) / 16 < 1) { const i = at(LM.cave[0] + x, LM.cave[1] + y); if (i >= 0) { cx.col[i] = y > -1 ? hx('#120c0a') : hx('#1e1814'); cx.edge[i] = 0; } } });
  // seal rocks
  for (const [x, y, r] of [[272, 104, 2.4], [279, 102, 3], [285, 105, 2.2], [276, 108, 1.8]] as [number, number, number][]) lm(x, y, () => stamp(cx, boulder(new Rng(x), r, PAL.basalt), x, y));
  // the village: the wharenui facing the marae, whare around it, a palisade, waka on the bank, gardens
  village(cx, add);
  pa(cx, add);
  sinkhole(cx, add);
  thermalTerraces(cx, add);
  gorgeBones(cx, add);
  // the tableland: a few emergent giants on its rim
  for (let k = 0; k < 9; k++) {
    const x = 310 + k * 19 + hash2(k, 1, 115) * 8, y = 226 + hash2(k, 2, 115) * 6;
    const rng = new Rng(k * 31337);
    if (!dry(at(x, y))) continue;
    add(x, y, () => stamp(cx, kauri(rng, 1.4 + rng.next() * 0.6), x, y, TREE));
  }
  await slice();
  // back to front
  feats.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  for (let k = 0; k < feats.length; k++) {
    feats[k].f();
    if ((k & 255) === 0) await slice();
  }
}

/** grey scree spilling down a slope */
function scree(cx: Ctx, rng: Rng, x0: number, y0: number, len: number) {
  for (let k = 0; k < len * 6; k++) {
    const t = rng.next(), x = Math.round(x0 + t * len * 0.6 + rng.range(-t * 2.5, t * 2.5)), y = Math.round(y0 + t * len);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (!cx.land[i]) continue;
    cx.col[i] = PAL.granite[rng.next() < 0.5 ? 4 : rng.next() < 0.5 ? 5 : 2];
    cx.edge[i] = 0;
  }
}

function village(cx: Ctx, add: (x: number, y: number, f: () => void, z?: number) => void) {
  const [vx, vy] = LM.village;
  // gardens: kūmara rows in plots
  for (let gy = vy - 22; gy < vy + 24; gy++) for (let gx = vx - 46; gx < vx + 46; gx++) {
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
    const i = gy * W + gx;
    if (cx.bio[i] !== B.garden || cx.water[i] || Math.hypot(gx - vx, (gy - vy + 2) * 1.3) < 27) continue;
    const pxl = Math.floor((gx + gy * 0.14) / 10), pyl = Math.floor(gy / 7);
    const kind = Math.floor(hash2(pxl, pyl, 121) * 4);
    const lx = (gx + gy * 0.14) % 10, ly = gy % 7;
    if (lx < 1 || ly < 1) { cx.col[i] = hx('#9a8456'); continue; }
    cx.col[i] = kind === 0 ? (ly % 2 ? hx('#5e7a2e') : hx('#7a5a32')) : kind === 1 ? (hash2(gx, gy, 3) > 0.6 ? hx('#3e6a2a') : hx('#6a8a3a')) : kind === 2 ? (ly % 2 ? hx('#a89a4a') : hx('#8a7a3a')) : hx('#6e4e2e');
  }
  // the marae: open beaten ground
  for (let y = -10; y <= 10; y++) for (let x = -16; x <= 16; x++) {
    if (x * x / 256 + y * y / 100 > 1) continue;
    const i = (vy + 2 + y) * W + vx + x;
    if (!cx.water[i]) cx.col[i] = dith(vx + x, vy + y, [hx('#8a7a52'), hx('#9a8a5e'), hx('#a8986a')], 0.5 + (hash2(x, y, 5) - 0.5) * 0.6);
  }
  const rng = new Rng(4242);
  add(vx - 1, vy - 7, () => stamp(cx, whare(rng, true), vx - 1, vy - 7));
  const spots: [number, number][] = [[-15, -6], [-20, 2], [-13, 10], [12, -6], [18, 2], [13, 11], [-3, 14], [5, 15], [-24, -8], [23, -9]];
  for (const [dx, dy] of spots) { const x = vx + dx, y = vy + dy; add(x, y, () => stamp(cx, whare(rng, false), x, y)); }
  // the pātaka: a storehouse up on a post
  add(vx + 7, vy - 6, () => { const s = new Spr(5, 7, 2, 6); for (let y = 3; y < 7; y++) s.set(2, y, PAL.wood[2]); for (let x = 0; x < 5; x++) { s.set(x, 1, PAL.thatch[3]); s.set(x, 2, PAL.wood[3]); } s.set(2, 0, PAL.thatch[4]); stamp(cx, s, vx + 7, vy - 6); });
  // the palisade ring, open to the river in the south
  for (let a = 0; a < 360; a += 4) {
    const t = (a * Math.PI) / 180;
    if (t > Math.PI * 0.32 && t < Math.PI * 0.62) continue;
    const x = vx + Math.cos(t) * 31, y = vy + 2 + Math.sin(t) * 19;
    add(x, y, () => { const i = Math.round(y) * W + Math.round(x); if (cx.land[i] && !cx.water[i]) { cx.col[i] = PAL.wood[1]; cx.col[i - W] = PAL.wood[3]; cx.edge[i] = 1; } }, -1);
  }
  add(LM.village[0] - 12, LM.village[1] + 12, () => stamp(cx, waka(), 194, 368));
}

function pa(cx: Ctx, add: (x: number, y: number, f: () => void, z?: number) => void) {
  const [px, py] = LM.pa;
  add(px, py + 12, () => {
    const rng = new Rng(777);
    // the hill, terraced in rings of stone
    for (let y = -22; y <= 14; y++) for (let x = -22; x <= 22; x++) {
      const k = Math.hypot(x / 21, y / 17);
      if (k > 1) continue;
      const gx = px + x, gy = py + y;
      const i = gy * W + gx;
      if (cx.water[i]) continue;
      const ring = Math.floor(k * 5 + (hash2(gx, gy, 9) - 0.5) * 0.2);
      const f = (k * 5) % 1;
      let c: C = dith(gx, gy, GROUND[B.terraces], clamp(0.75 - k * 0.3 - x / 60));
      if (f > 0.8) c = PAL.granite[f > 0.92 ? 1 : 4 + ((gx + ring) % 2)];
      if (ring === 0) c = dith(gx, gy, [hx('#7a8a56'), hx('#8a9a62')], 0.5);
      cx.col[i] = c;
      cx.edge[i] = f > 0.9 ? 1 : 0;
    }
    // broken walls and the carved gateway
    for (let k = 0; k < 7; k++) { const a = rng.range(0, Math.PI * 2); stamp(cx, boulder(rng, 1.2, PAL.granite), px + Math.cos(a) * 14, py + Math.sin(a) * 10); }
    for (const dx of [-3, 3]) for (let y = 0; y < 5; y++) { const i = (py + 15 - y) * W + px + dx; cx.col[i] = y === 4 ? hx('#e05a3a') : hx('#a8281e'); cx.edge[i] = 1; }
    for (let x = -3; x <= 3; x++) { const i = (py + 10) * W + px + x; cx.col[i] = hx('#c8402e'); }
  });
}

function sinkhole(cx: Ctx, add: (x: number, y: number, f: () => void, z?: number) => void) {
  const [sx, sy] = LM.sink;
  add(sx, sy - 2, () => {
    const rx = 40, ry = 18;
    for (let y = -ry - 3; y <= ry + 3; y++) for (let x = -rx - 3; x <= rx + 3; x++) {
      const gx = sx + x, gy = sy + y, i = gy * W + gx;
      const k = Math.hypot(x / rx, y / ry) + (fbm2(gx * 0.15, gy * 0.15, 2, 131) - 0.5) * 0.16;
      if (k > 1.08) continue;
      if (k > 1) { cx.col[i] = hx('#1e3a20'); cx.edge[i] = 1; continue; }
      // the far wall shows (it faces us); the floor is a dark lake in mist
      const wall = y < 0 ? 1 - k : 0;
      const depthK = 1 - k;
      let c: C;
      if (y < -ry * 0.25 && k > 0.45) {
        const t = clamp((k - 0.45) / 0.55);
        c = pick([hx('#1a1814'), hx('#26221c'), hx('#343026'), hx('#433e32'), hx('#544e40')], clamp(t * 0.9 + (hash2(gx, 1, 3) > 0.6 ? -0.2 : 0) + (hash2(gx, gy, 4) - 0.5) * 0.15));
        if (hash2(gx, gy, 6) > 0.93) c = hx('#2e5a2a');
      } else if (k > 0.86) c = pick([hx('#2a2a22'), hx('#3a382e')], hash2(gx, gy, 7));
      else {
        const lk = Math.hypot(x / 27, (y - 4) / 9);
        c = lk < 1 ? dith(gx, gy, [hx('#0c1e20'), hx('#102628'), hx('#163030'), hx('#1e3c3a')], clamp(0.6 - lk * 0.5 + (hash2(gx, gy, 8) - 0.5) * 0.3)) : dith(gx, gy, [hx('#0a0a08'), hx('#121410'), hx('#1a1c16')], clamp(depthK + 0.2));
        if (lk < 1) cx.water[i] = WK.lake;
      }
      void wall;
      cx.col[i] = c;
      cx.edge[i] = 0;
    }
    // the stream from the hot valley falls in from the east rim
    for (let y = 0; y < 10; y++) { const i = (sy - 6 + y) * W + sx + 33 - Math.floor(y / 3); cx.col[i] = y % 2 ? hx('#dcecf2') : hx('#ffffff'); cx.water[i] = WK.fall; }
  });
}

function thermalTerraces(cx: Ctx, add: (x: number, y: number, f: () => void, z?: number) => void) {
  // silica terraces cascading down to the south-west, turquoise pools on each step
  add(640, 432, () => {
    for (let s = 0; s < 6; s++) {
      const x0 = 628 + s * 5, y0 = 422 + s * 3;
      for (let x = -9; x <= 9; x++) {
        const lip = Math.round(y0 + Math.abs(x) * 0.18 + Math.sin(x * 0.9 + s) * 0.6);
        for (let y = lip - 3; y <= lip; y++) {
          const i = y * W + x0 + x;
          if (!cx.land[i]) continue;
          cx.col[i] = y === lip ? PAL.silica[3] : y === lip - 1 ? PAL.silica[2] : dith(x0 + x, y, PAL.hot, 0.55 + (hash2(x, y, s) - 0.5) * 0.4);
          if (y < lip - 1) cx.water[i] = WK.pool;
          cx.edge[i] = y === lip ? 1 : 0;
        }
      }
    }
  });
  // vents: dark mouths ringed with sulphur
  for (const [x, y] of [[626, 400], [644, 392], [660, 407], [676, 398], [651, 418]] as [number, number][]) {
    add(x, y, () => { for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const i = (y + dy) * W + x + dx; if (!cx.water[i]) cx.col[i] = Math.abs(dx) + Math.abs(dy) <= 1 ? hx('#2a1e14') : PAL.sulphur[2]; } });
  }
}

function gorgeBones(cx: Ctx, add: (x: number, y: number, f: () => void, z?: number) => void) {
  for (let k = 0; k < 7; k++) {
    const x = 556 + k * 12 + hash2(k, 1, 141) * 6, y = 270 - k * 4 + (k % 2 ? -7 : 6);
    const i = Math.round(y) * W + Math.round(x);
    if (cx.bio[i] !== B.gorge || cx.water[i]) continue;
    const rng = new Rng(k * 1777);
    add(x, y, () => stamp(cx, bones(rng), x, y));
  }
}

// ------------------------------------------------------------------ the pen sketch
async function sketch(cx: Ctx, paper: Uint32Array): Promise<Uint32Array> {
  const { col, edge, land, water, cd } = cx;
  const ink = new Uint32Array(W * H);
  const dark = INK, mid = INK2, light = INK3, blue = hx('#2a4a62');
  for (let y = 1; y < H - 1; y++) {
    if ((y & 15) === 0) await slice();
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!paper[i]) continue;
      const e = edge[i];
      if (land[i] && cd[i] <= 1.3) { ink[i] = dark; continue; }
      if (e === 1) { ink[i] = dark; continue; }
      if (e === 2) { ink[i] = blue; continue; }
      if (e === 3) { ink[i] = mid; continue; }
      const c = col[i];
      const L = lumOf(c);
      if (!land[i] || water[i] === WK.sea) {
        // the sea: ripples along the shore, sparse strokes further out
        if (cd[i] < 2.2 || (Math.abs(cd[i] - 5) < 0.5 && hash2(x >> 2, y >> 2, 9) < 0.7)) ink[i] = light;
        else if (L > 0.27 && hash2(x, y, 151) < 0.5) ink[i] = light;
        continue;
      }
      if (water[i] === WK.river || water[i] === WK.lake || water[i] === WK.pool) { if ((x + y) % 3 === 0) ink[i] = blue; continue; }
      if (water[i] === WK.channel) { if ((x + y * 2) % 4 === 0) ink[i] = mid; continue; }
      // neighbour contrast picks up the silhouettes the stamps did not mark; shadows get pen hatching
      const l2 = lumOf(col[i + 1]), l3 = lumOf(col[i + W]);
      if (L + 0.26 < Math.max(l2, l3)) { ink[i] = mid; continue; }
      if (L < 0.11) { if ((x + y) % 4 === 0) ink[i] = mid; }
      else if (L < 0.2) { if ((x + y) % 6 === 0) ink[i] = light; }
    }
  }
  return ink;
}

// ------------------------------------------------------------------ glyphs for finds
/** 1-char palette: k ink, w paper, r red, g green, b blue, y gold, s stone, d dark, l light ink, m moss, o orange, c cyan, p pink */
const GP: Record<string, C> = {
  k: INK, w: hex('#f6ead0'), r: INK_RED, g: hex('#4f8a3a'), b: INK_BLUE, y: hex('#e0a818'), s: hex('#9a9484'), d: hex('#1c120a'), l: INK3,
  m: hex('#6e8a44'), o: hex('#d8783a'), c: hex('#3fd1c1'), p: hex('#d87a8a'), t: hex('#b88a52'), n: hex('#7a5430'),
};
const glyph = (rows: string[]): PixelBuffer => {
  const b = new PixelBuffer(rows[0].length, rows.length);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = GP[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return b;
};
/** 7px symbols for discoveries on the map */
export const MARKS: Record<string, PixelBuffer> = {
  artifact: glyph(['...k...', '..kyk..', '.kyyyk.', 'kyywyyk', '.kyyyk.', '..kyk..', '...k...']),
  fossil: glyph(['.kkkkk.', 'kwwwwwk', 'kwkkkwk', 'kwkwkwk', 'kwwkwwk', '.kkkwk.', '....k..']),
  sample: glyph(['.kkkkk.', '..kwk..', '.kwwwk.', 'kwbbbwk', 'kbbbbbk', 'kbbbbbk', '.kkkkk.']),
  plant: glyph(['....kk.', '...kgk.', '..kggk.', '.kggk..', 'kggk...', '.kk....', 'k......']),
  landmark: glyph(['...k...', '..kyk..', 'kkyyykk', '.kyyyk.', '.kykyk.', 'kk...kk', '.......']),
  ecosystem: glyph(['...c...', '.c.k.c.', '..kwk..', 'ckwwwkc', '..kwk..', '.c.k.c.', '...c...']),
  cave: glyph(['.kkkkk.', 'kssssk.', 'ksdddsk', 'ksdddsk', 'kkkkkkk', '.......', '.......']),
  village: glyph(['...k...', '..krk..', '.krrrk.', 'krkkkrk', '.ktdtk.', '.ktdtk.', '.kkkkk.']),
  ruin: glyph(['k...k..', 'ks..sk.', 'ks.ksk.', 'kskksk.', 'ksssssk', 'kkkkkkk', '.......']),
  note: glyph(['kkkkkk.', 'kwwwwk.', 'kwllwk.', 'kwwwwk.', 'kwllwkk', 'kwwwwwk', 'kkkkkkk']),
};
export { BIOME_N };

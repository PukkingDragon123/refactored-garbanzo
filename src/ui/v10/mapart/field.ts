// Region Map ground fields (map pixels, north up, before the 3/4 lift): the land (the coastline
// roughened, coves and headlands, the islets), the distance to the coast, what kind of shore each
// stretch is, the biomes, the relief (height in pixels of lift: beaches and dunes, sea cliffs,
// plateaus with sheer edges, the pā's terraces, rolling bush, the ridged range, sunken valleys, the
// sinkhole), the rivers cut into it (a falling water level from source to mouth, banks, gorges) and
// the lakes and pools. Coarse noise lives on an 8 px grid and is sampled bilinearly; the relief is
// built at half resolution and refined where it matters.

import { fbm2, noise2, hash2, clamp, smoothstep } from '../../../core/math';
import { COAST, ISLETS, RIVERS } from '../../../game/v10/atlasgeo';
import { B, SHAPES, SHORE_PTS, COAST_EDITS, RELIEF, RANGE, RANGE_E, EXTRA_RIVERS, LM, WALLOWS, POOLS } from '../mapgeo';
import type { Shape, Shore } from '../mapgeo';
import { W, H, N, WK, slice } from './kit';

export interface Fields {
  land: Uint8Array;
  /** distance to the coast (either side), ground px */
  cd: Float32Array;
  bio: Uint8Array;
  /** surface height (pixels of lift): land, the water's surface on rivers and lakes, 0 on the sea */
  hgt: Float32Array;
  wat: Uint8Array;
  flow: Uint8Array;
  /** distance to the nearest river's centre line (ground px; 255 far) */
  rd: Uint8Array;
  /** 0 none, 1 beach, 2 rock, 3 cliff, 4 mangrove (the shore stretch a pixel belongs to) */
  shore: Uint8Array;
  /** coarse noise (0..1) sampled per pixel: a low frequency patch field */
  patch: Float32Array;
}

// ------------------------------------------------------------------ coarse noise grids
const CG = 8;
const GW = Math.ceil(W / CG) + 2, GH = Math.ceil(H / CG) + 2;
function grid(fn: (x: number, y: number) => number): Float32Array {
  const g = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) g[j * GW + i] = fn(i * CG, j * CG);
  return g;
}
function sampleG(g: Float32Array, x: number, y: number): number {
  const fx = x / CG, fy = y / CG;
  const i = Math.min(GW - 2, Math.max(0, Math.floor(fx))), j = Math.min(GH - 2, Math.max(0, Math.floor(fy)));
  const u = fx - i, v = fy - j;
  const a = g[j * GW + i], b = g[j * GW + i + 1], c = g[(j + 1) * GW + i], d = g[(j + 1) * GW + i + 1];
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

let warpX: Float32Array | null = null, warpY: Float32Array | null = null, patchG: Float32Array | null = null, bioG: Float32Array | null = null;
function grids() {
  if (warpX) return;
  warpX = grid((x, y) => (fbm2(x * 0.0102, y * 0.0102, 4, 11) - 0.5) * 34);
  warpY = grid((x, y) => (fbm2(x * 0.0102 + 7.3, y * 0.0102 + 3.1, 4, 12) - 0.5) * 34);
  patchG = grid((x, y) => fbm2(x * 0.0075, y * 0.0075, 3, 21));
  bioG = grid((x, y) => fbm2(x * 0.0118, y * 0.0118, 3, 23));
}

// ------------------------------------------------------------------ shores
// the coast's cliff height, beach width, mangrove share and shallow shelf width, blended between the
// anchor points along the coast (inverse distance, the nearest three) and smoothed
const cliffG = new Float32Array(GW * GH), beachG = new Float32Array(GW * GH), mangG = new Float32Array(GW * GH), shelfG = new Float32Array(GW * GH);
let shoreGridsReady = false;
function shoreGrids() {
  if (shoreGridsReady) return;
  shoreGridsReady = true;
  const P = SHORE_PTS;
  const ds = [0, 0, 0], ks = [0, 0, 0];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * CG, y = j * CG;
    ds[0] = ds[1] = ds[2] = 1e18;
    for (let k = 0; k < P.length; k++) {
      const ex = P[k].x - x, ey = P[k].y - y, d = ex * ex + ey * ey;
      if (d < ds[0]) { ds[2] = ds[1]; ks[2] = ks[1]; ds[1] = ds[0]; ks[1] = ks[0]; ds[0] = d; ks[0] = k; }
      else if (d < ds[1]) { ds[2] = ds[1]; ks[2] = ks[1]; ds[1] = d; ks[1] = k; }
      else if (d < ds[2]) { ds[2] = d; ks[2] = k; }
    }
    let c = 0, b = 0, m = 0, sh = 0, wt = 0;
    for (let q0 = 0; q0 < 3; q0++) {
      const w = 1 / (ds[q0] + 400), q = P[ks[q0]];
      c += w * (q.k === 'cliff' || q.k === 'rock' ? q.p : 0);
      b += w * (q.k === 'beach' ? q.p : 0);
      m += w * (q.k === 'mangrove' ? 1 : 0);
      sh += w * (q.k === 'beach' ? 84 : q.k === 'mangrove' ? 56 : q.k === 'rock' ? 38 : 22);
      wt += w;
    }
    const g = j * GW + i;
    cliffG[g] = c / wt; beachG[g] = b / wt; mangG[g] = m / wt; shelfG[g] = sh / wt;
  }
  const blurG = (g: Float32Array, r: number) => {
    const t = new Float32Array(g.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const ii = i + k; if (ii < 0 || ii >= GW) continue; s += g[j * GW + ii]; n++; } t[j * GW + i] = s / n; }
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const jj = j + k; if (jj < 0 || jj >= GH) continue; s += t[jj * GW + i]; n++; } g[j * GW + i] = s / n; }
    }
  };
  blurG(cliffG, 2); blurG(beachG, 2); blurG(mangG, 2); blurG(shelfG, 4);
}
/** the height of the cliffs on the coast near a point (map px) */
export const cliffAt = (x: number, y: number) => { shoreGrids(); return sampleG(cliffG, x, y); };
/** how far the shallows reach out from the coast near a point */
export const shelfAt = (x: number, y: number) => { shoreGrids(); return sampleG(shelfG, x, y); };
/** how wide the beach is near a point (0: no sand) */
export const beachAt = (x: number, y: number) => { shoreGrids(); return sampleG(beachG, x, y); };
export const mangroveAt = (x: number, y: number) => { shoreGrids(); return sampleG(mangG, x, y); };
/** the shore's kind near a point */
export function shoreAt(x: number, y: number): Shore {
  shoreGrids();
  if (sampleG(mangG, x, y) > 0.5) return 'mangrove';
  const b = sampleG(beachG, x, y), c = sampleG(cliffG, x, y);
  return b > 10 && b > c * 0.6 ? 'beach' : c > 22 ? 'cliff' : 'rock';
}
const SHORE_ID: Record<Shore, number> = { beach: 1, rock: 2, cliff: 3, mangrove: 4 };

// ------------------------------------------------------------------ the land
function fillPoly(pts: [number, number][]): Uint8Array {
  const m = new Uint8Array(N);
  const xs: number[] = [];
  for (let y = 0; y < H; y++) {
    xs.length = 0;
    const yc = y + 0.5;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j];
      if ((ay > yc) !== (by > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = x0; x <= x1; x++) m[y * W + x] = 1;
    }
  }
  return m;
}

type EllF = (x: number, y: number) => number;
const ellCache = new WeakMap<object, EllF>();
/** normalised distance from an ellipse's centre (1 on its rim); the trig is done once per ellipse */
export function ellOf(e: [number, number, number, number, number?]): EllF {
  let f = ellCache.get(e);
  if (f) return f;
  const [cx, cy, rx, ry, rot = 0] = e;
  const a = (rot * Math.PI) / 180, ca = Math.cos(a) / rx, sa = Math.sin(a) / rx, cb = Math.cos(a) / ry, sb = Math.sin(a) / ry;
  f = (x: number, y: number) => { const dx = x - cx, dy = y - cy; const u = dx * ca + dy * sa, v = -dx * sb + dy * cb; return Math.sqrt(u * u + v * v); };
  ellCache.set(e, f);
  return f;
}
const ell = (e: [number, number, number, number, number?], x: number, y: number) => ellOf(e)(x, y);

/** an islet pixel, warped like the coast */
function isletAt(x: number, y: number): boolean {
  const dx = sampleG(warpX!, x, y) + (noise2(x * 0.045, y * 0.045, 4) - 0.5) * 16, dy = sampleG(warpY!, x, y) + (noise2(x * 0.045 + 9, y * 0.045 + 3, 6) - 0.5) * 16;
  for (const [cx, cy, r] of ISLETS) { const ex = x + dx * 0.3 - cx, ey = (y + dy * 0.3 - cy) * 1.15; if (ex * ex + ey * ey < r * r) return true; }
  return false;
}

let landP: Promise<{ land: Uint8Array; cd: Float32Array }> | null = null;
/** the land mask and the distance to the coast (cached; the parchment needs it first) */
export function landAndCoast(): Promise<{ land: Uint8Array; cd: Float32Array }> {
  if (!landP) landP = (async () => {
    grids();
    const poly = fillPoly(COAST);
    const editF = COAST_EDITS.map(c => ellOf(c.e));
    await slice();
    const land = new Uint8Array(N);
    // (far from the polygon's edge the warp can't change the answer: skip the noise there)
    const pd = chamfer(poly);
    await slice();
    for (let y = 0; y < H; y++) {
      if ((y & 31) === 0) await slice();
      for (let x = 0; x < W; x++) {
        const i0 = y * W + x;
        if (pd[i0] > 52) {
          let on = poly[i0] === 1;
          if (!on) for (const [cx, cy, r] of ISLETS) { const ex = x - cx, ey = (y - cy) * 1.15; if (ex * ex + ey * ey < (r + 20) * (r + 20)) { on = isletAt(x, y); break; } }
          if (on) land[i0] = 1;
          continue;
        }
        const kind = shoreAt(x, y);
        const fineA = kind === 'beach' ? 2.5 : kind === 'mangrove' ? 7 : kind === 'cliff' ? 9 : 8;
        const fx = (noise2(x * 0.045, y * 0.045, 4) - 0.5) * fineA * 2 + (kind !== 'beach' ? (noise2(x * 0.17, y * 0.17, 5) - 0.5) * 4 : 0);
        const fy = (noise2(x * 0.045 + 9, y * 0.045 + 3, 6) - 0.5) * fineA * 2 + (kind !== 'beach' ? (noise2(x * 0.17 + 4, y * 0.17, 7) - 0.5) * 4 : 0);
        const dx = sampleG(warpX!, x, y) + fx, dy = sampleG(warpY!, x, y) + fy;
        const sx = Math.round(x + dx), sy = Math.round(y + dy);
        let on = sx >= 0 && sy >= 0 && sx < W && sy < H && poly[sy * W + sx] === 1;
        for (let k = 0; k < COAST_EDITS.length; k++) if (editF[k](x + dx * 0.35, y + dy * 0.35) < 1) on = COAST_EDITS[k].k > 0;
        if (!on) for (const [cx, cy, r] of ISLETS) { const ex = x + dx * 0.3 - cx, ey = (y + dy * 0.3 - cy) * 1.15; if (ex * ex + ey * ey < r * r) { on = true; break; } }
        if (on) land[y * W + x] = 1;
      }
    }
    // no single-pixel specks of either kind
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, v = land[i];
      const n = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
      if (v && n <= 1) land[i] = 0; else if (!v && n >= 3) land[i] = 1;
    }
    await slice();
    const cd = chamfer(land);
    return { land, cd };
  })();
  return landP;
}

/** distance (px) from each pixel to the nearest pixel of the other kind */
function chamfer(m: Uint8Array): Float32Array {
  const d = new Float32Array(N).fill(1e6);
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
  return d;
}

// ------------------------------------------------------------------ biomes
function shapeW(s: Shape, x: number, y: number, ef: EllF | null): number {
  if (ef) return 1 - ef(x, y);
  let best = 1e9;
  const sp = s as { s: [number, number][]; r: number };
  const p = sp.s;
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i];
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / l2);
    const ex = x - ax - vx * t, ey = y - ay - vy * t, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  return 1 - Math.sqrt(best) / sp.r;
}
function shapeBox(s: Shape): [number, number, number, number] {
  if ('e' in s) { const [cx, cy, rx, ry] = s.e; const r = Math.max(rx, ry) * 1.45 + 16; return [cx - r, cy - r, cx + r, cy + r]; }
  const xs = s.s.map(p => p[0]), ys = s.s.map(p => p[1]);
  return [Math.min(...xs) - s.r * 1.45 - 16, Math.min(...ys) - s.r * 1.45 - 16, Math.max(...xs) + s.r * 1.45 + 16, Math.max(...ys) + s.r * 1.45 + 16];
}

// ------------------------------------------------------------------ relief
function ridged(x: number, y: number): number {
  let s = 0, a = 0.6, f = 1, n = 0;
  for (let o = 0; o < 3; o++) {
    const v = 1 - Math.abs(noise2(x * f, y * f, 40 + o * 7) * 2 - 1);
    s += v * v * a; n += a; a *= 0.52; f *= 2.1;
  }
  return s / n;
}
/** distance to a polyline and where along it (0..1) the nearest point is: PD.d, PD.t */
const PD = { d: 0, t: 0 };
const polyLen = new WeakMap<object, number>();
function polyDist(p: [number, number][], x: number, y: number) {
  let best = 1e18, bt = 0, acc = 0;
  let tot = polyLen.get(p);
  if (tot === undefined) { tot = 0; for (let i = 1; i < p.length; i++) tot += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); polyLen.set(p, tot); }
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][0], ay = p[i - 1][1], vx = p[i][0] - ax, vy = p[i][1] - ay, l2 = vx * vx + vy * vy || 1, l = Math.sqrt(l2);
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / l2);
    const ex = x - ax - vx * t, ey = y - ay - vy * t, d = ex * ex + ey * ey;
    if (d < best) { best = d; bt = (acc + t * l) / tot; }
    acc += l;
  }
  PD.d = Math.sqrt(best); PD.t = bt;
}
/** signed distance into a polygon (px, positive inside) and the edge width of its nearest side: PS.d, PS.edge */
const PS = { d: 0, edge: 0 };
function polySigned(p: [number, number][], ew: number[], x: number, y: number) {
  let inside = false, best = 1e18, be = ew[0];
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1];
    if ((ay > y) !== (by > y) && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / l2);
    const ex = x - ax - vx * t, ey = y - ay - vy * t, d = ex * ex + ey * ey;
    if (d < best) { best = d; be = ew[j] + (ew[i] - ew[j]) * t; }
  }
  PS.d = inside ? Math.sqrt(best) : -Math.sqrt(best); PS.edge = be;
}
/** the rocky hills' domes rise inside this ellipse */
const HILLS_E: [number, number, number, number, number] = [576 * 2.75, 194 * 2.75, 80 * 2.75, 50 * 2.75, -8];
const along = (hs: number[], t: number) => { const f = t * (hs.length - 1), i = Math.min(hs.length - 2, Math.floor(f)); return hs[i] + (hs[i + 1] - hs[i]) * (f - i); };

// ------------------------------------------------------------------ everything
export async function buildFields(): Promise<Fields> {
  const { land, cd } = await landAndCoast();
  grids();
  const bio = new Uint8Array(N), shore = new Uint8Array(N), patch = new Float32Array(N);
  const boxes = SHAPES.map(shapeBox);
  const sign = SHAPES.map((s, k) => (hash2(k, s.b, 9) < 0.5 ? -1 : 1));
  const shapeF = SHAPES.map(s => ('e' in s ? ellOf(s.e) : null));
  // the biomes are worked out at half resolution (their edges are ragged noise anyway)
  const BW2 = W >> 1, BH2 = H >> 1, bh = new Uint8Array(BW2 * BH2);
  for (let j = 0; j < BH2; j++) {
    if ((j & 15) === 0) await slice();
    for (let i2 = 0; i2 < BW2; i2++) {
      const x = i2 * 2, y = j * 2;
      if (!land[y * W + x] && !land[y * W + x + 1] && !land[(y + 1) * W + x]) continue;
      const a = sampleG(bioG!, x, y), b = noise2(x * 0.06, y * 0.06, 22);
      let best = 0, bb: B = B.meadow;
      for (let k = 0; k < SHAPES.length; k++) {
        const bx = boxes[k];
        if (x < bx[0] || x > bx[2] || y < bx[1] || y > bx[3]) continue;
        const w = shapeW(SHAPES[k], x, y, shapeF[k]) + (a - 0.5) * 0.62 * sign[k] + (b - 0.5) * 0.12;
        if (w > best) { best = w; bb = SHAPES[k].b; }
      }
      bh[j * BW2 + i2] = bb;
    }
  }
  for (let y = 0; y < H; y++) {
    if ((y & 31) === 0) await slice();
    const row = Math.min(BH2 - 1, y >> 1) * BW2;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      patch[i] = sampleG(patchG!, x, y);
      if (cd[i] < 90) shore[i] = SHORE_ID[shoreAt(x, y)];
      bio[i] = land[i] ? bh[row + Math.min(BW2 - 1, x >> 1)] : B.sea;
    }
  }
  shoreGrids();
  // ---- the relief at half resolution
  const HW = W >> 1, HH = H >> 1;
  const h2 = new Float32Array(HW * HH);
  const reliefBox = RELIEF.map(r => { const [cx, cy, rx, ry] = r.e; const m = Math.max(rx, ry) * 1.3; return [cx - m, cy - m, cx + m, cy + m]; });
  const [rcx, rcy, rrx, rry] = RANGE_E;
  const reliefF = RELIEF.map(r => ellOf(r.e)), rangeF = ellOf(RANGE_E), hillsF = ellOf(HILLS_E);
  for (let j = 0; j < HH; j++) {
    if ((j & 7) === 0) await slice();
    for (let i = 0; i < HW; i++) {
      const x = i * 2 + 1, y = j * 2 + 1, gi = y * W + x;
      if (!land[gi]) { h2[j * HW + i] = 0; continue; }
      const d = cd[gi];
      const ch = sampleG(cliffG, x, y), bw = sampleG(beachG, x, y), mf = sampleG(mangG, x, y);
      const wn = sampleG(warpX!, x, y) / 34;
      // the shore: sand and dunes, or a cliff
      const sand = 0.5 + 2.4 * smoothstep(0, bw, d) + 5 * smoothstep(bw * 0.85, bw + 26, d);
      const cliff = ch * smoothstep(0, 2.5 + ch * 0.05, d);
      let h = Math.max(sand, cliff) * (1 - mf * 0.75) + mf * (0.8 + 1.5 * smoothstep(0, 80, d));
      // rising inland, gently rolling
      const inl = Math.min(30, Math.max(0, d - 40) * 0.07) * (1 - mf * 0.8);
      h += inl + (fbm2(x * 0.016, y * 0.016, 3, 31) - 0.42) * 14 * smoothstep(30, 140, d) * (1 - mf);
      h += (noise2(x * 0.07, y * 0.07, 33) - 0.5) * 2.2 * smoothstep(8, 30, d);
      for (let k = 0; k < RELIEF.length; k++) {
        const bx = reliefBox[k];
        if (x < bx[0] || x > bx[2] || y < bx[1] || y > bx[3]) continue;
        const r = RELIEF[k];
        if (r.k === 'poly') { polySigned(r.pts, r.edge, x, y); if (PS.d > -3) h += r.h * smoothstep(0, PS.edge, PS.d + wn * 4); continue; }
        const kk = 1 - reliefF[k](x, y) + wn * 0.12;
        if (kk <= 0 && r.k !== 'rolling') continue;
        switch (r.k) {
          case 'plateau': h += r.h * smoothstep(0, r.edge, kk); break;
          case 'dome': h += r.h * clamp(kk * (2 - kk)); break;
          case 'basin': h -= r.h * smoothstep(0, r.edge, kk); break;
          case 'rolling': if (kk > 0) h += r.h * (fbm2(x * r.f, y * r.f, 3, 35 + k) - 0.38) * smoothstep(0, 0.35, kk); break;
          case 'terrace': break;
        }
      }
      // the rocky hills: tussock domes
      const hk = 1 - hillsF(x, y);
      if (hk > 0) h += Math.max(0, fbm2(x * 0.0125, y * 0.0125, 2, 37) - 0.36) * 70 * smoothstep(0, 0.45, hk);
      // the range: ridge spines with ridged rock grown on them
      const rk = 1 - rangeF(x, y);
      if (rk > -0.1 && Math.abs(x - rcx) < rrx * 1.5 && Math.abs(y - rcy) < rry * 1.5) {
        let spine = 0;
        for (const rg of RANGE) {
          polyDist(rg.pts, x, y);
          const dd = PD.d, t = PD.t;
          const wv = rg.w * (0.8 + noise2(x * 0.01, y * 0.01, 41) * 0.5);
          if (dd > wv * 2.2) continue;
          const hp = along(rg.h, t);
          spine = Math.max(spine, hp * Math.pow(Math.max(0, 1 - dd / (wv * 2.2)), 1.25));
        }
        const rn = ridged(x * 0.0062 + 3, y * 0.0052);
        const mask = smoothstep(-0.1, 0.25, rk);
        h += (spine * (0.48 + 0.62 * rn) + rn * 22 * smoothstep(0, 0.4, rk)) * mask;
      }
      // the terraces of the pā
      for (let k = 0; k < RELIEF.length; k++) if (RELIEF[k].k === 'terrace') {
        const r = RELIEF[k] as { step: number };
        const kk = 1 - reliefF[k](x, y);
        if (kk > 0) { const st = r.step; const q = Math.floor(h / st) * st; h = q + (h - q) * 0.18 + 1; }
      }
      h2[j * HW + i] = Math.max(0.4, h);
    }
  }
  await slice();
  // ---- up to full resolution
  const hgt = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    if ((y & 31) === 0) await slice();
    const fy = Math.max(0, (y - 1) / 2), j = Math.min(HH - 2, Math.floor(fy)), v = fy - j;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      const fx = Math.max(0, (x - 1) / 2), ii = Math.min(HW - 2, Math.floor(fx)), u = fx - ii;
      const a = h2[j * HW + ii], b = h2[j * HW + ii + 1], c = h2[(j + 1) * HW + ii], d = h2[(j + 1) * HW + ii + 1];
      // (sea samples would drag the coast down: lean on the land ones)
      const aa = a || Math.max(b, c, d), bb = b || Math.max(a, c, d), cc = c || Math.max(a, b, d), dd = d || Math.max(a, b, c);
      let hh = (aa + (bb - aa) * u) * (1 - v) + (cc + (dd - cc) * u) * v;
      // the very edge of a cliff coast keeps its full height (a sheer face, not a ramp)
      const dc = cd[i];
      if (dc < 4) { const ch = sampleG(cliffG, x, y); if (ch > 12) hh = Math.max(hh, ch * smoothstep(0, 1.6, dc) * 0.92); }
      hgt[i] = Math.max(0.4, hh);
      // the shore's own ground: sand and dunes, rock ledges, mud
      const sh = shore[i], nz = (noise2(x * 0.06, y * 0.06, 51) - 0.5) * 8;
      if (sh === 1) {
        const bw = sampleG(beachG, x, y);
        if (dc < bw + nz) bio[i] = B.beach;
        else if (dc < bw + 22 + nz * 1.5) { const b0 = bio[i]; if (b0 === B.meadow || b0 === B.forest || b0 === B.coastal || b0 === B.beech || b0 === B.plain) bio[i] = B.dunes; }
      } else if ((sh === 2 || sh === 3) && dc < 2.5 + nz * 0.4) bio[i] = B.rock;
    }
  }
  // ---- rivers, lakes and pools
  const wat = new Uint8Array(N), flow = new Uint8Array(N), rd = new Uint8Array(N).fill(255);
  for (let i = 0; i < N; i++) if (!land[i]) wat[i] = WK.sea;
  await rivers(land, hgt, wat, flow, rd, bio);
  lakes(land, hgt, wat, bio);
  return { land, cd, bio, hgt, wat, flow, rd, shore, patch };
}

// ------------------------------------------------------------------ rivers
const WIDTH: number[] = [4.5, 7.5, 6.5, 5.5, 3.5, 3.5, 3.5, 4, 3, 4, 3.5];
async function rivers(land: Uint8Array, hgt: Float32Array, wat: Uint8Array, flow: Uint8Array, rd: Uint8Array, bio: Uint8Array) {
  const all = [...RIVERS, ...EXTRA_RIVERS];
  const hAt = (x: number, y: number) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : hgt[yi * W + xi]; };
  // the river's surface and nearest-river distance, stamped point by point
  const rwl = new Float32Array(N).fill(1e6), rdist = new Float32Array(N).fill(1e6), rw = new Float32Array(N);
  for (let ri = 0; ri < all.length; ri++) {
    let pts = all[ri];
    // flow from the higher end
    if (hAt(...pts[0]) < hAt(...pts[pts.length - 1])) pts = [...pts].reverse();
    const dense: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5);
      const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const m = ((noise2((i * n + k) * 0.012, ri * 3.1, 120 + ri) - 0.5) * 22 + (noise2((i * n + k) * 0.05, ri * 1.7, 140 + ri) - 0.5) * 5) * Math.sin(t * Math.PI);
        dense.push([ax + (bx - ax) * t + (nx / nl) * m, ay + (by - ay) * t + (ny / nl) * m]);
      }
    }
    dense.push(pts[pts.length - 1]);
    const w0 = WIDTH[ri] ?? 3.5;
    let wl = hAt(...dense[0]) - 2.5, dist = 0;
    const R = Math.ceil(w0 * 1.6 + 18);
    for (let k = 0; k < dense.length; k++) {
      const [x, y] = dense[k];
      if (k) dist += Math.hypot(x - dense[k - 1][0], y - dense[k - 1][1]);
      const th = hAt(x, y);
      wl = Math.min(wl, th - 1.6);
      if (wl < 0.2) wl = 0.2;
      const w = w0 * (0.65 + 0.55 * (k / dense.length));
      if ((k & 1) !== 0 && k !== dense.length - 1) continue;
      for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        const ex = xx + 0.5 - x, ey = yy + 0.5 - y, e2 = ex * ex + ey * ey;
        const cur = rdist[i] + w;
        if (cur < 0 || e2 >= cur * cur) continue;
        const dd = Math.sqrt(e2) - w;
        if (dd < rdist[i]) { rdist[i] = dd; rwl[i] = wl; rw[i] = w; flow[i] = Math.floor(dist * 0.9) & 255; }
      }
    }
    await slice();
  }
  for (let i = 0; i < N; i++) {
    const dd = rdist[i];
    if (dd > 40) continue;
    rd[i] = Math.max(0, Math.min(254, Math.round(dd + rw[i])));
    if (!land[i]) continue;
    const wl = rwl[i];
    if (dd <= 0) { hgt[i] = wl; wat[i] = WK.river; continue; }
    // banks: steep near the water, a gorge where the land stands high (the Bone Cliffs)
    const gorge = bio[i] === B.gorge;
    const bank = wl + 0.6 + dd * (gorge ? 3.4 : 1.3) + (dd > 3 ? (dd - 3) * (gorge ? 2 : 0.6) : 0);
    if (hgt[i] > bank) hgt[i] = bank;
    flow[i] = 0;
  }
}

function lakes(land: Uint8Array, hgt: Float32Array, wat: Uint8Array, bio: Uint8Array) {
  const lake = (cx: number, cy: number, rx: number, ry: number, kind: number, level?: number) => {
    let lv = level ?? 1e9;
    if (level === undefined) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (Math.hypot((x - cx) / rx, (y - cy) / ry) > 1 || x < 0 || y < 0 || x >= W || y >= H) continue;
      lv = Math.min(lv, hgt[y * W + x]);
    }
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (hash2(x >> 1, y >> 1, 5) - 0.5) * 0.1;
      if (k > 1) continue;
      const i = y * W + x;
      if (!land[i]) continue;
      hgt[i] = lv;
      wat[i] = kind;
    }
  };
  const [px, py] = LM.plunge;
  lake(px, py, 15, 9, WK.lake);
  lake(742 * 2.75, 252 * 2.75, 13, 7, WK.lake);   // tarns in the range
  lake(792 * 2.75, 266 * 2.75, 10, 6, WK.lake);
  lake(822 * 2.75, 330 * 2.75, 9, 5, WK.lake);
  lake(586 * 2.75, 170 * 2.75, 9, 6, WK.lake);    // a pond among the hills
  const [sx, sy] = LM.sink;
  lake(sx, sy + 10, 62, 22, WK.lake);             // the lake at the bottom of Te Korokoro
  for (const [x, y, r, k] of POOLS) lake(x, y, r, r * 0.66, k === 2 ? WK.pool : WK.hot);
  for (const [x, y, r] of WALLOWS) lake(x, y, r, r * 0.62, WK.pool);
  // the mangroves: black water channels winding through the mud
  const chG = grid((x, y) => fbm2(x * 0.022, y * 0.022, 3, 64)), poolG = grid((x, y) => fbm2(x * 0.018 + 9, y * 0.018, 2, 65));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (bio[i] !== B.swamp || wat[i]) continue;
    const ch = Math.abs(sampleG(chG, x, y) + (noise2(x * 0.15, y * 0.15, 66) - 0.5) * 0.02 - 0.5);
    if (ch < 0.026 || sampleG(poolG, x, y) > 0.69) { wat[i] = WK.channel; hgt[i] = Math.max(0.3, hgt[i] - 0.6); }
  }
}

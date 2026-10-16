// V10 Region Map painter: the island as a hand-built 3/4 pixel-art diorama at 2640 x 1760 (mapart/:
// ground fields, the lifted terrain with its cliff faces, light and cast shadows, the sea by depth,
// every plant painted one by one, the landmarks), plus two companions that share its geometry:
//   paper  aged parchment with Joshu's old chart traced on it (a faint coastline and depth lines,
//          rhumb lines, a compass rose, a cartouche, a sea serpent, a ship, a whale, the seas' names
//          lettered in the map's pixel font): what an unexplored place looks like
//   ink    the pen sketch of the painted map (outlines and hatching): a place glimpsed but not yet
//          walked, and the first stage of the reveal (sketched ink, then the colour washes in)
// Everything is generated at runtime, once per session, in time slices (paintMap() never blocks a
// frame for long). regionmap-fx.ts composes and animates it. Places stand on the ground: proj() gives
// the point on the picture where a ground point shows (h pixels up for ground h pixels high).

import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix, R, G, B as BL } from '../../art/color';
import { fbm2, hash2, bayer, clamp } from '../../core/math';
import { W, H, N, TAG, WK, Scr, resetSlice, slice } from './mapart/kit';
import { landAndCoast, buildFields } from './mapart/field';
import { lighting, project } from './mapart/terrain';
import { Layer, castShadows } from './mapart/sprites';
import { placeFlora } from './mapart/flora';
import type { Feat } from './mapart/flora';
import { placeLandmarks, paintOver } from './mapart/places';
import { drawText, measure } from './mapfont';
import { S, SEA_NAMES, BIOME_N } from './mapgeo';

export { W, H, TAG, WK };
export const INK = hex('#3a2614'), INK2 = hex('#5e4026'), INK3 = hex('#8a6c48'), INK_RED = hex('#a8382a'), INK_BLUE = hex('#2e5a78');

export interface MapArt {
  /** parchment (alpha 0 off the torn sheet) */
  paper: Uint32Array;
  /** the painted map */
  color: Uint32Array;
  /** the pen sketch (alpha 0: no ink) */
  ink: Uint32Array;
  /** 1 where the picture shows land (or something standing on it), 0 the sea */
  land: Uint8Array;
  /** screen distance from a sea pixel to the coast it shows against (255 far) */
  coast: Uint8Array;
  /** what kind of water each pixel shows */
  water: Uint8Array;
  /** flow phase along rivers (0..255, repeating) */
  flow: Uint8Array;
  tag: Uint8Array;
  /** 0 land, 1 cliff face, 2 water, 3 something standing (a tree, a hut) */
  kind: Uint8Array;
}

// ------------------------------------------------------------------ ground -> picture
const HW = W >> 1, HH = H >> 1;
let lift: Float32Array | null = null;
/** where a ground point shows on the painted map (lifted by its height) */
export function proj(x: number, y: number): [number, number] {
  if (!lift) return [x, y];
  const fx = clamp(x / 2, 0, HW - 1.001), fy = clamp(y / 2, 0, HH - 1.001);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const a = lift[j * HW + i], b = lift[j * HW + i + 1], c = lift[(j + 1) * HW + i], d = lift[(j + 1) * HW + i + 1];
  const h = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  return [x, y - h];
}
/** the ground's height at a point (0 before the map is painted) */
export function heightAt(x: number, y: number): number { return y - proj(x, y)[1]; }
export const projReady = () => !!lift;

// ------------------------------------------------------------------ the cache
let artP: Promise<MapArt> | null = null;
let artV: MapArt | null = null;
let paperV: Uint32Array | null = null;
let paperP: Promise<Uint32Array> | null = null;
/** the painted map, if it is ready */
export const mapArt = () => artV;
/** the parchment alone (quick: the map unrolls on it while the rest paints) */
export function paintPaper(): Promise<Uint32Array> {
  if (!paperP) paperP = (async () => { resetSlice(); const p = await buildPaper(); paperV = p; return p; })();
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

// ------------------------------------------------------------------ the painted map
const T: Record<string, number> = {};
async function buildArt(paper: Uint32Array): Promise<MapArt> {
  resetSlice();
  let t = performance.now();
  const lap = (k: string) => { const n = performance.now(); T[k] = Math.round(n - t); t = n; };
  const f = await buildFields(); lap('fields');
  // keep the relief (half resolution) for proj()
  const lf = new Float32Array(HW * HH);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) lf[j * HW + i] = f.hgt[(j * 2) * W + i * 2];
  lift = lf;
  const L = await lighting(f); lap('light');
  const scr = new Scr();
  await project(f, L, scr); lap('project');
  const l = new Layer(scr);
  const feats: Feat[] = [];
  placeFlora(f, L, l, feats);
  placeLandmarks(f, L, l, feats);
  feats.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
  for (let k = 0; k < feats.length; k++) { feats[k].f(); if ((k & 1023) === 0) await slice(); }
  lap('sprites');
  await castShadows(l);
  paintOver(f, l);
  lap('shadows');
  const ink = await sketch(scr, paper); lap('ink');
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = scr.kind[i] === 2 && scr.wat[i] === WK.sea ? 0 : 1;
  (window as unknown as { __rmT?: unknown }).__rmT = T;
  return { paper, color: scr.col, ink, land, coast: scr.sea, water: scr.wat, flow: scr.flow, tag: scr.tag, kind: scr.kind };
}

// ------------------------------------------------------------------ the pen sketch
async function sketch(scr: Scr, paper: Uint32Array): Promise<Uint32Array> {
  const { col, edge, kind, wat, sea } = scr;
  const ink = new Uint32Array(N);
  const dark = INK, mid = INK2, light = INK3, blue = hex('#2a4a62');
  const lumOf = (c: C) => (R(c) * 0.299 + G(c) * 0.587 + BL(c) * 0.114) / 255;
  for (let y = 1; y < H - 1; y++) {
    if ((y & 31) === 0) await slice();
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!paper[i]) continue;
      const e = edge[i];
      if (e === 1) { ink[i] = dark; continue; }
      if (e === 2) { ink[i] = blue; continue; }
      if (kind[i] === 2 && wat[i] === WK.sea) {
        // the sea: the coast line, a ripple out from it, sparse strokes further out
        const d = sea[i];
        if (d <= 1) ink[i] = dark;
        else if ((d === 7 || d === 18) && hash2(x >> 3, y >> 3, d) < 0.7) ink[i] = light;
        continue;
      }
      if (kind[i] === 2) { if ((x + y) % 3 === 0) ink[i] = blue; continue; }
      const c = col[i], L = lumOf(c);
      const l2 = lumOf(col[i + 1]), l3 = lumOf(col[i + W]);
      if (Math.abs(L - Math.max(l2, l3)) > 0.24) { ink[i] = mid; continue; }
      // shadows get pen hatching
      if (L < 0.12) { if ((x + y) % 4 === 0) ink[i] = mid; }
      else if (L < 0.22) { if ((x + y) % 6 === 0) ink[i] = light; }
      else if (kind[i] === 1 && (x + y) % 5 === 0) ink[i] = light;
    }
  }
  return ink;
}

// ------------------------------------------------------------------ the parchment
const PAPER = [hex('#c4a670'), hex('#d0b47e'), hex('#dbc18e'), hex('#e5cd9d'), hex('#eed8ac'), hex('#f5e3bc')];
const PAPER_SEA = [hex('#b8ae8a'), hex('#c4b994'), hex('#cfc39f'), hex('#d9cdab')];
const dith = (x: number, y: number, ramp: C[], t: number) => ramp[clamp(Math.floor(t * (ramp.length - 1) + bayer(x, y)), 0, ramp.length - 1)];

async function buildPaper(): Promise<Uint32Array> {
  const { land: m, cd: d } = await landAndCoast();
  const out = new Uint32Array(N);
  // the torn, deckled edge of the sheet
  const edgeIn = (x: number, y: number) => { const t = x + y * 0.7; return 6 + fbm2(t * 0.022, 3.3, 3, 71) * 19 + (hash2(Math.floor(t / 8), 1, 72) > 0.93 ? 5 : 0); };
  for (let y = 0; y < H; y++) {
    if ((y & 15) === 0) await slice();
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      const ei = edgeIn(x < W / 2 ? x : W - x, y < H / 2 ? y : H - y);
      if (e < ei - 3) { out[i] = 0; continue; }
      const n = fbm2(x * 0.011, y * 0.011, 4, 5), st = fbm2(x * 0.0033 + 4, y * 0.0033, 3, 9), gr = hash2(x, y, 33);
      const burn = clamp(1 - (e - ei) / 70) ** 2;
      const t = 0.66 + (n - 0.5) * 0.55 - burn * 0.75 - (st > 0.66 ? (st - 0.66) * 1.6 : 0) + (gr - 0.5) * 0.12;
      const sea = !m[i];
      let c = sea ? dith(x, y, PAPER_SEA, clamp(t + 0.1)) : dith(x, y, PAPER, clamp(t));
      if (e < ei + 1.6) c = mix(c, hex('#6e4a26'), 0.55);
      else if (burn > 0.5 && hash2(x >> 2, y >> 2, 3) < burn * 0.18) c = mix(c, hex('#7a5430'), 0.4);
      // foxing and the odd fleck
      const fox = fbm2(x * 0.03, y * 0.03, 2, 44);
      if (fox > 0.74 && hash2(x >> 1, y >> 1, 45) < (fox - 0.74) * 5) c = mix(c, hex('#a07848'), 0.45);
      if (hash2(x, y, 77) > 0.9996) c = INK2;
      // creases where it has been folded
      const fx = Math.abs(x - Math.round(W / 3)), fx2 = Math.abs(x - Math.round((2 * W) / 3)), fy = Math.abs(y - Math.round(H / 2));
      if (fx <= 1 || fx2 <= 1 || fy <= 1) c = mix(c, hex('#8c6c44'), 0.16);
      else if (fx <= 3 || fx2 <= 3 || fy <= 3) c = mix(c, hex('#fbefd2'), 0.16);
      // Joshu's chart: a faint coastline with depth lines in the sea
      const dd = d[i];
      if (dd <= 2.2) c = mix(c, INK2, sea ? 0.55 : 0.7);
      else if (sea) for (const [r, k] of [[12, 0.9], [24, 0.7], [38, 0.45], [56, 0.25]] as const) {
        if (Math.abs(dd - r) < 0.8 && hash2(Math.floor(x / 9), Math.floor(y / 9), r) < k) c = mix(c, INK3, r < 25 ? 0.65 : 0.42);
      }
      out[i] = c;
    }
  }
  const blendSet = (x: number, y: number, c: C, k: number) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (out[i]) out[i] = mix(out[i], c, k); };
  /** a 2 px pen */
  const pen = (x: number, y: number, c: C, k: number) => { blendSet(x, y, c, k); blendSet(x + 1, y, c, k); blendSet(x, y + 1, c, k); blendSet(x + 1, y + 1, c, k); };
  // rhumb lines from the compass rose, faint, across the whole sheet
  const [rx0, ry0] = [878 * S, 572 * S];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let t = 100; t < 3600; t += 1) {
      const x = rx0 + ca * t, y = ry0 + sa * t;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      if ((t >> 2) % 3 === 2) continue;
      blendSet(x, y, k % 4 === 0 ? INK3 : hex('#a88a5e'), k % 4 === 0 ? 0.32 : 0.18);
    }
  }
  await slice();
  // little wave strokes over the open sea
  for (let y = 50; y < H - 50; y += 36) for (let x = 50; x < W - 50; x += 46) {
    const jx = x + Math.floor(hash2(x, y, 3) * 26), jy = y + Math.floor(hash2(x, y, 4) * 20);
    const i = jy * W + jx;
    if (m[i] || d[i] < 70 || hash2(x, y, 5) < 0.55) continue;
    for (let k = 0; k < 18; k++) pen(jx + k, jy - Math.round(Math.sin((k / 17) * Math.PI) * 4), INK3, 0.7);
    for (let k = 0; k < 13; k++) pen(jx + 16 + k, jy - Math.round(Math.sin((k / 12) * Math.PI) * 3), INK3, 0.7);
  }
  compassRose(blendSet, pen, rx0, ry0);
  seaSerpent(pen, 46 * S, 604 * S);
  shipSketch(pen, 934 * S, 150 * S);
  whaleSketch(pen, 420 * S, 26 * S);
  cartouche(blendSet, 520 * S, 610 * S);
  scaleBar(blendSet, 690 * S, 612 * S);
  border(blendSet);
  // the lettering: the land's name in the cartouche, the seas, the scale
  letter(out, 'TE WHENUA HUNA', 520 * S, 606 * S, 5, INK, 0.92, 3);
  letter(out, 'the hidden land', 520 * S, 619 * S, 3, INK2, 0.85, 1);
  for (const s of SEA_NAMES) letter(out, s.text, s.at[0], s.at[1], 4, INK3, 0.55, 6);
  letter(out, '4 hours on foot', 718 * S, 604 * S, 2, INK2, 0.8, 1);
  letter(out, 'from Joshu’s old chart', 878 * S, 610 * S, 2, INK3, 0.75, 1);
  return out;
}

/** text lettered onto the paper at a whole-number size, centred on (cx, cy) */
function letter(out: Uint32Array, text: string, cx: number, cy: number, k: number, c: C, a: number, track: number) {
  const tw = measure(text, { track }), b = new PixelBuffer(tw + 2, 12);
  drawText(b, text, 1, 0, 0xff000000, { track });
  const x0 = Math.round(cx - (b.w * k) / 2), y0 = Math.round(cy - (b.h * k) / 2);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!(b.data[y * b.w + x] >>> 24)) continue;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const px = x0 + x * k + i, py = y0 + y * k + j;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const q = py * W + px;
      if (out[q]) out[q] = mix(out[q], c, a);
    }
  }
}

type BS = (x: number, y: number, c: C, k: number) => void;
/** a compass rose: a ring with ticks, 16 points in ink, gold and red, north in red */
function compassRose(set: BS, pen: BS, cx: number, cy: number) {
  const R1 = 86;
  for (let a = 0; a < 2400; a++) {
    const t = (a / 2400) * Math.PI * 2;
    pen(cx + Math.cos(t) * R1, cy + Math.sin(t) * R1, INK2, 0.95);
    set(cx + Math.cos(t) * (R1 - 7), cy + Math.sin(t) * (R1 - 7), INK3, 0.9);
    if (a % 75 === 0) for (let r = R1 - 7; r <= R1; r++) pen(cx + Math.cos(t) * r, cy + Math.sin(t) * r, INK, 0.95);
  }
  const point = (ang: number, len: number, wid: number, fill: C, fill2: C) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let t = 0; t <= len; t += 0.5) {
      const w = wid * (1 - t / len);
      for (let s = -w; s <= w; s += 0.5) {
        const x = cx + ca * t - sa * s, y = cy + sa * t + ca * s;
        set(x, y, Math.abs(s) > w - 1.4 ? INK : s < 0 ? fill : fill2, 1);
      }
    }
  };
  for (let k = 0; k < 8; k++) point(Math.PI / 8 + (k * Math.PI) / 4, 44, 6.6, hex('#e2cc96'), hex('#b89a62'));
  for (let k = 0; k < 4; k++) point(Math.PI / 4 + (k * Math.PI) / 2, 58, 9.4, hex('#e0b040'), hex('#a8781c'));
  point(Math.PI / 2, 77, 12, hex('#f0e2b8'), hex('#bba274'));
  point(0, 77, 12, hex('#f0e2b8'), hex('#bba274'));
  point(Math.PI, 77, 12, hex('#f0e2b8'), hex('#bba274'));
  point(-Math.PI / 2, 82, 12.6, hex('#d0402c'), hex('#8a2018'));
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) set(cx + x, cy + y, x * x + y * y <= 9 ? hex('#f2e4bc') : INK, 1);
  // N above the rose
  const n = new PixelBuffer(8, 12);
  drawText(n, 'N', 1, 0, 0xff000000);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) if (n.data[y * 8 + x] >>> 24) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) set(cx - 9 + x * 3 + i, cy - R1 - 40 + y * 3 + j, INK_RED, 1);
}
/** a sea serpent, sketched in the south-west sea as old charts have */
function seaSerpent(set: BS, x0: number, y0: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 200; i++) pts.push([x0 + i * 1.55, y0 + Math.sin(i * 0.08) * 16]);
  pts.forEach(([x, y], i) => {
    const above = Math.sin(i * 0.08) < -0.15 || i > 178;
    if (!above) { if (i % 7 === 0) set(x, y + 10, INK3, 0.8); return; }
    const r = i > 178 ? 7 : 5.5;
    for (let s = -r; s <= r; s += 1) set(x, y + s, Math.abs(s) > r - 2 ? INK : i % 10 < 5 ? hex('#7a8a6a') : hex('#a4ae8a'), 0.9);
    if (i % 12 === 0) set(x, y - r - 3, INK2, 0.8);
  });
  const [hx0, hy] = pts[pts.length - 1];
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 81) set(hx0 + 8 + x, hy - 3 + y, Math.abs(x * x + y * y - 81) < 18 ? INK : hex('#a4ae8a'), 0.95);
  set(hx0 + 11, hy - 6, INK, 1); set(hx0 + 13, hy - 6, INK, 1);
  for (let k = 0; k < 12; k++) set(hx0 + 18 + k, hy + (k % 4 < 2 ? 0 : 2), INK_RED, 1);
}
/** a little three-masted ship in ink */
function shipSketch(set: BS, x0: number, y0: number) {
  for (let x = -26; x <= 26; x++) { const yb = y0 + Math.round((x * x) / 80); set(x0 + x, yb, INK, 0.9); if (Math.abs(x) < 24) set(x0 + x, yb - 3, INK3, 0.6); }
  for (const [mx, mh] of [[-14, 28], [0, 36], [14, 25]]) {
    for (let y = 0; y < mh; y++) set(x0 + mx, y0 - 2 - y, INK, 0.85);
    for (let s = 0; s < 3; s++) { const sy = y0 - mh + 4 + s * 8, sw = 8 - (s === 0 ? 2 : 0); for (let x = -sw; x <= sw; x++) set(x0 + mx + x, sy + Math.abs(x) * 0.3, INK2, 0.75); }
  }
  for (let k = 0; k < 4; k++) set(x0 + k, y0 - 40, INK_RED, 1);
  for (let x = -32; x <= 32; x += 6) set(x0 + x, y0 + 8 + ((x / 6) & 1) * 2, INK3, 0.6);
}
/** a whale spouting, in ink */
function whaleSketch(set: BS, x0: number, y0: number) {
  for (let x = -22; x <= 22; x++) { const t = x / 22; const top = y0 - Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 10); set(x0 + x, top, INK, 0.85); set(x0 + x, top + 1, INK, 0.6); }
  for (let x = -22; x <= 22; x++) set(x0 + x, y0 + 2, INK3, 0.5);
  for (const [dx, dy] of [[24, 0], [27, -3], [30, -6], [27, 3], [30, 6]]) set(x0 + dx, y0 + dy, INK, 0.8);
  for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + (k - 8) * 0.12; set(x0 - 8 + Math.cos(a) * (6 + (k % 3) * 4), y0 - 14 + Math.sin(a) * (10 + (k % 4) * 3), INK2, 0.75); }
  set(x0 - 14, y0 - 5, INK, 1);
}
/** the title ribbon in the south sea */
function cartouche(set: BS, cx: number, cy: number) {
  const w = 330, h2 = 30;
  for (let y = -h2; y <= h2; y++) for (let x = -w; x <= w; x++) {
    const wave = Math.round(Math.sin((x / w) * Math.PI * 1.5) * 4);
    const yy = y + wave;
    if (Math.abs(yy) > h2) continue;
    const edge = Math.abs(yy) >= h2 - 1.5 || Math.abs(x) >= w - 1.5;
    set(cx + x, cy + y, edge ? INK2 : Math.abs(yy) >= h2 - 6 ? hex('#e8d6aa') : hex('#f4e6c2'), edge ? 0.9 : 0.85);
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 60; k++) {
      const t = k / 59, a = t * Math.PI * 2.2;
      const x = cx + side * (w + 10 + Math.cos(a) * (16 - t * 8)), y = cy + Math.sin(a) * (16 - t * 8) * side;
      set(x, y, INK2, 0.9); set(x + 1, y, INK2, 0.9);
    }
  }
}
/** a scale bar: four hours on foot */
function scaleBar(set: BS, x0: number, y0: number) {
  const seg = 72;
  for (let k = 0; k < 4; k++) for (let x = 0; x < seg; x++) for (let y = 0; y < 8; y++) set(x0 + k * seg + x, y0 + y, y <= 1 || y >= 6 ? INK : k % 2 ? hex('#f4e6c2') : INK2, 0.9);
  for (let k = 0; k <= 4; k++) for (let y = -5; y <= 12; y++) { set(x0 + k * seg, y0 + y, INK, 0.95); set(x0 + k * seg + 1, y0 + y, INK, 0.95); }
}
/** a double ink rule inside the edge, ticks and corner pieces */
function border(set: BS) {
  const m1 = 40, m2 = 50;
  for (let x = m1; x < W - m1; x++) { for (const yy of [m1, H - 1 - m1]) { set(x, yy, INK2, 0.75); set(x, yy + 1, INK2, 0.75); } set(x, m2, INK3, 0.6); set(x, H - 1 - m2, INK3, 0.6); if (x % 110 < 2) for (let k = m1; k <= m2; k++) { set(x, k, INK2, 0.8); set(x, H - 1 - k, INK2, 0.8); } }
  for (let y = m1; y < H - m1; y++) { for (const xx of [m1, W - 1 - m1]) { set(xx, y, INK2, 0.75); set(xx + 1, y, INK2, 0.75); } set(m2, y, INK3, 0.6); set(W - 1 - m2, y, INK3, 0.6); if (y % 110 < 2) for (let k = m1; k <= m2; k++) { set(k, y, INK2, 0.8); set(W - 1 - k, y, INK2, 0.8); } }
  for (const [cx, cy] of [[m1 + 5, m1 + 5], [W - 6 - m1, m1 + 5], [m1 + 5, H - 6 - m1], [W - 6 - m1, H - 6 - m1]]) {
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (Math.abs(x) + Math.abs(y) <= 9) set(cx + x, cy + y, Math.abs(x) + Math.abs(y) >= 8 ? INK : INK_RED, 0.9);
  }
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

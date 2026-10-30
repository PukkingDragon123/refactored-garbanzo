// V12 notebook: the pixel painting. Everything here draws into paint buffers (Art) at the notebook's
// own resolution (one page is PW x PH art pixels, shown at a whole number of device pixels per art
// pixel): aged ruled paper (coffee rings, pencil smudges, a thumb print where Mori holds it, foxing,
// dog-ears), the worn leather cover with its stitching, label, scratches and sticker, the elastic
// band, Mori's hands in his fingerless gloves, the pen, the pencil and the eraser, the ribbon, paper
// tabs, tape, taped photos, sticky notes, stamps, hearts, and the hand-drawn ink marks (ticks, boxes,
// strikes, arrows) as pixel paths so the pen can draw them on stroke by stroke.

import { Art, col, dith, bayer, mixC, shadeC } from '../../v11/paper/px';
import { paperTileArt } from '../../v11/paper/textures';
import { drawText, textWidth } from '../../v11/paper/pxfont';
import { rasterStrokes } from '../../v11/paper/ink';
import { DOODLES } from '../../v11/paper/sketch';
import { stampArt, rotateArt } from '../../v11/paper/decor';
import { hash2, rng, fbm } from '../../v11/paper/rng';

// ---------------------------------------------------------------- the page grid

/** a page in art pixels */
export const PW = 196, PH = 272;
/** ruled lines: the first one, the spacing, how many */
export const RULE0 = 34, LINE = 11, NLINES = 21;
/** the red margin line and the text column */
export const MARGIN_X = 21, TEXT_X = 26, TEXT_R = PW - 10, TEXT_W = TEXT_R - TEXT_X;
export const lineY = (k: number) => RULE0 + k * LINE;

// ---------------------------------------------------------------- colours

export const C = {
  ink: col('#2a2440'), blue: col('#26408a'), red: col('#a8321e'), pencil: col('#5c574e'), green: col('#2f6b3a'),
  pencilLt: col('#8a8478'), redPencil: col('#c0503c'), brown: col('#6a4a2a'),
  out: col('#1a0e10'), shadow: col('#1e1406', 0.42), paperDk: col('#c8b48a'),
  rule: col('#5a82b8'), margin: col('#c8504a'),
};
const SKIN = ['#3a1810', '#9a4a36', '#c8805e', '#f0a878', '#f8c090', '#ffe0b8'].map(c => col(c));
const GLOVE = ['#0c0607', '#1d0e0f', '#2b2122', '#3a2f30', '#4d3a38', '#5e4a46'].map(c => col(c));
const TUNIC = ['#16100f', '#2c2426', '#453c3e', '#5e5456', '#786e70', '#948a8c'].map(c => col(c));

/** a colour function that drops a few pixels (pencil grain) */
export const grainy = (c: number, seed = 77, k = 0.16) => (x: number, y: number) => (hash2(x, y, seed) < k ? 0 : c);

// ---------------------------------------------------------------- text

export interface HandOpts { bold?: boolean; scale?: number; pencil?: boolean; block?: boolean; spacing?: number }
/** Mori's handwriting (baseline at y); returns the advance */
export function hand(a: Art, s: string, x: number, y: number, c: number, o: HandOpts = {}): number {
  return drawText(a, s, x, y, o.pencil ? grainy(c) : c, { face: o.block ? 'block' : 'hand', bold: o.bold, scale: o.scale, spacing: o.spacing });
}
export const handW = (s: string, o: HandOpts = {}) => textWidth(s, { face: o.block ? 'block' : 'hand', bold: o.bold, scale: o.scale, spacing: o.spacing });
/** greedy wrap into lines no wider than w */
export function wrap(s: string, w: number, o: HandOpts = {}): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const wd of words) {
      const t = cur ? cur + ' ' + wd : wd;
      if (cur && handW(t, o) > w) { out.push(cur); cur = wd; } else cur = t;
      // a single word longer than the line: cut it
      while (handW(cur, o) > w && cur.length > 2) {
        let k = cur.length - 1;
        while (k > 1 && handW(cur.slice(0, k) + '-', o) > w) k--;
        out.push(cur.slice(0, k) + '-');
        cur = cur.slice(k);
      }
    }
    out.push(cur);
  }
  return out.length ? out : [''];
}

/** text in the pixel display font with a hard outline (hints floating over the scene) */
export function outlined(a: Art, s: string, x: number, y: number, c: number, o: HandOpts = {}) {
  const sh = col('#140c06');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [1, 2]]) hand(a, s, x + dx, y + dy, sh, o);
  hand(a, s, x, y, c, o);
}

// ---------------------------------------------------------------- ink marks as pixel paths (drawn on in order)

export type Px = [number, number][];
export function pxLine(x0: number, y0: number, x1: number, y1: number, out: Px = []): Px {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    const l = out[out.length - 1];
    if (!l || l[0] !== x0 || l[1] !== y0) out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}
export function pxPoly(pts: [number, number][], out: Px = []): Px {
  for (let i = 1; i < pts.length; i++) pxLine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], out);
  return out;
}
/** a hand-drawn near-horizontal line (strike-throughs, underlines): a gentle wave, slightly uphill */
export function wavyPx(x0: number, y: number, x1: number, seed: number, amp = 0.8): Px {
  const R = rng(seed * 31 + 5);
  const pts: [number, number][] = [];
  const n = Math.max(2, Math.round((x1 - x0) / 9));
  const ph = R() * 6, rise = (R() - 0.6) * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t + (i > 0 && i < n ? (R() - 0.5) * 2 : 0), y + Math.sin(ph + t * 5) * amp - rise * t + (R() - 0.5) * 0.6]);
  }
  return pxPoly(pts);
}
/** a tick inside a box at (x, y) size s, overshooting up and right like a quick pen flick */
export function tickPx(x: number, y: number, s: number, seed: number): Px {
  const R = rng(seed * 17 + 3);
  const j = () => Math.round((R() - 0.5) * 2);
  return pxPoly([[x + 1 + j(), y + s * 0.5], [x + s * 0.38, y + s - 1], [x + s + 3 + j(), y - 3 + j()]]);
}
/** a rough little box (the pen goes round once, overshooting the corners) */
export function boxPx(x: number, y: number, w: number, h: number, seed: number): Px {
  const R = rng(seed * 13 + 1);
  const j = () => Math.round((R() - 0.5) * 1.4);
  return pxPoly([[x - 1, y + j()], [x + w + j(), y], [x + w, y + h + j()], [x + j(), y + h], [x, y - 1]]);
}
/** a loop round something (circling a word or a place) */
export function loopPx(cx: number, cy: number, rx: number, ry: number, seed: number): Px {
  const R = rng(seed * 7 + 9);
  const pts: [number, number][] = [];
  const a0 = R() * Math.PI * 2, n = 22, over = 0.18 + R() * 0.2;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 * (1 + over);
    const k = 1 + (R() - 0.5) * 0.08 + (i / n) * 0.06;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pxPoly(pts);
}
/** a quick arrow from (x0, y0) to (x1, y1) */
export function arrowPx(x0: number, y0: number, x1: number, y1: number, seed: number, head = 4): Px {
  const R = rng(seed * 3 + 11);
  const mx = (x0 + x1) / 2 + (R() - 0.5) * 3, my = (y0 + y1) / 2 - Math.abs(x1 - x0) * 0.08;
  const out = pxPoly([[x0, y0], [mx, my], [x1, y1]]);
  const a = Math.atan2(y1 - my, x1 - mx);
  pxLine(x1, y1, x1 - Math.cos(a - 0.6) * head, y1 - Math.sin(a - 0.6) * head, out);
  pxLine(x1 - Math.cos(a + 0.6) * head, y1 - Math.sin(a + 0.6) * head, x1, y1, out);
  return out;
}
/** plot the first n pixels of a path (w: brush size; pencil: grainy) */
export function plot(a: Art, p: Px, c: number, n = p.length, o: { w?: number; pencil?: boolean; ox?: number; oy?: number } = {}) {
  const w = o.w ?? 1, ox = o.ox ?? 0, oy = o.oy ?? 0;
  const lim = Math.min(n, p.length);
  for (let i = 0; i < lim; i++) {
    const [x, y] = p[i];
    for (let j = 0; j < w; j++) for (let k = 0; k < w; k++) {
      const X = x + k + ox, Y = y + j + oy;
      if (o.pencil && hash2(X, Y, 31) < 0.2) continue;
      a.px(X, Y, c);
    }
  }
}

// ---------------------------------------------------------------- doodles (the kit's margin drawings)

const doodleCache = new Map<string, Art>();
/** a margin doodle (boat tent palm fish crab camera sun wave pug footprints pin star mountain fire bird
 *  shell leaf compass feather magnifier) as a size x size buffer */
export function doodleArt(name: string, size: number, color: number, o: { pencil?: boolean; seed?: number } = {}): Art {
  const k = `${name}|${size}|${color}|${o.pencil ? 1 : 0}|${o.seed ?? 1}`;
  let a = doodleCache.get(k);
  if (!a) {
    a = new Art(size, size);
    const fn = DOODLES[name] ?? DOODLES.star;
    const hex = '#' + [color & 255, (color >>> 8) & 255, (color >>> 16) & 255].map(v => v.toString(16).padStart(2, '0')).join('');
    rasterStrokes(a, 100, 100, fn(o.seed ?? 1).map(s => ({ ...s, c: s.c ?? hex, w: s.w ?? (size > 40 ? 2.4 : 2), tex: o.pencil ? 'pencil' as const : 'none' as const })), false, 1);
    doodleCache.set(k, a);
  }
  return a;
}

// ---------------------------------------------------------------- paper

export type PaperKind = 'ruled' | 'plain' | 'graph' | 'kraft' | 'endpaper';
const paperCache = new Map<string, Art>();

/** a page's paper (cached per kind, seed and side): ruled lines, the margin, the gutter and age */
export function paperArt(kind: PaperKind, seed: number, side: 'l' | 'r', age = 1): Art {
  const key = `${kind}|${seed}|${side}|${age}`;
  let a = paperCache.get(key);
  if (a) return a;
  a = new Art(PW, PH);
  const tile = paperTileArt(kind === 'kraft' ? 'kraft' : kind === 'endpaper' ? 'kraft' : 'journal');
  const ox = (seed * 37) % 128, oy = (seed * 59) % 128;
  const gx = side === 'r' ? 0 : PW - 1;
  const R = rng(seed * 101 + 7);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    let c = tile.d[((y + oy) & 127) * 128 + ((x + ox) & 127)];
    if (kind === 'graph' && ((x - 3) % 8 === 0 || (y - 2) % 8 === 0)) c = mixC(c, col('#6aa890'), (x - 3) % 32 === 0 || (y - 2) % 32 === 0 ? 0.42 : 0.24);
    a.put(x, y, c);
  }
  // ruled lines (dithered so they read as printed ink on paper), the red margin
  if (kind === 'ruled') {
    for (let k = 0; k < NLINES; k++) {
      const y = lineY(k);
      for (let x = 2; x < PW - 2; x++) if (dith(x, y, 0.62)) a.put(x, y, mixC(a.get(x, y), C.rule, 0.42));
    }
    // a heavier rule under the head band
    for (let x = 2; x < PW - 2; x++) if (dith(x, 22, 0.8)) a.put(x, 22, mixC(a.get(x, 22), C.rule, 0.5));
    for (let y = 2; y < PH - 2; y++) {
      a.put(MARGIN_X, y, mixC(a.get(MARGIN_X, y), C.margin, 0.5));
      if (dith(MARGIN_X + 1, y, 0.3)) a.put(MARGIN_X + 1, y, mixC(a.get(MARGIN_X + 1, y), C.margin, 0.3));
    }
  }
  if (age > 0) ageArt(a, seed, side, R, kind);
  // the gutter: paper darkens and curves into the binding (dithered steps)
  const gutter = col('#3a2410');
  for (let y = 0; y < PH; y++) for (let i = 0; i < 12; i++) {
    const x = side === 'r' ? i : PW - 1 - i;
    const cov = Math.pow(1 - i / 12, 2.2) * 0.55;
    if (dith(x, y, cov)) a.put(x, y, mixC(a.get(x, y), gutter, 0.32));
  }
  // toasted outer edges
  const burn = col('#8a5a26');
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const dOut = Math.min(y, PH - 1 - y, side === 'r' ? PW - 1 - x : x);
    if (dOut > 3) continue;
    const n = fbm(x / 9, y / 9, seed + 3, 2);
    const cov = (dOut === 0 ? 0.75 : dOut === 1 ? 0.42 : dOut === 2 ? 0.2 : 0.08) * (0.6 + n * 0.8);
    if (dith(x, y, cov)) a.put(x, y, mixC(a.get(x, y), burn, 0.38));
  }
  void gx;
  paperCache.set(key, a);
  if (paperCache.size > 120) paperCache.delete(paperCache.keys().next().value!);
  return a;
}

function ageArt(a: Art, seed: number, side: 'l' | 'r', R: () => number, kind: PaperKind) {
  const outer = side === 'r' ? PW - 1 : 0;
  // a coffee ring (some pages)
  if (R() < 0.22) {
    const r = 13 + R() * 12, cx = 30 + R() * (PW - 60), cy = 60 + R() * (PH - 110);
    coffeeRing(a, cx, cy, r, seed);
  }
  // pencil smudges where the side of the hand dragged
  const nSm = R() < 0.5 ? 1 + Math.floor(R() * 2) : 0;
  for (let i = 0; i < nSm; i++) smudge(a, 20 + R() * (PW - 60), 40 + R() * (PH - 80), 14 + R() * 18, 4 + R() * 5, seed + i * 7);
  // the thumb print near the bottom outer corner (where Mori holds it)
  if (R() < 0.35) thumbPrint(a, side === 'r' ? PW - 22 - R() * 10 : 22 + R() * 10, PH - 22 - R() * 8, seed);
  // foxing
  const fox = col('#a8743a');
  const nF = 2 + Math.floor(R() * 7);
  for (let i = 0; i < nF; i++) {
    const x = Math.floor(R() * PW), y = Math.floor(R() * PH);
    a.put(x, y, mixC(a.get(x, y), fox, 0.45));
    if (R() < 0.4) a.put(x + 1, y, mixC(a.get(x + 1, y), fox, 0.3));
  }
  // a water mark (rare)
  if (R() < 0.08 && kind !== 'kraft') waterMark(a, 30 + R() * (PW - 60), 60 + R() * (PH - 120), 18 + R() * 16, seed);
  // a dog-eared outer corner (the flap folded over; the corner itself is gone and shows the page below)
  if (R() < 0.16) {
    const s = 8 + Math.floor(R() * 6), top = R() < 0.5;
    dogEar(a, outer, top ? 0 : PH - 1, s, side, top);
  }
}

export function coffeeRing(a: Art, cx: number, cy: number, r: number, seed: number) {
  const ring = col('#7a4a1e'), wash = col('#a8783a');
  const R = rng(seed + 991);
  const gap0 = R() * Math.PI * 2, gapW = R() < 0.6 ? 0.6 + R() * 1.4 : 0;
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y++) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x++) {
    if (x < 1 || y < 1 || x >= a.w - 1 || y >= a.h - 1) continue;
    const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.06);
    const ang = Math.atan2(y - cy, x - cx);
    let da = Math.abs(((ang - gap0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const inGap = gapW > 0 && da < gapW / 2;
    const n = fbm(x / 5, y / 5, seed, 2);
    const e = Math.abs(d - r);
    if (e < 1.2 && !inGap) { if (dith(x, y, 0.55 + n * 0.4)) a.put(x, y, mixC(a.get(x, y), ring, 0.42)); }
    else if (e < 2.4 && !inGap) { if (dith(x, y, 0.25 * n)) a.put(x, y, mixC(a.get(x, y), ring, 0.3)); }
    else if (d < r - 1 && dith(x, y, 0.1 + n * 0.08)) a.put(x, y, mixC(a.get(x, y), wash, 0.18));
    da = 0;
  }
}
export function smudge(a: Art, x0: number, y0: number, w: number, h: number, seed: number) {
  const g = col('#6a6458');
  for (let y = Math.floor(y0 - h); y <= y0 + h; y++) for (let x = Math.floor(x0 - w); x <= x0 + w; x++) {
    const u = (x - x0) / w, v = (y - y0) / h;
    const e = 1 - (u * u + v * v);
    if (e <= 0) continue;
    const n = fbm(x / 4, y / 7, seed, 2);
    if (dith(x, y, e * 0.22 * (0.4 + n))) a.put(x, y, mixC(a.get(x, y), g, 0.32));
  }
}
function thumbPrint(a: Art, cx: number, cy: number, seed: number) {
  const g = col('#6a5e50');
  for (let y = Math.floor(cy - 9); y <= cy + 9; y++) for (let x = Math.floor(cx - 7); x <= cx + 7; x++) {
    const u = (x + 0.5 - cx) / 7, v = (y + 0.5 - cy) / 9;
    const r = Math.sqrt(u * u + v * v);
    if (r > 1) continue;
    const ridge = Math.sin(r * 15 + hash2(x >> 2, y >> 2, seed) * 1.2);
    if (ridge > 0.55 && dith(x, y, 0.45 * (1 - r * 0.7))) a.put(x, y, mixC(a.get(x, y), g, 0.22));
  }
}
function waterMark(a: Art, cx: number, cy: number, r: number, seed: number) {
  const g = col('#b89a68');
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r * 1.3 - 2); x <= cx + r * 1.3 + 2; x++) {
    const n = fbm(x / 10, y / 10, seed + 5, 3);
    const d = Math.hypot((x - cx) / 1.3, y - cy) / r + (n - 0.5) * 0.6;
    if (d < 0.94 && dith(x, y, 0.07)) a.put(x, y, mixC(a.get(x, y), g, 0.25));
    else if (d >= 0.94 && d < 1.02) a.put(x, y, mixC(a.get(x, y), g, 0.3));
  }
}
function dogEar(a: Art, ex: number, ey: number, s: number, side: 'l' | 'r', top: boolean) {
  const sx = side === 'r' ? -1 : 1, sy = top ? 1 : -1;
  const back = col('#d8c49a'), crease = col('#9a7e52'), sh = col('#2a1a08', 0.3);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const x = ex + sx * i, y = ey + sy * j;
    if (i + j < s - 1) a.put(x, y, 0); // the missing corner
  }
  // the flap: the corner reflected over the fold, showing the back of the paper
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    if (i + j < s - 1) continue;
    const fi = s - 1 - j, fj = s - 1 - i; // reflection
    if (fi + fj > s - 1 + 0) continue;
    const x = ex + sx * i, y = ey + sy * j;
    const k = i + j === s - 1 ? crease : (fi + fj > s - 3 ? shadeC(back, -0.06) : back);
    a.put(x, y, k);
  }
  // a hard dithered shadow under the flap's edges
  for (let i = 0; i < s; i++) { const x = ex + sx * (s + 0), y = ey + sy * i; if (dith(x, y, 0.5)) a.px(x, y, sh); }
  for (let i = 0; i < s; i++) { const x = ex + sx * i, y = ey + sy * s; if (dith(x, y, 0.5)) a.px(x, y, sh); }
}

/** the back of a sheet in one-page mode: blank paper with the front's ink showing through, mirrored */
export function showThrough(front: Art, seed: number): Art {
  const b = paperArt('plain', seed + 17, 'l', 1).d;
  const a = new Art(PW, PH);
  a.d.set(b);
  const ghost = col('#7a6e5c');
  const paper = paperArt('ruled', seed, 'r', 1);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const f = front.d[y * PW + (PW - 1 - x)];
    const p = paper.d[y * PW + (PW - 1 - x)];
    if (f !== p && (f >>> 24) && dith(x, y, 0.22)) a.put(x, y, mixC(a.get(x, y), ghost, 0.3));
  }
  return a;
}

// ---------------------------------------------------------------- things stuck on the page

/** a strip of masking tape, w x h, at an angle (degrees), centred on (cx, cy) */
export function tapeAt(a: Art, cx: number, cy: number, w: number, h: number, deg: number, seed: number) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const base = col('#efe2b4', 0.8), edge = col('#d8c890', 0.9), sheen = col('#fffbea', 0.6);
  const hw = w / 2, hh = h / 2;
  const x0 = Math.floor(cx - hw - hh - 2), x1 = Math.ceil(cx + hw + hh + 2), y0 = Math.floor(cy - hw - hh - 2), y1 = Math.ceil(cy + hw + hh + 2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    const zig = (hash2(Math.round(v), u > 0 ? 1 : 2, seed) * 2);
    if (Math.abs(v) > hh || Math.abs(u) > hw - zig) continue;
    let k = base;
    if (Math.abs(v) > hh - 1) k = edge;
    else if ((Math.round(u + v * 2) % 9 === 0) && dith(x, y, 0.5)) k = sheen;
    a.px(x, y, k);
  }
}

/** a hard dithered drop shadow for a rect */
export function dropShadow(a: Art, x: number, y: number, w: number, h: number, d = 2, k = 0.55) {
  const sh = col('#1e1406', 0.45);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i + d, Y = y + j + d;
    if (i + d < w && j + d < h) continue;
    if (dith(X, Y, k)) a.px(X, Y, sh);
  }
}

/** a photo print with a white border (and a caption strip when cap is set) */
export function photoAt(a: Art, img: Art | null, x: number, y: number, w: number, h: number, o: { cap?: string; border?: number; tape?: boolean; seed?: number } = {}) {
  const b = o.border ?? 3, capH = o.cap !== undefined ? 11 : 0;
  const W = w + b * 2, H = h + b * 2 + capH;
  dropShadow(a, x, y, W, H, 2);
  const white = col('#f6f1e2'), edge = col('#d6ccb4');
  a.rect(x, y, W, H, white);
  a.rect(x, y + H - 1, W, 1, edge); a.rect(x + W - 1, y, 1, H, edge);
  if (img) blitFit(a, img, x + b, y + b, w, h);
  else {
    const g1 = col('#3a3a3e'), g2 = col('#56565c');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a.put(x + b + i, y + b + j, dith(i, j, 0.3 + (j / h) * 0.3) ? g2 : g1);
  }
  if (o.cap) hand(a, o.cap, x + Math.round((W - handW(o.cap)) / 2), y + H - 3, C.pencil, { pencil: true });
  if (o.tape) {
    const s = o.seed ?? 1;
    tapeAt(a, x + 4, y + 2, 16, 6, -38 + (s % 9), s);
    tapeAt(a, x + W - 4, y + 2, 16, 6, 36 - (s % 7), s + 3);
  }
  return [W, H] as [number, number];
}
/** blit a buffer cropped / centred into a w x h box at (x, y) (no scaling) */
export function blitFit(a: Art, src: Art, x: number, y: number, w: number, h: number) {
  const ox = Math.floor((src.w - w) / 2), oy = Math.floor((src.h - h) / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = i + ox, sy = j + oy;
    if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
    const c = src.d[sy * src.w + sx];
    if (c >>> 24) a.px(x + i, y + j, c);
  }
}

/** a sticky note (yellow) with a curled corner */
export function stickyAt(a: Art, x: number, y: number, w: number, h: number, color = '#f8e886') {
  const m = col(color), d = shadeC(m, -0.16), l = shadeC(m, 0.3);
  dropShadow(a, x, y, w, h, 2, 0.5);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (i >= w - 5 && j >= h - 5 && (i - (w - 5)) + (j - (h - 5)) > 4) continue;
    let k = m;
    if (j < 4) k = mixC(m, d, 0.4);
    else if (j > h - 8 && dith(i, j, (j - (h - 8)) / 10)) k = d;
    if (i === 0 || j === 0) k = l;
    a.put(x + i, y + j, k);
  }
  for (let i = 0; i < 5; i++) a.put(x + w - 5 + i, y + h - 1 - i, shadeC(d, -0.2));
}

/** a rubber stamp (blocky caps, uneven ink) at (x, y), askew; k < 1 is the stamp coming down */
export function stampAt(a: Art, text: string, x: number, y: number, o: { color?: string; round?: boolean; small?: string; size?: 'sm' | 'md' | 'lg'; deg?: number; seed?: number; k?: number } = {}): [number, number] {
  const art = stampCached(text, o.small ?? '', !!o.round, o.color ?? '#a8321e', o.size ?? 'md', o.seed ?? 3, Math.round(o.deg ?? -6));
  const k = o.k ?? 1;
  if (k < 1) {
    // pressing down: an inked outline grows in, then the body fills
    if (k < 0.5) return [art.w, art.h];
    const cov = (k - 0.5) * 2;
    for (let j = 0; j < art.h; j++) for (let i = 0; i < art.w; i++) { const c = art.d[j * art.w + i]; if (c >>> 24 && dith(x + i, y + j, cov)) a.px(x + i, y + j, c); }
    return [art.w, art.h];
  }
  a.blit(art, x, y);
  return [art.w, art.h];
}
const stampCache = new Map<string, Art>();
function stampCached(text: string, small: string, round: boolean, hex: string, size: 'sm' | 'md' | 'lg', seed: number, deg: number): Art {
  const k = [text, small, round, hex, size, seed, deg].join('|');
  let s = stampCache.get(k);
  if (!s) { s = rotateArt(stampArt(text, small, round, hex, size, seed), deg); stampCache.set(k, s); }
  return s;
}

/** a hand-drawn heart (7 x 6): filled in red pencil, or just its outline in graphite */
export function heartAt(a: Art, x: number, y: number, filled: boolean, half = false) {
  const rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const edge = ['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'];
  const ink = filled ? C.red : C.pencil, fill = col('#d8584a');
  for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) {
    if (edge[j][i] === '#') { if (!filled && hash2(x + i, y + j, 5) < 0.18) continue; a.px(x + i, y + j, ink); }
    else if (rows[j][i] === '#' && filled && (!half || i < 4) && dith(x + i, y + j, 0.75)) a.px(x + i, y + j, fill);
  }
}

/** a hand-drawn progress bar: a pencil box, scribbled in ink to k */
export function barAt(a: Art, x: number, y: number, w: number, h: number, k: number, seed: number, c = C.blue) {
  plot(a, boxPx(x, y, w, h, seed), C.pencil, Infinity, { pencil: true });
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, k)));
  if (fw < 1) return;
  const R = rng(seed + 4);
  const p: Px = [];
  for (let i = 0; i + 2 <= fw; i += 2) pxLine(x + 1 + i + (R() - 0.5), y + 2, x + 2 + i + (R() - 0.5), y + h - 2, p);
  plot(a, p, c);
}

// ---------------------------------------------------------------- the cover

export const COVER_HEX = '#6a4a2c';
let leatherT: Art | null = null;
/** the notebook's leather (a seamless 128 px tile): soft patches of wear, a fine pebbled grain with
 *  its bumps lit from the upper left, the odd dark pore; a few tones, ordered dithering between them */
export function leatherArt(): Art {
  if (leatherT) return leatherT;
  const a = new Art(128, 128);
  const tones = ['#3a2614', '#4a321c', '#583e24', '#664a2c', '#745636', '#866644'].map(c => col(c));
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const patch = fbm(x / 32, y / 32, 71, 3, 4);
    const grain = fbm(x / 2.6, y / 2.6, 13, 2, 128 / 2.6 | 0);
    const lit = fbm((x + 1) / 2.6, (y + 1) / 2.6, 13, 2, 128 / 2.6 | 0) - grain;
    let l = 2.4 + (patch - 0.5) * 2.4 + lit * 5;
    if (hash2(x, y, 3) < 0.012) l -= 1.4;
    const i = Math.max(0, Math.min(5, Math.floor(l + bayer(x, y) - 0.5)));
    a.put(x, y, tones[i]);
  }
  leatherT = a;
  return a;
}
/** the closed notebook's front board: worn leather, stitched edges, a paper label, scratches, a ring, a sticker */
export function coverArt(w: number, h: number): Art {
  const a = new Art(w, h);
  const tile = leatherArt();
  const base = col(COVER_HEX), out = shadeC(base, -0.66), lt = shadeC(base, 0.22), dk = shadeC(base, -0.32);
  const R = 3;
  const inside = (x: number, y: number) => {
    const cx = x < R ? R - x : x >= w - R ? x - (w - 1 - R) : 0, cy = y < R ? R - y : y >= h - R ? y - (h - 1 - R) : 0;
    return x >= 0 && y >= 0 && x < w && y < h && cx * cx + cy * cy <= R * R + 1;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    let c = tile.d[(y & 127) * 128 + (x & 127)];
    // worn, lighter leather along the edges and at the corners
    const dE = Math.min(x, y, w - 1 - x, h - 1 - y);
    const corner = Math.min(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
    const wear = (dE < 4 ? (4 - dE) / 4 * 0.5 : 0) + (corner < 14 ? (14 - corner) / 14 * 0.6 : 0);
    if (wear > 0 && dith(x, y, wear * (0.5 + fbm(x / 4, y / 4, 9, 2)))) c = mixC(c, lt, 0.45);
    if (edge) c = out;
    else if (!inside(x - 2, y) || !inside(x, y - 2)) c = mixC(c, lt, 0.4);
    else if (!inside(x + 2, y) || !inside(x, y + 2)) c = mixC(c, dk, 0.5);
    a.put(x, y, c);
  }
  // the hinge crease near the spine
  for (let y = 3; y < h - 3; y++) { a.px(6, y, dk); a.px(7, y, mixC(a.get(7, y), lt, 0.35)); }
  // stitching round the edge: thread, thread, hole, gap
  const thread = col('#d8c8a0'), threadD = col('#a8946a'), hole = col('#24140a');
  const m = 4;
  const stitch = (x: number, y: number, i: number) => {
    const p = i % 4;
    if (p === 0 || p === 1) a.put(x, y, p === 0 ? thread : threadD);
    else if (p === 2) a.put(x, y, hole);
  };
  let i = 0;
  for (let x = m + 6; x < w - m; x++) stitch(x, m, i++);
  i = 0; for (let y = m; y < h - m; y++) stitch(w - 1 - m, y, i++);
  i = 0; for (let x = w - 1 - m; x >= m + 6; x--) stitch(x, h - 1 - m, i++);
  // scratches (pale, short, diagonal)
  const Rr = rng(4242);
  for (let k = 0; k < 14; k++) {
    const x0 = 12 + Rr() * (w - 24), y0 = 12 + Rr() * (h - 24), L = 3 + Rr() * 9, an = -0.4 + Rr() * 0.8 + (Rr() < 0.5 ? 0 : Math.PI / 2);
    const p = pxLine(x0, y0, x0 + Math.cos(an) * L, y0 + Math.sin(an) * L);
    for (const [x, y] of p) if (Rr() < 0.85) a.put(x, y, mixC(a.get(x, y), lt, 0.6));
  }
  // a water ring from a mug set down on it
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - w * 0.34, (y - h * 0.74) * 1.08);
    if (Math.abs(d - 17) < 1.2 && dith(x, y, 0.6 * fbm(x / 5, y / 5, 3, 2) + 0.2)) a.put(x, y, mixC(a.get(x, y), dk, 0.5));
  }
  // the label: a cream paper slip, glued on, its corners lifting a little
  const lw = Math.min(84, w - 40), lh = 40, lx = Math.round((w - lw) / 2) + 2, ly = Math.round(h * 0.2);
  const lab = paperTileArt('card');
  dropShadow(a, lx, ly, lw, lh, 1, 0.6);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    if ((x === 0 || x === lw - 1) && (y === 0 || y === lh - 1)) continue;
    let c = lab.d[(y & 127) * 128 + (x & 127)];
    if (x === 0 || y === 0 || x === lw - 1 || y === lh - 1) c = col('#8a7a5a');
    else if (x === 2 || y === 2 || x === lw - 3 || y === lh - 3) c = mixC(c, col('#a8321e'), 0.55);
    if (fbm(x / 6, y / 6, 21, 2) > 0.66 && dith(x, y, 0.3)) c = mixC(c, col('#b8945a'), 0.3);
    a.put(lx + x, ly + y, c);
  }
  const t1 = 'FIELD NOTES';
  hand(a, t1, lx + Math.round((lw - handW(t1, { block: true })) / 2), ly + 14, col('#2a2440'), { block: true });
  const t2 = 'Mori';
  hand(a, t2, lx + Math.round((lw - handW(t2, { bold: true, scale: 2 })) / 2) - 6, ly + 33, col('#26408a'), { bold: true, scale: 2 });
  const t3 = 'no. 3';
  hand(a, t3, lx + lw - handW(t3) - 5, ly + lh - 4, C.pencil, { pencil: true });
  // a round sticker (a fern), half peeled and scuffed
  const sx = Math.round(w * 0.7), sy = Math.round(h * 0.62), sr = 12;
  for (let y = -sr; y <= sr; y++) for (let x = -sr; x <= sr; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5);
    if (d > sr) continue;
    if (hash2(x + sx, y + sy, 77) < 0.06 || (x > 4 && y < -4 && fbm(x / 3, y / 3, 5, 2) > 0.58)) continue;
    let c = d > sr - 1.2 ? col('#f2ecd8') : col('#2f6b3a');
    if (d < sr - 2.5) {
      // the fern: a curved stem with leaflets
      const st = Math.abs(x - Math.round(Math.sin((y + sr) / 6) * 2)) < 1 && y < sr - 4;
      const leaf = Math.abs(Math.abs(x - Math.sin((y + sr) / 6) * 2) - (sr - 3 - Math.abs(y + 2)) * 0.45) < 0.9 && y % 3 !== 0 && y > -sr + 3 && y < sr - 4;
      if (st || leaf) c = col('#e8f2d0');
    }
    a.put(sx + x, sy + y, c);
  }
  return a;
}

/** the inside of the front cover: kraft board with Mori's name and a pocket */
export function insideCoverArt(): Art {
  const a = new Art(PW, PH);
  a.d.set(paperArt('kraft', 5, 'l', 1).d);
  const ink = C.ink;
  const lines = ['If found, please return to', '', 'MORI', '', 'c/o the Kittiwake', '(or what is left of her)', 'or to a very worried pug.'];
  let y = 46;
  for (const l of lines) {
    if (!l) { y += 6; continue; }
    const big = l === 'MORI';
    const w = handW(l, { bold: big, scale: big ? 2 : 1 });
    hand(a, l, Math.round((PW - w) / 2), y, big ? C.blue : ink, { bold: big, scale: big ? 2 : 1 });
    y += big ? 20 : 12;
  }
  // Chunk, drawn in pencil
  a.blit(doodleArt('pug', 46, C.pencil, { pencil: true, seed: 3 }), Math.round(PW / 2 - 23), y + 6);
  hand(a, 'Chunk (asleep)', Math.round(PW / 2 - handW('Chunk (asleep)') / 2), y + 60, C.pencil, { pencil: true });
  // the pocket glued in at the bottom, tickets and a feather sticking out
  const px = 16, pw = PW - 32, py = PH - 64, ph = 52;
  const tick = col('#e8dcb8'), tickR = col('#c8503c');
  a.rect(px + 18, py - 14, 26, 20, tick); a.rect(px + 18, py - 14, 26, 1, col('#8a7a5a')); a.rect(px + 18, py - 14, 1, 20, col('#8a7a5a'));
  for (let i = 0; i < 4; i++) a.put(px + 22 + i * 5, py - 9, tickR);
  hand(a, 'ADMIT 1', px + 21, py - 3, tickR, { block: true });
  const fx = px + pw - 40;
  for (let i = 0; i < 26; i++) { const x = fx + i, y2 = py - 4 - Math.round(i * 0.7); a.put(x, y2, col('#5a4a3a')); if (i > 4) { a.put(x, y2 - 1, col('#c8b89a')); a.put(x - 1, y2 + 1, col('#a89a7a')); } }
  const k1 = col('#9c7446'), k2 = col('#7a5430'), k3 = col('#b58b5c');
  dropShadow(a, px, py, pw, ph, 2, 0.6);
  for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
    let c = dith(i, j, 0.5) ? k1 : k3;
    if (j === 0 || i === 0 || i === pw - 1 || j === ph - 1) c = k2;
    else if (j === 1) c = shadeC(k3, 0.2);
    else if ((i === 3 || i === pw - 4) && j % 3 !== 0) c = col('#e8d8b0');
    a.put(px + i, py + j, c);
  }
  hand(a, 'receipts & bits', px + 8, py + 20, col('#3a2614'));
  return a;
}

/** the elastic band (vertical), h tall */
export function bandArt(h: number): Art {
  const a = new Art(5, h);
  const d = col('#141010'), m = col('#2a2420'), l = col('#4a3e36'), sh = col('#000000', 0.35);
  for (let y = 0; y < h; y++) {
    a.put(0, y, d); a.put(1, y, m); a.put(2, y, (y % 6 === 0) ? m : l); a.put(3, y, d);
    if (dith(4, y, 0.6)) a.put(4, y, sh);
  }
  return a;
}

// ---------------------------------------------------------------- Mori's hands

/** a tapered capsule from (ax, ay) (radius r0) to (bx, by) (radius r1), shaded per pixel: f(light 0..1, t 0 at a .. 1 at b, x, y) */
function capsule(a: Art, ax: number, ay: number, bx: number, by: number, r0: number, r1: number, f: (l: number, t: number, x: number, y: number) => number, mask?: Art) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1, L = Math.sqrt(L2);
  const R = Math.max(r0, r1);
  const x0 = Math.floor(Math.min(ax, bx) - R - 1), x1 = Math.ceil(Math.max(ax, bx) + R + 1), y0 = Math.floor(Math.min(ay, by) - R - 1), y1 = Math.ceil(Math.max(ay, by) + R + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const qx = x + 0.5 - ax, qy = y + 0.5 - ay;
    const t = Math.max(0, Math.min(1, (qx * vx + qy * vy) / L2));
    const r = r0 + (r1 - r0) * t;
    const dx = qx - vx * t, dy = qy - vy * t, d = Math.hypot(dx, dy);
    if (d > r) continue;
    // which side of the axis (light from the upper left), and how round it is here
    const side = (dx * -vy + dy * vx) / L / r;
    const n = Math.sqrt(Math.max(0, 1 - (d / r) * (d / r)));
    a.put(x, y, f(0.5 + side * 0.32 + n * 0.28 - 0.14, t, x, y));
    if (mask) mask.put(x, y, 0xff000000);
  }
}
/** pick from a ramp with ordered dithering between its steps (l 0..1) */
const ramp = (r: number[], l: number, x: number, y: number, lo = 1) => r[Math.max(lo, Math.min(r.length - 1, Math.floor(lo + l * (r.length - lo) + bayer(x, y) * 0.9 - 0.45)))];

/**
 * Mori's right hand holding the book's bottom-right corner (mirror it for the left): the thumb lying
 * over the page, the fingerless glove under the corner with the fingertips curling round the board's
 * edge, the rolled sleeve running down out of the picture. ax, ay is where the book's corner sits in
 * the buffer; len is how far below the corner the picture must reach. `thumb` is the thumb's
 * silhouette (for its shadow on the page).
 */
export function handArt(len: number): { art: Art; ax: number; ay: number; thumb: Art } {
  const ax = 44, ay = 40;
  const W = 104, H = Math.max(ay + 30, Math.round(ay + len) + 4);
  const a = new Art(W, H);
  const thumbM = new Art(W, H);
  // the sleeve: a wide tube from under the hand, down and out to the right, past the bottom edge
  const sx0 = ax + 2, sy0 = ay + 16;
  const dirX = 0.42, dirY = 1;
  const sl: [number, number][] = [[sx0 - 19, sy0 + 2], [sx0 + 17, sy0 - 8], [sx0 + 25 + dirX * H, sy0 + dirY * H], [sx0 - 15 + dirX * H, sy0 + dirY * H]];
  a.poly(sl, (x, y) => {
    const u = ((x - sx0) * dirY - (y - sy0) * dirX) / 21; // -1 left .. 1 right across the sleeve
    let l = 0.66 - u * 0.36 - Math.abs(u) * 0.12;
    const fold = Math.sin((y - x * 0.38) / 4.2 + Math.sin(y / 9) * 1.2);
    if (fold > 0.86 && Math.abs(u) < 0.8) l -= 0.3;
    else if (fold > 0.7 && Math.abs(u) < 0.8) l += 0.1;
    return ramp(TUNIC, l, x, y);
  });
  // the rolled-up cuff (a fatter, lighter band)
  capsule(a, sx0 - 18, sy0 + 6, sx0 + 19, sy0 - 4, 5.2, 5.2, (l, _t, x, y) => ramp(TUNIC, l + 0.16, x, y));
  // the glove's cuff at the wrist, then the back of the hand under the corner
  capsule(a, sx0 - 12, sy0 - 2, sx0 + 13, sy0 - 9, 5, 5, (l, _t, x, y) => ramp(GLOVE, l * 0.9, x, y));
  a.ellipse(ax - 4, ay + 4, 21, 12, (x, y) => {
    const u = (x - (ax - 4)) / 21, v = (y - (ay + 4)) / 12;
    const n = Math.sqrt(Math.max(0, 1 - u * u - v * v));
    return ramp(GLOVE, 0.42 - u * 0.2 - v * 0.3 + n * 0.3, x, y);
  });
  // a seam stitched across the back of the glove
  for (let i = -14; i <= 10; i += 3) a.put(ax - 4 + i, ay + 1 + Math.round(i * 0.15), GLOVE[5]);
  // fingertips curling round the board's outer edge (bare: fingerless gloves)
  for (let k = 0; k < 4; k++) {
    const fy = ay - 30 + k * 8;
    capsule(a, ax - 3, fy + 3, ax + 5, fy, 3.1 - k * 0.15, 3.2 - k * 0.15, (l, t, x, y) => (t < 0.35 ? ramp(GLOVE, l, x, y) : ramp(SKIN, l * 0.85 + 0.05, x, y)));
  }
  // the thumb on the page, up and in from the base of the hand
  const tbx = ax - 16, tby = ay + 3, ttx = ax - 34, tty = ay - 21;
  capsule(a, tbx, tby, ttx, tty, 6.2, 4.9, (l, t, x, y) => (t < 0.32 ? ramp(GLOVE, l + 0.08, x, y) : ramp(SKIN, l, x, y)), thumbM);
  // the nail, the knuckle crease
  const nx = tbx + (ttx - tbx) * 0.86, ny = tby + (tty - tby) * 0.86;
  a.ellipse(nx - 0.5, ny - 0.5, 2.6, 3.2, (x, y) => (y < ny - 1 ? SKIN[5] : SKIN[4]));
  for (let i = -3; i <= 2; i++) { const kx = Math.round(tbx + (ttx - tbx) * 0.56 + i * 0.8), ky = Math.round(tby + (tty - tby) * 0.56 - i * 0.6); a.put(kx, ky, SKIN[1]); }
  a.outline(C.out);
  return { art: a, ax, ay, thumb: thumbM };
}

// ---------------------------------------------------------------- the pen, the pencil, the eraser

export type ToolKind = 'pen' | 'pencil' | 'eraser';
/** a tool standing up in the spine loop (vertical) */
export function toolStandArt(kind: ToolKind): Art {
  if (kind === 'eraser') {
    const a = new Art(10, 13);
    const p = col('#e8a0a8'), pl = col('#f8c8cc'), pd = col('#b8707a'), w = col('#e8e4dc'), wd = col('#a8a49c');
    a.rect(1, 0, 8, 7, p); a.rect(1, 0, 8, 1, pl); a.rect(1, 0, 1, 7, pl); a.rect(8, 0, 1, 7, pd);
    a.rect(1, 7, 8, 5, w); a.rect(8, 7, 1, 5, wd); a.rect(1, 11, 8, 1, wd);
    hand(a, 'S', 4, 11, col('#5a6a9a'), { block: true });
    a.outline(C.out);
    return a;
  }
  const L = kind === 'pen' ? 44 : 40;
  const a = new Art(7, L + 2);
  if (kind === 'pen') {
    const b0 = col('#1a1e2e'), b1 = col('#2c3450'), b2 = col('#4a5680'), gold = col('#d8b048'), goldD = col('#8a6a20'), steel = col('#c8ccd0');
    for (let y = 0; y < L; y++) {
      const nib = y > L - 7;
      if (nib) { const w = Math.max(1, Math.round((L - y) / 2)); for (let x = 3 - w + 1; x <= 3 + w - 1; x++) a.put(x, y, x === 3 ? goldD : steel); continue; }
      a.put(1, y, b0); a.put(2, y, b1); a.put(3, y, b2); a.put(4, y, b1); a.put(5, y, b0);
      if (y === 15 || y === 16) for (let x = 1; x <= 5; x++) a.put(x, y, gold);
    }
    // the clip
    for (let y = 2; y < 16; y++) a.put(5, y, y < 4 ? gold : goldD);
    a.put(6, 14, gold); a.put(6, 15, goldD);
    a.rect(2, 0, 3, 1, b2);
  } else {
    const y0 = col('#e8b830'), y1 = col('#f8d860'), y2 = col('#b88a18'), wood = col('#e8c890'), lead = col('#3a3a40'), fer = col('#b8b8b0'), ferD = col('#78786e'), er = col('#e890a0');
    for (let y = 0; y < L; y++) {
      if (y < 4) { for (let x = 1; x <= 5; x++) a.put(x, y, er); continue; }
      if (y < 8) { for (let x = 1; x <= 5; x++) a.put(x, y, y % 2 ? ferD : fer); continue; }
      if (y > L - 8) { const w = Math.max(0, Math.round((L - y) / 2.4)); for (let x = 3 - w; x <= 3 + w; x++) a.put(x, y, y > L - 3 ? lead : wood); continue; }
      a.put(1, y, y2); a.put(2, y, y0); a.put(3, y, y1); a.put(4, y, y0); a.put(5, y, y2);
    }
  }
  a.outline(C.out);
  return a;
}
/** a tool held for writing: diagonal, the tip at (tx, ty) in the buffer (bottom-left) */
export function toolHoldArt(kind: ToolKind): { art: Art; tx: number; ty: number } {
  if (kind === 'eraser') {
    const a = new Art(16, 14);
    const p = col('#e8a0a8'), pl = col('#f8c8cc'), pd = col('#b8707a'), w = col('#e8e4dc'), wd = col('#a8a49c');
    a.poly([[1, 9], [8, 2], [14, 7], [7, 13]], (x, y) => (x + y < 13 ? (x < 5 ? pl : p) : x + y < 16 ? pd : (y > 10 ? wd : w)));
    a.outline(C.out);
    return { art: a, tx: 3, ty: 11 };
  }
  const st = toolStandArt(kind);
  // rotate the standing tool by 35 degrees (nearest neighbour, crisp)
  const r = rotateArt(st, 35);
  return { art: r, tx: 2, ty: r.h - 3 };
}

// ---------------------------------------------------------------- tabs and the ribbon

export type TabIcon = 'quests' | 'guide' | 'people' | 'map' | 'sketch';
const ICONS: Record<TabIcon, string[]> = {
  quests: ['#######', '#.....#', '#....##', '#.#.#.#', '#..#..#', '#.....#', '#######'],
  guide: ['...##..', '..####.', '.##.##.', '.#.#.#.', '##.#.#.', '#..#...', '...#...'],
  people: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
  map: ['...#...', '..###..', '.#.#.#.', '###.###', '.#.#.#.', '..###..', '...#...'],
  sketch: ['.....##', '....###', '...###.', '..###..', '.###...', '##.....', '#......'],
};
/** a paper tab sticking out of the fore-edge (w x h, the stuck-on part included) */
export function tabArt(hex: string, icon: TabIcon, side: 'l' | 'r', w = 14, h = 24): Art {
  const a = new Art(w, h);
  const base = col(hex), lt = shadeC(base, 0.3), dk = shadeC(base, -0.28);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xo = side === 'r' ? x : w - 1 - x; // 0 at the page edge
    const r = 3;
    const cy = y < r ? r - y : y >= h - r ? y - (h - 1 - r) : 0, cx = xo >= w - r ? xo - (w - 1 - r) : 0;
    if (cx * cx + cy * cy > r * r + 1) continue;
    let c = base;
    if (y < 2) c = lt; else if (y > h - 3) c = dk;
    if (xo === w - 1 || (cx * cx + cy * cy > (r - 1) * (r - 1) + 1 && (cx || cy))) c = dk;
    if (dith(x, y, 0.12)) c = mixC(c, dk, 0.4);
    a.put(x, y, c);
  }
  // the clear tape holding it on (over the page edge)
  for (let y = 2; y < h - 2; y++) for (let k = 0; k < 4; k++) {
    const x = side === 'r' ? k : w - 1 - k;
    a.put(x, y, mixC(a.get(x, y) || col('#f0e6c8'), col('#ffffff'), 0.35));
  }
  const ic = ICONS[icon];
  const ix = side === 'r' ? w - 10 : 3, iy = Math.round(h / 2 - 3.5);
  const ink = shadeC(base, -0.72);
  ic.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '#') a.put(ix + i, iy + j, ink); });
  a.outline(C.out);
  return a;
}

/** the silk ribbon along a polyline (4 px wide), its end cut into a V */
export function ribbonAt(a: Art, pts: [number, number][], hex = '#b8321e') {
  const base = col(hex), lt = shadeC(base, 0.3), dk = shadeC(base, -0.35);
  const path = pxPoly(pts);
  const sh = col('#1e1406', 0.35);
  for (const [x, y] of path) { if (dith(x + 4, y + 1, 0.5)) a.px(x + 4, y + 1, sh); }
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    a.put(x - 2, y, C.out); a.put(x - 1, y, lt); a.put(x, y, base); a.put(x + 1, y, (Math.floor(i / 9) % 3 === 0) ? dk : base); a.put(x + 2, y, C.out);
  }
  // the V cut at the end
  const [ex, ey] = path[path.length - 1];
  for (let j = 0; j < 3; j++) { a.put(ex - 1 + 0, ey - j, 0); a.put(ex, ey - j + 1, 0); }
  a.put(ex - 2, ey + 1, C.out); a.put(ex + 2, ey + 1, C.out); a.put(ex - 1, ey + 1, base); a.put(ex + 1, ey + 1, base);
  a.put(ex, ey, C.out); a.put(ex, ey - 1, C.out);
}

// ---------------------------------------------------------------- pictures

const imgP = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImg(src: string): Promise<HTMLImageElement | null> {
  let p = imgP.get(src);
  if (!p) {
    p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    imgP.set(src, p);
    if (imgP.size > 200) imgP.delete(imgP.keys().next().value!);
  }
  return p;
}

/** a photo cut down to w x h by averaging (crop in 0..1), its colours posterised a little and
 *  dithered, so it sits on the page as pixel art */
export function photoArt(img: HTMLImageElement | HTMLCanvasElement, w: number, h: number, crop: [number, number, number, number] = [0, 0, 1, 1]): Art {
  const sw = (img as HTMLImageElement).naturalWidth || img.width, sh = (img as HTMLImageElement).naturalHeight || img.height;
  let cx0 = crop[0] * sw, cy0 = crop[1] * sh, cw = (crop[2] - crop[0]) * sw, ch = (crop[3] - crop[1]) * sh;
  // match the box's aspect
  const asp = w / h;
  if (cw / ch > asp) { const nw = ch * asp; cx0 += (cw - nw) / 2; cw = nw; } else { const nh = cw / asp; cy0 += (ch - nh) / 2; ch = nh; }
  const k = 4;
  const c = document.createElement('canvas');
  c.width = w * k; c.height = h * k;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.drawImage(img, cx0, cy0, cw, ch, 0, 0, w * k, h * k);
  const d = g.getImageData(0, 0, w * k, h * k).data;
  const a = new Art(w, h);
  const lv = 7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, gg = 0, b = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const o = ((y * k + j) * w * k + x * k + i) * 4; r += d[o]; gg += d[o + 1]; b += d[o + 2]; }
    const n = k * k, t = bayer(x, y) - 0.5;
    const q = (v: number) => Math.max(0, Math.min(255, Math.round((v / n / 255) * (lv - 1) + t) * (255 / (lv - 1))));
    // a warm, slightly faded print
    const R2 = q(r) * 0.92 + 18, G2 = q(gg) * 0.9 + 14, B2 = q(b) * 0.84 + 10;
    a.put(x, y, (255 << 24 | Math.min(255, B2) << 16 | Math.min(255, G2) << 8 | Math.min(255, R2)) >>> 0);
  }
  return a;
}

/** a PixelBuffer-like (data: Uint32Array) as an Art */
export function artOfData(w: number, h: number, data: Uint32Array): Art {
  const a = new Art(w, h);
  a.d.set(data.subarray(0, a.w * a.h));
  return a;
}

/** a buffer scaled by a whole number to fit w x h: down until it fits, or up (at most maxK) to fill it */
export function fitArt(src: Art, w: number, h: number, maxK = 3): Art {
  const k = Math.min(maxK, Math.floor(Math.min(w / src.w, h / src.h)));
  if (k < 1) return fitDown(src, w, h);
  if (k === 1) return src;
  const a = new Art(src.w * k, src.h * k);
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) a.put(x, y, src.d[Math.floor(y / k) * src.w + Math.floor(x / k)]);
  return a;
}
/** a buffer scaled down by whole steps until it fits w x h (nearest neighbour) */
export function fitDown(src: Art, w: number, h: number): Art {
  const k = Math.max(1, Math.ceil(Math.max(src.w / w, src.h / h)));
  if (k === 1) return src;
  const a = new Art(Math.ceil(src.w / k), Math.ceil(src.h / k));
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) a.put(x, y, src.get(x * k + (k >> 1), y * k + (k >> 1)));
  return a;
}

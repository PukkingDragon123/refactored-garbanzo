// Physical UI kit: ink and pencil, drawn by hand, as pixel art. Rough paths that wobble like a real
// pen line (lines, boxes, circles, arrows, underlines, ticks, crosses, scribbles, tally marks) are
// built as path data in a viewBox, then rasterised onto the pixel grid with Bresenham lines (1-3 art
// pixels wide, never anti-aliased): ink is solid, pencil is grainy (broken pixels), faint strokes are
// dithered. svgInk() keeps its old signature but returns a pixel canvas that paints itself at its real
// size, and can draw itself on, pixel by pixel along the stroke.
//
// All coordinates are in the drawing's own viewBox units; every path is deterministic for its seed.

import { rng } from './rng';
import { Art, pxCanvas, keyOf, dith, col, PX } from './px';
import { hash2 } from './rng';

export interface RoughOpts {
  /** wobble amount in units (default 1.2) */
  rough?: number;
  /** curvature of long strokes (default 1) */
  bow?: number;
  seed?: number;
  /** draw the stroke twice, slightly apart, like a quick pen pass (default true) */
  double?: boolean;
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** a hand-drawn straight line (a gently bowed cubic with jittered ends), as path data */
export function roughLine(x1: number, y1: number, x2: number, y2: number, o: RoughOpts = {}): string {
  const R = rng((o.seed ?? 1) * 97 + Math.round(x1 * 7 + y1 * 13 + x2 * 17 + y2 * 19));
  const rough = o.rough ?? 1.2, bow = o.bow ?? 1;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const pass = (k: number) => {
    const j = () => (R() - 0.5) * rough * 2 * k;
    const b = (R() - 0.5) * Math.min(len * 0.04, 6) * bow * k;
    const ax = x1 + j(), ay = y1 + j(), bx = x2 + j(), by = y2 + j();
    const c1x = x1 + (x2 - x1) * 0.3 + nx * b + j() * 0.6, c1y = y1 + (y2 - y1) * 0.3 + ny * b + j() * 0.6;
    const c2x = x1 + (x2 - x1) * 0.7 + nx * b * 0.8 + j() * 0.6, c2y = y1 + (y2 - y1) * 0.7 + ny * b * 0.8 + j() * 0.6;
    return `M${f1(ax)} ${f1(ay)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(bx)} ${f1(by)}`;
  };
  return o.double === false ? pass(1) : pass(1) + pass(0.7);
}

/** a hand-drawn rectangle: four rough lines that overshoot the corners a little */
export function roughRect(x: number, y: number, w: number, h: number, o: RoughOpts = {}): string {
  const s = o.seed ?? 1, ov = Math.min(3, Math.min(w, h) * 0.08);
  const one = { ...o, double: o.double ?? false };
  return roughLine(x - ov * 0.5, y, x + w + ov, y + 0.4, { ...one, seed: s })
    + roughLine(x + w, y - ov * 0.5, x + w - 0.3, y + h + ov, { ...one, seed: s + 1 })
    + roughLine(x + w + ov * 0.5, y + h, x - ov, y + h - 0.4, { ...one, seed: s + 2 })
    + roughLine(x, y + h + ov * 0.5, x + 0.3, y - ov, { ...one, seed: s + 3 });
}

/** a hand-drawn ellipse that doesn't quite close (the pen overlaps where it started) */
export function roughEllipse(cx: number, cy: number, rx: number, ry: number, o: RoughOpts = {}): string {
  const R = rng((o.seed ?? 1) * 131 + Math.round(cx + cy * 3));
  const rough = o.rough ?? 1.2;
  const pass = (k: number, a0: number) => {
    const n = 18, over = 0.12 + R() * 0.18;
    let d = '';
    const tilt = (R() - 0.5) * 0.08;
    for (let i = 0; i <= n; i++) {
      const t = a0 + (i / n) * (Math.PI * 2 * (1 + over));
      const wob = 1 + (R() - 0.5) * 0.06 * rough * k + Math.sin(t * 2 + a0) * 0.02;
      const x = cx + Math.cos(t + tilt) * rx * wob, y = cy + Math.sin(t + tilt) * ry * wob;
      d += i === 0 ? `M${f1(x)} ${f1(y)}` : `L${f1(x)} ${f1(y)}`;
    }
    return d;
  };
  const a0 = -Math.PI * 0.6 + R() * 0.5;
  return o.double === false ? pass(1, a0) : pass(1, a0) + pass(0.6, a0 + 0.4);
}

/** a smooth hand-drawn curve through points (Catmull-Rom), with a little jitter */
export function roughCurve(pts: [number, number][], o: RoughOpts = {}): string {
  const R = rng((o.seed ?? 1) * 211);
  const rough = o.rough ?? 0.8;
  const p = pts.map(([x, y]) => [x + (R() - 0.5) * rough, y + (R() - 0.5) * rough] as [number, number]);
  if (p.length < 2) return '';
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

/**
 * A hand-drawn arrow from (x1,y1) to (x2,y2), curving by `bend` (fraction of its length, + = left),
 * with a two-stroke head. Returns [shaft, head] path data.
 */
export function roughArrow(x1: number, y1: number, x2: number, y2: number, bend = 0.15, o: RoughOpts = {}): [string, string] {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const mx = (x1 + x2) / 2 + nx * len * bend, my = (y1 + y2) / 2 + ny * len * bend;
  const shaft = roughCurve([[x1, y1], [mx, my], [x2, y2]], { ...o, rough: o.rough ?? 0.6 });
  // the head follows the curve's end tangent
  const tx = x2 - mx, ty = y2 - my, tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl, uy = ty / tl, hs = Math.min(10, len * 0.28);
  const a = 0.5;
  const hx1 = x2 - (ux * Math.cos(a) - uy * Math.sin(a)) * hs, hy1 = y2 - (uy * Math.cos(a) + ux * Math.sin(a)) * hs;
  const hx2 = x2 - (ux * Math.cos(-a) - uy * Math.sin(-a)) * hs, hy2 = y2 - (uy * Math.cos(-a) + ux * Math.sin(-a)) * hs;
  const head = roughLine(hx1, hy1, x2, y2, { ...o, double: false, rough: 0.5 }) + roughLine(x2, y2, hx2, hy2, { ...o, double: false, rough: 0.5, seed: (o.seed ?? 1) + 5 });
  return [shaft, head];
}

/** a quick wavy underline `w` long */
export function underline(w: number, o: RoughOpts & { waves?: number } = {}): string {
  const R = rng((o.seed ?? 1) * 59);
  const n = Math.max(3, Math.round(w / 18));
  const amp = 0.9 + (o.rough ?? 1) * 0.6;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * w, 3 + Math.sin(i * 1.7 + R() * 2) * amp * (o.waves ?? 1) + (i / n) * (R() - 0.3) * 2]);
  return roughCurve(pts, { ...o, rough: 0.4 });
}

/** an ink tick (check mark) in a size x size box */
export function tick(size = 20, seed = 1): string {
  const R = rng(seed * 71);
  const s = size;
  return roughCurve([[s * 0.12, s * (0.52 + R() * 0.06)], [s * 0.3, s * 0.68], [s * (0.42 + R() * 0.04), s * 0.86], [s * 0.62, s * 0.5], [s * (0.9 + R() * 0.12), s * (0.06 + R() * 0.06)]], { seed, rough: 0.6 });
}
/** an ink cross */
export function cross(size = 20, seed = 1): string {
  const s = size;
  return roughLine(s * 0.15, s * 0.15, s * 0.85, s * 0.85, { seed, double: false, rough: 0.8 }) + roughLine(s * 0.85, s * 0.12, s * 0.15, s * 0.88, { seed: seed + 3, double: false, rough: 0.8 });
}
/** a zigzag scribble over a w x h area (crossing out, shading in, "redacted") */
export function scribble(w: number, h: number, seed = 1, rows = 0): string {
  const R = rng(seed * 43);
  const n = rows || Math.max(3, Math.round(w / 7));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * w + (R() - 0.5) * 2, i % 2 ? h * (0.8 + R() * 0.2) : h * (R() * 0.2)]);
  return roughCurve(pts, { seed, rough: 0.5 });
}
/** a strike-through line w long (slightly rising, like crossing a line out with one pen stroke) */
export function strike(w: number, seed = 1): string {
  const R = rng(seed * 13);
  return roughCurve([[-2, 2 + R() * 2], [w * 0.4, 1 + R() * 2], [w + 2, R() * 2]], { seed, rough: 0.5 });
}
/** tally marks for n (groups of five with a diagonal), drawn in a box of h height */
export function tally(n: number, h = 16, seed = 1): { d: string; w: number } {
  const R = rng(seed * 29);
  let d = '';
  let x = 2;
  for (let i = 0; i < n; i++) {
    const inGroup = i % 5;
    if (inGroup === 4) {
      d += roughLine(x - 4 * 4.5 - 1, h * 0.75, x + 1, h * 0.25, { seed: seed + i, double: false, rough: 0.6 });
      x += 6;
      continue;
    }
    d += roughLine(x + (R() - 0.5), h * 0.08, x + (R() - 0.5) * 1.5, h * 0.92, { seed: seed + i, double: false, rough: 0.5 });
    x += 4.5;
  }
  return { d, w: x + 2 };
}

// ---------------------------------------------------------------- pixel ink

export interface Stroke {
  d: string;
  /** stroke colour (default ink) */
  c?: string;
  /** stroke width in viewBox units */
  w?: number;
  fill?: string;
  /** 'pencil' grain (broken, lighter pixels) or solid 'ink' */
  tex?: 'pencil' | 'ink' | 'none';
  /** animate drawing on (seconds; 0 = drawn already) */
  draw?: number;
  delay?: number;
  opacity?: number;
}

export const INK = '#2a2440';
export const INK_BLUE = '#26408a';
export const INK_RED = '#a8321e';
export const PENCIL = '#5c574e';
export const INK_GREEN = '#2f6b3a';

/** a CSS colour ('#hex', 'rgb()', 'rgba()', 'none') as a packed pixel colour (null for none) */
export function parseColor(c: string | undefined, alpha = 1): number | null {
  if (!c || c === 'none' || c === 'transparent') return null;
  const m = /^rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(',').map(v => parseFloat(v));
    const hex = '#' + p.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    return col(hex, (p[3] ?? 1) * alpha);
  }
  if (c[0] === '#') return col(c, alpha);
  return col(INK, alpha);
}

type Sub = { pts: [number, number][]; closed: boolean };
const pathCache = new Map<string, Sub[]>();
/** path data (M L H V C S Q T A Z, absolute and relative) flattened into polylines */
export function flattenPath(d: string): Sub[] {
  const hit = pathCache.get(d);
  if (hit) return hit;
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const subs: Sub[] = [];
  let cur: Sub | null = null;
  let x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0, lq = false;
  let i = 0;
  const num = () => parseFloat(toks[i++]);
  const isNum = () => i < toks.length && !/^[A-Za-z]$/.test(toks[i]);
  const lineTo = (nx: number, ny: number) => { if (!cur) { cur = { pts: [[x, y]], closed: false }; subs.push(cur); } cur.pts.push([nx, ny]); x = nx; y = ny; };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const n = 14, x0 = x, y0 = y;
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      lineTo(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
  };
  const quad = (x1: number, y1: number, x2: number, y2: number) => {
    const n = 10, x0 = x, y0 = y;
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; lineTo(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2); }
  };
  while (i < toks.length) {
    if (!isNum()) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { if (cur) { cur.closed = true; cur.pts.push([sx, sy]); } x = sx; y = sy; cur = null; continue; }
    if (!isNum()) break;
    if (C === 'M') { x = num() + ox; y = num() + oy; sx = x; sy = y; cur = { pts: [[x, y]], closed: false }; subs.push(cur); cmd = rel ? 'l' : 'L'; lq = false; continue; }
    if (C === 'L') { lineTo(num() + ox, num() + oy); lq = false; continue; }
    if (C === 'H') { lineTo(num() + ox, y); lq = false; continue; }
    if (C === 'V') { lineTo(x, num() + oy); lq = false; continue; }
    if (C === 'C') { const a = num() + ox, b = num() + oy, c = num() + ox, e = num() + oy, f = num() + ox, g = num() + oy; cubic(a, b, c, e, f, g); lcx = c; lcy = e; lq = false; continue; }
    if (C === 'S') { const c = num() + ox, e = num() + oy, f = num() + ox, g = num() + oy; cubic(2 * x - lcx, 2 * y - lcy, c, e, f, g); lcx = c; lcy = e; continue; }
    if (C === 'Q') { const a = num() + ox, b = num() + oy, f = num() + ox, g = num() + oy; quad(a, b, f, g); lcx = a; lcy = b; lq = true; continue; }
    if (C === 'T') { const a = lq ? 2 * x - lcx : x, b = lq ? 2 * y - lcy : y, f = num() + ox, g = num() + oy; quad(a, b, f, g); lcx = a; lcy = b; lq = true; continue; }
    if (C === 'A') { num(); num(); num(); num(); num(); lineTo(num() + ox, num() + oy); continue; }
    i++;
  }
  pathCache.set(d, subs);
  if (pathCache.size > 4000) pathCache.clear();
  return subs;
}

/** rasterise strokes into an art buffer; t (0..1) of `total` seconds for drawing on */
export function rasterStrokes(a: Art, vw: number, vh: number, strokes: Stroke[], stretch: boolean, t = 1, inset = 0.5) {
  const W = a.w, H = a.h;
  let kx: number, ky: number, ox: number, oy: number;
  if (stretch) { kx = (W - inset * 2) / vw; ky = (H - inset * 2) / vh; ox = inset; oy = inset; }
  else { const k = Math.min((W - inset * 2) / vw, (H - inset * 2) / vh); kx = ky = k; ox = (W - vw * k) / 2; oy = (H - vh * k) / 2; }
  const ks = Math.sqrt(kx * ky);
  const total = Math.max(0.001, ...strokes.map(s => (s.draw ? (s.delay ?? 0) + s.draw : 0)));
  const T = t * total;
  for (const s of strokes) {
    const subs = flattenPath(s.d);
    const op = s.opacity ?? 1;
    const fill = parseColor(s.fill);
    if (fill !== null) for (const sp of subs) if (sp.pts.length > 2) a.poly(sp.pts.map(([x, y]) => [x * kx + ox, y * ky + oy] as [number, number]), (x, y) => (op >= 1 || dith(x, y, op) ? fill : 0));
    const c = parseColor(s.c ?? INK);
    if (c === null || (s.w ?? 1.6) <= 0) continue;
    const bw = Math.max(1, Math.min(4, Math.round((s.w ?? 1.6) * ks * 0.9)));
    const pencil = s.tex === 'pencil';
    // the pixels of the stroke in drawing order
    const order: [number, number][] = [];
    const seen = new Set<number>();
    for (const sp of subs) {
      for (let k = 1; k < sp.pts.length; k++) {
        const [x0, y0] = sp.pts[k - 1], [x1, y1] = sp.pts[k];
        a.line(x0 * kx + ox - 0.5, y0 * ky + oy - 0.5, x1 * kx + ox - 0.5, y1 * ky + oy - 0.5, 0, 1, (px, py) => {
          const key = py * 4096 + px;
          if (seen.has(key)) return;
          seen.add(key);
          order.push([px, py]);
        });
      }
    }
    let n = order.length;
    if (s.draw) n = Math.floor(order.length * Math.max(0, Math.min(1, (T - (s.delay ?? 0)) / s.draw)));
    const seed = s.d.length * 31 + (s.w ?? 1) * 7;
    for (let k = 0; k < n; k++) {
      const [px, py] = order[k];
      for (let j = 0; j < bw; j++) for (let i = 0; i < bw; i++) {
        const X = px + i - ((bw - 1) >> 1), Y = py + j - ((bw - 1) >> 1);
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        if (op < 1 && !dith(X, Y, op)) continue;
        if (pencil && hash2(X, Y, seed) < 0.22) continue;
        a.px(X, Y, c);
      }
    }
  }
}

/**
 * Hand-drawn strokes as a pixel canvas (the drop-in for the old inline SVG). Size it with o.w / o.h
 * (any CSS length) or a class; with neither it fills its container's width at the viewBox's aspect
 * (or the whole container when stretched).
 */
export function svgInk(vw: number, vh: number, strokes: Stroke[], o: { cls?: string; w?: string; h?: string; style?: string; stretch?: boolean } = {}): string {
  const key = 'ink:' + keyOf(vw, vh, strokes, !!o.stretch);
  const anim = Math.max(0, ...strokes.map(s => (s.draw ? (s.delay ?? 0) + s.draw : 0)));
  const size = o.w || o.h
    ? `${o.w ? `width:${o.w};` : ''}${o.h ? `height:${o.h};` : ''}${o.w && !o.h ? `aspect-ratio:${vw}/${vh};` : ''}${o.h && !o.w ? `aspect-ratio:${vw}/${vh};` : ''}`
    : o.stretch ? 'width:100%;height:100%;' : `width:100%;aspect-ratio:${vw}/${vh};`;
  return pxCanvas(key, (a, _w, _h, t) => rasterStrokes(a, vw, vh, strokes, !!o.stretch, t), { cls: `pp-svg pp-ink ${o.cls ?? ''}`, style: size + (o.style ?? ''), anim });
}

/** (the SVG filters are gone: pixel ink needs none) */
export function ensureDefs() { /* nothing to install */ }

/** the size of one art pixel in CSS px (re-exported for modules that lay ink out) */
export const INK_PX = PX;

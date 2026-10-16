// V11 Blueprints: pixel line art for the papers. A pen that draws one-pixel strokes on a PixelBuffer
// (Bresenham segments, cleaned of the L-shaped corner pixels so lines stay one pixel wide), in the
// character of whoever holds it:
//   'tech'      the agency's draughtsman: dead straight, clean
//   'biro'      Jenna: straight-ish, a blob where the pen stops
//   'pencil'    Joshu, Mori: a slight wobble, graphite that skips
//   'charcoal'  Aroha: a heavier wobble, smudged and doubled in places
// Plus construction lines (dashed, centre lines), dimension lines with arrowheads and tiny numbers,
// callouts, ordered-dither fills and hatching, and a tracer that turns an item's painted artwork into
// blueprint line art. Nothing is anti-aliased: every pixel is set, never blended.

import { PixelBuffer } from '../../../art/pixel';
import type { C } from '../../../art/color';
import { A as AL } from '../../../art/color';
import { drawText, textW } from './pxfont';
import type { TextStyle, FontId } from './pxfont';

export type InkStyle = 'tech' | 'biro' | 'pencil' | 'charcoal';
export type Pt = [number, number];
export interface StrokeOpts { c?: C; dash?: [number, number]; w?: 1 | 2; wobble?: number }

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** ordered dither: is (x, y) lit at level 0..1? */
export const dith = (x: number, y: number, level: number) => level > (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
export const rnd = (a: number, b: number, s: number) => { let h = (a * 374761393 + b * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** smooth value noise 0..1 */
export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = rnd(xi, yi, s), b = rnd(xi + 1, yi, s), c = rnd(xi, yi + 1, s), d = rnd(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** the pixels of a Bresenham segment (inclusive) */
export function seg(x0: number, y0: number, x1: number, y1: number, out: Pt[]) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 4000; n++) {
    const l = out[out.length - 1];
    if (!l || l[0] !== x0 || l[1] !== y0) out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
/** drop the corner pixel of every L (keeps strokes one pixel thin) */
export function perfect(p: Pt[]): Pt[] {
  if (p.length < 3) return p;
  const out: Pt[] = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = out[out.length - 1], c = p[i + 1], b = p[i];
    if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1 && (a[0] === b[0] || a[1] === b[1])) continue;
    out.push(b);
  }
  out.push(p[p.length - 1]);
  return out;
}
/** is (x, y) inside the polygon? */
export function inPoly(pts: Pt[], x: number, y: number): boolean {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
/** a 9x9 ring around a tiny letter */
const RING: Pt[] = [[-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4], [3, -3], [4, -2], [4, -1], [4, 0], [4, 1], [4, 2], [3, 3], [2, 4], [1, 4], [0, 4], [-1, 4], [-2, 4], [-3, 3], [-4, 2], [-4, 1], [-4, 0], [-4, -1], [-4, -2], [-3, -3]];

export class SkPen {
  /**
   * A pen on buffer b: stroke colour, a softer colour (construction, hatching), the medium, and the
   * drawing space: drawing coordinates (x, y) land on the buffer at (ox + x * k, oy + y * k), so a
   * drawing made for a 120 x 80 box fits any panel. Strokes stay one pixel wide; text is not scaled.
   */
  constructor(readonly b: PixelBuffer, public c: C, public soft: C, public style: InkStyle = 'tech', public ox = 0, public oy = 0, public k = 1, public seed = 1) {}
  private n = 0;
  /** drawing space -> buffer */
  X(x: number) { return this.ox + x * this.k; }
  Y(y: number) { return this.oy + y * this.k; }

  /** one ink pixel in buffer coordinates, with the medium's character */
  put(X: number, Y: number, c = this.c) {
    X = Math.round(X); Y = Math.round(Y);
    const s = this.seed;
    if (this.style === 'pencil' && rnd(X, Y, s) < 0.1) return;
    if (this.style === 'charcoal' && rnd(X, Y, s) < 0.04) return;
    this.b.set(X, Y, c);
    if (this.style === 'charcoal' && c === this.c && rnd(X, Y, s + 9) < 0.2) this.b.set(X + 1, Y + (rnd(X, Y, s + 2) < 0.5 ? 0 : 1), this.soft);
  }
  /** a raw pixel at drawing coordinates (no medium effects) */
  px(x: number, y: number, c = this.c) { this.b.set(Math.round(this.X(x)), Math.round(this.Y(y)), c); }

  private plotPath(pts: Pt[], o: StrokeOpts = {}) {
    const c = o.c ?? this.c;
    const dash = o.dash;
    let i = 0;
    for (const [x, y] of pts) {
      i++;
      if (dash && (i % (dash[0] + dash[1])) >= dash[0]) continue;
      this.put(x, y, c);
      if (o.w === 2) this.put(x + 1, y, c);
    }
  }
  /** wobble a polyline (buffer coordinates) the way the medium would (tech stays straight) */
  private wob(pts: Pt[], amt?: number): Pt[] {
    const k = amt ?? (this.style === 'charcoal' ? 0.9 : this.style === 'pencil' ? 0.6 : this.style === 'biro' ? 0.3 : 0);
    if (!k) return pts;
    const out: Pt[] = [];
    const sd = this.seed * 31 + this.n++;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.round(L / 6));
      const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const w = s === 0 ? 0 : (vnoise(i * 3.1 + t * steps * 0.7, sd, sd) - 0.5) * 2 * k;
        out.push([x0 + (x1 - x0) * t + nx * w, y0 + (y1 - y0) * t + ny * w]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  private pixels(pts: Pt[]): Pt[] {
    const raw: Pt[] = [];
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], raw);
    if (pts.length === 1) raw.push([Math.round(pts[0][0]), Math.round(pts[0][1])]);
    return perfect(raw);
  }
  /** a polyline in drawing coordinates */
  poly(pts: Pt[], closed = false, o: StrokeOpts = {}) {
    const p = (closed ? [...pts, pts[0]] : pts).map(([x, y]) => [this.X(x), this.Y(y)] as Pt);
    const px = this.pixels(this.wob(p, o.wobble));
    this.plotPath(px, o);
    if (this.style === 'biro' && px.length > 6 && !o.dash) { const e = px[px.length - 1]; this.put(e[0] + 1, e[1], o.c ?? this.c); }
  }
  line(x0: number, y0: number, x1: number, y1: number, o: StrokeOpts = {}) { this.poly([[x0, y0], [x1, y1]], false, o); }
  rect(x: number, y: number, w: number, h: number, o: StrokeOpts = {}) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o); }
  /** an ellipse, or an arc of it (radians, 0 = right, increasing clockwise on screen) */
  ellipse(cx: number, cy: number, rx: number, ry: number, o: StrokeOpts & { a0?: number; a1?: number } = {}) {
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2;
    const n = Math.max(10, Math.round((Math.abs(a1 - a0) * Math.max(rx, ry) * this.k) / 1.5));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    this.poly(pts, false, { ...o, wobble: o.wobble ?? (this.style === 'tech' ? 0 : 0.3) });
  }
  circle(cx: number, cy: number, r: number, o: StrokeOpts & { a0?: number; a1?: number } = {}) { this.ellipse(cx, cy, r, r, o); }
  /** a smooth curve through the points (Catmull-Rom), drawing coordinates */
  curve(pts: Pt[], o: StrokeOpts = {}) {
    if (pts.length < 3) { this.poly(pts, false, o); return; }
    const out: Pt[] = [];
    const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * this.k, n = Math.max(2, Math.round(L / 2));
      for (let s = 0; s < n; s++) {
        const t = s / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    this.poly(out, false, { ...o, wobble: o.wobble ?? 0 });
  }
  /** a construction / hidden line */
  dashed(x0: number, y0: number, x1: number, y1: number, c = this.soft) { this.line(x0, y0, x1, y1, { c, dash: [3, 2], wobble: 0 }); }
  /** a centre line: long dash, gap */
  centre(x0: number, y0: number, x1: number, y1: number, c = this.soft) { this.line(x0, y0, x1, y1, { c, dash: [6, 2], wobble: 0 }); }

  /** iterate the buffer pixels of a drawing-space box */
  private box(x: number, y: number, w: number, h: number, fn: (X: number, Y: number) => void) {
    const X0 = Math.round(this.X(x)), Y0 = Math.round(this.Y(y)), X1 = Math.round(this.X(x + w)), Y1 = Math.round(this.Y(y + h));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) fn(X, Y);
  }
  /** fill a box with an ordered-dither tone (level 0..1); inside() in drawing coordinates */
  tone(x: number, y: number, w: number, h: number, level: number, c = this.soft, inside?: (x: number, y: number) => boolean) {
    this.box(x, y, w, h, (X, Y) => { if (dith(X, Y, level) && (!inside || inside((X - this.ox) / this.k, (Y - this.oy) / this.k))) this.b.set(X, Y, c); });
  }
  /** a solid fill (paint over the paper: a part drawn filled) */
  fill(x: number, y: number, w: number, h: number, c: C, inside?: (x: number, y: number) => boolean) {
    this.box(x, y, w, h, (X, Y) => { if (!inside || inside((X - this.ox) / this.k, (Y - this.oy) / this.k)) this.b.set(X, Y, c); });
  }
  /** diagonal hatching inside a box (every `gap` px), optionally only where inside(x, y) (drawing coords) */
  hatch(x: number, y: number, w: number, h: number, gap = 3, c = this.soft, inside?: (x: number, y: number) => boolean, dir: 1 | -1 = 1) {
    this.box(x, y, w, h, (X, Y) => {
      if (((X * dir + Y) % gap + gap) % gap !== 0) return;
      if (inside && !inside((X - this.ox) / this.k, (Y - this.oy) / this.k)) return;
      this.b.set(X, Y, c);
    });
  }
  hatchEllipse(cx: number, cy: number, rx: number, ry: number, gap = 3, c = this.soft) {
    this.hatch(cx - rx, cy - ry, rx * 2, ry * 2, gap, c, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.8);
  }
  hatchPoly(pts: Pt[], gap = 3, c = this.soft, dir: 1 | -1 = 1) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    this.hatch(x0, y0, x1 - x0, y1 - y0, gap, c, (x, y) => inPoly(pts, x, y), dir);
  }

  /** text on the drawing (labels): tiny caps by default; position in drawing coordinates */
  text(x: number, y: number, t: string, o: { font?: FontId; c?: C; align?: 'left' | 'center' | 'right'; style?: Partial<TextStyle> } = {}) {
    const st: TextStyle = { font: o.font ?? 'tiny', color: o.c ?? this.c, slant: 0, ...o.style };
    const w = textW(t, st);
    const X = this.X(x), Xs = o.align === 'center' ? X - Math.floor(w / 2) : o.align === 'right' ? X - w : X;
    drawText(this.b, t, Math.round(Xs), Math.round(this.Y(y)), st);
    return w;
  }
  /** a 2-step arrowhead at buffer (X, Y) pointing along an axis */
  private arrow(X: number, Y: number, dx: number, dy: number, c: C) {
    const s = (a: number, b: number) => this.b.set(Math.round(a), Math.round(b), c);
    s(X, Y);
    if (dx) { s(X - dx, Y - 1); s(X - dx, Y + 1); s(X - 2 * dx, Y - 2); s(X - 2 * dx, Y + 2); }
    else { s(X - 1, Y - dy); s(X + 1, Y - dy); s(X - 2, Y - 2 * dy); s(X + 2, Y - 2 * dy); }
  }
  /** a horizontal dimension between x0 and x1 at height y (drawing coords): ticks, arrows, the figure */
  dimH(x0: number, x1: number, y: number, label: string, o: { c?: C; ext?: number } = {}) {
    const c = o.c ?? this.soft;
    const X0 = Math.round(this.X(x0)), X1 = Math.round(this.X(x1)), Yy = Math.round(this.Y(y));
    const ext = o.ext ?? 0;
    if (ext) for (const X of [X0, X1]) for (let j = -ext; j <= 2; j++) this.b.set(X, Yy + j, c);
    const tw = textW(label, { font: 'tiny', color: c }), mid = Math.round((X0 + X1) / 2);
    const g0 = mid - Math.ceil(tw / 2) - 2, g1 = mid + Math.floor(tw / 2) + 2;
    const room = g0 - X0 > 3;
    for (let X = X0 + 1; X < X1; X++) if (!room || X < g0 || X > g1) this.b.set(X, Yy, c);
    this.arrow(X0 + 1, Yy, -1, 0, c); this.arrow(X1 - 1, Yy, 1, 0, c);
    drawText(this.b, label, mid - Math.floor(tw / 2), room ? Yy - 2 : Yy - 7, { font: 'tiny', color: c });
  }
  /** a vertical dimension between y0 and y1 at x (drawing coords) */
  dimV(x: number, y0: number, y1: number, label: string, o: { c?: C; ext?: number; side?: 1 | -1 } = {}) {
    const c = o.c ?? this.soft;
    const Xx = Math.round(this.X(x)), Y0 = Math.round(this.Y(y0)), Y1 = Math.round(this.Y(y1));
    const ext = o.ext ?? 0, side = o.side ?? 1;
    if (ext) for (const Y of [Y0, Y1]) for (let i = -2; i <= ext; i++) this.b.set(Xx - i * side, Y, c);
    for (let Y = Y0 + 1; Y < Y1; Y++) this.b.set(Xx, Y, c);
    this.arrow(Xx, Y0 + 1, 0, -1, c); this.arrow(Xx, Y1 - 1, 0, 1, c);
    const tw = textW(label, { font: 'tiny', color: c });
    drawText(this.b, label, side > 0 ? Xx + 3 : Xx - 3 - tw, Math.round((Y0 + Y1) / 2) - 2, { font: 'tiny', color: c });
  }
  /** a callout: a leader line from a point on the part to a ringed letter at (lx, ly) */
  callout(px: number, py: number, lx: number, ly: number, letter: string, c = this.c) {
    const PX = Math.round(this.X(px)), PY = Math.round(this.Y(py)), LX = Math.round(this.X(lx)), LY = Math.round(this.Y(ly));
    const L = Math.hypot(LX - PX, LY - PY) || 1, ex = LX - ((LX - PX) / L) * 5, ey = LY - ((LY - PY) / L) * 5;
    const pts: Pt[] = [];
    seg(PX, PY, ex, ey, pts);
    for (const [x, y] of perfect(pts)) this.b.set(x, y, this.soft);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as Pt[]) this.b.set(PX + dx, PY + dy, c);
    for (const [dx, dy] of RING) this.b.set(LX + dx, LY + dy, c);
    drawText(this.b, letter, LX - 1, LY - 2, { font: 'tiny', color: c });
  }
}

/**
 * Trace an item's painted artwork into line art: the silhouette's outline and the strong inner edges in
 * ink, the inside left blank or lightly toned. scale = whole-pixel enlargement before tracing.
 */
export function traceArt(src: HTMLCanvasElement | PixelBuffer, scale: number, ink: C, soft: C, o: { tone?: number; inner?: number } = {}): PixelBuffer {
  const b = src instanceof PixelBuffer ? src : bufOf(src);
  const sw = b.w, sh = b.h, data = b.data;
  const W = sw * scale, H = sh * scale;
  const out = new PixelBuffer(W, H);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= sw || y >= sh ? 0 : data[y * sw + x]);
  const opaque = (x: number, y: number) => AL(at(x, y)) > 100;
  const lum = (c: number) => ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.55 + ((c >>> 16) & 255) * 0.15);
  const inner = o.inner ?? 46;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.floor(x / scale), sy = Math.floor(y / scale);
    if (!opaque(sx, sy)) continue;
    const lx = x % scale, ly = y % scale;
    const edge = (!opaque(sx - 1, sy) && lx === 0) || (!opaque(sx + 1, sy) && lx === scale - 1) || (!opaque(sx, sy - 1) && ly === 0) || (!opaque(sx, sy + 1) && ly === scale - 1);
    if (edge) { out.set(x, y, ink); continue; }
    const c = at(sx, sy);
    if ((lx === scale - 1 && opaque(sx + 1, sy) && Math.abs(lum(c) - lum(at(sx + 1, sy))) > inner) || (ly === scale - 1 && opaque(sx, sy + 1) && Math.abs(lum(c) - lum(at(sx, sy + 1))) > inner)) { out.set(x, y, soft); continue; }
    if (o.tone && lum(c) < 90 && dith(x, y, o.tone)) out.set(x, y, soft);
  }
  return out;
}

/**
 * Stamp a buffer onto another at whole pixels. Opaque pixels are copied; half-transparent ones (soft
 * drop shadows in the item art) become a 50% checker of the same colour, so nothing is blended.
 * tint replaces every colour (a silhouette).
 */
export function blit(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, tint?: C) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < src.h; j++) {
    const Y = y + j;
    if (Y < 0 || Y >= dst.h) continue;
    for (let i = 0; i < src.w; i++) {
      const X = x + i;
      if (X < 0 || X >= dst.w) continue;
      const v = src.data[j * src.w + i], a = v >>> 24;
      if (a >= 200 || (a >= 40 && ((X + Y) & 1) === 0)) dst.data[Y * dst.w + X] = tint ?? (v | 0xff000000) >>> 0;
    }
  }
}
/** a canvas (item artwork) as a PixelBuffer */
export function bufOf(cv: HTMLCanvasElement): PixelBuffer {
  const b = new PixelBuffer(cv.width, cv.height);
  const ctx = cv.getContext('2d');
  if (ctx) { const id = ctx.getImageData(0, 0, cv.width, cv.height); b.data.set(new Uint32Array(id.data.buffer.slice(0))); }
  return b;
}

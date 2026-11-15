// The HUD kit as real objects: the field rucksack, the field guide, the field laptop and the instant
// camera, each a standalone icon painted at the screen's own resolution (about one device pixel per
// art pixel), so nothing is ever a chunky block.
//
// How they are painted: every part is a hand-shaped silhouette (signed-distance shapes laid out in a
// 52-unit design box: rounded slabs, capsules, rings, polygons, combined and cut), and every pixel of a
// part is lit like a bevelled surface (its slope near the edge, the light from the top left) and
// quantised into a ramp of many hand-picked tones, with ordered (Bayer) dithering between neighbouring
// tones instead of any blur. Materials add their own texture: canvas weave, leather grain and pores,
// book cloth, brushed chrome, glass with reflections, a screen's glow and scanlines. Hand-placed
// highlights, stitching, rivets and buckles go on last; the outline is a clean one-device-pixel-ish ink.
//
//   paintKitIcon(kind, k, info)   an Art of 52 x 52 design units at k device px per unit (cached)
//   KIT_SIZE                       the design box (52)

import { Art, col, mixC, shadeC, bayer } from './paper/px';
import { pxDraw } from '../pxfont';
import { PixelBuffer } from '../../art/pixel';

export const KIT_SIZE = 52;
export type KitKind = 'pack' | 'guide' | 'lap' | 'cam';
export interface KitInfo {
  /** pack: how full (0..1) */
  fill?: number;
  /** laptop: photos waiting to upload */
  badge?: number;
  /** camera: film left, and the print developing (0..1, 1 = none) */
  shots?: number;
  develop?: number;
  /** V12 (user: "remake the 3 ui icons better, cooler, animated, polished"): the idle loop's frame
   *  (0..KIT_FRAMES-1), how far the object opens on hover (0..1: the flap lifts, the cover cracks open,
   *  the lens racks out and the flash charges), and the click's burst (0..1) */
  t?: number;
  open?: number;
  fire?: number;
}
/** frames in the kit's idle loop (painted at about 8 a second) */
export const KIT_FRAMES = 16;

// ---------------------------------------------------------------- shapes (design units)
type SDF = (x: number, y: number) => number;
const box = (cx: number, cy: number, hw: number, hh: number, r = 0): SDF => (x, y) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const circ = (cx: number, cy: number, r: number): SDF => (x, y) => Math.hypot(x - cx, y - cy) - r;
const ell = (cx: number, cy: number, rx: number, ry: number): SDF => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const seg = (ax: number, ay: number, bx: number, by: number, r: number): SDF => (x, y) => {
  const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
  const h = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - dx * h, py - dy * h) - r;
};
/** a convex polygon (clockwise or not), rounded by r */
const poly = (pts: [number, number][], r = 0): SDF => (x, y) => {
  let d = -Infinity;
  const n = pts.length;
  let sgn = 0;
  for (let i = 0; i < n; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n]; sgn += (bx - ax) * (by + ay); }
  const s = sgn > 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
    const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey) || 1;
    d = Math.max(d, s * ((x - ax) * ey - (y - ay) * ex) / L);
  }
  return d - r;
};
/** an SDF turned by `a` radians about (cx, cy) (a swinging mug, a fluttering tag) */
const rot = (f: SDF, cx: number, cy: number, a: number): SDF => {
  const c = Math.cos(-a), s = Math.sin(-a);
  return (x, y) => { const dx = x - cx, dy = y - cy; return f(cx + dx * c - dy * s, cy + dx * s + dy * c); };
};
/** an SDF squeezed toward x = x0 by s (0..1): a book cover swinging open about its spine */
const squeeze = (f: SDF, x0: number, s: number): SDF => (x, y) => f(x0 + (x - x0) / s, y) * s;
const uni = (...f: SDF[]): SDF => (x, y) => Math.min(...f.map(g => g(x, y)));
const cut = (a: SDF, b: SDF): SDF => (x, y) => Math.max(a(x, y), -b(x, y));
const inter = (a: SDF, b: SDF): SDF => (x, y) => Math.max(a(x, y), b(x, y));

// ---------------------------------------------------------------- tones
/** a ramp of n tones from deep shadow through the base to a warm highlight (cool shadows, warm lights) */
function ramp(base: string, n = 9, o: { deep?: string; hi?: string; spread?: number } = {}): number[] {
  const b = col(base), deep = col(o.deep ?? '#1a1428'), hi = col(o.hi ?? '#fff6e0');
  const s = o.spread ?? 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(t < 0.55 ? mixC(deep, b, Math.pow(t / 0.55, 0.8) * 0.82 + 0.18 * (1 - s) + 0.18 * s * (t / 0.55)) : mixC(b, hi, ((t - 0.55) / 0.45) * 0.62 * s));
  }
  return out;
}
const L3 = (() => { const v = [-0.55, -0.68, 0.52], l = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / l); })();

interface Mat {
  ramp: number[];
  /** how far in from the edge the surface curves (design units) */
  bevel: number;
  /** a light offset from the material's texture (-0.3..0.3) */
  tex?: (u: number, v: number, px: number, py: number) => number;
  /** an extra light bias */
  bias?: number;
  /** ink outline colour (default: the ramp's darkest, deepened); null = none */
  ink?: number | null;
  /** shininess: above this light the top tone gets a hard specular */
  spec?: number;
}

/** the painter: k device px per unit, an offset (units) for the whole icon */
class Painter {
  constructor(readonly a: Art, readonly k: number, readonly ox = 0, readonly oy = 0) {}
  private bounds(sdf: SDF, pad: number) {
    // a coarse scan in units to find the shape's extent
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let v = -2; v <= KIT_SIZE + 2; v += 0.5) for (let u = -2; u <= KIT_SIZE + 2; u += 0.5) if (sdf(u, v) < 0.8) { if (u < x0) x0 = u; if (v < y0) y0 = v; if (u > x1) x1 = u; if (v > y1) y1 = v; }
    const k = this.k;
    return [Math.max(0, Math.floor((x0 - pad + this.ox) * k)), Math.max(0, Math.floor((y0 - pad + this.oy) * k)), Math.min(this.a.w - 1, Math.ceil((x1 + pad + this.ox) * k)), Math.min(this.a.h - 1, Math.ceil((y1 + pad + this.oy) * k))];
  }
  /** a lit, quantised, dithered surface */
  fill(sdf: SDF, m: Mat, clip?: SDF) {
    const k = this.k, R = m.ramp, N = R.length;
    const ow = Math.max(1, Math.round(k * 0.9)) / k;
    const ink = m.ink === undefined ? shadeC(R[0], -0.35) : m.ink;
    const [X0, Y0, X1, Y1] = this.bounds(sdf, 1);
    const e = 0.35;
    for (let py = Y0; py <= Y1; py++) for (let px = X0; px <= X1; px++) {
      const u = (px + 0.5) / k - this.ox, v = (py + 0.5) / k - this.oy;
      const d = sdf(u, v);
      if (d >= 0) continue;
      if (clip && clip(u, v) >= 0) continue;
      if (ink !== null && d > -ow) { this.a.put(px, py, ink); continue; }
      const gx = sdf(u + e, v) - sdf(u - e, v), gy = sdf(u, v + e) - sdf(u, v - e);
      const gl = Math.hypot(gx, gy) || 1;
      const h = Math.min(1, -d / m.bevel);
      const sl = Math.sqrt(1 - h * h * 0.9);
      let nx = (gx / gl) * sl, ny = (gy / gl) * sl, nz = 0.45 + h;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      let l = nx * L3[0] + ny * L3[1] + nz * L3[2];
      l = (l + 0.15) / 1.15 + (m.bias ?? 0) + (m.tex ? m.tex(u, v, px, py) : 0);
      const f = Math.max(0, Math.min(N - 1, l * (N - 1)));
      const i0 = Math.floor(f);
      let c = R[Math.min(N - 1, i0 + (f - i0 > bayer(px, py) ? 1 : 0))];
      if (m.spec !== undefined && l > m.spec) c = mixC(R[N - 1], col('#ffffff'), 0.6);
      this.a.put(px, py, c);
    }
  }
  /** a flat colour (decals, stitches, glyph pixels), optionally dithered to coverage a */
  flat(sdf: SDF, c: number, a = 1, clip?: SDF) {
    const k = this.k;
    const [X0, Y0, X1, Y1] = this.bounds(sdf, 1);
    for (let py = Y0; py <= Y1; py++) for (let px = X0; px <= X1; px++) {
      const u = (px + 0.5) / k - this.ox, v = (py + 0.5) / k - this.oy;
      if (sdf(u, v) >= 0 || (clip && clip(u, v) >= 0)) continue;
      if (a < 1 && bayer(px, py) >= a) continue;
      this.a.put(px, py, c);
    }
  }
  /** a dashed stitch line along a shape's inside, `inset` units from its edge */
  stitch(sdf: SDF, inset: number, c: number, dash = 1.6, clip?: SDF) {
    const k = this.k, w = Math.max(0.5, 0.75 / Math.max(1, k * 0.6));
    const [X0, Y0, X1, Y1] = this.bounds(sdf, 1);
    for (let py = Y0; py <= Y1; py++) for (let px = X0; px <= X1; px++) {
      const u = (px + 0.5) / k - this.ox, v = (py + 0.5) / k - this.oy;
      const d = sdf(u, v);
      if (Math.abs(d + inset) > Math.max(w, 0.5 / k) || (clip && clip(u, v) >= 0)) continue;
      if (Math.floor((u + v * 0.7) / dash) % 2) continue;
      this.a.put(px, py, c);
    }
  }
}

// ---------------------------------------------------------------- textures
const hash = (x: number, y: number, s = 0) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** smooth value noise in design units */
function vnoise(u: number, v: number, s: number) {
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const weave = (u: number, v: number) => (Math.sin(u * 5.2) * Math.sin(v * 5.2) > 0.25 ? 0.05 : -0.02) + (vnoise(u * 0.6, v * 0.6, 3) - 0.5) * 0.12;
const leather = (u: number, v: number, px: number, py: number) => (vnoise(u * 1.6, v * 1.6, 7) - 0.5) * 0.22 + (hash(px, py, 9) > 0.93 ? -0.12 : 0);
const clothTex = (u: number, v: number, px: number, py: number) => ((px + py) % 3 === 0 ? -0.04 : 0) + (vnoise(u * 0.5, v * 0.5, 5) - 0.5) * 0.16;

// ---------------------------------------------------------------- palettes
const CANVAS = ramp('#5f7a3e', 10, { deep: '#141c10', hi: '#f4f0c8' });
const CANVAS_L = ramp('#6f8a48', 10, { deep: '#18200f', hi: '#fff8d8' });
const LEATHER = ramp('#7a4524', 9, { deep: '#1c0c06', hi: '#ffd8a0' });
const BRASS = ramp('#c8962e', 9, { deep: '#2a1806', hi: '#fffbe0' });
const WOOL = ramp('#a8402e', 9, { deep: '#2a0a08', hi: '#ffd0b0' });
const CLOTH = ramp('#4a6a34', 10, { deep: '#0e1608', hi: '#e8f0b0' });
const PAGES = ramp('#efe4c6', 6, { deep: '#7a6a4a', hi: '#fffaf0' });
const GOLD = ramp('#e0b040', 9, { deep: '#3a2006', hi: '#fffde8' });
const SHELL = ramp('#55606c', 10, { deep: '#0c1016', hi: '#e8f0f8' });
const RUBBER = ramp('#d8662a', 8, { deep: '#3a1006', hi: '#ffd8a8' });
const CREAM = ramp('#ece2cc', 9, { deep: '#4a3e30', hi: '#ffffff' });
const DARKLEATHER = ramp('#3a3430', 9, { deep: '#08060a', hi: '#c8bcb0' });
const CHROME = ramp('#a8b0b8', 10, { deep: '#101418', hi: '#ffffff', spread: 1.2 });
const RED = ramp('#d8402a', 8, { deep: '#3a0806', hi: '#ffe0d0' });
const INK = col('#140c06');
const ENAMEL = ramp('#e8eef2', 8, { deep: '#3a4a5a', hi: '#ffffff' });
const ENAMEL_B = ramp('#2a5aa8', 6, { deep: '#081428', hi: '#a8d0ff' });
const MANILA = ramp('#d8b878', 7, { deep: '#4a3418', hi: '#fff6dc' });
const TWILL = ramp('#26262c', 6, { deep: '#050508', hi: '#7a7a86' });
const PENCIL = ramp('#f2c230', 7, { deep: '#4a3006', hi: '#fff8d0' });
const BLUE = ramp('#3a8ae8', 7, { deep: '#081a3a', hi: '#e0f0ff' });
const MARBLE = ramp('#7a2a3a', 7, { deep: '#1a0610', hi: '#f0c8b0' });

/** a little four-pointed sparkle (a glint on metal or glass), r design units, at full strength s 0..1 */
function sparkle(p: Painter, x: number, y: number, r: number, s: number) {
  if (s <= 0) return;
  const R = r * s;
  p.flat(uni(seg(x - R, y, x + R, y, 0.32), seg(x, y - R, x, y + R, 0.32)), col('#ffffff'));
  p.flat(circ(x, y, 0.55 + s * 0.3), col('#ffffff'));
  if (s > 0.5) p.flat(uni(seg(x - R * 0.45, y - R * 0.45, x + R * 0.45, y + R * 0.45, 0.22), seg(x - R * 0.45, y + R * 0.45, x + R * 0.45, y - R * 0.45, 0.22)), col('#fff6c8'), 0.7);
}
/** a silver fern (the patch's emblem): a slim curving rib and three pairs of leaflets, point at the top */
const fernSDF = (cx: number, cy: number, h: number): SDF => {
  const rib: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.1) rib.push([cx + Math.sin(t * 1.6) * h * 0.14, cy + h / 2 - t * h]);
  const leaf: [number, number, number, number][] = [];
  for (const [t, L] of [[0.3, 0.36], [0.52, 0.3], [0.72, 0.22]] as [number, number][]) {
    const fx = cx + Math.sin(t * 1.6) * h * 0.14, fy = cy + h / 2 - t * h;
    for (const sd of [-1, 1]) leaf.push([fx, fy, fx + sd * L * h, fy - L * h * 0.5]);
  }
  return (x, y) => {
    let d = Infinity;
    for (let i = 0; i + 1 < rib.length; i++) d = Math.min(d, seg(rib[i][0], rib[i][1], rib[i + 1][0], rib[i + 1][1], 0.3)(x, y));
    for (const [ax, ay, bx, by] of leaf) d = Math.min(d, seg(ax, ay, bx, by, 0.24)(x, y));
    return d;
  };
};

// ---------------------------------------------------------------- the icons
function paintPack(p: Painter, info: KitInfo) {
  const full = Math.max(0, Math.min(1, info.fill ?? 0));
  const bulge = full * 1.6, o = info.open ?? 0, lift = o * 5.5;
  // side pockets behind the body, a bottle in the left one
  p.fill(box(9.5, 33, 4.5, 9, 3.5), { ramp: CANVAS, bevel: 3, tex: weave, bias: -0.12 });
  p.fill(box(42.5, 33, 4.5, 9, 3.5), { ramp: CANVAS, bevel: 3, tex: weave, bias: -0.18 });
  p.fill(box(8.6, 24.5, 2.4, 3.6, 1), { ramp: BLUE, bevel: 1.4, spec: 0.86 });
  p.fill(box(8.6, 20.6, 1.5, 0.9, 0.4), { ramp: SHELL, bevel: 0.5 });
  // the carry handle loop
  p.fill(cut(ell(26, 9, 6, 4.5), ell(26, 9.6, 3.6, 2.6)), { ramp: LEATHER, bevel: 1.4, tex: leather });
  // the body: a canvas sack, a little pear-shaped, fuller when it's packed
  const body = uni(box(26, 30, 15.5 + bulge * 0.5, 15.5, 7), ell(26, 37, 17 + bulge, 10.5));
  p.fill(body, { ramp: CANVAS, bevel: 6, tex: weave });
  p.stitch(body, 2.2, CANVAS[7], 1.4);
  // the bedroll strapped on top: wool, a stripe woven round it
  const roll = seg(12.5, 12.5, 39.5, 12.5, 4.6);
  p.fill(roll, { ramp: WOOL, bevel: 4, tex: (u, v) => (Math.sin(u * 2.2) > 0.6 ? 0.08 : 0) + (vnoise(u, v, 4) - 0.5) * 0.1 });
  p.flat(inter(roll, (x) => Math.abs(x - 26) - 0.8), col('#f0e2c0'), 0.9);
  for (const sx of [17, 35]) p.fill(box(sx, 12.5, 1.6, 5.2, 0.8), { ramp: LEATHER, bevel: 1, tex: leather });
  p.fill(ell(10.6, 12.5, 2.2, 4.4), { ramp: WOOL, bevel: 1.5, bias: -0.1 });
  p.flat(cut(circ(10.6, 12.5, 2.4), circ(10.6, 12.5, 1.6)), WOOL[2]);
  // opened (on hover): under the lifted flap, the dark mouth of the pack and what's packed in it
  if (o > 0.05) {
    const mouth = ell(26, 25.6, 13.6, 2.4 + o * 2.2);
    p.fill(mouth, { ramp: ramp('#2a2014', 6, { deep: '#060402', hi: '#5a4a30' }), bevel: 3, bias: -0.25, ink: shadeC(CANVAS[0], -0.3) });
    const up = o * 3.2;
    p.fill(inter(seg(17, 26 - up * 0.4, 23.5, 23 - up, 1.7), (x, y) => y - 27), { ramp: PAGES, bevel: 1.2 });
    p.flat(box(20.2, 24.6 - up * 0.7, 0.45, 1.9), RED[3]);
    p.fill(inter(box(30.5, 24.6 - up, 2.1, 3, 1), (x, y) => y - 27), { ramp: BLUE, bevel: 1.2, spec: 0.85 });
    p.fill(inter(seg(35.6, 26.5, 37, 22 - up, 0.45), (x, y) => y - 27), { ramp: CLOTH, bevel: 0.5, ink: null });
    for (let i = 0; i < 4; i++) p.flat(seg(36.2 + i * 0.3, 25 - i * 1.1 - up * (i / 4), 38.2, 24 - i * 1.2 - up * (i / 4), 0.35), CLOTH[6 + (i % 2)]);
  }
  // the top flap with its curved hem and stitching (lifts on hover)
  const flap = inter(box(26, 22 - lift, 15.8, 8.6, 6), (x, y) => y - (27.5 - lift * 1.15 + Math.cos((x - 26) / 9) * 2.4));
  p.fill(flap, { ramp: CANVAS_L, bevel: 3.2, tex: weave, bias: 0.04 + o * 0.06 });
  p.stitch(flap, 1.5, CANVAS_L[8], 1.3);
  // the patch sewn on the flap: black twill, a silver fern, a cream stitched border
  const pcx = 26, pcy = 20.6 - lift;
  p.fill(circ(pcx, pcy, 4.1), { ramp: TWILL, bevel: 1.2, tex: (u, v, px, py) => ((px + py) % 2 ? -0.05 : 0.03) });
  p.stitch(circ(pcx, pcy, 4.1), 0.5, col('#c8bea0'), 0.8);
  p.flat(fernSDF(pcx, pcy + 0.3, 5.4), col('#e8eef4'));
  // two leather straps from the flap down to their brass buckles (unbuckled when the flap is up)
  for (const sx of [19, 33]) {
    const strapEnd = 36 - lift * 1.25;
    const strap = box(sx, (14 - lift + strapEnd) / 2, 2, (strapEnd - (14 - lift)) / 2, 1);
    p.fill(strap, { ramp: LEATHER, bevel: 1.4, tex: leather });
    p.stitch(strap, 0.65, LEATHER[7], 1.1);
    if (lift > 1.5) p.flat(circ(sx, strapEnd - 1.6, 0.5), LEATHER[0]);
    const buckle = cut(box(sx, 34.5, 3.1, 2.3, 0.8), box(sx, 34.5, 1.8, 1.1, 0.3));
    p.fill(buckle, { ramp: BRASS, bevel: 0.9, spec: 0.86 });
    if (lift <= 1.5) p.fill(box(sx, 34.5, 0.45, 1.6, 0.2), { ramp: BRASS, bevel: 0.4, bias: 0.1, ink: null });
    p.fill(box(sx, 38.5, 1.7, 2.4, 1.6), { ramp: LEATHER, bevel: 1, tex: leather, bias: -0.06 });
  }
  // the front pocket, its flap and a brass snap
  const pocket = box(26, 41, 9, 5.6, 3);
  p.fill(pocket, { ramp: CANVAS, bevel: 2.4, tex: weave, bias: -0.04 });
  const pflap = inter(box(26, 38.6, 9.2, 3.4, 2.6), (x, y) => y - (40.6 + Math.cos((x - 26) / 6) * 1.2));
  p.fill(pflap, { ramp: CANVAS_L, bevel: 1.8, tex: weave, bias: 0.02 });
  p.stitch(pocket, 1.1, CANVAS[7], 1.2, (x, y) => -(y - 41.5));
  p.fill(circ(26, 40.4, 1.5), { ramp: BRASS, bevel: 1, spec: 0.84 });
  // hand-placed highlights where the canvas catches the light
  p.flat(seg(14.5, 19 - lift, 16.5, 16.5 - lift, 0.45), CANVAS_L[9], 0.75);
  p.flat(seg(12.2, 31, 12.2, 37, 0.4), CANVAS[8], 0.5);
  p.flat(circ(14.2, 10.6, 0.6), WOOL[8]);
}

/** the pack's live parts: an enamel mug on a carabiner and a luggage tag, swinging; a glint on a buckle */
function packLive(p: Painter, info: KitInfo) {
  const f = info.t ?? 0, ph = (f / KIT_FRAMES) * Math.PI * 2, o = info.open ?? 0;
  // the carabiner on the right pocket's loop, and the mug swinging from it
  p.fill(cut(ell(45.6, 25.4, 1.5, 2.2), ell(45.6, 25.4, 0.75, 1.35)), { ramp: CHROME, bevel: 0.6, spec: 0.84 });
  const th = Math.sin(ph) * 0.16 + o * 0.12;
  const R = (g: SDF) => rot(g, 45.6, 27.3, th);
  p.fill(R(cut(ell(48.9, 31.2, 1.7, 1.9), ell(48.9, 31.2, 0.85, 1.05))), { ramp: ENAMEL, bevel: 0.6 });
  p.fill(R(box(45.6, 31.4, 3.1, 3.5, 0.9)), { ramp: ENAMEL, bevel: 1.7, spec: 0.88 });
  p.fill(R(box(45.6, 28.3, 3.3, 0.55, 0.3)), { ramp: ENAMEL_B, bevel: 0.4, ink: null });
  p.flat(R(circ(44.2, 33, 0.5)), ENAMEL_B[1]);
  p.flat(R(circ(46.8, 30.4, 0.32)), ENAMEL_B[2]);
  // the luggage tag on its red string from the left buckle, fluttering in the breeze
  const th2 = Math.sin(ph * 2 + 1.3) * 0.2 + Math.sin(ph * 3) * 0.06 + 0.2;
  const T = (g: SDF) => rot(g, 17.2, 36.3, th2);
  p.flat(T(seg(17.2, 36.3, 15.6, 40.2, 0.28)), RED[4]);
  p.fill(T(poly([[12.6, 40.4], [17.4, 39.8], [18.1, 46.4], [13.3, 47]], 0.4)), { ramp: MANILA, bevel: 0.9 });
  p.flat(T(circ(15.3, 41.4, 0.55)), INK);
  p.flat(T(cut(circ(15.3, 41.4, 0.9), circ(15.3, 41.4, 0.55))), MANILA[1]);
  for (let i = 0; i < 2; i++) p.flat(T(seg(14 + i * 0.1, 43.4 + i * 1.4, 16.8, 43.1 + i * 1.4, 0.17)), col('#5a4030'));
  // now and then the light catches a buckle
  const g = f % KIT_FRAMES;
  sparkle(p, 33.9, 33.5, 2.4, g < 3 ? [0.5, 1, 0.45][g] : 0);
}

function paintGuide(p: Painter, info: KitInfo) {
  const o = info.open ?? 0;
  // the page block behind the cover, showing on the fore-edge and the bottom
  const pages = box(28, 27.5, 15.5, 20.2, 1.5);
  p.fill(pages, { ramp: PAGES, bevel: 1.2, tex: (u, v) => (Math.floor(v * 1.6) % 2 ? -0.06 : 0.02) });
  // coloured index tabs sticking out of the fore-edge
  ([[11.5, '#e8432a'], [18.5, '#f4c83a'], [25.5, '#3a8ae8'], [32.5, '#5ab84a']] as [number, string][]).forEach(([ty, h], i) => {
    p.fill(box(43.8 + (i % 2) * 0.4, ty, 2.3, 2.4, 0.7), { ramp: ramp(h, 6, { deep: '#1a1014' }), bevel: 0.8 });
  });
  // opened (on hover): the cover swings toward us about the spine and the first page shows, lit
  const sc = 1 - o * 0.55;
  if (o > 0.05) {
    const page = box(28.5, 26.5, 14.4, 19.5, 1.2);
    p.fill(page, { ramp: PAGES, bevel: 2, bias: 0.06, tex: (u, v) => 0.12 - Math.hypot((u - 30) / 16, (v - 26) / 22) * 0.2 });
    // a pencil sketch of a kiwi, a fern, the handwriting
    const sepia = col('#5a4030');
    p.flat(cut(ell(31, 24, 5, 3.6), ell(31.2, 24.4, 4.2, 2.8)), sepia);
    p.flat(circ(35.6, 21.6, 1.6), sepia, 0.85);
    p.flat(seg(36.8, 21.8, 41, 24.6, 0.28), sepia);
    p.flat(uni(seg(29.4, 27.4, 28.8, 30, 0.25), seg(32.2, 27.4, 32.8, 30, 0.25)), sepia);
    for (let i = 0; i < 4; i++) p.flat(seg(22, 33.5 + i * 2.2, 39 - (i % 2) * 5, 33.5 + i * 2.2, 0.2), col('#7a6a58'), 0.8);
    p.flat(seg(23, 13.5, 37, 13.5, 0.3), col('#3a2a20'));
  }
  // the cloth cover, worn at the corners (squeezed toward the spine as it opens)
  const S = (g: SDF) => (o > 0.05 ? squeeze(g, 10, sc) : g);
  const cover = S(box(25.5, 26, 15.5, 20.5, 2.6));
  p.fill(cover, {
    ramp: CLOTH, bevel: 2.6, bias: -o * 0.12, tex: (u, v, px, py) => {
      const worn = Math.max(0, 1 - Math.min(Math.hypot(u - 10, v - 5.5), Math.hypot(u - 41, v - 5.5), Math.hypot(u - 10, v - 46.5), Math.hypot(u - 41, v - 46.5)) / 3.4);
      return clothTex(u, v, px, py) + worn * 0.32;
    },
  });
  // the spine: darker, with raised bands
  const spine = inter(cover, (x) => x - 14.5);
  p.fill(spine, { ramp: CLOTH, bevel: 2.2, tex: clothTex, bias: -0.16 });
  for (const by of [12, 40]) p.fill(box(12, by, 3.2, 1.1, 0.8), { ramp: CLOTH, bevel: 0.9, bias: 0.06 });
  p.flat(box(14.6, 26, 0.35, 19.5), CLOTH[1]);
  // brass corner protectors
  for (const cy of [6.4, 45.6]) p.fill(S(poly(cy < 20 ? [[37.6, 5.5], [41, 5.5], [41, 8.9]] : [[37.6, 46.5], [41, 46.5], [41, 43.1]], 0.3)), { ramp: BRASS, bevel: 0.6, spec: 0.86 });
  // the gilt frame, a title plate and the gilt koru emblem
  const frame = S(cut(box(28.5, 26, 9.6, 15.5, 1.2), box(28.5, 26, 8.7, 14.6, 0.8)));
  p.fill(frame, { ramp: GOLD, bevel: 0.5, ink: null, bias: -0.05 });
  p.fill(S(box(28.5, 36.4, 5.6, 2.2, 0.5)), { ramp: GOLD, bevel: 0.6, ink: shadeC(CLOTH[1], -0.2), spec: 0.9 });
  p.flat(S(uni(seg(25, 36, 32, 36, 0.22), seg(26, 37, 31, 37, 0.22))), CLOTH[2]);
  p.fill(S(cut(circ(28.5, 23, 6.6), circ(28.5, 23, 5.6))), { ramp: GOLD, bevel: 0.5, ink: shadeC(CLOTH[1], -0.2), spec: 0.9 });
  const sp: SDF = (x, y) => {
    let d = Infinity;
    for (let t = 0; t < 4.4; t += 0.12) {
      const r = 0.6 + t * 0.95, an = t * 2.2 + 3.6;
      d = Math.min(d, Math.hypot(x - (28.5 + Math.cos(an) * r * 0.8), y - (22.3 + Math.sin(an) * r * 0.8)));
    }
    return d - 0.55;
  };
  p.fill(S(sp), { ramp: GOLD, bevel: 0.5, ink: null, spec: 0.88 });
  p.fill(S(seg(28.5, 26.5, 27.4, 31.5, 0.55)), { ramp: GOLD, bevel: 0.5, ink: null });
  // the elastic strap, and a pencil tucked in beside it (only while it's shut)
  if (o < 0.3) {
    p.fill(box(37.5, 26, 1.3, 20.6, 0.4), { ramp: LEATHER, bevel: 0.8, tex: leather, bias: -0.05 });
    p.fill(seg(40.4, 8.5, 40.4, 41, 1.05), { ramp: PENCIL, bevel: 0.9, tex: (u) => (Math.abs(u - 40.4) < 0.3 ? 0.08 : 0) });
    p.fill(poly([[39.4, 41], [41.4, 41], [40.4, 44.6]], 0.15), { ramp: ramp('#e8c898', 6), bevel: 0.5 });
    p.flat(circ(40.4, 44.2, 0.4), col('#2a2a2e'));
    p.fill(box(40.4, 8.4, 1.05, 0.9, 0.3), { ramp: CHROME, bevel: 0.5, spec: 0.85 });
    p.fill(box(40.4, 6.6, 1.05, 1.1, 0.6), { ramp: ramp('#e88aa0', 6), bevel: 0.6 });
  }
  // rubbed light on the top edge
  p.flat(S(seg(16.5, 6.6, 36, 6.6, 0.32)), CLOTH[8], 0.7);
}

/** the guide's live parts: the silk ribbon swaying under it, a glint across the gilt, motes of light off
 *  the open page */
function guideLive(p: Painter, info: KitInfo) {
  const f = info.t ?? 0, ph = (f / KIT_FRAMES) * Math.PI * 2, o = info.open ?? 0;
  const th = Math.sin(ph) * 0.2 + (o > 0.3 ? 0.25 : 0);
  p.fill(rot(poly([[31.6, 45.5], [34, 45.5], [34.2, 51.2], [32.9, 49.9], [31.5, 51.2]], 0.15), 32.8, 45.6, th), { ramp: RED, bevel: 0.7 });
  const g = (f + 8) % KIT_FRAMES;
  if (o < 0.3) sparkle(p, 25 + g * 0.5, 18.5 + g * 0.3, 2.2, g < 3 ? [0.55, 1, 0.5][g] : 0);
  if (o > 0.4) for (let i = 0; i < 4; i++) {
    const k = ((f + i * 4) % KIT_FRAMES) / KIT_FRAMES;
    const x = 26 + i * 4 + Math.sin(ph + i) * 1.2, y = 30 - k * 22;
    p.flat(circ(x, y, 0.55 + (1 - k) * 0.25), col('#fff4c8'), (1 - k) * 0.95);
  }
}

function paintLaptop(p: Painter, info: KitInfo) {
  // the base, seen from the front and above, with its keyboard
  const base = poly([[6.5, 35], [45.5, 35], [50.5, 45.5], [1.5, 45.5]], 1.4);
  p.fill(base, { ramp: SHELL, bevel: 2.2, bias: 0.08, tex: (u, v) => (vnoise(u * 1.2, v * 1.2, 2) - 0.5) * 0.08 });
  for (let row = 0; row < 3; row++) for (let i = 0; i < 10; i++) {
    const y = 37.4 + row * 2.4, x0 = 8.3 - row * 1.1, step = (35.4 + row * 2.2) / 10;
    p.fill(box(x0 + i * step + step / 2, y, step * 0.36, 0.8, 0.3), { ramp: SHELL, bevel: 0.4, bias: -0.32, ink: SHELL[0] });
  }
  p.fill(box(26, 44, 5, 0.9, 0.4), { ramp: SHELL, bevel: 0.4, bias: -0.1, ink: SHELL[1] });
  // the lid: a rugged shell, an inner bezel, the screen
  const lid = box(26, 19.5, 19.5, 15, 2.6);
  p.fill(lid, { ramp: SHELL, bevel: 2.6, tex: (u, v) => (vnoise(u * 1.2, v * 1.2, 6) - 0.5) * 0.1 });
  p.fill(box(26, 20, 16.2, 12, 1.4), { ramp: SHELL, bevel: 1, bias: -0.42, ink: SHELL[0] });
  const scr = box(26, 20.2, 14.6, 10.4, 0.8);
  const glow = ramp('#2fbfb0', 10, { deep: '#04201e', hi: '#e8fffa' });
  // the screen's glow: bright in the middle, falling off to the corners, faint scanlines
  p.fill(scr, {
    ramp: glow, bevel: 30, ink: null, bias: 0.05,
    tex: (u, v, _px, py) => 0.25 - Math.hypot((u - 26) / 15, (v - 20) / 11) * 0.38 + (py % 3 === 0 ? -0.05 : 0),
  });
  // the upload app: three photo thumbnails, an arrow, a progress bar
  for (let i = 0; i < 3; i++) {
    const tx = 15.6 + i * 7.6;
    p.flat(box(tx, 17, 3.1, 2.6, 0.3), col('#e8fffa'));
    p.flat(box(tx, 16.2, 2.5, 1.2), col('#7ab8e8'));
    p.flat(box(tx, 18.3, 2.5, 0.9), col('#6fb150'));
    p.flat(circ(tx + 1.3, 15.6, 0.5), col('#fff6c0'));
  }
  p.flat(poly([[37, 15], [40.5, 18.4], [38.3, 18.4], [38.3, 20], [35.7, 20], [35.7, 18.4], [33.5, 18.4]]), col('#eafffb'));
  p.flat(box(26, 25.4, 11.4, 0.9, 0.4), col('#0e5e5a'));
  p.flat(box(20.5, 25.4, 5.9, 0.9, 0.4), col('#eafffb'));
  // a glare across the glass
  p.flat(inter(scr, (x, y) => Math.abs((x - 13) + (y - 10) * 0.7 - 6) - 2.2), col('#ffffff'), 0.22);
  // the webcam and its little light
  p.flat(circ(26, 9.4, 0.7), col('#0a1418'));
  p.flat(circ(28.4, 9.4, 0.35), info.badge ? col('#7aff8a') : col('#2a3a30'));
  // the screen's light spilling onto the keys
  p.flat(inter(base, (x, y) => y - 39.5), col('#5affe8'), 0.12);
  // rubber corner bumpers (it's built for the field)
  for (const [cx, cy] of [[8.2, 6.2], [43.8, 6.2], [8.2, 32.8], [43.8, 32.8]] as [number, number][]) {
    p.fill(inter(circ(cx, cy, 3.6), lid), { ramp: RUBBER, bevel: 1.4, ink: null });
  }
  p.fill(box(26, 34.2, 17, 0.9, 0.5), { ramp: SHELL, bevel: 0.5, bias: -0.25 });
}

/** small 5x7 counter digits */
const DIG5: Record<string, string> = {
  '0': '####.##.##.####', '1': '.#.##..#..#.###', '2': '###..#####..###', '3': '###..#.##..####', '4': '#.##.####..#..#',
  '5': '####..###..####', '6': '####..####.####', '7': '###..#.#..#..#.', '8': '####.#####.####', '9': '####.####..####',
};
const DIG7: Record<string, string> = {
  '0': '.###.#...##..###.#.###..##...#.###.',
  '1': '..#...##....#....#....#....#...###.',
  '2': '.###.#...#....#...#...#...#...#####',
  '3': '####.....#....#.###.....#....#####.',
  '4': '...#...##..#.#.#..#.#####...#....#.',
  '5': '######....####.....#....##...#.###.',
  '6': '..##..#...#....####.#...##...#.###.',
  '7': '#####....#...#...#...#....#....#...',
  '8': '.###.#...##...#.###.#...##...#.###.',
  '9': '.###.#...##...#.####....#...#..##..',
};

function paintCamera(p: Painter, info: KitInfo, k: number) {
  const dev = Math.max(0, Math.min(1, info.develop ?? 1));
  // the print sticking out of the slot while it develops, coming up out of dark brown
  if (dev < 1) {
    const rise = Math.min(1, dev * 3);
    const pr = box(26, 41 + (1 - rise) * 4, 9, 6.5, 0.4);
    p.fill(pr, { ramp: PAGES, bevel: 0.8 });
    const img = box(26, 40.6 + (1 - rise) * 4, 7.4, 4.6);
    p.fill(img, { ramp: ramp('#3a2a1a', 4), bevel: 9, ink: null });
    p.flat(inter(img, (x, y) => y - (39 + (1 - rise) * 4)), col('#7ab8e8'), dev);
    p.flat(inter(img, (x, y) => -(y - (39 + (1 - rise) * 4))), col('#5a9a3a'), dev);
  }
  // strap lugs
  for (const sx of [3.4, 48.6]) p.fill(box(sx, 22, 1.6, 2.4, 0.6), { ramp: CHROME, bevel: 0.8, spec: 0.85 });
  // the body: cream top, a leather-wrapped lower half
  const body = box(26, 27, 22, 14.5, 5);
  p.fill(body, { ramp: CREAM, bevel: 4.5 });
  const wrap = inter(body, (x, y) => -(y - 25.5));
  p.fill(wrap, { ramp: DARKLEATHER, bevel: 4, tex: leather, ink: null });
  p.flat(inter(body, (x, y) => Math.abs(y - 25.5) - 0.35), DARKLEATHER[1]);
  // the viewfinder hump and the red shutter button
  p.fill(box(39, 12.4, 6.5, 3.2, 1.6), { ramp: CREAM, bevel: 1.6, bias: -0.04 });
  p.fill(circ(13, 12.6, 2.6), { ramp: RED, bevel: 1.5, spec: 0.86 });
  // the flash window: a ribbed lens in a chrome frame
  const fl = box(13.5, 19, 6, 3.6, 0.8);
  p.fill(fl, { ramp: CHROME, bevel: 0.8, spec: 0.9 });
  p.fill(box(13.5, 19, 4.8, 2.5, 0.4), { ramp: ramp('#e8eef0', 6, { deep: '#8a96a0' }), bevel: 4, ink: null, tex: (u) => (Math.floor(u * 1.4) % 2 ? -0.18 : 0.06) });
  // the rainbow stripe
  ['#e8432a', '#f0a03a', '#f4d84a', '#5ab84a', '#3a8ae8'].forEach((h, i) => p.fill(inter(box(32.2 + i * 0.9, 19, 0.45, 6.6), body), { ramp: ramp(h, 6), bevel: 9, ink: null, bias: 0.1 }));
  // the film counter window: a dark recess with the frames left on a white wheel
  const win = box(42.4, 19.4, 5.4, 3.8, 1);
  p.fill(win, { ramp: CHROME, bevel: 0.7, spec: 0.9 });
  p.fill(box(42.4, 19.4, 4.3, 2.8, 0.6), { ramp: ramp('#f4f0e6', 5, { deep: '#6a6458' }), bevel: 2.5, ink: col('#1a1410'), bias: 0.05 });
  const shots = String(Math.max(0, Math.min(99, Math.round(info.shots ?? 0))));
  // the digits: 3x5 at one device pixel on a plain screen, 5x7 at whole multiples on denser ones
  const small = k < 1.25, g = small ? 1 : Math.max(1, Math.round(k * 0.62));
  const gw = small ? 3 : 5, gh = small ? 5 : 7;
  const dw = shots.length * (gw + 1) - 1;
  const left = Math.round((42.4 + p.ox) * k - (dw * g) / 2), top = Math.round((19.4 + p.oy) * k - (gh * g) / 2);
  const dc = (info.shots ?? 0) <= 2 ? col('#c8321e') : col('#1a1410');
  [...shots].forEach((ch, n) => {
    const rows = small ? DIG5[ch] : DIG7[ch];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (rows[j * gw + i] === '#') for (let b = 0; b < g; b++) for (let c = 0; c < g; c++) p.a.put(left + (n * (gw + 1) + i) * g + c, top + j * g + b, dc);
  });
  // the lens: a stepped chrome barrel with a knurled focus ring, a black ring, deep glass; on hover it
  // racks out toward us (bigger, a second barrel step showing)
  const o = info.open ?? 0, lr = 1 + o * 0.14, lx = 20 - o * 0.6, ly = 29 + o * 0.4;
  p.fill(circ(20, 29, 11.2), { ramp: CHROME, bevel: 2.4, spec: 0.9 });
  if (o > 0.05) p.fill(circ(lx, ly, 10.4 * lr), { ramp: CHROME, bevel: 1.6, spec: 0.88, bias: 0.04 });
  p.fill(cut(circ(lx, ly, 9.6 * lr), circ(lx, ly, 8.6 * lr)), { ramp: ramp('#3a3a42', 6, { deep: '#000000', hi: '#a0a0ac' }), bevel: 0.5, ink: null, tex: (u, v) => (Math.floor(Math.atan2(v - ly, u - lx) * 9) % 2 ? -0.12 : 0.1) });
  p.fill(circ(lx, ly, 8.6 * lr), { ramp: ramp('#2a2a30', 7, { deep: '#000000', hi: '#8a8a96' }), bevel: 1.6 });
  p.flat(cut(circ(lx, ly, 8 * lr), circ(lx, ly, 7.4 * lr)), col('#5a5a64'));
  const glass = circ(lx, ly, 6.8 * lr);
  p.fill(glass, { ramp: ramp('#1c3450', 9, { deep: '#02060c', hi: '#c8e8ff' }), bevel: 7, ink: col('#000000'), bias: -0.2 });
  p.flat(cut(circ(lx, ly, 3.4 * lr), circ(lx, ly, 2.7 * lr)), col('#3a5a7a'), 0.8);
  p.flat(inter(cut(circ(lx, ly, 5.6 * lr), circ(lx + 0.6, ly + 0.6, 4.6 * lr)), (x, y) => x - lx + (y - ly)), col('#bfe0ff'), 0.85);
  // the ready light by the viewfinder
  p.fill(box(32.2, 12.6, 1.6, 1.6, 0.6), { ramp: CHROME, bevel: 0.6, spec: 0.88 });
  // the print slot along the bottom
  p.flat(box(26, 39.6, 13, 0.6, 0.3), INK);
}

/** the camera's live parts: the reflections turning slowly in the glass, the ready light blinking, the
 *  flash charging on hover (a rising whine of light) and firing on a click */
function camLive(p: Painter, info: KitInfo) {
  const f = info.t ?? 0, ph = (f / KIT_FRAMES) * Math.PI * 2, o = info.open ?? 0, fire = info.fire ?? 0;
  const lr = 1 + o * 0.14, lx = 20 - o * 0.6, ly = 29 + o * 0.4;
  // the glints in the glass drift round as the light moves
  const a1 = -2.3 + Math.sin(ph) * 0.35;
  p.flat(circ(lx + Math.cos(a1) * 3.8 * lr, ly + Math.sin(a1) * 3.8 * lr, 1.3 * lr), col('#ffffff'));
  p.flat(circ(lx + Math.cos(a1 + 3.1) * 4.2 * lr, ly + Math.sin(a1 + 3.1) * 4.2 * lr, 0.7), col('#8ac8ff'), 0.9);
  // a streak of light across the glass every loop
  const g = f % KIT_FRAMES;
  if (g >= 4 && g < 8) {
    const k = (g - 4) / 3;
    p.flat(inter(circ(lx, ly, 6.4 * lr), (x, y) => Math.abs((x - lx) + (y - ly) - (k * 14 - 7)) - 0.8), col('#d8f0ff'), 0.7);
  }
  // the ready light: green and steady when charged, blinking red while it charges
  const ready = o > 0.95 || o < 0.05;
  const on = ready ? true : (f % 4) < 2;
  p.flat(circ(32.2, 12.6, 0.95), on ? (ready ? col('#6aff7a') : col('#ff4a3a')) : col('#3a1a14'));
  if (on) p.flat(circ(31.9, 12.3, 0.35), col('#ffffff'), 0.8);
  // the flash charging: its window lit from within, brighter as the hover holds
  if (o > 0.05) p.flat(box(13.5, 19, 4.8, 2.5, 0.4), col('#fff6c8'), Math.min(0.85, o * (0.55 + Math.sin(ph * 4) * 0.12)));
  // the click: the flash fires, a hard starburst off the window
  if (fire > 0) {
    p.flat(box(13.5, 19, 5.4, 3, 0.6), col('#ffffff'));
    const R = 4 + fire * 9;
    p.flat(uni(seg(13.5 - R, 19, 13.5 + R, 19, 0.5 + fire * 0.4), seg(13.5, 19 - R * 0.8, 13.5, 19 + R * 0.8, 0.5 + fire * 0.4)), col('#ffffff'), Math.min(1, fire * 1.2));
    p.flat(uni(seg(13.5 - R * 0.6, 19 - R * 0.6, 13.5 + R * 0.6, 19 + R * 0.6, 0.35), seg(13.5 - R * 0.6, 19 + R * 0.6, 13.5 + R * 0.6, 19 - R * 0.6, 0.35)), col('#fff2b0'), fire * 0.8);
  }
  // the strap off the left lug, swinging a little
  const T = (s: SDF) => rot(s, 3.4, 24, Math.sin(ph + 0.6) * 0.12);
  p.fill(T(seg(3.4, 24, 2.2, 36, 1.1)), { ramp: RED, bevel: 0.8, tex: (u, v) => (Math.floor(v * 1.4) % 2 ? -0.14 : 0.06) });
}

const bases = new Map<string, Art>();
const frames = new Map<string, Art>();
/**
 * A kit icon (52 x 52 units) at k device px per unit. The object itself (and its hover state: how far
 * it is open) is painted once and cached; its live parts (the swinging mug and tag, the ribbon, the
 * glints, the ready light, the flash) are painted over a copy for each frame of the idle loop.
 */
export function paintKitIcon(kind: KitKind, k: number, info: KitInfo = {}): Art {
  const open = Math.round((info.open ?? 0) * 4) / 4;
  const bkey = `${kind}|${k.toFixed(3)}|${Math.round((info.fill ?? 0) * 8)}|${info.badge ?? 0}|${info.shots ?? 0}|${Math.round((info.develop ?? 1) * 12)}|${open}`;
  let base = bases.get(bkey);
  if (!base) {
    const S = Math.ceil(KIT_SIZE * k);
    base = new Art(S, S);
    const p = new Painter(base, k);
    const bi = { ...info, open };
    if (kind === 'pack') paintPack(p, bi);
    else if (kind === 'guide') paintGuide(p, bi);
    else if (kind === 'lap') paintLaptop(p, bi);
    else paintCamera(p, bi, k);
    if (bases.size > 120) bases.clear();
    bases.set(bkey, base);
  }
  if (kind === 'lap') return base;
  const t = (((info.t ?? 0) % KIT_FRAMES) + KIT_FRAMES) % KIT_FRAMES, fire = Math.round((info.fire ?? 0) * 4) / 4;
  const fkey = `${bkey}|${t}|${fire}`;
  let fr = frames.get(fkey);
  if (!fr) {
    fr = new Art(base.w, base.h);
    fr.d.set(base.d);
    const p = new Painter(fr, k);
    const li = { ...info, open, t, fire };
    if (kind === 'pack') packLive(p, li);
    else if (kind === 'guide') guideLive(p, li);
    else camLive(p, li);
    if (frames.size > 420) frames.clear();
    frames.set(fkey, fr);
  }
  return fr;
}

// ---------------------------------------------------------------- the button around an icon
/** an icon's opaque mask, for its shadow and its glint */
function opaque(a: Art, x: number, y: number) { return x >= 0 && y >= 0 && x < a.w && y < a.h && (a.d[y * a.w + x] >>> 24) > 0; }

/**
 * Compose a kit button: a soft dithered shadow on the ground (tight when pressed, far and faint when
 * lifted), the icon lifted or pressed, a glint sweeping across it on hover (glint 0..1, -1 = none), and
 * a small keycap hint at its top right (desktop).
 */
export function paintKitButton(out: Art, icon: Art, k: number, st: { lift: number; glint: number; key?: string; keyGp?: number; badge?: number }) {
  const W = out.w;
  const ix = 0, iy = Math.round((4 - st.lift) * k);
  // the shadow: the icon's silhouette squashed onto the ground below it, dithered from dense to faint
  const sy0 = Math.round((KIT_SIZE - 3) * k + 4 * k), spread = (2 + st.lift * 0.8) * k;
  const dens = Math.max(0.12, 0.5 - st.lift * 0.08);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < W; x++) {
    // an elliptical pool under the icon
    const dx = (x - ix - icon.w / 2) / (icon.w * 0.44 + spread), dy = (y - sy0) / (k * 2.6 + spread * 0.35);
    const r = dx * dx + dy * dy;
    if (r < 1 && bayer(x, y) < dens * (1 - r)) out.put(x, y, col('#000000', 0.5));
  }
  for (let y = 0; y < icon.h; y++) for (let x = 0; x < icon.w; x++) {
    let c = icon.d[y * icon.w + x];
    if (!(c >>> 24)) continue;
    if (st.glint >= 0) {
      const band = (x + y * 0.6) / (icon.w * 1.6) - (st.glint * 1.4 - 0.2);
      if (Math.abs(band) < 0.045) c = mixC(c, col('#ffffff'), 0.55);
      else if (Math.abs(band) < 0.07 && bayer(x, y) < 0.5) c = mixC(c, col('#ffffff'), 0.3);
    }
    out.put(ix + x, iy + y, c);
  }
  void opaque;
  // the keycap hint
  if (st.key) paintKeycap(out, Math.round(icon.w - 13 * k), Math.round(iy + 0 * k), k, st.key, st.keyGp ?? Math.max(1, Math.round(k)));
  // a count badge (photos to upload): a red disc with the number
  if (st.badge && st.badge > 0) {
    const t = String(Math.min(99, st.badge));
    const cx = Math.round(icon.w - 6 * k), cy = Math.round(iy + 7 * k), r = 5.6 * k;
    const p = new Painter(out, k, 0, 0);
    p.fill(circ(cx / k, cy / k, 5.6), { ramp: RED, bevel: 2, spec: 0.9 });
    void r;
    glyphs(out, t, cx, cy, Math.max(1, Math.round(k)), col('#fffaf0'), true);
  }
}

/** a little ivory keycap with its letter pressed in: dished top, shaded skirt, a hard dithered drop */
export function paintKeycap(out: Art, x: number, y: number, k: number, label: string, gp: number) {
  const p = new Painter(out, k, x / k, y / k);
  const w = 11 + Math.max(0, label.length - 1) * 5;
  p.flat(box(w / 2 + 0.8, 6.8, w / 2, 5.2, 2), col('#000000', 0.35), 0.55);
  p.fill(box(w / 2, 6, w / 2, 5.2, 2), { ramp: ramp('#b89a66', 7, { deep: '#3a2a14', hi: '#fff4d8' }), bevel: 1.2 });
  p.fill(box(w / 2, 5, w / 2 - 1.4, 3.6, 1.6), { ramp: ramp('#f0e2b8', 7, { deep: '#8a7046', hi: '#ffffff' }), bevel: 3.2, ink: null, bias: 0.06 });
  glyphs(out, label.toUpperCase(), Math.round(x + (w / 2) * k), Math.round(y + 5 * k), gp, col('#3a2614'), false);
}

/** a short word in the game's bold bitmap face, centred on (cx, cy), gp device px per font pixel */
function glyphs(out: Art, text: string, cx: number, cy: number, gp: number, c: number, ring: boolean) {
  const b = new PixelBuffer(text.length * 8 + 4, 12);
  pxDraw(b, text, 2, 2, { font: 'bold', color: '#ffffff', bounce: false });
  let x0 = b.w, x1 = -1, y0 = b.h, y1 = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) >>> 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return;
  const ox = Math.round(cx - ((x1 - x0 + 1) * gp) / 2), oy = Math.round(cy - ((y1 - y0 + 1) * gp) / 2);
  const on = (x: number, y: number) => x >= x0 && y >= y0 && x <= x1 && y <= y1 && (b.get(x, y) >>> 24) > 0;
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const inside = on(x, y);
    const edge = !inside && ring && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1));
    if (!inside && !edge) continue;
    for (let j = 0; j < gp; j++) for (let i = 0; i < gp; i++) out.put(ox + (x - x0) * gp + i, oy + (y - y0) * gp + j, inside ? c : col('#5a0e06'));
  }
}

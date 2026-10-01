// Pixel-icon toolkit: a small painter with light-aware primitives (shaded balls, tubes, bevelled
// slabs and rounded "puff" shapes grown from a distance field), hue-shifted 6-tone ramps, and the
// finishing pass that centres the art and wraps it in a hue-tinted selective outline (dark on the
// shadow side, lighter where it faces the top-left light).

import { PixelBuffer } from '../pixel';
import { C, hex, rgbToHsl, hslToRgb, R, G, B, A, shade, mix, withAlpha } from '../color';

export type Ramp = C[];
export type Mask = Uint8Array;
export type Pt = [number, number];

/** One icon: `draw` paints the art (it is centred and outlined afterwards), `post` adds un-outlined
 *  glows / steam / sparkles in the same coordinates, `size` is the canvas (24, or 16 for tiny glyphs). */
export interface IconDef { draw: (p: Pen) => void; post?: (p: Pen) => void; size?: number; center?: boolean }
export type IconSet = Record<string, IconDef>;

export const H = (s: string, a = 255): C => hex(s, a);
/** A ramp from hex strings, darkest first. */
export const rp = (...h: string[]): Ramp => h.map(x => hex(x));

// ---------------------------------------------------------------- shared ramps (dark -> light, last = glint)
export const RAMP = {
  steel: rp('#1b2131', '#323d53', '#53627a', '#8394a8', '#b8c6d0', '#f2f8f4'),
  chrome: rp('#242a3a', '#465066', '#768296', '#a8b4c2', '#d8e2e6', '#ffffff'),
  iron: rp('#101318', '#1a1e27', '#282e3a', '#3b4453', '#5c6778', '#98a6b4'),
  brass: rp('#3a1a0c', '#723610', '#ae6618', '#daa030', '#f4d064', '#fff6c8'),
  copper: rp('#361010', '#6c2416', '#a6441c', '#d6702c', '#f4a258', '#ffdca4'),
  wood: rp('#28110a', '#4c2410', '#78401c', '#a4622c', '#ca8a44', '#eab872'),
  pale: rp('#34200f', '#5e3a1a', '#8c5c2c', '#b6844a', '#dab070', '#f4dca4'),
  briar: rp('#1a0c08', '#361a12', '#56281a', '#783c22', '#9e5a32', '#cc8650'),
  red: rp('#310a18', '#681226', '#a6202e', '#d6443a', '#f27c54', '#ffc690'),
  orange: rp('#3e140c', '#7a2c10', '#b85216', '#e68026', '#fab44c', '#ffe6a0'),
  yellow: rp('#48280c', '#885210', '#c28818', '#ecbc30', '#fce268', '#fffcd4'),
  amber: rp('#461a04', '#883e08', '#c46e0e', '#eca428', '#fcd466', '#fff8cc'),
  leaf: rp('#0a211c', '#123c2a', '#1d6034', '#358638', '#66b044', '#b2dc6e'),
  lime: rp('#11301c', '#1f5a26', '#398a2a', '#62b232', '#9ad846', '#defa8e'),
  olive: rp('#1e220d', '#394016', '#5a6224', '#818a34', '#adb252', '#dedc8c'),
  teal: rp('#062226', '#0a4246', '#0e6c66', '#1c9e8e', '#4cd4b6', '#b4fde8'),
  glass: rp('#15303c', '#265464', '#3c808c', '#68b0b4', '#a6ded4', '#f2fff8'),
  blue: rp('#0e1534', '#192b60', '#27478c', '#3a6eba', '#62a0dc', '#acd8f6'),
  navy: rp('#090b17', '#13192e', '#1f2a4b', '#324270', '#50669a', '#90a8cc'),
  violet: rp('#180a2b', '#321654', '#512884', '#7944b6', '#a878da', '#dec4f6'),
  pink: rp('#3a1022', '#76243e', '#b0465e', '#dc7282', '#f4a6a6', '#ffe4d8'),
  cream: rp('#3a2e22', '#6a5840', '#9a8664', '#c6b48e', '#e6dab8', '#fffaec'),
  khaki: rp('#2c2814', '#4e4626', '#7a6e3e', '#a49860', '#cabe88', '#eee6b8'),
  stone: rp('#1c1e27', '#343845', '#535865', '#7a8089', '#a6acae', '#d8dcd4'),
  brownstone: rp('#28190f', '#463024', '#6a4c3c', '#92705c', '#ba9a80', '#e2cab0'),
  fur: rp('#22110a', '#432213', '#6a3a1e', '#94562c', '#ba7c44', '#dcac72'),
  poo: rp('#170e08', '#2c1b10', '#46301c', '#62482a', '#84663c', '#a88a56'),
  glow: rp('#08363c', '#0c5e62', '#12908a', '#26c2aa', '#76eed2', '#dcfff4'),
  skin: rp('#3c1a12', '#703628', '#a65e3c', '#d28a5a', '#f0b684', '#ffe2c0'),
  nitrile: rp('#0f1d46', '#1c3a78', '#2c5fac', '#4a8ed6', '#86c0f0', '#d4f2ff'),
  moon: rp('#4a4222', '#7c723e', '#aca462', '#d6d090', '#f2eec4', '#fffff2'),
  silver: rp('#2a323a', '#4a5862', '#72828a', '#9eaeb2', '#cad8d6', '#f6fffa'),
  clay: rp('#25252c', '#3e3d47', '#5c5a63', '#7c7880', '#a09a9a', '#c8c0ba'),
  kelp: rp('#18180a', '#32300e', '#504a18', '#726a26', '#988e3a', '#c6ba64'),
  rubber: rp('#0e0c10', '#1a1719', '#282326', '#3a3336', '#564c4e', '#80767a'),
  bone: rp('#40362a', '#72644c', '#a39370', '#cdbf98', '#ece2c2', '#fffcf0'),
  jade: rp('#0a2a22', '#114634', '#1a6a4c', '#2a946a', '#5cc492', '#b4f2cc'),
  dusk: rp('#190b22', '#31173e', '#4c2a5c', '#6c447e', '#9670a4', '#c6a8d0'),
  rust: rp('#2a0e08', '#52200e', '#7e3614', '#a8521e', '#cc7a34', '#eca662'),
};

// ---------------------------------------------------------------- colour helpers
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** darker (k < 0) or lighter (k > 0) with the pixel-art hue shift (cool shadows, warm lights) */
export const tone = (c: C, k: number): C => shade(c, k);
export const alpha = withAlpha;
export { mix };

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
/** light from the top-left, toward the viewer */
const LV = norm3(-0.52, -0.64, 0.58);
const HV = norm3(LV[0], LV[1], LV[2] + 1);

/** Deterministic hash noise 0..1. */
export const hash = (x: number, y: number, s = 0) => {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export interface Shade {
  /** tone bias (+ = lighter) */
  lift?: number;
  /** specular threshold on n·h (1 = off). Default 0.975 */
  spec?: number;
  /** highest tone used by diffuse light (default ramp.length - 2, the last one is the glint) */
  top?: number;
  /** lowest tone used (default 0) */
  bot?: number;
  /** reflected light on the rim of the shadow side */
  rim?: boolean;
  /** per-pixel tone offset (textures) */
  tex?: (x: number, y: number) => number;
  /** 0..1 flatten normals toward the viewer (flatter, brighter forms) */
  flat?: number;
  /** only paint where this returns true */
  clip?: (x: number, y: number) => boolean;
  /** tone contrast multiplier (default 1) */
  k?: number;
}

export class Pen {
  readonly b: PixelBuffer;
  readonly w: number;
  readonly h: number;
  constructor(w = 24, h = w) {
    this.b = new PixelBuffer(w, h);
    this.w = w;
    this.h = h;
  }

  // ------------------------------------------------------------ pixels
  px(x: number, y: number, c: C) { this.b.set(x, y, c); }
  pts(list: Pt[], c: C) { for (const [x, y] of list) this.b.set(x, y, c); }
  get(x: number, y: number) { return this.b.get(x, y); }
  has(x: number, y: number) { return A(this.b.get(x, y)) > 0; }
  /** set only where something is already painted */
  paint(x: number, y: number, c: C) { this.b.paint(x, y, c); }
  blend(x: number, y: number, c: C) { this.b.blend(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: C) { this.b.line(x0, y0, x1, y1, c); }
  rect(x: number, y: number, w: number, h: number, c: C) { this.b.rect(x, y, w, h, c); }
  clear(x: number, y: number) { this.b.set(x, y, 0); }
  /** recolour painted pixels */
  shift(m: Mask | null, k: number) {
    for (let i = 0; i < this.w * this.h; i++) {
      if (m && !m[i]) continue;
      const c = this.b.data[i];
      if (A(c)) this.b.data[i] = tone(c, k);
    }
  }
  /** draw a row-map: '.'/' ' transparent, other chars index pal */
  map(rows: string[], pal: Record<string, C>, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c !== undefined) this.b.set(ox + x, oy + y, c);
      }
  }

  // ------------------------------------------------------------ masks
  mask(): Mask { return new Uint8Array(this.w * this.h); }
  maskFn(fn: (x: number, y: number) => boolean): Mask {
    const m = this.mask();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (fn(x, y)) m[y * this.w + x] = 1;
    return m;
  }
  maskPoly(pts: number[]): Mask {
    const t = new PixelBuffer(this.w, this.h);
    t.poly(pts, 0xffffffff);
    const m = this.mask();
    for (let i = 0; i < m.length; i++) if (t.data[i]) m[i] = 1;
    return m;
  }
  maskEllipse(cx: number, cy: number, rx: number, ry: number, ang = 0): Mask {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    return this.maskFn((x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
      return u * u + v * v <= 1;
    });
  }
  maskDisc(cx: number, cy: number, r: number): Mask { return this.maskEllipse(cx, cy, r, r); }
  /** mask of the cells in a row-map whose character is one of `chars` */
  maskMap(rows: string[], chars: string, ox = 0, oy = 0): Mask {
    const m = this.mask();
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const X = x + ox, Y = y + oy;
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        if (chars.includes(rows[y][x])) m[Y * this.w + X] = 1;
      }
    return m;
  }
  /** pixel rectangle x..x+w-1, y..y+h-1 with the corners cut by `cut` pixels */
  maskBox(x: number, y: number, w: number, h: number, cut = 0): Mask {
    return this.maskFn((px, py) => {
      if (px < x || py < y || px >= x + w || py >= y + h) return false;
      const cx = Math.min(px - x, x + w - 1 - px), cy = Math.min(py - y, y + h - 1 - py);
      return cx + cy >= cut;
    });
  }
  /** pixels currently painted */
  painted(): Mask {
    const m = this.mask();
    for (let i = 0; i < m.length; i++) if (A(this.b.data[i])) m[i] = 1;
    return m;
  }
  static or(...ms: Mask[]): Mask { const o = new Uint8Array(ms[0].length); for (const m of ms) for (let i = 0; i < o.length; i++) if (m[i]) o[i] = 1; return o; }
  static sub(a: Mask, b: Mask): Mask { const o = new Uint8Array(a.length); for (let i = 0; i < o.length; i++) o[i] = a[i] && !b[i] ? 1 : 0; return o; }
  static and(a: Mask, b: Mask): Mask { const o = new Uint8Array(a.length); for (let i = 0; i < o.length; i++) o[i] = a[i] && b[i] ? 1 : 0; return o; }
  at(m: Mask, x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h && m[y * this.w + x] === 1; }

  // ------------------------------------------------------------ shading core
  /** tone index for a surface normal at pixel (x, y) */
  idx(n: number, nx: number, ny: number, nz: number, x: number, y: number, o: Shade): number {
    if (o.flat) {
      const f = o.flat;
      nx *= 1 - f; ny *= 1 - f; nz = nz * (1 - f) + f;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    const d = nx * LV[0] + ny * LV[1] + nz * LV[2];
    let q = (d + 0.32) / 1.32;
    if (q < 0) q = 0;
    const top = o.top ?? n - 2, bot = o.bot ?? 0;
    const k = o.k ?? 1;
    let f = bot + (q * (top - bot) - (top - bot) / 2) * k + (top - bot) / 2 + (o.lift ?? 0) + (o.tex ? o.tex(x, y) : 0);
    if (o.rim && nz < 0.5 && d < 0) f += 1;
    let i = Math.round(f);
    i = clamp(i, bot, top);
    const s = o.spec ?? 0.975;
    if (s < 1 && nx * HV[0] + ny * HV[1] + nz * HV[2] > s) i = n - 1;
    return i;
  }

  // ------------------------------------------------------------ primitives (each returns the mask it painted)
  /** Shaded ellipsoid, optionally rotated. */
  ball(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o: Shade & { ang?: number } = {}): Mask {
    const ang = o.ang ?? 0, ca = Math.cos(ang), sa = Math.sin(ang);
    const m = this.mask();
    const r = Math.max(rx, ry) + 1;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        const d2 = u * u + v * v;
        if (d2 > 1) continue;
        if (o.clip && !o.clip(x, y)) continue;
        const nz = Math.sqrt(1 - d2);
        const nx = u * ca - v * sa, ny = u * sa + v * ca;
        this.b.set(x, y, ramp[this.idx(ramp.length, nx, ny, nz, x, y, o)]);
        m[y * this.w + x] = 1;
      }
    return m;
  }

  /** Shaded cylinder along a polyline with a radius profile r(t), t = 0..1 along the length. */
  tube(pts: Pt[], r: number | ((t: number) => number), ramp: Ramp, o: Shade & { cap?: 'round' | 'flat' } = {}): Mask {
    const rf = typeof r === 'number' ? () => r : r;
    const seg: { ax: number; ay: number; dx: number; dy: number; len: number; s0: number }[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-6) continue;
      seg.push({ ax, ay, dx: (bx - ax) / len, dy: (by - ay) / len, len, s0: total });
      total += len;
    }
    const m = this.mask();
    if (!seg.length) return m;
    let rmax = 0;
    for (let i = 0; i <= 20; i++) rmax = Math.max(rmax, rf(i / 20));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const flat = o.cap === 'flat';
    for (let y = Math.floor(y0 - rmax - 1); y <= Math.ceil(y1 + rmax + 1); y++)
      for (let x = Math.floor(x0 - rmax - 1); x <= Math.ceil(x1 + rmax + 1); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const px = x + 0.5, py = y + 0.5;
        let best = Infinity, bs = 0, qx = 0, qy = 0, out = false;
        for (let k = 0; k < seg.length; k++) {
          const s = seg[k];
          let t = (px - s.ax) * s.dx + (py - s.ay) * s.dy;
          let o2 = false;
          if (t < 0) { if (k === 0) o2 = true; t = 0; }
          if (t > s.len) { if (k === seg.length - 1) o2 = true; t = s.len; }
          const cx = s.ax + s.dx * t, cy = s.ay + s.dy * t;
          const d = Math.hypot(px - cx, py - cy);
          if (d < best) { best = d; bs = (s.s0 + t) / total; qx = cx; qy = cy; out = o2; }
        }
        if (flat && out) continue;
        const rr = rf(bs);
        if (best > rr || rr <= 0) continue;
        if (o.clip && !o.clip(x, y)) continue;
        let nx = (px - qx) / rr, ny = (py - qy) / rr;
        const l2 = nx * nx + ny * ny;
        if (l2 > 1) { const l = Math.sqrt(l2); nx /= l; ny /= l; }
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        this.b.set(x, y, ramp[this.idx(ramp.length, nx, ny, nz, x, y, o)]);
        m[y * this.w + x] = 1;
      }
    return m;
  }

  /** Flat shape at one tone with a 1px bevel (lit top/left edge, shaded bottom/right edge). */
  slab(shape: number[] | Mask, ramp: Ramp, t: number, o: { hi?: number; lo?: number; bevel?: boolean; tex?: (x: number, y: number) => number; clip?: (x: number, y: number) => boolean } = {}): Mask {
    const m = Array.isArray(shape) ? this.maskPoly(shape) : shape;
    const bevel = o.bevel ?? true;
    const hi = o.hi ?? 1, lo = o.lo ?? -1;
    const n = ramp.length;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        if (o.clip && !o.clip(x, y)) continue;
        let i = t + (o.tex ? o.tex(x, y) : 0);
        if (bevel) {
          const tl = !this.at(m, x, y - 1) || !this.at(m, x - 1, y);
          const br = !this.at(m, x, y + 1) || !this.at(m, x + 1, y);
          if (tl && !br) i += hi;
          else if (br && !tl) i += lo;
        }
        this.b.set(x, y, ramp[clamp(Math.round(i), 0, n - 1)]);
      }
    return m;
  }

  /** Distance from each mask pixel to the outside (pixel units, capped at cap). */
  dist(m: Mask, cap = 6): Float32Array {
    const d = new Float32Array(m.length);
    const R = Math.ceil(cap);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        let best = cap * cap;
        for (let yy = y - R; yy <= y + R; yy++)
          for (let xx = x - R; xx <= x + R; xx++) {
            if (this.at(m, xx, yy)) continue;
            const dd = (xx - x) * (xx - x) + (yy - y) * (yy - y);
            if (dd < best) best = dd;
          }
        d[y * this.w + x] = Math.sqrt(best) - 0.5;
      }
    return d;
  }

  /** Rounded shading for any silhouette: a height field grown from the mask's distance field. */
  puff(m: Mask, ramp: Ramp, o: Shade & { r?: number } = {}): Mask {
    const R = o.r ?? 4;
    const d = this.dist(m, R + 1);
    const hgt = new Float32Array(m.length);
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      const t = Math.min(d[i], R) / R;
      hgt[i] = R * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    }
    const hAt = (x: number, y: number) => (this.at(m, x, y) ? hgt[y * this.w + x] : 0);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        if (o.clip && !o.clip(x, y)) continue;
        const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2, gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2;
        const [nx, ny, nz] = norm3(-gx, -gy, 1);
        this.b.set(x, y, ramp[this.idx(ramp.length, nx, ny, nz, x, y, o)]);
      }
    return m;
  }

  /** Fill a mask with a colour or a per-pixel function (-1 = skip). */
  fill(m: Mask, c: C | ((x: number, y: number) => C | -1)) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        const v = typeof c === 'number' ? c : c(x, y);
        if (v !== -1) this.b.set(x, y, v);
      }
  }

  /** Contact shadow: darken what is already painted just below/right of mask (the new part sits on top). */
  drop(m: Mask, k = -0.35, dx = 1, dy = 1) {
    const src = this.b.data.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const sx = x - dx, sy = y - dy;
        if (!this.at(m, sx, sy) || this.at(m, x, y)) continue;
        const c = src[y * this.w + x];
        if (A(c)) this.b.data[y * this.w + x] = tone(c, k);
      }
  }

  /** Inner line: pixels of m that touch painted pixels outside m get colour c (or a darkened tint). */
  seam(m: Mask, c?: C, sides = 15) {
    const src = this.b.data.slice();
    const other = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && !m[y * this.w + x] && A(src[y * this.w + x]) > 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!m[y * this.w + x]) continue;
        const s = (other(x, y - 1) ? 1 : 0) | (other(x, y + 1) ? 2 : 0) | (other(x - 1, y) ? 4 : 0) | (other(x + 1, y) ? 8 : 0);
        if (s & sides) this.b.data[y * this.w + x] = c ?? tone(src[y * this.w + x], -0.55);
      }
  }

  /** Outline colour of a fill pixel: a deep hue-matched tint (lighter on the lit side). */
  static tint(c: C, lit: boolean): C {
    const [h, s, l] = rgbToHsl(R(c), G(c), B(c));
    let dh = 0.68 - h;
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
    const nh = h + dh * (lit ? 0.03 : 0.09);
    const ns = Math.min(0.78, s * 0.85 + 0.08);
    const nl = lit ? Math.min(0.2, 0.055 + l * 0.2) : Math.min(0.105, 0.03 + l * 0.1);
    return hslToRgb(nh, ns, nl);
  }
}

/** Hue-tinted 1px outline around everything painted (4-neighbour), lighter on the top/left. */
export function outline(b: PixelBuffer, flat?: C) {
  const w = b.w, h = b.h, src = b.data.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && A(src[y * w + x]) > 40;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (A(src[y * w + x]) > 40) continue;
      const r = op(x + 1, y), d = op(x, y + 1), l = op(x - 1, y), u = op(x, y - 1);
      if (!(r || d || l || u)) continue;
      if (flat !== undefined) { b.data[y * w + x] = flat; continue; }
      // lit side: the shape is to the right of / below this outline pixel and nothing above/left
      const lit = (r || d) && !(l || u);
      const n = l ? src[y * w + x - 1] : u ? src[(y - 1) * w + x] : r ? src[y * w + x + 1] : src[(y + 1) * w + x];
      b.data[y * w + x] = Pen.tint(n, lit);
    }
}

/** Paint, centre (1px margin for the outline), outline, then lay the post layer on top. */
export function renderIcon(d: IconDef): PixelBuffer {
  const S = d.size ?? 24;
  const p = new Pen(S);
  d.draw(p);
  let ox = 0, oy = 0;
  if (d.center !== false) {
    const t = p.b.trim(0);
    if (t.buf.w > 1 || t.buf.h > 1) {
      const w = t.buf.w, h = t.buf.h;
      ox = (w > S - 2 ? Math.floor((S - w) / 2) : clamp(Math.floor((S - w) / 2), 1, S - 1 - w)) - t.ox;
      oy = (h > S - 2 ? Math.floor((S - h) / 2) : clamp(Math.round((S - h) / 2), 1, S - 1 - h)) - t.oy;
    }
  }
  const out = new PixelBuffer(S, S);
  out.blit(p.b, ox, oy, false, false);
  outline(out);
  if (d.post) {
    const q = new Pen(S);
    d.post(q);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const c = q.b.get(x - ox, y - oy);
        if (A(c)) out.blend(x, y, c);
      }
  }
  return out;
}

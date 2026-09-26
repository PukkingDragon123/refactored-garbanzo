// Rendering core for the V2 beasts.
//
// Sprites are built in a tiny z-buffered G-buffer ("Sk", sketch): every body mass, limb, feather,
// quill and membrane is rasterised as an implicit surface that writes a material id, a lighting
// value (from its analytic normal, key light top-left) and a depth. Overlapping masses merge along
// natural intersection creases through the depth test, while parts that pass in front of others
// with a depth gap get a dark interior separation line (like toon edge detection). The resolve pass
// quantises lighting into hue-shifted OKLab ramps, adds a back rim / underside bounce, removes
// isolated specks and wraps everything in a selective, tinted dark outline.

import { PixelBuffer } from './pixel';
import { C, rgba, R, G, B, A, hex } from './color';
import { clamp, hash2 } from '../core/math';

export type V2 = [number, number];
export type V3 = [number, number, number];
export type BeastEye = 'open' | 'alert' | 'angry' | 'scared' | 'closed';

// ------------------------------------------------------------------ colour (OKLab ramps)
const s2l = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const l2s = (c: number) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(clamp(v) * 255); };

export function toLab(c: C): V3 {
  const r = s2l(R(c)), g = s2l(G(c)), b = s2l(B(c));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function labLin(L: number, a: number, b: number): V3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (v: V3) => v[0] > -2e-4 && v[0] < 1.0002 && v[1] > -2e-4 && v[1] < 1.0002 && v[2] > -2e-4 && v[2] < 1.0002;
export function fromLab(L: number, a: number, b: number, alpha = 255): C {
  L = clamp(L, 0, 1);
  let v = labLin(L, a, b);
  if (!inGamut(v)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(labLin(L, a * mid, b * mid))) lo = mid; else hi = mid;
    }
    v = labLin(L, a * lo, b * lo);
  }
  return rgba(l2s(v[0]), l2s(v[1]), l2s(v[2]), alpha);
}

const HUE_COOL = 4.85, HUE_WARM = 1.35;
function rotToward(h: number, target: number, f: number) {
  let d = target - h;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return h + d * f;
}

export interface RampOpt {
  n?: number;      // number of tones (default 6)
  at?: number;     // index of the base colour (default ~0.6 of the way up)
  dark?: number;   // how far the darkest tone drops (fraction of base lightness), default 0.6
  light?: number;  // how far the lightest tone rises toward white, default 0.5
  cool?: number;   // hue shift toward blue-violet in the shadows (0..1)
  warm?: number;   // hue shift toward yellow in the lights (0..1)
  sat?: number;    // extra shadow saturation
}
/** Hue-shifted ramp (dark -> light) around a base colour: cool saturated shadows, warm lights. */
const rampCache = new Map<string, C[]>();
export function rmp(base: string | C, o: RampOpt = {}): C[] {
  const key = base + JSON.stringify(o);
  const hit = rampCache.get(key);
  if (hit) return hit;
  const r = rmpRaw(base, o);
  rampCache.set(key, r);
  return r;
}
function rmpRaw(base: string | C, o: RampOpt): C[] {
  const c = typeof base === 'string' ? hex(base) : base;
  const n = o.n ?? 6;
  const at = o.at ?? Math.round((n - 1) * 0.6);
  const [L0, a0, b0] = toLab(c);
  const Lmin = L0 * (1 - (o.dark ?? 0.6));
  const Lmax = L0 + (1 - L0) * (o.light ?? 0.5);
  const cool = o.cool ?? 0.3, warm = o.warm ?? 0.25, sat = o.sat ?? 0.25;
  const C0 = Math.hypot(a0, b0), h0 = Math.atan2(b0, a0);
  const out: C[] = [];
  for (let i = 0; i < n; i++) {
    let L = L0, Cc = C0, h = h0, ta = 0, tb = 0;
    if (i < at) {
      const k = (at - i) / at;
      L = L0 + (Lmin - L0) * k;
      h = rotToward(h0, HUE_COOL, cool * k);
      Cc = C0 * (1 + sat * k);
      ta = Math.cos(HUE_COOL) * 0.022 * k * cool * 2.5;
      tb = Math.sin(HUE_COOL) * 0.022 * k * cool * 2.5;
    } else if (i > at) {
      const k = (i - at) / Math.max(1, n - 1 - at);
      L = L0 + (Lmax - L0) * k;
      h = rotToward(h0, HUE_WARM, warm * k);
      Cc = C0 * (1 - 0.3 * k);
      ta = Math.cos(HUE_WARM) * 0.016 * k * warm * 3;
      tb = Math.sin(HUE_WARM) * 0.016 * k * warm * 3;
    }
    out.push(fromLab(L, Cc * Math.cos(h) + ta, Cc * Math.sin(h) + tb));
  }
  return out;
}

/** Mix two packed colours in OKLab. */
export function lmix(a: C, b: C, t: number): C {
  const p = toLab(a), q = toLab(b);
  return fromLab(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, Math.round(A(a) + (A(b) - A(a)) * t));
}
/** Lighten/darken in OKLab with a gentle hue shift. */
export function tone(c: C, k: number): C {
  const [L, a, b] = toLab(c);
  const Cc = Math.hypot(a, b), h = Math.atan2(b, a);
  const nh = rotToward(h, k > 0 ? HUE_WARM : HUE_COOL, Math.min(1, Math.abs(k)) * 0.25);
  const nL = k > 0 ? L + (1 - L) * k : L * (1 + k);
  return fromLab(nL, Cc * Math.cos(nh), Cc * Math.sin(nh), A(c));
}

const outlineCache = new Map<number, C>();
function outlineOf(c: C, lit: boolean): C {
  const key = ((c & 0xffffff) * 2 + (lit ? 1 : 0));
  let o = outlineCache.get(key);
  if (o === undefined) {
    const [L, a, b] = toLab(c);
    const nL = lit ? 0.12 + L * 0.3 : 0.08 + L * 0.17;
    const k = lit ? 0.62 : 0.5;
    // pull the hue slightly cool so outlines never look muddy
    o = fromLab(nL, a * k + 0.004, b * k - 0.012);
    outlineCache.set(key, o);
  }
  return o;
}

// ------------------------------------------------------------------ lighting
const LX = -0.52, LY = -0.74, LZ = 0.42;
/** Half-lambert key light from the top-left-front (with a little extra contrast baked in). */
export const lumN = (nx: number, ny: number, nz: number) => 0.44 + 0.62 * (nx * LX + ny * LY + nz * LZ);

// ------------------------------------------------------------------ sketch
export interface Px {
  x: number; y: number; // local coords of the pixel centre
  t: number;            // primitive length parameter (tubes, blades) 0..1
  u: number; v: number; // primitive local coords (ellipse: -1..1; tube: v across -1..1)
  nx: number; ny: number; nz: number;
  z: number;
  l: number;            // lighting 0..1 (writable)
}
export type Fill = number | ((p: Px) => number);

export interface Mat {
  ramp: C[];
  /** lighting bias added before quantising */
  bias: number;
  /** contrast around the mid tone */
  k: number;
  noRim: boolean;
  /** number of tones dropped for depth-edge lines */
  edge: number;
  spec: number; // specular strength for glossy stuff (eyes, beaks, wet skin)
}

export interface EllOpt { rot?: number; rz?: number; z?: number; bias?: number; flat?: number; noZ?: boolean }
export interface TubeOpt { z?: number | ((t: number) => number); rz?: number; bias?: number; noZ?: boolean; flat?: number }

const PX: Px = { x: 0, y: 0, t: 0, u: 0, v: 0, nx: 0, ny: 0, nz: 1, z: 0, l: 0.5 };

export class Sk {
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  readonly mat: Uint8Array;
  readonly lum: Float32Array;
  readonly z: Float32Array;
  readonly part: Uint16Array;
  readonly ov: Uint32Array;
  readonly mats: Mat[] = [{ ramp: [0], bias: 0, k: 1, noRim: true, edge: 0, spec: 0 }];
  /** parts flagged here never cast edge lines onto what is behind them */
  readonly soft = new Set<number>();
  pid = 1;
  /** global z offset added to everything drawn (layering) */
  zb = 0;
  /** optional clip: pixels with local y > clipY are not drawn (burrowing, water) */
  clipY = Infinity;

  constructor(w: number, h: number, ox: number, oy: number) {
    this.w = Math.ceil(w);
    this.h = Math.ceil(h);
    this.ox = Math.round(ox);
    this.oy = Math.round(oy);
    const n = this.w * this.h;
    this.mat = new Uint8Array(n);
    this.lum = new Float32Array(n);
    this.z = new Float32Array(n).fill(-1e9);
    this.part = new Uint16Array(n);
    this.ov = new Uint32Array(n);
  }

  /** Register a material; returns its id. */
  m(ramp: C[], o: Partial<Omit<Mat, 'ramp'>> = {}): number {
    this.mats.push({ ramp, bias: 0, k: 1, noRim: false, edge: 2, spec: 0, ...o });
    return this.mats.length - 1;
  }
  /** Start a new part (edge lines are only drawn between different parts). */
  np(soft = false): number {
    this.pid++;
    if (soft) this.soft.add(this.pid);
    return this.pid;
  }

  idx(x: number, y: number) {
    const xi = Math.floor(x + this.ox), yi = Math.floor(y + this.oy);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return -1;
    return yi * this.w + xi;
  }
  has(x: number, y: number) {
    const i = this.idx(x, y);
    return i >= 0 && this.mat[i] > 0;
  }
  zAt(x: number, y: number) {
    const i = this.idx(x, y);
    return i >= 0 ? this.z[i] : -1e9;
  }
  lAt(x: number, y: number) {
    const i = this.idx(x, y);
    return i >= 0 ? this.lum[i] : 0.5;
  }
  matAt(x: number, y: number) {
    const i = this.idx(x, y);
    return i >= 0 ? this.mat[i] : 0;
  }
  partAt(x: number, y: number) {
    const i = this.idx(x, y);
    return i >= 0 ? this.part[i] : 0;
  }

  /** Write one pixel (buffer index) through the depth test. */
  private emit(i: number, fill: Fill, p: Px, noZ: boolean) {
    const z = p.z + this.zb;
    if (!noZ && z <= this.z[i]) return;
    if (p.y > this.clipY) return;
    const m = typeof fill === 'number' ? fill : fill(p);
    if (m <= 0) return;
    this.mat[i] = m;
    this.lum[i] = p.l;
    this.z[i] = noZ ? Math.max(this.z[i], z) : z;
    this.part[i] = this.pid;
  }

  /** Shaded ellipsoid. */
  ell(cx: number, cy: number, rx: number, ry: number, fill: Fill, o: EllOpt = {}) {
    if (rx <= 0 || ry <= 0) return;
    const rot = o.rot ?? 0, rz = o.rz ?? Math.min(rx, ry), z0 = o.z ?? 0, bias = o.bias ?? 0, flat = o.flat ?? 0;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const ext = Math.max(rx, ry) + 1;
    const x0 = Math.max(0, Math.floor(cx - ext + this.ox)), x1 = Math.min(this.w - 1, Math.ceil(cx + ext + this.ox));
    const y0 = Math.max(0, Math.floor(cy - ext + this.oy)), y1 = Math.min(this.h - 1, Math.ceil(cy + ext + this.oy));
    const p = PX;
    for (let yy = y0; yy <= y1; yy++) {
      const py = yy - this.oy + 0.5, dy = py - cy;
      for (let xx = x0; xx <= x1; xx++) {
        const px = xx - this.ox + 0.5, dx = px - cx;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        const u = lx / rx, v = ly / ry;
        const d2 = u * u + v * v;
        if (d2 > 1) continue;
        const w = Math.sqrt(1 - d2);
        let nlx = u / rx, nly = v / ry, nz = w / rz;
        const nl = Math.hypot(nlx, nly, nz) || 1;
        nlx /= nl; nly /= nl; nz /= nl;
        if (flat) { nlx *= 1 - flat; nly *= 1 - flat; nz = Math.sqrt(Math.max(0, 1 - nlx * nlx - nly * nly)); }
        p.x = px; p.y = py; p.u = u; p.v = v; p.t = 0;
        p.nx = nlx * cs - nly * sn; p.ny = nlx * sn + nly * cs; p.nz = nz;
        p.z = z0 + rz * w;
        p.l = lumN(p.nx, p.ny, p.nz) + bias;
        this.emit(yy * this.w + xx, fill, p, !!o.noZ);
      }
    }
  }

  /** Tapered tube (swept sphere) along a polyline with cylinder shading. v = -1..1 across (left of travel = -1). */
  tube(pts: V2[], rad: number | ((t: number) => number), fill: Fill, o: TubeOpt = {}) {
    const n = pts.length;
    if (n < 2) {
      if (n === 1) this.ell(pts[0][0], pts[0][1], typeof rad === 'number' ? rad : rad(0), typeof rad === 'number' ? rad : rad(0), fill, { z: typeof o.z === 'number' ? o.z : o.z ? o.z(0) : 0, bias: o.bias, noZ: o.noZ });
      return;
    }
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const total = cum[n - 1] || 1e-6;
    const rf = typeof rad === 'number' ? () => rad : rad;
    const zf = typeof o.z === 'function' ? o.z : ((zc: number) => () => zc)(o.z ?? 0);
    const rz = o.rz ?? 1, bias = o.bias ?? 0, flat = o.flat ?? 0;
    let maxR = 0;
    for (let k = 0; k <= 8; k++) maxR = Math.max(maxR, rf(k / 8));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of pts) { bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]); }
    const x0 = Math.max(0, Math.floor(bx0 - maxR - 1 + this.ox)), x1 = Math.min(this.w - 1, Math.ceil(bx1 + maxR + 1 + this.ox));
    const y0 = Math.max(0, Math.floor(by0 - maxR - 1 + this.oy)), y1 = Math.min(this.h - 1, Math.ceil(by1 + maxR + 1 + this.oy));
    const p = PX;
    for (let yy = y0; yy <= y1; yy++) {
      const py = yy - this.oy + 0.5;
      for (let xx = x0; xx <= x1; xx++) {
        const px = xx - this.ox + 0.5;
        let best = Infinity, bt = 0, bqx = 0, bqy = 0, bsx = 1, bsy = 0;
        for (let i = 1; i < n; i++) {
          const ax = pts[i - 1][0], ay = pts[i - 1][1];
          const sx = pts[i][0] - ax, sy = pts[i][1] - ay;
          const L2 = sx * sx + sy * sy;
          let k = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
          const qx = ax + sx * k, qy = ay + sy * k;
          const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
          if (d2 < best) { best = d2; bt = (cum[i - 1] + (cum[i] - cum[i - 1]) * k) / total; bqx = qx; bqy = qy; bsx = sx; bsy = sy; }
        }
        const r = rf(bt);
        if (r <= 0) continue;
        const d = Math.sqrt(best);
        if (d > r) continue;
        const q = d / r;
        const w = Math.sqrt(Math.max(0, 1 - q * q));
        let ex = 0, ey = 0;
        if (d > 1e-5) { ex = (px - bqx) / d; ey = (py - bqy) / d; }
        const side = bsx * (py - bqy) - bsy * (px - bqx) > 0 ? 1 : -1;
        p.x = px; p.y = py; p.t = bt; p.u = bt; p.v = side * q;
        p.nx = ex * q * (1 - flat); p.ny = ey * q * (1 - flat); p.nz = Math.sqrt(Math.max(0, 1 - p.nx * p.nx - p.ny * p.ny));
        p.z = zf(bt) + r * w * rz;
        p.l = lumN(p.nx, p.ny, p.nz) + bias;
        this.emit(yy * this.w + xx, fill, p, !!o.noZ);
      }
    }
  }

  /**
   * Blade: a leaf / feather / quill / claw shaped strip from (bx,by) to (tx,ty). hw(s) is the half
   * width in px at s (0 base .. 1 tip). `bend` bows the axis sideways (px at mid length).
   * v = -1..1 across, t = s along. Normal is a gentle across-bend on top of `n`.
   */
  blade(bx: number, by: number, tx: number, ty: number, hw: (s: number) => number, fill: Fill,
    o: { z0?: number; z1?: number; n?: V3; bend?: number; curl?: number; bias?: number; noZ?: boolean } = {}) {
    const ax = tx - bx, ay = ty - by;
    const len = Math.hypot(ax, ay);
    if (len < 0.01) return;
    const ux = ax / len, uy = ay / len, qx = -uy, qy = ux;
    const bend = o.bend ?? 0, curl = o.curl ?? 0.35;
    const z0 = o.z0 ?? 0, z1 = o.z1 ?? z0, bias = o.bias ?? 0;
    const n = o.n ?? [0, 0, 1];
    let maxW = 0;
    for (let k = 0; k <= 8; k++) maxW = Math.max(maxW, hw(k / 8));
    const ext = maxW + Math.abs(bend) + 1;
    const xs = [bx, tx], ys = [by, ty];
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - ext + this.ox)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(...xs) + ext + this.ox));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - ext + this.oy)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys) + ext + this.oy));
    const p = PX;
    for (let yy = y0; yy <= y1; yy++) {
      const py = yy - this.oy + 0.5;
      for (let xx = x0; xx <= x1; xx++) {
        const px = xx - this.ox + 0.5;
        const rx = px - bx, ry = py - by;
        const s = (rx * ux + ry * uy) / len;
        if (s < 0 || s > 1) continue;
        const off = rx * qx + ry * qy - bend * 4 * s * (1 - s);
        const wv = hw(s);
        if (wv <= 0 || Math.abs(off) > wv) continue;
        const v = off / wv;
        // bend the normal across the blade width
        let nx = n[0] + qx * v * curl, ny = n[1] + qy * v * curl, nz = n[2];
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        p.x = px; p.y = py; p.t = s; p.u = s; p.v = v;
        p.nx = nx; p.ny = ny; p.nz = nz;
        p.z = z0 + (z1 - z0) * s + (1 - v * v) * 0.5;
        p.l = lumN(nx, ny, nz) + bias;
        this.emit(yy * this.w + xx, fill, p, !!o.noZ);
      }
    }
  }

  /** Flat polygon (local coords [x0,y0,x1,y1,...]) with a constant normal; z may vary linearly. */
  poly(pts: number[], fill: Fill, o: { z?: number | ((x: number, y: number) => number); n?: V3; bias?: number; noZ?: boolean } = {}) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    const cnt = pts.length / 2;
    const n = o.n ?? [0, 0, 1];
    const l0 = lumN(n[0], n[1], n[2]) + (o.bias ?? 0);
    const zf = typeof o.z === 'function' ? o.z : null;
    const zc = typeof o.z === 'number' ? o.z : 0;
    const xs: number[] = [];
    const p = PX;
    const yA = Math.max(0, Math.floor(minY + this.oy)), yB = Math.min(this.h - 1, Math.ceil(maxY + this.oy));
    for (let yy = yA; yy <= yB; yy++) {
      const sy = yy - this.oy + 0.5;
      xs.length = 0;
      for (let i = 0; i < cnt; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % cnt) * 2], by = pts[((i + 1) % cnt) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k] + this.ox)), xb = Math.min(this.w - 1, Math.round(xs[k + 1] + this.ox) - 1);
        for (let xx = xa; xx <= xb; xx++) {
          const px = xx - this.ox + 0.5;
          p.x = px; p.y = sy; p.t = 0; p.u = 0; p.v = 0;
          p.nx = n[0]; p.ny = n[1]; p.nz = n[2];
          p.z = zf ? zf(px, sy) : zc;
          p.l = l0;
          this.emit(yy * this.w + xx, fill, p, !!o.noZ);
        }
      }
    }
  }

  /** 1px line with depth test. */
  line(x0: number, y0: number, x1: number, y1: number, m: number, l: number, z: number, noZ = false) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, m, l, z, noZ);
    }
  }
  dot(x: number, y: number, m: number, l: number, z: number, noZ = false) {
    const i = this.idx(x, y);
    if (i < 0) return;
    const p = PX;
    p.x = x; p.y = y; p.z = z; p.l = l;
    this.emit(i, m, p, noZ);
  }
  /** Change material / lighting of an already drawn pixel (no depth test). */
  paint(x: number, y: number, m: number, dl = 0, onlyPart = 0) {
    const i = this.idx(x, y);
    if (i < 0 || !this.mat[i]) return;
    if (onlyPart && this.part[i] !== onlyPart) return;
    if (m > 0) this.mat[i] = m;
    this.lum[i] += dl;
  }
  /** Overlay colour: drawn on top of everything after the outline (eyes, whiskers, sparkles). */
  over(x: number, y: number, c: C) {
    if (y > this.clipY) return;
    const i = this.idx(x, y);
    if (i >= 0) this.ov[i] = c;
  }
  overLine(x0: number, y0: number, x1: number, y1: number, c: C) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.over(x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n), c);
  }
  /** Overlay only where the sprite is already opaque. */
  overPaint(x: number, y: number, c: C) {
    const i = this.idx(x, y);
    if (i >= 0 && this.mat[i]) this.ov[i] = c;
  }

  /** Apply directional fur streaks to the pixels of one part: short darker strokes along dir(x,y). */
  streaks(partId: number, dir: (x: number, y: number) => V2, o: { spacing?: number; len?: number; amp?: number; seed?: number; light?: number } = {}) {
    const sp = o.spacing ?? 3, len = o.len ?? 3, amp = o.amp ?? 0.1, seed = o.seed ?? 7, lamp = o.light ?? amp * 0.6;
    const W = this.w, H = this.h;
    for (let gy = 0; gy < H; gy += sp)
      for (let gx = 0; gx < W; gx += sp) {
        const jx = gx + Math.floor(hash2(gx, gy, seed) * sp), jy = gy + Math.floor(hash2(gy, gx, seed + 1) * sp);
        if (jx >= W || jy >= H) continue;
        const i0 = jy * W + jx;
        if (this.part[i0] !== partId || !this.mat[i0]) continue;
        const lx = jx - this.ox + 0.5, ly = jy - this.oy + 0.5;
        const [dx, dy] = dir(lx, ly);
        const L = len + Math.floor(hash2(jx, jy, seed + 2) * 2);
        const dark = hash2(jx, jy, seed + 3) < 0.62;
        for (let k = 0; k < L; k++) {
          const i = this.idx(lx + dx * k, ly + dy * k);
          if (i < 0 || this.part[i] !== partId) break;
          this.lum[i] += dark ? -amp : lamp;
        }
      }
  }

  /** Short fur tufts poking out of the silhouette of a part along dir (outward/backward). */
  tufts(partId: number, sel: (x: number, y: number, nx: number, ny: number) => V2 | null, o: { every?: number; seed?: number; len?: number } = {}) {
    const W = this.w, H = this.h, every = o.every ?? 3, seed = o.seed ?? 3, len = o.len ?? 2;
    const edges: [number, number, number, number][] = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (this.part[i] !== partId || !this.mat[i]) continue;
        let nx = 0, ny = 0;
        if (!this.mat[i - 1]) nx -= 1;
        if (!this.mat[i + 1]) nx += 1;
        if (!this.mat[i - W]) ny -= 1;
        if (!this.mat[i + W]) ny += 1;
        if (nx === 0 && ny === 0) continue;
        if (hash2(x, y, seed) * every > 1) continue;
        edges.push([x, y, nx, ny]);
      }
    for (const [x, y, nx, ny] of edges) {
      const lx = x - this.ox + 0.5, ly = y - this.oy + 0.5;
      const d = sel(lx, ly, nx, ny);
      if (!d) continue;
      const i0 = y * W + x;
      const m = this.mat[i0], l = this.lum[i0], z = this.z[i0];
      const L = len + (hash2(x, y, seed + 5) < 0.4 ? 1 : 0);
      for (let k = 1; k <= L; k++) {
        const i = this.idx(lx + d[0] * k, ly + d[1] * k);
        if (i < 0 || this.mat[i]) continue;
        this.mat[i] = m; this.lum[i] = l - 0.04 * k; this.z[i] = z; this.part[i] = partId;
      }
    }
  }

  /** Resolve the G-buffer into a coloured PixelBuffer. */
  resolve(o: { outline?: boolean; rim?: number; bounce?: number } = {}): PixelBuffer {
    const W = this.w, H = this.h;
    const out = new PixelBuffer(W, H);
    const d = out.data;
    const mat = this.mat, lum = this.lum, zb = this.z, part = this.part, soft = this.soft;
    const RIM = o.rim ?? 0.13, BOUNCE = o.bounce ?? 0.1, ZT = 1.4;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const m = mat[i];
        if (!m) continue;
        const M = this.mats[m];
        let l = (lum[i] - 0.5) * M.k + 0.5 + M.bias;
        const up = y > 0 ? mat[i - W] : 0, dn = y < H - 1 ? mat[i + W] : 0;
        if (!M.noRim) {
          if (!up) l += RIM;
          else if (!dn) l += BOUNCE;
        }
        let edge = false;
        const zi = zb[i] + ZT, pi = part[i];
        if (M.edge > 0) {
          if (up && part[i - W] !== pi && zb[i - W] > zi && !soft.has(part[i - W])) edge = true;
          else if (dn && part[i + W] !== pi && zb[i + W] > zi && !soft.has(part[i + W])) edge = true;
          else if (x > 0 && mat[i - 1] && part[i - 1] !== pi && zb[i - 1] > zi && !soft.has(part[i - 1])) edge = true;
          else if (x < W - 1 && mat[i + 1] && part[i + 1] !== pi && zb[i + 1] > zi && !soft.has(part[i + 1])) edge = true;
        }
        const n = M.ramp.length;
        let k = Math.floor(clamp(l, 0, 0.9999) * n);
        if (edge) k -= M.edge;
        d[i] = M.ramp[k < 0 ? 0 : k >= n ? n - 1 : k];
      }
    // despeckle: an interior pixel unlike all four (identical) neighbours adopts them
    const src = d.slice();
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const c = src[i];
        if (!c || this.ov[i]) continue;
        const a = src[i - 1], b = src[i + 1], e = src[i - W], f = src[i + W];
        if (a === b && a === e && a === f && a !== c && a !== 0) d[i] = a;
      }
    if (o.outline !== false) {
      const s2 = d.slice();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (s2[i] >>> 24) continue;
          const l = x > 0 ? s2[i - 1] : 0, r = x < W - 1 ? s2[i + 1] : 0;
          const u = y > 0 ? s2[i - W] : 0, b = y < H - 1 ? s2[i + W] : 0;
          if (!(l >>> 24) && !(r >>> 24) && !(u >>> 24) && !(b >>> 24)) continue;
          // lit side: the shape lies to the right / below this outline pixel only
          const lit = !(l >>> 24) && !(u >>> 24);
          const c = b >>> 24 ? b : r >>> 24 ? r : u >>> 24 ? u : l;
          d[i] = outlineOf(c, lit);
        }
    }
    const ov = this.ov;
    for (let i = 0; i < ov.length; i++) {
      const c = ov[i];
      if (!c) continue;
      if (c >>> 24 === 255) d[i] = c;
      else out.blend(i % W, (i / W) | 0, c);
    }
    return out;
  }
}

// ------------------------------------------------------------------ rig helpers
export const TAU = Math.PI * 2;
export const fr = (v: number) => v - Math.floor(v);
export const sm = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const mixN = (a: number, b: number, t: number) => a + (b - a) * t;
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
export const lerp2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const rot2 = (v: V2, a: number): V2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
export const polar = (a: number, r: number): V2 => [Math.cos(a) * r, Math.sin(a) * r];
export const len2 = (v: V2) => Math.hypot(v[0], v[1]);

/** Two-bone IK: returns [joint, end] (end is clamped to reach). bend +1 puts the joint clockwise of the root->target line (screen coords). */
export function ik2(root: V2, target: V2, l1: number, l2: number, bend: number): [V2, V2] {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  d = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A1 = Math.acos(clamp(cosA, -1, 1));
  const ja = a + bend * A1;
  const j: V2 = [root[0] + Math.cos(ja) * l1, root[1] + Math.sin(ja) * l1];
  const end: V2 = [root[0] + Math.cos(a) * d, root[1] + Math.sin(a) * d];
  return [j, end];
}

/** Stance/swing foot offset for a gait phase: stance slides back along the ground, swing arcs forward. */
export function gait(phase: number, duty: number, stride: number, lift: number): V2 {
  const p = fr(phase);
  if (p < duty) {
    const k = p / duty;
    return [stride * (0.5 - k), 0];
  }
  const k = (p - duty) / (1 - duty);
  const e = k * k * (3 - 2 * k);
  return [stride * (-0.5 + e), -lift * Math.sin(Math.PI * k)];
}

/** Piecewise keyframes [[t, value], ...] with smooth easing between keys. */
export function kf(t: number, keys: [number, number][]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return v0 + (v1 - v0) * sm((t - t0) / Math.max(1e-6, t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Sample a chain of points from a start, heading and per-segment turn. */
export function chain(start: V2, ang: number, segs: number, segLen: number | ((i: number) => number), turn: (i: number) => number): V2[] {
  const pts: V2[] = [start];
  let a = ang, p = start;
  for (let i = 0; i < segs; i++) {
    a += turn(i);
    const L = typeof segLen === 'number' ? segLen : segLen(i);
    p = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L];
    pts.push(p);
  }
  return pts;
}

/** Quadratic bezier sampled into n+1 points. */
export function qbez(a: V2, c: V2, b: V2, n = 8): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}
/** Cubic bezier sampled into n+1 points. */
export function cbez(a: V2, c1: V2, c2: V2, b: V2, n = 10): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
    ]);
  }
  return out;
}
/** Point and tangent angle along a polyline at t (0..1). */
export function along(pts: V2[], t: number): { p: V2; a: number } {
  let total = 0;
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(total); }
  const d = clamp(t) * total;
  for (let i = 1; i < pts.length; i++) {
    if (d <= seg[i] || i === pts.length - 1) {
      const k = (d - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]);
      const a = pts[i - 1], b = pts[i];
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
  }
  return { p: pts[0], a: 0 };
}

// ------------------------------------------------------------------ eyes
export interface EyeSpec {
  /** eye radius in px: 0.5 (1px) .. 4 */
  r: number;
  iris: C;
  pupil?: C;
  white?: C;
  /** dark line for closed lids and brows */
  lash: C;
  shine?: C;
  ring?: C;
  /** permanent brow ridge (raptors): draws a shading line over the eye */
  brow?: C;
  slit?: 'v' | 'h';
  /** big dark nocturnal eye (iris ~ pupil) */
  dark?: boolean;
}

const WHITE_EYE = hex('#f2efe6');
const SHINE = hex('#ffffff');
const PUPIL = hex('#0c0a0e');

/** Draw an eye centred at (x, y) (local coords) in the given state as overlay pixels. Returns the eye centre. */
export function drawEye(sk: Sk, x: number, y: number, e: EyeSpec, st: BeastEye): V2 {
  const pupil = e.pupil ?? PUPIL, white = e.white ?? WHITE_EYE, shine = e.shine ?? SHINE;
  const cx = Math.floor(x), cy = Math.floor(y);
  const o = (dx: number, dy: number, c: C) => sk.over(cx + dx, cy + dy, c);
  if (e.r <= 0.75) {
    // 1px eyes
    if (st === 'closed') { o(0, 0, e.lash); o(-1, 0, e.lash); return [cx + 0.5, cy + 0.5]; }
    if (st === 'scared') { o(0, 0, pupil); o(-1, 0, white); o(1, 0, white); o(0, -1, white); return [cx + 0.5, cy + 0.5]; }
    if (st === 'alert') { o(0, 0, pupil); o(0, -1, shine); return [cx + 0.5, cy]; }
    o(0, 0, e.dark ? pupil : e.iris);
    if (st === 'angry') { o(-1, -1, e.lash); o(0, -1, e.lash); o(1, -1, e.lash); o(1, 0, e.lash); }
    if (e.brow && st !== 'angry') { o(0, -1, e.brow); o(1, -1, e.brow); }
    return [cx + 0.5, cy + 0.5];
  }
  if (e.r <= 1.25) {
    // 2x2 eyes: cells (0,0) (1,0) (0,1) (1,1) with top-left at (cx, cy)
    const X = Math.floor(x - 0.5), Y = Math.floor(y - 0.5);
    const q = (dx: number, dy: number, c: C) => sk.over(X + dx, Y + dy, c);
    if (st === 'closed') { q(-1, 1, e.lash); q(0, 1, e.lash); q(1, 1, e.lash); q(2, 0, e.lash); return [X + 1, Y + 1]; }
    if (st === 'scared') {
      for (const [dx, dy] of [[0, -1], [1, -1], [-1, 0], [2, 0], [-1, 1], [2, 1], [0, 2], [1, 2]] as V2[]) q(dx, dy, white);
      q(0, 0, e.dark ? pupil : e.iris); q(1, 0, pupil); q(0, 1, pupil); q(1, 1, e.dark ? pupil : e.iris);
      return [X + 1, Y + 1];
    }
    if (st === 'alert') {
      q(0, -1, e.dark ? pupil : e.iris); q(1, -1, e.dark ? pupil : e.iris);
      q(0, 0, e.iris); q(1, 0, pupil); q(0, 1, e.iris); q(1, 1, e.iris);
      q(0, -1, shine);
      return [X + 1, Y + 0.5];
    }
    if (st === 'angry') {
      q(0, 1, e.dark ? pupil : e.iris); q(1, 1, pupil);
      q(-1, -1, e.lash); q(0, 0, e.lash); q(1, 0, e.lash); q(2, 0, e.lash); q(2, 1, e.lash);
      return [X + 1, Y + 1.5];
    }
    if (e.dark) {
      q(0, 0, shine); q(1, 0, pupil); q(0, 1, pupil); q(1, 1, pupil);
    } else {
      // light iris: three iris pixels round a front-low pupil
      q(0, 0, e.iris); q(1, 0, e.iris); q(0, 1, e.iris); q(1, 1, pupil);
    }
    if (e.brow) { q(0, -1, e.brow); q(1, -1, e.brow); q(2, -1, e.brow); }
    return [X + 1, Y + 1];
  }
  // round eyes, r >= 1.5
  const big = st === 'alert' || st === 'scared';
  const r = e.r + (big ? 0.5 : 0);
  const ringR = e.ring ? r + 1 : r;
  const pr = st === 'alert' ? Math.max(0.6, r * 0.3) : st === 'scared' ? Math.max(0.7, r * 0.35) : e.dark ? r * 0.8 : r * 0.55;
  const ir = st === 'scared' ? Math.max(1, r * 0.62) : r;
  // lid line for angry: pixels above it are skipped (fur shows) and the edge is drawn dark
  const lidAt = (px: number) => y - r * 0.15 + (px - x) * 0.45;
  const x0 = Math.floor(x - ringR - 1), x1 = Math.ceil(x + ringR + 1), y0 = Math.floor(y - ringR - 1), y1 = Math.ceil(y + ringR + 1);
  if (st === 'closed') {
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x;
      if (Math.abs(dx) > r + 0.3) continue;
      const yy = y + 0.2 + Math.sqrt(Math.max(0, r * r - dx * dx)) * 0.35;
      sk.over(px, Math.floor(yy), e.lash);
    }
    return [x, y];
  }
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y;
      const d = Math.hypot(dx, dy * (e.slit === 'h' ? 1.05 : 1));
      if (d > ringR) continue;
      if (st === 'angry' && py + 0.5 < lidAt(px + 0.5)) continue;
      let c: C;
      if (d > r) c = e.ring!;
      else if (st === 'scared' && d > ir) c = white;
      else {
        let inP: boolean;
        if (e.slit === 'v' && st !== 'scared') inP = Math.abs(dx) < Math.max(0.5, pr * 0.35) && Math.abs(dy) < r * 0.85;
        else if (e.slit === 'h' && st !== 'scared') inP = Math.abs(dy) < Math.max(0.5, pr * 0.4) && Math.abs(dx) < r * 0.8;
        else inP = d <= pr;
        c = inP ? pupil : e.iris;
        // darker upper iris (lid shadow)
        if (!inP && dy < -r * 0.45) c = lmixCache(e.iris, pupil, 0.35);
      }
      sk.over(px, py, c);
    }
  if (st === 'angry') {
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x;
      if (Math.abs(dx) > ringR + 0.6) continue;
      sk.over(px, Math.floor(lidAt(px + 0.5)) - 0, e.lash);
      sk.over(px, Math.floor(lidAt(px + 0.5)) - 1, e.lash);
    }
  } else if (e.brow) {
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x;
      if (Math.abs(dx) > ringR + 0.5 || dx < -ringR * 0.7) continue;
      sk.over(px, Math.floor(y - ringR - 0.2 + dx * 0.25), e.brow);
    }
  }
  // highlight up-left of the pupil
  if (st !== 'angry' || r >= 2) {
    const hx = Math.floor(x - Math.max(1, r * 0.4)), hy = Math.floor(y - Math.max(1, r * 0.45));
    sk.over(hx, hy, shine);
    if (r >= 3) sk.over(hx + 1, hy, shine);
  }
  return [x, y];
}
const lmc = new Map<string, C>();
function lmixCache(a: C, b: C, t: number) {
  const k = a + ':' + b + ':' + t;
  let c = lmc.get(k);
  if (c === undefined) { c = lmix(a, b, t); lmc.set(k, c); }
  return c;
}

// ------------------------------------------------------------------ species plumbing
export interface AnimDef { frames: number; fps: number; loop: boolean }
export interface DrawOut { head: V2; eye: V2 }
export interface Canvas { w: number; h: number; ox: number; oy: number }
export interface SpeciesDef {
  name: string;
  kind: 'mammal' | 'bird' | 'amphibian';
  len: number;
  height: number;
  anims: Record<string, AnimDef>;
  /** canvas for an anim: origin (ox, oy) is the anchor */
  canvas(anim: string, juvenile: boolean): Canvas;
  draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juvenile: boolean): DrawOut;
  eyeFor?(anim: string, frame: number): BeastEye;
  /** anims whose anchor is the body centre / grip rather than the ground */
  anchor?: Record<string, 'ground' | 'centre' | 'grip'>;
}

/** Deterministic hash helper for species code. */
export const hh = (a: number, b: number, s = 0) => hash2(Math.floor(a), Math.floor(b), s);

// ------------------------------------------------------------------ 3D helpers (wings, membranes)
/** Camera elevation used for spread wings / membranes: we look slightly down on them. */
export const CAM_PHI = 0.5;
const CPH = Math.cos(CAM_PHI), SPH = Math.sin(CAM_PHI);
/** Project a body-space 3D point (x fwd, y up, z toward viewer) to screen offset [x, y] and depth. */
export function proj(p: V3, phi?: number): V3 {
  if (phi !== undefined) {
    const c = Math.cos(phi), s = Math.sin(phi);
    return [p[0], -(p[1] * c - p[2] * s), p[2] * c + p[1] * s];
  }
  return [p[0], -(p[1] * CPH - p[2] * SPH), p[2] * CPH + p[1] * SPH];
}
/** Screen-space normal (y down, z to viewer) of a body-space normal. */
export function projN(n: V3): V3 {
  return [n[0], -(n[1] * CPH - n[2] * SPH), n[2] * CPH + n[1] * SPH];
}
export const v3add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const v3sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const v3mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const v3lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const v3cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const v3norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const v3dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Fill a planar 3D triangle fan / polygon given in body space (projected with the camera tilt),
 * with depth interpolated from the plane and shading from its normal (flipped toward the viewer).
 * fill gets p.u, p.v = barycentric-ish coords over the polygon's first edge (u along p0->p1, v along p0->p(last)).
 */
export function poly3(sk: Sk, ox: number, oy: number, pts: V3[], fill: Fill, o: { bias?: number; zb?: number; back?: Fill; phi?: number } = {}) {
  if (pts.length < 3) return;
  const sp = pts.map(q => proj(q, o.phi));
  // plane normal in screen space
  const a = sp[0], b = sp[1], c = sp[sp.length - 1];
  let n = v3norm(v3cross(v3sub(b, a), v3sub(c, a)));
  let back = false;
  if (n[2] < 0) { n = [-n[0], -n[1], -n[2]]; back = true; }
  // depth plane: z = a.z + gx*(x - a.x) + gy*(y - a.y)
  const nz = Math.abs(n[2]) < 1e-3 ? 1e-3 : n[2];
  const gx = -n[0] / nz, gy = -n[1] / nz;
  const flat: number[] = [];
  for (const q of sp) flat.push(q[0] + ox, q[1] + oy);
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - a[0], e2y = c[1] - a[1];
  const det = e1x * e2y - e1y * e2x || 1e-6;
  const zb = o.zb ?? 0;
  const f = back && o.back !== undefined ? o.back : fill;
  sk.poly(flat, typeof f === 'number' ? f : (p) => {
    const rx = p.x - ox - a[0], ry = p.y - oy - a[1];
    p.u = (rx * e2y - ry * e2x) / det;
    p.v = (e1x * ry - e1y * rx) / det;
    return f(p);
  }, { n, bias: o.bias, z: (x, y) => a[2] + gx * (x - ox - a[0]) + gy * (y - oy - a[1]) + zb });
  return back;
}

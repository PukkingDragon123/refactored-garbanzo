// A 2.5D height field for sculpting beasts from drawn contours, on top of the sketch core (beasts-core Sk).
//
// Nothing is built from visible primitives. Every part starts as ONE continuous outline: a smooth
// spline through hand-placed anatomical landmarks (or a ribbon: a spine with a hand-shaped width
// profile, its two edges joined into one closed contour with the spines, teeth and notches drawn in).
// inflate() fills that contour and raises it into a form from the distance to its edge (a rounded
// shoulder of radius r rising to a crown), so the silhouette is exactly the drawn line and the interior
// reads as mass. Anatomy is then sculpted in: landmark bumps (muscle, bone, tubercles), grooves (creases,
// pleats, sutures, the mouth line), and per-region texture as displacement (scales, granules, pits,
// barnacles), so every bump shades itself when emit() lights the field from its own finite-difference
// normals, with cavity occlusion, cast shadows from the key light, a wet specular and seam lines where
// one part passes in front of another, and writes it into the sketch (which gives the palette ramps and
// the outline). Used by the sea beasts, the longfin eel, the robber crab and the lantern gecko.

import { Sk, lumN } from './beasts-core';
import type { V2 } from './beasts-core';
import { hash2, noise2 } from '../core/math';

export const EMPTY = -1e9;
export const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const sstep = (a: number, b: number, v: number) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** smooth max: an organic fillet of width k where two surfaces meet */
export function smax(a: number, b: number, k: number) {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Catmull-Rom through [x, y] keys (x ascending), clamped at the ends: a profile curve. */
export function crv(keys: readonly (readonly [number, number])[], x: number): number {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 1;
  while (keys[i][0] < x) i++;
  const p1 = keys[i - 1], p2 = keys[i], p0 = keys[Math.max(0, i - 2)], p3 = keys[Math.min(n - 1, i + 1)];
  const dx = p2[0] - p1[0], t = (x - p1[0]) / dx;
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * dx, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * dx;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

/** A smooth curve through landmarks (centripetal-ish Catmull-Rom), sampled `n` points per span. */
export function spline(pts: V2[], n = 6, closed = false): V2[] {
  const m = pts.length;
  if (m < 3) return pts.slice();
  const out: V2[] = [];
  const P = (i: number) => (closed ? pts[((i % m) + m) % m] : pts[Math.max(0, Math.min(m - 1, i))]);
  const spans = closed ? m : m - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[m - 1]);
  return out;
}

/** cumulative arc lengths of a polyline */
export function arcs(pts: V2[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return c;
}
/** point, unit tangent and left normal (screen: tangent rotated -90deg) at t (0..1) along a polyline */
export function along(pts: V2[], t: number, cum = arcs(pts)): { p: V2; d: V2; n: V2 } {
  const L = cum[cum.length - 1], s = cl(t) * L;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], seg = Math.max(1e-6, cum[i] - cum[i - 1]), k = cl((s - cum[i - 1]) / seg);
  const dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], d: [dx, dy], n: [dy, -dx] };
}

/**
 * A ribbon: one closed contour round a spine, with the half-width on each side drawn by profiles
 * left(t) and right(t) ("left" = the side the tangent turned -90deg points at: the top for a spine
 * running left to right). Optional rounded caps at the ends. Returns the contour (left edge forward,
 * right edge back).
 */
export function ribbon(spine: V2[], left: (t: number) => number, right: (t: number) => number, samples = 0, cap0 = 0, cap1 = 0): V2[] {
  const cum = arcs(spine), L = cum[cum.length - 1];
  const N = samples || Math.max(8, Math.ceil(L * 1.5));
  const A: V2[] = [], B: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, q = along(spine, t, cum);
    const l = left(t), r = right(t);
    A.push([q.p[0] + q.n[0] * l, q.p[1] + q.n[1] * l]);
    B.push([q.p[0] - q.n[0] * r, q.p[1] - q.n[1] * r]);
  }
  const out: V2[] = [];
  if (cap0 > 0) {
    const q = along(spine, 0, cum), l = left(0), r = right(0);
    const c: V2 = [q.p[0] + q.n[0] * (l - r) / 2, q.p[1] + q.n[1] * (l - r) / 2], rad = (l + r) / 2;
    for (let k = 1; k < 6; k++) { const a = Math.PI * (k / 6); const ca = Math.cos(a), sa = Math.sin(a); out.push([c[0] - q.n[0] * rad * ca - q.d[0] * rad * sa * cap0, c[1] - q.n[1] * rad * ca - q.d[1] * rad * sa * cap0]); }
  }
  out.push(...A);
  if (cap1 > 0) {
    const q = along(spine, 1, cum), l = left(1), r = right(1);
    const c: V2 = [q.p[0] + q.n[0] * (l - r) / 2, q.p[1] + q.n[1] * (l - r) / 2], rad = (l + r) / 2;
    for (let k = 1; k < 6; k++) { const a = Math.PI * (k / 6); const ca = Math.cos(a), sa = Math.sin(a); out.push([c[0] + q.n[0] * rad * ca + q.d[0] * rad * sa * cap1, c[1] + q.n[1] * rad * ca + q.d[1] * rad * sa * cap1]); }
  }
  for (let i = B.length - 1; i >= 0; i--) out.push(B[i]);
  return out;
}

/** Cellular (Worley) noise. cell() fills CELL: F1, F2 (cell units), the nearest feature point and its hash. */
export const CELL = { F1: 0, F2: 0, x: 0, y: 0, h: 0 };
export function cell(x: number, y: number, sx: number, sy: number, seed: number, jit = 0.8) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let F1 = 9, F2 = 9, CX = 0, CY = 0, CI = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.5 + (hash2(cx, cy, seed) - 0.5) * jit) * sx;
      const py = (cy + 0.5 + (hash2(cx, cy, seed + 1) - 0.5) * jit) * sy;
      const dx = (x - px) / sx, dy = (y - py) / sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < F1) { F2 = F1; F1 = d; CX = px; CY = py; CI = hash2(cx, cy, seed + 2); } else if (d < F2) F2 = d;
    }
  CELL.F1 = F1; CELL.F2 = F2; CELL.x = CX; CELL.y = CY; CELL.h = CI;
  return CELL;
}
/** a domed scale / granule from the last cell(): 0 in the groove between cells, 1 on the crown */
export const scaleH = (k = 2.6) => Math.pow(cl((CELL.F2 - CELL.F1) * k), 0.65);
/** fractal value noise (0..1) */
export function fbm(x: number, y: number, seed: number, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise2(x * f, y * f, seed + i * 31) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
/** distance from p to the segment ab */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const sx = bx - ax, sy = by - ay, L2 = sx * sx + sy * sy;
  let k = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return Math.hypot(px - ax - sx * k, py - ay - sy * k);
}
/** distance from p to a polyline, and the arc parameter (0..1) of the nearest point */
export function lineDist(pts: V2[], px: number, py: number, cum?: number[]): [number, number] {
  const c = cum ?? arcs(pts), L = c[c.length - 1] || 1;
  let best = Infinity, bt = 0;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0], ay = pts[i - 1][1], sx = pts[i][0] - ax, sy = pts[i][1] - ay, L2 = sx * sx + sy * sy;
    let k = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const d = Math.hypot(px - ax - sx * k, py - ay - sy * k);
    if (d < best) { best = d; bt = (c[i - 1] + (c[i] - c[i - 1]) * k) / L; }
  }
  return [best, bt];
}

/** what a texture callback writes: a displacement (px toward the viewer), a material, a lighting offset */
export interface Tx { z: number; m: number; t: number }

export interface EmitOpt {
  bias?: number;
  /** depth fall-off assumed past the silhouette (rounds the edges) */
  drop?: number;
  /** a seam line where one element passes in front of another by more than this */
  seam?: number;
  seamDark?: number;
  /** lighting contrast around mid */
  contrast?: number;
  /** cavity occlusion: strength and radius */
  ao?: number;
  aoR?: number;
  /** cast shadows from the key light: strength and reach (px) */
  shadow?: number;
  shadowR?: number;
  /** wet specular strength per material id (0: none) and its tightness */
  spec?: (m: number) => number;
  specPow?: number;
  /** a final per-pixel lighting tweak */
  post?: (x: number, y: number, m: number, l: number, nx: number, ny: number, nz: number) => number;
}

// half vector of the key light and the viewer, for the wet highlights
const HX = -0.309, HY = -0.439, HZ = 0.843;

export class HField {
  readonly X0: number; readonly Y0: number; readonly w: number; readonly h: number;
  readonly z: Float32Array; readonly m: Uint8Array; readonly t: Float32Array; readonly id: Uint8Array;
  constructor(readonly sk: Sk, lx0: number, ly0: number, lx1: number, ly1: number) {
    this.X0 = Math.max(0, Math.floor(lx0 + sk.ox) - 1);
    this.Y0 = Math.max(0, Math.floor(ly0 + sk.oy) - 1);
    const X1 = Math.min(sk.w - 1, Math.ceil(lx1 + sk.ox) + 1), Y1 = Math.min(sk.h - 1, Math.ceil(ly1 + sk.oy) + 1);
    this.w = Math.max(0, X1 - this.X0 + 1); this.h = Math.max(0, Y1 - this.Y0 + 1);
    const n = this.w * this.h;
    this.z = new Float32Array(n).fill(EMPTY); this.m = new Uint8Array(n); this.t = new Float32Array(n); this.id = new Uint8Array(n);
  }
  /** the whole canvas */
  static full(sk: Sk) { return new HField(sk, -sk.ox, -sk.oy, sk.w - sk.ox, sk.h - sk.oy); }
  lx(i: number) { return this.X0 + i - this.sk.ox + 0.5; }
  ly(j: number) { return this.Y0 + j - this.sk.oy + 0.5; }
  cols(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.ox) - this.X0), Math.min(this.w - 1, Math.ceil(b + this.sk.ox) - this.X0)]; }
  rows(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.oy) - this.Y0), Math.min(this.h - 1, Math.ceil(b + this.sk.oy) - this.Y0)]; }
  /** index of local point, or -1 */
  at(x: number, y: number) {
    const i = Math.floor(x + this.sk.ox) - this.X0, j = Math.floor(y + this.sk.oy) - this.Y0;
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }
  put(k: number, z: number, m: number, t: number, id: number, blend: number) {
    const o = this.z[k];
    if (o === EMPTY) { this.z[k] = z; this.m[k] = m; this.t[k] = t; this.id[k] = id; return; }
    if (z > o) { this.m[k] = m; this.t[k] = t; this.id[k] = id; }
    this.z[k] = blend > 0 ? smax(o, z, blend) : Math.max(o, z);
  }

  /**
   * Fill a closed contour and raise it into a form: the height rises from the outline over a rounded
   * shoulder of radius r (a quarter circle, scaled by rz) and stays level beyond it, so a narrow part is
   * round in section and a broad one a domed slab. z0 is the depth of the outline. tex gets the
   * pixel, its distance in from the edge d and the shoulder profile s (0 at the edge .. 1 inside) and
   * may displace, recolour and relight it (o.m = 0 leaves the pixel out). Returns the mask's pixel count.
   */
  inflate(poly: V2[], r: number, z0: number | ((x: number, y: number) => number), id: number, blend: number,
    tex: (x: number, y: number, d: number, s: number, o: Tx) => void, rz = 1) {
    if (poly.length < 3) return 0;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const [i0, i1] = this.cols(x0, x1), [j0, j1] = this.rows(y0, y1);
    const bw = i1 - i0 + 1, bh = j1 - j0 + 1;
    if (bw <= 0 || bh <= 0) return 0;
    // the mask (even-odd scanline fill at pixel centres)
    const inside = new Uint8Array(bw * bh);
    const xs: number[] = [];
    let count = 0;
    for (let j = 0; j < bh; j++) {
      const sy = this.ly(j + j0);
      xs.length = 0;
      for (let a = 0; a < poly.length; a++) {
        const p = poly[a], q = poly[(a + 1) % poly.length];
        if ((p[1] <= sy && q[1] > sy) || (q[1] <= sy && p[1] > sy)) xs.push(p[0] + ((sy - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let i = 0; i < bw; i++) {
          const sx = this.lx(i + i0);
          if (sx >= xs[k] && sx < xs[k + 1] && !inside[j * bw + i]) { inside[j * bw + i] = 1; count++; }
        }
    }
    if (!count) return 0;
    // distance to the outline, capped at r: each edge only touches the pixels within r of it
    const dist = new Float32Array(bw * bh).fill(r);
    for (let a = 0; a < poly.length; a++) {
      const p = poly[a], q = poly[(a + 1) % poly.length];
      const [ia, ib] = this.cols(Math.min(p[0], q[0]) - r, Math.max(p[0], q[0]) + r);
      const [ja, jb] = this.rows(Math.min(p[1], q[1]) - r, Math.max(p[1], q[1]) + r);
      for (let j = Math.max(ja, j0); j <= Math.min(jb, j1); j++) {
        const sy = this.ly(j);
        for (let i = Math.max(ia, i0); i <= Math.min(ib, i1); i++) {
          const k = (j - j0) * bw + (i - i0);
          if (!inside[k]) continue;
          const d = segDist(this.lx(i), sy, p[0], p[1], q[0], q[1]);
          if (d < dist[k]) dist[k] = d;
        }
      }
    }
    const zf = typeof z0 === 'number' ? null : z0;
    const o: Tx = { z: 0, m: 0, t: 0 };
    for (let j = 0; j < bh; j++)
      for (let i = 0; i < bw; i++) {
        const k = j * bw + i;
        if (!inside[k]) continue;
        const x = this.lx(i + i0), y = this.ly(j + j0);
        const d = dist[k] + 0.35, u = cl(d / r);
        const s = Math.sqrt(1 - (1 - u) * (1 - u));
        o.z = 0; o.m = 0; o.t = 0;
        tex(x, y, d, s, o);
        if (!o.m) continue;
        const base = zf ? zf(x, y) : (z0 as number);
        this.put((j + j0) * this.w + i + i0, base + s * r * rz + o.z, o.m, o.t, id, blend);
      }
    return count;
  }

  /**
   * Fill a closed contour with a surface of your own: f gets each pixel inside and writes o.z as the
   * absolute depth of the surface there (plus o.m, o.t; o.m = 0 leaves the pixel out).
   */
  fill(poly: V2[], id: number, blend: number, f: (x: number, y: number, o: Tx) => void) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const [j0, j1] = this.rows(y0, y1);
    const o: Tx = { z: 0, m: 0, t: 0 };
    const xs: number[] = [];
    for (let j = j0; j <= j1; j++) {
      const sy = this.ly(j);
      xs.length = 0;
      for (let a = 0; a < poly.length; a++) {
        const p = poly[a], q = poly[(a + 1) % poly.length];
        if ((p[1] <= sy && q[1] > sy) || (q[1] <= sy && p[1] > sy)) xs.push(p[0] + ((sy - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const [i0, i1] = this.cols(xs[k], xs[k + 1]);
        for (let i = i0; i <= i1; i++) {
          const x = this.lx(i);
          if (x < xs[k] || x >= xs[k + 1]) continue;
          o.z = 0; o.m = 0; o.t = 0;
          f(x, sy, o);
          if (!o.m) continue;
          this.put(j * this.w + i, o.z, o.m, o.t, id, blend);
        }
      }
    }
  }

  /** raise (or with h < 0 sink) a smooth dome into what is already there; optionally repaint it */
  bump(cx: number, cy: number, r: number, h: number, m = 0, dt = 0, ry = r, only = -1) {
    const [i0, i1] = this.cols(cx - r - 1, cx + r + 1), [j0, j1] = this.rows(cy - ry - 1, cy + ry + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.w + i;
      if (this.z[k] === EMPTY || (only >= 0 && this.id[k] !== only)) continue;
      const dx = (this.lx(i) - cx) / r, dy = (this.ly(j) - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const f = (1 - d2) * (1 - d2);
      this.z[k] += h * f;
      if (m && f > 0.25) this.m[k] = m;
      this.t[k] += dt * f;
    }
  }
  /** carve (depth > 0) or raise (depth < 0) a crease of half-width w along a polyline */
  groove(pts: V2[], w: number, depth: number, m = 0, dt = 0, only = -1, taper?: (t: number) => number) {
    if (pts.length < 2) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const [i0, i1] = this.cols(x0 - w - 1, x1 + w + 1), [j0, j1] = this.rows(y0 - w - 1, y1 + w + 1);
    const cum = arcs(pts);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.w + i;
      if (this.z[k] === EMPTY || (only >= 0 && this.id[k] !== only)) continue;
      const [d, t] = lineDist(pts, this.lx(i), this.ly(j), cum);
      if (d >= w) continue;
      const f = (1 - (d / w) * (d / w)) * (taper ? taper(t) : 1);
      this.z[k] -= depth * f;
      if (m && f > 0.45) this.m[k] = m;
      this.t[k] += dt * f;
    }
  }
  /** shift the lighting (and optionally the material) of a pixel already in the field */
  tint(x: number, y: number, dt: number, m = 0) {
    const k = this.at(x, y);
    if (k < 0 || this.z[k] === EMPTY) return;
    this.t[k] += dt;
    if (m) this.m[k] = m;
  }
  has(x: number, y: number) { const k = this.at(x, y); return k >= 0 && this.z[k] !== EMPTY; }
  mAt(x: number, y: number) { const k = this.at(x, y); return k >= 0 && this.z[k] !== EMPTY ? this.m[k] : 0; }
  zAt(x: number, y: number) { const k = this.at(x, y); return k >= 0 ? this.z[k] : EMPTY; }
  idAt(x: number, y: number) { const k = this.at(x, y); return k >= 0 && this.z[k] !== EMPTY ? this.id[k] : -1; }

  /** light the field from its own normals and write it into the sketch (as the current part) */
  emit(o: EmitOpt = {}) {
    const { w, h, z, m, t, id, sk } = this;
    const bias = o.bias ?? 0, drop = o.drop ?? 2.4, seam = o.seam ?? 1.4, seamDark = o.seamDark ?? 0.3, contrast = o.contrast ?? 1;
    const ao = o.ao ?? 0, aoR = o.aoR ?? 3, specPow = o.specPow ?? 18, sh = o.shadow ?? 0, shR = o.shadowR ?? 12;
    let cav: Float32Array | null = null;
    if (ao > 0) {
      const n = w * h, sz = new Float32Array(n), sc = new Float32Array(n), tz = new Float32Array(n), tc = new Float32Array(n);
      for (let j = 0; j < h; j++) {
        let az = 0, ac = 0;
        for (let i = -aoR; i < w + aoR; i++) {
          const a = i + aoR, b = i - aoR - 1;
          if (a < w && a >= 0) { const v = z[j * w + a]; if (v !== EMPTY) { az += v; ac++; } }
          if (b >= 0 && b < w) { const v = z[j * w + b]; if (v !== EMPTY) { az -= v; ac--; } }
          if (i >= 0 && i < w) { tz[j * w + i] = az; tc[j * w + i] = ac; }
        }
      }
      for (let i = 0; i < w; i++) {
        let az = 0, ac = 0;
        for (let j = -aoR; j < h + aoR; j++) {
          const a = j + aoR, b = j - aoR - 1;
          if (a < h && a >= 0) { az += tz[a * w + i]; ac += tc[a * w + i]; }
          if (b >= 0 && b < h) { az -= tz[b * w + i]; ac -= tc[b * w + i]; }
          if (j >= 0 && j < h) { sz[j * w + i] = az; sc[j * w + i] = ac; }
        }
      }
      cav = new Float32Array(n);
      for (let k = 0; k < n; k++) if (z[k] !== EMPTY && sc[k] > 0) cav[k] = Math.max(0, sz[k] / sc[k] - z[k]);
    }
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i, zc = z[k];
        if (zc === EMPTY) continue;
        const zl = i > 0 && z[k - 1] !== EMPTY ? z[k - 1] : zc - drop;
        const zr = i < w - 1 && z[k + 1] !== EMPTY ? z[k + 1] : zc - drop;
        const zu = j > 0 && z[k - w] !== EMPTY ? z[k - w] : zc - drop;
        const zd = j < h - 1 && z[k + w] !== EMPTY ? z[k + w] : zc - drop;
        let nx = -(zr - zl) * 0.5, ny = -(zd - zu) * 0.5, nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        let l = 0.5 + (lumN(nx, ny, nz) - 0.5) * contrast + t[k] + bias;
        if (cav) l -= Math.min(0.3, cav[k] * ao);
        if (sh > 0) {
          // march toward the light (up-left, rising 0.46 px of depth per px)
          for (let s = 1.1; s <= shR; s += 1.1) {
            const ii = Math.round(i - 0.575 * s), jj = Math.round(j - 0.818 * s);
            if (ii < 0 || jj < 0 || ii >= w || jj >= h) break;
            const zz = z[jj * w + ii];
            if (zz !== EMPTY && zz > zc + 0.465 * s + 0.6) { l -= sh; break; }
          }
        }
        if (o.spec) {
          const sp = o.spec(m[k]);
          if (sp > 0) l += sp * Math.pow(Math.max(0, nx * HX + ny * HY + nz * HZ), specPow);
        }
        const me = id[k];
        if ((i > 0 && id[k - 1] !== me && z[k - 1] - zc > seam) || (i < w - 1 && id[k + 1] !== me && z[k + 1] - zc > seam) ||
          (j > 0 && id[k - w] !== me && z[k - w] - zc > seam) || (j < h - 1 && id[k + w] !== me && z[k + w] - zc > seam)) l -= seamDark;
        const x = this.lx(i), y = this.ly(j);
        if (o.post) l = o.post(x, y, m[k], l, nx, ny, nz);
        sk.dot(x, y, m[k], l, zc);
      }
  }
}

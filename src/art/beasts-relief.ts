// Relief: a 2.5D sculpting layer for the beast sketch core (beasts-core.ts).
//
// The plain Sk primitives (ell, tube, blade) shade each mass from its own analytic normal, so bodies
// built from them read as smooth balloons pushed together. A Relief is a height field over part of
// the canvas instead: masses (ellipsoids, capsules with muscle profiles, swept tubes) are merged into it
// with a smooth max, so they fuse with organic fillets; bone and muscle bumps, folds, grooves and
// per-region texture (cell scales, wrinkles, fur strands, feather rows) are added as displacement; and
// emit() lights every pixel from the field's own finite-difference normals, darkens cavities, draws a
// seam where one element passes over another, and writes the result into the sketch (material, light,
// depth). Everything a texture does to the height therefore shades itself: a wrinkle has a lit lip
// and a dark trough, a scale is lit on its top-left and shadowed under, a strand of fur catches light.
//
// Coordinates are the sketch's local coords (origin at the anchor, y down). Heights are in px toward
// the viewer, the same units as the sketch depth, so a Relief and plain primitives z-sort together.

import { Sk, V2, lumN } from './beasts-core';
import { hash2, noise2 } from '../core/math';

/** What a texture writes: added height (scaled by the facing w), material id, light offset. */
export interface Tx { z: number; m: number; t: number }
/**
 * What a texture sees at a pixel: local x, y; along s (px) and across c (px, signed) for capsules and
 * tubes; t 0..1 along; w 0..1 facing (1 at the crown, 0 at the silhouette); u, v the ellipse coords.
 */
export interface Sp { x: number; y: number; s: number; c: number; t: number; w: number; u: number; v: number }
export type Tex = (p: Sp, o: Tx) => void;

const EMPTY = -1e9;
const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** polynomial smooth max */
export const smax = (a: number, b: number, k: number) => {
  if (k <= 0) return Math.max(a, b);
  const h = cl(0.5 + (0.5 * (a - b)) / k);
  return b + (a - b) * h + k * h * (1 - h);
};

const SP: Sp = { x: 0, y: 0, s: 0, c: 0, t: 0, w: 1, u: 0, v: 0 };
const TX: Tx = { z: 0, m: 0, t: 0 };

export interface MassOpt {
  /** base depth and depth radius (bulge toward the viewer = rz * facing) */
  z?: number; rz?: number;
  /** element id (seams are drawn where ids differ and the step is steep) and smooth-merge width */
  id?: number; blend?: number;
  tex: Tex | number;
  /** extra lighting offset */
  lt?: number;
  /** cross-section exponent: 1 round, < 1 flatter crown with a steeper edge */
  pow?: number;
}

export class Relief {
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
  /** a relief covering the whole canvas */
  static full(sk: Sk) { return new Relief(sk, -sk.ox, -sk.oy, sk.w - sk.ox, sk.h - sk.oy); }
  lx(i: number) { return this.X0 + i - this.sk.ox + 0.5; }
  ly(j: number) { return this.Y0 + j - this.sk.oy + 0.5; }
  cols(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.ox) - this.X0), Math.min(this.w - 1, Math.ceil(b + this.sk.ox) - this.X0)]; }
  rows(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.oy) - this.Y0), Math.min(this.h - 1, Math.ceil(b + this.sk.oy) - this.Y0)]; }
  /** index of the pixel under local (x, y), or -1 */
  at(x: number, y: number) {
    const i = Math.floor(x + this.sk.ox) - this.X0, j = Math.floor(y + this.sk.oy) - this.Y0;
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }
  filled(x: number, y: number) { const k = this.at(x, y); return k >= 0 && this.z[k] !== EMPTY; }

  put(k: number, z: number, m: number, t: number, id: number, blend: number) {
    if (m <= 0) return;
    const o = this.z[k];
    if (o === EMPTY) { this.z[k] = z; this.m[k] = m; this.t[k] = t; this.id[k] = id; return; }
    if (z > o) { this.m[k] = m; this.t[k] = t; this.id[k] = id; }
    this.z[k] = blend > 0 ? smax(o, z, blend) : Math.max(o, z);
  }
  private shade(tex: Tex | number, p: Sp): Tx {
    TX.z = 0; TX.t = 0;
    if (typeof tex === 'number') { TX.m = tex; return TX; }
    TX.m = 0;
    tex(p, TX);
    return TX;
  }

  /** an ellipsoid mass (rot: screen angle of the rx axis) */
  ell(cx: number, cy: number, rx: number, ry: number, rot: number, o: MassOpt) {
    if (rx <= 0 || ry <= 0) return;
    const cs = Math.cos(rot), sn = Math.sin(rot), R = Math.max(rx, ry) + 1;
    const z0 = o.z ?? 0, rz = o.rz ?? Math.min(rx, ry), id = o.id ?? 1, blend = o.blend ?? 0, pw = o.pow ?? 1, lt = o.lt ?? 0;
    const [i0, i1] = this.cols(cx - R, cx + R), [j0, j1] = this.rows(cy - R, cy + R);
    for (let j = j0; j <= j1; j++) {
      const py = this.ly(j), dy = py - cy;
      for (let i = i0; i <= i1; i++) {
        const px = this.lx(i), dx = px - cx;
        const u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry;
        const d2 = u * u + v * v;
        if (d2 > 1) continue;
        let w = Math.sqrt(1 - d2);
        if (pw !== 1) w = Math.pow(w, pw);
        SP.x = px; SP.y = py; SP.u = u; SP.v = v; SP.s = u * rx; SP.c = v * ry; SP.t = (u + 1) / 2; SP.w = w;
        const q = this.shade(o.tex, SP);
        this.put(j * this.w + i, z0 + rz * w + q.z * w, q.m, q.t + lt, id, blend);
      }
    }
  }

  /**
   * A capsule from a (depth za) to b (depth zb), radius r0 -> r1 with an optional muscle bulge
   * (extra radius peaking at bAt along it), or a free radius profile prof(t) multiplied in.
   */
  cap(a: V2, b: V2, r0: number, r1: number, o: MassOpt & { za?: number; zb?: number; bulge?: number; bAt?: number; prof?: (t: number) => number }) {
    const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy, len = Math.sqrt(L2) || 1e-6;
    const bulge = o.bulge ?? 0, bAt = o.bAt ?? 0.4, za = o.za ?? o.z ?? 0, zb = o.zb ?? za, rzk = o.rz ?? 1;
    const id = o.id ?? 1, blend = o.blend ?? 0, lt = o.lt ?? 0, pw = o.pow ?? 1;
    let Rm = Math.max(r0, r1) + bulge;
    if (o.prof) for (let q = 0; q <= 8; q++) Rm = Math.max(Rm, (r0 + (r1 - r0) * (q / 8)) * o.prof(q / 8) + bulge);
    const R = Rm + 1;
    const [i0, i1] = this.cols(Math.min(a[0], b[0]) - R, Math.max(a[0], b[0]) + R);
    const [j0, j1] = this.rows(Math.min(a[1], b[1]) - R, Math.max(a[1], b[1]) + R);
    for (let j = j0; j <= j1; j++) {
      const py = this.ly(j);
      for (let i = i0; i <= i1; i++) {
        const px = this.lx(i);
        let k = L2 > 0 ? ((px - a[0]) * sx + (py - a[1]) * sy) / L2 : 0;
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        const qx = a[0] + sx * k, qy = a[1] + sy * k;
        const dx = px - qx, dy = py - qy, d = Math.sqrt(dx * dx + dy * dy);
        let r = r0 + (r1 - r0) * k;
        if (o.prof) r *= o.prof(k);
        if (bulge) { const e = k / bAt; r += bulge * (e < 1 ? Math.sin(e * Math.PI / 2) : Math.cos(Math.min(1, (k - bAt) / (1 - bAt)) * Math.PI / 2)) ** 1.4; }
        if (d > r) continue;
        let w = Math.sqrt(1 - (d / r) * (d / r));
        if (pw !== 1) w = Math.pow(w, pw);
        const side = sx * dy - sy * dx > 0 ? 1 : -1;
        SP.x = px; SP.y = py; SP.s = k * len; SP.c = side * d; SP.t = k; SP.w = w; SP.u = k; SP.v = (side * d) / r;
        const q = this.shade(o.tex, SP);
        this.put(j * this.w + i, za + (zb - za) * k + r * w * rzk + q.z * w, q.m, q.t + lt, id, blend);
      }
    }
  }

  /** a swept tube along a polyline with a radius profile r(t) and a depth z(t) */
  tube(pts: V2[], r: (t: number) => number, o: Omit<MassOpt, 'z'> & { z?: number | ((t: number) => number) }) {
    const n = pts.length;
    if (n < 2) return;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const total = cum[n - 1] || 1e-6;
    const zf = typeof o.z === 'function' ? o.z : ((zc: number) => () => zc)(o.z ?? 0);
    const rzk = o.rz ?? 1, id = o.id ?? 1, blend = o.blend ?? 0, lt = o.lt ?? 0, pw = o.pow ?? 1;
    let maxR = 0;
    for (let q = 0; q <= 12; q++) maxR = Math.max(maxR, r(q / 12));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of pts) { bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]); }
    const [i0, i1] = this.cols(bx0 - maxR - 1, bx1 + maxR + 1), [j0, j1] = this.rows(by0 - maxR - 1, by1 + maxR + 1);
    for (let j = j0; j <= j1; j++) {
      const py = this.ly(j);
      for (let i = i0; i <= i1; i++) {
        const px = this.lx(i);
        let best = Infinity, bt = 0, bqx = 0, bqy = 0, bsx = 1, bsy = 0;
        for (let s = 1; s < n; s++) {
          const ax = pts[s - 1][0], ay = pts[s - 1][1];
          const sx = pts[s][0] - ax, sy = pts[s][1] - ay;
          const L2 = sx * sx + sy * sy;
          let k = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
          const qx = ax + sx * k, qy = ay + sy * k;
          const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
          if (d2 < best) { best = d2; bt = (cum[s - 1] + (cum[s] - cum[s - 1]) * k) / total; bqx = qx; bqy = qy; bsx = sx; bsy = sy; }
        }
        const rr = r(bt);
        if (rr <= 0) continue;
        const d = Math.sqrt(best);
        if (d > rr) continue;
        let w = Math.sqrt(1 - (d / rr) * (d / rr));
        if (pw !== 1) w = Math.pow(w, pw);
        const side = bsx * (py - bqy) - bsy * (px - bqx) > 0 ? 1 : -1;
        SP.x = px; SP.y = py; SP.s = bt * total; SP.c = side * d; SP.t = bt; SP.w = w; SP.u = bt; SP.v = (side * d) / rr;
        const q = this.shade(o.tex, SP);
        this.put(j * this.w + i, zf(bt) + rr * w * rzk + q.z * w, q.m, q.t + lt, id, blend);
      }
    }
  }

  /**
   * A flat-ish polygon plate lying on the surface at depth z(x, y) (e.g. a scute, a shield): fills
   * pixels inside the polygon; tex gets u, v = 0..1 over its bounding box.
   */
  plate(poly: V2[], z: (x: number, y: number, edge: number) => number, o: Omit<MassOpt, 'z' | 'rz'>) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const [i0, i1] = this.cols(x0, x1), [j0, j1] = this.rows(y0, y1);
    const id = o.id ?? 1, blend = o.blend ?? 0, lt = o.lt ?? 0;
    const n = poly.length;
    for (let j = j0; j <= j1; j++) {
      const py = this.ly(j);
      for (let i = i0; i <= i1; i++) {
        const px = this.lx(i);
        let inside = false, ed = Infinity;
        for (let a = 0, b = n - 1; a < n; b = a++) {
          const ax = poly[a][0], ay = poly[a][1], bx = poly[b][0], by = poly[b][1];
          if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
          const sx = bx - ax, sy = by - ay, L2 = sx * sx + sy * sy || 1e-6;
          const k = cl(((px - ax) * sx + (py - ay) * sy) / L2);
          ed = Math.min(ed, Math.hypot(px - ax - sx * k, py - ay - sy * k));
        }
        if (!inside) continue;
        SP.x = px; SP.y = py; SP.u = (px - x0) / Math.max(1e-6, x1 - x0); SP.v = (py - y0) / Math.max(1e-6, y1 - y0); SP.s = ed; SP.c = 0; SP.t = 0; SP.w = Math.min(1, ed / 2);
        const q = this.shade(o.tex, SP);
        this.put(j * this.w + i, z(px, py, ed) + q.z, q.m, q.t + lt, id, blend);
      }
    }
  }

  /**
   * A region bounded by one closed contour (a dense polygon, e.g. from spline()): the shape mask of a
   * whole body, a limb or a plate. Its height is a pillow from the distance to the contour: rising
   * over R px from the edge (rounded, pow < 1 steeper / flatter-topped) to a plateau, on top of the
   * base depth z (or zAt(x, y)). The interior form then comes from bump() / line() and the texture.
   * tex gets s = distance to the edge (px), w = the pillow 0..1, u, v = 0..1 over the bounding box.
   */
  region(poly: V2[], o: Omit<MassOpt, 'z' | 'rz'> & { z?: number; zAt?: (x: number, y: number) => number; R: number; H?: number }) {
    const n = poly.length;
    if (n < 3) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const [i0, i1] = this.cols(x0, x1), [j0, j1] = this.rows(y0, y1);
    if (i1 < i0 || j1 < j0) return;
    const id = o.id ?? 1, blend = o.blend ?? 0, lt = o.lt ?? 0, pw = o.pow ?? 1, R = Math.max(0.5, o.R), Hh = o.H ?? R, z0 = o.z ?? 0;
    // 1. the mask over the bounding box (with a one pixel border of outside)
    const gw = i1 - i0 + 3, gh = j1 - j0 + 3, gn = gw * gh;
    const inside = new Uint8Array(gn);
    const xs: number[] = [];
    for (let j = j0; j <= j1; j++) {
      const py = this.ly(j);
      xs.length = 0;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const ay = poly[a][1], by = poly[b][1];
        if ((ay > py) !== (by > py)) xs.push(poly[a][0] + ((py - ay) / (by - ay)) * (poly[b][0] - poly[a][0]));
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let s = 0; s + 1 < xs.length; s += 2) {
        const ia = Math.max(i0, Math.ceil(xs[s] + this.sk.ox - 0.5) - this.X0), ib = Math.min(i1, Math.floor(xs[s + 1] + this.sk.ox - 0.5) - this.X0);
        for (let i = ia; i <= ib; i++) inside[(j - j0 + 1) * gw + (i - i0 + 1)] = 1;
      }
    }
    // 2. squared Euclidean distance to the nearest outside pixel (separable exact EDT)
    const INF = 1e9, D = new Float64Array(gn);
    for (let q = 0; q < gn; q++) D[q] = inside[q] ? INF : 0;
    const m = Math.max(gw, gh), f = new Float64Array(m), dd = new Float64Array(m), v = new Int32Array(m), zz = new Float64Array(m + 1);
    const edt1 = (len: number) => {
      let kq = 0; v[0] = 0; zz[0] = -INF; zz[1] = INF;
      for (let q = 1; q < len; q++) {
        let s2 = ((f[q] + q * q) - (f[v[kq]] + v[kq] * v[kq])) / (2 * q - 2 * v[kq]);
        while (s2 <= zz[kq]) { kq--; s2 = ((f[q] + q * q) - (f[v[kq]] + v[kq] * v[kq])) / (2 * q - 2 * v[kq]); }
        kq++; v[kq] = q; zz[kq] = s2; zz[kq + 1] = INF;
      }
      kq = 0;
      for (let q = 0; q < len; q++) { while (zz[kq + 1] < q) kq++; dd[q] = (q - v[kq]) * (q - v[kq]) + f[v[kq]]; }
    };
    for (let x = 0; x < gw; x++) { for (let y = 0; y < gh; y++) f[y] = D[y * gw + x]; edt1(gh); for (let y = 0; y < gh; y++) D[y * gw + x] = dd[y]; }
    for (let y = 0; y < gh; y++) { for (let x = 0; x < gw; x++) f[x] = D[y * gw + x]; edt1(gw); for (let x = 0; x < gw; x++) D[y * gw + x] = dd[x]; }
    // 3. near the contour: the exact distance to the polygon (segments bucketed in 4 px cells)
    const BS = 4, bw = Math.ceil(gw / BS) + 1, bh = Math.ceil(gh / BS) + 1, nb = bw * bh;
    const gx = (x: number) => x + this.sk.ox - this.X0 - i0 + 1, gy = (y: number) => y + this.sk.oy - this.Y0 - j0 + 1;
    // segments bucketed in a compressed table (count, prefix sum, fill)
    const cnt = new Int32Array(nb + 1), rng = new Int32Array(n * 4);
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const ax = gx(poly[b][0]), ay = gy(poly[b][1]), bx = gx(poly[a][0]), by = gy(poly[a][1]);
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - 4) / BS)), c1 = Math.min(bw - 1, Math.floor((Math.max(ax, bx) + 4) / BS));
      const r0 = Math.max(0, Math.floor((Math.min(ay, by) - 4) / BS)), r1 = Math.min(bh - 1, Math.floor((Math.max(ay, by) + 4) / BS));
      rng[a * 4] = c0; rng[a * 4 + 1] = c1; rng[a * 4 + 2] = r0; rng[a * 4 + 3] = r1;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cnt[r * bw + c + 1]++;
    }
    for (let q = 0; q < nb; q++) cnt[q + 1] += cnt[q];
    const fill = cnt.slice(0, nb), seg = new Int32Array(cnt[nb]);
    for (let a = 0; a < n; a++) for (let r = rng[a * 4 + 2]; r <= rng[a * 4 + 3]; r++) for (let c = rng[a * 4]; c <= rng[a * 4 + 1]; c++) seg[fill[r * bw + c]++] = a;
    const dist = new Float32Array(gn);
    for (let y = 1; y < gh - 1; y++)
      for (let x = 1; x < gw - 1; x++) {
        const q = y * gw + x;
        if (!inside[q]) continue;
        const de = Math.sqrt(D[q]) - 0.5;
        if (de > 3) { dist[q] = de; continue; }
        const px = this.lx(x - 1 + i0), py = this.ly(y - 1 + j0);
        let best = 16;
        const bq = Math.floor(y / BS) * bw + Math.floor(x / BS);
        for (let si = cnt[bq]; si < cnt[bq + 1]; si++) {
          const a = seg[si];
          const b = a === 0 ? n - 1 : a - 1;
          const ax = poly[b][0], ay = poly[b][1], ex = poly[a][0] - ax, ey = poly[a][1] - ay;
          const L2 = ex * ex + ey * ey;
          let kk = L2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / L2 : 0;
          kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
          const dx = px - ax - ex * kk, dy = py - ay - ey * kk, d2 = dx * dx + dy * dy;
          if (d2 < best) best = d2;
        }
        dist[q] = Math.min(de + 0.5, Math.sqrt(best));
      }
    // 4. soften the interior's pixel steps (medial ridges), then the pillow
    for (let y = 1; y < gh - 1; y++)
      for (let x = 1; x < gw - 1; x++) {
        const q = y * gw + x;
        if (!inside[q]) continue;
        let d = dist[q];
        if (d > 2.5) {
          let s2 = 0, c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const r = q + dy * gw + dx; if (inside[r]) { s2 += dist[r]; c++; } }
          d = s2 / c;
        }
        const i = x - 1 + i0, j = y - 1 + j0, px = this.lx(i), py = this.ly(j);
        const xr = Math.min(1, d / R);
        let w = Math.sqrt(1 - (1 - xr) * (1 - xr));
        if (pw !== 1) w = Math.pow(w, pw);
        SP.x = px; SP.y = py; SP.s = d; SP.c = 0; SP.t = xr; SP.w = w; SP.u = (px - x0) / Math.max(1e-6, x1 - x0); SP.v = (py - y0) / Math.max(1e-6, y1 - y0);
        const tq = this.shade(o.tex, SP);
        const zb = o.zAt ? o.zAt(px, py) : z0;
        this.put(j * this.w + i, zb + Hh * w + tq.z * Math.max(0.35, w), tq.m, tq.t + lt, id, blend);
      }
  }

  /**
   * A cast shadow: pixels (optionally only of element `onto`) lying under the element `from`, offset
   * (dx, dy) away from the light, darken by amt (soft over `soft` px).
   */
  shadow(from: number, dx: number, dy: number, amt: number, onto = 0, soft = 2) {
    const { w, h, z, id, t } = this;
    const mark = new Uint8Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (z[k] === EMPTY || id[k] === from || (onto && id[k] !== onto)) continue;
        for (let s = 1; s <= soft + 1; s++) {
          const si = Math.round(i - (dx * s) / (soft + 1)), sj = Math.round(j - (dy * s) / (soft + 1));
          if (si < 0 || sj < 0 || si >= w || sj >= h) continue;
          const q = sj * w + si;
          if (id[q] === from && z[q] > z[k] - 0.5) { mark[k] = Math.max(mark[k], soft + 2 - s); break; }
        }
      }
    for (let k = 0; k < w * h; k++) if (mark[k]) t[k] -= amt * (mark[k] / (soft + 1));
  }

  /** add a smooth bump (h > 0) or dent (h < 0) to the filled surface; `only` limits it to one element id */
  bump(cx: number, cy: number, rx: number, ry: number, h: number, rot = 0, only = 0) {
    const cs = Math.cos(rot), sn = Math.sin(rot), R = Math.max(rx, ry) + 1;
    const [i0, i1] = this.cols(cx - R, cx + R), [j0, j1] = this.rows(cy - R, cy + R);
    for (let j = j0; j <= j1; j++) {
      const dy = this.ly(j) - cy;
      for (let i = i0; i <= i1; i++) {
        const k = j * this.w + i;
        if (this.z[k] === EMPTY || (only && this.id[k] !== only)) continue;
        const dx = this.lx(i) - cx;
        const u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry, d2 = u * u + v * v;
        if (d2 >= 1) continue;
        const f = 1 - d2;
        this.z[k] += h * f * f;
      }
    }
  }

  /**
   * Add a profile along a polyline: within w px of it the height changes by h * prof(s), s = signed
   * distance / w (-1..1, + to the right of travel). The default profile is a rounded ridge (h > 0)
   * or groove (h < 0); `fold` gives a skin fold: a groove with a raised lip on the + side.
   */
  line(pts: V2[], w: number, h: number, o: { fold?: boolean; only?: number; t0?: number; t1?: number; taper?: boolean } = {}) {
    const n = pts.length;
    if (n < 2) return;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of pts) { bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]); }
    const [i0, i1] = this.cols(bx0 - w - 1, bx1 + w + 1), [j0, j1] = this.rows(by0 - w - 1, by1 + w + 1);
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const total = cum[n - 1] || 1e-6;
    for (let j = j0; j <= j1; j++) {
      const py = this.ly(j);
      for (let i = i0; i <= i1; i++) {
        const k = j * this.w + i;
        if (this.z[k] === EMPTY || (o.only && this.id[k] !== o.only)) continue;
        const px = this.lx(i);
        let best = Infinity, side = 1, bt = 0;
        for (let s = 1; s < n; s++) {
          const ax = pts[s - 1][0], ay = pts[s - 1][1], sx = pts[s][0] - ax, sy = pts[s][1] - ay;
          const L2 = sx * sx + sy * sy;
          let kk = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
          kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
          const qx = ax + sx * kk, qy = ay + sy * kk, d2 = (px - qx) ** 2 + (py - qy) ** 2;
          if (d2 < best) { best = d2; side = sx * (py - qy) - sy * (px - qx) > 0 ? 1 : -1; bt = (cum[s - 1] + (cum[s] - cum[s - 1]) * kk) / total; }
        }
        const d = Math.sqrt(best);
        if (d >= w) continue;
        const s = (side * d) / w;
        let f: number;
        if (o.fold) {
          f = -(Math.max(0, 1 - (s / 0.55) ** 2) ** 2);
          if (s > 0.15) f += 0.6 * Math.max(0, 1 - ((s - 0.6) / 0.42) ** 2) ** 2;
        } else f = (1 - s * s) ** 2;
        // fade in and out at the ends so a crease does not stop abruptly
        const e = o.taper === false ? 1 : Math.min(1, bt / 0.18, (1 - bt) / 0.18);
        this.z[k] += h * f * Math.max(0, e);
      }
    }
  }

  /** visit every filled pixel (x, y local; k index) to edit z / m / t */
  each(fn: (x: number, y: number, k: number) => void) {
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const k = j * this.w + i;
        if (this.z[k] !== EMPTY) fn(this.lx(i), this.ly(j), k);
      }
  }

  /**
   * Light the field and write it into the sketch. drop: height fall-off assumed past the silhouette;
   * seam: height step at an element border that draws a dark seam (seamDark); ao: cavity darkening.
   */
  emit(o: { bias?: number; drop?: number; seam?: number; seamDark?: number; contrast?: number; ao?: number; aoR?: number; zb?: number } = {}) {
    const bias = o.bias ?? 0, drop = o.drop ?? 2.4, seam = o.seam ?? 1.4, seamDark = o.seamDark ?? 0.3, contrast = o.contrast ?? 1;
    const ao = o.ao ?? 0, aoR = o.aoR ?? 3, zb = o.zb ?? 0;
    const { w, h, z, m, t, id, sk } = this;
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
        if (cav) l -= Math.min(0.32, cav[k] * ao);
        const me = id[k];
        if ((i > 0 && id[k - 1] !== me && z[k - 1] - zc > seam) || (i < w - 1 && id[k + 1] !== me && z[k + 1] - zc > seam) ||
          (j > 0 && id[k - w] !== me && z[k - w] - zc > seam) || (j < h - 1 && id[k + w] !== me && z[k + w] - zc > seam)) l -= seamDark;
        sk.dot(this.lx(i), this.ly(j), m[k], l, zc + zb);
      }
  }
}

// ------------------------------------------------------------------ contours
/** a landmark: [x, y] or [x, y, sharpness 0 (smooth) .. 1 (a corner)] */
export type LM = V2 | [number, number, number];

/**
 * A Catmull-Rom spline through landmarks, sampled about every `step` px: the one continuous contour a
 * shape is built from. closed (default) joins the last landmark back to the first.
 */
export function spline(lms: LM[], step = 1, closed = true): V2[] {
  const n = lms.length;
  if (n < 2) return lms.map(q => [q[0], q[1]] as V2);
  const P = (i: number): LM => (closed ? lms[((i % n) + n) % n] : lms[Math.max(0, Math.min(n - 1, i))]);
  const sharp = (q: LM) => (q.length > 2 ? (q as number[])[2] : 0);
  const out: V2[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const s1 = 1 - sharp(p1), s2 = 1 - sharp(p2);
    const m1x = (p2[0] - p0[0]) * 0.5 * s1, m1y = (p2[1] - p0[1]) * 0.5 * s1;
    const m2x = (p3[0] - p1[0]) * 0.5 * s2, m2y = (p3[1] - p1[1]) * 0.5 * s2;
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const ns = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < ns; k++) {
      const t = k / ns, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x, h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y]);
    }
  }
  if (!closed) { const q = P(n - 1); out.push([q[0], q[1]]); }
  return out;
}

/**
 * Break a contour's edge with tufts of fur / feather tips / bristles: walking along it, sel(x, y,
 * nx, ny) (outward normal) returns [length, lean (rad, + turns the tuft toward the travel direction)]
 * or null for a smooth stretch; tufts are `spacing` px apart with a seeded jitter.
 */
export function fringe(poly: V2[], spacing: number, seed: number, sel: (x: number, y: number, nx: number, ny: number) => [number, number] | null): V2[] {
  const n = poly.length;
  if (n < 3) return poly;
  let area = 0;
  for (let a = 0, b = n - 1; a < n; b = a++) area += (poly[b][0] - poly[a][0]) * (poly[b][1] + poly[a][1]);
  const sgn = area > 0 ? 1 : -1; // screen coords (y down)
  const out: V2[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n], q = poly[i];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    let nx = (ty / tl) * sgn, ny = (-tx / tl) * sgn;
    if (i > 0) acc += Math.hypot(q[0] - poly[i - 1][0], q[1] - poly[i - 1][1]);
    const s = sel(q[0], q[1], nx, ny);
    if (!s) { out.push(q); continue; }
    const idx = Math.floor(acc / spacing), f = acc / spacing - idx;
    const r = 0.55 + hash2(idx, 7, seed) * 0.7;
    const prof = f < 0.7 ? f / 0.7 : (1 - f) / 0.3;
    const L = s[0] * r * prof * prof;
    const c = Math.cos(s[1]), sn = Math.sin(s[1]);
    const dx = (tx / tl) * sgn, dy = (ty / tl) * sgn;
    nx = nx * c + dx * sn; ny = ny * c + dy * sn;
    out.push([q[0] + nx * L, q[1] + ny * L]);
  }
  return out;
}

/** points along a bone a -> b: at t (0..1) offset `off` px to its left-hand normal (screen: [dy, -dx]) */
export function along(a: V2, b: V2, t: number, off: number, sharp = 0): LM {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [a[0] + dx * t + (dy / l) * off, a[1] + dy * t - (dx / l) * off, sharp];
}

// ------------------------------------------------------------------ textures
/** Cellular (Worley) noise result: F1, F2 (cell units), nearest feature point (px) and its hash. */
export const W = { f1: 9, f2: 9, cx: 0, cy: 0, ci: 0 };
export function cell(x: number, y: number, sx: number, sy: number, seed: number, jit = 0.8) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.5 + (hash2(cx, cy, seed) - 0.5) * jit) * sx;
      const py = (cy + 0.5 + (hash2(cx, cy, seed + 1) - 0.5) * jit) * sy;
      const dx = (x - px) / sx, dy = (y - py) / sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; W.cx = px; W.cy = py; W.ci = hash2(cx, cy, seed + 2); } else if (d < f2) f2 = d;
    }
  W.f1 = f1; W.f2 = f2;
  return W;
}
/** a domed scale / pebble from the last cell(): 0 in the groove, 1 on the crown */
export const domeH = (k = 2.6) => Math.pow(cl((W.f2 - W.f1) * k), 0.65);

/**
 * Fur / feather strands: a height of -0.5..0.5 made of short tapered strands lying along angle `ang`
 * (screen rad), `len` px long and `wid` px apart, rows staggered. Returns also (via FS) whether the
 * pixel is a strand tip (for frosted / grizzled tips).
 */
export const FS = { tip: 0, row: 0, seg: 0 };
export function strands(x: number, y: number, ang: number, len: number, wid: number, seed: number): number {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const u = x * ca + y * sa, v = -x * sa + y * ca;
  const row = Math.floor(v / wid), fv = v / wid - row;
  const uu = u + hash2(row, 0, seed) * len * 3.1;
  const seg = Math.floor(uu / len), fu = uu / len - seg;
  FS.row = row; FS.seg = seg; FS.tip = fu;
  // strands taper toward their tip (fu -> 1), rounded across
  const across = Math.sin(fv * Math.PI);
  const along = 0.35 + 0.65 * fu;
  return across * along - 0.5 + (hash2(row, seg, seed + 3) - 0.5) * 0.3;
}

/**
 * Cache a texture that depends only on the pixel's position (not on the mass it is drawn for), so
 * overlapping masses / regions evaluate it once per pixel.
 */
export function memoTex(sk: Sk, tex: Tex): Tex {
  const n = sk.w * sk.h;
  const has = new Uint8Array(n), cz = new Float32Array(n), cm = new Uint8Array(n), ct = new Float32Array(n);
  return (p, o) => {
    const i = Math.floor(p.y + sk.oy) * sk.w + Math.floor(p.x + sk.ox);
    if (i < 0 || i >= n) { tex(p, o); return; }
    if (has[i]) { o.z += cz[i]; o.m = cm[i]; o.t += ct[i]; return; }
    const z0 = o.z, t0 = o.t;
    tex(p, o);
    has[i] = 1; cz[i] = o.z - z0; cm[i] = o.m; ct[i] = o.t - t0;
  };
}

/** smooth value noise 0..1 (re-export for painters) */
export const vn = noise2;

/** point helpers */
export const P2 = {
  lerp: (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
  polar: (o: V2, a: number, r: number): V2 => [o[0] + Math.cos(a) * r, o[1] + Math.sin(a) * r],
};

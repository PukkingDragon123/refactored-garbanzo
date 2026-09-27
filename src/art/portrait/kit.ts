// Portrait kit: a tiny shape rasteriser for Dave-the-Diver-style character art. Characters are
// built from smooth filled shapes in a 200x200 "unit" design space (face looks right, y down),
// rasterised at any scale with hard pixel edges, flat cel shading (explicit shadow/highlight
// shapes clipped to a material) and a dark outline drawn on the front shape wherever it overlaps
// a different material group, plus one around the whole silhouette.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';

export type Pt = [number, number];

export interface MatDef { group: number; line: boolean; lineK?: number }

export class Pic {
  readonly W: number;
  readonly H: number;
  readonly col: Uint32Array;
  readonly mat: Uint8Array;
  readonly z: Uint16Array;
  private zc = 1;
  readonly mats: MatDef[] = [{ group: 0, line: false }];
  /** s: pixels per design unit; (ox, oy): design-space point mapped to pixel (0, 0) */
  constructor(w: number, h: number, readonly s: number, readonly ox = 0, readonly oy = 0) {
    this.W = w; this.H = h;
    this.col = new Uint32Array(w * h);
    this.mat = new Uint8Array(w * h);
    this.z = new Uint16Array(w * h);
  }
  /** register a material; returns its id */
  m(group: number, line = true, lineK = 0.55): number {
    this.mats.push({ group, line, lineK });
    return this.mats.length - 1;
  }
  /** vertical shift (design units) applied to everything drawn while set: moves the head vs the body */
  ty = 0;
  X(u: number) { return (u - this.ox) * this.s; }
  Y(v: number) { return (v + this.ty - this.oy) * this.s; }
  U(x: number) { return (x + 0.5) / this.s + this.ox; }
  V(y: number) { return (y + 0.5) / this.s + this.oy - this.ty; }

  /** write pixel i as part of a new shape (z = current shape counter) */
  private put(i: number, c: C, m: number, o: PaintOpts) {
    if (o.clip) {
      if (!o.clip.includes(this.mat[i])) return;
      this.col[i] = c;
      if (o.retag) this.mat[i] = m;
      return;
    }
    if (o.under && this.mat[i]) return;
    this.col[i] = c;
    this.mat[i] = m;
    this.z[i] = this.zc;
  }
  begin() { this.zc++; }

  /** Fill a closed smooth path (Catmull-Rom through the points). */
  fill(pts: Pt[], c: C, m: number, o: PaintOpts = {}) {
    this.begin();
    const poly = o.sharp ? pts : smooth(pts, true);
    scan(poly.map(p => [this.X(p[0]), this.Y(p[1])] as Pt), this.W, this.H, i => this.put(i, c, m, o));
  }
  /** Ellipse (rot in radians). */
  ell(cx: number, cy: number, rx: number, ry: number, c: C, m: number, o: PaintOpts = {}, rot = 0) {
    this.begin();
    const X = this.X(cx), Y = this.Y(cy), RX = rx * this.s, RY = ry * this.s;
    const r = Math.max(RX, RY) + 1, ca = Math.cos(rot), sa = Math.sin(rot);
    for (let y = Math.max(0, Math.floor(Y - r)); y <= Math.min(this.H - 1, Math.ceil(Y + r)); y++)
      for (let x = Math.max(0, Math.floor(X - r)); x <= Math.min(this.W - 1, Math.ceil(X + r)); x++) {
        const qx = x + 0.5 - X, qy = y + 0.5 - Y;
        const lx = qx * ca + qy * sa, ly = -qx * sa + qy * ca;
        if ((lx / RX) ** 2 + (ly / RY) ** 2 <= 1) this.put(y * this.W + x, c, m, o);
      }
  }
  /** Tapered stroke along a smooth open path; w0 → w1 are widths in units. Thin strokes stay 1px continuous. */
  stroke(pts: Pt[], w0: number, w1: number, c: C, m: number, o: PaintOpts = {}) {
    this.begin();
    const raw = o.sharp ? pts : smooth(pts, false);
    // resample in pixel space so consecutive samples are <= 0.35 px apart
    const path: Pt[] = [];
    for (let i = 0; i < raw.length; i++) {
      const a = [this.X(raw[i][0]), this.Y(raw[i][1])] as Pt;
      if (i === 0) { path.push(a); continue; }
      const b = path[path.length - 1];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const n = Math.max(1, Math.ceil(d / 0.35));
      for (let k = 1; k <= n; k++) path.push([b[0] + ((a[0] - b[0]) * k) / n, b[1] + ((a[1] - b[1]) * k) / n]);
    }
    const done = new Set<number>();
    const N = path.length;
    for (let i = 0; i < N; i++) {
      const t = N > 1 ? i / (N - 1) : 0;
      const w = ((w0 + (w1 - w0) * t) * this.s) / 2;
      const X = path[i][0], Y = path[i][1];
      if (w < 0.62) {
        const xi = Math.floor(X), yi = Math.floor(Y);
        if (xi >= 0 && yi >= 0 && xi < this.W && yi < this.H) { const k = yi * this.W + xi; if (!done.has(k)) { done.add(k); this.put(k, c, m, o); } }
        continue;
      }
      for (let y = Math.floor(Y - w); y <= Math.ceil(Y + w); y++)
        for (let x = Math.floor(X - w); x <= Math.ceil(X + w); x++) {
          if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
          if ((x + 0.5 - X) ** 2 + (y + 0.5 - Y) ** 2 > w * w) continue;
          const k = y * this.W + x;
          if (done.has(k)) continue;
          done.add(k);
          this.put(k, c, m, o);
        }
    }
  }
  /** Paint pixels of the given materials where fn(u, v) is true (terminator shading, bands). */
  where(mats: number[], fn: (u: number, v: number, x: number, y: number) => boolean, c: C) {
    for (let y = 0; y < this.H; y++)
      for (let x = 0; x < this.W; x++) {
        const i = y * this.W + x;
        if (!mats.includes(this.mat[i])) continue;
        if (fn(this.U(x), this.V(y), x, y)) this.col[i] = c;
      }
  }
  /** single pixel in design space (for tiny highlights) */
  dot(u: number, v: number, c: C, m = 0) {
    const x = Math.floor(this.X(u)), y = Math.floor(this.Y(v));
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = y * this.W + x;
    this.col[i] = c;
    if (m) this.mat[i] = m;
  }

  /** Outlines (between groups on the front shape, then around the silhouette) → PixelBuffer. */
  finish(o: { outline?: C; inner?: boolean; outer?: boolean } = {}): PixelBuffer {
    const W = this.W, H = this.H, col = this.col, mat = this.mat, z = this.z, M = this.mats;
    const out = col.slice();
    const dark = o.outline ?? hex('#1e1418');
    if (o.inner !== false)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x, mi = mat[i];
          if (!mi || !M[mi].line) continue;
          const g = M[mi].group;
          let edge = false;
          for (const [dx, dy] of N4) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const j = Y * W + X, mj = mat[j];
            if (!mj || M[mj].group === g) continue;
            if (z[i] > z[j]) { edge = true; break; }
          }
          if (edge) out[i] = mix(shade(col[i], -(M[mi].lineK ?? 0.55)), dark, 0.45);
        }
    const buf = new PixelBuffer(W, H);
    buf.data.set(out);
    if (o.outer !== false) {
      const src = buf.data.slice();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (src[i] >>> 24) continue;
          let nb = -1;
          for (const [dx, dy] of N4) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            if (src[Y * W + X] >>> 24) { nb = Y * W + X; break; }
          }
          if (nb >= 0) buf.data[i] = mix(shade(src[nb], -0.7), dark, 0.6);
        }
    }
    return buf;
  }
}

export interface PaintOpts {
  /** only paint over pixels whose material is in this list (shading overlays keep the material) */
  clip?: number[];
  /** with clip: also change the material of painted pixels */
  retag?: boolean;
  /** only paint empty pixels (goes behind) */
  under?: boolean;
  /** use the points as a polygon without smoothing */
  sharp?: boolean;
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Catmull-Rom resample. */
export function smooth(pts: Pt[], closed: boolean, n = 8): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [];
  const L = pts.length;
  const at = (i: number) => (closed ? pts[(i + L) % L] : pts[Math.max(0, Math.min(L - 1, i))]);
  const last = closed ? L : L - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[L - 1]);
  return out;
}

/** even-odd scanline fill sampling pixel centres */
function scan(poly: Pt[], W: number, H: number, put: (i: number) => void) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of poly) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const xs: number[] = [];
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) put(y * W + x);
    }
  }
}

/** Palette helper: [deep shadow, shadow, base, light] from one base colour. */
export function tones(base: string | C, o: { sh?: number; deep?: number; hi?: number; warm?: string } = {}): [C, C, C, C] {
  const b = typeof base === 'string' ? hex(base) : base;
  const warm = o.warm ? hex(o.warm) : hex('#5a2a4a');
  return [mix(shade(b, -(o.deep ?? 0.42)), warm, 0.18), mix(shade(b, -(o.sh ?? 0.2)), warm, 0.1), b, shade(b, o.hi ?? 0.16)];
}

// V7 people: a tiny 3D rasteriser for pixel-art sprites. Characters are built from ellipsoids and
// tapered limbs (sphere sweeps) in 3D, seen by an orthographic camera, so a figure can turn toward
// the viewer (3/4 view) and every limb foreshortens and overlaps correctly while animating.
// Each primitive's material picks a colour from a hue-shifted ramp with anime cel shading (one
// shadow step, a base, a thin light); the finish pass inks the silhouette and draws hand-drawn style
// interior lines wherever a nearer part overlaps a different one, plus a soft contact shadow.
//
// World space: x right, y up, z toward the viewer. Buffer: x right, y down; the world origin (the
// ground anchor between the feet) sits at (ox, oy).

import { PixelBuffer } from '../pixel';
import { C, mix, shade } from '../color';

export type V3 = [number, number, number];
export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vsc = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const vnorm = (a: V3): V3 => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vlerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** key light: upper left, in front */
export const LIGHT7: V3 = vnorm([-0.5, 0.72, 0.62]);

/** what a material sees at a surface point */
export interface Hit {
  /** world normal */
  n: V3;
  /** world point */
  p: V3;
  /** primitive-local coordinates: ellipsoid unit-sphere point, or limb (t along 0..1, a around -PI..PI) */
  q: V3;
  t: number;
  /** cel light term (n·L), -1..1 */
  l: number;
  /** buffer pixel */
  x: number;
  y: number;
}
/** returns a colour, or -1 to leave the pixel empty (cut-outs) */
export type Mat = (h: Hit) => C | -1;

/** 6-tone ramp: [ink, deep, shadow, base, light, shine] */
export type Ramp6 = C[];
/** anime cel pick: shadow / base / light, with an optional bias */
export function cel(r: Ramp6, l: number, bias = 0, shine = false): C {
  const v = l + bias;
  if (v < -0.42) return r[1];
  if (v < 0.08) return r[2];
  if (v < 0.78) return r[3];
  return shine && v > 0.93 ? r[5] : r[4];
}

export class Scene3D {
  readonly w: number;
  readonly h: number;
  readonly z: Float32Array;
  readonly col: Uint32Array;
  /** part group per pixel (0 = empty); lines are drawn between different groups */
  readonly grp: Uint16Array;
  /** 1 = routed to the front layer */
  readonly lay: Uint8Array;
  layer = 0;
  private bx0 = 1e9; private by0 = 1e9; private bx1 = -1; private by1 = -1;
  constructor(w: number, h: number, readonly ox: number, readonly oy: number) {
    this.w = w; this.h = h;
    this.z = new Float32Array(w * h).fill(-1e9);
    this.col = new Uint32Array(w * h);
    this.grp = new Uint16Array(w * h);
    this.lay = new Uint8Array(w * h);
  }
  /** world → buffer */
  sx(p: V3) { return this.ox + p[0]; }
  sy(p: V3) { return this.oy - p[1]; }

  private write(i: number, z: number, c: C, g: number, x: number, y: number) {
    this.z[i] = z; this.col[i] = c; this.grp[i] = g; this.lay[i] = this.layer;
    if (x < this.bx0) this.bx0 = x; if (y < this.by0) this.by0 = y; if (x > this.bx1) this.bx1 = x; if (y > this.by1) this.by1 = y;
  }

  /**
   * Ellipsoid: centre c, semi-axes as the columns a0 a1 a2 (world vectors). The material sees q as
   * the unit-sphere point, so it can place bands, seams and cut-outs in the part's own frame.
   */
  ellipsoid(c: V3, a0: V3, a1: V3, a2: V3, g: number, mat: Mat, zb = 0) {
    // inverse of M = [a0 a1 a2]
    const m = [a0[0], a1[0], a2[0], a0[1], a1[1], a2[1], a0[2], a1[2], a2[2]];
    const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    if (Math.abs(det) < 1e-6) return;
    const id = 1 / det;
    const inv = [
      (m[4] * m[8] - m[5] * m[7]) * id, (m[2] * m[7] - m[1] * m[8]) * id, (m[1] * m[5] - m[2] * m[4]) * id,
      (m[5] * m[6] - m[3] * m[8]) * id, (m[0] * m[8] - m[2] * m[6]) * id, (m[2] * m[3] - m[0] * m[5]) * id,
      (m[3] * m[7] - m[4] * m[6]) * id, (m[1] * m[6] - m[0] * m[7]) * id, (m[0] * m[4] - m[1] * m[3]) * id,
    ];
    const ext = [Math.hypot(a0[0], a1[0], a2[0]), Math.hypot(a0[1], a1[1], a2[1])];
    const x0 = Math.max(0, Math.floor(this.ox + c[0] - ext[0] - 1)), x1 = Math.min(this.w - 1, Math.ceil(this.ox + c[0] + ext[0] + 1));
    const y0 = Math.max(0, Math.floor(this.oy - c[1] - ext[1] - 1)), y1 = Math.min(this.h - 1, Math.ceil(this.oy - c[1] + ext[1] + 1));
    // v = inv * ez
    const vx = inv[2], vy = inv[5], vz = inv[8];
    const A = vx * vx + vy * vy + vz * vz;
    const H: Hit = { n: [0, 0, 1], p: [0, 0, 0], q: [0, 0, 0], t: 0, l: 0, x: 0, y: 0 };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const wx = x + 0.5 - this.ox - c[0], wy = this.oy - (y + 0.5) - c[1];
      const ux = inv[0] * wx + inv[1] * wy, uy = inv[3] * wx + inv[4] * wy, uz = inv[6] * wx + inv[7] * wy;
      const Bq = 2 * (ux * vx + uy * vy + uz * vz), Cq = ux * ux + uy * uy + uz * uz - 1;
      const D = Bq * Bq - 4 * A * Cq;
      if (D < 0) continue;
      const zz = (-Bq + Math.sqrt(D)) / (2 * A);
      const i = y * this.w + x;
      const zw = c[2] + zz;
      if (zw + zb <= this.z[i]) continue;
      const qx = ux + vx * zz, qy = uy + vy * zz, qz = uz + vz * zz;
      // normal = inv^T q
      const n = vnorm([inv[0] * qx + inv[3] * qy + inv[6] * qz, inv[1] * qx + inv[4] * qy + inv[7] * qz, inv[2] * qx + inv[5] * qy + inv[8] * qz]);
      H.n = n; H.p = [c[0] + wx, c[1] + wy, zw]; H.q = [qx, qy, qz]; H.t = 0; H.l = vdot(n, LIGHT7); H.x = x; H.y = y;
      const col = mat(H);
      if (col === -1) continue;
      this.write(i, zw + zb, col, g, x, y);
    }
  }

  /** tapered limb from a (radius ra) to b (radius rb): a sweep of spheres */
  limb(a: V3, b: V3, ra: number, rb: number, g: number, mat: Mat) {
    const d = vsub(b, a), L = vlen(d);
    const n = Math.max(2, Math.ceil(L / 0.35));
    const ax = vnorm(L > 1e-4 ? d : [0, -1, 0]);
    // a stable frame around the axis for the angle coordinate
    const ref: V3 = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = vnorm(vcross(ax, ref)), e2 = vcross(ax, e1);
    const H: Hit = { n: [0, 0, 1], p: [0, 0, 0], q: [0, 0, 0], t: 0, l: 0, x: 0, y: 0 };
    const rmax = Math.max(ra, rb);
    const x0 = Math.max(0, Math.floor(this.ox + Math.min(a[0], b[0]) - rmax - 1)), x1 = Math.min(this.w - 1, Math.ceil(this.ox + Math.max(a[0], b[0]) + rmax + 1));
    const y0 = Math.max(0, Math.floor(this.oy - Math.max(a[1], b[1]) - rmax - 1)), y1 = Math.min(this.h - 1, Math.ceil(this.oy - Math.min(a[1], b[1]) + rmax + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - this.ox, py = this.oy - (y + 0.5);
      let best = -1e9, bt = 0, bc: V3 | null = null, br = 1;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const cx = a[0] + d[0] * t, cy = a[1] + d[1] * t, cz = a[2] + d[2] * t, r = ra + (rb - ra) * t;
        const dx = px - cx, dy = py - cy, q = r * r - dx * dx - dy * dy;
        if (q < 0) continue;
        const z = cz + Math.sqrt(q);
        if (z > best) { best = z; bt = t; bc = [cx, cy, cz]; br = r; }
      }
      if (!bc) continue;
      const i = y * this.w + x;
      if (best <= this.z[i]) continue;
      const nrm = vnorm([px - bc[0], py - bc[1], best - bc[2]]);
      void br;
      H.n = nrm; H.p = [px, py, best]; H.t = bt; H.l = vdot(nrm, LIGHT7); H.x = x; H.y = y;
      H.q = [bt, Math.atan2(vdot(nrm, e2), vdot(nrm, e1)), vdot(nrm, ax)];
      const col = mat(H);
      if (col === -1) continue;
      this.write(i, best, col, g, x, y);
    }
  }

  /** a single dot painted on the nearest surface if the point isn't hidden (eyes, buttons) */
  dot(p: V3, c: C, tol = 1.2): boolean {
    const x = Math.floor(this.ox + p[0]), y = Math.floor(this.oy - p[1]);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    if (!this.grp[i] || this.z[i] > p[2] + tol) return false;
    this.col[i] = c;
    return true;
  }
  /** overwrite a pixel that's already on a surface (no depth test) */
  paint(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.grp[i]) this.col[i] = c;
  }

  /**
   * Ink: interior lines where a nearer part overlaps a different group (drawn on the farther
   * pixel, so the near part keeps its full shape), a contact shadow just under overlaps, and a
   * dark outline round the silhouette. Returns the back layer and (if used) the front layer.
   */
  finish(o: { ink: C; line?: number; depthLine?: number } = { ink: 0xff201418 }): { back: PixelBuffer; front: PixelBuffer | null; ox: number; oy: number } {
    const W = this.w, Hh = this.h, z = this.z, g = this.grp, src = this.col.slice();
    const out = this.col;
    const lineK = o.line ?? 0.55, dl = o.depthLine ?? 2.2;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!g[i]) continue;
      let line = -1, contact = false;
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue;
        const j = Y * W + X;
        if (!g[j]) continue;
        const nearer = z[j] - z[i];
        if ((g[j] !== g[i] && nearer > 0.4) || nearer > dl) line = j;
        else if (dy === -1 && g[j] !== g[i] && nearer > -0.4) contact = true;
      }
      // the line takes the dark tone of the part in front (a hand-inked edge of that part)
      if (line >= 0) out[i] = mix(mix(shade(src[line], -lineK - 0.1), shade(src[i], -lineK), 0.3), o.ink, 0.3);
      else if (contact) out[i] = mix(src[i], shade(src[i], -0.3), 0.6);
    }
    // silhouette outline (tinted by the neighbour)
    const filled = new Uint8Array(W * Hh);
    for (let i = 0; i < W * Hh; i++) filled[i] = g[i] ? 1 : 0;
    const back = new PixelBuffer(W, Hh), front = new PixelBuffer(W, Hh);
    let anyFront = false;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) {
        if (this.lay[i]) { front.data[i] = out[i]; anyFront = true; } else back.data[i] = out[i];
        continue;
      }
      let nb = -1;
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue;
        if (filled[Y * W + X]) { nb = Y * W + X; break; }
      }
      if (nb >= 0) {
        const c = mix(shade(src[nb], -0.72), o.ink, 0.55);
        if (this.lay[nb]) { front.data[i] = c; anyFront = true; } else back.data[i] = c;
      }
    }
    return { back, front: anyFront ? front : null, ox: this.ox, oy: this.oy };
  }
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

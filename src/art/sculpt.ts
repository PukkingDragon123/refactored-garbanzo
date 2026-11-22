// A 2.5D sculpting layer for the beast sketch (beasts-core Sk).
//
// Big animals read as living bodies when their form comes from real masses (a skull, a jaw, a ribcage,
// girdles, limb bones under muscle) merged into one surface, and when every fold, wart, wrinkle and
// scale shades itself. A Lay is a height field over the canvas for one part: each pixel keeps the
// front surface's depth, a material, a lighting offset and an element id. Masses merge with a smooth
// max (organic fillets instead of hard creases); texture functions displace the surface; emit() lights
// every pixel from the field's own normals (finite differences, so each bump shades itself), darkens
// cavities, draws a seam where one element passes in front of another and adds a wet specular glint,
// then writes it all into the sketch, which gives the palette ramps, part edges and the outline.
//
// The primitives:
//   bone()  a capsule between two 3D points with a muscle bulge (limb segments, digits, claws);
//   ell()   an ellipsoid mass (a girdle, a cheek, a pad) with its own local (u, v) for texture;
//   slab()  a lofted form along a straight axis in its own frame, its outline given by top and bottom
//           profile curves and its depth by a half-width curve (a head, a jaw, a paddle tail);
//   loft()  the same along a curved spine (a trunk, a neck, a tail), with arc length and offset for
//           texture.

import { Sk, V2, lumN } from './beasts-core';
import { hash2 } from '../core/math';

// ------------------------------------------------------------------ small maths
export const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const ss = (a: number, b: number, v: number) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const gs = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));
export const frc = (v: number) => v - Math.floor(v);
export const smax = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
export const rotP = (p: V2, o: V2, a: number): V2 => {
  const c = Math.cos(a), s = Math.sin(a), dx = p[0] - o[0], dy = p[1] - o[1];
  return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c];
};

/** superellipse cross-section: 1 at the middle, 0 at |v| = 1 (tabled per exponent) */
const SE_N = 1024;
const seTabs = new Map<number, Float32Array>();
export const se = (av: number, pe: number) => {
  if (av >= 1) return 0;
  let tb = seTabs.get(pe);
  if (!tb) {
    tb = new Float32Array(SE_N + 1);
    for (let i = 0; i <= SE_N; i++) tb[i] = Math.pow(1 - Math.pow(i / SE_N, pe), 1 / pe);
    seTabs.set(pe, tb);
  }
  const f = av * SE_N, i = f | 0;
  return tb[i] + (tb[i + 1] - tb[i]) * (f - i);
};

export type Keys = readonly (readonly [number, number])[];
/** Catmull-Rom through [x, y] keys (x ascending), clamped at the ends. */
export function crv(keys: Keys, x: number): number {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 1;
  while (keys[i][0] < x) i++;
  const p1 = keys[i - 1], p2 = keys[i], p0 = keys[Math.max(0, i - 2)], p3 = keys[Math.min(n - 1, i + 1)];
  const dx = p2[0] - p1[0], t = (x - p1[0]) / dx;
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * dx, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * dx;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

/** Cellular (Worley) noise: F1, F2 (cell units), the nearest feature point and its hash (in CELL). */
export const CELL = { F1: 0, F2: 0, CX: 0, CY: 0, CI: 0 };
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
  CELL.F1 = F1; CELL.F2 = F2; CELL.CX = CX; CELL.CY = CY; CELL.CI = CI;
}

// ------------------------------------------------------------------ the layer
export const EMPTY = -1e9;
/** what a texture function writes: displacement (px), material, lighting offset */
export interface Tx { z: number; m: number; t: number; /** shape(): a rounding radius for this pixel, overriding the shape's R (0: use R) */ r?: number }

export interface EmitOpt {
  /** lighting bias for the whole part */
  bias?: number;
  /** how far the surface is taken to drop past the silhouette (px): bigger rounds the edges more */
  drop?: number;
  /** depth step that draws a seam between two elements, and how dark */
  seam?: number; seamDark?: number;
  /** lighting contrast around the mid tone */
  contrast?: number;
  /** cavity darkening: strength per px below the local mean, and the radius it averages over */
  ao?: number; aoR?: number;
  /** wet glint: material id -> strength (added light at the specular peak) */
  spec?: Map<number, number>;
  /** specular tightness */
  specP?: number;
}

export class Lay {
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
  lx(i: number) { return this.X0 + i - this.sk.ox + 0.5; }
  ly(j: number) { return this.Y0 + j - this.sk.oy + 0.5; }
  cols(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.ox) - this.X0), Math.min(this.w - 1, Math.ceil(b + this.sk.ox) - this.X0)]; }
  rows(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.oy) - this.Y0), Math.min(this.h - 1, Math.ceil(b + this.sk.oy) - this.Y0)]; }
  /** cell index of local (x, y), or -1 */
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
  /** cut a hole (clears the field where pred is true) */
  clear(pred: (x: number, y: number) => boolean) {
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) if (pred(this.lx(i), this.ly(j))) this.z[j * this.w + i] = EMPTY;
  }
  emit(o: EmitOpt = {}) {
    const { w, z, m, t, id, sk } = this;
    const bias = o.bias ?? 0, drop = o.drop ?? 2.4, seam = o.seam ?? 1.4, seamDark = o.seamDark ?? 0.34, contrast = o.contrast ?? 1;
    const ao = o.ao ?? 0, aoR = o.aoR ?? 3, spec = o.spec, specP = o.specP ?? 18;
    // only the filled part of the layer
    let I0 = this.w, I1 = -1, J0 = this.h, J1 = -1;
    for (let j = 0; j < this.h; j++) {
      const row = j * w;
      for (let i = 0; i < w; i++) if (z[row + i] !== EMPTY) { if (i < I0) I0 = i; if (i > I1) I1 = i; if (j < J0) J0 = j; J1 = j; }
    }
    if (I1 < 0) return;
    const sw = I1 - I0 + 1, sh = J1 - J0 + 1;
    let cav: Float32Array | null = null;
    if (ao > 0) {
      const n = sw * sh, sz = new Float32Array(n), sc = new Float32Array(n), tz = new Float32Array(n), tc = new Float32Array(n);
      for (let j = 0; j < sh; j++) {
        let az = 0, ac = 0;
        const row = (j + J0) * w + I0;
        for (let i = -aoR; i < sw + aoR; i++) {
          const a = i + aoR, b = i - aoR - 1;
          if (a < sw && a >= 0) { const v = z[row + a]; if (v !== EMPTY) { az += v; ac++; } }
          if (b >= 0 && b < sw) { const v = z[row + b]; if (v !== EMPTY) { az -= v; ac--; } }
          if (i >= 0 && i < sw) { tz[j * sw + i] = az; tc[j * sw + i] = ac; }
        }
      }
      for (let i = 0; i < sw; i++) {
        let az = 0, ac = 0;
        for (let j = -aoR; j < sh + aoR; j++) {
          const a = j + aoR, b = j - aoR - 1;
          if (a < sh && a >= 0) { az += tz[a * sw + i]; ac += tc[a * sw + i]; }
          if (b >= 0 && b < sh) { az -= tz[b * sw + i]; ac -= tc[b * sw + i]; }
          if (j >= 0 && j < sh) { sz[j * sw + i] = az; sc[j * sw + i] = ac; }
        }
      }
      cav = new Float32Array(n);
      for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
        const k = (j + J0) * w + i + I0, q = j * sw + i;
        if (z[k] !== EMPTY && sc[q] > 0) cav[q] = Math.max(0, sz[q] / sc[q] - z[k]);
      }
    }
    // the half vector between the key light and the eye, for the wet glint
    const hl = Math.hypot(-0.52, -0.74, 1.42), HX = -0.52 / hl, HY = -0.74 / hl, HZ = 1.42 / hl;
    const h = this.h;
    const SW = sk.w, zb = sk.zb, pid = sk.pid, clipY = sk.clipY, SZ = sk.z, SM = sk.mat, SL = sk.lum, SP = sk.part;
    for (let j = J0; j <= J1; j++)
      for (let i = I0; i <= I1; i++) {
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
        if (cav) l -= Math.min(0.3, cav[(j - J0) * sw + i - I0] * ao);
        if (spec) {
          const s = spec.get(m[k]);
          if (s) { const d = nx * HX + ny * HY + nz * HZ; if (d > 0) l += s * Math.pow(d, specP); }
        }
        const me = id[k];
        if ((i > 0 && id[k - 1] !== me && z[k - 1] - zc > seam) || (i < w - 1 && id[k + 1] !== me && z[k + 1] - zc > seam) ||
          (j > 0 && id[k - w] !== me && z[k - w] - zc > seam) || (j < h - 1 && id[k + w] !== me && z[k + w] - zc > seam)) l -= seamDark;
        // write through the sketch's depth test (as Sk.dot does, without the per-pixel indirection)
        const gi = (this.Y0 + j) * SW + this.X0 + i, zz = zc + zb;
        if (zz <= SZ[gi] || m[k] <= 0 || this.ly(j) > clipY) continue;
        SM[gi] = m[k]; SL[gi] = l; SZ[gi] = zz; SP[gi] = pid;
      }
  }
}

// ------------------------------------------------------------------ primitives
/**
 * A tapered limb bone (capsule) with a muscle bulge, swept between two 3D points (screen x, y and
 * depth z). The bulge peaks at bAt (0..1 along) and fades out by 2 * bAt. tex gets (along px,
 * across px (signed), t 0..1, radius) and may displace the surface.
 */
export function bone(L: Lay, a: V2, za: number, b: V2, zb: number, r0: number, r1: number, bulge: number, bAt: number,
  id: number, blend: number, tex: (al: number, ac: number, t: number, r: number, o: Tx) => void, rz = 1) {
  const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy, len = Math.sqrt(L2) || 1e-6;
  const R = Math.max(r0, r1) + Math.max(0, bulge) + 1;
  const [i0, i1] = L.cols(Math.min(a[0], b[0]) - R, Math.max(a[0], b[0]) + R);
  const [j0, j1] = L.rows(Math.min(a[1], b[1]) - R, Math.max(a[1], b[1]) + R);
  const o: Tx = { z: 0, m: 0, t: 0 };
  for (let j = j0; j <= j1; j++) {
    const py = L.ly(j);
    for (let i = i0; i <= i1; i++) {
      const px = L.lx(i);
      let k = L2 > 0 ? ((px - a[0]) * sx + (py - a[1]) * sy) / L2 : 0;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const qx = a[0] + sx * k, qy = a[1] + sy * k;
      const dx = px - qx, dy = py - qy, d = Math.sqrt(dx * dx + dy * dy);
      const r = r0 + (r1 - r0) * k + bulge * Math.pow(Math.sin(Math.PI * cl(k / (2 * bAt))), 1.4) * (k < 2 * bAt ? 1 : 0);
      if (d > r || r <= 0) continue;
      const w = Math.sqrt(1 - (d / r) * (d / r));
      const side = sx * dy - sy * dx > 0 ? 1 : -1;
      o.z = 0; o.m = 0; o.t = 0;
      tex(k * len, side * d, k, r, o);
      if (!o.m) continue;
      L.put(j * L.w + i, za + (zb - za) * k + r * w * rz + o.z * w, o.m, o.t, id, blend);
    }
  }
}

/** An ellipsoid mass. tex gets the local (u, v) (-1..1 across its axes) and the bulge w (1 at the middle). */
export function ell(L: Lay, c: V2, z: number, rx: number, ry: number, rz: number, rot: number, id: number, blend: number,
  tex: (u: number, v: number, w: number, o: Tx) => void, pe = 2) {
  const R = Math.max(rx, ry) + 1;
  const [i0, i1] = L.cols(c[0] - R, c[0] + R), [j0, j1] = L.rows(c[1] - R, c[1] + R);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const o: Tx = { z: 0, m: 0, t: 0 };
  for (let j = j0; j <= j1; j++) {
    const dy = L.ly(j) - c[1];
    for (let i = i0; i <= i1; i++) {
      const dx = L.lx(i) - c[0];
      const u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry;
      const d = pe === 2 ? Math.sqrt(u * u + v * v) : Math.pow(Math.pow(Math.abs(u), pe) + Math.pow(Math.abs(v), pe), 1 / pe);
      if (d >= 1) continue;
      const w = pe === 2 ? Math.sqrt(1 - d * d) : se(d, pe);
      o.z = 0; o.m = 0; o.t = 0;
      tex(u, v, w, o);
      if (!o.m) continue;
      L.put(j * L.w + i, z + rz * w + o.z * w, o.m, o.t, id, blend);
    }
  }
}

/** A frame for slab(): local (x, y) -> screen = o + R(a) (x, y) * s. */
export interface SFrame { o: V2; a: number; s: number }
export const sfp = (F: SFrame, x: number, y: number): V2 => {
  const c = Math.cos(F.a), s = Math.sin(F.a);
  return [F.o[0] + (x * c - y * s) * F.s, F.o[1] + (x * s + y * c) * F.s];
};
export const sfInv = (F: SFrame, px: number, py: number): V2 => {
  const c = Math.cos(F.a), s = Math.sin(F.a), rx = px - F.o[0], ry = py - F.o[1];
  return [(rx * c + ry * s) / F.s, (-rx * s + ry * c) / F.s];
};

/**
 * A form lofted along the x axis of its own frame: at each x its outline runs from top(x) to bot(x)
 * (frame units, y down) and its depth is W(x) times a superellipse across (pTop above the middle, pBot
 * below: bigger is boxier). tex gets the frame coords and v (-1 top .. 1 bottom) and may displace (in
 * frame units). Depth is written in screen px (frame units times s) plus z0.
 */
export function slab(L: Lay, F: SFrame, x0: number, x1: number, top: (x: number) => number, bot: (x: number) => number, W: (x: number) => number,
  id: number, blend: number, tex: (x: number, y: number, v: number, o: Tx) => void, z0 = 0, pTop = 2.2, pBot = 2.6) {
  // bounding box of the frame-space rectangle
  let ymin = 1e9, ymax = -1e9;
  for (let x = x0; x <= x1; x += Math.max(0.5, (x1 - x0) / 24)) { ymin = Math.min(ymin, top(x)); ymax = Math.max(ymax, bot(x)); }
  const cs = [sfp(F, x0, ymin), sfp(F, x1, ymin), sfp(F, x0, ymax), sfp(F, x1, ymax)];
  const bx0 = Math.min(...cs.map(q => q[0])), bx1 = Math.max(...cs.map(q => q[0])), by0 = Math.min(...cs.map(q => q[1])), by1 = Math.max(...cs.map(q => q[1]));
  const [i0, i1] = L.cols(bx0, bx1), [j0, j1] = L.rows(by0, by1);
  const c = Math.cos(F.a), s = Math.sin(F.a);
  const o: Tx = { z: 0, m: 0, t: 0 };
  for (let j = j0; j <= j1; j++) {
    const py = L.ly(j);
    for (let i = i0; i <= i1; i++) {
      const px = L.lx(i);
      const rx = px - F.o[0], ry = py - F.o[1];
      const x = (rx * c + ry * s) / F.s, y = (-rx * s + ry * c) / F.s;
      if (x < x0 || x > x1) continue;
      const tp = top(x), bt = bot(x);
      if (y < tp || y > bt) continue;
      const mid = (tp + bt) / 2, half = Math.max(0.3, (bt - tp) / 2);
      const v = (y - mid) / half;
      const zz = W(x) * se(Math.min(1, Math.abs(v)), v < 0 ? pTop : pBot);
      o.z = 0; o.m = 0; o.t = 0;
      tex(x, y, v, o);
      if (!o.m) continue;
      const fade = Math.min(1, (1 - Math.abs(v)) * 5);
      L.put(j * L.w + i, z0 + (zz + o.z * fade) * F.s, o.m, o.t, id, blend);
    }
  }
}

/**
 * A form lofted along a polyline spine (listed tail to head). prof(s) gives [top, bot, W] at arc length
 * s (px): the outline runs from top px above the spine to bot px below it, the depth is W times a
 * superellipse across. The ends are capped round. tex gets the arc length S, the offset D (+ ventral,
 * px), v (-1 dorsal edge .. 1 ventral edge) and the half height, and may displace (px).
 */
export function loft(L: Lay, sp: V2[], prof: (s: number) => [number, number, number], id: number, blend: number,
  tex: (S: number, D: number, v: number, hg: number, o: Tx) => void, o2: { z0?: number; pTop?: number; pBot?: number; capR?: number } = {}) {
  const NS = sp.length;
  if (NS < 2) return;
  const z0 = o2.z0 ?? 0, pTop = o2.pTop ?? 2.1, pBot = o2.pBot ?? 2.7;
  const cum = new Float32Array(NS);
  for (let i = 1; i < NS; i++) cum[i] = cum[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
  const total = cum[NS - 1];
  // tabled profile
  const NP = Math.ceil(total) + 2;
  const pT = new Float32Array(NP), pB = new Float32Array(NP), pW = new Float32Array(NP);
  let Rmax = 0;
  for (let i = 0; i < NP; i++) { const q = prof(Math.min(i, total)); pT[i] = q[0]; pB[i] = q[1]; pW[i] = q[2]; Rmax = Math.max(Rmax, q[0], q[1]); }
  Rmax += 2;
  const pr = (s: number, a: Float32Array) => { const i = Math.max(0, Math.min(NP - 2, Math.floor(s))), f = s - i; return a[i] + (a[i + 1] - a[i]) * cl(f); };
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of sp) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const [i0, i1] = L.cols(x0 - Rmax, x1 + Rmax), [j0, j1] = L.rows(y0 - Rmax, y1 + Rmax);
  const ax = new Float32Array(NS), ay = new Float32Array(NS), dxs = new Float32Array(NS), dys = new Float32Array(NS), l2s = new Float32Array(NS);
  const sx0 = new Float32Array(NS), sx1 = new Float32Array(NS), sy0 = new Float32Array(NS), sy1 = new Float32Array(NS);
  for (let q = 1; q < NS; q++) {
    ax[q] = sp[q - 1][0]; ay[q] = sp[q - 1][1]; dxs[q] = sp[q][0] - sp[q - 1][0]; dys[q] = sp[q][1] - sp[q - 1][1]; l2s[q] = dxs[q] * dxs[q] + dys[q] * dys[q] || 1e-9;
    sx0[q] = Math.min(sp[q - 1][0], sp[q][0]) - Rmax; sx1[q] = Math.max(sp[q - 1][0], sp[q][0]) + Rmax;
    sy0[q] = Math.min(sp[q - 1][1], sp[q][1]) - Rmax; sy1[q] = Math.max(sp[q - 1][1], sp[q][1]) + Rmax;
  }
  const cand = new Int32Array(NS);
  const o: Tx = { z: 0, m: 0, t: 0 };
  for (let i = i0; i <= i1; i++) {
    const px = L.lx(i);
    let nc = 0;
    for (let q = 1; q < NS; q++) if (px >= sx0[q] && px <= sx1[q]) cand[nc++] = q;
    if (!nc) continue;
    for (let j = j0; j <= j1; j++) {
      const py = L.ly(j);
      let best = 1e18, bs = 0, bd = 0, bo = 0;
      for (let c = 0; c < nc; c++) {
        const q = cand[c];
        if (py < sy0[q] || py > sy1[q]) continue;
        const rx = px - ax[q], ry = py - ay[q];
        let k = (rx * dxs[q] + ry * dys[q]) / l2s[q];
        let over = 0;
        if (k < 0) { over = k; k = 0; } else if (k > 1) { over = k - 1; k = 1; }
        const ex = rx - dxs[q] * k, ey = ry - dys[q] * k;
        const d2 = ex * ex + ey * ey;
        if (d2 < best) {
          best = d2;
          const ll = Math.sqrt(l2s[q]);
          bs = cum[q - 1] + k * ll;
          bd = (ex * -dys[q] + ey * dxs[q]) / ll;
          bo = (q === 1 && over < 0) || (q === NS - 1 && over > 0) ? over * ll : 0;
        }
      }
      if (best > 1e17) continue;
      const top = pr(bs, pT), bot = pr(bs, pB), W = pr(bs, pW);
      const c = (bot - top) / 2, hg = Math.max(0.3, (bot + top) / 2);
      const v = (bd - c) / hg;
      let av = Math.abs(v);
      if (bo !== 0) av = Math.hypot(av, bo / (o2.capR ?? hg));
      if (av >= 1) continue;
      o.z = 0; o.m = 0; o.t = 0;
      tex(bs, bd, v, hg, o);
      if (!o.m) continue;
      const zz = W * se(av, v < 0 ? pTop : pBot);
      L.put(j * L.w + i, z0 + zz + o.z * Math.min(1, (1 - av) * 6), o.m, o.t, id, blend);
    }
  }
}

// ------------------------------------------------------------------ contours (one continuous outline per form)
/**
 * A centripetal Catmull-Rom spline through hand-placed landmarks, sampled densely (n points per span):
 * a smooth, continuous outline with no corners unless two landmarks coincide.
 */
export function spline(pts: V2[], closed: boolean, n = 6): V2[] {
  const N = pts.length;
  if (N < 3) return pts.slice();
  const out: V2[] = [];
  const P = (i: number): V2 => closed ? pts[((i % N) + N) % N] : i < 0 ? [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]] : i >= N ? [2 * pts[N - 1][0] - pts[N - 2][0], 2 * pts[N - 1][1] - pts[N - 2][1]] : pts[i];
  const spans = closed ? N : N - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const d01 = Math.pow(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), 0.5) || 1e-4;
    const d12 = Math.pow(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), 0.5) || 1e-4;
    const d23 = Math.pow(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]), 0.5) || 1e-4;
    // tangents (Barry-Goldman, centripetal)
    const m1x = (p2[0] - p1[0]) + d12 * ((p1[0] - p0[0]) / d01 - (p2[0] - p0[0]) / (d01 + d12));
    const m1y = (p2[1] - p1[1]) + d12 * ((p1[1] - p0[1]) / d01 - (p2[1] - p0[1]) / (d01 + d12));
    const m2x = (p2[0] - p1[0]) + d12 * ((p3[0] - p2[0]) / d23 - (p3[0] - p1[0]) / (d12 + d23));
    const m2y = (p2[1] - p1[1]) + d12 * ((p3[1] - p2[1]) / d23 - (p3[1] - p1[1]) / (d12 + d23));
    const steps = Math.max(1, Math.ceil(n * Math.min(3, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6 + 0.5)));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x, h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y]);
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}

/** 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher) in place over f[0..n). */
function edt1(f: Float32Array, n: number, d: Float32Array, v: Int32Array, z: Float32Array) {
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

/** Distance (px) from every inside cell of a w x h mask to the nearest outside cell. */
export function distField(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e10, n = Math.max(w, h);
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? INF : 0;
  const f = new Float32Array(n), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
  }
  return g;
}

/** Scanline fill of a closed polygon (even-odd) into a mask over a grid with origin (gx, gy) in local coords. */
export function fillPoly(mask: Uint8Array, w: number, h: number, gx: number, gy: number, pts: V2[], val = 1) {
  const N = pts.length, xs: number[] = [];
  for (let j = 0; j < h; j++) {
    const sy = gy + j + 0.5;
    xs.length = 0;
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[(i + 1) % N];
      if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - gx - 0.5)), xb = Math.min(w - 1, Math.floor(xs[k + 1] - gx - 0.5));
      for (let i = xa; i <= xb; i++) mask[j * w + i] = val;
    }
  }
}

export interface ShapeOpt {
  /** rounding radius (px): how far in from the edge the form keeps rising; a number or per pixel */
  R: number | ((x: number, y: number) => number);
  /** depth of the rounded rise as a fraction of R (1 = a round section, less = flatter) */
  hs?: number;
  /** base depth: a number or a plane / field over (x, y) */
  z0?: number | ((x: number, y: number) => number);
  id: number;
  blend?: number;
  /** material, lighting offset and displacement (px) at a pixel; d is its distance in from the edge */
  tex: (x: number, y: number, d: number, o: Tx) => void;
  /** extra contours that count as inside for the distance only (where the form runs on into another: no edge there) */
  soft?: V2[][];
  /** pixels below this local y are not drawn (the ground / mud line) */
  clipY?: number;
}

/**
 * One form from one continuous outline: the contour is filled, every inside pixel gets its distance in
 * from the edge, and the surface rises from the edge like a pillow (a quarter circle of radius R), so
 * the silhouette and the turn of the form both come from the drawn outline, never from primitives.
 * Anatomy (girdles, ribs, muscles, folds) goes on top as displacement from tex().
 */
export function shape(L: Lay, contour: V2[], o: ShapeOpt) {
  if (contour.length < 3) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of contour) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  if (o.soft) for (const c of o.soft) for (const q of c) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const gx = Math.floor(x0) - 2, gy = Math.floor(y0) - 2;
  const w = Math.ceil(x1) - gx + 3, h = Math.ceil(y1) - gy + 3;
  if (w <= 0 || h <= 0 || w * h > 600000) return;
  const mask = new Uint8Array(w * h);
  fillPoly(mask, w, h, gx, gy, contour, 2);
  if (o.soft) for (const c of o.soft) { const m2 = new Uint8Array(w * h); fillPoly(m2, w, h, gx, gy, c, 1); for (let i = 0; i < w * h; i++) if (m2[i] && !mask[i]) mask[i] = 1; }
  const dist = distField(mask, w, h);
  const hs = o.hs ?? 1, blend = o.blend ?? 0;
  const Rf = typeof o.R === 'number' ? null : o.R, R0 = typeof o.R === 'number' ? o.R : 0;
  const zf = typeof o.z0 === 'function' ? o.z0 : null, zc = typeof o.z0 === 'number' ? o.z0 : 0;
  const clipY = o.clipY ?? Infinity;
  const t: Tx = { z: 0, m: 0, t: 0, r: 0 };
  for (let j = 0; j < h; j++) {
    const ly = gy + j + 0.5;
    if (ly > clipY) continue;
    for (let i = 0; i < w; i++) {
      if (mask[j * w + i] !== 2) continue;
      const lx = gx + i + 0.5;
      const k = L.at(lx, ly);
      if (k < 0) continue;
      const d = dist[j * w + i] - 0.5;
      t.z = 0; t.m = 0; t.t = 0; t.r = 0;
      o.tex(lx, ly, d, t);
      if (!t.m) continue;
      const R = t.r ? t.r : Rf ? Rf(lx, ly) : R0;
      const tt = Math.min(1, Math.max(0, d) / R);
      const rise = R * hs * Math.sqrt(1 - (1 - tt) * (1 - tt));
      L.put(k, (zf ? zf(lx, ly) : zc) + rise + t.z * Math.min(1, (d + 0.5) / 2), t.m, t.t, o.id, blend);
    }
  }
}

/**
 * The outline of a limb (or any tapering appendage) from its joint chain: the chain is resampled, its
 * direction smoothed over the local width so the edges flow round the bends, and offset to each side
 * by half-widths keyed along it ([s 0..1, side A (+normal, left of travel in screen space), side B]).
 * Returns side A down the chain, then side B back up (open at the root, closed at the tip by the caller
 * or by tipCap points). Landmark keys put the muscle bellies, the elbow / knee / heel and the wrist.
 */
export function limbOutline(chain: V2[], widths: Keys, wB: Keys, tip: V2[] = [], n = 28): V2[] {
  const dense = chain.length > 2 ? spline(chain, false, 4) : chain;
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1] || 1e-6;
  const pAt = (s: number): V2 => {
    const d = cl(s) * total;
    let i = 1;
    while (i < dense.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [dense[i - 1][0] + (dense[i][0] - dense[i - 1][0]) * f, dense[i - 1][1] + (dense[i][1] - dense[i - 1][1]) * f];
  };
  const A: V2[] = [], B: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const wa = crv(widths, s), wb = crv(wB, s);
    const win = Math.max(wa, wb) / total * 0.9 + 0.02;
    const p = pAt(s), pa = pAt(s - win), pb = pAt(s + win);
    let tx = pb[0] - pa[0], ty = pb[1] - pa[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;
    A.push([p[0] + nx * wa, p[1] + ny * wa]);
    B.push([p[0] - nx * wb, p[1] - ny * wb]);
  }
  return [...A, ...tip, ...B.reverse()];
}

/** A curved body axis (listed tail to head): points and tangents by arc length, and the reverse map. */
export interface Axis {
  total: number;
  /** point at arc length s, unit tangent (toward the head) */
  at(s: number): { p: V2; tx: number; ty: number };
  /** a point at station s, offset d along the ventral normal (+ down for a right-facing animal) */
  pt(s: number, d: number): V2;
  /** the station and the signed ventral offset of a pixel (a reused pair: read it at once) */
  proj(x: number, y: number): [number, number];
}
export function axis(sp: V2[]): Axis {
  const N = sp.length;
  const cum = new Float32Array(N);
  for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
  const total = cum[N - 1];
  const out: [number, number] = [0, 0];
  const at = (s: number) => {
    let i = 1;
    while (i < N - 1 && cum[i] < s) i++;
    const a = sp[i - 1], b = sp[i], d = cum[i] - cum[i - 1] || 1e-6, f = (s - cum[i - 1]) / d;
    const tx = (b[0] - a[0]) / d, ty = (b[1] - a[1]) / d;
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as V2, tx, ty };
  };
  return {
    total, at,
    pt(s: number, d: number): V2 { const q = at(s); return [q.p[0] - q.ty * d, q.p[1] + q.tx * d]; },
    proj(x: number, y: number): [number, number] {
      let best = 1e18, bs = 0, bd = 0;
      for (let q = 1; q < N; q++) {
        const ax = sp[q - 1][0], ay = sp[q - 1][1], dx = sp[q][0] - ax, dy = sp[q][1] - ay, l2 = dx * dx + dy * dy || 1e-9;
        let k = ((x - ax) * dx + (y - ay) * dy) / l2;
        const kk = k < 0 ? 0 : k > 1 ? 1 : k;
        const ex = x - ax - dx * kk, ey = y - ay - dy * kk, d2 = ex * ex + ey * ey;
        if (d2 < best) {
          best = d2; const ll = Math.sqrt(l2);
          // beyond the ends, extrapolate the station so tips keep their texture
          if ((q === 1 && k < 0) || (q === N - 1 && k > 1)) { bs = cum[q - 1] + k * ll; } else { bs = cum[q - 1] + kk * ll; k = kk; }
          bd = ((x - ax - dx * k) * -dy + (y - ay - dy * k) * dx) / ll;
        }
      }
      out[0] = bs; out[1] = bd;
      return out;
    },
  };
}

/**
 * An outline around a body axis from landmark offsets: top keys [station, px above] run head to tail,
 * bottom keys [station, px below] tail to head (stations in px of arc length from the tail tip). The
 * points are joined by one closed spline.
 */
export function axisOutline(ax: Axis, top: [number, number][], bot: [number, number][], n = 5): V2[] {
  const pts: V2[] = [];
  for (const [s, d] of top) pts.push(ax.pt(s, -d));
  for (const [s, d] of bot) pts.push(ax.pt(s, d));
  return spline(pts, true, n);
}

/** Signed area of a closed contour (> 0: clockwise on screen, y down). */
export function area(pts: V2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

/**
 * Break a dense closed contour into tufts (fur, frills, ragged skin): where weight(p) > 0 the edge is
 * pushed out in a sawtooth of `per` px, `amp` px deep, each tuft leaning along the edge by `lean`
 * (+ toward the contour's direction of travel). Irregular per tuft.
 */
export function fringe(pts: V2[], weight: (p: V2) => number, amp: number, per: number, seed: number, lean = 0): V2[] {
  const N = pts.length;
  const sgn = area(pts) > 0 ? -1 : 1;
  const out: V2[] = [];
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const p = pts[i], a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    if (i > 0) acc += Math.hypot(p[0] - a[0], p[1] - a[1]);
    const w = weight(p);
    if (w <= 0) { out.push(p); continue; }
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    // outward normal
    const nx = -ty * sgn, ny = tx * sgn;
    const u = acc / per, cell = Math.floor(u), f = u - cell;
    const h = 0.6 + hash2(cell, 7, seed) * 0.8;
    const saw = f < 0.7 ? f / 0.7 : (1 - f) / 0.3; // slow rise to the tip, quick drop
    const o = amp * w * h * Math.pow(saw, 1.4);
    out.push([p[0] + nx * o + tx * lean * o, p[1] + ny * o + ty * lean * o]);
  }
  return out;
}

/** Resample a polyline / contour so no span is longer than `step` px (for fringes on long straight spans). */
export function densify(pts: V2[], step: number, closed = true): V2[] {
  const out: V2[] = [];
  const N = pts.length;
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n)]);
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}

// V9 organic contour painting on the beast sketch core (beasts-core Sk), used by the island's small
// life (the jewel hornet, the zombie-cap, the amber snail and its fluke, the Trycop crab).
//
// A shape is never a primitive: its outline is ONE continuous contour, a Catmull-Rom spline sampled
// densely through anatomical landmarks (landmarks flagged sharp stay crisp: tooth tips, spines,
// claw points), or a strip swept along a curved path with its own upper and lower width profiles
// (limb segments, antennae, stalks, tentacles). Inside, a height field is built from the distance
// to that contour (a rounded bevel plus a dome over the whole mass) or from a creature's own surface
// function (a whorled shell, a telescoped abdomen), plus landmark bumps and grooves (crease lines,
// sutures, segment seams), and lit from its own finite-difference normals. The fill callback picks
// the material per pixel (the region's colour, pattern and texture) and the result goes into the
// sketch G-buffer, which gives the palette ramps, the depth edges between parts and the outline.

import { Sk, lumN } from '../../beasts-core';
import type { V2 } from '../../beasts-core';

/** a landmark: [x, y] or [x, y, 1] for a sharp corner */
export type LP = [number, number] | [number, number, number];

/** Catmull-Rom through landmarks, `per` samples per span; spans touching a sharp landmark stay straight */
export function spline(pts: LP[], closed: boolean, per = 6): V2[] {
  const n = pts.length;
  const out: V2[] = [];
  if (n < 2) return pts.map(p => [p[0], p[1]] as V2);
  const g = (i: number) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const sharp = p1[2] === 1 || p2[2] === 1;
    for (let j = 0; j < per; j++) {
      const t = j / per;
      if (sharp) { out.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]); continue; }
      const t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

/** resample an open path to `n` points evenly spaced by arc length */
export function resample(path: V2[], n: number): V2[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const L = cum[cum.length - 1] || 1e-6;
  const out: V2[] = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * L;
    while (j < path.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
    out.push([path[j - 1][0] + (path[j][0] - path[j - 1][0]) * t, path[j - 1][1] + (path[j][1] - path[j - 1][1]) * t]);
  }
  return out;
}

export interface StripOpt {
  /** samples along the path (default from its length) */
  n?: number;
  /** round the ends (0 = flat cut, 1 = full half-round) */
  capA?: number;
  capB?: number;
  /** sharp spines along one edge: side +1 upper (left of travel), -1 lower; t positions; length (px) */
  spines?: { side: 1 | -1; at: number[]; len: number; lean?: number };
}
/**
 * The closed contour of a strip swept along `path`: wUp(t) to the left of travel, wDn(t) to the right
 * (px), with rounded or flat ends and optional spines. Limb segments, antennae, stalks, tentacles.
 */
export function strip(path: V2[], wUp: (t: number) => number, wDn: (t: number) => number, o: StripOpt = {}): V2[] {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  const n = Math.max(4, o.n ?? Math.ceil(L * 0.8) + 6);
  const P = resample(path, n);
  const up: V2[] = [], dn: V2[] = [];
  const nrm = (i: number): V2 => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l]; // left of travel (screen y down)
  };
  const spine = (t: number) => {
    const S = o.spines;
    if (!S) return 0;
    let best = 0;
    const hw = 0.6 / n;
    for (const a of S.at) { const d = Math.abs(t - a); if (d < hw * 2.2) best = Math.max(best, S.len * (1 - d / (hw * 2.2))); }
    return best;
  };
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [nx, ny] = nrm(i);
    const sU = o.spines && o.spines.side === 1 ? spine(t) : 0, sD = o.spines && o.spines.side === -1 ? spine(t) : 0;
    const lean = (o.spines?.lean ?? 0.5) * Math.max(sU, sD);
    const dx = (P[Math.min(n - 1, i + 1)][0] - P[Math.max(0, i - 1)][0]), dy = (P[Math.min(n - 1, i + 1)][1] - P[Math.max(0, i - 1)][1]);
    const dl = Math.hypot(dx, dy) || 1;
    const fx = (dx / dl) * lean, fy = (dy / dl) * lean;
    const a = wUp(t) + sU, b = wDn(t) + sD;
    up.push([P[i][0] + nx * a + (sU ? fx : 0), P[i][1] + ny * a + (sU ? fy : 0)]);
    dn.push([P[i][0] - nx * b + (sD ? fx : 0), P[i][1] - ny * b + (sD ? fy : 0)]);
  }
  const out: V2[] = [...up];
  // tip end: centre P[n-1], bulge forward along the travel direction
  {
    const c = P[n - 1], d = P[n - 2];
    const dx = c[0] - d[0], dy = c[1] - d[1], l = Math.hypot(dx, dy) || 1;
    const k = o.capB ?? 1;
    const ww = (wUp(1) + wDn(1)) * 0.5;
    const from = up[n - 1], to = dn[n - 1];
    for (let j = 1; j < 6; j++) {
      const t = j / 6;
      const bx = from[0] + (to[0] - from[0]) * t, by = from[1] + (to[1] - from[1]) * t;
      const s = Math.sin(t * Math.PI) * k * ww;
      out.push([bx + (dx / l) * s, by + (dy / l) * s]);
    }
  }
  for (let i = n - 1; i >= 0; i--) out.push(dn[i]);
  {
    const c = P[0], d = P[1];
    const dx = c[0] - d[0], dy = c[1] - d[1], l = Math.hypot(dx, dy) || 1;
    const k = o.capA ?? 1;
    const ww = (wUp(0) + wDn(0)) * 0.5;
    const from = dn[0], to = up[0];
    for (let j = 1; j < 6; j++) {
      const t = j / 6;
      const bx = from[0] + (to[0] - from[0]) * t, by = from[1] + (to[1] - from[1]) * t;
      const s = Math.sin(t * Math.PI) * k * ww;
      out.push([bx + (dx / l) * s, by + (dy / l) * s]);
    }
  }
  return out;
}

/** per-pixel input of a Field fill */
export interface FP {
  /** local coords of the pixel centre */
  x: number; y: number;
  /** distance to the contour (px), the height, the normal (screen space, z toward the viewer) */
  d: number; h: number; nx: number; ny: number; nz: number;
  /** lighting 0..1 (writable) */
  l: number;
}

export interface FieldOpt {
  /** bevel radius (px): how far in from the contour the edge rounds over */
  round?: number;
  /** extra height over the whole mass (px at the deepest point) */
  dome?: number;
  /** custom height (replaces bevel + dome); d = distance to the contour, dm = the field's max distance */
  hf?: (x: number, y: number, d: number, dm: number) => number;
}

/**
 * A height field over the inside of one or more closed contours (even-odd, so a contour inside
 * another cuts a hole). Grid-aligned with the sketch's pixels.
 */
export class Field {
  readonly ix0: number; readonly iy0: number; readonly w: number; readonly h: number;
  readonly ins: Uint8Array; readonly dist: Float32Array; readonly ht: Float32Array;
  dmax = 0;
  readonly empty: boolean;
  constructor(readonly sk: Sk, polys: V2[][], o: FieldOpt = {}) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of polys) for (const q of p) { minx = Math.min(minx, q[0]); maxx = Math.max(maxx, q[0]); miny = Math.min(miny, q[1]); maxy = Math.max(maxy, q[1]); }
    const ix0 = Math.max(0, Math.floor(minx + sk.ox)), ix1 = Math.min(sk.w - 1, Math.ceil(maxx + sk.ox));
    const iy0 = Math.max(0, Math.floor(miny + sk.oy)), iy1 = Math.min(sk.h - 1, Math.ceil(maxy + sk.oy));
    this.ix0 = ix0; this.iy0 = iy0;
    this.w = Math.max(0, ix1 - ix0 + 1); this.h = Math.max(0, iy1 - iy0 + 1);
    const N = this.w * this.h;
    this.ins = new Uint8Array(N); this.dist = new Float32Array(N); this.ht = new Float32Array(N);
    this.empty = N === 0 || !Number.isFinite(minx);
    if (this.empty) return;
    // scanline inside test (even-odd over every edge of every contour)
    const xs: number[] = [];
    for (let j = 0; j < this.h; j++) {
      const sy = j + iy0 - sk.oy + 0.5;
      xs.length = 0;
      for (const p of polys) {
        const m = p.length;
        for (let i = 0; i < m; i++) {
          const a = p[i], b = p[(i + 1) % m];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const xa = Math.max(0, Math.ceil(xs[q] + sk.ox - 0.5) - ix0), xb = Math.min(this.w - 1, Math.floor(xs[q + 1] + sk.ox - 0.5) - ix0);
        for (let i = xa; i <= xb; i++) this.ins[j * this.w + i] = 1;
      }
    }
    // distance to the contour: exact for small shapes; a two-pass chamfer transform for big ones
    const segs: number[] = [];
    for (const p of polys) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; segs.push(a[0], a[1], b[0], b[1]); }
    let nIn = 0;
    for (let i = 0; i < N; i++) nIn += this.ins[i];
    let dm = 0;
    if (nIn * (segs.length / 4) <= 40000) {
      for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
        const id = j * this.w + i;
        if (!this.ins[id]) continue;
        const px = i + ix0 - sk.ox + 0.5, py = j + iy0 - sk.oy + 0.5;
        let best = Infinity;
        for (let s = 0; s < segs.length; s += 4) {
          const ax = segs[s], ay = segs[s + 1], sx = segs[s + 2] - ax, sy = segs[s + 3] - ay;
          const L2 = sx * sx + sy * sy;
          let t = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = px - ax - sx * t, dy = py - ay - sy * t;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) best = d2;
        }
        const d = Math.sqrt(best);
        this.dist[id] = d;
        if (d > dm) dm = d;
      }
    } else {
      const W = this.w, H = this.h, D = this.dist, I = this.ins;
      const R2 = Math.SQRT2;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const id = j * W + i;
        if (!I[id]) continue;
        const edge = i === 0 || j === 0 || i === W - 1 || j === H - 1 || !I[id - 1] || !I[id + 1] || !I[id - W] || !I[id + W];
        D[id] = edge ? 0.5 : 1e9;
      }
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const id = j * W + i;
        if (!I[id] || D[id] <= 0.5) continue;
        let d = D[id];
        if (i > 0) d = Math.min(d, D[id - 1] + 1);
        if (j > 0) { d = Math.min(d, D[id - W] + 1); if (i > 0) d = Math.min(d, D[id - W - 1] + R2); if (i < W - 1) d = Math.min(d, D[id - W + 1] + R2); }
        D[id] = d;
      }
      for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
        const id = j * W + i;
        if (!I[id]) continue;
        let d = D[id];
        if (i < W - 1) d = Math.min(d, D[id + 1] + 1);
        if (j < H - 1) { d = Math.min(d, D[id + W] + 1); if (i < W - 1) d = Math.min(d, D[id + W + 1] + R2); if (i > 0) d = Math.min(d, D[id + W - 1] + R2); }
        D[id] = d;
        if (d > dm) dm = d;
      }
    }
    this.dmax = dm;
    const R = Math.max(0.5, o.round ?? 2), dome = o.dome ?? dm * 0.5;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const id = j * this.w + i;
      if (!this.ins[id]) continue;
      const d = this.dist[id];
      if (o.hf) { this.ht[id] = o.hf(i + ix0 - sk.ox + 0.5, j + iy0 - sk.oy + 0.5, d, dm); continue; }
      const q = Math.min(1, d / R);
      const e = dm > 0 ? Math.min(1, d / dm) : 0;
      this.ht[id] = R * Math.sqrt(1 - (1 - q) * (1 - q)) + dome * (1 - (1 - e) * (1 - e));
    }
  }
  /** add a function to the height (bumps, ridges, textures as displacement) */
  add(fn: (x: number, y: number, d: number) => number) {
    if (this.empty) return;
    const sk = this.sk;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const id = j * this.w + i;
      if (this.ins[id]) this.ht[id] += fn(i + this.ix0 - sk.ox + 0.5, j + this.iy0 - sk.oy + 0.5, this.dist[id]);
    }
  }
  /** a soft round bump (amp px, negative = a dent) */
  bump(cx: number, cy: number, rx: number, ry: number, amp: number) {
    this.add((x, y) => { const u = (x - cx) / rx, v = (y - cy) / ry, q = u * u + v * v; return q < 4 ? amp * Math.exp(-q * 1.6) : 0; });
  }
  /** a groove (amp < 0) or ridge (amp > 0) of half-width w along a polyline: crease lines, sutures, seams */
  groove(path: V2[], w: number, amp: number) {
    if (path.length < 2) return;
    this.add((x, y) => {
      let best = Infinity;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy;
        let t = L2 > 0 ? ((x - a[0]) * sx + (y - a[1]) * sy) / L2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = x - a[0] - sx * t, dy = y - a[1] - sy * t;
        best = Math.min(best, dx * dx + dy * dy);
      }
      const q = best / (w * w);
      return q < 4 ? amp * Math.exp(-q * 1.4) : 0;
    });
  }
  inside(x: number, y: number) {
    const i = Math.floor(x + this.sk.ox) - this.ix0, j = Math.floor(y + this.sk.oy) - this.iy0;
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.ins[j * this.w + i] === 1;
  }
  heightAt(x: number, y: number) {
    const i = Math.floor(x + this.sk.ox) - this.ix0, j = Math.floor(y + this.sk.oy) - this.iy0;
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.ins[j * this.w + i] ? this.ht[j * this.w + i] : 0;
  }
  /**
   * Light the field from its own normals and write it into the sketch (the current part).
   * z: depth of the base plane; zk: how much the height adds to depth; spec: wet / glossy highlight.
   */
  emit(fill: (p: FP) => number, o: { z: number; zk?: number; bias?: number; spec?: number; specPow?: number; slope?: number }) {
    if (this.empty) return;
    const sk = this.sk, W = this.w, H = this.h, ht = this.ht, ins = this.ins;
    const zk = o.zk ?? 1, bias = o.bias ?? 0, spec = o.spec ?? 0, sp = o.specPow ?? 18, slope = o.slope ?? 1;
    const p: FP = { x: 0, y: 0, d: 0, h: 0, nx: 0, ny: 0, nz: 1, l: 0.5 };
    const at = (i: number, j: number, fb: number) => (i >= 0 && j >= 0 && i < W && j < H && ins[j * W + i] ? ht[j * W + i] : fb);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const id = j * W + i;
      if (!ins[id]) continue;
      const h0 = ht[id];
      const edgeFb = Math.min(h0, 0) - 0.6;
      const gx = (at(i + 1, j, edgeFb) - at(i - 1, j, edgeFb)) * 0.5 * slope;
      const gy = (at(i, j + 1, edgeFb) - at(i, j - 1, edgeFb)) * 0.5 * slope;
      let nx = -gx, ny = -gy, nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      p.x = i + this.ix0 - sk.ox + 0.5; p.y = j + this.iy0 - sk.oy + 0.5;
      p.d = this.dist[id]; p.h = h0; p.nx = nx; p.ny = ny; p.nz = nz;
      p.l = lumN(nx, ny, nz) + bias;
      if (spec > 0) {
        // half vector of the key light (top-left-front) and the view
        const hd = nx * -0.29 + ny * -0.41 + nz * 0.86;
        if (hd > 0) p.l += Math.pow(hd, sp) * spec;
      }
      const m = fill(p);
      if (m > 0) sk.dot(p.x, p.y, m, p.l, o.z + h0 * zk);
    }
  }
}

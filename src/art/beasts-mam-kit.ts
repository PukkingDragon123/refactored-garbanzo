// Shared helpers for the small-mammal painters of batch MAM (shieldback, quillhog, delver, sail possum,
// flicker marten): a curved spine to hang a body contour on, imbricate armour scales, fur strands,
// hooked claws and dirt, all on the Relief layer (beasts-relief.ts).

import { Sk, V2, hh } from './beasts-core';
import { Relief, LM, spline, strands, FS } from './beasts-relief';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A curve through a polyline (a spine from the rump, t = 0, to the withers, t = 1; or a tail's
 * centreline). P(t, off) is a landmark `off` px to the dorsal side (the left-hand normal of travel: up
 * for a body facing right).
 */
export class Curve {
  readonly cum: number[] = [0];
  readonly total: number;
  constructor(readonly pts: V2[]) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.total = this.cum[pts.length - 1] || 1e-6;
  }
  /** a cubic bezier a -> b (controls c1, c2) sampled into n segments */
  static bez(a: V2, c1: V2, c2: V2, b: V2, n = 24) {
    const pts: V2[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([
        u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
        u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
      ]);
    }
    return new Curve(pts);
  }
  /** point, unit tangent and dorsal normal at t (by arc length; t may run a little past 0..1) */
  at(t: number): { p: V2; u: V2; n: V2 } {
    const n = this.pts.length - 1;
    const d = t * this.total;
    let i = 1;
    while (i < n && this.cum[i] < d) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const sl = this.cum[i] - this.cum[i - 1] || 1e-6;
    const k = (d - this.cum[i - 1]) / sl;
    const ux = (b[0] - a[0]) / sl, uy = (b[1] - a[1]) / sl;
    return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], u: [ux, uy], n: [uy, -ux] };
  }
  P(t: number, off: number, sh = 0): LM {
    const q = this.at(t);
    return [q.p[0] + q.n[0] * off, q.p[1] + q.n[1] * off, sh];
  }
  V(t: number, off: number): V2 {
    const q = this.at(t);
    return [q.p[0] + q.n[0] * off, q.p[1] + q.n[1] * off];
  }
  /** nearest spine parameter t and signed dorsal offset of a point (coarse, from the samples) */
  project(x: number, y: number): [number, number] {
    let best = Infinity, bt = 0, bo = 0;
    const n = this.pts.length - 1;
    for (let i = 1; i <= n; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy || 1e-6;
      let k = ((x - a[0]) * sx + (y - a[1]) * sy) / L2;
      k = k < 0 ? (i === 1 ? k : 0) : k > 1 ? (i === n ? k : 1) : k;
      const qx = a[0] + sx * k, qy = a[1] + sy * k, d2 = (x - qx) ** 2 + (y - qy) ** 2;
      if (d2 < best) {
        best = d2;
        const L = Math.sqrt(L2);
        bt = (this.cum[i - 1] + k * L) / this.total;
        bo = ((x - qx) * (sy / L) + (y - qy) * (-sx / L));
      }
    }
    return [bt, bo];
  }
}

/**
 * A closed contour round a centreline (a tail, a neck): up its left side (half width wl(t)), round the
 * end, and back down its right side (wr(t)). `tipSharp` sharpens the far end.
 */
export function ribbon(pts: V2[], wl: (t: number) => number, wr: (t: number) => number, tipSharp = 0.4, baseSharp = 0): LM[] {
  const n = pts.length;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = cum[n - 1] || 1e-6;
  const L: LM[] = [], Rr: LM[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l, t = cum[i] / T;
    L.push([pts[i][0] + nx * wl(t), pts[i][1] + ny * wl(t), i === 0 ? baseSharp : 0]);
    Rr.push([pts[i][0] - nx * wr(t), pts[i][1] - ny * wr(t), i === 0 ? baseSharp : 0]);
  }
  const e = pts[n - 1], d = pts[n - 2];
  const ex = e[0] - d[0], ey = e[1] - d[1], el = Math.hypot(ex, ey) || 1;
  const tipW = (wl(1) + wr(1)) * 0.5;
  const tip: LM = [e[0] + (ex / el) * Math.max(0.4, tipW), e[1] + (ey / el) * Math.max(0.4, tipW), tipSharp];
  return [...L, tip, ...Rr.reverse()];
}

/** world -> frame-local coordinates for a Frame2-like (origin o, angle a, scale k) */
export function localOf(o: V2, a: number, k: number) {
  const c = Math.cos(-a), s = Math.sin(-a);
  return (x: number, y: number): V2 => {
    const dx = (x - o[0]) / k, dy = (y - o[1]) / k;
    return [dx * c - dy * s, dx * s + dy * c];
  };
}

// ------------------------------------------------------------------ imbricate armour
/**
 * Overlapping scales (a pangolin's armour): bands across the body (boundaries `bands`, increasing
 * toward the head), each band a row of scales `sh` px tall, staggered by half a scale per band. Every
 * scale's free edge is a rounded point reaching `tip` px back over the band behind it. For a pixel at
 * band coordinate X (toward the head) and row coordinate Y it reports which scale it lies on, how far
 * it is from that scale's free edge (d, px), across the scale (v, -0.5..0.5), and whether it sits in the
 * crevice just in front of the next scale's free edge.
 */
export const IMB = { i: 0, j: 0, d: 0, v: 0, crev: 0, bw: 1, hash: 0 };
export function imbricate(X: number, Y: number, bands: number[], sh: number, tip: number, seed = 0) {
  const nb = bands.length;
  const W0 = bands[1] - bands[0], W1 = bands[nb - 1] - bands[nb - 2];
  const Bb = (b: number) => (b < 0 ? bands[0] + b * W0 : b >= nb ? bands[nb - 1] + (b - nb + 1) * W1 : bands[b]);
  const edge = (b: number): [number, number, number] => {
    const yy = Y / sh + (b & 1) * 0.5;
    const j = Math.floor(yy), v = yy - j - 0.5;
    return [Bb(b) - tip * (1 - 4 * v * v), j, v];
  };
  let i = -1;
  while (i < nb && X >= Bb(i + 1)) i++;
  // the pixel lies on the most anterior scale whose free edge is behind it
  const reach = Math.ceil(tip / Math.max(0.5, Math.min(W0, W1))) + 1;
  let b = i + reach;
  let e = edge(b);
  while (b > i - 1 && X < e[0]) { b--; e = edge(b); }
  const front = edge(b + 1);
  IMB.i = b; IMB.j = e[1]; IMB.v = e[2];
  IMB.d = X - e[0];
  IMB.crev = front[0] - X;
  IMB.bw = Math.max(0.5, IMB.d + IMB.crev);
  IMB.hash = hh(IMB.i + 50, IMB.j + 50, seed);
  return IMB;
}

// ------------------------------------------------------------------ fur
/** fur strands height (-0.5..0.5) lying along `ang`; FS.tip / FS.row / FS.seg describe the strand */
export const fur = (x: number, y: number, ang: number, len: number, wid: number, seed: number) => strands(x, y, ang, len, wid, seed);
export { FS };

// ------------------------------------------------------------------ claws
/**
 * A hooked claw from base b along direction a (rad), len long, wid wide at the root, curling `curl`
 * rad over its length (positive turns clockwise on screen, i.e. down for a claw pointing right).
 */
export function claw(R: Relief, b: V2, a: number, len: number, wid: number, curl: number, z: number, id: number, tex: number | ((u: number) => number)) {
  const pts: LM[] = [];
  const side: V2[] = [];
  const N = 4;
  let x = b[0], y = b[1], ang = a;
  const spine: V2[] = [[x, y]];
  for (let i = 0; i < N; i++) {
    ang += curl / N;
    x += Math.cos(ang) * len / N; y += Math.sin(ang) * len / N;
    spine.push([x, y]);
  }
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = wid * (1 - t * 0.85) * 0.5;
    const p = spine[i], q = spine[Math.min(N, i + 1)], r = spine[Math.max(0, i - 1)];
    const dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1;
    side.push([-dy / l * w, dx / l * w]);
    pts.push([p[0] + side[i][0], p[1] + side[i][1], i === N ? 0.8 : 0]);
  }
  for (let i = N; i >= 0; i--) pts.push([spine[i][0] - side[i][0] * 0.8, spine[i][1] - side[i][1] * 0.8, i === N ? 0.8 : 0]);
  const L = len;
  R.region(spline(pts, 0.35), { z, R: Math.max(0.5, wid * 0.4), H: Math.max(0.6, wid * 0.5), id, tex: typeof tex === 'number' ? tex : (p, o) => { o.m = tex(Math.hypot(p.x - b[0], p.y - b[1]) / L); } });
  return spine[N];
}

// ------------------------------------------------------------------ dirt
/** a crumb of soil as a hand-placed pixel cluster (2 tones), never a disc */
const CRUMBS: number[][][] = [
  [[0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 1], [1, 0, 0], [-1, 1, 1], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 1], [0, 1, 0]],
  [[1, 0, 1], [0, 1, 1], [1, 1, 0], [2, 1, 0], [1, 2, 0]],
  [[0, 0, 0]],
];
export function crumb(sk: Sk, x: number, y: number, kind: number, light: number, dark: number, z = 40) {
  const c = CRUMBS[kind % CRUMBS.length];
  for (const [dx, dy, l] of c) sk.dot(Math.floor(x) + dx + 0.5, Math.floor(y) + dy + 0.5, l ? light : dark, l ? 0.62 : 0.38, z, true);
}
/** a heap of loose earth: an irregular mound contour, lumpy, with crumbs on its slope */
export function mound(R: Relief, cx: number, w: number, h: number, seed: number, z: number, id: number, mLight: number, mDark: number) {
  const pts: LM[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = cx - w + 2 * w * t;
    const top = -h * Math.pow(Math.sin(t * Math.PI), 0.8) * (0.8 + hh(i, 3, seed) * 0.4);
    pts.push([x, Math.min(-0.2, top), 0.15]);
  }
  pts.push([cx + w, 0.6, 0.5], [cx - w, 0.6, 0.5]);
  R.region(spline(pts, 0.5), { z, R: Math.max(1, h * 0.8), H: h * 0.9, id, tex: (p, o) => {
    const g = hh(Math.floor(p.x * 0.7), Math.floor(p.y * 0.9), seed + 7);
    o.m = g < 0.35 ? mDark : mLight;
    o.z += (g - 0.5) * 0.9;
  } });
}

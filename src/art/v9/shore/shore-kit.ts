// Shared helpers for the island shore painters (seal, leech, crab, skink, octopus, starweb, and the
// arc's wheke): projecting a pixel onto a body's centreline (so textures follow the anatomy: annuli,
// scale rows, sucker rows), hand-placed pixel clusters, and a few small contour builders. The
// contours themselves go through the shared toolkits (beasts-relief Relief.region, v9/wild/contour
// Field / strip), which do the masks, the height fields and the lighting.

import type { Sk, V2 } from '../../beasts-core';
import type { C } from '../../color';

/** where a point lies against a polyline: t 0..1 along it, s arc length (px), c signed offset (+ left of travel) */
export interface OnPath { t: number; s: number; c: number; ax: number; ay: number }
const OP: OnPath = { t: 0, s: 0, c: 0, ax: 1, ay: 0 };

/** arc lengths of a polyline (cumulative) */
export function arcs(path: V2[]): Float32Array {
  const cum = new Float32Array(path.length);
  for (let i = 1; i < path.length; i++) cum[i] = cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return cum;
}

/** project (x, y) onto the polyline (cum from arcs()); the result object is reused */
export function onPath(path: V2[], cum: Float32Array, x: number, y: number): OnPath {
  let best = Infinity;
  const n = path.length, total = cum[n - 1] || 1e-6;
  for (let i = 1; i < n; i++) {
    const ax = path[i - 1][0], ay = path[i - 1][1], sx = path[i][0] - ax, sy = path[i][1] - ay;
    const L2 = sx * sx + sy * sy;
    let k = L2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / L2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const qx = ax + sx * k, qy = ay + sy * k, d2 = (x - qx) ** 2 + (y - qy) ** 2;
    if (d2 < best) {
      best = d2;
      const L = Math.sqrt(L2) || 1;
      OP.s = cum[i - 1] + (cum[i] - cum[i - 1]) * k;
      // left of travel in screen space (y down) is (dy, -dx)
      const side = sx * (y - qy) - sy * (x - qx) > 0 ? -1 : 1;
      OP.c = side * Math.sqrt(d2);
      OP.ax = sx / L; OP.ay = sy / L;
    }
  }
  OP.t = OP.s / total;
  return OP;
}

/** a point at arc fraction t along a polyline, offset c px to the left of travel */
export function atPath(path: V2[], cum: Float32Array, t: number, c = 0): V2 {
  const n = path.length, s = Math.max(0, Math.min(1, t)) * cum[n - 1];
  let i = 1;
  while (i < n - 1 && cum[i] < s) i++;
  const a = path[i - 1], b = path[i], seg = cum[i] - cum[i - 1] || 1e-6, k = (s - cum[i - 1]) / seg;
  const dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
  return [a[0] + (b[0] - a[0]) * k + dy * c, a[1] + (b[1] - a[1]) * k - dx * c];
}

/** the direction (radians) of the polyline at arc fraction t */
export function angPath(path: V2[], cum: Float32Array, t: number): number {
  const n = path.length, s = Math.max(0, Math.min(1, t)) * cum[n - 1];
  let i = 1;
  while (i < n - 1 && cum[i] < s) i++;
  return Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]);
}

/**
 * Stamp a hand-placed pixel cluster as overlay pixels. rows are strings, one char per pixel; '.' or
 * ' ' is skipped and every other char is a key into pal. (x, y) is where the cluster's (ax, ay) cell
 * lands; flip mirrors it horizontally; onlyOpaque keeps it inside the sprite already drawn.
 */
export function stamp(sk: Sk, x: number, y: number, rows: string[], pal: Record<string, C>, o: { ax?: number; ay?: number; flip?: boolean; onlyOpaque?: boolean } = {}) {
  const ax = o.ax ?? 0, ay = o.ay ?? 0;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c === undefined) continue;
      const dx = o.flip ? -(i - ax) : i - ax;
      if (o.onlyOpaque) sk.overPaint(Math.floor(x) + dx, Math.floor(y) + j - ay, c);
      else sk.over(Math.floor(x) + dx, Math.floor(y) + j - ay, c);
    }
  }
}

/** Bresenham-ish run of overlay pixels from a to b (inclusive) */
export function ovLine(sk: Sk, a: V2, b: V2, c: C | ((i: number, n: number) => C | 0), onlyOpaque = false) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) {
    const col = typeof c === 'function' ? c(i, n) : c;
    if (!col) continue;
    const x = a[0] + (b[0] - a[0]) * (i / n), y = a[1] + (b[1] - a[1]) * (i / n);
    if (onlyOpaque) sk.overPaint(x, y, col); else sk.over(x, y, col);
  }
}

/** G-buffer run of dots (material m, light l, depth z) from a to b */
export function dotLine(sk: Sk, a: V2, b: V2, m: number, l: number | ((i: number, n: number) => number), z: number) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) sk.dot(a[0] + (b[0] - a[0]) * (i / n), a[1] + (b[1] - a[1]) * (i / n), m, typeof l === 'function' ? l(i, n) : l, z);
}

/** smoothstep-free clamp */
export const cl01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** fractional part */
export const frac = (v: number) => v - Math.floor(v);

/**
 * Repaint already drawn sprite pixels from a hand-placed map (material per char, optional light
 * offset per char), keeping their depth and lighting: organs seen through a shell, markings, scutes.
 */
export function paintMap(sk: Sk, x: number, y: number, rows: string[], mats: Record<string, [number, number]>, o: { ax?: number; ay?: number; flip?: boolean; part?: number } = {}) {
  const ax = o.ax ?? 0, ay = o.ay ?? 0;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const e = mats[r[i]];
      if (!e) continue;
      const dx = o.flip ? -(i - ax) : i - ax;
      sk.paint(Math.floor(x) + dx + 0.5, Math.floor(y) + j - ay + 0.5, e[0], e[1], o.part ?? 0);
    }
  }
}

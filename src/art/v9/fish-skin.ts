// Skin helpers for the V9 fishing catches (./fish.ts): geometry, ordered dither, smooth value noise
// for organic blotches, and the overlapping-scale lattice that every scaled fish is textured with.

export type Pt = [number, number];
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const frac = (v: number) => v - Math.floor(v);
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const hash = (x: number, y: number, s = 0) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s + 1, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 4x4 ordered dither threshold in output pixels, 0..1 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bay = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

/** smooth value noise (0..1) on a unit lattice */
export function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** two octaves of value noise, 0..1 */
export const fbm = (x: number, y: number, s = 0) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.3 + 7.1, y * 2.3 - 3.7, s + 9) * 0.35;

/** monotone cubic through points sorted by x (Fritsch-Carlson); NaN outside the range */
export function curve(pts: Pt[]): (x: number) => number {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x: number) => {
    if (x < xs[0] || x > xs[n - 1]) return NaN;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
export function inPoly(p: Pt[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** distance from (x, y) to segment a-b and the parameter of the closest point */
export function segDist(x: number, y: number, a: Pt, b: Pt): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp01(((x - a[0]) * dx + (y - a[1]) * dy) / l2);
  return [Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t), t];
}
export function polyEdgeDist(p: Pt[], x: number, y: number) {
  let m = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) m = Math.min(m, segDist(x, y, p[j], p[i])[0]);
  return m;
}
/** a point at arc-length fraction s along a polyline */
export function along(path: Pt[], s: number): Pt {
  let tot = 0;
  const L: number[] = [];
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); L.push(l); tot += l; }
  let r = clamp01(s) * tot;
  for (let i = 0; i < L.length; i++) {
    if (r <= L[i] || i === L.length - 1) { const t = L[i] ? Math.min(1, r / L[i]) : 0; return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]; }
    r -= L[i];
  }
  return path[path.length - 1];
}
/** cumulative integral of f over [x0, x1] as a lookup (clamped) */
export function cumTable(f: (x: number) => number, x0: number, x1: number, n = 96): (x: number) => number {
  const tab = new Float64Array(n + 1), dx = (x1 - x0) / n;
  for (let i = 1; i <= n; i++) tab[i] = tab[i - 1] + (f(x0 + (i - 0.5) * dx)) * dx;
  return (x: number) => {
    const k = (x - x0) / dx;
    if (k <= 0) return 0;
    if (k >= n) return tab[n];
    const i = Math.floor(k);
    return tab[i] + (tab[i + 1] - tab[i]) * (k - i);
  };
}

// ------------------------------------------------------------------ the scale lattice
/** the visible scale at a point of a staggered lattice of overlapping round scales. cx runs along the
 *  body toward the head (one unit per scale column), cy across it (one unit per row, odd rows shifted
 *  half a scale). Each scale is a disc a bit bigger than its cell; where they overlap the one nearer
 *  the head lies on top, so only each scale's free back edge shows, as on a real fish. */
export interface ScaleHit { i: number; j: number; d: number; dx: number; dy: number }
const SC: ScaleHit = { i: 0, j: 0, d: 0, dx: 0, dy: 0 };
export function scaleHit(cx: number, cy: number, rx = 0.74, ry = 0.66): ScaleHit {
  const j0 = Math.floor(cy);
  let bx = -Infinity, bd = 9;
  SC.d = 1; SC.dx = 0; SC.dy = 0; SC.i = 0; SC.j = j0;
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    const o = j & 1 ? 0.5 : 0, dy = (cy - j - 0.5) / ry;
    if (dy <= -1 || dy >= 1) continue;
    const i0 = Math.floor(cx - o);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      const xc = i + 0.5 + o, dx = (cx - xc) / rx, d = dx * dx + dy * dy;
      if (d >= 1) continue;
      if (xc > bx + 1e-6 || (Math.abs(xc - bx) < 1e-6 && d < bd)) { bx = xc; bd = d; SC.i = i; SC.j = j; SC.d = Math.sqrt(d); SC.dx = dx; SC.dy = dy; }
    }
  }
  return SC;
}

// ------------------------------------------------------------------ pattern helpers
/** jittered round spots on a lattice of k cells per unit (fish units, so spots stay round); dens is
 *  the share of cells with a spot, rad the radius. Returns 0 outside, else 1 at the centre .. 0 at the edge */
export function spot(x: number, y: number, k: number, dens: number, rad: number, seed: number): number {
  const X = x * k, Y = y * k, xi = Math.floor(X), yi = Math.floor(Y);
  let best = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    if (hash(cx, cy, seed) > dens) continue;
    const ox = cx + 0.2 + hash(cx, cy, seed + 1) * 0.6, oy = cy + 0.2 + hash(cx, cy, seed + 2) * 0.6;
    const r = rad * k * (0.7 + hash(cx, cy, seed + 3) * 0.6);
    const d = Math.hypot(X - ox, Y - oy) / r;
    if (d < 1) best = Math.max(best, 1 - d);
  }
  return best;
}
/** Worley cells (k per unit): distance to the nearest and second-nearest jittered point, in cell units,
 *  and the nearest cell's id (for per-plate tone) */
export interface CellHit { d1: number; d2: number; id: number }
const CH: CellHit = { d1: 0, d2: 0, id: 0 };
export function cells(x: number, y: number, k: number, seed: number): CellHit {
  const X = x * k, Y = y * k, xi = Math.floor(X), yi = Math.floor(Y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const ox = cx + 0.15 + hash(cx, cy, seed) * 0.7, oy = cy + 0.15 + hash(cx, cy, seed + 1) * 0.7;
    const d = Math.hypot(X - ox, Y - oy);
    if (d < d1) { d2 = d1; d1 = d; id = hash(cx, cy, seed + 2); } else if (d < d2) d2 = d;
  }
  CH.d1 = d1; CH.d2 = d2; CH.id = id;
  return CH;
}

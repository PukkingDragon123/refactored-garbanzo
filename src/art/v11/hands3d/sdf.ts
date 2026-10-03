// A tiny signed-distance toolkit for sculpting the hands at load time: round cones (tapered
// capsules), ellipsoids, an elliptic-section limb and smooth unions, with bounding-sphere culling so
// the polygonizer can evaluate it a few hundred thousand times quickly. Everything is in centimetres.

export const enum K { Cone = 0, Ell = 1, Limb = 2 }

export class Prim {
  readonly isGroup = false;
  t: K = K.Cone;
  /** smooth-union radius with what came before (0 = hard union) */
  k = 0;
  /** negative: carve this shape out (smooth subtraction) */
  sub = false;
  // bounding sphere
  cx = 0; cy = 0; cz = 0; cr = 0;
  // round cone
  ax = 0; ay = 0; az = 0; bax = 0; bay = 0; baz = 0; l2 = 1; rr = 0; a2 = 1; il2 = 1; r1 = 0; r2 = 0;
  // ellipsoid: centre (cx..), local axes as rows, radii
  m0 = 1; m1 = 0; m2 = 0; m3 = 0; m4 = 1; m5 = 0; m6 = 0; m7 = 0; m8 = 1; rx = 1; ry = 1; rz = 1;
  // limb: cross-section knots along y
  ys: number[] = []; as: number[] = []; bs: number[] = []; xs: number[] = []; zs: number[] = []; y0 = 0; y1 = 0;
  /** optional displacement added to this primitive's distance (folds, knit) */
  disp: ((x: number, y: number, z: number) => number) | null = null;
  dispAmp = 0;
}

export function cone(a: number[], b: number[], r1: number, r2: number, k = 0): Prim {
  const p = new Prim();
  p.t = K.Cone; p.k = k;
  p.ax = a[0]; p.ay = a[1]; p.az = a[2];
  p.bax = b[0] - a[0]; p.bay = b[1] - a[1]; p.baz = b[2] - a[2];
  p.l2 = Math.max(1e-8, p.bax * p.bax + p.bay * p.bay + p.baz * p.baz);
  p.rr = r1 - r2; p.a2 = p.l2 - p.rr * p.rr; p.il2 = 1 / p.l2; p.r1 = r1; p.r2 = r2;
  p.cx = (a[0] + b[0]) / 2; p.cy = (a[1] + b[1]) / 2; p.cz = (a[2] + b[2]) / 2;
  p.cr = Math.sqrt(p.l2) / 2 + Math.max(r1, r2);
  return p;
}
/** ellipsoid with radii r along the local axes ax (x), ay (y), az = ax × ay */
export function ell(c: number[], r: number[], ay: number[] = [0, 1, 0], axHint: number[] = [1, 0, 0], k = 0): Prim {
  const p = new Prim();
  p.t = K.Ell; p.k = k;
  p.cx = c[0]; p.cy = c[1]; p.cz = c[2];
  // orthonormalize: y first, then x, z = x × y
  let l = Math.hypot(ay[0], ay[1], ay[2]) || 1;
  const Y = [ay[0] / l, ay[1] / l, ay[2] / l];
  const d = axHint[0] * Y[0] + axHint[1] * Y[1] + axHint[2] * Y[2];
  let X = [axHint[0] - Y[0] * d, axHint[1] - Y[1] * d, axHint[2] - Y[2] * d];
  l = Math.hypot(X[0], X[1], X[2]) || 1;
  X = [X[0] / l, X[1] / l, X[2] / l];
  const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
  p.m0 = X[0]; p.m1 = X[1]; p.m2 = X[2]; p.m3 = Y[0]; p.m4 = Y[1]; p.m5 = Y[2]; p.m6 = Z[0]; p.m7 = Z[1]; p.m8 = Z[2];
  p.rx = r[0]; p.ry = r[1]; p.rz = r[2];
  p.cr = Math.max(r[0], r[1], r[2]);
  return p;
}
/** a limb along y from y0 to y1 with elliptic cross-sections (half-width a, half-depth b, centre x, z) at knots ys */
export function limb(ys: number[], as: number[], bs: number[], xs: number[], zs: number[], k = 0): Prim {
  const p = new Prim();
  p.t = K.Limb; p.k = k;
  p.ys = ys; p.as = as; p.bs = bs; p.xs = xs; p.zs = zs;
  p.y0 = ys[0]; p.y1 = ys[ys.length - 1];
  p.cx = 0; p.cy = (p.y0 + p.y1) / 2; p.cz = 0;
  p.cr = (p.y1 - p.y0) / 2 + Math.max(...as, ...bs) + Math.max(...xs.map(Math.abs), ...zs.map(Math.abs));
  return p;
}

/** smooth min (polynomial); k <= 0 is a hard min */
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}
export function smax(a: number, b: number, k: number) { return -smin(-a, -b, k); }

export function primDist(p: Prim, x: number, y: number, z: number): number {
  let d: number;
  if (p.t === K.Cone) {
    const pax = x - p.ax, pay = y - p.ay, paz = z - p.az;
    const yy = pax * p.bax + pay * p.bay + paz * p.baz;
    const zz = yy - p.l2;
    const qx = pax * p.l2 - p.bax * yy, qy = pay * p.l2 - p.bay * yy, qz = paz * p.l2 - p.baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * p.l2, z2 = zz * zz * p.l2;
    const rr = p.rr, k = (rr > 0 ? 1 : rr < 0 ? -1 : 0) * rr * rr * x2;
    if ((zz > 0 ? p.a2 * z2 : zz < 0 ? -p.a2 * z2 : 0) > k) d = Math.sqrt(x2 + z2) * p.il2 - p.r2;
    else if ((yy > 0 ? p.a2 * y2 : yy < 0 ? -p.a2 * y2 : 0) < k) d = Math.sqrt(x2 + y2) * p.il2 - p.r1;
    else d = (Math.sqrt(x2 * p.a2 * p.il2) + yy * rr) * p.il2 - p.r1;
  } else if (p.t === K.Ell) {
    const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
    const lx = (dx * p.m0 + dy * p.m1 + dz * p.m2) / p.rx, ly = (dx * p.m3 + dy * p.m4 + dz * p.m5) / p.ry, lz = (dx * p.m6 + dy * p.m7 + dz * p.m8) / p.rz;
    const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const ux = lx / p.rx, uy = ly / p.ry, uz = lz / p.rz;
    const k1 = Math.sqrt(ux * ux + uy * uy + uz * uz);
    d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(p.rx, p.ry, p.rz);
  } else {
    // one knot lookup, Catmull-Rom on all five channels
    const ys = p.ys, n = ys.length;
    const yc = y < p.y0 ? p.y0 : y > p.y1 ? p.y1 : y;
    let i = 0;
    while (i < n - 2 && yc > ys[i + 1]) i++;
    const t = (yc - ys[i]) / (ys[i + 1] - ys[i]), t2 = t * t, t3 = t2 * t;
    const i0 = i > 0 ? i - 1 : 0, i3 = i + 2 < n ? i + 2 : n - 1;
    const c0 = -0.5 * t3 + t2 - 0.5 * t, c1 = 1.5 * t3 - 2.5 * t2 + 1, c2 = -1.5 * t3 + 2 * t2 + 0.5 * t, c3 = 0.5 * t3 - 0.5 * t2;
    const cr = (v: number[]) => v[i0] * c0 + v[i] * c1 + v[i + 1] * c2 + v[i3] * c3;
    const a = cr(p.as), b = cr(p.bs);
    const qx = x - cr(p.xs), qz = z - cr(p.zs);
    const ax = qx / a, az = qz / b;
    const k0 = Math.sqrt(ax * ax + az * az), bx = ax / a, bz = az / b, k1 = Math.sqrt(bx * bx + bz * bz);
    const d2 = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(a, b);
    const dy = y < p.y0 ? p.y0 - y : y > p.y1 ? y - p.y1 : 0;
    d = dy > 0 ? (d2 > 0 ? Math.sqrt(d2 * d2 + dy * dy) : dy) : d2;
  }
  if (p.disp) d -= p.disp(x, y, z) * p.dispAmp;
  return d;
}

/** a union of primitives and sub-groups, evaluated in order with smooth blends and culling. A group
 *  blends into what came before it with its own k, so (say) the fingers can be hard-unioned with each
 *  other but smoothly webbed into the palm. */
export class Sdf {
  items: (Prim | Sdf)[] = [];
  readonly isGroup = true;
  k = 0;
  sub = false;
  dispAmp = 0;
  /** grow (positive) or shrink the whole group's surface */
  offset = 0;
  cx = 0; cy = 0; cz = 0; cr = -1;
  constructor(k = 0) { this.k = k; }
  add(...ps: (Prim | Sdf)[]) { for (const p of ps) this.items.push(p); this.cr = -1; return this; }
  /** bounding sphere of everything inside */
  bounds() {
    if (this.cr >= 0) return;
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const it of this.items) {
      if ((it as Sdf).isGroup) (it as Sdf).bounds();
      if (it.sub) continue;
      x0 = Math.min(x0, it.cx - it.cr); x1 = Math.max(x1, it.cx + it.cr);
      y0 = Math.min(y0, it.cy - it.cr); y1 = Math.max(y1, it.cy + it.cr);
      z0 = Math.min(z0, it.cz - it.cr); z1 = Math.max(z1, it.cz + it.cr);
    }
    this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2; this.cz = (z0 + z1) / 2;
    this.cr = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + 0.01 + Math.max(0, this.offset);
    for (const it of this.items) this.dispAmp = Math.max(this.dispAmp, it.dispAmp);
  }
  eval(x: number, y: number, z: number): number {
    if (this.cr < 0) this.bounds();
    let d = 1e9;
    const ps = this.items;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
      let lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.cr - p.dispAmp;
      if (!p.isGroup && (p as Prim).t === K.Limb) {
        const q = p as Prim, dyl = (y > q.y1 ? y - q.y1 : y < q.y0 ? q.y0 - y : 0) - q.dispAmp;
        if (dyl > lb) lb = dyl;
      }
      if (p.sub) {
        if (lb > p.k) continue;
        const di = (p as Sdf).isGroup ? (p as Sdf).eval(x, y, z) : primDist(p as Prim, x, y, z);
        d = smax(d, -di, p.k);
        continue;
      }
      if (lb > d + p.k) continue;
      const di = (p as Sdf).isGroup ? (p as Sdf).eval(x, y, z) : primDist(p as Prim, x, y, z);
      d = smin(d, di, p.k);
    }
    return d - this.offset;
  }
}

/**
 * A copy of the tree without the parts that cannot matter inside a ball (centre c, radius R) for
 * points within `reach` of the surface: anything whose bounds are further than R + reach + its blend
 * radius is dropped. Leaves are shared, so this is cheap; evaluating the pruned tree near the surface
 * gives the same distances many times faster.
 */
export function prune(g: Sdf, cx: number, cy: number, cz: number, R: number, reach: number): Sdf | null {
  g.bounds();
  const out = new Sdf(g.k);
  out.sub = g.sub; out.offset = g.offset;
  for (const it of g.items) {
    const dx = cx - it.cx, dy = cy - it.cy, dz = cz - it.cz;
    const gap = Math.sqrt(dx * dx + dy * dy + dz * dz) - it.cr - it.dispAmp - R;
    if (it.sub ? gap > it.k + 0.05 : gap > reach + it.k + Math.max(0, g.offset)) continue;
    if ((it as Sdf).isGroup) {
      const sub = prune(it as Sdf, cx, cy, cz, R, reach);
      if (sub && sub.items.length) out.items.push(sub);
    } else out.items.push(it);
  }
  if (!out.items.length) return null;
  out.cr = -1;
  out.bounds();
  return out;
}

/** a few steps of projecting a point onto the zero set */
export function project(s: Sdf, p: number[], steps = 6): number[] {
  let [x, y, z] = p;
  const e = 0.01;
  for (let i = 0; i < steps; i++) {
    const d = s.eval(x, y, z);
    const gx = s.eval(x + e, y, z) - s.eval(x - e, y, z), gy = s.eval(x, y + e, z) - s.eval(x, y - e, z), gz = s.eval(x, y, z + e) - s.eval(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1;
    x -= (d * gx) / gl; y -= (d * gy) / gl; z -= (d * gz) / gl;
    if (Math.abs(d) < 1e-3) break;
  }
  return [x, y, z];
}
/** the outward normal at a point */
export function normalAt(s: Sdf, x: number, y: number, z: number, e = 0.02): number[] {
  // tetrahedral differences: 4 evaluations
  const a = s.eval(x + e, y - e, z - e), b = s.eval(x - e, y - e, z + e), c = s.eval(x - e, y + e, z - e), d = s.eval(x + e, y + e, z + e);
  const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

// ------------------------------------------------------------------ noise (for folds and knit)
export function hash3(x: number, y: number, z: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** cheap smooth pseudo-noise in about -0.5..0.5 (three skewed sine waves) */
export function snoise3(x: number, y: number, z: number) {
  return (Math.sin(x * 1.7 + y * 0.9 + Math.sin(z * 1.3 + y * 0.4) * 1.5) + Math.sin(y * 1.3 - z * 1.1 + Math.sin(x * 0.8) * 1.2) * 0.7 + Math.sin(z * 2.1 + x * 1.2 - y * 0.6) * 0.5) * 0.23;
}
export function vnoise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const n = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k);
  const x00 = n(0, 0, 0) + (n(1, 0, 0) - n(0, 0, 0)) * u, x10 = n(0, 1, 0) + (n(1, 1, 0) - n(0, 1, 0)) * u;
  const x01 = n(0, 0, 1) + (n(1, 0, 1) - n(0, 0, 1)) * u, x11 = n(0, 1, 1) + (n(1, 1, 1) - n(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

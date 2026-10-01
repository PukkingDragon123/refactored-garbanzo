// Shared icon parts: lens glass, local frames for diagonal compositions, glows and sparkles.

import { Pen, RAMP, H, Ramp, Pt, Mask, alpha, hash } from './pen';
import { C, hex } from '../color';

/** A frame along a diagonal: world = o + u*axis + v*normal (normal points to the axis' right). */
export function frame(ax: number, ay: number, bx: number, by: number) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len, uy = (by - ay) / len;
  const nx = -uy, ny = ux;
  const at = (u: number, v: number): Pt => [ax + ux * u + nx * v, ay + uy * u + ny * v];
  /** local coordinates of a pixel centre */
  const loc = (x: number, y: number): [number, number] => {
    const dx = x + 0.5 - ax, dy = y + 0.5 - ay;
    return [dx * ux + dy * uy, dx * nx + dy * ny];
  };
  const poly = (pts: [number, number][]) => pts.flatMap(([u, v]) => at(u, v));
  return { len, ux, uy, nx, ny, at, loc, poly };
}

/** A frame along a curved polyline: loc(x, y) gives the arc fraction t, arc length u and signed
 *  distance v of a pixel centre from the curve (v > 0 on the right of the travel direction). */
export function curve(pts: Pt[]) {
  const seg: { ax: number; ay: number; dx: number; dy: number; len: number; s0: number }[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    seg.push({ ax, ay, dx: (bx - ax) / len, dy: (by - ay) / len, len, s0: total });
    total += len;
  }
  const loc = (x: number, y: number) => {
    const px = x + 0.5, py = y + 0.5;
    let best = Infinity, u = 0, v = 0;
    for (let k = 0; k < seg.length; k++) {
      const s = seg[k];
      const t = Math.max(k === 0 ? -99 : 0, Math.min(k === seg.length - 1 ? s.len + 99 : s.len, (px - s.ax) * s.dx + (py - s.ay) * s.dy));
      const cx = s.ax + s.dx * t, cy = s.ay + s.dy * t;
      const d = Math.hypot(px - cx, py - cy);
      if (d < best) { best = d; u = s.s0 + t; v = (px - cx) * -s.dy + (py - cy) * s.dx; }
    }
    return { t: u / total, u, v };
  };
  /** point + tangent at arc fraction t */
  const at = (t: number) => {
    const d = Math.max(0, Math.min(1, t)) * total;
    let k = 0;
    while (k < seg.length - 1 && seg[k].s0 + seg[k].len < d) k++;
    const s = seg[k], q = d - s.s0;
    return { x: s.ax + s.dx * q, y: s.ay + s.dy * q, tx: s.dx, ty: s.dy };
  };
  return { len: total, loc, at };
}

/** points along a quadratic bezier */
export function bez(a: Pt, c: Pt, b: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

const GLASS = [hex('#070918'), hex('#0e1432'), hex('#1a2656'), hex('#2c3f86'), hex('#5a78c8'), hex('#a8d0f4')];
/** Camera / binocular lens glass: deep blue-violet with a crescent reflection and a glint. */
export function lens(p: Pen, cx: number, cy: number, r: number, o: { tint?: C[] } = {}) {
  const g = o.tint ?? GLASS;
  const m = p.maskDisc(cx, cy, r);
  p.fill(m, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy) / r;
    // crescent reflection hugging the top-left rim
    const cr = Math.hypot(dx + r * 0.28, dy + r * 0.28) / r;
    if (d > 0.45 && cr < 0.78 && dx + dy < -r * 0.35) return d > 0.8 ? g[3] : g[4];
    // soft violet bounce bottom-right
    if (d > 0.55 && dx + dy > r * 0.6) return hex('#4a3a9a');
    return d > 0.72 ? g[2] : d > 0.4 ? g[1] : g[0];
  });
  // glint
  const gx = Math.floor(cx - r * 0.42), gy = Math.floor(cy - r * 0.42);
  p.px(gx, gy, H('#ffffff'));
  if (r > 3.5) { p.px(gx + 1, gy, g[5]); p.px(gx, gy + 1, g[5]); }
  return m;
}

/** Ring (annulus) shaded like a metal band lit from the top-left. */
export function ring(p: Pen, cx: number, cy: number, r0: number, r1: number, ramp: Ramp, o: { lift?: number; ry?: number } = {}) {
  const ry = o.ry ?? 1;
  const m = p.maskFn((x, y) => {
    const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / ry;
    const d = Math.hypot(dx, dy);
    return d <= r1 && d > r0;
  });
  p.fill(m, (x, y) => {
    const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / ry;
    const a = Math.atan2(dy, dx);
    // brightest toward the top-left (angle -135deg)
    const l = Math.cos(a + Math.PI * 0.75);
    const d = Math.hypot(dx, dy);
    const outer = d > (r0 + r1) / 2;
    let i = Math.round(2 + l * 1.6 + (outer ? 0.4 : -0.4) + (o.lift ?? 0));
    i = Math.max(0, Math.min(ramp.length - 2, i));
    return ramp[i];
  });
  return m;
}

/** Soft glow halo for a post layer (only paints where the art below is empty when `under` is given). */
export function halo(p: Pen, cx: number, cy: number, r: number, col: string, a = 90) {
  const c0 = hex(col);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d > 1) continue;
      const k = (1 - d) * (1 - d) * a;
      if (k < 10) continue;
      p.blend(x, y, alpha(c0, Math.round(k)));
    }
}

/** 4-point sparkle (post layer). */
export function sparkle(p: Pen, x: number, y: number, col = '#fffbe0', big = false) {
  const c = hex(col), c2 = hex(col, 150), c3 = hex(col, 80);
  p.blend(x, y, c);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.blend(x + dx, y + dy, big ? c : c2);
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.blend(x + dx, y + dy, c3);
}

/** Rising wisp of steam / scent (post layer). */
export function wisp(p: Pen, x: number, y: number, h: number, col: string, a = 200, dir = 1) {
  for (let i = 0; i < h; i++) {
    const xx = x + Math.round(Math.sin((i / h) * Math.PI * 1.6) * dir);
    p.blend(xx, y - i, hex(col, Math.round(a * (1 - i / (h + 1)))));
  }
}

/** Wood grain texture offset for tube/slab shading along a direction. */
export const grain = (ux: number, uy: number, seed = 1, amt = 1) => (x: number, y: number) => {
  const along = x * ux + y * uy, across = -x * uy + y * ux;
  const n = hash(Math.floor(along / 3), Math.floor(across), seed);
  return n > 0.82 ? -amt : n < 0.1 ? amt * 0.6 : 0;
};

export { RAMP, H };
export type { Mask };

// Small-life painting kit on top of the organic contour layer (./v9/wild/contour.ts): the shared
// helpers for the little animals (the moss frog, the ember toad, the cave wētā, the harvestman, the
// cave centipede, the velvet worm). Every part is ONE continuous contour (a Catmull-Rom spline through
// landmarks, or a strip swept along a jointed path with its own width profile on each side), raised
// into a height field from the distance to that contour, sculpted with landmark bumps and grooves,
// lit from its own normals and written into the sketch as its own part, so the core draws the depth
// edges where one part passes in front of another and the dark outline round the whole animal.

import { Sk, hh } from './beasts-core';
import type { V2, BeastEye } from './beasts-core';
import type { C } from './color';
import { Field, strip, spline } from './v9/wild/contour';
import type { LP, FP, StripOpt } from './v9/wild/contour';

export { Field, strip, spline };
export type { LP, FP };

/** cumulative arc lengths */
export function cumOf(path: V2[]): number[] {
  const c = [0];
  for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return c;
}
/** the arc parameter (0..1) of the nearest point on a polyline, and the signed distance across it (+ left of travel) */
export function project(path: V2[], cum: number[], x: number, y: number): [number, number] {
  const L = cum[cum.length - 1] || 1;
  let best = Infinity, bt = 0, side = 0;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1][0], ay = path[i - 1][1], sx = path[i][0] - ax, sy = path[i][1] - ay, L2 = sx * sx + sy * sy;
    let k = L2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / L2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const dx = x - ax - sx * k, dy = y - ay - sy * k, d = dx * dx + dy * dy;
    if (d < best) { best = d; bt = (cum[i - 1] + (cum[i] - cum[i - 1]) * k) / L; side = (sy * dx - sx * dy) > 0 ? 1 : -1; }
  }
  return [bt, Math.sqrt(best) * side];
}
/** a point along a polyline (t 0..1) */
export function pointOn(path: V2[], t: number, cum = cumOf(path)): V2 {
  const L = cum[cum.length - 1], s = Math.max(0, Math.min(1, t)) * L;
  let i = 1;
  while (i < path.length - 1 && cum[i] < s) i++;
  const k = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
}

export interface SegOpt {
  z: number; bias?: number; round?: number; dome?: number; spec?: number; specPow?: number; zk?: number;
  capA?: number; capB?: number; spines?: StripOpt['spines']; soft?: boolean;
  /** sculpt the part's height (bumps, grooves) before it is lit */
  add?: (F: Field) => void;
}
/**
 * A limb segment (or any swept part): one contour round `path` with half-widths up(t) on the left of
 * travel and dn(t) on the right, lit as its own part. fill gets the pixel, t along the path and the
 * signed distance across it (+ on the `up` side).
 */
export function seg(sk: Sk, path: V2[], up: (t: number) => number, dn: (t: number) => number, fill: (p: FP, t: number, c: number) => number, o: SegOpt): Field | null {
  sk.np(!!o.soft);
  if (up(0.5) + dn(0.5) < 0.95) {
    // thinner than a pixel: one continuous pixel line down the path, lit from its direction
    const cum = cumOf(path), L = cum[cum.length - 1] || 1;
    const p: FP = { x: 0, y: 0, d: 0, h: 0, nx: 0, ny: 0, nz: 1, l: 0.5 };
    let last = '';
    for (let s = 0; s <= L + 1e-6; s += 0.35) {
      const q = pointOn(path, s / L, cum), key = Math.floor(q[0]) + ',' + Math.floor(q[1]);
      if (key === last) continue;
      last = key;
      p.x = Math.floor(q[0]) + 0.5; p.y = Math.floor(q[1]) + 0.5; p.nx = -0.3; p.ny = -0.5; p.nz = 0.8; p.l = 0.56 + (o.bias ?? 0);
      const m = fill(p, s / L, 0);
      if (m > 0) sk.dot(p.x, p.y, m, p.l, o.z + 0.5);
    }
    return null;
  }
  const c = strip(path, up, dn, { capA: o.capA ?? 0.9, capB: o.capB ?? 0.9, spines: o.spines });
  const F = new Field(sk, [c], { round: o.round ?? Math.max(0.5, (up(0.5) + dn(0.5)) * 0.45), dome: o.dome ?? (up(0.5) + dn(0.5)) * 0.15 });
  o.add?.(F);
  const cum = cumOf(path);
  F.emit((p) => { const [t, cr] = project(path, cum, p.x, p.y); return fill(p, t, cr); }, { z: o.z, bias: o.bias, spec: o.spec, specPow: o.specPow, zk: o.zk });
  return F;
}
export interface BlobOpt { z: number; bias?: number; round?: number; dome?: number; spec?: number; specPow?: number; zk?: number; per?: number; soft?: boolean; add?: (F: Field) => void; hf?: (x: number, y: number, d: number, dm: number) => number }
/** a closed contour through landmarks ([x, y, 1] = a sharp corner), lit as its own part */
export function blob(sk: Sk, pts: LP[], fill: (p: FP) => number, o: BlobOpt): Field {
  sk.np(!!o.soft);
  const F = new Field(sk, [spline(pts, true, o.per ?? 4)], { round: o.round ?? 1, dome: o.dome, hf: o.hf });
  o.add?.(F);
  F.emit(fill, { z: o.z, bias: o.bias, spec: o.spec, specPow: o.specPow, zk: o.zk });
  return F;
}

/**
 * A hair-thin line (antennae, thin legs) as overlay pixels, one per cell, coloured by position. With
 * `under`, it passes behind whatever is already drawn (a far leg behind the body).
 */
export function hair(sk: Sk, pts: V2[], col: (t: number, i: number) => C | 0, step = 0.3, under = false) {
  const cum = cumOf(pts), L = cum[cum.length - 1] || 1;
  let last = '';
  let i = 0;
  for (let s = 0; s <= L; s += step) {
    const p = pointOn(pts, s / L, cum);
    const key = Math.floor(p[0]) + ',' + Math.floor(p[1]);
    if (key === last) continue;
    last = key;
    const c = col(s / L, i++);
    if (c && !(under && sk.has(p[0], p[1]))) sk.over(p[0], p[1], c);
  }
}
/** a smooth curve through landmarks, sampled densely (for limbs, antennae) */
export const curve = (pts: V2[], per = 5): V2[] => spline(pts.map(p => [p[0], p[1]] as LP), false, per);

export interface EyePal { iris: C; irisD: C; pupil: C; rim: C; glint: C; lid: C; fleck?: C }
/**
 * A small anuran eye painted pixel by pixel (gold iris, horizontal pupil, glint, the lid), in its
 * state. size 2: a 2 x 2 bead; 3: 3 x 3; 4: 4 x 3. (x, y) is the eye centre. Returns the centre.
 */
export function anuranEye(sk: Sk, x: number, y: number, size: 2 | 3 | 4, st: BeastEye, P: EyePal): V2 {
  const w = size === 4 ? 4 : size, h = size === 4 ? 3 : size;
  const X = Math.round(x - w / 2), Y = Math.round(y - h / 2);
  const o = (dx: number, dy: number, c: C) => sk.over(X + dx, Y + dy, c);
  if (st === 'closed') {
    // the eye pulled down: the lid's fold across it
    for (let i = 0; i < w; i++) o(i, h - 1 - (i === 0 || i === w - 1 ? 1 : 0), P.lid);
    return [X + w / 2, Y + h / 2];
  }
  if (size === 2) {
    if (st === 'angry') { o(0, 0, P.lid); o(1, 0, P.lid); o(0, 1, P.pupil); o(1, 1, P.iris); }
    else if (st === 'alert' || st === 'scared') { o(0, 0, P.glint); o(1, 0, P.iris); o(0, 1, P.pupil); o(1, 1, P.pupil); }
    else { o(0, 0, P.iris); o(1, 0, P.glint); o(0, 1, P.pupil); o(1, 1, P.pupil); }
    return [X + 1, Y + 1];
  }
  if (size === 3) {
    // gold above with the glint, the black bar of the pupil, the darker gold below
    const top = [P.iris, P.glint, P.iris], mid = [P.pupil, P.pupil, P.pupil], bot = [P.irisD, P.fleck ?? P.iris, P.irisD];
    if (st === 'alert' || st === 'scared') { top[0] = P.glint; top[1] = P.iris; mid[0] = P.iris; mid[2] = P.iris; bot[1] = P.pupil; }
    if (st === 'angry') { top[0] = top[1] = top[2] = P.lid; mid[2] = P.iris; }
    for (let i = 0; i < 3; i++) { o(i, 0, top[i]); o(i, 1, mid[i]); o(i, 2, bot[i]); }
    // the rim at the back corner keeps it set in the head
    o(-1, 1, P.rim);
    return [X + 1.5, Y + 1.5];
  }
  // 4 x 3: a horizontal almond, the rim at both corners
  const rows: C[][] = [
    [P.rim, P.iris, P.glint, P.iris],
    [P.iris, P.pupil, P.pupil, P.pupil],
    [P.rim, P.irisD, P.fleck ?? P.iris, P.irisD],
  ];
  if (st === 'alert' || st === 'scared') { rows[0][1] = P.glint; rows[0][2] = P.iris; rows[1][3] = P.iris; rows[2][2] = P.pupil; }
  if (st === 'angry') { rows[0] = [P.lid, P.lid, P.lid, P.lid]; rows[1][0] = P.lid; }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) o(i, j, rows[j][i]);
  return [X + 2, Y + 1.5];
}

/** stable hashed jitter in body space */
export const jit = (a: number, b: number, s: number) => hh(a, b, s) - 0.5;

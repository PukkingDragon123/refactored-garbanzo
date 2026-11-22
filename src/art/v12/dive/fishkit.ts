// V12 Te Moana Rimurimu: the fish kit behind the kelp dive's big fish and the Glasseye Whaler.
//
// It is the shape language and the rasteriser of src/art/v9/fish.ts (the user's reference style: a
// solid lit volume in a few clean bands, countershading, hinted scales, a modelled bony head with a
// lit gill-cover rim, graded fins with their own rays, a hand-placed wet eye), copied here so the dive's
// fish can move: a fish is one shape description in fish-local units (x runs from the tail tip at 0 to
// the snout at ~1, y points to the belly) made of parts: the body (one contour: a dorsal and a ventral
// profile through the snout, nape, dorsal origin, peduncle and belly landmarks), fins (a membrane
// polygon with its own rays), tubes and discs. On top of v9's still renders this kit poses them:
//
//   - every part may move with the pose (move(): a rotation about a pivot, a shift, a squash across):
//     the pectorals scull and drop, a jaw hinges open, the sunfish's fins beat;
//   - the tail sweeps from side to side (sweep): seen from the side the tail stock and the caudal fin
//     foreshorten as they swing toward or away from us, instead of flapping up and down;
//   - the whole fish foreshortens for the turn (sx), with the far pectoral showing past the belly;
//   - a free bend along the body (bend(u)): the shark's warning hunch, a veer, a lunge;
//   - eye states: open, narrowed, rolled white (the shark's nictitating membrane), shut.
//
// fishDef() wraps a fish as a SpeciesDef (src/art/beasts-core.ts) so it registers as a beast: the field
// guide, renderAny and the frame caches all know it. Its anchor is a fixed point of the fish (the body
// centre by default), the same in every pose.

import { PixelBuffer } from '../../pixel';
import { C, hex, rgba, withAlpha } from '../../color';
import { lmix } from '../../beasts-core';
import type { Sk, SpeciesDef, AnimDef, BeastEye } from '../../beasts-core';
import { Pt, clamp01, frac, smooth, hash, curve, inPoly, segDist, polyEdgeDist, along, cumTable, spot } from '../../v9/fish-skin';

export type { Pt };
export { clamp01, frac, smooth, hash, curve, inPoly, segDist, polyEdgeDist, along, spot };
export type Ramp = C[];
/** a ramp from hex strings, dark -> light */
export const pal = (...h: string[]): Ramp => h.map(x => hex(x));
/** pick a tone (0 = darkest) */
export const tone = (r: Ramp, t: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(t)))];
/** colour c over b (straight RGB) */
function over(c: C, b: C): C {
  const a = (c >>> 24) / 255;
  if (a >= 1 || !b) return c;
  const m = (s: number) => Math.round(((c >>> s) & 255) * a + ((b >>> s) & 255) * (1 - a));
  return rgba(m(0), m(8), m(16), Math.max(c >>> 24, b >>> 24));
}

// ------------------------------------------------------------------ the pose
export type EyeState = 'open' | 'narrow' | 'white' | 'shut';
/** what a frame asks of the fish: read by the parts (move, when, marks) while it is rasterised */
export interface FishPose {
  /** lateral tail sweep -1..1 (foreshortens the tail stock and the caudal fin) */
  sweep?: number;
  /** foreshortening of the whole fish for the turn (1 side-on .. ~0.3 nearly head-on) */
  sx?: number;
  /** a free bend: y offset (in body lengths, belly-ward) at u = 0 tail .. 1 snout */
  bend?: (u: number) => number;
  /** v9's vertical bends (small fish keep them) */
  swing?: number; arch?: number;
  /** rotation of the whole fish (radians, + noses down) */
  rot?: number;
  /** mouth open 0..1 */
  gape?: number;
  /** pectoral angle (radians, + swings the fin down and back) and the far pectoral's */
  pec?: number; pec2?: number;
  /** extra per-species controls (fin beats, gill pumps, flushes) */
  k?: Record<string, number>;
  eye?: EyeState;
  /** the far pectoral shows (turns, the hunch) */
  far?: boolean;
}
let POSE: FishPose = {};
export const pose = () => POSE;
export const pk = (name: string, d = 0) => POSE.k?.[name] ?? d;

/** a pose transform of one part: rotate about (cx, cy) by a, squash across the pivot line by sy, then shift */
export interface Move { cx: number; cy: number; a?: number; sy?: number; dx?: number; dy?: number }

// ------------------------------------------------------------------ the shape language
/** what a part hands its painter for one pixel */
export interface Px {
  x: number; y: number;
  px: number; py: number;
  S: number;
  L: [number, number, number];
  H: [number, number, number];
  detail: number;
}
export interface Part {
  z: number;
  ink?: boolean;
  minPx?: number;
  hit(x: number, y: number, S: number): boolean;
  paint(p: Px): C;
  bounds: Pt[];
  noShadow?: boolean;
  /** pose transform (the part's rest shape is moved by it) */
  move?: () => Move | null;
  /** shown only in some poses */
  when?: () => boolean;
}
export interface FishArt {
  parts: Part[];
  ink: C;
  eye: { x: number; y: number; r: number; iris: C; ring?: C; pupil?: C; slit?: boolean; pupilR?: number };
  x0: number; x1: number;
  /** where the tail sweep pivots (fish x) and how far it turns at the tip (radians) */
  sweepX?: number; sweepA?: number;
  /** the head point (for photos and bites), fish-local */
  head?: Pt;
}

// ------------------------------------------------------------------ the body
export interface BodyCtx {
  u: number; v: number;
  t: number; ramp: Ramp;
  Hpx: number;
  head: boolean;
  zone: number;
  lam: number; spec: number;
  lat: boolean; hint: boolean;
  c: C;
}
export interface BodyOpt {
  top: Pt[]; bot: Pt[];
  back: Ramp; side: Ramp; belly: Ramp;
  zb?: number; zl?: number;
  sheen?: Ramp; sheenV?: [number, number];
  light?: number;
  gill?: number; bow?: number; pre?: number;
  mouth?: [number, number, number, number];
  hints?: number; hintV?: [number, number]; hintDark?: boolean;
  lat?: [number, number, number];
  spec?: number;
  /** how round the head is (the normal swings forward over it) */
  headRound?: number;
  mark?: (p: Px, b: BodyCtx) => C | null;
  z?: number; ink?: boolean;
  move?: () => Move | null;
  when?: () => boolean;
}
export function body(o: BodyOpt): Part & { top: (x: number) => number; bot: (x: number) => number } {
  const top = curve(o.top), bot = curve(o.bot);
  const x0 = Math.max(o.top[0][0], o.bot[0][0]), x1 = Math.min(o.top[o.top.length - 1][0], o.bot[o.bot.length - 1][0]);
  const cl = (x: number) => Math.min(x1, Math.max(x0, x));
  const Hf = (x: number) => Math.max(1e-3, bot(cl(x)) - top(cl(x)));
  let Hmax = 0;
  for (let i = 0; i <= 64; i++) Hmax = Math.max(Hmax, Hf(x0 + ((x1 - x0) * i) / 64));
  const G = cumTable(x => Hmax / Hf(x), x0, x1);
  const zb0 = o.zb ?? 0.36, zl0 = o.zl ?? 0.66;
  const gill = o.gill ?? 0, bow = o.bow ?? 0.08, headX = gill || x1 - 0.18;
  const gx = (v: number) => gill - (v - 0.45) * (v - 0.45) * bow;
  const nh = o.hints ?? 0, hv = o.hintV ?? [Math.max(zb0 - 0.04, 0.24), zl0 - 0.06];
  const slope = (f: (x: number) => number, x: number) => { const a = cl(x - 0.005), b = cl(x + 0.005); return (f(b) - f(a)) / (b - a || 1); };
  const ctx: BodyCtx = { u: 0, v: 0, t: 0, ramp: o.side, Hpx: 0, head: false, zone: 1, lam: 0, spec: 0, lat: false, hint: false, c: 0 };
  const hr = o.headRound ?? 0.55;
  return {
    top, bot,
    z: o.z ?? 10, ink: o.ink ?? true, move: o.move, when: o.when,
    bounds: [...o.top, ...o.bot],
    hit(x, y) {
      if (x < x0 || x > x1) return false;
      return y >= top(x) && y <= bot(x);
    },
    paint(p) {
      const x = p.x, y = p.y, T = top(x), H = bot(x) - T;
      const v = clamp01((y - T) / H), u = (x - x0) / (x1 - x0), Hpx = H * p.S;
      const e = 2 * v - 1, ae = Math.abs(e);
      const sx = slope(top, x) * (1 - v) - slope(bot, x) * v;
      const hx = smooth(headX - 0.04, x1, x);
      let nx = sx * Math.min(1, ae * 1.3) * 0.85 + hx * hx * hr - (u < 0.06 ? (0.06 - u) * 4 : 0);
      let ny = Math.sign(e) * Math.pow(ae, 1.5) * 0.95;
      const nm = Math.hypot(nx, ny);
      if (nm > 0.97) { nx *= 0.97 / nm; ny *= 0.97 / nm; }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = nx * p.L[0] + ny * p.L[1] + nz * p.L[2];
      const spec = nx * p.H[0] + ny * p.H[1] + nz * p.H[2];
      const wv = Math.sin(x * 31 + 0.5) * 0.02;
      const zone = v < zb0 + wv ? 0 : v < zl0 - wv ? 1 : 2;
      let t = zone === 0 ? 1.9 + (v / zb0) * 0.5 : zone === 1 ? 2.6 : 4;
      t += (lam - 0.53) * 2.9 * (o.light ?? 1);
      const sw = o.spec ?? 0.8;
      if (sw > 0) { if (spec > 0.972) t += 0.9 * sw; if (spec > 0.996) t += 0.5 * sw; }
      if (zone === 2) t = Math.max(t, 2.8 + (1 - v) * 1.4);
      if ((1 - v) * Hpx < 1.1 && Hpx > 5) t -= 0.4;
      let ramp = zone === 0 ? o.back : zone === 1 ? o.side : o.belly;
      if (o.sheen && o.sheenV && v > o.sheenV[0] - wv && v < o.sheenV[1] + wv) ramp = o.sheen;
      const head = gill > 0 && x > gx(v);
      let hint = false;
      if (nh > 0 && !head && Hpx >= 7 && u > 0.1 && x < headX - 0.03 && v > hv[0] && v < hv[1]) {
        const rv = ((v - hv[0]) / (hv[1] - hv[0])) * nh, r = Math.floor(rv);
        if (Math.abs(rv - r - 0.5) * ((hv[1] - hv[0]) / nh) * Hpx < 0.5) {
          const P = Math.max(3, Math.min(5, (Hmax * p.S) / 7));
          const q = (G(x) * p.S) / P + (r & 1) * 0.5;
          if (frac(q) < (Hpx > 16 ? 1.6 : 1) / P) { hint = true; t += o.hintDark ? -0.9 : 0.9; }
        }
      }
      let lat = false;
      if (o.lat && !head && u > 0.04 && Hpx > 6 && !hint) {
        const [vh, vt, arch] = o.lat;
        const uu = clamp01((x - x0) / (headX - x0));
        const lv = vt + (vh - vt) * uu - arch * Math.sin(Math.PI * uu);
        if (Math.abs(v - lv) * Hpx < 0.5) { lat = true; t += 0.6; }
      }
      if (gill > 0 && v > 0.12 && v < 0.94) {
        const dg = (x - gx(v)) * p.S;
        if (dg < 0 && dg > -(Hpx > 12 ? 2 : 1.1)) t -= 1.3;
        else if (dg >= 0 && dg < 1) t += 1;
        else if (dg >= 1) {
          t += 0.25;
          if (o.pre && Hpx > 10 && v > 0.32 && v < 0.9 && Math.abs((x - gx(v) - o.pre) * p.S) < 0.5) t -= 0.8;
        }
      }
      let c: C = 0;
      if (o.mouth) {
        const [mx, my, ml, droop] = o.mouth;
        if (x > mx - ml) {
          const f = (mx - x) / ml, dpx = (y - (my + droop * f * f)) * p.S;
          if (Math.abs(dpx) < 0.55) c = tone(o.back, 0);
          else if (dpx >= 0.55 && dpx < 1.55 && Hpx > 7) t += 0.7;
        }
      }
      if (!c) c = tone(ramp, t);
      if (!o.mark) return c;
      ctx.u = u; ctx.v = v; ctx.t = t; ctx.ramp = ramp; ctx.Hpx = Hpx; ctx.head = head; ctx.zone = zone;
      ctx.lam = lam; ctx.spec = spec; ctx.lat = lat; ctx.hint = hint; ctx.c = c;
      return o.mark(p, ctx) ?? c;
    },
  };
}

// ------------------------------------------------------------------ fins
export interface FinShape { pts: Pt[]; rays: [Pt, Pt][] }
export interface FinCtx { s: number; a: number; d: number; ray: boolean; t: number; c: C }
export interface FinOpt extends FinShape {
  ramp: Ramp;
  rayRamp?: Ramp;
  t?: number; grad?: number;
  alpha?: number;
  spines?: boolean;
  edge?: C | null;
  /** ray contrast (sharks' fine radials barely show) */
  rayK?: number;
  z?: number; ink?: boolean; minPx?: number;
  mark?: (p: Px, f: FinCtx) => C | null;
  move?: () => Move | null;
  when?: () => boolean;
}
export function fin(o: FinOpt): Part {
  const { pts, rays } = o;
  let sp = 0;
  for (let i = 1; i < rays.length; i++) sp += Math.hypot(rays[i][1][0] - rays[i - 1][1][0], rays[i][1][1] - rays[i - 1][1][1]);
  sp /= Math.max(1, rays.length - 1);
  const len = rays.map(r => Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]));
  const ctx: FinCtx = { s: 0, a: 0, d: 0, ray: false, t: 0, c: 0 };
  let lastS = -1, st = 1;
  const rk = o.rayK ?? 1;
  return {
    z: o.z ?? 5, ink: o.ink, bounds: pts, minPx: o.minPx, move: o.move, when: o.when,
    hit: (x, y) => inPoly(pts, x, y),
    paint(p) {
      if (p.S !== lastS) { lastS = p.S; st = Math.max(1, Math.ceil(2.05 / Math.max(1e-6, sp * p.S))); }
      let bd = Infinity, ba = 0, bk = 0;
      for (let k = 0; k < rays.length; k += st) {
        const [d, a] = segDist(p.x, p.y, rays[k][0], rays[k][1]);
        if (d < bd) { bd = d; ba = a; bk = k; }
      }
      const dpx = bd * p.S, rl = (len[bk] ?? 0) * p.S, out = ba * rl;
      let t = (o.t ?? 2) + 0.1 + ba * (o.grad ?? 1.5) + p.L[2] * 0.2;
      let a = ba > 0.62 ? o.alpha ?? 205 : 255;
      const ray = rk > 0 && rays.length > 0 && dpx < 0.5 && out > 0.6 && (o.spines || ba > 0.18);
      let c: C;
      if (ray) {
        let tr = t + (o.spines ? 1.1 : 0.8) * rk;
        if (!o.spines && rl > 12 && frac(out / 3) < 0.3) tr -= 0.5 * rk;
        c = tone(o.spines ? o.rayRamp ?? o.ramp : o.ramp, tr);
        a = o.spines ? 255 : Math.max(a, 230);
      } else c = tone(o.ramp, t);
      if (out < 1.4) a = 255;
      if (o.edge && p.detail > 0.4 && ba > 0.3 && !ray && polyEdgeDist(pts, p.x, p.y) * p.S < 0.9) { c = o.edge; a = Math.max(a, 235); }
      if (o.mark) {
        ctx.s = rays.length > 1 ? bk / (rays.length - 1) : 0.5; ctx.a = ba; ctx.d = dpx; ctx.ray = ray; ctx.t = t; ctx.c = c;
        const m = o.mark(p, ctx);
        if (m) return (m >>> 24) < 255 ? m : withAlpha(m, a);
      }
      return withAlpha(c, a);
    },
  };
}
export function dorsal(prof: Pt[], x0: number, x1: number, h: (s: number) => number, dir: -1 | 1, rake: number, nRays: number, spines = 0): FinShape {
  const f = curve(prof);
  const N = Math.max(16, spines * 8, nRays * 2);
  const P = (s: number): [Pt, Pt] => {
    const x = x0 + (x1 - x0) * s, y = f(x), hh = Math.abs(h(s));
    return [[x, y - dir * 0.012], [x - hh * rake, y + dir * hh]];
  };
  const base: Pt[] = [], edge: Pt[] = [];
  for (let i = 0; i <= N; i++) { const [b, e] = P(i / N); base.push(b); edge.push(e); }
  const rays: [Pt, Pt][] = [];
  if (spines) { for (let k = 1; k <= spines; k++) { const s = k / spines; if (Math.abs(h(s)) > 0.012) rays.push(P(s)); } }
  else for (let k = 0; k < nRays; k++) rays.push(P((k + 0.5) / nRays));
  return { pts: [...base, ...edge.reverse()], rays };
}
export function fan(b0: Pt, b1: Pt, outer: Pt[], n: number, rayPath: Pt[] = outer): FinShape {
  const rays: [Pt, Pt][] = [];
  for (let k = 0; k < n; k++) {
    const s = n === 1 ? 0.5 : k / (n - 1);
    rays.push([[b0[0] + (b1[0] - b0[0]) * s, b0[1] + (b1[1] - b0[1]) * s], along(rayPath, s)]);
  }
  return { pts: [b0, ...outer, b1], rays };
}
export function tail(xp: number, hp: number, span: number, fork: number, n: number, round = 0): FinShape {
  const nn = xp * fork * 0.85;
  const trail: Pt[] = round > 0
    ? [[0.02, -span], [-round * 0.4, -span * 0.5], [-round * 0.55, 0], [-round * 0.4, span * 0.5], [0.02, span]]
    : [[0, -span], [nn * 0.45, -span * 0.42], [nn, 0], [nn * 0.45, span * 0.42], [0, span]];
  return fan([xp + 0.02, -hp], [xp + 0.02, hp], [[xp * 0.5, -span * 0.7], ...trail, [xp * 0.5, span * 0.7]], n, trail);
}
export const spiny = (hmax: number, n: number, shape: (s: number) => number = s => Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.7), dip = 0.42) =>
  (s: number) => hmax * shape(s) * (1 - dip + dip * Math.pow(Math.abs(Math.cos(s * n * Math.PI)), 2));
export const softH = (hmax: number, p = 1) => (s: number) => hmax * Math.pow(Math.sin(Math.PI * s), p);

// ------------------------------------------------------------------ tubes and discs
export interface TubeOpt {
  pts: Pt[]; r: number[]; ramp: Ramp; z?: number; t?: number; ink?: boolean; minPx?: number;
  rings?: number;
  mark?: (p: Px, s: number, t: number, d: number) => C | null;
  move?: () => Move | null;
  when?: () => boolean;
}
export function tube(o: TubeOpt): Part {
  const { pts, r } = o;
  let tot = 0;
  const segL: number[] = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segL.push(l); tot += l; }
  const near = (x: number, y: number, S: number): [number, number, number, number, number] | null => {
    let best: [number, number, number, number, number] | null = null;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [d, t] = segDist(x, y, pts[i - 1], pts[i]);
      const rr = Math.max(r[i - 1] + (r[i] - r[i - 1]) * t, (o.minPx ?? 0.5) / S);
      if (d <= rr && (!best || d / rr < best[0])) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
        const side = ((x - pts[i - 1][0]) * dy - (y - pts[i - 1][1]) * dx) < 0 ? -1 : 1;
        best = [d / rr, side, (acc + segL[i - 1] * t) / tot, i - 1, rr];
      }
      acc += segL[i - 1];
    }
    return best;
  };
  const b: Pt[] = [];
  pts.forEach((q, i) => { b.push([q[0] - r[i], q[1] - r[i]], [q[0] + r[i], q[1] + r[i]]); });
  return {
    z: o.z ?? 12, ink: o.ink, minPx: o.minPx, bounds: b, move: o.move, when: o.when,
    hit: (x, y, S) => !!near(x, y, S),
    paint(p) {
      const n = near(p.x, p.y, p.S);
      if (!n) return 0;
      const [d, side, s, i, rr] = n;
      const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], dl = Math.hypot(dx, dy) || 1;
      const nx = -(dy / dl) * side * d * 0.95, ny = (dx / dl) * side * d * 0.95, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let t = (o.t ?? 2) + (nx * p.L[0] + ny * p.L[1] + nz * p.L[2] - 0.5) * 2;
      if (rr * p.S >= 1.5 && nx * p.H[0] + ny * p.H[1] + nz * p.H[2] > 0.96) t += 1.2;
      if (o.rings && rr * p.S >= 1.4) {
        const k = frac(s * o.rings);
        if (k < 0.16) t -= 1; else if (k < 0.3) t += 0.35;
      }
      return o.mark?.(p, s, t, d) ?? tone(o.ramp, t);
    },
  };
}
export interface DiscOpt { x: number; y: number; rx: number; ry?: number; ramp: Ramp; z?: number; t?: number; ink?: boolean; light?: number; mark?: (p: Px, nx: number, ny: number, t: number) => C | null; move?: () => Move | null; when?: () => boolean }
export function disc(o: DiscOpt): Part {
  const ry = o.ry ?? o.rx;
  return {
    z: o.z ?? 12, ink: o.ink, move: o.move, when: o.when, bounds: [[o.x - o.rx, o.y - ry], [o.x + o.rx, o.y + ry]],
    hit: (x, y) => ((x - o.x) / o.rx) ** 2 + ((y - o.y) / ry) ** 2 <= 1,
    paint(p) {
      const nx = (p.x - o.x) / o.rx, ny = (p.y - o.y) / ry;
      const k = Math.min(0.97, Math.hypot(nx, ny)), a = Math.atan2(ny, nx), Nx = Math.cos(a) * k, Ny = Math.sin(a) * k, Nz = Math.sqrt(1 - k * k);
      const t = (o.t ?? 2) + (Nx * p.L[0] + Ny * p.L[1] + Nz * p.L[2] - 0.5) * (o.light ?? 1.6) * 1.4;
      return o.mark?.(p, nx, ny, t) ?? tone(o.ramp, t);
    },
  };
}
/** a closed contour part (spline through landmarks, a polygon after), shaded as a soft dome from its rim */
export interface BlobOpt { pts: Pt[]; ramp: Ramp; z?: number; t?: number; ink?: boolean; dome?: number; mark?: (p: Px, t: number, e: number) => C | null; move?: () => Move | null; when?: () => boolean; minPx?: number }
export function blob(o: BlobOpt): Part {
  const pts = o.pts;
  let cx = 0, cy = 0;
  for (const q of pts) { cx += q[0]; cy += q[1]; }
  cx /= pts.length; cy /= pts.length;
  let R = 0;
  for (const q of pts) R = Math.max(R, Math.hypot(q[0] - cx, q[1] - cy));
  return {
    z: o.z ?? 12, ink: o.ink, move: o.move, when: o.when, bounds: pts, minPx: o.minPx,
    hit: (x, y) => inPoly(pts, x, y),
    paint(p) {
      const e = clamp01(polyEdgeDist(pts, p.x, p.y) / (R * (o.dome ?? 0.5)));
      const dx = (p.x - cx) / R, dy = (p.y - cy) / R;
      const k = 1 - e;
      const nx = dx * k, ny = dy * k, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const t = (o.t ?? 2) + (nx * p.L[0] + ny * p.L[1] + nz * p.L[2] - 0.5) * 2.2;
      return o.mark?.(p, t, e) ?? tone(o.ramp, t);
    },
  };
}

// ------------------------------------------------------------------ the rasteriser
export interface View {
  S: number;
  rot: number;
  ox: number; oy: number;
  detail: number;
  /** mask passes skip noShadow parts */
  world?: boolean;
}
const LIGHT: [number, number, number] = (() => { const l = [-0.5, -0.72, 0.55]; const n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n] as [number, number, number]; })();

/** y bend (fish units, belly-ward) at fish x */
function bendAt(a: FishArt, x: number) {
  const P = POSE, span = a.x1 - a.x0, u = (x - a.x0) / span;
  let y = (P.swing ?? 0) * Math.pow(Math.max(0, 0.62 - u) / 0.62, 2) * span * 0.18 + (P.arch ?? 0) * (Math.pow(u - 0.52, 2) - 0.08) * span * 1.5;
  if (P.bend) y += P.bend(u) * span;
  return y;
}
/** the tail sweep: x after the turn of the tail (forward map, a table per raster) */
interface Sweep { xp: number; f: Float64Array; x0: number; dx: number }
function sweepTab(a: FishArt): Sweep | null {
  const s = POSE.sweep ?? 0;
  if (!s) return null;
  const xp = a.sweepX ?? 0.6, A = (a.sweepA ?? 0.9) * s, x0 = a.x0 - 0.25, n = 96, dx = (xp - x0) / n;
  const f = new Float64Array(n + 1);
  // integrate back from the pivot: apparent x = xp - integral of cos(theta) toward the tail
  f[n] = xp;
  for (let i = n - 1; i >= 0; i--) {
    const xm = x0 + (i + 0.5) * dx, w = Math.pow(clamp01((xp - xm) / (xp - a.x0)), 1.6);
    f[i] = f[i + 1] - Math.cos(A * w) * dx;
  }
  return { xp, f, x0, dx };
}
/** local (rest) x -> apparent x */
function sweepFwd(sw: Sweep, x: number) {
  if (x >= sw.xp) return x;
  const k = (x - sw.x0) / sw.dx;
  if (k <= 0) return sw.f[0] - (sw.x0 - x) * ((sw.f[1] - sw.f[0]) / sw.dx);
  const i = Math.floor(k);
  return sw.f[i] + (sw.f[i + 1] - sw.f[i]) * (k - i);
}
/** apparent x -> local x (the table is monotone) */
function sweepInv(sw: Sweep, X: number) {
  if (X >= sw.xp) return X;
  const f = sw.f;
  if (X <= f[0]) return sw.x0 - (f[0] - X) / Math.max(1e-6, (f[1] - f[0]) / sw.dx);
  let lo = 0, hi = f.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m] <= X) lo = m; else hi = m; }
  return sw.x0 + (lo + (X - f[lo]) / Math.max(1e-9, f[hi] - f[lo])) * sw.dx;
}

interface Ctx { a: FishArt; v: View; sw: Sweep | null; xc: number; sx: number; moves: (Move | null)[]; on: boolean[] }
function ctxFor(a: FishArt, v: View): Ctx {
  return {
    a, v, sw: sweepTab(a), xc: (a.x0 + a.x1) / 2, sx: POSE.sx ?? 1,
    moves: a.parts.map(p => p.move?.() ?? null), on: a.parts.map(p => (p.when ? p.when() : true)),
  };
}
/** pixel -> fish (rest) coords, before any part's own move */
function toLocal(c: Ctx, px: number, py: number): Pt {
  const v = c.v, cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  const dx = px - v.ox, dy = py - v.oy;
  let x = (dx * cs + dy * sn) / v.S;
  let y = (-dx * sn + dy * cs) / v.S;
  if (c.sx !== 1) x = c.xc + (x - c.xc) / c.sx;
  if (c.sw) x = sweepInv(c.sw, x);
  y += bendAt(c.a, x);
  return [x, y];
}
/** fish coords -> pixel */
function toPx(c: Ctx, x: number, y: number): Pt {
  const v = c.v;
  const yb = y - bendAt(c.a, x);
  let X = c.sw ? sweepFwd(c.sw, x) : x;
  if (c.sx !== 1) X = c.xc + (X - c.xc) * c.sx;
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  return [v.ox + (X * cs - yb * sn) * v.S, v.oy + (X * sn + yb * cs) * v.S];
}
function unmove(m: Move, x: number, y: number): Pt {
  let X = x - (m.dx ?? 0), Y = y - (m.dy ?? 0);
  if (m.a) { const c = Math.cos(-m.a), s = Math.sin(-m.a), ux = X - m.cx, uy = Y - m.cy; X = m.cx + ux * c - uy * s; Y = m.cy + ux * s + uy * c; }
  if (m.sy !== undefined && m.sy !== 1) Y = m.cy + (Y - m.cy) / (Math.abs(m.sy) < 0.05 ? 0.05 * Math.sign(m.sy || 1) : m.sy);
  return [X, Y];
}
function domove(m: Move, x: number, y: number): Pt {
  let X = x, Y = y;
  if (m.sy !== undefined && m.sy !== 1) Y = m.cy + (Y - m.cy) * m.sy;
  if (m.a) { const c = Math.cos(m.a), s = Math.sin(m.a), ux = X - m.cx, uy = Y - m.cy; X = m.cx + ux * c - uy * s; Y = m.cy + ux * s + uy * c; }
  return [X + (m.dx ?? 0), Y + (m.dy ?? 0)];
}
function pxFor(v: View): Px {
  const cs = Math.cos(v.rot), sn = Math.sin(v.rot);
  const L: [number, number, number] = [LIGHT[0] * cs + LIGHT[1] * sn, -LIGHT[0] * sn + LIGHT[1] * cs, LIGHT[2]];
  const h = [L[0], L[1], L[2] + 1], hn = Math.hypot(h[0], h[1], h[2]);
  return { x: 0, y: 0, px: 0, py: 0, S: v.S, L, H: [h[0] / hn, h[1] / hn, h[2] / hn], detail: v.detail };
}
function shadeAt(c: Ctx, pp: Px, px: number, py: number, mask: boolean, fx = 0.5, fy = 0.5): [C, number] {
  const [x, y] = toLocal(c, px + fx, py + fy);
  const P = c.a.parts;
  let col: C = 0, top = -1;
  for (let i = P.length - 1; i >= 0; i--) {
    if (!c.on[i]) continue;
    const q = P[i];
    if (mask && q.noShadow) continue;
    const m = c.moves[i];
    let qx = x, qy = y;
    if (m) [qx, qy] = unmove(m, x, y);
    if (!q.hit(qx, qy, c.v.S)) continue;
    if (mask) return [0xffffffff, i];
    pp.x = qx; pp.y = qy; pp.px = px; pp.py = py;
    const ci = q.paint(pp);
    if (!ci) continue;
    if (top < 0) { col = ci; top = i; } else col = over(col, ci);
    if (col >>> 24 === 255) break;
  }
  return [col, top];
}
interface Raster { buf: PixelBuffer; part: Int16Array }
function raster(c: Ctx, w: number, h: number, mask = false, box?: [number, number, number, number]): Raster {
  const buf = new PixelBuffer(w, h);
  const part = new Int16Array(w * h).fill(-1);
  const pp = pxFor(c.v);
  const [bx0, by0, bx1, by1] = box ?? [0, 0, w, h];
  for (let py = Math.max(0, by0); py < Math.min(h, by1); py++) for (let px = Math.max(0, bx0); px < Math.min(w, bx1); px++) {
    const [col, top] = shadeAt(c, pp, px, py, mask);
    if (top < 0 || !col) continue;
    buf.data[py * w + px] = col;
    part[py * w + px] = top;
  }
  return { buf, part };
}
function inkUp(r: Raster, a: FishArt, inner = true) {
  const { buf, part } = r, w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!(src[i] >>> 24)) {
      const lo = op(x, y + 1), ri = op(x + 1, y), up = op(x, y - 1), le = op(x - 1, y);
      if (!(lo || ri || up || le)) continue;
      const k = lo ? i + w : ri ? i + 1 : up ? i - w : i - 1;
      const lit = (lo || ri) && !up && !le;
      d[i] = lmix(a.ink, withAlpha(src[k], 255), lit ? 0.42 : 0.2);
      continue;
    }
    if (!inner) continue;
    const pi = part[i], q = a.parts[pi];
    if (!q?.ink) continue;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const pj = part[ny * w + nx];
      if (pj >= 0 && pj !== pi && a.parts[pj].z < q.z) { d[i] = lmix(a.ink, withAlpha(src[i], 255), 0.38); break; }
    }
  }
}
function despeck(r: Raster, a: FishArt) {
  const { buf, part } = r, w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!(src[i] >>> 24)) continue;
    if (a.parts[part[i]]?.minPx) continue;
    const n = (op(x - 1, y) ? 1 : 0) + (op(x + 1, y) ? 1 : 0) + (op(x, y - 1) ? 1 : 0) + (op(x, y + 1) ? 1 : 0);
    if (n <= 1) { d[i] = 0; part[i] = -1; }
  }
}
function downsample(hi: Raster, w: number, h: number): Raster & { sub: Uint8Array } {
  const buf = new PixelBuffer(w, h), part = new Int16Array(w * h).fill(-1), sub = new Uint8Array(w * h);
  const W = hi.buf.w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const count = new Map<number, number>();
    let n = 0, bestN = 0, bp = -1, bs = 4;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const k = (y * 3 + j) * W + x * 3 + i, q = hi.part[k];
      if (q < 0) continue;
      n++;
      const wgt = (i === 1 && j === 1 ? 2 : 1) + (count.get(q) ?? 0);
      count.set(q, wgt);
      if (wgt > bestN) { bestN = wgt; bp = q; bs = j * 3 + i; }
    }
    if (n >= 4) { buf.data[y * w + x] = 0xffffffff; part[y * w + x] = bp; sub[y * w + x] = bs; }
  }
  return { buf, part, sub };
}
function repaint(r: Raster & { sub: Uint8Array }, c: Ctx) {
  const { buf, part, sub } = r, pp = pxFor(c.v);
  for (let py = 0; py < buf.h; py++) for (let px = 0; px < buf.w; px++) {
    const i = py * buf.w + px;
    if (part[i] < 0) continue;
    let [col, top] = shadeAt(c, pp, px, py, false);
    if (top < 0 || !col) [col, top] = shadeAt(c, pp, px, py, false, ((sub[i] % 3) + 0.5) / 3, (Math.floor(sub[i] / 3) + 0.5) / 3);
    if (top >= 0 && col) { buf.data[i] = col; part[i] = top; } else { buf.data[i] = 0; part[i] = -1; }
  }
}

/** the eye, placed by hand: socket, iris, pupil and a glint; the shark's pale glass eye and its
 *  nictitating membrane (rolled white) */
function drawEye(r: Raster, c: Ctx, boost = 1) {
  const a = c.a, b = r.buf, e = a.eye, st = POSE.eye ?? 'open';
  const [ex, ey] = toPx(c, e.x, e.y);
  const rp = e.r * c.v.S * boost * 1.2 * Math.max(0.6, c.sx);
  const put = (x: number, y: number, col: C) => { if (b.opaque(x, y)) b.set(x, y, col); };
  const pupil = e.pupil ?? hex('#07050a'), white = hex('#ffffff');
  const irisLo = lmix(e.iris, white, 0.3), irisHi = lmix(e.iris, a.ink, 0.45);
  const lid = lmix(a.ink, e.iris, 0.15);
  if (st === 'shut') {
    const x = Math.floor(ex), y = Math.floor(ey);
    for (let dx = -Math.max(1, Math.round(rp)); dx <= Math.max(0, Math.round(rp) - 1); dx++) put(x + dx, y, lid);
    return;
  }
  if (st === 'white') {
    // the third eyelid slides over: a blind milky membrane with a faint glint
    const R = Math.max(1, rp);
    for (let y = Math.floor(ey - R - 1); y <= Math.ceil(ey + R + 1); y++) for (let x = Math.floor(ex - R - 1); x <= Math.ceil(ex + R + 1); x++) {
      const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey);
      if (d > R) continue;
      put(x, y, d > R - 0.8 ? lmix(a.ink, hex('#c8d4dc'), 0.5) : y + 0.5 < ey ? hex('#e8f0f4') : hex('#b8c6d0'));
    }
    return;
  }
  if (rp < 0.7) { put(Math.floor(ex), Math.floor(ey), pupil); return; }
  if (rp < 1.2) {
    const x = Math.floor(ex), y = Math.floor(ey);
    put(x, y, pupil); put(x - 1, y, e.iris);
    return;
  }
  if (rp < 1.85) {
    const x = Math.floor(ex - 0.5), y = Math.floor(ey - 0.5);
    put(x, y, white); put(x + 1, y, pupil); put(x, y + 1, irisLo); put(x + 1, y + 1, pupil);
    if (st === 'narrow') { put(x, y, lid); put(x + 1, y, lid); }
    return;
  }
  for (let y = Math.floor(ey - rp - 1); y <= Math.ceil(ey + rp + 1); y++) for (let x = Math.floor(ex - rp - 1); x <= Math.ceil(ex + rp + 1); x++) {
    const X = x + 0.5 - ex, Y = y + 0.5 - ey, d = Math.hypot(X, Y);
    if (d > rp) continue;
    if (st === 'narrow' && Y < -rp * 0.25) { put(x, y, lid); continue; }
    if (d > rp - 0.9) { put(x, y, Y > rp * 0.45 ? lmix(e.ring ?? e.iris, white, 0.25) : e.ring ?? lmix(a.ink, e.iris, 0.25)); continue; }
    const pr = e.slit ? Math.hypot((X - 0.15) * 2.4, Y * 0.9) : Math.hypot(X - rp * 0.08, Y);
    if (pr < rp * (e.slit ? 0.7 : e.pupilR ?? 0.5)) { put(x, y, pupil); continue; }
    const k = Y / rp;
    put(x, y, k < -0.3 ? irisHi : k > 0.25 ? irisLo : e.iris);
  }
  const gx = Math.floor(ex - rp * 0.38), gy = Math.floor(ey - rp * 0.38);
  put(gx, gy, white);
  if (rp >= 3) put(gx + 1, gy, white);
  put(Math.floor(ex + rp * 0.3), Math.floor(ey + rp * 0.32), lmix(white, e.iris, 0.4));
}

// ------------------------------------------------------------------ renders
export interface Render { buf: PixelBuffer; ax: number; ay: number; head: Pt; eye: Pt }
/** render a fish at world scale (len px from tail tip to snout) in a w x h canvas with the fish point
 *  `anchor` at pixel (ax, ay), in the given pose */
export function renderFish(a: FishArt, len: number, w: number, h: number, ax: number, ay: number, anchor: Pt, ps: FishPose, o: { detail?: number } = {}): Render {
  const prev = POSE;
  POSE = ps;
  try {
    const S = len / (a.x1 - a.x0), L = len;
    const detail = o.detail ?? (L >= 48 ? 1 : L >= 26 ? 0.5 : 0.1);
    const v: View = { S, rot: ps.rot ?? 0, ox: 0, oy: 0, detail, world: L < 40 };
    // place the anchor: find where it lands with the origin at 0 and shift
    let c = ctxFor(a, v);
    const [qx, qy] = toPx(c, anchor[0], anchor[1]);
    v.ox = ax - qx; v.oy = ay - qy;
    c = ctxFor(a, v);
    let r: Raster;
    if (L < 24) {
      const hv: View = { ...v, S: S * 3, ox: v.ox * 3, oy: v.oy * 3, detail: 0.1 };
      const hc = ctxFor(a, hv);
      const lo = downsample(raster(hc, w * 3, h * 3, true), w, h);
      repaint(lo, c);
      r = lo;
    } else {
      // only the fish's own box (all parts, moved and bent) is rasterised
      const pts: Pt[] = [];
      a.parts.forEach((p, i) => { if (!c.on[i]) return; const m = c.moves[i]; for (const q of p.bounds) pts.push(toPx(c, ...(m ? domove(m, q[0], q[1]) : q))); });
      const x0 = Math.floor(Math.min(...pts.map(q => q[0]))) - 3, x1 = Math.ceil(Math.max(...pts.map(q => q[0]))) + 3;
      const y0 = Math.floor(Math.min(...pts.map(q => q[1]))) - 3, y1 = Math.ceil(Math.max(...pts.map(q => q[1]))) + 3;
      r = raster(c, w, h, false, [x0, y0, x1, y1]);
    }
    if (L >= 24 && L < 48) despeck(r, a);
    drawEye(r, c);
    inkUp(r, a, L >= 20);
    const head = toPx(c, ...(a.head ?? [a.x1, 0]));
    const eye = toPx(c, a.eye.x, a.eye.y);
    return { buf: r.buf, ax, ay, head, eye };
  } finally {
    POSE = prev;
  }
}

/** a fish as an item icon / still (head right, trimmed) */
export function fishStill(a: FishArt, len: number, ps: FishPose = {}): PixelBuffer {
  const S = len / (a.x1 - a.x0);
  const w = Math.ceil(len * 1.6) + 8, h = Math.ceil(len * 1.4) + 8;
  void S;
  return renderFish(a, len, w, h, Math.round(w / 2), Math.round(h / 2), [(a.x0 + a.x1) / 2, 0], ps).buf.trim(0).buf;
}

// ------------------------------------------------------------------ as a beast
export interface FishDefOpt {
  name: string;
  /** length in world px (tail tip .. snout) */
  len: number;
  height: number;
  art: () => FishArt;
  anims: Record<string, AnimDef>;
  pose(anim: string, f: number, n: number): FishPose;
  /** canvas (the anchor sits at its middle unless ox / oy are given) */
  w: number; h: number; ox?: number; oy?: number;
  /** the fixed fish point at the anchor (default the body middle on the axis) */
  anchor?: Pt;
  eyeFor?: (anim: string, f: number) => BeastEye;
  /** a hand-painted extra over the frame (a fish in the jaws, bubbles) */
  post?: (b: PixelBuffer, r: Render, anim: string, f: number) => void;
}
export function fishDef(o: FishDefOpt): SpeciesDef & { fishArt(): FishArt; render(anim: string, f: number): Render } {
  let art: FishArt | null = null;
  const getArt = () => { if (!art) { art = o.art(); art.parts.sort((p, q) => p.z - q.z); } return art; };
  const ox = o.ox ?? Math.round(o.w / 2), oy = o.oy ?? Math.round(o.h / 2);
  const render = (anim: string, f: number): Render => {
    const a = getArt();
    const n = o.anims[anim]?.frames ?? 1;
    const ps = o.pose(anim, ((f % n) + n) % n, n);
    const r = renderFish(a, o.len, o.w, o.h, ox, oy, o.anchor ?? [(a.x0 + a.x1) / 2, 0], ps);
    o.post?.(r.buf, r, anim, f);
    return r;
  };
  const anchor: Record<string, 'centre'> = {};
  for (const k of Object.keys(o.anims)) anchor[k] = 'centre';
  return {
    name: o.name, kind: 'fish', len: o.len, height: o.height, anims: o.anims, anchor,
    canvas: () => ({ w: o.w, h: o.h, ox, oy }),
    eyeFor: o.eyeFor,
    draw(sk: Sk, anim: string, frame: number) {
      const r = render(anim, frame);
      const b = r.buf;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        const c = b.data[y * b.w + x];
        if (c >>> 24) sk.over(x - sk.ox, y - sk.oy, c);
      }
      return { head: [r.head[0] - ox, r.head[1] - oy], eye: [r.eye[0] - ox, r.eye[1] - oy] };
    },
    fishArt: getArt,
    render,
  };
}

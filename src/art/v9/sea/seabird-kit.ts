// Contour kit for the seabird batch (vanebill, sackjaw, scythewing, and the shore birds swashrunner,
// shellwrench, twinfan, duskwaddler). Every mass is ONE continuous contour through anatomical
// landmarks, filled and lit on the Relief layer (beasts-relief.ts):
//
//  - loft(): the body, neck and head as one form: stations along a curved spine (tail base, rump,
//    back, breast, neck, occiput, crown, forehead), each with its own dorsal, ventral and lateral
//    radius. The silhouette of every station is the support of its cross-section seen through the
//    view (so a banked bird shows the right outline from below or above), and the contour is the
//    spline through those landmarks. loftAt() gives any pixel its place on the body (along the
//    spine, how dorsal / lateral its surface is) for plumage patterns that roll with the bird.
//  - wing(): a spread wing from a jointed 3D leading edge: the arm's secondaries with a scalloped
//    trailing edge, the hand's primaries fanned to separate tips (slots between the outer ones),
//    covert tracts in rows. Its texture knows the zone, feather index and feather edge of a pixel.
//  - fold(): a folded wing lying on the flank (coverts, greater coverts, tertials, secondaries and
//    the stacked primaries projecting past them).
//  - fan(): a tail of separate feathers fanned from the rump.
//  - leg(): a bird leg (tibia, the backward heel, scaled tarsus) and its foot: lobed snowshoe toes,
//    webbed paddles, shovel feet, perching grips or plain toes.
//
// Primitives (ellipses, capsules) appear only as invisible helpers for shading.

import { V2, V3, lumN, ik2, fr, TAU, v3add, v3sub, v3mul, v3norm, v3cross, v3dot } from '../../beasts-core';
import { Relief, Sp, Tx, LM, spline, fringe } from '../../beasts-relief';
import { View3, WingShape, WingPose } from './seabird';

export { Relief, spline, fringe };
export type { LM, Sp, Tx };

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const l2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** screen point (anchor-relative, y down) -> body space of an identity View3 */
export const B3 = (p: V2, z = 0): V3 => [p[0], -p[1], z];

/** nearest point on a polyline: segment index (of its end), param, distance, signed side, cumulative length */
export const NP = { i: 1, k: 0, d: 0, side: 1, s: 0 };
export function nearest(pts: V2[], x: number, y: number, cum?: number[]) {
  let best = Infinity, bi = 1, bk = 0, bs = 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy;
    let k = L2 > 0 ? ((x - a[0]) * sx + (y - a[1]) * sy) / L2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const dx = x - a[0] - sx * k, dy = y - a[1] - sy * k, d2 = dx * dx + dy * dy;
    if (d2 < best) { best = d2; bi = i; bk = k; bs = sx * dy - sy * dx > 0 ? 1 : -1; }
  }
  NP.i = bi; NP.k = bk; NP.d = Math.sqrt(best); NP.side = bs;
  NP.s = cum ? cum[bi - 1] + (cum[bi] - cum[bi - 1]) * bk : 0;
  return NP;
}
export function cumLen(pts: V2[]) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i], pts[i - 1]));
  return c;
}
/** resample a polyline to n points evenly by arc length */
export function resample(pts: V2[], n: number): V2[] {
  const c = cumLen(pts), L = c[c.length - 1] || 1e-6, out: V2[] = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1)) * L;
    while (j < pts.length - 1 && c[j] < s) j++;
    const t = (s - c[j - 1]) / Math.max(1e-6, c[j] - c[j - 1]);
    out.push(l2(pts[j - 1], pts[j], clamp(t)));
  }
  return out;
}
export function resample3(pts: V3[], n: number): V3[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const L = c[c.length - 1] || 1e-6, out: V3[] = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1)) * L;
    while (j < pts.length - 1 && c[j] < s) j++;
    const t = clamp((s - c[j - 1]) / Math.max(1e-6, c[j] - c[j - 1]));
    const a = pts[j - 1], b = pts[j];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

// ------------------------------------------------------------------ feather micro-relief
/**
 * Overlapping rows of contour feathers lying back along screen angle `ang`: returns the height
 * offset and sets FT.edge (1 on the dark edge under a feather tip, 0.5 on the pale fringe).
 */
export const FT = { edge: 0, row: 0, col: 0, fu: 0 };
export function feathers(x: number, y: number, ang: number, sx: number, sy: number, seed: number): number {
  const c = Math.cos(ang), s = Math.sin(ang);
  const u = x * c + y * s, v = -x * s + y * c;
  const row = Math.floor(v / sy), fv = v / sy - row - 0.5;
  const uu = u / sx + (row & 1) * 0.5 + fr(Math.sin(row * 12.9898 + seed) * 43758.5) * 0.3;
  const col = Math.floor(uu), fu = uu - col;
  FT.row = row; FT.col = col; FT.fu = fu;
  // each feather is a domed scale whose rounded tip points back (toward -u)
  const tip = 0.18 + fv * fv * 1.2;
  if (fu < tip) { FT.edge = 1; return -0.45; }
  if (fu < tip + 0.2) { FT.edge = 0.5; return 0.25; }
  FT.edge = 0;
  return (fu - 0.5) * 0.35 + Math.cos(fv * Math.PI) * 0.15;
}

// ------------------------------------------------------------------ loft (body + neck + head)
export interface Station { c: V3; up: V3; ru: number; rl: number; rw: number; sh?: number }
export interface Loft { V: View3; st: Station[]; n: number; s: V2[]; z: number[]; N: V2[]; top: number[]; bot: number[]; up: V3[]; side: V3[]; cum: number[] }

export function loft(V: View3, st: Station[]): Loft {
  const n = st.length;
  const s: V2[] = [], z: number[] = [];
  for (const q of st) { const p = V.s(q.c); s.push([p[0], p[1]]); z.push(p[2]); }
  const N: V2[] = [], top: number[] = [], bot: number[] = [], side: V3[] = [], up: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    N.push([ty, -tx]);
    const fwd = v3norm(v3sub(st[Math.min(n - 1, i + 1)].c, st[Math.max(0, i - 1)].c));
    const u0 = st[i].up;
    // make up perpendicular to the spine
    const u = v3norm(v3sub(u0, v3mul(fwd, v3dot(u0, fwd))));
    const sd = v3norm(v3cross(fwd, u));
    up.push(u); side.push(sd);
    let mx = 0, mn = 0;
    for (let k = 0; k < 20; k++) {
      const th = (k / 20) * TAU, c = Math.cos(th), sn = Math.sin(th);
      const r = c >= 0 ? st[i].ru : st[i].rl;
      const q = V.n([u[0] * r * c + sd[0] * st[i].rw * sn, u[1] * r * c + sd[1] * st[i].rw * sn, u[2] * r * c + sd[2] * st[i].rw * sn]);
      // q is in view space (y up): its screen offset (q0, -q1) dotted with N = (ty, -tx)
      const ds = (q[0] * ty + q[1] * tx) * V.k;
      if (ds > mx) mx = ds;
      if (ds < mn) mn = ds;
    }
    top.push(mx); bot.push(-mn);
  }
  return { V, st, n, s, z, N, top, bot, up, side, cum: cumLen(s) };
}

/**
 * The closed contour of a loft: the top line from the tail end to the head, a rounded nose cap of
 * `head` px, the bottom line back, and a tail cap of `tail` px. sharp flags come from the stations.
 */
export function loftOutline(L: Loft, o: { head?: number; tail?: number } = {}): LM[] {
  const { n, s, N, top, bot, st } = L;
  const out: LM[] = [];
  const tan = (i: number): V2 => [-N[i][1], N[i][0]];
  if (o.tail) {
    const T = tan(0), m = (top[0] - bot[0]) / 2;
    out.push([s[0][0] - T[0] * o.tail + N[0][0] * m, s[0][1] - T[1] * o.tail + N[0][1] * m, 0.2]);
  }
  for (let i = 0; i < n; i++) out.push([s[i][0] + N[i][0] * top[i], s[i][1] + N[i][1] * top[i], st[i].sh ?? 0]);
  if (o.head) {
    const T = tan(n - 1), m = (top[n - 1] - bot[n - 1]) / 2;
    out.push([s[n - 1][0] + T[0] * o.head + N[n - 1][0] * m, s[n - 1][1] + T[1] * o.head + N[n - 1][1] * m, 0]);
  }
  for (let i = n - 1; i >= 0; i--) out.push([s[i][0] - N[i][0] * bot[i], s[i][1] - N[i][1] * bot[i], st[i].sh ?? 0]);
  return out;
}

/** where a pixel lies on a loft: spine position, across offset, surface dorsalness and laterality */
export const LH = { f: 0, along: 0, across: 0, v: 0, dors: 0, lat: 0, z: 0, x: NaN, y: NaN };
export function loftAt(L: Loft, x: number, y: number) {
  if (x === LH.x && y === LH.y) return LH;
  const q = nearest(L.s, x, y, L.cum);
  const a = q.i - 1, b = q.i, k = q.k;
  const top = lerp(L.top[a], L.top[b], k), bot = lerp(L.bot[a], L.bot[b], k);
  let Nx = lerp(L.N[a][0], L.N[b][0], k), Ny = lerp(L.N[a][1], L.N[b][1], k);
  const nl = Math.hypot(Nx, Ny) || 1; Nx /= nl; Ny /= nl;
  const cx = lerp(L.s[a][0], L.s[b][0], k), cy = lerp(L.s[a][1], L.s[b][1], k);
  const across = (x - cx) * Nx + (y - cy) * Ny;
  const v = across >= 0 ? Math.min(1, across / Math.max(0.3, top)) : Math.max(-1, across / Math.max(0.3, bot));
  const w = Math.sqrt(Math.max(0, 1 - v * v));
  const nb = L.V.inv([Nx * v, -Ny * v, w]);
  const ua = L.up[a], ub = L.up[b], sa = L.side[a], sb = L.side[b];
  LH.dors = nb[0] * lerp(ua[0], ub[0], k) + nb[1] * lerp(ua[1], ub[1], k) + nb[2] * lerp(ua[2], ub[2], k);
  LH.lat = nb[0] * lerp(sa[0], sb[0], k) + nb[1] * lerp(sa[1], sb[1], k) + nb[2] * lerp(sa[2], sb[2], k);
  LH.f = a + k; LH.along = q.s; LH.across = across; LH.v = v;
  LH.z = lerp(L.z[a], L.z[b], k);
  LH.x = x; LH.y = y;
  return LH;
}

/** stations for a body + neck + head built from 2D landmarks in body space (z = 0 plane) */
export interface Prof { at: number; ru: number; rl: number; rw: number; sh?: number }
/** stations along a polyline spine (body space) with a radius profile sampled at spine fractions */
export function stations(spine: V3[], up: (t: number, i: number) => V3, prof: Prof[], n: number): Station[] {
  const pts = resample3(spine, n);
  const out: Station[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let j = 1;
    while (j < prof.length - 1 && prof[j].at < t) j++;
    const a = prof[j - 1], b = prof[j], k = clamp((t - a.at) / Math.max(1e-6, b.at - a.at));
    const e = k * k * (3 - 2 * k);
    out.push({ c: pts[i], up: up(t, i), ru: lerp(a.ru, b.ru, e), rl: lerp(a.rl, b.rl, e), rw: lerp(a.rw, b.rw, e), sh: k < 0.05 ? a.sh : k > 0.95 ? b.sh : 0 });
  }
  return out;
}

// ------------------------------------------------------------------ head frame
/** head-local frame in body space: x along the bill, y DOWN, z toward the near side */
export class HeadF {
  readonly side: V3;
  constructor(readonly V: View3, readonly c: V3, readonly fwd: V3, readonly up: V3) {
    this.side = v3norm(v3cross(fwd, up));
  }
  p(x: number, y: number, z = 0): V3 {
    const f = this.fwd, u = this.up, s = this.side;
    return [this.c[0] + f[0] * x - u[0] * y + s[0] * z, this.c[1] + f[1] * x - u[1] * y + s[1] * z, this.c[2] + f[2] * x - u[2] * y + s[2] * z];
  }
  s(x: number, y: number, z = 0, sh = 0): LM { const q = this.V.s(this.p(x, y, z)); return [q[0], q[1], sh]; }
  s2(x: number, y: number, z = 0): V2 { const q = this.V.s(this.p(x, y, z)); return [q[0], q[1]]; }
  zOf(x: number, y: number, z = 0) { return this.V.s(this.p(x, y, z))[2]; }
  /** does the near side of the head face the viewer? */
  facing(min = 0.05) { return this.V.n(this.side)[2] > min; }
  /** head-local coords of a screen pixel (inverse on the head's mid-plane) */
  local(x: number, y: number): V2 {
    const o = this.V.s(this.c), fx = this.V.s(v3add(this.c, this.fwd)), uy = this.V.s(v3sub(this.c, this.up));
    const ax = fx[0] - o[0], ay = fx[1] - o[1], bx = uy[0] - o[0], by = uy[1] - o[1];
    const det = ax * by - ay * bx || 1e-6, dx = x - o[0], dy = y - o[1];
    return [(dx * by - dy * bx) / det, (ax * dy - ay * dx) / det];
  }
}

// ------------------------------------------------------------------ spread wings
export interface WingFrame { le: V3[]; cd: V3[]; nrm: V3[]; chord: number[]; n: number }
/** the jointed leading edge of a wing (body space), the chord direction and top normal at each joint */
export function wingFrame(W: WingShape, P: WingPose, side: 1 | -1): WingFrame {
  const n = W.segs.length;
  const ce = Math.cos(P.elev), se = Math.sin(P.elev);
  const toBody = (l: V3): V3 => {
    const y = l[1] * ce + l[2] * se, z = -l[1] * se + l[2] * ce;
    return [W.sh[0] + l[0], W.sh[1] + y, side * (W.sh[2] + z)];
  };
  const loc: V3[] = [[0, 0, 0]];
  let p: V3 = [0, 0, 0];
  for (let j = 0; j < n; j++) {
    const g = W.segs[j];
    const outer = j >= Math.floor(n / 2);
    const sw = g.sweep + g.flex * P.flex + (outer ? P.sweep : 0);
    const dh = g.dih + (outer ? P.hand : P.hand * 0.25);
    const L = g.len * (1 - P.flex * (g.shrink ?? 0));
    const d: V3 = [Math.sin(sw) * Math.cos(dh), Math.sin(dh), Math.cos(sw) * Math.cos(dh)];
    p = v3add(p, v3mul(d, L));
    loc.push(p);
  }
  const le = loc.map(toBody);
  const cd: V3[] = [], nrm: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = i > 0 ? v3sub(le[i], le[i - 1]) : v3sub(le[1], le[0]);
    const b = i < n ? v3sub(le[i + 1], le[i]) : a;
    const d = v3norm(v3add(v3norm(a), v3norm(b)));
    const back: V3 = [-1, 0, 0];
    const c = v3norm(v3sub(back, v3mul(d, v3dot(back, d))));
    cd.push(c);
    nrm.push(v3norm(v3mul(v3cross(c, d), side)));
  }
  return { le, cd, nrm, chord: W.chord.slice(), n };
}

export interface WingLook {
  /** joint index of the wrist (joints before it carry the secondaries) */
  wrist: number;
  nS: number;
  /** depth of the notches between secondary tips (fraction of the chord) */
  scallop: number;
  nP: number;
  /** depth of the slots between the outer primaries (fraction of the primary length) */
  slot: number;
  /** how many outer primaries are separated as fingers */
  fingers: number;
  /** extra length of the outer primaries past the hand's chord line (body units) */
  reach?: number;
  /** covert tract boundaries (chord fractions), front to back */
  rows: number[];
  /** leading edge thickness (px) and minimum screen thickness of the blade */
  spar: number;
  minW?: number;
  /** sharpness of the primary tips (0 round .. 1 pointed) */
  point?: number;
}
export interface WingPx {
  x: number; y: number;
  /** 0 shoulder .. 1 tip along the leading edge, chord fraction 0 LE .. 1 trailing edge */
  s: number; c: number;
  hand: boolean; top: boolean;
  /** covert tract index (0..rows.length-1), or rows.length for the flight feathers */
  zone: number;
  /** flight feather index (primaries 0 inner .. nP-1 outer; secondaries 0 at the wrist), along it 0..1, edge 0 (border) .. 1 */
  fi: number; fu: number; edge: number;
}
export type WingFill = (w: WingPx, o: Tx) => void;
export interface WingOut { tip: V2; wrist: V2; top: boolean; le: V2[]; poly: V2[] }

/** paint a spread wing into its own Relief and emit it */
export function wing(R: Relief, V: View3, F: WingFrame, L: WingLook, fill: WingFill, o: { id?: number; lt?: number; zb?: number } = {}): WingOut {
  const n = F.n, w = L.wrist;
  const le3 = F.le, te3 = le3.map((q, i) => v3add(q, v3mul(F.cd[i], F.chord[i])));
  // primaries: bases along the hand bone, tips along the hand's trailing line out to the tip
  const handTE: V3[] = [];
  for (let i = w; i <= n; i++) handTE.push(te3[i]);
  const reach = L.reach ?? 0;
  const tips = resample3(handTE, L.nP).map((q, i, a) => {
    const t = i / Math.max(1, a.length - 1);
    // the tips bulge out from the hand (a rounded hand)
    const j = Math.min(n, w + Math.round(t * (n - w)));
    return v3add(q, v3mul(F.cd[j], reach * Math.sin(t * Math.PI) * 0.6));
  });
  tips[L.nP - 1] = v3add(le3[n], v3mul(F.cd[n], F.chord[n] * 0.5));
  const handLE: V3[] = [];
  for (let i = w; i <= n; i++) handLE.push(le3[i]);
  const bases = resample3(handLE, L.nP + 2).slice(0, L.nP);
  // secondaries: tips along the arm's trailing edge from the wrist back to the body
  const armTE: V3[] = [];
  for (let i = w; i >= 0; i--) armTE.push(te3[i]);
  const secs = resample3(armTE, L.nS + 1);
  const armLE: V3[] = [];
  for (let i = w; i >= 0; i--) armLE.push(le3[i]);
  const secB = resample3(armLE, L.nS + 1);
  // ---- outline, body space then projected
  const P = (q: V3) => V.s(q);
  const pt: { p: V3; sh: number; trail: boolean }[] = [];
  pt.push({ p: v3add(le3[0], v3mul(F.cd[0], -0.4)), sh: 0, trail: false });
  for (let i = 1; i <= n; i++) pt.push({ p: le3[i], sh: i === w ? 0.25 : i === n ? 0.6 : 0.1, trail: false });
  const point = L.point ?? 0.7;
  for (let i = L.nP - 1; i >= 0; i--) {
    if (i < L.nP - 1) pt.push({ p: tips[i], sh: point, trail: true });
    if (i > 0) {
      const finger = i >= L.nP - L.fingers;
      const dep = L.slot * (finger ? 1 : 0.25);
      const mt = v3mul(v3add(tips[i], tips[i - 1]), 0.5), mb = v3mul(v3add(bases[i], bases[i - 1]), 0.5);
      pt.push({ p: v3add(mt, v3mul(v3sub(mb, mt), dep)), sh: 0.5, trail: true });
    }
  }
  for (let j = 1; j <= L.nS; j++) {
    const mt = v3mul(v3add(secs[j], secs[j - 1]), 0.5), mb = v3mul(v3add(secB[j], secB[j - 1]), 0.5);
    pt.push({ p: v3add(mt, v3mul(v3sub(mb, mt), L.scallop)), sh: 0.4, trail: true });
    if (j < L.nS) pt.push({ p: secs[j], sh: 0.3, trail: true });
  }
  pt.push({ p: v3add(le3[0], v3mul(F.cd[0], F.chord[0] * 0.8)), sh: 0, trail: true });
  // projected leading edge
  const LE: V2[] = le3.map(q => { const s = P(q); return [s[0], s[1]] as V2; });
  const LEz = le3.map(q => P(q)[2]);
  const cum = cumLen(LE), tot = cum[cum.length - 1] || 1;
  const minW = L.minW ?? 1.2;
  const lm: LM[] = pt.map(q => {
    const s = P(q.p);
    let x = s[0], y = s[1];
    if (q.trail) {
      // keep the blade at least minW thick on screen when it is seen edge-on
      const h = nearest(LE, x, y);
      if (h.d < minW) {
        const a = LE[h.i - 1], b = LE[h.i], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
        let nx = -ty / tl, ny = tx / tl;
        if (ny < 0) { nx = -nx; ny = -ny; }
        const ex = a[0] + tx * h.k, ey = a[1] + ty * h.k;
        x = ex + nx * minW; y = ey + ny * minW;
      }
    }
    return [x, y, q.sh];
  });
  const poly = spline(lm, 0.5);
  // chord in px at each joint (for the chord fraction)
  const chPx = le3.map((q, i) => Math.max(minW, dist(LE[i], [P(te3[i])[0], P(te3[i])[1]])));
  const tipS = tips.map(q => { const s = P(q); return [s[0], s[1]] as V2; });
  const baseS = bases.map(q => { const s = P(q); return [s[0], s[1]] as V2; });
  // panel facing and light per segment
  const facing: boolean[] = [], light: number[] = [];
  for (let j = 0; j < n; j++) {
    const nv = V.n(v3norm(v3add(F.nrm[j], F.nrm[j + 1])));
    facing.push(nv[2] >= 0);
    const t: V3 = nv[2] >= 0 ? nv : [-nv[0], -nv[1], -nv[2]];
    light.push((lumN(t[0], -t[1], t[2]) - 0.66) * 0.35);
  }
  const rows = L.rows, nr = rows.length;
  const WP: WingPx = { x: 0, y: 0, s: 0, c: 0, hand: false, top: true, zone: 0, fi: 0, fu: 0, edge: 1 };
  let zc = 0;
  const tex = (p: Sp, out: Tx) => {
    const h = nearest(LE, p.x, p.y, cum);
    const j = h.i - 1, k = h.k;
    const s = h.s / tot;
    const ch = lerp(chPx[j], chPx[j + 1], k);
    const c = clamp(h.d / ch, 0, 1.2);
    zc = lerp(LEz[j], LEz[j + 1], k);
    const hand = j >= w;
    WP.x = p.x; WP.y = p.y; WP.s = s; WP.c = Math.min(1, c); WP.hand = hand; WP.top = facing[j];
    out.t += light[j];
    // covert tracts: rows of overlapping feathers with scalloped trailing borders
    let zone = nr;
    for (let r = 0; r < nr; r++) {
      const nf = 6 + r * 4 + (hand ? 0 : 4);
      const f = fr(s * nf * (1 + r * 0.3) + r * 0.37);
      const border = rows[r] + 0.05 * Math.sin(f * Math.PI);
      if (c < border) {
        zone = r;
        WP.fi = Math.floor(s * nf); WP.fu = c / border; WP.edge = Math.min(1, (border - c) * 12, Math.min(f, 1 - f) * 4);
        if (border - c < 0.05) out.z -= 0.45; else out.z += (c / border) * 0.3;
        if (f < 0.1) out.z -= 0.2;
        break;
      }
    }
    if (zone === nr) {
      if (hand && L.nP > 1) {
        // nearest primary shaft and the next nearest: their difference is the gap between feathers
        let d1 = Infinity, d2 = Infinity, i1 = 0, u1 = 0;
        for (let i = 0; i < L.nP; i++) {
          const a = baseS[i], b = tipS[i], sx = b[0] - a[0], sy = b[1] - a[1], LL = sx * sx + sy * sy || 1e-6;
          let kk = ((p.x - a[0]) * sx + (p.y - a[1]) * sy) / LL; kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
          const d = Math.hypot(p.x - a[0] - sx * kk, p.y - a[1] - sy * kk);
          if (d < d1) { d2 = d1; d1 = d; i1 = i; u1 = kk; } else if (d < d2) d2 = d;
        }
        WP.fi = i1; WP.fu = u1; WP.edge = clamp((d2 - d1) / 1.4);
        if (WP.edge < 0.3) out.z -= 0.35; else out.z += 0.1;
      } else {
        const sa = 1 - clamp(h.s / Math.max(1e-6, cum[w]));
        const f = sa * L.nS;
        WP.fi = Math.floor(f); WP.fu = (c - rows[nr - 1]) / Math.max(0.1, 1 - rows[nr - 1]);
        const e = Math.min(fr(f), 1 - fr(f));
        WP.edge = clamp(e * 4);
        if (e < 0.12) out.z -= 0.3;
      }
    }
    WP.zone = zone;
    fill(WP, out);
  };
  R.region(poly, { zAt: () => zc, R: 1.2, H: 0.9, id: o.id ?? 9, lt: o.lt ?? 0, tex });
  // the leading edge: the wing's thick front (bones and the patagium) stays a line edge-on
  if (L.spar > 0) {
    let sz = 0;
    R.tube(LE.slice(0, n), t => L.spar * (1 - t * 0.45), {
      z: t => { const f = t * (n - 1), i = Math.min(n - 2, Math.floor(f)); sz = lerp(LEz[i], LEz[i + 1], f - i); return sz + 0.3; }, id: o.id ?? 9,
      tex: (p, out) => {
        const h = nearest(LE, p.x, p.y, cum);
        const j = h.i - 1;
        WP.x = p.x; WP.y = p.y; WP.s = h.s / tot; WP.c = 0; WP.hand = j >= w; WP.top = facing[j]; WP.zone = 0; WP.fi = 0; WP.fu = 0; WP.edge = 1;
        out.t += light[j];
        fill(WP, out);
      },
    });
  }
  const top0 = facing[Math.min(1, n - 1)];
  return { tip: LE[n], wrist: LE[w], top: top0, le: LE, poly };
}

// ------------------------------------------------------------------ tail fan
export interface FanOut { poly: LM[]; shafts: [V2, V2][]; root: V2; tip: V2 }
/**
 * A tail of n feathers fanned in the plane (back, lat) from root, body space, projected. len(t)
 * gives each feather's length (t 0..1 across). minW keeps an edge-on tail a blade.
 */
export function fan(V: View3, root: V3, back: V3, lat: V3, n: number, spread: number, len: (t: number) => number, o: { minW?: number; notch?: number; base?: number; point?: number } = {}): FanOut {
  const tips: V3[] = [], dirs: V3[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), a = (t - 0.5) * spread;
    const d = v3norm(v3add(v3mul(back, Math.cos(a)), v3mul(lat, Math.sin(a))));
    dirs.push(d);
    tips.push(v3add(root, v3mul(d, len(t))));
  }
  const S = (q: V3): V2 => { const s = V.s(q); return [s[0], s[1]]; };
  const r0 = S(root);
  const st = tips.map(S);
  // screen axis of the tail and its perpendicular
  const mid = st[Math.floor(n / 2)];
  const ax = mid[0] - r0[0], ay = mid[1] - r0[1], al = Math.hypot(ax, ay) || 1;
  const px = -ay / al, py = ax / al;
  const minW = o.minW ?? 1.2;
  // spread tips across the axis by at least minW (an edge-on fan stays a blade)
  const off = st.map(p => (p[0] - r0[0]) * px + (p[1] - r0[1]) * py);
  const lo = Math.min(...off), hi = Math.max(...off);
  if (hi - lo < minW * 2) {
    const c = (hi + lo) / 2;
    for (let i = 0; i < n; i++) {
      const want = c + (n === 1 ? 0 : (i / (n - 1) - 0.5) * minW * 2);
      const d = want - off[i];
      st[i] = [st[i][0] + px * d, st[i][1] + py * d];
    }
  }
  const base = o.base ?? 0.6, notch = o.notch ?? 0.12, point = o.point ?? 0.5;
  const sideOf = (i: number): V2 => { const p = st[i]; return [p[0] - r0[0], p[1] - r0[1]]; };
  const poly: LM[] = [];
  // root corners
  const w0 = Math.max(minW * 0.6, base);
  poly.push([r0[0] - px * w0, r0[1] - py * w0, 0]);
  for (let i = 0; i < n; i++) {
    poly.push([st[i][0], st[i][1], point]);
    if (i < n - 1) {
      const m = l2(st[i], st[i + 1], 0.5), v = sideOf(i);
      void v;
      poly.push([m[0] + (r0[0] - m[0]) * notch, m[1] + (r0[1] - m[1]) * notch, 0.3]);
    }
  }
  poly.push([r0[0] + px * w0, r0[1] + py * w0, 0]);
  const shafts: [V2, V2][] = st.map(p => [r0, p]);
  return { poly, shafts, root: r0, tip: mid };
}

/** feather index / edge of a pixel inside a fan */
export const FN = { i: 0, u: 0, edge: 1 };
export function fanAt(F: FanOut, x: number, y: number) {
  let d1 = Infinity, d2 = Infinity, i1 = 0, u1 = 0;
  F.shafts.forEach(([a, b], i) => {
    const sx = b[0] - a[0], sy = b[1] - a[1], LL = sx * sx + sy * sy || 1e-6;
    let k = ((x - a[0]) * sx + (y - a[1]) * sy) / LL; k = k < 0 ? 0 : k > 1 ? 1 : k;
    const d = Math.hypot(x - a[0] - sx * k, y - a[1] - sy * k);
    if (d < d1) { d2 = d1; d1 = d; i1 = i; u1 = k; } else if (d < d2) d2 = d;
  });
  FN.i = i1; FN.u = u1; FN.edge = clamp((d2 - d1) / 1.2);
  return FN;
}

// ------------------------------------------------------------------ folded wing
export interface FoldLook {
  /** wing-local outline: u 0 (carpal) .. 1 (primary tips), v 0 (top edge) .. 1 (lower edge) */
  len: number; dep: number;
  /** where the tertials end and the primaries project alone (fraction of len) */
  tert: number;
  nP: number;
  /** rows: lesser coverts end, greater coverts end (v) */
  cov: number; gc: number;
}
export interface FoldPx { u: number; v: number; zone: 'les' | 'gc' | 'sec' | 'ter' | 'pri'; fi: number; edge: number }
export type FoldFill = (f: FoldPx, o: Tx, p: Sp) => void;
/**
 * The closed wing on the flank. map(u, v) -> screen (u along the wing, v down across it). The
 * outline: the rounded bend of the wing, the top edge under the scapulars, the tertials' rounded
 * ends, the primaries tapering to a point, the lower edge along the flank.
 */
export function foldOutline(map: (u: number, v: number) => V2, L: FoldLook): LM[] {
  const P = (u: number, v: number, sh = 0): LM => { const q = map(u, v); return [q[0], q[1], sh]; };
  const t = L.tert;
  return [
    P(0.02, 0.35), P(0.0, 0.62), P(0.06, 0.9), P(0.25, 1.0), P(t * 0.85, 0.96), P(t, 0.8, 0.3),
    P(t + (1 - t) * 0.45, 0.66), P(0.97, 0.5, 0.3), P(1, 0.42, 0.85), P(0.96, 0.32, 0.3), P(t + (1 - t) * 0.4, 0.22), P(t, 0.12),
    P(t * 0.6, 0.02), P(0.16, 0.0), P(0.05, 0.1),
  ];
}
export function foldTex(L: FoldLook, inv: (x: number, y: number) => V2, fill: FoldFill) {
  const FP: FoldPx = { u: 0, v: 0, zone: 'les', fi: 0, edge: 1 };
  return (p: Sp, o: Tx) => {
    const [u, v] = inv(p.x, p.y);
    FP.u = u; FP.v = v;
    const t = L.tert;
    if (u > t + 0.02 * (1 - v)) {
      // primaries stacked to the point: each step of the lower edge is the tip of the next one
      const f = (u - t) / (1 - t) * L.nP + v * 1.6;
      FP.zone = 'pri'; FP.fi = Math.floor(f); FP.edge = clamp(Math.min(fr(f), 1 - fr(f)) * 5);
      if (fr(f) < 0.16) o.z -= 0.45;
    } else if (v < L.cov - 0.05 * Math.sin(u * 40) && u < t * 0.8) {
      const fu = u * 16 + (Math.floor(v * 5) & 1) * 0.5;
      FP.zone = 'les'; FP.fi = Math.floor(fu); FP.edge = clamp(Math.min(fr(v * 5), fr(fu) * 2) * 4);
      if (fr(v * 5) > 0.78) o.z -= 0.3;
    } else if (v < L.gc && u < t * 0.85) {
      const fu = u * 10;
      FP.zone = 'gc'; FP.fi = Math.floor(fu); FP.edge = clamp((L.gc - v) * 12);
      if (L.gc - v < 0.07) o.z -= 0.45; else o.z += 0.2;
    } else if (u > t * 0.55 && v < 0.75) {
      // tertials: long, broad, lying over the secondaries
      const f = v * 3.2 - u * 0.8;
      FP.zone = 'ter'; FP.fi = Math.floor(f); FP.edge = clamp(Math.min(fr(f), 1 - fr(f)) * 5);
      if (fr(f) < 0.14) o.z -= 0.4;
    } else {
      const f = u * 9;
      FP.zone = 'sec'; FP.fi = Math.floor(f); FP.edge = clamp(Math.min(fr(f), 1 - fr(f)) * 5);
      if (fr(f) < 0.12) o.z -= 0.35;
    }
    fill(FP, o, p);
  };
}
/** a wing-local affine map (carpal at c, wing axis angle a (screen), length, depth) and its inverse */
export function foldMap(c: V2, a: number, len: number, dep: number, droop = 0) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const map = (u: number, v: number): V2 => {
    const x = u * len, y = v * dep + droop * u * u * len * 0.3;
    return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca];
  };
  const inv = (px: number, py: number): V2 => {
    const dx = px - c[0], dy = py - c[1];
    const x = dx * ca + dy * sa, y = -dx * sa + dy * ca;
    const u = x / len;
    return [u, (y - droop * u * u * len * 0.3) / dep];
  };
  return { map, inv };
}

// ------------------------------------------------------------------ legs and feet
export interface LegLook {
  tib: number; tar: number;
  rTib: number; rTar: number;
  toe: number;
  foot: 'lobe' | 'web' | 'shovel' | 'perch' | 'plain';
  claw?: number;
  /** fraction of the visible tibia that is feathered */
  feath?: number;
}
export interface LegMats { tib: number; leg: number; toe: number; web: number; claw: number; feath?: number }
export interface LegPose {
  /** toe direction (screen angle, 0 = forward along the ground) */
  ta?: number;
  /** curl the toes (perching grip or tucked in flight) 0..1 */
  curl?: number;
  /** web / lobes spread 0..1 */
  spread?: number;
  /** flat on the ground at y = ground (toes clamped) */
  ground?: number;
  /** heel bend: +1 heel behind (normal), -1 forward */
  bend?: number;
}
/** Paint a bird leg from the hip (hidden in the belly) to the foot into R. Returns the heel and foot. */
export function leg(R: Relief, hip: V2, foot: V2, L: LegLook, M: LegMats, z: number, k: number, P: LegPose = {}, id = 20): { heel: V2; foot: V2 } {
  const [heel, end] = ik2(hip, foot, L.tib * k, L.tar * k, P.bend ?? 1);
  const rT = Math.max(0.55, L.rTib * k), rt = Math.max(0.5, L.rTar * k);
  // the tibia: thick at the drumstick, narrowing to the heel; feathered at the top
  const feath = L.feath ?? 0.35;
  R.tube([hip, heel], t => rT * (1 - t * 0.42), { z, id, tex: (p, o) => { o.m = p.t < feath && M.feath ? M.feath : M.tib; if (p.t > 0.85) o.z += 0.2; } });
  // the heel knob and the scaled tarsus
  R.tube([heel, end], t => rt * (t < 0.12 ? 1.18 - t * 1.5 : 1), {
    z: z + 0.2, id: id + 1, tex: (p, o) => {
      o.m = M.leg;
      // transverse scutes
      if (fr(p.s / Math.max(0.9, 1.1 * k)) < 0.28) { o.z -= 0.35; o.t -= 0.03; }
      if (p.c < 0) o.t -= 0.03;
    },
  });
  footShape(R, end, L, M, z + 0.4, k, P, id + 2);
  return { heel, foot: end };
}

/** the foot of each kind, toes forward (screen right) at angle ta */
export function footShape(R: Relief, f: V2, L: LegLook, M: LegMats, z: number, k: number, P: LegPose, id: number) {
  const ta = P.ta ?? 0, curl = P.curl ?? 0, spread = P.spread ?? 0.5;
  const gnd = P.ground;
  const toeL = L.toe * k;
  const rt = Math.max(0.5, L.rTar * k * 0.75);
  const claw = (L.claw ?? 0.6) * k;
  const dir = (a: number, r: number): V2 => [f[0] + Math.cos(a) * r, f[1] + Math.sin(a) * r];
  const clampG = (q: V2): V2 => (gnd === undefined ? q : [q[0], Math.min(q[1], gnd - 0.3)]);
  // toe angles: front toes fan a little (side view: they overlap), the far toe slightly up
  const toes = [ta - 0.18 * spread + curl * 1.3, ta + curl * 1.5, ta + 0.2 * spread + curl * 1.7];
  const tipOf = (a: number, Lm: number): V2 => {
    if (curl > 0) {
      // a curled toe: bends down and back round the perch
      const m = dir(a - curl * 0.9, Lm * 0.55);
      return clampG([m[0] + Math.cos(a + curl * 0.8) * Lm * 0.5, m[1] + Math.sin(a + curl * 0.8) * Lm * 0.5]);
    }
    return clampG(dir(a, Lm));
  };
  if (L.foot === 'web' || L.foot === 'shovel') {
    // the web: one paddle from the ankle to the toe tips, its trailing edge cut in concave scallops
    const wide = L.foot === 'shovel' ? 1.5 : 1;
    const a0 = toes[0] - 0.25 * spread * wide, a1 = toes[2] + 0.28 * spread * wide;
    const t0 = tipOf(a0, toeL), t1 = tipOf((a0 + a1) / 2, toeL * 1.06), t2 = tipOf(a1, toeL * 0.92);
    const m01 = l2(l2(t0, t1, 0.5), f, 0.22 * spread), m12 = l2(l2(t1, t2, 0.5), f, 0.22 * spread);
    const back: V2 = [f[0] - Math.cos(ta) * rt * 1.4 * wide, f[1] - Math.sin(ta) * rt * 1.4 * wide];
    const poly: LM[] = [[back[0], back[1], 0], [f[0], f[1] - rt, 0], [t0[0], t0[1], 0.7], [m01[0], m01[1], 0.3], [t1[0], t1[1], 0.7], [m12[0], m12[1], 0.3], [t2[0], t2[1], 0.7], [f[0] - rt * 0.4, f[1] + rt * 0.8, 0]];
    R.region(spline(poly, 0.4), { z, R: 0.8, H: 0.6, id, tex: (p, o) => {
      o.m = M.web;
      const dd = Math.hypot(p.x - f[0], p.y - f[1]);
      // toe ridges through the web
      const ang = Math.atan2(p.y - f[1], p.x - f[0]);
      for (const a of [a0, (a0 + a1) / 2, a1]) if (Math.abs(Math.sin(ang - a)) * dd < 0.55) { o.m = M.toe; o.z += 0.3; }
      if (fr(dd / 1.1) < 0.25) o.z -= 0.2;
    } });
    // spade claws on each toe tip
    for (const t of [t0, t1, t2]) {
      const a = Math.atan2(t[1] - f[1], t[0] - f[0]);
      const c2 = clampG([t[0] + Math.cos(a + 0.35) * claw * (L.foot === 'shovel' ? 1.6 : 1), t[1] + Math.sin(a + 0.35) * claw * (L.foot === 'shovel' ? 1.6 : 1)]);
      R.tube([t, c2], s => (L.foot === 'shovel' ? 0.75 : 0.5) * (1 - s * 0.5), { z: z + 0.5, id: id + 1, tex: M.claw });
    }
    return;
  }
  // separate toes: lobed (snowshoe), perching or plain
  const lobe = L.foot === 'lobe';
  const drawToe = (a: number, Lm: number, zz: number) => {
    const tip = tipOf(a, Lm);
    const mid = curl > 0 ? dir(a - curl * 0.9, Lm * 0.55) : l2(f, tip, 0.5);
    const path: V2[] = curl > 0 ? [f, mid, tip] : [f, tip];
    R.tube(path, t => {
      if (!lobe) return rt * (1 - t * 0.35);
      // lobes: the toe swells into a scalloped flap at each joint
      const q = fr(t * 3 + 0.15);
      return rt * 0.7 + Math.sin(q * Math.PI) * rt * 0.95 * (1 - t * 0.25);
    }, { z: zz, id, tex: (p, o) => { o.m = lobe && Math.abs(p.v) > 0.45 ? M.web : M.toe; if (fr(p.s / 1.1) < 0.25) o.z -= 0.25; } });
    const ca = a + 0.6 + curl * 0.8;
    const ct = clampG([tip[0] + Math.cos(ca) * claw * 1.3, tip[1] + Math.sin(ca) * claw * 1.3]);
    R.tube([tip, ct], s => 0.55 * (1 - s * 0.5), { z: zz + 0.3, id: id + 1, tex: M.claw });
  };
  drawToe(toes[2], toeL * 0.85, z - 0.4);
  drawToe(toes[0], toeL * 0.95, z);
  drawToe(toes[1], toeL, z + 0.3);
  // hallux (hind toe): long for a percher, a tiny spur otherwise
  const perch = L.foot === 'perch';
  const ha = Math.PI - ta * 0.3 - (perch ? curl * 1.1 : 0.3);
  const hl = (perch ? 0.8 : 0.32) * toeL;
  const ht = clampG(dir(ha, hl));
  R.tube([f, ht], () => rt * 0.8, { z: z - 0.2, id, tex: M.toe });
  if (perch) {
    const ca = ha - 0.7 - curl * 0.6;
    R.tube([ht, clampG([ht[0] + Math.cos(ca) * claw * 1.5, ht[1] + Math.sin(ca) * claw * 1.5])], s => 0.55 * (1 - s * 0.4), { z: z, id: id + 1, tex: M.claw });
  }
}

// ------------------------------------------------------------------ misc
/** rotate a 2D vector into body space x/y (z = 0) */
export const dir3 = (a: number): V3 => [Math.cos(a), Math.sin(a), 0];
export { v3add, v3sub, v3mul, v3norm, v3cross, v3dot };

/** a folded-wing map in body space through a view: carpal c, axis (along the wing) and down (across), z fixed */
export function foldMap3(V: View3, c: V3, ax: V3, dn: V3, len: number, dep: number, droop = 0) {
  const P = (u: number, v: number): V3 => {
    const y = v * dep + droop * u * u * len * 0.3;
    return [c[0] + ax[0] * u * len + dn[0] * y, c[1] + ax[1] * u * len + dn[1] * y, c[2] + ax[2] * u * len + dn[2] * y];
  };
  const o = V.s(P(0, 0)), a = V.s(P(1, 0)), b = V.s(P(0, 1));
  const ax2 = a[0] - o[0], ay2 = a[1] - o[1], bx = b[0] - o[0], by = b[1] - o[1];
  const det = ax2 * by - ay2 * bx || 1e-6;
  const map = (u: number, v: number): V2 => { const q = V.s(P(u, v)); return [q[0], q[1]]; };
  const inv = (x: number, y: number): V2 => {
    const dx = x - o[0], dy = y - o[1];
    const u = (dx * by - dy * bx) / det;
    const vv = (ax2 * dy - ay2 * dx) / det;
    return [u, vv - droop * u * u * len * 0.3 / dep];
  };
  return { map, inv, z: (u: number, v: number) => V.s(P(u, v))[2] };
}

// ------------------------------------------------------------------ pixel legs (small birds)
export interface PxLegLook {
  tib: number; tar: number; toe: number;
  foot: 'lobe' | 'web' | 'shovel' | 'perch' | 'plain';
  /** a 2 px thick tarsus (big birds) */
  thick?: boolean;
  /** hind toe length (px) */
  hallux?: number;
}
export interface PxLegMats { tib: number; leg: number; toe: number; web: number; claw: number }
export interface PxLegPose { ta?: number; ground?: number; curl?: number; spread?: number; bend?: number; light?: number; /** a plumb tarsus (standing still: a clean 1 px column) */ vert?: boolean }
/**
 * A bird leg placed pixel by pixel for sprites where a leg is 1 px wide: the tibia under the belly,
 * the backward heel, the tarsus, and the toes laid along the ground (or hanging at angle ta), each
 * foot type with its own pixel cluster (lobes, web, shovel, perching grip). Returns heel and foot.
 */
export function pxLeg(sk: { line: (x0: number, y0: number, x1: number, y1: number, m: number, l: number, z: number) => void; dot: (x: number, y: number, m: number, l: number, z: number) => void }, hip: V2, foot: V2, L: PxLegLook, M: PxLegMats, z: number, k: number, P: PxLegPose = {}): { heel: V2; foot: V2 } {
  let [heel, end] = ik2(hip, foot, L.tib * k, L.tar * k, P.bend ?? 1);
  if (P.vert) { heel = [Math.floor(foot[0]) + 0.5, Math.min(hip[1] + 0.5, foot[1] - L.tar * k)]; end = [heel[0], foot[1]]; }
  const lt = P.light ?? 0;
  sk.line(hip[0], hip[1], heel[0], heel[1], M.tib, 0.55 + lt, z);
  sk.line(heel[0], heel[1], end[0], end[1], M.leg, 0.62 + lt, z + 0.1);
  if (L.thick) sk.line(heel[0] + 1, heel[1], end[0] + 1, end[1], M.leg, 0.42 + lt, z + 0.05);
  const ta = P.ta ?? 0, curl = P.curl ?? 0, sp = P.spread ?? 0.5;
  const toeL = L.toe * k;
  const fx = end[0], fy = end[1];
  const onGround = P.ground !== undefined && curl === 0;
  if (onGround) {
    // toes along the ground row
    const gy = P.ground! - 0.5;
    const n = Math.max(2, Math.round(toeL));
    for (let i = 0; i <= n; i++) {
      const x = fx + i, last = i === n;
      if (L.foot === 'lobe') {
        // snowshoe: a long sole beaded with pale lobes, one lobe flap standing up mid-toe
        sk.dot(x, gy, last ? M.claw : (i & 1) ? M.web : M.toe, ((i & 1) ? 0.7 : 0.52) + lt, z + 0.3);
        if (i === 2 && n > 2) sk.dot(x, gy - 1, M.web, 0.66 + lt, z + 0.25);
      } else if (L.foot === 'web' || L.foot === 'shovel') {
        sk.dot(x, gy, last ? M.claw : i === n - 1 && L.foot !== 'shovel' ? M.toe : M.web, (i === 0 ? 0.5 : 0.6) + lt, z + 0.3);
        if (L.foot === 'shovel' && i < n) sk.dot(x, gy - 1, M.web, 0.72 + lt, z + 0.25);
      } else {
        sk.dot(x, gy, last ? M.claw : M.toe, 0.6 + lt, z + 0.3);
      }
    }
    // the far toe a pixel back and up, the hind toe behind
    const hl = L.hallux ?? (L.foot === 'perch' ? 2 : 1);
    for (let i = 1; i <= hl; i++) sk.dot(fx - i, gy, M.toe, 0.45 + lt, z + 0.2);
    if (L.foot === 'shovel') sk.dot(fx + n + 1, gy, M.claw, 0.5 + lt, z + 0.3);
    return { heel, foot: end };
  }
  // hanging or curled toes
  const fan = L.foot === 'web' || L.foot === 'shovel' || L.foot === 'lobe' ? 0.35 * sp + 0.12 : 0.18;
  for (let t = -1; t <= 1; t++) {
    const a = ta + t * fan + curl * (1.2 + t * 0.2);
    if (curl > 0) {
      const mx = fx + Math.cos(ta - curl * 0.7) * toeL * 0.55, my = fy + Math.sin(ta - curl * 0.7) * toeL * 0.55;
      sk.line(fx, fy, mx, my, M.toe, 0.55 + lt, z + 0.3);
      sk.line(mx, my, mx + Math.cos(a) * toeL * 0.45, my + Math.sin(a) * toeL * 0.45, M.toe, 0.5 + lt, z + 0.3);
      continue;
    }
    const tx = fx + Math.cos(a) * toeL, ty = fy + Math.sin(a) * toeL;
    sk.line(fx, fy, tx, ty, t === 0 ? M.toe : L.foot === 'web' || L.foot === 'shovel' ? M.web : M.toe, 0.58 + lt - Math.abs(t) * 0.06, z + 0.3 - Math.abs(t) * 0.05);
    sk.dot(tx + Math.cos(a) * 0.9, ty + Math.sin(a) * 0.9, M.claw, 0.5 + lt, z + 0.35);
  }
  if ((L.foot === 'web' || L.foot === 'shovel') && toeL >= 2.5) {
    // fill the web between the outer toes
    for (let s = 0.3; s <= 0.95; s += 0.2) {
      const a0 = ta - fan, a1 = ta + fan;
      sk.line(fx + Math.cos(a0) * toeL * s, fy + Math.sin(a0) * toeL * s, fx + Math.cos(a1) * toeL * s, fy + Math.sin(a1) * toeL * s, M.web, 0.5 + lt, z + 0.2);
    }
  }
  if (L.foot === 'perch' || curl > 0) {
    const ha = Math.PI + ta * 0.3 - curl * 1.1;
    const hl = (L.hallux ?? 1.5) * k;
    sk.line(fx, fy, fx + Math.cos(ha) * hl, fy + Math.sin(ha) * hl, M.toe, 0.5 + lt, z + 0.2);
  }
  return { heel, foot: end };
}

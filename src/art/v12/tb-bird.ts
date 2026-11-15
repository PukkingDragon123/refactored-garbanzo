// V12 Te Pouākai, the Thunderbird's own body: the creature painter behind src/art/v12/thunderbird.ts
// (thunderbirdFrame's soar / flap / flee plates from below and the dive / land / shriek / hurt profiles).
//
// A giant booted eagle of the storm. Nothing is a primitive: every mass is one continuous contour
// through anatomical landmarks (Catmull-Rom splines), filled from a height field (distance to that
// contour, plus bone and muscle bumps and ridges) lit from the top-left, then textured per region.
//
//   the wing     one structure from the shoulder to the fingertips: the leading edge (propatagium) bows
//                forward to the carpal bend with the alula standing off it; behind it the feather
//                tracts step down in value: the marginal and lesser coverts in rows of small scallops,
//                the median row (from below its rust-gold "ember band", above ember-fringed), the
//                greater row (ash tipped black from below, its pale tips a wing bar above), then the
//                13 secondaries (broad, round-tipped: the scalloped trailing edge bulging behind the
//                elbow and pinched at the wrist) and the ten primaries, P1 running on from the
//                secondaries, the outer seven slotted into separate fingers by the emarginations on both
//                webs. From below the flight feathers are storm-silver barred black, backlit; above,
//                black with a steel sheen. The storm-white lightning zigzags across the hand.
//   the body     a deep keeled chest (pectoral masses either side of the keel ridge), the slate bib
//                breaking feather by feather into an ash belly whose every feather is tipped with a dark
//                chevron; heavy shaggy trousers barred like a harpy's; feathered boots right down to the
//                toes (Hieraaetus, like the real Pouākai); yellow scaled toes with huge black talons
//   the head     a flat brow shelf overhanging a fierce gold eye in a storm-grey face, a deep horn beak
//                with a long hook and a yellow cere, the rust-gold hackle mane flaring off the nape
//   the tail     long, gently wedged, barred, with a dark band and a pale tip
//
// Colours step through fixed ramps; a step boundary is dithered only across a narrow band, so the
// form reads as clean hand-placed clusters, never noise.

import { PixelBuffer } from '../pixel';
import type { C } from '../color';
import { hex } from '../color';
import { bayer, hash2 } from '../../core/math';
import { spline, LM } from '../beasts-relief';

type V2 = [number, number];
const H = (s: string) => hex(s);

// ---------------------------------------------------------------- palette
export const TB_INK = H('#07060a');
/** storm plumage: violet-black to slate */
const PL: C[] = ['#09080d', '#131118', '#1d1923', '#28222f', '#352d3c', '#453a4c', '#584b5e', '#6e6172'].map(H);
/** the far side, sunk in shadow */
const PLD: C[] = ['#060509', '#0c0b11', '#131118', '#1b1721', '#241f2b', '#2f2836', '#3b3343'].map(H);
/** blue-steel sheen on the dorsal flight feathers and the leading edge */
const STEEL: C[] = ['#1a2232', '#27354c', '#3a4f6c', '#567292', '#7e9cb8', '#aec4d6'].map(H);
/** rust-gold embers: the hackle mane and the covert fringes */
const RU: C[] = ['#2a1209', '#4a1c0d', '#722f14', '#9e4a1d', '#c86e2c', '#e6994a', '#f6c47e'].map(H);
/** the flight feathers from below, backlit against the storm: silver */
const SIL: C[] = ['#18171d', '#26242c', '#37343f', '#4c4855', '#64606e', '#7f7a88', '#9c97a2', '#bbb5bc', '#d8d2d2'].map(H);
/** the ash belly and boots */
const ASH: C[] = ['#1a171c', '#29242b', '#3a333b', '#4e464d', '#655b60', '#7e7376', '#9a8e8e', '#b8aca8', '#d6ccc4'].map(H);
const FLASH: C[] = ['#7ea6d6', '#bcd8f4', '#eef6ff', '#ffffff'].map(H);
const BEAK: C[] = ['#0b0a0e', '#17151c', '#24212b', '#35313d', '#4a4552', '#646070', '#868294', '#aaa8b6'].map(H);
const CERE: C[] = ['#4e3406', '#7e580c', '#b08416', '#d8ac2a', '#f0d05a', '#fbea9c'].map(H);
const YEL: C[] = ['#3e2a06', '#664610', '#926a16', '#bc9020', '#dcb238', '#eed46e', '#fbeeb0'].map(H);
const TAL: C[] = ['#050406', '#0e0c11', '#1c1a21', '#2e2b35', '#46434e', '#6a6874', '#9896a2'].map(H);
const IRIS: C[] = ['#5a2a04', '#a05c08', '#dc9a14', '#f6cc3a', '#fff0a0'].map(H);
const MOUTH: C[] = ['#1a0608', '#3e0e12', '#6e1c22', '#a8384a', '#d86a78'].map(H);

// ---------------------------------------------------------------- small helpers
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fr = (v: number) => v - Math.floor(v);
const hs = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
const add = (a: V2, b: V2, k = 1): V2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const rot = (v: V2, a: number): V2 => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
const nrm = (v: V2): V2 => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const dirv = (a: number): V2 => [Math.cos(a), Math.sin(a)];
const sh3 = (q: LM) => (q.length > 2 ? (q as number[])[2] : 0);

/** a ramp tone for light l (0..1): hard steps, a step boundary dithered only across a narrow band */
function tq(r: C[], l: number, x: number, y: number, band = 0.34): C {
  const f = cl(l, 0, 0.999) * (r.length - 1);
  const i = Math.floor(f), q = f - i, lo = 0.5 - band / 2;
  const j = Math.min(r.length - 1, i + 1);
  if (q < lo) return r[i];
  if (q > 1 - lo) return r[j];
  return (q - lo) / band > bayer(x, y) ? r[j] : r[i];
}

// ---------------------------------------------------------------- a vane: one feather (or any strip) along a curved shaft
type VFn = (x: number, y: number, u: number, v: number) => C | -1;
/**
 * Fill the strip along the shaft polyline `sh`: wl(u) px to the left of travel, wr(u) to the right.
 * fn gets u (0 base .. 1 tip, by arc length) and v (-1 right edge .. +1 left edge).
 */
function vane(b: PixelBuffer, sh: V2[], wl: (u: number) => number, wr: (u: number) => number, fn: VFn) {
  const n = sh.length;
  if (n < 2) return;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(sh[i][0] - sh[i - 1][0], sh[i][1] - sh[i - 1][1]);
  const L = cum[n - 1] || 1e-6;
  const pts: number[] = [], rs: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = sh[Math.max(0, i - 1)], c = sh[Math.min(n - 1, i + 1)];
    const [tx, ty] = nrm([c[0] - a[0], c[1] - a[1]]);
    const u = cum[i] / L, l = wl(u) + 0.7, r = wr(u) + 0.7;
    pts.push(sh[i][0] + ty * l, sh[i][1] - tx * l);
    rs.push(sh[i][0] - ty * r, sh[i][1] + tx * r);
  }
  const [ex, ey] = nrm([sh[n - 1][0] - sh[n - 2][0], sh[n - 1][1] - sh[n - 2][1]]);
  pts.push(sh[n - 1][0] + ex * 1.2, sh[n - 1][1] + ey * 1.2);
  for (let i = n - 1; i >= 0; i--) pts.push(rs[i * 2], rs[i * 2 + 1]);
  const q = (sh as Shaft).q;
  if (q) {
    // a gently bent shaft: u and v straight from the chord frame (no search)
    const { bx, by, dx, dy, kl } = q, lx = dy, ly = -dx;
    b.polyFn(pts, (x, y) => {
      const px = x + 0.5 - bx, py = y + 0.5 - by;
      const a = px * dx + py * dy;
      if (a > q.L + 0.6) return -1;
      const u = a <= 0 ? 0 : a >= q.L ? 1 : a / q.L;
      const c = px * lx + py * ly - kl * q.L * u * u;
      const w = c >= 0 ? wl(u) : wr(u);
      const ac = c < 0 ? -c : c;
      if (ac > w + 0.45) return -1;
      return fn(x, y, u, c / Math.max(0.6, w));
    });
    return;
  }
  b.polyFn(pts, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    let best = 1e9, bu = 0, bs = 1;
    for (let i = 1; i < n; i++) {
      const ax = sh[i - 1][0], ay = sh[i - 1][1], sx = sh[i][0] - ax, sy = sh[i][1] - ay;
      const L2 = sx * sx + sy * sy;
      let k = L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const qx = ax + sx * k, qy = ay + sy * k, d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
      if (d2 < best) { best = d2; bu = (cum[i - 1] + (cum[i] - cum[i - 1]) * k) / L; bs = (px - ax) * sy - (py - ay) * sx >= 0 ? 1 : -1; }
    }
    const d = Math.sqrt(best), w = bs > 0 ? wl(bu) : wr(bu);
    if (d > w + 0.45) return -1;
    return fn(x, y, bu, (bs * d) / Math.max(0.6, w));
  });
}
type Shaft = V2[] & { q?: { bx: number; by: number; dx: number; dy: number; L: number; kl: number } };
/** a shaft from base along direction d, length L, bending toward `bend` by k*L at the tip */
function shaft(base: V2, d: V2, L: number, bend: V2, k: number, n = 6): Shaft {
  const out: Shaft = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    out.push([base[0] + d[0] * L * u + bend[0] * k * L * u * u, base[1] + d[1] * L * u + bend[1] * k * L * u * u]);
  }
  const dd = nrm(d);
  out.q = { bx: base[0], by: base[1], dx: dd[0], dy: dd[1], L, kl: k * (bend[0] * dd[1] - bend[1] * dd[0]) };
  return out;
}

// ---------------------------------------------------------------- a field: one closed contour, its height and light
const LX = -0.5, LY = -0.72, LZ = 0.48;
class Fld {
  readonly x0: number; readonly y0: number; readonly w: number; readonly h: number;
  readonly ins: Uint8Array; readonly d: Float32Array; readonly z: Float32Array;
  constructor(polys: V2[][], R: number, Hh: number, pow = 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    this.x0 = Math.floor(x0) - 2; this.y0 = Math.floor(y0) - 2;
    this.w = Math.max(1, Math.ceil(x1) - this.x0 + 3); this.h = Math.max(1, Math.ceil(y1) - this.y0 + 3);
    const W = this.w, N = W * this.h;
    this.ins = new Uint8Array(N); this.d = new Float32Array(N); this.z = new Float32Array(N);
    const xs: number[] = [];
    for (let j = 0; j < this.h; j++) {
      const py = this.y0 + j + 0.5;
      xs.length = 0;
      for (const p of polys) {
        const n = p.length;
        for (let a = 0, c = n - 1; a < n; c = a++) {
          const ay = p[a][1], cy = p[c][1];
          if ((ay > py) !== (cy > py)) xs.push(p[a][0] + ((py - ay) / (cy - ay)) * (p[c][0] - p[a][0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let s = 0; s + 1 < xs.length; s += 2) {
        const ia = Math.max(0, Math.ceil(xs[s] - 0.5) - this.x0), ib = Math.min(W - 1, Math.floor(xs[s + 1] - 0.5) - this.x0);
        for (let i = ia; i <= ib; i++) this.ins[j * W + i] ^= 1;
      }
    }
    // chamfer distance to the outside (1, sqrt 2), then -0.5 so an edge pixel sits half a pixel in
    const D = this.d, BIG = 1e6, R2 = Math.SQRT2;
    for (let k = 0; k < N; k++) D[k] = this.ins[k] ? BIG : 0;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!D[k]) continue;
      let v = D[k];
      if (i > 0) v = Math.min(v, D[k - 1] + 1);
      if (j > 0) { v = Math.min(v, D[k - W] + 1); if (i > 0) v = Math.min(v, D[k - W - 1] + R2); if (i < W - 1) v = Math.min(v, D[k - W + 1] + R2); }
      D[k] = v;
    }
    for (let j = this.h - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i;
      if (!D[k]) continue;
      let v = D[k];
      if (i < W - 1) v = Math.min(v, D[k + 1] + 1);
      if (j < this.h - 1) { v = Math.min(v, D[k + W] + 1); if (i < W - 1) v = Math.min(v, D[k + W + 1] + R2); if (i > 0) v = Math.min(v, D[k + W - 1] + R2); }
      D[k] = v;
    }
    for (let k = 0; k < N; k++) if (this.ins[k]) {
      const d = D[k] - 0.5;
      D[k] = d;
      const x = Math.min(1, d / R);
      let w = Math.sqrt(1 - (1 - x) * (1 - x));
      if (pow !== 1) w = Math.pow(w, pow);
      this.z[k] = Hh * w;
    }
  }
  /** a smooth bump (h > 0) or dent (h < 0) */
  bump(cx: number, cy: number, rx: number, ry: number, h: number, a = 0) {
    const c = Math.cos(a), s = Math.sin(a), R = Math.max(rx, ry) + 1, W = this.w;
    for (let j = Math.max(0, Math.floor(cy - R) - this.y0); j <= Math.min(this.h - 1, Math.ceil(cy + R) - this.y0); j++)
      for (let i = Math.max(0, Math.floor(cx - R) - this.x0); i <= Math.min(W - 1, Math.ceil(cx + R) - this.x0); i++) {
        const k = j * W + i;
        if (!this.ins[k]) continue;
        const dx = this.x0 + i + 0.5 - cx, dy = this.y0 + j + 0.5 - cy;
        const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry, q = 1 - u * u - v * v;
        if (q > 0) this.z[k] += h * q * q;
      }
  }
  /** a ridge (h > 0) or groove (h < 0) along a polyline, w px either side */
  ridge(pts: V2[], w: number, h: number) {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of pts) { bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]); }
    const W = this.w;
    for (let j = Math.max(0, Math.floor(by0 - w) - this.y0); j <= Math.min(this.h - 1, Math.ceil(by1 + w) - this.y0); j++)
      for (let i = Math.max(0, Math.floor(bx0 - w) - this.x0); i <= Math.min(W - 1, Math.ceil(bx1 + w) - this.x0); i++) {
        const k = j * W + i;
        if (!this.ins[k]) continue;
        const px = this.x0 + i + 0.5, py = this.y0 + j + 0.5;
        let best = 1e9, bt = 0;
        for (let s = 1; s < pts.length; s++) {
          const ax = pts[s - 1][0], ay = pts[s - 1][1], sx = pts[s][0] - ax, sy = pts[s][1] - ay, L2 = sx * sx + sy * sy;
          const t = cl(L2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / L2 : 0);
          const d2 = (px - ax - sx * t) ** 2 + (py - ay - sy * t) ** 2;
          if (d2 < best) { best = d2; bt = (s - 1 + t) / (pts.length - 1); }
        }
        const d = Math.sqrt(best);
        if (d >= w) continue;
        const e = Math.min(1, bt / 0.15, (1 - bt) / 0.15);
        this.z[k] += h * (1 - (d / w) ** 2) ** 2 * e;
      }
  }
  inside(x: number, y: number) {
    const i = Math.floor(x) - this.x0, j = Math.floor(y) - this.y0;
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.ins[j * this.w + i] === 1;
  }
  /** paint every inside pixel: fn(x, y, d, l) with d the distance to the contour and l the light */
  paint(b: PixelBuffer, fn: (x: number, y: number, d: number, l: number) => C | -1, drop = 2.2) {
    const W = this.w, z = this.z, ins = this.ins;
    const L0 = LZ;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!ins[k]) continue;
      const zc = z[k];
      const zl = i > 0 && ins[k - 1] ? z[k - 1] : zc - drop, zr = i < W - 1 && ins[k + 1] ? z[k + 1] : zc - drop;
      const zu = j > 0 && ins[k - W] ? z[k - W] : zc - drop, zd = j < this.h - 1 && ins[k + W] ? z[k + W] : zc - drop;
      let nx = -(zr - zl) * 0.5, ny = -(zd - zu) * 0.5, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const l = 0.5 + 0.62 * (nx * LX + ny * LY + nz * LZ - L0);
      const x = this.x0 + i, y = this.y0 + j;
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
      const c = fn(x, y, this.d[k], l);
      if (c !== -1) b.data[y * b.w + x] = c;
    }
  }
}

/**
 * Imbricated contour feathers: rows across the flow direction `ang`, each feather a rounded tip
 * pointing along it. Returns the signed distance past the tip curve in row units (< 0 inside the
 * feather, a band 0..0.3 is the shadow its tip casts), and SC (row, column, along, across).
 */
const SC = { r: 0, q: 0, a: 0, c: 0 };
function scallop(x: number, y: number, ang: number, cw: number, rh: number, seed: number): number {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const a = x * ca + y * sa, c = -x * sa + y * ca;
  const r = Math.floor(a / rh);
  const off = (r & 1) * 0.5 + (hash2(r, 3, seed) - 0.5) * 0.3;
  const q = Math.floor(c / cw + off);
  const fc = c / cw + off - q - 0.5, fa = a / rh - r;
  SC.r = r; SC.q = q; SC.a = fa; SC.c = fc;
  const tip = 0.62 + 0.38 * (1 - 4 * fc * fc);
  return fa - tip;
}

// ================================================================ the wing
export interface TBWing {
  /** shoulder and wrist */
  sx: number; sy: number; wx: number; wy: number;
  /** the direction the primaries fan around (radians), the fan's spread, their length */
  tip: number; spread: number; plen: number;
  /** the direction the secondaries trail (radians) and their length */
  sec: number; slen: number;
  /** the far wing (darker) */
  far?: boolean;
  /** feathers knocked about (hurt) / a primary missing (fleeing) */
  ruffle?: number;
  gap?: number;
  seed: number;
  /** we see its underside (the plates from below, a braking wing) */
  under?: boolean;
}

const PLEN = [0.6, 0.64, 0.69, 0.76, 0.85, 0.93, 0.99, 1.0, 0.95, 0.8];

/** one wing, shoulder to fingertips (see the header) */
export function tbWing(b: PixelBuffer, w0: TBWing) {
  let w = w0;
  // the secondaries trail square off the arm: the perpendicular nearest the asked direction
  {
    const arm = Math.atan2(w.wy - w.sy, w.wx - w.sx);
    const d = (a: number) => Math.abs(Math.atan2(Math.sin(a - w.sec), Math.cos(a - w.sec)));
    const perp = d(arm + Math.PI / 2) < d(arm - Math.PI / 2) ? arm + Math.PI / 2 : arm - Math.PI / 2;
    const diff = Math.atan2(Math.sin(w.sec - perp), Math.cos(w.sec - perp));
    w = { ...w, sec: perp + Math.max(-0.35, Math.min(0.35, diff)) };
  }
  const under = !!w.under, far = !!w.far;
  const S: V2 = [w.sx, w.sy], Wr: V2 = [w.wx, w.wy];
  const A = Math.hypot(Wr[0] - S[0], Wr[1] - S[1]) || 1;
  const au: V2 = [(Wr[0] - S[0]) / A, (Wr[1] - S[1]) / A];
  const su = dirv(w.sec), lead: V2 = [-su[0], -su[1]];
  const hu = dirv(w.tip);
  // rotating the hand direction by ss * 90 degrees turns it toward the trailing edge
  const ss = Math.sign(hu[0] * su[1] - hu[1] * su[0]) || 1;
  // the arm's own side: rotating the arm by sa * 90 degrees points to the trailing edge
  const sa = Math.sign(au[0] * su[1] - au[1] * su[0]) || 1;
  const K = w.plen / 80, KS = w.slen / 44;
  const dl = far ? -0.14 : 0;
  const rr = (k: number, s: number) => (w.ruffle ? (hash2(k, s, w.seed) - 0.5) * 2 * w.ruffle : 0);
  const tr = (v: V2): V2 => rot(v, ss * Math.PI / 2);

  // ---------------------------------------------------------- the primaries' geometry
  // the fan runs from P1 (innermost: nearly parallel to the secondaries, continuing the trailing edge)
  // to P10 (the leading finger, out along the hand); the outer six spread wider apart as fingers
  const Hb = w.plen * 0.27;
  const hb = rot(hu, -ss * 0.1);
  const aIn = Math.atan2(su[1], su[0]) - ss * 0.32;
  const aOut = w.tip - ss * w.spread * 0.22;
  let dA = aOut - aIn;
  while (dA > Math.PI) dA -= Math.PI * 2;
  while (dA < -Math.PI) dA += Math.PI * 2;
  // a half-folded wing bunches its primaries: never fan wider than a spread hand
  const dMax = 1.2 + 0.35 * Math.min(1, w.spread);
  if (Math.abs(dA) > dMax) dA = Math.sign(dA) * dMax;
  const aIn2 = aOut - dA;
  type Prim = { k: number; base: V2; d: V2; L: number; sh: V2[]; slot: boolean };
  const prims: Prim[] = [];
  for (let k = 0; k < 10; k++) {
    const t = k / 9;
    const a = aIn2 + dA * Math.pow(t, 1.55) + rr(k, 1) * 0.35;
    const d = dirv(a);
    const base = add(add(Wr, hb, Hb * (0.04 + t * 0.96)), su, (1 - t) * 3 * K);
    const L = w.plen * PLEN[k] * (1 + rr(k, 2) * 0.12);
    prims.push({ k, base, d, L, sh: shaft(base, d, L, tr(d), 0.05 + rr(k, 3) * 0.06), slot: k >= 3 });
  }
  // the lightning: a zigzag across the hand, through each finger at its own fraction
  const BOLT_AT = [0.0, 0.0, 0.47, 0.6, 0.44, 0.58, 0.42, 0.55, 0.4, 0.5];
  const bolt: V2[] = [];
  for (let k = 9; k >= 2; k--) { const p = prims[k]; bolt.push(add(p.base, p.d, p.L * BOLT_AT[k])); }
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const q of bolt) { bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]); }
  const boltD = (x: number, y: number) => {
    if (x < bx0 - 2 || x > bx1 + 2 || y < by0 - 2 || y > by1 + 2) return 9;
    let best = 9;
    for (let i = 1; i < bolt.length; i++) {
      const a = bolt[i - 1], c = bolt[i], sx = c[0] - a[0], sy = c[1] - a[1], L2 = sx * sx + sy * sy;
      const t = cl(L2 > 0 ? ((x - a[0]) * sx + (y - a[1]) * sy) / L2 : 0);
      best = Math.min(best, Math.hypot(x - a[0] - sx * t, y - a[1] - sy * t));
    }
    return best;
  };

  // ---------------------------------------------------------- tract colours
  const flightRamp = under ? SIL : far ? PLD : PL;
  // primaries
  const primFill = (p: Prim): VFn => {
    const lefN: V2 = [p.d[1], -p.d[0]];
    const ls = lefN[0] * lead[0] + lefN[1] * lead[1] > 0 ? 1 : -1;
    const em = 0.47 + (9 - p.k) * 0.014;
    return (x, y, u, v) => {
      const lw = v * ls > 0;
      const av = Math.abs(v);
      // the seam: a dark line down each edge, so the next feather reads
      if (av > 0.8) return tq(flightRamp, (under ? 0.12 : 0.04) + dl, x, y);
      const tipZone = p.slot ? u > em + 0.12 : u > 0.84;
      let l: number;
      if (under) {
        l = 0.66 - u * 0.12 + (lw ? -0.05 : 0.04) + dl * 2;
        if (tipZone) l = 0.14 + (lw ? 0.06 : 0) - (u - 0.8) * 0.2;
        else if (fr(u * 4.4 + v * ls * 0.12 + p.k * 0.07) < 0.3 && u > 0.1) l -= 0.3;
      } else {
        l = 0.3 - u * 0.1 + (lw ? 0.06 : -0.03) + dl;
        if (tipZone) l -= 0.1;
        else if (fr(u * 4.4 + v * ls * 0.12 + p.k * 0.07) < 0.22 && u > 0.12) l += 0.1;
      }
      if (av < 0.16 && u < 0.9) l += under ? 0.14 : 0.12;
      // the lightning streak
      if (p.k >= 2) {
        const bd = boltD(x + 0.5, y + 0.5);
        if (bd < 1.75) return bd < 0.85 ? FLASH[far ? 1 : 3] : FLASH[far ? 0 : 1];
      }
      if (!under && lw && av > 0.3 && u < em) return tq(STEEL, 0.25 + l * 0.8 + dl, x, y);
      return tq(flightRamp, l, x, y);
    };
  };
  const primW = (p: Prim, lw: boolean) => {
    const em = 0.47 + (9 - p.k) * 0.014;
    const w0 = (lw ? 3.0 : 4.6) * K;
    return (u: number) => {
      let ww = w0 * (1 - u * 0.12);
      if (p.slot && u > em) ww *= lw ? 0.5 : 0.62 + 0.3 * cl((em + 0.05 - u) / 0.05);
      if (u > 0.86) ww *= Math.sqrt(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2));
      return ww;
    };
  };
  const paintPrim = (p: Prim) => {
    if (w.gap !== undefined && p.k === w.gap) return;
    const lefN: V2 = [p.d[1], -p.d[0]];
    const ls = lefN[0] * lead[0] + lefN[1] * lead[1] > 0 ? 1 : -1;
    vane(b, p.sh, primW(p, ls > 0), primW(p, ls < 0), primFill(p));
  };

  // ---------------------------------------------------------- the secondaries' geometry
  const nS = 13;
  const sprof = (t: number) => 0.72 + 0.36 * (t < 0.45 ? Math.pow(Math.sin((Math.PI / 2) * t / 0.45), 0.7) : 1 - 0.4 * Math.pow((t - 0.45) / 0.55, 1.5));
  type Sec = { i: number; t: number; base: V2; d: V2; L: number; sh: V2[] };
  const secs: Sec[] = [];
  for (let i = 0; i < nS; i++) {
    const t = (i + 0.4) / nS;
    const base = add(add(S, au, A * t * 0.98), su, 1);
    const d = nrm(add(su, au, -(0.55 - t) * 0.32 + rr(i, 5) * 0.25));
    const L = w.slen * sprof(t) * (1 + rr(i, 6) * 0.1);
    secs.push({ i, t, base, d, L, sh: shaft(base, d, L, tr(d), 0.02, 6) });
  }
  const secFill = (s: Sec): VFn => {
    const lefN: V2 = [s.d[1], -s.d[0]];
    const ls = lefN[0] * lead[0] + lefN[1] * lead[1] > 0 ? 1 : -1;
    return (x, y, u, v) => {
      const av = Math.abs(v), lw = v * ls > 0;
      if (av > 0.82) return tq(flightRamp, (under ? 0.14 : 0.05) + dl, x, y);
      let l: number;
      if (under) {
        l = 0.6 - u * 0.1 + (lw ? -0.04 : 0.04) + dl * 2;
        if (u > 0.8) l = u > 0.95 ? 0.42 : 0.16;
        else if (fr(u * 4 + v * ls * 0.1 + s.i * 0.03) < 0.28 && u > 0.12) l -= 0.28;
      } else {
        l = 0.36 - u * 0.08 + (lw ? 0.05 : -0.03) + dl;
        if (u > 0.9) return tq(ASH, 0.38 + dl, x, y);
        if (fr(u * 4 + v * ls * 0.1 + s.i * 0.03) < 0.2 && u > 0.15) l += 0.09;
      }
      if (av < 0.14 && u < 0.92) l += under ? 0.12 : 0.1;
      return tq(flightRamp, l, x, y);
    };
  };
  const secW = (lw: boolean) => (u: number) => {
    let ww = (lw ? 4.2 : 4.9) * KS;
    if (u > 0.93) ww *= Math.sqrt(Math.max(0, 1 - ((u - 0.93) / 0.07) ** 2)) * 0.75 + 0.25 * cl((1 - u) / 0.07);
    return ww;
  };
  const paintSec = (s: Sec) => {
    const lefN: V2 = [s.d[1], -s.d[0]];
    const ls = lefN[0] * lead[0] + lefN[1] * lead[1] > 0 ? 1 : -1;
    vane(b, s.sh, secW(ls > 0), secW(ls < 0), secFill(s));
  };

  // ---------------------------------------------------------- flight feathers: overlap order flips with the side we see
  if (under) {
    for (const s of secs) paintSec(s);
    for (const p of prims) paintPrim(p);
  } else {
    for (let k = 9; k >= 0; k--) paintPrim(prims[k]);
    for (let i = nS - 1; i >= 0; i--) paintSec(secs[i]);
  }
  // tertials, tucked in by the body
  for (let j = 0; j < 3; j++) {
    const base = add(add(S, au, A * (0.02 + j * 0.05)), su, 2);
    const d = nrm(add(su, au, -0.55 + j * 0.12));
    const sh = shaft(base, d, w.slen * (0.74 - j * 0.04), tr(d), 0.03, 5);
    vane(b, sh, u => 4.2 * KS * (u > 0.8 ? Math.sqrt(Math.max(0, 1 - ((u - 0.8) / 0.2) ** 2)) : 1), u => 4.2 * KS * (u > 0.8 ? Math.sqrt(Math.max(0, 1 - ((u - 0.8) / 0.2) ** 2)) : 1), (x, y, u, v) => {
      if (Math.abs(v) > 0.82) return tq(flightRamp, 0.08 + dl, x, y);
      if (under) return tq(ASH, 0.36 - u * 0.12 + (fr(u * 3.5) < 0.3 ? -0.14 : 0) + dl * 2, x, y);
      return tq(PL, 0.42 - u * 0.1 + (u > 0.88 ? 0.12 : 0) + dl, x, y);
    });
  }

  // ---------------------------------------------------------- coverts: greater, median, lesser rows over the flight feathers' bases
  type Row = { n: number; f: number; wid: number; l: number; ramp: C[]; fringe: C[] | null; fl: number; tipDark?: boolean };
  const DR = far ? PLD : PL;
  // value steps: from below dark lesser coverts, one rust-gold ember band (the median row), ash greater
  // coverts tipped black, then the pale flight feathers; from above all dark, the ember band and a pale bar
  const rows: Row[] = under
    ? [
      { n: 13, f: 0.5, wid: 4.2, l: 0.5, ramp: ASH, fringe: null, fl: 0, tipDark: true },
      { n: 14, f: 0.33, wid: 3.8, l: 0.36, ramp: RU, fringe: RU, fl: 0.62 },
      { n: 15, f: 0.22, wid: 3.4, l: 0.3, ramp: DR, fringe: DR, fl: 0.46 },
      { n: 17, f: 0.13, wid: 3.0, l: 0.26, ramp: DR, fringe: DR, fl: 0.42 },
    ]
    : [
      { n: 13, f: 0.5, wid: 4.2, l: 0.46, ramp: DR, fringe: ASH, fl: 0.6 },
      { n: 14, f: 0.33, wid: 3.8, l: 0.44, ramp: DR, fringe: RU, fl: 0.5 },
      { n: 15, f: 0.22, wid: 3.4, l: 0.4, ramp: DR, fringe: DR, fl: 0.56 },
      { n: 17, f: 0.13, wid: 3.0, l: 0.36, ramp: DR, fringe: RU, fl: 0.34 },
    ];
  const covert = (sh: V2[], wid: number, r: Row, seed: number) => {
    let L = 0;
    for (let q = 1; q < sh.length; q++) L += Math.hypot(sh[q][0] - sh[q - 1][0], sh[q][1] - sh[q - 1][1]);
    const ww = (u: number) => wid * (u > 0.55 ? Math.sqrt(Math.max(0, 1 - ((u - 0.55) / 0.45) ** 2)) : 1);
    const fv = (hash2(seed, 1, w.seed) - 0.5) * 0.07;
    vane(b, sh, ww, ww, (x, y, u, v) => {
      // px in from the rounded tip's edge: a dark edge, then the fringe crescent, then the feather
      const e = (0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - v * v)) - u) * L;
      if (e < 0.9 && u > 0.4) return tq(r.ramp, r.l - 0.32 + dl, x, y);
      if (e < 2.1 && u > 0.4) {
        if (r.tipDark) return tq(DR, 0.22 + dl, x, y);
        if (r.fringe) return tq(r.fringe, r.fl + (v < 0 ? 0.1 : -0.04) + dl, x, y);
      }
      let l = r.l + (v < 0 ? 0.05 : -0.04) - u * 0.05 + dl + fv;
      if (Math.abs(v) < 0.16 && u < 0.75) l += 0.05;
      return tq(r.ramp, l, x, y);
    });
  };
  rows.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const t = (i + 0.5) / r.n;
      const base = add(add(S, au, A * t * 0.99), su, -ri * 1.2);
      const d = nrm(add(su, au, -(0.5 - t) * 0.26 + rr(i + ri * 30, 7) * 0.2));
      const L = w.slen * r.f * sprof(t) + 3 + ri * 0.6;
      covert(shaft(base, d, L, tr(d), 0.02, 4), r.wid * KS, r, i + ri * 40);
    }
  });
  // primary coverts over the hand (and a second, smaller row)
  for (let row = 0; row < 2; row++) for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const p = prims[Math.min(9, k + 1)];
    const base = add(add(Wr, hb, Hb * (0.02 + t * 0.86)), su, -row * 1.5);
    const a = Math.atan2(p.d[1], p.d[0]) + ss * 0.08;
    const L = w.plen * (row ? 0.17 : 0.3) * (0.8 + t * 0.3);
    const r = under ? rows[row ? 2 : 0] : rows[row ? 2 : 0];
    covert(shaft(base, dirv(a), L, tr(dirv(a)), 0.03, 4), (row ? 2.6 : 3.4) * K, r, 200 + k + row * 20);
  }

  // ---------------------------------------------------------- the leading edge: shoulder -> carpal bend -> hand, one contour
  const tw = (t: number) => (1 - t) * 2 + 1.5;
  const LE: LM[] = [
    add(add(S, su, 6), au, -3),
    add(add(S, lead, 5), au, -1),
    add(add(S, au, A * 0.32), lead, 6.5 * KS),
    add(add(S, au, A * 0.66), lead, 7.6 * KS),
    [...add(add(Wr, lead, 7.5 * KS), au, 1), 0.2] as LM,
    add(add(Wr, hb, Hb * 0.55), lead, 5 * K),
    add(add(Wr, hb, Hb * 1.0), lead, 2.5 * K),
    add(add(Wr, hb, Hb * 1.08), su, 2),
    add(add(Wr, hb, Hb * 0.5), su, 4.5 * K),
    add(Wr, su, tw(1) * KS),
    add(add(S, au, A * 0.6), su, tw(0.6) * KS),
    add(add(S, au, A * 0.25), su, tw(0.25) * KS),
  ];
  const edgePoly = spline(LE, 1);
  const lePts = spline(LE.slice(1, 7), 2.5, false);
  const leD = (x: number, y: number) => {
    let best = 99;
    for (let i = 1; i < lePts.length; i += 1) {
      const a = lePts[i - 1], c = lePts[i], sx = c[0] - a[0], sy = c[1] - a[1], L2 = sx * sx + sy * sy;
      const t = cl(L2 > 0 ? ((x - a[0]) * sx + (y - a[1]) * sy) / L2 : 0);
      best = Math.min(best, Math.hypot(x - a[0] - sx * t, y - a[1] - sy * t));
    }
    return best;
  };
  const fld = new Fld([edgePoly], 3, 2);
  const flowA = Math.atan2(su[1], su[0]);
  fld.paint(b, (x, y, dd, l) => {
    const e = dd < 2.4 ? leD(x + 0.5, y + 0.5) : 9;
    // the marginal coverts: the leading edge itself, a crisp band with its sheen (above) or pale fringe (below)
    if (e < 1.6) return under ? tq(ASH, 0.5 + dl * 2 - (e > 1 ? 0.12 : 0), x, y) : tq(STEEL, 0.52 + (e > 1 ? -0.18 : 0) + dl * 2, x, y);
    const t = scallop(x, y, flowA, 4.4, 3.2, w.seed + 5);
    const ll = 0.28 + (l - 0.5) * 0.5 + dl;
    if (t > 0 && t < 0.34) return tq(DR, ll - 0.14, x, y);
    if (t > -0.3 && t <= 0) return under ? tq(DR, ll + 0.14, x, y) : tq(RU, 0.3 + dl * 1.5, x, y);
    return tq(DR, ll + (e < 3 ? 0.05 : 0), x, y);
  });
  // the alula: three stiff little feathers standing off the carpal bend
  for (let j = 0; j < 3; j++) {
    const base = add(add(Wr, lead, 5.5 * KS), au, -2 - j * 1.5);
    const d = nrm(add(hb, lead, 0.32 - j * 0.12));
    const sh = shaft(base, d, (13 - j * 2.5) * K, tr(d), 0.08, 5);
    const ww = (u: number) => 1.9 * K * (1 - u * 0.5) * (u > 0.8 ? Math.sqrt(Math.max(0, 1 - ((u - 0.8) / 0.2) ** 2)) : 1);
    vane(b, sh, ww, ww, (x, y, u, v) => (Math.abs(v) > 0.75 ? DR[1] : under ? tq(DR, 0.34 - u * 0.1 + dl, x, y) : tq(STEEL, 0.4 - u * 0.15 + dl * 2, x, y)));
  }
}

// ================================================================ the tail
/** the tail fanned from root along `ang` (screen), n rectrices over `spread`, `len` long; under = seen from below */
function tbTail(b: PixelBuffer, root: V2, ang: number, spread: number, len: number, under: boolean, seed: number, far = 0, n = 12) {
  const order: number[] = [];
  for (let i = 0; i < n / 2; i++) { order.push(i, n - 1 - i); }
  const ramp = under ? SIL : PL;
  for (const i of order) {
    const t = i / (n - 1);
    const a = ang + (t - 0.5) * spread;
    const d = dirv(a);
    const side = t < 0.5 ? -1 : 1;
    const base = add(root, rot(d, Math.PI / 2), (t - 0.5) * 6);
    // the central pair a little longer: a long, gently wedged storm tail
    const L = len * (0.9 + 0.1 * Math.cos((t - 0.5) * Math.PI)) * (1 + (hash2(i, 1, seed) - 0.5) * (n < 12 ? 0.12 : 0.04));
    const sh = shaft(base, d, L, rot(d, side * Math.PI / 2), 0.02, 6);
    const ww = (u: number) => 4.4 * (len / 46) * (0.82 + u * 0.24) * (u > 0.9 ? Math.sqrt(Math.max(0, 1 - ((u - 0.9) / 0.1) ** 2)) * 0.7 + 0.3 : 1);
    vane(b, sh, ww, ww, (x, y, u, v) => {
      const av = Math.abs(v);
      if (av > 0.84) return tq(ramp, 0.1 - far, x, y);
      let l: number;
      if (under) {
        l = 0.58 - u * 0.08 + (v < 0 ? 0.04 : -0.03) - far;
        if (u > 0.94) l = 0.66 - far;
        else if (u > 0.78) l = 0.14 - far;
        else if (fr(u * 4.6 + v * 0.12 * side + i * 0.02) < 0.3 && u > 0.15) l -= 0.3;
      } else {
        l = 0.4 - u * 0.06 + (v < 0 ? 0.06 : -0.03) - far;
        if (u > 0.94) return tq(ASH, 0.6 - far, x, y);
        if (u > 0.8) l = 0.14 - far;
        else if (fr(u * 4.2 + v * 0.12 * side + i * 0.02) < 0.26 && u > 0.12) return tq(ASH, 0.46 + (v < 0 ? 0.08 : 0) - far, x, y);
      }
      if (av < 0.14 && u < 0.92) l += 0.1;
      return tq(ramp, l, x, y);
    });
  }
}

// ================================================================ the head
export interface HeadPose { o: V2; a: number; flip?: boolean; open?: number; k?: number; under?: boolean }
/**
 * The head, facing right in its own frame (x forward, y down, the eye at the origin), turned by a.
 * The crown is flat under a brow shelf that overhangs the eye; the beak is deep with a long hook.
 */
export function tbHead(b: PixelBuffer, P: HeadPose) {
  const k = P.k ?? 1, fx = P.flip ? -1 : 1, open = P.open ?? 0;
  const ca = Math.cos(P.a * fx), sa = Math.sin(P.a * fx);
  const T = (x: number, y: number): V2 => [P.o[0] + x * k * fx * ca - y * k * sa, P.o[1] + x * k * fx * sa + y * k * ca];
  const TL = (q: LM): LM => [...T(q[0], q[1]), sh3(q)] as LM;
  const IV = [0, 0];
  const inv = (x: number, y: number) => { const dx = x - P.o[0], dy = y - P.o[1]; IV[0] = ((dx * ca + dy * sa) / k) * fx; IV[1] = (-dx * sa + dy * ca) / k; return IV; };

  // ---- the mane: rust-gold hackles off the back of the crown, flowing down the nape (behind the head)
  const mane: LM[] = [[-3, -9], [-9, -9.6], [-15, -7.5], [-20, -3], [-22, 3], [-21, 9], [-16, 13], [-9, 12], [-6, 4], [-3, -3]];
  const mp = spline(mane.map(TL), 1);
  let area = 0;
  for (let a = 0, c = mp.length - 1; a < mp.length; c = a++) area += (mp[c][0] - mp[a][0]) * (mp[c][1] + mp[a][1]);
  const sg = area > 0 ? 1 : -1;
  let acc = 0;
  const mpR = mp.map((q, i): V2 => {
    const a = mp[(i - 1 + mp.length) % mp.length], c = mp[(i + 1) % mp.length];
    if (i > 0) acc += Math.hypot(q[0] - mp[i - 1][0], q[1] - mp[i - 1][1]);
    const tx = c[0] - a[0], ty = c[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const nx = (ty / tl) * sg, ny = (-tx / tl) * sg;
    // the outward normal in the head's frame: hackle tips only where it faces back
    const [hx] = [((nx * ca + ny * sa)) * fx];
    if (hx > -0.25) return q;
    const id = Math.floor(acc / (3.2 * k)), f = acc / (3.2 * k) - id;
    const L = (2.2 + hash2(id, 5, 3) * 2.6) * k * (-hx) * (f < 0.7 ? f / 0.7 : (1 - f) / 0.3);
    // swept back and down: lean each tip toward the neck
    return [q[0] + nx * L + (-sa) * L * 0.5, q[1] + ny * L + ca * L * 0.5];
  });
  const fm = new Fld([mpR], 3, 2.5);
  const mA = Math.atan2(0.62, -0.78);
  const mc = Math.cos(mA), ms = Math.sin(mA);
  fm.paint(b, (x, y, d, l) => {
    const q = inv(x + 0.5, y + 0.5), lx = q[0], ly = q[1];
    // lanceolate hackles in rows along the flow, each with a dark shaft streak and a gold edge
    const al = lx * mc + ly * ms, ac = -lx * ms + ly * mc;
    const row = Math.floor(ac / 2.6), fc = ac / 2.6 - row;
    const seg = fr((al + hash2(row, 1, 7) * 9) / 7);
    let ll = 0.44 + (l - 0.5) * 0.8 - (d < 1 ? 0.08 : 0);
    if (fc < 0.22) ll -= 0.26;
    else if (fc > 0.62) ll += 0.14;
    if (seg > 0.86) ll -= 0.16;
    if (lx < -16) ll -= 0.06;
    return tq(RU, ll, x, y);
  });

  // ---- the head: flat crown, the brow shelf jutting over the eye, cheek, chin, throat
  const head: LM[] = [
    [4.2, -5.4, 0.6], [1, -7.3], [-4, -8.7], [-9, -8.6], [-13, -6.6], [-15.2, -2.5], [-15.4, 3], [-13, 9],
    [-6, 9.6], [0, 8.2], [3, 6], [4.6, 3.4], [5.6, 0.6], [5.9, -3],
  ];
  const fh = new Fld([spline(head.map(TL), 1)], 4, 3);
  fh.ridge([T(-5, -6.3), T(0, -6.1), T(4, -5.6)], 2 * k, 1.8);
  fh.bump(...T(0.2, -1.8), 2.6 * k, 2.3 * k, -1.1);
  fh.bump(...T(-5, 2.8), 5.5 * k, 4.4 * k, 1.4);
  fh.paint(b, (x, y, d, l) => {
    const q = inv(x + 0.5, y + 0.5), lx = q[0], ly = q[1];
    const sh = (l - 0.5) * 0.85 - (d < 1 ? 0.04 : 0);
    // the dark crown and the brow shelf, its lit lip
    const crownY = -5.2 + (lx < -4 ? (lx + 4) * -0.36 : 0);
    if (ly < crownY) {
      let ll = 0.3 + sh;
      const t = scallop(lx, ly, Math.PI * 0.97, 2.6, 1.9, 41);
      if (t > 0 && t < 0.4) ll -= 0.1;
      if (ly > crownY - 1.3 && lx > -4.5 && lx < 4.4) ll += 0.2;
      return tq(PL, ll, x, y);
    }
    // the overhang's shadow just under the shelf, round the top of the eye
    if (ly < crownY + 1.3 && lx > -3.5 && lx < 4.4) return tq(PL, 0.14 + sh * 0.5, x, y);
    // the lores: dark bristles between the eye and the cere
    if (lx > 2.4 && ly < 2.8) return tq(PL, 0.26 + sh, x, y);
    // the storm-grey face, a dark streak back from the eye, a paler throat
    let ll = 0.46 + sh + (ly > 4 ? 0.1 : 0);
    if (lx < -1.5 && Math.abs(ly + 1.8 + (lx + 1.5) * 0.18) < 1.0 && lx > -11) ll -= 0.2;
    if (fr((ly + lx * 0.28) * 0.6 + hs(lx * 0.7, 0, 9) * 0.3) < 0.2) ll -= 0.09;
    return tq(ASH, ll, x, y);
  });

  // ---- the beak: the lower mandible (dropped open to shriek), the mouth, the deep hooked upper mandible
  const ga = open * 0.72;
  const lower: LM[] = [[4.8, 2.8], [9, 3.2], [13.2, 3.6, 0.3], [14.6, 4.2, 0.7], [13, 5.3], [8, 5.7], [5, 5.0]];
  const hinge: V2 = [4.8, 3.0];
  const lowerT = lower.map(q => { const r = rot([q[0] - hinge[0], q[1] - hinge[1]], ga); return TL([hinge[0] + r[0], hinge[1] + r[1], sh3(q)] as LM); });
  if (open > 0.05) {
    const m: LM[] = [[4.6, 2.4], [15, 2.8], ...lower.slice(1, 4).reverse().map(q => { const r = rot([q[0] - hinge[0], q[1] - hinge[1]], ga * 0.9); return [hinge[0] + r[0], hinge[1] + r[1] - 0.6] as LM; })];
    new Fld([spline(m.map(TL), 1)], 1.5, 1).paint(b, (x, y, d, l) => {
      const q = inv(x + 0.5, y + 0.5);
      // the dark throat at the back, the tongue's pink along the floor
      return tq(MOUTH, 0.16 + (l - 0.5) * 0.4 + (q[0] < 11 && d > 1.1 ? 0.5 : 0), x, y);
    });
  }
  new Fld([spline(lowerT, 1)], 2, 1.6).paint(b, (x, y, d, l) => {
    const q = inv(x + 0.5, y + 0.5);
    return tq(BEAK, 0.36 + (l - 0.5) * 0.7 + (q[0] > 11 ? -0.1 : 0.06) - (d < 0.8 ? 0.06 : 0), x, y);
  });
  const upper: LM[] = [
    [4.4, -5.6], [7.2, -6.8], [10.8, -6.8], [14, -5.6], [16.6, -3], [17.9, 0.6], [17.7, 4.4], [16.5, 7.4], [15.3, 9.0, 1],
    [14.7, 6.4], [13.9, 4.2], [12.8, 3.0, 0.6], [10, 2.6], [6, 2.6], [4.6, 2.4], [4.5, -2],
  ];
  const fu = new Fld([spline(upper.map(TL), 1)], 3, 2.6);
  fu.ridge([T(7.5, -6.2), T(11.5, -5.7), T(15, -3.8), T(16.6, 0)], 2.2 * k, 1.1);
  fu.paint(b, (x, y, d, l) => {
    const q = inv(x + 0.5, y + 0.5), lx = q[0], ly = q[1];
    // the cere: a saddle of bare yellow skin over the base, the nostril slit in it
    if (lx < 6.9 + (ly + 6) * 0.14 && ly < 0.8) {
      if (Math.hypot((lx - 5.9) / 1.3, (ly + 3.1) / 0.75) < 1) return CERE[0];
      return tq(CERE, 0.52 + (l - 0.5) * 0.9 - (d < 0.8 ? 0.14 : 0), x, y);
    }
    // horn: slate at the base darkening to the black hook, a cold gleam down the culmen
    let ll = 0.6 + (l - 0.5) * 0.8 - cl((lx - 9) / 7) * 0.42;
    if (ly > 1.6 && lx < 14) ll = 0.14;
    if (d > 0.9 && ly < -4.6 && lx > 7.6 && lx < 14.8) ll += 0.16;
    return tq(BEAK, ll, x, y);
  });
  // the gape's yellow flange
  { const q = T(4.6, 2.9); b.set(Math.floor(q[0]), Math.floor(q[1]), CERE[3]); }

  // ---- the eye under the shelf: gold iris, the pupil set forward, a catch-light
  const ex = 0.2, ey = -2.1;
  const c0 = T(ex - 3, ey - 3), c1 = T(ex + 3, ey + 3);
  for (let y = Math.floor(Math.min(c0[1], c1[1])) - 2; y <= Math.ceil(Math.max(c0[1], c1[1])) + 2; y++)
    for (let x = Math.floor(Math.min(c0[0], c1[0])) - 2; x <= Math.ceil(Math.max(c0[0], c1[0])) + 2; x++) {
      const q = inv(x + 0.5, y + 0.5), lx = q[0], ly = q[1];
      const r = Math.hypot((lx - ex) / 2.2, (ly - ey) / 1.75);
      if (r > 1.2) continue;
      let c: C;
      if (r > 0.96) c = PL[0];
      else if (Math.hypot(lx - ex - 0.75, ly - ey) < 0.9) c = H('#000000');
      else c = tq(IRIS, 0.78 - (ly < ey - 0.6 ? 0.44 : 0) - (lx < ex - 1 ? 0.14 : 0), x, y);
      b.set(x, y, c);
    }
  { const q = T(ex - 0.2, ey - 0.5); b.set(Math.floor(q[0]), Math.floor(q[1]), FLASH[3]); }
}

// ================================================================ legs, boots, feet
/** a shaggy feathered mass (trousers, boots, under-tail coverts) inside one contour, strands along ang */
function shaggy(b: PixelBuffer, poly: V2[], ang: number, ramp: C[], base: number, seed: number, bars = 0.22, R = 4, barL = -0.22, ex?: (x: number, y: number) => number) {
  const f = new Fld([poly], R, 3);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  f.paint(b, (x, y, d, l) => {
    const a = x * ca + y * sa, c = -x * sa + y * ca;
    // long strands, each its own tone; dark chevron bars every few px down the strands
    const st = Math.floor(c / 2.2), sv = hash2(st, 5, seed);
    const along = a + sv * 1.6;
    const bar = fr(along / 6 + Math.abs(fr(c / 8) - 0.5) * 0.7) < bars;
    let ll = base + (l - 0.5) * 0.8 + (sv - 0.5) * 0.12 + (bar ? barL : 0);
    if (fr(c / 2.2) < 0.25) ll -= 0.08;
    if (d < 1.2) ll -= 0.16;
    if (ex) ll += ex(x, y);
    return tq(ramp, ll, x, y);
  });
}
/** fringe a contour with pointed feather tips where sel says (outward normal) */
function ragged(poly: V2[], spacing: number, seed: number, len: (x: number, y: number, nx: number, ny: number) => number): V2[] {
  const n = poly.length;
  let area = 0;
  for (let a = 0, c = n - 1; a < n; c = a++) area += (poly[c][0] - poly[a][0]) * (poly[c][1] + poly[a][1]);
  const sg = area > 0 ? 1 : -1;
  let acc = 0;
  return poly.map((q, i) => {
    const a = poly[(i - 1 + n) % n], c = poly[(i + 1) % n];
    const tx = c[0] - a[0], ty = c[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const nx = (ty / tl) * sg, ny = (-tx / tl) * sg;
    if (i > 0) acc += Math.hypot(q[0] - poly[i - 1][0], q[1] - poly[i - 1][1]);
    const L = len(q[0], q[1], nx, ny);
    if (L <= 0) return q;
    const id = Math.floor(acc / spacing), f = acc / spacing - id;
    const r = 0.5 + hash2(id, 3, seed) * 0.8;
    const prof = f < 0.75 ? f / 0.75 : (1 - f) / 0.25;
    return [q[0] + nx * L * r * prof, q[1] + ny * L * r * prof] as V2;
  });
}

export interface ToeSpec { a: number; L: number; curl: number; hook?: number }
/** a foot: yellow scaled toes with knuckle pads, each ending in a huge black talon */
export function tbFoot(b: PixelBuffer, ankle: V2, toes: ToeSpec[], k = 1, far = 0, tk = 1) {
  const ends: { p: V2; a: number; t: ToeSpec }[] = [];
  for (const t of toes) {
    // the toe: a bent strip with its own curl, the phalanx joints swelling under it, scutes across the top
    const pts: V2[] = [];
    let p = ankle, a = t.a;
    const n = 6;
    for (let i = 0; i <= n; i++) {
      pts.push(p);
      if (i < n) { p = add(p, dirv(a), (t.L * k) / n); a += t.curl / n; }
    }
    const wd = (u: number) => (2.3 - u * 0.7 + 0.35 * Math.sin(u * Math.PI * 2.4)) * k;
    vane(b, pts, wd, wd, (x, y, u, v) => {
      if (Math.abs(v) > 0.76) return tq(YEL, 0.14 - far, x, y);
      const sc = fr((u * t.L * k) / 2.2) < 0.3;
      return tq(YEL, 0.6 + v * 0.2 - far + (sc ? -0.22 : 0), x, y);
    });
    ends.push({ p, a, t });
  }
  // the talons over the toes: thick black hooks curving on round past each toe tip to a needle point
  for (const { p, a, t } of ends) {
    const hook = t.hook ?? 1.6 * (Math.sign(Math.cos(t.a)) || 1);
    const tal: V2[] = [];
    let q = add(p, dirv(a), -1.0 * k), ta = a;
    const TL = (t.L * 0.62 + 3) * k * tk;
    for (let i = 0; i <= 7; i++) { tal.push(q); q = add(q, dirv(ta), TL / 7); ta += hook / 7; }
    const tw = (u: number) => Math.max(0.25, (1.45 - u * 1.25) * k);
    const gs = hook > 0 ? -1 : 1;
    vane(b, tal, tw, tw, (x, y, u, v) => {
      if (u > 0.86) return TAL[3];
      // a cold gloss down the outer curve
      return tq(TAL, 0.18 - far + (v * gs > 0.15 && u < 0.75 ? 0.5 : 0) - u * 0.06, x, y);
    });
  }
}

// ================================================================ the view from below
export function tbUnder(phase: number, o: { flee?: boolean; soar?: boolean }): { buf: PixelBuffer; ax: number; ay: number } {
  const UW = 344, UH = 220;
  const b = new PixelBuffer(UW, UH);
  const cx = UW / 2, cy = 104;
  // the beat: wrist height and the primaries' tilt (lift +1 wings up, -1 down)
  const lift = o.soar ? 0.16 + Math.sin(phase * Math.PI * 2) * 0.05 : Math.cos(phase * Math.PI * 2);
  const wy = cy - 25 - lift * 36;
  const tilt = lift * 0.55;
  const B = (x: number, y: number): V2 => [cx + x, cy + y];

  // the tail behind everything
  tbTail(b, B(0, 22), Math.PI / 2, o.flee ? 0.42 : 0.68, 54, true, 300);
  // the wings
  for (const side of [-1, 1] as const) {
    const sx = cx + side * 12, sy = cy - 14;
    const wx = cx + side * (77 - Math.max(0, lift) * 6), wyy = wy + (side === 1 ? 2 : 0);
    const tip = side === 1 ? -tilt * 0.9 + 0.16 : Math.PI + tilt * 0.9 - 0.16;
    tbWing(b, {
      sx, sy, wx, wy: wyy, tip, spread: o.soar ? 0.95 : 0.8 + 0.2 * (1 - Math.abs(lift)), plen: 73,
      sec: Math.PI / 2 + side * (0.08 - lift * 0.14), slen: 46 - Math.max(0, lift) * 9,
      seed: side === 1 ? 11 : 37, gap: o.flee && side === 1 ? 4 : undefined, ruffle: o.flee ? 0.3 : 0, under: true,
    });
  }
  // the under-tail coverts: a fluffy barred skirt over the tail's base
  shaggy(b, ragged(spline([B(-9, 16), B(0, 14), B(9, 16), B(8, 30), B(3, 36), B(-3, 36), B(-8, 30)], 1), 3, 17, (x, y, nx, ny) => (ny > 0.3 ? 3 : 0)), Math.PI / 2, ASH, 0.5, 51, 0.24);
  // the body: neck, the deep keeled chest, the belly narrowing to the vent
  const body: LM[] = [
    [-6, -38], [-10, -31], [-16, -23], [-20.5, -13], [-21, -3], [-18.5, 7], [-14, 15], [-9, 22], [-4, 25.5],
    [4, 25.5], [9, 22], [14, 15], [18.5, 7], [21, -3], [20.5, -13], [16, -23], [10, -31], [6, -38],
  ];
  const bp = ragged(spline(body.map(q => B(q[0], q[1])), 1), 4, 23, (x, y, nx, ny) => (Math.abs(nx) > 0.5 && y > cy - 24 ? 1.6 : 0));
  const fb = new Fld([bp], 7, 5);
  // the keel ridge down the middle, the pectoral masses either side of it, the belly's swell
  fb.ridge([B(0, -24), B(0, -12), B(0, 0), B(0.5, 8)], 3.2, 1.6);
  fb.bump(...B(-9, -9), 9, 12, 2.6); fb.bump(...B(9, -9), 9, 12, 2.6);
  fb.bump(...B(0, 12), 11, 8, 1.6); fb.bump(...B(0, -30), 7, 6, 1.2);
  fb.paint(b, (x, y, d, l) => {
    const lx = x + 0.5 - cx, ly = y + 0.5 - cy;
    const t = scallop(lx, ly, Math.PI / 2 + lx * 0.014, 4.6, 3.6, 61);
    // the slate bib across the chest, its lower edge breaking raggedly, feather by feather, into the ash belly
    const bibEdge = -3 + 3 * Math.cos(lx * 0.2) + (hash2(SC.q, 9, 7) - 0.5) * 6;
    const shade = (l - 0.5) * 0.95 + (d < 1.5 ? -0.06 : 0);
    if (ly < bibEdge || ly < -10) {
      let ll = 0.3 + shade;
      if (t > 0 && t < 0.32) ll -= 0.12;
      else if (t > -0.3 && t <= 0) ll += 0.07;
      return tq(PL, ll, x, y);
    }
    // each belly feather tipped with a dark chevron: rows of storm bars
    if (t > -0.02 && t < 0.4) return tq(PL, 0.26 + shade * 0.6, x, y);
    return tq(ASH, 0.64 + shade * 1.1 + (t < -0.6 ? 0.05 : 0), x, y);
  });
  // the trousers: heavy shaggy thighs hanging either side of the belly, barred
  for (const s of [-1, 1]) {
    const tr = spline([B(s * 9, 2), B(s * 16, 1), B(s * 21, 9), B(s * 20, 20), B(s * 15, 28), B(s * 9, 27), B(s * 7, 16)], 1);
    shaggy(b, ragged(tr, 2.6, 31 + s, (x, y, nx, ny) => (ny > -0.1 || nx * s > 0.4 ? 3.2 : 0)), Math.PI / 2 - s * 0.2, ASH, 0.6, 70 + s, 0.3, 4, -0.34);
  }
  // the feet balled up under the vent: booted shanks, the toes clenched round the talons
  for (const s of [-1, 1]) {
    const boot = spline([B(s * 8, 22), B(s * 14, 21), B(s * 13, 29), B(s * 8, 33), B(s * 4, 31)], 1);
    shaggy(b, ragged(boot, 2.2, 90 + s, (x, y, nx, ny) => (ny > 0.2 ? 2 : 0)), Math.PI / 2 - s * 0.6, ASH, 0.56, 91 + s, 0.3, 3, -0.34);
    const an = B(s * 7, 30);
    tbFoot(b, an, [
      { a: Math.PI / 2 + s * 0.25, L: 6.5, curl: s * 0.4, hook: s * 1.7 },
      { a: Math.PI / 2 - s * 0.2, L: 7.5, curl: s * 0.4, hook: s * 1.7 },
      { a: Math.PI / 2 - s * 0.7, L: 6, curl: s * 0.4, hook: s * 1.6 },
      { a: -Math.PI / 2 - s * 0.9, L: 4.5, curl: -s * 0.3, hook: -s * 1.8 },
    ], 1.15, 0, 0.8);
  }
  // the head, turned to look down at you
  tbHead(b, { o: B(4, -46), a: 0.42, under: true, k: 1.2 });
  b.outline(TB_INK);
  return { buf: b, ax: cx, ay: cy };
}

// ================================================================ the profiles
/** a wing folded tight along the back (the stoop): coverts, stacked secondaries, the long primaries past the tail */
function tbFolded(b: PixelBuffer, P: (u: number, v: number) => V2, ang: number) {
  const D = (a: number): V2 => dirv(a + ang);
  // primaries: from the hand back past the tail, inner (top) to outer (bottom), the lightning across them
  const prim: { base: V2; d: V2; L: number; sh: V2[] }[] = [];
  for (let k = 0; k < 8; k++) {
    const base = P(10 - k * 2.2, -9 + k * 0.9);
    const d = D(Math.PI + 0.06 - k * 0.022);
    const L = 54 + k * 2.4 - (k > 5 ? (k - 5) * 5 : 0);
    prim.push({ base, d, L, sh: shaft(base, d, L, D(Math.PI / 2), 0.025, 6) });
  }
  const bolt = [P(-30, -12), P(-35, -8), P(-31, -5), P(-37, -1.5), P(-33, 1.5)];
  const boltD = (x: number, y: number) => {
    let best = 9;
    for (let i = 1; i < bolt.length; i++) {
      const a = bolt[i - 1], c = bolt[i], sx = c[0] - a[0], sy = c[1] - a[1], L2 = sx * sx + sy * sy;
      const t = cl(((x - a[0]) * sx + (y - a[1]) * sy) / L2);
      best = Math.min(best, Math.hypot(x - a[0] - sx * t, y - a[1] - sy * t));
    }
    return best;
  };
  prim.forEach((p, k) => {
    const ww = (u: number) => 3.2 * (1 - u * 0.25) * (u > 0.84 ? Math.sqrt(Math.max(0, 1 - ((u - 0.84) / 0.16) ** 2)) : 1);
    vane(b, p.sh, ww, ww, (x, y, u, v) => {
      if (v > 0.72) return PL[0];
      if (u > 0.3 && u < 0.62) { const bd = boltD(x + 0.5, y + 0.5); if (bd < 1.6) return bd < 0.8 ? FLASH[3] : FLASH[1]; }
      if (v < -0.55 && u < 0.8) return tq(STEEL, 0.34 + (k % 2) * 0.06 - u * 0.1, x, y);
      return tq(PL, 0.26 - u * 0.12 + (k % 2) * 0.04 + (fr(u * 5) < 0.18 && u < 0.75 ? 0.1 : 0), x, y);
    });
  });
  // secondaries: broad, stacked, each with a pale tip
  for (let i = 0; i < 7; i++) {
    const base = P(14 - i * 2.6, -11 + i * 0.5);
    const d = D(Math.PI + 0.12 - i * 0.03);
    const L = 26 + i * 0.6;
    const sh = shaft(base, d, L, D(Math.PI / 2), 0.03, 5);
    const ww = (u: number) => 4.2 * (u > 0.88 ? Math.sqrt(Math.max(0, 1 - ((u - 0.88) / 0.12) ** 2)) * 0.8 + 0.2 : 1);
    vane(b, sh, ww, ww, (x, y, u, v) => {
      if (v > 0.78) return PL[0];
      if (u > 0.9) return tq(ASH, 0.42, x, y);
      return tq(PL, 0.34 - u * 0.08 + (v < -0.3 ? 0.06 : 0) + (fr(u * 4) < 0.2 && u > 0.2 ? 0.08 : 0), x, y);
    });
  }
  // the coverts over the forearm: ember-fringed scallops, the leading edge lit
  const out: LM[] = [[16, -6], [13, -12], [6, -15.5], [-4, -15], [-12, -12], [-8, -7], [2, -4], [10, -3]];
  const f = new Fld([spline(out.map(q => [...P(q[0], q[1]), sh3(q)] as LM), 1)], 3, 2.5);
  const c = Math.cos(ang), sn = Math.sin(ang), [ox, oy] = P(0, 0);
  f.paint(b, (x, y, d, l) => {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy, u = dx * c + dy * sn, v = -dx * sn + dy * c;
    const sh = (l - 0.5) * 0.7;
    if (d < 1.6 && v < -11) return tq(STEEL, 0.5 + sh, x, y);
    const t = scallop(u, v, Math.PI + 0.3, 4.2, 3.2, 77);
    if (t > 0 && t < 0.36) return tq(PL, 0.2 + sh, x, y);
    if (t > -0.3 && t <= 0) return tq(RU, 0.36 + sh * 0.6, x, y);
    return tq(PL, 0.38 + sh, x, y);
  });
}

type ProfileKind = 'dive' | 'land' | 'shriek' | 'hurt';
export function tbProfile(kind: ProfileKind, f: number): { buf: PixelBuffer; ax: number; ay: number } {
  const PW = 300, PH = 230;
  const b = new PixelBuffer(PW, PH);
  const cx = 150, cy = kind === 'dive' ? 110 : 150;
  const ang = kind === 'dive' ? (f === 0 ? 0.62 : 0.22) : kind === 'shriek' ? -0.55 : kind === 'hurt' ? -0.12 : -0.38 + f * 0.1;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (u: number, v: number): V2 => [cx + u * ca - v * sa, cy + u * sa + v * ca];
  const shoulder = P(8, -12);
  const wings: TBWing[] = [];
  const stoop = kind === 'dive' && f === 0;
  if (kind === 'dive' && f === 1) {
    // the strike: wings thrown up and forward to brake, their undersides to us
    wings.push({ sx: shoulder[0] - 6, sy: shoulder[1] + 2, wx: shoulder[0] - 36, wy: shoulder[1] - 30, tip: -2.55, spread: 1.0, plen: 68, sec: 2.3, slen: 30, far: true, seed: 22 });
    wings.push({ sx: shoulder[0], sy: shoulder[1], wx: shoulder[0] - 22, wy: shoulder[1] - 32, tip: -2.4, spread: 1.1, plen: 70, sec: 2.61, slen: 34, seed: 23, under: true });
  } else if (kind === 'land') {
    // mantling: both wings spread up and out over the bait like a cloak
    const k = f ? 4 : 0;
    wings.push({ sx: shoulder[0] - 8, sy: shoulder[1] + 2, wx: shoulder[0] - 64, wy: shoulder[1] - 36 + k, tip: Math.PI + 0.75, spread: 1.0, plen: 76, sec: Math.PI * 0.42, slen: 34, far: true, seed: 24 });
    wings.push({ sx: shoulder[0], sy: shoulder[1], wx: shoulder[0] + 48, wy: shoulder[1] - 46 + k, tip: -0.52, spread: 1.1, plen: 78, sec: -2.36, slen: 36, seed: 25, under: true });
  } else if (kind === 'shriek') {
    const k = f ? -5 : 0;
    wings.push({ sx: shoulder[0] - 8, sy: shoulder[1] + 2, wx: shoulder[0] - 44, wy: shoulder[1] - 50 + k, tip: -2.55, spread: 1.05, plen: 74, sec: Math.PI * 0.3, slen: 36, far: true, seed: 26 });
    wings.push({ sx: shoulder[0], sy: shoulder[1], wx: shoulder[0] + 32, wy: shoulder[1] - 50 + k, tip: -0.56, spread: 1.15, plen: 78, sec: -2.6, slen: 38, seed: 27, under: true });
  } else if (kind === 'hurt') {
    // the near wing hangs, primaries knocked about
    wings.push({ sx: shoulder[0] - 8, sy: shoulder[1] + 2, wx: shoulder[0] - 50, wy: shoulder[1] - 30, tip: Math.PI + 0.9, spread: 0.9, plen: 70, sec: Math.PI * 0.4, slen: 30, far: true, seed: 28 });
    wings.push({ sx: shoulder[0], sy: shoulder[1], wx: shoulder[0] + 24 + f * 4, wy: shoulder[1] + 25, tip: 0.32, spread: 0.8, plen: 58, sec: Math.PI * 0.95, slen: 30, ruffle: 1, gap: 3, seed: 29 });
  }
  if (wings.length > 1) tbWing(b, wings[0]);

  // the tail, a little fanned behind
  {
    const [tx, ty] = P(-26, 0);
    const a = ang + Math.PI + (kind === 'land' ? -0.1 : 0);
    tbTail(b, [tx, ty], a, stoop ? 0.08 : 0.2, 50, false, 200, 0, 6);
  }
  // the far leg (behind the body)
  const standing = kind !== 'dive';
  const strike = kind === 'dive' && f === 1;
  const gy = cy + 54;
  const leg = (near: boolean) => {
    const dx = near ? 4 : -7, far = near ? 0 : 0.12;
    const hip = P(-4 + (near ? 2 : -2), 9);
    if (standing) {
      const ank: V2 = [hip[0] + dx * 0.4 + 2, gy - 15];
      // the trousers: a shaggy column of barred feathers from the hip to below the knee
      const tr = spline([[hip[0] - 9, hip[1] - 4], [hip[0] + 8, hip[1] - 3], [hip[0] + 11, hip[1] + 10], [ank[0] + 7, ank[1] - 6], [ank[0] + 2, ank[1] + 3], [ank[0] - 6, ank[1] - 2], [hip[0] - 10, hip[1] + 12]], 1);
      shaggy(b, ragged(tr, 2.6, 40 + dx, (x, y, nx, ny) => (ny > -0.2 || Math.abs(nx) > 0.7 ? 3 : 0)), Math.PI / 2 + 0.12, ASH, 0.62 - far * 1.6, 41 + dx, 0.3, 4, -0.36, (x, y) => (y < hip[1] + 1 ? -0.3 : y < hip[1] + 3 ? -0.14 : 0));
      // the boot: feathered right down to the toes
      const boot = spline([[ank[0] - 4, ank[1] - 2], [ank[0] + 4, ank[1] - 2], [ank[0] + 5, gy - 5], [ank[0] + 1, gy - 2], [ank[0] - 5, gy - 4]], 1);
      shaggy(b, ragged(boot, 2, 50 + dx, (x, y, nx, ny) => (ny > 0.3 ? 2 : Math.abs(nx) > 0.6 ? 1.4 : 0)), Math.PI / 2, ASH, 0.56 - far * 1.6, 51 + dx, 0.3, 3, -0.3, (x, y) => (y < ank[1] ? -0.2 : 0));
      tbFoot(b, [ank[0] + 1, gy - 5], [
        { a: 0.32, L: 11, curl: -0.25 }, { a: 0.52, L: 8.5, curl: -0.3 }, { a: 0.85, L: 6, curl: -0.4 }, { a: Math.PI - 0.38, L: 7, curl: 0.3 },
      ], 1, far, 0.62);
    } else if (strike) {
      // the legs thrown forward: trousers streaming back, the boots driving the open feet at the target
      const ank = P(18 + (near ? 2 : -3), 24 + (near ? 2 : -2));
      const tr = spline([[hip[0] - 8, hip[1] - 4], [hip[0] + 8, hip[1] - 2], [ank[0] + 2, ank[1] - 6], [ank[0] - 2, ank[1] + 3], [hip[0] - 6, hip[1] + 14]], 1);
      shaggy(b, ragged(tr, 2.6, 60 + dx, (x, y, nx, ny) => (nx < 0.2 ? 3.4 : 0)), ang + Math.PI * 0.9, ASH, 0.62 - far * 1.6, 61 + dx, 0.3, 4, -0.36);
      tbFoot(b, ank, [
        { a: ang - 0.05, L: 11, curl: 0.3, hook: 1.7 }, { a: ang + 0.45, L: 10, curl: 0.3, hook: 1.7 }, { a: ang + 0.95, L: 8, curl: 0.3, hook: 1.6 }, { a: ang + 2.5, L: 8, curl: -0.3, hook: -1.8 },
      ], 1.1, far);
    } else {
      // the stoop: legs tucked back along the belly, feet balled
      const ank = P(-14, 14 + (near ? 0 : -1));
      const tr = spline([[...P(-2, 6)], [...P(4, 12)], [...P(-8, 17)], [...P(-18, 16)], [...P(-14, 9)]], 1);
      shaggy(b, ragged(tr, 2.4, 70 + dx, (x, y, nx, ny) => (ny > 0 ? 2.4 : 0)), ang + Math.PI, ASH, 0.6 - far * 1.6, 71 + dx, 0.3, 4, -0.36);
      tbFoot(b, ank, [{ a: ang + Math.PI * 0.5, L: 6, curl: -1.8 }, { a: ang + Math.PI * 0.75, L: 6, curl: -1.8 }], 0.9, far);
    }
  };
  leg(false);

  // the body: back, rump, the deep keeled breast, the crop and neck up into the head
  const body: LM[] = [
    [20, -17], [12, -16], [2, -16.5], [-10, -15], [-20, -11], [-28, -5], [-31, 0, 0.4], [-27, 5], [-18, 10],
    [-6, 15], [6, 17], [15, 14], [21, 8], [25, 1], [27, -6], [26, -14],
  ];
  const bp = spline(body.map(q => [...P(q[0], q[1]), sh3(q)] as LM), 1);
  const fb = new Fld([bp], 7, 6);
  const inv = (x: number, y: number): V2 => { const dx = x - cx, dy = y - cy; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
  // the keel's curve and the pectoral mass, the thigh's swell, the scapulars
  fb.bump(...P(10, 6), 13, 10, 3, ang);
  fb.ridge([P(2, 15), P(12, 13), P(20, 7)], 3, 1.2);
  fb.bump(...P(-8, -10), 14, 6, 1.6, ang);
  fb.paint(b, (x, y, d, l) => {
    const [u, v] = inv(x + 0.5, y + 0.5);
    const t = scallop(u, v, Math.PI + 0.35, 4.4, 3.4, 62);
    const shade = (l - 0.5) * 0.95 + (d < 1.5 ? -0.05 : 0);
    // the mantle and scapulars: dark, every feather fringed with embers
    if (v < -6 + u * 0.08) {
      if (t > 0 && t < 0.34) return tq(PL, 0.2 + shade, x, y);
      if (t > -0.3 && t <= 0 && v < -9) return tq(RU, 0.34 + shade * 0.7, x, y);
      return tq(PL, 0.36 + shade, x, y);
    }
    // the slate bib down the front of the breast, breaking feather by feather into the barred ash belly
    const bibEdge = 4 - v * 0.42 + (hash2(SC.r, SC.q, 7) - 0.5) * 5;
    if (u > bibEdge) {
      let ll = 0.32 + shade;
      if (t > 0 && t < 0.32) ll -= 0.12;
      else if (t > -0.3 && t <= 0) ll += 0.07;
      return tq(PL, ll, x, y);
    }
    if (t > -0.02 && t < 0.4) return tq(PL, 0.26 + shade * 0.6, x, y);
    return tq(ASH, 0.64 + shade * 1.1, x, y);
  });
  leg(true);
  // the near wing over the body
  if (stoop) tbFolded(b, P, ang);
  else tbWing(b, wings[wings.length - 1]);
  // the head
  const ho = P(33, -13);
  const ha = kind === 'dive' ? (f === 0 ? ang : 0.38) : kind === 'shriek' ? -0.72 + f * 0.06 : kind === 'hurt' ? 0.05 : 0.32 - f * 0.08;
  tbHead(b, { o: ho, a: ha, open: kind === 'shriek' ? 1 : kind === 'hurt' ? 0.6 : 0, k: 1.15 });
  // torn loose feathers drifting off a hurt bird
  if (kind === 'hurt') for (let k = 0; k < 3; k++) {
    const x = cx - 40 + k * 34 + f * 6, y = cy - 70 + k * 18 - f * 8;
    const d = nrm([16 - k * 6, 6 + k * 3]);
    const sh = shaft([x, y], d, 16 - k * 3, rot(d, Math.PI / 2), 0.1, 5);
    const ww = (u: number) => 2.2 * (u > 0.75 ? Math.sqrt(Math.max(0, 1 - ((u - 0.75) / 0.25) ** 2)) : 1);
    vane(b, sh, ww, ww, (px, py, u, v) => (Math.abs(v) < 0.2 ? ASH[5] : tq(PL, 0.42 + (v < 0 ? 0.1 : 0) - u * 0.1 + (fr(u * 3) < 0.3 ? 0.12 : 0), px, py)));
  }
  b.outline(TB_INK);
  return { buf: b, ax: cx, ay: kind === 'dive' ? cy : cy + 54 };
}

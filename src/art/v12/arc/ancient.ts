// V12 Te Ara Matatū, the finale: Te Ngārara Nui, the Old One of Te Korokoro (Sphenodon kaitiaki), a
// tuatara the length of a waka.
//
// The last of a line older than the dinosaurs, grown huge and slow in the warm throat of the island.
// It is painted from real tuatara anatomy (Sphenodon punctatus), scaled up and aged:
//   - the head: a deep wedge, the upper jaw's beaked premaxilla hooking over the lower jaw, the long
//     wavy mouth line running back past the eye and turning up at the corner, the jaw-closing muscles
//     bulging behind the eye, a big dark eye with a vertical pupil under a heavy brow ridge, a small
//     nostril near the tip, a row of pale labial scales along each lip, plates on the snout and over
//     the eye, granular scales on the cheek and crown, and on the crown the parietal ("third") eye;
//   - a loose throat stacked with transverse folds, and a short, thick, wrinkled neck;
//   - the crest: soft, flat, cream triangular spines on the neck (the nuchal crest, tallest), a gap
//     over the shoulders, the dorsal crest down the back, and on the tail a row of small dark teeth;
//   - a heavy, low, barrel-chested body: the shoulder blade and the hip bone and the ribs reading
//     under granular skin with scattered tubercles, a lateral skin fold, pale speckles over olive and
//     brick, and pale ventral plates in transverse rows;
//   - sprawling limbs: the upper arm and thigh out and down, the elbow bent back, the knee forward,
//     muscled forearms and shins, five separate toes with scale bands and long curved dark claws;
//   - a thick, banded tail as long as the body, with its crest row;
//   - its age: an old raking scar, a chipped and a broken spine, lichen on the back and moss in the
//     neck folds, worn claws.
//
// The form is sculpted, not stacked from blobs: every part is a 2.5D height field (Lay) built from
// its real masses (the vertebral line with its cross-section profile, the skull and the jaw as one
// lofted form, the limb bones with their muscle profiles) plus sculpted bone and muscle bumps, then
// per-region scale texture (cellular scales, folds, plates, rings) as displacement, lit from the
// field's own normals and written into the beast sketch G-buffer (beasts-core Sk), which gives the
// palette ramps, the contour lines between parts and the outline.
//
// Anims (anchor: the ground under the middle of the body, facing right): idle (breathing, the throat
// pumping, the crest stirring, a blink), walk (the slow sprawling diagonal walk, the girdles swinging,
// the tail sweeping), tell (the warning: it rears on straighter legs, the head lifts, the crest stands
// up and pales, the throat swells, the mouth parts and the third eye gleams), strike (a coil, the jaws
// open on the saw-edged bone, the lunge, the snap, the recoil), retreat (head low, crest folded,
// walking off into the steam), bask (belly down on warm stone, limbs splayed, eyes half shut), call
// (head up, the mouth open in a deep croak, the throat pulsing).

import { Sk, rmp, lumN, TAU, gait, ik2, qbez, cbez } from '../../beasts-core';
import type { V2, BeastEye, AnimDef, SpeciesDef } from '../../beasts-core';
import { hex } from '../../color';
import type { C } from '../../color';
import { hash2, noise2 } from '../../../core/math';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const ANCIENT_ANIMS: Record<string, AnimDef> = {
  idle: A(6, 2.5),
  walk: A(8, 5),
  tell: A(6, 5),
  strike: A(6, 9, false),
  retreat: A(8, 5),
  bask: A(2, 0.6),
  call: A(4, 3),
};

// ================================================================== pose
interface TP {
  /** whole body forward (px) and up (px); front raised about the hips (rad) */
  x: number; lift: number; rear: number;
  /** 0 sprawling .. 1 up on straighter legs (the tell) */
  erect: number;
  /** neck elevation (rad, + up), head pitch on the neck (rad, + nose down), neck reach (px) */
  neck: number; head: number; reach: number;
  jaw: number; throat: number;
  /** crest: 0.55 folded .. 1 relaxed .. 1.6 raised; paleness; the parietal eye's gleam */
  crest: number; pale: number; third: number;
  /** foot offsets from rest: near fore, far fore, near hind, far hind */
  feet: [V2, V2, V2, V2];
  /** girdle swing -1..1 (+: near shoulder forward), tail sweep, breath */
  sway: number; tail: number; breathe: number;
  eye: number;
  /** 0..1 belly down on the ground */
  flat: number;
}

function tpose(anim: string, f: number, n: number): TP {
  const t = f / n, s = Math.sin(t * TAU);
  const p: TP = {
    x: 0, lift: 0, rear: 0, erect: 0, neck: 0.1, head: 0.1, reach: 0, jaw: 0, throat: 0.15,
    crest: 1, pale: 0, third: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]], sway: 0, tail: 0, breathe: s, eye: 1, flat: 0,
  };
  const S = <T,>(a: T[]): T => a[Math.min(a.length - 1, f)];
  switch (anim) {
    case 'idle':
      p.eye = f === 4 ? 0 : 1;
      p.crest = 1 + s * 0.05;
      // buccal pumping: the throat flutters as it breathes
      p.throat = 0.12 + 0.16 * Math.max(0, Math.sin(t * TAU * 2));
      p.head = 0.1 + s * 0.025;
      p.tail = Math.sin(t * TAU + 0.6) * 0.15;
      break;
    case 'walk': case 'retreat': {
      // the diagonal walk: near fore with far hind, far fore with near hind; the girdles swing
      const r = anim === 'retreat';
      const st = r ? 13 : 15, lf = r ? 4.5 : 5.5, duty = 0.64;
      p.feet[0] = gait(t, duty, st, lf); p.feet[3] = gait(t, duty, st, lf);
      p.feet[1] = gait(t + 0.5, duty, st, lf); p.feet[2] = gait(t + 0.5, duty, st, lf);
      p.sway = Math.sin(t * TAU);
      p.tail = Math.sin(t * TAU + 1.3);
      p.lift = (r ? -3.5 : 1.5) + Math.cos(t * TAU * 2) * 0.8;
      p.neck = r ? -0.14 : 0.08; p.head = (r ? 0.2 : 0.1) + Math.sin(t * TAU * 2) * 0.025;
      p.crest = r ? 0.55 : 0.95;
      p.breathe = Math.sin(t * TAU * 2) * 0.4;
      break;
    }
    case 'tell':
      // the warning: up on straighter legs, the front raised, the head high and the throat swollen
      p.rear = 0.19 + s * 0.006; p.lift = 4; p.erect = 1;
      p.neck = 0.26 + s * 0.02; p.head = 0.04;
      p.jaw = 0.13 + Math.max(0, s) * 0.07;
      p.crest = 1.6 + s * 0.06; p.pale = 1;
      p.throat = 0.8 + s * 0.2; p.third = 0.6 + Math.max(0, s) * 0.4;
      p.feet[0] = [-3, 0]; p.feet[1] = [-3, 0];
      break;
    case 'strike':
      // coil, gape, lunge, snap, recoil
      p.x = S([-5, -8, 10, 17, 11, 4]);
      p.rear = S([0.16, 0.19, 0.03, -0.02, 0.0, 0.05]);
      p.lift = S([4, 5, 2, 1, 2, 3]); p.erect = S([0.9, 1, 0.5, 0.3, 0.4, 0.6]);
      p.neck = S([0.3, 0.38, 0.06, -0.06, 0.0, 0.12]);
      p.head = S([0.04, -0.12, -0.08, 0.14, 0.14, 0.1]);
      p.reach = S([-2, -3, 6, 8, 5, 1]);
      p.jaw = S([0.2, 0.75, 1, 0.06, 0, 0]);
      p.crest = S([1.6, 1.65, 1.5, 1.35, 1.25, 1.15]); p.pale = 1; p.third = 0.4;
      p.throat = S([0.6, 0.5, 0.3, 0.3, 0.4, 0.4]);
      p.tail = S([0.2, -0.5, 0.9, 1.2, 0.8, 0.3]);
      // the hind feet stay planted; the near fore steps into the lunge
      p.feet[2] = [-p.x, 0]; p.feet[3] = [-p.x, 0];
      p.feet[0] = S([[5, 0], [8, -2], [2, -4], [-4, 0], [-4, 0], [-2, 0]] as V2[]);
      p.feet[1] = [-p.x * 0.6, 0];
      break;
    case 'bask':
      p.flat = 1; p.lift = 0; p.neck = -0.06; p.head = 0.12; p.eye = 0.35 + f * 0.05;
      p.crest = 0.72; p.throat = 0.05; p.tail = 0.1; p.breathe = f ? 0.6 : -0.6;
      p.feet[0] = [9, 0]; p.feet[1] = [7, 0]; p.feet[2] = [-17, 0]; p.feet[3] = [-15, 0];
      break;
    case 'call':
      p.rear = 0.15; p.lift = 3; p.erect = 0.8;
      p.neck = 0.38; p.head = -0.22;
      p.jaw = S([0.3, 0.68, 0.75, 0.42]); p.throat = S([0.5, 1, 1, 0.6]);
      p.crest = 1.4; p.pale = 0.6; p.third = 0.3;
      p.feet[0] = [-2, 0];
      break;
  }
  return p;
}

// ================================================================== small maths
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ss = (a: number, b: number, v: number) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const gs = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));
const fr = (v: number) => v - Math.floor(v);
const smax = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
/** superellipse cross-section: 1 at the middle, 0 at |v| = 1 (tabled per exponent) */
const SE_N = 2048;
const seTabs = new Map<number, Float32Array>();
const se = (av: number, pe: number) => {
  if (av >= 1) return 0;
  let tb = seTabs.get(pe);
  if (!tb) {
    tb = new Float32Array(SE_N + 1);
    for (let i = 0; i <= SE_N; i++) tb[i] = Math.pow(1 - Math.pow(i / SE_N, pe), 1 / pe);
    seTabs.set(pe, tb);
  }
  const f = av * SE_N, i = f | 0;
  return tb[i] + (tb[i + 1] - tb[i]) * (f - i);
};
const rotP = (p: V2, o: V2, a: number): V2 => {
  const c = Math.cos(a), s = Math.sin(a), dx = p[0] - o[0], dy = p[1] - o[1];
  return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c];
};

/** Catmull-Rom through [x, y] keys (x ascending), clamped at the ends. */
function crv(keys: readonly (readonly [number, number])[], x: number): number {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 1;
  while (keys[i][0] < x) i++;
  const p1 = keys[i - 1], p2 = keys[i], p0 = keys[Math.max(0, i - 2)], p3 = keys[Math.min(n - 1, i + 1)];
  const dx = p2[0] - p1[0], t = (x - p1[0]) / dx;
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * dx, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * dx;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

/** Cellular (Worley) noise: F1, F2 (in cell units), the nearest feature point and its hash. */
let F1 = 0, F2 = 0, CX = 0, CY = 0, CI = 0;
function cell(x: number, y: number, sx: number, sy: number, seed: number, jit = 0.8) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  F1 = 9; F2 = 9;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.5 + (hash2(cx, cy, seed) - 0.5) * jit) * sx;
      const py = (cy + 0.5 + (hash2(cx, cy, seed + 1) - 0.5) * jit) * sy;
      const dx = (x - px) / sx, dy = (y - py) / sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < F1) { F2 = F1; F1 = d; CX = px; CY = py; CI = hash2(cx, cy, seed + 2); } else if (d < F2) F2 = d;
    }
}
/** a domed scale from the last cell(): 0 in the groove between scales, 1 on the crown */
const scaleH = (k = 2.6) => Math.pow(cl((F2 - F1) * k), 0.65);

// ================================================================== the 2.5D layer
const EMPTY = -1e9;
interface Tx { z: number; m: number; t: number }

/**
 * A height field over the canvas for one part: each pixel holds the front surface's depth, a material,
 * a lighting offset and an element id. Masses are merged with a smooth max (organic fillets instead of
 * hard creases). emit() lights every pixel from the field's own normals (finite differences, so every
 * bump, fold and scale shades itself), draws a seam line where one element passes in front of another
 * (toes, the elbow, crest spines), and writes it all into the sketch.
 */
class Lay {
  readonly X0: number; readonly Y0: number; readonly w: number; readonly h: number;
  readonly z: Float32Array; readonly m: Uint8Array; readonly t: Float32Array; readonly id: Uint8Array;
  constructor(readonly sk: Sk, lx0: number, ly0: number, lx1: number, ly1: number) {
    this.X0 = Math.max(0, Math.floor(lx0 + sk.ox) - 1);
    this.Y0 = Math.max(0, Math.floor(ly0 + sk.oy) - 1);
    const X1 = Math.min(sk.w - 1, Math.ceil(lx1 + sk.ox) + 1), Y1 = Math.min(sk.h - 1, Math.ceil(ly1 + sk.oy) + 1);
    this.w = Math.max(0, X1 - this.X0 + 1); this.h = Math.max(0, Y1 - this.Y0 + 1);
    const n = this.w * this.h;
    this.z = new Float32Array(n).fill(EMPTY); this.m = new Uint8Array(n); this.t = new Float32Array(n); this.id = new Uint8Array(n);
  }
  lx(i: number) { return this.X0 + i - this.sk.ox + 0.5; }
  ly(j: number) { return this.Y0 + j - this.sk.oy + 0.5; }
  /** column/row range covering local [a, b] */
  cols(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.ox) - this.X0), Math.min(this.w - 1, Math.ceil(b + this.sk.ox) - this.X0)]; }
  rows(a: number, b: number): [number, number] { return [Math.max(0, Math.floor(a + this.sk.oy) - this.Y0), Math.min(this.h - 1, Math.ceil(b + this.sk.oy) - this.Y0)]; }
  put(k: number, z: number, m: number, t: number, id: number, blend: number) {
    const o = this.z[k];
    if (o === EMPTY) { this.z[k] = z; this.m[k] = m; this.t[k] = t; this.id[k] = id; return; }
    if (z > o) { this.m[k] = m; this.t[k] = t; this.id[k] = id; }
    this.z[k] = blend > 0 ? smax(o, z, blend) : Math.max(o, z);
  }
  emit(bias = 0, drop = 2.4, seam = 1.4, seamDark = 0.34, contrast = 1, ao = 0, aoR = 3) {
    const { w, h, z, m, t, id, sk } = this;
    // cavities: a pixel lower than its neighbourhood (a crease, a socket, a fold) is shaded
    let cav: Float32Array | null = null;
    if (ao > 0) {
      const n = w * h, sz = new Float32Array(n), sc = new Float32Array(n), tz = new Float32Array(n), tc = new Float32Array(n);
      for (let j = 0; j < h; j++) {
        let az = 0, ac = 0;
        for (let i = -aoR; i < w + aoR; i++) {
          const a = i + aoR, b = i - aoR - 1;
          if (a < w && a >= 0) { const v = z[j * w + a]; if (v !== EMPTY) { az += v; ac++; } }
          if (b >= 0 && b < w) { const v = z[j * w + b]; if (v !== EMPTY) { az -= v; ac--; } }
          if (i >= 0 && i < w) { tz[j * w + i] = az; tc[j * w + i] = ac; }
        }
      }
      for (let i = 0; i < w; i++) {
        let az = 0, ac = 0;
        for (let j = -aoR; j < h + aoR; j++) {
          const a = j + aoR, b = j - aoR - 1;
          if (a < h && a >= 0) { az += tz[a * w + i]; ac += tc[a * w + i]; }
          if (b >= 0 && b < h) { az -= tz[b * w + i]; ac -= tc[b * w + i]; }
          if (j >= 0 && j < h) { sz[j * w + i] = az; sc[j * w + i] = ac; }
        }
      }
      cav = new Float32Array(n);
      for (let k = 0; k < n; k++) if (z[k] !== EMPTY && sc[k] > 0) cav[k] = Math.max(0, sz[k] / sc[k] - z[k]);
    }
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i, zc = z[k];
        if (zc === EMPTY) continue;
        const zl = i > 0 && z[k - 1] !== EMPTY ? z[k - 1] : zc - drop;
        const zr = i < w - 1 && z[k + 1] !== EMPTY ? z[k + 1] : zc - drop;
        const zu = j > 0 && z[k - w] !== EMPTY ? z[k - w] : zc - drop;
        const zd = j < h - 1 && z[k + w] !== EMPTY ? z[k + w] : zc - drop;
        let nx = -(zr - zl) * 0.5, ny = -(zd - zu) * 0.5, nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        let l = 0.5 + (lumN(nx, ny, nz) - 0.5) * contrast + t[k] + bias;
        if (cav) l -= Math.min(0.3, cav[k] * ao);
        const me = id[k];
        if ((i > 0 && id[k - 1] !== me && z[k - 1] - zc > seam) || (i < w - 1 && id[k + 1] !== me && z[k + 1] - zc > seam) ||
          (j > 0 && id[k - w] !== me && z[k - w] - zc > seam) || (j < h - 1 && id[k + w] !== me && z[k + w] - zc > seam)) l -= seamDark;
        sk.dot(this.lx(i), this.ly(j), m[k], l, zc);
      }
  }
}

/**
 * A tapered limb bone (capsule) with a muscle profile, swept between two 3D points (screen x, y and
 * depth z) into a layer. tex gets (along px, across px, t, radius) and fills the scale texture.
 */
function bone(L: Lay, a: V2, za: number, b: V2, zb: number, r0: number, r1: number, bulge: number, bAt: number,
  id: number, blend: number, tex: (al: number, ac: number, t: number, o: Tx) => void, rz = 1) {
  const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy, len = Math.sqrt(L2) || 1e-6;
  const R = Math.max(r0, r1) + bulge + 1;
  const [i0, i1] = L.cols(Math.min(a[0], b[0]) - R, Math.max(a[0], b[0]) + R);
  const [j0, j1] = L.rows(Math.min(a[1], b[1]) - R, Math.max(a[1], b[1]) + R);
  const o: Tx = { z: 0, m: 0, t: 0 };
  for (let j = j0; j <= j1; j++) {
    const py = L.ly(j);
    for (let i = i0; i <= i1; i++) {
      const px = L.lx(i);
      let k = L2 > 0 ? ((px - a[0]) * sx + (py - a[1]) * sy) / L2 : 0;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const qx = a[0] + sx * k, qy = a[1] + sy * k;
      const dx = px - qx, dy = py - qy, d = Math.sqrt(dx * dx + dy * dy);
      const r = r0 + (r1 - r0) * k + bulge * Math.pow(Math.sin(Math.PI * cl(k / (2 * bAt))), 1.4) * (k < 2 * bAt ? 1 : 0);
      if (d > r) continue;
      const w = Math.sqrt(1 - (d / r) * (d / r));
      const side = sx * dy - sy * dx > 0 ? 1 : -1;
      o.z = 0; o.m = 0; o.t = 0;
      tex(k * len, side * d, k, o);
      L.put(j * L.w + i, za + (zb - za) * k + r * w * rz + o.z * w, o.m, o.t, id, blend);
    }
  }
}

// ================================================================== the head's shape (head units, x forward from the occiput, y down)
const H_TOP: readonly (readonly [number, number])[] = [[-2.5, -4.5], [-1, -7.8], [1.5, -10.2], [5, -11.4], [10, -11.9], [16, -12.2], [20, -12.8], [23.5, -13.1], [27, -12.0], [31, -9.9], [35, -7.6], [39, -5.0], [42, -2.6], [44.1, 0.1], [45.3, 3.3], [45.9, 6.6], [46, 9.0]];
const H_BOT: readonly (readonly [number, number])[] = [[-2.5, 7.5], [-1, 9.2], [0.5, 9.8], [3, 8.4], [5.5, 7.3], [8, 7.6], [12, 8.3], [18, 8.9], [24, 9.3], [30, 8.9], [35, 8.6], [39, 9.0], [41.8, 9.9], [43.6, 11.1], [44.9, 11.5], [45.7, 10.4], [46, 9.0]];
const J_TOP: readonly (readonly [number, number])[] = [[-1.5, 10.8], [0, 9.2], [2.5, 8.0], [5, 7.3], [8, 7.7], [12, 8.4], [18, 9.0], [24, 9.4], [30, 9.0], [35, 8.7], [39, 9.2], [41.4, 10.2], [42.8, 11.5]];
const J_BOT: readonly (readonly [number, number])[] = [[-1.5, 12.2], [0, 14.4], [3, 16.6], [7, 17.8], [12, 17.8], [18, 17.0], [24, 16.0], [30, 14.8], [35, 13.8], [39, 12.9], [41.4, 12.4], [42.8, 11.5]];
const H_W: readonly (readonly [number, number])[] = [[-2.5, 12], [0, 14.5], [8, 15.6], [14, 14.6], [20, 13.2], [26, 11.4], [32, 9.6], [38, 7.8], [42, 6.0], [46, 3.6]];
const EYE_H: V2 = [24.5, -3.6];
const HINGE: V2 = [3.6, 8.6];
const NOSTRIL: V2 = [42.4, -0.6];

// the eye's colours
const EYE_C = {
  rim: hex('#15110b'), iris: hex('#352416'), irisL: hex('#55391b'), fleck: hex('#7d5c28'), pupil: hex('#060403'),
  shine: hex('#f6f1e0'), shine2: hex('#a49a80'), lid: hex('#21180f'),
  lidL: hex('#8f8766'), lidL2: hex('#766f53'), lidM: hex('#5e5842'),
};

// ================================================================== the painter
function adraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = ANCIENT_ANIMS[anim]?.frames ?? 1;
  const P = tpose(ANCIENT_ANIMS[anim] ? anim : 'idle', frame, n);
  const K = juv ? 0.4 : 1;
  sk.clipY = 0;
  const M = {
    skin: sk.m(rmp('#5a5337', { n: 7, dark: 0.66, light: 0.32, cool: 0.16, warm: 0.34, sat: 0.2 }), { edge: 2 }),
    skinD: sk.m(rmp('#3b3828', { n: 7, dark: 0.62, light: 0.26, cool: 0.16, warm: 0.3 }), { edge: 2 }),
    brick: sk.m(rmp('#674c35', { n: 7, dark: 0.6, light: 0.32, cool: 0.16, warm: 0.34, sat: 0.05 }), { edge: 2 }),
    limb: sk.m(rmp('#5c4f35', { n: 7, dark: 0.64, light: 0.32, cool: 0.16, warm: 0.34 }), { edge: 2 }),
    tub: sk.m(rmp('#6a684a', { n: 7, dark: 0.62, light: 0.32, cool: 0.16, warm: 0.36 }), { edge: 2 }),
    fleck: sk.m(rmp('#b9ad74', { n: 6, dark: 0.55, light: 0.36, warm: 0.3, cool: 0.2 }), { edge: 2 }),
    belly: sk.m(rmp('#a89f7c', { n: 7, dark: 0.6, light: 0.42, cool: 0.16, warm: 0.3 }), { edge: 2 }),
    throat: sk.m(rmp('#857e62', { n: 7, dark: 0.62, light: 0.44, cool: 0.16, warm: 0.3 }), { edge: 2 }),
    tailD: sk.m(rmp('#36302a', { n: 7, dark: 0.62, light: 0.38, cool: 0.16, warm: 0.3 }), { edge: 2 }),
    head: sk.m(rmp('#5a5338', { n: 7, dark: 0.66, light: 0.32, cool: 0.16, warm: 0.32, sat: 0.2 }), { edge: 2 }),
    headD: sk.m(rmp('#454030', { n: 7, dark: 0.64, light: 0.32, cool: 0.16, warm: 0.3 }), { edge: 2 }),
    snout: sk.m(rmp('#655c41', { n: 7, dark: 0.64, light: 0.32, cool: 0.16, warm: 0.36 }), { edge: 2 }),
    lip: sk.m(rmp('#8e8669', { n: 6, dark: 0.56, light: 0.4, cool: 0.16, warm: 0.25 }), { edge: 2 }),
    third: sk.m(rmp('#bdbb9c', { n: 5, dark: 0.5, light: 0.45 }), { edge: 1 }),
    crest: sk.m(rmp(P.pale > 0.5 ? '#f1ead6' : '#e0d5b4', { n: 6, dark: 0.5, light: 0.5, warm: 0.25, cool: 0.25 }), { edge: 1 }),
    crestB: sk.m(rmp('#8e8062', { n: 6, dark: 0.55, light: 0.4, warm: 0.3, cool: 0.3 }), { edge: 1 }),
    tcrest: sk.m(rmp('#6b5d44', { n: 6, dark: 0.6, light: 0.4, warm: 0.3, cool: 0.2 }), { edge: 1 }),
    claw: sk.m(rmp('#2e2721', { n: 6, dark: 0.5, light: 0.55, cool: 0.2, warm: 0.3 }), { edge: 1 }),
    clawW: sk.m(rmp('#9e8f6e', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    lichen: sk.m(rmp('#97a679', { n: 5, dark: 0.5, light: 0.38, warm: 0.2 }), { edge: 0 }),
    lichenO: sk.m(rmp('#c68a3f', { n: 5, dark: 0.5, light: 0.38, warm: 0.3 }), { edge: 0 }),
    moss: sk.m(rmp('#506336', { n: 5, dark: 0.5, light: 0.4, warm: 0.3 }), { edge: 0 }),
    scar: sk.m(rmp('#958c70', { n: 6, dark: 0.55, light: 0.32, cool: 0.16 }), { edge: 1 }),
    palate: sk.m(rmp('#76473f', { n: 6, dark: 0.62, light: 0.34, cool: 0.2 }), { edge: 1 }),
    gullet: sk.m(rmp('#40201d', { n: 4, dark: 0.5, light: 0.3 }), { edge: 0, noRim: true }),
    tongue: sk.m(rmp('#c48c80', { n: 6, dark: 0.55, light: 0.42, cool: 0.3 }), { edge: 1 }),
  };

  // ---------------------------------------------------------------- the skeleton
  const lift = P.lift - P.flat * 9.5;
  const hip: V2 = [(-36 + P.x * 0.35) * K, (-34 - lift) * K];
  const sh = rotP([(42 + P.x) * K, (-37 - lift + P.breathe * 0.3) * K], hip, -P.rear);
  const trunkA = Math.atan2(sh[1] - hip[1], sh[0] - hip[0]);
  const mid: V2 = [(hip[0] + sh[0]) / 2 + Math.sin(trunkA) * 2.2 * K, (hip[1] + sh[1]) / 2 - Math.cos(trunkA) * 2.2 * K];
  const NL = (26 + P.reach) * K;
  const neckA = trunkA - 0.1 - P.neck;
  const J: V2 = [sh[0] + Math.cos(neckA) * NL, sh[1] + Math.sin(neckA) * NL];
  const nC: V2 = [sh[0] + Math.cos(trunkA) * NL * 0.42, sh[1] + Math.sin(trunkA) * NL * 0.42];
  const neckEnd = Math.atan2(J[1] - nC[1], J[0] - nC[0]);
  const ha = neckEnd * 0.5 + P.head;
  const HS = 1.0 * K;
  const hc = Math.cos(ha), hs = Math.sin(ha);
  const hp = (x: number, y: number): V2 => [J[0] + (x * hc - y * hs) * HS, J[1] + (x * hs + y * hc) * HS];
  const jawA = P.jaw * 0.56;
  const jc = Math.cos(jawA), js = Math.sin(jawA);
  const jl = (x: number, y: number): V2 => { const dx = x - HINGE[0], dy = y - HINGE[1]; return [HINGE[0] + dx * jc - dy * js, HINGE[1] + dx * js + dy * jc]; };
  const jp = (x: number, y: number): V2 => { const q = jl(x, y); return hp(q[0], q[1]); };

  // the tail: a fixed length, sagging from the hips to lie along the ground, sweeping as it walks
  const TL = 140 * K;
  const tailPts: V2[] = [];
  {
    const sw = P.tail;
    const dense = cbez(hip, [hip[0] + Math.cos(trunkA + Math.PI - 0.24) * 34 * K, hip[1] + Math.sin(trunkA + Math.PI - 0.24) * 34 * K],
      [(-112 + sw * 5) * K, (-5 - Math.max(0, sw) * 1.5) * K], [(-190 + sw * 12) * K, (-1.6 - sw * 0.6) * K], 60);
    tailPts.push(dense[0]);
    let acc = 0, need = 4 * K, i = 1;
    let prev = dense[0];
    while (tailPts.length * 4 * K < TL + 0.01 && i < dense.length) {
      const q = dense[i], dl = Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      if (acc + dl >= need) {
        const f = (need - acc) / dl;
        const np: V2 = [prev[0] + (q[0] - prev[0]) * f, prev[1] + (q[1] - prev[1]) * f];
        tailPts.push(np); prev = np; acc = 0; need = 4 * K;
      } else { acc += dl; prev = q; i++; }
    }
    while (tailPts.length * 4 * K < TL) {
      const a = tailPts[tailPts.length - 2], b = tailPts[tailPts.length - 1];
      tailPts.push([b[0] + (b[0] - a[0]), b[1] + (b[1] - a[1])]);
    }
    tailPts.reverse();
  }
  const trunkPts = qbez(hip, mid, sh, 14);
  const neckPts = qbez(sh, nC, J, 8);
  const ext: V2 = [J[0] + Math.cos(neckEnd) * 7 * K, J[1] + Math.sin(neckEnd) * 7 * K];
  const sp: V2[] = [...tailPts, ...trunkPts.slice(1), ...neckPts.slice(1), ext];
  const NS = sp.length;
  const cum = new Float32Array(NS);
  for (let i = 1; i < NS; i++) cum[i] = cum[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
  const sHip = cum[tailPts.length - 1], sSh = cum[tailPts.length - 1 + trunkPts.length - 1], sJ = cum[NS - 2], sEnd = cum[NS - 1];
  const LT = sSh - sHip; // trunk length
  const LN = sJ - sSh;

  // the cross-section profile along the spine (px from the vertebral line: top up, bot down; W half-width)
  const TAILK = { top: [[0, 1.2], [0.3, 3.0], [0.6, 5.2], [0.85, 7.2], [1, 8.2]], bot: [[0, 1.3], [0.3, 3.4], [0.6, 6.8], [0.85, 11.4], [1, 16.5]], W: [[0, 1.3], [0.3, 3.6], [0.6, 6.6], [0.85, 10.2], [1, 14.5]] } as const;
  const br = P.breathe;
  const TRUNKK = {
    top: [[0, 8.6], [0.14, 7.6], [0.5, 8.4], [0.86, 9.2], [1, 9.2]],
    bot: [[0, 17], [0.12, 20.5], [0.34, 26], [0.56, 28 + br * 0.6], [0.78, 26.4], [0.92, 24], [1, 22.5]],
    W: [[0, 15], [0.3, 22], [0.56, 24.5 + br * 0.5], [0.85, 22], [1, 19.5]],
  } as const;
  const th = P.throat;
  const NECKK = { top: [[0, 9.2], [0.5, 8.0], [1, 8.4]], bot: [[0, 22.5 + th * 1.5], [0.35, 17.5 + th * 3], [0.7, 15.2 + th * 3.6], [1, 14.6 + th * 3.6]], W: [[0, 19.5], [0.5, 16.2], [1, 14.6]] } as const;
  const NP = Math.ceil(sEnd) + 2;
  const pTop = new Float32Array(NP), pBot = new Float32Array(NP), pW = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    const s = i;
    let keys: { top: readonly (readonly [number, number])[]; bot: readonly (readonly [number, number])[]; W: readonly (readonly [number, number])[] }, u: number;
    if (s < sHip) { keys = TAILK; u = s / sHip; } else if (s < sSh) { keys = TRUNKK; u = (s - sHip) / LT; } else { keys = NECKK; u = (s - sSh) / LN; }
    pTop[i] = crv(keys.top, u) * K; pBot[i] = crv(keys.bot, u) * K; pW[i] = crv(keys.W, u) * K;
  }
  const prof = (s: number, a: Float32Array) => { const i = Math.max(0, Math.min(NP - 2, Math.floor(s))), f = s - i; return a[i] + (a[i + 1] - a[i]) * cl(f); };
  /** a point on the spine at arc length s: position, tangent (toward the head) and ventral normal */
  const at = (s: number): { p: V2; tx: number; ty: number } => {
    let i = 1;
    while (i < NS - 1 && cum[i] < s) i++;
    const a = sp[i - 1], b = sp[i], d = cum[i] - cum[i - 1] || 1e-6, f = cl((s - cum[i - 1]) / d);
    const tx = (b[0] - a[0]) / d, ty = (b[1] - a[1]) / d;
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], tx, ty };
  };
  /** a point at spine station s, offset d (+ ventral) */
  const bodyPt = (s: number, d: number): V2 => { const q = at(s); return [q.p[0] - q.ty * d, q.p[1] + q.tx * d]; };

  // ---------------------------------------------------------------- the limbs
  const bodyZ = (s: number, d: number) => {
    const top = prof(s, pTop), bot = prof(s, pBot), W = prof(s, pW);
    const c = (bot - top) / 2, hg = (bot + top) / 2, v = (d - c) / hg;
    return W * se(Math.abs(v), v < 0 ? 2.1 : 2.7);
  };
  const scaleTex = (seed: number, sx: number, sy: number, amp: number, flecks: number) => (al: number, ac: number, _t: number, o: Tx) => {
    cell(al, ac, sx, sy, seed);
    o.z = (scaleH(2.4) - 0.45) * amp;
    if (F2 - F1 < 0.12) o.t = -0.12;
    else if (F1 < 0.42 && (al - CX) + (ac - CY) * 0.6 < -0.5 * K) o.t = 0.07;
    o.m = CI < flecks ? M.fleck : CI > 0.88 ? M.brick : M.limb;
  };
  const toeTex = (seed: number) => (al: number, _ac: number, _t: number, o: Tx) => {
    const f = fr(al / (1.8 * K) + hash2(seed, 1, 3));
    o.z = f < 0.28 ? -0.55 : 0.15 * Math.sin(f * Math.PI);
    o.m = M.limb;
    o.t = f < 0.28 ? -0.06 : 0.02;
  };
  const clawTex = (worn: boolean) => (_al: number, ac: number, t: number, o: Tx) => {
    o.m = worn && t > 0.72 ? M.clawW : M.claw;
    o.t = ac < 0 ? 0.08 : -0.02;
  };

  interface Limb { fore: boolean; near: boolean }
  const drawLimb = ({ fore, near }: Limb) => {
    const zs = near ? 1 : -1;
    const sAt = fore ? sSh - 2 * K : sHip + 3 * K;
    const dIn = (fore ? 13 : 11) * K;
    let root = bodyPt(sAt, dIn);
    const Wr = prof(sAt, pW);
    // the girdles swing as it walks: the near shoulder forward as the near fore reaches
    const sway = (fore ? 1 : -1) * (near ? 1 : -1) * P.sway * 2.6 * K;
    root = [root[0] + sway, root[1]];
    const zr = zs * Wr * 0.5 + (near ? 3 * K : 0);
    const fi = fore ? (near ? 0 : 1) : (near ? 2 : 3);
    const off = P.feet[fi];
    const lifted = Math.max(0, -off[1]) / (6 * K);
    const restX = fore ? (near ? 4 : -1) : (near ? 7 : 3);
    const footY = (fore ? -4.6 : -4.4) * K;
    const foot: V2 = [root[0] - sway + (restX + off[0]) * K, footY + off[1] * K];
    const er = P.erect;
    const l1 = (fore ? 15 + er * 2.4 : 15 + er * 2.2) * K, l2 = (fore ? 12.5 + er * 2.5 : 13.5 + er * 1.5) * K;
    const [j, w] = ik2(root, foot, l1, l2, fore ? 1 : -1);
    const out = (fore ? 11 : 12) * K * (1 - er * 0.35) + P.flat * 3 * K;
    const zj = zr + zs * out, zw = zr + zs * out * 0.78;
    const bias = near ? 0 : -0.15;
    const R = 26 * K;
    const L = new Lay(sk, Math.min(root[0], w[0], j[0]) - R, Math.min(root[1], j[1]) - R, Math.max(root[0], w[0], j[0]) + R, 2);
    // the upper arm / thigh: out and down from the girdle, the big muscle mass at the root
    const sc1 = scaleTex(fore ? 301 : 311, 3.1 * K, 2.7 * K, 0.9 * K, 0.06);
    if (fore) bone(L, root, zr, j, zj, 5.4 * K, 3.9 * K, 1.5 * K, 0.36, 1, 0, sc1);
    else bone(L, root, zr, j, zj, 6.6 * K, 4.3 * K, 2.0 * K, 0.36, 1, 0, sc1);
    // the forearm / shin: muscled at the top, slender at the wrist / ankle (imbricate scales)
    const sc2 = scaleTex(fore ? 303 : 313, 2.7 * K, 2.2 * K, 0.8 * K, 0.05);
    if (fore) bone(L, j, zj, w, zw, 4.0 * K, 2.5 * K, 1.2 * K, 0.28, 2, 1.8 * K, sc2);
    else bone(L, j, zj, w, zw, 4.4 * K, 2.7 * K, 1.4 * K, 0.28, 2, 1.8 * K, sc2);
    // the point of the elbow (behind) or the knee (in front)
    {
      const dir = Math.atan2(w[1] - j[1], w[0] - j[0]);
      const bx = j[0] + Math.cos(dir + (fore ? Math.PI * 0.62 : -Math.PI * 0.6)) * 2.6 * K, by = j[1] + Math.sin(dir + (fore ? Math.PI * 0.62 : -Math.PI * 0.6)) * 2.6 * K;
      bone(L, [bx, by], zj + zs * 1.2 * K, [bx, by], zj, 2.8 * K, 2.8 * K, 0, 0.5, 2, 1.6 * K, sc2);
    }
    // the hand / foot: a broad palm, five separate splayed toes arching from it to the ground, each
    // banded with scales and ending in a long curved claw
    const sole: V2 = [w[0] + (fore ? 2.4 : 3.8) * K, Math.min(w[1] + 2.0 * K, -2.6 * K) - lifted * 1.2 * K];
    const soleR = (fore ? 3.6 : 5.0) * K;
    bone(L, w, zw, sole, zw + zs * 1 * K, 3.3 * K, 2.6 * K, 0.5 * K, 0.5, 3, 1.6 * K, scaleTex(321, 2.3 * K, 2 * K, 0.6 * K, 0.04));
    bone(L, [sole[0] - soleR * 0.5, sole[1]], zw + zs * 1.2 * K, [sole[0] + soleR * 0.4, sole[1] + 0.2 * K], zw + zs * 1.6 * K, 2.3 * K, 2.0 * K, 0, 0.5, 3, 1.5 * K, scaleTex(323, 2.2 * K, 2 * K, 0.5 * K, 0.04), 0.7);
    // toes: yaw on the ground plane (0 forward, + toward the near side), length
    const toes: [number, number][] = fore ? [[-0.65, 6.2], [-0.25, 8.2], [0.12, 9.4], [0.55, 8.8], [2.2, 6.2]] : [[-0.45, 6.4], [-0.16, 8.8], [0.08, 10.8], [0.36, 12.4], [2.0, 7.4]];
    // draw from the far side to the near side so nearer toes overlap
    const order = near ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
    for (const ti of order) {
      const [yaw, len0] = toes[ti];
      const len = len0 * K;
      const ca = Math.cos(yaw), sa = Math.sin(yaw) * zs;
      // a toe pointing at the viewer is foreshortened, but still shows a stub
      const px = (Math.abs(ca) < 0.35 ? Math.sign(ca || 1) * 0.35 : ca) * len;
      const bx = sole[0] + Math.sign(px) * soleR * 0.45, bz = zw + zs * 1.2 * K + sa * soleR * 0.5;
      const by = sole[1] - 0.6 * K;
      // the knuckles arch up, the longer toes higher; the tip comes down to the ground; lifted feet hang
      const droop = lifted * 3.2 * K;
      const arch = (0.5 + len0 * 0.08) * K;
      const m1: V2 = [bx + px * 0.42, by - arch + droop * 0.3];
      const tip: V2 = [bx + px * 0.86, Math.min(-1.1 * K, -1.2 * K + droop)];
      const zm = bz + sa * len * 0.42, zt = bz + sa * len * 0.86;
      const tid = 4 + ti;
      const r0 = (fore ? 1.45 : 1.55) * K;
      bone(L, [bx, by], bz, m1, zm, r0, r0 * 0.85, 0.2 * K, 0.5, tid, 0.5 * K, toeTex(ti * 7 + (fore ? 1 : 2)));
      bone(L, m1, zm, tip, zt, r0 * 0.85, r0 * 0.68, 0.15 * K, 0.5, tid, 0.5 * K, toeTex(ti * 7 + (fore ? 3 : 4)));
      // the claw: long, dark, curved down into the ground; some are worn blunt
      const worn = hash2(ti, fore ? 5 : 6, near ? 9 : 8) < 0.35;
      const cL = (worn ? 2.8 : 4.0) * K * (ti === 4 ? 0.8 : 1);
      const dirx = px >= 0 ? 1 : -1;
      const c1: V2 = [tip[0] + dirx * cL * 0.6, tip[1] - 0.1 * K + lifted * 0.8 * K];
      const c2: V2 = [c1[0] + dirx * cL * 0.35, Math.min(-0.4 * K, c1[1] + cL * 0.38 + lifted * 1.2 * K)];
      bone(L, tip, zt + zs * 0.3 * K, c1, zt + zs * 0.5 * K, 0.95 * K, 0.7 * K, 0, 0.5, 9 + ti, 0, clawTex(worn));
      bone(L, c1, zt + zs * 0.5 * K, c2, zt + zs * 0.6 * K, 0.7 * K, 0.35 * K, 0, 0.5, 9 + ti, 0.3 * K, clawTex(worn));
    }
    L.emit(bias - 0.03, 2.2 * K, 1.2 * K, 0.34, 0.88, 0.07, 2);
    return { root, j, w };
  };

  // far limbs first (behind the body)
  sk.np(); drawLimb({ fore: false, near: false });
  sk.np(); drawLimb({ fore: true, near: false });

  // ---------------------------------------------------------------- the crest
  {
    const spines: { s: number; h: number; tail: boolean; chip: number; seed: number }[] = [];
    // the tail's sawtooth row (small, dark), a notch where one is missing
    for (let S = -4 * K, i = 0; S > -102 * K; S -= 3.1 * K, i++) {
      if (i === 17) continue;
      const u = -S / (102 * K);
      spines.push({ s: sHip + S, h: (5.2 - u * 3.2) * K, tail: true, chip: 0, seed: 500 + i });
    }
    // the dorsal crest, the hips up to the shoulders: growing toward the front; one broken short
    for (let S = 5 * K, i = 0; S < LT - 6 * K; S += 4.9 * K, i++) {
      const u = S / LT;
      spines.push({ s: sHip + S, h: (5.5 + 6.5 * Math.pow(u, 1.1)) * K, tail: false, chip: i === 7 ? 0.45 : 0, seed: 600 + i });
    }
    // (a gap over the shoulders) then the nuchal crest up the neck, tallest at its base
    for (let S = 4 * K, i = 0; S < LN - 2.5 * K; S += 4.6 * K, i++) {
      const u = S / LN;
      spines.push({ s: sSh + S, h: (15 - 3.5 * u) * K, tail: false, chip: i === 3 ? 0.6 : 0, seed: 700 + i });
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const geo = spines.map(q => {
      const a = at(q.s);
      const top = prof(q.s, pTop);
      const B: V2 = [a.p[0] + a.ty * (top - 1.4 * K), a.p[1] - a.tx * (top - 1.4 * K)];
      const up: V2 = [a.ty, -a.tx];
      const hs = q.tail ? 1 : 0.55 + 0.45 * P.crest;
      const lean = (q.tail ? 0.7 : 0.62 - (P.crest - 0.55) * 0.56) + (hash2(q.seed, 1, 5) - 0.5) * 0.1;
      // lean back: rotate "up" toward the tail
      const cs = Math.cos(lean), sn = Math.sin(lean);
      const ax = up[0] * cs - a.tx * sn, ay = up[1] * cs - a.ty * sn;
      const h = (q.h * hs + 1.4 * K) * (0.86 + hash2(q.seed, 2, 5) * 0.26);
      x0 = Math.min(x0, B[0] - h); x1 = Math.max(x1, B[0] + h); y0 = Math.min(y0, B[1] - h); y1 = Math.max(y1, B[1] + h);
      return { ...q, B, ax, ay, h, bw: (q.tail ? 2.0 : 0.8 + q.h * 0.21 / K) * K };
    });
    sk.np();
    const L = new Lay(sk, x0, y0, x1, y1);
    geo.forEach((g, gi) => {
      // across the spine: x > 0 toward the head (the leading edge), x < 0 the trailing edge
      const fx = -g.ay, fy = g.ax;
      const R = g.h + g.bw + 1;
      const [i0, i1] = L.cols(g.B[0] - R, g.B[0] + R), [j0, j1] = L.rows(g.B[1] - R, g.B[1] + R);
      const chipH = g.chip ? 1 - g.chip : 1;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const rx = L.lx(i) - g.B[0], ry = L.ly(j) - g.B[1];
          const u = (rx * g.ax + ry * g.ay) / g.h;
          if (u < 0 || u > 1) continue;
          // the tip curls back; the leading edge bows out, the trailing edge is hollow
          const x = rx * fx + ry * fy + g.h * 0.16 * u * u;
          const hwF = g.bw * Math.pow(1 - u, 0.72), hwB = g.bw * Math.pow(1 - u, 1.25);
          if (x > hwF || -x > hwB) continue;
          // the chipped spine: snapped off with a ragged top
          if (u > chipH - hash2(i, 3, g.seed) * 0.08) continue;
          let m: number, t = 0;
          if (g.tail) { m = M.tcrest; t = -0.06 + u * 0.2; } else {
            const baseU = 0.2 + hash2(i, j, g.seed) * 0.1;
            m = u < baseU ? M.crestB : M.crest;
            t = -0.1 + u * 0.22;
          }
          // a soft fold down the middle: the trailing half catches the light from behind
          if (x < -0.3 * K) t += 0.05; else if (x > 0.4 * K) t -= 0.05;
          if (Math.abs(x) <= 0.5 * K && u > 0.15 && u < 0.85) t += 0.04;
          L.put(j * L.w + i, 0.6 * K + gi * 0.004 * K, m, t, (gi % 250) + 1, 0);
        }
    });
    L.emit(0, 1.6 * K, 0.002 * K, 0.4);
  }

  // ---------------------------------------------------------------- the body: tail, trunk and neck as one sculpted mass
  const head0 = hp(0, 0);
  // the throat's sag under the jaw (head frame, following the jaw), stacked with folds
  const gC = jl(8, 14.4 + th * 2.2);
  const gRx = 13 + th * 5, gRy = 3.4 + th * 4.6;
  {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of sp) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const gp = hp(gC[0], gC[1]);
    x0 -= 30 * K; y0 -= 30 * K; x1 = Math.max(x1, gp[0] + 20 * K) + 30 * K; y1 = Math.max(y1, gp[1] + 18 * K) + 30 * K;
    sk.np();
    const L = new Lay(sk, x0, y0, x1, y1);
    // segment tables
    const ax = new Float32Array(NS), ay = new Float32Array(NS), dxs = new Float32Array(NS), dys = new Float32Array(NS), l2s = new Float32Array(NS);
    for (let i = 1; i < NS; i++) { ax[i] = sp[i - 1][0]; ay[i] = sp[i - 1][1]; dxs[i] = sp[i][0] - sp[i - 1][0]; dys[i] = sp[i][1] - sp[i - 1][1]; l2s[i] = dxs[i] * dxs[i] + dys[i] * dys[i]; }
    const o: Tx = { z: 0, m: 0, t: 0 };
    // per column, the spine segments close enough to matter
    let Rmax = 0;
    for (let i = 0; i < NP; i++) Rmax = Math.max(Rmax, pBot[i], pTop[i], pW[i]);
    Rmax += 2;
    const segX0 = new Float32Array(NS), segX1 = new Float32Array(NS), segY0 = new Float32Array(NS), segY1 = new Float32Array(NS);
    for (let q = 1; q < NS; q++) {
      segX0[q] = Math.min(sp[q - 1][0], sp[q][0]) - Rmax; segX1[q] = Math.max(sp[q - 1][0], sp[q][0]) + Rmax;
      segY0[q] = Math.min(sp[q - 1][1], sp[q][1]) - Rmax; segY1[q] = Math.max(sp[q - 1][1], sp[q][1]) + Rmax;
    }
    const cand = new Int32Array(NS);
    for (let i = 0; i < L.w; i++) {
      const px = L.lx(i);
      let nc = 0;
      for (let q = 1; q < NS; q++) if (px >= segX0[q] && px <= segX1[q]) cand[nc++] = q;
      for (let j = 0; j < L.h; j++) {
        const py = L.ly(j);
        if (py > 0.5) continue;
        // nearest point on the spine
        let best = 1e18, bs = 0, bd = 0, bo = 0;
        for (let c = 0; c < nc; c++) {
          const q = cand[c];
          if (py < segY0[q] || py > segY1[q]) continue;
          const rx = px - ax[q], ry = py - ay[q];
          let k = (rx * dxs[q] + ry * dys[q]) / l2s[q];
          let over = 0;
          if (k < 0) { over = k; k = 0; } else if (k > 1) { over = k - 1; k = 1; }
          const ex = rx - dxs[q] * k, ey = ry - dys[q] * k;
          const d2 = ex * ex + ey * ey;
          if (d2 < best) {
            best = d2;
            const ll = Math.sqrt(l2s[q]);
            bs = cum[q - 1] + k * ll;
            bd = (ex * -dys[q] + ey * dxs[q]) / ll;
            bo = (q === 1 && over < 0) || (q === NS - 1 && over > 0) ? over * ll : 0;
          }
        }
        let z = EMPTY;
        let S = 0, v = 0, hg = 1, W = 1;
        if (best < 1e17 && (bo === 0 || Math.abs(bo) < prof(bs, pW))) {
          const top = prof(bs, pTop), bot = prof(bs, pBot);
          W = prof(bs, pW);
          const c = (bot - top) / 2;
          hg = (bot + top) / 2;
          v = (bd - c) / hg;
          let av = Math.abs(v);
          if (bo !== 0) av = Math.hypot(av, bo / hg);
          if (av < 1) { z = W * se(av, v < 0 ? 2.1 : 2.7); S = bs - sHip; }
        }
        // the throat sag (head frame)
        let zg = EMPTY, gu = 0, gv = 0;
        {
          const rx = px - head0[0], ry = py - head0[1];
          const hx = (rx * hc + ry * hs) / HS, hy = (-rx * hs + ry * hc) / HS;
          gu = (hx - gC[0]) / gRx; gv = (hy - gC[1]) / gRy;
          const g2 = gu * gu + gv * gv;
          if (g2 < 1 && hx > -8) zg = 12 * K * Math.sqrt(1 - g2) * (0.7 + 0.3 * cl(1 - gu));
        }
        if (z === EMPTY && zg === EMPTY) continue;
        o.z = 0; o.m = M.skin; o.t = 0;
        let id = 1;
        if (z !== EMPTY) {
          bodyTex(S, bd, v, hg, o);
          z += o.z * Math.min(1, (1 - Math.abs(v)) * 6);
        }
        if (zg !== EMPTY && zg > z - 3 * K) {
          // stacked transverse folds across the throat, crowded at the jaw, wrinkled between
          const rx = px - head0[0], ry = py - head0[1];
          const hx = (rx * hc + ry * hs) / HS, hy = (-rx * hs + ry * hc) / HS;
          const ph = (hx + 0.05 * (hy - gC[1]) * (hy - gC[1]) + Math.sin(hy * 0.7) * 0.6) / (2.5 + th * 0.9);
          const ff = fr(ph);
          const fold = 0.9 * Math.sin(ff * Math.PI) - 1.2 * gs(ff - 0.04, 0.07);
          let zz = zg + fold * K * (1 - th * 0.45);
          if (z !== EMPTY) zz = smax(z, zz, 3 * K);
          const gm = gv > 0.25 ? M.belly : M.throat;
          cell(hx * 1.3, hy * 1.3, 2.2, 2.2, 91);
          const fl = CI < 0.04 && gv < 0.3;
          if (zz > z) { o.m = fl ? M.fleck : gm; o.t = ff < 0.12 ? -0.08 : 0; id = 2; }
          z = Math.max(z === EMPTY ? zz : z, zz);
        }
        L.put(j * L.w + i, z, o.m, o.t, id, 0);
      }
    }
    L.emit(-0.02, 2.4 * K, 99, 0.34, 0.8, 0.07, 3);
  }

  /** the body skin: bone and muscle under it, folds, granules, tubercles, plates, rings, colour */
  function bodyTex(S: number, D: number, v: number, hg: number, o: Tx) {
    let disp = 0, m = M.skin, t = 0;
    const reg = S < 0 ? 0 : S < LT ? 1 : 2;
    const k1 = K;
    // the big forms: shoulder blade, hip bone, the muscles round the limb roots, the ribs
    disp += 2.6 * k1 * gs(S - (LT - 6 * k1), 7 * k1) * gs(v + 0.42, 0.26);
    disp += 2.0 * k1 * gs(S - 3 * k1, 6 * k1) * gs(v + 0.5, 0.24);
    disp += 3.2 * k1 * gs(S - (LT - 1 * k1), 7 * k1) * gs(v - 0.22, 0.3);
    disp += 3.2 * k1 * gs(S - 4 * k1, 8 * k1) * gs(v - 0.12, 0.34);
    if (reg === 1) {
      const rib = ss(12 * k1, 22 * k1, S) * (1 - ss(LT - 24 * k1, LT - 12 * k1, S)) * gs(v + 0.08, 0.3);
      disp += 0.25 * k1 * Math.sin((S / k1) * TAU / 6.4) * rib;
      // the lateral fold, armpit to groin
      const lf = ss(12 * k1, 22 * k1, S) * (1 - ss(LT - 18 * k1, LT - 8 * k1, S));
      disp += lf * k1 * (0.9 * gs(v - 0.34, 0.06) - 1.2 * gs(v - 0.44, 0.035));
      if (lf > 0.3 && Math.abs(v - 0.44) < 0.03) t -= 0.04;
      // skin creases at the armpit and the groin, curving round the limb roots
      for (const [sc, dir] of [[LT - 6 * k1, -1], [9 * k1, 1]] as const) {
        const r = Math.hypot((S - sc) / k1, (D - hg * 0.62) / k1 * 1.2);
        if (r > 5 && r < 15 && (S - sc) * dir > 0 && v > 0.05) {
          const g = fr(r / 3.1);
          if (g < 0.2) { disp -= 0.9 * k1; t -= 0.05; }
        }
      }
    }
    // the neck: transverse folds (deepest on the lower neck), and the long fold down its side
    const nf = ss(LT - 6 * k1, LT + 3 * k1, S);
    if (nf > 0) {
      const ph = (S / k1 - LT / k1 + 0.9 * Math.sin(D * 0.3 / k1 + S * 0.1 / k1)) / 3.9;
      const g = fr(ph);
      const fold = (0.7 * Math.sin(g * Math.PI) - 1.5 * gs(g - 0.05, 0.07)) * (0.25 + 0.75 * ss(-0.5, 0.5, v));
      disp += fold * nf * k1;
      disp += nf * k1 * (0.7 * gs(v - 0.05, 0.06) - 0.8 * gs(v - 0.14, 0.04));
      if (g < 0.1 && v > -0.3) { t -= 0.06 * nf; if (noise2(S / 5, D / 4, 61) > 0.7 && v > 0.05) m = M.moss; }
    }
    // tubercles in staggered rows along the flank and back, each a little dome
    let isTub = false;
    if (v < 0.48 && v > -0.95) {
      const rowH = 5.2 * k1, row = Math.floor((D + 60 * k1) / rowH);
      cell(S + (row & 1) * 3.6 * k1, D, 7.2 * k1, rowH, 21, 0.5);
      const rr = 0.25 + CI * 0.1;
      if (CI < (reg === 0 ? 0.25 : 0.6) && F1 < rr) {
        disp += 0.8 * k1 * (1 - (F1 / rr) * (F1 / rr)); isTub = true;
        // each tubercle lit on its upper back side, shadowed below
        const lx = (S - CX) / k1, ly = (D - CY) / k1, side = -lx * 0.55 + ly * 0.85;
        t += side < -0.35 ? 0.16 : side > 0.55 ? -0.15 : 0.02;
      }
    }
    // a fine network of granular scales over the back and upper flank
    if (!isTub && v < 0.1 && reg >= 1) {
      cell(S, D, 2.7 * k1, 2.4 * k1, 17);
      if (F2 - F1 < 0.1) t -= 0.06 * (1 - cl((v + 0.2) * 3));
    }
    // pale yellow speckles, one or two pixels each, thick on the flanks and thinning onto the back
    let speck = false;
    if (!isTub && v < 0.55) { cell(S, D, 5.0 * k1, 4.4 * k1, 13, 0.9); speck = CI < 0.36 - (v < -0.5 ? 0.18 : 0) && F1 < 0.23; }
    // colour: olive above, warmer brick-brown low on the flanks, a few dark blotches along the back
    // the warm lower flank breaks up into blotches along its edge, never a clean stripe
    const edge = 0.16 + 0.12 * Math.sin(S / (9 * k1)) + (noise2(S / (5 * k1), D / (6 * k1), 39) - 0.5) * 0.5;
    if (v > edge && !(reg === 2 && v < 0.55)) m = M.brick;
    // dark saddles across the back, tapering down the flank, their edges ragged
    if (reg >= 1 && v < 0.15) {
      const wob = (noise2(S / (5 * k1), D / (5 * k1), 37) - 0.5) * 5 * k1;
      const ph = fr((S + wob - 2 * k1) / (15 * k1));
      if (ph < 0.46 * (1 - (v + 1) / 1.35) && S > 6 * k1 && S < LT + 18 * k1) m = M.skinD;
    }
    if (reg === 0) {
      // the tail: rings of rectangular scales, broad darker bands
      const ring = S / (3.5 * k1);
      const fg = fr(ring);
      if (fg < 0.22) { disp -= 0.5 * k1; t -= 0.05; }
      const across = D / Math.max(1.7 * k1, hg * 0.4) + (Math.floor(ring) & 1) * 0.5;
      if (fr(across) < 0.15) { disp -= 0.3 * k1; t -= 0.03; }
      const band = fr(-S / (15 * k1) + 0.1 + (noise2(D / (5 * k1), S / (30 * k1), 49) - 0.5) * 0.12);
      m = band < 0.44 + cl(-S / (140 * k1)) * 0.1 ? M.tailD : v > edge + 0.1 ? M.brick : M.skin;
    }
    if (v > 0.6) {
      // the ventral plates in transverse rows
      m = M.belly;
      const row = S / (4.3 * k1), fs = fr(row);
      disp = fs < 0.2 ? -0.7 * k1 : 0.25 * k1 * Math.sin(fs * Math.PI);
      const across = (v - 0.6) * hg / (2.7 * k1) + (Math.floor(row) & 1) * 0.5;
      if (fr(across) < 0.22) disp -= 0.45 * k1;
      if (fs < 0.2) t -= 0.05;
    }
    if (isTub) { m = m === M.skinD || m === M.tailD ? M.skin : m === M.brick ? M.brick : M.tub; t += 0.02; }
    else if (speck) m = M.fleck;
    // the light comes from above: the flank darkens toward the belly
    t -= 0.12 * v;
    // the old back: crusts of lichen, pale green with orange, tucked in along the crest's base where
    // it does not reach to rub, and in the deep folds of the neck
    if (reg >= 1 && v < -0.68) {
      const ln = noise2(S / (3.4 * k1), D / (2.6 * k1), 41) * 0.6 + noise2(S / (1.5 * k1), D / (1.5 * k1), 43) * 0.4;
      const zone = noise2(S / (12 * k1), 3.1, 45);
      if (ln > 0.62 && zone > 0.5) { m = hash2(Math.floor(S / 2), Math.floor(D / 2), 47) < 0.22 ? M.lichenO : M.lichen; disp += 0.2 * k1; }
    }
    // an old rake across the flank: three healed lines, raised and pale
    if (reg === 1 && v > -0.6 && v < 0.45) {
      const q = (S / k1) * 0.6 + D / k1;
      for (let i = 0; i < 3; i++) {
        const c0 = 26 + i * 4.4;
        const sMin = LT * 0.3 + i * 2.5 * k1, sMax = LT * 0.6 + i * 2.5 * k1;
        if (Math.abs(q + Math.sin(S / k1 * 0.7 + i) * 0.5 - c0) < 0.6 && S > sMin && S < sMax) { m = M.scar; disp = 0.3 * k1; t = -0.02; }
      }
    }
    o.z = disp; o.m = m; o.t = t;
  }

  // ---------------------------------------------------------------- the head
  drawHead();
  function drawHead() {
    // bounding box
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[-4, -15], [48, -15], [48, 13], [-4, 20], [48, 30], [-4, 30]] as const) {
      for (const q of [hp(x, y), jp(x, y)]) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    }
    /** the whole head's lofted cross-section (skull and jaw together): sets ZV (-1 top .. 1 under) and returns depth */
    let ZV = 0;
    const zHead = (hx: number, hy: number) => {
      const top = crv(H_TOP, hx), bot = Math.max(crv(J_BOT, Math.max(-1.5, Math.min(42.8, hx))), crv(H_BOT, hx) + 0.5);
      const mid = (top + bot) / 2, half = Math.max(1, (bot - top) / 2);
      ZV = (hy - mid) / half;
      return crv(H_W, hx) * se(Math.min(1, Math.abs(ZV)), 2.7);
    };
    // sculpted detail common to the skull (head units)
    const sculpt = (hx: number, hy: number) => {
      let d = 0;
      // the jaw-closing muscles bulging behind the eye
      { const u = (hx - 10.5) / 8.5, w = (hy + 1) / 7.2, r = u * u + w * w; if (r < 1) d += 4.6 * Math.pow(Math.cos(Math.sqrt(r) * Math.PI / 2), 2); }
      // the eye socket and the heavy brow over it, the lower lid's fold
      const ex = hx - EYE_H[0], ey = hy - EYE_H[1];
      const de = Math.hypot(ex, ey * 1.08);
      if (de < 6.4) d -= 2.4 * Math.pow(Math.cos((de / 6.4) * Math.PI / 2), 2);
      {
        const rb = Math.hypot(ex * 0.92, ey + 1.8);
        const ang = Math.atan2(ey + 1.8, ex * 0.92);
        if (ang < -0.12 && ang > -Math.PI + 0.2) d += (3.0 + (ang < -Math.PI / 2 ? 0.6 : 0)) * gs(rb - 6.6, 1.2);
        if (ang > 0.25 && ang < Math.PI - 0.3) d += 0.8 * gs(de - 5.1, 0.6);
      }
      // the ridge from the brow down the snout to the nostril (canthus), the nostril's mound
      {
        const t = cl((hx - 29) / 13), cy = -8.4 + t * 7.4;
        if (hx > 28 && hx < 42.5) d += 0.8 * gs(hy - cy, 1.0);
        const dn = Math.hypot(hx - NOSTRIL[0], hy - NOSTRIL[1]);
        if (dn < 2.4) d += 1.1 * Math.cos((dn / 2.4) * Math.PI / 2);
      }
      return d;
    };
    const o: Tx = { z: 0, m: 0, t: 0 };
    // texture of the upper head
    /** plate edges: a faint groove where two plates meet (from the last cell()) */
    const plate = (w: number) => (F2 - F1 < w ? 1 : 0);
    const speckAt = (x: number, y: number) => { cell(x, y, 3.6, 3.2, 79, 0.9); return CI < 0.3 && F1 < 0.2; };
    const upperTex = (hx: number, hy: number, v: number) => {
      let disp = 0, m = M.head, t = 0;
      const mouth = crv(H_BOT, hx);
      const dl = mouth - hy;
      const de = Math.hypot(hx - EYE_H[0], (hy - EYE_H[1]) * 1.08);
      if (dl < 2.9 && hx > 6.5) {
        // the upper labials: a row of big scales along the lip, paler than the head, the front ones larger
        const sw = hx > 30 ? 3.7 : 3.2;
        const f = fr((hx - 6.5) / sw + (hx > 30 ? 0.3 : 0));
        const gap = f * sw < 0.8;
        disp += 0.7 * Math.sin(f * Math.PI) - (gap ? 0.6 : 0);
        m = hash2(Math.floor((hx - 6.5) / sw), 3, 81) < 0.2 ? M.snout : M.lip;
        if (gap) { t -= 0.12; m = M.snout; }
        if (dl > 2.3) { disp -= 0.6; t -= 0.1; m = M.snout; }
        // a nick in one old lip scale
        if (hx > 19.5 && hx < 21 && dl < 1.4) m = M.scar;
      } else if (hx > 29) {
        // big polygonal plates on the snout
        cell(hx, hy, 3.3, 2.8, 85);
        if (plate(0.12)) { disp -= 0.35; t -= 0.05; }
        m = M.snout;
      } else if (de > 5.0 && de < 9.6 && hy < EYE_H[1] - 1.5) {
        // the supraocular plates over the brow
        cell(hx, hy, 3.6, 2.6, 87);
        if (plate(0.12)) { disp -= 0.35; t -= 0.05; }
      } else if (v < -0.6) {
        // the crown: small plates, darker
        cell(hx, hy, 2.8, 2.4, 89);
        if (plate(0.12)) { disp -= 0.3; t -= 0.04; }
        m = M.headD;
      } else if (de >= 5.0) {
        // the cheek and temple: a scatter of tubercles
        cell(hx + 30, hy, 4.6, 4.0, 95, 0.7);
        if (CI < 0.5 && F1 < 0.27) { disp += 1.0 * (1 - (F1 / 0.27) ** 2); m = M.snout; }
      }
      if (m !== M.lip && m !== M.scar && de > 5 && speckAt(hx, hy)) m = M.fleck;
      // the upper lid's crease under the brow, and the crease round the jaw muscle's lower edge
      if (de > 4.3 && de < 5.4 && hy < EYE_H[1] - 0.5) t -= 0.12;
      { const u = (hx - 10.5) / 8.5, w = (hy + 1) / 7.2, r = Math.sqrt(u * u + w * w); if (r > 0.92 && r < 1.08 && (w > 0.1 || u < -0.3) && dl > 3.2) t -= 0.1; }
      // the parietal eye on the crown
      if (Math.abs(hx - 14) < 1.3 && hy < crv(H_TOP, hx) + 1.6) { m = M.third; disp += 0.3; t += P.third * 0.2; }
      o.z = disp; o.m = m; o.t = t - 0.08 * v;
    };
    const jawTex = (jx: number, jy: number, v: number) => {
      let disp = 0, m = M.head, t = 0;
      const dl = jy - crv(J_TOP, jx);
      if (dl < 2.6 && jx > 6) {
        // the lower labials
        const sw = jx > 30 ? 3.5 : 3.2;
        const f = fr((jx - 6) / sw + 0.5);
        const gap = f * sw < 0.8;
        disp += 0.5 * Math.sin(f * Math.PI) - (gap ? 0.5 : 0);
        m = hash2(Math.floor((jx - 6) / sw), 5, 81) < 0.25 ? M.snout : M.lip;
        if (gap) { t -= 0.12; m = M.snout; }
        if (dl > 2.0) { disp -= 0.5; t -= 0.1; m = M.snout; }
        t -= 0.06;
      } else if (jx > 25 && dl < 6.8) {
        // the chin shields
        cell(jx, jy, 3.6, 2.7, 97);
        if (plate(0.13)) { disp -= 0.35; t -= 0.05; }
        m = M.snout;
      } else {
        m = v > 0.7 ? M.throat : M.head;
        // the jowl: the old skin folds at the angle of the jaw
        if (jx < 9 && jx > 1) { const g = fr((jx * 0.8 + jy * 0.6) / 3.4); if (g < 0.14 && jy > 11) t -= 0.05; }
        if (speckAt(jx + 50, jy)) m = M.fleck;
      }
      // the muscles at the back of the jaw
      { const u = (jx - 5) / 7, w = (jy - 13) / 5; const r = u * u + w * w; if (r < 1) disp += 1.6 * (1 - r); }
      o.z = disp; o.m = m; o.t = t - 0.08 * v;
    };
    const L = new Lay(sk, x0, y0, x1, y1);
    const Lj = new Lay(sk, x0, y0, x1, y1);
    const Lm = new Lay(sk, x0, y0, x1, y1);
    for (let j = 0; j < L.h; j++) {
      const py = L.ly(j);
      if (py > 0.5) continue;
      for (let i = 0; i < L.w; i++) {
        const px = L.lx(i);
        const rx = px - J[0], ry = py - J[1];
        const hx = (rx * hc + ry * hs) / HS, hy = (-rx * hs + ry * hc) / HS;
        const k = j * L.w + i;
        // the upper head
        if (hx >= -2.5 && hx <= 46) {
          const top = crv(H_TOP, hx), bot = crv(H_BOT, hx);
          if (hy >= top && hy <= bot) {
            const z = zHead(hx, hy), v = ZV;
            upperTex(hx, hy, v);
            const fade = Math.min(1, (1 - Math.abs(v)) * 5) * Math.min(1, (bot - hy) * 0.8 + 0.2);
            let zz = z + (sculpt(hx, hy) + o.z * fade) * HS;
            // the nape tucks under the neck so the two meet with no seam
            if (hx < 1) zz -= (1 - hx) * 1.6 * HS;
            L.put(k, zz + 1.5 * K, o.m, o.t, 1, 0);
          }
        }
        // the lower jaw, in its own (rotated) frame
        const jdx = hx - HINGE[0], jdy = hy - HINGE[1];
        const jx = HINGE[0] + jdx * jc + jdy * js, jy = HINGE[1] - jdx * js + jdy * jc;
        if (jx >= -1.5 && jx <= 42.8) {
          const top = crv(J_TOP, jx), bot = crv(J_BOT, jx);
          if (jy >= top && jy <= bot) {
            const z = zHead(jx, jy), v = ZV;
            jawTex(jx, jy, v);
            const fade = Math.min(1, (1 - Math.abs(v)) * 5);
            // set in under the upper lip (the mouth line is the seam between them)
            const zz = z + (o.z * fade) * HS - (jy - top < 1.6 ? 2.2 * K : 0.6 * K);
            Lj.put(k, zz + 1.5 * K, o.m, o.t, 1, 0);
          }
        }
        // the open mouth: the palate, the saw-edged jaws, the thick tongue, the dark gullet
        if (P.jaw > 0.04 && hx > HINGE[0] - 0.5 && hx < 45) {
          const mu = crv(H_BOT, hx);
          const jt = crv(J_TOP, Math.min(42.8, jx));
          // in front, the gape closes along the line from the beak's tip to the jaw's tip
          const tipU: V2 = [44.6, 11.2], tipJ = jl(42.4, 11.6);
          const front = (tipJ[0] - tipU[0]) * (hy - tipU[1]) - (tipJ[1] - tipU[1]) * (hx - tipU[0]);
          if (hy > mu - 0.5 && jy < jt + 0.5 && jx < 42.6 && front > 0) {
            const depth = cl((hx - HINGE[0]) / 16);
            let m = M.palate, t = -0.36 + depth * 0.42 - (1 - cl(P.jaw * 1.6)) * 0.35 - (hy < mu + 1.8 ? 0.14 : 0), zm = -3 * K;
            // the thick fleshy tongue lying on the floor of the mouth
            const tu = (jx - 11) / 23, tTop = jt - (1.6 + 2.2 * Math.sin(Math.PI * cl(tu)));
            if (hx < HINGE[0] + 4 + P.jaw * 3 + (hash2(i, j, 151) < 0.5 ? 1 : 0)) { m = M.gullet; t = 0; }
            else if (tu > 0 && tu < 1 && jy > tTop) { m = M.tongue; zm = -3 * K + (jy - tTop) * 0.6 * K; t = 0.04 - cl((jy - tTop) / 3) * 0.12; }
            else if (hy < mu + 1.4) t -= 0.1;
            Lm.put(k, zm, m, t, 1, 0);
          }
        }
      }
    }
    sk.np(); Lm.emit(-0.04, 0.8 * K, 99, 0.34, 0.6, 0.12, 2);
    sk.np(); Lj.emit(-0.02, 2.2 * K, 99, 0.34, 0.95, 0.06, 3);
    sk.np(); L.emit(-0.02, 2.2 * K, 99, 0.34, 0.95, 0.055, 3);
  }

  // ---------------------------------------------------------------- the near limbs
  sk.np(); drawLimb({ fore: false, near: true });
  sk.np(); drawLimb({ fore: true, near: true });

  // ---------------------------------------------------------------- overlays: teeth, the eye, the nostril, the third eye
  if (P.jaw > 0.1) {
    // acrodont teeth: no separate teeth in sockets but the jaw bone itself, worn into a saw edge;
    // the upper jaw has two rows (the maxilla on the lip, the palatine inside) and the lower row
    // bites between them; at the tip the premaxilla's beak of two big chisel points
    const tooth = hex('#ddd3b0'), toothD = hex('#a89d7e'), toothS = hex('#6e6450');
    for (let x = 8.5; x <= 43; x += 0.35) {
      const y = crv(H_BOT, x);
      const tip = fr(x / 2.2) < 0.45;
      const q = hp(x, y + 0.7);
      sk.overPaint(q[0], q[1], x < 12 ? toothD : tooth);
      if (tip && x > 10.5) { const q2 = hp(x, y + 1.7); sk.overPaint(q2[0], q2[1], x < 15 ? toothS : toothD); }
      if (P.jaw > 0.45 && x > 14 && x < 38) {
        const q3 = hp(x - 1.2, y + 3.4);
        sk.overPaint(q3[0], q3[1], fr(x / 2.0) < 0.5 ? toothD : toothS);
      }
    }
    for (const [x, y, c] of [[43.6, 11.4, tooth], [44.4, 11.6, tooth], [44.0, 12.5, toothD], [43.0, 11.2, toothD]] as const) { const q = hp(x, y); sk.overPaint(q[0], q[1], c); }
    for (let x = 8.5; x <= 41.8; x += 0.35) {
      const y = crv(J_TOP, x);
      const q = jp(x, y - 0.6);
      sk.overPaint(q[0], q[1], x < 12 ? toothD : tooth);
      if (fr((x + 1.1) / 2.2) < 0.45 && x > 10.5) { const q2 = jp(x, y - 1.6); sk.overPaint(q2[0], q2[1], x < 15 ? toothS : toothD); }
    }
  }
  // the closed mouth: one long dark line, wavy, turning up at the corner behind the eye
  if (P.jaw <= 0.1) {
    const ink = hex('#1d1912');
    for (let x = 3.6; x <= 44.0; x += 0.3) {
      const y = x < 6 ? crv(H_BOT, 6) - (6 - x) * 0.7 : crv(H_BOT, x) + 0.25;
      const q = hp(x, y);
      sk.overPaint(q[0], q[1], ink);
    }
    // the beak: the premaxilla's two chisel teeth show even with the mouth shut, hooked over the jaw
    for (const [x, y, c] of [[44.4, 10.9, hex('#cfc4a0')], [45.0, 10.6, hex('#a99e7e')], [44.0, 10.2, hex('#7e7458')]] as const) { const q = hp(x, y); sk.overPaint(q[0], q[1], c); }
  }
  // the eye: big and dark, a vertical pupil, a wet catchlight; the heavy brow shades its top
  const E = hp(EYE_H[0], EYE_H[1]);
  {
    const r = 4.3 * HS;
    const cx = E[0], cy = E[1];
    const open = cl(P.eye);
    const lid = cy - r * 1.02 + (1 - open) * 1.9 * r;
    const R = Math.ceil(r + 1.5);
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.hypot(dx / 1.1, dy);
        if (d > r + 0.3) continue;
        // the lowered upper lid: granular skin over the eyeball, shaded under the brow
        if (y + 0.5 < lid) { sk.over(x, y, dy < -r * 0.3 ? EYE_C.lidM : hash2(x, y, 143) < 0.35 ? EYE_C.lidL2 : EYE_C.lidM); continue; }
        let c: C;
        if (d > r - 0.7) c = EYE_C.rim;
        else if (Math.abs(dx) < 0.5 && Math.abs(dy) < r * 0.78) c = EYE_C.pupil;
        else if (dy < -r * 0.42 || y + 0.5 < lid + 1.1) c = EYE_C.lid;
        else if (dy > 0.2 && Math.abs(dx) > 0.9 && d < r - 1.2) c = (Math.floor(x + y * 2) % 4 === 0) ? EYE_C.fleck : EYE_C.irisL;
        else c = EYE_C.iris;
        sk.over(x, y, c);
      }
    if (open < 0.98) {
      for (let x = Math.floor(cx - r * 1.1 - 0.5); x <= Math.ceil(cx + r * 1.1 - 0.5); x++) sk.over(x, Math.floor(lid), EYE_C.lid);
    }
    // the lids: a ring of small pale scales, the lower lid catching the light, the upper in the brow's shade
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.hypot(dx / 1.1, dy);
        if (d <= r + 0.3 || d > r + 1.25) continue;
        if (dy < -r * 0.55) continue;
        const g = hash2(x, y, 141) < 0.3;
        sk.overPaint(x, y, dy > r * 0.2 ? (g ? EYE_C.lidL2 : EYE_C.lidL) : g ? EYE_C.lidM : EYE_C.lidL2);
      }
    if (open > 0.45) {
      sk.over(Math.floor(cx - r * 0.5), Math.floor(cy - r * 0.32), EYE_C.shine);
      sk.over(Math.floor(cx - r * 0.5) + 1, Math.floor(cy - r * 0.32), EYE_C.shine2);
      sk.over(Math.floor(cx + r * 0.45), Math.floor(cy + r * 0.5), EYE_C.shine2);
    }
  }
  // the nostril
  { const q = hp(NOSTRIL[0], NOSTRIL[1]); sk.over(q[0], q[1], hex('#1a150e')); const q2 = hp(NOSTRIL[0] + 0.9, NOSTRIL[1] + 0.3); sk.over(q2[0], q2[1], hex('#2c2618')); }
  // the parietal eye gleams when the crest lifts
  if (P.third > 0.3) {
    const q = hp(14, crv(H_TOP, 14) + 0.9);
    sk.over(q[0], q[1], hex('#eafff4'));
    if (P.third > 0.55) { sk.over(q[0] - 1, q[1], hex('#a8e8d0', 190)); sk.over(q[0] + 1, q[1], hex('#a8e8d0', 190)); sk.over(q[0], q[1] - 1, hex('#c8f8e8', 140 + Math.round(P.third * 100))); }
  }
  return { head: hp(16, -16), eye: E };
}

export const ANCIENT: SpeciesDef = {
  name: 'Te Ngārara Nui', kind: 'reptile', len: 245, height: 70,
  anims: ANCIENT_ANIMS,
  canvas: (_a: string, juv: boolean) => (juv ? { w: 160, h: 80, ox: 82, oy: 70 } : { w: 380, h: 170, ox: 200, oy: 150 }),
  draw: adraw,
  eyeFor: () => 'open',
};

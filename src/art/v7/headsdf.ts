// V12 sculpted heads (user, latest: "remake the head and face ... make them like realistic, the head
// shape looks ugly, genuinely lock in"; before: "not like circle mash together the face").
//
// The head was a handful of ellipsoids (skull, jaw, chin, nose) drawn over each other: notches where
// they met, a round blob for a jaw, a ball for a nose. Here the head is ONE signed-distance form built
// the way a portrait sculptor blocks a head in (the Loomis construction), every part blended into the
// next so there are no seams:
//  - the cranium: a long egg, a touch flatter on the sides
//  - the face hangs off its front: the cheekbones, the muzzle (the curve of the teeth under the lips),
//    the jaw running from its angle under the ear (at the level of the mouth) forward to the chin,
//    the ramus climbing from the angle up to the ear
//  - the brow ridge over two soft eye sockets, so the far side's silhouette dips at the eye
//  - the nose: a bridge from between the eyes to a rounded tip, the wings of the nostrils beside it
//  - the lips: a gentle swell over the muzzle
// The landmarks come from each head's own definition (its skull, jaw, chin, nose, ear, eye and mouth),
// so everyone keeps their own face: Joshu's big jaw, Jenna's small chin. Women's jaws are narrower and
// softer, the brow ridge lower; children's faces rounder still.

import type { V3 } from './raster';
import type { HeadDef7 } from './head';

const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
/** an ellipsoid's (approximate) signed distance */
function ell(p: V3, c: V3, r: V3): number {
  const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  const k0 = len3(x / r[0], y / r[1], z / r[2]);
  const k1 = len3(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
}
/** a tapered capsule from a (radius ra) to b (rb) */
function cone(p: V3, a: V3, b: V3, ra: number, rb: number): number {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2];
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  return len3(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
}
/** smooth union / intersection / subtraction (k: how wide the blend is, in head units) */
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

export interface HeadForm {
  /** signed distance in head space (x forward, y up, z to the near side) */
  f: (p: V3) => number;
  /** a box round it (head space) */
  lo: V3;
  hi: V3;
}

/**
 * One cross-section of the lofted head at height u (0 the chin's underside, 1 the crown): the front
 * and back of the head there (x), its half-width (z), how much the section narrows toward the front
 * (e: the U of the jaw) and how square it is (n: 2 an ellipse, more a flatter face front).
 */
type Key = [u: number, F: number, B: number, W: number, e: number, n: number];

/** a smooth curve through the keys (cubic Hermite, Catmull-Rom tangents) for each column */
function loft(keys: Key[]): (u: number) => Key {
  const N = keys.length;
  const tan = (c: number, i: number) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(N - 1, i + 1)];
    return (b[c] - a[c]) / Math.max(1e-6, b[0] - a[0]);
  };
  const T = keys.map((_, i) => [0, 1, 2, 3, 4, 5].map(c => (c ? tan(c, i) : 0)));
  const out: Key = [0, 0, 0, 0, 0, 0];
  return u => {
    u = Math.max(keys[0][0], Math.min(keys[N - 1][0], u));
    let i = 0;
    while (i < N - 2 && u > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], h = b[0] - a[0], t = (u - a[0]) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    out[0] = u;
    for (let c = 1; c < 6; c++) out[c] = h00 * a[c] + h10 * h * T[i][c] + h01 * b[c] + h11 * h * T[i + 1][c];
    return out;
  };
}

const forms = new Map<HeadDef7, Map<string, HeadForm>>();

/** the sculpted head for a head definition (`fem`: a woman's softer jaw and brow; `kid`: a child's round face) */
export function headForm(d: HeadDef7, fem: boolean, kid: boolean): HeadForm {
  const key = `${fem ? 1 : 0}${kid ? 1 : 0}`;
  let byKey = forms.get(d);
  if (!byKey) { byKey = new Map(); forms.set(d, byKey); }
  const hit = byKey.get(key);
  if (hit) return hit;
  const [sc, sr] = d.skull, [, jr] = d.jaw, [cc, cr] = d.chin, [nc, nr] = d.nose, ec = d.ear[0], E = d.eye, M = d.mouth;
  // ---- the landmarks
  const Yt = sc[1] + sr[1] * 0.97 + 0.15, Yb = cc[1] - cr[1] * 0.95;
  const Hh = Yt - Yb, U = (y: number) => (y - Yb) / Hh;
  const uM = U(M[1]), uE = U(E[1]);
  const Fs = sc[0] + sr[0], Bs = sc[0] - sr[0] * 1.03, Ws = sr[2] * 0.95;
  const Ff = E[0] + 0.45, Fm = M[0] + 0.05, Fc = cc[0] + cr[0] * 0.5;
  const Ba = ec[0] + (kid ? 0.6 : 0.2);
  // (the chin about a third of the face's width: a man's broad, a woman's narrower but never a point)
  const Wa = jr[2] * (kid ? 0.92 : fem ? 0.84 : 0.93), Wc = Math.max(Ws * (fem || kid ? 0.27 : 0.33), cr[2] * (kid ? 0.9 : fem ? 0.85 : 0.82));
  // the jaw's U: a man's squarer, a woman's and a child's rounder (and narrower to the chin)
  const eJ = kid ? 0.2 : fem ? 0.34 : 0.28;
  const keys: Key[] = [
    [0, Fc - 0.55, Fc - 2.3, Wc * 0.85, 0.1, 2.3],                                    // under the chin
    [0.07, Fc, cc[0] - 1.6, Wc * 1.05, 0.15, 2.3],                                    // the chin
    [uM - 0.06, Fm - 0.1, Ba + (kid ? 0.6 : 1.0), (Wc + Wa) / 2 + 0.25, eJ, 2.2],     // the jaw line
    [uM + 0.02, Fm, Ba, Wa, eJ * 0.85, 2.3],                                          // the jaw's angle, the mouth
    [uE - 0.1, Ff + 0.1, Ba - 1.9, Ws * 0.93, 0.16, 2.5],                             // the cheeks, under the ear
    [uE, Ff, Bs * 0.86, Ws * 0.98, 0.1, 2.6],                                         // the eyes, the ears
    [uE + 0.12, Fs - 0.05, Bs, Ws, 0.06, 2.4],                                        // the brow and the temples
    [0.78, Fs - 0.55, Bs * 0.96, Ws * 0.95, 0.05, 2.2],                               // the forehead
    [0.92, sc[0] + sr[0] * 0.55, Bs * 0.72, Ws * 0.72, 0.03, 2.1],                    // the top of the head
    [1, sc[0] + 0.7, sc[0] - 1.4, 0.9, 0, 2],                                         // the crown
  ];
  const sec = loft(keys);
  const body = (p: V3): number => {
    const y = p[1], u = (y - Yb) / Hh;
    const [, F, B, W, e, n] = sec(u);
    const a = Math.max(0.2, (F - B) / 2), x0 = (F + B) / 2;
    const X = (p[0] - x0) / a;
    const wz = Math.max(0.2, W * Math.max(0.3, 1 - e * X));
    const Z = p[2] / wz;
    const r = Math.pow(Math.pow(Math.abs(X), n) + Math.pow(Math.abs(Z), n), 1 / n);
    let dd = (r - 1) * Math.min(a, wz) * 0.85;
    if (u < 0) dd = Math.max(dd, Yb - y);
    if (u > 1) dd = Math.max(dd, y - Yt);
    return dd;
  };
  // ---- the features, kept subtle (a blob for a nose is what made the old head look like a toy)
  const brow = kid ? 0 : fem ? 0.6 : 1;
  const browC: V3 = [Ff - 0.2, E[1] + 1.0, 0], browR: V3 = [0.55 * Math.max(0.6, brow), 0.42, E[2] + 1.0];
  const bridge: V3 = [Ff - 0.15, E[1] + 0.45, 0], tip: V3 = [nc[0] + nr[0] * 0.42, nc[1] - 0.25, 0];
  const rBridge = kid ? 0.3 : fem ? 0.34 : 0.4, rTip = nr[1] * (kid ? 0.55 : 0.5);
  const wingC: V3 = [nc[0] - 0.2, nc[1] - 0.55, 0], wingR: V3 = [0.48, 0.36, nr[2] + 0.18];
  const lipC: V3 = [M[0] - 0.2, M[1] + 0.05, 0], lipR: V3 = [fem ? 0.48 : 0.42, fem ? 0.55 : 0.48, fem ? 1.05 : 1.0];
  const cheekR: V3 = [0.85, 0.6, 0.65];
  const f = (p: V3): number => {
    let h = body(p);
    const zs = p[2] < 0 ? -1 : 1;
    if (brow > 0) h = smin(h, ell(p, browC, browR), 0.55);
    if (!kid) h = smin(h, ell(p, [E[0] - 0.7, E[1] - 1.25, zs * (E[2] + 0.85)], cheekR), 0.6);
    h = smax(h, -ell(p, [E[0] + 0.55, E[1] - 0.05, zs * E[2]], [0.7, 0.55, 0.85]), 0.45);
    h = smin(h, cone(p, bridge, tip, rBridge, rTip), 0.38);
    h = smin(h, ell(p, wingC, wingR), 0.32);
    h = smin(h, ell(p, lipC, lipR), 0.32);
    return h;
  };
  const lo: V3 = [Bs - 1.2, Yb - 1, -(Ws + 1.2)];
  const hi: V3 = [Math.max(Fs, tip[0] + rTip, Fc) + 1.2, Yt + 1, Ws + 1.2];
  const out = { f, lo, hi };
  byKey.set(key, out);
  return out;
}

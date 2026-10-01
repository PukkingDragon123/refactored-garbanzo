// V7 gear: the building blocks the outfits are made of.
//  - materials that read a part's local frame: quilted baffles, zips and plackets, reflective tape,
//    fur, waxed / rubberised cloth with a hard shine, knit ribs, webbing
//  - 3D pieces placed in the torso's frame (J.T: height above the hip, forward, lateral +near): packs
//    with a bedroll and a thermos, pouches, radios with an antenna, rope coils, carabiners, knives,
//    collars (a hood down, a fur ruff, a life-jacket tube)
//  - head wear in head space (x forward, y up, z lateral): beanies (with a pom-pom or cat ears), hoods
//    with a lining and a fur ruff round the face, goggles pushed up, head lamps
// Everything goes through the same z-buffered rasteriser as the body, so gear foreshortens, overlaps
// and gets inked like the rest of the figure.

import { hex, C, mix } from '../color';
import { Scene3D, V3, Hit, Mat, cel, Ramp6, vadd, vsc } from './raster';
import type { J3, Char7, Part } from './body';
import type { HeadDef7, HeadWear7, HeadOpts7, Lock } from './head';

export const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
export const hash2 = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** far limbs sit in the body's shadow */
export const lb = (p: Part) => (p.near ? 0 : -0.28);

// ------------------------------------------------------------------ palettes

export const PAL = {
  fur: R6('#3a3430', '#6e645a', '#a09486', '#cdc2b2', '#e4dccf', '#f6f0e6'),
  furWhite: R6('#4a4a52', '#8a8a96', '#bcbcc6', '#e2e2ea', '#f2f2f8', '#ffffff'),
  furBrown: R6('#241810', '#4a3424', '#6e5238', '#8e6e4e', '#a88866', '#c4a484'),
  reflect: R6('#3a4248', '#6e7a82', '#a6b2b8', '#d4dde0', '#eef4f6', '#ffffff'),
  steel: R6('#1a1e22', '#3a4248', '#5e6a72', '#8a969e', '#b4c0c6', '#e6eef2'),
  brass: R6('#2a1a06', '#5a3a10', '#8a6220', '#b88a34', '#d8ac50', '#f6d888'),
  black: R6('#050506', '#0c0d10', '#16181c', '#212429', '#2e3238', '#40454d'),
  webbing: R6('#08080a', '#141418', '#202228', '#2c2f36', '#3a3e46', '#4c515a'),
  rope: R6('#2a1e10', '#5a4424', '#846840', '#aa8c5c', '#c6a878', '#e0c89c'),
  leather: R6('#140a06', '#301a10', '#4a2a1a', '#643a24', '#7e4e32', '#9a6646'),
  wood: R6('#1c1008', '#3e2614', '#5e3c20', '#7e5530', '#9a6e42', '#b88a58'),
  flax: R6('#2a1e0c', '#5a4418', '#86692a', '#b08e40', '#caa85a', '#e4c67c'),
  rubber: R6('#040405', '#0a0a0c', '#141418', '#1e1f24', '#2a2c32', '#3c3f47'),
  red: R6('#2a0606', '#5e0e0c', '#8e1c16', '#b82c22', '#d8483a', '#f07060'),
  orange: R6('#2a1004', '#6a2a08', '#a8440e', '#d8621a', '#f08432', '#ffb060'),
  yellow: R6('#2a2006', '#6a5410', '#b08c14', '#e0b41e', '#f4d040', '#fff080'),
  glassGreen: R6('#0a1a14', '#1a3a2c', '#2a6a4c', '#4a9a70', '#7ac8a0', '#c8f4dc'),
  lensOrange: R6('#2a0e04', '#6a2408', '#b04410', '#e8761e', '#ffa848', '#fff0c8'),
  lensBlue: R6('#040c1a', '#0c2444', '#1a4a7a', '#3a7ab0', '#70b0e0', '#e0f4ff'),
};

// ------------------------------------------------------------------ materials

/** quilted baffles: a seam every 1/n of u, each baffle puffed toward the light */
export function quilt(r: Ramp6, l: number, u: number, n: number, bias = 0): C {
  const f = frac(u * n);
  if (f < 0.13) return cel(r, l, bias - 0.5);
  return cel(r, l, bias + (f > 0.34 && f < 0.72 ? 0.14 : -0.04));
}
/** reflective tape: bright silver, flaring where the light catches it */
export const tape = (l: number): C => cel(PAL.reflect, l, 0.3, true);
/** waxed cotton / oilskin / rubberised nylon: a hard specular sheen */
export const gloss = (r: Ramp6, l: number, bias = 0): C => (l + bias > 0.62 ? (l + bias > 0.86 ? r[5] : r[4]) : cel(r, l, bias));
/** fur: noisy tufts, ragged along the silhouette */
export const furMat = (r: Ramp6, rag = 0.5): Mat => h => {
  const n = hash2(h.x, h.y);
  if (h.n[2] < 0.32 && n > 1 - rag) return -1;
  return cel(r, h.l, n > 0.72 ? 0.28 : n < 0.24 ? -0.32 : 0.02);
};
/** knit: vertical ribs */
export const knit = (r: Ramp6, l: number, rib: number, bias = 0): C => cel(r, l, bias + (frac(rib) < 0.22 ? -0.22 : 0.04));
/** a plain cel material for a piece of gear */
export const plain = (r: Ramp6, bias = 0, shine = false): Mat => h => cel(r, h.l, bias, shine);

// ------------------------------------------------------------------ 3D pieces on the body

/** groups for gear (ink lines are drawn between different groups) */
export const GG = { pack: 7, roll: 8, bottle: 9, pouch: 10, strap: 11, coil: 12, collar: 13, tool: 14, bag: 15, clip: 16 };

/** an ellipsoid in the torso frame: centre (height above the hip, forward, lateral), radii along fwd / up / lat */
export function tEll(s: Scene3D, J: J3, c: V3, r: V3, g: number, mat: Mat) {
  s.ellipsoid(J.T(c[0], c[1], c[2]), vsc(J.fwd, r[0]), vsc(J.up, r[1]), vsc(J.lat, r[2]), g, mat);
}
/** a limb between two torso-frame points */
export function tLimb(s: Scene3D, J: J3, a: V3, b: V3, r0: number, r1: number, g: number, mat: Mat) {
  s.limb(J.T(a[0], a[1], a[2]), J.T(b[0], b[1], b[2]), r0, r1, g, mat);
}

export interface PackOpts {
  /** height, width (lateral), depth; `top`: the top of the pack as a fraction of the torso */
  h: number; w: number; d: number; top: number;
  col: Ramp6;
  /** lid / front pocket colour */
  lid?: Ramp6;
  /** a bedroll strapped across the top */
  roll?: Ramp6;
  /** a thermos in the near side pocket */
  bottle?: Ramp6;
  /** specimen jars clipped along the near side */
  jars?: number;
  /** a radio antenna sticking up out of the far side */
  antenna?: boolean;
  /** a coil of rope under the lid */
  rope?: boolean;
  /** shift toward the near side, so the pack shows past the near arm in the 3/4 view */
  z?: number;
}
/** an expedition pack on the back, with whatever's strapped to it */
export function backpack(s: Scene3D, J: J3, ch: Char7, o: PackOpts) {
  const T = ch.build.torso;
  const back = -(ch.chest[0] + o.d * 0.55 + 0.4), hc = T * o.top - o.h * 0.5, hw = o.w * 0.5;
  const lid = o.lid ?? o.col, z0 = o.z ?? 0;
  tEll(s, J, [hc, back, z0], [o.d * 0.55, o.h * 0.5, hw], GG.pack, h => {
    // a lid flap over the top, a front pocket, compression straps
    if (h.q[1] > 0.55) return cel(lid, h.l, 0.05);
    if (Math.abs(h.q[1] - 0.2) < 0.06 || Math.abs(h.q[1] + 0.35) < 0.06) return cel(PAL.webbing, h.l, 0.1);
    if (h.q[0] < -0.5 && h.q[1] < 0.3 && h.q[1] > -0.7) return cel(lid, h.l, -0.1);
    return cel(o.col, h.l);
  });
  if (o.roll) {
    // a rolled sleeping mat across the top, bound with two straps
    const y = hc + o.h * 0.5 + 1.1;
    tLimb(s, J, [y, back + 0.2, z0 - hw - 0.8], [y, back + 0.2, z0 + hw + 0.8], 1.6, 1.6, GG.roll, h => (Math.abs(h.t - 0.25) < 0.05 || Math.abs(h.t - 0.75) < 0.05 ? cel(PAL.webbing, h.l, 0.1) : h.t < 0.03 || h.t > 0.97 ? cel(o.roll!, h.l, -0.35) : cel(o.roll!, h.l)));
  }
  if (o.bottle) tLimb(s, J, [hc - o.h * 0.32, back + 0.4, z0 + hw + 0.8], [hc + o.h * 0.08, back + 0.4, z0 + hw + 0.8], 1.0, 0.95, GG.bottle, h => (h.t > 0.86 ? cel(PAL.black, h.l, 0.1) : cel(o.bottle!, h.l, 0.05, true)));
  for (let i = 0; i < (o.jars ?? 0); i++) {
    // little glass specimen jars, a lid each, something green swimming in them
    const y = hc - o.h * 0.1 + i * 1.9;
    tEll(s, J, [y, back + o.d * 0.2, z0 + hw + 0.9], [0.62, 0.82, 0.62], GG.clip, h => (h.q[1] > 0.5 ? cel(PAL.steel, h.l, 0.2) : h.q[1] < -0.1 ? cel(PAL.glassGreen, h.l, 0.1) : cel(PAL.glassGreen, h.l, 0.4, true)));
  }
  if (o.antenna) {
    const base: V3 = [hc + o.h * 0.4, back, z0 - hw * 0.6];
    tLimb(s, J, base, [base[0] + 9, base[1] - 1.4, base[2] - 0.4], 0.32, 0.22, GG.tool, plain(PAL.black, 0.2));
    tEll(s, J, [base[0] + 9.2, base[1] - 1.45, base[2] - 0.4], [0.5, 0.5, 0.5], GG.tool, plain(PAL.orange, 0.2));
  }
  if (o.rope) tLimb(s, J, [hc + o.h * 0.5 + 0.2, back - 0.6, -hw * 0.8], [hc + o.h * 0.5 + 0.2, back - 0.6, hw * 0.8], 1.0, 1.0, GG.coil, ropeMat);
}
export const ropeMat: Mat = h => cel(PAL.rope, h.l, frac(h.t * 9 + h.q[1] * 0.5) < 0.3 ? -0.35 : 0.05);

/** a pouch / box on the body (camera bag, map case, radio) */
export function pouch(s: Scene3D, J: J3, c: V3, r: V3, col: Ramp6, flap?: Ramp6, g = GG.pouch) {
  tEll(s, J, c, r, g, h => (h.q[1] > 0.42 ? cel(flap ?? col, h.l, 0.08) : Math.abs(h.q[1] - 0.42) < 0.08 ? cel(col, h.l, -0.4) : cel(col, h.l)));
}

/** a handheld radio clipped to a strap: a black box, a stubby antenna with an orange tip */
export function radio(s: Scene3D, J: J3, c: V3) {
  tEll(s, J, c, [0.55, 1.4, 0.75], GG.tool, h => (h.q[0] > 0.6 && h.q[1] > 0 && h.q[1] < 0.5 ? cel(PAL.steel, h.l, 0.3) : cel(PAL.black, h.l, 0.15)));
  tLimb(s, J, [c[0] + 1.2, c[1], c[2] - 0.2], [c[0] + 3.6, c[1] - 0.1, c[2] - 0.3], 0.3, 0.26, GG.tool, plain(PAL.black, 0.2));
  tEll(s, J, [c[0] + 3.7, c[1] - 0.1, c[2] - 0.3], [0.38, 0.38, 0.38], GG.tool, plain(PAL.orange, 0.25));
}

/** a coil of rope slung over one shoulder and across the body to the other hip */
export function ropeCoil(s: Scene3D, J: J3, ch: Char7, near = true) {
  const T = ch.build.torso, side = near ? 1 : -1;
  const fz = ch.chest[0] + 0.6;
  for (let k = 0; k < 3; k++) {
    const off = k * 0.75 - 0.75;
    const N = 16;
    let prev: V3 | null = null;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      // an ellipse lying on the chest: from over the shoulder down across to the opposite hip
      const u = Math.cos(a), v = Math.sin(a);
      const h = T * 0.56 + u * T * 0.44 + off * 0.4, z = side * (ch.shW * 0.25 - u * ch.shW * 0.72) + off * 0.3;
      const f = v * (fz + 0.4) + (v > 0 ? 0.2 : -0.8);
      const p: V3 = [h, f, z];
      if (prev) tLimb(s, J, prev, p, 0.62, 0.62, GG.coil, ropeMat);
      prev = p;
    }
  }
}

/** a steel carabiner hanging off a belt or harness */
export function carabiner(s: Scene3D, J: J3, c: V3) {
  tLimb(s, J, c, [c[0] - 1.3, c[1] + 0.2, c[2]], 0.34, 0.34, GG.clip, plain(PAL.steel, 0.3, true));
  tLimb(s, J, [c[0] - 1.3, c[1] + 0.2, c[2]], [c[0] - 0.9, c[1] + 0.9, c[2]], 0.32, 0.3, GG.clip, plain(PAL.steel, 0.3, true));
  tLimb(s, J, [c[0] - 0.9, c[1] + 0.9, c[2]], [c[0] + 0.1, c[1] + 0.7, c[2]], 0.3, 0.3, GG.clip, plain(PAL.brass, 0.2, true));
}

/** a sheath knife on the belt: leather sheath, a wooden handle with a brass guard */
export function knife(s: Scene3D, J: J3, c: V3) {
  tEll(s, J, [c[0] - 1.4, c[1], c[2]], [0.55, 1.9, 0.6], GG.tool, h => (Math.abs(h.q[1] - 0.3) < 0.1 ? cel(PAL.leather, h.l, -0.4) : cel(PAL.leather, h.l, 0.05)));
  tEll(s, J, [c[0] + 0.7, c[1], c[2]], [0.45, 0.35, 0.55], GG.tool, plain(PAL.brass, 0.2, true));
  tLimb(s, J, [c[0] + 0.9, c[1], c[2]], [c[0] + 2.4, c[1] + 0.1, c[2]], 0.45, 0.5, GG.tool, plain(PAL.wood, 0.1));
}

/** a thick roll round the base of the neck: a hood down (bigger behind), a fur ruff, a life-jacket tube */
export function collar(s: Scene3D, J: J3, ch: Char7, o: { r: number; rise?: number; back?: number; mat: Mat; g?: number; n?: number }) {
  const T = ch.build.torso, n = o.n ?? 18;
  const rf = ch.chest[0] * 0.62 + ch.neckR * 0.5, rz = ch.shW * 0.42 + ch.neckR * 0.5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const behind = Math.max(0, -Math.cos(a)), bk = o.back ?? 0;
    const c: V3 = [T + (o.rise ?? 0.2) + behind * bk * 0.5, Math.cos(a) * rf - behind * bk * 0.7, Math.sin(a) * rz];
    const r = o.r + behind * bk * 0.9;
    tEll(s, J, c, [r, r * 0.8, r], o.g ?? GG.collar, o.mat);
  }
}

// ------------------------------------------------------------------ materials on the torso

/** shoulder straps of a pack (or a harness), painted down the front of the torso; returns true on a strap */
export function onStraps(p: Part, ch: Char7, w = 0.75): boolean {
  if (p.f < 0.2 || p.hh < 0.3) return false;
  const zs = ch.shW * 0.52 - (1 - p.hh) * 0.9;
  return Math.abs(Math.abs(p.z) - zs) < w;
}
/** a sash / cross strap from one shoulder to the other hip (sz: lateral centre at the top, bottom) */
export function onSash(p: Part, top: number, bottom: number, w = 0.85, h0 = 0.15, h1 = 0.95): boolean {
  if (p.f < 0 || p.hh < h0 || p.hh > h1) return false;
  const sz = bottom + ((p.hh - h0) / (h1 - h0)) * (top - bottom);
  return Math.abs(p.z - sz) < w;
}

// ------------------------------------------------------------------ head wear

export interface BeanieOpts {
  col: Ramp6;
  fold?: Ramp6;
  /** the brim's height at the front, and how much lower it sits at the back */
  y: number;
  drop?: number;
  pom?: Ramp6;
  /** cat ears on top */
  ears?: Ramp6;
  /** size over the hair shell */
  k?: number;
}
/** a knit beanie over the hair: a folded ribbed brim, a pom-pom or cat ears */
export function beanie(o: BeanieOpts) {
  return (s: Scene3D, W: (p: V3) => V3, d: HeadDef7) => {
    const [c0, r0] = d.shell, k = o.k ?? 1;
    const c: V3 = [c0[0] + 0.3, c0[1] + 0.8, 0], r: V3 = [r0[0] * 1.02 * k, r0[1] * 0.98 * k, r0[2] * 1.04 * k];
    const fold = o.fold ?? o.col;
    const cutY = (q: V3) => (o.y - c[1]) / r[1] - (o.drop ?? 2.2) / r[1] * Math.max(0, -q[0]);
    s.ellipsoid(W(c), W([r[0], 0, 0]), W([0, r[1], 0]), W([0, 0, r[2]]), 20, h => {
      const lim = cutY(h.q);
      if (h.q[1] < lim) return -1;
      const rib = Math.atan2(h.q[2], h.q[0]) * 9;
      if (h.q[1] < lim + 0.32) return h.q[1] > lim + 0.27 ? cel(fold, h.l, -0.4) : knit(fold, h.l, rib, 0.2);
      return knit(o.col, h.l, rib * 0.5, 0.12);
    });
    if (o.pom) s.ellipsoid(W([c[0] - 0.4, c[1] + r[1] + 0.6, 0]), W([1.5, 0, 0]), W([0, 1.4, 0]), W([0, 0, 1.5]), 21, furMat(o.pom, 0.35));
    if (o.ears) for (const z of [-1, 1]) {
      const base: V3 = [c[0] + 0.6, c[1] + r[1] * 0.72, z * r[2] * 0.55];
      s.limb(W(base), W([base[0] + 0.4, base[1] + 2.6, z * r[2] * 0.66]), 1.5, 0.35, 21, h => cel(o.ears!, h.l, 0.05));
    }
  };
}

export interface HoodOpts {
  col: Ramp6;
  lining?: Ramp6;
  fur?: Ramp6;
  /** grow the hood over a cap or big hair */
  k?: number;
  /** face opening: height of its top over the eyes, its half-width, how far down it goes */
  open?: { top: number; w: number; low: number };
  /** material override (oilskin sheen, quilting) */
  mat?: (h: Hit) => C;
}
/** a hood up: a shell round the head with the face opening cut out, a dark lining behind the face, a fur ruff framing it */
export function hood(o: HoodOpts) {
  return (s: Scene3D, W: (p: V3) => V3, d: HeadDef7) => {
    const [c0, r0] = d.shell, k = o.k ?? 1;
    const c: V3 = [c0[0] - 0.5, c0[1] + 0.2, 0], r: V3 = [r0[0] * 1.14 * k + 0.4, r0[1] * 1.12 * k + 0.4, r0[2] * 1.16 * k + 0.4];
    const op = o.open ?? { top: 4.6, w: 4.4, low: 3.2 };
    const ey = d.eye[1];
    const lining = o.lining ?? R6('#050304', '#0c0808', '#161012', '#201a1c', '#2a2224', '#342a2c');
    // the lining: a dark backdrop behind the face, seen round it inside the hood
    s.ellipsoid(W([c[0] - 1.6, c[1] - 0.6, 0]), W([r[0] * 0.45, 0, 0]), W([0, r[1] * 0.92, 0]), W([0, 0, r[2] * 0.9]), 22, h => cel(lining, h.l, -0.2));
    // the hood: its outer shell with the face opening (an ellipse on the front) cut away
    const mat = o.mat ?? ((h: Hit) => cel(o.col, h.l, Math.abs(h.q[2]) < 0.05 && h.q[1] > 0.3 && h.q[0] < 0.4 ? -0.3 : 0.02));
    s.ellipsoid(W(c), W([r[0], 0, 0]), W([0, r[1], 0]), W([0, 0, r[2]]), 23, h => {
      const y = c[1] + h.q[1] * r[1], z = h.q[2] * r[2];
      const inFace = h.q[0] > 0.05 && ((y - ey - (op.top - op.low) / 2) / ((op.top + op.low) / 2)) ** 2 + (z / op.w) ** 2 < 1;
      return inFace ? -1 : mat(h);
    });
    if (o.fur) {
      // a fur ruff round the face opening
      const N = 22, fm = furMat(o.fur, 0.55);
      const yc = (ey - op.low + ey + op.top) / 2, ry = (op.top + op.low) / 2 + 0.6, rz = op.w + 0.6;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        if (Math.sin(a) < -0.82) continue;
        const y = yc + Math.sin(a) * ry, z = Math.cos(a) * rz;
        // on the hood's surface at this height and width
        const qy = (y - c[1]) / r[1], qz = z / r[2];
        const qx = Math.sqrt(Math.max(0.02, 1 - qy * qy - qz * qz));
        const rr = 1.45 + hash2(i, 7) * 0.5;
        s.ellipsoid(W([c[0] + qx * r[0] - 0.3, y, z]), W([rr, 0, 0]), W([0, rr, 0]), W([0, 0, rr]), 24, fm);
      }
    }
  };
}

export interface GogglesOpts { y: number; lens: Ramp6; band?: Ramp6; frame?: Ramp6; k?: number }
/** goggles pushed up on the forehead / hat / hood: a strap round the head, two tinted lenses with a glint */
export function goggles(o: GogglesOpts) {
  return (s: Scene3D, W: (p: V3) => V3, d: HeadDef7) => {
    const [c0, r0] = d.shell, k = o.k ?? 1.08;
    const band = o.band ?? PAL.webbing, frame = o.frame ?? PAL.steel;
    // the strap shows behind and at the sides; the front is all lens
    for (let i = 0; i <= 18; i++) {
      const a = -Math.PI + (i / 18) * TAU;
      if (Math.cos(a) > 0.55) continue;
      const p: V3 = [c0[0] + Math.cos(a) * r0[0] * k, o.y - Math.cos(a) * 0.4, Math.sin(a) * r0[2] * k];
      s.ellipsoid(W(p), W([0.7, 0, 0]), W([0, 0.5, 0]), W([0, 0, 0.7]), 25, h => cel(band, h.l, 0.1));
    }
    const fx = c0[0] + r0[0] * k * 0.88;
    for (const z of [-1, 1]) {
      const zc = z * r0[2] * 0.42;
      s.ellipsoid(W([fx - 0.25, o.y + 0.2, zc]), W([0.8, 0, 0]), W([0, 1.15, 0]), W([0, 0, 1.45]), 26, h => cel(frame, h.l, -0.15));
      s.ellipsoid(W([fx + 0.3, o.y + 0.2, zc]), W([0.62, 0, 0]), W([0, 1.0, 0]), W([0, 0, 1.25]), 27, h => (h.q[1] > 0.35 && h.q[2] * z < 0.1 ? o.lens[5] : cel(o.lens, h.l, 0.35, true)));
    }
  };
}

/** a head lamp on its strap: a black housing, a bright lens */
export function headlamp(o: { y: number; k?: number }) {
  return (s: Scene3D, W: (p: V3) => V3, d: HeadDef7) => {
    const [c0, r0] = d.shell, k = o.k ?? 1.06;
    for (let i = 0; i <= 18; i++) {
      const a = -Math.PI + (i / 18) * TAU;
      const p: V3 = [c0[0] + Math.cos(a) * r0[0] * k, o.y - Math.cos(a) * 0.3, Math.sin(a) * r0[2] * k];
      s.ellipsoid(W(p), W([0.6, 0, 0]), W([0, 0.55, 0]), W([0, 0, 0.6]), 28, h => cel(PAL.orange, h.l, -0.1));
    }
    const fx = c0[0] + r0[0] * k;
    s.ellipsoid(W([fx, o.y + 0.1, 0]), W([1.0, 0, 0]), W([0, 0.95, 0]), W([0, 0, 1.2]), 29, h => (h.q[0] > 0.55 ? hex('#fff6cc') : cel(PAL.black, h.l, 0.15)));
  };
}

/** head wear from pieces: which hair to tuck away, and the pieces in order */
export function wear(pieces: ((s: Scene3D, W: (p: V3) => V3, d: HeadDef7, o: HeadOpts7) => void)[], o: { hideLock?: (l: Lock, i: number) => boolean; tuck?: number; hideShell?: boolean; hideExtras?: boolean } = {}): HeadWear7 {
  return { ...o, draw: (s, W, ho, d) => { for (const p of pieces) p(s, W, d, ho); } };
}

export const mixC = mix;

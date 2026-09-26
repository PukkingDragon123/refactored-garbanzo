// Shared quadruped / limb helpers for the V2 beasts (mammals, bat, frog).

import { Sk, V2, ik2, Fill, rot2, add, lerp2, hh } from './beasts-core';
import { C } from './color';

/** Rigid 2D frame: origin, rotation, uniform scale and optional x mirror (mx = -1 faces left). */
export class Frame2 {
  constructor(public o: V2, public a = 0, public k = 1, public mx = 1) {}
  p(x: number, y: number): V2 {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    x *= this.k * this.mx; y *= this.k;
    return [this.o[0] + x * c - y * s, this.o[1] + x * s + y * c];
  }
  /** world angle of a local direction angle */
  ang(a: number) { return (this.mx < 0 ? Math.PI - a : a) + this.a; }
  /** child frame at local (x, y), rotated by local angle a */
  sub(x: number, y: number, a: number): Frame2 { return new Frame2(this.p(x, y), this.a + a * this.mx, this.k, this.mx); }
  /** world-space direction vector for local angle */
  dir(a: number, len = 1): V2 { const w = this.ang(a); return [Math.cos(w) * len * this.k, Math.sin(w) * len * this.k]; }
}

export interface LegSpec {
  l1: number; l2: number; l3?: number;
  r1: number; r2: number; r3?: number;
  /** +1: joint behind (forelimb elbow); -1: joint in front (hind knee) — for right-facing */
  bend: number;
}
export const scaleLeg = (L: LegSpec, k: number): LegSpec => ({
  ...L, l1: L.l1 * k, l2: L.l2 * k, l3: L.l3 !== undefined ? L.l3 * k : undefined,
  r1: L.r1 * k, r2: L.r2 * k, r3: L.r3 !== undefined ? L.r3 * k : undefined,
});

/**
 * Draw a 2-3 segment leg from hip to foot target through IK. With l3, the last segment (metapodial)
 * leaves the foot at angle `footAng` so the ankle sits above/behind the toe. Returns [hip, knee, ankle, foot].
 */
export function leg(sk: Sk, hip: V2, foot: V2, L: LegSpec, fill: Fill, z: number, footAng = -Math.PI / 2 - 0.5, bias = 0): V2[] {
  let ankle = foot;
  if (L.l3) ankle = [foot[0] + Math.cos(footAng) * L.l3, foot[1] + Math.sin(footAng) * L.l3];
  const [knee, end] = ik2(hip, ankle, L.l1, L.l2, L.bend);
  const r1 = L.r1, r2 = L.r2, r3 = L.r3 ?? L.r2 * 0.8;
  sk.tube([hip, knee], t => r1 + (r2 - r1) * t, fill, { z, bias });
  sk.tube([knee, end], t => r2 + (r3 - r2) * t, fill, { z: z + 0.2, bias });
  let f = end;
  if (L.l3) {
    const dx = foot[0] - ankle[0], dy = foot[1] - ankle[1];
    f = [end[0] + dx, end[1] + dy];
    sk.tube([end, f], r3, fill, { z: z + 0.4, bias });
  }
  return [hip, knee, end, f];
}

/** Paw with claws at a foot point; dir = +1 facing right. */
export function paw(sk: Sk, f: V2, k: number, fur: number, claw: number, z: number, o: { n?: number; clawLen?: number; w?: number; h?: number; bias?: number; dir?: number; down?: number } = {}) {
  const n = o.n ?? 3, cl = (o.clawLen ?? 1.6) * k, w = (o.w ?? 1.8) * k, h = (o.h ?? 1.1) * k, bias = o.bias ?? 0, d = o.dir ?? 1;
  sk.ell(f[0] + 0.4 * k * d, f[1] - h * 0.3, w, h, fur, { z: z + 0.6, bias });
  for (let c = 0; c < n; c++) {
    const bx = f[0] + (w * 0.7 + c * 0.3 * k) * d, by = f[1] - h * 0.4 + c * 0.35 * k;
    const a = (o.down ?? 0.6) + c * 0.15;
    const ex = bx + Math.cos(a) * cl * d, ey = by + Math.sin(a) * cl;
    sk.blade(bx, by, ex, Math.min(ey, 0), s => (1 - s) * 0.6 * k + 0.22, claw, { z0: z + 1, z1: z + 1.2, bias });
  }
}

/** A leaf-shaped ear from base, pointing at world angle a, with an inner-ear material. */
export function ear(sk: Sk, base: V2, a: number, len: number, wid: number, fur: number, inner: number, z: number, bias = 0, round = 1.2) {
  const tip: V2 = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
  sk.blade(base[0], base[1], tip[0], tip[1], s => Math.sin(Math.min(1, s * round) * Math.PI) * wid + 0.3, (p) => (inner && Math.abs(p.v) < 0.5 && p.t > 0.18 && p.t < 0.82 ? inner : fur), { z0: z, z1: z + 0.3, bias });
  return tip;
}

/** Whiskers as thin overlay strokes fanning from the muzzle. */
export function whiskers(sk: Sk, m: V2, dir: number, len: number, c: C, n = 3, spread = 0.35, droop = 0.1) {
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * spread + droop;
    const ex = m[0] + Math.cos(a) * len * dir, ey = m[1] + Math.sin(a) * len;
    // skip the pixel nearest the muzzle so whiskers read as separate strands
    const steps = Math.ceil(len);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (hh(i, s, 5) < 0.18) continue;
      sk.over(m[0] + (ex - m[0]) * t, m[1] + (ey - m[1]) * t + t * t * droop * 2, c);
    }
  }
}

/** Tapered tail/neck chain as a tube with radius profile. */
export function tail(sk: Sk, pts: V2[], r: (t: number) => number, fill: Fill, z: number | ((t: number) => number), bias = 0) {
  sk.tube(pts, r, fill, { z, bias });
}

/** Mid point helper. */
export const mid = (a: V2, b: V2, t = 0.5) => lerp2(a, b, t);
export { rot2, add };

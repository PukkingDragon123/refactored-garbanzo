// Seabird rig for the V9 open-ocean birds (vanebill, sackjaw, scythewing): a small 3D bird made of
// a tapered body, a head, a bill, a planar tail fan and wings built from a jointed leading edge with
// chords, seen from the side with a bank (roll), a pitch and a slight yaw toward the viewer. It is
// rasterised with the beasts sketch core (z-buffered implicit surfaces, OKLab ramps, tinted
// outlines), so a soaring bird can roll smoothly from showing its underwing to showing its back,
// and every plumage patch follows the true 3D surface (countershading, underwing margins, rumps).

import { Sk, V2, V3, Px, poly3, v3add, v3sub, v3mul, v3norm, v3cross, v3dot, lmix } from '../../beasts-core';
import type { C } from '../../color';

// ------------------------------------------------------------------ view
/** Body space: x forward, y up, z toward the viewer (near side). */
export class View3 {
  private readonly cb: number;
  private readonly sb: number;
  private readonly cp: number;
  private readonly sp: number;
  private readonly cy: number;
  private readonly sy: number;
  /**
   * bank: roll about the body axis, + dips the near wing (shows the back and upper wings);
   * pitch: + nose up; yaw: + turns the nose toward the viewer (the far wing swings forward).
   * o: sketch position of the body origin, k: scale.
   */
  constructor(readonly bank: number, readonly pitch: number, readonly yaw: number, readonly o: V2 = [0, 0], readonly k = 1) {
    this.cb = Math.cos(bank); this.sb = Math.sin(bank);
    this.cp = Math.cos(pitch); this.sp = Math.sin(pitch);
    this.cy = Math.cos(yaw); this.sy = Math.sin(yaw);
  }
  /** rotate a body-space vector into view space (x right, y up, z toward the viewer) */
  n(p: V3): V3 {
    const y = p[1] * this.cb - p[2] * this.sb, z = p[1] * this.sb + p[2] * this.cb;
    const x2 = p[0] * this.cp - y * this.sp, y2 = p[0] * this.sp + y * this.cp;
    return [x2 * this.cy - z * this.sy, y2, x2 * this.sy + z * this.cy];
  }
  /** view-space vector back into body space */
  inv(q: V3): V3 {
    const x2 = q[0] * this.cy + q[2] * this.sy, z = -q[0] * this.sy + q[2] * this.cy;
    const x = x2 * this.cp + q[1] * this.sp, y = -x2 * this.sp + q[1] * this.cp;
    return [x, y * this.cb + z * this.sb, -y * this.sb + z * this.cb];
  }
  /** body point → sketch coords (y down) and depth */
  s(p: V3): V3 {
    const q = this.n(p);
    return [this.o[0] + q[0] * this.k, this.o[1] - q[1] * this.k, q[2] * this.k];
  }
  s2(p: V3): V2 {
    const q = this.s(p);
    return [q[0], q[1]];
  }
  /** body point → scaled view space (for poly3 with phi = 0, origin at this.o) */
  q(p: V3): V3 {
    const r = this.n(p);
    return [r[0] * this.k, r[1] * this.k, r[2] * this.k];
  }
  /** body-space normal of a sketch pixel (sketch normals are screen space, y down) */
  bodyN(p: Px): V3 {
    return this.inv([p.nx, -p.ny, p.nz]);
  }
  /** does a body-space normal face the viewer? */
  faces(nrm: V3, min = 0) {
    return this.n(nrm)[2] > min;
  }
}

// ------------------------------------------------------------------ body parts
/** Tapered body along a body-space centreline; fill gets the pixel and its body-space normal. */
export function body3(sk: Sk, V: View3, line: V3[], rad: (t: number) => number, fill: (p: Px, n: V3) => number, o: { bias?: number } = {}) {
  const pts = line.map(p => V.s(p));
  const zs = pts.map(p => p[2]);
  sk.tube(pts.map(p => [p[0], p[1]] as V2), t => rad(t) * V.k, p => fill(p, V.bodyN(p)), {
    z: t => { const f = t * (zs.length - 1), i = Math.min(zs.length - 2, Math.floor(f)); return zs[i] + (zs[i + 1] - zs[i]) * (f - i); },
    bias: o.bias,
  });
}

/** Sphere (head, pouch) at a body-space centre. */
export function ball3(sk: Sk, V: View3, c: V3, r: number, fill: (p: Px, n: V3) => number, o: { ry?: number; rot?: number; bias?: number } = {}) {
  const q = V.s(c);
  sk.ell(q[0], q[1], r * V.k, (o.ry ?? r) * V.k, p => fill(p, V.bodyN(p)), { z: q[2], rz: r * V.k, rot: o.rot, bias: o.bias });
}

/** Planar polygon given in body space (tail fans, bill plates), fill gets u/v over its first edges. */
export function plate3(sk: Sk, V: View3, pts: V3[], fill: (p: Px, top: boolean) => number, nrm: V3, o: { bias?: number; zb?: number } = {}) {
  const top = V.faces(nrm);
  poly3(sk, V.o[0], V.o[1], pts.map(p => V.q(p)), p => fill(p, top), { phi: 0, bias: o.bias, zb: o.zb });
  return top;
}

// ------------------------------------------------------------------ wings
export interface WingSeg {
  len: number;
  /** spread-pose sweep (rad, + forward) and dihedral (rad, + up) */
  sweep: number;
  dih: number;
  /** sweep change when the wing flexes (upstroke / tuck), + forward */
  flex: number;
  /** span lost when flexed (0..1) */
  shrink?: number;
}
export interface WingShape {
  /** shoulder, body space, near side (z > 0) */
  sh: V3;
  segs: WingSeg[];
  /** chord at each joint (segs.length + 1 values; the last is the tip width) */
  chord: number[];
  /** leading-edge spar radius (keeps an edge-on wing a clean line) */
  spar: number;
}
export interface WingPose {
  /** flap elevation at the shoulder (+ up) */
  elev: number;
  /** extra elevation of the hand (outer segments), + up */
  hand: number;
  /** 0 spread .. 1 flexed */
  flex: number;
  /** extra sweep of the hand (+ forward) */
  sweep: number;
}
export type WingFill = (p: Px, s: number, c: number, top: boolean, seg: number) => number;
export interface WingOut { le: V3[]; te: V3[]; tip: V2; wrist: V2; top: boolean }

/**
 * A spread wing. side +1 = near wing (toward the viewer), -1 = far wing. Joints chain outward from
 * the shoulder; the chord at each joint points back in the wing plane. fill gets the span position
 * s (0 shoulder .. 1 tip), the chordwise position c (0 leading edge .. 1 trailing edge), the side
 * we see and the segment index; return 0 to leave a pixel empty (feather notches).
 */
export function wing3(sk: Sk, V: View3, W: WingShape, P: WingPose, side: 1 | -1, fill: WingFill, o: { bias?: number; zb?: number; spar?: (top: boolean) => number } = {}): WingOut {
  const n = W.segs.length;
  const ce = Math.cos(P.elev), se = Math.sin(P.elev);
  // local chain (z outward from the shoulder), elevation about the body axis, then mirror
  const toBody = (l: V3): V3 => {
    const y = l[1] * ce + l[2] * se, z = -l[1] * se + l[2] * ce;
    return [W.sh[0] + l[0], W.sh[1] + y, side * (W.sh[2] + z)];
  };
  const loc: V3[] = [[0, 0, 0]];
  const dirs: V3[] = [];
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
    dirs.push(d);
  }
  const le = loc.map(toBody);
  // span parameter along the leading edge
  const cum = [0];
  for (let j = 1; j < le.length; j++) cum.push(cum[j - 1] + Math.hypot(...v3sub(le[j], le[j - 1]) as [number, number, number]));
  const tot = cum[cum.length - 1] || 1;
  const S = cum.map(c => c / tot);
  // chords: back in the wing plane, perpendicular to the local span direction
  const te: V3[] = [];
  const nrm: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = i > 0 ? v3sub(le[i], le[i - 1]) : v3sub(le[1], le[0]);
    const b = i < n ? v3sub(le[i + 1], le[i]) : a;
    const d = v3norm(v3add(v3norm(a), v3norm(b)));
    const back: V3 = [-1, 0, 0];
    const cd = v3norm(v3sub(back, v3mul(d, v3dot(back, d))));
    te.push(v3add(le[i], v3mul(cd, W.chord[i])));
    nrm.push(v3norm(v3mul(v3cross(cd, d), side)));
  }
  // which side of each panel faces us
  const panelTop = (j: number) => V.faces(v3norm(v3add(nrm[j], nrm[j + 1])));
  const top0 = V.faces(nrm[Math.min(1, n)]);
  sk.np();
  for (let j = 0; j < n; j++) {
    const top = panelTop(j);
    const quad = [le[j], le[j + 1], te[j + 1], te[j]];
    const vq = quad.map(q => V.q(q));
    // skip panels seen nearly edge-on (the spar and trailing line carry them)
    const pn = v3norm(v3cross(v3sub(vq[1], vq[0]), v3sub(vq[3], vq[0])));
    if (Math.abs(pn[2]) < 0.1) continue;
    const r = W.chord[j + 1] / Math.max(0.01, W.chord[j]);
    const s0 = S[j], s1 = S[j + 1];
    poly3(sk, V.o[0], V.o[1], vq, px => {
      const u = Math.max(0, Math.min(1, px.u));
      const c = px.v / Math.max(0.05, 1 + (r - 1) * u);
      if (c < -0.05 || c > 1.08) return 0;
      return fill(px, s0 + (s1 - s0) * u, Math.max(0, Math.min(1, c)), top, j);
    }, { phi: 0, bias: o.bias, zb: o.zb });
  }
  // leading-edge spar and a hairline trailing edge so edge-on wings stay continuous
  const sp = le.map(q => V.s(q));
  const spFill = o.spar ? o.spar(top0) : (px: Px) => fill(px, 0.5, 0, top0, 0);
  sk.tube(sp.map(q => [q[0], q[1]] as V2), t => W.spar * V.k * (1 - t * 0.55), spFill, {
    z: t => { const f = t * (sp.length - 1), i = Math.min(sp.length - 2, Math.floor(f)); return sp[i][2] + (sp[i + 1][2] - sp[i][2]) * (f - i) + 0.4; },
    bias: o.bias,
  });
  const tip = V.s2(le[n]);
  const wrist = V.s2(le[Math.min(n, 2)]);
  return { le, te, tip, wrist, top: top0 };
}

// ------------------------------------------------------------------ misc helpers
/** lighten/darken a pixel by feather rows: a darker line every `every` units along a coordinate */
export const rows = (v: number, every: number, w = 0.22) => {
  const f = v / every - Math.floor(v / every);
  return f < w ? -0.1 : 0;
};
/** soft haze toward a distance colour (distant variants of a ramp) */
export function hazeRamp(r: C[], haze: C, k: number): C[] {
  return k <= 0 ? r : r.map(c => lmix(c, haze, k));
}
export { v3add, v3sub, v3mul, v3norm, v3cross, v3dot };

// V7 hands: a modelled hand at the end of every arm (a palm, a two-jointed thumb and four two-jointed
// fingers) shaped by the pose (a loose curl walking, an open palm talking, a fist running, a grip
// round a handle, a pointing finger, a spread wave, a pinch, cupped hands, a hook under a bail) and
// turned the way the pose wants the palm to face.
//
// Built for sprite scale: hands are drawn a touch large (anime proportions) so the shapes read at
// 5-8 px; the thumb stands clear of the fingers; creases split the fingers into pairs (or one by one
// when they spread) so an open hand is a hand and not a paddle; a fist gets a knuckle line. Fingerless
// gloves (and any other split) come from the character's `fingers` material.
//
// Hand frame: from the wrist, `d` runs toward the knuckles, `s` toward the thumb side and `n` out of
// the palm. Fingers curl toward +n; flexing the wrist (ArmP.flex) tips the hand toward the palm.

import type { ArmP } from '../people-rig';
import type { J3 } from './body';
import { Scene3D, V3, Mat, vadd, vsub, vsc, vdot, vnorm, vcross, vlen } from './raster';

export type PalmDir = 'in' | 'out' | 'up' | 'down' | 'fwd' | 'back' | 'cam';

/** one finger: knuckle bend, the bend of the two outer joints together, and splay (radians) */
type Fing = [number, number];
interface Shape {
  /** index, middle, ring, little */
  f: [Fing, Fing, Fing, Fing];
  /** splay of the fingers away from each other */
  spread: number;
  /** thumb: direction of its first and second segment in the hand frame [d, s, n] */
  t1: V3; t2: V3;
  /** creases between the fingers: 0 none, 1 between the pairs, 3 every gap */
  creases: 0 | 1 | 3;
  /** a knuckle line across the back of curled fingers */
  knuckles?: boolean;
  /** where the palm faces unless the pose says */
  palm?: PalmDir;
  /** wrist flex unless the pose says */
  flex?: number;
}

const F = (a: number, b: number): Fing => [a, b];
const SHAPES: Record<string, Shape> = {
  // hanging loose: a soft curl, fingers together, the thumb resting along the index
  relax: { f: [F(0.32, 0.5), F(0.4, 0.58), F(0.46, 0.66), F(0.52, 0.72)], spread: 0.04, t1: [0.78, 0.42, 0.3], t2: [0.8, 0.12, 0.5], creases: 0, flex: 0.12 },
  fist: { f: [F(1.5, 1.75), F(1.55, 1.75), F(1.55, 1.7), F(1.5, 1.65)], spread: 0, t1: [0.45, 0.25, 0.85], t2: [0.35, -0.75, 0.55], creases: 1, knuckles: true },
  // round a handle that runs across the palm (along s)
  grip: { f: [F(1.05, 1.25), F(1.1, 1.25), F(1.1, 1.2), F(1.05, 1.15)], spread: 0, t1: [0.5, 0.3, 0.8], t2: [0.45, -0.6, 0.6], creases: 1, knuckles: true },
  open: { f: [F(0.08, 0.12), F(0.06, 0.1), F(0.1, 0.14), F(0.14, 0.2)], spread: 0.12, t1: [0.5, 0.82, 0.18], t2: [0.75, 0.6, 0.1], creases: 1 },
  flat: { f: [F(0.02, 0.04), F(0, 0.02), F(0.02, 0.04), F(0.04, 0.06)], spread: 0.02, t1: [0.78, 0.55, 0.1], t2: [0.95, 0.22, 0.05], creases: 0 },
  point: { f: [F(0.02, 0.06), F(1.5, 1.7), F(1.55, 1.7), F(1.5, 1.65)], spread: 0, t1: [0.5, 0.2, 0.85], t2: [0.5, -0.65, 0.55], creases: 0, knuckles: true },
  pinch: { f: [F(0.62, 0.78), F(0.55, 0.85), F(0.7, 1.0), F(0.8, 1.1)], spread: 0.03, t1: [0.7, 0.45, 0.55], t2: [0.6, -0.1, 0.8], creases: 1 },
  // up beside the head, fingers fanned, the thumb out wide
  wave: { f: [F(-0.08, 0.04), F(-0.1, 0.02), F(-0.06, 0.06), F(0, 0.1)], spread: 0.2, t1: [0.35, 0.92, 0.12], t2: [0.6, 0.78, 0], creases: 3, palm: 'fwd', flex: -0.25 },
  // a shallow bowl: fingers tight together and gently curved, the thumb tucked along the side
  cup: { f: [F(0.3, 0.36), F(0.28, 0.36), F(0.3, 0.38), F(0.34, 0.42)], spread: -0.02, t1: [0.72, 0.6, 0.3], t2: [0.85, 0.25, 0.42], creases: 1, palm: 'up', flex: 0.05 },
  // fingers hooked under a bail, a rope or a gill flap; the thumb along the index
  hook: { f: [F(0.28, 1.6), F(0.3, 1.65), F(0.32, 1.6), F(0.34, 1.55)], spread: 0, t1: [0.8, 0.4, 0.3], t2: [0.85, 0.05, 0.5], creases: 1, knuckles: true },
  // startled: spread and half curled
  claw: { f: [F(0.25, 0.6), F(0.2, 0.62), F(0.26, 0.64), F(0.32, 0.66)], spread: 0.24, t1: [0.4, 0.88, 0.3], t2: [0.55, 0.6, 0.55], creases: 3 },
  // thumbs up
  thumb: { f: [F(1.5, 1.7), F(1.55, 1.75), F(1.55, 1.7), F(1.5, 1.65)], spread: 0, t1: [0.3, 0.55, 0.2], t2: [0.05, 0.98, 0], creases: 1, knuckles: true },
};
export const HAND_SHAPES = Object.keys(SHAPES);

/** knuckle offsets across the palm (index on the thumb side) and finger lengths, in hand units */
const OFF = [0.7, 0.24, -0.22, -0.66];
const KNX = [2.12, 2.2, 2.14, 2.0];
const LEN = [1.72, 1.92, 1.78, 1.38];
const SPL = [1.25, 0.42, -0.42, -1.25];
/** a finger segment's material sees t along the whole finger (0 knuckle → 1 tip) */
const seg = (m: Mat, t0: number, t1: number): Mat => h => { h.t = t0 + (t1 - t0) * h.t; return m(h); };

/** the drawn hand scale for a build's `hand` (anime proportions: small hands drawn a little large) */
export const handScale = (hand: number) => 1.48 + (hand - 1) * 0.6;

export interface HandFrame {
  /** wrist */
  o: V3;
  d: V3; s: V3; n: V3;
  /** hand units (px) */
  k: number;
  /** hand space → world */
  P(a: number, b: number, c: number): V3;
  /** the centre of a grip (where a handle runs through the fist) and the palm's centre */
  grip: V3;
  palm: V3;
}

function palmTarget(J: J3, near: boolean, dir: PalmDir): V3 {
  const side = near ? 1 : -1;
  switch (dir) {
    case 'out': return vsc(J.lat, side);
    case 'up': return [0, 1, 0];
    case 'down': return [0, -1, 0];
    case 'fwd': return J.fwd;
    case 'back': return vsc(J.fwd, -1);
    case 'cam': return [0, 0, 1];
    default: return vsc(J.lat, -side);
  }
}

/** the hand's frame at the end of an arm, for the arm's pose (shape, palm, flex) */
export function handFrame(wr: V3, el: V3, J: J3, near: boolean, arm: ArmP | undefined, hand: number): HandFrame {
  const shape = SHAPES[arm?.hand ?? 'relax'] ?? SHAPES.relax;
  let d = vnorm(vsub(wr, el));
  const want = palmTarget(J, near, arm?.palm ?? shape.palm ?? 'in');
  let n = vsub(want, vsc(d, vdot(want, d)));
  if (vlen(n) < 0.2) {
    // palm target along the forearm: fall back to facing the body
    const w2 = palmTarget(J, near, 'in');
    n = vsub(w2, vsc(d, vdot(w2, d)));
    if (vlen(n) < 0.2) n = vsub(J.fwd, vsc(d, vdot(J.fwd, d)));
  }
  n = vnorm(n);
  // wrist flex toward the palm (+) or back (-), and a sideways tilt toward the thumb (dev)
  const fx = arm?.flex ?? shape.flex ?? 0;
  if (fx) { const c = Math.cos(fx), sn = Math.sin(fx); const d2 = vadd(vsc(d, c), vsc(n, sn)); n = vnorm(vsub(vsc(n, c), vsc(d, sn))); d = vnorm(d2); }
  // the thumb side: a right hand (near) has it on d × n
  let s = near ? vcross(d, n) : vcross(n, d);
  s = vnorm(s);
  const dv = arm?.dev ?? 0;
  if (dv) { const c = Math.cos(dv), sn = Math.sin(dv); const d2 = vadd(vsc(d, c), vsc(s, sn)); s = vnorm(vsub(vsc(s, c), vsc(d, sn))); d = vnorm(d2); }
  const k = handScale(hand);
  const P = (a: number, b: number, c: number): V3 => vadd(wr, vadd(vsc(d, a * k), vadd(vsc(s, b * k), vsc(n, c * k))));
  return { o: wr, d, s, n, k, P, grip: P(2.5, 0, 1.15), palm: P(1.3, 0, 0.62) };
}

/**
 * Draw a hand. `mat` paints the palm and the back of the hand, `fmat` the fingers and thumb (bare
 * fingers out of fingerless gloves); `fk` fattens the fingers (insulated gloves).
 */
export function drawHand7(s: Scene3D, wr: V3, el: V3, J: J3, near: boolean, arm: ArmP | undefined, hand: number, g: number, mat: Mat, fmat: Mat = mat, fk = 1): HandFrame {
  const H = handFrame(wr, el, J, near, arm, hand);
  const { d, n, k, P } = H;
  const sh = SHAPES[arm?.hand ?? 'relax'] ?? SHAPES.relax;
  const sv = H.s;
  // wrist: slimmer than the forearm, flaring into the heel of the hand
  s.limb(wr, P(0.45, 0, 0), 0.62 * k, 0.6 * k, g, mat);
  // palm: a flattened block (the heel and the knuckle pad)
  s.ellipsoid(P(1.25, 0.03, 0), vsc(d, 1.12 * k), vsc(sv, 1.02 * k), vsc(n, 0.52 * k), g, mat);
  s.ellipsoid(P(0.75, 0.55, 0.12), vsc(d, 0.6 * k), vsc(sv, 0.5 * k), vsc(n, 0.42 * k), g, mat);
  const fr = 0.46 * k * fk;
  const axes: [V3, V3, V3][] = [];
  const spread = (arm?.spread ?? 1) * sh.spread;
  for (let i = 0; i < 4; i++) {
    const [a1, a2] = sh.f[i];
    const sp = spread * SPL[i];
    const b0 = vnorm(vadd(vsc(d, Math.cos(sp)), vsc(sv, Math.sin(sp))));
    const bend = (a: number): V3 => vnorm(vadd(vsc(b0, Math.cos(a)), vsc(n, Math.sin(a))));
    const kn = P(KNX[i], OFF[i] * (1 + Math.max(0, spread) * 0.6), 0.06);
    const m = vadd(kn, vsc(bend(a1), LEN[i] * 0.54 * k));
    const tip = vadd(m, vsc(bend(a1 + a2), LEN[i] * 0.5 * k));
    s.limb(kn, m, fr, fr * 0.95, g, seg(fmat, 0, 0.54));
    s.limb(m, tip, fr * 0.95, fr * 0.8, g, seg(fmat, 0.54, 1));
    axes.push([kn, m, tip]);
  }
  // thumb: from the heel of the hand on the thumb side
  const tb = P(0.62, 0.86, 0.22);
  const dir = (w: V3) => vnorm(vadd(vsc(d, w[0]), vadd(vsc(sv, w[1]), vsc(n, w[2]))));
  const tm = vadd(tb, vsc(dir(sh.t1), 0.95 * k));
  const tt = vadd(tm, vsc(dir(sh.t2), 0.72 * k));
  s.limb(tb, tm, fr * 1.14, fr * 1.02, g, seg(fmat, 0, 0.56));
  s.limb(tm, tt, fr * 1.02, fr * 0.84, g, seg(fmat, 0.56, 1));
  // creases between the fingers, on the side the camera sees (lying on the nearer finger's surface)
  const cam: V3 = [0, 0, 1];
  const onTop = (p: V3, q: V3, r: number) => vadd(vsc(vadd(p, q), 0.5), vsc(cam, r));
  const done = new Set<number>();
  const gaps = sh.creases === 3 ? [0, 1, 2] : sh.creases === 1 ? [1] : [];
  for (const i of gaps) {
    const A = axes[i], B = axes[i + 1];
    s.crease(onTop(A[0], B[0], fr * 0.7), onTop(A[1], B[1], fr * 0.7), g, 0.26, 1.1, done);
    s.crease(onTop(A[1], B[1], fr * 0.6), onTop(A[2], B[2], fr * 0.5), g, 0.26, 1.1, done);
  }
  // a knuckle line over curled fingers
  if (sh.knuckles) {
    const a = vadd(axes[0][1], vsc(n, -fr * 0.3)), b = vadd(axes[3][1], vsc(n, -fr * 0.3));
    s.crease(vadd(a, vsc(cam, fr)), vadd(b, vsc(cam, fr)), g, 0.22, 1.2, done);
  }
  return H;
}

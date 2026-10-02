// Making the hands move: a library of procedural finger poses that blend smoothly, per-joint springs
// (fingers lag and overshoot, the little finger more than the index), inertia from the hand's own
// acceleration, an idle tremor and breathing, two-bone arm IK with a soft shoulder, and two contact
// solvers: closing the fingers round a handle until each phalanx touches it, and bringing the thumb
// and index pads together for a pinch. Everything here is in the hand's solver space (a right hand;
// a left hand solves in the mirror image of the world).

import { Rig, Pose, D, NDOF, LIMITS, FINGERS, THUMB, B, fdof, newPose, poseRot, wristRot, fkHand, padLocal, NB } from './rig';
import { V3, Q, Xf, qmul, qnorm, qrot, qconj, qslerp, qlook, qaxis, vadd, vsub, vscale, vdot, vlen, vnorm, vcross, vperp, vmadd, xmul, DEG, clamp } from './math3';

export type PoseName =
  | 'relaxed' | 'open' | 'spread' | 'fist' | 'grip' | 'pinch' | 'point' | 'press' | 'cup' | 'pour'
  | 'pullCord' | 'crank' | 'knot' | 'tap' | 'wave' | 'hook' | 'flat' | 'thumbsUp' | 'hold';

export interface PoseParams {
  /** grip radius (cm) for grip-like poses */
  r?: number;
  /** 0..1 how hard (tighter curls, white knuckles a little) */
  force?: number;
}

const d = (v: number) => v * DEG;
type Digits = [number, number, number, number][]; // index..little: mcp, spread, pip, dip (deg)
type ThumbA = [number, number, number, number, number]; // flex, abd, roll, mcp, ip (deg)
function build(f: Digits, t: ThumbA, cup = 0.2, wrist: [number, number, number] = [0, 0, 0]): Pose {
  const p = newPose();
  p[D.wflex] = d(wrist[0]); p[D.wdev] = d(wrist[1]); p[D.twist] = d(wrist[2]); p[D.cup] = cup;
  p[D.tflex] = d(t[0]); p[D.tabd] = d(t[1]); p[D.troll] = d(t[2]); p[D.tmcp] = d(t[3]); p[D.tip] = d(t[4]);
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) p[fdof(k, j as 0 | 1 | 2 | 3)] = d(f[k][j]);
  return p;
}

/** the static shape of each named pose (grip-like ones are refined by the wrap solver) */
export function basePose(name: PoseName, o: PoseParams = {}): Pose {
  const f = o.force ?? 0.5;
  switch (name) {
    case 'open': return build([[4, -4, 6, 4], [5, -1, 7, 4], [6, 2, 8, 5], [8, 5, 9, 6]], [4, 26, 6, 5, 4], 0.05);
    case 'flat': return build([[0, -1, 2, 0], [0, 0, 2, 0], [0, 1, 2, 0], [1, 2, 2, 0]], [0, 10, 0, 0, 0], 0);
    case 'spread': return build([[-4, -14, 3, 2], [-3, -4, 3, 2], [-3, 7, 4, 3], [-2, 17, 5, 4]], [-6, 42, 0, -4, -6], 0);
    case 'wave': return build([[-2, -12, 4, 2], [-2, -3, 4, 2], [-2, 6, 5, 3], [-1, 15, 6, 4]], [-4, 36, 2, -2, -4], 0);
    case 'fist': return build([[86 + f * 6, 0, 100, 62], [88 + f * 6, 0, 102, 64], [90 + f * 4, 0, 102, 64], [90 + f * 4, 2, 100, 62]], [34, 6, 34, 44, 34], 0.9);
    case 'point': return build([[4, -2, 6, 3], [84, 0, 98, 60], [86, 1, 100, 62], [88, 3, 98, 60]], [30, 14, 30, 34, 26], 0.8);
    case 'press': return build([[22, -2, 26, 8], [70, 0, 92, 56], [76, 1, 96, 58], [80, 3, 94, 58]], [26, 16, 28, 30, 22], 0.7);
    case 'tap': return build([[16, -2, 20, 10], [40, 0, 56, 30], [46, 1, 62, 34], [52, 3, 64, 36]], [16, 22, 18, 18, 14], 0.4);
    case 'pinch': return build([[40, -3, 48, 26], [46, 0, 58, 32], [54, 2, 64, 36], [60, 5, 66, 38]], [20, 40, 46, 22, 16], 0.45);
    case 'knot': return build([[42, -4, 54, 30], [36, 0, 46, 26], [60, 2, 70, 40], [66, 5, 72, 42]], [18, 38, 44, 24, 18], 0.5);
    case 'cup': return build([[24, 2, 24, 10], [26, 0, 26, 11], [28, -2, 27, 12], [30, -5, 28, 12]], [14, 6, 30, 10, 6], 1.0);
    case 'hold': return build([[36, -2, 42, 22], [42, 0, 48, 26], [48, 2, 52, 28], [54, 5, 54, 30]], [16, 30, 34, 18, 14], 0.5);
    case 'hook': return build([[24, 0, 96, 70], [26, 0, 98, 72], [28, 1, 98, 72], [30, 3, 96, 70]], [10, 30, 20, 10, 8], 0.6);
    case 'pullCord': return build([[56, 0, 92, 66], [58, 0, 96, 68], [62, 1, 96, 68], [66, 3, 94, 66]], [30, 14, 30, 34, 28], 0.8);
    case 'crank': return build([[44, -2, 70, 44], [56, 0, 80, 50], [66, 1, 86, 54], [72, 3, 86, 54]], [24, 30, 40, 26, 20], 0.6);
    case 'grip':
    case 'pour': return build([[54, -1, 62, 38], [58, 0, 66, 40], [62, 1, 68, 42], [66, 3, 68, 42]], [26, 26, 42, 22, 18], 0.75);
    case 'thumbsUp': return build([[88, 0, 100, 62], [90, 0, 102, 64], [90, 0, 102, 64], [90, 2, 100, 62]], [-10, 30, 0, -5, -10], 0.9);
    default: return build([[16, -3, 22, 12], [20, 0, 28, 15], [24, 3, 32, 17], [28, 7, 34, 18]], [8, 18, 12, 12, 10], 0.25);
  }
}

// ------------------------------------------------------------------ the default grip cylinder (hand space, a right hand)
/** a cylinder across the palm, from the index knuckle toward the heel of the little finger */
export function palmCylinder(rig: Rig, r: number): { a: V3; u: V3; r: number } {
  const s = rig.build.size;
  return { a: [-0.2 * s, 6.25 * s, -(1.32 * s + r)], u: vnorm([1, -0.36, 0.05]), r };
}

// ------------------------------------------------------------------ chain kinematics in hand space
/** joint positions of finger k (MCP, PIP, DIP, tip) in the hand bone's frame for pose p */
function fingerJoints(rig: Rig, k: number, p: Pose, out: V3[]) {
  const ch = FINGERS[k];
  let x: Xf = { q: [0, 0, 0, 1], t: [0, 0, 0] };
  // ring and little fingers hang off the cupping bones
  if (k >= 2) {
    const cb = k === 2 ? B.cup4 : B.cup5;
    x = { q: qnorm(qmul(rig.local[cb].q, poseRot(rig, cb, p))), t: rig.local[cb].t };
  }
  for (let j = 0; j < 3; j++) {
    const i = ch[j], l = rig.local[i];
    x = xmul(x, { q: qnorm(qmul(l.q, poseRot(rig, i, p))), t: l.t });
    out[j] = x.t;
    if (j === 2) out[3] = vadd(x.t, qrot(x.q, [0, rig.len[i], 0]));
  }
}
function thumbJoints(rig: Rig, p: Pose, out: V3[]) {
  let x: Xf = { q: [0, 0, 0, 1], t: [0, 0, 0] };
  for (let j = 0; j < 3; j++) {
    const i = THUMB[j], l = rig.local[i];
    x = xmul(x, { q: qnorm(qmul(l.q, poseRot(rig, i, p))), t: l.t });
    out[j] = x.t;
    if (j === 2) out[3] = vadd(x.t, qrot(x.q, [0, rig.len[i], 0]));
  }
}
/** a point given in chain bone i's local frame, in hand space, for pose p */
function chainPoint(rig: Rig, p: Pose, bone: number, local: V3): V3 {
  const path: number[] = [];
  for (let i = bone; i > B.hand; i = rigParent(i)) path.unshift(i);
  let x: Xf = { q: [0, 0, 0, 1], t: [0, 0, 0] };
  for (const i of path) { const l = rig.local[i]; x = xmul(x, { q: qnorm(qmul(l.q, poseRot(rig, i, p))), t: l.t }); }
  return vadd(x.t, qrot(x.q, local));
}
const PAR = [-1, 0, 1, 2, 2, 2, 5, 6, 2, 8, 9, 2, 11, 12, 3, 14, 15, 4, 17, 18];
const rigParent = (i: number) => PAR[i];

/** distance from segment ab to the infinite line through c along unit u (convex in the segment parameter) */
function segLine(a: V3, b: V3, c: V3, u: V3): number {
  const pa = vperp(vsub(a, c), u), pd = vperp(vsub(b, a), u);
  const dd = vdot(pd, pd);
  const t = dd > 1e-9 ? clamp(-vdot(pa, pd) / dd, 0, 1) : 0;
  return vlen(vmadd(pa, pd, t));
}

/**
 * Close finger k round a cylinder (hand space): each joint in turn flexes until its own segment
 * touches the surface (a binary search on the joint angle), so the fingers wrap the way they do on a
 * real handle. Writes the angles into p.
 */
export function wrapFinger(rig: Rig, k: number, p: Pose, cyl: { a: V3; u: V3; r: number }, squeeze = 0) {
  const pts: V3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let j = 0; j < 3; j++) {
    const dof = fdof(k, j === 0 ? 0 : j === 1 ? 2 : 3);
    const [lo, hi] = LIMITS[dof];
    const rad = rig.rad[FINGERS[k][j]];
    const rr = (rad[0] + rad[1]) / 2 * (1 - squeeze * 0.12);
    const hits = (ang: number) => {
      p[dof] = ang;
      fingerJoints(rig, k, p, pts);
      return segLine(pts[j], pts[j + 1], cyl.a, cyl.u) < cyl.r + rr;
    };
    let a = lo, b = hi;
    if (!hits(b)) { p[dof] = b; continue; }
    if (hits(a)) { p[dof] = a; continue; }
    for (let it = 0; it < 12; it++) { const m = (a + b) / 2; if (hits(m)) b = m; else a = m; }
    p[dof] = a;
  }
}
/** the thumb round the far side of the same cylinder: MCP and IP flex until they touch */
export function wrapThumb(rig: Rig, p: Pose, cyl: { a: V3; u: V3; r: number }) {
  const pts: V3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const dofs = [D.tflex, D.tmcp, D.tip];
  for (let j = 0; j < 3; j++) {
    const dof = dofs[j];
    const [lo, hi] = LIMITS[dof];
    const rad = rig.rad[THUMB[j]];
    const rr = (rad[0] + rad[1]) / 2;
    const hits = (ang: number) => {
      p[dof] = ang;
      thumbJoints(rig, p, pts);
      return segLine(pts[j], pts[j + 1], cyl.a, cyl.u) < cyl.r + rr;
    };
    let a = j === 0 ? p[dof] - d(12) : lo, b = hi;
    a = Math.max(lo, a);
    if (!hits(b)) { p[dof] = j === 0 ? Math.min(b, p[dof] + d(10)) : b; continue; }
    if (hits(a)) { p[dof] = a; continue; }
    for (let it = 0; it < 12; it++) { const m = (a + b) / 2; if (hits(m)) b = m; else a = m; }
    p[dof] = a;
  }
}

/** bring the thumb and index pads together at hand-space point `at` (or wherever they meet best) */
export function solvePinch(rig: Rig, p: Pose, at: V3 | null, which = 0) {
  const k = which; // the finger the thumb meets (0 index, 1 middle)
  const fd = [fdof(k, 0), fdof(k, 2), fdof(k, 1)];
  const td = [D.tflex, D.tabd, D.troll, D.tmcp, D.tip];
  const fpad = () => chainPoint(rig, p, FINGERS[k][2], padLocal(rig, FINGERS[k][2]));
  const tpad = () => chainPoint(rig, p, B.th2, [0, rig.len[B.th2] * 0.7, -rig.rad[B.th2][1] * 0.6]);
  const base = Float32Array.from(p);
  const cost = () => {
    const a = fpad(), b = tpad();
    const m = at ?? vscale(vadd(a, b), 0.5);
    // the two pads touching (a pad's width apart) and close to the target
    const gap = vlen(vsub(a, b)) - (rig.rad[FINGERS[k][2]][1] + rig.rad[B.th2][1]) * 0.75;
    let c = gap * gap * 4 + (at ? vlen(vsub(a, m)) ** 2 + vlen(vsub(b, m)) ** 2 : 0);
    for (const i of [...fd, ...td]) c += (p[i] - base[i]) ** 2 * 0.25;
    return c;
  };
  let step = d(8);
  let best = cost();
  for (let it = 0; it < 26; it++) {
    for (const i of [...fd, ...td]) {
      for (const sg of [1, -1]) {
        const old = p[i];
        p[i] = clamp(old + sg * step, LIMITS[i][0], LIMITS[i][1]);
        const c = cost();
        if (c < best) { best = c; break; }
        p[i] = old;
      }
    }
    step *= 0.82;
  }
  // the DIP follows the PIP
  p[fdof(k, 3)] = Math.max(p[fdof(k, 3)], p[fdof(k, 2)] * 0.55);
}

// ------------------------------------------------------------------ springs
/** per-digit stiffness (rad/s) and damping: the index is quickest, the little finger lags */
const OMEGA = (() => {
  const w = new Float32Array(NDOF);
  w[D.wflex] = w[D.wdev] = w[D.twist] = 20; w[D.cup] = 16;
  for (const i of [D.tflex, D.tabd, D.troll, D.tmcp, D.tip]) w[i] = 26;
  const per = [30, 27, 24, 21];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) w[fdof(k, j as 0)] = per[k] * (j === 3 ? 1.12 : 1);
  return w;
})();
const ZETA = 0.62;

export interface ArmSolve { shoulder: V3; elbow: V3; wrist: V3; handQ: Q; reach: number }

/** two-bone arm IK: elbow on the circle of solutions nearest the forearm that lines up with the hand */
export function solveArm(rig: Rig, shoulder: V3, wrist: V3, handQ: Q, pole: V3 | null): ArmSolve {
  const LU = rig.upperLen, LF = rig.foreLen;
  let S = shoulder;
  let dv = vsub(wrist, S), dl = vlen(dv);
  const maxR = (LU + LF) * 0.995, minR = Math.abs(LU - LF) + 2;
  // out of reach: the shoulder leans in (the body follows the arm)
  if (dl > maxR) { S = vsub(wrist, vscale(dv, maxR / dl)); dv = vsub(wrist, S); dl = maxR; }
  if (dl < minR) { S = vsub(wrist, vscale(vnorm(dv), minR)); dv = vsub(wrist, S); dl = minR; }
  const u = vscale(dv, 1 / dl);
  const a = (LU * LU - LF * LF + dl * dl) / (2 * dl), rho = Math.sqrt(Math.max(0, LU * LU - a * a));
  const C = vmadd(S, u, a);
  // the ideal elbow: straight back from the wrist along the forearm the hand wants
  const ideal = vsub(wrist, qrot(handQ, [0, LF, 0]));
  let toward = vperp(vsub(ideal, C), u);
  if (pole) toward = vadd(vscale(vnorm(toward), 0.6), vscale(vnorm(vperp(pole, u)), 0.8));
  if (vlen(toward) < 1e-4) toward = vperp([0, -1, 0.3], u);
  const E = vmadd(C, vnorm(toward), rho);
  return { shoulder: S, elbow: E, wrist, handQ, reach: dl / (LU + LF) };
}

/** world (solver-space) bone transforms from an arm solve and the pose */
export function poseWorld(rig: Rig, arm: ArmSolve, p: Pose, world: Xf[]) {
  const hq = qnorm(qmul(arm.handQ, wristRot(p)));
  const zHand = qrot(hq, [0, 0, 1]);
  const fy = vnorm(vsub(arm.wrist, arm.elbow));
  const fq = qlook(fy, zHand);
  const uy = vnorm(vsub(arm.elbow, arm.shoulder));
  const uq = qlook(uy, qrot(fq, [0, 0, 1]));
  world[B.upper] = { q: uq, t: arm.shoulder };
  world[B.fore] = { q: fq, t: arm.elbow };
  world[B.hand] = { q: hq, t: arm.wrist };
  fkHand(rig, p, world);
}

// ------------------------------------------------------------------ the animated hand state
export interface Handle {
  /** cylinder axis end points (solver space, cm) and radius */
  a: V3; b: V3; r: number;
}

export class HandAnim {
  readonly pose = newPose();
  readonly vel = new Float32Array(NDOF);
  readonly target = newPose();
  readonly world: Xf[] = new Array(NB).fill(0).map(() => ({ q: [0, 0, 0, 1] as Q, t: [0, 0, 0] as V3 }));
  /** pose layers: name, weight, params */
  layers: { name: PoseName; w: number; o: PoseParams }[] = [{ name: 'relaxed', w: 1, o: {} }];
  overrides = new Map<number, number>();
  // arm targets (solver space)
  shoulder: V3 = [0, -40, 30];
  wristT: V3 = [0, 0, 0];
  wristP: V3 = [0, 0, 0];
  wristV: V3 = [0, 0, 0];
  handQT: Q = [0, 0, 0, 1];
  handQ: Q = [0, 0, 0, 1];
  /** what goes to the target: an offset in hand space from the wrist (recomputed from the pose) */
  effector: 'wrist' | 'palm' | 'grip' | 'index' | 'thumb' | 'pinch' | 'knuckles' | 'middle' = 'wrist';
  effOffset: V3 = [0, 0, 0];
  follow = 16;
  pole: V3 | null = null;
  handle: Handle | null = null;
  gripR = 1.6;
  squeeze = 0;
  pinchAt: V3 | null = null;
  t = Math.random() * 100;
  private lastV: V3 = [0, 0, 0];
  private inertia: V3 = [0, 0, 0];
  private snapped = false;
  arm: ArmSolve | null = null;
  /** idle life (tremor, breathing): 0 still .. 1 normal */
  life = 1;

  constructor(readonly rig: Rig) {
    this.pose.set(basePose('relaxed'));
    this.target.set(this.pose);
  }

  /** hand space → solver space for the current hand frame */
  handPoint(p: V3): V3 { return vadd(this.world[B.hand].t, qrot(this.world[B.hand].q, p)); }

  private composeTarget() {
    const T = this.target;
    T.fill(0);
    let wsum = 0;
    for (const L of this.layers) {
      const p = basePose(L.name, L.o);
      for (let i = 0; i < NDOF; i++) T[i] += p[i] * L.w;
      wsum += L.w;
    }
    if (wsum < 1) { const r = basePose('relaxed'); for (let i = 0; i < NDOF; i++) T[i] += r[i] * (1 - wsum); wsum = 1; }
    for (let i = 0; i < NDOF; i++) T[i] /= wsum;
    // the active layer decides the contact solvers
    const main = this.layers.reduce((a, b) => (b.w > a.w ? b : a), this.layers[0]);
    const nm = main?.name;
    const solveGrip = this.handle || nm === 'grip' || nm === 'pour' || nm === 'crank' || nm === 'pullCord';
    if (solveGrip && (main?.w ?? 0) > 0.35) {
      const cyl = this.handleInHand() ?? palmCylinder(this.rig, main.o.r ?? this.gripR);
      const sq = main.o.force ?? this.squeeze;
      for (let k = 0; k < 4; k++) wrapFinger(this.rig, k, T, cyl, sq);
      if (nm !== 'pullCord') wrapThumb(this.rig, T, cyl);
    }
    if ((nm === 'pinch' || nm === 'knot' || nm === 'crank') && (main?.w ?? 0) > 0.35 && !this.handle) solvePinch(this.rig, T, this.pinchAt, 0);
    // animated poses
    const tt = this.t;
    if (nm === 'tap') { const k = Math.max(0, Math.sin(tt * 9)); T[fdof(0, 0)] += d(-14 + k * 26) * main.w; T[fdof(0, 2)] += d(k * 10) * main.w; }
    if (nm === 'wave') { T[D.wdev] += Math.sin(tt * 7) * d(24) * main.w; T[D.wflex] += Math.sin(tt * 7 + 1) * d(6) * main.w; }
    for (const [i, v] of this.overrides) T[i] = v;
  }

  /** the grip cylinder in hand space, if the hand holds a handle */
  handleInHand(): { a: V3; u: V3; r: number } | null {
    if (!this.handle) return null;
    const hq = this.handQ, hp = this.wristP;
    const inv = qconj(qnorm(qmul(hq, wristRot(this.pose))));
    const a = qrot(inv, vsub(this.handle.a, hp)), b = qrot(inv, vsub(this.handle.b, hp));
    return { a, u: vnorm(vsub(b, a)), r: this.handle.r };
  }

  /** hand-space offset of the effector for the current pose */
  effectorOffset(): V3 {
    const r = this.rig, p = this.pose, s = r.build.size;
    switch (this.effector) {
      case 'palm': return [-0.2 * s, 5.2 * s, -1.4 * s];
      case 'knuckles': return vadd(r.bind[B.m1].t, [0, -0.2 * s, 1.0 * s]);
      case 'grip': {
        const c = palmCylinder(r, this.gripR);
        return vadd(c.a, vscale(c.u, -0.4 * s));
      }
      case 'index': return chainPoint(r, p, B.i3, [0, r.len[B.i3] * 0.92, -r.rad[B.i3][1] * 0.25]);
      case 'middle': return chainPoint(r, p, B.m3, [0, r.len[B.m3] * 0.92, -r.rad[B.m3][1] * 0.25]);
      case 'thumb': return chainPoint(r, p, B.th2, [0, r.len[B.th2] * 0.9, -r.rad[B.th2][1] * 0.3]);
      case 'pinch': {
        const a = chainPoint(r, p, B.i3, padLocal(r, B.i3)), b = chainPoint(r, p, B.th2, [0, r.len[B.th2] * 0.7, -r.rad[B.th2][1] * 0.6]);
        return vscale(vadd(a, b), 0.5);
      }
      default: return [0, 0, 0];
    }
  }

  snap() { this.snapped = true; }

  update(dt: number) {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    const life = this.life;
    // ---------------------------------------------------------------- the wrist toward its target
    const wq = qnorm(qmul(this.handQT, wristRot(this.pose)));
    const off = qrot(wq, this.effectorOffset());
    const wt = vsub(this.wristT, off);
    if (this.snapped || dt <= 0) {
      this.wristP = wt; this.wristV = [0, 0, 0]; this.handQ = this.handQT; this.snapped = false;
    } else {
      const w = this.follow, k = w * w, c = 2 * w;
      const acc = vsub(vscale(vsub(wt, this.wristP), k), vscale(this.wristV, c));
      this.wristV = vmadd(this.wristV, acc, dt);
      this.wristP = vmadd(this.wristP, this.wristV, dt);
      this.handQ = qslerp(this.handQ, this.handQT, 1 - Math.exp(-dt * this.follow * 0.9));
    }
    // breathing and a faint tremor in the arm
    const br = Math.sin(this.t * 1.55) * 0.18 * life, tr = (Math.sin(this.t * 53.1) * 0.6 + Math.sin(this.t * 71.7) * 0.4) * 0.025 * life;
    const wristLive = vadd(this.wristP, [tr, br * 0.35 + tr, br * 0.2]);
    // the hand's acceleration in its own frame swings the fingers
    const a = vscale(vsub(this.wristV, this.lastV), 1 / Math.max(dt, 1e-3));
    this.lastV = [...this.wristV] as V3;
    const aLocal = qrot(qconj(this.handQ), a);
    this.inertia = vadd(vscale(this.inertia, Math.exp(-dt * 10)), vscale(aLocal, 1 - Math.exp(-dt * 10)));
    // ---------------------------------------------------------------- fingers: springs toward the composed target
    this.composeTarget();
    const T = this.target, P = this.pose, V = this.vel;
    const inZ = clamp(this.inertia[2] * 0.00035, -0.5, 0.5), inX = clamp(this.inertia[0] * 0.00025, -0.3, 0.3);
    for (let i = 0; i < NDOF; i++) {
      let tgt = T[i];
      // idle: slow drift and a physiological tremor, a little different for every joint
      if (i >= D.tflex) tgt += (Math.sin(this.t * (0.31 + i * 0.037) + i * 1.7) * d(1.4) + Math.sin(this.t * (9.3 + i * 0.41) + i) * d(0.22)) * life;
      if (i >= D.f0) tgt += (i - D.f0) % 4 === 1 ? inX : inZ * (1 + ((i - D.f0) >> 2) * 0.25);
      const w = OMEGA[i];
      const acc = w * w * (tgt - P[i]) - 2 * ZETA * w * V[i];
      V[i] += acc * dt;
      P[i] += V[i] * dt;
      const [lo, hi] = LIMITS[i];
      if (P[i] < lo) { P[i] = lo; if (V[i] < 0) V[i] = 0; }
      if (P[i] > hi) { P[i] = hi; if (V[i] > 0) V[i] = 0; }
    }
    // ---------------------------------------------------------------- arm
    this.arm = solveArm(this.rig, this.shoulder, wristLive, this.handQ, this.pole);
    poseWorld(this.rig, this.arm, P, this.world);
  }

  /** jump straight to the targets (no springs) */
  settle() {
    this.composeTarget();
    this.pose.set(this.target);
    this.vel.fill(0);
    this.snapped = true;
    this.update(0);
  }
}

/** capsules for AO: each digit bone, the palm, the forearm (solver space) */
export function digitCapsules(rig: Rig, world: Xf[]): { a: V3; b: V3; r: number; tag: number }[] {
  const out: { a: V3; b: V3; r: number; tag: number }[] = [];
  const seg = (i: number, tag: number) => {
    const a = world[i].t, b = vadd(a, qrot(world[i].q, [0, rig.len[i], 0]));
    out.push({ a, b, r: (rig.rad[i][0] + rig.rad[i][1]) * 0.5, tag });
  };
  for (let k = 0; k < 4; k++) for (const i of FINGERS[k]) seg(i, k + 1);
  for (const i of THUMB) seg(i, 0);
  const s = rig.build.size, h = world[B.hand];
  const P = (p: V3) => vadd(h.t, qrot(h.q, p));
  out.push({ a: P([-2.2 * s, 6.6 * s, -0.4 * s]), b: P([2.0 * s, 6.0 * s, -0.4 * s]), r: 1.45 * s, tag: 5 });
  out.push({ a: P([-0.2 * s, 2.2 * s, -0.3 * s]), b: P([0.1 * s, 6.4 * s, -0.3 * s]), r: 1.6 * s, tag: 5 });
  const f = world[B.fore];
  out.push({ a: vadd(f.t, qrot(f.q, [0, 4, 0])), b: vadd(f.t, qrot(f.q, [0, rig.foreLen - 1.5, 0])), r: 2.9 * rig.build.arm, tag: 6 });
  return out;
}

export { vcross };

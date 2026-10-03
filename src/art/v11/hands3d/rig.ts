// The arm and hand skeleton: 20 bones (upper arm, forearm, hand, the two cupping metacarpals of the
// ring and little fingers, the thumb's metacarpal and two phalanges, three phalanges per finger), the
// bind pose built from a character's proportions, the pose vector (25 joint angles with anatomical
// limits) and forward kinematics. Units are centimetres. A right hand in bind pose: wrist joint at the
// origin, fingers along +y, the back of the hand toward +z, the thumb toward -x (a left hand is the
// mirror image, see index.ts).

import { V3, Q, Xf, qaxis, qmul, qnorm, qrot, qlook, xmul, xinv, vadd, vsub, vnorm, vscale, vlen, xToDQ, DEG } from './math3';

export const B = {
  upper: 0, fore: 1, hand: 2, cup4: 3, cup5: 4,
  th0: 5, th1: 6, th2: 7,
  i1: 8, i2: 9, i3: 10,
  m1: 11, m2: 12, m3: 13,
  r1: 14, r2: 15, r3: 16,
  p1: 17, p2: 18, p3: 19,
} as const;
export const NB = 20;
export const PARENT = [-1, 0, 1, 2, 2, 2, 5, 6, 2, 8, 9, 2, 11, 12, 3, 14, 15, 4, 17, 18];
/** the four finger chains (index, middle, ring, little) and the thumb */
export const FINGERS = [[B.i1, B.i2, B.i3], [B.m1, B.m2, B.m3], [B.r1, B.r2, B.r3], [B.p1, B.p2, B.p3]];
export const THUMB = [B.th0, B.th1, B.th2];

// ------------------------------------------------------------------ the pose vector
export const D = {
  wflex: 0, wdev: 1, twist: 2, cup: 3,
  tflex: 4, tabd: 5, troll: 6, tmcp: 7, tip: 8,
  /** finger k (0 index .. 3 little): mcp, spread, pip, dip at 9 + 4k */
  f0: 9,
} as const;
export const NDOF = 25;
export const fdof = (k: number, j: 0 | 1 | 2 | 3) => 9 + k * 4 + j; // 0 mcp, 1 spread, 2 pip, 3 dip
export type Pose = Float32Array;
export const newPose = (): Pose => new Float32Array(NDOF);

/** joint limits in radians (flexion positive) */
export const LIMITS: [number, number][] = (() => {
  const L: [number, number][] = [];
  const d = (a: number, b: number): [number, number] => [a * DEG, b * DEG];
  L[D.wflex] = d(-75, 80); L[D.wdev] = d(-25, 38); L[D.twist] = d(-95, 95); L[D.cup] = [0, 1];
  L[D.tflex] = d(-20, 55); L[D.tabd] = d(-15, 65); L[D.troll] = d(-15, 60); L[D.tmcp] = d(-12, 65); L[D.tip] = d(-25, 88);
  for (let k = 0; k < 4; k++) {
    L[fdof(k, 0)] = d(-28, 95);
    L[fdof(k, 1)] = k === 3 ? d(-28, 22) : d(-20, 20);
    L[fdof(k, 2)] = d(-6, 112);
    L[fdof(k, 3)] = d(-14, 88);
  }
  return L;
})();
export function clampPose(p: Pose) {
  for (let i = 0; i < NDOF; i++) { const [a, b] = LIMITS[i]; if (p[i] < a) p[i] = a; else if (p[i] > b) p[i] = b; }
}

// ------------------------------------------------------------------ proportions
export interface Build {
  /** overall hand size vs the reference man's hand (an 18.8 cm hand = 1) */
  size: number;
  /** palm breadth factor */
  breadth: number;
  /** finger length factor */
  fingers: number;
  /** finger girth factor */
  girth: number;
  /** forearm girth factor */
  arm: number;
  /** elbow to wrist and shoulder to elbow, cm */
  foreLen: number;
  upperLen: number;
  /** knuckle, tendon and wrist-bone prominence (0 soft .. 1.5 bony) */
  bony: number;
  /** how much the veins stand out (0..1.5) */
  veins: number;
  /** muscle in the forearm (0..1.5) */
  muscle: number;
}

/** finger segment lengths (proximal, middle, distal incl. the pad), cm, for the reference hand */
const FLEN = [[4.15, 2.45, 2.2], [4.6, 2.85, 2.3], [4.3, 2.75, 2.25], [3.45, 2.0, 2.05]];
/** finger radii at the knuckle and at the tip */
const FRAD = [[0.98, 0.69], [1.0, 0.71], [0.93, 0.67], [0.82, 0.6]];
/** knuckle (MCP joint centre) positions and the fingers' splay (deg, + toward the little finger) */
const MCP: V3[] = [[-3.0, 9.0, 0.0], [-1.0, 9.35, 0.05], [0.98, 8.95, 0.0], [2.78, 8.1, -0.12]];
const SPLAY = [-6.5, -1, 4.5, 11];
/** flexion axis tilt per finger (deg): flexed fingers converge toward the thumb's base */
export const FTILT = [2, -2, -7, -13];

export interface Rig {
  build: Build;
  /** bind pose world transforms (bone frames: +y along the bone, +z dorsal) */
  bind: Xf[];
  /** bind transforms relative to the parent */
  local: Xf[];
  invBind: Xf[];
  /** bone lengths (to the next joint or the fingertip) */
  len: number[];
  /** bone radii at the head and the tail (for capsules: AO, the grip solver, contact) */
  rad: [number, number][];
  /** the forearm and upper arm lengths */
  foreLen: number;
  upperLen: number;
  /** the cupping axes (local to the hand bone) for the ring and little metacarpals */
  cupAxis: [V3, V3];
  /** the thumb's carpometacarpal axes in the metacarpal's own frame: flexion swings it across the
   *  palm (about the palm's normal), abduction lifts it out of the palm's plane */
  thumbAx: { flex: V3; abd: V3 };
}

export function makeRig(b: Build): Rig {
  const s = b.size, bw = b.breadth, fl = b.fingers;
  const bind: Xf[] = [];
  const len: number[] = new Array(NB).fill(0);
  const rad: [number, number][] = new Array(NB).fill(0).map(() => [1, 1] as [number, number]);
  const set = (i: number, head: V3, dirY: V3, zHint: V3 = [0, 0, 1]) => { bind[i] = { q: qlook(dirY, zHint), t: head }; };
  // the arm: shoulder below the elbow below the wrist, all straight along +y
  const LF = b.foreLen, LU = b.upperLen;
  set(B.upper, [0, -LF - LU, 0], [0, 1, 0]); len[B.upper] = LU; rad[B.upper] = [4.8 * b.arm, 4.2 * b.arm];
  set(B.fore, [0, -LF, 0], [0, 1, 0]); len[B.fore] = LF; rad[B.fore] = [4.0 * b.arm, 2.6 * b.arm];
  set(B.hand, [0, 0, 0], [0, 1, 0]); len[B.hand] = 9.2 * s; rad[B.hand] = [2.4 * s * bw, 2.9 * s * bw];
  // the cupping bones sit at the ring and little carpometacarpal joints
  const cmc4: V3 = [0.8 * s * bw, 2.35 * s, 0], cmc5: V3 = [1.85 * s * bw, 2.05 * s, -0.1 * s];
  set(B.cup4, cmc4, [0.03, 1, 0]); len[B.cup4] = 6 * s; rad[B.cup4] = [1, 1];
  set(B.cup5, cmc5, [0.18, 1, 0]); len[B.cup5] = 5.6 * s; rad[B.cup5] = [1, 1];
  // fingers
  for (let k = 0; k < 4; k++) {
    const head: V3 = [MCP[k][0] * s * bw, MCP[k][1] * s, MCP[k][2] * s];
    const a = SPLAY[k] * DEG, dir: V3 = [Math.sin(a), Math.cos(a), 0];
    const segs = FLEN[k].map(v => v * s * fl);
    const r0 = FRAD[k][0] * s * b.girth, r1 = FRAD[k][1] * s * b.girth;
    let p = head;
    let acc = 0;
    const tot = segs[0] + segs[1] + segs[2];
    for (let j = 0; j < 3; j++) {
      const i = FINGERS[k][j];
      set(i, p, dir);
      len[i] = segs[j];
      rad[i] = [r0 + (r1 - r0) * (acc / tot), r0 + (r1 - r0) * ((acc + segs[j]) / tot)];
      acc += segs[j];
      p = vadd(p, vscale(dir, segs[j]));
    }
  }
  // thumb: out from the base of the palm on the radial side, its nail turned to face sideways
  const tcmc: V3 = [-1.85 * s * bw, 1.65 * s, -0.55 * s];
  const d0 = vnorm([-0.56, 0.8, -0.26]), d1 = vnorm([-0.4, 0.88, -0.25]), d2 = vnorm([-0.33, 0.9, -0.28]);
  // the thumbnail faces mostly sideways (radially), so the thumb curls across the palm when it bends
  const tz = (d: V3) => vnorm(vsub([-0.86, 0.0, 0.5], vscale(d, -0.86 * d[0] + 0.5 * d[2])));
  const tl = [4.5 * s, 3.25 * s * fl, 2.75 * s * fl];
  const tr: [number, number][] = [[1.55 * s * b.girth, 1.12 * s * b.girth], [1.12 * s * b.girth, 0.92 * s * b.girth], [0.92 * s * b.girth, 0.76 * s * b.girth]];
  set(B.th0, tcmc, d0, tz(d0)); len[B.th0] = tl[0]; rad[B.th0] = tr[0];
  const tm = vadd(tcmc, vscale(d0, tl[0]));
  set(B.th1, tm, d1, tz(d1)); len[B.th1] = tl[1]; rad[B.th1] = tr[1];
  const ti = vadd(tm, vscale(d1, tl[1]));
  set(B.th2, ti, d2, tz(d2)); len[B.th2] = tl[2]; rad[B.th2] = tr[2];

  const local: Xf[] = [], invBind: Xf[] = [];
  for (let i = 0; i < NB; i++) {
    invBind[i] = xinv(bind[i]);
    local[i] = PARENT[i] < 0 ? bind[i] : xmul(xinv(bind[PARENT[i]]), bind[i]);
  }
  // the 4th and 5th metacarpals fold toward the palm about axes running across their bases, slanted
  const cupAxis: [V3, V3] = [vnorm([0.92, -0.38, 0]), vnorm([0.8, -0.6, 0])];
  const lq = local[B.th0].q, inv: Q = [-lq[0], -lq[1], -lq[2], lq[3]];
  const thumbAx = { flex: qrot(inv, vnorm([0.1, 0.12, -1])), abd: qrot(inv, vnorm([-0.82, -0.57, 0.05])) };
  return { build: b, bind, local, invBind, len, rad, foreLen: LF, upperLen: LU, cupAxis, thumbAx };
}

// ------------------------------------------------------------------ forward kinematics
const ROT_X: V3 = [1, 0, 0], ROT_Y: V3 = [0, 1, 0], ROT_Z: V3 = [0, 0, 1];
const TILT_AX: V3[] = FTILT.map(t => [Math.cos(t * DEG), Math.sin(t * DEG), 0]);

/** the local pose rotation of bone i for the pose vector p */
export function poseRot(rig: Rig, i: number, p: Pose): Q {
  switch (i) {
    case B.cup4: return qaxis(rig.cupAxis[0], -p[D.cup] * 9 * DEG);
    case B.cup5: return qaxis(rig.cupAxis[1], -p[D.cup] * 19 * DEG);
    case B.th0: return qnorm(qmul(qmul(qaxis(rig.thumbAx.flex, p[D.tflex]), qaxis(rig.thumbAx.abd, p[D.tabd])), qaxis(ROT_Y, p[D.troll])));
    case B.th1: return qaxis(ROT_X, -p[D.tmcp]);
    case B.th2: return qaxis(ROT_X, -p[D.tip]);
  }
  for (let k = 0; k < 4; k++) {
    const ch = FINGERS[k];
    if (i === ch[0]) return qnorm(qmul(qaxis(ROT_Z, -p[fdof(k, 1)]), qaxis(TILT_AX[k], -p[fdof(k, 0)])));
    if (i === ch[1]) return qaxis(TILT_AX[k], -p[fdof(k, 2)]);
    if (i === ch[2]) return qaxis(TILT_AX[k], -p[fdof(k, 3)]);
  }
  return [0, 0, 0, 1];
}

/** the wrist's own rotation from the pose vector (flexion, deviation, twist), local to the hand */
export function wristRot(p: Pose): Q {
  return qnorm(qmul(qmul(qaxis(ROT_Y, p[D.twist]), qaxis(ROT_Z, -p[D.wdev])), qaxis(ROT_X, -p[D.wflex])));
}

/**
 * Fill world transforms for the hand's bones from the hand bone's world transform and the pose vector.
 * world[B.upper], world[B.fore] and world[B.hand] must be set first (the arm IK does that).
 */
export function fkHand(rig: Rig, p: Pose, world: Xf[]) {
  for (let i = B.cup4; i < NB; i++) {
    const par = world[PARENT[i]], l = rig.local[i];
    world[i] = xmul(par, { q: qnorm(qmul(l.q, poseRot(rig, i, p))), t: l.t });
  }
}

/** a point given in bone i's bind-local frame, in world space */
export const boneLocal = (world: Xf[], i: number, p: V3): V3 => vadd(world[i].t, qrot(world[i].q, p));
/** the tip of bone i (the joint at its far end) */
export const boneTip = (rig: Rig, world: Xf[], i: number): V3 => boneLocal(world, i, [0, rig.len[i], 0]);

/** skinning: the dual quaternion of every bone (world * inverse bind), 8 floats each */
export function skinDQ(rig: Rig, world: Xf[], out: Float32Array) {
  for (let i = 0; i < NB; i++) xToDQ(xmul(world[i], rig.invBind[i]), out, i * 8);
}

/** fingertip pad (bone-local) of chain bone i: a little in from the end, on the palm side */
export const padLocal = (rig: Rig, i: number): V3 => [0, rig.len[i] * 0.72, -rig.rad[i][1] * 0.55];

export const vlenSafe = (v: V3) => vlen(v) || 1e-9;

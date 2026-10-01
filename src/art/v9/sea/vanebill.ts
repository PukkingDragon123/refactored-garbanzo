// Fluting Vanebill: the great glider of the Kittiwake's seas. A white-bodied ocean wanderer with a
// sooty saddle and upperwings, a tall bony keel ("vane") standing on its hooked bill, paired tube
// nostrils that end in flute holes (they whistle as it turns into the wind) and wings with THREE
// locking joints (elbow, wrist and an extra knuckle), each marked by a horny hinge spur on the
// leading edge. On the water the wings fold into a Z-pack along the back.
//
// Flight anims face right with the body centre as anchor; 'bank' runs from underside (frame 0) to
// back (last frame) so the game can roll it through a soaring loop. Water anims anchor on the
// waterline under the body.

import { Sk, V2, V3, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh } from '../../beasts-core';
import { hex } from '../../color';
import { View3, WingShape, WingPose, wing3, body3, ball3, plate3, rows } from './seabird';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const VANEBILL_BANK = 9;
const ANIMS: Record<string, AnimDef> = {
  idle: A(2, 2),
  glide: A(3, 3),
  bank: A(VANEBILL_BANK, 1),
  flap: A(6, 7),
  flute: A(2, 4),
  snatch: A(3, 7, false),
  land: A(3, 6, false),
  sit: A(4, 2),
  takeoff: A(6, 9),
  display: A(4, 4),
};
/** bank angle of each 'bank' frame (- underside .. + back) */
export const vanebillBankAngle = (f: number) => -1.05 + (f / (VANEBILL_BANK - 1)) * 2.1;

const EYE: EyeSpec = { r: 0.9, iris: hex('#2a1a14'), lash: hex('#2a2426'), ring: hex('#8fc4d4'), brow: hex('#4e4648') };

function mats(sk: Sk) {
  return {
    white: sk.m(rmp('#f1eee6', { n: 6, dark: 0.34, light: 0.6, at: 3 }), { edge: 1 }),
    saddle: sk.m(rmp('#8c847e', { n: 6, dark: 0.55 }), { edge: 1 }),
    brow: sk.m(rmp('#6e6666', { n: 5, dark: 0.5 }), { edge: 1 }),
    wing: sk.m(rmp('#342c2b', { n: 6, dark: 0.6, light: 0.36 }), { edge: 2 }),
    cov: sk.m(rmp('#62564e', { n: 6, dark: 0.58, light: 0.42 }), { edge: 2 }),
    mirror: sk.m(rmp('#bdb2a6', { n: 5, dark: 0.45 }), { edge: 1 }),
    lining: sk.m(rmp('#f5f2eb', { n: 5, dark: 0.3, at: 3 }), { edge: 1, bias: 0.22 }),
    under: sk.m(rmp('#cfc9c1', { n: 5, dark: 0.4 }), { edge: 1, bias: 0.16 }),
    margin: sk.m(rmp('#342e2e', { n: 5, dark: 0.5 }), { edge: 1, bias: 0.1 }),
    tip: sk.m(rmp('#211d1e', { n: 4, dark: 0.5, light: 0.3 }), { edge: 1 }),
    spur: sk.m(rmp('#eadbb8', { n: 4, dark: 0.45 }), { edge: 0, spec: 0.3 }),
    tailT: sk.m(rmp('#7a736e', { n: 5, dark: 0.55 }), { edge: 1 }),
    tailTip: sk.m(rmp('#2c2728', { n: 4, dark: 0.5 }), { edge: 1 }),
    bill: sk.m(rmp('#d9d2c8', { n: 5, dark: 0.45, light: 0.5 }), { spec: 0.4, edge: 1 }),
    hook: sk.m(rmp('#8a8e98', { n: 5, dark: 0.5 }), { spec: 0.45 }),
    keel: sk.m(rmp('#ea7a40', { n: 5, dark: 0.45, light: 0.5 }), { spec: 0.35, edge: 1 }),
    keelRim: sk.m(rmp('#f6dc86', { n: 4, dark: 0.35 }), { edge: 0 }),
    tube: sk.m(rmp('#c9bfb4', { n: 4, dark: 0.45 }), { spec: 0.3 }),
    hole: sk.m(rmp('#3a2020', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
    mouth: sk.m(rmp('#b0546a', { n: 3, dark: 0.45 }), { edge: 0 }),
    foot: sk.m(rmp('#d9b6c4', { n: 4, dark: 0.45 }), { edge: 1 }),
    web: sk.m(rmp('#c89aac', { n: 4, dark: 0.45 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

// wing: humerus, forearm, the extra "vane-hand" segment and the pointed primaries
const WING: WingShape = {
  sh: [2.2, 1.4, 2.4],
  segs: [
    { len: 7.5, sweep: -0.2, dih: 0.06, flex: -0.55, shrink: 0.15 },
    { len: 10.5, sweep: 0.2, dih: 0.1, flex: 0.95, shrink: 0.2 },
    { len: 9.5, sweep: -0.1, dih: 0.03, flex: -1.1, shrink: 0.3 },
    { len: 10, sweep: -0.42, dih: -0.03, flex: 0.5, shrink: 0.35 },
  ],
  chord: [6.6, 7, 6, 4.8, 0.6],
  spar: 0.75,
};

interface Pose {
  sit: boolean;
  bank: number; pitch: number; yaw: number;
  wings: [WingPose, WingPose];
  neck: number;     // head raised (+) / lowered (-) px
  headA: number;    // bill angle (+ down)
  open: number;     // bill open 0..1
  tail: number;     // tail cock (+ up)
  fan: number;      // tail spread
  feet: 'tuck' | 'brake' | 'run' | 'none';
  run: number;      // takeoff foot phase
  bob: number;
  sky: number;      // sky-pointing display: folded wings lifted (0..1)
  eye?: BeastEye;
}
const W0 = (elev: number, hand = 0, flex = 0, sweep = 0): WingPose => ({ elev, hand, flex, sweep });
const base = (): Pose => ({
  sit: false, bank: -0.3, pitch: 0.02, yaw: 0.34,
  wings: [W0(0.04), W0(0.04)], neck: 0, headA: 0.06, open: 0, tail: 0, fan: 1,
  feet: 'tuck', run: 0, bob: 0, sky: 0,
});

/** heavy flap at phase t (0 = top of the upstroke) */
function flap(t: number, amp = 1): [WingPose, WingPose] {
  const c = Math.cos(t * TAU);
  const up = t > 0.5;
  const w = W0((0.12 + 0.62 * c) * amp, (-0.3 * Math.sin(t * TAU) + (up ? 0.2 : -0.06)) * amp, up ? 0.55 * Math.sin((t - 0.5) * TAU) : 0.02, up ? -0.1 : 0.04);
  return [w, { ...w }];
}

function pose(anim: string, f: number, n: number): Pose {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
    case 'glide':
      // the three joints locked into a shallow crank: elbow forward, knuckle back
      p.bank = -0.42 + (anim === 'idle' ? 0 : [0, 0.05, -0.04][f]);
      p.wings = [W0(0.05 + (f === 1 ? 0.03 : 0), f === 2 ? -0.04 : 0.02, 0.22), W0(0.05, f === 1 ? 0.04 : 0, 0.22)];
      p.fan = 1.1;
      break;
    case 'bank':
      p.bank = vanebillBankAngle(f);
      p.wings = [W0(0.04, 0.02, 0.05), W0(0.06, 0.02, 0.05)];
      p.fan = 1.2;
      p.tail = p.bank * 0.1;
      break;
    case 'flap':
      p.bank = -0.28;
      p.wings = flap(t, 1);
      p.pitch = 0.05 + Math.sin(t * TAU) * 0.03;
      p.fan = 1.15;
      break;
    case 'flute':
      // gliding into the wind with the bill slightly open: the tube nostrils whistle
      p.bank = -0.36;
      p.wings = [W0(0.1, 0.06, 0.12), W0(0.1, 0.06, 0.12)];
      p.open = f ? 0.55 : 0.3;
      p.headA = -0.14;
      p.neck = 0.5;
      break;
    case 'snatch':
      // wings raised back, head and bill thrown down at something on the surface
      p.bank = -0.18;
      p.pitch = [-0.1, -0.28, -0.12][f];
      p.wings = [W0([0.75, 0.95, 0.6][f], 0.25, 0.35, -0.2), W0([0.75, 0.95, 0.6][f], 0.25, 0.35, -0.2)];
      p.neck = [-1, -2.4, -1.4][f];
      p.headA = [0.6, 1.05, 0.7][f];
      p.open = [0.4, 1, 0.2][f];
      p.feet = 'brake';
      p.fan = 1.5; p.tail = -0.2;
      break;
    case 'land':
      p.bank = -0.2;
      p.pitch = [0.28, 0.45, 0.35][f];
      p.wings = [0, 1].map(() => W0([0.5, 0.85, 1.1][f], [0.2, 0.3, -0.2][f], [0.2, 0.35, 0.7][f], -0.25)) as [WingPose, WingPose];
      p.feet = 'brake';
      p.fan = 1.7; p.tail = 0.25;
      break;
    case 'takeoff':
      // pattering across the swell: huge flaps, feet slapping the water
      p.bank = -0.22;
      p.pitch = 0.18;
      p.wings = flap(t, 1.15);
      p.feet = 'run';
      p.run = t;
      p.fan = 1.4; p.tail = 0.15;
      break;
    case 'sit':
      p.sit = true;
      p.bank = 0; p.yaw = 0.2; p.pitch = 0.04;
      p.bob = Math.sin(t * TAU) * 0.5;
      p.headA = [0.08, 0.02, -0.06, 0.04][f];
      p.neck = [0, 0.3, 0.5, 0.2][f];
      p.tail = 0.35;
      p.feet = 'none';
      break;
    case 'display':
      // sky-pointing: bill to the sky, the Z-folded wings lifted to show off the joints, fluting
      p.sit = true;
      p.bank = 0; p.yaw = 0.2; p.pitch = 0.12;
      p.sky = [0.6, 1, 1, 0.8][f];
      p.neck = 2.2; p.headA = -1.25 + [0.15, 0, -0.08, 0.05][f];
      p.open = [0, 0.4, 0.8, 0.3][f];
      p.tail = 0.55; p.fan = 1.5;
      p.feet = 'none';
      break;
  }
  return p;
}

// ------------------------------------------------------------------ drawing
function wingFill(M: M) {
  return (p: Px, s: number, c: number, top: boolean): number => {
    // trailing edge: secondaries end in soft scallops on the arm, the hand is a clean pointed blade
    if (s < 0.62 && c > 0.9) {
      const notch = Math.abs(((s * 26) % 1) - 0.5) * 2;
      if (c > 0.9 + notch * 0.12) return 0;
    }
    if (top) {
      p.l += rows(s * 30 + c * 2, 1, 0.18) * 0.6;
      // pale knuckle mirror on the vane-hand, dark primaries, dusky coverts toward the leading edge
      if (s > 0.5 && s < 0.66 && c > 0.25 && c < 0.7) return M.mirror;
      if (s > 0.74) return M.tip;
      if (c < 0.32 + (s < 0.5 ? 0.08 : 0)) return M.cov;
      return M.wing;
    }
    // underwing: white lining with a black leading edge band, broad dark trailing edge and tip
    if (s > 0.8) return M.tip;
    if (c < 0.11 + s * 0.05) return M.margin;
    if (c > 0.78 - s * 0.35) { p.l += rows(s * 26, 1, 0.25) * 0.5; return s > 0.55 ? M.margin : M.under; }
    return M.lining;
  };
}

/** the horny hinge spurs on the leading edge at the wrist and the knuckle */
function spurs(sk: Sk, V: View3, M: M, le: V3[]) {
  for (const i of [2, 3]) {
    const a = le[i];
    const b: V3 = [a[0] + 1.9, a[1] + 0.25, a[2]];
    const pa = V.s(a), pb = V.s(b);
    sk.blade(pa[0], pa[1], pb[0], pb[1], s => (1 - s) * 0.7 * V.k + 0.25, M.spur, { z0: pa[2] + 0.8, z1: pb[2] + 0.8 });
  }
}

function drawFlight(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const wf = wingFill(M);
  // far wing first
  const fw = wing3(sk, V, WING, P.wings[1], -1, wf, { bias: -0.12, spar: top => (top ? M.cov : M.margin) });
  spurs(sk, V, M, fw.le);
  // feet: tucked with the toes just past the tail (a tubenose trait), thrown forward to brake, or running
  const drawFoot = (side: 1 | -1) => {
    sk.np();
    const hip: V3 = [-3.5, -1.8, side * 1.4];
    let toe: V3;
    if (P.feet === 'tuck') toe = [-11.2, -0.9, side * 1.2];
    else if (P.feet === 'brake') toe = [2.5, -8.5, side * 2.8];
    else {
      const ph = P.run + (side > 0 ? 0 : 0.5);
      toe = [-2 + Math.cos(ph * TAU) * 4, -9 + Math.max(0, Math.sin(ph * TAU)) * 2.5, side * 2];
    }
    const a = V.s(hip), b = V.s(toe);
    sk.tube([[a[0], a[1]], [b[0], b[1]]], 0.62, M.foot, { z: t => a[2] + (b[2] - a[2]) * t, bias: side < 0 ? -0.12 : 0 });
    // webbed foot fanned open
    const w1: V3 = P.feet === 'tuck' ? [-12.8, -0.6, side * 1.9] : [toe[0] + 1.6, toe[1] - 0.6, toe[2] + side * 1.4];
    const w2: V3 = P.feet === 'tuck' ? [-12.9, -1.3, side * 0.5] : [toe[0] + 1.8, toe[1] + 0.4, toe[2] - side * 1];
    plate3(sk, V, [toe, w1, w2], () => M.web, [0, 1, 0]);
  };
  // tucked feet only show from below
  const feet = P.feet !== 'none' && (P.feet !== 'tuck' || P.bank < -0.45);
  if (feet) drawFoot(-1);
  // tail: short wedge fan in the horizontal plane
  sk.np();
  const tl = 5.6 * P.fan ** 0.3, tw = 2.4 * P.fan;
  const ct = Math.cos(P.tail), stl = Math.sin(P.tail);
  const T = (x: number, z: number): V3 => [-7 + x * ct, 0.3 - x * stl, z];
  plate3(sk, V, [T(0.5, 1.6), T(-tl * 0.85, tw), T(-tl, 0), T(-tl * 0.85, -tw), T(0.5, -1.6)], (p, top) => {
    if (p.v > 0.72 || p.u > 0.8) return M.tailTip;
    return top ? M.tailT : M.white;
  }, [0, 1, 0]);
  // body: white, with the sooty saddle over the back
  sk.np();
  body3(sk, V, [[-8, 0.5, 0], [-4, 0.1, 0], [0, -0.1, 0], [3.8, 0.2, 0], [6.2, 0.8 + P.neck * 0.3, 0]],
    t => (t < 0.42 ? 2.3 + t * 4.4 : 4.15 - (t - 0.42) * 1.6), (p, nb) => {
      if (nb[1] > 0.55 - (p.x < 2 ? 0 : 0.25)) return M.saddle;
      return M.white;
    });
  const bodyPart = sk.pid;
  sk.tufts(bodyPart, (_x, _y, _nx, ny) => (ny > 0.4 ? [-0.4, 1] as V2 : null), { every: 4, len: 1 });
  // head and bill
  const hc: V3 = [8.6, 1.3 + P.neck, 0];
  const hd = drawHead(sk, V, M, hc, P, eye);
  // near wing and foot
  if (feet) drawFoot(1);
  const nw = wing3(sk, V, WING, P.wings[0], 1, wf, { spar: top => (top ? M.cov : M.margin) });
  spurs(sk, V, M, nw.le);
  return hd;
}

function drawHead(sk: Sk, V: View3, M: M, hc: V3, P: Pose, eye: BeastEye) {
  sk.np();
  // thick neck
  const nb = V.s([5.2, 0.7, 0]), nh = V.s(hc);
  sk.tube([[nb[0], nb[1]], [nh[0], nh[1]]], t => (3.3 - t * 0.5) * V.k, M.white, { z: t => nb[2] + (nh[2] - nb[2]) * t });
  ball3(sk, V, hc, 3.15, (p, n) => {
    // dusky brow smudge over and behind the eye ("the stern look")
    if (n[1] > 0.05 && n[1] < 0.75 && n[0] < 0.5 && n[0] > -0.75 && n[2] > 0.2) return M.brow;
    return M.white;
  });
  // head-local frame: x along the bill, y DOWN; headA tips the bill down (+)
  const ha = P.headA, ca = Math.cos(ha), sa = Math.sin(ha);
  const Hp = (x: number, y: number, z = 0): V3 => [hc[0] + x * ca - y * sa, hc[1] - x * sa - y * ca, z];
  const open = P.open;
  // lower mandible (behind the upper)
  sk.np();
  const lo: V3[] = [Hp(2.1, 1.0), Hp(6, 1.05 + open * 1.4), Hp(9.8, 0.95 + open * 3)];
  const los = lo.map(q => V.s(q));
  sk.tube(los.map(q => [q[0], q[1]] as V2), t => (1.05 - t * 0.4) * V.k, M.bill, { z: t => los[0][2] + (los[2][2] - los[0][2]) * t + 0.6, bias: -0.12 });
  if (open > 0.2) {
    const m0 = V.s(Hp(2.4, 0.55)), m1 = V.s(Hp(8.6, 0.5 + open * 1.6));
    sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.3, Math.max(m0[2], m1[2]) + 2, true);
  }
  // upper mandible: long, plated, ending in a deep dark hook
  sk.np();
  const up: V3[] = [Hp(2.2, -0.35), Hp(6, -0.3), Hp(9.4, -0.1), Hp(10.8, 0.25)];
  const ups = up.map(q => V.s(q));
  sk.tube(ups.map(q => [q[0], q[1]] as V2), t => (1.35 - t * 0.6) * V.k, p => (p.t > 0.84 ? M.hook : M.bill), { z: t => ups[0][2] + (ups[3][2] - ups[0][2]) * t + 1 });
  const hk0 = V.s(Hp(10.4, -0.2)), hk1 = V.s(Hp(11.1, 1.6));
  sk.blade(hk0[0], hk0[1], hk1[0], hk1[1], s => (1 - s) * 0.95 * V.k + 0.3, M.hook, { z0: hk0[2] + 1.2, z1: hk1[2] + 1.2 });
  // the vane: a thin coral keel standing on the culmen like a sail, taller than the crown
  sk.np();
  const keel = [Hp(3.5, -1.0), Hp(4.2, -4.3), Hp(5.2, -6.5), Hp(6.5, -6.2), Hp(7.8, -3.4), Hp(8.8, -0.9)];
  plate3(sk, V, keel, (p) => {
    // bony growth ridges fanning up the plate
    p.l += rows(p.u * 5 + p.v * 2.4, 1, 0.3) * 0.9 + 0.04;
    return M.keel;
  }, [0, 0, 1], { zb: 0.8 });
  const rim = keel.slice(1, 5).map(q => V.s2(q));
  sk.tube(rim, 0.5 * V.k, M.keelRim, { z: V.s(keel[2])[2] + 1.4 });
  // paired tube nostrils along the keel's foot, ending in dark flute holes
  sk.np();
  for (const zs of [-0.62, 0.62]) {
    const t0 = V.s(Hp(2.5, -0.8, zs)), t1 = V.s(Hp(4.8, -1.05, zs));
    sk.tube([[t0[0], t0[1]], [t1[0], t1[1]]], 0.66 * V.k, M.tube, { z: t => t0[2] + (t1[2] - t0[2]) * t + 1.6 });
    if (zs > 0) sk.dot(t1[0] + 0.4, t1[1], M.hole, 0.2, t1[2] + 3, true);
  }
  // eye (near side of the head only)
  const ev = Hp(0.55, -0.55, 2.55);
  let ep: V2 = V.s2(ev);
  if (V.faces([0.3, 0.1, 1], 0.05)) ep = drawEye(sk, ep[0], ep[1], EYE, P.eye ?? eye);
  const top = V.s2([hc[0], hc[1] + 6, 0]);
  return { head: top, eye: ep };
}

// ------------------------------------------------------------------ on the water
function drawWater(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  // anchor = waterline under the body; the hull floats half sunk
  const V = new View3(0, P.pitch, P.yaw, [0, -3.6 + P.bob], 1);
  sk.clipY = 0.6;
  // tail cocked up out of the water
  sk.np();
  const ct = Math.cos(P.tail), st = Math.sin(P.tail);
  const T = (x: number, z: number): V3 => [-7 + x * ct, 0.6 - x * st, z];
  plate3(sk, V, [T(0.5, 1.4), T(-4.6, 2.2 * P.fan), T(-5.6, 0), T(-4.6, -2.2 * P.fan), T(0.5, -1.4)], (p, top) => (p.v > 0.7 ? M.tailTip : top ? M.tailT : M.white), [0, 1, 0]);
  foldPack(sk, V, M, -1, P);
  sk.np();
  body3(sk, V, [[-8, 0.8, 0], [-4, 0.2, 0], [0, 0, 0], [4, 0.3, 0], [6.4, 1.2 + P.neck * 0.25, 0]],
    t => (t < 0.45 ? 2.4 + t * 3.8 : 4.1 - (t - 0.45) * 2), (_p, nb) => (nb[1] > 0.5 ? M.saddle : M.white));
  sk.tufts(sk.pid, (_x, _y, nx, ny) => (ny < -0.4 && nx < 0.3 ? [-0.5, -0.8] as V2 : null), { every: 4, len: 1 });
  foldPack(sk, V, M, 1, P);
  const hd = drawHead(sk, V, M, [8.4, 2.6 + P.neck, 0], P, eye);
  // wake ripples around the waterline
  sk.clipY = Infinity;
  for (let x = -12; x <= 12; x++) if (hh(x, 3, 11) > 0.35) sk.over(x, 0, hex('#dff1f6'));
  sk.over(-13, 1, hex('#bfe0ea')); sk.over(13, 1, hex('#bfe0ea'));
  return hd;
}

/** the Z-folded wing: three stacked layers along the back, hinge spurs at the folds, tips crossed over the tail */
function foldPack(sk: Sk, V: View3, M: M, side: 1 | -1, P: Pose) {
  const z = side * 3.1;
  const lift = P.sky;
  const layers: [V3, V3, number, number][] = [
    // [front, back, half width, material]
    [[4.6, 2.4 + lift * 1.5, z], [-9.5, 3.0 + lift * 4, z], 1.55, M.wing],
    [[3.6, 3.3 + lift * 3, z * 0.95], [-7, 3.4 + lift * 6.5, z * 0.95], 1.2, M.cov],
    [[2.8, 4.0 + lift * 5, z * 0.9], [-12.5, 4.6 + lift * 9, z * 0.85], 1.05, M.tip],
  ];
  layers.forEach(([a, b, w, m], i) => {
    const pa = V.s(a), pb = V.s(b);
    sk.np();
    sk.blade(pa[0], pa[1], pb[0], pb[1], s => (s < 0.12 ? 0.6 + s * 6 : 1 - Math.pow(Math.max(0, s - 0.55) / 0.45, 1.3) * 0.75) * w * V.k,
      (p) => { p.l += rows(p.t * 9, 1, 0.2) * 0.5; return m; }, { z0: pa[2] + 1 + i * 0.6 * side, z1: pb[2] + 1 + i * 0.6 * side, bias: side < 0 ? -0.12 : 0 });
    // hinge spur at each fold
    if (i < 2 && side > 0) {
      const s0 = V.s([a[0] + 0.2, a[1] + 0.4, a[2]]), s1 = V.s([a[0] + 1.8, a[1] + 1.1 + lift, a[2]]);
      sk.blade(s0[0], s0[1], s1[0], s1[1], s => (1 - s) * 0.6 + 0.25, M.spur, { z0: s0[2] + 3, z1: s1[2] + 3 });
    }
  });
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye): { head: V2; eye: V2 } {
  const n = ANIMS[anim]?.frames ?? 1;
  const M = mats(sk);
  const P = pose(anim, frame, n);
  return P.sit ? drawWater(sk, M, P, eye) : drawFlight(sk, M, P, eye);
}

const AIR = ['idle', 'glide', 'bank', 'flap', 'flute', 'snatch', 'land', 'takeoff'];
export const VANEBILL: SpeciesDef = {
  name: 'Fluting Vanebill', kind: 'bird', len: 24, height: 14,
  anims: ANIMS,
  canvas: (anim) => (AIR.includes(anim) ? { w: 104, h: 84, ox: 52, oy: 42 } : { w: 48, h: 40, ox: 24, oy: 30 }),
  draw: (sk, anim, frame, eye) => draw(sk, anim, frame, eye),
  eyeFor: (anim) => (anim === 'snatch' ? 'angry' : anim === 'display' ? 'alert' : 'open'),
  anchor: Object.fromEntries(AIR.map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

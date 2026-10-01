// Sackjaw Gull: the stern's resident thief. A pale-grey gull with black wingtips and white mirrors,
// a heavy yellow bill whose cutting edges are serrated like a bread knife (for gripping slippery
// fish) and hooked at the tip, a red gape spot, a mean pale eye in a red ring, and a stretchy
// orange throat sack: slack when resting, bulging with stolen food, or blown up like a balloon to
// shout down rivals on the rail.
//
// Flight anims anchor on the body centre, standing anims on the feet, 'swim' on the waterline.

import { Sk, V2, V3, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh } from '../../beasts-core';
import { hex } from '../../color';
import { birdLeg, BirdLegLook } from '../../beasts-bird';
import { View3, WingShape, WingPose, wing3, body3, ball3, plate3, rows } from './seabird';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
const ANIMS: Record<string, AnimDef> = {
  idle: A(4, 3),
  fly: A(6, 11),
  glide: A(2, 3),
  hover: A(4, 9),
  beg: A(4, 8),
  swoop: A(2, 6),
  grab: A(3, 9, false),
  carry: A(6, 10),
  display: A(4, 6),
  call: A(2, 4),
  swim: A(2, 2),
  land: A(3, 8, false),
};
const AIR = ['fly', 'glide', 'hover', 'beg', 'swoop', 'grab', 'carry', 'land'];

const EYE: EyeSpec = { r: 0.6, iris: hex('#f2e27a'), lash: hex('#2a2426'), ring: hex('#d8433a') };

function mats(sk: Sk) {
  return {
    white: sk.m(rmp('#f3f1ec', { n: 6, dark: 0.34, light: 0.6, at: 3 }), { edge: 1 }),
    mantle: sk.m(rmp('#8e9cab', { n: 6, dark: 0.5, light: 0.45 }), { edge: 1 }),
    wing: sk.m(rmp('#8896a6', { n: 6, dark: 0.52, light: 0.45 }), { edge: 2 }),
    cov: sk.m(rmp('#9eabb8', { n: 6, dark: 0.5, light: 0.5 }), { edge: 2 }),
    trail: sk.m(rmp('#f0f0ee', { n: 4, dark: 0.3 }), { edge: 1 }),
    tip: sk.m(rmp('#1f1c20', { n: 4, dark: 0.5, light: 0.35 }), { edge: 1 }),
    mirror: sk.m(rmp('#f5f4f0', { n: 3, dark: 0.25 }), { edge: 0 }),
    lining: sk.m(rmp('#f4f3ef', { n: 5, dark: 0.3, at: 3 }), { edge: 1, bias: 0.2 }),
    under: sk.m(rmp('#d4d9de', { n: 5, dark: 0.35 }), { edge: 1, bias: 0.14 }),
    bill: sk.m(rmp('#f0c83c', { n: 5, dark: 0.45, light: 0.5 }), { spec: 0.4, edge: 1 }),
    hook: sk.m(rmp('#d8a232', { n: 4, dark: 0.45 }), { spec: 0.4 }),
    gonys: sk.m(rmp('#d8342c', { n: 4, dark: 0.45 }), { edge: 0 }),
    tooth: sk.m(rmp('#fff4c8', { n: 3, dark: 0.25 }), { edge: 0, noRim: true }),
    pouch: sk.m(rmp('#f08a5a', { n: 5, dark: 0.45, light: 0.5 }), { spec: 0.55, edge: 1 }),
    pouchD: sk.m(rmp('#c85a44', { n: 4, dark: 0.45 }), { edge: 0 }),
    mouth: sk.m(rmp('#b8324a', { n: 3, dark: 0.45 }), { edge: 0 }),
    leg: sk.m(rmp('#f0b43a', { n: 5, dark: 0.5 }), { edge: 1 }),
    web: sk.m(rmp('#e89a30', { n: 4, dark: 0.45 }), { edge: 0 }),
    claw: sk.m(rmp('#3a3030', { n: 3, dark: 0.4 })),
    fish: sk.m(rmp('#9ab8c8', { n: 5, dark: 0.5, light: 0.6 }), { spec: 0.6 }),
    fishD: sk.m(rmp('#4a6a88', { n: 4, dark: 0.5 }), { edge: 1 }),
  };
}
type M = ReturnType<typeof mats>;

const WING: WingShape = {
  sh: [1, 0.9, 1.5],
  segs: [
    { len: 4.2, sweep: -0.1, dih: 0.06, flex: -0.6, shrink: 0.2 },
    { len: 4.6, sweep: 0.26, dih: 0.1, flex: 0.9, shrink: 0.25 },
    { len: 6.2, sweep: -0.36, dih: 0.02, flex: -0.9, shrink: 0.4 },
  ],
  chord: [4.6, 4.9, 4, 1.4],
  spar: 0.55,
};
const LEG: BirdLegLook = { tib: 2.2, tar: 2.4, rT: 1.1, rt: 0.5, toe: 1.8, talon: 0.3, web: true };

interface Pose {
  mode: 'air' | 'stand' | 'swim';
  bank: number; pitch: number; yaw: number;
  wings: [WingPose, WingPose];
  headA: number; neck: number; open: number;
  /** throat sack: 0 slack .. 1 bulging with food .. 2 blown up (display) */
  sack: number;
  fish: boolean;
  tail: number; fan: number;
  legs: 'tuck' | 'dangle' | 'grab';
  lift: number;   // folded wings lifted (display)
  eye?: BeastEye;
}
const W0 = (elev: number, hand = 0, flex = 0, sweep = 0): WingPose => ({ elev, hand, flex, sweep });
const base = (): Pose => ({
  mode: 'air', bank: 0.38, pitch: 0.04, yaw: 0.32, wings: [W0(0.1), W0(0.1)], headA: 0.08, neck: 0, open: 0,
  sack: 0, fish: false, tail: 0, fan: 1, legs: 'tuck', lift: 0,
});
function flap(t: number, amp = 1): [WingPose, WingPose] {
  const c = Math.cos(t * TAU), up = t > 0.5;
  const w = W0((0.2 + 0.75 * c) * amp, (-0.4 * Math.sin(t * TAU) + (up ? 0.3 : -0.08)) * amp, up ? 0.65 * Math.sin((t - 0.5) * TAU) : 0.02, up ? -0.15 : 0.05);
  return [w, { ...w }];
}

function pose(anim: string, f: number, n: number): Pose {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'fly':
      p.wings = flap(t);
      p.pitch = 0.04 + Math.sin(t * TAU) * 0.04;
      break;
    case 'carry':
      p.wings = flap(t);
      p.sack = 1; p.fish = true; p.headA = 0.18;
      break;
    case 'glide':
      p.bank = 0.5 + f * 0.06;
      p.wings = [W0(0.12, -0.12, 0.18), W0(0.12, -0.12, 0.18)];
      break;
    case 'hover':
    case 'beg': {
      // hanging on the wind over the stern: wings in a V with flickering hands, tail fanned, legs down
      p.pitch = 0.32;
      p.bank = 0.28;
      const fl = Math.sin(t * TAU);
      p.wings = [W0(0.55 + fl * 0.22, -0.35 + fl * 0.35, 0.28, -0.1), W0(0.55 + fl * 0.22, -0.35 + fl * 0.35, 0.28, -0.1)];
      p.fan = 1.8; p.tail = -0.3 + fl * 0.1;
      p.legs = 'dangle';
      p.headA = 0.35;
      if (anim === 'beg') { p.open = [0.3, 1, 0.9, 0.5][f]; p.sack = 0.6 + (f % 2) * 0.2; p.headA = [0.2, -0.05, 0, 0.15][f]; }
      break;
    }
    case 'swoop':
      p.pitch = -0.42;
      p.wings = [W0(0.35 + f * 0.1, -0.2, 0.7, -0.35), W0(0.35 + f * 0.1, -0.2, 0.7, -0.35)];
      p.fan = 0.8;
      p.headA = 0.2;
      break;
    case 'grab':
      // braking hard over the prize: wings high, bill and feet thrust down
      p.pitch = [0.25, 0.1, 0.35][f];
      p.wings = [0, 1].map(() => W0([1.0, 1.2, 0.8][f], 0.3, 0.3, -0.25)) as [WingPose, WingPose];
      p.legs = 'grab';
      p.headA = [0.9, 1.25, 0.8][f];
      p.open = [0.6, 1, 0.2][f];
      p.fan = 2; p.tail = -0.35;
      break;
    case 'land':
      p.pitch = [0.35, 0.55, 0.5][f];
      p.wings = [0, 1].map(() => W0([0.7, 1.05, 1.25][f], [0.2, 0.3, -0.1][f], [0.2, 0.3, 0.6][f], -0.2)) as [WingPose, WingPose];
      p.legs = 'grab';
      p.fan = 2; p.tail = -0.25;
      break;
    case 'idle':
      p.mode = 'stand';
      p.bank = 0; p.yaw = 0.24; p.pitch = [0.1, 0.1, 0.14, 0.08][f];
      p.headA = [0.08, 0.08, -0.12, 0.2][f];
      p.neck = [0, 0.1, 0.4, -0.2][f];
      break;
    case 'display':
      // the sack blown up like a balloon, wings lifted, head thrown up: "this rail is MINE"
      p.mode = 'stand';
      p.bank = 0; p.yaw = 0.24; p.pitch = 0.32;
      p.sack = 2 - (f === 0 ? 0.6 : 0) - (f === 3 ? 0.3 : 0);
      p.headA = -0.35 - (f % 2) * 0.15;
      p.neck = 0.9;
      p.open = f === 1 || f === 2 ? 0.8 : 0.2;
      p.lift = 0.8 + (f % 2) * 0.2;
      p.eye = 'angry';
      break;
    case 'call':
      p.mode = 'stand';
      p.bank = 0; p.yaw = 0.24; p.pitch = f ? -0.1 : 0.05;
      p.headA = f ? 0.45 : 0.2; p.neck = f ? 0.4 : 0.2;
      p.open = f ? 1 : 0.4; p.sack = 0.35;
      break;
    case 'swim':
      p.mode = 'swim';
      p.bank = 0; p.yaw = 0.24; p.pitch = 0.06;
      p.headA = f ? 0.12 : 0.02; p.neck = f ? 0.2 : 0;
      break;
  }
  return p;
}

// ------------------------------------------------------------------ parts
function wingFill(M: M) {
  return (p: Px, s: number, c: number, top: boolean): number => {
    if (top) {
      // black tip with two white mirrors, a clean white trailing edge on the arm
      if (s > 0.64 + c * 0.06) return (s > 0.8 && s < 0.87 && c > 0.3 && c < 0.75) || (s > 0.95 && c < 0.6) ? M.mirror : M.tip;
      if (c > 0.82 && s < 0.66) return M.trail;
      p.l += rows(s * 20, 1, 0.2) * 0.5;
      return c < 0.34 ? M.cov : M.wing;
    }
    if (s > 0.72 + c * 0.1) return M.tip;
    if (c > 0.72) { p.l += rows(s * 18, 1, 0.25) * 0.5; return M.under; }
    return M.lining;
  };
}

/** head + serrated bill + throat sack, in a head-local frame (x along the bill, y down) */
function drawHead(sk: Sk, V: View3, M: M, hc: V3, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const ha = P.headA, ca = Math.cos(ha), sa = Math.sin(ha);
  const Hp = (x: number, y: number, z = 0): V3 => [hc[0] + x * ca - y * sa, hc[1] - x * sa - y * ca, z];
  sk.np();
  ball3(sk, V, hc, 2.05, () => M.white);
  // throat sack under the lower mandible and the throat
  const sk0 = P.sack;
  if (sk0 > 0.05) {
    sk.np();
    const r = 1.3 + sk0 * 1.25, ry = 0.9 + sk0 * 1.2;
    const c = Hp(1.8 + sk0 * 0.4, 1.4 + ry * 0.55, 0.3);
    ball3(sk, V, c, r, (p) => {
      // stretched skin: shiny when blown up, wrinkled when slack
      if (sk0 < 1.2 && rows(p.x * 1.2 + p.y * 0.3, 1, 0.25) < 0) return M.pouchD;
      return M.pouch;
    }, { ry });
    // a fish tail sticking out of the full sack
    if (P.fish) {
      sk.np();
      const f0 = V.s(Hp(4.2, 0.9, 0.6)), f1 = V.s(Hp(6.2, 1.8, 0.6));
      sk.tube([[f0[0], f0[1]], [f1[0], f1[1]]], t => 0.8 - t * 0.35, M.fish, { z: f0[2] + 3 });
      const tl = V.s(Hp(6.6, 1.2, 0.6)), tr = V.s(Hp(6.8, 2.6, 0.6));
      sk.poly([f1[0], f1[1], tl[0], tl[1], tr[0], tr[1]], M.fishD, { z: f0[2] + 3.2 });
    }
  } else {
    // slack sack: a pale orange fold of skin along the throat
    sk.np();
    const a = V.s(Hp(0.6, 1.8, 0.8)), b = V.s(Hp(2.6, 1.4, 0.8));
    sk.tube([[a[0], a[1]], [b[0], b[1]]], 0.7, M.pouchD, { z: Math.max(a[2], b[2]) + 1.5 });
  }
  const open = P.open;
  // lower mandible with the red gonys spot
  sk.np();
  const lo = [Hp(1.3, 0.75), Hp(3.2, 0.8 + open * 0.8), Hp(4.6, 0.6 + open * 1.7)].map(q => V.s(q));
  sk.tube(lo.map(q => [q[0], q[1]] as V2), t => 0.72 - t * 0.2, p => (p.t > 0.62 && p.t < 0.86 ? M.gonys : M.bill), { z: t => lo[0][2] + (lo[2][2] - lo[0][2]) * t + 1.2, bias: -0.06 });
  if (open > 0.25) {
    const m0 = V.s(Hp(1.4, 0.35)), m1 = V.s(Hp(4, 0.35 + open * 1.1));
    sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.3, Math.max(m0[2], m1[2]) + 2.5, true);
  }
  // upper mandible, hooked
  sk.np();
  const up = [Hp(1.3, -0.3), Hp(3.2, -0.25), Hp(4.6, 0), Hp(5.2, 0.5)].map(q => V.s(q));
  sk.tube(up.map(q => [q[0], q[1]] as V2), t => 0.95 - t * 0.35, p => (p.t > 0.8 ? M.hook : M.bill), { z: t => up[0][2] + (up[3][2] - up[0][2]) * t + 1.6 });
  // the serrations: pale teeth along the cutting edges
  for (let i = 0; i < 3; i++) {
    const q = V.s(Hp(2.1 + i * 0.95, 0.5 + open * 0.3 * i));
    sk.dot(q[0], q[1], M.tooth, 0.5, q[2] + 4, true);
  }
  const ev = Hp(0.2, -0.45, 1.75);
  let ep: V2 = V.s2(ev);
  if (V.faces([0.3, 0.1, 1], 0.05)) ep = drawEye(sk, ep[0], ep[1], EYE, P.eye ?? eye);
  return { head: V.s2([hc[0], hc[1] + 4, 0]), eye: ep };
}

function drawTail(sk: Sk, V: View3, M: M, P: Pose, root: V3) {
  sk.np();
  const L = 3.8, w = 1.7 * P.fan;
  const ct = Math.cos(P.tail), st = Math.sin(P.tail);
  const T = (x: number, z: number): V3 => [root[0] + x * ct, root[1] - x * st, z];
  plate3(sk, V, [T(0.4, 1.3), T(-L, w), T(-L - 0.3, 0), T(-L, -w), T(0.4, -1.3)], (p) => { p.l += rows(p.u * 5, 1, 0.2) * 0.4; return M.white; }, [0, 1, 0]);
}

// ------------------------------------------------------------------ flight
function drawAir(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const wf = wingFill(M);
  wing3(sk, V, WING, P.wings[1], -1, wf, { bias: -0.12, spar: top => (top ? M.cov : M.lining) });
  const legs = (side: 1 | -1) => {
    if (P.legs === 'tuck') return;
    sk.np();
    const hip = V.s([-1, -1.4, side * 0.9]);
    const toe = P.legs === 'grab' ? V.s([2.6, -6, side * 1.3]) : V.s([-2.4, -5, side * 1.1]);
    sk.tube([[hip[0], hip[1]], [toe[0], toe[1]]], 0.5, M.leg, { z: t => hip[2] + (toe[2] - hip[2]) * t, bias: side < 0 ? -0.12 : 0 });
    const w1 = V.s([P.legs === 'grab' ? 3.8 : -1.5, P.legs === 'grab' ? -6.4 : -5.9, side * 1.9]);
    sk.poly([toe[0], toe[1], w1[0], w1[1], w1[0] + 0.3, w1[1] + 1], M.web, { z: toe[2] + 0.5 });
  };
  legs(-1);
  drawTail(sk, V, M, P, [-4.4, 0.4, 0]);
  sk.np();
  body3(sk, V, [[-5, 0.4, 0], [-2, 0, 0], [1, -0.1, 0], [3.4, 0.5 + P.neck * 0.3, 0]], t => (t < 0.45 ? 1.6 + t * 2.4 : 2.68 - (t - 0.45) * 1.4),
    (_p, nb) => (nb[1] > 0.42 ? M.mantle : M.white));
  const hd = drawHead(sk, V, M, [5, 1.1 + P.neck, 0], P, eye);
  legs(1);
  wing3(sk, V, WING, P.wings[0], 1, wf, { spar: top => (top ? M.cov : M.lining) });
  return hd;
}

// ------------------------------------------------------------------ standing / swimming
function foldedWing(sk: Sk, V: View3, M: M, side: 1 | -1, lift: number) {
  const z = side * 2.2;
  // primaries: black, white-spotted tips crossed over the tail; secondaries and coverts: grey rows
  const rowsDef: [V3, V3, number, number][] = [
    [[2.6, 1.6 + lift * 1.2, z], [-8.2, 1.2 + lift * 3.5, z * 0.9], 1.05, M.tip],
    [[2.4, 0.9 + lift, z * 1.05], [-3.4, 0.4 + lift * 2.4, z], 1.35, M.wing],
    [[2.8, 1.8 + lift * 0.8, z * 1.1], [-1.2, 1.1 + lift * 1.5, z * 1.05], 1.2, M.cov],
  ];
  rowsDef.forEach(([a, b, w, m], i) => {
    const pa = V.s(a), pb = V.s(b);
    sk.np();
    sk.blade(pa[0], pa[1], pb[0], pb[1], s => Math.max(0.35, (s < 0.15 ? 0.7 + s * 2 : 1 - Math.pow(Math.max(0, s - 0.6) / 0.4, 1.4) * 0.7) * w),
      (p) => {
        if (m === M.tip && p.t > 0.86 && p.v > -0.2) return M.mirror;
        if (m === M.wing && p.t > 0.8) return M.trail;
        p.l += rows(p.t * 8, 1, 0.2) * 0.5;
        return m;
      }, { z0: pa[2] + 1 + i * 0.5 * side, z1: pb[2] + 1 + i * 0.5 * side, bias: side < 0 ? -0.12 : 0 });
  });
}

function drawStand(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const swim = P.mode === 'swim';
  const legH = (LEG.tib + LEG.tar) * 0.8;
  const V = new View3(0, P.pitch, P.yaw, [0, swim ? -2.4 : -(legH + 2.2)], 1);
  if (swim) sk.clipY = 0.5;
  const fills = { tib: M.white, tar: () => M.leg, toe: M.leg, claw: M.claw, web: M.web };
  if (!swim) { sk.np(); birdLeg(sk, V.s2([-0.6, -1.6, -0.8]), [-1.2, 0], LEG, 1, fills, -3, -0.14); }
  drawTail(sk, V, M, { ...P, tail: P.tail + 0.25 }, [-4.2, 0.6, 0]);
  foldedWing(sk, V, M, -1, P.lift);
  sk.np();
  body3(sk, V, [[-4.8, 0.6, 0], [-2, 0.1, 0], [1, -0.1, 0], [3.4, 0.8 + P.neck * 0.4, 0]], t => (t < 0.45 ? 1.8 + t * 2.4 : 2.88 - (t - 0.45) * 1.4),
    (_p, nb) => (nb[1] > 0.5 ? M.mantle : M.white));
  sk.tufts(sk.pid, (_x, _y, _nx, ny) => (ny > 0.5 ? [-0.3, 1] as V2 : null), { every: 4, len: 1 });
  const hd = drawHead(sk, V, M, [4.4, 2.2 + P.neck, 0], P, eye);
  foldedWing(sk, V, M, 1, P.lift);
  if (!swim) { sk.np(); birdLeg(sk, V.s2([-0.2, -1.6, 0.8]), [0.8, 0], LEG, 1, fills, 3); }
  else {
    sk.clipY = Infinity;
    for (let x = -7; x <= 7; x++) if (hh(x, 5, 3) > 0.35) sk.over(x, 0, hex('#dff1f6'));
  }
  return hd;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
  const n = ANIMS[anim]?.frames ?? 1;
  const M = mats(sk);
  const P = pose(anim, frame, n);
  return P.mode === 'air' ? drawAir(sk, M, P, eye) : drawStand(sk, M, P, eye);
}

export const SACKJAW: SpeciesDef = {
  name: 'Sackjaw Gull', kind: 'bird', len: 13, height: 12,
  anims: ANIMS,
  canvas: (anim) => (AIR.includes(anim) ? { w: 56, h: 52, ox: 28, oy: 26 } : { w: 30, h: 28, ox: 14, oy: 22 }),
  draw: (sk, anim, frame, eye) => draw(sk, anim, frame, eye),
  eyeFor: (anim) => (anim === 'display' || anim === 'grab' ? 'angry' : 'open'),
  anchor: Object.fromEntries(AIR.map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

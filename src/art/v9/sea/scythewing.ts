// Scythewing Petrel: a sparrow-sized storm-petrel that lives in flocks over the swell. Its outer
// primaries are fused into one stiff, glossy keratin blade that curves back like a scythe; the
// flock skims so low that the blades slice the wave tops and flick up lines of spray (it feeds on
// the plankton that the cut brings to the surface). Sooty brown above with a bright white rump
// band, white below with white underwings that flash when the whole flock wheels at once, long
// legs and yellow-webbed feet for pattering on the water.
//
// Flight anims anchor on the body centre. 'bank' runs from the back view (frame 0) to the
// underside (last frame): the flock flashes white as it turns. 'raft' anchors on the waterline.

import { Sk, V2, V3, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh } from '../../beasts-core';
import { hex } from '../../color';
import { View3, WingShape, WingPose, wing3, body3, ball3, plate3 } from './seabird';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const SCYTHE_BANK = 5;
const ANIMS: Record<string, AnimDef> = {
  idle: A(2, 3),
  skim: A(4, 6),
  flap: A(4, 16),
  bank: A(SCYTHE_BANK, 1),
  patter: A(4, 12),
  raft: A(2, 2),
};
const AIR = ['idle', 'skim', 'flap', 'bank', 'patter'];
/** bank angle of each 'bank' frame: + back .. - underside */
export const scytheBankAngle = (f: number) => 0.95 - (f / (SCYTHE_BANK - 1)) * 1.85;

const EYE: EyeSpec = { r: 0.5, iris: hex('#141014'), lash: hex('#141014') };

function mats(sk: Sk) {
  return {
    soot: sk.m(rmp('#3b312f', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    sootL: sk.m(rmp('#57493f', { n: 5, dark: 0.55 }), { edge: 1 }),
    white: sk.m(rmp('#f2f1ec', { n: 5, dark: 0.3, at: 3 }), { edge: 1, bias: 0.12 }),
    rump: sk.m(rmp('#fbfaf6', { n: 4, dark: 0.25 }), { edge: 0, bias: 0.16 }),
    blade: sk.m(rmp('#221e24', { n: 6, dark: 0.5, light: 0.5 }), { edge: 1, spec: 0.7 }),
    shine: sk.m(rmp('#7e8698', { n: 4, dark: 0.35 }), { edge: 0, noRim: true }),
    lining: sk.m(rmp('#f4f3ef', { n: 4, dark: 0.3 }), { edge: 1, bias: 0.22 }),
    bill: sk.m(rmp('#2a2426', { n: 4, dark: 0.45 }), { spec: 0.4 }),
    leg: sk.m(rmp('#2e2a2c', { n: 4, dark: 0.4 }), { edge: 0 }),
    web: sk.m(rmp('#f0cc3a', { n: 4, dark: 0.45 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

// a short arm reaching forward, then the fused blade curving back in two stiff sections: a scythe
const WING: WingShape = {
  sh: [0.6, 0.6, 1],
  segs: [
    { len: 2, sweep: 0.12, dih: 0.05, flex: -0.6, shrink: 0.2 },
    { len: 2.4, sweep: 0.34, dih: 0.08, flex: 0.8, shrink: 0.2 },
    { len: 3.4, sweep: -0.3, dih: 0.02, flex: -0.5, shrink: 0.12 },
    { len: 3.4, sweep: -1.0, dih: 0, flex: -0.2, shrink: 0.1 },
  ],
  chord: [2.5, 2.7, 2.3, 1.3, 0.3],
  spar: 0.5,
};

interface Pose {
  raft: boolean;
  bank: number; pitch: number; yaw: number;
  wings: [WingPose, WingPose];
  legs: number;    // 0 tucked .. 1 dangling (pattering)
  step: number;    // patter phase
  fan: number;
}
const W0 = (elev: number, hand = 0, flex = 0, sweep = 0): WingPose => ({ elev, hand, flex, sweep });

function pose(anim: string, f: number, n: number): Pose {
  const t = f / n;
  const p: Pose = { raft: false, bank: 1.05, pitch: 0, yaw: 0.06, wings: [W0(0.04), W0(0.04)], legs: 0, step: 0, fan: 1 };
  switch (anim) {
    case 'idle':
    case 'skim': {
      // stiff-winged: the blades barely flex, the body rocks with the air over the swell
      const w = Math.sin(t * TAU);
      p.bank = 1.05 + w * 0.08;
      p.wings = [W0(0.02 + w * 0.05, -0.04), W0(0.06 - w * 0.05, -0.04)];
      break;
    }
    case 'flap': {
      const c = Math.cos(t * TAU), up = t > 0.5;
      const w = W0(0.12 + c * 0.55, -0.2 * Math.sin(t * TAU), up ? 0.35 : 0, 0);
      p.wings = [w, { ...w }];
      p.bank = 0.85;
      break;
    }
    case 'bank':
      p.bank = scytheBankAngle(f);
      p.wings = [W0(0.05, 0), W0(0.05, 0)];
      break;
    case 'patter': {
      // hanging over the water with the blades held up in a V, feet dancing on the surface
      const c = Math.cos(t * TAU);
      p.bank = 0.32; p.pitch = 0.38;
      p.wings = [W0(0.95 + c * 0.25, 0.1 - c * 0.15, 0.15, -0.05), W0(0.95 + c * 0.25, 0.1 - c * 0.15, 0.15, -0.05)];
      p.legs = 1; p.step = t; p.fan = 1.6;
      break;
    }
    case 'raft':
      p.raft = true; p.bank = 0; p.yaw = 0.2; p.pitch = f ? 0.05 : 0;
      break;
  }
  return p;
}

function wingFill(M: M) {
  return (p: Px, s: number, c: number, top: boolean): number => {
    const blade = s > 0.38;
    if (top) {
      if (blade) {
        // the fused blade: glossy black, a cold shine line along the cutting edge
        if (c < 0.16 && s < 0.9) return M.shine;
        p.l += (1 - c) * 0.12;
        return M.blade;
      }
      return c < 0.4 ? M.sootL : M.soot;
    }
    if (blade) return c < 0.16 ? M.shine : M.blade;
    return c > 0.75 ? M.soot : M.lining;
  };
}

function drawAir(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const wf = wingFill(M);
  wing3(sk, V, WING, P.wings[1], -1, wf, { bias: -0.1, spar: top => (top ? M.sootL : M.lining) });
  const legs = (side: 1 | -1) => {
    if (P.legs <= 0) return;
    sk.np();
    const ph = P.step + (side > 0 ? 0 : 0.5);
    const hip = V.s([-0.6, -0.9, side * 0.5]);
    const toe = V.s([-1.2 + Math.cos(ph * TAU) * 1.4, -5.2 + Math.max(0, Math.sin(ph * TAU)) * 1.2, side * 0.8]);
    sk.tube([[hip[0], hip[1]], [toe[0], toe[1]]], 0.42, M.leg, { z: t => hip[2] + (toe[2] - hip[2]) * t, bias: side < 0 ? -0.1 : 0 });
    sk.dot(toe[0] + 0.5, toe[1], M.web, 0.6, toe[2] + 1, true);
    sk.dot(toe[0] - 0.4, toe[1], M.web, 0.6, toe[2] + 1, true);
  };
  legs(-1);
  // short square tail, dark with a white base (the rump band continues onto it)
  sk.np();
  const T = (x: number, z: number): V3 => [-3.2 + x, 0.3, z];
  plate3(sk, V, [T(0.4, 0.9), T(-2.6, 1.2 * P.fan), T(-2.3, 0), T(-2.6, -1.2 * P.fan), T(0.4, -0.9)], (px) => (px.v < 0.28 ? M.rump : M.soot), [0, 1, 0]);
  sk.np();
  body3(sk, V, [[-3.4, 0.3, 0], [-1, 0, 0], [1.2, 0, 0], [2.6, 0.3, 0]], t => (t < 0.45 ? 1.1 + t * 1.8 : 1.9 - (t - 0.45) * 1),
    (px, nb) => {
      // white rump band across the back at the tail base; sooty back; white belly
      if (px.x < -2 && nb[1] > -0.2) return M.rump;
      return nb[1] > -0.3 ? M.soot : M.white;
    });
  sk.np();
  const hc: V3 = [3.4, 0.6, 0];
  ball3(sk, V, hc, 1.45, (_p, n) => (n[1] > -0.45 ? M.soot : M.white));
  const b0 = V.s([4.5, 0.55, 0]), b1 = V.s([5.9, 0.35, 0]);
  sk.tube([[b0[0], b0[1]], [b1[0], b1[1]]], t => 0.55 - t * 0.2, M.bill, { z: Math.max(b0[2], b1[2]) + 1.5 });
  let ep: V2 = V.s2([3.9, 0.95, 1.2]);
  if (V.faces([0.3, 0.2, 1], 0.1)) ep = drawEye(sk, ep[0], ep[1], EYE, eye);
  legs(1);
  wing3(sk, V, WING, P.wings[0], 1, wf, { spar: top => (top ? M.sootL : M.lining) });
  return { head: V.s2([hc[0], hc[1] + 3, 0]), eye: ep };
}

function drawRaft(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const V = new View3(0, P.pitch, P.yaw, [0, -1.6], 1);
  sk.clipY = 0.5;
  sk.np();
  // folded blades crossed high over the tail
  for (const side of [-1, 1] as const) {
    const a = V.s([1.6, 1.4, side * 1.3]), b = V.s([-6, 2.6, side * 1.1]);
    sk.np();
    sk.blade(a[0], a[1], b[0], b[1], s => Math.max(0.35, (1 - s * 0.7) * 0.95), (px) => (px.v < -0.4 ? M.shine : M.blade), { z0: a[2] + 1.5 * side, z1: b[2] + 1.5 * side, bias: side < 0 ? -0.12 : 0 });
    if (side < 0) {
      sk.np();
      body3(sk, V, [[-3.2, 0.4, 0], [-1, 0, 0], [1.2, 0, 0], [2.4, 0.5, 0]], t => (t < 0.45 ? 1.3 + t * 1.6 : 2.0 - (t - 0.45) * 1),
        (px, nb) => (px.x < -2.2 && nb[1] > 0 ? M.rump : nb[1] > -0.2 ? M.soot : M.white));
    }
  }
  sk.np();
  const hc: V3 = [3.2, 1.3, 0];
  ball3(sk, V, hc, 1.5, (_p, n) => (n[1] > -0.5 ? M.soot : M.white));
  const b0 = V.s([4.4, 1.2, 0]), b1 = V.s([5.8, 1.0, 0]);
  sk.tube([[b0[0], b0[1]], [b1[0], b1[1]]], t => 0.55 - t * 0.2, M.bill, { z: Math.max(b0[2], b1[2]) + 1.5 });
  const ep = drawEye(sk, V.s2([3.7, 1.7, 1.2])[0], V.s2([3.7, 1.7, 1.2])[1], EYE, eye);
  sk.clipY = Infinity;
  for (let x = -5; x <= 5; x++) if (hh(x, 9, 2) > 0.4) sk.over(x, 0, hex('#dff1f6'));
  return { head: V.s2([hc[0], hc[1] + 3, 0]), eye: ep };
}

export const SCYTHEWING: SpeciesDef = {
  name: 'Scythewing Petrel', kind: 'bird', len: 8, height: 5,
  anims: ANIMS,
  canvas: (anim) => (AIR.includes(anim) ? { w: 34, h: 30, ox: 17, oy: 15 } : { w: 20, h: 14, ox: 10, oy: 10 }),
  draw(sk, anim, frame, eye) {
    const n = ANIMS[anim]?.frames ?? 1;
    const M = mats(sk);
    const P = pose(anim, frame, n);
    return P.raft ? drawRaft(sk, M, P, eye) : drawAir(sk, M, P, eye);
  },
  eyeFor: () => 'open',
  anchor: Object.fromEntries(AIR.map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

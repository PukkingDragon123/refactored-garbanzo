// Scythewing Petrel: a sparrow-sized storm-petrel that lives in flocks over the swell. Its outer
// primaries are fused into one stiff, glossy keratin blade that curves back like a scythe; the
// flock skims so low that the blades slice the wave tops and flick up lines of spray (it feeds on
// the plankton that the cut brings to the surface). Sooty brown above with a bright white rump
// band, white below with white underwings that flash when the whole flock wheels at once, long
// legs and yellow-webbed feet for pattering on the water.
//
// Painted on the Relief layer through the seabird contour kit, so each pose is one contour: the
// body, short neck and round petrel head lofted together; the wing a short arm of scalloped sooty
// secondaries running into the fused blade, a smooth crescent with no feather slots at all, its
// cutting edge catching a cold glint; a square tail with the white rump band; a black tube-nosed
// bill; long legs placed pixel by pixel with yellow webs. At rest the two blades cross high over
// the tail like a pair of scythes.
//
// Flight anims anchor on the body centre. 'bank' runs from the back view (frame 0) to the
// underside (last frame): the flock flashes white as it turns. 'raft' anchors on the waterline.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh } from '../../beasts-core';
import { hex } from '../../color';
import { View3, WingShape, WingPose } from './seabird';
import { Relief, LM, Sp, Tx, spline, loft, loftOutline, loftAt, Station, HeadF, wingFrame, wing, WingLook, WingPx, fan, fanAt, v3add, v3norm } from './seabird-kit';

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
    sootL: sk.m(rmp('#5e4f44', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    white: sk.m(rmp('#f2f1ec', { n: 6, dark: 0.32, at: 4, cool: 0.5 }), { edge: 1, bias: 0.1 }),
    rump: sk.m(rmp('#fbfaf6', { n: 4, dark: 0.25 }), { edge: 0, bias: 0.16 }),
    blade: sk.m(rmp('#221e24', { n: 6, dark: 0.5, light: 0.5, cool: 0.6 }), { edge: 1, spec: 0.7 }),
    shine: sk.m(rmp('#9aa4b8', { n: 4, dark: 0.35, light: 0.4 }), { edge: 0, noRim: true }),
    lining: sk.m(rmp('#f4f3ef', { n: 4, dark: 0.3 }), { edge: 1, bias: 0.2 }),
    bill: sk.m(rmp('#2a2426', { n: 4, dark: 0.45, light: 0.4 }), { spec: 0.4 }),
    leg: sk.m(rmp('#4e464a', { n: 4, dark: 0.4, light: 0.35 }), { edge: 0 }),
    web: sk.m(rmp('#f0cc3a', { n: 4, dark: 0.45 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;
const ID = { BODY: 1, BILL: 3, TAIL: 7, WING: 9, BLADE: 12 };

// a short arm reaching forward, then the fused blade curving back in two stiff sections: a scythe
const WING: WingShape = {
  sh: [0.6, 0.6, 1],
  segs: [
    { len: 1.4, sweep: 0.25, dih: 0.05, flex: -0.6, shrink: 0.2 },
    { len: 1.9, sweep: 0.75, dih: 0.08, flex: 0.8, shrink: 0.2 },
    { len: 3.7, sweep: -0.2, dih: 0.02, flex: -0.5, shrink: 0.12 },
    { len: 4.4, sweep: -1.12, dih: 0, flex: -0.2, shrink: 0.1 },
  ],
  chord: [2.1, 2.2, 1.3, 0.75, 0.12],
  spar: 0.5,
};
const WL: WingLook = { wrist: 2, nS: 4, scallop: 0.14, nP: 2, slot: 0, fingers: 0, rows: [0.3], spar: 0.55, minW: 1, point: 0.9, reach: 0.4 };

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
  return (w: WingPx, o: Tx) => {
    if (w.hand) {
      // the fused blade: glossy black, a cold glint along the cutting (leading) edge
      o.m = w.c < 0.2 && w.s < 0.93 ? M.shine : M.blade;
      o.t += (0.5 - w.c) * 0.14;
      return;
    }
    if (w.top) { o.m = w.zone === 0 ? (w.fu > 0.75 ? M.sootL : M.soot) : w.edge < 0.3 ? M.soot : M.soot; if (w.zone === 1 && w.fu > 0.7) o.m = M.sootL; return; }
    o.m = w.zone === 1 && w.fu > 0.75 ? M.soot : M.lining;
  };
}

function bodyLoft(V: View3, hc: V3) {
  const up: V3 = [0, 1, 0];
  const hf: V3 = [1, -0.08, 0], hu: V3 = [0.08, 1, 0];
  const st: Station[] = [
    { c: [-3.5, 0.3, 0], up, ru: 0.8, rl: 0.6, rw: 0.9 },
    { c: [-2.2, 0.15, 0], up, ru: 1.25, rl: 1.1, rw: 1.4 },
    { c: [-0.4, 0, 0], up, ru: 1.5, rl: 1.65, rw: 1.7 },
    { c: [1.2, 0.05, 0], up, ru: 1.4, rl: 1.6, rw: 1.5 },
    { c: [hc[0] - 1.3, hc[1] - 0.35, 0], up: v3norm(v3add(up, hu)), ru: 1.05, rl: 1.2, rw: 1.15 },
    { c: [hc[0] - 0.2, hc[1], 0], up: hu, ru: 1.35, rl: 1.2, rw: 1.25 },
    { c: [hc[0] + 0.8, hc[1] - 0.05, 0], up: hu, ru: 1.05, rl: 0.85, rw: 0.9 },
    { c: [hc[0] + 1.25, hc[1] - 0.1, 0], up: hu, ru: 0.6, rl: 0.55, rw: 0.5 },
  ];
  return { Lf: loft(V, st), H: new HeadF(V, hc, hf, hu) };
}

function drawBody(R: Relief, V: View3, M: M, hc: V3) {
  const { Lf, H } = bodyLoft(V, hc);
  let zc = 0;
  R.region(spline(loftOutline(Lf, { head: 0.2, tail: 0.3 }), 0.4), {
    zAt: () => zc, R: 1.3, H: 1.4, id: ID.BODY,
    tex: (p: Sp, o: Tx) => {
      const h = loftAt(Lf, p.x, p.y);
      zc = h.z;
      // sooty above, white below; a bright white rump band across the base of the tail
      o.m = h.dors > -0.25 ? M.soot : M.white;
      if (h.f < 1.25 && h.dors > -0.35) o.m = M.rump;
      if (h.f > 4.4 && h.dors < 0.2 && h.dors > -0.5) o.m = M.sootL;
    },
  });
  // the bill: short, black, a tube on top and a hooked tip
  R.region(spline([H.s(1.0, -0.55), H.s(1.9, -0.6), H.s(2.6, -0.3), H.s(2.75, 0.35, 0.9), H.s(2.3, 0.15), H.s(1.2, 0.45)], 0.3), { z: H.zOf(2, 0, 0) + 1.4, R: 0.4, H: 0.4, id: ID.BILL, tex: M.bill });
  return H;
}

function drawTail(R: Relief, V: View3, M: M, P: Pose) {
  const F = fan(V, [-3.1, 0.3, 0], [-1, 0, 0], [0, 0, 1], 6, 0.5 * P.fan, () => 2.6, { minW: 0.9, notch: 0.05, base: 0.8, point: 0.2 });
  R.region(spline(F.poly, 0.35), { z: -1, R: 0.6, H: 0.6, id: ID.TAIL, tex: (p, o) => { const q = fanAt(F, p.x, p.y); o.m = q.u < 0.3 ? M.rump : M.soot; if (q.edge < 0.3) o.z -= 0.3; } });
}

function drawAir(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const V = new View3(P.bank, P.pitch, P.yaw, [0, 0], 1);
  const wf = wingFill(M);
  { const R = Relief.full(sk); wing(R, V, wingFrame(WING, P.wings[1], -1), WL, wf, { id: ID.WING, lt: -0.08 }); sk.np(); R.emit({ drop: 1, seam: 0.5, seamDark: 0.2, bias: -0.04 }); }
  const legs = (side: 1 | -1) => {
    if (P.legs <= 0) return;
    const ph = P.step + (side > 0 ? 0 : 0.5);
    const hip = V.s([-0.4 + side * 0.4, -0.9, side * 0.5]);
    const toe = V.s([-1.0 + Math.cos(ph * TAU) * 3, -6.2 + Math.max(0, Math.sin(ph * TAU)) * 1.6, side * 0.8]);
    // a long bare leg as one clean pixel line, the yellow web a two-pixel paddle slapping the water
    const z = side > 0 ? 3 : -2, lt = side > 0 ? 0 : -0.12;
    sk.line(hip[0], hip[1], toe[0], toe[1], M.leg, 0.55 + lt, z);
    const ta = 0.35 + Math.sin(ph * TAU) * 0.45;
    sk.dot(toe[0] + Math.cos(ta), toe[1] + Math.sin(ta), M.web, 0.62 + lt, z + 0.1);
    sk.dot(toe[0] + Math.cos(ta) * 2, toe[1] + Math.sin(ta) * 2, M.web, 0.5 + lt, z + 0.1);
  };
  legs(-1);
  const BR = Relief.full(sk);
  drawTail(BR, V, M, P);
  const H = drawBody(BR, V, M, [3.4, 0.6, 0]);
  sk.np();
  BR.emit({ drop: 1.1, seam: 0.5, seamDark: 0.22 });
  let ep: V2 = H.s2(0.35, -0.3, 1.0);
  if (H.facing(0.1)) ep = drawEye(sk, ep[0], ep[1], EYE, eye);
  legs(1);
  { const R = Relief.full(sk); wing(R, V, wingFrame(WING, P.wings[0], 1), WL, wf, { id: ID.WING }); sk.np(); R.emit({ drop: 1, seam: 0.5, seamDark: 0.2 }); }
  return { head: V.s2([H.c[0], H.c[1] + 3, 0]), eye: ep };
}

function drawRaft(sk: Sk, M: M, P: Pose, eye: BeastEye) {
  const V = new View3(0, P.pitch, P.yaw, [0, -1.6], 1);
  sk.clipY = 0.5;
  const R = Relief.full(sk);
  // the folded blades crossed high over the tail like a pair of scythes
  const blade = (side: 1 | -1) => {
    const a = V.s([1.6, side > 0 ? 1.1 : 2.1, side * 1.3]), m = V.s([-2.4, side > 0 ? 2.3 : 2.5, side * 1.2]), b = V.s([-6.8, side > 0 ? 5.6 : 1.5, side * 1.1]);
    const lm: LM[] = [[a[0], a[1] + 0.6, 0], [a[0] + 0.3, a[1] - 0.5, 0], [m[0], m[1] - 0.8, 0], [b[0], b[1], 0.9], [m[0] + 0.4, m[1] + 0.4, 0]];
    R.region(spline(lm, 0.3), { z: (a[2] + b[2]) / 2 + side * 1.6, R: 0.6, H: 0.6, id: ID.BLADE + (side > 0 ? 0 : 1), tex: (p, o) => {
      const d = (p.y - (a[1] + (b[1] - a[1]) * (p.x - a[0]) / (b[0] - a[0] || 1)));
      o.m = d < -0.35 ? M.shine : M.blade;
    } });
  };
  blade(-1);
  drawTail(R, V, M, P);
  const H = drawBody(R, V, M, [3.2, 1.3, 0]);
  blade(1);
  sk.np();
  R.emit({ drop: 1.1, seam: 0.5, seamDark: 0.22 });
  const e = H.s2(0.35, -0.3, 1.0);
  const ep = drawEye(sk, e[0], e[1], EYE, eye);
  sk.clipY = Infinity;
  for (let x = -5; x <= 5; x++) if (hh(x, 9, 2) > 0.4) sk.over(x, 0, hex('#dff1f6'));
  return { head: V.s2([H.c[0], H.c[1] + 3, 0]), eye: ep };
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

// Flicker Marten: sleek, lightning-fast mongoose-like serpent fighter. Vivid orange with a dark mask,
// cream cheeks and brows, dark legs and a long ringed tail.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, chain, cbez, along } from './beasts-core';
import { leg, LegSpec, scaleLeg, paw, ear, whiskers, Frame2 } from './beasts-rig';
import { hex } from './color';

interface P {
  hip: V2; spine: number; bend: number; len: number;
  head: number; jaw: number; ear: number; br: number;
  feet: [V2, V2, V2, V2];
  tail: number; tailWave: number; fluff: number;
  upright: number; curl: number; paws: number;
  air: boolean; // all feet off the ground (leap / gallop suspension)
}
const base = (): P => ({
  hip: [-8, -7.4], spine: -0.03, bend: 1.2, len: 13.5, head: 0.08, jaw: 0, ear: 0, br: 0,
  feet: [[8, 0], [8, 0], [-8.2, 0], [-8.2, 0]], tail: 0, tailWave: 0, fluff: 0, upright: 0, curl: 0, paws: 0, air: false,
});

const ANIMS = {
  idle: { frames: 4, fps: 5, loop: true },
  walk: { frames: 8, fps: 11, loop: true },
  run: { frames: 6, fps: 16, loop: true },
  eat: { frames: 3, fps: 7, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 6, loop: true },
  groom: { frames: 4, fps: 8, loop: true },
  leap: { frames: 3, fps: 10, loop: false },
  fight: { frames: 4, fps: 12, loop: true },
  taunt: { frames: 2, fps: 6, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  const ft = (i: number, off: V2) => { p.feet[i] = [p.feet[i][0] + off[0], p.feet[i][1] + off[1]]; };
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.head = f === 2 ? -0.08 : 0.08;
      p.ear = f === 3 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.1;
      p.tailWave = t;
      break;
    case 'walk': {
      const st = 6.5, lift = 2, duty = 0.62;
      ft(2, gait(t, duty, st, lift)); ft(0, gait(t + 0.25, duty, st, lift));
      ft(3, gait(t + 0.5, duty, st, lift)); ft(1, gait(t + 0.75, duty, st, lift));
      p.hip = [-8, -7.4 + Math.cos(t * TAU * 2) * 0.4];
      p.head = 0.06 + Math.sin(t * TAU * 2) * 0.04;
      p.tail = 0.1; p.tailWave = t;
      break;
    }
    case 'run': {
      // weasel bound: the spine flexes and extends, a suspension phase in the middle
      const st = 12, lift = 3.5, duty = 0.36;
      ft(0, gait(t, duty, st, lift)); ft(1, gait(t + 0.06, duty, st, lift));
      ft(2, gait(t + 0.5, duty, st, lift)); ft(3, gait(t + 0.56, duty, st, lift));
      const c = Math.cos(t * TAU);
      p.bend = 1.2 + c * 2.6;
      p.len = 13.5 - c * 1.6;
      p.hip = [-8 + c * 1.4, -7.8 - Math.max(0, Math.sin(t * TAU + 0.6)) * 2.6];
      p.spine = Math.sin(t * TAU) * 0.12;
      p.head = -0.04; p.ear = -1;
      p.tail = -0.3 + c * 0.15; p.tailWave = t;
      break;
    }
    case 'eat':
      p.spine = 0.14; p.hip = [-8, -7.8]; p.head = 0.6 + (f % 2) * 0.1; p.jaw = f === 1 ? 0.9 : 0.3;
      ft(0, [-1, 0]); p.tail = 0.1; p.tailWave = t;
      break;
    case 'alert':
      // mongoose sentinel: up on the hind legs
      p.upright = 1; p.spine = -1.42; p.hip = [-3, -6.4]; p.bend = -0.2; p.len = 12.5;
      p.head = 1.35 - f * 0.12; p.ear = 1; p.br = f;
      p.tail = 0.3; p.tailWave = 0;
      break;
    case 'sleep':
      p.curl = 1; p.br = f;
      break;
    case 'call':
      p.spine = -0.3; p.hip = [-7.2, -7.8]; p.head = -0.2 - f * 0.1; p.jaw = f ? 1 : 0.6; p.ear = 0.5;
      ft(0, [-2, -1.5]);
      p.tail = 0.2; p.tailWave = t;
      break;
    case 'groom':
      p.upright = 0.8; p.spine = -1.1; p.hip = [-3.5, -6]; p.bend = 0.6; p.len = 12;
      p.head = 1.55 + [0, 0.12, 0.04, 0.16][f]; p.jaw = f % 2 ? 0.35 : 0;
      p.paws = [0.8, 1, 0.85, 1][f];
      p.tail = 0.4; p.tailWave = 0.1;
      break;
    case 'leap': {
      if (f === 0) { p.hip = [-6.5, -5]; p.spine = -0.2; p.bend = 2.6; p.len = 11.5; p.head = 0.1; ft(0, [-3, 0]); ft(1, [-3, 0]); ft(2, [2, 0]); ft(3, [2, 0]); p.tail = 0.1; }
      else if (f === 1) {
        p.air = true; p.hip = [-8, -13]; p.spine = -0.28; p.bend = -0.6; p.len = 15; p.head = 0.15;
        p.feet = [[12, -12], [11, -11], [-17, -8], [-16, -7.5]]; p.tail = -0.5; p.ear = -1;
      } else {
        p.air = true; p.hip = [-8, -11]; p.spine = 0.3; p.bend = 0.4; p.len = 14; p.head = 0.05;
        p.feet = [[12, -2], [11, -1.5], [-12, -8], [-11, -8.5]]; p.tail = -0.2; p.ear = -1;
      }
      p.tailWave = t;
      break;
    }
    case 'fight': {
      // coil, lunge low with jaws wide, bite, recoil
      const K = [
        { hip: [-7, -6], sp: -0.15, bend: 2.4, len: 12, head: 0.15, jaw: 0.3, fl: [-2, 0] },
        { hip: [-4, -6.6], sp: 0.08, bend: 0.2, len: 15.5, head: -0.1, jaw: 1, fl: [6, 0] },
        { hip: [-3.6, -6.4], sp: 0.16, bend: 0.4, len: 15.5, head: 0.2, jaw: 0.15, fl: [6, 0] },
        { hip: [-7.5, -6.8], sp: -0.1, bend: 1.8, len: 12.5, head: 0, jaw: 0.6, fl: [0, 0] },
      ][f];
      p.hip = K.hip as V2; p.spine = K.sp; p.bend = K.bend; p.len = K.len; p.head = K.head; p.jaw = K.jaw;
      ft(0, K.fl as V2); ft(1, [K.fl[0] - 1, 0]); ft(2, [f === 1 || f === 2 ? 2 : 0, 0]);
      p.ear = -1; p.fluff = 0.6; p.tail = 0.35; p.tailWave = t;
      break;
    }
    case 'taunt':
      // bristling hop, back arched, tail fluffed and raised
      p.hip = [-7.5, -7.8 - f * 1.4]; p.spine = -0.1; p.bend = 3; p.len = 12.5;
      p.head = 0.25; p.jaw = f ? 0.9 : 0.4; p.ear = -1; p.fluff = 1;
      ft(0, [-1, -f * 1.4]); ft(1, [-1.5, -f * 1.4]); ft(2, [1, -f * 1.2]); ft(3, [0.5, -f * 1.2]);
      p.air = f === 1; p.tail = 1.1; p.tailWave = t;
      break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1, iris: hex('#ffb43c'), lash: hex('#f5e0b8'), pupil: hex('#140a08'), shine: hex('#fff6d8') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#e57a2c', { n: 6, dark: 0.56, cool: 0.22, light: 0.42 }), { edge: 1 }),
    back: sk.m(rmp('#b04f1c', { n: 5, dark: 0.55, cool: 0.2 }), { edge: 1 }),
    belly: sk.m(rmp('#f5e0b8', { n: 5, dark: 0.4, at: 3 }), { edge: 1 }),
    leg: sk.m(rmp('#4a2618', { n: 5, dark: 0.55 }), { edge: 1 }),
    mask: sk.m(rmp('#2b1a12', { n: 4, dark: 0.45, light: 0.3 })),
    ring: sk.m(rmp('#3a1c10', { n: 4, dark: 0.45 })),
    nose: sk.m(rmp('#2a1a18', { n: 3, dark: 0.4 })),
    claw: sk.m(rmp('#e4d6c0', { n: 3, dark: 0.4 })),
    mouth: sk.m(rmp('#8a2230', { n: 3, dark: 0.45 }), { edge: 0 }),
    tooth: sk.m(rmp('#f6f0e0', { n: 3, dark: 0.3 }), { edge: 0 }),
    inner: sk.m(rmp('#e0a080', { n: 3, dark: 0.4 })),
  };
}
type M = ReturnType<typeof mats>;

function tailDraw(sk: Sk, M: M, root: V2, a0: number, P: P, k: number, z: number) {
  const pts = chain(root, a0, 11, 1.65 * k, i => 0.02 + Math.sin(P.tailWave * TAU - i * 0.6) * 0.07 + (i > 7 ? 0.04 : 0));
  sk.np();
  const fat = 1 + P.fluff * 0.55;
  sk.tube(pts, t => (1.7 + Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5) * 0.9 - t * 0.9) * k * fat, (p) => {
    const r = p.t * 6.5;
    return r - Math.floor(r) < 0.36 && p.t > 0.12 ? M.ring : p.t > 0.93 ? M.ring : M.fur;
  }, { z });
  const tp = sk.pid;
  if (P.fluff > 0) sk.tufts(tp, (_x, _y, nx, ny) => [nx, ny] as V2, { every: 1.5, len: 1 });
  else sk.tufts(tp, (_x, _y, nx, ny) => (ny > 0 ? [nx * 0.3 - 0.4, 1] as V2 : null), { every: 3, len: 1 });
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(P.hip);
  const spL = P.len * k, sa = P.spine;
  const sh: V2 = [hip[0] + Math.cos(sa) * spL, hip[1] + Math.sin(sa) * spL];
  const nx = Math.sin(sa), ny = -Math.cos(sa);
  const c1: V2 = [hip[0] + Math.cos(sa) * spL * 0.33 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.33 + ny * P.bend * k];
  const c2: V2 = [hip[0] + Math.cos(sa) * spL * 0.7 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.7 + ny * P.bend * k];
  const rump: V2 = [hip[0] - Math.cos(sa) * 2.4 * k, hip[1] - Math.sin(sa) * 2.4 * k];
  const spine = [rump, ...cbez(hip, c1, c2, sh, 7)];
  const up = P.upright;

  const FL: LegSpec = scaleLeg({ l1: 3.8, l2: 3.6, r1: 1.7, r2: 1.15, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 4.2, l2: 3.9, l3: 2.4, r1: 2.3, r2: 1.3, r3: 0.95, bend: -1 }, k);
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const z = near ? 4 : -4, bias = near ? 0 : -0.08;
    sk.np();
    if (front) {
      const shp = along(spine, 0.86).p;
      const root: V2 = [shp[0] + Math.sin(sa) * 0.3 * k, shp[1] + Math.cos(sa) * 1.3 * k];
      let foot = S(P.feet[which]);
      if (!P.air) foot = [foot[0], foot[1] - 0.8 * k];
      if (up > 0.5) { const chest = along(spine, 0.8).p; foot = [chest[0] + (2.2 + (near ? 0.4 : -0.4) + P.paws * 1.4) * k, chest[1] + (2.2 - P.paws * 4.2) * k]; }
      const j = leg(sk, root, foot, FL, M.leg, z, 0, bias);
      paw(sk, j[2], k, M.leg, M.claw, z, { n: 2, clawLen: 0.9, bias, w: 1.4, h: 0.9 });
    } else {
      const root: V2 = [hip[0] + Math.sin(sa) * 0.3 * k, hip[1] + Math.cos(sa) * 1.3 * k];
      let foot = S(P.feet[which]);
      if (!P.air) foot = [foot[0], foot[1] - 0.8 * k];
      if (up > 0.5) foot = [hip[0] + (2.8 + (near ? 0.4 : -0.6)) * k, -0.8 * k];
      const j = leg(sk, root, foot, HL, M.leg, z, up > 0.5 ? -Math.PI / 2 - 1.2 : -Math.PI / 2 - 0.55, bias);
      paw(sk, j[3], k, M.leg, M.claw, z, { n: 2, clawLen: 0.9, bias, w: 1.6, h: 0.9 });
    }
  };
  drawLeg(1);
  drawLeg(3);

  const tailA = Math.PI + sa - 0.18 + P.tail * -0.8 + (up ? 1.25 : 0);
  tailDraw(sk, M, rump, tailA, P, k, -1);

  // body: sleek tube, darker saddle, cream belly
  sk.np();
  const fl = 1 + P.fluff * 0.12;
  const rad = (t: number) => (t < 0.4 ? 3.2 + t * 1.5 : 3.8 - (t - 0.4) * 1.5) * k * (1 + P.br * 0.03) * fl;
  sk.tube(spine, rad, (p) => (p.v > 0.46 ? M.belly : p.v < -0.55 && p.t > 0.1 && p.t < 0.85 ? M.back : M.fur), { z: 0 });
  const bp = sk.pid;
  sk.streaks(bp, () => [Math.cos(sa + Math.PI), Math.sin(sa + Math.PI) + 0.15] as V2, { spacing: 3, len: 3, amp: 0.09 });
  if (P.fluff > 0.5) sk.tufts(bp, (_x, _y, nx2, ny2) => (ny2 < 0 ? [nx2 * 0.4 - 0.6, -1] as V2 : null), { every: 1.6, len: 1 });
  else sk.tufts(bp, (_x, _y, nx2, ny2) => (ny2 > 0 ? [-0.5, 1] as V2 : null), { every: 3, len: 1 });

  // head: wedge skull, dark mask with cream cheeks and brows
  const neck = along(spine, 1).p;
  const H = new Frame2(neck, sa + P.head, k);
  const ha = H.a;
  sk.np();
  ear(sk, H.p(0.2, -2.6), H.ang(-2.05 + P.ear * 0.3), 2.8 * k, 1.3 * k, M.fur, 0, -1.5, -0.16, 1.4);
  sk.np();
  const skull = H.p(2.4, -0.3);
  sk.ell(skull[0], skull[1], 3.8 * k, 3.2 * k, (p) => {
    if (p.v > 0.42) return M.belly; // cream cheek / throat
    // bandit mask: a dark band through the eye, narrowing toward the ear
    const mv = p.v - p.u * 0.28;
    if (p.u > -0.35 && mv > -0.5 && mv < 0.18) return M.mask;
    return M.fur;
  }, { rot: ha, rz: 3 * k, z: 1.5 });
  const hp = sk.pid;
  sk.tufts(hp, (_x, _y, nx2, ny2) => (ny2 > 0 && nx2 <= 0 ? [-0.7, 1] as V2 : null), { every: 2, len: 1 });
  // snout: cream muzzle, dark bridge continuing the mask, black nose tip
  const sn0 = H.p(4.6, 0.4), sn1 = H.p(7.1, 1.1);
  sk.tube([sn0, sn1], t => (1.9 - t * 0.75) * k, (p) => (p.v < -0.5 && p.t < 0.55 ? M.mask : M.belly), { z: 3 });
  const np = H.p(7.3, 0.8);
  sk.ell(np[0], np[1], 0.9 * k, 0.8 * k, M.nose, { z: 5 });
  if (P.jaw > 0.2) {
    // open jaws with fangs and a red mouth
    sk.np();
    const jA = H.ang(0.25 + P.jaw * 0.55);
    const j0 = H.p(4, 1.8);
    const j1: V2 = [j0[0] + Math.cos(jA) * 4 * k, j0[1] + Math.sin(jA) * 4 * k];
    const m0 = H.p(4.2, 1.4);
    sk.poly([m0[0], m0[1], sn1[0], sn1[1] + 0.8 * k, j1[0], j1[1]], M.mouth, { z: 3.5 });
    sk.tube([j0, j1], t => (1.2 - t * 0.5) * k, (p) => (p.v < -0.4 ? M.belly : M.belly), { z: 4 });
    const f1 = H.p(6.8, 1.6);
    sk.blade(f1[0], f1[1], f1[0] + 0.3 * k, f1[1] + 1.4 * k, () => 0.45 * k, M.tooth, { z0: 6, z1: 6 });
    sk.blade(j1[0] - Math.cos(jA) * 0.8 * k, j1[1] - Math.sin(jA) * 0.8 * k, j1[0] - Math.cos(jA) * 0.8 * k + 0.2, j1[1] - Math.sin(jA) * 0.8 * k - 1.2 * k, () => 0.45 * k, M.tooth, { z0: 6, z1: 6 });
  }
  sk.np();
  ear(sk, H.p(-0.4, -2.2), H.ang(-1.9 + P.ear * 0.35), 3.1 * k, 1.5 * k, M.fur, M.inner, 4.5, 0, 1.4);
  const ec = H.p(3.3, -0.6);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 0.5 : 1 }, eye);
  whiskers(sk, H.p(6.8, 1.3), Math.cos(ha) >= 0 ? 1 : -1, 4.5 * k, hex('#f4e4c8'), 2, 0.3, 0.12);

  drawLeg(0);
  drawLeg(2);
  const hc = H.p(2.4, -2);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const ry = (5.4 + P.br * 0.35) * k;
  sk.np();
  sk.ell(-1 * k, -ry, 8 * k, ry, (p) => (p.v > 0.6 ? M.belly : p.v < -0.55 ? M.back : M.fur), { rz: 5 * k });
  sk.streaks(sk.pid, () => [-1, 0.3] as V2, { spacing: 3, len: 3, amp: 0.08 });
  // head resting on the forepaws at the front
  const H = new Frame2([3.2 * k, -6.6 * k], 0.42, k);
  sk.np();
  ear(sk, H.p(-0.2, -2.2), H.ang(-2.3), 2.6 * k, 1.3 * k, M.fur, M.inner, 11);
  const skull = H.p(2, -0.3);
  sk.ell(skull[0], skull[1], 3.4 * k, 2.9 * k, (p) => {
    if (p.v > 0.42) return M.belly;
    const mv = p.v - p.u * 0.28;
    return p.u > -0.35 && mv > -0.5 && mv < 0.18 ? M.mask : M.fur;
  }, { rot: H.a, z: 10 });
  const sn0 = H.p(4.1, 0.4), sn1 = H.p(6.4, 1.1);
  sk.tube([sn0, sn1], t => (1.7 - t * 0.7) * k, (p) => (p.v < -0.5 && p.t < 0.55 ? M.mask : M.belly), { z: 11 });
  const np = H.p(6.6, 0.9);
  sk.ell(np[0], np[1], 0.8 * k, 0.7 * k, M.nose, { z: 12 });
  const e = drawEye(sk, H.p(2.9, -0.5)[0], H.p(2.9, -0.5)[1], { ...EYE, r: 1 }, eye);
  // ringed tail wrapped round the front, under the chin
  tailDraw(sk, M, [-8.4 * k, -2.2 * k], 0.02, { ...P, tailWave: 0.3 }, k, 13);
  return { head: [0, -ry * 2 - 3] as V2, eye: e };
}

export const FLICKER: SpeciesDef = {
  name: 'Flicker Marten', kind: 'mammal', len: 44, height: 14,
  anims: ANIMS,
  canvas: () => ({ w: 96, h: 56, ox: 46, oy: 44 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'fight' || anim === 'taunt' ? 'angry' : 'open'),
};

// Tunnel Delver: colonial burrower, a meerkat / mole-rat mix with digging claws, small eyes,
// protruding incisors and banded sandy fur. Sentinels stand upright on their hind legs.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, chain, fr, cbez, along } from './beasts-core';
import { leg, LegSpec, scaleLeg, paw, ear, whiskers, Frame2 } from './beasts-rig';
import { hex } from './color';

interface P {
  hip: V2;           // hip position (local, adult px)
  spine: number;     // spine angle from hip to shoulder (0 = horizontal right, -PI/2 = upright)
  bend: number;      // spine arch (+ = hump up)
  head: number;      // head angle relative to the spine
  jaw: number; ear: number; br: number;
  feet: [V2, V2, V2, V2]; // world foot targets offsets (FLn, FLf, HLn, HLf)
  upright: number;   // 0..1 (hind feet flat, forepaws tucked at the chest)
  tail: number; tailLift: number;
  dirt: number; dirtPhase: number;
  sink: number;      // burrow: how far the body has dived below ground (0..1)
  hole: boolean;
  curl: number;      // sleep
  paws: number;      // forepaws raised to the face (groom)
}
const base = (): P => ({
  hip: [-5.2, -5.4], spine: -0.04, bend: 0.6, head: 0.1, jaw: 0, ear: 0, br: 0,
  feet: [[0, 0], [0, 0], [0, 0], [0, 0]], upright: 0, tail: 0, tailLift: 0, dirt: 0, dirtPhase: 0, sink: 0, hole: false, curl: 0, paws: 0,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 6, fps: 10, loop: true },
  run: { frames: 6, fps: 14, loop: true },
  eat: { frames: 3, fps: 6, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 5, loop: true },
  groom: { frames: 4, fps: 8, loop: true },
  dig: { frames: 4, fps: 10, loop: true },
  peek: { frames: 2, fps: 2, loop: true },
  burrow: { frames: 4, fps: 8, loop: false },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.head = 0.08 + (f === 2 ? -0.12 : 0);
      p.ear = f === 3 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.1;
      break;
    case 'walk': {
      const st = 4.2, lift = 1.6, duty = 0.6;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.hip = [-5.2, -5.4 + Math.cos(t * TAU * 2) * 0.35];
      p.head = 0.12 + Math.sin(t * TAU * 2) * 0.05;
      p.tail = Math.sin(t * TAU + 1) * 0.18;
      break;
    }
    case 'run': {
      // bounding gallop with a flexing spine
      const st = 7.5, lift = 2.6, duty = 0.4;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.08, duty, st, lift);
      p.feet[2] = gait(t + 0.5, duty, st, lift);
      p.feet[3] = gait(t + 0.58, duty, st, lift);
      const c = Math.cos(t * TAU);
      p.bend = 0.6 + c * 1.4;
      p.hip = [-5.2 + c * 0.8, -5.4 - Math.max(0, Math.sin(t * TAU)) * 1.5];
      p.spine = Math.sin(t * TAU) * 0.1;
      p.head = 0.02;
      p.ear = -1;
      p.tail = -0.25 + c * 0.2;
      p.tailLift = 0.3;
      break;
    }
    case 'eat':
      p.spine = 0.12;
      p.hip = [-5.2, -5.6];
      p.head = 0.55 + (f % 2) * 0.1;
      p.jaw = f === 1 ? 1 : 0.3;
      p.feet[0] = [1.6, 0];
      p.tail = 0.1;
      break;
    case 'alert':
      p.spine = -0.3;
      p.hip = [-4.4, -5.6];
      p.head = 0.05;
      p.ear = 1;
      p.feet[0] = [-1.5, -2.2];
      p.feet[1] = [-0.8, -1.4];
      p.tailLift = 0.2;
      p.tail = f * 0.1;
      break;
    case 'sleep':
      p.curl = 1;
      p.br = f;
      break;
    case 'call':
      p.upright = 0.6;
      p.spine = -1.1;
      p.hip = [-2.6, -4.6];
      p.head = 0.6 - f * 0.25;
      p.jaw = f ? 1 : 0.6;
      p.ear = 0.5;
      p.tail = 0.2;
      break;
    case 'groom':
      p.upright = 0.8;
      p.spine = -1.25;
      p.hip = [-2, -4.4];
      p.head = 0.9 + [0, 0.15, 0.05, 0.2][f];
      p.paws = [0.6, 1, 0.7, 1][f];
      p.tail = 0.3;
      break;
    case 'dig': {
      const a = f / 4;
      p.spine = 0.34;
      p.hip = [-5, -6.2];
      p.bend = 1.2;
      p.head = 0.35;
      p.feet[0] = [3 - fr(a) * 5.5, -Math.max(0, Math.sin(a * TAU)) * 2.4];
      p.feet[1] = [3 - fr(a + 0.5) * 5.5, -Math.max(0, Math.sin((a + 0.5) * TAU)) * 2.4];
      p.feet[2] = [-0.8, 0];
      p.feet[3] = [0.6, 0];
      p.dirt = 1;
      p.dirtPhase = a;
      p.tail = 0.5;
      p.tailLift = 0.4;
      p.ear = -1;
      break;
    }
    case 'peek':
      // upright sentinel
      p.upright = 1;
      p.spine = -1.5 + (f ? 0.04 : 0);
      p.hip = [-1.5, -4.2];
      p.bend = -0.3;
      p.head = 1.45 - (f ? 0.25 : 0);
      p.ear = 1;
      p.br = f;
      p.tail = 0.25;
      break;
    case 'burrow': {
      // dives head first into the burrow; last frame is almost gone
      p.hole = true;
      p.sink = [0.12, 0.42, 0.72, 0.95][f];
      p.spine = [0.42, 0.85, 1.15, 1.32][f];
      p.hip = [[-6.4, -6], [-3.4, -7.2], [-0.2, -5.4], [2.2, -2.4]][f] as V2;
      p.bend = 0.4;
      p.head = 0.4;
      p.ear = -1;
      p.tail = [0.4, 0.8, 1.2, 1.5][f];
      p.tailLift = 0.6;
      p.dirt = f < 3 ? 1 : 0.6;
      p.dirtPhase = f / 4;
      break;
    }
  }
  return p;
}

const EYE: EyeSpec = { r: 1, iris: hex('#1c120e'), lash: hex('#3c2a1e'), dark: true };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#b98a5a', { n: 6, dark: 0.6 }), { edge: 1 }),
    band: sk.m(rmp('#6a472e', { n: 5, dark: 0.55 }), { edge: 1 }),
    belly: sk.m(rmp('#e6cb9e', { n: 5, dark: 0.45, at: 3 }), { edge: 1 }),
    patch: sk.m(rmp('#4c3424', { n: 4, dark: 0.5 })),
    nose: sk.m(rmp('#d88f82', { n: 4, dark: 0.45 })),
    claw: sk.m(rmp('#f1e5c8', { n: 4, dark: 0.45 })),
    tooth: sk.m(rmp('#f2dfa4', { n: 3, dark: 0.3 }), { edge: 0 }),
    inner: sk.m(rmp('#c88a7c', { n: 4, dark: 0.5 })),
    soil: sk.m(rmp('#6c4c32', { n: 4, dark: 0.55 })),
    hole: sk.m(rmp('#1c120e', { n: 2, dark: 0.3 }), { noRim: true, edge: 0 }),
    mouth: sk.m(rmp('#4a1c24', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.65 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(P.hip);
  const spL = 10.5 * k;
  const sa = P.spine;
  const sh: V2 = [hip[0] + Math.cos(sa) * spL, hip[1] + Math.sin(sa) * spL];
  // arch control point: perpendicular (dorsal side) offset
  const nx = Math.sin(sa), ny = -Math.cos(sa);
  const c1: V2 = [hip[0] + Math.cos(sa) * spL * 0.33 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.33 + ny * P.bend * k];
  const c2: V2 = [hip[0] + Math.cos(sa) * spL * 0.7 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.7 + ny * P.bend * k];
  const rump: V2 = [hip[0] - Math.cos(sa) * 2.2 * k, hip[1] - Math.sin(sa) * 2.2 * k];
  const spine = [rump, ...cbez(hip, c1, c2, sh, 6)];
  const neckEnd = along(spine, 1);
  const upright = P.upright;

  // ---- legs (far first)
  const FL: LegSpec = scaleLeg({ l1: 3.2, l2: 3.1, r1: 1.7, r2: 1.2, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 3.6, l2: 3.4, r1: 2.3, r2: 1.3, bend: -1 }, k);
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const z = near ? 4 : -4, bias = near ? 0 : -0.14;
    sk.np();
    if (front) {
      const shp = along(spine, 0.86).p;
      const hipF: V2 = [shp[0] + 0.3 * k * Math.sin(sa), shp[1] + 1.4 * k];
      let foot: V2 = [(5.2 + P.feet[which][0]) * k, (-0.9 + P.feet[which][1]) * k];
      if (upright > 0.5) {
        // forepaws held at the chest (or raised to the face when grooming)
        const chest = along(spine, 0.78).p;
        foot = [chest[0] + (2.4 + (near ? 0.4 : -0.3)) * k, chest[1] + (1.4 - P.paws * 3.4) * k];
      }
      const j = leg(sk, hipF, foot, FL, M.fur, z, 0, bias);
      paw(sk, j[2], k, M.band, M.claw, z, { n: 3, clawLen: 2.1, bias, down: upright > 0.5 ? 1.2 : 0.55 });
    } else {
      const hipH: V2 = [hip[0], hip[1] + 1.2 * k];
      let foot: V2 = [(-4.6 + P.feet[which][0]) * k, (-0.9 + P.feet[which][1]) * k];
      if (upright > 0.5) foot = [hip[0] + (2.2 + (near ? 0.5 : -0.6)) * k, -0.9 * k];
      const j = leg(sk, hipH, foot, HL, M.fur, z, 0, bias);
      paw(sk, j[2], k, M.band, M.claw, z, { n: 2, clawLen: 1.2, bias, w: upright > 0.5 ? 2.4 : 1.8 });
    }
  };
  drawLeg(1);
  drawLeg(3);

  // ---- tail: thin, tapering, dark tip
  sk.np();
  const tailA = Math.PI + sa - 0.35 + P.tail - P.tailLift * 1.2 + (upright ? 1.2 * upright : 0);
  const tpts = chain(rump, tailA, 5, 1.6 * k, i => 0.12 + (upright > 0.5 ? 0.1 : 0) - i * 0.02 * P.tailLift);
  sk.tube(tpts, t => (1.5 - 1.0 * t) * k, (p) => (p.t > 0.8 ? M.patch : p.v > 0.3 ? M.belly : M.fur), { z: -1 });

  // ---- body
  sk.np();
  const rad = (t: number) => (t < 0.5 ? 3.4 + t * 1.4 : 4.1 - (t - 0.5) * 2.4) * k * (1 + P.br * 0.03);
  sk.tube(spine, rad, (p) => {
    if (p.v > 0.42) return M.belly;
    // meerkat-like dorsal bands
    const b = p.t * 6 + p.v * 0.35;
    if (p.v < -0.3 && b - Math.floor(b) < 0.42 && p.t > 0.1 && p.t < 0.84) return M.band;
    if (p.v < -0.86) return M.band;
    return M.fur;
  }, { z: 0 });
  const bodyPart = sk.pid;
  sk.streaks(bodyPart, () => [-1, 0.25] as V2, { spacing: 4, len: 3, amp: 0.06 });
  sk.tufts(bodyPart, (_x, _y, nx2, ny2) => (ny2 > 0 ? [-0.4, 1] : nx2 < 0 && ny2 < 0 ? [-1, -0.2] : null), { every: 3, len: 1 });

  // ---- head
  const ha = sa + P.head;
  const H = new Frame2(neckEnd.p, ha, k);
  sk.np();
  ear(sk, H.p(0.4, -2.6), H.ang(-2.1 + P.ear * 0.3), 1.6 * k, 0.9 * k, M.band, 0, -1.5, -0.15, 1.5);
  sk.np();
  const skull = H.p(2.2, -0.2);
  sk.ell(skull[0], skull[1], 3.7 * k, 3.1 * k, (p) => (p.v > 0.4 ? M.belly : M.fur), { rot: ha, rz: 3 * k, z: 1.5 });
  // blunt mole-rat muzzle
  const mz = H.p(5.2, 0.6);
  sk.ell(mz[0], mz[1], 2.2 * k, 1.9 * k, (p) => (p.v > 0.2 ? M.belly : M.fur), { rot: ha, rz: 2 * k, z: 3 });
  const np = H.p(7.1, 0.3);
  sk.ell(np[0], np[1], 0.95 * k, 0.9 * k, M.nose, { z: 5 });
  // incisors
  const tth = H.p(6.4, 2.2 + P.jaw * 0.6);
  sk.blade(tth[0], tth[1] - 0.6 * k, tth[0] + 0.2 * k, tth[1] + 0.8 * k, () => 0.5 * k, M.tooth, { z0: 6, z1: 6 });
  if (P.jaw > 0.5) {
    const m0 = H.p(4.4, 2), m1 = H.p(6.2, 2.4);
    sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.2, 8, true);
  }
  // dark eye patch
  const ec = H.p(3.2, -0.9);
  sk.ell(ec[0], ec[1], 1.9 * k, 1.5 * k, M.patch, { rot: ha, z: 5, noZ: false });
  sk.np();
  ear(sk, H.p(-0.1, -2.3), H.ang(-2 + P.ear * 0.35), 1.8 * k, 1.05 * k, M.fur, M.inner, 4.5, 0, 1.5);
  const ep = drawEye(sk, ec[0] + 0.3 * k, ec[1], { ...EYE, r: k < 0.8 ? 0.5 : 1 }, eye);
  whiskers(sk, H.p(6.2, 1.2), Math.cos(ha) >= 0 ? 1 : -1, 3.5 * k, hex('#f0e2c4'), 2, 0.35, 0.1);

  drawLeg(0);
  drawLeg(2);

  // ---- burrow hole and flung dirt
  if (P.hole) {
    sk.np();
    sk.ell(5.5 * k, -0.4, 4.6 * k, 1.4 * k, M.hole, { z: -20, noZ: true });
    sk.ell(11.5 * k, -0.6, 3.2 * k, 1.6 * k, M.soil, { z: 30, bias: 0.06 });
  }
  if (P.dirt) {
    sk.np();
    const n2 = Math.round(5 * P.dirt);
    for (let i = 0; i < n2; i++) {
      const ph = fr(P.dirtPhase + i / 5);
      const x = (P.hole ? 2 - ph * 14 : -9 - ph * 12) * k, y = (-1.5 - Math.sin(ph * Math.PI) * (5 + (i % 3) * 2)) * k;
      const r = (i % 2 ? 0.8 : 1.2) * k;
      sk.ell(x, y, r * 1.1, r, M.soil, { z: 30 + i * 0.01 });
    }
    if (!P.hole) sk.ell(11 * k, -0.3, 2.8 * k, 1.2 * k, M.soil, { z: 30, bias: 0.06 });
  }
  const hc = H.p(2.5, -1.5);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

function drawCurled(sk: Sk, M: ReturnType<typeof mats>, P: P, k: number, eye: BeastEye) {
  // curled up asleep, tail wrapped around
  sk.np();
  const ry = (4.8 + P.br * 0.3) * k;
  sk.ell(0, -ry, 7.5 * k, ry, (p) => {
    if (p.v > 0.55) return M.belly;
    const a = Math.atan2(p.v, p.u) * 2.4;
    if (p.v < -0.2 && a - Math.floor(a) < 0.3) return M.band;
    return M.fur;
  }, { rz: 5 * k });
  sk.np();
  const hc: V2 = [5 * k, -3 * k];
  sk.ell(hc[0], hc[1], 3.2 * k, 2.8 * k, M.fur, { z: 6, rot: 0.6 });
  sk.ell(hc[0] + 1.5 * k, hc[1] + 1.6 * k, 1.8 * k, 1.4 * k, M.belly, { z: 8, rot: 0.6 });
  const e = drawEye(sk, hc[0] + 0.6 * k, hc[1] - 0.2 * k, { ...EYE, r: 1 }, eye);
  sk.np();
  const tpts = chain([-6 * k, -2 * k], 1.9, 5, 1.8 * k, () => -0.35);
  sk.tube(tpts, t => (1.4 - 0.8 * t) * k, (p) => (p.t > 0.8 ? M.patch : M.fur), { z: 7 });
  return { head: [0, -ry * 2 - 2] as V2, eye: e };
}

export const DELVER: SpeciesDef = {
  name: 'Tunnel Delver', kind: 'mammal', len: 26, height: 10,
  anims: ANIMS,
  canvas: () => ({ w: 52, h: 42, ox: 24, oy: 34 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' || anim === 'peek' ? 'alert' : 'open'),
};

// Sail Possum: huge-eyed arboreal possum with a furred skin sail (patagium) from wrists to ankles,
// a dark dorsal stripe and a bushy tail. Nectar feeder. Glides in a 3/4 top view (sail spread),
// climbs trunks (vertical, facing up, trunk on its right) and laps nectar with a long tongue.

import { Sk, V2, V3, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, chain, fr, cbez, along, proj, poly3 } from './beasts-core';
import { leg, LegSpec, scaleLeg, paw, ear, whiskers, Frame2 } from './beasts-rig';
import { hex } from './color';

interface P {
  hip: V2; spine: number; bend: number; head: number; jaw: number; ear: number; br: number;
  feet: [V2, V2, V2, V2]; // absolute foot targets (adult px) FLn, FLf, HLn, HLf
  tail: number; tailCurl: number;
  upright: number; paws: number; tongue: number;
  glide: number;          // glide frame (1 = on)
  billow: number;
  curl: number;           // sleep
  climb: boolean;
}
const base = (): P => ({
  hip: [-6, -6.2], spine: -0.05, bend: 0.8, head: 0.02, jaw: 0, ear: 0, br: 0,
  feet: [[5.5, 0], [5.5, 0], [-6, 0], [-6, 0]], tail: 0, tailCurl: 0, upright: 0, paws: 0, tongue: 0,
  glide: 0, billow: 0, curl: 0, climb: false,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 6, fps: 9, loop: true },
  run: { frames: 6, fps: 13, loop: true },
  eat: { frames: 3, fps: 6, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 5, loop: true },
  groom: { frames: 4, fps: 8, loop: true },
  glide: { frames: 2, fps: 4, loop: true },
  climb: { frames: 4, fps: 8, loop: true },
  feed: { frames: 4, fps: 7, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  const ft = (i: number, off: V2) => { p.feet[i] = [p.feet[i][0] + off[0], p.feet[i][1] + off[1]]; };
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.head = f === 2 ? -0.1 : 0.02;
      p.ear = f === 3 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.08;
      break;
    case 'walk': {
      const st = 4.4, lift = 1.8, duty = 0.6;
      ft(2, gait(t, duty, st, lift)); ft(0, gait(t + 0.25, duty, st, lift));
      ft(3, gait(t + 0.5, duty, st, lift)); ft(1, gait(t + 0.75, duty, st, lift));
      p.hip = [-6, -6.2 + Math.cos(t * TAU * 2) * 0.4];
      p.head = Math.sin(t * TAU * 2) * 0.05;
      p.tail = Math.sin(t * TAU + 1.3) * 0.15;
      break;
    }
    case 'run': {
      const st = 7.5, lift = 2.8, duty = 0.4;
      ft(0, gait(t, duty, st, lift)); ft(1, gait(t + 0.1, duty, st, lift));
      ft(2, gait(t + 0.5, duty, st, lift)); ft(3, gait(t + 0.6, duty, st, lift));
      const c = Math.cos(t * TAU);
      p.bend = 0.8 + c * 1.3;
      p.hip = [-6 + c * 0.8, -6.4 - Math.max(0, Math.sin(t * TAU)) * 1.8];
      p.spine = Math.sin(t * TAU) * 0.1;
      p.ear = -1;
      p.tail = -0.2 + c * 0.2;
      break;
    }
    case 'eat':
      // sitting up nibbling a blossom held in the forepaws
      p.upright = 0.85; p.spine = -1.15; p.hip = [-3, -5];
      p.head = 0.9 + (f % 2) * 0.12; p.paws = 0.75; p.jaw = f === 1 ? 1 : 0.3;
      p.tail = 0.4; p.tailCurl = 0.3;
      break;
    case 'alert':
      p.spine = -0.35; p.hip = [-5.4, -6.4]; p.head = 0.15; p.ear = 1;
      ft(0, [-1.5, -2.4]); ft(1, [-1, -1.8]);
      p.tail = 0.2;
      break;
    case 'sleep':
      p.curl = 1; p.br = f;
      break;
    case 'call':
      p.upright = 0.6; p.spine = -0.9; p.hip = [-4, -5];
      p.head = 0.35 - f * 0.25; p.jaw = f ? 1 : 0.5; p.ear = 0.6;
      p.tail = 0.25;
      break;
    case 'groom':
      p.upright = 0.85; p.spine = -1.2; p.hip = [-3, -5];
      p.head = 1.1 + [0, 0.2, 0.05, 0.25][f]; p.paws = [0.7, 1, 0.75, 1][f];
      p.tail = 0.4; p.tailCurl = 0.4;
      break;
    case 'feed':
      // reaching up to a blossom, long tongue lapping nectar
      p.upright = 0.75; p.spine = -1.0; p.hip = [-4, -5];
      p.head = 0.35; p.paws = 1.25; p.jaw = 0.6;
      p.tongue = [0.35, 1, 0.65, 1][f]; p.ear = 0.4;
      p.tail = 0.35; p.tailCurl = 0.25;
      break;
    case 'glide':
      p.glide = 1; p.billow = f; p.tail = f ? 0.06 : -0.04;
      break;
    case 'climb': {
      // vertical, head up, belly against a trunk on the right (trunk surface at x = 0)
      p.climb = true;
      const s = f / 4;
      const c = Math.sin(s * TAU);
      p.hip = [-5.2, 7 + c * 0.6];
      p.spine = -Math.PI / 2 - 0.06;
      p.bend = 0.9;
      p.head = 0.25;
      p.feet = [
        [-0.8, -7 + gait(s, 0.55, 5, 0)[0]], [-0.8, -7 + gait(s + 0.5, 0.55, 5, 0)[0]],
        [-0.8, 7 + gait(s + 0.5, 0.55, 5, 0)[0]], [-0.8, 7 + gait(s, 0.55, 5, 0)[0]],
      ];
      p.tail = 0;
      break;
    }
  }
  return p;
}

const EYE: EyeSpec = { r: 2.2, iris: hex('#1a1216'), lash: hex('#2a2430'), dark: true };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#8f8a9c', { n: 6, dark: 0.62 })),
    stripe: sk.m(rmp('#3b3444', { n: 5, dark: 0.5 })),
    belly: sk.m(rmp('#efe5d6', { n: 5, dark: 0.42, at: 3 })),
    sail: sk.m(rmp('#77718a', { n: 6, dark: 0.6, light: 0.35 }), { edge: 1 }),
    sailD: sk.m(rmp('#4a4456', { n: 5, dark: 0.55 }), { edge: 1, bias: -0.18 }),
    edge: sk.m(rmp('#ece2cf', { n: 4, dark: 0.35, at: 2 })),
    nose: sk.m(rmp('#e79aa2', { n: 4, dark: 0.45 })),
    inner: sk.m(rmp('#d8a2a6', { n: 4, dark: 0.45 })),
    tip: sk.m(rmp('#2c2733', { n: 4, dark: 0.45 })),
    pad: sk.m(rmp('#d9a8a4', { n: 4, dark: 0.45 })),
    tongue: sk.m(rmp('#ee8aa0', { n: 4, dark: 0.45 })),
    mouth: sk.m(rmp('#4a1c24', { n: 3, dark: 0.4 }), { edge: 0 }),
    claw: sk.m(rmp('#e8ddd0', { n: 3, dark: 0.4 })),
  };
}
type M = ReturnType<typeof mats>;

/** Bushy tail: a thick tube with fur tufts and a dark tip. */
function bushyTail(sk: Sk, M: M, pts: V2[], k: number, z: number, fat = 1) {
  sk.np();
  sk.tube(pts, t => (1.6 + Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * 1.6 - t * 0.6) * k * fat, (p) => (p.t > 0.78 ? M.tip : p.v > 0.45 ? M.stripe : M.fur), { z });
  const tp = sk.pid;
  sk.tufts(tp, (_x, _y, nx, ny) => [nx * 0.7 - 0.5, ny * 0.9 + 0.2] as V2, { every: 2, len: 1 });
  sk.streaks(tp, () => [-1, 0.4] as V2, { spacing: 3, len: 2, amp: 0.1 });
}

function head(sk: Sk, M: M, H: Frame2, P: P, k: number, eye: BeastEye, z = 0) {
  const ha = H.a;
  sk.np();
  // far ear
  ear(sk, H.p(0.6, -3.2), H.ang(-2.2 + P.ear * 0.3), 3.4 * k, 1.9 * k, M.fur, 0, z - 2, -0.16, 1.1);
  sk.np();
  const skull = H.p(2.4, -0.3);
  sk.ell(skull[0], skull[1], 4.6 * k, 4 * k, (p) => {
    if (p.v > 0.35 && p.u > -0.4) return M.belly;
    // dark stripe from the crown down the nose ridge
    if (p.v < -0.55 && p.u > -0.5 && p.u < 0.45) return M.stripe;
    return M.fur;
  }, { rot: ha, rz: 3.8 * k, z: z + 1.5 });
  const hp = sk.pid;
  sk.tufts(hp, (_x, _y, nx, ny) => (ny > 0 && nx <= 0 ? [-0.6, 1] as V2 : null), { every: 2, len: 1 });
  const mz = H.p(5.8, 0.9);
  sk.ell(mz[0], mz[1], 2.3 * k, 1.9 * k, (p) => (p.v > 0.1 ? M.belly : M.fur), { rot: ha + 0.1, rz: 2 * k, z: z + 3 });
  const np = H.p(7.8, 0.6);
  sk.ell(np[0], np[1], 0.95 * k, 0.85 * k, M.nose, { z: z + 5 });
  if (P.jaw > 0.4) {
    const m0 = H.p(5.4, 2.2), m1 = H.p(7.2, 2.2 + P.jaw * 0.8);
    sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.2, z + 8, true);
  }
  if (P.tongue > 0) {
    sk.np(true);
    const t0 = H.p(7.4, 1.6);
    const a = H.ang(-0.35);
    const L = (2 + P.tongue * 5) * k;
    const t1: V2 = [t0[0] + Math.cos(a) * L * 0.6, t0[1] + Math.sin(a) * L * 0.6 + 0.4];
    const t2: V2 = [t0[0] + Math.cos(a) * L, t0[1] + Math.sin(a) * L];
    sk.tube([t0, t1, t2], t2v => (0.75 - t2v * 0.25) * k, M.tongue, { z: z + 9 });
  }
  // eye stripe through the huge eye
  sk.np();
  ear(sk, H.p(-0.2, -2.8), H.ang(-1.95 + P.ear * 0.35), 3.8 * k, 2.1 * k, M.fur, M.inner, z + 5, 0, 1.1);
  const ec = H.p(3.6, -0.7);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 1.2 : 2.2 }, eye);
  whiskers(sk, H.p(6.6, 1.4), Math.cos(ha) >= 0 ? 1 : -1, 5 * k, hex('#d8d0dc'), 3, 0.3, 0.12);
  return { ep, hc: H.p(2.4, -2.5) };
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.65 : 1;
  const M = mats(sk);
  const P = pose(anim, frame, n);
  if (P.glide) return drawGlide(sk, M, P, k, eye);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  if (!P.climb) sk.clipY = 0;
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(P.hip);
  const spL = 10.5 * k, sa = P.spine;
  const sh: V2 = [hip[0] + Math.cos(sa) * spL, hip[1] + Math.sin(sa) * spL];
  const nx = Math.sin(sa), ny = -Math.cos(sa);
  const c1: V2 = [hip[0] + Math.cos(sa) * spL * 0.33 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.33 + ny * P.bend * k];
  const c2: V2 = [hip[0] + Math.cos(sa) * spL * 0.7 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.7 + ny * P.bend * k];
  const rump: V2 = [hip[0] - Math.cos(sa) * 2.4 * k, hip[1] - Math.sin(sa) * 2.4 * k];
  const spine = [rump, ...cbez(hip, c1, c2, sh, 6)];
  const neck = along(spine, 1).p;
  const up = P.upright;

  const FL: LegSpec = scaleLeg({ l1: 3.2, l2: 3, r1: 1.7, r2: 1.2, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 3.7, l2: 3.4, r1: 2.4, r2: 1.4, bend: -1 }, k);
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const z = near ? 4.5 : -4.5, bias = near ? 0 : -0.14;
    sk.np();
    if (front) {
      const shp = along(spine, 0.84).p;
      const root: V2 = [shp[0] + Math.sin(sa) * 0.5 * k - (P.climb ? 0 : 0), shp[1] + Math.cos(sa) * 1.4 * k];
      let foot = S(P.feet[which]);
      if (!P.climb) foot = [foot[0], foot[1] - 0.9 * k];
      if (up > 0.5) {
        const chest = along(spine, 0.78).p;
        foot = [chest[0] + (2.6 + (near ? 0.4 : -0.3) + P.paws * 1.2) * k, chest[1] + (1.2 - P.paws * 3.2) * k];
      }
      const j = leg(sk, root, foot, FL, M.fur, z, 0, bias);
      paw(sk, j[2], k, M.pad, M.claw, z, { n: 2, clawLen: 0.6, bias, w: 1.3, h: 1, down: P.climb ? 0.3 : 0.5 });
    } else {
      const root: V2 = [hip[0] + Math.sin(sa) * 0.3 * k, hip[1] + Math.cos(sa) * 1.2 * k];
      let foot = S(P.feet[which]);
      if (!P.climb) foot = [foot[0], foot[1] - 0.9 * k];
      if (up > 0.5) foot = [hip[0] + (2.4 + (near ? 0.5 : -0.6)) * k, -0.9 * k];
      const j = leg(sk, root, foot, HL, M.fur, z, 0, bias);
      paw(sk, j[2], k, M.pad, M.claw, z, { n: 2, clawLen: 0.6, bias, w: 1.7, h: 1, down: P.climb ? 0.3 : 0.5 });
    }
  };
  drawLeg(1);
  drawLeg(3);

  // tail
  const tailA = Math.PI + sa - 0.2 + P.tail + (up ? 1.1 * up : 0) + (P.climb ? 0.55 : 0);
  const tpts = chain(rump, tailA, 10, 1.9 * k, i => (P.climb ? -0.05 : 0.1 + (up > 0.5 ? 0.12 : 0)) + P.tailCurl * 0.1 * (i > 5 ? 1 : 0) - (P.climb ? 0 : i * 0.008));
  bushyTail(sk, M, tpts, k, -2);

  // body with a slack sail fold along the flank
  sk.np();
  const rad = (t: number) => (t < 0.45 ? 3.6 + t * 1.6 : 4.3 - (t - 0.45) * 2.6) * k * (1 + P.br * 0.03);
  sk.tube(spine, rad, (p) => {
    if (p.v > 0.5) return M.belly;
    if (p.v < -0.78) return M.stripe;
    // folded patagium: a paler fringe line low on the flank
    if (!P.climb && p.v > 0.32 && p.v < 0.48 && p.t > 0.25 && p.t < 0.85) return M.edge;
    return M.fur;
  }, { z: 0 });
  const bp = sk.pid;
  sk.streaks(bp, () => [Math.cos(sa + Math.PI), Math.sin(sa + Math.PI) + 0.25] as V2, { spacing: 3, len: 2, amp: 0.08 });
  sk.tufts(bp, (_x, _y, nx2, ny2) => (ny2 > 0 || (P.climb && nx2 > 0) ? [nx2 * 0.5 - 0.4, 0.9] as V2 : null), { every: 2, len: 1 });

  const H = new Frame2(neck, sa + P.head, k);
  const { ep, hc } = head(sk, M, H, P, k, eye);
  drawLeg(0);
  drawLeg(2);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

/** Sail membrane fill: fur streaks radiating from the flank, darker near the body, a dark band inside the pale margin. */
function sailFill(M: M, p: { x: number; y: number; l: number }, edgeY: (x: number) => number, bodyY: number, k: number) {
  const ey = edgeY(p.x);
  const span = Math.abs(ey - bodyY) || 1;
  const d = Math.abs(p.y - bodyY) / span; // 0 at the flank .. 1 at the margin
  p.l += d * 0.14 - 0.08;
  if (d > 0.9) return M.edge;
  if (d > 0.7) return M.sailD;
  // radiating fur lines
  const f = p.x / k * 0.42 + (p.y - bodyY) / k * 0.18;
  if (Math.abs(f - Math.round(f)) < 0.1 && d > 0.25) p.l -= 0.09;
  return M.sail;
}

/** Gliding: 3/4 top view with the sail spread between wrists and ankles; anchor = body centre. */
function drawGlide(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const b = P.billow;
  const K = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k];
  const PHI = 0.95;
  const S2 = (p: V3): V2 => { const q = proj(p, PHI); return [q[0], q[1]]; };
  const wristN = K(10.5, -0.6 + b * 0.4, 19), ankleN = K(-10, -0.4 + b * 0.3, 18);
  const wristF = K(10.5, -0.6 + b * 0.4, -19), ankleF = K(-10, -0.4 + b * 0.3, -18);
  const shN = K(4.5, 0.4, 2.2), hipN = K(-6, 0.4, 2.2), shF = K(4.5, 0.4, -2.2), hipF = K(-6, 0.4, -2.2);
  const sag = 5 + b * 1.2;
  const edgeN: V3[] = [wristN, K(4, 0, 19 - sag), K(-2, -0.2, 18.5 - sag), K(-7, 0, 18 - sag * 0.8), ankleN];
  const edgeF: V3[] = [wristF, K(4, 0, -19 + sag), K(-2, -0.2, -18.5 + sag), K(-7, 0, -18 + sag * 0.8), ankleF];
  const edgeYOf = (e: V3[]) => {
    const sp = e.map(S2);
    return (x: number) => {
      for (let i = 1; i < sp.length; i++) {
        const [x0, y0] = sp[i - 1], [x1, y1] = sp[i];
        if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0 || 1));
      }
      return sp[x > sp[0][0] ? 0 : sp.length - 1][1];
    };
  };
  const eyN = edgeYOf(edgeN), eyF = edgeYOf(edgeF);
  const byN = S2(K(0, 0.4, 2.2))[1], byF = S2(K(0, 0.4, -2.2))[1];
  // far sail + limbs
  sk.np();
  poly3(sk, 0, 0, [shF, ...edgeF, hipF], (p) => { p.l -= 0.14; return sailFill(M, p, eyF, byF, k); }, { phi: PHI });

  sk.np();
  sk.tube(edgeF.map(S2), 0.6 * k, M.edge, { z: -8, bias: -0.05 });
  sk.np();
  sk.tube([S2(shF), S2(wristF)], 1.3 * k, M.fur, { z: -6, bias: -0.1 });
  sk.tube([S2(hipF), S2(ankleF)], 1.5 * k, M.fur, { z: -6, bias: -0.1 });
  const pw = S2(wristF), pa = S2(ankleF);
  sk.ell(pw[0] + 0.8 * k, pw[1], 1.2 * k, 1 * k, M.pad, { z: -5 });
  sk.ell(pa[0] - 0.8 * k, pa[1], 1.3 * k, 1 * k, M.pad, { z: -5 });
  // tail streaming behind
  const tb = S2(K(-8.5, 0.2, 0));
  const tpts = chain(tb, Math.PI + 0.04 + P.tail, 11, 2 * k, i => (i < 5 ? -0.02 : 0.03) + P.tail * 0.02);
  bushyTail(sk, M, tpts, k, -1, 1.05);
  // body seen from above-side: dorsal stripe along the top
  sk.np();
  const body = [S2(K(-9, 0.3, 0)), S2(K(-3, 0.5, 0)), S2(K(3, 0.5, 0)), S2(K(7, 0.2, 0))];
  sk.tube(body, t => (3.8 + Math.sin(t * Math.PI) * 0.9) * k, (p) => (p.v < -0.66 ? M.stripe : p.v > 0.7 ? M.belly : M.fur), { z: 0 });
  sk.streaks(sk.pid, () => [-1, 0.2] as V2, { spacing: 3, len: 2, amp: 0.08 });
  // near sail over the body's near flank
  sk.np();
  poly3(sk, 0, 0, [shN, ...edgeN, hipN], (p) => sailFill(M, p, eyN, byN, k), { zb: 3, phi: PHI });

  sk.np();
  sk.tube(edgeN.map(S2), 0.6 * k, M.edge, { z: 12 });
  sk.np();
  sk.tube([S2(shN), S2(wristN)], 1.5 * k, M.fur, { z: 13 });
  sk.tube([S2(hipN), S2(ankleN)], 1.7 * k, M.fur, { z: 13 });
  const qw = S2(wristN), qa = S2(ankleN);
  sk.ell(qw[0] + 0.8 * k, qw[1], 1.3 * k, 1.1 * k, M.pad, { z: 14 });
  sk.ell(qa[0] - 0.8 * k, qa[1], 1.4 * k, 1.1 * k, M.pad, { z: 14 });
  // head, slightly lifted, ears laid back
  const H = new Frame2(S2(K(7.5, 0.6, 0.6)), -0.08, k);
  const { ep, hc } = head(sk, M, H, { ...P, ear: -1 }, k, eye, 6);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  sk.clipY = 0;
  const ry = (5.4 + P.br * 0.35) * k;
  // round sleeping body
  sk.np();
  sk.ell(-0.5 * k, -ry, 7.6 * k, ry, (p) => (p.v > 0.55 ? M.belly : p.v < -0.75 ? M.stripe : M.fur), { rz: 5 * k });
  sk.streaks(sk.pid, () => [-1, 0.3] as V2, { spacing: 3, len: 2, amp: 0.08 });
  // head tucked low at the front, nose to the tail tip
  const H = new Frame2([2.6 * k, -6.2 * k], 0.5, k);
  const { ep } = head(sk, M, H, { ...P, ear: -0.6 }, k, eye, 4);
  // bushy tail wrapped over the back and round the front like a blanket
  const tpts = chain([-7.4 * k, -1.8 * k], 0.25, 9, 1.9 * k, i => (i < 5 ? -0.05 : -0.22));
  bushyTail(sk, M, tpts, k, 10, 0.95);
  return { head: [0, -ry * 2 - 3] as V2, eye: ep };
}

export const SAILGLIDER: SpeciesDef = {
  name: 'Sail Possum', kind: 'mammal', len: 28, height: 14,
  anims: ANIMS,
  canvas: (anim) => (anim === 'glide' ? { w: 96, h: 64, ox: 46, oy: 30 } : anim === 'climb' ? { w: 70, h: 70, ox: 44, oy: 34 } : { w: 80, h: 56, ox: 40, oy: 44 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : 'open'),
  anchor: { glide: 'centre', climb: 'grip' },
};
void fr;

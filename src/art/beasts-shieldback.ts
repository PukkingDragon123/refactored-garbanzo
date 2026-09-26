// Shieldback: armadillo-like insect forager with osteoderm bands edged in paler rims. Rolls into a ball.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, kf, TAU, chain, hh, fr, add } from './beasts-core';
import { Frame2, leg, LegSpec } from './beasts-rig';
import { hex } from './color';

interface P {
  bx: number; by: number; tilt: number; br: number;
  feet: [V2, V2, V2, V2]; // FL near, FL far, HL near, HL far (offsets from rest)
  head: number; hdx: number; hdy: number; jaw: number; tongue: number; ear: number; sniff: number;
  tail: number; curl: number;
  tuck: number; // 0..1 legs folded under (sleep)
  dirt: number; dirtPhase: number;
}
const base = (): P => ({
  bx: 0, by: 0, tilt: 0, br: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]],
  head: 0, hdx: 0, hdy: 0, jaw: 0, tongue: 0, ear: 0, sniff: 0, tail: 0, curl: 0, tuck: 0, dirt: 0, dirtPhase: 0,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 8, fps: 9, loop: true },
  run: { frames: 6, fps: 13, loop: true },
  eat: { frames: 4, fps: 6, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 4, loop: true },
  groom: { frames: 4, fps: 7, loop: true },
  ball: { frames: 1, fps: 1, loop: true },
  roll: { frames: 4, fps: 12, loop: true },
  dig: { frames: 4, fps: 9, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle': {
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.sniff = f === 1 ? 1 : f === 2 ? 0.5 : 0;
      p.head = 0.05 + (f === 2 ? 0.08 : 0);
      p.ear = f === 3 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.05;
      break;
    }
    case 'walk': {
      const st = 4.6, lift = 1.6, duty = 0.62;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.45;
      p.tilt = Math.sin(t * TAU) * 0.02;
      p.head = 0.12 + Math.sin(t * TAU) * 0.06;
      p.sniff = f % 4 === 1 ? 1 : 0;
      p.tail = Math.sin(t * TAU + 1.2) * 0.12;
      break;
    }
    case 'run': {
      const st = 8, lift = 2.6, duty = 0.45;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[3] = gait(t + 0.06, duty, st, lift);
      p.feet[1] = gait(t + 0.5, duty, st, lift);
      p.feet[2] = gait(t + 0.56, duty, st, lift);
      p.by = -Math.abs(Math.sin(t * TAU)) * 1.2 + 0.4;
      p.tilt = Math.sin(t * TAU) * 0.05;
      p.head = -0.05 + Math.sin(t * TAU + 1) * 0.05;
      p.hdx = 0.8;
      p.tail = -0.1 + Math.sin(t * TAU + 2) * 0.15;
      p.ear = -1;
      break;
    }
    case 'eat': {
      p.tilt = 0.12;
      p.by = 0.6;
      p.head = 0.55 + (f % 2) * 0.08;
      p.hdx = 0.6;
      p.feet[0] = [1.5, 0];
      p.feet[1] = [0.5, 0];
      p.tongue = f === 1 ? 1 : f === 3 ? 0.6 : 0;
      p.sniff = f % 2;
      p.tail = 0.05;
      break;
    }
    case 'alert': {
      p.tilt = -0.2;
      p.by = -0.6;
      p.head = -0.42;
      p.feet[0] = [-1.2, -1.6];
      p.feet[1] = [-0.5, -1.2];
      p.ear = 1;
      p.sniff = f;
      p.tail = 0.1;
      break;
    }
    case 'sleep': {
      p.tuck = 1;
      p.by = 3.2;
      p.br = f;
      p.head = 1.5;
      p.hdx = -3.2;
      p.hdy = 1.2;
      p.curl = 1;
      p.tail = -0.4;
      p.ear = -1;
      break;
    }
    case 'call': {
      p.head = -0.38 - f * 0.05;
      p.jaw = f ? 1 : 0.55;
      p.tilt = -0.06;
      p.br = f;
      p.ear = 0.5;
      p.tail = 0.1 * f;
      break;
    }
    case 'groom': {
      // scratch the flank with the near hind foot
      p.tilt = -0.08;
      p.by = 0.3;
      p.head = 0.45;
      p.hdx = -0.6;
      const s = [0, 1, 0.3, 1][f];
      p.feet[2] = [3.5 + s * 1.2, -5.5 - s * 1.5];
      p.feet[3] = [0.8, 0];
      p.ear = f % 2 ? -0.5 : 0;
      p.tail = 0.1;
      break;
    }
    case 'dig': {
      p.tilt = 0.3;
      p.by = 1.1;
      p.head = 0.45;
      p.hdx = 0.2;
      const a = f / 4;
      p.feet[0] = [2.8 - fr(a) * 5, -Math.max(0, Math.sin(a * TAU)) * 2];
      p.feet[1] = [2.8 - fr(a + 0.5) * 5, -Math.max(0, Math.sin((a + 0.5) * TAU)) * 2];
      p.feet[2] = [-0.5, 0];
      p.feet[3] = [0.5, 0];
      p.dirt = 1;
      p.dirtPhase = a;
      p.tail = 0.25;
      p.ear = -1;
      break;
    }
  }
  return p;
}

const EYE: EyeSpec = { r: 1, iris: hex('#2a1c16'), lash: hex('#3a2a22'), dark: true };

function mats(sk: Sk) {
  return {
    shell: sk.m(rmp('#8a6843', { n: 6, dark: 0.58, light: 0.32, cool: 0.4 })),
    rim: sk.m(rmp('#efdcaa', { n: 5, dark: 0.36, light: 0.5, at: 3 })),
    gap: sk.m(rmp('#4a3626', { n: 4, dark: 0.5 }), { edge: 0 }),
    skin: sk.m(rmp('#977068', { n: 6, dark: 0.62 })),
    belly: sk.m(rmp('#a8807a', { n: 5, dark: 0.55 }), { bias: -0.08 }),
    claw: sk.m(rmp('#ece0c4', { n: 4, dark: 0.45 })),
    nose: sk.m(rmp('#4a3030', { n: 4, dark: 0.55 })),
    tongue: sk.m(rmp('#dc7c92', { n: 4, dark: 0.45 })),
    ear: sk.m(rmp('#c48a86', { n: 4, dark: 0.5 })),
    soil: sk.m(rmp('#6a4a30', { n: 4, dark: 0.55 })),
    mouth: sk.m(rmp('#3a1c20', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

/** Osteoderm tiles: sparse grooves in staggered rows (clean clusters, no speckle). */
function tile(M: M, x: number, y: number, p: Px, rowH = 3.3, colW = 3.8): number {
  const ry = y / rowH + 40;
  const row = Math.floor(ry);
  const cx = x / colW + 40 + (row % 2) * 0.5;
  const fy = ry - row, fx = cx - Math.floor(cx);
  if (fy < 1 / rowH) { p.l -= 0.2; return M.shell; }
  if (fx < 1 / colW && fy > 0.45) { p.l -= 0.14; return M.shell; }
  return M.shell;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  if (anim === 'ball' || anim === 'roll') return drawBall(sk, M, anim === 'roll' ? frame : 0, k);
  const P = pose(anim, frame, n);
  const B = new Frame2([P.bx * k, (-9.6 + P.by) * k], P.tilt, k);
  const ry = 9.4 + P.br * 0.35;

  // ---- far legs
  const FL: LegSpec = { l1: 3.9, l2: 3.6, r1: 2.2, r2: 1.6, bend: 1 };
  const HL: LegSpec = { l1: 4.2, l2: 3.8, r1: 2.7, r2: 1.8, bend: -1 };
  const legScaled = (L: LegSpec): LegSpec => ({ ...L, l1: L.l1 * k, l2: L.l2 * k, r1: L.r1 * k, r2: L.r2 * k });
  const footAt = (restX: number, off: V2): V2 => [restX * k + off[0] * k, -1.2 * k + off[1] * k - (P.tuck ? 0 : 0)];
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const hip = B.p(front ? 7.2 : -7, P.tuck ? 1.5 : 3.6);
    let foot = footAt(front ? 8 : -7, P.feet[which]);
    if (P.tuck) foot = B.p(front ? 9 : -5, 5.2);
    const z = near ? 5 : -5;
    const bias = near ? 0 : -0.12;
    sk.np();
    const L = legScaled(front ? FL : HL);
    const j = leg(sk, hip, foot, L, M.skin, z, 0, bias);
    // paw + claws
    const f = j[2];
    sk.ell(f[0] + 0.5 * k, f[1] + 0.3 * k, 1.9 * k, 1.1 * k, M.skin, { z: z + 0.8, bias });
    const nC = front ? 3 : 2;
    for (let c = 0; c < nC; c++) {
      const bx = f[0] + (1.2 + c * 0.35) * k, by = f[1] + (0.2 + c * 0.35) * k;
      const L2 = (front ? 2.8 - c * 0.4 : 1.5) * k;
      const a = front ? 0.55 + c * 0.2 : 0.4;
      sk.blade(bx, by, bx + Math.cos(a) * L2, by + Math.sin(a) * L2, s => (1 - s) * 0.7 * k + 0.25, M.claw, { z0: z + 1.2, z1: z + 1.4, bias });
    }
  };
  drawLeg(1);
  drawLeg(3);

  // ---- tail (armoured rings)
  sk.np();
  const tb = B.p(-11.5, 3.2);
  const tpts = chain(tb, B.ang(Math.PI - 0.45 + P.tail), 6, 1.85 * k, i => 0.1 + P.curl * (0.32 + i * 0.05));
  sk.tube(tpts, t => (2.6 - 2.0 * t) * k, (p) => {
    const ring = p.t * 7.5;
    const fr1 = ring - Math.floor(ring);
    if (fr1 < 0.28) return M.rim;
    if (fr1 > 0.82) { p.l -= 0.18; }
    return M.shell;
  }, { z: 0 });

  // ---- belly skin under the shell
  sk.np();
  const bc = B.p(0.5, 3.4);
  sk.ell(bc[0], bc[1], 11.2 * k, 3.6 * k, (p) => {
    p.l += 0.05;
    return M.belly;
  }, { rot: P.tilt, rz: 8 * k });

  // ---- shell
  sk.np();
  const sc = B.p(0, 0);
  const skirt = (xs: number) => 5.3 - 0.75 * Math.abs(Math.sin(xs * Math.PI / 2.7));
  sk.ell(sc[0], sc[1], 13.2 * k, ry * k, (p) => {
    const xs = p.u * 13.2, ys = p.v * ry;
    const sk0 = skirt(xs);
    if (ys > sk0) return 0;
    // skirt edge: pale scalloped fringe
    if (ys > sk0 - 1.0) { p.l += 0.12; return M.rim; }
    // pale anterior / posterior shield margins
    if (xs > 12.3 || xs < -12.6) { p.l += 0.06; return M.rim; }
    // head-end and tail-end shields: tiles; middle: bands (slightly bowed)
    const bx = xs + ys * ys * 0.018 - ys * 0.1;
    if (bx > 4.2) return tile(M, xs, ys, p);
    if (bx < -7.4) return tile(M, xs + 1.3, ys, p);
    const bw = 2.9;
    const b = (bx + 7.4) / bw;
    const fb = b - Math.floor(b);
    // posterior rim of each band (pale), shadowed front of the band behind it
    if (fb < 0.36) { p.l += 0.1; return M.rim; }
    if (fb > 0.72) { p.l -= 0.3; return M.shell; }
    return M.shell;
  }, { rot: P.tilt, rz: 10.5 * k });
  const shellPart = sk.pid;
  void shellPart;

  // ---- head
  const H = B.sub(11.2 + P.hdx, 1.6 + P.hdy, P.head);
  // far ear
  const earUp = P.ear;
  const earA = -1.95 + earUp * 0.35;
  sk.np();
  {
    const e0 = H.p(1.4, -2.6);
    sk.blade(e0[0], e0[1], e0[0] + Math.cos(H.ang(earA - 0.15)) * 3.4 * k, e0[1] + Math.sin(H.ang(earA - 0.15)) * 3.4 * k, s => Math.sin(Math.min(1, s * 1.3) * Math.PI) * 1.2 * k + 0.2, M.skin, { z0: -1.5, z1: -1.5, bias: -0.15 });
  }
  sk.np();
  const skull = H.p(3.1, 0);
  sk.ell(skull[0], skull[1], 4.4 * k, 3.5 * k, (p) => (p.v > 0.35 ? M.belly : M.skin), { rot: H.a, rz: 3.2 * k, z: 2 });
  // snout: long tapering, slightly down-curved
  const sn0 = H.p(5.2, 0.4), sn1 = H.p(8.6, 1.4), sn2 = H.p(11.4 + P.sniff * 0.4, 2.8 + P.sniff * 0.2);
  sk.tube([sn0, sn1, sn2], t => (2.2 - 1.3 * t) * k, (p) => {
    // wrinkles across the snout
    const w = p.t * 9;
    if (w - Math.floor(w) < 0.22 && p.t > 0.15 && p.t < 0.85) p.l -= 0.12;
    return M.skin;
  }, { z: 2 });
  // nose pad
  sk.ell(sn2[0], sn2[1], 1.0 * k, 0.9 * k, M.nose, { z: 3.5 });
  // jaw / mouth
  if (P.jaw > 0) {
    const j0 = H.p(5.8, 1.9), j1 = H.p(9.8, 2.9 + P.jaw * 1.6);
    sk.np();
    sk.tube([j0, j1], t => (1.2 - 0.6 * t) * k, M.skin, { z: 2.6 });
    const m0 = H.p(7.2, 2.1), m1 = H.p(10, 2.4 + P.jaw * 0.9);
    sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.2, 6, true);
  }
  if (P.tongue > 0) {
    sk.np(true);
    const t0 = sn2, t1: V2 = [sn2[0] + 1.6 * k * P.tongue, sn2[1] + 2.4 * k * P.tongue];
    const t2: V2 = [t1[0] + 1.8 * k * P.tongue, t1[1] + 1.2 * k * P.tongue];
    sk.tube([t0, t1, t2], 0.55 * k, M.tongue, { z: 5 });
  }
  // head shield (bony casque)
  sk.np();
  const cq = H.p(3.6, -1.9);
  sk.ell(cq[0], cq[1], 4.2 * k, 1.9 * k, (p) => {
    if (p.v > 0.45 || p.u > 0.8) { p.l += 0.05; return M.rim; }
    const tx = p.u * 2.4 + 3;
    if (tx - Math.floor(tx) < 0.2 && p.v > -0.4) p.l -= 0.18;
    return M.shell;
  }, { rot: H.a - 0.1, rz: 2.8 * k, z: 3.4 });
  // near ear
  sk.np();
  {
    const e0 = H.p(0.8, -2.2);
    const a = H.ang(earA);
    const tip: V2 = [e0[0] + Math.cos(a) * 4.6 * k, e0[1] + Math.sin(a) * 4.6 * k];
    sk.blade(e0[0], e0[1], tip[0], tip[1], s => Math.sin(Math.min(1, s * 1.2) * Math.PI) * 1.5 * k + 0.3, (p) => (Math.abs(p.v) < 0.45 && p.t > 0.2 && p.t < 0.8 ? M.ear : M.skin), { z0: 5.5, z1: 5.8 });
  }
  const eyeP = H.p(5.3, -0.2);
  const ep = drawEye(sk, eyeP[0], eyeP[1], { ...EYE, r: k < 0.8 ? 0.5 : 1 }, eye);

  // ---- near legs
  drawLeg(0);
  drawLeg(2);

  // ---- dirt from digging: clods flung back between the hind legs and out behind
  if (P.dirt) {
    sk.np();
    for (let i = 0; i < 5; i++) {
      const ph = fr(P.dirtPhase + i / 5);
      const x = (-12 - ph * 13) * k, y = (-1.5 - Math.sin(ph * Math.PI) * (6 + (i % 3) * 2.5)) * k;
      const r = (i % 2 ? 0.9 : 1.4) * k;
      sk.ell(x, y, r * 1.1, r, M.soil, { z: 30 + i * 0.01 });
    }
    // loosened earth mound under the claws
    sk.ell(13 * k, -0.4, 3.4 * k, 1.5 * k, M.soil, { z: 30, bias: 0.08 });
    sk.ell(-15 * k, -0.3, 2.6 * k, 1.1 * k, M.soil, { z: 30, bias: 0.02 });
  }
  const head = H.p(4, -1);
  return { head: [head[0], head[1] - 2 * k] as V2, eye: ep };
}

/** Rolled-up armoured ball; `rf` rotates the ball (rolling frames). */
function drawBall(sk: Sk, M: M, rf: number, k: number) {
  const R = 10.8 * k;
  const c: V2 = [0, -R];
  const rotA = rf * (TAU / 4);
  sk.np();
  sk.ell(c[0], c[1], R, R, (p) => {
    const r = Math.hypot(p.u, p.v);
    let a = Math.atan2(p.v, p.u) - rotA;
    a = ((a % TAU) + TAU) % TAU;
    const s = a / TAU; // 0..1 around
    // head shield plug (a pale-rimmed wedge) where the ends of the body meet
    const plug = s - 0.17;
    if (r > 0.3 && plug > -0.06 && plug < 0.06) {
      if (Math.abs(plug) > 0.045) { p.l -= 0.25; return M.shell; }
      if (r > 0.86) { p.l += 0.1; return M.rim; }
      return tile(M, p.u * 12, p.v * 12, p, 2.8, 3);
    }
    // the ventral edges meet in the middle: a pale scalloped seam
    if (r < 0.26) { p.l -= 0.05; return r > 0.17 ? M.rim : M.shell; }
    // curved spokes: bands spiral a little toward the seam
    const sp = s * 11 + r * 0.9;
    const fb = sp - Math.floor(sp);
    if (fb < 0.3) { p.l += 0.08; return M.rim; }
    if (fb > 0.74) { p.l -= 0.28; return M.shell; }
    return M.shell;
  }, { rz: R });
  // tail lying along the rim next to the plug
  sk.np();
  const ta = 0.2 * TAU + rotA + 0.5;
  const tpts: V2[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = ta + i * 0.13;
    tpts.push([c[0] + Math.cos(a) * (R - 1.4 * k), c[1] + Math.sin(a) * (R - 1.4 * k)]);
  }
  sk.tube(tpts, t => (2.1 - 1.4 * t) * k, (p) => {
    const ring = p.t * 6;
    return ring - Math.floor(ring) < 0.3 ? M.rim : M.shell;
  }, { z: R * 0.3 + 1 });
  const head: V2 = [c[0], c[1] - R * 0.2];
  return { head, eye: add(c, [R * 0.5, R * 0.4]) as V2 };
}

export const SHIELDBACK: SpeciesDef = {
  name: 'Shieldback', kind: 'mammal', len: 44, height: 18,
  anims: ANIMS,
  canvas: () => ({ w: 70, h: 40, ox: 34, oy: 32 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' || anim === 'ball' || anim === 'roll' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'dig' ? 'angry' : 'open'),
};

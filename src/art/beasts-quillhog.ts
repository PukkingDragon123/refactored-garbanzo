// Quillhog: nocturnal porcupine/hedgehog with long banded black-and-cream quills, a white face
// mask, pink nose and big dark eyes. Fruit eater. Raises and rattles its quills; threat display turns
// the quilled backside toward the threat and glares back over the shoulder.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, chain, hh, fr } from './beasts-core';
import { Frame2, leg, LegSpec, scaleLeg, paw, ear, whiskers } from './beasts-rig';
import { hex } from './color';

interface P {
  bx: number; by: number; tilt: number; br: number; squash: number;
  feet: [V2, V2, V2, V2];
  head: number; hdx: number; hdy: number; jaw: number; ear: number;
  quill: number;   // 0 flat .. 1 fully raised
  rattle: number;  // per-frame jitter seed (0 = none)
  tail: number;
  curl: number;    // sleep: curled up
  fruit: number;   // 0 none, else fruit size (eat)
  threat: boolean;
  scratch: number; // groom: hind foot scratching at the ear
}
const base = (): P => ({
  bx: 0, by: 0, tilt: 0, br: 0, squash: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]],
  head: 0, hdx: 0, hdy: 0, jaw: 0, ear: 0, quill: 0, rattle: 0, tail: 0, curl: 0, fruit: 0, threat: false, scratch: -1,
});

const ANIMS = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 8, fps: 9, loop: true },
  run: { frames: 6, fps: 12, loop: true },
  eat: { frames: 4, fps: 5, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  sleep: { frames: 2, fps: 1.5, loop: true },
  call: { frames: 2, fps: 4, loop: true },
  groom: { frames: 4, fps: 8, loop: true },
  quills: { frames: 2, fps: 12, loop: true },
  threat: { frames: 2, fps: 12, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.head = 0.06 + (f === 2 ? 0.06 : 0);
      p.ear = f === 3 ? 1 : 0;
      p.quill = 0.05 + p.br * 0.04;
      break;
    case 'walk': {
      const st = 5, lift = 1.8, duty = 0.62;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.5;
      p.tilt = Math.sin(t * TAU) * 0.03;
      p.head = 0.14 + Math.sin(t * TAU * 2) * 0.04;
      p.quill = 0.08 + Math.max(0, Math.cos(t * TAU * 2)) * 0.05;
      p.tail = Math.sin(t * TAU) * 0.15;
      break;
    }
    case 'run': {
      const st = 8.5, lift = 3, duty = 0.42;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.1, duty, st, lift);
      p.feet[2] = gait(t + 0.5, duty, st, lift);
      p.feet[3] = gait(t + 0.6, duty, st, lift);
      p.by = -Math.abs(Math.sin(t * TAU)) * 1.6 + 0.5;
      p.tilt = Math.sin(t * TAU + 0.5) * 0.08;
      p.squash = Math.cos(t * TAU) * 0.06;
      p.head = 0.05;
      p.hdx = 0.6;
      p.quill = 0.02;
      p.ear = -1;
      break;
    }
    case 'eat':
      p.tilt = 0.08;
      p.head = 0.5 + (f % 2) * 0.08;
      p.hdx = 0.4;
      p.jaw = [0.2, 0.8, 0.3, 0.9][f];
      p.fruit = 1 - f * 0.08;
      p.feet[0] = [2, 0];
      p.quill = 0.04;
      break;
    case 'alert':
      p.by = -1;
      p.tilt = -0.08;
      p.head = -0.3;
      p.ear = 1;
      p.quill = 0.35 + f * 0.05;
      p.feet[0] = [0.5, 0];
      break;
    case 'sleep':
      p.curl = 1;
      p.br = f;
      p.quill = 0.1 + f * 0.04;
      break;
    case 'call':
      p.head = -0.4;
      p.jaw = f ? 1 : 0.5;
      p.by = -0.5;
      p.tilt = -0.05;
      p.quill = 0.18 + f * 0.05;
      p.ear = 0.5;
      break;
    case 'groom':
      p.tilt = -0.1;
      p.by = 0.4;
      p.head = 0.35;
      p.scratch = f;
      p.feet[3] = [1, 0];
      p.quill = 0.12;
      break;
    case 'quills':
      p.by = -0.6;
      p.tilt = 0.08;
      p.head = 0.35;
      p.quill = 1;
      p.rattle = f + 1;
      p.feet[0] = [1, 0];
      p.feet[2] = [-1, 0];
      p.ear = -1;
      break;
    case 'threat':
      p.threat = true;
      p.quill = 1;
      p.rattle = f + 1;
      p.by = -0.8 - f * 0.3;
      p.tilt = -0.12;
      p.tail = 0.9;
      p.feet[2] = [0, f ? -1.2 : 0];
      break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1.6, iris: hex('#2a1a14'), lash: hex('#2a201c'), dark: true };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#4a3a30', { n: 6, dark: 0.62 })),
    furD: sk.m(rmp('#2c221d', { n: 5, dark: 0.55 })),
    belly: sk.m(rmp('#7d6858', { n: 5, dark: 0.55 })),
    mask: sk.m(rmp('#ebe3d2', { n: 5, dark: 0.4, at: 3 })),
    nose: sk.m(rmp('#e4909a', { n: 4, dark: 0.45 }), { spec: 1 }),
    claw: sk.m(rmp('#d9cdb2', { n: 4, dark: 0.45 })),
    qL: sk.m(rmp('#e9dcc0', { n: 5, dark: 0.42, light: 0.35, at: 3 })),
    qD: sk.m(rmp('#221c1a', { n: 4, dark: 0.45, light: 0.25 })),
    fruit: sk.m(rmp('#d2452e', { n: 5, dark: 0.55 })),
    leaf: sk.m(rmp('#4f8a3a', { n: 4, dark: 0.5 })),
    inner: sk.m(rmp('#b98482', { n: 4, dark: 0.5 })),
    mouth: sk.m(rmp('#4a1c24', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

/** Banded quill materials along s (0 base .. 1 tip): bold crest quills and grizzled flank quills. */
const crestMat = (M: M, s: number) => (s < 0.22 ? M.qD : s < 0.46 ? M.qL : s < 0.72 ? M.qD : s < 0.93 ? M.qL : M.qD);
const flankMat = (M: M, s: number) => (s < 0.62 ? M.qD : s < 0.9 ? M.qL : M.qD);
const quillMat = crestMat;

/**
 * Quill coat: grizzled rows of short dark quills over the flank, then long boldly banded crest
 * quills flowing back along the top as a mane (front quills overlap the ones behind).
 * `quill` raises them toward erect; `rattle` jitters them.
 */
function drawQuills(sk: Sk, M: M, B: Frame2, rx: number, ry: number, P: P, k: number, uFront = 0.72, uRear = -1.02, rows = 5) {
  sk.np(true);
  const q = P.quill;
  for (let r = rows - 1; r >= 0; r--) {
    const crestRow = r < 2;
    const v = -0.9 + r * 0.22;
    const cols = crestRow ? 12 : 9;
    for (let c = cols - 1; c >= 0; c--) {
      const u = uRear + (uFront - uRear) * ((c + (r % 2) * 0.5) / (cols - 0.5));
      if (Math.abs(u) > 0.98) continue;
      const w = Math.sqrt(Math.max(0, 1 - v * v));
      let x = u * rx * w, y = v * ry;
      if (r === 0) y = -ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + 1.1;
      const jit = P.rattle ? (hh(c, r, P.rattle * 7) - 0.5) * 0.42 : (hh(c, r, 3) - 0.5) * 0.06;
      const crest = 1 - r / rows;
      const rear = Math.max(0, -u);
      const lift = 0.12 + crest * 0.2 + rear * 0.18 + q * (0.5 + crest * 0.8 + rear * 0.2) + jit;
      const a = Math.PI + lift;
      const L = crestRow
        ? 10 + Math.sin(((u + 1) / 2) * Math.PI) * 3 + q * 2.5 + hh(c, r, 9) * 1.2 - r * 1.5
        : 5.6 + hh(c, r, 9) * 1.2 + q * 1.5;
      const b0 = B.p(x, y);
      const zb = sk.zAt(b0[0], b0[1]);
      const z0 = (zb > -1e8 ? zb : 4) + 1.4 + (u + 1) * 0.5 + (crestRow ? 2 : 0);
      const d = B.dir(a, L);
      const bias = crestRow ? (r ? -0.04 : 0.04) : -0.1;
      const hw = crestRow ? 0.7 : 0.6;
      sk.blade(b0[0], b0[1], b0[0] + d[0], b0[1] + d[1], s => (s < 0.75 ? hw : hw * (1 - (s - 0.75) * 2.6)) * Math.max(0.85, k),
        crestRow ? (p) => crestMat(M, p.t) : (p) => flankMat(M, p.t), { z0, z1: z0 + 0.6 + q * 1.5, bias });
    }
  }
}

function drawFrontFace(sk: Sk, M: M, c: V2, k: number, eye: BeastEye) {
  // head turned back toward the viewer, peeking over the shoulder
  sk.np();
  sk.ell(c[0], c[1], 4.6 * k, 4.2 * k, (p) => (p.v < -0.55 ? M.fur : M.mask), { z: 14, rz: 4 * k });
  ear(sk, [c[0] - 3.6 * k, c[1] - 2.6 * k], -2.4, 2.6 * k, 1.2 * k, M.fur, M.inner, 16);
  ear(sk, [c[0] + 3.6 * k, c[1] - 2.6 * k], -0.75, 2.6 * k, 1.2 * k, M.fur, M.inner, 16);
  sk.ell(c[0], c[1] + 1.8 * k, 2.2 * k, 1.8 * k, M.mask, { z: 18, bias: 0.05 });
  sk.ell(c[0], c[1] + 1.7 * k, 1.1 * k, 0.9 * k, M.nose, { z: 20 });
  const e1 = drawEye(sk, c[0] - 2 * k, c[1] - 0.6 * k, { ...EYE, r: 1.2 }, eye);
  drawEye(sk, c[0] + 2 * k, c[1] - 0.6 * k, { ...EYE, r: 1.2 }, eye);
  return e1;
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  const mx = P.threat ? -1 : 1;
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  const B = new Frame2([P.bx * k, (-8.8 + P.by) * k], P.tilt * mx, k, mx);
  const rx = 12.2 * (1 + P.squash), ry = (7 + P.br * 0.3) * (1 - P.squash);

  const FL: LegSpec = scaleLeg({ l1: 3.4, l2: 3.4, r1: 2.3, r2: 1.6, bend: mx }, k);
  const HL: LegSpec = scaleLeg({ l1: 3.8, l2: 3.6, r1: 2.8, r2: 1.8, bend: -mx }, k);
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const hip = B.p(front ? 6.2 : -6.4, 3.8);
    const off = P.feet[which];
    let foot: V2 = [((front ? 7.2 : -6.2) + off[0]) * k * mx, (-1 + off[1]) * k];
    if (which === 2 && P.scratch >= 0) {
      const s = [0, 1, 0.4, 1][P.scratch];
      foot = B.p(8.5 + s * 0.8, -2.2 - s * 1.2);
    }
    const z = near ? 5 : -5, bias = near ? 0 : -0.14;
    sk.np();
    const j = leg(sk, hip, foot, front ? FL : HL, M.furD, z, 0, bias);
    paw(sk, j[2], k, M.furD, M.claw, z, { n: 3, clawLen: front ? 1.5 : 1.2, bias, dir: mx });
  };
  drawLeg(1);
  drawLeg(3);

  // tail: short, quilled
  sk.np();
  const tb = B.p(-11.2, 0.5);
  const ta = B.ang(Math.PI - 0.5 - P.tail * 1.2);
  const tpts = chain(tb, ta, 3, 1.6 * k, () => 0.12);
  sk.tube(tpts, t => (2.4 - 1.4 * t) * k, M.furD, { z: 0 });

  // body
  sk.np();
  const bc = B.p(0, 0);
  sk.ell(bc[0], bc[1], rx * k, ry * k, (p) => {
    const vv = p.v;
    if (vv > 0.45) { p.l += 0.04; return M.belly; }
    return vv < -0.2 ? M.furD : M.fur;
  }, { rot: B.a, rz: 8 * k });
  const bodyPart = sk.pid;
  sk.streaks(bodyPart, () => B.dir(Math.PI + 0.2, 1) as V2, { spacing: 3, len: 3, amp: 0.1 });
  // belly fringe
  sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny > 0 ? [-0.5 * mx, 1] : nx * mx < 0 && ny >= 0 ? [-1 * mx, 0.4] : null), { every: 2, len: 1 });

  // quills: far rows first; tail quills
  drawQuills(sk, M, B, rx, ry, P, k, P.threat ? 0.62 : 0.66);
  {
    sk.np(true);
    for (let i = 0; i < 6; i++) {
      const b = tpts[1 + (i % 2)];
      const a = ta - 0.9 + i * 0.35 + P.tail * 0.3 + (P.rattle ? (hh(i, 1, P.rattle) - 0.5) * 0.4 : 0);
      const L = (4 + P.quill * 3 + (i % 3)) * k;
      sk.blade(b[0], b[1], b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L, s => 0.6 * (1 - s * 0.4), (p) => quillMat(M, p.t), { z0: 4, z1: 5 });
    }
  }

  let headC: V2, eyeC: V2;
  if (P.threat) {
    // glaring back over the shoulder
    const fc = B.p(9.5, -1.5);
    eyeC = drawFrontFace(sk, M, fc, k, eye === 'open' ? 'angry' : eye);
    headC = fc;
  } else {
    const H = B.sub(10 + P.hdx, -0.2 + P.hdy, P.head);
    // far ear
    sk.np();
    ear(sk, H.p(0.8, -3.2), H.ang(-1.9 + P.ear * 0.25), 2.4 * k, 1.1 * k, M.furD, 0, -2, -0.15);
    sk.np();
    const skull = H.p(3.3, 0);
    sk.ell(skull[0], skull[1], 4.8 * k, 4.2 * k, (p) => {
      // white face mask over the front of the face, dark crown behind
      const mU = p.u + p.v * 0.35;
      if (mU > -0.15 && p.v < 0.7) return M.mask;
      return p.v > 0.35 ? M.belly : M.fur;
    }, { rot: H.a, rz: 4 * k, z: 2 });
    const headPart = sk.pid;
    sk.tufts(headPart, (_x, _y, nx, ny) => (ny > 0 && nx <= 0 ? [-0.6, 1] : null), { every: 2, len: 1 });
    // muzzle
    const mz = H.p(7, 1.3);
    sk.ell(mz[0], mz[1], 2.8 * k, 2.5 * k, M.mask, { rot: H.a + 0.15, rz: 2.4 * k, z: 4 });
    const np = H.p(9.3, 1.2);
    sk.ell(np[0], np[1], 1.3 * k, 1.1 * k, M.nose, { z: 7 });
    // mouth / jaw
    if (P.jaw > 0) {
      sk.np();
      const j0 = H.p(5.8, 2.9), j1 = H.p(8.6, 3.1 + P.jaw * 1.4);
      sk.tube([j0, j1], t => (1.3 - 0.4 * t) * k, M.mask, { z: 4.5, bias: -0.1 });
      const m0 = H.p(6.6, 2.6), m1 = H.p(8.6, 2.7 + P.jaw * 0.8);
      sk.line(m0[0], m0[1], m1[0], m1[1], M.mouth, 0.2, 9, true);
    }
    // near ear
    sk.np();
    ear(sk, H.p(0.2, -2.8), H.ang(-1.75 + P.ear * 0.3), 2.8 * k, 1.35 * k, M.fur, M.inner, 6);
    eyeC = drawEye(sk, H.p(4.6, -1)[0], H.p(4.6, -1)[1], { ...EYE, r: k < 0.8 ? 1 : 1.6 }, eye);
    whiskers(sk, H.p(8.3, 1.8), mx, 5 * k, hex('#d8d2c4'), 3, 0.3, 0.15);
    headC = H.p(3.5, -1);
    if (P.fruit > 0) {
      sk.np();
      const fp = H.p(10.4, 3.4);
      const r = 2.4 * P.fruit * k;
      sk.ell(fp[0], Math.min(fp[1], -r), r, r * 0.95, M.fruit, { z: 12 });
      sk.blade(fp[0], Math.min(fp[1], -r) - r * 0.7, fp[0] + 1.5 * k, Math.min(fp[1], -r) - r - 1.2 * k, s => (1 - s) * 0.8 + 0.2, M.leaf, { z0: 13, z1: 13 });
    }
  }

  drawLeg(0);
  drawLeg(2);
  return { head: [headC[0], headC[1] - 3 * k] as V2, eye: eyeC };
}

/** Sleeping: curled into a quilled ball, face tucked in. */
function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const R = 9.5 * k, ry = (8 + P.br * 0.35) * k;
  const B = new Frame2([0, -ry], 0, k);
  sk.np();
  sk.ell(0, -ry, R, ry, (p) => (p.v > 0.5 ? M.belly : M.fur), { rz: 8 * k });
  // quills all round the back
  drawQuills(sk, M, B, R / k, ry / k, P, k, 0.5, -1.02, 7);
  // tucked face peeking at the front bottom
  sk.np();
  const fc: V2 = [R * 0.55, -ry * 0.55];
  sk.ell(fc[0], fc[1], 3.2 * k, 2.8 * k, M.mask, { z: 12 });
  sk.ell(fc[0] + 2.4 * k, fc[1] + 0.8 * k, 1.1 * k, 0.9 * k, M.nose, { z: 14 });
  const e = drawEye(sk, fc[0] + 0.4 * k, fc[1] - 0.6 * k, { ...EYE, r: 1 }, eye);
  paw(sk, [R * 0.45, -0.2], k, M.furD, M.claw, 13, { n: 3, clawLen: 1.1 });
  return { head: [fc[0], -ry * 2 - 2] as V2, eye: e };
}

export const QUILLHOG: SpeciesDef = {
  name: 'Quillhog', kind: 'mammal', len: 36, height: 22,
  anims: ANIMS,
  canvas: () => ({ w: 64, h: 50, ox: 30, oy: 40 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'threat' || anim === 'quills' ? 'angry' : 'open'),
};
void fr;

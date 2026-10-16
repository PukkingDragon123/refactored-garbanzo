// Torhopper: the Rocky Hills' rock-hopping grazer. A compact, goat-sized mammal standing high on slender
// legs with rubbery cup-hooves (it walks on the tips of them, like a klipspringer); a dense, grizzled
// tawny-grey wool that matches granite and dry tussock; a cream belly; a black-and-white face mask;
// a pair of ridged keratin brow-shields swept back over the skull (rams butt with them); and, against
// the serpents that strike from the rocks, a keel of small overlapping bony scutes along the spine.
// Anims: idle, walk, run, eat (grazing), alert (sentinel on a rock), leap (the rock hop: gathered on
// frames 0-1, stretched out on 2-3), call (the whistle), sleep (folded up), play (the butting clash).

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, qbez } from '../../beasts-core';
import { Frame2, leg, LegSpec, scaleLeg, ear } from '../../beasts-rig';
import { hex } from '../../color';

interface P {
  bx: number; by: number; tilt: number; br: number;
  feet: [V2, V2, V2, V2];
  neck: number; head: number; jaw: number; ear: number; tail: number;
  fold: number;      // 0 standing .. 1 folded down (sleep)
  leap: number;      // 0 none, 1 gathered, 2 stretched
  rear: number;      // play: up on the hind legs
}
const base = (): P => ({ bx: 0, by: 0, tilt: 0, br: 0, feet: [[0, 0], [0, 0], [0, 0], [0, 0]], neck: -0.9, head: 0.15, jaw: 0, ear: 0, tail: 0, fold: 0, leap: 0, rear: 0 });

const ANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  walk: { frames: 8, fps: 9, loop: true },
  run: { frames: 6, fps: 13, loop: true },
  eat: { frames: 4, fps: 4, loop: true },
  alert: { frames: 2, fps: 2, loop: true },
  leap: { frames: 4, fps: 7, loop: false },
  call: { frames: 2, fps: 4, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  play: { frames: 4, fps: 6, loop: true },
};

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  switch (anim) {
    case 'idle':
      p.br = Math.sin(t * TAU) * 0.5 + 0.5;
      p.neck = -0.95 + Math.sin(t * TAU) * 0.03;
      p.ear = f === 2 ? 1 : 0;
      p.tail = Math.sin(t * TAU) * 0.3;
      break;
    case 'walk': {
      const st = 9, lift = 3, duty = 0.62;
      p.feet[2] = gait(t, duty, st, lift);
      p.feet[0] = gait(t + 0.25, duty, st, lift);
      p.feet[3] = gait(t + 0.5, duty, st, lift);
      p.feet[1] = gait(t + 0.75, duty, st, lift);
      p.by = Math.cos(t * TAU * 2) * 0.6;
      p.neck = -0.8 + Math.sin(t * TAU * 2) * 0.05;
      p.head = 0.25;
      p.tail = Math.sin(t * TAU) * 0.2;
      break;
    }
    case 'run': {
      // a bounding gallop: all four feet off the ground mid-stride
      const st = 18, lift = 6, duty = 0.36;
      p.feet[0] = gait(t, duty, st, lift);
      p.feet[1] = gait(t + 0.08, duty, st, lift);
      p.feet[2] = gait(t + 0.5, duty, st, lift);
      p.feet[3] = gait(t + 0.58, duty, st, lift);
      p.by = -Math.max(0, Math.sin(t * TAU + 0.6)) * 5 + 1;
      p.tilt = Math.sin(t * TAU) * 0.12;
      p.neck = -0.55;
      p.head = 0.35;
      p.ear = -1;
      p.tail = 0.9;
      break;
    }
    case 'eat':
      p.neck = 0.55 + (f % 2) * 0.06;
      p.head = 0.9;
      p.jaw = [0.1, 0.6, 0.2, 0.7][f];
      p.tilt = 0.05;
      p.feet[0] = [2, 0];
      p.tail = Math.sin(t * TAU) * 0.3;
      break;
    case 'alert':
      p.neck = -1.25;
      p.head = 0.05;
      p.ear = 1;
      p.by = -1;
      p.tilt = -0.06;
      p.feet[0] = [1, 0];
      p.feet[2] = [-1.5, 0];
      p.tail = 0.7 + f * 0.1;
      break;
    case 'leap':
      p.leap = f < 2 ? 1 : 2;
      if (f < 2) {
        // gathered: all four hooves bunched under the body, back rounded
        p.by = -6 - f * 2;
        p.feet = [[-5, -7], [-4, -8], [6, -7], [7, -6]];
        p.tilt = -0.18;
        p.neck = -0.9;
        p.head = 0.3;
        p.tail = 0.9;
      } else {
        // stretched: forelegs reaching, hind legs trailing
        p.by = -7;
        p.feet = [[8, -6], [10, -8], [-10, -5], [-8, -7]];
        p.tilt = f === 2 ? -0.1 : 0.12;
        p.neck = -0.7;
        p.head = 0.25;
        p.ear = -1;
        p.tail = 0.8;
      }
      break;
    case 'call':
      p.neck = -1.4;
      p.head = -0.25;
      p.jaw = f ? 0.9 : 0.35;
      p.ear = 1;
      p.by = -0.5;
      p.tail = 0.6;
      break;
    case 'sleep':
      p.fold = 1;
      p.br = f;
      p.neck = -0.2;
      p.head = 0.9;
      break;
    case 'play':
      // the butting clash: rear up, then drop and swing the brow-shields forward
      if (f === 0 || f === 1) { p.rear = f === 0 ? 0.6 : 1; p.neck = -1.2; p.head = 0.2; p.ear = -1; }
      else { p.rear = 0; p.neck = -0.25; p.head = 0.85; p.by = 1; p.tilt = 0.14; p.feet[2] = [-3, 0]; p.feet[3] = [-2, 0]; p.ear = -1; }
      p.tail = 0.8;
      break;
  }
  return p;
}

const EYE: EyeSpec = { r: 1.5, iris: hex('#8a5a1a'), pupil: hex('#140c06'), slit: 'h', lash: hex('#1a1412'), ring: hex('#1a1412') };

function mats(sk: Sk, juv: boolean) {
  return {
    wool: sk.m(rmp(juv ? '#a08660' : '#927a58', { n: 7, dark: 0.62, light: 0.42, warm: 0.4 })),
    woolD: sk.m(rmp('#4c3c2e', { n: 6, dark: 0.6 })),
    belly: sk.m(rmp('#d8ccb2', { n: 5, dark: 0.42, at: 3 })),
    black: sk.m(rmp('#221c1a', { n: 5, dark: 0.55, light: 0.25 })),
    white: sk.m(rmp('#ece6d8', { n: 5, dark: 0.35, at: 3 })),
    horn: sk.m(rmp('#3c3834', { n: 6, dark: 0.55, light: 0.7, cool: 0.4 }), { spec: 0.4 }),
    scute: sk.m(rmp('#5c5e62', { n: 6, dark: 0.6, light: 0.5, cool: 0.5 })),
    hoof: sk.m(rmp('#2c2420', { n: 4, dark: 0.5 }), { spec: 0.5 }),
    nose: sk.m(rmp('#3a302c', { n: 4, dark: 0.45 }), { spec: 1 }),
    inner: sk.m(rmp('#c09080', { n: 4, dark: 0.45 })),
    mouth: sk.m(rmp('#4a1c20', { n: 3, dark: 0.4 }), { edge: 0 }),
    tuft: sk.m(rmp('#c8a868', { n: 4, dark: 0.45 })),
  };
}
type M = ReturnType<typeof mats>;

/** grizzled wool: a darker saddle, flecks, the belly line */
function woolFill(M: M, B: Frame2, k: number) {
  return (p: Px) => {
    const lx = (p.x - B.o[0]) / k, ly = (p.y - B.o[1]) / k;
    const up = ly / 7.5;
    if (up > 0.62) return M.belly;
    const g = hh(Math.floor(lx / 1.5), Math.floor(ly / 1.5), 31);
    if (g < 0.16) p.l -= 0.12;
    else if (g > 0.9) p.l += 0.1;
    if (up < -0.55 && lx > -14 && lx < 11) return M.woolD;
    if (up > 0.3) p.l += 0.06;
    return M.wool;
  };
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk, juv);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  const legK = juv ? 1.15 : 1;
  const fold = P.fold;
  const bodyY = -28 * legK + P.by + fold * 20 * legK;
  const B = new Frame2([P.bx * k, bodyY * k], P.tilt - P.rear * 0.55, k);
  const WF = woolFill(M, B, k);

  // ---- legs: long and slender, on the tips of their cup-hooves
  const FL: LegSpec = scaleLeg({ l1: 9.6 * legK, l2: 10.4 * legK, r1: 2.8, r2: 1.4, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 10.2 * legK, l2: 8.6 * legK, l3: 7 * legK, r1: 3.6, r2: 1.6, r3: 1.2, bend: -1 }, k);
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const z = near ? 8 : -8, bias = near ? 0 : -0.14;
    sk.np();
    const hip = B.p(front ? 10.5 : -11, 3.5);
    let foot: V2 = [((front ? 11.5 : -10.5) + P.feet[which][0]) * k, (-0.8 + P.feet[which][1]) * k];
    if (fold) foot = B.p(front ? 14 + (near ? 2 : 0) : -6 + (near ? 2 : 0), 8.5);
    if (P.rear && !front) foot = [(-9 + P.feet[which][0]) * k, -0.8 * k];
    if (P.rear && front) foot = B.p(16, 10 - P.rear * 4);
    if (P.leap) foot = [B.o[0] + (front ? 10 : -10) * k + P.feet[which][0] * k, B.o[1] + (20 + P.feet[which][1]) * k];
    const j = leg(sk, hip, foot, front ? FL : HL, (p) => (p.t < 0.35 ? M.wool : M.woolD), z, -Math.PI / 2 - 0.3, bias);
    // knee tufts and the hoof (a dark rubbery cup, its rim pale)
    const f0 = j[j.length - 1];
    if (!fold) {
      sk.ell(f0[0] + 0.4 * k, f0[1] - 0.6 * k, 1.9 * k, 1.5 * k, M.hoof, { z: z + 1, bias });
      sk.ell(f0[0] + 0.4 * k, f0[1] - 1.9 * k, 1.5 * k, 0.6 * k, M.white, { z: z + 1.5, bias });
    }
  };
  drawLeg(1);
  drawLeg(3);

  // ---- tail: a short, upturned brush with a white flag underneath
  sk.np();
  const tb = B.p(-15, -3.5);
  const tA = B.ang(Math.PI + 0.35 - P.tail * 0.9);
  const tPts = qbez(tb, [tb[0] + Math.cos(tA) * 3 * k, tb[1] + Math.sin(tA) * 3 * k - k], [tb[0] + Math.cos(tA - 0.3) * 6.5 * k, tb[1] + Math.sin(tA - 0.3) * 6.5 * k], 5);
  sk.tube(tPts, t => (2.6 - t * 1.2) * k, (p) => (p.v > 0.2 ? M.white : M.woolD), { z: -1 });

  // ---- body: a compact barrel of wool
  sk.np();
  const spine: V2[] = [B.p(-15, -1), B.p(-6, -2.5), B.p(4, -2), B.p(12, 0)];
  sk.tube(spine, t => (6.6 + Math.sin(t * Math.PI) * 1.3 + (t > 0.8 ? 0.6 : 0) + P.br * 0.25) * k, WF, { z: 0, rz: 0.9 });
  const bodyPart = sk.pid;
  sk.streaks(bodyPart, () => B.dir(Math.PI * 0.55, 1) as V2, { spacing: 2.5, len: 2, amp: 0.12 });
  sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny > 0.4 ? [-0.3, 1] : nx < -0.6 ? [-1, 0.3] : null), { every: 2, len: 1 });

  // ---- the keel of scutes down the spine (overlapping, pointing back)
  sk.np();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const s = B.p(10 - t * 23, -7.6 + Math.sin(t * Math.PI) * -0.9);
    const L = (3.2 - Math.abs(t - 0.45) * 2.2) * k;
    const d = B.dir(Math.PI + 0.55, L);
    sk.blade(s[0], s[1], s[0] + d[0], s[1] + d[1], s2 => (1 - s2) * 1.7 * k + 0.3, (p) => { if (p.v < -0.5) p.l += 0.18; else if (p.v > 0.6) p.l -= 0.12; return M.scute; }, { z0: 9 + t, z1: 9.5 + t, bend: 0.4 });
  }

  // ---- neck and head
  const N0 = B.p(12, -3.5);
  const nA = B.ang(P.neck);
  const nL = 12 * k;
  const N1: V2 = [N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL];
  sk.np();
  sk.tube([N0, [(N0[0] + N1[0]) / 2, (N0[1] + N1[1]) / 2], N1], t => (4.4 - t * 1.5) * k, (p) => (p.v > 0.5 && P.neck < 0 ? M.belly : M.wool), { z: 2 });
  // a mane of longer wool along the throat
  const neckPart = sk.pid;
  sk.tufts(neckPart, (_x, _y, _nx, ny) => (ny > 0.3 ? [0, 1] : null), { every: 2, len: 2 });
  const H = new Frame2(N1, B.a + P.neck * 0.25 + P.head, k);
  const hz = 6;
  // far ear and far brow-shield
  sk.np();
  const earA = -2.5 + P.ear * 0.5;
  ear(sk, H.p(-1.5, -3.2), H.ang(earA - 0.2), 5.4 * k, 2 * k, M.wool, 0, hz - 6, -0.15, 1.15);
  if (!juv) {
    sk.np();
    const s0 = H.p(1.2, -3.8), s1 = H.p(-7.8, -7.8);
    sk.blade(s0[0], s0[1], s1[0], s1[1], s => (1 - s * 0.55) * 2 * k, M.horn, { z0: hz - 4, z1: hz - 4.5, bend: -1.2 * k, bias: -0.12 });
  }
  // the skull: short and deep, the muzzle tapering
  sk.np();
  const skull = H.p(1.5, -0.3);
  const faceFill = (p: Px) => {
    const lx = (p.x - H.o[0]) / k, ly = (p.y - H.o[1]) / k;
    // rotate into head space
    const c = Math.cos(-H.a), s = Math.sin(-H.a);
    const hx = lx * c - ly * s, hy = lx * s + ly * c;
    // the mask: a black band through the eye to the nose, white cheek and muzzle patch
    if (hy > 1.6 && hx > 2) return M.white;
    if (Math.abs(hy - (-0.7 + hx * 0.14)) < 1.7 && hx > -2.5) return M.black;
    if (hy < -2.2 && hx > 0.5) return M.white;
    return M.wool;
  };
  sk.ell(skull[0], skull[1], 5.2 * k, 4.4 * k, faceFill, { rot: H.a, rz: 4 * k, z: hz });
  const m0 = H.p(4.2, 0.6), m1 = H.p(10.4, 2.1);
  sk.tube([m0, m1], t => (3.1 - t * 1.2) * k, faceFill, { z: hz + 1 });
  // lower jaw
  const jA = H.ang(0.28 + P.jaw * 0.5);
  const j0 = H.p(3.5, 2.3);
  const j1: V2 = [j0[0] + Math.cos(jA) * 5.6 * k, j0[1] + Math.sin(jA) * 5.6 * k];
  if (P.jaw > 0.3) { const mA = H.p(4.5, 2.2); sk.poly([mA[0], mA[1], m1[0], m1[1] + 1.2 * k, j1[0], j1[1]], M.mouth, { z: hz + 1.4 }); }
  sk.tube([j0, j1], t => (1.6 - t * 0.5) * k, M.white, { z: hz + 1.6 });
  const ns = H.p(10.6, 1.4);
  sk.ell(ns[0], ns[1], 1.1 * k, 0.9 * k, M.nose, { z: hz + 3 });
  // a mouthful of tussock while grazing
  if (anim === 'eat') {
    sk.np(true);
    const mp = H.p(9, 3.4);
    for (let i = 0; i < 4; i++) sk.blade(mp[0], mp[1], mp[0] + (i - 1.5) * 1.2 * k, mp[1] + (3 + i % 2) * k, s => (1 - s) * 0.6 + 0.2, M.tuft, { z0: hz + 4, z1: hz + 4 });
  }
  // the near brow-shield: ridged, swept back over the skull
  if (!juv) {
    sk.np();
    const s0 = H.p(2.8, -3.6), s1 = H.p(-8.8, -7.6);
    sk.blade(s0[0], s0[1], s1[0], s1[1], s => (1 - s * 0.5) * 2.6 * k, (p) => { if (Math.floor(p.t * 8) % 2 === 0) p.l += 0.16; else p.l -= 0.06; return M.horn; }, { z0: hz + 12, z1: hz + 11, bend: -1.6 * k, curl: 0.6 });
  } else {
    sk.np();
    const nb = H.p(1.5, -3.6);
    sk.ell(nb[0], nb[1], 1.6 * k, 1 * k, M.horn, { rot: H.a - 0.4, z: hz + 5 });
  }
  // near ear and the eye in its black band
  sk.np();
  ear(sk, H.p(-1.2, -2.6), H.ang(earA), 6 * k, 2.3 * k, M.wool, M.inner, hz + 7, 0, 1.15);
  const ec = H.p(3, -0.8);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: juv ? 1.2 : 1.5 }, eye);
  const headTop = H.p(0, -7);

  drawLeg(0);
  drawLeg(2);
  void bodyPart;
  return { head: [headTop[0], headTop[1] - 1] as V2, eye: ep };
}

export const TORHOPPER: SpeciesDef = {
  name: 'Torhopper', kind: 'mammal', len: 44, height: 40,
  anims: ANIMS,
  canvas: (_a, juv) => (juv ? { w: 60, h: 58, ox: 28, oy: 50 } : { w: 84, h: 76, ox: 40, oy: 66 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' || anim === 'leap' ? 'alert' : anim === 'play' ? 'angry' : 'open'),
};

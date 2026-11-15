// Flicker Marten (Ophiomachus velox): Zealandia's mongoose, a blindingly fast marten that picks fights
// with serpents twice its size and wins.
//
// Painted on the Relief layer (beasts-relief.ts): the body is one contour hung on a flexible spine (a
// curve from the rump to the withers that coils, stretches and arches through the bound, the lunge and
// the bristling taunt): long, low and sinuous like a snake-hunter, a long neck flowing into a small wedge
// head; a sleek vivid orange coat lying back in strands, a darker rust saddle with a ridge of longer
// guard hairs down the spine that bristle up when it fights, a cream bib from the chin to the chest;
// the head with a dark bandit mask through the amber eyes, cream cheeks and brow flecks, small round
// cream-rimmed ears, a black nose; short slender legs in black socks with neat claws; and a long bushy
// tail ringed in dark rust, its tip dark, its fur breaking the outline all along.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, cbez, ik2, hh, fr } from './beasts-core';
import { Frame2, whiskers } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS } from './beasts-relief';
import { Curve, ribbon, localOf, claw, clamp01 } from './beasts-mam-kit';
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
    fur: sk.m(rmp('#e27628', { n: 7, dark: 0.56, light: 0.42, cool: 0.24, warm: 0.4 }), { edge: 1 }),
    back: sk.m(rmp('#963a12', { n: 6, dark: 0.56, light: 0.34, cool: 0.22 }), { edge: 1 }),
    guard: sk.m(rmp('#5e2410', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    belly: sk.m(rmp('#f5dfb4', { n: 6, dark: 0.42, light: 0.35, at: 3 }), { edge: 1 }),
    leg: sk.m(rmp('#3c2016', { n: 6, dark: 0.55, light: 0.4, warm: 0.3 }), { edge: 1 }),
    mask: sk.m(rmp('#2b1a12', { n: 5, dark: 0.45, light: 0.32 }), { edge: 1 }),
    ring: sk.m(rmp('#5a2410', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    nose: sk.m(rmp('#1e1414', { n: 4, dark: 0.4, light: 0.5 }), { edge: 0, spec: 1 }),
    claw: sk.m(rmp('#e4d6c0', { n: 4, dark: 0.4, light: 0.4, at: 2 }), { edge: 1 }),
    mouth: sk.m(rmp('#8a2230', { n: 4, dark: 0.45, light: 0.35 }), { edge: 0 }),
    tooth: sk.m(rmp('#f6f0e0', { n: 4, dark: 0.3, at: 2 }), { edge: 0 }),
    inner: sk.m(rmp('#e0a080', { n: 4, dark: 0.4 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

const ID = { BODY: 1, HEAD: 2, LEG: 3, PAW: 4, CLAW: 5, TAIL: 6, EAR: 7, MOUTH: 8, TOOTH: 9 };

/** the bushy ringed tail along a chain; returns nothing (drawn into R) */
function tailInto(R: Relief, M: M, root: V2, a0: number, P: P, k: number, z: number, curlTo = 0) {
  const pts: V2[] = [root];
  let a = a0, x = root[0], y = root[1];
  for (let i = 0; i < 11; i++) {
    a += 0.02 + Math.sin(P.tailWave * TAU - i * 0.6) * 0.07 + (i > 7 ? 0.04 : 0) + curlTo;
    x += Math.cos(a) * 1.65 * k; y += Math.sin(a) * 1.65 * k;
    pts.push([x, P.curl ? Math.min(y, -0.8 * k) : y]);
  }
  const crv = new Curve(pts);
  const fat = 1 + P.fluff * 0.5;
  const wd = (t: number) => (1.5 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 1.2 - t * 1.1) * k * fat;
  const ol = fringe(spline(ribbon(pts, wd, wd, 0.5), 0.5), (P.fluff ? 1.1 : 1.4) * Math.max(0.8, k), 23, (xx, yy) => {
    const [t] = crv.project(xx, yy);
    return t > 0.12 ? [(0.9 + P.fluff * 0.9) * k + 0.2, -0.6] : null;
  });
  R.region(ol, { z, R: 1.6 * k, H: 2 * k, id: ID.TAIL, tex: (p, o) => {
    const [t] = crv.project(p.x, p.y);
    const at = crv.at(Math.max(0, Math.min(1, t)));
    o.z += strands(p.x, p.y, Math.atan2(at.u[1], at.u[0]) + 0.25, 2.2, 1.1, 27) * 0.7;
    const r = fr(t * 6 + (FS.tip > 0.7 ? 0.04 : 0));
    o.m = (r < 0.34 && t > 0.14) || t > 0.9 ? M.ring : M.fur;
    if (o.m === M.fur && FS.tip > 0.85 && hh(FS.row, FS.seg, 29) < 0.3) o.t += 0.08;
  } });
}

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.62 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  const gk = Math.max(0.8, k);
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(P.hip);
  const spL = P.len * k, sa = P.spine;
  const sh: V2 = [hip[0] + Math.cos(sa) * spL, hip[1] + Math.sin(sa) * spL];
  const nx = Math.sin(sa), ny = -Math.cos(sa);
  const c1: V2 = [hip[0] + Math.cos(sa) * spL * 0.33 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.33 + ny * P.bend * k];
  const c2: V2 = [hip[0] + Math.cos(sa) * spL * 0.7 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.7 + ny * P.bend * k];
  const rump: V2 = [hip[0] - Math.cos(sa) * 2.4 * k, hip[1] - Math.sin(sa) * 2.4 * k];
  const SP = new Curve([rump, ...cbez(hip, c1, c2, sh, 12)]);
  const up = P.upright;
  const fl = P.fluff;
  const br = P.br * 0.25;

  // ---------------------------------------------------------------- coat
  const coat = (p: Sp, o: Tx) => {
    const [t, off] = SP.project(p.x, p.y);
    const at = SP.at(Math.max(0, Math.min(1, t)));
    o.z += strands(p.x, p.y, Math.atan2(-at.u[1], -at.u[0]) + 0.12, 2.6 * gk, 1.1 * gk, 31) * 0.6;
    const o2 = off / k;
    o.m = M.fur;
    // the cream bib from the chin down the chest
    if (o2 < -1.2 && t > 0.62) { o.m = M.belly; return; }
    if (o2 < -2.2) { o.t += 0.04; }
    // the rust saddle along the back, a ridge of dark guard hairs down the spine
    if (o2 > 1.3 - Math.sin(t * 3.2) * 0.4 && t < 0.92) o.m = M.back;
    if (o2 > 2.6 && t > 0.08 && t < 0.86 && FS.tip > 0.4) o.m = M.guard;
    if (o.m === M.fur && FS.tip > 0.86 && hh(FS.row, FS.seg, 33) < 0.25) o.t += 0.08;
  };

  // ---------------------------------------------------------------- legs
  const legJ = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const root = front ? SP.V(0.86 - (near ? 0 : 0.03), -1.3 * k) : SP.V(0.12 + (near ? 0 : 0.03), -1.3 * k);
    let foot = S(P.feet[which]);
    if (!near) foot = [foot[0] + (front ? -0.8 : 0.8) * k, foot[1]];
    let lifted = foot[1] < -0.4 || P.air;
    let e: V2;
    if (front) {
      if (up > 0.5) {
        const ch = SP.V(0.8, -2.6 * k);
        e = [ch[0] + (2.2 + (near ? 0.4 : -0.4) + P.paws * 1.4) * k, ch[1] + (2.2 - P.paws * 4.2) * k];
        lifted = true;
      } else e = [foot[0] - 0.4 * k, foot[1] - 1.3 * k];
    } else {
      if (up > 0.5) foot = [hip[0] + (2.8 + (near ? 0.4 : -0.6)) * k, 0];
      const fa = up > 0.5 ? -Math.PI / 2 - 1.2 : lifted ? -Math.PI / 2 + 0.6 : -Math.PI / 2 - 0.55;
      e = [foot[0] + Math.cos(fa) * 2.6 * k, foot[1] + Math.sin(fa) * 2.6 * k];
    }
    const l1 = (front ? 3.8 : 4.2) * k, l2 = (front ? 3.6 : 3.9) * k;
    const [j, ee] = ik2(root, e, l1, l2, front ? 1 : -1);
    return { root, j, e: ee, foot, front, lifted };
  };
  type LJ = ReturnType<typeof legJ>;
  const legOutline = (L: LJ): LM[] => {
    const { root, j, e } = L, s = k;
    const upv: V2 = [root[0] - (j[0] - root[0]) * 0.6, root[1] - (j[1] - root[1]) * 0.6];
    if (L.front) return [
      along(upv, root, 1, 2 * s), along(root, j, 0.3, 1.8 * s), along(root, j, 0.95, 1.3 * s),
      along(j, e, 0.3, 1 * s), along(j, e, 1, 0.8 * s), along(j, e, 1.12, 0, 0.3), along(j, e, 0.9, -0.8 * s), along(j, e, 0.3, -1 * s),
      along(j, e, -0.15, -1.1 * s, 0.4), along(root, j, 0.5, -1.7 * s), along(upv, root, 0.5, -1.8 * s),
    ];
    return [
      along(upv, root, 1, 2.6 * s), along(root, j, 0.3, 2.4 * s), along(root, j, 1, 1.2 * s, 0.2),
      along(j, e, 0.4, 0.9 * s), along(j, e, 1, 0.75 * s), along(j, e, 1.14, -0.7 * s, 0.5), along(j, e, 0.5, -1 * s),
      along(root, j, 0.8, -1.7 * s), along(root, j, 0.3, -2.6 * s), along(upv, root, 0.5, -2.4 * s),
    ];
  };
  const legTex = (L: LJ) => (p: Sp, o: Tx) => {
    const ax = L.root, bx = L.e, dx = bx[0] - ax[0], dy = bx[1] - ax[1];
    const t = ((p.x - ax[0]) * dx + (p.y - ax[1]) * dy) / (dx * dx + dy * dy || 1);
    if (t < 0.3) { coat(p, o); return; }
    o.z += strands(p.x, p.y, Math.atan2(dy, dx), 1.4, 0.9, 37) * 0.4;
    o.m = M.leg;
  };
  /** the paw (and the hind foot's slender metatarsus) with its claws */
  const paw = (R: Relief, L: LJ, z0: number) => {
    const { e, foot } = L, s = k;
    if (!L.front) {
      // the metatarsus from the hock down to the toes
      R.cap(e, [foot[0] + 0.6 * s, foot[1] - 0.7 * s], 0.8 * s, 0.7 * s, { z: z0 - 0.5, rz: 0.8, id: ID.PAW, tex: M.leg });
    }
    const c0: V2 = L.front ? [e[0], e[1]] : [foot[0] + 0.6 * s, foot[1] - 0.7 * s];
    const ta = L.lifted ? (L.front ? 0.9 : 0.6) : 0;
    const c = Math.cos(ta), sn = Math.sin(ta);
    const q = (x: number, y: number, s2 = 0): LM => [c0[0] + (x * c - y * sn) * s, c0[1] + (x * sn + y * c) * s, s2];
    R.region(spline([q(-0.8, -0.7), q(1, -0.5), q(1.8, 0.4), q(1.3, 0.9, 0.3), q(-0.8, 0.8)], 0.4), { z: z0, R: 0.6, H: 0.8, id: ID.PAW, tex: M.leg });
    for (let i = 0; i < 2; i++) { const b = q(1.4 - i * 0.2, 0.2 + i * 0.4); claw(R, [b[0], b[1]], 0.4 + ta, 1 * s, 0.7 * s, 0.6, z0 + 0.6, ID.CLAW, M.claw); }
  };
  for (const w of [3, 1]) {
    const L = legJ(w);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0]), L.foot[0]) - 5, Math.min(...ol.map(q => q[1])) - 5, Math.max(...ol.map(q => q[0]), L.foot[0]) + 5, Math.max(1, Math.max(...ol.map(q => q[1]), L.foot[1]) + 5));
    R.region(spline(ol, 0.5), { z: -12, R: 1 * k, H: 1.4 * k, id: ID.LEG, tex: legTex(L) });
    paw(R, L, -10);
    sk.np();
    R.emit({ bias: -0.16, drop: 1.3, seam: 0.5, seamDark: 0.3 });
  }

  const BR = Relief.full(sk);
  // ---------------------------------------------------------------- tail
  tailInto(BR, M, rump, Math.PI + sa - 0.18 + P.tail * -0.8 + (up ? 1.25 : 0), P, k, -1);
  // ---------------------------------------------------------------- the body: one long sinuous contour along the spine, into the neck
  {
    const T = (t: number, off: number, s2 = 0) => SP.P(t, off * k, s2);
    const b = 1 + fl * 0.12;
    const body: LM[] = [
      T(-0.14, -0.6), T(-0.1, 1.6 * b), T(0.04, 2.9 * b + br), T(0.26, 3.4 * b + br), T(0.5, 3.2 * b + br), T(0.74, 2.9 * b), T(0.94, 2.6 * b), T(1.1, 2.1), T(1.2, 1.7),
      T(1.2, -1.8), T(1.06, -2.4), T(0.88, -2.9), T(0.66, -3 - br), T(0.42, -2.9 - br), T(0.2, -3), T(0.04, -2.6), T(-0.08, -1.8),
    ];
    const ol = fringe(spline(body, 0.5), (fl ? 1.1 : 1.6) * gk, 5, (x, y) => {
      const [t, off] = SP.project(x, y);
      if (off > 1.8 * k && t > 0.06 && t < 0.9) return fl ? [(1 + fl * 1.3) * k, -0.5] : [0.6 * k, -0.6];
      if (off < -2.2 * k && t > 0.1 && t < 0.8) return [0.8 * k, 0.5];
      return null;
    });
    BR.region(ol, { z: 0, R: 3 * k, H: 3.6 * k, id: ID.BODY, tex: coat, pow: 0.9 });
    const hc = SP.V(0.1, 0.4 * k), sc = SP.V(0.84, 0.3 * k);
    BR.bump(hc[0], hc[1], 3 * k, 3 * k, 0.9 * k, 0, ID.BODY);
    BR.bump(sc[0], sc[1], 2.4 * k, 2.8 * k, 0.6 * k, 0, ID.BODY);
  }
  for (const w of [2, 0]) {
    const L = legJ(w);
    const ax = L.root, ay = L.e, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    const lift = L.front && up > 0.5 ? 3 : 0;
    BR.region(spline(legOutline(L), 0.5), {
      R: 1.1 * k, H: 1.4 * k, id: ID.LEG, blend: 0.8, tex: legTex(L),
      zAt: (x, y) => { const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al); return 3.4 * k - Math.max(0, 1 - (t + 0.05) / 0.5) * 3.8 * k + lift; },
    });
    paw(BR, L, 4.6 * k + lift);
  }

  // ---------------------------------------------------------------- head
  const neck = SP.at(1.12).p;
  const H = new Frame2(neck, sa + P.head, k);
  const hp = (x: number, y: number, s2 = 0): LM => { const q = H.p(x, y); return [q[0], q[1], s2]; };
  const hinv = localOf(H.o, H.a, k);
  const ja = P.jaw * 0.62;
  const jp = (x: number, y: number, s2 = 0): LM => {
    const dx = x - 0.6, dy = y - 1.4, c = Math.cos(ja), s = Math.sin(ja);
    return hp(0.6 + dx * c - dy * s, 1.4 + dx * s + dy * c, s2);
  };
  const hz = 3.4 * k;
  {
    const head: LM[] = [hp(-2.4, -2.4), hp(0.4, -3.2), hp(2.8, -3), hp(4.8, -2), hp(6.6, -0.8), hp(7.6, 0, 0.4), hp(7.4, 0.9, 0.2), hp(6.4, 1.3), jp(5.6, 1.7), jp(3.2, 2.6), jp(0.8, 2.8), hp(-1.6, 2.4), hp(-2.8, 0.4)];
    BR.region(fringe(spline(head, 0.5), 1.1, 7, (x, y, _nx, ny) => { const [hx] = hinv(x, y); return hx < 2.5 && ny > 0.3 ? [0.8 * k, -0.5] : null; }), {
      z: hz, R: 2 * k, H: 2.4 * k, id: ID.HEAD, blend: 1.4, tex: (p, o) => {
        const [hx, hy] = hinv(p.x, p.y);
        o.z += strands(p.x, p.y, H.ang(Math.PI), 1.5, 0.9, 39) * 0.35;
        o.m = M.fur;
        // cream cheek and chin below the mask; the dark bandit mask through the eye to the nose bridge; a cream brow fleck
        const band = -0.45 + (hx - 3.2) * 0.1;
        if (hy > 1.25 + Math.max(0, 2 - hx) * 0.3) o.m = M.belly;
        else if (Math.abs(hy - band) < 1.05 - Math.max(0, hx - 5.8) * 0.35 && hx > 0.6) o.m = M.mask;
        else if (hy > 0.7 && hx > 3.6) o.m = M.belly;
        if (Math.hypot(hx - 3.9, hy + 2.1) < 0.6) o.m = M.belly;
        if (hx > 7) o.m = M.nose;
        if (hy < -1.6 && hx < 2.6) o.m = M.back;
      },
    });
    if (P.jaw > 0.2) {
      // jaws wide: the red mouth, the long upper and lower canines
      const a = H.p(2.4, 1.6), b = H.p(6.8, 1.2), c = jp(5.6, 1.9), d = jp(2.6, 2.4);
      BR.region(spline([[a[0], a[1], 0], [b[0], b[1], 0.4], [c[0], c[1], 0.4], [d[0], d[1], 0]], 0.4), { z: hz + 2 * k, R: 0.5, H: 0.4, id: ID.MOUTH, tex: M.mouth });
      const f1 = H.p(6.2, 1.2), f2 = H.p(6.1, 2.6);
      BR.cap(f1, f2, 0.5 * k, 0.3 * k, { z: hz + 3 * k, rz: 0.5, id: ID.TOOTH, tex: M.tooth });
      const g1 = jp(5.4, 1.9), g2 = jp(5.5, 0.8);
      BR.cap([g1[0], g1[1]], [g2[0], g2[1]], 0.5 * k, 0.3 * k, { z: hz + 3 * k, rz: 0.5, id: ID.TOOTH, tex: M.tooth });
    }
    { const c = H.p(1.4, 1.2); BR.bump(c[0], c[1], 1.8 * k, 1.4 * k, 0.5 * k, 0, ID.HEAD); }
    // small round ears, cream-rimmed
    for (const near of [false, true]) {
      const eb = H.p(near ? -0.8 : 0, near ? -2.2 : -2.8);
      const ea = H.ang(-2.1 + P.ear * 0.35 - (near ? 0 : 0.3));
      const ca = Math.cos(ea), sa2 = Math.sin(ea), nnx = -sa2, nny = ca;
      const q = (t: number, w: number, s2 = 0): LM => [eb[0] + (ca * t * 2.1 + nnx * w * 1.2) * k, eb[1] + (sa2 * t * 2.1 + nny * w * 1.2) * k, s2];
      BR.region(spline([q(-0.2, -0.9), q(0.6, -1.05), q(1.05, 0, 0.2), q(0.6, 1), q(-0.2, 0.8)], 0.4), { z: hz + (near ? 2.8 : -1.5) * k, R: 0.7, H: 0.9, id: ID.EAR, tex: (p, o) => {
        const t = ((p.x - eb[0]) * ca + (p.y - eb[1]) * sa2) / (2.1 * k);
        o.m = p.s < 0.7 && t > 0.55 ? M.belly : M.mask;
      } });
    }
  }
  BR.shadow(ID.HEAD, 0.8, 1.2, 0.1, ID.BODY, 1);
  BR.shadow(ID.LEG, 0.8, 0.8, 0.1, ID.BODY, 1);
  BR.shadow(ID.BODY, 0.8, 1, 0.08, ID.TAIL, 1);
  sk.np();
  BR.emit({ drop: 1.3 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });

  const ec = H.p(3.3, -0.5);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 0.5 : 1 }, eye);
  whiskers(sk, H.p(6.6, 1), Math.cos(H.a) >= 0 ? 1 : -1, 4.5 * k, hex('#f4e4c8'), 2, 0.3, 0.12);
  const hc = H.p(2.4, -2);
  void clamp01;
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

/** Asleep: curled in a ring, nose to the tail, the bushy tail wrapped round the front like a stole. */
function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const BR = Relief.full(sk);
  const br = P.br * 0.35;
  const q = (x: number, y: number, s2 = 0): LM => [x * k, y * k, s2];
  const ctr: V2 = [-0.6 * k, -2 * k];
  const body: LM[] = [q(-8.6, -0.2, 0.3), q(-9.2, -3.2), q(-7, -6.6 - br), q(-2.4, -8.2 - br), q(2.6, -7.6 - br), q(6, -5.4), q(7.2, -2.4), q(6.6, -0.2, 0.3)];
  BR.region(fringe(spline(body, 0.5), 1.5, 5, (_x, _y, _nx, ny) => (ny < -0.3 ? [0.6 * k, -0.6] : null)), { z: 0, R: 4 * k, H: 4.4 * k, id: ID.BODY, pow: 0.85, tex: (p, o) => {
    const a = Math.atan2(p.y - ctr[1], p.x - ctr[0]);
    o.z += strands(p.x, p.y, a - 1.5, 2.4, 1.1, 31) * 0.55;
    const r = Math.hypot(p.x - ctr[0], p.y - ctr[1]) / k;
    o.m = r > 5.4 && a < -0.4 && a > -2.8 ? M.back : M.fur;
    if (r > 6.6 && a < -0.9 && a > -2.4 && FS.tip > 0.4) o.m = M.guard;
  } });
  // the head resting on the tail at the front, eyes shut
  const H = new Frame2([3 * k, -4.6 * k], 0.38, k);
  const hp = (x: number, y: number, s2 = 0): LM => { const qq = H.p(x, y); return [qq[0], qq[1], s2]; };
  const hinv = localOf(H.o, H.a, k);
  BR.region(spline([hp(-2.4, -2.4), hp(0.4, -3.1), hp(2.8, -2.9), hp(4.8, -1.9), hp(6.6, -0.6), hp(7.2, 0.4, 0.4), hp(6.2, 1.3), hp(3, 2.4), hp(-1.4, 2.4), hp(-2.8, 0.4)], 0.5), {
    z: 6 * k, R: 2 * k, H: 2.4 * k, id: ID.HEAD, tex: (p, o) => {
      const [hx, hy] = hinv(p.x, p.y);
      const band = -0.5 + (hx - 3.2) * 0.12;
      o.m = hy > 0.75 ? M.belly : Math.abs(hy - band) < 0.9 && hx > 1 ? M.mask : M.fur;
      if (hx > 6.6) o.m = M.nose;
    },
  });
  { const eb = H.p(-0.6, -2.2); BR.region(spline([[eb[0] - 1.2 * k, eb[1] + 0.4 * k, 0], [eb[0] - 0.6 * k, eb[1] - 1.4 * k, 0.3], [eb[0] + 0.9 * k, eb[1] - 0.2 * k, 0]], 0.4), { z: 8 * k, R: 0.6, H: 0.7, id: ID.EAR, tex: (p, o) => { o.m = p.s < 0.6 ? M.belly : M.back; } }); }
  // the tail wrapped round the front along the ground, under the chin
  tailInto(BR, M, [-8 * k, -1.6 * k], -0.12, { ...P, tailWave: 0.3 }, k, 8 * k, 0.012);
  BR.shadow(ID.HEAD, 0.8, 1.2, 0.12, ID.TAIL, 1);
  BR.shadow(ID.TAIL, 0.6, 1, 0.12, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.3 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });
  const ec = H.p(3.3, -0.5);
  const e = drawEye(sk, ec[0], ec[1], { ...EYE, r: 1 }, eye);
  return { head: [0, -8.2 * k * 2 - 3] as V2, eye: e };
}

export const FLICKER: SpeciesDef = {
  name: 'Flicker Marten', kind: 'mammal', len: 44, height: 14,
  anims: ANIMS,
  canvas: () => ({ w: 96, h: 56, ox: 46, oy: 44 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'fight' || anim === 'taunt' ? 'angry' : 'open'),
};

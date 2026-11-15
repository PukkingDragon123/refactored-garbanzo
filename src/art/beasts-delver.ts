// Tunnel Delver (Fossorimys vigil): a colonial burrower, half meerkat and half mole-rat, that digs tunnel
// towns and pops up to stand sentry for serpents.
//
// Painted on the Relief layer (beasts-relief.ts): the body is one contour hung on a flexible spine (a
// curve from the rump to the withers, so the same landmarks make the low forager, the bounding run, the
// head-first dive and the bolt-upright sentinel): a long, cylindrical, velvety body, sandy with dark
// saddle bands across the back, a pale cream throat and belly, the haunch rounded; a blunt wedge head
// with a fleshy pink nose ringed by a fringe of tiny feeler-petals, two orange chisel incisors that
// never close behind the lips, a tiny eye in a dark eye patch and a little crescent of an ear set flush
// against the skull; short, massive forearms carrying three long, pale, curved digging claws on each
// hand (held hanging at the chest when it stands sentry); long plantigrade hind feet; a thin tail with
// a dark tip, propped on the ground when it stands.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, fr, cbez, ik2, hh } from './beasts-core';
import { Frame2, whiskers } from './beasts-rig';
import { Relief, Sp, Tx, LM, spline, fringe, along, strands, FS } from './beasts-relief';
import { Curve, ribbon, localOf, claw, crumb, mound, clamp01 } from './beasts-mam-kit';
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

const EYE: EyeSpec = { r: 1, iris: hex('#1c120e'), lash: hex('#3c2a1e'), dark: true, shine: hex('#fff0d0') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#b07c48', { n: 7, dark: 0.6, light: 0.42, warm: 0.42, cool: 0.32 }), { edge: 1 }),
    band: sk.m(rmp('#5a3a24', { n: 6, dark: 0.55, light: 0.36, cool: 0.3 }), { edge: 1 }),
    belly: sk.m(rmp('#e6cc9c', { n: 6, dark: 0.45, light: 0.35, at: 3 }), { edge: 1 }),
    limb: sk.m(rmp('#4a3222', { n: 6, dark: 0.55, light: 0.38, warm: 0.3 }), { edge: 1 }),
    crown: sk.m(rmp('#9a6c44', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    patch: sk.m(rmp('#3e2a1e', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    nose: sk.m(rmp('#e89088', { n: 6, dark: 0.45, light: 0.4, at: 3 }), { edge: 0, spec: 1 }),
    noseD: sk.m(rmp('#b0605c', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    claw: sk.m(rmp('#f6ecd4', { n: 6, dark: 0.42, light: 0.4, at: 3 }), { edge: 1 }),
    clawD: sk.m(rmp('#9a8466', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    skin: sk.m(rmp('#c89a84', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    tooth: sk.m(rmp('#f0a43c', { n: 5, dark: 0.4, light: 0.4, at: 3 }), { edge: 0 }),
    inner: sk.m(rmp('#c88a7c', { n: 4, dark: 0.5 }), { edge: 0 }),
    soil: sk.m(rmp('#7a5838', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    soilD: sk.m(rmp('#4c3424', { n: 4, dark: 0.5, light: 0.3 }), { edge: 1 }),
    hole: sk.m(rmp('#1c120e', { n: 2, dark: 0.3 }), { noRim: true, edge: 0 }),
    mouth: sk.m(rmp('#4a1c24', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

const ID = { BODY: 1, HEAD: 2, LEG: 3, HAND: 4, CLAW: 5, TAIL: 6, EAR: 7, NOSE: 8, TOOTH: 9, MOUTH: 10, SOIL: 11, HOLE: 12 };

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const k = juv ? 0.65 : 1;
  const M = mats(sk);
  sk.clipY = 0;
  const P = pose(anim, frame, n);
  if (P.curl) return drawCurled(sk, M, P, k, eye);
  const gk = Math.max(0.8, k);
  const S = (v: V2): V2 => [v[0] * k, v[1] * k];
  const hip = S(P.hip);
  const spL = 10.5 * k, sa = P.spine;
  const sh: V2 = [hip[0] + Math.cos(sa) * spL, hip[1] + Math.sin(sa) * spL];
  const nx = Math.sin(sa), ny = -Math.cos(sa);
  const c1: V2 = [hip[0] + Math.cos(sa) * spL * 0.33 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.33 + ny * P.bend * k];
  const c2: V2 = [hip[0] + Math.cos(sa) * spL * 0.7 + nx * P.bend * k, hip[1] + Math.sin(sa) * spL * 0.7 + ny * P.bend * k];
  const rump: V2 = [hip[0] - Math.cos(sa) * 2.4 * k, hip[1] - Math.sin(sa) * 2.4 * k];
  const SP = new Curve([rump, ...cbez(hip, c1, c2, sh, 10)]);
  const up = P.upright;
  const dir = Math.cos(sa) >= -0.05 || up > 0.5 ? 1 : 1;
  const br = P.br * 0.25;

  // ---------------------------------------------------------------- coat
  /** short velvety fur lying back along the spine, dark saddle bands across the back, a cream belly */
  const coat = (p: Sp, o: Tx) => {
    const [t, off] = SP.project(p.x, p.y);
    const at = SP.at(Math.max(0, Math.min(1, t)));
    o.z += strands(p.x, p.y, Math.atan2(-at.u[1], -at.u[0]) + 0.2, 1.8 * gk, 1 * gk, 7) * 0.55;
    const o2 = off / k;
    o.m = M.fur;
    if (o2 < -1.3 + Math.sin(t * 9) * 0.3) { o.m = M.belly; return; }
    // the bands: bold dark bars across the back, tapering down the flank, their edges broken by the fur
    const b = fr(t * 4.6 + 0.2 + o2 * 0.05 + (FS.tip > 0.7 ? 0.05 : 0));
    const bw = 0.42 - clamp01((1.4 - o2) / 3) * 0.3;
    if (t > 0.04 && t < 0.9 && o2 > -0.6 && b < bw) { o.m = M.band; if (p.s < 0.8) o.t += 0.06; return; }
    if (FS.tip > 0.84 && hh(FS.row, FS.seg, 9) < 0.2) o.t += 0.08;
  };

  // ---------------------------------------------------------------- legs
  const legJ = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    const root = front ? SP.V(0.84 - (near ? 0 : 0.04), -1.5 * k) : SP.V(0.14 + (near ? 0 : 0.04), -1.3 * k);
    const off = P.feet[which];
    let foot: V2 = front ? [(5.2 + off[0] + (near ? 0 : -0.8)) * k, Math.min(0, off[1] * k)] : [(-4.6 + off[0] + (near ? 0 : 0.8)) * k, Math.min(0, off[1] * k)];
    let lifted = off[1] < -0.4;
    let e: V2;
    if (front) {
      if (up > 0.5) {
        // forepaws held at the chest, the claws hanging (raised to the face when grooming)
        const ch = SP.V(0.8, -3.2 * k);
        const fw: V2 = [Math.cos(sa + P.head * 0.3), Math.sin(sa)];
        e = [ch[0] + (2.6 + (near ? 0.4 : -0.3) + P.paws * 0.6) * k, ch[1] + (1.6 - P.paws * 3.4) * k + fw[1] * 0];
        lifted = true;
      } else e = [foot[0] - 0.8 * k, foot[1] - 1.9 * k];
      foot = [e[0] + 0.8 * k, e[1] + 1.9 * k];
    } else {
      if (up > 0.5) foot = [hip[0] + (2.4 + (near ? 0.5 : -0.6)) * k, 0];
      e = [foot[0] - 2 * k, foot[1] - 1.2 * k];
      if (up > 0.5) e = [foot[0] - 2.2 * k, -1.4 * k];
    }
    const l1 = (front ? 3.2 : 3.8) * k, l2 = (front ? 3 : 3.6) * k;
    const [j, ee] = ik2(root, e, l1, l2, front ? 1 : -1);
    return { root, j, e: ee, foot, front, near, lifted };
  };
  type LJ = ReturnType<typeof legJ>;
  const legOutline = (L: LJ): LM[] => {
    const { root, j, e } = L, s = k;
    const upv: V2 = [root[0] - (j[0] - root[0]) * 0.6, root[1] - (j[1] - root[1]) * 0.6];
    if (L.front) return [
      along(upv, root, 1, 2 * s), along(root, j, 0.3, 1.9 * s), along(root, j, 0.95, 1.6 * s),
      along(j, e, 0.3, 1.5 * s), along(j, e, 0.9, 1.3 * s), along(j, e, 1.12, 0, 0.3), along(j, e, 0.9, -1.3 * s), along(j, e, 0.3, -1.5 * s),
      along(j, e, -0.15, -1.3 * s, 0.4), along(root, j, 0.5, -1.9 * s), along(upv, root, 0.5, -1.8 * s),
    ];
    return [
      along(upv, root, 1, 2.8 * s), along(root, j, 0.3, 2.7 * s), along(root, j, 1, 1.4 * s, 0.2),
      along(j, e, 0.4, 1 * s), along(j, e, 1, 0.9 * s), along(j, e, 1.12, -0.8 * s, 0.4), along(j, e, 0.5, -1.1 * s),
      along(root, j, 0.8, -2 * s), along(root, j, 0.3, -2.8 * s), along(upv, root, 0.5, -2.6 * s),
    ];
  };
  /** the hand with its three great claws, or the long hind sole */
  /** the leg's coat: sandy at the shoulder and haunch, dark gloves and boots from the elbow and knee down */
  const legTex = (L: LJ) => (p: Sp, o: Tx) => {
    const ax = L.root, bx = L.e, dx = bx[0] - ax[0], dy = bx[1] - ax[1];
    const t = ((p.x - ax[0]) * dx + (p.y - ax[1]) * dy) / (dx * dx + dy * dy || 1);
    if (t < 0.35) { coat(p, o); return; }
    o.z += strands(p.x, p.y, Math.atan2(dy, dx), 1.4, 0.9, 19) * 0.4;
    o.m = M.limb;
  };
  const foot = (R: Relief, L: LJ, z0: number) => {
    const { e } = L, s = k;
    if (L.front) {
      const ha = up > 0.5 ? Math.PI / 2 - 0.5 : L.lifted ? 0.7 : -0.15;
      const c = Math.cos(ha), sn = Math.sin(ha);
      const q = (x: number, y: number, sh2 = 0): LM => [e[0] + (x * c - y * sn) * s, e[1] + (x * sn + y * c) * s, sh2];
      R.region(spline([q(-0.9, -1.1), q(1.3, -1), q(1.9, 0.2), q(1.3, 1.2, 0.3), q(-0.9, 1.1)], 0.4), { z: z0, R: 0.8, H: 1, id: ID.HAND, tex: (p, o) => { o.m = M.limb; if (p.v > 0.6) o.m = M.patch; } });
      const rake = P.dirt ? -0.3 : 0;
      for (let i = 2; i >= 0; i--) {
        const b = q(1.4 - i * 0.15, -0.4 + i * 0.6);
        const grounded = up < 0.5 && !L.lifted;
        claw(R, [b[0], b[1] - (grounded ? 0.5 * s : 0)], ha + (grounded ? -0.2 : 0.3) + i * 0.1 + rake, [3.2, 4, 2.8][i] * s, 1.6 * s, grounded ? 1.5 : 1.15, z0 + 1 + (i === 1 ? 0.3 : 0), ID.CLAW, (u) => (u < 0.2 ? M.clawD : M.claw));
      }
    } else {
      const fa = L.lifted ? 0.7 : 0;
      const c = Math.cos(fa), sn = Math.sin(fa);
      const q = (x: number, y: number, sh2 = 0): LM => [e[0] + (x * c - y * sn) * s, e[1] + (x * sn + y * c) * s, sh2];
      R.region(spline([q(-1, -0.8), q(1.4, -0.3), q(3.2, 0.4), q(3.3, 1.2, 0.4), q(-0.4, 1.3), q(-1.3, 0.6, 0.3)], 0.4), { z: z0, R: 0.8, H: 1, id: ID.HAND, tex: (p, o) => { o.m = M.limb; if (p.v > 0.6) o.m = M.patch; } });
      for (let i = 0; i < 2; i++) { const b = q(3 - i * 0.2, 0.5 + i * 0.5); claw(R, [b[0], b[1]], 0.3 + fa, 1.2 * s, 0.7 * s, 0.6, z0 + 0.8, ID.CLAW, M.claw); }
    }
  };
  for (const w of [3, 1]) {
    const L = legJ(w);
    const ol = legOutline(L);
    const R = new Relief(sk, Math.min(...ol.map(q => q[0])) - 6, Math.min(...ol.map(q => q[1])) - 5, Math.max(...ol.map(q => q[0])) + 6, Math.max(1, Math.max(...ol.map(q => q[1])) + 5));
    R.region(spline(ol, 0.5), { z: -12, R: 1.2 * k, H: 1.6 * k, id: ID.LEG, tex: legTex(L) });
    foot(R, L, -10);
    sk.np();
    R.emit({ bias: -0.18, drop: 1.3, seam: 0.5, seamDark: 0.3 });
  }

  const BR = Relief.full(sk);
  // ---------------------------------------------------------------- tail: thin, tapering, the tip dark; a prop when upright
  {
    const tA = Math.PI + sa - 0.35 + P.tail - P.tailLift * 1.2 + (up ? 1.2 * up : 0);
    const pts: V2[] = [rump];
    let a = tA, x = rump[0], y = rump[1];
    for (let i = 0; i < 6; i++) {
      a += 0.12 + (up > 0.5 ? 0.12 : 0) - i * 0.02 * P.tailLift;
      x += Math.cos(a) * 1.55 * k; y += Math.sin(a) * 1.55 * k;
      pts.push([x, Math.min(y, -0.7 * k)]);
    }
    const crv = new Curve(pts);
    BR.region(spline(ribbon(pts, t => (1.4 - 0.95 * t) * k, t => (1.4 - 0.95 * t) * k, 0.6), 0.5), { z: -1, R: 1 * k, H: 1.2 * k, id: ID.TAIL, tex: (p, o) => {
      const [t] = crv.project(p.x, p.y);
      o.z += strands(p.x, p.y, a + Math.PI, 1.4, 0.9, 11) * 0.4;
      o.m = t > 0.78 ? M.patch : M.fur;
    } });
  }
  // ---------------------------------------------------------------- the body: one contour along the spine
  {
    const T = (t: number, off: number, s2 = 0) => SP.P(t, off * k, s2);
    const body: LM[] = [
      T(-0.16, -0.4), T(-0.1, 1.8), T(0.06, 3.1 + br), T(0.3, 3.6 + br), T(0.55, 3.5 + br), T(0.8, 3.2), T(0.98, 2.7), T(1.1, 2.3),
      T(1.1, -2.2), T(0.96, -3), T(0.78, -3.6 - br), T(0.52, -3.9 - br), T(0.3, -3.7), T(0.14, -3.5), T(-0.02, -3), T(-0.12, -2),
    ];
    const ol = fringe(spline(body, 0.5), 1.3 * gk, 5, (x, y) => {
      const [t, off] = SP.project(x, y);
      return off < -2.4 * k && t > 0.15 && t < 0.95 ? [0.7 * k + 0.2, 0.4] : null;
    });
    BR.region(ol, { z: 0, R: 3.4 * k, H: 4 * k, id: ID.BODY, tex: coat, pow: 0.9 });
    // the haunch, the shoulder, the ribs
    const hc = SP.V(0.14, 0.2 * k), sc = SP.V(0.8, 0.2 * k);
    BR.bump(hc[0], hc[1], 3.2 * k, 3.2 * k, 1 * k, 0, ID.BODY);
    BR.bump(sc[0], sc[1], 2.4 * k, 3 * k, 0.6 * k, 0, ID.BODY);
  }
  // near legs, fused in at the shoulder and the hip
  for (const w of [2, 0]) {
    const L = legJ(w);
    const ax = L.root, ay = L.e, al = Math.hypot(ay[0] - ax[0], ay[1] - ax[1]) || 1;
    BR.region(spline(legOutline(L), 0.5), {
      R: 1.3 * k, H: 1.6 * k, id: ID.LEG, blend: 0.8, tex: legTex(L),
      zAt: (x, y) => { const t = ((x - ax[0]) * (ay[0] - ax[0]) + (y - ax[1]) * (ay[1] - ax[1])) / (al * al); return 3.6 * k - Math.max(0, 1 - (t + 0.05) / 0.5) * 4 * k + (L.front && up > 0.5 ? 3 : 0); },
    });
    foot(BR, L, 5 * k + (L.front && up > 0.5 ? 3 : 0));
  }

  // ---------------------------------------------------------------- the head
  const neck = SP.at(1).p;
  const hk = k * 1.1;
  const H = new Frame2(neck, sa + P.head, hk);
  const hp = (x: number, y: number, s2 = 0): LM => { const q = H.p(x, y); return [q[0], q[1], s2]; };
  const hinv = localOf(H.o, H.a, hk);
  const ja = P.jaw * 0.35;
  const jp = (x: number, y: number, s2 = 0): LM => {
    const dx = x - 0.5, dy = y - 1.8, c = Math.cos(ja), s = Math.sin(ja);
    return hp(0.5 + dx * c - dy * s, 1.8 + dx * s + dy * c, s2);
  };
  const hz = 3.4 * k;
  {
    const head: LM[] = [hp(-2.4, -2.6), hp(0.6, -3.5), hp(3.4, -3.1), hp(5.4, -1.9), hp(6.8, -0.7), hp(7.4, 0.5, 0.3), hp(7.2, 1.7, 0.3), hp(6.2, 2.1), jp(5.2, 2.6), jp(2.4, 3.3), jp(0, 3.2), hp(-1.8, 2.6), hp(-2.8, 0.4)];
    BR.region(fringe(spline(head, 0.5), 1.1, 3, (x, y, _nx, ny) => { const [hx] = hinv(x, y); return hx < 3 && ny > 0.4 ? [0.8 * k, -0.4] : null; }), {
      z: hz, R: 2.2 * k, H: 2.6 * k, id: ID.HEAD, blend: 1.2, tex: (p, o) => {
        const [hx, hy] = hinv(p.x, p.y);
        o.z += strands(p.x, p.y, H.ang(Math.PI), 1.4, 0.9, 13) * 0.35;
        o.m = hy > 1.3 - hx * 0.05 ? M.belly : hy < -1.6 && hx < 4 ? M.crown : M.fur;
        // the dark eye patch, a teardrop toward the nose
        const ed = Math.hypot(hx - 3.3, (hy + 0.9) * 1.25);
        if (ed < 1.5 || (hx > 3.3 && hx < 5 && Math.abs(hy + 0.6 - (hx - 3.3) * 0.25) < 0.55)) o.m = M.patch;
        if (hx > 6.3) { o.m = M.nose; if (hy > 0.9) o.m = M.noseD; }
      },
    });
    // the nose's fringe of fleshy feeler-petals
    for (let i = 0; i < 4; i++) {
      const a = -1.1 + i * 0.6;
      const b = hp(6.9 + Math.cos(a) * 0.6, 0.6 + Math.sin(a) * 1.2);
      const tip = hp(6.9 + Math.cos(a) * 1.9, 0.6 + Math.sin(a) * 1.9);
      BR.cap([b[0], b[1]], [tip[0], tip[1]], 0.55 * k, 0.4 * k, { z: hz + 2.6 * k, rz: 0.6, id: ID.NOSE, tex: M.nose });
    }
    // the chisel incisors, always showing
    for (const dx of [0, 0.7]) {
      const a = hp(5.6 + dx, 1.9);
      const b = P.jaw > 0.4 ? hp(5.4 + dx, 3.6) : hp(5.4 + dx, 3.1);
      BR.cap([a[0], a[1]], [b[0], b[1]], 0.5 * k, 0.45 * k, { z: hz + 3 * k - dx, rz: 0.5, id: ID.TOOTH, tex: M.tooth });
    }
    if (P.jaw > 0.4) {
      const a = H.p(3, 2.2), b = H.p(6, 2.2), c = jp(5, 2.8);
      BR.region(spline([[a[0], a[1], 0], [b[0], b[1], 0.4], [c[0], c[1], 0.4]], 0.4), { z: hz + 2 * k, R: 0.4, H: 0.3, id: ID.MOUTH, tex: M.mouth });
    }
    { const c = H.p(1.2, 1.4); BR.bump(c[0], c[1], 2 * k, 1.6 * k, 0.5 * k, 0, ID.HEAD); }
    // the little crescent ear flush against the skull
    {
      const eb = H.p(-0.6, -2.4);
      const ea = H.ang(-2.4 + P.ear * 0.3);
      const ca = Math.cos(ea), sa2 = Math.sin(ea), nnx = -sa2, nny = ca;
      const q = (t: number, w: number, s2 = 0): LM => [eb[0] + (ca * t * 1.9 + nnx * w * 1.2) * k, eb[1] + (sa2 * t * 1.9 + nny * w * 1.2) * k, s2];
      BR.region(spline([q(-0.2, -0.8), q(0.6, -1), q(1.05, 0, 0.3), q(0.5, 0.9), q(-0.2, 0.7)], 0.4), { z: hz + 2.6 * k, R: 0.6, H: 0.8, id: ID.EAR, tex: (p, o) => { o.m = M.band; if (p.s > 0.7) { o.m = M.inner; o.z -= 0.4; } } });
    }
  }
  BR.shadow(ID.HEAD, 0.8, 1.2, 0.1, ID.BODY, 1);
  BR.shadow(ID.LEG, 0.8, 0.8, 0.1, ID.BODY, 1);
  BR.shadow(ID.CLAW, 0.6, 0.8, 0.12, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.3 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });

  const ec = H.p(3.3, -0.9);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k < 0.8 ? 0.5 : 1 }, eye);
  whiskers(sk, H.p(6.4, 1.2), Math.cos(H.a) >= 0 ? dir : -1, 3.5 * k, hex('#f0e2c4'), 2, 0.35, 0.1);

  // ---------------------------------------------------------------- burrow mouth and flung dirt
  if (P.hole) {
    const R = new Relief(sk, -4 * k, -5 * k, 16 * k, 1);
    mound(R, 11.5 * k, 3.6 * k, 1.8 * k, 3, 30, ID.SOIL, M.soil, M.soilD);
    const hl: LM[] = [[1 * k, -0.3, 0.3], [3.4 * k, -1.5 * k, 0], [6.8 * k, -1.7 * k, 0], [9.6 * k, -0.8 * k, 0], [10 * k, 0.4, 0.3], [1 * k, 0.4, 0.3]];
    R.region(spline(hl, 0.4), { z: 32, R: 0.6, H: 0.3, id: ID.HOLE, tex: (p, o) => { o.m = p.v < 0.25 ? M.soilD : M.hole; } });
    sk.np();
    R.emit({ drop: 1.2, seam: 0.5 });
  }
  if (P.dirt) {
    const n2 = Math.round(5 * P.dirt);
    for (let i = 0; i < n2; i++) {
      const ph = fr(P.dirtPhase + i / 5);
      const x = (P.hole ? 2 - ph * 14 : -9 - ph * 12) * k, y = (-1.5 - Math.sin(ph * Math.PI) * (5 + (i % 3) * 2)) * k;
      crumb(sk, x, y, i, M.soil, M.soilD);
    }
    if (!P.hole) {
      const R = new Relief(sk, 6 * k, -4 * k, 16 * k, 1);
      mound(R, 11 * k, 3 * k, 1.5 * k, 7, 30, ID.SOIL, M.soil, M.soilD);
      sk.np();
      R.emit({ drop: 1.2, seam: 0.5 });
    }
  }
  const hc = H.p(2.5, -1.5);
  return { head: [hc[0], hc[1] - 2 * k] as V2, eye: ep };
}

/** Curled up asleep: a round loaf with the back arched, the head tucked down between the claws, the tail round the front. */
function drawCurled(sk: Sk, M: M, P: P, k: number, eye: BeastEye) {
  const BR = Relief.full(sk);
  const br = P.br * 0.3;
  const ctr: V2 = [-0.4 * k, -1 * k];
  const q = (x: number, y: number, s2 = 0): LM => [x * k, y * k, s2];
  const body: LM[] = [q(-7, -0.2, 0.3), q(-7.8, -3.4), q(-5.8, -7 - br), q(-1.6, -8.8 - br), q(2.6, -8.2 - br), q(5.4, -6), q(6.4, -3), q(6, -0.2, 0.3)];
  BR.region(fringe(spline(body, 0.5), 1.3, 5, (_x, _y, _nx, ny) => (ny < -0.3 ? [0.6 * k, -0.5] : null)), { z: 0, R: 4 * k, H: 4.4 * k, id: ID.BODY, pow: 0.85, tex: (p, o) => {
    const a = Math.atan2(p.y - ctr[1], p.x - ctr[0]);
    o.z += strands(p.x, p.y, a - 1.5, 1.8, 1, 7) * 0.5;
    const r = Math.hypot(p.x - ctr[0], p.y - ctr[1]) / k;
    // bands radiate over the arched back like the curled body's own bars
    const b = fr((a + Math.PI) * 1.9 + (FS.tip > 0.7 ? 0.06 : 0));
    o.m = r > 4.2 && b < 0.38 && a < -0.5 ? M.band : M.fur;
    if (p.y > -1.6 * k && p.x > -2 * k) o.m = M.belly;
  } });
  // the head tucked in at the front, chin down on the forepaws
  const H = new Frame2([3.6 * k, -5 * k], 0.32, k);
  const hp = (x: number, y: number, s2 = 0): LM => { const qq = H.p(x, y); return [qq[0], qq[1], s2]; };
  const hinv = localOf(H.o, H.a, k);
  BR.region(spline([hp(-2.4, -2.4), hp(0.6, -3.2), hp(3.4, -2.8), hp(5.2, -1.6), hp(6, 0.2, 0.3), hp(5.4, 1.6), hp(2.4, 2.6), hp(-1.4, 2.4), hp(-2.8, 0.2)], 0.5), {
    z: 6 * k, R: 2 * k, H: 2.4 * k, id: ID.HEAD, tex: (p, o) => {
      const [hx, hy] = hinv(p.x, p.y);
      o.z += strands(p.x, p.y, H.ang(Math.PI), 1.4, 0.9, 13) * 0.3;
      o.m = hy > 1.1 ? M.belly : hy < -1.6 && hx < 3.5 ? M.crown : M.fur;
      if (Math.hypot(hx - 3, (hy + 0.8) * 1.25) < 1.4) o.m = M.patch;
      if (hx > 5.2) o.m = M.nose;
    },
  });
  { const eb = H.p(-0.6, -2.2); BR.region(spline([[eb[0] - 1 * k, eb[1] + 0.4 * k, 0], [eb[0] - 0.4 * k, eb[1] - 1.2 * k, 0.3], [eb[0] + 0.8 * k, eb[1] - 0.2 * k, 0]], 0.4), { z: 8 * k, R: 0.6, H: 0.7, id: ID.EAR, tex: M.band }); }
  // the tail round the front along the ground
  const tp: V2[] = [];
  for (let i = 0; i <= 7; i++) tp.push([(-6.8 + i * 1.75) * k, (-0.9 - Math.sin(i / 7 * Math.PI) * 0.5) * k]);
  const tc = new Curve(tp);
  BR.region(spline(ribbon(tp, t => (1.2 - 0.7 * t) * k, t => (1.2 - 0.7 * t) * k, 0.6), 0.5), { z: 9 * k, R: 0.9 * k, H: 1.1 * k, id: ID.TAIL, tex: (p, o) => { const [t] = tc.project(p.x, p.y); o.m = t > 0.78 ? M.patch : M.fur; } });
  // a dark-gloved forepaw and its claws under the chin
  {
    const e: V2 = [6.6 * k, -1.4 * k];
    BR.region(spline([[e[0] - 2.4 * k, e[1] - 0.9 * k, 0], [e[0] + 0.8 * k, e[1] - 1 * k, 0], [e[0] + 1.3 * k, e[1] + 0.5 * k, 0.3], [e[0] - 2.4 * k, e[1] + 0.9 * k, 0.3]], 0.4), { z: 10 * k, R: 0.8, H: 1, id: ID.HAND, tex: M.limb });
    for (let i = 2; i >= 0; i--) claw(BR, [e[0] + (0.7 - i * 0.2) * k, e[1] + (-0.5 + i * 0.45) * k], 0.5 + i * 0.12, [2.2, 2.8, 2][i] * k, 1.1 * k, 1, 11 * k, ID.CLAW, (u) => (u < 0.2 ? M.clawD : M.claw));
  }
  BR.shadow(ID.HEAD, 0.8, 1.2, 0.12, ID.BODY, 1);
  BR.shadow(ID.TAIL, 0.6, 1, 0.12, ID.BODY, 1);
  sk.np();
  BR.emit({ drop: 1.3 * k, seam: 0.55, seamDark: 0.3, ao: 0.06, aoR: 2 });
  const ec = H.p(3, -0.8);
  const e2 = drawEye(sk, ec[0], ec[1], { ...EYE, r: 1 }, eye);
  return { head: [0, -14 * k] as V2, eye: e2 };
}

export const DELVER: SpeciesDef = {
  name: 'Tunnel Delver', kind: 'mammal', len: 26, height: 10,
  anims: ANIMS,
  canvas: () => ({ w: 52, h: 42, ox: 24, oy: 34 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' || anim === 'peek' ? 'alert' : 'open'),
};

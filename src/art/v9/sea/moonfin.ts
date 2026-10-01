// Moonfin Porpoise: a small, stocky porpoise of cold seas. On its back it carries a round, pale
// "moon" fin, a disc of skin over a mesh of blood vessels that dumps heat after a sprint and flags
// the pod's position; along each flank run two lines of glowing photophores (symbiotic
// bacteria) that let the pod keep formation and herd lanternfish in the dark. Blunt melon, a short
// smiling beak, a dark eye mask, a dusky slate back, a pale grey flank and a white belly.
//
// All anims face right and anchor on the body centre. 'leap' runs from nose-up (frame 0) through
// level to nose-down (last frame); the game picks the frame from the arc of the jump.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, AnimDef, TAU, hh, cbez, along } from '../../beasts-core';
import { hex } from '../../color';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const MOONFIN_LEAP = 7;
const ANIMS: Record<string, AnimDef> = {
  idle: A(2, 2),
  swim: A(6, 8),
  leap: A(MOONFIN_LEAP, 1),
  bowride: A(4, 4),
  breach: A(6, 8, false),
  tailslap: A(4, 8, false),
};
export const moonfinLeapPitch = (f: number) => 0.95 - (f / (MOONFIN_LEAP - 1)) * 1.9;
/** the photophore glow colours (seafauna draws them again as an emissive overlay) */
export const MOONFIN_GLOW = rmp('#86f6e4', { n: 4, dark: 0.25, light: 0.6, at: 2 });

const EYE: EyeSpec = { r: 0.7, iris: hex('#0e1218'), lash: hex('#0e1218'), ring: hex('#9fb4c2') };

function mats(sk: Sk) {
  return {
    back: sk.m(rmp('#26303f', { n: 6, dark: 0.55, light: 0.3 }), { edge: 1, spec: 0.3 }),
    flank: sk.m(rmp('#4c5d70', { n: 6, dark: 0.5, light: 0.4 }), { edge: 1, spec: 0.3 }),
    belly: sk.m(rmp('#e6ecef', { n: 5, dark: 0.35, at: 3 }), { edge: 1, bias: 0.1 }),
    mask: sk.m(rmp('#1c2430', { n: 5, dark: 0.5 }), { edge: 0 }),
    glow: sk.m(MOONFIN_GLOW, { edge: 0, noRim: true, bias: 0.3 }),
    moon: sk.m(rmp('#dcdcd2', { n: 5, dark: 0.35, light: 0.5 }), { edge: 1 }),
    crater: sk.m(rmp('#a8aaa6', { n: 4, dark: 0.35 }), { edge: 0 }),
    rim: sk.m(rmp('#384456', { n: 4, dark: 0.45 }), { edge: 0 }),
    flip: sk.m(rmp('#2a3444', { n: 5, dark: 0.5 }), { edge: 1 }),
    mouth: sk.m(rmp('#1c222c', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
    hole: sk.m(rmp('#10141a', { n: 3, dark: 0.3 }), { edge: 0, noRim: true }),
  };
}
type M = ReturnType<typeof mats>;

interface Pose {
  pitch: number;   // + nose up
  bend: number;    // spine curvature (+ arched up in the middle)
  tail: number;    // tail stock beat (+ up)
  roll: number;    // 0 upright .. PI belly up
  flip: number;    // flipper angle (+ spread)
  open: number;
}

function pose(anim: string, f: number, n: number): Pose {
  const t = f / n;
  const p: Pose = { pitch: 0, bend: 0, tail: 0, roll: 0, flip: 0.2, open: 0 };
  switch (anim) {
    case 'idle':
      p.tail = f ? 0.15 : -0.1; p.bend = 0.05;
      break;
    case 'swim':
      p.tail = Math.sin(t * TAU) * 0.45;
      p.bend = Math.sin(t * TAU - 1.2) * 0.12;
      p.pitch = Math.sin(t * TAU + 0.6) * 0.04;
      break;
    case 'leap':
      p.pitch = moonfinLeapPitch(f);
      p.bend = 0.18;
      p.tail = -p.pitch * 0.35;
      p.flip = 0.05;
      break;
    case 'bowride':
      // surfing the pressure wave: flukes still, body leaning to show the glowing flank lines
      p.pitch = -0.08 + Math.sin(t * TAU) * 0.03;
      p.roll = 0.35 + Math.sin(t * TAU) * 0.1;
      p.tail = Math.sin(t * TAU) * 0.08;
      p.flip = 0.5;
      break;
    case 'breach': {
      // a spinning leap: up out of the water, rolling belly-up at the top, over and back in
      p.pitch = [1.25, 1.05, 0.55, -0.1, -0.7, -1.2][f];
      p.roll = t * TAU * 0.9;
      p.bend = [0.1, 0.2, 0.3, 0.3, 0.2, 0.1][f];
      p.tail = [-0.5, -0.2, 0.1, 0.3, 0.4, 0.2][f];
      p.flip = 0.6;
      break;
    }
    case 'tailslap':
      // head down, tail thrown up and slapped flat on the water
      p.pitch = -0.35;
      p.bend = -0.25;
      p.tail = [0.3, 1.1, 1.3, -0.4][f];
      p.flip = 0.7;
      break;
  }
  return p;
}

const L = 40;
function drawMoonfin(sk: Sk, M: M, P: Pose, eye: BeastEye): { head: V2; eye: V2 } {
  const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
  // body frame: x forward, y DOWN (screen), centred on the anchor
  const B = (x: number, y: number): V2 => [x * cp + y * sp, -x * sp + y * cp];
  // spine from the beak tip back to the tail stock, arched by bend, the tail stock beating
  const tailY = -P.tail * 6;
  const spine = cbez(B(19, 0.6), B(8, -1.2 - P.bend * 6), B(-9, -0.8 - P.bend * 4), B(-17, 1 + tailY * 0.7), 14);
  const rad = (t: number) => {
    // short beak, bulging melon, deep chest, a stocky tapering tail stock
    if (t < 0.05) return 1.3 + t * 22;
    if (t < 0.16) return 2.4 + (t - 0.05) * 30;
    if (t < 0.5) return 5.7 + Math.sin((t - 0.16) / 0.34 * Math.PI * 0.5) * 0.6;
    return Math.max(1.1, 6.3 - (t - 0.5) * 9.6);
  };
  const cr = Math.cos(P.roll), sr = Math.sin(P.roll);
  // countershading pattern that follows the roll: which way does a surface pixel face in the body?
  const side = (v: number) => {
    // the spine runs beak -> tail (right to left), so the tube's v is +1 along the top edge
    const y = v, z = Math.sqrt(Math.max(0, 1 - v * v));
    return y * cr + z * sr; // + dorsal, - ventral
  };
  const bodyFill = (p: Px) => {
    const d = side(p.v);
    const t = p.t;
    // photophore lines: two glowing stripes along the dark flank, converging toward the tail
    if (t > 0.19 && t < 0.84) {
      const k = (t - 0.19) / 0.65;
      if (Math.abs(d - (0.3 - k * 0.2)) < 0.085) return M.glow;
      if (t > 0.28 && t < 0.74 && Math.abs(d - (-0.02 - k * 0.1)) < 0.07) return M.glow;
    }
    // white belly patch from the chin to the vent
    if (d < -0.36 && t > 0.04 && t < 0.72) return M.belly;
    if (t < 0.2 && d > -0.2 && d < 0.5) return M.mask;
    if (d > 0.08) { p.l += hh(p.x, p.y, 3) * 0.04; return M.back; }
    return M.flank;
  };
  // far flipper
  const flipper = (near: boolean) => {
    sk.np();
    const root = along(spine, 0.26).p;
    const a = P.pitch - 2.1 + P.flip * 0.6;
    const len = 5.6;
    const tip: V2 = [root[0] + Math.cos(-a) * len * (near ? 1 : 0.8), root[1] + Math.sin(-a) * len * (near ? 1 : 0.8) + 2.8];
    sk.blade(root[0], root[1] + 2.2, tip[0], tip[1], s => Math.sin(Math.min(1, s * 1.3) * Math.PI) * 1.5 + 0.35, M.flip, { z0: near ? 5 : -5, z1: near ? 5.5 : -5.5, bias: near ? 0 : -0.15 });
  };
  flipper(false);
  // flukes: a crescent seen a little from above
  sk.np();
  const stock = spine[spine.length - 1];
  const ta = Math.atan2(spine[spine.length - 1][1] - spine[spine.length - 3][1], spine[spine.length - 1][0] - spine[spine.length - 3][0]);
  const fl = 10;
  for (const s of [-1, 1]) {
    const ang = ta + s * 1.05;
    const tip: V2 = [stock[0] + Math.cos(ang) * fl * 0.62, stock[1] + Math.sin(ang) * fl * (0.36 + Math.abs(Math.cos(P.roll)) * 0.3)];
    sk.blade(stock[0], stock[1], tip[0], tip[1], u => (Math.sin(Math.min(1, u * 1.1) * Math.PI) * 2.2 + 0.45) * (1 - u * 0.25), () => (s > 0 ? M.back : M.flank), { z0: s > 0 ? -1 : 1, z1: s > 0 ? -2 : 2, bend: s * 1.5 });
  }
  // body
  sk.np();
  sk.tube(spine, rad, bodyFill, { z: 0 });
  const bp = sk.pid;
  sk.streaks(bp, () => [-1, 0] as V2, { spacing: 4, len: 3, amp: 0.05 });
  // the moon fin: a pale disc on a short stalk, foreshortened as the body rolls
  // blunt melon over the short beak
  const mel = along(spine, 0.1).p;
  if (cr > -0.3) {
    sk.ell(mel[0] - Math.sin(P.pitch) * 1.2 * cr, mel[1] - Math.cos(P.pitch) * 1.2 * cr, 3.4, 2.8, (p) => {
      const d = side(Math.max(-1, Math.min(1, -p.v)));
      return d > 0.12 ? M.back : d < -0.4 ? M.belly : M.mask;
    }, { rot: -P.pitch, z: 1.5, rz: 2.6 });
  }
  const finBase = along(spine, 0.44).p;
  // dorsal direction on screen: the body's forward axis turned a quarter turn up
  const up: V2 = [-Math.sin(P.pitch), -Math.cos(P.pitch)];
  const ud = cr; // how much the dorsal direction points up on screen
  if (Math.abs(ud) > 0.08) {
    sk.np();
    const stalkTop: V2 = [finBase[0] + up[0] * 5.2 * ud, finBase[1] + up[1] * 5.2 * ud];
    sk.tube([[finBase[0], finBase[1] + up[1] * 3 * ud], stalkTop], 1.25, M.back, { z: sr > 0 ? -1.5 : 1 });
    const c: V2 = [stalkTop[0] + up[0] * 3 * ud, stalkTop[1] + up[1] * 3 * ud];
    const rx = 3.7, ry = 3.7 * Math.max(0.35, Math.abs(ud));
    sk.ell(c[0], c[1], rx, ry, (p) => {
      const r = Math.hypot(p.u, p.v);
      if (r > 0.82) return M.rim;
      // craters ("maria"): a few darker blotches
      if (hh(Math.floor(p.u * 3 + 5), Math.floor(p.v * 3 + 5), 7) > 0.72 && r < 0.7) return M.crater;
      if (Math.hypot(p.u + 0.25, p.v - 0.2) < 0.22) return M.crater;
      return M.moon;
    }, { rot: -P.pitch, rz: 1.2, z: sr > 0 ? -1 : 1.5 });
  }
  // head details: mouth line, blowhole, eye
  const beak = along(spine, 0.02).p, mouthEnd = along(spine, 0.13).p;
  sk.line(beak[0] - 0.4, beak[1] + 1.1, mouthEnd[0], mouthEnd[1] + 1.8, M.mouth, 0.3, 6, true);
  const bh = along(spine, 0.2).p;
  if (cr > 0.4) sk.dot(bh[0], bh[1] - rad(0.2) + 0.6, M.hole, 0.2, 7, true);
  const eyeP = along(spine, 0.14).p;
  const ep = side(0.05) > -0.9 ? drawEye(sk, eyeP[0] - 0.4, eyeP[1] - 0.4, EYE, eye) : eyeP;
  flipper(true);
  return { head: [eyeP[0], eyeP[1] - 8], eye: ep };
}

export const MOONFIN: SpeciesDef = {
  name: 'Moonfin Porpoise', kind: 'mammal', len: L, height: 12,
  anims: ANIMS,
  canvas: () => ({ w: 64, h: 60, ox: 32, oy: 30 }),
  draw(sk, anim, frame, eye) {
    const n = ANIMS[anim]?.frames ?? 1;
    return drawMoonfin(sk, mats(sk), pose(anim, frame, n), eye);
  },
  eyeFor: () => 'open',
  anchor: Object.fromEntries(Object.keys(ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
};

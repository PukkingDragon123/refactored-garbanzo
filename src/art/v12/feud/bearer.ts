// V12 The Bearer (Ungulursus falcifer), Matikuku Nui, "the great claw": the backcountry's serpent-eater.
// A mammal the size of a small truck, a bear crossed with a ground sloth: a towering shoulder hump, a
// deep chest, a long sloping back down to broad, heavy hips and a stub of a tail. Its RIGHT foreleg
// ends in one enormous hooked claw, about as long as Mori is tall; it carries it folded back along the
// forearm like a pocket-knife blade and knuckle-walks on the fist, as a giant anteater does. The coat
// is long, shaggy and dark brown with frosted (grizzled) tips, hanging in locks from the belly, the
// elbows and the jowls. Over its small, deep-set eyes runs a bare ridge of bone; its muzzle is crossed
// with old scars and its shoulder carries the healed punctures of a big boa's bite. It kills boas by
// pinning the head and hooking the claw in behind the skull.
//
// Painted with the beast sketch core (beasts-core.ts) as a posed 2D rig with depth, like the Cerebral
// Tiger (src/art/v11/tiger.ts): a pose struct, an anim table, poseAt(anim, f), drawBearer(sk, pose),
// and frames cropped to one shared box per anim strip (bearerFrame). The near foreleg (the claw arm)
// either walks on its fist or is posed by angle (rearing, the swipe, the pin, the smash).
//
// Everything faces RIGHT; the anchor is the ground under the body.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, ik2, cbez, fr } from '../../beasts-core';
import { Frame2, leg, LegSpec, scaleLeg } from '../../beasts-rig';
import { hex } from '../../color';
import { PixelBuffer } from '../../pixel';

// ------------------------------------------------------------------ pose
export interface BearerPose {
  /** body offset (px at k=1, + down) */
  bx: number; by: number;
  /** body pitch (rad, + = front down) */
  tilt: number;
  /** 0..1 reared up on the hind legs (the body pivots about the hips) */
  rear: number;
  /** breath 0..1, belly jiggle px, crouch 0..1, shoulder-hump roll -1..1 */
  br: number; jig: number; low: number; hump: number;
  /** foot offsets from rest: near fore (the fist), far fore, near hind, far hind */
  feet: [V2, V2, V2, V2];
  /** the claw arm (near fore): < -8 walks on its fist; else the wrist's angle from the shoulder (rad: 0 down, + forward, PI up) */
  arm: number;
  /** how straight the claw arm is held 0..1 */
  armR: number;
  /** the great claw: 1 folded back along the forearm .. 0 straight out of the fist */
  fold: number;
  /** extra rotation of the open claw (+ hooks it further back toward the palm) */
  hook: number;
  /** the far foreleg off the ground (rearing): < -8 on the ground, else like arm */
  farArm: number;
  /** neck angle offset (+ = head lower), head angle offset (+ = nose down) */
  neck: number; head: number;
  /** jaw gape 0..1, lips curled 0..1, ears -1 pinned .. 1 pricked, tongue out 0..1 */
  jaw: number; snarl: number; ear: number; tongue: number;
  /** stub tail lift */
  tail: number;
  /** 0..1 lying down */
  lie: number;
  /** a whole-body shake 0..1 (fur flying) */
  shake: number;
  /** nostrils working (sniff) 0..1 */
  sniff: number;
  t: number;
  eye?: BeastEye;
}

export function bearerRest(): BearerPose {
  return {
    bx: 0, by: 0, tilt: 0, rear: 0, br: 0.5, jig: 0, low: 0, hump: 0,
    feet: [[0, 0], [0, 0], [0, 0], [0, 0]], arm: -9, armR: 0.9, fold: 1, hook: 0, farArm: -9,
    neck: 0, head: 0, jaw: 0, snarl: 0, ear: 0.5, tongue: 0, tail: 0, lie: 0, shake: 0, sniff: 0, t: 0,
  };
}

export const BEARER_ANIMS: Record<string, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: 8, fps: 5, loop: true },
  walk: { frames: 10, fps: 8, loop: true },
  sniff: { frames: 6, fps: 6, loop: true },
  dig: { frames: 6, fps: 9, loop: true },
  eat: { frames: 6, fps: 6, loop: true },
  threat: { frames: 6, fps: 6, loop: false },
  windup: { frames: 3, fps: 6, loop: false },
  swipe: { frames: 6, fps: 12, loop: false },
  pin: { frames: 4, fps: 5, loop: true },
  charge: { frames: 8, fps: 12, loop: true },
  roar: { frames: 6, fps: 6, loop: false },
  flinch: { frames: 4, fps: 12, loop: false },
  stunned: { frames: 6, fps: 5, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  retreat: { frames: 8, fps: 8, loop: true },
  smash: { frames: 8, fps: 9, loop: false },
  drag: { frames: 8, fps: 6, loop: true },
};

/** frame index (in each one-shot anim) where the blow lands */
export const BEARER_HIT: Record<string, number> = { swipe: 2, smash: 5 };

export function bearerPoseAt(anim: string, f: number): BearerPose {
  const P = bearerRest();
  const info = BEARER_ANIMS[anim] ?? BEARER_ANIMS.idle;
  const n = info.frames;
  const t = info.loop ? f / n : n > 1 ? f / (n - 1) : 0;
  const S = <T,>(a: T[]): T => a[Math.min(a.length - 1, f)];
  P.t = t;
  switch (anim) {
    case 'idle':
      P.br = 0.5 - 0.5 * Math.cos(t * TAU);
      P.jig = Math.sin(t * TAU - 1) * 0.7;
      P.head = 0.05 + Math.sin(t * TAU) * 0.04;
      P.neck = 0.05 + Math.sin(t * TAU + 0.5) * 0.03;
      P.ear = f === 5 ? 0 : 0.6;
      P.tail = Math.sin(t * TAU) * 0.1;
      P.hump = Math.sin(t * TAU) * 0.3;
      break;
    case 'walk': case 'drag': {
      // the heavy knuckle-walk: the fist plants, the hump rolls over it, the belly swings
      const drag = anim === 'drag';
      const st = drag ? 18 : 26, lift = drag ? 3 : 5, duty = 0.64;
      P.feet[2] = gait(t, duty, st, lift);
      P.feet[0] = gait(t + 0.25, duty, st, lift * 1.15);
      P.feet[3] = gait(t + 0.5, duty, st, lift);
      P.feet[1] = gait(t + 0.75, duty, st, lift);
      P.by = Math.cos(t * TAU * 2) * 1.1;
      P.jig = Math.cos(t * TAU * 2 - 1.3) * 1.6;
      P.hump = Math.sin(t * TAU + 0.6) * 1.2;
      P.tilt = Math.sin(t * TAU) * 0.014 + (drag ? 0.06 : 0);
      P.neck = drag ? 0.55 : 0.16; P.head = drag ? 0.22 : 0.06 + Math.sin(t * TAU * 2 + 0.6) * 0.04;
      P.jaw = drag ? 0.32 : 0; P.ear = 0.4; P.tail = -0.1;
      if (drag) { P.bx = -3; P.low = 0.25; }
      break;
    }
    case 'sniff':
      // nose low and working, swinging from side to side
      P.neck = 0.42 + Math.sin(t * TAU) * 0.08; P.head = -0.12 + Math.sin(t * TAU * 2) * 0.05;
      P.sniff = 0.5 + 0.5 * Math.sin(t * TAU * 3);
      P.low = 0.12; P.ear = 0.9; P.br = 0.5 + 0.5 * Math.sin(t * TAU * 3);
      P.feet[0] = [3, 0];
      P.tail = 0.05;
      break;
    case 'dig': {
      // raking the earth with the great claw, then the far paw; head down to look
      const k = Math.sin(t * TAU);
      P.arm = 0.8 + k * 0.4; P.armR = 0.9; P.fold = 0.1; P.hook = 0.7 - k * 0.3;
      P.low = 0.3; P.tilt = 0.08; P.bx = -4;
      P.neck = 0.5; P.head = 0.18; P.ear = 0.3;
      P.feet[1] = [4 + Math.max(0, -k) * 4, -Math.max(0, -k) * 4];
      P.jig = k * 0.8;
      break;
    }
    case 'eat':
      // the claw holds the carcass down; the head tears at it
      P.arm = 1.05; P.armR = 0.92; P.fold = 0; P.hook = 0.35;
      P.low = 0.25; P.tilt = 0.1;
      P.neck = 0.7 + S([0, 0.1, 0.05, 0.12, 0, 0.08]); P.head = 0.25 + S([0, 0.12, -0.05, 0.15, 0.02, 0.1]);
      P.jaw = S([0.1, 0.6, 0.25, 0.7, 0.15, 0.5]); P.snarl = 0.4; P.ear = 0.2;
      P.feet[1] = [6, 0];
      break;
    case 'threat':
      // up on the hind legs, both forelegs out, the great claw spread high: a roar to shake the trees
      P.rear = S([0.15, 0.55, 0.88, 1, 1, 1]);
      P.arm = S([0.3, 1.5, 2.5, 2.95, 3.02, 2.96]); P.armR = 1;
      P.fold = S([0.9, 0.5, 0.12, 0, 0, 0]); P.hook = S([0, 0, -0.1, -0.3, -0.35, -0.3]);
      P.farArm = S([-9, 0.9, 1.5, 1.75, 1.8, 1.72]);
      P.neck = S([0.1, 0.5, 0.95, 1.15, 1.2, 1.15]); P.head = S([0, -0.1, -0.2, -0.28, -0.3, -0.26]);
      P.jaw = S([0.1, 0.4, 0.8, 1, 1, 0.9]); P.snarl = S([0.3, 0.7, 1, 1, 1, 1]); P.ear = S([0, -0.5, -0.9, -1, -1, -1]);
      P.br = 1; P.tail = 0.3;
      P.feet[2] = S([[0, 0], [4, 0], [8, 0], [10, 0], [10, 0], [10, 0]] as V2[]);
      P.feet[3] = S([[0, 0], [2, 0], [5, 0], [7, 0], [7, 0], [7, 0]] as V2[]);
      P.t = f * 0.3;
      break;
    case 'windup':
      // the tell: weight back, the claw arm swings up and back over the shoulder, the claw opens
      P.bx = S([-2, -6, -8]); P.tilt = S([-0.03, -0.08, -0.1]); P.low = S([0.1, 0.2, 0.22]);
      P.arm = S([1.3, 2.4, 2.85]); P.armR = 0.95; P.fold = S([0.6, 0.15, 0]); P.hook = S([0, -0.25, -0.4]);
      P.neck = S([0.1, -0.05, -0.1]); P.head = S([0, -0.12, -0.16]); P.jaw = S([0.3, 0.6, 0.7]); P.snarl = S([0.5, 0.9, 1]);
      P.ear = S([-0.4, -0.9, -1]); P.feet[1] = S([[0, 0], [-3, 0], [-4, 0]] as V2[]);
      break;
    case 'swipe':
      // the blow: the claw scythes down and forward through a huge arc, then follows through
      P.bx = S([-8, -2, 6, 9, 5, 0]); P.tilt = S([-0.1, -0.02, 0.08, 0.1, 0.05, 0]);
      P.low = S([0.22, 0.15, 0.25, 0.3, 0.2, 0.05]);
      P.arm = S([2.85, 2.05, 1.3, 0.35, -0.3, -9]); P.armR = 0.98;
      P.fold = S([0, 0, 0, 0.05, 0.3, 1]); P.hook = S([-0.4, -0.25, -0.1, 0.45, 0.5, 0]);
      P.neck = S([-0.1, 0.05, 0.25, 0.3, 0.2, 0.08]); P.head = S([-0.16, 0, 0.14, 0.18, 0.1, 0.04]);
      P.jaw = S([0.7, 0.9, 0.8, 0.5, 0.3, 0.1]); P.snarl = S([1, 1, 0.9, 0.7, 0.4, 0.2]);
      P.ear = S([-1, -1, -0.9, -0.7, -0.3, 0.2]);
      P.feet[1] = S([[-4, 0], [0, 0], [5, 0], [7, 0], [4, 0], [0, 0]] as V2[]);
      P.feet[2] = S([[0, 0], [0, 0], [3, 0], [4, 0], [2, 0], [0, 0]] as V2[]);
      break;
    case 'pin':
      // the great claw driven down into the ground in front, pinning; head low, snarling, pressing
      P.arm = 1.15 + Math.sin(t * TAU) * 0.03; P.armR = 0.95; P.fold = 0; P.hook = 0.25 + Math.sin(t * TAU) * 0.06;
      P.tilt = 0.14; P.low = 0.35; P.bx = 2;
      P.neck = 0.62 + Math.sin(t * TAU) * 0.05; P.head = 0.05;
      P.jaw = 0.55 + Math.sin(t * TAU * 2) * 0.15; P.snarl = 1; P.ear = -0.8;
      P.feet[1] = [-6, 0]; P.feet[2] = [4, 0];
      P.br = 0.5 + 0.5 * Math.sin(t * TAU * 2);
      break;
    case 'charge': {
      // a bear's rolling gallop, the fist hammering down, the claw clamped to the forearm
      const st = 46, lift = 11, duty = 0.4;
      P.feet[2] = gait(t, duty, st, lift);
      P.feet[3] = gait(t + 0.1, duty, st, lift);
      P.feet[1] = gait(t + 0.5, duty, st, lift);
      P.feet[0] = gait(t + 0.6, duty, st, lift);
      const c = Math.cos(t * TAU);
      P.by = -Math.max(0, Math.sin(t * TAU + 0.6)) * 5 + 1.5;
      P.tilt = Math.sin(t * TAU) * 0.07;
      P.jig = Math.cos(t * TAU - 1.6) * 3;
      P.hump = -c * 1.6;
      P.neck = 0.22; P.head = 0.04 - Math.sin(t * TAU) * 0.06;
      P.jaw = 0.35 + Math.sin(t * TAU) * 0.1; P.snarl = 0.7; P.ear = -0.9; P.tail = 0.2;
      break;
    }
    case 'roar':
      P.br = S([1, 1, 1, 0.9, 0.7, 0.4]);
      P.neck = S([0.05, -0.45, -0.6, -0.58, -0.5, -0.15]);
      P.head = S([0.1, -0.3, -0.45, -0.42, -0.35, -0.05]);
      P.jaw = S([0.15, 0.85, 1, 1, 0.9, 0.3]); P.snarl = S([0.3, 0.9, 1, 1, 0.9, 0.3]);
      P.ear = S([0, -0.8, -1, -1, -0.9, -0.2]);
      P.tilt = S([0.02, -0.06, -0.09, -0.08, -0.06, -0.02]);
      P.bx = S([-2, 0, 1, 2, 1, 0]);
      P.feet[1] = S([[0, 0], [3, 0], [4, 0], [4, 0], [4, 0], [2, 0]] as V2[]);
      P.tail = S([0, 0.3, 0.4, 0.4, 0.3, 0.1]);
      P.t = f * 0.31;
      break;
    case 'flinch':
      P.neck = S([-0.45, -0.3, -0.12, 0]); P.head = S([-0.4, -0.22, 0, 0.08]);
      P.bx = S([-7, -9, -6, -3]); P.tilt = S([-0.1, -0.07, -0.03, 0]);
      P.ear = S([-1, -1, -0.6, -0.2]); P.jaw = S([0.5, 0.35, 0.2, 0.1]); P.snarl = S([0.8, 0.6, 0.4, 0.3]);
      P.feet[1] = S([[-4, -8], [-3, -3], [-1, 0], [0, 0]] as V2[]);
      P.low = S([0.2, 0.3, 0.2, 0.1]);
      P.shake = S([1, 0.6, 0.2, 0]);
      break;
    case 'stunned':
      P.head = 0.3 + Math.sin(t * TAU) * 0.22; P.neck = 0.4 + Math.cos(t * TAU) * 0.1;
      P.jaw = 0.25; P.tongue = 0.9; P.ear = -0.5 + Math.sin(t * TAU * 2) * 0.12;
      P.by = Math.sin(t * TAU) * 0.8; P.tilt = Math.sin(t * TAU) * 0.04;
      P.low = 0.3; P.bx = Math.sin(t * TAU) * 2;
      P.feet[0] = [Math.sin(t * TAU) * 2.5, 0]; P.feet[1] = [-Math.sin(t * TAU) * 2.5, 0];
      P.tail = -0.2;
      break;
    case 'sleep':
      // flat on its belly, chin on the fist, the great claw folded along the ground in front
      P.lie = 1; P.low = 1; P.br = f; P.neck = 0.62; P.head = 0.2; P.ear = -0.2; P.tail = -0.2;
      P.fold = 1;
      break;
    case 'retreat': {
      const st = 16, lift = 3.2, duty = 0.66;
      P.feet[2] = gait(-t, duty, st, lift);
      P.feet[0] = gait(-t + 0.25, duty, st, lift);
      P.feet[3] = gait(-t + 0.5, duty, st, lift);
      P.feet[1] = gait(-t + 0.75, duty, st, lift);
      P.low = 0.3; P.by = Math.cos(t * TAU * 2) * 0.6;
      P.neck = 0.35; P.head = -0.04; P.snarl = 0.8; P.jaw = 0.3 + Math.sin(t * TAU * 2) * 0.06;
      P.ear = -0.9; P.tail = -0.3; P.hump = Math.sin(-t * TAU + 0.6);
      break;
    }
    case 'smash':
      // up on the hind legs, the claw raised over the head... and down, with the whole weight behind it
      P.rear = S([0.2, 0.6, 0.92, 1, 0.7, 0.18, 0.1, 0.05]);
      P.arm = S([0.8, 1.9, 2.8, 3.05, 1.9, 1.12, 1.02, 0.85]); P.armR = 0.98;
      P.fold = S([0.8, 0.3, 0, 0, 0, 0, 0.05, 0.4]); P.hook = S([0, -0.2, -0.45, -0.5, -0.1, 0.3, 0.38, 0.4]);
      P.farArm = S([-9, 0.8, 1.4, 1.5, 0.9, -9, -9, -9]);
      P.neck = S([0.1, 0.45, 0.8, 0.9, 0.6, 0.55, 0.45, 0.25]); P.head = S([0, -0.15, -0.3, -0.36, -0.1, 0.1, 0.08, 0.04]);
      P.jaw = S([0.2, 0.5, 0.9, 1, 1, 0.7, 0.4, 0.2]); P.snarl = S([0.4, 0.8, 1, 1, 1, 0.9, 0.6, 0.3]);
      P.ear = S([-0.2, -0.6, -1, -1, -1, -0.8, -0.5, -0.1]);
      P.tilt = S([0, 0, 0, 0, 0.06, 0.16, 0.14, 0.06]); P.low = S([0, 0, 0, 0, 0.1, 0.4, 0.35, 0.15]);
      P.bx = S([0, 2, 4, 4, 8, 12, 11, 6]);
      P.feet[2] = S([[0, 0], [4, 0], [8, 0], [9, 0], [9, 0], [6, 0], [5, 0], [2, 0]] as V2[]);
      P.feet[3] = S([[0, 0], [3, 0], [5, 0], [6, 0], [6, 0], [4, 0], [3, 0], [1, 0]] as V2[]);
      P.feet[1] = S([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [14, 0], [13, 0], [6, 0]] as V2[]);
      P.br = 1;
      break;
  }
  return P;
}

export function bearerEyeFor(anim: string, frame: number): BeastEye {
  switch (anim) {
    case 'sleep': case 'stunned': return 'closed';
    case 'flinch': return frame < 2 ? 'closed' : 'angry';
    case 'sniff': return 'alert';
    case 'threat': case 'windup': case 'swipe': case 'pin': case 'charge': case 'roar': case 'retreat': case 'smash': return 'angry';
    default: return 'open';
  }
}

// ------------------------------------------------------------------ materials
type M = ReturnType<typeof mats>;
function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#3b2619', { n: 7, dark: 0.6, cool: 0.32, light: 0.4, warm: 0.32, sat: 0.12 })),
    furD: sk.m(rmp('#2a1b13', { n: 6, dark: 0.58, light: 0.34 }), { edge: 1 }),
    furW: sk.m(rmp('#4c3221', { n: 7, dark: 0.6, light: 0.42, warm: 0.38 })),
    grizzle: sk.m(rmp('#8a7660', { n: 5, dark: 0.5, light: 0.36 }), { edge: 1 }),
    frost: sk.m(rmp('#b4a088', { n: 4, dark: 0.42, light: 0.3, at: 2 }), { edge: 0 }),
    muzzle: sk.m(rmp('#684a33', { n: 6, dark: 0.55, light: 0.38 })),
    skin: sk.m(rmp('#2a2020', { n: 5, dark: 0.5, light: 0.4 })),
    socket: sk.m(rmp('#1a1310', { n: 4, dark: 0.4, light: 0.25 }), { edge: 0, noRim: true }),
    bone: sk.m(rmp('#a6957a', { n: 6, dark: 0.52, light: 0.42, at: 3 })),
    scar: sk.m(rmp('#9e7c6a', { n: 4, dark: 0.4, light: 0.3, at: 2 }), { edge: 0, noRim: true }),
    mouth: sk.m(rmp('#5e2228', { n: 4, dark: 0.5 }), { edge: 0 }),
    gum: sk.m(rmp('#9a4650', { n: 4, dark: 0.5 })),
    tongue: sk.m(rmp('#b8606a', { n: 5, dark: 0.5, light: 0.35 })),
    tooth: sk.m(rmp('#ece0c4', { n: 4, dark: 0.35, at: 2 })),
    claw: sk.m(rmp('#3a2c23', { n: 7, dark: 0.62, light: 0.36, at: 3, cool: 0.2 })),
    horn: sk.m(rmp('#6e5e4c', { n: 6, dark: 0.55, light: 0.42, at: 3, cool: 0.15 })),
    clawPale: sk.m(rmp('#d2c4a4', { n: 5, dark: 0.42, light: 0.42, at: 2 }), { edge: 0 }),
    clawBase: sk.m(rmp('#1e1713', { n: 4, dark: 0.4, light: 0.3 }), { edge: 0 }),
    nail: sk.m(rmp('#5a4c40', { n: 4, dark: 0.5, light: 0.42, at: 2 })),
    earIn: sk.m(rmp('#563a2e', { n: 4, dark: 0.5 })),
  };
}

const EYE: EyeSpec = { r: 1, iris: hex('#e0a030'), pupil: hex('#120c08'), lash: hex('#140e0a'), brow: hex('#1a120c') };

// ------------------------------------------------------------------ the painter
export interface BearerOut {
  head: V2; eye: V2; mouth: V2; nose: V2;
  /** the great claw: base (knuckle) and tip */
  clawBase: V2; clawTip: V2;
  /** the fist (near fore) and the far forepaw */
  fist: V2; paw: V2;
  tail: V2;
}

/**
 * A lock of shaggy fur: a tapered clump that bows a little, its shadow side darker, the tip frosted
 * (frost = chance) or darker.
 */
function lock(sk: Sk, m: M, x: number, y: number, ang: number, len: number, wid: number, z: number, seed: number, bias = 0, frost = 0.2) {
  if (len < 1.5) return;
  const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
  const bend = (hh(seed, 3, 81) - 0.5) * len * 0.3;
  const tipF = hh(seed, 5, 81) < frost;
  const split = hh(seed, 7, 81) < 0.35;
  const pid = sk.pid;
  sk.np(true);
  sk.blade(x, y, tx, ty, s => wid * Math.pow(1 - s, 0.7) * (0.82 + 0.18 * Math.sin(s * Math.PI)) + 0.4, p => {
    // a split near the end: two strands
    if (split && p.t > 0.62 && Math.abs(p.v) < 0.22) return 0;
    if (p.t > 0.72 && tipF) return p.t > 0.86 ? m.frost : m.grizzle;
    if (p.v > 0.35) return m.furD;
    return m.fur;
  }, { z0: z, z1: z + 0.4, bend, bias, curl: 0.55 });
  sk.pid = pid;
}

export function drawBearer(sk: Sk, P: BearerPose, k = 1): BearerOut {
  const m = mats(sk);
  sk.clipY = 0;
  const lie = P.lie;
  // ---- body frame: standing, then rotated up about the hips when it rears
  const drop = P.low * 9 + lie * 30;
  const B0 = new Frame2([P.bx * k, (-56 + P.by + drop) * k], P.tilt, k);
  const HIP: V2 = [-52, 6];
  let B = B0;
  if (P.rear > 0.001) {
    const pv = B0.p(HIP[0], HIP[1]);
    const ra = P.tilt - 1.12 * P.rear;
    const pw: V2 = [pv[0] + P.rear * 12 * k, pv[1] - P.rear * 8 * k];
    const c = Math.cos(ra), s = Math.sin(ra);
    const hx = HIP[0] * k, hy = HIP[1] * k;
    B = new Frame2([pw[0] - (hx * c - hy * s), pw[1] - (hx * s + hy * c)], ra, k);
  }
  const inv = (x: number, y: number): V2 => {
    const dx = (x - B.o[0]) / k, dy = (y - B.o[1]) / k;
    const c = Math.cos(-B.a), s = Math.sin(-B.a);
    return [dx * c - dy * s, dx * s + dy * c];
  };
  const shake = P.shake;
  const wob = (i: number) => (shake ? Math.sin(P.t * TAU * 3 - i) * 1.4 * shake : 0);
  const breathe = P.br;

  // ---- torso profile (local): rump, hips, the waist, the great hump, the neck base
  const spineL: V2[] = [[-80, 6 + wob(4)], [-56, -5 + wob(3)], [-22, -5 + wob(2)], [14, -25 + wob(1) - P.hump * 0.8], [44, -17 + wob(0)]];
  const prof = [18, 26, 24 + breathe * 0.6, 31 + breathe * 0.8, 25];
  const radAt = (t: number) => {
    const u = t * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(u)), f = u - i;
    const e = f * f * (3 - 2 * f);
    return (prof[i] + (prof[i + 1] - prof[i]) * e) * k;
  };
  // top / bottom of the torso along body-local x (-110 .. 80): where the fur goes
  const X0 = -110, NX = 191;
  const TOP = new Float32Array(NX).fill(1e9), BOT = new Float32Array(NX).fill(-1e9);
  const putEll = (cx: number, cy: number, rx: number, ry: number) => {
    for (let lx = Math.floor(cx - rx); lx <= Math.ceil(cx + rx); lx++) {
      const ix = lx - X0, u = (lx - cx) / rx;
      if (ix < 0 || ix >= NX || Math.abs(u) >= 1) continue;
      const h = ry * Math.sqrt(1 - u * u);
      TOP[ix] = Math.min(TOP[ix], cy - h);
      BOT[ix] = Math.max(BOT[ix], cy + h);
    }
  };
  {
    const segL: number[] = [0];
    for (let i = 1; i < spineL.length; i++) segL.push(segL[i - 1] + Math.hypot(spineL[i][0] - spineL[i - 1][0], spineL[i][1] - spineL[i - 1][1]));
    const total = segL[segL.length - 1];
    for (let s = 0; s <= 80; s++) {
      const dd = (s / 80) * total;
      let j = 1;
      while (j < spineL.length - 1 && segL[j] < dd) j++;
      const f = (dd - segL[j - 1]) / Math.max(1e-6, segL[j] - segL[j - 1]);
      const r = radAt(s / 80) / k;
      putEll(spineL[j - 1][0] + (spineL[j][0] - spineL[j - 1][0]) * f, spineL[j - 1][1] + (spineL[j][1] - spineL[j - 1][1]) * f, r, r);
    }
  }
  const bellyC: V2 = [-14, 10 + P.jig * 0.5], bellyR: V2 = [46, 19 + breathe * 0.8 + P.jig * 0.2];
  const chestC: V2 = [40, 4], chestR: V2 = [27, 28 + breathe];
  const humpC: V2 = [14, -22 - P.hump * 1.4], humpR: V2 = [31, 29];
  putEll(bellyC[0], bellyC[1], bellyR[0], bellyR[1]);
  putEll(chestC[0], chestC[1], chestR[0], chestR[1]);
  putEll(humpC[0], humpC[1], humpR[0], humpR[1]);
  putEll(-55, 0, 26, 26);
  const ixOf = (lx: number) => Math.max(0, Math.min(NX - 1, Math.round(lx) - X0));
  const depth = (lx: number, ly: number) => {
    const ix = ixOf(lx);
    const top = TOP[ix] < 1e8 ? TOP[ix] : -20, bot = BOT[ix] > -1e8 ? BOT[ix] : 20;
    return (ly - top) / Math.max(1, bot - top);
  };

  // ---- coat fill: dark and shaggy; a frosted mantle of grizzled hair over the hump
  /** short frosted hair-streaks lying with the coat (down and back off the hump), thinning out */
  const mantle = (lx: number, ly: number, d: number): number => {
    const dens = Math.max(0, 1 - d / 0.5) * Math.max(0, 1 - Math.abs(lx - 12) / 58) * 1.25;
    if (dens <= 0.02) return 0;
    const a = Math.PI - 0.5 + (lx > 20 ? 0.5 : 0);
    const u = lx * Math.cos(a) + ly * Math.sin(a), v = -lx * Math.sin(a) + ly * Math.cos(a);
    const row = Math.floor(v / 1.7);
    const uu = u + hh(row, 0, 91) * 9;
    const seg = Math.floor(uu / 8), f = uu / 8 - seg;
    const h = hh(row, seg, 93);
    if (h > dens * 0.6) return 0;
    if (f > 0.3 + hh(row, seg, 95) * 0.4) return 0;
    return h < dens * 0.14 ? 2 : 1;
  };
  const bodyFill = (p: Px) => {
    const [lx, ly] = inv(p.x, p.y);
    const d = depth(lx, ly);
    // the long coat lies in waves: broken bands of light and dark running back and down
    const wave = Math.sin(lx * 0.19 + ly * 0.33 + Math.sin(ly * 0.11) * 2.2) + Math.sin(lx * 0.07 - ly * 0.5) * 0.6;
    p.l += wave * 0.04;
    const g = mantle(lx, ly, d);
    if (g === 2) return m.frost;
    if (g === 1) return m.grizzle;
    if (d > 0.68) { p.l -= (d - 0.68) * 0.6; return m.furD; }
    return hh(Math.floor((lx + ly * 0.5) / 6), Math.floor(ly / 5), 29) < 0.22 ? m.furW : m.fur;
  };

  // ---- legs
  const lk = 1 - P.low * 0.35;
  const FL: LegSpec = scaleLeg({ l1: 25 * lk + 3, l2: 24, r1: 16, r2: 11.5, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 22 * lk + 3, l2: 19, l3: 11, r1: 16, r2: 10, r3: 7.6, bend: -1 }, k);
  const legFill = (dark: boolean) => (p: Px) => {
    // long fur on the upper leg, shorter and darker down the shin
    if (p.t > 0.55) return m.furD;
    if (p.v < -0.55 && hh(Math.floor(p.t * 14), 1, 39) < 0.4) p.l += 0.07;
    return dark ? m.furD : m.fur;
  };
  /** fur on a limb part: strands running down it, ragged edges */
  const furLeg = (part: number, down: number) => {
    sk.streaks(part, () => [Math.cos(down), Math.sin(down)], { spacing: 3, len: 3, amp: 0.11, seed: 15 + part, light: 0.06 });
    sk.tufts(part, (_x, _y, nx, ny) => (ny > 0 ? null : [nx * 0.8, 0.5]), { every: 3, seed: 16 + part, len: 1 });
  };
  const clawPaw = (f: V2, z: number, bias: number, hind: boolean, lifted: boolean, ang = 0) => {
    // a broad paw with five dark nails (the far forefoot and the hind feet)
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const Q = (x: number, y: number): V2 => [f[0] + (x * ca - y * sa) * k, f[1] + (x * sa + y * ca) * k];
    sk.np();
    const c = Q(hind ? 2.5 : 1.5, -3.4);
    sk.ell(c[0], c[1], (hind ? 11 : 9.5) * k, 4.4 * k, m.furD, { z: z + 2, bias, rot: ang });
    for (let i = 0; i < 5; i++) {
      const q = Q((hind ? 7 : 6) + i * 1.5, -3.6 + i * 0.6);
      sk.ell(q[0], Math.min(q[1], lifted ? q[1] : -1.3 * k), 2 * k, 1.8 * k, m.furD, { z: z + 3 + i * 0.1, bias });
      const a = ang + (lifted ? 0.5 : 0.75);
      const cl = (hind ? 4 : 5.6) * k;
      sk.blade(q[0] + 0.8 * k, q[1] + 0.6 * k, q[0] + 0.8 * k + Math.cos(a) * cl, Math.min(q[1] + 0.6 * k + Math.sin(a) * cl, lifted ? 999 : -0.3), s => (1 - s) * 0.9 * k + 0.25, m.nail, { z0: z + 4, z1: z + 4.3, bias, bend: 0.5 * k });
    }
  };

  // the far foreleg
  let farPaw: V2 = [0, 0];
  const drawFarFore = () => {
    sk.np();
    const sh = B.p(32, 8);
    let foot: V2 = [(34 + P.bx + P.feet[1][0]) * k, Math.min(0, P.feet[1][1]) * k];
    let lifted = P.feet[1][1] < -0.5, ang = 0;
    if (P.farArm > -8) {
      const len = (FL.l1 + FL.l2) * 0.9;
      foot = [sh[0] + Math.sin(P.farArm) * len, sh[1] + Math.cos(P.farArm) * len];
      lifted = true; ang = -P.farArm * 0.7;
    }
    if (lie > 0.01) { const tg = B.p(76, 24); foot = [foot[0] + (tg[0] - foot[0]) * lie, Math.min(0, foot[1] + (tg[1] - foot[1]) * lie)]; }
    const j = leg(sk, sh, foot, FL, legFill(true), -16, -Math.PI / 2 - 0.15, -0.16);
    sk.ell(j[1][0], j[1][1], 11 * k, 9.5 * k, legFill(true), { z: -15.5, bias: -0.16 });
    furLeg(sk.pid, Math.PI / 2 + 0.2);
    farPaw = j[3];
    clawPaw(j[3], -16, -0.16, false, lifted, ang);
  };
  const drawHind = (near: boolean) => {
    sk.np();
    const z = near ? 30 : -17, bias = near ? 0 : -0.16;
    const hip = B.p(HIP[0] + (near ? 0 : 4), HIP[1]);
    let foot: V2 = [(-46 + P.bx + (near ? 0 : 5) + P.feet[near ? 2 : 3][0]) * k, Math.min(0, P.feet[near ? 2 : 3][1]) * k];
    if (P.rear > 0.001) foot = [foot[0] + P.rear * 6 * k, foot[1]];
    if (lie > 0.01) { const tg = B.p(near ? -22 : -26, 24); foot = [foot[0] + (tg[0] - foot[0]) * lie, Math.min(0, foot[1] + (tg[1] - foot[1]) * lie)]; }
    const lifted = P.feet[near ? 2 : 3][1] < -0.5;
    const j = leg(sk, hip, foot, HL, legFill(!near), z, -Math.PI / 2 - 1.05 - P.rear * 0.3, bias);
    // the heavy thigh, blending up into the haunch
    sk.ell(hip[0] + 1 * k, hip[1] + 1 * k, 15 * k, 20 * k, legFill(!near), { z: z - 6, bias, rot: B.a + 0.35 });
    furLeg(sk.pid, B.a + Math.PI / 2 + 0.35);
    clawPaw(j[3], z, bias, true, lifted);
    if (near) {
      // long fur breeches hanging off the back of the thigh
      for (let i = 0; i < 7; i++) {
        const q = B.p(HIP[0] - 18 + i * 3.4, HIP[1] + 10 + i * 2.2);
        const wa = B.ang(Math.PI / 2 + 0.55 - i * 0.05);
        lock(sk, m, q[0], q[1], wa + (Math.PI / 2 + 0.3 - wa) * P.rear * 0.8, (8 + hh(i, 2, 41) * 7) * k, (2.8 + hh(i, 3, 41)) * k, z + 1 + i * 0.05, 400 + i, bias, 0.1);
      }
    }
  };

  drawHind(false);
  drawFarFore();

  // ---- the stub tail
  sk.np();
  const tb = B.p(-94, 2);
  const tA = B.ang(Math.PI + 0.55 - P.tail * 0.8);
  const tip: V2 = [tb[0] + Math.cos(tA) * 12 * k, tb[1] + Math.sin(tA) * 12 * k];
  sk.tube([tb, [(tb[0] + tip[0]) / 2, (tb[1] + tip[1]) / 2 + 1 * k], tip], t => (8 - t * 4.5) * k, m.fur, { z: -4 });
  sk.tufts(sk.pid, (_x, _y, nx, ny) => (ny >= 0 || nx < 0 ? [nx * 0.7 - 0.3, 0.9] : null), { every: 1, seed: 6, len: 2 });
  for (let i = 0; i < 3; i++) lock(sk, m, tip[0], tip[1], tA + 0.6 + i * 0.35, (5 + i * 2) * k, 2.2 * k, -3, 30 + i);

  // ---- torso masses
  sk.np();
  sk.tube(spineL.map(([x, y]) => B.p(x, y)), radAt, bodyFill, { z: 0, rz: 0.95 });
  const bodyPart = sk.pid;
  const haunch = B.p(-55, 0);
  sk.ell(haunch[0], haunch[1], 26 * k, 26 * k, bodyFill, { rot: B.a, rz: 22 * k, z: 2 });
  const belly = B.p(bellyC[0], bellyC[1]);
  sk.ell(belly[0], belly[1], bellyR[0] * k, bellyR[1] * k, bodyFill, { rot: B.a, rz: 16 * k });
  const chest = B.p(chestC[0], chestC[1]);
  sk.ell(chest[0], chest[1], chestR[0] * k, chestR[1] * k, bodyFill, { rot: B.a, rz: 20 * k, z: 3 });
  const hump = B.p(humpC[0], humpC[1]);
  sk.ell(hump[0], hump[1], humpR[0] * k, humpR[1] * k, bodyFill, { rot: B.a - 0.2, rz: 22 * k, z: 4 });
  // the coat's flow: streaks running down off the hump and back along the flank
  sk.streaks(bodyPart, (x, y) => {
    const [lx, ly] = inv(x, y);
    const a = lx > 0 ? Math.PI * 0.5 + 0.8 - (ly < -10 ? 0.45 : 0) : Math.PI + 0.3;
    const w = B.a + a;
    return [Math.cos(w), Math.sin(w)];
  }, { spacing: 3, len: 4, amp: 0.1, seed: 5, light: 0.05 });
  // the shoulder-blade and haunch muscles under the coat
  for (const [cx, cy, rx, ry, dl] of [[22, -8, 16, 20, 0.07], [-56, -6, 16, 14, 0.05]] as [number, number, number, number, number][]) {
    for (let i = 0; i < 26; i++) {
      const a = -1.2 + (i / 25) * 2.6;
      const q = B.p(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      sk.paint(q[0], q[1], 0, -dl, bodyPart);
    }
  }
  sk.tufts(bodyPart, (_x, _y, nx, ny) => (ny < 0 ? [-0.9 + nx * 0.2, -0.35] : ny > 0 ? [-0.3, 1] : [nx, 0.6]), { every: 3, seed: 8, len: 2 });

  // ---- the long locks: the shaggy skirt under the belly and chest, the mane lying back off the hump
  {
    let n = 0;
    // clumps of two to four locks that twist together to one point, uneven, overlapping
    for (let row = 0; row < 2; row++)
      for (let lx = -80 + row * 4; lx <= 60;) {
        const cw = 5 + hh(n, 0, 75) * 7, cn = 2 + Math.floor(hh(n, 2, 75) * 3);
        const cLen = ((row ? 4 : 6) + hh(n, 1, 77) * (row ? 7 : 11) + (lx > -44 && lx < 34 ? 3 : 0)) * (1 - lie * 0.65);
        const ca = Math.PI / 2 + 0.3 + (hh(n, 3, 77) - 0.5) * 0.5;
        const ixc = ixOf(lx + cw / 2);
        if (BOT[ixc] > -1e8) {
          const tipL: V2 = [lx + cw / 2 + Math.cos(ca) * cLen, BOT[ixc] - (row ? 8 : 4) + Math.sin(ca) * cLen];
          for (let i = 0; i < cn; i++) {
            const bx = lx + (i + 0.5) * (cw / cn);
            const by = BOT[ixOf(bx)] - (row ? 8 : 4) - hh(n, 10 + i, 77) * 2;
            const ang = Math.atan2(tipL[1] - by, tipL[0] - bx) + (hh(n, 20 + i, 77) - 0.5) * 0.25;
            const len = Math.hypot(tipL[0] - bx, tipL[1] - by) * (0.8 + hh(n, 30 + i, 77) * 0.3);
            const q = B.p(bx, by);
            const wa = B.ang(ang);
            lock(sk, m, q[0], q[1], wa + (Math.PI / 2 + 0.35 - wa) * P.rear * 0.75, len * k, (2.2 + hh(n, 40 + i, 77) * 1.4) * k, 6 + row * 0.6 + i * 0.1, 700 + n * 5 + i, -0.03, 0.06);
          }
        }
        lx += cw * (0.75 + hh(n, 4, 75) * 0.4);
        n++;
      }
    // the mane: heavy frosted locks lying back over the withers
    for (let i = 0; i < 11; i++) {
      const lx = -14 + i * 5.6;
      const h = hh(i, 9, 77);
      const q = B.p(lx, TOP[ixOf(lx)] + 6 + h * 2);
      lock(sk, m, q[0], q[1], B.ang(Math.PI - 0.28 + (h - 0.5) * 0.3 - (shake ? 0.7 : 0)), (11 + h * 7) * k, (3.2 + h * 1.2) * k, 9 + i * 0.1, 900 + i, 0.04, 0.75);
    }
    // the throat ruff
    for (let i = 0; i < 6; i++) {
      const lx = 48 + i * 3;
      const q = B.p(lx, BOT[ixOf(lx)] - 6 - i * 1.5);
      const wa = B.ang(Math.PI / 2 + 0.15 + i * 0.05);
      lock(sk, m, q[0], q[1], wa + (Math.PI / 2 + 0.1 - wa) * P.rear * 0.8, (8 + hh(i, 4, 79) * 6) * k, 2.8 * k, 7.5, 960 + i, 0, 0.1);
    }
  }
  // old boa bites across the shoulder: two curved rows of healed punctures, and a long rake scar
  {
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.34;
        const rr = row ? 10 : 15;
        const q = B.p(16 + Math.cos(a) * rr, -10 + Math.sin(a) * rr * 0.8);
        sk.paint(q[0], q[1], m.scar, 0.1, bodyPart);
        sk.paint(q[0] + 0.9 * k, q[1], m.scar, 0, bodyPart);
        sk.paint(q[0], q[1] + 1 * k, 0, -0.25, bodyPart);
      }
    for (let i = 0; i < 16; i++) {
      const q = B.p(-8 + i * 1.5, -22 + i * 0.9 + Math.sin(i * 0.8) * 0.5);
      sk.paint(q[0], q[1], m.scar, 0.05, bodyPart);
      if (i % 3 === 0) sk.paint(q[0], q[1] + 1, 0, -0.2, bodyPart);
    }
  }

  // ---- neck and head (the head is big and heavy: HK)
  const N0 = B.p(44, -12);
  const nA = B.a + 0.22 + P.neck;
  const nL = 26 * k;
  const Ho: V2 = [N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL];
  const hk = k * 1.15;
  const H = new Frame2(Ho, B.a * 0.45 + P.neck * 0.35 + P.head, hk);
  const headLocal = (p: Px): V2 => {
    const dx = (p.x - H.o[0]) / hk, dy = (p.y - H.o[1]) / hk;
    const c = Math.cos(-H.a), s = Math.sin(-H.a);
    return [dx * c - dy * s, dx * s + dy * c];
  };
  sk.np();
  sk.tube([N0, [(N0[0] + Ho[0]) / 2, (N0[1] + Ho[1]) / 2 - 2 * k], Ho], t => (23 - t * 7) * k, p => {
    const [lx, ly] = inv(p.x, p.y);
    const g = mantle(lx, ly, depth(lx, ly) * 0.9 + 0.08);
    if (g) return g === 2 ? m.frost : m.grizzle;
    return p.ny > 0.45 ? m.furD : m.fur;
  }, { z: 8, rz: 0.95 });
  sk.streaks(sk.pid, () => B.dir(Math.PI * 0.62), { spacing: 3, len: 3, amp: 0.08, seed: 9 });
  sk.tufts(sk.pid, (_x, _y, nx, ny) => (ny > 0 ? [-0.2, 1] : ny < 0 ? [nx * 0.3 - 0.7, -0.4] : null), { every: 2, seed: 12, len: 2 });
  const hz = 26;
  const headFill = (p: Px) => {
    const [hx, hy] = headLocal(p);
    // the muzzle: paler, shorter fur, crossed by old scars
    if (hx > 11.5) {
      for (const [sx, sl] of [[15, 0.55], [19.5, 0.4], [22.5, 0.7]] as [number, number][]) {
        const d = hx - sx - (hy + 2) * sl;
        if (Math.abs(d) < 0.5 && hy < 2.5 && hy > -6.5) return m.scar;
      }
      if (hy > 4) return m.furD;
      return hy < -3.2 ? m.fur : m.muzzle;
    }
    // frosted crown and cheeks
    if (hy < -7 && hh(Math.floor(hx / 2), Math.floor(hy / 1.5), 53) < 0.28) return m.grizzle;
    if (hy > 6.5) return m.furD;
    return hh(Math.floor(hx / 4), Math.floor(hy / 3), 57) < 0.2 ? m.furW : m.fur;
  };
  const earAt = (bx: number, by: number, zz: number, near: boolean) => {
    sk.np();
    const base = H.p(bx, by);
    const a = H.ang(-1.85 + Math.max(0, P.ear) * 0.15 - Math.max(0, -P.ear) * 0.9);
    const len = (6.5 - Math.max(0, -P.ear) * 2.2) * hk, wid = 4.6 * hk;
    const tp: V2 = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
    sk.blade(base[0], base[1], tp[0], tp[1], s => Math.sin(Math.min(1, s * 1.05) * Math.PI) * wid + 0.5,
      p => (near && Math.abs(p.v) < 0.45 && p.t > 0.25 && p.t < 0.75 ? m.earIn : p.t > 0.8 ? m.grizzle : m.fur), { z0: zz, z1: zz + 0.4 });
  };
  earAt(-11, -11.5, hz - 6, false);
  sk.np();
  const cran = H.p(-1, -1);
  sk.ell(cran[0], cran[1], 16.5 * hk, 14.5 * hk, headFill, { rot: H.a, rz: 14 * hk, z: hz });
  const jowl = H.p(3, 5);
  sk.ell(jowl[0], jowl[1], 13 * hk, 8.5 * hk, headFill, { rot: H.a + 0.1, rz: 9 * hk, z: hz + 2 });
  const mz0 = H.p(9, -1.5), mz1 = H.p(24.5, 1.6);
  sk.tube([mz0, mz1], t => (8.4 - t * 2.2) * hk, headFill, { z: hz + 6 });
  const headPart = sk.pid;
  sk.streaks(headPart, () => H.dir(Math.PI + 0.3), { spacing: 3, len: 2, amp: 0.07, seed: 13 });
  sk.tufts(headPart, (_x, _y, nx, ny) => (ny > 0 && nx <= 0.5 ? [-0.5, 1] : ny < 0 && nx < 0 ? [-0.8, -0.3] : null), { every: 2, seed: 14, len: 2 });
  // the bony brow ridge: bare bone, cracked, overhanging the eye
  sk.np();
  sk.tube([H.p(0.5, -10.2), H.p(7, -11), H.p(14, -7.4)], t => (3.6 - t * 1) * hk, p => {
    const [hx, hy] = headLocal(p);
    if (Math.abs(hx - 5.5 - hy * 0.4) < 0.45 || Math.abs(hx - 10.5 + hy * 0.3) < 0.4) p.l -= 0.32;
    if (p.ny < -0.25 && p.t > 0.15) p.l += 0.1;
    return m.bone;
  }, { z: hz + 9 });
  // the deep socket and the small eye under the ridge
  sk.np();
  const sock = H.p(10.6, -4.4);
  sk.ell(sock[0], sock[1], 3.6 * hk, 2.5 * hk, m.socket, { rot: H.a, z: hz + 7.5 });
  // nose leather
  const nose = H.p(27.2, -0.3);
  sk.np();
  sk.ell(nose[0], nose[1], 4.2 * hk, 3.5 * hk, m.skin, { rot: H.a, rz: 3.2 * hk, z: hz + 12 });
  const nos = H.p(28.6, 0.7 + P.sniff * 0.3);
  sk.ell(nos[0], nos[1], (1.2 + P.sniff * 0.4) * hk, 0.85 * hk, m.socket, { z: hz + 13 });
  // the jaw
  const jA = H.ang(0.08 + P.jaw * 0.95);
  const j0 = H.p(2, 8);
  const jl = 21.5 * hk;
  const j1: V2 = [j0[0] + Math.cos(jA) * jl, j0[1] + Math.sin(jA) * jl];
  const upTip = H.p(24, 6);
  if (P.jaw > 0.12) {
    sk.np();
    const lipBack = H.p(5, 7);
    sk.poly([lipBack[0], lipBack[1], upTip[0], upTip[1], j1[0], j1[1] - 1.5 * hk, j0[0], j0[1]], p => {
      p.l -= Math.max(0, 0.35 - Math.hypot(p.x - j0[0], p.y - j0[1]) / jl) * 0.8;
      return m.mouth;
    }, { z: hz + 4 });
    const tg: V2 = [(j0[0] + j1[0]) / 2 + 1.5 * hk, (j0[1] + j1[1]) / 2 - 1.8 * hk];
    sk.ell(tg[0], tg[1], 7 * hk, 2.4 * hk, m.tongue, { rot: jA - 0.12, z: hz + 4.6, rz: 2 * hk });
    sk.tube([lipBack, upTip], 1.2 * hk, m.gum, { z: hz + 5 });
  }
  sk.np();
  sk.tube([j0, j1], t => (5.2 - t * 1.6) * hk, p => (p.ny > 0.35 ? m.furD : p.t > 0.7 ? m.muzzle : m.fur), { z: hz + 5 });
  // jowl locks hanging off the jaw and cheek
  for (let i = 0; i < 6; i++) {
    const q = H.p(-9 + i * 3.4, 10.5 - i * 0.2);
    lock(sk, m, q[0], q[1], H.ang(Math.PI / 2 + 0.55 - i * 0.04), (5 + hh(i, 4, 33) * 5) * hk, 2.1 * hk, hz + 6 + i * 0.05, 300 + i, 0, 0.15);
  }
  // teeth: the canines show when it snarls
  {
    sk.np();
    const cA = H.ang(Math.PI / 2 + 0.05);
    const clen = (1.5 + P.snarl * 2 + P.jaw * 3.4) * hk;
    const cb = H.p(21.5, 6.6);
    sk.blade(cb[0], cb[1], cb[0] + Math.cos(cA) * clen, cb[1] + Math.sin(cA) * clen, s => (1 - s) * 1.2 * hk + 0.25, m.tooth, { z0: hz + 13, z1: hz + 13.2, bend: 0.3 * hk });
    if (P.jaw > 0.2) {
      const lc: V2 = [j1[0] - Math.cos(jA) * 2.6 * hk, j1[1] - Math.sin(jA) * 2.6 * hk];
      const la = jA - Math.PI / 2 - 0.1, ll = (2 + P.jaw * 1.8) * hk;
      sk.blade(lc[0], lc[1], lc[0] + Math.cos(la) * ll, lc[1] + Math.sin(la) * ll, s => (1 - s) * hk + 0.2, m.tooth, { z0: hz + 13, z1: hz + 13.1 });
      for (let i = 0; i < 3; i++) {
        const q: V2 = [j0[0] + Math.cos(jA) * (8 + i * 3) * hk, j0[1] + Math.sin(jA) * (8 + i * 3) * hk - 1.2 * hk];
        sk.dot(q[0], q[1], m.tooth, 0.8, hz + 12);
      }
    }
    if (P.tongue > 0.1) {
      const tq: V2 = [j1[0] - Math.cos(jA) * 3 * hk, j1[1] - Math.sin(jA) * 3 * hk];
      sk.ell(tq[0] + 1.2 * hk, tq[1] + 2.4 * hk * P.tongue, 2.4 * hk, (1.5 + P.tongue) * hk, m.tongue, { z: hz + 14, rz: 1.6 * hk });
    }
  }
  // the snarl wrinkles the muzzle
  if (P.snarl > 0.4) for (let i = 0; i < 3; i++) {
    const a = H.p(13.5 + i * 2.2, -6.6 + i * 0.4), b = H.p(14.5 + i * 2.2, -3.6);
    sk.line(a[0], a[1], b[0], b[1], m.furD, 0.3, hz + 14);
  }
  earAt(-7.5, -12.5, hz + 8, true);
  const ec = H.p(10.8, -4.2);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: k >= 2 ? Math.min(2.4, k * 0.8) : 1 }, P.eye ?? 'open');

  // ---- near hind leg, then the claw arm in front of it all
  drawHind(true);
  const sh = B.p(36, 6);
  let fist: V2, fa: number;
  let clawTip: V2 = [0, 0], clawBase: V2 = [0, 0];
  {
    sk.np();
    const raised = P.arm > -8;
    const zA = raised ? 70 : 42;
    let el: V2, end: V2, bend = 1;
    const fa0 = (a: V2, b: V2) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (!raised) {
      let foot: V2 = [(44 + P.bx + P.feet[0][0]) * k, (Math.min(0, P.feet[0][1]) - 7) * k];
      if (lie > 0.01) { const tg = B.p(70, 20); foot = [foot[0] + (tg[0] - foot[0]) * lie, Math.min(-6 * k, foot[1] + (tg[1] - foot[1]) * lie)]; }
      [el, end] = ik2(sh, foot, FL.l1, FL.l2, 1);
    } else {
      const len = (FL.l1 + FL.l2) * (0.72 + 0.27 * P.armR);
      const tgt: V2 = [sh[0] + Math.sin(P.arm) * len, sh[1] + Math.cos(P.arm) * len];
      bend = P.arm > 1.2 ? -1 : 1;
      [el, end] = ik2(sh, tgt, FL.l1, FL.l2, bend);
    }
    sk.tube([sh, el], t => FL.r1 + (FL.r2 - FL.r1) * t, legFill(false), { z: zA });
    sk.tube([el, end], t => FL.r2 + (9.5 * k - FL.r2) * t, legFill(false), { z: zA + 0.2 });
    sk.ell(el[0], el[1], 12 * k, 10 * k, legFill(false), { z: zA + 0.4 });
    furLeg(sk.pid, fa0(el, end) + 0.15);
    fist = end; fa = Math.atan2(end[1] - el[1], end[0] - el[0]);
    // elbow feathering: long locks off the back of the forearm
    const back = fa + (Math.PI / 2) * bend;
    for (let i = 0; i < 5; i++) {
      const q: V2 = [el[0] + (end[0] - el[0]) * (0.05 + i * 0.13) + Math.cos(back) * 7 * k, el[1] + (end[1] - el[1]) * (0.05 + i * 0.13) + Math.sin(back) * 7 * k];
      const la = raised ? Math.PI / 2 + 0.25 : Math.PI / 2 + 0.7;
      lock(sk, m, q[0], q[1], la, (7 + hh(i, 7, 51) * 6) * k, 2.8 * k, zA + 0.6 + i * 0.05, 500 + i, 0, 0.1);
    }
    // the fist: knuckles down, a dark cuticle where the great claw grows
    const fx = fist[0] + Math.cos(fa) * 3 * k, fy = fist[1] + Math.sin(fa) * 3 * k;
    sk.ell(fx, fy, 10 * k, 8 * k, m.furD, { rot: fa, z: zA + 1, rz: 8 * k });
    for (let i = 0; i < 3; i++) {
      const a = fa - 0.9 + i * 0.6;
      sk.ell(fx + Math.cos(a) * 7 * k, fy + Math.sin(a) * 6 * k, 2.8 * k, 2.4 * k, m.furD, { z: zA + 1.5 });
    }
    // ---- the great claw
    const fold = P.fold;
    const cA = fa + fold * (Math.PI - 0.16) + (1 - fold) * P.hook * 0.5;
    const cl = 60 * k;
    const palm: V2 = [-Math.sin(fa), Math.cos(fa)];
    const rootA = fold * 6.5, rootF = 6 - fold * 5;
    const b0: V2 = [fx + (Math.cos(fa) * rootF + palm[0] * rootA) * k, fy + (Math.sin(fa) * rootF + palm[1] * rootA) * k];
    const dir: V2 = [Math.cos(cA), Math.sin(cA)];
    const perp: V2 = [-dir[1], dir[0]]; // toward the palm: the concave side (the tube's v > 0)
    // a sickle: straight off the root, sweeping round into a hooked point
    const hookK = 0.42 + (1 - fold) * P.hook * 0.08;
    const at = (a: number, b: number): V2 => [b0[0] + (dir[0] * a + perp[0] * b) * cl, b0[1] + (dir[1] * a + perp[1] * b) * cl];
    const tipP = at(0.8, hookK);
    const pts = cbez(b0, at(0.42, -0.02), at(0.86, hookK * 0.22), tipP, 14);
    sk.np();
    const zc = zA + 22;
    sk.tube(pts, t => (t < 0.12 ? 7.6 - t * 4 : 7.1 * Math.pow(1 - (t - 0.12) / 0.88, 0.62) + 0.45) * k, p => {
      const t = p.t, v = p.v;
      // a chip knocked out of the back edge near the tip
      if (t > 0.82 && t < 0.88 && v < -0.15) return 0;
      if (t < 0.1) { if (t > 0.07) p.l -= 0.15; return m.clawBase; }
      // keratin growth ridges along it, rings near the base
      if (Math.abs(v + 0.4) < 0.1 || (Math.abs(v - 0.12) < 0.07 && t > 0.2 && t < 0.8)) p.l -= 0.16;
      if (t < 0.36 && fr(t * 15) < 0.2) p.l -= 0.1;
      // a hairline crack
      if (t > 0.5 && t < 0.58 && Math.abs(v + 0.05 - (t - 0.5) * 5) < 0.1) p.l -= 0.3;
      // the worn, pale working edge (the inside of the hook) and the bleached tip
      if (v > 0.5 && t > 0.16) { p.l += (v - 0.5) * 0.4; return m.clawPale; }
      if (t > 0.91) return m.clawPale;
      // gloss along the back
      if (v < -0.2 && v > -0.55 && t > 0.2 && t < 0.78) p.l += 0.12;
      // dark at the root, paler horn toward the point (a ragged line between, like growth)
      return t > 0.56 + Math.sin(v * 5 + t * 9) * 0.05 ? m.horn : m.claw;
    }, { z: zc, rz: 0.8 });
    // cuticle fur over the root of the claw
    for (let i = 0; i < 4; i++) {
      const q: V2 = [b0[0] - dir[0] * 1.5 * k + perp[0] * (i - 1.5) * 2.4 * k, b0[1] - dir[1] * 1.5 * k + perp[1] * (i - 1.5) * 2.4 * k];
      lock(sk, m, q[0], q[1], cA + (hh(i, 1, 61) - 0.5) * 0.6, (3.5 + hh(i, 2, 61) * 2) * k, 1.6 * k, zc + 1, 600 + i, 0.05, 0.25);
    }
    clawTip = tipP; clawBase = b0;
  }

  const headTop = H.p(0, -17);
  return {
    head: headTop, eye: ep, mouth: [(upTip[0] + j1[0]) / 2, (upTip[1] + j1[1]) / 2], nose,
    clawBase, clawTip, fist, paw: farPaw, tail: tip,
  };
}

// ------------------------------------------------------------------ canvases, field-guide def, cached world frames
const CANVAS = { w: 360, h: 290, ox: 150, oy: 280 };
export const bearerCanvas = (k = 1) => ({ w: Math.ceil(CANVAS.w * k), h: Math.ceil(CANVAS.h * k), ox: Math.round(CANVAS.ox * k), oy: Math.round(CANVAS.oy * k) });

/** the field-guide / sheet registration */
export const BEARER_DEF: SpeciesDef = {
  name: 'Bearer', kind: 'mammal', len: 200, height: 106,
  anims: BEARER_ANIMS,
  canvas: () => bearerCanvas(1),
  draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
    const P = bearerPoseAt(anim, frame);
    P.eye = eye;
    const o = drawBearer(sk, P, 1);
    return { head: o.head, eye: o.eye };
  },
  eyeFor: bearerEyeFor,
};

export interface BearerFrame {
  buf: PixelBuffer;
  /** anchor (the ground under the body) in the cropped buffer */
  ax: number; ay: number;
  /** points relative to the anchor */
  head: V2; eye: V2; mouth: V2; nose: V2; clawBase: V2; clawTip: V2; fist: V2; paw: V2; tail: V2;
  /** silhouette sample points (relative to the anchor) */
  pts: V2[];
}

interface Raw { buf: PixelBuffer; o: BearerOut }
function renderRaw(anim: string, frame: number, eye: BeastEye): Raw {
  const cv = bearerCanvas(1);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  const P = bearerPoseAt(anim, frame);
  P.eye = eye;
  const o = drawBearer(sk, P, 1);
  return { buf: sk.resolve({ rim: 0.12, bounce: 0.09 }), o };
}
interface Box { x0: number; y0: number; x1: number; y1: number }
function boundsOf(b: PixelBuffer): Box | null {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      if (b.data[y * b.w + x] >>> 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
function cropBuf(b: PixelBuffer, box: Box): PixelBuffer {
  const out = new PixelBuffer(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1);
  for (let y = Math.max(0, box.y0); y <= Math.min(b.h - 1, box.y1); y++)
    for (let x = Math.max(0, box.x0); x <= Math.min(b.w - 1, box.x1); x++) out.data[(y - box.y0) * out.w + (x - box.x0)] = b.data[y * b.w + x];
  return out;
}
const stripBox = new Map<string, Box>();
const frames = new Map<string, BearerFrame>();
const cv1 = bearerCanvas(1);
function pack(r: Raw, box: Box): BearerFrame {
  const buf = cropBuf(r.buf, box);
  const ax = cv1.ox - box.x0, ay = cv1.oy - box.y0;
  const pts: V2[] = [];
  const step = 7;
  for (let y = 1; y < buf.h; y += step) for (let x = 1; x < buf.w; x += step) if (buf.data[y * buf.w + x] >>> 24 > 128) pts.push([x - ax, y - ay]);
  if (!pts.length) pts.push([0, -40]);
  const o = r.o;
  return { buf, ax, ay, head: o.head, eye: o.eye, mouth: o.mouth, nose: o.nose, clawBase: o.clawBase, clawTip: o.clawTip, fist: o.fist, paw: o.paw, tail: o.tail, pts };
}

/** is a whole anim strip painted yet? */
export const bearerStripReady = (anim: string) => stripBox.has(anim);

function boxOf(raws: Raw[]): Box {
  let u: Box | null = null;
  for (const r of raws) {
    const b = boundsOf(r.buf);
    if (b) u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
  }
  u = u ?? { x0: cv1.ox, y0: cv1.oy - 1, x1: cv1.ox, y1: cv1.oy };
  return { x0: Math.min(u.x0, cv1.ox) - 1, y0: Math.min(u.y0, cv1.oy) - 1, x1: Math.max(u.x1, cv1.ox) + 1, y1: Math.max(u.y1, cv1.oy - 1) + 1 };
}

/** strips being painted a frame at a time (bearerWarmStep) */
const pending = new Map<string, Raw[]>();
/**
 * Paint ONE frame of the next strip that isn't ready (call every frame or so while a scene runs,
 * so nothing hitches when the Bearer first does something). Returns true once every strip in
 * `anims` is ready.
 */
export function bearerWarmStep(anims: string[] = Object.keys(BEARER_ANIMS)): boolean {
  const anim = anims.find(a => !stripBox.has(a) && BEARER_ANIMS[a]);
  if (!anim) return true;
  const A = BEARER_ANIMS[anim];
  const raws = pending.get(anim) ?? [];
  pending.set(anim, raws);
  const i = raws.length;
  raws.push(renderRaw(anim, i, bearerEyeFor(anim, i)));
  if (raws.length >= A.frames) {
    pending.delete(anim);
    if (!stripBox.has(anim)) {
      const box = boxOf(raws);
      stripBox.set(anim, box);
      raws.forEach((r, j) => frames.set(anim + '|' + j + '|' + bearerEyeFor(anim, j), pack(r, box)));
    }
  }
  return false;
}

/**
 * One world frame of the Bearer (cropped to the anim strip's shared box, anchor at the ground). The
 * first request of an anim paints the whole strip (all its frames share one box).
 */
export function bearerFrame(anim: string, frame: number, eye?: BeastEye): BearerFrame {
  if (!BEARER_ANIMS[anim]) anim = 'idle';
  const A = BEARER_ANIMS[anim];
  const f = ((Math.floor(frame) % A.frames) + A.frames) % A.frames;
  const eyeOf = (i: number) => eye ?? bearerEyeFor(anim, i);
  const key = anim + '|' + f + '|' + eyeOf(f);
  const hit = frames.get(key);
  if (hit) return hit;
  let box = stripBox.get(anim);
  if (!box) {
    const raws: Raw[] = [];
    for (let i = 0; i < A.frames; i++) raws.push(renderRaw(anim, i, eyeOf(i)));
    pending.delete(anim);
    box = boxOf(raws);
    stripBox.set(anim, box);
    raws.forEach((r, i) => frames.set(anim + '|' + i + '|' + eyeOf(i), pack(r, box!)));
    const got = frames.get(key);
    if (got) return got;
  }
  const out = pack(renderRaw(anim, f, eyeOf(f)), box);
  frames.set(key, out);
  return out;
}

/** a big crisp painting of one pose (name cards, close-ups, the boss fight's cut-ins): k = scale */
export function paintBearerBig(anim: string, frame: number, k = 2.5, eye?: BeastEye): { buf: PixelBuffer; ax: number; ay: number } {
  const cv = bearerCanvas(k);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  const P = bearerPoseAt(anim, frame);
  P.eye = eye ?? bearerEyeFor(anim, frame);
  drawBearer(sk, P, k);
  const buf = sk.resolve({ rim: 0.12, bounce: 0.08 });
  const b = boundsOf(buf);
  if (!b) return { buf, ax: cv.ox, ay: cv.oy };
  return { buf: cropBuf(buf, b), ax: cv.ox - b.x0, ay: cv.oy - b.y0 };
}

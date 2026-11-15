// V11 Cerebral Tiger (Cerebrotigris pelophilus): the forest's ambush predator. A huge, short-haired cat
// built like a hippo: a deep barrel body slung low on short, massive legs, a broad head under a high
// domed brow (the "cerebral" dome: an enlarged sinus that carries its roar through mud and water),
// small eyes raised on turrets so they stay above the mud when the rest of it is under, nostrils on
// top of the snout that pinch shut, ears that fold flat and seal, wide splayed toes with webbing
// for soft ground and a thick, muscular tail it sculls with in the wallows. The sleek tawny coat has
// faded umber stripes and is caked with mud from the elbows down; fresh out of a wallow the whole
// animal is sheeted in dark wet mud.
//
// Sculpted in 2.5D (src/art/sculpt.ts) into the beast sketch core (beasts-core.ts) from a posed rig with
// depth. Every form is ONE continuous outline through anatomical landmarks (the withers, the dipped back,
// the croup, the buttock, the sagging belly and the brisket; the nape and the dewlap; each leg's front and
// back edge with the point of the shoulder, the triceps, the elbow, the forearm, the wrist, the thigh,
// the stifle, the calf and the point of the hock; the paw's toe lobes), shaded from its distance in
// from the edge, with the anatomy underneath painted in as relief: the shoulder blade, the ribs, the
// flank hollow, the hip bone, the haunch, the jaw muscle, the eye turret and the dome, plus skin folds,
// hair, fur tufts breaking the edge, cracked mud plates. The head is a single sculpted form (the jaw a
// second one when it opens). One geometry pass resolves twice: dry (caked, cracked mud) and wet (dark
// glossy mud, wet fur), so the world can show it dripping fresh out of the mud.
//
// Everything faces RIGHT; the anchor is the ground under the body (the mud surface for the wallow).

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, cbez, ik2 } from '../beasts-core';
import { Frame2 } from '../beasts-rig';
import { noise2 } from '../../core/math';
import { Lay, Tx, Keys, shape, spline, limbOutline, fringe, densify, crv, cl, ss, gs, frc, cell, CELL, rotP } from '../sculpt';
import { hex, C } from '../color';
import { PixelBuffer } from '../pixel';

// ------------------------------------------------------------------ pose
export interface TigerPose {
  /** body offset (px at k=1, + down) */
  bx: number; by: number;
  /** body pitch (rad, + = front down) */
  tilt: number;
  /** breath 0..1: the flanks and chest swell */
  br: number;
  /** belly jiggle (px) */
  jig: number;
  /** 0..1 crouched low (stalk, gather, lying) */
  low: number;
  /** spine stretch (px: + extended in the gallop's reach, - gathered) */
  stretch: number;
  /** shoulder-blade roll -1..1 (the near blade rides up when its leg takes the weight) */
  hump: number;
  /** foot offsets from rest: near fore, far fore, near hind, far hind */
  feet: [V2, V2, V2, V2];
  /** near / far foreleg reaching forward and up 0..1 (pounce, emerging) */
  reach: number; reachF: number;
  /** near forepaw swipe: < -1 = not swiping; else the swing angle from the shoulder (rad, 0 = straight down) */
  swipe: number;
  /** claws out 0..1 */
  claws: number;
  /** hind legs tucked under (airborne) 0..1 */
  tuck: number;
  /** neck angle offset (+ = head lower), head angle offset (+ = nose down) */
  neck: number; head: number;
  /** jaw gape 0..1 (1 = the full hippo-wide roar) */
  jaw: number;
  /** lips curled back off the canines 0..1 */
  snarl: number;
  /** ears: -1 folded flat and sealed .. 1 pricked */
  ear: number;
  /** nostrils 0 open .. 1 pinched shut */
  nos: number;
  /** tongue out 0..1 (stunned) */
  tongue: number;
  /** tail lift (+ up), curl of the tip, wave phase */
  tail: number; tailCurl: number; tailWave: number;
  /** 0..1 sunk below the mud surface (the anchor line) */
  sink: number;
  /** 0..1 mud sheeting off the body (erupting) and its phase */
  sheet: number; sheetPh: number;
  /** 0..1 shaking itself off */
  shake: number;
  /** 0..1 lying down */
  lie: number;
  /** seconds-ish phase for small secondary motion */
  t: number;
  /** eye state (the painter's override; default open) */
  eye?: BeastEye;
}

export function tigerRest(): TigerPose {
  return {
    bx: 0, by: 0, tilt: 0, br: 0.5, jig: 0, low: 0, stretch: 0, hump: 0,
    feet: [[0, 0], [0, 0], [0, 0], [0, 0]], reach: 0, reachF: 0, swipe: -9, claws: 0, tuck: 0,
    neck: 0, head: 0, jaw: 0, snarl: 0, ear: 0.6, nos: 0, tongue: 0,
    tail: 0, tailCurl: 0.3, tailWave: 0, sink: 0, sheet: 0, sheetPh: 0, shake: 0, lie: 0, t: 0,
  };
}

export const TIGER_ANIMS: Record<string, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: 8, fps: 5, loop: true },
  alert: { frames: 4, fps: 4, loop: true },
  prowl: { frames: 10, fps: 9, loop: true },
  stalk: { frames: 8, fps: 6, loop: true },
  charge: { frames: 8, fps: 13, loop: true },
  pounce: { frames: 6, fps: 10, loop: false },
  swipe: { frames: 6, fps: 12, loop: false },
  roar: { frames: 6, fps: 6, loop: false },
  flinch: { frames: 4, fps: 12, loop: false },
  stunned: { frames: 6, fps: 5, loop: true },
  shake: { frames: 8, fps: 14, loop: true },
  wallow: { frames: 6, fps: 3, loop: true },
  emerge: { frames: 8, fps: 11, loop: false },
  submerge: { frames: 6, fps: 7, loop: false },
  retreat: { frames: 8, fps: 8, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  eat: { frames: 4, fps: 5, loop: true },
};

/** how deep the body sinks when fully under (px at k=1) */
const SINK = 43;

export function tigerPoseAt(anim: string, f: number): TigerPose {
  const P = tigerRest();
  const info = TIGER_ANIMS[anim] ?? TIGER_ANIMS.idle;
  const n = info.frames;
  const t = info.loop ? f / n : n > 1 ? f / (n - 1) : 0;
  const S = <T,>(a: T[]): T => a[Math.min(a.length - 1, f)];
  P.t = t;
  switch (anim) {
    case 'idle':
      P.br = 0.5 - 0.5 * Math.cos(t * TAU);
      P.jig = Math.sin(t * TAU - 1) * 0.6;
      P.head = 0.04 + Math.sin(t * TAU) * 0.025;
      P.neck = Math.sin(t * TAU + 0.5) * 0.02;
      P.ear = f === 5 ? 0.1 : 0.7;
      P.tail = -0.05 + Math.sin(t * TAU) * 0.05; P.tailWave = t; P.tailCurl = 0.35 + Math.sin(t * TAU) * 0.1;
      break;
    case 'alert':
      P.neck = -0.3; P.head = -0.14; P.ear = 1; P.br = f / 3;
      P.tail = 0.12; P.tailWave = t * 0.5; P.tailCurl = 0.5;
      P.feet[0] = [2, 0];
      break;
    case 'prowl': {
      const st = 22, lift = 4.5, duty = 0.62;
      P.feet[2] = gait(t, duty, st, lift);
      P.feet[0] = gait(t + 0.25, duty, st, lift * 1.1);
      P.feet[3] = gait(t + 0.5, duty, st, lift);
      P.feet[1] = gait(t + 0.75, duty, st, lift * 1.1);
      P.by = Math.cos(t * TAU * 2) * 0.9;
      P.jig = Math.cos(t * TAU * 2 - 1.3) * 1.4;
      P.hump = Math.sin(t * TAU + 0.6);
      P.tilt = Math.sin(t * TAU) * 0.012;
      P.neck = 0.12; P.head = 0.1 + Math.sin(t * TAU * 2 + 0.6) * 0.035;
      P.ear = 0.5; P.tail = -0.12; P.tailWave = t; P.tailCurl = 0.3;
      break;
    }
    case 'stalk': {
      const st = 15, lift = 2.6, duty = 0.7;
      P.feet[2] = gait(t, duty, st, lift);
      P.feet[0] = gait(t + 0.25, duty, st, lift);
      P.feet[3] = gait(t + 0.5, duty, st, lift);
      P.feet[1] = gait(t + 0.75, duty, st, lift);
      P.low = 0.75;
      P.by = Math.cos(t * TAU * 2) * 0.35;
      P.hump = Math.sin(t * TAU + 0.6) * 1.2;
      P.neck = 0.42; P.head = -0.12; P.ear = 0.8;
      P.tail = -0.38; P.tailCurl = 0.7 + Math.sin(t * TAU * 2) * 0.25; P.tailWave = t * 2;
      P.jig = Math.cos(t * TAU * 2) * 0.5;
      break;
    }
    case 'charge': {
      // a heavy rotary gallop: the spine gathers and reaches, one short suspension, the belly swings
      const st = 34, lift = 9, duty = 0.42;
      P.feet[2] = gait(t, duty, st, lift);
      P.feet[3] = gait(t + 0.08, duty, st, lift);
      P.feet[1] = gait(t + 0.48, duty, st, lift);
      P.feet[0] = gait(t + 0.56, duty, st, lift);
      const c = Math.cos(t * TAU);
      P.stretch = c * 5;
      P.by = -Math.max(0, Math.sin(t * TAU + 0.6)) * 4.5 + 1.5;
      P.tilt = Math.sin(t * TAU) * 0.06;
      P.jig = Math.cos(t * TAU - 1.6) * 2.6;
      P.neck = 0.3; P.head = 0.1 - Math.sin(t * TAU) * 0.06;
      P.jaw = 0.25 + Math.sin(t * TAU) * 0.08; P.snarl = 0.4;
      P.ear = -0.7; P.tail = 0.05 + Math.sin(t * TAU) * 0.12; P.tailCurl = -0.3; P.tailWave = t;
      P.hump = -c;
      break;
    }
    case 'pounce': {
      P.low = S([1, 0.3, 0, 0, 0.15, 0.45]);
      P.by = S([0, -11, -27, -19, -2, 0]);
      P.bx = S([-4, 2, 10, 16, 20, 18]);
      P.tilt = S([0.05, -0.34, -0.14, 0.12, 0.2, 0.06]);
      P.feet[2] = S([[8, 0], [-10, 0], [-16, -20], [-12, -14], [-14, -2], [6, 0]] as V2[]);
      P.feet[3] = S([[10, 0], [-6, 0], [-12, -18], [-8, -12], [-10, 0], [8, 0]] as V2[]);
      P.feet[0] = S([[4, 0], [10, -6], [26, -30], [30, -18], [36, 0], [26, 0]] as V2[]);
      P.feet[1] = S([[2, 0], [6, -4], [22, -26], [27, -14], [31, 0], [22, 0]] as V2[]);
      P.reach = S([0, 0.6, 1, 1, 0.3, 0]);
      P.reachF = S([0, 0.5, 0.9, 0.9, 0.2, 0]);
      P.claws = S([0.4, 1, 1, 1, 0.8, 0.3]);
      P.tuck = S([0, 0, 0.7, 0.4, 0, 0]);
      P.neck = S([0.38, 0.0, -0.22, -0.08, 0.3, 0.2]);
      P.head = S([-0.12, -0.2, -0.18, -0.06, 0.1, 0.05]);
      P.jaw = S([0.1, 0.5, 0.95, 1, 0.6, 0.3]);
      P.snarl = S([0.5, 1, 1, 1, 0.8, 0.4]);
      P.ear = S([-0.4, -0.8, -0.9, -0.9, -0.7, -0.3]);
      P.tail = S([-0.3, 0.1, 0.35, 0.25, 0, -0.1]); P.tailCurl = S([0.6, 0, -0.3, -0.2, 0.2, 0.3]);
      P.jig = S([0, -2, -3, 2, 3, 0]);
      break;
    }
    case 'swipe': {
      // weight back onto the haunches, the near forepaw swings up and round, claws out
      P.bx = S([-2, -5, -3, 1, 0, 0]);
      P.tilt = S([-0.04, -0.14, -0.1, 0.04, 0.02, 0]);
      P.low = S([0.1, 0.25, 0.2, 0.1, 0.05, 0]);
      P.swipe = S([-0.6, -2.3, -1.2, 0.35, 0.15, -9]);
      P.claws = S([0.6, 1, 1, 1, 0.6, 0.1]);
      P.jaw = S([0.3, 0.7, 0.8, 0.6, 0.35, 0.1]);
      P.snarl = S([0.6, 1, 1, 0.9, 0.5, 0.2]);
      P.ear = S([-0.5, -0.9, -0.9, -0.8, -0.4, 0.2]);
      P.neck = S([0.05, -0.15, -0.05, 0.2, 0.15, 0.05]);
      P.head = S([0, -0.1, 0, 0.12, 0.08, 0.04]);
      P.feet[1] = S([[0, 0], [-2, 0], [-1, 0], [3, 0], [2, 0], [0, 0]] as V2[]);
      P.tail = S([0, 0.2, 0.25, 0.1, 0, 0]);
      break;
    }
    case 'roar': {
      P.br = S([1, 1, 1, 0.9, 0.7, 0.4]);
      P.neck = S([-0.08, -0.42, -0.5, -0.48, -0.4, -0.18]);
      P.head = S([0.14, -0.22, -0.3, -0.28, -0.22, -0.04]);
      P.jaw = S([0.12, 0.85, 1, 1, 0.9, 0.35]);
      P.snarl = S([0.2, 0.9, 1, 1, 0.9, 0.3]);
      P.ear = S([0, -0.8, -1, -1, -0.9, -0.2]);
      P.bx = S([-2, 0, 1, 2, 1, 0]);
      P.tilt = S([0.02, -0.05, -0.07, -0.06, -0.05, -0.02]);
      P.tail = S([0, 0.25, 0.4, 0.4, 0.3, 0.1]); P.tailCurl = 0;
      P.feet[0] = S([[0, 0], [3, 0], [4, 0], [4, 0], [4, 0], [2, 0]] as V2[]);
      P.t = f * 0.31;
      break;
    }
    case 'flinch': {
      P.neck = S([-0.4, -0.25, -0.1, 0]);
      P.head = S([-0.38, -0.2, 0, 0.1]);
      P.bx = S([-5, -7, -5, -3]);
      P.tilt = S([-0.08, -0.05, -0.02, 0]);
      P.ear = S([-1, -1, -0.6, -0.3]);
      P.jaw = S([0.4, 0.3, 0.2, 0.15]); P.snarl = S([0.7, 0.6, 0.5, 0.4]);
      P.feet[0] = S([[-4, -7], [-3, -3], [-1, 0], [0, 0]] as V2[]);
      P.low = S([0.2, 0.3, 0.25, 0.15]);
      P.tail = S([0.3, 0.1, 0, -0.1]);
      break;
    }
    case 'stunned':
      P.head = 0.28 + Math.sin(t * TAU) * 0.2;
      P.neck = 0.32 + Math.cos(t * TAU) * 0.09;
      P.jaw = 0.22; P.tongue = 0.9; P.ear = -0.45 + Math.sin(t * TAU * 2) * 0.1;
      P.by = Math.sin(t * TAU) * 0.6; P.tilt = Math.sin(t * TAU) * 0.035;
      P.low = 0.25; P.bx = Math.sin(t * TAU) * 1.5;
      P.tail = -0.3; P.tailCurl = 0.1; P.tailWave = t;
      P.feet[0] = [Math.sin(t * TAU) * 2, 0]; P.feet[1] = [-Math.sin(t * TAU) * 2, 0];
      break;
    case 'shake': {
      // a wet-dog shake that starts at the head and rolls down the body
      const s = Math.sin(t * TAU * 2), c2 = Math.sin(t * TAU * 2 + 1.2);
      P.shake = 1;
      P.head = s * 0.32; P.neck = -0.12 + c2 * 0.12;
      P.tilt = Math.sin(t * TAU * 2 + 2) * 0.045; P.hump = c2 * 1.4;
      P.ear = Math.sin(t * TAU * 4) * 0.9; P.jaw = 0.2 + Math.max(0, s) * 0.15;
      P.by = -Math.abs(s) * 1; P.jig = c2 * 2;
      P.tail = Math.sin(t * TAU * 2 + 3) * 0.4; P.tailWave = t * 2;
      break;
    }
    case 'wallow':
      // only the dome, the eye turrets, the sealed ears, the nostrils and the shoulder hump break the surface
      P.sink = 1; P.low = 1;
      P.neck = -0.25; P.head = -0.2 + Math.sin(t * TAU) * 0.02;
      P.ear = -1; P.nos = f === 2 || f === 3 ? 0 : 1;
      P.br = 0.5 - 0.5 * Math.cos(t * TAU);
      P.by = Math.sin(t * TAU) * 0.5;
      break;
    case 'emerge':
      P.sink = S([1, 0.86, 0.62, 0.38, 0.18, 0.06, 0, 0]);
      P.low = S([1, 0.9, 0.6, 0.35, 0.2, 0.1, 0, 0]);
      P.neck = S([-0.25, -0.35, -0.48, -0.52, -0.38, -0.18, -0.02, 0.04]);
      P.head = S([-0.2, -0.26, -0.32, -0.34, -0.25, -0.1, 0, 0.02]);
      P.jaw = S([0, 0.3, 0.8, 1, 0.75, 0.4, 0.2, 0.12]);
      P.snarl = S([0, 0.5, 1, 1, 0.8, 0.5, 0.3, 0.2]);
      P.ear = S([-1, -1, -0.9, -0.6, -0.3, 0, 0.3, 0.4]);
      P.nos = S([1, 0.4, 0, 0, 0, 0, 0, 0]);
      P.reach = S([0, 0.2, 0.6, 0.7, 0.4, 0.15, 0, 0]);
      P.reachF = S([0, 0.1, 0.45, 0.55, 0.3, 0.1, 0, 0]);
      P.claws = S([0, 0.3, 0.8, 0.8, 0.5, 0.2, 0, 0]);
      P.sheet = S([0.3, 0.8, 1, 1, 0.85, 0.6, 0.35, 0.15]);
      P.sheetPh = t;
      P.tilt = S([0, -0.1, -0.2, -0.18, -0.1, -0.04, 0, 0]);
      P.tail = S([0, 0.1, 0.3, 0.3, 0.2, 0.1, 0, 0]);
      break;
    case 'submerge':
      P.sink = S([0, 0.2, 0.45, 0.7, 0.88, 1]);
      P.low = S([0, 0.3, 0.6, 0.85, 1, 1]);
      P.neck = S([0, -0.06, -0.14, -0.2, -0.24, -0.25]);
      P.head = S([0, -0.05, -0.1, -0.15, -0.19, -0.2]);
      P.ear = S([0, -0.4, -1, -1, -1, -1]);
      P.nos = S([0, 0, 0.3, 0.8, 1, 1]);
      P.sheet = S([0, 0.25, 0.35, 0.3, 0.2, 0.1]);
      P.sheetPh = t;
      P.snarl = S([0.4, 0.4, 0.3, 0.2, 0, 0]);
      break;
    case 'retreat': {
      // backing off, low and snarling: the walk run backwards
      const st = 15, lift = 3, duty = 0.66;
      P.feet[2] = gait(-t, duty, st, lift);
      P.feet[0] = gait(-t + 0.25, duty, st, lift);
      P.feet[3] = gait(-t + 0.5, duty, st, lift);
      P.feet[1] = gait(-t + 0.75, duty, st, lift);
      P.low = 0.35; P.by = Math.cos(t * TAU * 2) * 0.5;
      P.neck = 0.25; P.head = -0.06; P.snarl = 0.7; P.jaw = 0.25 + Math.sin(t * TAU * 2) * 0.05;
      P.ear = -0.85; P.tail = -0.42; P.tailCurl = 0.45; P.tailWave = t;
      P.hump = Math.sin(-t * TAU + 0.6);
      break;
    }
    case 'sleep':
      P.lie = 1; P.low = 1; P.br = f; P.neck = 0.5; P.head = 0.16; P.ear = -0.2;
      P.tail = -0.1; P.tailCurl = 0.8;
      break;
    case 'eat':
      P.neck = 0.82; P.head = 0.32 + (f % 2) * 0.05; P.low = 0.3;
      P.jaw = S([0, 0.5, 0.2, 0.6]); P.snarl = 0.3; P.ear = 0.3;
      P.feet[0] = [5, 0]; P.feet[1] = [2, 0]; P.tail = -0.15; P.tailWave = t;
      break;
  }
  return P;
}

export function tigerEyeFor(anim: string, frame: number): BeastEye {
  switch (anim) {
    case 'sleep': case 'stunned': return 'closed';
    case 'flinch': return frame < 2 ? 'closed' : 'angry';
    case 'shake': return frame % 4 < 2 ? 'closed' : 'open';
    case 'alert': return 'alert';
    case 'stalk': case 'charge': case 'pounce': case 'swipe': case 'roar': case 'retreat': case 'emerge': return 'angry';
    default: return 'open';
  }
}

// ------------------------------------------------------------------ materials
type M = ReturnType<typeof mats>;
function mats(sk: Sk) {
  const coatR = rmp('#a8703e', { n: 8, dark: 0.58, cool: 0.12, light: 0.42, warm: 0.3, sat: 0.0 });
  const stripeR = rmp('#3e2618', { n: 5, dark: 0.5, light: 0.32, cool: 0.12 });
  const fadedR = rmp('#7a4c2c', { n: 6, dark: 0.56, light: 0.32, cool: 0.12 });
  const creamR = rmp('#e6d4ac', { n: 7, dark: 0.5, light: 0.42, cool: 0.18 });
  return {
    coat: sk.m(coatR),
    stripe: sk.m(stripeR, { edge: 1 }),
    faded: sk.m(fadedR, { edge: 1 }),
    cream: sk.m(creamR),
    // fur that wet mud covers once it has been under (the flanks, the chest, the face below the eyes)
    coatW: sk.m(coatR), stripeW: sk.m(stripeR, { edge: 1 }), fadedW: sk.m(fadedR, { edge: 1 }), creamW: sk.m(creamR),
    mud: sk.m(rmp('#958060', { n: 7, dark: 0.55, light: 0.34, cool: 0.15 })),
    mud2: sk.m(rmp('#7e6a4e', { n: 7, dark: 0.55, light: 0.3, cool: 0.15 })),
    crack: sk.m(rmp('#4e3e2c', { n: 4, dark: 0.45 }), { edge: 0 }),
    wetMud: sk.m(rmp('#3f2d1e', { n: 6, dark: 0.62, light: 0.62 }), { k: 1.2 }),
    skin: sk.m(rmp('#4e3530', { n: 5, dark: 0.5, light: 0.35 })),
    mouth: sk.m(rmp('#7a2c36', { n: 6, dark: 0.6, light: 0.35 }), { edge: 0, spec: 0.5 }),
    gum: sk.m(rmp('#a24a52', { n: 4, dark: 0.5 })),
    tongue: sk.m(rmp('#c4666c', { n: 5, dark: 0.5, light: 0.35 })),
    tooth: sk.m(rmp('#efe4c8', { n: 4, dark: 0.35, at: 2 })),
    claw: sk.m(rmp('#e4d6b4', { n: 4, dark: 0.45, at: 2 })),
    earIn: sk.m(rmp('#6e4434', { n: 4, dark: 0.5 })),
    earBack: sk.m(rmp('#3e2b22', { n: 4, dark: 0.5 })),
    spot: sk.m(rmp('#f1e7cc', { n: 3, dark: 0.3, at: 2 }), { noRim: true }),
  };
}

const EYE: EyeSpec = { r: 1.5, iris: hex('#e9a22c'), pupil: hex('#140c08'), lash: hex('#1c120c'), brow: hex('#2a1a12') };
const WET_HI = hex('#e6dcc8');
const WET_HI2 = hex('#b8a888');

/** swap the mud and the mud-covered fur to wet, glossy mud (call between the two resolves) */
function applyWet(sk: Sk, m: M) {
  const wetA = rmp('#33241a', { n: 6, dark: 0.6, light: 0.36 });
  const wetB = rmp('#2a1d14', { n: 6, dark: 0.6, light: 0.32 });
  const wetC = rmp('#47331f', { n: 6, dark: 0.6, light: 0.4 });
  const set = (id: number, ramp: C[], k = 1.3) => { sk.mats[id].ramp = ramp; sk.mats[id].k = k; };
  set(m.mud, wetA); set(m.mud2, wetB); set(m.crack, wetB, 1.1);
  set(m.coatW, wetA); set(m.stripeW, wetB); set(m.fadedW, wetB); set(m.creamW, wetC);
  // what stays fur is soaked: darker, slicked, higher contrast
  set(m.coat, rmp('#8a5530', { n: 7, dark: 0.62, cool: 0.32, light: 0.44 }), 1.18);
  set(m.faded, rmp('#5e3a24', { n: 6, dark: 0.56, light: 0.36 }), 1.1);
  set(m.stripe, rmp('#3a2316', { n: 5, dark: 0.5, light: 0.3 }), 1.1);
  set(m.cream, rmp('#b0966f', { n: 6, dark: 0.5, light: 0.42 }), 1.1);
  // wet glints: short bright streaks where the key light hits the curve of the mud, sparse
  const wet = new Set([m.mud, m.mud2, m.crack, m.coatW, m.stripeW, m.fadedW, m.creamW, m.wetMud]);
  const W = sk.w, H = sk.h;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 2; x++) {
      const i = y * W + x;
      const mt = sk.mat[i];
      if (!wet.has(mt) || sk.ov[i]) continue;
      const l = sk.lum[i];
      const r = hh(x >> 1, y, 91);
      if (l > 1.0 && r < 0.16) { sk.ov[i] = WET_HI; if (sk.mat[i + 1] && !sk.ov[i + 1] && r < 0.08) sk.ov[i + 1] = WET_HI2; }
      else if (l > 0.93 && r < 0.05) sk.ov[i] = WET_HI2;
    }
}

// ------------------------------------------------------------------ patterns
/** the coat's stripe value at body-local x and depth down the flank d (0 back .. 1 belly): 0 none, 1 faded, 2 dark */
function stripeAt(lx: number, d: number, seed = 0): number {
  // irregular bands: the spacing wanders, each tapers down the flank, slants back, some fork
  const x = lx + 3.2 * Math.sin(lx * 0.11 + 1) + d * 13 + d * d * 5 + Math.sin(d * 5 + lx * 0.18) * 1.2;
  const per = 8.6;
  const u = (x + 400) / per, i = Math.floor(u), f = u - i;
  const len = 0.38 + hh(i, 1, seed) * 0.42;
  if (d > len) return 0;
  const taper = 1 - d / len;
  const w = (0.18 + 0.36 * taper) * (0.75 + hh(i, 2, seed) * 0.55);
  const c = 0.5 + (hh(i, 3, seed) - 0.5) * 0.3;
  let on = Math.abs(f - c) < w * 0.5;
  if (!on && hh(i, 5, seed) < 0.45 && d > len * 0.3) on = Math.abs(f - c - 0.3 - d * 0.15) < w * 0.25;
  if (!on) return 0;
  const brk = hh(i, Math.floor(d * 7), seed + 4);
  if (brk < 0.12 && d > 0.15) return 0;
  // dark near the spine, faded lower down (and wherever old mud has stained the coat)
  return d < len * 0.62 && brk > 0.25 ? 2 : 1;
}

/** dried-mud line down the flank (depth 0..1) at body-local x: wavy, with splash tongues reaching up */
function mudLine(lx: number): number {
  let m = 0.68 + Math.sin(lx * 0.19) * 0.045 + Math.sin(lx * 0.53 + 2) * 0.025;
  // rounded splash tongues reaching up the flank
  const u = (lx + 400) / 11, i = Math.floor(u), f = u - i;
  if (hh(i, 7, 3) < 0.4) m -= (0.05 + hh(i, 8, 3) * 0.09) * Math.pow(Math.sin(f * Math.PI), 2);
  return m;
}

/** dried mud crazing: true on the crack lines (a jittered cell pattern) */
function crackAt(x: number, y: number, k: number): boolean {
  const s = 6.5 * k;
  const gx = x / s, gy = y / s;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 9, d2 = 9;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox + hh(ix + ox, iy + oy, 61), cy = iy + oy + hh(iy + oy, ix + ox, 62);
      const d = Math.hypot(gx - cx, gy - cy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  if (hh(ix, iy, 63) < 0.45) return false;
  return d2 - d1 < 0.08 / Math.max(0.7, k * 0.6);
}

// ------------------------------------------------------------------ the painter
export interface TigerOut { head: V2; eye: V2; mouth: V2; nose: V2; paw: V2; tail: V2; m: M }

/** keys keyed by joint index + fraction along the next bone -> keys keyed by arc fraction of the whole chain */
function jointKeys(chain: V2[], keys: [number, number][]): [number, number][] {
  const cum: number[] = [0];
  for (let i = 1; i < chain.length; i++) cum.push(cum[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]));
  const T = cum[cum.length - 1] || 1;
  return keys.map(([j, w]) => {
    const i = Math.min(chain.length - 2, Math.floor(j)), f = j - i;
    return [(cum[i] + (cum[i + 1] - cum[i]) * f) / T, w] as [number, number];
  });
}

/** the brain maze on the dome: meandering lines (contours of warped noise), 0 off .. 1 on the line */
function mazeAt(x: number, y: number, s: number): number {
  const wx = x + (noise2(x * 0.21 + 3.1, y * 0.21, 37) - 0.5) * 5;
  const wy = y + (noise2(x * 0.21, y * 0.21 + 7.7, 38) - 0.5) * 5;
  const n = noise2(wx / (3.4 * s), wy / (3.4 * s), 39) * 0.75 + noise2(wx / (1.8 * s), wy / (1.8 * s), 40) * 0.25;
  return 1 - Math.min(1, Math.abs(n - 0.5) / 0.16);
}

export function drawTiger(sk: Sk, P: TigerPose, k = 1, detail = 0): TigerOut {
  void detail;
  const m = mats(sk);
  sk.clipY = 0;
  const lieK = P.lie;
  const lowDrop = P.low * 9 + lieK * 7;
  const B = new Frame2([(-6 + P.bx) * k, (-34 + P.by + lowDrop + P.sink * SINK) * k], P.tilt, k);
  const invC = Math.cos(-B.a), invS = Math.sin(-B.a), invO: V2 = [0, 0];
  /** body-local coords of a pixel (a reused pair: read it at once) */
  const inv = (x: number, y: number): V2 => {
    const dx = (x - B.o[0]) / k, dy = (y - B.o[1]) / k;
    invO[0] = dx * invC - dy * invS; invO[1] = dx * invS + dy * invC;
    return invO;
  };
  const st = P.stretch, br = P.br, shake = P.shake;
  const wob = (i: number) => (shake ? Math.sin(P.t * TAU * 2 - i * 0.9) * 1.6 * shake : 0);
  const spec = new Map<number, number>();
  const wetSpec = (v: number) => { for (const id of [m.mud, m.mud2, m.crack]) spec.set(id, v); };
  wetSpec(0.05);

  // ---------------------------------------------------------------- the body's outline (body-local landmarks)
  const TOPK: [number, number][] = [
    [20 + st * 0.3, -23 - P.hump * 1.5 + wob(1)], [5, -20.2 + wob(2)], [-11, -19.8 + wob(2)], [-26, -20.8 + wob(3)],
    [-38 - st * 0.25, -22.4 + wob(4)], [-48 - st * 0.4, -17.5 + wob(4)], [-53 - st * 0.4, -10],
  ];
  const BOTK: [number, number][] = [
    [-56 - st * 0.4, -1], [-52 - st * 0.35, 10], [-39, 17], [-23, 21 + P.jig * 0.5 + br * 0.4], [-5, 24 + P.jig + br],
    [12, 23 + br * 0.6 + P.jig * 0.3], [24 + st * 0.3, 19], [33 + st * 0.4, 10],
  ];
  // depth down the flank (0 at the back, 1 at the belly) for the stripes and the mud line
  const topKeys = TOPK.slice().reverse() as [number, number][];
  const botKeys = BOTK as [number, number][];
  const topY = (lx: number) => crv(topKeys, lx);
  const botY = (lx: number) => crv(botKeys, lx);
  const depth = (lx: number, ly: number) => (ly - topY(lx)) / Math.max(4, botY(lx) - topY(lx));

  // ---------------------------------------------------------------- neck and head frames
  const N0 = B.p(26 + st * 0.5, -8);
  const nA = B.a - 0.62 + P.neck;
  const nL = 14 * k;
  const HS = 1.22;
  // (lying under the mud, the head settles low too: only the dome, the eye turrets and the nostrils break the surface)
  const Ho: V2 = [N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL + P.sink * 9 * k];
  const ha = B.a + P.neck * 0.55 + P.head + 0.06 + (shake ? Math.sin(P.t * TAU * 2) * 0.12 : 0);
  const hc = Math.cos(ha), hs = Math.sin(ha);
  const hp = (x: number, y: number): V2 => [Ho[0] + (x * hc - y * hs) * k * HS, Ho[1] + (x * hs + y * hc) * k * HS];
  const hInvO: V2 = [0, 0];
  /** head-local coords of a pixel (a reused pair: read it at once) */
  const hInv = (px: number, py: number): V2 => { const rx = (px - Ho[0]) / (k * HS), ry = (py - Ho[1]) / (k * HS); hInvO[0] = rx * hc + ry * hs; hInvO[1] = -rx * hs + ry * hc; return hInvO; };
  const HINGE: V2 = [4, 5];
  const jawA = P.jaw * 0.95;
  const jl = (x: number, y: number): V2 => rotP([x, y], HINGE, jawA);
  const jp = (x: number, y: number): V2 => { const q = jl(x, y); return hp(q[0], q[1]); };
  const jInv = (px: number, py: number): V2 => rotP(hInv(px, py), HINGE, -jawA);

  // ---------------------------------------------------------------- fur, stripes, mud
  /** short sleek hair: fine strokes along the lie of the coat (dir in radians), a little light jitter */
  const hair = (x: number, y: number, dir: number, o: Tx, amp = 0.05) => {
    const c = Math.cos(dir), s = Math.sin(dir);
    const al = (x * c + y * s) / k, ac = (-x * s + y * c) / k;
    const n = noise2(al / 2.6, ac / 0.75, 17);
    if (n > 0.66) o.t += amp; else if (n < 0.3) o.t -= amp * 1.2;
  };
  const mudTex = (x: number, y: number, o: Tx, edge: number) => {
    // dried mud: plates crazed with cracks, crumbs at the edge; shiny-dark once it is wet (applyWet)
    if (edge < 0.06) o.t += 0.06;
    // plates of dried mud, each a little raised slab with bevelled edges, cracked apart
    cell(x / k, y / k, 5.4, 4.2, 211, 0.9);
    const gap = CELL.F2 - CELL.F1;
    if (gap < 0.075 && edge > 0.04 && CELL.CI > 0.12) { o.m = m.crack; o.z -= 0.5 * k; return; }
    o.z += (Math.min(1, gap * 4) - 0.5) * 0.9 * k;
    o.m = CELL.CI < 0.6 ? m.mud : m.mud2;
    // crumbs and grit
    if (hh(Math.floor(x / k * 1.3), Math.floor(y / k * 1.3), 217) < 0.06) { o.z += 0.4 * k; o.t += 0.05; }
  };

  const bodyTex = (x: number, y: number, d: number, o: Tx) => {
    const [lx, ly] = inv(x, y);
    const dd = depth(lx, ly);
    const ml = mudLine(lx);
    // anatomy under the skin: the shoulder blade and its spine, the ribcage, the hollow of the flank,
    // the hip bone, the great haunch; folds of loose skin behind the elbow and in the flank
    let z = 0;
    z += 3.2 * gs(lx - (16 + st * 0.3), 6) * gs(ly + 9 + P.hump, 7);         // scapula
    z -= 1.2 * gs(lx - (10 + st * 0.3), 2.2) * gs(ly + 6, 6) * (1 - P.hump * 0.3); // behind the scapula
    z += 2.4 * gs(lx + 6, 15) * gs(ly - 5, 8);                              // ribcage barrel
    z += 0.5 * Math.sin((lx + 40) / 4.1) * gs(lx + 2, 9) * gs(ly - 4, 5);   // ribs reading through
    z -= 1.8 * gs(lx + 27, 4) * gs(ly - 3, 6);                              // flank hollow
    z += 2.0 * gs(lx + 37, 3.5) * gs(ly + 14, 3.5);                          // point of the hip
    z += 4.0 * gs(lx + 42, 9) * gs(ly + 2, 10);                              // haunch
    // a heavy skin fold curving down behind the elbow, and the flank fold
    const f1 = Math.abs((lx - (8 + st * 0.3)) - (ly - 6) * 0.25 + Math.sin(ly * 0.5) * 0.6);
    if (f1 < 1.2 && ly > -4 && ly < 18) { z -= 1.0 * (1 - f1 / 1.2); o.t -= 0.05; }
    const f2 = Math.abs((lx + 30) + (ly - 8) * 0.55);
    if (f2 < 1.1 && ly > 2 && ly < 16) { z -= 0.8 * (1 - f2 / 1.1); o.t -= 0.04; }
    o.z = z * k;
    // under the mud line: caked mud
    if (dd > ml) { mudTex(x, y, o, dd - ml); return; }
    const W = dd > 0.17 + Math.sin(lx * 0.4) * 0.04;
    // countershading: a darker saddle, paler down the flank, cream at the belly and inside the chest
    if (dd < 0.3) o.t -= (0.3 - dd) * 0.3;
    o.t -= 0.12 * cl((dd - 0.35) / 0.5);
    hair(x, y, B.a + Math.PI - 0.25 - dd * 0.9, o, 0.045);
    const s = stripeAt(lx + (noise2(lx / 3, ly / 3, 9) - 0.5) * 1.6, dd);
    if (dd > 0.78 && lx > 4) { o.m = W ? m.creamW : m.cream; return; }
    o.m = s === 2 ? (W ? m.stripeW : m.stripe) : s === 1 ? (W ? m.fadedW : m.faded) : W ? m.coatW : m.coat;
    void d;
  };

  // ---------------------------------------------------------------- legs
  const lk = 1 - P.low * 0.35;
  interface LegG { chain: V2[]; paw: V2; pawA: number; lifted: boolean; front: boolean; near: boolean }
  let pawNear: V2 = [0, 0];
  const legGeom = (which: number): LegG => {
    const front = which < 2, near = which % 2 === 0;
    const top = front ? B.p(17 + st * 0.3, -17 - P.hump * 1.2) : B.p(-40 - st * 0.25, -15);
    const hip = front ? B.p(24 + st * 0.3, 2) : B.p(-40 - st * 0.25, -2);
    const restX = front ? 15 : -36;
    let foot: V2 = [(restX + P.bx + P.feet[which][0] + (near ? 0 : front ? -4 : 3)) * k, Math.min(0, P.feet[which][1]) * k];
    let lifted = P.feet[which][1] < -0.5;
    let ang = 0;
    if (front && (near ? P.reach : P.reachF) > 0) {
      const r = near ? P.reach : P.reachF;
      const tgt = near ? B.p(50 + r * 14, 14 - r * 5) : B.p(47 + r * 12, 15 - r * 4);
      foot = [foot[0] + (tgt[0] - foot[0]) * r, foot[1] + (tgt[1] - foot[1]) * r];
      lifted = true; ang = -0.5 * r;
    }
    if (front && near && P.swipe > -8) {
      // the wind-up raises the paw high in front of the chest, the strike swings it down and forward
      const sh = B.p(20, -3), len = 29 * k;
      const a = P.swipe < 0 ? Math.PI * 0.5 - P.swipe * 0.3 : P.swipe;
      foot = [sh[0] + Math.sin(a) * len, sh[1] + Math.cos(a) * len];
      lifted = true; ang = -a * 0.45;
    }
    if (!front && P.tuck > 0) {
      const tgt = B.p(-18, 18);
      foot = [foot[0] + (tgt[0] - foot[0]) * P.tuck, foot[1] + (tgt[1] - foot[1]) * P.tuck];
      lifted = true;
    }
    if (lieK > 0.01) {
      const tgt = front ? B.p(near ? 44 : 40, 12) : B.p(near ? -20 : -24, 12);
      foot = [foot[0] + (tgt[0] - foot[0]) * lieK, foot[1] + (tgt[1] - foot[1]) * lieK];
      ang = front ? -0.08 : 0;
    }
    // the bones: upper arm / thigh, forearm / shin, the short pastern / long hock
    const l1 = (front ? 15 * lk + 3.5 : 15 * lk + 4) * k, l2 = (front ? 13 : 12.5) * k, l3 = (front ? 5 : 9) * k;
    const footAng = front ? -Math.PI / 2 - 0.12 - (lifted ? 0.45 : 0) + ang * 0.5 : -Math.PI / 2 - 0.62 + ang * 0.3;
    const pawTop: V2 = [foot[0] + Math.cos(ang - Math.PI / 2) * 3.5 * k, foot[1] + Math.sin(ang - Math.PI / 2) * 3.5 * k];
    const ankle: V2 = [pawTop[0] + Math.cos(footAng) * l3, pawTop[1] + Math.sin(footAng) * l3];
    const [knee, end] = ik2(hip, ankle, l1, l2, front ? 1 : -1);
    return { chain: [top, hip, knee, end, pawTop], paw: foot, pawA: ang, lifted, front, near };
  };
  /** the paw: a broad mud-shoe of four splayed, webbed toes; claws out when they are needed */
  const pawPts = (g: LegG): V2[] => {
    const s = g.front ? 1 : 0.92, a = g.pawA, c = Math.cos(a), sn = Math.sin(a);
    const P2 = (x: number, y: number): V2 => [g.paw[0] + (x * c - y * sn) * k * s, g.paw[1] + (x * sn + y * c) * k * s];
    const spread = g.lifted ? 0.3 : 1;
    const sp = spread, nd = 1.0 + sp * 0.5;
    const raw: [number, number][] = [
      [-4.8, -4.4], [-5.9, -2.0], [-4.6, -0.2], [-2.6, 0], [-0.5, -0.2], [0.3, -nd], [1.0, 0], [3.2, 0], [3.9, -nd], [4.6, 0], [6.8, 0],
      [7.5, -nd * 0.95], [8.3, 0], [10.4 + sp * 0.4, -0.3], [11.1 + sp * 0.4, -1.8], [10.3 + sp * 0.2, -3.4], [9.1, -3.7], [8.2, -3.2],
      [6.8, -4.5], [5.6, -3.9], [4.0, -5.1], [2.6, -6.2],
    ];
    return raw.map(([x, y]) => P2(x, y));
  };
  const drawLeg = (L: Lay, g: LegG, id: number, zBase: number) => {
    const ch = g.chain;
    // half-widths at the landmarks (joint index + fraction): back of the leg (A), front (B)
    const A = g.front
      ? jointKeys(ch, [[0, 7.5], [0.6, 9.5], [1, 10.5], [1.45, 10], [1.85, 8.6], [2, 7.6], [2.3, 6.4], [2.75, 4.9], [3, 4.4], [3.4, 4.6], [4, 4.4]])
      : jointKeys(ch, [[0, 12], [0.6, 14.5], [1, 15.5], [1.4, 13.5], [1.8, 9.5], [2, 7.6], [2.35, 7.2], [2.75, 4.8], [3, 4.6], [3.25, 3.7], [3.7, 3.5], [4, 4.2]]);
    const Bw = g.front
      ? jointKeys(ch, [[0, 6], [0.7, 8.5], [1, 9.4], [1.35, 7.4], [1.8, 6.4], [2, 6.4], [2.35, 6.8], [2.75, 4.8], [3, 4.0], [3.5, 4.2], [4, 4.2]])
      : jointKeys(ch, [[0, 9], [0.6, 11], [1, 12], [1.5, 10], [1.85, 7.2], [2, 6.8], [2.4, 5.0], [2.8, 4.0], [3, 3.8], [3.5, 3.7], [4, 4.2]]);
    const AK = A.map(([s, w]) => [s, w * k] as [number, number]), BK = Bw.map(([s, w]) => [s, w * k] as [number, number]);
    const tip = pawPts(g);
    // limbOutline gives side A (left of travel: the back of a right-facing leg) down, the tip, side B up
    let ol = limbOutline(ch, AK, BK, [], 30);
    // splice the paw in between the two sides
    const half = Math.floor(ol.length / 2);
    ol = spline([...ol.slice(0, half), ...tip, ...ol.slice(half)], true, 2);
    // fur breaking the edge at the elbow and the back of the thigh
    const elbow = ch[2];
    ol = fringe(densify(ol, 1.2 * k), p => {
      const de = Math.hypot(p[0] - elbow[0], p[1] - elbow[1]) / k;
      return g.front ? cl(1 - de / 6) : cl(1 - Math.abs(p[1] - ch[1][1]) / (8 * k)) * (p[0] < ch[1][0] - 6 * k ? 1 : 0) * 0.7;
    }, 1.3 * k, 2.6 * k, 31 + (g.front ? 1 : 2), -0.4);
    // depth: the top runs back into the body, the rest stands in front of it
    const cum: number[] = [0];
    for (let i = 1; i < ch.length; i++) cum.push(cum[i - 1] + Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1]));
    const total = cum[cum.length - 1];
    const sOf = (x: number, y: number) => {
      let best = 1e9, bs = 0;
      for (let i = 1; i < ch.length; i++) {
        const ax = ch[i - 1][0], ay = ch[i - 1][1], dx = ch[i][0] - ax, dy = ch[i][1] - ay, l2 = dx * dx + dy * dy || 1;
        const t = cl(((x - ax) * dx + (y - ay) * dy) / l2);
        const ex = x - ax - dx * t, ey = y - ay - dy * t, d2 = ex * ex + ey * ey;
        if (d2 < best) { best = d2; bs = (cum[i - 1] + Math.sqrt(l2) * t) / total; }
      }
      return bs;
    };
    const sElbow = cum[2] / total, sWrist = cum[3] / total;
    const near = g.near;
    shape(L, ol, {
      R: (g.front ? 7 : 9) * k, hs: 0.9, id, blend: 3 * k,
      z0: (x, y) => { const s = sOf(x, y); return zBase + (near ? (-15 + 15 * (g.front ? ss(0.08, 0.3, s) : ss(0.02, 0.2, s))) * k : 0); },
      tex: (x, y, d, o) => {
        const s = sOf(x, y);
        // muscle and bone: the deltoid / quadriceps at the top, the elbow / knee, the forearm / calf
        // bellies, the knobs of the wrist and the point of the hock, tendons down the cannon
        const sk2 = (s - sElbow) * total / k;
        o.z = (g.front ? 1.6 * gs(sk2 + 7, 3.5) + 1.4 * gs(sk2, 1.8) + 1.2 * gs(sk2 - 4, 3) + 0.8 * gs((s - sWrist) * total / k, 1.2)
          : 2.2 * gs(sk2 + 9, 4) + 1.4 * gs(sk2, 1.6) + 1.6 * gs(sk2 - 3.5, 2.5) + 1.2 * gs((s - sWrist) * total / k, 1.2)) * k;
        // mud socks from the elbow / hock down, ragged at the top; the paw caked
        const mudTop = sElbow + (g.front ? 0.04 : 0.1) + (noise2(x / (2.2 * k), y / (2.2 * k), g.front ? 61 : 62) - 0.5) * 0.12;
        // paw-local coordinates (x forward along the sole, y up negative)
        const pc = Math.cos(-g.pawA), pn = Math.sin(-g.pawA), rx = (x - g.paw[0]) / k, ry = (y - g.paw[1]) / k;
        const px = rx * pc - ry * pn, py = rx * pn + ry * pc;
        const onPaw = s > 0.8 && py > -6.6 && px > -7 && px < 13;
        if (s > mudTop || onPaw) {
          mudTex(x, y, o, s - mudTop);
          // the toes: creases between them, the pads underneath, the webbing
          if (onPaw) {
            const tx = px / (g.front ? 1 : 0.92);
            for (const cx of [0.3, 3.9, 7.5]) if (Math.abs(tx - cx - (py + 1.2) * 0.3) < 0.5 && py > -4.4) { o.t -= 0.16; o.z -= 0.7 * k; if (!g.lifted && py > -1.8) o.m = m.skin; }
            // each toe a rounded knuckle
            o.z += 0.6 * k * Math.sin(frc((tx + 3.3) / 3.6) * Math.PI) * (py < -2 ? 1 : 0.4);
            if (py > -1.1 && tx < -1.5) { o.m = m.skin; o.t -= 0.04; }
          }
          return;
        }
        // fur: bands across the upper limb, the coat's lie running down the leg
        const along = s * total / k;
        const band = frc(along / (g.front ? 5.6 : 6.4) + 0.3);
        o.m = band < 0.28 && hh(Math.floor(along / 6), g.front ? 1 : 2, 33) > 0.3 && s > 0.18 ? m.fadedW : m.coatW;
        if (!g.front && s < 0.3) {
          // the haunch carries the body's stripes
          const [lx, ly] = inv(x, y);
          const sAt = stripeAt(lx, cl(depth(lx, ly)));
          if (sAt) o.m = sAt === 2 ? m.stripeW : m.fadedW;
        }
        const ci = ch[Math.min(3, Math.floor(s * 4))], cj = ch[Math.min(4, Math.floor(s * 4) + 1)];
        hair(x, y, Math.atan2(cj[1] - ci[1], cj[0] - ci[0]), o, 0.05);
        o.t -= near ? 0 : 0.02;
      },
    });
    // claws: hooked, pale horn, out of the toe tips when it means it
    if (P.claws > 0.05) {
      const s = g.front ? 1 : 0.92, a = g.pawA, c = Math.cos(a), sn = Math.sin(a);
      const P2 = (x: number, y: number): V2 => [g.paw[0] + (x * c - y * sn) * k * s, g.paw[1] + (x * sn + y * c) * k * s];
      for (const tx of [2.2, 5.9, 9.6]) {
        const L0 = 1.6 + P.claws * 2.4;
        const ca = 0.55 + (g.lifted ? 0.15 : 0);
        const base = P2(tx + 0.6, -1.9), mid = P2(tx + 0.6 + Math.cos(ca - 0.5) * L0 * 0.6, -1.9 + Math.sin(ca - 0.5) * L0 * 0.6), tp = P2(tx + 0.6 + Math.cos(ca) * L0, -1.9 + Math.sin(ca) * L0 + 0.4);
        const cw = 0.75 * k;
        const ol2 = spline([[base[0] - cw, base[1] - cw * 0.6], [mid[0], mid[1] - cw * 0.5], tp, [mid[0] - cw * 0.3, mid[1] + cw * 0.4], [base[0] - cw * 0.4, base[1] + cw]], true, 3);
        shape(L, ol2, { R: 0.8 * k, z0: zBase + 12 * k, id: id + 10, tex: (_x, _y, _d, o) => { o.m = m.claw; } });
      }
    }
    if (g.front && g.near) pawNear = [g.paw[0] + 5 * k, g.paw[1] - 2 * k];
  };

  const legsG = [0, 1, 2, 3].map(legGeom);
  /** a layer just big enough for what it will hold (points plus a margin), so frames paint fast */
  const layAround = (pts: V2[], pad: number) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    return new Lay(sk, x0 - pad, y0 - pad, x1 + pad, y1 + pad);
  };
  const legPts = (g: LegG): V2[] => [...g.chain, g.paw];
  // ---------------------------------------------------------------- the far legs (behind the body)
  if (P.sink < 0.98) {
    sk.np();
    const L = layAround([...legPts(legsG[1]), ...legPts(legsG[3])], 20 * k);
    drawLeg(L, legsG[1], 1, -10 * k);
    drawLeg(L, legsG[3], 21, -10 * k);
    L.emit({ bias: -0.22, drop: 3 * k, ao: 0.05, aoR: 3, spec, specP: 12, contrast: 1.2 });
  }

  // ---------------------------------------------------------------- the tail: thick, muscular, a sculling rudder
  let tailTip: V2;
  {
    sk.np();
    const tb = B.p(-50 - st * 0.4, -6);
    const ta = B.ang(Math.PI * 0.72 - P.tail * 0.9);
    const wv = Math.sin(P.tailWave * TAU) * 3;
    const c1: V2 = [tb[0] + Math.cos(ta) * 16 * k, tb[1] + Math.sin(ta) * 16 * k];
    const c2: V2 = [c1[0] - 12 * k, c1[1] + (8 - P.tail * 12 + wv) * k];
    const tipA = Math.PI + 0.3 - P.tailCurl * 1.6 + P.tail * 0.4;
    tailTip = [c2[0] + Math.cos(tipA) * 12 * k, c2[1] + Math.sin(tipA) * 12 * k];
    const tPts = cbez(tb, c1, c2, tailTip, 10);
    const ol = limbOutline(tPts, [[0, 8.5 * k], [0.3, 6.8 * k], [0.7, 4.6 * k], [0.95, 3.4 * k], [1, 2.4 * k]], [[0, 8.5 * k], [0.3, 6.6 * k], [0.7, 4.4 * k], [0.95, 3.2 * k], [1, 2.4 * k]],
      [[tailTip[0] + Math.cos(tipA) * 1.6 * k, tailTip[1] + Math.sin(tipA) * 1.6 * k]], 24);
    const L = layAround(tPts, 12 * k);
    const tcum: number[] = [0];
    for (let i = 1; i < tPts.length; i++) tcum.push(tcum[i - 1] + Math.hypot(tPts[i][0] - tPts[i - 1][0], tPts[i][1] - tPts[i - 1][1]));
    const tT = tcum[tcum.length - 1];
    shape(L, spline(ol, true, 2), {
      R: 6.5 * k, id: 1, tex: (x, y, d, o) => {
        let best = 1e9, bs = 0, side = 0;
        for (let i = 1; i < tPts.length; i++) {
          const ax = tPts[i - 1][0], ay = tPts[i - 1][1], dx = tPts[i][0] - ax, dy = tPts[i][1] - ay, l2 = dx * dx + dy * dy || 1;
          const t = cl(((x - ax) * dx + (y - ay) * dy) / l2);
          const ex = x - ax - dx * t, ey = y - ay - dy * t, d2 = ex * ex + ey * ey;
          if (d2 < best) { best = d2; bs = (tcum[i - 1] + Math.sqrt(l2) * t) / tT; side = dx * ey - dy * ex; }
        }
        // rings, darkening to the tip; the underside dragged through the mud
        const ring = frc(bs * 6.4 + 0.15);
        hair(x, y, Math.atan2(tailTip[1] - tb[1], tailTip[0] - tb[0]), o, 0.05);
        if (side < 0 && bs < 0.8 && d < 3.2 * k) { mudTex(x, y, o, d / k); return; }
        o.m = bs > 0.9 ? m.stripe : bs > 0.18 && ring < 0.34 ? (bs > 0.55 ? m.stripe : m.faded) : m.coatW;
        o.z = (bs < 0.2 ? 1.5 * (1 - bs / 0.2) : 0) * k;
      },
    });
    L.emit({ bias: -0.1, drop: 3 * k, ao: 0.05, spec, specP: 12, contrast: 1.2 });
  }

  // ---------------------------------------------------------------- the torso and neck, with the near legs
  const LB = layAround([...TOPK.map(([x, y]) => B.p(x, y)), ...BOTK.map(([x, y]) => B.p(x, y)), hp(-8, -16), hp(14, 14), ...legPts(legsG[0]), ...legPts(legsG[2])], 22 * k);
  sk.np();
  {
    // the neck's outline joins the body's: crest up to the nape, dewlap down to the throat
    const nape = hp(-3, -12), throat = hp(3, 11);
    const withers = B.p(TOPK[0][0], TOPK[0][1]);
    const brisket = B.p(BOTK[BOTK.length - 1][0], BOTK[BOTK.length - 1][1]);
    const crest: V2 = [(withers[0] + nape[0]) / 2 + Math.cos(nA - Math.PI / 2) * 2.5 * k, (withers[1] + nape[1]) / 2 + Math.sin(nA - Math.PI / 2) * 2.5 * k];
    const dew: V2 = [(brisket[0] + throat[0]) / 2 + Math.cos(nA + Math.PI / 2) * 3.5 * k, (brisket[1] + throat[1]) / 2 + Math.sin(nA + Math.PI / 2) * 3.5 * k];
    const pts: V2[] = [hp(8, -12), nape, crest, ...TOPK.map(([x, y]) => B.p(x, y)), ...BOTK.map(([x, y]) => B.p(x, y)), dew, throat, hp(12, 8)];
    let ol = spline(pts, true, 4);
    // short fur fringing the belly line and the dewlap
    ol = fringe(densify(ol, 1.2 * k), p => {
      const [lx, ly] = inv(p[0], p[1]);
      const belly = ly > 10 && lx > -40 && lx < 30 ? 1 : 0;
      const dewl = Math.hypot(p[0] - dew[0], p[1] - dew[1]) < 9 * k ? 0.8 : 0;
      return Math.max(belly, dewl);
    }, 1.4 * k, 2.4 * k, 41, -0.5);
    const neckTex = (x: number, y: number, d: number, o: Tx) => {
      const hx = x - N0[0], hy = y - N0[1];
      const across = (hy * Math.cos(nA) - hx * Math.sin(nA)) / k; // + = under the neck
      const u = (hx * Math.cos(nA) + hy * Math.sin(nA)) / k;
      // the neck's thick muscle and the heavy folds of the dewlap
      o.z = (2 * gs(across + 5, 4) - 0.8 * (frc((u + across * 0.3) / 4.2) < 0.2 && across > 3 ? 1 : 0)) * k;
      if (across > 7.5 + Math.sin(u * 0.7) * 1.2) { mudTex(x, y, o, (across - 7.5) / 10); return; }
      hair(x, y, nA + Math.PI - 0.6, o, 0.045);
      if (across < -3 && frc((u + 30) / 5.4) < 0.3 && hh(Math.floor((u + 30) / 5.4), 2, 27) > 0.25) o.m = across < -7 ? m.stripe : m.faded;
      else o.m = across > 2 ? m.creamW : m.coatW;
      if (across < -8) o.t -= 0.05;
      void d;
    };
    shape(LB, ol, {
      R: 24 * k, hs: 0.95, id: 1, blend: 4 * k,
      tex: (x, y, d, o) => {
        const [lx] = inv(x, y);
        if (lx > 27 + st * 0.4) { neckTex(x, y, d, o); if (lx < 34) { const t: Tx = { z: 0, m: 0, t: 0 }; bodyTex(x, y, d, t); const f = (lx - 27) / 7; o.z = o.z * f + t.z * (1 - f); } return; }
        bodyTex(x, y, d, o);
      },
    });
  }
  // the near legs, merging into the body at the shoulder and the haunch
  if (P.sink < 0.98) {
    drawLeg(LB, legsG[2], 40, 22 * k);
    drawLeg(LB, legsG[0], 60, 21 * k + Math.max(P.reach, P.swipe > -8 ? 1 : 0) * 24 * k);
  }
  LB.emit({ bias: -0.1, drop: 3.2 * k, ao: 0.045, aoR: 3, seam: 2 * k, spec, specP: 12, contrast: 1.25 });

  // ---------------------------------------------------------------- the head: one sculpted form
  const earUp = Math.max(0, P.ear), earFlat = Math.max(0, -P.ear);
  const LH = layAround([hp(-10, -32), hp(42, -32), hp(42, 16), hp(-10, 16), jp(-4, 16), jp(36, 16), jp(36, 4)], 6 * k);
  sk.np();
  // the far ear first
  const earShape = (L: Lay, bx: number, by: number, near: boolean, id: number) => {
    const a = -1.85 + earUp * 0.25 - earFlat * 1.05 + (shake ? Math.sin(P.t * TAU * 4) * 0.4 : 0);
    const len = 6.2 - earFlat * 2.6, wid = 3.6 - earFlat * 0.8;
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    const E = (u: number, w: number): V2 => hp(bx + ca * u + nx * w, by + sa * u + ny * w);
    const ol = spline([E(-1, -wid), E(len * 0.55, -wid * 1.05), E(len, -wid * 0.35), E(len * 1.04, wid * 0.2), E(len * 0.6, wid * 0.95), E(-1, wid * 0.9)], true, 4);
    shape(L, ol, {
      R: 1.6 * k, z0: near ? 16 * k : -3 * k, id, tex: (x, y, d, o) => {
        const [ex, ey] = hInv(x, y);
        const u = ((ex - bx) * ca + (ey - by) * sa) / len, w = ((ex - bx) * nx + (ey - by) * ny) / wid;
        // the back of the ear black with the white spot every tiger has; the rim furred
        o.m = u > 0.55 ? m.earBack : near && u > 0.22 && u < 0.62 && Math.abs(w) < 0.45 ? (earFlat >= 0.5 ? m.spot : m.earIn) : m.coat;
        if (!near) o.t -= 0.08;
        o.z = -0.6 * gs(w, 0.35) * (1 - earFlat) * k;
        void d;
      },
    });
  };
  earShape(LH, -1.5, -14.5, false, 3);
  // the head's outline: occiput, the high domed brow, the eye turret, the stop, the bridge with the
  // nostrils on top, the nose, the whisker pad, the flews; and the lower jaw (or the hinge when it gapes)
  const open = P.jaw > 0.1;
  const upperPts: [number, number][] = [
    [-6, 2], [-6, -5], [-4.6, -12], [-0.5, -18.6], [5.5, -23], [12, -22.6], [16.4, -19.4],
    [18.6, -16.8], [20.2, -17.2], [22.4, -16.6], [23.8, -14.2],
    [25.2, -11.8], [28.2, -10.9], [30.2, -11.7 + P.nos * 0.4], [31.8, -11.1],
    [33.8, -9.0], [35.4, -6.2], [35.7, -3.0], [34.9, 0.4], [33.0, 3.4], [29.2, 5.2], [23, 5.8 - P.snarl * 0.8], [16, 6.3],
  ];
  const closedJaw: [number, number][] = [[27.4, 6.6], [27.6, 8.4], [25.6, 10.6], [19, 12.0], [9, 12.6], [2.5, 11.6], [-2.6, 9.2]];
  const upperOl = spline((open ? [...upperPts, [9, 6.4], [HINGE[0], HINGE[1]], [0.5, 8.4], [-3.5, 7.6]] : [...upperPts, ...closedJaw]).map(([x, y]) => hp(x, y)) as V2[], true, 4);
  // the cheek ruff breaks the outline behind the jaw
  const ruffed = fringe(densify(upperOl, 1.1 * k), p => { const [x, y] = hInv(p[0], p[1]); return x < 4 && y > 0 ? 1 : x < -2 ? 0.4 : 0; }, 1.1 * k, 2.0 * k, 51, 0.5);
  const EYE_C: V2 = [21.2, -13.4];
  const headTex = (hx: number, hy: number, d: number, o: Tx, jaw: boolean) => {
    const nz = hh(Math.floor(hx), Math.floor(hy * 0.5), 57) * 0.9;
    // sculpture: the dome, the eye turret's bony ring, the cheekbone, the jaw muscle, the whisker pad,
    // the nose leather, the nostril mounds, the brow over the eye
    let z = 0;
    z += 3.4 * gs(hx - 7, 6.5) * gs(hy + 14, 5);
    const de = Math.hypot(hx - EYE_C[0], hy - EYE_C[1]);
    z += 2.0 * gs(de - 2.5, 0.8) - 1.2 * gs(de, 1.2);
    z += 1.4 * gs(hy + 5.4 - (hx - 16) * 0.12, 1.0) * ss(3, 8, hx) * (1 - ss(16, 20, hx));
    z += 2.8 * gs(hx - 7, 4.2) * gs(hy - 3, 3.5);
    z += 2.4 * gs(hx - 30.4, 3) * gs(hy - 1.0, 2.6);
    z += 1.6 * gs(hx - 34.2, 1.6) * gs(hy + 4.5, 1.8);
    z += 1.2 * gs(hx - 30.2, 1.3) * gs(hy + 11.0, 0.9);
    z -= 1.0 * gs(hx - 24.6, 1.6) * gs(hy + 11, 2);
    // the form turns away underneath: the light falls off down the head
    o.t -= 0.07 * cl((hy + 6) / 16, -0.6, 1);
    // the snarl wrinkles the bridge
    if (P.snarl > 0.35 && hx > 23 && hx < 30 && hy < -6 && hy > -10.5 && frc((hx + hy * 0.3) / 1.6) < 0.3) { z -= 0.7; o.t -= 0.12; }
    o.z = z * k;
    // the nostrils: slits on top of the snout, pinched shut or open
    if (Math.abs(hx - 30.2) < 1.5 && Math.abs(hy + 11.2 + (hx - 30.2) * 0.2) < (P.nos > 0.5 ? 0.25 : 0.6)) { o.m = m.skin; o.t -= 0.25; return; }
    // the nose leather
    if (hx > 32.6 && hy < -1.0 && hy > -9.4 + (hx - 32.6) * 0.62) { o.m = m.skin; o.t += 0.04; return; }
    // the throat and the underside of the jaw: caked mud
    if (hy > 10.4 + Math.sin(hx * 0.8) * 0.8 + ss(10, 24, hx) * 2 && hx > -2) { mudTex(hx * k, hy * k, o, (hy - 10.4) / 4); return; }
    // the lips: a dark line
    if (!jaw && hx > 12 && hx < 34 && Math.abs(hy - crvLip(hx)) < 0.42) { o.m = m.skin; o.t -= 0.06; return; }
    // the closed lower jaw under the lip: a white chin, shadowed underneath
    if (!jaw && hx > 9 && hy > crvLip(Math.max(12, hx))) { o.m = m.creamW; o.t -= 0.1 + 0.1 * cl((hy - 7) / 4); return; }
    if (jaw) {
      // the lower jaw: a white chin, the lip dark, mud underneath
      o.m = hx > 22 ? m.creamW : m.creamW;
      if (hx < 20 && frc((hx + hy * 0.4) / 3.4) < 0.25 && hy > 7.5) o.m = m.fadedW;
      return;
    }
    // the whisker pad: puffed, pale, with rows of dark whisker spots
    const pad = ((hx - 30.4) / 5.6) ** 2 + ((hy - 0.9) / 4.5) ** 2;
    if (pad < 1 + nz * 0.15) {
      if (hy > -2.4 && hy < 3.0 && hx > 26 && hx < 33 && (Math.floor(hx * 0.95) + Math.floor(hy * 0.9)) % 3 === 0 && hh(Math.floor(hx), Math.floor(hy), 51) < 0.65) { o.m = m.fadedW; return; }
      o.m = m.creamW; return;
    }
    // pale brow over the eye and a pale crescent under it
    if (((hx - 19.4) / 2.6) ** 2 + ((hy + 16.9) / 1.2) ** 2 < 1 || ((hx - 21.6) / 2.2) ** 2 + ((hy + 10.6) / 0.8) ** 2 < 1) { o.m = m.cream; return; }
    // the dark tear line from the eye's front corner down toward the lip
    if (Math.abs((hx - 23.4) + (hy + 11) * 0.45) < 0.6 && hy > -11.6 && hy < -3) { o.m = m.stripe; return; }
    // the dome: a maze of dark lines, uncannily like a brain (hence the folk name), raised between them
    const domeLine = -6.5 - (hx + 4) * 0.34;
    if (hy < domeLine && hx < 22) {
      const mz = mazeAt(hx, hy, 1);
      const edge = cl((domeLine - hy) / 3);
      o.z += (0.45 - mz) * 0.9 * k * edge;
      if (mz > 0.2 + (1 - edge) * 0.4) { o.m = edge < 0.5 ? m.faded : m.stripe; o.t -= 0.06; return; }
      o.t += 0.07;
      o.m = m.coat; return;
    }
    // the bridge: plain, with short bars at the stop
    if (hx > 22 && hy < -4.2) {
      if (hy < -8.6 && hx < 28 && hx > 24 && frc((hx - 22) / 1.9) < 0.38) { o.m = m.faded; return; }
      o.m = m.coat; hair(hx * k, hy * k, ha + Math.PI, o, 0.04); return;
    }
    if (hx > 22) { o.m = m.coatW; return; }
    // the cheek: the white jowl below the cheekbone, crossed by black stripes sweeping back from the eye
    const cheekLine = -3.6 - (hx - 4) * 0.06 + nz * 0.6;
    const u = (hy + 0.42 * hx + 40) / 3.3, i = Math.floor(u);
    if (u - i < 0.34 && i % 2 === 0 && hx > -5 && hx < 16 && hy > -7.5 && hy < 6 - Math.max(0, hx - 6) * 0.5) { o.m = hy > 3.5 ? m.stripeW : m.stripe; return; }
    if (hy > cheekLine) { o.m = hy > 3.5 ? m.creamW : m.cream; hair(hx * k, hy * k, ha + Math.PI + 0.5, o, 0.035); return; }
    o.m = hy > -3 ? m.coatW : m.coat;
    hair(hx * k, hy * k, ha + Math.PI + 0.2, o, 0.04);
    void d;
  };
  // the lip line (head units)
  const LIP: Keys = [[12, 6.2], [16, 6.3], [23, 5.8 - P.snarl * 0.8], [29.2, 5.2], [33, 3.4]];
  function crvLip(x: number) { return crv(LIP, x); }
  shape(LH, ruffed, {
    R: 10 * k, hs: 0.95, id: 1, blend: 2 * k, z0: 8 * k,
    tex: (x, y, d, o) => { const [hx, hy] = hInv(x, y); headTex(hx, hy, d, o, false); },
  });
  if (open) {
    // the open mouth: the palate's ridges going back into the dark throat, the gums, the thick tongue
    const mouthPts: V2[] = [hp(HINGE[0], HINGE[1]), hp(16, 6.3), hp(23, 5.8 - P.snarl * 0.8), hp(29.2, 5.2), hp(31.4, 5.8), jp(28.4, 6.8), jp(22, 6.9), jp(14, 6.6)];
    shape(LH, spline(mouthPts, true, 4), {
      R: 3 * k, z0: 2 * k, id: 4, tex: (x, y, d, o) => {
        const [hx, hy] = hInv(x, y);
        const [jx, jy] = jInv(x, y);
        const dh = Math.hypot(hx - HINGE[0], hy - HINGE[1]);
        const back = cl(1 - (hx - HINGE[0]) / 18);
        // the gullet, going black at the back
        const gR = 4.5 + P.jaw * 3.5;
        if (dh < gR) { o.m = m.mouth; o.t -= 0.32 * (1 - dh / gR) + 0.06; return; }
        // the upper gum along the lip, a row of cheek teeth in it
        const lipU = crvLip(hx);
        if (hy < lipU + 1.1) { o.m = hy > lipU + 0.45 && hx > 11 && hx < 23 && frc(hx / 1.7) < 0.55 ? m.tooth : m.gum; return; }
        // the lower gum and teeth along the jaw
        if (jy > 6.0 && jx > 8) { o.m = jy > 6.2 && jx > 11 && jx < 24 && frc(jx / 1.8) < 0.5 ? m.tooth : m.gum; return; }
        // the thick tongue lying on the floor of the mouth, lit along its top, grooved down the middle
        const tTop = 4.6 - gs(jx - 17, 6) * 1.8;
        if (jy > tTop && jx > 6 && jx < 27) { o.m = m.tongue; o.z = 1.4 * k * gs(jy - tTop - 0.9, 1); if (Math.abs(jy - tTop - 0.8) < 0.22 && jx > 10) o.t -= 0.12; else if (jy < tTop + 0.5) o.t += 0.06; return; }
        // the palate: ridged across, wet, going dark toward the throat
        o.m = m.mouth; o.t -= back * 0.14;
        if (frc((hx + (hy - lipU) * 0.35) / 2.1) < 0.32) { o.t -= 0.09; o.z = -0.3 * k; } else o.t += 0.05;
        void d;
      },
    });
    // the lower jaw
    const jawOl = spline([[HINGE[0] - 0.5, HINGE[1] + 0.5], [14, 6.6], [22, 6.9], [28.4, 6.8], [29.4, 8.8], [27.4, 11.6], [20, 13.2], [9, 13.4], [2.6, 11.8], [-1.4, 9]].map(([x, y]) => jp(x, y)) as V2[], true, 4);
    shape(LH, jawOl, {
      R: 4.5 * k, z0: 6 * k, id: 5, tex: (x, y, d, o) => {
        const [jx, jy] = jInv(x, y);
        if (jy > 10.4 + Math.sin(jx * 0.8) * 0.8 + ss(10, 24, jx) * 2) { mudTex(jx * k, jy * k, o, (jy - 10.4) / 4); return; }
        if (jy < 7.4 && jx > 10) { o.m = m.skin; o.t -= 0.04; return; }
        headTex(jx, jy, d, o, true);
        o.z = 1.4 * gs(jx - 6, 3.5) * gs(jy - 9, 2.5) * k;
      },
    });
  }
  // teeth: the upper canines show under the lip even at rest; more when it snarls or gapes
  {
    const fang = (base: V2, dir: number, len: number, w: number, id: number) => {
      const c = Math.cos(dir), s = Math.sin(dir), nx = -s, ny = c;
      const P2 = (u: number, v: number): V2 => [base[0] + (c * u + nx * v) * k, base[1] + (s * u + ny * v) * k];
      const ol = spline([P2(0, -w), P2(len * 0.5, -w * 0.8 - 0.15), P2(len, 0.25), P2(len * 0.55, w * 0.6), P2(0, w)], true, 3);
      shape(LH, ol, { R: 0.9 * k, z0: 14 * k, id, tex: (_x, _y, _d, o) => { o.m = m.tooth; } });
    };
    const clen = 2.4 + P.snarl * 1.6 + P.jaw * 2.4;
    const ub = hp(25.4, 5.5 - P.snarl * 0.7);
    fang(ub, ha + Math.PI / 2 + 0.12, clen, 0.95, 6);
    if (open) {
      const lb = jp(27.2, 7.0);
      fang(lb, ha + jawA - Math.PI / 2 - 0.2, 2.0 + P.jaw * 1.4, 0.85, 7);
      for (let i = 0; i < 3; i++) { const q = hp(29.6 + i * 1.0, 5.4 - i * 0.3); const kk = LH.at(q[0], q[1]); if (kk >= 0) LH.put(kk, 15 * k, m.tooth, 0.1, 8, 0); }
      for (let i = 0; i < 3; i++) { const q = jp(19 + i * 2.6, 6.5); const kk = LH.at(q[0], q[1]); if (kk >= 0) LH.put(kk, 15 * k, m.tooth, 0, 8, 0); }
    }
    if (P.tongue > 0.1) {
      const tq = jp(28, 7.4);
      const tol = spline([[tq[0] - 1.5 * k, tq[1]], [tq[0] + 1.2 * k, tq[1] - 0.4 * k], [tq[0] + 2.8 * k, tq[1] + (1.5 + P.tongue * 2.2) * k], [tq[0] + 1.0 * k, tq[1] + (2.6 + P.tongue * 2.2) * k], [tq[0] - 0.8 * k, tq[1] + 1.4 * k]], true, 3);
      shape(LH, tol, { R: 1.6 * k, z0: 16 * k, id: 9, tex: (x, _y, _d, o) => { o.m = m.tongue; if (Math.abs(x - tq[0] - 0.8 * k) < 0.4 * k) o.t -= 0.08; } });
    }
  }
  earShape(LH, 0.5, -15.4, true, 10);
  LH.emit({ bias: -0.08, drop: 2.6 * k, ao: 0.05, aoR: 2, seam: 1.6 * k, spec, specP: 12, contrast: 1.22 });

  // the small eye up on its turret, under the brow; whiskers off the pad
  const ec = hp(EYE_C[0], EYE_C[1]);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: EYE.r * Math.min(2.6, k) }, P.eye ?? 'open');
  {
    const wc = hex('#efe6d2'), wc2 = hex('#c9bca0');
    for (let i = 0; i < 4; i++) {
      const a0 = hp(30.8 - i * 0.6, 0.6 + i * 1.1);
      const a = ha + 0.05 + i * 0.16 - (open ? 0.1 : 0);
      const len = (8 + (i === 1 ? 2 : 0)) * k;
      for (let s2 = 2; s2 < len; s2 += 1) {
        const x = a0[0] + Math.cos(a) * s2 + 0.04 * s2 * s2 / k * 0, y = a0[1] + Math.sin(a) * s2 + s2 * s2 * 0.012 / k;
        if (hh(i, Math.floor(s2), 3) < 0.15) continue;
        sk.over(x, y, s2 > len * 0.6 ? wc2 : wc);
      }
    }
  }

  // ---------------------------------------------------------------- mud: the surface collar when sunk, sheets and globs erupting
  if (P.sink > 0.02) {
    sk.np();
    let x0 = Infinity, x1 = -Infinity;
    for (let x = 0; x < sk.w; x++) {
      const xi = x - sk.ox + 0.5;
      for (let y = -6; y < 0; y++) if (sk.has(xi, y)) { x0 = Math.min(x0, xi); x1 = Math.max(x1, xi); break; }
    }
    if (x1 > x0) {
      const L = new Lay(sk, -sk.ox, -sk.oy, sk.w - sk.ox, sk.h - sk.oy);
      const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 4 * k;
      // a glossy lip of mud heaped round where the body breaks the surface, lumpy, with ripples out from it
      const lip: V2[] = [];
      for (let i = 0; i <= 24; i++) { const u = i / 24, x = cx - rx + u * rx * 2; lip.push([x, (-2.2 - Math.sin(u * Math.PI) * 0.8 - (noise2(x / (3 * k), P.t * 3, 81) - 0.5) * 1.6) * k]); }
      lip.push([cx + rx + 1.5 * k, 0.5 * k], [cx - rx - 1.5 * k, 0.5 * k]);
      shape(L, spline(lip, true, 2), { R: 2 * k, z0: 60 * k, id: 1, tex: (x, _y, _d, o) => { o.m = m.wetMud; o.t = 0.06 + (noise2(x / (2 * k), 3, 83) - 0.5) * 0.1; } });
      for (let i = 0; i < 4; i++) {
        const rx2 = rx + (6 + i * 7 + Math.sin(P.t * TAU + i) * 2) * k;
        for (const sgn of [-1, 1]) {
          const x = cx + sgn * rx2, w = (2.6 - i * 0.4) * k;
          shape(L, spline([[x - w, 0], [x - w * 0.4, -0.9 * k], [x + w * 0.5, -0.8 * k], [x + w, 0], [x, 0.4 * k]], true, 3), { R: 0.8 * k, z0: 61 * k, id: 2 + i, tex: (_x, _y, _d, o) => { o.m = m.wetMud; o.t = 0.12 - i * 0.04; } });
        }
      }
      L.emit({ drop: 1.5 * k, spec: new Map([[m.wetMud, 0.5]]), specP: 10 });
    }
  }
  if (P.sheet > 0.02) {
    // mud sheets pouring off the back and the head, and thrown globs
    sk.np();
    const L = new Lay(sk, -sk.ox, -sk.oy, sk.w - sk.ox, sk.h - sk.oy);
    const n = Math.round(11 * P.sheet);
    for (let i = 0; i < n; i++) {
      const lx = -46 + (i / Math.max(1, n - 1)) * 80 + hh(i, 1, 71) * 6;
      const a = B.p(lx, topY(lx) + 2);
      const len = (4 + hh(i, 2, 71) * 10) * P.sheet * k;
      const ph2 = (P.sheetPh * 3 + hh(i, 3, 71)) % 1;
      const y0 = a[1] + ph2 * len * 0.6, w = 1.4 * k, dx = (hh(i, 4, 71) - 0.5) * 2 * k;
      shape(L, spline([[a[0] - w, y0], [a[0] + w, y0], [a[0] + dx + w * 0.6, y0 + len * 0.8], [a[0] + dx, y0 + len + w], [a[0] + dx - w * 0.6, y0 + len * 0.8]], true, 3), { R: 1.2 * k, z0: 40 * k, id: 1 + (i % 200), tex: (_x, _y, _d, o) => { o.m = m.wetMud; } });
    }
    for (let i = 0; i < Math.round(8 * P.sheet); i++) {
      const gx = (-40 + hh(i, 5, 72) * 100) * k, gy = (-72 - hh(i, 6, 72) * 30 + P.sheetPh * 30) * k;
      if (gy > -2) continue;
      const r = (1 + hh(i, 7, 72) * 1.6) * k;
      shape(L, spline([[gx - r, gy], [gx - r * 0.3, gy - r * 0.9], [gx + r * 0.8, gy - r * 0.5], [gx + r, gy + r * 0.4], [gx, gy + r * 0.8]], true, 3), { R: r, z0: 70 * k, id: 100 + i, tex: (_x, _y, _d, o) => { o.m = m.wetMud; } });
    }
    L.emit({ drop: 1.5 * k, spec: new Map([[m.wetMud, 0.5]]), specP: 10 });
  }

  const headTop = hp(6, -25);
  const upTip = hp(32, 5), j1 = jp(29, 8);
  return {
    head: [headTop[0], headTop[1]], eye: ep, mouth: [(upTip[0] + j1[0]) / 2, (upTip[1] + j1[1]) / 2], nose: hp(35, -4.5),
    paw: pawNear, tail: tailTip, m,
  };
}

// ------------------------------------------------------------------ canvases, field-guide def, cached world frames
const CANVAS = { w: 270, h: 136, ox: 135, oy: 124 };
export const tigerCanvas = (k = 1) => ({ w: Math.ceil(CANVAS.w * k), h: Math.ceil(CANVAS.h * k), ox: Math.round(CANVAS.ox * k), oy: Math.round(CANVAS.oy * k) });

/** the field-guide / sheet registration (dry coat) */
export const TIGER_DEF: SpeciesDef = {
  name: 'Cerebral Tiger', kind: 'mammal', len: 190, height: 58,
  anims: TIGER_ANIMS,
  canvas: () => tigerCanvas(1),
  draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
    const P = tigerPoseAt(anim, frame);
    P.eye = eye;
    const o = drawTiger(sk, P, 1);
    return { head: o.head, eye: o.eye };
  },
  eyeFor: tigerEyeFor,
};

export interface TigerFrame {
  dry: PixelBuffer;
  wet: PixelBuffer;
  /** anchor in the cropped buffers */
  ax: number; ay: number;
  head: V2; eye: V2; mouth: V2; nose: V2; paw: V2; tail: V2;
  /** silhouette sample points (relative to the anchor) */
  pts: V2[];
}

interface RawT { dry: PixelBuffer; wet: PixelBuffer; o: TigerOut }
function renderRawT(anim: string, frame: number, eye: BeastEye): RawT {
  const cv = tigerCanvas(1);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  const P = tigerPoseAt(anim, frame);
  P.eye = eye;
  const o = drawTiger(sk, P, 1);
  const dry = sk.resolve();
  applyWet(sk, o.m);
  const wet = sk.resolve();
  return { dry, wet, o };
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
const frames = new Map<string, TigerFrame>();
const cv1 = tigerCanvas(1);
function pack(r: RawT, box: Box): TigerFrame {
  const ox = cv1.ox, oy = cv1.oy;
  const dry = cropBuf(r.dry, box), wet = cropBuf(r.wet, box);
  const ax = ox - box.x0, ay = oy - box.y0;
  const pts: V2[] = [];
  const step = Math.max(3, Math.floor(Math.min(dry.w, dry.h) / 7));
  for (let y = 1; y < dry.h; y += step) for (let x = 1; x < dry.w; x += step) if (dry.data[y * dry.w + x] >>> 24 > 128) pts.push([x - ax, y - ay]);
  if (!pts.length) pts.push([0, -4]);
  // points are local to the anchor already (painter coords): keep them that way
  return { dry, wet, ax, ay, head: r.o.head, eye: r.o.eye, mouth: r.o.mouth, nose: r.o.nose, paw: r.o.paw, tail: r.o.tail, pts };
}

/** is a whole anim strip painted yet? (for warming without hitches) */
export const tigerStripReady = (anim: string) => stripBox.has(anim);

/**
 * One world frame of the tiger (dry and wet buffers, cropped to the anim strip's shared box, anchor
 * at the ground). The first request of an anim paints the whole strip (all frames share one box).
 */
export function tigerFrame(anim: string, frame: number, eye?: BeastEye): TigerFrame {
  if (!TIGER_ANIMS[anim]) anim = 'idle';
  const A = TIGER_ANIMS[anim];
  const f = ((Math.floor(frame) % A.frames) + A.frames) % A.frames;
  const eyeOf = (i: number) => eye ?? tigerEyeFor(anim, i);
  const key = anim + '|' + f + '|' + eyeOf(f);
  const hit = frames.get(key);
  if (hit) return hit;
  let box = stripBox.get(anim);
  if (!box) {
    const raws: RawT[] = [];
    let u: Box | null = null;
    for (let i = 0; i < A.frames; i++) {
      const r = renderRawT(anim, i, eyeOf(i));
      raws.push(r);
      for (const b of [boundsOf(r.dry), boundsOf(r.wet)]) if (b) u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
    }
    u = u ?? { x0: cv1.ox, y0: cv1.oy - 1, x1: cv1.ox, y1: cv1.oy };
    box = { x0: Math.min(u.x0, cv1.ox) - 1, y0: Math.min(u.y0, cv1.oy) - 1, x1: Math.max(u.x1, cv1.ox) + 1, y1: Math.max(u.y1, cv1.oy - 1) + 1 };
    stripBox.set(anim, box);
    raws.forEach((r, i) => frames.set(anim + '|' + i + '|' + eyeOf(i), pack(r, box!)));
    const got = frames.get(key);
    if (got) return got;
  }
  const out = pack(renderRawT(anim, f, eyeOf(f)), box);
  frames.set(key, out);
  return out;
}

/** a big crisp painting of one pose (the name card, close-ups): k = scale, wet = fresh out of the mud */
export function paintTigerBig(anim: string, frame: number, k = 2.5, wet = true, eye?: BeastEye): { buf: PixelBuffer; ax: number; ay: number } {
  const cv = tigerCanvas(k);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  const P = tigerPoseAt(anim, frame);
  P.eye = eye ?? tigerEyeFor(anim, frame);
  const o = drawTiger(sk, P, k, 1);
  if (wet) applyWet(sk, o.m);
  const buf = sk.resolve({ rim: 0.12, bounce: 0.08 });
  const b = boundsOf(buf);
  if (!b) return { buf, ax: cv.ox, ay: cv.oy };
  return { buf: cropBuf(buf, b), ax: cv.ox - b.x0, ay: cv.oy - b.y0 };
}

// V11 Cerebral Tiger (Cerebrotigris pelophilus): the forest's ambush predator. A huge, short-haired cat
// built like a hippo: a deep barrel body slung low on short, massive legs, a broad head under a high
// domed brow (the "cerebral" dome: an enlarged sinus that carries its roar through mud and water),
// small eyes raised on turrets so they stay above the mud when the rest of it is under, nostrils on
// top of the snout that pinch shut, ears that fold flat and seal, wide splayed toes with webbing
// for soft ground and a thick, muscular tail it sculls with in the wallows. The sleek tawny coat has
// faded umber stripes and is caked with mud from the elbows down; fresh out of a wallow the whole
// animal is sheeted in dark wet mud.
//
// Painted with the beast sketch core (beasts-core.ts) as a posed 2D rig with depth: a barrel torso
// (spine tube + belly, chest, shoulder and haunch masses), IK legs with splayed paws, a hinged jaw,
// folding ears and nostrils, a tail chain. One geometry pass resolves twice: dry (caked, cracked mud)
// and wet (dark glossy mud, wet fur), so the world can show it dripping fresh out of the mud.
//
// Everything faces RIGHT; the anchor is the ground under the body (the mud surface for the wallow).

import { Sk, V2, Px, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, gait, TAU, hh, kf, cbez } from '../beasts-core';
import { Frame2, leg, LegSpec, scaleLeg } from '../beasts-rig';
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
  const coatR = rmp('#a5693a', { n: 7, dark: 0.6, cool: 0.3, light: 0.4, warm: 0.3, sat: 0.08 });
  const stripeR = rmp('#4a2b1b', { n: 5, dark: 0.5, light: 0.3 });
  const fadedR = rmp('#7c4a2a', { n: 6, dark: 0.56, light: 0.3 });
  const creamR = rmp('#e4d0a6', { n: 6, dark: 0.5, light: 0.4 });
  return {
    coat: sk.m(coatR),
    stripe: sk.m(stripeR, { edge: 1 }),
    faded: sk.m(fadedR, { edge: 1 }),
    cream: sk.m(creamR),
    // fur that wet mud covers once it has been under (the flanks, the chest, the face below the eyes)
    coatW: sk.m(coatR), stripeW: sk.m(stripeR, { edge: 1 }), fadedW: sk.m(fadedR, { edge: 1 }), creamW: sk.m(creamR),
    mud: sk.m(rmp('#9c8b70', { n: 6, dark: 0.52, light: 0.34 })),
    mud2: sk.m(rmp('#86745b', { n: 6, dark: 0.52, light: 0.3 })),
    crack: sk.m(rmp('#6a5a46', { n: 4, dark: 0.45 }), { edge: 0 }),
    wetMud: sk.m(rmp('#3f2d1e', { n: 6, dark: 0.62, light: 0.62 }), { k: 1.2 }),
    skin: sk.m(rmp('#4e3530', { n: 5, dark: 0.5, light: 0.35 })),
    mouth: sk.m(rmp('#6a2630', { n: 4, dark: 0.5 }), { edge: 0 }),
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
      if (l > 0.92 && r < 0.2) { sk.ov[i] = WET_HI; if (sk.mat[i + 1] && !sk.ov[i + 1] && r < 0.1) sk.ov[i + 1] = WET_HI2; }
      else if (l > 0.84 && r < 0.07) sk.ov[i] = WET_HI2;
    }
}

// ------------------------------------------------------------------ patterns
/** the coat's stripe value at body-local x and depth down the flank d (0 back .. 1 belly): 0 none, 1 faded, 2 dark */
function stripeAt(lx: number, d: number, seed = 0): number {
  // irregular bands: the spacing wanders, each tapers down the flank, slants back, some fork
  const x = lx + 3.2 * Math.sin(lx * 0.11 + 1) + d * 13 + d * d * 5 + Math.sin(d * 5 + lx * 0.18) * 1.2;
  const per = 7.8;
  const u = (x + 400) / per, i = Math.floor(u), f = u - i;
  const len = 0.32 + hh(i, 1, seed) * 0.42;
  if (d > len) return 0;
  const taper = 1 - d / len;
  const w = (0.13 + 0.3 * taper) * (0.75 + hh(i, 2, seed) * 0.55);
  const c = 0.5 + (hh(i, 3, seed) - 0.5) * 0.3;
  let on = Math.abs(f - c) < w * 0.5;
  if (!on && hh(i, 5, seed) < 0.45 && d > len * 0.3) on = Math.abs(f - c - 0.3 - d * 0.15) < w * 0.25;
  if (!on) return 0;
  const brk = hh(i, Math.floor(d * 7), seed + 4);
  if (brk < 0.12 && d > 0.15) return 0;
  // dark near the spine, faded lower down (and wherever old mud has stained the coat)
  return d < len * 0.45 && brk > 0.35 ? 2 : 1;
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

export function drawTiger(sk: Sk, P: TigerPose, k = 1, detail = 0): TigerOut {
  void detail;
  const m = mats(sk);
  sk.clipY = 0;
  const lieK = P.lie;
  const lowDrop = P.low * 10 + lieK * 6;
  const B = new Frame2([(-6 + P.bx) * k, (-34 + P.by + lowDrop + P.sink * SINK) * k], P.tilt, k);
  const inv = (x: number, y: number): V2 => {
    const dx = (x - B.o[0]) / k, dy = (y - B.o[1]) / k;
    const c = Math.cos(-B.a), s = Math.sin(-B.a);
    return [dx * c - dy * s, dx * s + dy * c];
  };

  // ---- the torso profile (local): spine points and radii; tops and bottoms for the depth lookup
  const st = P.stretch;
  const breathe = P.br * 0.8;
  const shake = P.shake;
  const wob = (i: number) => (shake ? Math.sin(P.t * TAU * 2 - i * 0.9) * 1.6 * shake : 0);
  const spineL: V2[] = [
    [-40 - st * 0.4, -1 + wob(4)], [-27 - st * 0.2, -5 + wob(3)], [-6, -4 + wob(2)],
    [14 + st * 0.3, -7 + wob(1) - P.hump * 0.6], [27 + st * 0.5, -3 + wob(0)],
  ];
  const prof = [15, 19.5 + breathe * 0.3, 21.5 + breathe, 20 + breathe * 0.6, 15.5];
  const radAt = (t: number) => {
    const u = t * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(u)), f = u - i;
    const e = f * f * (3 - 2 * f);
    return (prof[i] + (prof[i + 1] - prof[i]) * e) * k;
  };
  // depth lookup tables (body-local x from -80 to 60)
  const TOP = new Float32Array(141).fill(1e9), BOT = new Float32Array(141).fill(-1e9);
  const segL: number[] = [0];
  for (let i = 1; i < spineL.length; i++) segL.push(segL[i - 1] + Math.hypot(spineL[i][0] - spineL[i - 1][0], spineL[i][1] - spineL[i - 1][1]));
  const total = segL[segL.length - 1];
  for (let s = 0; s <= 60; s++) {
    const dd = (s / 60) * total;
    let j = 1;
    while (j < spineL.length - 1 && segL[j] < dd) j++;
    const f = (dd - segL[j - 1]) / Math.max(1e-6, segL[j] - segL[j - 1]);
    const x = spineL[j - 1][0] + (spineL[j][0] - spineL[j - 1][0]) * f, y = spineL[j - 1][1] + (spineL[j][1] - spineL[j - 1][1]) * f;
    const r = radAt(s / 60) / k;
    for (let lx = Math.floor(x - r); lx <= Math.ceil(x + r); lx++) {
      const ix = lx + 80;
      if (ix < 0 || ix > 140) continue;
      const h = Math.sqrt(Math.max(0, r * r - (lx - x) * (lx - x)));
      TOP[ix] = Math.min(TOP[ix], y - h);
      BOT[ix] = Math.max(BOT[ix], y + h);
    }
  }
  // the belly sags below the spine tube, the chest is deep
  const bellyC: V2 = [-4, 8.5 + P.jig * 0.5], bellyR: V2 = [27 + st * 0.3, 11.5 + breathe * 0.5 + P.jig * 0.15];
  const chestC: V2 = [17 + st * 0.3, 5], chestR: V2 = [14.5, 14 + breathe];
  const sag = (c: V2, r: V2) => {
    for (let lx = Math.floor(c[0] - r[0]); lx <= Math.ceil(c[0] + r[0]); lx++) {
      const ix = lx + 80, u = (lx - c[0]) / r[0];
      if (ix < 0 || ix > 140 || Math.abs(u) >= 1) continue;
      BOT[ix] = Math.max(BOT[ix], c[1] + r[1] * Math.sqrt(1 - u * u));
    }
  };
  sag(bellyC, bellyR);
  sag(chestC, chestR);
  const depth = (lx: number, ly: number) => {
    const ix = Math.max(0, Math.min(140, Math.round(lx) + 80));
    const top = TOP[ix] < 1e8 ? TOP[ix] : -20, bot = BOT[ix] > -1e8 ? BOT[ix] : 20;
    return (ly - top) / Math.max(1, bot - top);
  };

  // ---- coat fill for the body masses
  const wetLine = 0.17;
  const bodyFill = (p: Px) => {
    const [lx, ly] = inv(p.x, p.y);
    const d = depth(lx, ly);
    const ml = mudLine(lx);
    if (d > ml) {
      if (d > ml + 0.06 && crackAt(lx * k, ly * k, k)) return m.crack;
      if (d < ml + 0.06) p.l += 0.06;
      return hh(Math.floor(lx / 4), Math.floor(ly / 3), 21) < 0.75 ? m.mud : m.mud2;
    }
    const W = d > wetLine + Math.sin(lx * 0.4) * 0.04;
    // countershading: the back is deeper, the flank paler
    if (d < 0.3) p.l -= (0.3 - d) * 0.28;
    // haunch: stripes curve round the thigh
    let s = 0;
    const hx = lx + 31, hy = ly + 1;
    const hr = Math.hypot(hx, hy);
    if (hr < 16 && hr > 6 && hy < 3 && hx < 7) {
      const u = (hr + Math.atan2(hy, hx) * 1.2) / 6.2, i = Math.floor(u);
      if (u - i < 0.3 && hh(i, 3, 9) > 0.3) s = hh(i, 4, 9) < 0.4 ? 2 : 1;
    } else s = stripeAt(lx, d);
    // the belly and the inside of the chest are pale
    if (d > 0.8 && lx > 8) return W ? m.creamW : m.cream;
    if (s === 2) return W ? m.stripeW : m.stripe;
    if (s === 1) return W ? m.fadedW : m.faded;
    return W ? m.coatW : m.coat;
  };

  // ---- the legs
  const lk = 1 - P.low * 0.4;
  const FL: LegSpec = scaleLeg({ l1: 13 * lk + 4, l2: 12.5, l3: 4.5, r1: 9.2, r2: 7.2, r3: 6.2, bend: 1 }, k);
  const HL: LegSpec = scaleLeg({ l1: 13 * lk + 4, l2: 12.5, l3: 8.5, r1: 11.5, r2: 7.2, r3: 5.8, bend: -1 }, k);
  let pawNear: V2 = [0, 0];
  const legFill = (front: boolean) => (p: Px) => {
    // mud socks: the lower leg and the paw; faint bands above
    const lu = p.t * 26, lv = p.v * 4;
    if (p.t > 0.5 || (p.t > 0.34 && hh(Math.floor(lu), Math.floor(lv), front ? 17 : 18) < 0.5)) {
      if (p.t > 0.62 && crackAt(lu * k, lv * k, k)) return m.crack;
      return hh(Math.floor(lu / 3), Math.floor(lv / 2), 19) < 0.82 ? m.mud : m.mud2;
    }
    const band = (p.t * (front ? 7.5 : 6) + 0.3) % 1;
    if (band < 0.3 && hh(Math.floor(p.t * (front ? 7.5 : 6) + 0.3), front ? 1 : 2, 33) > 0.3 && p.v > -0.5) return m.fadedW;
    return m.coatW;
  };
  const paw = (f: V2, z: number, front: boolean, bias: number, claws: number, lifted: boolean, ang = 0) => {
    // a wide paw with four splayed, webbed toes (mud shoes) and retractile claws
    const w = (front ? 7 : 6) * k, h = (front ? 3.3 : 3) * k;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P2 = (x: number, y: number): V2 => [f[0] + (x * ca - y * sa) * k, f[1] + (x * sa + y * ca) * k];
    const c = P2(0.8, -h / k * 0.45);
    sk.np();
    sk.ell(c[0], c[1], w, h, (p) => (crackAt(p.x - c[0], p.y - c[1], k) ? m.crack : m.mud), { z: z + 2, bias, rot: ang });
    // webbing between the spread toes
    const wb = P2(4.6, -1.2);
    sk.ell(wb[0], wb[1], 3.8 * k, 1.6 * k, m.skin, { z: z + 2.6, bias: bias - 0.05, rot: ang });
    for (let i = 0; i < 4; i++) {
      const tx = 2.4 + i * 1.85 + (lifted ? 0 : i * 0.3), ty = -1.4 + i * 0.25 + (i === 0 ? -0.5 : 0);
      const q = P2(tx, ty);
      sk.ell(q[0], Math.min(q[1], lifted ? q[1] : -0.6 * k), 1.8 * k, 1.6 * k, (p) => (p.u + p.v > 0.9 ? m.mud2 : m.mud), { z: z + 3 + i * 0.15, bias });
      if (claws > 0.05) {
        const cl = (1.4 + claws * 2.6) * k;
        const a = ang + (lifted ? 0.7 : 0.85) - claws * 0.3;
        const bx = q[0] + Math.cos(ang) * 1.2 * k, by = q[1] + Math.sin(ang) * 0.4 * k;
        sk.blade(bx, by, bx + Math.cos(a) * cl, by + Math.sin(a) * cl, s => (1 - s) * 0.8 * k + 0.2, m.claw, { z0: z + 4, z1: z + 4.2, bias, bend: 0.4 * k });
      }
    }
  };
  const drawLeg = (which: number) => {
    const front = which < 2, near = which % 2 === 0;
    // a near foreleg reaching out (pounce, swipe, climbing out of the mud) passes in front of the head
    const out = front && near ? Math.max(P.reach, P.swipe > -8 ? 1 : 0) : 0;
    const z = near ? 13 + out * 24 : -13, bias = near ? 0 : -0.14;
    const L = front ? FL : HL;
    sk.np();
    const hip = B.p(front ? 17 + st * 0.3 : -31 - st * 0.25, front ? 2 : 1);
    const restX = front ? 13 : -37;
    let foot: V2 = [(restX + P.bx + P.feet[which][0] + (near ? 0 : front ? -3 : 2)) * k, Math.min(0, P.feet[which][1]) * k];
    let lifted = P.feet[which][1] < -0.5;
    let ang = 0;
    if (front && (near ? P.reach : P.reachF) > 0) {
      const r = near ? P.reach : P.reachF;
      // reaching: the paw comes forward and up out of the body line
      const tgt = near ? B.p(48 + r * 15, 14 - r * 5) : B.p(46 + r * 12, 15 - r * 4);
      foot = [foot[0] + (tgt[0] - foot[0]) * r, foot[1] + (tgt[1] - foot[1]) * r];
      lifted = true;
      ang = -0.5 * r;
    }
    if (front && near && P.swipe > -8) {
      const sh = B.p(17, -3);
      const len = 30 * k;
      foot = [sh[0] + Math.sin(P.swipe) * len, sh[1] + Math.cos(P.swipe) * len];
      lifted = true;
      ang = -P.swipe * 0.8;
    }
    if (!front && P.tuck > 0) {
      const tgt = B.p(-16, 18);
      foot = [foot[0] + (tgt[0] - foot[0]) * P.tuck, foot[1] + (tgt[1] - foot[1]) * P.tuck];
      lifted = true;
    }
    if (lieK > 0.01) {
      // lying: forelegs stretched out in front, hind legs folded under the haunch
      const tgt = front ? B.p(near ? 40 : 36, 12) : B.p(near ? -18 : -22, 12);
      foot = [foot[0] + (tgt[0] - foot[0]) * lieK, foot[1] + (tgt[1] - foot[1]) * lieK];
      ang = front ? -0.1 : 0;
    }
    const footAng = front ? -Math.PI / 2 - 0.18 - (lifted ? 0.5 : 0) : -Math.PI / 2 - 0.6;
    const j = leg(sk, hip, foot, L, legFill(front), z, footAng, bias);
    if (near && front) pawNear = j[3];
    // the elbow: a thick knot of muscle
    if (front) sk.ell(j[1][0], j[1][1], 6.6 * k, 5.8 * k, legFill(true), { z: z + 0.5, bias });
    paw(j[3], z, front, bias, P.claws, lifted, ang);
  };
  if (P.sink < 0.98) {
    drawLeg(1);
    drawLeg(3);
  }

  // ---- the tail: thick and muscular, a sculling rudder in the wallow
  sk.np();
  const tb = B.p(-49 - st * 0.4, -5);
  const ta = B.ang(Math.PI * 0.72 - P.tail * 0.9);
  const wv = Math.sin(P.tailWave * TAU) * 3;
  const c1: V2 = [tb[0] + Math.cos(ta) * 15 * k, tb[1] + Math.sin(ta) * 15 * k];
  const c2: V2 = [c1[0] - 12 * k, c1[1] + (7 - P.tail * 12 + wv) * k];
  const tipA = Math.PI + 0.3 - P.tailCurl * 1.6 + P.tail * 0.4;
  const tip: V2 = [c2[0] + Math.cos(tipA) * 11 * k, c2[1] + Math.sin(tipA) * 11 * k];
  const tPts = cbez(tb, c1, c2, tip, 14);
  sk.tube(tPts, t => (7.6 - t * 4.6) * k, (p) => {
    if (p.ny > 0.42 && p.t < 0.75) return crackAt(p.t * 50 * k, p.v * 5 * k, k) ? m.crack : m.mud;
    if (p.t > 0.88) return m.stripe;
    if (p.t > 0.2 && (p.t * 6.2 + 0.15) % 1 < 0.34) return p.t > 0.55 ? m.stripe : m.faded;
    return m.coatW;
  }, { z: -3, rz: 0.9 });

  // ---- the torso: spine tube, haunch, belly, chest and shoulder masses
  sk.np();
  sk.tube(spineL.map(([x, y]) => B.p(x, y)), radAt, bodyFill, { z: 0, rz: 0.95 });
  const bodyPart = sk.pid;
  const haunch = B.p(-31 - st * 0.25, -1);
  sk.ell(haunch[0], haunch[1], 16.5 * k, 16.5 * k, bodyFill, { rot: B.a, rz: 15 * k, z: 2 });
  const belly = B.p(bellyC[0], bellyC[1]);
  sk.ell(belly[0], belly[1], bellyR[0] * k, bellyR[1] * k, bodyFill, { rot: B.a, rz: 12 * k });
  const chest = B.p(chestC[0], chestC[1]);
  sk.ell(chest[0], chest[1], chestR[0] * k, chestR[1] * k, bodyFill, { rot: B.a, rz: 13 * k, z: 2 });
  const shoulder = B.p(16 + st * 0.3, -6 - P.hump * 1.4);
  sk.ell(shoulder[0], shoulder[1], 13 * k, 15.5 * k, bodyFill, { rot: B.a - 0.15, rz: 12 * k, z: 4 });
  // sleek coat: faint streaks running back along the body
  sk.streaks(bodyPart, () => [-0.96, 0.28], { spacing: 4, len: 3, amp: 0.035, seed: 5 });
  // heavy skin folds behind the shoulder and in the flank
  for (const [fx, fy, len, a] of [[4, -2, 9, 1.65], [6, 7, 6, 1.85], [-16, 1, 8, 1.4]] as [number, number, number, number][]) {
    const a0 = B.p(fx, fy), dv = B.dir(a, len);
    const nn = Math.ceil(len * k);
    for (let i = 0; i <= nn; i++) sk.paint(a0[0] + (dv[0] * i) / nn + Math.sin(i * 0.9) * 0.4, a0[1] + (dv[1] * i) / nn, 0, -0.1);
  }

  // ---- neck and head (the head is big: HK)
  const HK = 1.3, hk = k * HK;
  const N0 = B.p(24 + st * 0.5, -5);
  const nA = B.a - 0.52 + P.neck;
  const nL = 15 * k;
  const Ho: V2 = [N0[0] + Math.cos(nA) * nL, N0[1] + Math.sin(nA) * nL];
  const H = new Frame2(Ho, B.a + P.neck * 0.55 + P.head + 0.12, hk);
  const neckFill = (p: Px) => {
    // a heavy neck: throat pale and muddy underneath
    const hx = p.x - N0[0], hy = p.y - N0[1];
    const across = (hy * Math.cos(nA) - hx * Math.sin(nA)) / k; // + = under the neck
    const u = (hx * Math.cos(nA) + hy * Math.sin(nA)) / k;
    if (across > 9) return crackAt(across * k, u * k, k) ? m.crack : m.mud;
    if (across < -6 && ((u + 30) / 5.5) % 1 < 0.32 && hh(Math.floor((u + 30) / 5.5), 2, 27) > 0.25) return m.faded;
    if (across < -10) p.l -= 0.05;
    return m.coatW;
  };
  sk.tube([N0, [(N0[0] + Ho[0]) / 2, (N0[1] + Ho[1]) / 2 - 0.5 * k], Ho], t => (15.5 - t * 3.5) * k, neckFill, { z: 3, rz: 0.95 });
  const hz = 14;
  const headLocal = (p: Px): V2 => {
    const dx = (p.x - H.o[0]) / hk, dy = (p.y - H.o[1]) / hk;
    const c = Math.cos(-H.a), s = Math.sin(-H.a);
    return [dx * c - dy * s, dx * s + dy * c];
  };
  const headFill = (p: Px) => {
    const [hx, hy] = headLocal(p);
    const nz = hh(Math.floor(hx), Math.floor(hy * 0.5), 57) * 0.9;
    // the throat and the underside of the jaw: caked mud
    if (hy > 9.4 + Math.sin(hx * 0.8) * 0.8) return crackAt(hx * hk, hy * hk, hk) ? m.crack : m.mud;
    // the muzzle: plain orange bridge on top, pale upper lip and whisker pad below, rows of whisker spots
    if (hx > 12) {
      if (hy > 1 + nz * 0.5) {
        if (hy > 1.2 && hy < 5.6 && hx > 12.5 && hx < 19 && (Math.floor(hx * 0.95) + Math.floor(hy * 0.9)) % 3 === 0 && hh(Math.floor(hx), Math.floor(hy), 51) < 0.65) return m.fadedW;
        return m.creamW;
      }
      return m.coat;
    }
    // a small white spot of eyebrow over the eye
    if (Math.hypot(hx - 8.9, hy + 8.2) < 1.25) return m.cream;
    // the dome: a maze of dark stripes, uncannily like a brain (hence the folk name)
    const dq = ((hx - 4) / 9.5) ** 2 + ((hy + 9) / 8.5) ** 2;
    if (dq < 1 && hy < -6.8) {
      const v = Math.sin(hx * 0.82 + 1.5 * Math.sin(hy * 0.66 + 0.5)) + Math.sin(hy * 1.0 + 1.3 * Math.sin(hx * 0.58 + 1));
      if (Math.abs(v) < 0.44 + dq * 0.1) return dq > 0.82 ? m.faded : m.stripe;
      if (dq < 0.3) p.l += 0.05;
      return m.coat;
    }
    // the lower side of the head is pale (cheek and ruff), crossed by stripes sweeping back from the eye
    const cheekTop = 2.4 - (hx - 2) * 0.14 + nz * 0.7;
    if (hy > cheekTop && hx > -11 && hx < 8.5) {
      const u = (hy + 0.24 * hx + 40) / 3.3, i = Math.floor(u);
      if (u - i < 0.34 && hx < 7 && hx > -10 && hy < 6 && i % 2 === 0) return hy > 3.5 ? m.stripeW : m.stripe;
      return hy > 3.5 ? m.creamW : m.cream;
    }
    // stripes on the side of the head above the cheek
    const bu = (hy + 0.5 * hx + 40) / 4, bi = Math.floor(bu);
    if (hx < 2 && hx > -13 && bu - bi < 0.28 && bi % 2 === 1) return m.faded;
    return hy > -3 ? m.coatW : m.coat;
  };
  // the ears: small and round, set on the back of the dome; they fold flat and seal shut
  const earUp = Math.max(0, P.ear), earFlat = Math.max(0, -P.ear);
  const earAt = (bx: number, by: number, zz: number, near: boolean) => {
    sk.np();
    const base = H.p(bx, by);
    const a = H.ang(-1.95 + earUp * 0.2 - earFlat * 1.0 + (shake ? Math.sin(P.t * TAU * 4) * 0.4 : 0));
    const len = (5.4 - earFlat * 2.3) * hk, wid = (3.5 - earFlat * 0.9) * hk;
    const tip: V2 = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
    sk.blade(base[0], base[1], tip[0], tip[1], s => Math.sin(Math.min(1, s * 1.1) * Math.PI) * wid + 0.4,
      (p) => {
        if (!near) return p.t > 0.68 ? m.earBack : m.coat;
        // the back of the ear: black with the white "eye spot" every tiger has
        if (p.t > 0.3 && p.t < 0.72 && Math.abs(p.v) < 0.42) return earFlat >= 0.5 ? m.spot : m.earIn;
        return p.t > 0.68 ? m.earBack : m.coat;
      },
      { z0: zz, z1: zz + 0.4 });
  };
  earAt(-9, -8.6, hz - 4, false);
  sk.np();
  // the cranium and the high dome of the brow
  const cran = H.p(-3, -1);
  sk.ell(cran[0], cran[1], 12 * hk, 10 * hk, headFill, { rot: H.a, rz: 10 * hk, z: hz });
  const dome = H.p(4, -9);
  sk.ell(dome[0], dome[1], 9.5 * hk, 8.5 * hk, headFill, { rot: H.a - 0.12, rz: 8.2 * hk, z: hz + 3 });
  // eye turret: the eye rides up on a bump of the skull so it stays above the mud
  const tur = H.p(9.8, -5.2);
  sk.ell(tur[0], tur[1], 3.4 * hk, 2.8 * hk, headFill, { rot: H.a, rz: 2.5 * hk, z: hz + 8.5 });
  // heavy jowls and the cheek ruff
  const jowl = H.p(2, 3.2);
  sk.ell(jowl[0], jowl[1], 10 * hk, 6.6 * hk, headFill, { rot: H.a + 0.08, rz: 8 * hk, z: hz + 2 });
  const ruff = H.p(-6, 4.2);
  sk.ell(ruff[0], ruff[1], 6.2 * hk, 6.2 * hk, headFill, { rot: H.a + 0.5, rz: 5.5 * hk, z: hz + 1 });
  sk.tufts(sk.pid, (_x, _y, nx, ny) => (ny > 0 && nx <= 0 ? [nx * 0.6 - 0.6, 0.9] : null), { every: 2, seed: 8, len: 1 });
  // the nose bridge and deep, short muzzle, the puffy whisker pad under it
  const mz0 = H.p(9, -2.4), mz1 = H.p(17, -1.4);
  sk.tube([mz0, mz1], t => (5.4 - t * 0.5) * hk, headFill, { z: hz + 6 });
  const pad = H.p(16, 2.6);
  sk.ell(pad[0], pad[1], 4.9 * hk, 4.4 * hk, headFill, { rot: H.a, rz: 4.2 * hk, z: hz + 9 });
  // nose leather with the nostrils on top (they pinch shut)
  const nose = H.p(20, -2);
  sk.ell(nose[0], nose[1], 2.5 * hk, 2.3 * hk, m.skin, { rot: H.a, rz: 2.2 * hk, z: hz + 11 });
  const nosP = H.p(18.2, -5.2);
  if (P.nos < 0.5) {
    sk.ell(nosP[0], nosP[1], 1.6 * hk, 0.95 * hk, m.skin, { rot: H.a - 0.25, z: hz + 12, bias: -0.2 });
    sk.paint(nosP[0], nosP[1], m.mouth, -0.2);
  } else sk.ell(nosP[0], nosP[1], 1.8 * hk, 0.55 * hk, m.skin, { rot: H.a - 0.25, z: hz + 12, bias: 0.05 });
  // the jaw: hinged far back for the hippo gape
  const jA = H.ang(0.14 + P.jaw * 1.04);
  const j0 = H.p(0, 7.2);
  const jl = 15.5 * hk;
  const j1: V2 = [j0[0] + Math.cos(jA) * jl, j0[1] + Math.sin(jA) * jl];
  const upTip = H.p(16.6, 6.2);
  if (P.jaw > 0.12) {
    // the mouth: the dark throat, the tongue, the gum line
    sk.np();
    const lipBack = H.p(3, 6.6);
    sk.poly([lipBack[0], lipBack[1], upTip[0], upTip[1], j1[0], j1[1] - 1.4 * hk, j0[0], j0[1]], (p) => {
      p.l -= Math.max(0, 0.35 - Math.hypot(p.x - j0[0], p.y - j0[1]) / jl) * 0.8;
      return m.mouth;
    }, { z: hz + 4 });
    const tg: V2 = [(j0[0] + j1[0]) / 2 + 1.5 * hk, (j0[1] + j1[1]) / 2 - 1.6 * hk];
    sk.ell(tg[0], tg[1], 6 * hk, 2.4 * hk, m.tongue, { rot: jA - 0.15, z: hz + 4.6, rz: 2 * hk });
    sk.tube([lipBack, upTip], 1.15 * hk, m.gum, { z: hz + 5 });
  }
  // lower jaw with its small chin
  sk.np();
  sk.tube([j0, j1], t => (4.4 - t * 1.2) * hk, (p) => (p.ny > 0.3 || (p.t > 0.8 && p.ny > 0) ? (crackAt(p.t * 18 * hk, p.v * 4 * hk, hk) ? m.crack : m.mud) : m.creamW), { z: hz + 5 });
  // teeth: the upper canines show under the lip even at rest; more when it snarls or gapes
  {
    sk.np();
    const cA = H.ang(Math.PI / 2 + 0.1);
    const clen = (2.6 + P.snarl * 1.8 + P.jaw * 2.8) * hk;
    const cb0 = H.p(14.4, 6.4);
    sk.blade(cb0[0], cb0[1], cb0[0] + Math.cos(cA) * clen, cb0[1] + Math.sin(cA) * clen, s => (1 - s) * 1.05 * hk + 0.25, m.tooth, { z0: hz + 12, z1: hz + 12.2, bend: 0.25 * hk });
    if (P.jaw > 0.2) {
      // the lower canines, small incisors, carnassials along the open jaw
      const lc: V2 = [j1[0] - Math.cos(jA) * 2.4 * hk, j1[1] - Math.sin(jA) * 2.4 * hk];
      const la = jA - Math.PI / 2 - 0.15;
      const ll = (2.2 + P.jaw * 1.6) * hk;
      sk.blade(lc[0], lc[1], lc[0] + Math.cos(la) * ll, lc[1] + Math.sin(la) * ll, s => (1 - s) * 0.9 * hk + 0.2, m.tooth, { z0: hz + 12, z1: hz + 12.1 });
      for (let i = 0; i < 3; i++) {
        const q = H.p(17.2 - i * 0.9, 6.6 + i * 0.1);
        sk.dot(q[0], q[1], m.tooth, 0.8, hz + 12);
      }
      for (let i = 0; i < 3; i++) {
        const q: V2 = [j0[0] + Math.cos(jA) * (7 + i * 2.4) * hk, j0[1] + Math.sin(jA) * (7 + i * 2.4) * hk - 1.1 * hk];
        sk.dot(q[0], q[1], m.tooth, 0.7, hz + 11);
      }
    }
    if (P.tongue > 0.1) {
      const tq: V2 = [j1[0] - Math.cos(jA) * 3 * hk, j1[1] - Math.sin(jA) * 3 * hk];
      sk.ell(tq[0] + 1.2 * hk, tq[1] + 2.2 * hk * P.tongue, 2.2 * hk, (1.4 + P.tongue) * hk, m.tongue, { z: hz + 13, rz: 1.5 * hk });
    }
  }
  // the snarl wrinkles the nose bridge
  if (P.snarl > 0.4) {
    for (let i = 0; i < 3; i++) {
      const a = H.p(11.6 + i * 1.6, -7.4 + i * 0.3), b = H.p(12.6 + i * 1.6, -5);
      sk.line(a[0], a[1], b[0], b[1], m.faded, 0.35, hz + 13);
    }
  }
  // near ear
  earAt(-7, -9.4, hz + 9, true);
  // the small eye up on its turret, under the brow, and a dark tear line down the cheek
  const ec = H.p(10.1, -5.6);
  const ep = drawEye(sk, ec[0], ec[1], { ...EYE, r: EYE.r * Math.min(2.6, k) }, P.eye ?? 'open');
  {
    const a = H.p(8.6, -4), b = H.p(6.2, -0.4);
    sk.line(a[0], a[1], b[0], b[1], m.stripe, 0.3, hz + 10);
  }

  // ---- near legs in front
  if (P.sink < 0.98) {
    drawLeg(0);
    drawLeg(2);
  }

  // ---- mud: the surface collar when sunk, sheets and globs when erupting
  if (P.sink > 0.02) {
    sk.np();
    // where the body breaks the surface: a glossy lip of mud heaped round it, with ripples
    let x0 = Infinity, x1 = -Infinity;
    for (let x = 0; x < sk.w; x++) {
      const xi = x - sk.ox + 0.5;
      for (let y = -6; y < 0; y++) if (sk.has(xi, y)) { x0 = Math.min(x0, xi); x1 = Math.max(x1, xi); break; }
    }
    if (x1 > x0) {
      const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 4 * k;
      sk.ell(cx, -0.4 * k, rx, 2.6 * k, m.wetMud, { z: 60, rz: 1.6 * k, bias: 0.06 });
      for (let i = 0; i < 4; i++) {
        const rx2 = rx + (6 + i * 7 + Math.sin(P.t * TAU + i) * 2) * k;
        for (const sgn of [-1, 1]) sk.ell(cx + sgn * rx2, -0.6 * k, (2.5 - i * 0.4) * k, 0.8 * k, m.wetMud, { z: 61, bias: 0.12 - i * 0.04 });
      }
    }
  }
  if (P.sheet > 0.02) {
    // mud sheets pouring off the back and the head, and thrown globs
    sk.np();
    const n = Math.round(11 * P.sheet);
    for (let i = 0; i < n; i++) {
      const lx = -46 + (i / Math.max(1, n - 1)) * 80 + hh(i, 1, 71) * 6;
      const top = TOP[Math.max(0, Math.min(140, Math.round(lx) + 80))];
      if (top > 1e8) continue;
      const a = B.p(lx, top + 2);
      const len = (4 + hh(i, 2, 71) * 10) * P.sheet * k;
      const ph = (P.sheetPh * 3 + hh(i, 3, 71)) % 1;
      const y0 = a[1] + ph * len * 0.6;
      sk.blade(a[0], y0, a[0] + (hh(i, 4, 71) - 0.5) * 2 * k, y0 + len, s => (1 - s * 0.7) * 1.4 * k, m.wetMud, { z0: 40, z1: 41 });
    }
    for (let i = 0; i < Math.round(8 * P.sheet); i++) {
      const gx = (-40 + hh(i, 5, 72) * 100) * k, gy = (-72 - hh(i, 6, 72) * 30 + P.sheetPh * 30) * k;
      if (gy > -2) continue;
      sk.ell(gx, gy, (1 + hh(i, 7, 72) * 1.6) * k, (0.9 + hh(i, 8, 72)) * k, m.wetMud, { z: 70 });
    }
  }

  const headTop = H.p(4, -20);
  return {
    head: [headTop[0], headTop[1]], eye: ep, mouth: [(upTip[0] + j1[0]) / 2, (upTip[1] + j1[1]) / 2], nose,
    paw: pawNear, tail: tip, m,
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

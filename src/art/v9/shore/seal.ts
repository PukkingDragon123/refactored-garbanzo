// Corvex Seal: a three-and-a-half metre shaggy black pinniped of the island's seal rocks. Its face is
// bare crimson skin, its muzzle is sheathed in a hooked, ivory keratin beak-plate (the "corvex":
// raven-beak) for cracking shellfish, and a mane of long guard hair runs from the crown to the
// shoulders. The fore-flippers are long clawed arms it gallops on; a crimson throat sac balloons out
// under the beak when it roars. White "star" spots run down each flank. Crown leeches cluster in the
// bare skin folds where the mane parts on the neck (their crowns open while the seal sleeps).
//
// Painted on the Relief layer (beasts-relief) from one body contour through landmarks along the
// spine and the neck: the slim hips and tail, the long back rising to a shoulder hump, the heavy neck
// (as deep as the shoulders where it leaves them), the sagging throat, the deep brisket and the
// belly settling on the sand. The guard hair lies back along the body in long shaggy locks (fur
// strands with grizzled tips) and breaks the outline on the back, the nape and the belly; blubber
// rolls ring the neck and crease the chest and flank where the body bends; the bare pink crease
// behind the skull holds the leeches; the white star freckles are hand-placed constellations broken
// by the fur, with the white bib on the chest. The head is a skull contour (fur behind the ear line,
// bare wrinkled crimson in front, the cheek and the brow), the beak-plates are keratin contours
// (keeled and hooked, growth lines, a dark cutting edge, a crimson base, the whisker pits), and the
// throat sac is a glossy veined balloon (a wrinkled wattle at rest). The flippers are contours too:
// the furred arm with its elbow, a leathery paddle hand with five digit ridges and three hooked
// claws, and webbed hind fans with five digit ridges ending in scalloped lobes and little nails.
//
// Faces right, anchored on the ground under the middle of the body (lying pose). Anims: sleep, idle,
// scratch, flick, yawn, wake, roar, gallop, lunge, pin, tired.

import { Sk, V2, rmp, drawEye, EyeSpec, BeastEye, SpeciesDef, TAU, hh, ik2, lerp2, sm } from '../../beasts-core';
import { Frame2 } from '../../beasts-rig';
import { Relief, Sp, Tx, LM, spline as cspline, fringe, strands, FS, memoTex, vn } from '../../beasts-relief';
import { hex } from '../../color';
import { clamp } from '../../../core/math';
import { arcs, onPath, frac } from './shore-kit';
import { diveFishHeld } from '../../v12/dive/bigfish';
type Eye = 'open' | 'half' | 'closed' | 'angry' | 'alert';

interface P {
  br: number;            // breath 0..1 (belly and flanks swell)
  lift: number;          // chest raised off the ground (0 lying .. 1 reared up)
  hump: number;          // mid-back arch (px)
  waveA: number;         // gallop ripple amplitude (px)
  wave: number;          // gallop ripple phase 0..1
  stretch: number;       // body length multiplier
  flat: number;          // squashed onto the sand (tired, pinning)
  neck: number;          // neck angle (rad, 0 = level forward, - = up)
  nl: number;            // neck length multiplier
  head: number;          // extra head pitch (+ nose down)
  gape: number;          // beak open 0..1
  sac: number;           // throat sac inflation 0..1
  tongue: number;        // tongue lolling out 0..1
  mane: number;          // bristle 0..1
  shake: number;         // mane swing -1..1
  foreN: V2;             // near fore-flipper hand target
  foreF: V2;             // far fore-flipper hand target
  hind: number;          // hind flippers 0 splayed back .. 1 swung forward under the hips
  sand: number;          // flicked sand in the air 0..1
  sandPh: number;
  eye: Eye;
  crowns: number;        // leech crowns open 0..1
  crownPh: number;
  // ---- in the water (the kelp dive's swim anims)
  swim: number;          // 1: afloat (no ground, body round its own axis, flippers free)
  pitch: number;         // whole-body pitch (rad, - = nose up)
  flipV: boolean;        // rolled upside down (the barrel roll's far half)
  fN: [number, number, number]; // near fore-flipper: wrist reach angle from the shoulder (rad, body frame), reach px, hand angle
  fF: [number, number, number]; // far fore-flipper, the same
  hindA: number;         // hind flippers' trailing angle offset (rad, + = down)
  hindS: number;         // their spread (far flipper's extra angle)
  fish: number;          // a fish held crosswise in the beak
  bubbles: number;       // bubbles rising from the beak (0 none .. 1 a stream), phase in sandPh
}
const base = (): P => ({
  br: 0.5, lift: 0, hump: 0, waveA: 0, wave: 0, stretch: 1, flat: 0, neck: -0.3, nl: 1, head: 0.1,
  gape: 0, sac: 0, tongue: 0, mane: 0, shake: 0, foreN: [52, 0], foreF: [46, 0], hind: 0, sand: 0, sandPh: 0,
  eye: 'open', crowns: 0.3, crownPh: 0,
  swim: 0, pitch: 0, flipV: false, fN: [1.6, 14, 2], fF: [1.7, 13, 2.1], hindA: 0, hindS: 0.18, fish: 0, bubbles: 0,
});

const A = (frames: number, fps: number, loop = true) => ({ frames, fps, loop });
export const SEAL_ANIMS = {
  sleep: A(6, 1.6), idle: A(4, 2), scratch: A(8, 9), flick: A(6, 8), yawn: A(6, 5, false),
  wake: A(6, 7, false), roar: A(6, 8), gallop: A(8, 11.5), lunge: A(4, 12), pin: A(4, 2), tired: A(6, 6),
  // the kelp dive: graceful in water (anchored on the body's middle, not the ground)
  swim: A(8, 8), glide: A(4, 3), roll: A(8, 10), bubble: A(6, 6), hang: A(4, 3), grab: A(4, 12, false), carry: A(6, 8),
};
/** the swim anims (afloat: their anchor is the body centre) */
export const SEAL_SWIM_ANIMS = ['swim', 'glide', 'roll', 'bubble', 'hang', 'grab', 'carry'];

/** afloat: the body free of the ground, the neck level, the mane lying flat in the stream */
function water(p: P) {
  p.swim = 1; p.lift = 0; p.flat = 0; p.hump = 0; p.neck = -0.08; p.head = 0.02; p.crowns = 0; p.mane = 0; p.shake = -0.35;
}

function pose(anim: string, f: number, n: number): P {
  const p = base();
  const t = f / n;
  const s1 = Math.sin(t * TAU);
  switch (anim) {
    case 'sleep': {
      // slow breathing, chin on the sand; the throat wattle puffs on each snore; leech crowns open
      p.br = 0.5 + 0.5 * s1;
      p.neck = 0.12; p.head = 0.22; p.eye = 'closed';
      const snore = Math.max(0, -s1);
      p.sac = snore * 0.2; p.gape = snore * 0.05;
      p.crowns = 1; p.crownPh = t;
      break;
    }
    case 'idle': {
      p.br = 0.5 + 0.5 * s1;
      p.neck = -0.34 + (f === 2 ? -0.07 : 0); p.head = [0.08, 0.04, -0.04, 0.12][f];
      p.eye = f === 3 ? 'half' : 'open';
      p.crowns = 0.5; p.crownPh = t;
      break;
    }
    case 'scratch': {
      // lifts the near fore-flipper and rakes its claws through the neck folds (the leeches clamp down)
      const k = [0.3, 0.8, 1, 1, 1, 1, 0.8, 0.3][f];
      const rake = [0, 0, 0, 1, 0, 1, 0, 0][f];
      p.neck = -0.38 - k * 0.12; p.head = 0.14 + k * 0.14;
      p.eye = k > 0.7 ? 'half' : 'open';
      p.foreN = lerp2([52, 0], [36 + rake * 5, -34 - rake * 5], sm(k));
      p.crowns = 0; p.br = 0.5 + 0.3 * s1;
      p.mane = rake * 0.2;
      break;
    }
    case 'flick': {
      // scoops wet sand with a fore-flipper and flings it over its back to keep cool
      const H: V2[] = [[54, 0], [46, -4], [30, -26], [10, -40], [28, -18], [50, -2]];
      p.foreN = H[f];
      p.neck = -0.34; p.head = 0.1 - (f > 1 && f < 5 ? 0.14 : 0);
      p.sand = f >= 2 && f <= 4 ? 1 : 0; p.sandPh = (f - 2) / 3;
      p.eye = f === 3 ? 'half' : 'open';
      break;
    }
    case 'yawn': {
      const g = [0, 0.45, 1, 1, 0.6, 0.1][f];
      p.neck = -0.32 - g * 0.32; p.head = 0.06 - g * 0.34;
      p.gape = g; p.sac = g * 0.3; p.eye = g > 0.3 ? 'closed' : 'half';
      p.crowns = 0.6; p.crownPh = t;
      break;
    }
    case 'wake': {
      // jolts awake, heaves up onto its fore-flippers and shakes out the mane
      const K = [
        [0, 0.12, 0.22, 0, 0],
        [0.06, -0.42, 0.04, 0.2, 0],
        [0.3, -0.52, -0.02, 0.45, 0],
        [0.36, -0.44, 0.06, 0.65, 1],
        [0.38, -0.5, 0.02, 0.75, -1],
        [0.44, -0.66, -0.1, 0.95, 0],
      ][f];
      p.lift = K[0]; p.neck = K[1]; p.head = K[2]; p.mane = K[3]; p.shake = K[4];
      p.eye = f === 0 ? 'half' : f < 3 ? 'alert' : 'angry';
      p.gape = f === 5 ? 0.3 : 0;
      p.foreN = [52 + p.lift * 6, 0]; p.foreF = [45 + p.lift * 5, 0];
      p.crowns = f === 0 ? 1 : 0;
      p.hind = p.lift * 0.4;
      break;
    }
    case 'roar': {
      // reared right up on the fore-flippers, beak wide, the throat sac ballooned under it
      p.lift = 1; p.neck = -1.05 + Math.sin(t * TAU) * 0.05; p.nl = 1.06; p.head = -0.34;
      p.gape = [0.85, 1, 1, 0.9, 1, 0.95][f]; p.sac = [0.82, 0.95, 1, 0.9, 1, 0.86][f];
      p.mane = 1; p.shake = Math.sin(t * TAU * 2) * 0.25;
      p.foreN = [52, 0]; p.foreF = [42, 0];
      p.hind = 0.3; p.eye = 'angry'; p.br = 1;
      break;
    }
    case 'gallop': {
      // a heaving bound: fore-flippers reach and plant, the back humps as the hind flippers swing
      // forward, then the whole body stretches out on the push (a ripple running tail to head)
      p.lift = 0.32 + 0.26 * s1;
      p.hump = 5 + 10 * Math.max(0, Math.sin((t - 0.18) * TAU));
      p.waveA = 3.5; p.wave = t;
      p.stretch = 1 + 0.07 * Math.sin((t - 0.25) * TAU);
      p.neck = -0.5 - 0.14 * s1; p.head = 0.06 + 0.08 * Math.sin(t * TAU + 1);
      p.gape = 0.45 + 0.25 * Math.sin(t * TAU + 2);
      const ph = t * TAU + 0.6;
      p.foreN = [56 + Math.sin(ph) * 15, -Math.max(0, Math.cos(ph)) * 10];
      p.foreF = [50 + Math.sin(ph + 0.5) * 14, -Math.max(0, Math.cos(ph + 0.5)) * 9];
      p.hind = 0.5 + 0.5 * Math.sin((t + 0.45) * TAU);
      p.mane = 0.55; p.shake = -0.5 + Math.sin(t * TAU) * 0.35;
      p.eye = 'angry'; p.br = 0.8; p.crowns = 0;
      break;
    }
    case 'lunge': {
      p.stretch = 1.12; p.lift = 0.14 + (f % 2) * 0.05; p.neck = 0; p.nl = 1.2; p.head = -0.12;
      p.gape = f % 2 ? 1 : 0.85; p.mane = 0.9; p.shake = -0.8;
      p.foreN = [80 - (f % 2) * 4, 0]; p.foreF = [72, 0];
      p.hind = 1; p.eye = 'angry'; p.hump = 3; p.crowns = 0;
      break;
    }
    case 'pin': {
      // flopped flat on whatever it caught, eyes shut, smug
      p.flat = 0.6; p.br = 0.5 + 0.5 * s1; p.neck = -0.16; p.head = -0.08 + s1 * 0.03;
      p.eye = 'closed'; p.crowns = 0.5; p.crownPh = t;
      p.foreN = [60, 0]; p.foreF = [54, 0];
      break;
    }
    case 'swim': {
      // flying through the water on the fore-flippers: a deep downstroke sweeping back, the recovery
      // feathered forward; the body rides each stroke in a slow undulation, the hind flippers trail
      water(p);
      const a = t * TAU;
      p.fN = [0.95 + 1.45 * Math.sin(a), 30, 1.4 + 1.45 * Math.sin(a) + 0.3 * Math.cos(a)];
      p.fF = [1.05 + 1.35 * Math.sin(a + 0.35), 28, 1.5 + 1.35 * Math.sin(a + 0.35) + 0.3 * Math.cos(a + 0.35)];
      p.waveA = 2.4; p.wave = t;
      p.hindA = Math.sin(a + 1.2) * 0.12; p.neck = -0.06 + Math.sin(a) * 0.03; p.head = 0.02;
      p.br = 0.5 + 0.2 * Math.sin(a);
      break;
    }
    case 'glide': {
      // streamlined: flippers swept back along the flanks, the body a long slow wave
      water(p);
      p.fN = [2.3, 30, 2.75 + Math.sin(t * TAU) * 0.06]; p.fF = [2.25, 28, 2.7];
      p.waveA = 1.6; p.wave = t; p.hindA = Math.sin(t * TAU) * 0.06; p.hindS = 0.1;
      p.eye = f === 2 ? 'half' : 'open';
      break;
    }
    case 'roll': {
      // the barrel roll: the near flipper sweeps up over the back as it turns belly up, then down again
      water(p);
      const k = [0, 1, 2, 2, 0, 2, 1, 0][f];      // 0 square, 1 near flipper rising, 2 flippers wide
      p.flipV = f >= 3 && f <= 5;
      const up = k === 1 ? -0.2 : k === 2 ? -1.1 : 1.9;
      p.fN = [up, 30, up + 0.4]; p.fF = [k ? 1.8 : 1.9, 28, k ? 1.4 : 2.3];
      p.waveA = 2; p.wave = t * 2; p.hindA = -0.1 + k * 0.08; p.hindS = 0.25;
      p.neck = -0.12; p.head = -0.05; p.eye = 'open';
      break;
    }
    case 'bubble': {
      // stops face on, swells its throat a little and lets a string of bubbles go from the beak
      water(p);
      p.fN = [2.0 + Math.sin(t * TAU) * 0.25, 29, 2.35 + Math.sin(t * TAU) * 0.3]; p.fF = [2.05 + Math.sin(t * TAU + 1) * 0.25, 28, 2.4 + Math.sin(t * TAU + 1) * 0.3];
      p.sac = 0.25 + 0.2 * Math.max(0, Math.sin(t * TAU)); p.gape = 0.12; p.bubbles = 1; p.sandPh = t;
      p.neck = -0.18; p.head = -0.1; p.pitch = -0.12; p.waveA = 0.8; p.wave = t;
      break;
    }
    case 'hang': {
      // hanging upright in the water, sculling, the head cocked at you (it copies what you do)
      water(p);
      p.pitch = -1.15; p.neck = -0.05; p.head = 0.32 + Math.sin(t * TAU) * 0.08;
      p.fN = [0.9 + Math.sin(t * TAU) * 0.5, 29, 0.4 + Math.sin(t * TAU) * 0.6]; p.fF = [1.0 + Math.sin(t * TAU + 2) * 0.5, 28, 0.5 + Math.sin(t * TAU + 2) * 0.6];
      p.hindA = 0.35 + Math.sin(t * TAU) * 0.1; p.hindS = 0.3; p.waveA = 0.8; p.wave = t;
      break;
    }
    case 'grab': {
      // the snatch: a lunge, beak wide, snapping shut on the fish
      water(p);
      p.stretch = [1, 1.08, 1.1, 1.04][f]; p.neck = [-0.1, 0.02, 0.04, -0.02][f]; p.nl = [1, 1.15, 1.2, 1.05][f];
      p.gape = [0.5, 1, 0.6, 0][f]; p.fish = f === 3 ? 1 : 0; p.eye = f === 1 ? 'angry' : 'open';
      p.fN = [2.3, 30, 2.8]; p.fF = [2.25, 28, 2.75]; p.waveA = 1; p.wave = t;
      break;
    }
    case 'carry': {
      // swimming off with the fish crosswise in its beak, pleased with itself
      water(p);
      const a = t * TAU;
      p.fN = [1.2 + 1.1 * Math.sin(a), 30, 1.65 + 1.1 * Math.sin(a)]; p.fF = [1.3 + 1 * Math.sin(a + 0.35), 28, 1.75 + 1 * Math.sin(a + 0.35)];
      p.waveA = 2.4; p.wave = t; p.hindA = Math.sin(a + 1.2) * 0.12; p.fish = 1; p.gape = 0.18; p.neck = -0.14;
      break;
    }
    case 'tired': {
      // collapsed, flanks heaving, beak open, tongue lolling out, panting
      p.flat = 0.45; p.br = f % 2 ? 1 : 0.1;
      p.neck = 0.14; p.head = 0.16 + (f % 2) * 0.04;
      p.gape = f % 2 ? 0.5 : 0.3; p.tongue = 1; p.sac = f % 2 ? 0.2 : 0.1;
      p.eye = 'half';
      p.foreN = [62, 0]; p.foreF = [56, 0];
      p.crowns = 0.8; p.crownPh = t;
      break;
    }
  }
  return p;
}


const EYE: EyeSpec = { r: 1.6, iris: hex('#f2b43a'), lash: hex('#140c10'), pupil: hex('#140a0c'), ring: hex('#5a0e14') };

function mats(sk: Sk) {
  return {
    fur: sk.m(rmp('#1c1824', { n: 8, dark: 0.66, light: 0.28, cool: 0.5, warm: 0.12 }), { edge: 1 }),
    furB: sk.m(rmp('#1c1820', { n: 7, dark: 0.6, light: 0.34, cool: 0.4, warm: 0.15 }), { edge: 1 }),
    lockT: sk.m(rmp('#45404e', { n: 6, dark: 0.6, light: 0.32, cool: 0.4 }), { edge: 1 }),
    mane: sk.m(rmp('#26212e', { n: 8, dark: 0.66, light: 0.36, cool: 0.5, warm: 0.1 }), { edge: 1 }),
    skin: sk.m(rmp('#9a5a66', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    crease: sk.m(rmp('#3a1c26', { n: 4, dark: 0.45, light: 0.3 }), { edge: 0 }),
    face: sk.m(rmp('#b41e28', { n: 7, dark: 0.6, light: 0.42, warm: 0.12, cool: 0.35 }), { edge: 1 }),
    faceD: sk.m(rmp('#6e1018', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1 }),
    beak: sk.m(rmp('#e6d6b2', { n: 7, dark: 0.6, light: 0.5, warm: 0.25 }), { edge: 1 }),
    beakB: sk.m(rmp('#8a1e26', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    beakE: sk.m(rmp('#8a7a5e', { n: 5, dark: 0.55, light: 0.35 }), { edge: 1 }),
    white: sk.m(rmp('#f0ece4', { n: 5, dark: 0.36, light: 0.3, at: 3 }), { edge: 1 }),
    sac: sk.m(rmp('#d83c52', { n: 7, dark: 0.58, light: 0.55 }), { edge: 1 }),
    vein: sk.m(rmp('#8e1a30', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1 }),
    mouth: sk.m(rmp('#4e121e', { n: 4, dark: 0.45, light: 0.3 }), { edge: 0 }),
    tongue: sk.m(rmp('#ec8294', { n: 5, dark: 0.45, light: 0.35 }), { edge: 1 }),
    flip: sk.m(rmp('#2a2226', { n: 7, dark: 0.58, light: 0.4 }), { edge: 1 }),
    flipD: sk.m(rmp('#17121a', { n: 5, dark: 0.5, light: 0.3 }), { edge: 1 }),
    claw: sk.m(rmp('#d6c8ae', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    horn: sk.m(rmp('#4a3a34', { n: 5, dark: 0.5, light: 0.35 }), { edge: 1 }),
    leech: sk.m(rmp('#3a2f96', { n: 6, dark: 0.6, light: 0.5, cool: 0.4 }), { edge: 1 }),
    sand: sk.m(rmp('#d9c08c', { n: 4, dark: 0.45 }), { edge: 0, noRim: true }),
  };
}
type M = ReturnType<typeof mats>;
const COL = {
  brow: hex('#f6f2ea'), brow2: hex('#cfcac2'), brow3: hex('#e2dcd2'), nostril: hex('#2a0e10'), pit: hex('#e8a8a0'),
  whisk: hex('#f0e8dc'), whisk2: hex('#c8bfb2'), nail: hex('#e8dcc4'), bubRim: hex('#c8f0ff', 230), bubIn: hex('#a8e0f4', 90), bubHi: hex('#ffffff'), crownT: hex('#e4fdff'), crown: hex('#9ee8f4'), crown2: hex('#bff4fa'), crownC: hex('#98a8e8'),
};

// ------------------------------------------------------------------ spine
// rest x / radius of the spine controls, tail -> shoulders: slim hips, heavy chest and shoulders
const SX = [-70, -55, -36, -14, 8, 27];
const SR = [6, 12.5, 17.5, 21.5, 24.5, 25];

/** Catmull-Rom through the controls: n + 1 samples and the radius at each. */
function spline(ctrl: V2[], rad: number[], n: number): { pts: V2[]; r: number[] } {
  const pts: V2[] = [], r: number[] = [];
  const m = ctrl.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * m, k = Math.min(m - 1, Math.floor(u)), f = u - k;
    const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(m, k + 2)];
    const f2 = f * f, f3 = f2 * f;
    const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
    pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    r.push(rad[k] + (rad[k + 1] - rad[k]) * (f * f * (3 - 2 * f)));
  }
  return { pts, r };
}

interface Rig {
  P: P; M: M;
  at(u: number): { p: V2; r: number; a: number };
  tail: V2; sh: V2; shR: number;
  n0: V2; hc: V2; neckA: number; H: Frame2;
  /** a point along the neck (t 0 at the shoulders .. 1 at the skull) offset s px toward the nape */
  nk(t: number, s: number): V2;
  nr(t: number): number;
}

const ID = { BODY: 1, MANE: 2, HEAD: 3, CREASE: 4, LIMB: 5, HAND: 6, CLAW: 7, BEAK: 8, JAW: 9, SAC: 10, MOUTH: 11, TONGUE: 12, LEECH: 13 };

function draw(sk: Sk, anim: string, frame: number, eyeIn: BeastEye): { head: V2; eye: V2 } {
  const n = SEAL_ANIMS[anim as keyof typeof SEAL_ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const M = mats(sk);
  sk.clipY = P.swim ? Infinity : 0;
  const eyeSt: Eye = eyeIn === 'open' ? P.eye : eyeIn === 'scared' ? 'alert' : eyeIn;

  // ---- spine: lying on the sand, the chest lifted (rear stays down), humped, rippling
  const ctrl: V2[] = [], rad: number[] = [];
  for (let i = 0; i < SX.length; i++) {
    const u = i / (SX.length - 1);
    const r = SR[i] * (1 + P.br * 0.04 * Math.sin(Math.PI * Math.min(1, u * 1.2))) * (1 - P.flat * 0.1) * (P.swim ? 0.88 : 1);
    const x = SX[i] * P.stretch * (P.swim ? 1.06 : 1) + (P.stretch - 1) * 12;
    let y = P.swim ? 0 : -r * (0.88 - P.flat * 0.2);
    y -= P.lift * 62 * sm((u - 0.5) / 0.42);
    y -= P.hump * Math.sin(Math.PI * clamp((u - 0.05) / 0.85));
    y -= P.waveA * Math.sin(TAU * (P.wave - u * 0.8)) * Math.sin(Math.PI * u);
    ctrl.push([x, y]); rad.push(r);
  }
  // afloat, the whole body pitches about its middle
  if (P.swim && P.pitch) {
    const c = Math.cos(P.pitch), sn = Math.sin(P.pitch);
    for (const q of ctrl) { const x = q[0], y = q[1]; q[0] = x * c - y * sn; q[1] = x * sn + y * c; }
  }
  const sp = spline(ctrl, rad, 16);
  const at = (u: number) => {
    const k = clamp(u) * (sp.pts.length - 1), i = Math.min(sp.pts.length - 2, Math.floor(k)), f = k - i;
    const a = Math.atan2(sp.pts[i + 1][1] - sp.pts[i][1], sp.pts[i + 1][0] - sp.pts[i][0]);
    return { p: lerp2(sp.pts[i], sp.pts[i + 1], f), r: sp.r[i] + (sp.r[i + 1] - sp.r[i]) * f, a };
  };
  const sh = ctrl[ctrl.length - 1], shR = rad[rad.length - 1];
  const bodyA = at(0.93).a;
  // ---- neck and head placement
  const neckA = P.neck + bodyA * 0.7 + (P.swim ? P.pitch * 0.3 : 0);
  const nl = 20 * P.nl;
  const n0: V2 = [sh[0] + 7, sh[1] - 2];
  const hc: V2 = [n0[0] + Math.cos(neckA) * nl, n0[1] + Math.sin(neckA) * nl];
  const H = new Frame2(hc, neckA * 0.4 + P.head, 1);
  const nb: V2 = [sh[0] - 6, sh[1] + 1];
  const nr = (t: number) => shR * (1 - t * 0.44) + P.sac * 1.2;
  const nk = (t: number, s: number): V2 => {
    // along the neck: from nb through n0 to hc
    const p = t < 0.3 ? lerp2(nb, n0, t / 0.3) : lerp2(n0, hc, (t - 0.3) / 0.7);
    const a = t < 0.3 ? Math.atan2(n0[1] - nb[1], n0[0] - nb[0]) * (1 - t / 0.3) + neckA * (t / 0.3) : neckA;
    return [p[0] + Math.sin(a) * s, p[1] - Math.cos(a) * s];
  };
  const R: Rig = { P, M, at, tail: ctrl[0], sh, shR, n0, hc, neckA, H, nk, nr };

  // ---------------------------------------------------------------- far limbs (behind the body)
  /** a relief just big enough for one side's limbs */
  const limbRelief = (near: boolean) => {
    const f = foreGeo(R, near), h = hindGeo(R, near);
    const pts: V2[] = [f.shoulder, f.elbow, f.w, [f.w[0] + Math.cos(f.ha) * 22, f.w[1] + Math.sin(f.ha) * 22], h.root, [h.root[0] + Math.cos(h.a) * 25, h.root[1] + Math.sin(h.a) * 25]];
    return new Relief(sk, Math.min(...pts.map(q => q[0])) - 14, Math.min(...pts.map(q => q[1])) - 14, Math.max(...pts.map(q => q[0])) + 14, Math.max(...pts.map(q => q[1])) + 14);
  };
  {
    const FR = limbRelief(false);
    hindFlipper(FR, R, false);
    foreFlipper(FR, R, false);
    sk.np();
    FR.emit({ bias: -0.2, drop: 2.2, seam: 1, seamDark: 0.3, ao: 0.06, aoR: 3 });
  }

  // ---------------------------------------------------------------- the body contour
  const up = (a: number): V2 => [Math.sin(a), -Math.cos(a)];
  const bp = (u: number, k: number, sharp = 0): LM => { const q = at(u), d = up(q.a); return [q.p[0] + d[0] * q.r * k, q.p[1] + d[1] * q.r * k, sharp]; };
  const t0 = at(0), td = up(t0.a);
  const tailTip: LM = [t0.p[0] - Math.cos(t0.a) * 5 + td[0] * 1, t0.p[1] - Math.sin(t0.a) * 5 + td[1] * 1, 0.4];
  const sag = P.swim ? 0.01 : 0.06 + P.flat * 0.06;
  const body: LM[] = [
    tailTip,
    bp(0.04, 0.9), bp(0.12, 0.92), bp(0.24, 0.95), bp(0.38, 0.97), bp(0.52, 0.98), bp(0.66, 0.99), bp(0.78, 1.01), bp(0.88, 1.03),
    // the shoulder hump and the heavy nape
    [...nk(0.12, nr(0.12) * 1.02), 0] as LM, [...nk(0.4, nr(0.4) * 0.98), 0] as LM, [...nk(0.66, nr(0.66) * 0.95), 0] as LM, [...nk(0.9, nr(0.9) * 0.92), 0] as LM,
    // round the skull end (the head covers it) and back along the sagging throat
    [...nk(1.02, 0), 0] as LM,
    [...nk(0.92, -nr(0.92) * 1.04), 0] as LM, [...nk(0.66, -nr(0.66) * (1.1 + P.sac * 0.04)), 0] as LM, [...nk(0.4, -nr(0.4) * 1.08), 0] as LM,
    // the deep brisket, the belly settling on the sand, the groin, the tail
    bp(0.94, -1.08), bp(0.84, -1.06 - sag), bp(0.7, -1.04 - sag), bp(0.55, -1.02 - sag), bp(0.4, -1 - sag * 0.5), bp(0.26, -0.98), bp(0.14, -0.94), bp(0.05, -0.9),
  ];
  let poly = cspline(body, 1.2);
  // guard hair breaks the outline: long on the back and nape, shorter along the belly
  // (in the water the coat lies slicked back and short)
  const fl = P.swim ? 0.55 : 1;
  poly = fringe(poly, 2.6, 5, (_x, _y, nx, ny) => (ny < -0.35 ? [4.6 * fl, -0.6 - P.swim * 0.3] : ny > 0.5 ? [2.2 * fl, 0.35] : nx < -0.6 ? [2.6 * fl, 0] : null));

  // ---- the axis (spine + neck) the fur and the markings follow
  const axis: V2[] = [...sp.pts.slice(0, 15), nb, n0, lerp2(n0, hc, 0.5), hc];
  const cumA = arcs(axis);
  const radA = axis.map((_, i) => (i < 15 ? sp.r[i] : i === 15 ? nr(0) : i === 16 ? nr(0.3) : i === 17 ? nr(0.65) : nr(1)));
  const radAt = (s: number) => {
    let i = 1;
    while (i < cumA.length - 1 && cumA[i] < s) i++;
    const f = clamp((s - cumA[i - 1]) / Math.max(1e-6, cumA[i] - cumA[i - 1]));
    return radA[i - 1] + (radA[i] - radA[i - 1]) * f;
  };
  const sNeck = cumA[15];
  // the white star freckles: an irregular constellation down the upper flank, each spot ragged
  const STARS: [number, number, number][] = [[0.8, 0.4, 3.4], [0.73, 0.55, 2.4], [0.67, 0.3, 1.7], [0.6, 0.47, 2.9], [0.52, 0.33, 2], [0.47, 0.56, 1.4], [0.4, 0.42, 2.4], [0.33, 0.5, 1.5], [0.26, 0.36, 1.2], [0.85, 0.22, 1.5], [0.56, 0.62, 1.1]];
  const spots = STARS.map(([u, v, s]) => { const q = at(u), d = up(q.a); return { c: [q.p[0] + d[0] * q.r * v, q.p[1] + d[1] * q.r * v] as V2, rx: s * 1.25, ry: s * 0.9, a: q.a }; });
  // the neck crease: a bare collar of pink skin behind the skull
  const cc = lerp2(hc, n0, 0.36), cax = Math.cos(neckA), cay = Math.sin(neckA);
  const bibB = lerp2(n0, hc, 0.3);
  const bibC: V2 = [bibB[0] - Math.sin(neckA) * shR * 0.62, bibB[1] + Math.cos(neckA) * shR * 0.62];

  const furTex = memoTex(sk, (p: Sp, o: Tx) => {
    const q = onPath(axis, cumA, p.x, p.y);
    const r = radAt(q.s), v = q.c / Math.max(1, r);       // +1 the back .. -1 the belly
    const a = Math.atan2(q.ay, q.ax);
    const neck = q.s > sNeck;
    // the guard hair lies back along the body and droops down the flanks; long locks on the back
    const ang = a + Math.PI - (0.15 + (1 - v) * 0.32) + (vn(p.x / 14, p.y / 11) - 0.5) * 0.7;
    const len = 5 + Math.max(0, v) * 4;
    const h = strands(p.x, p.y, ang, len, 1.8, 11);
    // the locks clump: a broad wave of light and shadow under the strands
    const clump = strands(p.x + 3, p.y, ang + 0.1, len * 2.2, 4.2, 12);
    o.z += h * 0.9 + clump * 0.9;
    o.m = M.fur;
    const tip = FS.tip, g = hh(FS.row, FS.seg, 13);
    if (v > 0.15 && tip > 0.78 && g < 0.3) o.m = M.lockT;          // grizzled tips
    else if (tip < 0.18 && g > 0.6) o.t -= 0.06;                    // dark roots
    if (v < -0.5) o.m = M.furB;
    // the crease behind the skull: bare pink skin either side of a dark groove, bowed like a collar
    if (neck) {
      const dx = p.x - cc[0], dy = p.y - cc[1];
      const al = dx * cax + dy * cay, ac = -dx * cay + dy * cax;
      const bow = (ac / 13) ** 2 * 3;
      const dd = Math.abs(al + bow);
      if (Math.abs(ac) < nr(0.75) * 0.9 && dd < 2.6) { o.m = dd < 0.9 ? M.crease : M.skin; o.z = dd < 0.9 ? -0.6 : 0.2; return; }
      // the white bib on the throat
      // the white bib on the throat: a ragged crescent
      const e1 = Math.hypot((p.x - bibC[0]) / 8.5, (p.y - bibC[1]) / 11) + (hh(p.x, p.y, 15) - 0.5) * 0.3;
      const e2 = Math.hypot((p.x - bibC[0] - cax * 6.5) / 6.5, (p.y - bibC[1] - cay * 6.5 + 3) / 8.5);
      if (e1 < 1 && e2 > 1 && v < 0) { o.m = M.white; if (h < -0.15) o.t -= 0.1; return; }
    }
    // the stars: ragged white spots broken by the fur, and the scattered fine freckles
    if (!neck && v > 0.05) {
      for (const s of spots) {
        const dx = p.x - s.c[0], dy = p.y - s.c[1];
        const e = Math.hypot((dx * Math.cos(s.a) + dy * Math.sin(s.a)) / s.rx, (-dx * Math.sin(s.a) + dy * Math.cos(s.a)) / s.ry) + (hh(p.x, p.y, 17) - 0.5) * 0.45;
        if (e < 1) { o.m = M.white; if (h < -0.2) o.t -= 0.12; else o.t += 0.04; return; }
      }
      const fx = Math.floor(q.s / 5), fy = Math.floor(v * 6);
      if (v < 0.75 && hh(fx, fy, 19) < 0.11 && frac(q.s / 5) < 0.3 && frac(v * 6) < 0.25) { o.m = M.white; return; }
    }
  });

  // ---------------------------------------------------------------- the body relief
  const bbx: V2[] = [...poly, H.p(-16, -18), H.p(14, -16), H.p(14, 14), H.p(-16, 14)];
  const BR = new Relief(sk, Math.min(...bbx.map(q => q[0])) - 16, Math.min(...bbx.map(q => q[1])) - 16, Math.max(...bbx.map(q => q[0])) + 6, Math.max(...bbx.map(q => q[1])) + 6);
  BR.region(poly, { z: 0, R: 16, H: 18, id: ID.BODY, tex: furTex, pow: 0.85 });
  // under the coat: the shoulder blade and the upper arm, the haunch, the ribs
  { const s = at(0.86), d = up(s.a); BR.bump(s.p[0] + d[0] * s.r * 0.3, s.p[1] + d[1] * s.r * 0.3, 14, 10, 4, s.a + 0.6); }
  { const s = at(0.22), d = up(s.a); BR.bump(s.p[0] + d[0] * s.r * 0.2, s.p[1] + d[1] * s.r * 0.2, 10, 8, 3); }
  { const s = at(0.6); BR.bump(s.p[0], s.p[1], 22, 12, 2.5, s.a); }
  // blubber rolls: folds ringing the neck, the chest crease behind the arm, belly folds on the bend
  for (const t of [0.22, 0.52, 0.86]) {
    const a = nk(t, nr(t) * 0.95), b = nk(t + 0.03, 0), c = nk(t, -nr(t) * 1.02);
    BR.line([a, b, c], 4.4, -3.4 - P.lift * 1.6, { fold: true, only: ID.BODY });
  }
  {
    const s = at(0.82), d = up(s.a);
    const a: V2 = [s.p[0] - d[0] * s.r * 0.15, s.p[1] - d[1] * s.r * 0.15], b: V2 = [s.p[0] - d[0] * s.r * 0.95 - 3, s.p[1] - d[1] * s.r * 0.95];
    BR.line([a, lerp2(a, b, 0.5), b], 4, -3.2, { fold: true, only: ID.BODY });
  }
  const bend = Math.max(P.lift, P.hump / 15, P.flat);
  for (const u of [0.48, 0.58, 0.68]) {
    const s = at(u), d = up(s.a);
    const a: V2 = [s.p[0] - d[0] * s.r * 0.2, s.p[1] - d[1] * s.r * 0.2], b: V2 = [s.p[0] - d[0] * s.r * 0.98 + 2, s.p[1] - d[1] * s.r * 0.98];
    BR.line([a, b], 3.6, -(1.6 + bend * 2.8), { fold: true, only: ID.BODY });
  }
  // the crease's groove
  {
    const a = lerp2(cc, [cc[0] + Math.sin(neckA) * 12, cc[1] - Math.cos(neckA) * 12], 1), b = lerp2(cc, [cc[0] - Math.sin(neckA) * 12, cc[1] + Math.cos(neckA) * 12], 1);
    BR.line([a, cc, b], 2.2, -1.6, { only: ID.BODY });
  }

  // ---- the mane: a mat of long locks from the crown down over the nape and the shoulders
  {
    const mane: LM[] = [];
    const lift = 2 + P.mane * 3;
    for (let i = 0; i <= 6; i++) { const t = 1.05 - i * 0.17; mane.push([...nk(t, nr(Math.min(1, t)) * 0.95 + lift * (1 - i * 0.08)), 0] as LM); }
    for (let i = 0; i <= 3; i++) mane.push(bp(0.97 - i * 0.07, 1.05 + lift / 25));
    for (let i = 3; i >= 0; i--) mane.push(bp(0.97 - i * 0.07, 0.62));
    for (let i = 6; i >= 0; i--) { const t = 1.02 - i * 0.17; mane.push([...nk(t, nr(Math.min(1, t)) * 0.42), 0] as LM); }
    let mp = cspline(mane, 1.2);
    // the locks: long tips breaking the outline, falling back (and standing up when it bristles)
    mp = fringe(mp, 3.2, 21, (_x, _y, _nx, ny) => (ny < 0.2 ? [6 + P.mane * 5, -0.85 + P.mane * 0.5 + P.shake * 0.3] : null));
    const sw = P.shake * 0.3;
    BR.region(mp, {
      z: 6, R: 5, H: 10, id: ID.MANE, blend: 2, tex: (p, o) => {
        const q = onPath(axis, cumA, p.x, p.y);
        const a = Math.atan2(q.ay, q.ax);
        const h = strands(p.x, p.y, a + Math.PI - 0.5 + P.mane * 0.45 + sw, 9, 2.2, 23);
        o.z += h * 1.6;
        o.m = M.mane;
        if (FS.tip > 0.75 && hh(FS.row, FS.seg, 25) < 0.35) o.m = M.lockT;
        if (FS.tip < 0.15) o.t -= 0.08;
      },
    });
  }

  // ---------------------------------------------------------------- the head (merged into the neck)
  const hp = (x: number, y: number, sharp = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sharp]; };
  const skull: LM[] = [hp(-12.5, -1), hp(-9.5, -8.5), hp(-2.5, -12.4), hp(4.5, -10.6), hp(9.4, -6.6), hp(11, -1.8), hp(11, 4.2), hp(8.6, 8.4), hp(2.4, 10.6), hp(-4.6, 10.4), hp(-10.6, 6.4)];
  const faceTex = (p: Sp, o: Tx) => {
    const dx = p.x - H.o[0], dy = p.y - H.o[1], c = Math.cos(-H.a), s = Math.sin(-H.a);
    const hx = dx * c - dy * s, hy = dx * s + dy * c;
    if (hx + hy * 0.3 > -3.5) {
      // bare crimson skin: fine wrinkles round the eye and the cheek, darker under the jaw
      o.m = hy > 6.5 ? M.faceD : M.face;
      if (frac(hx * 0.42 + hy * 0.12) < 0.14 && hy > -6) { o.z -= 0.35; o.t -= 0.05; }
      if (hh(p.x, p.y, 27) < 0.07) o.t -= 0.08;
      return;
    }
    const h = strands(p.x, p.y, H.a + Math.PI - 0.2, 4, 1.6, 29);
    o.z += h * 0.8;
    o.m = hy > 5 ? M.furB : M.fur;
    if (FS.tip > 0.8 && hh(FS.row, FS.seg, 31) < 0.3) o.m = M.lockT;
  };
  BR.region(cspline(skull, 0.8), { z: 14, R: 7, H: 8, id: ID.HEAD, blend: 4, tex: faceTex });
  { const c = H.p(6, 3.8); BR.bump(c[0], c[1], 6.5, 4.6, 2.4, H.a + 0.2); }      // the heavy cheek
  { const c = H.p(2.2, -6.8); BR.bump(c[0], c[1], 4.5, 2.4, 1.6, H.a); }        // the brow over the eye
  BR.line([H.p(-3.2, -10), H.p(-3.8, 0), H.p(-1.6, 8.8)], 1.6, -0.8, { only: ID.HEAD }); // the ear line, where the fur stops
  BR.shadow(ID.MANE, 2, 2.6, 0.12, ID.BODY, 2);
  BR.shadow(ID.HEAD, 2, 2.4, 0.1, ID.BODY, 2);
  sk.np();
  BR.emit({ drop: 3, seam: 1.6, seamDark: 0.28, ao: 0.07, aoR: 3, bias: -0.07 });

  // ---------------------------------------------------------------- the leeches in the crease
  leeches(sk, R);
  // ---------------------------------------------------------------- the beak-plates, the sac
  drawBeak(sk, R);
  // ---------------------------------------------------------------- near limbs
  {
    const NR = limbRelief(true);
    hindFlipper(NR, R, true);
    foreFlipper(NR, R, true);
    sk.np();
    NR.emit({ drop: 2.4, seam: 1, seamDark: 0.3, ao: 0.06, aoR: 3 });
    nails(sk, R);
  }

  // ---- eye last (overlay) under a white brow stripe
  const eyeP = H.p(2, -3.4);
  for (let i = 0; i < 8; i++) {
    const q = H.p(4.5 - i * 1.1, -6.6 + i * 0.28 - (i > 4 ? (i - 4) * 0.35 : 0) + (eyeSt === 'angry' ? Math.max(0, 3 - i) * 0.6 : 0));
    sk.overPaint(q[0], q[1], i < 6 ? COL.brow : COL.brow2);
    if (i > 0 && i < 5) sk.overPaint(q[0], q[1] + 1, COL.brow3);
  }
  const ep = sealEye(sk, eyeP, eyeSt);

  // ---- flicked sand arcing over the back
  if (P.sand) {
    for (let i = 0; i < 16; i++) {
      const ph = clamp(P.sandPh + (hh(i, 3, 4) - 0.5) * 0.35);
      const x = 22 + (-70 - 22) * ph + (hh(i, 1, 5) - 0.5) * 16;
      const y = -62 * Math.sin(Math.PI * clamp(ph * 0.85 + 0.12)) + (hh(i, 2, 6) - 0.5) * 10 - 10;
      const r = hh(i, 4, 7) < 0.3 ? 1.1 : 0.7;
      sk.np(true);
      sk.ell(x, y, r, r, M.sand, { z: 120 });
    }
  }
  // ---- a fish held in the beak (the steal), dangling by its head
  if (P.fish > 0) {
    const tip = H.p(25, 4);
    const fh = diveFishHeld('kingfish', 36, H.a - Math.PI / 2 + 0.55, 0.84);
    for (let y = 0; y < fh.buf.h; y++) for (let x = 0; x < fh.buf.w; x++) {
      const c = fh.buf.data[y * fh.buf.w + x];
      if (c >>> 24) sk.over(tip[0] + x - fh.ax, tip[1] + y - fh.ay, c);
    }
  }
  // ---- bubbles let go from the beak, wobbling up
  if (P.bubbles > 0) {
    const o = H.p(20, -3);
    for (let i = 0; i < 4; i++) {
      const ph = (P.sandPh + i / 4) % 1;
      const r = 1.2 + ph * 2.2 + (i % 2) * 0.6;
      bubble(sk, o[0] + Math.sin(ph * 9 + i) * 2.5 + ph * 4, o[1] - 3 - ph * 34, r);
    }
  }
  const top = H.p(-2, -16);
  // ---- rolled belly-up: mirror the whole painting about the body's axis and relight it from above
  if (P.flipV) { flipSk(sk); return { head: [top[0], -(top[1] - 4)], eye: [ep[0], -ep[1]] }; }
  return { head: [top[0], top[1] - 4], eye: ep };
}

/** a bubble ring: a pale rim, a clear middle, a glint (overlay pixels) */
function bubble(sk: Sk, cx: number, cy: number, r: number) {
  const R = Math.ceil(r) + 1;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x + 0.5 - (cx % 1), y + 0.5 - (cy % 1));
    const X = Math.floor(cx) + x, Y = Math.floor(cy) + y;
    if (d <= r + 0.45 && d > r - 0.65) sk.over(X, Y, x < 0 && y < 0 ? COL.bubHi : COL.bubRim);
    else if (d <= r - 0.65) sk.over(X, Y, COL.bubIn);
  }
  if (r >= 1.8) sk.over(Math.floor(cx) - 1, Math.floor(cy) - 1, COL.bubHi);
}

/** mirror a painting top to bottom about local y = 0 (the canvas must be symmetric about its origin row)
 *  and turn its light over, so the belly that now faces up is lit */
function flipSk(sk: Sk) {
  const W = sk.w, H = sk.h, oy = sk.oy;
  const rows = (a: { [i: number]: number }, r0: number, r1: number) => {
    for (let x = 0; x < W; x++) { const i = r0 * W + x, j = r1 * W + x, t = a[i]; a[i] = a[j]; a[j] = t; }
  };
  for (let r = 0; r < oy; r++) {
    const m = 2 * oy - 1 - r;
    if (m < 0 || m >= H || m <= r) continue;
    rows(sk.mat, r, m); rows(sk.lum, r, m); rows(sk.z, r, m); rows(sk.part, r, m); rows(sk.ov, r, m);
  }
  for (let i = 0; i < W * H; i++) if (sk.mat[i]) sk.lum[i] = 1 - sk.lum[i];
}

/** Crimson face's beak-plates (upper keeled and hooked, lower hinged), the mouth, the throat sac, whiskers. */
function drawBeak(sk: Sk, R: Rig) {
  const { P, M, H } = R;
  const bb = [H.p(-2, -12), H.p(36, -8), H.p(36, 14), H.p(-2, 14), H.p(5 + P.sac * 3, 9 + P.sac * 7)];
  const pad = 6 + P.sac * 24;
  const BK = new Relief(sk, Math.min(...bb.map(q => q[0])) - pad, Math.min(...bb.map(q => q[1])) - pad, Math.max(...bb.map(q => q[0])) + pad, Math.max(...bb.map(q => q[1])) + pad);
  const hp = (x: number, y: number, sharp = 0): LM => { const q = H.p(x, y); return [q[0], q[1], sharp]; };
  const z0 = 30;
  // the throat sac: a wrinkled wattle at rest, a glossy veined balloon when it roars
  if (P.sac > 0.03) {
    const s = P.sac;
    const c = H.p(5 + s * 3, 9 + s * 7);
    const rx = 5 + s * 12, ry = 3.4 + s * 10, ra = H.a + 0.25;
    const ca = Math.cos(ra), sa = Math.sin(ra);
    const sac: LM[] = [];
    for (let i = 0; i < 12; i++) {
      const q = (i / 12) * TAU;
      const wob = 1 + (hh(i, 1, 41) - 0.5) * (s > 0.5 ? 0.06 : 0.16) - (q > Math.PI * 1.2 && q < Math.PI * 1.8 ? 0.12 : 0);
      const u = Math.cos(q) * rx * wob, v = Math.sin(q) * ry * wob;
      sac.push([c[0] + u * ca - v * sa, c[1] + u * sa + v * ca, 0]);
    }
    BK.region(cspline(sac, 0.8), {
      z: z0 - 6, R: Math.min(rx, ry) * 0.8, H: Math.min(rx, ry) * 0.9, id: ID.SAC, tex: (p, o) => {
        const dx = p.x - c[0], dy = p.y - c[1];
        const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        o.m = M.sac;
        if (s > 0.5) {
          // branching veins over the stretched skin
          const vv = Math.sin(u * 6 + Math.sin(v * 4) * 1.4) + Math.sin(v * 8 - u * 2.5) * 0.45;
          if (Math.abs(vv) < 0.12 && v > -0.6 && u < 0.7) { o.m = M.vein; o.z += 0.4; }
        } else if (frac(u * 4 + v * 0.6) < 0.3) { o.z -= 0.6; o.t -= 0.06; }
      },
    });
  }
  // the lower beak-plate (opens with the gape) and the mouth inside
  const g = P.gape;
  const la = H.ang(0.2 + g * 0.72);
  const l0 = H.p(9.5, 4.8);
  const jp = (u: number, v: number, sharp = 0): LM => [l0[0] + Math.cos(la) * u - Math.sin(la) * v, l0[1] + Math.sin(la) * u + Math.cos(la) * v, sharp];
  if (g > 0.08) {
    const mo: LM[] = [hp(10, 1.6), hp(27, 4.4), jp(18, -0.6), jp(2, -1.2)];
    BK.region(cspline(mo, 0.8), { z: z0 - 2, R: 2, H: 1, id: ID.MOUTH, tex: (p, o) => { o.m = M.mouth; void p; } });
    if (P.tongue < 0.5) BK.cap([H.p(11, 5)[0], H.p(11, 5)[1]], [jp(10, -0.6)[0], jp(10, -0.6)[1]], 2.4 * g + 0.4, 1.4 * g + 0.4, { z: z0 - 1, id: ID.TONGUE, tex: M.tongue });
  }
  const lower: LM[] = [jp(-0.5, -1.6), jp(8, -1.6), jp(15, -1.1), jp(19.4, 0.4, 0.7), jp(16, 1.9), jp(9, 3.1), jp(0, 3.4)];
  BK.region(cspline(lower, 0.6), {
    z: z0, R: 2, H: 2.6, id: ID.JAW, tex: (p, o) => {
      const dx = p.x - l0[0], dy = p.y - l0[1], u = dx * Math.cos(la) + dy * Math.sin(la), v = -dx * Math.sin(la) + dy * Math.cos(la);
      o.m = u < 3.2 ? M.beakB : v < -0.6 && p.s < 1.2 ? M.beakE : M.beak;
      if (frac(u / 2.6) < 0.18 && u > 3) o.z -= 0.3;
    },
  });
  // the lolling tongue (panting), out of the side of the gape
  if (P.tongue > 0.5) {
    const tb = H.p(14, 6);
    BK.tube([tb, [tb[0] + 4, tb[1] + 3], [tb[0] + 6, tb[1] + 7.5]], t => 2 - t * 0.6, { z: z0 + 6, id: ID.TONGUE, tex: M.tongue });
  }
  // the upper beak-plate: arched, keeled and hooked like a raven's, crimson at the base
  const upper: LM[] = [hp(8, -2.6), hp(13, -5.8), hp(20, -5.4), hp(26, -3.2), hp(30, 0.2), hp(31.6, 4.2), hp(30.8, 8.8, 0.85), hp(29.2, 6.2), hp(26.6, 4.8), hp(19, 4), hp(9.6, 3.6)];
  BK.region(cspline(upper, 0.6), {
    z: z0 + 2, R: 2.6, H: 4, id: ID.BEAK, tex: (p, o) => {
      const dx = p.x - H.o[0], dy = p.y - H.o[1], c = Math.cos(-H.a), s = Math.sin(-H.a);
      const hx = dx * c - dy * s, hy = dx * s + dy * c;
      o.m = M.beak;
      if (hx < 11.5) { o.m = M.beakB; return; }
      // growth lines across the keratin, a darker cutting edge, wear at the hook
      if (frac(hx / 2.8 + hy * 0.08) < 0.16) { o.z -= 0.35; o.t -= 0.04; }
      if (hy > 2.6 && p.s < 1.3) o.m = M.beakE;
      if (hx > 29 && hy > 3) o.t -= 0.06;
    },
  });
  BK.line([H.p(12, -4.6), H.p(20, -4), H.p(28, -0.6)], 1.8, 1.1, { only: ID.BEAK });   // the keel
  sk.np();
  BK.emit({ drop: 2, seam: 1, seamDark: 0.3, ao: 0.05, aoR: 2 });
  // the nostril slit and the whisker pits
  const ns = H.p(14, -2.4);
  sk.overPaint(ns[0], ns[1], COL.nostril); sk.overPaint(ns[0] + 1, ns[1] + 0.4, COL.nostril);
  for (const [dx, dy] of [[7, 3], [8.6, 4], [6.4, 4.8], [9.2, 2.4]] as V2[]) { const q = H.p(dx, dy); sk.overPaint(q[0], q[1], COL.pit); }
  // whiskers: pale strands fanning back and down from the cheek
  for (let i = 0; i < 3; i++) {
    const a = H.ang(0.12 + i * 0.22);
    const o = H.p(8.5 + i * 0.4, 3 + i * 0.9);
    for (let s = 2; s < 10 + i * 1.5; s++) {
      if (hh(i, s, 3) < 0.12) continue;
      sk.over(o[0] + Math.cos(a) * s, o[1] + Math.sin(a) * s + s * s * 0.03, s < 6 ? COL.whisk : COL.whisk2);
    }
  }
}

/** The seal's eye: the core eye plus a heavy half-closed lid. */
function sealEye(sk: Sk, c: V2, st: Eye): V2 {
  if (st === 'half') {
    const x = Math.floor(c[0]), y = Math.floor(c[1]);
    for (let dx = -2; dx <= 2; dx++) sk.over(x + dx, y, hex('#140c10'));
    sk.over(x - 1, y + 1, hex('#c49030')); sk.over(x, y + 1, hex('#e0a838')); sk.over(x + 1, y + 1, hex('#140a0c'));
    return c;
  }
  return drawEye(sk, c[0], c[1], EYE, st === 'alert' ? 'alert' : st === 'angry' ? 'angry' : st === 'closed' ? 'closed' : 'open');
}

/** The crown leeches: glossy ringed slugs lying in the crease, crowns of pale gill-fronds at the free end. */
function leeches(sk: Sk, R: Rig) {
  const { P, M, n0, hc, neckA } = R;
  const c = lerp2(hc, n0, 0.36);
  const ax = Math.cos(neckA), ay = Math.sin(neckA), bx = -Math.sin(neckA), by = Math.cos(neckA);
  const rN = 13;
  const at = (o: number, s: number): V2 => [c[0] + ax * o + bx * s, c[1] + ay * o + by * s];
  const LR = new Relief(sk, c[0] - 22, c[1] - 22, c[0] + 22, c[1] + 22);
  const S = [-8.5, -4.5, -0.5, 3.5, 7.5];
  const tips: { p: V2; a: number }[] = [];
  S.forEach((s, i) => {
    const bow = (s / rN) ** 2 * 3;
    const b = at(-bow + (i % 2 ? 0.8 : -0.8), s);
    const la = neckA + Math.PI * (i % 2 ? 0.5 : -0.5) + (i % 2 ? -0.35 : 0.35) + Math.sin((P.crownPh + i * 0.21) * TAU) * 0.35 * P.crowns;
    const len = 3.8 + P.crowns * 1.3;
    const tip: V2 = [b[0] + Math.cos(la) * len, b[1] + Math.sin(la) * len];
    const path: V2[] = [b, lerp2(b, tip, 0.5), tip];
    const cum = arcs(path);
    const lm: LM[] = [];
    // a leech: fat behind, tapering to the head, as one little contour
    const nx = -Math.sin(la), ny = Math.cos(la);
    for (const [t, w] of [[-0.15, 0], [0, 1.7], [0.5, 1.6], [0.9, 1], [1.08, 0]] as V2[]) lm.push([b[0] + (tip[0] - b[0]) * t + nx * w, b[1] + (tip[1] - b[1]) * t + ny * w, 0]);
    for (const [t, w] of [[0.9, -1], [0.5, -1.6], [0, -1.7]] as V2[]) lm.push([b[0] + (tip[0] - b[0]) * t + nx * w, b[1] + (tip[1] - b[1]) * t + ny * w, 0]);
    LR.region(cspline(lm, 0.4), { z: 40, R: 1.2, H: 1.6, id: 1 + i, tex: (p, o) => { o.m = M.leech; if (frac(onPath(path, cum, p.x, p.y).s / 1.3) < 0.3) { o.z -= 0.35; o.t -= 0.06; } } });
    tips.push({ p: tip, a: la });
  });
  sk.np();
  LR.emit({ drop: 1.2, seam: 0.4, contrast: 1.2 });
  for (const { p, a: la } of tips) {
    const cx = p[0] + Math.cos(la) * 1.2, cy = p[1] + Math.sin(la) * 1.2;
    if (P.crowns > 0.3) {
      sk.over(cx, cy, COL.crownT);
      for (const d of [1.25, -1.25]) sk.over(cx + Math.cos(la + d) * 1.4, cy + Math.sin(la + d) * 1.4, COL.crown);
      for (const d of [0.6, -0.6]) sk.over(cx + Math.cos(la + d) * 2.2, cy + Math.sin(la + d) * 2.2, COL.crown2);
      sk.over(cx + Math.cos(la) * 1.4, cy + Math.sin(la) * 1.4, COL.crown2);
    } else sk.over(cx - Math.cos(la) * 0.6, cy - Math.sin(la) * 0.6, COL.crownC);
  }
}

/** Fore-flipper geometry (shoulder, elbow, wrist, hand direction and tip). */
function foreGeo(R: Rig, near: boolean) {
  const { P, at } = R;
  const s = at(0.8);
  const shoulder: V2 = [s.p[0] + (near ? 3 : -2), s.p[1] + s.r * 0.3];
  if (P.swim) {
    // afloat: the flipper reaches out from the shoulder at its own angle (body frame, pitched)
    const [ang, reach, hand] = near ? P.fN : P.fF;
    const wA = ang + P.pitch, wr: V2 = [shoulder[0] + Math.cos(wA) * reach, shoulder[1] + Math.sin(wA) * reach];
    const [elbow, w] = ik2(shoulder, wr, 17, 17, near ? -1 : -1);
    return { shoulder, elbow, w, ha: hand + P.pitch };
  }
  const target = near ? P.foreN : P.foreF;
  const wrist: V2 = [target[0] - 10, Math.min(-3, target[1] - 3)];
  const [elbow, w] = ik2(shoulder, wrist, 17, 17, 1);
  const ha = Math.atan2(target[1] - w[1], target[0] - w[0]);
  return { shoulder, elbow, w, ha };
}

/** Fore-flipper: a long furred arm with a leathery paddle hand, five digit ridges and three hooked claws. */
function foreFlipper(FR: Relief, R: Rig, near: boolean) {
  const { M } = R;
  const { shoulder, elbow, w, ha } = foreGeo(R, near);
  const z = near ? 34 : -30;
  // the arm: upper arm swelling to the elbow, the forearm tapering to the wrist
  const nrm = (a: V2, b: V2): V2 => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  const n1 = nrm(shoulder, elbow), n2 = nrm(elbow, w);
  const o = (p: V2, nn: V2, d: number, sharp = 0): LM => [p[0] + nn[0] * d, p[1] + nn[1] * d, sharp];
  const arm: LM[] = [
    o(shoulder, n1, 9.5), o(lerp2(shoulder, elbow, 0.5), n1, 8.6), o(elbow, n1, 6.6), o(lerp2(elbow, w, 0.5), n2, 5.4), o(w, n2, 4.4),
    o(w, n2, -4.2), o(lerp2(elbow, w, 0.45), n2, -5.6), o(elbow, n2, -7.2, 0.3), o(lerp2(shoulder, elbow, 0.55), n1, -8.6), o(shoulder, n1, -9.5),
  ];
  let ap = cspline(arm, 1);
  ap = fringe(ap, 2.2, near ? 51 : 52, (_x, _y, nx, ny) => (nx < -0.2 || ny > 0.3 ? [2, 0.4] : null));
  FR.region(ap, {
    z, R: 5, H: 6, id: ID.LIMB, tex: (p, q) => {
      const h = strands(p.x, p.y, Math.atan2(w[1] - shoulder[1], w[0] - shoulder[0]) + 0.2, 4.5, 1.7, near ? 53 : 54);
      q.z += h * 0.9;
      q.m = M.fur;
      if (FS.tip > 0.8 && hh(FS.row, FS.seg, 55) < 0.25) q.m = M.lockT;
    },
  });
  FR.bump(elbow[0], elbow[1], 4, 4, 1.6);
  // the paddle hand: leathery, five digit ridges fanning to the tip, furred over the wrist
  const c = Math.cos(ha), s = Math.sin(ha), nx = -s, ny = c;
  const hp = (u: number, v: number, sharp = 0): LM => [w[0] + c * u + nx * v, w[1] + s * u + ny * v, sharp];
  const hand: LM[] = [hp(-1.5, -3.6), hp(4, -4.8), hp(9, -5.2), hp(12.8, -3.6), hp(14.6, -0.8, 0.3), hp(13.8, 2.6), hp(9, 4.6), hp(3, 4.4), hp(-1.5, 3.6)];
  FR.region(cspline(hand, 0.8), {
    z: z + 3, R: 2.4, H: 3, id: ID.HAND, tex: (p, q) => {
      const du = (p.x - w[0]) * c + (p.y - w[1]) * s;
      q.m = du < 2.5 ? M.fur : M.flip;
      if (du >= 2.5 && frac((p.x * 0.7 - p.y * 0.4)) < 0.16) { q.z -= 0.25; q.t -= 0.04; }   // the leathery creases
      if (p.s < 1 && du > 4) q.m = M.flipD;
    },
  });
  for (let d = 0; d < 5; d++) {
    const v = -3.6 + d * 1.9;
    FR.line([[hp(2, v * 0.5)[0], hp(2, v * 0.5)[1]], [hp(12.4 - Math.abs(d - 2) * 0.8, v)[0], hp(12.4 - Math.abs(d - 2) * 0.8, v)[1]]], 1.1, 0.9, { only: ID.HAND });
  }
  // three hooked claws on the leading digits, curling down to the sand (afloat they lie folded in the web)
  for (let k = 0; k < (R.P.swim ? 0 : 3); k++) {
    const b = hp(12.4 - k * 0.6, -1.6 + k * 2.1);
    const ca = ha + 0.45 + k * 0.12;
    const L = 6 - Math.abs(k - 1) * 1.2;
    const tip: V2 = [b[0] + Math.cos(ca) * L, R.P.swim ? b[1] + Math.sin(ca) * L : Math.min(-0.3, b[1] + Math.sin(ca) * L)];
    const bn: V2 = [-Math.sin(ca), Math.cos(ca)];
    const cl: LM[] = [[b[0] - bn[0] * 1.3, b[1] - bn[1] * 1.3, 0], [(b[0] + tip[0]) / 2 - bn[0] * 1.1, (b[1] + tip[1]) / 2 - bn[1] * 1.1 - 0.6, 0], [tip[0], tip[1], 0.9], [(b[0] + tip[0]) / 2 + bn[0] * 0.3, (b[1] + tip[1]) / 2 + bn[1] * 0.3, 0], [b[0] + bn[0] * 1.3, b[1] + bn[1] * 1.3, 0]];
    FR.region(cspline(cl, 0.4), { z: z + 6, R: 0.9, H: 1.4, id: ID.CLAW + 0, tex: (p, q) => { q.m = Math.hypot(p.x - b[0], p.y - b[1]) < L * 0.4 ? M.horn : M.claw; } });
  }
}

/** Hind flipper geometry. */
function hindGeo(R: Rig, near: boolean) {
  const { P, at, tail } = R;
  if (P.swim) {
    // afloat: both hind flippers trail straight back off the tail, a little apart, steering
    const t0 = at(0.02);
    return { root: [tail[0] + 4 * Math.cos(t0.a), tail[1] + 4 * Math.sin(t0.a)] as V2, a: t0.a + Math.PI + 0.04 + P.hindA + (near ? 0 : P.hindS) };
  }
  const hip = at(0.2);
  const root = lerp2([tail[0] + 5, tail[1] + 1], [hip.p[0], hip.p[1] + hip.r * 0.55], P.hind);
  const a0 = near ? Math.PI + 0.3 : Math.PI + 0.62;
  const a1 = near ? 0.45 : 0.7;
  return { root, a: a0 + (a1 - a0) * P.hind };
}

/** Hind flippers: webbed fans with five digits ending in scalloped lobes, held back or swung forward. */
function hindFlipper(FR: Relief, R: Rig, near: boolean) {
  const { M } = R;
  const { root, a } = hindGeo(R, near);
  const L = 23;
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  const bend = near ? -1.5 : -1;
  const fp = (u: number, v: number, sharp = 0): LM => {
    const t = u / L;
    const vv = v + bend * Math.sin(t * Math.PI) * 2;
    return [root[0] + c * u + nx * vv, root[1] + s * u + ny * vv, sharp];
  };
  const fan: LM[] = [
    fp(-2, -2.6), fp(8, -4.6), fp(17, -7.4), fp(22.6, -8.8, 0.5), fp(20.4, -6.2), fp(23.4, -4.6, 0.5), fp(20.6, -2.2), fp(23.6, 0, 0.5), fp(20.6, 2.2),
    fp(23.4, 4.6, 0.5), fp(20.4, 6.2), fp(22.6, 8.8, 0.5), fp(17, 7.4), fp(8, 4.6), fp(-2, 2.6),
  ];
  const z = near ? 26 : -26;
  FR.region(cspline(fan, 0.8), {
    z, R: 2.2, H: 3, id: ID.HAND, tex: (p, q) => {
      const du = (p.x - root[0]) * c + (p.y - root[1]) * s;
      if (du < 6) {
        const h = strands(p.x, p.y, a + Math.PI, 3.5, 1.6, 61);
        q.z += h * 0.6; q.m = M.fur;
        return;
      }
      q.m = M.flip;
      if (frac(du * 0.45) < 0.15) { q.z -= 0.25; q.t -= 0.04; }       // the creases across the web
      if (p.s < 1 && du > 18) q.m = M.flipD;
    },
  });
  // the five digits: raised ridges from the ankle out to each lobe
  for (let d = 0; d < 5; d++) {
    const v = -8.8 + d * 4.4;
    const a0 = fp(4, v * 0.25), b0 = fp(22.4 - (d % 4 ? 0.6 : 0), v * 0.92);
    FR.line([[a0[0], a0[1]], [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], [b0[0], b0[1]]], 1.4, 1.2, { only: ID.HAND });
  }
}

/** The little nails near each hind digit's tip (overlay, after the near flipper is lit). */
function nails(sk: Sk, R: Rig) {
  const { root, a } = hindGeo(R, true);
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  for (let d = 0; d < 5; d++) {
    const v = (-8.8 + d * 4.4) * 0.86 - 1.5 * Math.sin(0.88 * Math.PI) * 2 * 0;
    const u = 19.6;
    const vv = v - 1.5 * Math.sin((u / 23) * Math.PI) * 2;
    sk.overPaint(root[0] + c * u + nx * vv, root[1] + s * u + ny * vv, COL.nail);
  }
}

export const CORVEXSEAL: SpeciesDef = {
  name: 'Corvex Seal', kind: 'mammal', len: 170, height: 50,
  anims: SEAL_ANIMS,
  canvas: anim => (SEAL_SWIM_ANIMS.includes(anim) ? { w: 300, h: 280, ox: 150, oy: 140 } : { w: 250, h: 160, ox: 112, oy: 148 }),
  anchor: Object.fromEntries(SEAL_SWIM_ANIMS.map(k => [k, 'centre'])) as Record<string, 'centre'>,
  draw: (sk, anim, frame, eye) => draw(sk, anim, frame, eye),
  eyeFor: (anim, f) => (anim === 'roar' || anim === 'gallop' || anim === 'lunge' || (anim === 'grab' && f === 1) ? 'angry' : anim === 'sleep' || anim === 'pin' ? 'closed' : anim === 'wake' && f > 0 && f < 3 ? 'alert' : 'open'),
};

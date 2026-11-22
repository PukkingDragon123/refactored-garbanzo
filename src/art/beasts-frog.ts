// Moss Frog: a squat tree frog covered in ragged moss-like skin flaps, gold-flecked eyes and a
// pale vocal sac that balloons when it calls. Hides flat on logs; hunts with a lightning tongue.
//
// Painted on the small anuran rig (./small-anura.ts) from one contour through its landmarks: the
// rounded snout with its nostril bump, the big eye's bulge, the nape, the back with its ragged skin
// flaps standing up, the sacral hump over the hips and the rump; the folded Z of the hind leg (the
// barred thigh over the shin, the long foot forward with webbed toes and round adhesive discs), the
// short arm with padded fingers turned in. The skin is a mossy camouflage like the real mossy frogs,
// on one hand-picked moss ramp: olive ground in clusters of bright moss-green and pale lichen,
// umber blotches (the canthal mask, the bar between the eyes, the back, the rump, the flank), the
// flaps' tips lichen-pale, the flank below the dorsolateral line darker, a brown tympanum, the dark jaw
// line, a cream throat. The eye is gold, flecked, with a horizontal pupil. The flaps break the outline
// everywhere; flattened to hide, they spread and it melts into a log.

import { Sk, V2, BeastEye, SpeciesDef, TAU, hh } from './beasts-core';
import { hex } from './color';
import { drawAnuran, restPose } from './small-anura';
import type { AnuraPose, AnuraSpec, LimbPart } from './small-anura';
import type { LP, FP } from './small-kit';

const ANIMS = {
  idle: { frames: 4, fps: 2, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  hop: { frames: 4, fps: 8, loop: true },
  alert: { frames: 2, fps: 3, loop: true },
  call: { frames: 4, fps: 6, loop: true },
  eat: { frames: 4, fps: 12, loop: true },
  tongue: { frames: 4, fps: 12, loop: false },
  hide: { frames: 2, fps: 1, loop: true },
  sleep: { frames: 2, fps: 1, loop: true },
  swim: { frames: 4, fps: 6, loop: true },
};

/** how flat it is pressed down (spreads the flaps) */
let FLAT = 0;
function pose(anim: string, f: number, n: number): AnuraPose {
  const p = restPose();
  const t = f / n;
  FLAT = 0;
  switch (anim) {
    case 'idle': p.sac = f === 1 ? 0.22 : 0; p.sy = f === 2 ? 0.95 : 1; p.head = f === 3 ? -0.04 : 0; break;
    case 'walk': case 'hop':
      p.sy = [0.86, 1.04, 1, 0.94][f]; p.sx = [1.02, 1.04, 1.02, 1][f];
      p.lift = [0, 2.6, 4.2, 1.2][f]; p.rot = [0.06, -0.42, -0.1, 0.32][f]; p.dx = [0, 4.6, 3.95, 2.6][f];
      p.hind = (['sit', 'push', 'trail', 'tuck'] as const)[f]; p.front = (['sit', 'reach', 'reach', 'land'] as const)[f];
      p.reach = [1, 0.78, 0.62, 1][f];
      break;
    case 'alert': p.rot = -0.2; p.head = -0.14 - f * 0.05; p.sy = 1.04; p.front = 'up'; break;
    case 'call': p.sac = [0.2, 0.8, 1, 0.5][f]; p.head = -0.12; p.sy = 1 - p.sac * 0.07; p.rot = -0.06; break;
    case 'eat': case 'tongue': p.tongue = [0.3, 1, 0.6, 0][f]; p.gape = [0.5, 1, 0.7, 0.1][f]; p.head = -0.06; p.dx = [0, 0.3, 0.2, 0][f]; break;
    case 'hide': FLAT = 1; p.sy = 0.66 + f * 0.03; p.sx = 1.08; p.head = 0.1; p.rot = 0.08; p.front = 'tuck'; p.hind = 'flat'; break;
    case 'sleep': FLAT = 0.5; p.sy = 0.8 + f * 0.02; p.head = 0.12; p.rot = 0.06; p.front = 'tuck'; p.hind = 'sit'; break;
    case 'swim': p.rot = 0.14; p.lift = -3.1; p.dx = 3.6; p.hind = 'kick'; p.kick = 0.5 + Math.sin(t * TAU) * 0.5; p.reach = 0.7; p.front = 'paddle'; p.head = -0.08; break;
  }
  return p;
}

/** the head-and-trunk outline: snout, nostril, the eye's bulge, the nape, the flapped back, the hump, the rump */
function body(): LP[] {
  const fl = 0.7 + FLAT * 0.5;
  return [
    // the snout sloping up from its tip, the nostril's bump, the canthus up to the eye
    [7.3, -4.05], [7.0, -4.75], [6.3, -5.2], [5.3, -5.75],
    // the eye's bulge standing up off the head, a ragged flap over it
    [4.65, -6.85], [4.15, -7.25], [3.65, -7.35 - fl * 0.8, 1], [3.3, -7.25], [2.95, -6.85],
    // the nape's dip behind the eye, then the back rising to the hump with ragged flaps standing up
    [2.2, -6.25], [1.5, -6.3], [1.15, -6.3 - fl, 1], [0.8, -6.35],
    [0.0, -6.45], [-0.3, -6.5 - fl * 0.7, 1], [-0.6, -6.6],
    [-1.1, -6.7], [-1.45, -6.8 - fl * 1.1, 1], [-1.8, -6.9],
    // the sacral hump, flaps on it, the rump falling to the vent near the ground
    [-2.4, -7.05], [-2.75, -7.15 - fl, 1], [-3.1, -7.0], [-3.75, -6.4], [-4.45 - fl * 0.7, -5.6, 1], [-4.55, -4.9],
    [-4.95 - fl * 0.6, -4.1, 1], [-4.95, -3.4], [-4.7, -1.6], [-3.4, -1.15],
    // the belly rising forward to the chest propped up on the arms, the throat and the chin
    [-0.5, -1.7], [2.2, -2.45], [3.9, -2.95], [5.3, -3.25], [6.4, -3.55], [7.05, -3.75],
  ];
}

/** hand-placed tubercles (body space): [x, y, r], the bigger ones with spiny pale tips */
const TUB: [number, number, number][] = [
  [3.65, -7.95, 0.7], [1.15, -6.95, 0.7], [-1.45, -7.55, 0.7], [-2.75, -7.85, 0.7], [-4.95, -5.6, 0.7],
];

/** the dorsolateral fold's line (body space): the green back above it, the darker flank below */
const DL: V2[] = [[6.5, -4.6], [3.0, -6.1], [1.0, -5.5], [-1.2, -5.7], [-2.9, -6.1], [-4.6, -4.8]];
const lineY = (L: V2[], x: number) => {
  if (x >= L[0][0]) return L[0][1];
  for (let i = 1; i < L.length; i++) if (x >= L[i][0]) { const t = (x - L[i][0]) / (L[i - 1][0] - L[i][0]); return L[i][1] + (L[i - 1][1] - L[i][1]) * t; }
  return L[L.length - 1][1];
};
/** hand-placed umber blotches (body space ellipses): the canthal mask, the bar between the eyes, the back, the rump, the flank */
const BLOT: [number, number, number, number][] = [
  [5.7, -5.1, 1.25, 0.32], [2.05, -6.35, 0.55, 0.45], [0.2, -6.15, 0.8, 0.42], [-2.15, -6.55, 0.75, 0.45],
  [-4.1, -5.2, 0.5, 0.75], [-0.6, -4.3, 0.6, 0.42], [1.6, -3.6, 0.5, 0.4],
];
/** the hand-picked palettes: one moss ramp carries the whole skin (the blotches and bars are its dark end) */
const MOSS = ['#1c2410', '#2a3a14', '#3c501a', '#55692a', '#6f8432', '#93a448', '#b9c672'];
const CREAM = ['#5a5636', '#8c865c', '#bbb486', '#ddd5aa', '#f1ead0'];

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const n = ANIMS[anim as keyof typeof ANIMS]?.frames ?? 1;
  const P = pose(anim, frame, n);
  const k = juv ? 0.78 : 1.26;
  const M = {
    skin: sk.m(MOSS.map(c => hex(c)), { edge: 1 }),
    belly: sk.m(CREAM.map(c => hex(c)), { edge: 1 }),
    lichen: sk.m(['#6e7a44', '#a4b06a', '#ccd69a', '#e4ecbc'].map(c => hex(c)), { edge: 1 }),
    bright: sk.m(['#26300e', '#3a4c14', '#56701e', '#748e26', '#94aa34', '#b6c454', '#d2dc7e'].map(c => hex(c)), { edge: 1 }),
    sac: sk.m(['#8c8262', '#bdb28c', '#e0d6b2', '#f3ecd4', '#fffaea'].map(c => hex(c)), { edge: 1 }),
    sacV: sk.m(['#8a6a5a', '#b48a7a', '#d0a898'].map(c => hex(c)), { edge: 0 }),
    tongue: sk.m(['#7a2a36', '#b44a5a', '#e07484', '#f4a4ae'].map(c => hex(c)), { edge: 1 }),
    mouth: sk.m(['#1e0c08', '#3e1614'].map(c => hex(c)), { edge: 0, noRim: true }),
    pad: sk.m(['#6a6040', '#a8986a', '#d4c48e', '#eee2b4'].map(c => hex(c)), { edge: 1 }),
    tymp: sk.m(['#3a2614', '#5e3e1e', '#87602e', '#a8823e'].map(c => hex(c)), { edge: 0, noRim: true }),
  };
  /** the moss: clusters of bright moss-green and pale lichen over the olive, never single pixels */
  const moss = (p: FP, bx: number, by: number): number => {
    const cx = Math.floor((bx + 30) / 1.9), cy = Math.floor((by + 30) / 1.7), h = hh(cx, cy, 31);
    if (h < 0.38) { p.l += 0.08; return M.bright; }
    if (h > 0.84 && h < 0.9) { p.l -= 0.32; return M.skin; }
    if (h > 0.9) { const u = (bx + 30) / 1.9 - cx - 0.5, v = (by + 30) / 1.7 - cy - 0.5; if (u * u + v * v < 0.16) return M.lichen; }
    return M.skin;
  };
  /** the pattern as tone shifts on the moss ramp, sampled in body space so it rides with every pose */
  const inBlot = (bx: number, by: number) => {
    for (const [cx, cy, rx, ry] of BLOT) { const u = (bx - cx) / rx, v = (by - cy) / ry; if (u * u + v * v < 1) return true; }
    return false;
  };
  const spec: AnuraSpec = {
    body, neck: [2.4, -4.8], pivot: [0.5, -1.8], hip: [-3.1, -3.9], shoulder: [3.3, -3.3],
    thigh: 4.6, shin: 4.4, foot: 3.3, upper: 1.9, fore: 2.0,
    thighW: 1.5, shinW: 0.95, footW: 0.5, armW: 0.58,
    toe: 1.5, pad: 0.55, web: 0.6,
    eye: [3.8, -6.2], eyeSize: juv ? 2 : 4,
    eyePal: { iris: hex('#e2b03a'), irisD: hex('#946418'), fleck: hex('#f0d070'), pupil: hex('#0e0c06'), rim: hex('#22280e'), glint: hex('#fffbe8'), lid: hex('#22280e') },
    sac: { at: [5.0, -2.7], r: 2.6 }, mouth: { tip: [7.15, -4.0], corner: [3.0, -4.15] },
    zBody: 3.2, round: 1.4, dome: 1.0, spec: 0.2, fill: 0.2,
    paint: {
      body(p, bx, by) {
        // the cream throat and belly below the jaw and flank line
        const bellyLine = -2.4 - Math.max(0, bx - 3.2) * 0.62;
        if (by > bellyLine && bx > 1.4 && !FLAT) return M.belly;
        if (inBlot(bx, by)) { p.l -= 0.42; return M.skin; }
        if (by > lineY(DL, bx)) p.l -= 0.08;
        return moss(p, bx, by);
      },
      limb(p, part: LimbPart, far, t, c) {
        if (part === 'toe') { if (t > 0.7) p.l += 0.15; return M.skin; }
        if (part === 'web') { p.l -= 0.12; return M.skin; }
        if (part === 'hand' || part === 'foot') { p.l -= 0.05; return M.skin; }
        // dark crossbars on the thigh and shin, the thigh's underside pale
        const L = part === 'thigh' ? 4.6 : part === 'shin' ? 4.4 : 2;
        const bars = part === 'thigh' ? [1.6, 3.2] : part === 'shin' ? [1.5, 3.0] : [];
        for (const b of bars) if (Math.abs(t * L - b) < 0.42) { p.l -= 0.42; return M.skin; }
        void c; void far;
        return moss(p, t * L * 1.2 + (part === 'shin' ? 9 : 0), c * 1.3 + 4);
      },
      sac(p, inf) {
        // the stretched skin: fine creases round it when half full, a blush of veins showing through
        if (inf < 0.6 && Math.sin((p.x * 1.9 - p.y * 1.1)) > 0.75) p.l -= 0.12;
        if (inf > 0.6 && hh(p.x, p.y, 23) < 0.05) return M.sacV;
        return M.sac;
      },
      tongue: (_p, t) => (t > 0.85 ? M.pad : M.tongue),
      mouth: M.mouth,
    },
    sculpt(F, T) {
      // the eye's bulge and the sunk tympanum; the folds and tubercles are painted (they would only speckle at this size)
      const e = T(3.8, -6.2); F.bump(e[0], e[1], 1.7 * k, 1.5 * k, 0.5 * k);
      const ty = T(2.2, -5.0); F.bump(ty[0], ty[1], 0.8 * k, 0.8 * k, -0.25 * k);
    },
    limbSpines: (part) => (part === 'shin' ? { side: 1, at: [0.32, 0.7], len: 0.7 + FLAT * 0.3, lean: 0.6 } : part === 'thigh' ? { side: -1, at: [0.22], len: 0.55, lean: -0.4 } : undefined),
    after(sk2, T, _P, kk) {
      // the jaw line
      for (let x = 3.5; x <= 6.9; x += 0.45) { const q = T(x, -4.12 + (x - 3.5) * 0.03); sk2.paint(q[0], q[1], M.skin, -0.5); }
      void kk;
      if (juv) return;
      // the lichen-pale tips of the flaps
      for (const [x, y] of TUB) { const q = T(x, y + 0.35); sk2.paint(q[0], q[1], M.lichen, 0.1); }
      // the tympanum: a brown disc under the fold, lit on its upper rim
      const ty = T(2.2, -5.0);
      sk2.paint(ty[0], ty[1] - 0.5, M.tymp, 0.15); sk2.paint(ty[0], ty[1] + 0.5, M.tymp, -0.15);
      // the nostril
      const ns = T(6.55, -4.85); sk2.paint(ns[0], ns[1], M.skin, -0.5);
    },
  };
  if (P.lift < -1) sk.clipY = -0.5;
  const o = drawAnuran(sk, spec, P, k, eye);
  if (P.lift < -1) {
    sk.clipY = Infinity;
    // the water's skin: ripples rolling off the frog
    for (let x = -7; x < 10; x++) if (hh(x, frame, 2) > 0.4 || (x > -3 && x < 8)) sk.over(x * k + 3.6 * k + 0.5 - 2, -0.5, hex(x > -3 && x < 8 ? '#e6f6fa' : '#bfe4ee', 200));
  }
  return { head: o.head as V2, eye: o.eye };
}

export const MOSSFROG: SpeciesDef = {
  name: 'Moss Frog', kind: 'amphibian', len: 12, height: 8,
  anims: ANIMS,
  canvas: (anim) => (anim === 'eat' || anim === 'tongue' ? { w: 44, h: 22, ox: 12, oy: 18 } : { w: 28, h: 24, ox: 12, oy: 20 }),
  draw,
  eyeFor: (anim) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : 'open'),
};

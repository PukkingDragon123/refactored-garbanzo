// V7 locomotion, procedural: walk, run and ladder climbing are generated from a continuous phase
// (no keyframes), so every frame is an in-between and the motion stays smooth at any frame count.
//  - feet are planted: during stance a foot slides back at exactly the body's speed, and the Actor
//    advances these clips by distance travelled (`dist` px per cycle), so nothing skates
//  - relaxed, easy-going style: loose hands, arms swinging from the shoulder with the forearm
//    trailing a beat behind, the head steady while the hips bob, hair and clothes following through
//  - the run leans in with a light flight phase, heel kick and knee drive; the climb is seen from
//    behind with hands and feet gripping the rungs in a diagonal rhythm
// Everything else comes from the shared pose library.

import type { Build, Pose, ArmP, LegP, P2 } from '../people-rig';
import { stand, animePose, ANIME_ANIMS, AnimInfo } from '../anime/anims';
import { YAW } from './body';

const TAU = Math.PI * 2;
const K = (b: Build) => b.torso / 15;
const frac = (v: number) => v - Math.floor(v);
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
const LEG_YAW = Math.cos(YAW * 0.5);

export interface AnimInfo7 extends AnimInfo {
  /** screen px travelled per cycle (distance-driven clips) */
  dist?: number;
  /** the clip the Actor plays instead of `talk` while this one is the idle (keep hands on the job) */
  talk?: string;
}

export const ANIMS7: Record<string, AnimInfo7> = {
  ...ANIME_ANIMS,
  idle: { frames: 8, fps: 5, loop: true },
  walk: { frames: 12, fps: 16, loop: true },
  run: { frames: 12, fps: 18, loop: true },
  climb: { frames: 12, fps: 12, loop: true },
  climbIdle: { frames: 1, fps: 1, loop: true },
  // at the helm: both fists on the wheel; talking keeps one of them there (the Actor plays `talk`)
  steer: { frames: 8, fps: 4, loop: true, talk: 'steerTalk' },
  steerTalk: { frames: 8, fps: 5, loop: true },
  steerHard: { frames: 8, fps: 7, loop: true, talk: 'steerHard' },
};

// ------------------------------------------------------------------ gait

interface Gait { stride: number; stance: number; lift: number; bob: number; lean: number; swing: number; elbow: number; elbowSwing: number; drop: number; kick: number; flight: number; hand: ArmP['hand']; sway?: number; roll?: number; armOut?: number; headBob?: number }
// personality gaits (k-scaled): each cast member moves their own way
type GaitSet = { walk: (b: Build) => Gait; run: (b: Build) => Gait };
const GAITS: Record<string, GaitSet> = {
  // Mori: easy-going naturalist, loose arms, a relaxed lope when he runs
  mori: {
    walk: b => ({ stride: b.thigh * 1.45, stance: 0.6, lift: 2.3 * K(b), bob: 0.8 * K(b), lean: 0.05, swing: 0.4, elbow: 0.22, elbowSwing: 0.3, drop: 0.3 * K(b), kick: 0.2, flight: 0, hand: 'relax', sway: 0.35 * K(b) }),
    run: b => ({ stride: b.thigh * 2.2, stance: 0.36, lift: 5.4 * K(b), bob: 1.2 * K(b), lean: 0.22, swing: 0.62, elbow: 1.2, elbowSwing: 0.25, drop: 1.1 * K(b), kick: 1, flight: 0.9 * K(b), hand: 'relax', sway: 0.25 * K(b) }),
  },
  // Jenna: quick light steps with a bounce and a hip sway, hands a little out from her sides
  jenna: {
    walk: b => ({ stride: b.thigh * 1.15, stance: 0.58, lift: 2.8 * K(b), bob: 1.25 * K(b), lean: 0.0, swing: 0.34, elbow: 0.75, elbowSwing: 0.35, drop: 0.35 * K(b), kick: 0.5, flight: 0, hand: 'relax', sway: 0.55 * K(b), roll: 0.05, armOut: 1.1 }),
    run: b => ({ stride: b.thigh * 1.75, stance: 0.38, lift: 5.2 * K(b), bob: 1.4 * K(b), lean: 0.14, swing: 0.7, elbow: 1.0, elbowSwing: 0.45, drop: 0.9 * K(b), kick: 1.3, flight: 0.9 * K(b), hand: 'open', sway: 0.45 * K(b), armOut: 1.7 }),
  },
  // Aroha: upright and grounded, long smooth strides; runs like an athlete
  aroha: {
    walk: b => ({ stride: b.thigh * 1.65, stance: 0.62, lift: 2.0 * K(b), bob: 0.5 * K(b), lean: -0.01, swing: 0.3, elbow: 0.16, elbowSwing: 0.2, drop: 0.25 * K(b), kick: 0.2, flight: 0, hand: 'relax', sway: 0.4 * K(b), roll: 0.02 }),
    run: b => ({ stride: b.thigh * 2.5, stance: 0.33, lift: 6.4 * K(b), bob: 1.0 * K(b), lean: 0.3, swing: 0.8, elbow: 1.45, elbowSwing: 0.2, drop: 1.2 * K(b), kick: 1, flight: 1.2 * K(b), hand: 'grip' }),
  },
  // Joshu: a heavy sailor's roll, short strides rocking side to side, arms held out round the belly
  joshu: {
    walk: b => ({ stride: b.thigh * 1.05, stance: 0.64, lift: 1.6 * K(b), bob: 0.45 * K(b), lean: -0.05, swing: 0.24, elbow: 0.36, elbowSwing: 0.15, drop: 0.3 * K(b), kick: 0, flight: 0, hand: 'relax', sway: 1.1 * K(b), roll: 0.09, armOut: 1.8 }),
    run: b => ({ stride: b.thigh * 1.5, stance: 0.46, lift: 3.2 * K(b), bob: 1.3 * K(b), lean: 0.08, swing: 0.5, elbow: 1.1, elbowSwing: 0.2, drop: 0.9 * K(b), kick: 0.3, flight: 0.3 * K(b), hand: 'fist', sway: 0.8 * K(b), roll: 0.07, armOut: 2.2 }),
  },
};
const gaitOf = (id: string) => GAITS[id] ?? GAITS.mori;
const WALK = (b: Build, id = 'mori') => gaitOf(id).walk(b);
const RUN = (b: Build, id = 'mori') => gaitOf(id).run(b);

/** px travelled per cycle on screen: a foot slides back S over the stance, in the legs' yaw */
export const gaitDist = (g: Gait) => (g.stride * LEG_YAW) / g.stance;

function foot(b: Build, g: Gait, ph: number, base: number): LegP {
  ph = frac(ph);
  const S = g.stride, st = g.stance, k = K(b);
  if (ph < st) {
    // stance: planted, sliding back at body speed; heel strike → flat → heel lifts → toe off
    const u = ph / st;
    const x = S / 2 - S * u;
    const heel = Math.max(0, (u - 0.62) / 0.38);
    return { f: [base + x, b.ankleH + heel * heel * 1.6 * k], fa: u < 0.18 ? 0.3 * (1 - u / 0.18) : -0.7 * heel * heel };
  }
  // swing: the heel kicks up behind, the knee drives through, the foot reaches and settles
  const u = (ph - st) / (1 - st);
  const e = ease(Math.pow(u, 0.9 + g.kick * 0.35));
  const x = -S / 2 + S * e;
  const up = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7 + g.kick * 0.1)), 1.1);
  const y = b.ankleH + g.lift * up + (1 - u) * (1 - u) * 1.2 * k;
  return { f: [base + x, y], fa: -0.75 * (1 - e) + 0.25 * e * e };
}

function gait(b: Build, t: number, g: Gait): Pose {
  const k = K(b);
  const st = g.stance;
  // hip height: compressed through each stance, up through the swing (and the flight phase)
  const comp = (ph: number) => { ph = frac(ph); return ph < st ? Math.sin(Math.PI * ph / st) : 0; };
  const c = Math.max(comp(t), comp(t + 0.5));
  const bob = g.flight > 0
    ? -g.drop - g.bob * c + g.flight * (1 - c)
    : -g.drop - g.bob * (0.5 + 0.5 * Math.cos(TAU * 2 * t));
  // arms from the shoulder, opposite the legs; the forearm trails a beat behind
  const arm = (ph: number): ArmP => {
    const sw = -Math.cos(TAU * ph);
    const lag = -Math.cos(TAU * (ph - 0.1));
    return { a: 0.04 + g.swing * sw, e: g.elbow + g.elbowSwing * (0.5 + 0.5 * lag), hand: g.hand };
  };
  const p: Pose = {
    hip: [0.15 * k * Math.sin(TAU * 2 * t), b.hipH + bob],
    lean: g.lean + 0.03 * Math.cos(TAU * 2 * t) * (g.flight > 0 ? 1 : 0.4),
    sq: 1 - c * (g.flight > 0 ? 0.035 : 0.012),
    // the head stays level: it rides a little against the bob
    hd: [0.25 * k + g.lean * 1.6 * k, -bob * 0.25],
    fa: arm(t + 0.5), ba: arm(t),
    fl: foot(b, g, t, -0.3 * k), bl: foot(b, g, t + 0.5, 0.4 * k),
    sway: (g.flight > 0 ? 1.1 : 0.35) + 0.35 * Math.sin(TAU * 2 * t),
    bounce: -bob * 0.4,
    // the hips rock over the loaded leg, the shoulders roll with them
    flags: { sx: (g.sway ?? 0) * Math.sin(TAU * t), roll: (g.roll ?? 0) * Math.sin(TAU * t), aoN: g.armOut ?? 0, aoF: g.armOut ?? 0 },
  };
  return p;
}

// ------------------------------------------------------------------ ladder climb (back view)

/** half a climb cycle: one reach of one hand (px, scaled) */
const RUNG = (b: Build) => 7 * K(b);
export const climbDist = (b: Build) => 2 * RUNG(b);

function climb(b: Build, t: number): Pose {
  const k = K(b), R = RUNG(b);
  const p = stand(b, { lean: -0.04, hip: [-0.6 * k, b.hipH - 0.6 * k] });
  const T = b.torso;
  const shY = p.hip[1] + T - b.shY;
  // a limb planted on a rung slides down at the climbing speed; the free one reaches up in an arc
  const track = (ph: number, lo: number): [number, number] => {
    ph = frac(ph);
    if (ph < 0.5) return [lo + R - (ph / 0.5) * R, 0];
    const u = (ph - 0.5) / 0.5, e = ease(u);
    return [lo + e * R, Math.sin(Math.PI * u)];
  };
  const hand = (ph: number): ArmP => {
    const [y, arc] = track(ph, shY + 7.4 * k);
    return { ik: [1.8 * k - arc * 1.2 * k, y], hand: arc > 0.15 ? 'relax' : 'grip' };
  };
  const legP = (ph: number): LegP => {
    const [y, arc] = track(ph, b.ankleH + 0.4 * k);
    return { f: [1.4 * k - arc * 1.4 * k, y], fa: 0.1 - arc * 0.3 };
  };
  // diagonal rhythm: near hand with the far foot
  p.fa = hand(t); p.ba = hand(t + 0.5);
  p.fl = legP(t + 0.5); p.bl = legP(t);
  // the hips shift toward the loaded leg, the body stays close to the ladder
  p.hip = [p.hip[0] + 0.3 * k * Math.sin(TAU * t), p.hip[1] + 0.5 * k * Math.cos(TAU * 2 * t)];
  p.legFwd = true;
  p.flags = { back: 1 };
  p.sway = 0.3;
  return p;
}

// ------------------------------------------------------------------ idle

function idle(b: Build, t: number, id: string): Pose {
  const k = K(b), br = Math.sin(TAU * t), sh = Math.sin(TAU * t + 0.8);
  const p = stand(b);
  // weight settled on the back leg, a slow breath, the arms hanging loose and swaying a touch
  p.hip = [0.35 * k * sh, b.hipH - 0.35 - Math.max(0, -br) * 0.35];
  p.lean = 0.02 + br * 0.012;
  p.sq = 1 + br * 0.018;
  p.fl = { f: [-2.2 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.4 * k, b.ankleH], fa: 0.05 };
  p.fa = { a: 0.08 + br * 0.04 + sh * 0.02, e: 0.34 - br * 0.05, hand: 'relax' };
  p.ba = { a: -0.08 - br * 0.03, e: 0.28 + br * 0.04, hand: 'relax' };
  p.sway = 0.2 + 0.2 * br;
  const hip = p.hip;
  if (id === 'jenna') {
    // hands clasped in front, rocking gently on her heels, a little head tilt
    p.fa = { ik: [hip[0] + 3.4 * k, hip[1] + 1.4 * k + br * 0.2], hand: 'relax' };
    p.ba = { ik: [hip[0] + 3.2 * k, hip[1] + 1.1 * k + br * 0.2], hand: 'relax' };
    p.hip = [hip[0] + 0.3 * k * Math.sin(TAU * t * 2), hip[1]];
    p.hd = [0.3 * k * sh, 0];
    p.fl = { f: [-1.4 * k, b.ankleH], fa: 0 };
    p.bl = { f: [1.2 * k, b.ankleH + Math.max(0, br) * 0.6], fa: Math.max(0, br) * 0.25 };
    p.flags = { aoN: -3.2, aoF: -3.2, sx: 0.4 * k * sh };
  } else if (id === 'aroha') {
    // a hand on her hip, weight on the back leg, calm and watchful
    p.fa = { ik: [hip[0] + 0.6 * k, hip[1] + 2.6 * k], hand: 'fist' };
    p.flags = { aoN: 2.6, sx: 0.5 * k };
    p.lean = 0.0 + br * 0.01;
  } else if (id === 'joshu') {
    // fists on his hips, chest out, rocking on his sea legs; the belly rises and falls
    p.fa = { ik: [hip[0] + 0.4 * k, hip[1] + 2.4 * k], hand: 'fist' };
    p.ba = { ik: [hip[0] - 0.2 * k, hip[1] + 2.4 * k], hand: 'fist' };
    p.lean = -0.04 + br * 0.015;
    p.sq = 1 + br * 0.03;
    p.fl = { f: [-2.6 * k, b.ankleH], fa: 0 };
    p.bl = { f: [2.8 * k, b.ankleH], fa: 0 };
    p.flags = { aoN: 3.2, aoF: 3.2, sx: 0.7 * k * Math.sin(TAU * t), roll: 0.03 * Math.sin(TAU * t) };
  } else {
    p.flags = { sx: 0.3 * k * sh };
  }
  return p;
}

// ------------------------------------------------------------------ at the helm

/**
 * The Kittiwake's wheel as the helmsman sees it from his spot (ship4: SPOTS.helm - 14, with the wheel
 * sprite drawn at MOUNTS.wheel): the hub's offset from his ground anchor and the rim radius, world px.
 */
export const HELM = { x: 30, y: 36, r: 11.9 };

/** the shoulder (ground space) for a hip and lean */
function shoulder(b: Build, hip: P2, lean: number): P2 {
  const T = b.torso - b.shY;
  return [hip[0] + Math.sin(lean) * T, hip[1] + Math.cos(lean) * T];
}

/**
 * Squared up to the wheel with both fists on the rim: world-space targets (flags wN / wF), so they
 * land on the wheel's rim whatever the build. Hips in, feet planted wide, the grips easing a few
 * degrees round the rim and back as he nurses her through the swell. `hard` fights heavy weather:
 * lower and wider, leaning on the wheel, bigger swings.
 */
function steer(b: Build, t: number, hard = 0): Pose {
  const k = K(b), ph = TAU * t;
  const turn = Math.sin(ph) * (0.09 + hard * 0.2) + (hard ? Math.sin(ph * 3) * 0.04 : 0);
  const p = stand(b, { lean: 0.1 + hard * 0.08, hip: [1.5 * k + turn * 2 * k, b.hipH - (0.4 + hard * 1.1) * k] });
  p.fl = { f: [3.6 * k + hard * k, b.ankleH], fa: 0 };
  p.bl = { f: [-2 * k - hard * k, b.ankleH], fa: hard ? -0.15 : 0 };
  const rim = (a: number): P2 => [HELM.x + Math.cos(a + turn) * HELM.r, HELM.y + Math.sin(a + turn) * HELM.r];
  // near fist low on the rim (about eight o'clock), far fist high (about eleven)
  p.fa = { ik: rim(Math.PI * (1.2 - hard * 0.04)), hand: 'grip' };
  p.ba = { ik: rim(Math.PI * (0.7 + hard * 0.03)), hand: 'grip' };
  p.flags = { yaw: 0.55, wN: 1, wF: 1, sx: 0.4 * k * Math.sin(ph) };
  p.sway = 0.3 + hard * 0.8;
  p.bounce = hard ? Math.sin(ph * 2) * 0.4 : 0;
  return p;
}

/**
 * At the wheel, talking: the fists stay on the rim (a helmsman doesn't let go), the body leans in and
 * bobs with the words, and once a cycle the near hand jabs a finger out over the wheel at the sea.
 */
function steerTalk(b: Build, t: number): Pose {
  const k = K(b);
  const i = Math.floor(t * 8) % 8;
  const p = steer(b, t);
  p.lean += [0, 0.03, 0.05, 0.02, 0, 0.04, 0.06, 0.02][i];
  p.hd = [0.3 * k * (i % 2), -0.3 * k * ((i + 1) % 2)];
  p.bounce = i % 2 ? 0.35 : 0;
  if (i === 5 || i === 6) {
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [s[0] + (i === 5 ? 8.6 : 9.4) * k, s[1] + (i === 5 ? -1.2 : -0.4) * k], hand: 'point', ha: 0.2 };
    p.flags = { ...p.flags, wN: 0 };
  }
  return p;
}

const POSES7: Record<string, (b: Build, t: number, id: string) => Pose> = {
  idle,
  steer: (b, t) => steer(b, t),
  steerTalk: (b, t) => steerTalk(b, t),
  steerHard: (b, t) => steer(b, t, 1),
  walk: (b, t, id) => gait(b, t, WALK(b, id)),
  run: (b, t, id) => gait(b, t, RUN(b, id)),
  climb: (b, t) => climb(b, t),
  climbIdle: b => climb(b, 0.25),
};

export function pose7(id: string, anim: string, b: Build, frame: number): Pose {
  const fn = POSES7[anim];
  if (!fn) return animePose(id, anim, b, frame);
  const info = ANIMS7[anim];
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(b, t, id);
}

/** per-character clip info: distance-driven locomotion needs the character's own stride */
export function animInfo7(b: Build, anim: string, id = 'mori'): AnimInfo7 | null {
  const info = ANIMS7[anim];
  if (!info) return null;
  if (anim === 'walk') return { ...info, dist: gaitDist(WALK(b, id)) };
  if (anim === 'run') return { ...info, dist: gaitDist(RUN(b, id)) };
  if (anim === 'climb') return { ...info, dist: climbDist(b) };
  return info;
}

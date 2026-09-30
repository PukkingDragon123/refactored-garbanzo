// V7 locomotion, procedural: walk, run and ladder climbing are generated from a continuous phase
// (no keyframes), so every frame is an in-between and the motion stays smooth at any frame count.
//  - feet are planted: during stance a foot slides back at exactly the body's speed, and the Actor
//    advances these clips by distance travelled (`dist` px per cycle), so nothing skates
//  - relaxed, easy-going style: loose hands, arms swinging from the shoulder with the forearm
//    trailing a beat behind, the head steady while the hips bob, hair and clothes following through
//  - the run leans in with a light flight phase, heel kick and knee drive; the climb is seen from
//    behind with hands and feet gripping the rungs in a diagonal rhythm
// Everything else comes from the shared pose library.

import type { Build, Pose, ArmP, LegP } from '../people-rig';
import { stand, animePose, ANIME_ANIMS, AnimInfo } from '../anime/anims';
import { YAW } from './body';

const TAU = Math.PI * 2;
const K = (b: Build) => b.torso / 15;
const frac = (v: number) => v - Math.floor(v);
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
const LEG_YAW = Math.cos(YAW * 0.5);

export interface AnimInfo7 extends AnimInfo { /** screen px travelled per cycle (distance-driven clips) */ dist?: number }

export const ANIMS7: Record<string, AnimInfo7> = {
  ...ANIME_ANIMS,
  idle: { frames: 8, fps: 5, loop: true },
  walk: { frames: 12, fps: 16, loop: true },
  run: { frames: 12, fps: 18, loop: true },
  climb: { frames: 12, fps: 12, loop: true },
  climbIdle: { frames: 1, fps: 1, loop: true },
};

// ------------------------------------------------------------------ gait

interface Gait { stride: number; stance: number; lift: number; bob: number; lean: number; swing: number; elbow: number; elbowSwing: number; drop: number; kick: number; flight: number; hand: ArmP['hand'] }
const WALK = (b: Build): Gait => ({ stride: b.thigh * 1.5, stance: 0.6, lift: 2.3 * K(b), bob: 0.8 * K(b), lean: 0.05, swing: 0.36, elbow: 0.22, elbowSwing: 0.3, drop: 0.3 * K(b), kick: 0.2, flight: 0, hand: 'relax' });
const RUN = (b: Build): Gait => ({ stride: b.thigh * 2.2, stance: 0.36, lift: 5.6 * K(b), bob: 1.2 * K(b), lean: 0.24, swing: 0.72, elbow: 1.3, elbowSwing: 0.28, drop: 1.1 * K(b), kick: 1, flight: 0.9 * K(b), hand: 'relax' });

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

function idle(b: Build, t: number): Pose {
  const k = K(b), br = Math.sin(TAU * t), sh = Math.sin(TAU * t + 0.8);
  const p = stand(b);
  // weight settled on the back leg, a slow breath, the arms hanging loose and swaying a touch
  p.hip = [0.35 * k * sh, b.hipH - 0.35 - (br < 0 ? 0.35 : 0) * (-br)];
  p.lean = 0.02 + br * 0.012;
  p.sq = 1 + br * 0.018;
  p.fl = { f: [-2.2 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.4 * k, b.ankleH], fa: 0.05 };
  p.fa = { a: 0.08 + br * 0.04 + sh * 0.02, e: 0.34 - br * 0.05, hand: 'relax' };
  p.ba = { a: -0.08 - br * 0.03, e: 0.28 + br * 0.04, hand: 'relax' };
  p.sway = 0.2 + 0.2 * br;
  return p;
}

const POSES7: Record<string, (b: Build, t: number) => Pose> = {
  idle,
  walk: (b, t) => gait(b, t, WALK(b)),
  run: (b, t) => gait(b, t, RUN(b)),
  climb,
  climbIdle: b => climb(b, 0.25),
};

export function pose7(id: string, anim: string, b: Build, frame: number): Pose {
  const fn = POSES7[anim];
  if (!fn) return animePose(id, anim, b, frame);
  const info = ANIMS7[anim];
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(b, t);
}

/** per-character clip info: distance-driven locomotion needs the character's own stride */
export function animInfo7(b: Build, anim: string): AnimInfo7 | null {
  const info = ANIMS7[anim];
  if (!info) return null;
  if (anim === 'walk') return { ...info, dist: gaitDist(WALK(b)) };
  if (anim === 'run') return { ...info, dist: gaitDist(RUN(b)) };
  if (anim === 'climb') return { ...info, dist: climbDist(b) };
  return info;
}

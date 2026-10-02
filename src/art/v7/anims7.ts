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
import { stand, animePose, ANIME_ANIMS, AnimInfo, sitP, crouchP, neckAt, prop } from '../anime/anims';
import { YAW, BACK_YAW } from './body';
import { RUNG_PITCH, RUNG_OFF, GRAB_H, GRIP_X, C_CYC, C_BOT, CLIMB_FRAMES, climbFrame } from '../ladder';


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
  // ladder climbing: the frame is the climber's place on the ladder (climbFrame), held by the caller
  climb: { frames: CLIMB_FRAMES, fps: 1, loop: true },
  climbIdle: { frames: CLIMB_FRAMES, fps: 1, loop: true },
  carryPupClimb: { frames: CLIMB_FRAMES, fps: 1, loop: true },
  // turning onto and off a ladder (transitions, see index.ts)
  climbOn: { frames: 4, fps: 22, loop: false },
  climbOff: { frames: 4, fps: 22, loop: false },
  // the camera: held up at the eye (a slow breath), raised / lowered in short clips, crept along with
  camera: { frames: 8, fps: 3, loop: true },
  cameraCrouch: { frames: 8, fps: 3, loop: true },
  photograph: { frames: 8, fps: 3, loop: true },
  cameraUp: { frames: 6, fps: 24, loop: false },
  cameraDown: { frames: 5, fps: 24, loop: false },
  cameraUpC: { frames: 6, fps: 24, loop: false },
  cameraDownC: { frames: 5, fps: 24, loop: false },
  cameraWalk: { frames: 12, fps: 12, loop: true },
  cameraCrouchWalk: { frames: 12, fps: 12, loop: true },
  // at the helm: both fists on the wheel; talking keeps one of them there (the Actor plays `talk`)
  steer: { frames: 8, fps: 4, loop: true, talk: 'steerTalk' },
  steerTalk: { frames: 8, fps: 5, loop: true },
  steerHard: { frames: 8, fps: 7, loop: true, talk: 'steerHard' },
  // ship life (crewlife.ts): smooth procedural everyday loops
  music: { frames: 16, fps: 8, loop: true, talk: 'talk' },
  musicSit: { frames: 16, fps: 8, loop: true },
  dance: { frames: 16, fps: 10, loop: true },
  snack: { frames: 24, fps: 8, loop: true, talk: 'snackTalk' },
  snackTalk: { frames: 8, fps: 5, loop: true },
  sipTea: { frames: 24, fps: 8, loop: true, talk: 'teaTalk' },
  teaTalk: { frames: 8, fps: 5, loop: true },
  yawn: { frames: 16, fps: 12, loop: false },
  stretch: { frames: 16, fps: 12, loop: false },
  tapGlass: { frames: 16, fps: 8, loop: true },
  radioTalk: { frames: 16, fps: 6, loop: true },
  charts: { frames: 16, fps: 5, loop: true },
  pet: { frames: 12, fps: 7, loop: true },
};

// ------------------------------------------------------------------ gait

export interface Gait { stride: number; stance: number; lift: number; bob: number; lean: number; swing: number; elbow: number; elbowSwing: number; drop: number; kick: number; flight: number; hand: ArmP['hand']; sway?: number; roll?: number; armOut?: number; headBob?: number }
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

export function gait(b: Build, t: number, g: Gait): Pose {
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

// ladder geometry and the climb frame encoding live in ../ladder.ts (shared with the ladder art and
// whoever moves a climber: the player, the crew): the frame IS the place on the ladder (climbFrame)
export { RUNG_PITCH, RUNG_OFF, GRAB_H, climbFrame };

/** lateral half spread of the hands (body px): on the rails, out beside the head where they read */
const HAND_Z = GRIP_X / Math.sin(-BACK_YAW);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Climbing, seen from behind, locked to the rungs. Heights are world px; W is measured up from the top
 * of the ladder (rungs at W = -3, -9, -15...; the deck at 0; the grab handles up to GRAB_H; the floor
 * at -L). Each limb takes a new hold every 12 px climbed (two rungs up), keeps it while the body rises
 * past (so it is fixed on screen), then reaches for the next in a quick arc; the hands alternate, each
 * with the opposite foot. Near the top the hands come off the rungs onto the grab handles and the feet
 * step onto the deck (a stoop down into the hatch); at the bottom the feet step down onto the floor.
 * `carry`: Chunk is tucked under the near arm and the far hand climbs alone.
 */
function climbPose(b: Build, frame: number, carry = false): Pose {
  const k = K(b);
  const d = Math.floor(frame / C_BOT), e = frame % C_BOT;
  const u = -d; // height of the feet anchor over the top
  const floorW = e < C_BOT - 1 ? -(d + e) : -1e9;
  const T = b.torso, arm = b.upArm + b.foreArm, leg = b.thigh + b.shin;
  const P = 0.66; // share of each limb's cycle spent holding on
  // reach heights (where a limb takes a hold, over the feet anchor), snapped to the rung grid
  const q = (r: number) => RUNG_OFF + RUNG_PITCH * Math.round((r - RUNG_OFF) / RUNG_PITCH);
  const hip0 = b.hipH - 0.6 * k, sh0 = hip0 + T - b.shY;
  const rH = q(sh0 + arm * 0.95), rF = q(b.ankleH + 9.2 * k);
  const handW = (W: number) => Math.min(W, GRAB_H - 3);
  const footW = (W: number) => Math.max(floorW, Math.min(0, W));
  // one limb: [height of its hold over the anchor, swing arc 0..1]
  const limb = (r: number, c: number, clampW: (W: number) => number): [number, number] => {
    const s = (u + c) / C_CYC, kk = Math.floor(s), ph = s - kk;
    const W0 = clampW(r - c + C_CYC * kk), W1 = clampW(r - c + C_CYC * (kk + 1));
    if (ph < P || W0 === W1) return [W0 - u, 0];
    const v = (ph - P) / (1 - P);
    return [W0 + (W1 - W0) * ease(v) - u, Math.sin(Math.PI * v)];
  };
  // diagonal pairs: near hand with the far foot, far hand with the near foot
  const [hN, aN] = limb(rH, 0, handW), [hF, aF] = limb(rH, 6, handW);
  const [gF, bF] = limb(rF, 0, footW), [gN, bN] = limb(rF, 6, footW);
  // the body hangs a little back from the ladder (x = 0 is the ladder's face)
  const hx = -3.4 * k;
  // the wrist sits a fist below the rung it grips; the ankle a heel above the rung it stands on
  const FIST = 1 + 1.6 * k;
  const wN = hN - FIST, wF = hF - FIST, anN = gN + b.ankleH + 0.3, anF = gF + b.ankleH + 0.3;
  // hips as high as the climb wants, but low enough for both feet and the hands to reach (a stoop to
  // the grab handles at the top of a hatch), with a little push and pull on every rung
  const legR = (an: number) => an + Math.sqrt(Math.max(1, (leg * 0.985) ** 2 - (hx - 0.9 * k) ** 2));
  const armDown = (w: number) => w + Math.sqrt(Math.max(1, (arm * 0.93) ** 2 - (hx * 0.6) ** 2)) - (T - b.shY);
  let hipY = Math.min(hip0 + 0.35 * k * Math.cos(TAU * u / RUNG_PITCH), legR(Math.min(anN, anF)));
  hipY = Math.min(hipY, armDown(carry ? wF : Math.min(wN, wF)));
  const stoop = clamp01((hip0 - hipY) / (6 * k));
  const p = stand(b, { lean: -0.04 + 0.26 * stoop, hip: [hx - 1.2 * k * stoop, hipY] });
  const hand = (w: number, arc: number): ArmP => ({ ik: [-arc * 2 * k - stoop * 0.8 * k, w - arc * 1.2 * k], hand: arc > 0.2 ? 'relax' : 'grip' });
  const foot = (an: number, arc: number): LegP => ({ f: [0.9 * k - arc * 2.4 * k, an + arc * 1.2 * k], fa: 0.12 - arc * 0.45 });
  p.fa = hand(wN, aN);
  p.ba = hand(wF, aF);
  p.fl = foot(anN, bN);
  p.bl = foot(anF, bF);
  p.legFwd = true;
  p.sway = 0.25;
  // hands on the rungs just inside the rails; the weight swings gently over the loaded foot
  const sx = 0.35 * k * Math.sin(TAU * u / C_CYC);
  p.flags = { back: 1, zN: HAND_Z, zF: -HAND_Z, sx };
  // the cast's big heads would hide hands holding on beside them: the arms draw over the head
  p.front = ['armF', 'armB'];
  if (carry) {
    // Chunk hugged against the ribs under the near arm; the far hand does the climbing
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [s[0] + 1.4 * k, s[1] - 9.4 * k], hand: 'flat' };
    p.flags = { back: 1, zF: -HAND_Z, aoN: 1.4, sx };
  }
  return p;
}

/**
 * Stepping onto (u 0 → 1) or off (u 1 → 0) a ladder: the body turns from the cast's three-quarter front
 * round to its back, the hands come up onto the rails and the feet close together. A short transition.
 */
function climbTurn(b: Build, u: number): Pose {
  const k = K(b), e = ease(u);
  const p = stand(b, { lean: 0.02 - 0.06 * e, hip: [-2.6 * k * e, b.hipH - 0.5 * k * e] });
  const s = shoulder(b, p.hip, p.lean);
  p.fl = { f: [(-1.6 * (1 - e) + 0.9 * e) * k, b.ankleH], fa: 0 };
  p.bl = { f: [(2 * (1 - e) + 0.9 * e) * k, b.ankleH + 1.4 * k * Math.sin(Math.PI * u)], fa: 0 };
  const yaw = YAW + (BACK_YAW - YAW) * e;
  if (yaw < -0.45) {
    // facing the ladder: the hands reach up for the rails
    const r = clamp01((e - 0.6) / 0.4);
    p.fa = { ik: [0, s[1] + (4 + 7 * r) * k], hand: 'grip' };
    p.ba = { ik: [0, s[1] + (2 + 5 * r) * k], hand: 'grip' };
    p.flags = { back: 1, yaw, zN: HAND_Z, zF: -HAND_Z };
    p.front = ['armF', 'armB'];
  } else {
    p.fa = { a: 0.1 + 0.6 * e, e: 0.4 + 1.3 * e, hand: 'relax' };
    p.ba = { a: -0.04 + 0.6 * e, e: 0.32 + 1.3 * e, hand: 'relax' };
    p.flags = { yaw };
  }
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

// ------------------------------------------------------------------ ship life

const smooth = (u: number) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
/** 0 → 1 → 0 over [a, b] with eased ramps of width w at each end */
const bump = (t: number, a: number, b: number, w: number) => smooth((t - a) / w) * (1 - smooth((t - (b - w)) / w));
const lerp2 = (p: P2, q: P2, u: number): P2 => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
const add2 = (p: P2, x: number, y: number): P2 => [p[0] + x, p[1] + y];
/** where a relaxed hand hangs from the shoulder */
const hang = (b: Build, s: P2, fwd = 1): P2 => [s[0] + fwd * K(b), s[1] - (b.upArm + b.foreArm) * 0.92];
/** a beat pulse: 1 on the beat, easing to 0 between beats */
const pulse = (u: number) => Math.pow(0.5 + 0.5 * Math.cos(TAU * frac(u)), 2);
/** a hand on the hip (fist), arm out (Joshu's stance) */
const onHip = (b: Build, hip: P2, x = -0.2): ArmP => ({ ik: [hip[0] + x * K(b), hip[1] + 2.4 * K(b)], hand: 'fist' });
const ps = (id: string) => (id === 'joshu' ? 1.2 : id === 'jenna' ? 0.85 : 1);
/**
 * A world-space fist target near the head (flags wN): px from the ground anchor, measured from the
 * yawed neck top, so a hand lands on the mouth or an ear whatever the build (unscaled head px).
 */
const wHead = (b: Build, p: Pose, dx: number, dy: number): P2 => {
  const n = neckAt(b, p.hip, p.lean), hd = p.hd ?? [0, 0];
  return [(n[0] + hd[0]) * Math.cos(YAW) + dx, n[1] + hd[1] + dy];
};
/** a relaxed hand hanging at the side, world space */
const wHang = (b: Build, p: Pose, dx = 1): P2 => wHead(b, p, dx, -(b.shY + (b.upArm + b.foreArm) * 0.9));

/**
 * Headphones on, lost in the music: the head nods on every beat (four to the loop), the hips sway
 * over two beats, the front foot taps, one hand presses an ear cup in close and the other bounces
 * loose at her side, fingers snapping on the backbeat.
 */
function music(b: Build, t: number): Pose {
  const k = K(b), u = t * 4, nod = pulse(u), tap = Math.max(0, -Math.cos(TAU * u));
  const p = stand(b);
  p.hip = [0.3 * k * Math.sin(TAU * t * 2), b.hipH - 0.35 - nod * 0.45 * k];
  p.lean = 0.02 + 0.03 * nod;
  p.hd = [0.35 * k * nod, -0.75 * k * nod];
  p.sq = 1 - nod * 0.012;
  p.fl = { f: [2.2 * k, b.ankleH + tap * 0.9 * k], fa: -0.55 * tap };
  p.bl = { f: [-1.8 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: wHead(b, p, -4.4, 5.2 - nod * 0.4), hand: 'flat' };
  const snap = pulse(u + 0.5);
  p.ba = { ik: add2(hang(b, s, 1.6), 0.6 * k * snap, 2.6 * k + snap * 1.4 * k), hand: snap > 0.5 ? 'pinch' : 'relax' };
  p.front = ['armF'];
  p.flags = { sx: 0.9 * k * Math.sin(TAU * t * 2), roll: 0.04 * Math.sin(TAU * t * 2), aoF: 1.2, wN: 1, zN: 5.6 };
  p.sway = 0.4 + 0.4 * nod;
  p.bounce = -nod * 0.3;
  return p;
}

/** sitting with the headphones on: nodding along, feet swinging, a hand drumming on her knee */
function musicSit(b: Build, t: number): Pose {
  const k = K(b), u = t * 4, nod = pulse(u);
  const p = sitP(b);
  p.hd = [0.3 * k * nod, -0.7 * k * nod];
  p.lean = -0.02 + 0.04 * nod;
  p.sq = 1 - nod * 0.01;
  // feet swing out and back, alternately, under the seat
  const sw = Math.sin(TAU * t * 2);
  const f0 = p.fl.f as P2, f1 = p.bl.f as P2;
  p.fl = { f: [f0[0] + 1.6 * k * sw, b.ankleH + Math.max(0, sw) * 1.2 * k], fa: 0.2 * sw };
  p.bl = { f: [f1[0] - 1.6 * k * sw, b.ankleH + Math.max(0, -sw) * 1.2 * k], fa: -0.2 * sw };
  const s = shoulder(b, p.hip, p.lean);
  p.ba = { ik: add2(s, 1.2 * k, 3.6 * k - nod * 0.4 * k), hand: 'flat' };
  const knee: P2 = [p.hip[0] + b.thigh * 0.85, p.hip[1] + 1.6 * k];
  p.fa = { ik: add2(knee, 0, 0.4 * k + pulse(u * 2) * 1.2 * k), hand: 'flat' };
  p.flags = { sx: 0.4 * k * Math.sin(TAU * t * 2) };
  p.sway = 0.3 + 0.3 * nod;
  return p;
}

/**
 * A little dance: bouncing on every beat, stepping from foot to foot, fists pumping up in turn,
 * hips and shoulders swinging, head bobbing.
 */
function dance(b: Build, t: number): Pose {
  const k = K(b), u = t * 4, nod = pulse(u), side = Math.sin(TAU * t * 2);
  const p = stand(b);
  const step = Math.floor(frac(t * 2) * 2);
  const lift = Math.max(0, Math.sin(TAU * u * 0.5));
  p.hip = [0.6 * k * side, b.hipH - 0.6 * k - nod * 0.9 * k];
  p.lean = 0.04 * side;
  p.hd = [0.3 * k * nod + 0.3 * k * side, -0.6 * k * nod];
  p.fl = { f: [2.4 * k + side * 1.2 * k, b.ankleH + (step === 0 ? lift * 1.8 * k : 0)], fa: step === 0 ? -0.4 * lift : 0 };
  p.bl = { f: [-2.2 * k + side * 1.2 * k, b.ankleH + (step === 1 ? lift * 1.8 * k : 0)], fa: step === 1 ? -0.4 * lift : 0 };
  const s = shoulder(b, p.hip, p.lean);
  const pumpN = Math.max(0, Math.sin(TAU * t * 2)), pumpF = Math.max(0, -Math.sin(TAU * t * 2));
  p.fa = { ik: add2(s, 3.2 * k, -4.2 * k + pumpN * 10.4 * k), hand: 'fist' };
  p.ba = { ik: add2(s, 2.6 * k, -4.6 * k + pumpF * 10.4 * k), hand: 'fist' };
  p.front = pumpN > 0.3 ? ['armF'] : undefined;
  p.flags = { sx: 1.2 * k * side, roll: 0.06 * side, aoN: 0.6, aoF: 0.6 };
  p.sway = 0.6 + 0.6 * nod;
  p.bounce = -nod * 0.5;
  return p;
}

/** a sandwich in hand: up for a bite, then chewing with it held at the chest */
function snack(b: Build, t: number, id: string, talk = false): Pose {
  const k = K(b);
  const p = stand(b, { lean: 0.02 });
  const br = Math.sin(TAU * t);
  p.hip = [0, b.hipH - 0.3 - Math.max(0, -br) * 0.3];
  p.fl = { f: [-1.6 * k, b.ankleH], fa: 0 };
  p.bl = { f: [1.8 * k, b.ankleH], fa: 0 };
  const up = talk ? 0 : bump(t, 0.12, 0.42, 0.1);
  const chew = talk ? 0 : t > 0.36 && t < 0.8 ? Math.abs(Math.sin(TAU * t * 6)) : 0;
  const s = shoulder(b, p.hip, p.lean);
  p.hd = [0.25 * k * up, -0.3 * k * chew];
  const chest = wHead(b, p, 3.2, -8 * k), mouth = wHead(b, p, 2.8, 3);
  p.fa = { ik: lerp2(chest, mouth, up), hand: 'grip' };
  p.ba = id === 'joshu' ? onHip(b, p.hip) : { ik: hang(b, s, 1.2), hand: 'relax' };
  p.look = up > 0.5 || chew ? 'fwd' : 'down';
  if (up > 0.4) p.front = ['armF'];
  p.props = [prop('sandwich', 0.6 * k, 0.6 * k, 0.5, { t: 1, s: ps(id), front: up > 0.4 })];
  p.flags = id === 'joshu' ? { aoF: 3.2, wN: 1, zN: 1.6 } : { sx: 0.3 * k * Math.sin(TAU * t), wN: 1, zN: 1.2 };
  return p;
}

/** a mug of tea: held warm at the chest, lifted for a long sip */
function sipTea(b: Build, t: number, id: string, talk = false): Pose {
  const k = K(b);
  const p = stand(b, { lean: -0.02 });
  const br = Math.sin(TAU * t);
  p.hip = [0, b.hipH - 0.35 - Math.max(0, -br) * 0.3];
  p.sq = 1 + br * 0.02;
  p.fl = { f: [-2.2 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.4 * k, b.ankleH], fa: 0.05 };
  const up = talk ? 0 : bump(t, 0.3, 0.82, 0.14);
  const s = shoulder(b, p.hip, p.lean);
  p.lean -= 0.06 * up;
  const chest = wHead(b, p, 3.2, -8.4 * k), mouth = wHead(b, p, 2.6, 2.2);
  p.fa = { ik: lerp2(chest, mouth, up), hand: 'grip' };
  p.ba = id === 'joshu' ? onHip(b, p.hip) : { ik: add2(s, 2.8 * k, -6.4 * k), hand: 'flat' };
  p.look = up > 0.6 ? 'up' : t < 0.25 ? 'down' : 'fwd';
  if (up > 0.35) p.front = ['armF'];
  p.props = [prop('mug', 0, -1.2 * k, 0, { t: 1, s: ps(id) * 0.9, front: up > 0.35 })];
  p.flags = id === 'joshu' ? { aoF: 3.2, sx: 0.5 * k * Math.sin(TAU * t), roll: 0.02 * Math.sin(TAU * t), wN: 1, zN: 1.6 } : { sx: 0.3 * k * br, wN: 1, zN: 1.2 };
  return p;
}

/** a big yawn: rising onto the toes, one arm reaching up behind the head, a hand over the mouth */
function yawn(b: Build, t: number): Pose {
  const k = K(b), e = bump(t, 0.02, 0.98, 0.32);
  const p = stand(b);
  p.hip = [0, b.hipH + 0.4 * k * e];
  p.lean = 0.02 - 0.16 * e;
  const s = shoulder(b, p.hip, p.lean);
  const m = bump(t, 0.2, 0.85, 0.18);
  p.fa = { ik: lerp2(wHang(b, p), wHead(b, p, 3, 2.4), m), hand: m > 0.5 ? 'flat' : 'relax' };
  p.ba = { ik: lerp2(hang(b, s, -0.4), add2(s, -4.6 * k, 10.6 * k), e), hand: e > 0.5 ? 'fist' : 'relax' };
  if (m > 0.4) p.front = ['armF'];
  p.fl = { f: [-1.6 * k, b.ankleH + 0.7 * k * e], fa: -0.4 * e };
  p.bl = { f: [1.9 * k, b.ankleH + 0.7 * k * e], fa: -0.4 * e };
  if (e > 0.45) p.look = 'up';
  p.sq = 1 + 0.03 * e;
  p.flags = { wN: 1, zN: 1.2 };
  return p;
}

/** a long stretch: both arms up over the head, up on the toes, a lean back, and down again */
function stretch(b: Build, t: number): Pose {
  const k = K(b), e = bump(t, 0.02, 0.98, 0.34);
  const p = stand(b);
  p.hip = [0, b.hipH + 0.7 * k * e];
  p.lean = 0.02 - 0.2 * e;
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: lerp2(hang(b, s, 1), add2(s, 2.4 * k, 11.8 * k), e), hand: e > 0.6 ? 'fist' : 'relax' };
  p.ba = { ik: lerp2(hang(b, s, -0.4), add2(s, -0.6 * k, 11.8 * k), e), hand: e > 0.6 ? 'fist' : 'relax' };
  p.fl = { f: [-1.6 * k, b.ankleH + 1.1 * k * e], fa: -0.6 * e };
  p.bl = { f: [1.9 * k, b.ankleH + 1.1 * k * e], fa: -0.6 * e };
  if (e > 0.5) p.look = 'up';
  p.sq = 1 + 0.04 * e;
  return p;
}

/** tapping the barometer's glass with a knuckle, twice, peering at the needle */
function tapGlass(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = stand(b, { lean: 0.06 });
  const reach = bump(t, 0.05, 0.75, 0.16);
  const tap = t > 0.22 && t < 0.6 ? Math.max(0, Math.sin(TAU * (t - 0.22) * 4)) : 0;
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: lerp2(hang(b, s, 1), add2(s, (9.4 - tap * 1.2) * k, -1.2 * k), reach), hand: reach > 0.5 ? 'point' : 'relax' };
  p.ba = id === 'joshu' ? onHip(b, p.hip) : { ik: hang(b, s, -0.4), hand: 'relax' };
  p.lean += 0.06 * reach;
  p.hd = [0.6 * k * reach, 0];
  if (reach > 0.4) { p.look = 'up'; p.front = ['armF']; }
  p.fl = { f: [1.2 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-2.2 * k, b.ankleH], fa: 0 };
  p.flags = id === 'joshu' ? { aoF: 3.2, yaw: 0.95 - 0.5 * reach } : { yaw: 0.95 - 0.5 * reach };
  return p;
}

/** on the radio: the handset up at his beard, chatting, the other fist on his hip */
function radioTalk(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const i = Math.floor(t * 8) % 8;
  const p = stand(b, { lean: 0.02 + [0, 0.02, 0.03, 0.01, 0, 0.02, 0.04, 0.01][i] });
  const s = shoulder(b, p.hip, p.lean);
  p.hd = [0.2 * k * (i % 2), -0.2 * k * ((i + 1) % 2)];
  p.fa = { ik: wHead(b, p, 2.4, 2.2), hand: 'grip' };
  p.front = ['armF'];
  p.ba = id === 'joshu' ? onHip(b, p.hip) : { ik: hang(b, s, -0.4), hand: 'relax' };
  p.props = [prop('phone', 0, 0, 1.45, { t: 1, s: 0.9, front: true })];
  p.hd = [0.2 * k * (i % 2), -0.2 * k * ((i + 1) % 2)];
  p.flags = id === 'joshu' ? { aoF: 3.2, sx: 0.4 * k * Math.sin(TAU * t), wN: 1, zN: 1.6 } : { wN: 1, zN: 1.2 };
  return p;
}

/** bent over the chart table: one hand planted, a finger tracing the course, the head down */
function charts(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = stand(b, { lean: 0.32, hip: [-1.4 * k, b.hipH - 0.6 * k] });
  p.fl = { f: [1.4 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-3 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  const tableY = b.hipH + 2.4 * k;
  const trace = Math.sin(TAU * t) * 1.8 * k;
  p.fa = { ik: [s[0] + 7.4 * k + trace, tableY + Math.max(0, Math.cos(TAU * t * 2)) * 0.6 * k], hand: 'point' };
  p.ba = { ik: [s[0] + 5.2 * k, tableY - 0.4 * k], hand: 'flat' };
  p.look = 'down';
  p.flags = id === 'joshu' ? { yaw: 0.75 } : {};
  return p;
}

/** crouched down giving the dog a scratch behind the ears */
function pet(b: Build, t: number): Pose {
  const k = K(b);
  const p = crouchP(b, 0.56, 0.3);
  const ruff = Math.sin(TAU * t);
  p.fa = { ik: [p.hip[0] * Math.cos(YAW) + 9 * k + ruff * 0.8 * k, 6 * k + Math.abs(ruff) * 0.6 * k], hand: 'flat' };
  p.ba = { ik: [p.hip[0] + 5.4 * k, p.hip[1] + 0.6 * k], hand: 'flat' };
  p.hd = [0.3 * k, -0.2 * k * ruff];
  p.look = 'down';
  p.flags = { wN: 1 };
  return p;
}

// ------------------------------------------------------------------ the camera

/** creeping with the camera up: short careful steps on soft knees, the upper body steady */
const CAM_GAIT = (b: Build, crouch: boolean): Gait => ({
  stride: b.thigh * (crouch ? 0.75 : 0.9), stance: 0.66, lift: (crouch ? 1.3 : 1.5) * K(b), bob: 0.2 * K(b), lean: crouch ? 0.14 : 0.04,
  swing: 0, elbow: 0, elbowSwing: 0, drop: (crouch ? 6 : 0.7) * K(b), kick: 0, flight: 0, hand: 'grip',
});

/**
 * Taking a photo: u 0 = arms hanging (the camera just come off its strap), 0.35 = both hands on it at
 * the chest, lens tipped down, 1 = up at the eye. Near hand on the grip with a finger on the shutter,
 * far hand cupping the lens from below, elbows tucked in under it, a little lean into the viewfinder.
 * Raising and lowering are short clips through u. `crouch` low on bent knees, `walk` (a gait phase)
 * creeping along with it raised; `t` a slow breath the camera rides.
 */
function cameraPose(b: Build, u: number, crouch: boolean, walk: number | null, t = 0): Pose {
  const k = K(b);
  let p: Pose;
  if (walk !== null) p = gait(b, walk, CAM_GAIT(b, crouch));
  else if (crouch) { p = crouchP(b, 0.66, 0.12); }
  else {
    p = stand(b, { lean: 0.02 });
    p.fl = { f: [2.3 * k, b.ankleH], fa: 0 };
    p.bl = { f: [-2.5 * k, b.ankleH], fa: 0.04 };
    p.hip = [0.2 * k, b.hipH - 0.35 * k];
  }
  const br = Math.sin(TAU * t);
  if (walk === null) p.hip = [p.hip[0], p.hip[1] + br * 0.18 * k];
  const up = smooth((u - 0.35) / 0.65), grab = smooth(u / 0.35);
  p.lean += 0.06 * up;
  p.hd = [0.35 * k * up, -0.25 * k * up];
  // the camera: at the chest, lens tipped down → at the eye, level
  const eye = wHead(b, p, 4.6, 6.2), chest = wHead(b, p, 5.2, -8.6 * k);
  const C = lerp2(chest, eye, up);
  const ang = -0.85 * (1 - up);
  const rot = (dx: number, dy: number): P2 => [C[0] + dx * Math.cos(ang) - dy * Math.sin(ang), C[1] + dx * Math.sin(ang) + dy * Math.cos(ang)];
  const gripN = rot(-1.4, -1.7), gripF = rot(2.2, -2.3);
  const hangN = wHang(b, p, 1.2), hangF = wHang(b, p, 0.2);
  p.fa = { ik: lerp2(hangN, gripN, grab), hand: grab > 0.6 ? 'grip' : 'relax' };
  p.ba = { ik: lerp2(hangF, gripF, grab), hand: grab > 0.6 ? 'grip' : 'relax' };
  p.flags = { ...(p.flags ?? {}), wN: 1, wF: 1, zN: 2.6 - 1.2 * up, zF: -1.2 + 1.4 * grab, aoN: 0, aoF: 0 };
  p.front = grab > 0.5 ? ['armF', 'armB'] : ['armF'];
  p.look = up > 0.5 ? 'fwd' : 'down';
  if (grab > 0.05) p.props = [prop('camera', C[0] / Math.cos(YAW), C[1], ang, { t: 0, s: 0.85, front: true })];
  p.sway = 0.2;
  return p;
}

const POSES7: Record<string, (b: Build, t: number, id: string) => Pose> = {
  idle,
  steer: (b, t) => steer(b, t),
  steerTalk: (b, t) => steerTalk(b, t),
  steerHard: (b, t) => steer(b, t, 1),
  walk: (b, t, id) => gait(b, t, WALK(b, id)),
  run: (b, t, id) => gait(b, t, RUN(b, id)),
  // the climb clips take their frame straight (see pose7), not a phase
  climb: b => climbPose(b, 0),
  carryPupClimb: b => climbPose(b, 0, true),
  climbIdle: b => climbPose(b, 0),
  climbOn: (b, t) => climbTurn(b, t),
  climbOff: (b, t) => climbTurn(b, 1 - t),
  camera: (b, t) => cameraPose(b, 1, false, null, t),
  cameraCrouch: (b, t) => cameraPose(b, 1, true, null, t),
  cameraUp: (b, t) => cameraPose(b, t, false, null),
  cameraDown: (b, t) => cameraPose(b, 1 - t, false, null),
  cameraUpC: (b, t) => cameraPose(b, t, true, null),
  cameraDownC: (b, t) => cameraPose(b, 1 - t, true, null),
  cameraWalk: (b, t) => cameraPose(b, 1, false, t),
  cameraCrouchWalk: (b, t) => cameraPose(b, 1, true, t),
  photograph: (b, t) => cameraPose(b, 1, false, null, t),
  music: (b, t) => music(b, t),
  musicSit: (b, t) => musicSit(b, t),
  dance: (b, t) => dance(b, t),
  snack: (b, t, id) => snack(b, t, id),
  snackTalk: (b, t, id) => snack(b, t, id, true),
  sipTea: (b, t, id) => sipTea(b, t, id),
  teaTalk: (b, t, id) => sipTea(b, t, id, true),
  yawn: (b, t) => yawn(b, t),
  stretch: (b, t) => stretch(b, t),
  tapGlass: (b, t, id) => tapGlass(b, t, id),
  radioTalk: (b, t, id) => radioTalk(b, t, id),
  charts: (b, t, id) => charts(b, t, id),
  pet: (b, t) => pet(b, t),
};

export function pose7(id: string, anim: string, b: Build, frame: number): Pose {
  const own = OWN7[id]?.[anim];
  if (own) {
    const info = { ...ANIMS7[anim], ...own.info };
    const n = info.frames;
    return own.pose(b, n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1), frame);
  }
  const fn = POSES7[anim];
  if (!fn) return animePose(id, anim, b, frame);
  if (anim === 'climb' || anim === 'climbIdle' || anim === 'carryPupClimb') return climbPose(b, frame, anim === 'carryPupClimb');
  const info = ANIMS7[anim];
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(b, t, id);
}

/** per-character clip info: distance-driven locomotion needs the character's own stride */
export function animInfo7(b: Build, anim: string, id = 'mori'): AnimInfo7 | null {
  const info = ANIMS7[anim];
  if (!info) return null;
  const own = OWN7[id]?.[anim];
  if (own) return { ...info, ...own.info, dist: own.dist?.(b) ?? (own.info?.dist ?? info.dist) };
  if (anim === 'walk') return { ...info, dist: gaitDist(WALK(b, id)) };
  if (anim === 'run') return { ...info, dist: gaitDist(RUN(b, id)) };
  if (anim === 'cameraWalk') return { ...info, dist: gaitDist(CAM_GAIT(b, false)) };
  if (anim === 'cameraCrouchWalk') return { ...info, dist: gaitDist(CAM_GAIT(b, true)) };
  return info;
}

// ------------------------------------------------------------------ registration (other modules)

type PoseFn7 = (b: Build, t: number, id: string) => Pose;
/**
 * Add a clip to the cast (combat moves, handling poses...): its frame info and its pose function
 * (t runs 0..1 over the clip; looping clips wrap). Registered clips are callable by name everywhere
 * (Actor.setAnim / play), so other modules only need the name (see anim-contract.ts).
 */
export function registerAnim7(name: string, info: AnimInfo7, fn: PoseFn7) {
  ANIMS7[name] = info;
  POSES7[name] = fn;
}
/** a character's own version of a clip (Aroha's idle / walk / run, her faster combat moves): frame
 *  info overrides, the pose (t 0..1, and the raw frame), and the distance per cycle for gaits */
export interface OwnClip7 { info?: Partial<AnimInfo7>; pose: (b: Build, t: number, frame: number) => Pose; dist?: (b: Build) => number }
export const OWN7: Record<string, Record<string, OwnClip7>> = {};
/** register a character's own version of a clip (the clip must exist in ANIMS7, or be registered) */
export function registerOwn7(id: string, anim: string, clip: OwnClip7) {
  (OWN7[id] ??= {})[anim] = clip;
}
/** frame count of a clip for one character (own clips may have more frames) */
export function framesOf7(id: string, anim: string): number {
  return Math.max(1, OWN7[id]?.[anim]?.info?.frames ?? ANIMS7[anim]?.frames ?? 1);
}

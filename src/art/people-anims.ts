// V2 people: animation table and pose authoring (keyframed + procedural cycles).
// Poses are authored in GROUND space (x forward, y up, origin between the feet) from each
// character's Build, so the same animation fits tall Aroha and small Pip.

import { Build, Pose, ArmP, LegP, P2, PropP, keys } from './people-rig';
import type { CharId } from './people-parts';

export interface AnimInfo { frames: number; fps: number; loop: boolean }

const A = (frames: number, fps: number, loop = true): AnimInfo => ({ frames, fps, loop });

export const ANIMS: Record<string, AnimInfo> = {
  // common
  idle: A(4, 3), walk: A(8, 10), run: A(8, 14), talk: A(4, 5), crouch: A(2, 2), crouchWalk: A(6, 8),
  jump: A(1, 1), fall: A(1, 1), land: A(1, 1), sit: A(2, 1.5), sitGround: A(2, 1.5), eat: A(4, 4),
  lie: A(2, 1), wake: A(4, 4, false), kneel: A(4, 5), dig: A(4, 6), net: A(4, 8), tweeze: A(2, 2),
  jar: A(4, 5), hammer: A(4, 8), build: A(4, 8), carry: A(8, 10), carryIdle: A(2, 2), point: A(2, 2),
  wave: A(4, 6), shrug: A(2, 2), cheer: A(2, 4), think: A(2, 1.5), facepalm: A(2, 2), scared: A(2, 6),
  fallBack: A(4, 10, false), sitShock: A(2, 4), getUp: A(4, 6, false), brace: A(2, 4), slip: A(4, 8),
  pull: A(4, 6), climb: A(4, 6), swim: A(4, 5),
  // rowan
  camera: A(2, 2), cameraCrouch: A(2, 2), notebook: A(4, 4), observe: A(2, 2), phone: A(2, 3), type: A(4, 8),
  // crowe
  steer: A(4, 3), pipe: A(4, 2), map: A(2, 2), bellyLaugh: A(4, 8),
  // aroha
  staff: A(4, 3), staffWalk: A(8, 10), track: A(4, 4), explain: A(4, 5), fire: A(4, 6), lunge: A(3, 12, false),
  // lou
  cook: A(4, 5), serve: A(2, 2), taste: A(2, 2),
  // pip
  wrench: A(4, 8), tinker: A(4, 6),
};

export const COMMON = ['idle', 'walk', 'run', 'talk', 'crouch', 'crouchWalk', 'jump', 'fall', 'land', 'sit', 'sitGround', 'eat', 'lie', 'wake', 'kneel', 'dig', 'net', 'tweeze', 'jar', 'hammer', 'build', 'carry', 'carryIdle', 'point', 'wave', 'shrug', 'cheer', 'think', 'facepalm', 'scared', 'fallBack', 'sitShock', 'getUp', 'brace', 'slip', 'pull', 'climb', 'swim'];

export const CHAR_SPECIALS: Record<CharId, string[]> = {
  rowan: ['camera', 'cameraCrouch', 'notebook', 'observe', 'phone', 'type'],
  crowe: ['steer', 'pipe', 'map', 'bellyLaugh'],
  aroha: ['staff', 'staffWalk', 'track', 'explain', 'fire', 'lunge'],
  lou: ['cook', 'serve', 'taste'],
  pip: ['wrench', 'tinker', 'type'],
};

type PoseFn = (b: Build, t: number, id: CharId) => Pose;

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const sm = (t: number) => t * t * (3 - 2 * t);
const sin = Math.sin, cos = Math.cos;

/** neutral standing pose */
export function stand(b: Build, over: Partial<Pose> = {}): Pose {
  return {
    hip: [0, b.hipH],
    lean: 0.03,
    fa: { a: 0.12, e: 0.42, hand: 'fist' },
    ba: { a: -0.02, e: 0.35, hand: 'fist' },
    fl: { f: [-2.4, b.ankleH] },
    bl: { f: [2.8, b.ankleH] },
    ...over,
  };
}

// ------------------------------------------------------------------ reference points (ground space)

/** shoulder (front) position for a hip + lean */
function shoulderAt(b: Build, hip: P2, lean: number): P2 {
  const up: P2 = [sin(lean), cos(lean)], fwd: P2 = [cos(lean), -sin(lean)];
  const T = b.torso - b.shY;
  return [hip[0] + fwd[0] * b.shF + up[0] * T, hip[1] + fwd[1] * b.shF + up[1] * T];
}
/** approximate neck-top (head anchor) position */
function neckAt(b: Build, hip: P2, lean: number): P2 {
  const up: P2 = [sin(lean), cos(lean)];
  const nUp: P2 = [sin(lean * 0.6), cos(lean * 0.6)];
  return [hip[0] + up[0] * b.torso + nUp[0] * b.neck, hip[1] + up[1] * b.torso + nUp[1] * b.neck];
}
/** a point in front of the face (mouth / eye height) */
function face(b: Build, hip: P2, lean: number, dx: number, dy: number): P2 {
  const n = neckAt(b, hip, lean);
  return [n[0] + dx, n[1] + dy];
}
const add = (p: P2, x: number, y: number): P2 => [p[0] + x, p[1] + y];

interface CycleOpts {
  stride: number;
  lift: number;
  bob: number;
  lean: number;
  swing: number;
  elbow: number;
  elbowSwing: number;
  stance: number;
  flight?: number;
  hipDrop?: number;
  crouch?: number;
}

/** Procedural walk/run cycle. t in [0,1); near leg contacts (front) at t=0. */
export function cycle(b: Build, t: number, o: CycleOpts): Pose {
  const S = o.stride;
  const leg = (ph: number, nearLeg: boolean): LegP => {
    ph = frac(ph);
    const st = o.stance;
    const base = nearLeg ? -0.8 : 1.2;
    if (ph < st) {
      const k = ph / st;
      const x = S / 2 - S * k;
      const fa = k < 0.2 ? 0.28 * (1 - k / 0.2) : k > 0.75 ? -0.5 * ((k - 0.75) / 0.25) : 0;
      const y = b.ankleH + (k > 0.75 ? ((k - 0.75) / 0.25) * 1.6 : 0);
      return { f: [base + x, y], fa };
    }
    const k = (ph - st) / (1 - st);
    const x = -S / 2 + S * sm(k);
    const y = b.ankleH + o.lift * Math.sin(k * Math.PI) + (k < 0.3 ? 1.6 * (1 - k / 0.3) : 0);
    const fa = k < 0.4 ? -0.5 * (1 - k / 0.4) : k > 0.8 ? 0.28 * ((k - 0.8) / 0.2) : 0;
    return { f: [base + x, y], fa };
  };
  const bobPh = Math.cos(TAU * 2 * (t - 0.12));
  const hipY = b.hipH - (o.crouch ?? 0) - o.bob * (0.5 + 0.5 * bobPh) + (o.flight ?? 0) * Math.max(0, -Math.cos(TAU * 2 * (t - 0.12)));
  const sw = Math.cos(TAU * t);
  const fa: ArmP = { a: -o.swing * sw + 0.05, e: o.elbow + o.elbowSwing * Math.max(0, -sw), hand: 'fist' };
  const ba: ArmP = { a: o.swing * sw + 0.05, e: o.elbow + o.elbowSwing * Math.max(0, sw), hand: 'fist' };
  return {
    hip: [0.3 * Math.sin(TAU * 2 * t), hipY],
    lean: o.lean,
    fa,
    ba,
    fl: leg(t, true),
    bl: leg(t + 0.5, false),
    bounce: o.bob * 0.7 * Math.cos(TAU * 2 * (t - 0.25)),
    sway: (o.hipDrop ?? 0.6) + 0.5 * Math.sin(TAU * 2 * t),
  };
}

const walkC = (b: Build, t: number) => cycle(b, t, { stride: b.thigh * 1.45, lift: 3, bob: 1.2, lean: 0.07, swing: 0.5, elbow: 0.25, elbowSwing: 0.4, stance: 0.56 });

// ------------------------------------------------------------------ pose builders

function crouchP(b: Build, depth = 0.62, lean = 0.36): Pose {
  const hip: P2 = [-1, b.hipH * depth];
  return stand(b, {
    hip, lean,
    fl: { f: [3.5, b.ankleH], fa: 0 },
    bl: { f: [-3.5, b.ankleH], fa: -0.2 },
    fa: { a: 0.9, e: 0.7, hand: 'fist' },
    ba: { a: 0.6, e: 0.8, hand: 'fist' },
    legFwd: true,
    sway: 0.4,
  });
}

function kneelP(b: Build, lean = 0.42): Pose {
  const hip: P2 = [-1.5, b.hipH * 0.52];
  return stand(b, {
    hip, lean,
    fl: { f: [6, b.ankleH], fa: 0 },
    bl: { f: [-8.5, 1.6], fa: -1.1 },
    fa: { a: 1.2, e: 0.2, hand: 'fist' },
    ba: { a: 0.7, e: 0.5, hand: 'fist' },
    legFwd: true,
  });
}

function sitP(b: Build, seat = 16): Pose {
  const hip: P2 = [-3, seat + 1.5];
  const knee = b.thigh * 0.95;
  return stand(b, {
    hip, lean: -0.02,
    fl: { f: [hip[0] + knee + 0.5, b.ankleH], fa: 0 },
    bl: { f: [hip[0] + knee - 1.5, b.ankleH], fa: 0 },
    fa: { ik: [hip[0] + knee + 0.5, seat + 3.5], hand: 'flat' },
    ba: { ik: [hip[0] + knee - 1, seat + 3], hand: 'flat' },
    legFwd: true,
    legBFwd: true,
  });
}

function sitGroundP(b: Build, lean = -0.12): Pose {
  const hip: P2 = [0, 3.4];
  const L = b.thigh + b.shin;
  return stand(b, {
    hip, lean,
    fl: { f: [L - 3, b.ankleH - 0.6], fa: 0.3 },
    bl: { f: [L - 5.5, b.ankleH - 0.4], fa: 0.3 },
    fa: { ik: [b.thigh * 0.7, 9], hand: 'flat' },
    ba: { ik: [-7, 1.2], hand: 'flat' },
    legFwd: true,
    legBFwd: true,
  });
}

function lieP(b: Build, breathe = 0): Pose {
  const L = b.thigh + b.shin;
  const hip: P2 = [-4, 3.2 + breathe * 0.3];
  return {
    hip, lean: 1.5,
    sq: 1 + breathe * 0.02,
    fa: { a: -1.45, e: 0.1, hand: 'flat' },
    ba: { a: -1.5, e: 0.05, hand: 'flat' },
    fl: { f: [hip[0] - L + 1, b.ankleH - 0.5], fa: 1.4 },
    bl: { f: [hip[0] - L + 2, b.ankleH], fa: 1.4 },
    legFwd: true,
    flags: { hrot: -1.45 },
  };
}

const hands = (p: Pose, fa: P2, ba: P2 | null, hf: ArmP['hand'] = 'grip', hb: ArmP['hand'] = 'grip', front = false): Pose => {
  p.fa = { ik: fa, hand: hf };
  if (ba) p.ba = { ik: ba, hand: hb };
  if (front) p.front = ['armF'];
  return p;
};

const prop = (kind: string, x = 0, y = 0, a = 0, o: Partial<PropP> = {}): PropP => ({ kind, x, y, a, ...o });

// Aroha always carries her taiaha: on her back unless it's in her hands
const withBackStaff = (id: CharId, p: Pose): Pose => {
  if (id !== 'aroha') return p;
  if (p.props?.some(q => q.kind === 'taiaha')) return p;
  p.props = [...(p.props ?? []), prop('taiahaBack', 0, 0, 0, { z: 'back' })];
  return p;
};

// ------------------------------------------------------------------ the poses

const POSES: Record<string, PoseFn> = {
  idle: (b, t) => {
    const br = Math.sin(TAU * t);
    const p = stand(b);
    p.hip = [0, b.hipH - (br < 0 ? 0.6 : 0)];
    p.sq = 1 + br * 0.02;
    p.fa = { a: 0.13 + br * 0.03, e: 0.42 - br * 0.05, hand: 'fist' };
    p.ba = { a: -0.02 - br * 0.02, e: 0.35, hand: 'fist' };
    p.bounce = br < 0 ? -0.4 : 0.2;
    return p;
  },
  walk: walkC,
  run: (b, t) => cycle(b, t, { stride: b.thigh * 2.1, lift: 4.6, bob: 1.5, lean: 0.24, swing: 0.95, elbow: 1.4, elbowSwing: 0.3, stance: 0.42, flight: 1.6, hipDrop: 1.8 }),
  talk: (b, t) => {
    const p = stand(b);
    const s = shoulderAt(b, p.hip, p.lean);
    const k = [[9, -6, 'open'], [11, -2, 'open'], [8, -4, 'flat'], [10, -8, 'point']] as const;
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: add(s, k[i][0], k[i][1]), hand: k[i][2] };
    p.ba = { a: 0.1 + (i % 2) * 0.15, e: 0.5 + (i % 2) * 0.3, hand: 'open' };
    p.lean = 0.04 + (i % 2) * 0.02;
    p.bounce = i % 2 ? 0.4 : 0;
    return p;
  },
  crouch: (b, t) => {
    const p = crouchP(b);
    p.hip[1] -= Math.sin(TAU * t) > 0 ? 0.4 : 0;
    return p;
  },
  crouchWalk: (b, t) => {
    const p = cycle(b, t, { stride: b.thigh * 1.1, lift: 2, bob: 0.6, lean: 0.4, swing: 0.25, elbow: 0.9, elbowSwing: 0.2, stance: 0.6, crouch: b.hipH * 0.36 });
    p.legFwd = true;
    return p;
  },
  jump: b => stand(b, {
    hip: [0, b.hipH + 3], lean: 0.08,
    fl: { f: [4, b.ankleH + 7], fa: -0.3 }, bl: { f: [-3, b.ankleH + 4], fa: -0.6 },
    fa: { a: 2.5, e: 0.3, hand: 'open' }, ba: { a: 2.2, e: 0.4, hand: 'open' },
  }),
  fall: b => stand(b, {
    hip: [0, b.hipH + 1], lean: -0.05,
    fl: { f: [2.5, b.ankleH - 1], fa: 0.2 }, bl: { f: [-2, b.ankleH + 1], fa: -0.3 },
    fa: { a: 1.9, e: -0.3, hand: 'open' }, ba: { a: 1.6, e: -0.2, hand: 'open' },
  }),
  land: b => stand(b, {
    hip: [0, b.hipH * 0.82], lean: 0.2, sq: 0.9,
    fl: { f: [3.5, b.ankleH] }, bl: { f: [-3.5, b.ankleH] },
    fa: { a: 0.8, e: 0.3, hand: 'open' }, ba: { a: 0.6, e: 0.3, hand: 'open' },
  }),
  sit: (b, t) => {
    const p = sitP(b);
    p.sq = 1 + (Math.sin(TAU * t) > 0 ? 0.015 : 0);
    return p;
  },
  sitGround: (b, t) => {
    const p = sitGroundP(b);
    p.sq = 1 + (Math.sin(TAU * t) > 0 ? 0.015 : 0);
    return p;
  },
  eat: (b, t) => {
    const p = sitP(b);
    const i = Math.floor(t * 4) % 4;
    const bowl: P2 = [p.hip[0] + b.thigh + 2, 25];
    const mouth = face(b, p.hip, p.lean, 6.5, 4);
    p.ba = { ik: bowl, hand: 'flat' };
    p.fa = i === 1 || i === 2 ? { ik: mouth, hand: 'pinch' } : { ik: add(bowl, 1, 3), hand: 'pinch' };
    p.front = i === 1 || i === 2 ? ['armF'] : undefined;
    p.props = [prop('bowl', 0, 1, 0, { t: 2, z: 'hand' }), prop('spoon', 0, 0, i === 1 || i === 2 ? 2.4 : 0.6, { t: 1, front: i === 1 || i === 2 })];
    p.look = i === 0 ? 'down' : 'fwd';
    return p;
  },
  lie: (b, t) => lieP(b, Math.sin(TAU * t)),
  wake: (b, t) => keys(t, [lieP(b), { ...lieP(b), lean: 1.1, hip: [-3, 3.4] }, { ...sitGroundP(b, 0.25) }, sitGroundP(b)], false),
  kneel: (b, t) => {
    const p = kneelP(b);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: [12 + (i % 2) * 1.5, 5 + (i === 2 ? 2 : 0)], hand: 'grip' };
    p.ba = { ik: [11, 9 + (i % 2)], hand: 'grip' };
    p.props = [prop('knife', 0, 0, -0.9 + (i % 2) * 0.5, { t: 1 })];
    p.look = 'down';
    return p;
  },
  dig: (b, t) => {
    const p = kneelP(b, 0.5);
    const i = Math.floor(t * 4) % 4;
    const y = [8, 2, 3.5, 6][i];
    p.fa = { ik: [12, y], hand: 'grip' };
    p.ba = { ik: [8, 8], hand: 'flat' };
    p.props = [prop('trowel', 0, 0, -1.3, { t: 1 })];
    p.look = 'down';
    p.bounce = i === 1 ? -0.6 : 0;
    return p;
  },
  net: (b, t) => {
    const p = stand(b, { lean: 0.1, fl: { f: [4, b.ankleH] }, bl: { f: [-4, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const ang = [2.4, 1.4, 0.4, 0.9][Math.floor(t * 4) % 4];
    p.fa = { ik: [s[0] + sin(ang) * 13, s[1] - cos(ang) * 13 + 2], hand: 'grip' };
    p.ba = { a: 0.3, e: 0.5, hand: 'fist' };
    p.props = [prop('net', 0, 0, ang - Math.PI / 2 + 0.3, { t: 1 })];
    return p;
  },
  tweeze: (b, t) => {
    const p = crouchP(b, 0.55, 0.5);
    p.fa = { ik: [11 + (t > 0.5 ? 0.6 : 0), 4], hand: 'pinch' };
    p.ba = { ik: [9, 12], hand: 'grip' };
    p.props = [prop('tweezers', 0, 0, -1.2, { t: 1 }), prop('magnifier', 0, 0, -0.6, { t: 2 })];
    p.look = 'down';
    return p;
  },
  jar: (b, t) => {
    const p = crouchP(b, 0.55, 0.45);
    const i = Math.floor(t * 4) % 4;
    p.ba = { ik: [10, 3], hand: 'grip' };
    p.fa = { ik: [11, [12, 9, 5.5, 5.5][i]], hand: 'flat' };
    p.props = [prop('jar', 0, 0, 0, { t: 2 }), prop('lid', 0, -1, 0, { t: 1 })];
    p.look = 'down';
    return p;
  },
  hammer: (b, t) => {
    const p = kneelP(b, 0.46);
    const i = Math.floor(t * 4) % 4;
    const up = i === 0 || i === 3;
    p.fa = { ik: up ? [8, 16] : [12, 5], hand: 'grip' };
    p.ba = { ik: [13, 3], hand: 'pinch' };
    p.props = [prop('hammer', 0, 0, up ? 1.6 : -0.3, { t: 1 }), prop('peg', 13.5, 0, 0)];
    p.look = 'down';
    p.bounce = up ? 0 : -0.5;
    return p;
  },
  build: (b, t) => {
    const p = stand(b, { lean: 0.08, fl: { f: [3, b.ankleH] }, bl: { f: [-3, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    const up = i === 0 || i === 3;
    p.fa = { ik: add(s, 9, up ? 5 : -5), hand: 'grip' };
    p.ba = { ik: add(s, 11, -6), hand: 'flat' };
    p.props = [prop('hammer', 0, 0, up ? 1.7 : -0.1, { t: 1 })];
    return p;
  },
  carry: (b, t) => {
    const p = walkC(b, t);
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 8, -9), hand: 'grip' };
    p.ba = { ik: add(s, 6, -9), hand: 'grip' };
    p.lean = -0.05;
    p.props = [prop('crate', 0, 0, 0, { t: 3, z: 'mid' })];
    return p;
  },
  carryIdle: (b, t) => {
    const p = stand(b, { lean: -0.05 });
    p.hip[1] -= Math.sin(TAU * t) > 0 ? 0.5 : 0;
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 8, -9), hand: 'grip' };
    p.ba = { ik: add(s, 6, -9), hand: 'grip' };
    p.props = [prop('crate', 0, 0, 0, { t: 3, z: 'mid' })];
    return p;
  },
  point: (b, t) => {
    const p = stand(b, { lean: 0.05 });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 14.5, 2 + (t > 0.5 ? 0.6 : 0)), hand: 'point', ha: 0.1 };
    return p;
  },
  wave: (b, t) => {
    const p = stand(b);
    const s = shoulderAt(b, p.hip, p.lean);
    const dx = [3, 6, 3, 6][Math.floor(t * 4) % 4];
    p.fa = { ik: add(s, dx, 12), hand: 'open' };
    return p;
  },
  shrug: (b, t) => {
    const p = stand(b, { hd: [0, -1.2] });
    const s = shoulderAt(b, p.hip, p.lean);
    const k = t > 0.5 ? 1 : 0;
    p.fa = { ik: add(s, 8, -4 + k), hand: 'open', ha: 1.2 };
    p.ba = { ik: add(s, 3, -3 + k), hand: 'open', ha: 1.2 };
    return p;
  },
  cheer: (b, t) => {
    const p = stand(b, { hip: [0, b.hipH + (t > 0.5 ? 2 : 0)] });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 4, 14), hand: 'fist' };
    p.ba = { ik: add(s, 0, 13), hand: 'fist' };
    if (t > 0.5) { p.fl = { f: [-2, b.ankleH + 2], fa: -0.3 }; p.bl = { f: [2, b.ankleH + 2], fa: -0.3 }; }
    return p;
  },
  think: (b, t) => {
    const p = stand(b);
    const chin = face(b, p.hip, p.lean, 6, 1 + (t > 0.5 ? 0.5 : 0));
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: chin, hand: 'point' };
    p.ba = { ik: add(s, 5, -9), hand: 'fist' };
    p.armBFwd = true;
    p.front = ['armF'];
    return p;
  },
  facepalm: (b, t) => {
    const p = stand(b, { lean: 0.12, look: 'down' });
    p.fa = { ik: face(b, p.hip, p.lean, 6, 7 - (t > 0.5 ? 0.6 : 0)), hand: 'flat' };
    p.front = ['armF'];
    return p;
  },
  scared: (b, t) => {
    const p = crouchP(b, 0.8, -0.12);
    const n = neckAt(b, p.hip, p.lean);
    const j = t > 0.5 ? 0.6 : 0;
    p.fa = { ik: add(n, 7 + j, 3), hand: 'open' };
    p.ba = { ik: add(n, 5, 1 + j), hand: 'open' };
    p.front = ['armF'];
    p.look = 'down';
    return p;
  },
  fallBack: (b, t) => keys(t, [
    stand(b, { lean: -0.1, fa: { a: 1.4, e: 0.2, hand: 'open' }, ba: { a: 1.2, e: 0.2, hand: 'open' } }),
    stand(b, { hip: [-3, b.hipH * 0.8], lean: -0.45, fa: { a: 2.2, e: 0.2, hand: 'open' }, ba: { a: 2, e: 0.2, hand: 'open' }, fl: { f: [5, b.ankleH + 3], fa: 0.5 } }),
    { ...sitGroundP(b, -0.5), hip: [-1, 5] },
    sitGroundP(b, -0.35),
  ], false),
  sitShock: (b, t) => {
    const p = sitGroundP(b, -0.35);
    p.hip = [t > 0.5 ? 0.4 : -0.4, 3.4];
    p.fa = { ik: [-5, 1.2], hand: 'flat' };
    p.ba = { ik: [-8, 1.2], hand: 'flat' };
    return p;
  },
  getUp: (b, t) => keys(t, [sitGroundP(b, 0.1), kneelP(b, 0.3), crouchP(b, 0.75, 0.2), stand(b)], false),
  brace: (b, t) => {
    const p = stand(b, { lean: 0.32, fl: { f: [6, b.ankleH] }, bl: { f: [-6, b.ankleH], fa: -0.3 } });
    p.hip = [0, b.hipH * 0.9 - (t > 0.5 ? 0.5 : 0)];
    p.fa = { ik: [14, 30], hand: 'grip' };
    p.ba = { ik: [12, 28], hand: 'grip' };
    p.sway = 1.5;
    return p;
  },
  slip: (b, t) => {
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: [-0.3, -0.15, -0.35, -0.2][i] });
    p.fa = { a: [2.6, 1.8, 2.2, 1.5][i], e: 0.3, hand: 'open' };
    p.ba = { a: [1.6, 2.5, 1.4, 2.4][i], e: 0.3, hand: 'open' };
    p.fl = { f: [i % 2 ? 6 : 3, b.ankleH + (i % 2 ? 4 : 0)], fa: 0.4 };
    p.bl = { f: [-3, b.ankleH] };
    return p;
  },
  pull: (b, t) => {
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: -0.32 + (i === 1 || i === 2 ? -0.08 : 0), fl: { f: [6, b.ankleH] }, bl: { f: [-5, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const k = i === 1 || i === 2 ? -3 : 1;
    p.fa = { ik: add(s, 11 + k, -2), hand: 'grip' };
    p.ba = { ik: add(s, 8 + k, -4), hand: 'grip' };
    p.props = [prop('rope', 0, 0, 0.5, { t: 1 })];
    return p;
  },
  climb: (b, t) => {
    const i = Math.floor(t * 4) % 4;
    const hy = b.hipH;
    const p = stand(b, { hip: [1, hy + (i % 2) * 2], lean: 0.1 });
    const hi = hy + b.torso + 6;
    p.fa = { ik: [7, i < 2 ? hi : hi - 6], hand: 'grip' };
    p.ba = { ik: [7, i < 2 ? hi - 6 : hi], hand: 'grip' };
    p.fl = { f: [4, b.ankleH + (i < 2 ? 7 : 1)], fa: 0 };
    p.bl = { f: [4, b.ankleH + (i < 2 ? 1 : 7)], fa: 0 };
    p.legFwd = true;
    p.look = 'up';
    return p;
  },
  swim: (b, t) => {
    const ph = TAU * t;
    const L = b.thigh + b.shin;
    const p: Pose = {
      hip: [-2, 10], lean: 1.25,
      fa: { a: 1.5 + sin(ph) * 1.2, e: 0.2, hand: 'flat' },
      ba: { a: 1.5 - sin(ph) * 1.2, e: 0.2, hand: 'flat' },
      fl: { f: [-2 - L + 2, 10 + sin(ph * 2) * 3], fa: 1.2 },
      bl: { f: [-2 - L + 3, 10 - sin(ph * 2) * 3], fa: 1.2 },
      flags: { hrot: -0.6 },
    };
    return p;
  },
  // ------------------------------------------------ rowan
  camera: (b, t) => {
    const p = stand(b, { lean: 0.04, fl: { f: [2, b.ankleH] }, bl: { f: [-3.5, b.ankleH] } });
    const eye = face(b, p.hip, p.lean, 7, 9 + (t > 0.5 ? 0.3 : 0));
    hands(p, add(eye, 2, -2), add(eye, 0.5, -3), 'grip', 'grip', true);
    p.props = [prop('cameraUp', 0, 0, 0, { t: 1, front: true })];
    p.flags = { noCamera: 1 };
    return p;
  },
  cameraCrouch: (b, t) => {
    const p = crouchP(b, 0.66, 0.18);
    const eye = face(b, p.hip, p.lean, 7, 9 + (t > 0.5 ? 0.3 : 0));
    hands(p, add(eye, 2, -2), add(eye, 0.5, -3), 'grip', 'grip', true);
    p.props = [prop('cameraUp', 0, 0, 0, { t: 1, front: true })];
    p.flags = { noCamera: 1 };
    return p;
  },
  notebook: (b, t) => {
    const p = stand(b, { look: 'down', lean: 0.06 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    p.ba = { ik: add(s, 7, -8), hand: 'flat' };
    p.fa = { ik: add(s, 8 + (i % 2) * 1.2, -7 + (i > 1 ? 0.6 : 0)), hand: 'pinch' };
    p.props = [prop('notebook', 0, 0, -0.3, { t: 2 }), prop('pen', 0, 0, 0.8, { t: 1 })];
    return p;
  },
  observe: (b, t) => {
    const p = stand(b, { lean: 0.1 });
    const eye = face(b, p.hip, p.lean, 9, 8);
    p.fa = { ik: add(eye, 2, -2 + (t > 0.5 ? 0.5 : 0)), hand: 'grip' };
    p.props = [prop('magnifier', 0, 0, 0.6, { t: 1 })];
    return p;
  },
  phone: (b, t) => {
    const p = stand(b, { look: 'down', lean: 0.05 });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 9, -3 + (t > 0.5 ? 0.6 : 0)), hand: 'grip' };
    p.ba = { a: 0.1, e: 0.4, hand: 'fist' };
    p.props = [prop('phone', 0, 0, 0.2, { t: 1 })];
    return p;
  },
  type: (b, t) => {
    const p = sitP(b);
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: add(s, 11, -9 + (i === 1 ? 1 : 0)), hand: 'flat' };
    p.ba = { ik: add(s, 9, -9 + (i === 3 ? 1 : 0)), hand: 'flat' };
    p.look = 'down';
    return p;
  },
  // ------------------------------------------------ crowe
  steer: (b, t) => {
    const p = stand(b, { lean: 0.05, fl: { f: [3, b.ankleH] }, bl: { f: [-4, b.ankleH] } });
    const i = Math.floor(t * 4) % 4;
    const d = [0, 1.5, 0, -1.5][i];
    p.fa = { ik: [12, 30 + d], hand: 'grip' };
    p.ba = { ik: [12, 34 - d], hand: 'grip' };
    return p;
  },
  pipe: (b, t) => {
    const p = stand(b);
    const i = Math.floor(t * 4) % 4;
    const s = shoulderAt(b, p.hip, p.lean);
    const atMouth = i === 1 || i === 2;
    p.fa = atMouth ? { ik: face(b, p.hip, p.lean, 13, 2), hand: 'pinch' } : { ik: add(s, 4, -11), hand: 'fist' };
    if (atMouth) p.front = ['armF'];
    p.ba = { a: -0.1, e: 0.9, hand: 'fist' };
    return p;
  },
  map: (b, t) => {
    const p = stand(b, { look: 'down', lean: 0.06 });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 11, -5 + (t > 0.5 ? 0.4 : 0)), hand: 'grip' };
    p.ba = { ik: add(s, 5, -4), hand: 'grip' };
    p.props = [prop('map', 0, 0, 0, { t: 3, z: 'hand' })];
    return p;
  },
  bellyLaugh: (b, t) => {
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: -0.16 + (i % 2) * 0.08 });
    p.hip = [0, b.hipH - (i % 2) * 0.8];
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 6, -14), hand: 'flat' };
    p.ba = { ik: add(s, 3, -13), hand: 'flat' };
    p.look = 'up';
    return p;
  },
  // ------------------------------------------------ aroha
  staff: (b, t) => {
    const br = Math.sin(TAU * t);
    const p = stand(b, { hip: [0, b.hipH - (br < 0 ? 0.5 : 0)] });
    p.fa = { ik: [8, 27 + (br > 0 ? 0.4 : 0)], hand: 'grip' };
    p.ba = { a: 0, e: 0.3, hand: 'fist' };
    p.props = [prop('taiaha', 9, 0, Math.PI / 2 - 0.03, { z: 'mid' })];
    return p;
  },
  staffWalk: (b, t) => {
    const p = walkC(b, t);
    const sw = Math.cos(TAU * t);
    p.fa = { ik: [9 + sw * 1.5, 27], hand: 'grip' };
    p.props = [prop('taiaha', 10 + sw * 1.5, 1 + Math.max(0, sw) * 2, Math.PI / 2 - 0.12 + sw * 0.06, { z: 'mid' })];
    return p;
  },
  track: (b, t) => {
    const p = crouchP(b, 0.48, 0.62);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: [12 + (i % 2) * 1.5, 1.5 + (i === 2 ? 1 : 0)], hand: 'point' };
    p.ba = { ik: [4, 13], hand: 'flat' };
    p.look = 'down';
    return p;
  },
  explain: (b, t) => {
    const p = stand(b, { lean: 0.03 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: add(s, [10, 12, 9, 11][i], [-3, 0, -5, -1][i]), hand: 'open', ha: 0.5 };
    p.ba = { ik: add(s, [4, 6, 5, 7][i], [-6, -4, -5, -3][i]), hand: 'open', ha: 0.8 };
    return p;
  },
  fire: (b, t) => {
    const p = kneelP(b, 0.5);
    const i = Math.floor(t * 4) % 4;
    const d = i % 2 ? 1.6 : -1.6;
    p.fa = { ik: [12 + d, 9], hand: 'flat' };
    p.ba = { ik: [12 - d, 8], hand: 'flat' };
    p.props = [prop('firestick', 12.5, 1, Math.PI / 2 + d * 0.05)];
    p.look = 'down';
    return p;
  },
  lunge: (b, t) => keys(t, [
    { ...crouchP(b, 0.55, 0.2), fa: { a: 2.6, e: 0.3, hand: 'grip' }, ba: { a: 2.4, e: 0.3, hand: 'grip' }, props: [prop('taiaha', 0, 0, 0.1, { t: 3, z: 'top' })] },
    stand(b, { hip: [4, b.hipH + 2], lean: 0.35, fl: { f: [10, b.ankleH + 1] }, bl: { f: [-6, b.ankleH], fa: -0.6 }, fa: { a: 2.9, e: 0.2, hand: 'grip' }, ba: { a: 2.7, e: 0.2, hand: 'grip' }, props: [prop('taiaha', 0, 0, 0.3, { t: 3, z: 'top' })] }),
    stand(b, { hip: [6, b.hipH * 0.9], lean: 0.25, fl: { f: [12, b.ankleH] }, bl: { f: [-6, b.ankleH], fa: -0.5 }, fa: { a: 2.3, e: 0.4, hand: 'grip' }, ba: { a: 2.1, e: 0.4, hand: 'grip' }, props: [prop('taiaha', 0, 0, -0.35, { t: 3, z: 'top' })] }),
  ], false),
  // ------------------------------------------------ lou
  cook: (b, t) => {
    const p = stand(b, { lean: 0.1 });
    const s = shoulderAt(b, p.hip, p.lean);
    const ang = TAU * t;
    p.fa = { ik: add(s, 11 + cos(ang) * 2, -9 + sin(ang) * 1), hand: 'grip' };
    p.ba = { ik: add(s, 8, -10), hand: 'flat' };
    p.props = [prop('ladle', 0, 0, -1.4, { t: 1 })];
    p.look = 'down';
    return p;
  },
  serve: (b, t) => {
    const p = stand(b, { lean: 0.08 });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 12, -4 + (t > 0.5 ? 0.5 : 0)), hand: 'flat' };
    p.ba = { ik: add(s, 10, -5), hand: 'flat' };
    p.props = [prop('bowl', 1, 1, 0, { t: 1, z: 'hand', s: 1.2 })];
    return p;
  },
  taste: (b, t) => {
    const p = stand(b);
    p.fa = { ik: face(b, p.hip, p.lean, 7, 3.5), hand: 'grip' };
    p.front = ['armF'];
    p.props = [prop('ladle', 0, 0, 0.9 + (t > 0.5 ? 0.1 : 0), { t: 1, front: true })];
    return p;
  },
  // ------------------------------------------------ pip
  wrench: (b, t) => {
    const p = stand(b, { lean: 0.1 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: add(s, 11, -4 + [0, 1.6, 0, -1.6][i]), hand: 'grip' };
    p.ba = { ik: add(s, 12, -1), hand: 'flat' };
    p.props = [prop('wrench', 0, 0, [0.3, 0.9, 0.3, -0.3][i], { t: 1 })];
    return p;
  },
  tinker: (b, t) => {
    const p = crouchP(b, 0.55, 0.5);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: [11 + (i % 2), 5], hand: 'pinch' };
    p.ba = { ik: [10, 6 + (i > 1 ? 1 : 0)], hand: 'grip' };
    p.props = [prop('gadget', 12, 1, 0)];
    p.look = 'down';
    return p;
  },
};

export function poseFor(id: CharId, anim: string, b: Build, frame: number): Pose {
  const info = ANIMS[anim] ?? ANIMS.idle;
  const fn = POSES[anim] ?? POSES.idle;
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return withBackStaff(id, fn(b, t, id));
}

export { keys };
export type { P2 };

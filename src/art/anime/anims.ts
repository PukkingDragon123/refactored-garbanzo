// V4 anime animation library. Poses are authored in ground space (x forward, y up, origin between
// the feet) and scaled by each character's build (k = torso / 15), so one library fits petite
// Jenna, big Joshu and everyone in between. Includes transition clips (sit down, stand up, lie
// down, get up...) that the Actor plays automatically between postures.

import { Build, Pose, ArmP, LegP, P2, PropP, keys } from '../people-rig';

export interface AnimInfo { frames: number; fps: number; loop: boolean }
const A = (frames: number, fps: number, loop = true): AnimInfo => ({ frames, fps, loop });

export const ANIME_ANIMS: Record<string, AnimInfo> = {
  // locomotion
  idle: A(4, 3), walk: A(8, 10), run: A(8, 14), crouch: A(2, 2), crouchWalk: A(6, 8), jump: A(1, 1), fall: A(1, 1), land: A(1, 1),
  climb: A(4, 6), climbIdle: A(1, 1), swim: A(4, 5), push: A(4, 5), pull: A(4, 5), limp: A(8, 7), sneak: A(6, 7),
  // posture
  sit: A(2, 1.5), sitGround: A(2, 1.5), lie: A(2, 1), sleep: A(2, 0.8), sleepBag: A(2, 0.8), sleepBunk: A(2, 0.8), wake: A(4, 4, false), getUp: A(4, 7, false),
  sitDown: A(3, 12, false), standUp: A(3, 12, false), crouchDown: A(2, 14, false), lieDown: A(4, 9, false), unconscious: A(1, 1),
  // actions
  eat: A(4, 4), eatStand: A(4, 4), cook: A(4, 5), carry: A(8, 10), carryIdle: A(2, 2), carryHeavy: A(8, 6), carryPup: A(8, 10), carryPupIdle: A(2, 2), carryPupRun: A(8, 14), carryPupClimb: A(4, 6), grab: A(4, 12, false),
  pick: A(4, 9, false), kneel: A(4, 5), hammer: A(4, 8), wrench: A(4, 8), camera: A(2, 2), cameraCrouch: A(2, 2), photograph: A(2, 2),
  fishCast: A(6, 12, false), fishWait: A(4, 2), fishReel: A(4, 10), fishShow: A(4, 5), fishHold: A(4, 3), fishRaise: A(4, 6), research: A(4, 3), notebook: A(4, 4), laptop: A(4, 8), type: A(4, 8),
  steer: A(4, 3), dig: A(4, 6), pour: A(4, 5), drink: A(4, 4), build: A(4, 8), sweep: A(4, 6),
  // emotions & talk
  talk: A(4, 5), point: A(2, 2), wave: A(4, 6), celebrate: A(4, 8), cheer: A(2, 4), think: A(2, 1.5), shrug: A(2, 2), facepalm: A(2, 2),
  scared: A(2, 8), cower: A(2, 6), injured: A(4, 3), tired: A(4, 2), laugh: A(4, 8), angry: A(4, 8), surprised: A(3, 12, false),
  yawn: A(4, 3, false), brace: A(2, 4), slip: A(4, 8), fallBack: A(4, 10, false), sitShock: A(2, 4),
  // personality
  glasses: A(4, 6, false), hype: A(4, 10), fingerGuns: A(2, 4), typeFast: A(4, 14), bellyLaugh: A(4, 8), stretch: A(4, 3, false),
  slingAim: A(2, 2), slingshot: A(4, 12, false), armsCrossed: A(2, 1),
};

export const ANIME_COMMON = Object.keys(ANIME_ANIMS);

/** posture transitions the Actor inserts automatically: from → to → clip */
export const TRANSITIONS: Record<string, Record<string, string>> = {
  idle: { sit: 'sitDown', sitGround: 'sitDown', crouch: 'crouchDown', lie: 'lieDown', sleep: 'lieDown', eat: 'sitDown', laptop: 'sitDown' },
  walk: { sit: 'sitDown', sitGround: 'sitDown', crouch: 'crouchDown', lie: 'lieDown' },
  sit: { idle: 'standUp', walk: 'standUp' },
  sitGround: { idle: 'standUp', walk: 'standUp' },
  eat: { idle: 'standUp', walk: 'standUp' },
  laptop: { idle: 'standUp', walk: 'standUp' },
  lie: { idle: 'getUp', walk: 'getUp', sitGround: 'wake' },
  sleep: { idle: 'getUp', walk: 'getUp', sitGround: 'wake' },
};

type PoseFn = (b: Build, t: number, id: string) => Pose;

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const sm = (t: number) => t * t * (3 - 2 * t);
const sin = Math.sin, cos = Math.cos;
const K = (b: Build) => b.torso / 15;
const add = (p: P2, x: number, y: number): P2 => [p[0] + x, p[1] + y];
export const prop = (kind: string, x = 0, y = 0, a = 0, o: Partial<PropP> = {}): PropP => ({ kind, x, y, a, ...o });

export function stand(b: Build, over: Partial<Pose> = {}): Pose {
  const k = K(b);
  return {
    hip: [0, b.hipH],
    lean: 0.03,
    fa: { a: 0.12, e: 0.4, hand: 'fist' },
    ba: { a: -0.04, e: 0.32, hand: 'fist' },
    fl: { f: [-1.6 * k, b.ankleH] },
    bl: { f: [1.9 * k, b.ankleH] },
    ...over,
  };
}
export function shoulderAt(b: Build, hip: P2, lean: number): P2 {
  const up: P2 = [sin(lean), cos(lean)], fwd: P2 = [cos(lean), -sin(lean)];
  const T = b.torso - b.shY;
  return [hip[0] + fwd[0] * b.shF + up[0] * T, hip[1] + fwd[1] * b.shF + up[1] * T];
}
export function neckAt(b: Build, hip: P2, lean: number): P2 {
  const up: P2 = [sin(lean), cos(lean)];
  const nUp: P2 = [sin(lean * 0.6), cos(lean * 0.6)];
  return [hip[0] + up[0] * b.torso + nUp[0] * b.neck, hip[1] + up[1] * b.torso + nUp[1] * b.neck];
}
/** a point in front of the face (mouth / eye height) relative to the neck top */
export function face(b: Build, hip: P2, lean: number, dx: number, dy: number): P2 {
  const n = neckAt(b, hip, lean), k = K(b);
  return [n[0] + dx * k, n[1] + dy * k];
}

interface CycleOpts { stride: number; lift: number; bob: number; lean: number; swing: number; elbow: number; elbowSwing: number; stance: number; flight?: number; hipDrop?: number; crouch?: number }

export function cycle(b: Build, t: number, o: CycleOpts): Pose {
  const k = K(b);
  const S = o.stride;
  const leg = (ph: number, nearLeg: boolean): LegP => {
    ph = frac(ph);
    const st = o.stance;
    const base = (nearLeg ? -0.5 : 0.8) * k;
    if (ph < st) {
      const q = ph / st;
      const x = S / 2 - S * q;
      const fa = q < 0.2 ? 0.28 * (1 - q / 0.2) : q > 0.75 ? -0.5 * ((q - 0.75) / 0.25) : 0;
      const y = b.ankleH + (q > 0.75 ? ((q - 0.75) / 0.25) * 1.2 * k : 0);
      return { f: [base + x, y], fa };
    }
    const q = (ph - st) / (1 - st);
    const x = -S / 2 + S * sm(q);
    const y = b.ankleH + o.lift * Math.sin(q * Math.PI) + (q < 0.3 ? 1.2 * k * (1 - q / 0.3) : 0);
    const fa = q < 0.4 ? -0.5 * (1 - q / 0.4) : q > 0.8 ? 0.28 * ((q - 0.8) / 0.2) : 0;
    return { f: [base + x, y], fa };
  };
  const bobPh = Math.cos(TAU * 2 * (t - 0.12));
  const hipY = b.hipH - (o.crouch ?? 0) - o.bob * (0.5 + 0.5 * bobPh) + (o.flight ?? 0) * Math.max(0, -Math.cos(TAU * 2 * (t - 0.12)));
  const sw = Math.cos(TAU * t);
  const fa: ArmP = { a: -o.swing * sw + 0.05, e: o.elbow + o.elbowSwing * Math.max(0, -sw), hand: 'fist' };
  const ba: ArmP = { a: o.swing * sw + 0.05, e: o.elbow + o.elbowSwing * Math.max(0, sw), hand: 'fist' };
  return {
    hip: [0.25 * k * Math.sin(TAU * 2 * t), hipY],
    lean: o.lean, fa, ba,
    fl: leg(t, true), bl: leg(t + 0.5, false),
    bounce: o.bob * 0.7 * Math.cos(TAU * 2 * (t - 0.25)),
    sway: (o.hipDrop ?? 0.6) + 0.5 * Math.sin(TAU * 2 * t),
  };
}
const walkC = (b: Build, t: number) => cycle(b, t, { stride: b.thigh * 1.3, lift: 2.2 * K(b), bob: 0.9 * K(b), lean: 0.06, swing: 0.45, elbow: 0.25, elbowSwing: 0.4, stance: 0.56 });

export function crouchP(b: Build, depth = 0.62, lean = 0.34): Pose {
  const k = K(b);
  return stand(b, {
    hip: [-0.8 * k, b.hipH * depth], lean,
    fl: { f: [2.6 * k, b.ankleH], fa: 0 }, bl: { f: [-2.6 * k, b.ankleH], fa: -0.2 },
    fa: { a: 0.5, e: 0.45, hand: 'fist' }, ba: { a: 0.3, e: 0.55, hand: 'fist' },
    legFwd: true, sway: 0.4,
  });
}
function kneelP(b: Build, lean = 0.4): Pose {
  const k = K(b);
  return stand(b, {
    hip: [-1.1 * k, b.hipH * 0.52], lean,
    fl: { f: [4.4 * k, b.ankleH], fa: 0 }, bl: { f: [-6.2 * k, 1.2 * k], fa: -1.1 },
    fa: { a: 1.2, e: 0.2, hand: 'fist' }, ba: { a: 0.7, e: 0.5, hand: 'fist' },
    legFwd: true,
  });
}
export function sitP(b: Build, seat?: number): Pose {
  const k = K(b);
  const sy = seat ?? b.shin + b.ankleH - 0.5 * k;
  const hip: P2 = [-2.2 * k, sy + 1.2 * k];
  const knee = b.thigh * 0.95;
  return stand(b, {
    hip, lean: -0.02,
    fl: { f: [hip[0] + knee + 0.4 * k, b.ankleH], fa: 0 }, bl: { f: [hip[0] + knee - 1.2 * k, b.ankleH], fa: 0 },
    fa: { ik: [hip[0] + knee + 0.4 * k, sy + 2.6 * k], hand: 'flat' }, ba: { ik: [hip[0] + knee - 0.8 * k, sy + 2.2 * k], hand: 'flat' },
    legFwd: true, legBFwd: true,
  });
}
export function sitGroundP(b: Build, lean = -0.1): Pose {
  const k = K(b);
  const hip: P2 = [0, 2.6 * k];
  const L = b.thigh + b.shin;
  return stand(b, {
    hip, lean,
    fl: { f: [L - 2.2 * k, b.ankleH - 0.4], fa: 0.3 }, bl: { f: [L - 4 * k, b.ankleH - 0.3], fa: 0.3 },
    fa: { ik: [b.thigh * 0.7, 6.6 * k], hand: 'flat' }, ba: { ik: [-5 * k, 1 * k], hand: 'flat' },
    legFwd: true, legBFwd: true,
  });
}
function lieP(b: Build, breathe = 0): Pose {
  const k = K(b);
  const L = b.thigh + b.shin;
  const hip: P2 = [-3 * k, 2.4 * k + breathe * 0.25];
  return {
    hip, lean: 1.5, sq: 1 + breathe * 0.02,
    fa: { a: -1.45, e: 0.1, hand: 'flat' }, ba: { a: -1.5, e: 0.05, hand: 'flat' },
    fl: { f: [hip[0] - L + 1, b.ankleH - 0.4], fa: 1.4 }, bl: { f: [hip[0] - L + 1.6, b.ankleH], fa: 1.4 },
    legFwd: true, flags: { hrot: -Math.PI / 2 },
  };
}
const hands = (p: Pose, fa: P2, ba: P2 | null, hf: ArmP['hand'] = 'grip', hb: ArmP['hand'] = 'grip', front = false): Pose => {
  p.fa = { ik: fa, hand: hf };
  if (ba) p.ba = { ik: ba, hand: hb };
  if (front) p.front = ['armF'];
  return p;
};
const ps = (id: string) => (id === 'joshu' ? 1.2 : id === 'jenna' ? 0.85 : 1);

const POSES: Record<string, PoseFn> = {
  idle: (b, t) => {
    const br = Math.sin(TAU * t);
    const p = stand(b);
    p.hip = [0, b.hipH - (br < 0 ? 0.5 : 0)];
    p.sq = 1 + br * 0.02;
    p.fa = { a: 0.13 + br * 0.03, e: 0.4 - br * 0.05, hand: 'fist' };
    p.ba = { a: -0.04 - br * 0.02, e: 0.32, hand: 'fist' };
    p.bounce = br < 0 ? -0.3 : 0.15;
    return p;
  },
  walk: walkC,
  run: (b, t) => cycle(b, t, { stride: b.thigh * 1.9, lift: 3.4 * K(b), bob: 1.1 * K(b), lean: 0.22, swing: 0.95, elbow: 1.4, elbowSwing: 0.3, stance: 0.42, flight: 1.2 * K(b), hipDrop: 1.6 }),
  sneak: (b, t) => { const p = cycle(b, t, { stride: b.thigh * 0.9, lift: 1.6 * K(b), bob: 0.4, lean: 0.3, swing: 0.15, elbow: 1.1, elbowSwing: 0.1, stance: 0.62, crouch: b.hipH * 0.22 }); p.legFwd = true; return p; },
  limp: (b, t) => {
    const p = cycle(b, t, { stride: b.thigh * 0.9, lift: 1.4 * K(b), bob: 1.6 * K(b), lean: 0.14, swing: 0.2, elbow: 0.4, elbowSwing: 0.1, stance: 0.66 });
    const s = shoulderAt(b, p.hip, p.lean);
    p.ba = { ik: add(s, 3.4 * K(b), -6 * K(b)), hand: 'flat' };
    return p;
  },
  crouch: (b, t) => { const p = crouchP(b); p.hip[1] -= Math.sin(TAU * t) > 0 ? 0.3 : 0; return p; },
  crouchWalk: (b, t) => { const p = cycle(b, t, { stride: b.thigh * 1, lift: 1.4 * K(b), bob: 0.5, lean: 0.38, swing: 0.25, elbow: 0.9, elbowSwing: 0.2, stance: 0.6, crouch: b.hipH * 0.34 }); p.legFwd = true; return p; },
  jump: b => { const k = K(b); return stand(b, { hip: [0, b.hipH + 2 * k], lean: 0.08, fl: { f: [3 * k, b.ankleH + 5 * k], fa: -0.3 }, bl: { f: [-2 * k, b.ankleH + 3 * k], fa: -0.6 }, fa: { a: 2.5, e: 0.3, hand: 'open' }, ba: { a: 2.2, e: 0.4, hand: 'open' } }); },
  fall: b => { const k = K(b); return stand(b, { hip: [0, b.hipH + 0.8 * k], lean: -0.05, fl: { f: [1.8 * k, b.ankleH - 0.6], fa: 0.2 }, bl: { f: [-1.4 * k, b.ankleH + 0.8 * k], fa: -0.3 }, fa: { a: 1.9, e: -0.3, hand: 'open' }, ba: { a: 1.6, e: -0.2, hand: 'open' } }); },
  land: b => { const k = K(b); return stand(b, { hip: [0, b.hipH * 0.84], lean: 0.2, sq: 0.9, fl: { f: [2.6 * k, b.ankleH] }, bl: { f: [-2.6 * k, b.ankleH] }, fa: { a: 0.8, e: 0.3, hand: 'open' }, ba: { a: 0.6, e: 0.3, hand: 'open' } }); },
  climb: (b, t) => {
    // back view on a ladder: alternate reach, hands on rungs above the head
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const up = i < 2 ? 1 : -1;
    const p = stand(b, { lean: 0, hip: [0, b.hipH + (i % 2) * 0.8 * k] });
    const s = shoulderAt(b, p.hip, 0);
    p.fa = { ik: add(s, 1 * k, (6 + up * 2.4) * k), hand: 'grip' };
    p.ba = { ik: add(s, -1 * k, (6 - up * 2.4) * k), hand: 'grip' };
    p.fl = { f: [0.6 * k, b.ankleH + (up > 0 ? 4 : 0.5) * k], fa: 0 };
    p.bl = { f: [-0.6 * k, b.ankleH + (up > 0 ? 0.5 : 4) * k], fa: 0 };
    return p;
  },
  climbIdle: b => { const k = K(b); const p = stand(b, { lean: 0 }); const s = shoulderAt(b, p.hip, 0); p.fa = { ik: add(s, 1 * k, 7 * k), hand: 'grip' }; p.ba = { ik: add(s, -1 * k, 5 * k), hand: 'grip' }; return p; },
  swim: (b, t) => {
    // front crawl / paddle: body tilted into the water, head up and looking ahead
    const k = K(b);
    const i = t * TAU;
    const p: Pose = {
      hip: [-3 * k, b.hipH * 0.55], lean: 1.12,
      fa: { a: 2.3 + sin(i) * 0.8, e: 0.3, hand: 'flat' }, ba: { a: 2.3 - sin(i) * 0.8, e: 0.3, hand: 'flat' },
      fl: { f: [-3 * k - b.thigh - b.shin + 4 * k, b.hipH * 0.5 + sin(i) * 2 * k], fa: 1.2 }, bl: { f: [-3 * k - b.thigh - b.shin + 4.6 * k, b.hipH * 0.5 - sin(i) * 2 * k], fa: 1.2 },
      hd: [-1.4 * k, -1.6 * k],
      front: sin(i) > 0 ? ['armF'] : undefined,
    };
    return p;
  },
  push: (b, t) => {
    const k = K(b);
    const p = cycle(b, t, { stride: b.thigh * 0.8, lift: 1.4 * k, bob: 0.4, lean: 0.42, swing: 0, elbow: 0, elbowSwing: 0, stance: 0.7 });
    const s = shoulderAt(b, p.hip, p.lean);
    return hands(p, add(s, 8 * k, -0.5 * k), add(s, 7 * k, -1.5 * k), 'flat', 'flat');
  },
  pull: (b, t) => {
    const k = K(b);
    const p = cycle(b, t, { stride: b.thigh * 0.7, lift: 1.2 * k, bob: 0.4, lean: -0.3, swing: 0, elbow: 0, elbowSwing: 0, stance: 0.7 });
    const s = shoulderAt(b, p.hip, p.lean);
    const d = 5 + Math.sin(TAU * t) * 1.2;
    p.props = [prop('rope', 0, 0, 0, { t: 3, s: 0.7 })];
    return hands(p, add(s, (d + 3) * k, -3 * k), add(s, (d + 1) * k, -3.4 * k));
  },
  sit: (b, t) => { const p = sitP(b); p.sq = 1 + (Math.sin(TAU * t) > 0 ? 0.015 : 0); return p; },
  sitGround: (b, t) => { const p = sitGroundP(b); p.sq = 1 + (Math.sin(TAU * t) > 0 ? 0.015 : 0); return p; },
  lie: (b, t) => lieP(b, Math.sin(TAU * t)),
  sleep: (b, t) => { const p = lieP(b, Math.sin(TAU * t)); p.fa = { a: -1.1, e: 1.4, hand: 'flat' }; return p; },
  sleepBag: (b, t) => { const k = K(b); const p = lieP(b, Math.sin(TAU * t)); p.props = [prop('sleepingBag', p.hip[0], p.hip[1] + 0.4 * k, 0, { s: k, t: 0, z: 'top' })]; p.fa = { a: -1.45, e: 0, hand: 'none' }; p.ba = { a: -1.45, e: 0, hand: 'none' }; p.sq = 1 + Math.sin(TAU * t) * 0.03; return p; },
  sleepBunk: (b, t) => { const k = K(b); const p = lieP(b, Math.sin(TAU * t)); p.props = [prop('blanket', p.hip[0], p.hip[1] + 0.4 * k, 0, { s: k, t: 0, z: 'top' })]; p.fa = { a: -1.45, e: 0, hand: 'none' }; p.ba = { a: -1.45, e: 0, hand: 'none' }; p.sq = 1 + Math.sin(TAU * t) * 0.03; return p; },
  unconscious: b => { const p = lieP(b, 0); p.fa = { a: -0.6, e: 0.5, hand: 'open' }; return p; },
  wake: (b, t) => keys(t, [lieP(b), { ...lieP(b), lean: 1.1, hip: [-2.2 * K(b), 2.6 * K(b)] }, sitGroundP(b, 0.25), sitGroundP(b)], false),
  getUp: (b, t) => keys(t, [lieP(b), sitGroundP(b, 0.3), crouchP(b, 0.55, 0.4), stand(b)], false),
  lieDown: (b, t) => keys(t, [stand(b), crouchP(b, 0.55, 0.4), sitGroundP(b, 0.3), lieP(b)], false),
  sitDown: (b, t) => keys(t, [stand(b), crouchP(b, 0.72, 0.2), sitP(b)], false),
  standUp: (b, t) => keys(t, [sitP(b), crouchP(b, 0.72, 0.3), stand(b)], false),
  crouchDown: (b, t) => keys(t, [stand(b), crouchP(b)], false),
  eat: (b, t, id) => {
    const k = K(b);
    const p = sitP(b);
    const i = Math.floor(t * 4) % 4;
    const bowl: P2 = add(shoulderAt(b, p.hip, p.lean), 3.8 * k, -5.2 * k);
    const mouth = face(b, p.hip, p.lean, 4.4, 3.4);
    p.ba = { ik: bowl, hand: 'grip' };
    const up = i === 1 || i === 2;
    p.fa = up ? { ik: mouth, hand: 'pinch' } : { ik: add(bowl, 1.2 * k, 3.4 * k), hand: 'pinch' };
    p.front = up ? ['armF'] : undefined;
    p.props = [prop('cup', 0, -1.4 * k, 0, { t: 2, s: ps(id) * 0.9, z: 'hand' }), prop('chopsticks', 0, 0, up ? 2.2 : -0.4, { t: 1, s: 0.9, front: up }), ...(up ? [prop('noodles', 0, 0, 2.2, { t: 1, s: 0.9, front: true })] : [])];
    p.look = i === 0 ? 'down' : 'fwd';
    return p;
  },
  eatStand: (b, t, id) => {
    const k = K(b);
    const p = stand(b, { lean: 0.02 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    const cup = add(s, 4.6 * k, -5.6 * k);
    const mouth = face(b, p.hip, p.lean, 4.4, 3.4);
    const up = i === 1 || i === 2;
    p.ba = { ik: cup, hand: 'grip' };
    p.fa = up ? { ik: mouth, hand: 'pinch' } : { ik: add(cup, 1 * k, 3.8 * k), hand: 'pinch' };
    p.front = up ? ['armF'] : undefined;
    p.props = [prop('cup', 0, -1.4 * k, 0, { t: 2, s: ps(id) * 0.9 }), prop('chopsticks', 0, 0, up ? 2.2 : -0.4, { t: 1, s: 0.9, front: up }), ...(up ? [prop('noodles', 0, 0, 2.2, { t: 1, s: 0.9, front: true })] : [])];
    p.look = i === 0 ? 'down' : 'fwd';
    return p;
  },
  cook: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.12 });
    const s = shoulderAt(b, p.hip, p.lean);
    const a = TAU * t;
    p.fa = { ik: add(s, (7 + cos(a) * 1.4) * k, (-5 + sin(a) * 0.8) * k), hand: 'grip' };
    p.ba = { ik: add(s, 6 * k, -7.4 * k), hand: 'flat' };
    p.props = [prop('ladle', 0, 0, -1.2, { t: 1, s: 0.9 })];
    p.look = 'down';
    return p;
  },
  pour: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.08 });
    const s = shoulderAt(b, p.hip, p.lean);
    const tilt = Math.min(1, t * 2);
    p.fa = { ik: add(s, 7 * k, -2 * k), hand: 'grip' };
    p.ba = { ik: add(s, 6 * k, -6.6 * k), hand: 'grip' };
    p.props = [prop('kettle', 0, -2 * k, -0.6 * tilt, { t: 1, s: 0.8 }), prop('cup', 0, -1 * k, 0, { t: 2, s: 0.9 })];
    p.look = 'down';
    return p;
  },
  drink: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.04 });
    const up = Math.floor(t * 4) % 4 > 0;
    p.fa = { ik: up ? face(b, p.hip, p.lean, 3.6, 2.6) : add(shoulderAt(b, p.hip, p.lean), 4 * k, -6 * k), hand: 'grip' };
    p.front = up ? ['armF'] : undefined;
    p.props = [prop('bottle', 0, -1 * k, up ? 1.8 : 0, { t: 1, s: 0.8, front: up })];
    p.look = up ? 'up' : 'fwd';
    return p;
  },
  carry: (b, t, id) => {
    const k = K(b);
    const p = walkC(b, t);
    const s = shoulderAt(b, p.hip, p.lean);
    p.lean = -0.05;
    p.props = [prop('crate', 0, 1.6 * k, 0, { t: 3, s: 0.8 * ps(id), z: 'mid' })];
    return hands(p, add(s, 6 * k, -6.6 * k), add(s, 4.4 * k, -6.6 * k));
  },
  carryIdle: (b, t, id) => {
    const k = K(b);
    const p = stand(b, { lean: -0.05 });
    p.hip[1] -= Math.sin(TAU * t) > 0 ? 0.4 : 0;
    const s = shoulderAt(b, p.hip, p.lean);
    p.props = [prop('crate', 0, 1.6 * k, 0, { t: 3, s: 0.8 * ps(id), z: 'mid' })];
    return hands(p, add(s, 6 * k, -6.6 * k), add(s, 4.4 * k, -6.6 * k));
  },
  carryPup: (b, t) => {
    // hugging Chunk against the chest while walking
    const k = K(b);
    const p = walkC(b, t);
    p.lean = 0.02;
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 4.2 * k, -4.6 * k), hand: 'flat' };
    p.ba = { ik: add(s, 3 * k, -3.2 * k), hand: 'flat' };
    p.front = ['armF'];
    return p;
  },
  carryPupRun: (b, t) => {
    const k = K(b);
    const p = cycle(b, t, { stride: b.thigh * 1.6, lift: 2.8 * k, bob: 1 * k, lean: 0.16, swing: 0.2, elbow: 1.2, elbowSwing: 0.1, stance: 0.46, flight: 0.8 * k, hipDrop: 1.2 });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 4.4 * k, -4.4 * k), hand: 'flat' };
    p.ba = { ik: add(s, 3.2 * k, -3 * k), hand: 'flat' };
    p.front = ['armF'];
    return p;
  },
  carryPupIdle: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.02 });
    p.hip[1] -= Math.sin(TAU * t) > 0 ? 0.4 : 0;
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 4.2 * k, -4.6 * k), hand: 'flat' };
    p.ba = { ik: add(s, 3 * k, -3.2 * k), hand: 'flat' };
    p.front = ['armF'];
    return p;
  },
  carryPupClimb: (b, t) => {
    // one-armed ladder climb with the pug tucked under the other arm
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: 0, hip: [0, b.hipH + (i % 2) * 0.8 * k] });
    const s = shoulderAt(b, p.hip, 0);
    p.fa = { ik: add(s, 1 * k, (7 + (i < 2 ? 1.6 : -1.6)) * k), hand: 'grip' };
    p.ba = { ik: add(s, 3 * k, -3.4 * k), hand: 'flat' };
    p.fl = { f: [0.6 * k, b.ankleH + (i < 2 ? 4 : 0.5) * k], fa: 0 };
    p.bl = { f: [-0.6 * k, b.ankleH + (i < 2 ? 0.5 : 4) * k], fa: 0 };
    return p;
  },
  carryHeavy: (b, t) => {
    // staggering under something heavy held against the chest (Chunk!) - wobbly, bent knees
    const k = K(b);
    const p = cycle(b, t, { stride: b.thigh * 0.7, lift: 1.2 * k, bob: 1.6 * k, lean: -0.22 + Math.sin(TAU * t) * 0.08, swing: 0, elbow: 0, elbowSwing: 0, stance: 0.66, crouch: b.hipH * 0.12 });
    const s = shoulderAt(b, p.hip, p.lean);
    return hands(p, add(s, 5.4 * k, -4.6 * k), add(s, 3.6 * k, -5.2 * k));
  },
  grab: (b, t) => {
    const k = K(b);
    const i = Math.min(3, Math.floor(t * 4));
    const p = stand(b, { lean: [0.04, 0.2, 0.26, 0.08][i] });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, [4, 9, 10, 5][i] * k, [-4, -2, -2.4, -5][i] * k), hand: i < 2 ? 'open' : 'grip' };
    return p;
  },
  pick: (b, t) => {
    const i = Math.min(3, Math.floor(t * 4));
    const k = K(b);
    const p = crouchP(b, [0.9, 0.6, 0.6, 0.85][i], [0.1, 0.45, 0.45, 0.15][i]);
    p.fa = { ik: [[5, 7, 7, 5][i] * k, [14, 2, 2.4, 12][i] * k], hand: i < 2 ? 'open' : 'grip' };
    p.look = 'down';
    return p;
  },
  kneel: (b, t) => {
    const k = K(b);
    const p = kneelP(b);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: [(8.4 + (i % 2) * 1.2) * k, (3.4 + (i === 2 ? 1.4 : 0)) * k], hand: 'grip' };
    p.ba = { ik: [7.6 * k, (6.4 + (i % 2)) * k], hand: 'grip' };
    p.look = 'down';
    return p;
  },
  dig: (b, t) => {
    const k = K(b);
    const p = kneelP(b, 0.5);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: [8.4 * k, [5.6, 1.4, 2.4, 4.2][i] * k], hand: 'open' };
    p.ba = { ik: [6 * k, [3, 5, 1.6, 2][i] * k], hand: 'open' };
    p.look = 'down';
    p.bounce = i === 1 ? -0.5 : 0;
    return p;
  },
  hammer: (b, t, id) => {
    const k = K(b);
    const p = kneelP(b, 0.44);
    const i = Math.floor(t * 4) % 4;
    const up = i === 0 || i === 3;
    p.fa = { ik: up ? [5.6 * k, 11 * k] : [8.4 * k, 3.4 * k], hand: 'grip' };
    p.ba = { ik: [9 * k, 2 * k], hand: 'pinch' };
    p.props = [prop('hammer', 0, 0, up ? 1.6 : -0.3, { t: 1, s: 0.8 * ps(id) })];
    p.look = 'down';
    p.bounce = up ? 0 : -0.4;
    return p;
  },
  build: (b, t, id) => {
    const k = K(b);
    const p = stand(b, { lean: 0.08 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    const up = i === 0 || i === 3;
    p.fa = { ik: add(s, 6.4 * k, (up ? 3.6 : -3.6) * k), hand: 'grip' };
    p.ba = { ik: add(s, 8 * k, -4.4 * k), hand: 'flat' };
    p.props = [prop('hammer', 0, 0, up ? 1.7 : -0.1, { t: 1, s: 0.8 * ps(id) })];
    return p;
  },
  wrench: (b, t) => {
    const k = K(b);
    const p = crouchP(b, 0.66, 0.28);
    const i = Math.floor(t * 4) % 4;
    const ang = [0.4, -0.4, -0.9, -0.2][i];
    p.fa = { ik: [(8 + cos(ang) * 1.4) * k, (8 + sin(ang) * 1.4) * k], hand: 'grip' };
    p.ba = { ik: [8.6 * k, 10.6 * k], hand: 'flat' };
    p.props = [prop('wrench', 0, 0, ang + 0.6, { t: 1, s: 0.9 })];
    p.bounce = i === 2 ? -0.4 : 0;
    return p;
  },
  sweep: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.16 });
    const s = shoulderAt(b, p.hip, p.lean);
    const d = sin(TAU * t) * 2;
    p.props = [prop('plank', 0, 0, -1.1, { t: 3, s: 0.8 })];
    return hands(p, add(s, (5 + d) * k, -6 * k), add(s, (3 + d) * k, -3 * k));
  },
  camera: b => {
    const k = K(b);
    const p = stand(b, { lean: 0.02 });
    const eye = face(b, p.hip, p.lean, 5.4, 4.2);
    p.fa = { ik: add(eye, 0.8 * k, -1.2 * k), hand: 'grip' };
    p.ba = { ik: add(eye, -1 * k, -2 * k), hand: 'grip' };
    p.front = ['armF'];
    p.props = [prop('camera', 0, 0.6 * k, 0, { t: 3, s: 0.85, front: true })];
    return p;
  },
  photograph: b => POSES.camera(b, 0, ''),
  cameraCrouch: b => {
    const k = K(b);
    const p = crouchP(b, 0.66, 0.16);
    const eye = face(b, p.hip, p.lean, 5.4, 4.2);
    p.fa = { ik: add(eye, 0.8 * k, -1.2 * k), hand: 'grip' };
    p.ba = { ik: add(eye, -1 * k, -2 * k), hand: 'grip' };
    p.front = ['armF'];
    p.props = [prop('camera', 0, 0.6 * k, 0, { t: 3, s: 0.85, front: true })];
    return p;
  },
  fishCast: (b, t) => {
    // wind up behind the head, whip forward
    const k = K(b);
    const i = Math.min(5, Math.floor(t * 6));
    const ang = [2.4, 2.8, 3, 1.6, 0.7, 0.5][i];
    const p = stand(b, { lean: [0, -0.08, -0.12, 0.12, 0.18, 0.1][i], fl: { f: [2.8 * k, b.ankleH] }, bl: { f: [-2.8 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, cos(ang - 1.3) * 7 * k, sin(ang - 1.3) * 7 * k + 2 * k), hand: 'grip' };
    p.ba = { ik: add(s, cos(ang - 1.3) * 5.4 * k, sin(ang - 1.3) * 5.4 * k), hand: 'grip' };
    p.props = [prop('rod', 0, 0, ang - 0.9, { t: 1, s: 0.8 })];
    return p;
  },
  fishWait: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.04, fl: { f: [2.4 * k, b.ankleH] }, bl: { f: [-2.4 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const bob = Math.sin(TAU * t) > 0.6 ? 0.4 : 0;
    p.fa = { ik: add(s, 5.2 * k, (-4 + bob) * k), hand: 'grip' };
    p.ba = { ik: add(s, 3 * k, -6.4 * k), hand: 'grip' };
    p.props = [prop('rod', 0, 0, 0.55, { t: 1, s: 0.8 })];
    return p;
  },
  fishReel: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.14, fl: { f: [3.2 * k, b.ankleH] }, bl: { f: [-3 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const a = TAU * t;
    p.fa = { ik: add(s, 5.8 * k, -2.6 * k), hand: 'grip' };
    p.ba = { ik: add(s, (3 + cos(a) * 1.2) * k, (-5.4 + sin(a) * 1.2) * k), hand: 'grip' };
    p.props = [prop('rod', 0, 0, 1 + sin(a * 2) * 0.08, { t: 1, s: 0.8 })];
    p.bounce = Math.sin(a * 2) * 0.4;
    return p;
  },
  fishShow: (b, t) => {
    // the catch held up across the chest in both hands, lifted a little on each beat
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const up = [0, 0.7, 1.1, 0.7][i];
    const p = stand(b, { lean: -0.05, fl: { f: [2.6 * k, b.ankleH] }, bl: { f: [-2.4 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 6.8 * k, (-1.6 + up) * k), hand: 'grip' };
    p.ba = { ik: add(s, 2.2 * k, (-2.4 + up) * k), hand: 'grip' };
    p.bounce = up * 0.25;
    return p;
  },
  fishHold: (b, t) => {
    // the catch shown off in ONE hand: held up by the tail at shoulder height in front, the other
    // arm easy at his side; a slow lift on the beat (the fish hangs from the fist, see ship.drawHeld)
    const k = K(b);
    const up = [0, 0.4, 0.7, 0.4][Math.floor(t * 4) % 4];
    const p = stand(b, { lean: -0.04, fl: { f: [2.4 * k, b.ankleH] }, bl: { f: [-2.2 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 7.6 * k, (6.4 + up) * k), hand: 'fist', ha: 1.45 };
    p.ba = { a: -0.1, e: 0.36, hand: 'fist' };
    p.bounce = up * 0.2;
    return p;
  },
  fishRaise: (b, t) => {
    // "I caught it!": the fish raised high in one hand, the free fist pumping
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const up = [0, 0.6, 1, 0.6][i];
    const p = stand(b, { lean: -0.08, fl: { f: [2.8 * k, b.ankleH] }, bl: { f: [-2.6 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 8.6 * k, (11.6 + up * 0.8) * k), hand: 'fist', ha: 1.5 };
    p.ba = { a: 0.35 + up * 0.15, e: 1.75 + up * 0.35, hand: 'fist' };
    p.bounce = up * 0.3;
    return p;
  },
  research: (b, t) => {
    const k = K(b);
    const p = crouchP(b, 0.7, 0.36);
    p.fa = { ik: [(8.6 + (t > 0.5 ? 0.6 : 0)) * k, 11.4 * k], hand: 'grip' };
    p.ba = { ik: [6.4 * k, 9 * k], hand: 'grip' };
    p.props = [prop('magnifier', 0, 0, -0.9, { t: 1, s: 0.85 }), prop('notebook', 0, 0, 0.4, { t: 2, s: 0.8 })];
    p.look = 'down';
    return p;
  },
  notebook: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.06 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    p.ba = { ik: add(s, 3.6 * k, -5.4 * k), hand: 'grip' };
    p.fa = { ik: add(s, (4.4 + (i % 2) * 0.8) * k, (-4.6 - (i === 2 ? 0.5 : 0)) * k), hand: 'pinch' };
    p.props = [prop('notebook', 0, 0, 0.6, { t: 2, s: 0.8 }), prop('pen', 0, 0, -0.6, { t: 1, s: 0.8 })];
    p.look = 'down';
    return p;
  },
  laptop: (b, t) => {
    const k = K(b);
    const p = sitP(b);
    const i = Math.floor(t * 4) % 4;
    const lap: P2 = [p.hip[0] + b.thigh * 0.8, p.hip[1] + 1.4 * k];
    p.fa = { ik: add(lap, (1.2 + (i % 2) * 0.8) * k, (1.2 + (i === 1 ? 0.6 : 0)) * k), hand: 'flat' };
    p.ba = { ik: add(lap, (-0.6 + (i === 2 ? 0.8 : 0)) * k, (1 + (i === 3 ? 0.6 : 0)) * k), hand: 'flat' };
    p.props = [prop('laptop', lap[0] + 1 * k, lap[1], 0, { s: 0.8, z: 'mid' })];
    p.look = 'down';
    return p;
  },
  type: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.1 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: add(s, (6.4 + (i % 2)) * k, (-5.6 + (i === 1 ? 0.6 : 0)) * k), hand: 'flat' };
    p.ba = { ik: add(s, (5.2 + (i === 2 ? 1 : 0)) * k, -5.8 * k), hand: 'flat' };
    p.look = 'down';
    return p;
  },
  typeFast: (b, t) => { const p = POSES.type(b, (t * 3) % 1, ''); p.bounce = Math.floor(t * 8) % 2 ? 0.3 : 0; return p; },
  steer: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.04, fl: { f: [2.6 * k, b.ankleH] }, bl: { f: [-2.6 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const w = sin(TAU * t) * 1.4;
    return hands(p, add(s, 6.4 * k, (w - 2) * k), add(s, 5.4 * k, (-w - 2.4) * k));
  },
  talk: (b, t) => {
    const k = K(b);
    const p = stand(b);
    const s = shoulderAt(b, p.hip, p.lean);
    const kk = [[6.4, -4.4, 'open'], [7.6, -1.6, 'open'], [5.8, -3, 'flat'], [7, -5.6, 'point']] as const;
    const i = Math.floor(t * 4) % 4;
    p.fa = { ik: add(s, kk[i][0] * k, kk[i][1] * k), hand: kk[i][2] };
    p.ba = { a: 0.1 + (i % 2) * 0.15, e: 0.5 + (i % 2) * 0.3, hand: 'open' };
    p.lean = 0.04 + (i % 2) * 0.02;
    p.bounce = i % 2 ? 0.3 : 0;
    return p;
  },
  point: (b, t) => { const k = K(b); const p = stand(b, { lean: 0.05 }); const s = shoulderAt(b, p.hip, p.lean); p.fa = { ik: add(s, 10.6 * k, (1.4 + (t > 0.5 ? 0.4 : 0)) * k), hand: 'point', ha: 0.1 }; return p; },
  wave: (b, t) => { const k = K(b); const p = stand(b); const s = shoulderAt(b, p.hip, p.lean); const i = Math.floor(t * 4) % 4; p.fa = { ik: add(s, [10.6, 11.8, 10.6, 11.8][i] * k, [10.4, 11.4, 10.4, 11.4][i] * k), hand: 'open', ha: [1.3, 1.0, 1.3, 1.0][i] }; return p; },
  celebrate: (b, t) => {
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const air = i === 1 || i === 2;
    const p = stand(b, { hip: [0, b.hipH + (air ? 3 * k : 0)] });
    const s = shoulderAt(b, p.hip, p.lean);
    // fists pumped: near one up in front of the face, far one up behind the head
    p.fa = { ik: add(s, 11 * k, 11 * k), hand: 'fist' };
    p.ba = { ik: add(s, -7 * k, 12 * k), hand: 'fist' };
    if (air) { p.fl = { f: [-1.4 * k, b.ankleH + 2.2 * k], fa: -0.3 }; p.bl = { f: [1.4 * k, b.ankleH + 2.6 * k], fa: -0.3 }; }
    return p;
  },
  cheer: (b, t) => POSES.celebrate(b, t > 0.5 ? 0.3 : 0, ''),
  think: (b, t) => {
    const k = K(b);
    const p = stand(b);
    const chin = face(b, p.hip, p.lean, 4.2, 0.6 + (t > 0.5 ? 0.3 : 0));
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: chin, hand: 'point' };
    p.ba = { ik: add(s, 3.6 * k, -6.4 * k), hand: 'fist' };
    p.armBFwd = true;
    p.front = ['armF'];
    return p;
  },
  shrug: (b, t) => {
    const k = K(b);
    const p = stand(b, { hd: [0, -0.8 * k] });
    const s = shoulderAt(b, p.hip, p.lean);
    const q = t > 0.5 ? 0.8 : 0;
    p.fa = { ik: add(s, 6 * k, (-3 + q) * k), hand: 'open', ha: 1.2 };
    p.ba = { ik: add(s, 2.2 * k, (-2.2 + q) * k), hand: 'open', ha: 1.2 };
    return p;
  },
  facepalm: b => { const p = stand(b, { lean: 0.12 }); p.fa = { ik: face(b, p.hip, p.lean, 3.6, 3.4), hand: 'flat' }; p.front = ['armF']; return p; },
  scared: (b, t) => {
    const k = K(b);
    const j = Math.floor(t * 2) % 2 ? 0.4 : -0.4;
    const p = stand(b, { lean: -0.14, hip: [j * 0.5, b.hipH * 0.92], fl: { f: [1.6 * k, b.ankleH] }, bl: { f: [-2.4 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    return hands(p, add(s, 5 * k, 1.6 * k), add(s, 3.6 * k, 2 * k), 'open', 'open');
  },
  cower: (b, t) => {
    const k = K(b);
    const p = crouchP(b, 0.56, 0.5);
    p.hip[0] += Math.floor(t * 2) % 2 ? 0.3 : -0.3;
    const n = neckAt(b, p.hip, p.lean);
    return hands(p, add(n, 2.4 * k, 2.6 * k), add(n, 0.6 * k, 3 * k), 'flat', 'flat', true);
  },
  injured: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: 0.26, hip: [0, b.hipH * 0.95 - (t > 0.5 ? 0.3 : 0)] });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 2.4 * k, -6.2 * k), hand: 'flat' };
    p.ba = { a: 0.2, e: 0.2, hand: 'open' };
    p.front = ['armF'];
    return p;
  },
  tired: (b, t) => {
    const k = K(b);
    const br = Math.sin(TAU * t);
    const p = stand(b, { lean: 0.2, hd: [0.4 * k, -1 * k + br * 0.3], hip: [0, b.hipH - 0.6] });
    p.fa = { a: 0.05, e: 0.1, hand: 'open' };
    p.ba = { a: -0.05, e: 0.1, hand: 'open' };
    p.look = 'down';
    return p;
  },
  yawn: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.12 });
    const s = shoulderAt(b, p.hip, p.lean);
    const i = Math.min(3, Math.floor(t * 4));
    const up = i === 1 || i === 2;
    // one hand over the mouth, the other stretched up behind the head
    p.fa = up ? { ik: face(b, p.hip, p.lean, 4.8, 2.6), hand: 'flat' } : { a: 0.13, e: 0.4, hand: 'fist' };
    p.ba = { ik: add(s, (up ? -7.2 : -1.4) * k, (up ? 11.6 : 1) * k), hand: 'fist' };
    if (up) p.front = ['armF'];
    p.look = 'up';
    return p;
  },
  laugh: (b, t) => {
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: i % 2 ? -0.12 : -0.04, hip: [0, b.hipH - (i % 2 ? 0.4 : 0)] });
    const s = shoulderAt(b, p.hip, p.lean);
    return hands(p, add(s, 3.4 * k, -7.6 * k), add(s, 2 * k, -7 * k), 'flat', 'flat');
  },
  bellyLaugh: (b, t) => {
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: i % 2 ? -0.2 : -0.08, hip: [0, b.hipH - (i % 2 ? 0.6 : 0)] });
    const s = shoulderAt(b, p.hip, p.lean);
    p.look = 'up';
    return hands(p, add(s, 5.4 * k, -8.4 * k), add(s, 4 * k, -8 * k), 'flat', 'flat');
  },
  angry: (b, t) => {
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { lean: 0.14, fl: { f: [2 * k, b.ankleH + (i === 1 ? 1.4 * k : 0)] }, bl: { f: [-2 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 3 * k, (-6.4 + (i % 2) * 1.2) * k), hand: 'fist' };
    p.ba = { ik: add(s, 1.4 * k, (-6.8 + (i % 2) * 1.2) * k), hand: 'fist' };
    p.bounce = i === 1 ? -0.4 : 0;
    return p;
  },
  surprised: (b, t) => {
    const k = K(b);
    const i = Math.min(2, Math.floor(t * 3));
    const p = stand(b, { lean: [-0.02, -0.18, -0.12][i], hip: [[0, -0.8, -0.6][i] * k, b.hipH + [0, 1.4, 0][i] * k] });
    const s = shoulderAt(b, p.hip, p.lean);
    return hands(p, add(s, [3, 5.2, 4.6][i] * k, [-5, 3.6, 2.4][i] * k), add(s, [1.6, 3.8, 3][i] * k, [-5.4, 3.2, 1.8][i] * k), 'open', 'open');
  },
  brace: (b, t) => { const k = K(b); const p = crouchP(b, 0.8, 0.12); p.fa = { a: 1.2 + (t > 0.5 ? 0.1 : 0), e: 0.4, hand: 'open' }; p.ba = { a: -0.8, e: 0.4, hand: 'open' }; p.fl = { f: [3.4 * k, b.ankleH] }; p.bl = { f: [-3.4 * k, b.ankleH] }; return p; },
  slip: (b, t) => { const k = K(b); const i = Math.floor(t * 4) % 4; const p = stand(b, { lean: [0.1, -0.2, -0.3, 0][i] }); p.fa = { a: 2.4, e: 0.2, hand: 'open' }; p.ba = { a: 1.8, e: 0.3, hand: 'open' }; p.fl = { f: [[2, 4, 5, 3][i] * k, b.ankleH] }; return p; },
  fallBack: (b, t) => keys(t, [stand(b, { lean: -0.2 }), { ...sitGroundP(b, -0.4) }, sitGroundP(b, -0.2)], false),
  sitShock: (b, t) => { const k = K(b); const p = sitGroundP(b, -0.3); const s = shoulderAt(b, p.hip, p.lean); return hands(p, add(s, 4.4 * k, 2 * k + (t > 0.5 ? 0.4 : 0)), add(s, 2.6 * k, 2.6 * k), 'open', 'open'); },
  // personality
  glasses: (b, t) => {
    const k = K(b);
    const p = stand(b);
    const i = Math.min(3, Math.floor(t * 4));
    const eye = face(b, p.hip, p.lean, 3.6, 4.6);
    p.fa = i === 1 || i === 2 ? { ik: add(eye, 0.4 * k, (i === 2 ? 0.6 : 0) * k), hand: 'point' } : { a: 0.13, e: 0.4, hand: 'fist' };
    p.front = i === 1 || i === 2 ? ['armF'] : undefined;
    return p;
  },
  hype: (b, t) => {
    const k = K(b);
    const i = Math.floor(t * 4) % 4;
    const p = stand(b, { hip: [0, b.hipH + (i % 2 ? 1.8 * k : 0)], lean: 0.06 });
    const s = shoulderAt(b, p.hip, p.lean);
    if (i % 2) { p.fl = { f: [-1 * k, b.ankleH + 1.4 * k], fa: -0.3 }; p.bl = { f: [1.2 * k, b.ankleH + 1.8 * k], fa: -0.2 }; }
    return hands(p, add(s, 4 * k, (i % 2 ? 1 : -2.4) * k), add(s, 2.2 * k, (i % 2 ? -2 : 0.6) * k), 'fist', 'fist');
  },
  fingerGuns: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.06 });
    const s = shoulderAt(b, p.hip, p.lean);
    const q = t > 0.5 ? 0.8 : 0;
    return hands(p, add(s, 8.6 * k, (-1 + q) * k), add(s, 7.2 * k, (-2 + q) * k), 'point', 'point');
  },
  stretch: (b, t) => {
    const k = K(b);
    const i = Math.min(3, Math.floor(t * 4));
    const p = stand(b, { lean: [0, -0.16, -0.22, -0.05][i] });
    const s = shoulderAt(b, p.hip, p.lean);
    const up = i === 1 || i === 2;
    return hands(p, add(s, (up ? 10.6 : 1.6) * k, (up ? 11.4 : -6) * k), add(s, (up ? -7.4 : -1.4) * k, (up ? 11.6 : -6) * k), up ? 'fist' : 'flat', up ? 'fist' : 'flat');
  },
  slingAim: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.02, fl: { f: [2.8 * k, b.ankleH] }, bl: { f: [-2.8 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    const pull = t > 0.5 ? 0.4 : 0;
    p.fa = { ik: add(s, 9.4 * k, 0.4 * k), hand: 'grip' };
    p.ba = { ik: add(s, (2.4 - pull) * k, 0.2 * k), hand: 'pinch' };
    p.props = [prop('slingshot', 0, 0, 1.45, { t: 1, s: 0.8 }), prop('stone', 0, 0, 0, { t: 2 })];
    return p;
  },
  slingshot: (b, t) => {
    const k = K(b);
    const i = Math.min(3, Math.floor(t * 4));
    const p = stand(b, { lean: [-0.02, -0.06, 0.08, 0.02][i], fl: { f: [2.8 * k, b.ankleH] }, bl: { f: [-2.8 * k, b.ankleH] } });
    const s = shoulderAt(b, p.hip, p.lean);
    p.fa = { ik: add(s, 9.4 * k, 0.4 * k), hand: 'grip' };
    p.ba = { ik: add(s, [1.6, 1, 6, 4][i] * k, 0.2 * k), hand: i < 2 ? 'pinch' : 'open' };
    p.props = [prop('slingshot', 0, 0, 1.45, { t: 1, s: 0.8 }), ...(i < 2 ? [prop('stone', 0, 0, 0, { t: 2 })] : [])];
    return p;
  },
  armsCrossed: (b, t) => {
    const k = K(b);
    const p = stand(b, { lean: -0.04, hip: [0, b.hipH - (t > 0.5 ? 0.3 : 0)] });
    const s = shoulderAt(b, p.hip, p.lean);
    p.armBFwd = true;
    return hands(p, add(s, 1.4 * k, -4.8 * k), add(s, 4.4 * k, -4.2 * k), 'flat', 'flat');
  },
};

export function animePose(id: string, anim: string, b: Build, frame: number): Pose {
  const info = ANIME_ANIMS[anim] ?? ANIME_ANIMS.idle;
  const fn = POSES[anim] ?? POSES.idle;
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(b, t, id);
}

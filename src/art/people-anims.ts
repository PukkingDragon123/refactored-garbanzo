// V2 people: animation table and pose authoring (keyframed + procedural cycles).

import { Build, Pose, ArmP, LegP, P2, keys } from './people-rig';
import type { CharId } from './people-parts';

export interface AnimInfo { frames: number; fps: number; loop: boolean }

export const ANIMS: Record<string, AnimInfo> = {
  idle: { frames: 4, fps: 3, loop: true },
  walk: { frames: 8, fps: 10, loop: true },
  run: { frames: 8, fps: 14, loop: true },
};

type PoseFn = (b: Build, t: number, id: CharId) => Pose;

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const sm = (t: number) => t * t * (3 - 2 * t);

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
      // heel strike: toe up; mid: flat; toe-off: heel up
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
  // two steps per cycle: lowest just after each contact
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
    // secondary motion lags the bob by ~1/8 cycle
    bounce: o.bob * 0.7 * Math.cos(TAU * 2 * (t - 0.25)),
    sway: (o.hipDrop ?? 0.6) + 0.5 * Math.sin(TAU * 2 * t),
  };
}

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
  walk: (b, t) => cycle(b, t, { stride: b.thigh * 1.25, lift: 2.6, bob: 1.1, lean: 0.06, swing: 0.42, elbow: 0.25, elbowSwing: 0.35, stance: 0.56 }),
  run: (b, t) => {
    const p = cycle(b, t, { stride: b.thigh * 1.9, lift: 4.2, bob: 1.4, lean: 0.22, swing: 0.85, elbow: 1.35, elbowSwing: 0.3, stance: 0.42, flight: 1.5, hipDrop: 1.6 });
    return p;
  },
};

export function poseFor(id: CharId, anim: string, b: Build, frame: number): Pose {
  const info = ANIMS[anim] ?? ANIMS.idle;
  const fn = POSES[anim] ?? POSES.idle;
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(b, t, id);
}

export const CHAR_SPECIALS: Record<CharId, string[]> = {
  rowan: [],
  crowe: [],
  aroha: [],
  lou: [],
  pip: [],
};

export { keys };
export type { P2 };

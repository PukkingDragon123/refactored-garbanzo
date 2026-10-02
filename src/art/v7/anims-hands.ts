// V7 hands at work: carrying real objects and handling things (the HANDS_ANIMS of anim-contract.ts).
//
// Carrying: 'carryIdle~<kind>' and 'carryWalk~<kind>' hold the actual thing (held.ts draws it in the
// hands): planks on the far shoulder, a log or firewood across the forearms, a stone low in both
// hands, a pot by its handles, a bucket by the bail, a crate in both arms, a fish by the gills, flax
// over the shoulder, a rope coil on the shoulder, a lantern held out, the camera at the chest, Chunk
// in the arms, the outboard motor hugged to the chest. Heavy loads walk shorter and lower, lean back
// and waddle; the load lags the body a beat (it bobs after the step, not with it), and the clips stay
// distance-driven so the feet never skate.
// Water: 'cupWater' scoops it up from a stream, 'cupIdle~N' / 'cupWalk~N' carry it in cupped hands
// (N = how full, 1..4): careful short steps, eyes on the hands, the surface catching the light.
// Handling: backpackOff / backpackOpen / backpackOn, kneelWork, craft, stir, chop.

import type { Build, Pose, ArmP, P2 } from '../people-rig';
import { stand, crouchP } from '../anime/anims';
import { ANIMS7, POSES7, POSES7V, DIST7, gait, gaitOf, gaitDist, shoulder, wHead, wHang, bump, smooth, lerp2, add2, ease, K } from './anims7';
import type { Gait } from './anims7';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------------ kinds

interface Ctx {
  /** cycle phase 0..1 */
  t: number;
  walking: boolean;
  id: string;
  k: number;
  /** where the load hangs from: the shoulder a beat behind the body (follow-through), ground space */
  S: P2;
  /** the shoulder now */
  s: P2;
  /** a world-space point (flags wN / wF) off the neck top a beat behind the body: in front of the chest where it reads */
  W(dx: number, dy: number): P2;
  /** the load's extra dip after each footfall, 0..1 */
  dip: number;
  /** the variant's value (count, fill level...) */
  v: number;
}
interface CarrySpec {
  /** 0 light .. 1 very heavy: shorter, lower, slower steps, a lean back, a waddle */
  heavy: number;
  /** careful (water, a full pot): short level steps, leaning in over the hands */
  careful?: number;
  /** the object drawn (held.ts), if not the kind itself; null: pose only */
  draw?: string | null;
  /** the variant's value from its name (default 1) */
  value?: (v: string) => number;
  arms(b: Build, p: Pose, c: Ctx): void;
}

const both = (p: Pose, n: ArmP, f: ArmP) => { p.fa = n; p.ba = f; };
const fl = (p: Pose, f: Record<string, number>) => { p.flags = { ...(p.flags ?? {}), ...f }; };

export const CARRY: Record<string, CarrySpec> = {
  crate: {
    heavy: 0.62,
    arms(b, p, c) {
      const k = c.k, S = c.S;
      const at = add2(S, 5.6 * k, -11.4 * k - c.dip * 0.6 * k);
      both(p, { ik: at, hand: 'flat', palm: 'in', flex: -0.1 }, { ik: add2(at, 0.3 * k, 0), hand: 'flat', palm: 'in', flex: -0.1 });
      fl(p, { zN: 4.4 * k, zF: -4.2 * k });
      p.front = ['armF'];
      p.look = 'fwd';
    },
  },
  log: {
    heavy: 0.7,
    arms(b, p, c) {
      const k = c.k, at = add2(c.S, 4.8 * k, -10.2 * k - c.dip * 0.7 * k);
      both(p, { ik: at, hand: 'grip', palm: 'up', flex: 0.35 }, { ik: add2(at, 0.4 * k, 0.3 * k), hand: 'grip', palm: 'up', flex: 0.35 });
      fl(p, { zN: 3.8 * k, zF: -3.6 * k });
      p.front = ['armF'];
    },
  },
  firewood: {
    heavy: 0.38,
    value: v => +v || 4,
    arms(b, p, c) {
      const k = c.k, at = add2(c.S, 4.4 * k, -9.2 * k - c.dip * 0.5 * k);
      both(p, { ik: at, hand: 'grip', palm: 'up', flex: 0.4 }, { ik: add2(at, 0.5 * k, 0.2 * k), hand: 'grip', palm: 'up', flex: 0.4 });
      fl(p, { zN: 3.2 * k, zF: -3 * k });
      p.front = ['armF'];
    },
  },
  stone: {
    heavy: 0.78,
    arms(b, p, c) {
      const k = c.k, at = add2(c.S, 3.6 * k, -13.6 * k - c.dip * 0.8 * k);
      both(p, { ik: at, hand: 'grip', palm: 'up', flex: 0.5 }, { ik: add2(at, 0.4 * k, 0), hand: 'grip', palm: 'up', flex: 0.5 });
      fl(p, { zN: 3.2 * k, zF: -3 * k });
      p.front = ['armF'];
      p.look = 'down';
    },
  },
  pot: {
    heavy: 0.36, careful: 0.5,
    value: v => (v === '' ? 1 : +v),
    arms(b, p, c) {
      const k = c.k, at = add2(c.S, 5.8 * k, -10.6 * k - c.dip * 0.4 * k);
      both(p, { ik: at, hand: 'grip', palm: 'in', dev: 0.2 }, { ik: add2(at, 0.4 * k, 0), hand: 'grip', palm: 'in', dev: 0.2 });
      fl(p, { zN: 4.4 * k, zF: -4.2 * k });
      p.front = ['armF'];
      p.look = 'down';
    },
  },
  pan: {
    heavy: 0.1,
    arms(b, p, c) {
      p.fa = { ik: c.W(8.4, -19), hand: 'grip', palm: 'in', dev: -0.3 };
      fl(p, { zN: 3.2 * c.k, wN: 1 });
      p.front = ['armF'];
    },
  },
  bucket: {
    heavy: 0.46,
    value: v => (v === '' ? 1 : +v),
    arms(b, p, c) {
      const k = c.k;
      // the arm straight down at the side, the body leaning away from the weight
      p.fa = { ik: add2(c.S, 1.6 * k, -(b.upArm + b.foreArm) * 0.93 - c.dip * 0.5 * k), hand: 'grip', palm: 'in' };
      p.ba = { a: 0.35 + Math.sin(TAU * c.t) * 0.08, e: 0.35, hand: 'open', palm: 'back' };
      fl(p, { aoN: 1.6, aoF: 2.6, roll: -0.05, sx: (p.flags?.sx ?? 0) - 0.6 * k });
    },
  },
  fish: {
    heavy: 0.08,
    value: v => (v === '' ? 1 : +v),
    arms(b, p, c) {
      const k = c.k;
      // held up by the gills, out from the side a little to show it off
      p.fa = { ik: add2(c.s, 3.4 * k, -10.2 * k), hand: 'hook', palm: 'back' };
      fl(p, { aoN: 1.4 });
    },
  },
  flax: {
    heavy: 0.12,
    value: v => (v === '' ? 1 : +v),
    arms(b, p, c) {
      const k = c.k;
      // fist in front of the near shoulder, the leaves over it and down the back
      p.fa = { ik: add2(c.S, 2.2 * k, -2.6 * k), hand: 'grip', palm: 'in', flex: -0.2 };
      fl(p, { zN: 4.8 * k });
      p.front = ['armF'];
    },
  },
  rope: {
    heavy: 0.22,
    arms(b, p, c) {
      const k = c.k;
      // the near hand holds the coil's lower turns against the hip
      p.fa = { ik: add2(c.s, 1.4 * k, -9.8 * k), hand: 'grip', palm: 'in' };
      fl(p, { aoN: 1.8 });
      p.front = ['armF'];
    },
  },
  lantern: {
    heavy: 0.05,
    arms(b, p, c) {
      // held out ahead to light the way, the elbow soft
      p.fa = { ik: c.W(11.8, -9.5), hand: 'hook', palm: 'back' };
      fl(p, { zN: 3.4 * c.k, wN: 1 });
      p.front = ['armF'];
      p.look = 'fwd';
    },
  },
  camera: {
    heavy: 0.04,
    arms(b, p, c) {
      both(p, { ik: c.W(5.4, -12.2), hand: 'grip', palm: 'in' }, { ik: c.W(6.6, -13.2), hand: 'grip', palm: 'up' });
      fl(p, { zN: 2.4 * c.k, zF: -1.8 * c.k, wN: 1, wF: 1 });
      p.front = ['armF'];
      p.look = 'down';
    },
  },
  shell: {
    heavy: 0,
    arms(b, p, c) {
      p.fa = { ik: c.W(6.6, -11.5), hand: 'cup', palm: 'upcam' };
      fl(p, { zN: 2.4 * c.k, wN: 1 });
      p.front = ['armF'];
      p.look = 'down';
    },
  },
  bundle: {
    heavy: 0.3,
    arms(b, p, c) {
      const k = c.k;
      p.fa = { ik: add2(c.S, 1.2 * k, 0.6 * k), hand: 'grip', palm: 'back', flex: 0.3 };
      fl(p, { zN: 4.6 * k });
      p.front = ['armF'];
    },
  },
  plank: {
    heavy: 0.3,
    value: v => (v === '' ? 1 : +v),
    arms(b, p, c) {
      const k = c.k;
      // the far hand up in front of the far shoulder, steadying the boards on it
      p.ba = { ik: add2(c.S, 3.4 * k, 1.4 * k), hand: 'grip', palm: 'up', flex: 0.2 };
      fl(p, { zF: -5.2 * k });
    },
  },
  outboard: {
    heavy: 0.95,
    arms(b, p, c) {
      const k = c.k, at = add2(c.S, 4.6 * k, -9.2 * k - c.dip * 0.9 * k);
      both(p, { ik: at, hand: 'flat', palm: 'in', flex: 0.3 }, { ik: add2(at, 0.6 * k, 0.4 * k), hand: 'flat', palm: 'in', flex: 0.3 });
      fl(p, { zN: 4.4 * k, zF: -4.2 * k });
      p.front = ['armF'];
    },
  },
  water: {
    heavy: 0.05, careful: 1,
    value: v => clamp01((+v || 4) / 4),
    arms(b, p, c) {
      // both hands cupped together, palms up and tipped to the light, held steady in front of the chest
      const at = c.W(8.4, -13.2);
      both(p, { ik: at, hand: 'cup', palm: 'upcam' }, { ik: add2(at, 0.5, 0.3), hand: 'cup', palm: 'upcam' });
      fl(p, { zN: 1.3 * c.k, zF: -1.1 * c.k, wN: 1, wF: 1 });
      p.front = ['armF', 'armB'];
      p.look = 'down';
    },
  },
  chunk: {
    heavy: 0.42,
    arms(b, p, c) {
      const k = c.k;
      // a pug held like a baby: the near forearm under his bottom, the far hand on his back
      both(p, { ik: add2(c.S, 4.6 * k, -7.6 * k - c.dip * 0.4 * k), hand: 'flat', palm: 'up', flex: 0.2 }, { ik: add2(c.S, 3.6 * k, -3.6 * k), hand: 'flat', palm: 'in' });
      fl(p, { zN: 1.8 * k, zF: -0.6 * k });
      p.front = ['armF'];
    },
  },
  // a person (or a sack) across the shoulders, a fireman's carry: hands up holding the load in place
  shoulders: {
    heavy: 0.9, draw: null,
    arms(b, p, c) {
      const k = c.k;
      both(p, { ik: add2(c.S, 2.6 * k, 0.4 * k), hand: 'grip', palm: 'back' }, { ik: add2(c.S, -1.6 * k, 1.6 * k), hand: 'grip', palm: 'down' });
      fl(p, { zN: 5.2 * k, zF: -4.4 * k });
      p.lean += 0.14;
    },
  },
};
CARRY.planks = { ...CARRY.plank, heavy: 0.55, value: v => +v || 3 };
CARRY.fruit = { ...CARRY.shell };
CARRY.wood = CARRY.sticks = CARRY.firewood;
CARRY.driftwood = CARRY.log;
CARRY.rock = CARRY.stone;
export const CARRY_KINDS = Object.keys(CARRY);

const specOf = (kind: string) => CARRY[kind] ?? CARRY.crate;
export const carryWeight = (kind: string) => specOf(kind).heavy;

/** the character's walk, loaded */
function carryGait(b: Build, id: string, s: CarrySpec): Gait {
  const w = gaitOf(id).walk(b), h = s.heavy, c = s.careful ?? 0, k = K(b);
  return {
    ...w,
    stride: w.stride * (1 - 0.36 * h) * (1 - 0.28 * c),
    lift: w.lift * (1 - 0.42 * h) * (1 - 0.3 * c),
    bob: w.bob * (1 + 0.6 * h) * (1 - 0.5 * c),
    lean: w.lean - 0.1 * h + 0.05 * c,
    swing: 0.12 * (1 - h), elbowSwing: 0.1,
    drop: w.drop + (0.9 * h + 0.3 * c) * k,
    sway: (w.sway ?? 0) * (1 + 1.1 * h) * (1 - 0.5 * c) + 0.3 * h * k,
    roll: (w.roll ?? 0) + 0.035 * h,
    armOut: 0,
  };
}

/** standing with a load: feet planted wider, knees giving under the weight, a slow breath */
function carryStand(b: Build, t: number, h: number, careful: number): Pose {
  const k = K(b), br = Math.sin(TAU * t);
  const p = stand(b, { lean: 0.02 - 0.09 * h + 0.04 * careful });
  p.hip = [0.2 * k * Math.sin(TAU * t + 0.6) * (0.5 + h), b.hipH - (0.4 + 1.1 * h) * k - Math.max(0, -br) * (0.3 + 0.4 * h)];
  p.sq = 1 + br * 0.015 - h * 0.012;
  p.fl = { f: [-(2.2 + h) * k, b.ankleH], fa: 0 };
  p.bl = { f: [(2.4 + h) * k, b.ankleH], fa: 0.04 };
  p.fa = { a: 0.08, e: 0.3, hand: 'relax' };
  p.ba = { a: -0.06, e: 0.26, hand: 'relax' };
  p.sway = 0.15 + 0.15 * br;
  p.flags = { sx: 0.25 * k * Math.sin(TAU * t) * (1 + h) };
  return p;
}

const LAG = 0.07;
function carryPose(b: Build, t: number, id: string, kind: string, v: string, walking: boolean): Pose {
  const spec = specOf(kind), k = K(b);
  let p: Pose, lagP: Pose;
  if (walking) {
    const g = carryGait(b, id, spec);
    p = gait(b, t, g);
    lagP = gait(b, t - LAG, g);
  } else {
    p = carryStand(b, t, spec.heavy, spec.careful ?? 0);
    lagP = carryStand(b, t - LAG * 0.5, spec.heavy, spec.careful ?? 0);
  }
  const s = shoulder(b, p.hip, p.lean), sl = shoulder(b, lagP.hip, lagP.lean);
  // the load's inertia: it keeps going down a moment after each footfall
  const dip = walking ? Math.max(0, Math.sin(TAU * 2 * (t - 0.12))) * spec.heavy : 0;
  const ctx: Ctx = {
    t, walking, id, k, s, S: lerp2(s, sl, 0.7), dip, v: spec.value ? spec.value(v) : 1,
    W: (dx, dy) => { const a = wHead(b, p, dx, dy), l = wHead(b, lagP, dx, dy); return [a[0] + (l[0] - a[0]) * 0.7, a[1] + (l[1] - a[1]) * 0.7 - dip * 0.5]; },
  };
  spec.arms(b, p, ctx);
  const draw = spec.draw === undefined ? (CARRY[kind] ? kind : 'crate') : spec.draw;
  if (draw) p.held = { kind: draw, v: ctx.v, t };
  p.sway = (p.sway ?? 0) * (1 - 0.4 * spec.heavy);
  return p;
}

// ------------------------------------------------------------------ water: scooping, carrying

/**
 * Scooping water from a stream (one-shot): crouch at the edge, both hands in, cupped, lift them out
 * dripping and rise holding them in front. The cup fills at the dip (held water from u 0.45).
 */
function cupWater(b: Build, u: number): Pose {
  const k = K(b);
  const down = bump(u, 0.02, 0.72, 0.24), dip = bump(u, 0.3, 0.55, 0.08);
  const p = crouchP(b, 1 - 0.42 * down, 0.06 + 0.42 * down);
  if (down < 0.05) { p.hip = [0, b.hipH - 0.3]; }
  const s = shoulder(b, p.hip, p.lean);
  const water: P2 = [9.4 * k, 1.2 * k - dip * 1.4 * k];
  const chest = add2(s, 4.8 * k, -9.4 * k);
  const reach = smooth(u / 0.3), rise = smooth((u - 0.55) / 0.4);
  const at = u < 0.55 ? lerp2(wHang(b, p, 1), water, reach) : lerp2(water, chest, rise);
  const cupped = u > 0.22;
  p.fa = { ik: at, hand: cupped ? 'cup' : 'open', palm: cupped ? 'upcam' as never : 'down' };
  p.ba = { ik: add2(at, 0.2 * k, 0.1 * k), hand: cupped ? 'cup' : 'open', palm: cupped ? 'upcam' as never : 'down' };
  p.flags = { zN: 1.25 * k, zF: -1.05 * k };
  p.front = ['armF', 'armB'];
  p.look = 'down';
  if (u > 0.45) p.held = { kind: 'water', v: 1, t: u };
  p.legFwd = true;
  return p;
}

// ------------------------------------------------------------------ handling

/** the hands on a backpack's straps, off the shoulders, swung round and set down in front (u 0 → 1) */
function backpack(b: Build, u: number): Pose {
  const k = K(b);
  const kneel = smooth((u - 0.5) / 0.5);
  const p = kneel > 0.02 ? crouchP(b, 1 - 0.4 * kneel, 0.1 + 0.32 * kneel) : stand(b, { lean: 0.02 });
  const s = shoulder(b, p.hip, p.lean);
  const straps = bump(u, 0, 0.42, 0.14);
  // thumbs hooked under the straps → the near arm slips out → both hands on the pack bringing it round → down
  const strapN = add2(s, 1.6 * k, -2.2 * k), strapF = add2(s, 2.2 * k, -2.6 * k);
  const front = add2(s, 5 * k, -8.6 * k), ground: P2 = [6.4 * k, 3.4 * k];
  const holdAt = u < 0.55 ? front : lerp2(front, ground, smooth((u - 0.55) / 0.4));
  const w = smooth((u - 0.3) / 0.25);
  p.fa = { ik: lerp2(strapN, holdAt, w), hand: straps > 0.5 && w < 0.5 ? 'hook' : 'grip', palm: 'in' };
  p.ba = { ik: lerp2(strapF, add2(holdAt, 0.6 * k, 0.4 * k), w), hand: straps > 0.5 && w < 0.5 ? 'hook' : 'grip', palm: 'in' };
  p.flags = { zN: 3.4 * k * w + 3 * k * (1 - w), zF: -3.2 * k * w - 2 * k * (1 - w), roll: 0.06 * bump(u, 0.1, 0.45, 0.12), noPack: 1 };
  p.lean += 0.06 * bump(u, 0.15, 0.5, 0.15);
  p.front = ['armF'];
  p.look = u > 0.4 ? 'down' : 'fwd';
  p.held = { kind: 'pack', v: u };
  return p;
}
/** kneeling at the open pack, rummaging in it */
function backpackOpen(b: Build, t: number): Pose {
  const k = K(b);
  const p = crouchP(b, 0.6, 0.42);
  const r = Math.sin(TAU * t), r2 = Math.sin(TAU * t * 2 + 1);
  p.fa = { ik: [6.4 * k + r * 0.8 * k, 6.2 * k + Math.max(0, r2) * 1.6 * k], hand: r2 > 0.3 ? 'pinch' : 'relax', palm: 'down' };
  p.ba = { ik: [7 * k - r * 0.6 * k, 6.6 * k], hand: 'grip', palm: 'down' };
  p.flags = { zN: 2.6 * k, zF: -2.2 * k, noPack: 1 };
  p.front = ['armF'];
  p.look = 'down';
  p.held = { kind: 'pack', v: 1 };
  return p;
}

/** kneeling on one knee, both hands busy on the ground in front (setting stones, tying, digging in pegs) */
function kneelWork(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b, { hip: [-1.1 * k, b.hipH * 0.52], lean: 0.42, legFwd: true });
  p.fl = { f: [4.4 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-6.2 * k, 1.2 * k], fa: -1.1 };
  const a = TAU * t, push = Math.max(0, Math.sin(a * 2));
  p.hip = [p.hip[0], p.hip[1] - push * 0.3 * k];
  p.fa = { ik: [(8.6 + Math.sin(a) * 1.2) * k, (2.4 + Math.max(0, Math.cos(a)) * 1.8) * k], hand: Math.cos(a) > 0.2 ? 'pinch' : 'grip', palm: 'down' };
  p.ba = { ik: [(7.4 - Math.sin(a) * 0.6) * k, (1.8 + push * 0.6) * k], hand: 'flat', palm: 'down' };
  p.flags = { zN: 2.8 * k, zF: -1.6 * k };
  p.look = 'down';
  p.bounce = -push * 0.3;
  return p;
}

/** sitting on the heels, lashing / weaving something in the lap: the hands pull the cord through in turn */
function craft(b: Build, t: number): Pose {
  const k = K(b);
  const p = crouchP(b, 0.5, 0.18);
  const a = TAU * t, pullN = Math.max(0, Math.sin(a)), pullF = Math.max(0, -Math.sin(a));
  const lap: P2 = [p.hip[0] + 5.2 * k, p.hip[1] + 2.2 * k];
  p.fa = { ik: add2(lap, 1.6 * k + pullN * 1.2 * k, 0.8 * k + pullN * 1.6 * k), hand: pullN > 0.4 ? 'pinch' : 'grip', palm: 'in' };
  p.ba = { ik: add2(lap, -0.4 * k - pullF * 0.8 * k, 0.6 * k + pullF * 1.4 * k), hand: pullF > 0.4 ? 'pinch' : 'grip', palm: 'in' };
  p.flags = { zN: 1.8 * k, zF: -1.4 * k };
  p.front = ['armF'];
  p.look = 'down';
  p.hd = [0.3 * k, -0.4 * k];
  p.held = { kind: 'work', t };
  return p;
}

/** stirring a pot on the fire with a long spoon, the other fist on the hip; leaning over to look in */
function stir(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = stand(b, { lean: 0.14 });
  const a = TAU * t;
  p.hip = [0.2 * k * Math.sin(a), b.hipH - 0.5 * k];
  p.fl = { f: [1.8 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-2.6 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, (6.6 + Math.cos(a) * 1.5) * k, (-6.2 + Math.sin(a) * 0.7) * k), hand: 'grip', palm: 'in', dev: 0.5 };
  p.ba = id === 'joshu' ? { ik: [p.hip[0] - 0.2 * k, p.hip[1] + 2.4 * k], hand: 'fist' } : { ik: add2(s, 1.6 * k, -9.4 * k), hand: 'relax' };
  p.flags = { zN: 2 * k, aoF: id === 'joshu' ? 3.2 : 0.4, sx: 0.3 * k * Math.sin(a) };
  p.look = 'down';
  p.held = { kind: 'spoon', t };
  return p;
}

/**
 * Chopping wood with a hatchet: wind up over the shoulder (anticipation: up on the toes, a lean back),
 * the swing down, the hit (a squash, knees give, the hands stop dead), a recoil, and back up.
 */
function chop(b: Build, t: number): Pose {
  const k = K(b);
  const up = bump(t, 0, 0.62, 0.3), hit = bump(t, 0.6, 0.78, 0.04);
  const swing = clamp01((t - 0.48) / 0.14);
  const p = stand(b, { lean: 0.08 - 0.12 * up * (1 - swing) + 0.26 * swing * (1 - smooth((t - 0.8) / 0.2)) });
  p.hip = [0, b.hipH - (0.3 + hit * 1.2) * k + up * (1 - swing) * 0.5 * k];
  p.sq = 1 - hit * 0.04 + up * (1 - swing) * 0.02;
  p.fl = { f: [2.6 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-2.6 * k, b.ankleH + up * (1 - swing) * 0.4 * k], fa: -0.2 * up * (1 - swing) };
  const s = shoulder(b, p.hip, p.lean);
  const high = add2(s, -1.2 * k, 6.4 * k), block: P2 = [8.4 * k, 4.2 * k];
  const at = swing > 0 ? lerp2(high, block, ease(swing)) : lerp2(add2(s, 4.4 * k, -8 * k), high, up);
  p.fa = { ik: at, hand: 'fist', palm: 'in' };
  p.ba = { ik: add2(at, -1.6 * k, -1.2 * k), hand: 'fist', palm: 'in' };
  p.flags = { zN: 1.4 * k, zF: -0.4 * k };
  p.front = ['armF', 'armB'];
  p.look = swing > 0.3 ? 'down' : 'fwd';
  p.held = { kind: 'axe', t };
  p.bounce = -hit * 0.6;
  return p;
}

/** staggering under something heavy hugged to the chest (Aroha with Chunk): wobbly, knees bent, leaning back */
function carryHeavy(b: Build, t: number, id: string): Pose {
  const g = { ...carryGait(b, id, { heavy: 1, arms: () => {} }), stride: gaitOf(id).walk(b).stride * 0.5 };
  const p = gait(b, t, g);
  const lagP = gait(b, t - LAG, g);
  const k = K(b);
  p.lean = -0.16 + Math.sin(TAU * t) * 0.06;
  const s = lerp2(shoulder(b, p.hip, p.lean), shoulder(b, lagP.hip, lagP.lean), 0.6);
  p.fa = { ik: add2(s, 4.8 * k, -7.2 * k), hand: 'flat', palm: 'up', flex: 0.2 };
  p.ba = { ik: add2(s, 4 * k, -4.6 * k), hand: 'flat', palm: 'in' };
  p.flags = { ...(p.flags ?? {}), zN: 2.4 * k, zF: -1.2 * k };
  p.front = ['armF'];
  return p;
}

// ------------------------------------------------------------------ Chunk in the arms (the ship, after the crash)

function pupPose(b: Build, t: number, id: string, mode: 'idle' | 'walk' | 'run'): Pose {
  if (mode === 'run') {
    const w = gaitOf(id).run(b);
    const g: Gait = { ...w, stride: w.stride * 0.8, swing: 0.1, elbowSwing: 0, lean: w.lean * 0.7, armOut: 0 };
    const p = gait(b, t, g), lp = gait(b, t - LAG, g), k = K(b);
    const ctx: Ctx = { t, walking: true, id, k, s: shoulder(b, p.hip, p.lean), S: lerp2(shoulder(b, p.hip, p.lean), shoulder(b, lp.hip, lp.lean), 0.7), dip: 0, v: 1, W: (dx, dy) => wHead(b, lp, dx, dy) };
    CARRY.chunk.arms(b, p, ctx);
    p.held = { kind: 'chunk', t };
    return p;
  }
  return carryPose(b, t, id, 'chunk', '', mode === 'walk');
}

// ------------------------------------------------------------------ registration

Object.assign(ANIMS7, {
  carryIdle: { frames: 8, fps: 4, loop: true },
  carryWalk: { frames: 12, fps: 12, loop: true },
  // the old generic carry (a crate) keeps working, distance-driven
  carry: { frames: 12, fps: 12, loop: true },
  carryHeavy: { frames: 12, fps: 8, loop: true },
  carryHeft: { frames: 6, fps: 16, loop: false },
  cupWater: { frames: 14, fps: 9, loop: false },
  cupIdle: { frames: 8, fps: 4, loop: true },
  cupWalk: { frames: 12, fps: 10, loop: true },
  backpackOff: { frames: 12, fps: 12, loop: false },
  backpackOpen: { frames: 12, fps: 6, loop: true },
  backpackOn: { frames: 12, fps: 12, loop: false },
  kneelWork: { frames: 12, fps: 8, loop: true },
  craft: { frames: 12, fps: 7, loop: true },
  stir: { frames: 12, fps: 8, loop: true },
  chop: { frames: 14, fps: 12, loop: true },
  carryPup: { frames: 12, fps: 12, loop: true },
  carryPupIdle: { frames: 8, fps: 4, loop: true },
  carryPupRun: { frames: 12, fps: 16, loop: true },
});

Object.assign(POSES7V, {
  carryIdle: (b: Build, t: number, id: string, v: string) => carryPose(b, t, id, v || 'crate', '', false),
  carryWalk: (b: Build, t: number, id: string, v: string) => { const [kind, n] = v.split('.'); return carryPose(b, t, id, kind || 'crate', n ?? '', true); },
  carry: (b: Build, t: number, id: string, v: string) => carryPose(b, t, id, v || 'crate', '', true),
  /** the moment the weight comes on: knees give, the load sinks, and recovers */
  carryHeft: (b: Build, t: number, id: string, v: string) => {
    const p = carryPose(b, 0, id, v || 'crate', '', false), h = carryWeight(v || 'crate'), k = K(b);
    const sink = bump(t, 0, 1, 0.45) * (0.4 + h);
    p.hip = [p.hip[0], p.hip[1] - sink * 1.4 * k];
    p.sq = (p.sq ?? 1) - sink * 0.03;
    p.lean -= sink * 0.05;
    return p;
  },
  cupIdle: (b: Build, t: number, id: string, v: string) => carryPose(b, t, id, 'water', v, false),
  cupWalk: (b: Build, t: number, id: string, v: string) => carryPose(b, t, id, 'water', v, true),
});
// carryIdle~kind.n / carryWalk~kind.n: a count or level after the dot (3 planks, 5 sticks)
POSES7V.carryIdle = (b, t, id, v) => { const [kind, n] = v.split('.'); return carryPose(b, t, id, kind || 'crate', n ?? '', false); };

Object.assign(POSES7, {
  cupWater: (b: Build, t: number) => cupWater(b, t),
  backpackOff: (b: Build, t: number) => backpack(b, t),
  backpackOn: (b: Build, t: number) => backpack(b, 1 - t),
  backpackOpen: (b: Build, t: number) => backpackOpen(b, t),
  kneelWork: (b: Build, t: number) => kneelWork(b, t),
  craft: (b: Build, t: number) => craft(b, t),
  stir: (b: Build, t: number, id: string) => stir(b, t, id),
  chop: (b: Build, t: number) => chop(b, t),
  carryHeavy: (b: Build, t: number, id: string) => carryHeavy(b, t, id),
  carryPup: (b: Build, t: number, id: string) => pupPose(b, t, id, 'walk'),
  carryPupIdle: (b: Build, t: number, id: string) => pupPose(b, t, id, 'idle'),
  carryPupRun: (b: Build, t: number, id: string) => pupPose(b, t, id, 'run'),
});

const kindOf = (v: string) => v.split('.')[0];
DIST7.carryWalk = (b, id, v) => gaitDist(carryGait(b, id, specOf(kindOf(v) || 'crate')));
DIST7.carry = (b, id, v) => gaitDist(carryGait(b, id, specOf(v || 'crate')));
DIST7.cupWalk = (b, id) => gaitDist(carryGait(b, id, CARRY.water));
DIST7.carryPup = (b, id) => gaitDist(carryGait(b, id, CARRY.chunk));
DIST7.carryPupRun = (b, id) => { const w = gaitOf(id).run(b); return gaitDist({ ...w, stride: w.stride * 0.8 }); };
DIST7.carryHeavy = (b, id) => gaitDist({ ...carryGait(b, id, { heavy: 1, arms: () => {} }), stride: gaitOf(id).walk(b).stride * 0.5 });

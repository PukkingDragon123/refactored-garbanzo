// V7 combat set: the cast's fighting and agility moves (anim-contract.ts COMBAT_ANIMS), registered into
// ANIMS7 so any module can play them by name, plus the props they need, drawn in 3D in the hand.
//
//  slingReady    loop: the ready stance, slingshot up at the chest, the pouch loaded and pinched
//  slingDraw     the draw: a dip of anticipation, the bow arm punching out, the pouch pulled back to the
//                anchor at her jaw with the bands stretching, a hair of overdraw and the settle
//  slingAim      loop: held at full draw, the aim breathing (the transition from idle / ready plays slingDraw)
//  slingRelease  the snap: the draw hand flies open past the ear, the pouch whips through the fork and
//                the bands recoil past it, the pouch flicks over and swings, the bow arm follows through,
//                then a quick reload from the kete on her hip back to the ready stance
//  grenadeThrow  a firestone bundle from the kete: fuse sparks, step, wind up, an overhand whip, follow-through
//  flipBack      a crouch, an explosive back flip with a tight tuck, a light landing back on guard
//  dashStrike    a coiled crouch, a low smear of a dash, a leaping snap kick, landing on guard
//  roll          a dive into a forward shoulder roll, up into a crouch and on guard
//  landCrouch    the landing from a fall: knee and fingertips down, the other arm back, up to guard
//  vault         a speed vault over a low obstacle: hands on top, legs tucked through, landing running
//  dodge         a snap back: a hop back with the body swaying away, low, back on guard
//  + slingStandoff (the standoff on the beach: frames 0 lowered .. last at full draw, held with
//    holdFrame), slingUnholster / slingHolster (the slingshot out of the back of her belt and back),
//    placate (palms out: "easy, easy"), and 'slingshot' (the old name for a shot = slingRelease)
//
// Aroha has her own versions (registerOwn7): faster, lower, bigger, with overshoot, the slingshot always
// in her bow hand; everyone else gets a plainer, heavier take (Mori's slingshot is the simple one).
// Root motion (how far a move travels) and the moments that matter (the release, the hit, touch-down)
// are in COMBAT_MOVES7 for whoever moves the Actor (src/game/v11/moves.ts does it for you).
//
// Pose flags the props read (numbers, interpolated between keys unless discrete):
//   sl 1 slingshot in the far (bow) hand · fa its tilt (rad, + top forward)
//   po 0 pouch pinched in the near hand, 1 free at pf / pu px (forward / up from the fork crotch), 2 hanging
//   st stone: 0 none, 1 in the pouch, 2 in the near hand, 3 flying (a streak from s0 to s1 px ahead)
//   fs 1 a glowing firestone (Aroha's kōhatu ahi), 0 a plain pebble
//   gr 1 grenade in the near hand (gg: its fuse glow 0..1) · ts the idle's stone toss height (-1 none)

import type { Build, Pose, P2, ArmP, LegP } from '../people-rig';
import { lerpPose } from '../people-rig';
import { stand, neckAt } from '../anime/anims';
import { registerAnim7, registerOwn7 } from './anims7';
import type { AnimInfo7 } from './anims7';
import { HELD7, YAW } from './body';
import type { J3, Char7 } from './body';
import { Scene3D, V3, Hit, cel, Ramp6, vadd, vsub, vsc, vnorm, vlen } from './raster';
import { PixelBuffer } from '../pixel';
import { hex } from '../color';
import type { C } from '../color';
import { R6, PAL } from './gear';

const TAU = Math.PI * 2;
const K = (b: Build) => b.torso / 15;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const easeOut = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
const easeIn = (u: number) => Math.pow(clamp01(u), 2.2);
/** overshoot past 1 and settle (s: how far) */
const backOut = (u: number, s = 1.6) => { u = clamp01(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
/** 0..1 across [a, b] */
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const L2 = (p: P2, q: P2, u: number): P2 => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
const add2 = (p: P2, x: number, y: number): P2 => [p[0] + x, p[1] + y];

/** the shoulder (ground space) for a hip and lean */
function shoulder(b: Build, hip: P2, lean: number): P2 {
  const T = b.torso - b.shY;
  return [hip[0] + Math.sin(lean) * T, hip[1] + Math.cos(lean) * T];
}
/** the neck top (ground space) */
const neck = (b: Build, p: Pose): P2 => { const n = neckAt(b, p.hip, p.lean), hd = p.hd ?? [0, 0]; return [n[0] + hd[0], n[1] + hd[1]]; };
const isAroha = (id: string) => id === 'aroha';

// ------------------------------------------------------------------ blending

/** flags that switch rather than blend */
const DISCRETE = new Set(['sl', 'po', 'st', 'fs', 'gr', 'hair', 'back', 'wN', 'wF']);
/** a pose blend that also blends the numeric flags (yaw, the hands' lateral depths, the props) */
function mixPose(a: Pose, b: Pose, u: number): Pose {
  const p = lerpPose(a, b, u);
  const fa = a.flags ?? {}, fb = b.flags ?? {};
  const f: Record<string, number> = {};
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
    const x = fa[k], y = fb[k];
    if (x === undefined || y === undefined || DISCRETE.has(k)) f[k] = (u < 0.5 ? x ?? y : y ?? x) as number;
    else f[k] = x + (y - x) * u;
  }
  p.flags = f;
  // the props that only exist on one side stay on that side until the switch
  return p;
}
/** a chain of keys over t: [t0, pose0], [t1, pose1]... eased per span */
function chain(t: number, keys: [number, () => Pose, ((u: number) => number)?][]): Pose {
  if (t <= keys[0][0]) return keys[0][1]();
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
    if (t <= t1) return mixPose(p0(), p1(), (e ?? smooth)(seg(t, t0, t1)));
  }
  return keys[keys.length - 1][1]();
}

/**
 * Rigid spin for flips and rolls: rotate a pose (built upright around `pivot`, ground space) by `phi`
 * (radians, counter-clockwise = backward for someone facing right), the head going round with it.
 */
function spin(p: Pose, pivot: P2, phi: number, nod = 0): Pose {
  if (!phi && !nod) return p;
  const c = Math.cos(phi), s = Math.sin(phi);
  const R = (q: P2): P2 => { const x = q[0] - pivot[0], y = q[1] - pivot[1]; return [pivot[0] + x * c - y * s, pivot[1] + x * s + y * c]; };
  const V = (q: P2): P2 => [q[0] * c - q[1] * s, q[0] * s + q[1] * c];
  const arm = (a: ArmP): ArmP => (a.ik ? { ...a, ik: R(a.ik) } : a);
  const leg = (l: LegP): LegP => ({ ...l, f: R(l.f), fa: (l.fa ?? 0) + phi });
  const out: Pose = { ...p, hip: R(p.hip), lean: p.lean - phi, hd: p.hd ? V(p.hd) : p.hd, fa: arm(p.fa), ba: arm(p.ba), fl: leg(p.fl), bl: leg(p.bl) };
  // (nod: the head tucked further toward the chest than the body turns, chin in)
  const rot = (((nod - phi) % TAU) + TAU) % TAU;
  out.flags = { ...(p.flags ?? {}), hrot: rot < 1e-3 || rot > TAU - 1e-3 ? 0 : rot, fa: (p.flags?.fa ?? 0) - phi };
  return out;
}

// ------------------------------------------------------------------ the stances

/**
 * The ready stance with the slingshot (m: 1 Aroha, 0 the plain version): feet wide on soft knees, the
 * bow hand up at the chest with the fork tipped forward, the draw hand pinching the loaded pouch just
 * behind it. `t` bounces her lightly on the balls of her feet (twice a loop).
 */
function slingReadyP(b: Build, t: number, m: number): Pose {
  const k = K(b);
  const bob = m * 0.32 * k * (0.5 + 0.5 * Math.cos(TAU * t * 2));
  const br = Math.sin(TAU * t);
  const p = stand(b, { lean: lerp(0.05, 0.11, m) + br * 0.01, hip: [-0.3 * k, b.hipH - lerp(0.7, 1.6, m) * k - bob] });
  p.fl = { f: [-lerp(2.4, 3.4, m) * k, b.ankleH + m * 0.25 * k], fa: -0.14 * m };
  p.bl = { f: [lerp(2.4, 3.2, m) * k, b.ankleH], fa: 0 };
  p.sq = 1 + br * 0.012;
  const s = shoulder(b, p.hip, p.lean);
  // the bow hand up in front at the collarbone, the draw hand pinching the pouch a few px behind it
  p.ba = { ik: add2(s, lerp(7.0, 8.6, m), -lerp(4.6, 3.4, m) + br * 0.15), hand: 'grip' };
  p.fa = { ik: add2(s, lerp(3.2, 3.6, m), -lerp(5.6, 4.6, m) + br * 0.15), hand: 'pinch' };
  p.hd = [lerp(0.25, 0.45, m) * k, -0.3 * k];
  p.look = 'fwd';
  p.sway = 0.3;
  p.flags = { yaw: lerp(0.85, 0.78, m), zN: 1.0, zF: -0.4, sl: 1, fa: 0.28, po: 0, st: 1, fs: m > 0.5 ? 1 : 0, hair: 0 };
  return p;
}
/** full draw: the bow arm out straight at eye height, the pouch anchored at the jaw (m 0: at the chin, a shorter draw) */
function slingAimP(b: Build, t: number, m: number, over = 0): Pose {
  const k = K(b);
  const br = Math.sin(TAU * t);
  const p = stand(b, { lean: lerp(0.02, 0.03, m), hip: [-lerp(0.5, 1.0, m) * k, b.hipH - lerp(0.5, 1.15, m) * k + br * 0.12 * k] });
  p.fl = { f: [-lerp(2.6, 3.6, m) * k, b.ankleH], fa: -0.08 * m };
  p.bl = { f: [lerp(2.4, 3.0, m) * k, b.ankleH], fa: 0 };
  p.sq = 1 + br * 0.014;
  p.hd = [lerp(0.35, 0.5, m) * k, -0.05 * k];
  const s = shoulder(b, p.hip, p.lean), n = neck(b, p);
  // the bow arm: punched out, a breath of drift at the fork
  p.ba = { ik: [s[0] + lerp(13.5, 15.6, m) + over * 0.5, n[1] - lerp(1.6, 0.9, m) + Math.sin(TAU * t + 1) * 0.25], hand: 'grip' };
  // the draw hand at the anchor (elbow back and up)
  p.fa = { ik: [n[0] + lerp(2.6, 1.0, m) - over * 1.3, n[1] + lerp(0.2, 1.6, m) + over * 0.3], hand: 'pinch', flip: true };
  p.front = ['armF'];
  p.look = 'fwd';
  p.sway = 0.25;
  p.flags = { yaw: lerp(0.72, 0.6, m), zN: lerp(1.8, 2.4, m), zF: 0.2, sl: 1, fa: 0, po: 0, st: 1, fs: m > 0.5 ? 1 : 0, hair: 0 };
  return p;
}
/** a plain guard without the slingshot (for anyone who isn't carrying one) */
function guardP(b: Build, t = 0): Pose {
  const k = K(b), br = Math.sin(TAU * t);
  const p = stand(b, { lean: 0.1, hip: [-0.3 * k, b.hipH - 1.2 * k] });
  p.fl = { f: [-2.6 * k, b.ankleH], fa: -0.08 };
  p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, 4.6, -5.2 + br * 0.2), hand: 'fist' };
  p.ba = { ik: add2(s, 6.0, -3.8 + br * 0.2), hand: 'fist' };
  p.hd = [0.35 * k, -0.25 * k];
  p.flags = { yaw: 0.85, zN: 1.4, zF: -0.8, hair: 0 };
  return p;
}
/** where every move ends: Aroha back on guard with the slingshot up, anyone else in a plain guard */
const endP = (b: Build, id: string) => (isAroha(id) ? slingReadyP(b, 0, 1) : guardP(b));
/** Aroha keeps her slingshot in her bow hand through every move, the pouch hanging from the fork */
function carry(p: Pose, id: string, fa = 0.3): Pose {
  if (!isAroha(id)) { if (p.flags) { delete p.flags.sl; delete p.flags.st; } return p; }
  p.flags = { ...(p.flags ?? {}), sl: 1, po: 2, st: 1, fs: 1, fa: p.flags?.fa ?? fa };
  if (p.ba.hand !== 'flat' && p.ba.hand !== 'open') p.ba = { ...p.ba, hand: 'grip' };
  return p;
}

// ------------------------------------------------------------------ the slingshot sequence

function slingDraw(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0;
  const R = slingReadyP(b, 0, m);
  // the gather: a dip, both hands drawing in a touch before the bow arm goes out
  const G = slingReadyP(b, 0, m);
  G.hip = add2(G.hip, -0.3 * K(b), -0.55 * K(b) * (0.5 + m * 0.5));
  if (G.ba.ik) G.ba = { ...G.ba, ik: add2(G.ba.ik, -0.8, 0.4) };
  if (G.fa.ik) G.fa = { ...G.fa, ik: add2(G.fa.ik, -0.4, 0.2) };
  if (!m) return chain(t, [[0, () => R], [0.25, () => G], [0.85, () => slingAimP(b, 0, m)], [1, () => slingAimP(b, 0, m)]]);
  return chain(t, [
    [0, () => R],
    [0.16, () => G, easeOut],
    [0.7, () => slingAimP(b, 0, m, 1), easeOut],
    [1, () => slingAimP(b, 0, m), smooth],
  ]);
}

function slingAim(b: Build, t: number, id: string): Pose { return slingAimP(b, t, isAroha(id) ? 1 : 0); }

/** the free pouch after the release: forward / up px from the fork crotch (whip, flick, swing, hang) */
function pouchFree(t: number, m: number): [number, number] {
  const u = t / 0.96;
  if (u < 0.07) { const e = easeOut(u / 0.07); return [lerp(-11, 5.2 + m, e), lerp(0.4, 0.8, e)]; }
  if (u < 0.2) { const a = ((u - 0.07) / 0.13) * Math.PI * 0.62; return [0.6 + (4.6 + m) * Math.cos(a), 0.8 - 6.0 * Math.sin(a)]; }
  const v = u - 0.2, d = Math.exp(-v * 7);
  return [0.6 + (1.8 + m * 0.6) * d * Math.cos(v * 26), -4.6 + 0.6 * d * Math.sin(v * 26)];
}

function slingRelease(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0, k = K(b);
  const A = slingAimP(b, 0, m);
  // the snap: the draw hand flies open past the ear, the bow arm and the fork follow through
  const snap = (): Pose => {
    const p = slingAimP(b, 0, m);
    const n = neck(b, p);
    p.fa = { ik: [n[0] - lerp(0.2, 1.4, m), n[1] + lerp(1.4, 2.8, m)], hand: 'open', flip: true };
    if (p.ba.ik) p.ba = { ...p.ba, ik: add2(p.ba.ik, 0.9, -lerp(0.4, 1.0, m)) };
    p.hip = add2(p.hip, -0.25 * k, -0.15 * k);
    p.flags = { ...p.flags, fa: lerp(0.2, 0.42, m), hair: m };
    if (!m) p.lean -= 0.06; // Mori flinches
    return p;
  };
  const follow = (): Pose => {
    const p = snap();
    if (p.ba.ik) p.ba = { ...p.ba, ik: add2(p.ba.ik, -0.4, -0.9) };
    if (p.fa.ik) p.fa = { ...p.fa, ik: add2(p.fa.ik, 0.3, -0.6) };
    p.flags = { ...p.flags, fa: 0.18, hair: 0 };
    return p;
  };
  // the reload: the draw hand down to the kete (or a pocket), a stone up to the hanging pouch
  const kete = (): Pose => {
    const p = follow();
    p.fa = { ik: [p.hip[0] + 1.6, p.hip[1] + 1.2], hand: 'pinch' };
    p.front = undefined;
    p.flags = { ...p.flags, zN: lerp(2.6, 4.4, m), fa: 0.22 };
    return p;
  };
  const meet = (): Pose => {
    const p = mixPose(follow(), slingReadyP(b, 0, m), 0.75);
    if (p.ba.ik) p.fa = { ik: add2(p.ba.ik, -1.4, -3.4), hand: 'pinch' };
    p.front = undefined;
    p.flags = { ...p.flags, zN: 0.6 };
    return p;
  };
  let p: Pose;
  if (m) p = chain(t, [[0, () => A], [0.035, () => A], [0.075, snap, easeOut], [0.3, follow, smooth], [0.42, follow], [0.56, kete, smooth], [0.76, meet, smooth], [0.92, () => slingReadyP(b, 0, m), smooth], [1, () => slingReadyP(b, 0, m)]]);
  else p = chain(t, [[0, () => A], [0.05, () => A], [0.11, snap, easeOut], [0.34, follow, smooth], [0.46, follow], [0.62, kete, smooth], [0.82, meet, smooth], [1, () => slingReadyP(b, 0, m), smooth]]);
  const f = p.flags ?? (p.flags = {});
  const rel = m ? 0.05 : 0.08, back = m ? 0.74 : 0.8;
  if (t >= rel && t < back) {
    // the pouch is free: through the fork, the recoil past it, the flick over, the swing
    const [pf, pu] = pouchFree(t - rel, m);
    f.po = 1; f.pf = pf; f.pu = pu;
    // the stone: a streak off the fork for the first frames, then gone; a fresh one from the kete
    const fl = t - rel;
    if (fl < 0.06) { f.st = 3; f.s0 = 2 + fl * 420; f.s1 = 10 + fl * 760; } else f.st = t > (m ? 0.52 : 0.58) ? 2 : 0;
  } else if (t >= back) { f.po = 0; f.st = 1; }
  return p;
}

/**
 * The standoff on the beach: k 0 (the slingshot lowered at her side, the pouch hanging) .. 1 (full
 * draw at Mori's face). Frames step k; the story holds a frame (holdFrame) and nudges it with her nerves.
 */
function slingStandoff(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0, k = K(b);
  const lowered = (): Pose => {
    const p = stand(b, { lean: 0.04, hip: [0.2 * k, b.hipH - 0.6 * k] });
    p.fl = { f: [-2.6 * k, b.ankleH], fa: 0 };
    p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.ba = { ik: add2(s, 3.2, -14.8), hand: 'grip' };
    p.fa = { ik: [p.hip[0] + 0.6 * k, p.hip[1] + 2.5 * k], hand: 'fist' };
    p.hd = [0.3 * k, -0.2 * k];
    p.flags = { yaw: 0.9, zN: 3.2, zF: -1.6, sl: 1, fa: 0.9, po: 2, st: 1, fs: m, hair: 0 };
    return p;
  };
  const half = (): Pose => {
    // bands slack, the slingshot held low across her body, aimed at the sand
    const p = slingReadyP(b, 0, m);
    const s = shoulder(b, p.hip, p.lean);
    p.ba = { ik: add2(s, 6.6, -9.4), hand: 'grip' };
    p.fa = { ik: add2(s, 3.6, -10.6), hand: 'pinch' };
    p.flags = { ...p.flags, fa: 0.75 };
    return p;
  };
  const lowAim = (): Pose => {
    // drawn, the aim dipped to Mori's chest
    const p = slingAimP(b, 0, m);
    if (p.ba.ik) p.ba = { ...p.ba, ik: add2(p.ba.ik, -0.6, -3.6) };
    if (p.fa.ik) p.fa = { ...p.fa, ik: add2(p.fa.ik, 1.4, -1.6) };
    p.flags = { ...p.flags, fa: 0.25 };
    return p;
  };
  return chain(t, [[0, lowered], [0.3, half], [0.62, lowAim], [1, () => slingAimP(b, 0, m)]]);
}

/** the slingshot out of the back of her belt (u 0 → 1) or back in (1 → 0), from a plain standing pose */
function unholster(b: Build, u: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0, k = K(b);
  const from = (): Pose => {
    const p = stand(b, { lean: 0.04, hip: [0, b.hipH - 0.4 * k] });
    p.fl = { f: [-2.2 * k, b.ankleH], fa: 0 };
    p.bl = { f: [2.4 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 1.0, -14.6), hand: 'relax' };
    p.ba = { ik: add2(s, 0.6, -14.6), hand: 'relax' };
    p.flags = { yaw: 0.95, zN: 3.0, zF: -2.6 };
    return p;
  };
  const reach = (): Pose => {
    // the bow hand round to the small of her back, where the fork sticks up out of the belt
    const p = from();
    p.ba = { ik: [p.hip[0] - 3.6, p.hip[1] + 2.4], hand: 'grip' };
    p.lean = 0.1;
    p.flags = { ...p.flags, zF: -1.0, sl: 1, po: 2, st: 0, fa: -0.4 };
    return p;
  };
  const p = u < 0.4 ? mixPose(from(), reach(), smooth(u / 0.4)) : mixPose(reach(), slingReadyP(b, 0, m), easeOut((u - 0.4) / 0.6));
  if (u < 0.32 && p.flags) { delete p.flags.sl; delete p.flags.po; delete p.flags.st; }
  return p;
}

/** palms out, patting the air: "easy, easy" (the standoff); t loops the pats */
function placate(b: Build, t: number): Pose {
  const k = K(b), pat = Math.sin(TAU * t * 2) * 0.5 + 0.5;
  const p = stand(b, { lean: -0.04, hip: [-0.4 * k, b.hipH - 0.3 * k] });
  p.fl = { f: [-2.0 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, 7.2, -3.4 - pat * 0.9), hand: 'open' };
  p.ba = { ik: add2(s, 6.4, -2.6 - pat * 0.7), hand: 'open' };
  p.hd = [-0.2 * k, -0.2 * k];
  p.flags = { yaw: 0.9, zN: 2.6, zF: -1.6 };
  return p;
}

// ------------------------------------------------------------------ the grenade

function grenadeThrow(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.5, k = K(b);
  const R = endP(b, id);
  const pluck = (): Pose => {
    // the draw hand down to the kete for a firestone bundle, the bow hand keeps the slingshot up
    const p = carry(endP(b, id), id);
    p.fa = { ik: [p.hip[0] + 1.6, p.hip[1] + 1.4], hand: 'grip' };
    p.flags = { ...p.flags, zN: 4.2, gr: 1, gg: 0.2 };
    return p;
  };
  const windup = (): Pose => {
    // weight back, the throwing hand cocked back past the ear, the other arm pointing the way
    const p = stand(b, { lean: -0.12 * m, hip: [-2.2 * k, b.hipH - 1.6 * k] });
    p.fl = { f: [-3.6 * k, b.ankleH], fa: 0 };
    p.bl = { f: [2.2 * k, b.ankleH + 1.4 * k * m], fa: 0.2 };
    const n = neck(b, p), s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [n[0] - 7.4, n[1] + 1.6], hand: 'grip', flip: true };
    p.ba = { ik: add2(s, 12.8, 0.6), hand: 'grip' };
    p.hd = [0.2 * k, 0];
    p.flags = { yaw: lerp(0.6, 0.4, m), zN: 3.4, zF: 0.2, gr: 1, gg: 1, hair: 1 };
    return carry(p, id, 0.1);
  };
  const whip = (): Pose => {
    // the step in, the hips and shoulders driving round, the arm over the top: release
    const p = stand(b, { lean: 0.32 * m + 0.1, hip: [1.6 * k, b.hipH - 2.2 * k] });
    p.fl = { f: [-3.8 * k, b.ankleH + 0.6 * k], fa: -0.5 };
    p.bl = { f: [5.2 * k, b.ankleH], fa: 0 };
    const n = neck(b, p), s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [n[0] + 9.6, n[1] + 3.4], hand: 'open' };
    p.ba = { ik: add2(s, 2.2, -8.4), hand: 'grip' };
    p.front = ['armF'];
    p.hd = [0.6 * k, -0.4 * k];
    p.flags = { yaw: 1.15, zN: 1.6, zF: -1.2, gg: 1, hair: 2 };
    return carry(p, id, 0.6);
  };
  const follow = (): Pose => {
    // the arm sweeps down across her body, the back leg comes through
    const p = stand(b, { lean: 0.48 * m + 0.12, hip: [2.4 * k, b.hipH - 2.6 * k] });
    p.fl = { f: [-0.6 * k, b.ankleH + 3.6 * k * m], fa: -0.9 };
    p.bl = { f: [4.8 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 3.0, -12.2), hand: 'open' };
    p.ba = { ik: add2(s, -1.6, -9.0), hand: 'grip' };
    p.hd = [0.5 * k, 0.2 * k];
    p.flags = { yaw: 1.2, zN: -0.6, zF: -2.2, hair: 1 };
    return carry(p, id, 0.8);
  };
  const p = chain(t, [[0, () => R], [0.16, pluck, smooth], [0.4, windup, easeOut], [0.52, whip, easeIn], [0.74, follow, easeOut], [1, () => R, smooth]]);
  const f = p.flags ?? (p.flags = {});
  if (t > 0.08 && t < 0.52) { f.gr = 1; f.gg = t < 0.26 ? seg(t, 0.12, 0.26) : 0.8 + 0.2 * Math.sin(t * 90); } else delete f.gr;
  return p;
}

// ------------------------------------------------------------------ agility

/** a tight tuck around its centre (ground space, upright: rotate with spin), m: how tight / high */
function tuckP(b: Build, com: P2, m: number): Pose {
  const T = b.torso, lean = 0.62;
  const hip: P2 = add2(com, -Math.sin(lean) * T * 0.42, -Math.cos(lean) * T * 0.42);
  const p = stand(b, { lean, hip });
  p.fl = { f: add2(hip, 3.2, -0.9), fa: -0.4 };
  p.bl = { f: add2(hip, 3.8, -0.4), fa: -0.4 };
  // hands round the shins
  p.fa = { ik: add2(hip, 5.6, 4.6), hand: 'grip' };
  p.ba = { ik: add2(hip, 6.2, 5.2), hand: 'grip' };
  p.hd = [1.2, -1.4];
  p.look = 'down';
  p.sq = 0.96;
  p.flags = { yaw: 0.8, zN: 1.6 + (1 - m), zF: -1.6, hair: 2 };
  return p;
}
/** stretched out long around its centre: arms overhead, legs straight, toes pointed */
function stretchP(b: Build, com: P2, armsUp = 1): Pose {
  const hip: P2 = add2(com, 0, -b.torso * 0.36);
  const p = stand(b, { lean: -0.05, hip });
  const L = b.thigh + b.shin - 0.6;
  p.fl = { f: add2(hip, -0.6, -L), fa: -0.9 };
  p.bl = { f: add2(hip, 0.6, -L + 0.4), fa: -0.9 };
  const s = shoulder(b, hip, -0.05);
  // (overhead the elbows point back and out, never across the face)
  p.fa = { ik: L2(add2(s, 4, -8), add2(s, -1.6, 13.6), armsUp), hand: 'open', flip: armsUp > 0.5 };
  p.ba = { ik: L2(add2(s, 4.6, -7), add2(s, 2.4, 13.8), armsUp), hand: 'open', flip: armsUp > 0.5 };
  p.flags = { yaw: 0.8, zN: lerp(2.2, 5.2, armsUp), zF: lerp(-2.2, -4.4, armsUp), hair: 2 };
  return p;
}
/** a deep crouch, coiled to spring (lean forward, arms swung down and back) */
function coilP(b: Build, depth: number, armsBack: number, lean = 0.38): Pose {
  const k = K(b);
  const p = stand(b, { lean, hip: [-1.4 * k, b.hipH * depth] });
  p.fl = { f: [-2.4 * k, b.ankleH], fa: -0.2 };
  p.bl = { f: [2.2 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, lean);
  p.fa = { ik: L2(add2(s, 4, -9), add2(p.hip, -7.0, 2.0), armsBack), hand: 'open' };
  p.ba = { ik: L2(add2(s, 5, -8), add2(p.hip, -6.2, 2.8), armsBack), hand: 'open' };
  p.sq = 0.97;
  p.flags = { yaw: 0.8, zN: 2.6, zF: -2.4 };
  return p;
}

function flipBack(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.55, k = K(b);
  const t0 = 0.24, t1 = 0.76;
  const H = lerp(10, 20, m), y0 = b.hipH + b.torso * 0.36 + 1;
  if (t < t0) {
    // the crouch, then the explosive extension: arms swing up, up onto the toes
    const p = t < 0.13 ? mixPose(endP(b, id), coilP(b, lerp(0.7, 0.56, m), 1, 0.36), easeOut(t / 0.13)) : mixPose(coilP(b, lerp(0.7, 0.56, m), 1, 0.36), stretchP(b, [0, y0], 1), easeIn((t - 0.13) / (t0 - 0.13)));
    return carry(p, id, -0.2);
  }
  if (t < t1) {
    // airborne: the tuck rolls her backward through a full turn, the centre on a parabola
    const u = (t - t0) / (t1 - t0);
    const com: P2 = [-1.0 * k * u, y0 + 4 * H * u * (1 - u) - u * 2.5];
    const tk = smooth(u / 0.22) * (1 - smooth((u - 0.72) / 0.24));
    const p = mixPose(stretchP(b, com, 1 - smooth(u / 0.3) * 0.6), tuckP(b, com, m), tk);
    const phi = TAU * (u < 0.5 ? 0.5 * Math.pow(u / 0.5, 1.6) : 1 - 0.5 * Math.pow((1 - u) / 0.5, 1.6));
    return carry(spin(p, com, phi, tk * 0.35), id, -0.4);
  }
  // touch down: absorb deep, then up on guard with a little overshoot
  const land = (): Pose => {
    const p = coilP(b, lerp(0.66, 0.5, m), 0.2, 0.42);
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 6.4, -6.0), hand: 'open' };
    p.ba = { ik: add2(s, 8.0, -3.4), hand: 'grip' };
    p.flags = { ...p.flags, zN: 2.4, zF: -1.6, hair: 1 };
    return carry(p, id);
  };
  const touch = (): Pose => {
    // the feet find the ground: knees already giving, arms out for balance
    const p = stretchP(b, [-1.0 * k, y0 - 3.4], 0.25);
    p.fl = { f: add2(p.hip, -1.6, -(b.thigh + b.shin) + 2.6), fa: -0.2 };
    p.bl = { f: add2(p.hip, 2.4, -(b.thigh + b.shin) + 2.9), fa: -0.1 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, -5.4, -1.0), hand: 'open' };
    p.ba = { ik: add2(s, 7.6, -0.6), hand: 'grip' };
    p.flags = { ...p.flags, zN: 3.6, zF: -1.2, hair: 2 };
    return carry(p, id);
  };
  if (t < 0.86) return mixPose(touch(), land(), easeOut((t - t1) / (0.86 - t1)));
  return mixPose(land(), endP(b, id), backOut((t - 0.86) / 0.14, 0.8 * m));
}

function dashStrike(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.55, k = K(b);
  const coil = (): Pose => {
    const p = stand(b, { lean: -0.06, hip: [-2.2 * k, b.hipH - 3.2 * k * m - 0.6 * k] });
    p.fl = { f: [-3.8 * k, b.ankleH], fa: -0.3 };
    p.bl = { f: [3.0 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, -2.6, -6.6), hand: 'fist' };
    p.ba = { ik: add2(s, 4.6, -4.4), hand: 'grip' };
    p.hd = [0.5 * k, -0.4 * k];
    p.flags = { yaw: 0.75, zN: 2.4, zF: -0.6, hair: 0 };
    return carry(p, id);
  };
  const smear = (): Pose => {
    // the dash: very low, long and stretched, the back leg trailing straight, arms swept back
    const lean = lerp(0.5, 0.86, m);
    const p = stand(b, { lean, hip: [2.6 * k, b.hipH - lerp(2.6, 5.6, m) * k] });
    p.fl = { f: [-lerp(5.5, 9.4, m) * k, b.ankleH + 0.5 * k], fa: -1.0 };
    p.bl = { f: [lerp(4.0, 5.6, m) * k, b.ankleH], fa: 0.1 };
    p.fa = { ik: add2(p.hip, -7.6, 3.6), hand: 'flat' };
    p.ba = { ik: add2(p.hip, -6.4, 5.0), hand: 'grip' };
    p.hd = [1.0 * k, -0.2 * k];
    p.sq = 1 + 0.06 * m;
    p.flags = { yaw: 0.72, zN: 3.0, zF: -2.6, hair: 2 };
    return carry(p, id, -0.9);
  };
  const kick = (): Pose => {
    // airborne snap kick: the near leg shoots out at chest height, the other tucked, leaning back to it
    const p = stand(b, { lean: -0.32 * m, hip: [1.2 * k, b.hipH + lerp(0.5, 2.6, m) * k] });
    const L = b.thigh + b.shin - 0.4;
    p.fl = { f: add2(p.hip, L * 0.96, L * 0.22), fa: 0.2 };
    p.bl = { f: add2(p.hip, -2.4, -8.8), fa: -0.8 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, -6.8, -3.8), hand: 'fist' };
    p.ba = { ik: add2(s, 6.4, -1.4), hand: 'grip' };
    p.hd = [0.7 * k, 0];
    p.flags = { yaw: 0.68, zN: 2.0, zF: -0.2, hair: 2 };
    return carry(p, id, 0.2);
  };
  const chamber = (): Pose => {
    // the knee driving up just before the snap
    const p = kick();
    p.fl = { f: add2(p.hip, 6.4, 1.6), fa: -0.5 };
    p.hip = add2(p.hip, 0, -1.2 * k);
    return p;
  };
  const land = (): Pose => {
    const p = stand(b, { lean: 0.26, hip: [0, b.hipH - 3.4 * k * m] });
    p.fl = { f: [3.2 * k, b.ankleH], fa: 0 };
    p.bl = { f: [-3.0 * k, b.ankleH], fa: -0.3 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 3.6, -6.4), hand: 'fist' };
    p.ba = { ik: add2(s, 6.8, -3.6), hand: 'grip' };
    p.flags = { yaw: 0.8, zN: 1.8, zF: -0.6, hair: 1 };
    return carry(p, id);
  };
  return chain(t, [
    [0, () => endP(b, id)], [0.1, coil, easeOut], [0.2, smear, easeIn], [0.33, smear], [0.4, chamber, smooth], [0.46, kick, easeOut], [0.52, kick],
    [0.66, land, smooth], [1, () => endP(b, id), (u: number) => backOut(u, 0.6 * m)],
  ]);
}

function roll(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.6, k = K(b);
  const t0 = 0.14, t1 = 0.7;
  const dive = (): Pose => {
    // into it: a step, low, hands reaching for the ground, chin tucked
    const p = stand(b, { lean: 0.82, hip: [1.6 * k, b.hipH * 0.58] });
    p.fl = { f: [-3.2 * k, b.ankleH], fa: -0.5 };
    p.bl = { f: [3.0 * k, b.ankleH], fa: 0 };
    p.fa = { ik: [p.hip[0] + 11.6, 3.4], hand: 'flat' };
    p.ba = { ik: [p.hip[0] + 12.4, 3.8], hand: 'grip' };
    p.look = 'down';
    p.hd = [1.2, -1.0];
    p.flags = { yaw: 0.8, zN: 1.8, zF: -1.4, hair: 1 };
    return carry(p, id, 0.9);
  };
  const r = b.torso * 0.52;
  if (t < t0) return mixPose(endP(b, id), dive(), easeOut(t / t0));
  if (t < t1) {
    const u = (t - t0) / (t1 - t0);
    // rolling forward over her shoulder: the ball turns once, low to the ground
    const phi = -TAU * smooth(u);
    // over the shoulders: the centre rides up while she's upside down, so the tucked head clears the sand
    const inv = Math.pow(clamp01((0.55 - Math.cos(phi)) / 1.55), 0.8);
    const com: P2 = [2.0 * k, lerp(b.hipH * 0.58 + 3, r, smooth(u / 0.25)) + inv * 17.5 + smooth((u - 0.8) / 0.2) * 1.5];
    const p = u < 0.12 ? mixPose(dive(), tuckP(b, com, m), u / 0.12) : tuckP(b, com, m);
    return carry(spin(p, com, phi, 0.35 * Math.sin(Math.PI * u)), id, 0.2);
  }
  const up = (): Pose => {
    // up out of it onto one knee and a foot, a hand still down
    const p = stand(b, { lean: 0.5, hip: [0.6 * k, b.hipH * 0.48] });
    p.fl = { f: [-4.4 * k, 1.1 * k], fa: -1.1 };
    p.bl = { f: [3.6 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [p.hip[0] + 6.4, 3.2], hand: 'flat' };
    p.ba = { ik: add2(s, 7.2, -5.0), hand: 'grip' };
    p.flags = { yaw: 0.8, zN: 2.2, zF: -1.0, hair: 1 };
    return carry(p, id);
  };
  if (t < 0.84) return mixPose(tuckP(b, [2.0 * k, r], m), up(), smooth((t - t1) / (0.84 - t1)));
  return mixPose(up(), endP(b, id), backOut((t - 0.84) / 0.16, 0.7 * m));
}

function landCrouch(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.6, k = K(b);
  const contact = (): Pose => {
    const p = stand(b, { lean: 0.06, hip: [0, b.hipH - 0.2 * k] });
    p.fl = { f: [-1.8 * k, b.ankleH], fa: -0.3 };
    p.bl = { f: [2.0 * k, b.ankleH], fa: -0.2 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 3.4, 4.6), hand: 'open' };
    p.ba = { ik: add2(s, 5.0, 3.8), hand: 'grip' };
    p.flags = { yaw: 0.85, zN: 4.0, zF: -2.6, hair: 2 };
    return carry(p, id);
  };
  const impact = (): Pose => {
    // the landing: back knee nearly down, fingertips to the sand, the other arm back for balance
    const p = stand(b, { lean: lerp(0.36, 0.5, m), hip: [-0.6 * k, b.hipH * lerp(0.56, 0.44, m)] });
    p.fl = { f: [-4.8 * k, 1.3 * k], fa: -1.1 };
    p.bl = { f: [4.0 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [p.hip[0] + 7.6, 2.9], hand: 'flat' };
    p.ba = { ik: add2(s, -6.6, 1.6 * m), hand: 'grip' };
    p.hd = [0.4 * k, 0.4 * k];
    p.sq = 1 - 0.07 * m;
    p.look = 'fwd';
    p.flags = { yaw: 0.8, zN: 2.2, zF: -2.8, hair: 1 };
    return carry(p, id, -0.2);
  };
  const settle = (): Pose => { const p = impact(); p.hip = add2(p.hip, 0, 0.5 * k); p.sq = 1; p.flags = { ...p.flags, hair: 0 }; return p; };
  return chain(t, [[0, contact], [0.16, impact, easeOut], [0.42, settle, smooth], [0.54, settle], [1, () => endP(b, id), (u: number) => backOut(u, 0.9 * m)]]);
}

/** the vault's obstacle, ahead of where the move starts: front edge, back edge, top (world px) */
export const VAULT = { x0: 18, x1: 30, top: 13 };

function vault(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.6, k = K(b);
  // ground-space x of something fixed in the world, at this moment of the move (the actor travels)
  const yaw = 0.62, ca = Math.cos(yaw), cl = Math.cos(yaw * 0.5);
  const R = rootOf('vault', t, m);
  const handX = ((VAULT.x0 + VAULT.x1) / 2 - R) / ca;
  const plant = (): Pose => {
    // the last step: the take-off foot plants, she leans in, both hands reach for the top
    const p = stand(b, { lean: 0.42, hip: [0, b.hipH - 1.8 * k] });
    p.fl = { f: [(8 - R) / cl, b.ankleH], fa: 0 };
    p.bl = { f: [-3.2 * k, b.ankleH + 1.6 * k], fa: -0.6 };
    p.fa = { ik: [handX - 1.0, VAULT.top + 3.6], hand: 'flat' };
    p.ba = { ik: [handX + 0.6, VAULT.top + 3.8], hand: 'grip' };
    p.flags = { yaw, zN: 1.6, zF: -1.0, hair: 1 };
    return carry(p, id, 0.6);
  };
  const over = (): Pose => {
    // hands on top, hips up over them, legs tucked up and through
    const p = stand(b, { lean: 0.55, hip: [handX - 4.0, VAULT.top + lerp(14, 17, m)] });
    p.fl = { f: add2(p.hip, 7.6, -5.6), fa: -0.4 };
    p.bl = { f: add2(p.hip, 6.6, -6.6), fa: -0.4 };
    p.fa = { ik: [handX - 0.6, VAULT.top + 1.6], hand: 'flat' };
    p.ba = { ik: [handX + 0.8, VAULT.top + 1.8], hand: 'grip' };
    p.look = 'down';
    p.flags = { yaw, zN: 1.4, zF: -0.8, hair: 2 };
    return carry(p, id, 0.4);
  };
  const reach = (): Pose => {
    // pushing off, the legs reaching down for the far side
    const p = stand(b, { lean: 0.12, hip: [1.6 * k, b.hipH + 3.4 * k] });
    p.fl = { f: add2(p.hip, 8.6, -21.0), fa: 0.1 };
    p.bl = { f: add2(p.hip, 2.4, -19.6), fa: -0.3 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, -3.4, -2.0), hand: 'open' };
    p.ba = { ik: add2(s, 6.8, -2.6), hand: 'grip' };
    p.flags = { yaw: 0.75, zN: 2.6, zF: -0.6, hair: 2 };
    return carry(p, id);
  };
  const land = (): Pose => {
    const p = stand(b, { lean: 0.3, hip: [0.6 * k, b.hipH - 2.6 * k] });
    p.fl = { f: [3.4 * k, b.ankleH], fa: 0 };
    p.bl = { f: [-3.6 * k, b.ankleH + 1.2 * k], fa: -0.5 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, -1.6, -6.8), hand: 'flat' };
    p.ba = { ik: add2(s, 6.6, -4.2), hand: 'grip' };
    p.flags = { yaw: 0.8, zN: 2.4, zF: -0.6, hair: 1 };
    return carry(p, id);
  };
  return chain(t, [[0, () => endP(b, id)], [0.16, plant, smooth], [0.42, over, easeOut], [0.6, reach, smooth], [0.76, land, easeOut], [1, () => endP(b, id), smooth]]);
}

function dodge(b: Build, t: number, id: string): Pose {
  const m = isAroha(id) ? 1 : 0.6, k = K(b);
  const flinch = (): Pose => {
    const p = stand(b, { lean: 0.16, hip: [0, b.hipH - 1.4 * k] });
    p.fl = { f: [-2.4 * k, b.ankleH], fa: 0 };
    p.bl = { f: [2.4 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 4.8, -2.6), hand: 'open' };
    p.ba = { ik: add2(s, 5.6, -1.6), hand: 'grip' };
    p.flags = { yaw: 0.85, zN: 1.6, zF: -0.4, hair: 0 };
    return carry(p, id);
  };
  const sway = (): Pose => {
    // the snap back: off the ground, swaying away hard, the guard up in front of her face
    const p = stand(b, { lean: -0.62 * m, hip: [-2.6 * k, b.hipH + 1.8 * k * m] });
    p.fl = { f: [-3.6 * k, b.ankleH + 1.6 * k], fa: -0.5 };
    p.bl = { f: [4.6 * k, b.ankleH + 3.4 * k * m], fa: 0.4 };
    const s = shoulder(b, p.hip, p.lean), n = neck(b, p);
    p.fa = { ik: add2(s, -5.4, -4.6), hand: 'open' };
    p.ba = { ik: add2(s, 5.0, -2.4), hand: 'grip' };
    void n;
    p.hd = [-0.6 * k, 0];
    p.flags = { yaw: 0.8, zN: 3.0, zF: 0.4, hair: 2 };
    return carry(p, id, -0.5);
  };
  const low = (): Pose => {
    const p = stand(b, { lean: 0.24, hip: [-0.6 * k, b.hipH - lerp(2.0, 3.8, m) * k] });
    p.fl = { f: [-3.6 * k, b.ankleH], fa: -0.3 };
    p.bl = { f: [3.2 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 3.2, -6.6), hand: 'open' };
    p.ba = { ik: add2(s, 6.8, -3.2), hand: 'grip' };
    p.flags = { yaw: 0.8, zN: 2.0, zF: -0.4, hair: 1 };
    return carry(p, id);
  };
  return chain(t, [[0, () => endP(b, id)], [0.08, flinch, easeOut], [0.3, sway, easeOut], [0.52, low, easeIn], [1, () => endP(b, id), (u: number) => backOut(u, 0.8 * m)]]);
}

// ------------------------------------------------------------------ root motion and events

/**
 * How a move travels and when its moments land, for whoever moves the Actor (src/game/v11/moves.ts):
 * dx is world px toward facing (negative: backward) over the whole clip, `at(t)` the share of it done
 * at clip time t (0..1). Events are clip times: release (a shot or a throw leaves the hand), hit (the
 * strike lands), air / land (feet leave and touch the ground).
 */
export interface Move7 { dx: number; at(t: number): number; release?: number; hit?: number; air?: number; land?: number }
const span = (a: number, b: number, e: (u: number) => number = smooth) => (t: number) => e(seg(t, a, b));
export const COMBAT_MOVES7: Record<string, Move7> = {
  slingReady: { dx: 0, at: () => 0 },
  slingDraw: { dx: -1, at: span(0.1, 0.7) },
  slingAim: { dx: 0, at: () => 0 },
  slingRelease: { dx: 0, at: () => 0, release: 0.05 },
  slingStandoff: { dx: 0, at: () => 0 },
  grenadeThrow: { dx: 6, at: span(0.38, 0.7), release: 0.52 },
  flipBack: { dx: -40, at: span(0.2, 0.8), air: 0.24, land: 0.76 },
  dashStrike: { dx: 60, at: (t: number) => 0.75 * easeOut(seg(t, 0.12, 0.42)) + 0.25 * smooth(seg(t, 0.4, 0.66)), hit: 0.46, air: 0.4, land: 0.62 },
  roll: { dx: 46, at: span(0.06, 0.82) },
  landCrouch: { dx: 3, at: span(0, 0.3, easeOut), land: 0 },
  vault: { dx: 52, at: span(0.04, 0.86, (u: number) => u * (0.85 + 0.15 * u)), air: 0.36, land: 0.74 },
  dodge: { dx: -28, at: span(0.06, 0.5, easeOut), air: 0.16, land: 0.48 },
};
/** the plainer versions travel less */
const PLAIN_DX: Record<string, number> = { flipBack: 0.55, dashStrike: 0.6, roll: 0.75, vault: 0.85, dodge: 0.7 };
/** world px a move has travelled at clip time t (toward facing) for this character */
export function rootMotion7(id: string, anim: string, t: number): number {
  const mv = COMBAT_MOVES7[anim];
  if (!mv) return 0;
  return mv.dx * mv.at(clamp01(t)) * (isAroha(id) ? 1 : PLAIN_DX[anim] ?? 1);
}
function rootOf(anim: string, t: number, m: number): number {
  const mv = COMBAT_MOVES7[anim];
  return mv ? mv.dx * mv.at(clamp01(t)) * (m >= 1 ? 1 : PLAIN_DX[anim] ?? 1) : 0;
}

// ------------------------------------------------------------------ registration

const A7 = (frames: number, fps: number, loop = false): AnimInfo7 => ({ frames, fps, loop });
type Fn = (b: Build, t: number, id: string) => Pose;
const CLIPS: [string, AnimInfo7, Fn, AnimInfo7?][] = [
  // name, everyone's timing, the pose, Aroha's own (faster) timing
  ['slingReady', A7(16, 9, true), (b, t, id) => slingReadyP(b, t, isAroha(id) ? 1 : 0), A7(16, 10, true)],
  ['slingDraw', A7(10, 18), slingDraw, A7(10, 24)],
  ['slingAim', A7(16, 7, true), slingAim, A7(16, 8, true)],
  ['slingRelease', A7(18, 20), slingRelease, A7(20, 28)],
  ['slingStandoff', A7(21, 8), slingStandoff],
  ['slingUnholster', A7(6, 18), (b, t, id) => unholster(b, t, id), A7(6, 26)],
  ['slingHolster', A7(6, 18), (b, t, id) => unholster(b, 1 - t, id), A7(6, 24)],
  ['slingshot', A7(18, 20), slingRelease, A7(20, 28)],
  ['grenadeThrow', A7(18, 20), grenadeThrow, A7(18, 24)],
  ['flipBack', A7(18, 20), flipBack, A7(18, 26)],
  ['dashStrike', A7(16, 20), dashStrike, A7(16, 24)],
  ['roll', A7(14, 18), roll, A7(14, 24)],
  ['landCrouch', A7(12, 18), landCrouch, A7(12, 24)],
  ['vault', A7(16, 20), vault, A7(16, 24)],
  ['dodge', A7(10, 20), dodge, A7(10, 24)],
];
// (holding a stance, talking doesn't drop it: the bubble's talk clip is the stance itself)
const HOLD = new Set(['slingReady', 'slingAim', 'slingStandoff']);
for (const [name, info, fn, own] of CLIPS) {
  if (HOLD.has(name)) { info.talk = name; if (own) own.talk = name; }
  registerAnim7(name, info, fn);
  if (own) registerOwn7('aroha', name, { info: own, pose: (b, t) => fn(b, t, 'aroha') });
}
// palms out, patting the air (anyone)
registerAnim7('placate', { ...A7(8, 6, true), talk: 'placate' }, (b, t) => placate(b, t));

// ------------------------------------------------------------------ the props, in 3D in the hand

/** stripped mānuka: pale honey wood that reads against skin and the red rubber */
const WOOD: Ramp6 = R6('#3a2410', '#6e4a26', '#9a7040', '#c49a62', '#dcb882', '#f2d8a8');
const BARK: Ramp6 = R6('#1a1410', '#342a22', '#4e4234', '#665a48', '#7e735e', '#9a8e78');
const RUBBER = { slack: hex('#4a1410'), base: hex('#7a2018'), taut: hex('#b8443a'), hi: hex('#d86a52') };
const STONE: Ramp6 = R6('#1a1a1e', '#34343a', '#55555c', '#76767e', '#9a9aa2', '#c4c4ca');
const FIRE = { edge: hex('#8a2a0e'), core: hex('#ff8a2a'), hot: hex('#ffd060'), white: hex('#fff6d0') };
const GS = 17; // the prop's ink group

/** the fist's centre, along the forearm (a: in hand units past the wrist) */
const along = (wr: V3, el: V3, a: number, k: number): V3 => vadd(wr, vsc(vnorm(vsub(wr, el)), a * k));

function stoneMat(fs: number) {
  return (h: Hit): C => {
    if (fs) return h.l > 0.55 ? FIRE.white : h.l > 0.1 ? FIRE.hot : h.n[2] > 0.4 ? FIRE.core : FIRE.edge;
    return cel(STONE, h.l, 0.1, true);
  };
}

function drawCombatProps(s: Scene3D, J: J3, P: Pose, ch: Char7): ((back: PixelBuffer, front: PixelBuffer) => void) | void {
  const f = P.flags;
  if (!f) return;
  const k = ch.hand, posts: ((back: PixelBuffer, front: PixelBuffer) => void)[] = [];
  const high = (p: V3, d = 6) => (p[1] > J.neckTop[1] - d ? 1 : 0);
  const yaw = J.yaw;
  // the aim (the body's forward, level), up, and the fork's spread (canted toward the camera so the Y reads)
  const A: V3 = [Math.cos(yaw), 0, Math.sin(yaw)];
  const lat: V3 = [-Math.sin(yaw), 0, Math.cos(yaw)];
  // (a canted grip, the way slingers hold it: one prong a little higher, so both bands show)
  const S = vnorm(vadd(vsc(lat, 0.8), [-0.62, 0.42, 0]));
  const layer0 = s.layer;
  if (f.sl) {
    const tilt = f.fa ?? 0;
    const U = vnorm(vadd(vsc([0, 1, 0], Math.cos(tilt)), vsc(A, Math.sin(tilt))));
    const G = along(J.wrF, J.elF, 1.85, k);
    const C = vadd(G, vsc(U, 2.0));
    const tip = (z: number) => vadd(C, vadd(vsc(U, 3.3), vsc(S, z * 2.0)));
    s.layer = high(C, 7);
    const wood = (h: Hit) => cel(WOOD, h.l, 0.05);
    // the handle through her fist, a flax lashing under the fork
    s.limb(vsub(G, vsc(U, 2.4)), C, 0.64, 0.68, GS, h => (h.t > 0.66 && h.t < 0.9 ? cel(PAL.flax, h.l, Math.floor(h.t * 14) % 2 ? 0.2 : -0.15) : cel(BARK, h.l, 0)));
    // the two prongs, curving out and up
    for (const z of [1, -1]) {
      const mid = vadd(C, vadd(vsc(U, 1.5), vsc(S, z * 1.45)));
      s.limb(C, mid, 0.6, 0.54, GS, wood);
      s.limb(mid, tip(z), 0.54, 0.46, GS, wood);
      s.ellipsoid(vadd(tip(z), vsc(U, -0.3)), vsc(U, 0.34), vsc(S, 0.42), vsc(A, 0.42), GS, h => cel(R6('#160606', '#2a0c0a', '#40140e', '#561c14', '#6e2a1e', '#8a3a2a'), h.l, 0));
    }
    // the pouch: pinched in the draw hand, or free (whipping, swinging, hanging) off the fork
    let pouch: V3;
    if (f.po === 1 || f.po === 2) pouch = vadd(C, vadd(vsc(A, f.pf ?? 0.5), vsc(U, f.pu ?? -4.4)));
    else pouch = along(J.wrN, J.elN, 2.55, k);
    s.layer = high(pouch, 7);
    s.ellipsoid(pouch, vsc(A, 0.6), vsc(U, 0.8), vsc(S, 1.1), GS, h => cel(PAL.leather, h.l, 0.12));
    if (f.st === 1) s.ellipsoid(vadd(pouch, vadd(vsc(A, -0.15), [0, 0, 0.4])), vsc(A, 0.62), [0, 0.62, 0], vsc(S, 0.62), GS + 1, stoneMat(f.fs ?? 0));
    s.layer = layer0;
    const tipL = tip(1), tipR = tip(-1), pL = vadd(pouch, vsc(S, 0.85)), pR = vsub(pouch, vsc(S, 0.85));
    const streak = f.st === 3 ? [vadd(C, vsc(A, f.s0 ?? 4)), vadd(C, vsc(A, f.s1 ?? 14))] : null;
    const fs = f.fs ?? 0;
    posts.push((back, front) => {
      void back;
      // the bands: thin rubber, darker and sagging when slack, lighter when stretched
      for (const [a, b] of [[tipL, pL], [tipR, pR]] as [V3, V3][]) {
        const len = vlen(vsub(a, b));
        const tension = clamp01((len - 4.2) / 9);
        const sag = len < 5.2 ? (5.2 - len) * 0.45 + 0.4 : 0;
        const c = tension > 0.55 ? RUBBER.taut : tension > 0.1 ? RUBBER.base : RUBBER.slack;
        band(front, s.sx(a), s.sy(a), s.sx(b), s.sy(b), sag, c, tension > 0.7 ? RUBBER.hi : c);
      }
      if (streak) {
        // the shot: a hot streak off the fork, brightest at the head
        const [a, b] = streak;
        const x0 = s.sx(a), y0 = s.sy(a), x1 = s.sx(b), y1 = s.sy(b);
        const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const c = fs ? (u > 0.85 ? FIRE.white : u > 0.55 ? FIRE.hot : FIRE.core) : (u > 0.8 ? hex('#e8e8ee') : hex('#9a9aa4'));
          if (u < 0.3 && (i & 1)) continue;
          front.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, c);
        }
      }
    });
  }
  // a stone in the draw hand (reloading) or tossed up over it (the idle)
  if (f.st === 2 || (f.ts !== undefined && f.ts >= 0)) {
    const at = vadd(along(J.wrN, J.elN, 1.9, k), [0, f.st === 2 ? 0.4 : (f.ts ?? 0) + 1.2, 0.8]);
    s.layer = high(at, 5);
    s.ellipsoid(at, [0.66, 0, 0], [0, 0.6, 0], [0, 0, 0.66], GS + 1, stoneMat(f.st === 2 ? f.fs ?? 0 : 0));
    s.layer = layer0;
  }
  // the grenade: a flax-wrapped firestone bundle, its glow through the weave, a fuse with a spark
  if (f.gr) {
    const at = along(J.wrN, J.elN, 2.1, k), gg = f.gg ?? 0;
    s.layer = high(at, 6);
    s.ellipsoid(at, [1.3, 0, 0], [0, 1.25, 0], [0, 0, 1.3], GS, h => {
      const weave = (Math.floor(h.x + h.y) & 1) === 0;
      if (h.n[2] > 0.5 && h.n[1] > -0.2 && h.n[1] < 0.35 && gg > 0.3) return weave ? FIRE.core : FIRE.hot;
      return cel(PAL.flax, h.l, weave ? 0.12 : -0.16);
    });
    const fuse0 = vadd(at, [0.2, 1.1, 0.2]), fuse1 = vadd(at, [-0.6, 2.4, 0.4]);
    s.limb(fuse0, fuse1, 0.28, 0.24, GS, h => cel(PAL.rope, h.l, 0));
    s.layer = layer0;
    if (gg > 0.4) posts.push((back, front) => { void back; const x = s.sx(fuse1), y = s.sy(fuse1); front.set(x, y - 1, FIRE.white); front.set(x - 1, y - 1, gg > 0.8 ? FIRE.hot : FIRE.core); if (gg > 0.9) front.set(x, y - 2, FIRE.hot); });
  }
  if (!posts.length) return;
  return (back, front) => { for (const p of posts) p(back, front); };
}
HELD7.push(drawCombatProps);

/** a 1px band from a to b, sagging by `sag` px in the middle (slack rubber) */
function band(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, sag: number, c: C, hi: C) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4));
  let px = -999, py = -999;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = Math.floor(x0 + (x1 - x0) * u), y = Math.floor(y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * sag);
    if (x === px && y === py) continue;
    px = x; py = y;
    buf.set(x, y, u > 0.35 && u < 0.6 ? hi : c);
  }
}

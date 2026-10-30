// V7 talking body language, one clip per way of saying a line (the floating-text styles: say, shout,
// whisper, scared, happy, laugh, sad, think). The Actor picks the clip from its talk style and lays it
// over the stance while the character talks, easing in and out with a short 3D crossfade
// (anims7.ts 'blend~'), so the hands come up into the gesture from wherever they were and go back.
//
//  shout    leaning in from the hips, chest out, chin jutting, the arm thrown out on the beats
//           (Jenna cups her hands round her mouth and calls)
//  whisper  hunched in toward the listener, knees soft, a hand up beside the mouth screening it
//  scared   recoiled back on bent knees, hands up at the chin, trembling
//  happy    bouncing up onto the toes on the beats, open palms up, the head tilting side to side
//  laugh    (anims-life.ts) the shoulders shaking, head back, then folding forward over the belly
//  sad      slumped, head hanging, the arms hanging heavy, a weak lift of one hand now and then
//  say      (anims-life.ts 'talk') easy gestures on the beats; think: a hand at the chin
// The cast keep their own manner: Jenna is the most animated, Aroha the most contained, Joshu keeps a
// fist on his hip.

import type { Build, Pose, P2 } from '../people-rig';
import { ANIMS7, POSES7, wHead, wHang, bump, smooth, pulse, K, breath } from './anims7';
import { base } from './anims-life';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const W = (p: Pose, f: Record<string, number>) => { p.flags = { ...(p.flags ?? {}), ...f }; };
/** how big each of the cast gestures */
const ampOf = (id: string) => (id === 'jenna' ? 1.3 : id === 'aroha' ? 0.65 : id === 'joshu' ? 1.05 : id === 'mori' ? 1 : 0.9);
/** a fist planted on the hip (Joshu's and Aroha's other hand while they talk) */
const hipFist = (b: Build, p: Pose, x: number) => ({ ik: [p.hip[0] + x * K(b), p.hip[1] + 2.4 * K(b)] as P2, hand: 'fist' as const, palm: 'in' as const });
const keepsHip = (id: string) => id === 'joshu' || id === 'aroha';

/** shouting: leaning in, chest out, the near arm thrown out on each beat, the other fist clenched */
function talkShout(b: Build, t: number, id: string): Pose {
  const k = K(b), a = ampOf(id);
  const p = base(b, id, t * 0.5);
  const beat = pulse(t * 3), lag = pulse(t * 3 - 0.1);
  p.hip = [p.hip[0] + 0.5 * k, p.hip[1] - 0.6 * k - 0.3 * k * beat];
  p.lean = 0.13 + 0.05 * beat * a;
  p.sq = 1.015 - 0.015 * beat;
  p.hd = [0.6 * k + 0.35 * k * lag * a, -0.15 * k - 0.25 * k * lag];
  p.bounce = -0.4 * beat;
  p.sway = 0.4 + 0.5 * beat;
  if (id === 'jenna') {
    // calling out: both hands cupped round her mouth, rising on her toes with each call
    p.hip = [p.hip[0], p.hip[1] + 0.8 * k * beat];
    p.fl = { f: p.fl.f, fa: -0.3 * beat };
    p.fl.f = [p.fl.f[0], p.fl.f[1] + 0.8 * k * beat];
    p.bl = { f: [p.bl.f[0], p.bl.f[1] + 0.8 * k * beat], fa: -0.3 * beat };
    p.lean = 0.04 - 0.04 * beat;
    p.fa = { ik: wHead(b, p, 4.2, 3.2), hand: 'cup', palm: 'back', flex: 0.2 };
    p.ba = { ik: wHead(b, p, 3.4, 2.4), hand: 'cup', palm: 'back' };
    W(p, { wN: 1, wF: 1, zN: 2.2 * k, zF: -1.4 * k });
    p.front = ['armF'];
    return p;
  }
  // the near arm: drawn back between the beats, thrown out and down on them (open, fingers spread)
  p.fa = { ik: wHead(b, p, mix(5.2, 10.4, lag) * (0.85 + 0.15 * a), mix(-12.5, -8.4, lag) + 1.2 * Math.sin(TAU * t)), hand: id === 'joshu' ? 'point' : 'open', palm: 'fwd', flex: -0.35 * lag, spread: 1.4 };
  p.ba = keepsHip(id) ? hipFist(b, p, id === 'joshu' ? -0.2 : 0.6) : { ik: wHead(b, p, 3 + 0.6 * beat, -17.4 + 0.8 * beat), hand: 'fist', palm: 'in' };
  W(p, keepsHip(id) ? { wN: 1, zN: 2.6 * k, aoF: id === 'joshu' ? 3.2 : 2.6 } : { wN: 1, wF: 1, zN: 2.6 * k, zF: -2.2 * k });
  p.front = ['armF'];
  return p;
}

/** whispering: hunched in toward the listener on soft knees, a hand screening the mouth */
function talkWhisper(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, t * 0.5);
  const bob = Math.sin(TAU * 2 * t) * 0.5 + 0.5;
  p.hip = [p.hip[0] + 0.6 * k, p.hip[1] - 0.6 * k];
  p.lean = 0.12 + 0.02 * bob;
  p.hd = [0.6 * k + 0.1 * k * bob, -0.55 * k - 0.15 * k * bob];
  p.sq = 0.985;
  p.fa = { ik: wHead(b, p, 4.4, 1.6 - 0.2 * bob), hand: 'flat', palm: 'back', flex: 0.15 };
  p.ba = keepsHip(id) ? hipFist(b, p, id === 'joshu' ? -0.2 : 0.6) : { ik: wHang(b, p, 1.6), hand: 'relax' };
  W(p, keepsHip(id) ? { wN: 1, zN: 2.4 * k, aoF: id === 'joshu' ? 3.2 : 2.6, roll: 0 } : { wN: 1, wF: 1, zN: 2.4 * k, zF: -1.6 * k, roll: 0 });
  p.front = ['armF'];
  p.sway = 0.2;
  return p;
}

/** scared: backing off on bent knees, hands up at the chin, trembling */
function talkScared(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const sh = Math.sin(TAU * 4 * t), sh2 = Math.sin(TAU * 4 * t + 1.9);
  p.hip = [p.hip[0] - 0.8 * k + sh * 0.25 * k, p.hip[1] - 1 * k];
  p.lean = -0.1 + 0.01 * sh2;
  p.hd = [-0.45 * k + 0.1 * k * sh2, -0.5 * k];
  p.fa = { ik: wHead(b, p, 4.8 + sh * 0.3, -6.8 + sh2 * 0.3), hand: 'claw', palm: 'fwd', flex: -0.35 };
  p.ba = { ik: wHead(b, p, 3.6 - sh * 0.3, -7.8 - sh2 * 0.3), hand: 'open', palm: 'fwd', flex: -0.3 };
  W(p, { wN: 1, wF: 1, zN: 2.2 * k, zF: -1.2 * k, sx: -0.3 * k });
  p.front = ['armF'];
  p.sway = 0.3 + 0.2 * Math.abs(sh);
  return p;
}

/** happy: bouncing up on the toes on the beats, open palms up, the head tilting side to side */
function talkHappy(b: Build, t: number, id: string): Pose {
  const k = K(b), a = ampOf(id);
  const p = base(b, id, t * 0.5);
  const beat = pulse(t * 3), lag = pulse(t * 3 - 0.12), tilt = Math.sin(TAU * t);
  const rise = beat * 0.7 * k * a;
  p.hip = [p.hip[0], p.hip[1] + rise];
  p.fl = { f: [p.fl.f[0], p.fl.f[1] + rise], fa: -0.35 * beat * a };
  p.bl = { f: [p.bl.f[0], p.bl.f[1] + rise], fa: -0.35 * beat * a };
  p.lean = -0.02 + 0.02 * lag;
  p.hd = [0.3 * k * tilt * a, 0.2 * k * lag];
  const sweep = 0.5 + 0.5 * Math.sin(TAU * t + 0.5);
  p.fa = { ik: wHead(b, p, mix(6, 9.6, sweep) * (0.85 + 0.15 * a), -12.2 + 1.4 * lag * a), hand: 'open', palm: 'up', spread: 1.2, flex: -0.25 };
  p.ba = keepsHip(id) ? hipFist(b, p, id === 'joshu' ? -0.2 : 0.6) : id === 'jenna' ? { ik: wHead(b, p, 2.6, -9.6), hand: 'flat', palm: 'in' } : { ik: wHead(b, p, 4.6 + sweep, -13.4 + lag), hand: 'open', palm: 'up' };
  W(p, keepsHip(id) ? { wN: 1, zN: 2.4 * k, aoF: id === 'joshu' ? 3.2 : 2.6 } : { wN: 1, wF: 1, zN: 2.4 * k, zF: id === 'jenna' ? 0.4 * k : -1.8 * k });
  p.front = ['armF'];
  p.sway = 0.35 + 0.4 * beat;
  p.bounce = 0.3 * beat;
  return p;
}

/** sad: slumped, the head hanging, the arms heavy; once a loop one hand lifts a little and drops */
function talkSad(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const br = breath(t), lift = bump(t, 0.3, 0.75, 0.15);
  p.hip = [p.hip[0] + 0.2 * k, p.hip[1] - 0.4 * k - 0.15 * k * (1 - br)];
  p.lean = 0.11 + 0.02 * (1 - br);
  p.hd = [0.3 * k, -0.9 * k - 0.15 * k * (1 - br)];
  p.sq = 0.98 + 0.01 * br;
  p.look = 'down';
  p.fa = { ik: wHead(b, p, mix(2.4, 4.6, lift), mix(-19.6, -15.4, lift)), hand: lift > 0.4 ? 'open' : 'relax', palm: lift > 0.4 ? 'up' : 'in' };
  p.ba = { ik: wHead(b, p, 1.8, -19.8), hand: 'relax' };
  W(p, { wN: 1, wF: 1, zN: 2.6 * k, zF: -1.6 * k, roll: 0, sx: 0.1 * k });
  p.sway = 0.15;
  return p;
}

/**
 * Laughing: the shoulders shake in quick pulses; first the head goes back with it, then he folds
 * forward over his belly (a hand on it). Jenna giggles behind her hand; Joshu holds his belly with both.
 */
function laugh(b: Build, t: number, id: string): Pose {
  const k = K(b), a = ampOf(id);
  const p = base(b, id, 0);
  const ha = Math.pow(Math.abs(Math.sin(TAU * 4 * t)), 0.7);
  // back (t ≈ 0.25), forward (t ≈ 0.75)
  const sw = Math.sin(TAU * t), back = clamp01(sw), fwd = clamp01(-sw);
  p.hip = [p.hip[0] - 0.3 * k * back, p.hip[1] - 0.35 * k * ha - 0.5 * k * fwd];
  p.lean = -0.08 * back * a + 0.13 * fwd * a + 0.02 * ha;
  p.sq = 1 - 0.022 * ha;
  p.hd = [-0.35 * k * back + 0.3 * k * fwd, 0.3 * k * back - 0.4 * k * fwd + 0.25 * k * ha];
  p.look = back > 0.5 ? 'up' : fwd > 0.6 ? 'down' : 'fwd';
  const belly = wHead(b, p, 4.6, -16 + ha * 0.5);
  if (id === 'jenna') {
    p.fa = { ik: wHead(b, p, 3.4, 2.4 + ha * 0.3), hand: 'flat', palm: 'back' };
    p.ba = { ik: wHead(b, p, 3.2, -14.6 + ha * 0.4), hand: 'flat', palm: 'in' };
    W(p, { wN: 1, wF: 1, zN: 1.6 * k, zF: -0.6 * k });
  } else if (id === 'joshu') {
    p.fa = { ik: [belly[0] + 1.2, belly[1] + 0.4], hand: 'flat', palm: 'in' };
    p.ba = { ik: wHead(b, p, 4.4, -18 + ha * 0.4), hand: 'flat', palm: 'in' };
    W(p, { wN: 1, wF: 1, zN: 3.4 * k, zF: -1 * k });
  } else {
    p.fa = { ik: belly, hand: 'flat', palm: 'in' };
    p.ba = keepsHip(id) ? hipFist(b, p, 0.6) : { ik: lerp(wHang(b, p, 1.2), wHead(b, p, 6.6, -12), back), hand: back > 0.5 ? 'open' : 'relax', palm: 'up' };
    W(p, keepsHip(id) ? { wN: 1, zN: 2.8 * k, aoF: 2.6 } : { wN: 1, wF: 1, zN: 2.8 * k, zF: -1.6 * k });
  }
  p.front = ['armF'];
  p.sway = 0.3 + 0.4 * ha;
  return p;
}
const lerp = (p: P2, q: P2, u: number): P2 => [mix(p[0], q[0], u), mix(p[1], q[1], u)];

Object.assign(ANIMS7, {
  talkShout: { frames: 12, fps: 10, loop: true },
  talkWhisper: { frames: 8, fps: 5, loop: true },
  talkScared: { frames: 8, fps: 14, loop: true },
  talkHappy: { frames: 12, fps: 10, loop: true },
  talkSad: { frames: 8, fps: 4, loop: true },
  laugh: { frames: 16, fps: 12, loop: true },
});
Object.assign(POSES7, {
  talkShout: (b: Build, t: number, id: string) => talkShout(b, t, id),
  talkWhisper: (b: Build, t: number, id: string) => talkWhisper(b, t, id),
  talkScared: (b: Build, t: number, id: string) => talkScared(b, t, id),
  talkHappy: (b: Build, t: number, id: string) => talkHappy(b, t, id),
  talkSad: (b: Build, t: number, id: string) => talkSad(b, t, id),
  laugh: (b: Build, t: number, id: string) => laugh(b, t, id),
});

/** the clip for each way of saying a line (the floating-text styles; anything else talks plainly) */
export const TALK_STYLE_ANIMS: Record<string, string> = {
  say: 'talk', shout: 'talkShout', whisper: 'talkWhisper', scared: 'talkScared', happy: 'talkHappy', laugh: 'laugh', sad: 'talkSad', think: 'think', radio: 'talk', notice: 'talk',
};
void smooth;

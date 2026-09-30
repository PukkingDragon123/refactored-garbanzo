// V7 locomotion: new run, walk and idle cycles authored for the 3D cast (the shoulders twist against
// the hips automatically from the arm swing, so these read with depth). Everything else comes from
// the shared pose library.

import type { Build, Pose } from '../people-rig';
import { cycle, stand, animePose, ANIME_ANIMS, AnimInfo } from '../anime/anims';

const TAU = Math.PI * 2;
const K = (b: Build) => b.torso / 15;

export const ANIMS7: Record<string, AnimInfo> = {
  ...ANIME_ANIMS,
  idle: { frames: 6, fps: 4, loop: true },
  walk: { frames: 8, fps: 10, loop: true },
  run: { frames: 8, fps: 15, loop: true },
};

const POSES7: Record<string, (b: Build, t: number, id: string) => Pose> = {
  // a relaxed contrapposto: weight on the back leg, slow breathing, the arms settle and sway
  idle: (b, t) => {
    const k = K(b), br = Math.sin(TAU * t);
    const p = stand(b);
    p.hip = [0.3 * k * Math.sin(TAU * t), b.hipH - 0.35 - (br < 0 ? 0.35 : 0)];
    p.lean = 0.02 + br * 0.012;
    p.sq = 1 + br * 0.018;
    p.fl = { f: [-2.2 * k, b.ankleH], fa: 0 };
    p.bl = { f: [2.4 * k, b.ankleH], fa: 0.05 };
    p.fa = { a: 0.1 + br * 0.04, e: 0.36 - br * 0.06, hand: 'fist' };
    p.ba = { a: -0.08 - br * 0.03, e: 0.3 + br * 0.04, hand: 'fist' };
    p.sway = 0.2 + 0.2 * br;
    return p;
  },
  // walk: longer stride, a heel strike, relaxed arm swing
  walk: (b, t) => {
    const p = cycle(b, t, { stride: b.thigh * 1.35, lift: 2.4 * K(b), bob: 0.8 * K(b), lean: 0.05, swing: 0.42, elbow: 0.3, elbowSwing: 0.35, stance: 0.58 });
    p.hd = [0.2 * K(b), 0];
    return p;
  },
  // run: leaning into it, elbows bent and pumping, knees driving high, a clear flight phase
  run: (b, t) => {
    const k = K(b);
    const p = cycle(b, t, { stride: b.thigh * 2.1, lift: 5.4 * k, bob: 1.3 * k, lean: 0.36, swing: 0.95, elbow: 1.55, elbowSwing: 0.35, stance: 0.36, flight: 1.8 * k, hipDrop: 1.8 });
    p.lean = 0.5;
    const c = Math.cos(TAU * 2 * (t - 0.1));
    p.sq = 1 - Math.max(0, c) * 0.04;
    p.hd = [0.8 * k, -0.2 * k];
    p.fa.hand = 'fist'; p.ba.hand = 'fist';
    return p;
  },
};

export function pose7(id: string, anim: string, b: Build, frame: number): Pose {
  const fn = POSES7[anim];
  if (!fn) return animePose(id, anim, b, frame);
  const info = ANIMS7[anim];
  const n = info.frames;
  const t = n <= 1 ? 0 : info.loop ? frame / n : frame / (n - 1);
  return fn(b, t, id);
}

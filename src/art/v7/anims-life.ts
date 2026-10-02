// V7 everyday clips with secondary motion: the common clips the cast use all day (talking, waving,
// pointing, jumping and landing, stopping, the emotes) rebuilt as smooth continuous curves instead of
// a few snapped keyframes, with the principles that make them feel alive:
//  - follow-through and overlap: hands trail the forearm and flick through at the end of a move,
//    the head nods a beat after the gesture lands, hair lifts in a jump and settles after a landing
//  - squash and stretch: a crouch before the take-off, a stretch off the toes, a squash on landing
//  - anticipation: a dip before the jump, a wind-up before a fist pump
//  - overshoot: a stop carries the body forward past the rest pose and back, a landing rises past
//    standing and settles
// Hands go where they read on screen (world-space targets beside the body, flags wN / wF), shaped
// for the gesture (open palms up explaining, a fanned wave, a pointing finger, fists).
// Everything here is a pure function of the clip phase, so the frames cache like any other clip.

import type { Build, Pose, ArmP, P2 } from '../people-rig';
import { stand, crouchP } from '../anime/anims';
import { ANIMS7, POSES7, gait, gaitOf, shoulder, wHead, wHang, bump, smooth, lerp2, pulse, K } from './anims7';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
/** an eased overshoot: 0 → 1, past it by `o`, settling back */
const overshoot = (u: number, o = 0.18) => { u = clamp01(u); return 1 - Math.cos(u * Math.PI * 0.5 * 1.45) * (1 - u) + Math.sin(u * Math.PI) * o * (1 - u); };

/** the character's own resting stance (from their idle: Jenna's heels together, Joshu's wide sea legs) */
function base(b: Build, id: string, t = 0): Pose {
  const k = K(b), br = Math.sin(TAU * t);
  const p = stand(b);
  p.hip = [0.25 * k * Math.sin(TAU * t + 0.8), b.hipH - 0.35 - Math.max(0, -br) * 0.3];
  p.lean = 0.02 + br * 0.01;
  p.sq = 1 + br * 0.015;
  const wide = id === 'joshu' ? 1.25 : id === 'jenna' ? 0.7 : 1;
  p.fl = { f: [-2.2 * k * wide, b.ankleH], fa: 0 };
  p.bl = { f: [2.4 * k * wide, b.ankleH], fa: 0.05 };
  p.fa = { a: 0.08 + br * 0.03, e: 0.32, hand: 'relax' };
  p.ba = { a: -0.06, e: 0.28, hand: 'relax' };
  p.sway = 0.2 + 0.15 * br;
  p.flags = { sx: 0.3 * k * Math.sin(TAU * t + 0.8) };
  return p;
}
/** a fist on the hip (Joshu's and Aroha's rest), elbow out */
const onHip = (b: Build, p: Pose, x = 0.4): ArmP => ({ ik: [p.hip[0] + x * K(b), p.hip[1] + 2.4 * K(b)], hand: 'fist', palm: 'in' });
const W = (p: Pose, f: Record<string, number>) => { p.flags = { ...(p.flags ?? {}), ...f }; };

// ------------------------------------------------------------------ talking

/**
 * Talking: a loop of gestures with beats. The near hand comes up open, palm up, and chops gently on
 * the beats; it sweeps out and back; the far hand joins for the second phrase. The head nods a beat
 * after each emphasis, the body leans into it. Each of the cast gestures their own way.
 */
function talk(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, t * 0.5);
  const beat = pulse(t * 4), beatLag = pulse(t * 4 - 0.12);
  const amp = id === 'jenna' ? 1.35 : id === 'aroha' ? 0.6 : id === 'joshu' ? 0.85 : 1;
  p.lean += 0.03 * Math.sin(TAU * t) * amp + 0.015 * beat;
  p.hd = [0.2 * k * beatLag * amp, -0.32 * k * beatLag];
  if (id === 'jenna') p.hip = [p.hip[0], p.hip[1] + 0.5 * k * beat];
  const sweep = Math.sin(TAU * t), lift = Math.sin(TAU * 2 * t + 0.6);
  // near hand: up in front of the chest, out on the sweep, down a pixel on each beat
  const nx = mix(6.6, 9.8, 0.5 + 0.5 * sweep) * (0.85 + 0.15 * amp), ny = -13 + 1.4 * lift * amp - beat * 0.9 * amp;
  const handN: ArmP['hand'] = id === 'joshu' ? (beat > 0.55 ? 'point' : 'fist') : sweep > 0.55 ? 'open' : 'open';
  p.fa = { ik: wHead(b, p, nx, ny), hand: handN, palm: id === 'joshu' ? 'in' : sweep > 0.3 ? 'fwd' : 'up', flex: -0.15 - 0.25 * beat, spread: 0.6 + 0.6 * clamp01(sweep) };
  // far hand: joins on the second phrase (both palms up), otherwise easy at the side
  const join = smooth((Math.sin(TAU * t + 2.2) - 0.1) / 0.6) * (id === 'jenna' ? 1 : id === 'mori' ? 0.8 : 0);
  const far: P2 = lerp2(wHang(b, p, 0.6), wHead(b, p, 5.6 + sweep * 1.2, -14.4 + lift * 0.8), join);
  p.ba = { ik: far, hand: join > 0.4 ? 'open' : 'relax', palm: join > 0.4 ? 'up' : 'in' };
  if (id === 'joshu' || id === 'aroha') {
    // the other fist stays planted on the hip
    p.ba = onHip(b, p, id === 'joshu' ? -0.2 : 0.6);
    W(p, { wN: 1, zN: 2.2 * k, aoF: id === 'joshu' ? 3.2 : 2.6 });
  } else W(p, { wN: 1, wF: 1, zN: 2.2 * k, zF: -1.6 * k });
  p.front = ['armF'];
  return p;
}

// ------------------------------------------------------------------ gestures

/** a wave beside the head: the forearm rocks from the elbow, the open hand flaps a beat behind it */
function wave(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, t);
  const sw = Math.sin(TAU * 2 * t), lagSw = Math.sin(TAU * 2 * t - 1.1);
  p.lean = -0.02 + 0.01 * sw;
  p.hd = [-0.2 * k, 0.1 * k * sw];
  p.fa = { ik: wHead(b, p, -8.6 + 1.7 * sw, 2.2 - 0.5 * Math.abs(sw)), hand: 'wave', palm: 'cam', dev: 0.45 * lagSw, flex: -0.2 };
  W(p, { wN: 1, sx: -0.4 * k });
  p.front = ['armF'];
  p.sway = 0.3 + 0.15 * Math.abs(sw);
  return p;
}

/** pointing ahead: the arm goes out with a little overshoot and holds, the finger steady, a breath */
function point(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, t);
  p.lean = 0.06;
  const settle = Math.sin(TAU * t) * 0.35;
  p.fa = { ik: wHead(b, p, 14.4, -5.6 + settle), hand: 'point', palm: 'down', flex: -0.05 };
  p.ba = id === 'joshu' ? onHip(b, p, -0.2) : { ik: wHang(b, p, 0.6), hand: 'relax' };
  W(p, { wN: 1, zN: 3 * k, aoF: id === 'joshu' ? 3.2 : 0 });
  p.front = ['armF'];
  return p;
}

/** a shrug: shoulders up (the head sinks between them), palms open to the sky, and down again */
function shrug(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const up = bump(t, 0.05, 0.85, 0.22);
  p.hd = [0.1 * k * up, -1.1 * k * up];
  p.lean = 0.02 - 0.04 * up;
  p.sq = 1 - 0.02 * up;
  p.fa = { ik: wHead(b, p, mix(4.4, 9.2, up), mix(-20, -12.4, up)), hand: up > 0.3 ? 'open' : 'relax', palm: 'up', flex: -0.3 * up, spread: 1.2 };
  p.ba = { ik: wHead(b, p, mix(2, 6.4, up), mix(-20, -13, up)), hand: up > 0.3 ? 'open' : 'relax', palm: 'up', flex: -0.3 * up };
  W(p, { wN: 1, wF: 1, zN: 4 * k, zF: -3.6 * k });
  p.front = ['armF'];
  return p;
}

/** thinking: a finger and thumb at the chin, the other arm across under the elbow, a slow tap */
function think(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, t * 0.5);
  const tap = Math.max(0, Math.sin(TAU * 2 * t)) * 0.5;
  p.lean = -0.02;
  p.hd = [0.15 * k, 0.2 * k];
  p.look = t < 0.5 ? 'up' : 'fwd';
  p.fa = { ik: wHead(b, p, 3.4, 0.6 + tap), hand: 'pinch', palm: 'in', flex: 0.3 };
  p.ba = { ik: wHead(b, p, 3.2, -11.8), hand: 'flat', palm: 'up' };
  W(p, { wN: 1, wF: 1, zN: 1.2 * k, zF: 1.4 * k });
  p.armBFwd = true;
  p.front = ['armF'];
  return p;
}

/** startled (one-shot): a jolt back and up, hands flying up open, then a settle */
function surprised(b: Build, u: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const jolt = bump(u, 0, 0.55, 0.12), settle = smooth((u - 0.45) / 0.55);
  const back = jolt * (1 - settle * 0.6);
  p.hip = [p.hip[0] - 1.1 * k * back, p.hip[1] + 1.6 * k * jolt * (1 - settle)];
  p.lean = -0.16 * back;
  p.sq = 1 + 0.04 * jolt * (1 - settle);
  p.hd = [-0.4 * k * back, 0.2 * k * jolt];
  const hy = mix(-19, -9, back), hx = mix(4.4, 7.2, back);
  p.fa = { ik: wHead(b, p, hx, hy), hand: back > 0.3 ? 'claw' : 'relax', palm: 'fwd', flex: -0.4 * back };
  p.ba = { ik: wHead(b, p, hx - 1.6, hy - 0.8), hand: back > 0.3 ? 'claw' : 'relax', palm: 'fwd' };
  W(p, { wN: 1, wF: 1, zN: 3 * k, zF: -2.4 * k });
  p.sway = 0.4 + 0.6 * jolt;
  p.front = ['armF'];
  return p;
}

/** scared: backing off on bent knees, hands up in front, trembling */
function scared(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const shake = Math.sin(TAU * 4 * t) * 0.35 * k;
  p.hip = [-1 * k + shake * 0.4, b.hipH * 0.92];
  p.lean = -0.12;
  p.fl = { f: [1.6 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-2.6 * k, b.ankleH], fa: 0 };
  p.fa = { ik: wHead(b, p, 6.4, -7.4 + shake * 0.5), hand: 'claw', palm: 'fwd', flex: -0.35 };
  p.ba = { ik: wHead(b, p, 5, -8.6 - shake * 0.5), hand: 'claw', palm: 'fwd', flex: -0.35 };
  W(p, { wN: 1, wF: 1, zN: 2.6 * k, zF: -1.8 * k });
  p.look = 'fwd';
  p.front = ['armF'];
  return p;
}

/** laughing: the shoulders bounce, a hand on the belly, the head goes back on the big ones */
function laugh(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const ha = Math.abs(Math.sin(TAU * 3 * t)), big = smooth((Math.sin(TAU * t) + 0.2) / 0.8);
  p.hip = [p.hip[0], p.hip[1] - 0.4 * k * ha];
  p.lean = -0.05 - 0.1 * big + 0.03 * ha;
  p.sq = 1 - 0.02 * ha;
  p.hd = [-0.3 * k * big, 0.3 * k * ha];
  p.look = big > 0.6 ? 'up' : 'fwd';
  p.fa = { ik: wHead(b, p, 4.4, -16.4 + ha * 0.6), hand: 'flat', palm: 'in' };
  p.ba = id === 'joshu' ? { ik: wHead(b, p, 3.8, -18.4 + ha * 0.5), hand: 'flat', palm: 'in' } : { ik: wHang(b, p, 0.8), hand: 'relax' };
  W(p, { wN: 1, wF: 1, zN: 2.8 * k, zF: -1 * k });
  p.front = ['armF'];
  return p;
}

/** angry: fists clenched at the sides, shaking, a stamp of the foot, leaning in */
function angry(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const stamp = bump(t, 0.1, 0.5, 0.12), hit = bump(t, 0.42, 0.56, 0.04);
  const sh = Math.sin(TAU * 6 * t) * 0.3 * k;
  p.lean = 0.12 + 0.04 * stamp;
  p.hip = [p.hip[0], p.hip[1] - hit * 0.8 * k];
  p.sq = 1 - hit * 0.03;
  p.fl = { f: [1.8 * k, b.ankleH + stamp * (1 - hit) * 1.8 * k], fa: -0.2 * stamp };
  p.fa = { ik: wHead(b, p, 3.4 + sh * 0.3, -17 + sh), hand: 'fist', palm: 'in' };
  p.ba = { ik: wHead(b, p, 2.6, -17.4 - sh), hand: 'fist', palm: 'in' };
  W(p, { wN: 1, wF: 1, zN: 3.4 * k, zF: -2.4 * k });
  p.bounce = -hit * 0.5;
  p.front = ['armF'];
  return p;
}

/** celebrating: a dip, a jump with both fists punched up, the landing squash, again */
function celebrate(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const dip = bump(t, 0, 0.22, 0.1), air = bump(t, 0.2, 0.75, 0.2), land = bump(t, 0.72, 0.98, 0.08);
  p.hip = [p.hip[0], p.hip[1] - (dip + land) * 1.6 * k + air * 3.4 * k];
  p.sq = 1 - (dip + land) * 0.05 + air * 0.035;
  p.lean = 0.06 * dip - 0.06 * air;
  if (air > 0.05) {
    p.fl = { f: [-1.4 * k, b.ankleH + air * 2.6 * k], fa: -0.4 * air };
    p.bl = { f: [1.6 * k, b.ankleH + air * 3.2 * k], fa: -0.4 * air };
  }
  // fists punched up clear of the head on either side
  const pump = smooth((air + 0.15) / 0.8);
  p.fa = { ik: wHead(b, p, mix(-5, -7.6, pump), mix(-9, 13.5, pump)), hand: 'fist', palm: 'fwd' };
  p.ba = { ik: wHead(b, p, mix(5.6, 7.8, pump), mix(-10, 12.4, pump)), hand: 'fist', palm: 'fwd' };
  W(p, { wN: 1, wF: 1, zN: 4 * k, zF: -3.4 * k });
  p.sway = 0.4 + 0.7 * air;
  p.front = ['armF'];
  return p;
}

/** cheering on the spot: fists pumping up in turn, a bounce on each */
function cheer(b: Build, t: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const a = Math.sin(TAU * 2 * t), bnc = Math.abs(a);
  p.hip = [p.hip[0], p.hip[1] + bnc * 0.9 * k];
  p.sq = 1 + bnc * 0.02;
  const upN = clamp01(a), upF = clamp01(-a);
  p.fa = { ik: wHead(b, p, mix(-6.4, -7.6, upN), mix(-3, 13, upN)), hand: 'fist', palm: 'fwd' };
  p.ba = { ik: wHead(b, p, mix(6.6, 7.8, upF), mix(-4, 12, upF)), hand: 'fist', palm: 'fwd' };
  W(p, { wN: 1, wF: 1, zN: 4 * k, zF: -3.4 * k });
  p.sway = 0.3 + 0.5 * bnc;
  p.front = ['armF'];
  return p;
}

// ------------------------------------------------------------------ jumping, falling, landing, stopping

/** take-off (one-shot, held at the top): a crouch, the push off the toes (stretch), legs tucked up */
function jump(b: Build, u: number, id: string): Pose {
  const k = K(b);
  const crouch = 1 - smooth(u / 0.3), rise = smooth((u - 0.15) / 0.5);
  const p = base(b, id, 0);
  p.hip = [0, b.hipH - crouch * 3 * k + rise * 2.2 * k];
  p.lean = 0.14 * crouch + 0.06 * rise;
  p.sq = 1 - crouch * 0.06 + (1 - crouch) * (1 - rise * 0.6) * 0.05;
  p.fl = { f: [mix(-1.6, 3 * 0.9, rise) * k, b.ankleH + rise * 5 * k], fa: -0.3 * rise };
  p.bl = { f: [mix(2, -2.2, rise) * k, b.ankleH + rise * 3.4 * k], fa: -0.6 * rise };
  // arms swing back for the crouch, then up and forward with the jump (the hands trail open)
  const a = mix(-0.7, 2.3, smooth((u - 0.05) / 0.45));
  p.fa = { a, e: 0.35, hand: 'open', flex: -0.3 * rise };
  p.ba = { a: a - 0.3, e: 0.45, hand: 'open', flex: -0.3 * rise };
  p.sway = 0.3 + 0.9 * rise;
  if (rise > 0.2) p.legFwd = true;
  return p;
}
/** falling: arms up and out, fingers spread, legs reaching for the ground, hair lifting */
function fall(b: Build, t: number, id: string): Pose {
  const k = K(b), fl = Math.sin(TAU * t);
  const p = base(b, id, 0);
  p.hip = [0, b.hipH + 0.8 * k];
  p.lean = -0.05;
  p.fl = { f: [1.8 * k + fl * 0.4 * k, b.ankleH - 0.6], fa: 0.2 };
  p.bl = { f: [-1.4 * k - fl * 0.4 * k, b.ankleH + 0.8 * k], fa: -0.3 };
  p.fa = { a: 1.9 + fl * 0.12, e: -0.3, hand: 'claw', flex: -0.4 };
  p.ba = { a: 1.6 - fl * 0.12, e: -0.2, hand: 'claw', flex: -0.4 };
  p.sway = 1.1;
  return p;
}
/** landing (one-shot): a deep squash on bent knees, arms swinging down, then up past standing and settle */
function land(b: Build, u: number, id: string): Pose {
  const k = K(b);
  const p = base(b, id, 0);
  const sq = 1 - overshoot(u, 0.2);
  p.hip = [0, b.hipH - 0.35 - sq * 3.6 * k];
  p.lean = 0.02 + 0.24 * sq;
  p.sq = 1 - sq * 0.08;
  p.fl = { f: [-2.6 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
  p.fa = { a: 0.08 + 0.8 * sq, e: 0.32 + 0.1 * sq, hand: sq > 0.3 ? 'open' : 'relax', flex: 0.3 * sq };
  p.ba = { a: -0.06 + 0.6 * sq, e: 0.28, hand: sq > 0.3 ? 'open' : 'relax' };
  p.sway = 0.2 + 0.6 * sq;
  p.legFwd = sq > 0.3;
  return p;
}
/**
 * Coming to a stop from a walk (or a run): momentum carries the body on past the rest pose, the arms
 * swing on through, then everything settles back; the feet close up.
 */
function stopFrom(b: Build, u: number, id: string, run: boolean): Pose {
  const k = K(b);
  const from = run ? gait(b, 0.25, gaitOf(id).run(b)) : gait(b, 0.25, gaitOf(id).walk(b));
  const rest = id === 'jenna' || id === 'joshu' || id === 'aroha' ? POSES7.idle(b, 0, id) : base(b, id, 0);
  const e = smooth(u);
  const p: Pose = { ...rest };
  p.hip = lerp2(from.hip, rest.hip, e);
  p.fl = { f: lerp2(from.fl.f, rest.fl.f, smooth(u * 1.4)), fa: mix(from.fl.fa ?? 0, rest.fl.fa ?? 0, e) };
  p.bl = { f: lerp2(from.bl.f, rest.bl.f, smooth(u * 1.2)), fa: mix(from.bl.fa ?? 0, rest.bl.fa ?? 0, e) };
  // the lean: forward past rest on the momentum (a run first brakes back), then settle
  const over = Math.sin(u * Math.PI) * (1 - u * 0.4);
  p.lean = mix(from.lean, rest.lean, e) + (run ? (u < 0.35 ? -0.12 * Math.sin((u / 0.35) * Math.PI) : 0.1 * over) : 0.07 * over);
  p.hd = [0.3 * k * over, -0.25 * k * over];
  p.sq = 1 - 0.025 * Math.sin(u * Math.PI);
  // swinging arms (only if the rest pose hangs them) follow through forward and back
  if (!rest.fa.ik) p.fa = { a: (rest.fa.a ?? 0) + 0.45 * over * (run ? 1.3 : 1), e: (rest.fa.e ?? 0.3) + 0.25 * over, hand: 'relax', dev: -0.3 * Math.cos(u * Math.PI) };
  if (!rest.ba.ik) p.ba = { a: (rest.ba.a ?? 0) + 0.3 * over, e: (rest.ba.e ?? 0.3) + 0.2 * over, hand: 'relax' };
  p.sway = 0.3 + 0.6 * over;
  return p;
}

// ------------------------------------------------------------------ registration

Object.assign(ANIMS7, {
  talk: { frames: 16, fps: 8, loop: true },
  wave: { frames: 12, fps: 10, loop: true },
  point: { frames: 8, fps: 5, loop: true },
  shrug: { frames: 10, fps: 10, loop: true },
  think: { frames: 8, fps: 4, loop: true },
  surprised: { frames: 8, fps: 16, loop: false },
  scared: { frames: 8, fps: 10, loop: true },
  laugh: { frames: 12, fps: 12, loop: true },
  angry: { frames: 10, fps: 10, loop: true },
  celebrate: { frames: 12, fps: 12, loop: true },
  cheer: { frames: 8, fps: 8, loop: true },
  jump: { frames: 6, fps: 18, loop: false },
  fall: { frames: 6, fps: 8, loop: true },
  land: { frames: 6, fps: 20, loop: false },
  walkStop: { frames: 6, fps: 20, loop: false },
  runStop: { frames: 8, fps: 20, loop: false },
});

Object.assign(POSES7, {
  talk: (b: Build, t: number, id: string) => talk(b, t, id),
  wave: (b: Build, t: number, id: string) => wave(b, t, id),
  point: (b: Build, t: number, id: string) => point(b, t, id),
  shrug: (b: Build, t: number, id: string) => shrug(b, t, id),
  think: (b: Build, t: number, id: string) => think(b, t, id),
  surprised: (b: Build, t: number, id: string) => surprised(b, t, id),
  scared: (b: Build, t: number, id: string) => scared(b, t, id),
  laugh: (b: Build, t: number, id: string) => laugh(b, t, id),
  angry: (b: Build, t: number, id: string) => angry(b, t, id),
  celebrate: (b: Build, t: number, id: string) => celebrate(b, t, id),
  cheer: (b: Build, t: number, id: string) => cheer(b, t, id),
  jump: (b: Build, t: number, id: string) => jump(b, t, id),
  fall: (b: Build, t: number, id: string) => fall(b, t, id),
  land: (b: Build, t: number, id: string) => land(b, t, id),
  walkStop: (b: Build, t: number, id: string) => stopFrom(b, t, id, false),
  runStop: (b: Build, t: number, id: string) => stopFrom(b, t, id, true),
});
void crouchP;

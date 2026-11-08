// V12 NPCs: Hank "Big Hank" Mulvaney (55), the dealer at the end of Te Huarahi.
//
//  Fat, sweaty, jokey, from Ohio. A loud turquoise aloha shirt with hand-painted red hibiscus and
//  green leaves, untucked, sweat patches under the arms and down the chest; the collar open on a
//  hairy chest and a gold chain; cargo shorts with fat pockets; white tube socks with two stripes in
//  brown sandals; hairy sunburnt forearms and a gold watch. A red-and-white trucker cap (a foam front
//  with a little fish patch, a mesh back), aviator sunglasses (even at night), stubble, a goatee, and
//  an unlit cigar he chews in the corner of his mouth.
//
//  Waits mopping his neck with a hanky, glancing up and down the lane, chewing the cigar; walks with a
//  rolling waddle; sits in his folding chair with his hands on his belly ('hankSit'); dozes in it at
//  night, head back, mouth open ('hankDoze').

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Hit } from '../../v7/raster';
import type { Char7, Part } from '../../v7/body';
import type { HeadDef7 } from '../../v7/head';
import { HEADS7 } from '../../v7/head';
import { JOSHU7 } from '../../v7/cast';
import type { Build, Pose } from '../../people-rig';
import { stand, sitP } from '../../anime/anims';
import { registerOwn7, registerAnim7, gait, gaitDist } from '../../v7/anims7';
import type { Gait } from '../../v7/anims7';
import { HELD7 } from '../../v7/held';
import { tLimb, GG } from '../../v7/gear';
import { R6, L, lb, frac, bump, K, TAU, CL, HAIR } from './kit';
import { tones } from '../../portrait/kit';
import type { Pic, Pt } from '../../portrait/kit';
import type { PortraitDesign, PortraitMats } from '../../anime/portraits';
import { PixelBuffer } from '../../pixel';
import { NPC_PORTRAITS } from './portraits';

// ================================================================== the body
/** sunburnt Ohio pink */
const HS = R6('#3a1410', '#9a4434', '#c8705a', '#e89a7c', '#f6b898', '#ffd8bc');
/** the aloha shirt: turquoise ground, red hibiscus, green leaves, sweat-darkened */
const SHIRT = R6('#04262c', '#0a4a54', '#11717c', '#1aa0aa', '#3cc6c4', '#8aece0');
const SWEAT = R6('#021418', '#05303a', '#0a4c56', '#10707a', '#2696a0', '#58c0bc');
const HIBIS = R6('#3a0610', '#7a0e1c', '#b8182a', '#e43a3e', '#ff7a6a', '#ffc0b0');
const LEAFG = R6('#062008', '#0e3a12', '#1a5a1e', '#2a7e2a', '#4aa23a', '#8ad060');
const CARGO = R6('#1e1a0e', '#3e3820', '#5e5634', '#7e7448', '#9c9060', '#c0b484');
const SOCK = R6('#5a5a5e', '#9a9aa0', '#c8c8cc', '#e8e8ea', '#f6f6f6', '#ffffff');
const GOLD = R6('#3a2604', '#7a5410', '#b8861e', '#e0b232', '#f6d862', '#fff4c0');

const hsh = (x: number, y: number, s = 0) => { let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** the print: one big hibiscus per 7 px cell (five petals, a yellow eye), a leaf in some, on turquoise */
function aloha(hit: { x: number; y: number; l: number }, bias = 0, wet = false): number {
  const S = 8, cx = Math.floor(hit.x / S), cy = Math.floor((hit.y + (cx & 1) * 4) / S);
  const ox = cx * S + 4 + Math.round(hsh(cx, cy, 3) * 2 - 1), oy = cy * S - (cx & 1) * 4 + 4 + Math.round(hsh(cx, cy, 5) * 2 - 1);
  const dx = hit.x - ox, dy = hit.y - oy, d = Math.hypot(dx, dy);
  const kind = hsh(cx, cy, 7);
  const ground = wet ? SWEAT : SHIRT;
  if (kind < 0.55) {
    // a hibiscus: five round petals, a dark throat, a yellow stamen
    const a = Math.atan2(dy, dx), petal = 2.4 + 0.9 * Math.max(0, Math.cos(a * 5 + cx * 1.3));
    if (d < 0.75) return hex('#ffe060');
    if (d < 1.5) return cel(HIBIS, hit.l, bias - 0.45 - (wet ? 0.3 : 0));
    if (d < petal) return cel(HIBIS, hit.l, bias + (d > petal - 0.8 ? -0.15 : 0.2) - (wet ? 0.35 : 0));
  } else if (kind < 0.68) {
    // a little cream frangipani
    if (d < 0.6) return hex('#ffd040');
    if (d < 1.7) return wet ? hex('#b8c0a8') : hex('#fff4dc');
  } else if (kind < 0.9) {
    // a monstera-ish leaf, slanted
    const u = dx * 0.8 + dy * 0.6, v = -dx * 0.6 + dy * 0.8;
    if (Math.abs(v) < 1.3 - Math.abs(u) * 0.25 && Math.abs(u) < 3.2) return cel(LEAFG, hit.l, bias - (Math.abs(v) < 0.4 ? 0.3 : 0) - (wet ? 0.35 : 0));
  }
  return cel(ground, hit.l, bias + 0.05);
}
const hairy = (p: Part, ramp = HS, b = 0) => (((p.hit.x * 7 + p.hit.y * 3) % 6) === 0 && L(p) > -0.3 ? cel(ramp, L(p), lb(p) + b - 0.5) : cel(ramp, L(p), lb(p) + b));

export const HANK7: Char7 = {
  ...JOSHU7, id: 'hank',
  // a big man gone soft: a barrel chest, a proper belly hanging over the belt, short heavy legs
  build: { hipH: 26.2, thigh: 12.6, shin: 12.0, ankleH: 2.2, torso: 23.4, neck: 0.8, shY: 3.2, shF: 0, shB: 0, upArm: 10.6, foreArm: 9.6, legF: 0, legB: 0 },
  shW: 8.4, hipW: 4.0, chest: [5.6, 7.4], waist: [6.0, 6.8], pelvis: [5.0, 5.8], belly: 4.6,
  armR: [3.4, 3.0, 2.5], legR: [3.5, 2.8, 2.3], neckR: 3.1, hand: 1.6,
  skin: HS, ink: hex('#1a0c0e'),
  torso(p) {
    const l = L(p), az = Math.abs(p.z);
    // the open collar: a V of hairy chest, the gold chain lying in it
    if (p.hh > 0.78 && p.f > 2.2 && az < (p.hh - 0.78) * 12) {
      if (Math.abs(p.hh - (0.83 + az * 0.03)) < 0.022) return cel(GOLD, l, 0.15, true);
      return hairy(p, HS, 0.05);
    }
    // the collar's points
    if (p.hh > 0.86 && p.f > 1.4 && az < (p.hh - 0.74) * 14) return cel(SHIRT, l, 0.25);
    // the button placket
    if (p.f > 3 && az < 0.3 && p.hh > 0.1 && p.hh < 0.8) return frac(p.hh * 7) < 0.16 ? hex('#f4ecd8') : cel(SHIRT, l, -0.25);
    // the untucked hem
    if (p.hh < 0.07) return cel(SHIRT, l, -0.3);
    // sweat: under the arms, a dark drip down the chest and the small of the back
    const pit = p.hh > 0.5 && p.hh < 0.84 && az > 5.0;
    const drip = p.f > 2.6 && az < 1.6 + (p.hh - 0.5) * 2 && p.hh > 0.48 && p.hh < 0.8;
    const back = p.f < -3 && p.hh > 0.3 && p.hh < 0.7 && az < 2.4;
    return aloha(p.hit, 0, pit || drip || back);
  },
  upperArm(p) {
    // short sleeves with a turned hem, a sweat ring at the pit
    if (p.t < 0.46) return p.t > 0.4 ? cel(SHIRT, L(p), lb(p) - 0.25) : aloha(p.hit, lb(p), p.t < 0.12);
    return hairy(p, HS, 0);
  },
  foreArm(p) {
    // hairy, sunburnt; a fat gold watch on the far wrist
    if (!p.near && p.t > 0.82 && p.t < 0.94) return cel(GOLD, L(p), lb(p) + 0.1, true);
    return hairy(p, HS, 0.02);
  },
  hands(p) { return cel(HS, L(p), lb(p) + 0.08); },
  // cargo shorts to the knee: a seam, a fat side pocket with a flap
  thigh(p) {
    const l = L(p), b = lb(p);
    if (p.t > 0.8) return hairy(p, HS, 0);
    if (p.t > 0.74) return cel(CARGO, l, b - 0.35);
    const side = Math.abs(Math.cos(p.hit.q[1]) - 0.4) < 0.5 && p.near;
    if (side && p.t > 0.28 && p.t < 0.62) return p.t < 0.34 ? cel(CARGO, l, b + 0.2) : cel(CARGO, l, b - 0.12);
    return cel(CARGO, l, b);
  },
  // hairy calves into white tube socks with two stripes
  shin(p) {
    const l = L(p), b = lb(p);
    if (p.t < 0.56) return hairy(p, HS, 0);
    if (p.t < 0.6) return cel(SOCK, l, b - 0.1);
    if (p.t < 0.635) return hex('#c82a2a');
    if (p.t < 0.66) return cel(SOCK, l, b);
    if (p.t < 0.69) return hex('#1a3a8a');
    return cel(SOCK, l, b + (frac(p.t * 22) < 0.3 ? -0.15 : 0));
  },
  // sandals over the socks: a thick brown sole, two straps, white sock between
  shoe(p) {
    const q = p.hit.q;
    if (q[1] < -0.45) return CL.leather[0];
    if (q[1] < -0.28) return cel(CL.leather, L(p), lb(p) - 0.1);
    if (Math.abs(q[0] - 0.25) < 0.12 || Math.abs(q[0] + 0.25) < 0.12) return cel(CL.leather, L(p), lb(p) + 0.1);
    return cel(SOCK, L(p), lb(p));
  },
  shoeK: [1.05, 0.95, 1.08],
  skirt: { len: 3.6, flare: 1.2, top: 2.6, mat: p => (p.t > 0.86 ? cel(SHIRT, L(p), -0.35) : aloha(p.hit, 0)) },
  bootTop: undefined, cuff: undefined,
  extras(s, J, _P, ch) {
    // a hanky stuffed in the back pocket, a corner hanging out
    const T = ch.build.torso;
    tLimb(s, J, [-T * 0.04, -ch.pelvis[0] - 0.4, -ch.hipW * 0.4], [-T * 0.16, -ch.pelvis[0] - 0.8, -ch.hipW * 0.5], 0.9, 0.5, GG.clip, h => cel(CL.white, h.l, 0.05));
  },
};

// ================================================================== the head
const CAP_RED = R6('#2a0606', '#5a0e0c', '#8e1c16', '#c02a20', '#e04a3a', '#f8806a');
const FOAM = R6('#6a6a64', '#a4a49c', '#d0d0c8', '#eeeee6', '#fafaf4', '#ffffff');
const LENS = R6('#060404', '#140c0a', '#2a1a12', '#4a2a1a', '#7a4a2a', '#d8a070');
const STUB2 = hex('#b06a54');
export const HANK_HEAD: HeadDef7 = {
  ...HEADS7.joshu,
  skin: HS, hair: HAIR.greyBlack, ink: hex('#1a0c0e'), eyeCol: '#1a0c0e', brow: '#5a4a44', blush: '#e86a5a',
  // a big round face, jowls, a fat nose
  skull: [[0.2, 8.4, 0], [5.6, 5.9, 5.2]],
  jaw: [[1.2, 4.4, 0], [4.6, 3.8, 4.6]],
  chin: [[3.2, 2.4, 0], [2.2, 2.0, 2.6]],
  nose: [[5.8, 6.2, 0], [1.5, 1.4, 1.3]],
  mouth: [5.1, 3.6, 0.3],
  // greying hair cut short round the back and sides, under the cap
  shell: [[-0.9, 8.0, 0], [5.6, 4.8, 5.6]],
  cut: q => q[0] > -0.1 || q[1] > 0.4,
  locks: [],
  eyeStyle: undefined,
  extras(s, W) {
    // a sprinkle of stubble low on the jowls (face group, so nothing inks round it), a goatee and a
    // thin moustache in one clump
    s.ellipsoid(W([1.2, 3.4, 0]), W([4.7, 0, 0]), [0, 2.4, 0], W([0, 0, 4.9]), 1, (h: Hit) => {
      if (h.q[0] > 0.3 || h.q[1] > 0.2) return -1;
      const n = hsh(h.x, h.y, 9);
      return n > 0.82 ? STUB2 : -1;
    });
    const goat = R6('#2a1a12', '#4a3022', '#6a4a36', '#8a644a', '#a88060', '#c8a07c');
    s.ellipsoid(W([3.9, 1.7, 0]), W([1.1, 0, 0]), [0, 1.3, 0], W([0, 0, 1.0]), 10, h => cel(goat, h.l, 0.1));
    s.ellipsoid(W([5.4, 4.6, 0]), W([0.6, 0, 0]), [0, 0.42, 0], W([0, 0, 1.9]), 10, h => cel(goat, h.l, 0.2));
    // the trucker cap: a foam front panel with a fish patch, a mesh back, a curved red brim
    s.ellipsoid(W([-0.2, 13.0, 0]), W([6.0, 0, 0]), [0, 3.3, 0], W([0, 0, 5.85]), 12, h => {
      if (h.q[1] < -0.1) return -1;
      if (h.q[0] > 0.18) {
        if (Math.abs(h.q[2]) < 0.28 && h.q[1] > 0.15 && h.q[1] < 0.6) return h.q[2] > 0.08 ? hex('#1a4a8a') : (h.q[1] > 0.4 ? hex('#f0c040') : hex('#2a6ab0'));
        return cel(FOAM, h.l, 0.05);
      }
      return (Math.floor(h.x) + Math.floor(h.y)) & 1 ? cel(CAP_RED, h.l, -0.25) : cel(CAP_RED, h.l, 0.05);
    });
    s.ellipsoid(W([0.1, 13.1, 0]), W([6.1, 0, 0]), [0, 0.7, 0], W([0, 0, 5.95]), 12, h => cel(CAP_RED, h.l, -0.4));
    s.ellipsoid(W([0.4, 16.2, 0]), W([0.8, 0, 0]), [0, 0.5, 0], W([0, 0, 0.8]), 12, h => cel(CAP_RED, h.l, 0.1));
    s.ellipsoid(W([5.2, 13.0, 0]), W([2.8, -0.5, 0]), [0, 0.38, 0], W([0, 0, 4.4]), 13, h => cel(CAP_RED, h.l, h.q[1] < 0 ? -0.5 : 0.1));
    // aviators: teardrop lenses, a gold bridge and arms back to the ears
    for (const z of [2.7, -2.7]) {
      s.ellipsoid(W([5.3, 7.4, z]), W([0.35, 0, 0]), W([0, 1.15, 0]), W([0, 0, 1.3]), 14, h => {
        if (h.q[1] > 0.4 && h.q[2] * Math.sign(z) < -0.1) return hex('#f6e6c8');
        return h.q[1] < -0.6 ? hex('#c89a34') : cel(LENS, h.l, h.q[1] > 0 ? 0.0 : -0.3);
      });
      s.limb(W([5.0, 8.6, z * 1.35]), W([0.4, 8.2, z * 1.9]), 0.18, 0.18, 14, h => cel(GOLD, h.l, 0.2, true));
    }
    s.limb(W([5.6, 8.3, 1.1]), W([5.6, 8.3, -1.1]), 0.2, 0.2, 14, h => cel(GOLD, h.l, 0.3, true));
    // the cigar: unlit, chewed, a gold band, out of the corner of his mouth
    s.limb(W([5.6, 3.3, 1.2]), W([8.4, 2.4, 3.2]), 0.5, 0.48, 15, h => (h.t > 0.62 && h.t < 0.72 ? cel(GOLD, h.l, 0.1) : h.t > 0.94 ? hex('#3a2416') : cel(CL.leather, h.l, 0.1)));
    // a bead of sweat at the temple, under the cap
    s.dot(W([2.4, 10.6, 5.0]), hex('#d8f4ff'), 1.1);
  },
};

// ================================================================== the clips
/** the hanky in the near hand (mopping his neck) */
HELD7.hanky = (s, J, P, _ch, hN) => {
  if (!hN) return;
  const flap = Math.sin((P.held?.t ?? 0) * TAU * 3) * 0.4;
  s.ellipsoid(hN.palm, [1.1, flap, 0], [0, 1.0, 0.2], [0, 0, 1.0], 50, (h: Hit) => cel(CL.white, h.l, (Math.floor(h.x + h.y) & 1) ? 0.1 : -0.05));
  s.limb(hN.palm, [hN.palm[0] - 0.4, hN.palm[1] - 2.2, hN.palm[2] + 0.4], 0.5, 0.3, 50, (h: Hit) => cel(CL.white, h.l, -0.1));
};
/** shifty glances up and down the lane; now and then he mops his neck with the hanky */
function hankIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b, { lean: -0.06, hip: [0.4 * k, b.hipH - 0.3 * k] });
  const mop = bump(t, 0.55, 0.85, 0.06), glance = Math.sin(TAU * t * 2) > 0.6 ? 1 : Math.sin(TAU * t * 2) < -0.7 ? -1 : 0;
  const br = Math.sin(TAU * t * 2);
  p.fl = { f: [-2.6 * k, b.ankleH], fa: -0.1 };
  p.bl = { f: [2.8 * k, b.ankleH], fa: 0.1 };
  const hip = p.hip;
  // thumbs hooked on the belly, or the hanky up at the back of his neck
  p.ba = { ik: [hip[0] + 3.4 * k, hip[1] + 0.8 * k + br * 0.2], hand: 'relax' };
  const neckP: [number, number] = [hip[0] + 1.0 * k, hip[1] + b.torso + 1.2 * k];
  const belly: [number, number] = [hip[0] + 2.6 * k, hip[1] + 0.4 * k];
  p.fa = { ik: [belly[0] + (neckP[0] - belly[0]) * mop + Math.sin(TAU * t * 6) * 0.6 * mop, belly[1] + (neckP[1] - belly[1]) * mop], hand: mop > 0.3 ? 'grip' : 'relax' };
  if (mop > 0.2) p.held = { kind: 'hanky', t };
  p.hd = [0.2 * k + glance * 0.3 * k, -0.1 * k];
  p.look = glance ? 'fwd' : 'cam';
  p.sq = 1 + br * 0.012;
  p.sway = 0.2;
  p.flags = { sx: glance * 0.3 * k };
  return p;
}
/** a rolling waddle, the belly leading, arms swinging wide */
const HANK_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.05, stance: 0.64, lift: 1.4 * K(b), bob: 0.5 * K(b), lean: -0.05, swing: 0.3, elbow: 0.3, elbowSwing: 0.15, drop: 0.3 * K(b), kick: 0, flight: 0, hand: 'relax', sway: 1.1 * K(b), roll: 0.09 });
registerOwn7('hank', 'idle', { info: { frames: 32, fps: 8, loop: true }, pose: hankIdle });
registerOwn7('hank', 'walk', { info: { frames: 12, fps: 11, loop: true }, pose: (b, t) => { const p = gait(b, t, HANK_WALK(b)); p.flags = { ...(p.flags ?? {}), aoN: 1.4, aoF: 1.4 }; return p; }, dist: b => gaitDist(HANK_WALK(b)) });

/** in the folding chair: legs apart, hands laced on the belly, chewing the cigar */
function hankSit(b: Build, t: number): Pose {
  const k = K(b);
  const p = sitP(b);
  const br = Math.sin(TAU * t);
  p.lean = -0.1;
  p.fl = { ...p.fl, f: [p.fl.f![0] + 0.8 * k, p.fl.f![1]] };
  const hip = p.hip;
  p.fa = { ik: [hip[0] + 5.6 * k, hip[1] + 4.8 * k + br * 0.2], hand: 'relax' };
  p.ba = { ik: [hip[0] + 5.0 * k, hip[1] + 4.2 * k + br * 0.2], hand: 'relax' };
  p.hd = [0.2 * k, 0];
  p.look = Math.sin(TAU * t * 2) > 0.5 ? 'fwd' : 'cam';
  p.sq = 1 + br * 0.015;
  return p;
}
/** dozing in the chair: slumped, head tipped back, the belly rising and falling */
function hankDoze(b: Build, t: number): Pose {
  const k = K(b);
  const p = sitP(b);
  const br = 0.5 + 0.5 * Math.sin(TAU * t);
  p.lean = -0.24 - br * 0.02;
  p.hip = [p.hip[0] + 1.0 * k, p.hip[1] - 0.6 * k];
  p.fl = { ...p.fl, f: [p.fl.f![0] + 2.4 * k, p.fl.f![1]] };
  p.bl = { ...p.bl, f: [p.bl.f![0] + 1.8 * k, p.bl.f![1]] };
  const hip = p.hip;
  p.fa = { ik: [hip[0] + 5.0 * k, hip[1] + 5.0 * k + br * 0.4], hand: 'relax' };
  p.ba = { ik: [hip[0] + 4.4 * k, hip[1] + 4.4 * k + br * 0.4], hand: 'relax' };
  p.hd = [-0.8 * k, -0.4 * k];
  p.look = 'up';
  p.sq = 1 + br * 0.03;
  return p;
}
registerAnim7('hankSit', { frames: 16, fps: 4, loop: true }, (b, t) => hankSit(b, t));
registerAnim7('hankDoze', { frames: 8, fps: 2, loop: true }, (b, t) => hankDoze(b, t));

// ================================================================== the portrait (dialogue, the notebook)
type Tone = [number, number, number, number];
const PW = 56, CX = 28;
const T = (h: string, o: Parameters<typeof tones>[1] = {}): Tone => tones(h, o) as Tone;
const mirror = (pts: Pt[]): Pt[] => [...pts, ...pts.slice(0, -1).reverse().map(([u, v]): Pt => [PW - u, v])];
const over = (b: PixelBuffer, x: number, y: number, c: number) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h && b.get(x, y) >>> 24) b.set(x, y, c); };
function aviators(b: PixelBuffer, S: number, ex: number, ey: number) {
  // two big teardrop lenses over the eyes, gold rims, a bar across the top, a glint each
  const rim = hex('#c89a34'), dark = hex('#1a0e0a'), mid = hex('#3a2014'), glint = hex('#fff0d0');
  for (const cx of [ex + 3.5, PW - ex - 3.5]) {
    const cy = ey + 2;
    for (let y = -4.6; y <= 4.2; y += 1 / S) for (let x = -5.2; x <= 5.2; x += 1 / S) {
      const yy = y < 0 ? y / 3.9 : y / 4.6, xx = x / (5 - Math.max(0, y) * 0.35);
      const d = xx * xx + yy * yy;
      if (d > 1) continue;
      const X = (cx + x) * S, Y = (cy + y) * S;
      over(b, X, Y, d > 0.8 ? rim : y < -1.5 ? mid : dark);
    }
    over(b, (cx - 2.4) * S, (cy - 1.8) * S, glint); over(b, (cx - 1.6) * S, (cy - 2.4) * S, glint);
  }
  for (let x = ex + 7; x < PW - ex - 7; x += 0.5 / S) over(b, x * S, (ey - 1.6) * S, rim);
}
const HANK_PORTRAIT: PortraitDesign = {
  skin: T('#eaa080', { sh: 0.12, deep: 0.28, hi: 0.06 }),
  eyes: 'man', iris: ['#10222c', '#3a5a6a', '#7a9aaa'], lash: '#2a1a14', brow: '#6a5248', browH: 2.5, browArch: 0.6,
  blush: '#e86a5a', blushK: 0.9, lip: '#9a4a3a', weathered: true, noseBridge: true, adam: false, stubble: '#7a5a4c',
  faceW: 1.3, chin: 0.6, neck: [8.2, 9.2],
  cheek: [CX - 11, 32, 4.6, 2.4],
  back(p: Pic, m: PortraitMats) {
    // the cap's mesh back and the greying hair over the ears
    const [, hs, hb] = T('#5a524e', { sh: 0.2 });
    p.fill([[CX - 16.6, 30], [CX - 17, 20], [CX + 17, 20], [CX + 16.6, 30], [CX + 13, 26], [CX - 13, 26]], hb, m.hairB);
    p.where([m.hairB], (u) => u > CX + 10, hs);
  },
  body(p: Pic, m: PortraitMats) {
    const shirt = T('#1aa0aa', { sh: 0.16 }), red = T('#e43a3e'), leaf = T('#2a7e2a'), skin = this.skin;
    const l = (a: number, b: number) => a + (b - a);
    p.fill(mirror([[l(3, -6), 60], [l(6, -4), 50.4], [l(14, 2), 45.6], [l(CX - 6, 10), 44.8], [CX, 44.6]]), shirt[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 12 || v > 58.2, shirt[1]);
    // the print: hibiscus and leaves
    for (const [x, y, r] of [[6, 52, 3.2], [16, 57, 2.8], [41, 51, 3.2], [50, 57, 2.8], [30, 59.5, 2.4]] as [number, number, number][]) {
      p.where([m.cloth], (u, v) => (u - x) ** 2 + (v - y) ** 2 < r * r, red[2]);
      p.where([m.cloth], (u, v) => (u - x) ** 2 + (v - y) ** 2 < 0.8, hex('#ffd84a'));
    }
    for (const [x, y] of [[11, 49], [46, 55], [22, 53]] as Pt[]) p.where([m.cloth], (u, v) => Math.abs((u - x) * 0.6 + (v - y) * 0.8) < 1.2 && Math.abs(-(u - x) * 0.8 + (v - y) * 0.6) < 2.6, leaf[2]);
    // sweat under the arms
    p.where([m.cloth], (u, v) => v > 52 && (u < 6 || u > PW - 6), shirt[0]);
    // the open collar on a hairy chest, the gold chain in it
    p.fill([[CX - 7, 44.6], [CX + 7, 44.6], [CX, 55]], skin[2], m.neck, { sharp: true });
    p.where([m.neck], (u, v) => v > 46 && ((u * 3 + v * 7) % 5) < 0.9, skin[0]);
    p.stroke([[CX - 5.4, 46], [CX - 2, 51], [CX, 51.8], [CX + 2, 51], [CX + 5.4, 46]], 0.8, 0.8, hex('#e0b232'), m.acc);
    p.fill([[CX - 11, 44], [CX - 3, 46.6], [CX - 6, 51], [CX - 12.6, 48]], shirt[3], m.cloth2);
    p.fill([[CX + 11, 44], [CX + 3, 46.6], [CX + 6, 51], [CX + 12.6, 48]], shirt[2], m.cloth2);
  },
  front(p: Pic, m: PortraitMats) {
    const red = T('#c02a20', { sh: 0.2, hi: 0.12 }), foam = T('#eeeee6', { sh: 0.12 }), goat = T('#6a4a3a', { sh: 0.16 });
    // the trucker cap: foam front with the fish patch, the red brim
    const mc = p.m(6, true, 0.5);
    p.fill([[CX - 15.6, 15], [CX - 14.6, 5], [CX - 6, 1.2], [CX + 6, 1.2], [CX + 14.6, 5], [CX + 15.6, 15]], foam[2], mc);
    p.where([mc], (u) => u > CX + 8, foam[1]);
    p.where([mc], (u, v) => u < CX - 11 || u > CX + 11, red[2]);
    p.where([mc], (u, v) => Math.abs(u - CX) < 4.6 && v > 4.6 && v < 10.6, hex('#2a6ab0'));
    p.where([mc], (u, v) => Math.abs(u - CX) < 2.6 && Math.abs(v - 7.6) < 1.2, hex('#f0c040'));
    const mb = p.m(7, true, 0.5);
    p.fill([[CX - 17, 17.4], [CX - 16, 13.8], [CX, 12.6], [CX + 16, 13.8], [CX + 17, 17.4], [CX + 8, 18.6], [CX, 18.8], [CX - 8, 18.6]], red[2], mb);
    p.where([mb], (u, v) => v > 16.4 || u > CX + 11, red[1]);
    // the goatee and a thin moustache
    p.fill([[CX - 4, 41.6], [CX + 4, 41.6], [CX + 3, 45.6], [CX, 46.8], [CX - 3, 45.6]], goat[2], m.beard);
    p.fill([[CX - 6.6, 37.2], [CX - 2, 36], [CX, 36.6], [CX + 2, 36], [CX + 6.6, 37.2], [CX, 37.4]], goat[2], m.acc);
    // the cigar out of the corner of his mouth
    p.stroke([[CX + 4, 39.4], [CX + 13, 41.6]], 1.6, 1.4, hex('#6a3a1e'), m.acc);
    p.stroke([[CX + 9, 40.4], [CX + 10, 40.6]], 1.7, 1.7, hex('#e0b232'), m.acc);
  },
  post(b) { aviators(b, 1, 16, 25); },
  postHD(b, S) { aviators(b, S, 16, 25); },
} as PortraitDesign;
NPC_PORTRAITS.hank = HANK_PORTRAIT;
void PixelBuffer;

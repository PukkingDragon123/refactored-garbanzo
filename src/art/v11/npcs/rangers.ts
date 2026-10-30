// V11 NPCs: the ranger family at the storm-battered station on the bush track.
//
//  Hine Parata (46)   senior ranger. Stocky and solid under a wide flat-brimmed ranger hat with a
//                     pinched crown; a khaki ranger shirt with green epaulettes and a fern badge, dark
//                     green work shorts, wool socks rolled over chunky boots, a taped-up radio on her
//                     belt. Waits hands on hips, scanning the tree line, checking her watch; walks
//                     brisk and purposeful.
//  Doug McKenzie (52) her husband, a Scots-born ranger and hopeless birder: very tall and thin, a mop
//                     of ginger-grey curls, a huge beard, round specs, knee socks with red garter
//                     flashes. Waits with the binoculars up, sweeping the canopy, then points; walks in
//                     long bouncy lopes.
//  Rosie (9)          their daughter, Junior Ranger: a huge floppy yellow sun hat, ginger bunches,
//                     freckles, denim overalls over a striped tee, red gumboots, a bug jar. Bounces on
//                     her heels peering into the jar; skips everywhere.

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Char7, Part } from '../../v7/body';
import type { HeadDef7, FaceMark, HeadExpr7 } from '../../v7/head';
import { HEADS7 } from '../../v7/head';
import { JENNA7 } from '../../v7/cast';
import type { Build, Pose } from '../../people-rig';
import { stand } from '../../anime/anims';
import { registerOwn7, gait, gaitDist, wHead } from '../../v7/anims7';
import type { Gait } from '../../v7/anims7';
import { radio, tEll, tLimb, GG } from '../../v7/gear';
import { R6, L, lb, frac, bump, smooth, K, TAU, SKIN, CL, HAIR, brimHat, beard, specs } from './kit';

// ================================================================== Hine
const HS = SKIN.brown;
const H = { shirt: CL.khaki, shorts: CL.ranger, sock: R6('#2a2820', '#5a5648', '#8a8470', '#b8b098', '#d4ccb4', '#ece6d2'), hat: CL.tan };
export const HINE7: Char7 = {
  id: 'hine',
  build: { hipH: 25.4, thigh: 12, shin: 11.8, ankleH: 2.2, torso: 18.6, neck: 1.1, shY: 2.4, shF: 0, shB: 0, upArm: 9.0, foreArm: 8.2, legF: 0, legB: 0 },
  shW: 5.6, hipW: 3.2, chest: [3.9, 5.0], waist: [3.5, 4.5], pelvis: [3.7, 4.5],
  armR: [2.15, 1.8, 1.42], legR: [2.75, 2.05, 1.6], neckR: 1.6, hand: 1.08,
  skin: HS, ink: hex('#140a08'),
  torso(p) {
    const l = L(p);
    // belt with a square buckle
    if (p.hh > 0.08 && p.hh < 0.17) return p.f > 2.6 && Math.abs(p.z) < 0.9 ? hex('#c8a040') : cel(CL.leather, l, 0.05);
    if (p.hh <= 0.08) return cel(H.shorts, l);
    // open collar at the throat
    if (p.hh > 0.88 && p.f > 1.4 && Math.abs(p.z) < (p.hh - 0.88) * 18) return cel(HS, l, -0.15);
    // green epaulettes on the shoulders
    if (p.hh > 0.9 && Math.abs(p.z) > 2.4) return cel(H.shorts, l, 0.05);
    // the fern badge on the near chest pocket, both pockets with flaps
    if (p.f > 2.2 && p.z > 0.8 && p.z < 3.0 && p.hh > 0.6 && p.hh < 0.68) return Math.abs(p.z - 1.9) < 0.42 && p.hh > 0.62 ? hex('#e8e0c0') : cel(H.shirt, l, -0.35);
    if (p.f > 2.2 && Math.abs(p.z) > 0.8 && Math.abs(p.z) < 3.0 && p.hh > 0.5 && p.hh < 0.6) return cel(H.shirt, l, -0.12);
    // the placket
    if (p.f > 2.6 && Math.abs(p.z) < 0.25 && p.hh > 0.2) return cel(H.shirt, l, -0.3);
    return cel(H.shirt, l);
  },
  // short sleeves rolled once over strong arms
  upperArm(p) { return p.t < 0.45 ? cel(H.shirt, L(p), lb(p)) : p.t < 0.55 ? cel(H.shirt, L(p), lb(p) - 0.32) : cel(HS, L(p), lb(p)); },
  foreArm(p) { return p.near && p.t > 0.84 && p.t < 0.94 ? cel(CL.black, L(p), 0.2) : cel(HS, L(p), lb(p)); },
  hands(p) { return cel(HS, L(p), lb(p) + 0.08); },
  thigh(p) { return p.t < 0.5 ? cel(H.shorts, L(p), lb(p) + (p.t > 0.44 ? -0.3 : 0)) : cel(HS, L(p), lb(p)); },
  // wool socks rolled down at mid-shin, a green band, into the boots
  shin(p) {
    if (p.t < 0.42) return cel(HS, L(p), lb(p));
    if (p.t < 0.52) return cel(H.sock, L(p), lb(p) + (p.t < 0.47 ? 0.15 : -0.25));
    if (p.t < 0.58) return cel(H.shorts, L(p), lb(p));
    return cel(H.sock, L(p), lb(p));
  },
  shoe(p) { return p.hit.q[1] < -0.4 ? CL.boot[0] : cel(CL.boot, L(p), lb(p) + 0.05); },
  shoeK: [1.12, 1.18, 1.1],
  bootTop: { t: 0.8, r: 0.35, mat: p => cel(CL.boot, L(p), lb(p)) },
  skirt: { len: 2.6, flare: 0.5, mat: p => cel(H.shirt, L(p), p.t > 0.7 ? -0.3 : 0) },
  extras(s, J, _P, ch) {
    // the radio on her belt, wound with grey tape where the storm cracked it
    radio(s, J, [ch.build.torso * 0.12, 0.9, ch.hipW + 1.7]);
    tEll(s, J, [ch.build.torso * 0.12, 0.9, ch.hipW + 2.0], [0.62, 0.4, 0.82], GG.clip, h => cel(CL.grey, h.l, 0.2));
  },
};
const HINE_HEAD: HeadDef7 = {
  ...HEADS7.aroha,
  skin: HS, hair: HAIR.greyBlack, ink: hex('#140a08'),
  // a rounder, fuller face: soft jaw, a broad nose, laugh lines
  skull: [[0.1, 7.9, 0], [4.8, 5.4, 4.3]],
  jaw: [[1.6, 4.4, 0], [3.6, 3.3, 3.5]],
  chin: [[3.5, 2.5, 0], [1.5, 1.3, 1.7]],
  nose: [[5.0, 5.7, 0], [0.95, 0.9, 0.85]],
  eyeCol: '#120806', brow: '#1a1210', blush: '#b85c48',
  shell: [[-0.6, 8.8, 0], [5.2, 5.6, 4.8]],
  cut: q => q[0] > 0.3 && q[1] < 0.46,
  locks: [
    // hair drawn back under the hat, a grey streak at the temple
    { a: [2.4, 11.0, 4.0], b: [-3.0, 9.4, 3.4], r0: 1.1, r1: 0.9 },
    { a: [2.4, 11.0, -4.0], b: [-3.0, 9.4, -3.4], r0: 1.1, r1: 0.9 },
  ],
  extras(s, W, o) {
    // a low bun at the nape
    s.ellipsoid(W([-4.6, 6.6, 0]), W([2.0, 0, 0]), W([0, 1.8, 0]), W([0, 0, 2.2]), 3, h => cel(HAIR.greyBlack, h.l, Math.sin(h.x * 2 + h.y) > 0.7 ? 0.4 : 0));
    brimHat({ y: 12.0, r: 8.4, crown: [3.8, 4.7], col: H.hat, band: CL.ranger, pinch: true, tilt: 0.06 })(s, W, o);
  },
  eyePaint: undefined, mouthPaint: undefined,
};

/** hands on hips, weight shifting, a slow look along the tree line; every few seconds a glance at her watch */
function hineIdle(b: Build, t: number): Pose {
  const k = K(b);
  const br = Math.sin(TAU * t * 2), sh = Math.sin(TAU * t);
  const p = stand(b);
  const watch = bump(t, 0.55, 0.85, 0.08);
  p.hip = [0.4 * k * sh, b.hipH - 0.6 * k + br * 0.15 * k];
  p.lean = 0.02 + br * 0.008;
  p.fl = { f: [-2.6 * k, b.ankleH] };
  p.bl = { f: [2.8 * k, b.ankleH] };
  const hip = p.hip;
  const onHipN: [number, number] = [hip[0] + 1.2 * k, hip[1] + 1.8 * k];
  const watchAt: [number, number] = [hip[0] + 5.2 * k, hip[1] + b.torso * 0.62];
  p.fa = { ik: [onHipN[0] + (watchAt[0] - onHipN[0]) * watch, onHipN[1] + (watchAt[1] - onHipN[1]) * watch], hand: watch > 0.5 ? 'fist' : 'fist', palm: watch > 0.5 ? 'up' : 'in' };
  p.ba = { ik: [hip[0] - 1.4 * k, hip[1] + 1.8 * k], hand: 'fist' };
  p.flags = { aoN: 2.6 * (1 - watch), aoF: 2.6, sx: 0.4 * k * sh };
  p.look = watch > 0.5 ? 'down' : 'fwd';
  p.hd = [0.2 * k + sh * 0.3 * k, 0];
  p.sway = 0.2;
  return p;
}
const HINE_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.32, stance: 0.58, lift: 2.0 * K(b), bob: 0.6 * K(b), lean: 0.08, swing: 0.5, elbow: 0.55, elbowSwing: 0.3, drop: 0.35 * K(b), kick: 0.2, flight: 0, hand: 'fist', sway: 0.45 * K(b), roll: 0.03 });
registerOwn7('hine', 'idle', { info: { frames: 24, fps: 8, loop: true }, pose: hineIdle });
registerOwn7('hine', 'walk', { info: { frames: 12, fps: 15, loop: true }, pose: (b, t) => gait(b, t, HINE_WALK(b)), dist: b => gaitDist(HINE_WALK(b)) });

// ================================================================== Doug
const DS = SKIN.fair;
const D = { shirt: CL.tan, shorts: CL.ranger, sock: CL.olive };
export const DOUG7: Char7 = {
  id: 'doug',
  // very tall and thin: long legs, long arms, a narrow chest
  build: { hipH: 31.5, thigh: 15.2, shin: 14.8, ankleH: 2.3, torso: 20.5, neck: 1.8, shY: 2.4, shF: 0, shB: 0, upArm: 10.8, foreArm: 9.6, legF: 0, legB: 0 },
  shW: 5.3, hipW: 2.6, chest: [3.0, 4.4], waist: [2.4, 3.2], pelvis: [2.6, 3.3],
  armR: [1.75, 1.45, 1.2], legR: [2.1, 1.6, 1.25], neckR: 1.4, hand: 1.12,
  skin: DS, ink: hex('#1a0e10'),
  torso(p) {
    const l = L(p);
    if (p.hh > 0.07 && p.hh < 0.15) return cel(CL.leather, l, 0.05);
    if (p.hh <= 0.07) return cel(D.shorts, l);
    // open collar, a tuft of ginger chest hair
    if (p.hh > 0.86 && p.f > 1.2 && Math.abs(p.z) < (p.hh - 0.86) * 20) return Math.sin(p.hit.x * 3 + p.hit.y * 2) > 0.5 ? cel(HAIR.gingerGrey, l, 0) : cel(DS, l, -0.1);
    if (p.hh > 0.9 && Math.abs(p.z) > 2.2) return cel(D.shorts, l, 0.05);
    // the binocular strap round his neck, down to the chest
    if (p.f > 1.6 && Math.abs(Math.abs(p.z) - (0.6 + (1 - p.hh) * 4.2)) < 0.42 && p.hh > 0.62) return cel(CL.black, l, 0.2);
    if (p.f > 2.0 && Math.abs(p.z) > 0.7 && Math.abs(p.z) < 2.8 && p.hh > 0.48 && p.hh < 0.6) return cel(D.shirt, l, -0.14);
    return cel(D.shirt, l);
  },
  upperArm(p) { return p.t < 0.4 ? cel(D.shirt, L(p), lb(p)) : p.t < 0.5 ? cel(D.shirt, L(p), lb(p) - 0.32) : cel(DS, L(p), lb(p)); },
  // freckled, sunburnt forearms
  foreArm(p) { return ((p.hit.x * 5 + p.hit.y * 3) % 7) === 0 && L(p) > -0.2 ? cel(DS, L(p), lb(p) - 0.45) : cel(DS, L(p), lb(p)); },
  hands(p) { return cel(DS, L(p), lb(p) + 0.08); },
  thigh(p) { return p.t < 0.46 ? cel(D.shorts, L(p), lb(p) + (p.t > 0.4 ? -0.3 : 0)) : cel(DS, L(p), lb(p)); },
  // knee socks with red garter flashes under the turn-down
  shin(p) {
    if (p.t < 0.1) return cel(DS, L(p), lb(p));
    if (p.t < 0.2) return p.near && p.t > 0.16 && Math.sin(p.hit.q[1]) > 0.3 ? cel(CL.red, L(p), 0.1) : cel(D.sock, L(p), lb(p) + (p.t < 0.15 ? 0.15 : -0.2));
    return cel(D.sock, L(p), lb(p) + (frac(p.hit.q[1] * 1.4) < 0.2 ? -0.15 : 0));
  },
  shoe(p) { return p.hit.q[1] < -0.4 ? CL.boot[0] : cel(CL.boot, L(p), lb(p) + 0.05); },
  shoeK: [1.18, 1.1, 1.02],
  skirt: { len: 2.6, flare: 0.4, mat: p => cel(D.shirt, L(p), p.t > 0.7 ? -0.3 : 0) },
  extras(s, J, P, ch) {
    // the binoculars hanging at his chest (unless they're up at his eyes)
    if (P.held?.kind === 'binoculars') return;
    const T = ch.build.torso;
    for (const z of [-0.9, 0.9]) tLimb(s, J, [T * 0.6, ch.chest[0] + 1.3, z], [T * 0.6 - 2.2, ch.chest[0] + 1.5, z], 0.82, 0.86, GG.tool, h => (h.t > 0.9 ? cel(CL.steel, h.l, 0.3, true) : cel(CL.black, h.l, 0.12, true)));
  },
};
const DOUG_HEAD: HeadDef7 = {
  ...HEADS7.mori,
  skin: DS, hair: HAIR.gingerGrey, ink: hex('#1a0e10'),
  // a long face and a long nose, mostly beard
  skull: [[0.1, 8.2, 0], [4.7, 5.7, 4.1]],
  jaw: [[1.6, 4.1, 0], [3.3, 3.4, 3.0]],
  nose: [[5.1, 5.8, 0], [1.2, 1.1, 0.75]],
  eyeCol: '#2a4a5a', brow: '#8a5a3a', blush: '#f08a78',
  shell: [[-0.4, 9.4, 0], [5.6, 6.0, 5.1]],
  cut: q => q[0] > 0.35 && q[1] < 0.28,
  // a mop of curls: short fat tufts all over
  locks: [
    ...[[2.4, 13.6, 2.6], [3.0, 14.2, 0.2], [2.6, 13.6, -2.4], [0.2, 15.2, 1.6], [-0.2, 15.4, -1.4], [-2.6, 14.4, 2.4], [-2.8, 14.6, -1.2], [-4.6, 12.4, 2.6], [-5.0, 12.2, -1.6], [-5.2, 9.4, 1.0], [1.0, 12.4, 4.6], [1.0, 12.4, -4.6]]
      .map(([x, y, z]) => ({ a: [x * 0.8, y - 1.6, z * 0.8] as [number, number, number], b: [x * 1.05, y, z * 1.05] as [number, number, number], r0: 1.9, r1: 1.2, sway: 0.2 })),
  ],
  extras(s, W, o) {
    beard(HAIR.gingerGrey, { long: 2.2, w: 1.05 })(s, W, o);
    specs([4.2, 7.0, 2.3], CL.black, { r: 1.2 })(s, W, o);
  },
};

/** binoculars up, sweeping the canopy; down; a sudden point and a delighted bounce */
function dougIdle(b: Build, t: number): Pose {
  const k = K(b);
  const br = Math.sin(TAU * t * 2);
  const p = stand(b);
  const up = bump(t, 0.02, 0.6, 0.08), pt = bump(t, 0.66, 0.94, 0.05);
  const scan = Math.sin(TAU * t * 1.6) * up;
  p.hip = [0, b.hipH - 0.3 * k + br * 0.12 * k + pt * Math.abs(Math.sin(TAU * t * 6)) * 0.6 * k];
  p.lean = -0.05 * up + 0.02;
  p.fl = { f: [-2.0 * k, b.ankleH] };
  p.bl = { f: [2.4 * k, b.ankleH] };
  const hip = p.hip;
  void hip;
  if (up > 0.3) {
    p.hd = [0.2 * k, scan * 0.4 * k];
    const eye = wHead(b, p, 4.2, 5.6);
    p.fa = { ik: [eye[0] - 0.4, eye[1] - 1.4], hand: 'grip' };
    p.ba = { ik: [eye[0] + 0.6, eye[1] - 1.8], hand: 'grip' };
    p.flags = { wN: 1, wF: 1, zN: 1.6, zF: -0.8, aoN: 0, aoF: 0 };
    p.front = ['armF', 'armB'];
    p.held = { kind: 'binoculars' };
    p.look = scan > 0.3 ? 'up' : 'fwd';
  } else {
    p.fa = pt > 0.2 ? { a: 1.9 + pt * 0.5, e: 0.1, hand: 'point' } : { a: 0.08, e: 0.3, hand: 'relax' };
    p.ba = { a: -0.08, e: 0.4, hand: 'relax' };
    p.look = pt > 0.2 ? 'up' : 'fwd';
    p.hd = [0.2 * k, 0];
  }
  p.sway = 0.3 + pt * 0.5;
  return p;
}
const DOUG_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.55, stance: 0.56, lift: 3.4 * K(b), bob: 1.5 * K(b), lean: 0.02, swing: 0.52, elbow: 0.3, elbowSwing: 0.3, drop: 0.3 * K(b), kick: 0.7, flight: 0, hand: 'relax', sway: 0.25 * K(b), roll: 0.02, headBob: 1 });
registerOwn7('doug', 'idle', { info: { frames: 32, fps: 8, loop: true }, pose: dougIdle });
registerOwn7('doug', 'walk', { info: { frames: 12, fps: 13, loop: true }, pose: (b, t) => gait(b, t, DOUG_WALK(b)), dist: b => gaitDist(DOUG_WALK(b)) });

// ================================================================== Rosie
const RS = SKIN.fair;
const RO = { tee: CL.red, denim: CL.denim, boot: CL.rubberRed, hat: CL.yellow };
export const ROSIE7: Char7 = {
  ...JENNA7, id: 'rosie',
  build: { ...JENNA7.build, hipH: 16.2, thigh: 7.7, shin: 7.4, ankleH: 1.9, torso: 12.2, neck: 0.9, upArm: 6.0, foreArm: 5.4 },
  shW: 3.4, hipW: 2.2, chest: [2.6, 3.2], waist: [2.5, 3.0], pelvis: [2.6, 3.1],
  armR: [1.35, 1.15, 0.98], legR: [1.65, 1.3, 1.1], neckR: 1.05, hand: 0.84,
  skin: RS, ink: hex('#1a0e10'),
  torso(p) {
    const l = L(p);
    // overalls: the bib over the chest with its straps, a front pocket; the striped tee shows at the sides
    const bib = p.f > 0.6 && Math.abs(p.z) < 1.9 && p.hh < 0.74;
    const strap = Math.abs(Math.abs(p.z) - 1.5) < 0.45 && p.hh >= 0.74;
    if (p.hh < 0.3 || bib || strap) {
      if (bib && p.hh > 0.5 && p.hh < 0.66 && Math.abs(p.z) < 1.0) return cel(RO.denim, l, -0.2);
      if (strap && p.hh > 0.72 && p.hh < 0.78 && p.f > 1) return hex('#e0c060');
      return cel(RO.denim, l);
    }
    return frac(p.hh * 7) < 0.45 ? cel(CL.white, l) : cel(RO.tee, l);
  },
  upperArm(p) { return p.t < 0.5 ? (frac(p.t * 4) < 0.5 ? cel(CL.white, L(p), lb(p)) : cel(RO.tee, L(p), lb(p))) : cel(RS, L(p), lb(p)); },
  foreArm(p) { return cel(RS, L(p), lb(p)); },
  hands(p) { return cel(RS, L(p), lb(p) + 0.1); },
  thigh(p) { return cel(RO.denim, L(p), lb(p)); },
  shin(p) { return p.t < 0.3 ? cel(RO.denim, L(p), lb(p) + (p.t > 0.24 ? -0.3 : 0)) : cel(RO.boot, L(p), lb(p) + 0.05, true); },
  shoe(p) { return p.hit.q[1] < -0.4 ? RO.boot[1] : cel(RO.boot, L(p), lb(p) + 0.05, true); },
  shoeK: [1.1, 1.15, 1.1],
  bootTop: { t: 0.3, r: 0.45, mat: p => cel(RO.boot, L(p), lb(p) + 0.1, true) },
  skirt: undefined,
};
const ROSIE_HEAD: HeadDef7 = {
  ...HEADS7.jenna,
  skin: RS, hair: HAIR.ginger, ink: hex('#1a0e10'), eyeCol: '#2a4a2a', brow: '#a0502a', blush: '#f08070',
  // ginger bunches sticking out sideways under the hat, a short fringe
  locks: [
    ...[-2, 0, 2].map(z => ({ a: [2.6, 12.0, z] as [number, number, number], b: [4.8, 9.6, z * 1.1] as [number, number, number], r0: 1.5, r1: 0.6 })),
    { a: [-1.0, 8.4, 4.6], b: [-1.6, 4.2, 7.4], r0: 1.6, r1: 1.0, sway: 1 }, { a: [-1.0, 8.4, -4.6], b: [-1.6, 4.2, -7.4], r0: 1.6, r1: 1.0, sway: 1 },
  ],
  browHidden: true,
  extras(s, W, o) {
    // hair ties at the bunches
    for (const z of [5.2, -5.2]) s.ellipsoid(W([-1.1, 7.6, z]), W([0.8, 0, 0]), W([0, 0.8, 0]), W([0, 0, 0.6]), 4, h => cel(CL.red, h.l, 0.2));
    // the floppy sun hat: a big soft brim, drooping
    brimHat({ y: 11.8, r: 9.4, crown: [3.4, 4.9], col: RO.hat, band: CL.red, tilt: 0.16, droop: 0.25 })(s, W, o);
  },
  eyePaint: freckleEye,
  face: { ...HEADS7.jenna.face, freckles: true },
};
/** dot eyes with a dusting of freckles across the cheeks */
function freckleEye(mark: FaceMark, x: number, y: number, inner: 1 | -1, _far: boolean, eye: HeadExpr7['eye'], ex: HeadExpr7, d: HeadDef7) {
  const eyeC = hex(d.eyeCol);
  if (eye === 'closed') { mark(x, y, eyeC); mark(x - inner, y, eyeC); }
  else if (eye === 'happy') { mark(x, y - 1, eyeC); mark(x - 1, y, eyeC); mark(x + 1, y, eyeC); }
  else if (eye === 'wide') { mark(x, y, eyeC); mark(x, y - 1, eyeC); }
  else mark(x, y, eyeC);
  const fr = hex('#c86a4a');
  mark(x - inner, y + 2, fr); mark(x + inner * 0, y + 3, fr);
  if (ex.blush) mark(x - inner * 2, y + 2, hex(d.blush));
}

/** bouncing on her heels, the bug jar held up to her nose; now and then a big hop of excitement */
function rosieIdle(b: Build, t: number): Pose {
  const k = K(b);
  const bounce = Math.abs(Math.sin(TAU * t * 3));
  const hop = bump(t, 0.7, 0.9, 0.06);
  const p = stand(b);
  p.hip = [0, b.hipH - 0.4 * k + bounce * 0.5 * k + hop * 2.4 * k];
  const lift = bounce * 0.5 * k + hop * 2.4 * k;
  p.fl = { f: [-1.2 * k, b.ankleH + Math.max(0, lift - 0.6 * k)], fa: -0.3 * bounce };
  p.bl = { f: [1.4 * k, b.ankleH + Math.max(0, lift - 0.6 * k)], fa: -0.3 * bounce };
  const hip = p.hip;
  const jar: [number, number] = [hip[0] + 3.6 * k, hip[1] + b.torso * 0.86 + hop * 2 * k];
  p.fa = { ik: [jar[0], jar[1] - 0.3 * k], hand: 'grip' };
  p.ba = { ik: [jar[0] - 0.4 * k, jar[1] - 1.2 * k], hand: 'grip' };
  p.held = { kind: 'bugjar', t };
  p.lean = 0.12;
  p.look = hop > 0.3 ? 'up' : 'down';
  p.hd = [0.4 * k, 0];
  p.sway = 0.5 + bounce * 0.4;
  return p;
}
/** a skip: hop, step, hop, step */
const ROSIE_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.4, stance: 0.42, lift: 3.6 * K(b), bob: 1.4 * K(b), lean: 0.06, swing: 0.7, elbow: 0.9, elbowSwing: 0.5, drop: 0.4 * K(b), kick: 1.2, flight: 1.2 * K(b), hand: 'open', sway: 0.4 * K(b), armOut: 1.2 });
registerOwn7('rosie', 'idle', { info: { frames: 24, fps: 9, loop: true }, pose: rosieIdle });
registerOwn7('rosie', 'walk', { info: { frames: 12, fps: 16, loop: true }, pose: (b, t) => { const p = gait(b, t, ROSIE_WALK(b)); p.flags = { ...(p.flags ?? {}), hair: 1 }; return p; }, dist: b => gaitDist(ROSIE_WALK(b)) });

export const RANGER_HEADS = { hine: HINE_HEAD, doug: DOUG_HEAD, rosie: ROSIE_HEAD };
void smooth; void tEll; void ({} as Part);

// V11 NPCs: the Helix Bioprospecting team camped on the Serpent Coast (the zigzag boot prints, the
// yellow sample tags, the smoke on the east headland).
//
//  Dr Celeste Varga (36)  the lead scientist. Tall and sleek: a sharp asymmetric black bob with
//                         sunglasses pushed up in it, a white field jacket with safety-yellow yoke panels
//                         and the helix logo, slim black trousers, tall black boots, a tablet. Waits
//                         tapping the tablet, glancing at her watch, a foot tapping; walks heel-first,
//                         upright and quick.
//  Teo Lindqvist (27)     the field tech: a gentle giant in enormous zigzag-tread boots, a yellow
//                         beanie, a grey-and-yellow rain shell, cargo trousers and an overloaded pack
//                         bristling with sample tubes and a yellow flag pole. Waits fidgeting, rubbing
//                         the back of his neck, adjusting the beanie; walks heavy, a little hunched.

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Char7 } from '../../v7/body';
import type { HeadDef7 } from '../../v7/head';
import { HEADS7 } from '../../v7/head';
import type { Build, Pose } from '../../people-rig';
import { stand } from '../../anime/anims';
import { registerOwn7, gait, gaitDist } from '../../v7/anims7';
import type { Gait } from '../../v7/anims7';
import { tEll, tLimb, GG, backpack } from '../../v7/gear';
import { L, lb, frac, bump, K, TAU, SKIN, CL, HAIR, specs } from './kit';

// ================================================================== Celeste
const CS = SKIN.olive;
export const CELESTE7: Char7 = {
  id: 'celeste',
  build: { hipH: 28.4, thigh: 13.6, shin: 13.4, ankleH: 2.2, torso: 17.8, neck: 1.6, shY: 2.2, shF: 0, shB: 0, upArm: 9.0, foreArm: 8.2, legF: 0, legB: 0 },
  shW: 4.7, hipW: 2.7, chest: [3.0, 4.0], waist: [2.3, 3.0], pelvis: [2.8, 3.5],
  armR: [1.75, 1.45, 1.15], legR: [2.2, 1.6, 1.25], neckR: 1.3, hand: 1.0,
  skin: CS, ink: hex('#120c10'),
  torso(p) {
    const l = L(p);
    if (p.hh < 0.1) return cel(CL.black, l, 0.05);
    // a high collar zipped to the chin, yellow yoke panels across the shoulders, the zip
    if (p.hh > 0.92) return cel(CL.white, l, 0.1);
    if (p.hh > 0.74 && Math.abs(p.z) > 1.6) return cel(CL.yellow, l, 0);
    if (p.f > 2.4 && Math.abs(p.z) < 0.18) return cel(CL.grey, l, 0.2);
    // the helix logo on the near chest
    if (p.f > 2.0 && p.z > 0.9 && p.z < 2.4 && p.hh > 0.58 && p.hh < 0.72) return Math.abs(Math.sin((p.hh - 0.58) * 45) * 0.6 - (p.z - 1.65)) < 0.24 ? hex('#c89a10') : cel(CL.white, l);
    // a reflective band at the hem
    if (p.hh < 0.17) return cel(CL.grey, l, 0.35, true);
    return cel(CL.white, l);
  },
  upperArm(p) { return p.t < 0.3 ? cel(CL.yellow, L(p), lb(p)) : cel(CL.white, L(p), lb(p)); },
  foreArm(p) { return p.t > 0.88 ? cel(CL.grey, L(p), lb(p)) : p.near && p.t > 0.8 ? cel(CL.black, L(p), 0.3, true) : cel(CL.white, L(p), lb(p)); },
  hands(p) { return cel(CS, L(p), lb(p) + 0.08); },
  thigh(p) { return cel(CL.black, L(p), lb(p) + 0.08); },
  shin(p) { return cel(CL.black, L(p), lb(p) + (p.t > 0.3 ? 0.18 : 0.06), p.t > 0.3); },
  shoe(p) { return p.hit.q[1] < -0.4 ? CL.black[0] : cel(CL.black, L(p), lb(p) + 0.15, true); },
  bootTop: { t: 0.3, r: 0.3, mat: p => cel(CL.black, L(p), lb(p) + 0.2, true) },
  skirt: { len: 3.2, flare: 0.5, mat: p => cel(CL.white, L(p), p.t > 0.8 ? -0.3 : 0) },
};
const CELESTE_HEAD: HeadDef7 = {
  ...HEADS7.jenna,
  skin: CS, hair: HAIR.raven, ink: hex('#120c10'), eyeCol: '#1a2a22', brow: '#16121a', blush: '#d08070',
  skull: [[0.1, 7.9, 0], [4.6, 5.3, 4.0]],
  jaw: [[1.5, 4.3, 0], [3.3, 3.0, 2.8]],
  chin: [[3.5, 2.4, 0], [1.2, 1.1, 1.2]],
  // the bob: sharp, longer on the near side, a hard side fringe
  locks: [
    { a: [2.6, 12.8, -2.6], b: [5.0, 10.0, 2.6], r0: 1.8, r1: 0.7 }, { a: [2.8, 12.6, 0.4], b: [5.2, 9.8, 3.8], r0: 1.6, r1: 0.6 },
    { a: [1.2, 10, 4.6], b: [2.6, 2.0, 5.4], r0: 2.0, r1: 1.0, sway: 0.4 }, { a: [1.2, 10, -4.6], b: [2.2, 4.6, -5.4], r0: 1.8, r1: 0.9, sway: 0.4 },
    { a: [-1.6, 10, 4.4], b: [-1.6, 2.4, 5.6], r0: 2.3, r1: 1.0, sway: 0.6 }, { a: [-1.6, 10, -4.4], b: [-1.6, 4.4, -5.4], r0: 2.2, r1: 1.0, sway: 0.6 },
    { a: [-3.8, 9.8, 1.6], b: [-5.0, 4.6, 2.4], r0: 2.4, r1: 1.0, sway: 0.6 }, { a: [-3.8, 9.8, -1.6], b: [-5.0, 4.6, -2.4], r0: 2.4, r1: 1.0, sway: 0.6 },
  ],
  browHidden: false,
  extras(s, W, o) {
    // sunglasses pushed up on her head
    specs([2.6, 13.4, 2.4], CL.black, { sun: true, r: 1.3 })(s, W, o);
  },
};
/** tapping at the tablet, a glance at the watch, the foot tapping impatiently */
function celesteIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b);
  const tap = Math.max(0, Math.sin(TAU * t * 8)) * (1 - bump(t, 0.6, 0.85, 0.06));
  const watch = bump(t, 0.6, 0.85, 0.06);
  p.hip = [0, b.hipH - 0.3 * k];
  p.lean = 0.0;
  p.fl = { f: [-1.4 * k, b.ankleH + Math.max(0, Math.sin(TAU * t * 4)) * 0.5 * k * (1 - watch)], fa: 0.35 * Math.max(0, Math.sin(TAU * t * 4)) * (1 - watch) };
  p.bl = { f: [1.6 * k, b.ankleH] };
  const hip = p.hip;
  const pad: [number, number] = [hip[0] + 4.2 * k, hip[1] + b.torso * 0.62];
  p.ba = { ik: [pad[0] - 0.2 * k, pad[1] - 0.4 * k], hand: 'flat', palm: 'up' };
  p.fa = watch > 0.3 ? { ik: [pad[0] + 0.6 * k, pad[1] + 1.4 * k], hand: 'fist', palm: 'up' } : { ik: [pad[0] + 0.8 * k, pad[1] + 0.6 * k + tap * 0.5 * k], hand: 'point' };
  p.held = { kind: 'tablet', t };
  p.look = 'down';
  p.hd = [0.3 * k, 0];
  p.sway = 0.1;
  return p;
}
const CELESTE_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.25, stance: 0.6, lift: 1.9 * K(b), bob: 0.5 * K(b), lean: -0.02, swing: 0.22, elbow: 0.5, elbowSwing: 0.2, drop: 0.2 * K(b), kick: 0.3, flight: 0, hand: 'relax', sway: 0.6 * K(b), roll: 0.03 });
registerOwn7('celeste', 'idle', { info: { frames: 24, fps: 8, loop: true }, pose: celesteIdle });
registerOwn7('celeste', 'walk', { info: { frames: 12, fps: 17, loop: true }, pose: (b, t) => { const p = gait(b, t, CELESTE_WALK(b)); p.held = { kind: 'tablet', t }; p.ba = { ik: [p.hip[0] + 3.8 * K(b), p.hip[1] + b.torso * 0.58], hand: 'flat', palm: 'up' }; return p; }, dist: b => gaitDist(CELESTE_WALK(b)) });

// ================================================================== Teo
const TS = SKIN.fair;
const SHELL = CL.grey;
export const TEO7: Char7 = {
  id: 'teo',
  // big and broad, soft round shoulders, long legs in baggy cargo trousers
  build: { hipH: 30.2, thigh: 14.4, shin: 14.0, ankleH: 2.6, torso: 21.4, neck: 1.2, shY: 2.8, shF: 0, shB: 0, upArm: 10.6, foreArm: 9.6, legF: 0, legB: 0 },
  shW: 7.0, hipW: 3.4, chest: [4.4, 6.0], waist: [4.0, 5.2], pelvis: [3.9, 4.8], belly: 1.2,
  armR: [2.6, 2.2, 1.8], legR: [3.0, 2.4, 2.0], neckR: 2.2, hand: 1.36,
  skin: TS, ink: hex('#1a1210'),
  torso(p) {
    const l = L(p);
    if (p.hh < 0.06) return cel(CL.khaki, l, -0.1);
    // a grey shell with a yellow yoke, pocket flaps, a rolled hood at the neck
    if (p.hh > 0.93) return cel(SHELL, l, -0.1);
    if (p.hh > 0.72 && (Math.abs(p.z) > 2.2 || p.f < 0)) return cel(CL.yellow, l, 0);
    if (p.f > 2.6 && Math.abs(p.z) < 0.2) return cel(CL.charcoal, l, 0.2);
    if (p.f > 2.6 && Math.abs(p.z) > 1 && Math.abs(p.z) < 3.6 && p.hh > 0.22 && p.hh < 0.3) return cel(SHELL, l, -0.3);
    return cel(SHELL, l);
  },
  upperArm(p) { return p.t < 0.25 ? cel(CL.yellow, L(p), lb(p)) : cel(SHELL, L(p), lb(p)); },
  foreArm(p) { return p.t > 0.86 ? cel(CL.charcoal, L(p), lb(p)) : cel(SHELL, L(p), lb(p)); },
  hands(p) { return cel(TS, L(p), lb(p) + 0.1); },
  // baggy cargo trousers with a pocket on each thigh
  thigh(p) { return p.t > 0.4 && p.t < 0.66 && Math.cos(p.hit.q[1]) > 0.2 ? cel(CL.khaki, L(p), lb(p) - 0.18) : cel(CL.khaki, L(p), lb(p)); },
  shin(p) { return p.t > 0.82 ? cel(CL.boot, L(p), lb(p)) : cel(CL.khaki, L(p), lb(p) + (frac(p.t * 3) < 0.15 ? -0.2 : 0)); },
  // the enormous boots: the zigzag treads show on the soles
  shoe(p) {
    if (p.hit.q[1] < -0.45) return Math.abs(frac(p.hit.q[0] * 3 + Math.abs(frac(p.hit.q[2] * 2) - 0.5)) - 0.5) < 0.2 ? CL.black[0] : CL.black[2];
    if (p.hit.q[1] < -0.2) return cel(CL.black, L(p), 0.1);
    return cel(CL.boot, L(p), lb(p) + 0.05);
  },
  shoeK: [1.34, 1.32, 1.24],
  bootTop: { t: 0.82, r: 0.6, mat: p => cel(CL.boot, L(p), lb(p)) },
  skirt: { len: 3.6, flare: 0.8, mat: p => cel(SHELL, L(p), p.t > 0.8 ? -0.3 : 0) },
  extras(s, J, P, ch) {
    // the overloaded pack: sample tubes along the side, a yellow survey flag poking up
    backpack(s, J, ch, { h: 15, w: 8.4, d: 5.4, top: 0.98, col: CL.charcoal, lid: CL.yellow, roll: CL.grey, jars: 3, z: 0.6 });
    const T = ch.build.torso;
    tLimb(s, J, [T * 0.9, -ch.chest[0] - 3, -2.4], [T * 0.9 + 14, -ch.chest[0] - 4.4, -2.8], 0.25, 0.22, GG.tool, h => cel(CL.wood, h.l, 0.1));
    const sw = Math.sin((P.sway ?? 0) * 2) * 0.6;
    tEll(s, J, [T * 0.9 + 12.6, -ch.chest[0] - 5.6 - sw, -2.8], [1.4, 1.1, 0.12], GG.clip, h => cel(CL.yellow, h.l, 0.15));
  },
};
const TEO_HEAD: HeadDef7 = {
  ...HEADS7.mori,
  skin: TS, hair: HAIR.blond, ink: hex('#1a1210'), eyeCol: '#2a4a7a', brow: '#a07a40', blush: '#f09080',
  // a big soft round face: wide jaw, a rounded chin, a snub nose
  skull: [[0.1, 8.1, 0], [5.0, 5.6, 4.5]],
  jaw: [[1.5, 4.4, 0], [3.8, 3.4, 3.7]],
  chin: [[3.5, 2.4, 0], [1.6, 1.4, 1.9]],
  nose: [[5.1, 5.9, 0], [1.1, 1.0, 0.85]],
  shell: [[-0.6, 8.6, 0], [5.4, 5.6, 5.0]],
  cut: q => q[0] > 0.3 && q[1] < 0.42,
  locks: [
    // blond tufts under the beanie, over the ears and at the nape
    { a: [1.0, 9.4, 4.8], b: [1.8, 6.4, 5.0], r0: 1.2, r1: 0.4 }, { a: [1.0, 9.4, -4.8], b: [1.8, 6.4, -5.0], r0: 1.2, r1: 0.4 },
    { a: [-3.6, 8.6, 1.6], b: [-5.4, 6.2, 2.2], r0: 1.4, r1: 0.4, sway: 0.6 }, { a: [-3.6, 8.6, -1.6], b: [-5.4, 6.2, -2.2], r0: 1.4, r1: 0.4, sway: 0.6 },
  ],
  extras(s, W) {
    // a short blond beard along the jaw
    s.ellipsoid(W([2.2, 3.4, 0]), W([3.4, 0, 0]), [0, 2.4, 0], W([0, 0, 4.0]), 10, h => cel(HAIR.blond, h.l, Math.sin(h.x * 2.3 + h.y) > 0.6 ? -0.2 : 0.05));
    // the yellow beanie, ribbed, a fat folded cuff over the brow
    const kn = CL.yellow;
    s.ellipsoid(W([-0.3, 11.2, 0]), W([5.8, 0, 0]), [0, 4.6, 0], W([0, 0, 5.4]), 12, h => (h.q[1] < -0.1 ? -1 : cel(kn, h.l, frac(Math.atan2(h.q[2], h.q[0]) * 3) < 0.25 ? -0.25 : 0.04)));
    s.ellipsoid(W([0, 11.2, 0]), W([6.0, 0, 0]), [0, 1.3, 0], W([0, 0, 5.6]), 13, h => cel(kn, h.l, 0.12));
  },
};
/** fidgeting: turns a sample tube in his fingers, rubs the back of his neck, tugs the beanie */
function teoIdle(b: Build, t: number): Pose {
  const k = K(b);
  const br = Math.sin(TAU * t * 2);
  const p = stand(b);
  const neck = bump(t, 0.5, 0.82, 0.08);
  p.hip = [0, b.hipH - 0.5 * k + br * 0.15 * k];
  p.lean = 0.07 + neck * 0.04;
  p.fl = { f: [-1.8 * k, b.ankleH] };
  p.bl = { f: [2.0 * k, b.ankleH], fa: 0 };
  const hip = p.hip;
  const tube: [number, number] = [hip[0] + 3.6 * k, hip[1] + b.torso * 0.48];
  p.fa = neck > 0.3 ? { ik: [hip[0] - 1.6 * k, hip[1] + b.torso + b.neck + 2.4 * k], hand: 'flat', palm: 'in' } : { ik: [tube[0] + Math.sin(TAU * t * 3) * 0.3 * k, tube[1]], hand: 'pinch' };
  p.ba = { ik: [tube[0] - 0.6 * k, tube[1] - 0.6 * k], hand: 'relax' };
  p.flags = { aoN: neck * 1.8 };
  p.look = neck > 0.3 ? 'down' : 'fwd';
  p.hd = [0.3 * k + neck * 0.5 * k, -neck * 0.4 * k];
  p.sway = 0.2;
  return p;
}
const TEO_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.15, stance: 0.64, lift: 1.7 * K(b), bob: 0.8 * K(b), lean: 0.1, swing: 0.3, elbow: 0.4, elbowSwing: 0.2, drop: 0.5 * K(b), kick: 0.1, flight: 0, hand: 'relax', sway: 0.7 * K(b), roll: 0.06, armOut: 1.2 });
registerOwn7('teo', 'idle', { info: { frames: 24, fps: 7, loop: true }, pose: teoIdle });
registerOwn7('teo', 'walk', { info: { frames: 12, fps: 13, loop: true }, pose: (b, t) => gait(b, t, TEO_WALK(b)), dist: b => gaitDist(TEO_WALK(b)) });

export const HELIX_HEADS = { celeste: CELESTE_HEAD, teo: TEO_HEAD };

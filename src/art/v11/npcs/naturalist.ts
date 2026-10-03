// V11 NPCs: Dr Marguerite "Marge" Holloway (74), a retired naturalist who sailed here alone eleven
// years ago, lost her yacht on the reef and decided to stay. She lives in a palm-frond hut in the
// grove on the home shore.
//
//  silhouette  small, wiry and stooped under a cream pith helmet with a long blue feather in its band;
//              white frizz escaping all round; a walking stick topped with a brass magnifier
//  face        round spectacles, bright pale eyes, rosy cheeks, crow's feet, eyebrows up in delight
//  clothes     a khaki safari jacket with bulging bellows pockets, a red neckerchief, knee-length
//              culottes, striped stockings and laced boots; a satchel of sketchbooks
//  moves       waits leaning on the stick, then bends to peer through the lens at the ground; walks
//              in quick little steps, planting the stick every stride

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Char7 } from '../../v7/body';
import type { HeadDef7 } from '../../v7/head';
import { HEADS7 } from '../../v7/head';
import type { Build, Pose } from '../../people-rig';
import { stand } from '../../anime/anims';
import { registerOwn7, gait, gaitDist } from '../../v7/anims7';
import type { Gait } from '../../v7/anims7';
import { tEll, tLimb, GG, pouch } from '../../v7/gear';
import { R6, L, lb, frac, bump, K, TAU, SKIN, CL, HAIR, specs } from './kit';

const MS = SKIN.pale;
const SAF = R6('#2a2414', '#544a2c', '#7e7048', '#a89a68', '#c4b888', '#ded4aa');
export const MARGE7: Char7 = {
  id: 'marge',
  build: { hipH: 22.2, thigh: 10.6, shin: 10.4, ankleH: 1.9, torso: 16.0, neck: 1.0, shY: 2.0, shF: 0, shB: 0, upArm: 8.0, foreArm: 7.2, legF: 0, legB: 0 },
  shW: 4.0, hipW: 2.5, chest: [2.8, 3.6], waist: [2.5, 3.1], pelvis: [2.8, 3.4],
  armR: [1.5, 1.25, 1.0], legR: [1.85, 1.35, 1.05], neckR: 1.1, hand: 0.92,
  skin: MS, ink: hex('#1a1010'),
  torso(p) {
    const l = L(p);
    // the red neckerchief at the throat
    if (p.hh > 0.84 && p.f > 0.6) return cel(CL.red, l, Math.abs(p.z) < 0.6 && p.hh < 0.9 ? -0.2 : 0.05);
    // bellows pockets: two on the chest, two at the hips, all of them bulging
    const pocket = p.f > 1.6 && Math.abs(p.z) > 0.6 && Math.abs(p.z) < 2.8 && ((p.hh > 0.52 && p.hh < 0.68) || (p.hh > 0.12 && p.hh < 0.3));
    if (pocket) return Math.abs(p.hh - 0.66) < 0.025 || Math.abs(p.hh - 0.28) < 0.025 ? cel(SAF, l, -0.35) : cel(SAF, l, 0.12);
    if (p.f > 2.2 && Math.abs(p.z) < 0.22) return cel(SAF, l, -0.3);
    // a belt
    if (p.hh > 0.36 && p.hh < 0.42) return cel(CL.leather, l, 0);
    return cel(SAF, l);
  },
  upperArm(p) { return cel(SAF, L(p), lb(p)); },
  foreArm(p) { return p.t > 0.84 ? cel(SAF, L(p), lb(p) - 0.3) : cel(SAF, L(p), lb(p)); },
  hands(p) { return cel(MS, L(p), lb(p) + 0.08); },
  thigh(p) { return cel(CL.khaki, L(p), lb(p)); },
  // striped stockings, laced boots
  shin(p) { return p.t < 0.14 ? cel(CL.khaki, L(p), lb(p) - 0.2) : p.t > 0.78 ? cel(CL.boot, L(p), lb(p)) : frac(p.t * 5) < 0.5 ? cel(CL.cream, L(p), lb(p)) : cel(CL.rust, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.4 ? CL.boot[0] : cel(CL.boot, L(p), lb(p) + 0.05); },
  bootTop: { t: 0.78, r: 0.3, mat: p => (frac(p.t * 6) < 0.3 ? cel(CL.cream, L(p), 0) : cel(CL.boot, L(p), lb(p))) },
  // the jacket's long skirt over culottes
  skirt: { len: 9, flare: 1.8, top: 2.6, mat: p => (p.t > 0.42 ? cel(CL.khaki, L(p), p.t > 0.92 ? -0.35 : 0) : cel(SAF, L(p), p.t > 0.38 ? -0.3 : 0)) },
  extras(s, J, _P, ch) {
    // the satchel of sketchbooks on her far hip, its strap across the chest
    const T = ch.build.torso;
    pouch(s, J, [T * 0.1, -0.6, -ch.hipW - 1.6], [1.6, 2.2, 1.0], CL.leather, CL.tan);
    tEll(s, J, [T * 0.22, -0.2, -ch.hipW - 1.4], [0.3, 1.5, 0.9], GG.clip, h => cel(CL.cream, h.l, 0.15));
    tLimb(s, J, [T * 0.2, 0.4, -ch.hipW - 1.0], [T * 0.94, ch.chest[0] * 0.8, ch.shW * 0.5], 0.3, 0.3, GG.strap, h => cel(CL.leather, h.l, 0.05));
  },
};
const MARGE_HEAD_DEF: HeadDef7 = {
  ...HEADS7.jenna,
  skin: MS, hair: HAIR.white, ink: hex('#1a1010'), eyeCol: '#3a5a7a', brow: '#d8d2ca', blush: '#e88a80',
  skull: [[0.1, 7.8, 0], [4.5, 5.2, 4.0]],
  jaw: [[1.5, 4.4, 0], [3.2, 2.9, 2.9]],
  chin: [[3.3, 2.6, 0], [1.2, 1.1, 1.3]],
  nose: [[4.8, 5.6, 0], [0.95, 0.9, 0.6]],
  shell: [[-0.6, 8.6, 0], [5.2, 5.4, 4.8]],
  cut: q => q[0] > 0.24 && q[1] < 0.4,
  // white frizz escaping all round under the helmet
  locks: [
    ...[[1.4, 9.6, 4.6], [-1.4, 9.4, 4.8], [-4.0, 9.2, 3.0], [-4.6, 9.0, 0], [-4.0, 9.2, -3.0], [-1.4, 9.4, -4.8], [1.4, 9.6, -4.6]]
      .map(([x, y, z]) => ({ a: [x * 0.8, y + 1, z * 0.8] as [number, number, number], b: [x * 1.18, y - 2.6, z * 1.2] as [number, number, number], r0: 1.7, r1: 1.1, sway: 0.3 })),
  ],
  browHidden: false,
  extras(s, W, o) {
    specs([4.0, 6.8, 2.2], CL.brass, { r: 1.2 })(s, W, o);
    // the pith helmet: a tall dome, a band, a stiff brim, the long blue feather in the band
    const H = R6('#4a4430', '#8a8060', '#c4b890', '#e8dcb8', '#f6eed6', '#ffffff');
    s.ellipsoid(W([-0.2, 12.2, 0]), W([5.6, 0, 0]), [0, 5.0, 0], W([0, 0, 5.4]), 12, h => (h.q[1] < -0.15 ? -1 : h.q[1] < 0.15 ? cel(CL.leather, h.l, 0.1) : cel(H, h.l, 0.05)));
    s.ellipsoid(W([0.2, 11.6, 0]), W([7.8, 0, 0]), [0, 0.55, 0], W([0, 0, 7.2]), 13, h => cel(H, h.l, h.q[1] < 0 ? -0.5 : 0));
    s.limb(W([-1.8, 12.6, -5.2]), W([-6.4, 18.6, -6.2]), 0.9, 0.2, 14, h => cel(R6('#04121a', '#0a2a3a', '#14465e', '#226282', '#3680a2', '#5aa2c0'), h.l, 0.1));
  },
};
export const MARGE_HEAD = MARGE_HEAD_DEF;

/** leaning on the stick; then bending to peer through its lens at something in the grass */
function margeIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b);
  const peer = bump(t, 0.35, 0.85, 0.1);
  const nod = Math.sin(TAU * t * 2) * 0.3;
  p.hip = [0, b.hipH - 0.6 * k - peer * 1.4 * k];
  p.lean = 0.14 + peer * 0.32;
  p.fl = { f: [-1.4 * k, b.ankleH] };
  p.bl = { f: [1.8 * k, b.ankleH] };
  const hip = p.hip;
  if (peer > 0.4) {
    p.fa = { ik: [hip[0] + 6.4 * k, hip[1] + b.torso * 0.66], hand: 'grip' };
    p.held = { kind: 'magnifier', v: 1 };
    p.ba = { ik: [hip[0] - 1.4 * k, hip[1] + 1.8 * k], hand: 'relax' };
    p.look = 'down';
  } else {
    p.fa = { ik: [hip[0] + 4.6 * k, hip[1] + b.torso * 0.36], hand: 'grip' };
    p.held = { kind: 'magnifier', v: 0 };
    p.ba = { ik: [hip[0] - 1.2 * k, hip[1] + 1.6 * k], hand: 'relax' };
    p.look = 'fwd';
  }
  p.hd = [0.5 * k + peer * 0.6 * k, nod * k * (1 - peer)];
  p.sway = 0.15;
  return p;
}
/** quick little steps, the stick planted with the near foot */
const MARGE_WALK = (b: Build): Gait => ({ stride: b.thigh * 0.95, stance: 0.6, lift: 1.5 * K(b), bob: 0.5 * K(b), lean: 0.16, swing: 0.12, elbow: 0.5, elbowSwing: 0.1, drop: 0.5 * K(b), kick: 0.2, flight: 0, hand: 'relax', sway: 0.3 * K(b), roll: 0.03 });
function margeWalk(b: Build, t: number): Pose {
  const p = gait(b, t, MARGE_WALK(b));
  const k = K(b);
  const plant = 0.5 + 0.5 * Math.cos(TAU * t);
  p.fa = { ik: [p.hip[0] + (3.4 + plant * 2.2) * k, p.hip[1] + b.torso * 0.36 + (1 - plant) * 0.8 * k], hand: 'grip' };
  p.held = { kind: 'magnifier', v: 0 };
  return p;
}
registerOwn7('marge', 'idle', { info: { frames: 32, fps: 7, loop: true }, pose: margeIdle });
registerOwn7('marge', 'walk', { info: { frames: 12, fps: 14, loop: true }, pose: margeWalk, dist: b => gaitDist(MARGE_WALK(b)) });

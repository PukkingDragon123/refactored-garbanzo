// V11 NPCs: the craftspeople who come down to the camp.
//
//  Matua Tīpene Karaka (68)  a master carver from up the coast: short, stout and barrel-chested, a
//                            bald brown head, a white goatee, round glasses, a faded black tee under a
//                            leather apron, rolled trousers, bare feet, a chisel roll on his hip and a
//                            bone toki pendant. Waits squinting along a chisel, blowing the dust off it,
//                            testing the edge on his thumb; walks slow, hands clasped behind his back.
//  Ngaio Rāwhiti (31)        a weaver who travels between the coastal kāinga and works salvage into
//                            her weaving: tall, two long braids, a woven headband, a mustard tee and a
//                            long denim skirt under a flax shoulder cape with a band of blue fishing
//                            net woven through it, a kete on her hip. Waits plaiting a strip of flax,
//                            humming; walks smooth and unhurried, the braids swinging.

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Char7, Part } from '../../v7/body';
import type { HeadDef7 } from '../../v7/head';
import { HEADS7 } from '../../v7/head';
import { JOSHU7 } from '../../v7/cast';
import type { Build, Pose } from '../../people-rig';
import { stand } from '../../anime/anims';
import { registerOwn7, gait, gaitDist } from '../../v7/anims7';
import type { Gait } from '../../v7/anims7';
import { tEll, tLimb, GG } from '../../v7/gear';
import { L, lb, frac, bump, K, TAU, SKIN, CL, HAIR, specs, beard } from './kit';

// ================================================================== Tīpene
const TS = SKIN.brownDeep;
export const TIPENE7: Char7 = {
  ...JOSHU7, id: 'tipene',
  // short and stout: a barrel chest and a round belly on short legs, thick forearms
  build: { hipH: 22.4, thigh: 10.6, shin: 10.2, ankleH: 2.0, torso: 19.2, neck: 0.8, shY: 2.8, shF: 0, shB: 0, upArm: 8.8, foreArm: 8.0, legF: 0, legB: 0 },
  shW: 6.8, hipW: 3.4, chest: [4.6, 6.0], waist: [4.4, 5.2], pelvis: [4.0, 4.7], belly: 2.6,
  armR: [2.6, 2.3, 1.9], legR: [2.9, 2.3, 1.9], neckR: 2.4, hand: 1.3,
  skin: TS, ink: hex('#120806'),
  torso(p) {
    const l = L(p);
    // the leather apron over the front: a bib, a neck strap, a pocket with chisel handles poking out
    const apron = p.f > 0.4 && Math.abs(p.z) < 3.4 + (0.5 - Math.abs(p.hh - 0.4)) && p.hh < 0.82;
    if (apron) {
      if (p.hh > 0.28 && p.hh < 0.42 && Math.abs(p.z) < 2.4) return p.hh > 0.4 && frac(p.z * 1.2) < 0.4 ? cel(CL.wood, l, 0.2) : cel(CL.leather, l, -0.2);
      return cel(CL.leather, l, Math.abs(Math.abs(p.z) - 3.2) < 0.25 ? -0.3 : 0.05);
    }
    if (p.f > 1.0 && Math.abs(Math.abs(p.z) - 2.6) < 0.5 && p.hh >= 0.82) return cel(CL.leather, l, 0.1);
    // the bone toki on its cord
    if (p.f > 3.0 && Math.abs(p.z) < 0.5 && p.hh > 0.84 && p.hh < 0.92) return cel(CL.cream, l, 0.2);
    if (p.hh < 0.08) return cel(CL.charcoal, l, -0.1);
    return cel(CL.charcoal, l, 0.05);
  },
  upperArm(p) { return p.t < 0.4 ? cel(CL.charcoal, L(p), lb(p)) : cel(TS, L(p), lb(p)); },
  foreArm(p) { return cel(TS, L(p), lb(p)); },
  hands(p) { return cel(TS, L(p), lb(p) + 0.06); },
  thigh(p) { return cel(CL.charcoal, L(p), lb(p) - 0.05); },
  // trousers rolled to mid-shin, bare feet
  shin(p) { return p.t < 0.5 ? cel(CL.charcoal, L(p), lb(p) + (p.t > 0.42 ? 0.2 : -0.05)) : cel(TS, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.45 ? TS[1] : cel(TS, L(p), lb(p) - 0.05); },
  shoeK: [0.95, 0.9, 1.05],
  skirt: { len: 7, flare: 1.2, top: 2.4, mat: p => cel(CL.leather, L(p), p.t > 0.88 ? -0.35 : 0.02) },
  bootTop: undefined, cuff: undefined,
  extras(s, J, _P, ch) {
    // the chisel roll on his far hip
    const T = ch.build.torso;
    tLimb(s, J, [T * 0.18, -1.2, -ch.hipW - 1.4], [T * -0.18, -1.0, -ch.hipW - 1.6], 1.2, 1.2, GG.roll, h => cel(CL.tan, h.l, frac(h.t * 4) < 0.15 ? -0.4 : 0.05));
    for (let i = 0; i < 3; i++) tLimb(s, J, [T * 0.18 + 0.4, -1.6 + i * 0.8, -ch.hipW - 1.4], [T * 0.18 + 2.2, -1.6 + i * 0.8, -ch.hipW - 1.4], 0.3, 0.3, GG.tool, h => cel(CL.wood, h.l, 0.1));
  },
};
const TIPENE_HEAD: HeadDef7 = {
  ...HEADS7.joshu,
  skin: TS, hair: HAIR.white, ink: hex('#120806'), eyeCol: '#140806', brow: '#e8e4dc', blush: '#a85a44',
  skull: [[0.2, 8.4, 0], [5.4, 5.8, 5.0]],
  jaw: [[1.4, 4.6, 0], [4.0, 3.4, 3.9]],
  chin: [[3.4, 2.8, 0], [1.8, 1.6, 2.0]],
  nose: [[5.6, 6.1, 0], [1.3, 1.2, 1.1]],
  // a fringe of white hair low round the back, nothing on top
  shell: [[-0.8, 7.6, 0], [5.6, 4.6, 5.6]],
  cut: q => q[0] > -0.2 || q[1] > 0.3,
  locks: [],
  eyeStyle: undefined,
  extras(s, W, o) {
    // the bald dome's shine
    s.dot(W([1.4, 13.6, 1.6]), hex('#d8a07c'), 2);
    beard(HAIR.white, { goatee: true })(s, W, o);
    specs([4.6, 7.4, 2.5], CL.leather, { r: 1.25 })(s, W, o);
  },
};
/** sighting along the chisel, blowing the dust off, testing the edge with a thumb */
function tipeneIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b);
  const sight = bump(t, 0.05, 0.45, 0.08), blow = bump(t, 0.5, 0.66, 0.04), thumb = bump(t, 0.7, 0.95, 0.06);
  p.hip = [0, b.hipH - 0.3 * k];
  p.lean = -0.04;
  p.fl = { f: [-1.8 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.0 * k, b.ankleH] };
  const hip = p.hip, eye: [number, number] = [hip[0] + 5 * k, hip[1] + b.torso + b.neck + 4 * k];
  const low: [number, number] = [hip[0] + 4.6 * k, hip[1] + b.torso * 0.62];
  const u = Math.max(sight, blow);
  p.fa = { ik: [low[0] + (eye[0] - low[0]) * u, low[1] + (eye[1] - 2 * k - low[1]) * u], hand: 'grip' };
  p.ba = thumb > 0.3 ? { ik: [low[0] + 0.6 * k, low[1] + 1.4 * k], hand: 'thumb' } : { ik: [hip[0] - 2.4 * k, hip[1] + 2.4 * k], hand: 'relax' };
  p.held = { kind: 'chisel' };
  p.look = sight > 0.4 ? 'fwd' : 'down';
  p.hd = [0.4 * k + blow * 0.4 * k, 0];
  p.sway = 0.1;
  return p;
}
/** slow and rolling, hands clasped behind his back */
function tipeneWalk(b: Build, t: number): Pose {
  const g = TIPENE_WALK(b);
  const p = gait(b, t, g);
  const k = K(b);
  p.fa = { ik: [p.hip[0] - 3.2 * k, p.hip[1] + 1.4 * k], hand: 'relax' };
  p.ba = { ik: [p.hip[0] - 3.4 * k, p.hip[1] + 1.2 * k], hand: 'grip' };
  p.flags = { ...(p.flags ?? {}), aoN: 1.6, aoF: 1.6 };
  return p;
}
const TIPENE_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.0, stance: 0.66, lift: 1.4 * K(b), bob: 0.4 * K(b), lean: 0.04, swing: 0, elbow: 0.4, elbowSwing: 0, drop: 0.2 * K(b), kick: 0, flight: 0, hand: 'relax', sway: 0.9 * K(b), roll: 0.08 });
registerOwn7('tipene', 'idle', { info: { frames: 32, fps: 8, loop: true }, pose: tipeneIdle });
registerOwn7('tipene', 'walk', { info: { frames: 12, fps: 11, loop: true }, pose: tipeneWalk, dist: b => gaitDist(TIPENE_WALK(b)) });

// ================================================================== Ngaio
const NS = SKIN.brown;
export const NGAIO7: Char7 = {
  id: 'ngaio',
  build: { hipH: 28.6, thigh: 13.6, shin: 13.4, ankleH: 2.1, torso: 18.4, neck: 1.5, shY: 2.2, shF: 0, shB: 0, upArm: 9.2, foreArm: 8.4, legF: 0, legB: 0 },
  shW: 4.6, hipW: 2.8, chest: [3.1, 4.1], waist: [2.4, 3.1], pelvis: [3.0, 3.7],
  armR: [1.75, 1.45, 1.15], legR: [2.2, 1.6, 1.25], neckR: 1.3, hand: 1.0,
  skin: NS, ink: hex('#120806'),
  torso(p) {
    const l = L(p);
    // the woven cape over the shoulders and upper chest: flax plait with a band of blue net
    if (p.hh > 0.62) {
      if (p.hh > 0.66 && p.hh < 0.74) return frac((p.hit.x - p.hit.y) / 3) < 0.34 ? cel(CL.net, l, 0.2) : cel(CL.net, l, -0.1);
      if (p.hh < 0.66) return frac(p.hit.x / 2) < 0.5 ? cel(CL.flax, l, -0.4) : cel(CL.flax, l, -0.1);
      return cel(CL.flax, l, frac((p.hit.x + p.hit.y) / 2) < 0.5 ? 0.12 : -0.12);
    }
    if (p.hh < 0.12) return cel(CL.denim, l);
    return cel(CL.mustard, l);
  },
  upperArm(p) { return p.t < 0.3 ? cel(CL.flax, L(p), lb(p) + (frac(p.hit.x / 2) < 0.5 ? 0.1 : -0.1)) : p.t < 0.45 ? cel(CL.mustard, L(p), lb(p)) : cel(NS, L(p), lb(p)); },
  foreArm(p) { return cel(NS, L(p), lb(p)); },
  hands(p) { return cel(NS, L(p), lb(p) + 0.08); },
  thigh(p) { return cel(CL.denim, L(p), lb(p)); },
  shin(p) { return cel(NS, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.3 ? cel(CL.flax, L(p), lb(p) - 0.2) : Math.abs(p.hit.q[0] - 0.3) < 0.2 ? cel(CL.flax, L(p), lb(p)) : cel(NS, L(p), lb(p)); },
  // a long denim skirt to the shins
  skirt: { len: 19, flare: 3.2, top: 3.2, mat: p => (p.t > 0.94 ? cel(CL.denim, L(p), -0.35) : Math.sin(Math.atan2(p.z, p.f) * 6) > 0.7 ? cel(CL.denim, L(p), -0.2) : cel(CL.denim, L(p), 0.05)) },
  extras(s, J, P, ch) {
    const T = ch.build.torso;
    // the cape's fringe hanging at the back, the kete on her hip
    const sw = Math.min(1.4, P.sway ?? 0) * 0.5;
    for (let i = -3; i <= 3; i++) tLimb(s, J, [T * 0.66, -ch.chest[0] - 0.4, i * 0.9], [T * 0.5 - sw, -ch.chest[0] - 0.9 - sw, i * 1.0], 0.3, 0.2, GG.clip, h => cel(CL.flax, h.l, i % 2 ? 0.1 : -0.15));
    tEll(s, J, [T * 0.04, 1.0, ch.hipW + 2.0], [1.4, 2.2, 1.4], GG.bag, h => (h.q[1] > 0.55 ? cel(CL.flax, h.l, -0.3) : cel(CL.flax, h.l, ((Math.floor(h.x) + Math.floor(h.y)) & 1) === 0 ? 0.15 : -0.1)));
    tLimb(s, J, [T * 0.06 + 2, 1.0, ch.hipW + 1.6], [T * 0.62, 1.6, ch.shW * 0.4], 0.3, 0.3, GG.strap, h => cel(CL.flax, h.l, 0.05));
  },
};
const NGAIO_HEAD: HeadDef7 = {
  ...HEADS7.aroha,
  skin: NS, hair: HAIR.black, ink: hex('#120806'), eyeCol: '#120806', brow: '#160c08', blush: '#c4604c',
  // a long oval face
  skull: [[0.1, 8.1, 0], [4.6, 5.6, 4.0]],
  jaw: [[1.6, 4.1, 0], [3.3, 3.4, 2.9]],
  chin: [[3.6, 2.0, 0], [1.3, 1.3, 1.3]],
  shell: [[-0.5, 9.0, 0], [5.2, 5.8, 4.8]],
  cut: q => q[0] > 0.32 && q[1] < 0.44,
  locks: [
    // parted in the middle, smooth over the ears into the braids
    { a: [3.4, 12.6, 0.4], b: [1.4, 10.8, 4.4], r0: 1.1, r1: 0.9 }, { a: [3.4, 12.6, -0.4], b: [1.4, 10.8, -4.4], r0: 1.1, r1: 0.9 },
  ],
  eyePaint: HEADS7.aroha.eyePaint, mouthPaint: HEADS7.aroha.mouthPaint,
  extras(s, W, o) {
    // two thick braids from behind the ears down over the shoulders (they swing as she walks)
    const sw = o.hair ?? 0;
    for (const z of [3.6, -3.6]) {
      let prev: [number, number, number] = [-1.2, 7.4, z];
      for (let i = 1; i <= 7; i++) {
        const p: [number, number, number] = [-1.2 + i * 0.5 - sw * i * 0.3, 7.4 - i * 2.6, z * (1 + i * 0.05)];
        s.limb(W(prev), W(p), 1.25 - i * 0.04, 1.2 - i * 0.04, 3, h => cel(HAIR.black, h.l, frac(h.t * 2) < 0.3 ? -0.3 : 0.12));
        prev = p;
      }
      s.ellipsoid(W([prev[0], prev[1] - 0.6, prev[2]]), W([0.7, 0, 0]), W([0, 0.6, 0]), W([0, 0, 0.7]), 4, h => cel(CL.flax, h.l, 0.1));
    }
    // the woven headband
    s.ellipsoid(W([0.6, 12.0, 0]), W([5.2, 0, 0]), [0, 0.7, 0], W([0, 0, 4.9]), 12, h => (h.q[0] < -0.6 ? -1 : cel(CL.flax, h.l, (h.x + h.y) % 2 === 0 ? 0.2 : -0.1)));
    // pounamu studs
    for (const z of [4.4, -4.4]) s.dot(W([-0.4, 5.2, z]), hex('#3a9a64'), 1.2);
  },
};
/** plaiting a strip of flax between her hands, swaying to the song she hums */
function ngaioIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b);
  const sw = Math.sin(TAU * t);
  p.hip = [0.4 * k * sw, b.hipH - 0.3 * k];
  p.lean = 0.06;
  p.fl = { f: [-1.2 * k, b.ankleH] };
  p.bl = { f: [1.6 * k, b.ankleH] };
  const hip = p.hip, w: [number, number] = [hip[0] + 4.0 * k, hip[1] + b.torso * 0.6];
  const pl = Math.sin(TAU * t * 4);
  p.fa = { ik: [w[0] + 0.8 * k, w[1] + pl * 0.5 * k], hand: 'pinch' };
  p.ba = { ik: [w[0] - 0.6 * k, w[1] - pl * 0.5 * k], hand: 'pinch' };
  p.held = { kind: 'flaxstrip', t };
  p.look = 'down';
  p.hd = [0.3 * k + sw * 0.25 * k, 0];
  p.flags = { sx: 0.5 * k * sw };
  p.sway = 0.4 + sw * 0.3;
  return p;
}
const NGAIO_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.3, stance: 0.6, lift: 1.9 * K(b), bob: 0.45 * K(b), lean: -0.02, swing: 0.26, elbow: 0.3, elbowSwing: 0.2, drop: 0.25 * K(b), kick: 0.3, flight: 0, hand: 'relax', sway: 0.65 * K(b), roll: 0.04 });
registerOwn7('ngaio', 'idle', { info: { frames: 32, fps: 8, loop: true }, pose: ngaioIdle });
registerOwn7('ngaio', 'walk', { info: { frames: 12, fps: 14, loop: true }, pose: (b, t) => { const p = gait(b, t, NGAIO_WALK(b)); p.flags = { ...(p.flags ?? {}), hair: 1 }; return p; }, dist: b => gaitDist(NGAIO_WALK(b)) });

export const CRAFT_HEADS = { tipene: TIPENE_HEAD, ngaio: NGAIO_HEAD };
void ({} as Part);

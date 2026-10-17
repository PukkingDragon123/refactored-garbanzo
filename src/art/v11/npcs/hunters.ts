// V11 NPCs: the trappers camped in the Rocky Hills. They hunt the stoats and rats that came ashore
// with the old whalers, to keep the ground birds alive.
//
//  Rua Hēnare (61)     the old hunter: wiry and a little stooped, a battered black felt bush hat, a
//                      drooping grey moustache, a scar down one cheek, a blue-and-black checked wool
//                      bush shirt (a swanndri) with a laced neck, canvas shorts, canvas gaiters over
//                      his boots, a sheath knife and a coil of trap wire on his belt. Waits whittling
//                      a stick, eyes always moving; walks soft and low, like a man stalking.
//  Sunny Faleolo (29)  his apprentice: tall, strong, a big laugh. A cloud of black curls tied up in a
//                      red bandana, an olive tank, cargo shorts, hunting boots, a whistle on a red
//                      lanyard, a billy can swinging off her pack. Waits rolling her shoulders,
//                      bouncing the billy; walks with a swagger.

import { hex } from '../../color';
import { cel } from '../../v7/raster';
import type { Char7 } from '../../v7/body';
import type { HeadDef7 } from '../../v7/head';
import { HEADS7 } from '../../v7/head';
import type { Build, Pose } from '../../people-rig';
import { stand } from '../../anime/anims';
import { registerOwn7, gait, gaitDist } from '../../v7/anims7';
import type { Gait } from '../../v7/anims7';
import { tEll, tLimb, GG, knife, backpack, ropeMat } from '../../v7/gear';
import { R6, L, lb, frac, bump, K, TAU, SKIN, CL, HAIR, brimHat } from './kit';

// ================================================================== Rua
const RS = SKIN.brownDeep;
/** the swanndri check: dark bands both ways, black where they cross */
const swan = (p: { hit: { x: number; y: number; l: number } }, bias = 0) => {
  const lx = (p.hit.x % 4) < 1.4, ly = (p.hit.y % 4) < 1.4;
  return lx && ly ? cel(CL.black, p.hit.l, bias + 0.1) : lx || ly ? cel(CL.blueCheck, p.hit.l, bias - 0.35) : cel(CL.blueCheck, p.hit.l, bias + 0.05);
};
export const RUA7: Char7 = {
  id: 'rua',
  build: { hipH: 26.4, thigh: 12.6, shin: 12.4, ankleH: 2.2, torso: 18.6, neck: 1.2, shY: 2.4, shF: 0, shB: 0, upArm: 9.4, foreArm: 8.6, legF: 0, legB: 0 },
  shW: 5.2, hipW: 2.7, chest: [3.2, 4.4], waist: [2.7, 3.5], pelvis: [2.9, 3.5],
  armR: [1.85, 1.6, 1.3], legR: [2.2, 1.65, 1.3], neckR: 1.5, hand: 1.12,
  skin: RS, ink: hex('#120806'),
  torso(p) {
    const l = L(p);
    if (p.hh < 0.07) return cel(CL.khaki, l, -0.1);
    // a laced neck opening on the swanndri
    if (p.hh > 0.8 && p.f > 2.0 && Math.abs(p.z) < 0.7) return Math.abs(p.z) < 0.15 && frac(p.hh * 20) < 0.5 ? cel(CL.leather, l, 0.2) : cel(RS, l, -0.25);
    if (p.hh > 0.08 && p.hh < 0.15) return cel(CL.leather, l, 0);
    return swan(p);
  },
  upperArm(p) { return swan(p, lb(p)); },
  // sleeves shoved up: ropey forearms
  foreArm(p) { return p.t < 0.3 ? swan(p, lb(p) - 0.1) : cel(RS, L(p), lb(p)); },
  hands(p) { return cel(RS, L(p), lb(p) + 0.06); },
  thigh(p) { return p.t < 0.5 ? cel(CL.khaki, L(p), lb(p) + (p.t > 0.44 ? -0.3 : 0)) : cel(RS, L(p), lb(p)); },
  shin(p) { return p.t > 0.36 ? cel(CL.tan, L(p), lb(p) + (frac(p.t * 4) < 0.12 ? -0.3 : 0)) : cel(RS, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.4 ? CL.boot[0] : cel(CL.boot, L(p), lb(p)); },
  shoeK: [1.1, 1.1, 1.05],
  bootTop: { t: 0.36, r: 0.5, mat: p => cel(CL.tan, L(p), lb(p) + (frac(p.t * 5) < 0.12 ? -0.3 : 0.05)) },
  skirt: { len: 4.4, flare: 0.6, mat: p => swan({ hit: p.hit }, p.t > 0.8 ? -0.2 : 0) },
  extras(s, J, _P, ch) {
    const T = ch.build.torso;
    knife(s, J, [T * 0.1, 0.4, ch.hipW + 1.4]);
    // a coil of trap wire hanging off the belt behind
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
      tLimb(s, J, [T * 0.02 + Math.sin(a0) * 1.6, -ch.waist[0] - 0.6 + Math.cos(a0) * 0.4, -ch.hipW - 0.4 + Math.cos(a0) * 1.4], [T * 0.02 + Math.sin(a1) * 1.6, -ch.waist[0] - 0.6 + Math.cos(a1) * 0.4, -ch.hipW - 0.4 + Math.cos(a1) * 1.4], 0.22, 0.22, GG.coil, h => cel(CL.steel, h.l, 0.2, true));
    }
  },
};
const RUA_HEAD: HeadDef7 = {
  ...HEADS7.mori,
  skin: RS, hair: HAIR.white, ink: hex('#120806'), eyeCol: '#140806', brow: '#d8d2ca', blush: '#a85a44',
  // a lean, lined face: hollow cheeks, a long jaw, a hooked nose
  skull: [[0.1, 8.0, 0], [4.7, 5.4, 4.0]],
  jaw: [[1.7, 4.1, 0], [3.3, 3.3, 2.9]],
  chin: [[3.6, 2.2, 0], [1.3, 1.4, 1.5]],
  nose: [[5.2, 5.7, 0], [1.2, 1.1, 0.7]],
  shell: [[-0.8, 8.4, 0], [5.0, 5.0, 4.8]],
  cut: q => q[0] > 0.1 || q[1] > 0.5,
  locks: [],
  eyeStyle: 'slit',
  extras(s, W, o) {
    // the drooping grey moustache
    s.ellipsoid(W([4.8, 4.0, 0]), W([1.0, 0, 0]), [0, 1.0, 0], W([0, 0, 2.2]), 11, h => cel(HAIR.white, h.l, 0.05));
    for (const z of [-1.9, 1.9]) s.limb(W([4.6, 4.0, z]), W([4.2, 2.2, z * 1.1]), 0.75, 0.4, 11, h => cel(HAIR.white, h.l, 0));
    // the battered bush hat: a dented crown, the brim snapped down at the front
    brimHat({ y: 11.6, r: 7.2, crown: [3.4, 4.6], col: CL.charcoal, band: CL.leather, pinch: true, tilt: 0.22, droop: 0.15 })(s, W, o);
  },
};
/** whittling a stick, shavings curling off; every so often the eyes come up and sweep the hill */
function ruaIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b);
  const look = bump(t, 0.62, 0.9, 0.06);
  const cut = Math.sin(TAU * t * 6);
  p.hip = [0, b.hipH - 0.9 * k];
  p.lean = 0.16 - look * 0.1;
  p.fl = { f: [-2.4 * k, b.ankleH] };
  p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
  const hip = p.hip;
  const work: [number, number] = [hip[0] + 4.4 * k, hip[1] + b.torso * 0.46];
  p.ba = { ik: [work[0], work[1]], hand: 'grip' };
  p.fa = { ik: [work[0] + 0.6 * k + cut * 0.6 * k * (1 - look), work[1] + 0.6 * k], hand: 'grip' };
  p.held = { kind: 'whittle', t };
  p.look = look > 0.4 ? 'fwd' : 'down';
  p.hd = [0.3 * k + look * 0.3 * k, -0.2 * k];
  p.sway = 0.1;
  return p;
}
/** soft and low, knees bent, rolling heel to toe */
const RUA_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.3, stance: 0.62, lift: 1.6 * K(b), bob: 0.3 * K(b), lean: 0.14, swing: 0.2, elbow: 0.6, elbowSwing: 0.15, drop: 1.0 * K(b), kick: 0.1, flight: 0, hand: 'relax', sway: 0.2 * K(b), roll: 0.01 });
registerOwn7('rua', 'idle', { info: { frames: 24, fps: 8, loop: true }, pose: ruaIdle });
registerOwn7('rua', 'walk', { info: { frames: 12, fps: 12, loop: true }, pose: (b, t) => gait(b, t, RUA_WALK(b)), dist: b => gaitDist(RUA_WALK(b)) });

// ================================================================== Sunny
const SS = SKIN.pacific;
export const SUNNY7: Char7 = {
  id: 'sunny',
  build: { hipH: 27.8, thigh: 13.2, shin: 13.0, ankleH: 2.3, torso: 18.8, neck: 1.3, shY: 2.4, shF: 0, shB: 0, upArm: 9.4, foreArm: 8.6, legF: 0, legB: 0 },
  shW: 5.8, hipW: 3.1, chest: [3.6, 4.7], waist: [2.9, 3.7], pelvis: [3.4, 4.2],
  armR: [2.15, 1.8, 1.4], legR: [2.7, 2.0, 1.5], neckR: 1.5, hand: 1.06,
  skin: SS, ink: hex('#120806'),
  torso(p) {
    const l = L(p);
    // bare shoulders, an olive tank with wide straps, a red lanyard and a silver whistle
    if (p.hh > 0.8) return Math.abs(Math.abs(p.z) - 2.4) < 1.0 && (p.f > -1.4 || p.hh < 0.92) ? cel(CL.olive, l, 0.05) : cel(SS, l);
    if (p.f > 0.9 && p.hh > 0.7 && Math.abs(p.z) < 2.0) return cel(SS, l, -0.05);
    if (p.f > 2.4 && Math.abs(Math.abs(p.z) - (1.6 - (0.86 - p.hh) * 6)) < 0.32 && p.hh > 0.62) return cel(CL.red, l, 0.1);
    if (p.f > 2.6 && Math.abs(p.z) < 0.4 && p.hh > 0.56 && p.hh < 0.63) return cel(CL.steel, l, 0.3, true);
    if (p.hh > 0.06 && p.hh < 0.14) return cel(CL.black, l, 0.1);
    if (p.hh <= 0.06) return cel(CL.tan, l);
    return cel(CL.olive, l);
  },
  upperArm(p) { return cel(SS, L(p), lb(p)); },
  foreArm(p) { return p.near && p.t > 0.84 && p.t < 0.92 ? cel(CL.red, L(p), 0.1) : cel(SS, L(p), lb(p)); },
  hands(p) { return cel(SS, L(p), lb(p) + 0.08); },
  thigh(p) { return p.t < 0.55 ? (p.t > 0.3 && p.t < 0.5 && Math.cos(p.hit.q[1]) > 0.3 ? cel(CL.tan, L(p), lb(p) - 0.2) : cel(CL.tan, L(p), lb(p))) : cel(SS, L(p), lb(p)); },
  shin(p) { return p.t > 0.66 ? cel(CL.boot, L(p), lb(p)) : p.t > 0.58 ? cel(CL.wool, L(p), lb(p)) : cel(SS, L(p), lb(p)); },
  shoe(p) { return p.hit.q[1] < -0.4 ? CL.boot[0] : cel(CL.boot, L(p), lb(p) + 0.05); },
  shoeK: [1.14, 1.16, 1.08],
  bootTop: { t: 0.66, r: 0.45, mat: p => cel(CL.boot, L(p), lb(p)) },
  extras(s, J, P, ch) {
    const T = ch.build.torso;
    backpack(s, J, ch, { h: 12, w: 7, d: 4, top: 0.94, col: CL.olive, lid: CL.charcoal, rope: true });
    // the billy can swinging off the pack
    const sw = Math.sin((P.sway ?? 0) * 3) * 0.8;
    tLimb(s, J, [T * 0.42, -ch.chest[0] - 4.6, 3.4], [T * 0.32 - sw * 0.2, -ch.chest[0] - 4.8 - sw, 3.8], 0.15, 0.15, GG.tool, ropeMat);
    tEll(s, J, [T * 0.22, -ch.chest[0] - 5 - sw, 3.9], [1.4, 1.6, 1.4], GG.bottle, h => (h.q[1] > 0.7 ? cel(CL.black, h.l, 0.2) : cel(CL.steel, h.l, -0.15, true)));
  },
};
const SUNNY_HEAD: HeadDef7 = {
  ...HEADS7.aroha,
  skin: SS, hair: HAIR.black, ink: hex('#120806'), eyeCol: '#140806', brow: '#140c08', blush: '#c86a52',
  skull: [[0.1, 7.9, 0], [4.8, 5.4, 4.3]],
  jaw: [[1.6, 4.3, 0], [3.5, 3.2, 3.3]],
  chin: [[3.6, 2.4, 0], [1.4, 1.2, 1.6]],
  shell: [[-0.6, 9.0, 0], [5.4, 5.8, 5.0]],
  cut: q => q[0] > 0.3 && q[1] < 0.42,
  locks: [],
  eyePaint: undefined, mouthPaint: undefined,
  extras(s, W) {
    // a big cloud of curls piled up behind the bandana
    const curl = (h: { x: number; y: number; l: number }) => cel(HAIR.black, h.l, Math.sin(h.x * 2.6) * Math.cos(h.y * 2.2) > 0.4 ? 0.45 : 0);
    for (const [x, y, z, r] of [[-2.4, 15.2, 0, 4.4], [-5.0, 13.0, 2.6, 3.4], [-5.0, 13.0, -2.6, 3.4], [-1.0, 16.6, 2.4, 3.2], [-1.0, 16.6, -2.2, 3.2], [-6.4, 10.4, 0, 3.4], [0.8, 14.6, 0, 3.4]] as [number, number, number, number][])
      s.ellipsoid(W([x, y, z]), W([r, 0, 0]), W([0, r * 0.92, 0]), W([0, 0, r]), 3, curl);
    // the red bandana round the hairline, its knot and tails at the back
    s.ellipsoid(W([0.1, 11.4, 0]), W([5.5, 0, 0]), [0, 1.3, 0], W([0, 0, 5.1]), 12, h => cel(CL.red, h.l, ((h.x + h.y * 2) % 4) === 0 ? 0.6 : 0.05));
    s.limb(W([-5.2, 11.2, 1]), W([-7.6, 8.6, 1.6]), 0.9, 0.4, 12, h => cel(CL.red, h.l, 0));
    s.limb(W([-5.2, 11.2, -1]), W([-7.2, 9.4, -1.8]), 0.8, 0.35, 12, h => cel(CL.red, h.l, -0.1));
  },
};
/** rolls her shoulders and neck, bounces on the balls of her feet, a big stretch */
function sunnyIdle(b: Build, t: number): Pose {
  const k = K(b);
  const p = stand(b);
  const roll = Math.sin(TAU * t * 2);
  const stretch = bump(t, 0.6, 0.88, 0.07);
  p.hip = [0.3 * k * roll, b.hipH - 0.5 * k + Math.abs(Math.sin(TAU * t * 4)) * 0.3 * k * (1 - stretch) + stretch * 0.6 * k];
  p.lean = -0.04 - stretch * 0.08;
  p.fl = { f: [-2.6 * k, b.ankleH] };
  p.bl = { f: [2.6 * k, b.ankleH] };
  const hip = p.hip;
  if (stretch > 0.25) {
    // both arms up over her head, fingers laced
    const top: [number, number] = [hip[0] + 1.2 * k, hip[1] + b.torso + b.neck + 9 * k * stretch];
    p.fa = { ik: top, hand: 'flat', palm: 'up' };
    p.ba = { ik: [top[0] - 0.4 * k, top[1] - 0.4 * k], hand: 'flat', palm: 'up' };
    p.look = 'up';
  } else {
    p.fa = { a: 0.18 + roll * 0.12, e: 0.5 + roll * 0.2, hand: 'fist' };
    p.ba = { a: -0.1 - roll * 0.12, e: 0.5 - roll * 0.2, hand: 'fist' };
    p.flags = { roll: roll * 0.08, aoN: 1, aoF: 1 };
    p.look = 'fwd';
  }
  p.hd = [0.2 * k + roll * 0.25 * k, 0];
  p.sway = 0.3 + stretch * 0.3;
  return p;
}
const SUNNY_WALK = (b: Build): Gait => ({ stride: b.thigh * 1.45, stance: 0.58, lift: 2.4 * K(b), bob: 0.9 * K(b), lean: 0.0, swing: 0.5, elbow: 0.42, elbowSwing: 0.3, drop: 0.35 * K(b), kick: 0.5, flight: 0, hand: 'relax', sway: 0.75 * K(b), roll: 0.07, armOut: 0.8 });
registerOwn7('sunny', 'idle', { info: { frames: 24, fps: 8, loop: true }, pose: sunnyIdle });
registerOwn7('sunny', 'walk', { info: { frames: 12, fps: 15, loop: true }, pose: (b, t) => gait(b, t, SUNNY_WALK(b)), dist: b => gaitDist(SUNNY_WALK(b)) });

export const HUNTER_HEADS = { rua: RUA_HEAD, sunny: SUNNY_HEAD };
void R6; void tEll;

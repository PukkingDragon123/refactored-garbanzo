// V7 bodies: the shared pose library (side-view skeleton poses) lifted into 3D and rendered turned
// toward the camera. Each pose's joints get a lateral depth (near limbs toward the viewer, far limbs
// behind), the shoulders counter-rotate against the hips as the arms swing, and the whole figure is
// yawed ~35° so we see the chest, both shoulders and both legs. Torso, pelvis and belly are
// ellipsoids, limbs are tapered sweeps, hands and shoes are small ellipsoids; outfits are
// materials that read the part's local frame (height up the torso, around a limb, along a sleeve).

import { PixelBuffer } from '../pixel';
import { Build, Pose, solve, trimPair, P2 } from '../people-rig';
import type { C } from '../color';
import { Scene3D, V3, Hit, Mat, vadd, vsub, vsc, vnorm, vdot, vlerp, vlen, vcross, cel, Ramp6 } from './raster';

export const YAW = 0.95; // radians: how far the cast turns toward the camera

export interface Part { hit: Hit; near: boolean; t: number; /** torso frame: height 0 (hip) → 1 (neck), forward, lateral (+near) */ hh: number; f: number; z: number }
export type PartMat = (p: Part) => C | -1;

export interface Char7 {
  id: string;
  build: Build;
  /** lateral half widths: shoulders, hips */
  shW: number;
  hipW: number;
  /** torso radii [forward, lateral] at chest, waist, pelvis */
  chest: [number, number];
  waist: [number, number];
  pelvis: [number, number];
  /** belly bulge forward (px, 0 = none) */
  belly?: number;
  armR: [number, number, number];
  legR: [number, number, number];
  neckR: number;
  hand: number;
  skin: Ramp6;
  ink: C;
  torso: PartMat;
  upperArm: PartMat;
  foreArm: PartMat;
  hands: PartMat;
  thigh: PartMat;
  shin: PartMat;
  shoe: PartMat;
  /** a skirt or tunic hem: from the waist down to `len` px below the hips, flaring */
  skirt?: { len: number; flare: number; top?: number; mat: PartMat };
  /** extra 3D props on the body (straps, packs, pouches) */
  extras?(s: Scene3D, J: J3, P: Pose): void;
}

/** the lifted skeleton (world space) */
export interface J3 {
  hip: V3; neckBase: V3; neckTop: V3;
  shN: V3; shF: V3; elN: V3; elF: V3; wrN: V3; wrF: V3;
  hpN: V3; hpF: V3; knN: V3; knF: V3; anN: V3; anF: V3;
  up: V3; fwd: V3; lat: V3;
  /** torso-local → world */
  T(h: number, f: number, z: number): V3;
  /** world → torso-local [h(px), f, z] */
  local(p: V3): V3;
  yaw: number;
}

const G = { torso: 1, armN: 2, armF: 3, legN: 4, legF: 5, skirt: 6, extra: 7 };
export { G as GROUPS };

/** body space (x forward, y up, z lateral +near) → world, yawed toward the camera */
function yawer(a: number) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return {
    W: (p: V3): V3 => [p[0] * ca - p[2] * sa, p[1], p[0] * sa + p[2] * ca],
    B: (p: V3): V3 => [p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca],
  };
}

export function lift(ch: Char7, pose: Pose, yaw = YAW): J3 {
  const b = { ...ch.build, shF: 0, shB: 0, legF: 0, legB: 0 };
  const J = solve(b, pose);
  const { W } = yawer(yaw);
  const P = (p: P2, z = 0): V3 => [p[0], p[1], z];
  // shoulders counter-rotate against the hips with the arm swing (walk / run twist)
  const aF = pose.fa.a ?? 0, aB = pose.ba.a ?? 0;
  const tw = pose.fa.ik || pose.ba.ik ? 0 : Math.max(-0.45, Math.min(0.45, (aB - aF) * 0.16));
  const upS: V3 = [J.up[0], J.up[1], 0], fwS: V3 = [J.fwd[0], J.fwd[1], 0];
  const latS: V3 = [0, 0, 1];
  // rotate about the vertical axis (the spine, near enough while upright)
  const twist = (v: V3, a: number): V3 => { const c = Math.cos(a), sn = Math.sin(a); return [v[0] * c + v[2] * sn, v[1], -v[0] * sn + v[2] * c]; };
  const shLat = twist(vsc(latS, ch.shW), tw), hpLat = twist(vsc(latS, ch.hipW), -tw * 0.45);
  const sh = P(J.shF);
  const shN = vadd(sh, shLat), shFa = vsub(sh, shLat);
  const out = 0.35;
  const armN = (p: P2): V3 => vadd(shN, [p[0] - J.shF[0], p[1] - J.shF[1], out]);
  const armF = (p: P2): V3 => vadd(shFa, [p[0] - J.shB[0], p[1] - J.shB[1], -out]);
  const hip = P(J.hip);
  const hpN = vadd(P(J.hipF), hpLat), hpF = vsub(P(J.hipB), hpLat);
  // feet keep their own tracks, a touch narrower than the hips
  const legN = (p: P2, k: number): V3 => [p[0], p[1], hpLat[2] * k];
  const legF = (p: P2, k: number): V3 => [p[0], p[1], -hpLat[2] * k];
  const j = {
    hip: W(hip), neckBase: W(P(J.neckBase)), neckTop: W(P(J.neckTop)),
    shN: W(shN), shF: W(shFa), elN: W(armN(J.elF)), elF: W(armF(J.elB)), wrN: W(armN(J.wrF)), wrF: W(armF(J.wrB)),
    hpN: W(hpN), hpF: W(hpF), knN: W(legN(J.knF, 1)), knF: W(legF(J.knB, 1)), anN: W(legN(J.anF, 0.85)), anF: W(legF(J.anB, 0.85)),
    up: W(upS), fwd: W(twist(fwS, tw * 0.5)), lat: W(twist(latS, tw * 0.5)), yaw,
  } as J3;
  const T0 = W(hip);
  j.T = (h, f, z) => vadd(T0, vadd(vsc(j.up, h), vadd(vsc(j.fwd, f), vsc(j.lat, z))));
  j.local = p => { const d = vsub(p, T0); return [vdot(d, j.up), vdot(d, j.fwd), vdot(d, j.lat)]; };
  return j;
}

const CW = 128, CH = 118, OX = 64, OY = 100;

export interface Frame7 { back: PixelBuffer; front: PixelBuffer | null; ax: number; ay: number; hx: number; hy: number; hand: [number, number]; look?: 'fwd' | 'up' | 'down'; headBehind?: boolean; hrot?: number; hair?: number }

export function renderBody7(ch: Char7, pose: Pose): Frame7 {
  const s = new Scene3D(CW, CH, OX, OY);
  const J = lift(ch, pose);
  const T = ch.build.torso * (pose.sq ?? 1);
  const part = (hit: Hit, near: boolean, t: number): Part => {
    const l = J.local(hit.p);
    return { hit, near, t, hh: l[0] / T, f: l[1], z: l[2] };
  };
  const pm = (m: PartMat, near: boolean): Mat => h => m(part(h, near, h.t));
  const front = new Set(pose.front ?? []);

  // ---- legs (thigh, shin, shoe)
  const leg = (near: boolean) => {
    const g = near ? G.legN : G.legF;
    const hp = near ? J.hpN : J.hpF, kn = near ? J.knN : J.knF, an = near ? J.anN : J.anF;
    const [r0, r1, r2] = ch.legR;
    s.limb(hp, kn, r0, r1, g, pm(ch.thigh, near));
    s.limb(kn, an, r1, r2, g, pm(ch.shin, near));
    const fa = (near ? pose.fl.fa : pose.bl.fa) ?? 0;
    // shoe: an ellipsoid pointing along the foot
    const fd = vnorm(vadd(vsc(flat(J.fwd), Math.cos(fa)), [0, Math.sin(fa), 0]));
    const upv = vnorm(vsub([0, 1, 0], vsc(fd, fd[1])));
    const lt = vnorm(vcross(fd, upv));
    const c = vadd(an, vadd(vsc(fd, 1.7), vsc(upv, -0.9)));
    s.ellipsoid(c, vsc(fd, 3.1), vsc(upv, 1.55), vsc(lt, 1.7), g, pm(ch.shoe, near));
  };
  leg(false);
  leg(true);

  // ---- torso: pelvis, waist, chest, belly, shoulder caps; neck
  const tmat = pm(ch.torso, true);
  const E = (h: number, f: number, rf: number, ru: number, rz: number, fo = 0) =>
    s.ellipsoid(J.T(h, f + fo, 0), vsc(J.fwd, rf), vsc(J.up, ru), vsc(J.lat, rz), G.torso, tmat);
  E(2.2, 0, ch.pelvis[0], 3.6, ch.pelvis[1]);
  E(T * 0.42, 0, ch.waist[0], T * 0.3, ch.waist[1]);
  E(T * 0.7, 0.2, ch.chest[0], T * 0.3, ch.chest[1]);
  if (ch.belly) E(T * 0.36, ch.belly * 0.45, ch.waist[0] + ch.belly * 0.6, T * 0.3, ch.waist[1] + ch.belly * 0.25);
  s.limb(J.shN, J.shF, ch.armR[0] + 0.5, ch.armR[0] + 0.5, G.torso, tmat);
  s.limb(J.neckBase, vadd(J.neckTop, [0, -0.5, 0]), ch.neckR, ch.neckR * 0.92, G.torso, h => cel(ch.skin, h.l, -0.35));
  if (ch.skirt) {
    const sk = ch.skirt, top = sk.top ?? 3.2;
    const kneeMid = vlerp(J.knN, J.knF, 0.5);
    const hemC = vlerp(J.T(0, 0, 0), kneeMid, Math.min(1, sk.len / Math.max(1, vlen(vsub(kneeMid, J.T(0, 0, 0))))));
    const topC = J.T(top, 0, 0);
    const ax = vsub(hemC, topC), L = vlen(ax);
    const n = Math.max(3, Math.ceil(L / 0.6));
    const smat = pm(sk.mat, true);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const c = vlerp(topC, hemC, u);
      const rf = ch.waist[0] + 0.3 + sk.flare * u, rz = ch.pelvis[1] + 0.4 + sk.flare * 0.8 * u;
      s.ellipsoid(c, vsc(J.fwd, rf), vsc(vnorm(ax), -0.9), vsc(J.lat, rz), G.skirt, h => { h.t = u; return smat(h); });
    }
  }

  // ---- arms (upper, fore, hand)
  const arm = (near: boolean) => {
    const g = near ? G.armN : G.armF;
    if (front.has(near ? 'armF' : 'armB')) s.layer = 1;
    const sh = near ? J.shN : J.shF, el = near ? J.elN : J.elF, wr = near ? J.wrN : J.wrF;
    const [r0, r1, r2] = ch.armR;
    s.limb(sh, el, r0, r1, g, pm(ch.upperArm, near));
    s.limb(el, wr, r1, r2, g, pm(ch.foreArm, near));
    const d = vnorm(vsub(wr, el));
    const hp = (near ? pose.fa.hand : pose.ba.hand) ?? 'fist';
    const k = ch.hand;
    if (hp !== 'none') {
      const open = hp === 'open' || hp === 'flat';
      const c = vadd(wr, vsc(d, open ? 1.8 * k : 1.2 * k));
      const side = vnorm(vcross(d, [0, 0, 1]));
      s.ellipsoid(c, vsc(d, (open ? 2.1 : 1.45) * k), vsc(side, 1.3 * k), [0, 0, (open ? 0.8 : 1.3) * k], g, pm(ch.hands, near));
    }
    s.layer = 0;
  };
  arm(false);
  ch.extras?.(s, J, pose);
  arm(true);

  const r = s.finish({ ink: ch.ink });
  const tr = trimPair(r.back, r.front, 1);
  const nt = J.neckTop;
  return {
    back: tr.a, front: tr.b,
    ax: OX - tr.ox, ay: OY - tr.oy,
    hx: Math.round(OX + nt[0]) - tr.ox, hy: Math.round(OY - nt[1]) - tr.oy,
    hand: [Math.round(OX + J.wrN[0]) - tr.ox, Math.round(OY - J.wrN[1]) - tr.oy],
    look: pose.look, headBehind: pose.headBehind || undefined, hrot: pose.flags?.hrot,
  };
}

const flat = (v: V3): V3 => vnorm([v[0], 0, v[2]]);

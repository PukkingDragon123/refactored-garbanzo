// V7 bodies: the shared pose library (side-view skeleton poses) lifted into 3D and rendered turned
// toward the camera. Each pose's joints get a lateral depth (near limbs toward the viewer, far limbs
// behind), the shoulders counter-rotate against the hips as the arms swing, and the whole figure is
// yawed ~35° so we see the chest, both shoulders and both legs. Torso, pelvis and belly are
// ellipsoids, limbs are tapered sweeps, hands and shoes are small ellipsoids; outfits are
// materials that read the part's local frame (height up the torso, around a limb, along a sleeve).

import { PixelBuffer } from '../pixel';
import { Build, Pose, solve, ik2, trimPair, P2, Canvas, PropP } from '../people-rig';
import { drawProp5 } from '../v5/props';
import { finish5 } from '../v5/body';
import type { Ctx, CharDef } from '../people-parts';
import type { C } from '../color';
import { Scene3D, V3, Hit, Mat, vadd, vsub, vsc, vnorm, vdot, vlerp, vlen, vcross, cel, Ramp6 } from './raster';
import { drawHand7, HandFrame, handScale } from './hands';
import { drawHeld7 } from './held';

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
  /** gloves: a cuff over the wrist (radius, length back up the forearm; the hands' material unless given) */
  cuff?: { r: number; len: number; mat?: PartMat };
  /** finger thickness (insulated gloves > 1) */
  fingerK?: number;
  /** the fingers and thumb, when they differ from the rest of the hand (fingerless gloves) */
  fingers?: PartMat;
  /** shoe size multipliers [length, height, width] (chunky snow and sea boots > 1) */
  shoeK?: [number, number, number];
  /** a boot shaft or gaiter hugging the shin from `t` (0 knee → 1 ankle) down, `r` px proud of it */
  bootTop?: { t: number; r: number; mat: PartMat };
  /** extra 3D props on the body (straps, packs, pouches), drawn between the far and the near arm */
  extras?(s: Scene3D, J: J3, P: Pose, ch: Char7): void;
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
  /** the legs' forward direction (world) */
  legFwd: V3;
  /** the pose's flags (gear can read them: noPack while a backpack is being taken off) */
  flags?: Record<string, number>;
}

const G = { torso: 1, armN: 2, armF: 3, legN: 4, legF: 5, skirt: 6, extra: 7, handN: 40, handF: 41 };
export { G as GROUPS };

/** body space (x forward, y up, z lateral +near) → world, yawed toward the camera */
function yawer(a: number) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return {
    W: (p: V3): V3 => [p[0] * ca - p[2] * sa, p[1], p[0] * sa + p[2] * ca],
    B: (p: V3): V3 => [p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca],
  };
}

/** yaw for back views (climbing a ladder: we see the back, only a little turned, so the climber sits
 *  square on the flat-painted ladder and both hands and feet read on its rungs) */
export const BACK_YAW = -1.42;

export function lift(ch: Char7, pose: Pose, yaw0 = YAW): J3 {
  const b = { ...ch.build, shF: 0, shB: 0, legF: 0, legB: 0 };
  const J = solve(b, pose);
  const back = !!pose.flags?.back;
  // a pose may turn the figure less (flags.yaw), e.g. squaring up to the ship's wheel, or part way
  // round to the ladder (stepping on and off it)
  const yaw = pose.flags?.yaw ?? (back ? BACK_YAW : yaw0);
  const { W } = yawer(yaw);
  // the legs stride along the direction of travel: a shallower turn than the torso, so steps read
  // on screen while the chest stays open to the camera (a natural hip-to-shoulder rotation)
  const { W: Wl } = yawer(back ? yaw : yaw * 0.5);
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
  // arms raised above the shoulder splay outward (abduct) so a wave or a cheer clears the face
  // (the forward reach of a raised arm turns into a sideways reach, the hand up beside the head)
  const raise = (dx: number, dy: number): [number, number] => {
    if (back) return [dx, 1.2 + Math.max(0, dy) * 0.12];
    const f = Math.max(0, Math.min(1, (dy + 1) / 6));
    return [dx * (1 - 0.8 * f), f * (Math.abs(dx) * 0.8 + 1.5) + Math.max(0, dy) * 0.3];
  };
  // personality flags: lateral hip shift (sx), shoulder roll, sideways reach per arm (aoN / aoF)
  const fl = pose.flags ?? {};
  const sx = fl.sx ?? 0, roll = fl.roll ?? 0, aoN = fl.aoN ?? 0, aoF = fl.aoF ?? 0;
  const shift: V3 = [0, 0, sx];
  // swinging arms move along the direction of travel (a turn between torso and legs); arms that
  // hold or reach for something (IK) stay in the torso's frame
  const { W: Wa } = yawer(back ? yaw : yaw * 0.55);
  const armW = (ik: boolean) => (ik ? W : Wa);
  // flags.zN: the near hand goes to this lateral depth (body centre = 0) instead of splaying out, so
  // it can come in to the mouth or the face (a sip, a bite, a hand over a yawn); the elbow follows part way.
  // flags.zF does the same for the far hand (both hands on a camera, both hands on a ladder's rungs)
  const zN = fl.zN, zF = fl.zF;
  const armPt = (sh3: V3, root: P2, p: P2, side: number, ao: number, ik: boolean, k: number): V3 => {
    const dx = p[0] - root[0], dy = p[1] - root[1];
    const zs = side > 0 ? zN : zF;
    if (zs !== undefined) return vadd(W(sh3), armW(ik)([dx, dy, (zs - sh3[2]) * k]));
    const [x, z] = raise(dx, dy);
    return vadd(W(sh3), armW(ik)([x, dy, side * (out + z + ao * k)]));
  };
  const hip = vadd(P(J.hip), shift);
  const hpN = vadd(vadd(P(J.hipF), hpLat), shift), hpF = vadd(vsub(P(J.hipB), hpLat), shift);
  const shN2 = vadd(vadd(shN, shift), [0, roll * ch.shW, 0]), shF2 = vadd(vadd(shFa, shift), [0, -roll * ch.shW, 0]);
  const ikN = !!pose.fa.ik, ikF = !!pose.ba.ik;
  // world-space fists (flags wN / wF): the arm's ik point is where the FIST should land, in world px
  // from the ground anchor (x toward facing, y up), e.g. on the rim of the ship's wheel. Solve the
  // side-plane target that puts the wrist a fist's length short of it, through this yaw and shoulder
  const ca = Math.cos(yaw), sa = Math.sin(yaw);
  const fistTo = (near: boolean) => {
    const a = near ? pose.fa : pose.ba;
    if (!a.ik || !(near ? fl.wN : fl.wF)) return;
    const sh3 = near ? shN2 : shF2, root = near ? J.shF : J.shB, side = near ? 1 : -1, ao = near ? aoN : aoF;
    const zs = near ? zN : zF;
    const lz = zs !== undefined ? zs : sh3[2] + side * (out + ao), F = 2.6 * handScale(ch.hand), goal = a.ik;
    let tx = goal[0], ty = goal[1], el: P2 = root, wr: P2 = root;
    for (let it = 0; it < 3; it++) {
      [el, wr] = ik2(root, [root[0] + (tx + lz * sa) / ca - sh3[0], root[1] + ty - sh3[1]], b.upArm, b.foreArm, a.flip ? 1 : -1);
      const e3 = armPt(sh3, root, el, side, ao, true, 0.6), w3 = armPt(sh3, root, wr, side, ao, true, 1);
      const dd = Math.hypot(w3[0] - e3[0], w3[1] - e3[1]) || 1;
      tx = goal[0] - ((w3[0] - e3[0]) / dd) * F; ty = goal[1] - ((w3[1] - e3[1]) / dd) * F;
    }
    if (near) { J.elF = el; J.wrF = wr; } else { J.elB = el; J.wrB = wr; }
  };
  fistTo(true); fistTo(false);
  // knees and feet hang off their hip, stepping in the legs' own (shallower) yaw; the feet stay put
  // when the hips shift sideways (the knee takes half of it)
  const legW = (hp: V3, root: P2, p: P2, k = 1): V3 => vsub(vadd(W(hp), Wl([p[0] - root[0], p[1] - root[1], 0])), W(vsc(shift, k)));
  const j = {
    hip: W(hip), neckBase: W(vadd(P(J.neckBase), shift)), neckTop: W(vadd(P(J.neckTop), shift)),
    shN: W(shN2), shF: W(shF2),
    elN: armPt(shN2, J.shF, J.elF, 1, aoN, ikN, 0.6), elF: armPt(shF2, J.shB, J.elB, -1, aoF, ikF, 0.6),
    wrN: armPt(shN2, J.shF, J.wrF, 1, aoN, ikN, 1), wrF: armPt(shF2, J.shB, J.wrB, -1, aoF, ikF, 1),
    hpN: W(hpN), hpF: W(hpF), knN: legW(hpN, J.hipF, J.knF, 0.5), knF: legW(hpF, J.hipB, J.knB, 0.5), anN: legW(hpN, J.hipF, J.anF), anF: legW(hpF, J.hipB, J.anB),
    up: W(upS), fwd: W(twist(fwS, tw * 0.5)), lat: W(twist(latS, tw * 0.5)), yaw, legFwd: Wl([1, 0, 0]), flags: pose.flags,
  } as J3;
  const T0 = W(hip);
  j.T = (h, f, z) => vadd(T0, vadd(vsc(j.up, h), vadd(vsc(j.fwd, f), vsc(j.lat, z))));
  j.local = p => { const d = vsub(p, T0); return [vdot(d, j.up), vdot(d, j.fwd), vdot(d, j.lat)]; };
  return j;
}

const CW = 128, CH = 118, OX = 64, OY = 100;

/**
 * Held 3D props and other extra drawing registered by other modules (Aroha's slingshot, a grenade):
 * called after both arms with the scene, the lifted skeleton, the pose and the character. It may
 * return a finishing pass that paints over the finished layers (thin things that must not be inked,
 * like rubber bands); the front layer is created for it if needed.
 */
export type Held7 = (s: Scene3D, J: J3, pose: Pose, ch: Char7) => ((back: PixelBuffer, front: PixelBuffer) => void) | void;
export const HELD7: Held7[] = [];

export interface Frame7 {
  back: PixelBuffer; front: PixelBuffer | null; ax: number; ay: number; hx: number; hy: number; hand: [number, number]; look?: 'fwd' | 'up' | 'down' | 'back'; headBehind?: boolean; hrot?: number; hflip?: boolean; hair?: number;
  /** named points on the sprite (buffer px, sub-pixel): the palms ('handN', 'handF') and the held object's own (held.ts) */
  pts?: Record<string, [number, number]>;
}

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
    // a boot shaft / gaiter: a slightly thicker sleeve over the lower shin
    const bt = ch.bootTop;
    if (bt) { const top = vlerp(kn, an, bt.t), bm = pm(bt.mat, near); s.limb(top, an, r1 + (r2 - r1) * bt.t + bt.r, r2 + bt.r * 0.8, g, h => { h.t = bt.t + h.t * (1 - bt.t); return bm(h); }); }
    const fa = (near ? pose.fl.fa : pose.bl.fa) ?? 0;
    // shoe: an ellipsoid pointing along the foot (bigger boots keep their sole on the ground)
    const [k0, k1, k2] = ch.shoeK ?? [1, 1, 1];
    const fd = vnorm(vadd(vsc(flat(J.legFwd), Math.cos(fa)), [0, Math.sin(fa), 0]));
    const upv = vnorm(vsub([0, 1, 0], vsc(fd, fd[1])));
    const lt = vnorm(vcross(fd, upv));
    const c = vadd(an, vadd(vsc(fd, 1.7 + (k0 - 1) * 1.1), vsc(upv, -2.45 + 1.55 * k1)));
    s.ellipsoid(c, vsc(fd, 3.1 * k0), vsc(upv, 1.55 * k1), vsc(lt, 1.7 * k2), g, pm(ch.shoe, near));
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
    const hem0 = vlerp(J.T(0, 0, 0), kneeMid, Math.min(1, sk.len / Math.max(1, vlen(vsub(kneeMid, J.T(0, 0, 0))))));
    // the hem trails a touch behind on the move and lifts with the bounce (follow-through)
    const hemC = vadd(hem0, vadd(vsc(J.legFwd, -Math.min(1.4, (pose.sway ?? 0) * 0.55) * Math.min(1, sk.len / 6)), [0, Math.max(-0.6, Math.min(0.8, (pose.bounce ?? 0) * 0.5)), 0]));
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
  let hN: HandFrame | null = null, hF: HandFrame | null = null;
  const arm = (near: boolean) => {
    const g = near ? G.armN : G.armF;
    // a raised near arm (waving, cheering, hand at the face) goes in front of the head
    const raised = near && !pose.flags?.back && (J.wrN[1] > J.neckTop[1] - 3 || J.elN[1] > J.neckTop[1] - 1);
    if (front.has(near ? 'armF' : 'armB') || raised) s.layer = 1;
    const sh = near ? J.shN : J.shF, el = near ? J.elN : J.elF, wr = near ? J.wrN : J.wrF;
    const [r0, r1, r2] = ch.armR;
    s.limb(sh, el, r0, r1, g, pm(ch.upperArm, near));
    s.limb(el, wr, r1, r2, g, pm(ch.foreArm, near));
    const hp = (near ? pose.fa.hand : pose.ba.hand) ?? 'relax';
    if (hp !== 'none') {
      const am = near ? pose.fa : pose.ba;
      const hf = drawHand7(s, wr, el, J, near, am, ch.hand, near ? G.handN : G.handF, pm(ch.hands, near), pm(ch.fingers ?? ch.hands, near), ch.fingerK ?? 1);
      if (near) hN = hf; else hF = hf;
      // glove cuff over the wrist, flaring a little over the sleeve
      const cf = ch.cuff;
      if (cf) { const d = vnorm(vsub(wr, el)); s.limb(vadd(wr, vsc(d, -cf.len)), vadd(wr, vsc(d, 0.35 * hf.k)), cf.r, cf.r * 0.9, g, pm(cf.mat ?? ch.hands, near)); }
    }
    s.layer = 0;
  };
  arm(false);
  ch.extras?.(s, J, pose, ch);
  arm(true);
  // ---- whatever the hands are holding (held.ts), sitting in the hands it was posed for
  const pts: Record<string, V3> = {};
  if (hN) pts.handN = (hN as HandFrame).palm;
  if (hF) pts.handF = (hF as HandFrame).palm;
  if (pose.held) drawHeld7(s, J, pose, ch, hN, hF, pts);
  const posts: ((back: PixelBuffer, front: PixelBuffer) => void)[] = [];
  for (const h of HELD7) { const f = h(s, J, pose, ch); if (f) posts.push(f); }

  const r = s.finish({ ink: ch.ink, inkK: HAND_INK });
  if (pose.props?.length) drawProps(ch, pose, J, r.back, r.front ?? (r.front = new PixelBuffer(CW, CH)));
  if (posts.length) { const fr = r.front ?? (r.front = new PixelBuffer(CW, CH)); for (const f of posts) f(r.back, fr); }
  const tr = trimPair(r.back, r.front, 1);
  const nt = J.neckTop;
  return {
    back: tr.a, front: tr.b,
    ax: OX - tr.ox, ay: OY - tr.oy,
    hx: Math.round(OX + nt[0]) - tr.ox, hy: Math.round(OY - nt[1]) - tr.oy,
    hand: [Math.round(OX + J.wrN[0]) - tr.ox, Math.round(OY - J.wrN[1]) - tr.oy],
    look: pose.flags?.back ? 'back' : pose.look, headBehind: pose.headBehind || undefined, hrot: pose.flags?.hrot, hflip: (pose.flags?.hrot ?? 0) < 0 || undefined,
    pts: Object.fromEntries(Object.entries(pts).map(([k, p]) => [k, [OX + p[0] - tr.ox, OY - p[1] - tr.oy] as [number, number]])),
  };
}

const flat = (v: V3): V3 => vnorm([v[0], 0, v[2]]);
/** hands are small: their edges go darker (less of the skin's own red) so they read clean */
const HAND_INK: Record<number, number> = { [G.handN]: 0.62, [G.handF]: 0.62 };

/**
 * Held props reuse the side-view prop painter, placed at the projected 3D hands (absolute props are
 * squeezed toward the body by the yaw). 'back' props go behind the body, the rest over it.
 */
function drawProps(ch: Char7, pose: Pose, J: J3, back: PixelBuffer, front: PixelBuffer) {
  const b = { ...ch.build, shF: 0, shB: 0, legF: 0, legB: 0 };
  const J2 = solve(b, pose);
  J2.wrF = [J.wrN[0], J.wrN[1]];
  J2.wrB = [J.wrF[0], J.wrF[1]];
  const k = Math.cos(J.yaw);
  for (const pr of pose.props ?? []) {
    const c = new Canvas(CW, CH, OX, OY);
    const q: PropP = pr.t ? { ...pr } : { ...pr, x: pr.x * k };
    const x = { c, J: J2, P: pose, b, ch: ch as unknown as CharDef, anim: '', t: 0 } as unknown as Ctx;
    drawProp5(x, q);
    finish5(c.back);
    const z = pr.z ?? 'hand';
    const dst = pr.front ? front : back;
    const d = c.back.data;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!(v >>> 24)) continue;
      if (z === 'back' && (dst.data[i] >>> 24)) continue;
      dst.data[i] = v;
    }
  }
}

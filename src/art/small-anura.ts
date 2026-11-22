// A small anuran (frog or toad) rig for the little ones (the moss frog, the ember toad), painted on
// the small-life kit (./small-kit.ts). Side view, facing right; anchor = the ground under the body.
//
// The head and trunk are ONE contour through a species' own landmarks (snout tip, nostril, the eye's
// bulge, the nape, the back, the sacral (urostyle) hump, the rump and vent, the belly, the throat, the
// chin and lips), deformed by the pose: the head pitches about the neck, the body squats, flattens or
// puffs about its middle, tips about the hip, lifts off the ground. The limbs are jointed by two-bone
// IK from the hip and shoulder to where each foot is: the near hind leg is the big folded Z of a
// sitting frog (the thigh along the flank, the shin folded under it, the long foot forward on the
// ground with its toes spread, webbed and padded), the arm a short upper arm and forearm with the hand
// turned in. Each segment is its own swept contour, so the core draws the fold where the thigh lies
// over the shin and over the flank. The species paints the skin (pattern, warts and folds, sampled in
// body space so it rides with the pose), the eye, the tympanum and the details.

import { Sk, ik2 } from './beasts-core';
import type { V2, BeastEye } from './beasts-core';
import { Field, seg, blob, anuranEye, curve } from './small-kit';
import type { LP, FP, EyePal } from './small-kit';

const ss = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export type HindMode = 'sit' | 'push' | 'trail' | 'tuck' | 'stiff' | 'flat' | 'kick';
export type FrontMode = 'sit' | 'reach' | 'land' | 'stiff' | 'tuck' | 'paddle' | 'up';
export interface AnuraPose {
  /** body pitch about the hip (negative tips the nose up) and head pitch about the neck */
  rot: number; head: number;
  /** squash / stretch about the pivot (puff: both > 1; flat: sy < 1) */
  sx: number; sy: number;
  /** lift off the ground and shift forward (unit px) */
  lift: number; dx: number;
  hind: HindMode; front: FrontMode;
  /** swim kick 0 (tucked) .. 1 (trailing); how far the hind legs reach out when they kick (1 = full) */
  kick: number; reach: number;
  sac: number; tongue: number; gape: number;
}
export const restPose = (): AnuraPose => ({ rot: 0, head: 0, sx: 1, sy: 1, lift: 0, dx: 0, hind: 'sit', front: 'sit', kick: 0, reach: 1, sac: 0, tongue: 0, gape: 0 });

export type LimbPart = 'thigh' | 'shin' | 'foot' | 'toe' | 'web' | 'upper' | 'fore' | 'hand';
/** what a species paints: the skin of the body (with the pixel's body-space position) and of each limb */
export interface AnuraPaint {
  body(p: FP, bx: number, by: number): number;
  limb(p: FP, part: LimbPart, far: boolean, t: number, c: number): number;
  sac(p: FP, inflate: number): number;
  tongue(p: FP, t: number): number;
  mouth: number;
}
export interface AnuraSpec {
  /** the head-and-trunk contour in body space (unit px, anchor at the origin, y down) */
  body: (P: AnuraPose) => LP[];
  neck: V2; pivot: V2; hip: V2; shoulder: V2;
  thigh: number; shin: number; foot: number; upper: number; fore: number;
  /** half-widths: thigh at the hip, shin's calf, the foot, the arm */
  thighW: number; shinW: number; footW: number; armW: number;
  /** toe length, toe-pad radius (0: no pads) and webbing (0..1) */
  toe: number; pad: number; web: number;
  eye: V2; eyeSize: 2 | 3 | 4; eyePal: EyePal;
  /** the vocal sac: where it hangs under the chin, its full radius */
  sac: { at: V2; r: number };
  /** the mouth's tip and corner (for the tongue and the gape), the tongue's full reach (unit px) */
  mouth: { tip: V2; corner: V2 }; tongueLen?: number;
  paint: AnuraPaint;
  /** sculpt the body's height field (T maps body space to canvas) */
  sculpt?: (F: Field, T: (x: number, y: number) => V2, P: AnuraPose) => void;
  /** flaps / spines along the limbs' outer edges */
  limbSpines?: (part: LimbPart) => { side: 1 | -1; at: number[]; len: number; lean?: number } | undefined;
  /** surface z of the body's flank (for stacking the near limbs over it) */
  zBody: number;
  /** extra round / dome on the body field */
  round: number; dome: number;
  spec?: number;
  /** a fill light from the front (the face would otherwise always sit on the shadow side) */
  fill?: number;
  /** pixel-level details after the parts are drawn (tympanum, lips, wart tips...) */
  after?: (sk: Sk, T: (x: number, y: number) => V2, P: AnuraPose, k: number) => void;
}

export interface AnuraOut { head: V2; eye: V2; T: (x: number, y: number) => V2; inv: (x: number, y: number) => V2 }

/** draw one anuran at scale k */
export function drawAnuran(sk: Sk, S: AnuraSpec, P: AnuraPose, k: number, eyeSt: BeastEye): AnuraOut {
  const c = Math.cos(P.rot), s = Math.sin(P.rot);
  const [hx, hy] = S.hip, [px, py] = S.pivot, [nx, ny] = S.neck;
  // body space -> unit space (no k)
  const U = (x: number, y: number, headW = 1): V2 => {
    // the head pitches about the neck, blended in over the neck so the contour stays continuous
    const w = ss(nx - 1.4, nx + 1.2, x) * headW;
    if (w > 0 && P.head) {
      const a = P.head * w, ca = Math.cos(a), sa = Math.sin(a), dx = x - nx, dy = y - ny;
      x = nx + dx * ca - dy * sa; y = ny + dx * sa + dy * ca;
    }
    x = px + (x - px) * P.sx; y = py + (y - py) * P.sy;
    const dx = x - hx, dy = y - hy;
    return [hx + dx * c - dy * s + P.dx, hy + dx * s + dy * c - P.lift];
  };
  const T = (x: number, y: number): V2 => { const u = U(x, y); return [u[0] * k, u[1] * k]; };
  const inv = (X: number, Y: number): V2 => {
    let x = X / k - P.dx, y = Y / k + P.lift;
    const dx = x - hx, dy = y - hy;
    x = hx + dx * c + dy * s; y = hy - dx * s + dy * c;
    return [px + (x - px) / P.sx, py + (y - py) / P.sy];
  };
  const K = (p: V2): V2 => [p[0] * k, p[1] * k];
  const hip = U(S.hip[0], S.hip[1], 0), sho = U(S.shoulder[0], S.shoulder[1], 0);
  const lift = P.lift;

  // ---------------------------------------------------------------- the hind legs
  const hind = (far: boolean) => {
    const z0 = far ? -2.5 : S.zBody + 1.2, bias = far ? -0.17 : 0;
    const fx = far ? -0.7 : 0, fy = far ? -0.35 : 0;
    const H: V2 = [hip[0] + fx, hip[1] + fy];
    const L = (S.thigh + S.shin) * P.reach;
    let ank: V2, toeDir: number, footOnGround = true;
    switch (P.hind) {
      case 'push': ank = [H[0] - L * 0.58, Math.min(-0.6, H[1] + L * 0.42)]; toeDir = Math.PI - 0.5; footOnGround = false; break;
      case 'trail': ank = [H[0] - L * 0.62, H[1] + L * 0.24]; toeDir = Math.PI - 0.25; footOnGround = false; break;
      case 'tuck': ank = [H[0] - S.shin * 0.35, H[1] + S.thigh * 0.55]; toeDir = 0.35; footOnGround = false; break;
      case 'stiff': ank = [H[0] - 0.5, -0.8 - lift]; toeDir = 0; break;
      case 'flat': ank = [H[0] + 0.3, -0.55 - lift]; toeDir = 0; break;
      case 'kick': {
        const e = P.kick;
        ank = [H[0] - S.shin * 0.35 - (L * 0.72 - S.shin * 0.35) * e, H[1] + S.thigh * 0.4 * (1 - e) + L * 0.3 * e];
        toeDir = 0.3 + (Math.PI - 0.35) * e; footOnGround = false; break;
      }
      default: ank = [H[0] - 0.75 + (far ? 0.4 : 0), -0.75 - lift]; toeDir = 0;
    }
    const [knee, ankle] = ik2(H, ank, S.thigh, S.shin, P.hind === 'push' || P.hind === 'trail' ? 1 : -1);
    // the thigh: a fat teardrop, deepest at the hip, tapering into the knee
    const sp = S.limbSpines;
    seg(sk, [K(H), K(knee)], t => (S.thighW * (1 - t * 0.5) + 0.15) * k, t => (S.thighW * (0.95 - t * 0.45)) * k,
      (p, t, cr) => S.paint.limb(p, 'thigh', far, t, cr), { z: z0 + 0.6, bias, capA: 1, capB: 1, spines: far ? undefined : sp?.('thigh') });
    // the shin: the calf swelling behind the knee
    seg(sk, [K(knee), K(ankle)], t => (S.shinW * (0.75 + Math.sin(t * Math.PI) * 0.35)) * k, t => (S.shinW * (0.7 + Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.3)) * k,
      (p, t, cr) => S.paint.limb(p, 'shin', far, t, cr), { z: z0, bias, capA: 1, capB: 0.8, spines: far ? undefined : sp?.('shin') });
    // the foot: the long tarsus to the toes; on the ground it runs forward from the heel
    let tip: V2;
    if (footOnGround) tip = [ankle[0] + S.foot * (far ? 0.75 : 1), -0.35 - lift];
    else tip = [ankle[0] + Math.cos(toeDir) * S.foot * 0.85, ankle[1] + Math.sin(toeDir) * S.foot * 0.85];
    const fd = Math.atan2(tip[1] - ankle[1], tip[0] - ankle[0]);
    seg(sk, [K(ankle), K(tip)], t => (S.footW * (1 - t * 0.35)) * k, t => (S.footW * (0.8 - t * 0.3)) * k,
      (p, t, cr) => S.paint.limb(p, 'foot', far, t, cr), { z: z0 + 0.3, bias, capA: 1, capB: 0.6 });
    // the toes: spread, the webbing between them, a pad at each tip
    const n = far ? 2 : 3;
    const toeTips: V2[] = [];
    for (let i = 0; i < n; i++) {
      const a = fd + (i - (n - 1) / 2) * 0.42 + (footOnGround ? -0.12 * i : 0);
      const len = S.toe * (i === 1 ? 1.15 : 0.9) * (footOnGround ? 1 : 0.8);
      const tt: V2 = [tip[0] + Math.cos(a) * len, tip[1] + Math.sin(a) * len];
      toeTips.push([footOnGround ? tt[0] : tt[0], footOnGround ? Math.min(tt[1], -0.25 - lift) : tt[1]]);
    }
    if (S.web > 0 && !far && toeTips.length >= 2) {
      // the web: a thin translucent fan between the toes, scalloped between the tips
      const w: LP[] = [K(tip) as LP];
      for (let i = 0; i < toeTips.length; i++) {
        w.push(K(toeTips[i]) as LP);
        if (i < toeTips.length - 1) { const m: V2 = [(toeTips[i][0] + toeTips[i + 1][0]) / 2, (toeTips[i][1] + toeTips[i + 1][1]) / 2]; w.push(K([tip[0] + (m[0] - tip[0]) * (0.45 + S.web * 0.35), tip[1] + (m[1] - tip[1]) * (0.45 + S.web * 0.35)]) as LP); }
      }
      blob(sk, w, (p) => S.paint.limb(p, 'web', far, 0, 0), { z: z0 + 0.1, bias, round: 0.4, dome: 0, per: 2 });
    }
    for (const tt of toeTips) {
      seg(sk, [K(tip), K(tt)], () => 0.32 * k, () => 0.28 * k, (p, t, cr) => S.paint.limb(p, 'toe', far, t, cr), { z: z0 + 0.4, bias, round: 0.4, capA: 0.5, capB: 1 });
      if (S.pad > 0) blob(sk, circle(K(tt), S.pad * k), (p) => S.paint.limb(p, 'toe', far, 1, 0), { z: z0 + 0.6, bias: bias + 0.1, round: 0.5 });
    }
  };

  // ---------------------------------------------------------------- the arms
  const arm = (far: boolean) => {
    const z0 = far ? -2 : S.zBody + 1.6, bias = far ? -0.17 : 0;
    const fx = far ? -0.75 : 0, fy = far ? -0.3 : 0;
    const Sh: V2 = [sho[0] + fx, sho[1] + fy];
    const L = S.upper + S.fore;
    let wr: V2, handDir = 0, onGround = true;
    switch (P.front) {
      case 'reach': wr = [Sh[0] + L * 0.6, Sh[1] + L * 0.6]; handDir = 1.0; onGround = false; break;
      case 'land': wr = [Sh[0] + L * 0.75, -0.45 - lift]; handDir = 0.2; break;
      case 'stiff': wr = [Sh[0] + L * 0.4, -0.45 - lift]; break;
      case 'tuck': wr = [Sh[0] + L * 0.45, Sh[1] + L * 0.5]; handDir = 0.4; onGround = false; break;
      case 'paddle': wr = [Sh[0] - L * 0.2, Sh[1] + L * 0.75]; handDir = 1.6; onGround = false; break;
      case 'up': wr = [Sh[0] + L * 0.35, -0.45 - lift]; break;
      default: wr = [Sh[0] + L * 0.3 + (far ? 0.5 : 0), -0.45 - lift];
    }
    const [el, wrist] = ik2(Sh, wr, S.upper, S.fore, 1);
    seg(sk, [K(Sh), K(el)], t => S.armW * (1.05 - t * 0.25) * k, t => S.armW * (1 - t * 0.25) * k, (p, t, cr) => S.paint.limb(p, 'upper', far, t, cr), { z: z0, bias, capA: 1, capB: 1 });
    seg(sk, [K(el), K(wrist)], t => S.armW * (0.95 - t * 0.3) * k, t => S.armW * (0.85 - t * 0.25) * k, (p, t, cr) => S.paint.limb(p, 'fore', far, t, cr), { z: z0 + 0.3, bias, capA: 1, capB: 0.8 });
    // the hand turned in, fingers splayed forward, a pad at each tip
    const n = far ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const a = (onGround ? 0 : handDir) + (i - (n - 1) / 2) * 0.5 - (onGround ? i * 0.12 : 0);
      const len = S.toe * (0.62 + (i === 1 ? 0.15 : 0));
      const tt: V2 = [wrist[0] + Math.cos(a) * len, wrist[1] + Math.sin(a) * len];
      if (onGround) tt[1] = Math.min(tt[1], -0.25 - lift);
      seg(sk, [K(wrist), K(tt)], () => 0.32 * k, () => 0.28 * k, (p, t, cr) => S.paint.limb(p, 'hand', far, t, cr), { z: z0 + 0.4, bias, round: 0.4, capA: 0.6, capB: 1 });
      if (S.pad > 0) blob(sk, circle(K(tt), S.pad * k * 0.9), (p) => S.paint.limb(p, 'toe', far, 1, 0), { z: z0 + 0.6, bias: bias + 0.1, round: 0.5 });
    }
  };

  hind(true);
  arm(true);
  // ---------------------------------------------------------------- the head and trunk
  const contour = S.body(P).map(q => { const u = T(q[0], q[1]); return (q[2] ? [u[0], u[1], 1] : [u[0], u[1]]) as LP; });
  const fl = S.fill ?? 0;
  blob(sk, contour, (p) => { const b = inv(p.x, p.y); if (p.nx > 0) p.l += p.nx * fl; return S.paint.body(p, b[0], b[1]); }, {
    z: 0, round: S.round * k, dome: S.dome * k, per: 4, spec: S.spec ?? 0.3, specPow: 14,
    add: (F) => S.sculpt?.(F, T, P),
  });
  // the vocal sac: from a creased throat pouch to a taut glossy balloon under the chin
  if (P.sac > 0.08) {
    const r = S.sac.r * (0.3 + P.sac * 0.7);
    const at = T(S.sac.at[0] + r * 0.25, S.sac.at[1] + r * 0.55);
    const R = r * k;
    const pts: LP[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      // flatter where it hangs from the throat, fullest low and forward
      const rr = R * (1 + 0.08 * Math.cos(a - 0.6)) * (Math.sin(a) < 0 ? 0.88 : 1);
      pts.push([at[0] + Math.cos(a) * rr * 1.08, at[1] + Math.sin(a) * rr]);
    }
    blob(sk, pts, (p) => S.paint.sac(p, P.sac), { z: S.zBody + 0.8, round: R * 0.9, dome: R * 0.3, spec: 0.9, specPow: 10, per: 3 });
  }
  arm(false);
  hind(false);

  // ---------------------------------------------------------------- the tongue
  if (P.tongue > 0.04) {
    const m0 = T(S.mouth.tip[0] - 0.4, S.mouth.tip[1] + 0.2);
    const L = P.tongue * (S.tongueLen ?? 12) * k;
    const path = curve([m0, [m0[0] + L * 0.35, m0[1] + 0.3 * k], [m0[0] + L * 0.7, m0[1] - L * 0.1], [m0[0] + L, m0[1] - L * 0.17]], 4);
    // a fleshy strap that widens into the sticky pad at the tip
    seg(sk, path, t => (0.42 + (t > 0.82 ? (t - 0.82) * 4 : 0)) * k, t => (0.38 + (t > 0.82 ? (t - 0.82) * 3.5 : 0)) * k,
      (p, t) => S.paint.tongue(p, t), { z: S.zBody + 3, round: 0.5 * k, spec: 0.8, capA: 0.3, capB: 1 });
  }
  // the gape: the mouth thrown open along the lip line
  if (P.gape > 0.05) {
    const a = T(S.mouth.tip[0] - 0.2, S.mouth.tip[1] + 0.1), b = T(S.mouth.corner[0] + 0.6, S.mouth.corner[1]);
    sk.np();
    sk.line(a[0], a[1], b[0], b[1], S.paint.mouth, 0.3, S.zBody + 2.5, true);
  }
  S.after?.(sk, T, P, k);
  const e = T(S.eye[0], S.eye[1]);
  const eye = anuranEye(sk, e[0], e[1], S.eyeSize, eyeSt, S.eyePal);
  const hd = T(S.neck[0] + 1.5, S.neck[1] - 3);
  return { head: hd, eye, T, inv };
}

function circle(c: V2, r: number): LP[] {
  const out: LP[] = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
  return out;
}

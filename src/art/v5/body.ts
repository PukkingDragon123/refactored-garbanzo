// V5 body renderer: the V2 skeleton + pose library, painted like hand-shaded pixel art. Every part
// is a shaded volume lit from the upper front (the way the sprite faces), picked from 6-step
// hue-shifted ramps, with contact lines in each part's own deep tone where parts overlap, soft cast
// shadows underneath, and a near-black outline around the silhouette.

import { PixelBuffer } from '../pixel';
import { Canvas, Pose, solve, trimPair, P2, Hand, FLAT, LIGHT, Sample, light3 } from '../people-rig';
import { CharDef, Ctx, drawLeg, drawTorso, B } from '../people-parts';
import type { BodyFrame } from '../people-body';
import { Ramp, tn, outlineOf, lineOf, aoOf, C } from './tone';
import { drawProp5 } from './props';

export interface ArmStyle5 {
  rSh: number;
  rEl: number;
  rWr: number;
  /** optional radius along the forearm (u 0 elbow → 1 wrist): cuffs, bunched sleeves */
  foreR?: (u: number) => number;
  upper(s: Sample, near: boolean): C | -1;
  fore(s: Sample, near: boolean): C | -1;
}

export interface V5Char extends Omit<CharDef, 'id' | 'skin' | 'arm'> {
  id: string;
  skin: Ramp;
  arm: ArmStyle5;
  /** hand size multiplier */
  handK: number;
  /** hair sway state for the head from a pose (secondary motion) */
  hair?(p: Pose, anim: string): number;
}

export interface BodyFrame5 extends BodyFrame { hair?: number }

/** light from the upper front for V5 sprites (they face +x) */
const V5_LIGHT = { x: 0.4, y: -0.74, z: 0.54 };
export const FAR = -0.38;

export const merge5 = (c: Canvas, line = 0.42, ao = 0.18, lineLit = 0.12) => c.merge({ line, lineLit, ao, lineFn: lineOf, aoFn: aoOf });

// ------------------------------------------------------------------ hands & arms

/** small hand at the wrist pointing along ground-space angle `ang` */
export function hand5(c: Canvas, wr: P2, ang: number, hand: Hand, skin: Ramp, near: boolean, k: number) {
  const fx: P2 = [Math.cos(ang), -Math.sin(ang)];
  const uy: P2 = [Math.cos(ang + Math.PI / 2), -Math.sin(ang + Math.PI / 2)];
  const bias = near ? 0.05 : FAR;
  const col = (l: number) => tn(skin, l, bias);
  // light: the thumb side (ly > 0) faces up/forward in most poses
  c.frame(wr, fx, uy, [-1.5 * k - 1, 5 * k + 1, -3 * k - 1, 3 * k + 1], (lx0, ly0) => {
    const lx = lx0 / k, ly = ly0 / k;
    switch (hand) {
      case 'fist': case 'grip': {
        const dx = lx - 1.4, dy = ly;
        if (dx * dx * 0.9 + dy * dy > 2.6) return -1;
        return col(dy * 0.45 + (dx > 0.6 ? 0.25 : 0) + 0.05);
      }
      case 'point': {
        const dx = lx - 1.3, dy = ly;
        if (dx * dx + dy * dy <= 2.3) return col(dy * 0.4 + 0.05);
        return lx > 2 && lx < 4.4 && ly > -0.1 && ly < 1.05 ? col(0.4) : -1;
      }
      case 'open': case 'flat': {
        const palm = lx > -0.3 && lx < 2.4 && Math.abs(ly) < 1.45;
        const fing = lx >= 2.4 && lx < 3.9 && ly > -1.2 && ly < 1.25;
        const thumb = hand === 'open' && lx > 0.5 && lx < 2 && ly >= 1.45 && ly < 2.4;
        if (!palm && !fing && !thumb) return -1;
        return col(ly * 0.3 + (fing ? 0.1 : 0.2));
      }
      case 'pinch': {
        const dx = lx - 1.3;
        if (dx * dx + ly * ly <= 2.2) return col(0.15);
        return lx > 2 && lx < 3.2 && ly > 0 && ly < 1.1 ? col(0.4) : -1;
      }
      default:
        return -1;
    }
  });
}

export function arm5(x: Ctx, near: boolean) {
  const { c, J } = x;
  const ch = x.ch as unknown as V5Char;
  const A = ch.arm;
  const sh = B(c, near ? J.shF : J.shB);
  const el = B(c, near ? J.elF : J.elB);
  const wr = B(c, near ? J.wrF : J.wrB);
  const ap = near ? x.P.fa : x.P.ba;
  const d1: P2 = [el[0] - sh[0], el[1] - sh[1]], d2: P2 = [wr[0] - el[0], wr[1] - el[1]];
  const cosA = (d1[0] * d2[0] + d1[1] * d2[1]) / (Math.hypot(d1[0], d1[1]) * Math.hypot(d2[0], d2[1]) + 1e-6);
  const folded = cosA < -0.05;
  const hand = ap.hand ?? 'fist';
  const drawHand = () => {
    if (hand === 'none') return;
    const ang = ap.ha !== undefined ? ap.ha : Math.atan2(-d2[1], d2[0]);
    hand5(c, wr, ang, hand, ch.skin, near, ch.handK);
    merge5(c, 0.4, 0.12, 0.2);
  };
  c.limb(sh, el, A.rSh, A.rEl, s => A.upper(s, near));
  if (folded) merge5(c, 0.34, 0.14);
  const fr = A.foreR;
  if (fr) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p0: P2 = [el[0] + d2[0] * t0, el[1] + d2[1] * t0], p1: P2 = [el[0] + d2[0] * t1, el[1] + d2[1] * t1];
      c.limb(p0, p1, fr(t0), fr(t1), s => { s.u = t0 + s.u * (t1 - t0); return A.fore(s, near); });
    }
  } else c.limb(el, wr, A.rEl, A.rWr, s => A.fore(s, near));
  merge5(c, folded ? 0.5 : 0.44, 0.2, 0.18);
  drawHand();
}

export function neck5(x: Ctx) {
  const { c, J } = x;
  const ch = x.ch as unknown as V5Char;
  const a = B(c, J.neckBase), b = B(c, J.neckTop);
  const r = ch.neckR;
  // the neck sits in the shadow of the jaw
  c.limb([a[0], a[1] + 1], [b[0], b[1] + 1.5], r, r * 0.95, s => tn(ch.skin, s.l - 0.45 + (s.u > 0.6 ? -0.3 : 0)));
  merge5(c, 0.1, 0);
}

// ------------------------------------------------------------------ finishing

/** near-black outline around the silhouette, carrying the local hue */
export function finish5(buf: PixelBuffer) {
  const w = buf.w, h = buf.h, d = buf.data;
  const src = d.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i] >>> 24) continue;
      let nb = -1;
      if (op(x + 1, y)) nb = i + 1;
      else if (op(x - 1, y)) nb = i - 1;
      else if (op(x, y + 1)) nb = i + w;
      else if (op(x, y - 1)) nb = i - w;
      if (nb >= 0) d[i] = outlineOf(src[nb]);
    }
}

// ------------------------------------------------------------------ frame

const CW = 120, CH = 110, OX = 60, OY = 90;

/** Paint one body frame (no head). */
export function paint5Body(ch: V5Char, pose: Pose, anim: string, t: number): BodyFrame5 {
  const was = FLAT.on;
  const L0 = { ...LIGHT };
  FLAT.on = false;
  Object.assign(LIGHT, V5_LIGHT);
  try {
    const c = new Canvas(CW, CH, OX, OY);
    const J = solve(ch.build, pose);
    const x: Ctx = { c, J, P: pose, b: ch.build, ch: ch as unknown as CharDef, anim, t };
    const front = new Set(pose.front ?? []);
    const props = pose.props ?? [];
    const drawProps = (z: string) => {
      for (const p of props) {
        if ((p.z ?? 'hand') !== z) continue;
        c.useFront(!!p.front);
        drawProp5(x, p);
        c.useFront(false);
      }
    };
    const arm = (nearArm: boolean) => {
      c.useFront(front.has(nearArm ? 'armF' : 'armB'));
      arm5(x, nearArm);
      c.useFront(false);
    };
    ch.behind?.(x);
    drawProps('back');
    if (!pose.armBFwd) arm(false);
    if (!pose.legBFwd) drawLeg(x, false);
    if (!pose.legFwd) drawLeg(x, true);
    ch.afterLegs?.(x);
    neck5(x);
    drawTorso(x);
    ch.afterTorso?.(x);
    if (pose.legBFwd) drawLeg(x, false);
    if (pose.legFwd) drawLeg(x, true);
    drawProps('mid');
    if (pose.armBFwd) arm(false);
    ch.beforeArmF?.(x);
    arm(true);
    ch.afterArmF?.(x);
    drawProps('hand');
    drawProps('top');
    finish5(c.back);
    let fr: PixelBuffer | null = c.front;
    if (fr) {
      let any = false;
      for (let i = 0; i < fr.data.length; i++) if (fr.data[i] >>> 24) { any = true; break; }
      if (any) finish5(fr);
      else fr = null;
    }
    const tr = trimPair(c.back, fr, 1);
    const nt = B(c, J.neckTop);
    const hw = B(c, J.wrF);
    return {
      back: tr.a,
      front: tr.b,
      ax: OX - tr.ox,
      ay: OY - tr.oy,
      hx: Math.round(nt[0]) - tr.ox,
      hy: Math.round(nt[1]) - tr.oy,
      look: pose.look,
      hand: [Math.round(hw[0]) - tr.ox, Math.round(hw[1]) - tr.oy],
      headBehind: pose.headBehind || undefined,
      hrot: pose.flags?.hrot,
      hair: ch.hair?.(pose, anim),
    };
  } finally {
    FLAT.on = was;
    Object.assign(LIGHT, L0);
  }
}

export { light3 };

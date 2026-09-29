// V4 anime body renderer: the V2 skeleton + pose rig, painted with small clean anime proportions
// (tiny hands, slim limbs), flat 4-tone cel shading and a dark outline, plus the V4 prop set.

import { PixelBuffer } from '../pixel';
import { Canvas, Pose, solve, finish, trimPair, P2, Hand, FLAT } from '../people-rig';
import { CharDef, Ctx, drawLeg, drawNeck, drawTorso, B } from '../people-parts';
import type { BodyFrame } from '../people-body';
import { drawAnimeProp } from './props';
import type { C } from '../color';

/** flat cel tone: pal = [deep, shadow, base, light] */
export function flat(pal: C[], l: number, near = true, bias = 0): C {
  const v = l + bias;
  if (!near) return v > 0.45 ? pal[2] : v > -0.5 ? pal[1] : pal[0];
  return v > 0.66 ? pal[3] : v > -0.22 ? pal[2] : v > -0.7 ? pal[1] : pal[0];
}

export interface AnimeChar extends Omit<CharDef, 'id'> {
  id: string;
  /** hand size (1 = V2 size); anime hands are small */
  handK: number;
  handPal: C[];
}

/** Small anime hand at the wrist, pointing along ground-space angle `ang`. */
export function animeHand(c: Canvas, wr: P2, ang: number, hand: Hand, pal: C[], near: boolean, k: number) {
  const fx: P2 = [Math.cos(ang), -Math.sin(ang)];
  const uy: P2 = [Math.cos(ang + Math.PI / 2), -Math.sin(ang + Math.PI / 2)];
  const col = (l: number) => flat(pal, l, near);
  c.frame(wr, fx, uy, [-1.5 * k - 1, 5 * k + 1, -3 * k - 1, 3 * k + 1], (lx0, ly0) => {
    const lx = lx0 / k, ly = ly0 / k;
    switch (hand) {
      case 'fist': case 'grip': {
        const dx = lx - 1.5, dy = ly;
        return dx * dx + dy * dy <= 3.2 ? col(dy * 0.4 - dx * 0.2 + 0.2) : -1;
      }
      case 'point': {
        const dx = lx - 1.3, dy = ly;
        if (dx * dx + dy * dy <= 2.6) return col(dy * 0.35 + 0.1);
        return lx > 2 && lx < 4.6 && ly > -0.2 && ly < 1.1 ? col(0.4) : -1;
      }
      case 'open': case 'flat': {
        const palm = lx > -0.4 && lx < 2.6 && Math.abs(ly) < 1.5;
        const fing = lx >= 2.6 && lx < 4.2 && ly > -1.3 && ly < 1.3;
        const thumb = hand === 'open' && lx > 0.6 && lx < 2.2 && ly >= 1.5 && ly < 2.5;
        return palm || fing || thumb ? col(ly * 0.25 + 0.2) : -1;
      }
      case 'pinch': {
        const dx = lx - 1.3;
        if (dx * dx + ly * ly <= 2.4) return col(0.2);
        return lx > 2 && lx < 3.4 && ly > 0 && ly < 1.2 ? col(0.4) : -1;
      }
      default:
        return -1;
    }
  });
}

export function animeArm(x: Ctx, near: boolean) {
  const { c, J } = x;
  const ch = x.ch as AnimeChar;
  const A = ch.arm;
  const sh = B(c, near ? J.shF : J.shB);
  const el = B(c, near ? J.elF : J.elB);
  const wr = B(c, near ? J.wrF : J.wrB);
  const ap = near ? x.P.fa : x.P.ba;
  const d1: P2 = [el[0] - sh[0], el[1] - sh[1]], d2: P2 = [wr[0] - el[0], wr[1] - el[1]];
  const cosA = (d1[0] * d2[0] + d1[1] * d2[1]) / (Math.hypot(d1[0], d1[1]) * Math.hypot(d2[0], d2[1]) + 1e-6);
  const folded = cosA < -0.05;
  c.limb(sh, el, A.rSh, A.rEl, s => A.upper(s, near));
  if (folded) c.merge({ line: 0.3, ao: 0.12 });
  c.limb(el, wr, A.rEl, A.rWr, s => A.fore(s, near));
  c.merge({ line: folded ? 0.45 : 0.4, lineLit: 0.2, ao: 0.2 });
  const hand = ap.hand ?? 'fist';
  if (hand !== 'none') {
    const ang = ap.ha !== undefined ? ap.ha : Math.atan2(-(d2[1]), d2[0]);
    animeHand(c, wr, ang, hand, ch.handPal, near, ch.handK);
    c.merge({ line: 0.4, lineLit: 0.2, ao: 0.16 });
  }
}

const CW = 120, CH = 110, OX = 60, OY = 90;

/** Paint one body frame (no head). Mirrors people-body.paintBody with anime arms and props. */
export function paintAnimeBody(ch: AnimeChar, pose: Pose, anim: string, t: number): BodyFrame {
  const was = FLAT.on;
  FLAT.on = true;
  const c = new Canvas(CW, CH, OX, OY);
  const J = solve(ch.build, pose);
  const x: Ctx = { c, J, P: pose, b: ch.build, ch: ch as unknown as CharDef, anim, t };
  const front = new Set(pose.front ?? []);
  const props = pose.props ?? [];
  const drawProps = (z: string) => {
    for (const p of props) {
      if ((p.z ?? 'hand') !== z) continue;
      c.useFront(!!p.front);
      drawAnimeProp(x, p);
      c.useFront(false);
    }
  };
  const arm = (nearArm: boolean) => {
    c.useFront(front.has(nearArm ? 'armF' : 'armB'));
    animeArm(x, nearArm);
    c.useFront(false);
  };
  ch.behind?.(x);
  drawProps('back');
  if (!pose.armBFwd) arm(false);
  if (!pose.legBFwd) drawLeg(x, false);
  if (!pose.legFwd) drawLeg(x, true);
  ch.afterLegs?.(x);
  drawNeck(x);
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
  finish(c.back, 0);
  let fr: PixelBuffer | null = c.front;
  if (fr) {
    let any = false;
    for (let i = 0; i < fr.data.length; i++) if (fr.data[i] >>> 24) { any = true; break; }
    if (any) finish(fr, 0);
    else fr = null;
  }
  FLAT.on = was;
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
  };
}

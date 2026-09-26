// V2 people: generic body-part painters (legs, boots, arms, hands, torso, neck) driven by
// per-character material shaders. All painters draw into the Canvas part layer and merge.

import { C, shade, mix } from './color';
import { Canvas, Joints, Pose, Build, P2, Sample, Hand, tone, light3, clampi, at } from './people-rig';

export type CharId = 'rowan' | 'crowe' | 'aroha' | 'lou' | 'pip';

export interface LegStyle {
  rThigh: number;
  rKnee: number;
  rAnkle: number;
  /** pants end this far above the ankle with a flat cuff (0 = round end at the ankle) */
  cuff?: number;
  /** pants/leg material. s.u: 0 hip → 1 ankle over the whole leg (thigh 0..0.5, shin 0.5..1). */
  mat(s: Sample, near: boolean): C | -1;
  /** foot painter at the ankle (buffer space), pitch = foot angle */
  foot(x: Ctx, an: P2, pitch: number, near: boolean): void;
  /** true: foot drawn after the pants (sandals, tucked boots) */
  footOver?: boolean;
}

export interface ArmStyle {
  rSh: number;
  rEl: number;
  rWr: number;
  /** upper arm material, u 0 shoulder → 1 elbow */
  upper(s: Sample, near: boolean): C | -1;
  /** forearm material, u 0 elbow → 1 wrist */
  fore(s: Sample, near: boolean): C | -1;
  /** optional forearm radius profile (bunched sleeves) */
  foreR?: (u: number) => number;
  hand: C[];
}

export interface TorsoStyle {
  /** [ly, back, front] control points, ly from below the hip (negative) to the top */
  prof: [number, number, number][];
  mat(s: Sample, x: Ctx): C | -1;
}

export interface FaceRef {
  /** near eye centre relative to the head anchor (ground px, y up) */
  eye: P2;
  mouth: P2;
  chin: P2;
  /** top of the head above the anchor */
  top: number;
  /** pipe bowl (crowe) relative to the head anchor */
  pipe?: P2;
}

export interface CharDef {
  id: CharId;
  build: Build;
  skin: C[];
  leg: LegStyle;
  arm: ArmStyle;
  torso: TorsoStyle;
  neckR: number;
  face: FaceRef;
  behind?(x: Ctx): void;
  afterLegs?(x: Ctx): void;
  afterTorso?(x: Ctx): void;
  afterArmF?(x: Ctx): void;
  /** called right before the front arm (e.g. cloak drape the arm goes over) */
  beforeArmF?(x: Ctx): void;
}

export interface Ctx {
  c: Canvas;
  J: Joints;
  P: Pose;
  b: Build;
  ch: CharDef;
  /** anim name and phase, for painters that vary details */
  anim: string;
  t: number;
}

// ------------------------------------------------------------------ helpers

export const B = (c: Canvas, p: P2): P2 => [c.X(p[0]), c.Y(p[1])];

/** profile lookup (back, front) at local height ly */
export function profAt(prof: [number, number, number][], ly: number): [number, number] {
  if (ly <= prof[0][0]) return [prof[0][1], prof[0][2]];
  for (let i = 1; i < prof.length; i++) {
    const [y1, b1, f1] = prof[i];
    if (ly <= y1) {
      const [y0, b0, f0] = prof[i - 1];
      const t = (ly - y0) / (y1 - y0);
      return [b0 + (b1 - b0) * t, f0 + (f1 - f0) * t];
    }
  }
  const l = prof[prof.length - 1];
  return [l[1], l[2]];
}

/** torso local frame vectors in buffer space */
export function torsoAxes(J: Joints): { fx: P2; uy: P2 } {
  return { fx: [J.fwd[0], -J.fwd[1]], uy: [J.up[0], -J.up[1]] };
}

/** local torso coords → buffer */
export function tl(x: Ctx, lx: number, ly: number): P2 {
  const { fx, uy } = torsoAxes(x.J);
  const h = B(x.c, x.J.hip);
  return [h[0] + fx[0] * lx + uy[0] * ly, h[1] + fx[1] * lx + uy[1] * ly];
}

// ------------------------------------------------------------------ legs

export function drawLeg(x: Ctx, near: boolean) {
  const { c, J, ch } = x;
  const L = ch.leg;
  const hip = B(c, near ? J.hipF : J.hipB);
  const kn = B(c, near ? J.knF : J.knB);
  const an = B(c, near ? J.anF : J.anB);
  const leg = near ? x.P.fl : x.P.bl;
  const pitch = leg.fa ?? 0;
  const foot = () => {
    L.foot(x, an, pitch, near);
    c.merge({ line: 0.28, ao: 0.16 });
  };
  if (!L.footOver) foot();
  const mat = L.mat;
  c.limb(hip, kn, L.rThigh, L.rKnee, s => {
    s.u = s.u * 0.5;
    return mat(s, near);
  });
  const cf = L.cuff ?? 0;
  let end: P2 = an;
  if (cf > 0) {
    const dx = an[0] - kn[0], dy = an[1] - kn[1];
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.max(0.2, (d - cf) / d);
    end = [kn[0] + dx * k, kn[1] + dy * k];
  }
  c.limb(kn, end, L.rKnee, L.rAnkle, s => {
    s.u = 0.5 + s.u * 0.5;
    return mat(s, near);
  }, true, cf <= 0);
  c.merge({ line: 0.34, lineLit: 0.14, ao: 0.22 });
  if (L.footOver) foot();
}

/** Foot-local rasterizer: origin at the ankle, x forward along the sole (pitched), y up. */
export function footFrame(c: Canvas, an: P2, pitch: number, ext: [number, number, number, number], sh: (fx: number, fy: number, s: Sample) => C | -1) {
  const fx: P2 = [Math.cos(pitch), -Math.sin(pitch)];
  const uy: P2 = [Math.sin(pitch) * -1, -Math.cos(pitch)];
  // uy must be "up" in buffer space: rotate fx by -90° in screen terms
  uy[0] = fx[1];
  uy[1] = -fx[0];
  c.frame(an, fx, uy, ext, (lx, ly, s) => sh(lx, ly, s));
}

export interface BootSpec {
  ramp: C[];
  sole: C[];
  lace?: C;
  /** profile polygon in foot space (x forward from the ankle, y up from the sole bottom) */
  shape: number[];
  /** ankle height above the sole bottom */
  ah: number;
  soleH?: number;
  cuff?: C[];
  cuffH?: number;
  toeCap?: C[];
  lacePts?: P2[];
  scuff?: C;
}

export function polyIn(p: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Chunky boot from a side profile: sole, midsole line, toe cap, laces, padded collar. */
export function boot(x: Ctx, an: P2, pitch: number, near: boolean, s: BootSpec) {
  const { c } = x;
  const sh = s.shape;
  let minX = 1e9, maxX = -1e9, maxY = 0;
  for (let i = 0; i < sh.length; i += 2) { minX = Math.min(minX, sh[i]); maxX = Math.max(maxX, sh[i]); maxY = Math.max(maxY, sh[i + 1]); }
  const soleH = s.soleH ?? 1.4;
  const dk = near ? 0 : -0.3;
  footFrame(c, an, pitch, [minX - 1, maxX + 1, -s.ah - 1, maxY - s.ah + 1], (fx, fy) => {
    const y = fy + s.ah;
    if (!polyIn(sh, fx, y)) return -1;
    if (y < soleH) return y < soleH * 0.5 ? at(s.sole, 1 + (near ? 0 : -1)) : at(s.sole, s.sole.length - 1 + (near ? 0 : -1));
    // form light: top faces up, toe faces forward, heel back
    const topK = y > maxY - 1.4 ? 0.55 : y > maxY - 2.6 ? 0.2 : 0;
    const nxl = fx > maxX - 2.2 ? 0.45 : fx < minX + 1.2 ? -0.7 : 0;
    const l = light3(nxl, -topK, 0.7) + dk;
    if (s.cuff && y > maxY - (s.cuffH ?? 1.3) && fx < 2.4) return tone(s.cuff, l + 0.1, 0.1);
    if (s.toeCap && fx > maxX - 2.6 && y < soleH + 1.6) return tone(s.toeCap, l, 0);
    if (s.lace && s.lacePts)
      for (const p of s.lacePts) if (Math.abs(fx - p[0]) < 0.55 && Math.abs(y - p[1]) < 0.55) return s.lace;
    if (s.scuff && fx > maxX - 3.6 && fx < maxX - 2.6 && y > soleH + 0.2 && y < soleH + 1.2) return s.scuff;
    return tone(s.ramp, l, -0.05, 1.1);
  });
}

/** Sandal: bare foot + sole + straps; ankle wraps are painted by the leg material. */
export function sandal(x: Ctx, an: P2, pitch: number, near: boolean, skin: C[], leather: C[], toe = 5.5, heel = 2.5, ah = 2.6) {
  const { c } = x;
  footFrame(c, an, pitch, [-heel - 1, toe + 1, -ah - 1, 3], (fx, fy) => {
    const y = fy + ah;
    if (y < 0 || fx < -heel || fx > toe) return -1;
    if (y < 1) return leather[near ? 1 : 0];
    // foot shape
    const hmax = fx < 1 ? ah + 1.5 : ah + 1.5 - (fx - 1) * 0.5;
    if (y > hmax) return -1;
    if (fx > toe - 0.8 && y > 2.2) return -1;
    let col = tone(skin, (fx > toe - 2 ? 0.3 : 0) + (y > hmax - 1 ? 0.35 : -0.1) + (near ? 0 : -0.35), 0, 1);
    // straps: across the toes and the instep
    if ((fx > 2.4 && fx < 3.4) || (fx > -0.5 && fx < 0.6 && y > 1)) col = leather[near ? 3 : 2];
    return col;
  });
}

// ------------------------------------------------------------------ arms & hands

export function drawArm(x: Ctx, near: boolean) {
  const { c, J, ch } = x;
  const A = ch.arm;
  const sh = B(c, near ? J.shF : J.shB);
  const el = B(c, near ? J.elF : J.elB);
  const wr = B(c, near ? J.wrF : J.wrB);
  const ap = near ? x.P.fa : x.P.ba;
  // sharp elbow folds get a separation line between upper and forearm
  const d1: P2 = [el[0] - sh[0], el[1] - sh[1]], d2: P2 = [wr[0] - el[0], wr[1] - el[1]];
  const cosA = (d1[0] * d2[0] + d1[1] * d2[1]) / (Math.hypot(d1[0], d1[1]) * Math.hypot(d2[0], d2[1]) + 1e-6);
  const folded = cosA < -0.05;
  c.limb(sh, el, A.rSh, A.rEl, s => A.upper(s, near));
  if (folded) c.merge({ line: 0.3, ao: 0.16 });
  const fr = A.foreR;
  if (fr) {
    // variable radius: draw as a few segments
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p0: P2 = [el[0] + d2[0] * t0, el[1] + d2[1] * t0], p1: P2 = [el[0] + d2[0] * t1, el[1] + d2[1] * t1];
      c.limb(p0, p1, fr(t0), fr(t1), s => {
        s.u = t0 + s.u * (t1 - t0);
        return A.fore(s, near);
      });
    }
  } else c.limb(el, wr, A.rEl, A.rWr, s => A.fore(s, near));
  c.merge({ line: folded ? 0.5 : 0.46, lineLit: 0.3, ao: 0.26 });
  // hand
  const hand = ap.hand ?? 'fist';
  if (hand !== 'none') {
    const ang = ap.ha !== undefined ? ap.ha : Math.atan2(-(d2[1]), d2[0]); // ground-space angle
    drawHand(c, wr, ang, hand, A.hand, near);
    c.merge({ line: 0.42, lineLit: 0.22, ao: 0.2 });
  }
}

/** Hand at the wrist (buffer space), pointing along ground-space angle `ang`. */
export function drawHand(c: Canvas, wr: P2, ang: number, hand: Hand, skin: C[], near: boolean) {
  const fx: P2 = [Math.cos(ang), -Math.sin(ang)];
  // "up" side of the hand = rotate +90° in ground space
  const uy: P2 = [Math.cos(ang + Math.PI / 2), -Math.sin(ang + Math.PI / 2)];
  const bias = near ? 0.05 : -0.3;
  const col = (l: number) => tone(skin, l, bias, 1);
  c.frame(wr, fx, uy, [-2, 6, -4, 4], (lx, ly) => {
    // lx along the hand from the wrist, ly across (+ = thumb side)
    let inside = false, l = 0;
    switch (hand) {
      case 'fist':
      case 'grip': {
        const dx = lx - 2.1, dy = ly - 0.1;
        inside = dx * dx + dy * dy <= 5.4;
        l = -dx * 0.25 + dy * 0.4 + 0.2;
        if (hand === 'grip' && lx > 0.6 && lx < 1.8 && ly > 1.3 && ly < 2.4) { inside = true; l = 0.5; }
        break;
      }
      case 'point': {
        const dx = lx - 1.7, dy = ly;
        inside = dx * dx + dy * dy <= 3.3 || (lx > 2.5 && lx < 5.8 && ly > 0.2 && ly < 1.3);
        l = ly * 0.35 + 0.15;
        break;
      }
      case 'open':
      case 'flat': {
        // palm + fingers
        const palm = lx > -0.3 && lx < 3.2 && Math.abs(ly) < 1.8;
        const fing = lx >= 3.2 && lx < 5.2 && ly > -1.6 && ly < 1.5;
        const thumb = hand === 'open' && lx > 0.6 && lx < 2.6 && ly >= 1.8 && ly < 2.9;
        inside = palm || fing || thumb;
        l = ly * 0.25 + (fing ? 0.1 : 0.25);
        break;
      }
      case 'pinch': {
        const dx = lx - 1.6, dy = ly;
        inside = dx * dx + dy * dy <= 3 || (lx > 2.4 && lx < 4 && ly > 0.3 && ly < 1.4);
        l = ly * 0.3 + 0.2;
        break;
      }
      default:
        return -1;
    }
    return inside ? col(l) : -1;
  });
}

// ------------------------------------------------------------------ torso & neck

export function drawNeck(x: Ctx) {
  const { c, J, ch } = x;
  const a = B(c, J.neckBase), b = B(c, J.neckTop);
  const r = ch.neckR;
  c.limb([a[0], a[1] + 1], [b[0], b[1] + 1], r, r * 0.95, s => tone(ch.skin, s.l - 0.35 + (s.u > 0.7 ? -0.2 : 0), -0.1, 0.9));
  c.merge({ line: 0.1, ao: 0 });
}

export function drawTorso(x: Ctx) {
  const { c, J, ch } = x;
  const T = ch.torso;
  const { fx, uy } = torsoAxes(J);
  const hip = B(c, J.hip);
  const prof = T.prof;
  const top = prof[prof.length - 1][0], bot = prof[0][0];
  let minB = 0, maxF = 0;
  for (const p of prof) { minB = Math.min(minB, p[1]); maxF = Math.max(maxF, p[2]); }
  const sq = J.sq;
  const TT = x.b.torso;
  c.frame(hip, fx, uy, [minB - 1, maxF + 1, bot - 1, top * sq + 1], (lx, ly0, s) => {
    const ly = ly0 / sq;
    if (ly < bot || ly > top) return -1;
    const [bk, fr] = profAt(prof, ly);
    if (lx < bk || lx > fr) return -1;
    const u = (lx - bk) / Math.max(0.5, fr - bk);
    const a = u * 2 - 1;
    // normal: horizontal curvature + shoulder/top rounding
    const topK = Math.max(0, (ly - (top - 3.5)) / 3.5);
    const botK = Math.max(0, (bot + 2 - ly) / 3);
    const nUp = topK * 0.85 - botK * 0.5;
    const nx = a * 0.88;
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - nUp * nUp));
    s.u = u; s.v = ly / TT; s.lx = lx; s.ly = ly;
    s.l = light3(nx, -nUp, nz);
    return T.mat(s, x);
  });
  c.merge({ line: 0.18, ao: 0.2 });
}

/** Local-frame painter on the torso (for straps, belts, overlays): lx/ly in torso px. */
export function torsoFrame(x: Ctx, ext: [number, number, number, number], sh: (lx: number, ly: number, s: Sample) => C | -1) {
  const { fx, uy } = torsoAxes(x.J);
  x.c.frame(B(x.c, x.J.hip), fx, uy, ext, sh);
}

export { tone, light3, shade, mix };

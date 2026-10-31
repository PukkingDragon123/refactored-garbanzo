// Mori's gloved hands in the close-ups, in the cast's anime-realistic style: the rig's modelled hand
// (src/art/v7/hands.ts: palm, two-jointed fingers and thumb) rasterised at the close-up's fine grid
// with cel shading, a selective outline and a rim of back light, then dressed as a physical object:
//   - tan leather work gloves: grained leather, the three stitched points on the back of the hand,
//     stitched seams down the sides of the fingers, creases at every finger joint, scuffed tips, a
//     suede palm patch, and a flared gauntlet cuff with a strap and a brass press stud
//   - the olive canvas field-jacket sleeve: compression folds bunching toward the cuff, a long
//     tension fold, the stitched inner seam, a twill weave, and a buttoned cuff with its tab
// Poses: grip (a handle through the fist), knife (the index laid along the spine), open, cup, pinch
// and brush (held like a pen). A pose has an anchor (where the handle, the palm or the pinch is) so a
// scene just says where the action happens (in units).

import { PixelBuffer, Z, hex, mix } from './kit';
import type { C } from './kit';
import { Scene3D, V3, Hit, cel, Ramp6, vadd, vsub, vsc, vnorm, vdot, vlen } from '../../../art/v7/raster';
import { drawHand7, handFrame, handBones } from '../../../art/v7/hands';
import type { J3 } from '../../../art/v7/body';
import type { ArmP } from '../../../art/people-rig';

/** the player's first-person hands are never shown (user): close-ups show only the tools and what
 *  they touch. Kept so they can come back. */
export const FIRST_PERSON_HANDS = false;

export type Pose = 'grip' | 'open' | 'pinch' | 'cup' | 'knife' | 'brush';

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
/** tan work-glove leather, the darker gauntlet leather, the olive canvas sleeve */
const GLOVE = R6('#24140a', '#4a2a12', '#74461e', '#9c622c', '#c48a46', '#e8bc78');
const CUFF = R6('#180c06', '#36200e', '#553218', '#734626', '#93603a', '#b88456');
const SLEEVE = R6('#101408', '#202a10', '#323f18', '#475a22', '#62782f', '#86a048');
const BRASS = R6('#1a1004', '#4a3010', '#7a5418', '#b08430', '#d8b050', '#fff0b0');
const HORN = R6('#0a0606', '#1e1412', '#2e201c', '#3e2c26', '#5a443a', '#7a6458');
const THREAD = hex('#efd9a8'), CANVAS_THREAD = hex('#b8c07a');
const INK = hex('#140a06'), DK = hex('#140a06');
const frac = (v: number) => v - Math.floor(v);
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** the drawn hand's size: rig hand units → close-up units (a fist about 24 units long, the palm as wide as the sleeve) */
const HK = 7.2;
const HAND = 1 + (HK - 1.48) / 0.6;

interface Spec { hand: string; anchor: 'grip' | 'palm' | 'pinch'; tilt: number; flex: number }
const SPEC: Record<Pose, Spec> = {
  grip: { hand: 'grip', anchor: 'grip', tilt: 0.38, flex: 0 },
  knife: { hand: 'knife', anchor: 'grip', tilt: 0.42, flex: 0 },
  open: { hand: 'open', anchor: 'palm', tilt: 0.22, flex: 0.1 },
  cup: { hand: 'cup', anchor: 'palm', tilt: 0.2, flex: 0.06 },
  pinch: { hand: 'pinch', anchor: 'pinch', tilt: 0.5, flex: 0.15 },
  brush: { hand: 'brush', anchor: 'pinch', tilt: 0.55, flex: 0.2 },
};
/** rot (quarter turns clockwise) → the way the fingers point (world: x right, y up) */
const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export interface HandOpts {
  /** quarter turns clockwise (1: the fingers point right) */
  rot?: 0 | 1 | 2 | 3;
  /** the left hand */
  left?: boolean;
  /** where the sleeve comes in from (units; default: straight down off the bottom of the set) */
  from?: [number, number];
  /** sleeve radius (units) */
  r?: number;
  /** darken (in shadow) */
  dark?: number;
}

/** the posed hand: its frame and the wrist that puts the pose's anchor on (x, y) units */
function place(p: Pose, x: number, y: number, rot: number, left: boolean) {
  const sp = SPEC[p];
  const [dx, dy] = DIRS[rot & 3];
  const d: V3 = [dx, dy, 0];
  // the thumb side in the picture plane; the palm faces away from us, rolled so the thumb side turns toward us
  const sideV: V3 = vsc([-dy, dx, 0], left ? -1 : 1);
  const n = vnorm(vsub([0, 0, -1], vsc(sideV, sp.tilt)));
  const near = !left;
  const J = { lat: near ? vsc(n, -1) : n, fwd: [1, 0, 0], up: [0, 1, 0] } as unknown as J3;
  const arm = { hand: sp.hand, palm: 'in', flex: sp.flex } as ArmP;
  const H0 = handFrame([0, 0, 0], vsc(d, -1), J, near, arm, HAND);
  let a0: V3;
  if (sp.anchor === 'grip') a0 = H0.grip;
  else if (sp.anchor === 'palm') a0 = H0.palm;
  else { const b = handBones(H0, arm); a0 = vsc(vadd(b.fingers[0][2], b.thumb[2]), 0.5); }
  const wr: V3 = [x - a0[0], -y - a0[1], -a0[2]];
  return { wr, el: vsub(wr, d), J, near, arm, d };
}

// ------------------------------------------------------------------ materials

/** the back and palm of the glove, in the hand's own frame (a along the hand, b across, c out of the palm) */
function gloveMat(wr: V3, d: V3, s: V3, n: V3) {
  return (h: Hit): C => {
    const r = vsub(h.p, wr), a = vdot(r, d) / HK, b = vdot(r, s) / HK, c = vdot(r, n) / HK;
    const l = h.l;
    let col = cel(GLOVE, l, 0.06, true);
    if (c < -0.05 && a > 0.7 && a < 1.8) {
      // the stitched points down the back of the hand: a sunk seam, its thread in long stitches
      for (const b0 of [-0.32, 0.32]) {
        const db = b - b0 * (0.7 + a * 0.2);
        if (Math.abs(db) < 0.045) return frac(a * 4.5) < 0.62 ? mix(THREAD, cel(GLOVE, l, 0), 0.45) : cel(GLOVE, l, -0.45);
        if (db > 0.045 && db < 0.1 && l > 0.1) return cel(GLOVE, l, 0.26);
      }
    }
    if (c > 0.15 && a > 0.5 && a < 1.9 && b > -0.75) {
      // the suede palm patch, box-stitched round its edge
      const edge = Math.min(a - 0.5, 1.9 - a, b + 0.75) < 0.07;
      if (edge) return frac((a + b) * 8) < 0.5 ? THREAD : cel(GLOVE, l, -0.45);
      col = cel(GLOVE, l, 0.16);
      if (hash(h.x >> 1, h.y >> 1) > 0.82) col = mix(col, GLOVE[2], 0.3); // the nap
      return col;
    }
    // knuckle pads catch the light
    if (c < 0 && a > 1.95 && a < 2.35 && l > 0.5) return GLOVE[5];
    if (hash(h.x, h.y) > 0.9) col = mix(col, GLOVE[2], 0.3); // the grain
    return col;
  };
}
/** fingers and thumb: side seams, joint creases with lit ridges, scuffed tips (h.t runs knuckle → tip) */
function fingerMat(h: Hit): C {
  const t = h.t, a = h.q[1], l = h.l;
  const side = Math.abs(Math.cos(a));
  if (side > 0.8 && side < 0.92 && frac(t * 7) < 0.55) return mix(THREAD, cel(GLOVE, l, 0), 0.3);
  if (side > 0.92) return cel(GLOVE, l, -0.2);
  // the crease over the middle joint, a lit ridge of leather beyond it
  const dt = t - 0.55;
  if (Math.abs(dt) < 0.028 && Math.abs(Math.cos(a)) < 0.7) return cel(GLOVE, l, -0.5);
  if (dt > 0.028 && dt < 0.07 && l > 0) return cel(GLOVE, l, 0.3);
  if (t < 0.12 && l > 0.5) return GLOVE[5];
  if (t > 0.9) return mix(cel(GLOVE, l, 0.05, true), GLOVE[4], 0.3);
  return hash(h.x, h.y) > 0.92 ? mix(cel(GLOVE, l, 0.06), GLOVE[2], 0.3) : cel(GLOVE, l, 0.06, true);
}
/** the glove's gauntlet: darker leather, a stitched top edge, a strap across with a press stud */
function cuffMat(h: Hit): C {
  const t = h.t, l = h.l, front = -Math.sin(h.q[1]);
  if (t < 0.12) return frac(h.q[1] * 4) < 0.5 ? THREAD : cel(CUFF, l, -0.3);
  if (t > 0.38 && t < 0.7) {
    if (t < 0.41 || t > 0.67) return cel(CUFF, l, -0.55);
    if (front > 0.8 && Math.abs(t - 0.54) < 0.09) return cel(BRASS, l, 0.25, true);
    return cel(CUFF, l, 0.18, true);
  }
  return cel(CUFF, l, 0.02, true);
}
/**
 * The canvas sleeve as a cylinder (q: [across in the picture plane, toward the viewer, along: -1 at the
 * edge of the set → 1 at the cuff], face 2 = the open end): `len` units long, the last `cuff` units
 * the turned cuff with a stitched row and a buttoned tab; the open end shows the dark inside round
 * the glove.
 */
function sleeveMat(len: number, cuff: number) {
  return (h: Hit): C => {
    const q = h.q, l = h.l;
    if (h.t === 2) return Math.hypot(q[0], q[1]) > 0.84 ? cel(SLEEVE, l, 0.1) : mix(SLEEVE[0], SLEEVE[1], Math.hypot(q[0], q[1]));
    const across = q[0], dist = (1 - q[2]) * 0.5 * len; // from the open end
    if (dist < cuff) {
      if (dist < 0.5 || Math.abs(dist - cuff) < 0.45) return cel(SLEEVE, l, -0.42);
      if (Math.abs(dist - cuff * 0.72) < 0.3 && frac(across * 6) < 0.5) return mix(CANVAS_THREAD, cel(SLEEVE, l, 0), 0.55);
      // the tab across the cuff, its horn button
      if (q[1] > 0.3 && Math.abs(across - 0.3) < 0.22) {
        if (Math.abs(dist - cuff * 0.42) < 0.9 && Math.abs(across - 0.3) < 0.12) return cel(HORN, l, 0.2, true);
        return Math.abs(across - 0.3) > 0.17 ? cel(SLEEVE, l, -0.45) : cel(SLEEVE, l, 0.24);
      }
      return cel(SLEEVE, l, 0.14);
    }
    // the inner seam along the far side, stitched beside it
    if (Math.abs(across + 0.7) < 0.04) return cel(SLEEVE, l, -0.5);
    if (Math.abs(across + 0.6) < 0.03 && frac(dist * 0.8) < 0.45) return mix(CANVAS_THREAD, cel(SLEEVE, l, 0), 0.65);
    // compression folds bunching toward the cuff: long shallow creases with a lit ridge on the cuff side,
    // and a long tension fold running up the arm
    for (const [d0, sk, w] of FOLDS) {
      if (Math.abs(across - w) > 0.78) continue;
      const dd = dist - cuff - (d0 + sk * across * 4);
      if (Math.abs(dd) < 0.32) return cel(SLEEVE, l, -0.48);
      if (dd < -0.32 && dd > -1.2 && l > -0.1) return cel(SLEEVE, l, 0.24);
    }
    if (dist > cuff + 9 && dist < cuff + 26 && Math.abs(across - 0.38 - (dist - cuff - 9) * 0.01) < 0.035) return cel(SLEEVE, l, -0.38);
    const c = cel(SLEEVE, l, 0.04);
    return (h.x + h.y * 2) % 5 === 0 ? mix(c, SLEEVE[1], 0.16) : c; // the twill
  };
}
/** sleeve folds: [distance up from the cuff, slant across, centre across (-1..1)] */
const FOLDS: [number, number, number][] = [[1.5, 0.12, 0], [4.1, -0.18, 0.12], [7.6, 0.22, -0.1], [12.5, -0.1, 0.2]];

// ------------------------------------------------------------------ drawing

/**
 * Rasterise a few parts into a scene over a unit rect (clipped to the buffer) and lay it on the
 * buffer, whose pixel (0, 0) sits at fine (bx, by).
 */
function render(px: PixelBuffer, box: [number, number, number, number], dark: number, paint: (s: Scene3D) => void, bx = 0, by = 0) {
  const x0 = Math.max(0, Math.floor(box[0] * Z) - bx), y0 = Math.max(0, Math.floor(box[1] * Z) - by);
  const x1 = Math.min(px.w, Math.ceil(box[2] * Z) - bx), y1 = Math.min(px.h, Math.ceil(box[3] * Z) - by);
  if (x1 - x0 < 2 || y1 - y0 < 2) return;
  // world: x right in units, y up (= -v), z toward the viewer; fine px = units * Z
  const s = new Scene3D(x1 - x0, y1 - y0, -(x0 + bx), -(y0 + by), Z);
  paint(s);
  const r = s.finish({ ink: INK, inkK: { 40: 0.62, 41: 0.62 }, rim: 0.55, depthLine: 2.6 });
  const W = s.w;
  for (const layer of [r.back, r.front]) {
    if (!layer) continue;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < W; i++) {
      let c = layer.data[j * W + i];
      if (!(c >>> 24)) continue;
      if (dark > 0) c = mix(c, DK, dark);
      px.data[(y0 + j) * px.w + x0 + i] = c;
    }
  }
}

/** the sleeve, cuff and glove gauntlet running in from `from` to the wrist (world units) */
function sleeveParts(s: Scene3D, from: V3, wr: V3, r: number) {
  const sd = vnorm(vsub(wr, from));
  // the sleeve sits a little behind the wrist, so the glove's gauntlet comes out of its open end
  const end = vadd(vsub(wr, vsc(sd, 1.2)), [0, 0, -r * 0.35]);
  const st = vadd(from, [0, 0, -r * 0.35]);
  const len = vlen(vsub(end, st)), ax = vnorm(vsub(end, st));
  // its frame: across in the picture plane, toward the viewer, along the arm (half lengths)
  const ac = vnorm([-ax[1], ax[0], 0]);
  let tw: V3 = vnorm([ac[1] * ax[2] - ac[2] * ax[1], ac[2] * ax[0] - ac[0] * ax[2], ac[0] * ax[1] - ac[1] * ax[0]]);
  if (tw[2] < 0) tw = vsc(tw, -1);
  s.solid('cyl', vsc(vadd(st, end), 0.5), vsc(ac, r), vsc(tw, r), vsc(ax, len / 2), 1, sleeveMat(len, 5.2));
  // the glove's gauntlet, flaring out of the cuff over the wrist
  s.limb(vsub(wr, vsc(sd, 3)), vadd(wr, vsc(sd, 0.9)), 0.66 * HK, 0.58 * HK, 3, cuffMat);
}

/** the jacket sleeve on its own, from (x0, y0) (off the edge of the set) to the wrist at (x1, y1), units */
export function drawSleeve(px: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r = 7) {
  if (!FIRST_PERSON_HANDS) return;
  const from: V3 = [x0, -y0, 6], wr: V3 = [x1, -y1, 0];
  render(px, [Math.min(x0, x1) - r - 2, Math.min(y0, y1) - r - 2, Math.max(x0, x1) + r + 2, Math.max(y0, y1) + r + 2], 0, s => sleeveParts(s, from, wr, r));
}

/**
 * Rendered hands, kept as sprites: a hand and its sleeve look the same wherever they are on the set,
 * so they're keyed by the pose and the sleeve's run from its edge to the anchor (in fine px) and
 * just laid down at the anchor (a hand that moves with its arm costs nothing after the first frame).
 */
const sprites = new Map<string, { b: PixelBuffer; ax: number; ay: number }>();

/** draw a gloved hand with its anchor at (x, y) units, the sleeve running in from o.from */
export function drawHand(px: PixelBuffer, p: Pose, x: number, y: number, o: HandOpts = {}) {
  if (!FIRST_PERSON_HANDS) return;
  const left = !!o.left, rot = o.rot ?? 0, r = o.r ?? 7, dark = o.dark ?? 0;
  // the anchor on the fine grid; the sleeve's start relative to it
  const fx = Math.round(x * Z), fy = Math.round(y * Z);
  const pl0 = place(p, 0, 0, rot, left);
  const f = o.from ?? [x + pl0.wr[0] + (left ? -18 : 18), px.h / Z + 30];
  const rx = Math.round(f[0] * Z) - fx, ry = Math.round(f[1] * Z) - fy;
  const key = `${p}|${rot}|${left ? 1 : 0}|${r}|${dark}|${Z}|${rx}|${ry}`;
  let sp = sprites.get(key);
  if (!sp) {
    // rendered with the anchor at the origin
    const wx = pl0.wr[0], wy = -pl0.wr[1], ux = rx / Z, uy = ry / Z;
    const from: V3 = [ux, -uy, 6];
    const reach = HK * 4.6;
    const x0 = Math.floor((Math.min(ux - r, wx - reach) - 2) * Z), y0 = Math.floor((Math.min(uy - r, wy - reach) - 2) * Z);
    const x1 = Math.ceil((Math.max(ux + r, wx + reach) + 2) * Z), y1 = Math.ceil((Math.max(uy + r, wy + reach) + 2) * Z);
    const b = new PixelBuffer(x1 - x0, y1 - y0);
    render(b, [x0 / Z, y0 / Z, x1 / Z, y1 / Z], dark, s => {
      sleeveParts(s, from, pl0.wr, r);
      const H = handFrame(pl0.wr, pl0.el, pl0.J, pl0.near, pl0.arm, HAND);
      drawHand7(s, pl0.wr, pl0.el, pl0.J, pl0.near, pl0.arm, HAND, 40, gloveMat(pl0.wr, H.d, H.s, H.n), fingerMat);
    }, x0, y0);
    sp = { b, ax: -x0, ay: -y0 };
    if (sprites.size > 24) sprites.delete(sprites.keys().next().value!);
    sprites.set(key, sp);
  }
  // lay it down at the anchor
  const { b, ax, ay } = sp, W = px.w, Hh = px.h;
  for (let j = 0; j < b.h; j++) {
    const Y = fy - ay + j;
    if (Y < 0 || Y >= Hh) continue;
    for (let i = 0; i < b.w; i++) {
      const c = b.data[j * b.w + i];
      if (!(c >>> 24)) continue;
      const X = fx - ax + i;
      if (X >= 0 && X < W) px.data[Y * W + X] = c;
    }
  }
}

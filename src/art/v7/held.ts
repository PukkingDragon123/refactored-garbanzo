// V7 held objects: the real things the cast carry, modelled in the same 3D scene as the body (boxes,
// flat-capped cylinders, ellipsoids and sweeps) so they sit in the hands the pose put there and
// overlap the arms and fingers correctly: the near hand's fingers wrap over a crate's side, the far
// hand disappears behind it, a plank on the far shoulder passes behind the head.
//
// Every drawer places its object from the hands' actual frames (hands.ts HandFrame: palm and grip
// centres, finger and thumb directions), so whatever the IK managed, the object is in the hands. Named
// points go back to the game (Frame7.pts): where water drips from cupped hands, a lantern's flame,
// where a carried pug sits.

import type { Pose } from '../people-rig';
import type { Char7, J3 } from './body';
import type { HandFrame } from './hands';
import { Scene3D, V3, Mat, Hit, cel, Ramp6, vadd, vsub, vsc, vnorm, vlen, vcross, vdot, vlerp } from './raster';
import { hex, C, mix } from '../color';

export type HeldDraw = (s: Scene3D, J: J3, P: Pose, ch: Char7, hN: HandFrame | null, hF: HandFrame | null, pts: Record<string, V3>) => void;
export const HELD7: Record<string, HeldDraw> = {};

export function drawHeld7(s: Scene3D, J: J3, P: Pose, ch: Char7, hN: HandFrame | null, hF: HandFrame | null, pts: Record<string, V3>) {
  const k = P.held?.kind;
  if (!k) return;
  const layer = s.layer;
  HELD7[k]?.(s, J, P, ch, hN, hF, pts);
  s.layer = layer;
}

// ------------------------------------------------------------------ materials

const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
export const HP = {
  timber: R6('#1e1208', '#4a3018', '#7a5530', '#a87c4a', '#c89c64', '#e4c088'),
  drift: R6('#1e1a16', '#4a443c', '#76705e', '#a29a84', '#c4bca6', '#e2dcc8'),
  bark: R6('#120a06', '#2c1a10', '#46301e', '#62462c', '#7c5c3a', '#987650'),
  grain: R6('#3a2410', '#7a5a34', '#a8844e', '#cca86c', '#e2c48a', '#f6e0b0'),
  stone: R6('#141416', '#34363c', '#55585e', '#7a7d82', '#9c9fa2', '#c4c6c8'),
  iron: R6('#050506', '#101114', '#1c1e22', '#2a2d33', '#3c4048', '#5c6470'),
  steel: R6('#1a1e22', '#3a4248', '#5e6a72', '#8a969e', '#b4c0c6', '#e6eef2'),
  crate: R6('#1c1006', '#462c14', '#6e4a24', '#946a38', '#b2884c', '#ccaa6c'),
  fishBack: R6('#081418', '#173038', '#2a5058', '#46767c', '#6e9ea0', '#a8d0cc'),
  fishBelly: R6('#3a3e40', '#80888a', '#b0b8b8', '#d8e0de', '#eef4f2', '#ffffff'),
  flax: R6('#081008', '#14260e', '#24401a', '#386028', '#52803a', '#7aa458'),
  rope: R6('#2a1e10', '#5a4424', '#846840', '#aa8c5c', '#c6a878', '#e0c89c'),
  brass: R6('#2a1a06', '#5a3a10', '#8a6220', '#b88a34', '#d8ac50', '#f6d888'),
  black: R6('#050506', '#0c0d10', '#16181c', '#212429', '#2e3238', '#40454d'),
  water: R6('#0a1c2c', '#1a4466', '#2a72a0', '#46a2cc', '#86d4ee', '#f0fcff'),
  pot: R6('#0a0b0d', '#1e2226', '#343a40', '#4e565e', '#707a84', '#a4aeb8'),
  stew: R6('#2a1006', '#5a2a10', '#8a4a1e', '#b0702e', '#cc9046', '#e8b468'),
  cloth: R6('#1e1a12', '#4a4232', '#746a52', '#9c9072', '#bcb090', '#dad0b2'),
  cowl: R6('#2a2c30', '#5e6268', '#9298a0', '#c4c8cc', '#e2e4e6', '#ffffff'),
  red: R6('#2a0606', '#5e0e0c', '#8e1c16', '#b82c22', '#d8483a', '#f07060'),
  shell: R6('#3a2a24', '#8a6a5a', '#c09a86', '#e8c8b2', '#f6e2d2', '#fff6ee'),
  fruit: R6('#2a0a04', '#6a1c08', '#a8360e', '#d8581c', '#f08432', '#ffc070'),
  leaf: R6('#0a1408', '#183018', '#284e24', '#3c6e30', '#56903e', '#80b45a'),
};
const plain = (r: Ramp6, bias = 0, shine = false): Mat => h => cel(r, h.l, bias, shine);
const GH = { obj: 50, obj2: 51, obj3: 52, water: 53 };
const frac = (v: number) => v - Math.floor(v);
const hash = (n: number) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/** a hand's palm centre, or the wrist when the hand isn't drawn */
const palmOf = (h: HandFrame | null, wr: V3) => h ? h.palm : wr;
const gripOf = (h: HandFrame | null, wr: V3) => h ? h.grip : wr;
const UP: V3 = [0, 1, 0];
const CAM: V3 = [0, 0, 1];
/** an orthonormal frame with x along `a`, y as close to `up` as allowed */
function frame(a: V3, up: V3 = UP): [V3, V3, V3] {
  const x = vnorm(a);
  let y = vsub(up, vsc(x, vdot(up, x)));
  if (vlen(y) < 1e-3) y = vsub(CAM, vsc(x, vdot(CAM, x)));
  y = vnorm(y);
  return [x, y, vcross(x, y)];
}
const add3 = (...v: V3[]): V3 => v.reduce((a, b) => vadd(a, b), [0, 0, 0] as V3);

// ------------------------------------------------------------------ wood

/** a sawn board: grain streaks along it, darker edges, end grain at the cut ends */
function boardMat(r: Ramp6, seed: number): Mat {
  return (h: Hit) => {
    const q = h.q, f = h.t;
    if (f === 0) return cel(HP.grain, h.l, Math.abs(q[1]) > 0.6 ? -0.25 : 0.05); // end grain
    const streak = hash(Math.floor((q[f === 1 ? 2 : 1] + 1) * 3.2) + seed) > 0.72 && frac(q[0] * 2.5 + seed) > 0.35;
    const edge = (f === 1 && Math.abs(q[2]) > 0.8) || (f === 2 && Math.abs(q[1]) > 0.75);
    return cel(r, h.l, edge ? -0.22 : streak ? -0.12 : 0.04);
  };
}
function board(s: Scene3D, c: V3, along: V3, up: V3, L: number, W: number, T: number, g: number, r: Ramp6, seed = 0) {
  const [x, y, z] = frame(along, up);
  // x: length, y: thickness, z: width
  s.solid('box', c, vsc(x, L / 2), vsc(y, T / 2), vsc(z, W / 2), g, boardMat(r, seed));
}

/** a round of wood: bark round the side, end grain rings on the cut ends */
const logMat = (seed: number): Mat => (h: Hit) => {
  const q = h.q;
  if (h.t === 2) {
    const rr = Math.hypot(q[0], q[1]);
    if (rr > 0.84) return cel(HP.bark, h.l, -0.1);
    return cel(HP.grain, h.l, frac(rr * 3.2 + seed) < 0.22 ? -0.32 : 0.06);
  }
  const ang = Math.atan2(q[1], q[0]);
  const ridge = frac(ang * 2.2 + hash(Math.floor(q[2] * 3 + 10) + seed) * 0.6) < 0.2;
  const knot = hash(Math.floor(ang * 3) * 7 + Math.floor(q[2] * 4) + seed) > 0.93;
  return cel(HP.bark, h.l, knot ? -0.35 : ridge ? -0.2 : 0.06);
};
function logRound(s: Scene3D, c: V3, axis: V3, r: number, half: number, g: number, seed = 0, ref: V3 = UP) {
  const [x, y, z] = frame(axis, ref);
  s.solid('cyl', c, vsc(y, r), vsc(z, r), vsc(x, half), g, logMat(seed));
}
/** a stick: a thin bark sweep with a pale broken end */
function stick(s: Scene3D, a: V3, b: V3, r: number, g: number, drift = false) {
  s.limb(a, b, r, r * 0.86, g, h => (h.t > 0.95 || h.t < 0.04 ? cel(HP.grain, h.l, 0.1) : cel(drift ? HP.drift : HP.bark, h.l, frac(h.t * 5.3) < 0.15 ? -0.2 : 0.05)));
}

// ------------------------------------------------------------------ the objects

/** across both forearms, against the chest: the midpoint of the palms, a little up and in */
function armful(J: J3, hN: HandFrame | null, hF: HandFrame | null, lift: number, into: number): V3 {
  const m = vlerp(palmOf(hN, J.wrN), palmOf(hF, J.wrF), 0.5);
  return add3(m, vsc(UP, lift), vsc(J.fwd, -into));
}

HELD7.crate = (s, J, P, _ch, hN, hF, pts) => {
  const v = P.held?.v ?? 1;
  const a = palmOf(hN, J.wrN), b = palmOf(hF, J.wrF);
  const wl = Math.max(5.5, Math.abs(vdot(vsub(a, b), J.lat)) - 1.2);
  const H = 8.2 * (0.9 + 0.1 * v), D = 8;
  const c = add3(vlerp(a, b, 0.5), vsc(UP, H * 0.28), vsc(J.fwd, 0.4));
  const [x, y, z] = [J.fwd, UP, J.lat];
  s.solid('box', c, vsc(x, D / 2), vsc(y, H / 2), vsc(z, wl / 2), GH.obj, h => {
    const q = h.q, f = h.t;
    // slats with dark gaps, a frame round each face, a stencilled mark on the near side
    const u = f === 1 ? q[0] : q[1], w = f === 2 ? q[0] : f === 1 ? q[2] : q[2];
    const rim = Math.abs(u) > 0.82 || Math.abs(w) > 0.84;
    if (rim) return cel(HP.crate, h.l, -0.06, true);
    if (f !== 1 && frac((u + 1) * 1.75) < 0.12) return cel(HP.crate, h.l, -0.42);
    if (f === 2 && q[2] > 0 && Math.abs(q[0]) < 0.3 && Math.abs(q[1] + 0.05) < 0.22 && Math.abs(q[0]) + Math.abs(q[1] + 0.05) > 0.18) return hex('#3a2414');
    return cel(HP.crate, h.l, 0.02 + hash(Math.floor((u + 1) * 1.75)) * 0.08);
  });
  pts.load = c;
};

HELD7.log = (s, J, P, _ch, hN, hF, pts) => {
  const r = 3.1 * (P.held?.v ?? 1);
  const c = armful(J, hN, hF, r * 0.95, 0.2);
  logRound(s, c, J.lat, r, 7.4, GH.obj, 3, J.fwd);
  pts.load = c;
};

HELD7.firewood = (s, J, P, _ch, hN, hF, pts) => {
  const n = Math.max(1, Math.min(6, Math.round(P.held?.v ?? 4)));
  const c = armful(J, hN, hF, 1.6, 0.4);
  // an armful of sticks across the forearms, stacked and splayed a little
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    const ctr = add3(c, vsc(UP, row * 1.8 + (col === 1 ? 0.4 : 0)), vsc(J.fwd, (col - 1) * 1.6 - row * 0.3));
    const ang = (hash(i + 3) - 0.5) * 0.5, half = 7 + hash(i + 9) * 2.6;
    const dir = vnorm(vadd(J.lat, vadd(vsc(J.fwd, ang * 0.6), vsc(UP, ang * 0.4))));
    stick(s, vsub(ctr, vsc(dir, half)), vadd(ctr, vsc(dir, half * (0.85 + hash(i) * 0.2))), 1 + hash(i + 5) * 0.25, GH.obj, i % 2 === 1);
  }
  pts.load = c;
};

HELD7.stone = (s, J, P, _ch, hN, hF, pts) => {
  const k = P.held?.v ?? 1;
  const c = add3(vlerp(palmOf(hN, J.wrN), palmOf(hF, J.wrF), 0.5), vsc(UP, 2.8 * k), vsc(J.fwd, -0.2));
  s.ellipsoid(c, vsc(J.fwd, 3.8 * k), vsc(UP, 3.3 * k), vsc(J.lat, 4.1 * k), GH.obj, h => {
    const n = hash(Math.floor(h.q[0] * 3) * 13 + Math.floor(h.q[1] * 3) * 7 + Math.floor(h.q[2] * 3));
    return cel(HP.stone, h.l, n > 0.82 ? -0.2 : n < 0.14 ? 0.15 : 0.02);
  });
  pts.load = c;
};

/** a cooking pot held by its two side handles (v: 0 empty .. 1 full of stew) */
HELD7.pot = (s, J, P, _ch, hN, hF, pts) => {
  const a = gripOf(hN, J.wrN), b = gripOf(hF, J.wrF);
  const m = vlerp(a, b, 0.5);
  const R = Math.max(3, Math.abs(vdot(vsub(a, b), J.lat)) / 2 - 1.1);
  const c = vsub(m, vsc(UP, 1.6));
  const potM = (h: Hit) => (h.t === 2 ? (h.q[2] > 0 ? (Math.hypot(h.q[0], h.q[1]) > 0.82 ? cel(HP.pot, h.l, 0.35) : cel(HP.pot, h.l, -0.35)) : cel(HP.pot, h.l)) : h.q[2] > 0.72 ? cel(HP.pot, h.l, 0.25, true) : h.q[2] < -0.75 ? cel(HP.pot, h.l, -0.3) : cel(HP.pot, h.l, 0.05, true));
  s.solid('cyl', c, vsc(J.fwd, R), vsc(J.lat, R), vsc(UP, 2.1), GH.obj, potM);
  // the two handles, sticking out sideways under the rim
  for (const sd of [-1, 1]) {
    const hc = add3(m, vsc(J.lat, sd * (R + 0.35)), vsc(UP, -0.1));
    s.limb(vadd(hc, vsc(J.fwd, -1.1)), vadd(hc, vsc(J.fwd, 1.1)), 0.5, 0.5, GH.obj, plain(HP.pot, 0.25, true));
  }
  // contents just showing over the rim
  if ((P.held?.v ?? 0) > 0.05) s.ellipsoid(vadd(c, vsc(UP, 2.05)), vsc(J.fwd, R * 0.9), vsc(UP, 0.4), vsc(J.lat, R * 0.9), GH.obj2, h => cel(HP.stew, h.l, 0.05));
  pts.load = c;
  pts.steam = vadd(c, vsc(UP, 2.8));
};

/** a frying pan by its long handle, in one hand */
HELD7.pan = (s, J, _P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const g = hN.grip, dir = vnorm(vadd(hN.s, vsc(hN.d, 0.25)));
  const end = vadd(g, vsc(dir, 3.6));
  s.limb(vsub(g, vsc(dir, 1.8)), end, 0.55, 0.45, GH.obj, plain(HP.black, 0.1));
  const c = add3(end, vsc(dir, 3.8), vsc(UP, -0.3));
  const [x, , z] = frame(dir, UP);
  s.solid('cyl', c, vsc(x, 3.9), vsc(z, 3.9), vsc(UP, 0.7), GH.obj, h => (h.t === 2 && h.q[2] > 0 ? (Math.hypot(h.q[0], h.q[1]) > 0.84 ? cel(HP.pot, h.l, 0.3) : cel(HP.pot, h.l, -0.3)) : cel(HP.pot, h.l, 0.1, true)));
  pts.load = c;
};

/** a bucket by its wire bail (v: water in it, 0..1), swinging from the hand (t phase) */
HELD7.bucket = (s, J, P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const g = hN.grip;
  const sw = Math.sin(Math.PI * 2 * (P.held?.t ?? 0) - 0.6) * 0.12;
  const hang = vnorm(vadd(vsc(UP, -1), vsc(J.fwd, sw)));
  const R = 2.5, Hh = 2.2;
  const top = vadd(g, vsc(hang, 3.4));
  const c = vadd(top, vsc(hang, Hh));
  const [ax, ay, az] = frame(vsc(hang, -1), J.fwd);
  void ax;
  // the bail: an arc from rim to rim through the fist
  const rimN = vadd(top, vsc(J.lat, R)), rimF = vadd(top, vsc(J.lat, -R));
  for (let i = 0; i < 8; i++) {
    const u0 = i / 8, u1 = (i + 1) / 8;
    const pt = (u: number) => vadd(vlerp(rimF, rimN, u), vsc(hang, -Math.sin(Math.PI * u) * 3.2));
    s.limb(pt(u0), pt(u1), 0.28, 0.28, GH.obj2, plain(HP.steel, 0.1));
  }
  s.solid('cyl', c, vsc(ay, R), vsc(az, R), vsc(hang, -Hh), GH.obj, h => {
    if (h.t === 2) return h.q[2] > 0 ? cel(HP.steel, h.l, 0.1) : (P.held?.v ?? 0) > 0.1 ? cel(HP.water, h.l, 0.2, true) : cel(HP.steel, h.l, -0.35);
    return Math.abs(h.q[2] + 0.55) < 0.12 || Math.abs(h.q[2] - 0.6) < 0.1 ? cel(HP.steel, h.l, -0.25) : cel(HP.steel, h.l, 0.05, true);
  });
  if ((P.held?.v ?? 0) > 0.1) s.ellipsoid(vadd(top, vsc(hang, 0.5)), vsc(J.fwd, R * 0.92), vsc(UP, 0.25), vsc(J.lat, R * 0.92), GH.water, h => cel(HP.water, h.l, 0.25, true));
  pts.load = c;
  pts.drip0 = vadd(top, vsc(J.fwd, R));
};

/** a fish held up by the gills, hanging head-up from the hooked fingers, tail swinging */
HELD7.fish = (s, J, P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const t = P.held?.t ?? 0;
  const g = vadd(hN.grip, vsc(hN.n, -0.6));
  const sw = Math.sin(Math.PI * 2 * t - 0.9) * 0.16;
  const down = vnorm(vadd(vsc(UP, -1), vsc(J.fwd, sw)));
  const L = 10.5 * (P.held?.v ?? 1);
  const head = vadd(g, vsc(down, 0.6)), mid = vadd(g, vsc(down, L * 0.45)), tail = vadd(g, vsc(down, L * 0.86));
  const side = J.lat;
  const fishM = (h: Hit) => {
    const belly = vdot(h.n, J.fwd) > 0.15 ? 1 : 0;
    if (h.l > 0.86) return HP.fishBelly[5];
    return belly ? cel(HP.fishBelly, h.l, 0.05) : cel(HP.fishBack, h.l, frac(h.p[1] * 0.7) < 0.2 ? -0.18 : 0.05, true);
  };
  const [, , ] = frame(down, J.fwd);
  s.ellipsoid(vlerp(head, mid, 0.55), vsc(down, L * 0.36), vsc(J.fwd, 1.75), vsc(side, 0.9), GH.obj, fishM);
  s.limb(mid, tail, 1.45, 0.45, GH.obj, fishM);
  // tail fin, flicking
  const fl = Math.sin(Math.PI * 4 * t) * 0.5;
  const fin = vadd(tail, vsc(down, 1.6));
  s.limb(tail, vadd(fin, vsc(J.fwd, 1.5 + fl)), 0.42, 0.25, GH.obj, plain(HP.fishBack, -0.05));
  s.limb(tail, vadd(fin, vsc(J.fwd, -1.5 + fl)), 0.42, 0.25, GH.obj, plain(HP.fishBack, -0.05));
  // the eye and the mouth at the fist
  s.dot(vadd(add3(head, vsc(down, 1.2), vsc(J.fwd, 0.55)), vsc(side, 0.8)), hex('#101418'), 1.6);
  pts.load = mid;
};

/** a bundle of harakeke (flax) leaves over the shoulder: long blades drooping at the tips, tied at the hand */
HELD7.flax = (s, J, P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const g = hN.grip;
  const n = Math.round(4 + 3 * (P.held?.v ?? 1));
  const back = vnorm(vadd(vsc(J.fwd, -0.85), vsc(UP, 0.55)));
  for (let i = 0; i < n; i++) {
    const o = (i / (n - 1) - 0.5);
    let p0 = add3(g, vsc(J.lat, o * 1.6), vsc(hN.d, -0.6));
    const L = 13 + hash(i + 1) * 5;
    const dir0 = vnorm(add3(back, vsc(J.lat, o * 0.5), vsc(UP, (hash(i + 7) - 0.5) * 0.3)));
    const segs = 5;
    for (let j = 0; j < segs; j++) {
      const droop = (j / segs) ** 2 * 1.4;
      const d = vnorm(vadd(dir0, vsc(UP, -droop)));
      const p1 = vadd(p0, vsc(d, L / segs));
      const w = 0.48 * (1 - (j / segs) * 0.6);
      s.limb(p0, p1, w, w * 0.85, GH.obj, h => cel(HP.flax, h.l, (i % 2 ? -0.08 : 0.05) + (h.l > 0.7 ? 0.1 : 0)));
      p0 = p1;
    }
    // the short stubs forward of the fist
    s.limb(g, add3(g, vsc(J.fwd, 1.6), vsc(UP, -0.6 + o)), 0.4, 0.3, GH.obj, plain(HP.flax, -0.1));
  }
  // a twist of fibre tying them
  s.limb(vadd(g, vsc(J.lat, -1.2)), vadd(g, vsc(J.lat, 1.2)), 0.5, 0.5, GH.obj2, plain(HP.rope, 0.1));
  pts.load = g;
};

/** a coil of rope over the near shoulder, hanging down the side of the arm */
HELD7.rope = (s, J, _P, ch, _hN, _hF, pts) => {
  const T = ch.build.torso;
  const top = J.T(T * 0.96, -0.2, ch.shW * 0.8);
  const c = vadd(top, vsc(UP, -5.2));
  const ax = vnorm(vadd(J.fwd, vsc(UP, 0.15)));
  const [x, y] = frame(J.lat, ax);
  void x;
  for (let turn = 0; turn < 3; turn++) {
    const o = vsc(J.lat, (turn - 1) * 0.8), R = 5.2 - turn * 0.3;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
      const pt = (a: number) => add3(c, o, vsc(UP, Math.cos(a) * R), vsc(y, Math.sin(a) * R * 0.8));
      s.limb(pt(a0), pt(a1), 0.72, 0.72, GH.obj, h => cel(HP.rope, h.l, frac(h.t * 2 + i * 0.5) < 0.3 ? -0.2 : 0.05));
    }
  }
  pts.load = c;
};

/** a storm lantern held out on its bail: glass glowing, swinging a little */
HELD7.lantern = (s, J, P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const t = P.held?.t ?? 0;
  const g = hN.grip;
  const sw = Math.sin(Math.PI * 2 * t - 0.8) * 0.14;
  const down = vnorm(vadd(vsc(UP, -1), vsc(J.fwd, sw)));
  const top = vadd(g, vsc(down, 1.8));
  const c = vadd(top, vsc(down, 3));
  const [, y, z] = frame(vsc(down, -1), J.fwd);
  // bail
  for (let i = 0; i < 6; i++) {
    const pt = (u: number) => vadd(vlerp(vadd(top, vsc(z, -1.7)), vadd(top, vsc(z, 1.7)), u), vsc(down, -Math.sin(Math.PI * u) * 1.8));
    s.limb(pt(i / 6), pt((i + 1) / 6), 0.25, 0.25, GH.obj2, plain(HP.black, 0.2));
  }
  // cap, glass with the flame, base
  s.solid('cyl', vadd(top, vsc(down, 0.4)), vsc(y, 1.8), vsc(z, 1.8), vsc(down, 0.55), GH.obj, plain(HP.red, 0.1, true));
  s.solid('cyl', c, vsc(y, 1.65), vsc(z, 1.65), vsc(down, 2.1), GH.obj, h => {
    if (h.t === 2) return cel(HP.brass, h.l);
    const fl = Math.abs(h.q[2]) < 0.45 && Math.hypot(h.q[0], h.q[1]) > 0 ? 1 : 0;
    return fl && Math.abs(Math.atan2(h.q[1], h.q[0])) < 2.6 ? hex(h.l > 0.3 ? '#fff4c0' : '#ffd270') : hex('#e8a040');
  });
  s.solid('cyl', vadd(c, vsc(down, 2.45)), vsc(y, 1.95), vsc(z, 1.95), vsc(down, 0.5), GH.obj, plain(HP.red, 0, true));
  // wire guards
  for (const a of [0.6, 2.2, 3.8]) s.limb(add3(c, vsc(y, Math.cos(a) * 1.85), vsc(z, Math.sin(a) * 1.85), vsc(down, -1.9)), add3(c, vsc(y, Math.cos(a) * 1.85), vsc(z, Math.sin(a) * 1.85), vsc(down, 1.9)), 0.22, 0.22, GH.obj2, plain(HP.black, 0.1));
  pts.glow = c;
};

/** the camera at the chest in both hands, strap round the neck */
HELD7.camera = (s, J, _P, _ch, hN, hF, pts) => {
  const a = palmOf(hN, J.wrN), b = palmOf(hF, J.wrF);
  const c = add3(vlerp(a, b, 0.5), vsc(UP, 0.9), vsc(J.fwd, 0.6));
  s.solid('box', c, vsc(J.fwd, 1.6), vsc(UP, 2.1), vsc(J.lat, 3), GH.obj, h => (h.t === 1 && h.q[1] > 0 ? cel(HP.black, h.l, 0.25) : cel(HP.black, h.l, 0.08, true)));
  const lc = vadd(c, vsc(J.fwd, 2.4));
  s.solid('cyl', lc, vsc(UP, 1.45), vsc(J.lat, 1.45), vsc(J.fwd, 1), GH.obj2, h => (h.t === 2 && h.q[2] > 0 ? (Math.hypot(h.q[0], h.q[1]) < 0.55 ? hex('#3a5878') : cel(HP.steel, h.l, -0.2)) : cel(HP.steel, h.l, -0.1, true)));
  // the strap up round the neck
  const nk = J.neckBase;
  for (const sd of [-1, 1]) s.limb(add3(c, vsc(J.lat, sd * 3), vsc(UP, 1.4)), add3(nk, vsc(J.lat, sd * 1.6), vsc(J.fwd, 0.6)), 0.32, 0.32, GH.obj3, plain(HP.black, 0.15));
  pts.load = c;
};

/** something small in the palm (a shell, a fruit) */
const inPalm = (r: Ramp6, size: number, shape: 'shell' | 'fruit'): HeldDraw => (s, J, _P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const c = vadd(hN.palm, vsc(hN.n, size * 0.85));
  if (shape === 'shell') {
    s.ellipsoid(c, vsc(hN.d, size * 1.15), vsc(hN.n, size * 0.6), vsc(hN.s, size), GH.obj, h => cel(r, h.l, frac(Math.atan2(h.q[2], h.q[0]) * 1.3) < 0.2 ? -0.25 : 0.06));
  } else {
    s.ellipsoid(c, vsc(hN.d, size), vsc(hN.n, size * 0.95), vsc(hN.s, size), GH.obj, plain(r, 0.05, true));
    s.limb(vadd(c, vsc(UP, size * 0.8)), vadd(c, vadd(vsc(UP, size * 1.4), vsc(J.fwd, 0.5))), 0.35, 0.25, GH.obj2, plain(HP.leaf));
  }
  pts.load = c;
};
HELD7.shell = inPalm(HP.shell, 1.7, 'shell');
HELD7.fruit = inPalm(HP.fruit, 1.8, 'fruit');

/** a cloth bundle slung over the near shoulder, held at its tied neck */
HELD7.bundle = (s, J, P, ch, hN, _hF, pts) => {
  const g = hN ? hN.grip : J.wrN;
  const k = P.held?.v ?? 1;
  const c = add3(J.T(ch.build.torso * 0.86, -ch.chest[0] - 2.2 * k, ch.shW * 0.55), vsc(UP, -0.6));
  s.ellipsoid(c, vsc(J.fwd, 2.8 * k), vsc(UP, 3.3 * k), vsc(J.lat, 3.0 * k), GH.obj, h => cel(HP.cloth, h.l, frac(h.q[1] * 3 + h.q[0]) < 0.12 ? -0.25 : 0.04));
  s.limb(g, vadd(c, vsc(UP, 2.4 * k)), 0.7, 0.9, GH.obj, plain(HP.cloth, -0.08));
  pts.load = c;
};

/** planks on the far shoulder, held at the front with the far hand (v: how many, 1..3) */
HELD7.plank = (s, J, P, ch, _hN, hF, pts) => {
  const n = Math.max(1, Math.min(3, Math.round(P.held?.v ?? 1)));
  const T = ch.build.torso;
  const sh = J.T(T - 0.4, -0.2, -ch.shW * 0.92);
  const g = hF ? hF.grip : J.wrF;
  // resting on the shoulder, sloping down through the hand in front (but mostly along the walk)
  const fw = vnorm(vsub(g, sh));
  const dir = vnorm(add3([1, 0, 0], vsc(fw, 0.35), vsc(UP, 0.12)));
  const c0 = vadd(sh, vsc(UP, 1.6));
  for (let i = 0; i < n; i++) {
    const c = add3(c0, vsc(UP, i * 1.6), vsc(dir, (i - 1) * 1.6 + 1.2), vsc(J.lat, -i * 0.15));
    board(s, c, dir, UP, 36 - i * 2, 4, 1.6, GH.obj + (i % 2), i % 2 ? HP.drift : HP.timber, i * 3);
  }
  pts.load = c0;
};
HELD7.planks = (s, J, P, ch, hN, hF, pts) => HELD7.plank(s, J, { ...P, held: { kind: 'plank', v: P.held?.v ?? 3, t: P.held?.t } }, ch, hN, hF, pts);

/** the outboard motor hugged to the chest: cowling, the long leg down past the knees, the prop */
HELD7.outboard = (s, J, _P, _ch, hN, hF, pts) => {
  const m = vlerp(palmOf(hN, J.wrN), palmOf(hF, J.wrF), 0.5);
  const c = add3(m, vsc(UP, 2.4), vsc(J.fwd, 0.8));
  s.ellipsoid(c, vsc(J.fwd, 4.3), vsc(UP, 4.6), vsc(J.lat, 3.9), GH.obj, h => (Math.abs(h.q[1] + 0.2) < 0.11 ? cel(HP.red, h.l, 0.1, true) : h.q[1] > 0.5 && h.q[0] < 0.1 ? cel(HP.cowl, h.l, -0.18) : cel(HP.cowl, h.l, 0.02, true)));
  // the pull-cord handle and the tiller
  s.limb(add3(c, vsc(J.fwd, 3.8), vsc(UP, 1.4)), add3(c, vsc(J.fwd, 5.2), vsc(UP, 1.7)), 0.55, 0.55, GH.obj2, plain(HP.black, 0.2));
  const legTop = add3(c, vsc(UP, -4), vsc(J.fwd, 1.4));
  const legBot = add3(legTop, vsc(UP, -13), vsc(J.fwd, 1.6));
  s.limb(legTop, legBot, 1.25, 1.05, GH.obj2, h => cel(HP.cowl, h.l, -0.12, true));
  s.ellipsoid(vadd(legBot, vsc(J.fwd, 0.4)), vsc(J.fwd, 2.4), vsc(UP, 1.1), vsc(J.lat, 1.1), GH.obj2, plain(HP.cowl, -0.1, true));
  // two-bladed prop at the back of the gearcase
  const hub = vadd(legBot, vsc(J.fwd, -1.8));
  s.limb(add3(hub, vsc(UP, 1.6), vsc(J.lat, 0.3)), add3(hub, vsc(UP, -1.6), vsc(J.lat, -0.3)), 0.6, 0.6, GH.obj3, plain(HP.black, 0.25, true));
  s.limb(vadd(legBot, vsc(J.fwd, 0.6)), add3(legBot, vsc(J.fwd, 0.6), vsc(UP, -1.6)), 0.5, 0.25, GH.obj2, plain(HP.cowl, -0.1));
  pts.load = c;
};

/** water in cupped hands (v: 0..1 how much is left), the surface catching the light, wet fingers */
HELD7.water = (s, J, P, _ch, hN, hF, pts) => {
  if (!hN || !hF) return;
  const lv = Math.max(0, Math.min(1, P.held?.v ?? 1));
  const m = vlerp(hN.palm, hF.palm, 0.5);
  const w = Math.max(1.6, Math.abs(vdot(vsub(hN.palm, hF.palm), J.lat)) * 0.5 + 0.8);
  // the bowl's floor is a little above the palms' centres; the surface rises with the level and
  // domes a touch over the rim so it reads from the side
  const floor = vadd(m, vsc(vadd(hN.n, hF.n), 0.25));
  if (lv > 0.02) {
    const h = 0.5 + lv * 1.5;
    const c = vadd(floor, vsc(UP, h * 0.38));
    s.ellipsoid(c, vsc(J.fwd, 1.8 + lv * 1.1), vsc(UP, h * 0.66), vsc(J.lat, w * (0.8 + lv * 0.3)), GH.water, hh => {
      // surface: a bright rim of light along the top, ripples, the body of the water deep blue
      if (hh.n[1] > 0.75) return hh.q[0] < -0.2 && hh.q[2] > -0.1 ? HP.water[5] : HP.water[4];
      return cel(HP.water, hh.l, hh.q[1] > 0.2 ? 0.2 : -0.05, true);
    });
    pts.cup = vadd(c, vsc(UP, h * 0.5));
  } else pts.cup = floor;
  // drips: between the little fingers where the hands meet, and off the fingertips
  pts.drip0 = vadd(m, vsc(UP, -1.0));
  pts.drip1 = vadd(hN.P(3.9, -0.3, 0.6), vsc(UP, -0.4));
  pts.drip2 = vadd(hF.P(3.9, -0.3, 0.6), vsc(UP, -0.4));
  pts.drip3 = vadd(hN.P(2.4, -0.9, 0.2), vsc(UP, -0.6));
};

/** a pug in the arms (the game draws the pug itself, between the body and the near arm: this marks the seat) */
HELD7.chunk = (_s, J, _P, _ch, hN, hF, pts) => {
  const a = palmOf(hN, J.wrN), b = palmOf(hF, J.wrF);
  pts.pup = vlerp(a, b, 0.35);
};

/** the stirring spoon (stir): a long wooden spoon from the near fist down into the pot */
HELD7.spoon = (s, _J, P, _ch, hN, _hF, pts) => {
  if (!hN) return;
  const g = hN.grip;
  const dir = vnorm(vadd(vsc(hN.d, 0.45), vadd(vsc(hN.n, 0.3), [0, -1, 0])));
  const tip = vadd(g, vsc(dir, 8));
  s.limb(vsub(g, vsc(dir, 1.6)), tip, 0.42, 0.42, GH.obj, plain(HP.timber, 0.05));
  s.ellipsoid(vadd(tip, vsc(dir, 0.8)), vsc(dir, 1.1), vsc(UP, 0.4), vsc([0, 0, 1], 0.8), GH.obj, plain(HP.timber, 0));
  pts.tip = tip;
  void P;
};

/** a hatchet in both fists (chop): the handle through the grips, the head beyond the near fist */
HELD7.axe = (s, _J, _P, _ch, hN, hF, pts) => {
  if (!hN) return;
  const a = hN.grip, b = hF ? hF.grip : vsub(hN.grip, vsc(hN.s, 3));
  const dir = vnorm(vsub(a, b));
  const end = vadd(a, vsc(dir, 3.2)), butt = vsub(b, vsc(dir, 1.2));
  s.limb(butt, end, 0.48, 0.52, GH.obj, plain(HP.timber, 0.05));
  const blade = vnorm(vcross(dir, [0, 0, 1]));
  const hd = vadd(end, vsc(dir, -0.6));
  s.solid('box', vadd(hd, vsc(blade, 1.2)), vsc(blade, 1.9), vsc(dir, 0.9), vsc([0, 0, 1], 0.4), GH.obj2, h => (h.q[0] > 0.6 ? cel(HP.steel, h.l, 0.35, true) : cel(HP.iron, h.l, 0.15, true)));
  pts.tip = vadd(hd, vsc(blade, 3));
};

/** cord and a stick being lashed in the lap (craft) */
HELD7.work = (s, _J, P, _ch, hN, hF, pts) => {
  if (!hN || !hF) return;
  const a = hN.grip, b = hF.grip;
  const m = vlerp(a, b, 0.5);
  stick(s, vadd(m, [-3.6, -0.6, 0.4]), vadd(m, [3.6, 0.4, 0.6]), 0.55, GH.obj);
  const tw = (P.held?.t ?? 0) * Math.PI * 2;
  for (let i = 0; i < 3; i++) s.limb(vadd(m, [-0.6 + i * 0.6, 0.8, 0.7]), vadd(m, [-0.4 + i * 0.6, -0.8, 0.9]), 0.32, 0.32, GH.obj2, plain(HP.flax, 0.15));
  s.limb(vadd(m, [0.6, 0, 0.8]), vadd(a, [0, Math.sin(tw) * 0.4, 0]), 0.28, 0.28, GH.obj2, plain(HP.flax, 0.2));
  pts.load = m;
};

/** the backpack coming off (v: 0 on the back → 1 on the ground in front, opened) */
HELD7.pack = (s, J, P, ch, hN, hF, pts) => {
  const u = Math.max(0, Math.min(1, P.held?.v ?? 0));
  const T = ch.build.torso;
  const onBack = J.T(T * 0.55, -(ch.chest[0] + 2.6), 0.8);
  const inHands = vadd(vlerp(palmOf(hN, J.wrN), palmOf(hF, J.wrF), 0.5), vsc(UP, -1.2));
  const ground = add3(J.T(0, 0, 0), vsc(J.fwd, 6.5), [0, -J.T(0, 0, 0)[1] + 3.2, 0]);
  // on the back → swung round under the near arm into the hands → set down in front
  const c = u < 0.55 ? vlerp(onBack, inHands, smooth01(u / 0.55)) : vlerp(inHands, ground, smooth01((u - 0.55) / 0.45));
  const tilt = u < 0.55 ? u / 0.55 : 1;
  const fw = vnorm(vadd(vsc(J.fwd, 1 - tilt), vsc(J.lat, tilt)));
  const [x, y, z] = frame(fw, UP);
  s.solid('box', c, vsc(x, 2.6), vsc(y, 4.4), vsc(z, 3.8), GH.obj, h => {
    if (h.q[1] > 0.6) return cel(HP.red, h.l, 0.05);
    if (Math.abs(h.q[1] - 0.2) < 0.08) return cel(HP.black, h.l, 0.1);
    return cel(HP.cloth, h.l, h.t === 0 && h.q[0] > 0 && Math.abs(h.q[2]) < 0.6 && h.q[1] < 0.2 && h.q[1] > -0.7 ? -0.15 : 0.02);
  });
  if (u > 0.95) s.ellipsoid(add3(c, vsc(y, 4.6), vsc(x, -0.5)), vsc(x, 2.2), vsc(y, 0.6), vsc(z, 3.2), GH.obj2, plain(HP.red, -0.2));
  pts.load = c;
};
const smooth01 = (u: number) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

// aliases the story might use
HELD7.wood = HELD7.firewood;
HELD7.sticks = HELD7.firewood;
HELD7.driftwood = HELD7.log;
HELD7.rock = HELD7.stone;
void mix; void (null as unknown as C);

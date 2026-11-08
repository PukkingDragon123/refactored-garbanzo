// V12 the weapon belt in Mori's hands (the V7 cast rig): the stances and the throw for each of Hank's
// weapons, and the weapons themselves modelled in 3D in his fists (held.ts HELD7), so they sit in the
// hands the pose put there and overlap the fingers properly. Each sets a named point 'muzzle' on the
// frame (Actor.point('muzzle')): where the shot leaves, where the spray comes out, the throwing hand.
//
//   armAim<W>       flare pistol / bear spray: the near arm out straight at shoulder height, the other
//                   hand cupping it; a breath of drift in the aim
//   armShoulder<W>  net launcher / dart rifle: shouldered, cheek down on the stock, the far hand out
//                   under the barrel
//   armReady<W>     bolas / bangers: held low and ready in the throwing hand (the stones hanging, the
//                   fuse spitting)
//   armWhirl<W>     the draw of a throw: the bolas whirled overhead, the bangers cocked back past the ear
//   armThrow<W>     the throw itself: step, whip over the top, follow through (one shot, ~0.4 s)
// (W = Flare, Spray, Net, Tranq, Bolas, Bangers; the belt picks the clip: src/game/v12/arsenal-belt.ts)

import type { Build, Pose, P2 } from '../people-rig';
import { lerpPose } from '../people-rig';
import { stand, neckAt } from '../anime/anims';
import { registerAnim7 } from '../v7/anims7';
import { HELD7 } from '../v7/held';
import type { HandFrame } from '../v7/hands';
import type { J3 } from '../v7/body';
import { cel, vadd, vsub, vsc, vnorm, vcross, vdot, vlen } from '../v7/raster';
import type { Scene3D, V3, Hit, Ramp6 } from '../v7/raster';
import { hex } from '../color';
import type { C } from '../color';

const TAU = Math.PI * 2;
const K = (b: Build) => b.torso / 15;
const add2 = (p: P2, x: number, y: number): P2 => [p[0] + x, p[1] + y];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const shoulder = (b: Build, hip: P2, lean: number): P2 => { const T = b.torso - b.shY; return [hip[0] + Math.sin(lean) * T, hip[1] + Math.cos(lean) * T]; };

// ------------------------------------------------------------------ the stances
function aimP(b: Build, t: number, kind: string): Pose {
  const k = K(b), br = Math.sin(TAU * t);
  const p = stand(b, { lean: 0.05, hip: [-0.4 * k, b.hipH - 0.9 * k + br * 0.1 * k] });
  p.fl = { f: [-2.6 * k, b.ankleH], fa: -0.06 };
  p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  const spray = kind === 'spray';
  // the near arm out straight; the far hand cups it (the pistol) or rides along (the spray)
  p.fa = { ik: add2(s, (spray ? 15 : 16.4) * k / 1.27, (spray ? -2.6 : -0.8) + br * 0.18), hand: 'grip' };
  p.ba = spray ? { ik: add2(s, 4.4 * k / 1.27, -11.6), hand: 'fist' } : { ik: add2(s, 14.6 * k / 1.27, -2.0 + br * 0.18), hand: 'grip' };
  p.hd = [0.4 * k, -0.15 * k];
  p.look = 'fwd';
  p.front = ['armF'];
  p.sway = 0.2;
  p.held = { kind: 'arm:' + kind, t };
  p.flags = { yaw: 0.5, zN: 1.0, zF: spray ? -0.6 : 0.5, hair: 0 };
  return p;
}
function shoulderP(b: Build, t: number, kind: string): Pose {
  const k = K(b), br = Math.sin(TAU * t);
  const p = stand(b, { lean: 0.1, hip: [-0.6 * k, b.hipH - 1.2 * k + br * 0.1 * k] });
  p.fl = { f: [-2.8 * k, b.ankleH], fa: -0.08 };
  p.bl = { f: [2.8 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  const net = kind === 'net';
  // the trigger hand at the chest, the far hand out under the barrel; cheek down on the stock
  p.fa = { ik: add2(s, 4.6 * k / 1.27, (net ? -4.0 : -3.0) + br * 0.12), hand: 'grip' };
  p.ba = { ik: add2(s, 13.6 * k / 1.27, (net ? -3.0 : -1.8) + br * 0.12), hand: 'grip' };
  p.hd = [0.7 * k, -0.6 * k];
  p.look = 'fwd';
  p.sway = 0.15;
  p.held = { kind: 'arm:' + kind, t };
  p.flags = { yaw: 0.5, zN: 1.4, zF: 0.4, hair: 0 };
  return p;
}
function readyP(b: Build, t: number, kind: string): Pose {
  const k = K(b), br = Math.sin(TAU * t);
  const p = stand(b, { lean: 0.08, hip: [-0.3 * k, b.hipH - 1.1 * k] });
  p.fl = { f: [-2.6 * k, b.ankleH], fa: -0.06 };
  p.bl = { f: [2.6 * k, b.ankleH], fa: 0 };
  const s = shoulder(b, p.hip, p.lean);
  // the throwing hand low and forward with the thing in it, the other arm up for balance
  p.fa = { ik: add2(s, 5.2 * k / 1.25, -7.4 + br * 0.3), hand: 'grip' };
  p.ba = { ik: add2(s, 6.4 * k / 1.25, -4.2), hand: 'fist' };
  p.hd = [0.35 * k, -0.25 * k];
  p.look = 'fwd';
  p.sway = 0.3;
  p.held = { kind: 'arm:' + kind, t };
  p.flags = { yaw: 0.8, zN: 1.8, zF: -0.6, hair: 0 };
  return p;
}
function whirlP(b: Build, t: number, kind: string): Pose {
  const k = K(b);
  const p = stand(b, { lean: -0.06, hip: [-1.4 * k, b.hipH - 1.4 * k] });
  p.fl = { f: [-3.2 * k, b.ankleH], fa: 0 };
  p.bl = { f: [2.4 * k, b.ankleH + 0.6 * k], fa: 0.1 };
  const n = neckAt(b, p.hip, p.lean), s = shoulder(b, p.hip, p.lean);
  if (kind === 'bolas') {
    // the hand up over the head, circling: the stones swing round it
    const a = TAU * t;
    p.fa = { ik: [n[0] + 2.2 + Math.cos(a) * 1.6, n[1] + 10.2 + Math.sin(a) * 1.0], hand: 'grip' };
    p.front = ['armF'];
  } else p.fa = { ik: [n[0] - 6.6, n[1] + 1.4], hand: 'grip', flip: true };
  p.ba = { ik: add2(s, 11.4 * k / 1.25, 0.4), hand: 'open' };
  p.hd = [0.2 * k, 0.1 * k];
  p.look = 'fwd';
  p.held = { kind: 'arm:' + kind + 'Up', t };
  p.flags = { yaw: 0.6, zN: 2.8, zF: 0.2, hair: 1 };
  return p;
}
function throwP(b: Build, t: number, kind: string): Pose {
  const k = K(b);
  const wind = whirlP(b, 0, kind === 'bolas' ? 'bolas' : 'bangers');
  const whip = (): Pose => {
    const p = stand(b, { lean: 0.3, hip: [1.4 * k, b.hipH - 2.0 * k] });
    p.fl = { f: [-3.8 * k, b.ankleH + 0.6 * k], fa: -0.5 };
    p.bl = { f: [5.0 * k, b.ankleH], fa: 0 };
    const n = neckAt(b, p.hip, p.lean), s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: [n[0] + 9.4, n[1] + 3.0], hand: 'open' };
    p.ba = { ik: add2(s, 2.2, -8.2), hand: 'grip' };
    p.front = ['armF'];
    p.hd = [0.6 * k, -0.4 * k];
    p.flags = { yaw: 1.1, zN: 1.6, zF: -1.2, hair: 2 };
    return p;
  };
  const follow = (): Pose => {
    const p = stand(b, { lean: 0.4, hip: [2.0 * k, b.hipH - 2.4 * k] });
    p.fl = { f: [-0.8 * k, b.ankleH + 2.6 * k], fa: -0.8 };
    p.bl = { f: [4.6 * k, b.ankleH], fa: 0 };
    const s = shoulder(b, p.hip, p.lean);
    p.fa = { ik: add2(s, 3.0, -11.8), hand: 'open' };
    p.ba = { ik: add2(s, -1.6, -8.6), hand: 'grip' };
    p.hd = [0.5 * k, 0.2 * k];
    p.flags = { yaw: 1.15, zN: -0.6, zF: -2.2, hair: 1 };
    return p;
  };
  const end = readyP(b, 0, kind);
  delete end.held;
  let p: Pose;
  if (t < 0.36) p = lerpPose(wind, whip(), smooth(t / 0.36));
  else if (t < 0.66) p = lerpPose(whip(), follow(), smooth((t - 0.36) / 0.3));
  else p = lerpPose(follow(), end, smooth((t - 0.66) / 0.34));
  if (t < 0.3) p.held = { kind: 'arm:' + kind + 'Up', t: 0.25 };
  else delete p.held;
  return p;
}

const W = (n: string) => n[0].toUpperCase() + n.slice(1);
for (const kind of ['flare', 'spray']) registerAnim7('armAim' + W(kind), { frames: 16, fps: 8, loop: true, talk: 'armAim' + W(kind) }, (b, t) => aimP(b, t, kind));
for (const kind of ['net', 'tranq']) registerAnim7('armShoulder' + W(kind), { frames: 16, fps: 8, loop: true, talk: 'armShoulder' + W(kind) }, (b, t) => shoulderP(b, t, kind));
for (const kind of ['bolas', 'bangers']) {
  registerAnim7('armReady' + W(kind), { frames: 16, fps: 8, loop: true, talk: 'armReady' + W(kind) }, (b, t) => readyP(b, t, kind));
  registerAnim7('armWhirl' + W(kind), { frames: 12, fps: 18, loop: true }, (b, t) => whirlP(b, t, kind));
  registerAnim7('armThrow' + W(kind), { frames: 12, fps: 26, loop: false }, (b, t) => throwP(b, t, kind));
}
/** the clip names for a weapon: [ready, draw, release] */
export function armClips(id: string): [string, string, string | null] {
  switch (id) {
    case 'flare': return ['armAimFlare', 'armAimFlare', null];
    case 'spray': return ['armAimSpray', 'armAimSpray', null];
    case 'net': return ['armShoulderNet', 'armShoulderNet', null];
    case 'tranq': return ['armShoulderTranq', 'armShoulderTranq', null];
    case 'bolas': return ['armReadyBolas', 'armWhirlBolas', 'armThrowBolas'];
    default: return ['armReadyBangers', 'armWhirlBangers', 'armThrowBangers'];
  }
}

// ------------------------------------------------------------------ the weapons in his hands
const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const ORANGE = R6('#4a1806', '#8a2e08', '#c44c10', '#f06a18', '#ff9a40', '#ffd8a0');
const BLACK = R6('#050506', '#0c0d10', '#16181c', '#24262c', '#363a42', '#5a606a');
const BLUED = R6('#06080c', '#10161e', '#1c2632', '#2c3c4e', '#465c72', '#8aa8c4');
const WALNUT = R6('#1a0c06', '#3a1a0a', '#5e2e12', '#844a22', '#a86a38', '#d09a60');
const OLIVE = R6('#14160a', '#262c12', '#3c4420', '#56622e', '#76843e', '#a8b468');
const STEEL = R6('#1a1e22', '#3a4248', '#5e6a72', '#8a969e', '#b4c0c6', '#e6eef2');
const CORD = R6('#2a1e0c', '#5a4418', '#86692a', '#b08e40', '#caa85a', '#e4c67c');
const STONE = R6('#2a2622', '#4e4840', '#766e62', '#9e9484', '#c4baa6', '#e8e0cc');
const RED = R6('#2a0404', '#5a0a08', '#94160e', '#cc2a1a', '#ee5a3a', '#ffb090');
const NETC = R6('#4a463a', '#76705a', '#a49c80', '#cac2a2', '#e4dcbc', '#fffae0');
const HIVIS = R6('#4a3a04', '#8a6e06', '#c8a40c', '#f0cc18', '#fae860', '#ffffd8');
const m = (r: Ramp6, bias = 0, shine = false) => (h: Hit) => cel(r, h.l, bias, shine);
const G = { gun: 54, gun2: 55, gun3: 56 };
const UP: V3 = [0, 1, 0];
/** an orthonormal frame: x along a, y as close to up as allowed, z = x cross y */
function frame(a: V3, up: V3 = UP): [V3, V3, V3] {
  const x = vnorm(a);
  let y = vsub(up, vsc(x, vdot(up, x)));
  if (vlen(y) < 1e-3) y = [0, 0, 1];
  y = vnorm(y);
  return [x, y, vcross(x, y)];
}
const P = (o: V3, X: V3, Y: V3, x: number, y: number): V3 => vadd(o, vadd(vsc(X, x), vsc(Y, y)));
/** where the near forearm points (the aim), and the near fist */
function aimOf(J: J3, hN: HandFrame | null): { g: V3; d: V3 } {
  const g = hN ? hN.grip : J.wrN;
  const d = vnorm(vsub(J.wrN, J.elN));
  // mostly the body's level forward (a bent wrist doesn't point the gun at the sky or the floor)
  return { g, d: vnorm(vadd(vsc(d, 0.2), vsc(level(J), 0.8))) };
}
type Pts = Record<string, V3>;
/** the body's forward, level */
const level = (J: J3): V3 => vnorm([J.fwd[0], 0, J.fwd[2]]);

HELD7['arm:flare'] = (s, J, _P, _ch, hN, _hF, pts) => {
  const { g, d } = aimOf(J, hN);
  const [X, Y] = frame(d);
  // the grip down through the fist, raked back; the fat barrel over it; the hammer; the muzzle ring
  s.limb(P(g, X, Y, -0.8, -1.8), P(g, X, Y, 0.3, 1.6), 0.95, 1.0, G.gun, m(ORANGE, 0.05));
  const b0 = P(g, X, Y, -1.8, 2.4), b1 = P(g, X, Y, 7.6, 2.4);
  s.limb(b0, b1, 1.55, 1.55, G.gun, h => (h.t > 0.92 ? cel(ORANGE, h.l, -0.4) : cel(ORANGE, h.l, 0.1, true)));
  s.limb(P(g, X, Y, -1.8, 3.2), P(g, X, Y, -2.8, 4.2), 0.45, 0.4, G.gun2, m(BLACK, 0.2));
  s.limb(P(g, X, Y, 1.0, 0.8), P(g, X, Y, 1.5, -0.6), 0.3, 0.3, G.gun2, m(BLACK));
  pts.muzzle = P(g, X, Y, 8.4, 2.4);
};
HELD7['arm:spray'] = (s, J, P0, _ch, hN, _hF, pts) => {
  const { g, d } = aimOf(J, hN);
  const [X, Y] = frame(d);
  // the can upright in the fist, the label band, the orange cap, the nozzle toward the aim
  const c0 = P(g, X, Y, 0.2, -2.6), c1 = P(g, X, Y, 0.2, 2.8);
  s.limb(c0, c1, 1.45, 1.45, G.gun, h => (h.t > 0.3 && h.t < 0.64 ? cel(HIVIS, h.l, 0.05) : cel(BLACK, h.l, 0.1, true)));
  s.ellipsoid(P(g, X, Y, 0.3, 3.6), vsc(X, 1.2), vsc(Y, 0.9), vsc(vcross(X, Y), 1.2), G.gun2, m(ORANGE, 0.1));
  s.limb(P(g, X, Y, 0.8, 3.7), P(g, X, Y, 2.4, 3.7), 0.3, 0.26, G.gun2, m(BLACK, 0.2));
  pts.muzzle = P(g, X, Y, 2.8, 3.7);
  void P0;
};
function longGun(s: Scene3D, J: J3, hN: HandFrame | null, hF: HandFrame | null, pts: Pts, net: boolean) {
  const a = hN ? hN.grip : J.wrN, b = hF ? hF.grip : J.wrF;
  const d = vnorm(vadd(vsc(vnorm(vsub(b, a)), 0.45), vsc(level(J), 0.55)));
  const [X, Y] = frame(d);
  if (net) {
    // the canister along both fists, the shoulder pad behind, the cup with the net bulging out of it
    s.limb(P(a, X, Y, -5.4, 1.8), P(b, X, Y, 4.6, 1.8), 2.2, 2.2, G.gun, h => (Math.abs(h.t - 0.3) < 0.03 || Math.abs(h.t - 0.62) < 0.03 ? cel(OLIVE, h.l, 0.3) : Math.abs(h.t - 0.8) < 0.04 ? cel(HIVIS, h.l, 0) : cel(OLIVE, h.l, 0.05)));
    s.ellipsoid(P(a, X, Y, -5.8, 1.6), vsc(X, 1.0), vsc(Y, 2.4), vsc(vcross(X, Y), 1.6), G.gun2, m(BLACK, 0.1));
    s.limb(P(b, X, Y, 4.6, 1.8), P(b, X, Y, 5.8, 1.8), 2.5, 2.7, G.gun2, m(STEEL, 0.1, true));
    s.ellipsoid(P(b, X, Y, 6.2, 1.8), vsc(X, 0.9), vsc(Y, 2.1), vsc(vcross(X, Y), 2.1), G.gun3, h => cel(NETC, h.l, (Math.floor(h.x) + Math.floor(h.y)) & 1 ? 0.15 : -0.2));
    s.limb(P(a, X, Y, 0.3, 0.6), P(a, X, Y, 0.1, -1.8), 0.7, 0.7, G.gun2, m(BLACK));
    pts.muzzle = P(b, X, Y, 7.0, 1.8);
    return;
  }
  // the dart rifle: walnut stock back to the shoulder, the blued receiver and the long thin barrel, the scope
  s.limb(P(a, X, Y, -6.6, -0.8), P(a, X, Y, 0.4, 1.0), 1.25, 0.95, G.gun, m(WALNUT, 0.05, true));
  s.limb(P(a, X, Y, 0.2, 1.0), P(a, X, Y, 3.6, 1.0), 0.95, 0.9, G.gun, m(BLUED, 0.1, true));
  s.limb(P(a, X, Y, 3.2, 1.0), P(b, X, Y, 10.4, 1.0), 0.5, 0.45, G.gun2, m(BLUED, 0.15, true));
  s.limb(P(a, X, Y, 1.4, 0.2), P(b, X, Y, 1.6, 0.3), 0.75, 0.65, G.gun, m(WALNUT, 0.1));
  s.limb(P(a, X, Y, 0.4, 2.4), P(a, X, Y, 4.6, 2.4), 0.7, 0.7, G.gun3, h => (h.t > 0.92 ? hex('#7ac8f0') : cel(BLUED, h.l, 0.15, true)));
  s.limb(P(a, X, Y, 1.8, 1.4), P(a, X, Y, 1.6, -0.6), 0.22, 0.22, G.gun3, m(STEEL, 0.3, true));
  pts.muzzle = P(b, X, Y, 10.8, 1.0);
}
HELD7['arm:net'] = (s, J, _P, _ch, hN, hF, pts) => longGun(s, J, hN, hF, pts, true);
HELD7['arm:tranq'] = (s, J, _P, _ch, hN, hF, pts) => longGun(s, J, hN, hF, pts, false);

/** three stones in leather netting on cords from a knot: hanging (ready) or swung round (up) */
function bolas(s: Scene3D, J: J3, hN: HandFrame | null, pts: Pts, up: boolean, t: number) {
  const g = hN ? hN.grip : J.wrN;
  const knot = vadd(g, up ? [0, 1.2, 0] : [0, -1.4, 0]);
  // whirled overhead it is in front of everything
  if (up) s.layer = 1;
  s.ellipsoid(knot, [0.6, 0, 0], [0, 0.6, 0], [0, 0, 0.6], G.gun, m(CORD, 0.1));
  for (let i = 0; i < 3; i++) {
    let st: V3;
    if (up) {
      // whirling in a tilted circle over his head
      const a = TAU * t * 2 + (i * TAU) / 3;
      st = vadd(knot, [Math.cos(a) * (5.4 - i * 0.6), 1.2 + Math.sin(a) * 1.6, Math.sin(a) * 4.2]);
    } else st = vadd(knot, [(i - 1) * 1.2 + Math.sin(TAU * t + i) * 0.3, -3.6 - i * 0.9, (i - 1) * 0.6]);
    s.limb(knot, st, 0.22, 0.22, G.gun, m(CORD, 0.15));
    s.ellipsoid(st, [1.15, 0, 0], [0, 1.05, 0], [0, 0, 1.15], G.gun2, h => ((Math.floor(h.x + h.y) & 1) && h.l < 0.6 ? cel(CORD, h.l, -0.3) : cel(STONE, h.l, 0.05, true)));
  }
  pts.muzzle = knot;
}
HELD7['arm:bolas'] = (s, J, P0, _ch, hN, _hF, pts) => bolas(s, J, hN, pts, false, P0.held?.t ?? 0);
HELD7['arm:bolasUp'] = (s, J, P0, _ch, hN, _hF, pts) => bolas(s, J, hN, pts, true, P0.held?.t ?? 0);
/** a braid of fat red crackers hanging from the fist, the fuse spitting at the top */
function bangers(s: Scene3D, J: J3, hN: HandFrame | null, pts: Pts, up: boolean) {
  const g = hN ? hN.grip : J.wrN;
  const dn: V3 = up ? vnorm([-0.6, -1, 0.2]) : [0.1, -1, 0];
  for (let i = 0; i < 4; i++) {
    const c = vadd(g, vsc(dn, 1.4 + i * 1.3));
    const sd: V3 = i % 2 ? [0.9, 0.1, 0.3] : [-0.9, 0.1, -0.3];
    s.limb(vadd(c, vsc(sd, 0.2)), vadd(c, vsc(sd, 1.9)), 0.5, 0.5, G.gun, h => (Math.abs(h.t - 0.5) < 0.12 ? cel(HIVIS, h.l, 0.1) : cel(RED, h.l, 0.1, true)));
  }
  s.limb(g, vadd(g, vsc(dn, 6.2)), 0.2, 0.2, G.gun2, m(CORD));
  const fuse = vadd(g, [0.4, 1.4, 0.2]);
  s.limb(g, fuse, 0.18, 0.18, G.gun2, m(CORD, 0.2));
  pts.muzzle = g;
  pts.fuse = fuse;
}
HELD7['arm:bangers'] = (s, J, _P, _ch, hN, _hF, pts) => bangers(s, J, hN, pts, false);
HELD7['arm:bangersUp'] = (s, J, _P, _ch, hN, _hF, pts) => bangers(s, J, hN, pts, true);

void (0 as unknown as C);

// debug: zlArmSheet('mori', ['armWhirlBolas', 'armAimFlare']) lays frames of the clips over the page
try {
  (window as unknown as { zlArmSheet?: unknown }).zlArmSheet = async (id = 'mori', anims: string[] = ['armAimFlare', 'armAimSpray', 'armShoulderNet', 'armShoulderTranq', 'armReadyBolas', 'armWhirlBolas', 'armThrowBolas', 'armReadyBangers', 'armWhirlBangers', 'armThrowBangers'], scale = 3) => {
    const { composite } = await import('../../debug/arohagallery');
    const { ANIMS7 } = await import('../v7/anims7');
    const cells: HTMLCanvasElement[] = [];
    for (const a of anims) { const n = ANIMS7[a]?.frames ?? 1; for (let f = 0; f < n; f += Math.max(1, Math.floor(n / 4))) cells.push(composite(id, a, f).toCanvas(1)); }
    const cw = 80, ch = 98, cols = 8;
    const cv = document.createElement('canvas');
    cv.width = cw * cols; cv.height = ch * Math.ceil(cells.length / cols);
    const g = cv.getContext('2d')!;
    g.fillStyle = '#6d7f86'; g.fillRect(0, 0, cv.width, cv.height);
    cells.forEach((c, i) => g.drawImage(c, 92, 100, cw, ch, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch));
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99;image-rendering:pixelated;width:' + cv.width * scale + 'px;height:' + cv.height * scale + 'px';
    document.body.appendChild(cv);
    return cells.length;
  };
} catch { /* */ }

// V12 village life clips for the V7 cast (registered into the pose library with the V11 village
// clips), and Aunty Hana's old steel-string guitar drawn in the hands (src/art/v7/held.ts registry):
//   guitarSit  sitting by the fire with the guitar across the near thigh: the near hand strums over the
//              sound hole (down on the beat, up on the off-beat), the far hand walks chord shapes on the
//              neck, the head nods
//   sing       sitting, singing along: the head tipped back a little, a hand on the heart, a slow sway
//   clapSit    sitting, clapping in time
//   scatter    standing, a bowl of grain on the far hip, the near hand flinging grain for the hens
//   hangWash   up on the toes, both hands up at the line, pegging out a shirt
//   kite       standing, looking up, the near hand high on the kite line, a tug now and then
//   doze       sitting, chin dropping onto the chest, slow breathing (Koro by the embers)

import type { Build, Pose } from '../../people-rig';
import { stand, sitP } from '../../anime/anims';
import { registerAnim7, shoulder, add2, pulse, K } from '../../v7/anims7';
import { HELD7 } from '../../v7/held';
import { cel, vadd, vsub, vsc, vnorm, vcross } from '../../v7/raster';
import type { Ramp6, V3, Hit } from '../../v7/raster';
import { hex } from '../../color';
import { registerVillageAnims } from './anims';

const TAU = Math.PI * 2;
const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const SPRUCE = R6('#3a2410', '#6a4418', '#a06a28', '#c8903c', '#e2b25a', '#f6d68a');
const BURST = R6('#1a0c06', '#3a1c0c', '#5e3214', '#84501e', '#a8702c', '#c8903c');
const MAHOG = R6('#120604', '#2a0e06', '#48200e', '#663218', '#844626', '#a45e36');
const ROSE = R6('#0a0404', '#1a0c08', '#2c1810', '#3e2418', '#523222', '#68402c');
const PAUA = [hex('#1a4a5a'), hex('#2a8a8a'), hex('#5ac0b0'), hex('#7a6ab8'), hex('#3a6ac8')];
const HOLE = hex('#0a0604'), TUNER = hex('#e8e0c8'), STRING = hex('#d8d0b8'), BONE = hex('#f0e6c8');

// ------------------------------------------------------------------ poses
function guitarSit(b: Build, t: number): Pose {
  const k = K(b), u = t * 4, nod = pulse(u);
  const p = sitP(b);
  p.lean = 0.07 + 0.02 * Math.sin(TAU * t);
  p.hd = [0.35 * k * nod, -0.55 * k * nod - 0.25 * k];
  const s = shoulder(b, p.hip, p.lean);
  // the strumming hand: down through the strings on the beat, back up on the off-beat
  const st = Math.sin(TAU * u);
  p.fa = { ik: add2(s, 3.4 * k, -(b.upArm + b.foreArm) * 0.56 + st * 1.1 * k), hand: 'pinch', palm: 'in', flex: -0.15 * st };
  // the chord hand on the neck: a new shape every half loop, a little lift between
  const ch = Math.floor(t * 2) % 2, lift = Math.max(0, 1 - Math.abs(((t * 2) % 1) - 0.0) * 12);
  p.ba = { ik: add2(s, (9.2 + ch * 1.3) * k, -(b.upArm + b.foreArm) * 0.16 + ch * 0.5 * k + lift * 0.4 * k), hand: 'grip', palm: 'up' };
  p.front = ['armF'];
  p.flags = { zN: 2.4 * k, zF: -1.3 * k, aoF: 0.8 };
  p.held = { kind: 'guitar', t };
  p.sway = 0.25 + 0.25 * nod;
  p.bounce = -nod * 0.15;
  return p;
}

function sing(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = sitP(b);
  p.lean = -0.03 + 0.04 * Math.sin(w);
  p.hd = [0.5 * k * Math.sin(w), 0.35 * k + 0.25 * k * Math.sin(w * 2)];
  const s = shoulder(b, p.hip, p.lean);
  // a hand on the heart; the other lifts with the long notes
  p.fa = { ik: add2(s, 1.7 * k, -2.4 * k), hand: 'flat', palm: 'in' };
  const up = Math.max(0, Math.sin(w));
  p.ba = { ik: add2(s, 4.6 * k + up * 1.4 * k, -4.2 * k + up * 3.2 * k), hand: up > 0.5 ? 'open' : 'relax', palm: 'out' };
  p.front = ['armF'];
  p.flags = { zN: 1.4 * k, zF: -0.8 * k };
  p.sway = 0.6 * Math.sin(w);
  p.look = 'up';
  return p;
}

function clapSit(b: Build, t: number): Pose {
  const k = K(b), u = t * 4;
  const p = sitP(b);
  const open = 1 - pulse(u);
  p.lean = 0.05;
  p.hd = [0.2 * k, -0.3 * k * (1 - open)];
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, 4.4 * k - open * 0.9 * k, -3.0 * k + open * 0.4 * k), hand: 'flat', palm: 'out' };
  p.ba = { ik: add2(s, 4.6 * k + open * 1.1 * k, -2.8 * k + open * 0.5 * k), hand: 'flat', palm: 'in' };
  p.front = ['armF'];
  p.flags = { zN: 1.2 * k, zF: 0.2 * k };
  p.bounce = -open * 0.2;
  return p;
}

function scatter(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = stand(b);
  p.lean = 0.1;
  p.look = 'down';
  const s = shoulder(b, p.hip, p.lean);
  // the bowl on the far hip, the near hand dips in and flings out wide
  p.ba = { ik: add2(s, 3.2 * k, -(b.upArm + b.foreArm) * 0.55), hand: 'cup', palm: 'up' };
  const sw = Math.max(0, Math.sin(w));
  p.fa = { ik: add2(s, 3.4 * k + sw * 4.4 * k, -(b.upArm + b.foreArm) * 0.5 + sw * 2.0 * k), hand: sw > 0.55 ? 'open' : 'pinch', palm: sw > 0.55 ? 'down' : 'in' };
  p.front = ['armF'];
  p.flags = { zN: 1.4 * k, zF: -0.6 * k };
  p.hd = [0.3 * k * sw, -0.2 * k];
  return p;
}

function hangWash(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = stand(b);
  const toe = 0.5 + 0.5 * Math.sin(w);
  p.hip = [0, b.hipH + toe * 0.6 * k];
  p.lean = -0.04;
  p.look = 'up';
  const s = shoulder(b, p.hip, p.lean);
  const reach = (b.upArm + b.foreArm) * 0.9;
  p.fa = { ik: add2(s, 2.6 * k + Math.sin(w * 2) * 0.6 * k, reach * 0.9), hand: 'pinch', palm: 'fwd' };
  p.ba = { ik: add2(s, 4.2 * k, reach * 0.82 - toe * 0.4 * k), hand: 'pinch', palm: 'fwd' };
  p.front = ['armF'];
  p.flags = { zN: 1.0 * k, zF: -0.6 * k };
  p.fl = { f: [1.4 * k, b.ankleH + toe * 0.5 * k], fa: -0.5 * toe };
  p.bl = { f: [-1.2 * k, b.ankleH + toe * 0.5 * k], fa: -0.5 * toe };
  return p;
}

function kite(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = stand(b);
  const tug = Math.max(0, Math.sin(w * 2)) ** 3;
  p.lean = -0.06 - tug * 0.05;
  p.look = 'up';
  p.hd = [0.2 * k, 0.4 * k];
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, 4.0 * k - tug * 1.2 * k, 4.2 * k - tug * 0.8 * k), hand: 'fist', palm: 'in' };
  p.ba = { ik: add2(s, 2.8 * k, -1.2 * k), hand: 'fist', palm: 'in' };
  p.front = ['armF'];
  p.flags = { zN: 1.2 * k, zF: -0.4 * k };
  p.fl = { f: [2.0 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-2.0 * k, b.ankleH], fa: 0 };
  return p;
}

function doze(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = sitP(b);
  const br = 0.5 + 0.5 * Math.sin(w);
  p.lean = 0.12 + br * 0.03;
  p.hd = [0.9 * k, -1.5 * k - br * 0.3 * k];
  p.look = 'down';
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, 3.0 * k, -(b.upArm + b.foreArm) * 0.7), hand: 'relax', palm: 'in' };
  p.ba = { ik: add2(s, 3.4 * k, -(b.upArm + b.foreArm) * 0.72), hand: 'relax', palm: 'in' };
  p.front = ['armF'];
  p.flags = { zN: 1.0 * k, zF: -0.4 * k };
  return p;
}

// ------------------------------------------------------------------ the guitar in the hands
type HeldFn = NonNullable<typeof HELD7.pot>;
const along = (a: V3, b: V3): V3 => vnorm(vsub(b, a));
function drawGuitar(s: Parameters<HeldFn>[0], J: Parameters<HeldFn>[1], hN: Parameters<HeldFn>[4], hF: Parameters<HeldFn>[5], pts: Record<string, V3>) {
  const pn = hN ? hN.palm : J.wrN, pf = hF ? hF.grip : J.wrF;
  const UP: V3 = [0, 1, 0];
  // the sound hole sits just under the strumming hand; the body runs back over the thigh, the neck out to the chord hand
  const hole = vadd(vadd(pn, vsc(J.fwd, -0.4)), vsc(UP, -0.5));
  const dir = along(hole, pf);
  const face = vnorm(vadd(vsc(J.lat, 0.85), vsc(J.fwd, 0.3)));
  const side = vnorm(vcross(dir, face));
  const lower = vadd(hole, vsc(dir, -4.3)), upper = vadd(hole, vsc(dir, 0.8));
  // a tobacco burst: dark at the rim, golden spruce in the middle, the grain running along the body
  const top = (c: V3, r: number) => (h: Hit) => {
    const d = Math.hypot(vdot(vsub(h.p, c), dir) / r, vdot(vsub(h.p, c), side) / (r * 1.05));
    const grain = Math.sin(vdot(h.p, side) * 9) > 0.86 ? -0.12 : 0.05;
    return d > 0.8 ? cel(BURST, h.l, grain, true) : cel(SPRUCE, h.l, grain, true);
  };
  const back = (h: Hit) => cel(MAHOG, h.l, 0.04);
  s.ellipsoid(lower, vsc(dir, 4.6), vsc(side, 4.8), vsc(face, 1.7), 50, back);
  s.ellipsoid(upper, vsc(dir, 3.4), vsc(side, 3.8), vsc(face, 1.6), 50, back);
  s.ellipsoid(vadd(lower, vsc(face, 0.55)), vsc(dir, 4.4), vsc(side, 4.6), vsc(face, 1.4), 51, top(lower, 4.4));
  s.ellipsoid(vadd(upper, vsc(face, 0.55)), vsc(dir, 3.2), vsc(side, 3.6), vsc(face, 1.3), 51, top(upper, 3.2));
  // the sound hole and its pāua rosette
  s.ellipsoid(vadd(hole, vsc(face, 1.78)), vsc(dir, 1.55), vsc(side, 1.55), vsc(face, 0.2), 52, h => PAUA[Math.abs(Math.floor(h.q[0] * 7 + h.q[1] * 5)) % PAUA.length]);
  s.ellipsoid(vadd(hole, vsc(face, 1.9)), vsc(dir, 1.15), vsc(side, 1.15), vsc(face, 0.2), 53, () => HOLE);
  // the bridge, a bone saddle
  const br = vadd(lower, vsc(dir, -1.4));
  s.ellipsoid(vadd(br, vsc(face, 1.78)), vsc(dir, 0.55), vsc(side, 2.1), vsc(face, 0.3), 52, h => cel(ROSE, h.l, 0));
  s.limb(vadd(vadd(br, vsc(face, 2.0)), vsc(side, -1.4)), vadd(vadd(br, vsc(face, 2.0)), vsc(side, 1.4)), 0.12, 0.12, 53, () => BONE);
  // the neck, the rosewood board, the headstock and its six tuners
  const nb = vadd(upper, vsc(dir, 2.8)), ne = vadd(pf, vsc(dir, 2.4));
  s.limb(nb, ne, 0.78, 0.62, 50, h => cel(MAHOG, h.l, 0.1));
  s.limb(vadd(nb, vsc(face, 0.5)), vadd(ne, vsc(face, 0.45)), 0.6, 0.5, 51, h => cel(ROSE, h.l, 0.05));
  const hd = vadd(ne, vsc(dir, 1.7));
  s.ellipsoid(hd, vsc(dir, 1.9), vsc(side, 0.95), vsc(face, 0.35), 50, h => cel(ROSE, h.l, 0.1));
  for (const kk of [-0.9, 0, 0.9]) for (const sd of [-1, 1]) s.dot(vadd(vadd(hd, vsc(dir, kk)), vsc(side, sd * 1.1)), TUNER, 1);
  for (const o of [-0.5, -0.17, 0.17, 0.5]) s.limb(vadd(vadd(br, vsc(face, 2.05)), vsc(side, o)), vadd(vadd(ne, vsc(face, 0.95)), vsc(side, o * 0.6)), 0.09, 0.09, 54, () => STRING);
  pts.sound = vadd(hole, vsc(face, 2));
}
const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

let done = false;
export function registerLifeAnims() {
  if (done) return;
  done = true;
  registerVillageAnims();
  registerAnim7('guitarSit', { frames: 16, fps: 8, loop: true }, (b, t) => guitarSit(b, t));
  registerAnim7('sing', { frames: 12, fps: 4, loop: true }, (b, t) => sing(b, t));
  registerAnim7('clapSit', { frames: 8, fps: 8, loop: true }, (b, t) => clapSit(b, t));
  registerAnim7('scatter', { frames: 12, fps: 6, loop: true }, (b, t) => scatter(b, t));
  registerAnim7('hangWash', { frames: 12, fps: 4, loop: true }, (b, t) => hangWash(b, t));
  registerAnim7('kite', { frames: 12, fps: 5, loop: true }, (b, t) => kite(b, t));
  registerAnim7('doze', { frames: 8, fps: 2, loop: true }, (b, t) => doze(b, t));
  HELD7.guitar = (s, J, _P, _ch, hN, hF, pts) => drawGuitar(s, J, hN, hF, pts);
}

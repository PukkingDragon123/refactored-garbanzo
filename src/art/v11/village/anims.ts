// V11 village clips for the V7 cast (registered into the pose library on first use), and the hue
// kiri drawn in the hands (src/art/v7/held.ts registry):
//   strum / strumSit  playing the hue kiri, standing or sitting on a bench: the near hand plucks over
//                     the serpent-skin face, the far hand walks up and down the neck, the head nods
//   snakeDance        the serpent dance: low on bent knees, the body rippling up from the hips, both
//                     arms held forward and undulating like a serpent's body, slow steps side to side
//   storyTell         sitting, telling a story with the whole body: the hands shape the river, the
//                     serpent coiling, the mountain
//   offer             kneeling, both hands held out low in front (laying something down at the water)
//   bless             standing, one hand raised, palm out, the other at the side; a slow nod

import type { Build, Pose, P2 } from '../../people-rig';
import { stand, sitP } from '../../anime/anims';
import { registerAnim7, shoulder, add2, pulse, K } from '../../v7/anims7';
import { HELD7, HP } from '../../v7/held';
import { cel, vadd, vsub, vsc, vnorm, vlerp, vcross } from '../../v7/raster';
import type { Ramp6, V3, Hit } from '../../v7/raster';
import { hex } from '../../color';

const TAU = Math.PI * 2;
const R6 = (...h: string[]): Ramp6 => h.map(v => hex(v));
const GOURD = R6('#1c0c04', '#4a2610', '#7a4418', '#a8682a', '#c88c40', '#e4b060');
const SKIN = R6('#3a3426', '#6a644e', '#9c9474', '#c8c0a0', '#e4dcbe', '#f8f2dc');
const NECK = R6('#0e0604', '#24140c', '#3c2416', '#583822', '#744e30', '#906844');

function strumPose(b: Build, t: number, sit: boolean): Pose {
  const k = K(b), u = t * 4, nod = pulse(u);
  const p = sit ? sitP(b) : stand(b);
  if (!sit) {
    p.hip = [0.25 * k * Math.sin(TAU * t * 2), b.hipH - 0.3 - nod * 0.35 * k];
    p.fl = { f: [2.0 * k, b.ankleH + Math.max(0, -Math.cos(TAU * u)) * 0.8 * k], fa: -0.4 * Math.max(0, -Math.cos(TAU * u)) };
    p.bl = { f: [-1.8 * k, b.ankleH], fa: 0 };
  }
  p.lean = sit ? 0.06 : 0.05;
  p.hd = [0.3 * k * nod, -0.6 * k * nod - 0.3 * k];
  const s = shoulder(b, p.hip, p.lean);
  // the near hand plucks low over the body (belly front), a little flick on each beat
  const pl = pulse(u * 2);
  p.fa = { ik: add2(s, 3.2 * k + pl * 0.6 * k, -(b.upArm + b.foreArm) * 0.62 - pl * 0.8 * k), hand: pl > 0.5 ? 'pinch' : 'relax', palm: 'in' };
  // the far hand on the neck, walking between two positions
  const pos = Math.floor(t * 4) % 2;
  p.ba = { ik: add2(s, (8.6 + pos * 1.6) * k, -(b.upArm + b.foreArm) * 0.2 + pos * 1.0 * k), hand: 'grip', palm: 'up' };
  p.front = ['armF'];
  p.flags = { zN: 2.2 * k, zF: -1.2 * k, aoF: 0.8 };
  p.held = { kind: 'huekiri', t };
  p.sway = 0.3 + 0.3 * nod;
  p.bounce = -nod * 0.2;
  return p;
}

function snakeDance(b: Build, t: number): Pose {
  const k = K(b);
  const w = TAU * t;
  const side = Math.sin(w);
  const p = stand(b);
  // low on bent knees, the hips rocking side to side with a slow wave rising up the body
  const low = 0.78 + 0.05 * Math.sin(w * 2);
  p.hip = [0.9 * k * side, b.hipH * low];
  p.lean = 0.08 + 0.06 * Math.sin(w + 1.2);
  p.hd = [0.6 * k * Math.sin(w + 2.0), -0.2 * k + 0.3 * k * Math.sin(w * 2 + 0.5)];
  p.fl = { f: [3.2 * k + side * 1.6 * k, b.ankleH + Math.max(0, Math.sin(w)) * 1.2 * k], fa: -0.3 * Math.max(0, Math.sin(w)) };
  p.bl = { f: [-3.0 * k + side * 1.6 * k, b.ankleH + Math.max(0, -Math.sin(w)) * 1.2 * k], fa: -0.3 * Math.max(0, -Math.sin(w)) };
  const s = shoulder(b, p.hip, p.lean);
  // the arms are the serpent: held forward, the wave travelling from the shoulder out to the hands
  const reach = (b.upArm + b.foreArm) * 0.85;
  p.fa = { ik: add2(s, reach * 0.95, 1.4 * k + 3.2 * k * Math.sin(w * 2 + 1.0)), hand: 'flat', palm: 'down', flex: 0.5 * Math.sin(w * 2 + 2.2) };
  p.ba = { ik: add2(s, reach * 0.8, -0.6 * k + 3.2 * k * Math.sin(w * 2 + 2.4)), hand: 'flat', palm: 'down', flex: 0.5 * Math.sin(w * 2 + 3.6) };
  p.front = ['armF'];
  p.flags = { zN: 1.4 * k, zF: -1.0 * k, sx: 1.0 * k * side, roll: 0.07 * side };
  p.sway = 0.8 + 0.4 * Math.sin(w * 2);
  p.bounce = 0.4 * Math.sin(w * 2);
  p.held = { kind: 'streamers', t };
  return p;
}

function storyTell(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = sitP(b);
  p.lean = 0.04 + 0.05 * Math.sin(w);
  p.hd = [0.4 * k * Math.sin(w), -0.2 * k];
  const s = shoulder(b, p.hip, p.lean);
  // the hands shape something in the air between him and the listeners: a wave, a coil, a peak
  const ph = Math.floor(t * 3);
  const a = Math.sin(w * 3);
  const shapes: [P2, P2][] = [
    [[7.4 * k, -3.0 * k + a * 1.6 * k], [6.0 * k, -4.6 * k - a * 1.6 * k]],
    [[6.2 * k + Math.cos(w * 3) * 1.6 * k, -2.0 * k + a * 1.6 * k], [5.2 * k - Math.cos(w * 3) * 1.4 * k, -2.6 * k - a * 1.2 * k]],
    [[5.6 * k, 1.6 * k + a * 0.8 * k], [5.0 * k, 0.8 * k - a * 0.8 * k]],
  ];
  const [n, f] = shapes[ph % 3];
  p.fa = { ik: add2(s, n[0], n[1]), hand: ph === 2 ? 'point' : 'open', palm: 'out' };
  p.ba = { ik: add2(s, f[0], f[1]), hand: 'open', palm: 'out' };
  p.front = ['armF'];
  p.flags = { zN: 2.0 * k, zF: -1.4 * k };
  return p;
}

function offer(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = stand(b, { hip: [-1.1 * k, b.hipH * 0.52], lean: 0.32, legFwd: true });
  p.fl = { f: [4.4 * k, b.ankleH], fa: 0 };
  p.bl = { f: [-6.2 * k, 1.2 * k], fa: -1.1 };
  const s = shoulder(b, p.hip, p.lean);
  const lift = 0.5 + 0.5 * Math.sin(w);
  p.fa = { ik: add2(s, 8.4 * k, -6.2 * k + lift * 1.6 * k), hand: 'cup', palm: 'up' };
  p.ba = { ik: add2(s, 7.8 * k, -6.6 * k + lift * 1.6 * k), hand: 'cup', palm: 'up' };
  p.front = ['armF'];
  p.flags = { zN: 1.2 * k, zF: -0.6 * k };
  p.look = 'down';
  return p;
}

function bless(b: Build, t: number): Pose {
  const k = K(b), w = TAU * t;
  const p = stand(b);
  p.lean = 0.02;
  p.hd = [0.2 * k, -0.5 * k * (0.5 + 0.5 * Math.sin(w))];
  const s = shoulder(b, p.hip, p.lean);
  p.fa = { ik: add2(s, 4.2 * k, 6.4 * k + Math.sin(w) * 0.6 * k), hand: 'flat', palm: 'fwd' };
  p.ba = { ik: add2(s, 1.0 * k, -(b.upArm + b.foreArm) * 0.9), hand: 'relax' };
  p.front = ['armF'];
  p.flags = { zN: 1.4 * k };
  return p;
}

// ------------------------------------------------------------------ the hue kiri in the hands
const along = (a: V3, b: V3): V3 => vnorm(vsub(b, a));
function drawHueKiri(s: Parameters<typeof HELD7.pot>[0], J: Parameters<typeof HELD7.pot>[1], hN: Parameters<typeof HELD7.pot>[4], hF: Parameters<typeof HELD7.pot>[5], pts: Record<string, V3>) {
  const pn = hN ? hN.palm : J.wrN, pf = hF ? hF.grip : J.wrF;
  const UP: V3 = [0, 1, 0];
  // the body sits under the plucking hand, a little in toward the belly; the neck runs to the far hand
  const body = vadd(vadd(pn, vsc(J.fwd, -1.2)), vsc(UP, -1.6));
  const dir = along(body, pf);
  const face = vnorm(vadd(vsc(J.lat, 0.8), vsc(J.fwd, 0.6)));
  const side = vnorm(vcross(dir, face));
  const gourd = (h: Hit) => cel(GOURD, h.l, Math.sin(h.q[0] * 9 + h.q[1] * 3) > 0.85 ? -0.25 : 0.05, true);
  s.ellipsoid(body, vsc(dir, 4.6), vsc(side, 4.0), vsc(face, 3.4), 50, gourd);
  // the serpent-skin face: pale with a net of dark diamond scales
  s.ellipsoid(vadd(body, vsc(face, 2.2)), vsc(dir, 3.8), vsc(side, 3.3), vsc(face, 1.4), 51, h => {
    const u = h.q[0] * 5 + h.q[1] * 5, v = h.q[0] * 5 - h.q[1] * 5;
    const edge = Math.abs(u - Math.round(u)) < 0.12 || Math.abs(v - Math.round(v)) < 0.12;
    return edge ? cel(SKIN, h.l, -0.55) : cel(SKIN, h.l, 0.1, true);
  });
  const nb = vadd(body, vsc(dir, 3.6)), ne = vadd(pf, vsc(dir, 3.2));
  s.limb(nb, ne, 0.85, 0.7, 50, h => cel(NECK, h.l, 0.05));
  // the head of the neck carved as a serpent's head, an inlaid shell eye
  const hd = vadd(ne, vsc(dir, 1.2));
  s.ellipsoid(hd, vsc(dir, 1.8), vsc(side, 1.0), vsc(face, 1.0), 50, h => cel(NECK, h.l, 0.1));
  s.dot(vadd(hd, vsc(face, 1.0)), hex('#8ad8c8'), 1);
  // strings of muka over the face up the neck
  for (const o of [-0.5, 0.5]) s.limb(vadd(vadd(body, vsc(face, 3.0)), vsc(side, o)), vadd(vadd(ne, vsc(face, 0.6)), vsc(side, o * 0.6)), 0.18, 0.18, 52, () => HP.cloth[5]);
  pts.sound = vadd(body, vsc(face, 3));
}

// streamers: two flax ribbons with feather tufts, one from each hand (the dance)
function drawStreamers(s: Parameters<typeof HELD7.pot>[0], J: Parameters<typeof HELD7.pot>[1], P: Pose, hN: Parameters<typeof HELD7.pot>[4], hF: Parameters<typeof HELD7.pot>[5], pts: Record<string, V3>) {
  const t = P.held?.t ?? 0;
  const UP: V3 = [0, 1, 0];
  const cols = [R6('#2a0806', '#5e0e0c', '#8e1c16', '#b82c22', '#d8483a', '#f07060'), R6('#06140c', '#0e2a18', '#1a4428', '#2a6040', '#3c8058', '#5aa070')];
  [hN, hF].forEach((h, i) => {
    if (!h) return;
    let a = h.grip;
    for (let j = 0; j < 6; j++) {
      const ph = TAU * t * 2 - j * 0.7 + i * 1.3;
      const b = vadd(vadd(a, vsc(J.fwd, -1.6)), vadd(vsc(UP, Math.sin(ph) * 1.4 - 0.4), vsc(J.lat, Math.cos(ph) * 0.6)));
      s.limb(a, b, 0.55 - j * 0.06, 0.5 - j * 0.06, 52 + i, hh => cel(cols[i], hh.l, j % 2 ? -0.2 : 0.1));
      a = b;
    }
    pts['tail' + i] = a;
  });
}

let done = false;
export function registerVillageAnims() {
  if (done) return;
  done = true;
  registerAnim7('strum', { frames: 16, fps: 8, loop: true }, (b, t) => strumPose(b, t, false));
  registerAnim7('strumSit', { frames: 16, fps: 8, loop: true }, (b, t) => strumPose(b, t, true));
  registerAnim7('snakeDance', { frames: 16, fps: 7, loop: true }, (b, t) => snakeDance(b, t));
  registerAnim7('storyTell', { frames: 12, fps: 4, loop: true }, (b, t) => storyTell(b, t));
  registerAnim7('offer', { frames: 8, fps: 3, loop: true }, (b, t) => offer(b, t));
  registerAnim7('bless', { frames: 8, fps: 3, loop: true }, (b, t) => bless(b, t));
  HELD7.huekiri = (s, J, _P, _ch, hN, hF, pts) => drawHueKiri(s, J, hN, hF, pts);
  HELD7.streamers = (s, J, P, _ch, hN, hF, pts) => drawStreamers(s, J, P, hN, hF, pts);
  void vlerp;
}

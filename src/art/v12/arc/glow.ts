// V12 Te Ara Matatū, chapter 3: the Mokotūrama, the lantern gecko of Te Ngahere Kānapanapa (the brain:
// src/game/v12/arc/species1.ts).
//
// A big night gecko, a cousin of the lost kawekaweau: a low, broad-headed lizard the colour of wet bark,
// mossy olive-brown with dark W-shaped chevrons down the back, each edged behind with a pale fleck, the
// skin granular with scattered raised tubercles, a cream belly. Along each flank two rows of photophores,
// pale blue-green beads ringed darker, and a ring of them round the fat tail; the tail ends in a swollen
// bulb, the lantern, that it holds up and waves to bring the moths in. The eye is huge and lidless, gold,
// with the gecko's vertical slit pupil; the toes end in wide pads.
//
// Anims: idle (breathing, the lights pulsing down its body, the tail tip curling), walk (the sprawled
// diagonal gait), run (a scurry, body up, tail out), lick (feeding: head down to the fungus, the tongue
// lapping the glowing dew), glow (the display: up on straight legs, the tail raised in a curl over the
// back, the lantern swung side to side, the spots flaring in waves), alert (head up, frozen, lights
// damped), hide (pressed flat, lights out), sleep (curled, tail round its nose).
//
// geckoFrame(anim, i, eye, juv) paints a frame and its glow: a second buffer holding only the lit
// pixels of the photophores and the lantern (same size and anchor), which the game draws emissive on
// top of the dark so the lights shine where the body itself is lost in the night.

import { Sk, rmp, drawEye, TAU, hh, ik2, lmix, cbez } from '../../beasts-core';
import { HField, crv, ribbon, spline, arcs, along, lineDist, cell, scaleH, fbm } from '../../beasts-hfield';
import type { EyeSpec, BeastEye, SpeciesDef, V2, Px } from '../../beasts-core';
import { PixelBuffer } from '../../pixel';
import { hex } from '../../color';
import type { C } from '../../color';

export const GECKO_ANIMS = {
  idle: { frames: 6, fps: 2, loop: true },
  walk: { frames: 6, fps: 8, loop: true },
  run: { frames: 4, fps: 13, loop: true },
  lick: { frames: 6, fps: 6, loop: true },
  glow: { frames: 8, fps: 5, loop: true },
  alert: { frames: 2, fps: 2, loop: true },
  hide: { frames: 2, fps: 1, loop: true },
  sleep: { frames: 2, fps: 0.7, loop: true },
};
/** the colour of its light (r, g, b 0..1) for the scene's lights */
export const GECKO_LIGHT: [number, number, number] = [0.45, 1, 0.86];

const EYE: EyeSpec = { r: 1.6, iris: hex('#d8b448'), lash: hex('#1a1408'), pupil: hex('#0a0806'), slit: 'v', ring: hex('#40381a'), shine: hex('#f6fff0') };
const GLOW_C = hex('#8cffe4'), GLOW_HOT = hex('#f0fff8');

interface Pose {
  /** body height off the ground (px) */
  lift: number;
  /** pressed flat 0..1 */
  flat: number;
  breathe: number;
  headUp: number;
  headDown: number;
  /** tail: 0 trailing on the ground, 1 raised in a curl over the back, -1 wrapped forward round the nose */
  curl: number;
  /** the lantern swung side to side -1..1 */
  wave: number;
  /** gait phase 0..1 (NaN: standing) */
  gait: number;
  /** stride length (px) */
  stride: number;
  tongue: number;
  /** base brightness of the lights 0..1 and the pulse running down the body (phase 0..1) */
  glow: number;
  pulse: number;
}

function pose(anim: string, f: number): Pose {
  const p: Pose = { lift: 0, flat: 0, breathe: 0, headUp: 0, headDown: 0, curl: 0.12, wave: 0, gait: NaN, stride: 0, tongue: 0, glow: 0.6, pulse: 0 };
  switch (anim) {
    case 'idle': p.breathe = [0, 0.4, 0.8, 0.5, 0.2, 0][f]; p.curl = 0.16 + [0, 0.04, 0.1, 0.12, 0.06, 0.02][f]; p.pulse = f / 6; p.glow = 0.62; break;
    case 'walk': p.gait = f / 6; p.stride = 3.2; p.lift = 0.3; p.curl = 0.06; p.pulse = f / 6; p.glow = 0.48; break;
    case 'run': p.gait = f / 4; p.stride = 4.4; p.lift = 0.9; p.curl = -0.02; p.headUp = 0.25; p.pulse = f / 4; p.glow = 0.4; break;
    case 'lick': p.headDown = [0.35, 0.6, 0.7, 0.7, 0.62, 0.45][f]; p.tongue = [0, 0.55, 1, 0.35, 0.9, 0.15][f]; p.curl = 0.1; p.pulse = f / 6; p.glow = 0.72; break;
    case 'glow': p.curl = 1; p.wave = Math.sin((f / 8) * TAU); p.lift = 0.8; p.headUp = 0.35; p.pulse = f / 8; p.glow = 1; p.breathe = 0.3 + 0.3 * Math.sin((f / 8) * TAU * 2); break;
    case 'alert': p.headUp = 1; p.lift = 0.5; p.curl = 0.04; p.glow = 0.12; p.pulse = f * 0.5; break;
    case 'hide': p.flat = 1; p.curl = -0.35; p.glow = 0; p.breathe = f * 0.25; break;
    case 'sleep': p.flat = 0.75; p.curl = -1; p.glow = 0.07; p.breathe = f * 0.4; p.pulse = f * 0.5; break;
  }
  return p;
}

/** what draw() leaves for geckoFrame: which materials glow, and how brightly each glowing pixel shines */
interface GlowNote { mats: Set<number>; k: Map<number, number> }
const NOTES = new WeakMap<Sk, GlowNote>();

/**
 * The body's outline, drawn round its spine from the snout to the lantern: half-widths above (the
 * eye bulge, the flat crown, the neck, the shoulders, the back, the hips, the fat tail swelling behind
 * its waist, the lantern) and below (the chin, the jowls, the throat, the chest, the sagging belly with
 * its scalloped fringe of skin, the vent, the tail), by distance from the snout (px at k = 1).
 */
const TOPW: [number, number][] = [[0, 0.5], [0.8, 1.1], [2.0, 1.9], [3.4, 2.75], [4.6, 2.7], [5.8, 2.1], [7.0, 1.35], [8.0, 1.3], [9.8, 2.0], [12.5, 2.2], [15, 2.35], [17.2, 2.2], [18.6, 1.4], [20.4, 2.1], [22.6, 2.0], [25, 1.5], [27.6, 1.0], [29.8, 0.7], [30.8, 1.0], [31.9, 1.6], [33.0, 1.65], [33.9, 1.1], [34.4, 0.3]];
const BOTW: [number, number][] = [[0, 0.5], [0.8, 0.9], [2.0, 1.15], [3.4, 1.5], [4.8, 1.95], [6.2, 1.9], [7.4, 1.4], [9.2, 1.9], [12, 2.45], [14.5, 2.6], [16.6, 2.3], [18, 1.5], [19.6, 2.0], [21.8, 1.9], [24.5, 1.3], [27.6, 0.85], [29.8, 0.65], [30.8, 0.9], [31.9, 1.5], [33.0, 1.55], [33.9, 1.0], [34.4, 0.3]];
const EYE_S = 3.5, LANTERN_S = 30.9;

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const P = pose(anim, frame);
  const k = juv ? 0.7 : 1;
  const note: GlowNote = { mats: new Set(), k: new Map() };
  NOTES.set(sk, note);
  const M = {
    skin: sk.m(rmp('#4c4e2e', { n: 8, dark: 0.66, light: 0.42, cool: 0.55, warm: 0.4 }), { edge: 1 }),
    bark: sk.m(rmp('#5e5434', { n: 7, dark: 0.62, light: 0.4, cool: 0.45, warm: 0.45 }), { edge: 1 }),
    dark: sk.m(rmp('#221e12', { n: 6, dark: 0.55, light: 0.32, cool: 0.4 }), { edge: 1 }),
    pale: sk.m(rmp('#8e8656', { n: 6, dark: 0.5, light: 0.36, warm: 0.5 }), { edge: 1 }),
    tub: sk.m(rmp('#7a7444', { n: 6, dark: 0.55, light: 0.42, warm: 0.5 }), { edge: 1 }),
    moss: sk.m(rmp('#5c6a2a', { n: 6, dark: 0.55, light: 0.4, warm: 0.3 }), { edge: 1 }),
    belly: sk.m(rmp('#968e66', { n: 6, dark: 0.5, light: 0.3, cool: 0.25, warm: 0.2 }), { edge: 1, noRim: true }),
    toe: sk.m(rmp('#4a462c', { n: 6, dark: 0.6, light: 0.4 }), { edge: 1 }),
    pad: sk.m(rmp('#7e7650', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    spot: sk.m(rmp('#80eed4', { n: 5, dark: 0.32, light: 0.5, warm: 0.1 }), { edge: 0, noRim: true }),
    spotOff: sk.m(rmp('#6c7a62', { n: 5, dark: 0.4, light: 0.35 }), { edge: 0, noRim: true }),
    lantern: sk.m(rmp('#a6fbe6', { n: 6, dark: 0.4, light: 0.6, warm: 0.1 }), { edge: 0 }),
    hood: sk.m(rmp('#3a4430', { n: 6, dark: 0.55, light: 0.4, cool: 0.5 }), { edge: 1 }),
    mouth: sk.m(rmp('#c46a6a', { n: 5, dark: 0.5, light: 0.4 }), { edge: 0 }),
  };
  note.mats.add(M.spot); note.mats.add(M.lantern);
  const F = HField.full(sk);
  const flat = P.flat;
  const bodyY = -(4.5 + P.lift - flat * 2.0) * k;
  const breath = 1 + P.breathe * 0.07;
  // ---------------------------------------------------------------- the spine: snout, head, neck, body, the tail
  const hip: V2 = [-5.2 * k, bodyY + 0.2 * k];
  const mid: V2 = [-0.6 * k, bodyY - 0.35 * k * (1 - flat)];
  const sho: V2 = [4 * k, bodyY + (0.1 + P.headDown * 0.35) * k];
  const neck: V2 = [6.6 * k, bodyY + (-0.4 - P.headUp * 1.1 + P.headDown * 1.5) * k];
  const ha = -P.headUp * 0.42 + P.headDown * 0.55;
  const hd = (d: number): V2 => [neck[0] + Math.cos(ha) * d * k, neck[1] + Math.sin(ha) * d * k];
  const cl0 = P.curl;
  const T0: V2 = [hip[0] - 0.4 * k, hip[1] + 0.3 * k];
  const lerpV = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const lie = [T0, [-11 * k, bodyY + 1.6 * k], [-16.5 * k, -1.6 * k - cl0 * 2 * k], [-21 * k, -2.2 * k - cl0 * 6 * k]] as V2[];
  const upC = [T0, [-11.5 * k, bodyY - 1.5 * k], [-11 * k, bodyY - 10.5 * k], [(-4.5 + P.wave * 2.4) * k, bodyY - 13 * k]] as V2[];
  const wrap = [T0, [-10 * k, bodyY + 2 * k], [-3 * k, -1.2 * k], [9 * k, -1.1 * k]] as V2[];
  const ctl = cl0 >= 0 ? lie.map((q, i) => lerpV(q, upC[i], Math.max(0, (cl0 - 0.2) / 0.8))) : lie.map((q, i) => lerpV(q, wrap[i], -cl0));
  const tail = cbez(ctl[0], ctl[1], ctl[2], ctl[3], 16);
  const torso = cbez(neck, sho, mid, hip, 10);
  const spine: V2[] = [hd(7.2), hd(5.2), hd(3), hd(1.2), ...torso, ...tail.slice(1)];
  // rescale the width tables to this spine's length (the tail stretches or shortens with the pose)
  const cum = arcs(spine), L = cum[cum.length - 1];
  const headL = Math.hypot(spine[0][0] - neck[0], spine[0][1] - neck[1]);
  const torsoL = arcs(torso)[torso.length - 1];
  const sOf = (d: number) => {
    // distance along the spine (px) -> table coordinate: head 0..7.2, torso 7.2..18.4, tail 18.4..34.4
    if (d <= headL) return (d / headL) * 7.2;
    if (d <= headL + torsoL) return 7.2 + ((d - headL) / torsoL) * 11.2;
    return 18.4 + ((d - headL - torsoL) / Math.max(1, L - headL - torsoL)) * 16;
  };
  const fringe = (s: number) => (s > 4.4 && s < 6.6 ? Math.max(0, Math.sin((s - 4.4) * 4.2)) * 0.3 : 0);
  const topW = (t: number) => { const s = sOf(t * L); return crv(TOPW, s) * k * (s > 8 && s < 18 ? breath : 1) * (1 - flat * 0.18); };
  const botW = (t: number) => { const s = sOf(t * L); return (crv(BOTW, s) + fringe(s) * (1 - flat * 0.5)) * k * (s > 8 && s < 18 ? breath : 1) * (1 - flat * 0.25); };
  // the spine runs snout -> tail (leftward), so the ribbon's left edge is the belly, the right edge the back
  const outline = ribbon(spine, botW, topW, Math.ceil(L * 3), 0, 0);
  // where a pixel lies on the body: s along (table units) and across (-1 belly .. +1 back)
  const where = (x: number, y: number): [number, number, number] => {
    const [, t] = lineDist(spine, x, y, cum);
    const q = along(spine, t, cum);
    const off = -((x - q.p[0]) * q.n[0] + (y - q.p[1]) * q.n[1]); // + toward the back
    const s = sOf(t * L);
    const w = off >= 0 ? Math.max(0.3, topW(t)) : Math.max(0.3, botW(t));
    return [s, off / w, t];
  };
  // ---------------------------------------------------------------- the legs (far pair first)
  const g0 = P.gait;
  const legs: { foot: V2; toes: V2[]; pads: V2[]; near: boolean }[] = [];
  const leg = (front: boolean, near: boolean) => {
    const z = near ? 6 : -6, bias = near ? 0.04 : -0.2;
    const ph = Number.isNaN(g0) ? 0 : g0 + ((front === near) ? 0 : 0.5);
    const sw = Number.isNaN(g0) ? 0 : Math.sin(ph * TAU);
    const up = Number.isNaN(g0) ? 0 : Math.max(0, Math.cos(ph * TAU)) * (P.stride > 4 ? 1.6 : 1.1);
    const root: V2 = front ? [sho[0] - 0.6 * k, sho[1] + 1.1 * k] : [hip[0] + 0.5 * k, hip[1] + 1.1 * k];
    const spread = near ? 0.4 : -0.6;
    let fx = front ? root[0] + (2.2 + spread) * k : root[0] - (1.6 - spread) * k;
    fx += sw * P.stride * 0.5 * k;
    if (P.curl < -0.5 && !front) fx += 1.2 * k;
    if (flat > 0.5) fx += (front ? 1.2 : -1.2) * k;
    const foot: V2 = [fx, -up * k];
    const l1 = (front ? 2.6 : 3.0) * k, l2 = (front ? 2.5 : 2.8) * k;
    // the elbow points back, the knee forward: the sprawl, seen from the side
    const [j] = ik2(root, foot, l1, l2, front ? -1 : 1);
    // one outline from the shoulder (hip) through the elbow (knee) to the wrist (ankle): muscled above, slim below
    const limb = spline([root, lerpV(root, j, 0.55), j, lerpV(j, foot, 0.5), foot], 3);
    const lw = (t: number) => (front ? (t < 0.45 ? 0.8 - t * 0.45 : t < 0.55 ? 0.58 : 0.56 - (t - 0.55) * 0.5) : (t < 0.45 ? 1.0 - t * 0.6 : t < 0.55 ? 0.7 : 0.66 - (t - 0.55) * 0.6)) * k;
    const lc = arcs(limb);
    F.inflate(ribbon(limb, lw, lw, 0, 0.6, 0.2), 1.1 * k, z, near ? (front ? 21 : 22) : (front ? 11 : 12), 0, (x, y, d, s, o) => {
      const t = lineDist(limb, x, y, lc)[1];
      o.m = t > 0.3 && t < 0.62 && hh(Math.floor(x * 1.2), 3, 33) > 0.5 ? M.dark : M.skin;
      o.t = bias - 0.08;
      cell(x * 2.2, y * 2.2, 1.3, 1.3, 31, 0.8);
      o.z += scaleH(2.4) * 0.15;
    }, 0.9);
    // the toes: splayed, each ending in a broad adhesive pad
    const n = 5, toes: V2[] = [], pads: V2[] = [];
    for (let i = 0; i < n; i++) {
      // splayed in a fan over the ground, the middle toes longest
      const a = (front ? -0.1 : Math.PI + 0.1) + (i / (n - 1) - 0.5) * (front ? 2.2 : -2.4);
      const len = (1.6 + (i === 2 ? 0.9 : i === 1 || i === 3 ? 0.6 : 0)) * k;
      toes.push([foot[0] + Math.cos(a) * len, foot[1] + Math.min(0.3, Math.sin(a) * len * 0.5)]);
    }
    for (const tp of toes) pads.push(tp);
    legs.push({ foot, toes, pads, near });
    void z;
  };
  leg(false, false);
  leg(true, false);
  // ---------------------------------------------------------------- the body: one outline, sculpted
  F.inflate(outline, 2.3 * k, 0, 1, 0, (x, y, d, s, o) => {
    const [ss, ac] = where(x, y);
    o.m = M.skin;
    // granular skin: a fine grain of tiny domed scales everywhere
    cell(x * 2.4 + 50, y * 2.4 + 50, 1.25, 1.25, 17, 0.85);
    o.z += scaleH(2.6) * 0.16;
    if (ss >= LANTERN_S) {
      o.m = ss < LANTERN_S + 0.6 ? M.hood : M.lantern;
      return;
    }
    // the cream belly
    if (ac < -0.62 + flat * 0.2) { o.m = M.belly; if (hh(Math.floor(ss * 2), Math.round(ac * 3), 19) > 0.6) o.z -= 0.15; return; }
    // rows of raised tubercles down the back and flanks
    if (ss > 6.5 && ss < 29) {
      const rowA = Math.abs(ac - 0.62) < 0.18 || Math.abs(ac - 0.12) < 0.16;
      const ph = (ss * 0.9 + (ac > 0.4 ? 0 : 0.5)) % 1;
      if (rowA && ph < 0.4) o.z += 0.3;
    }
    // W-shaped chevrons: dark bands slanting back down the flanks, a pale fleck behind each
    if (ss > 7 && ss < 30) {
      const ph = ss / 3.3 + Math.abs(ac - 0.25) * 0.55 + (hh(Math.floor(x * 2), Math.floor(y * 2), 71) - 0.5) * 0.1;
      const fp = ph - Math.floor(ph);
      if (fp < 0.24 && ac > -0.45) o.m = M.dark;
      else if (fp < 0.35 && ac > -0.1) o.m = M.pale;
      else if (ac > 0.75) o.m = M.bark;
    }
    // the tail's whorls of scales
    if (ss > 19 && Math.abs(((ss - 19) / 1.15) % 1 - 0.5) < 0.12) o.z -= 0.3;
    // the head: a dark stripe from the snout through the eye to the ear
    if (ss < 6.8 && ac > -0.2 && ac < 0.12 && ss > 2.4) o.m = M.bark;
    if (ss < 7.2 && ac < -0.3) o.m = ac < -0.65 ? M.belly : M.pale;
  }, 0.9);
  // anatomy carved in: the eye bulge, the mouth line, the ear opening, the waist of the tail, the hips and shoulders
  const at = (s: number, ac: number): V2 => {
    // invert sOf roughly by sampling
    let best = 0, bd = 1e9;
    for (let i = 0; i <= 60; i++) { const t = i / 60, d = Math.abs(sOf(t * L) - s); if (d < bd) { bd = d; best = t; } }
    const q = along(spine, best, cum);
    const w = ac >= 0 ? topW(best) : botW(best);
    return [q.p[0] - q.n[0] * ac * w, q.p[1] - q.n[1] * ac * w];
  };
  const ep = at(EYE_S, 0.42);
  F.bump(ep[0], ep[1], 2.4 * k, 1.1, 0, 0.05, 2 * k, 1);
  const mouthL = spline([at(0.35, -0.1), at(2.2, -0.3), at(4.4, -0.32), at(5.6, -0.12)], 3);
  F.groove(mouthL, 0.6 * k, 0.6, M.dark, -0.12, 1);
  { const q = at(6.3, 0.05); F.bump(q[0], q[1], 0.7 * k, -0.6, M.dark, -0.1, 0.7 * k, 1); }
  { const q = at(18.6, 0); F.groove([at(18.6, 0.9), q, at(18.6, -0.9)], 0.55 * k, 0.35, 0, -0.05, 1); }
  { const q = at(9.8, 0.2); F.bump(q[0], q[1], 2 * k, 0.5, 0, 0.03, 1.6 * k, 1); }
  { const q = at(17, 0.15); F.bump(q[0], q[1], 2.2 * k, 0.5, 0, 0.03, 1.8 * k, 1); }
  // ---------------------------------------------------------------- the tongue
  if (P.tongue > 0.05) {
    const m0 = at(0.6, -0.4), m1: V2 = [m0[0] + P.tongue * 1.4 * k + 0.4, m0[1] + P.tongue * 1.1 * k];
    F.inflate(ribbon([m0, m1], () => 0.55 * k, () => 0.5 * k, 6, 0.6, 0.6), 0.6 * k, 4, 30, 0, (x, y, d, s, o) => { o.m = M.mouth; }, 0.8);
  }
  // ---------------------------------------------------------------- near legs
  leg(true, true);
  leg(false, true);
  sk.np();
  F.emit({ seam: 1.0, seamDark: 0.32, ao: 0.08, aoR: 2, shadow: 0.2, shadowR: 6,
    spec: (m) => (m === M.lantern ? 0.6 : m === M.skin || m === M.bark || m === M.tub ? 0.12 : 0), specPow: 14 });
  // the toes and their pads (1px digits splayed on the ground, each ending in a broad pad)
  for (const lg of legs) {
    const bias = lg.near ? 0.0 : -0.2;
    for (let i = 0; i < lg.toes.length; i++) {
      const tp = lg.toes[i];
      sk.line(lg.foot[0], lg.foot[1] - 0.2, tp[0], tp[1], M.toe, 0.32 + bias, lg.near ? 9 : -4);
      if (i > 0 && i < 4) sk.dot(tp[0], tp[1], M.pad, 0.5 + bias, lg.near ? 10 : -3);
    }
  }
  // ---------------------------------------------------------------- the lights
  const lk = Math.min(1, P.glow * 1.15) * (0.82 + 0.18 * Math.sin(P.pulse * TAU + 1));
  const setK = (x: number, y: number, v: number) => { const i = sk.idx(x, y); if (i >= 0) note.k.set(i, Math.max(note.k.get(i) ?? 0, v)); };
  const lc = at(32.5, 0);
  for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
    const x = lc[0] + xx, y = lc[1] + yy;
    const i = sk.idx(x, y);
    if (i >= 0 && sk.mat[i] === M.lantern) setK(x, y, lk * (Math.hypot(xx, yy) < 1.2 ? 1 : 0.72));
  }
  const waveK = (s: number) => P.glow * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin((s / 13 - P.pulse) * TAU)));
  const skinM = new Set([M.skin, M.bark, M.dark, M.pale, M.tub, M.moss]);
  /** one bead of light, ringed darker */
  const bead = (q: V2, s: number, big: boolean) => {
    const x = Math.floor(q[0]), y = Math.floor(q[1]);
    const i = sk.idx(x, y);
    if (i < 0 || !skinM.has(sk.mat[i])) return;
    const v = waveK(s);
    const lit = P.glow > 0.15;
    sk.mat[i] = lit ? M.spot : M.spotOff; sk.lum[i] = 0.62;
    if (lit) setK(x, y, v);
    if (big && lit) { const j = sk.idx(x + 1, y); if (j >= 0 && skinM.has(sk.mat[j])) { sk.mat[j] = M.spot; sk.lum[j] = 0.5; setK(x + 1, y, v * 0.85); } }
    for (const [dx, dy] of [[0, -1], [-1, 0], [big ? 2 : 1, 0]] as V2[]) {
      const j = sk.idx(x + dx, y + dy);
      if (j >= 0 && skinM.has(sk.mat[j])) sk.lum[j] -= 0.14;
    }
  };
  // two rows along each flank of the body, staggered; rings round the tail; one behind the eye, one at the jaw
  for (let s = 8.8, i = 0; s < 18; s += 3.2, i++) {
    bead(at(s + 1.6, 0.25), s + 8, false);
    if (flat < 0.8) bead(at(s, -0.38), s + 8.8, false);
  }
  for (let s = 21; s < 30; s += 3.0) bead(at(s, 0.3), -s, false);
  bead(at(5.6, 0.35), 14, false);
  if (flat < 0.8) bead(at(6.4, -0.45), 13, false);
  // ---------------------------------------------------------------- the eye: huge, gold, the slit pupil, a pale scaly rim
  const er = juv ? 1.1 : 1.5;
  const e = drawEye(sk, ep[0], ep[1] - 0.2, { ...EYE, r: er }, eye);
  // the nostril
  { const q = at(0.7, 0.35); sk.over(q[0], q[1], hex('#1a160c')); }
  return { head: at(3.5, 2.4) as V2, eye: e };
}

export const GECKO: SpeciesDef = {
  name: 'Mokotūrama', kind: 'reptile', len: 34, height: 9,
  anims: GECKO_ANIMS,
  canvas: () => ({ w: 64, h: 40, ox: 30, oy: 33 }),
  draw,
  eyeFor: (anim, f) => (anim === 'sleep' ? 'closed' : anim === 'alert' ? 'alert' : anim === 'hide' && f === 1 ? 'alert' : 'open'),
};

// ------------------------------------------------------------------ a frame and its lights
export interface GeckoFrame { buf: PixelBuffer; glow: PixelBuffer; ax: number; ay: number; head: V2; eye: V2 }

/** paint one frame of the gecko with its glow layer (cropped together; the anchor is its feet) */
export function geckoFrame(anim: string, frame: number, eye: BeastEye = 'open', juv = false): GeckoFrame {
  const cv = GECKO.canvas(anim, juv);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  const o = GECKO.draw(sk, anim, frame, eye, juv);
  const full = sk.resolve();
  const note = NOTES.get(sk);
  const g = new PixelBuffer(full.w, full.h);
  if (note) {
    for (const [i, v] of note.k) {
      if (!note.mats.has(sk.mat[i]) || v < 0.02) continue;
      const c: C = lmix(GLOW_C, GLOW_HOT, Math.min(1, v * 0.7));
      const a = Math.round(Math.min(1, v) * 255);
      g.data[i] = ((a << 24) | (c & 0xffffff)) >>> 0;
    }
  }
  // crop both to the painted pixels
  let x0 = full.w, y0 = full.h, x1 = -1, y1 = -1;
  for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) if (full.data[y * full.w + x] >>> 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(full.w - 1, x1 + 1); y1 = Math.min(full.h - 1, y1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const buf = new PixelBuffer(w, h), glow = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    buf.data[y * w + x] = full.data[(y + y0) * full.w + x + x0];
    glow.data[y * w + x] = g.data[(y + y0) * full.w + x + x0];
  }
  const ax = sk.ox - x0, ay = sk.oy - y0;
  return { buf, glow, ax, ay, head: [o.head[0] + ax, o.head[1] + ay], eye: [o.eye[0] + ax, o.eye[1] + ay] };
}

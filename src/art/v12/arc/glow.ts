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

function draw(sk: Sk, anim: string, frame: number, eye: BeastEye, juv: boolean) {
  const P = pose(anim, frame);
  const k = juv ? 0.7 : 1;
  const note: GlowNote = { mats: new Set(), k: new Map() };
  NOTES.set(sk, note);
  const M = {
    skin: sk.m(rmp('#4e5030', { n: 8, dark: 0.66, light: 0.4, cool: 0.55, warm: 0.4 }), { edge: 1, spec: 0.08, bias: -0.06 }),
    dark: sk.m(rmp('#221e12', { n: 6, dark: 0.55, light: 0.32, cool: 0.4 }), { edge: 1 }),
    pale: sk.m(rmp('#8a8452', { n: 6, dark: 0.5, light: 0.36, warm: 0.5 }), { edge: 1, bias: -0.05 }),
    tub: sk.m(rmp('#6c6a3c', { n: 6, dark: 0.55, light: 0.45, warm: 0.5 }), { edge: 1 }),
    belly: sk.m(rmp('#928c66', { n: 6, dark: 0.5, light: 0.3, cool: 0.25, warm: 0.2 }), { edge: 1, noRim: true }),
    toe: sk.m(rmp('#4a462c', { n: 6, dark: 0.6, light: 0.4 }), { edge: 1 }),
    pad: sk.m(rmp('#8a8258', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    spot: sk.m(rmp('#80eed4', { n: 5, dark: 0.32, light: 0.5, warm: 0.1 }), { edge: 0, spec: 0.25, noRim: true }),
    lantern: sk.m(rmp('#a6fbe6', { n: 6, dark: 0.4, light: 0.6, warm: 0.1 }), { edge: 0, spec: 0.5 }),
    hood: sk.m(rmp('#3e4a30', { n: 6, dark: 0.55, light: 0.4, cool: 0.5 }), { edge: 1 }),
    mouth: sk.m(rmp('#c46a6a', { n: 5, dark: 0.5, light: 0.4 }), { edge: 0, spec: 0.4 }),
  };
  note.mats.add(M.spot); note.mats.add(M.lantern);
  const flat = P.flat;
  const bodyR = (2.35 - flat * 0.55) * k;
  const bodyY = -(3.5 + P.lift - flat * 1.3) * k;
  const breath = 1 + P.breathe * 0.07;
  // ---------------------------------------------------------------- the spine of the body
  const hip: V2 = [-5.2 * k, bodyY + 0.2 * k];
  const mid: V2 = [-0.6 * k, bodyY - 0.35 * k * (1 - flat)];
  const sho: V2 = [4 * k, bodyY + (0.1 + P.headDown * 0.35) * k];
  const neck: V2 = [6.6 * k, bodyY + (-0.4 - P.headUp * 1.1 + P.headDown * 1.5) * k];
  const bodyPts = cbez(hip, mid, sho, neck, 10);
  const radAt = (t: number) => (t < 0.35 ? 2 + t / 0.35 * 0.45 : t < 0.78 ? 2.45 - (t - 0.35) / 0.43 * 0.3 : 2.15 - (t - 0.78) / 0.22 * 0.7) / 2.35 * bodyR * (t > 0.15 && t < 0.7 ? breath : 1);
  // the chevrons: dark W bands slanting back down the flanks, each with a pale fleck behind it
  const chev = (along: number, v: number, x: number, y: number): number | null => {
    if (v > 0.4) return null;
    const ph = along / (3.3 * k) + Math.abs(v) * 0.55 + (hh(x, y, 71) - 0.5) * 0.12;
    const fp = ph - Math.floor(ph);
    if (fp < 0.24) return M.dark;
    if (fp < 0.33 && v < 0.1) return M.pale;
    return null;
  };
  const skinFill = (along: (p: Px) => number, belly = true) => (p: Px) => {
    if (p.v > 0.66 - flat * 0.25 && belly) return M.belly;
    const c = chev(along(p), p.v, p.x, p.y);
    // granular skin: a light grain, and here and there a raised tubercle (lit on top, a dark tuck under)
    const g = hh(p.x * 1.0 + 40, p.y + 40, 17);
    if (g > 0.93 && p.v < 0.3) { p.l += 0.14; return M.tub; }
    if (g < 0.05) p.l -= 0.08;
    if (c !== null) return c;
    return M.skin;
  };
  // ---------------------------------------------------------------- legs
  const g0 = P.gait;
  const leg = (front: boolean, near: boolean) => {
    sk.np();
    const z = near ? 7 : -7, bias = near ? 0.06 : -0.17;
    // diagonal pairs: near-front with far-hind
    const ph = Number.isNaN(g0) ? 0 : g0 + ((front === near) ? 0 : 0.5);
    const sw = Number.isNaN(g0) ? 0 : Math.sin(ph * TAU);
    const up = Number.isNaN(g0) ? 0 : Math.max(0, Math.cos(ph * TAU)) * (P.stride > 4 ? 1.6 : 1.1);
    const root: V2 = front ? [sho[0] - 0.6 * k, sho[1] + bodyR * 0.45] : [hip[0] + 0.5 * k, hip[1] + bodyR * 0.45];
    const spread = near ? 0.4 : -0.6;
    let fx = front ? root[0] + (2.2 + spread) * k : root[0] - (1.6 - spread) * k;
    fx += sw * P.stride * 0.5 * k;
    if (P.curl < -0.5 && !front) fx += 1.2 * k;
    if (flat > 0.5) fx += (front ? 1.2 : -1.2) * k;
    const foot: V2 = [fx, -up * k];
    const l1 = (front ? 2.5 : 2.9) * k, l2 = (front ? 2.4 : 2.7) * k;
    // the elbow points back, the knee forward: the sprawl, seen from the side
    const [j] = ik2(root, foot, l1, l2, front ? -1 : 1);
    sk.tube([root, j], t => (front ? 1.2 - t * 0.3 : 1.45 - t * 0.35) * k, skinFill(p => p.x * 0.6, false), { z, bias: bias - 0.04 });
    sk.tube([j, foot], t => (front ? 0.85 - t * 0.2 : 0.95 - t * 0.25) * k, skinFill(p => p.x * 0.6, false), { z: z + 0.5, bias: bias - 0.08 });
    // the toes: splayed, each ending in a wide pale pad
    const n = front ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const a = (front ? -0.25 : 0.55) + (i / (n - 1) - 0.5) * (front ? 1.5 : 1.9);
      const len = (1.6 + (i === 1 || i === 2 ? 0.6 : 0)) * k;
      const dir = front ? 1 : -1;
      const tip: V2 = [foot[0] + Math.cos(a) * len * dir, foot[1] + Math.sin(a) * len * 0.35 + 0.15];
      sk.line(foot[0], foot[1] - 0.2, tip[0], tip[1], M.toe, 0.38 + bias + (near ? 0.06 : 0), z + 0.8);
      if (i % 2 === 0) sk.dot(tip[0], tip[1], M.pad, 0.5 + bias, z + 1);
    }
  };
  leg(false, false);
  leg(true, false);
  // ---------------------------------------------------------------- the tail
  sk.np();
  const tailPart = sk.pid;
  const cl = P.curl;
  // control points: lying out behind (curl 0), raised in a curl over the back (1), wrapped forward (-1)
  const T0: V2 = [hip[0] - 0.4 * k, hip[1] + 0.3 * k];
  const lerpV = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const lie = [T0, [-11 * k, bodyY + 1.6 * k], [-16.5 * k, -1.6 * k - cl * 2 * k], [-21 * k, -2.2 * k - cl * 6 * k]] as V2[];
  const up = [T0, [-11.5 * k, bodyY - 1.5 * k], [-11 * k, bodyY - 10.5 * k], [(-4.5 + P.wave * 2.4) * k, bodyY - 13 * k]] as V2[];
  const wrap = [T0, [-10 * k, bodyY + 2 * k], [-3 * k, -1.2 * k], [9 * k, -1.1 * k]] as V2[];
  const ctl = cl >= 0 ? lie.map((q, i) => lerpV(q, up[i], Math.max(0, (cl - 0.2) / 0.8))) : lie.map((q, i) => lerpV(q, wrap[i], -cl));
  const tail = cbez(ctl[0], ctl[1], ctl[2], ctl[3], 14);
  // (the tail of a gecko is its larder: fat at the base, tapering, then the lantern bulb)
  const tailR = (t: number) => (2.15 - t * 1.4 - (t > 0.82 ? (t - 0.82) * 0.6 : 0)) * k * (1 - flat * 0.15);
  let tl = 0;
  const cum: number[] = [0];
  for (let i = 1; i < tail.length; i++) { tl += Math.hypot(tail[i][0] - tail[i - 1][0], tail[i][1] - tail[i - 1][1]); cum.push(tl); }
  sk.tube(tail, tailR, skinFill(p => -p.t * tl - 6 * k, false), { z: t => -0.6 + t * (cl > 0.5 ? -1.5 : cl < -0.5 ? 3 : 0) });
  // ---------------------------------------------------------------- the body
  sk.np();
  const bodyPart = sk.pid;
  sk.tube(bodyPts, radAt, skinFill(p => p.x), { z: 0 });
  // ---------------------------------------------------------------- the head: broad and flat, the snout rounded
  sk.np();
  const headPart = sk.pid;
  const ha = -P.headUp * 0.42 + P.headDown * 0.55;
  const rot = (dx: number, dy: number): V2 => [dx * Math.cos(ha) - dy * Math.sin(ha), dx * Math.sin(ha) + dy * Math.cos(ha)];
  const hc: V2 = [neck[0] + rot(2.6 * k, -0.3 * k)[0], neck[1] + rot(2.6 * k, -0.3 * k)[1]];
  const at = (dx: number, dy: number): V2 => { const r = rot(dx * k, dy * k); return [hc[0] + r[0], hc[1] + r[1]]; };
  const headFill = (p: Px) => {
    if (p.v > 0.45) { p.l += 0.02; return M.belly; }
    const g = hh(p.x + 40, p.y + 40, 19);
    if (g > 0.9 && p.v < 0.1) { p.l += 0.1; return M.tub; }
    // a dark stripe from the snout through the eye to the ear
    const s = at(0, 0), rel = [p.x - s[0], p.y - s[1]];
    const ly = -rel[0] * Math.sin(ha) + rel[1] * Math.cos(ha);
    if (ly > -1.0 * k && ly < -0.2 * k && p.v < 0.15 && p.v > -0.4 && rel[0] * Math.cos(ha) + rel[1] * Math.sin(ha) < 4 * k) return M.dark;
    return M.skin;
  };
  // the jowls and skull
  sk.ell(hc[0], hc[1], 3.4 * k, (2.35 - flat * 0.45) * k, headFill, { rot: ha, rz: 2.4 * k, z: 2 });
  const sn = at(3.3, 0.55);
  sk.ell(sn[0], sn[1], 2.7 * k, (1.55 - flat * 0.25) * k, headFill, { rot: ha + 0.1, rz: 1.6 * k, z: 2.6 });
  // the mouth: a long faint smile from the snout back under the eye; the nostril
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const q = at(5.6 - t * 6.4, 1.35 - Math.sin(t * Math.PI) * 0.3 + t * 0.1);
    sk.paint(q[0], q[1], 0, -0.22, headPart);
  }
  const nos = at(5.3, 0);
  sk.paint(nos[0], nos[1], M.dark, -0.1, headPart);
  // the tongue: fleshy, lapping down at what it's licking
  if (P.tongue > 0.05) {
    sk.np();
    const m0 = at(5.8, 1.2), m1 = at(5.8 + P.tongue * 1.3, 1.5 + P.tongue * 0.9);
    sk.tube([m0, m1], t => (0.55 - t * 0.1) * k, M.mouth, { z: 4 });
  }
  // ---------------------------------------------------------------- near legs
  leg(true, true);
  leg(false, true);
  // ---------------------------------------------------------------- the lantern at the tail tip
  sk.np();
  const tip = tail[tail.length - 1], pre = tail[tail.length - 3];
  const ta = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
  const lc: V2 = [tip[0] + Math.cos(ta) * 0.6 * k, tip[1] + Math.sin(ta) * 0.6 * k];
  const lr = 1.4 * k;
  // a dark hood of skin over the base of the bulb, the bulb itself pale and wet
  sk.ell(tip[0] - Math.cos(ta) * 0.6 * k, tip[1] - Math.sin(ta) * 0.6 * k, 1.05 * k, 1.05 * k, M.hood, { z: 3 + (cl < -0.5 ? 3 : 0) });
  const lanternZ = 3.5 + (cl < -0.5 ? 3 : 0);
  sk.ell(lc[0], lc[1], lr, lr * 0.92, M.lantern, { rot: ta, z: lanternZ });
  const lk = Math.min(1, P.glow * 1.15) * (0.82 + 0.18 * Math.sin(P.pulse * TAU + 1));
  // ---------------------------------------------------------------- the photophores
  const setK = (x: number, y: number, v: number) => { const i = sk.idx(x, y); if (i >= 0) note.k.set(i, Math.max(note.k.get(i) ?? 0, v)); };
  for (let yy = -lr - 1; yy <= lr + 1; yy++) for (let xx = -lr - 1; xx <= lr + 1; xx++) {
    const x = lc[0] + xx, y = lc[1] + yy;
    const i = sk.idx(x, y);
    if (i >= 0 && sk.mat[i] === M.lantern) setK(x, y, lk * (Math.hypot(xx, yy) < lr * 0.55 ? 1 : 0.72));
  }
  const waveK = (s: number) => P.glow * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin((s / 13 - P.pulse) * TAU)));
  /** one bead of light at (x, y) on part `part`, its ring a shade darker */
  const bead = (x: number, y: number, part: number, s: number, big: boolean) => {
    const i = sk.idx(x, y);
    if (i < 0 || sk.part[i] !== part || !sk.mat[i] || sk.mat[i] === M.belly) return;
    const v = waveK(s);
    sk.paint(x, y, M.spot, 0.1);
    setK(x, y, v);
    if (big) { sk.paint(x + 1, y, M.spot, 0.02, part); if (sk.mat[sk.idx(x + 1, y)] === M.spot) setK(x + 1, y, v * 0.85); }
    // the dark ring of skin round each one
    for (const [dx, dy] of [[0, -1], [-1, 0], [big ? 2 : 1, 0]] as V2[]) {
      const j = sk.idx(x + dx, y + dy);
      if (j >= 0 && sk.part[j] === part && sk.mat[j] !== M.spot && sk.mat[j] !== M.belly) sk.lum[j] -= 0.12;
    }
  };
  // two rows along each flank of the body, staggered
  const nb = bodyPts.length;
  const along = (pts: V2[], t: number): { p: V2; n: V2 } => {
    const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return { p: [a[0] + dx * u, a[1] + dy * u], n: [dy / L, -dx / L] };
  };
  void nb;
  const bodyLen = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]);
  for (let s = 1.4 * k, i = 0; s < bodyLen - 1.5 * k; s += 3 * k, i++) {
    const t = s / bodyLen, { p, n } = along(bodyPts, t), r = radAt(t);
    // (n points up out of the back)
    const a = [p[0] + n[0] * r * 0.5, p[1] + n[1] * r * 0.5];
    const b = [p[0] - n[0] * r * 0.05 + 1.15 * k, p[1] - n[1] * r * 0.05];
    if (i % 2 === 0) bead(Math.floor(a[0]), Math.floor(a[1]), bodyPart, s + 8, false);
    if (flat < 0.8) bead(Math.floor(b[0]), Math.floor(b[1]), bodyPart, s + 8.8, i % 2 === 1);
  }
  // rings round the tail
  for (let s = 2.6 * k, i = 0; s < tl - 2.6 * k; s += 3.2 * k, i++) {
    let j = 0;
    while (j < cum.length - 1 && cum[j + 1] < s) j++;
    const u = (s - cum[j]) / Math.max(0.01, cum[j + 1] - cum[j]);
    const a = tail[j], b = tail[Math.min(tail.length - 1, j + 1)];
    const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const r = tailR(s / tl);
    // the side of the tail facing us: a bead off the upper side (raised: off the outer side of the curl)
    const nx = dy / L, ny = -dx / L;
    const side = ny < 0 ? 1 : -1;
    bead(Math.floor(x + nx * r * 0.35 * side), Math.floor(y + ny * r * 0.35 * side), tailPart, -s, false);
  }
  // one behind the eye, one at the corner of the jaw
  const e1 = at(-1.6, -0.6), e2 = at(-0.6, 0.9);
  bead(Math.floor(e1[0]), Math.floor(e1[1]), headPart, 14, false);
  if (flat < 0.8) bead(Math.floor(e2[0]), Math.floor(e2[1]), headPart, 13, false);
  // ---------------------------------------------------------------- the eye: huge, gold, the slit pupil
  const ep = at(1.0, -0.95);
  // a pale scaly rim round the eye, then the eye itself
  const er = juv ? 1.1 : 1.5;
  for (let a = 0; a < TAU; a += TAU / 14) {
    const x = ep[0] + Math.cos(a) * (er + 1.1), y = ep[1] + Math.sin(a) * (er + 1.1);
    if (Math.sin(a) < -0.3) sk.paint(x, y, M.pale, 0.05, headPart);
  }
  const e = drawEye(sk, ep[0], ep[1], { ...EYE, r: er }, eye);
  return { head: at(1, -3) as V2, eye: e };
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

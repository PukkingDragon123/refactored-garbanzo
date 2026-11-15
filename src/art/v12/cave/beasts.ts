// V12 Te Rua Pōuri, the animals of the deep dark cave, sculpted with the beast sketch (shared shading,
// edge lines and rim light with every other animal).
//
// The Blind Salamander: an olm of the stream pools. A long eel of a body, pale pink and nearly
// see-through (the blood shows in faint veins, the gut a shadow inside), a flat spade of a snout with
// no eyes at all (only a faint smudge under the skin where they used to be), three feathery scarlet
// gill tufts each side of the head, and four tiny limbs, three fingers in front, two toes behind.
// Anims: idle (the gills breathing), swim, walk (on the pool bed), rest, flee, snap.
//
// The Ghost Gulper: a giant salamander four times Mori's length, pale as a drowned moon and nearly
// translucent (the spine and the gut show through as shadows; blood-pink in the gills and the mouth),
// skin hanging in wrinkled folds down the flanks, a flat broad head with two pinprick milky eyes on
// top, frilled gill stalks behind the head, short stout legs with splayed toes and a long paddle tail
// with a fin above and below. The mouth runs right across the front of the head: it gapes open into
// a pink cavern lined with tiny teeth, bigger than Mori standing up. Anims: lurk, swim, rise, gape (the
// jaw dropping), gapeHold (held wide, the throat pulsing), gulp (the lunge and the snap), sink.
//
// The Cave Wētā: a humpbacked amber cricket, banded brown, no wings, antennae three times its length
// always feeling the air, huge spiny drumstick hind legs. Anims: idle, walk, jump, windup (the crouch
// before it leaps: the tell), feed.
//
// The Cave Harvestman: a seed of a body slung between eight hair-thin legs, knees high; bobs its body
// up and down in a blur when disturbed. Anims: idle, walk, bob.
//
// The Cave Centipede: forty legs, a flat amber body banded dark, long feelers, and the curved venom
// claws under the head. Anims: idle, walk, rear (the threat), strike.

import { Sk, V2, rmp, TAU, hh, ik2 } from '../../beasts-core';
import { seg, blob, hair, curve, cumOf, pointOn } from '../../small-kit';
import type { LP, FP } from '../../small-kit';
import type { Px, SpeciesDef } from '../../beasts-core';
import { hex } from '../../color';
import { noise2 } from '../../../core/math';

const rotAbout = (p: V2, c: V2, a: number): V2 => {
  const s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1];
  return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co];
};

// ================================================================== the Blind Salamander and the Ghost Gulper
// (sculpted from one continuous outline each, with their wrinkled, see-through skin: ./salamanders.ts)
export { BLINDSAL, GULPER } from './salamanders';

// ================================================================== the Cave Wētā
// A rhaphidophorid from one contour: the head hung face-down under the front of the pronotum, the
// pronotum's glossy saddle, then the meso- and metanotum and seven abdominal tergites arching over
// the hump and down to the cerci, every plate's rear margin overlapping the next (a step in the
// outline) and banded dark, a glint on each; the pale pleural membrane below the plates' lower edges.
// Long banded legs: the front and middle legs with their knees up, the great hind femur a swollen
// drumstick with the herringbone of its muscles, its knee cocked above the back, the long hind tibia
// down to the ground with two rows of spines; long hanging palps; a small dark eye; and the antennae,
// three times the body, ringed and fading to hair at the tips, always feeling the air.
const WANIMS = {
  idle: { frames: 4, fps: 3, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  jump: { frames: 4, fps: 9, loop: false },
  windup: { frames: 2, fps: 6, loop: true },
  feed: { frames: 2, fps: 4, loop: true },
};
const WAMB = ['#2e1a0c', '#4c2c12', '#74461c', '#9c6a2c', '#be8c44', '#d8ae66', '#eed096', '#fbeccc'];
const WBAND = ['#1c0e06', '#2e180a', '#46260e', '#603818', '#7a4c22'];
const WPALE = ['#5a4026', '#86683e', '#b09062', '#d0b486', '#e8d4aa'];
/** dorsal plate boundaries (body-space x, head to tail): pronotum | meso | meta | T1..T7 */
const WB = [2.75, 1.45, 0.25, -0.85, -1.85, -2.75, -3.55, -4.3, -4.95, -5.6];
/** the dorsal arch (x -> y) through the hump */
const WARCH: [number, number][] = [[-6.0, -3.9], [-5.4, -4.7], [-4.6, -5.6], [-3.6, -6.5], [-2.4, -7.25], [-1.0, -7.8], [0.4, -8.05], [1.8, -7.95], [3.2, -7.45], [4.6, -6.7], [5.6, -5.9]];
const archY = (x: number) => {
  if (x <= WARCH[0][0]) return WARCH[0][1];
  for (let i = 1; i < WARCH.length; i++) if (x <= WARCH[i][0]) { const [a, va] = WARCH[i - 1], [b, vb] = WARCH[i]; const t = (x - a) / (b - a); return va + (vb - va) * (t * t * (3 - 2 * t)); }
  return WARCH[WARCH.length - 1][1];
};
/** the body's outline: the stepped plates over the arch, the tail and cerci, the underside */
function wetaBody(): LP[] {
  const out: LP[] = [[5.65, -5.85]];
  // head to tail along the back: each plate rises toward its overlapping rear margin, then steps down
  const edges = [5.6, ...WB];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i], x1 = edges[i + 1];
    const lift = i === 0 ? 0.28 : 0.22;
    for (let j = 1; j <= 3; j++) { const t = j / 3, x = x0 + (x1 - x0) * t; out.push([x, archY(x) - lift * t * t, j === 3 ? 1 : 0] as LP); }
    // the step down to the next plate, tucked under this one
    out.push([x1 - 0.06, archY(x1) + 0.12, 1]);
  }
  out.push([-6.05, -3.95], [-6.0, -3.35], [-5.3, -3.0], [-3.8, -2.85], [-1.8, -3.05], [0.6, -3.3], [2.6, -3.45], [4.2, -3.6], [5.15, -4.3]);
  return out;
}
/** the head capsule, face down (hypognathous) */
const WHEAD: LP[] = [[4.9, -5.75], [5.85, -6.05], [6.7, -5.45], [7.05, -4.4], [6.95, -3.3], [6.45, -2.55], [5.75, -2.6], [5.05, -3.4]];

interface WPose { dx: number; dy: number; rot: number; hind: number; hindLift: number; feet: number; air: number; ant: number; antBack: number; head: number; palp: number; step: number }
function wpose(anim: string, f: number): WPose {
  const t = f / (WANIMS[anim as keyof typeof WANIMS]?.frames ?? 1), ph = t * TAU;
  const p: WPose = { dx: 0, dy: 0, rot: 0, hind: 0, hindLift: 0, feet: 0, air: 0, ant: Math.sin(ph) * 0.12, antBack: 0, head: 0, palp: Math.sin(ph * 2) * 0.3, step: 0 };
  switch (anim) {
    case 'idle': p.dy = f === 2 ? 0.3 : 0; break;
    case 'walk': p.step = ph; p.dy = Math.abs(Math.sin(ph)) * -0.35; p.ant = Math.sin(ph) * 0.18; break;
    case 'jump':
      // gathered, the kick, flying, landing
      p.dy = [1.5, -3.5, -7, 0.4][f]; p.dx = [0, 2, 5, 5.5][f]; p.rot = [0.08, -0.32, -0.12, 0.12][f];
      p.hind = [1, 2, 3, 0.4][f]; p.air = [0, 0.4, 1, 0][f]; p.antBack = [0.6, 1, 0.9, 0][f];
      break;
    case 'windup': p.dy = 1.7 + f * 0.15; p.rot = 0.1; p.hind = 1.15; p.antBack = 0.75 + f * 0.1; p.ant = f * 0.05; break;
    case 'feed': p.head = 0.35; p.rot = 0.12; p.dy = 0.6; p.palp = f ? 0.6 : -0.3; p.ant = 0.1 + f * 0.08; break;
  }
  return p;
}
function wdraw(sk: Sk, anim: string, frame: number, _e: unknown, juv: boolean) {
  const k = juv ? 0.8 : 1.22;
  const P = wpose(anim, frame);
  const M = {
    amb: sk.m(WAMB.map(c => hex(c)), { edge: 2, k: 0.85 }),
    band: sk.m(WBAND.map(c => hex(c)), { edge: 1 }),
    pale: sk.m(WPALE.map(c => hex(c)), { edge: 2 }),
    fem: sk.m(['#5a3a1a', '#8a6232', '#b88e54', '#d8b47a', '#eed4a2', '#fbefd2'].map(c => hex(c)), { edge: 1 }),
    leg: sk.m(['#3a220e', '#5e3a18', '#8a5c2a', '#b2824a', '#d2a86e', '#ead0a0'].map(c => hex(c)), { edge: 1 }),
  };
  // body space -> canvas: tip about the hips, lift / drop, slide forward
  const piv: V2 = [0, -4];
  const c = Math.cos(P.rot), s = Math.sin(P.rot);
  const T = (x: number, y: number): V2 => { const dx = x - piv[0], dy = y - piv[1]; return [(piv[0] + dx * c - dy * s + P.dx) * k, (piv[1] + dx * s + dy * c + P.dy) * k]; };
  const inv = (X: number, Y: number): V2 => { const x = X / k - P.dx - piv[0], y = Y / k - P.dy - piv[1]; return [piv[0] + x * c + y * s, piv[1] - x * s + y * c]; };
  const K = (q: V2): V2 => [q[0] * k, q[1] * k];
  const U = (x: number, y: number): V2 => { const q = T(x, y); return [q[0] / k, q[1] / k]; };
  const gy = 0;
  /** one thin leg: femur, tibia, tarsus as hair-fine lines, banded dark at the joints; the knee by IK */
  const NEAR = { a: '#d4a468', b: '#a87440', d: '#4a2a12', t: '#ecd0a0' }, FAR = { a: '#8a6440', b: '#6a4626', d: '#2e1a0a', t: '#9a7a54' };
  const thin: (() => void)[] = [];
  const leg = (hipB: V2, foot: V2, lf: number, lt: number, bend: number, far: boolean, tars: number) => {
    const hip = U(hipB[0], hipB[1]);
    const [knee, ft] = ik2(hip, foot, lf, lt, bend);
    const C = far ? FAR : NEAR;
    const tip: V2 = [ft[0] + tars, Math.min(gy - 0.5, ft[1] + (P.air > 0.5 ? 0.6 : 0))];
    thin.push(() => {
      hair(sk, [K(hip), K(knee)], (t) => hex(t > 0.8 ? C.d : C.a), 0.3, far);
      hair(sk, [K(knee), K(ft)], (t) => hex(t < 0.12 || Math.abs(t - 0.55) < 0.07 ? C.d : C.b), 0.3, far);
      hair(sk, [K(ft), K(tip)], () => hex(C.t), 0.3, far);
    });
  };
  /** the hind leg: the drumstick femur, knee up; the long spined tibia */
  const hindLeg = (far: boolean) => {
    const hipB: V2 = far ? [-0.2, -4.2] : [-0.55, -3.75];
    const hip = U(hipB[0], hipB[1]);
    const LF = 9.8, LT = 11;
    let foot: V2;
    const h = P.hind;
    if (h >= 2.5) foot = [hip[0] - 17.5, hip[1] + 2.6];                  // trailing in the air
    else if (h >= 1.5) foot = [hip[0] - 15.6, gy - 0.3];                  // the kick: near straight
    else if (h >= 0.9) foot = [hip[0] - 7.4 - (h - 1) * 2, gy - 0.3];     // gathered: folded tight
    else foot = [hip[0] - 11.5 + h * 2, gy - 0.3];
    if (far) foot = [foot[0] + 1.2, foot[1] - (P.air > 0.5 ? 0.5 : 0)];
    const [knee, ft] = ik2(hip, foot, LF, LT, 1);
    const z0 = far ? -5 : 7, bias = far ? -0.2 : 0;
    const dx = knee[0] - hip[0], dy = knee[1] - hip[1], L = Math.hypot(dx, dy);
    // the drumstick: swollen at the base, tapering to the knee
    seg(sk, [K(hip), K([hip[0] + dx * 0.45, hip[1] + dy * 0.45 - 0.25]), K(knee)],
      t => (1.75 * Math.pow(1 - t, 0.75) + 0.38) * k, t => (1.45 * Math.pow(1 - t, 0.9) + 0.32) * k,
      (p, t, cr) => {
        if (t > 0.88) { p.l -= 0.3; return M.leg; }
        // the herringbone: chevrons of muscle pointing down the femur, a dark band before the knee
        const ch = (t * L * 0.9 + Math.abs(cr) / k * 0.8) % 1.5;
        if (!far && ch < 0.45 && t > 0.1 && t < 0.8) p.l -= 0.24;
        if (t > 0.72) p.l -= 0.12;
        return M.fem;
      }, { z: z0, bias, capA: 1, capB: 1, spec: 0.5, specPow: 12 });
    const C = far ? FAR : NEAR;
    const tip: V2 = [ft[0] - 2.2, Math.min(gy - 0.5, ft[1] + (P.air > 0.5 ? 0.4 : 0))];
    thin.push(() => {
      hair(sk, [K(knee), K(ft)], (t) => hex(t < 0.08 || Math.abs(t - 0.5) < 0.05 ? C.d : C.b), 0.3, far);
      hair(sk, [K(ft), K(tip)], () => hex(C.t), 0.3, far);
      // the two rows of spines down the back of the tibia
      if (far) return;
      const tx = ft[0] - knee[0], ty = ft[1] - knee[1], tl = Math.hypot(tx, ty) || 1;
      const nx = ty / tl, ny = -tx / tl;
      const sgn = nx < 0 ? 1 : -1;
      for (let i = 1; i <= (juv ? 3 : 6); i++) {
        const t = 0.15 + i * (juv ? 0.22 : 0.12);
        sk.over((knee[0] + tx * t + nx * sgn * 1.1) * k, (knee[1] + ty * t + ny * sgn * 1.1) * k, hex(i % 2 ? '#3a2008' : '#6a4420'));
      }
    });
  };
  /** the walking gait: alternate tripods */
  const st = (i: number) => (P.step ? Math.sin(P.step + i * Math.PI) * 1.3 : 0);
  const sl = (i: number) => (P.step ? Math.max(0, Math.cos(P.step + i * Math.PI)) * 0.9 : 0);
  const air = P.air > 0.5;
  const frontFoot = (far: boolean): V2 => { const h = U(far ? 4.0 : 4.4, -3.3); return air ? [h[0] + 4, h[1] + 3.5] : [h[0] + 3.6 + st(far ? 1 : 0) + (far ? -0.8 : 0), gy - 0.3 - sl(far ? 1 : 0)]; };
  const midFoot = (far: boolean): V2 => { const h = U(far ? 1.7 : 2.1, -3.3); return air ? [h[0] - 1, h[1] + 4] : [h[0] - 1.6 + st(far ? 0 : 1) + (far ? 0.9 : 0), gy - 0.3 - sl(far ? 0 : 1)]; };

  // ---- the far side: antenna, legs
  const headPt = (x: number, y: number): V2 => {
    // the head pitches down to feed about its neck under the pronotum
    if (!P.head) return [x, y];
    const cx = 5.2, cy = -4.6, a = P.head, dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const antenna = (far: boolean) => {
    const b0 = headPt(far ? 6.3 : 6.6, far ? -5.0 : -4.8);
    const base = U(b0[0], b0[1]);
    // forward and up, feeling the air; swept back over the body before (and through) a leap
    const back = Math.min(1, P.antBack);
    let a = (-1.05 + P.ant * (far ? -1 : 1)) * (1 - back) + (-2.55 + P.ant * 0.3) * back + (far ? -0.18 : 0) + P.rot;
    const L = (juv ? 25 : 29) * (far ? 0.9 : 1) * (1 - back * 0.2);
    const pts: V2[] = [base];
    let q = base;
    for (let d = 0; d < L; d += 1) {
      // rising, then arcing over and down
      a += (0.045 + Math.sin(d * 0.13 + frame * 0.9 + (far ? 1.3 : 0)) * 0.012) * (1 - back * 2.1);
      q = [q[0] + Math.cos(a), q[1] + Math.sin(a)];
      if (q[1] > gy - 0.5) q[1] = gy - 0.5;
      pts.push(q);
    }
    const near = ['#d8b07a', '#8a5a2c'], fa = ['#8e6a44', '#5a3a1e'];
    hair(sk, pts.map(K), (t, i) => {
      if (t > 0.92 && i % 2) return 0;
      const C = far ? fa : near;
      return hex(C[(i >> 1) % 2], Math.round(255 * (t < 0.65 ? 1 : 1 - (t - 0.65) * 1.6)));
    }, 0.4, far);
  };
  hindLeg(true);
  leg([1.7, -3.4], midFoot(true), 4.6, 5.3, 1, true, 1.2);
  leg([4.0, -3.4], frontFoot(true), 4.0, 4.8, -1, true, 1.3);

  // ---- the body: one stepped outline, the plates banded and glossy, the pale membrane under them
  const cont = wetaBody().map(q => { const u = T(q[0], q[1]); return (q[2] ? [u[0], u[1], 1] : [u[0], u[1]]) as LP; });
  blob(sk, cont, (p) => {
    const [bx, by] = inv(p.x, p.y);
    // which plate: the boundaries run radially out from under the arch
    const ang = Math.atan2(by + 1.2, bx);
    let i = 0;
    while (i < WB.length && ang < Math.atan2(archY(WB[i]) + 1.2, WB[i])) i++;
    const front = i === 0 ? 5.6 : WB[i - 1], rear = i < WB.length ? WB[i] : -6.1;
    const dxr = bx - rear, u = 1 - Math.max(0, Math.min(1, dxr / Math.max(0.3, front - rear)));
    // the plates' lower edges: below them the pale pleural membrane
    const top = archY(bx), depth = Math.max(1, (top * -1) - 3.0);
    const low = top + depth * (i === 0 ? 0.78 : 0.66) + Math.sin(u * Math.PI) * 0.25;
    if (by > low) return M.pale;
    if (u > (i === 0 ? 0.8 : 0.6)) return M.band;
    if (p.nx > 0) p.l += p.nx * 0.15;
    return M.amb;
  }, { z: 0, round: 1.5 * k, dome: 1.0 * k, spec: 0.5, specPow: 22, per: 3 });
  // the head, hung face-down under the pronotum's lip; the small dark eye; the palps
  const hp = WHEAD.map(q => { const h = headPt(q[0], q[1]); const u = T(h[0], h[1]); return [u[0], u[1]] as LP; });
  blob(sk, hp, (p) => { if (p.nx > 0) p.l += p.nx * 0.18; return M.amb; }, { z: -0.5, round: 1.0 * k, dome: 0.6 * k, spec: 0.6, per: 3 });
  const eb = headPt(6.05, -4.5), ey = T(eb[0], eb[1]);
  sk.over(ey[0], ey[1], hex('#140a04'));
  if (!juv) sk.over(ey[0], ey[1] - 1, hex('#5a3a1e'));
  for (const sd of [0, 1]) {
    const m0 = headPt(6.5 - sd * 0.5, -2.7), m1 = headPt(7.1 - sd * 0.6 + P.palp * 0.4, -1.6), m2 = headPt(7.5 - sd * 0.5 + P.palp * 0.6, -0.9 + sd * 0.2);
    hair(sk, [K(U(m0[0], m0[1])), K(U(m1[0], m1[1])), K(U(m2[0], m2[1]))], (t) => hex(t > 0.6 ? '#e2c08a' : sd ? '#8a5c2c' : '#b88a52'), 0.3);
  }
  antenna(true);
  // ---- the cerci at the tail tip
  for (const sd of [0, 1]) { const a = U(-5.95, -3.7 + sd * 0.3), b = U(-7.4 + sd * 0.3, -4.3 + sd * 0.7); hair(sk, [K(a), K(b)], (t) => hex(t > 0.5 ? '#c49a62' : '#6a4420'), 0.3); }
  // ---- the near legs over the body, the near antenna
  leg([2.1, -3.3], midFoot(false), 4.6, 5.3, 1, false, 1.3);
  leg([4.4, -3.3], frontFoot(false), 4.0, 4.8, -1, false, 1.4);
  hindLeg(false);
  for (const f of thin) f();
  antenna(false);
  const h0 = headPt(6.2, -5.6), hd = T(h0[0], h0[1]);
  return { head: [hd[0], hd[1] - 2 * k] as V2, eye: ey };
}
export const CAVEWETA: SpeciesDef = {
  name: 'Cave Wētā', kind: 'insect', len: 14, height: 7,
  anims: WANIMS,
  canvas: () => ({ w: 72, h: 44, ox: 28, oy: 34 }),
  draw: wdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};

// ================================================================== the Cave Harvestman
// One fused body (the prosoma and the segmented opisthosoma with no waist), the eye turret
// (ocularium) standing on its front with an eye each side, the chelicerae and short pedipalps in
// front, and eight hair-thin legs: from the coxae under the body each femur climbs steeply to a
// high knee (the pale patella), the tibia drops away down and out, kinks at the metatarsus, and the
// long whip of the tarsus curls along the ground. The second pair is longest and probes ahead.
// Dark chestnut with a black saddle and pale flecks; the legs dark with pale knees and pale tips.
const HANIMS = {
  idle: { frames: 2, fps: 1.5, loop: true },
  walk: { frames: 4, fps: 6, loop: true },
  bob: { frames: 4, fps: 16, loop: true },
};
function harvBody(): LP[] {
  return [
    // the prosoma's front, the turret, the back sloping into the segmented abdomen, the rounded rear
    [4.0, -9.6], [3.6, -10.9], [2.7, -11.4], [2.2, -12.6, 1], [1.3, -13.1], [0.6, -12.5, 1], [0.1, -11.75],
    [-1.2, -11.9], [-2.7, -11.7], [-3.9, -11.0], [-4.5, -9.9], [-4.1, -8.6], [-2.6, -7.8], [0.0, -7.7], [2.3, -7.95], [3.6, -8.6],
  ];
}
function hdraw(sk: Sk, anim: string, frame: number) {
  const ph = (frame / (HANIMS[anim as keyof typeof HANIMS]?.frames ?? 1)) * TAU;
  const bob = anim === 'bob' ? Math.sin(ph) * 2.6 : anim === 'idle' ? frame * 0.4 : 0;
  const M = {
    body: sk.m(['#3a1e0c', '#5e3414', '#86501e', '#ae7230', '#cc944a', '#e4b46c', '#f4d49a'].map(c => hex(c)), { edge: 1 }),
    saddle: sk.m(['#2a1206', '#3e1e0c', '#582c12', '#723c1a', '#8e5024'].map(c => hex(c)), { edge: 1 }),
    turret: sk.m(['#3a2412', '#5e3e1e', '#8a6232', '#b48a52', '#d4b07a'].map(c => hex(c)), { edge: 1 }),
  };
  const dy = bob;
  // eight legs: [coxa x, knee x offset, foot x, knee height, near]
  const LEGS: [number, number, number, number][] = [
    [1.6, 9.0, 18.5, 19.0], [0.8, 6.2, 21.0, 21.0], [-0.6, -4.8, -13.5, 18.0], [-1.4, -8.0, -20.0, 20.0],
  ];
  const leg = (i: number, far: boolean) => {
    const [cx, kx, fx, kh] = LEGS[i];
    const sgn = fx > 0 ? 1 : -1;
    const step = anim === 'walk' ? Math.sin(ph + i * 1.7 + (far ? Math.PI : 0)) * 1.5 : 0;
    const lift = anim === 'walk' ? Math.max(0, Math.cos(ph + i * 1.7 + (far ? Math.PI : 0))) * 1.6 : 0;
    const fo = far ? 0.82 : 1, ko = far ? -1.2 : 0;
    const hip: V2 = [cx * (far ? 0.7 : 1), -8.2 + dy];
    // the second pair (i 1) probes forward, its tip lifted
    const probe = i === 1 ? (anim === 'idle' ? 1.2 + frame * 0.8 : anim === 'bob' ? 0.6 : 1) : 0;
    const knee: V2 = [cx + kx * fo + step * 0.35, -kh * (far ? 0.92 : 1) + ko + dy * 0.45];
    const kink: V2 = [cx + (kx + (fx - kx) * 0.62) * fo + step * 0.8, -kh * 0.42 + ko * 0.5 - probe * 1.5];
    const foot: V2 = [cx + fx * fo + step, -0.5 - lift - (far ? 1.2 : 0) - probe * 2.2];
    const tarsus: V2 = [foot[0] + sgn * (2.6 + probe), foot[1] + (probe ? -probe * 1.4 : 0.15)];
    const C = far ? { fem: '#1e1208', pat: '#7a6448', tib: '#2e1e10', tar: '#5a4630' } : { fem: '#2e1a0c', pat: '#d8c49a', tib: '#4a3018', tar: '#a08462' };
    // (the coxae sit under the body: every femur climbs out from behind it)
    hair(sk, curve([hip, [hip[0] + (knee[0] - hip[0]) * 0.5, hip[1] + (knee[1] - hip[1]) * 0.55 - 0.6], knee], 4), (t) => hex(t > 0.88 ? C.pat : C.fem), 0.3, true);
    hair(sk, [knee, kink], (t) => hex(t < 0.12 ? C.pat : C.tib), 0.3, far);
    hair(sk, curve([kink, [kink[0] + (foot[0] - kink[0]) * 0.55 + sgn * 0.3, kink[1] + (foot[1] - kink[1]) * 0.5], foot], 4), (t) => hex(t < 0.1 ? C.pat : C.tib), 0.3, far);
    hair(sk, curve([foot, [foot[0] + sgn * 1.4, foot[1] + 0.3], tarsus], 4), () => hex(C.tar), 0.3, far);
  };
  // the body: a ghost of it at the other end of the bob, a blur of speed
  let ghost: (() => void) | null = null;
  if (anim === 'bob') {
    const gdy = -Math.sin(ph) * 2.6 - dy;
    const g = harvBody().map(q => [q[0], q[1] + dy + gdy * 0.8] as LP);
    ghost = () => {
      // a translucent smear where the body just was
      const gc = hex('#a8743a', 46), ge = hex('#d8a868', 80);
      const ys = g.map(q => q[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for (let y = y0; y <= y1; y++) for (let x = -5; x <= 5; x++) if (inPoly(g, x + 0.5, y + 0.5) && !sk.has(x + 0.5, y + 0.5)) sk.over(x, y, y === y0 || y === y1 ? ge : gc);
    };
  }
  const cont = harvBody().map(q => [q[0], q[1] + dy, q[2] ?? 0] as LP);
  blob(sk, cont, (p) => {
    const y = p.y - dy;
    // the turret, the saddle over the back, pale flecks in rows across the abdomen's segments
    if (y < -11.7 && p.x > 0.2 && p.x < 2.6) return M.turret;
    // the saddle: a dark hourglass over the back, ragged at its edges
    if (p.x < 0.0 && p.x > -3.2 && y < -11.2 + Math.sin(p.x * 2.6) * 0.3 + Math.abs(p.x + 1.6) * 0.35) return M.saddle;
    // the abdomen's segment grooves, rows of pale flecks along them
    if (p.x < -0.3 && Math.abs(((p.x + 8) % 1.3) - 0.65) < 0.22 && y > -10.4) { p.l -= 0.2; return M.body; }
    if (p.x < -0.3 && Math.abs(((p.x + 8) % 1.3)) < 0.3 && y > -10.4 && y < -9.0) p.l += 0.25;
    if (p.nx > 0) p.l += p.nx * 0.2;
    return M.body;
  }, { z: 1, round: 1.4, dome: 0.9, spec: 0.7, specPow: 14, per: 3 });
  ghost?.();
  // the far legs pass behind the body
  for (let i = 0; i < 4; i++) leg(i, true);
  // the eyes either side of the turret, glinting; the chelicerae and the palps in front
  sk.over(1.9, -12.0 + dy, hex('#050302'));
  sk.over(1.9, -12.6 + dy, hex('#f0e4c8'));
  sk.over(0.9, -12.2 + dy, hex('#1a0e06'));
  hair(sk, [[3.8, -9.0 + dy], [4.7, -8.3 + dy], [4.8, -7.4 + dy]], (t) => hex(t > 0.7 ? '#1a0e06' : '#7a5430'), 0.3);
  hair(sk, [[3.4, -8.4 + dy], [4.9, -7.6 + dy], [5.6, -6.0 + dy], [5.3, -4.9 + dy]], (t) => hex(t < 0.4 ? '#5a3a1c' : t < 0.75 ? '#a88454' : '#d8c49a'), 0.3);
  for (let i = 0; i < 4; i++) leg(i, false);
  return { head: [1.3, -14 + dy] as V2, eye: [1.9, -12.0 + dy] as V2 };
}
function inPoly(P: LP[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  return c;
}
export const HARVESTMAN: SpeciesDef = {
  name: 'Cave Harvestman', kind: 'other', len: 6, height: 12,
  anims: HANIMS,
  canvas: () => ({ w: 56, h: 32, ox: 28, oy: 30 }),
  draw: hdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};

// ================================================================== the Cave Centipede
// A scolopendrid seen side-on and a little from above: the rounded head plate with its long
// segmented feelers, the forcipules (the first legs turned to venom fangs) curving under it with
// black tips, then twenty tergites, each a glossy amber plate banded dark at its rear margin and
// slightly wider at its rear corners (the outline steps at every joint), the pale side membrane under
// them, one pair of legs per segment rippling in a wave, and the spined ultimate legs trailing far
// behind like a second pair of feelers.
const CANIMS = {
  idle: { frames: 2, fps: 2, loop: true },
  walk: { frames: 4, fps: 10, loop: true },
  rear: { frames: 3, fps: 6, loop: true },
  strike: { frames: 3, fps: 12, loop: false },
};
const CSEG = 20;
function cdraw(sk: Sk, anim: string, frame: number) {
  const ph = (frame / (CANIMS[anim as keyof typeof CANIMS]?.frames ?? 1)) * TAU;
  const rear = anim === 'rear' ? 1 : anim === 'strike' ? [1, 0.5, 0.2][frame] : 0;
  const lunge = anim === 'strike' ? [0, 5, 2][frame] : 0;
  const open = anim === 'rear' ? 0.6 + frame * 0.2 : anim === 'strike' ? [1, 0.3, 0][frame] : 0;
  const M = {
    body: sk.m(['#3a1c08', '#5e300e', '#8a4c18', '#b26e26', '#d0903a', '#e8b25c', '#f8d690'].map(c => hex(c)), { edge: 1 }),
    band: sk.m(['#180a04', '#2a1206', '#3e1c0a', '#562a10'].map(c => hex(c)), { edge: 1 }),
    side: sk.m(['#5a3a1c', '#86603a', '#b08a5a', '#d0b080'].map(c => hex(c)), { edge: 1 }),
    head: sk.m(['#2a0e06', '#4a1a0a', '#702a10', '#963e18', '#b85a26', '#d8844a'].map(c => hex(c)), { edge: 1 }),
    fang: sk.m(['#0a0404', '#1e0c08', '#3a1a10', '#7a4a2a'].map(c => hex(c)), { edge: 1 }),
    leg: sk.m(['#6a4a1c', '#9a7432', '#c8a04e', '#e6c674', '#f6e2a6'].map(c => hex(c)), { edge: 1 }),
  };
  // the spine: head first (+x); the front third raised in the threat, a slow sway along it
  const N = 44;
  const sp: V2[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const raise = rear * Math.pow(Math.max(0, 1 - u * 3.2), 1.5) * 10;
    const sway = Math.sin(ph * (anim === 'walk' ? 1 : 0.5) + u * 7) * (anim === 'walk' ? 0.35 : 0.2);
    sp.push([21 + lunge * (1 - u) - u * 44 - raise * 0.25, -4.7 - raise + sway]);
  }
  const cum = cumOf(sp), L = cum[cum.length - 1];
  const H0 = 2.6 / L, segL = (1 - H0 - 0.02) / CSEG;
  /** u along the body -> segment index (-1 = head) and position within it */
  const segOf = (u: number): [number, number] => { if (u < H0) return [-1, u / H0]; const s = (u - H0) / segL; return [Math.min(CSEG - 1, Math.floor(s)), s - Math.floor(s)]; };
  // legs, far side first: a pair per segment in a metachronal wave
  const legs = (far: boolean) => {
    for (let i = 0; i < CSEG - 1; i++) {
      const u = H0 + (i + 0.6) * segL;
      const b0 = pointOn(sp, u, cum), b: V2 = [b0[0], b0[1] + (far ? 0.6 : 1.5)];
      const w = anim === 'walk' ? Math.sin(ph - i * 0.85) : 0;
      const raised = b[1] < -5;
      // each leg kinks out at the knee then down to the ground, the wave running forward along them
      const knee: V2 = [b[0] + (far ? -0.1 : 0.6) + w * 0.5, b[1] + (far ? 0.8 : 1.1)];
      const foot: V2 = raised ? [b[0] + 1.2 + w * 0.5, b[1] + 3.6] : [b[0] + (far ? 0.2 : 0.9) + w * 1.2, -0.4 - (far ? 0.9 : 0) - Math.max(0, -w) * 0.9];
      const z0 = far ? -3 : 4;
      const C = far ? ['#5a3c18', '#7a5426'] : ['#d8b066', '#f0d896'];
      hair(sk, [b, knee], () => hex(C[0]), 0.3, far);
      hair(sk, [knee, foot], (t) => hex(t > 0.7 ? C[1] : C[0]), 0.3, far);
      void z0;
    }
  };
  // the ultimate legs: long, spined, trailing back and up
  const ult = (far: boolean) => {
    const b = pointOn(sp, 0.985, cum);
    const tip: V2 = [b[0] - 8.5 - (far ? 0 : 0.8), b[1] - (far ? 2.2 : 1.0) + Math.sin(ph) * 0.4];
    const mid: V2 = [b[0] - 4.2, b[1] - (far ? 0.6 : 0.1)];
    seg(sk, curve([b, mid, tip], 4), t => (0.62 - t * 0.25), t => (0.55 - t * 0.2), (p, t) => { if (Math.abs(t - 0.45) < 0.06) p.l -= 0.3; return M.leg; },
      { z: far ? -3 : 5, bias: far ? -0.25 : -0.05, spines: far ? undefined : { side: -1, at: [0.2, 0.32, 0.6], len: 0.6, lean: -0.6 } });
  };
  ult(true);
  // the body: one outline swept along the spine, the rear corners of each tergite standing out a hair
  const prof = (u: number, top: boolean) => {
    if (u < H0) return (top ? 1.55 : 1.35) * (0.75 + 0.25 * Math.sin(Math.min(1, u / H0) * Math.PI * 0.5));
    const [i, f] = segOf(u);
    const taper = i > CSEG - 4 ? 1 - (i - (CSEG - 4)) * 0.12 : i < 1 ? 0.9 : 1;
    return (top ? 1.6 : 1.35) * taper * (1 + (f > 0.7 ? 0.13 : f < 0.12 ? -0.07 : 0));
  };
  // (the spine runs head to tail, right to left: the strip's 'up' side is the underside)
  seg(sk, sp, t => prof(t, false), t => prof(t, true), (p, t, cr) => {
    const [i, f] = segOf(t);
    if (i < 0) { if (p.nx > 0) p.l += p.nx * 0.2; return M.head; }
    if (f > 0.62) return M.band;
    if (cr > 0.55) return M.side;
    // a glint down each plate
    if (cr < -0.5 && f > 0.12 && f < 0.5) p.l += 0.1;
    return M.body;
  }, { z: 0, round: 1.1, dome: 0.5, spec: 0.9, specPow: 14, capA: 1, capB: 0.6 });
  legs(true);
  legs(false);
  ult(false);
  // the head: the feelers, the forcipules under it
  const hd = sp[0], hn = sp[2];
  const ha = Math.atan2(hd[1] - hn[1], hd[0] - hn[0]);
  for (const sd of [0, 1]) {
    const pts: V2[] = [];
    let a = (ha - 0.55) * (1 - rear) + -0.55 * rear - sd * 0.35 + Math.sin(ph + sd) * 0.15, q: V2 = [hd[0] + 0.6, hd[1] - 0.8];
    pts.push(q);
    for (let j = 0; j < 14; j++) { a += 0.06 + sd * 0.02; q = [q[0] + Math.cos(a), q[1] + Math.sin(a) * 0.9]; pts.push(q); }
    hair(sk, pts, (t, j) => hex(sd ? (j % 3 === 0 ? '#5a3418' : '#8a5a2c') : (j % 3 === 0 ? '#7a4a20' : t > 0.7 ? '#f0c88a' : '#d8a060'), t > 0.85 ? 160 : 255), 0.4);
  }
  // the forcipules: hooked fangs from under the head, closed or spread, black-tipped
  for (const sd of [1, 0]) {
    const base: V2 = [hd[0] - 0.6, hd[1] + 1.3];
    const spread = open * (sd ? 1.2 : 0.6);
    const m: V2 = [base[0] + 1.8 + spread * 0.4, base[1] + 0.9 + spread];
    const tip: V2 = [base[0] + 3.0 + spread * 0.2, base[1] - 0.1 + spread * 0.6];
    seg(sk, curve([base, m, tip], 4), t => 0.55 - t * 0.3, t => 0.5 - t * 0.28, (p, t) => (t > 0.6 ? M.fang : M.head), { z: sd ? -1 : 3, spec: 0.9, capB: 0.4 });
  }
  return { head: [hd[0], hd[1] - 3] as V2, eye: [hd[0] + 0.5, hd[1] - 0.8] as V2 };
}
export const CENTIPEDE: SpeciesDef = {
  name: 'Cave Centipede', kind: 'other', len: 46, height: 5,
  anims: CANIMS,
  canvas: () => ({ w: 80, h: 34, ox: 40, oy: 26 }),
  draw: cdraw as SpeciesDef['draw'],
  eyeFor: () => 'open',
};

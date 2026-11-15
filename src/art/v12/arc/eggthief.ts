// V12 Te Ara Matatū, chapter 6: the Kaipāhua, the ash robber crab of Motu Ahi (Cinerocarcinus
// praedator).
//
// A land crab the size of a dinner plate across its shell, as heavy as a cat, seen three-quarters from
// the front and a little above. Every part is drawn as its own outline through the real landmarks of a
// brachyuran crab and sculpted from it (beasts-hfield), never stacked from blobs:
//   - the carapace: broader than long, its margin a single contour with the frontal lobes and the notch
//     between them, the eye sockets, four sharp anterolateral teeth ending in the long epibranchial
//     spine, the smooth posterolateral margin and the straight hind edge; the dome raised into its
//     regions (the gastric shield between the eyes, the two swollen gill chambers, the heart plate)
//     divided by the H-shaped grooves; basalt blue-black, gritty with pale granules and tubercles that
//     crowd toward the margin, and the grooves glowing ember, like a crust cracked over cooling lava;
//   - the side wall over the gill chambers, the mouth field with the paired third maxillipeds (fringed,
//     working), the short antennae between the eyes;
//   - stalked eyes, the cornea black and faceted, folding back into their sockets;
//   - four walking legs a side, each merus / carpus / propodus / dactyl as its own outline with the
//     joints pinched and lit ember, spines on the merus, bristles on the propodus and a sharp ember
//     dactyl, the far legs in shadow;
//   - the chelipeds: on the right one enormous crusher, its palm a swollen, flattened contour studded
//     with tubercles and a crest of them along the top, the fixed finger and the movable dactyl each
//     outlined with their blunt ivory molars; on the left a slender picker.
//
// Anims (anchor: the ground under the body's middle, facing right): idle (eyes up, mouthparts working),
// walk, sneak (low, eyes folded, slow), flee (high and flat out), threat (both claws up and spread,
// eyes up), grab (the big claw reaching down and closing on an egg), carry (walking off with the egg
// held high in the big claw), crack (the egg crushed and eaten), flinch (claws snatched in, it
// hunkers and backs), hide (flat, eyes folded, claws over the face).

import { Sk, V2, rmp, SpeciesDef, TAU, hh, gait, ik2 } from '../../beasts-core';
import type { BeastEye, AnimDef } from '../../beasts-core';
import { hex } from '../../color';
import { HField, spline, ribbon, cell, scaleH, fbm, sstep, cl, CELL } from '../../beasts-hfield';
import type { Tx } from '../../beasts-hfield';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
export const THIEF_ANIMS: Record<string, AnimDef> = {
  idle: A(4, 4),
  walk: A(6, 10),
  sneak: A(6, 6),
  flee: A(6, 16),
  threat: A(4, 6),
  grab: A(5, 8, false),
  carry: A(6, 11),
  crack: A(4, 6),
  flinch: A(3, 9, false),
  hide: A(2, 1),
};

interface CP {
  /** body height off the ground, tilt (nose down +) */
  h: number; tilt: number;
  /** gait phase and stride (0 = standing) */
  ph: number; stride: number; lift: number;
  /** eye stalks: 1 up, 0 folded */
  eyes: number;
  /** big claw: reach angle (0 forward, -1 up, +1 down), open 0..1; small claw likewise */
  bigA: number; bigOpen: number; bigLen: number;
  smallA: number; smallOpen: number;
  /** an egg in the big claw: 0 none, 1 whole, 2 cracked */
  egg: number;
  /** mouthparts working */
  mouth: number;
  /** squash (hide) */
  flat: number;
}
function cpose(anim: string, f: number, n: number): CP {
  const t = f / n, s = Math.sin(t * TAU);
  const p: CP = { h: 11, tilt: 0, ph: t, stride: 0, lift: 0, eyes: 1, bigA: -0.3, bigOpen: 0.15, bigLen: 1, smallA: 0.35, smallOpen: 0.2, egg: 0, mouth: 0, flat: 0 };
  switch (anim) {
    case 'idle': p.h = 11 + s * 0.3; p.mouth = f % 2; p.smallA = 0.45 + s * 0.15; p.smallOpen = 0.3 + s * 0.2; break;
    case 'walk': p.stride = 7; p.lift = 3; p.h = 11.4; break;
    case 'sneak': p.stride = 5; p.lift = 1.8; p.h = 8; p.eyes = 0.35; p.tilt = 0.06; p.bigA = 0.35; break;
    case 'flee': p.stride = 10; p.lift = 4; p.h = 12.5; p.tilt = -0.05; p.bigA = -0.2; p.bigOpen = 0; p.smallA = -0.1; break;
    case 'threat': p.h = 13 + s * 0.4; p.tilt = -0.14; p.bigA = -1.2 + s * 0.08; p.bigOpen = 0.7 + s * 0.25; p.smallA = -1.05 - s * 0.1; p.smallOpen = 0.6; p.bigLen = 1.08; break;
    case 'grab': p.h = [11, 9.5, 8, 8, 10][f]; p.tilt = [0.05, 0.16, 0.24, 0.2, 0.06][f]; p.bigA = [0.3, 0.75, 1.05, 0.95, 0.2][f]; p.bigOpen = [0.4, 0.85, 0.75, 0.05, 0.05][f]; p.egg = f >= 3 ? 1 : 0; break;
    case 'carry': p.stride = 7; p.lift = 3; p.h = 11.4; p.bigA = -0.65; p.bigOpen = 0.12; p.egg = 1; break;
    case 'crack': p.h = 9.5; p.tilt = 0.08; p.bigA = [-0.2, -0.05, 0.1, 0.05][f]; p.bigOpen = [0.12, 0.0, 0.2, 0.3][f]; p.egg = f === 0 ? 1 : 2; p.mouth = f % 2; p.smallA = [0.2, 0.0, 0.25, 0.05][f]; p.smallOpen = 0.4; break;
    case 'flinch': p.h = [9, 6.5, 7][f]; p.tilt = [0.1, 0.2, 0.12][f]; p.eyes = [0.4, 0, 0.1][f]; p.bigA = [0.6, 1.15, 1.05][f]; p.bigOpen = 0; p.smallA = 1.1; p.smallOpen = 0; break;
    case 'hide': p.h = 5; p.flat = 1; p.eyes = 0; p.bigA = 1.3; p.bigOpen = 0; p.smallA = 1.25; p.smallOpen = 0; p.tilt = 0.1; break;
  }
  return p;
}

// ---------------------------------------------------------------- the drawing (all in the crab's side view)
// Landmarks are in body space: x forward, y down, origin at the middle of the shell, k = 1.
/** the carapace's outline in profile: the rounded hind margin, the low dome, the anterolateral teeth,
 * the outer orbital tooth and the eye notch, the frontal lobe, the face and the underside */
/** the shell's length in profile against its width */
const SX = 0.74;
const SHELL: V2[] = [
  [-12.8, 3.0], [-13.7, 0.8], [-13.1, -2.2], [-10.7, -4.6], [-6.6, -6.0], [-1.6, -6.6], [3.4, -6.3], [6.9, -5.3],
  [7.7, -5.1], [8.9, -5.8], [8.9, -4.6], [10.0, -4.9], [10.1, -3.8], [11.1, -4.0], [11.1, -3.0], // three teeth
  [11.7, -2.7], [12.6, -2.5], [12.0, -1.5], // the outer orbital tooth and the eye notch
  [12.7, -1.0], [12.5, 0.3], // the frontal lobe
  [11.8, 1.5], [11.2, 2.7], [9.4, 3.7], [5, 4.5], [0, 4.7], [-5, 4.5], [-10, 3.9],
];
/** the lateral margin, a raised rim running back from the eye along the side of the shell */
const RIM: V2[] = [[11.4, -1.7], [8, -0.7], [3, 0.3], [-3, 0.7], [-9, 0.5], [-12.9, -0.6]];
/** the grooves: the cervical groove across the shell, the branchial groove back along the gill chamber */
const GROOVES: V2[][] = [
  [[3.2, -6.4], [1.8, -4.3], [1.3, -2.1], [2.0, -0.4]],
  [[1.4, -3.4], [-3.0, -4.4], [-7.0, -4.1], [-10.2, -2.6]],
  [[6.6, -5.1], [5.0, -3.0], [5.6, -1.0]],
];
/** claw outlines in claw space (u along the claw from the wrist, v toward its upper edge) */
const BIG_PALM: V2[] = [[0, 2.2], [1.4, 3.6], [3.8, 4.2], [6.6, 3.9], [8.6, 2.6], [9.05, 1.4], [9.4, 0.65], [10.2, 0.95], [10.8, 0.55], [11.5, 0.85], [12.2, 0.4], [13.1, 0.35], [14, 0.05], [14.7, -0.3], [14.4, -1.05], [13.2, -1.5], [11.4, -2.1], [9.4, -3.1], [7.4, -4.6], [4.8, -5.2], [2.2, -4.7], [0.6, -3.3], [0, -1.9]];
const BIG_DAC: V2[] = [[8.6, 1.5], [9.3, 2.8], [11.2, 3.2], [13.1, 2.75], [14.6, 1.6], [15.2, 0.55], [14.5, 0.75], [13.7, 1.1], [13.1, 0.95], [12.4, 1.3], [11.6, 1.15], [10.9, 1.45], [10.1, 1.25], [9.3, 1.1]];
const SMALL_PALM: V2[] = [[0, 1.4], [2.5, 2.0], [5.6, 2.1], [7.6, 1.6], [8.2, 0.75], [9.3, 0.6], [11.5, 0.45], [13.6, 0.0], [13.2, -0.65], [11.2, -0.95], [8.6, -1.4], [6, -2.2], [3, -2.3], [0.8, -1.7], [0, -1.2]];
const SMALL_DAC: V2[] = [[7.8, 1.2], [8.6, 1.95], [11, 2.0], [13.4, 1.05], [14, 0.35], [13.1, 0.55], [11, 0.95], [9, 0.95]];

function cdraw(sk: Sk, anim: string, frame: number, _eye: BeastEye, juv: boolean) {
  const n = THIEF_ANIMS[anim]?.frames ?? 1;
  const P = cpose(THIEF_ANIMS[anim] ? anim : 'idle', frame, n);
  const k = juv ? 0.6 : 1;
  const M = {
    shell: sk.m(rmp('#22242f', { n: 8, dark: 0.62, light: 0.48, cool: 0.35, warm: 0.15 }), { edge: 1, bias: -0.16, k: 1.25 }),
    wall: sk.m(rmp('#242331', { n: 6, dark: 0.55, light: 0.38, cool: 0.3, warm: 0.2 }), { edge: 1 }),
    shellD: sk.m(rmp('#1a1a24', { n: 6, dark: 0.55, light: 0.35, cool: 0.3 }), { edge: 1 }),
    grain: sk.m(rmp('#8e8b96', { n: 6, dark: 0.55, light: 0.35, warm: 0.2 }), { edge: 1 }),
    crack: sk.m(rmp('#d0602a', { n: 5, dark: 0.6, light: 0.4, warm: 0.6, cool: 0.1 }), { edge: 0, noRim: true }),
    ember: sk.m(rmp('#b0522a', { n: 6, dark: 0.6, light: 0.38, warm: 0.45, cool: 0.15 }), { edge: 1 }),
    leg: sk.m(rmp('#403a4a', { n: 7, dark: 0.66, light: 0.45, cool: 0.3, warm: 0.25 }), { edge: 1, k: 1.2 }),
    under: sk.m(rmp('#6e5044', { n: 6, dark: 0.55, light: 0.38, warm: 0.3 }), { edge: 1 }),
    mxp: sk.m(rmp('#93694f', { n: 6, dark: 0.55, light: 0.38, warm: 0.3 }), { edge: 1 }),
    ivory: sk.m(rmp('#ddd0b2', { n: 6, dark: 0.55, light: 0.3, warm: 0.25 }), { edge: 1 }),
    tip: sk.m(rmp('#2a2024', { n: 4, dark: 0.45, light: 0.3 }), { edge: 1 }),
    cornea: sk.m(rmp('#14121a', { n: 4, dark: 0.4, light: 0.45, cool: 0.4 }), { edge: 0 }),
    egg: sk.m(rmp('#c4d6ca', { n: 6, dark: 0.45, light: 0.4, cool: 0.2 }), { edge: 1 }),
    eggS: sk.m(rmp('#5e6e58', { n: 4, dark: 0.4, light: 0.3 }), { edge: 0 }),
    yolk: sk.m(rmp('#e8a832', { n: 5, dark: 0.4, light: 0.4, warm: 0.3 }), { edge: 0 }),
  };
  const F = HField.full(sk);
  const flat = P.flat;
  // the body: its middle (the shell's centre) rides the legs; tilt dips the front
  const cy = -(P.h + 3.2 - flat * 2.4) * k;
  const ct = Math.cos(P.tilt), st = Math.sin(P.tilt);
  const sq = 1 - flat * 0.18;
  const B = (x: number, y: number): V2 => [(x * ct - y * sq * st) * k, cy + (x * st + y * sq * ct) * k];
  /** a shell landmark (drawn at the carapace's width) foreshortened to its length in profile */
  const Bs = (x: number, y: number): V2 => B(x * SX, y);
  const Bi = (sx: number, sy: number): V2 => { const x = sx / k, y = (sy - cy) / k; return [x * ct + y * st, (-x * st + y * ct) / sq]; };

  // ---------------------------------------------------------------- one limb segment: its own outline
  const segment = (A2: V2, B2: V2, za: number, zb: number, w0: number, w1: number, mat: (t: number) => number, id: number, bias: number,
    o: { spines?: number[]; bulge?: number; pinch?: number; ridge?: number } = {}) => {
    const dx = B2[0] - A2[0], dy = B2[1] - A2[1], L = Math.hypot(dx, dy) || 1;
    const leftUp = dx > 0 ? true : dx < 0 ? false : dy < 0;
    const bulge = o.bulge ?? 0.15, pinch = o.pinch ?? 0.22;
    const wid = (t: number) => (w0 + (w1 - w0) * t) * (1 + bulge * Math.sin(Math.PI * Math.pow(t, 0.8))) * (1 - pinch * (sstep(0.86, 1, t) + sstep(0.14, 0, t))) * k;
    const sp = (t: number) => { let v = 0; for (const c of o.spines ?? []) v = Math.max(v, 0.9 * k * (1 - Math.abs(t - c) / 0.05)); return v; };
    const up = (t: number) => wid(t) + sp(t);
    const contour = ribbon([A2, B2], leftUp ? up : wid, leftUp ? wid : up, Math.max(8, Math.ceil(L * 3)), 0.6, 0.6);
    const tOf = (x: number, y: number) => cl(((x - A2[0]) * dx + (y - A2[1]) * dy) / (L * L));
    F.inflate(contour, Math.max(w0, w1) * k * 1.15, (x, y) => za + (zb - za) * tOf(x, y), id, 0, (x, y, d, s, tx) => {
      tx.m = mat(tOf(x, y));
      tx.t = bias;
      // a ridge catching the light along the segment, the cuticle pitted
      if (o.ridge && s > 0.85) tx.z += o.ridge;
    }, 0.85);
  };

  // ---------------------------------------------------------------- the walking legs
  const legPts = (i: number, near: boolean) => {
    const hip = B(...((near ? [[5.4, 4.1], [2.2, 4.6], [-1.4, 4.6], [-4.6, 4.1]] : [[6.0, 3.3], [2.8, 3.8], [-0.8, 3.8], [-4.0, 3.3]])[i] as V2));
    const phase = P.ph + (i % 2) * 0.5 + (near ? 0.5 : 0);
    const g = P.stride ? gait(phase, 0.55, P.stride * k, P.lift * k) : [0, 0];
    const fx = (near ? [16, 7, -6.5, -16] : [14, 5, -4.5, -14])[i] * (1 + flat * 0.12);
    const foot: V2 = [fx * k + g[0], (near ? 0 : -1.4 * k) + g[1]];
    // every merus climbs from its hip to a knee standing above it, fanned fore and aft: the first pair
    // reaching forward, the last trailing back; then the leg drops to its point (the crab's arch)
    const kx = (near ? [5.6, 2.2, -2.4, -5.8] : [5.0, 1.8, -1.8, -5.0])[i] * (1 + flat * 0.4);
    const ky = (near ? [-3.6, -4.4, -4.4, -3.4] : [-4.6, -5.2, -5.2, -4.4])[i] * (1 - flat * 0.75);
    const knee: V2 = [hip[0] + kx * k, hip[1] + ky * k + g[1] * 0.4];
    const [ankle] = ik2(knee, foot, 6.4 * k, 5.6 * k, foot[0] > knee[0] ? -1 : 1);
    const carp: V2 = [knee[0] + (ankle[0] - knee[0]) * 0.3, knee[1] + (ankle[1] - knee[1]) * 0.3];
    return { hip, knee, carp, ankle, foot };
  };
  const drawLeg = (i: number, near: boolean, id: number) => {
    const L = legPts(i, near);
    const z = near ? 5 : -6, bias = near ? -0.02 - i * 0.025 : -0.22;
    segment(L.hip, L.knee, z - 1, z, 0.9, 0.8, (t) => (t > 0.9 ? M.ember : M.leg), id, bias, { spines: near ? [0.62] : [], bulge: 0.3, ridge: 0.35 });
    segment(L.knee, L.carp, z, z + 0.3, 0.7, 0.66, (t) => (t < 0.35 ? M.ember : M.leg), id, bias, { bulge: 0.2, ridge: 0.2 });
    segment(L.carp, L.ankle, z + 0.3, z + 0.5, 0.64, 0.52, (t) => (t > 0.9 ? M.ember : M.leg), id, bias, { ridge: 0.2 });
    segment(L.ankle, L.foot, z + 0.5, z + 0.6, 0.5, 0.05, (t) => (t > 0.55 ? M.ember : M.leg), id, bias + 0.04, { pinch: 0, bulge: 0.1 });
    return L;
  };

  // ---------------------------------------------------------------- the chelipeds
  const claw = (big: boolean) => {
    const sc = (big ? 0.92 : 0.58) * k;
    const id = big ? 60 : 50;
    const z = big ? 7 : -3, bias = big ? 0.02 : -0.14;
    const a = big ? P.bigA : P.smallA;
    const base = Bs(...((big ? [9.6, 3.4] : [10.2, 2.4]) as V2));
    const dir: V2 = [Math.cos(a), Math.sin(a)], up: V2 = [Math.sin(a), -Math.cos(a)];
    const elbow: V2 = [base[0] + (2.6 - Math.max(0, a) * 1.4) * k, base[1] + (1.6 + a * 1.2) * k];
    const reach = (big ? P.bigLen : 1) * 1.6 * sc;
    const wrist: V2 = [elbow[0] + dir[0] * reach - up[0] * 0.6 * sc, elbow[1] + dir[1] * reach - up[1] * 0.6 * sc];
    segment(base, elbow, z - 1, z, big ? 1.5 : 1.0, big ? 1.4 : 0.9, (t) => (t > 0.84 ? M.ember : M.leg), id, bias, { spines: [0.55], bulge: 0.3, ridge: 0.3 });
    segment(elbow, wrist, z, z + 0.5, big ? 1.5 : 0.9, big ? 1.8 : 1.0, (t) => (t < 0.25 ? M.ember : M.leg), id + 1, bias, { spines: [0.5], bulge: 0.4, ridge: 0.3 });
    const cs = (u: number, v: number): V2 => [wrist[0] + (dir[0] * u + up[0] * v) * sc, wrist[1] + (dir[1] * u + up[1] * v) * sc];
    const palm = big ? BIG_PALM : SMALL_PALM, dac = big ? BIG_DAC : SMALL_DAC;
    const open = (big ? P.bigOpen : P.smallOpen) * 0.75;
    const hinge: V2 = big ? [8.7, 1.6] : [7.9, 1.2];
    const uOf = (x: number, y: number) => ((x - wrist[0]) * dir[0] + (y - wrist[1]) * dir[1]) / sc;
    const vOf = (x: number, y: number) => ((x - wrist[0]) * up[0] + (y - wrist[1]) * up[1]) / sc;
    // the palm and the fixed finger: one outline, a heavy flattened hand studded with tubercles
    F.inflate(palm.map(q => cs(q[0], q[1])), (big ? 3.4 : 2) * sc, z + 1, id + 2, 0, (x, y, d, s, tx) => {
      const u = uOf(x, y), v = vOf(x, y);
      tx.m = M.shell;
      tx.t = bias;
      if (u > 9.3) { tx.m = u > 13.5 ? M.tip : M.ivory; if (u < 13 && hh(Math.floor(u * 1.4), 1, 89) > 0.6 && v > -0.2) tx.z -= 0.25; return; }
      // tubercles in rows down the outer face, a crest of bigger ones along the top
      const row = Math.round(v / 1.25), off = (row % 2) * 0.7;
      const du = ((u + off) / 1.4) % 1 - 0.5, dv = v / 1.25 - row;
      const r2 = du * du * 4 + dv * dv * 4;
      if (r2 < 1 && big) { tx.z += (1 - r2) * (v > 1.8 ? 0.6 : 0.3); if (r2 < 0.25 && v > 1.8 && hh(Math.round(u * 2), row, 91) > 0.3) tx.m = M.grain; }
      // the underside of the hand ember toward the finger
      if (v < -3.4 && u > 4) tx.m = M.ember;
    }, 0.7);
    // the movable finger, swung open about its hinge, molars along its cutting edge
    const ca = Math.cos(-open), sa = Math.sin(-open);
    const rotD = (q: V2): V2 => { const du = q[0] - hinge[0], dv = q[1] - hinge[1]; return [hinge[0] + du * ca + dv * sa, hinge[1] - du * sa + dv * ca]; };
    const dP = dac.map(q => cs(...rotD(q)));
    const tip2 = dP[5];
    F.inflate(dP, (big ? 1.5 : 0.9) * sc, z + 1.8, id + 3, 0, (x, y, d, s, tx) => {
      tx.m = Math.hypot(x - tip2[0], y - tip2[1]) < 2.4 * sc ? M.tip : M.ivory;
      tx.t = bias + 0.04;
    }, 0.8);
    if (big && P.egg) {
      const ec = cs(12.4, 1.4 + open * 3.2);
      if (P.egg === 1) {
        const eggC: V2[] = [];
        for (let i = 0; i < 22; i++) { const th = (i / 22) * TAU, r = 1 + 0.13 * Math.sin(th); eggC.push([ec[0] + Math.cos(th) * 2.9 * k, ec[1] + Math.sin(th) * 3.6 * r * k]); }
        F.inflate(eggC, 3 * k, z + 2, 70, 0, (x, y, d, s, tx) => {
          tx.m = M.egg;
          if (fbm(x * 0.7, y * 0.7, 41, 2) > 0.64 || hh(x, y, 43) > 0.9) tx.m = M.eggS;
        }, 0.9);
      } else {
        const sh: V2[] = spline([[ec[0] - 3, ec[1] + 1], [ec[0] - 1, ec[1] - 1.5], [ec[0] + 2, ec[1] - 0.8], [ec[0] + 3, ec[1] + 1.2], [ec[0] + 1, ec[1] + 2.4], [ec[0] - 2, ec[1] + 2.2]], 3, true);
        F.inflate(sh, 1.5 * k, z + 2, 70, 0, (x, y, d, s, tx) => { tx.m = hh(Math.floor(x / 1.5), Math.floor(y / 1.5), 47) > 0.55 ? M.egg : M.yolk; }, 0.6);
      }
    }
  };

  // ---------------------------------------------------------------- far side, then the body, then the near side
  for (let i = 0; i < 4; i++) drawLeg(i, false, 1 + i);
  claw(false);
  // the far eye stalk
  const eyeTip = (near: boolean): V2 => {
    const e = P.eyes;
    const b = Bs(...((near ? [10.3, -3.4] : [9.5, -4.2]) as V2));
    return e > 0.12 ? [b[0] + (0.5 + e * 0.6) * k, b[1] - (0.6 + e * 4.4) * k] : [b[0] + 1.6 * k, b[1] + 0.2 * k];
  };
  const eyeStalk = (near: boolean) => {
    const b = Bs(...((near ? [10.3, -3.4] : [9.5, -4.2]) as V2)), t = eyeTip(near);
    const z = near ? 3.6 : -1;
    segment(b, t, z, z + 0.4, 0.72, 0.62, () => M.ember, near ? 80 : 81, near ? 0 : -0.12, { pinch: 0.08, bulge: 0.1 });
    const cor = spline([[t[0] - 1.0, t[1] + 0.2], [t[0] - 0.5, t[1] - 1.2], [t[0] + 0.7, t[1] - 1.3], [t[0] + 1.2, t[1] - 0.1], [t[0] + 0.3, t[1] + 0.7]], 2, true);
    F.inflate(cor, 1.0, z + 0.6, near ? 82 : 83, 0, (x, y, d, s, tx) => { tx.m = M.cornea; tx.t = near ? 0 : -0.1; }, 0.9);
  };
  eyeStalk(false);
  // ---- the shell
  const shellOut = spline(SHELL.map(q => Bs(q[0], q[1])), 3, true);
  const rimS = spline(RIM.map(q => Bs(q[0], q[1])), 4);
  F.inflate(shellOut, 6.2 * k, 0, 10, 0, (x, y, d, s, tx) => {
    const [bx0, by] = Bi(x, y), bx = bx0 / SX;
    // below the rim: the side wall over the gill chamber, darker, wrinkled, rusty along the underside
    const rimY = crvRim(bx);
    if (by > rimY + 0.4) {
      tx.m = by > 3.6 ? M.under : M.wall;
      tx.t = -0.14;
      if (Math.sin(bx * 1.9 + fbm(bx * 0.5, by, 3) * 2.5) > 0.72) tx.z -= 0.3;
      if (hh(Math.round(bx * 1.3), Math.round(by * 1.3), 101) > 0.9) { tx.z += 0.3; }
      return;
    }
    tx.m = M.shell;
    // the crust: grit everywhere, pale tubercles in loose rows that crowd toward the rim and the teeth
    cell(bx * 1.3, by * 1.6, 1.25, 1.25, 113, 0.75);
    const gr = scaleH(2.4);
    const crowd = sstep(-3, rimY, by) * 0.45 + sstep(4, 11, bx) * 0.3;
    if (gr > 0.45 && CELL.h < 0.45 + crowd) {
      tx.z += 0.34 * gr;
      if (gr > 0.82 && CELL.h < 0.08 + crowd * 0.4) tx.m = M.grain;
    }
  }, 0.62);
  // the regions swell; the rim stands proud with a shadowed undercut; the grooves are cut in
  const bumpB = (x: number, y: number, rx: number, ry: number, h: number) => { const q = Bs(x, y); F.bump(q[0], q[1], rx * SX * k, h, 0, 0, ry * k, 10); };
  bumpB(6.6, -3.0, 3.2, 2.6, 1.0); bumpB(-3.5, -2.2, 6, 3.4, 1.1); bumpB(-9.5, -2.8, 3, 2.4, 0.6); bumpB(1.5, -5.4, 3, 1.6, 0.5);
  F.groove(rimS, 1.1 * k, -0.7, 0, 0.08, 10);
  F.groove(rimS.map(q => [q[0], q[1] + 1.1 * k] as V2), 0.8 * k, 0.7, M.shellD, -0.1, 10);
  const grooveS = GROOVES.map(g => spline(g.map(q => Bs(q[0], q[1])), 4));
  grooveS.forEach((g, i) => F.groove(g, 0.95 * k, i === 2 ? 0.45 : 0.85, 0, -0.06, 10));
  // the eye socket under the stalk, the face and the mouth field with its fringed plates
  { const q = Bs(11.4, -1.9); F.bump(q[0], q[1], 1.3 * k, -0.6, M.shellD, -0.06, 1 * k, 10); }
  const mo = P.mouth ? 0.5 : 0;
  const mxp = spline([[11.0, 0.8], [12.4, 0.6], [13.0, 2.2 + mo], [12.5, 3.9 + mo], [11.2, 3.7 + mo]].map(q => Bs(q[0], q[1])), 3, true);
  F.inflate(mxp, 1.1 * k, 2.2, 12, 0, (x, y, d, s, tx) => {
    const [bx, by] = Bi(x, y);
    tx.m = M.mxp;
    if (Math.floor(by * 1.4 + 20) % 2 === 0) tx.z -= 0.25;
    if (d < 0.8 && bx > 12 * SX) tx.m = M.grain;
  }, 0.6);
  eyeStalk(true);
  for (let i = 3; i >= 0; i--) drawLeg(i, true, 20 + i);
  claw(true);

  sk.np();
  F.emit({ seam: 0.9, seamDark: 0.34, ao: 0.08, aoR: 2, shadow: 0.24, shadowR: 9,
    spec: (m) => (m === M.cornea ? 1 : m === M.ivory ? 0.3 : m === M.egg ? 0.3 : m === M.shell || m === M.leg ? 0.2 : 0.08), specPow: 12 });

  // the cracks between the shell's regions: a thread of ember glowing in the depth of each groove
  for (let gi = 0; gi < 1; gi++) {
    const g = grooveS[gi];
    for (let i = 0; i < g.length; i++) {
      const q = g[i];
      if (F.idAt(q[0], q[1]) !== 10) continue;
      const v = hh(Math.floor(q[0]), Math.floor(q[1]), 131 + gi);
      sk.paint(q[0], q[1], v > 0.55 ? M.crack : M.shellD, 0, 0);
      const ii = sk.idx(q[0], q[1]);
      if (ii >= 0) sk.lum[ii] = v > 0.55 ? 0.25 + (v - 0.55) * 0.9 : 0.3;
    }
  }
  // overlays: the antennae, the eye glint, setae fringing the legs, dust
  {
    const b = Bs(12.4, -0.8);
    for (let i = 1; i <= 4; i++) sk.over(b[0] + i * 0.55, b[1] - i * 0.7 + Math.sin(frame * 1.7 + i) * 0.35, hex(i < 3 ? '#7a5040' : '#4a3430', 230));
  }
  if (P.eyes > 0.12) { const t = eyeTip(true); sk.over(t[0] + 0.1, t[1] - 1.0, hex('#e2eaf6')); }
  for (let i = 0; i < 4; i++) {
    const L = legPts(i, true);
    for (let q = 0.25; q < 0.95; q += 0.25) {
      const x = L.carp[0] + (L.ankle[0] - L.carp[0]) * q, y = L.carp[1] + (L.ankle[1] - L.carp[1]) * q;
      const side = L.foot[0] > L.knee[0] ? 1 : -1;
      sk.over(x + side * 1.5, y - 0.4, hex('#8a6a50', 200));
    }
  }
  if (P.stride >= 9) for (let i = 0; i < 6; i++) sk.over(-16 - hh(i, frame, 61) * 9, -hh(i, frame, 63) * 3, hex('#8a8478', 150));
  const E = eyeTip(true);
  return { head: [E[0], E[1] - 3] as V2, eye: E };
}
/** the rim's height along the shell (body space) */
function crvRim(x: number) {
  for (let i = 1; i < RIM.length; i++) {
    const a = RIM[i - 1], b = RIM[i];
    if (x <= a[0] && x >= b[0]) return a[1] + (b[1] - a[1]) * ((a[0] - x) / (a[0] - b[0]));
  }
  return x > RIM[0][0] ? RIM[0][1] : RIM[RIM.length - 1][1];
}

export const EGGTHIEF: SpeciesDef = {
  name: 'Kaipāhua', kind: 'crustacean', len: 34, height: 18,
  anims: THIEF_ANIMS,
  canvas: () => ({ w: 90, h: 60, ox: 45, oy: 44 }),
  draw: cdraw,
  eyeFor: () => 'open',
};

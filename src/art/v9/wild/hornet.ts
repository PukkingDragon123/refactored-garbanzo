// V9 jewel hornets: fruit-eating hornets whose colours are structural, painted from real vespid
// anatomy with the beast sketch core:
//  - the head: hypognathous (the face points down), a big emarginate (kidney-notched) gold compound
//    eye with a facet lattice and a wet glint, a broad violet gena behind it, three ocelli on the
//    vertex, a gold clypeus with its suture, saw-toothed mandibles, and elbowed antennae (a long scape,
//    then a ringed flagellum) rising from the eye notch;
//  - the mesosoma: the pronotal collar, the domed mesoscutum (punctate, with paired gold lines), the
//    gold scutellum, the side plate (mesopleuron) and the striate propodeum, the amber tegula over the
//    wing base and a fuzz of short setae on the dorsal outline;
//  - the petiole, then the gaster as six telescoped tergites, each overlapping the next, iridescent at
//    the base (the hue swings teal -> blue -> violet with the surface angle, like a soap film) and
//    ending in a gold apical band, the tergite/sternite seam down the side, the sting at the tip;
//  - three pairs of jointed legs (coxa, femur, tibia with its apical spur, five tarsomeres, claws),
//    the far legs darker behind the body;
//  - veined wings: costa, subcosta, the dark stigma, the radial and submarginal cells and the long
//    cubital veins, a smoky costal stripe and a thin-film sheen. At rest they fold along the back.
// World frames are tiny (about 13 x 8 px): two wingbeat frames, perched with the wings folded (and
// chewing a berry, mandibles working), and the dead hornet the zombie-cap fungus leaves clamped to a
// twig: the colour gone dull, white mycelium bursting from every joint, and the fungal stalk breaking
// out between the thorax plates, ending in an orange fertile knob pocked with flask-shaped perithecia.
// A bigger version paints the field-guide portraits. All face right; anchor = body centre.

import { Sk, rmp, SpeciesDef, BeastEye, V2, hh } from '../../beasts-core';
import { Field, strip, spline } from './contour';
import type { LP, FP, StripOpt } from './contour';
import { hex } from '../../color';
import type { C } from '../../color';
import type { PixelBuffer } from '../../pixel';

export interface HornetFrame { buf: PixelBuffer; ax: number; ay: number }

type HPose = 'up' | 'down' | 'perch' | 'chew' | 'dead';

function mats(sk: Sk, dead: boolean) {
  // the dead hornet's structural colour has gone: dull, dusty, mycelium-grey
  const d = (live: string, gone: string) => (dead ? gone : live);
  return {
    // structural colour as hand-picked hue-shifted ramps: violet in the shadows, through blue and teal,
    // to a green-gold sheen where the cuticle faces the light
    iriT: sk.m((dead ? ['#140f12', '#201a1c', '#2e2626', '#3c322e', '#4c4038', '#5e5044', '#726252', '#887662'] : ['#120a28', '#1c1648', '#1e2a6a', '#17488a', '#126a90', '#169090', '#3ab0a0', '#8ed2b0']).map(c => hex(c)), { edge: 1 }),
    iriG: sk.m((dead ? ['#160f12', '#241a1c', '#342624', '#44322c', '#564034', '#6a5040', '#80624c', '#98765a'] : ['#140a2c', '#26124e', '#381c78', '#30359a', '#2252a8', '#1c78a8', '#2a9ea6', '#7cc8c0']).map(c => hex(c)), { edge: 1 }),
    gold: sk.m(rmp(d('#f2b21e', '#a8864a'), { n: 6, dark: 0.62, light: 0.4, warm: 0.4 }), { edge: 1 }),
    lemon: sk.m(rmp(d('#f6d24a', '#a89a70'), { n: 6, dark: 0.55, light: 0.45, warm: 0.3 }), { edge: 1 }),
    ochre: sk.m(rmp(d('#b8741a', '#7a5a3a'), { n: 5, dark: 0.6, light: 0.35 }), { edge: 1 }),
    eye: sk.m(rmp(d('#e8a428', '#8a6a3a'), { n: 6, dark: 0.55, light: 0.55, warm: 0.4, cool: 0.2 }), { edge: 1, noRim: true }),
    dark: sk.m(rmp(d('#2a1c3a', '#3a3438'), { n: 4, dark: 0.5, light: 0.5 }), { edge: 1 }),
    leg: sk.m(rmp(d('#c88428', '#8a6a48'), { n: 5, dark: 0.6, light: 0.42, warm: 0.3 }), { edge: 1 }),
    legD: sk.m(rmp(d('#7a4418', '#6a5a44'), { n: 4, dark: 0.55, light: 0.4 }), { edge: 1 }),
    mand: sk.m(rmp(d('#9a5a1c', '#7a6a52'), { n: 5, dark: 0.6, light: 0.45, warm: 0.3 }), { edge: 1 }),
    sting: sk.m(rmp(d('#3a1e14', '#4a4038'), { n: 4, dark: 0.5, light: 0.5 }), { edge: 1 }),
    myc: sk.m(rmp('#efe8dc', { n: 5, dark: 0.32, light: 0.6, warm: 0.2 }), { edge: 0 }),
    stalk: sk.m(rmp('#e2d2b0', { n: 6, dark: 0.5, light: 0.45, warm: 0.3 }), { edge: 1 }),
    stalk2: sk.m(rmp('#c89a62', { n: 6, dark: 0.55, light: 0.4, warm: 0.3 }), { edge: 1 }),
    knob: sk.m(rmp('#e8642a', { n: 6, dark: 0.6, light: 0.45, warm: 0.4 }), { edge: 1 }),
    knobPore: sk.m(rmp('#7a2a14', { n: 4, dark: 0.5, light: 0.35 }), { edge: 0, noRim: true }),
    bark: sk.m(rmp('#6a4a30', { n: 6, dark: 0.6, light: 0.38, cool: 0.3 }), { edge: 1 }),
    barkL: sk.m(rmp('#9a7a52', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    lichen: sk.m(rmp('#a8b878', { n: 4, dark: 0.45, light: 0.4 }), { edge: 0 }),
    berry: sk.m(rmp('#c01c34', { n: 5, dark: 0.6, light: 0.5, warm: 0.2 }), { edge: 1 }),
  };
}
type HMats = ReturnType<typeof mats>;

/** structural colour: one hue-shifted ramp, so the hue swings with the light; phase shifts it */
function irid(M: HMats, p: { l: number }, phase = 0, gaster = false): number {
  p.l += phase * 0.35;
  return gaster ? M.iriG : M.iriT;
}

/** body-space -> canvas transform: scale k, rotation (rad, + turns the head down), offset */
interface Xf { k: number; c: number; s: number; dx: number; dy: number; rot: number }
const xf = (k: number, rot: number, dx: number, dy: number): Xf => ({ k, c: Math.cos(rot), s: Math.sin(rot), dx, dy, rot });
const P = (T: Xf, x: number, y: number): V2 => [(x * T.c - y * T.s) * T.k + T.dx, (x * T.s + y * T.c) * T.k + T.dy];

interface Pose { rot: number; bend: number; legs: 'fly' | 'stand' | 'grip'; mandOpen: number; antUp: number }
function poseOf(p: HPose): Pose {
  switch (p) {
    case 'up': case 'down': return { rot: -0.08, bend: 0.12, legs: 'fly', mandOpen: 0, antUp: 0.15 };
    case 'perch': return { rot: 0, bend: 0.1, legs: 'stand', mandOpen: 0.1, antUp: 0 };
    case 'chew': return { rot: 0.06, bend: 0.12, legs: 'stand', mandOpen: 1, antUp: -0.2 };
    case 'dead': return { rot: 0.3, bend: 0.8, legs: 'grip', mandOpen: 0.35, antUp: -0.9 };
  }
}

/** the twig the dead hornet is clamped to (canvas space, before the portrait offset) */
const twigY = (x: number, k: number) => (2.05 - x * 0.06) * k;

// ---------------------------------------------------------------- landmarks (body space, k = 1)
// x forward (right), y down; the body centre is the origin.
/** the head capsule in lateral view: hypognathous, the face sloping down to the clypeus */
const HEAD: LP[] = [[3.12, -1.0], [3.5, -1.6], [4.08, -1.8], [4.6, -1.5], [4.98, -0.9], [5.14, -0.18], [5.2, 0.48], [5.0, 1.04], [4.58, 1.34], [4.02, 1.3], [3.5, 1.02], [3.12, 0.46], [2.98, -0.3]];
/** the compound eye: a kidney, emarginate where the antenna rises */
const EYE: LP[] = [[3.7, -1.38], [4.2, -1.5], [4.56, -1.16], [4.64, -0.74], [4.4, -0.5], [4.62, -0.18], [4.68, 0.36], [4.44, 0.8], [4.0, 0.9], [3.66, 0.52], [3.5, -0.2], [3.52, -0.9]];
/** the clypeus shield */
const CLYP: LP[] = [[4.72, 0.06], [5.14, 0.16], [5.18, 0.7], [4.98, 1.06], [4.56, 1.26], [4.42, 0.82]];
/** the mesosoma: pronotal collar, the domed scutum, the scutellum's step, the propodeum's slope */
const MESO: LP[] = [[3.02, -0.86], [2.78, -1.42], [2.26, -1.88], [1.55, -2.14], [0.76, -2.12], [0.26, -1.92], [0.05, -2.0], [-0.36, -1.84], [-0.64, -1.56], [-1.06, -1.12], [-1.38, -0.5], [-1.44, 0.04], [-1.02, 0.6], [-0.2, 0.96], [0.9, 1.2], [1.96, 1.06], [2.62, 0.76], [3.02, 0.26]];
const MESO_SUT: V2[][] = [
  [[2.56, -1.68], [2.26, -1.0], [2.34, -0.2], [2.46, 0.72]],   // pronotum / mesonotum
  [[0.42, -1.96], [0.16, -1.66], [-0.16, -1.64], [-0.42, -1.78]], // scuto-scutellar
  [[1.95, -0.52], [1.22, 0.02], [0.62, 0.92]],                  // mesopleural
  [[-0.56, -1.52], [-0.36, -0.6], [-0.22, 0.9]],                // propodeal
];
/** the gaster: six tergites along a curved axis; s = arc length (k units) */
const SEG_END = [1.15, 2.78, 3.98, 4.96, 5.78, 6.55];
const gR = (s: number, dorsal: boolean) => {
  // the dorsal and ventral half-widths: a bell from the petiole, deepest at T2, tapering to the sting
  const bell = s < 1.15 ? 0.42 + Math.sin((s / 1.15) * Math.PI * 0.5) * 1.0 : s < 2.9 ? 1.42 + Math.sin(((s - 1.15) / 1.75) * Math.PI * 0.5) * 0.3 : 1.72 * Math.cos(((s - 2.9) / 3.75) * Math.PI * 0.5) ** 0.85 + 0.08;
  return bell * (dorsal ? 1 : 0.86);
};

/** draw one hornet at scale k (1 = world). (ox, oy) shifts the body centre (portraits). */
function drawHornet(sk: Sk, pose: HPose, k: number, ox = 0, oy = 0) {
  const dead = pose === 'dead';
  const M = mats(sk, dead);
  const Q = poseOf(pose);
  const T = xf(k, Q.rot, ox, oy);
  const big = k >= 2.4;
  const tiny = k < 1.6;
  const map = (pts: LP[], f?: (x: number, y: number) => V2): LP[] => pts.map(q => { const [x, y] = f ? f(q[0], q[1]) : [q[0], q[1]]; const r = P(T, x, y); return q[2] ? [r[0], r[1], 1] : [r[0], r[1]]; });
  const mapV = (pts: V2[], f?: (x: number, y: number) => V2): V2[] => pts.map(q => { const [x, y] = f ? f(q[0], q[1]) : q; return P(T, x, y); });
  // micro-sculpture: fine punctation as displacement, so every pit catches the light
  const punct = (F: Field, seed: number, amt: number, cell: number) => {
    if (!big) return;
    F.add((x, y) => {
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      if (hh(gx, gy, seed) > 0.42) return 0;
      const cx = (gx + 0.5 + (hh(gx, gy, seed + 1) - 0.5) * 0.5) * cell, cy = (gy + 0.5 + (hh(gy, gx, seed + 2) - 0.5) * 0.5) * cell;
      const q = ((x - cx) ** 2 + (y - cy) ** 2) / (cell * cell * 0.09);
      return q < 1 ? -amt * (1 - q) : 0;
    });
  };

  // ---------------------------------------------------------------- the twig (zombie-cap)
  if (dead) {
    sk.np();
    const path: V2[] = [];
    for (let i = 0; i <= 16; i++) { const x = -9.5 + i * 1.0; path.push([x * k + ox, twigY(x, k) + oy + Math.sin(i * 1.3) * 0.08 * k]); }
    const F = new Field(sk, [strip(path, t => (0.62 + 0.1 * Math.sin(t * 11) - t * 0.08) * k, t => (0.6 + 0.08 * Math.cos(t * 7)) * k, { capA: 0.2, capB: 0.6 })], { round: 0.7 * k, dome: 0.1 * k });
    if (big) F.add((x, y) => { const f = Math.sin(x * 0.75 + Math.sin(x * 0.21) * 2.2 + y * 1.6); return f > 0.75 ? -0.5 : f < -0.85 ? 0.25 : 0; });
    F.emit((p) => {
      if (big && hh(p.x * 0.45, p.y * 0.7, 41) < 0.05 && p.ny < 0) return M.lichen;
      if (big && hh(p.x, p.y, 43) < 0.08) p.l += 0.12;
      return p.ny > 0.35 ? M.bark : p.nz > 0.9 && hh(p.x * 0.6, p.y, 44) < 0.3 ? M.barkL : M.bark;
    }, { z: -3 * k, zk: 0.6 });
    // a bud scar
    sk.np();
    const bx = -5.4 * k + ox, by = twigY(-5.4, k) + oy - 0.55 * k;
    const B = new Field(sk, [spline([[bx - 0.55 * k, by + 0.4 * k], [bx - 0.3 * k, by - 0.25 * k], [bx + 0.35 * k, by - 0.35 * k], [bx + 0.6 * k, by + 0.35 * k]], true, 5)], { round: 0.4 * k });
    B.emit(() => M.barkL, { z: -2 * k });
  }

  // ---------------------------------------------------------------- legs
  const leg = (hip: V2, knee: V2, ank: V2, tip: V2, far: boolean, i: number) => {
    const bias = far ? -0.18 : 0, z0 = far ? -4 * k : 7.5 * k;
    if (tiny) {
      sk.np();
      sk.line(hip[0], hip[1], knee[0], knee[1], M.legD, 0.45 + bias, z0, false);
      sk.line(knee[0], knee[1], ank[0], ank[1], M.leg, 0.5 + bias, z0, false);
      if (!far) sk.line(ank[0], ank[1], tip[0], tip[1], M.leg, 0.4, z0, false);
      return;
    }
    const r = k * (i === 2 ? 1.1 : 1);
    const seg = (a: V2, b: V2, up: (t: number) => number, dn: (t: number) => number, z: number, fill: (p: FP, t: number) => number, o: StripOpt = {}) => {
      sk.np();
      const c = strip([a, b], up, dn, { capA: 0.9, capB: 0.9, ...o });
      const F = new Field(sk, [c], { round: Math.max(0.6, up(0.5) * 0.9), dome: up(0.5) * 0.3 });
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      F.emit((p) => fill(p, ((p.x - a[0]) * (b[0] - a[0]) + (p.y - a[1]) * (b[1] - a[1])) / (L * L)), { z, bias, spec: big ? 0.25 : 0 });
    };
    const lerpP = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const kneeIn = lerpP(hip, knee, 0.22);
    // coxa: a stout iridescent plate; the femur, flattened and swollen; the tibia, widening to its spurs
    seg(hip, kneeIn, t => (0.34 - t * 0.08) * r, t => (0.3 - t * 0.06) * r, z0, (p) => irid(M, p, -0.2));
    seg(kneeIn, knee, t => (0.2 + Math.sin(t * Math.PI) * 0.09) * r, t => (0.18 + Math.sin(t * Math.PI) * 0.06) * r, z0 + 0.3 * k, (p, t) => {
      if (t < 0.12) return M.legD;
      return p.ny > 0.5 ? M.legD : M.leg;
    });
    seg(knee, ank, t => (0.14 + t * 0.07) * r, t => (0.13 + t * 0.06) * r, z0 + 0.6 * k, (p, t) => (t > 0.94 ? M.legD : M.leg),
      big ? { spines: { side: -1, at: [0.62, 0.96], len: 0.32 * k, lean: 0.8 } } : {});
    // five tarsomeres: a long basitarsus then four short beads, the last one with its claws
    const fr = [0, 0.42, 0.58, 0.72, 0.85, 1];
    for (let j = 0; j < 5; j++) {
      const a = lerpP(ank, tip, fr[j]), b = lerpP(ank, tip, fr[j + 1]);
      seg(a, b, t => (0.12 - j * 0.008 + t * 0.03) * r, t => (0.1 - j * 0.008 + t * 0.025) * r, z0 + (0.8 + j * 0.06) * k, (p, t) => (t > 0.8 ? M.legD : M.leg));
    }
    const dx = tip[0] - ank[0], dy = tip[1] - ank[1], L = Math.hypot(dx, dy) || 1;
    sk.np();
    const cl = strip(spline([tip, [tip[0] + dx / L * 0.28 * k, tip[1] + dy / L * 0.28 * k + 0.12 * k], [tip[0] + dx / L * 0.36 * k + 0.05 * k, tip[1] + dy / L * 0.2 * k + 0.4 * k]], false, 4), t => (1 - t) * 0.09 * r + 0.05, t => (1 - t) * 0.06 * r + 0.05, { capB: 0 });
    new Field(sk, [cl], { round: 0.5 }).emit(() => M.sting, { z: z0 + 1.2 * k, bias });
  };
  const legsDraw = (far: boolean) => {
    const fx = far ? 0.34 : 0, fy = far ? -0.14 : 0;
    if (Q.legs === 'grip') {
      // clutching the twig: the tarsi hooked over the bark
      const hips: V2[] = [[2.4, 0.85], [1.25, 1.0], [0.2, 0.85]];
      const tx = [3.4, 1.35, -1.0];
      hips.forEach((h, i) => {
        const hp = P(T, h[0] + fx, h[1] + fy);
        const tX = tx[i] * k + ox + (far ? 0.55 * k : 0);
        const ty = twigY(tx[i], k) + oy - 0.45 * k;
        const knee: V2 = [(hp[0] + tX) / 2 + (i - 1) * 0.7 * k, Math.min(hp[1], ty) - 0.45 * k + (i === 1 ? 0.55 * k : 0)];
        const ank: V2 = [tX - (i - 1) * 0.3 * k, ty];
        const tip: V2 = [tX + (i === 2 ? -0.5 : 0.45) * k, ty + 0.85 * k];
        leg(hp, knee, ank, tip, far, i);
      });
      return;
    }
    const sets: [V2, V2, V2, V2][] = Q.legs === 'fly'
      ? [[[2.4, 0.85], [2.98, 1.66], [2.56, 2.42], [2.86, 3.08]], [[1.25, 1.0], [0.95, 1.92], [0.2, 2.56], [-0.26, 3.12]], [[0.2, 0.85], [-0.45, 1.86], [-1.72, 2.72], [-2.38, 3.28]]]
      : [[[2.4, 0.85], [3.36, 1.3], [3.62, 2.16], [4.38, 2.33]], [[1.25, 1.0], [1.05, 1.76], [0.34, 2.2], [-0.22, 2.33]], [[0.2, 0.85], [-0.56, 1.6], [-1.96, 2.16], [-2.78, 2.33]]];
    sets.forEach((J, i) => {
      const q = J.map(([x, y]) => P(T, x + fx, y + fy)) as [V2, V2, V2, V2];
      leg(q[0], q[1], q[2], q[3], far, i);
    });
  };
  legsDraw(true);

  // ---------------------------------------------------------------- the gaster
  const axis: V2[] = [];
  const cumS: number[] = [];
  {
    let x = -1.88, y = 0.14, s = 0;
    const tot = SEG_END[5];
    axis.push([x, y]); cumS.push(0);
    const N = 26;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const ang = Math.PI - Q.bend * (0.15 + t * 0.95);
      const ds = tot / N;
      x += Math.cos(ang) * ds; y += Math.sin(ang) * ds; s += ds;
      axis.push([x, y]); cumS.push(s);
    }
  }
  const along = (s: number): V2 => {
    for (let i = 1; i < axis.length; i++) if (cumS[i] >= s || i === axis.length - 1) {
      const t = (s - cumS[i - 1]) / Math.max(1e-6, cumS[i] - cumS[i - 1]);
      return [axis[i - 1][0] + (axis[i][0] - axis[i - 1][0]) * t, axis[i - 1][1] + (axis[i][1] - axis[i - 1][1]) * t];
    }
    return axis[axis.length - 1];
  };
  // screen-space axis for the height function
  const axS = axis.map(([x, y]) => P(T, x, y));
  const nearestAxis = (x: number, y: number) => {
    let best = Infinity, bs = 0, bv = 0;
    for (let i = 1; i < axS.length; i++) {
      const a = axS[i - 1], b = axS[i];
      const sx = b[0] - a[0], sy = b[1] - a[1], L2 = sx * sx + sy * sy;
      let t = L2 > 0 ? ((x - a[0]) * sx + (y - a[1]) * sy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - a[0] - sx * t, dy = y - a[1] - sy * t, d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; bs = cumS[i - 1] + (cumS[i] - cumS[i - 1]) * t; bv = (sx * dy - sy * dx) > 0 ? -Math.sqrt(d2) : Math.sqrt(d2); }
    }
    return [bs, bv / k] as V2; // s (k units), v (k units, + = dorsal)
  };
  for (let i = 0; i < 6; i++) {
    const sB = SEG_END[i], sF = i ? SEG_END[i - 1] : 0, sA = Math.max(0, sF - (i ? 0.5 : 0));
    const path: V2[] = [];
    for (let j = 0; j <= 8; j++) path.push(P(T, ...along(sA + (sB - sA) * (j / 8))));
    const last = i === 5;
    // each tergite flares a little toward its rim, which laps over the next
    const flare = (t: number) => 1 + (last ? 0 : 0.05 * t * t);
    const sAt = (t: number) => sA + (sB - sA) * t;
    sk.np();
    const c = strip(path, t => gR(sAt(t), true) * flare(t) * k, t => gR(sAt(t), false) * flare(t) * k, { capA: 0, capB: last ? 1.2 : 0.22 });
    const F = new Field(sk, [c], {
      hf: (x, y) => {
        const [s, v] = nearestAxis(x, y);
        const R = gR(s, v > 0) * (1 + 0.05 * Math.max(0, (s - sA) / (sB - sA)) ** 2);
        const q = Math.min(1, Math.abs(v) / Math.max(0.2, R));
        // a cylinder across the body, a small step down just before the rim of the tergite ahead
        let h = R * k * Math.sqrt(1 - q * q * 0.96);
        return h;
      },
    });
    // the tergite / sternite overlap seam down the side
    if (!tiny) F.add((x, y) => { const [, v] = nearestAxis(x, y); const d = Math.abs(v + gR(sB - 0.4, false) * 0.48); return d < 0.1 ? -0.5 * k * (1 - d / 0.1) : 0; });
    punct(F, 70 + i, 0.07 * k, 1.7);
    const band = i === 0 ? 0.74 : 0.66;
    F.emit((p) => {
      const [s, v] = nearestAxis(p.x, p.y);
      // the rims curve back toward the dorsum, like real tergites
      const tl = (s - sF) / (sB - sF) - v * v * 0.05 + (v > 0 ? 0 : v * 0.04);
      if (big && i > 0 && tl < 0.1) p.l -= 0.22 * (1 - tl / 0.1);
      const stern = v < -gR(s, false) * 0.48;
      if (last) {
        if (tl > 0.5) return tiny ? M.gold : M.sting;
        return tl > 0.2 ? M.gold : irid(M, p, 0.05, true);
      }
      if (tl > band) {
        if (big && tl > 0.955) { p.l += 0.12; return M.gold; }
        return stern ? M.ochre : M.gold;
      }
      if (big && tl > band - 0.05) { p.l -= 0.1; return M.ochre; }
      return irid(M, p, (tl < 0.15 ? -0.28 : 0.04 * Math.sin(i * 1.7)) + (stern ? -0.3 : 0), true);
    }, { z: (6 - i) * 0.6 * k, zk: 0.8, spec: dead ? 0 : big ? 0.35 : 0.15, specPow: 26, bias: dead ? -0.16 : 0 });
  }
  if (!dead && !tiny) {
    const a = P(T, ...along(SEG_END[5] - 0.2)), b = P(T, ...along(SEG_END[5] + 0.55));
    sk.np();
    const st = strip([a, b], t => (1 - t) * 0.12 * k + 0.06, t => (1 - t) * 0.12 * k + 0.06, { capB: 0 });
    new Field(sk, [st], { round: 0.4 }).emit(() => M.sting, { z: 0.3 * k });
  }

  // ---------------------------------------------------------------- petiole: the wasp waist
  sk.np();
  {
    const path = mapV([[-1.22, -0.2], [-1.62, -0.1], [-2.05, 0.06], [-2.3, 0.16]]);
    const c = strip(spline(path, false, 4), t => (0.3 + Math.sin(t * Math.PI) * 0.08 - t * 0.04) * k, t => (0.26 + Math.sin(t * Math.PI) * 0.04) * k, { capA: 0.6, capB: 0.6 });
    const F = new Field(sk, [c], { round: 0.3 * k, dome: 0.1 * k });
    F.emit((p) => irid(M, p, -0.2), { z: 3.6 * k, spec: big ? 0.4 : 0 });
  }

  // ---------------------------------------------------------------- mesosoma
  sk.np();
  const mesoPart = sk.pid;
  {
    const F = new Field(sk, [spline(map(MESO), true, tiny ? 3 : 6)], { round: 1.3 * k, dome: 0.9 * k });
    // the masses under the cuticle: scutum, scutellum, pronotal lobe, mesopleuron, propodeum
    const b = (x: number, y: number, rx: number, ry: number, a: number) => { const c = P(T, x, y); F.bump(c[0], c[1], rx * k, ry * k, a * k); };
    b(1.25, -1.35, 1.2, 0.8, 0.55); b(-0.15, -1.72, 0.5, 0.3, 0.3); b(2.45, -0.4, 0.45, 0.8, 0.3); b(1.25, 0.35, 0.9, 0.6, 0.3); b(-0.8, -0.45, 0.6, 0.8, 0.25);
    if (!tiny) for (const sut of MESO_SUT) F.groove(spline(mapV(sut), false, 4), Math.max(0.5, 0.11 * k), -0.4 * k);
    punct(F, 81, 0.08 * k, 1.6);
    // striae across the propodeum
    if (big) F.add((x, y) => { const q = P(T, -0.85, -0.4); const d = Math.hypot(x - q[0], y - q[1]); return d < 0.9 * k && Math.sin((x * 0.7 - y * 1.2) * 1.4) > 0.75 ? -0.18 * k : 0; });
    const goldL = mapV([[2.05, -1.7], [1.3, -1.95], [0.55, -1.95]]);
    const scl = P(T, -0.15, -1.75), tegC = P(T, 2.0, -1.32);
    F.emit((p) => {
      // the pronotal collar's gold rim
      const pr = P(T, 2.55, 0);
      if (big && Math.abs(p.x - pr[0] + (p.y - pr[1]) * 0.25) < 0.55 && p.y < pr[1] + 0.6 * k && p.y > pr[1] - 1.2 * k) return M.gold;
      // the scutellum, gold
      if (Math.hypot((p.x - scl[0]) / (0.55 * k), (p.y - scl[1]) / (0.32 * k)) < 1) return M.gold;
      // two fine gold lines on the scutum
      if (big) for (let i = 1; i < goldL.length; i++) { const a = goldL[i - 1], c = goldL[i]; const t = Math.max(0, Math.min(1, ((p.x - a[0]) * (c[0] - a[0]) + (p.y - a[1]) * (c[1] - a[1])) / ((c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2))); if (Math.hypot(p.x - a[0] - (c[0] - a[0]) * t, p.y - a[1] - (c[1] - a[1]) * t - 0.45 * k) < 0.5) return M.gold; }
      // the tegula over the wing base
      if (!tiny && Math.hypot((p.x - tegC[0]) / (0.42 * k), (p.y - tegC[1]) / (0.3 * k)) < 1) return M.ochre;
      return irid(M, p, 0.06);
    }, { z: 4.2 * k, zk: 0.8, spec: dead ? 0 : big ? 0.3 : 0.1, specPow: 26, bias: dead ? -0.14 : 0 });
  }
  // setae: a short golden fuzz along the dorsal outline of the thorax
  if (big) sk.tufts(mesoPart, (x, y, nx, ny) => (ny < 0 ? [nx * 0.3, -1] : null), { every: 2, seed: 11, len: 1 });

  // ---------------------------------------------------------------- the head
  const hrot = -0.06 + (pose === 'chew' ? 0.14 : 0) + (dead ? 0.2 : 0);
  const hc = Math.cos(hrot), hs = Math.sin(hrot);
  const HR = (x: number, y: number): V2 => { const dx = (x - 3.05) * 1.1, dy = (y + 0.2) * 1.1; return [3.05 + dx * hc - dy * hs, -0.2 + dx * hs + dy * hc + (pose === 'chew' ? 0.12 : 0)]; };
  sk.np();
  {
    const F = new Field(sk, [spline(map(HEAD, HR), true, tiny ? 3 : 6)], { round: 0.8 * k, dome: 0.55 * k });
    const clyp = new Field(sk, [spline(map(CLYP, HR), true, 4)], { round: 1 });
    // the frons ridge between the antenna sockets, the gena bulge, the clypeal suture
    const c1 = P(T, ...HR(3.55, 0.35)); F.bump(c1[0], c1[1], 0.6 * k, 0.8 * k, 0.35 * k);
    if (!tiny) F.groove(spline(map([[4.42, 0.8], [4.72, 0.05], [5.14, 0.14]], HR) as V2[], false, 4), Math.max(0.5, 0.1 * k), -0.35 * k);
    punct(F, 91, 0.06 * k, 1.6);
    const vtx = P(T, ...HR(4.0, -1.45));
    F.emit((p) => {
      if (clyp.inside(p.x, p.y)) return M.lemon;
      if (Math.hypot(p.x - vtx[0], p.y - vtx[1]) < 0.55 * k) return irid(M, p, -0.45, true);
      return irid(M, p, -0.2, true);
    }, { z: 5.2 * k, zk: 0.8, spec: dead ? 0 : big ? 0.5 : 0.15, bias: dead ? -0.1 : 0 });
  }
  // the compound eye, bulging, with its facet lattice
  sk.np();
  {
    const F = new Field(sk, [spline(map(EYE, HR), true, tiny ? 3 : 6)], { round: 0.7 * k, dome: 0.45 * k });
    if (big) F.add((x, y) => {
      // ommatidia: offset rows of tiny domes
      const s = 1.05, gy = Math.floor(y / s), gx = Math.floor(x / s + (gy & 1) * 0.5);
      const cx = (gx + 0.5 - (gy & 1) * 0.5) * s, cy = (gy + 0.5) * s;
      const q = ((x - cx) ** 2 + (y - cy) ** 2) / (s * s * 0.3);
      return q < 1 ? 0.08 * (1 - q) : 0;
    });
    F.emit((p) => {
      if (p.d < 0.7 && big) p.l -= 0.18;
      return M.eye;
    }, { z: 5.9 * k, zk: 0.8, spec: tiny ? 0 : 1.2, specPow: 40 });
  }
  if (big) {
    // ocelli: three glassy beads on the vertex
    for (const [u, v] of [[4.02, -1.62], [3.74, -1.52], [4.3, -1.52]] as V2[]) {
      const q = P(T, ...HR(u, v));
      sk.over(Math.floor(q[0]), Math.floor(q[1]), hex(dead ? '#9a9070' : '#f6d878'));
    }
  }

  // ---------------------------------------------------------------- mandibles: toothed blades
  {
    const base = P(T, ...HR(4.62, 1.18));
    const op = Q.mandOpen;
    for (const side of [0, 1]) {
      const a = (side ? 0.85 : 1.5) + (side ? -1 : 1) * op * 0.45 + T.rot + hrot;
      const L = 1.2 * k;
      const tip: V2 = [base[0] + Math.cos(a) * L, base[1] + Math.sin(a) * L];
      if (tiny) { if (!side) { sk.np(); sk.line(base[0], base[1], tip[0], tip[1], M.mand, 0.4, 7 * k); } continue; }
      // a curved blade: the outer edge bowed, the inner (cutting) edge with three teeth
      const nx = -Math.sin(a), ny = Math.cos(a);
      const mid: V2 = [base[0] + Math.cos(a) * L * 0.55 - nx * 0.18 * k, base[1] + Math.sin(a) * L * 0.55 - ny * 0.18 * k];
      sk.np();
      const c = strip(spline([base, mid, tip], false, 5), t => (1 - t * 0.85) * 0.34 * k + 0.1, t => (1 - t * 0.8) * 0.26 * k + 0.1,
        { capA: 0.7, capB: 0, spines: big ? { side: side ? -1 : 1, at: [0.45, 0.62, 0.78], len: 0.22 * k, lean: 0.6 } : undefined });
      const F = new Field(sk, [c], { round: 0.35 * k, dome: 0.15 * k });
      const bL = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
      F.emit((p) => {
        const t = ((p.x - base[0]) * (tip[0] - base[0]) + (p.y - base[1]) * (tip[1] - base[1])) / (bL * bL);
        return t > 0.68 ? M.sting : M.mand;
      }, { z: (side ? 5.6 : 6.6) * k, bias: side ? -0.15 : 0, spec: 0.5 });
    }
    if (pose === 'chew') {
      // the berry: a glossy drupelet cluster held in the jaws
      const b = P(T, ...HR(5.35, 1.9));
      sk.np();
      const pts: LP[] = [];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const r = (0.78 + 0.08 * Math.sin(i * 2.7)) * k; pts.push([b[0] + Math.cos(a) * r, b[1] + Math.sin(a) * r * 0.95]); }
      const F = new Field(sk, [spline(pts, true, 4)], { round: 0.6 * k, dome: 0.3 * k });
      if (big) F.add((x, y) => { const s = 0.7 * k / 1.4, gx = Math.floor(x / s), gy = Math.floor(y / s); const q = ((x - (gx + 0.5) * s) ** 2 + (y - (gy + 0.5) * s) ** 2) / (s * s * 0.25); return q < 1 ? 0.25 * k * (1 - q) * 0.4 : 0; });
      F.emit(() => M.berry, { z: 8 * k, spec: 1.1, specPow: 14 });
    }
  }

  // ---------------------------------------------------------------- antennae: scape, pedicel, ringed flagellum
  {
    const root = P(T, ...HR(4.5, -0.52));
    for (const far of [true, false]) {
      const up = Q.antUp;
      const sA = -1.15 - up * 0.5 + T.rot + hrot + (far ? 0.25 : 0);
      const scL = 1.3 * k;
      const elbow: V2 = [root[0] + Math.cos(sA) * scL, root[1] + Math.sin(sA) * scL];
      const pts: V2[] = [root, elbow];
      let ang = sA + 0.85 + (far ? 0.2 : 0) - up * 0.4;
      let q = elbow;
      for (let i = 0; i < 7; i++) {
        ang += 0.22 + (dead ? 0.15 : 0);
        q = [q[0] + Math.cos(ang) * 0.44 * k, q[1] + Math.sin(ang) * 0.44 * k];
        pts.push(q);
      }
      const z = (far ? 4.5 : 7) * k, bias = far ? -0.2 : 0;
      sk.np();
      if (tiny) { if (!far) sk.line(root[0], root[1], q[0], q[1], M.dark, 0.5, z); continue; }
      // the scape: a solid little club; the flagellum: a fine ringed whip drawn pixel by pixel
      const sc = strip([root, elbow], t => (0.17 - t * 0.05) * k, t => (0.14 - t * 0.04) * k, { capA: 0.8, capB: 0.8 });
      new Field(sk, [sc], { round: 0.25 * k, dome: 0.05 * k }).emit((p) => (p.ny > 0.45 ? M.ochre : M.dark), { z, bias, spec: big ? 0.5 : 0 });
      const fl = spline(pts.slice(1), false, 4);
      let acc = 0;
      for (let i = 1; i < fl.length; i++) {
        const a = fl[i - 1], b = fl[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
        for (let j = 0; j < n; j++) {
          const x = a[0] + (b[0] - a[0]) * (j / n), y = a[1] + (b[1] - a[1]) * (j / n);
          acc += 0.5;
          const ring = Math.floor(acc / 1.6) & 1;
          sk.over(Math.floor(x), Math.floor(y), hex(far ? (dead ? '#3a3430' : '#1a1024') : dead ? '#4a4038' : ring ? '#3a2410' : '#20142e'));
          // the thicker near flagellum shows amber underneath
          if (!far && big && i < fl.length * 0.7) sk.over(Math.floor(x), Math.floor(y) + 1, hex(dead ? '#6a5a44' : ring ? '#8a5418' : '#5a3418', 230));
        }
      }
    }
  }

  // ---------------------------------------------------------------- the zombie-cap
  if (dead) {
    // mycelium: cottony pads bursting from the joints between the tergites, the neck and the legs
    const tufts: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) { const q = along(SEG_END[i] - 0.1); tufts.push([q[0], q[1] - gR(SEG_END[i], true) * 0.98, 0.36 - i * 0.03]); if (i % 2 === 0) tufts.push([q[0] + 0.1, q[1] + gR(SEG_END[i], false) * 0.92, 0.3]); }
    tufts.push([3.0, 0.45, 0.38], [2.5, -1.62, 0.34], [-1.45, 0.0, 0.32], [4.9, 1.25, 0.34]);
    tufts.forEach(([x, y, r], ti) => {
      const c = P(T, x, y);
      const R = Math.max(0.8, r * k);
      const pts: LP[] = [];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const rr = R * (0.7 + hh(i, ti, 51) * 0.6); pts.push([c[0] + Math.cos(a) * rr * 1.2, c[1] + Math.sin(a) * rr * 0.85]); }
      sk.np(true);
      const F = new Field(sk, [spline(pts, true, 3)], { round: R * 0.6, dome: R * 0.3 });
      if (big) F.add((xx, yy) => (hh(xx * 1.4, yy * 1.4, 52 + ti) - 0.5) * 0.6);
      F.emit((p) => (p.d < 0.8 && hh(p.x * 1.7, p.y * 1.7, 53) < 0.35 ? 0 : M.myc), { z: 9 * k });
    });
    // the stalk (stroma): out between the pronotum and the scutum, wiry, fibrous, curving up
    const st0 = P(T, 2.2, -1.62);
    const H = 6.4 * k;
    const path: V2[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; path.push([st0[0] - Math.sin(t * 2.4) * 1.1 * k + t * 0.3 * k, st0[1] - t * H]); }
    sk.np();
    const sw = (t: number) => (0.42 - t * 0.14 + (t < 0.08 ? 0.3 * (1 - t / 0.08) : 0) + 0.04 * Math.sin(t * 17)) * k;
    const SF = new Field(sk, [strip(path, sw, sw, { capA: 0.3, capB: 0.4 })], { round: 0.35 * k, dome: 0.12 * k });
    if (big) SF.add((x, y) => (Math.sin(x * 2.6 + Math.sin(y * 0.5) * 1.5) > 0.6 ? -0.25 : 0));
    const stTop = path[path.length - 1][1];
    SF.emit((p) => ((st0[1] - p.y) / (st0[1] - stTop) > 0.62 ? M.stalk2 : M.stalk), { z: 10 * k });
    // the fertile head: a club pocked with the ostioles of its perithecia, the sterile tip paler
    const top = path[path.length - 1];
    const kc: V2 = [top[0] + 0.15 * k, top[1] - 1.0 * k];
    const club: V2[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; club.push([top[0] + 0.12 * k * Math.sin(t * 3) + t * 0.25 * k, top[1] + 0.2 * k - t * 3.0 * k]); }
    sk.np();
    const cw = (t: number) => (0.34 + Math.sin(Math.min(1, t * 1.1) * Math.PI) * 0.78 + 0.06 * Math.sin(t * 13)) * k;
    const KF = new Field(sk, [strip(club, cw, t => cw(t) * 0.92, { capA: 0.4, capB: 0.9 })], { round: 0.6 * k, dome: 0.4 * k });
    let pores: V2[] = [];
    if (big) {
      const s = 1.55;
      KF.add((x, y) => {
        const gy = Math.floor(y / s), gx = Math.floor(x / s + (gy & 1) * 0.5);
        const cx = (gx + 0.5 - (gy & 1) * 0.5) * s + (hh(gx, gy, 61) - 0.5) * 0.4, cy = (gy + 0.5) * s;
        const q = ((x - cx) ** 2 + (y - cy) ** 2) / (s * s * 0.3);
        return q < 1 ? 0.45 * (1 - q) : 0;
      });
      pores = [];
    }
    void pores;
    const tipY = club[club.length - 1][1];
    KF.emit((p) => {
      if (p.y < tipY + 0.45 * k) return M.stalk;
      // perithecial ostioles: dark dots at the tops of the bumps
      if (big && p.nz > 0.97 && hh(Math.floor(p.x / 1.55), Math.floor(p.y / 1.55), 64) < 0.55) return M.knobPore;
      return M.knob;
    }, { z: 11 * k, spec: 0.3 });
    // a faint dust of spores off the knob
    if (big) for (let i = 0; i < 6; i++) sk.over(Math.floor(kc[0] + (hh(i, 1, 71) - 0.5) * 3.5 * k), Math.floor(kc[1] - (1.6 + hh(i, 2, 71) * 1.4) * k), hex('#ffe0b0', 110));
  }

  // near legs over the body
  legsDraw(false);
  return { dead };
}

// ---------------------------------------------------------------- wings (translucent overlay)
/** one veined wing from base (bx, by) along angle a; L = span, W = chord (px) */
function wing(sk: Sk, bx: number, by: number, a: number, L: number, W: number, opts: { fore: boolean; dead: boolean; blur?: boolean }) {
  const ca = Math.cos(a), sa = Math.sin(a);
  // the leading edge faces the head: its normal is (-sin a, cos a); the vane lies behind it
  const tx = Math.sin(a), ty = -Math.cos(a);
  const ext = L + W + 2;
  const fine = L > 9;
  const shapeAt = (u: number) => (u < 0.6 ? 0.22 + 0.78 * Math.sin((u / 0.6) * Math.PI * 0.5) : Math.sqrt(Math.max(0, 1 - ((u - 0.6) / 0.4) ** 2.2)));
  // wing-local (u along the span, w across the chord) -> canvas
  const at = (u: number, w: number): V2 => [bx + ca * u * L + tx * w * W, by + sa * u * L + ty * w * W];
  // membrane: a smoky amber costal stripe, then clear with a faint thin-film shimmer of rose and green
  for (let y = Math.floor(by - ext); y <= by + ext; y++) for (let x = Math.floor(bx - ext); x <= bx + ext; x++) {
    const dx = x + 0.5 - bx, dy = y + 0.5 - by;
    const u = (dx * ca + dy * sa) / L;
    const w = (dx * tx + dy * ty) / W;
    if (u < 0 || u > 1) continue;
    const shape = shapeAt(u);
    if (w < -0.06 || w > shape) continue;
    const ww = w / Math.max(0.05, shape);
    let col: C;
    if (opts.dead) col = hex('#c8c0b0', 80);
    else if (!fine) col = w < 0.2 ? hex('#3a2a40', 170) : hex(u > 0.55 ? '#d8c8ff' : '#e8f4ff', opts.blur ? 60 : 100);
    else {
      const smoky = ww < 0.3 && u < 0.72;
      const film = Math.sin(u * 7 + ww * 3 + (opts.fore ? 0 : 1.3));
      const edge = w > shape - 1.1 / W || u > 1 - 1.1 / L;
      col = edge ? hex('#5a4a6a', 120) : hex(smoky ? '#b8884e' : film > 0.7 ? '#ecd4f4' : film < -0.75 ? '#d4f0e4' : '#e4f0ff', opts.blur ? 45 : smoky ? 105 : 64);
    }
    sk.over(x, y, col);
  }
  if (!fine) return;
  // veins as clean single-pixel lines: costa, subcosta, the stigma, the radial cell, media, cubitus, cross-veins
  const vc = hex(opts.dead ? '#6a6050' : '#3a2a3a', 215), vl = hex(opts.dead ? '#7a7060' : '#5a4650', 170);
  const poly = (pts: [number, number][], c: C) => { for (let i = 1; i < pts.length; i++) { const p = at(...pts[i - 1]), q = at(...pts[i]); sk.overLine(p[0], p[1], q[0], q[1], c); } };
  const sw = (u: number, f: number): [number, number] => [u, f * shapeAt(u)];
  poly([[0.02, 0.02], [0.3, 0.0], [0.6, 0.0], [0.85, 0.02], [0.97, 0.1]], vc);              // costa
  poly([[0.02, 0.12], [0.3, 0.12], [0.52, 0.1]], vc);                                        // subcosta
  for (let u = 0.52; u <= 0.63; u += 0.5 / L) poly([[u, 0.02], [u, 0.17]], hex(opts.dead ? '#7a6a50' : '#5a3418', 235)); // stigma
  poly([[0.63, 0.15], [0.78, 0.22], [0.92, 0.12], [0.96, 0.06]], vl);                        // radial cell
  poly([sw(0.04, 0.3), sw(0.3, 0.42), sw(0.55, 0.45), sw(0.74, 0.5)], vl);                   // media
  poly([sw(0.06, 0.62), sw(0.3, 0.7), sw(0.5, 0.72)], vl);                                   // cubitus
  poly([sw(0.3, 0.12), sw(0.3, 0.7)], vl);                                                   // basal cross-vein
  poly([sw(0.5, 0.15), sw(0.55, 0.45)], vl);                                                 // submarginal cells
  poly([sw(0.66, 0.22), sw(0.68, 0.47)], vl);
  poly([sw(0.78, 0.25), sw(0.8, 0.5)], vl);
}
function wings(sk: Sk, pose: HPose, k: number, ox = 0, oy = 0) {
  const Q = poseOf(pose);
  const T = xf(k, Q.rot, ox, oy);
  const base = P(T, 2.05, -1.38);
  const dead = pose === 'dead';
  if (pose === 'perch' || pose === 'chew') {
    // folded lengthwise along the back, the hindwing tucked under the forewing
    wing(sk, base[0] - 0.3 * k, base[1] + 0.25 * k, Math.PI - 0.02 + T.rot, 6.3 * k, 1.05 * k, { fore: false, dead });
    wing(sk, base[0], base[1], Math.PI - 0.1 + T.rot, 7.2 * k, 1.2 * k, { fore: true, dead });
    return;
  }
  if (dead) {
    // drooping, one out from the body, one half open
    wing(sk, base[0], base[1], Math.PI + 0.55 + T.rot, 6.2 * k, 1.5 * k, { fore: false, dead });
    wing(sk, base[0], base[1], -2.55 + T.rot, 7.0 * k, 1.9 * k, { fore: true, dead });
    return;
  }
  const a = pose === 'up' ? -1.95 : 2.62;
  wing(sk, base[0] - 0.4 * k, base[1] + 0.1 * k, a - (pose === 'up' ? 0.35 : -0.3), 4.9 * k, 1.7 * k, { fore: false, dead });
  wing(sk, base[0], base[1], a, 6.6 * k, 2.2 * k, { fore: true, dead });
}

const cache = new Map<string, HornetFrame>();
/** a world (k=1) or bigger frame; the in-flight blur ghost is added by the game */
export function hornetFrame(pose: HPose, k = 1): HornetFrame {
  const key = pose + k;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = Math.ceil(18 * k), H = Math.ceil(16 * k);
  const sk = new Sk(W, H, Math.round(W / 2), Math.round(H * 0.58));
  drawHornet(sk, pose, k);
  wings(sk, pose, k);
  const full = sk.resolve({ rim: 0.14, bounce: 0.06 });
  const t = full.trim(1);
  const out = { buf: t.buf, ax: sk.ox - t.ox, ay: sk.oy - t.oy };
  cache.set(key, out);
  return out;
}

/** field-guide portrait scale and body offset (the body is longer behind its centre than in front) */
const GK = 3.9, GX = 3.6;
const ANIMS = { idle: { frames: 2, fps: 20, loop: true }, perch: { frames: 2, fps: 4, loop: true } };
export const JEWELHORNET_DEF: SpeciesDef = {
  name: 'Jewel Hornet', kind: 'insect', len: 10, height: 7,
  anims: ANIMS,
  canvas: () => ({ w: 60, h: 50, ox: 30, oy: 29 }),
  draw(sk: Sk, anim: string, frame: number, eye: BeastEye) {
    void eye;
    const pose: HPose = anim === 'perch' ? (frame ? 'chew' : 'perch') : frame ? 'down' : 'up';
    drawHornet(sk, pose, GK, GX, 0);
    wings(sk, pose, GK, GX, 0);
    return { head: [GX + 4 * GK, -1] as V2, eye: [GX + 4 * GK, -2] as V2 };
  },
};
const ZK = 3.3, ZX = 2.6;
export const ZOMBIECAP_DEF: SpeciesDef = {
  name: 'Zombie-cap', kind: 'other', len: 10, height: 12,
  anims: { idle: { frames: 1, fps: 1, loop: true } },
  canvas: () => ({ w: 60, h: 60, ox: 30, oy: 36 }),
  draw(sk: Sk) { drawHornet(sk, 'dead', ZK, ZX, 0); wings(sk, 'dead', ZK, ZX, 0); return { head: [0, -16] as V2, eye: [0, -16] as V2 }; },
};

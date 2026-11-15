// Reefback: the colossal grazer of the Kittiwake's seas, a slow whale whose back is a living reef. It
// keeps its back awash for decades, so the pitted skin becomes a garden: a crust of pink coralline and
// green turf heaped into terraces, acorn barnacles in volcano clusters, blue-black mussel beds along the
// waterline, anemones, a sea star, little branching corals, and kelp whose holdfasts grip the ridge and
// whose blades stream down its flanks. It breathes through two fleshy snorkels on its head (so it can
// rest with the reef just under the surface); the blow is a splayed double plume. Its parasites ride
// along too: CROWN LICE crowd the rough white callosity round the snorkels, and PENNANT LEECHES,
// metre-long ribbons, hang from its flanks, flippers and flukes like flags.
//
// The animal is drawn from cetacean anatomy, as outlines through its landmarks (beasts-hfield), never
// from stacked ellipses: the broad arched rostrum with its white callosities, the long bowed mouth line
// with the pale rasp-plate showing, the small eye over the corner of the mouth, the splash ridge in front
// of the snorkels, the long back, the keeled tail stock with its knuckles, the throat pleats running
// back to the navel, the long humpback-like flipper scalloped with tubercles, and the flukes with their
// notch, their ragged trailing edge and the pale pattern underneath that tells one Reefback from
// another. The skin is slate, mottled paler, pitted, raked with healed scars and dotted with old
// cookie-cutter bites.
//
// Everything anchors on the waterline at mid-back (y = 0 is the sea surface; the game draws the
// animal under its sea band, so whatever is below the surface is hidden by the water). The painter works
// at any scale k: k = 1 in the mid sea band, a hazed k = 0.55 on the horizon, and the whole animal for
// the field guide portrait. reefbackSpots() gives the parasite boxes for the camera from the same geometry.

import { Sk, V2, Px, rmp, SpeciesDef, AnimDef, TAU, hh, lmix, kf } from '../../beasts-core';
import { hex } from '../../color';
import { HField, crv, spline, ribbon, cell, scaleH, fbm, sstep, cl, lineDist, arcs, along } from '../../beasts-hfield';
import type { Tx } from '../../beasts-hfield';

const A = (frames: number, fps: number, loop = true): AnimDef => ({ frames, fps, loop });
const ANIMS: Record<string, AnimDef> = {
  idle: A(1, 1),
  bask: A(4, 2),
  surface: A(4, 5),
  roll: A(4, 3, false),
  fluke: A(8, 4, false),
  dive: A(3, 3, false),
  spout: A(6, 7, false),
};

// ------------------------------------------------------------------ pose
interface RP {
  lift: number;    // body raised above its basking line (px at k = 1)
  arch: number;    // dive arch: the head drops, the back humps (0..1)
  tail: number;    // fluke-up: 0 tail under .. 1 flukes held high
  slide: number;   // flukes sliding back down (0..1)
  roll: number;    // rolled a little, a flipper out (0..1)
  snork: number;   // snorkels raised (0..1)
  flare: number;   // snorkel tips flared (blowing)
  wave: number;    // phase for kelp and leeches
  stream: number;  // water sheeting off the reef (0..1)
  full: boolean;   // the whole animal (field guide portrait)
}
function pose(anim: string, f: number, n: number): RP {
  const t = f / Math.max(1, n);
  const p: RP = { lift: 0, arch: 0, tail: 0, slide: 0, roll: 0, snork: 1, flare: 0, wave: t, stream: 0, full: false };
  switch (anim) {
    case 'idle': p.full = true; break;
    case 'bask': p.flare = f === 1 ? 0.6 : 0; break;
    case 'surface': p.stream = 1 - t * 0.7; p.snork = 0.4 + t * 0.6; break;
    case 'roll': p.roll = [0.35, 0.8, 1, 0.6][f]; p.snork = 0.6; break;
    case 'dive': p.arch = [0.3, 0.65, 1][f]; p.snork = 0.3 - f * 0.1; break;
    case 'fluke':
      p.arch = kf(t, [[0, 0.5], [0.25, 1], [1, 1]]);
      p.tail = kf(t, [[0, 0.1], [0.3, 0.75], [0.5, 1], [0.7, 1], [1, 0.9]]);
      p.slide = kf(t, [[0.55, 0], [1, 1]]);
      p.stream = kf(t, [[0.2, 0], [0.4, 1], [1, 0.6]]);
      p.snork = 0;
      break;
  }
  return p;
}

// ------------------------------------------------------------------ the body's profile (k = 1, y down, x toward the head)
/** the dorsal line: the tail stock rising to the long back, the neck dip, the splash ridge, the arched rostrum */
const TOP: [number, number][] = [
  [-170, 15.5], [-160, 12.5], [-142, 7], [-122, 1], [-102, -5], [-82, -11.5], [-58, -17.5], [-28, -22], [4, -23.6], [34, -22.4],
  [60, -18.4], [80, -13.6], [94, -10.6], [104, -10.4], [111, -11.4], [118, -9.6], [130, -6.0], [143, -2.2], [155, 1.6], [164, 5.2], [170, 8.4], [174, 12], [176, 15.4],
];
/** the ventral line: the chin and the deep pleated throat, the belly, the long keel of the tail stock */
const BOT: [number, number][] = [
  [-170, 18.5], [-152, 21], [-128, 25.5], [-102, 33], [-72, 44.5], [-36, 55], [0, 60.5], [40, 61], [78, 56], [104, 47], [124, 38.5],
  [142, 31.5], [156, 26.5], [166, 22.5], [172, 19.6], [176, 15.4],
];
const X_TAIL = -170, X_NOSE = 175;
/** the mouth line: from the tip of the rostrum, bowed high, back down to the corner under the eye */
const MOUTH: V2[] = [[174, 16.2], [166, 12.6], [156, 10.6], [145, 11.2], [134, 14.2], [124, 18.6], [116, 22.4], [110, 24.4]];
const EYE_AT: V2 = [113, 17.6];
const CROWN_X = 110;
const LEECH_X = -14;

function archDy(P: RP, x: number) {
  const a = P.arch;
  const sinkT = P.tail > 0 ? 10 * Math.min(1, P.tail * 1.5) : 0;
  return a * (30 * sstep(40, 150, x) - 5 * Math.exp(-(((x - 10) / 70) ** 2)) + 2 * sstep(-30, -120, x)) + sinkT * sstep(-30, -110, x) - P.lift;
}
/** dorsal line: y of the top of the body at x (k = 1) */
function topY(P: RP, x: number): number {
  if (x < X_TAIL || x > X_NOSE) return Infinity;
  return crv(TOP, x) + archDy(P, x);
}
function botY(P: RP, x: number): number { return crv(BOT, x) + archDy(P, x); }
function crownAt(P: RP): V2 { return [CROWN_X, topY(P, CROWN_X)]; }

function fluke(P: RP) {
  const h = P.tail * (1 - P.slide * 0.85);
  const root: V2 = [-60, topY(P, -60) + 8];
  const base: V2 = [-92 + h * 10, root[1] - 14 - h * 56];
  const ctrl: V2 = [-84, root[1] - 12 - 26 * h];
  return { root, ctrl, base, h };
}
function flipper(P: RP) {
  const r = P.roll;
  const root: V2 = [62, P.full ? 40 : 14];
  const tip: V2 = P.full ? [8, 74] : [34 - r * 10, 20 - r * 50];
  return { root, tip };
}

/** parasite boxes (anchor-relative, scaled by k) visible in a frame, for the camera */
export function reefbackSpots(anim: string, frame: number, k: number): { lice: [number, number, number, number] | null; leech: [number, number, number, number] | null } {
  const n = ANIMS[anim]?.frames ?? 1;
  const P = pose(anim, frame, n);
  if (P.full || anim === 'spout') return { lice: null, leech: null };
  const c = crownAt(P);
  const lice: [number, number, number, number] | null = c[1] < 0 ? [(c[0] - 12) * k, (c[1] - 6) * k, (c[0] + 12) * k, (c[1] + 5) * k] : null;
  let leech: [number, number, number, number] | null = null;
  if (P.tail > 0.5) {
    const f = fluke(P);
    leech = [(f.base[0] - 34) * k, (f.base[1] - 6) * k, (f.base[0] + 34) * k, (f.base[1] + 20) * k];
  } else if (P.roll > 0.5) {
    const fp = flipper(P);
    leech = [(fp.tip[0] - 12) * k, (fp.tip[1] - 4) * k, (fp.tip[0] + 12) * k, (fp.tip[1] + 18) * k];
  } else {
    const y = topY(P, LEECH_X);
    if (y < -8) leech = [(LEECH_X - 12) * k, (y + 2) * k, (LEECH_X + 12) * k, (y + 18) * k];
  }
  return { lice, leech };
}

// ------------------------------------------------------------------ materials
function mats(sk: Sk, haze: number) {
  const HZ = hex('#bfe4ef');
  const r = (c: string, o: Parameters<typeof rmp>[1] = {}) => {
    const ramp = rmp(c, o);
    return haze > 0 ? ramp.map(x => lmix(x, HZ, haze)) : ramp;
  };
  return {
    skin: sk.m(r('#2e3a46', { n: 8, dark: 0.62, light: 0.4, cool: 0.3, warm: 0.15 }), { edge: 1, bias: -0.12 }),
    skinL: sk.m(r('#45525e', { n: 7, dark: 0.58, light: 0.38, cool: 0.25 }), { edge: 1, bias: -0.12 }),
    scar: sk.m(r('#8a969e', { n: 6, dark: 0.5, light: 0.32, cool: 0.2 }), { edge: 0, bias: -0.06 }),
    belly: sk.m(r('#98a4ac', { n: 6, dark: 0.55, light: 0.32, cool: 0.2 }), { edge: 1, bias: -0.04 }),
    pleat: sk.m(r('#6e7a82', { n: 5, dark: 0.5, light: 0.3 }), { edge: 0 }),
    callus: sk.m(r('#e2ddd0', { n: 6, dark: 0.5, light: 0.35, warm: 0.2 }), { edge: 1 }),
    louse: sk.m(r('#f0a07a', { n: 4, dark: 0.45, light: 0.3 }), { edge: 0 }),
    rasp: sk.m(r('#cdbf9a', { n: 5, dark: 0.5, light: 0.3, warm: 0.2 }), { edge: 0 }),
    lip: sk.m(r('#20262e', { n: 4, dark: 0.45 }), { edge: 0, noRim: true }),
    crust: sk.m(r('#8a8072', { n: 6, dark: 0.55, light: 0.4 }), { edge: 1 }),
    corallin: sk.m(r('#c88aa0', { n: 6, dark: 0.55, light: 0.4, warm: 0.2 }), { edge: 1 }),
    turf: sk.m(r('#6a8a3e', { n: 6, dark: 0.55, light: 0.38, warm: 0.3 }), { edge: 1 }),
    barn: sk.m(r('#e6dfcc', { n: 6, dark: 0.55, light: 0.4, warm: 0.15 }), { edge: 1 }),
    barnD: sk.m(r('#2e2a2c', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
    mussel: sk.m(r('#283044', { n: 5, dark: 0.5, light: 0.45, cool: 0.4 }), { edge: 1 }),
    kelp: sk.m(r('#54401c', { n: 6, dark: 0.55, light: 0.4, warm: 0.4 }), { edge: 1, bias: -0.06 }),
    kelpG: sk.m(r('#4a5420', { n: 6, dark: 0.55, light: 0.4, warm: 0.35 }), { edge: 1, bias: -0.06 }),
    kelpL: sk.m(r('#8a7a36', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    bladder: sk.m(r('#c8a454', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    anem: sk.m(r('#e8783e', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    anemT: sk.m(r('#ffd2a0', { n: 4, dark: 0.35, light: 0.3 }), { edge: 0 }),
    star: sk.m(r('#e0582e', { n: 5, dark: 0.5, light: 0.4, warm: 0.3 }), { edge: 1 }),
    fan: sk.m(r('#9a4a86', { n: 4, dark: 0.45, light: 0.4 }), { edge: 0 }),
    coral: sk.m(r('#e89a4a', { n: 4, dark: 0.45, light: 0.4 }), { edge: 0 }),
    leech: sk.m(r('#5e1f34', { n: 6, dark: 0.5, light: 0.45 }), { edge: 1 }),
    leechL: sk.m(r('#b04a62', { n: 5, dark: 0.45, light: 0.35 }), { edge: 0 }),
    snork: sk.m(r('#3a4652', { n: 6, dark: 0.55, light: 0.35 }), { edge: 1 }),
    rim: sk.m(r('#12171d', { n: 3, dark: 0.35 }), { edge: 0, noRim: true }),
    flukeU: sk.m(r('#c8ced0', { n: 6, dark: 0.5, light: 0.3 }), { edge: 1 }),
    crab: sk.m(r('#c8402c', { n: 4, dark: 0.4 }), { edge: 0 }),
    eye: sk.m(r('#1a1414', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
  };
}
type M = ReturnType<typeof mats>;

// ------------------------------------------------------------------ the skin
/** slate skin: mottled paler, pitted, raked with healed scars, dotted with old cookie-cutter bites; countershaded below */
function skinTex(M: M, X: number, Y: number, P: RP, o: Tx, mid: number) {
  o.m = M.skin;
  // countershading: the pale belly below the flank, its edge broken into the slate by streaks
  const bl = Y - mid + (fbm(X * 0.035, 3, 5, 3) - 0.5) * 14;
  const fl = fbm(X * 0.11 + Y * 0.05, Y * 0.16, 9, 2);
  if (bl > 7 + (fl - 0.5) * 12) o.m = M.belly;
  // mottling: paler slate clouds
  const mot = fbm(X * 0.04 + Y * 0.035, Y * 0.085 - X * 0.012, 7, 4);
  if (o.m === M.skin && mot > 0.62) o.m = M.skinL;
  // pits: the skin is pocked where larvae once settled
  if (hh(Math.floor(X * 0.9), Math.floor(Y * 0.9), 11) > 0.93) o.z -= 0.5;
  // healed rake scars: pale parallel lines in pairs and threes, slanting back
  const rk = Math.floor((X + Y * 0.6) / 26), rh = hh(rk, 3, 13);
  if (rh > 0.55) {
    const u = (X + Y * 0.6) - rk * 26 - 6 - rh * 8;
    const len = Math.abs(Y - (mid - 6 + hh(rk, 4, 13) * 18));
    if (len < 7 + rh * 6 && (Math.abs(u) < 0.45 || Math.abs(u - 2.2) < 0.4 || (rh > 0.8 && Math.abs(u - 4.3) < 0.4))) { o.m = M.scar; o.z -= 0.2; }
  }
  // cookie-cutter bites: small pale rings
  cell(X, Y, 23, 15, 17, 0.9);
  if (CELLH() > 0.88) {
    const d = Math.hypot((X - CELLX()) / 1.6, (Y - CELLY()) / 1.2);
    if (d < 1.4 && d > 0.6) { o.m = M.scar; o.z -= 0.3; } else if (d <= 0.6) o.z -= 0.5;
  }
  void P;
}
import { CELL } from '../../beasts-hfield';
const CELLH = () => CELL.h, CELLX = () => CELL.x, CELLY = () => CELL.y;

// ------------------------------------------------------------------ drawing
function drawReef(sk: Sk, M: M, P: RP, k: number): V2 {
  const F = HField.full(sk);
  const clipY = P.full ? Infinity : 6 * k;
  const K = (v: V2): V2 => [v[0] * k, v[1] * k];
  // ---- the body: one contour, dorsal line nose to tail, the ventral line back
  const top: V2[] = [], bot: V2[] = [];
  for (let x = X_TAIL; x <= X_NOSE; x += 2.5 / Math.max(0.4, k)) { top.push(K([x, topY(P, x)])); bot.push(K([x, botY(P, x)])); }
  top.push(K([X_NOSE, topY(P, X_NOSE)]));
  const body = [...top, ...bot.reverse()].filter(q => !P.full || true);
  const mid = (x: number) => (topY(P, x) * 0.62 + botY(P, x) * 0.38);
  F.inflate(body, 26 * k, 0, 1, 0, (x, y, d, s, o) => {
    if (y > clipY + 1) return;
    const X = x / k, Y = y / k;
    skinTex(M, X, Y, P, o, mid(X));
    // the throat pleats: long grooves from the chin back to the navel
    if (X > 30 && Y > botY(P, X) - 26 && X < 160) {
      const ph = (Y - botY(P, X)) / 2.4 + X * 0.012;
      const g = Math.abs(ph - Math.round(ph));
      if (g < 0.16) { o.z -= 0.8; o.m = M.pleat; }
      else o.z += 0.25;
    }
  }, 0.85);
  // anatomy carved in: the mouth line with the rasp-plate below it, the eye in its fold, the keel and knuckles, the navel
  const mouth = spline(MOUTH.map(q => K([q[0], q[1] + archDy(P, q[0])])), 4);
  F.groove(mouth, 1.6 * k, 1.6, M.lip, -0.15, 1);
  F.groove(mouth.map(q => [q[0], q[1] + 2.2 * k] as V2), 1.4 * k, -0.6, M.rasp, 0.05, 1, (t) => sstep(0, 0.15, t) * sstep(1, 0.7, t));
  F.groove(mouth.map(q => [q[0], q[1] - 2.6 * k] as V2), 2.2 * k, -0.9, 0, 0.05, 1);
  const eye = K([EYE_AT[0], EYE_AT[1] + archDy(P, EYE_AT[0])]);
  F.bump(eye[0], eye[1], 4 * k, 1.2 * k, 0, 0.04, 3 * k, 1);
  F.groove([[eye[0] - 3 * k, eye[1] + 0.4 * k], [eye[0], eye[1] + 1.6 * k], [eye[0] + 3 * k, eye[1] + 0.6 * k]], 0.8 * k, 0.6, 0, -0.1, 1);
  for (let i = 0; i < 6; i++) {
    const x = -150 + i * 13;
    const q = K([x, topY(P, x) + 1.2]);
    F.bump(q[0], q[1], 3.2 * k, 1.2 * k, 0, 0.05, 1.8 * k, 1);
  }
  // the rostrum's callosities: rough white islands of hard skin, crusted with barnacles and whale lice
  for (const [cx, cy, rx, ry] of [[160, 6.6, 6, 2.6], [146, 1.8, 5, 2.2], [167, 11.5, 3.5, 2.2], [125, 17.4, 4.5, 1.6]] as [number, number, number, number][]) {
    const c = K([cx, cy + archDy(P, cx)]);
    const ol: V2[] = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, r = 0.75 + hh(i, cx, 19) * 0.45; ol.push([c[0] + Math.cos(a) * rx * r * k, c[1] + Math.sin(a) * ry * r * k]); }
    F.inflate(spline(ol, 2, true), 1.6 * k, (x, y) => F.zAt(x, y) - 0.6 * k, 2, 0, (x, y, d, s, o) => {
      if (F.zAt(x, y) < -1e8 || y > clipY + 1) return;
      o.m = M.callus;
      cell(x / k, y / k, 1.4, 1.4, 23, 0.8);
      o.z += scaleH(2.2) * 0.6 * k;
      if (CELL.h > 0.8) o.m = M.louse;
    }, 1);
  }
  // ---- the flipper (portrait, or rolled up out of the water), behind the near flank's reef
  if (P.roll > 0 || P.full) drawFlipper(sk, F, M, P, k, clipY);
  // ---- the fluke-up dive: the tail stock rising out of the sea and the flukes
  if (P.tail > 0) drawFluke(F, M, P, k);
  if (P.full) drawPortraitFlukes(F, M, P, k);
  // ---- the reef on its back
  garden(F, M, P, k, clipY);
  // ---- the crown: the callosity round the snorkels, crawling with lice; the snorkels
  crown(F, M, P, k, clipY);
  // ---- kelp streaming down the near flank
  kelp(F, M, P, k, clipY);
  // ---- pennant leeches trailing from the flank
  if (P.tail < 0.3) for (let i = 0; i < 3; i++) {
    const x = LEECH_X - 6 + i * 6;
    pennant(F, M, [x * k, (topY(P, x) + 5 + i * 2) * k], 11 + i * 3, k, P.wave + i * 0.3, Math.PI / 2 + 0.55, 0.75, 60 + i);
  }
  sk.np();
  if (!P.full) sk.clipY = clipY;
  F.emit({ seam: 1.2, seamDark: 0.28, ao: 0.06, aoR: 3, shadow: 0.22, shadowR: 14 * Math.max(0.5, k), contrast: 1,
    spec: (m) => (m === M.skin || m === M.skinL || m === M.belly ? 0.22 : m === M.mussel ? 0.5 : m === M.kelp || m === M.kelpG ? 0.25 : m === M.leech ? 0.35 : 0), specPow: 16 });
  // the eye: small, dark, a glint
  sk.over(eye[0], eye[1], hex('#0e0c0c'));
  if (k > 0.5) { sk.over(eye[0] + 1, eye[1], hex('#1c1818')); sk.over(eye[0], eye[1] - 1, hex('#5a5450')); }
  // anemone tentacles, coral branches and the sea fans as fine overlay strokes
  for (const f of FINE) f(sk);
  FINE.length = 0;
  if (P.stream > 0) cascades(sk, P, k);
  sk.clipY = Infinity;
  if (!P.full) foamLine(sk, P, k);
  return eye;
}
/** fine strokes queued by the garden (drawn after the field is emitted) */
const FINE: ((sk: Sk) => void)[] = [];

/** the reef: a heaped crust along the ridge, then barnacle volcanoes, mussel beds, anemones, a sea star, corals */
function garden(F: HField, M: M, P: RP, k: number, clipY: number) {
  const X0 = -78, X1 = 100;
  // the crust: a continuous irregular terrace riding the dorsal line, thicker over the hump
  const thick = (x: number) => (3.5 + 6.5 * Math.sin(cl((x - X0) / (X1 - X0)) * Math.PI) + (fbm(x * 0.07, 1, 31, 3) - 0.5) * 9 + Math.max(0, Math.sin(x * 0.17)) * 2) * sstep(X0, X0 + 14, x) * sstep(X1, X1 - 12, x);
  const up: V2[] = [], dn: V2[] = [];
  const step = 1.5 / Math.max(0.45, k);
  for (let x = X0; x <= X1; x += step) {
    const t = topY(P, x);
    up.push([x * k, (t - thick(x)) * k]);
    dn.push([x * k, (t + 2.2 + (fbm(x * 0.1, 5, 33, 2) - 0.5) * 3) * k]);
  }
  const crust = [...up, ...dn.reverse()];
  F.inflate(crust, 3.2 * k, (x, y) => (F.zAt(x, y) > -1e8 ? F.zAt(x, y) - 2 * k : 18 * k), 3, 0.5 * k, (x, y, d, s, o) => {
    if (y > clipY + 1) return;
    const X = x / k, Y = y / k;
    // zones: pink coralline crust, green turf, pale rubble
    const z = fbm(X * 0.07, Y * 0.12, 37, 3);
    o.m = z > 0.58 ? M.corallin : z < 0.4 ? M.turf : M.crust;
    cell(X, Y, 1.6, 1.4, 39, 0.8);
    o.z += scaleH(2.2) * 0.9 * k;
    if (o.m === M.turf && hh(Math.floor(X * 1.3), Math.floor(Y * 1.3), 41) > 0.7) o.z += 0.6 * k;
  }, 0.8);
  // the organisms, scattered along the ridge, each one drawn as its own outline
  const n = Math.round(54 * Math.max(0.5, k));
  for (let i = 0; i < n; i++) {
    const X = X0 + 6 + (i / n) * (X1 - X0 - 10) + (hh(i, 1, 7) - 0.5) * 3;
    if (Math.abs(X - CROWN_X) < 14) continue;
    const tY = topY(P, X) - thick(X) * (0.4 + hh(i, 9, 7) * 0.6) + 0.6;
    const x = X * k, y = tY * k;
    if (y > clipY) continue;
    const kind = hh(i, 2, 7);
    const zb = (F.zAt(x, y + 1) > -1e8 ? F.zAt(x, y + 1) : 20 * k) + 1.5 * k;
    if (kind < 0.46) {
      // a cluster of acorn barnacles: cream volcanoes, ribbed, with a dark aperture at the crown
      const m = 2 + Math.floor(hh(i, 3, 7) * 4);
      for (let j = 0; j < m; j++) {
        const bx = x + (hh(i, j, 11) - 0.5) * 6 * k, by = y + (hh(j, i, 13) - 0.6) * 2 * k;
        const r = (1.1 + hh(i + j, 5, 3) * 1.1) * k, h = r * (1.1 + hh(j, i, 15) * 0.4);
        const cone: V2[] = [[bx - r, by + 0.3 * k], [bx - r * 0.75, by - h * 0.6], [bx - r * 0.35, by - h], [bx + r * 0.35, by - h], [bx + r * 0.75, by - h * 0.6], [bx + r, by + 0.3 * k]];
        F.inflate(spline(cone, 2, true), r * 0.9, zb + j * 0.2, 4, 0, (px, py, d, s, o) => {
          o.m = M.barn;
          if (Math.abs(((px - bx) / r) * 3 % 1) < 0.2) o.z -= 0.25;
          if (py < by - h + 0.9 * k && Math.abs(px - bx) < r * 0.3) o.m = M.barnD;
        }, 0.8);
      }
    } else if (kind < 0.6) {
      // a mussel bed: blue-black shells packed at a slant, glinting
      const m = 3 + Math.floor(hh(i, 4, 7) * 4);
      for (let j = 0; j < m; j++) {
        const mx = x + (j - m / 2) * 1.5 * k, my = y + (hh(i, j, 17) - 0.3) * 1.5 * k, a = -1.1 + hh(i, j, 19) * 0.6;
        const L = (3 + hh(j, i, 21) * 1.5) * k, W = 1.1 * k;
        const shell: V2[] = [[mx, my], [mx + Math.cos(a) * L * 0.5 - Math.sin(a) * W, my + Math.sin(a) * L * 0.5 + Math.cos(a) * W], [mx + Math.cos(a) * L, my + Math.sin(a) * L], [mx + Math.cos(a) * L * 0.55 + Math.sin(a) * W * 0.8, my + Math.sin(a) * L * 0.55 - Math.cos(a) * W * 0.8]];
        F.inflate(spline(shell, 2, true), W, zb + 0.5, 5, 0, (px, py, d, s, o) => { o.m = M.mussel; if (d < 0.6) o.t = -0.08; }, 0.8);
      }
    } else if (kind < 0.68) {
      // an anemone: a short fleshy column, the crown of tentacles splayed above it
      const r = (0.8 + hh(i, 4, 7) * 0.6) * k, h = (1.8 + hh(i, 6, 7) * 1.4) * k;
      const col: V2[] = [[x - r * 1.2, y + 0.4 * k], [x - r * 0.85, y - h * 0.5], [x - r, y - h], [x + r, y - h], [x + r * 0.85, y - h * 0.5], [x + r * 1.2, y + 0.4 * k]];
      F.inflate(spline(col, 2, true), r, zb + 0.4, 6, 0, (px, py, d, s, o) => { o.m = M.anem; if (Math.floor((py - y) / k * 1.5) % 2 === 0) o.z -= 0.2; }, 0.8);
      const pink = hh(i, 8, 7) > 0.5;
      const tc = hex(pink ? '#f6b4c0' : '#ffd6a6'), tcD = hex(pink ? '#c86a86' : '#d8905a');
      FINE.push((sk) => {
        const n = k < 0.5 ? 3 : 7;
        for (let j = 0; j < n; j++) {
          const a = -Math.PI / 2 + (j / (n - 1) - 0.5) * 2.6 + Math.sin(P.wave * TAU + j) * 0.12;
          const L = (1.6 + hh(i, j, 49) * 1.6) * k;
          for (let q = 0.6; q <= L; q += 0.6) sk.over(x + Math.cos(a) * q * 1.2, y - h + Math.sin(a) * q, q > L * 0.6 ? tc : tcD);
        }
      });
    } else if (kind < 0.76) {
      // kelp holdfast lumps and turf tufts
      const r = (1.6 + hh(i, 6, 7) * 1.8) * k;
      const lump: V2[] = [];
      for (let j = 0; j < 9; j++) { const a = Math.PI + (j / 8) * Math.PI, rr = r * (0.8 + hh(i, j, 23) * 0.4); lump.push([x + Math.cos(a) * rr * 1.4, y + 0.6 * k + Math.sin(a) * rr]); }
      F.inflate(spline(lump, 2, true), r, zb, 7, 0, (px, py, d, s, o) => { o.m = hh(i, 8, 7) > 0.5 ? M.turf : M.corallin; cell(px / k, py / k, 1.1, 1.1, 43, 0.8); o.z += scaleH(2) * 0.5 * k; }, 0.8);
    } else if (kind < 0.8 && k > 0.6) {
      // a sea star sprawled over the crust
      const r = 3.4 * k, a0 = hh(i, 4, 7) * TAU;
      const st: V2[] = [];
      for (let j = 0; j < 10; j++) { const a = a0 + (j / 10) * TAU, rr = j % 2 ? r * 0.38 : r; st.push([x + Math.cos(a) * rr, y - 1.2 * k + Math.sin(a) * rr * 0.55]); }
      F.inflate(st, 0.9 * k, zb + 1, 8, 0, (px, py, d, s, o) => { o.m = M.star; if (hh(Math.floor(px), Math.floor(py), 45) > 0.75) o.z += 0.35; }, 0.8);
    } else if (kind < 0.9) {
      // branching coral and a sea fan: fine strokes
      const purple = hh(i, 5, 7) > 0.5;
      const H = (3 + hh(i, 6, 7) * 4) * k;
      FINE.push((sk) => {
        const c = hex(purple ? '#a45a92' : '#eaa050'), cD = hex(purple ? '#6a3462' : '#a8602c');
        const br = (bx: number, by: number, a: number, L: number, dpt: number) => {
          for (let q = 0; q < L; q += 0.7) sk.over(bx + Math.cos(a) * q, by + Math.sin(a) * q, q < L * 0.5 ? cD : c);
          if (dpt > 0) { const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L; br(ex, ey, a - 0.5, L * 0.6, dpt - 1); br(ex, ey, a + 0.45, L * 0.55, dpt - 1); }
        };
        br(x, y, -Math.PI / 2 + (hh(i, 7, 7) - 0.5) * 0.5, H * 0.45, k > 0.7 ? 2 : 1);
      });
    } else {
      // a small red crab picking over the garden
      const cr: V2[] = [[x - 1.6 * k, y], [x - 1.1 * k, y - 1.3 * k], [x + 1.1 * k, y - 1.3 * k], [x + 1.6 * k, y]];
      F.inflate(cr, 0.9 * k, zb + 1, 9, 0, (px, py, d, s, o) => { o.m = M.crab; }, 0.8);
    }
  }
}

/** kelp: holdfasts along the ridge, ruffled ribbons streaming down the near flank into the water */
function kelp(F: HField, M: M, P: RP, k: number, clipY: number) {
  const n = 11;
  for (let i = 0; i < n; i++) {
    const g = (s: number) => hh(i, 7 + s, 9);
    const X = -64 + (i + g(1) * 0.8) * 16;
    if (Math.abs(X - CROWN_X) < 12) continue;
    const root: V2 = [X * k, (topY(P, X) + 0.5) * k];
    if (root[1] > clipY) continue;
    const L = (14 + g(2) * 24) * k, lean = 0.15 + g(3) * 0.7, wide = 0.85 + g(4) * 0.7;
    const pts: V2[] = [];
    for (let j = 0; j <= 14; j++) {
      const u = j / 14;
      const sw = Math.sin(P.wave * TAU + i * 1.7 + u * 5) * 1.6 * k * u;
      pts.push([root[0] - L * lean * u * u - u * 1.5 * k + sw, root[1] + L * u * (1 - lean * 0.3)]);
    }
    const dark = g(5) > 0.5;
    const wf = (t: number) => (0.5 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 1.1 * wide + Math.sin(t * 23 + i * 3) * 0.32 * wide) * k;
    const cont = ribbon(pts, wf, wf, 0, 0.5, 0.8);
    const cum = arcs(pts);
    F.inflate(cont, 1.4 * k, (x, y) => (F.zAt(x, y) > -1e8 ? F.zAt(x, y) : 30 * k) + 1.5 * k, 20 + i, 0, (x, y, d, s, o) => {
      if (y > clipY + 1) return;
      const [dd, t] = lineDist(pts, x, y, cum);
      o.m = dd < 0.45 * k && t > 0.08 && k > 0.7 ? M.kelpL : dark ? M.kelp : M.kelpG;
      // the blade's ruffled, bullate surface
      if (Math.sin(t * 40 + dd * 2) > 0.6) o.z -= 0.35 * k;
    }, 0.5);
    if (k > 0.7 && g(6) > 0.4) {
      const b = along(pts, 0.25 + g(7) * 0.3, cum).p;
      const bl: V2[] = [];
      for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU; bl.push([b[0] + 1.6 * k + Math.cos(a) * 1.3 * k, b[1] + Math.sin(a) * 1.5 * k]); }
      F.inflate(bl, 1.3 * k, (x, y) => (F.zAt(x, y) > -1e8 ? F.zAt(x, y) : 30 * k) + 0.8 * k, 40 + i, 0, (x, y, d, s, o) => { if (y <= clipY + 1) o.m = M.bladder; }, 0.9);
    }
  }
}

/** the rough white callosity round the snorkels, crawling with crown lice; the snorkels */
function crown(F: HField, M: M, P: RP, k: number, clipY: number) {
  const c = crownAt(P);
  const x = c[0] * k, y = c[1] * k;
  if (y > 6 * k && !P.full) return;
  const ol: V2[] = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = 0.8 + hh(i, 3, 29) * 0.35; ol.push([x + Math.cos(a) * 11 * r * k, y + 0.8 * k + Math.sin(a) * 3.6 * r * k]); }
  F.inflate(spline(ol, 2, true), 2.2 * k, (px, py) => (F.zAt(px, py) > -1e8 ? F.zAt(px, py) : 20 * k) + 0.6 * k, 50, 0, (px, py, d, s, o) => {
    if (py > clipY + 1) return;
    o.m = M.callus;
    cell(px / k, py / k, 1.3, 1.1, 47, 0.8);
    o.z += scaleH(2.2) * 0.7 * k;
    // crown lice: pale orange, crowded in the rough skin
    if (CELL.h > 0.86 && k > 0.5) { o.m = M.louse; o.z += 0.4 * k; }
  }, 0.9);
  const sn = P.snork;
  if (sn <= 0.05) return;
  for (const [dx, h] of [[-3, 13], [3.5, 11]] as [number, number][]) {
    const b: V2 = [x + dx * k, y + 1 * k];
    const tip: V2 = [b[0] - 3.5 * k * sn, b[1] - h * k * sn];
    const midp: V2 = [(b[0] + tip[0]) / 2 + 1.2 * k, (b[1] + tip[1]) / 2];
    const sp = spline([b, midp, tip], 5);
    const wf = (t: number) => (2.3 - t * 0.7 + (t > 0.82 ? P.flare * 1.3 * (t - 0.82) / 0.18 : 0)) * k;
    const cont = ribbon(sp, wf, wf, 0, 0, 0.4);
    const cum = arcs(sp);
    const z0 = (F.zAt(b[0], b[1]) > -1e8 ? F.zAt(b[0], b[1]) : 20 * k) + 2 * k;
    F.inflate(cont, 2.2 * k, z0, dx < 0 ? 51 : 52, 0, (px, py, d, s, o) => {
      const t = lineDist(sp, px, py, cum)[1];
      o.m = t > 0.92 ? M.rim : M.snork;
      // ringed like a trachea, the base rough with lice
      if (Math.floor(t * 9) % 2 === 0 && t < 0.88) o.z -= 0.3 * k;
      if (t < 0.25 && hh(Math.floor(px), Math.floor(py), 53) > 0.7) o.m = M.louse;
    }, 0.9);
  }
}

/** a pennant leech: a flat dark-red ribbon anchored by its sucker, banded, rippling as it hangs */
function pennant(F: HField, M: M, a: V2, len: number, k: number, ph: number, ang: number, droop: number, id: number) {
  const pts: V2[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const L = len * k * u;
    const w = Math.sin(ph * TAU + u * 6) * 1.6 * k * u;
    pts.push([a[0] + Math.cos(ang) * L + w, a[1] + Math.sin(ang) * L * droop + u * u * len * k * (1 - droop) * 0.8]);
  }
  const wf = (t: number) => (t < 0.1 ? 1.5 : 1.1 - t * 0.4 + Math.sin(t * 30) * 0.12) * k;
  const cum = arcs(pts);
  const z0 = (F.zAt(a[0], a[1]) > -1e8 ? F.zAt(a[0], a[1]) : 30 * k) + 2 * k;
  F.inflate(ribbon(pts, wf, wf, 0, 0.8, 0.6), 1.1 * k, z0, id, 0, (x, y, d, s, o) => {
    const [dd, t] = lineDist(pts, x, y, cum);
    o.m = dd < 0.4 * k && t > 0.1 ? M.leechL : M.leech;
    if (Math.floor(t * len * 0.9) % 2 === 0) o.z -= 0.25 * k;
  }, 0.6);
}

/** the long flipper: scalloped with tubercles along its leading edge, crusted with barnacles, leeches hanging */
function drawFlipper(sk: Sk, F: HField, M: M, P: RP, k: number, clipY: number) {
  const f = flipper(P);
  const r: V2 = [f.root[0] * k, f.root[1] * k], t: V2 = [f.tip[0] * k, f.tip[1] * k];
  const dx = t[0] - r[0], dy = t[1] - r[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  // the planform: a long blade, the leading edge (n side) knobbed, the trailing edge smooth
  const fw = P.full ? 1.45 : 1.3;
  const lead = (s: number) => (Math.sin(Math.min(1, s * 1.1 + 0.08) * Math.PI) * 6.2 + 1.2) * (1 - s * 0.45) * k * fw + (s > 0.1 && s < 0.95 ? Math.max(0, Math.sin(s * 44)) * 0.9 * k * fw : 0);
  const trail = (s: number) => (Math.sin(Math.min(1, s * 1.05 + 0.1) * Math.PI) * 4.4 + 1) * (1 - s * 0.35) * k * fw;
  const cont = ribbon([r, t], lead, trail, Math.ceil(L / k * 1.5), 0.6, 0.4);
  const z0 = (P.full ? 22 : 30) * k;
  F.inflate(cont, 3.4 * k, z0, 30, 0, (x, y, d, s, o) => {
    if (y > clipY + 1) return;
    const along = ((x - r[0]) * ux + (y - r[1]) * uy) / L, across = (x - r[0]) * nx + (y - r[1]) * ny;
    o.m = across < -0.5 * k ? M.belly : M.skin;
    // barnacle crust along the knobbed leading edge
    if (across > lead(along) - 2.4 * k && hh(Math.floor(x / k), Math.floor(y / k), 23) > 0.45) { o.m = M.barn; o.z += 0.5 * k; }
    if (hh(Math.floor(x * 0.6 / k), Math.floor(y * 0.6 / k), 25) > 0.9) o.m = M.scar;
  }, 0.7);
  for (let i = 0; i < 2; i++) pennant(F, M, [t[0] + (2 - i * 5) * k, t[1] + 3 * k], 13 + i * 4, k, P.wave + i * 0.4, Math.PI / 2 + 0.3, 0.9, 64 + i);
  void sk;
}

/** the fluke-up dive: the keeled tail stock rising out of the sea, the flukes seen from below */
function drawFluke(F: HField, M: M, P: RP, k: number) {
  const f = fluke(P);
  const Kv = (v: V2): V2 => [v[0] * k, v[1] * k];
  const sp = spline([Kv(f.root), Kv(f.ctrl), Kv([f.base[0] + 3, f.base[1] + 8]), Kv(f.base)], 4);
  const cum = arcs(sp);
  // the stock: deep and narrow, a keel along its back, the knuckles of its spine
  const lw = (t: number) => (15 - t * 10.5) * k, rw = (t: number) => (15 - t * 10) * k + (t > 0.15 && t < 0.85 ? Math.max(0, Math.sin(t * 30)) * 0.8 * k : 0);
  F.inflate(ribbon(sp, lw, rw, 0, 0, 0), 9 * k, 40 * k, 31, 0, (x, y, d, s, o) => {
    const t = lineDist(sp, x, y, cum)[1];
    skinTex(M, x / k + 300, y / k, P, o, 1e4);
    // barnacles crusting the keel
    cell(x / k, y / k, 3.2, 3.2, 59, 0.8);
    if (CELL.h > 0.8 && CELL.F1 < 0.3) { o.m = M.barn; o.z += (0.3 - CELL.F1) * 3 * k; }
    void t;
  }, 0.8);
  if (f.h <= 0.25) return;
  const w = 40 * Math.min(1, f.h * 1.3);
  const b = Kv(f.base);
  for (const sd of [-1, 1]) {
    const tip: V2 = [b[0] + sd * w * k, b[1] - 13 * k * f.h];
    const dx = tip[0] - b[0], dy = tip[1] - b[1], L = Math.hypot(dx, dy) || 1;
    // the lobe: a swept leading edge, the trailing edge ragged with old nicks
    const lead = (s: number) => (Math.sin(Math.min(1, s * 1.05 + 0.08) * Math.PI) * 9 + 1.6) * (1 - s * 0.35) * k;
    const trail = (s: number) => (Math.sin(Math.min(1, s * 1.1 + 0.05) * Math.PI) * 4 + 1.2) * k * (1 - (hh(Math.floor(s * 14), sd, 61) > 0.75 ? 0.25 : 0));
    const above = sd > 0;
    const cont = ribbon([b, tip], above ? lead : trail, above ? trail : lead, Math.ceil(L / k * 1.5), 0.4, 0.5);
    F.inflate(cont, 3.4 * k, 44 * k, 32 + (sd > 0 ? 1 : 0), 0, (x, y, d, s, o) => {
      const X = x / k, Y = y / k;
      // the underside: pale, with the dark pattern every Reefback carries differently, and barnacle scars
      const pat = fbm(X * 0.12 + sd * 7, Y * 0.2, 63, 3);
      o.m = pat > 0.56 || d < 1.2 * k ? M.skin : M.flukeU;
      cell(X, Y, 3, 3, 29, 0.8);
      if (CELL.h > 0.86 && CELL.F1 < 0.3) { o.m = M.barn; o.z += (0.3 - CELL.F1) * 3 * k; }
    }, 0.7);
    for (let i = 0; i < 3; i++) {
      const u = 0.28 + i * 0.25;
      const a: V2 = [b[0] + (tip[0] - b[0]) * u, b[1] + (tip[1] - b[1]) * u + 3.5 * k];
      pennant(F, M, a, 10 + ((i + (sd > 0 ? 1 : 0)) % 3) * 4, k, P.wave + i * 0.3 + sd, Math.PI / 2, 1, 70 + i + (sd > 0 ? 3 : 0));
    }
  }
}

/** the portrait's flukes: horizontal, seen from a little above: a broad swallowtail at the end of the keel */
function drawPortraitFlukes(F: HField, M: M, P: RP, k: number) {
  const st: V2 = [(X_TAIL + 8) * k, (topY(P, X_TAIL) + 2) * k];
  const L: V2[] = [
    [st[0] + 4 * k, st[1] - 1.8 * k], [st[0] - 10 * k, st[1] - 5 * k], [st[0] - 24 * k, st[1] - 9.5 * k], [st[0] - 36 * k, st[1] - 11.5 * k], // far lobe's leading edge
    [st[0] - 33 * k, st[1] - 8 * k], [st[0] - 25 * k, st[1] - 4.6 * k], [st[0] - 17 * k, st[1] - 1.6 * k], // its trailing edge to the notch
    [st[0] - 14 * k, st[1] + 0.4 * k], // the notch
    [st[0] - 19 * k, st[1] + 4 * k], [st[0] - 28 * k, st[1] + 9 * k], [st[0] - 38 * k, st[1] + 14 * k], // the near lobe's trailing edge (ragged) out to the tip
    [st[0] - 34 * k, st[1] + 15.6 * k], [st[0] - 22 * k, st[1] + 12.4 * k], [st[0] - 10 * k, st[1] + 6.6 * k], [st[0] + 4 * k, st[1] + 3 * k], // its leading edge back
  ];
  F.inflate(spline(L, 4, true), 2.4 * k, 6 * k, 34, 0, (x, y, d, s, o) => {
    const far = y < st[1];
    o.m = far ? M.skinL : M.skin;
    o.t = far ? -0.14 : 0;
    cell(x / k, y / k, 4, 3, 65, 0.8);
    if (CELL.h > 0.85 && CELL.F1 < 0.3) o.m = M.scar;
  }, 0.6);
}

/** white water sheeting off the reef as it breaks the surface or lifts its flukes */
function cascades(sk: Sk, P: RP, k: number) {
  const n = Math.round(30 * P.stream);
  for (let i = 0; i < n; i++) {
    let x: number, y: number;
    if (P.tail > 0.3 && i % 2) {
      const f = fluke(P);
      x = (f.base[0] + (hh(i, 1, 31) - 0.5) * 66) * k;
      y = (f.base[1] + 5) * k;
    } else {
      const X = -60 + hh(i, 2, 31) * 190;
      x = X * k; y = (topY(P, X) + 1) * k;
    }
    const L = (4 + hh(i, 3, 31) * 12) * k;
    for (let j = 0; j < L; j++) if (hh(i, j, 37) > 0.22) sk.over(x + (hh(j, i, 41) - 0.5) * 1.5 + Math.sin(j * 0.7 + i) * 0.6, y + j, hh(i, j, 43) > 0.5 ? hex('#f4fbfd') : hex('#cfe9f1', 220));
  }
}

/** foam lapping round the waterline where the body meets the sea */
function foamLine(sk: Sk, P: RP, k: number) {
  for (let X = X_TAIL - 4; X <= X_NOSE + 6; X += 1 / k) {
    if (topY(P, X) > 1) continue;
    if (hh(Math.floor(X * k), 7, 61) < 0.3) continue;
    sk.over(X * k, 0, hex('#e8f6fa'));
    if (hh(Math.floor(X * k), 9, 61) > 0.7) sk.over(X * k, -1, hex('#f8fdff'));
  }
}

// ------------------------------------------------------------------ the blow
/** the splayed double plume from the two snorkels, fading out (overlay pixels: no outline) */
function drawSpout(sk: Sk, f: number, k: number) {
  const t = f / 5;
  const H = (22 + t * 36) * k, fade = t < 0.45 ? 1 : 1 - (t - 0.45) * 1.7;
  for (const sd of [-1, 1]) {
    const n = Math.round(90 * k * (0.5 + t));
    for (let i = 0; i < n; i++) {
      const u = hh(i, sd + 5, 47);
      const y = -u * H;
      const spread = (2 + u * (6 + t * 12)) * k;
      const x = sd * (u * 8 * k + 1.5 * k) + (hh(i, sd + 9, 53) - 0.5) * spread;
      const a = Math.round(255 * fade * (0.5 + (1 - u) * 0.4) * (hh(i, 3, 59) > 0.3 ? 1 : 0.55));
      if (a <= 12) continue;
      const g = u > 0.6 ? 0xe8 : 0xff;
      sk.over(x, y, (((a & 255) << 24) | (0xff << 16) | (0xf8 << 8) | g) >>> 0);
    }
  }
}

// ------------------------------------------------------------------ species
const PORTRAIT = 0.42;
/** the portrait is drawn a little smaller than its canvas scale so the flukes fit */
const PORTRAIT_DRAW = 0.37;
function makeDef(k: number, haze: number, name: string): SpeciesDef {
  return {
    name, kind: 'mammal', len: Math.round(330 * k), height: Math.round(44 * k),
    anims: ANIMS,
    canvas: (anim) => {
      if (anim === 'spout') return { w: Math.ceil(64 * k), h: Math.ceil(74 * k), ox: Math.round(32 * k), oy: Math.round(68 * k) };
      if (anim === 'idle') return { w: Math.ceil(380 * k * PORTRAIT), h: Math.ceil(130 * k * PORTRAIT), ox: Math.round(200 * k * PORTRAIT), oy: Math.round(46 * k * PORTRAIT) };
      return { w: Math.ceil(380 * k), h: Math.ceil(124 * k), ox: Math.round(200 * k), oy: Math.round(100 * k) };
    },
    draw(sk, anim, frame) {
      if (anim === 'spout') { drawSpout(sk, frame, k); return { head: [0, -10], eye: [0, -10] }; }
      const n = ANIMS[anim]?.frames ?? 1;
      const P = pose(anim, frame, n);
      const M = mats(sk, haze);
      const kk = P.full ? k * PORTRAIT_DRAW : k;
      const ep = drawReef(sk, M, P, kk);
      // head point = the snorkel tips (where the blow comes from)
      const c = crownAt(P);
      return { head: [(c[0] - 2) * kk, (c[1] - 12 * P.snork) * kk], eye: ep };
    },
    eyeFor: () => 'open',
    anchor: Object.fromEntries(Object.keys(ANIMS).map(a => [a, 'centre'])) as Record<string, 'centre'>,
  };
}

export const REEFBACK = makeDef(1, 0.12, 'Reefback');
/** the same animal far out on the horizon band: smaller and hazed by distance */
export const REEFBACK_FAR = makeDef(0.55, 0.4, 'Reefback');
export const REEFBACK_K = { mid: 1, far: 0.55 };
void ({} as Px);

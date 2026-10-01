// Reefback: the colossal grazer of the Kittiwake's seas, a slow whale-like animal whose back is a
// living reef. It keeps its back awash for decades, so the pitted skin becomes a garden: terraces
// of acorn barnacles, calcified spires, pink coralline crust, anemones, green turf and kelp that
// streams down its flanks. It breathes through two fleshy snorkels on its head (so it can rest
// with the reef just under the surface); the blow is a splayed double plume. Its parasites ride
// along too: CROWN LICE crowd the rough white callosity round the snorkels, and PENNANT LEECHES,
// metre-long ribbons, hang from its flanks, flippers and flukes like flags.
//
// Everything anchors on the waterline at mid-back (y = 0 is the sea surface; the game draws the
// animal under its sea band, so whatever is below the surface is hidden by the water). The
// painter works at any scale k: k = 1 in the mid sea band, a hazed k = 0.55 on the horizon.
// reefbackSpots() gives the parasite boxes for the camera from the same geometry.

import { Sk, V2, Px, rmp, drawEye, EyeSpec, SpeciesDef, AnimDef, TAU, hh, cbez, along, lmix, kf } from '../../beasts-core';
import { hex } from '../../color';

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

// ------------------------------------------------------------------ body geometry (k = 1)
interface Lobe { cx: number; cy: number; rx: number; ry: number }
/** the body as three merged lobes: the great reef hump, the blunt head and the tapering tail stock */
function lobes(P: RP): Lobe[] {
  const a = P.arch, up = -P.lift;
  const sinkT = P.tail > 0 ? 10 * Math.min(1, P.tail * 1.5) : 0;
  return [
    { cx: -96, cy: 18 + a * 2 + up + sinkT, rx: 78, ry: 23 },
    { cx: 4, cy: 20 - a * 5 + up, rx: 112, ry: 43 },
    { cx: 102, cy: 17 + a * 30 + up, rx: 52, ry: 32 },
  ];
}
/** dorsal line: y of the top of the body at x (k = 1) */
function topY(P: RP, x: number): number {
  let y = Infinity;
  for (const L of lobes(P)) {
    const u = (x - L.cx) / L.rx;
    if (Math.abs(u) >= 1) continue;
    y = Math.min(y, L.cy - L.ry * Math.sqrt(1 - u * u));
  }
  return y;
}
/** where the reef garden, the crown and the snorkels sit */
const CROWN_X = 110;
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
  const root: V2 = [56, P.full ? 36 : 14];
  const tip: V2 = P.full ? [22, 64] : [34 - r * 10, 20 - r * 50];
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
const LEECH_X = -14;

// ------------------------------------------------------------------ materials
function mats(sk: Sk, haze: number) {
  const HZ = hex('#bfe4ef');
  const r = (c: string, o: Parameters<typeof rmp>[1] = {}) => {
    const ramp = rmp(c, o);
    return haze > 0 ? ramp.map(x => lmix(x, HZ, haze)) : ramp;
  };
  return {
    skin: sk.m(r('#28323e', { n: 6, dark: 0.55, light: 0.24 }), { edge: 1, spec: 0.2, bias: -0.16 }),
    scar: sk.m(r('#4e5a66', { n: 5, dark: 0.5, light: 0.3 }), { edge: 0, bias: -0.12 }),
    belly: sk.m(r('#9aa6b0', { n: 5, dark: 0.45 }), { edge: 1 }),
    crust: sk.m(r('#77766a', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    turf: sk.m(r('#6e9444', { n: 5, dark: 0.5, light: 0.4 }), { edge: 1 }),
    coral: sk.m(r('#d98aa8', { n: 5, dark: 0.45, light: 0.45 }), { edge: 1 }),
    barn: sk.m(r('#ece6d4', { n: 5, dark: 0.45, light: 0.5 }), { edge: 1 }),
    barnD: sk.m(r('#3e3232', { n: 3, dark: 0.4 }), { edge: 0, noRim: true }),
    spire: sk.m(r('#b8b2a0', { n: 5, dark: 0.5, light: 0.45 }), { edge: 1 }),
    kelp: sk.m(r('#5e4a20', { n: 5, dark: 0.55, light: 0.45 }), { edge: 1 }),
    kelpG: sk.m(r('#56602a', { n: 5, dark: 0.55, light: 0.45 }), { edge: 1 }),
    kelpL: sk.m(r('#a68c3e', { n: 4, dark: 0.45 }), { edge: 0 }),
    bladder: sk.m(r('#c8a454', { n: 4, dark: 0.45 }), { edge: 1, spec: 0.4 }),
    anem: sk.m(r('#f08a4a', { n: 4, dark: 0.45 }), { edge: 1 }),
    anemT: sk.m(r('#ffd6a8', { n: 3, dark: 0.3 }), { edge: 0 }),
    callus: sk.m(r('#e4dfd2', { n: 5, dark: 0.45, light: 0.4 }), { edge: 1 }),
    louse: sk.m(r('#f29a78', { n: 4, dark: 0.45 }), { edge: 0 }),
    leech: sk.m(r('#5e1f34', { n: 5, dark: 0.5, light: 0.45 }), { edge: 1, spec: 0.35 }),
    leechL: sk.m(r('#b04a62', { n: 4, dark: 0.45 }), { edge: 0 }),
    snork: sk.m(r('#2a343f', { n: 5, dark: 0.5 }), { edge: 1 }),
    rim: sk.m(r('#12171d', { n: 3, dark: 0.35 }), { edge: 0, noRim: true }),
    lip: sk.m(r('#c7c2b4', { n: 4, dark: 0.4 }), { edge: 0 }),
    fluke: sk.m(r('#2c3641', { n: 6, dark: 0.55, light: 0.3 }), { edge: 1, bias: -0.06 }),
    flukeU: sk.m(r('#aab5be', { n: 5, dark: 0.45 }), { edge: 1 }),
    crab: sk.m(r('#c8402c', { n: 3, dark: 0.4 }), { edge: 0 }),
  };
}
type M = ReturnType<typeof mats>;

const EYE: EyeSpec = { r: 0.9, iris: hex('#1a1414'), lash: hex('#101010'), ring: hex('#c8c2b4') };

// ------------------------------------------------------------------ drawing
function drawReef(sk: Sk, M: M, P: RP, k: number): V2 {
  if (!P.full) sk.clipY = 6 * k;
  // far-side kelp behind the body
  kelp(sk, M, P, k, -1);
  // the body: three merged lobes of dark, scarred skin, crusted with reef along the top
  const skinFill = (p: Px) => {
    const up = -p.ny; // screen normal y is down
    if (up < -0.45) return M.belly;
    const X = p.x / k;
    const scar = hh(Math.floor(X / 11), Math.floor(p.y / (6 * k)), 5);
    if (up > 0.72 && X > -70 && X < 132) {
      const g = hh(Math.floor(X / 2.5), Math.floor(p.y / (1.6 * k)), 9);
      p.l += (g - 0.5) * 0.18;
      return g > 0.82 ? M.coral : g < 0.34 ? M.turf : M.crust;
    }
    if (scar > 0.84) return M.scar;
    p.l += (hh(Math.floor(X / 3), Math.floor(p.y / (2 * k)), 3) - 0.5) * 0.08;
    return M.skin;
  };
  for (const L of lobes(P)) {
    sk.ell(L.cx * k, L.cy * k, L.rx * k, L.ry * k, skinFill, { rz: L.ry * k * 0.8, z: 0 });
  }
  // the head: pale rasp-lip at the front, a small eye low down near the water
  const hx = 150;
  const ly = topY(P, hx) + 10;
  sk.line((hx - 2) * k, ly * k, (hx - 26) * k, (ly + 8) * k, M.lip, 0.45, 60 * k, true);
  const ex = 132, eyY = topY(P, ex) + 14;
  const ep = drawEye(sk, ex * k, eyY * k, { ...EYE, r: k > 0.8 ? 0.9 : 0.5 }, 'open');
  garden(sk, M, P, k);
  crown(sk, M, P, k);
  kelp(sk, M, P, k, 1);
  // pennant leeches trailing from the flank
  if (P.tail < 0.3) for (let i = 0; i < 3; i++) {
    const x = LEECH_X - 6 + i * 6;
    pennant(sk, M, [x * k, (topY(P, x) + 5 + i * 2) * k], 11 + i * 3, k, P.wave + i * 0.3, Math.PI / 2 + 0.55, 0.75);
  }
  if (P.roll > 0 || P.full) drawFlipper(sk, M, P, k);
  if (P.tail > 0) drawFluke(sk, M, P, k);
  if (P.full) {
    // portrait: flukes seen edge-on at the end of the tail stock
    const st: V2 = [-172 * k, 20 * k];
    for (const sd of [-1, 1]) {
      sk.np();
      sk.blade(st[0] + 8 * k, st[1], st[0] - 20 * k, st[1] + sd * 15 * k, u => (Math.sin(Math.min(1, u * 1.1 + 0.05) * Math.PI) * 6 + 1) * k, sd < 0 ? M.fluke : M.flukeU, { z0: sd * 2, z1: sd * 3, bend: sd * 5 * k });
    }
  }
  if (P.stream > 0) cascades(sk, P, k);
  sk.clipY = Infinity;
  if (!P.full) foamLine(sk, P, k);
  return ep;
}

/** barnacle terraces, calcified spires, anemones, coralline mounds and a crab or two */
function garden(sk: Sk, M: M, P: RP, k: number) {
  const n = Math.round(46 * Math.max(0.55, k));
  for (let i = 0; i < n; i++) {
    const X = -64 + (i / n) * 186 + (hh(i, 1, 7) - 0.5) * 4;
    const x = X * k, y = (topY(P, X) + 1.2) * k;
    if (y > 5 * k || Math.abs(X - CROWN_X) < 12) continue;
    const kind = hh(i, 2, 7);
    sk.np();
    if (kind < 0.5) {
      // a terrace of acorn barnacles: cream cones stacked on each other, dark apertures
      const m = 3 + Math.floor(hh(i, 3, 7) * 5);
      for (let j = 0; j < m; j++) {
        const bx = x + (hh(i, j, 11) - 0.5) * 8 * k, stack = hh(j, i, 13) * 3.5 * k;
        const r = (1.2 + hh(i + j, 5, 3) * 1.5) * k;
        sk.ell(bx, y - stack - r * 0.7, r, r * 1.05, M.barn, { z: 50 * k + j * 0.5, rz: r });
        if (r > 0.9) sk.dot(bx, y - stack - r * 1.5, M.barnD, 0.3, 54 * k + j, true);
      }
    } else if (kind < 0.62) {
      // a calcified spire capped with barnacles
      const h = (4 + hh(i, 4, 7) * 7) * k;
      sk.tube([[x, y], [x - 0.8 * k, y - h * 0.6], [x + 0.4 * k, y - h]], t => (1.8 - t * 0.9) * k, M.spire, { z: 50 * k });
      sk.ell(x + 0.4 * k, y - h, 1.4 * k, 1.2 * k, M.barn, { z: 52 * k, rz: k });
    } else if (kind < 0.75) {
      // an anemone: orange column, pale tentacle crown
      const r = (1.7 + hh(i, 4, 7) * 1.2) * k;
      sk.ell(x, y - r, r, r * 1.15, M.anem, { z: 51 * k, rz: r });
      for (let j = -1; j <= 1; j++) sk.dot(x + j * r * 0.6, y - r * 2.2, M.anemT, 0.6, 53 * k, true);
    } else if (kind < 0.93) {
      // coralline and turf mounds
      const r = (2 + hh(i, 6, 7) * 2.4) * k;
      sk.ell(x, y - r * 0.35, r * 1.4, r * 0.8, hh(i, 8, 7) > 0.5 ? M.coral : M.turf, { z: 49 * k, rz: r });
    } else {
      // a tiny red crab picking over the garden
      sk.ell(x, y - 0.9 * k, 1.2 * k, 0.8 * k, M.crab, { z: 55 * k });
    }
  }
}

/** kelp: holdfasts along the ridge, ruffled ribbons streaming down the flank (side -1 = far flank) */
function kelp(sk: Sk, M: M, P: RP, k: number, side: 1 | -1) {
  // holdfasts in irregular clumps; each frond its own length, lean, width and tone
  const n = side > 0 ? 8 : 6;
  for (let i = 0; i < n; i++) {
    const g = (s: number) => hh(i, side * 7 + s, 9);
    const X = -54 + (i + g(1) * 0.8) * (side > 0 ? 21 : 27) + (side > 0 ? 0 : 10);
    if (Math.abs(X - CROWN_X) < 10) continue;
    const root: V2 = [X * k, (topY(P, X) + 1.5) * k];
    if (root[1] > 6 * k) continue;
    const L = (8 + g(2) * 20) * k;
    const lean = 0.15 + g(3) * 0.85;
    const wide = 0.8 + g(4) * 0.9;
    const pts: V2[] = [];
    for (let j = 0; j <= 12; j++) {
      const u = j / 12;
      const sw = Math.sin(P.wave * TAU + i * 1.7 + u * 5) * 1.5 * k * u;
      pts.push([root[0] - L * lean * u * u - u * 1.5 * k + sw, root[1] + L * u * (1 - lean * 0.3)]);
    }
    sk.np();
    const dark = g(5) > 0.5;
    sk.tube(pts, t => (0.7 + Math.sin(t * Math.PI) * 1.1 * wide + Math.sin(t * 19 + i * 3) * 0.3) * k,
      (p) => (Math.abs(p.v) < 0.2 && p.t > 0.1 ? M.kelpL : dark ? M.kelp : M.kelpG),
      { z: side > 0 ? 70 * k : -40 * k, bias: side > 0 ? 0 : -0.18 });
    if (side > 0 && k > 0.7 && g(6) > 0.45) {
      const b = along(pts, 0.25 + g(7) * 0.3).p;
      sk.ell(b[0] + 1.2 * k, b[1], 1.15 * k, 1.15 * k, M.bladder, { z: 72 * k });
    }
  }
}

/** the rough white callosity round the snorkels, crawling with crown lice; the snorkels */
function crown(sk: Sk, M: M, P: RP, k: number) {
  const c = crownAt(P);
  const x = c[0] * k, y = c[1] * k;
  if (y > 6 * k) return;
  sk.np();
  sk.ell(x, y + 0.6 * k, 11 * k, 4 * k, (p) => {
    p.l += (hh(Math.floor(p.x / k), Math.floor(p.y / k), 17) - 0.5) * 0.35;
    return M.callus;
  }, { z: 52 * k, rz: 3 * k });
  // crown lice: little pale-orange crab shapes crowded on the callus
  for (let i = 0; i < 16; i++) {
    const lx = x + (hh(i, 1, 19) - 0.5) * 19 * k, ly = y + (hh(i, 2, 19) - 0.6) * 4 * k;
    sk.dot(lx, ly, M.louse, 0.75, 58 * k, true);
    if (k > 0.8 && hh(i, 3, 19) > 0.35) sk.dot(lx + 1, ly, M.louse, 0.55, 58 * k, true);
  }
  const sn = P.snork;
  if (sn <= 0.05) return;
  for (const [dx, h] of [[-3, 13], [3.5, 11]] as [number, number][]) {
    sk.np();
    const b: V2 = [x + dx * k, y + 1 * k];
    const tip: V2 = [b[0] - 3.5 * k * sn, b[1] - h * k * sn];
    sk.tube([b, [(b[0] + tip[0]) / 2 + 1.2 * k, (b[1] + tip[1]) / 2], tip], t => (2.4 - t * 0.7 + (t > 0.85 ? P.flare * 1.2 : 0)) * k, M.snork, { z: 60 * k });
    sk.ell(tip[0], tip[1], (1.6 + P.flare) * k, 0.8 * k, M.rim, { z: 62 * k });
  }
}

/** a pennant leech: a flat dark-red ribbon anchored by its sucker, rippling as it hangs */
function pennant(sk: Sk, M: M, a: V2, len: number, k: number, ph: number, ang: number, droop: number) {
  const pts: V2[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const L = len * k * u;
    const w = Math.sin(ph * TAU + u * 6) * 1.6 * k * u;
    pts.push([a[0] + Math.cos(ang) * L + w, a[1] + Math.sin(ang) * L * droop + u * u * len * k * (1 - droop) * 0.8]);
  }
  sk.np();
  sk.tube(pts, t => (t < 0.08 ? 1.35 : 1 - t * 0.35) * k, (p) => (Math.abs(p.v) < 0.3 && p.t > 0.1 ? M.leechL : M.leech), { z: 80 * k });
}

function drawFlipper(sk: Sk, M: M, P: RP, k: number) {
  const f = flipper(P);
  const r: V2 = [f.root[0] * k, f.root[1] * k], t: V2 = [f.tip[0] * k, f.tip[1] * k];
  sk.np();
  sk.blade(r[0], r[1], t[0], t[1], s => Math.sin(Math.min(1, s * 1.2 + 0.1) * Math.PI) * 7 * k + 1, (p) => {
    // knobbly leading edge crusted with barnacles
    if (p.v < -0.55 && hh(Math.floor(p.x / k), Math.floor(p.y / k), 23) > 0.5) return M.barn;
    return p.v > 0.3 ? M.belly : M.skin;
  }, { z0: 76 * k, z1: 78 * k, bend: 3 * k });
  for (let i = 0; i < 2; i++) pennant(sk, M, [t[0] + (2 - i * 5) * k, t[1] + 3 * k], 13 + i * 4, k, P.wave + i * 0.4, Math.PI / 2 + 0.3, 0.9);
}

function drawFluke(sk: Sk, M: M, P: RP, k: number) {
  const f = fluke(P);
  const K = (v: V2): V2 => [v[0] * k, v[1] * k];
  sk.np();
  const stock = cbez(K(f.root), K(f.ctrl), K([f.base[0] + 3, f.base[1] + 8]), K(f.base), 10);
  sk.tube(stock, t => (16 - t * 11) * k, (p) => (p.v > 0.5 ? M.belly : M.skin), { z: 40 * k });
  if (f.h <= 0.25) return;
  // the flukes: a broad crescent seen from below as it rises, barnacle-scarred, leeches hanging
  const w = 40 * Math.min(1, f.h * 1.3);
  const b = K(f.base);
  for (const sd of [-1, 1]) {
    const tip: V2 = [b[0] + sd * w * k, b[1] - 13 * k * f.h];
    sk.np();
    sk.blade(b[0], b[1], tip[0], tip[1], s => (Math.sin(Math.min(1, s * 1.05 + 0.08) * Math.PI) * 9 + 1.6) * k * (1 - s * 0.35), (p) => {
      if (hh(Math.floor(p.x / (2 * k)), Math.floor(p.y / (2 * k)), 29) > 0.9) return M.barn;
      return p.v * sd > 0.5 ? M.fluke : M.flukeU;
    }, { z0: 44 * k, z1: 44 * k, bend: sd * -5 * k });
    for (let i = 0; i < 3; i++) {
      const u = 0.28 + i * 0.25;
      const a: V2 = [b[0] + (tip[0] - b[0]) * u, b[1] + (tip[1] - b[1]) * u + 3.5 * k];
      pennant(sk, M, a, 10 + ((i + (sd > 0 ? 1 : 0)) % 3) * 4, k, P.wave + i * 0.3 + sd, Math.PI / 2, 1);
    }
  }
}

/** white water sheeting off the reef as it breaks the surface or lifts its flukes */
function cascades(sk: Sk, P: RP, k: number) {
  const n = Math.round(26 * P.stream);
  for (let i = 0; i < n; i++) {
    let x: number, y: number;
    if (P.tail > 0.3 && i % 2) {
      const f = fluke(P);
      x = (f.base[0] + (hh(i, 1, 31) - 0.5) * 66) * k;
      y = (f.base[1] + 5) * k;
    } else {
      const X = -60 + hh(i, 2, 31) * 190;
      x = X * k; y = (topY(P, X) + 3) * k;
    }
    const L = (4 + hh(i, 3, 31) * 10) * k;
    for (let j = 0; j < L; j++) if (hh(i, j, 37) > 0.25) sk.over(x + (hh(j, i, 41) - 0.5) * 1.5, y + j, hh(i, j, 43) > 0.5 ? hex('#f4fbfd') : hex('#cfe9f1'));
  }
}

/** foam lapping round the waterline where the body meets the sea */
function foamLine(sk: Sk, P: RP, k: number) {
  const lo = lobes(P);
  const x0 = Math.min(...lo.map(l => l.cx - l.rx)), x1 = Math.max(...lo.map(l => l.cx + l.rx));
  for (let X = x0 - 4; X <= x1 + 6; X += 1 / k) {
    if (topY(P, X) > 1) continue;
    if (hh(Math.floor(X * k), 7, 61) < 0.35) continue;
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
      const kk = P.full ? k * PORTRAIT : k;
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

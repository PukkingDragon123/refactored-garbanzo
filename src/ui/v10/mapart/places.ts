// Region Map landmarks, painted by hand where they stand: Kittiwake Camp (the tent, Joshu's dome tent,
// the fire ring and its log seats, the research table under a tarp, Jenna's string lights, crates,
// the flag pole, the boatyard cradle and the trailhead signpost), the wreck of the Kittiwake on the
// west point's reef, the glowworm cave's mouth, the sea arch and the stacks, the whale's bones on the
// Serpent Coast, Te Kāinga (the carved wharenui facing the marae, whare, a pātaka, a cooking shelter,
// the palisade, waka drawn up on the bank), the old pā's broken palisade and carved gateway, the
// fallen kauri lookout, the vine bridge, the silica terraces and vents of the hot valley, the serpent
// fossil in the gorge wall, Motu Ahi's smoking cone. Small 3/4 boxes and gable roofs come from one
// prism painter.

import { C, hex, mix } from '../../../art/color';
import { Rng, clamp, hash2 } from '../../../core/math';
import { LM, S, CRITTERS } from '../mapgeo';
import type { Fields } from './field';
import type { Light } from './terrain';
import { W, H, P, TAG, WK, HOTW } from './kit';
import { Layer, crown } from './sprites';
import type { Feat } from './flora';
import { driftwood, boulder } from './flora';

const INKC = hex('#1a120c');

// ------------------------------------------------------------------ a 3/4 prism: a box with a gable roof
interface Prism {
  w: number; d: number; hw: number; gh: number; z0?: number;
  roof: C[]; wall: C[];
  /** the front face's own pixel (u: -w/2..w/2, z above z0), or null for the plain wall */
  front?: (u: number, z: number) => C | null;
  /** the bargeboards along the front edge of the roof */
  edge?: C;
  /** roof overhang at the sides */
  eave?: number;
}
function prism(l: Layer, x: number, y: number, o: Prism) {
  const hwid = o.w / 2, z0 = o.z0 ?? 0, ev = o.eave ?? 1;
  const zr = (u: number) => z0 + o.hw + o.gh * Math.max(0, 1 - Math.abs(u) / hwid) - Math.max(0, Math.abs(u) - hwid) * 0.8;
  const rn = o.roof.length;
  // the roof, back to front
  for (let dy = o.d; dy >= 0; dy--) {
    for (let u = -Math.ceil(hwid + ev); u <= Math.ceil(hwid + ev); u++) {
      const z = zr(u);
      const side = u < 0 ? 1 : u > 0 ? -1 : 0;
      let k = side > 0 ? rn - 2 : side < 0 ? 1 : rn - 1;
      if (dy % 3 === 0 && side !== 0) k = Math.max(0, k - 1);
      if (Math.abs(u) > hwid) k = 0;
      l.px(x + u, Math.round(y - z - dy), o.roof[clamp(k, 0, rn - 1)], z + 1);
    }
  }
  // the front face
  for (let u = -Math.floor(hwid); u <= Math.floor(hwid); u++) {
    const top = zr(u);
    for (let z = z0; z <= top; z++) {
      const c = o.front?.(u, z - z0) ?? (z - z0 <= o.hw ? o.wall[u < 0 ? 2 : 1] : o.wall[3]);
      l.px(x + u, Math.round(y - z), c, z);
    }
    if (o.edge) l.px(x + u, Math.round(y - top), o.edge, top + 1);
  }
  // the corner posts' shadow side
  for (let z = z0; z <= z0 + o.hw; z++) l.px(x + Math.floor(hwid), Math.round(y - z), o.wall[0], z);
}

// ------------------------------------------------------------------ the camp
const CANVAS = [hex('#5e584a'), hex('#8a8474'), hex('#b4ae9c'), hex('#d8d2c0'), hex('#f0ecdc')];
const FLY = [hex('#5a1e10'), hex('#8a2e16'), hex('#b8441e'), hex('#d8642a'), hex('#ec8a3c')];
const DOME = [hex('#1a3a34'), hex('#24524a'), hex('#2e6c60'), hex('#3c8674'), hex('#56a08a')];
const TARP = [hex('#123a5a'), hex('#1a5078'), hex('#246a96'), hex('#3486b2')];
function campTent(l: Layer, x: number, y: number) {
  prism(l, x, y, {
    w: 16, d: 13, hw: 0, gh: 10, roof: FLY, wall: CANVAS, eave: 1, edge: FLY[0],
    front: (u, z) => (Math.abs(u) <= 2 && z <= 6 - Math.abs(u) ? (Math.abs(u) === 2 ? FLY[1] : hex('#1a120c')) : u < 0 ? CANVAS[4] : CANVAS[3]),
  });
  // guy ropes and pegs
  for (const [dx, dy] of [[-11, 1], [11, 1], [-10, -12], [10, -12]]) l.px(x + dx, y + dy, P.wood[2], 0);
}
function domeTent(l: Layer, x: number, y: number) {
  for (let yy = -9; yy <= 0; yy++) for (let xx = -8; xx <= 8; xx++) {
    const dx = xx / 8.5, dy = (yy + 1) / 9;
    if (dx * dx + dy * dy > 1) continue;
    const v = 0.55 - dx * 0.35 - dy * 0.25;
    let c = DOME[clamp(Math.round(v * 4), 0, 4)];
    if (Math.abs(xx) === 4 || (yy === -5 && Math.abs(xx) < 7)) c = DOME[0];
    if (xx > -2 && xx < 3 && yy > -5) c = hex('#14100c');
    l.px(x + xx, y + yy, c, -yy);
  }
}
function fireRing(l: Layer, x: number, y: number) {
  for (let a = 0; a < 10; a++) { const t = (a / 10) * Math.PI * 2; l.px(Math.round(x + Math.cos(t) * 4), Math.round(y + Math.sin(t) * 2.4), a % 2 ? P.stone[3] : P.stone[5], 1); }
  for (const [dx, dy, c] of [[0, 0, '#3a1e10'], [-1, 0, '#5a2a10'], [1, 0, '#5a2a10'], [0, -1, '#f4c24a'], [-1, -1, '#e8782a'], [1, -1, '#e05a20'], [0, -2, '#ffe07a'], [0, -3, '#f8a03a']] as [number, number, string][]) l.px(x + dx, y + dy, hex(c), 2 - dy, dy < 0 ? TAG.ember : 0);
  // log seats round it
  for (const [dx, dy, len] of [[-10, -3, 5], [6, -4, 5], [-4, 4, 6]] as [number, number, number][]) for (let t = 0; t < len; t++) { l.px(x + dx + t, y + dy - 1, P.wood[4], 2); l.px(x + dx + t, y + dy, P.wood[2], 1); }
}
function researchTable(l: Layer, x: number, y: number) {
  // the tarp on four poles
  for (const [px0, py0] of [[-9, 0], [9, 0], [-9, -8], [9, -8]]) for (let z = 0; z < 9; z++) l.px(x + px0, y + py0 - z, P.wood[2], z);
  for (let dy = 8; dy >= 0; dy--) for (let u = -10; u <= 10; u++) l.px(x + u, y - 9 - dy + Math.round(Math.abs(u) * 0.12), TARP[u < -4 ? 3 : u > 4 ? 1 : 2 - (dy % 4 === 0 ? 1 : 0)], 10);
  // the table, with papers and a laptop glow
  prism(l, x, y - 2, { w: 12, d: 5, hw: 3, gh: 0, roof: [P.wood[3], P.wood[4], P.wood[5], P.wood[5]], wall: P.wood, eave: 0 });
  l.px(x - 3, y - 9, hex('#f4f0e2'), 6); l.px(x - 2, y - 9, hex('#f4f0e2'), 6); l.px(x + 2, y - 8, hex('#7ad8f0'), 6, TAG.lights);
}
function crates(l: Layer, x: number, y: number) {
  prism(l, x, y, { w: 5, d: 4, hw: 4, gh: 0, roof: P.wood.slice(3), wall: P.wood, eave: 0 });
  prism(l, x + 6, y + 1, { w: 4, d: 4, hw: 3, gh: 0, roof: P.wood.slice(3), wall: P.wood, eave: 0 });
  prism(l, x + 2, y - 5, { w: 4, d: 3, hw: 3, gh: 0, z0: 4, roof: P.wood.slice(3), wall: P.wood, eave: 0 });
}
function stringLights(l: Layer, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  const cols = [hex('#ffe07a'), hex('#ff8a6a'), hex('#8ae0ff'), hex('#b0ff8a')];
  for (let k = 0; k <= n; k++) {
    const t = k / n, sag = Math.sin(t * Math.PI) * 3;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + sag);
    l.px(x, y, k % 3 === 0 ? cols[(k / 3) % 4 | 0] : hex('#2a2018'), 10, k % 3 === 0 ? TAG.lights : 0);
  }
}
function signpost(l: Layer, x: number, y: number) {
  for (let z = 0; z < 11; z++) l.px(x, y - z, z % 2 ? P.wood[2] : P.wood[3], z);
  for (let u = -1; u <= 5; u++) { l.px(x + u, y - 10, P.wood[5], 11); l.px(x + u, y - 9, P.wood[3], 10); }
  l.px(x + 6, y - 10, P.wood[4], 11);
  for (let u = -5; u <= 1; u++) { l.px(x + u, y - 7, P.wood[4], 8); l.px(x + u, y - 6, P.wood[2], 7); }
  l.px(x - 6, y - 7, P.wood[3], 8);
}
function flagPole(l: Layer, x: number, y: number) {
  for (let z = 0; z < 16; z++) l.px(x, y - z, z % 3 ? P.wood[3] : P.wood[1], z);
  l.px(x, y - 16, hex('#e8d88a'), 16);
}
function cradle(l: Layer, x: number, y: number) {
  // the boatyard: a cradle of timbers, planks laid out, sawhorses, a lean-to
  for (const dx of [-10, -3, 4, 11]) for (let z = 0; z < 4; z++) { l.px(x + dx, y - z, P.wood[2], z); l.px(x + dx + 1, y - z, P.wood[1], z); }
  for (let t = -12; t <= 13; t++) l.px(x + t, y - 4, P.wood[4], 4);
  for (let k = 0; k < 3; k++) for (let t = 0; t < 12; t++) l.px(x - 20 + t, y + 4 + k * 2, k % 2 ? P.wood[4] : P.wood[5], 0);
  for (const sx of [x + 18, x + 24]) { for (let z = 0; z < 3; z++) { l.px(sx - 1, y + 6 - z, P.wood[2], z); l.px(sx + 1, y + 6 - z, P.wood[2], z); } l.px(sx - 1, y + 3, P.wood[4], 3); l.px(sx, y + 3, P.wood[4], 3); l.px(sx + 1, y + 3, P.wood[4], 3); }
}

// ------------------------------------------------------------------ the wreck
const HULLW = [hex('#5a5650'), hex('#8a857a'), hex('#b8b2a2'), hex('#dcd6c4'), hex('#f0ecdc')];
const RUST = [hex('#3a1a10'), hex('#6a3018'), hex('#9a4a22')];
function wreck(l: Layer, x: number, y: number) {
  // the hull, holed and listing toward us on the reef, broken behind the wheelhouse
  const L = 42;
  for (let t = 0; t < L; t++) {
    if (t > 25 && t < 29) continue;
    const u = t / L;
    const bow = t > L - 9 ? (t - (L - 9)) / 9 : 0;
    const side = Math.round(7 * (1 - bow * 0.8));
    const keel = y + Math.round(u * -4) + Math.round(bow * -3);
    const deck = keel - side;
    for (let z = 0; z <= side; z++) {
      const yy = keel - z;
      let c = z < 2 ? P.wood[1] : z === side ? HULLW[4] : HULLW[2 + ((t + z) % 3 === 0 ? 1 : 0)];
      if (z > 1 && z < side && hash2(t, z, 3) > 0.8) c = RUST[1 + (t % 2)];
      if (z === 3 && t < L - 6) c = hex('#a8281e');
      l.px(x + t - 20, yy, c, z + 2);
    }
    // the deck, tilted toward the viewer
    for (let k = 1; k <= 4; k++) l.px(x + t - 20, deck - k, k === 4 ? P.wood[2] : P.wood[(t + k) % 2 ? 4 : 3], side + 2 + k);
  }
  // ribs where it broke
  for (let k = 0; k < 4; k++) for (let z = 0; z < 10; z++) if (z % 3 !== 1) l.px(x + 6 + k, y - 3 - z + (k % 2), P.wood[k % 2 ? 1 : 2], z + 2);
  // the wheelhouse and the broken mast, a spar fallen across
  for (let z = 0; z < 6; z++) for (let u = 0; u < 7; u++) l.px(x - 6 + u, y - 15 - z, u === 0 || z === 5 ? HULLW[4] : u > 4 ? HULLW[1] : HULLW[3], 14 + z);
  l.px(x - 4, y - 18, hex('#2a3a44'), 18); l.px(x - 3, y - 18, hex('#4a6a7a'), 18);
  for (let k = 0; k < 18; k++) l.px(x - 12 + Math.round(k * 0.35), y - 14 - k, k % 4 ? P.wood[2] : P.wood[1], 14 + k);
  for (let k = 0; k < 14; k++) l.px(x - 15 + k, y - 22 + Math.round(k * 0.3), P.wood[3], 22);
  for (let k = 0; k < 10; k++) l.px(x - 6 + k, y - 32 + k * 2, hex('#3a3028'), 20 + (10 - k));
}

// ------------------------------------------------------------------ the village
const WALLW = [hex('#2a180c'), hex('#4a2c16'), hex('#6a4220'), hex('#7e5228')];
const THATCH = P.thatch;
function wharenui(l: Layer, x: number, y: number) {
  const red = P.carve;
  prism(l, x, y, {
    w: 22, d: 30, hw: 5, gh: 10, roof: [hex('#2a1a10'), hex('#3e2816'), hex('#5a3a1e'), hex('#74502a'), hex('#8a6434')], wall: WALLW, edge: red[3], eave: 1,
    front: (u, z) => {
      // the porch: carved posts at the corners and the door, a window, the koruru at the apex
      if (Math.abs(u) >= 10) return red[2 + (z % 2)];
      if (z > 5 && Math.abs(u) <= 1 && z < 10) return red[z % 2 ? 4 : 1];
      if (z <= 5 && u >= -6 && u <= -3) return z <= 4 ? hex('#140c08') : red[2];
      if (z >= 2 && z <= 4 && u >= 3 && u <= 5) return hex('#1e140c');
      if (z <= 5) return WALLW[(u + z) % 3 === 0 ? 1 : 2];
      return hex('#c8b896');
    },
  });
  // the koruru (the ancestor's face) and the tekoteko on the ridge
  for (const [dx, dz, c] of [[0, 16, red[4]], [0, 17, red[3]], [-1, 16, hex('#f4f0e4')], [1, 16, hex('#f4f0e4')], [0, 18, red[2]], [0, 19, red[1]]] as [number, number, C][]) l.px(x + dx, y - dz, c, dz);
}
function whare(l: Layer, x: number, y: number, s: number, seed: number) {
  const w = Math.round(10 * s), d = Math.round(12 * s);
  prism(l, x, y, {
    w, d, hw: 3, gh: Math.round(5 * s), roof: THATCH.slice(1), wall: WALLW, eave: 1, edge: seed % 3 === 0 ? P.carve[2] : THATCH[1],
    front: (u, z) => (z <= 3 && u >= -1 && u <= 1 ? hex('#120a06') : null),
  });
}
function pataka(l: Layer, x: number, y: number) {
  for (let z = 0; z < 6; z++) { l.px(x - 2, y - z, P.wood[2], z); l.px(x + 2, y - z, P.wood[1], z); }
  prism(l, x, y - 1, { w: 8, d: 7, hw: 3, gh: 4, z0: 5, roof: THATCH.slice(1), wall: [P.carve[0], P.carve[1], P.carve[2], P.carve[3]], edge: P.carve[4], eave: 1 });
}
function cookShelter(l: Layer, x: number, y: number) {
  for (const [dx, dy] of [[-5, 0], [5, 0], [-5, -6], [5, -6]]) for (let z = 0; z < 5; z++) l.px(x + dx, y + dy - z, P.wood[2], z);
  prism(l, x, y, { w: 12, d: 7, hw: 0, gh: 4, z0: 4, roof: THATCH.slice(2), wall: THATCH, eave: 1 });
  for (const [dx, c] of [[-1, '#f0902e'], [0, '#ffd060'], [1, '#e05a20']] as [number, string][]) l.px(x + dx, y - 1, hex(c), 1, TAG.ember);
}
function palisade(l: Layer, cx: number, cy: number, rx: number, ry: number, gap: [number, number], broken = 0) {
  for (let a = 0; a < 360; a += 1.3) {
    const t = (a * Math.PI) / 180;
    if (t > gap[0] && t < gap[1]) continue;
    if (broken && hash2(a | 0, 3, 77) < broken) continue;
    const x = Math.round(cx + Math.cos(t) * rx), y = Math.round(cy + Math.sin(t) * ry);
    const h = 7 + ((a * 7) % 3 === 0 ? 1 : 0) - (broken && hash2(a | 0, 4, 77) < 0.5 ? 3 : 0);
    l.begin(Math.round(y));
    for (let z = 0; z < h; z++) { l.px(x, y - z, z >= h - 1 ? P.wood[5] : P.wood[3], z); l.px(x + 1, y - z, z >= h - 1 ? P.wood[3] : P.wood[1], z); }
    l.px(x, y - h, P.wood[4], h);
    if (!broken || hash2(a | 0, 5, 77) > 0.4) { l.px(x - 1, y - 2, P.wood[2], 2); l.px(x - 1, y - 5, P.wood[2], 5); }
  }
}
function waka(l: Layer, x: number, y: number, len: number) {
  for (let t = 0; t < len; t++) {
    const prow = t === 0 || t === len - 1;
    l.px(x + t, y - 1, prow ? P.carve[3] : P.wood[4], 2);
    l.px(x + t, y, P.wood[1], 1);
  }
  l.px(x - 1, y - 2, P.carve[3], 3); l.px(x + len, y - 3, P.carve[4], 4); l.px(x + len, y - 2, P.carve[3], 3);
}
function rack(l: Layer, x: number, y: number) {
  for (const dx of [-5, 5]) for (let z = 0; z < 6; z++) l.px(x + dx, y - z, P.wood[2], z);
  for (let u = -5; u <= 5; u++) l.px(x + u, y - 6, P.wood[4], 6);
  for (let u = -4; u <= 4; u += 2) { l.px(x + u, y - 5, hex('#c8b090'), 5); l.px(x + u, y - 4, hex('#a8906e'), 4); }
}

// ------------------------------------------------------------------ the pā
function gateway(l: Layer, x: number, y: number) {
  const red = P.carve;
  for (const dx of [-4, 4]) for (let z = 0; z < 10; z++) { l.px(x + dx, y - z, red[z % 3 === 0 ? 1 : 3], z); l.px(x + dx + (dx > 0 ? 1 : -1), y - z, red[1], z); }
  for (let u = -5; u <= 5; u++) { l.px(x + u, y - 10, red[4], 10); l.px(x + u, y - 11, red[2], 11); }
  l.px(x, y - 12, red[3], 12); l.px(x, y - 13, red[4], 13); l.px(x - 1, y - 12, hex('#f4f0e4'), 12); l.px(x + 1, y - 12, hex('#f4f0e4'), 12);
}
function ruinFrame(l: Layer, x: number, y: number, seed: number) {
  const rng = new Rng(seed);
  for (const [dx, dy] of [[-4, 0], [4, 0], [-4, -6], [4, -6], [0, -6]]) {
    const h = Math.round(rng.range(2, 6));
    for (let z = 0; z < h; z++) l.px(x + dx, y + dy - z, P.wood[z % 2 ? 1 : 2], z);
  }
  for (let u = -4; u <= 2; u++) l.px(x + u, y - 4, P.wood[3], 4);
}

// ------------------------------------------------------------------ the coast
function seaArch(l: Layer, x: number, y: number) {
  for (let yy = -22; yy <= 0; yy++) for (let xx = -14; xx <= 14; xx++) {
    const outer = Math.abs(xx) / 14 + Math.max(0, -yy - 14) * 0.08 + (hash2(xx, yy, 5) - 0.5) * 0.12;
    if (outer > 1) continue;
    const hole = Math.abs(xx) < 6 - Math.max(0, -yy - 8) * 0.6 && yy > -14;
    if (hole) continue;
    const v = 0.55 - xx / 20 + (yy < -18 ? 0.25 : 0) + (hash2(xx >> 1, yy, 6) - 0.5) * 0.2;
    let c = P.basalt[clamp(Math.round(v * 6), 0, 6)];
    if (yy < -19) c = yy < -20 ? hex('#4e7a36') : hex('#3a5e2a');
    else if (yy < -16 && hash2(xx, yy, 7) > 0.6) c = hex('#e4e0d2');
    l.px(x + xx, y + yy, c, -yy);
  }
}
function seaStack(l: Layer, x: number, y: number, s: number, seed: number) {
  const hh = Math.round(18 * s), wd = 4 * s;
  for (let yy = -hh; yy <= 0; yy++) {
    const w = wd + (yy > -4 ? (4 + yy) * 0.8 : 0) + (hash2(yy, seed, 3) - 0.5) * 1.2;
    for (let xx = Math.floor(-w); xx <= w; xx++) {
      const v = 0.55 - xx / (w * 2.2) + (hash2(xx, yy >> 1, seed) - 0.5) * 0.2;
      let c = P.basalt[clamp(Math.round(v * 6), 0, 6)];
      if (yy <= -hh + 2) c = yy === -hh ? hex('#5a8a3a') : hex('#3e6a2c');
      else if (yy < -hh + 6 && hash2(xx, yy, seed + 1) > 0.65) c = hex('#e8e4d6');
      l.px(x + xx, y + yy, c, -yy);
    }
  }
}
function whaleBones(l: Layer, x: number, y: number) {
  const bone = P.bone;
  // the spine along the sand, ribs arching over it, the great skull at the head
  for (let t = 0; t < 30; t++) l.px(x + t - 15, y + Math.round(Math.sin(t * 0.2) * 1.2), bone[t % 2 ? 3 : 4], 1);
  for (let k = 0; k < 7; k++) {
    const rx = x - 10 + k * 3.4, rh = 6 - Math.abs(k - 3) * 0.7;
    for (let z = 0; z <= rh; z++) { l.px(Math.round(rx - z * 0.3), y - z, bone[z === Math.round(rh) ? 5 : 3], z); l.px(Math.round(rx + 1 + z * 0.4), y - z + 1, bone[2], z); }
  }
  for (let yy = -4; yy <= 1; yy++) for (let xx = 0; xx < 9; xx++) if ((xx - 4) * (xx - 4) / 20 + (yy + 1.5) * (yy + 1.5) / 7 < 1) l.px(x + 15 + xx, y + yy, bone[xx < 4 ? 5 : 3], 3 - yy);
  l.px(x + 18, y - 2, hex('#3a3024'), 4);
}
function caveMouth(l: Layer, x: number, y: number) {
  for (let yy = -11; yy <= 0; yy++) for (let xx = -9; xx <= 9; xx++) {
    const k = (xx * xx) / 81 + ((yy + 1) * (yy + 1)) / 121;
    if (k > 1) continue;
    const inner = (xx * xx) / 25 + ((yy + 1) * (yy + 1)) / 64 < 1;
    let c = inner ? (yy > -2 ? hex('#0a0806') : hex('#100c0a')) : P.basalt[clamp(Math.round(4 - xx * 0.2 + (hash2(xx, yy, 9) - 0.5) * 2), 0, 6)];
    let tag = 0;
    if (inner && hash2(xx, yy, 10) > 0.88 && yy < -3) { c = hex('#6ad8ff'); tag = TAG.glow; }
    l.px(x + xx, y + yy, c, -yy + 1, tag);
  }
}
function volcano(l: Layer, x: number, y: number) {
  const R = 36, Hh = 34;
  for (let yy = -Hh - 2; yy <= 2; yy++) for (let xx = -R; xx <= R; xx++) {
    const u = Math.abs(xx) / R;
    const top = -Hh * (1 - u) ** 1.15 - 2;
    if (yy < top || yy > 2 - u * 2) continue;
    const crater = Math.abs(xx) < 7 && yy < -Hh + 4;
    let v = 0.55 - (xx / R) * 0.45 + (hash2(xx >> 1, yy >> 1, 11) - 0.5) * 0.18;
    // gullies down the cone
    if (Math.abs(Math.sin(xx * 0.55 + yy * 0.12)) > 0.92) v -= 0.15;
    let c = P.basalt[clamp(Math.round(v * 6), 0, 6)], tag = 0;
    if (crater) { c = Math.abs(xx) < 4 && yy > -Hh + 1 ? hex('#ff9a3a') : hex('#8a2a10'); tag = TAG.lava; }
    else if (yy > -6 && hash2(xx, yy, 12) > 0.7) c = hex('#e8e4d6');
    else if (yy > -2) c = P.basalt[1];
    l.px(x + xx, y + yy, c, Math.max(0, -yy), tag);
  }
  // a lava trickle down the north-west side
  for (let k = 0; k < 10; k++) l.px(x - 3 - Math.round(k * 0.6), y - Hh + 4 + k * 2, hex('#c8401a'), Hh - k * 2, TAG.lava);
}
function fallenKauri(l: Layer, x: number, y: number) {
  // the root plate standing up at one end, the great trunk lying through the forest
  for (let yy = -12; yy <= 0; yy++) for (let xx = -8; xx <= 8; xx++) {
    if ((xx * xx) / 64 + ((yy + 6) * (yy + 6)) / 36 > 1) continue;
    l.px(x + xx, y + yy, hash2(xx, yy, 13) > 0.7 ? hex('#4a3420') : P.earth[1 + Math.round(hash2(xx >> 1, yy, 14) * 2)], -yy);
  }
  for (let t = 0; t < 52; t++) {
    const yy = y + 2 + Math.round(t * 0.32);
    for (let k = 0; k < 5; k++) l.px(x + 6 + t, yy - k, P.bark[k === 4 ? 5 : k === 0 ? 1 : 3 + ((t + k) % 2 ? 0 : 1)], k);
  }
}
function vineBridge(l: Layer, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let k = 0; k <= n; k++) {
    const t = k / n, sag = Math.sin(t * Math.PI) * 5;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + sag);
    l.px(x, y, k % 2 ? P.wood[4] : P.wood[3], 30);
    l.px(x, y - 3, hex('#3e5a26'), 33);
  }
}
function terraces(l: Layer, x: number, y: number) {
  // silica steps cascading down the slope, a turquoise pool held on each
  for (let s = 0; s < 7; s++) {
    const cx = x + Math.round(Math.sin(s * 1.3) * 6) + s * 2, cy = y + s * 7, w = 16 - s * 0.6;
    for (let u = -Math.round(w); u <= w; u++) {
      const lip = Math.round(Math.abs(u) * 0.22 + Math.sin(u * 0.8 + s) * 0.6);
      for (let k = -4; k <= 1; k++) {
        const yy = cy + lip + k;
        let c: C;
        if (k === 1) c = P.silica[2];
        else if (k === 0) c = P.silica[5];
        else c = HOTW[clamp(Math.round(2 + (k + 4) * 0.6 + (hash2(u, k, s) - 0.5)), 0, 5)];
        l.px(cx + u, yy, c, 2, k < 0 ? TAG.glow * 0 : 0);
        if (k < 0) { l.scr.wat[yy * W + cx + u] = WK.hot; l.scr.kind[yy * W + cx + u] = 2; }
      }
      // the drip curtain over the lip
      if (hash2(u, s, 15) > 0.5) for (let k = 2; k < 4; k++) l.px(cx + u, cy + lip + k, P.silica[4 - (k - 2)], 1);
    }
  }
}
function vent(l: Layer, x: number, y: number) {
  for (let yy = -2; yy <= 1; yy++) for (let xx = -4; xx <= 4; xx++) {
    const k = (xx * xx) / 16 + (yy * yy) / 3;
    if (k > 1) continue;
    l.px(x + xx, y + yy, k < 0.35 ? hex('#1a120c') : k < 0.6 ? P.sulphur[1] : P.sulphur[3], 0);
  }
}

/** the serpent's bones showing in the gorge's striped wall (painted onto the face pixels) */
function fossil(f: Fields, l: Layer, x: number, y: number) {
  const s = l.scr;
  for (let t = 0; t < 60; t++) {
    const px = x + t - 30, py = y + Math.round(Math.sin(t * 0.16) * 5);
    const j = py * W + px;
    if (px < 0 || py < 0 || px >= W || py >= H || s.kind[j] !== 1) continue;
    s.col[j] = P.bone[t % 3 === 0 ? 5 : 4];
    if (t % 3 === 0) for (let k = 1; k <= 3; k++) { const jj = (py - k) * W + px + (k > 2 ? 1 : 0); if (s.kind[jj] === 1) s.col[jj] = P.bone[3]; const jb = (py + k) * W + px - (k > 2 ? 1 : 0); if (s.kind[jb] === 1) s.col[jb] = P.bone[2]; }
  }
  void f;
}

// ------------------------------------------------------------------ placing them
export function placeLandmarks(f: Fields, L: Light, l: Layer, feats: Feat[]) {
  const { hgt } = f;
  const hAt = (x: number, y: number) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : hgt[yi * W + xi]; };
  const add = (gx: number, gy: number, fn: (sx: number, sy: number) => void) => {
    const sy = Math.round(gy - hAt(gx, gy));
    feats.push({ gy, gx, f: () => { l.begin(Math.round(gy)); fn(Math.round(gx), sy); } });
  };
  const g = (v: number) => v * S;
  // ---- Kittiwake Camp
  const [tx, ty] = LM.tent;
  add(tx, ty, (x, y) => campTent(l, x, y));
  add(tx - 30, ty + 6, (x, y) => domeTent(l, x, y));
  add(LM.fire[0], LM.fire[1], (x, y) => fireRing(l, x, y));
  add(LM.table[0], LM.table[1], (x, y) => researchTable(l, x, y));
  add(tx + 18, ty + 14, (x, y) => crates(l, x, y));
  add(LM.flag[0], LM.flag[1], (x, y) => flagPole(l, x, y));
  add(tx + 12, ty - 2, (x, y) => { const [ax, ay] = [x, y - 9], b = LM.table; stringLights(l, ax, ay, Math.round(b[0] - 9), Math.round(b[1] - hAt(b[0], b[1]) - 9)); });
  add(LM.boatyard[0], LM.boatyard[1], (x, y) => cradle(l, x, y));
  add(LM.signpost[0], LM.signpost[1], (x, y) => signpost(l, x, y));
  add(tx - 60, ty + 26, (x, y) => driftwood(l, x, y, 9, 3));
  add(tx + 80, ty + 30, (x, y) => driftwood(l, x, y, 7, 5));
  // ---- the wreck, and its debris washed up
  add(LM.wreck[0], LM.wreck[1], (x, y) => wreck(l, x, y));
  add(LM.wreck[0] + 40, LM.wreck[1] + 30, (x, y) => crates(l, x, y));
  add(LM.wreck[0] + 70, LM.wreck[1] + 36, (x, y) => driftwood(l, x, y, 8, 7));
  for (let k = 0; k < 9; k++) { const a = k * 0.7; add(LM.wreck[0] + Math.cos(a) * 26, LM.wreck[1] + 6 + Math.sin(a) * 9, (x, y) => boulder(l, x, y, 2 + (k % 3), P.basalt, k * 31, 0.5, k % 2 === 0)); }
  // ---- the seal rocks, the glowworm cave, the sea arch and the stacks
  for (let k = 0; k < 6; k++) add(LM.seals[0] - 16 + k * 7, LM.seals[1] + (k % 2) * 4, (x, y) => boulder(l, x, y, 3 + (k % 3), P.basalt, k * 17 + 4, 0.55));
  add(LM.cave[0] - 4, LM.cave[1] + 6, (x, y) => caveMouth(l, x, y));
  add(LM.arch[0], LM.arch[1], (x, y) => seaArch(l, x, y));
  LM.stacks.forEach(([sx, sy], k) => add(sx, sy, (x, y) => seaStack(l, x, y, 0.7 + (k % 3) * 0.25, k * 13 + 2)));
  add(LM.whale[0], LM.whale[1], (x, y) => whaleBones(l, x, y));
  add(LM.volcano[0], LM.volcano[1] + 14, (x, y) => volcano(l, x, y));
  // ---- the great forest's fallen giant, the vine bridge to the pā
  add(LM.lookout[0], LM.lookout[1], (x, y) => fallenKauri(l, x, y));
  add(LM.bridge[0], LM.bridge[1], (x, y) => { const y1 = Math.round(g(292) - hAt(g(330), g(292))); vineBridge(l, x - 6, y - 6, Math.round(g(328)), y1 - 4); });
  // ---- Te Kāinga
  const [vx, vy] = LM.village;
  add(vx, vy - 52, (x, y) => wharenui(l, x, y));
  const huts: [number, number, number][] = [[-70, -36, 1], [-88, -4, 0.9], [-74, 30, 1.1], [64, -38, 1], [84, -6, 0.9], [70, 30, 1], [-34, 54, 0.9], [24, 58, 1], [-100, -44, 0.8], [104, -40, 0.8]];
  huts.forEach(([dx, dy, s], k) => add(vx + dx, vy + dy, (x, y) => whare(l, x, y, s, k)));
  add(vx + 34, vy - 46, (x, y) => pataka(l, x, y));
  add(vx - 36, vy - 52, (x, y) => cookShelter(l, x, y));
  add(vx + 44, vy + 46, (x, y) => rack(l, x, y));
  add(vx - 60, vy + 52, (x, y) => rack(l, x, y));
  feats.push({ gy: vy - 72, gx: vx, f: () => palisade(l, vx + 10, Math.round(vy - 6 - hAt(vx, vy)), 116, 72, [Math.PI * 0.35, Math.PI * 0.62]) });
  for (const [wx, wy] of CRITTERS.waka[1].slice(0, 1)) add(wx - 30, wy + 12, (x, y) => waka(l, x, y, 14));
  add(vx - 44, vy + 70, (x, y) => waka(l, x, y, 12));
  // ---- the old pā
  const [px, py] = LM.pa;
  add(px, py + 40, (x, y) => gateway(l, x, y));
  feats.push({ gy: py - 30, gx: px, f: () => palisade(l, px, Math.round(py - hAt(px, py)), 34, 22, [Math.PI * 0.42, Math.PI * 0.58], 0.35) });
  add(px - 12, py - 4, (x, y) => ruinFrame(l, x, y, 3));
  add(px + 14, py + 6, (x, y) => ruinFrame(l, x, y, 7));
  for (let k = 0; k < 6; k++) add(px + Math.cos(k) * 40, py + 10 + Math.sin(k) * 26, (x, y) => boulder(l, x, y, 2, P.stone, k * 5, 0.5, true));
  // ---- the hot valley: silica terraces, vents
  add(g(632), g(426), (x, y) => terraces(l, x, y));
  for (const [ax, ay] of [[626, 400], [644, 392], [660, 407], [676, 398], [651, 418], [636, 424]] as [number, number][]) add(g(ax), g(ay), (x, y) => vent(l, x, y));
  // ---- a few lone giants on the rim of the sinkhole (the forest keeps clear of the shaft)
  for (let k = 0; k < 5; k++) { const a = -0.4 - k * 0.6; add(LM.sink[0] + Math.cos(a) * 128, LM.sink[1] + Math.sin(a) * 58, (x, y) => crown(l, x, y - 8, 7, P.tawa, 0.6, k * 99, 6)); }
  void L; void mix; void INKC;
}

/** after the sprites: details painted onto the finished picture */
export function paintOver(f: Fields, l: Layer) {
  fossil(f, l, Math.round(LM.bones[0]), Math.round(LM.bones[1] - 70));
}

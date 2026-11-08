// V12 Te Kāinga's ground, in depth (user: "the floor needs to be super detailed, play a lot more with
// perspective"). The ground from the walk line down to the camera is painted as bands, each on its own
// parallax layer (src/game/v11/village/floorbands.ts), so the nearer ground slides past faster than the
// walk line and swells when the camera zooms. Inside a band every pixel is worked out in floor
// coordinates (fx = x / perspective, fy = tilt x real depth), so the texture and everything lying on the
// ground grows and un-squashes toward the camera like a real ground plane.
//
// Pass 1, the surface by zone (borders wander): the river (reflective water) and its mud bank with
// shells, trodden paths with a lighter worn line and dry cracks, grass with blade grain, the gardens'
// furrows, the marae's mown grass and its flagstone path, Te Huarahi's packed earth with cart ruts and
// crushed shell, wood chips under the carving shed, straw round the pen and the hens, gravel at the gate.
// Pass 2, things on the ground, back to front, each hand-shaped and sized for its depth: pebbles with
// contact shadows, grass tufts with clover and daisies, footprint trails (boots, bare feet, hens, dogs)
// along the paths, sticks, fallen leaves and nīkau fronds, chips and curls, straw, shells, feathers,
// puddles in the ruts holding the sky (they go into the water pass too).

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import { Rng, bayer, clamp, fbm1, fbm2, hash2 } from '../../../core/math';

export type VZone = 'river' | 'mud' | 'path' | 'grass' | 'tilled' | 'marae' | 'lane' | 'chips' | 'straw' | 'gravel';
export interface VFloor {
  /** scene width on the walk plane */
  W: number;
  /** the walk line */
  ground: (x: number) => number;
  /** what the ground is at a walk-plane x */
  zoneAt: (x: number) => VZone;
  /** x ranges with a flagstone path (the marae) */
  flags?: [number, number][];
  seed: number;
}
export interface FloorBand {
  /** the band's parallax (1 = the walk plane) */
  p: number;
  /** depth rows (on the walk plane's scale) the band covers */
  dd0: number;
  dd1: number;
  /** the band's top edge: tufts and crumbs sticking up (nearer bands) or flat */
  edge: boolean;
}
export interface FloorChunk { y0: number; base: PixelBuffer; water: PixelBuffer }

/** rows from the walk line to the vanishing horizon, and the ground plane's tilt */
export const VHOR = 80, TILT = 2.4;
export const vpersp = (dd: number) => (VHOR + Math.max(0, dd)) / VHOR;
const floorY = (dd: number) => (TILT * VHOR * Math.max(0, dd)) / (VHOR + Math.max(0, dd));

const R = (...h: string[]): C[] => h.map(v => hex(v));
const P = {
  dirt: R('#1e140c', '#2e2016', '#43301f', '#5a4229', '#735536', '#8c6a44', '#a88454', '#c4a06a'),
  dirtLight: R('#4a3826', '#64503a', '#7e684c', '#98805e', '#b09872', '#c8b088'),
  grass: R('#14240e', '#1e3414', '#2a4818', '#3a5e1e', '#4c7626', '#62902e', '#7eaa3a', '#a2c44e'),
  grassMown: R('#26401a', '#365a20', '#487226', '#5c8a2e', '#76a238', '#98bc48'),
  soil: R('#1a0e08', '#2a180e', '#3c2414', '#52321c', '#6a4426', '#845832'),
  mud: R('#120c08', '#1c140e', '#2a1e14', '#3a2a1c', '#4c3824', '#64503a'),
  straw: R('#5a4418', '#7a5e22', '#9a7a2e', '#bc9a3e', '#d8b852', '#f0d474'),
  chip: R('#6a4a28', '#8a6436', '#aa7e46', '#c89a5a', '#e2b874', '#f4d4a0'),
  stone: R('#1e1c1a', '#302d2a', '#46423c', '#5e5850', '#787066', '#948a7e', '#b0a698', '#d0c8ba'),
  water: R('#0a1a20', '#10283a', '#18384c', '#22506a', '#30688a', '#4a8aa8', '#7ab0c8'),
  shell: R('#c8b8a8', '#e4d8ca', '#f6f0e6', '#e8c0b0'),
  leaf: R('#3a2a10', '#5a4018', '#7a5a22', '#4a5a1c', '#6a7a26'),
  flower: R('#f4f0e6', '#f0d040', '#e8a020', '#d07090'),
  ink: hex('#120c08'),
};
const pk = (r: C[], v: number, x: number, y: number) => r[clamp(Math.floor(v + (bayer(x, y) - 0.5) * 0.9), 0, r.length - 1)];

/** paint one chunk [X0, X0 + w) of a band (layer x), its top row and the rows below */
export function paintVillageBand(F: VFloor, B: FloorBand, X0: number, w: number): FloorChunk {
  const p = B.p;
  const gyOf = (X: number) => F.ground(X / p);
  let minT = 1e9, maxT = -1e9;
  for (let X = X0; X < X0 + w; X += 4) { const g = gyOf(X); minT = Math.min(minT, g); maxT = Math.max(maxT, g); }
  const y0 = Math.floor(minT + B.dd0) - 12;
  const h = Math.ceil(maxT + B.dd1 - y0) + 2;
  const base = new PixelBuffer(w, h), water = new PixelBuffer(w, h);
  const seed = F.seed + Math.round(p * 100);
  // where the zones change, they wander (a wobble in floor coords)
  const zoneOf = (X: number, dd: number) => F.zoneAt(X / p + (fbm1(dd * 0.08 + X * 0.013, 2, seed) - 0.5) * 30 * vpersp(dd));
  // ---- pass 1: the surface
  for (let X = X0; X < X0 + w; X++) {
    const gy = gyOf(X);
    const yTop = Math.round(gy + B.dd0), yBot = Math.round(gy + B.dd1);
    for (let Y = yTop; Y < yBot; Y++) {
      const dd = Y - gy, wp = vpersp(dd);
      const fx = X / wp, fy = floorY(dd);
      const z = zoneOf(X, dd);
      const c = surface(F, z, X / p, fx, fy, dd, X, Y, seed);
      const i = (Y - y0) * w + (X - X0);
      base.data[i] = c.c;
      if (c.w) water.data[i] = c.c;
    }
  }
  // ---- pass 2: things on the ground, back to front
  const rng = new Rng(seed * 31 + X0);
  const items: { X: number; Y: number; dd: number; k: number }[] = [];
  const area = w * (B.dd1 - B.dd0);
  const n = Math.round(area / 30);
  for (let i = 0; i < n; i++) {
    const X = X0 + rng.next() * w, dd = B.dd0 + rng.next() * (B.dd1 - B.dd0);
    items.push({ X, Y: gyOf(X) + dd, dd, k: rng.next() });
  }
  // the band's top edge: tufts and crumbs breaking the line (the nearer bands only)
  if (B.edge) for (let X = X0; X < X0 + w; X += 3 + rng.next() * 4) items.push({ X, Y: gyOf(X) + B.dd0 + 1, dd: B.dd0 + 1, k: -1 });
  items.sort((a, b) => a.Y - b.Y);
  const put = (x: number, y: number, c: C, wat = false) => {
    const xi = Math.round(x) - X0, yi = Math.round(y) - y0;
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
    base.data[yi * w + xi] = c;
    if (wat) water.data[yi * w + xi] = c; else water.data[yi * w + xi] = 0;
  };
  const get = (x: number, y: number) => { const xi = Math.round(x) - X0, yi = Math.round(y) - y0; return xi < 0 || yi < 0 || xi >= w || yi >= h ? 0 : base.data[yi * w + xi]; };
  for (const it of items) {
    const z = zoneOf(it.X, it.dd), wp = vpersp(it.dd), sq = squash(it.dd);
    if (it.k < 0) { edgeBit(put, it.X, it.Y, z, wp, rng); continue; }
    feature(put, get, z, it.X, it.Y, wp, sq, it.k, rng, it.dd, F, p);
  }
  // footprint trails along the worn paths (pairs stepping along x)
  footprints(put, get, F, B, X0, w, gyOf, zoneOf, seed);
  return { y0, base, water };
}

/** how flat a round thing lying on the ground looks at depth dd (height / width) */
const squash = (dd: number) => clamp(0.34 + dd / 170, 0.34, 0.85);

// ---------------------------------------------------------------- the surface
const OUT = { c: 0 as C, w: false };
function surface(F: VFloor, z: VZone, xm: number, fx: number, fy: number, dd: number, X: number, Y: number, seed: number) {
  OUT.w = false;
  const n = fbm2(fx * 0.06, fy * 0.08, 2, seed);
  const fine = hash2(Math.floor(fx * 1.3), Math.floor(fy * 1.1), seed + 3);
  const dark = clamp(dd / 120) * 0.9; // the ground nearer the camera sits a little out of the sun
  let c: C;
  switch (z) {
    case 'river': {
      // the river: dark water with ripple bands and sky glints, reflective
      const rip = Math.sin(fy * 0.9 + fx * 0.04 + n * 4) > 0.82;
      c = pk(P.water, 2.4 + n * 1.4 + (rip ? 1.6 : 0) - dark, X, Y);
      if (hash2(Math.floor(fx * 0.5), Math.floor(fy * 0.6), seed + 9) > 0.985) c = P.water[6];
      OUT.w = true;
      break;
    }
    case 'mud': {
      const sheen = Math.sin(fx * 0.12 + n * 6) > 0.9 && fine > 0.4;
      c = pk(P.mud, 2.4 + n * 1.8 + (sheen ? 1.4 : 0) - dark, X, Y);
      if (fine > 0.992) c = P.shell[Math.floor(fine * 997) % 3];
      break;
    }
    case 'tilled': {
      // furrows run along the rows: ridge lit, trough dark, crumbs
      const f = Math.sin(fy * 0.75);
      c = pk(P.soil, 2.6 + f * 1.4 + n * 0.8 - dark, X, Y);
      if (fine > 0.97) c = P.soil[5];
      break;
    }
    case 'grass':
    case 'marae': {
      const ramp = z === 'marae' ? P.grassMown : P.grass;
      // blade grain: short upright streaks, finer far away
      const blade = hash2(Math.floor(fx * 1.6), Math.floor(fy * 0.45 + fx * 0.3), seed + 5);
      c = pk(ramp, 2.8 + n * 1.6 + (blade > 0.7 ? 0.9 : blade < 0.2 ? -0.8 : 0) - dark, X, Y);
      // the marae's flagstone path to the wharenui
      if (z === 'marae' && F.flags?.some(([a, b]) => xm > a && xm < b)) {
        const fs = flagstone(fx, fy, seed);
        if (fs >= 0) c = pk(P.stone, 3.6 + fs * 1.4 - n * 0.6 - dark, X, Y);
        else if (fs > -0.3) c = pk(P.grass, 1.5, X, Y); // moss in the joints
      }
      break;
    }
    case 'lane': {
      // packed earth, lighter on the crown, two cart ruts along it, crushed shell and sawdust
      const rut = Math.min(Math.abs(fy - 9), Math.abs(fy - 19));
      const inRut = rut < 1.6, ridge = rut >= 1.6 && rut < 2.6;
      c = pk(P.dirtLight, 2.4 + n * 1.6 - (inRut ? 2.2 : 0) + (ridge ? 1.1 : 0) - dark, X, Y);
      if (inRut && n > 0.74) { c = pk(P.water, 3 + n * 2, X, Y); OUT.w = true; }
      else if (fine > 0.985) c = P.shell[1 + (Math.floor(fine * 991) % 2)];
      break;
    }
    case 'chips':
      c = pk(P.dirt, 3 + n * 1.2 - dark, X, Y);
      if (fine > 0.8) c = pk(P.chip, 2 + fine * 4, X, Y);
      break;
    case 'straw':
      c = pk(P.dirt, 3.2 + n * 1.2 - dark, X, Y);
      if (Math.sin(fx * 1.7 + fy * 0.6 + n * 8) > 0.88 || fine > 0.93) c = pk(P.straw, 2 + n * 3, X, Y);
      break;
    case 'gravel': {
      const g = hash2(Math.floor(fx * 0.7), Math.floor(fy * 0.7), seed + 11);
      c = pk(P.stone, 2.6 + g * 3 + n - dark, X, Y);
      break;
    }
    default: {
      // a trodden path: worn lighter along the middle, dry cracks where it bakes
      const worn = clamp(1 - Math.abs(fy - 12) / 12);
      c = pk(P.dirt, 3.2 + n * 1.5 + worn * 1.2 - dark, X, Y);
      if (crack(fx, fy, seed) && worn > 0.2) c = P.dirt[1];
      if (fine > 0.988) c = P.stone[5];
    }
  }
  OUT.c = c;
  return OUT;
}

/** flagstones laid in a path (>= 0 inside a stone: how lit; < 0 the joints) */
function flagstone(fx: number, fy: number, seed: number) {
  const sx = 14, sy = 9;
  const row = Math.floor(fy / sy), off = (row & 1) * 7;
  const gx = Math.floor((fx + off) / sx);
  const u = ((fx + off) / sx) - gx, v = fy / sy - row;
  const jit = hash2(gx, row, seed) * 0.12;
  const e = Math.min(u - jit, 1 - u - jit, v - 0.08, 0.92 - v);
  if (e < 0) return -0.2;
  return clamp(0.5 - v * 0.4 + (u < 0.15 ? 0.3 : 0) + hash2(gx, row, seed + 1) * 0.3 - 0.15);
}
/** dry-earth cracks: the edges of irregular cells */
function crack(fx: number, fy: number, seed: number) {
  const cx = fx / 9, cy = fy / 6;
  const gx = Math.floor(cx), gy = Math.floor(cy);
  let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const px = gx + i + hash2(gx + i, gy + j, seed + 21), py = gy + j + hash2(gx + i, gy + j, seed + 22);
    const d = Math.hypot(cx - px, cy - py);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1 < 0.06 && hash2(gx, gy, seed + 23) > 0.35;
}

// ---------------------------------------------------------------- things on the ground
type Put = (x: number, y: number, c: C, wat?: boolean) => void;
type Get = (x: number, y: number) => C;

function feature(put: Put, get: Get, z: VZone, X: number, Y: number, wp: number, sq: number, k: number, rng: Rng, dd: number, F: VFloor, p: number) {
  if (z === 'river') { if (k < 0.12) ripple(put, X, Y, wp); return; }
  // right under the camera, now and then something big: a stone, a clump of grass, a fallen frond
  if (dd > 72 && k > 0.985) {
    if (z === 'grass' || z === 'marae' || z === 'tilled') { tuft(put, X, Y, wp, 2.4, rng); tuft(put, X + 4 * wp, Y + 1, wp, 1.8, rng); }
    else if (k > 0.993) frond(put, X, Y, wp, rng);
    else pebble(put, get, X, Y, wp * (2.6 + rng.next() * 1.4), sq, rng);
    return;
  }
  if (z === 'grass' || z === 'marae') {
    if (k < 0.55) tuft(put, X, Y, wp, z === 'marae' ? 0.7 : 1, rng);
    else if (k < 0.66) flowers(put, X, Y, wp, rng);
    else if (k < 0.74) clover(put, X, Y, wp, sq);
    else if (k < 0.82) pebble(put, get, X, Y, wp * (0.8 + rng.next() * 0.8), sq, rng);
    else if (k < 0.86) leaf(put, X, Y, wp, rng);
    else if (k < 0.88) stick(put, X, Y, wp, sq, rng);
    return;
  }
  if (z === 'mud') {
    if (k < 0.3) shell(put, X, Y, wp, sq, rng);
    else if (k < 0.5) pebble(put, get, X, Y, wp, sq, rng);
    else if (k < 0.62) tuft(put, X, Y, wp * 0.8, 0.6, rng, true);
    else if (k < 0.64) puddle(put, X, Y, wp, sq, rng);
    return;
  }
  if (z === 'tilled') {
    if (k < 0.25) seedling(put, X, Y, wp, rng);
    else if (k < 0.45) pebble(put, get, X, Y, wp * 0.7, sq, rng);
    return;
  }
  if (z === 'chips') { if (k < 0.75) chip(put, X, Y, wp, rng); else if (k < 0.85) stick(put, X, Y, wp, sq, rng); return; }
  if (z === 'straw') { if (k < 0.7) strawBit(put, X, Y, wp, rng); else if (k < 0.8) feather(put, X, Y, wp, rng); else if (k < 0.9) pebble(put, get, X, Y, wp * 0.7, sq, rng); return; }
  if (z === 'gravel') { pebble(put, get, X, Y, wp * (0.6 + rng.next()), sq, rng); return; }
  // paths and the lane: mostly small stuff, now and then a stone, rarely a puddle (in the lane)
  if (k < 0.16) pebble(put, get, X, Y, wp * (0.5 + rng.next() * 0.9), sq, rng);
  else if (k < 0.24) stick(put, X, Y, wp, sq, rng);
  else if (k < 0.32) leaf(put, X, Y, wp, rng);
  else if (k < 0.38 && z === 'lane') shell(put, X, Y, wp, sq, rng);
  else if (k < 0.44 && z === 'lane') strawBit(put, X, Y, wp, rng);
  else if (k < 0.448 && z === 'lane') puddle(put, X, Y, wp, sq, rng);
  else if (k < 0.52) tuft(put, X, Y, wp * 0.8, 0.7, rng);
  void dd; void F; void p;
}

function edgeBit(put: Put, X: number, Y: number, z: VZone, wp: number, rng: Rng) {
  if (z === 'river') return;
  if (z === 'grass' || z === 'marae' || z === 'tilled') { tuft(put, X, Y + 1, wp, 0.8, rng); return; }
  // a lip of crumbs and small stones
  const r = Math.max(1, Math.round(wp * (0.6 + rng.next() * 0.8)));
  const ramp = z === 'gravel' ? P.stone : z === 'straw' ? P.straw : z === 'chips' ? P.chip : P.dirt;
  for (let i = -r; i <= r; i++) for (let j = -r; j <= 0; j++) if (i * i + j * j * 3 <= r * r) put(X + i, Y + j, ramp[clamp(4 + (j < 0 ? 1 : 0) - (i > 0 ? 1 : 0), 0, ramp.length - 1)]);
  put(X - r - 1, Y + 1, P.ink);
}

function pebble(put: Put, get: Get, X: number, Y: number, s: number, sq: number, rng: Rng) {
  const rx = Math.max(1, 1.2 * s), ry = Math.max(1, rx * sq * 1.3);
  const lobes = [rng.next(), rng.next(), rng.next()];
  // contact shadow first
  for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) put(X + i, Y + Math.ceil(ry) * 0.6 + 1, shade(get(X + i, Y + ry + 1) || P.dirt[2], -0.35));
  for (let j = -Math.ceil(ry * 1.6); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) {
    const a = Math.atan2(j, i), r = 1 + (lobes[0] - 0.5) * 0.3 * Math.sin(a * 2 + lobes[1] * 6) + (lobes[2] - 0.5) * 0.25 * Math.cos(a * 3);
    const u = i / rx, v = j / (j < 0 ? ry * 1.6 : ry);
    if (u * u + v * v > r * r) continue;
    const l = 3.6 - u * 1.2 - v * 1.6;
    put(X + i, Y + j, P.stone[clamp(Math.round(l + (bayer(X + i, Y + j) - 0.5) * 0.8), 1, 7)]);
  }
  if (rx >= 2) put(X - Math.round(rx * 0.3), Y - Math.round(ry), P.stone[7]);
}

function tuft(put: Put, X: number, Y: number, wp: number, hk: number, rng: Rng, reed = false) {
  const blades = 3 + Math.floor(rng.next() * 4);
  const H = (3 + rng.next() * 4) * wp * hk;
  for (let b = 0; b < blades; b++) {
    const lean = (rng.next() - 0.5) * 1.4 + (b - blades / 2) * 0.35;
    const len = H * (0.6 + rng.next() * 0.5);
    const bx = X + (b - blades / 2) * Math.max(1, wp * 0.7);
    for (let t = 0; t <= len; t += 0.5) {
      const u = t / len;
      const x = bx + lean * u * u * len * 0.45, y = Y - t;
      const c = reed ? P.straw[clamp(Math.round(1 + u * 3), 0, 5)] : P.grass[clamp(Math.round(2 + u * 5), 0, 7)];
      put(x, y, c);
      if (wp > 1.5 && u < 0.5) put(x + 1, y, P.grass[clamp(Math.round(1 + u * 4), 0, 7)]);
    }
  }
  put(X, Y + 1, P.grass[1]);
}
function flowers(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const n = 1 + Math.floor(rng.next() * 3), daisy = rng.next() < 0.6;
  for (let i = 0; i < n; i++) {
    const x = X + (rng.next() - 0.5) * 6 * wp, y = Y - rng.next() * 2 * wp - 2;
    for (let t = 0; t < 3 * wp; t++) put(x, y + t, P.grass[4]);
    if (daisy) { put(x - 1, y, P.flower[0]); put(x + 1, y, P.flower[0]); put(x, y - 1, P.flower[0]); put(x, y + 1, P.flower[0]); put(x, y, P.flower[1]); if (wp > 1.5) { put(x - 2, y, P.flower[0]); put(x + 2, y, P.flower[0]); } }
    else { put(x, y, P.flower[1]); put(x + 1, y, P.flower[2]); put(x, y - 1, P.flower[1]); }
  }
}
function clover(put: Put, X: number, Y: number, wp: number, sq: number) {
  const r = Math.max(1, Math.round(wp));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) for (let i = 0; i < r; i++) for (let j = 0; j < Math.max(1, Math.round(r * sq)); j++) put(X + dx * r + i, Y + dy * r * sq + j, P.grass[6 - ((i + j) & 1)]);
}
function seedling(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const h = (2 + rng.next() * 2) * wp;
  for (let t = 0; t < h; t++) put(X, Y - t, P.grass[4]);
  put(X - 1, Y - h, P.grass[6]); put(X + 1, Y - h, P.grass[5]); put(X - 1, Y - h + 1, P.grass[5]);
  if (wp > 1.4) { put(X - 2, Y - h, P.grass[6]); put(X + 2, Y - h + 1, P.grass[5]); }
}
function stick(put: Put, X: number, Y: number, wp: number, sq: number, rng: Rng) {
  const len = (4 + rng.next() * 6) * wp, a = (rng.next() - 0.5) * 0.9;
  for (let t = 0; t < len; t++) { const x = X + Math.cos(a) * t, y = Y + Math.sin(a) * t * sq; put(x, y, P.leaf[t < 1 ? 2 : 1]); if (wp > 1.5) put(x, y + 1, P.ink); }
  // a fork
  const ft = len * 0.6;
  for (let t = 0; t < len * 0.3; t++) put(X + Math.cos(a) * ft + Math.cos(a - 0.7) * t, Y + (Math.sin(a) * ft + Math.sin(a - 0.7) * t) * sq, P.leaf[1]);
}
function leaf(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const L = (2 + rng.next() * 3) * wp, a = rng.next() * Math.PI, col = rng.next() < 0.5 ? 3 : 1;
  for (let t = -L; t <= L; t += 0.5) {
    const wdt = Math.sqrt(Math.max(0, 1 - (t / L) ** 2)) * L * 0.45;
    for (let s = -wdt; s <= wdt; s += 0.7) {
      const x = X + Math.cos(a) * t - Math.sin(a) * s * 0.5, y = Y + (Math.sin(a) * t + Math.cos(a) * s * 0.5) * 0.5;
      put(x, y, Math.abs(s) < 0.6 ? P.leaf[col - 1 < 0 ? 0 : col - 1] : P.leaf[col + (s < 0 ? 1 : 0)] ?? P.leaf[col]);
    }
  }
}
/** a fallen nīkau frond: a long arching rachis with its leaflets, browning at the tips */
function frond(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const L = (14 + rng.next() * 10) * wp, dir = rng.chance(0.5) ? 1 : -1;
  for (let t = 0; t <= L; t += 0.5) {
    const u = t / L, x = X + dir * t, y = Y - Math.sin(u * Math.PI) * 2 * wp;
    put(x, y, P.leaf[u > 0.8 ? 2 : 4]);
    if (Math.round(t) % Math.max(2, Math.round(wp * 1.5)) === 0) {
      const ll = (3 + Math.sin(u * Math.PI) * 4) * wp * 0.6;
      for (let k = 1; k < ll; k++) { put(x + dir * k * 0.6, y - k * 0.35, P.leaf[u > 0.75 ? 1 : 3 + (k & 1)]); put(x + dir * k * 0.6, y + k * 0.3, P.leaf[u > 0.75 ? 0 : 3]); }
    }
  }
}
function shell(put: Put, X: number, Y: number, wp: number, sq: number, rng: Rng) {
  const r = Math.max(1, Math.round(wp * (1 + rng.next())));
  for (let i = -r; i <= r; i++) for (let j = -r; j <= 0; j++) {
    if (i * i + j * j > r * r) continue;
    put(X + i, Y + j * sq, (i + 8) % 2 ? P.shell[1] : P.shell[2]);
  }
  put(X, Y + 1, P.shell[0]);
  if (rng.next() < 0.3) put(X + 1, Y - 1, P.shell[3]);
}
function puddle(put: Put, X: number, Y: number, wp: number, sq: number, rng: Rng) {
  const rx = (3 + rng.next() * 6) * wp, ry = rx * sq * 0.7;
  for (let j = -Math.ceil(ry) - 1; j <= Math.ceil(ry) + 1; j++) for (let i = -Math.ceil(rx) - 1; i <= Math.ceil(rx) + 1; i++) {
    const wob = 1 + Math.sin(Math.atan2(j, i) * 3 + rx) * 0.12;
    const q = (i / rx) ** 2 + (j / Math.max(0.6, ry)) ** 2;
    if (q > wob * wob * 1.35) continue;
    if (q > wob * wob) { put(X + i, Y + j, P.mud[2]); continue; } // the wet dark rim
    const glint = j === -Math.round(ry * 0.4) && i > -rx * 0.4 && i < rx * 0.1;
    put(X + i, Y + j, glint ? P.water[6] : P.water[clamp(Math.round(3 - j / Math.max(1, ry) + (bayer(X + i, Y + j) - 0.5)), 1, 5)], true);
  }
}
function ripple(put: Put, X: number, Y: number, wp: number) {
  const L = 3 * wp;
  for (let t = -L; t <= L; t++) put(X + t, Y, P.water[5], true);
}
function chip(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const L = Math.max(1, Math.round((1 + rng.next() * 2) * wp)), a = rng.next() * Math.PI;
  for (let t = 0; t <= L; t++) put(X + Math.cos(a) * t, Y + Math.sin(a) * t * 0.5, P.chip[3 + (t === 0 ? 2 : rng.next() < 0.5 ? 1 : 0)]);
  put(X + 1, Y + 1, P.chip[0]);
}
function strawBit(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const L = (2 + rng.next() * 4) * wp, a = (rng.next() - 0.5) * 1.6;
  for (let t = 0; t <= L; t++) put(X + Math.cos(a) * t, Y + Math.sin(a) * t * 0.5, P.straw[t > L - 1 ? 5 : 3 + (t & 1)]);
}
function feather(put: Put, X: number, Y: number, wp: number, rng: Rng) {
  const L = (2 + rng.next() * 2) * wp;
  for (let t = 0; t <= L; t++) { const y = Y - Math.sin((t / L) * Math.PI) * wp * 0.8; put(X + t, y, P.shell[2]); if (t > 0 && t < L) put(X + t, y + 1, P.shell[1]); }
}

/** trails of footprints stepping along the walked ground: boots, bare feet, hens, a dog */
function footprints(put: Put, get: Get, F: VFloor, B: FloorBand, X0: number, w: number, gyOf: (X: number) => number, zoneOf: (X: number, dd: number) => VZone, seed: number) {
  const rng = new Rng(seed * 7 + 5 + X0);
  const trails = Math.round(w / 140);
  for (let t = 0; t < trails; t++) {
    const kind = rng.pick(['boot', 'boot', 'bare', 'hen', 'dog'] as const);
    const dd = B.dd0 + 2 + rng.next() * Math.max(1, (B.dd1 - B.dd0) * 0.7);
    let X = X0 + rng.next() * w;
    const dir = rng.chance(0.5) ? 1 : -1;
    const steps = 4 + rng.int(0, 7);
    for (let s = 0; s < steps; s++) {
      const wp = vpersp(dd), sq = squash(dd);
      const z = zoneOf(X, dd);
      if (z === 'river' || z === 'grass' || z === 'tilled' || z === 'gravel') break;
      const side = s & 1 ? 1 : -1;
      const Y = gyOf(X) + dd + side * wp * sq * (kind === 'hen' ? 0.6 : 1.4);
      const dk = (x: number, y: number) => put(x, y, shade(get(x, y) || P.dirt[3], -0.32));
      if (kind === 'boot') {
        const L = 3.6 * wp, Wd = 1.4 * wp;
        for (let i = -L; i <= L; i += 0.6) for (let j = -Wd; j <= Wd; j += 0.6) {
          const u = i / L, v = j / Wd;
          if (u * u + v * v > 1 || (u > -0.25 && u < -0.05)) continue; // the heel apart from the sole
          if (Math.round(i * 2) % 3 === 0) continue; // tread
          dk(X + i * dir, Y + j * sq);
        }
      } else if (kind === 'bare') {
        const L = 2.8 * wp;
        for (let i = -L; i <= L * 0.5; i += 0.6) dk(X + i * dir, Y);
        for (let k = 0; k < 4; k++) dk(X + (L * 0.8) * dir, Y + (k - 1.5) * wp * sq * 0.7);
      } else if (kind === 'hen') {
        for (let k = -1; k <= 1; k++) for (let i = 0; i < 2 * wp; i++) dk(X + i * dir, Y + k * i * sq * 0.6);
        for (let i = 0; i < wp; i++) dk(X - i * dir, Y);
      } else {
        dk(X, Y); dk(X + dir, Y); dk(X, Y + 1);
        for (const [i, j] of [[1.6, -1], [2, 0], [1.6, 1], [0.8, -1.4]]) dk(X + i * wp * dir, Y + j * wp * sq);
      }
      X += dir * (kind === 'hen' ? 5 : kind === 'dog' ? 7 : 9) * wp;
    }
  }
  void F;
}

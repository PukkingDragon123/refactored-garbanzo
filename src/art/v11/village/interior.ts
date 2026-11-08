// V12 rooms seen through doors and windows (user: "the house, why is the window and doors inside empty,
// don't be that lazy"). A doorway or a window is never a black hole: the room behind it is painted,
// lit by the daylight coming in through the opening and falling off into the dark at the back in
// stepped, dithered shades (never a smooth fade), so it reads as a lived-in room at a glance.
//   home      a family whare: woven floor mats (whāriki), a bed with a striped blanket and a pillow, a
//             kete on a peg, a shelf with a kerosene lamp and family photos, a pot, a guitar, a calendar
//   meeting   the wharenui: carved poupou and tukutuku panels round the walls, the ancestors' portraits
//             in a row under the painted rafters, mattresses laid out on the floor
//   store     the pātaka: kete and gourds on shelves, strings of dried fish, a sack of kūmara
// The painters write only inside the opening's rectangle; the caller draws the frame, the door leaf
// and the mullions over it.

import { PixelBuffer } from '../../pixel';
import { hex, mix } from '../../color';
import type { C } from '../../color';
import { Rng, bayer, clamp } from '../../../core/math';
import { VP } from './props';

export type Room = 'home' | 'meeting' | 'store';

const ROOM_DARK = hex('#0a0604');
const R = (...h: string[]): C[] => h.map(v => hex(v));
const BLANKETS: C[][] = [
  R('#2a0a08', '#6a1a12', '#a82a1c', '#d8c8a0', '#5a1610'),
  R('#0a1a2a', '#16365a', '#2a5a8a', '#e0d4b0', '#1c3a5e'),
  R('#1a2a0a', '#365a16', '#5a8a2a', '#e8d8a8', '#2e4a16'),
];
const MATTRESS = R('#1a2a3a', '#2a4a6a', '#3e6a8e', '#7aa0b8');
const LAMP_GLOW = R('#c27a2a', '#eaa846', '#ffd27a', '#fff0b8');

/** a room being painted: a colour and a depth (0 lit by the opening, 1 lost in the dark) per pixel */
class RoomPaint {
  readonly c: C[];
  readonly t: number[];
  constructor(readonly w: number, readonly h: number) { this.c = new Array(w * h).fill(0); this.t = new Array(w * h).fill(1); }
  set(x: number, y: number, c: C, t: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.c[y * this.w + x] = c; this.t[y * this.w + x] = t;
  }
  /** pixels that keep their own colour whatever the dark (a lamp flame, a glint) */
  glow(x: number, y: number, c: C) { this.set(x, y, c, -1); }
  /** write it into the sprite, darkened by depth in stepped, dithered shades */
  commit(b: PixelBuffer, x0: number, y0: number) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, c = this.c[i], t = this.t[i];
      if (!c) { b.set(x0 + x, y0 + y, ROOM_DARK); continue; }
      if (t < 0) { b.set(x0 + x, y0 + y, c); continue; }
      const q = Math.round(clamp(t + (bayer(x0 + x, y0 + y) - 0.5) * 0.3) * 4) / 4;
      b.set(x0 + x, y0 + y, mix(c, ROOM_DARK, q * 0.82));
    }
  }
}

const pk = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];

/** the back wall's pattern for a room (local x, y; v 0..1 down the wall) */
function wallAt(room: Room, x: number, y: number, seed: number): C {
  if (room === 'store') {
    // adzed planks
    const plank = Math.floor((x + (seed % 3)) / 4);
    const edge = (x + (seed % 3)) % 4 === 0;
    return edge ? VP.wood[1] : pk(VP.wood, 2.6 + ((plank * 7) % 3) * 0.3 + (Math.sin(y * 0.8 + plank) > 0.8 ? -0.8 : 0));
  }
  // tukutuku: a woven lattice of cream crosses and steps on dark slats
  const lx = x % 6, ly = y % 6;
  const cross = (lx === ly || lx === 5 - ly) && lx > 0 && lx < 5;
  if (cross) return (Math.floor(y / 6) + Math.floor(x / 6)) % 2 ? hex('#e0d0a0') : hex('#c89a40');
  return lx === 0 ? VP.wood[1] : (ly === 0 ? VP.raupo[1] : VP.wood[2]);
}

/** a woven floor mat in perspective (v 0 at the back wall, 1 at the threshold) */
function matAt(x: number, y: number, v: number): C {
  const s = 1 + Math.round(v * 2);
  const d = (Math.floor(x / s) + Math.floor(y / Math.max(1, s - 1))) % 4;
  return d < 2 ? VP.flax[3] : d === 2 ? VP.thatch[3] : VP.thatch[4];
}

/** a kerosene lamp on a shelf (its glass, the flame lit whatever the room's dark) */
function lamp(p: RoomPaint, x: number, y: number, t: number) {
  p.set(x, y, VP.iron[2], t); p.set(x + 1, y, VP.iron[2], t); p.set(x - 1, y, VP.iron[1], t); p.set(x + 2, y, VP.iron[1], t);
  p.set(x, y - 1, VP.iron[3], t); p.set(x + 1, y - 1, VP.iron[2], t);
  for (let k = 2; k <= 4; k++) { p.set(x, y - k, hex('#c8d8d0'), t); p.set(x + 1, y - k, hex('#8aa098'), t); }
  p.glow(x, y - 3, LAMP_GLOW[2]); p.glow(x, y - 2, LAMP_GLOW[1]);
}
/** a framed family photo: a dark frame, the faded print, a face or two in it */
function photo(p: RoomPaint, x: number, y: number, w: number, h: number, t: number, seed: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
    p.set(x + i, y + j, edge ? (seed % 2 ? VP.wood[4] : hex('#c8a040')) : hex('#b8a888'), t);
  }
  const faces = w > 4 ? 2 : 1;
  for (let f = 0; f < faces; f++) { const fx = x + 1 + f * 2 + (faces === 1 ? Math.floor((w - 3) / 2) : 0); p.set(fx, y + 1 + (h > 4 ? 1 : 0), hex('#5a4030'), t); p.set(fx, y + 2 + (h > 4 ? 1 : 0), hex('#3a2a20'), t); }
}
/** a kete hanging from a peg */
function keteOnPeg(p: RoomPaint, x: number, y: number, t: number) {
  p.set(x + 2, y - 3, VP.wood[3], t);
  for (let a = 0; a < 5; a++) p.set(x + a, y - 2 + (a === 0 || a === 4 ? 1 : 0), VP.flax[2], t);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 5 - (j === 3 ? 2 : 0); i++) p.set(x + i + (j === 3 ? 1 : 0), y + j, (i + j) % 2 ? VP.flax[4] : VP.flax[3], t);
}
/** a guitar leaning on the wall */
function guitar(p: RoomPaint, x: number, y: number, t: number) {
  for (let k = 0; k < 7; k++) p.set(x + Math.round(k * 0.25), y - 6 - k, VP.wood[1], t);
  const body = ['.oo.', 'oooo', '.oo.', 'oooo', 'oooo', '.oo.'];
  body.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === 'o') p.set(x - 1 + i, y - 5 + j, (i === 0 ? hex('#8a4a1a') : hex('#c27a2a')), t); });
  p.set(x + 1, y - 3, VP.wood[0], t);
}
/** a cast-iron pot */
function pot(p: RoomPaint, x: number, y: number, t: number) {
  const rows = ['o....o', 'oooooo', 'oooooo', '.oooo.'];
  rows.forEach((r, j) => { for (let i = 0; i < 6; i++) if (r[i] === 'o') p.set(x + i, y - 3 + j, j === 1 && i > 0 && i < 4 ? VP.iron[2] : VP.iron[1], t); });
}

// ------------------------------------------------------------------ doorways

/**
 * The room seen through an open doorway (w x h at x0, y0 in the sprite). `leaf`: how many columns at
 * the left the caller covers with the open door leaf (nothing worth seeing is put there).
 */
export function paintDoorway(b: PixelBuffer, x0: number, y0: number, w: number, h: number, room: Room, seed: number, o: { leaf?: number } = {}) {
  const p = new RoomPaint(w, h), rng = new Rng(seed * 31 + 7);
  const leaf = o.leaf ?? 0;
  const floorY = Math.round(h * (room === 'store' ? 0.78 : 0.72));
  // the back wall (darker toward the top, where the daylight from the door doesn't reach)
  for (let y = 0; y < floorY; y++) for (let x = 0; x < w; x++) p.set(x, y, wallAt(room, x, y, seed), 0.42 + (1 - y / floorY) * 0.42);
  // the side wall going back on the right, in the room's shade
  for (let y = 0; y < h; y++) {
    const d = Math.round(2 + (y < floorY ? 0 : (y - floorY) * 0.5));
    for (let k = 0; k < d; k++) p.set(w - 1 - k, y, room === 'store' ? VP.wood[2] : VP.raupo[2], 0.7);
  }
  // the floor: mats (planks in the store), the daylight spilling in across it from the threshold
  for (let y = floorY; y < h; y++) {
    const v = (y - floorY) / Math.max(1, h - 1 - floorY);
    for (let x = 0; x < w; x++) {
      const c = room === 'store' ? ((x + Math.floor(y / 3)) % 5 === 0 ? VP.wood[1] : VP.wood[3]) : matAt(x, y, v);
      p.set(x, y, c, clamp(0.62 - v * 0.62 + Math.abs(x - w / 2) / w * 0.2));
    }
  }
  const tw = 0.5; // things against the back wall
  if (room === 'home') {
    // the bed against the back wall: a mattress, a striped blanket, a pillow
    const bl = BLANKETS[seed % BLANKETS.length];
    const bx0 = Math.max(leaf - 1, 0), bx1 = Math.min(w - 4, bx0 + Math.round(w * 0.6));
    for (let y = floorY - 4; y <= floorY + 2; y++) for (let x = bx0; x < bx1; x++) {
      const top = y === floorY - 4;
      const stripe = Math.floor((x - bx0) / 3) % 4;
      p.set(x, y, top ? bl[3] : y > floorY ? VP.wood[2] : bl[stripe === 3 ? 3 : stripe === 1 ? 4 : 2], 0.38 + (y > floorY ? 0.1 : 0));
    }
    for (let x = bx1 - 5; x < bx1 - 1; x++) for (let y = floorY - 6; y < floorY - 3; y++) p.set(x, y, VP.cream[4], 0.32);
    // the shelf: a lamp and the family photos above it
    const sx = Math.round(w * 0.55);
    for (let x = sx; x < w - 2; x++) p.set(x, floorY - 20, VP.wood[4], 0.48);
    lamp(p, sx + 2, floorY - 21, tw);
    photo(p, sx + 5, floorY - 27, 5, 5, tw, seed);
    if (w - 2 - (sx + 11) >= 3) photo(p, sx + 11, floorY - 26, 3, 4, tw, seed + 1);
    // a kete on its peg, a calendar or a guitar, the pot by the door
    keteOnPeg(p, Math.round(w * 0.38), floorY - 18, tw);
    if (rng.next() < 0.5) guitar(p, w - 5, floorY + 2, 0.45);
    else for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) p.set(w - 8 + i, floorY - 12 + j, j < 2 ? VP.red : (i + j) % 2 ? VP.cream[4] : VP.cream[3], tw);
    pot(p, Math.round(w * 0.6), h - 3, 0.25);
  } else if (room === 'meeting') {
    // the ancestors' portraits in a row under the rafters, the painted rafter over them
    for (let x = 0; x < w; x++) { const s = Math.sin(x * 0.9); p.set(x, 0, s > 0.5 ? VP.white : VP.ochre[3], 0.75); p.set(x, 1, s < -0.5 ? VP.black : VP.ochre[2], 0.75); }
    for (let x = 1; x + 4 <= w - 2; x += 6) photo(p, x, 3, 4, 6, 0.6, seed + x);
    // carved poupou between tukutuku panels: red figures with pāua eyes
    for (let x = 2; x + 4 <= w - 2; x += 10) for (let y = 11; y < floorY; y++) for (let i = 0; i < 4; i++) {
      const ly = (y - 11) % 9;
      p.set(x + i, y, ly === 2 && (i === 0 || i === 3) ? VP.paua : (ly === 6 && i > 0 && i < 3) || i === 0 ? VP.ochre[1] : VP.ochre[3], 0.5);
    }
    // mattresses in a row on the floor, a pillow on each
    for (let m = 0; m < 3; m++) {
      const mx = 1 + m * Math.round(w / 3), my = floorY + 1 + m % 2;
      for (let y = my; y < my + 3; y++) for (let x = mx; x < mx + Math.round(w / 3) - 1; x++) p.set(x, y, y === my ? MATTRESS[3] : MATTRESS[(x + m) % 2 ? 1 : 2], 0.45 - m * 0.05);
      p.set(mx + 1, my - 1, VP.cream[4], 0.4); p.set(mx + 2, my - 1, VP.cream[4], 0.4);
    }
  } else {
    // the store: shelves of kete and gourds, dried fish on a string, a sack of kūmara
    for (const sy of [Math.round(floorY * 0.38), Math.round(floorY * 0.72)]) {
      for (let x = 0; x < w; x++) p.set(x, sy, VP.wood[4], 0.5);
      for (let x = 1; x < w - 3; x += 4) {
        if ((x + sy) % 3 === 0) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) p.set(x + i, sy - 1 - j, (i + j) % 2 ? VP.flax[4] : VP.flax[3], 0.5);
        else for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (!(j === 2 && (i === 0 || i === 2))) p.set(x + i, sy - 1 - j, i === 0 ? hex('#8a4a1a') : hex('#c08038'), 0.5);
      }
    }
    for (let x = 1; x < w - 1; x++) p.set(x, 1, VP.thatch[1], 0.7);
    for (let f = 2; f < w - 2; f += 3) for (let j = 0; j < 3; j++) p.set(f, 2 + j, j === 0 ? VP.thatch[1] : VP.grey[4], 0.6);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) if (!(j === 0 && (i === 0 || i === 4))) p.set(w - 7 + i, h - 2 - j, (i + j) % 2 ? VP.thatch[4] : VP.thatch[3], 0.3);
  }
  p.commit(b, x0, y0);
}

// ------------------------------------------------------------------ windows

/**
 * The room seen through a window opening (w x h at x0, y0). The caller paints the frame and the
 * mullions over it. Something is always in it: a shelf with jars catching the light, a hanging lamp,
 * a photo, a curtain drawn to one side.
 */
export function paintWindowRoom(b: PixelBuffer, x0: number, y0: number, w: number, h: number, room: Room, seed: number, o: { curtain?: C } = {}) {
  const p = new RoomPaint(w, h), rng = new Rng(seed * 17 + 5);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, wallAt(room, x + 3, y + 2, seed), 0.55 + (y / h) * 0.15 + (x / w) * 0.1);
  // the light from this window falling into the room: a paler patch on the back wall
  for (let y = Math.round(h * 0.45); y < h; y++) for (let x = 1; x < w - 2; x++) if ((x + y) % 2 === 0 && x > (y - h * 0.45) * 0.6) p.t[y * w + x] = Math.max(0, p.t[y * w + x] - 0.25);
  const shelfY = Math.round(h * 0.62);
  const v = rng.int(0, 2);
  if (room === 'store' || v === 0) {
    // a shelf of jars and bottles, their glass catching the light
    for (let x = 0; x < w; x++) p.set(x, shelfY, VP.wood[4], 0.42);
    const jars = [hex('#7aa088'), hex('#b8782a'), hex('#c8d0c0'), hex('#a83a2a')];
    for (let x = 1; x < w - 2; x += 3) {
      const jh = 2 + ((x + seed) % 3), jc = jars[(x + seed) % jars.length];
      for (let j = 0; j < jh; j++) { p.set(x, shelfY - 1 - j, jc, 0.4); p.set(x + 1, shelfY - 1 - j, mix(jc, ROOM_DARK, 0.3), 0.4); }
      p.glow(x, shelfY - jh + (jh > 2 ? 1 : 0), mix(jc, 0xffffffff, 0.55));
    }
  } else if (v === 1) {
    // a lamp hanging from the rafter on a chain, a photo on the wall
    const lx = Math.round(w * 0.65);
    for (let j = 0; j < Math.round(h * 0.3); j++) p.set(lx, j, VP.iron[2], 0.6);
    lamp(p, lx, Math.round(h * 0.3) + 4, 0.45);
    photo(p, 1, Math.round(h * 0.35), 5, 5, 0.5, seed);
  } else {
    // the top of a bed, a pillow and a blanket folded over its end; a kete on a peg
    const bl = BLANKETS[seed % BLANKETS.length];
    for (let y = shelfY; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, y === shelfY ? bl[3] : bl[Math.floor(x / 3) % 2 ? 2 : 4], 0.35);
    for (let x = 1; x < 5; x++) for (let y = shelfY - 2; y < shelfY; y++) p.set(x, y, VP.cream[4], 0.3);
    keteOnPeg(p, w - 7, 3, 0.5);
  }
  // a curtain drawn to one side, its folds
  if (o.curtain) {
    const cw = Math.max(2, Math.round(w * 0.22));
    for (let y = 0; y < h; y++) for (let x = 0; x < cw - (y > h * 0.6 ? 1 : 0); x++) p.set(x, y, mix(o.curtain, ROOM_DARK, x % 2 ? 0.3 : 0), 0.15);
  }
  p.commit(b, x0, y0);
}

/** a tin can of flowers on a window sill (x, y: the sill's top left), outside in the daylight */
export function sillPlant(b: PixelBuffer, x: number, y: number, seed: number) {
  const tin = [VP.iron[3], VP.iron[4], VP.iron[2]];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) b.set(x + i, y - 1 - j, i === 1 && j === 1 ? hex('#c83a2a') : tin[i % 3]);
  const fl = [hex('#e84a5a'), hex('#f0c040'), hex('#f4f0e8')][seed % 3];
  const leaves = [[0, -4], [1, -5], [2, -4], [3, -5], [1, -6], [2, -7], [0, -6]];
  for (const [i, j] of leaves) b.set(x + i, y + j, VP.leaf[3 + ((i + j) & 1)]);
  for (const [i, j] of [[1, -7], [3, -6], [0, -7]]) b.set(x + i, y + j, fl);
}

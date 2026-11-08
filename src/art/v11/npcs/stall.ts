// V12 NPCs: Big Hank's stall at the end of Te Huarahi, painted pixel by pixel as one world prop (the
// light from the top left, an ink outline, grass at the feet so it stands in the ground):
//   - a patched blue tarp lean-to on two crooked poles lashed with rope: an orange patch, a strip of
//     silver duct tape in a cross, a torn corner hanging, the hem frayed; a string of bulbs along its
//     front edge (lit: warm and bright, the scene adds the light; unlit: pale glass)
//   - Hank's folding chair (aluminium tube, green-and-white webbing, a cushion squashed flat)
//   - crates with faded shipping stencils (an arrow, THIS SIDE UP, a port mark, a broken FRAGILE),
//     the top one opened, straw spilling; a red cooler with a white lid; a transistor radio with its
//     aerial up; a little framed photo of Lily propped on a crate (a girl in a yellow tee with a snake
//     round her shoulders, the frame a cheap gold)
//   - a hand-painted sign leaning on the cooler: HANK'S TRADING, NO QUESTIONS
//   stall(lit)          the whole thing (the chair's seat is at CHAIR_X, BULBS are the bulbs' spots)

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { drawPx, pxWidth } from '../../../ui/v11/pixfont';

const H = hex;
const OUT = H('#140a08');
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
type Ramp = C[];
const R = (...h: string[]): Ramp => h.map(c => H(c));
const tone = (r: Ramp, l: number, x: number, y: number) => { const f = Math.max(0, Math.min(0.999, l)) * (r.length - 1); const i = Math.floor(f); return f - i > dith(x, y) ? r[Math.min(r.length - 1, i + 1)] : r[i]; };

const P = {
  tarp: R('#08142e', '#0e2454', '#1a3a7e', '#2c56a8', '#4a7ccc', '#7aa6e6'),
  patch: R('#3a1404', '#7a2e08', '#b8500e', '#e47a1e', '#f8a848'),
  tape: R('#3a3e44', '#6a7078', '#9aa2aa', '#c8d0d6', '#eef2f4'),
  pole: R('#1e1208', '#3a2412', '#5a3a1e', '#7a5430', '#9a7044'),
  rope: R('#3a2a12', '#6a5226', '#9a7c42', '#c4a462', '#e2c888'),
  crate: R('#26160a', '#4a2c14', '#6e4624', '#926236', '#b48250', '#d4a46e'),
  stencil: H('#3a1a10'),
  red: R('#2a0606', '#5e0e0c', '#9a1c16', '#c83024', '#e8583e', '#ffa080'),
  white: R('#5a5a5a', '#9a9a96', '#c8c8c2', '#e8e8e2', '#fafaf4'),
  alu: R('#3a3e44', '#6a7278', '#9aa4aa', '#c6ced2', '#eef4f6'),
  web: R('#0e2a14', '#1a4a22', '#2a6e32', '#4a944a'),
  radio: R('#1a0e08', '#3a2010', '#5a341a', '#7a4e2a', '#a06c3e'),
  gold: R('#3a2604', '#7a5410', '#b8861e', '#e0b232', '#f6d862'),
  straw: R('#5a4418', '#86692a', '#b08e40', '#d4b45c', '#eedc8a'),
  leaf: R('#0e1e0e', '#1a3418', '#2a4e22', '#40702e', '#5e9440'),
  board: R('#2a1a0e', '#4e3420', '#76543a', '#9a7656', '#c0a080'),
};
/** where the chair's seat is (sprite px from the left), and the bulbs' spots (px, from the top-left) */
export const STALL_W = 176, STALL_H = 108, STALL_G = 104;
export const CHAIR_X = 30;
export const BULBS: [number, number][] = [];

function set(b: PixelBuffer, x: number, y: number, c: C) { b.set(Math.round(x), Math.round(y), c); }
function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: C | ((t: number, x: number, y: number) => C), w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    for (let k = 0; k < w; k++) b.set(x + k, y, typeof c === 'function' ? c(t, x + k, y) : c);
  }
}
function outline(b: PixelBuffer) {
  const src = b.data.slice();
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (src[y * b.w + x] >>> 24) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < b.w && Y < b.h && (src[Y * b.w + X] >>> 24) > 200) { b.data[y * b.w + x] = OUT; break; } }
  }
}
function tufts(b: PixelBuffer, x0: number, x1: number, y: number, seed = 1) {
  for (let x = x0; x < x1; x++) {
    const n = hash(x, 3, seed);
    if (n < 0.42) continue;
    const h = 1 + Math.floor(n * 5);
    for (let j = 0; j < h; j++) b.set(x + (j > 2 && n > 0.8 ? 1 : 0), y - j, tone(P.leaf, 0.3 + j / 8 + n * 0.2, x, y - j));
  }
}
/** a crooked pole: three bends, a rope lashing at each joint */
function pole(b: PixelBuffer, x: number, y0: number, y1: number, bends: number[], seed: number) {
  const segs = bends.length + 1;
  let px = x, py = y0;
  for (let i = 1; i <= segs; i++) {
    const nx = x + (bends[i - 1] ?? 0), ny = y0 + ((y1 - y0) * i) / segs;
    line(b, px, py, nx, ny, (t, xx, yy) => tone(P.pole, 0.55 + (xx - x) * 0.04 - (hash(xx, yy, seed) > 0.85 ? 0.2 : 0), xx, yy), 3);
    // a knot, a lashing
    if (i < segs) for (let k = -2; k <= 2; k++) { set(b, nx - 1, ny + k, tone(P.rope, 0.7 - Math.abs(k) * 0.1 + (k & 1 ? -0.25 : 0), nx, ny + k)); set(b, nx + 2, ny + k, tone(P.rope, 0.45 + (k & 1 ? -0.2 : 0), nx, ny + k)); }
    px = nx; py = ny;
  }
}
/** a wooden crate: slats with gaps, corner battens, nail heads, worn edges */
function crate(b: PixelBuffer, x0: number, y0: number, w: number, h: number, seed: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const u = (x - x0) / w, v = (y - y0) / h;
    const slat = (y - y0) % 6;
    let l = 0.66 - u * 0.25 - v * 0.15 + (hash(x >> 2, y, seed) > 0.85 ? -0.1 : 0) + (((x * 5 + y) % 13) === 0 ? -0.12 : 0);
    if (slat === 5) l -= 0.45;
    if (slat === 0) l += 0.12;
    const batten = x - x0 < 3 || x0 + w - x <= 3;
    if (batten) l += x - x0 < 3 ? 0.08 : -0.12;
    b.set(x, y, tone(P.crate, l, x, y));
  }
  // nail heads on the battens
  for (let y = y0 + 2; y < y0 + h; y += 6) { set(b, x0 + 1, y, H('#3a3a40')); set(b, x0 + w - 2, y, H('#2a2a30')); }
  // a chipped corner
  set(b, x0 + w - 1, y0, 0); set(b, x0 + w - 1, y0 + 1, 0); set(b, x0 + w - 2, y0, 0);
}
/** faded stencil letters (every few pixels missing, the paint worn) */
function stencil(b: PixelBuffer, text: string, x: number, y: number, c: C, seed: number, o: { bold?: boolean } = {}) {
  const tmp = new PixelBuffer(pxWidth(text, o) + 2, 12);
  drawPx(tmp, text, 0, 0, c, o);
  for (let j = 0; j < tmp.h; j++) for (let i = 0; i < tmp.w; i++) {
    const v = tmp.get(i, j);
    if (!(v >>> 24) || hash(i, j, seed) < 0.22) continue;
    const X = x + i, Y = y + j;
    if (X < 0 || Y < 0 || X >= b.w || Y >= b.h || !(b.get(X, Y) >>> 24)) continue;
    b.set(X, Y, mix(b.get(X, Y), c, 0.75));
  }
}

export function stall(lit: boolean): Sprite {
  const W = STALL_W, Hh = STALL_H, b = new PixelBuffer(W, Hh), G = STALL_G;
  BULBS.length = 0;
  // ---------------------------------------------------------------- the poles (behind everything under the tarp)
  pole(b, 10, G, G - 80, [2, -1, 1], 3);
  pole(b, 162, G, G - 74, [-2, 1, -1], 5);
  // a guy rope from the right pole top to a peg
  line(b, 164, G - 72, 174, G - 1, (t, x, y) => tone(P.rope, 0.5 + (((x + y) & 1) ? 0.15 : -0.1), x, y));
  set(b, 174, G, H('#5a3a1e')); set(b, 174, G - 1, H('#7a5430'));

  // ---------------------------------------------------------------- the tarp: back edge high, front edge sagging; patches, tape, folds
  // the back edge pulled up to four ties (it sags between them), the front edge lower, sloping down to
  // the right like a lean-to, scalloped between the grommets
  const ties = [6, 60, 114, 166];
  const backY = (x: number) => {
    let i = 0;
    while (i < ties.length - 2 && x > ties[i + 1]) i++;
    const u = Math.max(0, Math.min(1, (x - ties[i]) / (ties[i + 1] - ties[i])));
    return G - 93 + Math.round(Math.sin(u * Math.PI) * 4) + Math.round(x * 0.02);
  };
  const frontY = (x: number) => G - 76 + Math.round((x - 8) * 0.05) + Math.round(Math.sin(((x - 8) / 156) * Math.PI) * 5) + Math.round(Math.sin((((x - 8) % 16) / 16) * Math.PI) * 2);
  for (let x = 4; x < 168; x++) {
    const y0 = backY(x), y1 = frontY(x);
    for (let y = y0; y <= y1; y++) {
      const v = (y - y0) / Math.max(1, y1 - y0);
      const fold = Math.sin(x * 0.22 + Math.sin(x * 0.05) * 2) * 0.12;
      let l = 0.72 - v * 0.42 + fold - x / 900;
      // the underside darkening toward the front edge, a few wrinkles
      if (((x * 7 + y * 3) % 23) === 0) l -= 0.15;
      b.set(x, y, tone(P.tarp, l, x, y));
    }
    // the hem: a darker rolled edge with grommets
    set(b, x, y1, tone(P.tarp, 0.18, x, y1));
    if (x % 16 === 8) { set(b, x, y1, H('#c8d0d6')); set(b, x, y1 - 1, H('#7a828a')); }
    // frays hanging off the hem
    if (hash(x, 1, 7) > 0.86) for (let k = 1; k <= 1 + Math.floor(hash(x, 2, 7) * 3); k++) set(b, x, y1 + k, tone(P.tarp, 0.3, x, y1 + k));
  }
  // the orange patch, stitched on crooked
  for (let y = G - 86; y < G - 77; y++) for (let x = 104 + Math.round((y - (G - 86)) * 0.3); x < 124 + Math.round((y - (G - 86)) * 0.3); x++) {
    if (y > frontY(x) - 1) continue;
    b.set(x, y, tone(P.patch, 0.7 - (y - (G - 86)) / 22 + (((x + y) % 4) === 0 ? -0.1 : 0), x, y));
  }
  for (let x = 104; x < 127; x += 2) { set(b, x + Math.round(0), G - 86, H('#f8e0b0')); }
  // a cross of silver duct tape over a tear
  for (let i = -7; i <= 7; i++) {
    for (const s of [1, -1]) {
      const x = 46 + i, y = G - 83 + Math.round(i * 0.45 * s);
      set(b, x, y, tone(P.tape, 0.75 + (i === 0 ? 0.2 : 0), x, y)); set(b, x, y + 1, tone(P.tape, 0.45, x, y + 1));
    }
  }
  // the torn corner hanging down at the right
  for (let y = frontY(160); y < frontY(160) + 16; y++) {
    const k = y - frontY(160);
    for (let x = 156 - Math.round(k * 0.2); x < 166 - Math.round(k * 0.55); x++) b.set(x, y, tone(P.tarp, 0.42 - k / 40 + (x === 156 - Math.round(k * 0.2) ? 0.15 : 0), x, y));
  }
  // rope ties where the tarp meets the poles
  for (const [x, y] of [[10, frontY(10)], [162, frontY(162) - 2]] as [number, number][]) for (let k = -2; k <= 1; k++) { set(b, x - 1 + k, y + 1, tone(P.rope, 0.7, x, y)); set(b, x + k, y + 2, tone(P.rope, 0.4, x, y)); }

  // ---------------------------------------------------------------- the string of bulbs along the front edge
  const wy = (x: number) => frontY(x) + 2 + Math.round(Math.sin(((x - 10) / 152) * Math.PI) * 4);
  for (let x = 10; x <= 162; x++) set(b, x, wy(x), H('#1a1a1e'));
  for (let x = 18; x <= 156; x += 13) {
    const y = wy(x) + 1;
    set(b, x, y, H('#2a2a2e'));
    const glass = lit ? [H('#fffbe0'), H('#ffe890'), H('#f0b440')] : [H('#e8e4d4'), H('#c8c0a8'), H('#8a8270')];
    set(b, x - 1, y + 1, glass[1]); set(b, x, y + 1, glass[0]); set(b, x + 1, y + 1, glass[2]);
    set(b, x - 1, y + 2, glass[1]); set(b, x, y + 2, glass[lit ? 0 : 1]); set(b, x + 1, y + 2, glass[2]);
    set(b, x, y + 3, glass[2]);
    BULBS.push([x, y + 2]);
  }

  // ---------------------------------------------------------------- the folding chair (Hank's spot)
  const cx = CHAIR_X, seat = G - 13;
  const alu = (l: number, x: number, y: number) => tone(P.alu, l, x, y);
  // legs crossing (X frame), the back uprights, the armrests
  line(b, cx - 8, G, cx + 7, seat, (t, x, y) => alu(0.7, x, y), 1);
  line(b, cx + 8, G, cx - 7, seat, (t, x, y) => alu(0.45, x, y), 1);
  line(b, cx - 9, seat, cx - 11, seat - 18, (t, x, y) => alu(0.65, x, y), 1);
  line(b, cx + 7, seat, cx + 5, seat - 18, (t, x, y) => alu(0.5, x, y), 1);
  line(b, cx - 11, seat - 8, cx + 9, seat - 8, (t, x, y) => alu(0.75, x, y), 1);
  // webbing: the seat and the back, green and white straps, one sagging
  for (let x = cx - 9; x <= cx + 7; x++) for (let y = seat - 1; y <= seat + 1; y++) b.set(x, y + (x > cx - 2 && x < cx + 3 && y === seat + 1 ? 1 : 0), (Math.floor((x - cx) / 3) & 1) ? tone(P.white, 0.7 - (y - seat) * 0.15, x, y) : tone(P.web, 0.7 - (y - seat) * 0.2, x, y));
  for (let y = seat - 17; y <= seat - 3; y++) for (let x = cx - 10 + Math.round((seat - y) * 0.1); x <= cx + 5 + Math.round((seat - y) * 0.1); x++) if ((y - seat) % 3 !== 0) b.set(x, y, (Math.floor((y - seat) / 3) & 1) ? tone(P.web, 0.55 - (x - cx) / 40, x, y) : tone(P.white, 0.62 - (x - cx) / 40, x, y));
  // a flattened cushion and a folded newspaper on the ground by the chair
  for (let x = cx - 8; x <= cx + 6; x++) set(b, x, seat - 2, tone(P.red, 0.55 + (x === cx - 8 ? 0.2 : 0), x, seat - 2));
  for (let x = cx + 10; x < cx + 18; x++) for (let y = G - 2; y < G; y++) b.set(x, y, (x + y) % 3 ? tone(P.white, 0.75, x, y) : H('#5a5a5a'));

  // ---------------------------------------------------------------- crates, stencils, the photo, the radio
  crate(b, 50, G - 26, 30, 26, 1);
  stencil(b, 'THIS', 56, G - 22, P.stencil, 3);
  stencil(b, 'SIDE UP', 53, G - 15, P.stencil, 4);
  // an arrow stencil
  for (let k = 0; k < 6; k++) { set(b, 75, G - 8 - k, mix(b.get(75, G - 8 - k), P.stencil, 0.7)); }
  set(b, 74, G - 12, P.stencil); set(b, 76, G - 12, P.stencil);
  crate(b, 54, G - 46, 24, 20, 2);
  stencil(b, 'AKL', 58, G - 41, H('#5a1410'), 6, { bold: true });
  // the top crate opened: its lid leaning, straw spilling over the edge
  line(b, 79, G - 46, 86, G - 58, (t, x, y) => tone(P.crate, 0.7 - t * 0.2, x, y), 3);
  for (let x = 55; x < 77; x++) { const h = 1 + Math.floor(hash(x, 4, 9) * 3); for (let k = 0; k < h; k++) set(b, x, G - 47 - k, tone(P.straw, 0.5 + k * 0.15 + hash(x, k, 2) * 0.2, x, G - 47 - k)); }
  for (const [x, y] of [[53, G - 44], [52, G - 42], [78, G - 40], [79, G - 38]] as [number, number][]) set(b, x, y, tone(P.straw, 0.7, x, y));
  // the third crate, longer, FRAGILE half worn away
  crate(b, 82, G - 18, 32, 18, 3);
  stencil(b, 'FRAG LE', 86, G - 14, H('#7a1c14'), 8);
  // Lily's photo: a cheap gold frame propped on the crate, a girl in a yellow tee with a green snake
  // round her shoulders, blue sky behind her (the stand leg behind it)
  const fx = 90, fy = G - 31;
  line(b, fx + 7, fy + 12, fx + 9, fy + 13, H('#3a2a10'));
  for (let y = fy; y < fy + 13; y++) for (let x = fx; x < fx + 10; x++) {
    const edge = x === fx || x === fx + 9 || y === fy || y === fy + 12;
    const inner = x === fx + 1 || x === fx + 8 || y === fy + 1 || y === fy + 11;
    if (edge) b.set(x, y, tone(P.gold, x === fx || y === fy ? 0.85 : 0.35, x, y));
    else if (inner) b.set(x, y, tone(P.gold, 0.55, x, y));
    else b.set(x, y, y < fy + 6 ? H('#7ac0e8') : H('#9ad07a'));
  }
  // the girl: brown hair, face, yellow tee, the snake
  for (const [x, y, c] of [
    [4, 3, '#5a3418'], [5, 3, '#5a3418'], [3, 4, '#5a3418'], [4, 4, '#f4c4a0'], [5, 4, '#f4c4a0'], [6, 4, '#5a3418'],
    [4, 5, '#f4c4a0'], [5, 5, '#e8a888'], [3, 6, '#3a8a2a'], [4, 6, '#f0d040'], [5, 6, '#f0d040'], [6, 6, '#3a8a2a'],
    [3, 7, '#f0d040'], [4, 7, '#f0d040'], [5, 7, '#f0d040'], [6, 7, '#f0d040'], [7, 6, '#4aa83a'], [7, 7, '#2a6a1e'],
    [3, 8, '#f0d040'], [4, 8, '#e0b830'], [5, 8, '#f0d040'], [6, 8, '#e0b830'], [2, 7, '#2a6a1e'],
  ] as [number, number, string][]) set(b, fx + x, fy + y, H(c));
  // the glass's glint
  set(b, fx + 2, fy + 2, H('#ffffff'));
  // the transistor radio on the long crate: a leather case, a chrome grille, a tuning dial, the aerial up
  const rx = 100, ry = G - 28;
  for (let y = ry; y < ry + 10; y++) for (let x = rx; x < rx + 13; x++) {
    const u = (x - rx) / 13, v = (y - ry) / 10;
    let c = tone(P.radio, 0.7 - u * 0.3 - v * 0.2, x, y);
    if (x >= rx + 2 && x <= rx + 7 && y >= ry + 2 && y <= ry + 7) c = (y & 1) ? tone(P.alu, 0.85 - (x - rx) * 0.05, x, y) : tone(P.alu, 0.35, x, y);
    if (x >= rx + 9 && x <= rx + 11 && y >= ry + 3 && y <= ry + 5) c = H('#e8c86a');
    b.set(x, y, c);
  }
  set(b, rx + 10, ry + 4, H('#c83a2a'));
  line(b, rx + 12, ry, rx + 19, ry - 14, H('#b8c0c8'));
  set(b, rx + 19, ry - 15, H('#eef4f6'));
  line(b, rx + 2, ry - 1, rx + 10, ry - 1, H('#2a1a10'));

  // ---------------------------------------------------------------- the cooler: red, a white lid, a handle, a dent
  const kx = 118, ky = G - 17;
  for (let y = ky; y < G; y++) for (let x = kx; x < kx + 22; x++) {
    const u = (x - kx) / 22, v = (y - ky) / 17;
    const lid = y < ky + 4;
    let l = 0.72 - u * 0.3 - v * 0.15;
    if (Math.abs(x - (kx + 15)) < 2 && Math.abs(y - (ky + 10)) < 2) l -= 0.18;
    b.set(x, y, lid ? tone(P.white, l + 0.1, x, y) : tone(P.red, l, x, y));
  }
  for (let x = kx + 6; x < kx + 16; x++) set(b, x, ky - 1, tone(P.white, 0.5, x, ky - 1));
  set(b, kx + 6, ky, OUT); set(b, kx + 15, ky, OUT);
  set(b, kx + 2, G - 3, H('#d8d8d0'));
  for (let x = kx + 1; x < kx + 21; x++) set(b, x, ky + 4, tone(P.red, 0.25, x, ky + 4));

  // ---------------------------------------------------------------- the sign: a plank leaning on the cooler, hand-lettered
  const sx = 134, sy = G - 30;
  for (let y = sy; y < sy + 24; y++) for (let x = sx + Math.round((y - sy) * 0.12); x < sx + 36 + Math.round((y - sy) * 0.12); x++) {
    const u = (x - sx) / 36;
    b.set(x, y, tone(P.board, 0.72 - u * 0.25 + (((y - sy) % 8) === 7 ? -0.35 : 0) + (hash(x >> 2, y, 4) > 0.9 ? -0.1 : 0), x, y));
  }
  drawPx(b, "HANK'S", sx + 4, sy + 1, H('#c02a20'), { bold: true });
  drawPx(b, 'TRADING', sx + 3, sy + 9, H('#1a3a8a'));
  drawPx(b, 'NO Q', sx + 9, sy + 16, H('#2a1a10'));
  set(b, sx + 27, sy + 17, H('#2a1a10'));
  // a stick propping it
  line(b, sx + 32, sy + 4, sx + 40, G, (t, x, y) => tone(P.pole, 0.5, x, y));

  // ---------------------------------------------------------------- the ground: a worn mat, a few cigar butts, tufts
  for (let x = 14; x < 50; x++) set(b, x, G, (x & 1) ? H('#6a4a2a') : H('#8a6a3a'));
  for (const x of [44, 47, 141]) { set(b, x, G - 1, H('#5a3418')); set(b, x + 1, G - 1, H('#7a5434')); }
  outline(b);
  tufts(b, 0, W, G + 2, 23);
  return { buf: b, ax: Math.round(W / 2), ay: G + 1 } as Sprite;
}
void shade;

// V11 NPCs: pictures for the things the side quests hand around (the station radio, Marge's sketchbook
// pages, a tōtara block, old fishing net, Rosie's Junior Ranger badge, Tīpene's paddle, Ngaio's kete
// and two new dishes), painted at the Backpack's 24 px per cell, top-left light, a dark outline and a
// hard one-pixel drop shadow (no soft edges).

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import { registerItemArt, ITEM_CELL } from '../itemart';

const H = hex;
const OUT = H('#140a10');
type Ramp = [C, C, C, C];
const ramp = (a: string, b: string, c: string, d: string): Ramp => [H(a), H(b), H(c), H(d)];
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** pick a ramp tone for a light value 0..1 with ordered dithering between steps */
const tone = (r: Ramp, l: number, x: number, y: number) => { const f = Math.max(0, Math.min(0.999, l)) * 3; const i = Math.floor(f); return f - i > dith(x, y) ? r[Math.min(3, i + 1)] : r[i]; };

function finish(b: PixelBuffer): HTMLCanvasElement {
  // outline (4-neighbour), then a hard 1px drop shadow down-right
  const src = b.data.slice();
  const W = b.w, Hh = b.h;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x] >>> 24) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < W && Y < Hh && (src[Y * W + X] >>> 24) !== 0; });
    if (n) b.data[y * W + x] = OUT;
  }
  const s2 = b.data.slice();
  for (let y = Hh - 2; y >= 0; y--) for (let x = W - 2; x >= 0; x--) if ((s2[y * W + x] >>> 24) && !(s2[(y + 1) * W + x + 1] >>> 24) && !(b.data[(y + 1) * W + x + 1] >>> 24)) b.data[(y + 1) * W + x + 1] = (0x60 << 24 | 0x100608) >>> 0;
  return b.toCanvas(1);
}
/** a shaded box (light from the top-left) */
function box(b: PixelBuffer, x0: number, y0: number, w: number, h: number, r: Ramp, bias = 0) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const u = (x - x0) / Math.max(1, w - 1), v = (y - y0) / Math.max(1, h - 1);
    b.set(x, y, tone(r, 0.75 - u * 0.35 - v * 0.35 + bias, x, y));
  }
}
const cell = (w: number, h: number) => new PixelBuffer(w * ITEM_CELL, h * ITEM_CELL);

const P = {
  steel: ramp('#2a2e34', '#4e565e', '#7a8690', '#b4c0c8'),
  black: ramp('#0e0e12', '#1c1e24', '#2c3038', '#4a505a'),
  orange: ramp('#6a2a08', '#a8440e', '#e0661e', '#ffa050'),
  paper: ramp('#a8946a', '#cdbb8e', '#e8dab4', '#fbf2d8'),
  wood: ramp('#4a2e16', '#7a5230', '#a8784a', '#d0a46c'),
  red: ramp('#5a1410', '#8a2218', '#b8342a', '#e05a44'),
  net: ramp('#0a2a3a', '#14465e', '#2a6a8a', '#5aa2c0'),
  flax: ramp('#5a4418', '#86692a', '#b08e40', '#e0c070'),
  green: ramp('#1a3a14', '#2a5a22', '#4a8a34', '#7ab854'),
  gold: ramp('#6a4406', '#a87410', '#e0a818', '#ffe27a'),
  bread: ramp('#6a3a14', '#a8642a', '#d89a4e', '#f4cc84'),
  stew: ramp('#3a1a0a', '#6a3416', '#9a5a26', '#c88a44'),
  tin: ramp('#3a3e44', '#6a7078', '#9aa2aa', '#d4dce2'),
};

// the station radio: a chunky handset with a stubby aerial, wound in grey tape where the storm cracked it
function radioArt(fixed: boolean) {
  const b = cell(1, 2);
  box(b, 6, 14, 12, 28, P.black);
  b.rect(8, 17, 8, 6, H(fixed ? '#5ad07a' : '#3a4a3a'));
  b.rect(9, 18, 3, 1, H(fixed ? '#c8ffd8' : '#5a6a5a'));
  for (let i = 0; i < 4; i++) b.rect(8, 26 + i * 3, 8, 1, H('#0a0a0c'));
  box(b, 14, 3, 3, 12, P.black, 0.1);
  box(b, 13, 1, 5, 3, P.orange);
  if (!fixed) { box(b, 5, 30, 14, 4, P.tin, 0.1); b.set(12, 31, H('#5a6066')); }
  else b.rect(7, 38, 2, 2, H('#ff5a3a'));
  return finish(b);
}
// a sketchbook page: cream paper with a pencil drawing of a beetle and a corner torn
function pageArt() {
  const b = cell(1, 1);
  box(b, 4, 3, 16, 18, P.paper);
  for (let i = 0; i < 4; i++) b.set(19 - i, 3 + i < 7 ? 3 : 3, 0);
  b.set(19, 3, 0); b.set(18, 3, 0); b.set(19, 4, 0);
  const ink = H('#5a4a30');
  // the beetle: an oval, a line down its back, six legs
  for (let a = 0; a < 20; a++) { const t = (a / 20) * Math.PI * 2; b.set(Math.round(12 + Math.cos(t) * 3.4), Math.round(11 + Math.sin(t) * 4.4), ink); }
  for (let y = 7; y < 16; y++) b.set(12, y, ink);
  for (const [x, y] of [[8, 9], [7, 12], [8, 15], [16, 9], [17, 12], [16, 15]]) b.set(x, y, ink);
  for (let x = 6; x < 12; x++) b.set(x, 18, mix(ink, H('#e8dab4'), 0.4));
  return finish(b);
}
// a block of tōtara: red-brown timber, end grain rings, a pale cut face
function totaraArt() {
  const b = cell(2, 1);
  const t = ramp('#4a1e10', '#7a3420', '#a85434', '#d07a50');
  box(b, 3, 6, 40, 13, t);
  for (let x = 4; x < 42; x++) if ((x * 7) % 11 < 2) b.set(x, 9 + ((x * 3) % 6), shade(t[1], -0.1));
  for (let y = 6; y < 19; y++) for (let x = 38; x < 44; x++) {
    const r = Math.hypot((x - 41) * 1.6, y - 12.5);
    b.set(x, y, Math.floor(r) % 2 ? H('#e0a070') : H('#c07a4a'));
  }
  return finish(b);
}
// a tangle of old blue fishing net
function netArt() {
  const b = cell(1, 1);
  for (let y = 4; y < 21; y++) for (let x = 3; x < 22; x++) {
    const d = Math.hypot(x - 12, (y - 12) * 1.2);
    if (d > 9.6) continue;
    const knot = ((x + y) % 4 === 0) || ((x - y + 40) % 4 === 0);
    if (knot) b.set(x, y, tone(P.net, 0.8 - (x + y) / 50, x, y));
  }
  return finish(b);
}
// Rosie's hand-made Junior Ranger badge: a gold star cut from a tin lid on a green ribbon
function badgeArt() {
  const b = cell(1, 1);
  box(b, 8, 1, 3, 8, P.green); box(b, 13, 1, 3, 8, P.green, -0.1);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 4 : 9; pts.push([12 + Math.cos(a) * r, 14 + Math.sin(a) * r]); }
  for (let y = 4; y < 24; y++) for (let x = 2; x < 22; x++) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside; }
    if (inside) b.set(x, y, tone(P.gold, 0.85 - (x - 4) / 30 - (y - 6) / 30, x, y));
  }
  b.set(11, 13, H('#8a5a10')); b.set(13, 13, H('#8a5a10')); b.rect(11, 16, 3, 1, H('#8a5a10'));
  return finish(b);
}
// Tīpene's carved paddle (a hoe): a long shaft, a leaf blade with a koru carved at the throat
function paddleArt() {
  const b = cell(1, 4);
  box(b, 10, 2, 4, 56, P.wood);
  for (let y = 56; y < 92; y++) {
    const u = (y - 56) / 36, w = Math.round(2 + Math.sin(Math.PI * Math.min(1, u * 1.1)) * 7);
    for (let x = 12 - w; x < 12 + w; x++) b.set(x, y, tone(P.wood, 0.8 - (x - 12 + w) / (w * 3) - u * 0.2, x, y));
  }
  const ink = H('#3a2010');
  for (let a = 0; a < 18; a++) { const t = (a / 18) * Math.PI * 1.6, r = 1 + t * 1.2; b.set(Math.round(12 + Math.cos(t) * r), Math.round(64 + Math.sin(t) * r), ink); }
  b.rect(9, 54, 6, 2, H('#c8a040'));
  return finish(b);
}
// Ngaio's kete: flax plait with a band of blue net woven through, two handles
function keteArt() {
  const b = cell(2, 2);
  for (let y = 14; y < 44; y++) for (let x = 6; x < 42; x++) {
    const plait = ((x >> 1) + (y >> 1)) & 1;
    const band = y > 25 && y < 31;
    const l = 0.8 - (x - 6) / 70 - (y - 14) / 60 + (plait ? 0.1 : -0.1);
    b.set(x, y, tone(band ? P.net : P.flax, l, x, y));
  }
  for (const x0 of [12, 30]) for (let a = 0; a <= 14; a++) { const t = (a / 14) * Math.PI; b.set(Math.round(x0 + 3 - Math.cos(t) * 5), Math.round(14 - Math.sin(t) * 9), H('#86692a')); b.set(Math.round(x0 + 3 - Math.cos(t) * 5), Math.round(13 - Math.sin(t) * 9), H('#b08e40')); }
  return finish(b);
}
// Teo's skillet bread: a golden round, scored, a dusting of flour
function flatbreadArt() {
  const b = cell(1, 1);
  for (let y = 5; y < 20; y++) for (let x = 3; x < 22; x++) {
    const d = Math.hypot(x - 12, (y - 12.5) * 1.3);
    if (d > 9) continue;
    b.set(x, y, tone(P.bread, 0.85 - d / 14 - (x + y - 15) / 60, x, y));
  }
  for (const [x, y] of [[9, 10], [10, 11], [14, 10], [15, 11], [12, 14], [13, 15]]) b.set(x, y, H('#8a4a1a'));
  for (const [x, y] of [[8, 8], [16, 13], [11, 16]]) b.set(x, y, H('#fff4dc'));
  return finish(b);
}
// Sunny's bush boil-up: a dented billy tin of greens, kūmara and fish
function boilupArt() {
  const b = cell(1, 2);
  box(b, 3, 14, 18, 28, P.tin);
  for (let x = 4; x < 20; x++) b.set(x, 14, H('#e0e8ee'));
  box(b, 4, 15, 16, 4, P.stew, 0.1);
  for (const [x, y, c] of [[7, 16, '#4a8a34'], [11, 15, '#e8a050'], [15, 16, '#f0e8d8'], [9, 17, '#2a5a22']] as [number, number, string][]) { b.set(x, y, H(c)); b.set(x + 1, y, H(c)); }
  for (let a = 0; a <= 12; a++) { const t = (a / 12) * Math.PI; b.set(Math.round(12 - Math.cos(t) * 8), Math.round(13 - Math.sin(t) * 9), H('#5a6066')); }
  return finish(b);
}

let done = false;
export function registerNpcItemArt() {
  if (done) return;
  done = true;
  registerItemArt('q_radio', () => radioArt(false), { w: 1, h: 2 });
  registerItemArt('q_radio_fixed', () => radioArt(true), { w: 1, h: 2 });
  registerItemArt('q_page', pageArt, { w: 1, h: 1 });
  registerItemArt('q_totara', totaraArt, { w: 2, h: 1 });
  registerItemArt('q_net', netArt, { w: 1, h: 1 });
  registerItemArt('q_badge', badgeArt, { w: 1, h: 1 });
  registerItemArt('q_paddle', paddleArt, { w: 1, h: 4 });
  registerItemArt('q_kete', keteArt, { w: 2, h: 2 });
  registerItemArt('dish_flatbread', flatbreadArt, { w: 1, h: 1 });
  registerItemArt('dish_boilup', boilupArt, { w: 1, h: 2 });
}

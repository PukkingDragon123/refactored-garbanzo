// V11 NPCs: where the new people live, painted as world props (top-left light, a dark outline, ground
// tufts at the feet so nothing looks pasted on):
//   station(fixed)   Te Puni ranger station on the bush track: a timber hut with the roof torn half off
//                    and a blue tarp flapping over the hole (or, fixed, a new tin roof), a bent radio
//                    mast with no radio, a rain tank, a carved sign
//   tallTree()       the tall kahikatea beside it (the trunk runs out of the top of the frame)
//   radio()          the station radio caught in the branches
//   margeHut()       Marge's palm-frond A-frame in the grove, an easel, pressed plants drying on a line
//   helixCamp()      a yellow dome tent, crates stencilled with the helix, a sample rack, a flag
//   hunterCamp()     a fly tarp on mānuka poles, a stone fire ring, a billy on a hook, a meat-safe box
//   canLog() / can() Sunny's log and her tin cans
//   stake(set)       a trap stake with a red flax tie (a tunnel trap beside it once set)
//   helixTrap()      a yellow Helix live trap with a numbered tag
//   fallenTotara()   the old fallen tōtara across the Fernwood stream (red bark, a sawn face)
//   carving() / weaving()  Tīpene's block and chisel roll, Ngaio's mat and flax bundle (camp visits)

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { drawPx, pxWidth } from '../../../ui/v11/pixfont';

const H = hex;
const OUT = H('#120a08');
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
type Ramp = C[];
const R = (...h: string[]): Ramp => h.map(c => H(c));
/** a ramp tone for light 0..1, dithered between steps */
const tone = (r: Ramp, l: number, x: number, y: number) => { const f = Math.max(0, Math.min(0.999, l)) * (r.length - 1); const i = Math.floor(f); return f - i > dith(x, y) ? r[Math.min(r.length - 1, i + 1)] : r[i]; };

const P = {
  timber: R('#2a180c', '#4a2e18', '#6e4a28', '#946a3c', '#b88a52'),
  grey: R('#26241e', '#46423a', '#6a655a', '#8e887a', '#b0aa9a'),
  tarp: R('#0c1a3a', '#16306a', '#2a4c9a', '#4a72c4', '#7aa2e4'),
  tin: R('#2a2e34', '#4e565e', '#76808a', '#a0aab4', '#d0d8de'),
  tank: R('#1a2a1e', '#2e4634', '#46644a', '#62845e', '#86a878'),
  leaf: R('#0e1e0e', '#1a3418', '#2a4e22', '#40702e', '#5e9440'),
  frond: R('#2a2410', '#4a4020', '#6e6030', '#968444', '#bca85e'),
  yellow: R('#3a2a04', '#7a5a0a', '#b88a12', '#e0b41e', '#ffe060'),
  white: R('#3a3e44', '#7c828a', '#b0b6bc', '#dce0e4', '#ffffff'),
  canvas: R('#2a2a1a', '#4e4c34', '#76724e', '#9c9870', '#c4c094'),
  stone: R('#1c1c1e', '#3a3a3e', '#5a5a5e', '#7e7e80', '#a4a4a4'),
  bark: R('#1e1008', '#3a2010', '#5a3418', '#7a4a24', '#9a6434'),
  totara: R('#3a140a', '#5e2414', '#84381e', '#a8502c', '#d07a50'),
  flax: R('#2a1e0c', '#5a4418', '#86692a', '#b08e40', '#e0c070'),
  red: R('#3a0806', '#6a1410', '#9a2418', '#c83a2a', '#e86a4a'),
  moss: R('#14200c', '#22361a', '#344e24', '#4a6a30', '#6a8a40'),
};
const S = (b: PixelBuffer, ax: number, ay: number): Sprite => ({ buf: b, ax, ay } as Sprite);

function outline(b: PixelBuffer) {
  const src = b.data.slice();
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (src[y * b.w + x] >>> 24) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < b.w && Y < b.h && (src[Y * b.w + X] >>> 24)) { b.data[y * b.w + x] = OUT; break; } }
  }
}
/** a lit box face: light falls off to the right and down */
function face(b: PixelBuffer, x0: number, y0: number, w: number, h: number, r: Ramp, bias = 0, fn?: (x: number, y: number) => number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const u = (x - x0) / Math.max(1, w), v = (y - y0) / Math.max(1, h);
    b.set(x, y, tone(r, 0.72 - u * 0.3 - v * 0.25 + bias + (fn?.(x, y) ?? 0), x, y));
  }
}
/** grass tufts along the foot so the prop sits in the ground */
function tufts(b: PixelBuffer, x0: number, x1: number, y: number, seed = 1) {
  for (let x = x0; x < x1; x++) {
    const n = hash(x, 3, seed);
    if (n < 0.45) continue;
    const h = 1 + Math.floor(n * 5);
    for (let j = 0; j < h; j++) b.set(x + (j > 2 && n > 0.8 ? 1 : 0), y - j, tone(P.leaf, 0.3 + j / 8 + n * 0.2, x, y - j));
  }
}
/** a straight line of pixels */
function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: C | ((t: number) => C), w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    for (let k = 0; k < w; k++) b.set(x + k, y, typeof c === 'function' ? c(t) : c);
  }
}

// ================================================================== the ranger station
export function station(fixed: boolean): Sprite {
  const W = 150, Hh = 96, b = new PixelBuffer(W, Hh), G = Hh - 4;
  // the rain tank on its stand
  face(b, 6, G - 30, 18, 26, P.tank, 0, (x, y) => (((y - G) & 3) === 0 ? -0.25 : 0));
  for (let x = 6; x < 24; x++) b.set(x, G - 31, tone(P.tank, 0.9, x, 0));
  face(b, 8, G - 4, 2, 4, P.timber); face(b, 20, G - 4, 2, 4, P.timber);
  // the hut: weatherboards, a door, a window with one pane gone
  const hx = 28, hw = 96, top = G - 46;
  face(b, hx, top, hw, 46, P.timber, 0, (x, y) => (((y - top) % 5) === 0 ? -0.35 : hash(x >> 2, y, 3) > 0.92 ? -0.15 : 0));
  face(b, hx + 58, top + 16, 16, 30, P.timber, -0.25);
  b.set(hx + 70, top + 31, H('#d8b048'));
  face(b, hx + 14, top + 12, 22, 14, P.grey, -0.3);
  for (let y = top + 12; y < top + 26; y++) { b.set(hx + 25, y, OUT); }
  for (let x = hx + 14; x < hx + 36; x++) b.set(x, top + 19, OUT);
  for (let y = top + 13; y < top + 19; y++) for (let x = hx + 15; x < hx + 25; x++) b.set(x, y, tone(R('#304050', '#5a7a90', '#a0c8dc'), 0.5 + (x - y) / 20, x, y));
  if (!fixed) for (const [x, y] of [[hx + 28, top + 14], [hx + 31, top + 16], [hx + 29, top + 18]]) b.set(x, y, H('#c8e0ec'));
  // a board over the door with the station's name in pixel letters
  const sw = 50, sx = hx + 40;
  face(b, sx, top + 2, sw, 11, P.timber, 0.3);
  const t = 'TE PUNI';
  drawPx(b, t, sx + Math.floor((sw - pxWidth(t, { bold: true })) / 2), top + 1, H('#2a1a0a'), { bold: true });
  b.set(sx + 2, top + 4, H('#c8c0a8')); b.set(sx + sw - 3, top + 4, H('#c8c0a8'));
  // the roof: half torn off with a blue tarp over the hole, or a new tin roof
  const ry = top - 14;
  for (let y = ry; y < top; y++) {
    const k = (y - ry) / 14;
    const x0 = Math.round(hx - 6 + (1 - k) * 4), x1 = Math.round(hx + hw + 6 - (1 - k) * 4);
    for (let x = x0; x < x1; x++) {
      if (fixed) { b.set(x, y, tone(P.tin, 0.75 - (x - x0) / 260 - k * 0.2 + ((x & 3) === 0 ? -0.25 : 0), x, y)); continue; }
      const torn = x > hx + 50 && x < hx + 84 && y < top - 2 - Math.round(Math.sin((x - hx) * 0.4) * 2);
      if (torn) { if (x > hx + 54 && x < hx + 82 && y > ry + 3) b.set(x, y, tone(P.tarp, 0.7 - k * 0.3 + Math.sin(x * 0.5) * 0.15, x, y)); continue; }
      b.set(x, y, tone(P.grey, 0.7 - k * 0.3 + ((x & 3) === 0 ? -0.2 : 0), x, y));
    }
  }
  if (!fixed) {
    // the tarp's loose corner flapping, a rope tie, bare rafters
    for (let i = 0; i < 6; i++) line(b, hx + 82 + i, ry + 3, hx + 88 + i, ry - 4 + i, tone(P.tarp, 0.6, i, 0));
    for (const x of [hx + 60, hx + 68, hx + 76]) line(b, x, top, x + 4, ry + 1, tone(P.timber, 0.5, x, 0));
    line(b, hx + 56, ry + 4, hx + 52, top + 6, H('#c8b080'));
  }
  // the radio mast, bent over by the storm (fixed: straight, with the radio's aerial on top)
  const mx = hx + hw - 10;
  if (fixed) { line(b, mx, top - 13, mx, top - 46, H('#5a6066')); line(b, mx - 4, top - 40, mx + 4, top - 40, H('#5a6066')); b.set(mx, top - 47, H('#e04030')); }
  else { line(b, mx, top - 13, mx + 2, top - 30, H('#5a6066')); line(b, mx + 2, top - 30, mx + 16, top - 36, H('#5a6066')); line(b, mx + 16, top - 36, mx + 22, top - 31, H('#5a6066')); }
  // steps, a woodpile, ground
  face(b, hx + 56, G - 2, 20, 3, P.timber, 0.15);
  for (let i = 0; i < 4; i++) face(b, hx + hw + 2 + (i % 2) * 5, G - 4 - Math.floor(i / 2) * 4, 9, 4, P.bark, 0.1, (x) => (x % 9 === 0 ? 0.3 : 0));
  outline(b);
  tufts(b, 0, W, G + 2, 7);
  return S(b, Math.round(W / 2), G + 1);
}

/** the tall kahikatea beside the station: the trunk runs out the top of the frame, a crown of branches */
export function tallTree(): Sprite {
  const W = 120, Hh = 300, b = new PixelBuffer(W, Hh), G = Hh - 3, cx = 60;
  for (let y = 0; y < G; y++) {
    const r = 6 + (y / G) * 4 + (y > G - 14 ? (y - (G - 14)) * 0.8 : 0);
    for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
      const u = (x - (cx - r)) / (2 * r);
      const ridge = ((x * 3 + (y >> 2)) % 7) === 0 ? -0.25 : 0;
      b.set(x, y, tone(P.bark, 0.82 - u * 0.75 + ridge, x, y));
    }
  }
  // branches out to a crown of dark foliage near the top, mossy knots
  const crown: [number, number, number][] = [[cx - 30, 70, 22], [cx + 28, 64, 24], [cx - 10, 40, 26], [cx + 8, 96, 18], [cx - 38, 118, 14], [cx + 36, 128, 14]];
  for (const [x, y, r] of crown) {
    line(b, cx, y + 22, x, y + 4, (t) => tone(P.bark, 0.6 - t * 0.2, 0, 0), 3);
    for (let j = -r; j <= r; j++) for (let i = -r * 1.4; i <= r * 1.4; i++) {
      const d = (i / (r * 1.4)) ** 2 + (j / r) ** 2;
      if (d > 1 || hash(Math.round(x + i), y + j, 5) > 0.93 - d * 0.2) continue;
      const X = Math.round(x + i), Y = y + j;
      b.set(X, Y, tone(P.leaf, 0.8 - (i + r) / (r * 4) - (j + r) / (r * 3) + (hash(X >> 1, Y >> 1, 9) - 0.5) * 0.3, X, Y));
    }
  }
  for (const [x, y] of [[cx - 4, 160], [cx + 3, 210], [cx - 5, 250]]) for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) b.set(x + i, y + j, tone(P.moss, 0.6 - j * 0.1, x + i, y + j));
  outline(b);
  tufts(b, cx - 24, cx + 24, G + 1, 4);
  return S(b, cx, G);
}
/** the radio caught in the branches */
export function radio(): Sprite {
  const b = new PixelBuffer(12, 18);
  face(b, 2, 4, 8, 13, R('#0e0e12', '#1c1e24', '#2c3038', '#4a505a'));
  b.rect(3, 6, 6, 3, H('#3a4a3a'));
  line(b, 7, 4, 8, 0, H('#2c3038'));
  b.set(8, 0, H('#e06020'));
  for (let x = 2; x < 10; x++) b.set(x, 12, H('#8a9096'));
  outline(b);
  return S(b, 6, 17);
}

// ================================================================== Marge's hut
export function margeHut(): Sprite {
  const W = 110, Hh = 74, b = new PixelBuffer(W, Hh), G = Hh - 4;
  // an A-frame thatched with palm fronds, an open front with a hanging sail-cloth door
  for (let y = 8; y < G; y++) {
    const k = (y - 8) / (G - 8);
    const half = 6 + k * 40;
    for (let x = Math.round(46 - half); x <= Math.round(46 + half); x++) {
      const row = Math.floor((y - 8) / 4);
      const fr = Math.abs(((x + row * 3) % 6) - 3) < 1;
      b.set(x, y, tone(P.frond, 0.8 - (x - (46 - half)) / (half * 3.2) - k * 0.2 + (fr ? -0.25 : 0) + ((y & 3) === 0 ? -0.2 : 0), x, y));
    }
  }
  // the doorway and the sail-cloth
  for (let y = G - 26; y < G; y++) { const half = 7 + (y - (G - 26)) * 0.35; for (let x = Math.round(46 - half); x < Math.round(46 + half); x++) b.set(x, y, tone(R('#140c06', '#22140a', '#2e1c0e'), 0.3, x, y)); }
  for (let y = G - 26; y < G - 4; y++) for (let x = 47; x < 55 + (y - (G - 26)) * 0.3; x++) b.set(x, y, tone(P.canvas, 0.75 - (x - 47) / 30, x, y));
  // ridge pole ends sticking out, a lashing
  line(b, 36, 4, 46, 9, tone(P.timber, 0.6, 0, 0), 2); line(b, 56, 4, 46, 9, tone(P.timber, 0.4, 0, 0), 2);
  // an easel with a sketch on it
  line(b, 92, G, 98, G - 30, tone(P.timber, 0.6, 0, 0)); line(b, 106, G, 98, G - 30, tone(P.timber, 0.4, 0, 0)); line(b, 99, G, 98, G - 30, tone(P.timber, 0.5, 0, 0));
  face(b, 90, G - 30, 16, 14, R('#a8946a', '#cdbb8e', '#e8dab4', '#fbf2d8'), 0.2);
  for (let i = 0; i < 9; i++) b.set(94 + i, G - 24 + Math.round(Math.sin(i * 0.8) * 2), H('#5a4a30'));
  // a line of pressed plants drying between the hut and a stick
  line(b, 2, G - 34, 30, G - 40, H('#c8b080'));
  line(b, 2, G - 34, 2, G, tone(P.timber, 0.5, 0, 0));
  for (const x of [7, 14, 21]) { const y = G - 35 - Math.round((x / 30) * 6); for (let j = 1; j < 8; j++) for (let i = -1; i <= 1; i++) if (Math.abs(i) < 2 - j / 6) b.set(x + i, y + j, tone(P.leaf, 0.6 - j / 14, x + i, y + j)); }
  outline(b);
  tufts(b, 0, W, G + 2, 11);
  return S(b, 46, G + 1);
}

// ================================================================== Helix camp
export function helixCamp(): Sprite {
  const W = 150, Hh = 70, b = new PixelBuffer(W, Hh), G = Hh - 4;
  // the dome tent: yellow panels, grey seams, a dark zipped door
  for (let y = G - 34; y < G; y++) for (let x = 6; x < 74; x++) {
    const u = (x - 40) / 34, v = (G - y) / 34;
    if (u * u + v * v > 1) continue;
    const seam = Math.abs(u * 3 - Math.round(u * 3)) < 0.06;
    b.set(x, y, seam ? tone(P.grey, 0.5, x, y) : tone(P.yellow, 0.85 - (x - 6) / 110 - (1 - v) * 0.15, x, y));
  }
  for (let y = G - 20; y < G; y++) for (let x = 34; x < 46; x++) { const u = (x - 40) / 6, v = (G - y) / 20; if (u * u + v * v < 1) b.set(x, y, tone(R('#1a1a1e', '#2c2c32', '#3e3e46'), 0.4, x, y)); }
  // crates with the helix stencil
  for (const [x, w, h] of [[82, 24, 18], [104, 20, 14], [90, 16, 12]] as [number, number, number][]) {
    const y = h === 12 ? G - 30 : G - h;
    face(b, x, y, w, h, P.white, -0.05, (xx, yy) => ((xx - x) % 8 === 0 || (yy - y) === 0 ? -0.25 : 0));
    for (let j = 2; j < h - 2; j++) { const cx = x + w / 2; b.set(Math.round(cx + Math.sin(j * 0.9) * 2), y + j, H('#c89a10')); b.set(Math.round(cx - Math.sin(j * 0.9) * 2), y + j, H('#e8c030')); }
  }
  // the sample rack: a little stand of tubes
  face(b, 128, G - 16, 16, 3, P.grey, 0.1);
  for (let i = 0; i < 5; i++) { face(b, 129 + i * 3, G - 24, 2, 8, R('#4a6a7a', '#7aa8bc', '#c0e4f0'), 0.1); b.set(129 + i * 3, G - 25, [H('#e8c030'), H('#3aa86a'), H('#c83a2a'), H('#e8c030'), H('#4a8ac8')][i]); }
  line(b, 130, G - 13, 130, G, tone(P.grey, 0.5, 0, 0)); line(b, 142, G - 13, 142, G, tone(P.grey, 0.4, 0, 0));
  // the survey flag
  line(b, 76, G, 76, G - 48, tone(P.grey, 0.6, 0, 0));
  for (let j = 0; j < 9; j++) for (let i = 0; i < 14 - j * 0.6; i++) b.set(77 + i, G - 48 + j, tone(P.yellow, 0.8 - i / 30, i, j));
  outline(b);
  tufts(b, 0, W, G + 2, 13);
  return S(b, 40, G + 1);
}

// ================================================================== the trappers' camp
export function hunterCamp(): Sprite {
  const W = 130, Hh = 66, b = new PixelBuffer(W, Hh), G = Hh - 4;
  // the fly: an oilskin tarp slung between two mānuka poles, pegged out at the back
  line(b, 14, G, 18, G - 40, tone(P.timber, 0.6, 0, 0), 2);
  line(b, 96, G, 92, G - 40, tone(P.timber, 0.4, 0, 0), 2);
  for (let x = 16; x < 96; x++) {
    const sag = Math.round(Math.sin(((x - 16) / 80) * Math.PI) * 4);
    for (let y = G - 42 + sag; y < G - 30 + sag + Math.round((x - 16) / 14); y++) b.set(x, y, tone(P.canvas, 0.75 - (x - 16) / 160 - (y - (G - 42)) / 40, x, y));
  }
  line(b, 96, G - 32, 116, G, tone(P.canvas, 0.4, 0, 0));
  // bedrolls and packs under the fly
  face(b, 24, G - 6, 26, 6, R('#2a1a10', '#4a2e1c', '#6a4430', '#8a5e44'), 0.1);
  face(b, 58, G - 14, 12, 14, P.moss, 0.1);
  // the stone ring and the fire (the flames are drawn live), a billy on a hook
  for (let i = 0; i < 7; i++) { const x = 104 + i * 3; face(b, x, G - 3 - (i % 2), 3, 3 + (i % 2), P.stone, 0.1); }
  line(b, 106, G - 4, 112, G - 20, tone(P.timber, 0.5, 0, 0)); line(b, 124, G - 4, 118, G - 20, tone(P.timber, 0.4, 0, 0)); line(b, 108, G - 18, 122, G - 18, tone(P.timber, 0.6, 0, 0));
  face(b, 112, G - 15, 7, 6, P.tin, 0.2);
  outline(b);
  tufts(b, 0, W, G + 2, 17);
  return S(b, 56, G + 1);
}
/** Sunny's log for the cans */
export function canLog(): Sprite {
  const b = new PixelBuffer(46, 14), G = 11;
  for (let y = 2; y < G; y++) for (let x = 2; x < 44; x++) b.set(x, y, tone(P.bark, 0.8 - (y - 2) / 12 + (((x * 3 + y) % 9) === 0 ? -0.3 : 0), x, y));
  for (let y = 3; y < G - 1; y++) for (let x = 40; x < 44; x++) { const r = Math.hypot(x - 42, (y - 6) * 0.8); b.set(x, y, Math.floor(r * 1.5) % 2 ? H('#c89a64') : H('#a87a48')); }
  outline(b);
  tufts(b, 0, 46, 13, 21);
  return S(b, 23, 12);
}
export function can(): Sprite {
  const b = new PixelBuffer(7, 9);
  face(b, 0, 1, 7, 8, P.tin, 0.1, (x) => (x === 2 ? 0.3 : 0));
  for (let x = 0; x < 7; x++) b.set(x, 4, H('#c83a2a'));
  b.rect(0, 0, 7, 1, H('#d0d8de'));
  return S(b, 3, 8);
}
/** a trap stake with a red flax tie; a tunnel trap box beside it once set */
export function stake(set: boolean): Sprite {
  const b = new PixelBuffer(30, 24), G = 21;
  line(b, 6, G, 6, G - 16, tone(P.timber, 0.6, 0, 0), 2);
  for (let i = 0; i < 4; i++) { b.set(5 + i, G - 14, H('#c83a2a')); b.set(8 + i, G - 13 + i, H('#a02a20')); }
  if (set) { face(b, 10, G - 7, 18, 7, P.timber, 0.15, (x, y) => (x % 6 === 0 || y === G - 7 ? -0.25 : 0)); b.rect(26, G - 5, 2, 4, H('#1a0e08')); }
  outline(b);
  tufts(b, 0, 30, G + 2, 23);
  return S(b, 6, G);
}
/** a yellow Helix live trap with a numbered tag */
export function helixTrap(): Sprite {
  const b = new PixelBuffer(24, 14), G = 12;
  face(b, 2, 3, 20, 9, P.yellow, 0, (x, y) => ((x % 3 === 0 && y > 4) ? -0.35 : 0));
  b.rect(19, 4, 3, 7, H('#2a2a30'));
  b.rect(8, 0, 4, 3, H('#f0f0e8')); b.set(9, 1, H('#2a2a30')); b.set(11, 1, H('#2a2a30'));
  outline(b);
  tufts(b, 0, 24, G + 1, 29);
  return S(b, 12, G);
}
/** the old fallen tōtara across the stream: red stringy bark, one sawn face */
export function fallenTotara(cut: boolean): Sprite {
  const W = 120, Hh = 30, b = new PixelBuffer(W, Hh), G = Hh - 3;
  for (let x = 4; x < W - 6; x++) {
    const r = 9 - (x / W) * 3;
    const cy = G - r - 1 + Math.sin(x * 0.04) * 1.5;
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) {
      const v = (y - (cy - r)) / (2 * r);
      const str = ((x + Math.round(Math.sin(y * 0.7) * 2)) % 4) === 0;
      b.set(x, y, tone(P.totara, 0.85 - v * 0.8 + (str ? -0.25 : 0), x, y));
    }
  }
  // moss along the top, a sawn face where a block was cut (once Mori has cut it)
  for (let x = 10; x < W - 20; x++) if (hash(x, 1, 31) > 0.5) b.set(x, G - 18 + Math.round(Math.sin(x * 0.04) * 1.5), tone(P.moss, 0.7, x, 0));
  if (cut) for (let y = G - 16; y < G; y++) for (let x = 54; x < 64; x++) b.set(x, y, Math.floor(Math.hypot(x - 59, y - (G - 8)) * 1.4) % 2 ? H('#e0a070') : H('#c07a4a'));
  // a root plate at one end
  for (let j = -12; j <= 12; j++) for (let i = 0; i < 6; i++) if (Math.abs(j) < 12 - i * 1.4) b.set(W - 8 + i, G - 10 + j, tone(P.bark, 0.5 - i * 0.05, i, j));
  outline(b);
  tufts(b, 0, W, G + 2, 37);
  return S(b, 60, G);
}
/** Tīpene's carving block on a sawhorse, his chisel roll open on the ground */
export function carving(): Sprite {
  const b = new PixelBuffer(46, 26), G = 23;
  line(b, 6, G, 10, G - 10, tone(P.timber, 0.5, 0, 0), 2); line(b, 18, G, 14, G - 10, tone(P.timber, 0.4, 0, 0), 2);
  face(b, 2, G - 14, 26, 6, P.totara, 0.1, (x) => (x % 7 === 0 ? -0.3 : 0));
  for (let i = 0; i < 8; i++) b.set(8 + i * 2, G - 12 + (i % 2), H('#5a2010'));
  face(b, 28, G - 3, 16, 3, P.canvas, 0.1);
  for (let i = 0; i < 5; i++) { b.set(30 + i * 3, G - 4, H('#b0bac2')); b.set(30 + i * 3, G - 5, tone(P.timber, 0.6, 0, 0)); }
  outline(b);
  tufts(b, 0, 46, G + 2, 41);
  return S(b, 15, G);
}
/** Ngaio's weaving mat and a bundle of flax, a coil of blue net */
export function weaving(): Sprite {
  const b = new PixelBuffer(46, 16), G = 13;
  for (let y = G - 4; y < G; y++) for (let x = 2; x < 30; x++) b.set(x, y, tone(P.flax, 0.75 - (x - 2) / 60 + ((((x >> 1) + (y >> 1)) & 1) ? 0.12 : -0.12), x, y));
  for (let i = 0; i < 6; i++) line(b, 30 + i, G, 34 + i * 2, G - 10 + (i % 2), tone(R('#14260e', '#24401a', '#386028', '#52803a', '#7aa458'), 0.5 + i * 0.06, 0, 0));
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if (((i + j) & 1) === 0) b.set(10 + i, G - 8 + j, H('#3680a2'));
  outline(b);
  tufts(b, 0, 46, G + 2, 43);
  return S(b, 16, G);
}
export const PROP_TONE = { mix, shade };

// The HUD kit's objects at the HD density (24-ish art px each, where the old icons were 16): a field
// rucksack, the rugged field laptop and the instant camera. Each starts from a hand-shaped silhouette
// (rows of pixels, not primitives), is form-shaded from the top left (a lit rim, a shaded far side, a
// dithered core shadow), outlined, and then hand-detailed: straps, buckles, stitching, the pocket and
// its snap; the lid, the screen's little upload app, the keys and rubber bumpers; the lens rings,
// the flash, the viewfinder, the rainbow stripe and the print slot.

import { Art, col, dith, mixC, shadeC } from './paper/px';
import { hnoise } from './hudpx';

const K = col('#1a1008');

/** silhouette rows -> a mask */
function mask(rows: string[]) { return rows.map(r => [...r].map(c => c !== '.')); }
/** form shading on a mask: lit near the top-left edge, shaded near the bottom-right */
function shadeForm(a: Art, ox: number, oy: number, m: boolean[][], base: number, pick?: (x: number, y: number) => number | null) {
  const H = m.length, W = m[0].length;
  const on = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && m[y][x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
    if (edge) { a.put(ox + x, oy + y, K); continue; }
    const b = pick?.(x, y) ?? base;
    let c = b;
    if (!on(x - 2, y) || !on(x, y - 2)) c = shadeC(b, 0.22);
    else if (!on(x + 2, y) || !on(x, y + 2)) c = shadeC(b, -0.3);
    else if ((!on(x + 4, y) || !on(x, y + 4)) && dith(ox + x, oy + y, 0.5)) c = shadeC(b, -0.15);
    a.put(ox + x, oy + y, c);
  }
}

// ---------------------------------------------------------------- the rucksack (24 x 27)
const PACK = [
  '.....############.......',
  '...################.....',
  '..##################....',
  '..##################....',
  '...################.....',
  '..####################..',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '.######################.',
  '..####################..',
  '..####################..',
  '...##################...',
  '........................',
];
export const PACK_W = 24, PACK_H = 26;
export function paintPack(a: Art, ox: number, oy: number, fill: number) {
  const canvas = col('#4e6e3a'), flapC = col('#5e8246'), roll = col('#9a3e30'), leather = col('#6e4222'), brass = col('#c8962e');
  const m = mask(PACK);
  shadeForm(a, ox, oy, m, canvas, (x, y) => (y <= 4 ? roll : y >= 5 && y <= 11 ? flapC : null));
  // the bedroll: cream bands and a wool weave
  for (let y = 1; y <= 3; y++) for (const x of [6, 13]) { a.put(ox + x, oy + y, col('#e0c890')); a.put(ox + x + 1, oy + y, col('#b89a62')); }
  for (let x = 3; x < 18; x++) if ((x * 7) % 5 === 0) a.put(ox + x, oy + 2, shadeC(roll, -0.2));
  a.put(ox + 2, oy + 2, col('#5a2018')); a.put(ox + 2, oy + 3, col('#5a2018'));
  // the flap's curved hem and its stitching
  for (let x = 2; x < 22; x++) {
    const hy = 11 + (x > 6 && x < 17 ? 1 : 0);
    a.put(ox + x, oy + hy, K);
    a.put(ox + x, oy + hy + 1, shadeC(canvas, -0.4));
    if (x % 2 === 0) a.put(ox + x, oy + hy - 1, col('#a8c080'));
  }
  // two leather straps over the flap down to their buckles
  for (const sx of [5, 16]) {
    for (let y = 6; y <= 17; y++) {
      a.put(ox + sx, oy + y, y === 6 ? shadeC(leather, 0.3) : leather);
      a.put(ox + sx + 1, oy + y, shadeC(leather, -0.3));
      if (y % 3 === 0) a.put(ox + sx, oy + y, shadeC(leather, 0.25));
    }
    // the buckle
    for (const [dx, dy, c] of [[-1, 15, brass], [0, 15, col('#fff0a8')], [1, 15, brass], [2, 15, brass], [-1, 16, brass], [2, 16, shadeC(brass, -0.4)], [-1, 17, shadeC(brass, -0.3)], [0, 17, brass], [1, 17, brass], [2, 17, shadeC(brass, -0.4)]] as [number, number, number][]) a.put(ox + sx + dx, oy + dy, c);
    a.put(ox + sx, oy + 18, shadeC(leather, -0.2)); a.put(ox + sx + 1, oy + 18, shadeC(leather, -0.45));
  }
  // the front pocket with its own flap and a brass snap
  for (let y = 18; y <= 23; y++) for (let x = 8; x <= 15; x++) {
    const edge = x === 8 || x === 15 || y === 23;
    a.put(ox + x, oy + y, edge ? K : y === 18 ? shadeC(flapC, 0.2) : y <= 20 ? flapC : shadeC(canvas, -0.12));
  }
  for (let x = 8; x <= 15; x++) a.put(ox + x, oy + 21, K);
  a.put(ox + 11, oy + 20, brass); a.put(ox + 12, oy + 20, col('#fff0a8')); a.put(ox + 12, oy + 21, shadeC(brass, -0.4));
  // canvas weave and scuffs
  for (let y = 6; y < 25; y++) for (let x = 2; x < 22; x++) if (hnoise(x, y, 31) > 0.93 && (a.get(ox + x, oy + y) >>> 24)) a.put(ox + x, oy + y, shadeC(a.get(ox + x, oy + y), -0.12));
  // how full it is: the sides bulge with a darker belly line when it's packed
  if (fill > 0.7) for (let y = 13; y < 22; y++) { a.put(ox + 2, oy + y, mixC(a.get(ox + 2, oy + y), K, 0.4)); }
}

// ---------------------------------------------------------------- the field laptop (26 x 21)
const LAP = [
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '...####################...',
  '..######################..',
  '.########################.',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '.########################.',
];
export const LAP_W = 26, LAP_H = 19;
export function paintLaptop(a: Art, ox: number, oy: number, t: number) {
  const shell = col('#5a6670'), bump = col('#d8662a');
  shadeForm(a, ox, oy, mask(LAP), shell, (x, y) => (y >= 13 ? col('#6e7a84') : null));
  // the screen in its bezel: an aqua upload app with photo thumbnails and a progress bar
  const sx = ox + 5, sy = oy + 2, sw = 16, sh = 9;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let c = y < 2 ? col('#138a86') : col('#2fb8aa');
    if (y === 0) c = col('#0e5e5a');
    if (y >= 3 && y <= 5 && (x % 5 !== 4) && x < 14) c = (x + y) % 5 === 0 ? col('#eafffb') : x % 5 < 2 ? col('#6fb150') : col('#7ab8e8');
    if (y === 7) c = x < Math.floor(((t * 3) % 1) * sw) ? col('#eafffb') : col('#0e5e5a');
    a.put(sx + x, sy + y, c);
  }
  a.put(sx + 1, sy, col('#e83a2a')); a.put(sx + 3, sy, col('#f0b23a')); a.put(sx + 5, sy, col('#8ccf4a'));
  for (let y = 0; y < 4; y++) a.px(sx + 13 - y, sy + 2 + y, col('#ffffff', 0.35));
  // a webcam dot, the hinge, the keyboard and the trackpad
  a.put(ox + 13, oy + 1, col('#1a2a30'));
  for (let x = 3; x < 23; x++) a.put(ox + x, oy + 12, x % 4 === 0 ? col('#2a3038') : col('#3a4450'));
  for (let y = 14; y <= 16; y++) for (let x = 4; x < 22; x++) if ((x + (y & 1)) % 2 === 0) a.put(ox + x, oy + y, y === 16 && x > 8 && x < 17 ? col('#c8d0d4') : col('#2a3038'));
  for (let x = 10; x < 16; x++) a.put(ox + x, oy + 17, col('#4a545e'));
  // rubber corner bumpers (it's built for the field)
  for (const [x, y] of [[3, 0], [4, 0], [3, 1], [21, 0], [22, 0], [22, 1], [0, 14], [1, 14], [0, 15], [24, 14], [25, 14], [25, 15], [1, 17], [24, 17]]) a.put(ox + x, oy + y, (x + y) % 3 ? bump : shadeC(bump, 0.3));
}

// ---------------------------------------------------------------- the instant camera (28 x 21)
const CAM = [
  '..###...............###.....',
  '.##########################.',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '############################',
  '.##########################.',
  '..########################..',
];
export const CAM_W = 28, CAM_H = 19;
export function paintCamera(a: Art, ox: number, oy: number) {
  const cream = col('#ece2cc'), dark = col('#3e3834');
  shadeForm(a, ox, oy, mask(CAM), cream, (x, y) => (y >= 11 ? dark : y <= 1 ? col('#d8ccb0') : null));
  // the rainbow stripe down the middle of the body
  const RB = ['#e83a2a', '#f0a03a', '#f4d84a', '#5ab84a', '#3a8ae8'];
  RB.forEach((h, i) => { for (let y = 2; y < 11; y++) a.put(ox + 18 + i, oy + y, y === 2 ? shadeC(col(h), 0.3) : col(h)); });
  // the flash window (left top): a ribbed lens in a chrome frame
  for (let y = 3; y <= 7; y++) for (let x = 2; x <= 8; x++) {
    const edge = y === 3 || y === 7 || x === 2 || x === 8;
    a.put(ox + x, oy + y, edge ? col('#7a7a74') : (x + y) % 2 ? col('#f6f6ee') : col('#d0d4d8'));
  }
  // the viewfinder (right top) and the red shutter button on top
  for (let y = 3; y <= 5; y++) for (let x = 23; x <= 26; x++) a.put(ox + x, oy + y, y === 3 || x === 23 ? K : col('#2a3a4a'));
  a.put(ox + 25, oy + 4, col('#8ab8e0'));
  a.put(ox + 20, oy + 0, K); a.put(ox + 21, oy + 0, K); a.put(ox + 22, oy + 0, K); a.put(ox + 21, oy + 1, col('#e8432a')); a.put(ox + 20, oy + 1, col('#ff8a6a')); a.put(ox + 22, oy + 1, col('#a82a1a'));
  // the lens: a stepped barrel, rings of dark and chrome, the glass with its catch-lights
  const lx = ox + 11, ly = oy + 11, R = 7.2;
  for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
    const d = Math.hypot(x + 0.5 - 0.5, y + 0.5 - 0.5);
    if (d > R) continue;
    let c: number;
    if (d > R - 1) c = K;
    else if (d > R - 2.2) c = x + y < 0 ? col('#c8ccd0') : col('#6a6e74');
    else if (d > R - 3) c = col('#1a1a1e');
    else if (d > 2.6) c = x + y < -1 ? col('#3a5a7a') : col('#24384c');
    else c = col('#0e1620');
    a.put(lx + x, ly + y, c);
  }
  a.put(lx - 2, ly - 2, col('#bfe0ff')); a.put(lx - 1, ly - 3, col('#bfe0ff')); a.put(lx - 3, ly - 1, col('#8ab0d8'));
  a.put(lx + 2, ly + 2, col('#5a7a9a'));
  // the print slot along the bottom and two strap lugs
  for (let x = 4; x < 24; x++) a.put(ox + x, oy + 17, x > 18 ? col('#2a2624') : K);
  a.put(ox + 0, oy + 6, col('#9a9a94')); a.put(ox + 0, oy + 7, col('#6a6a64')); a.put(ox + 27, oy + 6, col('#9a9a94')); a.put(ox + 27, oy + 7, col('#6a6a64'));
}

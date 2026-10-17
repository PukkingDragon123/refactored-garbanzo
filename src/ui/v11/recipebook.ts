// V11 recipe notebook, painted as pixel art: Mori's spiral-bound camp cookbook lying open, a green cloth
// cover round the pages, blue rules and a red margin, grease spots and a mug ring, the spiral down the
// gutter. Five recipes a page: what he knows has a snapshot of the dish taped in, its name in his marker
// hand, the pot / pan / skewer and what goes in, a tally of how often he's cooked it and a gold star
// once it came out perfect. What he doesn't know yet is a smudged silhouette, "? ? ?" and the hint.

import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { pxIconBuf } from '../pxicons';
import { pxTextBuf } from '../pxfont';
import { H, hash, dither, over, rampD } from '../pxkit';

export interface SpriteLike { w: number; h: number; d: Uint32Array }
export interface RecipeEntry {
  known: boolean;
  name: string;
  hint: string;
  method: 'pot' | 'pan' | 'skewer';
  needs: { sprite: SpriteLike | null; n: number }[];
  dish: SpriteLike | null;
  best: string | null;
  times: number;
}

export const BOOK_W = 300, BOOK_H = 172;
const PAGE = [H('#cdb88a'), H('#dcc89c'), H('#e8d8b0'), H('#f2e6c4')];
const COVER = [H('#14200f'), H('#22361a'), H('#2f4a24'), H('#3e5e30'), H('#507a3c')];
const RULE = H('#a8b4c0'), MARGIN = H('#d88878'), INK = H('#2a2414'), PENCIL = H('#7a6a50'), OUT = H('#0e0a06');

/** a sprite drawn into the buffer, shrunk by whole steps to fit a box (or as a flat silhouette) */
function sprite(b: PixelBuffer, sp: SpriteLike, cx: number, cy: number, box: number, sil: C | null = null) {
  const k = Math.max(1, Math.ceil(Math.max(sp.w, sp.h) / box));
  const w = Math.floor(sp.w / k), h = Math.floor(sp.h / k);
  const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = sp.d[(y * k) * sp.w + x * k];
    if ((c >>> 24) < 100) continue;
    b.set(x0 + x, y0 + y, sil ?? c);
  }
}

function paper(b: PixelBuffer, x0: number, y0: number, w: number, h: number, gutterRight: boolean) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    // darker toward the gutter, a little foxing
    const g = gutterRight ? (x0 + w - 1 - x) : (x - x0);
    let t = 0.78 - (g < 10 ? (10 - g) * 0.045 : 0) + (hash(x >> 3, y >> 3, 5) - 0.5) * 0.1 + (hash(x, y, 9) > 0.96 ? -0.12 : 0);
    if ((y - y0) > 18 && (y - y0 - 18) % 10 === 0 && g > 4) { b.set(x, y, RULE); continue; }
    t = Math.max(0, Math.min(1, t));
    b.set(x, y, rampD(PAGE, t, x, y));
  }
  // the red margin
  const mx = gutterRight ? x0 + 12 : x0 + 16;
  for (let y = y0 + 1; y < y0 + h - 1; y++) if (hash(mx, y, 3) > 0.06) b.set(mx, y, MARGIN);
}

function stain(b: PixelBuffer, cx: number, cy: number, r: number, ring: boolean, seed: number) {
  const C1 = H('#b89a62', 150), C2 = H('#a8884e', 170);
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x, y) + (hash(x, y, seed) - 0.5) * 0.9;
    if (ring ? Math.abs(d - r) < 0.7 : d < r) b.blend(cx + x, cy + y, ring && hash(x, y, seed + 1) > 0.5 ? C2 : C1);
  }
}

function tally(b: PixelBuffer, x: number, y: number, n: number) {
  for (let i = 0; i < Math.min(n, 12); i++) {
    const g = Math.floor(i / 5), k = i % 5;
    const bx = x + g * 9;
    if (k < 4) for (let j = 0; j < 5; j++) b.set(bx + k * 2, y + j, PENCIL);
    else for (let j = 0; j < 7; j++) b.set(bx - 1 + j, y + 4 - Math.floor(j * 0.7), PENCIL);
  }
}

function star(b: PixelBuffer, cx: number, cy: number) {
  const S = ['...#...', '...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
  const G = [H('#6a4406'), H('#d29c1c'), H('#ffd84a'), H('#fff2a8')];
  S.forEach((r, y) => { for (let x = 0; x < 7; x++) if (r[x] === '#') b.set(cx - 3 + x, cy - 4 + y, y < 3 ? G[3] : y < 5 ? G[2] : G[1]); });
  // the outline
  S.forEach((r, y) => { for (let x = 0; x < 7; x++) if (r[x] === '#') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = cx - 3 + x + dx, yy = cy - 4 + y + dy; const ry = S[y + dy], ch = ry ? ry[x + dx] : '.'; if (ch !== '#') b.set(xx, yy, G[0]); } });
}

/** a snapshot of the dish taped onto the page (or a smudge for what's unknown) */
function snapshot(b: PixelBuffer, x: number, y: number, e: RecipeEntry, seed: number) {
  const W = 24, Hh = 24;
  const tilt = hash(seed, 1, 3) > 0.5 ? 1 : 0;
  if (e.known) {
    // photo: white border, a sky-or-table backdrop, the dish
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const xx = x + i, yy = y + j + (i > W / 2 && tilt ? 0 : 0);
      const edge = i === 0 || j === 0 || i === W - 1 || j === Hh - 1;
      if (edge) { b.set(xx, yy, H('#8a7a5a')); continue; }
      if (i < 2 || j < 2 || i > W - 3 || j > Hh - 5) { b.set(xx, yy, H('#f8f4e8')); continue; }
      b.set(xx, yy, j < 12 ? (dither(xx, yy) > 0.6 ? H('#5a4a3a') : H('#4a3a2c')) : (dither(xx, yy) > 0.5 ? H('#7a5a36') : H('#6a4c2c')));
    }
    if (e.dish) sprite(b, e.dish, x + W / 2, y + 10, 18);
    // a piece of tape over the top
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) b.blend(x + 6 + i, y - 2 + j, H('#f0e4a8', 190));
  } else {
    // a pencil box with a smudged silhouette
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const edge = (i === 0 || j === 0 || i === W - 1 || j === Hh - 1) && hash(i, j, seed) > 0.25;
      if (edge) b.set(x + i, y + j, PENCIL);
    }
    if (e.dish) sprite(b, e.dish, x + W / 2, y + Hh / 2, 18, H('#b8a47e'));
    over(b, pxTextBuf('?', { font: 'script', color: '#7a6a50' }), x + 9, y + 5);
  }
}

const METHOD_ICON = { pot: 'v11pot', pan: 'v11fire', skewer: 'v11knife' } as const;

function entry(b: PixelBuffer, x: number, y: number, w: number, e: RecipeEntry, seed: number) {
  snapshot(b, x, y + 2, e, seed);
  const tx = x + 30;
  if (e.known) {
    over(b, pxTextBuf(e.name, { font: 'script', color: '#2a2414', bleed: '#4a3a20', maxW: w - 34, maxLines: 1 }), tx, y);
    // what goes in: the pot / pan / skewer, then each ingredient and how many
    let ix = tx;
    const iy = y + 14;
    const mic = pxIconBuf(METHOD_ICON[e.method]);
    over(b, mic, ix, iy + Math.floor((10 - mic.h) / 2));
    ix += mic.w + 2;
    over(b, pxTextBuf(':', { color: '#7a6a50' }), ix - 1, iy + 2);
    ix += 2;
    for (const n of e.needs) {
      if (n.sprite) { sprite(b, n.sprite, ix + 5, iy + 5, 10); ix += 11; }
      const t = pxTextBuf('×' + n.n, { font: 'body', color: '#2a2414' });
      over(b, t, ix, iy + 2);
      ix += t.w + 3;
    }
    // how often, how well
    if (e.times) tally(b, x + w - 30, y + 3, e.times);
    if (e.best === 'perfect') star(b, x + w - 6, y + 18);
  } else {
    over(b, pxTextBuf('? ? ?', { font: 'script', color: '#8a7650', bleed: '#9a8660' }), tx, y);
    over(b, pxTextBuf(e.hint, { color: '#6a5a40', maxW: w - 32, maxLines: 2, lineH: 9 }), tx, y + 12);
  }
}

/** the open notebook with all the recipes (two pages of five) */
export function paintRecipeSpread(entries: RecipeEntry[]): PixelBuffer {
  const W = BOOK_W, Hh = BOOK_H;
  const b = new PixelBuffer(W, Hh);
  // a hard shadow under the book
  for (let y = 4; y < Hh; y++) for (let x = 4; x < W; x++) b.set(x, y, H('#000000', 90));
  // the cloth cover
  for (let y = 0; y < Hh - 4; y++) for (let x = 0; x < W - 4; x++) {
    const e = Math.min(x, y, W - 5 - x, Hh - 5 - y);
    if (e === 0) { b.set(x, y, OUT); continue; }
    const t = 0.55 + (e === 1 ? 0.3 : 0) - (y / Hh) * 0.2 + (((x + y * 2) % 4 === 0) ? -0.12 : 0) + (hash(x, y, 77) > 0.95 ? 0.15 : 0);
    b.set(x, y, rampD(COVER, t, x, y));
  }
  // stitching round the cover
  for (let x = 4; x < W - 8; x += 3) { b.set(x, 2, H('#c8b47c')); b.set(x, Hh - 7, H('#a8935e')); }
  for (let y = 4; y < Hh - 8; y += 3) { b.set(2, y, H('#c8b47c')); b.set(W - 7, y, H('#a8935e')); }
  // page thickness (stacked edges) under each page, then the pages
  const LX = 6, RX = 152, PY = 5, PW = 142, PH = 158;
  for (let k = 3; k >= 1; k--) {
    for (let x = LX - k; x < LX + PW; x++) b.set(x, PY + PH - 1 + k, k % 2 ? H('#b8a478') : H('#d8c8a0'));
    for (let x = RX; x < RX + PW + k; x++) b.set(x, PY + PH - 1 + k, k % 2 ? H('#b8a478') : H('#d8c8a0'));
    for (let y = PY + 2; y < PY + PH + k; y++) { b.set(LX - k, y, k % 2 ? H('#b8a478') : H('#d8c8a0')); b.set(RX + PW - 1 + k, y, k % 2 ? H('#b8a478') : H('#d8c8a0')); }
  }
  paper(b, LX, PY, PW, PH, true);
  paper(b, RX, PY, PW, PH, false);
  // a dog-ear on the right page
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7 - j; i++) b.set(RX + PW - 1 - i, PY + PH - 1 - j, i + j === 6 ? H('#a8946a') : H('#c8b48a'));
  // grease spots and a mug ring
  stain(b, LX + 108, PY + 120, 9, true, 4);
  stain(b, RX + 30, PY + 140, 2, false, 6);
  stain(b, LX + 40, PY + 30, 1, false, 8);
  // the spiral down the gutter
  for (let y = PY + 6; y < PY + PH - 6; y += 8) {
    for (const [dx, dy, c] of [[-3, 0, '#3a3a40'], [-2, -1, '#6a6a74'], [-1, -1, '#9a9aa8'], [0, -1, '#c8c8d4'], [1, -1, '#9a9aa8'], [2, 0, '#6a6a74'], [3, 1, '#3a3a40'], [-3, 1, '#2a2a30']] as [number, number, string][])
      b.set(150 + dx, y + dy, H(c));
    b.set(146, y, H('#1a140c')); b.set(154, y, H('#1a140c'));
  }
  // headings
  const known = entries.filter(e => e.known).length;
  over(b, pxTextBuf('Camp cookbook', { font: 'script', color: '#2a2414', bleed: '#4a3a20' }), LX + 20, PY + 3);
  over(b, pxTextBuf(`${known} OF ${entries.length} KNOWN`, { font: 'tiny', color: '#7a6a50' }), RX + PW - 8 - pxTextBuf(`${known} OF ${entries.length} KNOWN`, { font: 'tiny' }).w, PY + 6);
  // the red ribbon marker, its end hanging out of the bottom of the book
  for (let y = PY + PH - 2; y < Hh; y++) for (let x = 0; x < 4; x++) {
    if (y >= Hh - 2 && (x === 1 || x === 2)) continue;
    b.set(RX + 70 + x, y, x === 0 ? H('#6a1408') : x === 3 ? H('#8a2010') : H('#c8341e'));
  }
  // the entries
  entries.forEach((e, i) => {
    const left = i < 5;
    const x = (left ? LX + 20 : RX + 16), y = PY + 19 + (i % 5) * 28;
    entry(b, x, y, PW - 26, e, i + 1);
  });
  return b;
}

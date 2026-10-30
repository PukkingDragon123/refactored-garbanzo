// V12 crossroads signpost art: a weathered timber post set in a little cairn of stones and tussock,
// with a carved plank for every way on. Each plank ends in an arrow point toward where that path
// goes (left / right along the walk, or a branch off it); a branch plank carries a painted ochre
// chevron (up: into the bush behind, down: off toward the camera) and, while the way is still shut,
// the piece of gear it needs nailed to it as a little painted icon (a coil of rope, a boot, a
// lantern...). Place names are painted in cream on the wood with the V11 bitmap face. All hard
// pixels, no smoothing; the sprite is cached per sign.

import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import type { C } from '../../art/color';
import { drawPx, pxWidth } from '../../ui/v11/pixfont';

export type GearIcon = 'rope' | 'boot' | 'lantern' | 'mask' | 'glove' | 'staff' | 'fin' | 'koru';
export interface ArmSpec {
  text: string;
  /** which way the plank points */
  dir: 'left' | 'right';
  /** a branch off the walk: the chevron painted on it */
  mark?: 'up' | 'down';
  /** still shut: the gear it needs */
  lock?: GearIcon | null;
}
/** where each plank ended up, relative to the sprite's anchor (the foot of the post) */
export interface ArmBox { x0: number; y0: number; x1: number; y1: number }
export interface SignArt { buf: PixelBuffer; ax: number; ay: number; arms: ArmBox[] }

const PLANK_H = 12, GAP = 2, TIP = 5;
const W0 = hex('#24140a'), W1 = hex('#4a2e18'), W2 = hex('#6a4626'), W3 = hex('#86603a'), W4 = hex('#a47c4c');
const PAINT = hex('#f2e2b4'), PAINT_DIM = hex('#a89470'), INK = hex('#1e1008'), OCHRE = hex('#c8582e');

/** tiny painted gear icons (7 x 7) */
const ICONS: Record<GearIcon, { rows: string[]; pal: Record<string, string> }> = {
  rope: { rows: ['..aaa..', '.a...a.', 'a.bbb.a', 'a.b.b.a', 'a.bbb.a', '.a...a.', '..aaaaa'], pal: { a: '#d8b878', b: '#a08048' } },
  boot: { rows: ['..aaa..', '..aba..', '..aaa..', '..aaa..', '..aaaa.', '.aaaaaa', '.cccccc'], pal: { a: '#7a4a28', b: '#c89858', c: '#2a1a10' } },
  lantern: { rows: ['...a...', '..aaa..', '.a.b.a.', '.abbba.', '.a.b.a.', '..aaa..', '.aaaaa.'], pal: { a: '#3a3430', b: '#ffd25a' } },
  mask: { rows: ['.......', 'c.....c', 'caa.aac', 'cab.abc', 'caa.aac', 'c.....c', '.......'], pal: { a: '#5ab8e0', b: '#d8f4ff', c: '#2a3a48' } },
  glove: { rows: ['.a.a.a.', '.a.a.a.', '.aaaaa.', 'aaaaaa.', '.aaaaa.', '..aaa..', '..bbb..'], pal: { a: '#c88a48', b: '#6a4022' } },
  staff: { rows: ['.....ab', '....a.b', '...a...', '..a....', '.a.....', 'a......', '.......'], pal: { a: '#8a6a3a', b: '#e8e0c8' } },
  fin: { rows: ['aa.....', 'aaa....', '.aaa...', '.aaaa..', '..aaaa.', '..abbaa', '...bbb.'], pal: { a: '#2a6a9a', b: '#163a58' } },
  koru: { rows: ['..aaa..', '.a...a.', 'a..a..a', 'a.a.a.a', 'a..aa.a', '.a....a', '..aaaa.'], pal: { a: '#5aa447' } },
};

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** one plank (with its arrow tip) into b, top-left at (x, y), `len` px including the tip */
function plank(b: PixelBuffer, x: number, y: number, len: number, dir: 'left' | 'right', r: () => number) {
  for (let i = 0; i < len; i++) {
    // distance from the pointed end
    const fromTip = dir === 'right' ? len - 1 - i : i;
    const cut = fromTip < TIP ? TIP - fromTip : 0; // rows trimmed at top and bottom near the tip
    const lo = Math.round(cut * (PLANK_H / 2 - 1) / TIP), hi = PLANK_H - 1 - lo;
    for (let j = lo; j <= hi; j++) {
      let c: C;
      if (j === lo || j === hi) c = W0;
      else if (j === lo + 1) c = W4;
      else if (j === hi - 1) c = W1;
      else c = (i * 7 + j * 3) % 23 === 0 || (j === 5 && (i + Math.floor(r() * 3)) % 9 === 0) ? W1 : (i + j) % 11 === 0 ? W3 : W2;
      b.set(x + i, y + j, c);
    }
    // the cut end at the post side is end grain
    if ((dir === 'right' && i === 0) || (dir === 'left' && i === len - 1)) for (let j = 1; j < PLANK_H - 1; j++) b.set(x + i, y + j, j % 2 ? W1 : W0);
  }
}

function icon(b: PixelBuffer, k: GearIcon, x: number, y: number) {
  const ic = ICONS[k];
  ic.rows.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const p = ic.pal[row[xx]]; if (p) b.set(x + xx, y + yy, hex(p)); } });
}

/** paint a signpost with these planks (top to bottom) */
export function paintSignpost(arms: ArmSpec[], seed = 1): SignArt {
  const r = rng(seed * 977 + arms.length);
  const lens = arms.map(a => pxWidth(a.text) + 10 + (a.mark ? 7 : 0) + (a.lock ? 9 : 0) + TIP);
  const postW = 5;
  const left = Math.max(30, ...arms.map((a, i) => (a.dir === 'left' ? lens[i] - 3 : 0)));
  const right = Math.max(30, ...arms.map((a, i) => (a.dir === 'right' ? lens[i] - 3 : 0)));
  const top = 8;
  const armsH = arms.length * (PLANK_H + GAP);
  const postH = Math.max(52, top + armsH + 26);
  const W = left + postW + right + 4, H = postH + 6;
  const b = new PixelBuffer(W, H);
  const px = left + 2; // post's left column
  const gy = H - 4; // ground line
  // ---- the post: weathered timber, grain and a knot, a moss cap, a red flax ribbon
  for (let y = gy - postH; y <= gy; y++) {
    for (let x = 0; x < postW; x++) {
      const edge = x === 0 || x === postW - 1;
      let c = edge ? W0 : x === 1 ? W3 : x === postW - 2 ? W1 : W2;
      if (!edge && (y * 5 + x * 3) % 17 === 0) c = W1;
      b.set(px + x, y, c);
    }
  }
  const ky = gy - Math.floor(postH * 0.35);
  b.set(px + 2, ky, W0); b.set(px + 2, ky + 1, W1); b.set(px + 1, ky, W1);
  // a rounded, mossy top
  for (let x = 0; x < postW; x++) b.set(px + x, gy - postH - 1, x === 0 || x === postW - 1 ? 0 : W0);
  for (const [dx, dy, c] of [[1, 0, '#5a7a2a'], [2, 0, '#7aa040'], [3, 0, '#5a7a2a'], [2, -1, '#7aa040'], [1, 1, '#3e5a20']] as const) b.set(px + dx, gy - postH + dy, hex(c));
  // the ribbon, tied below the planks and fluttering out
  const rby = gy - postH + top + armsH + 3;
  for (let i = 0; i < 7; i++) b.set(px + postW + Math.floor(i * 0.9), rby + Math.floor(i * 0.7), hex(i % 3 === 2 ? '#8a2a1e' : '#c8402e'));
  for (let x = 0; x < postW; x++) b.set(px + x, rby - 1, hex('#c8402e'));
  // ---- the planks
  const boxes: ArmBox[] = [];
  arms.forEach((a, i) => {
    const y = gy - postH + top + i * (PLANK_H + GAP);
    const len = lens[i];
    const x = a.dir === 'right' ? px + 1 : px + postW - 1 - len;
    plank(b, x, y, len, a.dir, r);
    // nails into the post
    const nx = a.dir === 'right' ? px + 2 : px + 2;
    b.set(nx, y + 3, INK); b.set(nx, y + PLANK_H - 4, INK);
    // contents, from the post outward: [chevron] [lock icon] TEXT  (> tip)
    let cx = a.dir === 'right' ? x + 6 : x + TIP + 3;
    const parts: ('mark' | 'lock' | 'text')[] = [];
    if (a.mark) parts.push('mark');
    if (a.lock) parts.push('lock');
    parts.push('text');
    if (a.dir === 'left') parts.reverse();
    for (const p of parts) {
      if (p === 'mark') {
        const my = y + 4;
        for (let k = 0; k < 3; k++) for (let w = -k; w <= k; w++) b.set(cx + 2 + w, a.mark === 'up' ? my + k : my + 2 - k, OCHRE);
        cx += 7;
      } else if (p === 'lock') {
        icon(b, a.lock!, cx, y + 2);
        cx += 9;
      } else {
        drawPx(b, a.text, cx, y + 1, a.lock ? PAINT_DIM : PAINT, { shadow: INK });
        cx += pxWidth(a.text) + 2;
      }
    }
    boxes.push({ x0: x - (px + 2), y0: y - (gy + 1), x1: x + len - (px + 2), y1: y + PLANK_H - (gy + 1) });
  });
  // ---- the cairn and the tussock at its foot
  const stones: [number, number, number, number][] = [[-7, 0, 5, 3], [3, 0, 6, 3], [-3, -2, 6, 3], [-1, 1, 4, 2], [6, -1, 3, 2]];
  for (const [dx, dy, w, h] of stones) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ed = y === 0 || x === 0 || x === w - 1;
      b.set(px + 2 + dx + x, gy - h + 1 + dy + y, hex(y === 0 ? '#b4ac9c' : ed ? '#6a6458' : (x + y) % 3 ? '#8e8678' : '#7a7466'));
    }
  }
  for (let i = 0; i < 9; i++) {
    const bx = px + 2 + Math.round((r() - 0.5) * 22), hh = 3 + Math.floor(r() * 5), lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < hh; k++) b.set(bx + Math.round((k / hh) * lean * 2), gy + 1 - k, hex(k > hh - 2 ? '#c8b060' : k % 2 ? '#8a8a3a' : '#6e7a30'));
  }
  b.outline(hex('#140c06'));
  return { buf: b, ax: px + 2, ay: gy + 1, arms: boxes };
}

/** a small bobbing key hint: an up or down chevron in a key cap (drawn next to a branch plank) */
export function paintKeyHint(dir: 'up' | 'down'): PixelBuffer {
  const b = new PixelBuffer(11, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    const edge = x === 0 || y === 0 || x === 10 || y === 10;
    const corner = (x === 0 || x === 10) && (y === 0 || y === 10);
    if (corner) continue;
    b.set(x, y, edge ? hex('#1e1008') : y >= 8 ? hex('#a89470') : hex('#f2e2b4'));
  }
  for (let k = 0; k < 3; k++) for (let w = -k; w <= k; w++) b.set(5 + w, dir === 'up' ? 3 + k : 6 - k, hex('#c8582e'));
  return b;
}

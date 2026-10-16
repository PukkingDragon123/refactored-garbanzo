// V11 bitmap font drawn in code: "Kiri", a 7-pixel proportional face (upper and lower case,
// digits, punctuation, te reo macrons, arrows and a few symbols) for text painted straight into
// pixel buffers (the rhythm lessons, the dance, festival cards), so on-screen text stays pixel art at
// any scale. Each glyph is rows of '#' (ink) and '.' (paper): 7 rows from the cap line down to the
// baseline, plus up to 2 descender rows. A macron sits 2 rows over the letter (over the x-height for
// lower case, above the cap line for capitals).
//
//   drawPx(buf, 'Te Awa', x, y, colour, { shadow, outline, scale })   y = the cap line
//   pxWidth('Te Awa', scale)

import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';

type G = string[];
const g = (s: string): G => s.split('|');
const GL: Record<string, G> = {
  A: g('.###.|#...#|#...#|#####|#...#|#...#|#...#'), B: g('####.|#...#|#...#|####.|#...#|#...#|####.'), C: g('.###.|#...#|#....|#....|#....|#...#|.###.'),
  D: g('###..|#..#.|#...#|#...#|#...#|#..#.|###..'), E: g('#####|#....|#....|####.|#....|#....|#####'), F: g('#####|#....|#....|####.|#....|#....|#....'),
  G: g('.###.|#...#|#....|#.###|#...#|#...#|.####'), H: g('#...#|#...#|#...#|#####|#...#|#...#|#...#'), I: g('###|.#.|.#.|.#.|.#.|.#.|###'),
  J: g('..###|...#.|...#.|...#.|#..#.|#..#.|.##..'), K: g('#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#'), L: g('#....|#....|#....|#....|#....|#....|#####'),
  M: g('#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#'), N: g('#...#|##..#|#.#.#|#..##|#...#|#...#|#...#'), O: g('.###.|#...#|#...#|#...#|#...#|#...#|.###.'),
  P: g('####.|#...#|#...#|####.|#....|#....|#....'), Q: g('.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#'), R: g('####.|#...#|#...#|####.|#.#..|#..#.|#...#'),
  S: g('.####|#....|#....|.###.|....#|....#|####.'), T: g('#####|..#..|..#..|..#..|..#..|..#..|..#..'), U: g('#...#|#...#|#...#|#...#|#...#|#...#|.###.'),
  V: g('#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..'), W: g('#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#'), X: g('#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#'),
  Y: g('#...#|#...#|.#.#.|..#..|..#..|..#..|..#..'), Z: g('#####|....#|...#.|..#..|.#...|#....|#####'),
  a: g('....|....|.###|...#|.###|#..#|.###'), b: g('#...|#...|###.|#..#|#..#|#..#|###.'), c: g('...|...|.##|#..|#..|#..|.##'),
  d: g('...#|...#|.###|#..#|#..#|#..#|.###'), e: g('....|....|.##.|#..#|####|#...|.###'), f: g('..##|.#..|####|.#..|.#..|.#..|.#..'),
  g: g('....|....|.###|#..#|#..#|.###|...#|...#|###.'), h: g('#...|#...|###.|#..#|#..#|#..#|#..#'), i: g('#|.|#|#|#|#|#'),
  j: g('..#|...|..#|..#|..#|..#|..#|#.#|.#.'), k: g('#...|#...|#..#|#.#.|##..|#.#.|#..#'), l: g('#.|#.|#.|#.|#.|#.|.#'),
  m: g('.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#'), n: g('....|....|###.|#..#|#..#|#..#|#..#'), o: g('....|....|.##.|#..#|#..#|#..#|.##.'),
  p: g('....|....|###.|#..#|#..#|###.|#...|#...|#...'), q: g('....|....|.###|#..#|#..#|.###|...#|...#|...#'), r: g('...|...|#.#|##.|#..|#..|#..'),
  s: g('....|....|.###|#...|.##.|...#|###.'), t: g('.#..|.#..|####|.#..|.#..|.#..|..##'), u: g('....|....|#..#|#..#|#..#|#..#|.###'),
  v: g('.....|.....|#...#|#...#|.#.#.|.#.#.|..#..'), w: g('.....|.....|#...#|#.#.#|#.#.#|#.#.#|.#.#.'), x: g('....|....|#..#|#..#|.##.|#..#|#..#'),
  y: g('....|....|#..#|#..#|#..#|.###|...#|...#|###.'), z: g('....|....|####|...#|.##.|#...|####'),
  '0': g('.###.|#...#|#..##|#.#.#|##..#|#...#|.###.'), '1': g('.#.|##.|.#.|.#.|.#.|.#.|###'), '2': g('.###.|#...#|....#|...#.|..#..|.#...|#####'),
  '3': g('####.|....#|....#|.###.|....#|....#|####.'), '4': g('...#.|..##.|.#.#.|#..#.|#####|...#.|...#.'), '5': g('#####|#....|####.|....#|....#|#...#|.###.'),
  '6': g('.###.|#....|#....|####.|#...#|#...#|.###.'), '7': g('#####|....#|...#.|..#..|..#..|..#..|..#..'), '8': g('.###.|#...#|#...#|.###.|#...#|#...#|.###.'),
  '9': g('.###.|#...#|#...#|.####|....#|....#|.###.'),
  '.': g('.|.|.|.|.|.|#'), ',': g('..|..|..|..|..|..|.#|#.'), '!': g('#|#|#|#|#|.|#'), '?': g('.###.|#...#|....#|...#.|..#..|.....|..#..'),
  "'": g('#|#|.|.|.|.|.'), '’': g('#|#|.|.|.|.|.'), '"': g('#.#|#.#|...|...|...|...|...'), ':': g('.|.|#|.|.|#|.'), ';': g('..|..|.#|..|..|.#|#.'),
  '-': g('...|...|...|###|...|...|...'), '+': g('.....|.....|..#..|.###.|..#..|.....|.....'), '/': g('....#|...#.|...#.|..#..|.#...|.#...|#....'),
  '(': g('.#|#.|#.|#.|#.|#.|.#'), ')': g('#.|.#|.#|.#|.#|.#|#.'), '%': g('##..#|##.#.|...#.|..#..|.#...|.#.##|#..##'), '&': g('.##..|#..#.|.##..|.#...|#.#.#|#..#.|.##.#'),
  '*': g('.....|#.#.#|.###.|#####|.###.|#.#.#|.....'), '#': g('.#.#.|#####|.#.#.|.#.#.|.#.#.|#####|.#.#.'), '…': g('.....|.....|.....|.....|.....|.....|#.#.#'),
  '—': g('.....|.....|.....|#####|.....|.....|.....'), '·': g('..|..|..|##|##|..|..'), '‘': g('#|#|.|.|.|.|.'), '“': g('#.#|#.#|...|...|...|...|...'), '”': g('#.#|#.#|...|...|...|...|...'), ' ': g('..|..|..|..|..|..|..'),
  // arrows and symbols
  '←': g('..#....|.##....|#######|.##....|..#....|.......|.......'), '→': g('....#..|....##.|#######|....##.|....#..|.......|.......'),
  '↑': g('..#..|.###.|#.#.#|..#..|..#..|..#..|..#..'), '↓': g('..#..|..#..|..#..|..#..|#.#.#|.###.|..#..'),
  '♥': g('.#.#.|#####|#####|#####|.###.|..#..|.....'), '★': g('..#..|..#..|#####|.###.|.#.#.|#...#|.....'), '♪': g('..##|..#.|..#.|..#.|###.|###.|....'),
};
const MAC: Record<string, string> = { 'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U', 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u' };

const glyph = (ch: string): G => GL[MAC[ch] ?? ch] ?? GL[ch.toUpperCase()] ?? GL['?'];
const wOf = (G0: G) => G0.reduce((m, r) => Math.max(m, r.length), 0);

export interface PxOpts { scale?: number; shadow?: C; outline?: C; spacing?: number }

/** width in pixels of a line of text */
export function pxWidth(t: string, scale = 1, spacing = 1): number {
  let w = 0;
  for (const ch of t) w += (wOf(glyph(ch)) + spacing) * scale;
  return Math.max(0, w - spacing * scale);
}
/** height of a line (cap height 7 + descender 2) */
export const PX_LINE = 10;

type Sink = (x: number, y: number, c: C) => void;
function paint(set: Sink, t: string, x: number, y: number, c: C, o: PxOpts) {
  const s = o.scale ?? 1, sp = o.spacing ?? 1;
  const pass = (dx: number, dy: number, col: C) => {
    let cx = x;
    for (const ch of t) {
      const G0 = glyph(ch), w = wOf(G0);
      const dot = (gx: number, gy: number) => { for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) set(cx + gx * s + i + dx, y + gy * s + j + dy, col); };
      G0.forEach((row, r) => { for (let k = 0; k < row.length; k++) if (row[k] === '#') dot(k, r); });
      if (MAC[ch]) { const top = ch === ch.toUpperCase() ? -2 : 0; for (let k = 0; k < w; k++) dot(k, top); }
      cx += (w + sp) * s;
    }
  };
  if (o.outline !== undefined) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) pass(dx * s, dy * s, o.outline);
  if (o.shadow !== undefined) pass(s, s, o.shadow);
  pass(0, 0, c);
}

/** draw text into a PixelBuffer (y = the cap line); returns the width */
export function drawPx(b: PixelBuffer, t: string, x: number, y: number, c: C, o: PxOpts = {}): number {
  paint((px, py, col) => b.set(px, py, col), t, Math.round(x), Math.round(y), c, o);
  return pxWidth(t, o.scale ?? 1, o.spacing ?? 1);
}
/** the same into a raw ABGR frame buffer (the close-up's 320x180) */
export function drawPxBuf(buf: Uint32Array, W: number, H: number, t: string, x: number, y: number, c: number, o: { scale?: number; shadow?: number; outline?: number; spacing?: number } = {}): number {
  paint((px, py, col) => { if (px >= 0 && py >= 0 && px < W && py < H) buf[py * W + px] = col; }, t, Math.round(x), Math.round(y), c as C, o as PxOpts);
  return pxWidth(t, o.scale ?? 1, o.spacing ?? 1);
}
/** word-wrap to a pixel width */
export function pxWrap(t: string, maxW: number, scale = 1): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of t.split(/\s+/)) {
    const next = line ? line + ' ' + w : w;
    if (pxWidth(next, scale) > maxW && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

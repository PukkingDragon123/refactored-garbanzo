// A bitmap pixel font drawn in code for the Region Map: mixed case with 7 px capitals and a 5 px
// x-height, descenders, digits, the punctuation the map's text uses, macron vowels for te reo Māori
// (Ā ā Ē ē Ī ī Ō ō Ū ū) and arrows. Text is set pixel by pixel into a PixelBuffer (plain, bold,
// with a drop shadow or a 1 px outline) and handed to the DOM as small canvases scaled by whole
// numbers with image-rendering: pixelated, so every letter is as crisp as the map's own pixels.

import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';

/** rows above the capitals (macrons), cap height, descender rows */
export const ASC = 2, CAP = 7, DESC = 2;
/** glyph box height: top of a line to the bottom of its descenders */
export const GH = ASC + CAP + DESC;

// glyph rows start at the capital line (row 0 = top of a capital); rows 7-8 are descenders
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##', '.#..', '###.', '.#..', '.#..', '.#..', '.#..'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['#', '.', '#', '#', '#', '#', '#'],
  j: ['..#', '...', '.##', '..#', '..#', '..#', '..#', '#.#', '.#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#..', '.#..', '###.', '.#..', '.#..', '.#..', '..##'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '.', '#'],
  ';': ['..', '..', '.#', '..', '..', '..', '.#', '#.'],
  "'": ['#', '#'],
  '’': ['.#', '#.'],
  '‘': ['#.', '.#'],
  '"': ['#.#', '#.#'],
  '“': ['.#.#', '#.#.'],
  '”': ['.#.#', '#.#.'],
  '-': ['...', '...', '...', '###'],
  '–': ['....', '....', '....', '####'],
  '—': ['......', '......', '......', '######'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '·': ['.', '.', '.', '#'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..'],
  '°': ['.#.', '#.#', '.#.'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.'],
  '_': ['....', '....', '....', '....', '....', '....', '....', '####'],
  '<': ['...', '..#', '.#.', '#..', '.#.', '..#'],
  '>': ['...', '#..', '.#.', '..#', '.#.', '#..'],
  '=': ['....', '....', '####', '....', '####'],
};
const MACRON: Record<string, string> = { 'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U', 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u' };
const FOLD: Record<string, string> = { 'é': 'e', 'è': 'e', 'á': 'a', 'à': 'a', 'ó': 'o', 'ú': 'u', 'í': 'i', '…': '.', '❝': '“', '❞': '”' };

interface Glyph { w: number; px: [number, number][] }
const cache = new Map<string, Glyph>();
function glyph(ch: string): Glyph {
  let g = cache.get(ch);
  if (g) return g;
  const base = MACRON[ch] ?? FOLD[ch] ?? ch;
  const rows = G[base] ?? (base === ' ' ? null : G['?']);
  if (!rows) { g = { w: 3, px: [] }; cache.set(ch, g); return g; }
  const w = Math.max(...rows.map(r => r.length));
  const px: [number, number][] = [];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') px.push([x, y + ASC]); });
  if (MACRON[ch]) {
    // a bar over the vowel: above the capitals, or on the ascender line over lower case
    const low = ch === ch.toLowerCase();
    const y = low ? ASC : 0;
    const x0 = w <= 1 ? -1 : 1, x1 = w <= 1 ? 1 : w - 2;
    for (let x = x0; x <= x1; x++) px.push([x, y]);
    if (low && base === 'i') { const k = px.findIndex(([x, yy]) => x === 0 && yy === ASC); if (k >= 0) px.splice(k, 1); }
  }
  g = { w, px };
  cache.set(ch, g);
  return g;
}

export interface TextOpts {
  bold?: boolean;
  /** extra pixels between letters (default 1) */
  track?: number;
  /** a drop shadow one pixel down-right */
  shadow?: C;
  /** a one pixel outline all round */
  outline?: C;
}
/** width of a line of text in font pixels */
export function measure(text: string, o: TextOpts = {}): number {
  const tr = o.track ?? 1, b = o.bold ? 1 : 0;
  let w = 0, n = 0;
  for (const ch of text) { w += glyph(ch).w + b; n++; }
  return n ? w + (n - 1) * tr : 0;
}
/** lay a line of text into a buffer: x, y = the top-left of the glyph box (ASC rows above caps) */
export function drawText(buf: PixelBuffer, text: string, x: number, y: number, col: C, o: TextOpts = {}) {
  const tr = o.track ?? 1, b = o.bold ? 1 : 0;
  const pts: [number, number][] = [];
  let cx = x;
  for (const ch of text) {
    const g = glyph(ch);
    for (const [gx, gy] of g.px) { pts.push([cx + gx, y + gy]); if (b) pts.push([cx + gx + 1, y + gy]); }
    cx += g.w + b + tr;
  }
  if (o.outline) for (const [px, py] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) buf.set(px + dx, py + dy, o.outline);
  if (o.shadow) for (const [px, py] of pts) buf.set(px + 1, py + 1, o.shadow);
  for (const [px, py] of pts) buf.set(px, py, col);
}
/** break text into lines no wider than maxW font pixels */
export function wrap(text: string, maxW: number, o: TextOpts = {}): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const t = line ? line + ' ' + word : word;
      if (measure(t, o) <= maxW || !line) line = t;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

/** a small canvas holding a buffer, shown at a whole-number scale */
export function bufCanvas(b: PixelBuffer, scale: number, cls = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  const g = c.getContext('2d')!;
  g.putImageData(toImageData(b), 0, 0);
  c.style.width = b.w * scale + 'px';
  c.style.height = b.h * scale + 'px';
  c.style.imageRendering = 'pixelated';
  if (cls) c.className = cls;
  return c;
}
/** the buffer as a data URL (for CSS backgrounds) */
export function bufURL(b: PixelBuffer): string {
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  c.getContext('2d')!.putImageData(toImageData(b), 0, 0);
  return c.toDataURL();
}
/** a buffer's pixels as ImageData */
export function toImageData(b: PixelBuffer): ImageData {
  const im = new ImageData(b.w, b.h);
  im.data.set(b.bytes);
  return im;
}

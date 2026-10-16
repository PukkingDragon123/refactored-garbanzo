// V11 Blueprints: bitmap fonts drawn in code, for text painted straight onto the pixel-art papers.
//
//   'hand'  a pixel script: lowercase with ascenders and descenders on a 9-row grid (x-height 5),
//           written with a slant, a wandering baseline and the ink of whoever is writing
//           (charcoal smudges thicker, pencil drops pixels, biro is clean)
//   'caps'  7-row technical capitals for titles and labels (bold doubles the stems)
//   'tiny'  3x5 capitals for dimensions, form fields and fine print
//
// drawText(buf, text, x, y, style) paints one line (y = top of the line box) and returns its width;
// wrapText / drawPara break text into lines that fit a width. Everything lands on whole pixels.

import type { PixelBuffer } from '../../../art/pixel';
import type { C } from '../../../art/color';

export type FontId = 'hand' | 'caps' | 'tiny';
interface G { y: number; r: string[] }
const g = (y: number, ...r: string[]): G => ({ y, r });

// ---------------------------------------------------------------- the pixel script (9 rows, baseline at row 6)
const HAND: Record<string, G> = {
  a: g(2, '.11.', '...1', '.111', '1..1', '.111'),
  b: g(0, '1...', '1...', '111.', '1..1', '1..1', '1..1', '111.'),
  c: g(2, '.11', '1..', '1..', '1..', '.11'),
  d: g(0, '...1', '...1', '.111', '1..1', '1..1', '1..1', '.111'),
  e: g(2, '.11.', '1..1', '1111', '1...', '.111'),
  f: g(0, '..11', '.1..', '111.', '.1..', '.1..', '.1..', '.1..'),
  g: g(2, '.111', '1..1', '1..1', '.111', '...1', '...1', '111.'),
  h: g(0, '1...', '1...', '111.', '1..1', '1..1', '1..1', '1..1'),
  i: g(0, '1', '.', '1', '1', '1', '1', '1'),
  j: g(0, '.1', '..', '.1', '.1', '.1', '.1', '.1', '.1', '1.'),
  k: g(0, '1..', '1..', '1.1', '11.', '11.', '1.1', '1.1'),
  l: g(0, '1.', '1.', '1.', '1.', '1.', '1.', '.1'),
  m: g(2, '11.1.', '1.1.1', '1.1.1', '1.1.1', '1.1.1'),
  n: g(2, '111.', '1..1', '1..1', '1..1', '1..1'),
  o: g(2, '.11.', '1..1', '1..1', '1..1', '.11.'),
  p: g(2, '111.', '1..1', '1..1', '1..1', '111.', '1...', '1...'),
  q: g(2, '.111', '1..1', '1..1', '1..1', '.111', '...1', '...1'),
  r: g(2, '1.11', '11..', '1...', '1...', '1...'),
  s: g(2, '.111', '1...', '.11.', '...1', '111.'),
  t: g(0, '.1.', '.1.', '111', '.1.', '.1.', '.1.', '..1'),
  u: g(2, '1..1', '1..1', '1..1', '1..1', '.111'),
  v: g(2, '1...1', '1...1', '.1.1.', '.1.1.', '..1..'),
  w: g(2, '1...1', '1...1', '1.1.1', '1.1.1', '.1.1.'),
  x: g(2, '1...1', '.1.1.', '..1..', '.1.1.', '1...1'),
  y: g(2, '1..1', '1..1', '1..1', '1..1', '.111', '...1', '111.'),
  z: g(2, '1111', '...1', '..1.', '.1..', '1111'),
  A: g(0, '.11.', '1..1', '1..1', '1111', '1..1', '1..1', '1..1'),
  B: g(0, '111.', '1..1', '1..1', '111.', '1..1', '1..1', '111.'),
  C: g(0, '.111', '1...', '1...', '1...', '1...', '1...', '.111'),
  D: g(0, '111.', '1..1', '1..1', '1..1', '1..1', '1..1', '111.'),
  E: g(0, '1111', '1...', '1...', '111.', '1...', '1...', '1111'),
  F: g(0, '1111', '1...', '1...', '111.', '1...', '1...', '1...'),
  G: g(0, '.111', '1...', '1...', '1.11', '1..1', '1..1', '.111'),
  H: g(0, '1..1', '1..1', '1..1', '1111', '1..1', '1..1', '1..1'),
  I: g(0, '111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'),
  J: g(0, '..11', '...1', '...1', '...1', '...1', '1..1', '.11.'),
  K: g(0, '1..1', '1..1', '1.1.', '11..', '1.1.', '1..1', '1..1'),
  L: g(0, '1...', '1...', '1...', '1...', '1...', '1...', '1111'),
  M: g(0, '1...1', '11.11', '1.1.1', '1.1.1', '1...1', '1...1', '1...1'),
  N: g(0, '1..1', '11.1', '11.1', '1.11', '1.11', '1..1', '1..1'),
  O: g(0, '.11.', '1..1', '1..1', '1..1', '1..1', '1..1', '.11.'),
  P: g(0, '111.', '1..1', '1..1', '111.', '1...', '1...', '1...'),
  Q: g(0, '.11.', '1..1', '1..1', '1..1', '1..1', '1.1.', '.1.1'),
  R: g(0, '111.', '1..1', '1..1', '111.', '1.1.', '1..1', '1..1'),
  S: g(0, '.111', '1...', '1...', '.11.', '...1', '...1', '111.'),
  T: g(0, '11111', '..1..', '..1..', '..1..', '..1..', '..1..', '..1..'),
  U: g(0, '1..1', '1..1', '1..1', '1..1', '1..1', '1..1', '.11.'),
  V: g(0, '1...1', '1...1', '1...1', '.1.1.', '.1.1.', '.1.1.', '..1..'),
  W: g(0, '1...1', '1...1', '1...1', '1.1.1', '1.1.1', '11.11', '1...1'),
  X: g(0, '1...1', '.1.1.', '.1.1.', '..1..', '.1.1.', '.1.1.', '1...1'),
  Y: g(0, '1...1', '.1.1.', '.1.1.', '..1..', '..1..', '..1..', '..1..'),
  Z: g(0, '1111', '...1', '..1.', '.1..', '.1..', '1...', '1111'),
  '0': g(0, '.11.', '1..1', '1..1', '1..1', '1..1', '1..1', '.11.'),
  '1': g(0, '.1.', '11.', '.1.', '.1.', '.1.', '.1.', '111'),
  '2': g(0, '.11.', '1..1', '...1', '..1.', '.1..', '1...', '1111'),
  '3': g(0, '111.', '...1', '...1', '.11.', '...1', '...1', '111.'),
  '4': g(0, '1..1', '1..1', '1..1', '1111', '...1', '...1', '...1'),
  '5': g(0, '1111', '1...', '111.', '...1', '...1', '1..1', '.11.'),
  '6': g(0, '.11.', '1...', '1...', '111.', '1..1', '1..1', '.11.'),
  '7': g(0, '1111', '...1', '..1.', '..1.', '.1..', '.1..', '.1..'),
  '8': g(0, '.11.', '1..1', '1..1', '.11.', '1..1', '1..1', '.11.'),
  '9': g(0, '.11.', '1..1', '1..1', '.111', '...1', '...1', '.11.'),
  '.': g(6, '1'),
  ',': g(6, '1', '1'),
  '!': g(0, '1', '1', '1', '1', '1', '.', '1'),
  '?': g(0, '.11.', '1..1', '...1', '..1.', '..1.', '....', '..1.'),
  ':': g(3, '1', '.', '.', '1'),
  ';': g(3, '1', '.', '.', '1', '1'),
  '-': g(4, '111'),
  '–': g(4, '1111'),
  '—': g(4, '11111'),
  '_': g(7, '1111'),
  "'": g(0, '1', '1'),
  '’': g(0, '1', '1'),
  '‘': g(0, '1', '1'),
  '"': g(0, '1.1', '1.1'),
  '“': g(0, '1.1', '1.1'),
  '”': g(0, '1.1', '1.1'),
  '(': g(0, '.1', '1.', '1.', '1.', '1.', '1.', '.1'),
  ')': g(0, '1.', '.1', '.1', '.1', '.1', '.1', '1.'),
  '/': g(0, '...1', '...1', '..1.', '..1.', '.1..', '1...', '1...'),
  '+': g(2, '.1.', '.1.', '111', '.1.', '.1.'),
  '=': g(3, '111', '...', '111'),
  '×': g(3, '1.1', '.1.', '1.1'),
  '%': g(0, '1..1', '...1', '..1.', '..1.', '.1..', '1...', '1..1'),
  '&': g(0, '.1..', '1.1.', '1.1.', '.1..', '1.11', '1..1', '.11.'),
  '#': g(1, '.1.1.', '11111', '.1.1.', '11111', '.1.1.'),
  '°': g(0, '11', '11'),
  '·': g(4, '1'),
  '→': g(3, '..1.', '1111', '..1.'),
  '←': g(3, '.1..', '1111', '.1..'),
  '<': g(2, '..1', '.1.', '1..', '.1.', '..1'),
  '>': g(2, '1..', '.1.', '..1', '.1.', '1..'),
  '…': g(6, '1.1.1'),
  ' ': g(6, '..'),
};
// macrons: the vowel with a bar over it
const MACRON: Record<string, string> = { 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u', 'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U' };

// ---------------------------------------------------------------- 3x5 capitals (fine print)
const TINY: Record<string, string[]> = {
  A: ['.1.', '1.1', '111', '1.1', '1.1'], B: ['11.', '1.1', '11.', '1.1', '11.'], C: ['.11', '1..', '1..', '1..', '.11'],
  D: ['11.', '1.1', '1.1', '1.1', '11.'], E: ['111', '1..', '11.', '1..', '111'], F: ['111', '1..', '11.', '1..', '1..'],
  G: ['.11', '1..', '1.1', '1.1', '.11'], H: ['1.1', '1.1', '111', '1.1', '1.1'], I: ['111', '.1.', '.1.', '.1.', '111'],
  J: ['..1', '..1', '..1', '1.1', '.1.'], K: ['1.1', '1.1', '11.', '1.1', '1.1'], L: ['1..', '1..', '1..', '1..', '111'],
  M: ['1...1', '11.11', '1.1.1', '1...1', '1...1'], N: ['1..1', '11.1', '1.11', '1..1', '1..1'], O: ['.1.', '1.1', '1.1', '1.1', '.1.'],
  P: ['11.', '1.1', '11.', '1..', '1..'], Q: ['.1.', '1.1', '1.1', '11.', '.11'], R: ['11.', '1.1', '11.', '1.1', '1.1'],
  S: ['.11', '1..', '.1.', '..1', '11.'], T: ['111', '.1.', '.1.', '.1.', '.1.'], U: ['1.1', '1.1', '1.1', '1.1', '111'],
  V: ['1.1', '1.1', '1.1', '1.1', '.1.'], W: ['1...1', '1...1', '1.1.1', '11.11', '1...1'], X: ['1.1', '1.1', '.1.', '1.1', '1.1'],
  Y: ['1.1', '1.1', '.1.', '.1.', '.1.'], Z: ['111', '..1', '.1.', '1..', '111'],
  '0': ['111', '1.1', '1.1', '1.1', '111'], '1': ['.1.', '11.', '.1.', '.1.', '111'], '2': ['11.', '..1', '.1.', '1..', '111'],
  '3': ['11.', '..1', '.1.', '..1', '11.'], '4': ['1.1', '1.1', '111', '..1', '..1'], '5': ['111', '1..', '11.', '..1', '11.'],
  '6': ['.11', '1..', '11.', '1.1', '.1.'], '7': ['111', '..1', '.1.', '.1.', '.1.'], '8': ['.1.', '1.1', '.1.', '1.1', '.1.'],
  '9': ['.1.', '1.1', '.11', '..1', '11.'], '.': ['.', '.', '.', '.', '1'], ',': ['.', '.', '.', '1', '1'], "'": ['1', '1', '.', '.', '.'],
  '’': ['1', '1', '.', '.', '.'], '!': ['1', '1', '1', '.', '1'], '?': ['11.', '..1', '.1.', '...', '.1.'], '-': ['...', '...', '111', '...', '...'],
  '–': ['...', '...', '111', '...', '...'], '—': ['....', '....', '1111', '....', '....'],
  ':': ['.', '1', '.', '1', '.'], '/': ['..1', '..1', '.1.', '1..', '1..'], '+': ['...', '.1.', '111', '.1.', '...'], '%': ['1.1', '..1', '.1.', '1..', '1.1'],
  '&': ['.1.', '1.1', '.11', '1.1', '.11'], '(': ['.1', '1.', '1.', '1.', '.1'], ')': ['1.', '.1', '.1', '.1', '1.'], '=': ['...', '111', '...', '111', '...'],
  '×': ['...', '1.1', '.1.', '1.1', '...'], '°': ['11', '11', '..', '..', '..'], '"': ['1.1', '1.1', '...', '...', '...'], '#': ['1.1', '111', '1.1', '111', '1.1'],
  '·': ['.', '.', '1', '.', '.'], '→': ['....', '..1.', '1111', '..1.', '....'], '<': ['..1', '.1.', '1..', '.1.', '..1'], '>': ['1..', '.1.', '..1', '.1.', '1..'],
  '“': ['1.1', '1.1', '...', '...', '...'], '”': ['1.1', '1.1', '...', '...', '...'], '…': ['.....', '.....', '.....', '.....', '1.1.1'],
  ' ': ['..', '..', '..', '..', '..'],
};
const PLAIN: Record<string, string> = { 'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U' };

export interface TextStyle {
  font?: FontId;
  color: C;
  /** second colour for a 1px drop shadow / emboss (down-right) */
  shadow?: C;
  /** stems doubled (caps titles, charcoal) */
  bold?: boolean;
  /** hand: slant in px per row from the baseline up (0.2 = italic) */
  slant?: number;
  /** hand: chance a letter sits 1px off the line */
  wander?: number;
  /** chance a pixel of a stroke is missed (pencil, worn stamps) */
  dropout?: number;
  /** chance of an extra smudge pixel beside a stroke (charcoal, grease) */
  smudge?: number;
  smudgeColor?: C;
  /** extra px between letters */
  spacing?: number;
  seed?: number;
}

const rnd = (a: number, b: number, s: number) => { let h = (a * 374761393 + b * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** a glyph as rows on the font's grid (top offset, rows) */
function glyph(ch: string, font: FontId): { y: number; r: string[]; bar?: boolean } {
  if (font === 'tiny') {
    const up = (PLAIN[ch] ?? ch).toUpperCase();
    const base = MACRON[up] ? MACRON[up].toUpperCase() : up;
    const r = TINY[base] ?? TINY[MACRON[ch]?.toUpperCase() ?? ''] ?? TINY['?'];
    return { y: 0, r, bar: !!MACRON[ch] || !!PLAIN[ch] };
  }
  if (font === 'caps') {
    const up = ch.toUpperCase();
    const m = MACRON[ch] ?? MACRON[up];
    const base = (m ?? up).toUpperCase();
    const gl = HAND[base] ?? HAND[ch] ?? HAND['?'];
    // caps are all cap-height: lowercase punctuation keeps its row
    return { y: gl.y, r: gl.r, bar: !!m };
  }
  const m = MACRON[ch];
  const gl = HAND[m ?? ch] ?? HAND[ch.toLowerCase()] ?? HAND['?'];
  return { y: gl.y, r: gl.r, bar: !!m };
}

/** line box height of a font */
export const lineH = (font: FontId = 'hand') => (font === 'tiny' ? 6 : font === 'caps' ? 9 : 10);
/** baseline row inside the line box */
const base = (font: FontId) => (font === 'tiny' ? 4 : 6);

function advance(ch: string, st: TextStyle): number {
  const f = st.font ?? 'hand';
  const gl = glyph(ch, f);
  return gl.r[0].length + (st.bold ? 1 : 0) + 1 + (st.spacing ?? 0);
}

/** width of one line of text in pixels */
export function textW(t: string, st: TextStyle): number {
  let w = 0;
  for (const ch of t) w += advance(ch, st);
  return Math.max(0, w - 1 - (st.spacing ?? 0));
}

/**
 * Paint one line; (x, y) is the top-left of the line box. Returns the width drawn. The hand font
 * leans (slant), wanders off the line and takes the ink's character (dropout, smudge).
 */
export function drawText(b: PixelBuffer, t: string, x: number, y: number, st: TextStyle): number {
  const f = st.font ?? 'hand';
  const seed = st.seed ?? 7;
  const slant = f === 'hand' ? st.slant ?? 0.18 : st.slant ?? 0;
  let cx = Math.round(x);
  let i = 0;
  const bl = base(f);
  const plot = (px: number, py: number, k: number) => {
    if (st.dropout && rnd(px, py, seed + 3) < st.dropout) return;
    if (st.shadow !== undefined) b.set(px + 1, py + 1, st.shadow);
    b.set(px, py, st.color);
    if (st.smudge && rnd(px, py, seed + 5) < st.smudge) b.set(px + (rnd(px, py, seed) < 0.5 ? 1 : 0), py + 1, st.smudgeColor ?? st.color);
    void k;
  };
  for (const ch of t) {
    const gl = glyph(ch, f);
    const w = gl.r[0].length;
    const dy = f === 'hand' && st.wander && rnd(i, cx, seed) < st.wander ? (rnd(i, seed, 2) < 0.5 ? -1 : 1) : 0;
    for (let r = 0; r < gl.r.length; r++) {
      const row = gl.y + r;
      const sh = slant ? Math.round((bl - row) * slant) : 0;
      const line = gl.r[r];
      for (let k = 0; k < w; k++) if (line[k] === '1') {
        const px = cx + k + sh, py = Math.round(y) + row + dy;
        plot(px, py, k);
        if (st.bold) plot(px + 1, py, k);
      }
    }
    if (gl.bar) {
      const ry = f === 'tiny' ? -2 : gl.y >= 2 ? 0 : -2;
      const sh = slant ? Math.round((bl - ry) * slant) : 0;
      for (let k = 0; k < w + (st.bold ? 1 : 0); k++) plot(cx + k + sh, Math.round(y) + ry + dy, k);
    }
    cx += w + (st.bold ? 1 : 0) + 1 + (st.spacing ?? 0);
    i++;
  }
  return cx - Math.round(x) - 1;
}

/** break text into lines no wider than w (words longer than a line are cut) */
export function wrapText(t: string, w: number, st: TextStyle): string[] {
  const out: string[] = [];
  for (const para of t.split('\n')) {
    const words = para.split(/ +/);
    let line = '';
    for (const word of words) {
      const tryL = line ? line + ' ' + word : word;
      if (textW(tryL, st) <= w) { line = tryL; continue; }
      if (line) out.push(line);
      if (textW(word, st) <= w) { line = word; continue; }
      // a long word: cut it
      let cut = '';
      for (const ch of word) { if (textW(cut + ch, st) > w && cut) { out.push(cut); cut = ''; } cut += ch; }
      line = cut;
    }
    out.push(line);
  }
  return out;
}

/** paint wrapped text; returns the height used. align: 'left' | 'center' | 'right' within w */
export function drawPara(b: PixelBuffer, t: string, x: number, y: number, w: number, st: TextStyle, o: { lh?: number; align?: 'left' | 'center' | 'right'; maxLines?: number } = {}): number {
  const lh = o.lh ?? lineH(st.font ?? 'hand');
  let lines = wrapText(t, w, st);
  if (o.maxLines && lines.length > o.maxLines) { lines = lines.slice(0, o.maxLines); lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '…'); }
  lines.forEach((l, i) => {
    const lw = textW(l, st);
    const lx = o.align === 'center' ? x + Math.floor((w - lw) / 2) : o.align === 'right' ? x + w - lw : x;
    drawText(b, l, lx, y + i * lh, { ...st, seed: (st.seed ?? 7) + i * 13 });
  });
  return lines.length * lh;
}

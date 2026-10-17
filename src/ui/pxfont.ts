// Bitmap pixel fonts drawn in code, for UI text that lives inside pixel-art stages (the Backpack, the
// cooking close-up, the recipe notebook, tags, stamps). Text is rendered at art resolution (1 canvas
// pixel per art pixel) with hard pixels only, so it scales by whole pixels with the art around it.
//
//  - 'body'   proportional 6px caps, 4px x-height, 2px descenders (notes, facts, captions)
//  - 'bold'   the same, one pixel heavier (headings, button labels)
//  - 'tiny'   3x5 caps (stamps, small labels)
//  - 'script' Mori's marker hand: an 8px slanted print-script with heavy downstrokes and a little
//             bounce in the baseline (item names on tags, titles, notes in the recipe book)
//
// API: pxMeasure / pxWrap for layout, pxDraw onto a PixelBuffer, pxTextBuf / pxTextCanvas for a ready
// sprite (wrapping, alignment, colours per run, outline and drop shadow).

import { PixelBuffer } from '../art/pixel';
import { hex } from '../art/color';
import type { C } from '../art/color';

export type PxFontId = 'body' | 'bold' | 'tiny' | 'script';

interface Glyph { w: number; top: number; rows: string[] }
interface Font {
  /** rows above the baseline (cap height) */
  cap: number;
  /** rows below the baseline used by descenders */
  desc: number;
  /** default line advance */
  lineH: number;
  /** gap between letters */
  gap: number;
  /** a space's advance */
  space: number;
  glyphs: Record<string, Glyph>;
  /** one heavier: OR the glyph with itself shifted right */
  bold?: boolean;
  /** italic shear + heavy downstrokes + baseline bounce (the marker hand) */
  script?: boolean;
  /** uppercase only */
  caps?: boolean;
}

/** parse 'top:row|row|row' into a glyph */
function g(def: string): Glyph {
  const i = def.indexOf(':');
  const top = i > 0 ? +def.slice(0, i) : 0;
  const rows = (i > 0 ? def.slice(i + 1) : def).split('|');
  return { w: Math.max(...rows.map(r => r.length)), top, rows };
}
function table(src: Record<string, string>): Record<string, Glyph> {
  const out: Record<string, Glyph> = {};
  for (const k of Object.keys(src)) out[k] = g(src[k]);
  return out;
}

// ---------------------------------------------------------------- body (cap 6, x-height 4)
const BODY_SRC: Record<string, string> = {
  A: '.##.|#..#|#..#|####|#..#|#..#', B: '###.|#..#|###.|#..#|#..#|###.', C: '.###|#...|#...|#...|#...|.###',
  D: '###.|#..#|#..#|#..#|#..#|###.', E: '####|#...|###.|#...|#...|####', F: '####|#...|###.|#...|#...|#...',
  G: '.###|#...|#...|#.##|#..#|.###', H: '#..#|#..#|####|#..#|#..#|#..#', I: '###|.#.|.#.|.#.|.#.|###',
  J: '..##|...#|...#|...#|#..#|.##.', K: '#..#|#.#.|##..|#.#.|#..#|#..#', L: '#...|#...|#...|#...|#...|####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#', N: '#..#|##.#|#.##|#..#|#..#|#..#', O: '.##.|#..#|#..#|#..#|#..#|.##.',
  P: '###.|#..#|#..#|###.|#...|#...', Q: '.##.|#..#|#..#|#..#|#.#.|.#.#', R: '###.|#..#|#..#|###.|#.#.|#..#',
  S: '.###|#...|.##.|...#|...#|###.', T: '#####|..#..|..#..|..#..|..#..|..#..', U: '#..#|#..#|#..#|#..#|#..#|.##.',
  V: '#...#|#...#|#...#|.#.#.|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|##.##|#...#', X: '#...#|.#.#.|..#..|..#..|.#.#.|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..', Z: '####|...#|..#.|.#..|#...|####',
  a: '2:.###|#..#|#..#|.###', b: '#...|#...|###.|#..#|#..#|###.', c: '2:.###|#...|#...|.###', d: '...#|...#|.###|#..#|#..#|.###',
  e: '2:.##.|####|#...|.###', f: '.##|#..|###|#..|#..|#..', g: '2:.###|#..#|#..#|.###|...#|.##.', h: '#...|#...|###.|#..#|#..#|#..#',
  i: '#|.|#|#|#|#', j: '.#|..|.#|.#|.#|.#|.#|#.', k: '#..|#..|#.#|##.|#.#|#.#', l: '#.|#.|#.|#.|#.|.#',
  m: '2:####.|#.#.#|#.#.#|#.#.#', n: '2:###.|#..#|#..#|#..#', o: '2:.##.|#..#|#..#|.##.', p: '2:###.|#..#|#..#|###.|#...|#...',
  q: '2:.###|#..#|#..#|.###|...#|...#', r: '2:#.##|##..|#...|#...', s: '2:.###|##..|..##|###.', t: '1:.#.|###|.#.|.#.|..#',
  u: '2:#..#|#..#|#..#|.###', v: '2:#.#|#.#|#.#|.#.', w: '2:#...#|#.#.#|#.#.#|.#.#.', x: '2:#..#|.##.|.##.|#..#',
  y: '2:#..#|#..#|#..#|.###|...#|.##.', z: '2:####|..#.|.#..|####', 'ı': '2:#|#|#|#',
  '0': '.##.|#..#|#.##|##.#|#..#|.##.', '1': '.#.|##.|.#.|.#.|.#.|###', '2': '.##.|#..#|...#|..#.|.#..|####',
  '3': '###.|...#|.##.|...#|...#|###.', '4': '..##|.#.#|#..#|####|...#|...#', '5': '####|#...|###.|...#|...#|###.',
  '6': '.##.|#...|###.|#..#|#..#|.##.', '7': '####|...#|..#.|..#.|.#..|.#..', '8': '.##.|#..#|.##.|#..#|#..#|.##.',
  '9': '.##.|#..#|#..#|.###|...#|.##.',
  '.': '5:#', ',': '5:.#|#.', ':': '2:#|.|.|#', ';': '2:.#|..|..|.#|#.', '!': '#|#|#|#|.|#', '?': '.##.|#..#|..#.|.#..|....|.#..',
  "'": '#|#', '"': '#.#|#.#', '-': '3:###', '–': '3:####', '—': '3:######', '_': '6:####',
  '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.', '[': '##|#.|#.|#.|#.|#.|##', ']': '##|.#|.#|.#|.#|.#|##',
  '/': '...#|..#.|..#.|.#..|.#..|#...', '+': '2:.#.|###|.#.', '=': '2:###|...|###', '×': '2:#.#|.#.|#.#', '*': '1:#.#|.#.|#.#',
  '%': '#..#|...#|..#.|.#..|#...|#..#', '&': '.#..|#.#.|.#..|#.##|#..#|.##.', '#': '1:.#.#.|#####|.#.#.|#####|.#.#.',
  '°': '###|#.#|###', '·': '3:#', '•': '2:##|##', '…': '5:#.#.#', '<': '1:..#|.#.|#..|.#.|..#', '>': '1:#..|.#.|..#|.#.|#..',
  '♥': '1:.#.#.|#####|#####|.###.|..#..', '★': '..#..|..#..|#####|.###.|.#.#.|#...#', '✓': '1:....#|...#.|#.#..|.#...',
  '→': '1:..#.|####|..#.', '←': '1:.#..|####|.#..', '↑': '.#.|###|.#.|.#.|.#.|.#.', '↓': '.#.|.#.|.#.|.#.|###|.#.',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.', '$': '.#.|.##|#..|.#.|..#|##.|.#.', '^': '.#.|#.#', '~': '2:.#.#|#.#.',
  '½': '#...|#..#|#.#.|.#..|#.##|..#.|..##',
};
// ---------------------------------------------------------------- tiny (3x5 caps)
const TINY_SRC: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.', E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#', I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###', M: '#...#|##.##|#.#.#|#...#|#...#', N: '#..#|##.#|#.##|#..#|#..#',
  O: '.#.|#.#|#.#|#.#|.#.', P: '##.|#.#|##.|#..|#..', Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.', U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#...#|#...#|#.#.#|##.##|#...#', X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.', Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '##.|..#|.#.|#..|###', '3': '##.|..#|.#.|..#|##.', '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.', '6': '.##|#..|##.|#.#|.#.', '7': '###|..#|.#.|.#.|.#.', '8': '.#.|#.#|.#.|#.#|.#.', '9': '.#.|#.#|.##|..#|##.',
  '.': '4:#', ',': '4:#|#', ':': '1:#|.|#', '!': '#|#|#|.|#', '?': '##.|..#|.#.|...|.#.', "'": '#|#', '-': '2:###', '+': '1:.#.|###|.#.',
  '/': '..#|..#|.#.|#..|#..', '%': '#.#|..#|.#.|#..|#.#', '&': '.#.|#.#|.##|#.#|.##', '·': '2:#', '×': '1:#.#|.#.|#.#', '°': '###|#.#|###',
  '♥': '.#.#.|#####|#####|.###.|..#..', '★': '..#..|#####|.###.|.#.#.|#...#', '✓': '1:...#|#.#.|.#..', '(': '.#|#.|#.|#.|.#', ')': '#.|.#|.#|.#|#.',
  '→': '1:..#.|####|..#.', '<': '..#|.#.|#..|.#.|..#', '>': '#..|.#.|..#|.#.|#..', '=': '1:###|...|###', '#': '.#.#.|#####|.#.#.|#####|.#.#.',
};
// ---------------------------------------------------------------- script (cap 8, x-height 5): skeletons
// drawn upright and 1px wide; drawing slants them and adds the heavy side of each downstroke
const SCRIPT_SRC: Record<string, string> = {
  a: '3:.##.#|#..##|#...#|#..##|.##.#', b: '#...|#...|#...|#.#.|##.#|#..#|#..#|###.', c: '3:.###|#...|#...|#...|.###',
  d: '....#|....#|....#|.##.#|#..##|#...#|#..##|.##.#', e: '3:.##.|#..#|###.|#...|.###',
  f: '..##|.#..|.#..|####|.#..|.#..|.#..|.#..|.#..|#...', g: '3:.##.#|#..##|#...#|#..##|.##.#|....#|#..#.|.##..',
  h: '#...|#...|#...|#.#.|##.#|#..#|#..#|#..#', i: '1:#|.|#|#|#|#|#', j: '1:..#|...|..#|..#|..#|..#|..#|..#|#.#|.#.',
  k: '#...|#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '#.|#.|#.|#.|#.|#.|#.|.#', m: '3:#.#..#.|##.##.#|#..#..#|#..#..#|#..#..#',
  n: '3:#.#.|##.#|#..#|#..#|#..#', o: '3:.##.|#..#|#..#|#..#|.##.', p: '3:#.#.|##.#|#..#|#..#|###.|#...|#...|#...',
  q: '3:.##.#|#..##|#...#|#..##|.##.#|....#|....#|....#', r: '3:#.##|##..|#...|#...|#...', s: '3:.###|#...|.##.|...#|###.',
  t: '1:.#..|.#..|####|.#..|.#..|.#..|..##', u: '3:#..#|#..#|#..#|#.##|.#.#', v: '3:#...#|#...#|.#.#.|.#.#.|..#..',
  w: '3:#.....#|#.....#|#..#..#|#..#..#|.##.##.', x: '3:#...#|.#.#.|..#..|.#.#.|#...#', y: '3:#..#|#..#|#..#|#.##|.#.#|...#|#..#|.##.',
  z: '3:####|...#|..#.|.#..|####', 'ı': '3:#|#|#|#|#',
  A: '..#..|.#.#.|.#.#.|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#....|#...#|.###.', D: '###..|#..#.|#...#|#...#|#...#|#...#|#..#.|###..',
  E: '#####|#....|#....|####.|#....|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....|#....',
  G: '.###.|#...#|#....|#....|#..##|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|.#.|###', J: '..###|....#|....#|....#|....#|#...#|#...#|.###.',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#|#...#', L: '#....|#....|#....|#....|#....|#....|#....|#####',
  M: '#.....#|##...##|#.#.#.#|#..#..#|#.....#|#.....#|#.....#|#.....#', N: '#...#|##..#|##..#|#.#.#|#.#.#|#..##|#..##|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#|#...#',
  S: '.###.|#...#|#....|.###.|....#|....#|#...#|.###.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|.#.#.|.#.#.|.#.#.|..#..',
  W: '#.....#|#.....#|#.....#|#..#..#|#..#..#|#.#.#.#|##...##|#.....#', X: '#...#|#...#|.#.#.|..#..|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|#.#..|..#..|..#..|..#..|..#..|#####',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#....|#####', '3': '####.|....#|....#|.###.|....#|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.|...#.', '5': '#####|#....|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|#...#|.###.', '7': '#####|....#|...#.|...#.|..#..|..#..|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|#...#|.###.', '9': '.###.|#...#|#...#|#...#|.####|....#|....#|.###.',
  '.': '7:#', ',': '7:#|#', '!': '#|#|#|#|#|.|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|.....|..#..', "'": '#|#',
  '"': '#.#|#.#', '-': '5:###', '–': '5:####', '—': '5:#####', ':': '4:#|.|.|#', ';': '4:.#|..|..|.#|#.', '·': '5:#',
  '(': '..#|.#.|#..|#..|#..|#..|#..|.#.|..#', ')': '#..|.#.|..#|..#|..#|..#|..#|.#.|#..', '/': '....#|...#.|...#.|..#..|..#..|.#...|.#...|#....',
  '&': '.##..|#..#.|#..#.|.##..|#.#.#|#..#.|#..##|.##.#', '+': '3:..#..|..#..|#####|..#..|..#..', '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  '…': '7:#.#.#', '×': '4:#.#|.#.|#.#', '♥': '2:.##.##.|#######|#######|.#####.|..###..|...#...', '★': '..#..|..#..|#####|.###.|.#.#.|#...#',
  '→': '4:...#.|#####|...#.',
};

const FONTS: Record<PxFontId, Font> = {
  body: { cap: 6, desc: 2, lineH: 10, gap: 1, space: 3, glyphs: table(BODY_SRC) },
  bold: { cap: 6, desc: 2, lineH: 10, gap: 1, space: 3, glyphs: table(BODY_SRC), bold: true },
  tiny: { cap: 5, desc: 1, lineH: 7, gap: 1, space: 2, glyphs: table(TINY_SRC), caps: true },
  script: { cap: 8, desc: 3, lineH: 13, gap: 1, space: 4, glyphs: table(SCRIPT_SRC), script: true },
};

// letters with marks: drawn as the base letter plus a mark
const MARKS: Record<string, [string, 'macron' | 'acute' | 'grave' | 'uml' | 'circ' | 'tilde' | 'ced']> = {
  ā: ['a', 'macron'], ē: ['e', 'macron'], ī: ['ı', 'macron'], ō: ['o', 'macron'], ū: ['u', 'macron'],
  Ā: ['A', 'macron'], Ē: ['E', 'macron'], Ī: ['I', 'macron'], Ō: ['O', 'macron'], Ū: ['U', 'macron'],
  é: ['e', 'acute'], è: ['e', 'grave'], ê: ['e', 'circ'], ë: ['e', 'uml'], á: ['a', 'acute'], à: ['a', 'grave'], â: ['a', 'circ'], ä: ['a', 'uml'],
  í: ['i', 'acute'], ó: ['o', 'acute'], ö: ['o', 'uml'], ô: ['o', 'circ'], ú: ['u', 'acute'], ü: ['u', 'uml'], ñ: ['n', 'tilde'], ç: ['c', 'ced'],
  É: ['E', 'acute'], Ö: ['O', 'uml'], Ü: ['U', 'uml'],
};
const ALIAS: Record<string, string> = { '‘': "'", '’': "'", '`': "'", '“': '"', '”': '"', '−': '-', '‑': '-', ' ': ' ', ' ': ' ', '｜': '|', '|': '/', '☆': '★', '✔': '✓', '❤': '♥', '–': '–' };

function glyphOf(f: Font, ch: string): { gl: Glyph; mark?: string } | null {
  if (ch === ' ') return null;
  const a = ALIAS[ch] ?? ch;
  let c = f.caps ? a.toUpperCase() : a;
  let mark: string | undefined;
  if (!f.glyphs[c] && MARKS[c]) { mark = MARKS[c][1]; c = f.caps ? MARKS[c][0].toUpperCase() : MARKS[c][0]; }
  let gl = f.glyphs[c];
  // a font without lowercase (or a missing letter) borrows the other case
  if (!gl) gl = f.glyphs[c.toUpperCase()] ?? f.glyphs[c.toLowerCase()];
  if (!gl) gl = f.glyphs['?'];
  return gl ? { gl, mark } : null;
}

const SHEAR = (row: number, f: Font) => (f.script ? Math.floor((f.cap - 1 - row + 2) / 4) : 0);

/** advance of one character */
function adv(f: Font, ch: string): number {
  if (ch === ' ' || ch === ' ') return f.space + f.gap;
  const q = glyphOf(f, ch);
  if (!q) return f.space + f.gap;
  return q.gl.w + f.gap + (f.bold ? 1 : 0) + (f.script ? 1 : 0);
}

/** width in art pixels of a single line */
export function pxMeasure(text: string, font: PxFontId = 'body', spacing = 0): number {
  const f = FONTS[font];
  let w = 0;
  for (const ch of text) w += adv(f, ch) + spacing;
  return Math.max(0, w - f.gap - spacing + (f.script ? 2 : 0));
}

export const pxLineH = (font: PxFontId = 'body') => FONTS[font].lineH;
export const pxCap = (font: PxFontId = 'body') => FONTS[font].cap;

/** a run of text in one colour / font (for mixed text on one card) */
export interface PxRun { text: string; color?: string | C; font?: PxFontId }

/** word-wrap runs into lines no wider than maxW (hard breaks on \n) */
export function pxWrapRuns(runs: PxRun[], maxW: number, base: PxFontId = 'body'): PxRun[][] {
  const lines: PxRun[][] = [[]];
  let lineW = 0;
  const push = (r: PxRun) => {
    const L = lines[lines.length - 1];
    const last = L[L.length - 1];
    if (last && last.color === r.color && (last.font ?? base) === (r.font ?? base)) last.text += r.text;
    else L.push({ ...r });
  };
  for (const r of runs) {
    const font = r.font ?? base;
    const parts = r.text.split(/(\n| )/);
    for (const p of parts) {
      if (p === '') continue;
      if (p === '\n') { lines.push([]); lineW = 0; continue; }
      if (p === ' ') {
        if (lineW > 0) { push({ ...r, text: ' ' }); lineW += adv(FONTS[font], ' '); }
        continue;
      }
      const w = pxMeasure(p, font);
      if (lineW > 0 && lineW + w > maxW) {
        // drop the trailing space and break
        const L = lines[lines.length - 1];
        const last = L[L.length - 1];
        if (last) last.text = last.text.replace(/ +$/, '');
        lines.push([]); lineW = 0;
      }
      if (w > maxW && p.length > 1) {
        // a word too long for any line: split it where it must
        let cur = '';
        for (const ch of p) {
          if (pxMeasure(cur + ch, font) > maxW && cur) { push({ ...r, text: cur }); lines.push([]); lineW = 0; cur = ''; }
          cur += ch;
        }
        if (cur) { push({ ...r, text: cur }); lineW = pxMeasure(cur, font) + FONTS[font].gap; }
        continue;
      }
      push({ ...r, text: p });
      lineW += w + FONTS[font].gap;
    }
  }
  return lines.map(L => L.filter(r => r.text.length));
}
export function pxWrap(text: string, maxW: number, font: PxFontId = 'body'): string[] {
  return pxWrapRuns([{ text }], maxW, font).map(L => L.map(r => r.text).join(''));
}
const runsW = (L: PxRun[], base: PxFontId) => {
  let w = 0;
  for (const r of L) w += pxMeasure(r.text, r.font ?? base) + FONTS[r.font ?? base].gap;
  return Math.max(0, w - (L.length ? FONTS[L[L.length - 1].font ?? base].gap : 0));
};

const col = (c: string | C | undefined, d: C): C => (c === undefined ? d : typeof c === 'number' ? c : hex(c));
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

/** draw one line of text with its top (cap line) at y; returns the width drawn */
export function pxDraw(b: PixelBuffer, text: string, x: number, y: number, o: { font?: PxFontId; color?: string | C; seed?: number; bounce?: boolean; spacing?: number } = {}): number {
  const f = FONTS[o.font ?? 'body'];
  const c = col(o.color, hex('#2a2414'));
  let cx = Math.round(x);
  const y0 = Math.round(y);
  let i = 0;
  const seed = o.seed ?? 7;
  for (const ch of text) {
    const q = glyphOf(f, ch);
    if (!q) { cx += adv(f, ch) + (o.spacing ?? 0); i++; continue; }
    const { gl, mark } = q;
    // the marker hand bounces a little off its baseline
    const dy = f.script && o.bounce !== false && /[a-z]/.test(ch) && hash(seed + i * 31, ch.charCodeAt(0)) > 0.78 ? -1 : 0;
    const plot = (px: number, py: number) => {
      const sx = SHEAR(py, f);
      b.set(cx + px + sx, y0 + py + dy, c);
      if (f.bold) b.set(cx + px + sx + 1, y0 + py + dy, c);
    };
    gl.rows.forEach((row, r) => { for (let k = 0; k < row.length; k++) if (row[k] === '#') plot(k, gl.top + r); });
    if (mark) {
      const w = gl.w, top = gl.top - (gl.top >= 2 ? 2 : 2);
      const mx = Math.floor(w / 2);
      if (mark === 'macron') for (let k = 0; k < w; k++) plot(k, top);
      else if (mark === 'acute') { plot(mx, top); plot(mx + 1, top - 1); }
      else if (mark === 'grave') { plot(mx, top); plot(mx - 1, top - 1); }
      else if (mark === 'uml') { plot(Math.max(0, mx - 1), top); plot(Math.min(w - 1, mx + 1), top); }
      else if (mark === 'circ') { plot(mx - 1, top); plot(mx, top - 1); plot(mx + 1, top); }
      else if (mark === 'tilde') { plot(0, top); plot(1, top - 1); plot(2, top); plot(3, top - 1); }
      else if (mark === 'ced') { plot(mx, gl.top + gl.rows.length); }
    }
    cx += adv(f, ch) + (o.spacing ?? 0);
    i++;
  }
  return cx - Math.round(x);
}

export interface PxTextOpts {
  font?: PxFontId;
  color?: string | C;
  /** the heavy side of the marker's downstrokes (script); defaults to the ink colour */
  bleed?: string | C;
  /** a 1px ring round the letters */
  outline?: string | C | null;
  /** a 1px drop shadow (down-right) */
  shadow?: string | C | null;
  /** wrap at this width (art px) */
  maxW?: number;
  /** at most this many lines (the last is cut with an ellipsis) */
  maxLines?: number;
  lineH?: number;
  align?: 'left' | 'center' | 'right';
  /** extra letter spacing */
  spacing?: number;
  /** baseline bounce of the script */
  bounce?: boolean;
  /** pad round the text (art px) */
  pad?: number;
}

/** text (or coloured runs) as a pixel buffer */
export function pxTextBuf(text: string | PxRun[], o: PxTextOpts = {}): PixelBuffer {
  const base = o.font ?? 'body';
  const f = FONTS[base];
  const runs: PxRun[] = typeof text === 'string' ? [{ text }] : text;
  let lines = o.maxW ? pxWrapRuns(runs, o.maxW - (f.script ? 3 : 0), base) : [runs.map(r => ({ ...r }))].map(L => L);
  if (!o.maxW) {
    // honour hard breaks without wrapping
    const all: PxRun[][] = [[]];
    for (const r of runs) r.text.split('\n').forEach((t, i) => { if (i) all.push([]); if (t) all[all.length - 1].push({ ...r, text: t }); });
    lines = all;
  }
  if (o.maxLines && lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines);
    const L = lines[lines.length - 1];
    const last = L[L.length - 1];
    if (last) {
      while (last.text.length > 1 && runsW(L, base) + pxMeasure('…', last.font ?? base) > (o.maxW ?? 9999)) last.text = last.text.slice(0, -1);
      last.text = last.text.replace(/[ ,.;:]+$/, '') + '…';
    }
  }
  const lh = o.lineH ?? f.lineH;
  const ring = o.outline ? 1 : 0, sh = o.shadow ? 1 : 0;
  const pad = (o.pad ?? 0) + ring;
  const markTop = 2;
  const widths = lines.map(L => runsW(L, base));
  const W = Math.max(1, Math.max(0, ...widths) + (f.script ? 3 : 0)) + pad * 2 + sh;
  const Hh = Math.max(1, (lines.length - 1) * lh + f.cap + f.desc + markTop) + pad * 2 + sh;
  const ink = new PixelBuffer(W, Hh);
  const ink0 = col(o.color, hex('#2a2414'));
  lines.forEach((L, li) => {
    const lw = widths[li];
    let x = pad + (o.align === 'center' ? Math.floor((W - pad * 2 - sh - lw - (f.script ? 3 : 0)) / 2) : o.align === 'right' ? W - pad - sh - lw - (f.script ? 3 : 0) : 0);
    const y = pad + markTop + li * lh;
    for (const r of L) {
      x += pxDraw(ink, r.text, x, y, { font: r.font ?? base, color: col(r.color, ink0), seed: li * 97 + x, bounce: o.bounce, spacing: o.spacing });
      x += 0;
    }
  });
  // the marker's heavy downstrokes: thicken to the right where that doesn't close a counter
  if (f.script) {
    const bl = o.bleed !== undefined ? col(o.bleed, ink0) : null;
    const src = ink.clone();
    for (let y = 0; y < Hh; y++) for (let x = W - 1; x >= 0; x--) {
      const c = src.get(x, y);
      if (!c) continue;
      if (!src.get(x + 1, y) && !src.get(x + 2, y)) ink.set(x + 1, y, bl ?? c);
    }
  }
  if (!ring && !sh) return ink;
  const out = new PixelBuffer(W, Hh);
  const oc = o.outline ? col(o.outline, 0) : 0, sc = o.shadow ? col(o.shadow, 0) : 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (!ink.get(x, y)) continue;
    if (sh) { out.set(x + 1, y + 1, sc); if (ring) { out.set(x + 2, y + 1, sc); out.set(x + 1, y + 2, sc); } }
  }
  if (ring) for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (!ink.get(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) out.set(x + dx, y + dy, oc);
  }
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const c = ink.get(x, y); if (c) out.set(x, y, c); }
  return out;
}

/** text as a canvas, 1 canvas pixel per art pixel, sized in CSS px to match (put it in a scaled stage,
 *  or pass scale for whole-pixel enlargement) */
export function pxTextCanvas(text: string | PxRun[], o: PxTextOpts & { scale?: number; cls?: string } = {}): HTMLCanvasElement {
  const b = pxTextBuf(text, o);
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  c.className = 'pxt' + (o.cls ? ' ' + o.cls : '');
  c.getContext('2d', { willReadFrequently: true })?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  const k = o.scale ?? 1;
  c.style.width = b.w * k + 'px'; c.style.height = b.h * k + 'px';
  c.style.imageRendering = 'pixelated';
  return c;
}

/** text as a data URL (for CSS backgrounds / <img>) at a whole-pixel scale */
export function pxTextURL(text: string | PxRun[], o: PxTextOpts & { scale?: number } = {}): string {
  const b = pxTextBuf(text, o);
  return b.toDataURL(o.scale ?? 1);
}

/** parse the little markup used on cards (<b>…</b>, <i>…</i>, <br>) into runs */
export function pxRunsFromHTML(html: string, colors: { b?: string; i?: string; base?: string } = {}): PxRun[] {
  const out: PxRun[] = [];
  const re = /<(\/?)(b|i|br)\s*\/?>/g;
  let last = 0, cur: 'base' | 'b' | 'i' = 'base';
  const dec = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const push = (t: string) => { if (t) out.push({ text: dec(t), color: cur === 'b' ? colors.b : cur === 'i' ? colors.i : colors.base }); };
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    push(html.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[2] === 'br') out.push({ text: '\n', color: colors.base });
    else cur = m[1] ? 'base' : (m[2] as 'b' | 'i');
  }
  push(html.slice(last));
  return out;
}

// ---------------------------------------------------------------- big words from the web pixel fonts
// Jersey 15 and Silkscreen sit exactly on the pixel grid at their native sizes (Jersey 15 at 27px:
// 15px caps; Silkscreen at 8px steps: 5px caps per 8px), so rasterised there and thresholded they are
// true pixel glyphs. Used for splash words (PERFECT!, CAUGHT!) inside pixel stages. Without the web
// font (offline) the bold bitmap face stands in at 2x.

export type PxBigFace = 'jersey' | 'silk' | 'silk2';
const BIG: Record<PxBigFace, { css: string; asc: number; h: number }> = {
  jersey: { css: "27px 'Jersey 15'", asc: 21, h: 28 },
  silk: { css: "16px 'Silkscreen'", asc: 12, h: 16 },
  silk2: { css: "700 16px 'Silkscreen'", asc: 12, h: 16 },
};
export interface PxBigOpts {
  face?: PxBigFace;
  color?: string;
  /** 1px ring */
  outline?: string | null;
  /** an extruded shadow this many pixels down-right */
  depth?: number;
  depthColor?: string;
  /** letter spacing in px */
  spacing?: number;
}
export function bigFontReady(face: PxBigFace = 'jersey'): boolean {
  try {
    const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fs) return false;
    const fam = face === 'jersey' ? 'Jersey 15' : 'Silkscreen';
    let found = false;
    fs.forEach(ff => { if (ff.family.replace(/["']/g, '') === fam && ff.status === 'loaded') found = true; });
    return found;
  } catch { return false; }
}
/** ask for the web pixel fonts early (so a splash word has them when it is needed) */
export function warmBigFonts() {
  try { const fs = (document as Document & { fonts?: FontFaceSet }).fonts; for (const k of Object.keys(BIG) as PxBigFace[]) void fs?.load(BIG[k].css); } catch { /* */ }
}
/** a splash word as a pixel buffer (1 px per art px) */
export function pxBigBuf(text: string, o: PxBigOpts = {}): PixelBuffer {
  const face = o.face ?? 'jersey';
  const f = BIG[face];
  const ink = col(o.color, hex('#fff7d8'));
  let mask: PixelBuffer;
  if (bigFontReady(face)) {
    const m = document.createElement('canvas').getContext('2d')!;
    m.font = f.css;
    const sp = o.spacing ?? 0;
    const chars = [...text];
    const widths = chars.map(ch => Math.round(m.measureText(ch).width));
    const W = widths.reduce((a, b) => a + b + sp, 0) + 4, Hh = f.h + 4;
    const c = document.createElement('canvas');
    c.width = W; c.height = Hh;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.font = f.css; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    let x = 2;
    chars.forEach((ch, i) => { g.fillText(ch, x, 2 + f.asc); x += widths[i] + sp; });
    const d = g.getImageData(0, 0, W, Hh).data;
    mask = new PixelBuffer(W, Hh);
    for (let i = 0; i < W * Hh; i++) if (d[i * 4 + 3] > 127) mask.data[i] = ink;
  } else {
    // the bold bitmap face, doubled
    const t = pxTextBuf(text, { font: 'bold', color: ink, spacing: o.spacing ? 1 : 0 });
    mask = new PixelBuffer(t.w * 2 + 4, t.h * 2 + 4);
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { const c = t.data[y * t.w + x]; if (c) mask.rect(2 + x * 2, y * 2, 2, 2, c); }
  }
  const dep = o.depth ?? 0, ring = o.outline ? 1 : 0;
  const out = new PixelBuffer(mask.w + dep + ring * 2, mask.h + dep + ring * 2);
  const oc = o.outline ? hex(o.outline) : 0, dc = hex(o.depthColor ?? o.outline ?? '#000000');
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < mask.w && y < mask.h && mask.data[y * mask.w + x] !== 0;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  // the extruded shadow (of the outlined shape), then the ring, then the letters
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
    if (!on(x, y)) continue;
    for (let k = dep; k >= 1; k--) {
      out.set(x + ring + k, y + ring + k, dc);
      if (ring) for (const [dx, dy] of N8) out.set(x + ring + dx + k, y + ring + dy + k, dc);
    }
  }
  if (ring) for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (on(x, y)) for (const [dx, dy] of N8) out.set(x + ring + dx, y + ring + dy, oc);
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (on(x, y)) out.set(x + ring, y + ring, mask.data[y * mask.w + x]);
  return out;
}
export function pxBigCanvas(text: string, o: PxBigOpts & { scale?: number; cls?: string } = {}): HTMLCanvasElement {
  const b = pxBigBuf(text, o);
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  if (o.cls) c.className = o.cls;
  c.getContext('2d', { willReadFrequently: true })?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  const k = o.scale ?? 1;
  c.style.width = b.w * k + 'px'; c.style.height = b.h * k + 'px';
  c.style.imageRendering = 'pixelated';
  return c;
}

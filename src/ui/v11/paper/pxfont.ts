// Physical UI kit: Mori's handwriting as a pixel font, drawn in code.
//
// One set of bitmap glyphs (a casual print hand, 1 px strokes, 5 px x-height, 7 px caps, 2 px
// descenders, exit tails on the lowercase so words read as joined-up writing) makes two faces:
//   'hand'   the glyphs sheared into a slant (1 px per 3 rows): Mori's pencil handwriting
//   'block'  the same caps upright and emboldened: rubber stamps, labels, little signs
// The hand face is also built into a real TrueType font at startup (regular and bold) and
// registered as 'PZ Hand', so page text in books and notes is real, flowing, selectable text that
// stays on the pixel grid at whole multiples of its 10 px em (20 px = 2 CSS px per font pixel).
// Canvas pieces (stamps, covers, transitions, specimen tags) draw the bitmaps directly: crisp and
// synchronous, no font loading.
//
//   installPixelFonts()            register the webfonts (idempotent; installPaper calls it)
//   HAND_FAMILY                    the CSS font-family stack for the hand ('PZ Hand', ...)
//   textWidth(text, face, scale)   in art pixels
//   drawText(art, text, x, y, colour, { face, scale, bold })   y = the baseline
//   wrapText(text, maxW, face, scale)  -> lines

import type { Art } from './px';

// ---------------------------------------------------------------- the glyphs
// [first row, rows] with rows 0..9: 0-7 above the baseline (7 sits on it), 8-9 descend.
// x-height letters start on row 3, ascenders and caps on row 1.
type G = [number, string];
const GLYPHS: Record<string, G> = {
  a: [3, '.##..|#..#.|#..#.|#..#.|.##.#'],
  b: [1, '#...|#...|###.|#..#|#..#|#..#|.##.'],
  c: [3, '.##.|#..#|#...|#...|.###'],
  d: [1, '...#.|...#.|.###.|#..#.|#..#.|#..#.|.##.#'],
  e: [3, '.##.|#..#|###.|#...|.###'],
  f: [0, '..##|.#..|.#..|###.|.#..|.#..|.#..|.#..|.#..|#...'],
  g: [3, '.##.|#..#|#..#|#..#|.###|...#|###.'],
  h: [1, '#....|#....|###..|#..#.|#..#.|#..#.|#...#'],
  i: [1, '#.|..|#.|#.|#.|#.|.#'],
  j: [1, '..#|...|..#|..#|..#|..#|..#|..#|##.'],
  k: [1, '#...|#...|#..#|#.#.|##..|#.#.|#..#'],
  l: [1, '#.|#.|#.|#.|#.|#.|.#'],
  m: [3, '####..|#.#.#.|#.#.#.|#.#.#.|#.#..#'],
  n: [3, '###..|#..#.|#..#.|#..#.|#...#'],
  o: [3, '.##.|#..#|#..#|#..#|.##.'],
  p: [3, '###.|#..#|#..#|#..#|###.|#...|#...'],
  q: [3, '.#.#.|#.##.|#..#.|#..#.|.###.|...#.|...##'],
  r: [3, '#.##|##..|#...|#...|#...'],
  s: [3, '.###|#...|.##.|...#|###.'],
  t: [1, '.#..|.#..|###.|.#..|.#..|.#..|..##'],
  u: [3, '#..#.|#..#.|#..#.|#..#.|.##.#'],
  v: [3, '#...#|#...#|.#.#.|.#.#.|..#..'],
  w: [3, '#...#|#...#|#.#.#|#.#.#|.#.#.'],
  x: [3, '#...#|.#.#.|..#..|.#.#.|#...#'],
  y: [3, '#..#|#..#|#..#|#..#|.###|...#|###.'],
  z: [3, '####|...#|..#.|.#..|####'],
  A: [1, '.##.|#..#|#..#|####|#..#|#..#|#..#'],
  B: [1, '###.|#..#|#..#|###.|#..#|#..#|###.'],
  C: [1, '.##.|#..#|#...|#...|#...|#..#|.##.'],
  D: [1, '###.|#..#|#..#|#..#|#..#|#..#|###.'],
  E: [1, '####|#...|#...|###.|#...|#...|####'],
  F: [1, '####|#...|#...|###.|#...|#...|#...'],
  G: [1, '.##.|#..#|#...|#.##|#..#|#..#|.###'],
  H: [1, '#..#|#..#|#..#|####|#..#|#..#|#..#'],
  I: [1, '###|.#.|.#.|.#.|.#.|.#.|###'],
  J: [1, '...#|...#|...#|...#|#..#|#..#|.##.'],
  K: [1, '#..#|#..#|#.#.|##..|#.#.|#..#|#..#'],
  L: [1, '#...|#...|#...|#...|#...|#...|####'],
  M: [1, '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#'],
  N: [1, '#...#|##..#|#.#.#|#.#.#|#..##|#...#|#...#'],
  O: [1, '.##.|#..#|#..#|#..#|#..#|#..#|.##.'],
  P: [1, '###.|#..#|#..#|###.|#...|#...|#...'],
  Q: [1, '.##..|#..#.|#..#.|#..#.|#.##.|#..#.|.##.#'],
  R: [1, '###.|#..#|#..#|###.|#.#.|#..#|#..#'],
  S: [1, '.###|#...|#...|.##.|...#|...#|###.'],
  T: [1, '#####|..#..|..#..|..#..|..#..|..#..|..#..'],
  U: [1, '#..#|#..#|#..#|#..#|#..#|#..#|.##.'],
  V: [1, '#...#|#...#|#...#|.#.#.|.#.#.|.#.#.|..#..'],
  W: [1, '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#'],
  X: [1, '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#'],
  Y: [1, '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..'],
  Z: [1, '#####|....#|...#.|..#..|.#...|#....|#####'],
  '0': [1, '.##.|#..#|#.##|##.#|#..#|#..#|.##.'],
  '1': [1, '.#.|##.|.#.|.#.|.#.|.#.|###'],
  '2': [1, '.##.|#..#|...#|..#.|.#..|#...|####'],
  '3': [1, '###.|...#|...#|.##.|...#|...#|###.'],
  '4': [1, '#..#|#..#|#..#|####|...#|...#|...#'],
  '5': [1, '####|#...|###.|...#|...#|#..#|.##.'],
  '6': [1, '.##.|#...|#...|###.|#..#|#..#|.##.'],
  '7': [1, '####|...#|...#|..#.|.#..|.#..|.#..'],
  '8': [1, '.##.|#..#|#..#|.##.|#..#|#..#|.##.'],
  '9': [1, '.##.|#..#|#..#|.###|...#|...#|.##.'],
  ' ': [7, '..'],
  '.': [7, '#'],
  ',': [7, '.#|#.'],
  '!': [1, '#|#|#|#|#|.|#'],
  '?': [1, '.##.|#..#|...#|..#.|.#..|....|.#..'],
  "'": [1, '#|#'],
  '"': [1, '#.#|#.#'],
  '’': [1, '.#|.#|#.'],
  '‘': [1, '.#|#.|#.'],
  '“': [1, '.#.#|#.#.|#.#.'],
  '”': [1, '.#.#|.#.#|#.#.'],
  '-': [5, '###'],
  '–': [5, '####'],
  '—': [5, '######'],
  '−': [5, '###'],
  ':': [4, '#|.|.|#'],
  ';': [4, '.#|..|..|.#|#.'],
  '(': [1, '.#|#.|#.|#.|#.|#.|#.|.#'],
  ')': [1, '#.|.#|.#|.#|.#|.#|.#|#.'],
  '[': [1, '##|#.|#.|#.|#.|#.|#.|##'],
  ']': [1, '##|.#|.#|.#|.#|.#|.#|##'],
  '{': [1, '.##|.#.|.#.|#..|.#.|.#.|.##'],
  '}': [1, '##.|.#.|.#.|..#|.#.|.#.|##.'],
  '/': [1, '...#|...#|..#.|..#.|.#..|#...|#...'],
  '\\': [1, '#...|#...|.#..|.#..|..#.|...#|...#'],
  '|': [1, '#|#|#|#|#|#|#|#|#'],
  '+': [4, '.#.|###|.#.'],
  '=': [4, '###|...|###'],
  '*': [1, '#.#|.#.|#.#'],
  '&': [1, '.#...|#.#..|#.#..|.#...|#.#.#|#..#.|.##.#'],
  '%': [1, '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##'],
  '#': [2, '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.'],
  '$': [1, '..#..|.####|#.#..|.###.|..#.#|####.|..#..'],
  '@': [1, '.###.|#...#|#.###|#.#.#|#.###|#....|.###.'],
  '<': [3, '..#|.#.|#..|.#.|..#'],
  '>': [3, '#..|.#.|..#|.#.|#..'],
  '^': [1, '.#.|#.#'],
  '_': [8, '####'],
  '`': [1, '#.|.#'],
  '~': [4, '.#.#|#.#.'],
  '·': [5, '#'],
  '…': [7, '#.#.#'],
  '→': [4, '...#.|#####|...#.'],
  '×': [4, '#.#|.#.|#.#'],
  '°': [1, '.#.|#.#|.#.'],
  '±': [3, '.#.|###|.#.|...|###'],
  '≈': [3, '.#.#|#.#.|....|.#.#|#.#.'],
  '♥': [2, '.#.#.|#####|#####|.###.|..#..'],
  '★': [1, '..#..|..#..|#####|.###.|.#.#.|#...#'],
  '☆': [1, '..#..|.#.#.|##.##|#...#|.#.#.|#.#.#'],
  '✓': [3, '....#|...#.|#.#..|.#...'],
  '✕': [3, '#...#|.#.#.|..#..|.#.#.|#...#'],
  '♪': [1, '.###|.#.#|.#..|.#..|##..|##..'],
};
GLYPHS['✔'] = GLYPHS['✓'];
GLYPHS['✗'] = GLYPHS['✕'];
GLYPHS['♫'] = GLYPHS['♪'];
GLYPHS[' '] = GLYPHS[' '];

/** a glyph as a 10-row grid of booleans */
interface Bits { w: number; rows: boolean[][] }
function bitsOf(g: G): Bits {
  const lines = g[1].split('|');
  const w = Math.max(...lines.map(l => l.length));
  const rows: boolean[][] = Array.from({ length: 10 }, () => new Array(w).fill(false));
  lines.forEach((l, i) => { for (let x = 0; x < l.length; x++) if (l[x] === '#') rows[g[0] + i][x] = true; });
  return { w, rows };
}
/** add an accent (macron, acute) above a base glyph */
function accented(base: string, kind: 'macron' | 'acute'): Bits {
  const b = bitsOf(GLYPHS[base]);
  const top = b.rows.findIndex(r => r.some(Boolean));
  const capital = base === base.toUpperCase();
  const r0 = capital ? 0 : Math.max(0, top - 2);
  if (kind === 'macron') {
    const span = Math.max(2, b.w - (/[adu]/.test(base) ? 2 : 1));
    const x0 = base === 'i' ? 0 : 0 + (b.w > 3 ? 1 : 0);
    if (base === 'i') b.rows[1] = b.rows[1].map(() => false);
    for (let x = x0; x < Math.min(b.w, x0 + span); x++) b.rows[r0][x] = true;
  } else {
    b.rows[r0][Math.min(b.w - 1, 2)] = true;
    if (r0 + 1 < top) b.rows[r0 + 1][Math.min(b.w - 1, 1)] = true;
  }
  return b;
}
const EXTRA: Record<string, [string, 'macron' | 'acute']> = {
  'ā': ['a', 'macron'], 'ē': ['e', 'macron'], 'ī': ['i', 'macron'], 'ō': ['o', 'macron'], 'ū': ['u', 'macron'],
  'Ā': ['A', 'macron'], 'Ē': ['E', 'macron'], 'Ī': ['I', 'macron'], 'Ō': ['O', 'macron'], 'Ū': ['U', 'macron'],
  'é': ['e', 'acute'], 'É': ['E', 'acute'], 'è': ['e', 'acute'], 'á': ['a', 'acute'], 'ó': ['o', 'acute'],
};

export type Face = 'hand' | 'block';

/** a face's glyph: rows of pixels in art space, x offsets already sheared, plus its advance */
interface FaceGlyph { px: [number, number][]; adv: number; x0: number; x1: number }
const faces = new Map<string, Map<string, FaceGlyph>>();
/** the slant: rows 0-1 shift 2 px right, 2-4 shift 1, 5-7 none, the descender 1 left */
const shear = (row: number) => Math.floor((7 - row) / 3);

function rawBits(ch: string): Bits | null {
  if (GLYPHS[ch]) return bitsOf(GLYPHS[ch]);
  const e = EXTRA[ch];
  if (e && GLYPHS[e[0]]) return accented(e[0], e[1]);
  return null;
}

function buildGlyph(ch: string, face: Face, bold: boolean): FaceGlyph | null {
  let src = ch;
  if (face === 'block') src = ch.toUpperCase();
  const b = rawBits(src);
  if (!b) return null;
  const set = new Set<string>();
  const out: [number, number][] = [];
  const add = (x: number, y: number) => { const k = x + ',' + y; if (!set.has(k)) { set.add(k); out.push([x, y]); } };
  for (let y = 0; y < 10; y++) for (let x = 0; x < b.w; x++) if (b.rows[y][x]) {
    const sx = face === 'hand' ? x + shear(y) : x;
    add(sx, y);
    if (bold) add(sx + 1, y);
  }
  let x0 = Infinity, x1 = -Infinity;
  for (const [x] of out) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (!out.length) { x0 = 0; x1 = -1; }
  return { px: out, adv: b.w + 1 + (bold ? 1 : 0), x0, x1 };
}

function faceMap(face: Face, bold: boolean) {
  const k = face + (bold ? 'b' : '');
  let m = faces.get(k);
  if (!m) { m = new Map(); faces.set(k, m); }
  return m;
}
function glyph(ch: string, face: Face, bold: boolean): FaceGlyph {
  const m = faceMap(face, bold);
  let g = m.get(ch);
  if (!g) {
    g = buildGlyph(ch, face, bold) ?? buildGlyph(ch.normalize('NFD').replace(/[̀-ͯ]/g, ''), face, bold) ?? buildGlyph('?', face, bold)!;
    m.set(ch, g);
  }
  return g;
}

// ---------------------------------------------------------------- canvas text

export interface TextOpts { face?: Face; scale?: number; bold?: boolean; spacing?: number }

/** width of a line of text in art pixels */
export function textWidth(text: string, o: TextOpts = {}): number {
  const face = o.face ?? 'hand', k = o.scale ?? 1, bold = o.bold ?? face === 'block';
  let w = 0;
  for (const ch of text) w += glyph(ch, face, bold).adv + (o.spacing ?? 0);
  return Math.max(0, w - 1 - (o.spacing ?? 0)) * k;
}
/** the text's ink height above the baseline and below it (art px) */
export const textAscent = (o: TextOpts = {}) => 7 * (o.scale ?? 1);
export const textDescent = (o: TextOpts = {}) => 2 * (o.scale ?? 1);

/** draw text with its baseline at y (x is the left edge); returns the advance in art px */
export function drawText(a: Art, text: string, x: number, y: number, c: number | ((x: number, y: number) => number), o: TextOpts = {}): number {
  const face = o.face ?? 'hand', k = o.scale ?? 1, bold = o.bold ?? face === 'block';
  let cx = Math.round(x);
  const by = Math.round(y);
  for (const ch of text) {
    const g = glyph(ch, face, bold);
    for (const [gx, gy] of g.px) {
      const px0 = cx + gx * k, py0 = by + (gy - 8) * k;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        const X = px0 + i, Y = py0 + j;
        a.px(X, Y, typeof c === 'number' ? c : c(X, Y));
      }
    }
    cx += (g.adv + (o.spacing ?? 0)) * k;
  }
  return cx - x;
}

/** greedy word wrap to maxW art pixels */
export function wrapText(text: string, maxW: number, o: TextOpts = {}): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && textWidth(t, o) > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ---------------------------------------------------------------- the TrueType font

/** every character the font carries */
export const FONT_CHARS = [...Object.keys(GLYPHS), ...Object.keys(EXTRA)].filter((c, i, a) => a.indexOf(c) === i).sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);

class Bin {
  b: number[] = [];
  u8(v: number) { this.b.push(v & 255); return this; }
  u16(v: number) { this.b.push((v >> 8) & 255, v & 255); return this; }
  i16(v: number) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v: number) { this.b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; }
  tag(s: string) { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i)); return this; }
  bytes(a: number[] | Uint8Array) { for (const v of a) this.b.push(v); return this; }
  pad4() { while (this.b.length % 4) this.b.push(0); return this; }
  get length() { return this.b.length; }
}

const UNIT = 100; // font units per pixel; em = 10 px = 1000 units

/** build a TrueType font from the hand face (bold doubles every pixel one to the right) */
export function buildHandTTF(bold: boolean, family = 'PZ Hand'): ArrayBuffer {
  const chars = FONT_CHARS;
  type GD = { contours: [number, number][][]; adv: number; xMin: number; yMin: number; xMax: number; yMax: number };
  const glyphs: GD[] = [];
  // .notdef: an empty box
  glyphs.push({ contours: [], adv: 5 * UNIT, xMin: 0, yMin: 0, xMax: 0, yMax: 0 });
  for (const ch of chars) {
    const g = glyph(ch, 'hand', bold);
    // merge each row's pixels into runs: one rectangle per run
    const rows = new Map<number, number[]>();
    for (const [x, y] of g.px) { let r = rows.get(y); if (!r) rows.set(y, (r = [])); r.push(x); }
    const contours: [number, number][][] = [];
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    for (const [y, xs] of rows) {
      xs.sort((a, b) => a - b);
      let s = xs[0], p = xs[0];
      const flush = (a: number, b: number) => {
        const X0 = a * UNIT, X1 = (b + 1) * UNIT, Y1 = (8 - y) * UNIT, Y0 = (7 - y) * UNIT;
        // clockwise (y up): left edge going up, top going right, right edge down, bottom going left
        contours.push([[X0, Y0], [X0, Y1], [X1, Y1], [X1, Y0]]);
        xMin = Math.min(xMin, X0); xMax = Math.max(xMax, X1); yMin = Math.min(yMin, Y0); yMax = Math.max(yMax, Y1);
      };
      for (let i = 1; i < xs.length; i++) { if (xs[i] === p + 1) p = xs[i]; else { flush(s, p); s = p = xs[i]; } }
      flush(s, p);
    }
    if (!contours.length) { xMin = yMin = xMax = yMax = 0; }
    glyphs.push({ contours, adv: g.adv * UNIT, xMin, yMin, xMax, yMax });
  }
  const n = glyphs.length;
  // ---- glyf + loca
  const glyf = new Bin();
  const loca: number[] = [];
  for (const g of glyphs) {
    loca.push(glyf.length);
    if (!g.contours.length) continue;
    glyf.i16(g.contours.length).i16(g.xMin).i16(g.yMin).i16(g.xMax).i16(g.yMax);
    let end = -1;
    for (const c of g.contours) { end += c.length; glyf.u16(end); }
    glyf.u16(0); // no instructions
    const pts = g.contours.flat();
    for (let i = 0; i < pts.length; i++) glyf.u8(0x01); // on-curve, long x and y
    let px = 0;
    for (const [x] of pts) { glyf.i16(x - px); px = x; }
    let py = 0;
    for (const [, y] of pts) { glyf.i16(y - py); py = y; }
    glyf.pad4();
  }
  loca.push(glyf.length);
  const locaB = new Bin();
  for (const o of loca) locaB.u32(o);
  // ---- metrics
  let xMin = 0, yMin = 0, xMax = 0, yMax = 0, advMax = 0, maxPts = 0, maxCt = 0, minRsb = 0, minLsb = 0, maxExt = 0;
  for (const g of glyphs) {
    xMin = Math.min(xMin, g.xMin); yMin = Math.min(yMin, g.yMin); xMax = Math.max(xMax, g.xMax); yMax = Math.max(yMax, g.yMax);
    advMax = Math.max(advMax, g.adv);
    maxPts = Math.max(maxPts, g.contours.length * 4); maxCt = Math.max(maxCt, g.contours.length);
    if (g.contours.length) { minLsb = Math.min(minLsb, g.xMin); minRsb = Math.min(minRsb, g.adv - g.xMax); maxExt = Math.max(maxExt, g.xMax); }
  }
  const hmtx = new Bin();
  for (const g of glyphs) hmtx.u16(g.adv).i16(g.contours.length ? g.xMin : 0);
  const ASC = 8 * UNIT, DESC = 2 * UNIT;
  const head = new Bin().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x0009).u16(10 * UNIT)
    .u32(0).u32(0).u32(0).u32(0).i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(bold ? 1 : 0).u16(8).i16(2).i16(1).i16(0);
  const hhea = new Bin().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(advMax).i16(minLsb).i16(minRsb).i16(maxExt).i16(1).i16(0).i16(0)
    .i16(0).i16(0).i16(0).i16(0).i16(0).u16(n);
  const maxp = new Bin().u32(0x00010000).u16(n).u16(maxPts).u16(maxCt).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
  const cps = chars.map(c => c.codePointAt(0)!);
  const os2 = new Bin().u16(4).i16(5 * UNIT).u16(bold ? 700 : 400).u16(5).u16(0)
    .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(UNIT).i16(4 * UNIT).i16(0)
    .bytes(new Array(10).fill(0)).u32(3).u32(0).u32(0).u32(0).tag('PZ  ')
    .u16((bold ? 0x20 : 0x40) | 0x80).u16(Math.min(...cps)).u16(Math.min(0xffff, Math.max(...cps)))
    .i16(ASC).i16(-DESC).i16(0).u16(Math.max(ASC, yMax)).u16(Math.max(DESC, -yMin)).u32(1).u32(0)
    .i16(5 * UNIT).i16(7 * UNIT).u16(0).u16(32).u16(1);
  // cmap: format 4, one segment per run of consecutive code points
  const map: [number, number][] = cps.map((cp, i) => [cp, i + 1]);
  const segs: { s: number; e: number; delta: number }[] = [];
  for (const [cp, gid] of map) {
    const last = segs[segs.length - 1];
    if (last && cp === last.e + 1 && gid - cp === last.delta) last.e = cp;
    else segs.push({ s: cp, e: cp, delta: gid - cp });
  }
  segs.push({ s: 0xffff, e: 0xffff, delta: 1 });
  const sc = segs.length;
  let sr = 1, es = 0;
  while (sr * 2 <= sc) { sr *= 2; es++; }
  const sub = new Bin().u16(4).u16(0).u16(0).u16(sc * 2).u16(sr * 2).u16(es).u16(sc * 2 - sr * 2);
  for (const s of segs) sub.u16(s.e);
  sub.u16(0);
  for (const s of segs) sub.u16(s.s);
  for (const s of segs) sub.u16((s.delta + 65536) % 65536);
  for (let i = 0; i < sc; i++) sub.u16(0);
  sub.b[2] = (sub.length >> 8) & 255; sub.b[3] = sub.length & 255;
  const cmap = new Bin().u16(0).u16(2).u16(0).u16(3).u32(20).u16(3).u16(1).u32(20).bytes(sub.b);
  // name
  const style = bold ? 'Bold' : 'Regular';
  const ps = family.replace(/\s+/g, '') + '-' + style;
  const names: [number, string][] = [[1, family], [2, style], [3, `${ps};1.0`], [4, `${family} ${style}`], [5, 'Version 1.0'], [6, ps]];
  const strs = names.map(([, s]) => { const o: number[] = []; for (const ch of s) { const c = ch.charCodeAt(0); o.push(c >> 8, c & 255); } return o; });
  const name = new Bin().u16(0).u16(names.length).u16(6 + names.length * 12);
  let off = 0;
  names.forEach(([id], i) => { name.u16(3).u16(1).u16(0x409).u16(id).u16(strs[i].length).u16(off); off += strs[i].length; });
  for (const s of strs) name.bytes(s);
  const post = new Bin().u32(0x00030000).u32(Math.round(-18 * 65536) >>> 0).i16(-150).i16(UNIT).u32(0).u32(0).u32(0).u32(0).u32(0);
  // ---- the file
  const tables: [string, Bin][] = [['OS/2', os2], ['cmap', cmap], ['glyf', glyf], ['head', head], ['hhea', hhea], ['hmtx', hmtx], ['loca', locaB], ['maxp', maxp], ['name', name], ['post', post]];
  const nt = tables.length;
  let tsr = 1, tes = 0;
  while (tsr * 2 <= nt) { tsr *= 2; tes++; }
  const out = new Bin().u32(0x00010000).u16(nt).u16(tsr * 16).u16(tes).u16(nt * 16 - tsr * 16);
  let pos = 12 + nt * 16;
  const recs: { tag: string; sum: number; off: number; len: number; data: number[] }[] = [];
  for (const [tag, t] of tables) {
    const data = t.b.slice();
    const len = data.length;
    while (data.length % 4) data.push(0);
    recs.push({ tag, sum: checksum(data), off: pos, len, data });
    pos += data.length;
  }
  for (const r of recs) out.tag(r.tag).u32(r.sum).u32(r.off).u32(r.len);
  for (const r of recs) out.bytes(r.data);
  const bytes = new Uint8Array(out.b);
  // head.checkSumAdjustment
  const headRec = recs.find(r => r.tag === 'head')!;
  const adj = (0xb1b0afba - checksum(out.b)) >>> 0;
  const p = headRec.off + 8;
  bytes[p] = adj >>> 24; bytes[p + 1] = (adj >>> 16) & 255; bytes[p + 2] = (adj >>> 8) & 255; bytes[p + 3] = adj & 255;
  return bytes.buffer;
}
function checksum(b: number[]): number {
  let s = 0;
  for (let i = 0; i < b.length; i += 4) s = (s + (((b[i] << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0)) >>> 0;
  return s;
}

export const HAND_FAMILY = "'PZ Hand', 'Pixelify Sans', 'Jersey 15', monospace";

let fontsP: Promise<boolean> | null = null;
/** register the hand as a webfont (regular + bold); resolves true once the browser has it */
export function installPixelFonts(): Promise<boolean> {
  if (fontsP) return fontsP;
  fontsP = (async () => {
    try {
      const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (!fs || typeof FontFace === 'undefined') return false;
      const reg = new FontFace('PZ Hand', buildHandTTF(false), { weight: '100 549', style: 'normal' });
      const bold = new FontFace('PZ Hand', buildHandTTF(true), { weight: '550 900', style: 'normal' });
      fs.add(reg); fs.add(bold);
      await Promise.all([reg.load(), bold.load()]);
      return true;
    } catch (e) { console.warn('pixel hand font', e); return false; }
  })();
  return fontsP;
}

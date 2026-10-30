// V11 HUD pixel helpers: every HUD widget is a small canvas painted in art pixels (bitmap text,
// Bresenham shapes, ordered dithering) and shown at a whole number of DEVICE pixels per art pixel, so
// the HUD is crisp pixel art whatever the fonts do.
//
// The HD remaster: art pixels are about half the size they were (2 CSS px on a desktop at DPR 1 where
// they were 3; 4 device px on a DPR 3 phone where they were 6), and every widget is painted at about
// 1.5x the art size, so it keeps its size on screen and gains the detail.
//
//   hudDev()                       device pixels per art pixel (a whole number)
//   hudScale()                     CSS px per art pixel (hudDev() / devicePixelRatio; may be fractional)
//   new PxW(parent, cls)           a widget canvas: w.draw(w, h, art => ...) repaints it (same size
//                                  reuses its buffer), w.el is the canvas, w.s the scale it's shown at
//   outlined(art, text, x, y, c, outline, o)   bitmap text with a 1 px outline all round
//   hudText(art, text, x, y, o)    the HUD's own pixel faces: 'caps' (9 px capitals, 2 px stems) and
//                                  'num' (11 px numerals for counters), shaded top to bottom, with a
//                                  ring and a drop; hudTextW() measures them
//   sky colours, dither helpers for gauges, rivets, stitching, leather and brass

import { Art, col, dith, shadeC, mixC } from './paper/px';
import { drawText, textWidth } from './paper/pxfont';
import type { TextOpts } from './paper/pxfont';

/** the CSS px per art pixel the old HUD used (3 desktop, 2 phones and small windows, 4 huge screens) */
function oldCss(): number {
  const w = window.innerWidth, h = window.innerHeight;
  if (w >= 2300 && h >= 1250) return 4;
  return w >= 1100 && h >= 640 ? 3 : 2;
}
/** device pixels per HUD art pixel: two thirds of the old size, rounded to whole device pixels */
export function hudDev(): number {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.round((oldCss() * dpr) / 1.5));
}
/** CSS px per HUD art pixel (whole device pixels, so it can be fractional in CSS px) */
export function hudScale(): number {
  return hudDev() / (window.devicePixelRatio || 1);
}

export class PxW {
  readonly el: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private art: Art | null = null;
  s = 0;
  constructor(parent: HTMLElement, cls: string) {
    this.el = parent.appendChild(document.createElement('canvas'));
    this.el.className = 'hx ' + cls;
    this.g = this.el.getContext('2d')!;
  }
  get w() { return this.art?.w ?? 0; }
  get h() { return this.art?.h ?? 0; }
  /** repaint at w x h art pixels */
  draw(w: number, h: number, paint: (a: Art) => void) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const s = hudScale();
    if (!this.art || this.art.w !== w || this.art.h !== h) {
      this.art = new Art(w, h);
      this.el.width = w; this.el.height = h;
      this.s = 0;
    } else this.art.d.fill(0);
    if (s !== this.s) {
      this.s = s;
      this.el.style.width = w * s + 'px';
      this.el.style.height = h * s + 'px';
    }
    paint(this.art);
    this.g.putImageData(this.art.img, 0, 0);
  }
  /** an art-pixel point of the widget in CSS px relative to the page */
  at(x: number, y: number): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [r.left + x * this.s, r.top + y * this.s];
  }
  /** the art pixel under a pointer event */
  hit(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / Math.max(1, this.s)), Math.floor((e.clientY - r.top) / Math.max(1, this.s))];
  }
}

/** bitmap text with a 1 px outline (8 neighbours) */
export function outlined(a: Art, text: string, x: number, y: number, c: number | ((x: number, y: number) => number), outline: number, o: TextOpts = {}) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) drawText(a, text, x + dx, y + dy, outline, o);
  return drawText(a, text, x, y, c, o);
}
export const tw = textWidth;

/** a chunky plate: dark outline, a lit top-left rim, a shaded bottom-right, a hard shadow */
export function plate(a: Art, x: number, y: number, w: number, h: number, fill: number, o: { r?: number; shadow?: boolean; rim?: number } = {}) {
  const r = o.r ?? 2;
  const out = col('#140c06');
  const inside = (px: number, py: number) => {
    if (px < x || py < y || px >= x + w || py >= y + h) return false;
    const cx = px < x + r ? x + r - px : px >= x + w - r ? px - (x + w - 1 - r) : 0;
    const cy = py < y + r ? y + r - py : py >= y + h - r ? py - (y + h - 1 - r) : 0;
    return cx * cx + cy * cy <= r * r + (r > 1 ? 1 : 0);
  };
  if (o.shadow !== false) {
    const sh = col('#000000', 0.42);
    for (let py = y + 2; py < y + h + 2; py++) for (let px = x + 2; px < x + w + 2; px++) if (!inside(px, py) && inside(px - 2, py - 2) && dith(px, py, 0.65)) a.px(px, py, sh);
  }
  const lt = shadeC(fill, 0.22), dk = shadeC(fill, -0.28);
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    if (!inside(px, py)) continue;
    let c = fill;
    if (!inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1)) c = out;
    else if (!inside(px, py - 2) || !inside(px - 2, py)) c = lt;
    else if (!inside(px, py + 2) || !inside(px + 2, py)) c = dk;
    a.put(px, py, c);
  }
}

/** a sky colour pair for an hour of the day (top, bottom) */
export function skyAt(h: number): [number, number] {
  const t = ((h % 24) + 24) % 24;
  const K: [number, string, string][] = [
    [0, '#0e1430', '#1c2650'], [5, '#1a2048', '#3a3a6a'], [6.5, '#e8906a', '#f4c890'], [8, '#7ab8e8', '#c8e4f0'], [12, '#5aa8e8', '#b8e0f4'],
    [16.5, '#7ab0dc', '#f0d0a0'], [18.5, '#e0784a', '#f4b060'], [19.6, '#6a3a78', '#d06a5a'], [21, '#1a2048', '#3a3060'], [24, '#0e1430', '#1c2650'],
  ];
  let i = 0;
  while (i < K.length - 2 && t >= K[i + 1][0]) i++;
  const [t0, a0, b0] = K[i], [t1, a1, b1] = K[i + 1];
  const k = Math.max(0, Math.min(1, (t - t0) / Math.max(0.001, t1 - t0)));
  return [mixC(col(a0), col(a1), k), mixC(col(b0), col(b1), k)];
}

/** a gauge colour from a fraction (teal when full, yellow, orange, red when empty) */
export function gaugeColor(f: number): [number, number, number] {
  const stops: [number, string][] = [[0, '#d8322a'], [0.15, '#e8602e'], [0.3, '#f0b23a'], [0.55, '#8ccf4a'], [1, '#3fc8a8']];
  let i = 0;
  while (i < stops.length - 2 && f >= stops[i + 1][0]) i++;
  const k = Math.max(0, Math.min(1, (f - stops[i][0]) / (stops[i + 1][0] - stops[i][0])));
  const c = mixC(col(stops[i][1]), col(stops[i + 1][1]), k);
  return [c, shadeC(c, -0.3), shadeC(c, 0.35)];
}

// ---------------------------------------------------------------- the HUD's pixel faces
// 'caps': 9 px capitals with 2 px stems (place names, the name ribbon, labels that need weight)
// 'num':  11 px numerals for the counters (research points, film, energy)
// Both are hand-placed bitmaps; hudText shades them top to bottom (light, base, dark) and rings them.
const CAPS: Record<string, string> = {
  A: '..##..|.####.|##..##|##..##|##..##|######|##..##|##..##|##..##',
  B: '#####.|##..##|##..##|##..##|#####.|##..##|##..##|##..##|#####.',
  C: '.####.|##..##|##....|##....|##....|##....|##....|##..##|.####.',
  D: '####..|##.##.|##..##|##..##|##..##|##..##|##..##|##.##.|####..',
  E: '######|##....|##....|##....|#####.|##....|##....|##....|######',
  F: '######|##....|##....|##....|#####.|##....|##....|##....|##....',
  G: '.####.|##..##|##....|##....|##.###|##..##|##..##|##..##|.#####',
  H: '##..##|##..##|##..##|##..##|######|##..##|##..##|##..##|##..##',
  I: '####|.##.|.##.|.##.|.##.|.##.|.##.|.##.|####',
  J: '...###|....##|....##|....##|....##|....##|##..##|##..##|.####.',
  K: '##..##|##..##|##.##.|####..|###...|####..|##.##.|##..##|##..##',
  L: '##....|##....|##....|##....|##....|##....|##....|##....|######',
  M: '##...##|###.###|#######|##.#.##|##.#.##|##...##|##...##|##...##|##...##',
  N: '##..##|###.##|###.##|######|##.###|##.###|##..##|##..##|##..##',
  O: '.####.|##..##|##..##|##..##|##..##|##..##|##..##|##..##|.####.',
  P: '#####.|##..##|##..##|##..##|#####.|##....|##....|##....|##....',
  Q: '.####.|##..##|##..##|##..##|##..##|##..##|##.###|##..##|.##.##',
  R: '#####.|##..##|##..##|##..##|#####.|####..|##.##.|##..##|##..##',
  S: '.####.|##..##|##....|##....|.####.|....##|....##|##..##|.####.',
  T: '######|..##..|..##..|..##..|..##..|..##..|..##..|..##..|..##..',
  U: '##..##|##..##|##..##|##..##|##..##|##..##|##..##|##..##|.####.',
  V: '##..##|##..##|##..##|##..##|##..##|##..##|.####.|.####.|..##..',
  W: '##...##|##...##|##...##|##...##|##.#.##|##.#.##|#######|###.###|##...##',
  X: '##..##|##..##|##..##|.####.|..##..|.####.|##..##|##..##|##..##',
  Y: '##..##|##..##|##..##|.####.|..##..|..##..|..##..|..##..|..##..',
  Z: '######|....##|...##.|...##.|..##..|.##...|.##...|##....|######',
  '0': '.####.|##..##|##..##|##.###|######|###.##|##..##|##..##|.####.',
  '1': '..##..|.###..|####..|..##..|..##..|..##..|..##..|..##..|######',
  '2': '.####.|##..##|....##|....##|...##.|..##..|.##...|##....|######',
  '3': '.####.|##..##|....##|....##|..###.|....##|....##|##..##|.####.',
  '4': '...##.|..###.|.####.|##.##.|##.##.|######|...##.|...##.|...##.',
  '5': '######|##....|##....|#####.|....##|....##|....##|##..##|.####.',
  '6': '.####.|##..##|##....|##....|#####.|##..##|##..##|##..##|.####.',
  '7': '######|....##|....##|...##.|...##.|..##..|..##..|..##..|..##..',
  '8': '.####.|##..##|##..##|##..##|.####.|##..##|##..##|##..##|.####.',
  '9': '.####.|##..##|##..##|##..##|.#####|....##|....##|##..##|.####.',
  '/': '....##|....##|...##.|...##.|..##..|.##...|.##...|##....|##....',
  '.': '..|..|..|..|..|..|..|##|##',
  ',': '..|..|..|..|..|..|..|##|##',
  ':': '..|..|##|##|..|..|##|##|..',
  '-': '....|....|....|....|####|....|....|....|....',
  '+': '......|......|..##..|..##..|######|..##..|..##..|......|......',
  "'": '##|##|.#|..|..|..|..|..|..',
  '’': '##|##|.#|..|..|..|..|..|..',
  '!': '##|##|##|##|##|##|..|##|##',
  '?': '.####.|##..##|....##|...##.|..##..|..##..|......|..##..|..##..',
  '&': '.###..|##.##.|##.##.|.###..|.##.##|##.##.|##..##|##.##.|.##.##',
};
const NUM: Record<string, string> = {
  '0': '..###..|.##.##.|##...##|##...##|##...##|##...##|##...##|##...##|##...##|.##.##.|..###..',
  '1': '...##..|..###..|.####..|...##..|...##..|...##..|...##..|...##..|...##..|...##..|.######',
  '2': '.#####.|##...##|.....##|.....##|....##.|...##..|..##...|.##....|##.....|##.....|#######',
  '3': '.#####.|##...##|.....##|.....##|.....##|..####.|.....##|.....##|.....##|##...##|.#####.',
  '4': '....##.|...###.|..####.|.##.##.|##..##.|##..##.|#######|....##.|....##.|....##.|....##.',
  '5': '#######|##.....|##.....|##.....|######.|.....##|.....##|.....##|.....##|##...##|.#####.',
  '6': '..####.|.##....|##.....|##.....|######.|##...##|##...##|##...##|##...##|##...##|.#####.',
  '7': '#######|.....##|.....##|....##.|....##.|...##..|...##..|..##...|..##...|..##...|..##...',
  '8': '.#####.|##...##|##...##|##...##|.##.##.|..###..|.##.##.|##...##|##...##|##...##|.#####.',
  '9': '.#####.|##...##|##...##|##...##|##...##|.######|.....##|.....##|.....##|....##.|.####..',
  '/': '.....##|.....##|....##.|....##.|...##..|...##..|..##...|.##....|.##....|##.....|##.....',
  '+': '.......|.......|.......|...##..|...##..|.######|...##..|...##..|.......|.......|.......',
  '-': '.......|.......|.......|.......|.......|.#####.|.......|.......|.......|.......|.......',
  '.': '..|..|..|..|..|..|..|..|..|##|##',
};
export type HudFace = 'caps' | 'num';
interface HG { w: number; on: boolean[][] }
const hudGl = new Map<string, HG | null>();
function hudGlyph(face: HudFace, ch: string): HG | null {
  const k = face + ch;
  if (hudGl.has(k)) return hudGl.get(k)!;
  let src: string | null = (face === 'num' ? NUM[ch] ?? CAPS[ch] : CAPS[ch]) ?? null;
  if (!src) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    src = CAPS[base] ?? null;
  }
  const g = src ? { w: src.split('|')[0].length, on: src.split('|').map(r => [...r].map(c => c === '#')) } : null;
  hudGl.set(k, g);
  return g;
}
const hasMacron = (ch: string) => /̄/.test(ch.normalize('NFD'));
/** a HUD face's cap height */
export const hudCapH = (face: HudFace) => (face === 'num' ? 11 : 9);
/** width of a line in a HUD face (art px, the ring not included) */
export function hudTextW(text: string, face: HudFace = 'caps', spacing = 1): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    const g = ch === ' ' ? null : hudGlyph(face, ch);
    w += (g ? g.w : 4) + spacing;
  }
  return Math.max(0, w - spacing);
}
export interface HudTextOpts {
  face?: HudFace;
  /** fill: one colour, a ramp [light, base, dark] shaded top to bottom, or a function */
  c?: number | [number, number, number] | ((x: number, y: number, row: number) => number);
  /** 1 px ring (8 neighbours); null for none */
  ring?: number | null;
  /** a hard drop under the ring, this many px down (default 1) */
  drop?: number;
  dropC?: number;
  spacing?: number;
}
/** draw a line in a HUD face with its TOP at y; returns the advance */
export function hudText(a: Art, text: string, x: number, y: number, o: HudTextOpts = {}): number {
  const face = o.face ?? 'caps', sp = o.spacing ?? 1, H = hudCapH(face);
  const fill = o.c ?? col('#fff1cc');
  const pts: [number, number, number][] = [];
  let cx = Math.round(x);
  const y0 = Math.round(y);
  for (const ch of text.toUpperCase()) {
    const g = ch === ' ' ? null : hudGlyph(face, ch);
    if (!g) { cx += 4 + sp; continue; }
    g.on.forEach((row, j) => row.forEach((v, i) => { if (v) pts.push([cx + i, y0 + j, j]); }));
    if (face === 'caps' && hasMacron(ch)) for (let i = 1; i < g.w - 1; i++) pts.push([cx + i, y0 - 2, 0]);
    cx += g.w + sp;
  }
  const ring = o.ring === undefined ? col('#140c06') : o.ring;
  if (ring !== null) {
    const drop = o.drop ?? 1, dc = o.dropC ?? ring;
    for (let d = drop; d >= 1; d--) for (const [px, py] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a.put(px + dx, py + dy + d, dc);
    for (const [px, py] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a.put(px + dx, py + dy, ring);
  }
  for (const [px, py, row] of pts) {
    let c: number;
    if (Array.isArray(fill)) c = row < Math.round(H * 0.3) ? fill[0] : row >= Math.round(H * 0.72) ? fill[2] : fill[1];
    else if (typeof fill === 'function') c = fill(px, py, row);
    else c = fill;
    a.put(px, py, c);
  }
  return cx - Math.round(x) - sp;
}
/** a light / base / dark ramp for hudText from one colour */
export const ramp3 = (c: number): [number, number, number] => [shadeC(c, 0.35), c, shadeC(c, -0.22)];

// ---------------------------------------------------------------- physical bits
/** a hash for texture noise (0..1) */
export const hnoise = (x: number, y: number, s = 0) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** a domed rivet: a 3x3 head lit from the top left, a dark rim, a contact shadow down-right */
export function rivet(a: Art, x: number, y: number, c = col('#c8962e')) {
  const L = shadeC(c, 0.5), D = shadeC(c, -0.45), O = col('#2a1806');
  a.px(x + 2, y + 1, col('#000000', 0.4)); a.px(x + 1, y + 2, col('#000000', 0.4)); a.px(x + 2, y + 2, col('#000000', 0.3));
  a.put(x - 1, y - 1, c); a.put(x, y - 1, L); a.put(x + 1, y - 1, D);
  a.put(x - 1, y, L); a.put(x, y, shadeC(c, 0.8)); a.put(x + 1, y, D);
  a.put(x - 1, y + 1, D); a.put(x, y + 1, D); a.put(x + 1, y + 1, O);
}
/** leather: a grained fill with pores and a few scuffs, by the base colour */
export function leatherAt(x: number, y: number, base: number): number {
  const n = hnoise(x, y, 7), m = hnoise(x >> 1, y >> 2, 3);
  if (n > 0.94) return shadeC(base, -0.3);
  if (n < 0.04) return shadeC(base, 0.16);
  return m > 0.72 ? shadeC(base, -0.1) : m < 0.12 ? shadeC(base, 0.06) : base;
}
/** brushed brass for a light term l (0 dark .. 1 lit), dithered between six tones */
export const BRASS6 = ['#3a2408', '#6a4416', '#9a6a22', '#c8962e', '#e8c45a', '#fff0a8'].map(h => col(h));
export function brassAt(x: number, y: number, l: number): number {
  const v = Math.max(0, Math.min(5, l * 5 + (dith(x, y, 0.5) ? 0.3 : -0.3)));
  return BRASS6[Math.round(v)];
}
/** a paper / card texture: a fibre speckle over the base */
export function paperAt(x: number, y: number, base: number, k = 1): number {
  const n = hnoise(x, y, 11), f = hnoise(x >> 2, y, 5);
  if (n > 1 - 0.025 * k) return shadeC(base, -0.16);
  if (f > 0.86) return shadeC(base, -0.05 * k);
  if (n < 0.03 * k) return shadeC(base, 0.25);
  return base;
}

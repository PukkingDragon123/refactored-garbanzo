// V11 pixel UI: screens painted straight into a pixel buffer and shown at a whole-number scale
// (image-rendering: pixelated), so every edge, letter and shadow is a real pixel: leather covers with
// stitching and brass corners, aged parchment (dithered, never a smooth gradient), stamps, tape,
// pixel buttons and slots, heart gauges. Text comes from the bitmap face in pixfont.ts.
//
//   const s = new PixScreen(360, 216, s => { ...paint into s.b, s.hit(...) });  await s.open();
//
// Hit boxes are registered while painting; the pointer is mapped back to art pixels. Keys go to
// onKey (arrows, Enter...); Escape closes (through the UI's modal stack, so the game pauses input).

import { PixelBuffer } from '../../art/pixel';
import { hex, mix, shade } from '../../art/color';
import type { C } from '../../art/color';
import { game } from '../../game/game';
import { audio } from '../../core/audio';
import { el } from '../ui';
import { drawPx, pxWidth } from './pixfont';
import type { PxOpts } from './pixfont';

export const H = hex;
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
export const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export const INK = {
  out: H('#1a0e08'), ink: H('#3a2614'), soft: H('#6a5434'), faint: H('#9a8460'),
  red: H('#a8382a'), redD: H('#6a1a12'), green: H('#2f5a22'), blue: H('#22466e'), gold: H('#e0a818'), goldL: H('#ffe27a'), goldD: H('#8a5a08'),
  white: H('#fff8e8'), cream: H('#f4e8c8'),
};

// ------------------------------------------------------------------ painting helpers
/** blit a buffer (alpha-tested), optionally flipped */
export function blit(b: PixelBuffer, src: PixelBuffer, x: number, y: number, flip = false) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const v = src.data[j * src.w + (flip ? src.w - 1 - i : i)];
    if (v >>> 24 > 127) b.set(x + i, y + j, v);
  }
}
/** blit a canvas (alpha-tested) */
export function blitCanvas(b: PixelBuffer, c: HTMLCanvasElement, x: number, y: number, down = 1) {
  const g = c.getContext('2d');
  if (!g) return;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let j = 0; j < Math.floor(c.height / down); j++) for (let i = 0; i < Math.floor(c.width / down); i++) {
    const k = ((j * down) * c.width + i * down) * 4;
    if (d[k + 3] > 127) b.set(x + i, y + j, ((d[k + 3] << 24) | (d[k + 2] << 16) | (d[k + 1] << 8) | d[k]) >>> 0);
  }
}
export function rect(b: PixelBuffer, x: number, y: number, w: number, h: number, c: C) { b.rect(x, y, w, h, c); }
/** a 1px outlined box */
export function frame(b: PixelBuffer, x: number, y: number, w: number, h: number, c: C) {
  b.rect(x, y, w, 1, c); b.rect(x, y + h - 1, w, 1, c); b.rect(x, y, 1, h, c); b.rect(x + w - 1, y, 1, h, c);
}
/** a hard one-pixel drop shadow under a box (dithered half-tone, not a blur) */
export function dropShadow(b: PixelBuffer, x: number, y: number, w: number, h: number, d = 2) {
  const c = H('#140a06');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i + d, Y = y + j + d;
    if (i < w - d && j < h - d) continue;
    if (((X + Y) & 1) === 0) b.set(X, Y, c);
  }
}

/** dark leather with grain, a stitched border and brass corner caps */
export function leather(b: PixelBuffer, x0: number, y0: number, w: number, h: number, o: { col?: [string, string, string, string]; stitch?: boolean; corners?: boolean } = {}) {
  const [c0, c1, c2, c3] = (o.col ?? ['#2a1408', '#4a2a12', '#6a3e1c', '#8a5628']).map(c => H(c));
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const n = hash(x >> 1, y >> 1, 7), m = hash(x >> 3, y >> 3, 9);
    const v = (m - 0.5) * 0.5 + (n > 0.9 ? 0.4 : n < 0.08 ? -0.4 : 0) - (y - y0) / h * 0.25;
    b.set(x, y, v > 0.3 ? c3 : v > -0.05 ? c2 : v > -0.3 ? c1 : c0);
  }
  frame(b, x0, y0, w, h, INK.out);
  b.rect(x0 + 1, y0 + 1, w - 2, 1, c3); b.rect(x0 + 1, y0 + h - 2, w - 2, 1, c0);
  if (o.stitch !== false) {
    const sc = H('#c8a070');
    for (let x = x0 + 4; x < x0 + w - 4; x += 3) { b.set(x, y0 + 3, sc); b.set(x + 1, y0 + 3, sc); b.set(x, y0 + h - 4, sc); b.set(x + 1, y0 + h - 4, sc); }
    for (let y = y0 + 4; y < y0 + h - 4; y += 3) { b.set(x0 + 3, y, sc); b.set(x0 + 3, y + 1, sc); b.set(x0 + w - 4, y, sc); b.set(x0 + w - 4, y + 1, sc); }
  }
  if (o.corners !== false) for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + w - 1, y0, -1, 1], [x0, y0 + h - 1, 1, -1], [x0 + w - 1, y0 + h - 1, -1, -1]]) {
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7 - j; i++) {
      const edge = i === 6 - j || j === 0 || i === 0;
      b.set(cx + i * sx, cy + j * sy, edge ? INK.out : i + j < 3 ? INK.goldL : (i + j) % 3 === 0 ? INK.goldD : INK.gold);
    }
    b.set(cx + 2 * sx, cy + 2 * sy, H('#5a3a08'));
  }
}

/** aged parchment: dithered darkening toward the edges, flecks, an optional ruled-line pattern */
export function paper(b: PixelBuffer, x0: number, y0: number, w: number, h: number, o: { tone?: [string, string, string, string]; ruled?: number; edge?: number; torn?: boolean; spine?: 'l' | 'r' } = {}) {
  const [p0, p1, p2, p3] = (o.tone ?? ['#c9b088', '#dcc89c', '#ecdcb4', '#f8eed4']).map(c => H(c));
  const e = o.edge ?? 9;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let d = Math.min(x - x0, x0 + w - 1 - x, y - y0, y0 + h - 1 - y) / e;
    if (o.spine === 'r') d = Math.min(d, (x0 + w - 1 - x) / (e * 1.6));
    if (o.spine === 'l') d = Math.min(d, (x - x0) / (e * 1.6));
    d = Math.min(1, d);
    const n = hash(x, y, 3);
    let v = d * 2.2 + (n - 0.5) * 0.3;
    if (n > 0.985) v -= 1.2;
    const t = v > 2 ? p3 : v > 1.2 ? (v - 1.2) / 0.8 > dith(x, y) ? p3 : p2 : v > 0.5 ? ((v - 0.5) / 0.7 > dith(x, y) ? p2 : p1) : ((v + 0.2) / 0.7 > dith(x, y) ? p1 : p0);
    if (o.torn && (y === y0 || y === y0 + h - 1) && hash(x, 1, 5) > 0.6) continue;
    b.set(x, y, t);
  }
  if (o.ruled) for (let y = y0 + o.ruled; y < y0 + h - 4; y += o.ruled) for (let x = x0 + 6; x < x0 + w - 6; x++) if (hash(x, y, 11) > 0.15) b.set(x, y, mix(b.get(x, y), H('#a8b8c8'), 0.35));
}

/** a strip of sticky tape (light, half-see-through: every other pixel) */
export function tape(b: PixelBuffer, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const base = b.get(x, y);
    const edge = (x === x0 || x === x0 + w - 1) && hash(x, y, 2) > 0.4;
    if (edge) continue;
    b.set(x, y, (x + y) & 1 ? mix(base || H('#e8e0c8'), H('#fffbea'), 0.55) : mix(base || H('#e8e0c8'), H('#d8d0b0'), 0.35));
  }
}
/** a brass drawing pin */
export function pin(b: PixelBuffer, x: number, y: number, col = '#c83a2a') {
  const c = H(col), l = shade(c, 0.3), d = shade(c, -0.35);
  for (const [i, j, k] of [[1, 0, 1], [2, 0, 1], [0, 1, 1], [1, 1, 2], [2, 1, 1], [3, 1, 0], [0, 2, 0], [1, 2, 1], [2, 2, 0], [3, 2, 0], [1, 3, 0], [2, 3, 0]]) b.set(x + i, y + j, k === 2 ? l : k === 1 ? c : d);
  b.set(x + 2, y + 4, INK.out);
}
/** an ink stamp: a double-ruled box with letters, a little worn */
export function stamp(b: PixelBuffer, text: string, x: number, y: number, col: C) {
  const w = pxWidth(text) + 8, h = 15;
  frame(b, x, y, w, h, col); frame(b, x + 2, y + 2, w - 4, h - 4, col);
  drawPx(b, text, x + 4, y + 1, col);
  // wear: knock a few pixels out
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (b.get(x + i, y + j) === col && hash(x + i, y + j, 13) > 0.86) b.set(x + i, y + j, mix(col, H('#ecdcb4'), 0.6));
  return w;
}

const HEART_F = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
/** a row of hearts: n0to10 in half hearts over `count` hearts */
export function hearts(b: PixelBuffer, x: number, y: number, half: number, count = 5) {
  const red = H('#d8343a'), redL = H('#ff8a8a'), redD = H('#8a1a20'), empty = H('#c0a880'), emptyD = H('#8a7454');
  for (let k = 0; k < count; k++) {
    const fill = Math.max(0, Math.min(2, half - k * 2));
    const ox = x + k * 9;
    HEART_F.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === '#') {
      const on = fill === 2 || (fill === 1 && i < 4);
      const edge = j === 0 || i === 0 || i === 6 || (j > 0 && r[i - 1] !== '#') || r[i + 1] !== '#' || j === HEART_F.length - 1 || HEART_F[j + 1]?.[i] !== '#';
      b.set(ox + i, y + j, on ? (edge ? redD : (i < 3 && j < 3 ? redL : red)) : (edge ? emptyD : empty));
    } });
  }
}
/** a small pixel icon from rows (k ink, a..d colours) */
export function icon(b: PixelBuffer, rows: string[], x: number, y: number, pal: Record<string, C>) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) b.set(x + i, y + j, c); } });
}

/** a pixel button: a coloured block with a 1px dark outline, a lit top edge, a darker lip; the label centred */
export function button(b: PixelBuffer, x: number, y: number, w: number, label: string, o: { tone?: 'green' | 'wood' | 'red' | 'gold'; hot?: boolean; down?: boolean; disabled?: boolean } = {}) {
  const T = { green: ['#1f3a1c', '#3f7a34', '#5aa447', '#8ed06a'], wood: ['#3a2010', '#6a3e1c', '#8a5628', '#c08a48'], red: ['#4a1008', '#8a2218', '#b8342a', '#e8704a'], gold: ['#5a3806', '#a87410', '#e0a818', '#ffe27a'] }[o.tone ?? 'wood'].map(c => H(c));
  const h = 15;
  const [c0, c1, c2, c3] = o.disabled ? T.map(c => mix(c, H('#8a8070'), 0.6)) : o.hot ? T.map(c => shade(c, 0.12)) : T;
  const dy = o.down ? 1 : 0;
  b.rect(x + 1, y + h - 1, w - 2, 1, INK.out);
  b.rect(x + 1, y + dy, w - 2, h - 1, INK.out); b.rect(x, y + 1 + dy, w, h - 3, INK.out);
  b.rect(x + 1, y + 1 + dy, w - 2, h - 3, c2);
  b.rect(x + 2, y + 1 + dy, w - 4, 1, c3); b.set(x + 1, y + 2 + dy, c3);
  b.rect(x + 1, y + h - 3 + dy, w - 2, 1, c1);
  if (!o.down) b.rect(x + 1, y + h - 2, w - 2, 1, c0);
  const tw = pxWidth(label);
  drawPx(b, label, x + Math.floor((w - tw) / 2), y + dy, o.disabled ? H('#d8d0c0') : INK.white, { shadow: c0 });
  return { x, y, w, h };
}
/** a recessed slot for an item */
export function slot(b: PixelBuffer, x: number, y: number, s: number, o: { sel?: boolean; hot?: boolean } = {}) {
  const rim = o.sel ? INK.gold : o.hot ? H('#c8a060') : H('#8a6a40');
  b.rect(x, y, s, s, INK.out);
  b.rect(x + 1, y + 1, s - 2, s - 2, rim);
  for (let j = 2; j < s - 2; j++) for (let i = 2; i < s - 2; i++) b.set(x + i, y + j, hash(x + i, y + j, 4) > 0.9 ? H('#5a3e20') : H('#4a3018'));
  b.rect(x + 2, y + 2, s - 4, 1, H('#2a1a0a'));
  if (o.sel) { b.rect(x + 1, y + 1, s - 2, 1, INK.goldL); b.rect(x + 1, y + 1, 1, s - 2, INK.goldL); }
}

// ------------------------------------------------------------------ the screen
export interface PixHit { id: string; x: number; y: number; w: number; h: number; act?: () => void }

let styled = false;
const CSS = `
.px11 { position: relative; line-height: 0; animation: px11In 0.24s steps(4) both; }
.px11 canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; cursor: default; touch-action: none; }
.px11 canvas.hot { cursor: pointer; }
@keyframes px11In { from { transform: translateY(16px); opacity: 0; } }
.modal.px11m { overflow: visible; background: none; border: 0; box-shadow: none; padding: 0; }
@media (prefers-reduced-motion: reduce) { .px11 { animation: none; } }
`;

export class PixScreen {
  readonly b: PixelBuffer;
  readonly cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private root: HTMLElement;
  private hits: PixHit[] = [];
  hover: string | null = null;
  private k = 1;
  private closeFn: (() => void) | null = null;
  private res: (() => void) | null = null;
  /** keys while open (return true when handled) */
  onKey: ((code: string) => boolean) | null = null;
  onClose: (() => void) | null = null;
  constructor(readonly W: number, readonly Hh: number, private paint: (s: PixScreen) => void) {
    if (!styled) { document.head.appendChild(el('style', '', CSS)); styled = true; }
    this.b = new PixelBuffer(W, Hh);
    this.root = el('div', 'px11');
    this.cv = document.createElement('canvas');
    this.cv.width = W; this.cv.height = Hh;
    this.g = this.cv.getContext('2d')!;
    this.root.appendChild(this.cv);
    this.cv.addEventListener('pointermove', e => this.move(e));
    this.cv.addEventListener('pointerdown', e => { e.stopPropagation(); this.move(e); const h = this.at(e); if (h?.act) { audio.play('ui', { vol: 0.4 }); h.act(); } });
    this.cv.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this.redraw(); } });
  }
  /** register a clickable box while painting */
  hit(id: string, x: number, y: number, w: number, h: number, act?: () => void) { this.hits.push({ id, x, y, w, h, act }); }
  isHot(id: string) { return this.hover === id; }
  text(t: string, x: number, y: number, c: C, o: PxOpts = {}) { return drawPx(this.b, t, x, y, c, o); }
  redraw() {
    this.hits = [];
    this.b.clear(0);
    this.paint(this);
    const img = new ImageData(new Uint8ClampedArray(this.b.bytes.buffer, this.b.bytes.byteOffset, this.b.bytes.byteLength).slice(), this.W, this.Hh);
    this.g.putImageData(img, 0, 0);
    this.cv.classList.toggle('hot', !!this.hits.find(h => h.id === this.hover && h.act));
  }
  private fit() {
    const R = game.ui.root.getBoundingClientRect();
    const k = Math.max(1, Math.floor(Math.min((R.width - 24) / this.W, (R.height - 24) / this.Hh)));
    this.k = k;
    this.cv.style.width = this.W * k + 'px';
    this.cv.style.height = this.Hh * k + 'px';
  }
  private pos(e: PointerEvent): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * this.W), Math.floor(((e.clientY - r.top) / r.height) * this.Hh)];
  }
  private at(e: PointerEvent): PixHit | null {
    const [x, y] = this.pos(e);
    for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) return h; }
    return null;
  }
  private move(e: PointerEvent) {
    const h = this.at(e);
    const id = h?.id ?? null;
    if (id !== this.hover) { this.hover = id; this.redraw(); }
  }
  private key = (e: KeyboardEvent) => {
    if (this.onKey?.(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  private resize = () => this.fit();
  open(): Promise<void> {
    return new Promise(res => {
      this.res = res;
      this.fit();
      this.redraw();
      this.closeFn = game.ui.modal(this.root, () => this.cleanup(), true);
      this.root.classList.add('px11m');
      window.addEventListener('keydown', this.key, true);
      window.addEventListener('resize', this.resize);
    });
  }
  close() { this.closeFn?.(); }
  private cleanup() {
    window.removeEventListener('keydown', this.key, true);
    window.removeEventListener('resize', this.resize);
    this.onClose?.();
    const r = this.res; this.res = null; r?.();
  }
}

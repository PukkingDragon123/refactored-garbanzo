// V11 HUD pixel helpers: every HUD widget is a small canvas painted in art pixels (bitmap text,
// Bresenham shapes, ordered dithering) and shown at a whole-number scale (3 CSS px per art pixel on
// desktop, 2 on phones and small windows), so the HUD is crisp pixel art whatever the fonts do.
//
//   hudScale()                     the current HUD pixel scale (2 or 3)
//   new PxW(parent, cls)           a widget canvas: w.draw(w, h, art => ...) repaints it (same size
//                                  reuses its buffer), w.el is the canvas, w.s the scale it's shown at
//   outlined(art, text, x, y, c, outline, o)   bitmap text with a 1 px outline all round
//   sky colours, dither helpers for gauges

import { Art, col, dith, shadeC, mixC } from './paper/px';
import { drawText, textWidth } from './paper/pxfont';
import type { TextOpts } from './paper/pxfont';

export function hudScale(): number {
  const w = window.innerWidth, h = window.innerHeight;
  if (w >= 2300 && h >= 1250) return 4;
  return w >= 1100 && h >= 640 ? 3 : 2;
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

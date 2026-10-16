// Pixel UI kit: painted pieces for the screens that live in pixel-art stages (Backpack, cooking, the
// recipe notebook, minigame overlays) and 9-slice frames for DOM screens. Everything is hard pixels:
// shadows are offset copies, gradients are bands mixed with an ordered dither, round things are pixel
// discs, and rotation (stamps) is nearest-neighbour.

import { PixelBuffer } from '../art/pixel';
import { hex, rgba, R, G, B, A } from '../art/color';
import type { C } from '../art/color';
import { pxTextBuf } from './pxfont';
import type { PxTextOpts, PxRun } from './pxfont';

export const H = (s: string, a = 255): C => hex(s, a);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** ordered-dither threshold 0..1 for a pixel */
export const dither = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** pick a colour from a ramp at t (0..1) with dithered steps between neighbours */
export function rampD(r: C[], t: number, x: number, y: number): C {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1), i = Math.floor(f);
  return f - i > dither(x, y) ? r[Math.min(r.length - 1, i + 1)] : r[i];
}
export const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** a buffer on a canvas, 1 canvas pixel per art pixel (CSS size = art size x scale) */
export function bufCanvas(b: PixelBuffer, cls = '', scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  if (cls) c.className = cls;
  c.getContext('2d', { willReadFrequently: true })?.putImageData(new ImageData(new Uint8ClampedArray(b.bytes), b.w, b.h), 0, 0);
  c.style.width = b.w * scale + 'px'; c.style.height = b.h * scale + 'px';
  c.style.imageRendering = 'pixelated';
  return c;
}
export function bufURL(b: PixelBuffer): string { return bufCanvas(b).toDataURL(); }

/** blit with alpha-over */
export function over(dst: PixelBuffer, src: PixelBuffer, x: number, y: number) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const c = src.data[j * src.w + i]; if (A(c)) dst.blend(x + i, y + j, c); }
}

/** text straight into a buffer (see pxfont) */
export function textInto(b: PixelBuffer, text: string | PxRun[], x: number, y: number, o: PxTextOpts = {}) {
  const t = pxTextBuf(text, o);
  over(b, t, x, y - 2);
  return t;
}

// ---------------------------------------------------------------- veils and backdrops

/** a dithered dark vignette (edges darker), in art px: no smooth gradient, just pixels on and off */
export function ditherVignette(w: number, h: number, o: { color?: string; inner?: number; outer?: number; max?: number; cx?: number; cy?: number } = {}): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const c = H(o.color ?? '#080602');
  const inner = o.inner ?? 0.35, outer = o.outer ?? 1.05, max = o.max ?? 0.75;
  const cx = (o.cx ?? 0.5) * w, cy = (o.cy ?? 0.55) * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x - cx) / (w * 0.5), (y - cy) / (h * 0.5));
    const t = Math.max(0, Math.min(1, (d - inner) / (outer - inner))) * max;
    if (t > dither(x, y)) b.set(x, y, c);
  }
  return b;
}

/** the frozen world behind a screen, as big soft-coloured pixels: the frame averaged down to w x h
 *  blocks, darkened toward a tint and quantised (show it with pixelated scaling at a whole number of
 *  device pixels per block: a pixel-art depth of field, no blur filter). null for a blank grab. */
export function mosaicBackdrop(src: HTMLCanvasElement, w: number, h: number, dim = 0.2, tint = '#0e0a04', vig: { cx?: number; cy?: number; inner?: number; outer?: number; max?: number } | null = { cx: 0.45, cy: 0.55, inner: 0.25, outer: 1.2, max: 0.5 }): HTMLCanvasElement | null {
  try {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    // box-average in two steps so it reads as colour, not noise
    const mid = document.createElement('canvas');
    mid.width = w * 3; mid.height = h * 3;
    const mg = mid.getContext('2d', { willReadFrequently: true })!;
    mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';
    mg.drawImage(src, 0, 0, mid.width, mid.height);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const og = out.getContext('2d', { willReadFrequently: true })!;
    og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(mid, 0, 0, w, h);
    const id = og.getImageData(0, 0, w, h), d = id.data;
    const c0 = ((h >> 1) * w + (w >> 1)) * 4;
    if (d[c0 + 3] === 0 || d[c0] + d[c0 + 1] + d[c0 + 2] === 0) return null;
    const t = H(tint);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      // darken toward the tint, more toward the edges in dithered steps
      let k = dim;
      if (vig) {
        const dd = Math.hypot((x / w - (vig.cx ?? 0.5)) * 2, (y / h - (vig.cy ?? 0.5)) * 2);
        const v = Math.max(0, Math.min(1, (dd - (vig.inner ?? 0.25)) / ((vig.outer ?? 1.2) - (vig.inner ?? 0.25)))) * 4;
        const step = Math.floor(v) + (v - Math.floor(v) > dither(x, y) ? 1 : 0);
        k = Math.min(0.92, k + step / 4 * (vig.max ?? 0.5));
      }
      for (let ch = 0; ch < 3; ch++) d[p + ch] = (d[p + ch] * (1 - k) + [R(t), G(t), B(t)][ch] * k) & 0xf8;
      d[p + 3] = 255;
    }
    og.putImageData(id, 0, 0);
    out.style.imageRendering = 'pixelated';
    return out;
  } catch { return null; }
}

// ---------------------------------------------------------------- painted widgets

export interface BtnPal { o: string; d: string; m: string; l: string; hi: string }
export const BTN: Record<string, BtnPal> = {
  wood: { o: '#1e1008', d: '#5a3618', m: '#7a4c24', l: '#9a6432', hi: '#c8925a' },
  paper: { o: '#4a3818', d: '#a8885a', m: '#c8a868', l: '#dcc080', hi: '#f2e2b0' },
  green: { o: '#14240e', d: '#2f5a22', m: '#4a8a34', l: '#6aaa48', hi: '#a8dc7a' },
  red: { o: '#2a0c08', d: '#7a2418', m: '#a8382a', l: '#c85a44', hi: '#f09a7a' },
  amber: { o: '#2a1804', d: '#9a6a10', m: '#d29c1c', l: '#f0bc3a', hi: '#fff0a0' },
  ink: { o: '#06080c', d: '#141c26', m: '#1e2a38', l: '#2c3c50', hi: '#4a6684' },
  teal: { o: '#06201c', d: '#1a5a50', m: '#2a8a78', l: '#3fbca6', hi: '#8ff0dc' },
};

/** a chunky pixel button: outline with clipped corners, a lit top lip, a dark bottom lip (thicker
 *  when not pressed: the button stands up off the surface) */
export function paintBtn(w: number, h: number, pal: BtnPal | string = 'wood', pressed = false): PixelBuffer {
  const p = typeof pal === 'string' ? BTN[pal] ?? BTN.wood : pal;
  const b = new PixelBuffer(w, h);
  const o = H(p.o), d = H(p.d), m = H(p.m), l = H(p.l), hi = H(p.hi);
  const lip = pressed ? 1 : 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.min(x, w - 1 - x), cy = Math.min(y, h - 1 - y);
    if (cx === 0 && cy === 0) continue;
    if (cx === 0 || cy === 0) { b.set(x, y, o); continue; }
    if (cx === 1 && cy === 1) { b.set(x, y, o); continue; }
    let c = m;
    if (y >= h - 1 - lip) c = d;
    else if (y === 1 + (pressed ? 1 : 0)) c = hi;
    else if (y === 2 + (pressed ? 1 : 0) || x === 1) c = l;
    else if (x === w - 2) c = d;
    b.set(x, y, c);
  }
  if (pressed) for (let x = 2; x < w - 2; x++) b.set(x, 1, d);
  return b;
}

/** a speech bubble: white card, 1px ink outline, a hard 1px shadow, a tail off the bottom-left
 *  (or top-left with tail: 'up') */
export function paintBubble(w: number, h: number, o: { tail?: 'down' | 'up' | 'none'; tailX?: number; fill?: string; ink?: string; shadow?: string } = {}): PixelBuffer {
  const tail = o.tail ?? 'down', tx = o.tailX ?? 8;
  const th = tail === 'none' ? 0 : 5;
  const b = new PixelBuffer(w + 1, h + th + 1);
  const ink = H(o.ink ?? '#0c0a0c'), fill = H(o.fill ?? '#ffffff'), sh = H(o.shadow ?? '#000000', 110);
  const y0 = tail === 'up' ? th : 0;
  const box = (ox: number, oy: number, c: C, f: C | null) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.min(x, w - 1 - x), cy = Math.min(y, h - 1 - y);
      if (cx === 0 && cy === 0) continue;
      const edge = cx === 0 || cy === 0;
      b.set(ox + x, oy + y, edge ? c : f ?? c);
    }
  };
  box(1, y0 + 1, sh, sh);
  box(0, y0, ink, fill);
  if (tail !== 'none') {
    for (let i = 0; i < th; i++) {
      const yy = tail === 'down' ? y0 + h - 1 + i : y0 - i;
      const x0 = tx, len = Math.max(1, th - i);
      for (let k = 0; k < len + 1; k++) b.set(x0 + k, yy, k === 0 || k === len ? ink : fill);
      if (i === th - 1) b.set(x0, yy, ink);
    }
  }
  return b;
}

/** a rubber stamp: the word in tiny caps inside an inked box, worn (missing pixels), turned by ang */
export function paintStamp(text: string, color: string, ang = -0.2, seed = 3): PixelBuffer {
  const t = pxTextBuf(text, { font: 'tiny', color, spacing: 1 });
  const w = t.w + 6, h = t.h + 3;
  const b = new PixelBuffer(w, h);
  const c = H(color);
  for (let x = 0; x < w; x++) { b.set(x, 0, c); b.set(x, h - 1, c); }
  for (let y = 0; y < h; y++) { b.set(0, y, c); b.set(w - 1, y, c); }
  over(b, t, 3, 0);
  // wear: knock out a few pixels
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (b.get(x, y) && hash(x, y, seed) > 0.86) b.set(x, y, 0);
  return ang ? skewSteps(b, ang) : b;
}

/** turn a small sprite by a few degrees with a stepped shear (columns shift a pixel at a time), so
 *  letters stay whole where nearest-neighbour rotation would chew them up */
export function skewSteps(src: PixelBuffer, ang: number): PixelBuffer {
  const k = Math.tan(ang);
  const extra = Math.ceil(Math.abs(k) * src.w) + 1;
  const out = new PixelBuffer(src.w, src.h + extra);
  for (let x = 0; x < src.w; x++) {
    const dy = Math.round((k < 0 ? (src.w - 1 - x) : x) * Math.abs(k));
    for (let y = 0; y < src.h; y++) { const c = src.data[y * src.w + x]; if (c) out.set(x, y + dy, c); }
  }
  return out;
}

/** nearest-neighbour rotation (keeps pixels hard) */
export function rotNN(src: PixelBuffer, ang: number): PixelBuffer {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const w = Math.ceil(Math.abs(src.w * ca) + Math.abs(src.h * sa)) + 2;
  const h = Math.ceil(Math.abs(src.w * sa) + Math.abs(src.h * ca)) + 2;
  const out = new PixelBuffer(w, h);
  const cx = src.w / 2, cy = src.h / 2, ox = w / 2, oy = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
    const sx = Math.floor(dx * ca + dy * sa + cx), sy = Math.floor(-dx * sa + dy * ca + cy);
    if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) out.data[y * w + x] = src.data[sy * src.w + sx];
  }
  return out;
}

/** a key cap with its label (keyboard hints) */
export function paintKey(label: string, o: { light?: boolean } = {}): PixelBuffer {
  const t = pxTextBuf(label, { font: label.length > 1 ? 'tiny' : 'bold', color: o.light ? '#2a2414' : '#2a2414' });
  const w = Math.max(9, t.w + 5), h = 11;
  const b = new PixelBuffer(w, h);
  const out = H('#120e07'), top = H('#fff6dc'), face = H('#e8d8b0'), side = H('#a8946a');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.min(x, w - 1 - x), cy = Math.min(y, h - 1 - y);
    if (cx === 0 && cy === 0) continue;
    if (cx === 0 || cy === 0) { b.set(x, y, out); continue; }
    b.set(x, y, y >= h - 3 ? side : y === 1 ? top : face);
  }
  over(b, t, Math.floor((w - t.w) / 2), label.length > 1 ? 1 : 0);
  return b;
}

/** a hint line: [key] words [key] words... as one sprite (keys in caps, words in the light hand) */
export function paintHint(parts: (string | { key: string })[], o: { color?: string; shadow?: string; gap?: number } = {}): PixelBuffer {
  const bits: PixelBuffer[] = parts.map(p => typeof p === 'string' ? pxTextBuf(p, { color: o.color ?? '#fff6dc', shadow: o.shadow ?? '#0a0806' }) : paintKey(p.key));
  const gap = o.gap ?? 3;
  const w = bits.reduce((s, b) => s + b.w + gap, 0) - gap, h = Math.max(...bits.map(b => b.h), 11);
  const out = new PixelBuffer(Math.max(1, w), h);
  let x = 0;
  bits.forEach(b => { over(out, b, x, Math.floor((h - b.h) / 2)); x += b.w + gap; });
  return out;
}

/** a round pixel button (a disc with an outline and a lit rim) */
export function paintDisc(r: number, pal: BtnPal | string = 'ink'): PixelBuffer {
  const p = typeof pal === 'string' ? BTN[pal] ?? BTN.ink : pal;
  const d = r * 2 + 1;
  const b = new PixelBuffer(d, d + 1);
  b.disc(r, r + 1, r, H(p.o));
  b.disc(r, r, r, H(p.o));
  b.disc(r, r, r - 1, H(p.d));
  b.disc(r, r - 1, r - 2, H(p.m));
  for (let x = -2; x <= 2; x++) b.set(r + x, 2, H(p.hi));
  return b;
}

/** 9-slice CSS for a painted frame: `border` art px of edge, shown at `k` screen px per art px */
export function nineSlice(b: PixelBuffer, border: number, k: number, fill = true): string {
  const url = bufURL(b);
  return `border-style:solid;border-width:${border * k}px;border-image:url(${url}) ${border}${fill ? ' fill' : ''} / ${border * k}px / 0 stretch;image-rendering:pixelated;`;
}

/** a flat colour with a hard pixel edge for CSS (used for gauges etc.) */
export const css = (c: C) => `rgba(${R(c)},${G(c)},${B(c)},${(A(c) / 255).toFixed(3)})`;
export { rgba };

// Ship pixel kit: small raster helpers for the V4 Kittiwake interiors. Every object is painted
// into its own buffer with flat 3-4 tone cel shading, then stamped onto the room with a dark
// outline (same "clean sticker" look as the anime cast), so rooms read clearly even when dim.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, rgba, C } from '../color';
import { tones } from '../portrait/kit';

export type Tone = [C, C, C, C];
export const T = (h: string, o: Parameters<typeof tones>[1] = {}): Tone => tones(h, o) as Tone;
export { hex, mix, shade, rgba };
export type { C };

export const P = {
  plank: T('#6e4c32', { sh: 0.16, deep: 0.34, hi: 0.1 }),
  plankD: T('#56392a', { sh: 0.16, deep: 0.32, hi: 0.1 }),
  cream: T('#a89a7c', { sh: 0.14, deep: 0.3, hi: 0.1 }),
  floor: T('#5e4028', { sh: 0.14, deep: 0.3, hi: 0.12 }),
  beam: T('#4a3222', { sh: 0.16, deep: 0.34 }),
  brass: T('#c8a048', { sh: 0.18, deep: 0.36, hi: 0.16 }),
  steel: T('#6a7a80', { sh: 0.18, deep: 0.36, hi: 0.14 }),
  dark: T('#3a3640', { sh: 0.16, deep: 0.3, hi: 0.14 }),
  engine: T('#3e6a4a', { sh: 0.18, deep: 0.36, hi: 0.14 }),
  red: T('#b0443a', { sh: 0.18, deep: 0.36, hi: 0.12 }),
  navy: T('#2e3c5c', { sh: 0.18, deep: 0.34, hi: 0.14 }),
  olive: T('#5e6e3c', { sh: 0.16, deep: 0.32 }),
  orange: T('#d0642a', { sh: 0.16, deep: 0.32 }),
  pink: T('#e876a8', { sh: 0.16, deep: 0.3 }),
  lav: T('#9a88d0', { sh: 0.16, deep: 0.3 }),
  white: T('#e8e2d4', { sh: 0.12, deep: 0.28 }),
  paper: T('#e8dcb8', { sh: 0.12, deep: 0.26 }),
  green: T('#4a7a44', { sh: 0.16, deep: 0.32 }),
  leaf: T('#5a8a3a', { sh: 0.18, deep: 0.34, hi: 0.12 }),
  blue: T('#3a78c0', { sh: 0.16, deep: 0.3 }),
  teal: T('#3a9a9a', { sh: 0.16, deep: 0.3 }),
  glass: T('#6aa0b8', { sh: 0.14, deep: 0.3, hi: 0.2 }),
  water: T('#3a7a90', { sh: 0.16, deep: 0.3, hi: 0.2 }),
  yellow: T('#e8b840', { sh: 0.16, deep: 0.3 }),
  rope: T('#b89a64', { sh: 0.16, deep: 0.32 }),
  canvas: T('#b0a078', { sh: 0.14, deep: 0.3 }),
  rust: T('#8a4a2a', { sh: 0.16, deep: 0.3 }),
  fawn: T('#e4b87c', { sh: 0.14, deep: 0.3 }),
  black: T('#2a2630', { sh: 0.1, deep: 0.2, hi: 0.2 }),
};
export const OUTLINE = hex('#1a1014');

/** A tiny paint surface for one object (x right, y down, object-local pixels). */
export class Obj {
  readonly b: PixelBuffer;
  constructor(readonly w: number, readonly h: number) {
    this.b = new PixelBuffer(w, h);
  }
  px(x: number, y: number, c: C) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.b.data[y * this.w + x] = c;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.b.data[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: C | ((x: number, y: number) => C | -1)) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++)
      for (let i = Math.floor(x); i < Math.floor(x + w); i++) {
        const v = typeof c === 'function' ? c(i - Math.floor(x), j - Math.floor(y)) : c;
        if (v !== -1) this.px(i, j, v);
      }
  }
  /** box with flat shading: light top edge, shadow right/bottom, deep bottom line */
  box(x: number, y: number, w: number, h: number, t: Tone, o: { top?: boolean; bevel?: boolean } = {}) {
    this.rect(x, y, w, h, (i, j) => {
      if (j === h - 1) return t[0];
      if (o.top !== false && j === 0) return t[3];
      if (i === w - 1 || j >= h - 2) return t[1];
      if (o.bevel && i === 0) return t[3];
      return t[2];
    });
  }
  hline(x0: number, x1: number, y: number, c: C) { for (let x = Math.floor(x0); x <= Math.floor(x1); x++) this.px(x, y, c); }
  vline(x: number, y0: number, y1: number, c: C) { for (let y = Math.floor(y0); y <= Math.floor(y1); y++) this.px(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: C) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let g = 0; g < 2000; g++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: C | ((nx: number, ny: number) => C | -1)) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const v = typeof c === 'function' ? c(nx, ny) : c;
        if (v !== -1) this.px(x, y, v);
      }
  }
  /** sphere-ish shaded ellipse from a tone (light top-left) */
  ball(cx: number, cy: number, rx: number, ry: number, t: Tone) {
    this.ell(cx, cy, rx, ry, (nx, ny) => {
      const l = -nx * 0.45 - ny * 0.7;
      return l > 0.5 ? t[3] : l > -0.25 ? t[2] : l > -0.7 ? t[1] : t[0];
    });
  }
  poly(pts: number[], c: C | ((x: number, y: number) => C | -1)) {
    let y0 = 1e9, y1 = -1e9;
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
    const n = pts.length / 2;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5, xs: number[] = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          const v = typeof c === 'function' ? c(x, y) : c;
          if (v !== -1) this.px(x, y, v);
        }
    }
  }
  /** stamp another object buffer (already outlined) */
  put(o: PixelBuffer, x: number, y: number) {
    for (let j = 0; j < o.h; j++)
      for (let i = 0; i < o.w; i++) {
        const v = o.data[j * o.w + i];
        if (v >>> 24) this.px(x + i, y + j, v);
      }
  }
  /** add a dark outline around the silhouette (in place, grows by 1px into empty pixels) */
  outline(k = 0.62) {
    const W = this.w, H = this.h, src = this.b.data.slice();
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && src[y * W + x] >>> 24 > 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (src[y * W + x] >>> 24) continue;
        let nb = -1;
        if (op(x + 1, y)) nb = y * W + x + 1;
        else if (op(x - 1, y)) nb = y * W + x - 1;
        else if (op(x, y + 1)) nb = (y + 1) * W + x;
        else if (op(x, y - 1)) nb = (y - 1) * W + x;
        if (nb >= 0) this.b.data[y * W + x] = mix(shade(src[nb], -0.75), OUTLINE, k);
      }
    return this;
  }
}

/** Paint an object with a 1px padding for its outline; returns the outlined buffer and the pad. */
export function obj(w: number, h: number, draw: (o: Obj) => void, outline = true): PixelBuffer {
  const o = new Obj(w + 2, h + 2);
  const inner = new Obj(w, h);
  draw(inner);
  o.put(inner.b, 1, 1);
  if (outline) o.outline();
  return o.b;
}

/** Stamp an object buffer onto a room buffer so its (pad-adjusted) top-left lands at (x, y). */
export function stamp(dst: PixelBuffer, src: PixelBuffer, x: number, y: number) {
  x = Math.round(x) - 1; y = Math.round(y) - 1;
  for (let j = 0; j < src.h; j++) {
    const Y = y + j;
    if (Y < 0 || Y >= dst.h) continue;
    for (let i = 0; i < src.w; i++) {
      const X = x + i;
      if (X < 0 || X >= dst.w) continue;
      const v = src.data[j * src.w + i];
      if (v >>> 24) dst.data[Y * dst.w + X] = v;
    }
  }
}

/** darken a region toward its corners and ceiling (baked ambient occlusion / dark corners), in 3 soft bands */
export function vignetteRect(b: PixelBuffer, x0: number, y0: number, w: number, h: number, k = 0.42, edge = 26) {
  const E = Math.max(6, edge * 0.45);
  for (let y = Math.max(0, y0); y < Math.min(b.h, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(b.w, x0 + w); x++) {
      const i = y * b.w + x;
      const v = b.data[i];
      if (!(v >>> 24)) continue;
      const dx = Math.min(x - x0, x0 + w - 1 - x) / E;
      const dt = (y - y0) / (E * 1.3), db = (y0 + h - 1 - y) / (E * 2.2);
      // corners get the product of both falloffs; edges a lighter touch
      const ex = Math.max(0, 1 - dx), ey = Math.max(0, 1 - Math.min(dt, db));
      const t = Math.max(ex * 0.55, ey * 0.7, ex * ey * 1.2);
      if (t <= 0.05) continue;
      const s = Math.min(1, Math.ceil(t * 3) / 3);
      // ordered dither between bands keeps the step edges from reading as rectangles
      const dither = ((x + y * 2) % 4) / 4 - 0.375;
      b.data[i] = shade(v, -k * Math.max(0, Math.min(1, s + dither * 0.34)));
    }
}

export const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};

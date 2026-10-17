// Physical UI kit: sketches, as pixel art. Turns the game's pixel sprites (and photos) into
// field-journal drawings at pixel resolution: a pencil contour one pixel outside the silhouette
// (broken here and there, gone over twice in places), softer feature lines where the colours change
// inside, diagonal pixel hatching in the shadows (cross-hatched in the darkest parts) and a
// watercolour wash quantised to a few pale tones, dithered and a pixel off-register, pooled darker
// at its rim. Plus little ink doodles (boat, tent, palm, fish, crab, camera, Chunk...) for margins.
//
//   sketchImg(src, o, cls)          -> a canvas that draws the sketch at a whole-number scale in its box
//   await sketchURL(src, o)         -> data URL of the drawing (2 CSS px per art pixel)
//   sketchCanvas(img, o)            -> the drawing at art resolution, synchronously
//   doodle('tent', { size: '3em' }) -> a hand-drawn doodle (pixel ink)
//
// Styles: 'pencil' (graphite + wash), 'ink' (dip-pen lines, no wash), 'blueprint' (white lines for
// blueprint paper), 'chalk' (pale lines for dark boards).

import { hash2, clamp01, hashStr, fbm } from './rng';
import { svgInk, roughLine, roughEllipse, roughCurve, roughRect, INK, PENCIL } from './ink';
import type { Stroke } from './ink';
import { Art, PX, pxCanvas, keyOf, dith, packRGBA, bayer } from './px';

export type SketchStyle = 'pencil' | 'ink' | 'blueprint' | 'chalk';
export interface SketchOpts {
  style?: SketchStyle;
  /** (kept for callers: the drawing's detail now follows the source's own pixels) */
  size?: number;
  /** watercolour wash strength 0..1 (pencil default 0.62, others 0) */
  wash?: number;
  /** hatching strength 0..1 (default 0.6) */
  hatch?: number;
  /** a crop of the source in 0..1 [x0, y0, x1, y1] (photos) */
  crop?: [number, number, number, number];
  /** treat the source as a photo (no alpha: find edges in the colours) */
  photo?: boolean;
  seed?: number;
}

const LINE: Record<SketchStyle, [number, number, number]> = {
  pencil: [62, 58, 54], ink: [34, 30, 52], blueprint: [236, 246, 255], chalk: [246, 240, 226],
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('sketch: image failed'));
    im.src = src;
  });
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
const artCache = new Map<string, Promise<Art | null>>();
const urlDone = new Map<string, string>();
const srcKey = (src: string) => `${src.length}:${hashStr(src.length > 4000 ? src.slice(0, 2000) + src.slice(-2000) : src)}`;
function sketchKey(src: string, o: SketchOpts, maxW = 0, maxH = 0) {
  return `${o.style ?? 'pencil'}|${o.wash ?? ''}|${o.hatch ?? ''}|${o.crop?.join(',') ?? ''}|${o.photo ? 1 : 0}|${o.seed ?? 0}|${maxW}x${maxH}|${srcKey(src)}`;
}
/** the sketch as an art buffer (cached), fitted under maxW x maxH art px when given */
function sketchArt(src: string, o: SketchOpts, maxW = 0, maxH = 0): Promise<Art | null> {
  const key = sketchKey(src, o, maxW, maxH);
  let p = artCache.get(key);
  if (!p) {
    let ip = imgCache.get(src);
    if (!ip) { ip = loadImage(src); imgCache.set(src, ip); if (imgCache.size > 300) imgCache.delete(imgCache.keys().next().value!); }
    p = ip.then(im => sketchArtOf(im, o, maxW, maxH)).catch(() => null);
    artCache.set(key, p);
    if (artCache.size > 600) artCache.delete(artCache.keys().next().value!);
  }
  return p;
}

/** the sketch of an image as a data URL (cached; resolves '' if the image can't be read) */
export function sketchURL(src: string, o: SketchOpts = {}): Promise<string> {
  const key = sketchKey(src, o);
  return sketchArt(src, o).then(a => { const u = a ? a.url(PX) : ''; urlDone.set(key, u); return u; });
}
/** a sketch that has already been made (or '') */
export function sketchReady(src: string, o: SketchOpts = {}): string { return urlDone.get(sketchKey(src, o)) ?? ''; }

/**
 * A sketch for page HTML in a fixed box, so page layout never depends on when the drawing is ready:
 * `box` is [width, height] in CSS units (default full width at 4:3). The canvas draws the sketch at
 * the biggest whole-number scale that fits, centred, once it's on the page.
 */
export function sketchImg(src: string, o: SketchOpts & { box?: [string, string] } = {}, cls = '', style = ''): string {
  if (!src) return '';
  const [bw, bh] = o.box ?? ['100%', 'auto'];
  const size = `width:${bw};${bh === 'auto' ? 'aspect-ratio:4/3' : `height:${bh}`};`;
  const key = 'sk:' + keyOf(sketchKey(src, o));
  return pxCanvas(key, async (a, w, h) => {
    const sk = await sketchArt(src, o, 0, 0);
    if (!sk) return;
    let art: Art | null = sk;
    if (sk.w > w || sk.h > h) art = await sketchArt(src, o, w, h);
    if (!art) return;
    const k = Math.max(1, Math.floor(Math.min(w / art.w, h / art.h)));
    const ox = Math.floor((w - art.w * k) / 2), oy = Math.floor((h - art.h * k) / 2);
    for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
      const c = art.d[y * art.w + x];
      if (!(c >>> 24)) continue;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) a.put(ox + x * k + i, oy + y * k + j, c);
    }
  }, { cls: `pp-sk ${cls}`, style: size + style, async: true });
}
/** (sketch canvases paint themselves; kept for callers) */
export function fillSketches(_root: ParentNode) { /* nothing to do */ }

/** the size of one art pixel in a nearest-neighbour upscaled sprite (speciesSprite is 3x) */
function pixelScale(d: Uint8ClampedArray, w: number, h: number): number {
  for (const k of [4, 3, 2]) {
    if (w % k || h % k) continue;
    let ok = true;
    for (let y = 0; y < h && ok; y++) {
      const by = y - (y % k);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, j = (by * w + (x - (x % k))) * 4;
        if (d[i + 3] !== d[j + 3] || (d[i + 3] && (d[i] !== d[j] || d[i + 1] !== d[j + 1] || d[i + 2] !== d[j + 2]))) { ok = false; break; }
      }
    }
    if (ok) return k;
  }
  return 1;
}

/** EPX / Scale2x: doubles pixel art, rounding off diagonal staircases but keeping thin features */
function scale2x(src: Uint32Array, w: number, h: number): [Uint32Array, number, number] {
  const W = w * 2, H = h * 2;
  const out = new Uint32Array(W * H);
  const at = (x: number, y: number) => src[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A;
    if (A === B && A !== C && B !== D) e1 = B;
    if (D === C && D !== B && C !== A) e2 = C;
    if (B === D && B !== A && D !== C) e3 = D;
    const o = 2 * y * W + 2 * x;
    out[o] = e0; out[o + 1] = e1; out[o + W] = e2; out[o + W + 1] = e3;
  }
  return [out, W, H];
}

/** draw the sketch of an already-loaded image or canvas (at art resolution) */
export function sketchCanvas(src: CanvasImageSource & { width: number; height: number }, o: SketchOpts = {}): HTMLCanvasElement {
  return sketchArtOf(src, o).canvas();
}

function sketchArtOf(src: CanvasImageSource & { width: number; height: number }, o: SketchOpts, maxW = 0, maxH = 0): Art {
  const style = o.style ?? 'pencil';
  const seed = o.seed ?? 7;
  const crop = o.crop ?? [0, 0, 1, 1];
  const sw0 = (src as HTMLImageElement).naturalWidth || src.width, sh0 = (src as HTMLImageElement).naturalHeight || src.height;
  const cx0 = Math.floor(crop[0] * sw0), cy0 = Math.floor(crop[1] * sh0);
  const cw = Math.max(2, Math.floor((crop[2] - crop[0]) * sw0)), ch = Math.max(2, Math.floor((crop[3] - crop[1]) * sh0));
  // ---- the source at one pixel per art pixel (photos scaled to a working size)
  let w0: number, h0: number, px: Uint32Array;
  const g0c = document.createElement('canvas');
  if (o.photo) {
    const target = maxW && maxH ? Math.min(maxW / cw, maxH / ch) : Math.min(1, 96 / Math.max(cw, ch));
    w0 = Math.max(2, Math.round(cw * target)); h0 = Math.max(2, Math.round(ch * target));
    g0c.width = w0; g0c.height = h0;
    const g0 = g0c.getContext('2d', { willReadFrequently: true })!;
    g0.imageSmoothingEnabled = true;
    g0.drawImage(src, cx0, cy0, cw, ch, 0, 0, w0, h0);
    px = new Uint32Array(g0.getImageData(0, 0, w0, h0).data.slice().buffer);
  } else {
    g0c.width = cw; g0c.height = ch;
    const g0 = g0c.getContext('2d', { willReadFrequently: true })!;
    g0.imageSmoothingEnabled = false;
    g0.drawImage(src, cx0, cy0, cw, ch, 0, 0, cw, ch);
    const full = g0.getImageData(0, 0, cw, ch).data;
    let k = pixelScale(full, cw, ch);
    // too big for the box: sample coarser (every k-th pixel)
    if (maxW && maxH) while (Math.round(cw / k) + 6 > maxW || Math.round(ch / k) + 6 > maxH) k++;
    w0 = Math.max(1, Math.round(cw / k)); h0 = Math.max(1, Math.round(ch / k));
    px = new Uint32Array(w0 * h0);
    const f32 = new Uint32Array(full.slice().buffer);
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      const v = f32[Math.min(ch - 1, y * k) * cw + Math.min(cw - 1, x * k)];
      px[y * w0 + x] = (v >>> 24) < 128 ? 0 : (v | 0xff000000) >>> 0;
    }
    // small sprites get one EPX doubling so the pencil has room for curves
    const room = !maxW || ((w0 * 2 + 6) <= maxW && (h0 * 2 + 6) <= maxH);
    if (Math.max(w0, h0) <= 100 && room) [px, w0, h0] = scale2x(px, w0, h0);
  }
  const N = w0 * h0;
  const A = new Uint8Array(N), L = new Float32Array(N);
  let ls = 0, ln = 0;
  for (let i = 0; i < N; i++) {
    const v = px[i];
    A[i] = o.photo ? 1 : (v >>> 24) > 0 ? 1 : 0;
    L[i] = (0.3 * (v & 255) + 0.59 * ((v >>> 8) & 255) + 0.11 * ((v >>> 16) & 255)) / 255;
    if (A[i]) { ls += L[i]; ln++; }
  }
  const meanL = ln ? ls / ln : 0.5;
  const pad = o.photo ? 0 : 3;
  const W = w0 + pad * 2, H = h0 + pad * 2;
  const out = new Art(W, H);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w0 && y < h0 && A[y * w0 + x] === 1;
  const [lr, lg, lb] = LINE[style];
  const line = packRGBA(lr, lg, lb, 255), soft = packRGBA(lr, lg, lb, 165);
  // ---- watercolour wash: pale, desaturated, a pixel off-register, quantised and dithered
  const washK = o.wash ?? (style === 'pencil' ? 0.62 : 0);
  if (washK > 0) {
    const dx = hash2(seed, 1) > 0.5 ? 1 : -1, dy = hash2(seed, 2) > 0.5 ? 1 : 0;
    const q = (c: number) => Math.min(255, Math.round(c / 24) * 24);
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      if (!on(x, y)) continue;
      const v = px[y * w0 + x];
      let r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
      const l = (r + g + b) / 3;
      r = 255 - (255 - (l + (r - l) * 0.85)) * 0.6; g = 255 - (255 - (l + (g - l) * 0.85)) * 0.6; b = 255 - (255 - (l + (b - l) * 0.85)) * 0.6;
      const X = x + pad + dx, Y = y + pad + dy;
      const rim = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      const n = fbm(x / 9, y / 9, seed + 3, 2);
      const cov = washK * clamp01(0.45 + n * 0.75);
      if (rim) out.px(X, Y, packRGBA(q(r * 0.86), q(g * 0.86), q(b * 0.86), 255));
      else if (dith(X, Y, cov)) out.px(X, Y, packRGBA(q(r), q(g), q(b), 255));
    }
  }
  // ---- feature lines inside, where the colours change sharply
  const thr = o.photo ? 0.14 : 0.16;
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
    if (!on(x, y)) continue;
    const l = L[y * w0 + x];
    const r = on(x + 1, y) ? L[y * w0 + x + 1] : l, d = on(x, y + 1) ? L[(y + 1) * w0 + x] : l;
    if ((l < r - thr || l < d - thr || (o.photo && (r < l - thr || d < l - thr))) && hash2(x, y, seed + 5) > 0.2) out.px(x + pad, y + pad, o.photo ? line : soft);
  }
  // ---- hatching in the shadows (diagonals, crossed in the darkest parts)
  const hatchK = o.hatch ?? (style === 'blueprint' ? 0.3 : 0.6);
  if (hatchK > 0) for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
    if (!on(x, y)) continue;
    const dark = meanL - L[y * w0 + x];
    const X = x + pad, Y = y + pad;
    const wob = Math.round((fbm(X / 14, Y / 14, seed + 21, 2) - 0.5) * 3);
    const d1 = ((X + Y + wob) % 4 + 4) % 4 === 0, d2 = ((X - Y + wob) % 5 + 5) % 5 === 0;
    if ((d1 && dark > 0.05 && hash2(X, Y, seed) < hatchK + 0.15) || (d2 && dark > 0.2 && hash2(X, Y, seed + 1) < hatchK)) out.px(X, Y, soft);
  }
  if (!o.photo) {
    // ---- the contour: a pencil line one pixel outside the silhouette, broken now and then
    for (let y = -1; y <= h0; y++) for (let x = -1; x <= w0; x++) {
      if (on(x, y)) continue;
      const nb = on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1);
      if (!nb) continue;
      const brk = fbm((x + pad) / 7, (y + pad) / 7, seed + 11, 2);
      if (brk < 0.26 && hash2(x, y, seed + 3) < 0.6) continue;
      out.px(x + pad, y + pad, brk < 0.36 ? soft : line);
      // a second pass a pixel off in places (a quick pencil going round twice)
      if (brk > 0.7 && hash2(x, y, seed + 4) < 0.3) out.px(x + pad + 1, y + pad - 1, soft);
    }
  } else {
    // photos: pencil tone from the luminance, ordered-dithered
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      const dark = clamp01((0.62 - L[y * w0 + x]) * 1.6);
      if (dark > bayer(x, y) + 0.12) out.px(x, y, soft);
    }
  }
  return out;
}

// ---------------------------------------------------------------- doodles

type DoodleFn = (s: number) => Stroke[];
const L = (x1: number, y1: number, x2: number, y2: number, seed = 1) => roughLine(x1, y1, x2, y2, { seed, double: false, rough: 1 });
const E = (cx: number, cy: number, rx: number, ry: number, seed = 1) => roughEllipse(cx, cy, rx, ry, { seed, double: false, rough: 1.2 });
const C = (pts: [number, number][], seed = 1) => roughCurve(pts, { seed, rough: 0.8 });

/** little margin drawings in a 100 x 100 box */
export const DOODLES: Record<string, DoodleFn> = {
  boat: () => [
    { d: C([[12, 62], [26, 76], [74, 76], [90, 60]]) + L(12, 62, 90, 60, 2) },
    { d: L(48, 60, 48, 14, 3) + C([[50, 16], [72, 34], [52, 54]], 4) + C([[46, 20], [28, 40], [46, 54]], 5) },
    { d: C([[4, 84], [20, 80], [36, 86], [52, 81], [68, 86], [84, 81], [98, 85]], 6), c: '#26408a' },
  ],
  tent: () => [
    { d: L(10, 80, 50, 18, 1) + L(50, 18, 90, 80, 2) + L(6, 80, 94, 80, 3) },
    { d: L(50, 18, 46, 80, 4) + C([[50, 40], [40, 64], [36, 80]], 5) },
    { d: L(50, 18, 56, 8, 6) },
  ],
  palm: () => [
    { d: C([[52, 92], [48, 70], [50, 46], [56, 28]]) + C([[60, 92], [55, 70], [57, 46], [60, 28]], 2) },
    { d: C([[58, 28], [40, 20], [18, 30]], 3) + C([[58, 28], [70, 14], [90, 18]], 4) + C([[58, 28], [78, 30], [92, 46]], 5) + C([[58, 28], [44, 34], [30, 52]], 6) + C([[58, 28], [56, 12], [44, 4]], 7) },
    { d: E(58, 30, 4, 3, 8), fill: INK },
  ],
  fish: () => [
    { d: C([[14, 50], [36, 30], [64, 32], [78, 50], [64, 68], [36, 70], [14, 50]]) },
    { d: L(78, 50, 94, 36, 2) + L(94, 36, 92, 66, 3) + L(92, 66, 78, 50, 4) },
    { d: E(30, 46, 2.5, 2.5, 5), fill: INK },
    { d: C([[44, 36], [48, 50], [44, 64]], 6), opacity: 0.6 },
  ],
  crab: () => [
    { d: E(50, 58, 24, 14, 1) },
    { d: C([[30, 50], [18, 36], [22, 24]], 2) + C([[70, 50], [82, 36], [78, 24]], 3) + E(22, 22, 7, 5, 4) + E(78, 22, 7, 5, 5) },
    { d: L(30, 64, 14, 76, 6) + L(34, 68, 22, 84, 7) + L(70, 64, 86, 76, 8) + L(66, 68, 78, 84, 9) },
    { d: L(44, 46, 42, 36, 10) + L(56, 46, 58, 36, 11) + E(42, 34, 2, 2, 12) + E(58, 34, 2, 2, 13) },
  ],
  camera: () => [
    { d: roughRect(14, 34, 72, 44, { seed: 1, double: false }) + L(30, 34, 36, 24, 2) + L(36, 24, 56, 24, 3) + L(56, 24, 62, 34, 4) },
    { d: E(50, 56, 15, 15, 5) + E(50, 56, 8, 8, 6) },
    { d: roughRect(72, 40, 8, 5, { seed: 7, double: false }) },
  ],
  sun: () => [
    { d: E(50, 50, 16, 16, 1) },
    { d: Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return L(50 + Math.cos(a) * 24, 50 + Math.sin(a) * 24, 50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36, 2 + i); }).join('') },
  ],
  wave: () => [
    { d: C([[4, 60], [18, 40], [34, 36], [44, 48], [36, 58], [28, 50]]) + C([[44, 48], [60, 62], [78, 52], [96, 58]], 2), c: '#26408a' },
    { d: C([[4, 76], [24, 70], [44, 78], [64, 70], [84, 78], [96, 72]], 3), c: '#26408a' },
  ],
  pug: () => [
    { d: E(50, 54, 30, 26, 1) },
    { d: C([[24, 40], [14, 30], [20, 52]], 2) + C([[76, 40], [86, 30], [80, 52]], 3) },
    { d: E(38, 48, 5, 5, 4) + E(62, 48, 5, 5, 5), fill: INK },
    { d: E(50, 62, 9, 6, 6), fill: '#3a3030' },
    { d: C([[42, 70], [50, 76], [58, 70]], 7) + C([[40, 36], [50, 32], [60, 36]], 8) },
  ],
  footprints: () => [
    ...[[20, 80, -0.3], [40, 62, 0.25], [56, 44, -0.3], [76, 24, 0.25]].map(([x, y], i) => ({ d: E(x, y, 6, 9, i + 1) + E(x - 5, y - 13, 2, 2, i + 9) + E(x, y - 15, 2, 2, i + 19) + E(x + 5, y - 13, 2, 2, i + 29) })),
  ],
  pin: () => [
    { d: C([[50, 92], [30, 56], [30, 30], [50, 14], [70, 30], [70, 56], [50, 92]]) },
    { d: E(50, 38, 9, 9, 2) },
  ],
  star: () => [
    { d: C([[50, 10], [60, 38], [90, 40], [66, 58], [76, 88], [50, 70], [24, 88], [34, 58], [10, 40], [40, 38], [50, 10]]) },
  ],
  mountain: () => [
    { d: L(4, 84, 36, 30, 1) + L(36, 30, 56, 58, 2) + L(56, 58, 70, 40, 3) + L(70, 40, 96, 84, 4) + L(4, 84, 96, 84, 5) },
    { d: C([[28, 44], [36, 50], [44, 42]], 6) },
  ],
  fire: () => [
    { d: C([[50, 80], [34, 64], [40, 44], [50, 30], [52, 46], [62, 40], [64, 60], [50, 80]]) },
    { d: C([[50, 76], [44, 66], [48, 56], [54, 64], [50, 76]], 2), c: '#a8321e' },
    { d: L(26, 86, 74, 78, 3) + L(26, 78, 74, 88, 4) },
  ],
  bird: () => [
    { d: C([[10, 50], [26, 38], [42, 48]]) + C([[42, 48], [60, 34], [80, 44]], 2) },
    { d: C([[56, 64], [64, 58], [72, 62]], 3) + C([[72, 62], [80, 56], [88, 60]], 4), opacity: 0.7 },
  ],
  shell: () => [
    { d: C([[50, 84], [16, 56], [24, 26], [50, 16], [76, 26], [84, 56], [50, 84]]) },
    { d: L(50, 84, 32, 30, 2) + L(50, 84, 50, 20, 3) + L(50, 84, 68, 30, 4) + L(50, 84, 22, 46, 5) + L(50, 84, 78, 46, 6) },
  ],
  leaf: () => [
    { d: C([[14, 86], [24, 40], [60, 16], [88, 12], [80, 46], [50, 76], [14, 86]]) },
    { d: C([[14, 86], [46, 50], [86, 14]], 2) + L(36, 62, 30, 46, 3) + L(52, 46, 46, 30, 4) + L(44, 56, 60, 58, 5) },
  ],
  compass: () => [
    { d: E(50, 50, 34, 34, 1) },
    { d: L(50, 18, 58, 50, 2) + L(58, 50, 50, 82, 3) + L(50, 82, 42, 50, 4) + L(42, 50, 50, 18, 5) },
    { d: L(50, 18, 58, 50, 6) + L(58, 50, 42, 50, 7) + L(42, 50, 50, 18, 8), fill: '#a8321e', c: '#a8321e' },
  ],
  feather: () => [
    { d: C([[20, 88], [40, 60], [62, 34], [86, 10]]) },
    { d: C([[30, 74], [36, 46], [60, 24], [86, 10]], 2) + C([[30, 74], [56, 70], [74, 46], [86, 10]], 3) },
  ],
  magnifier: () => [
    { d: E(40, 40, 24, 24, 1) },
    { d: L(58, 58, 88, 88, 2) + L(62, 56, 90, 84, 3) },
    { d: C([[26, 32], [32, 24], [42, 22]], 4), opacity: 0.6 },
  ],
};

/** a doodle as inline SVG */
export function doodle(name: string, o: { size?: string; color?: string; pencil?: boolean; draw?: number; cls?: string; seed?: number; style?: string } = {}): string {
  const fn = DOODLES[name] ?? DOODLES.star;
  const strokes = fn(o.seed ?? 1).map(s => ({ ...s, c: s.c ?? o.color ?? (o.pencil ? PENCIL : INK), w: s.w ?? (o.pencil ? 2.4 : 2.6), tex: o.pencil ? 'pencil' as const : 'none' as const, draw: o.draw, fill: s.fill }));
  return svgInk(100, 100, strokes, { cls: 'pp-doodle ' + (o.cls ?? ''), w: o.size ?? '3em', h: o.size ?? '3em', style: o.style });
}
export const doodleNames = () => Object.keys(DOODLES);

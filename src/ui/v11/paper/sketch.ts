// Physical UI kit: sketches. Turns the game's pixel sprites (and photos) into field-journal
// drawings: a pencil contour that follows the silhouette at constant width, softer feature lines
// inside, graphite hatching in the shadows and a loose watercolour wash that bleeds past the lines.
// Plus a set of little ink doodles (boat, tent, palm, fish, crab, camera, Chunk...) for margins.
//
//   await sketchURL(src, { style: 'pencil' })   -> data URL of the drawing (cached per src + style)
//   sketchImg(src, cls)                         -> '<img>' html that fills itself in when ready
//   doodle('tent', { size: '3em' })             -> inline SVG of a hand-drawn doodle
//
// Styles: 'pencil' (graphite + wash), 'ink' (dip-pen lines, no wash), 'blueprint' (white lines for
// blueprint paper), 'chalk' (pale lines for dark boards).

import { canvas2d, fbm, hash2, rng, clamp01, smooth, hashStr } from './rng';
import { svgInk, roughLine, roughEllipse, roughCurve, roughRect, INK, PENCIL } from './ink';
import type { Stroke } from './ink';

export type SketchStyle = 'pencil' | 'ink' | 'blueprint' | 'chalk';
export interface SketchOpts {
  style?: SketchStyle;
  /** longest side of the output in px (default 300) */
  size?: number;
  /** watercolour wash strength 0..1 (pencil default 0.55, others 0) */
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

const cache = new Map<string, Promise<string>>();
const done = new Map<string, string>();

/** the sketch of an image as a data URL (cached; resolves '' if the image can't be read) */
export function sketchURL(src: string, o: SketchOpts = {}): Promise<string> {
  const key = sketchKey(src, o);
  let p = cache.get(key);
  if (!p) {
    p = loadImage(src).then(im => { const u = sketchCanvas(im, o).toDataURL('image/png'); done.set(key, u); return u; }).catch(() => '');
    cache.set(key, p);
  }
  return p;
}
/** a sketch that has already been made (or '') */
export function sketchReady(src: string, o: SketchOpts = {}): string { return done.get(sketchKey(src, o)) ?? ''; }
function sketchKey(src: string, o: SketchOpts) {
  return `${o.style ?? 'pencil'}|${o.size ?? 300}|${o.wash ?? ''}|${o.hatch ?? ''}|${o.crop?.join(',') ?? ''}|${o.photo ? 1 : 0}|${o.seed ?? 0}|${src.length}|${hashStr(src.length > 4000 ? src.slice(0, 2000) + src.slice(-2000) : src)}`;
}

let imgN = 0;
const pendingImgs = new Map<string, { src: string; o: SketchOpts }>();
const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
/**
 * An <img> of a sketch for page HTML, in a fixed box so page layout never depends on when the
 * drawing is ready: `box` is [width, height] in CSS units (default full width at 4:3), the sketch is
 * fitted inside it. If it isn't drawn yet the image fills itself in (call fillSketches(root) after
 * inserting the HTML; the book does this for you).
 */
export function sketchImg(src: string, o: SketchOpts & { box?: [string, string] } = {}, cls = '', style = ''): string {
  if (!src) return '';
  const [bw, bh] = o.box ?? ['100%', 'auto'];
  const size = `width:${bw};${bh === 'auto' ? 'aspect-ratio:4/3' : `height:${bh}`};`;
  const ready = sketchReady(src, o);
  if (ready) return `<img class="pp-sk ${cls}" src="${ready}" alt="" draggable="false" style="${size}${style}">`;
  const id = 'sk' + (++imgN);
  pendingImgs.set(id, { src, o });
  return `<img class="pp-sk wait ${cls}" src="${BLANK_GIF}" data-sk="${id}" alt="" draggable="false" style="${size}${style}">`;
}
/** fill in every waiting sketch image under root */
export function fillSketches(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>('img.pp-sk[data-sk]').forEach(img => {
    const job = pendingImgs.get(img.dataset.sk!);
    if (!job) return;
    void sketchURL(job.src, job.o).then(u => {
      if (!u) return;
      img.src = u;
      img.classList.remove('wait');
      img.removeAttribute('data-sk');
    });
  });
}

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

/** draw the sketch of an already-loaded image or canvas */
export function sketchCanvas(src: CanvasImageSource & { width: number; height: number }, o: SketchOpts = {}): HTMLCanvasElement {
  const style = o.style ?? 'pencil';
  const seed = o.seed ?? 7;
  const crop = o.crop ?? [0, 0, 1, 1];
  const sw0 = (src as HTMLImageElement).naturalWidth || src.width, sh0 = (src as HTMLImageElement).naturalHeight || src.height;
  const cx0 = Math.floor(crop[0] * sw0), cy0 = Math.floor(crop[1] * sh0);
  const cw = Math.max(2, Math.floor((crop[2] - crop[0]) * sw0)), ch = Math.max(2, Math.floor((crop[3] - crop[1]) * sh0));
  // ---- the source: pixel art back to one pixel per art pixel and then EPX-doubled (twice for small
  // sprites); photos scaled to a working size
  let w0: number, h0: number, px: Uint32Array;
  if (o.photo) {
    const ks = Math.min(1, 150 / Math.max(cw, ch));
    w0 = Math.max(2, Math.round(cw * ks)); h0 = Math.max(2, Math.round(ch * ks));
    const [, g0] = canvas2d(w0, h0);
    g0.imageSmoothingEnabled = true;
    g0.drawImage(src, cx0, cy0, cw, ch, 0, 0, w0, h0);
    px = new Uint32Array(g0.getImageData(0, 0, w0, h0).data.slice().buffer);
  } else {
    const [, g0] = canvas2d(cw, ch);
    g0.imageSmoothingEnabled = false;
    g0.drawImage(src, cx0, cy0, cw, ch, 0, 0, cw, ch);
    const full = g0.getImageData(0, 0, cw, ch).data;
    const k = pixelScale(full, cw, ch);
    w0 = Math.round(cw / k); h0 = Math.round(ch / k);
    px = new Uint32Array(w0 * h0);
    const f32 = new Uint32Array(full.slice().buffer);
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      const v = f32[y * k * cw + x * k];
      // all fully transparent pixels compare equal (EPX matches colours exactly)
      px[y * w0 + x] = (v >>> 24) < 16 ? 0 : v;
    }
    const passes = Math.max(w0, h0) <= 90 ? 2 : 1;
    for (let i = 0; i < passes; i++) [px, w0, h0] = scale2x(px, w0, h0);
  }
  const N0 = w0 * h0;
  const A = new Float32Array(N0), Lm = new Float32Array(N0);
  for (let i = 0; i < N0; i++) {
    const v = px[i];
    const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255, a = v >>> 24;
    A[i] = o.photo ? 1 : a / 255;
    Lm[i] = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  }
  // a light [1 2 1] smoothing on top of EPX (rounds what's left of the steps)
  const soften = (F: Float32Array, edge0: boolean) => {
    const T = new Float32Array(N0), O = new Float32Array(N0);
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      const i = y * w0 + x;
      const l = x > 0 ? F[i - 1] : (edge0 ? 0 : F[i]), r = x < w0 - 1 ? F[i + 1] : (edge0 ? 0 : F[i]);
      T[i] = (l + 2 * F[i] + r) / 4;
    }
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      const i = y * w0 + x;
      const u = y > 0 ? T[i - w0] : (edge0 ? 0 : T[i]), d = y < h0 - 1 ? T[i + w0] : (edge0 ? 0 : T[i]);
      O[i] = (u + 2 * T[i] + d) / 4;
    }
    return O;
  };
  const As = o.photo ? A : soften(A, true), Ls = soften(Lm, false);
  // shading is relative to the animal's own mid-tone (a dark seal and a pale crab both get shadows)
  let ls = 0, ln = 0;
  for (let i = 0; i < N0; i++) if (A[i] > 0.5) { ls += Lm[i]; ln++; }
  const meanL = ln ? ls / ln : 0.5;
  const samp = (F: Float32Array, x: number, y: number, outside: number) => {
    const fx = x - 0.5, fy = y - 0.5;
    const xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi;
    const at = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= w0 || yy >= h0 ? (outside >= 0 ? outside : F[Math.max(0, Math.min(h0 - 1, yy)) * w0 + Math.max(0, Math.min(w0 - 1, xx))]) : F[yy * w0 + xx]);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  // ---- output size and padding (the wash and lines spill a little)
  const size = o.size ?? 300;
  const k = size / Math.max(w0, h0);
  const pad = Math.round(size * 0.07);
  const W = Math.round(w0 * k) + pad * 2, H = Math.round(h0 * k) + pad * 2;
  const [out, g] = canvas2d(W, H);
  // ---- watercolour wash: pale, desaturated, a little off-register, pooled darker at its rim
  const washK = o.wash ?? (style === 'pencil' ? 0.62 : 0);
  if (washK > 0) {
    const [sc, sg] = canvas2d(w0, h0);
    const sid = sg.createImageData(w0, h0);
    new Uint32Array(sid.data.buffer).set(px);
    sg.putImageData(sid, 0, 0);
    // soften by drawing small then large
    const [tc, tg] = canvas2d(Math.max(2, Math.round(w0 / 3)), Math.max(2, Math.round(h0 / 3)));
    tg.imageSmoothingEnabled = true;
    tg.drawImage(sc, 0, 0, tc.width, tc.height);
    const dx = (hash2(seed, 1) - 0.5) * pad * 0.6, dy = (hash2(seed, 2) - 0.5) * pad * 0.5;
    g.imageSmoothingEnabled = true;
    g.drawImage(tc, pad + dx, pad + dy, W - pad * 2, H - pad * 2);
    const wd = g.getImageData(0, 0, W, H);
    const p = wd.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!p[i + 3]) continue;
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      const l = (r + gg + b) / 3;
      const sat = 0.9, lift = 0.62;
      p[i] = 255 - (255 - (l + (r - l) * sat)) * lift;
      p[i + 1] = 255 - (255 - (l + (gg - l) * sat)) * lift;
      p[i + 2] = 255 - (255 - (l + (b - l) * sat)) * lift;
      const n = fbm(x / 24, y / 24, seed + 3, 3), gr = hash2(x, y, seed);
      const a0 = p[i + 3] / 255;
      const rim = 1 - Math.abs(a0 - 0.55) * 1.6;
      p[i + 3] = 255 * washK * clamp01((0.4 + n * 0.7 - gr * 0.14) * (0.5 + rim * 0.65)) * smooth(0.05, 0.5, a0);
    }
    g.putImageData(wd, 0, 0);
  }
  // ---- lines and hatching, per output pixel
  const img = g.getImageData(0, 0, W, H);
  const P = img.data;
  const [lr, lg, lb] = LINE[style];
  const hatchK = o.hatch ?? (style === 'blueprint' ? 0.3 : 0.55);
  const lineW = Math.max(1.15, size / 200);
  const hs = Math.max(4.5, size / 44), hw = Math.max(0.7, size / 300);
  const brk = hash2(seed, 9) * 100;
  const e = 0.6;
  const iso = 0.5;
  const R2 = Math.SQRT1_2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = (x - pad) / k, sy = (y - pad) / k;
    const a = samp(As, sx, sy, 0);
    // nothing to draw well outside the animal
    if (a <= 0.01 && !o.photo) continue;
    let v = 0;
    const nz = fbm(x / 13 + brk, y / 13, seed + 11, 2);
    if (!o.photo && a > 0.01 && a < 0.99) {
      // the contour: distance to the alpha iso-line from its gradient, drawn at constant width
      const gx = (samp(As, sx + e, sy, 0) - samp(As, sx - e, sy, 0)) / (2 * e), gy = (samp(As, sx, sy + e, 0) - samp(As, sx, sy - e, 0)) / (2 * e);
      const gm = Math.hypot(gx, gy) / k + 1e-5;
      const dist = Math.abs(a - iso) / gm;
      v = (1 - smooth(lineW * 0.5, lineW * 1.2, dist)) * (0.72 + nz * 0.4);
      if (nz < 0.3) v *= 0.55;
      // a second, lighter pass a hair off the first (a quick pencil going round twice)
      const dist2 = Math.abs(samp(As, sx + 1.1 / k, sy - 0.8 / k, 0) - iso) / gm;
      v = Math.max(v, (1 - smooth(lineW * 0.3, lineW * 0.85, dist2)) * 0.28);
    }
    if (a > 0.35) {
      // feature lines where the colours change sharply inside the animal
      const l = samp(Ls, sx, sy, -1);
      const lx = (samp(Ls, sx + e, sy, -1) - samp(Ls, sx - e, sy, -1)) / (2 * e), ly = (samp(Ls, sx, sy + e, -1) - samp(Ls, sx, sy - e, -1)) / (2 * e);
      const lgm = Math.hypot(lx, ly);
      v = Math.max(v, smooth(o.photo ? 0.06 : 0.13, o.photo ? 0.2 : 0.34, lgm) * (o.photo ? 0.8 : 0.42) * (0.7 + nz * 0.4));
      if (hatchK > 0) {
        // graphite hatching in the shadows, cross-hatching in the darkest parts (anti-aliased strokes
        // with a little wobble so they look drawn)
        const dark = meanL - l;
        const wob = (fbm(x / 30, y / 30, seed + 21, 2) - 0.5) * hs * 0.8;
        const u = (x + y) * R2 + wob, w2 = (x - y) * R2 - wob;
        const d1 = Math.abs((((u % hs) + hs) % hs) - hs / 2), d2 = Math.abs((((w2 % (hs * 1.15)) + hs * 1.15) % (hs * 1.15)) - hs * 0.575);
        const l1 = 1 - smooth(hw * 0.4, hw * 1.2, d1), l2 = 1 - smooth(hw * 0.4, hw * 1.2, d2);
        let h = l1 * smooth(0.02, 0.12, dark) * 0.55 + l2 * smooth(0.16, 0.28, dark) * 0.5;
        h *= smooth(0.35, 0.6, a) * (0.6 + nz * 0.5);
        v = Math.max(v, h * hatchK);
      }
    }
    if (v <= 0.03) continue;
    const i = (y * W + x) * 4;
    const ga = clamp01(v) * (0.82 + hash2(x, y, seed + 2) * 0.18);
    const pa = P[i + 3] / 255;
    const oa = ga + pa * (1 - ga);
    P[i] = (lr * ga + P[i] * pa * (1 - ga)) / oa;
    P[i + 1] = (lg * ga + P[i + 1] * pa * (1 - ga)) / oa;
    P[i + 2] = (lb * ga + P[i + 2] * pa * (1 - ga)) / oa;
    P[i + 3] = oa * 255;
  }
  g.putImageData(img, 0, 0);
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

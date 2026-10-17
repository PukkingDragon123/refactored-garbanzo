// Physical UI kit: the pixel core. Everything the kit draws is pixel art: one "art pixel" is PX CSS
// pixels (2), shown with image-rendering: pixelated and hard edges, no anti-aliasing anywhere.
//
//   Art             a tiny paint buffer (Uint32 ImageData): pixels, rects, Bresenham lines, filled
//                   polygons, ellipses, ordered (Bayer) dithering for every gradient or shadow
//   pxCanvas(key, paint, o)
//                   an HTML string for a <canvas> that is painted to its real on-screen size once it
//                   is in the document (a MutationObserver + ResizeObserver do it, cached per size),
//                   so ink lines, borders and sketches land exactly on the pixel grid whatever box
//                   they sit in. paint(art, w, h, t) gets the size in art pixels; animated pieces
//                   (ink drawing itself on) are called with t going 0..1.
//   spriteURL(key, w, h, paint, scale)
//                   a fixed-size sprite as a PNG data URL, pre-scaled (crisp even without
//                   image-rendering), cached.
//   bayer(x, y)     the 4x4 ordered-dither threshold (0..1) at a pixel

export const PX = 2;

// ---------------------------------------------------------------- colours

/** '#rrggbb' (or '#rgb') and an alpha 0..1 to a packed little-endian RGBA uint32 */
export function col(hex: string, a = 1): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = parseInt(h.slice(0, 6), 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return ((Math.round(a * 255) & 255) << 24 | b << 16 | g << 8 | r) >>> 0;
}
export const rgbaOf = (c: number): [number, number, number, number] => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
export const packRGBA = (r: number, g: number, b: number, a = 255) => ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
/** mix two packed colours (t 0..1), alpha included */
export function mixC(a: number, b: number, t: number): number {
  const [r0, g0, b0, a0] = rgbaOf(a), [r1, g1, b1, a1] = rgbaOf(b);
  return packRGBA(r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t, a0 + (a1 - a0) * t);
}
/** darken / lighten a packed colour by k (-1..1) */
export function shadeC(c: number, k: number): number {
  const [r, g, b, a] = rgbaOf(c);
  if (k < 0) return packRGBA(r * (1 + k), g * (1 + k), b * (1 + k), a);
  return packRGBA(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k, a);
}
export const TRANSPARENT = 0;

// ---------------------------------------------------------------- dithering

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4x4 Bayer threshold at a pixel, in (0, 1) */
export const bayer = (x: number, y: number) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** should a pixel at (x, y) be "on" for coverage a (0..1)? */
export const dith = (x: number, y: number, a: number) => a > bayer(x, y);

// ---------------------------------------------------------------- the paint buffer

export class Art {
  readonly w: number;
  readonly h: number;
  readonly d: Uint32Array;
  readonly img: ImageData;
  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.round(w));
    this.h = Math.max(1, Math.round(h));
    this.img = new ImageData(this.w, this.h);
    this.d = new Uint32Array(this.img.data.buffer);
  }
  get(x: number, y: number): number {
    x |= 0; y |= 0;
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x];
  }
  /** set a pixel (alpha-composited over what's there when the colour isn't opaque) */
  px(x: number, y: number, c: number) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = c >>> 24;
    const i = y * this.w + x;
    if (a === 255 || this.d[i] === 0) { this.d[i] = c; return; }
    if (a === 0) return;
    this.d[i] = over(this.d[i], c);
  }
  /** replace a pixel outright */
  put(x: number, y: number, c: number) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
  }
  /** a rect filled to coverage a with ordered dithering */
  drect(x: number, y: number, w: number, h: number, c: number, a: number) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (dith(xx, yy, a)) this.px(xx, yy, c);
  }
  /** Bresenham line; w = brush size (1..3) */
  line(x0: number, y0: number, x1: number, y1: number, c: number, w = 1, plot?: (x: number, y: number) => void) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (plot) plot(x0, y0); else this.dot(x0, y0, c, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** a square brush dab of size w */
  dot(x: number, y: number, c: number, w = 1) {
    if (w <= 1) { this.px(x, y, c); return; }
    const o = Math.floor((w - 1) / 2);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) this.px(x - o + i, y - o + j, c);
  }
  /** filled polygon (even-odd), sampled at pixel centres */
  poly(pts: [number, number][], c: number | ((x: number, y: number) => number)) {
    if (pts.length < 3) return;
    let ymin = Infinity, ymax = -Infinity;
    for (const [, y] of pts) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(this.h - 1, Math.ceil(ymax));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > sy) !== (yj > sy)) xs.push(xi + ((sy - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = a; x <= b; x++) this.px(x, y, typeof c === 'number' ? c : c(x, y));
      }
    }
  }
  /** filled ellipse (pixel centres inside) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number | ((x: number, y: number) => number)) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, typeof c === 'number' ? c : c(x, y));
    }
  }
  /** a one-pixel ellipse outline */
  ring(cx: number, cy: number, rx: number, ry: number, c: number) {
    const inside = (x: number, y: number) => { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; };
    const x0 = Math.floor(cx - rx) - 1, x1 = Math.ceil(cx + rx) + 1, y0 = Math.floor(cy - ry) - 1, y1 = Math.ceil(cy + ry) + 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) this.px(x, y, c);
    }
  }
  /** draw another buffer (or a canvas/image via a temporary read) at x, y */
  blit(src: Art, x: number, y: number, o: { flipX?: boolean; tint?: number; alphaMul?: number } = {}) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      let c = src.d[j * src.w + (o.flipX ? src.w - 1 - i : i)];
      if (!(c >>> 24)) continue;
      if (o.tint !== undefined) c = ((c & 0xff000000) | (o.tint & 0x00ffffff)) >>> 0;
      if (o.alphaMul !== undefined && o.alphaMul < 1) { if (!dith(x + i, y + j, o.alphaMul)) continue; }
      this.px(x + i, y + j, c);
    }
  }
  /** every opaque pixel gets an outline of colour c on its empty 4-neighbours */
  outline(c: number, diag = false) {
    const W = this.w, H = this.h, src = this.d.slice();
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (src[y * W + x] >>> 24) > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || (diag && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)))) this.d[y * W + x] = c;
    }
  }
  /** a hard drop shadow (dithered to coverage a) under everything opaque, offset by dx, dy */
  shadow(dx: number, dy: number, c: number, a = 1) {
    const W = this.w, H = this.h, src = this.d.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (src[y * W + x] >>> 24) continue;
      const sx = x - dx, sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H || !(src[sy * W + sx] >>> 24)) continue;
      if (a >= 1 || dith(x, y, a)) this.d[y * W + x] = c;
    }
  }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(this.img, 0, 0);
    return c;
  }
  /** PNG data URL, scaled up by k with hard pixels */
  url(k = 1): string {
    const c = this.canvas();
    if (k === 1) return c.toDataURL('image/png');
    const o = document.createElement('canvas');
    o.width = this.w * k; o.height = this.h * k;
    const g = o.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  /** read a canvas / image into a new buffer (same size) */
  static from(src: CanvasImageSource & { width: number; height: number }, w = src.width, h = src.height): Art {
    const a = new Art(w, h);
    const c = document.createElement('canvas');
    c.width = a.w; c.height = a.h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, a.w, a.h);
    a.d.set(new Uint32Array(g.getImageData(0, 0, a.w, a.h).data.buffer));
    return a;
  }
}

/** source-over for packed colours */
export function over(dst: number, src: number): number {
  const sa = (src >>> 24) / 255;
  if (sa >= 1) return src;
  const da = (dst >>> 24) / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return 0;
  const f = (s: number, d: number) => (s * sa + d * da * (1 - sa)) / oa;
  return packRGBA(f(src & 255, dst & 255), f((src >>> 8) & 255, (dst >>> 8) & 255), f((src >>> 16) & 255, (dst >>> 16) & 255), oa * 255);
}

// ---------------------------------------------------------------- fixed sprites

const sprites = new Map<string, string>();
/** a sprite painted once into a w x h buffer and returned as a data URL scaled by `scale` */
export function spriteURL(key: string, w: number, h: number, paint: (a: Art) => void, scale = PX): string {
  const k = `${key}|${w}x${h}|${scale}`;
  let u = sprites.get(k);
  if (!u) {
    const a = new Art(w, h);
    paint(a);
    u = a.url(scale);
    sprites.set(k, u);
  }
  return u;
}

// ---------------------------------------------------------------- canvases painted to their real size

export type Painter = (a: Art, w: number, h: number, t: number) => void | Promise<void>;
interface Job { paint: Painter; anim: number; async: boolean }
const jobs = new Map<string, Job>();
/** finished paints per job and size (LRU-ish) */
const done = new Map<string, HTMLCanvasElement>();
let gen = 0;

/**
 * A canvas that paints itself at its on-screen size. `key` identifies the drawing (same key, same
 * picture: pass everything the painter depends on). Give the canvas a CSS size (style w / h or a
 * class), as it has none of its own. `anim` seconds plays the painter with t 0..1 each time the
 * element appears (ink drawing itself on).
 */
export function pxCanvas(key: string, paint: Painter, o: { cls?: string; style?: string; anim?: number; attrs?: string; async?: boolean } = {}): string {
  if (!jobs.has(key)) jobs.set(key, { paint, anim: o.anim ?? 0, async: !!o.async });
  ensureObservers();
  return `<canvas class="pp-cv ${o.cls ?? ''}" data-pp="${escAttr(key)}"${o.anim ? ' data-ppa="1"' : ''}${o.style ? ` style="${o.style}"` : ''}${o.attrs ? ' ' + o.attrs : ''} aria-hidden="true"></canvas>`;
}
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** register a painter under a key (for canvases created in code: el.dataset.pp = key) */
export function pxJob(key: string, paint: Painter, anim = 0) { if (!jobs.has(key)) jobs.set(key, { paint, anim, async: false }); ensureObservers(); }

let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;
const sizes = new WeakMap<HTMLCanvasElement, [number, number]>();

function ensureObservers() {
  if (ro || typeof document === 'undefined') return;
  ro = new ResizeObserver(entries => {
    for (const e of entries) {
      const c = e.target as HTMLCanvasElement;
      if (!c.isConnected) { ro!.unobserve(c); continue; }
      const cr = e.contentRect;
      sizes.set(c, [cr.width, cr.height]);
      paintCanvas(c, cr.width, cr.height);
    }
  });
  mo = new MutationObserver(recs => {
    for (const r of recs) {
      r.addedNodes.forEach(n => { if (n.nodeType === 1) watch(n as Element); });
      r.removedNodes.forEach(n => { if (n.nodeType === 1) unwatch(n as Element); });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  watch(document.documentElement);
}
function watch(root: Element) {
  if (root instanceof HTMLCanvasElement && root.dataset.pp) ro!.observe(root);
  root.querySelectorAll?.('canvas[data-pp]').forEach(c => ro!.observe(c));
}
function unwatch(root: Element) {
  if (root instanceof HTMLCanvasElement && root.dataset.pp) ro!.unobserve(root);
  root.querySelectorAll?.('canvas[data-pp]').forEach(c => ro!.unobserve(c));
}

/** paint every kit canvas under root right now (after a synchronous innerHTML, before layout settles) */
export function paintNow(root: ParentNode) {
  ensureObservers();
  root.querySelectorAll?.<HTMLCanvasElement>('canvas[data-pp]').forEach(c => {
    const w = c.clientWidth, h = c.clientHeight;
    if (w && h) paintCanvas(c, w, h);
  });
}
/** forget cached paints (the art changed) */
export function pxInvalidate(prefix = '') {
  gen++;
  for (const k of [...done.keys()]) if (!prefix || k.startsWith(prefix)) done.delete(k);
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-pp]').forEach(c => { const s = sizes.get(c); if (s && c.dataset.pp!.startsWith(prefix)) paintCanvas(c, s[0], s[1], true); });
}

function paintCanvas(c: HTMLCanvasElement, cw: number, ch: number, force = false) {
  const key = c.dataset.pp!;
  const job = jobs.get(key);
  if (!job || cw < 1 || ch < 1) return;
  if (c.closest('.ppb-measure')) return;
  const aw = Math.max(1, Math.round(cw / PX)), ah = Math.max(1, Math.round(ch / PX));
  if (!force && c.width === aw && c.height === ah && c.dataset.ppg === String(gen) && c.dataset.ppd === '1') return;
  c.dataset.ppg = String(gen);
  const ck = `${key}|${aw}x${ah}`;
  const g = c.getContext('2d');
  if (!g) return;
  const hit = done.get(ck);
  const animate = job.anim > 0 && c.dataset.ppa === '1' && !reduced();
  if (hit && !animate) {
    if (c.width !== aw || c.height !== ah) { c.width = aw; c.height = ah; } else g.clearRect(0, 0, aw, ah);
    g.drawImage(hit, 0, 0);
    c.dataset.ppd = '1';
    return;
  }
  c.width = aw; c.height = ah;
  const finish = (a: Art) => {
    const keep = a.canvas();
    done.set(ck, keep);
    if (done.size > 700) { const first = done.keys().next().value; if (first !== undefined) done.delete(first); }
    return keep;
  };
  if (animate) {
    c.dataset.ppa = '0';
    const t0 = performance.now(), dur = job.anim * 1000;
    const step = () => {
      if (!c.isConnected) return;
      const t = Math.min(1, (performance.now() - t0) / dur);
      const a = new Art(aw, ah);
      void job.paint(a, aw, ah, t);
      if (c.width === aw && c.height === ah) g.putImageData(a.img, 0, 0);
      if (t < 1) requestAnimationFrame(step); else { finish(a); c.dataset.ppd = '1'; }
    };
    step();
    return;
  }
  const a = new Art(aw, ah);
  const r = job.paint(a, aw, ah, 1);
  if (r instanceof Promise) {
    c.dataset.ppd = '0';
    void r.then(() => {
      const keep = finish(a);
      if (c.width === aw && c.height === ah) { g.clearRect(0, 0, aw, ah); g.drawImage(keep, 0, 0); c.dataset.ppd = '1'; c.classList.remove('wait'); }
    });
    return;
  }
  g.putImageData(a.img, 0, 0);
  finish(a);
  c.dataset.ppd = '1';
}

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** a stable short hash of anything JSON-able (canvas keys) */
export function keyOf(...parts: unknown[]): string {
  const s = JSON.stringify(parts);
  let h = 2166136261, h2 = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = Math.imul(h ^ c, 16777619); h2 = (Math.imul(h2, 33) + c) | 0; }
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
}

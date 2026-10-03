// Physical UI kit: small seeded random helpers and value noise for the paper textures, the sketches
// and the ink transitions. Everything is deterministic per seed, so a page looks the same every time
// it is drawn (the same stains, the same wobble in a hand-drawn box).

/** mulberry32: a tiny fast seeded PRNG; returns floats in [0, 1) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a stable 32-bit hash of a string (seeds from ids: 'sp:glasscrab' always draws the same sketch) */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** integer lattice hash -> [0, 1) */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** smooth value noise in [0, 1]; `wrap` makes it tile with that period (in lattice cells) */
export function vnoise(x: number, y: number, seed = 0, wrap = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = (v: number) => (wrap ? ((v % wrap) + wrap) % wrap : v);
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** fractal value noise (octaves of vnoise), roughly in [0, 1] */
export function fbm(x: number, y: number, seed = 0, oct = 4, wrap = 0): number {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x * f, y * f, seed + i * 17, wrap ? wrap * f : 0) * amp;
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / n;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** parse '#rrggbb' into [r, g, b] 0..255 */
export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgba = (hex: string, a: number) => { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; };

/** a canvas of the given size (and its 2D context) */
export function canvas2d(w: number, h: number, read = true): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  // most of the kit's canvases are painted pixel by pixel (getImageData / putImageData)
  return [c, c.getContext('2d', read ? { willReadFrequently: true } : undefined)!];
}

/** memoise a string-keyed builder (textures, sketches, doodles are generated once) */
export function memo<T>(fn: (key: string) => T): (key: string) => T {
  const m = new Map<string, T>();
  return (k: string) => {
    let v = m.get(k);
    if (v === undefined) { v = fn(k); m.set(k, v); }
    return v;
  };
}

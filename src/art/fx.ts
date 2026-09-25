// Textures for particles, glows, shadows and light cookies.

import { PixelBuffer } from './pixel';
import { rgba, C, hex, shade } from './color';
import { PAL } from './palettes';
import { Rng, bayer, clamp, fbm2 } from '../core/math';

/** Smooth radial glow (not pixelated; drawn additively). */
export function glowTex(size = 64, falloff = 2.2) {
  const b = new PixelBuffer(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      const a = Math.pow(Math.max(0, 1 - d), falloff);
      b.data[y * size + x] = rgba(255, 255, 255, a * 255);
    }
  return b;
}

/** Soft circle with a flat core (smoke puffs, mist). */
export function softTex(size = 32) {
  const b = new PixelBuffer(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      const a = clamp(1 - d) ** 1.2 * (0.8 + fbm2(x * 0.3, y * 0.3, 2, 5) * 0.4);
      b.data[y * size + x] = rgba(255, 255, 255, clamp(a) * 255);
    }
  return b;
}

/** Pixel dithered disc - pixel-art styled soft blob. */
export function ditherBlob(r: number) {
  const s = Math.ceil(r * 2);
  const b = new PixelBuffer(s, s);
  b.discFn(s / 2, s / 2, r, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    return 1 - d > bayer(x, y) * 0.9 ? rgba(255, 255, 255) : -1;
  });
  return b;
}

export function dot(size = 1) {
  const b = new PixelBuffer(size, size);
  b.clear(rgba(255, 255, 255));
  return b;
}

export function sparkTex() {
  const b = new PixelBuffer(7, 7);
  const w = rgba(255, 255, 255);
  for (let i = 0; i < 7; i++) {
    b.set(3, i, rgba(255, 255, 255, i === 3 ? 255 : 150));
    b.set(i, 3, rgba(255, 255, 255, i === 3 ? 255 : 150));
  }
  b.set(3, 3, w);
  return b;
}

export function leafTex(seed: number, ramp: C[] = PAL.leafDeep) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(5, 4);
  const c = ramp[rng.int(3, ramp.length - 2)];
  b.set(1, 1, c); b.set(2, 1, c); b.set(3, 1, shade(c, 0.2));
  b.set(0, 2, shade(c, -0.2)); b.set(1, 2, c); b.set(2, 2, c); b.set(3, 2, shade(c, -0.15));
  b.set(4, 0, shade(c, -0.3));
  return b;
}

export function petalTex(c: C) {
  const b = new PixelBuffer(3, 2);
  b.set(0, 0, c); b.set(1, 0, shade(c, 0.2)); b.set(1, 1, shade(c, -0.2)); b.set(2, 1, c);
  return b;
}

export function dropTex() {
  const b = new PixelBuffer(1, 6);
  for (let i = 0; i < 6; i++) b.set(0, i, rgba(200, 225, 255, 60 + i * 30));
  return b;
}

export function bubbleTex(r = 3) {
  const s = r * 2 + 1;
  const b = new PixelBuffer(s, s);
  b.discFn(s / 2, s / 2, r + 0.5, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d < 0.6) return nx < -0.2 && ny < -0.2 ? rgba(255, 255, 255, 220) : -1;
    return rgba(200, 235, 255, 200);
  });
  return b;
}

/** Soft elliptical ground shadow. */
export function blobShadow(w = 32, h = 8) {
  const b = new PixelBuffer(w, h);
  b.ellipseFn(w / 2, h / 2, w / 2, h / 2, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    const a = clamp((1 - d) * 1.6);
    return a > bayer(x, y) * 0.8 ? rgba(0, 0, 0, 255) : -1;
  });
  return b;
}

/**
 * God-ray shaft cookie: tall soft-edged beam, brighter at the top, with streaks.
 * Drawn additively and into the light map.
 */
export function shaftTex(w = 48, h = 256, seed = 3) {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    const ty = y / h;
    for (let x = 0; x < w; x++) {
      const tx = x / (w - 1);
      const edge = Math.sin(tx * Math.PI);
      const streak = 0.7 + 0.3 * fbm2(x * 0.18, y * 0.004, 2, seed);
      const a = Math.pow(edge, 1.6) * streak * (1 - ty * 0.85) * (ty < 0.05 ? ty / 0.05 : 1);
      b.data[y * w + x] = rgba(255, 255, 255, clamp(a) * 255);
    }
  }
  return b;
}

/** Wide flashlight cone cookie pointing right. */
export function coneTex(w = 128, h = 64) {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const half = 0.12 + t * 0.88;
      const v = Math.abs(y + 0.5 - h / 2) / (h / 2);
      if (v > half) continue;
      const edge = 1 - Math.pow(v / half, 3);
      const a = edge * Math.pow(1 - t, 0.7) * Math.min(1, t * 8);
      b.data[y * w + x] = rgba(255, 255, 255, clamp(a) * 255);
    }
  return b;
}

/** Caustics pattern (tileable-ish) for underwater light. */
export function causticsTex(size = 128, seed = 9) {
  const b = new PixelBuffer(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = fbm2(x * 0.06, y * 0.06, 3, seed);
      const v = 1 - Math.abs(n - 0.5) * 6;
      b.data[y * size + x] = rgba(255, 255, 255, clamp(v) * 255);
    }
  return b;
}

export function ringTex(r = 8) {
  const s = r * 2 + 2;
  const b = new PixelBuffer(s, s);
  b.discFn(s / 2, s / 2, r, (_x, _y, nx, ny) => (Math.hypot(nx, ny) > 0.8 ? rgba(255, 255, 255) : -1));
  return b;
}

export const FX_COLORS = { ember: hex('#ffb347'), smoke: hex('#8c8c96') };

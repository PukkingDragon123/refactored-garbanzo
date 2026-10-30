// Close-up kit: the pixel helpers every close-up set shares. Hand-drawn sprites come from character
// maps (pmap), shading goes through ordered-dither ramps (no smooth gradients), item art comes from the
// game's own painted icons, and the particles (steam, drops, crumbs, sparks, dust) are pixel clusters.
// Text in a set floats with per-letter life (shouts shake, whispers waver), drawn from the pixel fonts.

import { PixelBuffer } from '../../../art/pixel';
import { hex, mix, A, type C } from '../../../art/color';
import { itemIcon, ICON_IDS } from '../../../art/itemicons';
import { itemArtCanvas } from '../../../art/v11/itemart';
import { pxTextBuf, pxMeasure } from '../../pxfont';
import type { PxFontId } from '../../pxfont';
import { ITEMS } from '../../../game/items';
import { paintBundle } from '../../v11/bagart';
import { footprint } from '../../../game/v11/footprints';

export type { C };
export { PixelBuffer, hex, mix };

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4x4 ordered dither threshold 0..1 */
export const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
export const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeInOut = (t: number) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
export const H = (s: string) => hex(s);
export const ramp = (...cs: string[]) => cs.map(c => hex(c));

/** a colour from a ramp at t (0..1), dithered between steps so there is never a smooth blend */
export function rd(r: C[], t: number, x: number, y: number): C {
  const f = clamp(t, 0, 0.9999) * (r.length - 1), i = Math.floor(f);
  return f - i > dith(x, y) ? r[Math.min(r.length - 1, i + 1)] : r[i];
}

/** a hand-drawn sprite from a character map ('.' and ' ' are clear) */
export function pmap(rows: string[], pal: Record<string, string>): PixelBuffer {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const b = new PixelBuffer(w, h);
  const cols: Record<string, C> = {};
  for (const k of Object.keys(pal)) cols[k] = hex(pal[k]);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = cols[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return b;
}

/** blit with flips, a whole-number scale, a tint toward a colour and a darkening (all opaque) */
export function blit(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, o: { fx?: boolean; fy?: boolean; k?: number; tint?: C; tk?: number; dark?: number; alpha?: number } = {}) {
  const k = Math.max(1, Math.round(o.k ?? 1));
  x = Math.round(x); y = Math.round(y);
  const DK = hex('#140a06');
  for (let sy = 0; sy < src.h; sy++) for (let sx = 0; sx < src.w; sx++) {
    let c = src.data[(o.fy ? src.h - 1 - sy : sy) * src.w + (o.fx ? src.w - 1 - sx : sx)];
    if (A(c) < 128) continue;
    if (o.tint !== undefined && (o.tk ?? 0) > 0) c = mix(c, o.tint, o.tk!);
    if ((o.dark ?? 0) > 0) c = mix(c, DK, o.dark!);
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const px = x + sx * k + i, py = y + sy * k + j;
      if (o.alpha !== undefined && o.alpha < 1 && dith(px, py) > o.alpha) continue;
      dst.set(px, py, c);
    }
  }
}

/** blit rotated about (ox, oy) in the sprite onto (x, y): nearest sampling, so the pixels stay hard */
export function blitRot(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, ang: number, ox: number, oy: number, fy = false) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const r = Math.ceil(Math.hypot(Math.max(ox, src.w - ox), Math.max(oy, src.h - oy))) + 1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const u = Math.floor(ca * dx + sa * dy + ox + 0.5), v0 = Math.floor(-sa * dx + ca * dy + oy + 0.5);
    if (u < 0 || v0 < 0 || u >= src.w || v0 >= src.h) continue;
    const v = fy ? src.h - 1 - v0 : v0;
    const c = src.data[v * src.w + u];
    if (A(c) < 128) continue;
    dst.set(Math.round(x) + dx, Math.round(y) + dy, c);
  }
}

/** darken a region with a dithered shade (k 0..1): pixel shadows, never soft */
export function shadeRect(dst: PixelBuffer, x: number, y: number, w: number, h: number, k: number, to = hex('#0c0604')) {
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(dst.h, y + h); j++) for (let i = Math.max(0, Math.floor(x)); i < Math.min(dst.w, x + w); i++) {
    if (dith(i, j) < k) dst.data[j * dst.w + i] = mix(dst.data[j * dst.w + i], to, 0.55);
  }
}
/** an elliptical contact shadow (dithered) */
export function shadowOval(dst: PixelBuffer, cx: number, cy: number, rx: number, ry: number, k = 0.7) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    if (dith(x, y) < k * (1 - d * 0.7)) { const c = dst.get(x, y); if (c) dst.set(x, y, mix(c, hex('#0c0604'), 0.5)); }
  }
}
/** lighten pixels toward a warm light (firelight), dithered */
export function glow(dst: PixelBuffer, cx: number, cy: number, r: number, k: number, col = hex('#ffb04a')) {
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(dst.h, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(dst.w, cx + r); x++) {
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d >= 1) continue;
    const a = (1 - d) * k;
    // quantised into three steps, dithered between them
    const q = Math.floor(a * 3 + dith(x, y)) / 3;
    if (q > 0) dst.data[y * dst.w + x] = mix(dst.data[y * dst.w + x], col, Math.min(0.6, q * 0.5));
  }
}

/** copy a window of a wide background into the frame (fast row copies) */
export function copyWin(dst: PixelBuffer, src: PixelBuffer, sx: number) {
  sx = Math.round(clamp(sx, 0, Math.max(0, src.w - dst.w)));
  const w = Math.min(dst.w, src.w - sx), h = Math.min(dst.h, src.h);
  for (let y = 0; y < h; y++) dst.data.set(src.data.subarray(y * src.w + sx, y * src.w + sx + w), y * dst.w);
}

/** the game's painted art for an item, at most `max` px across */
const sprCache = new Map<string, PixelBuffer>();
export function itemSprite(id: string, max = 24): PixelBuffer {
  const key = id + ':' + max;
  const hit = sprCache.get(key);
  if (hit) return hit;
  let b: PixelBuffer;
  const art = itemArtCanvas(id);
  if (art && art.width > 0) {
    const k = Math.max(1, Math.ceil(Math.max(art.width, art.height) / max));
    const w = Math.max(1, Math.floor(art.width / k)), h = Math.max(1, Math.floor(art.height / k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0, w, h);
    b = new PixelBuffer(w, h);
    b.bytes.set(new Uint8Array(g.getImageData(0, 0, w, h).data.buffer));
  } else if (ICON_IDS.items().includes(id)) b = itemIcon(id);
  else b = paintBundle(id, ITEMS[id]?.kind ?? 'food', footprint(id));
  sprCache.set(key, b);
  return b;
}

// ---------------------------------------------------------------- particles
export type PartKind = 'steam' | 'smoke' | 'spark' | 'ember' | 'drop' | 'crumb' | 'dust' | 'chip' | 'grain' | 'leaf' | 'bubble' | 'star';
export interface Part { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; kind: PartKind; c: C; s: number; floor?: number }
export class Parts {
  list: Part[] = [];
  add(kind: PartKind, x: number, y: number, vx: number, vy: number, o: { c?: C | string; life?: number; g?: number; s?: number; floor?: number } = {}) {
    if (this.list.length > 600) this.list.shift();
    const c = typeof o.c === 'string' ? hex(o.c) : o.c ?? hex('#ffffff');
    const life = o.life ?? 1;
    this.list.push({ x, y, vx, vy, g: o.g ?? 0, life, max: life, kind, c, s: o.s ?? 1, floor: o.floor });
  }
  burst(kind: PartKind, x: number, y: number, n: number, sp: number, o: { c?: C | string | (C | string)[]; life?: number; g?: number; up?: number; s?: number; floor?: number; spread?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const v = sp * (0.4 + Math.random() * 0.6);
      const c = Array.isArray(o.c) ? o.c[Math.floor(Math.random() * o.c.length)] : o.c;
      this.add(kind, x + (Math.random() - 0.5) * 2, y, Math.cos(a) * v, Math.sin(a) * v - (o.up ?? 0), { c, life: (o.life ?? 0.8) * (0.6 + Math.random() * 0.6), g: o.g, s: o.s, floor: o.floor });
    }
  }
  step(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.g * dt;
      if (p.kind === 'steam' || p.kind === 'smoke') { p.vx += Math.sin(p.y * 0.12 + p.life * 3) * dt * 6; p.vx *= 0.98; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; if (Math.abs(p.vy) < 4) { p.vy = 0; p.g = 0; } }
    }
    this.list = this.list.filter(p => p.life > 0);
  }
  draw(px: PixelBuffer, ox = 0) {
    for (const p of this.list) {
      const k = p.life / p.max, x = Math.round(p.x - ox), y = Math.round(p.y);
      switch (p.kind) {
        case 'steam': case 'smoke': {
          // a soft puff as a dithered pixel cluster that thins out as it rises
          const r = p.s * (1.5 + (1 - k) * 3);
          const dens = k * (p.kind === 'smoke' ? 0.7 : 0.55);
          for (let j = -Math.ceil(r); j <= r; j++) for (let i = -Math.ceil(r); i <= r; i++) {
            if (i * i + j * j > r * r) continue;
            if (dith(x + i, y + j) < dens * (1 - (i * i + j * j) / (r * r + 1) * 0.6)) px.set(x + i, y + j, p.c);
          }
          break;
        }
        case 'spark': case 'ember': {
          px.set(x, y, k > 0.5 ? hex('#fff4c0') : p.c);
          if (p.kind === 'spark' && k > 0.3) px.set(x - Math.sign(p.vx), y - Math.sign(p.vy), p.c);
          break;
        }
        case 'drop': {
          px.set(x, y, p.c);
          if (Math.abs(p.vy) > 30) px.set(x, y - Math.sign(p.vy), mix(p.c, hex('#ffffff'), 0.4));
          break;
        }
        case 'bubble': {
          px.set(x, y - 1, p.c); px.set(x - 1, y, p.c); px.set(x + 1, y, p.c); px.set(x, y + 1, p.c);
          px.set(x - 1, y - 1, hex('#ffffff'));
          break;
        }
        case 'star': {
          const c = k > 0.5 ? hex('#fff8d0') : p.c;
          px.set(x, y, c);
          if (k > 0.35) { px.set(x - 1, y, p.c); px.set(x + 1, y, p.c); px.set(x, y - 1, p.c); px.set(x, y + 1, p.c); }
          break;
        }
        case 'chip': case 'crumb': case 'grain': case 'leaf': case 'dust': default: {
          if (p.kind === 'dust' && dith(x, y) > k) break;
          px.set(x, y, p.c);
          if (p.s >= 2) { px.set(x + 1, y, p.c); if (p.kind !== 'grain') px.set(x, y + 1, mix(p.c, hex('#000000'), 0.3)); }
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- floating text with per-letter life
export type TextStyle = 'say' | 'shout' | 'whisper' | 'scared' | 'happy' | 'hint';
const glyphCache = new Map<string, { b: PixelBuffer; ox: number }>();
function glyph(ch: string, font: PxFontId, color: string, outline: string): { b: PixelBuffer; ox: number } {
  const key = ch + '|' + font + '|' + color + '|' + outline;
  let g = glyphCache.get(key);
  if (!g) {
    const b = pxTextBuf(ch, { font, color, outline });
    const w = pxMeasure(ch, font);
    g = { b, ox: Math.floor((b.w - w) / 2) };
    glyphCache.set(key, g);
  }
  return g;
}
export interface WordOpts { font?: PxFontId; color?: string; outline?: string; style?: TextStyle; t?: number; k?: number; align?: 'left' | 'center'; age?: number }
/** width of a word in art px */
export function wordW(text: string, o: WordOpts = {}) { return (pxMeasure(text, o.font ?? 'bold') + text.length * 0) * (o.k ?? 1); }
/** draw text with per-letter animation (t = seconds, age = seconds since it appeared) */
export function drawWord(px: PixelBuffer, text: string, x: number, y: number, o: WordOpts = {}) {
  const font = o.font ?? 'bold', k = Math.max(1, Math.round(o.k ?? 1));
  const color = o.color ?? '#fff6dc', outline = o.outline ?? '#1e1008';
  const t = o.t ?? 0, age = o.age ?? 9;
  const st = o.style ?? 'say';
  const w = pxMeasure(text, font) * k;
  let cx = Math.round(o.align === 'left' ? x : x - w / 2);
  let i = 0;
  for (const ch of text) {
    const adv = (pxMeasure(ch + 'i', font) - pxMeasure('i', font)) * k;
    if (ch !== ' ') {
      // letters pop in one by one
      const born = age - i * 0.025;
      if (born > 0) {
        let dx = 0, dy = 0;
        const pop = born < 0.12 ? -Math.round((0.12 - born) * 25) : 0;
        if (st === 'shout') { dx = Math.round(Math.sin(t * 40 + i * 2.1) * (age < 0.5 ? 1.5 : 0.6)); dy = Math.round(Math.cos(t * 37 + i) * (age < 0.5 ? 1.5 : 0.6)); }
        else if (st === 'scared') { dx = Math.round(Math.sin(t * 55 + i * 3.7) * 0.8); dy = Math.round(Math.cos(t * 49 + i * 1.3) * 0.8); }
        else if (st === 'whisper') dy = Math.round(Math.sin(t * 3 + i * 0.6) * 1.2);
        else if (st === 'happy') dy = Math.round(Math.sin(t * 8 + i * 0.7) * 1.5);
        else if (st === 'hint') dy = Math.round(Math.sin(t * 4 + i * 0.5) * 0.8);
        else dy = Math.round(Math.sin(t * 5 + i * 0.5) * 0.6);
        const g = glyph(ch, font, color, outline);
        const fade = st === 'whisper' ? 0.75 : 1;
        blit(px, g.b, cx - g.ox * k + dx, y + dy + pop, { k, alpha: fade < 1 ? fade : undefined });
      }
    }
    cx += adv;
    i++;
  }
}

// ---------------------------------------------------------------- painting helpers
/** an irregular polygon filled by fn (hand-placed corners make the silhouette) */
export function polyFill(px: PixelBuffer, pts: [number, number][], fn: (x: number, y: number) => C | -1) {
  px.polyFn(pts.flat(), fn);
}
/** a 1px dark outline round every opaque pixel of a sprite (in place) */
export function outlined(b: PixelBuffer, c = '#1a0e06'): PixelBuffer { b.outline(hex(c)); return b; }
/** a big rubber stamp: bold letters doubled, a double border, ink dropouts, sheared a touch */
export function paintBigStamp(text: string, color: string, seed = 1): PixelBuffer {
  const t = pxTextBuf(text, { font: 'bold', color, spacing: 1 });
  const k = 2, pad = 5;
  const w = t.w * k + pad * 2, h = t.h * k + pad * 2 - 2;
  const b = new PixelBuffer(w + 6, h);
  const c = hex(color);
  const shear = (y: number) => Math.round((h - y) * 0.12);
  const put = (x: number, y: number) => { if (hash(x, y, seed) > 0.12) b.set(x + shear(y), y, c); };
  for (let x = 0; x < w; x++) { put(x, 0); put(x, 1); put(x, h - 1); put(x, h - 2); if (x > 2 && x < w - 3) { put(x, 3); put(x, h - 4); } }
  for (let y = 0; y < h; y++) { put(0, y); put(1, y); put(w - 1, y); put(w - 2, y); if (y > 2 && y < h - 3) { put(3, y); put(w - 4, y); } }
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    if (!t.data[y * t.w + x]) continue;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(pad + x * k + i, pad - 1 + y * k + j);
  }
  return b;
}

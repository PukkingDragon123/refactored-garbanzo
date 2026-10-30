// Close-up kit. A set is laid out in "units" (about 320 x 180 of them) but painted at high density:
// every unit is Z x Z fine pixels (Z = 2..4) and a fine pixel is 1-2 device pixels, so the sets read
// as richly shaded, polished illustration with crisp quantised edges, never chunky blocks. Painters
// work in unit coordinates and are evaluated per fine pixel (area / ellipse / poly), shading goes
// through ordered-dither ramps at the fine grid, small hand-drawn maps are upscaled with an EPX
// scaler (smooth, crisp diagonals, no new colours) and then rim-lit at the fine grid, item art comes
// from the game's painted icons at full size, and text is drawn from the pixel web fonts at the fine
// grid with per-letter life (shouts shake, whispers waver, scared text trembles).

import { PixelBuffer } from '../../../art/pixel';
import { hex, mix, A, type C } from '../../../art/color';
import { itemIcon, ICON_IDS } from '../../../art/itemicons';
import { itemArtCanvas } from '../../../art/v11/itemart';
import { pxTextBuf } from '../../pxfont';
import { ITEMS } from '../../../game/items';
import { paintBundle } from '../../v11/bagart';
import { footprint } from '../../../game/v11/footprints';

export type { C };
export { PixelBuffer, hex, mix };

/** fine pixels per unit (set by the stage for the close-up that's open) */
export let Z = 3;
export function setZ(z: number) { Z = Math.max(1, Math.round(z)); }

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4x4 ordered dither threshold 0..1 (at the fine grid) */
export const dith = (x: number, y: number) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
export const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** smooth value noise (unit coords), for grain and mottling */
export function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeInOut = (t: number) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
export const ramp = (...cs: string[]) => cs.map(c => hex(c));

/** a colour from a ramp at t (0..1), dithered between steps at the fine grid (fx, fy) */
export function rd(r: C[], t: number, fx: number, fy: number): C {
  const f = clamp(t, 0, 0.9999) * (r.length - 1), i = Math.floor(f);
  return f - i > dith(fx, fy) ? r[Math.min(r.length - 1, i + 1)] : r[i];
}

// ---------------------------------------------------------------- painting in units, at the fine grid
type Fn = (u: number, v: number, fx: number, fy: number) => C | -1;
/** paint every fine pixel over a unit rect */
export function area(px: PixelBuffer, x0: number, y0: number, x1: number, y1: number, fn: Fn) {
  const a = Math.max(0, Math.floor(x0 * Z)), b = Math.min(px.w, Math.ceil(x1 * Z));
  const c = Math.max(0, Math.floor(y0 * Z)), d = Math.min(px.h, Math.ceil(y1 * Z));
  const D = px.data, W = px.w;
  for (let fy = c; fy < d; fy++) {
    const v = (fy + 0.5) / Z;
    for (let fx = a; fx < b; fx++) {
      const col = fn((fx + 0.5) / Z, v, fx, fy);
      if (col !== -1) D[fy * W + fx] = col;
    }
  }
}
/** an ellipse in units; fn gets the normalised position too */
export function ellipse(px: PixelBuffer, cx: number, cy: number, rx: number, ry: number, fn: (nx: number, ny: number, u: number, v: number, fx: number, fy: number) => C | -1) {
  area(px, cx - rx, cy - ry, cx + rx, cy + ry, (u, v, fx, fy) => {
    const nx = (u - cx) / rx, ny = (v - cy) / ry;
    return nx * nx + ny * ny > 1 ? -1 : fn(nx, ny, u, v, fx, fy);
  });
}
/** a polygon (unit corners placed by hand) */
export function poly(px: PixelBuffer, pts: [number, number][], fn: Fn) {
  px.polyFn(pts.flatMap(([x, y]) => [x * Z, y * Z]), (fx, fy) => fn((fx + 0.5) / Z, (fy + 0.5) / Z, fx, fy));
}
/** one fine pixel at a unit position */
export function pix(px: PixelBuffer, u: number, v: number, c: C) { px.set(Math.floor(u * Z), Math.floor(v * Z), c); }
/** a small round dot, r in fine px */
export function dot(px: PixelBuffer, u: number, v: number, c: C, r = 1) {
  const fx = Math.floor(u * Z), fy = Math.floor(v * Z);
  if (r <= 1) { px.set(fx, fy, c); return; }
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r - 0.5) px.set(fx + i, fy + j, c);
}
/** a line in units, w fine px wide; col can vary along it (t 0..1) */
export function line(px: PixelBuffer, u0: number, v0: number, u1: number, v1: number, col: C | ((t: number, fx: number, fy: number, side: number) => C | -1), w = 1) {
  const x0 = u0 * Z, y0 = v0 * Z, x1 = u1 * Z, y1 = v1 * Z;
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L));
  const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
  const h = (w - 1) / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let k = -h; k <= h + 0.01; k += 0.5) {
      const fx = Math.round(x + nx * k), fy = Math.round(y + ny * k);
      const c = typeof col === 'number' ? col : col(t, fx, fy, h > 0 ? k / h : 0);
      if (c !== -1) px.set(fx, fy, c);
    }
  }
}

/** blit a fine-res sprite with its top-left at unit (u, v); k = whole-number scale */
export function blit(dst: PixelBuffer, src: PixelBuffer, u: number, v: number, o: { fx?: boolean; fy?: boolean; k?: number; tint?: C; tk?: number; dark?: number; alpha?: number; fine?: boolean } = {}) {
  blitF(dst, src, o.fine ? Math.round(u) : Math.round(u * Z), o.fine ? Math.round(v) : Math.round(v * Z), o);
}
const DK = hex('#140a06');
/** blit at fine coords */
export function blitF(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, o: { fx?: boolean; fy?: boolean; k?: number; tint?: C; tk?: number; dark?: number; alpha?: number } = {}) {
  const k = Math.max(1, Math.round(o.k ?? 1));
  const W = dst.w, H = dst.h, D = dst.data;
  for (let sy = 0; sy < src.h; sy++) for (let sx = 0; sx < src.w; sx++) {
    let c = src.data[(o.fy ? src.h - 1 - sy : sy) * src.w + (o.fx ? src.w - 1 - sx : sx)];
    if (A(c) < 128) continue;
    if (o.tint !== undefined && (o.tk ?? 0) > 0) c = mix(c, o.tint, o.tk!);
    if ((o.dark ?? 0) > 0) c = mix(c, DK, o.dark!);
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const px = x + sx * k + i, py = y + sy * k + j;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      if (o.alpha !== undefined && o.alpha < 1 && dith(px, py) > o.alpha) continue;
      D[py * W + px] = c;
    }
  }
}
/** blit rotated about (ox, oy) of the sprite, onto fine (x, y): nearest sampling, hard pixels */
export function blitRot(dst: PixelBuffer, src: PixelBuffer, x: number, y: number, ang: number, ox: number, oy: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const r = Math.ceil(Math.hypot(Math.max(ox, src.w - ox), Math.max(oy, src.h - oy))) + 1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const u = Math.floor(ca * dx + sa * dy + ox + 0.5), v = Math.floor(-sa * dx + ca * dy + oy + 0.5);
    if (u < 0 || v < 0 || u >= src.w || v >= src.h) continue;
    const c = src.data[v * src.w + u];
    if (A(c) < 128) continue;
    dst.set(Math.round(x) + dx, Math.round(y) + dy, c);
  }
}

// ---------------------------------------------------------------- hand-drawn maps at high density
/** a hand-drawn sprite from a character map ('.' and ' ' are clear), at 1 px per character */
export function pmap(rows: string[], pal: Record<string, string>): PixelBuffer {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const b = new PixelBuffer(w, h);
  const cols: Record<string, C> = {};
  for (const k of Object.keys(pal)) cols[k] = hex(pal[k]);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = cols[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return b;
}
function scale2x(s: PixelBuffer): PixelBuffer {
  const o = new PixelBuffer(s.w * 2, s.h * 2);
  const g = (x: number, y: number) => s.get(Math.max(0, Math.min(s.w - 1, x)), Math.max(0, Math.min(s.h - 1, y)));
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const P = g(x, y), Au = g(x, y - 1), B = g(x + 1, y), Cc = g(x - 1, y), D = g(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (Cc === Au && Cc !== D && Au !== B) e0 = Au;
    if (Au === B && Au !== Cc && B !== D) e1 = B;
    if (D === Cc && D !== B && Cc !== Au) e2 = Cc;
    if (B === D && B !== Au && D !== Cc) e3 = D;
    o.set(x * 2, y * 2, e0); o.set(x * 2 + 1, y * 2, e1); o.set(x * 2, y * 2 + 1, e2); o.set(x * 2 + 1, y * 2 + 1, e3);
  }
  return o;
}
function scale3x(s: PixelBuffer): PixelBuffer {
  const o = new PixelBuffer(s.w * 3, s.h * 3);
  const g = (x: number, y: number) => s.get(Math.max(0, Math.min(s.w - 1, x)), Math.max(0, Math.min(s.h - 1, y)));
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const a = g(x - 1, y - 1), b = g(x, y - 1), c = g(x + 1, y - 1), d = g(x - 1, y), e = g(x, y), f = g(x + 1, y), gg = g(x - 1, y + 1), h = g(x, y + 1), i = g(x + 1, y + 1);
    const E = [e, e, e, e, e, e, e, e, e];
    if (b !== h && d !== f) {
      E[0] = d === b ? d : e;
      E[1] = (d === b && e !== c) || (b === f && e !== a) ? b : e;
      E[2] = b === f ? f : e;
      E[3] = (d === b && e !== gg) || (d === h && e !== a) ? d : e;
      E[5] = (b === f && e !== i) || (h === f && e !== c) ? f : e;
      E[6] = d === h ? d : e;
      E[7] = (d === h && e !== i) || (h === f && e !== gg) ? h : e;
      E[8] = h === f ? f : e;
    }
    for (let k = 0; k < 9; k++) o.set(x * 3 + (k % 3), y * 3 + Math.floor(k / 3), E[k]);
  }
  return o;
}
/** rim light at the fine grid: a lit edge up-left, a shaded edge down-right (the polish pass) */
function rimLight(b: PixelBuffer, k: number) {
  const o = b.clone();
  const op = (x: number, y: number) => (b.get(x, y) >>> 24) > 128;
  const W = hex('#fff6e0'), S = hex('#100806');
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!op(x, y)) continue;
    const c = b.data[y * b.w + x];
    // skip the outline itself (very dark)
    const lum = (c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255);
    if (lum < 110) continue;
    const ul = !op(x - k, y - k) || !op(x - k, y) || !op(x, y - k);
    const dr = !op(x + k, y + k) || !op(x + k, y) || !op(x, y + k);
    if (ul && !dr) o.data[y * b.w + x] = mix(c, W, 0.28);
    else if (dr && !ul) o.data[y * b.w + x] = mix(c, S, 0.3);
  }
  return o;
}
const upCache = new WeakMap<PixelBuffer, Map<number, PixelBuffer>>();
/** a small hand-drawn map at z fine px per pixel: EPX-scaled (smooth crisp diagonals), then rim-lit */
export function up(src: PixelBuffer, z = Z): PixelBuffer {
  let m = upCache.get(src);
  if (!m) { m = new Map(); upCache.set(src, m); }
  const hit = m.get(z);
  if (hit) return hit;
  // factor the scale into EPX steps of 3 and 2; anything left over is a whole-number block scale
  let o = src, left = Math.max(1, Math.round(z));
  while (left % 3 === 0) { o = scale3x(o); left /= 3; }
  while (left % 2 === 0) { o = scale2x(o); left /= 2; }
  if (left > 1) { const p = new PixelBuffer(o.w * left, o.h * left); blitF(p, o, 0, 0, { k: left }); o = p; }
  if (z > 1) o = rimLight(o, 1);
  m.set(z, o);
  return o;
}

/** the game's painted art for an item, at most `max` units across, at the fine grid */
const sprCache = new Map<string, PixelBuffer>();
export function itemSprite(id: string, max = 24): PixelBuffer {
  const key = id + ':' + max + ':' + Z;
  const hit = sprCache.get(key);
  if (hit) return hit;
  let b: PixelBuffer;
  const art = itemArtCanvas(id);
  const target = max * Z;
  if (art && art.width > 0 && Math.max(art.width, art.height) >= target * 0.7) {
    const k = Math.max(art.width, art.height) / target;
    const w = Math.max(1, Math.round(art.width / k)), h = Math.max(1, Math.round(art.height / k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0, w, h);
    b = new PixelBuffer(w, h);
    b.bytes.set(new Uint8Array(g.getImageData(0, 0, w, h).data.buffer));
  } else {
    let small: PixelBuffer;
    if (art && art.width > 0) {
      const c = document.createElement('canvas'); c.width = art.width; c.height = art.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(art, 0, 0);
      small = new PixelBuffer(art.width, art.height);
      small.bytes.set(new Uint8Array(g.getImageData(0, 0, art.width, art.height).data.buffer));
    } else if (ICON_IDS.items().includes(id)) small = itemIcon(id);
    else small = paintBundle(id, ITEMS[id]?.kind ?? 'food', footprint(id));
    // fit to the size: EPX up to the nearest step, then whole-number scale
    const want = Math.max(1, Math.floor(target / Math.max(small.w, small.h)));
    b = want >= 2 ? up(small, Math.min(4, want)) : small;
  }
  sprCache.set(key, b);
  return b;
}

// ---------------------------------------------------------------- particles (units in, fine pixels out)
export type PartKind = 'steam' | 'smoke' | 'spark' | 'ember' | 'drop' | 'crumb' | 'dust' | 'chip' | 'grain' | 'leaf' | 'bubble' | 'star';
export interface Part { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; kind: PartKind; c: C; s: number; floor?: number }
export class Parts {
  list: Part[] = [];
  add(kind: PartKind, x: number, y: number, vx: number, vy: number, o: { c?: C | string; life?: number; g?: number; s?: number; floor?: number } = {}) {
    if (this.list.length > 700) this.list.shift();
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
  draw(px: PixelBuffer) {
    const WH = hex('#ffffff'), HOT = hex('#fff4c0');
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'steam': case 'smoke': {
          // a soft puff: a dithered cluster at the fine grid that thins as it rises
          const r = p.s * (1.4 + (1 - k) * 3.2);
          const dens = k * (p.kind === 'smoke' ? 0.75 : 0.55);
          ellipse(px, p.x, p.y, r, r * 0.85, (nx, ny, _u, _v, fx, fy) => (dith(fx, fy) < dens * (1 - (nx * nx + ny * ny) * 0.7) ? (ny < -0.3 && p.kind === 'steam' ? mix(p.c, WH, 0.3) : p.c) : -1));
          break;
        }
        case 'spark': case 'ember': {
          const fx = Math.round(p.x * Z), fy = Math.round(p.y * Z);
          px.set(fx, fy, k > 0.5 ? HOT : p.c);
          if (Z >= 3) px.set(fx + 1, fy, p.c);
          if (p.kind === 'spark' && k > 0.25) { const L = Math.max(2, Math.round(Z * 0.8)); for (let i = 1; i <= L; i++) px.set(fx - Math.round(Math.sign(p.vx) * i * 0.6), fy - Math.round(Math.sign(p.vy) * i), mix(p.c, hex('#401004'), i / (L + 1))); }
          break;
        }
        case 'drop': {
          const r = Math.max(1, Math.round(Z * 0.45 * p.s));
          dot(px, p.x, p.y, p.c, r);
          px.set(Math.round(p.x * Z) - Math.floor(r / 2), Math.round(p.y * Z) - Math.floor(r / 2), mix(p.c, WH, 0.55));
          break;
        }
        case 'bubble': {
          const r = Math.max(2, Math.round(Z * 0.8));
          const fx = Math.round(p.x * Z), fy = Math.round(p.y * Z);
          for (let a = 0; a < 12; a++) px.set(fx + Math.round(Math.cos(a / 12 * 6.28) * r), fy + Math.round(Math.sin(a / 12 * 6.28) * r), p.c);
          px.set(fx - 1, fy - 1, WH);
          break;
        }
        case 'star': {
          const fx = Math.round(p.x * Z), fy = Math.round(p.y * Z);
          const L = k > 0.35 ? Math.max(2, Math.round(Z * k * 1.2)) : 1;
          px.set(fx, fy, HOT);
          for (let i = 1; i <= L; i++) { const c = mix(p.c, hex('#000000'), (i / (L + 1)) * 0.2); px.set(fx - i, fy, c); px.set(fx + i, fy, c); px.set(fx, fy - i, c); px.set(fx, fy + i, c); }
          break;
        }
        default: {
          if (p.kind === 'dust' && dith(Math.round(p.x * Z), Math.round(p.y * Z)) > k) break;
          const r = Math.max(1, Math.round(p.s * Z * 0.45));
          dot(px, p.x, p.y, p.c, p.kind === 'grain' ? 1 : r);
          if (r > 1 && p.kind !== 'grain') px.set(Math.round(p.x * Z) - 1, Math.round(p.y * Z) - 1, mix(p.c, WH, 0.3));
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- floating text with per-letter life
export type TextStyle = 'say' | 'shout' | 'whisper' | 'scared' | 'happy' | 'hint';
export type TextSize = 'small' | 'body' | 'big';
const FACES: Record<TextSize, { fam: string; em: number; weight: string }> = {
  small: { fam: "'Pixelify Sans'", em: 6, weight: '600' },
  body: { fam: "'Pixelify Sans'", em: 8, weight: '600' },
  big: { fam: "'Jersey 15'", em: 14, weight: '400' },
};
function fontReady(fam: string): boolean {
  try {
    const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fs) return false;
    let ok = false;
    const want = fam.replace(/'/g, '');
    fs.forEach(ff => { if (ff.family.replace(/["']/g, '') === want && ff.status === 'loaded') ok = true; });
    if (!ok) void fs.load(`16px ${fam}`);
    return ok;
  } catch { return false; }
}
interface Glyph { b: PixelBuffer; adv: number; oy: number }
const glyphs = new Map<string, Glyph>();
let measure: CanvasRenderingContext2D | null = null;
function glyph(ch: string, size: TextSize, color: string, outline: string): Glyph {
  const f = FACES[size];
  const web = fontReady(f.fam);
  const key = ch + '|' + size + '|' + color + '|' + outline + '|' + Z + '|' + web;
  let g = glyphs.get(key);
  if (g) return g;
  const ink = hex(color), ol = hex(outline);
  const ring = Math.max(1, Math.round(Z / 3));
  let mask: PixelBuffer, adv: number, oy = 0;
  const px = Math.round(f.em * Z);
  if (web) {
    if (!measure) measure = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const font = `${f.weight} ${px}px ${f.fam}`;
    measure.font = font;
    const w = Math.max(1, Math.ceil(measure.measureText(ch).width));
    const H = Math.ceil(px * 1.3);
    const c = document.createElement('canvas'); c.width = w + 4; c.height = H;
    const cg = c.getContext('2d', { willReadFrequently: true })!;
    cg.font = font; cg.textBaseline = 'alphabetic'; cg.fillStyle = '#fff';
    cg.fillText(ch, 2, Math.round(px * 0.95));
    const d = cg.getImageData(0, 0, c.width, H).data;
    mask = new PixelBuffer(c.width, H);
    for (let i = 0; i < c.width * H; i++) if (d[i * 4 + 3] > 110) mask.data[i] = ink;
    adv = w;
  } else {
    // the bitmap face, EPX-scaled to the size
    // (a pixel font stays a pixel font: whole-number block scale, no smoothing of the letter shapes)
    const t = pxTextBuf(ch, { font: size === 'small' ? 'body' : 'bold', color });
    const k = Math.max(1, Math.round(px / 10));
    if (k > 1) { mask = new PixelBuffer(t.w * k, t.h * k); blitF(mask, t, 0, 0, { k }); } else mask = t;
    adv = mask.w;
    oy = Math.round(px * 0.15);
  }
  // a ring round the letters, and a drop shadow down-right
  const o = new PixelBuffer(mask.w + ring * 2 + 1, mask.h + ring * 2 + 1);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < mask.w && y < mask.h && mask.data[y * mask.w + x] !== 0;
  for (let y = -ring; y < mask.h + ring + 1; y++) for (let x = -ring; x < mask.w + ring + 1; x++) {
    if (on(x, y)) continue;
    let near = false;
    for (let j = -ring; j <= ring && !near; j++) for (let i = -ring; i <= ring && !near; i++) if (on(x + i, y + j) || on(x + i - 1, y + j - 1)) near = true;
    if (near) o.set(x + ring, y + ring, ol);
  }
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (on(x, y)) {
    // a lighter top to each letter, so they read as painted, not flat
    const top = !on(x, y - 1) || !on(x, y - 2);
    o.set(x + ring, y + ring, top ? mix(ink, hex('#ffffff'), 0.35) : ink);
  }
  g = { b: o, adv: adv + Math.max(1, Math.round(Z * 0.4)), oy };
  glyphs.set(key, g);
  return g;
}
export interface WordOpts { size?: TextSize; color?: string; outline?: string; style?: TextStyle; t?: number; age?: number; align?: 'left' | 'center' }
/** width of a line of text, in units */
export function wordW(text: string, o: WordOpts = {}) {
  let w = 0;
  for (const ch of text) w += glyph(ch, o.size ?? 'body', o.color ?? '#fff6dc', o.outline ?? '#1e1008').adv;
  return w / Z;
}
/** line height in units */
export const lineH = (size: TextSize = 'body') => FACES[size].em * 1.25;
/** draw text (top at unit y) with per-letter life */
export function drawWord(px: PixelBuffer, text: string, x: number, y: number, o: WordOpts = {}) {
  const size = o.size ?? 'body';
  const color = o.color ?? '#fff6dc', outline = o.outline ?? '#1e1008';
  const t = o.t ?? 0, age = o.age ?? 9, st = o.style ?? 'say';
  const w = wordW(text, o) * Z;
  let cx = Math.round(o.align === 'left' ? x * Z : x * Z - w / 2);
  const y0 = Math.round(y * Z);
  const amp = Math.max(1, Z * 0.5);
  let i = 0;
  for (const ch of text) {
    const g = glyph(ch, size, color, outline);
    if (ch !== ' ') {
      const born = age - i * 0.025;
      if (born > 0) {
        let dx = 0, dy = 0;
        const pop = born < 0.12 ? -Math.round((0.12 - born) * 25 * Z / 3) : 0;
        if (st === 'shout') { const a = age < 0.5 ? amp * 1.6 : amp * 0.7; dx = Math.round(Math.sin(t * 40 + i * 2.1) * a); dy = Math.round(Math.cos(t * 37 + i) * a); }
        else if (st === 'scared') { dx = Math.round(Math.sin(t * 55 + i * 3.7) * amp * 0.8); dy = Math.round(Math.cos(t * 49 + i * 1.3) * amp * 0.8); }
        else if (st === 'whisper') dy = Math.round(Math.sin(t * 3 + i * 0.6) * amp * 1.2);
        else if (st === 'happy') dy = Math.round(Math.sin(t * 8 + i * 0.7) * amp * 1.5);
        else if (st === 'hint') dy = Math.round(Math.sin(t * 4 + i * 0.5) * amp * 0.8);
        else dy = Math.round(Math.sin(t * 5 + i * 0.5) * amp * 0.5);
        blitF(px, g.b, cx + dx, y0 + dy + pop + g.oy, { alpha: st === 'whisper' ? 0.8 : undefined });
      }
    }
    cx += g.adv;
    i++;
  }
}

// ---------------------------------------------------------------- shading helpers
/** an elliptical contact shadow (dithered) */
export function shadowOval(px: PixelBuffer, cx: number, cy: number, rx: number, ry: number, k = 0.7) {
  const S = hex('#0c0604');
  ellipse(px, cx, cy, rx, ry, (nx, ny, _u, _v, fx, fy) => {
    const d = nx * nx + ny * ny;
    if (dith(fx, fy) >= k * (1 - d * 0.7)) return -1;
    const c = px.data[fy * px.w + fx];
    return c ? mix(c, S, 0.5) : -1;
  });
}
/** darken everything in a unit rect with a dithered shade */
export function shadeRect(px: PixelBuffer, x: number, y: number, w: number, h: number, k: number, to = hex('#0c0604')) {
  area(px, x, y, x + w, y + h, (_u, _v, fx, fy) => (dith(fx, fy) < k ? mix(px.data[fy * px.w + fx], to, 0.55) : -1));
}
/** warm light pooled round a point, in three dithered steps */
export function glow(px: PixelBuffer, cx: number, cy: number, r: number, k: number, col = hex('#ffb04a')) {
  area(px, cx - r, cy - r, cx + r, cy + r, (u, v, fx, fy) => {
    const d = Math.hypot(u - cx, v - cy) / r;
    if (d >= 1) return -1;
    const q = Math.floor((1 - d) * k * 3 + dith(fx, fy)) / 3;
    return q > 0 ? mix(px.data[fy * px.w + fx], col, Math.min(0.6, q * 0.5)) : -1;
  });
}
/** copy a window of a wide fine background into the frame (fast row copies); sx in units */
export function copyWin(dst: PixelBuffer, src: PixelBuffer, sx: number) {
  const fx = Math.round(clamp(sx * Z, 0, Math.max(0, src.w - dst.w)));
  const w = Math.min(dst.w, src.w - fx), h = Math.min(dst.h, src.h);
  for (let y = 0; y < h; y++) dst.data.set(src.data.subarray(y * src.w + fx, y * src.w + fx + w), y * dst.w);
}
/** a big rubber stamp at the fine grid: big letters, a double border, ink dropouts, a slight shear */
export function paintBigStamp(text: string, color: string, seed = 1): PixelBuffer {
  const ink = color;
  const gl = [...text].map(ch => glyph(ch, 'big', ink, ink));
  const tw = gl.reduce((a, g) => a + g.adv, 0), th = Math.max(...gl.map(g => g.b.h));
  const pad = Math.round(Z * 4), bw = Math.max(2, Math.round(Z * 0.8));
  const w = tw + pad * 2, h = th + pad * 2 - Math.round(Z * 2);
  const b = new PixelBuffer(w + Math.round(h * 0.15) + 2, h);
  const c = hex(color);
  const shear = (y: number) => Math.round((h - y) * 0.12);
  const put = (x: number, y: number) => { if (vnoise(x * 0.5, y * 0.5, seed) > 0.22 && hash(x, y, seed) > 0.08) b.set(x + shear(y), y, c); };
  for (let x = 0; x < w; x++) for (let k = 0; k < bw; k++) { put(x, k); put(x, h - 1 - k); if (x > bw * 2 && x < w - bw * 2) { put(x, bw * 2 + k); put(x, h - 1 - bw * 2 - k); } }
  for (let y = 0; y < h; y++) for (let k = 0; k < bw; k++) { put(k, y); put(w - 1 - k, y); if (y > bw * 2 && y < h - bw * 2) { put(bw * 2 + k, y); put(w - 1 - bw * 2 - k, y); } }
  let x0 = pad;
  for (const g of gl) {
    for (let y = 0; y < g.b.h; y++) for (let x = 0; x < g.b.w; x++) if (g.b.data[y * g.b.w + x] >>> 24 > 128) put(x0 + x, pad - Math.round(Z * 1.5) + y);
    x0 += g.adv;
  }
  return b;
}

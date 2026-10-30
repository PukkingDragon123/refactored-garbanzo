// The Glowing Forest's fungi, painted pixel by pixel with their light on a second layer (drawn
// emissive): giant mushrooms with a lopsided scaly cap, a curled lip, glowing gills seen from below,
// a fibrous leaning stem with a torn skirt and a ragged cup at its foot, glowing mycelium threads;
// bracket shelves with banded growth zones, a wavy cream lip and a glowing pore face; and little
// clusters of glowing bonnets from hand-placed templates.

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { hex, mix } from './color';
import { Rng, bayer, clamp, fbm1, hash2 } from '../core/math';

export interface GlowSprite { buf: PixelBuffer; glow: PixelBuffer; ax: number; ay: number }
type RGB = [number, number, number];

const r = (...h: string[]): C[] => h.map(x => hex(x));
const CAP = r('#120e1e', '#1e1830', '#2a2242', '#382e58', '#483c6e', '#5a4c84', '#6e5e98', '#8574ac');
const STEM = r('#2a2a36', '#40404e', '#585868', '#727284', '#8e8ea0', '#aeaebe', '#ccccd8', '#e4e4ec');
const ZONES = r('#2a1a10', '#3e2816', '#5a3a1e', '#7a5228', '#9a6c34', '#b88a46', '#d0a862', '#e6c88a', '#f2e2b8');
const hp = (x: number, y: number, s: number) => hash2(Math.floor(x), Math.floor(y), s);
const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];
export const rgbHex = (c: RGB) => hex('#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join(''));

/** a giant glowing mushroom (anchor bottom centre) */
export function paintGiantShroom(seed: number, h: number, capW: number, col: RGB): GlowSprite {
  const rng = new Rng(seed * 31 + 9);
  const w = capW + 16, b = new PixelBuffer(w, h + 2), g = new PixelBuffer(w, h + 2);
  const gc = rgbHex(col), gHi = mix(gc, hex('#ffffff'), 0.45), gLo = mix(gc, hex('#000000'), 0.35);
  const capH = Math.round(capW * rng.range(0.3, 0.38)), lean = rng.range(-0.12, 0.12), cx0 = w / 2;
  const base = h + 1;
  // the stem's centre line leans and bows; it thickens down to a bulb
  const bow = rng.range(-3, 3);
  const stemX = (y: number) => cx0 + lean * capW * 0.6 * (1 - (y - capH) / (base - capH)) + Math.sin((y / base) * Math.PI) * bow;
  const r0 = Math.max(3, capW * 0.07), r1 = Math.max(4, capW * 0.1);
  const stemR = (y: number) => { const t = clamp((y - capH) / (base - capH)); return r0 + (r1 - r0) * t + Math.max(0, t - 0.82) * r1 * 3.2; };
  const skirtY = Math.round(capH + (base - capH) * rng.range(0.14, 0.22));
  for (let y = capH - 2; y <= base; y++) {
    const c = stemX(y), rr = stemR(y);
    for (let x = Math.floor(c - rr); x <= Math.ceil(c + rr); x++) {
      const u = (x - c) / rr;
      if (Math.abs(u) > 1) continue;
      // a cylinder lit from the left, fibres running down it, darker under the cap
      let l = 4.4 - u * 2.4 - (y < capH + 6 ? (capH + 6 - y) * 0.35 : 0) + (bayer(x, y) - 0.5) * 0.7;
      if (hp(x, y >> 2, seed) < 0.18) l -= 1;
      if (Math.abs(u) > 0.85) l -= 1;
      b.set(x, y, pick(STEM, l));
    }
  }
  // the skirt: a torn ring hanging from the stem, lit along its top
  {
    const c = stemX(skirtY), rr = stemR(skirtY) + 3;
    for (let x = Math.floor(c - rr); x <= Math.ceil(c + rr); x++) {
      const len = 2 + Math.floor(hp(x, 1, seed) * 3) + (Math.abs(x - c) < rr - 2 ? 1 : 0);
      for (let k = 0; k < len; k++) b.set(x, skirtY + k, pick(STEM, (k === 0 ? 6.5 : 5 - k * 0.8) - (x - c) / rr * 1.2));
    }
  }
  // the cup at its foot: torn membrane round the bulb
  {
    const c = stemX(base - 2), rr = stemR(base - 2) + 2;
    for (let x = Math.floor(c - rr); x <= Math.ceil(c + rr); x++) {
      const top = base - 5 - Math.floor(hp(x, 2, seed) * 4) * (Math.abs(x - c) > rr - 3 ? 1 : 0);
      for (let y = top; y <= base; y++) b.set(x, y, pick(STEM, 3.4 - (x - c) / rr * 1.4 + (y === top ? 1.6 : 0) + (bayer(x, y) - 0.5) * 0.6));
    }
  }
  // the cap: a lopsided dome, a wavy curled lip, warts on its shoulders
  const half = capW / 2, ccx = cx0 + lean * capW * 0.6;
  const top = new Float32Array(w).fill(1e9), rim = new Float32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    const u = (x - ccx) / half;
    if (Math.abs(u) > 1) continue;
    const ul = u - lean * 0.6;
    const t = capH * (1 - Math.pow(Math.min(1, Math.abs(ul) * 0.98), rng.range(1.7, 1.75))) + (fbm1(x * 0.12, 2, seed) - 0.5) * 2.4;
    top[x] = Math.max(0, Math.round(capH - t));
    rim[x] = capH + Math.round((fbm1(x * 0.2, 2, seed + 3) - 0.5) * 3 + (Math.abs(u) > 0.8 ? (Math.abs(u) - 0.8) * 14 : 0));
  }
  for (let x = 0; x < w; x++) {
    if (rim[x] < 0) continue;
    const u = (x - ccx) / half;
    for (let y = top[x]; y <= rim[x]; y++) {
      const v = (y - top[x]) / Math.max(1, rim[x] - top[x]);
      // light from the upper left, a dark band under the lip, radial fibrils
      let l = 4.2 - u * 1.8 - v * 2.2 + (y === top[x] ? 1.5 : 0) + (bayer(x, y) - 0.5) * 0.8;
      const ang = Math.atan2(y - capH * 1.4, x - ccx);
      if (Math.floor(ang * 26 + fbm1(y * 0.1, 1, seed) * 2) % 3 === 0) l -= 0.6;
      if (y >= rim[x] - 1) l -= 1.2;
      b.set(x, y, pick(CAP, l));
      // scales: pale flecks in loose rings, some of them glowing
      const sc = hp(x >> 1, y >> 1, seed + 5);
      if (v < 0.75 && sc < 0.07) {
        b.set(x, y, pick(CAP, 6.5 - v * 2));
        if (sc < 0.035) g.set(x, y, gHi);
      }
    }
    // warts standing up off the dome
    if (hp(x, 3, seed) < 0.12 && Math.abs(u) < 0.85) { b.set(x, top[x] - 1, pick(CAP, 6)); g.set(x, top[x] - 1, gc); }
  }
  // the gills, seen from below: glowing lines converging on the stem
  for (let x = 0; x < w; x++) {
    if (rim[x] < 0) continue;
    const sx = stemX(capH + 2), dx = x - sx;
    const depth = Math.max(1, Math.round(4 + (1 - Math.abs(dx) / half) * capH * 0.22));
    for (let k = 1; k <= depth; k++) {
      const y = rim[x] + k - Math.round(Math.abs(dx) / half * 2);
      if (y <= rim[x]) continue;
      if (Math.abs(dx) < stemR(y) - 0.5) continue;
      const line = Math.floor((dx * (1 - k / (depth + 1) * 0.5)) / 2) % 2 === 0;
      b.set(x, y, line ? pick(CAP, 2) : pick(CAP, 1));
      g.set(x, y, line ? (k < 2 ? gHi : gc) : gLo);
    }
  }
  b.outline(hex('#0a0814'));
  // glowing threads of mycelium wandering off along the ground from the foot
  for (let i = 0; i < 6; i++) {
    let x = stemX(base) + rng.range(-3, 3), y = base;
    const dir = i % 2 ? 1 : -1;
    for (let s = 0; s < rng.range(8, 22); s++) {
      x += dir * (rng.chance(0.7) ? 1 : 0);
      y = clamp(y + (rng.chance(0.25) ? (rng.chance(0.5) ? -1 : 1) : 0), base - 1, base + 1);
      g.set(x, y, s % 4 === 0 ? gc : gLo);
    }
  }
  return { buf: b, glow: g, ax: Math.round(cx0), ay: base };
}

/**
 * A bracket fungus you can stand on (anchor top-left, row 1 = the walking surface): banded growth
 * zones running parallel to its wavy lip, a cream rim, the pore face underneath glowing.
 */
export function paintShelf(seed: number, w: number, col: RGB): GlowSprite {
  const h = Math.round(w * 0.36) + 2, b = new PixelBuffer(w, h), g = new PixelBuffer(w, h);
  const gc = rgbHex(col), gHi = mix(gc, hex('#ffffff'), 0.4);
  const bot = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w;
    // a scalloped margin: two or three lobes
    const lobe = 0.82 + 0.18 * Math.abs(Math.sin(u * Math.PI * (2 + (seed % 2)) + seed)) + (fbm1(x * 0.2, 2, seed) - 0.5) * 0.12;
    bot[x] = 2 + (h - 4) * Math.pow(Math.sin(u * Math.PI), 0.55) * lobe;
  }
  for (let x = 0; x < w; x++) {
    const t0 = (x < 2 || x > w - 3) ? 1 : 0;
    for (let y = t0; y <= Math.round(bot[x]); y++) {
      const d = bot[x] - y;
      // the top, seen from above: growth zones parallel to the lip, the oldest (darkest) at the trunk
      const band = Math.floor((d + fbm1(x * 0.15, 1, seed + 2) * 1.5) / 2);
      let l = 2.6 + (y / h) * 2.4 + (band % 3 === 0 ? 1.6 : band % 3 === 1 ? 0 : -0.9) + (bayer(x, y) - 0.5) * 0.7;
      if (y <= 1) l = 6.6 - y * 0.8 + (hp(x, 0, seed) < 0.15 ? -2 : 0);
      if (d < 1.2) l = 7.4;
      b.set(x, y, pick(ZONES, l));
    }
    // the pore face under the lip
    const by = Math.round(bot[x]);
    g.set(x, by, gHi);
    if (hp(x, 1, seed) < 0.7) g.set(x, by - 1, gc);
  }
  b.outline(hex('#140c08'));
  for (let x = 1; x < w - 1; x++) if (hp(x, 2, seed) < 0.5) { const by = Math.round(bot[x]) + 1; b.set(x, by, pick(ZONES, 2)); g.set(x, by, gc); }
  return { buf: b, glow: g, ax: 0, ay: 1 };
}

// hand-placed bonnets: o outline, c/C/h cap dark/mid/lit, g gill glow, G glowing cap spot (stems drawn separately)
const BONNETS = [
  ['..oho..', '.oChCo.', 'oCCCCco', 'oggggg.'],
  ['.ohho.', 'oChCCo', 'ogggg.'],
  ['..o..', '.oho.', 'oCGco', '.ggg.'],
  ['...ooo...', '.ooChhCo.', 'oCCCCCCco', 'ogggggggo'],
];
/** a cluster of little glowing bonnets on thin pale stems (anchor bottom centre) */
export function paintFungusClump(seed: number, col: RGB): GlowSprite {
  const rng = new Rng(seed * 7 + 1);
  const W = 24, H = 18, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H);
  const gc = rgbHex(col), gHi = mix(gc, hex('#ffffff'), 0.45);
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const t = BONNETS[rng.int(0, BONNETS.length - 1)];
    const tw = t[0].length, th = t.length;
    const x0 = Math.round(2 + (i / Math.max(1, n - 1)) * (W - tw - 4) + rng.range(-1, 1));
    const stemH = rng.int(3, H - th - 2), y0 = H - 1 - stemH - th;
    const sx = x0 + Math.floor(tw / 2), bend = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k <= stemH; k++) b.set(sx + (k < stemH * 0.4 ? 0 : bend * (k > stemH * 0.8 ? 1 : 0)), y0 + th + k - 1, pick(STEM, 6 - (k / stemH) * 2));
    t.forEach((row, yy) => { for (let xx = 0; xx < tw; xx++) {
      const ch = row[xx], X = x0 + xx, Y = y0 + yy;
      if (ch === 'o') b.set(X, Y, CAP[0]);
      else if (ch === 'c') b.set(X, Y, CAP[2]);
      else if (ch === 'C') b.set(X, Y, CAP[4]);
      else if (ch === 'h') b.set(X, Y, CAP[6]);
      else if (ch === 'g') { b.set(X, Y, CAP[1]); g.set(X, Y, xx % 2 ? gc : gHi); }
      else if (ch === 'G') { b.set(X, Y, CAP[6]); g.set(X, Y, gHi); }
    } });
  }
  return { buf: b, glow: g, ax: W / 2, ay: H - 1 };
}

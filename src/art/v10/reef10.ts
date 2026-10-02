// V10 art: Glass Reef from below. Pale rippled sand with coral rubble, bommies (coral-crusted rock
// outcrops with a shady overhang), staghorn and table corals, brain-coral domes, sea fans,
// anemones and urchins, all a little blue with depth. Geometry lives here too (RF, groundReef).

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { bayer, clamp, hash2, noise1, noise2, Rng } from '../../core/math';

export const RF = { W: 1900, FLOOR: 300, BOT: 420, SURF: -40 };
/** the bommies: [x centre, half-width, height] */
export const BOMMIES: [number, number, number][] = [[420, 70, 70], [980, 96, 96], [1520, 80, 60]];
export function groundReef(x: number): number {
  let y = RF.FLOOR + Math.sin(x * 0.006) * 8 + Math.sin(x * 0.031) * 2;
  for (const [cx, hw, h] of BOMMIES) {
    const u = (x - cx) / hw;
    if (Math.abs(u) < 1) y = Math.min(y, RF.FLOOR + 4 - h * Math.sqrt(1 - u * u) * (0.85 + noise1(x / 9, cx) * 0.15));
  }
  return y;
}

const SAND = ['#8a9a98', '#a2b2ac', '#bac8be', '#d2dccc'].map(h => hex(h));
const ROCK = ['#3a4a52', '#4a5c64', '#5c7076', '#70868a'].map(h => hex(h));
const pick = (r: C[], f: number) => r[clamp(Math.floor(f), 0, r.length - 1)];
const deep = (c: C, k: number) => mix(c, hex('#2a5a7a'), k);

export interface RChunk { x0: number; y0: number; buf: PixelBuffer }
export function paintReefFloor(x0: number, w: number): RChunk {
  let top = 1e9;
  for (let x = x0; x < x0 + w; x++) top = Math.min(top, groundReef(x));
  const y0 = Math.floor(top) - 2, h = RF.BOT - y0;
  const b = new PixelBuffer(w, h);
  for (let x = x0; x < x0 + w; x++) {
    const gy = groundReef(x);
    const onRock = BOMMIES.some(([cx, hw]) => Math.abs(x - cx) < hw);
    for (let y = Math.max(y0, Math.floor(gy)); y < RF.BOT; y++) {
      const d = y - gy;
      let c: C;
      const rockHere = onRock && y < RF.FLOOR + 6;
      if (rockHere) {
        // coral-crusted rock: purple and orange encrusting patches on grey-blue stone
        c = pick(ROCK, 1.6 + noise2(x / 5, y / 4, 3) * 1.6 + (bayer(x, y) - 0.5) * 0.6);
        const n = noise2(x / 7, y / 6, 4);
        if (n > 0.66) c = mix(hex('#9a5a8a'), hex('#c87aa8'), noise1(x / 2 + y, 5));
        else if (n < 0.24) c = mix(hex('#c8783a'), hex('#e8a050'), noise1(x / 2 - y, 6));
        if (d < 2) c = shade(c, 0.15);
      } else {
        // sand ripples, rubble, the odd shell
        const rip = Math.sin(x * 0.35 + noise1(x / 30, 7) * 4 + y * 0.2) * 0.5;
        c = pick(SAND, 1.6 + rip + (bayer(x, y) - 0.5) * 0.7 - Math.min(1.2, d * 0.012));
        const g = hash2(x, y, 8);
        if (g < 0.01) c = hex('#e8e0d8');
        else if (g < 0.03) c = pick(ROCK, 2);
        if (d < 1.2) c = SAND[3];
      }
      b.set(x - x0, y - y0, deep(c, clamp(0.15 + d * 0.004)));
    }
  }
  return { x0, y0, buf: b };
}

export interface RSpr { buf: PixelBuffer; ax: number; ay: number }
const ol = (b: PixelBuffer, k = 0.6) => { b.outline((c: C) => mix(shade(c, -0.6), hex('#0a1a24'), k)); return b; };
export type CoralKind = 'staghorn' | 'table' | 'brain' | 'fan' | 'anemone' | 'urchin' | 'rubble';
export function coralSprite(kind: CoralKind, seed: number): RSpr {
  const rng = new Rng(seed * 7 + kind.length);
  if (kind === 'staghorn') {
    const W = 40, H = 34, b = new PixelBuffer(W, H);
    const base = [hex('#c88a5a'), hex('#e0a670'), hex('#f0c090')], tip = hex('#f8a0c0');
    const grow = (x: number, y: number, a: number, len: number, depth: number) => {
      for (let i = 0; i < len; i++) {
        x += Math.cos(a); y += Math.sin(a);
        a += rng.range(-0.15, 0.15);
        b.set(Math.round(x), Math.round(y), i > len - 3 ? tip : base[Math.min(2, Math.floor(i / len * 3 + rng.next() * 0.5))]);
        b.set(Math.round(x) + 1, Math.round(y), base[0]);
        if (depth < 3 && rng.chance(0.12) && i > 3) grow(x, y, a + rng.range(-0.8, 0.8), len * 0.6, depth + 1);
      }
    };
    for (let i = 0; i < 5; i++) grow(W / 2 + rng.range(-6, 6), H - 1, -Math.PI / 2 + rng.range(-0.8, 0.8), rng.range(16, 26), 0);
    return { buf: ol(b, 0.4), ax: W / 2, ay: H - 1 };
  }
  if (kind === 'table') {
    const W = 50, H = 24, b = new PixelBuffer(W, H);
    for (let y = 8; y < H; y++) for (let x = 22; x < 28; x++) b.set(x, y, pick(ROCK, 1.5 + (x - 22) * 0.3));
    for (let x = 2; x < W - 2; x++) {
      const t = 6 + Math.abs(x - W / 2) * 0.08 + noise1(x / 4, seed) * 2;
      for (let y = Math.floor(t); y < t + 4; y++) b.set(x, y, y < t + 1 ? hex('#b8e0a0') : mix(hex('#7aa86a'), hex('#4a7a52'), (y - t) / 4));
    }
    return { buf: ol(b, 0.4), ax: W / 2, ay: H - 1 };
  }
  if (kind === 'brain') {
    const W = 30, H = 18, b = new PixelBuffer(W, H);
    b.ellipseFn(W / 2, H - 1, W / 2 - 1, H - 2, (x, y, nx, ny) => {
      const groove = Math.sin(x * 1.1 + Math.sin(y * 0.9) * 2.4) > 0.55;
      const k = 1.6 - nx * 0.6 - ny * 1.1 + (groove ? -1 : 0);
      return pick([hex('#6a7a3a'), hex('#8a9a4a'), hex('#aab85a'), hex('#c8d478')], k);
    });
    return { buf: ol(b), ax: W / 2, ay: H - 1 };
  }
  if (kind === 'fan') {
    const W = 34, H = 40, b = new PixelBuffer(W, H);
    const c0 = hex('#8a3a9a'), c1 = hex('#b85ac8'), c2 = hex('#d88ae0');
    for (let i = 0; i < 260; i++) {
      const a = -Math.PI / 2 + rng.range(-0.9, 0.9), r = rng.range(2, 34);
      const x = W / 2 + Math.cos(a) * r * 0.55, y = H - 2 + Math.sin(a) * r;
      b.set(Math.round(x), Math.round(y), r > 28 ? c2 : rng.chance(0.5) ? c1 : c0);
    }
    for (let y = H - 8; y < H; y++) b.set(W / 2, y, c0);
    return { buf: b, ax: W / 2, ay: H - 1 };
  }
  if (kind === 'anemone') {
    const W = 22, H = 16, b = new PixelBuffer(W, H);
    b.ellipse(11, 14, 7, 2.5, hex('#c84a5a'));
    for (let i = 0; i < 14; i++) {
      const x0 = 4 + i, sway = Math.sin(i * 0.9) * 2;
      for (let y = 0; y < 9; y++) b.set(Math.round(x0 + sway * (y / 9)), 13 - y, y > 6 ? hex('#ffd0a0') : hex('#f08a6a'));
    }
    return { buf: ol(b, 0.5), ax: 11, ay: 15 };
  }
  if (kind === 'urchin') {
    const W = 14, H = 10, b = new PixelBuffer(W, H);
    for (let i = 0; i < 18; i++) { const a = Math.PI + (i / 17) * Math.PI; b.line(7, 8, 7 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, hex('#1a1424')); }
    b.ellipse(7, 8, 3, 2, hex('#2a1a3a'));
    return { buf: b, ax: 7, ay: 9 };
  }
  // rubble: a broken coral twig (the collectible)
  const b = new PixelBuffer(14, 6);
  b.line(1, 4, 12, 2, hex('#e8c8b0'));
  b.line(1, 5, 12, 3, hex('#c8a088'));
  b.set(12, 1, hex('#f8a0c0')); b.set(13, 2, hex('#f8a0c0')); b.set(6, 2, hex('#f0d0c0'));
  return { buf: ol(b, 0.4), ax: 7, ay: 5 };
}

/** the depth gradient behind everything */
export function paintDeepBg(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, mix(hex('#6ac0d8'), hex('#0e3650'), clamp(y / (h * 0.9) + (bayer(x, y) - 0.5) * 0.04)));
  return b;
}
/** far bommies as soft silhouettes */
export function paintFarReef(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let x = 0; x < w; x++) {
    const t = h - 10 - Math.max(0, noise1(x / 60, seed) - 0.35) * h * 1.3 - noise1(x / 9, seed + 1) * 4;
    for (let y = Math.max(0, Math.floor(t)); y < h; y++) b.set(x, y, mix(hex('#2a6a86'), hex('#1c4e68'), clamp((y - t) / 40)));
  }
  return b;
}

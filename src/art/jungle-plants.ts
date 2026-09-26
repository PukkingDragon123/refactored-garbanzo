// Undergrowth, fungi and deadwood for the V2 jungle. See jungle.ts for the public API docs.
// All sprites are anchored bottom-centre on the ground line unless noted (hanging vines: top).

import { PixelBuffer } from './pixel';
import { C } from './color';
import { Rng, clamp, fbm2, noise2, hash2, TAU } from '../core/math';
import {
  Sprite, JP, Ramp, P, rc, leafMass, crown, frond, blade, tube, vine, mossBlob, leafStamp, drawStamp, arc, along,
  outlineSel, trimSprite, bigLeaf, flower, occlude, mix, shade, hex, withA, despeckle,
} from './jungle-core';
import { astelia } from './jungle-trees';

export type PlantKind =
  | 'fern' | 'crownfern' | 'kiokio' | 'umbrellafern' | 'kidneyfern' | 'flax' | 'kawakawa' | 'taro' | 'grass' | 'sedge'
  | 'moss' | 'flowers' | 'lily' | 'pitcher' | 'shrub' | 'seedling' | 'vine' | 'fiddlehead' | 'lanternpod' | 'astelia';
export const PLANT_KINDS: PlantKind[] = ['fern', 'crownfern', 'kiokio', 'umbrellafern', 'kidneyfern', 'flax', 'kawakawa', 'taro', 'grass', 'sedge', 'moss', 'flowers', 'lily', 'pitcher', 'shrub', 'seedling', 'vine', 'fiddlehead', 'lanternpod', 'astelia'];

export type FungusKind = 'glowcap' | 'bracket' | 'inkcap' | 'bluecap' | 'starfish' | 'veil' | 'lantern' | 'coral' | 'puffball' | 'spiral';
export const FUNGUS_KINDS: FungusKind[] = ['glowcap', 'bracket', 'inkcap', 'bluecap', 'starfish', 'veil', 'lantern', 'coral', 'puffball', 'spiral'];

export type DeadwoodKind = 'log' | 'rottenlog' | 'stump' | 'rock' | 'roots' | 'branch' | 'litter';
export const DEADWOOD_KINDS: DeadwoodKind[] = ['log', 'rottenlog', 'stump', 'rock', 'roots', 'branch', 'litter'];

const SEDGE: Ramp = ['#2a1a0c', '#452a10', '#613c14', '#7e521a', '#9a6922', '#b6832e', '#cc9f42', '#e0bf66'].map(h => hex(h));

function canvas(w: number, h: number) {
  return new PixelBuffer(Math.ceil(w), Math.ceil(h));
}
function done(buf: PixelBuffer, ax: number, ay: number, outline = 0.5, glow?: PixelBuffer): Sprite {
  if (outline > 0) outlineSel(buf, outline);
  return trimSprite({ buf, ax: Math.round(ax), ay: Math.round(ay), glow });
}

// ------------------------------------------------------------------ ferns

interface RosetteOpts {
  n: [number, number];
  len: number;
  /** total angular spread of the launch angles (rad) */
  spread: number;
  /** droop range; side fronds droop more */
  droop: [number, number];
  ramp: Ramp;
  pinna: number;
  pinnaW?: number;
  gap?: number;
  sweep?: number;
  hang?: number;
  /** ramp for the odd young (reddish) frond */
  young?: Ramp;
  under?: Ramp;
  /** crown height above the ground */
  lift?: number;
}

/** Rosette of fronds from (x, y): back (dark, upright) -> side -> front (light, arching toward viewer). */
function rosette(buf: PixelBuffer, rng: Rng, x: number, y: number, o: RosetteOpts) {
  const n = rng.int(o.n[0], o.n[1]);
  const fr: { a: number; layer: number; len: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * o.spread + rng.range(-0.1, 0.1);
    fr.push({ a, layer: i % 3 === 1 ? 0 : i % 3 === 0 ? 1 : 2, len: o.len * rng.range(0.78, 1.05), d: rng.range(o.droop[0], o.droop[1]) });
  }
  const cy = y - (o.lift ?? 2);
  for (const layer of [0, 1, 2])
    for (const f of fr) {
      if (f.layer !== layer) continue;
      const side = Math.abs(Math.cos(f.a));
      const young = !!o.young && rng.chance(0.2);
      const rp = young ? o.young! : o.ramp;
      const base = layer === 0 ? 4 : layer === 1 ? 5 : 6;
      const len = f.len * (layer === 0 ? 0.82 : layer === 2 ? 1 : 0.95) * (young ? 0.7 : 1);
      frond(buf, {
        x: x + rng.range(-1, 1), y: cy, ang: f.a, len, droop: f.d * (0.35 + side * 1.1) * (layer === 2 ? 1.15 : layer === 0 ? 0.7 : 1),
        ramp: rp, base, pinna: o.pinna * (young ? 0.7 : 1), pinnaW: o.pinnaW ?? 2, gap: o.gap ?? 1.8, sweep: o.sweep ?? 0.9, hang: o.hang ?? 0.1,
        under: o.under, underBase: o.under ? 3 : base - 2, bare: 0.1, curl: young ? 1.2 : 0, rachisTop: layer === 2,
      });
    }
}

function fern(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 41 + 3);
  const S = size;
  const buf = canvas(S * 2.4 + 10, S * 1.25 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  rosette(buf, rng, x, y, { n: [7, 10], len: S * 1.08, spread: 2.9, droop: [0.6, 0.9], ramp: JP.fern, pinna: Math.max(3, S * 0.16), pinnaW: 1.8, gap: 1.8, sweep: 0.85, lift: S * 0.06 });
  return done(buf, x, y + 1);
}

function crownfern(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 43 + 5);
  const S = size;
  const buf = canvas(S * 2 + 10, S * 1.25 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  // stiff, upright, glossy dark fronds with ladder pinnae
  rosette(buf, rng, x, y, { n: [11, 15], len: S * 1.05, spread: 2.3, droop: [0.2, 0.4], ramp: JP.canopy, pinna: Math.max(3, S * 0.12), pinnaW: 2, gap: 1.5, sweep: 1.25, hang: 0.02, lift: S * 0.08 });
  return done(buf, x, y + 1);
}

function kiokio(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 47 + 7);
  const S = size;
  const buf = canvas(S * 2.6 + 10, S * 1.2 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  rosette(buf, rng, x, y, { n: [6, 9], len: S * 1.15, spread: 2.7, droop: [0.7, 1.0], ramp: JP.fern, pinna: Math.max(4, S * 0.2), pinnaW: 3, gap: 2.8, sweep: 1.05, hang: 0.16, young: JP.youngFrond, lift: S * 0.05 });
  return done(buf, x, y + 1);
}

function umbrellafern(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 53 + 11);
  const S = size;
  const buf = canvas(S * 2.4 + 10, S * 1.2 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const stalks = rng.int(3, 5);
  const list = Array.from({ length: stalks }, () => ({ sx: x + rng.range(-S * 0.55, S * 0.55), h: S * rng.range(0.5, 1.0) })).sort((a, b) => b.h - a.h);
  for (const { sx, h } of list) {
    for (let s = 0; s < h; s++) buf.set(sx + Math.sin(s * 0.1) * 0.6, y - s, rc(JP.fernTrunk, 6));
    const tiers = h > S * 0.75 ? 2 : 1;
    for (let t = 0; t < tiers; t++) {
      const ty = y - h + t * S * 0.18;
      const L = S * rng.range(0.4, 0.55) * (1 - t * 0.2);
      for (const side of [-1, 1]) for (const lift of [0.1, 0.45]) {
        frond(buf, { x: sx, y: ty, ang: side < 0 ? Math.PI + lift : -lift, len: L * (lift > 0.3 ? 0.8 : 1), droop: 0.55, ramp: JP.fern, base: 6 - t - (lift > 0.3 ? 1 : 0), pinna: 3, pinnaW: 1.5, gap: 1.3, sweep: 1.2, hang: 0.05, bare: 0.04 });
      }
    }
  }
  return done(buf, x, y + 1);
}

function kidneyfern(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 59 + 13);
  const S = size * 0.7;
  const buf = canvas(S * 2.4 + 8, S * 1.3 + 6);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(7, 11);
  const leaves: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) leaves.push({ x: x + rng.range(-S * 0.9, S * 0.9), y: y - rng.range(S * 0.2, S * 0.95), r: rng.range(S * 0.18, S * 0.28) });
  leaves.sort((a, b) => a.y - b.y);
  for (const l of leaves) {
    for (let s = 0; s < y - l.y; s++) buf.set(l.x + (x - l.x) * (s / (y - l.y)) * 0.3, l.y + s, rc(JP.fernTrunk, 4));
    // translucent kidney-shaped leaf with radiating veins
    buf.ellipseFn(l.x, l.y, l.r * 1.25, l.r, (_px, _py, nx, ny) => {
      if (ny > 0.55 && Math.abs(nx) < 0.2) return -1; // notch
      const lit = -nx * 0.5 - ny * 0.8;
      const a = Math.atan2(ny, nx);
      const vein = Math.abs(Math.sin(a * 5)) < 0.18 && Math.hypot(nx, ny) > 0.25;
      let k = 5 + (lit > 0.3 ? 1 : lit < -0.35 ? -1 : 0) + (vein ? -1 : 0);
      if (Math.hypot(nx, ny) > 0.86) k = lit > 0 ? 7 : 3;
      return rc(JP.kawakawa, k);
    });
  }
  return done(buf, x, y + 1, 0.45);
}

// ------------------------------------------------------------------ flax, grass, sedge

function flax(seed: number, size: number, flowers = true): Sprite {
  const rng = new Rng(seed * 61 + 17);
  const S = size;
  const buf = canvas(S * 2.2 + 12, S * 1.6 + 10);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(14, 20);
  const leaves: { a: number; len: number; layer: number; droop: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    leaves.push({ a: -Math.PI / 2 + t * 2.3 + rng.range(-0.08, 0.08), len: S * rng.range(0.7, 1.1) * (1 - Math.abs(t) * 0.35), layer: rng.int(0, 2), droop: 0.15 + Math.abs(t) * 1.0 + rng.range(0, 0.4) });
  }
  // flower stalks behind
  if (flowers && rng.chance(0.75)) {
    const ns = rng.int(1, 2);
    for (let k = 0; k < ns; k++) {
      const sx = x + rng.range(-S * 0.15, S * 0.15);
      const h = S * rng.range(1.25, 1.5);
      const lean = rng.range(-0.15, 0.15);
      const top: P = [sx + lean * h, y - h];
      tube(buf, [[sx, y], [(sx + top[0]) / 2, y - h / 2], top], t => 1.3 - t * 0.5, JP.tan, 2, { spread: 1.5 });
      for (let b = 0; b < 6; b++) {
        const t = 0.55 + b * 0.075;
        const bx = sx + lean * h * t, by = y - h * t;
        const side = b % 2 ? 1 : -1;
        const ex = bx + side * rng.range(3, 6), ey = by - rng.range(1, 4);
        buf.line(bx, by, ex, ey, rc(JP.tan, 2));
        // tubular red-orange flowers
        for (let f = 0; f < 3; f++) {
          const fx = ex + side * f * 0.8, fy = ey - f;
          buf.set(fx, fy, rc(JP.red, 5 + (f === 2 ? 1 : 0)));
          buf.set(fx, fy + 1, rc(JP.red, 4));
        }
      }
    }
  }
  for (const layer of [0, 1, 2])
    for (const l of leaves) {
      if (l.layer !== layer) continue;
      blade(buf, { x: x + rng.range(-2, 2), y: y + 1, ang: l.a, len: l.len, droop: l.droop, w0: Math.max(3, S * 0.085), ramp: JP.flax, base: 3 + layer * 2, edge: rc(JP.flaxEdge, 2 + layer), fold: true });
    }
  // base fan
  occlude(buf, x, y, S * 0.25, 3, 0.4);
  return done(buf, x, y + 1);
}

function grass(seed: number, size: number, ramp: Ramp = JP.moss, blades?: number): Sprite {
  const rng = new Rng(seed * 67 + 19);
  const S = size;
  const buf = canvas(S * 1.8 + 8, S + 4);
  const x = buf.w / 2, y = buf.h - 1;
  const n = blades ?? rng.int(9, 15);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * 1.8 + rng.range(-0.15, 0.15);
    const L = S * rng.range(0.55, 1.05);
    const pts = arc(x + t * S * 0.3, y, a, L, rng.range(0.1, 0.5) + Math.abs(t));
    const base = rng.int(3, ramp.length - 2);
    for (let k = 0; k < pts.length; k++) {
      const f = k / (pts.length - 1);
      const [px, py] = pts[k];
      buf.set(px, py, rc(ramp, base + (f > 0.75 ? 1 : f < 0.25 ? -2 : 0)));
      if (f < 0.35 && S > 10) buf.set(px + 1, py, rc(ramp, base - 1));
    }
  }
  return done(buf, x, y + 1, 0);
}

// ------------------------------------------------------------------ kawakawa, taro, shrubs

function kawakawa(seed: number, size: number, fruit = true): Sprite {
  const rng = new Rng(seed * 71 + 23);
  const S = size;
  const buf = canvas(S * 1.9 + 12, S * 1.3 + 10);
  const x = buf.w / 2, y = buf.h - 2;
  // jointed stems
  const stems: P[][] = [];
  const ns = rng.int(4, 6);
  for (let i = 0; i < ns; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / ns - 0.5) * 1.6;
    const pts: P[] = [];
    let px = x + rng.range(-2, 2), py = y, aa = a;
    const segs = rng.int(3, 4);
    for (let k = 0; k <= segs; k++) {
      pts.push([px, py]);
      const L = (S / segs) * rng.range(0.7, 1.0);
      px += Math.cos(aa) * L;
      py += Math.sin(aa) * L;
      aa += rng.range(-0.35, 0.35);
    }
    stems.push(pts);
    tube(buf, pts, t => 1.6 - t * 0.7, JP.kawakawa, 2, { spread: 1.2 });
    for (let k = 1; k < pts.length; k++) buf.disc(pts[k][0], pts[k][1], 1.3, rc(JP.kawakawa, 3)); // swollen nodes
  }
  // leaves: back pass darker, front pass lighter, heart-shaped with caterpillar holes
  const all: { x: number; y: number; a: number; front: boolean }[] = [];
  for (const pts of stems) for (let k = 1; k < pts.length; k++) {
    const [px, py] = pts[k];
    const nl = rng.int(2, 4);
    for (let j = 0; j < nl; j++) all.push({ x: px + rng.range(-2, 2), y: py + rng.range(-2, 2), a: rng.range(0, TAU), front: rng.chance(0.55) });
  }
  all.sort((a, b) => (a.front === b.front ? a.y - b.y : a.front ? 1 : -1));
  for (const l of all) {
    const a = l.a * 0.6 + (Math.sin(l.a) > 0 ? Math.PI / 2 : -Math.PI / 2) * 0.4;
    const len = S * rng.range(0.22, 0.32);
    bigLeaf(buf, { x: l.x, y: l.y, ang: a, len, wid: len * 0.95, ramp: JP.kawakawa, base: l.front ? 6 : 4, shape: 'heart', droop: 0.25, veins: 3, holes: rng.int(0, 3), rng, rib: 1 });
  }
  if (fruit) for (let i = 0; i < rng.int(2, 4); i++) {
    const pts = stems[rng.int(0, stems.length - 1)];
    const p = pts[rng.int(1, pts.length - 1)];
    // upright orange fruit spikes
    for (let s = 0; s < 6; s++) {
      buf.set(p[0], p[1] - s, rc(JP.orange, 5 + (s % 2)));
      buf.set(p[0] + 1, p[1] - s, rc(JP.orange, 4));
    }
  }
  return done(buf, x, y + 1);
}

function taro(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 73 + 29);
  const S = size;
  const buf = canvas(S * 2.2 + 16, S * 1.4 + 10);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(3, 5);
  const leaves: { a: number; h: number; len: number; layer: number }[] = [];
  for (let i = 0; i < n; i++) leaves.push({ a: ((i + 0.5) / n - 0.5) * 1.6, h: S * rng.range(0.55, 0.95), len: S * rng.range(0.55, 0.8), layer: i % 2 });
  leaves.sort((a, b) => a.layer - b.layer);
  for (const l of leaves) {
    // petiole
    const tipx = x + Math.sin(l.a) * l.h * 0.6, tipy = y - l.h;
    const pts: P[] = [[x + rng.range(-2, 2), y], [x + Math.sin(l.a) * l.h * 0.25, y - l.h * 0.55], [tipx, tipy]];
    tube(buf, pts, t => 2 - t * 0.9, JP.taro, 4 + l.layer, { spread: 1.4 });
    // blade hangs from the tip, pointing outward & down
    const side = l.a < 0 ? -1 : 1;
    const ang = side < 0 ? Math.PI * 0.62 + rng.range(-0.1, 0.1) : Math.PI * 0.38 + rng.range(-0.1, 0.1);
    bigLeaf(buf, { x: tipx, y: tipy - 2, ang: ang + (side < 0 ? 0.35 : -0.35), len: l.len, wid: l.len * 0.8, ramp: JP.taro, base: 4 + l.layer * 2, shape: 'heart', droop: 0.35, veins: 5, rib: 1, ao: 0.6 });
  }
  return done(buf, x, y + 1);
}

function shrub(seed: number, size: number, berries = true): Sprite {
  const rng = new Rng(seed * 79 + 31);
  const S = size;
  const buf = canvas(S * 1.6 + 12, S + 10);
  const x = buf.w / 2, y = buf.h - 2;
  for (let i = 0; i < 4; i++) tube(buf, [[x + rng.range(-3, 3), y], [x + rng.range(-S * 0.4, S * 0.4), y - S * 0.5]], t => 1.8 - t, JP.bark, 3);
  const cl = crown(buf, rng, { cx: x, cy: y - S * 0.48, rx: S * 0.7, ry: S * 0.45, ramp: rng.chance(0.5) ? JP.canopy : JP.canopyOlive, n: rng.int(4, 6), lo: 1, hi: 4, shape: 'oval', len: [3, 5], wid: [2.5, 3], density: 0.85, flatBottom: 0.6, size: [0.4, 0.6] });
  if (berries) for (let i = 0; i < S * 0.5; i++) {
    const c = cl[rng.int(0, cl.length - 1)];
    const bx = c.x + rng.range(-c.rx, c.rx) * 0.8, by = c.y + rng.range(-c.ry, c.ry) * 0.8;
    if (!buf.opaque(bx, by)) continue;
    buf.set(bx, by, rc(JP.orange, 6));
    buf.set(bx + 1, by, rc(JP.orange, 4));
    buf.set(bx, by + 1, rc(JP.orange, 3));
  }
  return done(buf, x, y + 1);
}

function seedling(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 83 + 37);
  const S = size;
  const buf = canvas(S * 1.6 + 8, S + 6);
  const x = buf.w / 2, y = buf.h - 2;
  if (seed % 2 === 0) {
    // nīkau seedling: a few broad pleated fan leaves
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i / 3 - 0.5) * 1.8;
      bigLeaf(buf, { x, y, ang: a, len: S * rng.range(0.7, 1), wid: S * 0.32, ramp: JP.palmLeaf, base: 4 + (i % 2) * 2, shape: 'lance', droop: 0.6, veins: 6, rib: -1 });
    }
  } else {
    // kauri ricker: slim conical sapling
    for (let s = 0; s < S; s++) buf.set(x, y - s, rc(JP.kauri, 5));
    for (let t = 0.2; t < 1; t += 0.12) {
      const w = (1 - t) * S * 0.35 + 2;
      leafMass(buf, rng, { cx: x, cy: y - S * t, rx: w, ry: 2.5, ramp: JP.kauriLeaf, base: 3, steps: 3, len: [3, 4], wid: [2, 2.5], density: 1, core: false, jag: 0.2 });
    }
  }
  return done(buf, x, y + 1);
}

// ------------------------------------------------------------------ flowers, lily, pitcher, moss

type FlowerTint = 'white' | 'pink' | 'gold' | 'blue' | 'red' | 'violet';
const FLOWER: Record<FlowerTint, Ramp> = { white: JP.cream, pink: JP.pink, gold: JP.gold, blue: JP.blueShroom, red: JP.red, violet: JP.violet };

function flowers(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 89 + 41);
  const tint = (['white', 'pink', 'gold', 'blue', 'red', 'violet'] as FlowerTint[])[seed % 6];
  const S = size;
  const buf = canvas(S * 1.8 + 8, S + 6);
  const x = buf.w / 2, y = buf.h - 2;
  // leafy base
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 2.6;
    const st = leafStamp('point', S * rng.range(0.3, 0.45), 3, a);
    drawStamp(buf, st, x + rng.range(-2, 2), y, JP.kawakawa, 4 + (i % 2));
  }
  const n = rng.int(4, 8);
  const fr = FLOWER[tint];
  const heads: P[] = [];
  for (let i = 0; i < n; i++) {
    const fx = x + rng.range(-S * 0.7, S * 0.7), fy = y - rng.range(S * 0.35, S * 0.95);
    const pts = [[x + (fx - x) * 0.2, y], [fx, fy]] as P[];
    for (let s = 0; s <= 1; s += 0.05) buf.set(pts[0][0] + (fx - pts[0][0]) * s + Math.sin(s * 3) * 0.6, y + (fy - y) * s, rc(JP.moss, 4));
    heads.push([fx, fy]);
  }
  heads.sort((a, b) => a[1] - b[1]);
  for (const [fx, fy] of heads) {
    if (tint === 'red') {
      // kākā beak: hooked claw petals hanging in a cluster
      for (let k = 0; k < 3; k++) {
        const a = Math.PI / 2 + (k - 1) * 0.5;
        const pts = arc(fx, fy, a - 0.6, 5, -0.8);
        for (const [px, py] of pts) buf.set(px, py, rc(fr, 5 + (k === 0 ? 1 : 0)));
      }
    } else flower(buf, fx, fy, rng.range(1.8, 2.8), fr, tint === 'white' ? 5 : 4, rc(JP.gold, 6), 5, rng.range(0, 1));
  }
  return done(buf, x, y + 1, 0.45);
}

function lily(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 97 + 43);
  const S = size;
  const buf = canvas(S * 1.8 + 8, S * 1.4 + 6);
  const x = buf.w / 2, y = buf.h - 2;
  // flower stalk with a branched head of white stars
  const h = S * rng.range(1.1, 1.3);
  tube(buf, [[x, y], [x + 2, y - h]], () => 0.8, JP.moss, 4, { spread: 1 });
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.4;
    const L = rng.range(4, 9);
    const ex = x + 2 + Math.cos(a) * L, ey = y - h + Math.sin(a) * L * 0.8;
    buf.line(x + 2, y - h, ex, ey, rc(JP.moss, 4));
    flower(buf, ex, ey, 1.8, JP.cream, 6, rc(JP.gold, 6), 6, i);
  }
  // strap leaves (renga renga)
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / 10 - 0.5) * 2.8;
    blade(buf, { x: x + rng.range(-2, 2), y: y + 1, ang: a, len: S * rng.range(0.5, 0.75), droop: 0.4 + Math.abs(Math.cos(a)), w0: 3.5, ramp: JP.astelia, base: 4 + (i % 2) * 2 });
  }
  return done(buf, x, y + 1);
}

/** A single pitcher: slender jug with a belly, a red striped peristome, dark mouth and a lid. */
function pitcherJug(buf: PixelBuffer, x: number, y: number, h: number, lean: number) {
  const w = h * 0.3;
  const prof = (t: number) => (t < 0.12 ? 0.45 + t * 3 : t < 0.4 ? 0.8 + Math.sin(((t - 0.12) / 0.28) * Math.PI * 0.5) * 0.2 : t < 0.8 ? 1 - ((t - 0.4) / 0.4) * 0.3 : 0.7 + ((t - 0.8) / 0.2) * 0.2);
  for (let yy = 0; yy < h; yy++) {
    const t = yy / h; // 0 = bottom
    const half = w * prof(t);
    const cx = x + lean * t * t * h * 0.25;
    for (let xx = Math.floor(cx - half); xx <= Math.ceil(cx + half); xx++) {
      const nx = (xx + 0.5 - cx) / half;
      if (Math.abs(nx) > 1) continue;
      const k = 4.8 - nx * 1.7 + (Math.abs(nx) > 0.82 ? -0.8 : 0) + (t < 0.15 ? -0.8 : 0);
      let c = rc(JP.kawakawa, k);
      // maroon speckles & veins growing denser toward the top
      const yp = Math.round(y - yy);
      if (hash2(xx, yp, 9) > 1 - t * 0.55 || (t > 0.55 && ((xx + yp) % 5 === 0))) c = rc(JP.red, 2.5 - nx);
      buf.set(xx, yp, c);
    }
  }
  const tx = x + lean * h * 0.25, ty = y - h;
  // lid (a small rounded leaf held above the mouth)
  bigLeaf(buf, { x: tx + w * 0.2, y: ty - 1, ang: -Math.PI / 2 - 0.9 * (lean >= 0 ? 1 : -1), len: w * 1.5, wid: w * 1.3, ramp: JP.kawakawa, base: 5, shape: 'round', droop: 0, veins: 0 });
  // striped peristome rim + dark mouth
  buf.ellipseFn(tx, ty + 1, w * 0.95, 1.8, (xx, _yy, _nx, ny) => (ny < -0.3 ? rc(JP.red, 6) : ((xx & 1) ? rc(JP.red, 5) : rc(JP.red, 3))));
  buf.ellipse(tx, ty + 1, w * 0.6, 0.8, rc(JP.soil, 0));
}

function pitcher(seed: number, size: number, full = true): Sprite {
  const rng = new Rng(seed * 101 + 47);
  const S = size;
  const buf = canvas(S * 2 + 10, S * 1.3 + 6);
  const x = buf.w / 2, y = buf.h - 2;
  // strap leaves
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 2.8;
    blade(buf, { x, y: y + 1, ang: a, len: S * rng.range(0.4, 0.6), droop: 0.5, w0: 3.5, ramp: JP.kawakawa, base: 4 + (i % 2) });
  }
  const n = full ? rng.int(3, 4) : 1;
  const jugs: { x: number; h: number; lean: number }[] = [];
  for (let i = 0; i < n; i++) jugs.push({ x: x + ((i + 0.5) / n - 0.5) * S * 1.2 + rng.range(-2, 2), h: S * rng.range(0.55, 0.85) * (full ? 1 : 0.6), lean: rng.range(-1, 1) });
  jugs.sort((a, b) => b.h - a.h);
  for (const j of jugs) {
    // curling tendril from the rosette to the jug's foot
    const pts: P[] = [[x, y - 3], [(x + j.x) / 2, y - 6 - rng.range(0, 4)], [j.x, y - 1]];
    tube(buf, pts, () => 0.6, JP.kawakawa, 4, { spread: 1, rim: false });
    pitcherJug(buf, j.x, y, j.h, j.lean);
  }
  return done(buf, x, y + 1);
}

function mossMat(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 103 + 53);
  const W = size * 1.6, H = size * 0.45;
  const buf = canvas(W + 8, H + 8);
  const x = buf.w / 2, y = buf.h - 2;
  // cushion body
  buf.ellipseFn(x, y, W / 2, H, (_px, _py, nx, ny) => (ny > 0 ? -1 : rc(JP.moss, 3 + (ny < -0.6 ? 1 : 0) - (nx > 0.6 ? 1 : 0))));
  const n = Math.round(W * H * 0.35);
  const lumps: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(Math.PI, TAU), d = Math.sqrt(rng.next());
    lumps.push({ x: x + Math.cos(a) * W * 0.48 * d, y: y + Math.sin(a) * H * 0.95 * d, r: rng.range(1.2, 2.4) });
  }
  lumps.sort((a, b) => a.y - b.y);
  for (const l of lumps) {
    const ny = (l.y - y) / H;
    buf.discFn(l.x, l.y, l.r, (_px, _py, dx, dy) => {
      const lit = -dx * 0.55 - dy * 0.85;
      return rc(JP.moss, 4 + (ny < -0.5 ? 1 : 0) + (lit > 0.35 ? 1 : lit < -0.45 ? -1 : 0));
    });
  }
  // sporophytes: thin stalks with capsules
  for (let i = 0; i < W / 4; i++) {
    const sx = x + rng.range(-W * 0.4, W * 0.4);
    let top = y;
    while (top > 0 && buf.opaque(sx, top - 1)) top--;
    if (!rng.chance(0.6)) continue;
    const h = rng.int(2, 4);
    for (let s = 1; s <= h; s++) buf.set(sx, top - s, rc(JP.rust, 3));
    buf.set(sx, top - h - 1, rc(JP.rust, 6));
  }
  return done(buf, x, y + 1, 0.4);
}

// ------------------------------------------------------------------ vines, fiddleheads, speculative

function hangingVine(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 107 + 59);
  const L = size * 3;
  const buf = canvas(30, L + 8);
  const x = buf.w / 2;
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) vine(buf, rng, x + (i - (n - 1) / 2) * 4, 0, L * rng.range(0.6, 1), JP.kawakawa, rng.int(4, 6), { leafEvery: 3, leafLen: rng.range(4, 6), wave: 2.5 });
  const out = done(buf, x, 0, 0.45);
  return out;
}

function fiddlehead(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 109 + 61);
  const S = size;
  const buf = canvas(S * 1.6 + 10, S * 1.3 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const sx = x + ((i + 0.5) / n - 0.5) * S * 0.8;
    const h = S * rng.range(0.6, 1.0);
    const r = S * rng.range(0.14, 0.2);
    const dir = rng.sign();
    // stalk
    const top: P = [sx + dir * r * 0.4, y - h];
    tube(buf, [[sx, y], [sx - dir * 2, y - h * 0.5], top], t => r * 0.5 + (1 - t) * 0.8, JP.fern, 5, { spread: 1.6 });
    // curled crozier
    const cx = top[0] + dir * r, cy = top[1] - r * 0.2;
    for (let a = 0; a < TAU * 1.5; a += 0.08) {
      const rr = r * (1 - a / (TAU * 1.75));
      const px = cx - dir * Math.cos(a) * rr, py = cy - Math.sin(a) * rr;
      buf.disc(px, py, Math.max(0.8, r * 0.45 * (1 - a / (TAU * 2))), rc(JP.fern, 5 + (Math.sin(a) > 0 ? 1 : -1)));
    }
    // brown hairs
    for (let k = 0; k < h; k += 2) if (rng.chance(0.6)) buf.set(sx - dir * 2 + rng.range(-1.5, 1.5), y - k, rc(JP.skirt, 5));
  }
  return done(buf, x, y + 1);
}

/** Speculative: drooping stalks of pale glowing pods (glow buffer included). */
function lanternpod(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 113 + 67);
  const S = size;
  const buf = canvas(S * 1.8 + 10, S * 1.3 + 8);
  const glow = canvas(buf.w, buf.h);
  const x = buf.w / 2, y = buf.h - 2;
  // broad base leaves
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 4 - 0.5) * 2.4;
    bigLeaf(buf, { x, y, ang: a, len: S * 0.45, wid: S * 0.22, ramp: JP.taro, base: 4 + (i % 2), shape: 'lance', droop: 0.5, veins: 3 });
  }
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 1.6;
    const pts = arc(x, y - 2, a, S * rng.range(0.7, 1.0), 1.3);
    for (const [px, py] of pts) buf.set(px, py, rc(JP.moss, 3));
    const e = pts[pts.length - 1];
    const r = rng.range(2.4, 3.6);
    buf.discFn(e[0], e[1] + r, r, (_px, _py, dx, dy) => {
      const d = Math.hypot(dx, dy);
      return rc(JP.cream, d < 0.45 ? 7 : 5 + (dy < -0.2 ? 1 : 0) - (dx > 0.5 ? 1 : 0));
    });
    glow.discFn(e[0], e[1] + r, r, (_px, _py, dx, dy) => (Math.hypot(dx, dy) < 0.6 ? hex('#fff2b0') : withA(hex('#f3c860'), 150)));
    buf.set(e[0], e[1] + r * 2, rc(JP.gold, 4));
  }
  outlineSel(buf, 0.45);
  const t = trimSprite({ buf, ax: Math.round(x), ay: Math.round(y + 1), glow });
  return t;
}

// ------------------------------------------------------------------ fungi

function glowcap(seed: number, size: number, onLog = false): Sprite {
  const rng = new Rng(seed * 127 + 71);
  const S = size;
  const buf = canvas(S * 2 + 10, S * 1.2 + 8);
  const glow = canvas(buf.w, buf.h);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(3, 7);
  const caps: { x: number; h: number; r: number }[] = [];
  for (let i = 0; i < n; i++) caps.push({ x: x + rng.range(-S * 0.7, S * 0.7), h: S * rng.range(0.3, 0.85), r: S * rng.range(0.14, 0.26) });
  caps.sort((a, b) => b.h - a.h);
  for (const c of caps) {
    const lean = rng.range(-0.25, 0.25);
    const top = y - c.h;
    for (let s = 0; s < c.h; s++) {
      const sx = c.x + lean * s * 0.3;
      buf.set(sx, y - s, rc(JP.glowCyan, 5));
      buf.set(sx + 1, y - s, rc(JP.glowCyan, 4));
      glow.set(sx, y - s, withA(rc(JP.glowCyan, 5), 110));
    }
    const cx = c.x + lean * c.h * 0.3;
    buf.ellipseFn(cx, top, c.r * 1.25, c.r * 0.85, (px, py, nx, ny) => {
      if (ny > 0.35) return -1;
      const lit = -nx * 0.5 - ny * 0.8;
      let k = 5 + (lit > 0.4 ? 1 : lit < -0.2 ? -1 : 0);
      if (ny > 0.1) k = 3; // gill shadow
      if (hash2(px, py, 5) > 0.9 && ny < 0) k = 7; // spots
      return rc(JP.glowCyan, k);
    });
    glow.ellipseFn(cx, top, c.r * 1.25, c.r * 0.85, (_px, _py, _nx, ny) => (ny > 0.35 ? -1 : ny > 0.1 ? rc(JP.glowCyan, 6) : rc(JP.glowCyan, 5)));
  }
  if (!onLog) for (let i = 0; i < 5; i++) mossBlob(buf, rng, x + rng.range(-S * 0.6, S * 0.6), y, rng.range(2, 4), 1.5, JP.moss, 3, true);
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: Math.round(x), ay: Math.round(y + 1), glow });
}

/** Shelf brackets; anchor = attachment point on the host (left edge centre when facing right). */
function bracket(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 131 + 73);
  const S = size;
  const buf = canvas(S * 1.4 + 8, S * 1.4 + 8);
  const n = rng.int(2, 4);
  const ramp = [JP.tan, JP.cream, JP.orange][seed % 3];
  const x0 = 3;
  for (let i = 0; i < n; i++) {
    const w = S * rng.range(0.6, 1.0) * (1 - i * 0.12), h = w * rng.range(0.35, 0.5);
    const cy = 4 + (i / Math.max(1, n - 1)) * S * 0.85 + rng.range(-1, 1);
    // top surface (seen slightly from above) with concentric growth bands
    buf.ellipseFn(x0, cy, w, h, (px, py, nx, ny) => {
      if (nx < 0) return -1;
      const d = Math.hypot(nx, ny * 1.1);
      const band = Math.floor(d * 5 + fbm2(px * 0.3, py * 0.3, 2, seed) * 0.8);
      let k = 3 + (band % 2) + (d > 0.85 ? 2 : 0) + (ny < -0.2 ? 1 : 0);
      if (ny > 0.35) k = 1;
      return rc(ramp, k);
    });
    // pale pore underside
    for (let xx = 0; xx < w * 0.95; xx++) {
      const t = xx / w;
      const uy = cy + h * Math.sqrt(Math.max(0, 1 - t * t)) * 0.5;
      buf.set(x0 + xx, uy, rc(JP.cream, 3));
      buf.set(x0 + xx, uy + 1, rc(JP.cream, 1));
    }
  }
  outlineSel(buf, 0.5);
  const sp = trimSprite({ buf, ax: x0, ay: Math.round(S * 0.5), glow: undefined });
  return sp;
}

function inkcap(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 137 + 79);
  const S = size;
  const buf = canvas(S * 1.8 + 8, S * 1.2 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(2, 5);
  const caps: { x: number; h: number; r: number; old: boolean }[] = [];
  for (let i = 0; i < n; i++) caps.push({ x: x + ((i + 0.5) / n - 0.5) * S * 1.1 + rng.range(-2, 2), h: S * rng.range(0.45, 0.95), r: S * rng.range(0.13, 0.2), old: rng.chance(0.35) });
  caps.sort((a, b) => b.h - a.h);
  for (const c of caps) {
    for (let s = 0; s < c.h * 0.6; s++) { buf.set(c.x, y - s, rc(JP.cream, 6)); buf.set(c.x + 1, y - s, rc(JP.cream, 4)); }
    // bell cap: tall ellipse, shaggy scales, inky dripping hem
    const ch = c.h * 0.55, cy = y - c.h + ch * 0.5;
    buf.ellipseFn(c.x + 0.5, cy, c.r, ch * 0.55, (px, py, nx, ny) => {
      const lit = -nx * 0.7 - ny * 0.4;
      let k = 4 + (lit > 0.3 ? 1 : lit < -0.3 ? -1 : 0);
      if ((py + (px & 1) * 2) % 4 === 0 && ny > -0.6) k -= 1; // shaggy scales
      if (ny > 0.7) k = c.old ? 1 : 2;
      return rc(JP.violet, k + (ny < -0.7 ? 2 : 0));
    });
    const hemY = Math.round(cy + ch * 0.55);
    for (let xx = Math.floor(c.x - c.r); xx <= c.x + c.r + 1; xx++) {
      const d = rng.int(0, c.old ? 4 : 1);
      for (let k = 0; k <= d; k++) buf.set(xx, hemY + k, rc(JP.violet, 0));
    }
  }
  // leaf litter at the base
  for (let i = 0; i < 9; i++) {
    const st = leafStamp('oval', rng.range(3, 5), 2.5, rng.range(0, TAU));
    drawStamp(buf, st, x + rng.range(-S * 0.7, S * 0.7), y - rng.range(0, 1.5), JP.litter, rng.int(2, 5));
  }
  return done(buf, x, y + 1);
}

function bluecap(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 139 + 83);
  const S = size;
  const buf = canvas(S * 1.5 + 8, S * 1.2 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const sx = x + ((i + 0.5) / n - 0.5) * S * 0.9, h = S * rng.range(0.5, 1), r = S * rng.range(0.12, 0.18);
    const lean = rng.range(-0.2, 0.2);
    for (let s = 0; s < h; s++) buf.set(sx + lean * s * 0.2, y - s, rc(JP.blueShroom, 4 + (s > h * 0.6 ? 1 : 0)));
    const tx = sx + lean * h * 0.2, ty = y - h;
    // conical cap
    for (let k = 0; k < r * 1.8; k++) {
      const hw = (k / (r * 1.8)) * r * 1.1;
      for (let xx = Math.floor(tx - hw); xx <= Math.ceil(tx + hw); xx++) {
        const nx = (xx + 0.5 - tx) / Math.max(1, hw);
        buf.set(xx, ty - r * 1.8 + k, rc(JP.blueShroom, 5 + (nx < -0.3 ? 2 : nx > 0.4 ? -1 : 0)));
      }
    }
    buf.set(tx, ty - r * 1.8, rc(JP.blueShroom, 8));
  }
  return done(buf, x, y + 1);
}

function starfish(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 149 + 89);
  const S = size;
  const buf = canvas(S * 1.8 + 8, S * 1.2 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  // white volva egg
  buf.shadedEllipse(x, y - 2, S * 0.18, S * 0.13, JP.cream.slice(2, 8));
  // stalk
  const h = S * 0.35;
  for (let s = 0; s < h; s++) buf.hline(x - 1, x + 1, y - 3 - s, s % 3 ? rc(JP.pink, 6) : rc(JP.pink, 5));
  const cy = y - 3 - h;
  // red forked arms radiating from the disc (foreshortened: seen from the side-above)
  const arms = rng.int(6, 8);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU + 0.2;
    const L = S * rng.range(0.4, 0.55);
    const ex = x + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.35 - 1;
    for (let t = 0; t <= 1; t += 0.06) {
      const px = x + (ex - x) * t, py = cy + (ey - cy) * t - Math.sin(t * Math.PI) * 1.5;
      buf.disc(px, py, 1.2 * (1 - t * 0.4), rc(JP.red, 5 + (Math.sin(a) < 0 ? 1 : -1)));
    }
    buf.set(ex + Math.cos(a + 0.4) * 2, ey - 1, rc(JP.red, 6));
    buf.set(ex + Math.cos(a - 0.4) * 2, ey - 1, rc(JP.red, 6));
  }
  buf.ellipse(x, cy - 1, S * 0.12, S * 0.06, rc(JP.soil, 3)); // dark gleba
  return done(buf, x, y + 1);
}

function veil(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 151 + 97);
  const S = size;
  const buf = canvas(S * 1.2 + 8, S * 1.3 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const h = S * 1.05;
  // lacy net skirt behind the stalk
  const skTop = y - h * 0.78, skBot = y - h * 0.15;
  for (let yy = Math.floor(skTop); yy <= skBot; yy++) {
    const t = (yy - skTop) / (skBot - skTop);
    const hw = S * 0.12 + t * S * 0.38;
    for (let xx = Math.floor(x - hw); xx <= Math.ceil(x + hw); xx++) {
      const net = ((xx + yy) % 3 === 0) || ((xx - yy + 99) % 3 === 0);
      if (!net) continue;
      if (t > 0.92 && hash2(xx, yy, seed) > 0.5) continue;
      buf.set(xx, yy, rc(JP.cream, 6 - (xx > x ? 1 : 0)));
    }
  }
  for (let s = 0; s < h; s++) { buf.set(x, y - s, rc(JP.cream, 7)); buf.set(x + 1, y - s, rc(JP.cream, 5)); }
  buf.ellipseFn(x + 0.5, y - h, S * 0.14, S * 0.18, (_px, _py, nx, ny) => rc(JP.tan, 2 + (nx < 0 ? 1 : 0) + (ny < -0.4 ? 1 : 0)));
  void rng;
  return done(buf, x, y + 1);
}

/** Speculative: translucent orange lantern fungi dangling from a stem (glow). */
function lanternFungus(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 157 + 101);
  const S = size;
  const buf = canvas(S * 1.6 + 8, S * 1.3 + 8);
  const glow = canvas(buf.w, buf.h);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const sx = x + ((i + 0.5) / n - 0.5) * S, h = S * rng.range(0.5, 1.0);
    const pts = arc(sx, y, -Math.PI / 2 + rng.range(-0.3, 0.3), h, 0.6, 0);
    for (const [px, py] of pts) buf.set(px, py, rc(JP.tan, 3));
    const e = pts[pts.length - 1];
    // hooded lantern: cap + glowing ribbed bulb
    const r = rng.range(2.2, 3.4);
    buf.discFn(e[0], e[1] + r * 0.9, r, (px, _py, dx, dy) => {
      const rib = (Math.round(px) % 2) === 0;
      return rc(JP.glowWarm, (Math.hypot(dx, dy) < 0.5 ? 6 : 4) + (rib ? 0 : 1) + (dy < -0.3 ? 1 : 0));
    });
    glow.discFn(e[0], e[1] + r * 0.9, r, (_px, _py, dx, dy) => (Math.hypot(dx, dy) < 0.55 ? rc(JP.glowWarm, 7) : withA(rc(JP.glowWarm, 5), 170)));
    buf.ellipse(e[0], e[1] - 0.5, r * 1.1, 1.2, rc(JP.tan, 5));
  }
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: Math.round(x), ay: Math.round(y + 1), glow });
}

function coral(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 163 + 103);
  const S = size;
  const buf = canvas(S * 1.6 + 8, S * 1.1 + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const rp = seed % 2 ? JP.pink : JP.orange;
  const branch = (bx: number, by: number, a: number, len: number, depth: number) => {
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    tube(buf, [[bx, by], [ex, ey]], () => Math.max(0.7, 1.8 - depth * 0.45), rp, 5 - depth * 0.3, { spread: 1.4 });
    if (depth < 3) {
      branch(ex, ey, a - rng.range(0.25, 0.5), len * 0.72, depth + 1);
      branch(ex, ey, a + rng.range(0.25, 0.5), len * 0.72, depth + 1);
    } else buf.set(ex, ey - 1, rc(rp, 7));
  };
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) branch(x + rng.range(-S * 0.3, S * 0.3), y, -Math.PI / 2 + rng.range(-0.5, 0.5), S * 0.3, 0);
  return done(buf, x, y + 1);
}

function puffball(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 167 + 107);
  const S = size;
  const buf = canvas(S * 1.8 + 8, S + 8);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(2, 5);
  const balls: { x: number; r: number }[] = [];
  for (let i = 0; i < n; i++) balls.push({ x: x + ((i + 0.5) / n - 0.5) * S * 1.2 + rng.range(-2, 2), r: S * rng.range(0.15, 0.32) });
  balls.sort((a, b) => a.r - b.r);
  balls.forEach((b, i) => {
    buf.shadedEllipse(b.x, y - b.r * 0.9, b.r, b.r * 0.9, JP.cream.slice(1, 8));
    if (i === 0 && n > 2) {
      buf.ellipse(b.x, y - b.r * 1.6, b.r * 0.35, b.r * 0.2, rc(JP.soil, 2)); // burst pore
      for (let k = 0; k < 6; k++) buf.set(b.x + rng.range(-3, 3), y - b.r * 1.8 - rng.range(1, 6), withA(rc(JP.tan, 4), 170));
    }
  });
  return done(buf, x, y + 1, 0.45);
}

/** Speculative: twisted banded horn fungus with glowing tips. */
function spiral(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 173 + 109);
  const S = size;
  const buf = canvas(S * 1.4 + 8, S * 1.3 + 8);
  const glow = canvas(buf.w, buf.h);
  const x = buf.w / 2, y = buf.h - 2;
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const sx = x + ((i + 0.5) / n - 0.5) * S * 0.8, h = S * rng.range(0.6, 1.1), r0 = S * rng.range(0.1, 0.14);
    const tw = rng.range(0.35, 0.55), lean = rng.range(-0.3, 0.3);
    for (let s = 0; s < h; s++) {
      const t = s / h;
      const r = r0 * (1 - t * 0.85) + 0.5;
      const cx = sx + lean * s * 0.4 + Math.sin(t * 5) * 1.5;
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const nx = (xx + 0.5 - cx) / r;
        if (Math.abs(nx) > 1) continue;
        const band = Math.sin(s * tw + Math.asin(clamp(nx, -1, 1)) * 1.5) > 0.2;
        const rp = band ? JP.violet : JP.glowCyan;
        buf.set(xx, y - s, rc(rp, 4 - nx * 1.4 + (band ? 0 : -1)));
      }
      if (t > 0.86) {
        buf.set(cx, y - s, rc(JP.glowCyan, 7));
        glow.set(cx, y - s, rc(JP.glowCyan, 6));
        glow.set(cx + 1, y - s, withA(rc(JP.glowCyan, 5), 140));
      }
    }
  }
  outlineSel(buf, 0.5);
  return trimSprite({ buf, ax: Math.round(x), ay: Math.round(y + 1), glow });
}

// ------------------------------------------------------------------ deadwood & rocks

/** Horizontal log: bark cylinder, moss top, cut end with rings, broken end, optional holes. */
function paintLog(buf: PixelBuffer, rng: Rng, x0: number, x1: number, cy: number, r: number, o: { rotten?: boolean; holes?: number; moss?: number; seed: number }) {
  const rp = o.rotten ? JP.deadwood : JP.bark;
  const n = rp.length - 1;
  const len = x1 - x0;
  const ends = { l: rng.chance(0.5) ? 'cut' : 'broken', r: 'broken' };
  for (let x = Math.floor(x0); x <= x1; x++) {
    const t = (x - x0) / len;
    const sagY = o.rotten ? Math.sin(t * Math.PI) * r * 0.25 : 0;
    // broken end: jagged profile
    let rr = r * (1 - 0.05 * Math.sin(t * 9));
    if (t > 0.94) rr *= 0.6 + hash2(x, 0, o.seed) * 0.5;
    const cyy = cy + sagY;
    for (let y = Math.floor(cyy - rr); y <= Math.ceil(cyy + rr); y++) {
      const ny = (y + 0.5 - cyy) / rr;
      if (Math.abs(ny) > 1) continue;
      let l = ny < -0.72 ? 1.4 : ny < -0.25 ? 0.7 : ny < 0.3 ? -0.2 : ny < 0.75 ? -1.1 : -1.7;
      const ridge = Math.sin(y * 1.3 + noise2(x * 0.08, y * 0.3, o.seed) * 6);
      if (ridge > 0.8) l -= 0.9;
      else if (ridge > 0.55) l += 0.4;
      if (o.rotten && noise2(x * 0.15, y * 0.3, o.seed + 3) > 0.7) l -= 1;
      buf.set(x, y, rc(rp, n * 0.5 + l));
    }
  }
  // cut end with growth rings (left)
  if (ends.l === 'cut') {
    buf.ellipseFn(x0, cy, r * 0.45, r, (_x, _y, nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.84) return rc(rp, n * 0.5 - 1.2);
      return rc(JP.wood, o.rotten ? 3 + (Math.floor(d * 5) % 2) : 5 + (Math.floor(d * 6) % 2) + (ny < -0.3 ? 1 : 0));
    });
  } else {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const jag = Math.round(hash2(y, 3, o.seed) * 4);
      for (let k = 0; k < jag; k++) buf.set(x0 - k, y, rc(JP.wood, 4 + (k === jag - 1 ? 2 : 0)));
    }
  }
  // holes
  for (let i = 0; i < (o.holes ?? 0); i++) {
    const hx = x0 + len * rng.range(0.25, 0.75), hy = cy + r * rng.range(-0.1, 0.35);
    const hr = r * rng.range(0.25, 0.4);
    buf.ellipseFn(hx, hy, hr * 1.3, hr, (_x, _y, nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.72) return rc(rp, ny > 0 ? n * 0.5 + 1 : n * 0.5 - 2);
      return ny < 0 ? rc(JP.soil, 0) : rc(JP.soil, 1);
    });
  }
  // moss cushions along the top
  const mo = o.moss ?? 0.8;
  for (let x = x0 + 2; x < x1 - 2; x += rng.range(3, 7)) {
    if (!rng.chance(mo)) continue;
    const t = (x - x0) / len;
    const sagY = o.rotten ? Math.sin(t * Math.PI) * r * 0.25 : 0;
    mossBlob(buf, rng, x, cy + sagY - r * 0.82, rng.range(3, 6), rng.range(1.5, 2.8), JP.moss, rng.int(4, 6), true);
  }
}

function log(seed: number, size: number, rotten = false): Sprite {
  const rng = new Rng(seed * 179 + 113);
  const len = size * 2.2, r = size * 0.3;
  const buf = canvas(len + 20, r * 2 + 30);
  const x0 = 10, x1 = x0 + len, cy = buf.h - r - 3;
  paintLog(buf, rng, x0, x1, cy, r, { rotten, holes: rotten ? rng.int(1, 3) : rng.int(0, 1), moss: rotten ? 0.95 : 0.7, seed });
  // sprouting fern & a few fungi
  if (rng.chance(0.7)) {
    const fx = x0 + len * rng.range(0.3, 0.7);
    for (let i = 0; i < 6; i++) frond(buf, { x: fx, y: cy - r + 1, ang: -Math.PI / 2 + (i / 5 - 0.5) * 2.6, len: r * 1.6, droop: 1, ramp: JP.fern, base: 5 + (i % 2), pinna: 2.5, pinnaW: 1.5, gap: 1.4 });
  }
  for (let i = 0; i < rng.int(0, 3); i++) {
    const fx = x0 + len * rng.range(0.2, 0.8), fy = cy + rng.range(-r * 0.2, r * 0.3);
    buf.ellipseFn(fx, fy, 2.5, 1.2, (_x, _y, nx, ny) => (ny > 0.3 ? rc(JP.cream, 2) : rc(JP.orange, 5 + (nx < 0 ? 1 : 0))));
  }
  occlude(buf, (x0 + x1) / 2, buf.h - 2, len * 0.55, 3, 0.3);
  return done(buf, (x0 + x1) / 2, buf.h - 2);
}

function stump(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 181 + 127);
  const S = size;
  const buf = canvas(S * 2 + 20, S * 1.4 + 20);
  const cx = buf.w / 2, gy = buf.h - 3;
  const hw = S * 0.42, h = S * rng.range(0.7, 1.1);
  const n = JP.bark.length - 1;
  const cut = rng.chance(0.4);
  for (let y = Math.floor(gy - h); y <= gy; y++) {
    const fromBot = gy - y;
    const w = hw * (1 + Math.exp(-fromBot / (S * 0.18)) * 0.8);
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const nx = (x + 0.5 - cx) / w;
      if (Math.abs(nx) > 1) continue;
      // jagged broken top
      const topY = gy - h + (cut ? 0 : Math.abs(Math.sin(nx * 5 + seed)) * S * 0.35 + hash2(x >> 1, 1, seed) * 3);
      if (y < topY) continue;
      let l = nx < -0.6 ? 1.3 : nx < -0.1 ? 0.5 : nx < 0.4 ? -0.4 : -1.2;
      const rr = x * 0.4 + noise2(x * 0.1, y * 0.03, seed) * 4;
      if (rr - Math.floor(rr) < 0.2) l -= 1;
      buf.set(x, y, rc(JP.bark, n * 0.5 + l));
    }
  }
  if (cut) buf.ellipseFn(cx, gy - h, hw, hw * 0.35, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    return d > 0.85 ? rc(JP.bark, 3) : rc(JP.wood, 5 + (Math.floor(d * 5) % 2) + (ny < 0 ? 1 : 0));
  });
  else for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
    // pale splintered wood at the broken top
    let y = Math.floor(gy - h - S * 0.4);
    while (y < gy && !buf.opaque(x, y)) y++;
    buf.set(x, y, rc(JP.wood, 7));
    buf.set(x, y + 1, rc(JP.wood, 5));
  }
  for (let i = 0; i < 4; i++) mossBlob(buf, rng, cx + rng.range(-hw, hw), gy - rng.range(0, h * 0.8), rng.range(3, 6), 2, JP.moss, rng.int(4, 6), true);
  // roots
  for (const side of [-1, 1]) tube(buf, [[cx + side * hw * 0.6, gy - 4], [cx + side * (hw + S * 0.4), gy - 1], [cx + side * (hw + S * 0.7), gy + 1]], t => 3 - t * 2, JP.bark, n * 0.5, { spread: 2 });
  if (rng.chance(0.6)) {
    const b = bracket(seed + 1, S * 0.45);
    buf.blit(b.buf, cx + hw * 0.6 - b.ax + 1, gy - h * 0.5 - b.ay);
  }
  return done(buf, cx, gy + 1);
}

/** Faceted volcanic boulder with moss cap, lichen and cracks. */
function rock(seed: number, size: number, o: { moss?: number; ramp?: Ramp } = {}): Sprite {
  const rng = new Rng(seed * 191 + 131);
  const S = size;
  const W = S * rng.range(1.3, 1.8), H = S * rng.range(0.8, 1.05);
  const buf = canvas(W + 12, H + 12);
  const rp = o.ramp ?? JP.rock;
  const n = rp.length - 1;
  const cx = buf.w / 2, gy = buf.h - 3;
  // facets: random planes; each pixel picks the facet with the highest "height"
  const facets = Array.from({ length: rng.int(5, 8) }, () => ({ nx: rng.range(-0.8, 0.8), ny: rng.range(-0.9, 0.2), d: rng.range(0.55, 0.9) }));
  const top = (x: number) => {
    const t = (x - cx) / (W / 2);
    if (Math.abs(t) > 1) return Infinity;
    return gy - H * Math.pow(Math.max(0, 1 - t * t), 0.55) * (0.85 + 0.15 * Math.sin(t * 3 + seed));
  };
  for (let x = Math.floor(cx - W / 2); x <= Math.ceil(cx + W / 2); x++) {
    const ty = top(x);
    for (let y = Math.floor(ty); y <= gy; y++) {
      const px = (x - cx) / (W / 2), py = (y - (gy - H * 0.5)) / (H * 0.6);
      let best = -1e9, fi = 0;
      for (let k = 0; k < facets.length; k++) {
        const f = facets[k];
        const v = f.d - (px * f.nx + py * f.ny) * -1 + 0 * k;
        const hgt = -(px - f.nx) * (px - f.nx) - (py - f.ny) * (py - f.ny) + f.d;
        if (hgt > best) { best = hgt; fi = k; }
        void v;
      }
      const f = facets[fi];
      const lit = -f.nx * 0.6 - f.ny * 0.9 - py * 0.3;
      let k = n * 0.45 + lit * 2.2;
      if (y > gy - 3) k -= 1.2;
      buf.set(x, y, rc(rp, k));
    }
  }
  // cracks
  for (let i = 0; i < rng.int(1, 3); i++) {
    let x = cx + rng.range(-W * 0.3, W * 0.3), y = gy - H * rng.range(0.4, 0.8);
    for (let s = 0; s < H * 0.5; s++) {
      buf.paint(x, y, rc(rp, 1));
      buf.paint(x + 1, y, rc(rp, n * 0.6));
      x += rng.range(-0.9, 0.9);
      y += 1;
    }
  }
  // moss cap and lichen
  const mo = o.moss ?? 0.8;
  if (mo > 0) for (let x = Math.floor(cx - W * 0.45); x < cx + W * 0.45; x += 3) {
    const ty = top(x);
    if (!isFinite(ty) || !rng.chance(mo * (1 - Math.abs(x - cx) / W))) continue;
    mossBlob(buf, rng, x, ty + 2, rng.range(3, 6), rng.range(2, 3.5), JP.moss, rng.int(4, 6), true);
  }
  for (let i = 0; i < W / 6; i++) {
    const lx = cx + rng.range(-W * 0.4, W * 0.4), ly = gy - rng.range(2, H * 0.8);
    if (buf.opaque(lx, ly)) mossBlob(buf, rng, lx, ly, 1.8, 1.4, JP.lichen, 1);
  }
  occlude(buf, cx, gy + 1, W * 0.6, 3, 0.35);
  return done(buf, cx, gy + 1);
}

function roots(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 193 + 137);
  const W = size * 3, H = size * 0.6;
  const buf = canvas(W + 10, H + 10);
  const gy = buf.h - 3;
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const pts: P[] = [];
    let x = 5 + rng.range(0, W * 0.2), y = gy - rng.range(0, H * 0.6);
    const dir = 1;
    while (x < W) {
      pts.push([x, y]);
      x += dir * rng.range(4, 8);
      y = clamp(y + rng.range(-2.5, 2.5), gy - H, gy + 1);
      if (rng.chance(0.15)) y = gy + 2; // dives into the soil
    }
    tube(buf, pts, t => 1.5 + Math.sin(t * Math.PI) * size * 0.08, JP.bark, 5, { spread: 2 });
  }
  for (let i = 0; i < W / 10; i++) mossBlob(buf, rng, rng.range(5, W), gy - rng.range(1, H * 0.6), rng.range(2, 4), 1.5, JP.moss, 4);
  return done(buf, buf.w / 2, gy + 1);
}

function fallenBranch(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 197 + 139);
  const L = size * 2.4;
  const buf = canvas(L + 20, size + 12);
  const gy = buf.h - 3;
  const pts: P[] = [[8, gy - 2], [8 + L * 0.5, gy - 4 - rng.range(0, 3)], [8 + L, gy - 1]];
  tube(buf, pts, t => 2.8 - t * 1.6, JP.bark, 5, { spread: 2 });
  for (let i = 0; i < 5; i++) {
    const p = along(pts, rng.range(0.15, 0.9));
    const a = -Math.PI / 2 + rng.range(-1, 1);
    const e: P = [p.x + Math.cos(a) * size * 0.5, p.y + Math.sin(a) * size * 0.5];
    tube(buf, [[p.x, p.y], e], t => 1.2 - t * 0.5, JP.bark, 5, { spread: 1.5 });
    for (let k = 0; k < 4; k++) {
      const st = leafStamp('oval', rng.range(3, 5), 2.5, rng.range(0, TAU));
      drawStamp(buf, st, e[0] + rng.range(-3, 3), e[1] + rng.range(-3, 3), JP.litter, rng.int(3, 6));
    }
  }
  return done(buf, buf.w / 2, gy + 1);
}

/** Flat leaf-litter decal for dressing the ground line (anchor bottom-centre). */
function litter(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 199 + 149);
  const W = size * 3, H = size * 0.35;
  const buf = canvas(W + 8, H + 8);
  const gy = buf.h - 2;
  const n = Math.round(W * H * 0.28);
  for (let i = 0; i < n; i++) {
    const x = 4 + rng.range(0, W), y = gy - rng.range(0, H) * (1 - Math.abs((x - buf.w / 2) / (W / 2)) * 0.6);
    const pal = rng.chance(0.2) ? JP.moss : JP.litter;
    const st = leafStamp(rng.chance(0.5) ? 'oval' : 'point', rng.range(3, 5.5), rng.range(2, 3), rng.range(-0.5, 0.5) + (rng.chance(0.5) ? Math.PI : 0));
    drawStamp(buf, st, x, y, pal, rng.int(2, pal.length - 2));
  }
  for (let i = 0; i < W / 8; i++) {
    const x = rng.range(4, W), y = gy - rng.range(0, H * 0.5);
    buf.line(x, y, x + rng.range(-5, 5), y - rng.range(0, 1.5), rc(JP.bark, 5));
  }
  return done(buf, buf.w / 2, gy + 1, 0);
}

// ------------------------------------------------------------------ public

/** Default sizes (roughly the sprite height in px) per plant kind. */
export const PLANT_SIZE: Record<PlantKind, number> = {
  fern: 34, crownfern: 30, kiokio: 38, umbrellafern: 34, kidneyfern: 16, flax: 50, kawakawa: 40, taro: 56, grass: 12, sedge: 16,
  moss: 18, flowers: 14, lily: 22, pitcher: 24, shrub: 36, seedling: 22, vine: 30, fiddlehead: 26, lanternpod: 30, astelia: 28,
};

/**
 * Undergrowth sprite. size ≈ height in px (see PLANT_SIZE). Anchor bottom-centre on the ground,
 * except 'vine' which hangs from its anchor at the top-centre. 'lanternpod' carries a glow buffer.
 */
export function plant(kind: PlantKind, seed: number, size?: number): Sprite {
  const S = size ?? PLANT_SIZE[kind];
  switch (kind) {
    case 'fern': return fern(seed, S);
    case 'crownfern': return crownfern(seed, S);
    case 'kiokio': return kiokio(seed, S);
    case 'umbrellafern': return umbrellafern(seed, S);
    case 'kidneyfern': return kidneyfern(seed, S);
    case 'flax': return flax(seed, S);
    case 'kawakawa': return kawakawa(seed, S);
    case 'taro': return taro(seed, S);
    case 'grass': return grass(seed, S);
    case 'sedge': return grass(seed, S, SEDGE, 14);
    case 'moss': return mossMat(seed, S);
    case 'flowers': return flowers(seed, S);
    case 'lily': return lily(seed, S);
    case 'pitcher': return pitcher(seed, S);
    case 'shrub': return shrub(seed, S);
    case 'seedling': return seedling(seed, S);
    case 'vine': return hangingVine(seed, S);
    case 'fiddlehead': return fiddlehead(seed, S);
    case 'lanternpod': return lanternpod(seed, S);
    case 'astelia': {
      const rng = new Rng(seed * 211 + 3);
      const buf = canvas(S * 2.4 + 8, S * 1.2 + 6);
      astelia(buf, rng, buf.w / 2, buf.h - 2, S);
      return done(buf, buf.w / 2, buf.h - 1);
    }
  }
}

/** Default fungus sizes (px). */
export const FUNGUS_SIZE: Record<FungusKind, number> = { glowcap: 14, bracket: 16, inkcap: 16, bluecap: 12, starfish: 16, veil: 18, lantern: 16, coral: 14, puffball: 12, spiral: 18 };

/**
 * Fungi. Anchor bottom-centre, except 'bracket' (attachment point on its host trunk, the sprite
 * grows to the right; flip it for the other side). glowcap, lantern and spiral include `glow`.
 */
export function fungus(kind: FungusKind, seed: number, size?: number): Sprite {
  const S = size ?? FUNGUS_SIZE[kind];
  switch (kind) {
    case 'glowcap': return glowcap(seed, S);
    case 'bracket': return bracket(seed, S);
    case 'inkcap': return inkcap(seed, S);
    case 'bluecap': return bluecap(seed, S);
    case 'starfish': return starfish(seed, S);
    case 'veil': return veil(seed, S);
    case 'lantern': return lanternFungus(seed, S);
    case 'coral': return coral(seed, S);
    case 'puffball': return puffball(seed, S);
    case 'spiral': return spiral(seed, S);
  }
}

/** Default deadwood sizes (px). */
export const DEADWOOD_SIZE: Record<DeadwoodKind, number> = { log: 34, rottenlog: 34, stump: 30, rock: 30, roots: 16, branch: 18, litter: 16 };

/** Logs, stumps, mossy boulders, exposed roots, fallen branches and leaf-litter decals (bottom-centre). */
export function deadwood(kind: DeadwoodKind, seed: number, size?: number): Sprite {
  const S = size ?? DEADWOOD_SIZE[kind];
  switch (kind) {
    case 'log': return log(seed, S, false);
    case 'rottenlog': return log(seed, S, true);
    case 'stump': return stump(seed, S);
    case 'rock': return rock(seed, S);
    case 'roots': return roots(seed, S);
    case 'branch': return fallenBranch(seed, S);
    case 'litter': return litter(seed, S);
  }
}

// internal re-use by the resource kit
export { flax as flaxBush, kawakawa as kawakawaBush, pitcher as pitcherPlant, glowcap as glowcapCluster, bracket as bracketShelf, inkcap as inkcapPatch, rock as boulder, paintLog, litter as litterPatch };
export type { C };

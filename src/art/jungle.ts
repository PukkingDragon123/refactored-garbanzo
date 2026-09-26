// Public jungle kit: background strips, the canopy ceiling and sprites for every collectible
// resource node (plants, fungi, logs, animal signs, beach salvage), each with a depleted variant.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, withAlpha } from './color';
import { Rng } from '../core/math';
import type { Sprite } from './jungle-core';
import { outlineSel, trimSprite } from './jungle-core';
import { plant, fungus, deadwood, PlantKind } from './jungle-plants';
import { renderInsect } from './beasts-insects';
import { paintCrate } from './camp';

export { forestStrip, canopyCeiling, canopyGaps, forestFloor, STRIP_H, STRIP_LINES } from './jungle-bg';
export { tree, canopyClump, TREE_KINDS } from './jungle-trees';
export { plant, fungus, deadwood, PLANT_KINDS, FUNGUS_KINDS, DEADWOOD_KINDS } from './jungle-plants';
export { foreground, FOREGROUND_KINDS } from './jungle-fg';

export const RESOURCE_IDS = [
  'flax', 'treefern', 'kawakawa', 'rata', 'pitcher', 'moonfruit', 'mossrock', 'glowcap', 'bracket', 'inkcap', 'grublog',
  'lanternbeetle', 'weta', 'skymoth', 'mantis', 'dragonfly', 'thornfur', 'feather', 'shedskin', 'dropping', 'quill', 'bone',
  'eggshell', 'plate', 'driftwood', 'stones', 'shells', 'seaweed', 'crate', 'snare',
] as const;

// ------------------------------------------------------------------ composition helpers
interface Canvas { buf: PixelBuffer; glow: PixelBuffer | null; ax: number; ay: number }

/** A padded canvas holding `base` with the same anchor. */
function onto(base: Sprite, pad = 14, glow = false): Canvas {
  const w = base.buf.w + pad * 2, h = base.buf.h + pad * 2;
  const buf = new PixelBuffer(w, h);
  buf.blit(base.buf, pad, pad);
  let g: PixelBuffer | null = null;
  if (glow || base.glow) {
    g = new PixelBuffer(w, h);
    if (base.glow) g.blit(base.glow, pad, pad);
  }
  return { buf, glow: g, ax: base.ax + pad, ay: base.ay + pad };
}
function finish(c: Canvas, outline = false): Sprite {
  if (outline) outlineSel(c.buf, 0.5);
  return trimSprite({ buf: c.buf, ax: c.ax, ay: c.ay, glow: c.glow ?? undefined });
}
/** stamp a sprite so its anchor lands at (x, y) relative to the canvas anchor */
function stamp(c: Canvas, s: Sprite | { buf: PixelBuffer; ax: number; ay: number; glow?: PixelBuffer }, x: number, y: number, flip = false) {
  const dx = Math.round(c.ax + x - (flip ? s.buf.w - s.ax : s.ax)), dy = Math.round(c.ay + y - s.ay);
  c.buf.blit(s.buf, dx, dy, flip);
  if (s.glow && c.glow) {
    const gx = Math.round(c.ax + x - s.glow.w / 2), gy = Math.round(c.ay + y - s.glow.h / 2);
    c.glow.blit(s.glow, gx, gy);
  }
}
const px = (c: Canvas, x: number, y: number, col: C) => c.buf.set(Math.round(c.ax + x), Math.round(c.ay + y), col);
const tintAll = (s: Sprite, fn: (c: C) => C): Sprite => {
  const b = s.buf.clone();
  b.map(c => (c >>> 24 ? fn(c) : c));
  return { ...s, buf: b };
};
const bug = (kind: string) => renderInsect(kind, 0);

/** little clusters of round things (berries, fruit, pebbles) with a highlight */
function dots(c: Canvas, rng: Rng, pts: number, x0: number, y0: number, w: number, h: number, r: number, col: C, lit: C) {
  for (let i = 0; i < pts; i++) {
    const x = x0 + rng.range(-w / 2, w / 2), y = y0 + rng.range(-h / 2, h / 2);
    c.buf.disc(Math.round(c.ax + x), Math.round(c.ay + y), r, col);
    c.buf.set(Math.round(c.ax + x - r * 0.4), Math.round(c.ay + y - r * 0.4), lit);
  }
}
function line(c: Canvas, x0: number, y0: number, x1: number, y1: number, col: C) {
  c.buf.line(Math.round(c.ax + x0), Math.round(c.ay + y0), Math.round(c.ax + x1), Math.round(c.ay + y1), col);
}
const OL = hex('#1c1614');

// animal-sign overlays drawn on a litter patch
function feather(c: Canvas, x: number, y: number, col: C) {
  line(c, x - 5, y, x + 4, y - 3, shade(col, -0.35));
  for (let i = 0; i < 8; i++) {
    const t = i / 7, bx = x - 5 + t * 9, by = y - t * 3;
    line(c, bx, by, bx - 1, by - 2 + t, col);
    line(c, bx, by, bx + 1, by + 1.5 - t * 0.5, shade(col, 0.15));
  }
}
function pellets(c: Canvas, rng: Rng, x: number, y: number) {
  for (let i = 0; i < 4; i++) {
    const cx = x + rng.range(-4, 4), cy = y + rng.range(-1, 0);
    c.buf.ellipse(Math.round(c.ax + cx), Math.round(c.ay + cy), 1.6, 1.1, hex('#3a2a1a'));
    c.buf.set(Math.round(c.ax + cx - 1), Math.round(c.ay + cy - 1), hex('#6a5438'));
    // glinting scales (the scat clue)
    if (i % 2) c.buf.set(Math.round(c.ax + cx), Math.round(c.ay + cy), hex('#b8d0c8'));
  }
}

// ------------------------------------------------------------------ resource sprites
const cache = new Map<string, Sprite | null>();
export function resourceSprite(kind: string, depleted: boolean, seed = 1): Sprite | null {
  const key = kind + (depleted ? '-' : '+') + (seed % 7);
  if (cache.has(key)) return cache.get(key)!;
  const s = build(kind, depleted, (seed % 7) + 1);
  cache.set(key, s);
  return s;
}

function build(kind: string, dep: boolean, seed: number): Sprite | null {
  const rng = new Rng(seed * 131 + kind.length * 7);
  const P = (k: PlantKind, size?: number) => plant(k, seed, size);
  switch (kind) {
    case 'flax': return dep ? P('flax', 22) : P('flax', 40);
    case 'treefern': return dep ? P('fiddlehead') : P('crownfern', 40);
    case 'kawakawa': return dep ? P('kawakawa', 16) : P('kawakawa', 26);
    case 'pitcher': return dep ? P('pitcher', 12) : P('pitcher', 20);
    case 'rata':
    case 'moonfruit': {
      const base = P('shrub', 30);
      if (dep) return tintAll(base, c => shade(c, -0.08));
      const c = onto(base);
      const h = base.ay;
      if (kind === 'rata') dots(c, rng, 14, 0, -h * 0.62, base.buf.w * 0.7, h * 0.5, 1, hex('#d8283a'), hex('#ff8a70'));
      else dots(c, rng, 6, 0, -h * 0.5, base.buf.w * 0.6, h * 0.45, 2, hex('#e8e2b8'), hex('#fffbe8'));
      return finish(c);
    }
    case 'mossrock': {
      const rock = deadwood('rock', seed, 24);
      if (dep) return rock;
      const c = onto(rock);
      stamp(c, P('moss', 20), 0, -rock.ay * 0.55);
      return finish(c);
    }
    case 'glowcap': return dep ? deadwood('litter', seed) : fungus('glowcap', seed, 16);
    case 'inkcap': return dep ? deadwood('litter', seed) : fungus('inkcap', seed);
    case 'bracket': {
      const st = deadwood('stump', seed, 26);
      if (dep) return st;
      const c = onto(st);
      stamp(c, fungus('bracket', seed, 14), 6, -st.ay * 0.35);
      return finish(c);
    }
    case 'grublog': {
      const lg = deadwood('rottenlog', seed, 34);
      if (dep) return tintAll(lg, x => shade(x, -0.1));
      const c = onto(lg);
      // bore holes and a fat grub
      for (let i = 0; i < 3; i++) c.buf.disc(Math.round(c.ax - 8 + i * 7), Math.round(c.ay - 5 - (i % 2) * 2), 1, hex('#1a100a'));
      c.buf.ellipse(Math.round(c.ax + 4), Math.round(c.ay - 3), 2.2, 1.3, hex('#f0e2b8'));
      c.buf.set(Math.round(c.ax + 6), Math.round(c.ay - 3), hex('#6a3a1a'));
      return finish(c);
    }
    case 'lanternbeetle':
    case 'skymoth':
    case 'mantis':
    case 'dragonfly':
    case 'weta': {
      const host: Sprite = kind === 'weta' ? deadwood('log', seed, 30) : kind === 'mantis' ? P('taro', 30) : kind === 'dragonfly' ? P('sedge', 30) : kind === 'skymoth' ? P('flowers', 22) : P('fern', 28);
      if (dep) return host;
      const c = onto(host, 14, kind === 'lanternbeetle');
      const b = bug(kind);
      const y = kind === 'weta' ? -host.ay + 3 : -host.ay * 0.7;
      stamp(c, b, kind === 'dragonfly' ? 4 : 2, y, false);
      return finish(c);
    }
    case 'thornfur': {
      const base = P('shrub', 24);
      if (dep) return base;
      const c = onto(base);
      for (let i = 0; i < 5; i++) line(c, 3 + i, -base.ay * 0.45 + i * 0.4, 5 + i * 1.3, -base.ay * 0.45 + 3, i % 2 ? hex('#8a5a34') : hex('#b88048'));
      return finish(c);
    }
    case 'feather':
    case 'dropping':
    case 'quill':
    case 'bone':
    case 'eggshell':
    case 'plate':
    case 'shedskin': {
      const base = kind === 'shedskin' ? deadwood('roots', seed) : deadwood('litter', seed);
      if (dep) return base;
      const c = onto(base);
      const y = -2;
      if (kind === 'feather') feather(c, 0, y, hex('#6a8ab0'));
      else if (kind === 'dropping') pellets(c, rng, 0, y + 1);
      else if (kind === 'quill') for (let i = 0; i < 3; i++) { line(c, -5 + i * 3, y + 1, -1 + i * 3, y - 3 + i, hex('#f0e6c8')); px(c, -1 + i * 3, y - 3 + i, hex('#3a2a1a')); }
      else if (kind === 'bone') {
        c.buf.ellipse(Math.round(c.ax), Math.round(c.ay + y), 4, 2.2, hex('#e8e0c8'));
        c.buf.rect(Math.round(c.ax - 1), Math.round(c.ay + y - 5), 2, 4, hex('#dcd2b8'));
        c.buf.disc(Math.round(c.ax), Math.round(c.ay + y), 1, hex('#8a7a60'));
      } else if (kind === 'eggshell') {
        for (let i = 0; i < 3; i++) { const x = -4 + i * 4; c.buf.ellipse(Math.round(c.ax + x), Math.round(c.ay + y + (i % 2)), 2, 1.3, hex('#e8f0e0')); px(c, x, y + (i % 2) + 1, hex('#6a8a7a')); }
      } else if (kind === 'plate') {
        c.buf.poly([c.ax - 5, c.ay + y + 1, c.ax - 2, c.ay + y - 3, c.ax + 4, c.ay + y - 2, c.ax + 5, c.ay + y + 1], hex('#8a7058'));
        line(c, -3, y - 1, 3, y - 1, hex('#b89878'));
      } else {
        // shed skin ribbon
        for (let i = 0; i < 14; i++) px(c, -7 + i, y - 1 + Math.round(Math.sin(i * 0.8) * 1.5), i % 3 ? hex('#e0dcc0') : hex('#b8b08a'));
      }
      c.buf.outline(withAlpha(OL, 255));
      return finish(c);
    }
    case 'driftwood': {
      const b = deadwood('branch', seed, 22);
      const s = tintAll(b, x => mix(x, hex('#c8bca8'), 0.55));
      return dep ? null : s;
    }
    case 'stones': {
      const r1 = deadwood('rock', seed, 12);
      if (dep) return deadwood('rock', seed + 3, 8);
      const c = onto(r1, 14);
      stamp(c, deadwood('rock', seed + 1, 9), -8, 1);
      stamp(c, deadwood('rock', seed + 2, 8), 8, 1);
      return finish(c);
    }
    case 'shells': {
      const rock = deadwood('rock', seed, 18);
      if (dep) return rock;
      const c = onto(rock);
      for (let i = 0; i < 6; i++) {
        const x = -6 + i * 2.4, y = -2 - (i % 3) * 2;
        c.buf.ellipse(Math.round(c.ax + x), Math.round(c.ay + y), 1.4, 1, hex('#1e2a4a'));
        px(c, x - 0.5, y - 0.5, hex('#6a88b8'));
      }
      return finish(c);
    }
    case 'seaweed': {
      const s = P('sedge', dep ? 12 : 22);
      return tintAll(s, x => mix(x, hex('#5a5a24'), 0.5));
    }
    case 'crate': {
      const cr = paintCrate(24, 18, true, seed);
      const s: Sprite = { buf: cr.buf, ax: Math.round(cr.ax), ay: Math.round(cr.ay) };
      if (!dep) {
        // washed up: tilted, with a strand of kelp
        const c = onto(s);
        for (let i = 0; i < 8; i++) px(c, -10 + i * 2, -18 + Math.round(Math.sin(i) * 1.2), hex('#4a5a24'));
        return finish(c);
      }
      // opened: lid off, dark inside
      const c = onto(s);
      c.buf.rect(Math.round(c.ax - 10), Math.round(c.ay - 17), 20, 4, hex('#1e140c'));
      return finish(c);
    }
    case 'snare': {
      const g = P('grass', 20);
      const c = onto(g);
      line(c, 4, 0, 4, -10, hex('#6a4a2a'));
      if (!dep) {
        for (let a = 0; a < 12; a++) px(c, 4 - 3 + Math.cos(a / 12 * Math.PI * 2) * 3, -4 + Math.sin(a / 12 * Math.PI * 2) * 2, hex('#c8b080'));
        feather(c, -4, -1, hex('#8a6a44'));
      }
      return finish(c);
    }
  }
  return null;
}

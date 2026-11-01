// V12 Te Rua Pōuri, the small life drawn pixel by pixel (the swarms in src/game/v12/cave/bugs.ts):
// cave moths fluttering (wings up, spread, down), long-tailed bats hanging from the roof and flying,
// a tiny centipede in two leg-steps, a tiny harvestman, a springtail. Each frame is a hand-placed map.

import { PixelBuffer } from '../../pixel';
import { hex } from '../../color';
import type { C } from '../../color';

function map(rows: string[], pal: Record<string, string>): PixelBuffer {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const b = new PixelBuffer(w, h);
  const P: Record<string, C> = {};
  for (const [k, v] of Object.entries(pal)) P[k] = hex(v);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = P[r[x]]; if (c !== undefined) b.set(x, y, c); } });
  return b;
}

const MOTH = { d: '#3a2a1c', m: '#7a6448', l: '#b8a07a', e: '#d8c8a0', b: '#4a3828', k: '#1a120c' };
/** a cave moth from above-and-behind: three wing beats (up, spread, down) */
export const MOTH_FRAMES: { buf: PixelBuffer; ax: number; ay: number }[] = [
  map([
    '...dkd...',
    '..dmbmd..',
    '..mlble..',
    '...lbl...',
    '....b....',
  ], MOTH),
  map([
    'dm.....md',
    'mlm...mlm',
    '.mlmbmlm.',
    '..eebee..',
    '....b....',
  ], MOTH),
  map([
    '....k....',
    '.mmmbmmm.',
    'dmlmbmlmd',
    '.d.ebe.d.',
  ], MOTH),
].map(b => ({ buf: b, ax: 4, ay: 2 }));

const BAT = { k: '#120c10', K: '#2e2228', m: '#4a3a42', e: '#c8a060', w: '#3a2c34' };
/** a bat hanging by its feet from the roof (anchor: its feet) */
export const BAT_HANG = { buf: map([
  '..k.k..',
  '..kKk..',
  '.wKKKw.',
  'wwKmKww',
  'w.KKK.w',
  '..KeK..',
  '...k...',
], BAT), ax: 3, ay: 0 };
/** a bat flying: wings up, wings down */
export const BAT_FLY = [
  map([
    'w.......w',
    'ww.....ww',
    '.wwKKKww.',
    '...KeK...',
    '....k....',
  ], BAT),
  map([
    '....k....',
    '...KeK...',
    '.wwKKKww.',
    'ww.....ww',
    'w.......w',
  ], BAT),
].map(b => ({ buf: b, ax: 4, ay: 2 }));

const CEN = { a: '#c88e44', d: '#5a2e12', h: '#8a4a20', l: '#e8b878', f: '#b07a3a' };
/** a small centipede scuttling (anchor: under its middle) */
export const CENTI_FRAMES = [
  map([
    '...........ff',
    '.........f..h',
    'adadadadadahh',
    'l.l.l.l.l.l..',
  ], CEN),
  map([
    '..........f.f',
    '.........f..h',
    'adadadadadahh',
    '.l.l.l.l.l.l.',
  ], CEN),
].map(b => ({ buf: b, ax: 6, ay: 3 }));

const HARV = { l: '#4a3018', k: '#2a1a0c', b: '#8a6434', B: '#c09a68' };
/** a small harvestman, legs arched (anchor: between its feet) */
export const HARV_FRAMES = [
  map([
    '..l...l..',
    '.l.l.l.l.',
    '.l.bBb.l.',
    'l..kbk..l',
    'l.l...l.l',
    'l.l...l.l',
  ], HARV),
  map([
    '...l.l...',
    '..l.l.l..',
    '.l.bBb.l.',
    'l..kbk..l',
    'l.l...l.l',
    'l..l.l..l',
  ], HARV),
].map(b => ({ buf: b, ax: 4, ay: 5 }));

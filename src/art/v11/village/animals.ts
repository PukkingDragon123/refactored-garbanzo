// V11 village livestock, painted per frame (side view, facing right, anchored between the feet):
//   pig     a round kunekune: short snout, tassels under the chin, ginger / black / cream-spotted
//   hen     brown or speckled; the rooster red and black with a green-black tail
//   dog     a village kurī: short coat, curled tail, ears up (tan, black-and-white, brindle)
//   goat    shaggy white or brown, swept-back horns, a beard
// Anims: idle (breathing), walk (4 frames), eat (head down: rooting, pecking, grazing), and for the
// dog sit / lie / wag. Each painter is cheap; the village caches the frames in the scene atlas.

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { bayer, clamp } from '../../../core/math';

export type Beast = 'pig' | 'hen' | 'rooster' | 'dog' | 'goat';
export type BeastAnim = 'idle' | 'walk' | 'eat' | 'sit' | 'lie' | 'wag' | 'flap';
export const FRAMES: Record<BeastAnim, number> = { idle: 2, walk: 4, eat: 2, sit: 2, lie: 2, wag: 4, flap: 2 };

const INK = hex('#140c08');
const rampOf = (base: string): C[] => { const c = hex(base); return [shade(c, -0.55), shade(c, -0.35), shade(c, -0.15), c, shade(c, 0.18), shade(c, 0.36)]; };
const dp = (r: C[], v: number, x: number, y: number) => r[clamp(Math.round(v + (bayer(x, y) - 0.5) * 0.9), 0, r.length - 1)];

/** a shaded blob (ellipse) with the light from the upper left */
function blob(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, r: C[], spots?: (x: number, y: number) => C | null) {
  b.ellipseFn(cx, cy, rx, ry, (x, y, nx, ny) => spots?.(x, y) ?? dp(r, 3.3 - nx * 0.9 - ny * 1.2, x, y));
}
function leg(b: PixelBuffer, x: number, top: number, bot: number, lift: number, fwd: number, c: C, w = 2) {
  for (let y = top; y <= bot - lift; y++) { const k = (y - top) / Math.max(1, bot - top); for (let i = 0; i < w; i++) b.set(Math.round(x + fwd * k) + i, y, c); }
}

const PIG_COLS = ['#c8783a', '#2a2420', '#e8d0b0'];
const DOG_COLS = ['#b07a40', '#1e1a18', '#7a5a3a'];
const GOAT_COLS = ['#e6e0d2', '#7a5434'];

function pig(v: number, anim: BeastAnim, i: number): Sprite {
  const b = new PixelBuffer(28, 18), base = 17;
  const r = rampOf(PIG_COLS[v % 3]);
  const spot = v % 3 === 2 ? (x: number, y: number) => (Math.sin(x * 0.9) + Math.cos(y * 1.3 + x * 0.3) > 1.2 ? hex('#3a2a22') : null) : undefined;
  const walk = anim === 'walk', eat = anim === 'eat';
  const ph = (i / FRAMES[anim]) * Math.PI * 2;
  const breathe = anim === 'idle' && i === 1 ? 1 : 0;
  // legs (far pair darker)
  const lg = (x: number, p: number, far: boolean) => leg(b, x, 11, base, walk ? Math.max(0, Math.sin(ph + p)) * 1.6 : 0, walk ? Math.cos(ph + p) * 1.5 : 0, far ? r[1] : r[2], 2);
  lg(8, Math.PI, true); lg(17, 0, true); lg(6, 0, false); lg(19, Math.PI, false);
  blob(b, 13, 8.5 - breathe * 0.4, 10, 6 + breathe * 0.3, r, spot);
  // the head, low for rooting
  const hx = 22, hy = eat ? 11 + i : 7;
  blob(b, hx, hy, 4.5, 4, r);
  b.ellipse(hx + 4, hy + 1, 1.6, 1.8, mix(r[3], hex('#e89a8a'), 0.5));
  b.set(hx + 5, hy + 1, INK);
  b.set(hx + 1, hy - 1, INK);
  b.set(hx - 2, hy - 4, r[2]); b.set(hx - 1, hy - 5, r[2]); b.set(hx, hy - 4, r[1]);
  // the tassels (piri piri) under the chin, and a curly tail
  b.set(hx, hy + 4, r[1]); b.set(hx + 1, hy + 5, r[1]);
  b.set(3, 6, r[2]); b.set(2, 5, r[2]); b.set(2, 4, r[3]);
  b.outline(INK);
  return { buf: b, ax: 13, ay: base };
}

function hen(rooster: boolean, v: number, anim: BeastAnim, i: number): Sprite {
  const b = new PixelBuffer(16, 16), base = 15;
  const col = rooster ? '#a8341e' : v % 2 ? '#8a5a30' : '#c8b8a0';
  const r = rampOf(col);
  const walk = anim === 'walk', eat = anim === 'eat', flap = anim === 'flap';
  const ph = (i / FRAMES[anim]) * Math.PI * 2;
  leg(b, 6, 10, base, walk ? Math.max(0, Math.sin(ph)) * 1.4 : 0, walk ? Math.cos(ph) : 0, hex('#d8a030'), 1);
  leg(b, 8, 10, base, walk ? Math.max(0, -Math.sin(ph)) * 1.4 : 0, walk ? -Math.cos(ph) : 0, hex('#c89020'), 1);
  // tail
  if (rooster) { for (let k = 0; k < 6; k++) { b.set(2 - (k > 3 ? 1 : 0), 3 + k, hex('#1a2a22')); b.set(3, 2 + k, hex('#2a3a30')); } }
  else { b.set(3, 5, r[2]); b.set(2, 4, r[2]); b.set(3, 4, r[3]); }
  blob(b, 7, 8, 5, 3.6, r, v % 2 && !rooster ? (x, y) => ((x * 3 + y * 5) % 7 === 0 ? hex('#f0e6d0') : null) : undefined);
  // wing
  if (flap) { for (let k = 0; k < 5; k++) b.line(6, 7, 3 + k, i ? 1 + k : 11 - k, r[4]); }
  else b.ellipse(6, 8, 3, 2, r[2]);
  // head and neck (down when pecking)
  const hx = eat ? 12 : 11, hy = eat ? 11 + i : 4;
  b.line(9, 7, hx, hy + 1, rooster ? hex('#d8782a') : r[3]);
  b.disc(hx, hy, 1.8, rooster ? hex('#d8782a') : r[4]);
  b.set(hx + 2, hy, hex('#e8b030')); b.set(hx + 1, hy - 1, INK);
  b.set(hx, hy - 2, hex('#d82a1a')); if (rooster) { b.set(hx - 1, hy - 2, hex('#d82a1a')); b.set(hx + 1, hy - 3, hex('#d82a1a')); b.set(hx + 1, hy + 2, hex('#d82a1a')); }
  b.outline(INK);
  return { buf: b, ax: 7, ay: base };
}

function dog(v: number, anim: BeastAnim, i: number): Sprite {
  const b = new PixelBuffer(28, 20), base = 19;
  const r = rampOf(DOG_COLS[v % 3]);
  const white = v % 3 === 1 ? (x: number, y: number) => (y > 10 || (x > 16 && y > 7) ? hex('#ece6da') : null) : undefined;
  const ph = (i / FRAMES[anim]) * Math.PI * 2;
  if (anim === 'lie') {
    blob(b, 12, 15, 10, 3.6, r, white);
    blob(b, 22, 14, 4, 3, r);
    b.set(25, 15, INK); b.set(22, 13, INK);
    b.set(20, 11, r[2]); b.set(21, 10, r[2]);
    for (let k = 0; k < 5; k++) b.set(2 + k, 16 + (i ? 0 : -1), r[2]);
  } else if (anim === 'sit') {
    leg(b, 16, 12, base, 0, 1, r[2], 2); leg(b, 18, 12, base, 0, 1, r[3], 2);
    blob(b, 12, 13, 6, 5.5, r, white);
    blob(b, 17, 9, 4, 5, r, white);
    blob(b, 19, 4, 4, 3.5, r);
    b.set(23, 5, INK); b.set(20, 3, INK);
    b.set(17, 0, r[2]); b.set(17, 1, r[3]); b.set(18, 1, r[2]);
    b.set(6, 16, r[3]); b.set(5, 15 - i, r[3]); b.set(4, 14 - i, r[4]);
  } else {
    const walk = anim === 'walk';
    const lg = (x: number, p: number, far: boolean) => leg(b, x, 11, base, walk ? Math.max(0, Math.sin(ph + p)) * 2 : 0, walk ? Math.cos(ph + p) * 2 : 0, far ? r[1] : r[2], 2);
    lg(6, Math.PI, true); lg(17, 0, true); lg(5, 0, false); lg(18, Math.PI, false);
    blob(b, 12, 9, 9, 4, r, white);
    const eat = anim === 'eat';
    const hx = 22, hy = eat ? 12 + i : 5;
    blob(b, hx, hy, 4, 3.4, r, white);
    b.ellipse(hx + 4, hy + 1, 2, 1.5, r[3]);
    b.set(hx + 5, hy, INK); b.set(hx + 1, hy - 1, INK);
    b.set(hx - 1, hy - 4, r[2]); b.set(hx - 1, hy - 5, r[2]); b.set(hx, hy - 4, r[3]);
    // the curled tail, wagging
    const wag = anim === 'wag' ? Math.sin(ph) * 2 : 0;
    b.set(3, 6, r[3]); b.set(2, 5 + wag * 0.5, r[3]); b.set(2, 4 + wag, r[4]); b.set(3, 3 + wag, r[4]);
  }
  b.outline(INK);
  return { buf: b, ax: 12, ay: base };
}

function goat(v: number, anim: BeastAnim, i: number): Sprite {
  const b = new PixelBuffer(28, 26), base = 25;
  const r = rampOf(GOAT_COLS[v % 2]);
  const walk = anim === 'walk', eat = anim === 'eat';
  const ph = (i / FRAMES[anim]) * Math.PI * 2;
  const lg = (x: number, p: number, far: boolean) => leg(b, x, 15, base, walk ? Math.max(0, Math.sin(ph + p)) * 2 : 0, walk ? Math.cos(ph + p) * 1.5 : 0, far ? r[1] : r[2], 2);
  lg(6, Math.PI, true); lg(16, 0, true); lg(5, 0, false); lg(17, Math.PI, false);
  // a shaggy body
  b.ellipseFn(11, 12, 9, 5, (x, y, nx, ny) => ((x + y * 3) % 5 === 0 ? r[2] : dp(r, 3.4 - nx * 0.8 - ny * 1.2, x, y)));
  for (let x = 4; x < 19; x += 2) b.set(x, 17, r[2]);
  const hx = 21, hy = eat ? 19 + i : 7;
  b.line(17, 10, hx - 1, hy + 1, r[3]); b.line(18, 11, hx, hy + 2, r[2]);
  b.ellipseFn(hx + 1, hy, 4, 2.6, (x, y, nx, ny) => dp(r, 3.4 - nx - ny, x, y));
  b.set(hx + 1, hy - 1, INK);
  // swept-back horns and a beard
  for (let k = 0; k < 5; k++) b.set(hx - 1 - k, hy - 3 - Math.round(Math.sin(k / 4 * 1.6) * 2), hex('#5a4a38'));
  b.set(hx + 3, hy + 3, r[2]); b.set(hx + 3, hy + 4, r[2]);
  b.set(hx - 2, hy - 1, r[2]);
  b.set(2, 9, r[3]); b.set(2, 8, r[4]);
  b.outline(INK);
  return { buf: b, ax: 11, ay: base };
}

/** one frame of a village animal */
export function beastFrame(kind: Beast, variant: number, anim: BeastAnim, i: number): Sprite {
  switch (kind) {
    case 'pig': return pig(variant, anim === 'sit' || anim === 'lie' || anim === 'wag' || anim === 'flap' ? 'idle' : anim, i);
    case 'hen': return hen(false, variant, anim === 'sit' || anim === 'lie' || anim === 'wag' ? 'idle' : anim, i);
    case 'rooster': return hen(true, variant, anim === 'sit' || anim === 'lie' || anim === 'wag' ? 'idle' : anim, i);
    case 'dog': return dog(variant, anim === 'flap' ? 'idle' : anim, i);
    case 'goat': return goat(variant, anim === 'sit' || anim === 'lie' || anim === 'wag' || anim === 'flap' ? 'idle' : anim, i);
  }
}

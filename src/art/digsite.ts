// A palaeontologists' dig on a ledge, placed pixel by pixel: a heap of spoil with a trowel stuck in
// it, survey pegs strung with a taut grid line and a scrap of flagging tape, a sieve tilted on its
// legs over the spoil, a dented bucket, a brush, and a little numbered tag on a peg (anchor bottom
// left: the ledge's walking surface is the bottom row).

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { hex } from './color';
import { bayer, clamp, hash2 } from '../core/math';

const r = (...h: string[]): C[] => h.map(x => hex(x));
const EARTH = r('#2e211c', '#46322a', '#634636', '#7f5c44', '#9c7656', '#b8926a', '#d0ac82');
const WOOD = r('#2a1c12', '#46301e', '#64462a', '#86603a', '#a87e50', '#c49c6a');
const TIN = r('#22262a', '#3a4046', '#58616a', '#7a848c', '#a0a8ae', '#c8ced2', '#eef2f2');
const STRING = hex('#e8dcc0'), TAPE = hex('#d8402c'), TAPE2 = hex('#f2ece0'), CARD = hex('#e6dcc4'), INK = hex('#3a3030');
const pick = (ramp: C[], v: number) => ramp[clamp(Math.round(v), 0, ramp.length - 1)];

export function paintDigSite(seed = 1): { buf: PixelBuffer; ax: number; ay: number } {
  const W = 104, H = 26, B = H - 1;
  const b = new PixelBuffer(W, H);
  const h = (x: number, y: number) => hash2(x, y, seed);
  // the spoil heap: loose earth, lit on its left shoulder, pebbles in it
  for (let x = 2; x < 34; x++) {
    const u = (x - 2) / 32;
    const top = Math.round(B - Math.sin(u * Math.PI) * 9 - (h(x >> 1, 1) - 0.5) * 2);
    for (let y = top; y <= B; y++) {
      const d = y - top;
      let l = 3.4 + (u < 0.45 ? 1 : -0.4) - d * 0.12 + (bayer(x, y) - 0.5) * 0.9;
      if (d === 0) l += 1;
      const p = h(x, y);
      b.set(x, y, p < 0.06 ? pick(TIN, 3 + (p < 0.03 ? 1 : 0)) : pick(EARTH, l));
    }
  }
  // the trowel stuck in the heap: a diamond blade going in, a short wooden handle
  for (let k = 0; k < 4; k++) b.set(22 + (k >> 1), B - 10 - k, pick(WOOD, 4 - (k & 1)));
  b.set(21, B - 9, TIN[5]); b.set(22, B - 9, TIN[4]); b.set(23, B - 9, TIN[2]);
  b.set(21, B - 8, TIN[4]); b.set(22, B - 8, TIN[3]); b.set(22, B - 7, TIN[3]);
  // survey pegs (lit on the left) with the grid line strung taut between their tops
  const pegs = [38, 66, 96];
  for (const px of pegs) for (let y = B - 9; y <= B; y++) { b.set(px, y, pick(WOOD, 4 - (y === B - 9 ? -1 : 0))); b.set(px + 1, y, pick(WOOD, 2)); }
  // the numbered tag on the first peg
  for (let y = B - 14; y <= B - 10; y++) for (let x = 35; x <= 41; x++) b.set(x, y, y === B - 14 || x === 35 ? hex('#f4ecd8') : CARD);
  b.set(37, B - 12, INK); b.set(38, B - 12, INK); b.set(40, B - 12, INK); b.set(37, B - 11, INK);
  // the sieve, tilted on two legs: a wooden frame round a wire mesh
  const sx0 = 44, sx1 = 62, syL = B - 12, syR = B - 7;
  const sy = (x: number) => syL + ((x - sx0) / (sx1 - sx0)) * (syR - syL);
  for (let x = sx0; x <= sx1; x++) {
    const y = Math.round(sy(x));
    b.set(x, y - 1, pick(WOOD, 5)); b.set(x, y, pick(WOOD, 3));
    for (let k = 1; k <= 3; k++) b.set(x, y + k, (x + k) % 2 ? pick(TIN, 2) : pick(TIN, 4 + (k === 1 ? 1 : 0)));
    b.set(x, y + 4, pick(WOOD, 2));
  }
  for (const [lx, top] of [[sx0 + 2, Math.round(sy(sx0 + 2)) + 5], [sx1 - 2, Math.round(sy(sx1 - 2)) + 5]] as const) for (let y = top; y <= B; y++) b.set(lx + (y - top > 3 ? 1 : 0), y, pick(WOOD, 2));
  // sifted grit fallen through onto the ledge under it
  for (let x = sx0 + 1; x < sx1; x++) if (h(x, 7) < 0.5) b.set(x, B, pick(EARTH, 4 + h(x, 8) * 2));
  // the bucket: tapered, dented, a lit seam down its left, the wire handle up over the top
  const bx = 74, bt = B - 9;
  for (let y = bt; y <= B; y++) {
    const inset = Math.floor((y - bt) / 5);
    for (let x = bx + inset; x <= bx + 9 - inset; x++) {
      const u = (x - bx) / 9;
      let l = 4.6 - u * 3 + (x === bx + inset + 1 ? 1.2 : 0) + (bayer(x, y) - 0.5) * 0.6;
      if (y === bt) l = 6;
      if (y === bt + 1) l -= 0.8;
      if (x === bx + 6 && y === bt + 4) l -= 2;
      b.set(x, y, pick(TIN, l));
    }
  }
  for (let x = bx + 1; x <= bx + 8; x++) b.set(x, bt + 1, pick(EARTH, 2));
  // the brush lying on the ledge: a wooden handle and a tuft of pale bristles
  for (let x = 86; x < 93; x++) b.set(x, B, pick(WOOD, 4 - (x & 1)));
  b.set(93, B, hex('#c8b890')); b.set(94, B, hex('#e0d4b0')); b.set(93, B - 1, hex('#b0a07a'));
  b.outline(hex('#140e0c'));
  // the thin things go on after the outline, so they stay one pixel: the grid line strung taut
  // between the pegs' tops, the flagging tape knotted on the middle peg, the bucket's wire handle
  for (let i = 0; i + 1 < pegs.length; i++) {
    const a = pegs[i] + 1, c = pegs[i + 1];
    for (let x = a; x <= c; x++) { const t = (x - a) / (c - a); b.set(x, B - 8 + Math.round(Math.sin(t * Math.PI) * 0.6), STRING); }
  }
  // the tape flutters off downwind
  for (let k = 0; k < 5; k++) b.set(67 + k, B - 9 + (k > 2 ? 1 : 0), k % 2 ? TAPE2 : TAPE);
  for (const [dx, dy] of [[0, -1], [1, -3], [2, -4], [3, -5], [4, -5], [5, -5], [6, -4], [7, -3], [9, -1]]) b.set(bx + dx, bt + dy, TIN[2]);
  return { buf: b, ax: 0, ay: B };
}

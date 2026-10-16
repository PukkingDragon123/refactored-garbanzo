// V11 Blueprints: the drafting table's pixel art. The wooden table top, the leather folio with its
// file tabs and index cards, little kind icons and status marks, push pins and tape, the CRAFT rubber
// stamp, the R&D request slip, the RP luggage tag, the hammer and the cutting mat for the craft moment.
// Everything is painted into PixelBuffers at 1:1 (the table is scaled up by whole pixels).

import { PixelBuffer } from '../../../art/pixel';
import { hex, mix } from '../../../art/color';
import type { C } from '../../../art/color';
import { dith, rnd, vnoise } from './pxdraw';
import { drawText, textW } from './pxfont';

const H = (s: string) => hex(s);
const pick = (r: C[], v: number, x: number, y: number): C => {
  const f = Math.max(0, Math.min(0.9999, v)) * (r.length - 1), i = Math.floor(f);
  return r[dith(x, y, f - i) ? Math.min(r.length - 1, i + 1) : i];
};

/** a sprite from rows of palette letters ('.' = clear) */
export function spr(rows: string[], pal: Record<string, string>): PixelBuffer {
  const b = new PixelBuffer(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && pal[ch]) b.set(x, y, H(pal[ch])); }));
  return b;
}

// ---------------------------------------------------------------- the table
const WOOD = ['#2c1a10', '#3a2416', '#48301e', '#563a24', '#64462c', '#72522f'].map(H);
/** the drafting table: wide planks, grain, a knot or two, darker toward the corners (quantised) */
export function paintTable(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const plank = 38;
  for (let y = 0; y < h; y++) {
    const pi = Math.floor(y / plank), py = y % plank;
    for (let x = 0; x < w; x++) {
      const s = pi * 17 + 3;
      const g = vnoise(x / 40, y / 3.2 + pi * 9, s), g2 = vnoise(x / 9, y / 1.1, s + 1);
      let v = 0.5 + (rnd(pi, 0, 4) - 0.5) * 0.18 + (g - 0.5) * 0.35 + (g2 > 0.78 ? -0.14 : 0);
      // knots
      const kx = (rnd(pi, 1, 5) * w) | 0, ky = pi * plank + 12 + ((rnd(pi, 2, 5) * 14) | 0);
      const kd = Math.hypot((x - kx) / 5, (y - ky) / 2.6);
      if (kd < 1) v -= 0.3 * (1 - kd) + (kd > 0.6 ? 0.1 : 0);
      else if (kd < 2.2 && Math.sin(kd * 6) > 0.6) v -= 0.08;
      // vignette, in two quantised steps
      const ex = Math.min(x, w - 1 - x) / w, ey = Math.min(y, h - 1 - y) / h, e = Math.min(ex * 1.4, ey * 2);
      if (e < 0.06) v -= 0.16; else if (e < 0.12 && dith(x, y, 0.5)) v -= 0.08;
      let c = pick(WOOD, v, x, y);
      if (py === 0) c = WOOD[0];
      else if (py === 1) c = WOOD[4];
      b.set(x, y, c);
    }
  }
  // a few scratches and a pencil mark
  for (let i = 0; i < 9; i++) {
    const x0 = rnd(i, 3, 9) * w, y0 = rnd(i, 4, 9) * h, L = 6 + rnd(i, 5, 9) * 16, a = (rnd(i, 6, 9) - 0.5) * 0.6;
    for (let t = 0; t < L; t++) b.set(Math.round(x0 + Math.cos(a) * t), Math.round(y0 + Math.sin(a) * t), WOOD[5]);
  }
  return b;
}

// ---------------------------------------------------------------- the folio
const LEATHER = ['#2a140c', '#3c1e12', '#4e2a18', '#5e3620', '#6e4228'].map(H);
/** the open leather folio the sheets are kept in */
export function paintFolio(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const corner = (x < 2 && y < 2) || (x > w - 3 && y < 2) || (x < 2 && y > h - 3) || (x > w - 3 && y > h - 3);
    if (corner && (x + y) % 2 === 0) continue;
    const v = 0.55 + (vnoise(x / 6, y / 6, 21) - 0.5) * 0.3 + (rnd(x, y, 22) < 0.05 ? -0.15 : 0);
    let c = pick(LEATHER, v, x, y);
    if (x === 0 || y === 0) c = LEATHER[4]; else if (x === w - 1 || y === h - 1) c = LEATHER[0];
    b.set(x, y, c);
  }
  // stitching round the edge
  for (let x = 4; x < w - 4; x += 3) { b.set(x, 3, H('#c8a070')); b.set(x, h - 4, H('#c8a070')); }
  for (let y = 4; y < h - 4; y += 3) { b.set(3, y, H('#c8a070')); b.set(w - 4, y, H('#c8a070')); }
  return b;
}

/** a file tab sticking up from the folio (n > 0: a red dot, there's something to make in it) */
export function paintTab(label: string, col: C, on: boolean, n = 0): PixelBuffer {
  const b = paintTabBase(label, col, on);
  if (n > 0) for (const [x, y] of [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2]] as [number, number][]) b.set(b.w - 5 + x, 1 + y, x === 1 && y === 0 ? H('#ff9a8a') : H('#d8402c'));
  return b;
}
function paintTabBase(label: string, col: C, on: boolean): PixelBuffer {
  const tw = textW(label, { font: 'tiny', color: 0 });
  const w = tw + 8, h = on ? 11 : 10;
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((y === 0 && (x < 2 || x > w - 3)) || (y === 1 && (x < 1 || x > w - 2))) continue;
    let c = col;
    if (x === 0 || y === 0 || (y === 1 && x === 1)) c = mix(col, H('#ffffff'), 0.3);
    else if (x === w - 1) c = mix(col, H('#000000'), 0.3);
    if (!on && y > h - 3) c = mix(col, H('#000000'), 0.25);
    b.set(x, y, c);
  }
  drawText(b, label, 4, 3, { font: 'tiny', color: on ? H('#2a1e18') : mix(H('#2a1e18'), col, 0.35) });
  return b;
}

/** an index card for one row of the list */
export function paintCard(w: number, h: number, sel: boolean, dim: boolean): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const base = dim ? H('#bdb29a') : H('#ece2c6'), hi = dim ? H('#cbc0a6') : H('#f6eed8'), lo = dim ? H('#9a8f78') : H('#c4b896');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = dith(x, y, 0.12) ? lo : base;
    if (y === 0) c = hi; else if (y === h - 1 || x === w - 1) c = lo;
    if (y === 3 && x > 2 && x < w - 3) c = mix(base, H('#c86a5a'), 0.35);
    b.set(x, y, c);
  }
  if (sel) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || x === 1 || y === 0 || y === h - 1 || x === w - 1 || x === w - 2) b.set(x, y, H('#ffcf5a'));
  return b;
}

// ---------------------------------------------------------------- icons (kinds and states)
const P = { a: '#7a4a28', b: '#b07a44', c: '#e2b878', d: '#2a1e18', e: '#8a929a', f: '#c8d0d6', g: '#3a6aa8', h: '#9cc8f0', i: '#d8402c', j: '#f0a030', k: '#4a7a3a', l: '#8ac060', m: '#ffe08a', n: '#5a5450', o: '#e8e2d4' };
export const KIND_ICON: Record<string, PixelBuffer> = {
  weapon: spr(['b.......b', 'cb.....bc', '.b.....b.', '..b...b..', '...bab...', '....a....', '....a....', '....a....', '....a....'], P),
  tool: spr(['...ff....', '..f..f...', '..f.ff...', '...fe....', '...e.....', '..e......', '.e.......', 'e........', '.........'], P),
  equipment: spr(['..dddd...', '.deeeed..', 'deffffed.', 'defhhfed.', 'defhhfed.', 'deffffed.', '.deeeed..', '..dddd...', '.........'], P),
  survival: spr(['....j....', '...jj....', '...jmj...', '..jmmj...', '..jmmmj..', '.jmiimj..', '.jiiiij..', '..iiii...', '.........'], P),
  camp: spr(['....d....', '...dbd...', '..dbcbd..', '..dbcbd..', '.dbccbbd.', '.dbcdcbd.', 'dbbcdcbbd', 'ddddddddd', '.........'], P),
  research: spr(['...dd....', '...hd....', '...hd....', '..hhhd...', '.hhlhhd..', '.hllllhd.', 'hllllllhd', 'dddddddd.', '.........'], P),
  recipe: spr(['..k.k....', '...k.....', '.ddddddd.', 'doooooood', 'doooooood', '.doooood.', '..ddddd..', '.........', '.........'], P),
};
export const MARK: Record<string, PixelBuffer> = {
  ready: spr(['..eee..', '..efe..', '...a...', '...a...', '...a...', '...a...'], P),
  tick: spr(['......i', '.....i.', 'i...i..', '.i.i...', '..i....'], P),
  lab: spr(['.ddd.', 'd.h.d', 'd.hhd', 'd...d', '.ddd.'], P),
  lock: spr(['.eee.', 'e...e', 'fffff', 'ffeff', 'fffff'], P),
  rp: spr(['.h.', 'hgh', '.h.'], P),
  pin: spr(['.ii.', 'iiii', '.ii.', '..e.', '..e.'], P),
};

// ---------------------------------------------------------------- pins and tape
export function paintPin(col: string): PixelBuffer {
  return spr(['.aab.', 'aaaab', 'aaaab', '.bbb.', '..c..', '..c..'], { a: col, b: '#00000066'.slice(0, 7), c: '#8a929a' });
}
export function paintTape(w: number): PixelBuffer {
  const h = 6, b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x === 0 || x === w - 1) && (y % 2 === 1)) continue;
    b.set(x, y, dith(x, y, 0.5) ? H('#e8dcae') : H('#d8ca98'));
  }
  return b;
}

// ---------------------------------------------------------------- buttons
/** the CRAFT rubber stamp: a turned wooden knob, the block, the red rubber */
export function paintStampTool(on: boolean): PixelBuffer {
  const w = 34, h = 34, b = new PixelBuffer(w, h);
  const wood = on ? ['#5a3420', '#8a5a34', '#b07a48', '#d4a068'] : ['#4a3a30', '#6a5a4c', '#857464', '#9a8a78'];
  const W = wood.map(H);
  // knob
  for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) { const d = Math.hypot((x - 17) / 6, (y - 5) / 5); if (d < 1) b.set(x, y, W[d < 0.45 && x < 17 ? 3 : d < 0.8 ? 2 : 1]); }
  // neck
  for (let y = 9; y < 15; y++) for (let x = 14; x < 21; x++) b.set(x, y, W[x < 16 ? 3 : x > 18 ? 1 : 2]);
  // block
  for (let y = 15; y < 28; y++) for (let x = 2; x < w - 2; x++) b.set(x, y, W[y === 15 ? 3 : x === 2 ? 2 : x === w - 3 || y === 27 ? 0 : 1]);
  // rubber
  const red = on ? ['#7a1a14', '#b8322a', '#d85a48'] : ['#4a3a38', '#6a5a58', '#7a6a68'];
  for (let y = 28; y < 32; y++) for (let x = 3; x < w - 3; x++) b.set(x, y, H(red[y === 28 ? 2 : y === 31 ? 0 : 1]));
  drawText(b, 'CRAFT', 17 - Math.floor(textW('CRAFT', { font: 'tiny', color: 0 }) / 2), 19, { font: 'tiny', color: on ? H('#f6e6c8') : H('#b0a090') });
  return b;
}
/** the R&D request slip (a perforated form with a paper clip): heading lines in blue, the last in red */
export function paintSlip(lines: string[], on: boolean): PixelBuffer {
  const w = Math.max(...lines.map(l => textW(l, { font: 'tiny', color: 0 }))) + 12, h = 10 + lines.length * 7;
  const b = new PixelBuffer(w, h);
  const base = on ? H('#e8eef8') : H('#b8bcc4'), edge = on ? H('#9ab0cc') : H('#8a8e96');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x === 0 && y % 3 === 1) continue;
    let c = dith(x, y, 0.1) ? edge : base;
    if (y === 0 || y === h - 1 || x === w - 1) c = edge;
    if (y === 6 && x > 3) c = mix(base, H('#3a6aa8'), 0.4);
    b.set(x, y, c);
  }
  for (let x = 3; x < w - 2; x++) b.set(x, 2, on ? H('#3a6aa8') : edge);
  lines.forEach((l, i) => drawText(b, l, 5, 9 + i * 7, { font: 'tiny', color: on ? (i === lines.length - 1 ? H('#a8321e') : H('#1e3a6a')) : H('#6a6e76') }));
  // the clip
  for (const [x, y] of [[w - 8, 0], [w - 8, 1], [w - 8, 2], [w - 8, 3], [w - 7, 4], [w - 6, 4], [w - 5, 3], [w - 5, 2], [w - 5, 1], [w - 6, 0]] as [number, number][]) b.set(x, y, H('#8a929a'));
  return b;
}
/** a luggage tag on a string, with text */
export function paintTag(text: string, col = '#e8dcb0'): PixelBuffer {
  const tw = textW(text, { font: 'caps', color: 0 });
  const w = tw + 14, h = 13, b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cut = x < 4 && (y < 4 - x || y > h - 5 + x);
    if (cut) continue;
    let c = dith(x, y, 0.15) ? mix(H(col), H('#000000'), 0.12) : H(col);
    if (y === h - 1 || x === w - 1) c = mix(H(col), H('#000000'), 0.3);
    b.set(x, y, c);
  }
  for (const [x, y] of [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7]] as [number, number][]) b.set(x, y, H('#5a4030'));
  drawText(b, text, 9, 3, { font: 'caps', color: H('#3a2a1c') });
  return b;
}
/** a small paper note strip (messages on the table) */
export function paintNote(lines: string[], col = '#f4e8a8'): PixelBuffer {
  const w = Math.max(...lines.map(l => textW(l, { font: 'hand', color: 0, slant: 0.15 }))) + 14, h = lines.length * 10 + 8;
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = dith(x, y, 0.08) ? mix(H(col), H('#000000'), 0.1) : H(col);
    if (y === h - 1 || x === w - 1) c = mix(H(col), H('#000000'), 0.3);
    b.set(x, y, c);
  }
  lines.forEach((l, i) => drawText(b, l, 7, 4 + i * 10, { font: 'hand', color: H('#3a2a1c'), slant: 0.15, seed: i }));
  return b;
}

// ---------------------------------------------------------------- the craft moment
/** a green cutting mat with its grid */
export function paintMat(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = dith(x, y, 0.2) ? H('#2a5a44') : H('#2f644c');
    if (x % 10 === 0 || y % 10 === 0) c = H('#4a8a6a');
    if (x % 50 === 0 || y % 50 === 0) c = H('#6aaa86');
    if (x === 0 || y === 0) c = H('#7ac09a'); else if (x === w - 1 || y === h - 1) c = H('#1a3a2a');
    b.set(x, y, c);
  }
  return b;
}
/** the claw hammer, head up (rotate it with rotateNN for the swing) */
export function paintHammer(): PixelBuffer {
  return spr([
    '..eeeeeee.',
    '.effffffee',
    '.eeeeeeee.',
    '....aa..ee',
    '....ab....',
    '....ab....',
    '....ab....',
    '....ab....',
    '....ab....',
    '....ab....',
    '....ab....',
    '...aabb...',
    '...aaab...',
  ], P);
}

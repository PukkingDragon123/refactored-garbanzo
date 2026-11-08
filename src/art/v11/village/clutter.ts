// V12 Te Kāinga clutter: the everyday mess of a lived-in village, painted from a seed so that many
// variants come cheap, but each one is still built up pixel by pixel: an irregular, hand-shaped
// silhouette, shading by form (lit from the upper left like the rest of the island), texture, a worn
// edge or a patch, highlights, and the village's ink outline.
//   letters        hand-painted pixel lettering (a 3x5 and a 5x7 capital alphabet, macrons, a caron)
//   garment        washing: shirts, tees, singlets, trousers, shorts, dresses, sheets, towels, wraps,
//                  socks, baby clothes and jerseys, in a style (mixed, Pacific prints, work, kids),
//                  plain, striped, checked, spotted, floral, twill or knit, some of them patched
//   washLine       the line itself: T-posts or nothing (strung between houses), a forked prop pole
//   produce        one piece of fruit or veg (used by the crates, baskets and stalls)
//   crate, crateStack, barrel, barrelGroup, bucket, ropeCoil, tarpHeap, netHeap, ladder,
//   wheelbarrow, tools, puddle, firewood, matFrame (+ matStrands), ketePile, wakaHull, kidsThing

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade, ramp } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Rng, bayer, clamp, noise1 } from '../../../core/math';
import { VP } from './props';

export const R = (...h: string[]): C[] => h.map(v => hex(v));
export const S = (b: PixelBuffer, ax: number, ay: number, outline = true): Sprite => { if (outline) b.outline(VP.ink); return { buf: b, ax, ay }; };
export const pick = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];
/** dithered ramp pick: v in ramp units */
export const dpick = (r: C[], v: number, x: number, y: number) => pick(r, v + (bayer(x, y) - 0.5) * 0.9);
export const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
/** a 6-step ramp (dark to light) around a base colour */
export const ramp6 = (c: string | C, spread = 0.6) => ramp(typeof c === 'string' ? hex(c) : c, 6, spread);

export const QP = {
  galv: R('#1a2024', '#343e44', '#53606a', '#76848a', '#9eaaac', '#cad2d0'),
  canvas: R('#30281a', '#4e4430', '#706246', '#94845e', '#b6a67a', '#d8c99c'),
  tarp: R('#0c1a30', '#173054', '#244c78', '#386a96', '#5a8cb4', '#88b2cc'),
  tarpGreen: R('#101e14', '#1c3222', '#2a4a30', '#3c6440', '#588254', '#7ca470'),
  hessian: R('#33240f', '#54401e', '#765c30', '#987a46', '#b8985e', '#d6b67c'),
  bamboo: R('#2e300e', '#4e521a', '#727626', '#969838', '#b8b650', '#dcd678'),
  gum: R('#3a1202', '#6e2804', '#a64a08', '#d67812', '#f4a62c', '#ffe08a'),
  glass: R('#18262a', '#2c4246', '#486466', '#729490', '#a6c4bc', '#e2f2ea'),
  paint: R('#46443c', '#6a665a', '#908a7a', '#b6ae9a', '#d4ccb6', '#eee8d4'),
  lantern: R('#320604', '#600e08', '#94180e', '#c42c18', '#e8562a', '#ffa04c'),
  banana: R('#0c2612', '#18441c', '#286424', '#3c862e', '#5aa63a', '#8cc852'),
  dry: R('#2e2010', '#4c3618', '#6e5022', '#8e6c30', '#ae8a44', '#ccaa62'),
  mud: R('#1a120c', '#2a1e14', '#3c2c1e', '#4e3c2a', '#665036', '#7e6444'),
  sky: R('#2a3a4a', '#46607a', '#6a88a0', '#94b0c4', '#bcd2de', '#e6f2f4'),
  fish: R('#1e2a34', '#3a4e5c', '#5e7684', '#8ca2ac', '#bccace', '#eef4f2'),
  husk: R('#24140a', '#3e2412', '#5c381c', '#7c5028', '#9c6a38', '#bc8a50'),
  rope: R('#4a3e26', '#6a5a38', '#8c7a50', '#ac9a6a', '#cab888', '#e4d6a8'),
};

// ------------------------------------------------------------------ lettering
// glyph rows separated by '|' ('#' paint, '.' clear); marks: macron above, caron above
const F3: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.', E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#', I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###', M: '#...#|##.##|#.#.#|#...#|#...#', N: '#..#|##.#|#.##|#..#|#..#', O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..', Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.', T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#...#|#...#|#.#.#|##.##|#...#', X: '#.#|#.#|.#.|#.#|#.#', Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###', 0: '###|#.#|#.#|#.#|###', 1: '.#|##|.#|.#|.#', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.',
  4: '#.#|#.#|###|..#|..#', 5: '###|#..|##.|..#|##.', 6: '.##|#..|###|#.#|###', 7: '###|..#|.#.|.#.|.#.', 8: '###|#.#|###|#.#|###',
  9: '###|#.#|###|..#|##.', '$': '.#.|.##|#..|.#.|..#|##.|.#.', '&': '.#..|#.#.|.#..|#.##|.##.', '.': '.|.|.|.|#', ',': '.|.|.|.|#|#',
  "'": '#|#|.|.|.', '-': '..|..|##|..|..', '/': '..#|..#|.#.|#..|#..', ':': '.|#|.|#|.', c: '..|..|##|#.|##', '!': '#|#|#|.|#', '·': '.|.|#|.|.',
};
const F5: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####', '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '.': '.|.|.|.|.|.|#', "'": '#|#|.|.|.|.|.', '-': '...|...|...|###|...|...|...', '·': '.|.|.|#|.|.|.',
};
const MARK: Record<string, [string, 'macron' | 'caron']> = { Ā: ['A', 'macron'], Ē: ['E', 'macron'], Ī: ['I', 'macron'], Ō: ['O', 'macron'], Ū: ['U', 'macron'], Š: ['S', 'caron'] };
const glyph = (font: 3 | 5, ch: string) => { const t = (font === 3 ? F3 : F5)[ch]; return t ? t.split('|') : null; };
export interface LetterOpts {
  /** paint colours (one picked per pixel, worn brush) */
  col: C[];
  /** a drop shadow to the lower right */
  shadow?: C;
  /** chance a letter sits a pixel high or low (hand-painted) */
  wobble?: number;
  /** chance a painted pixel has worn off */
  wear?: number;
  seed?: number;
  /** extra space between letters */
  track?: number;
}
/** the width a line of lettering takes */
export function lettersWidth(text: string, font: 3 | 5, track = 1) {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') { w += font === 3 ? 2 + track : 3 + track; continue; }
    const g = glyph(font, MARK[ch]?.[0] ?? ch);
    if (g) w += g[0].length + track;
  }
  return Math.max(0, w - track);
}
/** paint a line of capitals with its top-left at (x, y); returns the width */
export function letters(b: PixelBuffer, x: number, y: number, text: string, font: 3 | 5, o: LetterOpts) {
  const rng = new Rng(o.seed ?? 7), track = o.track ?? 1;
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') { cx += font === 3 ? 2 + track : 3 + track; continue; }
    const mk = MARK[ch];
    const g = glyph(font, mk ? mk[0] : ch);
    if (!g) continue;
    const dy = (o.wobble ?? 0) > 0 && rng.chance(o.wobble!) ? (rng.chance(0.5) ? -1 : 1) : 0;
    const top = y + dy - (ch === '$' ? 1 : 0);
    const gw = g[0].length;
    const px = (X: number, Y: number) => {
      if (o.wear && rng.chance(o.wear)) return;
      if (o.shadow !== undefined && !b.opaque(X + 1, Y + 1)) b.set(X + 1, Y + 1, o.shadow);
      b.set(X, Y, o.col[rng.int(0, o.col.length - 1)]);
    };
    g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') px(cx + i, top + j); });
    if (mk?.[1] === 'macron') for (let i = 0; i < gw; i++) px(cx + i, top - 2);
    if (mk?.[1] === 'caron') { px(cx, top - 3); px(cx + gw - 1, top - 3); px(cx + Math.floor(gw / 2), top - 2); }
    cx += gw + track;
  }
  return cx - x - track;
}

// ------------------------------------------------------------------ washing
export type GarmentKind = 'shirt' | 'tee' | 'singlet' | 'trousers' | 'shorts' | 'dress' | 'sheet' | 'towel' | 'wrap' | 'socks' | 'baby' | 'jersey';
export type WashStyle = 'mixed' | 'pacific' | 'work' | 'kids';
const WASH: Record<WashStyle, { kinds: GarmentKind[]; cols: string[] }> = {
  mixed: { kinds: ['shirt', 'tee', 'trousers', 'dress', 'sheet', 'towel', 'socks', 'jersey', 'shorts', 'singlet', 'tee'], cols: ['#b8382a', '#2c5a96', '#e8dfc8', '#3a7a4a', '#d8a030', '#6a3a7a', '#d86a8a', '#4a8ab8', '#2e2e34', '#8a5a3a', '#e07a30', '#1e6a6a', '#f2efe6', '#c8c8c0'] },
  pacific: { kinds: ['wrap', 'wrap', 'tee', 'dress', 'shirt', 'towel', 'baby', 'shorts', 'wrap'], cols: ['#c8281e', '#1e5aa8', '#e8b81e', '#e05a8a', '#2a8a6a', '#f2efe6', '#e86a1e', '#7a2a8a'] },
  work: { kinds: ['shirt', 'singlet', 'trousers', 'trousers', 'towel', 'socks', 'jersey', 'shirt'], cols: ['#2a3a5a', '#3a5a8a', '#6a6a5a', '#2c2c2c', '#8a7a5a', '#e8e2d0', '#5a3a2a', '#3a4a3a', '#9a2a1e'] },
  kids: { kinds: ['baby', 'tee', 'shorts', 'socks', 'dress', 'baby', 'tee'], cols: ['#e86a8a', '#4ab0d8', '#f0c838', '#7ac04a', '#f08a3a', '#b07ad8', '#f2efe6'] },
};
type Pat = 'plain' | 'hstripe' | 'vstripe' | 'check' | 'dots' | 'floral' | 'twill' | 'knit';
/** parts of a garment's mask */
const BODY = 1, SLEEVE = 2, TRIM = 3, INSIDE = 4, SEAM = 5;

/**
 * One piece of washing pegged to the line, anchored on the line (ay = 2, so it hangs and swings in the
 * wind). Its kind, size, colour and pattern come from the seed; the silhouette is cut row by row
 * with a ragged hem, then shaded by the drape: vertical folds that deepen toward the hem, the sleeves
 * and the inside of the neck turned away from the light, a lit ridge on each fold.
 */
export function garment(style: WashStyle, seed: number, kind?: GarmentKind): Sprite {
  const rng = new Rng(seed * 7919 + 13);
  const st = WASH[style];
  const k: GarmentKind = kind ?? rng.pick(st.kinds);
  const W = 40, H = 40;
  const m = new Uint8Array(W * H);
  const cx = 20, top = 2;
  const set = (x: number, y: number, p: number) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = p; };
  const row = (y: number, x0: number, x1: number, p: number) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, p); };
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? m[y * W + x] : 0);
  const pegs: number[] = [];
  let pat: Pat = rng.pick(['plain', 'plain', 'hstripe', 'vstripe', 'check', 'dots'] as Pat[]);
  let col = rng.pick(st.cols), col2 = rng.pick(st.cols);
  if (col2 === col) col2 = '#f2efe6';
  let patch = rng.chance(0.18);
  const jit = () => (rng.chance(0.25) ? (rng.chance(0.5) ? -1 : 1) : 0);
  switch (k) {
    case 'shirt': case 'tee': case 'jersey': case 'baby': {
      const small = k === 'baby';
      const hw = small ? rng.int(4, 5) : rng.int(6, 8), L = small ? rng.int(11, 13) : rng.int(16, 21);
      const long = k === 'jersey' || (k === 'shirt' && rng.chance(0.5));
      for (let y = top; y < top + L; y++) {
        const t = y - top, w = hw - (t === 0 ? 1 : 0) + (t > L - 3 ? jit() * 0 : 0);
        let x0 = cx - w, x1 = cx + w;
        if (t === L - 1 && k === 'shirt') { x0 += 2; x1 -= 2; }
        if (small && t > L - 5) { if (Math.abs(t - (L - 3)) < 3) row(y, cx - 1, cx + 1, 0); }
        row(y, x0, x1, BODY);
        if (small && t >= L - 4) set(cx, y, 0);
      }
      // the sleeves: short ones angle out and down from the shoulders, long ones hang beside the body
      for (const s of [-1, 1]) {
        if (long) {
          for (let t = 0; t < L - 2; t++) {
            const apart = t > L * 0.45 ? 1 : 0;
            const xa = cx + s * (hw + 1 + apart), xb = cx + s * (hw + 3 + apart + (t > L - 6 ? 1 : 0));
            row(top + t, Math.min(xa, xb), Math.max(xa, xb), t > L - 6 && k === 'jersey' ? TRIM : SLEEVE);
            if (!apart && t > 1) set(cx + s * (hw + 1), top + t, SEAM);
          }
        } else {
          const len = small ? 3 : rng.int(4, 5);
          for (let t = 0; t < (small ? 5 : 7); t++) {
            const out = Math.min(len, t + 1), inT = Math.max(0, t - 3);
            row(top + t, s < 0 ? cx - hw - out : cx + hw + 1 + inT, s < 0 ? cx - hw - 1 - inT : cx + hw + out, SLEEVE);
          }
        }
      }
      // the neck: a collar and button band on a shirt, a round neck on a tee or a jersey
      if (k === 'shirt') {
        row(top, cx - 1, cx + 1, INSIDE); row(top + 1, cx - 3, cx - 1, TRIM); row(top + 1, cx + 1, cx + 3, TRIM); set(cx, top + 1, INSIDE); set(cx - 2, top + 2, TRIM); set(cx + 2, top + 2, TRIM);
        for (let y = top + 2; y < top + L - 1; y++) set(cx, y, SEAM);
        if (rng.chance(0.7)) for (let y = top + 4; y < top + 7; y++) { set(cx - hw + 2, y, SEAM); set(cx - hw + 5, y, SEAM); }
      } else {
        row(top, cx - 2, cx + 2, INSIDE); row(top + 1, cx - 1, cx + 1, INSIDE);
        if (k === 'jersey') { for (let y = top + L - 3; y < top + L; y++) row(y, cx - hw, cx + hw, TRIM); row(top, cx - 3, cx - 3, TRIM); row(top, cx + 3, cx + 3, TRIM); }
      }
      if (k === 'jersey') { pat = rng.chance(0.6) ? 'knit' : 'hstripe'; patch = rng.chance(0.35); }
      if (small) { pat = rng.pick(['plain', 'dots', 'hstripe'] as Pat[]); patch = false; }
      pegs.push(cx - hw + 1, cx + hw - 1);
      break;
    }
    case 'singlet': {
      const hw = rng.int(5, 7), L = rng.int(17, 20);
      col = rng.chance(0.55) ? '#24242a' : rng.pick(['#e8e2d0', '#2c5a96']);
      pat = 'plain';
      for (let t = 0; t < L; t++) {
        const y = top + t;
        if (t < 4) { row(y, cx - hw + 1, cx - hw + 2, BODY); row(y, cx + hw - 2, cx + hw - 1, BODY); }
        else { const arm = Math.max(0, 7 - t); row(y, cx - hw + (t < 7 ? 0 : 0) + (arm > 2 ? 0 : 0), cx + hw, BODY); if (arm > 0) { row(y, cx - hw, cx - hw + Math.min(arm, 2) - 1, 0); row(y, cx + hw - Math.min(arm, 2) + 1, cx + hw, 0); } }
      }
      for (let t = 4; t < 7; t++) row(top + t, cx - 2 + (t - 4), cx + 2 - (t - 4), INSIDE);
      pegs.push(cx - hw + 1, cx + hw - 1);
      break;
    }
    case 'trousers': case 'shorts': {
      const hw = rng.int(6, 7), L = k === 'shorts' ? rng.int(10, 12) : rng.int(23, 27);
      if (style === 'work' || rng.chance(0.4)) { col = rng.pick(['#2a3e64', '#34507a', '#6a644a', '#2c2c2c', '#5a5a5e']); pat = col === '#2a3e64' || col === '#34507a' ? 'twill' : 'plain'; }
      const split = top + 7;
      for (let y = top; y < top + L; y++) {
        const t = y - top;
        if (y < split) { row(y, cx - hw, cx + hw, t < 2 ? TRIM : BODY); continue; }
        const gap = Math.min(2, Math.floor((y - split) / 3)), taper = Math.floor((y - split) / 12);
        row(y, cx - hw + taper + (t === L - 1 ? jit() : 0), cx - gap - 0, y >= top + L - 2 && k === 'trousers' && pat !== 'twill' ? TRIM : BODY);
        row(y, cx + gap + 0, cx + hw - taper, y >= top + L - 2 && k === 'trousers' && pat !== 'twill' ? TRIM : BODY);
        if (gap === 0) set(cx, y, SEAM);
      }
      for (let y = top + 2; y < split; y++) set(cx, y, SEAM);
      for (let i = 0; i < 3; i++) { set(cx - hw + 2 + i, top + 2 + i, SEAM); set(cx + hw - 2 - i, top + 2 + i, SEAM); }
      for (const bx of [cx - hw + 1, cx - 3, cx + 3, cx + hw - 1]) set(bx, top + 1, SEAM);
      pegs.push(cx - hw + 1, cx + hw - 1);
      break;
    }
    case 'dress': {
      const L = rng.int(22, 27), bw = rng.int(4, 5), hem = rng.int(9, 11), waist = top + rng.int(8, 9);
      const sleeves = rng.chance(0.5);
      for (let y = top; y < top + L; y++) {
        const t = y - top;
        if (y < waist) {
          if (t < 2 && !sleeves) { row(y, cx - bw, cx - bw + 1, BODY); row(y, cx + bw - 1, cx + bw, BODY); continue; }
          row(y, cx - bw - (t === 2 ? 1 : 0), cx + bw + (t === 2 ? 1 : 0), BODY);
        } else {
          const f = (y - waist) / (top + L - waist);
          const w = bw + Math.round((hem - bw) * Math.pow(f, 0.8)) + (y === top + L - 1 ? jit() : 0);
          const wave = y === top + L - 1 ? 0 : 0;
          row(y + wave, cx - w, cx + w, BODY);
        }
      }
      if (sleeves) for (const s of [-1, 1]) for (let t = 0; t < 4; t++) row(top + t, s < 0 ? cx - bw - 2 - Math.min(t, 1) : cx + bw + 1, s < 0 ? cx - bw - 1 : cx + bw + 2 + Math.min(t, 1), SLEEVE);
      row(top, cx - 1, cx + 1, INSIDE);
      row(waist, cx - bw, cx + bw, TRIM);
      // a ragged, wavy hem
      const yb = top + L - 1;
      for (let x = cx - hem - 1; x <= cx + hem + 1; x++) if (at(x, yb) && Math.sin(x * 1.3 + seed) > 0.4) set(x, yb, 0);
      pat = rng.pick(['floral', 'floral', 'dots', 'plain', 'check'] as Pat[]);
      pegs.push(cx - bw, cx + bw);
      break;
    }
    case 'sheet': case 'towel': case 'wrap': {
      const hw = k === 'towel' ? rng.int(6, 8) : k === 'wrap' ? rng.int(9, 12) : rng.int(12, 15);
      const L = k === 'towel' ? rng.int(16, 22) : k === 'wrap' ? rng.int(20, 26) : rng.int(22, 30);
      const sag = k === 'towel' ? 1 : 2;
      for (let x = cx - hw; x <= cx + hw; x++) {
        const u = (x - cx) / hw;
        const y0 = top + Math.round((1 - u * u) * sag * 0.6);
        const y1 = top + L - 1 - Math.round(Math.sin((x + seed) * 0.5) * 0.8 + (1 - Math.abs(u)) * sag * 0.5 - (Math.abs(u) > 0.85 ? 1 : 0));
        for (let y = y0; y <= y1; y++) set(x, y, y < y0 + 2 ? TRIM : BODY);
      }
      if (k === 'towel') { pat = rng.chance(0.6) ? 'hstripe' : 'plain'; if (rng.chance(0.5)) for (let x = cx - hw; x <= cx + hw; x += 2) { let y = H - 1; while (y > 0 && !at(x, y)) y--; set(x, y + 1, BODY); } }
      else if (k === 'wrap') { pat = rng.chance(0.75) ? 'floral' : 'vstripe'; col = rng.pick(WASH.pacific.cols.slice(0, 5)); col2 = rng.chance(0.6) ? '#f2efe6' : '#e8b81e'; if (col2 === col) col2 = '#f2efe6'; }
      else { col = rng.pick(['#f2efe6', '#e8e2d0', '#d8e4ee', '#efe2c4']); col2 = rng.pick(['#4a8ab8', '#d86a8a', '#7ab060', '#d8a030']); pat = rng.pick(['plain', 'plain', 'floral', 'hstripe'] as Pat[]); }
      pegs.push(cx - hw + 1, cx + hw - 1);
      if (hw > 9) pegs.push(cx);
      patch = patch && k === 'sheet';
      break;
    }
    case 'socks': {
      col = rng.pick(['#c8c8c0', '#e8e2d0', '#4a4a50', '#9a2a1e', '#2c5a96']);
      col2 = col === '#e8e2d0' ? '#9a2a1e' : '#e8e2d0';
      const L = rng.int(9, 11);
      for (const s of [-4, 3]) {
        for (let t = 0; t < L; t++) row(top + t, cx + s, cx + s + 2, t < 2 ? TRIM : BODY);
        // the heel bulges out, the toe turns
        set(cx + s + 3, top + L - 4, BODY); set(cx + s + 3, top + L - 3, BODY);
        row(top + L, cx + s, cx + s + 3, TRIM); row(top + L + 1, cx + s + 1, cx + s + 3, TRIM);
        pegs.push(cx + s + 1);
      }
      pat = 'plain';
      patch = false;
      break;
    }
  }
  // ------------------------------------------------------ paint the cloth
  const rp = ramp6(col, 0.62), rp2 = ramp6(col2, 0.62);
  const ph = rng.range(0, 6), fq = rng.range(0.7, 1.1), sp = rng.int(3, 4), so = rng.int(0, 3);
  const pp = rng.int(0, 5);
  const b = new PixelBuffer(W, H);
  let minX = W, maxX = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const span = Math.max(1, maxX - minX);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = m[y * W + x];
    if (!p) continue;
    const t = (y - top) / 26;
    // the drape: folds running down from the pegs, deeper toward the hem; the light from the left
    const fold = (Math.sin(x * fq + ph) * 0.65 + Math.sin(x * 0.37 + ph * 2) * 0.35) * (0.35 + t * 0.9);
    let v = 3.3 - ((x - minX) / span) * 1.1 + fold - (y < top + 2 ? 0.5 : 0);
    if (p === SLEEVE) v -= 0.55;
    if (p === TRIM) v -= 0.35;
    if (p === SEAM) v -= 1.1;
    if (p === INSIDE) { b.set(x, y, rp[0]); continue; }
    // edges: the lit side catches a rim, the far side rolls into shadow
    if (!at(x + 1, y) || !at(x, y + 1)) v -= 0.7;
    else if (!at(x - 1, y)) v += 0.5;
    let r = rp;
    switch (pat) {
      case 'hstripe': if (((y + so) % (sp + 2)) < 2) r = rp2; break;
      case 'vstripe': if (((x + so) % (sp + 1)) < 1) r = rp2; break;
      case 'check': { const a = (x + so) % 4 < 2, c = (y + so) % 4 < 2; if (a && c) v -= 1.1; else if (a !== c) r = rp2; break; }
      case 'dots': if ((x + (Math.floor(y / 3) % 2) * 2 + so) % 4 === 0 && (y + so) % 3 === 0) { r = rp2; v += 1; } break;
      case 'twill': if ((x + y + so) % 3 === 0) v -= 0.6; if (Math.abs(t - 0.55) < 0.12 && h01(x, y, seed) < 0.6) v += 0.9; break;
      case 'knit': if (y % 2 === 0 && x % 2 === 0) v += 0.6; if (y % 2 === 1 && x % 2 === 1) v -= 0.5; break;
    }
    b.set(x, y, dpick(r, v, x, y));
    // a lit ridge where a fold faces the light
    if (Math.cos(x * fq + ph) > 0.93 && y > top + 2 && h01(x, y, seed + 3) < 0.45 && p === BODY) b.set(x, y, r[5]);
  }
  // floral prints: little five-petal flowers and a leaf, hand-placed on a jittered grid
  if (pat === 'floral') {
    const pr = new Rng(seed + 99), leafC = col === '#2a8a6a' ? hex('#e8b81e') : hex('#3a7a3a');
    for (let gy = top + 2 + pr.int(0, 2); gy < H - 2; gy += pr.int(5, 7)) for (let gx = minX + pr.int(0, 3); gx <= maxX; gx += pr.int(5, 8)) {
      if (!at(gx, gy)) continue;
      const big = k === 'wrap' && pr.chance(0.4);
      const pc = rp2[pr.int(4, 5)], pd = rp2[3];
      const petal = big ? [[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2], [0, -1], [-1, 0], [1, 0], [0, 1]] : [[0, -1], [-1, 0], [1, 0], [0, 1]];
      for (const [dx, dy] of petal) if (at(gx + dx, gy + dy)) b.set(gx + dx, gy + dy, (dx + dy) % 2 ? pc : pd);
      if (big) { b.set(gx - 2, gy - 2, pd); b.set(gx + 2, gy + 2, pd); }
      b.set(gx, gy, big ? hex('#c8281e') : hex('#f0c040'));
      if (at(gx + 2, gy + 2) && pr.chance(0.6)) { b.set(gx + 2, gy + 2, leafC); b.set(gx + 3, gy + 2, shade(leafC, -0.3)); }
    }
  }
  // a patch sewn over a worn spot, with its running stitches
  if (patch) {
    const px0 = minX + rng.int(2, Math.max(2, span - 6)), py0 = top + rng.int(5, 12), pw = rng.int(3, 5), phh = rng.int(3, 4);
    const pc = ramp6(rng.pick(['#8a5a3a', '#4a6a8a', '#c8a050', '#7a3a3a']), 0.5);
    let ok = true;
    for (let y = py0 - 1; y <= py0 + phh; y++) for (let x = px0 - 1; x <= px0 + pw; x++) if (!at(x, y)) ok = false;
    if (ok) {
      for (let y = py0; y < py0 + phh; y++) for (let x = px0; x < px0 + pw; x++) b.set(x, y, dpick(pc, 3.2 - (x - px0) * 0.3, x, y));
      for (let x = px0 - 1; x <= px0 + pw; x += 2) { b.set(x, py0 - 1, pc[5]); b.set(x + 1, py0 + phh, pc[5]); }
    }
  }
  // the pegs: split wooden ones, or bright plastic ones
  const plastic = rng.chance(0.4);
  for (const px of pegs) {
    const pc = plastic ? ramp6(rng.pick(['#d83a2a', '#3a7ad8', '#e8c030', '#4ab04a']), 0.5) : [VP.wood[3], VP.wood[4], VP.wood[5], hex('#d8a868'), hex('#e8c088'), hex('#f0d8a8')];
    for (let y = 0; y < 4; y++) { b.set(px, y, pc[y === 0 ? 4 : 3]); b.set(px + 1, y, pc[y === 0 ? 2 : 1]); }
    b.set(px, 4, pc[2]);
  }
  return S(b, cx, top);
}

// ------------------------------------------------------------------ the line
export interface LineSpec { w: number; hL: number; hR: number; sag: number; posts: [boolean, boolean]; prop?: number; seed: number }
/** the height of the line above the ground at x along it */
export function lineHeight(s: LineSpec, x: number): number {
  if (s.prop !== undefined) {
    const hp = Math.max(s.hL, s.hR) + 3;
    if (x <= s.prop) { const t = x / s.prop; return s.hL + (hp - s.hL) * t - s.sag * 0.6 * Math.sin(Math.PI * t); }
    const t = (x - s.prop) / (s.w - s.prop);
    return hp + (s.hR - hp) * t - s.sag * 0.6 * Math.sin(Math.PI * t);
  }
  const t = x / s.w;
  return s.hL + (s.hR - s.hL) * t - s.sag * Math.sin(Math.PI * t);
}
/** a washing line: weathered T-posts (or nothing at an end tied to a house), a forked prop pole, the twisted line */
export function washLine(s: LineSpec): Sprite {
  const H = Math.max(s.hL, s.hR) + 12, W = s.w + 8, base = H - 1, ox = 4;
  const b = new PixelBuffer(W, H), rng = new Rng(s.seed);
  const post = (x: number, h: number, dir: number) => {
    const lean = rng.int(-1, 1);
    for (let y = 0; y <= h + 2; y++) {
      const X = x + (y > h * 0.6 ? lean : 0), Y = base - y;
      for (let k = 0; k < 3; k++) b.set(X + k, Y, dpick(VP.grey, 3.8 - k * 0.9 + (Math.sin(y * 0.7 + x) > 0.8 ? -1 : 0), X + k, Y));
      if (h01(x, y, s.seed) < 0.06) b.set(X + 1, Y, VP.grey[1]);
    }
    // the crossbar, lashed on
    const cy = base - h - 1, X = x + lean;
    for (let i = -4; i <= 6; i++) { b.set(X + i, cy, dpick(VP.grey, 4 - (i + 4) * 0.12, X + i, cy)); b.set(X + i, cy + 1, VP.grey[2]); }
    b.set(X, cy - 1, VP.thatch[2]); b.set(X + 2, cy + 2, VP.thatch[2]); b.set(X + 1, cy + 2, VP.thatch[3]);
    void dir;
  };
  if (s.posts[0]) post(ox - 1, s.hL, 1);
  if (s.posts[1]) post(ox + s.w - 2, s.hR, -1);
  if (s.prop !== undefined) {
    // a mānuka prop pole leaning a little, forked at the top where the line sits in it
    const hp = Math.max(s.hL, s.hR) + 3, px = ox + s.prop;
    for (let y = 0; y < hp; y++) { const X = px - 2 + Math.round(y / hp * 2); b.set(X, base - y, dpick(VP.bark, 3.6, X, base - y)); b.set(X + 1, base - y, VP.bark[2]); }
    b.set(px - 1, base - hp - 1, VP.bark[4]); b.set(px - 2, base - hp - 2, VP.bark[4]); b.set(px + 1, base - hp - 1, VP.bark[3]); b.set(px + 2, base - hp - 2, VP.bark[3]);
  }
  // the line: a twisted cord, two tones along the twist, a knot at each end
  for (let x = 0; x <= s.w; x++) {
    const y = base - Math.round(lineHeight(s, x));
    b.set(ox + x, y, (x % 3 === 0) ? QP.rope[2] : QP.rope[4]);
  }
  for (const e of [0, s.w]) { const y = base - Math.round(lineHeight(s, e)); b.set(ox + e, y + 1, QP.rope[2]); b.set(ox + e + (e ? -1 : 1), y + 1, QP.rope[3]); b.set(ox + e, y + 2, QP.rope[1]); }
  return S(b, ox, base);
}

// ------------------------------------------------------------------ produce
export type ProduceKind = 'orange' | 'apple' | 'cabbage' | 'kumara' | 'potato' | 'onion' | 'banana' | 'carrot' | 'bokchoy' | 'pawpaw' | 'coconut' | 'taro' | 'lemon' | 'greens';
const PR: Record<string, C[]> = {
  orange: R('#5a1a04', '#8e3606', '#c45a0c', '#e8801a', '#f8a838', '#ffd27a'),
  lemon: R('#5a4a04', '#8e7806', '#c4a80c', '#e8cc1a', '#f8e448', '#fff4a0'),
  apple: R('#3a0606', '#640e0a', '#941c12', '#c0301c', '#de5a34', '#f49a68'),
  cabbage: R('#14281e', '#244634', '#36664a', '#4e8660', '#74a87e', '#a8cca2'),
  kumara: R('#260a14', '#44142a', '#66203c', '#8a3450', '#a84e64', '#c47884'),
  potato: R('#3a2814', '#5a4024', '#7a5a36', '#9a784a', '#b89664', '#d4b686'),
  onion: R('#3a1c06', '#62320c', '#8a4e16', '#b06e24', '#d09040', '#ecc078'),
  banana: R('#3a3206', '#62540c', '#8e7c14', '#bca42a', '#dcc840', '#f4e47a'),
  carrot: R('#4a1404', '#7a2606', '#ae400c', '#d65c16', '#f07e2a', '#ffaa5a'),
  pawpaw: R('#3a2a06', '#6a4a0c', '#9a6e14', '#c8941e', '#e8b432', '#fad466'),
  coconut: R('#1e1006', '#341e0e', '#4e3018', '#6a4424', '#8a5c34', '#aa7a4a'),
  green: R('#0e2210', '#183a18', '#265a22', '#387a2c', '#56a03a', '#88c454'),
};
/** one piece of fruit or veg with its bottom-centre at (x, y): hand-shaped, lit from the upper left */
export function produce(b: PixelBuffer, kind: ProduceKind, x: number, y: number, rng: Rng) {
  const blob = (rx: number, ry: number, rp: C[], lump = 0.18) => {
    const s = rng.int(0, 999), cy = y - ry;
    b.ellipseFn(x, cy, rx + 0.5, ry + 0.5, (X, Y, nx, ny) => {
      const d = Math.hypot(nx, ny) + (noise1(Math.atan2(ny, nx) * 2 + s, s) - 0.5) * lump * 2;
      if (d > 1) return -1;
      return dpick(rp, 3.2 - nx * 1.3 - ny * 1.5 + (d > 0.8 ? -0.6 : 0), X, Y);
    });
    return cy;
  };
  switch (kind) {
    case 'orange': case 'lemon': case 'apple': {
      const r = rng.range(1.8, 2.4), rp = PR[kind];
      const cy = blob(r, kind === 'lemon' ? r * 0.85 : r, rp, 0.08);
      b.set(x - 1, Math.round(cy - r * 0.4), rp[5]);
      if (kind === 'apple') b.set(x, Math.round(cy - r - 0.5), VP.wood[2]);
      else b.set(x, Math.round(cy - r), PR.green[2]);
      break;
    }
    case 'cabbage': case 'greens': {
      const r = kind === 'greens' ? rng.range(2.4, 3.2) : rng.range(3, 4.2), rp = kind === 'greens' ? PR.green : PR.cabbage;
      const cy = blob(r, r * 0.85, rp, 0.16);
      // the head's veins, paler, curving out from the base
      for (let i = -1; i <= 1; i++) for (let t = 0; t < r * 1.4; t++) b.paint(Math.round(x + i * t * 0.55), Math.round(y - 1 - t * 0.8), rp[4]);
      // outer leaves flaring at the sides
      for (const s of [-1, 1]) { b.set(Math.round(x + s * (r + 1)), y - 1, rp[1]); b.set(Math.round(x + s * (r + 1)), y - 2, rp[2]); b.set(Math.round(x + s * r), Math.round(cy), rp[3]); }
      b.set(Math.round(x - r * 0.4), Math.round(cy - r * 0.5), rp[5]);
      break;
    }
    case 'kumara': case 'potato': case 'taro': {
      const rp = kind === 'kumara' ? PR.kumara : kind === 'taro' ? PR.coconut : PR.potato;
      const rx = kind === 'kumara' ? rng.range(3, 4) : rng.range(2, 2.8), ry = kind === 'kumara' ? 1.6 : rng.range(1.6, 2.2);
      const cy = blob(rx, ry, rp, 0.3);
      if (kind === 'kumara') { b.set(Math.round(x + rx + 1), Math.round(cy), rp[1]); b.set(Math.round(x - rx - 1), Math.round(cy + 1), rp[1]); }
      if (kind === 'potato') { b.set(x + 1, Math.round(cy), rp[1]); b.set(x - 1, Math.round(cy + 1), rp[1]); }
      if (kind === 'taro') for (let i = -1; i <= 1; i++) b.set(x + i * 2, Math.round(cy) + (i & 1), rp[0]);
      b.set(Math.round(x - rx * 0.4), Math.round(cy - ry * 0.5), rp[5]);
      break;
    }
    case 'onion': {
      const r = rng.range(1.8, 2.3);
      const cy = blob(r, r, PR.onion, 0.06);
      b.set(x, Math.round(cy - r - 1), PR.onion[2]); b.set(x + 1, Math.round(cy - r - 2), PR.onion[3]);
      b.set(x - 1, Math.round(cy - 1), PR.onion[5]);
      break;
    }
    case 'carrot': {
      for (let t = 0; t < 7; t++) { const w = t < 2 ? 1 : t < 5 ? 1 : 0; for (let k = -w; k <= w; k++) b.set(x + k + Math.round(t * 0.3), y - 1 - t * 0 - (6 - t), dpick(PR.carrot, 3.6 - k - t * 0.15, x + k, y - t)); }
      for (let i = 0; i < 3; i++) b.set(x - 1 + i, y - 8 - (i === 1 ? 1 : 0), PR.green[3 + (i & 1)]);
      break;
    }
    case 'banana': {
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) for (let t = 0; t < 8; t++) {
        const X = x - 3 + t, Y = y - 1 - i - Math.round(Math.sin(t / 7 * Math.PI) * 2) + (i > 2 ? 0 : 0);
        b.set(X, Y, dpick(PR.banana, 3.4 - i * 0.4 + (t > 6 ? -1 : 0), X, Y));
      }
      b.set(x - 4, y - 2, VP.wood[2]); b.set(x + 5, y - 2 - n, PR.banana[0]);
      break;
    }
    case 'bokchoy': {
      for (let i = -1; i <= 1; i++) for (let t = 0; t < 7; t++) { const X = x + i + Math.round(i * t * 0.25); b.set(X, y - 1 - t, t < 3 ? hex(t ? '#e4ecd8' : '#c8d4bc') : dpick(PR.green, 3 - i * 0.5 + (t > 5 ? 0.6 : 0), X, y - 1 - t)); }
      b.set(x - 2, y - 7, PR.green[2]); b.set(x + 2, y - 7, PR.green[4]); b.set(x, y - 8, PR.green[5]);
      break;
    }
    case 'pawpaw': {
      b.ellipseFn(x, y - 4, 2.3, 4, (X, Y, nx, ny) => dpick(PR.pawpaw, 3.4 - nx * 1.2 - ny * 0.6 + (ny < -0.5 ? -1.2 : 0), X, Y));
      b.set(x - 1, y - 6, PR.pawpaw[5]); b.set(x, y - 8, PR.green[2]);
      break;
    }
    case 'coconut': {
      const green = rng.chance(0.4), rp = green ? PR.green : PR.coconut;
      const cy = blob(3, 2.8, rp, 0.12);
      if (!green) for (let i = 0; i < 4; i++) b.set(x - 2 + rng.int(0, 4), Math.round(cy) + rng.int(-2, 2), rp[1]);
      b.set(x - 1, Math.round(cy - 1), rp[5]);
      break;
    }
  }
}

// ------------------------------------------------------------------ crates
/**
 * A fruit crate built board by board: slats with gaps you can see the fruit through, end battens,
 * the grain, a nail at each slat end, a stencilled mark, a chipped corner; heaped with produce.
 */
export function crate(w: number, h: number, seed: number, fill?: ProduceKind | null): Sprite {
  const rng = new Rng(seed * 31 + 5);
  const heap = fill ? 6 : 0;
  const b = new PixelBuffer(w + 2, h + heap + 2), base = h + heap, x0 = 1, y0 = heap + 1;
  const wood = rng.chance(0.3) ? VP.grey : rng.chance(0.5) ? R('#3a2410', '#5c3c1c', '#80562a', '#a4743c', '#c49458', '#dcb67c') : VP.wood;
  // the produce heaped in it, behind the front boards
  if (fill) {
    const n = Math.round(w / 3.2);
    for (let row2 = 0; row2 < 2; row2++) for (let i = 0; i < n; i++) {
      const px = x0 + 2 + Math.round((i + rng.next() * 0.6) * (w - 4) / n), py = y0 + 3 - row2 * 2 - Math.round(Math.sin((px - x0) / w * Math.PI) * (row2 ? 2 : 1));
      produce(b, fill, px, py, rng);
    }
  }
  const slatH = Math.max(3, Math.round(h / 3.4));
  for (let y = y0; y <= base; y++) {
    const sl = Math.floor((y - y0) / slatH), inSlat = (y - y0) % slatH;
    const gap = inSlat === slatH - 1 && y < base - 1;
    const tone = 3 + (h01(sl, 0, seed) - 0.5) * 0.9;
    for (let x = x0; x < x0 + w; x++) {
      if (gap && x > x0 + 2 && x < x0 + w - 3) { if (!b.opaque(x, y)) b.set(x, y, hex('#1a100a')); continue; }
      const batten = x < x0 + 2 || x >= x0 + w - 2;
      const grain = noise1(x * 0.4 + sl * 7, seed) - 0.5;
      let v = batten ? (x < x0 + 1 ? 4.6 : x >= x0 + w - 1 ? 1.8 : 3.4) : tone + grain * 1.3 - (x - x0) / w * 1 + (inSlat === 0 ? 0.8 : 0);
      if (y === base) v = 1.2;
      b.set(x, y, dpick(wood, v, x, y));
    }
    if (inSlat === 1) { b.set(x0 + 1, y, VP.iron[4]); b.set(x0 + w - 2, y, VP.iron[2]); }
  }
  // a stencil on the middle board, worn
  if (w >= 16 && rng.chance(0.6)) letters(b, x0 + Math.round(w / 2) - 4, y0 + slatH, rng.pick(['NZ', 'NO 2', 'A1', 'XX', 'LB']), 3, { col: [shade(wood[4], 0.35), wood[5]], wear: 0.3, seed });
  // wear: a chipped top corner, a split
  b.set(x0 + w - 1, y0, 0); b.set(x0, y0, 0);
  if (rng.chance(0.5)) { const sx = x0 + rng.int(4, w - 5); b.set(sx, y0 + 1, wood[1]); b.set(sx + 1, y0 + 2, wood[1]); }
  return S(b, Math.floor((w + 2) / 2), base);
}
/** a stack of crates, uneven: odd sizes, the upper ones shoved off-centre, one leaning */
export function crateStack(seed: number, fills: (ProduceKind | null)[] = []): Sprite {
  const rng = new Rng(seed * 13 + 1);
  const W = 64, H = 56, b = new PixelBuffer(W, H), base = H - 1;
  const nb = rng.int(1, 2), nt = rng.int(nb === 1 ? 0 : 1, nb === 1 ? 1 : 2);
  const put = (c: Sprite, x: number, y: number, lean = 0) => {
    for (let j = 0; j < c.buf.h; j++) for (let i = 0; i < c.buf.w; i++) {
      const col = c.buf.data[j * c.buf.w + i];
      if (!(col >>> 24)) continue;
      const sh = lean ? Math.round((c.buf.h - j) * lean / c.buf.h) : 0;
      b.set(x - c.ax + i + sh, y - c.ay + j, col);
    }
  };
  let x = 32 - nb * 11;
  const tops: number[] = [];
  for (let i = 0; i < nb; i++) {
    const w = rng.int(18, 22), h = rng.int(11, 14);
    const fl = nt === 0 ? fills[i % Math.max(1, fills.length)] ?? null : null;
    const c = crate(w, h, seed * 7 + i, fl);
    put(c, x + w / 2, base);
    tops.push(x + w / 2);
    x += w + rng.int(0, 2);
  }
  let y1 = base - 13;
  for (let i = 0; i < nt; i++) {
    const w = rng.int(16, 20), h = rng.int(10, 13);
    const c = crate(w, h, seed * 7 + 10 + i, fills[(i + 1) % Math.max(1, fills.length)] ?? null);
    const cx = tops[i % tops.length] + rng.int(-4, 4) + (nb === 1 ? 0 : 3);
    put(c, cx, y1 + 1, i === nt - 1 && rng.chance(0.5) ? rng.pick([-2, 2]) : 0);
  }
  const t = b.trim(0);
  return { buf: t.buf, ax: 32 - t.ox, ay: base - t.oy };
}

// ------------------------------------------------------------------ barrels
/** a stave barrel: a bulge, staves with seams, iron hoops lit and rusting, the lid's rim, a dent */
export function barrel(w: number, h: number, seed: number, wood: C[] = VP.wood): Sprite {
  const b = new PixelBuffer(w + 2, h + 2), base = h, cx = (w + 2) / 2, rng = new Rng(seed);
  const hoops = [2, Math.round(h * 0.3), Math.round(h * 0.7), h - 2];
  const staves = Math.max(4, Math.round(w / 3));
  for (let y = 1; y <= base; y++) {
    const t = (y - 1) / (h - 1), hw = w / 2 * (0.84 + Math.sin(t * Math.PI) * 0.16);
    for (let x = 0; x < w + 2; x++) {
      const nx = (x + 0.5 - cx) / hw;
      if (Math.abs(nx) > 1) continue;
      const su = (Math.asin(clamp(nx, -1, 1)) / Math.PI + 0.5) * staves, sv = Math.floor(su);
      let v = 3.3 - nx * 1.6 + (h01(sv, 0, seed) - 0.5) * 0.8 - Math.abs(nx) ** 3 * 0.8;
      if (su - sv < 0.14 && Math.abs(nx) < 0.92) v -= 1.4;
      let c = dpick(wood, v, x, y);
      if (hoops.some(hy => Math.abs(y - hy) < 1)) { c = dpick(VP.iron, v + 0.4, x, y); if (h01(x, y, seed + 1) < 0.25) c = VP.rust[3]; }
      else if (hoops.some(hy => y - hy === 1)) c = dpick(wood, v - 1.1, x, y);
      if (y === base) c = wood[1];
      b.set(x, y, c);
    }
  }
  // the lid's rim, a rust run under a hoop, a dent
  for (let x = Math.round(cx - w * 0.38); x < cx + w * 0.38; x++) b.set(x, 1, x < cx ? wood[5] : wood[3]);
  const dx = Math.round(cx + w * 0.2), dy = Math.round(h * 0.5);
  b.set(dx, dy, wood[1]); b.set(dx, dy + 1, wood[4]);
  if (rng.chance(0.6)) for (let y = hoops[1] + 1; y < hoops[1] + 4; y++) b.set(Math.round(cx - w * 0.1), y, VP.rust[2]);
  return S(b, Math.round(cx), base);
}
/** barrels together: one or three, one lying on its side, a plank or a bucket on a lid */
export function barrelGroup(seed: number): Sprite {
  const rng = new Rng(seed * 3 + 7);
  const W = 64, H = 40, b = new PixelBuffer(W, H), base = H - 1;
  const n = rng.int(1, 3);
  let x = n === 1 ? 26 : 12;
  for (let i = 0; i < n; i++) {
    const w = rng.int(14, 17), h = rng.int(20, 25);
    const lying = n > 1 && i === n - 1 && rng.chance(0.5);
    const c = barrel(w, h, seed * 5 + i);
    if (lying) {
      // on its side: rotate the barrel a quarter turn, chocked with a stone
      for (let j = 0; j < c.buf.h; j++) for (let k = 0; k < c.buf.w; k++) { const col = c.buf.data[j * c.buf.w + k]; if (col >>> 24) b.set(x + (c.buf.h - 1 - j), base - c.buf.w + 1 + k, col); }
      b.set(x + 2, base, VP.stone[3]); b.set(x + 3, base, VP.stone[4]); b.set(x + 2, base - 1, VP.stone[4]);
      x += c.buf.h + 1;
    } else {
      b.blit(c.buf, x, base - c.ay, false, false);
      if (rng.chance(0.4)) { const pw = w + 6; for (let k = 0; k < pw; k++) { b.set(x - 3 + k, base - c.ay - 1, VP.grey[k % 7 === 0 ? 2 : 4]); b.set(x - 3 + k, base - c.ay, VP.grey[2]); } }
      x += c.buf.w - 1 + rng.int(0, 2);
    }
  }
  const t = b.trim(0);
  return { buf: t.buf, ax: Math.round(t.buf.w / 2), ay: base - t.oy };
}

// ------------------------------------------------------------------ small things on the ground
/** a bucket: galvanised with water in it, wooden, or an enamel basin, maybe with a scrubbing brush */
export function bucket(seed: number): Sprite {
  const rng = new Rng(seed * 17 + 3);
  const kind = rng.int(0, 2);
  const b = new PixelBuffer(18, 18), base = 16, cx = 9;
  if (kind === 2) {
    // an enamel basin: white, a blue rim, chipped black where it's been knocked
    for (let y = 0; y < 5; y++) { const hw = 7 - Math.floor(y / 2); for (let x = -hw; x <= hw; x++) b.set(cx + x, base - y, dpick(QP.paint, 4.6 - (x + hw) / (2 * hw) * 1.8 - y * 0.1, cx + x, base - y)); }
    for (let x = -8; x <= 8; x++) { b.set(cx + x, base - 5, x < 0 ? hex('#2a5a9a') : hex('#1e3e6a')); }
    for (let x = -6; x <= 6; x++) b.set(cx + x, base - 6, x % 3 ? QP.sky[3] : QP.sky[4]);
    b.set(cx + 4, base - 2, hex('#141414')); b.set(cx - 5, base - 5, hex('#141414'));
  } else {
    const rp = kind === 0 ? QP.galv : VP.wood;
    for (let y = 0; y < 11; y++) {
      const hw = 4 + Math.round(y * 0.25);
      for (let x = -hw; x <= hw; x++) {
        let v = 3.4 - (x + hw) / (2 * hw) * 2 + (kind === 0 && (y === 2 || y === 8) ? 0.9 : 0);
        if (kind === 1 && (x + hw) % 3 === 0) v -= 1;
        if (kind === 1 && (y === 2 || y === 8)) { b.set(cx + x, base - y, dpick(VP.iron, v, cx + x, base - y)); continue; }
        b.set(cx + x, base - y, dpick(rp, v, cx + x, base - y));
      }
    }
    // the rim and what's inside: water catching the sky, or nothing
    for (let x = -6; x <= 6; x++) b.set(cx + x, base - 11, rp[4]);
    if (rng.chance(0.6)) for (let x = -5; x <= 5; x++) b.set(cx + x, base - 12, x % 4 === 0 ? QP.sky[5] : QP.sky[3]);
    // the wire handle, lying back
    for (let a = 0; a <= 12; a++) { const t = a / 12 * Math.PI; b.set(Math.round(cx - Math.cos(t) * 6), Math.round(base - 12 - Math.sin(t) * 3), VP.iron[3]); }
    if (rng.chance(0.4)) { for (let i = 0; i < 4; i++) b.set(cx + 3 + i, base - 13 - i, VP.wood[3]); b.set(cx + 7, base - 17, VP.wood[4]); }
  }
  return S(b, cx, base);
}
/** a coil of rope, the loops stacked, the twist on each strand, the end trailing off */
export function ropeCoil(seed: number): Sprite {
  const rng = new Rng(seed * 11 + 2);
  const b = new PixelBuffer(30, 14), base = 12, cx = 13;
  const n = rng.int(3, 4), rp = rng.chance(0.4) ? R('#0e1e24', '#183038', '#244a52', '#346670', '#4e8890', '#78aeb0') : R('#22180c', '#3a2c16', '#5a4624', '#7a6034', '#987a48', '#b49660');
  const loop = (i: number, front: boolean) => {
    const rx = 9 - i * 0.35, ry = 2.4, cy = base - 2 - i * 2;
    for (let a = 0; a < 90; a++) {
      const t = a / 90 * Math.PI * 2, X = Math.round(cx + Math.cos(t) * rx), Y = Math.round(cy + Math.sin(t) * ry);
      if ((Math.sin(t) > -0.15) !== front) continue;
      const twist = ((X + Y * 2) % 3) === 0;
      const v = (front ? 3.8 : 2) - Math.cos(t) * 0.7 - (twist ? 1.1 : 0);
      b.set(X, Y, pick(rp, v + 0.6)); b.set(X, Y + 1, pick(rp, v - 1));
    }
  };
  for (let i = 0; i < n; i++) loop(i, false);
  const hy = base - 2 - (n - 1) * 2;
  b.ellipseFn(cx, hy, 9 - (n - 1) * 0.35 - 2.5, 1.2, (X, Y) => (b.opaque(X, Y) ? -1 : rp[0]));
  for (let i = 0; i < n; i++) loop(i, true);
  // the loose end
  for (let x = cx + 9; x < cx + 16; x++) { const y = base - Math.round(Math.max(0, (cx + 12 - x) * 0.3)); b.set(x, y, rp[(x % 3) ? 3 : 2]); }
  return S(b, cx, base);
}
/** a heap under a patched tarp, roped down, a stone on one corner */
export function tarpHeap(seed: number, w = 40): Sprite {
  const rng = new Rng(seed * 19 + 4);
  const H = 26, b = new PixelBuffer(w + 6, H), base = H - 1, x0 = 3;
  const rp = rng.pick([QP.tarp, QP.canvas, QP.tarpGreen]);
  const prof: number[] = [];
  const bumps = [rng.range(0.24, 0.38), rng.range(0.6, 0.76)], bh = [rng.range(12, 17), rng.range(8, 13)], bw = [rng.range(0.26, 0.32), rng.range(0.22, 0.28)];
  for (let x = 0; x < w; x++) {
    const t = x / w;
    let hh = 2 + Math.sin(t * Math.PI) * 3;
    for (let i = 0; i < 2; i++) { const u = Math.min(1, Math.abs(t - bumps[i]) / bw[i]); hh = Math.max(hh, bh[i] * Math.pow(Math.cos(u * Math.PI / 2), 0.7)); }
    prof.push(Math.round(hh + (noise1(x * 0.3, seed) - 0.5) * 1.5));
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < prof[x]; y++) {
    const X = x0 + x, Y = base - y;
    const slope = (prof[Math.min(w - 1, x + 1)] - prof[Math.max(0, x - 1)]) * 0.35;
    // the canvas weave, creases running down off the humps
    let v = 2.6 + slope + (y / Math.max(1, prof[x])) * 0.9;
    if ((X + Y * 2) % 2 === 0 && y % 2 === 0) v -= 0.3;
    if (Math.abs(Math.sin(x * 0.45 + y * 0.6 + seed)) < 0.08) v -= 1.1;
    b.set(X, Y, dpick(rp, v, X, Y));
  }
  // patches with running stitches
  for (let p = 0; p < 2; p++) {
    const px = x0 + rng.int(4, w - 12), py = base - rng.int(2, 7), pw = rng.int(5, 8), ph = rng.int(3, 5);
    const pc = rng.pick([QP.canvas, QP.tarp, R('#3a1a0a', '#5c2a12', '#86401c', '#ae5a2a', '#cc7a40', '#e8a060')]);
    for (let y = py - ph; y < py; y++) for (let x = px; x < px + pw; x++) if (b.opaque(x, y) && b.opaque(x, y - 1)) b.set(x, y, dpick(pc, 3 - (x - px) * 0.15, x, y));
    for (let x = px; x < px + pw; x += 2) { if (b.opaque(x, py - ph - 1)) b.set(x, py - ph - 1, pc[5]); }
  }
  // a rope over it, a stone on the corner, the hem on the ground
  const ra = x0 + rng.int(2, 8), rb = x0 + w - rng.int(2, 8);
  for (let x = ra; x <= rb; x++) { const t = (x - ra) / (rb - ra); const y = base - Math.round(prof[clamp(x - x0, 0, w - 1)] * (1 - Math.abs(t - 0.5) * 0.4)); if (b.opaque(x, y)) b.set(x, y, QP.rope[x % 3 ? 4 : 2]); }
  b.ellipseFn(x0 + w - 3, base - 2, 4, 3, (X, Y, nx, ny) => dpick(VP.stone, 3.6 - nx - ny * 1.2, X, Y));
  for (let x = x0 - 2; x < x0 + w + 2; x++) if (!b.opaque(x, base)) b.set(x, base, rp[1]);
  return S(b, x0 + Math.floor(w / 2), base);
}
/** a heap of fishing net, its mesh, a line of floats, a lead line along the bottom */
export function netHeap(seed: number): Sprite {
  const rng = new Rng(seed * 23 + 9);
  const W = 40, H = 18, b = new PixelBuffer(W, H), base = H - 1;
  const rp = rng.chance(0.5) ? R('#101a1c', '#1c2e30', '#2c4446', '#3e5c5c', '#5a7c78', '#7e9e96') : R('#1c140c', '#30241a', '#463626', '#5e4a36', '#7a6248', '#98805e');
  for (let x = 2; x < W - 2; x++) {
    const t = (x - 2) / (W - 4), hh = Math.round(Math.sin(t * Math.PI) * 11 + (noise1(x * 0.35, seed) - 0.5) * 5);
    for (let y = 0; y < hh; y++) {
      const X = x, Y = base - y;
      const mesh = (X + Y) % 3 === 0 || (X - Y + 99) % 3 === 0;
      b.set(X, Y, mesh ? dpick(rp, 3.4 - t * 1.4 + y * 0.06, X, Y) : dpick(rp, 1.3 - t * 0.6, X, Y));
    }
  }
  // the float line looping over the heap: orange and cream floats
  for (let i = 0; i < 6; i++) {
    const x = 5 + i * 6 + rng.int(-1, 1), y = base - Math.round(Math.sin((x - 2) / (W - 4) * Math.PI) * 10) + rng.int(0, 2);
    const c = rng.chance(0.6) ? R('#7a2a06', '#c45a12', '#f08a2a') : R('#7a7060', '#c8bea4', '#f0ead8');
    b.set(x, y, c[1]); b.set(x + 1, y, c[2]); b.set(x, y + 1, c[0]); b.set(x + 1, y + 1, c[1]); b.set(x - 1, y, c[1]);
  }
  for (let x = 1; x < W - 1; x++) if (x % 4 === 0) b.set(x, base, VP.stone[2]);
  return S(b, W / 2, base);
}
/** a wooden ladder leaning back against something: a missing rung, one lashed on as a repair */
export function ladder(h: number, seed: number): Sprite {
  const rng = new Rng(seed * 29 + 3);
  const lean = Math.round(h * 0.18), W = 12 + lean, b = new PixelBuffer(W, h + 2), base = h;
  const rail = (x0: number, tone: number) => { for (let y = 0; y <= h; y++) { const X = x0 + Math.round((h - y) / h * lean), Y = y; b.set(X, Y, dpick(VP.grey, tone + 0.8, X, Y)); b.set(X + 1, Y, dpick(VP.grey, tone - 0.4, X + 1, Y)); } };
  rail(1, 3.4); rail(9, 2.8);
  const gone = rng.int(1, Math.max(2, Math.floor(h / 8) - 1)), lashed = gone + 2;
  for (let i = 1; i * 7 < h; i++) {
    if (i === gone) continue;
    const y = base - i * 7, X = 2 + Math.round((h - y) / h * lean);
    for (let k = 1; k < 8; k++) { b.set(X + k, y, i === lashed ? VP.bark[3] : VP.grey[4]); b.set(X + k, y + 1, i === lashed ? VP.bark[2] : VP.grey[2]); }
    if (i === lashed) { b.set(X + 1, y - 1, VP.thatch[3]); b.set(X + 8, y - 1, VP.thatch[3]); b.set(X + 1, y + 2, VP.thatch[2]); b.set(X + 8, y + 2, VP.thatch[2]); }
  }
  return S(b, 2, base);
}
/** a wheelbarrow, rusty, a dent in the tray, the wheel in front; a load of soil, wood or weeds */
export function wheelbarrow(seed: number): Sprite {
  const rng = new Rng(seed * 31 + 11);
  const W = 46, H = 26, b = new PixelBuffer(W, H), base = H - 1;
  const rp = rng.chance(0.5) ? QP.galv : R('#2a0e08', '#4a1a10', '#701e14', '#98301e', '#b84a2a', '#d06a44');
  const load = rng.int(0, 2);
  // the load heaped above the tray
  for (let x = 12; x < 38; x++) {
    const hh = Math.round(Math.sin((x - 12) / 26 * Math.PI) * 6 + (noise1(x * 0.5, seed) - 0.5) * 3);
    for (let y = 0; y < hh; y++) {
      const X = x, Y = base - 13 - y;
      if (load === 0) b.set(X, Y, dpick(QP.mud, 3.6 - (x - 12) / 26 + y * 0.1, X, Y));
      else if (load === 1) b.set(X, Y, (X + Y * 3) % 7 < 2 ? hex('#c8a070') : dpick(VP.bark, 3.4 - y * 0.1, X, Y));
      else b.set(X, Y, dpick(QP.tarpGreen, 3.4 + Math.sin(X * 1.7) * 0.8, X, Y));
    }
  }
  if (load === 2) for (let i = 0; i < 6; i++) { const x = 14 + i * 4; b.line(x, base - 17, x + rng.int(-2, 2), base - 22 - rng.int(0, 3), VP.flax[4]); }
  // the tray: deep at the back, sloping at the front, a rolled rim catching the light
  for (let x = 10; x < 40; x++) {
    const t = (x - 10) / 30, d = Math.round(10 - Math.max(0, t - 0.55) * 14);
    for (let y = 0; y < d; y++) { const X = x, Y = base - 12 + y - (10 - d) * 0; b.set(X, Y, dpick(rp, 3.4 - y * 0.18 - t * 0.6 + (Math.abs(x - 26) < 2 && y === 4 ? -1.4 : 0), X, Y)); }
    b.set(x, base - 13, rp[5]);
  }
  // the wheel at the front, the legs and the handles at the back
  b.discFn(36, base - 4, 4.5, (X, Y, nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.62 ? dpick(R('#141414', '#242424', '#3a3a3a', '#545454'), 2 - ny * 1.2, X, Y) : d < 0.22 ? VP.iron[4] : dpick(VP.iron, 2.4 - nx - ny, X, Y); });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI + 0.3; b.set(Math.round(36 + Math.cos(a) * 2), Math.round(base - 4 + Math.sin(a) * 2), VP.iron[1]); }
  for (const lx of [14, 18]) for (let y = 0; y < 6; y++) b.set(lx - Math.round(y * 0.2), base - y, VP.iron[2]);
  for (let x = 0; x < 34; x++) { const y = base - 6 - Math.round(x * 0.15); b.set(x + 2, y, VP.wood[3]); b.set(x + 2, y + 1, VP.wood[2]); }
  b.set(1, base - 6, VP.wood[4]); b.set(2, base - 6, VP.wood[4]);
  return S(b, 24, base);
}
/** garden tools leaning together on a wall: a spade, a rake, a hoe, a mānuka broom, an axe */
export function tools(seed: number): Sprite {
  const rng = new Rng(seed * 37 + 1);
  const W = 30, H = 50, b = new PixelBuffer(W, H), base = H - 1;
  const kinds = ['spade', 'rake', 'hoe', 'broom', 'fork'].sort(() => rng.next() - 0.5).slice(0, rng.int(2, 3));
  kinds.forEach((k, i) => {
    const x0 = 6 + i * 6 + rng.int(-1, 1), lean = rng.int(3, 7), len = rng.int(38, 46);
    const top = base - len;
    const hx = (y: number) => x0 + Math.round((base - y) / len * lean);
    const headDown = k === 'spade' || k === 'fork';
    for (let y = top; y <= base - (headDown ? 9 : 0); y++) { b.set(hx(y), y, VP.wood[4]); b.set(hx(y) + 1, y, VP.wood[2]); }
    if (k === 'spade') {
      for (let y = base - 9; y <= base; y++) { const w = y > base - 3 ? 2 : 3; for (let d = -w; d <= w; d++) b.set(hx(y) + d, y, dpick(QP.galv, 3.4 - d * 0.5 + (y === base ? -1 : 0), hx(y) + d, y)); }
      for (let d = -2; d <= 3; d++) b.set(hx(top) + d, top, VP.wood[3]); b.set(hx(top) - 2, top + 1, VP.wood[3]); b.set(hx(top) + 3, top + 1, VP.wood[3]);
      b.set(hx(base - 8) - 2, base - 7, VP.rust[3]);
    } else if (k === 'fork') {
      for (let t = 0; t < 4; t++) for (let y = base - 8; y <= base; y++) b.set(hx(y) - 3 + t * 2, y, y === base - 8 ? VP.iron[3] : VP.iron[t % 2 ? 2 : 4]);
      for (let d = -3; d <= 4; d++) b.set(hx(base - 9) + d, base - 9, VP.iron[3]);
    } else if (k === 'rake') {
      for (let d = -4; d <= 5; d++) b.set(hx(top) + d, top, VP.iron[3]);
      for (let d = -4; d <= 5; d += 2) { b.set(hx(top) + d, top - 1, VP.iron[2]); b.set(hx(top) + d, top - 2, VP.iron[4]); }
    } else if (k === 'hoe') {
      for (let d = 0; d < 5; d++) { b.set(hx(top) + d, top, VP.iron[4]); b.set(hx(top) + d, top + 1, VP.iron[3]); b.set(hx(top) + d, top + 2, VP.iron[2]); }
    } else {
      // a mānuka broom: twigs bound to the handle with flax, splayed at the top
      for (let t = 0; t < 9; t++) for (let y = 0; y < 10; y++) { const X = hx(top) - 4 + t + Math.round((t - 4) * y * 0.08), Y = top - 9 + y; if (h01(X, Y, seed) < 0.75) b.set(X, Y, dpick(VP.bark, 3.4 - t * 0.2 + (y < 2 ? 1 : 0), X, Y)); }
      for (let d = -2; d <= 2; d++) { b.set(hx(top) + d, top, VP.flax[3]); b.set(hx(top) + d, top + 1, VP.flax[2]); }
    }
  });
  const t = b.trim(0);
  return S(t.buf, 8 - t.ox, base - t.oy);
}
/** a puddle in the trodden earth: sky in it, a muddy rim, a leaf floating */
export function puddle(w: number, seed: number): Sprite {
  const rng = new Rng(seed * 41 + 2);
  const b = new PixelBuffer(w + 4, 5), base = 4;
  for (let x = 0; x < w + 4; x++) {
    const t = (x - 2) / w, e = Math.min(t, 1 - t);
    if (e < -0.04) continue;
    const d = e < 0.06 ? 1 : e < 0.2 ? 2 : 3 - (noise1(x * 0.4, seed) > 0.7 ? 1 : 0);
    for (let y = 0; y < d; y++) {
      const Y = base - y;
      const rim = y === d - 1 || x < 3 || x > w;
      b.set(x, Y, rim ? dpick(QP.mud, 2.2 + y * 0.4, x, Y) : dpick(QP.sky, 2.6 + y * 0.9 + (h01(x, y, seed) < 0.12 ? 1.5 : 0), x, Y));
    }
  }
  // glints and a leaf
  for (let i = 0; i < Math.max(1, w / 10); i++) { const x = 3 + rng.int(0, w - 4); if (b.get(x, base - 1) && b.get(x + 1, base - 1)) { b.set(x, base - 1, QP.sky[5]); b.set(x + 1, base - 1, QP.sky[4]); } }
  if (rng.chance(0.5)) { const x = 4 + rng.int(0, Math.max(1, w - 8)); b.set(x, base - 1, VP.thatch[4]); b.set(x + 1, base - 1, VP.thatch[3]); }
  return { buf: b, ax: Math.floor((w + 4) / 2), ay: base };
}
/** firewood: a heap of split wood (pale faces, bark backs), or a stack under a sheet of iron with a stone on it */
export function firewood(seed: number): Sprite {
  const rng = new Rng(seed * 43 + 5);
  const covered = rng.chance(0.5);
  const W = 44, H = 34, b = new PixelBuffer(W, H), base = H - 1;
  const pieces: [number, number, number][] = [];
  const rows = covered ? 4 : 3;
  for (let r = 0; r < rows; r++) {
    const n = covered ? 6 : 5 - r;
    for (let i = 0; i < n; i++) pieces.push([(covered ? 5 : 6 + r * 3) + i * 6 + rng.int(-1, 1), base - 1 - r * 5 - rng.int(0, 1), rng.int(0, 3)]);
  }
  for (const [px, py, rot] of pieces) {
    // a split quarter-round end on: the heart at one corner, rings round it, bark on the curved side,
    // the fresh split faces pale
    const r = 5.4, sx = rot & 1 ? -1 : 1, sy = rot & 2 ? -1 : 1, ox = px + (sx < 0 ? 5 : 0), oy = py - (sy > 0 ? 5 : 0);
    for (let j = 0; j <= 5; j++) for (let i = 0; i <= 5; i++) {
      const d = Math.hypot(i, j);
      if (d > r) continue;
      const X = ox + sx * i, Y = oy + sy * j;
      let c = d > r - 1.2 ? dpick(VP.bark, 2.8 - sy * 0.6, X, Y) : Math.floor(d * 1.1) % 2 ? hex('#c8a070') : hex('#a87c4e');
      if ((i === 0 || j === 0) && d <= r - 1.2) c = hex('#dcb888');
      b.set(X, Y, c);
    }
  }
  if (covered) {
    // a sheet of rusty corrugated iron over the stack, a stone holding it down
    for (let x = 1; x < W - 1; x++) for (let y = 0; y < 3; y++) { const Y = base - rows * 5 - 2 - y + Math.round(x / W * 2); b.set(x, Y, dpick(h01(x, 0, seed) < 0.4 ? VP.rust : VP.iron, 3.4 - y * 0.8 + (x % 4 === 0 ? -1 : 0), x, Y)); }
    b.ellipseFn(W - 12, base - rows * 5 - 5, 4, 3, (X, Y, nx, ny) => dpick(VP.stone, 3.6 - nx - ny, X, Y));
  } else {
    // kindling tied with flax beside it, chips
    for (let i = 0; i < 6; i++) b.line(W - 12 + i, base, W - 14 + i * 2, base - 9, VP.wood[3 + (i & 1)]);
    b.set(W - 11, base - 4, VP.flax[3]); b.set(W - 10, base - 4, VP.flax[4]); b.set(W - 9, base - 4, VP.flax[3]);
    for (let i = 0; i < 8; i++) b.set(rng.int(2, W - 3), base, hex('#c8a070'));
  }
  const t = b.trim(0);
  return S(t.buf, Math.floor(t.buf.w / 2), base - t.oy);
}
const PLAIT = R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84');
/** a frame with a half-plaited flax mat on it (the loose strands are matStrands, so they swing) */
export function matFrame(seed: number): Sprite {
  const rng = new Rng(seed * 47 + 1);
  const W = 50, H = 44, b = new PixelBuffer(W, H), base = H - 1;
  for (const px of [3, W - 6]) for (let y = 2; y <= base; y++) { b.set(px, y, dpick(VP.bark, 3.6, px, y)); b.set(px + 1, y, VP.bark[2]); }
  for (let x = 1; x < W - 1; x++) { b.set(x, 3, VP.bark[4]); b.set(x, 4, VP.bark[2]); }
  // the plait: two-pixel strands crossing on the diagonal, a dyed black band and an ochre one
  const mh = rng.int(14, 20), band = rng.int(4, 9);
  for (let y = 5; y < 5 + mh; y++) for (let x = 6; x < W - 7; x++) {
    const a = Math.floor((x + y) / 2), c = Math.floor((x - y + 200) / 2);
    const over = (a + c) % 2 === 0;
    const sid = over ? a : c;
    let rp = PLAIT;
    if (sid % 9 === band % 9 || sid % 9 === (band + 1) % 9) rp = R('#100c08', '#1e1610', '#2c2218', '#3a2e20', '#4a3c2a', '#5c4c36');
    else if (sid % 13 === band % 13) rp = VP.ochre;
    b.set(x, y, dpick(rp, (over ? 3.6 : 2.4) - (x - 6) / (W - 13) * 0.8 + ((x + y) % 2 === 0 ? 0.4 : 0), x, y));
  }
  // tied to the top bar
  for (let x = 7; x < W - 7; x += 6) { b.set(x, 4, VP.flax[2]); b.set(x, 5, VP.flax[1]); }
  return S(b, Math.floor(W / 2), base);
}
/** the unplaited strands hanging from the mat's lower edge (a hanging prop, so they swing) */
export function matStrands(seed: number): Sprite {
  const rng = new Rng(seed * 53 + 2);
  const W = 38, H = 22, b = new PixelBuffer(W, H);
  const rp = R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84');
  for (let x = 1; x < W - 1; x += 2) {
    const len = rng.int(10, 20), curl = rng.range(-0.25, 0.25);
    for (let y = 0; y < len; y++) { const X = Math.round(x + curl * y + Math.sin(y * 0.4 + x) * 0.6); b.set(X, y, dpick(rp, 3.4 - y * 0.06 + (x % 4 ? 0 : -0.8), X, y)); }
  }
  return S(b, Math.floor(W / 2), 0);
}
/** kete piled up: plaited bags in two sizes, dyed bands, handles, what's in them peeking out */
export function ketePile(seed: number): Sprite {
  const rng = new Rng(seed * 59 + 3);
  const W = 48, H = 26, b = new PixelBuffer(W, H), base = H - 1;
  const n = rng.int(3, 5);
  const plait = R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84');
  const dark = R('#100c08', '#1e1610', '#2c2218', '#3a2e20', '#4a3c2a', '#5c4c36');
  for (let i = 0; i < n; i++) {
    const back = i < n - 2;
    const cx = 8 + (i * (W - 16)) / Math.max(1, n - 1) + rng.int(-2, 2), w = rng.int(5, 7), h = rng.int(8, 12), by = base - (back ? 3 : 0);
    const slump = rng.range(-0.4, 0.4), bandY = rng.int(2, h - 4), dyed = rng.next();
    for (let y = 0; y < h; y++) {
      const t = y / h, hw = w * (0.8 + Math.sin((1 - t) * Math.PI * 0.6) * 0.25);
      for (let x = Math.round(-hw); x <= Math.round(hw); x++) {
        const X = Math.round(cx + x + slump * y), Y = by - y;
        const a = Math.floor((X + Y) / 2), c = Math.floor((X - Y + 200) / 2), over = (a + c) % 2 === 0;
        let rp = plait;
        if (Math.abs(y - bandY) < 1.5 && dyed < 0.7) rp = dyed < 0.4 ? dark : VP.ochre;
        b.set(X, Y, dpick(rp, (over ? 3.4 : 2.4) - x / hw * 0.8 - (back ? 0.6 : 0), X, Y));
      }
    }
    // handles, and something peeking out of the top
    const ty = by - h;
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) b.set(Math.round(cx + s * (w - 2 - k * 0.5) + slump * h), ty - Math.round(Math.sin(k / 3 * Math.PI) * 2) - 1, plait[1 + (k & 1)]);
    const what = rng.int(0, 3);
    if (what < 3) for (let k = 0; k < 3; k++) produce(b, (['kumara', 'greens', 'potato'] as ProduceKind[])[what], Math.round(cx - 2 + k * 2 + slump * h), ty + 2, rng);
  }
  return S(b, W / 2, base);
}
/** an old waka hull upturned on two blocks: the keel up, worn paint, a tin patch nailed over a split */
export function wakaHull(seed: number): Sprite {
  const rng = new Rng(seed * 61 + 7);
  const L = 120, W = L + 10, H = 30, b = new PixelBuffer(W, H), base = H - 1, x0 = 5;
  const gun = base - 8;
  for (let x = 0; x < L; x++) {
    const t = x / L, e = Math.min(t, 1 - t);
    const depth = Math.round(11 * Math.pow(Math.sin(t * Math.PI), 0.5));
    const rise = e < 0.08 ? Math.round((0.08 - e) * 60) : 0;
    const yTop = gun - depth - rise, yBot = gun - rise;
    for (let y = yTop; y <= yBot; y++) {
      const ny = (y - yTop) / Math.max(1, yBot - yTop);
      let v = 4 - ny * 2.2 - t * 0.5 + (Math.sin(x * 0.9 + y * 0.3) > 0.9 ? -0.8 : 0);
      let rp = VP.wood;
      // a worn red-ochre band along the gunwale, faded black up the hull
      if (ny > 0.72) rp = VP.ochre; else if (ny < 0.28 && h01(x, y, seed) < 0.75) rp = VP.bark;
      if (y === yBot) v -= 1.2;
      b.set(x0 + x, y, dpick(rp, v, x0 + x, y));
    }
    if (yTop >= 0 && x % 2 === 0 && e > 0.06) b.set(x0 + x, yTop, VP.wood[5]);
  }
  // a tin patch nailed over a split
  const px = x0 + rng.int(35, 70);
  for (let x = px; x < px + 10; x++) for (let y = gun - 9; y < gun - 3; y++) if (b.opaque(x, y)) b.set(x, y, dpick(QP.galv, 3.6 - (y - gun + 9) * 0.3, x, y));
  for (let x = px; x < px + 10; x += 3) { b.set(x, gun - 9, VP.iron[1]); b.set(x, gun - 4, VP.iron[1]); }
  // the blocks it rests on: two rounds of log
  for (const bx of [x0 + 22, x0 + L - 26]) for (let y = gun + 1; y <= base; y++) for (let k = 0; k < 9; k++) b.set(bx + k, y, k === 0 || k === 8 ? VP.bark[1] : (y === gun + 1 ? hex('#c8a070') : dpick(VP.bark, 3.4 - k * 0.2, bx + k, y)));
  return S(b, x0 + L / 2, base);
}
/** kids' things: a box cart on pram wheels, a tyre, a cricket bat and ball against a kerosene tin */
export function kidsThing(kind: 'cart' | 'tyre' | 'cricket', seed: number): Sprite {
  const rng = new Rng(seed * 67 + 5);
  if (kind === 'cart') {
    const W = 36, H = 18, b = new PixelBuffer(W, H), base = H - 1;
    for (let x = 6; x < 30; x++) for (let y = base - 12; y < base - 4; y++) b.set(x, y, dpick(VP.wood, 3.6 - (y - base + 12) * 0.2 - (x - 6) / 24 + ((x - 6) % 8 === 0 ? -1 : 0), x, y));
    letters(b, 11, base - 10, 'ZOOM', 3, { col: [hex('#f0ead8'), hex('#e0d8c0')], wear: 0.1, seed });
    for (const wx of [9, 27]) b.discFn(wx, base - 3, 3.2, (X, Y, nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.6 ? R('#141414', '#2a2a2a', '#444444')[clamp(Math.round(1.6 - ny), 0, 2)] : d < 0.25 ? VP.iron[4] : (X + Y) % 2 ? VP.iron[2] : -1; });
    for (let i = 0; i < 6; i++) b.set(30 + i, base - 6 - Math.round(i * 0.4), QP.rope[3]);
    return S(b, 18, base);
  }
  if (kind === 'tyre') {
    const W = 28, H = 12, b = new PixelBuffer(W, H), base = H - 1;
    b.ellipseFn(14, base - 4, 12, 4.5, (X, Y, nx, ny) => { const d = Math.hypot(nx, ny); if (d < 0.55) return -1; const tread = d > 0.86 && (X % 2 === 0); return dpick(R('#0e0e10', '#1c1c20', '#2c2c30', '#404044', '#56565a', '#6e6e72'), 2.6 - ny * 1.4 - (tread ? 0.8 : 0) + (d < 0.65 ? -0.8 : 0), X, Y); });
    if (rng.chance(0.5)) for (let x = 8; x < 20; x++) b.set(x, base - 3, QP.sky[2]);
    return S(b, 14, base);
  }
  const W = 26, H = 26, b = new PixelBuffer(W, H), base = H - 1;
  // the tin wicket
  for (let y = base - 13; y <= base; y++) for (let x = 3; x < 13; x++) b.set(x, y, dpick(QP.galv, 3.6 - (x - 3) * 0.25 + (y === base - 13 ? 1 : 0) + ((y - base) % 5 === 0 ? -0.6 : 0), x, y));
  for (let x = 4; x < 12; x++) if (h01(x, 1, seed) < 0.4) b.set(x, base - 6, VP.rust[3]);
  // the bat leaning on it, the ball in the dirt
  for (let y = 0; y < 22; y++) { const X = 16 + Math.round(y * 0.2), Y = base - 22 + y; if (y < 8) { b.set(X, Y, VP.wood[2]); } else for (let k = 0; k < 4; k++) b.set(X + k - 1, Y, dpick(R('#5a3e1e', '#8a6230', '#b88a48', '#d8ae6a', '#ecca8c', '#f6e0b0'), 4 - k * 0.6, X + k, Y)); }
  b.set(16, base - 22, hex('#2a2a2a')); b.set(16, base - 21, hex('#2a2a2a'));
  b.discFn(22, base - 2, 2.2, (X, Y, nx, ny) => dpick(PR.apple, 3.4 - nx - ny, X, Y));
  return S(b, 12, base);
}
/** a small lit lamp glow (a hurricane lamp hanging on a nail) */
export function hurricaneLamp(lit: boolean): Sprite {
  const b = new PixelBuffer(9, 13), base = 12;
  for (let y = 3; y < 10; y++) for (let x = 1; x < 8; x++) { const nx = (x - 4) / 3.4; if (Math.abs(nx) > (y < 5 || y > 8 ? 0.7 : 1)) continue; b.set(x, y, lit ? pick(R('#a85a14', '#e89a2a', '#ffd06a', '#fff4c0'), 3 - Math.abs(nx) * 2.2 - Math.abs(y - 7) * 0.3) : dpick(QP.glass, 3.4 - nx * 1.6, x, y)); }
  for (let x = 2; x < 7; x++) { b.set(x, 2, VP.iron[3]); b.set(x, 10, VP.iron[2]); b.set(x, 11, VP.iron[3]); }
  b.set(4, 1, VP.iron[2]); b.set(4, 0, VP.iron[3]); b.set(3, 0, VP.iron[3]); b.set(5, 0, VP.iron[3]);
  b.set(4, 7, lit ? hex('#fff8d8') : VP.iron[1]);
  return S(b, 4, 0);
}
export { mix, shade };

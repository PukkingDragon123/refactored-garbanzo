// V5 heads: hand-pixelled heads in 3/4 view facing right, drawn like the reference sprites: a big
// clumpy hair mass with strand lines and broken highlight streaks, a small face tucked under the
// fringe, one eye with a dark lash and a coloured iris, a 1 px nose bump and a tiny mouth.
// Expressions are small per-head stamps for the eye plus shared mouth/brow/blush overlays, so
// blinking, talking and every emotion stay pixel-clean. `hair` > 0 trails the loose back hair one
// pixel for secondary motion (walk, run, turns).

import { PixelBuffer } from '../pixel';
import { hex, C } from '../color';

export type V5Id = 'mori' | 'jenna' | 'joshu' | 'aroha';
export type Look = 'fwd' | 'up' | 'down';
export interface HeadOpts5 { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look; hair?: number }

type Stamp = string[];
interface HeadDef5 {
  rows: string[];
  pal: Record<string, string>;
  /** neck attach point in template pixels (the body's neck top lands here) */
  anchor: [number, number];
  /** eye stamp origin and per-state stamps (letters from `pal`; '.' keeps the template pixel) */
  eyeAt: [number, number];
  eyes: Record<string, Stamp>;
  /** rightmost mouth pixel */
  mouthAt: [number, number];
  mouth: string;
  /** two cheek pixels for blushing */
  blushAt: [number, number];
  blush: string;
  /** brow colour and the row just above the eye stamp where brows can show */
  brow: string;
  browAt: [number, number];
  /** skin letters (for pale / blush tests) */
  skin: string[];
  /** trailing hair region: x < swayX and y >= swayY moves back a pixel with `hair` */
  swayX: number;
  swayY: number;
}

// ------------------------------------------------------------------ Mori: messy brown mop, round glasses

const MORI: HeadDef5 = {
  rows: [
    '.....B...B.......',
    '....BIB.BJB.B....',
    '..BBEIJIEJIEJB...',
    '.BFEIJJIEIJIEEB..',
    'BFEEIIEEIIEEEEEB.',
    'BCFEEEEEEFEEEEEEB',
    'BCFFEEFEFEEFEFEB.',
    'BCFFFEFFKFFFFKMB.',
    'BCFFFFgKMMGGGGMB.',
    'BCFFFFRKMgGWHGgB.',
    'BCFFFRKMMgMKKMgPB',
    'BCFFFRKMMMggggMB.',
    '.BCFFBRKMMMMMMMB.',
    '..BCFBBRKMMMMMB..',
    '...BB.BRRKMMMB...',
    '......BRRKKMB....',
    '......BRRKBB.....',
    '......BRRKB......',
    '......BRRKB......',
  ],
  pal: { B: '#1a1216', C: '#2a1a16', F: '#43291e', E: '#65402c', I: '#8c5e3c', J: '#bc8a5e', R: '#8a4c3c', K: '#c6835f', M: '#eeb18a', P: '#fbd5b2', G: '#1a1014', W: '#f4efe8', H: '#6e4a34', g: '#8a7872' },
  anchor: [8, 19],
  eyeAt: [10, 8],
  eyes: {
    open: ['GGGG', 'GWHG'],
    closed: ['MMMM', 'MGGG'],
    happy: ['MGGM', 'GMMG'],
    half: ['GGGG', 'GGHG'],
    wide: ['GGGG', 'WWHG'],
    tiny: ['MMMM', 'MMGM'],
    squint: ['GGGM', 'MGGG'],
    sad: ['MGGG', 'GWHG'],
    down: ['MMMM', 'GGHG'],
    up: ['GWHG', 'MMMM'],
  },
  mouthAt: [13, 12],
  mouth: '#9a5446',
  blushAt: [9, 12],
  blush: '#f09a86',
  brow: '#2a1a16',
  browAt: [10, 7],
  skin: ['K', 'M', 'P', 'R'],
  swayX: 5,
  swayY: 9,
};

// ------------------------------------------------------------------ Jenna: dusty-pink bob, big pink eye

const JENNA: HeadDef5 = {
  rows: [
    '.....BBBBB.......',
    '...BBEIJJIEBB....',
    '..BFEIJJIIEEEB...',
    '.BFEEIJIEEIIEEB..',
    'BFEEIIEEEIEEEEEB.',
    'BCFEEEEEEFEEEEEB.',
    'BCFFEEFEFEEFEEFB.',
    'BCFFFEFFKEFFEKMB.',
    'BCFFFFFKMGGGGGMB.',
    'BCFFFFRKMMGWLGMB.',
    'BCFFFRKMMMGLLGMPB',
    'BCFFFRKMMMMKKMMB.',
    'BCEFFRKMMMMMMMB..',
    'BCEFFBRKMMMMMB...',
    'BCFEFBBRKMMMB....',
    '.BCFFB.BRKKMB....',
    '.BCEFB.BRKBB.....',
    '..BCFB.BRKB......',
    '...BB..BRKB......',
  ],
  pal: { B: '#1c1018', C: '#4a2238', F: '#6a3450', E: '#94506c', I: '#c07890', J: '#f2c8cc', R: '#b0645a', K: '#dc8c7c', M: '#f8c0a8', P: '#fde0cc', G: '#1c0c18', W: '#fff0f6', L: '#d04c8c' },
  anchor: [9, 19],
  eyeAt: [9, 8],
  eyes: {
    open: ['GGGGG', 'MGWLG', 'MGLLG'],
    closed: ['MMMMM', 'MMMMM', 'MGGGG'],
    happy: ['MMMMM', 'MGGGM', 'GMMMG'],
    half: ['MMMMM', 'GGGGG', 'MGLLG'],
    wide: ['GGGGG', 'MWWLG', 'MGLLG'],
    tiny: ['MMMMM', 'MMGMM', 'MMMMM'],
    squint: ['GGGMM', 'MGGGG', 'MMLLG'],
    sad: ['MMGGG', 'MGWLG', 'MGLLG'],
    down: ['MMMMM', 'GGGGG', 'MGLLG'],
    up: ['GGGGG', 'MGWLG', 'MMMMM'],
  },
  mouthAt: [12, 13],
  mouth: '#b05a58',
  blushAt: [10, 12],
  blush: '#f09a9a',
  brow: '#4a2238',
  browAt: [11, 7],
  skin: ['K', 'M', 'P', 'R'],
  swayX: 5,
  swayY: 10,
};

// ------------------------------------------------------------------ Joshu: red watch cap, white beard

const JOSHU: HeadDef5 = {
  rows: [
    '.....BBBBBB.......',
    '...BB344543BB.....',
    '..B2334444333B....',
    '.B223333333323B...',
    '.B1223333333223B..',
    'B34343434343434B..',
    'B23232323232323B..',
    'BbcdcbaKKMMMMMMB..',
    'BbccdcbaKMMdeeedB.',
    'BabccbaKRKMGGGGMB.',
    'BabbcbaKKMMMGWGMPB',
    'BaabbaKddMMMMKMMMB',
    '.BaaaBKddMMMdeeedB',
    '......BKddedddbddB',
    '......BRcdddedddB.',
    '.......BbcddddcB..',
    '........BbccccB...',
    '.........BbbbB....',
    '..........BBB.....',
  ],
  pal: { B: '#161218', '1': '#3a1414', '2': '#561c1a', '3': '#762a24', '4': '#94402e', '5': '#b45e40', a: '#5e5a66', b: '#85818c', c: '#aeaab2', d: '#d2cfd2', e: '#f0eeea', R: '#8a4a3a', K: '#c07c60', M: '#e8a47e', P: '#f6c49e', G: '#20141a', W: '#fff6ee' },
  anchor: [9, 16],
  eyeAt: [11, 9],
  eyes: {
    open: ['GGGG', 'MGWG'],
    closed: ['MMMM', 'KGGG'],
    happy: ['MGGM', 'GMMG'],
    half: ['GGGG', 'MGGG'],
    wide: ['GGGG', 'GWWG'],
    tiny: ['MMMM', 'MMGM'],
    squint: ['GGGM', 'MGGG'],
    sad: ['MGGG', 'MGWG'],
    down: ['MMMM', 'MGGG'],
    up: ['GWGG', 'MMMM'],
  },
  mouthAt: [15, 13],
  mouth: '#5e5a66',
  blushAt: [12, 11],
  blush: '#e88a78',
  brow: '#f0eeea',
  browAt: [12, 8],
  skin: ['K', 'M', 'P', 'R'],
  swayX: 0,
  swayY: 99,
};

// ------------------------------------------------------------------ Aroha: long dark hair, taniko headband

const AROHA: HeadDef5 = {
  rows: [
    '.....BBBBB.......',
    '...BBEIJJIEBB....',
    '..BFEIJJIIEEEB...',
    '.BFEEIJIEEIIEEB..',
    'BFrwrkrwrkrwrkrB.',
    'BCFqqqqqqqqqqqqB.',
    'BCFEEEFEEKMMMMMB.',
    'BCFFEFEFKMMMKKMB.',
    'BCFFFEFKMGGGGGMB.',
    'BCFEFFRKMMGWHGMB.',
    'BCFFEFRKMMGHHGMPB',
    'BCFEFFRKMMMKKMMB.',
    'BCFFEFRKMMMMMMB..',
    'BCFEFFBRKMMMMMB..',
    'BCFFEFBBRKMMMB...',
    'BCFEFFB.BRKKMB...',
    'BCFFEFB.BRKBB....',
    'BCFEFFB.BRKB.....',
    '.BCFEFB.BRKB.....',
    '.BCFFEB.BRKB.....',
    '..BCFFB..........',
    '...BCEB..........',
    '....BB...........',
  ],
  pal: { B: '#140c0c', C: '#1a0e0e', F: '#2e1a16', E: '#4a2c22', I: '#6e4230', J: '#9a6444', r: '#b83a30', w: '#e8dcc0', k: '#1a1010', q: '#6a2420', R: '#6a3e2c', K: '#9a6446', M: '#bc855e', P: '#d49c74', G: '#241410', W: '#fff4ea', H: '#8a5634' },
  anchor: [10, 20],
  eyeAt: [9, 8],
  eyes: {
    open: ['GGGGG', 'MGWHG', 'MGHHG'],
    closed: ['MMMMM', 'MMMMM', 'MGGGG'],
    happy: ['MMMMM', 'MGGGM', 'GMMMG'],
    half: ['MMMMM', 'GGGGG', 'MGHHG'],
    wide: ['GGGGG', 'MWWHG', 'MGHHG'],
    tiny: ['MMMMM', 'MMGMM', 'MMMMM'],
    squint: ['GGGMM', 'MGGGG', 'MMHHG'],
    sad: ['MMGGG', 'MGWHG', 'MGHHG'],
    down: ['MMMMM', 'GGGGG', 'MGHHG'],
    up: ['GGGGG', 'MGWHG', 'MMMMM'],
  },
  mouthAt: [12, 13],
  mouth: '#7a3a2a',
  blushAt: [10, 12],
  blush: '#c86a5a',
  brow: '#1a0e10',
  browAt: [11, 7],
  skin: ['K', 'M', 'P', 'R'],
  swayX: 6,
  swayY: 11,
};

export const HEADS5: Record<V5Id, HeadDef5> = { mori: MORI, jenna: JENNA, joshu: JOSHU, aroha: AROHA };

// ------------------------------------------------------------------ expressions

/** mouth stamps, right-aligned on mouthAt. m line, M open dark, R tongue, T teeth */
const MOUTHS: Record<string, Stamp> = {
  line: ['mm'],
  smile: ['m.', '.m'],
  grin: ['MM', 'TT'],
  open: ['MM', 'MR'],
  o: ['M', 'M'],
  shout: ['MMM', 'MRR'],
  frown: ['.m', 'm.'],
  grit: ['TT', 'mm'],
  wavy: ['m.m'],
  cat: ['m.m', '.m.'],
};

const EXPR: Record<string, { eye: string; bIn: number; bOut: number; mouth: string; blush?: boolean; sweat?: boolean; pale?: boolean }> = {
  neutral: { eye: 'open', bIn: 0, bOut: 0, mouth: 'line' },
  happy: { eye: 'happy', bIn: 1, bOut: 1, mouth: 'smile', blush: true },
  laugh: { eye: 'happy', bIn: 1, bOut: 1, mouth: 'shout', blush: true },
  surprised: { eye: 'wide', bIn: 2, bOut: 2, mouth: 'o' },
  shocked: { eye: 'tiny', bIn: 2, bOut: 2, mouth: 'shout', pale: true, sweat: true },
  angry: { eye: 'squint', bIn: -2, bOut: 1, mouth: 'grit' },
  grumpy: { eye: 'half', bIn: -1, bOut: 0, mouth: 'frown' },
  sad: { eye: 'sad', bIn: 2, bOut: -1, mouth: 'frown' },
  worried: { eye: 'open', bIn: 2, bOut: -1, mouth: 'wavy', sweat: true },
  scared: { eye: 'tiny', bIn: 2, bOut: 0, mouth: 'wavy', sweat: true, pale: true },
  thinking: { eye: 'half', bIn: 1, bOut: -1, mouth: 'line' },
  tired: { eye: 'half', bIn: 0, bOut: -1, mouth: 'line' },
  teasing: { eye: 'half', bIn: 1, bOut: 1, mouth: 'smile', blush: true },
  serious: { eye: 'open', bIn: -1, bOut: 0, mouth: 'line' },
  smug: { eye: 'half', bIn: 1, bOut: 1, mouth: 'smile' },
  determined: { eye: 'squint', bIn: -1, bOut: 1, mouth: 'grin' },
  sleep: { eye: 'closed', bIn: 0, bOut: 0, mouth: 'line' },
  eat: { eye: 'happy', bIn: 1, bOut: 1, mouth: 'o', blush: true },
  injured: { eye: 'squint', bIn: 2, bOut: -1, mouth: 'grit', sweat: true },
  excited: { eye: 'wide', bIn: 2, bOut: 1, mouth: 'grin', blush: true },
};
export const HEAD_EXPRS5 = Object.keys(EXPR);

// ------------------------------------------------------------------ compose

const cc = new Map<string, C>();
const col = (h: string) => { let c = cc.get(h); if (c === undefined) { c = hex(h); cc.set(h, c); } return c; };

function stamp(b: PixelBuffer, rows: Stamp, x0: number, y0: number, pal: Record<string, string>, onlyOver: boolean) {
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.' || ch === ' ') continue;
      const x = x0 + i, y = y0 + j;
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
      if (onlyOver && !(b.get(x, y) >>> 24)) continue;
      const h = pal[ch];
      if (h) b.set(x, y, col(h));
    }
  });
}

const PALE_SKIN: Record<string, string> = { R: '#a88c86', K: '#ccb2aa', M: '#e8d6ce', P: '#f4ebe4' };

/** Render a head. Returns the buffer and the neck anchor (buffer pixels). */
export function renderHead5(id: V5Id, o: HeadOpts5): { buf: PixelBuffer; ax: number; ay: number } {
  const d = HEADS5[id];
  const W = Math.max(...d.rows.map(r => r.length)), H = d.rows.length;
  const pad = 2;
  const b = new PixelBuffer(W + pad * 2, H + 1);
  const ex = EXPR[o.expr] ?? EXPR.neutral;
  const pal: Record<string, string> = { ...d.pal };
  if (ex.pale) for (const k of d.skin) if (PALE_SKIN[k]) pal[k] = PALE_SKIN[k];
  stamp(b, d.rows, pad, 0, pal, false);
  // secondary motion: the loose back hair trails a pixel (stretching at the seam, no gaps)
  const sway = Math.max(0, Math.min(2, Math.round(o.hair ?? 0)));
  if (sway > 0 && d.swayY < H) {
    const src = b.data.slice();
    const sx = d.swayX + pad;
    for (let y = d.swayY; y < b.h; y++) {
      const k = y >= d.swayY + 5 ? sway : Math.min(1, sway);
      for (let x = 0; x < sx; x++) {
        const from = x + k;
        b.data[y * b.w + x] = from < sx ? src[y * b.w + from] : src[y * b.w + sx - 1];
      }
    }
  }
  const fp: Record<string, string> = { ...pal, m: d.mouth, M: '#3a1418', R: '#c85a64', T: '#f6f0e8' };
  // eye
  const blinkable = ex.eye !== 'happy' && ex.eye !== 'closed';
  let eye = o.blink && blinkable ? 'closed' : ex.eye;
  if (!o.blink && eye === 'open' && o.look === 'down') eye = 'down';
  if (!o.blink && eye === 'open' && o.look === 'up') eye = 'up';
  const [ex0, ey0] = [d.eyeAt[0] + pad, d.eyeAt[1]];
  stamp(b, d.eyes[eye] ?? d.eyes.open, ex0, ey0, fp, true);
  // brows: a short stroke above the eye for strong expressions (over bangs or skin)
  if (ex.bIn !== 0 || ex.bOut !== 0) {
    const bx = d.browAt[0] + pad, by = d.browAt[1];
    const bc = col(d.brow);
    const put = (x: number, y: number) => { if (b.get(x, y) >>> 24) b.set(x, y, bc); };
    const yo = by - (ex.bOut > 1 ? 1 : 0) + (ex.bOut < 0 ? 1 : 0);
    const yi = by - (ex.bIn > 1 ? 1 : 0) + (ex.bIn < 0 ? 1 : 0);
    put(bx, yo);
    put(bx + 1, Math.round((yo + yi) / 2));
    put(bx + 2, yi);
  }
  if (ex.blush) {
    const [x, y] = [d.blushAt[0] + pad, d.blushAt[1]];
    for (const dx of [0, 1]) if (b.get(x + dx, y) >>> 24) b.set(x + dx, y, col(d.blush));
  }
  // mouth
  let mname = ex.mouth;
  if (o.mouth === 1 && (mname === 'line' || mname === 'smile' || mname === 'frown' || mname === 'wavy')) mname = 'open';
  if (o.mouth === 2 && mname !== 'grit') mname = mname === 'o' || mname === 'shout' ? 'shout' : 'grin';
  const mr = MOUTHS[mname] ?? MOUTHS.line;
  const [mx, my] = [d.mouthAt[0] + pad, d.mouthAt[1]];
  stamp(b, mr, mx - mr[0].length + 1, my, fp, true);
  // sweat drop by the temple
  if (ex.sweat) {
    const x = b.w - 3, y = 4;
    b.set(x, y, col('#8ac8ec')); b.set(x, y + 1, col('#4a90c8')); b.set(x + 1, y + 1, col('#2a4a6a'));
  }
  return { buf: b, ax: d.anchor[0] + pad, ay: d.anchor[1] };
}

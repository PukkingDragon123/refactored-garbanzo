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
    '.........BV.......',
    '.......JGCDDZ.....',
    '.....VGGIGIIGG....',
    '....ZZWWVIIISWJ...',
    '...VVZZaWQIcWVWS..',
    '..ZSWWccZFacaIIVJ.',
    '..DIJWWWVFSVCQFISJ',
    '.EGGWVWVFGICUYQDGJ',
    '..GJSISFFGFIJIUDDZ',
    '.DWGFIIFFFAAAAAADD',
    '.CCGFIIIFfALNLgfB.',
    'CCGCCIIfefbKPKffB.',
    'JCACAIFUdbfbbfffB.',
    'SII.SIFCQXfffOfB..',
    'CIFJJDFFXXXbffB...',
    '.DVH.HBCXXXefB....',
    'JV..CVVdeXB.......',
  ],
  pal: { A: '#0c0607', B: '#0f0c14', C: '#1d0e0f', D: '#231518', E: '#1b1b23', F: '#2f1617', G: '#2b2122', H: '#252633', I: '#382425', J: '#3a2f30', K: '#9a6038', L: '#3a2418', N: '#120808', O: '#a04a3a', P: '#fff6ea', Q: '#4d2c25', S: '#453a3a', U: '#61372d', V: '#504344', W: '#5b4b4b', X: '#8c392f', Y: '#744830', Z: '#635c5d', a: '#756e6f', b: '#9a664a', c: '#8c8283', d: '#ba805d', e: '#d49672', f: '#f3a572', g: '#d6c3bf' },
  anchor: [8, 17],
  eyeAt: [10, 9],
  eyes: {
    open: ['AAAAA', 'ALNLg', 'bKPKf'],
    closed: ['DDDDD', 'fffff', 'bAAAf'],
    happy: ['DDDDD', 'fAAAf', 'AfffA'],
    half: ['AAAAA', 'AAAAA', 'bKPKf'],
    wide: ['AAAAA', 'gLNLg', 'bKPKf'],
    tiny: ['DDDDD', 'fffff', 'ffAff'],
    squint: ['AAAAA', 'fAAAA', 'bKNKf'],
    sad: ['fAAAA', 'ALNLg', 'bKPKf'],
    down: ['AAAAA', 'AAAAA', 'bLNLf'],
    up: ['ALNLg', 'bKPKf', 'fffff'],
  },
  mouthAt: [13, 13],
  mouth: '#8a3a30',
  blushAt: [10, 12],
  blush: '#f09a90',
  brow: '#231518',
  browAt: [11, 8],
  skin: [],
  swayX: 4,
  swayY: 9,
};

// ------------------------------------------------------------------ Jenna: dusty-pink bob, big pink eye

const JENNA: HeadDef5 = {
  rows: [
    '....XXANGFFFGBDX...',
    '.....DSUUUQPOOQA...',
    '....DUUUUUSPUSUQBV.',
    '...AbbQUUUQUUbbQUEO',
    '...DbQXbZUSZbbbPQGF',
    '..ASUPSZbbQXZUQNPPB',
    '..AUQPUUUUPSSSDHOOB',
    '.ZBUPUUSUUPQSNBQPOE',
    '.OPUPUUPSUSAAAAAAN.',
    'BNSQUUUUQSSAdIIKaB.',
    'EUQPQUUaaPQYLLLbaaB',
    'ASOPPSUaYDPFWYYaaaB',
    'DSCPOPQQaAPFaccaaB.',
    'AAVAPPPPDWDFaaaJaE.',
    '....BOPPBWWYYaaaB..',
    '.....FONBYWYYaB....',
    '......BFDYWWB......',
  ],
  pal: { A: '#040103', B: '#0c0609', C: '#0d0b17', D: '#1c1111', E: '#281e1f', F: '#372329', G: '#442c32', H: '#54302e', I: '#2a1420', J: '#b85a5a', K: '#fff8f0', L: '#ecc452', N: '#513f45', O: '#62454f', P: '#6d4855', Q: '#7b5459', S: '#876465', U: '#926f6c', V: '#7f7e7f', W: '#c27369', X: '#948c8a', Y: '#d4887d', Z: '#bdaba5', a: '#f4b3a2', b: '#e1c7bc', c: '#f09a90', d: '#a8782c' },
  anchor: [10, 17],
  eyeAt: [11, 8],
  eyes: {
    open: ['AAAAAA', 'AdIIKa', 'YLLLba'],
    closed: ['PPPPAA', 'aaaaaa', 'YAAAAa'],
    happy: ['PPPPPP', 'aaAAaa', 'aAaaAa'],
    half: ['AAAAAA', 'AAAAAA', 'YLLLba'],
    wide: ['AAAAAA', 'KdIIKa', 'YLLLba'],
    tiny: ['PPPPPP', 'aaaaaa', 'aaAAaa'],
    squint: ['AAAAAA', 'aAAAAA', 'YdIIba'],
    sad: ['aAAAAA', 'AdIIKa', 'YLLLba'],
    down: ['AAAAAA', 'AAAAAA', 'YdIIba'],
    up: ['AdIIKa', 'YLLLba', 'aaaaaa'],
  },
  mouthAt: [15, 13],
  mouth: '#a04848',
  blushAt: [13, 12],
  blush: '#f09a90',
  brow: '#372329',
  browAt: [12, 7],
  skin: [],
  swayX: 5,
  swayY: 10,
};

// ------------------------------------------------------------------ Joshu: red watch cap, white beard

const JOSHU: HeadDef5 = {
  rows: [
    '.........CC.........',
    '.......COPPOC.......',
    '.....CNOOPPOONC.....',
    '....CNOOOOPPOOONC...',
    '...CLNNOOOOOOOONLC..',
    '..CLNONONONONONONONC',
    '..CLNLNLNLNLNLNLNLC.',
    '.CVUSUSLLLLLLLLLLC..',
    '.CVUSSUVJJJJJJJJJC..',
    '.CVUUSVCJAAAAAJJB...',
    '.CVUSUVCJJAEFEKJB...',
    'CVVUUVVJIJHDGDJJB...',
    'CVVSVVCJHSQQQSJJJJB.',
    'CVV.CVVSQQQQQQQQJB..',
    'CVC..CSQQSQQQQQSB...',
    '.C....CSQQQQQQSB....',
    '......CUSQQQQSB.....',
    '.......CUSSSUB......',
    '........CBBB........',
  ],
  pal: { A: '#0c0607', B: '#0f0c14', C: '#1d0e0f', D: '#9a6038', E: '#3a2418', F: '#120808', G: '#fff6ea', H: '#9a664a', I: '#d49672', J: '#f3a572', K: '#d6c3bf', L: '#5a1c18', N: '#7a2a22', O: '#9a3c2c', P: '#b85a40', Q: '#e8e4e0', S: '#c8c4c4', U: '#9a9698', V: '#6a666c' },
  anchor: [8, 17],
  eyeAt: [10, 9],
  eyes: {
    open: ['AAAAA', 'AEFEK', 'HDGDJ'],
    closed: ['SSSSS', 'JJJJJ', 'HAAAJ'],
    happy: ['SSSSS', 'JAAAJ', 'AJJJA'],
    half: ['AAAAA', 'AAAAA', 'HDGDJ'],
    wide: ['AAAAA', 'KEFEK', 'HDGDJ'],
    tiny: ['SSSSS', 'JJJJJ', 'JJAJJ'],
    squint: ['AAAAA', 'JAAAA', 'HDFDJ'],
    sad: ['JAAAA', 'AEFEK', 'HDGDJ'],
    down: ['AAAAA', 'AAAAA', 'HEFEJ'],
    up: ['AEFEK', 'HDGDJ', 'JJJJJ'],
  },
  mouthAt: [13, 13],
  mouth: '#8a868c',
  blushAt: [9, 11],
  blush: '#f09a90',
  brow: '#e8e4e0',
  browAt: [11, 8],
  skin: [],
  swayX: 0,
  swayY: 99,
};

// ------------------------------------------------------------------ Aroha: long dark hair, taniko headband

const AROHA: HeadDef5 = {
  rows: [
    '....CCABDDDDDAC.....',
    '.....ADEEEEDDDA.....',
    '....AEEEFEEDEEEA....',
    '...AQSQOQSQOQSQOA...',
    '...ADDEEEEEEDDDDDA..',
    '..ADEDEFEEDDDEDDDA..',
    '..AEDDEEEEDDDDACDDA.',
    '.ACEDEEDEEDDCDAAIDA.',
    '.CDEDEEDDEDCAAAAAAIA',
    'ACDEEEEDDEDAUJJLIA..',
    'AEDDDEEIIEDGNNNLIIA.',
    'ADCDDEEIGADHGGGIIIA.',
    'ADADCDEDIADHIPPIIA..',
    'ADACDDDDAHHHIIIKIA..',
    'ADC.ACDDAGGGGIIIA...',
    'ADC..ACBAGGGGIA.....',
    'AEDC..ABAHGGGA......',
    'ADEC................',
    '.ADC................',
    '.AC.................',
  ],
  pal: { A: '#040103', B: '#1a0e0c', C: '#2e1a14', D: '#4a2c20', E: '#6a4230', F: '#8a5a40', G: '#9a6446', H: '#6e4430', I: '#d49c74', J: '#2a1420', K: '#b85a5a', L: '#fff8f0', N: '#8a5a34', O: '#1a1010', P: '#f09a90', Q: '#a8342c', S: '#e4d6b8', U: '#5a3620' },
  anchor: [10, 17],
  eyeAt: [11, 8],
  eyes: {
    open: ['CAAAAA', 'AUJJLI', 'GNNNLI'],
    closed: ['CDDDAA', 'IIIIII', 'GAAAAI'],
    happy: ['CDDDDD', 'IIAAII', 'IAIIAI'],
    half: ['CAAAAA', 'AAAAAA', 'GNNNLI'],
    wide: ['CAAAAA', 'LUJJLI', 'GNNNLI'],
    tiny: ['CDDDDD', 'IIIIII', 'IIAAII'],
    squint: ['CAAAAA', 'IAAAAA', 'GUJJLI'],
    sad: ['CIAAAA', 'AUJJLI', 'GNNNLI'],
    down: ['CAAAAA', 'AAAAAA', 'GUJJLI'],
    up: ['AUJJLI', 'GNNNLI', 'IIIIII'],
  },
  mouthAt: [15, 13],
  mouth: '#7a3a2a',
  blushAt: [13, 12],
  blush: '#f09a90',
  brow: '#1a0e0c',
  browAt: [12, 7],
  skin: [],
  swayX: 5,
  swayY: 10,
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

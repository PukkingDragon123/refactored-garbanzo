// V4 anime heads: hand-authored pixel heads (3/4 side view facing right, plus a back view for
// climbing) with expression overlays for eyes, brows and mouth, blinking and talking. Every head is
// drawn at the same 1x sprite resolution so the whole cast shares one art style.

import { PixelBuffer } from '../pixel';
import { hex, C } from '../color';

export type AnimeId = 'mori' | 'jenna' | 'joshu' | 'aroha';
export type Look = 'fwd' | 'up' | 'down';
export interface HeadOpts { expr: string; mouth: 0 | 1 | 2; blink: boolean; look: Look }

export interface HeadDef {
  /** side view rows (facing right); '.' = empty */
  side: string[];
  /** back view rows (facing away, for climbing) */
  back: string[];
  pal: Record<string, string>;
  /** neck attach point (x, y) in template pixels (the body neck top sits here) */
  anchor: [number, number];
  /** near eye box origin (x, y): top row = lash line */
  eye: [number, number];
  mouth: [number, number];
  style: 'boy' | 'girl' | 'old';
  /** eye colours: dark pupil, iris */
  iris: [string, string];
  glasses?: string;
  blush?: string;
  /** rows of the side template that hide the brows (bangs): brows drawn only for expressive faces */
  browCol: string;
  /** long wavy hair: flowing strand highlights are added below the face line */
  wavy?: boolean;
}

// ------------------------------------------------------------------ templates

// Palette letters shared by all heads:
//  o outline   H hair   h hair shadow   d hair deep   I hair light
//  S skin      s skin shadow   L skin light   e ear inner   n nose shadow
//  plus per-character accessory letters
const MORI: HeadDef = {
  style: 'boy',
  side: [
    '.......o..oo.o.....',
    '......oHooHHoHo....',
    '....ooHHHHHHHHHo...',
    '...oHHIIHHHHHHHHo..',
    '..oHIIHHHHHHHHHHHo.',
    '.ooHHHHHHHHHHHHHHo.',
    'oHhHHHHHHHHhHHHhHHo',
    'ohhhHHHHhHHSHHhSSHo',
    'ohhhhHhhSSSSSSSSSo.',
    '.ohhhhhSSSSSSSSSSo.',
    'oohhhhoeSSSSSSSSSSo',
    'ohhhhhoeSSSSSSSSSSo',
    '.ohhhhosSSSSSSSSSo.',
    '..ohhhhosSSSSSSSo..',
    '...ohhhossSSSSSo...',
    '....ooosssssSoo....',
    '......ossssSo......',
    '......ossssSo......',
  ],
  back: [
    '......oo.ooo.....',
    '....ooHHoHHHoo...',
    '...oHHHHHHHHHHo..',
    '..oHIIHHHHHHHHHo.',
    '.oHIHHHHHHHHHHHo.',
    '.ohHHHHHHHHHHHHo.',
    'ohhHHHHHHHHHHHho.',
    'ohhhHHHHHHHHHhho.',
    'ohhhhHHHHHHHhhho.',
    'ohhhhhhHHHHhhhho.',
    '.ohhhhhhhhhhhhoo.',
    '.oeohhhhhhhhhoeo.',
    '..ooohhhhhhhoo...',
    '.....oossssoo....',
    '......osssso.....',
  ],
  pal: {
    o: '#2a1c22', H: '#4e3428', h: '#36221c', d: '#241612', I: '#7a5238',
    S: '#f4c8a6', s: '#dca082', L: '#fbe0c8', e: '#c88468', n: '#d0907a',
  },
  anchor: [9, 17],
  eye: [12, 9],
  mouth: [16, 13],
  iris: ['#1e1418', '#5a3a2a'],
  glasses: '#4a3a52',
  browCol: '#36221c',
};

const JENNA: HeadDef = {
  style: 'girl',
  side: [
    '.........ooooo.......',
    '.......ooHHHHHoo.....',
    '......oHHIIIHHHHo....',
    '..oo.oHHIHHHHHHHHo...',
    '.oHHooHHHHHHHHHHHHo..',
    'oHHIHhHHHHHHHHHHHHHo.',
    'oHIHHhHHHHHHHHhHHHHo.',
    'oHHHhhhHHHHHhHHhSHHo.',
    'ohHHhhhhHHhSSSSSSSHo.',
    'ohHhhhhhhSSSSSSSSSSo.',
    '.ohhhhhhoeSSSSSSSSSo.',
    '.ohhhhhhoeSSSSSSSSSSo',
    '..ohhhhhosSSSSSSSSSSo',
    '..ohhhhhhosSSSSSSSSo.',
    '...ohhhhhhosSSSSSSo..',
    '....ohhhhhoosssSSo...',
    '.....ohhho..ossSo....',
    '......ooo...ossSo....',
  ],
  back: [
    '.........ooooo.......',
    '.......ooHHHHHoo.....',
    '......oHHIIIHHHHo....',
    '..oo.oHHIHHHHHHHHo...',
    '.oHHooHHHHHHHHHHHHo..',
    'oHHIHhHHHHHHHHHHHHo..',
    'oHIHHhHHHHHHHHHHHHo..',
    'oHHHhhhHHHHHHHHHHho..',
    'ohHHhhhhHHHHHHHHhho..',
    'ohHhhhhhhHHHHHHhhho..',
    '.ohhhhhhhhhhhhhhhoo..',
    '..ohhhhhhhhhhhhhoo...',
    '...ooohhhhhhhhoo.....',
    '......oosssssoo......',
    '.......osssso........',
  ],
  pal: {
    o: '#3a1a2e', H: '#f472b0', h: '#d04890', d: '#a02a6e', I: '#ffb8dc',
    S: '#fcd8c2', s: '#eab098', L: '#fff0e4', e: '#e09a8a', n: '#e0a090',
    P: '#3a3a4a', p: '#5a5a70',
  },
  anchor: [14, 17],
  eye: [13, 9],
  mouth: [18, 13],
  iris: ['#3a1030', '#c0407e'],
  blush: '#ff8aa8',
  browCol: '#d04890',
};

const JOSHU: HeadDef = {
  style: 'old',
  side: [
    '.....ooooooooo......',
    '....oCCCCCCCCCo.....',
    '...oCCCCCCCCgCCo....',
    '...oCCCCCCCCCCCo....',
    '..oBBBBBBBBBBBBBoo..',
    '..ohKKKKKKKKKKKKKKo.',
    '.ohhhooooooooooooo..',
    '.ohhhHSSSSSSSSSSSo..',
    '.ohhhHSSWWWSSSWWWSo.',
    'ohhhhoeSSSxSSSSSSSo.',
    'ohhhhosSSSSxSSSSSSSo',
    'ohhhhosSSSSSxSSSSSSo',
    'ohhhhWWSSSSSSSSWWWWo',
    '.ohWWWWWSSSSSWWWWWWo',
    '.oWWwWWWWWWWWWWwWWo.',
    '..oWWwWWWWwWWWWwWWo.',
    '..oWWWwWWWwWWWwWWo..',
    '...oWWwWWWWwWWwWWo..',
    '...oWWWwWWWwWWwWo...',
    '....oWWwWWWwWwWWo...',
    '.....oWWwWWwWWWo....',
    '......oWWWwWWWo.....',
    '.......oWWWWWo......',
    '........ooooo.......',
  ],
  back: [
    '.....oooooooo........',
    '....oCCCCCCCCo.......',
    '...oCCCCCCCCCCo......',
    '...oCCCCCCCCCCo......',
    '..oBBBBBBBBBBBBo.....',
    '..ohhhhhhhhhhhho.....',
    '.ohhHHHHHHHHHHhho....',
    '.ohhHHHHHHHHHHhho....',
    '.ohhhHHHHHHHHhhho....',
    'oeohhhHHHHHHhhhoeo...',
    'ooohhhhhhhhhhhhooo...',
    '...ooosssssssoo......',
    '.....osssssso........',
  ],
  pal: {
    o: '#26181c', H: '#c8c4bc', h: '#9a948c', I: '#eeeae2',
    S: '#f0b494', s: '#d68a70', L: '#fcd0b4', e: '#c07060', n: '#c8806a',
    C: '#2c3a5a', B: '#1c2238', g: '#e8b848', K: '#141824',
    W: '#dedad2', w: '#aaa49c', x: '#e89a8a',
  },
  anchor: [9, 13],
  eye: [11, 9],
  mouth: [16, 12],
  iris: ['#1e1418', '#4a6a8a'],
  browCol: '#eeeae2',
};

const AROHA: HeadDef = {
  style: 'girl',
  side: [
    '.......oooooo.......',
    '.....ooHHHHHHoo.....',
    '....oHIIIIIHHHHo....',
    '...oHIIHHHHHHHHHo...',
    '..oFFFFFFFFFFFFFFo..',
    '..oHHHHHHHHHHHHHHHo.',
    '.oHHHHHHHHHHhHHHhHo.',
    '.ohHHHHHHHhSSSSSSSo.',
    'ohHHHHHHhSSSSSSSSSo.',
    'ohHHHHHhSSSSSSSSSSo.',
    'ohHHHHhoeSSSSSSSSSSo',
    'ohHHHHhoeSSSSSSSSSSo',
    'ohHHHHHhosSSSSSSSSo.',
    'ohhHHHHHhosSSSSSSo..',
    'ohhHHHHHHhoosSSSo...',
    'ohhhHHHHHHho.osSo...',
    '.ohhHHHHHHhho.osSo..',
    '.ohhhHHHHHhhho......',
    '..ohhhHHHHhhhho.....',
    '...ohhhhHHhhhhho....',
    '....ohhohhhhohhho...',
    '.....o.oohhoo.o.....',
    '.........oo.........',
  ],
  back: [
    '.......oooooo........',
    '.....ooHHHHHHoo......',
    '....oHHIIHHHHHHo.....',
    '...oHHIHHHHHHHHHo....',
    '..oHHHHHHHHHHHHHHo...',
    '..oFFFFFFFFFFFFFFo...',
    '.ohHHHHHHHHHHHHHHho..',
    '.ohhHHHHHHHHHHHHhho..',
    '.ohhhHHHHHHHHHHhhho..',
    '.ohhhhHHHHHHHHhhhho..',
    '.ohhhhhhHHHHhhhhhho..',
    '.ohhhhhhhhhhhhhhhho..',
    '.ohhhhhhhhhhhhhhhho..',
    '..ohhhhhhhhhhhhhhoo..',
    '..ohhhhhhhhhhhhhho...',
    '...ohhhhhhhhhhhho....',
    '....ooohhhhhhooo.....',
    '.......oooooo........',
  ],
  pal: {
    o: '#1e1210', H: '#4e3022', h: '#36201a', d: '#201008', I: '#7a5034',
    S: '#c8885e', s: '#a86a44', L: '#dca070', e: '#8a5030', n: '#9a5c3a',
    F: '#d8b060',
  },
  anchor: [13, 16],
  eye: [13, 8],
  mouth: [17, 12],
  iris: ['#1a0c08', '#5a3420'],
  blush: '#d87060',
  browCol: '#1e1210',
};

export const HEADS: Record<AnimeId, HeadDef> = { mori: MORI, jenna: JENNA, joshu: JOSHU, aroha: AROHA };

// ------------------------------------------------------------------ expressions

interface EyeSet { rows: string[] }
/** eye overlays, origin = HeadDef.eye (x = back column of the eye, y = lash row) */
const EYES: Record<string, Record<string, string[]>> = {
  boy: {
    open: ['kkk', '.iw', '.iI'],
    wide: ['kkk', '.wi', '.wI'],
    half: ['...', 'kkk', '.iI'],
    closed: ['...', 'kkk', '...'],
    happy: ['.k.', 'k.k', '...'],
    squint: ['..k', 'kkk', '.iI'],
    sad: ['k..', 'kkk', '.iI'],
    tiny: ['kkk', 'w.w', 'wiw'],
  },
  girl: {
    open: ['kkkk', 'k.iw', '..iI', '..II'],
    wide: ['kkkk', '.wiw', '.wIw', '..w.'],
    half: ['....', 'kkkk', '..iI', '..II'],
    closed: ['....', '....', 'kkkk', '....'],
    happy: ['..k.', '.k.k', '....', '....'],
    squint: ['...k', 'kkkk', '..iI', '....'],
    sad: ['.k..', 'kkkk', '..iI', '..II'],
    tiny: ['kkkk', '.w.w', '.wiw', '..w.'],
  },
  old: {
    open: ['kkk', '.ik', '...'],
    wide: ['kkk', 'wiw', '...'],
    half: ['...', 'kkk', '...'],
    closed: ['...', 'kkk', '...'],
    happy: ['.k.', 'k.k', '...'],
    squint: ['..k', 'kkk', '...'],
    sad: ['k..', 'kkk', '...'],
    tiny: ['kkk', 'w.w', '...'],
  },
};

const MOUTHS: Record<string, string[]> = {
  line: ['mm'],
  smile: ['m.', '.m'],
  grin: ['MM', 'TT'],
  open: ['MM', 'MR'],
  o: ['.M', 'MM'],
  shout: ['MMM', 'MRR', '.RR'],
  frown: ['.m', 'm.'],
  grit: ['TT', 'TT'],
  wavy: ['m.m'],
  cat: ['m.m', '.m.'],
};

/** expression → [eye, brow(in, out), mouth, blush] */
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
export const HEAD_EXPRS = Object.keys(EXPR);

// ------------------------------------------------------------------ compose

const cache = new Map<string, C>();
const col = (h: string) => { let c = cache.get(h); if (c === undefined) { c = hex(h); cache.set(h, c); } return c; };

function stamp(b: PixelBuffer, rows: string[], x0: number, y0: number, pal: Record<string, string>, onlyOver = true) {
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.' || ch === ' ') continue;
      const x = x0 + i, y = y0 + j;
      if (onlyOver && !(b.get(x, y) >>> 24)) continue;
      const h = pal[ch];
      if (h) b.set(x, y, col(h));
    }
  });
}

/** Render a head. Returns the buffer and the neck anchor (in buffer pixels). */
export function renderAnimeHead(id: AnimeId, o: HeadOpts, view: 'side' | 'back' = 'side'): { buf: PixelBuffer; ax: number; ay: number } {
  const d = HEADS[id];
  const rows = view === 'back' ? d.back : d.side;
  const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const b = new PixelBuffer(W, H);
  const ex = EXPR[o.expr] ?? EXPR.neutral;
  const pal = { ...d.pal };
  if (ex.pale) { pal.S = '#e8d4c8'; pal.s = '#cdb4a8'; }
  stamp(b, rows, 0, 0, pal, false);
  if (d.wavy) {
    // flowing strands: gently curving highlight lines through the long hair
    const hc = col(pal.h), hl = col(pal.I), hm = col(pal.H);
    for (let y = 6; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (b.get(x, y) !== hc) continue;
        const w = Math.round(Math.sin(y * 0.55) * 1.4);
        const k = (x + w + Math.floor(y / 3)) % 5;
        if (k === 0) b.set(x, y, hl);
        else if (k === 1) b.set(x, y, hm);
      }
  }
  if (view === 'back') return { buf: b, ax: d.anchor[0], ay: d.anchor[1] };
  const lookY = o.look === 'up' ? -1 : o.look === 'down' ? 1 : 0;
  const skinDark = pal.s;
  const fp: Record<string, string> = {
    k: pal.o, w: '#ffffff', i: d.iris[0], I: d.iris[1], S: pal.S, s: skinDark,
    m: '#8a4040', M: '#5a1620', R: '#d05a6a', T: '#fbf6ee',
  };
  // eyes
  const eyeSet = EYES[d.style] ?? EYES.boy;
  const eyeName = o.blink && ex.eye !== 'happy' && ex.eye !== 'closed' ? 'closed' : ex.eye;
  const [exx, eyy] = d.eye;
  // clear the eye box to skin first (templates may have hair tips around)
  stamp(b, eyeSet[eyeName] ?? eyeSet.open, exx, eyy + lookY, fp);
  // brows only for strong expressions (they hide under bangs otherwise)
  if (ex.bIn !== 0 || ex.bOut !== 0) {
    const by = eyy - 1 + lookY;
    const bc = d.browCol;
    const yIn = by - Math.sign(ex.bIn), yOut = by - Math.sign(ex.bOut);
    if (b.get(exx, yOut) >>> 24) b.set(exx, yOut, col(bc));
    if (b.get(exx + 2, yIn) >>> 24) b.set(exx + 2, yIn, col(bc));
    if (b.get(exx + 1, Math.round((yIn + yOut) / 2)) >>> 24) b.set(exx + 1, Math.round((yIn + yOut) / 2), col(bc));
  }
  // glasses: rounded frames around the eye (corners open), lens glint, temple arm back to the ear
  if (d.glasses) {
    const g = col(d.glasses);
    const gx = exx, gy = eyy + lookY;
    const put = (x: number, y: number, c: C) => { if (b.get(x, y) >>> 24) b.set(x, y, c); };
    put(gx + 1, gy, g); put(gx + 2, gy, g); put(gx + 1, gy + 3, g); put(gx + 2, gy + 3, g);
    put(gx, gy + 1, g); put(gx, gy + 2, g); put(gx + 3, gy + 1, g); put(gx + 3, gy + 2, g);
    for (let i = 1; i <= 3; i++) put(gx - i, gy + 1, g);
    if (!o.blink && ex.eye !== 'happy' && ex.eye !== 'closed') put(gx + 2, gy + 1, col('#ffffff'));
  }
  // blush
  if (ex.blush) { const [mx, my] = d.mouth; for (const [x, y] of [[mx - 3, my - 2], [mx - 2, my - 2]]) if (b.get(x, y) >>> 24) b.set(x, y, col(d.blush ?? '#f09088')); }
  // mouth
  let mname = ex.mouth;
  if (o.mouth === 1 && (mname === 'line' || mname === 'smile' || mname === 'frown' || mname === 'wavy')) mname = 'open';
  if (o.mouth === 2 && mname !== 'grit') mname = mname === 'o' || mname === 'shout' ? 'shout' : 'grin';
  const mr = MOUTHS[mname] ?? MOUTHS.line;
  const [mx, my] = d.mouth;
  stamp(b, mr, mx - mr[0].length + 1, my + (mr.length > 1 ? 0 : 0), fp);
  // sweat drop
  if (ex.sweat) { const x = W - 2, y = 3; if (x >= 0) { b.set(x, y, col('#7cc4f0')); b.set(x, y + 1, col('#4f9fd8')); } }
  return { buf: b, ax: d.anchor[0], ay: d.anchor[1] };
}

export type { EyeSet };

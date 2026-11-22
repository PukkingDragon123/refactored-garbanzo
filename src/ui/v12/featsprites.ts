// V12 the feat medals as hand-made pixel art. Each is a 16 x 16 sprite placed pixel by pixel from a
// small hand-picked palette, in the HUD kit's manner (./kitsprites.ts, ./kitpix.ts): a dark outline,
// two or three tones a material and a glint, and a ribbon of two straps folding in behind the disc.
// The rim is lit from the top left and falls into shadow bottom right; the emblem on the face is
// raised (its lit face, a glint on its top-left edge, the shadow it casts down and to the right).
//   bronze   copper on a red ribbon, a kiwi's track pressed in it
//   silver   a feather, on navy
//   gold     a star, on green with a gold stripe
//   legend   a pounamu face set in gold, a koru unfurling on it, on black with a red stripe
//   blank    a locked feat: the medal's shape embossed blind into the paper
//   hidden   the same blank with a question mark pressed up through it
// Drawn at a whole number of device px per sprite pixel (the notebook's own pixels, or the canvas).
//   '.' = transparent; every other character is a colour in FEAT_PAL.

import { Art, col, dith } from '../v11/paper/px';

export type MedalKind = 'bronze' | 'silver' | 'gold' | 'legend' | 'blank' | 'hidden';
export const MEDAL_N = 16;

export const FEAT_PAL: Record<string, string> = {
  'k': '#1a120c',
  // bronze, silver, gold: dark, mid, light, glint
  'b': '#4a2410', 'c': '#8a4a20', 'd': '#c47c3c', 'e': '#f2bc7c',
  's': '#46505c', 't': '#8a96a2', 'u': '#c6d0da', 'v': '#ffffff',
  'g': '#74460c', 'h': '#c48c1c', 'i': '#f0c844', 'j': '#fff2ac',
  // pounamu, the legend's face
  'J': '#0a3020', 'K': '#1a6040', 'L': '#389464', 'M': '#94dcb0',
  // the ribbons: dark, body, stripe
  'q': '#561410', 'r': '#a4301c', 'R': '#e86c46',
  'n': '#12285a', 'o': '#2a56a4', 'O': '#86b6ee',
  'w': '#1a3814', 'x': '#3a7628', 'X': '#f0c844',
  'y': '#0a0a12', 'z': '#22303e', 'Z': '#d83c2a',
  // the embossed blank: its pressed edge, shade, face, the light on it
  'p': '#a08a60', 'P': '#c4ae84', 'Q': '#ddceaa', 'S': '#f8eed6',
};

export const MEDAL_SPR: Record<MedalKind, string[]> = {
  bronze: [
    '.kkkkk....kkkkk.',
    '.krRrk....kqRqk.',
    '..krRrk..kqRqk..',
    '...krRrkkqRqk...',
    '....kkkkkkkk....',
    '....kdeeddck....',
    '...kdecebcdck...',
    '..kddebdbebdck..',
    '..kdccdddbbcbk..',
    '..kdccdddbccbk..',
    '..kdcccdbbccbk..',
    '..kccccdbcccbk..',
    '..kcbcccbccbbk..',
    '...kcbccccbbk...',
    '....kbbbbbbk....',
    '.....kkkkkk.....',
  ],
  silver: [
    '.kkkkk....kkkkk.',
    '.koOok....knOnk.',
    '..koOok..knOnk..',
    '...koOokknOnk...',
    '....kkkkkkkk....',
    '....kuvvuutk....',
    '...kuvttttutk...',
    '..kuutttttvutk..',
    '..kutttttvussk..',
    '..kuttttvuussk..',
    '..kutttvuusssk..',
    '..ktttvussstsk..',
    '..ktsvsssttssk..',
    '...ktsstttssk...',
    '....kssssssk....',
    '.....kkkkkk.....',
  ],
  gold: [
    '.kkkkk....kkkkk.',
    '.kxXxk....kwXwk.',
    '..kxXxk..kwXwk..',
    '...kxXxkkwXwk...',
    '....kkkkkkkk....',
    '....kijjiihk....',
    '...kijhjigihk...',
    '..kiihhiighihk..',
    '..kijiiiiiiigk..',
    '..kihiiiiiiggk..',
    '..kihhiiiigggk..',
    '..khhjiggiiggk..',
    '..khgighhhiggk..',
    '...khgghhhggk...',
    '....kggggggk....',
    '.....kkkkkk.....',
  ],
  legend: [
    '.kkkkk....kkkkk.',
    '.kzZzk....kyZyk.',
    '..kzZzk..kyZyk..',
    '...kzZzkkyZyk...',
    '....kkkkkkkk....',
    '....kijjiihk....',
    '...kijKKKKihk...',
    '..kiiKMLLLJihk..',
    '..kiKMKJJJMLgk..',
    '..kiKLJMLKLJgk..',
    '..kiKLJLJJLJgk..',
    '..khKLJKMLLJgk..',
    '..khgKMKKJJggk..',
    '...khgLJKKggk...',
    '....kggggggk....',
    '.....kkkkkk.....',
  ],
  blank: [
    '.ppppp....ppppp.',
    '.pQSQp....pPSPp.',
    '..pQSQp..pPSPp..',
    '...pQSQppPSPp...',
    '....pppppppp....',
    '....pQSSQQQp....',
    '...pQSQQQQQPp...',
    '..pQQQQQQQQQQp..',
    '..pSQQQQQQQQPp..',
    '..pSQQQQQQQQPp..',
    '..pSQQQQQQQQPp..',
    '..pQQQQQQQQQPp..',
    '..pQPQQQQQQPPp..',
    '...pQPQQQQPPp...',
    '....pPPPPPPp....',
    '.....pppppp.....',
  ],
  hidden: [
    '.ppppp....ppppp.',
    '.pQSQp....pPSPp.',
    '..pQSQp..pPSPp..',
    '...pQSQppPSPp...',
    '....pppppppp....',
    '....pQSSQQQp....',
    '...pQSQSSPQPp...',
    '..pQQQSQQSPQQp..',
    '..pSQQQPQSPQPp..',
    '..pSQQQQSPPQPp..',
    '..pSQQQQSPQQPp..',
    '..pQQQQQPPQQPp..',
    '..pQPQQQSPQPPp..',
    '...pQPQQPPPPp...',
    '....pPPPPPPp....',
    '.....pppppp.....',
  ],
};

const C: Record<string, number> = {};
for (const k of Object.keys(FEAT_PAL)) C[k] = col(FEAT_PAL[k]);
/** the tier's ink (titles, accents) */
export const TIER_INK: Record<'bronze' | 'silver' | 'gold' | 'legend', string> = { bronze: '#a4501c', silver: '#5a6878', gold: '#b07a10', legend: '#1a6040' };
/** the colour a floating notice is accented with */
export const TIER_ACCENT: Record<'bronze' | 'silver' | 'gold' | 'legend', string> = { bronze: '#f2a868', silver: '#d6e2ee', gold: '#ffd84a', legend: '#94dcb0' };

/**
 * Paint a medal into `a` with its top-left at (x, y), `k` art px per sprite pixel (a whole number).
 * glint: 0..1 a sweep of light across the metal (-1 none); drop: sprite px it is lifted (a shadow
 * stays under it on the paper).
 */
export function paintMedal(a: Art, kind: MedalKind, x: number, y: number, o: { k?: number; glint?: number; drop?: number; shadow?: boolean } = {}) {
  const k = Math.max(1, Math.round(o.k ?? 1));
  const spr = MEDAL_SPR[kind];
  const lift = Math.max(0, Math.round(o.drop ?? 0));
  // its shadow on the paper, a pixel down and right of where it rests (dithered, never soft)
  if (o.shadow !== false && kind !== 'blank' && kind !== 'hidden') {
    const sh = col('#1e1406', 0.5);
    for (let j = 0; j < MEDAL_N; j++) for (let i = 0; i < MEDAL_N; i++) {
      if (spr[j][i] === '.') continue;
      for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) {
        const px = x + (i + 1) * k + u, py = y + (j + 1) * k + v;
        if (dith(px, py, lift ? 0.35 : 0.6)) a.px(px, py, sh);
      }
    }
  }
  const g = o.glint ?? -1;
  for (let j = 0; j < MEDAL_N; j++) for (let i = 0; i < MEDAL_N; i++) {
    const ch = spr[j][i];
    if (ch === '.') continue;
    let c = C[ch];
    // a diagonal band of light across the metal (not the outline or the ribbon)
    if (g >= 0 && j >= 5 && ch !== 'k') {
      const band = (i + j * 0.7) / 26 - (g * 1.4 - 0.2);
      if (Math.abs(band) < 0.03) c = C.v;
      else if (Math.abs(band) < 0.07 && 'bcghstJKL'.includes(ch)) c = C[{ b: 'c', c: 'd', g: 'h', h: 'i', s: 't', t: 'u', J: 'K', K: 'L', L: 'M' }[ch] as string];
    }
    for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) a.put(x + i * k + u, y + (j - lift) * k + v, c);
  }
}

const cache = new Map<string, Art>();
/** a medal as its own little Art (cached), k art px per sprite pixel, with its shadow */
export function medalArt(kind: MedalKind, k = 1): Art {
  const key = kind + k;
  let a = cache.get(key);
  if (!a) {
    a = new Art((MEDAL_N + 1) * k, (MEDAL_N + 1) * k);
    paintMedal(a, kind, 0, 0, { k });
    cache.set(key, a);
  }
  return a;
}

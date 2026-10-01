// V4 portraits: Stardew-Valley-style front-facing busts (56x60) drawn in the anime style of the
// sprites. Hair, face and clothes are smooth shapes with flat 3-4 tone cel shading and dark
// outlines (portrait kit); eyes, brows and mouths are hand-placed pixel templates per expression,
// mirrored for the two eyes, so faces stay crisp, cute and readable at 2-4x.

import { PixelBuffer } from '../pixel';
import { Pic, Pt, tones } from '../portrait/kit';
import { hex, mix, shade, C } from '../color';
import { outfitOf } from '../v7/wardrobe';
import { PORTRAIT_WEAR } from './portrait-wear';

export const PW = 56, PH = 60;
const CX = 28;

type Tone = [C, C, C, C];
const T = (h: string, o: Parameters<typeof tones>[1] = {}): Tone => tones(h, o);

interface Mats { skin: number; neck: number; hair: number; cloth: number; cloth2: number; acc: number; beard: number; hairB: number }

interface Design {
  skin: Tone;
  /** face half-width scale and chin drop */
  faceW?: number;
  chin?: number;
  /** the right half of a custom face outline (top centre → chin centre); mirrored for the left */
  jaw?: Pt[];
  /** neck half-widths (under the jaw, at the collar) and an Adam's apple */
  neck?: [number, number];
  adam?: boolean;
  /** mouth line colour (else a rosy lip tone), and a darker open mouth */
  lip?: string;
  /** blush strength (1 = the default pink patch) */
  blushK?: number;
  /** brows: extra gap below the default line (design px, + = lower, nearer the eye) and HD arch (px) */
  browDrop?: number;
  browArch?: number;
  /** nose: a longer bridge shadow (HD) */
  noseBridge?: boolean;
  /** light stubble over the jaw, chin and upper lip (HD) */
  stubble?: string;
  /** the lit cheek patch: centre (design units) and radii */
  cheek?: [number, number, number, number];
  /** a weathered face: a furrow between the brows, crow's feet, bags under the eyes (HD) */
  weathered?: boolean;
  /** added to every expression's inner-brow tilt (negative: a permanent scowl) */
  browBias?: number;
  eyes: 'young' | 'girl' | 'old' | 'pug' | 'man' | 'fierce';
  iris: [string, string, string];
  lash: string;
  brow: string;
  /** brow thickness (px) */
  browH?: number;
  blush?: string;
  /** always a faint blush (cute) */
  rosy?: boolean;
  back?(p: Pic, m: Mats): void;
  body(p: Pic, m: Mats): void;
  front(p: Pic, m: Mats): void;
  /** pixel details after the outline pass */
  post?(b: PixelBuffer, e: ExprDef, talk: 0 | 1 | 2): void;
  /** the same details for the 2x close-up bust */
  postHD?(b: PixelBuffer, S: number, e: ExprDef): void;
  /** eye centre rows/cols (viewer-left eye x, y) */
  eyeX?: number;
  eyeY?: number;
  mouthY?: number;
  /** no human face (Chunk) */
  custom?: (p: Pic, m: Mats) => void;
}

// ------------------------------------------------------------------ shared face

function mats(p: Pic): Mats {
  return {
    hairB: p.m(2, true, 0.5), neck: p.m(1, true, 0.5), skin: p.m(1, true, 0.5), cloth: p.m(3, true, 0.5), cloth2: p.m(4, true, 0.5),
    acc: p.m(5, true, 0.5), beard: p.m(6, true, 0.45), hair: p.m(2, true, 0.5),
  };
}

function faceShape(d: Design): Pt[] {
  const w = d.faceW ?? 1, ch = d.chin ?? 0;
  if (d.jaw) {
    // right half top → chin, then mirrored back up the left
    const R = d.jaw;
    return [...R, ...R.slice(1, -1).reverse().map(([u, v]): Pt => [2 * CX - u, v])];
  }
  const pts: Pt[] = [
    [CX, 11], [CX + 11 * w, 12.5], [CX + 13.2 * w, 18], [CX + 13.4 * w, 25], [CX + 12.2 * w, 31], [CX + 9 * w, 36 + ch * 0.4],
    [CX + 4.6 * w, 40 + ch], [CX, 41.8 + ch],
    [CX - 4.6 * w, 40 + ch], [CX - 9 * w, 36 + ch * 0.4], [CX - 12.2 * w, 31], [CX - 13.4 * w, 25], [CX - 13.2 * w, 18], [CX - 11 * w, 12.5],
  ];
  return pts;
}

function drawFace(p: Pic, m: Mats, d: Design) {
  const [sd, ss, sb, sl] = d.skin;
  const w = d.faceW ?? 1;
  // neck (its own material so the chin shadow stays on the neck)
  const [n0, n1] = d.neck ?? [4.8, 5.4];
  p.fill([[CX - n0, 36], [CX + n0, 36], [CX + n1, 49], [CX - n1, 49]], sb, m.neck, { sharp: true });
  p.where([m.neck], (u, v) => v < 42.6 + (d.chin ?? 0) || u > CX + n0 - 1.6, ss);
  if (d.adam) {
    // the Adam's apple: a small lit bump in the throat with its shadow under it, and the neck's cords
    p.where([m.neck], (u, v) => (u - CX + 0.3) ** 2 / 1.2 + (v - 44.4) ** 2 / 1.4 < 1, sb);
    p.where([m.neck], (u, v) => (u - CX + 0.6) ** 2 / 0.45 + (v - 44.1) ** 2 / 0.6 < 1, sl);
    p.where([m.neck], (u, v) => Math.abs(u - CX - 0.2) < 1.1 && Math.abs(v - 45.8) < 0.45, ss);
    p.where([m.neck], (u, v) => v > 43.4 && Math.abs(u - (CX - n0 + 1.3 + (v - 43.4) * 0.55)) < 0.4, ss);
  }
  // ears
  p.ell(CX - 13.4 * w, 26.5, 2.6, 3.8, sb, m.skin);
  p.ell(CX + 13.4 * w, 26.5, 2.6, 3.8, sb, m.skin);
  p.where([m.skin], (u, v) => Math.abs(Math.abs(u - CX) - 13.7 * w) < 1 && v > 25 && v < 29, ss);
  // face
  p.fill(faceShape(d), sb, m.skin);
  // cel shading: shadow down the right side of the face and along the jaw
  p.where([m.skin], (u, v) => {
    const r = (u - CX) / (13.4 * w);
    return (r > 0.74 && v > 17 && v < 34) || (r > 0.5 && v > 33.5);
  }, ss);
  // soft light on the left cheek (a man's cheekbone: higher and narrower)
  const [cu, cv, crx, cry] = d.cheek ?? [CX - 8, 31, 3, 2];
  p.where([m.skin], (u, v) => (u - cu) ** 2 / (crx * crx) + (v - cv) ** 2 / (cry * cry) < 1, sl);
  void sd;
}

// ------------------------------------------------------------------ expressions

interface ExprDef { eye: string; brow: number; browIn: number; mouth: string; blush?: boolean; sweat?: boolean; pale?: boolean; tear?: boolean; lines?: boolean }
const EXPR: Record<string, ExprDef> = {
  neutral: { eye: 'open', brow: 0, browIn: 0, mouth: 'smallSmile' },
  happy: { eye: 'happy', brow: 1, browIn: 0, mouth: 'smile', blush: true },
  laugh: { eye: 'happy', brow: 1, browIn: 0, mouth: 'laugh', blush: true },
  excited: { eye: 'sparkle', brow: 1, browIn: 1, mouth: 'grin', blush: true },
  surprised: { eye: 'wide', brow: 2, browIn: 0, mouth: 'o' },
  shocked: { eye: 'tiny', brow: 2, browIn: 1, mouth: 'shout', pale: true, sweat: true, lines: true },
  angry: { eye: 'angry', brow: -1, browIn: -2, mouth: 'grit' },
  grumpy: { eye: 'half', brow: 0, browIn: -1, mouth: 'frown' },
  sad: { eye: 'sad', brow: 1, browIn: 2, mouth: 'frown' },
  worried: { eye: 'open', brow: 1, browIn: 2, mouth: 'wavy', sweat: true },
  scared: { eye: 'tiny', brow: 2, browIn: 2, mouth: 'wavy', pale: true, sweat: true },
  thinking: { eye: 'side', brow: 1, browIn: -1, mouth: 'pout' },
  tired: { eye: 'half', brow: 0, browIn: 1, mouth: 'line' },
  teasing: { eye: 'wink', brow: 1, browIn: 0, mouth: 'cat', blush: true },
  serious: { eye: 'open', brow: 0, browIn: -1, mouth: 'line' },
  smug: { eye: 'half', brow: 1, browIn: -1, mouth: 'smirk' },
  determined: { eye: 'angry', brow: 0, browIn: -1, mouth: 'grin' },
  sleep: { eye: 'closed', brow: 0, browIn: 0, mouth: 'line' },
  eat: { eye: 'happy', brow: 1, browIn: 0, mouth: 'chew', blush: true },
  injured: { eye: 'pain', brow: 1, browIn: 2, mouth: 'grit', sweat: true },
  cry: { eye: 'sad', brow: 1, browIn: 2, mouth: 'wavy', tear: true },
  wow: { eye: 'sparkle', brow: 2, browIn: 0, mouth: 'o', blush: true },
};
export const PORTRAIT_EXPRS = Object.keys(EXPR);

// eye templates for the viewer-RIGHT eye (outer corner on the right); mirrored for the left.
// k lash, w white, I iris dark, i iris, j iris light, G glint, s lid shadow (skin), '.' keep
const EYES: Record<string, Record<string, string[]>> = {
  young: {
    open: ['.kkkkk', 'kwIIGk', '.wIiiw', '.wjjj.', '..ss..'],
    wide: ['.kkkk.', 'kwIIGw', 'wwIiiw', '.wjjw.', '..kk..'],
    half: ['......', '.kkkkk', 'kwIIik', '.wjjj.', '..ss..'],
    closed: ['......', '......', 'kkkkkk', '.ssss.', '......'],
    happy: ['......', '..kk..', '.k..k.', 'k....k', '......'],
    sad: ['......', '..kkkk', '.kIIGk', '.wiij.', '..ss..'],
    tiny: ['.kkkk.', 'kwwwww', 'wwwIww', '.wwww.', '..kk..'],
    angry: ['kk....', '.kkkkk', '.wIIGk', '.wjjj.', '..ss..'],
    side: ['.kkkkk', 'kwwIGk', '.wwIiw', '.wwjj.', '..ss..'],
    wink: ['......', '..kk..', '.k..k.', 'k....k', '......'],
    sparkle: ['.kkkkk', 'kwGIGk', '.wIGiw', '.wjGj.', '..ss..'],
    pain: ['......', 'k....k', '.k..k.', '..kk..', '......'],
  },
  girl: {
    open: ['.kkkkkk', 'kkIIIGk', '.wIIiGw', '.wiiij.', '.wjjjj.', '..sss..'],
    wide: ['..kkkk.', '.kIIIGk', 'wwIiiGw', 'wwiiijw', '.wjjjj.', '..kkk..'],
    half: ['.......', '.kkkkkk', 'kkIIIGk', '.wiiij.', '.wjjjj.', '..sss..'],
    closed: ['.......', '.......', '.......', 'kkkkkkk', '.sssss.', '.......'],
    happy: ['.......', '.......', '..kkk..', '.k...k.', 'k.....k', '.......'],
    sad: ['.......', '...kkkk', '.kkIIGk', '.wIiiGw', '.wjjjj.', '..sss..'],
    tiny: ['.kkkkk.', 'kwwwwwk', 'wwwIwww', 'wwwwwww', '.wwwww.', '..kkk..'],
    angry: ['kk.....', '.kkkkkk', '.kIIIGk', '.wiiijw', '.wjjjj.', '..sss..'],
    side: ['.kkkkkk', 'kkwIIGk', '.wwIiGw', '.wwiij.', '.wwjjj.', '..sss..'],
    wink: ['.......', '.......', '..kkk..', '.k...k.', 'k.....k', '.......'],
    sparkle: ['.kkkkkk', 'kkGIIGk', '.wIGiGw', '.wiGij.', '.wjjjj.', '..sss..'],
    pain: ['.......', 'k.....k', '.k...k.', '..kkk..', '.......', '.......'],
  },
  // a young man: narrower, sharper eyes, the upper lid slanting down to the inner corner and cutting
  // the top of a smaller iris, no lashes flicking out, only a hint of the lower lid
  man: {
    open: ['..kkkk', '.kwIGk', '.wwIiw', '...ss.'],
    wide: ['.kkkkk', 'kwwIGk', '.wwIiw', '..sss.'],
    half: ['......', '.kkkkk', '.wwIik', '...ss.'],
    closed: ['......', '......', '.kkkkk', '...ss.'],
    happy: ['......', '..kkk.', '.k...k', '......'],
    sad: ['......', '.kkk..', '.kwIGk', '..wiw.'],
    tiny: ['..kkk.', '.kwwwk', '.wwIw.', '..ss..'],
    angry: ['k.....', '.kkkkk', '.kwIGk', '...ss.'],
    side: ['..kkkk', '.kwwIG', '.wwwIi', '...ss.'],
    wink: ['......', '..kkk.', '.k...k', '......'],
    sparkle: ['..kkkk', '.kwGIG', '.wwIGw', '...ss.'],
    pain: ['......', 'k....k', '.k..k.', '..kk..'],
  },
  // a hard old sea dog: always squinting, a heavy lid over a sliver of pale iris, bags beneath
  fierce: {
    open: ['.kkkkk', 'kkIGkk', '..sss.'],
    wide: ['.kkkk.', 'kwIGwk', '..ss..'],
    half: ['......', 'kkkkkk', '.kIGk.'],
    closed: ['......', 'kkkkkk', '..ss..'],
    happy: ['......', '.kkkk.', 'k....k'],
    sad: ['..kkkk', '.kkIGk', '..sss.'],
    tiny: ['.kkkk.', 'kwwIwk', '..ss..'],
    angry: ['kk....', '.kkkkk', '.kIGkk'],
    side: ['.kkkkk', 'kkkIGk', '..sss.'],
    wink: ['......', '.kkkk.', 'k....k'],
    sparkle: ['.kkkkk', 'kkGIGk', '..sss.'],
    pain: ['......', 'k....k', '.kkkk.'],
  },
  old: {
    open: ['......', '.kkkk.', 'kwIGwk', '..ss..'],
    wide: ['.kkkk.', 'kwIGwk', '.wwww.', '..ss..'],
    half: ['......', '......', 'kkkkkk', '.wIG..'],
    closed: ['......', '......', 'kkkkkk', '......'],
    happy: ['......', '..kk..', '.k..k.', 'k....k'],
    sad: ['......', '...kkk', '.kkIGk', '..ss..'],
    tiny: ['.kkkk.', 'kwwIwk', '.wwww.', '..ss..'],
    angry: ['kk....', '.kkkkk', '.wIGk.', '..ss..'],
    side: ['......', '.kkkk.', 'kwwIGk', '..ss..'],
    wink: ['......', '..kk..', '.k..k.', 'k....k'],
    sparkle: ['.kkkk.', 'kwGIGk', '.wwww.', '..ss..'],
    pain: ['......', 'k....k', '.k..k.', '..kk..'],
  },
};

// mouths, centred on the mouth point. k dark line, m lip, M mouth dark, R tongue, T teeth, s skin shadow
const MOUTHS: Record<string, string[]> = {
  line: ['.mmm.'],
  smallSmile: ['m...m', '.mmm.'],
  smile: ['k....k', '.kMMk.', '..kk..'],
  laugh: ['kkkkkk', 'kTTTTk', 'kMMMMk', '.kRRk.', '..kk..'],
  grin: ['kkkkkk', 'kTTTTk', '.kkkk.'],
  o: ['.kk.', 'kMMk', 'kRRk', '.kk.'],
  shout: ['.kkkk.', 'kTTTTk', 'kMMMMk', 'kMRRMk', '.kkkk.'],
  grit: ['kkkkkk', 'kTkTkT', 'kkkkkk'],
  frown: ['.mmm.', 'm...m'],
  wavy: ['.m.m.', 'm.m.m'],
  pout: ['.mm.', 'm..m'],
  cat: ['m.m.m', '.m.m.'],
  smirk: ['....m', '.mmm.'],
  chew: ['.kkk.', 'kMRMk', '.kkk.'],
  talk1: ['.kkk.', 'kMRMk', '.kkk.'],
  talk2: ['.kkkk.', 'kMMMMk', 'kMRRMk', '.kkkk.'],
};

const cc = new Map<string, C>();
const col = (h: string) => { let c = cc.get(h); if (c === undefined) { c = hex(h); cc.set(h, c); } return c; };

function stampT(b: PixelBuffer, rows: string[], x0: number, y0: number, pal: Record<string, C>, mirror = false, onlyOver = true) {
  const w = Math.max(...rows.map(r => r.length));
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.') continue;
      const c = pal[ch];
      if (c === undefined) continue;
      const x = mirror ? x0 + (w - 1 - i) : x0 + i, y = y0 + j;
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
      if (onlyOver && !(b.get(x, y) >>> 24)) continue;
      b.set(x, y, c);
    }
  });
}

/** mouth template colours: a rosy lip line by default, or the design's own (a man's mouth has no lipstick) */
function mouthPal(d: Design, skin: Tone): Record<string, C> {
  if (d.lip) return { k: shade(skin[0], -0.3), m: col(d.lip), M: col('#2c0e10'), R: col('#6e2e2c'), T: col('#f0e8dc'), s: skin[1] };
  return { k: shade(skin[0], -0.35), m: mix(skin[0], col('#8a3040'), 0.35), M: col('#5a1a26'), R: col('#e0707e'), T: col('#fbf6ee'), s: skin[1] };
}

function drawFeatures(b: PixelBuffer, d: Design, e: ExprDef, talk: 0 | 1 | 2, blink: boolean) {
  const skin = e.pale ? T('#e6d2c6') : d.skin;
  const set = EYES[d.eyes === 'pug' ? 'young' : d.eyes];
  const eyeName = blink && e.eye !== 'happy' && e.eye !== 'closed' && e.eye !== 'wink' && e.eye !== 'pain' ? 'closed' : e.eye;
  const tpl = set[eyeName] ?? set.open;
  const ew = Math.max(...tpl.map(r => r.length));
  const ex = d.eyeX ?? 17, ey = d.eyeY ?? 26;
  const lash = col(d.lash);
  const pal: Record<string, C> = {
    k: lash, w: col('#ffffff'), I: col(d.iris[0]), i: col(d.iris[1]), j: col(d.iris[2]), G: col('#ffffff'), s: skin[1],
  };
  // viewer-left eye (character's right) is the mirror of the template; outer corner at the left
  const lx = ex, rx = PW - ex - ew;
  if (e.eye === 'wink') {
    stampT(b, (set.open), lx, ey, pal, true);
    stampT(b, tpl, rx, ey, pal, false);
  } else {
    stampT(b, tpl, lx, ey, pal, true);
    stampT(b, tpl, rx, ey, pal, false);
  }
  // brows: 5 px strokes, inner end raised/lowered by browIn, whole brow by brow
  const bc = col(d.brow);
  const bh = d.browH ?? 1;
  const by = ey - 3 - Math.max(0, e.brow) + (e.brow < 0 ? 1 : 0) + Math.floor(d.browDrop ?? 0);
  for (let i = 0; i < ew; i++) {
    const tIn = i / (ew - 1); // 0 outer → 1 inner (for the right eye inner is at i=0)
    const bIn = e.browIn + (d.browBias ?? 0);
    const off = Math.round(-(bIn * (1 - tIn)) * 0.5);
    const offL = Math.round(-(bIn * tIn) * 0.5);
    for (let k = 0; k < bh; k++) {
      // right eye brow: inner end at the left (i = 0)
      const yR = by + off + k, yL = by + offL + k;
      if (b.get(rx + i, yR) >>> 24) b.set(rx + i, yR, bc);
      if (b.get(lx + i, yL) >>> 24) b.set(lx + i, yL, bc);
    }
  }
  // nose: a single shadow pixel pair (a longer one down the bridge)
  const ny = ey + (d.eyes === 'old' || d.eyes === 'fierce' ? 7 : 8);
  if (d.noseBridge) b.set(CX, ny - 2, mix(skin[1], skin[2], 0.5));
  b.set(CX, ny, skin[1]);
  b.set(CX - 1, ny + 1, skin[1]);
  // blush
  const blush = d.blush ?? '#f4a0a0';
  const bk = d.blushK ?? 1;
  if ((e.blush || d.rosy) && bk > 0) {
    const bcol = e.blush ? mix(skin[2], col(blush), Math.min(1, bk)) : mix(skin[2], col(blush), 0.45 * bk);
    for (const [x, y] of (bk < 1 ? [[ex + 2, ey + ew], [ex + 3, ey + ew]] : [[ex + 1, ey + ew - 0], [ex + 2, ey + ew - 0], [ex + 3, ey + ew - 0]])) {
      if (b.get(x, y) >>> 24) b.set(x, y, bcol);
      const x2 = PW - 1 - x;
      if (b.get(x2, y) >>> 24) b.set(x2, y, bcol);
    }
  }
  // mouth
  let mn = e.mouth;
  if (talk === 1) mn = mn === 'laugh' || mn === 'shout' ? mn : 'talk1';
  if (talk === 2) mn = mn === 'laugh' || mn === 'shout' || mn === 'grin' ? mn : 'talk2';
  const mt = MOUTHS[mn] ?? MOUTHS.line;
  const mw = Math.max(...mt.map(r => r.length));
  const my = d.mouthY ?? ey + 12;
  stampT(b, mt, CX - Math.floor(mw / 2), my, mouthPal(d, skin));
  if (e.sweat) {
    const x = PW - ex - 1, y = ey - 4;
    b.set(x, y, col('#bfe6ff')); b.set(x, y + 1, col('#7cc4f0')); b.set(x - 1, y + 1, col('#7cc4f0')); b.set(x, y + 2, col('#4f9fd8'));
  }
  if (e.tear) { const x = ex + 1, y = ey + 5; b.set(x, y, col('#9ad8ff')); b.set(x, y + 1, col('#5ab0f0')); }
  if (e.lines) {
    // shock lines under the eyes
    for (let i = 0; i < 4; i++) { const x = ex + 1 + i, y = ey + ew + 1; if (i % 2 === 0 && b.get(x, y) >>> 24) b.set(x, y, skin[0]); const x2 = PW - 1 - x; if (i % 2 === 0 && b.get(x2, y) >>> 24) b.set(x2, y, skin[0]); }
  }
}

// ------------------------------------------------------------------ cast

// Mori: a young man, handsome but unmistakably masculine: a square jaw and a broad chin with a
// shadow of stubble, a thick neck with an Adam's apple, broad square shoulders, narrower sharp eyes
// under heavy straight brows, a longer nose, no blush or lip colour, short spiky hair off the brows
const MORI: Design = {
  skin: T('#f0ac7a', { sh: 0.13, deep: 0.3, hi: 0.06 }),
  eyes: 'man', iris: ['#140a08', '#5a3220', '#9a6038'], lash: '#1e1216', brow: '#2a1a16', browH: 2, browDrop: 0.6, browArch: 0.5,
  eyeX: 17, eyeY: 25, mouthY: 37,
  jaw: [[CX, 11], [CX + 11.4, 12.4], [CX + 13.5, 17.6], [CX + 13.7, 24.4], [CX + 13.2, 29.6], [CX + 12.2, 33.4], [CX + 10, 37], [CX + 6.8, 40], [CX + 3.8, 41.5], [CX, 41.9]],
  neck: [6.4, 7.4], adam: true, lip: '#b0664a', blushK: 0.3, noseBridge: true, stubble: '#5e4a52',
  cheek: [CX - 8.6, 29.2, 2.8, 1.3],
  back(p, m) {
    const [hd, hs, hb] = T('#2e2426', { sh: 0.2, deep: 0.36 });
    // short hair: the crown and back of the head, spiky on top, cropped above the ears
    p.fill([[CX - 13.8, 24], [CX - 15.4, 16], [CX - 13.4, 8.6], [CX - 8.4, 4], [CX - 1, 2.2], [CX + 6.4, 3], [CX + 12, 6.6], [CX + 15.4, 13], [CX + 15.6, 20], [CX + 14, 24.4], [CX + 11, 20], [CX - 11, 20]], hb, m.hairB);
    p.where([m.hairB], (u, v) => v > 19 || u > CX + 11, hs);
    void hd;
  },
  body(p, m) {
    const shirt = T('#453a3a'), vest = T('#5b4b4b', { sh: 0.18 }), strap = T('#744830');
    // broad square shoulders, the trapezius sloping hard off a thick neck
    p.fill([[-3, 60], [-1.4, 52.6], [3, 49], [11, 47], [CX - 8.4, 45.8], [CX, 45.6], [CX + 8.4, 45.8], [PW - 11, 47], [PW - 3, 49], [PW + 1.4, 52.6], [PW + 3, 60]], vest[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 15 || v > 57.4, vest[1]);
    // the fold of the sleeve seam at each shoulder
    p.where([m.cloth], (u, v) => Math.abs(u - (6.4 - (v - 49.4) * 0.2)) < 0.5 && v > 49.8, vest[1]);
    p.where([m.cloth], (u, v) => Math.abs(u - (PW - 6.4 + (v - 49.4) * 0.2)) < 0.5 && v > 49.8, vest[0]);
    // shirt collar open at the throat, and the placket
    p.fill([[CX - 8.2, 45.4], [CX, 54], [CX + 8.2, 45.4], [CX + 4.4, 60], [CX - 4.4, 60]], shirt[2], m.cloth2, { sharp: true });
    p.fill([[CX - 8.6, 44.6], [CX - 1, 50.4], [CX - 3.2, 52.6], [CX - 10.2, 48]], shirt[3], m.cloth2);
    p.fill([[CX + 8.6, 44.6], [CX + 1, 50.4], [CX + 3.2, 52.6], [CX + 10.2, 48]], shirt[2], m.cloth2);
    p.where([m.cloth2], (u, v) => u > CX + 1 && v > 49, shirt[1]);
    // backpack straps (orange) over the shoulders
    p.fill([[7, 49.4], [12, 47.4], [14.2, 60], [8.8, 60]], strap[2], m.acc, { sharp: true });
    p.fill([[PW - 7, 49.4], [PW - 12, 47.4], [PW - 14.2, 60], [PW - 8.8, 60]], strap[1], m.acc, { sharp: true });
  },
  front(p, m) {
    const [hd, hs, hb, hl] = T('#2e2426', { sh: 0.2, deep: 0.36, hi: 0.2 });
    // short textured hair: a cap over the crown with the temples cropped (a short sideburn in front of
    // each ear), a fringe of a few big locks swept across to his left that stops above the brows, and
    // a couple of locks kicking up off the crown in the same direction
    p.fill([
      [CX - 14, 25.8], [CX - 14.7, 18], [CX - 13.2, 10.8], [CX - 9, 6], [CX - 2, 3.8], [CX + 5, 4.2], [CX + 11, 7.2], [CX + 14.5, 12.4], [CX + 15.1, 19.4], [CX + 14.3, 25.4],
      [CX + 12.9, 20.6], [CX + 12, 16.2], [CX + 6, 14.6], [CX, 14.2], [CX - 6, 14.4], [CX - 11.6, 16], [CX - 12.6, 20.8],
    ], hb, m.hair, { sharp: true });
    const lock = (b0: Pt, b1: Pt, tip: Pt, bend = 1.2) => {
      const mx = (b0[0] + tip[0]) / 2 - bend, my = (b0[1] + tip[1]) / 2;
      const nx = (b1[0] + tip[0]) / 2 - bend * 0.6, ny = (b1[1] + tip[1]) / 2;
      p.fill([b0, [mx, my], tip, [nx, ny], b1], hb, m.hair, { sharp: true });
    };
    lock([CX - 12.8, 13.2], [CX - 7.2, 12.2], [CX - 9.8, 20.4], -0.6);
    lock([CX - 8.4, 12.2], [CX - 1.6, 11.8], [CX - 2.6, 19.8]);
    lock([CX - 2.8, 11.8], [CX + 4.8, 12], [CX + 4, 21]);
    lock([CX + 3.6, 12], [CX + 11, 13.4], [CX + 10.6, 21.6]);
    lock([CX + 10, 13.4], [CX + 13.4, 15.6], [CX + 13.6, 23.4], 0.4);
    // locks kicking up off the crown, swept the same way
    lock([CX - 7, 5.6], [CX + 0.6, 4.2], [CX + 1.6, 0.4], -1.2);
    lock([CX + 2.4, 4.4], [CX + 9, 6.2], [CX + 10.8, 2.6], -1);
    // shading: darker right side and under-strands between the locks, light sheen band
    p.where([m.hair, m.hairB], (u, v) => u > CX + 7 && v > 11, hs);
    p.where([m.hair], (u, v) => v > 14.4 && u > CX - 12 && u < CX + 12 && ((u * 1.1 - v * 0.55 + 40) % 5.6) < 1.1, hs);
    p.where([m.hair], (u, v) => Math.abs(v - (9 + ((u - CX + 3) / 7) ** 2 * 2)) < 0.7 && u > CX - 11 && u < CX + 4, hl);
    void hd;
  },
  post() {},
};

const JENNA: Design = {
  skin: T('#fcd8c2', { sh: 0.1, deep: 0.24, hi: 0.05 }),
  eyes: 'girl', iris: ['#2a1a10', '#c89a30', '#f0d060'], lash: '#3a1a2e', brow: '#4a3038', blush: '#f09a90',
  faceW: 0.96, chin: -0.6, eyeX: 17, eyeY: 25,
  back(p, m) {
    const [hd, hs, hb] = T('#8a6868', { sh: 0.16, deep: 0.3 });
    // long hair behind, down past the shoulders
    p.fill([[CX - 16, 18], [CX - 14, 8], [CX, 4.6], [CX + 14, 8], [CX + 16.4, 18], [CX + 17, 40], [CX + 15, 52], [CX - 15, 52], [CX - 17, 40]], hb, m.hairB);
    p.where([m.hairB], (u, v) => v > 34 || u > CX + 12, hs);
    p.where([m.hairB], (u, v) => u > CX + 21 && v > 18, hs);
    p.where([m.hairB], (u, v) => u > CX + 16 && u < CX + 22 && v > 22 && ((u + v * 0.5) % 4) < 1, hd);
  },
  body(p, m) {
    const hood = T('#6d4855', { sh: 0.16 }), heart = T('#e1c7bc');
    // hoodie with the hood bunched behind the neck (cat ears poke up behind the shoulders)
    p.fill([[CX - 16, 47], [CX - 12.6, 42.4], [CX - 6, 45], [CX + 6, 45], [CX + 12.6, 42.4], [CX + 16, 47]], hood[1], m.cloth2);
    p.fill([[3, 60], [6, 51], [14, 46.4], [CX, 45.6], [PW - 14, 46.4], [PW - 6, 51], [PW - 3, 60]], hood[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 14 || v > 58, hood[1]);
    // neckline, drawstrings, heart print
    p.fill([[CX - 6, 45], [CX, 48.6], [CX + 6, 45], [CX + 6, 46.6], [CX, 50], [CX - 6, 46.6]], hood[1], m.cloth2);
    p.stroke([[CX - 3.4, 48.6], [CX - 3.8, 55.6]], 0.9, 0.9, col('#8a6060'), m.acc);
    p.stroke([[CX + 3.4, 48.6], [CX + 3.8, 55.6]], 0.9, 0.9, col('#8a6060'), m.acc);
    p.fill([[CX + 8, 55], [CX + 10, 53.4], [CX + 12, 55], [CX + 10, 58.4]], heart[2], m.acc);
    p.fill([[CX + 10, 55], [CX + 12, 53.4], [CX + 14, 55], [CX + 12, 58.4]], heart[2], m.acc);
    // headphones around the neck
  },
  front(p, m) {
    const [hd, hs, hb, hl] = T('#8a6868', { sh: 0.16, deep: 0.3, hi: 0.18 });
    // blunt anime bangs with pointed tips, side locks framing the face
    p.fill([
      [CX - 16.2, 36], [CX - 15.6, 16], [CX - 11, 7.6], [CX, 5.2], [CX + 11, 7.6], [CX + 15.6, 16], [CX + 16.2, 36],
      [CX + 13.6, 42], [CX + 12.4, 30], [CX + 11, 21], [CX + 9.4, 24.4], [CX + 7.6, 19.4], [CX + 4.6, 23.6], [CX + 2.4, 18.4],
      [CX, 22.6], [CX - 2.4, 18.4], [CX - 4.6, 23.6], [CX - 7.6, 19.4], [CX - 9.4, 24.4], [CX - 11, 21], [CX - 12.4, 30], [CX - 13.6, 42],
    ], hb, m.hair, { sharp: true });
    p.where([m.hair], (u, v) => u > CX + 8 && v > 13, hs);
    p.where([m.hair], (u, v) => v > 16 && Math.abs(u - CX) < 11 && ((u * 1.4 + v * 0.3) % 4.6) < 1.1, hs);
    // shiny highlight band
    p.where([m.hair], (u, v) => Math.abs(v - (10.8 + ((u - CX + 3) / 7) ** 2 * 2.2)) < 0.7 && Math.abs(u - CX + 3) < 8.4, hl);
    // star hair clip
    void hd;
  },
};

// Joshu: a hard, weathered old sea dog: eyes always narrowed to a squint under heavy, furrowed white
// brows, crow's feet and bags, a scar through his right brow, the cap's brim throwing his eyes into
// shadow, a big weathered nose, a charcoal knit on massive shoulders; the full white beard stays
const JOSHU: Design = {
  skin: T('#e8a282', { sh: 0.16, deep: 0.32, hi: 0.05 }),
  eyes: 'fierce', iris: ['#1a2430', '#6a8296', '#a2b8c8'], lash: '#160a0c', brow: '#f2ede6', browH: 2.5, browDrop: 0.6, browArch: 0.2, browBias: -2,
  blush: '#d47462', blushK: 0.45, weathered: true, lip: '#8a4a3c',
  faceW: 1.16, chin: 1, eyeX: 17, eyeY: 25, mouthY: 40,
  back(p, m) {
    const hair = T('#d8d4cc', { sh: 0.18 });
    p.ell(CX, 21, 18.6, 13, hair[2], m.hairB);
    p.where([m.hairB], (u, v) => u > CX + 10, hair[1]);
  },
  body(p, m) {
    const knit = T('#22252d', { sh: 0.14 });
    // huge shoulders and a barrel chest in the charcoal cable-knit gansey
    p.fill([[-3, 60], [-1, 47.6], [8, 42], [CX, 40.6], [PW - 8, 42], [PW + 1, 47.6], [PW + 3, 60]], knit[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 12 || v > 58.4, knit[1]);
    // cables: twisted ropes of knit either side of the beard
    p.where([m.cloth], (u, v) => v > 44 && (Math.abs(((u + 40) % 7) - 3.5) < 0.7 || Math.abs(((u + 40 + Math.sin(v * 1.2) * 1.2) % 7) - 1.2) < 0.45), knit[1]);
    p.where([m.cloth], (u, v) => v > 44 && Math.abs(((u + 40 + Math.sin(v * 1.2 + 1.6) * 1.2) % 7) - 5.6) < 0.45, knit[3]);
    // collar rib
    p.fill([[CX - 13, 41.6], [CX, 40.2], [CX + 13, 41.6], [CX + 13, 44], [CX, 42.6], [CX - 13, 44]], knit[0], m.cloth2);
  },
  front(p, m) {
    const hair = T('#e8e4dc', { sh: 0.16 }), beard = T('#eeeae2', { sh: 0.14, deep: 0.28, hi: 0.06 }), cap = T('#b0342a', { sh: 0.2 });
    // fluffy white hair at the temples
    p.fill([[CX - 17.4, 31], [CX - 19, 22], [CX - 16, 15.6], [CX - 12.6, 17], [CX - 13, 27]], hair[2], m.hair);
    p.fill([[CX + 17.4, 31], [CX + 19, 22], [CX + 16, 15.6], [CX + 12.6, 17], [CX + 13, 27]], hair[1], m.hair);
    // the Santa beard: from the sideburns over the cheeks and jaw, a big cloud down over the chest
    const B: Pt[] = [
      [CX - 15, 20], [CX - 18.4, 27], [CX - 20, 35], [CX - 19.8, 43], [CX - 17.6, 50], [CX - 13.6, 55.6], [CX - 9, 58.8], [CX - 4.4, 60],
      [CX, 60.8], [CX + 4.4, 60], [CX + 9, 58.8], [CX + 13.6, 55.6], [CX + 17.6, 50], [CX + 19.8, 43], [CX + 20, 35], [CX + 18.4, 27], [CX + 15, 20],
      [CX + 13.4, 26], [CX + 12.4, 30.6], [CX + 8.4, 33.8], [CX + 4.2, 35.2], [CX, 34.8], [CX - 4.2, 35.2], [CX - 8.4, 33.8], [CX - 12.4, 30.6], [CX - 13.4, 26],
    ];
    p.fill(B, beard[2], m.beard);
    // curly scallops round the edge
    for (let k = 0; k < 13; k++) {
      const a = Math.PI * (0.06 + k * 0.068);
      const x = CX - Math.cos(a) * 19.4, y = 36 + Math.sin(a) * 23.4;
      p.ell(x, y, 2.6, 2.4, beard[2], m.beard);
    }
    // curl shading: wavy strands, deeper on the right and underneath, bright tufts top left
    p.where([m.beard], (u, v) => Math.abs(Math.sin(u * 0.95 + Math.sin(v * 0.55) * 1.8)) < 0.22 && v > 38, beard[1]);
    p.where([m.beard], (u, v) => (u - CX) * 0.6 + (v - 36) * 0.5 > 9 || v > 57.4, beard[1]);
    p.where([m.beard], (u, v) => ((u - CX + 11) ** 2 / 20 + (v - 42) ** 2 / 26 < 1) || ((u - CX + 3) ** 2 / 14 + (v - 49) ** 2 / 10 < 1), beard[3]);
    p.where([m.beard], (u, v) => Math.abs(Math.sin(u * 0.95 + Math.sin(v * 0.55) * 1.8 + 1.4)) < 0.12 && v > 44 && u < CX + 6, beard[3]);
    // the big moustache, curled up at both ends
    const mo = (d: number): Pt[] => [[CX + d * 0.4, 36], [CX + d * 4, 34.4], [CX + d * 8.4, 35.2], [CX + d * 11.4, 36.6], [CX + d * 13, 34.4], [CX + d * 13.6, 36.8], [CX + d * 12, 39.6], [CX + d * 8.4, 40.6], [CX + d * 4, 40], [CX + d * 0.4, 39]];
    p.fill(mo(-1), beard[3], m.acc);
    p.fill(mo(1), beard[2], m.acc);
    p.where([m.acc], (u, v) => v > 38.6 && Math.abs(u - CX) < 13, beard[1]);
    // captain's cap: crown, band, black brim, gold badge
    p.fill([[CX - 16.6, 17.6], [CX - 17.8, 9.6], [CX - 8.4, 3.6], [CX + 8.4, 3.6], [CX + 17.8, 9.6], [CX + 16.6, 17.6]], cap[2], m.cloth2);
    p.where([m.cloth2], (u, v) => v > 13.4 && v < 18, cap[0]);
    p.where([m.cloth2], (u, v) => u > CX + 9 && v < 13.4, cap[1]);
    p.fill([[CX - 16.6, 17], [CX + 16.6, 17], [CX + 13.6, 21], [CX - 13.6, 21]], col('#241a1c'), p.m(7, true, 0.4), { sharp: true });
    p.ell(CX, 10.2, 2.8, 2.3, col('#e8b848'), p.m(8, true, 0.5));
  },
  post(b) {
    // big weathered nose
    const nz = col('#d08268'), nl = col('#eeae90'), ns = col('#a05644');
    // the old scar through his right brow (viewer-left)
    for (const [x, y] of [[19, 22], [20, 23], [21, 24], [22, 29], [22, 30]]) if (b.get(x, y) >>> 24) b.set(x, y, col('#f2c0a4'));
    for (const [x, y, c] of [[CX - 1, 30, nz], [CX, 30, nz], [CX + 1, 30, nz], [CX - 2, 31, nl], [CX - 1, 31, nl], [CX, 31, nz], [CX + 1, 31, nz], [CX + 2, 31, ns], [CX - 2, 32, nz], [CX - 1, 32, nz], [CX, 32, nz], [CX + 1, 32, ns], [CX + 2, 32, ns], [CX - 1, 33, ns], [CX, 33, ns], [CX + 1, 33, ns]] as [number, number, C][]) b.set(x, y, c);
    // anchor on the cap badge
    for (const [x, y] of [[CX, 9], [CX, 10], [CX, 11], [CX - 1, 11], [CX + 1, 11]]) b.set(x, y, col('#8a6420'));
  },
  postHD(b, S) {
    const skinT = new Set<C>(this.skin as C[]);
    // the cap's brim throws a band of shadow over his eyes: they glint out of it (skin only)
    const sh = col('#2a141c');
    for (let y = 21 * S; y < 27 * S; y++) for (let x = 0; x < PW * S; x++) {
      const v = b.get(x, y);
      if (!skinT.has(v)) continue;
      b.set(x, y, mix(v, sh, 0.4 * (1 - (y - 21 * S) / (6 * S)) ** 1.3));
    }
    // the old scar through his right brow (viewer-left): a pale seam, stitch marks, skipping the eye
    const sc0 = col('#f6caae'), sc1 = col('#a85c4a');
    for (let k = 0; k < 17; k++) {
      const x = Math.round(38 + k * 0.5 + Math.sin(k * 0.3) * 0.6), y = 42 + k;
      if (y > 48 && y < 57) continue;
      if (b.get(x, y) >>> 24) b.set(x, y, sc0);
      if (k % 4 === 1) { if (b.get(x - 1, y) >>> 24) b.set(x - 1, y, sc1); if (b.get(x + 1, y) >>> 24) b.set(x + 1, y, sc1); }
    }
    // a big weathered nose: a lit bridge down from the brows, a broad tip, nostril wings in shadow
    const n0 = col('#9c5444'), n1 = col('#cc8066'), n2 = col('#eaa888'), n3 = col('#f8c8aa');
    const nx = CX * S, ny = 31.4 * S;
    for (let y = -9; y <= 4; y++) for (let x = -6; x <= 6; x++) {
      const tip = (x / 5.4) ** 2 + ((y - 0.6) / 3.8) ** 2 <= 1;
      const bridge = y < -1 && Math.abs(x + 0.4 + y * 0.05) < 1.9 - (y + 9) * 0.05;
      if (!tip && !bridge) continue;
      const X = nx + x, Y = ny + y;
      if (!(b.get(X, Y) >>> 24)) continue;
      let c = n2;
      if (tip) c = (x / 5.4) ** 2 + ((y - 0.6) / 3.8) ** 2 > 0.7 ? n1 : x > 1.2 || y > 2 ? mix(n2, n1, 0.5) : n2;
      if (bridge && x < -0.6) c = n3;
      if (bridge && x > 0.8) c = n1;
      if (tip && (x + 1.8) ** 2 + (y + 0.6) ** 2 < 2.2) c = n3;
      b.set(X, Y, c);
    }
    for (const x of [-4, -3, 3, 4]) if (b.get(nx + x, ny + 3) >>> 24) b.set(nx + x, ny + 3, n0);
    for (const [x, y] of [[0, -3], [0, -2], [0, -1], [0, 0], [-1, 0], [1, 0], [-2, -1], [2, -1]]) b.set(CX * S + x, 10 * S + y, col('#8a6420'));
  },
};

const AROHA: Design = {
  skin: T('#c8885e', { sh: 0.12, deep: 0.28, hi: 0.08 }),
  eyes: 'girl', iris: ['#1a0c08', '#5a3420', '#8a5a34'], lash: '#1e1210', brow: '#241410', browH: 1, blush: '#d87060',
  faceW: 0.98, chin: 0.2, eyeX: 17, eyeY: 25,
  back(p, m) {
    const [hd, hs, hb] = T('#2e1a14', { sh: 0.18, deep: 0.34 });
    // long wavy hair falling behind the shoulders
    p.fill([[CX - 16.6, 20], [CX - 15, 8], [CX, 4.4], [CX + 15, 8], [CX + 16.6, 20], [CX + 19.6, 40], [CX + 20.4, 60], [CX - 20.4, 60], [CX - 19.6, 40]], hb, m.hairB);
    p.where([m.hairB], (u, v) => v > 30 && ((u + Math.sin(v * 0.3) * 2 + 40) % 6.4) < 1, hs);
    p.where([m.hairB], (u, v) => u > CX + 14, hs);
    void hd;
  },
  body(p, m) {
    const top = T('#b08c5c', { sh: 0.12 });
    // woven top with short sleeves; a taniko band (red / black / white) across the chest
    p.fill([[2, 60], [4, 51], [12, 46.4], [CX, 45.4], [PW - 12, 46.4], [PW - 4, 51], [PW - 2, 60]], top[2], m.cloth);
    p.fill([[CX - 6.4, 45], [CX, 49.6], [CX + 6.4, 45]], this.skin[2], m.neck);
    p.where([m.cloth], (u, v) => u > PW - 13 || v > 58.4, top[1]);
    p.where([m.cloth], (u, v) => v > 52 && v < 55.6, col('#c8342a'));
    p.where([m.cloth], (u, v) => v > 52 && v < 55.6 && (Math.floor((u + 40) / 2.4) % 2 === 0) && (v - 52) > ((u + 40) % 2.4) * 1.4, col('#1e1418'));
    p.where([m.cloth], (u, v) => Math.abs(v - 52.4) < 0.5 || Math.abs(v - 55.2) < 0.5, col('#f6ecd8'));
    // cord and pounamu
    p.stroke([[CX - 5, 45], [CX - 2.4, 49], [CX, 50.4]], 0.9, 0.9, col('#3a2418'), m.acc);
    p.stroke([[CX + 5, 45], [CX + 2.4, 49], [CX, 50.4]], 0.9, 0.9, col('#3a2418'), m.acc);
    p.fill([[CX - 1.6, 50], [CX + 1.6, 50], [CX + 2, 53.4], [CX, 55.2], [CX - 2, 53.4]], col('#3a9a6a'), m.acc);
    p.where([m.acc], (u, v) => u < CX && v > 50.6 && v < 53, col('#7ad0a0'));
  },
  front(p, m) {
    const [hd, hs, hb, hl] = T('#2e1a14', { sh: 0.18, deep: 0.34, hi: 0.2 });
    // centre-parted hair framing the face, falling in waves
    p.fill([
      [CX - 17, 44], [CX - 16.4, 16], [CX - 11, 7.4], [CX - 1, 5], [CX, 8.6], [CX + 1, 5], [CX + 11, 7.4], [CX + 16.4, 16], [CX + 17, 44],
      [CX + 14.6, 50], [CX + 13.4, 36], [CX + 12.6, 22], [CX + 7, 14.4], [CX + 1.6, 12], [CX, 13.4], [CX - 1.6, 12], [CX - 7, 14.4], [CX - 12.6, 22], [CX - 13.4, 36], [CX - 14.6, 50],
    ], hb, m.hair);
    p.where([m.hair], (u, v) => u > CX + 10, hs);
    p.where([m.hair], (u, v) => v > 22 && Math.abs(u - CX) > 13.4 && ((u + Math.sin(v * 0.3) * 1.6 + 40) % 3.6) < 0.9, hs);
    p.where([m.hair], (u, v) => Math.abs(v - (12.4 + Math.abs(u - CX) * 0.3)) < 0.8 && u < CX - 2 && u > CX - 12, hl);
    // woven headband with a small red/black pattern
    p.stroke([[CX - 15.4, 15.4], [CX - 8, 10.6], [CX, 9.6], [CX + 8, 10.6], [CX + 15.4, 15.4]], 2.2, 2.2, col('#a8342c'), m.acc);
    p.where([m.acc], (u, v) => ((u + 40) % 3) < 1 && v < 17, col('#8a3a24'));
    void hd;
  },
};

// ------------------------------------------------------------------ Chunk (front view pug)

function chunkPortrait(e: string, talk: 0 | 1 | 2, blink: boolean): PixelBuffer {
  const p = new Pic(PW, PH, 1);
  const fur = T('#e4b87c', { sh: 0.14, deep: 0.3, hi: 0.1 }), mask = T('#3e2c2a', { hi: 0.2 }), coat = T('#e0463a', { sh: 0.18 }), fleece = T('#f6eedc');
  const mFur = p.m(1, true, 0.5), mMask = p.m(2, true, 0.4), mCoat = p.m(3, true, 0.5), mFleece = p.m(4, true, 0.5), mEar = p.m(5, true, 0.5);
  // puffer jacket with a fleece collar
  p.fill([[2, 60], [6, 50], [16, 45], [CX, 44], [PW - 16, 45], [PW - 6, 50], [PW - 2, 60]], coat[2], mCoat);
  p.where([mCoat], (u, v) => ((u + 40) % 7) < 1.2 || v > 58, coat[1]);
  p.where([mCoat], (u, v) => u > PW - 14, coat[1]);
  p.fill([[8, 50], [16, 44.6], [CX, 43.6], [PW - 16, 44.6], [PW - 8, 50], [PW - 16, 48.6], [CX, 48], [16, 48.6]], fleece[2], mFleece);
  p.where([mFleece], (u, v) => v > 47, fleece[1]);
  // big round head
  p.fill([[CX, 10], [CX + 13, 12.4], [CX + 19, 21], [CX + 19.4, 32], [CX + 15, 41], [CX + 7, 45], [CX, 45.6], [CX - 7, 45], [CX - 15, 41], [CX - 19.4, 32], [CX - 19, 21], [CX - 13, 12.4]], fur[2], mFur);
  p.where([mFur], (u, v) => u > CX + 13 || v > 42, fur[1]);
  p.where([mFur], (u, v) => (u - (CX - 8)) ** 2 / 30 + (v - 16) ** 2 / 10 < 1, fur[3]);
  // forehead wrinkles
  p.where([mFur], (u, v) => Math.abs(v - (19 + Math.abs(u - CX) * 0.16)) < 0.55 && Math.abs(u - CX) < 5, fur[0]);
  p.where([mFur], (u, v) => Math.abs(v - (21.6 + Math.abs(u - CX) * 0.2)) < 0.55 && Math.abs(u - CX) < 3.4, fur[0]);
  // ears: dark folded flaps
  p.fill([[CX - 13, 12], [CX - 21.4, 12.4], [CX - 23, 20], [CX - 19, 22.6], [CX - 16.6, 17.6]], mask[2], mEar);
  p.fill([[CX + 13, 12], [CX + 21.4, 12.4], [CX + 23, 20], [CX + 19, 22.6], [CX + 16.6, 17.6]], mask[1], mEar);
  // black mask muzzle
  p.fill([[CX - 8.6, 30], [CX - 4, 27.4], [CX, 28.4], [CX + 4, 27.4], [CX + 8.6, 30], [CX + 9.4, 36.6], [CX + 5, 41.4], [CX, 42.4], [CX - 5, 41.4], [CX - 9.4, 36.6]], mask[2], mMask);
  p.where([mMask], (u, v) => v < 31 && u < CX, mask[3]);
  // dark eye patches
  p.ell(CX - 11, 27.6, 5.4, 5, mask[2], mMask);
  p.ell(CX + 11, 27.6, 5.4, 5, mask[2], mMask);
  const b = p.finish({ outline: hex('#2e1c16') });
  const ex = EXPR[e] ?? EXPR.neutral;
  const W = col('#ffffff'), E = col('#1a1012'), K = col('#2e1c16');
  const eyeName = blink && ex.eye !== 'happy' && ex.eye !== 'closed' ? 'closed' : ex.eye;
  const eyeT: Record<string, string[]> = {
    open: ['.WWWW.', 'WWEEGW', 'WEEEEW', 'WEEEEW', 'WWEEWW', '.WWWW.'],
    wide: ['.WWWW.', 'WWWWWW', 'WWEGWW', 'WWEEWW', 'WWWWWW', '.WWWW.'],
    tiny: ['.WWWW.', 'WWWWWW', 'WWWEWW', 'WWWWWW', 'WWWWWW', '.WWWW.'],
    half: ['......', 'KKKKKK', 'WEEEEW', 'WEEEEW', 'WWEEWW', '.WWWW.'],
    closed: ['......', '......', '......', 'KKKKKK', '.K..K.', '......'],
    happy: ['......', '..KK..', '.K..K.', 'K....K', '......', '......'],
    sad: ['......', 'KK....', 'WKKEGW', 'WEEEEW', 'WWEEWW', '.WWWW.'],
    angry: ['KK....', '.KKKKK', 'WEEEGW', 'WEEEEW', 'WWEEWW', '.WWWW.'],
    sparkle: ['.WWWW.', 'WGEEGW', 'WEGEEW', 'WEEEGW', 'WWEEWW', '.WWWW.'],
    side: ['.WWWW.', 'WWWEGW', 'WWEEEW', 'WWEEEW', 'WWWEWW', '.WWWW.'],
    wink: ['......', '..KK..', '.K..K.', 'K....K', '......', '......'],
    pain: ['......', 'K....K', '.K..K.', '..KK..', '......', '......'],
  };
  const tpl = eyeT[eyeName] ?? eyeT.open;
  const ep: Record<string, C> = { W, E, G: W, K };
  stampT(b, tpl, CX - 14, 25, ep, true, false);
  // derp: the other eye looks somewhere else entirely
  const other = e === 'thinking' || e === 'derp' ? eyeT.side : e === 'teasing' ? eyeT.open : tpl;
  stampT(b, other, CX + 8, 25, ep, false, false);
  // nose
  for (const [x, y] of [[CX - 2, 31], [CX - 1, 31], [CX, 31], [CX + 1, 31], [CX - 1, 32], [CX, 32]]) b.set(x, y, col('#140c0c'));
  b.set(CX - 1, 31, col('#6a5a5a'));
  // mouth + tongue
  let mn = ex.mouth;
  if (talk === 1) mn = 'o';
  if (talk === 2) mn = 'shout';
  const mp: Record<string, C> = { k: K, m: col('#140c0c'), M: col('#5a1a26'), R: col('#f07a90'), T: col('#fbf6ee'), s: mask[1] };
  const tongue = mn === 'smallSmile' || mn === 'smile' || mn === 'line' || mn === 'cat' || mn === 'smirk' || mn === 'chew';
  stampT(b, ['m...m', '.mmm.'], CX - 2, 35, mp, false, false);
  if (tongue) stampT(b, ['..RR.', '.RRRk', '.RRRk', '..kk.'], CX - 2, 37, { ...mp, R: col('#f07a90'), k: col('#c8506a') }, false, false);
  else stampT(b, MOUTHS[mn] ?? MOUTHS.o, CX - 2, 36, mp, false, false);
  if (ex.blush) for (const x of [CX - 16, CX - 15, CX + 14, CX + 15]) b.set(x, 34, col('#f49a9a'));
  if (ex.sweat) { b.set(PW - 10, 12, col('#bfe6ff')); b.set(PW - 10, 13, col('#7cc4f0')); b.set(PW - 11, 13, col('#7cc4f0')); b.set(PW - 10, 14, col('#4f9fd8')); }
  return b;
}

// ------------------------------------------------------------------ render

const DESIGNS: Record<string, Design> = { mori: MORI, jenna: JENNA, joshu: JOSHU, aroha: AROHA };

export function renderAnimePortrait(id: string, expr: string, talk: 0 | 1 | 2 = 0, blink = false, outfit = outfitOf(id)): PixelBuffer {
  if (id === 'chunk') return chunkPortrait(expr, talk, blink);
  const d = DESIGNS[id] ?? MORI;
  const e = EXPR[expr] ?? EXPR.neutral;
  const p = new Pic(PW, PH, 1);
  const m = mats(p);
  const skin = e.pale ? T('#e6d2c6') : d.skin;
  const dd: Design = { ...d, skin };
  const wr = PORTRAIT_WEAR[id]?.[outfit];
  if (!wr?.hideBack) d.back?.(p, m);
  wr?.back?.(p, m);
  drawFace(p, m, dd);
  if (wr) wr.body(p, m); else d.body.call(dd, p, m);
  d.front(p, m);
  wr?.front?.(p, m);
  const b = p.finish({ outline: hex('#24161c') });
  drawFeatures(b, dd, e, talk, blink);
  d.post?.(b, e, talk);
  return b;
}

export const PORTRAIT_IDS = ['mori', 'jenna', 'joshu', 'aroha', 'chunk'];

// ------------------------------------------------------------------ HD close-up busts (2x)
// The same designs rasterised at twice the resolution for the cinematic close-ups, with painted
// eyes (lid curves, a tall gradient iris, pupil, two glints, a thick upper lash with a flick, lower
// lash and crease), thicker brows, smoothed mouths (scale2x of the templates), anime blush hatching
// and a heavier outline.

export const HD = 2;

/** Scale2x (EPX) on a template grid: doubles it and rounds the diagonals */
function epx(rows: string[]): string[] {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x] ?? '.');
  const out: string[][] = Array.from({ length: h * 2 }, () => Array(w * 2).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C2 = at(x - 1, y), D = at(x, y + 1);
    let e1 = P, e2 = P, e3 = P, e4 = P;
    if (C2 === A && C2 !== D && A !== B) e1 = A;
    if (A === B && A !== C2 && B !== D) e2 = B;
    if (D === C2 && D !== B && C2 !== A) e3 = C2;
    if (B === D && B !== A && D !== C2) e4 = D;
    out[y * 2][x * 2] = e1; out[y * 2][x * 2 + 1] = e2; out[y * 2 + 1][x * 2] = e3; out[y * 2 + 1][x * 2 + 1] = e4;
  }
  return out.map(r => r.join(''));
}
const epxCache = new Map<string[], string[]>();
const epx2 = (rows: string[]) => { let r = epxCache.get(rows); if (!r) { r = epx(rows); epxCache.set(rows, r); } return r; };

interface EyeSpec {
  w: number; h: number; irx: number; iry: number; lash: number;
  /** outer lash flick (px, default lash + 1; 0 for none: a man's eye) */
  flick?: number;
  /** lower lash strength 0..1 (default 0.55) */
  lower?: number;
  /** upper lid roundness (default 0.22), a permanent heavy lid (cut from the top, 0..0.5), outer-corner lift */
  arch?: number;
  lid?: number;
  tilt?: number;
  /** a weathered eye: creases fanning from the outer corner, a bag under it */
  crow?: boolean;
  /** a squint pushes the lower lid up (fraction of the eye height) */
  low?: number;
}
const EYE_HD: Record<string, EyeSpec> = {
  young: { w: 12, h: 10, irx: 3.3, iry: 4.3, lash: 2 },
  girl: { w: 14, h: 12, irx: 3.9, iry: 5.1, lash: 3 },
  old: { w: 12, h: 8, irx: 2.9, iry: 3.3, lash: 2 },
  // narrower and sharper: a flat lid rising to the outer corner over a smaller iris, no flick
  man: { w: 13, h: 8, irx: 2.9, iry: 3.5, lash: 2, flick: 0, lower: 0.22, arch: 0.13, lid: 0.02, tilt: 0.3 },
  // always squinting: a heavy lid over a sliver of pale iris, crow's feet and a bag beneath
  fierce: { w: 12, h: 8, irx: 2.7, iry: 3.1, lash: 2, flick: 0, lower: 0.9, arch: 0.04, lid: 0.2, tilt: 0.36, crow: true, low: 0.22 },
};

/** paint one HD eye with its outer corner toward +dir (dir 1: viewer-right eye) */
function eyeHD(b: PixelBuffer, x0: number, y0: number, dir: 1 | -1, sp: EyeSpec, state: string, pal: { k: C; w: C; wS: C; I: C; i: C; j: C; skin: C; skinS: C }) {
  const W = sp.w, H = sp.h;
  const X = (lx: number) => (dir === 1 ? x0 + lx : x0 + W - 1 - lx);
  const setp = (lx: number, y: number, c: C) => { const x = Math.round(X(lx)), yy = Math.round(y); if (b.get(x, yy) >>> 24) b.set(x, yy, c); };
  const arc = (y: (t: number) => number, t0: number, t1: number, th: number, c: C) => {
    for (let lx = Math.floor(t0 * (W - 1)); lx <= Math.ceil(t1 * (W - 1)); lx++) {
      const t = lx / (W - 1), yy = y(t);
      for (let k = 0; k < th; k++) setp(lx, yy + k, c);
    }
  };
  const crease = mix(pal.skinS, pal.k, 0.25);
  // crow's feet: three short creases fanning out of the outer corner (deeper when he grins)
  const crow = (yc: number, k = 1) => {
    if (!sp.crow) return;
    for (const [a, n] of [[-0.55, 3], [0.05, 4], [0.6, 3]] as const) for (let i = 0; i < n * k; i++) setp(W + 1 + i, yc + a * (i + 1) * 1.4 - (a < 0 ? 1 : 0), crease);
  };
  if (state === 'happy' || state === 'wink') {
    arc(t => y0 + H * 0.55 - Math.sin(t * Math.PI) * H * 0.38, 0.05, 0.95, 2, pal.k);
    arc(t => y0 + H * 0.55 - Math.sin(t * Math.PI) * H * 0.38 + 2, 0.25, 0.75, 1, pal.skinS);
    crow(y0 + H * 0.55, 1.2);
    return;
  }
  if (state === 'closed') {
    arc(t => y0 + H * 0.5 + Math.sin(t * Math.PI) * H * 0.18, 0.02, 1, 2, pal.k);
    if ((sp.flick ?? 1) > 0) { setp(W, y0 + H * 0.5 - 1, pal.k); setp(W + 1, y0 + H * 0.5 - 2, pal.k); }
    crow(y0 + H * 0.5);
    return;
  }
  if (state === 'pain') {
    for (let k = 0; k <= W - 3; k++) {
      const t = k / (W - 3);
      const yy = y0 + H * 0.5 - Math.abs(t - 0.5) * H * 0.7;
      setp(k + 1, yy, pal.k); setp(k + 1, yy + 1, pal.k);
    }
    crow(y0 + H * 0.5, 1.2);
    return;
  }
  // lids: tilt (+ raises the outer corner), openness cut from the top (a heavy lid lifts in surprise)
  const wide = state === 'wide' || state === 'tiny';
  const tilt = (state === 'angry' ? 0.3 : state === 'sad' ? -0.22 : 0) + (state === 'sad' ? 0 : sp.tilt ?? 0);
  const cut = (state === 'half' ? 0.42 : state === 'angry' ? 0.12 : state === 'sad' ? 0.1 : 0) + Math.max(0, (sp.lid ?? 0) - (wide ? 0.26 : 0));
  const arch = sp.arch ?? 0.22;
  const upper = (t: number) => y0 + H * (0.12 + cut) + (2 * t - 1) ** 2 * H * arch - (t - 0.5) * tilt * H * 0.6 - (wide ? 1 : 0);
  const lower = (t: number) => y0 + H * (0.96 - (wide ? 0 : sp.low ?? 0)) - (2 * t - 1) ** 2 * H * 0.2;
  // sclera
  for (let lx = 0; lx < W; lx++) {
    const t = lx / (W - 1);
    for (let y = Math.ceil(upper(t)); y <= Math.floor(lower(t)); y++) setp(lx, y, y <= upper(t) + 1.5 ? pal.wS : pal.w);
  }
  // iris: tall ellipse, dark top → light bottom, a ring, pupil, glints
  const scale = state === 'tiny' ? 0.42 : state === 'wide' ? 0.82 : 1;
  const icx = W * (state === 'side' ? 0.66 : 0.46), icy = y0 + H * 0.56;
  const rx = sp.irx * scale, ry = sp.iry * scale;
  for (let lx = 0; lx < W; lx++) {
    const t = lx / (W - 1);
    for (let y = Math.ceil(upper(t)); y <= Math.floor(lower(t)); y++) {
      const dx = (lx + 0.5 - icx) / rx, dy = (y + 0.5 - icy) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      const vy = dy;
      let c = d > 0.72 ? pal.I : vy < -0.25 ? pal.I : vy < 0.35 ? pal.i : pal.j;
      if (state !== 'tiny' && (dx * 2.2) ** 2 + ((dy + 0.1) * 1.9) ** 2 < 0.55) c = mix(pal.I, 0xff000000, 0.35);
      if (y <= upper(t) + 1.2) c = mix(c, pal.I, 0.6);
      setp(lx, y, c);
    }
  }
  // glints (a big one up-left, a small one low-right; sparkle adds more), kept below a heavy lid
  const G = 0xffffffff >>> 0;
  if (state !== 'tiny') {
    const gx = icx - rx * 0.45, gy = Math.max(icy - ry * 0.45, upper(icx / (W - 1)) + 1.4);
    for (const [a, c2] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setp(gx + a, gy + c2, G);
    setp(icx + rx * 0.45, icy + ry * 0.4, G);
    if (state === 'sparkle') { setp(icx + rx * 0.2, icy - ry * 0.7, G); setp(icx - rx * 0.6, icy + ry * 0.35, G); setp(icx + rx * 0.2, icy - ry * 0.7 + 1, G); }
  }
  if (state === 'sad') setp(icx - rx * 0.3, icy + ry * 0.55, G);
  // upper lash (thick, with an outer flick unless it's a man's eye), lower lash on the outer half, crease above
  arc(t => upper(t) - sp.lash + 1, 0, 1, sp.lash, pal.k);
  const flick = sp.flick ?? sp.lash + 1;
  for (let k = 0; k < flick; k++) setp(W - 1 + k, upper(1) - sp.lash + 1 - k * 0.6, pal.k);
  if (!flick) { setp(W, upper(1) - sp.lash + 2, pal.k); setp(-1, upper(0) + 1, pal.k); setp(-1, upper(0) + 2, mix(pal.k, pal.skin, 0.5)); }
  if (sp.lash >= 3 && flick) { setp(W - 3, upper(0.8) - 3, pal.k); setp(W - 5, upper(0.62) - 3, pal.k); }
  const lw = sp.lower ?? 0.55;
  arc(t => lower(t) + 1, lw < 0.4 ? 0.62 : 0.5, 1, 1, mix(pal.k, pal.skin, 1 - lw));
  setp(W - 1, lower(1), lw < 0.4 ? mix(pal.k, pal.skin, 0.5) : pal.k);
  arc(t => upper(t) - sp.lash - 1.2 - Math.sin(t * Math.PI) * 0.8, 0.22, 0.86, 1, pal.skinS);
  if (sp.crow) {
    // the bag under the eye and the creases at its corner
    arc(t => lower(t) + 3 + Math.sin(t * Math.PI) * 0.6, 0.18, 0.82, 1, crease);
    crow(y0 + H * 0.5);
  }
}

function drawFeaturesHD(b: PixelBuffer, d: Design, e: ExprDef, talk: 0 | 1 | 2, blink: boolean) {
  const S = HD;
  const skin = e.pale ? T('#e6d2c6') : d.skin;
  const kind = d.eyes === 'pug' ? 'young' : d.eyes;
  const sp = EYE_HD[kind];
  const eyeName = blink && e.eye !== 'happy' && e.eye !== 'closed' && e.eye !== 'wink' && e.eye !== 'pain' ? 'closed' : e.eye;
  const set = EYES[kind];
  const ew1 = Math.max(...(set[e.eye] ?? set.open).map(r => r.length));
  const ex = (d.eyeX ?? 17) * S, ey = (d.eyeY ?? 26) * S;
  const pal = { k: col(d.lash), w: col('#ffffff'), wS: col('#d8dcec'), I: col(d.iris[0]), i: col(d.iris[1]), j: col(d.iris[2]), skin: skin[2], skinS: skin[1] };
  const rx = PW * S - ex - sp.w + (sp.w - ew1 * S) * 0; // mirrored position of the right eye
  const lState = e.eye === 'wink' ? (blink ? 'closed' : 'open') : eyeName;
  eyeHD(b, ex, ey, -1, sp, lState, pal);
  eyeHD(b, rx, ey, 1, sp, eyeName, pal);
  // brows: thick tapered strokes above each eye, inner ends tilted by browIn
  const bc = col(d.brow), bcs = mix(bc, skin[0], 0.35);
  const bh = (d.browH ?? 1) * 2;
  const by = ey - 5 - Math.max(0, e.brow) * 2 + (e.brow < 0 ? 2 : 0) + Math.round((d.browDrop ?? 0) * S);
  const archK = d.browArch ?? 1.4;
  for (let i = -1; i < sp.w + 1; i++) {
    const tIn = (i + 1) / (sp.w + 1);
    const arch = -Math.sin(tIn * Math.PI) * archK;
    const th = Math.max(1, Math.round(bh * (0.55 + 0.45 * tIn)));
    const offR = -((e.browIn + (d.browBias ?? 0)) * (1 - tIn)) * 1.1 + arch, offL = offR;
    for (let k = 0; k < th; k++) {
      const yR = Math.round(by + offR + k), yL = Math.round(by + offL + k);
      // a weathered scowl presses down to the lid but never over the eye
      if (d.weathered && yR > ey + 1) continue;
      let c = k === th - 1 && th > 1 ? bcs : bc;
      // bushy old brows: streaks of shadow through the hair
      if (d.weathered && k > 0 && k < th - 1 && (i + k * 2) % 4 === 0) c = mix(bc, bcs, 0.6);
      const xr = rx + i, xl = ex + sp.w - 1 - i;
      if (b.get(xr, yR) >>> 24) b.set(xr, yR, c);
      if (b.get(xl, yL) >>> 24) b.set(xl, yL, c);
    }
    // stray hairs sticking up off the top edge, a tuft at the outer end
    if (d.weathered && (i % 3 === 1 || i >= sp.w - 1)) {
      const yR = Math.round(by + offR - 1 - (i >= sp.w - 1 ? 1 : 0)), yL = Math.round(by + offL - 1 - (i >= sp.w - 1 ? 1 : 0));
      const xr = rx + i, xl = ex + sp.w - 1 - i;
      if (b.get(xr, yR) >>> 24) b.set(xr, yR, mix(bc, skin[2], 0.3));
      if (b.get(xl, yL) >>> 24) b.set(xl, yL, mix(bc, skin[2], 0.3));
    }
  }
  const cx = PW; // PW*S/2
  if (d.weathered) {
    // a furrow between the brows: two short creases, deeper when he scowls
    const fc = mix(skin[1], skin[2], 0.3), n = e.browIn + (d.browBias ?? 0) < -1.5 ? 4 : 2;
    for (let k = 0; k < n; k++) for (const x of [cx - 2, cx + 1]) { const Y = by + 2 + k; if (b.get(x, Y) >>> 24) b.set(x, Y, fc); }
  }
  // nose: a soft shadow wedge and a highlight dot (a man's nose runs a bridge down from the brows)
  const ny = ((d.eyeY ?? 26) + (d.eyes === 'old' || d.eyes === 'fierce' ? 7 : 8)) * S;
  if (d.noseBridge) {
    for (let y = ey + 3; y < ny; y++) if (b.get(cx + 2, y) >>> 24) b.set(cx + 2, y, mix(skin[1], skin[2], 0.55));
    for (const x of [cx - 2, cx + 2]) if (b.get(x, ny + 3) >>> 24) b.set(x, ny + 3, mix(skin[1], skin[0], 0.3));
  }
  for (const [x, y] of [[1, 0], [1, 1], [0, 2], [-1, 3], [0, 3]]) if (b.get(cx + x, ny + y) >>> 24) b.set(cx + x, ny + y, skin[1]);
  if (b.get(cx - 2, ny) >>> 24) b.set(cx - 2, ny, skin[3]);
  // blush: a soft pink patch with anime hatch lines (a faint warmth for the men)
  const blush = col(d.blush ?? '#f4a0a0');
  const bk = d.blushK ?? 1;
  if ((e.blush || d.rosy) && bk > 0) {
    const k = (e.blush ? 1 : 0.5) * bk;
    for (const side of [-1, 1]) {
      const bx = side < 0 ? ex + sp.w * 0.5 : rx + sp.w * 0.5, byy = ey + sp.h + 4;
      for (let y = -2; y <= 2; y++) for (let x = -5; x <= 5; x++) {
        if ((x / 5.5) ** 2 + (y / 2.4) ** 2 > 1) continue;
        const X = Math.round(bx + x), Y = byy + y;
        if (!(b.get(X, Y) >>> 24)) continue;
        const hatch = e.blush && bk >= 0.5 && ((x - y * 1.2 + 20) % 3 === 0) && Math.abs(y) < 2 && Math.abs(x) < 5 * bk;
        b.set(X, Y, hatch ? mix(blush, skin[0], 0.35) : mix(b.get(X, Y), blush, 0.4 * k));
      }
    }
  }
  // mouth: the template doubled with scale2x
  let mn = e.mouth;
  if (talk === 1) mn = mn === 'laugh' || mn === 'shout' ? mn : 'talk1';
  if (talk === 2) mn = mn === 'laugh' || mn === 'shout' || mn === 'grin' ? mn : 'talk2';
  const mt = epx2(MOUTHS[mn] ?? MOUTHS.line);
  const mw = Math.max(...mt.map(r => r.length));
  const my = (d.mouthY ?? (d.eyeY ?? 26) + 12) * S;
  stampT(b, mt, PW - Math.floor(mw / 2), my, mouthPal(d, skin));
  if (e.sweat) {
    const x = rx + sp.w + 2, y = ey - 8;
    for (let k = 0; k < 7; k++) for (let q = -3; q <= 3; q++) {
      const r = k < 3 ? k * 0.7 : 3 - (k - 3) * 0.4;
      if (Math.abs(q) > r) continue;
      b.set(x + q, y + k, k > 4 ? col('#4f9fd8') : q < 0 ? col('#dff4ff') : col('#7cc4f0'));
    }
  }
  if (e.tear) for (let k = 0; k < 6; k++) { b.set(ex + 3, ey + sp.h + k, col(k < 2 ? '#dff4ff' : '#5ab0f0')); b.set(ex + 4, ey + sp.h + k + 1, col('#9ad8ff')); }
  if (e.lines) for (let i = 0; i < 4; i++) for (const bx of [ex + 2 + i * 3, rx + 2 + i * 3]) for (let k = 0; k < 3; k++) if (b.get(bx, ey + sp.h + 2 + k) >>> 24) b.set(bx, ey + sp.h + 2 + k, skin[0]);
}

/** thicken the silhouette outline by one more pixel */
function thicken(b: PixelBuffer, ink: C) {
  const src = b.data.slice();
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = y * b.w + x;
    if (src[i] >>> 24) continue;
    if ((x > 0 && src[i - 1] >>> 24) || (x < b.w - 1 && src[i + 1] >>> 24) || (y > 0 && src[i - b.w] >>> 24) || (y < b.h - 1 && src[i + b.w] >>> 24)) b.data[i] = ink;
  }
}

/** upscale a 1x buffer 2x with scale2x (for Chunk's hand-placed face) */
function epxBuf(src: PixelBuffer): PixelBuffer {
  const w = src.w, h = src.h, o = new PixelBuffer(w * 2, h * 2);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C2 = at(x - 1, y), D = at(x, y + 1);
    o.data[(y * 2) * o.w + x * 2] = C2 === A && C2 !== D && A !== B ? A : P;
    o.data[(y * 2) * o.w + x * 2 + 1] = A === B && A !== C2 && B !== D ? B : P;
    o.data[(y * 2 + 1) * o.w + x * 2] = D === C2 && D !== B && C2 !== A ? C2 : P;
    o.data[(y * 2 + 1) * o.w + x * 2 + 1] = B === D && B !== A && D !== C2 ? D : P;
  }
  return o;
}

/** extra detail only the 2x bust has room for: hair strands and sheen, fringe shadow on the skin, cloth texture */
function detailHD(p: Pic, m: Mats) {
  const W = p.W, H = p.H;
  const hair = new Set([m.hair, m.hairB]);
  for (let y = 1; y < H - 2; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, mt = p.mat[i];
    const u = p.U(x), v = p.V(y);
    if (hair.has(mt)) {
      // fine strands following the fall of the hair, a broken sheen band, light on the left edge
      const flow = u * 1.9 + Math.sin(v * 0.42 + u * 0.2) * 1.4;
      if (((flow % 2.6) + 2.6) % 2.6 < 0.34 && hash2(x, y >> 2) > 0.25) p.col[i] = shade(p.col[i], -0.14);
      else if (((flow + 1.3) % 2.6 + 2.6) % 2.6 < 0.2 && v > 8 && v < 20 && hash2(x >> 1, y) > 0.4) p.col[i] = shade(p.col[i], 0.14);
      if (!hair.has(p.mat[i - 1]) && p.mat[i - 1] === 0 && u < CX) p.col[i] = shade(p.col[i], 0.1);
    } else if (mt === m.skin) {
      // soft shadow cast by the fringe and the hair at the temples
      if (hair.has(p.mat[i - W]) || hair.has(p.mat[i - 2 * W])) p.col[i] = mix(p.col[i], shade(p.col[i], -0.18), 0.7);
      else if (hair.has(p.mat[i - 3 * W]) && (x + y) % 2 === 0) p.col[i] = mix(p.col[i], shade(p.col[i], -0.18), 0.5);
    } else if (mt === m.cloth || mt === m.cloth2) {
      // woven texture and a darker hem of shadow under the chin
      if ((x + (y >> 1)) % 3 === 0 && (y & 1)) p.col[i] = shade(p.col[i], -0.06);
      if (p.mat[i - W] === m.neck || p.mat[i - 2 * W] === m.neck) p.col[i] = shade(p.col[i], -0.16);
    }
  }
}
/** a faint shadow of stubble: sparse cool flecks along the jaw and the chin and over the upper lip (face skin only) */
function stubbleHD(p: Pic, m: Mats, d: Design, k = 0.2) {
  const sc = col(d.stubble!), my = d.mouthY ?? (d.eyeY ?? 26) + 12;
  for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
    const i = y * p.W + x;
    if (p.mat[i] !== m.skin) continue;
    const u = p.U(x), v = p.V(y), dx = Math.abs(u - CX);
    // the upper lip, the chin, and a band along the jawline up toward the ears
    const lip = v > my - 2.4 && v < my - 0.6 && dx < 3.6;
    const chin = v > my + 1.6 && dx < 6.5;
    const jaw = v > 30 + dx * 0.05 && dx > 8.6 && v > 42 - (13.6 - dx) * 1.5;
    if (!(lip || chin || jaw) || hash2(x, y) > 0.3) continue;
    p.col[i] = mix(p.col[i], sc, k);
  }
}
const hash2 = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const hdCache = new Map<string, PixelBuffer>();
export function renderAnimePortraitHD(id: string, expr: string, talk: 0 | 1 | 2 = 0, blink = false, outfit = outfitOf(id)): PixelBuffer {
  const key = `${id}@${outfit}|${expr}|${talk}|${blink ? 1 : 0}`;
  const hit = hdCache.get(key);
  if (hit) return hit;
  let out: PixelBuffer;
  if (id === 'chunk') out = epxBuf(chunkPortrait(expr, talk, blink));
  else {
    const d = DESIGNS[id] ?? MORI;
    const e = EXPR[expr] ?? EXPR.neutral;
    const p = new Pic(PW * HD, PH * HD, HD);
    const m = mats(p);
    const skin = e.pale ? T('#e6d2c6') : d.skin;
    const dd: Design = { ...d, skin };
    const wr = PORTRAIT_WEAR[id]?.[outfit];
    if (!wr?.hideBack) d.back?.(p, m);
    wr?.back?.(p, m);
    drawFace(p, m, dd);
    if (wr) wr.body(p, m); else d.body.call(dd, p, m);
    d.front(p, m);
    wr?.front?.(p, m);
    detailHD(p, m);
    if (d.stubble) stubbleHD(p, m, d, e.pale ? 0.1 : 0.2);
    const ink = hex('#24161c');
    out = p.finish({ outline: ink });
    thicken(out, ink);
    drawFeaturesHD(out, dd, e, talk, blink);
    d.postHD?.(out, HD, e);
  }
  if (hdCache.size > 400) hdCache.clear();
  hdCache.set(key, out);
  return out;
}

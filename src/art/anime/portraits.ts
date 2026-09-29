// V4 portraits: Stardew-Valley-style front-facing busts (56x60) drawn in the anime style of the
// sprites. Hair, face and clothes are smooth shapes with flat 3-4 tone cel shading and dark
// outlines (portrait kit); eyes, brows and mouths are hand-placed pixel templates per expression,
// mirrored for the two eyes, so faces stay crisp, cute and readable at 2-4x.

import { PixelBuffer } from '../pixel';
import { Pic, Pt, tones } from '../portrait/kit';
import { hex, mix, shade, C } from '../color';

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
  eyes: 'young' | 'girl' | 'old' | 'pug';
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
  p.fill([[CX - 4.8, 36], [CX + 4.8, 36], [CX + 5.4, 49], [CX - 5.4, 49]], sb, m.neck, { sharp: true });
  p.where([m.neck], (u, v) => v < 42.6 + (d.chin ?? 0) || u > CX + 3.2, ss);
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
  // soft light on the left cheek
  p.where([m.skin], (u, v) => (u - (CX - 8)) ** 2 / 9 + (v - 31) ** 2 / 4 < 1, sl);
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
  const by = ey - 3 - Math.max(0, e.brow) + (e.brow < 0 ? 1 : 0);
  for (let i = 0; i < ew; i++) {
    const tIn = i / (ew - 1); // 0 outer → 1 inner (for the right eye inner is at i=0)
    const off = Math.round(-(e.browIn * (1 - tIn)) * 0.5);
    const offL = Math.round(-(e.browIn * tIn) * 0.5);
    for (let k = 0; k < bh; k++) {
      // right eye brow: inner end at the left (i = 0)
      const yR = by + off + k, yL = by + offL + k;
      if (b.get(rx + i, yR) >>> 24) b.set(rx + i, yR, bc);
      if (b.get(lx + i, yL) >>> 24) b.set(lx + i, yL, bc);
    }
  }
  // nose: a single shadow pixel pair
  const ny = ey + (d.eyes === 'old' ? 7 : 8);
  b.set(CX, ny, skin[1]);
  b.set(CX - 1, ny + 1, skin[1]);
  // blush
  const blush = d.blush ?? '#f4a0a0';
  if (e.blush || d.rosy) {
    const bcol = e.blush ? col(blush) : mix(skin[2], col(blush), 0.45);
    for (const [x, y] of [[ex + 1, ey + ew - 0], [ex + 2, ey + ew - 0], [ex + 3, ey + ew - 0]]) {
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
  stampT(b, mt, CX - Math.floor(mw / 2), my, {
    k: shade(skin[0], -0.35), m: mix(skin[0], col('#8a3040'), 0.35), M: col('#5a1a26'), R: col('#e0707e'), T: col('#fbf6ee'), s: skin[1],
  });
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

const MORI: Design = {
  skin: T('#f4c8a6', { sh: 0.12, deep: 0.28, hi: 0.06 }),
  eyes: 'young', iris: ['#2a1a14', '#6a4a2a', '#9a7040'], lash: '#2a1c22', brow: '#36221c', browH: 1,
  eyeX: 18, eyeY: 25,
  back(p, m) {
    const [hd, hs, hb] = T('#4e3428', { sh: 0.2, deep: 0.36 });
    p.ell(CX, 20, 16, 14, hb, m.hairB);
    p.where([m.hairB], (u, v) => v > 22, hs);
    void hd;
  },
  body(p, m) {
    const shirt = T('#dccca2'), vest = T('#5e6e3c', { sh: 0.18 }), strap = T('#e06a2e');
    // shoulders: olive vest over a khaki shirt
    p.fill([[4, 60], [7, 51], [15, 46.5], [CX, 45], [PW - 15, 46.5], [PW - 7, 51], [PW - 4, 60]], vest[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 16 || v > 57, vest[1]);
    // shirt collar and placket
    p.fill([[CX - 7, 44], [CX, 52.5], [CX + 7, 44], [CX + 4, 60], [CX - 4, 60]], shirt[2], m.cloth2, { sharp: true });
    p.fill([[CX - 7.4, 43.4], [CX - 1, 49], [CX - 3, 51], [CX - 8.8, 46.6]], shirt[3], m.cloth2);
    p.fill([[CX + 7.4, 43.4], [CX + 1, 49], [CX + 3, 51], [CX + 8.8, 46.6]], shirt[2], m.cloth2);
    p.where([m.cloth2], (u, v) => u > CX + 1 && v > 48, shirt[1]);
    // backpack straps (orange) over the shoulders
    p.fill([[9, 49.5], [13.6, 47.6], [15.6, 60], [10.6, 60]], strap[2], m.acc, { sharp: true });
    p.fill([[PW - 9, 49.5], [PW - 13.6, 47.6], [PW - 15.6, 60], [PW - 10.6, 60]], strap[1], m.acc, { sharp: true });
    // blue lanyard + ID card
    p.stroke([[CX - 5.4, 46], [CX - 6.2, 53], [CX - 7.6, 55.4]], 0.9, 0.9, col('#3a78c0'), m.acc);
    p.fill([[CX - 11, 54.2], [CX - 5.4, 54.2], [CX - 5.4, 60], [CX - 11, 60]], col('#f4f4ee'), m.acc, { sharp: true });
    p.where([m.acc], (u, v) => u > CX - 10.6 && u < CX - 5.8 && v > 55 && v < 56.2, col('#3a78c0'));
    // badge pins on the vest
    p.ell(CX + 10, 53.5, 1.3, 1.3, col('#e8483a'), m.acc);
    p.ell(CX + 13.2, 54, 1.3, 1.3, col('#48a8e8'), m.acc);
  },
  front(p, m) {
    const [hd, hs, hb, hl] = T('#4e3428', { sh: 0.2, deep: 0.36, hi: 0.2 });
    // messy bangs: pointed locks over the forehead, parted toward his right
    p.fill([
      [CX - 15, 26], [CX - 14.6, 16], [CX - 10, 9], [CX - 2, 6.4], [CX + 6, 7], [CX + 12.6, 10.4], [CX + 15.4, 17], [CX + 15, 27],
      [CX + 12.8, 22.4], [CX + 11.6, 25], [CX + 9.4, 18.6], [CX + 6.8, 23.4], [CX + 4, 17.6], [CX + 1, 22.8], [CX - 2, 16.8],
      [CX - 5, 22.6], [CX - 7.4, 17.4], [CX - 10.2, 23.2], [CX - 11.6, 19.2], [CX - 13, 27.6],
    ], hb, m.hair, { sharp: true });
    // tufts on top
    p.fill([[CX - 4, 8], [CX - 6.6, 3.4], [CX - 1.4, 6.6]], hb, m.hair, { sharp: true });
    p.fill([[CX + 1, 7], [CX + 3.6, 2.6], [CX + 5, 7.4]], hb, m.hair, { sharp: true });
    // shading: darker right side and under-strands, light sheen band
    p.where([m.hair, m.hairB], (u, v) => u > CX + 7 && v > 12, hs);
    p.where([m.hair], (u, v) => v > 17.5 && u > CX - 12 && u < CX + 12 && ((u * 1.3 + v) % 5.2) < 1.4, hs);
    p.where([m.hair], (u, v) => Math.abs(v - (10.6 + ((u - CX + 4) / 7) ** 2 * 2)) < 0.7 && u > CX - 11 && u < CX + 3, hl);
    void hd;
  },
  post(b, e) {
    // round glasses: rounded frames, bridge, glints
    const g = col('#4a3a52');
    const ey = 25, ex = 18;
    for (const side of [0, 1]) {
      const x0 = side ? PW - ex - 7 : ex - 1;
      const pts: [number, number][] = [];
      for (let i = 2; i < 6; i++) { pts.push([x0 + i, ey - 1]); pts.push([x0 + i, ey + 5]); }
      for (let j = 1; j < 4; j++) { pts.push([x0, ey + j]); pts.push([x0 + 7, ey + j]); }
      pts.push([x0 + 1, ey], [x0 + 6, ey], [x0 + 1, ey + 4], [x0 + 6, ey + 4]);
      for (const [x, y] of pts) if (b.get(x, y) >>> 24) b.set(x, y, g);
      if (e.eye !== 'happy' && e.eye !== 'closed') { b.set(x0 + (side ? 5 : 2), ey + 3, col('#dff4ff')); }
    }
    for (let x = ex + 7; x < PW - ex - 7; x++) if (b.get(x, ey + 1) >>> 24) b.set(x, ey + 1, g);
  },
};

const JENNA: Design = {
  skin: T('#fcd8c2', { sh: 0.1, deep: 0.24, hi: 0.05 }),
  eyes: 'girl', iris: ['#3a1030', '#c0407e', '#f080b8'], lash: '#3a1a2e', brow: '#d04890', rosy: true, blush: '#ff8aa8',
  faceW: 0.96, chin: -0.6, eyeX: 17, eyeY: 25,
  back(p, m) {
    const [hd, hs, hb] = T('#f472b0', { sh: 0.16, deep: 0.3 });
    // long hair behind, down past the shoulders
    p.fill([[CX - 16, 18], [CX - 14, 8], [CX, 4.6], [CX + 14, 8], [CX + 16.4, 18], [CX + 17, 40], [CX + 15, 52], [CX - 15, 52], [CX - 17, 40]], hb, m.hairB);
    p.where([m.hairB], (u, v) => v > 34 || u > CX + 12, hs);
    // side ponytail (viewer right) with a lavender scrunchie
    p.fill([[CX + 13, 11], [CX + 20, 9.6], [CX + 25.6, 16], [CX + 26.4, 30], [CX + 23, 42], [CX + 21.6, 30], [CX + 18.6, 19]], hb, m.hairB);
    p.where([m.hairB], (u, v) => u > CX + 21 && v > 18, hs);
    p.where([m.hairB], (u, v) => u > CX + 16 && u < CX + 22 && v > 22 && ((u + v * 0.5) % 4) < 1, hd);
    p.ell(CX + 17.6, 11.4, 3, 2.4, col('#c8b4f0'), m.acc);
  },
  body(p, m) {
    const hood = T('#b8a0e8', { sh: 0.16 }), heart = T('#f472b0');
    // hoodie with the hood bunched behind the neck (cat ears poke up behind the shoulders)
    p.fill([[CX - 16, 47], [CX - 12.6, 42.4], [CX - 6, 45], [CX + 6, 45], [CX + 12.6, 42.4], [CX + 16, 47]], hood[1], m.cloth2);
    p.fill([[3, 60], [6, 51], [14, 46.4], [CX, 45.6], [PW - 14, 46.4], [PW - 6, 51], [PW - 3, 60]], hood[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 14 || v > 58, hood[1]);
    // neckline, drawstrings, heart print
    p.fill([[CX - 6, 45], [CX, 48.6], [CX + 6, 45], [CX + 6, 46.6], [CX, 50], [CX - 6, 46.6]], hood[1], m.cloth2);
    p.stroke([[CX - 3.4, 48.6], [CX - 3.8, 55.6]], 0.9, 0.9, col('#ffffff'), m.acc);
    p.stroke([[CX + 3.4, 48.6], [CX + 3.8, 55.6]], 0.9, 0.9, col('#ffffff'), m.acc);
    p.fill([[CX + 8, 55], [CX + 10, 53.4], [CX + 12, 55], [CX + 10, 58.4]], heart[2], m.acc);
    p.fill([[CX + 10, 55], [CX + 12, 53.4], [CX + 14, 55], [CX + 12, 58.4]], heart[2], m.acc);
    // headphones around the neck
    p.stroke([[CX - 9, 45.4], [CX - 5, 48.8], [CX + 5, 48.8], [CX + 9, 45.4]], 1.4, 1.4, col('#3a3a4a'), m.acc);
    p.ell(CX - 9.6, 46.2, 2.6, 3.1, col('#f472b0'), m.acc);
    p.ell(CX + 9.6, 46.2, 2.6, 3.1, col('#d04890'), m.acc);
    p.where([m.acc], (u, v) => Math.abs(Math.abs(u - CX) - 9.6) < 1.1 && Math.abs(v - 46.2) < 1.3, col('#ffb8dc'));
  },
  front(p, m) {
    const [hd, hs, hb, hl] = T('#f472b0', { sh: 0.16, deep: 0.3, hi: 0.18 });
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
    p.fill([[CX - 9, 12.6], [CX - 8.2, 14.6], [CX - 6, 14.8], [CX - 7.8, 16.2], [CX - 7.2, 18.4], [CX - 9, 17], [CX - 10.8, 18.4], [CX - 10.2, 16.2], [CX - 12, 14.8], [CX - 9.8, 14.6]], col('#ffd84a'), m.acc, { sharp: true });
    void hd;
  },
};

const JOSHU: Design = {
  skin: T('#f0b494', { sh: 0.14, deep: 0.3, hi: 0.06 }),
  eyes: 'old', iris: ['#1a2a3a', '#4a6a8a', '#7a9aba'], lash: '#26181c', brow: '#eeeae2', browH: 2,
  faceW: 1.12, chin: 1, eyeX: 18, eyeY: 25, mouthY: 38,
  back(p, m) {
    const hair = T('#c8c4bc', { sh: 0.18 });
    p.ell(CX, 22, 17, 12, hair[2], m.hairB);
  },
  body(p, m) {
    const knit = T('#e2d6b8', { sh: 0.14 }), susp = T('#b8342a');
    // big broad shoulders in a cable-knit sweater, red suspenders
    p.fill([[0, 60], [1.6, 50], [10, 45], [CX, 43.6], [PW - 10, 45], [PW - 1.6, 50], [PW, 60]], knit[2], m.cloth);
    p.where([m.cloth], (u, v) => u > PW - 12 || v > 58, knit[1]);
    p.where([m.cloth], (u, v) => ((u + 40) % 5) < 1.2 && v > 47, knit[1]);
    p.fill([[9, 47], [13, 45.6], [15, 60], [10.6, 60]], susp[2], m.cloth2, { sharp: true });
    p.fill([[PW - 9, 47], [PW - 13, 45.6], [PW - 15, 60], [PW - 10.6, 60]], susp[1], m.cloth2, { sharp: true });
  },
  front(p, m) {
    const hair = T('#c8c4bc', { sh: 0.18 }), beard = T('#dedad2', { sh: 0.16, deep: 0.3 }), cap = T('#2c3a5a', { sh: 0.2 });
    // grey hair at the temples
    p.fill([[CX - 16, 30], [CX - 16.6, 20], [CX - 12, 16], [CX - 12.6, 26]], hair[2], m.hair);
    p.fill([[CX + 16, 30], [CX + 16.6, 20], [CX + 12, 16], [CX + 12.6, 26]], hair[1], m.hair);
    // long beard: covers cheeks and chin, flows down over the chest; moustache over the mouth
    p.fill([
      [CX - 15, 28], [CX - 12.4, 33], [CX - 6, 35.6], [CX, 34.8], [CX + 6, 35.6], [CX + 12.4, 33], [CX + 15, 28],
      [CX + 16, 38], [CX + 13, 49], [CX + 7, 56.6], [CX, 59.4], [CX - 7, 56.6], [CX - 13, 49], [CX - 16, 38],
    ], beard[2], m.beard);
    p.where([m.beard], (u, v) => u > CX + 7 || v > 54, beard[1]);
    p.where([m.beard], (u, v) => v > 41 && ((u * 0.9 + v * 0.2 + 40) % 4.4) < 1, beard[1]);
    p.where([m.beard], (u, v) => v > 37 && v < 44 && ((u + 40) % 5.2) < 1 && u < CX + 6, beard[3]);
    // moustache
    p.fill([[CX - 7.4, 38.4], [CX - 4, 35.4], [CX, 36.4], [CX + 4, 35.4], [CX + 7.4, 38.4], [CX + 3, 38.2], [CX, 37.8], [CX - 3, 38.2]], beard[3], m.beard);
    // captain's cap: crown, band, black brim, gold anchor badge
    p.fill([[CX - 15.6, 17.6], [CX - 16.8, 10], [CX - 8, 4.4], [CX + 8, 4.4], [CX + 16.8, 10], [CX + 15.6, 17.6]], cap[2], m.acc);
    p.where([m.acc], (u, v) => v > 13.6, cap[0]);
    p.where([m.acc], (u, v) => u > CX + 9 && v < 13.6, cap[1]);
    p.fill([[CX - 15.6, 17], [CX + 15.6, 17], [CX + 13, 21], [CX - 13, 21]], col('#141824'), m.cloth2, { sharp: true });
    p.ell(CX, 10.6, 2.6, 2.2, col('#e8b848'), m.acc);
    void m;
  },
  post(b, e) {
    // old scar through the left eyebrow (viewer's left)
    const sc = col('#e89a8a'), sd = col('#b86a5e');
    for (const [x, y] of [[18, 19], [18, 20], [19, 21], [19, 22], [19, 23], [20, 24], [20, 29], [20, 30], [21, 31]]) if (b.get(x, y) >>> 24) b.set(x, y, y === 19 || y === 31 ? sd : sc);
    // big round weathered nose
    const nz = col('#e89878'), nl = col('#f8c0a0'), ns = col('#c07058');
    for (const [x, y, c] of [[CX - 1, 31, nz], [CX, 31, nz], [CX + 1, 31, nz], [CX - 2, 32, nz], [CX - 1, 32, nl], [CX, 32, nz], [CX + 1, 32, nz], [CX + 2, 32, ns], [CX - 1, 33, ns], [CX, 33, ns], [CX + 1, 33, ns]] as [number, number, C][]) if (b.get(x, y) >>> 24) b.set(x, y, c);
    // anchor on the cap badge
    b.set(CX, 9, col('#8a6420')); b.set(CX, 10, col('#8a6420')); b.set(CX, 11, col('#8a6420')); b.set(CX - 1, 11, col('#8a6420')); b.set(CX + 1, 11, col('#8a6420'));
    void e;
  },
};

const AROHA: Design = {
  skin: T('#c8885e', { sh: 0.12, deep: 0.28, hi: 0.08 }),
  eyes: 'girl', iris: ['#1a0c08', '#5a3420', '#8a5a34'], lash: '#1e1210', brow: '#241410', browH: 1, blush: '#d87060',
  faceW: 0.98, chin: 0.2, eyeX: 17, eyeY: 25,
  back(p, m) {
    const [hd, hs, hb] = T('#4e3022', { sh: 0.18, deep: 0.34 });
    // long wavy hair falling behind the shoulders
    p.fill([[CX - 16.6, 20], [CX - 15, 8], [CX, 4.4], [CX + 15, 8], [CX + 16.6, 20], [CX + 19.6, 40], [CX + 20.4, 60], [CX - 20.4, 60], [CX - 19.6, 40]], hb, m.hairB);
    p.where([m.hairB], (u, v) => v > 30 && ((u + Math.sin(v * 0.3) * 2 + 40) % 6.4) < 1, hs);
    p.where([m.hairB], (u, v) => u > CX + 14, hs);
    void hd;
  },
  body(p, m) {
    const top = T('#ece0c4', { sh: 0.12 });
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
    const [hd, hs, hb, hl] = T('#4e3022', { sh: 0.18, deep: 0.34, hi: 0.2 });
    // centre-parted hair framing the face, falling in waves
    p.fill([
      [CX - 17, 44], [CX - 16.4, 16], [CX - 11, 7.4], [CX - 1, 5], [CX, 8.6], [CX + 1, 5], [CX + 11, 7.4], [CX + 16.4, 16], [CX + 17, 44],
      [CX + 14.6, 50], [CX + 13.4, 36], [CX + 12.6, 22], [CX + 7, 14.4], [CX + 1.6, 12], [CX, 13.4], [CX - 1.6, 12], [CX - 7, 14.4], [CX - 12.6, 22], [CX - 13.4, 36], [CX - 14.6, 50],
    ], hb, m.hair);
    p.where([m.hair], (u, v) => u > CX + 10, hs);
    p.where([m.hair], (u, v) => v > 22 && Math.abs(u - CX) > 13.4 && ((u + Math.sin(v * 0.3) * 1.6 + 40) % 3.6) < 0.9, hs);
    p.where([m.hair], (u, v) => Math.abs(v - (12.4 + Math.abs(u - CX) * 0.3)) < 0.8 && u < CX - 2 && u > CX - 12, hl);
    // woven headband with a small red/black pattern
    p.stroke([[CX - 15.4, 15.4], [CX - 8, 10.6], [CX, 9.6], [CX + 8, 10.6], [CX + 15.4, 15.4]], 2.2, 2.2, col('#d8b060'), m.acc);
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

export function renderAnimePortrait(id: string, expr: string, talk: 0 | 1 | 2 = 0, blink = false): PixelBuffer {
  if (id === 'chunk') return chunkPortrait(expr, talk, blink);
  const d = DESIGNS[id] ?? MORI;
  const e = EXPR[expr] ?? EXPR.neutral;
  const p = new Pic(PW, PH, 1);
  const m = mats(p);
  const skin = e.pale ? T('#e6d2c6') : d.skin;
  const dd: Design = { ...d, skin };
  d.back?.(p, m);
  drawFace(p, m, dd);
  d.body.call(dd, p, m);
  d.front(p, m);
  const b = p.finish({ outline: hex('#24161c') });
  drawFeatures(b, dd, e, talk, blink);
  d.post?.(b, e, talk);
  return b;
}

export const PORTRAIT_IDS = ['mori', 'jenna', 'joshu', 'aroha', 'chunk'];

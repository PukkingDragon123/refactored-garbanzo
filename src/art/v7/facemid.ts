// V12 sprite faces (user: "realistic + anime male ... no weird"): the features hand-placed as small
// clean clusters on the head's own buffer grid, between the fine anime decal (paintFace7, "too high
// resolution") and the dot-and-dash face ("ugly").
//  - men: a narrow almond eye about two world pixels tall under a strong upper lid line (no flick),
//    a small dark iris with one catch-light, the white at the back; a straight, fairly thick brow
//    close over it that tilts with the mood; a short mouth line with a shadow under the lower lip
//  - women: the same eye fuller, with a lash at the outer corner and a lower lid; a lighter, higher brow;
//    a coloured lip
//  - the nose: a lit bridge and a shadow under the tip (the volume itself is in the 3D head)
// Every cluster is drawn for a face turned to the screen's right and mirrored for one turned left;
// the near eye is the wider one, the far eye foreshortened toward the nose.

import { C, hex, mix } from '../color';
import type { HeadDef7, HeadExpr7 } from './head';
import type { Put } from './face7';

export interface FaceMid7 {
  near: [number, number] | null;
  far: [number, number] | null;
  /** nose tip (buffer px) */
  nose: [number, number];
  mouth: [number, number];
  /** +1: the face turned to the right of the screen, -1: to the left */
  dir: 1 | -1;
  eye: HeadExpr7['eye'];
  mouthShape: HeadExpr7['mouth'];
  ex: HeadExpr7;
  d: HeadDef7;
  fem: boolean;
}

/** a cluster: rows of palette letters ('.' = leave the skin), placed with cell (ax, ay) on the anchor */
interface T { r: string[]; ax: number; ay: number }
const t = (ax: number, ay: number, ...r: string[]): T => ({ r, ax, ay });

// ------------------------------------------------------------------ eyes
// K lid ink, k soft lid, W white, w white in the lid's shadow, I iris (dark), i iris (lit), H catch-light,
// L lid crease / under-eye shadow, l soft skin shadow. The anchor is the eye centre; the lid line sits
// on the row above it.

const MAN_NEAR: Record<string, T> = {
  dot: t(2, 1, '.KKKK.', 'KwHIk.', '.WIi..'),
  half: t(2, 1, '.LLLL.', 'KKKKk.', '.WIi..'),
  angry: t(2, 1, '.KK...', 'KwHKK.', '.WIi..'),
  sad: t(2, 1, '..KKK.', 'KKHIk.', '.WIi..', '..l...'),
  wide: t(2, 2, '.KKKK.', 'KwWWk.', '.WHIW.', '..Ii..'),
  happy: t(2, 1, '.KKK..', 'K...K.', '.l.l..'),
  closed: t(2, 1, '......', 'kKKKk.', '.l....'),
};
const MAN_FAR: Record<string, T> = {
  dot: t(1, 1, 'KKKk', 'wHIK', '.Ii.'),
  half: t(1, 1, 'LLLL', 'kKKK', '.Ii.'),
  angry: t(1, 1, '..KK', 'KHKK', '.Ii.'),
  sad: t(1, 1, 'KKk.', 'kHIK', '.Ii.'),
  wide: t(1, 2, 'KKKk', 'wWWK', 'WHIW', '.Ii.'),
  happy: t(1, 1, '.KK.', 'K..K'),
  closed: t(1, 1, '....', 'kKKk'),
};
const WOMAN_NEAR: Record<string, T> = {
  dot: t(2, 2, 'K.....', '.KKKKk', 'KwHII.', '.WIIi.', '..LL..'),
  half: t(2, 2, 'K.....', '.LLLL.', 'KKKKKk', '.WIIi.', '..LL..'),
  angry: t(2, 2, 'K.....', '.KK...', 'KwHKKk', '.WIIi.', '..LL..'),
  sad: t(2, 2, '......', '..KKKk', 'KKHII.', '.WIIi.', '..LL..'),
  wide: t(2, 2, 'K.....', '.KKKKk', 'KwWWW.', '.WHIW.', '..Ii..', '..LL..'),
  happy: t(2, 2, '......', 'K.....', '.KKKK.', 'K....K', '.l..l.'),
  closed: t(2, 2, '......', '......', 'KkKKKk', '.l....'),
};
const WOMAN_FAR: Record<string, T> = {
  dot: t(1, 2, '....', 'KKKK', 'wHIK', 'WIi.', '.L..'),
  half: t(1, 2, '....', 'LLLL', 'kKKK', 'WIi.', '.L..'),
  angry: t(1, 2, '....', '..KK', 'KHKK', 'WIi.', '.L..'),
  sad: t(1, 2, '....', 'KKk.', 'kHIK', 'WIi.', '.L..'),
  wide: t(1, 2, 'KKKK', 'wWWK', 'WHIW', '.Ii.', '.L..'),
  happy: t(1, 2, '....', '.KK.', 'K..K', '.l..'),
  closed: t(1, 2, '....', '....', 'kKKK', '....'),
};
/** Joshu: always narrowed, a short dark slit under a heavy brow ridge */
const SLIT_NEAR: Record<string, T> = {
  dot: t(2, 1, 'LKKKK.', 'kKIIK.'),
  wide: t(2, 1, '.KKKK.', 'kWIIK.'),
  happy: t(2, 1, '.KKK..', 'K...K.', '.l.l..'),
  closed: t(2, 1, 'LLLL..', 'kKKKk.'),
};
const SLIT_FAR: Record<string, T> = {
  dot: t(1, 1, 'KKKK', 'KIIK'),
  wide: t(1, 1, 'KKKK', 'WIIK'),
  happy: t(1, 1, '.KK.', 'K..K'),
  closed: t(1, 1, 'LLL.', 'kKKk'),
};

// ------------------------------------------------------------------ brows
// B brow, b its soft end. Anchor: the eye centre (the brow's lowest neutral row sits two rows over the
// lid, one clear row between). Near brows run from past the outer corner to the inner end (right),
// which is the thicker end; far brows mirror it and are shorter.
const BROW_MAN_NEAR: Record<string, T> = {
  flat: t(3, 4, 'bBBBBB', '...BBB'),
  angry: t(3, 4, 'bBB...', '.bBBBB', '....BB'),
  sad: t(3, 5, '....BB', '.bBBB.', 'bb....'),
};
const BROW_MAN_FAR: Record<string, T> = {
  flat: t(1, 4, 'BBBBb', 'BB...'),
  angry: t(1, 4, '...Bb', 'BBBb.', 'BB...'),
  sad: t(1, 5, 'BB...', '.BBb.', '...bb'),
};
const BROW_WOMAN_NEAR: Record<string, T> = {
  flat: t(3, 5, '.bBBBB'),
  angry: t(3, 5, 'bBB...', '...BBB'),
  sad: t(3, 6, '....BB', 'bBBB..'),
};
const BROW_WOMAN_FAR: Record<string, T> = {
  flat: t(1, 5, 'BBBb'),
  angry: t(1, 5, '..Bb', 'BBB.'),
  sad: t(1, 6, 'BB..', '..Bb'),
};
/** Joshu: bushy pale brows pressing down on the slit */
const BROW_SLIT_NEAR: Record<string, T> = {
  flat: t(3, 3, 'bBBBBB', 'BBBBBB'),
  angry: t(3, 3, 'bBB...', 'BBBBBB', '...BBB'),
  sad: t(3, 4, '....BB', 'bBBBBB', 'BBB...'),
};
const BROW_SLIT_FAR: Record<string, T> = {
  flat: t(1, 3, 'BBBBb', 'BBBB.'),
  angry: t(1, 3, '...Bb', 'BBBBB', 'BBB..'),
  sad: t(1, 4, 'BB...', 'BBBBb', '..BB.'),
};

// ------------------------------------------------------------------ mouths
// L lip line, l lower-lip shadow, D mouth dark, T tongue, Y teeth, R lip colour (women), r its light.
const MOUTH_MAN: Record<string, T> = {
  none: t(1, 0, 'LLLk', '....', '.ll.'),
  smile: t(1, 0, 'k..k', '.LL.', '....', '.ll.'),
  open: t(1, 0, 'LDDk', '.DD.', '....', '.ll.'),
  o: t(1, 0, '.DD', '.DD', '...', '.l.'),
  frown: t(1, 0, '.LL.', 'k..k', '.ll.'),
  grit: t(1, 0, 'DYYD', 'kDDk', '.ll.'),
  shout: t(1, 0, 'DYYYD', 'DDDDD', 'DTTTD', '.DDD.'),
};
const MOUTH_WOMAN: Record<string, T> = {
  none: t(1, 0, 'LRL', '.r.'),
  smile: t(1, 0, 'L..L', '.RR.', '.rr.'),
  open: t(1, 0, 'RDDR', '.DD.', '.rr.'),
  o: t(1, 0, '.DD', '.DD', '.r.'),
  frown: t(1, 0, '.RR.', 'L..L'),
  grit: t(1, 0, 'DYYD', 'RDDR'),
  shout: t(1, 0, 'DYYYD', 'DDDDD', 'DTTTD', '.DDD.'),
};

interface Pal { [k: string]: C }
const pals = new WeakMap<HeadDef7, [Pal, Pal]>();
function palette(d: HeadDef7, fem: boolean): Pal {
  let hit = pals.get(d);
  if (!hit) {
    const mk = (f: boolean): Pal => {
      const s = d.skin;
      const K = mix(hex(d.eyeCol), 0xff000000, 0.3);
      const [i0, i1] = d.face?.iris ?? ['#4a2e22', '#a06a3e'];
      const iris = hex(i0), irisL = hex(i1);
      const brow = hex(d.brow);
      const W = mix(hex('#f8f0ea'), s[4], 0.12);
      return {
        K, k: mix(K, s[2], 0.45),
        W, w: mix(W, s[2], 0.5),
        I: mix(iris, K, 0.45), i: mix(iris, irisL, 0.45), H: 0xffffffff,
        L: mix(s[2], s[1], 0.25), l: mix(s[2], s[3], 0.35),
        B: f ? mix(brow, s[2], 0.25) : brow, b: mix(brow, s[2], f ? 0.6 : 0.45),
        D: mix(hex('#3a0e14'), s[0], 0.3), T: hex('#b8505a'), Y: hex('#f2ebe4'),
        R: mix(s[1], hex('#9a2a34'), 0.45), r: mix(s[3], hex('#e08a8a'), 0.3),
        p: mix(hex(d.blush), s[3], 0.2),
      };
    };
    hit = [mk(false), mk(true)];
    pals.set(d, hit);
  }
  return hit[fem ? 1 : 0];
}

/** stamp a cluster (drawn for dir = +1) at (x, y), mirrored for a face turned left */
function stamp(put: Put, P: Pal, T: T | undefined, x: number, y: number, dir: 1 | -1, over?: Pal) {
  if (!T) return;
  T.r.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = over?.[ch] ?? P[ch];
      if (c !== undefined) put(x + (i - T.ax) * dir, y + j - T.ay, c);
    }
  });
}

const eyeKey = (e: HeadExpr7['eye']) => (e === 'dot' ? 'dot' : e);

/** paint the face */
export function paintFaceMid7(put: Put, f: FaceMid7) {
  const { d, ex, dir, fem } = f;
  const P = palette(d, fem);
  const slit = d.eyeStyle === 'slit';
  // the mouth's own palette: a man's lip line is a skin shadow, never colour
  const mouthOver: Pal | undefined = fem ? undefined : { L: mix(d.skin[1], hex('#5a1e1e'), 0.3), k: mix(d.skin[2], d.skin[1], 0.4), l: mix(d.skin[2], d.skin[3], 0.25) };
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  const browKey = ex.browTilt < 0 ? 'angry' : ex.browTilt > 0 ? 'sad' : 'flat';
  const lift = ex.brow > 1 ? 1 : 0;
  // slit eyes keep their narrowed set (the glare, sorrow and the rest all read as the slit)
  const slitKey = (e: string) => (e === 'wide' || e === 'happy' || e === 'closed' ? e : 'dot');
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const x = Math.round(c[0]), y = Math.round(c[1]);
    const E = slit ? (near ? SLIT_NEAR : SLIT_FAR)[slitKey(f.eye)] : (fem ? (near ? WOMAN_NEAR : WOMAN_FAR) : near ? MAN_NEAR : MAN_FAR)[eyeKey(f.eye)];
    // the near eye's outer corner is away from the look (left of it for a face turned right), the far
    // eye's toward it: the far clusters are drawn that way round already
    stamp(put, P, E, x, y, dir);
    if (browOn) {
      const BT = slit ? (near ? BROW_SLIT_NEAR : BROW_SLIT_FAR) : fem ? (near ? BROW_WOMAN_NEAR : BROW_WOMAN_FAR) : near ? BROW_MAN_NEAR : BROW_MAN_FAR;
      stamp(put, P, BT[browKey], x, y - lift, dir);
    }
    // a woman's blush: a soft two-pixel stroke under the eye (a man colours only at the cheek's edge)
    if (ex.blush && near) {
      if (fem) { put(x - dir, y + 3, P.p); put(x, y + 3, P.p); }
      else put(x - 2 * dir, y + 2, mix(P.p, d.skin[3], 0.4));
    }
    if (d.face?.freckles && near) { const fc = mix(P.l, P.p, 0.5); put(x - 2 * dir, y + 2, fc); put(x, y + 3, fc); put(x + 2 * dir, y + 2, fc); }
  }
  // the nose: a lit bridge above the tip, a shadow under it
  const nx = Math.round(f.nose[0]), ny = Math.round(f.nose[1]);
  const hi = mix(d.skin[4], d.skin[5], 0.7), sh = mix(d.skin[2], d.skin[1], 0.35);
  put(nx - dir, ny - 2, hi);
  put(nx - dir, ny - 1, hi);
  put(nx + dir, ny, sh);
  put(nx, ny + 1, sh);
  put(nx - dir, ny + 1, d.skin[2]);
  // the mouth
  const M = (fem ? MOUTH_WOMAN : MOUTH_MAN)[f.mouthShape] ?? (fem ? MOUTH_WOMAN : MOUTH_MAN).none;
  stamp(put, P, M, Math.round(f.mouth[0]), Math.round(f.mouth[1]), dir, mouthOver);
}

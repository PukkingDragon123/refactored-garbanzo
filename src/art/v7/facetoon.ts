// V12 cartoon sprite faces (user: "make charter lower resolution more cartoony art style"): the face
// drawn at the world's own pixel size, a few bold pixels per feature so the expression reads at game
// scale, after the mid face (facemid.ts, kept) at 1.5x.
//  - eyes: a dark eye with a white catch-light toward the key light (upper left). Men: two pixels
//    tall under a strong lid that runs out past the outer corner (narrow, almond); women: three tall
//    with a lash flicking up off the outer corner. Happy is an arc, closed a line, wide a taller eye.
//  - brows: a bold bar one row clear of the lid; angry drives the inner end down onto the eye, sad
//    lifts it, surprise raises both. Men's are dark and straight, women's lighter and higher.
//  - mouth: a short line, a smile cup, a dark open mouth with a tongue (talking), teeth bared in anger.
//  - the nose is the 3D head's own bump: one shadow pixel under the tip.
// Clusters are drawn for a face turned to the screen's right and mirrored for one turned left. In the
// cast's 3/4 turn the near eye sits left of the nose and the far eye right of it, so the far clusters
// are the near ones mirrored (inner corners toward the nose), a pixel narrower.

import { C, hex, mix } from '../color';
import type { HeadDef7, HeadExpr7 } from './head';
import type { Put } from './face7';
import type { FaceMid7 } from './facemid';

/** a cluster: rows of palette letters ('.' = leave the skin), placed with cell (ax, ay) on the anchor */
interface T { r: string[]; ax: number; ay: number }
const t = (ax: number, ay: number, ...r: string[]): T => ({ r, ax, ay });

// ------------------------------------------------------------------ eyes
// K eye ink, k the lid's soft tail, I iris, H catch-light, W white. The anchor is the eye's lower inner
// pixel (the near eye's inner corner is on its right).
const MAN_NEAR: Record<string, T> = {
  dot: t(2, 1, 'kKK', '.HI'),
  half: t(2, 1, '...', 'kKK', '..I'),
  angry: t(2, 1, 'kK.', '.HK'),
  sad: t(2, 1, '.KK', 'kHI'),
  wide: t(2, 2, '.KK', '.HI', '.IK'),
  happy: t(2, 1, '.K.', 'K.K'),
  closed: t(2, 1, '...', 'kKK'),
};
const MAN_FAR: Record<string, T> = {
  dot: t(0, 1, 'KK', 'HI'),
  half: t(0, 1, '..', 'KK', 'I.'),
  angry: t(0, 1, '.K', 'HK'),
  sad: t(0, 1, 'KK', 'HI'),
  wide: t(0, 2, 'KK', 'HI', 'IK'),
  happy: t(0, 1, '.K.', 'K.K'),
  closed: t(0, 1, '..', 'KK'),
};
const WOMAN_NEAR: Record<string, T> = {
  dot: t(2, 2, 'kKK', '.HI', '.II'),
  half: t(2, 2, '...', 'kKK', '.II'),
  angry: t(2, 2, 'kK.', '.HK', '.II'),
  sad: t(2, 2, '.KK', 'kHI', '.II'),
  wide: t(2, 2, 'kKK', '.HI', '.II', '..I'),
  happy: t(2, 2, '...', '.K.', 'K.K'),
  closed: t(2, 2, '...', '...', 'kKK'),
};
const WOMAN_FAR: Record<string, T> = {
  dot: t(0, 2, 'KK', 'HI', 'II'),
  half: t(0, 2, '..', 'KK', 'II'),
  angry: t(0, 2, '.K', 'HK', 'II'),
  sad: t(0, 2, 'KK', 'HI', 'II'),
  wide: t(0, 2, 'KK', 'HI', 'II', 'I.'),
  happy: t(0, 2, '..', '.K.', 'K.K'),
  closed: t(0, 2, '..', '..', 'KK'),
};
/** Joshu: always narrowed, a short dark slit under a heavy brow */
const SLIT_NEAR: Record<string, T> = {
  dot: t(2, 0, 'kKK'),
  wide: t(2, 1, '.KK', '.HK'),
  happy: t(2, 1, '.K.', 'K.K'),
  closed: t(2, 0, 'kKK'),
};
const SLIT_FAR: Record<string, T> = {
  dot: t(0, 0, 'KK'),
  wide: t(0, 1, 'KK', 'HK'),
  happy: t(0, 1, '.K.', 'K.K'),
  closed: t(0, 0, 'KK'),
};

// ------------------------------------------------------------------ brows
// B brow, b its soft end. Anchor: the eye's anchor; men's sit on the row two above the lid, women's one
// higher; near brows thicken toward the inner end (right).
const BROW_MAN_NEAR: Record<string, T> = {
  flat: t(2, 3, 'bBB'),
  angry: t(2, 3, 'bB.', '..B'),
  sad: t(2, 4, '..B', 'bB.'),
};
const BROW_MAN_FAR: Record<string, T> = {
  flat: t(0, 3, 'BB'),
  angry: t(0, 3, '.B', 'B.'),
  sad: t(0, 4, 'B.', '.B'),
};
const BROW_WOMAN_NEAR: Record<string, T> = {
  flat: t(2, 4, 'bBB'),
  angry: t(2, 4, 'bB.', '..B'),
  sad: t(2, 5, '..B', 'bB.'),
};
const BROW_WOMAN_FAR: Record<string, T> = {
  flat: t(0, 4, 'BB'),
  angry: t(0, 4, '.B', 'B.'),
  sad: t(0, 5, 'B.', '.B'),
};
/** Joshu: bushy pale brows pressing down on the slit */
const BROW_SLIT_NEAR: Record<string, T> = {
  flat: t(2, 2, 'bBBB'),
  angry: t(2, 2, 'bB..', '..BB'),
  sad: t(2, 3, '..BB', 'bB..'),
};
const BROW_SLIT_FAR: Record<string, T> = {
  flat: t(0, 2, 'BBB'),
  angry: t(0, 2, '.BB', 'B..'),
  sad: t(0, 3, 'BB.', '..B'),
};

// ------------------------------------------------------------------ mouths
// L lip line, D mouth dark, T tongue, Y teeth, R lip colour (women). Anchor: the mouth point.
const MOUTH_MAN: Record<string, T> = {
  none: t(1, 0, 'LL'),
  smile: t(1, 0, 'L..L', '.LL.'),
  open: t(1, 0, 'DD', 'TD'),
  o: t(0, 0, 'DD', 'DD'),
  frown: t(1, 0, '.LL.', 'L..L'),
  grit: t(1, 0, 'DYYD', '.LL.'),
  shout: t(1, 0, 'DYYD', 'DDDD', '.TT.'),
};
const MOUTH_WOMAN: Record<string, T> = {
  none: t(1, 0, 'RR'),
  smile: t(1, 0, 'R..R', '.RR.'),
  open: t(1, 0, 'DD', 'TD'),
  o: t(0, 0, 'DD', 'DD'),
  frown: t(1, 0, '.RR.', 'R..R'),
  grit: t(1, 0, 'DYYD', '.RR.'),
  shout: t(1, 0, 'DYYD', 'DDDD', '.TT.'),
};

interface Pal { [k: string]: C }
const pals = new WeakMap<HeadDef7, [Pal, Pal]>();
function palette(d: HeadDef7, fem: boolean): Pal {
  let hit = pals.get(d);
  if (!hit) {
    const mk = (f: boolean): Pal => {
      const s = d.skin;
      const K = mix(hex(d.eyeCol), 0xff000000, 0.35);
      const [i0, i1] = d.face?.iris ?? ['#4a2e22', '#a06a3e'];
      const brow = hex(d.brow);
      return {
        K, k: mix(K, s[2], 0.35),
        I: mix(mix(hex(i0), hex(i1), 0.35), K, 0.25), H: 0xffffffff,
        // (pale brows, Joshu's, stay pale: only dark brows are pushed darker)
        B: f ? mix(brow, s[1], 0.15) : (brow & 255) > 160 ? brow : mix(brow, 0xff000000, 0.15), b: mix(brow, s[2], f ? 0.45 : 0.3),
        L: mix(s[1], s[0], 0.5), D: mix(hex('#2a080e'), s[0], 0.2), T: hex('#d0505a'), Y: hex('#fff8f0'),
        R: mix(s[1], hex('#b8283a'), 0.55),
        p: mix(hex(d.blush), hex('#ff6a7a'), 0.25),
      };
    };
    hit = [mk(false), mk(true)];
    pals.set(d, hit);
  }
  return hit[fem ? 1 : 0];
}

/** stamp a cluster (drawn for dir = +1) at (x, y), mirrored for a face turned left (and for the far side) */
function stamp(put: Put, P: Pal, T: T | undefined, x: number, y: number, dir: 1 | -1) {
  if (!T) return;
  T.r.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = P[ch];
      if (c !== undefined) put(x + (i - T.ax) * dir, y + j - T.ay, c);
    }
  });
}

/** paint the cartoon face (same anchors as the mid face) */
export function paintFaceToon7(put: Put, f: FaceMid7) {
  const { d, ex, dir, fem } = f;
  const P = palette(d, fem);
  const slit = d.eyeStyle === 'slit';
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  const browKey = ex.browTilt < 0 ? 'angry' : ex.browTilt > 0 ? 'sad' : 'flat';
  const lift = ex.brow > 1 ? 1 : 0;
  const slitKey = (e: string) => (e === 'wide' || e === 'happy' || e === 'closed' ? e : 'dot');
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const x = Math.round(c[0]), y = Math.round(c[1]);
    const E = slit ? (near ? SLIT_NEAR : SLIT_FAR)[slitKey(f.eye)] : (fem ? (near ? WOMAN_NEAR : WOMAN_FAR) : near ? MAN_NEAR : MAN_FAR)[f.eye];
    stamp(put, P, E, x, y, dir);
    if (browOn) {
      const BT = slit ? (near ? BROW_SLIT_NEAR : BROW_SLIT_FAR) : fem ? (near ? BROW_WOMAN_NEAR : BROW_WOMAN_FAR) : near ? BROW_MAN_NEAR : BROW_MAN_FAR;
      stamp(put, P, BT[browKey], x, y - lift, dir);
    }
    // blush: a pink dab on the cheek under the eye (two on a woman's near cheek)
    if (ex.blush) {
      if (near) { put(x - 2 * dir, y + 2, P.p); if (fem) put(x - dir, y + 2, P.p); }
      else put(x + dir, y + 2, P.p);
    }
  }
  // the nose: a shadow pixel under the tip
  put(Math.round(f.nose[0]), Math.round(f.nose[1]) + 1, mix(d.skin[2], d.skin[1], 0.3));
  const M = (fem ? MOUTH_WOMAN : MOUTH_MAN)[f.mouthShape] ?? (fem ? MOUTH_WOMAN : MOUTH_MAN).none;
  stamp(put, P, M, Math.round(f.mouth[0]), Math.round(f.mouth[1]), dir);
}

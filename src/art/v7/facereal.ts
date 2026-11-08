// V12 realistic sprite faces, for the sculpted heads (user, latest: "remake the head and face ... make
// them like realistic ... genuinely lock in"; before: "simplify it ... no ugly"). Few marks, each one a
// real feature in its real place, so the face reads as a person and nothing reads as off:
//  - eyes: the upper lid line (the darkest mark on a face), the iris under it with its catch-light
//    inside, a sliver of the white in the lid's shade at the outer corner (never a bright white beside
//    the iris: that stares). The near eye a pixel wider than the far one (the turn of the head), both
//    the same height. A woman's lashes flick up at the outer corner.
//  - brows: tapered, thicker at the inner end, arching over the eye and tilting with the mood
//  - nose: the sculpted head carries it (the bridge, the tip, the wings); one shadow under the tip
//  - mouth: the line between the lips and the soft shadow under the lower lip (a woman's lips rosier)
// The detailed V12 face (facemid.ts) and the bead-eyed simple face (facesimple.ts) are kept, unused.
// Every cluster is drawn for a face turned to the screen's right and mirrored for one turned left.

import { C, hex, mix } from '../color';
import type { FaceMid7 } from './facemid';
import type { HeadDef7 } from './head';
import type { Put } from './face7';

interface T { r: string[]; ax: number; ay: number }
const t = (ax: number, ay: number, ...r: string[]): T => ({ r, ax, ay });

// K lid line, k its soft inner end, I iris, i iris (its lit lower half), H catch-light, w the white in
// shade, L the lid's shadow. Near eye: outer corner on the left, inner (toward the nose) on the right.
const MAN_NEAR: Record<string, T> = {
  dot: t(1, 1, 'KKKk', 'wIHk', '.Ii.'),
  half: t(1, 1, 'LLL.', 'KKKk', '.IH.'),
  angry: t(1, 1, 'KK..', 'wKKK', '.IH.'),
  sad: t(1, 1, '..Kk', 'KKIH', '.Ii.'),
  wide: t(1, 1, 'KKKk', 'wIHw', 'wIiw'),
  happy: t(2, 1, '.KK.', 'K..K'),
  closed: t(1, 0, 'KKKk'),
};
// far eye: inner corner on the left, outer (by the cheek's edge) on the right
const MAN_FAR: Record<string, T> = {
  dot: t(1, 1, 'kKK', 'kIH', '.Ii'),
  half: t(1, 1, '.LL', 'kKK', '.IH'),
  angry: t(1, 1, '..K', 'KKK', '.IH'),
  sad: t(1, 1, 'KK.', 'kIH', '.Ii'),
  wide: t(1, 1, 'kKK', 'IHw', 'Iiw'),
  happy: t(1, 1, '.K.', 'K.K'),
  closed: t(1, 0, 'kKK'),
};
const WOMAN_NEAR: Record<string, T> = {
  dot: t(2, 2, 'K....', '.KKKk', '.wIHk', '..Ii.'),
  half: t(2, 2, '.....', 'KLLL.', '.KKKk', '..IH.'),
  angry: t(2, 2, 'K....', '.KK..', '.wKKK', '..IH.'),
  sad: t(2, 2, '.....', '...Kk', 'KKKIH', '..Ii.'),
  wide: t(2, 2, 'K....', '.KKKk', '.wIHw', '.wIiw'),
  happy: t(3, 1, 'K.KK.', '.K..K'),
  closed: t(2, 0, 'KKKKk'),
};
const WOMAN_FAR: Record<string, T> = {
  dot: t(1, 2, '...K', 'kKK.', 'kIH.', '.Ii.'),
  half: t(1, 2, '....', '.LLK', 'kKK.', '.IH.'),
  angry: t(1, 2, '...K', '..K.', 'KKK.', '.IH.'),
  sad: t(1, 2, '....', 'KK..', 'kIHK', '.Ii.'),
  wide: t(1, 2, '...K', 'kKK.', 'IHw.', 'Iiw.'),
  happy: t(1, 1, '.K.K', 'K.K.'),
  closed: t(1, 0, 'kKKK'),
};
/** Joshu: always narrowed, a dark slit under a heavy brow */
const SLIT_NEAR: Record<string, T> = {
  dot: t(1, 0, 'KIIk'),
  wide: t(1, 1, 'KKKk', 'wIHk'),
  happy: t(2, 1, '.KK.', 'K..K'),
  closed: t(1, 0, 'KKKk'),
};
const SLIT_FAR: Record<string, T> = {
  dot: t(1, 0, 'kII'),
  wide: t(1, 1, 'kKK', 'kIH'),
  happy: t(1, 1, '.K.', 'K.K'),
  closed: t(1, 0, 'kKK'),
};

// B brow, b its tapered outer end. Near: outer end left, inner (thicker) right; far: mirrored.
const BROW_MAN_NEAR: Record<string, T> = {
  flat: t(2, 3, '.bBBB', 'b...B'),
  angry: t(2, 4, 'bB...', '..BBB', '....B'),
  sad: t(2, 4, '...BB', 'bBB..'),
};
const BROW_MAN_FAR: Record<string, T> = {
  flat: t(1, 3, 'BBb', 'B..'),
  angry: t(1, 4, '..b', 'BB.', 'B..'),
  sad: t(1, 4, 'B..', '.Bb'),
};
const BROW_WOMAN_NEAR: Record<string, T> = {
  flat: t(2, 4, '.bBBB', 'b....'),
  angry: t(2, 5, 'bB...', '..BBB'),
  sad: t(2, 5, '...BB', 'bBB..'),
};
const BROW_WOMAN_FAR: Record<string, T> = {
  flat: t(1, 4, 'BBb', '..b'),
  angry: t(1, 5, '..b', 'BB.'),
  sad: t(1, 5, 'B..', '.Bb'),
};
const BROW_SLIT_NEAR: Record<string, T> = {
  flat: t(2, 2, 'bBBBB', 'BBBBB'),
  angry: t(2, 2, 'bB...', 'BBBBB', '..BBB'),
  sad: t(2, 3, '...BB', 'bBBBB'),
};
const BROW_SLIT_FAR: Record<string, T> = {
  flat: t(1, 2, 'BBBb', 'BBB.'),
  angry: t(1, 2, '..Bb', 'BBBB', 'BB..'),
  sad: t(1, 3, 'BB..', 'BBBb'),
};

// L the line between the lips, l the shadow under the lower lip, D the open mouth, Y teeth, T tongue,
// R / r a woman's lip colour and its light
const MOUTH_MAN: Record<string, T> = {
  none: t(1, 0, 'LLL', '.l.'),
  smile: t(1, 0, 'L..L', '.LL.', '..l.'),
  open: t(1, 0, 'LDDL', '.DD.', '.l..'),
  o: t(0, 0, 'DD', 'DD'),
  frown: t(1, 0, '.LL.', 'L..L'),
  grit: t(1, 0, 'DYYD', '.DD.'),
  shout: t(1, 0, 'DYYD', 'DTTD', '.DD.'),
};
const MOUTH_WOMAN: Record<string, T> = {
  none: t(1, 0, 'LRL', '.r.'),
  smile: t(1, 0, 'L..L', '.RR.', '.rr.'),
  open: t(1, 0, 'RDDR', '.DD.', '.rr.'),
  o: t(0, 0, 'DD', 'DD'),
  frown: t(1, 0, '.RR.', 'L..L'),
  grit: t(1, 0, 'DYYD', 'RDDR'),
  shout: t(1, 0, 'DYYD', 'DTTD', '.DD.'),
};

interface Pal { [k: string]: C }
const pals = new WeakMap<HeadDef7, [Pal, Pal]>();
function palette(d: HeadDef7, fem: boolean): Pal {
  let hit = pals.get(d);
  if (!hit) {
    const mk = (f: boolean): Pal => {
      const s = d.skin;
      const K = mix(hex(d.eyeCol), 0xff080404, 0.35);
      const [i0, i1] = d.face?.iris ?? ['#4a2e22', '#a06a3e'];
      const iris = hex(i0), irisL = hex(i1);
      const brow = hex(d.brow);
      return {
        K, k: mix(K, s[2], 0.5),
        w: mix(hex('#f0e6dc'), s[3], 0.5),
        I: mix(iris, K, 0.5), i: mix(iris, irisL, 0.35), H: mix(0xffffffff, irisL, 0.15),
        L: mix(s[2], s[1], 0.3),
        B: f ? mix(brow, s[2], 0.25) : brow, b: mix(brow, s[2], f ? 0.6 : 0.5),
        D: mix(hex('#3a0e14'), s[0], 0.3), T: hex('#b8505a'), Y: hex('#efe6de'),
        R: mix(s[2], hex('#a8323c'), 0.42), r: mix(s[3], hex('#e08a8a'), 0.3),
        p: mix(hex(d.blush), s[3], 0.25),
        n: mix(s[2], s[1], 0.35),
      };
    };
    hit = [mk(false), mk(true)];
    pals.set(d, hit);
  }
  return hit[fem ? 1 : 0];
}

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

/** paint the realistic face */
export function paintFaceReal7(put: Put, f: FaceMid7) {
  const { d, ex, dir, fem } = f;
  const P = palette(d, fem);
  const slit = d.eyeStyle === 'slit';
  // a man's mouth line is a deep skin tone, never a colour
  const mouthOver: Pal | undefined = fem ? undefined : { L: mix(d.skin[1], hex('#5a1e1e'), 0.3), l: mix(d.skin[2], d.skin[3], 0.3) };
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  const browKey = ex.browTilt < 0 ? 'angry' : ex.browTilt > 0 ? 'sad' : 'flat';
  const lift = ex.brow > 1 ? 1 : 0;
  const slitKey = (e: string) => (e === 'wide' || e === 'happy' || e === 'closed' ? e : 'dot');
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const x = Math.round(c[0]), y = Math.round(c[1]);
    const set = slit ? (near ? SLIT_NEAR : SLIT_FAR) : fem ? (near ? WOMAN_NEAR : WOMAN_FAR) : near ? MAN_NEAR : MAN_FAR;
    stamp(put, P, set[slit ? slitKey(f.eye) : f.eye] ?? set.dot, x, y, dir);
    if (browOn) {
      const BT = slit ? (near ? BROW_SLIT_NEAR : BROW_SLIT_FAR) : fem ? (near ? BROW_WOMAN_NEAR : BROW_WOMAN_FAR) : near ? BROW_MAN_NEAR : BROW_MAN_FAR;
      stamp(put, P, BT[browKey], x, y - lift, dir);
    }
    if (ex.blush && near) { put(x - dir, y + 3, P.p); put(x, y + 3, P.p); }
    if (d.face?.freckles && near) { const fc = mix(P.n, P.p, 0.5); put(x - 2 * dir, y + 2, fc); put(x, y + 3, fc); }
  }
  // the nose: the shadow under its tip
  put(Math.round(f.nose[0]), Math.round(f.nose[1]) + 1, P.n);
  // the mouth
  const M = (fem ? MOUTH_WOMAN : MOUTH_MAN)[f.mouthShape] ?? (fem ? MOUTH_WOMAN : MOUTH_MAN).none;
  stamp(put, P, M, Math.round(f.mouth[0]), Math.round(f.mouth[1]), dir, mouthOver);
}

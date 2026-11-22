// V12 faces at the world's own pixel size (user, latest: "make the player feel more human, stylize,
// lower resolution, same resolution as the game"). The cast is drawn one buffer pixel per world pixel
// (body.ts CAST_DENS7 = 1), so a face is a handful of hand-placed pixels, each a real feature:
//  - eyes: a dark lid line over the iris, never a bright white beside it (that stares). The near eye
//    is two pixels wide (its lid over the iris at the inner corner, a sliver of the white in the lid's
//    shade at the outer), the far eye one, foreshortened by the turn of the head; both on one line.
//    A woman's lid is darker all the way across, with her lash flicked up at the outer corner.
//  - brows: two pixels (one at the far eye), a row clear of the lid, tilting with the mood
//  - nose: the sculpted head carries the bridge; one shadow pixel under its tip
//  - mouth: one or two pixels in a deep skin tone (a woman's a little rosier), opening dark when he talks
// Under the jaw there is no inked line: head.ts paints the jaw's shadow there.
// Every cluster is drawn for a face turned to the screen's right and mirrored for one turned left.
// The finer faces for the old two-pixel grid (facereal.ts, facemid.ts, facesimple.ts) are kept, unused.

import { C, hex, mix } from '../color';
import type { FaceMid7 } from './facemid';
import type { HeadDef7 } from './head';
import type { Put } from './face7';

interface T { r: string[]; ax: number; ay: number }
const t = (ax: number, ay: number, ...r: string[]): T => ({ r, ax, ay });

// K lid line, k its soft end, I iris, i iris (lit), w the white in the lid's shade, S the lid's shadow (half shut).
// The anchor (ax, ay) sits on the eye's projected centre. Near eye: outer corner left, inner (toward the nose) right.
const MAN_NEAR: Record<string, T> = {
  dot: t(0, 1, 'kK', 'wI'),
  half: t(0, 1, 'SS', 'kK'),
  angry: t(0, 1, 'k.', 'KK'),
  sad: t(0, 1, '.k', 'KI'),
  wide: t(0, 1, 'kK', 'wI', '.i'),
  happy: t(0, 1, '.k', 'K.'),
  closed: t(0, 1, '..', 'kK'),
};
// far eye: one pixel across (the eye turned away), its lid soft at the outer end
const MAN_FAR: Record<string, T> = {
  dot: t(0, 1, 'K', 'I'),
  half: t(0, 1, 'S', 'K'),
  angry: t(0, 1, '.', 'K'),
  sad: t(0, 1, 'k', 'I'),
  wide: t(0, 1, 'K', 'I', 'i'),
  happy: t(0, 1, 'K', '.'),
  closed: t(0, 1, '.', 'K'),
};
const WOMAN_NEAR: Record<string, T> = {
  dot: t(0, 1, 'KK', 'wI'),
  half: t(0, 1, 'SS', 'KK'),
  angry: t(0, 1, 'K.', 'KK'),
  sad: t(0, 1, '.k', 'KI'),
  wide: t(0, 1, 'KK', 'wI', '.i'),
  happy: t(0, 1, '.K', 'K.'),
  closed: t(0, 1, '..', 'KK'),
};
const WOMAN_FAR: Record<string, T> = {
  dot: t(0, 1, 'K', 'I'),
  half: t(0, 1, 'S', 'K'),
  angry: t(0, 1, '.', 'K'),
  sad: t(0, 1, 'k', 'I'),
  wide: t(0, 1, 'K', 'I', 'i'),
  happy: t(0, 1, 'K', '.'),
  closed: t(0, 1, '.', 'K'),
};
/** Joshu: always narrowed, a dark slit under a heavy brow */
const SLIT_NEAR: Record<string, T> = {
  dot: t(0, 0, 'KI'),
  wide: t(0, 1, 'kK', '.I'),
  happy: t(0, 1, '.k', 'K.'),
  closed: t(0, 0, 'kK'),
};
const SLIT_FAR: Record<string, T> = {
  dot: t(0, 0, 'K'),
  wide: t(0, 1, 'K', 'I'),
  happy: t(0, 1, 'K', '.'),
  closed: t(0, 0, 'K'),
};

// B brow, b its soft end. Near: outer end left, inner right; far: one or two pixels.
const BROW_NEAR: Record<string, T> = {
  flat: t(0, 3, 'bB'),
  angry: t(0, 3, 'b.', '.B'),
  sad: t(0, 3, '.B', 'b.'),
};
const BROW_FAR: Record<string, T> = {
  flat: t(0, 3, 'B'),
  angry: t(0, 3, 'B'),
  sad: t(0, 4, 'B'),
};
const BROW_SLIT_NEAR: Record<string, T> = {
  flat: t(0, 2, 'BB'),
  angry: t(0, 2, 'B.', 'BB'),
  sad: t(0, 3, '.B', 'BB'),
};
const BROW_SLIT_FAR: Record<string, T> = {
  flat: t(0, 2, 'B'),
  angry: t(0, 2, 'B'),
  sad: t(0, 3, 'B'),
};

// L the line between the lips, l the soft shadow under the lower lip, D the open mouth, Y teeth, T tongue
const MOUTH: Record<string, T> = {
  none: t(0, 0, 'LL'),
  smile: t(1, 0, 'L.l', '.L.'),
  open: t(0, 0, 'DL'),
  o: t(0, 0, 'D', 'D'),
  frown: t(0, 0, '.L', 'L.'),
  grit: t(0, 0, 'DY'),
  shout: t(0, 0, 'DD', 'TD'),
};

interface Pal { [k: string]: C }
const pals = new WeakMap<HeadDef7, [Pal, Pal]>();
function palette(d: HeadDef7, fem: boolean): Pal {
  let hit = pals.get(d);
  if (!hit) {
    const mk = (f: boolean): Pal => {
      const s = d.skin;
      // the lid line: the eye's colour taken most of the way to a warm black, so it reads at one pixel
      const K = mix(hex(d.eyeCol), 0xff080404, 0.45);
      const [i0, i1] = d.face?.iris ?? ['#4a2e22', '#a06a3e'];
      const iris = hex(i0), irisL = hex(i1);
      const brow = hex(d.brow);
      return {
        K, k: mix(K, s[2], 0.45),
        w: mix(hex('#e8dcd2'), s[3], 0.55),
        I: mix(iris, K, 0.35), i: mix(iris, irisL, 0.5),
        S: mix(s[2], s[1], 0.35),
        // brows: the hair's colour, a man's a touch heavier
        B: f ? mix(brow, s[2], 0.3) : mix(brow, 0xff080404, 0.1), b: mix(brow, s[2], f ? 0.6 : 0.45),
        D: mix(hex('#3a0e14'), s[0], 0.3), T: hex('#b8505a'), Y: hex('#e8ded4'),
        // the mouth: a deep skin tone (rosier on a woman), its lower-lip shadow softer
        ...(f
          ? { L: mix(s[1], hex('#a8323c'), 0.35), l: mix(s[2], hex('#c86060'), 0.25) }
          : { L: mix(s[1], s[2], 0.35), l: mix(s[2], s[3], 0.5) }),
        p: mix(hex(d.blush), s[3], 0.35),
        n: mix(s[2], s[1], 0.3),
      };
    };
    hit = [mk(false), mk(true)];
    pals.set(d, hit);
  }
  return hit[fem ? 1 : 0];
}

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

/** paint the face at the world's pixel size */
export function paintFacePx7(put: Put, f: FaceMid7) {
  const { d, ex, dir, fem } = f;
  const P = palette(d, fem);
  const slit = d.eyeStyle === 'slit';
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  const browKey = ex.browTilt < 0 ? 'angry' : ex.browTilt > 0 ? 'sad' : 'flat';
  const lift = ex.brow > 1 ? 1 : 0;
  const slitKey = (e: string) => (e === 'wide' || e === 'happy' || e === 'closed' ? e : 'dot');
  // both eyes sit on one line (the near eye's), so a turned head never reads as a squint
  const ey = f.near ? Math.round(f.near[1]) : f.far ? Math.round(f.far[1]) : 0;
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const x = Math.round(c[0]), y = ey;
    const set = slit ? (near ? SLIT_NEAR : SLIT_FAR) : fem ? (near ? WOMAN_NEAR : WOMAN_FAR) : near ? MAN_NEAR : MAN_FAR;
    stamp(put, P, set[slit ? slitKey(f.eye) : f.eye] ?? set.dot, x, y, dir);
    // a woman's lash: one pixel flicked up off the near eye's outer corner
    if (fem && near && f.eye !== 'closed' && f.eye !== 'happy') put(x - dir, y - 1, P.K);
    if (browOn) stamp(put, P, (slit ? (near ? BROW_SLIT_NEAR : BROW_SLIT_FAR) : near ? BROW_NEAR : BROW_FAR)[browKey], x, y - lift, dir);
    if (ex.blush && near) put(x, y + 2, P.p);
  }
  // the nose: the shadow under its tip
  put(Math.round(f.nose[0]), Math.round(f.nose[1]) + 1, P.n);
  // the mouth
  stamp(put, P, MOUTH[f.mouthShape] ?? MOUTH.none, Math.round(f.mouth[0]), Math.round(f.mouth[1]), dir);
}

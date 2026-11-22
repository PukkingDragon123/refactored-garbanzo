// V12 simple sprite faces (user, latest: "the face looks ugly uncanny, simplify it ... make the face
// simple ... no ugly", after "study how Dave the Diver makes it look good and normal"). The detailed
// sprite face (facemid.ts: almond lids, whites, lashes, lip shadows, a lit nose bridge) is kept,
// unused: at sprite size every extra mark is a chance for the face to look off, and a near eye drawn
// differently from the far one, a heavy lid or a shadowed lower lip reads as a lopsided, unwell face.
// Dave the Diver's people read by the head (its shape, the hair, a hat) and a few clean marks, so:
//  - eyes: both the same, a small dark upright oval with one catch-light; no lid line, no white, no
//    lashes (a woman's eye only a pixel taller). The mood is in the brows and the oval's shape.
//  - brows: one clean line over each eye that tilts with the mood (a woman's a little shorter and lighter)
//  - nose: the 3D head carries it; one soft shadow pixel under the tip
//  - mouth: a short line in a deep skin tone (a woman's a touch rosier), a small curve for a smile,
//    a small dark shape when open
// Every cluster is drawn for a face turned to the screen's right and mirrored for one turned left.

import { C, hex, mix } from '../color';
import type { FaceMid7 } from './facemid';
import type { HeadDef7 } from './head';
import type { Put } from './face7';

/** a cluster: rows of palette letters ('.' = leave the skin), placed with cell (ax, ay) on the anchor */
interface T { r: string[]; ax: number; ay: number }
const t = (ax: number, ay: number, ...r: string[]): T => ({ r, ax, ay });

// E the eye (iris dark), H its catch-light. The anchor is the eye centre.
const EYE: Record<string, T> = {
  dot: t(1, 1, 'HE', 'EE', 'EE'),
  half: t(1, 0, 'HE', 'EE'),
  angry: t(1, 0, 'HE', 'EE'),
  sad: t(1, 1, 'HE', 'EE', 'EE'),
  wide: t(1, 2, 'HE', 'EE', 'EE', 'EE'),
  happy: t(2, 1, '.EE.', 'E..E'),
  closed: t(1, 0, 'EEE'),
};
// a woman's eye: a pixel taller
const EYE_W: Record<string, T> = {
  ...EYE,
  dot: t(1, 2, 'HE', 'EE', 'EE', 'EE'),
  sad: t(1, 2, 'HE', 'EE', 'EE', 'EE'),
  half: t(1, 1, 'HE', 'EE', 'EE'),
  angry: t(1, 1, 'HE', 'EE', 'EE'),
  wide: t(1, 2, 'HE', 'EE', 'EE', 'EE', 'EE'),
};
// Joshu's narrowed eyes: a short dark slit
const EYE_SLIT: Record<string, T> = {
  dot: t(1, 0, 'EEE'),
  wide: t(1, 1, 'HE', 'EE'),
  happy: t(2, 1, '.EE.', 'E..E'),
  closed: t(1, 0, 'EEE'),
};

// B brow. Drawn for the NEAR eye of a face turned right: its inner end (toward the nose) on the right.
// The far eye's brow is the mirror (its inner end on the left). Anchor: the eye centre.
const BROW: Record<string, T> = {
  flat: t(2, 4, 'BBBB'),
  angry: t(2, 4, 'BB..', '..BB'),
  sad: t(2, 5, '..BB', 'BB..'),
};
const BROW_W: Record<string, T> = {
  flat: t(1, 5, 'BBB'),
  angry: t(1, 5, 'B...', '.BBB'),
  sad: t(1, 6, '..B', 'BB.'),
};
const BROW_SLIT: Record<string, T> = {
  flat: t(2, 2, 'BBBB', 'BBBB'),
  angry: t(2, 2, 'BB..', 'BBBB', '..BB'),
  sad: t(2, 3, '..BB', 'BBBB'),
};

// M the mouth line, D the open mouth, Y teeth, R tongue
const MOUTH: Record<string, T> = {
  none: t(1, 0, 'MM'),
  smile: t(1, 0, 'M..M', '.MM.'),
  open: t(1, 0, 'DD', 'DD'),
  o: t(0, 0, 'DD', 'DD'),
  frown: t(1, 0, '.MM.', 'M..M'),
  grit: t(1, 0, 'DYYD', '.DD.'),
  shout: t(1, 0, 'DDDD', 'DRRD', '.DD.'),
};

interface Pal { [k: string]: C }
const pals = new WeakMap<HeadDef7, [Pal, Pal]>();
function palette(d: HeadDef7, fem: boolean): Pal {
  let hit = pals.get(d);
  if (!hit) {
    const mk = (f: boolean): Pal => {
      const s = d.skin;
      const [i0] = d.face?.iris ?? ['#4a2e22', '#a06a3e'];
      // the eye: the iris colour sunk most of the way to the eye ink, so it reads as one dark shape
      const E = mix(mix(hex(i0), hex(d.eyeCol), 0.5), 0xff0c0808, 0.45);
      const brow = hex(d.brow);
      return {
        E, H: mix(hex('#fff8f0'), s[4], 0.15),
        B: f ? mix(brow, s[2], 0.3) : mix(brow, 0xff0c0808, 0.1),
        M: f ? mix(s[1], hex('#8a2a30'), 0.35) : mix(s[1], hex('#4a1a18'), 0.25),
        D: mix(hex('#3a0e14'), s[0], 0.3), Y: hex('#f2ebe4'), R: hex('#b8505a'),
        p: mix(hex(d.blush), s[3], 0.25),
        n: mix(s[2], s[3], 0.4),
      };
    };
    hit = [mk(false), mk(true)];
    pals.set(d, hit);
  }
  return hit[fem ? 1 : 0];
}

/** stamp a cluster (drawn for dir = +1) at (x, y), mirrored for dir = -1 */
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

/** paint the simple face */
export function paintFaceSimple7(put: Put, f: FaceMid7) {
  const { d, ex, dir, fem } = f;
  const P = palette(d, fem);
  const slit = d.eyeStyle === 'slit';
  const eyes = slit ? EYE_SLIT : fem ? EYE_W : EYE;
  const brows = slit ? BROW_SLIT : fem ? BROW_W : BROW;
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  const browKey = ex.browTilt < 0 ? 'angry' : ex.browTilt > 0 ? 'sad' : 'flat';
  const lift = ex.brow > 1 ? 1 : 0;
  const eyeKey = slit ? (f.eye === 'wide' || f.eye === 'happy' || f.eye === 'closed' ? f.eye : 'dot') : f.eye;
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const x = Math.round(c[0]), y = Math.round(c[1]);
    // both eyes the same shape (the far one is not shrunk or lidded differently)
    stamp(put, P, eyes[eyeKey] ?? eyes.dot, x, y, dir);
    // the brow's inner end toward the nose: the near eye's on the facing side, the far eye's mirrored
    if (browOn) stamp(put, P, brows[browKey], x, y - lift, (near ? dir : -dir) as 1 | -1);
    if (ex.blush) { put(x - dir, y + 3, P.p); put(x, y + 3, P.p); }
  }
  // the nose: one soft shadow pixel under the tip (the volume is in the 3D head)
  put(Math.round(f.nose[0]), Math.round(f.nose[1]) + 1, P.n);
  // the mouth
  stamp(put, P, MOUTH[f.mouthShape] ?? MOUTH.none, Math.round(f.mouth[0]), Math.round(f.mouth[1]), dir);
}

// V7 anime faces: the sprite heads' eyes, brows, nose, mouth and blush, placed pixel by pixel on the
// rasterised head at the rig's raised density (about 1.6 px per head unit). Each eye is an almond
// opening under a heavy lash line: an iris that runs dark under the lid to a lit lower rim, a pupil, a
// catch-light on the light side, a sliver of white toward the corner it looks away from, a lash that
// ticks down at the outer corner (or flicks up and out on the women), and a soft lower lid. Brows are
// thicker at the inner end and tilt and lift with the mood; mouths are small shaped clusters with lips,
// teeth and a tongue when they open; blush is hatched.
// Everything is laid in screen space for a face turned to the right (`dir` mirrors it when the head
// glances back the other way); the near eye is the wider one.

import { C, hex, mix } from '../color';
import type { HeadDef7, HeadExpr7 } from './head';

export type Put = (x: number, y: number, c: C) => void;
export interface Face7 {
  /** near and far eye centres (buffer px; null when hidden) */
  near: [number, number] | null;
  far: [number, number] | null;
  mouth: [number, number];
  /** nose tip (buffer px) */
  nose: [number, number];
  /** +1: the face turned to the right of the screen, -1: to the left */
  dir: 1 | -1;
  eye: HeadExpr7['eye'];
  mouthShape: HeadExpr7['mouth'];
  ex: HeadExpr7;
  d: HeadDef7;
}

interface Pal { K: C; k: C; W: C; w: C; I: C; i: C; B: C; b: C; P: C; H: C; L: C; S: C; brow: C; brow2: C; blush: C; D: C; T: C; Tw: C; lip: C; lipL: C }

const pals = new WeakMap<HeadDef7, Pal>();
function palette(d: HeadDef7): Pal {
  const hit = pals.get(d);
  if (hit) return hit;
  const ink = mix(hex(d.eyeCol), 0xff000000, 0.35);
  const [i0, i1] = d.face?.iris ?? ['#4a2e22', '#a06a3e'];
  const iris = hex(i0), irisL = hex(i1);
  const skin = d.skin;
  const brow = hex(d.brow);
  const P: Pal = {
    K: ink,
    k: mix(ink, skin[2], 0.45),
    W: hex('#f8f0ea'),
    w: mix(hex('#f8f0ea'), skin[2], 0.45),
    I: mix(iris, ink, 0.45),
    i: iris,
    B: irisL,
    b: mix(irisL, 0xffffffff, 0.45),
    P: mix(ink, 0xff000000, 0.4),
    H: 0xffffffff,
    L: mix(skin[1], ink, 0.3),
    S: mix(skin[2], skin[1], 0.35),
    brow,
    brow2: mix(brow, skin[2], 0.45),
    blush: mix(hex(d.blush), skin[3], 0.15),
    D: hex('#3a0e14'),
    T: hex('#c85a62'),
    Tw: hex('#f4ece6'),
    lip: mix(skin[1], hex('#7a2a2a'), 0.4),
    lipL: mix(skin[4], hex('#f0a0a0'), 0.25),
  };
  pals.set(d, P);
  return P;
}

/**
 * One eye. (cx, cy): its centre; near: the wide near eye (4 px opening) or the foreshortened far one
 * (3 px); dir: which way the face looks on screen (the iris sits toward it, the white toward the back);
 * outer: the screen direction of the eye's outer corner.
 */
function eye7(put: Put, P: Pal, cx: number, cy: number, near: boolean, dir: 1 | -1, outer: 1 | -1, eye: HeadExpr7['eye'], ex: HeadExpr7, fem: boolean, slit: boolean) {
  const w = near ? 4 : 3;
  // the opening's columns, from the side the face looks away from (index 0) to the side it looks toward
  const col = (i: number) => (dir > 0 ? cx - (w >> 1) + i : cx + (w >> 1) - i);
  const top = cy - 1; // first row of the opening; the lash sits on the row above it
  const ends = [col(0), col(w - 1)];
  const outerX = outer > 0 ? Math.max(...ends) : Math.min(...ends);
  const innerX = outer > 0 ? Math.min(...ends) : Math.max(...ends);
  const lash = (y: number) => {
    for (let i = 0; i < w; i++) put(col(i), y, P.K);
    put(outerX + outer, y, fem ? P.K : P.k);
  };
  if (eye === 'closed' || eye === 'happy') {
    // closed: a lid line bowed down; happy: squeezed into an arc bowed up, the cheek pushing up under it
    const up = eye === 'happy';
    for (let i = 0; i < w; i++) { const x = col(i), end = x === outerX || x === innerX; put(x, top + (end === up ? 1 : 0), P.K); }
    put(outerX + outer, top + (up ? 2 : fem ? -1 : 0), P.k);
    put(innerX, top + 2, up ? P.S : P.L);
    return;
  }
  if (slit) {
    // narrowed under a heavy brow: lash, one row of dark iris with its glint, a creased lower lid
    lash(top);
    const open = eye === 'wide' ? 2 : 1;
    for (let r = 0; r < open; r++) for (let i = 0; i < w; i++) put(col(i), top + 1 + r, i >= w - 2 ? (r === 0 ? P.I : P.B) : P.w);
    put(col(w - 2), top + 1, eye === 'sad' ? P.b : P.H);
    put(outerX, top + 1 + open, P.L);
    if (eye === 'angry' || ex.mouth === 'smile') put(outerX + outer, top + 1 + open, P.L);
    return;
  }
  const wide = eye === 'wide', half = eye === 'half';
  // the lash row: raised a row when wide-eyed, dropped into the opening when half-lidded
  const lashY = top - (wide ? 2 : 1) + (half ? 1 : 0);
  lash(lashY);
  if (eye === 'angry') put(innerX, lashY + 1, P.K); // the lid pressed down at the inner corner
  if (eye === 'sad') { put(outerX, lashY + 1, P.K); put(outerX + outer, lashY + 1, P.k); } // drooping at the outer corner
  if (!fem) put(outerX + outer, lashY + 1, P.k); // a man's lash ticks down at the outer corner
  else { put(outerX + outer, lashY - 1, P.K); put(outerX + outer * 2, lashY - 1, P.k); } // flicked up and out
  if (half) put(innerX, lashY - 1, P.S); // the heavy lid's crease
  // the opening: white toward the back, the iris toward the look (3 px wide near, 2 far)
  const iw = near ? 3 : 2;
  const rows = wide ? 4 : 3;
  const y0 = wide ? top - 1 : top;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r;
    if (y <= lashY) continue;
    for (let i = 0; i < w; i++) {
      const x = col(i);
      if (y === lashY + 1 && ((eye === 'angry' && x === innerX) || (eye === 'sad' && x === outerX))) continue;
      const isIris = i >= w - iw;
      if (r === rows - 1 && !isIris) { if (wide) put(x, y, P.W); continue; } // the back corner tapers shut
      if (wide && r === 0) { put(x, y, P.w); continue; } // white showing above the iris
      if (!isIris) { put(x, y, r === 0 || (wide && r === 1) ? P.w : P.W); continue; }
      const ir = wide ? r - 1 : r; // iris rows: dark under the lid, mid, lit rim
      put(x, y, ir <= 0 ? P.I : ir === 1 ? P.i : P.B);
    }
  }
  // the pupil, a catch-light on the light side (screen left), a glint in the lit rim
  const ic = col(w - (near ? 2 : 1));
  const lo = Math.min(col(w - iw), col(w - 1)), hi = Math.max(col(w - iw), col(w - 1));
  const pr = wide || half ? top + 1 : top;
  put(ic, pr, P.P);
  if (!wide && !half) put(ic, pr + 1, P.P);
  put(ic - 1 >= lo ? ic - 1 : ic + 1, wide ? top : pr, P.H);
  if (near || eye === 'sad') put(ic + 1 <= hi ? ic + 1 : ic - 1, top + 2, P.b);
  // the soft lower lid at the outer corner (the women's runs a pixel further)
  const lidY = near && !wide ? y0 + rows - 1 : y0 + rows;
  put(outerX, lidY, fem ? P.L : P.S);
  if (fem) put(outerX + outer, lidY - (near && !wide ? 1 : 0), P.k);
}

/** a brow: outer → inner offsets for the tilt, thicker at the inner end */
function brow7(put: Put, P: Pal, cx: number, cy: number, near: boolean, outer: 1 | -1, ex: HeadExpr7, fem: boolean, slit: boolean) {
  const n = near ? 5 : 4;
  const t = ex.browTilt;
  // y offsets from the outer end to the inner end
  const ys = t < 0 ? [0, 0, 1, 1, 2] : t > 0 ? [1, 1, 0, 0, -1] : [1, 0, 0, 0, 0];
  const lift = ex.brow > 1 ? -1 : 0;
  const by = cy - (slit ? 3 : 4) + lift;
  const ox = cx + outer * (near ? 3 : 2);
  for (let j = 0; j < n; j++) {
    const x = ox - outer * j, y = by + ys[j + (5 - n)];
    put(x, y, P.brow);
    const thick = slit || (fem ? j >= n - 1 : j >= n - 2);
    if (thick) put(x, y + 1, slit ? P.brow : P.brow2);
    if (slit && j >= n - 3) put(x, y - 1, P.brow2);
  }
}

const MOUTH: Record<string, string[]> = {
  none: ['lL'],
  smile: ['l..l', '.LL.'],
  open: ['DD', 'TD'],
  o: ['.D.', 'DTD', '.D.'],
  frown: ['.LL.', 'l..l'],
  grit: ['DwwD', '.LL.'],
  shout: ['.DDD.', 'DwwwD', 'DDTDD', '.DDD.'],
};

/** paint the face */
export function paintFace7(put: Put, f: Face7) {
  const { d, ex, eye, dir } = f;
  const P = palette(d);
  const fem = d.face?.lash === 'f';
  const slit = d.eyeStyle === 'slit';
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  // eyes and brows: the near eye's outer corner is away from the look, the far eye's toward it
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const x = Math.round(c[0]), y = Math.round(c[1]);
    const outer = (near ? -dir : dir) as 1 | -1;
    eye7(put, P, x, y, near, dir, outer, eye, ex, fem, slit);
    if (browOn) brow7(put, P, x, y, near, outer, ex, fem, slit);
    // blush hatching under the eye; freckles across the cheek
    const by = y + (slit ? 2 : 3);
    if (ex.blush) for (const hx of near ? [-1, 1] : [0]) { put(x + hx, by + 1, P.blush); put(x + hx + 1, by, P.blush); }
    if (d.face?.freckles) { const fc = mix(P.S, P.blush, 0.5); put(x - outer, by, fc); put(x - outer * 2, by + 1, fc); put(x, by + 1, fc); }
  }
  // the nose: a shadow under the tip on the side away from the light
  const nx = Math.round(f.nose[0]), ny = Math.round(f.nose[1]);
  put(nx, ny + 1, d.skin[2]);
  put(nx + 1, ny + 1, mix(d.skin[1], d.skin[2], 0.4));
  // the mouth
  const m = f.mouthShape;
  const rows = MOUTH[m] ?? MOUTH.none;
  const pal: Record<string, C> = { L: P.lip, l: mix(P.lip, d.skin[2], 0.5), D: P.D, T: P.T, w: P.Tw };
  const mx = Math.round(f.mouth[0]), my = Math.round(f.mouth[1]);
  const mw = rows[0].length, ax = (mw - 1) >> 1;
  rows.forEach((row, j) => {
    for (let i = 0; i < mw; i++) {
      const ch = row[i];
      if (ch !== '.') put(mx + (i - ax) * dir, my + j, pal[ch]);
    }
  });
  // a lit lower lip under a closed mouth
  if (m === 'none' || m === 'smile') put(mx, my + rows.length, P.lipL);
}

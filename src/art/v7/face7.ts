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
    // a man's brow is heavy: a full double row (user: "more manly"); a woman's thickens only inside
    const thick = slit || !fem || j >= n - 1;
    if (thick) put(x, y + 1, slit || !fem ? P.brow : P.brow2);
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
export function paintFace7(put: Put, f: Face7, femIn?: boolean) {
  const { d, ex, eye, dir } = f;
  const P = palette(d);
  const fem = femIn ?? d.face?.lash === 'f';
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

// ------------------------------------------------------------------ the coarse face (user: "face not that high resolution")
// The same features laid on the world-pixel grid (each face pixel a k x k block of the head's buffer),
// so a face reads at the body's own pixel size instead of a fine anime decal. Men get heavier brows
// laid flat and low, a stern line of a mouth and no lash flick; women a lighter brow, a lash flick
// and a softer lip. paintFace7 (the fine face) is kept, unused, so it can come back.

const FEM7 = new Set(['jenna', 'aroha', 'hine', 'rosie', 'celeste', 'sunny', 'ngaio', 'marge', 'hana', 'huia', 'ani', 'mere', 'pipi']);
/** is this character drawn as a woman or girl (lighter brows, lash flicks, a softer build) */
export function isFem7(id: string, d?: HeadDef7): boolean {
  return FEM7.has(id) || d?.face?.lash === 'f';
}

export function paintFaceCoarse7(put: Put, f: Face7, k: number, fem: boolean) {
  const { d, ex, eye, dir } = f;
  const P = palette(d);
  const slit = d.eyeStyle === 'slit';
  const browOn = !d.browHidden || ex.brow > 1 || slit;
  /** fill one world pixel (gx, gy) */
  const Q = (gx: number, gy: number, c: C) => { for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(gx * k + i, gy * k + j, c); };
  for (const [c, near] of [[f.near, true], [f.far, false]] as const) {
    if (!c) continue;
    const gx = Math.round(c[0] / k), gy = Math.round(c[1] / k);
    const outer = (near ? -dir : dir) as 1 | -1;
    const w = near ? 2 : 1;
    // columns from the back of the eye to the side it looks toward
    const col = (i: number) => (w === 1 ? gx : dir > 0 ? gx - 1 + i : gx + 1 - i);
    const lid = gy - 1;
    const row = (y: number, cs: C[]) => cs.forEach((cc, i) => Q(col(i), y, cc));
    const look = (back: C, front: C) => (w === 1 ? [front] : [back, front]);
    if (slit) {
      // narrowed under a heavy brow: one dark row, the iris at its front
      row(gy, eye === 'closed' || eye === 'happy' ? look(P.L, P.L) : look(P.K, P.I));
    } else if (eye === 'closed') row(gy, look(P.K, P.K));
    else if (eye === 'happy') { row(lid, look(P.K, P.K)); Q(col(0), gy, P.S); }
    else if (eye === 'half') { row(lid, look(P.L, P.L)); row(gy, look(P.K, P.I)); }
    else {
      row(lid, look(P.K, P.K));
      row(gy, look(P.W, P.I));
      if (eye === 'wide') row(gy + 1, look(P.w, P.i));
      if (eye === 'angry') Q(col(w - 1) - outer, lid, P.K);
      if (eye === 'sad') Q(col(0) + (w === 1 ? outer : 0), gy + 1, P.L);
      // women's lashes flick up and out at the outer corner
      if (fem && near) Q((outer > 0 ? Math.max(col(0), col(w - 1)) : Math.min(col(0), col(w - 1))) + outer, lid - 1, P.K);
    }
    // brows: a man's is a heavy flat bar sitting low; a woman's lighter and higher
    if (browOn) {
      const t = ex.browTilt;
      const n = near ? 3 : 2;
      const ys = t < 0 ? [0, 0, 1] : t > 0 ? [1, 0, -1] : [0, 0, 0];
      const by = gy - (slit ? 2 : fem ? 3 : 2) - 1 - (ex.brow > 1 ? 1 : 0);
      for (let j = 0; j < n; j++) {
        const x = gx + outer * (near ? 1 : 0) - outer * j;
        Q(x, by + ys[j + (3 - n)], fem ? P.brow2 : P.brow);
      }
      if (!fem && near) Q(gx - outer, by + ys[2] + 1, P.L); // the brow ridge's shadow at the inner end
    }
    if (ex.blush && near) Q(gx, gy + 2, P.blush);
  }
  // the nose: a shadow under the tip, away from the light
  const nx = Math.round(f.nose[0] / k), ny = Math.round(f.nose[1] / k);
  Q(nx, ny + 1, d.skin[2]);
  // the mouth, on the world grid
  const MC: Record<string, string[]> = {
    none: fem ? ['l'] : ['lL'],
    smile: fem ? ['l.l', '.L.'] : ['l.L', '.L.'],
    open: ['D'],
    o: ['D', 'D'],
    frown: ['.L.', 'l.l'],
    grit: ['DD'],
    shout: ['DD', 'DT'],
  };
  const rows = MC[f.mouthShape] ?? MC.none;
  // a man's mouth is a line of skin shadow, never a coloured lip
  const pal: Record<string, C> = fem ? { L: P.lip, l: mix(P.lip, d.skin[2], 0.5), D: P.D, T: P.T } : { L: mix(P.lip, d.skin[1], 0.6), l: d.skin[2], D: P.D, T: P.T };
  const mx = Math.round(f.mouth[0] / k), my = Math.round(f.mouth[1] / k);
  const mw = rows[0].length, ax = (mw - 1) >> 1;
  rows.forEach((r, j) => { for (let i = 0; i < mw; i++) if (r[i] !== '.') Q(mx + (i - ax) * dir, my + j, pal[r[i]]); });
  // a man's jaw: a shadow under the cheekbone on the shadow side
  if (!fem && f.near) Q(Math.round(f.near[0] / k) - dir, Math.round(f.near[1] / k) + 3, P.S);
}

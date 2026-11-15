// The five birds of beasts-birds.ts as sculpted designs for the Relief bird painter
// (beasts-lbird-paint.ts): landmarks for each body, skull and bill, the palette, and the plumage patterns.
//
//   Gale Hawk (Anemoaetus ophiophagus): a serpent-eating raptor. A deep chest and broad shoulders, a dark
//     umber hood with a short nuchal crest it raises when alarmed, a heavy brow ridge shading a fierce
//     yellow eye, a dark eye line and moustache on a buff face, a blue-black hooked bill with a yellow cere;
//     cream breast with dark drop streaks, rufous bars below and on the feathered trousers; heavy yellow
//     tarsi armoured with big scutes against bites; a long grey-brown tail with four dark bands and a pale
//     tip; broad fingered wings, the underside pale and barred with a dark carpal patch.
//   Crag Auk, Torrent Dipper, Thunder Stork and Nutcracker: see each design's header below.

import { V2, hh, fr } from './beasts-core';
import { LM, spline } from './beasts-relief';
import { LBDesign, feathers, FT, LBID, stdFeather } from './beasts-lbird-paint';
import { hex } from './color';

// ------------------------------------------------------------------ shared pattern helpers
/** distance from (x, y) to the segment a-b */
const dseg = (x: number, y: number, a: V2, b: V2) => {
  const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1;
  let t = ((x - a[0]) * ex + (y - a[1]) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t);
};
/** an angle snapped to the pixel grid (0, 90, 180, 270 degrees), so feather rows repeat crisply */
const snap = (a: number) => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
/**
 * Streaks on a staggered, screen-aligned pixel grid: one pixel wide, `len` long, running vertically
 * (an upright bird) or horizontally (in flight), `sx` apart across and `sy` along.
 */
const streak = (x: number, y: number, vert: boolean, sx: number, sy: number, len: number, seed: number, keep = 0.85) => {
  const X = Math.floor(x), Y = Math.floor(y);
  const a = vert ? X : Y, b = vert ? Y : X;
  const col = Math.floor(a / sx);
  if (a - col * sx !== 0) return false;
  const bb = b + (col & 1) * Math.floor(sy / 2);
  const row = Math.floor(bb / sy);
  return bb - row * sy < len && hh(col, row, seed) < keep;
};
/** broken bars across the body axis: one pixel thick every `sp` px, in dashes */
const bars = (x: number, y: number, vert: boolean, sp: number, dash: number, seed: number) => {
  const X = Math.floor(x), Y = Math.floor(y);
  const a = vert ? X : Y, b = vert ? Y : X;
  const row = Math.floor(b / sp);
  if (b - row * sp !== 0) return false;
  return hh(Math.floor((a + row * 2) / dash), row, seed) < 0.78;
};
/** a ragged boundary: jitter (+-amp) that changes every `cell` px along x */
const rag = (x: number, cell: number, amp: number, seed: number) => (hh(Math.floor(x / cell), seed, 13) - 0.5) * 2 * amp;

// ================================================================== GALE HAWK
export const HAWK: LBDesign = {
  scale: 1.12,
  pal: {
    mantle: '#5a3e28', mantleF: '#a27a4e', scap: '#4e3624', scapF: '#9c7046',
    cov: '#5c4230', covF: '#94704a', covM: '#7e5e40', secB: '#2e221a', sec: '#4a3426', secF: '#7c5c40', prim: '#2a201c', primF: '#4c3c30', tert: '#523a2a', tertF: '#8a6844',
    under: '#ece0c4', underM: '#7c4a2a', throat: '#f4ecd8',
    head: '#4a3222', headD: '#2a1c14', face: '#c49c6a', faceM: '#2e2018',
    tail: '#7c6248', tailBar: '#35281e', tailTip: '#ece0c8', tailF: '#9a8060',
    uwing: '#e8d8b8', uwingM: '#6c4226', uflight: '#d4ccbc', primD: '#262020',
    thigh: '#e4d2ac', thighM: '#8a5630',
    leg: '#e8b020', legD: '#a06c10', legL: '#fadc68', claw: '#18161a',
    beak: '#3c404e', beakD: '#17171d', beakL: '#646a7a', cere: '#eeb828', mouth: '#5a1c26',
    crest: '#2e2018', crestF: '#6a4a30',
    snake: '#6f8a3c', snakeB: '#e0c96a', snakeD: '#3a4a20',
  },
  ramps: {
    under: { n: 6, dark: 0.42, light: 0.35, at: 4, cool: 0.05, warm: 0.2 }, throat: { n: 6, dark: 0.42, light: 0.35, at: 4, cool: 0.05 }, tailTip: { n: 5, dark: 0.45, light: 0.3, at: 3, cool: 0.05 },
    uwing: { n: 6, dark: 0.45, light: 0.35, at: 4, cool: 0.05 }, uflight: { n: 6, dark: 0.45, light: 0.35, at: 4, cool: 0.2 },
    leg: { n: 6, dark: 0.5, light: 0.45, warm: 0.4 }, cere: { n: 6, dark: 0.5, light: 0.45, warm: 0.4 },
    beak: { n: 6, dark: 0.55, light: 0.5, cool: 0.4 }, thigh: { n: 6, dark: 0.45, light: 0.35, at: 4, cool: 0.05 },
  },
  bodyTop: [[-1.02, -0.2], [-0.62, -0.8], [-0.02, -0.99], [0.52, -0.9], [0.86, -0.52]],
  bodyBot: [[1.06, 0.08], [0.9, 0.64], [0.42, 1.0], [-0.2, 0.96], [-0.66, 0.7], [-0.96, 0.32]],
  neckRoot: [0.6, -0.3], neckFlare: 0.45, tuft: 1.2,
  breast: [0.62, 0.15, 0.55, 1.4],
  head: [[2.6, -1.6], [2.0, -2.55], [1.15, -3.05, 0.25], [-0.2, -3.3], [-1.9, -3.1], [-3.25, -2.15], [-3.85, -0.4], [-3.55, 1.6], [-2.0, 3.05], [0.3, 3.2], [1.9, 2.4], [2.8, 1.15], [3.0, -0.4]],
  neckEnd: [-1.4, 0.9],
  eye: { at: [1.0, -0.85], size: 2, iris: '#f4b828', ring: '#3a2616', brow: '#1e140e' },
  beak: {
    cere: [[2.45, -1.8], [3.75, -1.72], [3.95, -0.3], [3.6, 0.6], [2.55, 0.75]],
    upper: [[3.3, -1.78], [4.6, -1.62], [5.75, -0.92], [6.4, 0.2, 0.2], [6.3, 1.55, 0.5], [5.95, 2.3, 0.95], [5.58, 1.15, 0.45], [4.9, 0.78], [4.25, 0.62, 0.35], [3.4, 0.62]],
    lower: [[2.7, 0.56], [4.8, 0.82], [5.55, 1.1, 0.5], [4.6, 1.62], [3.0, 1.55]],
    hinge: [2.9, 0.8], gape: 0.55,
    nostril: [[3.05, -0.75], [3.45, -0.55]],
    paint: (x, y, up) => (up ? (x > 5.2 ? 'beakD' : y < -0.95 && x < 5 ? 'beakL' : 'beak') : x < 3.25 ? 'cere' : x > 4.6 ? 'beakD' : 'beak'),
    ridge: true,
  },
  fold: { front: 0.45, top: -0.78, bot: 0.42, ext: 5.5, tips: 4, tert: 0.32, scap: 2.2, sec: 4, gcN: 5, mcN: 4 },
  tail: { tips: 4, notch: 0.04, w0: 1.0, w1: 1.7, bars: 4.2, tip: true, shaft: true },
  leg: { thigh: 0.85, trousers: true, scute: 1.5, armour: true, toeW: 0.75, talon: 1.25, hallux: 0.75 },
  wingTop: { gc: 0.4, covTip: 0.08, bars: 5.5, median: 'covM', primTip: 'primD' },
  feather: stdFeather({ fringeW: 0.7, fringeT: 0.78, mats: { S: ['sec', 'sec'], P: ['prim', 'primF'], L: ['cov', 'covM'], X: ['scap', 'scapF'] } }),
  wingUnder: { lining: 'uwing', liningM: 'uwingM', flight: 'uflight', bars: 7, tip: 'primD', carpal: true },
  pose(anim, f, _n, P) {
    if (anim === 'glide') P.wing = [{ th: 0.62 + f * 0.04, hand: -0.22, fold: 0.04, sweep: 0.12, spread: 1.1 }, { th: 0.5 + f * 0.04, hand: -0.18, fold: 0.04, sweep: 0.12, spread: 1.1 }];
    if (anim === 'soar') P.wing = [{ th: 0.7, hand: -0.12 + f * 0.05, fold: 0, sweep: 0.06, spread: 1.3 }, { th: 0.58, hand: -0.1 + f * 0.05, fold: 0, sweep: 0.06, spread: 1.3 }];
    if (anim === 'dive') { P.wing = 'fold'; P.lift = 0.2 + f * 0.1; P.tailSp = 0.5; }
  },
  bodyTex(c, p, o, u, v) {
    const { M } = c;
    const ax = u * c.rx;
    const vert = Math.abs(Math.sin(c.ba)) > 0.45;
    const split = -0.15 + u * 0.12 + rag(ax, 1.6, 0.07, 3);
    if (v < split || u < -0.84) {
      feathers(o, p.x, p.y, snap(c.ba + Math.PI + 0.25), 3 * c.k, 2 * c.k, 95, M('mantle'), M('mantle'), 0.2);
      if (FT.fu > 0.7 && Math.abs(FT.fv) < 0.3 && hh(FT.col, FT.row, 96) < 0.5) o.m = M('mantleF');
      return;
    }
    o.m = M('under');
    o.t += 0.06;
    // the breast: dark drop streaks; the belly and flanks: rufous bars
    if (u > 0.2) { if (u < 0.97 && streak(p.x, p.y, vert, 3, 4, 2, 77)) o.m = M('underM'); }
    else if (bars(p.x, p.y, vert, 2, 3, 79)) o.m = M('underM');
  },
  neckTex(c, p, o, t, side) {
    const { M } = c;
    if (side < 0.15) { o.m = M('head'); if (hh(Math.floor(p.x), Math.floor(p.y), 31) < 0.12) o.m = M('crestF'); return; }
    o.m = M('throat');
    if (side > 0.5 && t < 0.6 && streak(p.x, p.y, true, 3, 3, 1, 33, 0.6)) o.m = M('underM');
  },
  headTex(c, p, o, hx, hy) {
    const { M } = c;
    // the hood: crown, nape and the brow, dark with paler feather edges
    if (hy < -1.7 + hx * 0.08 || hx < -2.3 + hy * 0.25) {
      o.m = M('head');
      if (streak(p.x, p.y, false, 2, 3, 1, 21, 0.5)) o.m = M('crestF');
      if (hy < -1.7 && hx > -0.6 && hx < 2.3) o.m = M('headD');
      return;
    }
    // a dark line back from the eye to the nape, and the moustache down from the gape
    if ((hx < 0.1 && Math.abs(hy - (-0.75 + (0.1 - hx) * 0.18)) < 0.55) || dseg(hx, hy, [2.2, 1.1], [0.2, 2.5]) < 0.62) { o.m = M('faceM'); return; }
    if (hy > 1.5 && hx > -1.8) { o.m = M('throat'); if (hh(Math.floor(p.x), Math.floor(p.y), 23) < 0.12) o.m = M('face'); return; }
    o.m = M('face');
    if (streak(p.x, p.y, true, 2, 3, 1, 23, 0.5)) o.t -= 0.08;
  },
  thighTex(c, p, o, t) {
    const { M } = c;
    o.m = M('thigh');
    o.t += 0.04;
    if (bars(p.x, p.y, true, 2, 3, 53) && t > 0.15) o.m = M('thighM');
  },
  headExtra(c, R, H, hz) {
    // the nuchal crest: four lance-tipped feathers from the occiput, raised when it is alarmed
    const cr = c.P.crest;
    const ang = Math.PI + 0.6 - cr * 1.15;
    const base0 = H.p(-2.4, -2.8), base1 = H.p(-3.6, -1.0);
    const lm: LM[] = [[base0[0], base0[1], 0]];
    const n = 4;
    const ca = Math.cos(H.ang(ang)), sa = Math.sin(H.ang(ang));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const bx = base0[0] + (base1[0] - base0[0]) * t, by = base0[1] + (base1[1] - base0[1]) * t;
      const L = (3.4 - i * 0.6) * c.k * (0.7 + cr * 0.45);
      lm.push([bx + ca * L, by + sa * L, 0.9]);
      lm.push([bx + ca * L * 0.45 + (base1[0] - base0[0]) * 0.12, by + sa * L * 0.45 + (base1[1] - base0[1]) * 0.12, 0.4]);
    }
    lm.push([base1[0], base1[1], 0]);
    const mid = H.p(-2.6, -1.6);
    lm.push([mid[0], mid[1], 0]);
    R.region(spline(lm, 0.35), { z: hz + 1.2 * c.k, R: 0.8 * c.k, H: 1 * c.k, id: LBID.CREST, blend: 0.4 * c.k, tex: (p, o) => {
      o.m = c.M('crest');
      const d = Math.hypot(p.x - mid[0], p.y - mid[1]);
      if (d > 2.6 * c.k && hh(Math.floor(p.x), Math.floor(p.y), 25) < 0.35) o.m = c.M('crestF');
    } });
  },
};

// ================================================================== CRAG AUK
// A stocky cliff auk standing upright on short legs set far back: a torpedo of a body, glossy black
// above and white below, the foreneck and chin a golden patch it puffs out in display; a deep,
// laterally flattened razor bill, black with a white groove across it and a golden-orange tip; a fine
// white line from the eye to the bill; short, narrow, pointed wings with a white trailing edge; a short
// pointed tail; bright orange webbed feet.
export const AUK: LBDesign = {
  scale: 1.18, flyWing: 0.84,
  ramp: { n: 6, dark: 0.55, light: 0.4, cool: 0.35, warm: 0.05 },
  pal: {
    mantle: '#1f222b', mantleF: '#363b4a', scap: '#1c1e27', scapF: '#323646',
    cov: '#20232c', covF: '#373c4c', sec: '#1d1f27', secF: '#e8e6e0', prim: '#121218', primF: '#2a2d38', tert: '#1f222a', tertF: '#3a3f4e',
    under: '#f2f0ea', underM: '#c8ccd2', throat: '#f6c43a', throatD: '#d8941e',
    head: '#16171e', headD: '#101015', face: '#1a1b22',
    tail: '#15161c', tailF: '#2a2c36', uwing: '#e4e2dc', uwingM: '#8a8c96', uflight: '#5c5e68',
    thigh: '#1d1f27', leg: '#ea7a30', legD: '#b0501a', legL: '#ffa860', web: '#d8622a', claw: '#3a2418',
    beak: '#1e1e24', beakD: '#101014', beakL: '#f0eee6', beakT: '#eca02a', mouth: '#e8b040',
    fish: '#b8c8cc',
  },
  ramps: {
    under: { n: 6, dark: 0.22, light: 0.3, at: 3, cool: 0.35 }, uwing: { n: 6, dark: 0.3, light: 0.3, at: 4, cool: 0.35 },
    throat: { n: 6, dark: 0.35, light: 0.4, at: 3, warm: 0.4, cool: 0 }, throatD: { n: 6, dark: 0.45, light: 0.4, cool: 0 },
    mantle: { n: 6, dark: 0.5, light: 0.35, cool: 0.5 }, head: { n: 6, dark: 0.5, light: 0.35, cool: 0.5 },
    leg: { n: 6, dark: 0.5, light: 0.45, warm: 0.3, cool: 0 }, web: { n: 6, dark: 0.5, light: 0.4, cool: 0 }, beakT: { n: 5, dark: 0.45, light: 0.4, cool: 0 },
    secF: { n: 5, dark: 0.35, light: 0.3, at: 3 }, beakL: { n: 5, dark: 0.35, light: 0.3, at: 3 },
  },
  bodyTop: [[-1.02, -0.12], [-0.62, -0.82], [0.05, -0.99], [0.6, -0.86], [0.9, -0.42]],
  bodyBot: [[1.04, 0.16], [0.78, 0.84], [0.15, 1.03], [-0.5, 0.88], [-0.92, 0.44]],
  neckRoot: [0.68, -0.22], neckFlare: 0.55, tuft: 0.6,
  breast: [0.55, 0.3, 0.6, 1.0],
  head: [[2.0, -1.3], [1.3, -2.2], [0.0, -2.55], [-1.5, -2.25], [-2.6, -1.1], [-2.85, 0.6], [-1.9, 2.0], [-0.2, 2.5], [1.3, 2.0], [2.1, 0.9]],
  neckEnd: [-1.0, 0.8],
  eye: { at: [0.75, -0.65], size: 2, iris: '#2a1810', lid: '#0c0c10' },
  beak: {
    upper: [[1.85, -1.38], [3.0, -1.45], [4.15, -1.02], [5.0, -0.3, 0.3], [4.95, 0.28, 0.6], [3.6, 0.18], [2.05, 0.18]],
    lower: [[2.0, 0.16], [3.6, 0.22], [4.8, 0.42, 0.5], [3.8, 0.95], [2.4, 1.15]],
    hinge: [2.1, 0.22], gape: 0.55,
    nostril: [[2.3, -0.55], [2.75, -0.48]],
    paint: (x, _y, up) => (x > (up ? 4.3 : 4.0) ? 'beakT' : Math.abs(x - 3.45) < 0.38 ? 'beakL' : 'beak'),
    ridge: true,
  },
  fold: { front: 0.38, top: -0.86, bot: 0.5, ext: 1.4, tips: 2, tert: 0.28, scap: 1.3, sec: 3, gcN: 3, mcN: 3, round: 0, seams: false, tertN: 1 },
  tail: { tips: 3, notch: 0.12, w0: 0.5, w1: 0.95, bars: 0, tip: false, round: 0 },
  leg: { thigh: 0.6, scute: 1.0, toeW: 0.5, talon: 0.3, hallux: 0.25, web: true },
  wingTop: { gc: 0.4, covTip: 0, secTip: 'secF' },
  wingUnder: { lining: 'uwing', flight: 'uflight', tip: 'prim' },
  feather: stdFeather({ fringeW: 0.6, mats: { S: ['sec', 'mantleF'] }, fringeT: 0.8 }),
  pose(anim, f, n, P) {
    if (anim === 'dive' && !P.air) {
      // flying under water: level, the wings rowing, a trail of bubbles; kept inside its canvas
      const t = f / n;
      P.b = [0, -5.6]; P.ba = 0.12; P.na = -0.1; P.nl = 0.7; P.ha = 0.15;
      P.wing = [{ th: 0.15 + Math.cos(t * Math.PI * 2) * 0.35, hand: -0.3, fold: 0.45, sweep: -0.45 }, { th: 0.15 + Math.cos(t * Math.PI * 2) * 0.35, hand: -0.3, fold: 0.45, sweep: -0.45 }];
      P.feet = [[-6.2, -4.4], [-6.6, -4.0]];
      P.prey = 'bubbles'; P.preyA = t;
    }
    if (anim === 'fly' && f === 0 && P.wing !== 'fold') for (const w of P.wing) w.th *= 0.72;
  },
  bodyTex(c, p, o, u, v) {
    const { M } = c;
    const ax = u * c.rx;
    // the black of the back wraps the flanks; the white breast rises to a point under the golden throat
    const split = 0.12 - Math.max(0, u - 0.3) * 0.55 + rag(ax, 1.4, 0.05, 5);
    if (v < split || u < -0.86) {
      feathers(o, p.x, p.y, c.ba + Math.PI + 0.2, 2.6 * c.k, 1.8 * c.k, 81, M('mantle'), M('mantle'), 0.25);
      if (FT.fu > 0.76 && Math.abs(FT.fv) < 0.25 && hh(FT.col, FT.row, 82) < 0.4) o.m = M('mantleF');
      return;
    }
    // the foreneck's golden patch reaches down onto the upper breast
    if (u > 0.6 - c.P.throat * 0.1 && v < 0.2 + c.P.throat * 0.2) { o.m = M('throat'); o.t += 0.06; if (u < 0.68 || v > 0.12) o.m = M('throatD'); return; }
    o.m = M('under');
    o.t += 0.1;
    if (fr((ax + v * 2.2) / 2.1) < 0.12 && hh(Math.floor(ax / 2.1), Math.floor(v * 4), 83) < 0.5) o.m = M('underM');
  },
  neckTex(c, p, o, t, side) {
    const { M } = c;
    if (side < -0.05) { o.m = M('head'); return; }
    const g = c.P.throat;
    // gold from the chin down the foreneck, ending in a point on the white breast
    o.m = t > 0.2 - g * 0.25 - side * 0.15 ? M('throat') : M('under');
    if (o.m === M('throat') && (side > 0.75 || fr(t * 3.2 + side) < 0.15)) o.m = M('throatD');
    void p;
  },
  headTex(c, p, o, hx, hy) {
    const { M } = c;
    const g = c.P.throat;
    if (hy > 1.3 - g * 0.5 - hx * 0.12 && hx > -2.0 + g) {
      o.m = M('throat');
      if (hy > 2.0 || fr(hx * 0.9 + hy * 0.4) < 0.14) o.m = M('throatD');
      return;
    }
    feathers(o, p.x, p.y, c.ha + Math.PI * c.face + 0.3, 1.6 * c.k, 1.1 * c.k, 85, M('head'), M('head'), 0.25);
    if (hy < -1.6 && hh(Math.floor(p.x), Math.floor(p.y), 86) < 0.15) o.m = M('mantleF');
  },
  headExtra(c, R, H, hz) {
    // the gular patch puffed out in display: a golden pouch of feathers under the chin
    const g = c.P.throat;
    if (g < 0.2) return;
    const r = 1 + g * 0.9;
    const lm: LM[] = [[-1.4, 1.2], [0.4, 1.0], [1.6, 1.6], [1.2, 2.2 + r * 0.8], [-0.2, 2.4 + r, 0.2], [-1.6, 2.2 + r * 0.6], [-2.2, 1.6]].map(q => { const s = H.p(q[0], q[1]); return [s[0], s[1], (q as number[])[2] ?? 0] as LM; });
    R.region(spline(lm, 0.35), { z: hz + 1.4 * c.k, R: 1.1 * c.k, H: 1.4 * c.k * g, id: LBID.THROAT, blend: 0.8 * c.k, tex: (p, o) => {
      o.m = c.M('throat');
      if (fr((p.y - H.o[1]) * 0.8) < 0.18) o.m = c.M('throatD');
    } });
  },
  detail(c, H) {
    // the fine white line from the eye to the base of the bill
    if (c.P.eye === 'closed') return;
    const w = hex('#e8e6e0');
    const a = H.p(1.45, -0.95), b = H.p(1.95, -1.2);
    c.sk.overPaint(Math.floor(a[0]), Math.floor(a[1]), w);
    if (!c.juv) c.sk.overPaint(Math.floor(b[0]), Math.floor(b[1]), w);
  },
};

// ================================================================== TORRENT DIPPER
// A plump, short-tailed stream songbird built for walking under water: a round, dense body of
// slate-blue plumage, a darker slate head with a sooty cap, a crisp white bib from the chin to the
// breast with a chestnut band below it, a slim dark bill with a slight upturn, strong pale legs and
// big gripping feet, the stubby tail cocked up, and a white eyelid it flashes as it bobs.
export const DIPPER: LBDesign = {
  scale: 1.22, flyWing: 0.86,
  ramp: { n: 6, dark: 0.55, light: 0.42, cool: 0.3, warm: 0 },
  pal: {
    mantle: '#4a5a6e', mantleF: '#687a90', scap: '#465668', scapF: '#64768c',
    cov: '#44546a', covF: '#62748a', sec: '#3c4a5c', secF: '#586a80', prim: '#2a3442', primF: '#3e4a5c', tert: '#405064', tertF: '#5e7086',
    under: '#4c5a6c', underM: '#3e4a5a', bib: '#f4f2ec', bibD: '#c8ccd0', band: '#7c4a30', bandD: '#5a3220',
    head: '#3c4452', headD: '#2c303a', face: '#404858',
    tail: '#2c3644', tailF: '#3a4656', uwing: '#5a6a7e', uflight: '#3a4656',
    thigh: '#46546a', leg: '#b4aab0', legD: '#7a7078', legL: '#d6ccd2', claw: '#4a4248',
    beak: '#1e1e22', beakD: '#141418', beakL: '#4a4a54', mouth: '#d8823a',
  },
  ramps: {
    bib: { n: 6, dark: 0.2, light: 0.3, at: 3, cool: 0.3 }, bibD: { n: 5, dark: 0.3, light: 0.3, at: 3 }, mantle: { n: 6, dark: 0.5, light: 0.35, cool: 0.3, warm: 0 },
    head: { n: 6, dark: 0.45, light: 0.22, cool: 0.3, warm: 0 }, headD: { n: 6, dark: 0.45, light: 0.2, cool: 0.3, warm: 0 },
    band: { n: 6, dark: 0.5, light: 0.4, cool: 0 }, leg: { n: 6, dark: 0.45, light: 0.4 },
  },
  bodyTop: [[-1.02, -0.08], [-0.66, -0.84], [0.0, -1.03], [0.55, -0.93], [0.86, -0.5]],
  bodyBot: [[1.04, 0.12], [0.84, 0.8], [0.2, 1.06], [-0.46, 0.96], [-0.9, 0.5]],
  neckRoot: [0.68, -0.28], neckFlare: 0.5, tuft: 0.5,
  breast: [0.55, 0.2, 0.65, 0.8],
  head: [[1.7, -0.95], [1.1, -1.75], [0.0, -2.05], [-1.3, -1.85], [-2.2, -0.8], [-2.25, 0.7], [-1.4, 1.8], [0.2, 2.0], [1.3, 1.4], [1.85, 0.4]],
  neckEnd: [-0.9, 0.7],
  eye: { at: [0.1, -0.55], size: 1, iris: '#0e0a08', lid: '#f6f6f2', ring: '#b8c0cc' },
  beak: {
    upper: [[1.55, -0.85], [2.7, -0.7], [3.75, -0.25, 0.6], [2.7, 0.06], [1.7, 0.12]],
    lower: [[1.7, 0.1], [2.8, 0.12], [3.55, 0.0, 0.6], [2.6, 0.48], [1.75, 0.62]],
    hinge: [1.75, 0.18], gape: 0.6,
    paint: (x, y, up) => (up && y < -0.55 && x < 2.6 ? 'beakL' : 'beak'),
  },
  fold: { front: 0.42, top: -0.84, bot: 0.48, ext: 0.3, tips: 2, tert: 0.3, scap: 1.0, sec: 3, gcN: 3, mcN: 2, round: 0.6, seams: false, tertN: 1 },
  tail: { tips: 3, notch: 0.06, w0: 0.45, w1: 0.95, bars: 0, tip: false, round: 1 },
  leg: { thigh: 0.55, scute: 1.0, toeW: 0.38, talon: 0.4, hallux: 0.7 },
  wingTop: { gc: 0.4, covTip: 0.06 },
  wingUnder: { lining: 'uwing', flight: 'uflight' },
  feather: stdFeather({ fringeW: 0.6, fringeT: 0.8 }),
  pose(anim, f, n, P) {
    if (anim === 'dive' && !P.air) {
      // walking the stream bed under water: tipped head-down, wings half open to hold it down, gripping
      const t = f / n;
      P.b = [Math.sin(t * Math.PI * 2) * 0.3, -4.6 + Math.abs(Math.sin(t * Math.PI * 2)) * -0.3];
      P.ba = 0.42; P.na = -0.35; P.nl = 0.9; P.ha = 0.75; P.tuck = 0; P.tailA = 0.1;
      const st = 2.3;
      const g = (ph: number): V2 => { const q = ((ph % 1) + 1) % 1; return q < 0.55 ? [st * (0.5 - q / 0.55), 0] : [st * (-0.5 + (q - 0.55) / 0.45), -0.9 * Math.sin(Math.PI * (q - 0.55) / 0.45)]; };
      P.feet = [g(t), g(t + 0.5)];
      P.wing = [{ th: -0.05, hand: -0.25, fold: 0.55, sweep: -0.6 }, { th: -0.15, hand: -0.25, fold: 0.55, sweep: -0.6 }];
      P.prey = 'bubbles'; P.preyA = t;
    }
    if (anim === 'fly' && f === 0 && P.wing !== 'fold') for (const w of P.wing) w.th *= 0.76;
  },
  bodyTex(c, p, o, u, v) {
    const { M } = c;
    const ax = u * c.rx;
    // the white bib on the upper breast, a chestnut band under it, slate below and above
    const bibB = 0.42 + rag(p.y * 2 + ax, 1.1, 0.05, 7);
    if (u > bibB && v > -0.35 + (1 - u) * 0.3) { o.m = M('bib'); o.t += 0.12; if (u < bibB + 0.12 && hh(Math.floor(p.x), Math.floor(p.y), 61) < 0.35) o.m = M('bibD'); return; }
    if (u > 0.05 && v > 0.15 + (u - 0.05) * 0.2) { o.m = M('band'); if (u < 0.15 && hh(Math.floor(p.x), Math.floor(p.y), 62) < 0.4) o.m = M('under'); return; }
    feathers(o, p.x, p.y, c.ba + Math.PI + 0.2, 2.2 * c.k, 1.5 * c.k, 63, M(v < 0.1 ? 'mantle' : 'under'), M(v < 0.1 ? 'mantle' : 'under'), 0.2);
    if (FT.fu > 0.78 && Math.abs(FT.fv) < 0.25 && hh(FT.col, FT.row, 64) < 0.35) o.m = M('mantleF');
  },
  neckTex(c, p, o, t, side) {
    const { M } = c;
    void p; void t;
    if (side > 0.1) { o.m = M('bib'); o.t += 0.12; return; }
    o.m = M('head');
  },
  headTex(c, p, o, hx, hy) {
    const { M } = c;
    if (hy > 0.9 - hx * 0.15 && hx > -1.4) { o.m = M('bib'); o.t += 0.12; return; }
    o.m = hy < -1.1 ? M('headD') : M('head');
    if (hh(Math.floor(p.x), Math.floor(p.y), 66) < 0.08) o.t += 0.05;
  },
};

// ================================================================== THUNDER STORK
// A tall, armoured snake-killing stork: a long white S-neck with a shaggy ruff of lance hackles at its
// base, a sooty cap and short nuchal plumes, bare scarlet skin round a yellow eye running forward to
// the bill and down the chin, and a massive straight dagger bill, red with an ivory point; storm-slate
// mantle and coverts, each feather pale-fringed so the wing looks scaled, long grey scapular plumes,
// black flight feathers with a violet sheen, white below; and long slate legs plated with armour
// scutes, big knees and long toes. It flies with the neck out and the legs trailing.
export const STORK: LBDesign = {
  ramp: { n: 6, dark: 0.58, light: 0.42, cool: 0.35, warm: 0.05 },
  pal: {
    mantle: '#5c626c', mantleF: '#8a929c', scap: '#757d88', scapF: '#a6aeb8',
    cov: '#5a626c', covF: '#d0d6dc', covM: '#727a84', sec: '#1c1e24', secF: '#3a3e4c', secB: '#2a2c36', prim: '#141519', primF: '#363a4c', primD: '#0e0e12', tert: '#4a505a', tertF: '#7c848e',
    under: '#e8eaec', underM: '#c8ccd2', neck: '#eef0f2', neckD: '#b8bec6',
    head: '#202229', headD: '#15161b', skin: '#cc3a2a', skinD: '#8a1e16',
    tail: '#18191e', tailF: '#2c2e38', uwing: '#e4e6e8', uwingM: '#b0b6be', uflight: '#22242c',
    thigh: '#d6d9de', thighM: '#aeb4bc', leg: '#4a4d58', legD: '#262830', legL: '#727684', claw: '#1c1c20',
    beak: '#b8342a', beakD: '#7c1c16', beakL: '#dc6250', beakT: '#ead2aa', mouth: '#5a1418',
    crest: '#1c1d23', crestF: '#3a3c48',
    snake: '#6f6a3c', snakeB: '#d8c070', snakeD: '#3a3420',
  },
  ramps: {
    under: { n: 6, dark: 0.28, light: 0.3, at: 4, cool: 0.35 }, neck: { n: 6, dark: 0.28, light: 0.3, at: 4, cool: 0.35 }, uwing: { n: 6, dark: 0.3, light: 0.3, at: 4, cool: 0.35 },
    thigh: { n: 6, dark: 0.32, light: 0.3, at: 4, cool: 0.35 },
    skin: { n: 6, dark: 0.5, light: 0.4, cool: 0, warm: 0.3 }, beak: { n: 7, dark: 0.55, light: 0.45, cool: 0, warm: 0.3 }, beakT: { n: 6, dark: 0.45, light: 0.35, at: 4 },
    prim: { n: 6, dark: 0.5, light: 0.45, cool: 0.6 }, sec: { n: 6, dark: 0.5, light: 0.45, cool: 0.6 },
    leg: { n: 6, dark: 0.55, light: 0.45, cool: 0.4 },
  },
  bodyTop: [[-1.03, -0.1], [-0.72, -0.76], [-0.1, -0.99], [0.5, -0.92], [0.86, -0.56]],
  bodyBot: [[1.02, 0.02], [0.88, 0.62], [0.38, 0.99], [-0.3, 0.96], [-0.8, 0.62]],
  neckRoot: [0.74, -0.3], neckFlare: 0.45, tuft: 1.4,
  breast: [0.6, 0.25, 0.5, 1.6],
  head: [[2.8, -1.6], [1.8, -2.55], [0.2, -3.05], [-1.8, -2.85], [-3.35, -1.8], [-3.9, 0.0], [-3.1, 1.75], [-1.1, 2.8], [1.1, 2.75], [2.85, 1.6], [3.3, 0.0]],
  neckEnd: [-2.2, 0.7],
  eye: { at: [0.55, -0.8], size: 2, iris: '#f2d83a', ring: '#7a1a14', ringFull: true },
  beak: {
    upper: [[2.8, -1.66], [6.2, -1.42], [10.2, -0.88], [13.8, -0.22], [16.1, 0.28, 0.7], [14.6, 0.46], [9.2, 0.3], [4.2, 0.2], [3.1, 0.2]],
    lower: [[3.1, 0.2], [8.2, 0.34], [14.4, 0.5], [15.7, 0.52, 0.7], [12.2, 1.05], [6.2, 1.48], [3.3, 1.62]],
    hinge: [3.3, 0.32], gape: 0.3,
    cere: [[2.3, -1.75], [3.7, -1.75], [3.9, 1.75], [2.3, 1.85]],
    nostril: [[4.1, -0.65], [5.3, -0.55]],
    paint: (x, y, up) => (x > 12.8 ? 'beakT' : up && y < -0.8 + x * 0.05 && x < 11 ? 'beakD' : up && y < -0.4 + x * 0.04 ? 'beakL' : !up && y < 0.62 + (x - 3.3) * 0.02 ? 'beakD' : 'beak'),
    ridge: true, lines: 1.1,
  },
  fold: { front: 0.5, top: -0.9, bot: 0.55, ext: 4.5, tips: 4, tert: 0.4, scap: 3.2, sec: 6, gcN: 6, mcN: 5, round: 0.4, scapN: 4, scapLen: 0.45 },
  tail: { tips: 4, notch: 0.05, w0: 1.0, w1: 1.8, bars: 0, tip: false, round: 1 },
  leg: { thigh: 0.42, bareTib: 1, scute: 2.0, armour: true, toeW: 0.75, talon: 0.6, hallux: 0.45 },
  trailLegs: true,
  wingTop: { gc: 0.44, covTip: 0.06, median: 'covM' },
  wingUnder: { lining: 'uwing', liningM: 'uwingM', flight: 'uflight' },
  feather: (c, p, o, row, i, n, t, cx, s) => {
    stdFeather({ fringeW: 0.9, mats: { P: ['prim', 'primF'], S: ['sec', 'secF'] }, fringeT: 0.6, scale: [2.4, 1.8] })(c, p, o, row, i, n, t, cx, s);
    // the scapular plumes: a pale shaft streak down each lance
    if (row === 'X' && t > 0.25 && Math.abs(cx) < 0.5) o.m = c.M('scapF');
  },
  bodyTex(c, p, o, u, v) {
    const { M } = c;
    const ax = u * c.rx;
    const split = -0.25 + u * 0.1 + rag(ax, 1.8, 0.06, 9);
    if (v < split || u < -0.85) {
      feathers(o, p.x, p.y, c.ba + Math.PI + 0.2, 3.2 * c.k, 2.4 * c.k, 87, M('mantle'), M('mantleF'), 0.45);
      return;
    }
    o.m = M('under');
    feathers(o, p.x, p.y, c.ba + Math.PI * 0.5 + 0.3, 3 * c.k, 2.2 * c.k, 88, M('under'), M('under'), 0.35);
    if (FT.fu > 0.8 && Math.abs(FT.fv) < 0.2 && hh(FT.col, FT.row, 89) < 0.5) o.m = M('underM');
  },
  neckTex(c, p, o, t, side) {
    const { M } = c;
    o.m = M('neck');
    // fine feather lines down the neck, a grey stripe down the nape
    if (side < -0.55 && t > 0.15) o.m = M('neckD');
    if (fr(t * 9 + side * 0.4) < 0.12 && hh(Math.floor(p.x), Math.floor(p.y), 90) < 0.6) o.t -= 0.06;
  },
  headTex(c, p, o, hx, hy) {
    const { M } = c;
    // bare scarlet skin: round the eye, forward over the lores to the bill, and down the chin
    const sk = Math.hypot(hx - 0.55, (hy + 0.8) * 1.15) < 1.8 || (hx > 0.55 && hy > -1.6 && hy < 0.75 && hx < 3.5) || (hx > -0.6 && hy > 0.95 && hx < 3.3);
    if (sk) {
      o.m = M('skin');
      if (fr(hx * 1.3 + hy * 0.5) < 0.14) { o.z -= 0.3; o.m = M('skinD'); }
      return;
    }
    if (hy < -0.9 + Math.max(0, -hx - 1) * 0.2) { feathers(o, p.x, p.y, c.ha + Math.PI * c.face + 0.25, 1.8 * c.k, 1.3 * c.k, 91, M('head'), M('head'), 0.3); return; }
    o.m = M('neck');
    if (hh(Math.floor(p.x), Math.floor(p.y), 92) < 0.1) o.t -= 0.05;
  },
  thighTex(c, p, o, t) {
    const { M } = c;
    feathers(o, p.x, p.y, Math.PI * 0.5 + 0.15, 2.2 * c.k, 1.6 * c.k, 93, M('thigh'), M('thigh'), 0.5);
    if (t > 0.75 && hh(Math.floor(p.x), Math.floor(p.y), 94) < 0.3) o.m = M('thighM');
  },
  headExtra(c, R, H, hz) {
    // short, shaggy nuchal plumes from the back of the cap, lifted in display
    const up = c.P.crest;
    const lm: LM[] = [];
    const b0 = H.p(-1.9, -2.85), b1 = H.p(-3.7, -0.7);
    lm.push([b0[0], b0[1], 0]);
    const ang = H.ang(Math.PI + 0.3 - up * 0.7);
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.6) / 3.2;
      const bx = b0[0] + (b1[0] - b0[0]) * t, by = b0[1] + (b1[1] - b0[1]) * t;
      const L = (5.2 - i * 0.9) * c.k * (1 + up * 0.2);
      lm.push([bx + Math.cos(ang) * L, by + Math.sin(ang) * L, 0.85]);
      lm.push([bx + Math.cos(ang) * L * 0.35 + (b1[0] - b0[0]) * 0.1, by + Math.sin(ang) * L * 0.35 + (b1[1] - b0[1]) * 0.1, 0.3]);
    }
    lm.push([b1[0], b1[1], 0]);
    const m = H.p(-2.5, -1.3);
    lm.push([m[0], m[1], 0]);
    R.region(spline(lm, 0.35), { z: hz + 1 * c.k, R: 0.8 * c.k, H: 0.9 * c.k, id: LBID.CREST, blend: 0.4 * c.k, tex: (p, o) => {
      o.m = c.M('crest');
      if (hh(Math.floor(p.x * 1.3), Math.floor(p.y * 1.3), 95) < 0.18) o.m = c.M('crestF');
    } });
  },
  neckExtra(c, R, nb, hp, z) {
    // the ruff: lance-shaped hackles hanging from the lower foreneck
    const ax = hp[0] - nb[0], ay = hp[1] - nb[1], l = Math.hypot(ax, ay) || 1;
    const ux = ax / l, uy = ay / l, nx = uy, ny = -ux; // nx,ny: toward the front of the neck (ventral)
    const fwd = nx > 0 ? 1 : -1;
    const P0: V2 = [nb[0] + ux * l * 0.08, nb[1] + uy * l * 0.08];
    const lm: LM[] = [];
    const n = 6;
    const W0 = 3.6 * c.k;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const bx = P0[0] + ux * l * (0.05 + t * 0.32) + nx * fwd * W0 * (0.7 - t * 0.2), by = P0[1] + uy * l * (0.05 + t * 0.32) + ny * fwd * W0 * (0.7 - t * 0.2);
      const L = (4.6 - t * 2.6) * c.k * (1 + c.P.ruffle * 0.3);
      lm.push([bx - ux * L * 0.55 + nx * fwd * L * 0.45, by - uy * L * 0.55 + ny * fwd * L * 0.45, 0.8]);
      if (i < n) lm.push([bx + ux * 0.6 * c.k + nx * fwd * 0.3, by + uy * 0.6 * c.k + ny * fwd * 0.3, 0.3]);
    }
    lm.push([P0[0] + ux * l * 0.4, P0[1] + uy * l * 0.4, 0]);
    lm.push([P0[0] - nx * fwd * 1.2, P0[1] - ny * fwd * 1.2, 0]);
    lm.push([P0[0] - ux * 2.5 * c.k + nx * fwd * 2, P0[1] - uy * 2.5 * c.k + ny * fwd * 2, 0]);
    R.region(spline(lm, 0.35), { z, R: 1 * c.k, H: 1.4 * c.k, id: LBID.RUFF, blend: 0.6 * c.k, tex: (p, o) => {
      o.m = c.M('neck');
      const s = (p.x - P0[0]) * nx * fwd + (p.y - P0[1]) * ny * fwd;
      if (fr(((p.x - P0[0]) * ux + (p.y - P0[1]) * uy) * 0.55 + s * 0.2) < 0.18) { o.z -= 0.4; o.m = c.M('neckD'); }
    } });
  },
  pose(anim, f, _n, P) {
    if (anim === 'clatter' || anim === 'display') P.crest = 1;
    if (anim === 'sleep') {
      // asleep on one leg: the neck sunk into the shoulders, the bill resting down along the foreneck,
      // the other leg drawn up into the belly feathers
      P.na = -1.45; P.nl = 0.32; P.nc = 0.2; P.ha = 1.2 + f * 0.04; P.eye = 'closed';
      P.feet = [[0.2, 0], [1.5, -14]]; P.ruffle = 0.6 + f * 0.1; P.b[1] -= 7.5;
    }
    // stand taller: long, nearly straight legs rather than a deep crouch
    if (!P.air && P.sink === Infinity) P.b[1] -= anim === 'stalk' ? 2 : 4;
    if (anim === 'glide') P.wing = [{ th: 0.5 + f * 0.04, hand: -0.25, fold: 0.04, sweep: 0.1, spread: 1.15 }, { th: 0.4 + f * 0.04, hand: -0.2, fold: 0.04, sweep: 0.1, spread: 1.15 }];
  },
};

// ================================================================== NUTCRACKER
// A plump, big-headed seed-cracker: a massive steel-grey conical bill as deep as the head at its base,
// the culmen arched and the tip hooked, bulging jaw muscles in the cheeks, a black mask round the bill
// base and chin and a pale eye ring; a dark chocolate cap, warm brown body scattered with white
// teardrop spots, buff underparts, white undertail coverts; dark wings with white spots on the coverts;
// a dark tail with a white tip band; strong grey feet.
export const NUTCRACKER_D: LBDesign = {
  scale: 1.22, flyWing: 0.8,
  pal: {
    mantle: '#5a3a24', mantleF: '#7a5638', spot: '#f6eedc', scap: '#4e321e', scapF: '#f0e6d2',
    cov: '#2e2018', covF: '#f0e8d8', sec: '#261a14', secF: '#4a3a2e', prim: '#1a1410', primF: '#3a2e26', tert: '#2e221a', tertF: '#5a4636',
    under: '#e0c294', underM: '#7a5232', vent: '#f6f2e8',
    head: '#7a4a2a', headD: '#4a2c18', face: '#9a5e34', faceM: '#120d0a',
    tail: '#221a16', tailTip: '#f2eee4', tailF: '#3a2e26', uwing: '#5a4636', uflight: '#3a2e26',
    thigh: '#c0a882', leg: '#a08a7e', legD: '#665248', legL: '#c4b0a4', claw: '#2a2220',
    beak: '#8c949e', beakD: '#3a3e46', beakL: '#c2c8d0', mouth: '#7a2a2a',
    seed: '#9a7244', seedL: '#e8d6aa',
  },
  ramps: {
    under: { n: 6, dark: 0.38, light: 0.32, at: 4, cool: 0, warm: 0.4, sat: 0.1 }, vent: { n: 5, dark: 0.3, light: 0.3, at: 3 }, spot: { n: 5, dark: 0.25, light: 0.3, at: 3 },
    head: { n: 6, dark: 0.5, light: 0.2, cool: 0, warm: 0.4, at: 4 }, face: { n: 6, dark: 0.5, light: 0.25, cool: 0, warm: 0.3, at: 4 }, mantle: { n: 6, dark: 0.55, light: 0.3, cool: 0.1, warm: 0.2 },
    covF: { n: 5, dark: 0.35, light: 0.3, at: 3 }, scapF: { n: 5, dark: 0.35, light: 0.3, at: 3 }, tailTip: { n: 5, dark: 0.35, light: 0.3, at: 3 },
    beak: { n: 6, dark: 0.55, light: 0.5, cool: 0.4 }, seed: { n: 5, dark: 0.5, light: 0.4 },
  },
  bodyTop: [[-1.02, -0.1], [-0.62, -0.86], [0.0, -1.03], [0.55, -0.95], [0.86, -0.5]],
  bodyBot: [[1.05, 0.1], [0.86, 0.76], [0.25, 1.06], [-0.42, 0.96], [-0.9, 0.5]],
  neckRoot: [0.64, -0.3], neckFlare: 0.5, tuft: 0.7,
  breast: [0.55, 0.25, 0.6, 0.9],
  head: [[2.0, -1.65], [1.4, -2.45], [0.0, -2.78], [-1.6, -2.5], [-2.8, -1.3], [-3.0, 0.5], [-2.2, 2.1], [-0.5, 2.75], [1.2, 2.5], [2.1, 1.5]],
  neckEnd: [-1.2, 0.9],
  eye: { at: [0.45, -0.85], size: 1, iris: '#1a1210', ring: '#f0e6cc', ringFull: true },
  beak: {
    upper: [[1.6, -1.78], [2.8, -1.7], [3.9, -1.0], [4.65, 0.0, 0.3], [4.45, 0.6, 0.8], [3.4, 0.2], [2.0, 0.1]],
    lower: [[1.9, 0.1], [3.4, 0.24], [4.3, 0.55, 0.5], [3.4, 1.4], [2.0, 1.8]],
    hinge: [2.0, 0.2], gape: 0.55,
    paint: (x, y, up) => (x > (up ? 3.95 : 3.7) ? 'beakD' : up && y < -1.05 ? 'beakL' : 'beak'),
    ridge: true,
  },
  fold: { front: 0.4, top: -0.86, bot: 0.5, ext: 1.4, tips: 2, tert: 0.3, scap: 1.2, sec: 3, gcN: 3, mcN: 0, round: 0.5, seams: false, tertN: 1 },
  tail: { tips: 3, notch: 0.05, w0: 0.5, w1: 1.1, bars: 0, tip: true, round: 1 },
  leg: { thigh: 0.55, scute: 1.0, toeW: 0.5, talon: 0.5, hallux: 0.7 },
  wingTop: { gc: 0.4, covTip: 0.1, primTip: undefined },
  wingUnder: { lining: 'uwing', flight: 'uflight' },
  pose(anim, f, _n, P) {
    if (anim === 'fly' && f === 0 && P.wing !== 'fold') for (const w of P.wing) w.th *= 0.56;
  },
  feather: (c, p, o, row, i, n, t, cx, s) => {
    const base = stdFeather({ fringeW: 0.55, fringeT: 0.85 });
    base(c, p, o, row, i, n, t, cx, s);
    // the white spots of the coverts and scapulars: one teardrop near each feather's tip; white tertial tips
    if ((row === 'G' || row === 'X') && t > 0.55 && t < 0.95 && Math.abs(cx) < 0.7) o.m = c.M(row === 'G' ? 'covF' : 'scapF');
    if (row === 'T' && t > 0.8) o.m = c.M('covF');
  },
  bodyTex(c, p, o, u, v) {
    const { M } = c;
    const ax = u * c.rx;
    if (u < -0.62 && v > 0.15) { o.m = M('vent'); o.t += 0.08; return; }
    const split = -0.05 + u * 0.15 + rag(ax, 1.4, 0.06, 11);
    const vert = Math.abs(Math.sin(c.ba)) > 0.45;
    if (v < split || u < -0.85) {
      o.m = M('mantle');
      // crisp white teardrop spots on the chocolate back
      if (streak(p.x, p.y, !vert, 3, 3, 1, 72, 0.7)) o.m = M('spot');
      return;
    }
    o.m = M('under');
    o.t += 0.12;
    // brown drop spots down the breast and flanks, sparser toward the belly
    if (u > -0.3 && streak(p.x, p.y, vert, 2, 3, 1, 74, u > 0.3 ? 0.55 : 0.3)) o.m = M('underM');
  },
  neckTex(c, p, o, t, side) {
    const { M } = c;
    void t;
    if (side > 0.35) { o.m = M('faceM'); return; }
    o.m = M('face');
  },
  headTex(c, p, o, hx, hy) {
    const { M } = c;
    // the black mask round the bill base, over the lores and down the chin
    if ((hx > 1.0 && hy > -1.8 && hy < 1.9) || (hy > 1.25 && hx > -0.9) || (hx > 0.3 && Math.abs(hy + 0.85) < 0.45)) { o.m = M('faceM'); return; }
    // the crown a shade deeper than the cheek, flowing back into the nape
    if (hy < -1.0) { o.m = M('head'); return; }
    // the cheek: warm cinnamon over the bulging jaw muscle
    o.m = M('face');
  },
  headExtra(c, R, H) {
    // the jaw muscle bulging behind the gape
    const q = H.p(-0.3, 0.9);
    R.bump(q[0], q[1], 1.9 * c.k, 1.5 * c.k, 0.8 * c.k, H.a, LBID.HEAD);
  },
};

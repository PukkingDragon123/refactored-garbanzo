// V11 Te Kāinga props: pixel-art painters for a lived-in village (each returns a Sprite anchored at
// its base). Front-on, lit from the upper left like the rest of the island:
//   wharenui      the carved meeting house: red kōkōwai maihi (bargeboards) with notched carving and
//                 raparapa ends, the koruru face and a tekoteko figure at the apex, carved amo posts,
//                 kōwhaiwhai scrolls on the porch rafters, tukutuku lattice panels, the door and window
//   whare         family houses: slab timber or raupō walls, thatch or a salvaged iron patch, a porch
//                 with whatever lives on a porch (gumboots, a bench, kete, a broom)
//   pātaka        a carved storehouse up on a post, a notched-log ladder
//   kūmara mounds, post-and-rail and wattle fences, a drying rack (fish, eels, flax), a woodpile with
//   the chopping block, the hāngī mound under wet sacks, a cooking fire with a tripod and pot, the
//   waka under construction on trestles, a laundry line, toys (a spinning top, a toy waka, a ball, a
//   hoop), kete, gourds, a pig pen, a chicken house, benches, a weaving shelter, the river landing,
//   net poles, eel traps, a carving shed, lanterns and flax torches for the festival,
//   Hinerua's pou: a tall post with the serpent taniwha coiling up it, shell eyes, a flat offering
//   stone at its foot; and the gateway with Hinerua carved along its lintel.

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Rng, bayer, clamp } from '../../../core/math';

const R = (...h: string[]): C[] => h.map(v => hex(v));
export const VP = {
  ink: hex('#140a06'),
  wood: R('#1e0e08', '#3a1e10', '#5a3018', '#7a4424', '#9a5a30', '#b8743e'),
  bark: R('#140c08', '#24180e', '#382618', '#4e3622', '#664830', '#7e5c3e'),
  grey: R('#1c1a18', '#34302c', '#4e4842', '#6a625a', '#867c72', '#a49a8e'),
  ochre: R('#2a0806', '#4e100c', '#761a12', '#9a2a1a', '#b83c24', '#d45a34'),
  thatch: R('#3a2c14', '#544020', '#6e562a', '#8a6e36', '#a68a46', '#c4a85e'),
  raupo: R('#4a3a1a', '#66522a', '#826c38', '#9e884a', '#b8a260', '#d0bc7a'),
  soil: R('#1a100a', '#2c1c12', '#40281a', '#563824', '#6e4a30', '#8a603e'),
  leaf: R('#0e1c0c', '#1a3014', '#28481c', '#386226', '#4c7e32', '#68a044'),
  flax: R('#0e1a0c', '#1a2e14', '#2a4420', '#3c5c2a', '#507636', '#6a9246'),
  iron: R('#1a1c1e', '#2e3236', '#464c52', '#606870', '#7c868e', '#9aa4aa'),
  rust: R('#2a1006', '#4a1e0c', '#6a3014', '#8a4420', '#a85a2e', '#c4763e'),
  stone: R('#1c1c1e', '#302f30', '#464444', '#5e5a58', '#787270', '#948e88'),
  cream: R('#6a604e', '#8e8470', '#b0a68e', '#cec4aa', '#e6dcc2', '#f6eedc'),
  black: hex('#100a08'),
  white: hex('#ece4d0'),
  red: hex('#a82a1c'),
  paua: hex('#5ac8b0'),
};

const S = (b: PixelBuffer, ax: number, ay: number, outline = true): Sprite => { if (outline) b.outline(VP.ink); return { buf: b, ax, ay }; };
const pick = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];
/** dithered ramp pick: v in ramp units */
const dpick = (r: C[], v: number, x: number, y: number) => pick(r, v + (bayer(x, y) - 0.5) * 0.9);

/** a vertical slab / plank wall with grain and gaps */
function slabWall(b: PixelBuffer, x0: number, y0: number, w: number, h: number, r: C[], seed: number, slab = 5) {
  const rng = new Rng(seed);
  let x = x0;
  while (x < x0 + w) {
    const sw = slab + Math.floor(rng.next() * 3) - 1, tone = 2 + rng.next() * 1.4;
    for (let i = 0; i < sw && x + i < x0 + w; i++) for (let y = y0; y < y0 + h; y++) {
      const edge = i === 0 ? -1.2 : i === sw - 1 ? -0.5 : 0;
      const grain = Math.sin((y + seed) * 0.7 + i * 2.1 + x * 0.3) > 0.85 ? -0.6 : 0;
      b.set(x + i, y, dpick(r, tone + edge + grain - (x + i - x0) / w * 0.4 + (y - y0) / h * -0.2, x + i, y));
    }
    x += sw;
  }
}
/** woven raupō / reed wall: horizontal bundles lashed with dark ties */
function reedWall(b: PixelBuffer, x0: number, y0: number, w: number, h: number, seed: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const band = (y - y0) % 4;
    const tie = (x - x0 + Math.floor((y - y0) / 4) * 3) % 14 === 0;
    b.set(x, y, tie ? VP.raupo[0] : dpick(VP.raupo, 3 - (band === 3 ? 1.2 : band === 0 ? -0.4 : 0) - (x - x0) / w * 0.6 + Math.sin(x * 0.9 + y + seed) * 0.2, x, y));
  }
}
/** a thatched gable roof seen front-on (a triangle), shaded and ragged at the eaves */
function thatchGable(b: PixelBuffer, cx: number, top: number, half: number, h: number, r: C[], seed: number) {
  const rng = new Rng(seed);
  for (let y = 0; y < h; y++) {
    const hw = (y / h) * half;
    for (let x = -hw; x <= hw; x++) {
      const X = Math.round(cx + x), Y = top + y;
      const streak = Math.sin(X * 1.7 + seed) * 0.4 + (rng.next() < 0.06 ? -1 : 0);
      b.set(X, Y, dpick(r, 3.4 - y / h * 1.4 + streak - (x / half) * 0.6, X, Y));
    }
  }
  // ragged eave fringe
  for (let x = -half; x <= half; x++) if (rng.next() < 0.6) b.set(Math.round(cx + x), top + h + (rng.next() < 0.4 ? 1 : 0), r[1]);
}

// ------------------------------------------------------------------ the wharenui
export function wharenui(): Sprite {
  const W = 200, H = 160;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, base = H - 1;
  const roofTop = 22, roofH = 64, half = 92;
  const wallTop = roofTop + roofH - 2;
  // the side roof behind (the long thatched body of the house going back), a darker band behind the gable
  for (let y = roofTop + 10; y < wallTop + 6; y++) for (let x = cx - half - 4; x <= cx + half + 4; x++) {
    const t = (y - roofTop) / roofH;
    if (Math.abs(x - cx) > t * (half + 4) + 2) continue;
    b.set(x, y, dpick(VP.thatch, 1.2 + Math.sin(x * 1.3) * 0.3, x, y));
  }
  // porch: back wall (dark), floor, door and window
  const porchL = cx - half + 18, porchR = cx + half - 18;
  slabWall(b, porchL, wallTop, porchR - porchL, base - wallTop - 6, VP.wood, 7, 6);
  for (let y = wallTop; y < base - 6; y++) for (let x = porchL; x < porchR; x++) b.set(x, y, mix(b.get(x, y), hex('#120a08'), 0.45));
  // tukutuku panels alternating with carved poupou along the porch walls (left and right of the door)
  const panels = [porchL + 2, porchL + 22, porchR - 38, porchR - 18];
  panels.forEach((px0, i) => {
    for (let y = wallTop + 8; y < base - 10; y++) for (let x = px0; x < px0 + 16; x++) {
      const lx = x - px0, ly = y - wallTop - 8;
      if (i % 2 === 0) {
        // poupou: a carved ancestor post, red with spiral notches and a pāua-eyed face at the top
        const face = ly < 14;
        let c = dpick(VP.ochre, 3.2 - lx / 16 * 1.2, x, y);
        if ((lx + ly) % 6 === 0 || (lx - ly + 60) % 6 === 0) c = VP.ochre[1];
        if (face && (lx === 4 || lx === 11) && ly === 6) c = VP.paua;
        if (face && lx > 5 && lx < 10 && ly === 10) c = VP.black;
        b.set(x, y, c);
      } else {
        // tukutuku: a cream lattice on dark slats, the pattern of stepped diamonds (poutama)
        const step = (Math.floor(lx / 3) + Math.floor(ly / 3)) % 4 === 0;
        const cross = lx % 3 === 1 && ly % 3 === 1;
        b.set(x, y, step ? hex('#e8d8a8') : cross ? hex('#c8a040') : (lx % 3 === 0 ? VP.wood[1] : VP.wood[2]));
      }
    }
  });
  // the door (tatau) and window (matapihi) in the middle, carved lintel (pare) above the door
  const dx = cx - 8;
  b.rect(dx, base - 34, 16, 28, hex('#0c0606'));
  for (let x = dx - 4; x < dx + 20; x++) for (let y = base - 42; y < base - 34; y++) b.set(x, y, ((x + y) % 5 === 0) ? VP.ochre[1] : dpick(VP.ochre, 3, x, y));
  b.set(cx - 3, base - 39, VP.paua); b.set(cx + 2, base - 39, VP.paua);
  b.rect(cx + 14, base - 32, 12, 9, hex('#0c0606'));
  b.rect(cx + 13, base - 33, 14, 1, VP.ochre[3]); b.rect(cx + 13, base - 23, 14, 1, VP.ochre[2]);
  // porch floor and the front step (paepae)
  for (let x = porchL - 4; x < porchR + 4; x++) { b.set(x, base - 6, VP.wood[3]); for (let y = base - 5; y <= base; y++) b.set(x, y, dpick(VP.wood, 2 - (y - base + 5) * 0.2, x, y)); }
  // porch rafters (heke) radiating under the gable, painted with kōwhaiwhai scrolls
  for (let y = roofTop + 8; y < wallTop; y++) {
    const t = (y - roofTop) / roofH, hw = t * half;
    for (let x = -hw + 6; x <= hw - 6; x++) {
      const X = Math.round(cx + x);
      const r = Math.floor((x / Math.max(1, hw)) * 7 + 7);
      const inRafter = Math.abs((x / Math.max(1, hw)) * 7 - Math.round((x / Math.max(1, hw)) * 7)) < 0.16;
      let c = hex('#1a0e0a');
      if (inRafter) {
        // a koru scroll along the rafter: white curls and black on red
        const s = Math.sin(y * 0.7 + r * 1.3);
        c = s > 0.55 ? VP.white : s < -0.45 ? VP.black : VP.ochre[3];
      }
      b.set(X, y, c);
    }
  }
  // the ridge pole (tāhuhu) end and the maihi: thick red bargeboards with notched carving along them
  for (let y = 0; y < roofH; y++) {
    const hw = (y / roofH) * half;
    for (const s of [-1, 1]) for (let k = 0; k < 8; k++) {
      const X = Math.round(cx + s * (hw - k)), Y = roofTop + y;
      let c = dpick(VP.ochre, 3.4 - k * 0.22 + (s > 0 ? -0.4 : 0.2), X, Y);
      // carving: rhythmic notches and a spiral every so often
      if ((k === 2 || k === 5) && y % 3 === 0) c = VP.ochre[1];
      if (k === 3 && y % 12 === 6) c = VP.paua;
      b.set(X, Y, c);
    }
  }
  // raparapa: the carved "fingers" at the lower ends of the maihi
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) for (let y = 0; y < 9; y++) b.set(Math.round(cx + s * (half - 2 - i * 2)), roofTop + roofH - 1 + y, i % 2 ? VP.ochre[2] : VP.ochre[4]);
  // amo: the carved posts at the front holding up the maihi
  for (const s of [-1, 1]) {
    const ax = Math.round(cx + s * (half - 14));
    for (let y = wallTop - 4; y < base - 6; y++) for (let k = 0; k < 9; k++) {
      const X = ax + k - 4, ly = y - wallTop;
      let c = dpick(VP.ochre, 3.2 - (k / 9) * 1.4, X, y);
      if ((ly + k * 2) % 7 === 0) c = VP.ochre[1];
      if (ly % 26 === 6 && (k === 2 || k === 6)) c = VP.paua;
      b.set(X, y, c);
    }
  }
  // koruru face at the apex and the tekoteko figure standing on top
  const ky = roofTop + 6;
  b.ellipse(cx, ky, 7, 6, VP.ochre[3]);
  b.set(cx - 3, ky - 1, VP.paua); b.set(cx + 3, ky - 1, VP.paua);
  b.set(cx - 3, ky - 2, VP.black); b.set(cx + 3, ky - 2, VP.black);
  b.rect(cx - 3, ky + 3, 7, 1, VP.black);
  for (let y = 0; y < 18; y++) for (let x = -4; x <= 4; x++) {
    const Y = roofTop - 18 + y;
    const w = y < 6 ? 3.5 : y < 13 ? 4 : 2.5;
    if (Math.abs(x) <= w) b.set(cx + x, Y, dpick(VP.ochre, 3.2 - (x + 4) / 9, cx + x, Y));
  }
  b.set(cx - 1, roofTop - 15, VP.paua); b.set(cx + 1, roofTop - 15, VP.paua);
  return S(b, Math.floor(cx), base);
}

// ------------------------------------------------------------------ family houses
export function whare(variant: number, seed: number): Sprite {
  const sizes: [number, number][] = [[72, 58], [62, 52], [80, 60], [56, 48]];
  const [w, h] = sizes[variant % sizes.length];
  const W = w + 24, H = h + 28;
  const b = new PixelBuffer(W, H);
  const cx = Math.floor(W / 2), base = H - 1;
  const wallH = Math.round(h * 0.5), roofH = Math.round(h * 0.62);
  const wallTop = base - wallH;
  const rng = new Rng(seed);
  // walls
  if (variant % 2 === 0) slabWall(b, cx - w / 2, wallTop, w, wallH, VP.wood, seed, 5);
  else reedWall(b, cx - w / 2, wallTop, w, wallH, seed);
  // door, a shuttered window
  const dx = cx - 6 + (variant === 2 ? -10 : 0);
  b.rect(dx, base - 20, 12, 20, hex('#0e0806'));
  b.rect(dx - 1, base - 21, 14, 1, VP.wood[4]);
  const wx = cx + (variant === 2 ? 10 : 12);
  b.rect(wx, base - 22, 9, 8, hex('#0e0806'));
  for (let y = base - 22; y < base - 14; y++) { b.set(wx - 3, y, VP.wood[3]); b.set(wx - 2, y, VP.wood[2]); }
  if (variant === 2) b.rect(wx + 1, base - 21, 7, 2, hex('#e8c060'));
  // the roof: thatch, or salvaged iron on one house with a rusty patch
  const top = base - wallH - roofH;
  if (variant === 3) {
    for (let y = 0; y < roofH; y++) {
      const hw = (y / roofH) * (w / 2 + 10);
      for (let x = -hw; x <= hw; x++) {
        const X = Math.round(cx + x), Y = top + y;
        const rib = (X - cx + 200) % 5 === 0;
        const rusty = (x > 4 && x < hw * 0.6 && y > roofH * 0.4) || Math.sin(X * 0.3 + Y * 0.2) > 0.92;
        b.set(X, Y, rusty ? dpick(VP.rust, 3 - (rib ? 1 : 0), X, Y) : dpick(VP.iron, 3.2 - (rib ? 1.2 : 0) - x / hw * 0.5, X, Y));
      }
    }
  } else thatchGable(b, cx, top, w / 2 + 10, roofH, variant === 1 ? VP.raupo : VP.thatch, seed);
  // bargeboards: plain timber, red ochre on the bigger houses
  for (let y = 0; y < roofH; y++) {
    const hw = (y / roofH) * (w / 2 + 10);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.set(Math.round(cx + s * (hw - k)), top + y, variant === 0 || variant === 2 ? (k === 1 ? VP.ochre[3] : VP.ochre[2]) : (k === 1 ? VP.wood[4] : VP.wood[2]));
  }
  // porch clutter: gumboots, a bench, a kete, a broom
  const clutter = rng.next();
  if (clutter < 0.5) { b.rect(dx - 10, base - 5, 3, 5, hex('#141414')); b.rect(dx - 7, base - 4, 3, 4, hex('#141414')); b.set(dx - 10, base - 5, hex('#3a3a3a')); }
  if (variant !== 3) { for (let x = cx + 4; x < cx + 22; x++) { b.set(x, base - 6, VP.wood[4]); } b.set(cx + 5, base - 5, VP.wood[2]); b.set(cx + 20, base - 5, VP.wood[2]); for (let y = base - 4; y <= base; y++) { b.set(cx + 5, y, VP.wood[2]); b.set(cx + 20, y, VP.wood[2]); } }
  // a kete on the bench
  b.ellipse(cx + 12, base - 8, 3, 2, VP.flax[3]); b.set(cx + 12, base - 11, VP.flax[2]);
  // a broom leaning by the door
  for (let y = 0; y < 18; y++) b.set(dx + 14 + Math.round(y * 0.15), base - 18 + y, VP.wood[3]);
  for (let x = -2; x <= 2; x++) for (let y = 0; y < 4; y++) b.set(dx + 16 + x + Math.round(y * 0.2), base - 4 + y, VP.thatch[3 - (x & 1)]);
  return S(b, cx, base);
}

// ------------------------------------------------------------------ the pātaka
export function pataka(): Sprite {
  const W = 52, H = 86;
  const b = new PixelBuffer(W, H);
  const cx = 26, base = H - 1;
  for (let y = 40; y <= base; y++) for (let k = -2; k <= 2; k++) b.set(cx + k, y, dpick(VP.wood, 3 - k * 0.5 + (y % 9 === 0 ? -1 : 0), cx + k, y));
  // the little house on top
  const top = 8, bodyTop = 26;
  slabWall(b, cx - 15, bodyTop, 30, 16, VP.wood, 33, 4);
  for (let y = 0; y < 18; y++) { const hw = (y / 18) * 20; for (let x = -hw; x <= hw; x++) b.set(Math.round(cx + x), top + y, dpick(VP.thatch, 3 - y / 18, Math.round(cx + x), top + y)); }
  for (let y = 0; y < 18; y++) { const hw = (y / 18) * 20; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.set(Math.round(cx + s * (hw - k)), top + y, k === 1 ? VP.ochre[4] : VP.ochre[2]); }
  b.disc(cx, top + 3, 3, VP.ochre[3]); b.set(cx - 1, top + 2, VP.paua); b.set(cx + 1, top + 2, VP.paua);
  b.rect(cx - 4, bodyTop + 4, 8, 10, hex('#0c0606'));
  for (let x = cx - 17; x <= cx + 17; x++) b.set(x, bodyTop + 16, VP.wood[4]);
  // the notched log ladder leaning on it
  for (let y = 0; y < 46; y++) { const X = cx + 20 - Math.round(y * 0.28), Y = base - y; b.set(X, Y, VP.wood[3]); b.set(X + 1, Y, VP.wood[2]); if (y % 7 === 0) b.set(X - 1, Y, VP.wood[1]); }
  return S(b, cx, base);
}

// ------------------------------------------------------------------ gardens and fences
export function kumaraRow(w: number, seed: number): Sprite {
  const H = 20, b = new PixelBuffer(w, H), rng = new Rng(seed);
  const base = H - 1;
  for (let x0 = 2; x0 < w - 10; x0 += 14) {
    // a mound
    for (let x = -7; x <= 7; x++) { const hh = Math.round(Math.sqrt(Math.max(0, 1 - (x / 7.5) ** 2)) * 6); for (let y = 0; y < hh; y++) b.set(x0 + 7 + x, base - y, dpick(VP.soil, 2.6 + y / 6 - x / 7 * 0.8, x0 + 7 + x, base - y)); }
    // vines and heart-shaped leaves, purple stems
    for (let i = 0; i < 7; i++) {
      const lx = x0 + 7 + Math.round((rng.next() - 0.5) * 14), ly = base - 5 - Math.round(rng.next() * 7);
      b.line(x0 + 7, base - 5, lx, ly, hex('#5a2a4a'));
      b.disc(lx, ly, 2, VP.leaf[3 + (rng.next() < 0.4 ? 1 : 0)]);
      b.set(lx - 1, ly - 1, VP.leaf[5]);
    }
  }
  return S(b, 0, base);
}
export function fence(w: number, kind: 'rail' | 'wattle', seed: number): Sprite {
  const H = 26, b = new PixelBuffer(w, H), rng = new Rng(seed), base = H - 1;
  const lean = (x: number) => Math.round(Math.sin(x * 0.05 + seed) * 1.2);
  if (kind === 'rail') {
    for (let x = 1; x < w - 1; x += 18 + Math.floor(rng.next() * 6)) for (let y = 4 + Math.floor(rng.next() * 3); y <= base; y++) { b.set(x + (y < 10 ? lean(x) : 0), y, VP.grey[3]); b.set(x + 1, y, VP.grey[2]); }
    for (const yy of [9, 16]) for (let x = 0; x < w; x++) { const Y = yy + Math.round(Math.sin(x * 0.04 + seed + yy) * 1.2); b.set(x, Y, dpick(VP.grey, 3.6, x, Y)); b.set(x, Y + 1, VP.grey[2]); }
  } else {
    for (let x = 1; x < w; x += 9) for (let y = 3; y <= base; y++) b.set(x, y, VP.wood[2]);
    for (let y = 6; y < base - 2; y++) for (let x = 0; x < w; x++) {
      const row = Math.floor((y - 6) / 3), wv = Math.sin((x / 9) * Math.PI + row * Math.PI);
      if ((y - 6) % 3 === 2) continue;
      b.set(x, y, dpick(VP.thatch, 2.4 + wv * 0.9, x, y));
    }
  }
  return S(b, 0, base);
}

// ------------------------------------------------------------------ work and food
export function dryingRack(seed: number): Sprite {
  const W = 66, H = 46, b = new PixelBuffer(W, H), rng = new Rng(seed), base = H - 1;
  for (const px of [4, 61]) for (let y = 3; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  for (const yy of [5, 22]) for (let x = 2; x < 64; x++) b.set(x, yy, VP.wood[4]);
  // the top rail: split fish and two long eels; the lower rail: flax drying in bundles
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 6;
    if (i === 3 || i === 7) { for (let y = 6; y < 20; y++) { b.set(x, y, hex('#2a2a22')); b.set(x + 1, y, hex('#44443a')); } continue; }
    for (let y = 6; y < 14 + (i % 3); y++) { const ww = y < 9 ? 1 : 2; for (let k = -ww; k <= ww; k++) b.set(x + k, y, y < 8 ? hex('#8a8070') : k < 0 ? hex('#c89a6a') : hex('#e0b480')); }
  }
  for (let i = 0; i < 7; i++) { const x = 10 + i * 7 + Math.round(rng.next() * 2); for (let y = 23; y < 23 + 12 + (i % 3) * 2; y++) { b.set(x, y, VP.flax[3]); b.set(x + 1, y, VP.flax[2]); } }
  return S(b, 33, base);
}
export function woodpile(seed: number): Sprite {
  const W = 58, H = 34, b = new PixelBuffer(W, H), rng = new Rng(seed), base = H - 1;
  // stacked rounds, end on: rings and bark
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6 - row; i++) {
    const cx = 6 + i * 8 + row * 4, cy = base - 3 - row * 7, r = 3.5 + rng.next() * 0.6;
    b.discFn(cx, cy, r, (x, y, nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.82 ? VP.wood[1] : (Math.floor(d * 5) % 2 ? hex('#c8a070') : hex('#a88050')); });
  }
  // the chopping block with the axe in it
  for (let y = base - 9; y <= base; y++) for (let x = 46; x < 56; x++) b.set(x, y, y === base - 9 ? hex('#c8a070') : dpick(VP.wood, 2.6 - (x - 46) / 10, x, y));
  for (let i = 0; i < 12; i++) b.set(52 - Math.round(i * 0.4), base - 10 - i, VP.wood[4]);
  b.rect(52, base - 12, 4, 3, VP.iron[3]); b.set(55, base - 12, VP.iron[5]);
  // chips on the ground
  for (let i = 0; i < 10; i++) b.set(40 + Math.round(rng.next() * 18), base - Math.round(rng.next() * 1.5), hex('#c8a070'));
  return S(b, 29, base);
}
export function hangiMound(): Sprite {
  const W = 50, H = 18, b = new PixelBuffer(W, H), base = H - 1;
  b.ellipseFn(25, base, 22, 8, (x, y, nx, ny) => (ny > 0 ? -1 : (Math.floor((x + y * 2) / 5) % 3 === 0 ? dpick(VP.cream, 1.4 - ny, x, y) : dpick(VP.soil, 3 - ny * 1.5 - nx * 0.6, x, y))));
  for (const [x, y] of [[6, base - 1], [44, base - 1], [10, base - 3]] as [number, number][]) b.disc(x, y, 2, VP.stone[3]);
  // a spade stuck in the earth beside it
  for (let y = 0; y < 16; y++) b.set(47, base - 16 + y, VP.wood[3]);
  b.rect(46, base - 3, 3, 4, VP.iron[3]);
  return S(b, 25, base);
}
export function cookFire(): Sprite {
  const W = 40, H = 40, b = new PixelBuffer(W, H), base = H - 1;
  // the tripod and the iron pot on its chain
  for (const [x0, x1] of [[4, 20], [36, 20], [14, 21]] as [number, number][]) b.line(x0, base, x1, 2, VP.wood[2]);
  for (let y = 3; y < 20; y++) b.set(20, y, VP.iron[2]);
  b.ellipseFn(20, 25, 7, 6, (x, y, nx, ny) => dpick(VP.iron, 2.8 - nx * 1.2 - ny * 0.6, x, y));
  b.rect(13, 19, 15, 2, VP.iron[3]);
  // the ring of stones and the logs
  for (let i = 0; i < 7; i++) b.disc(8 + i * 4, base - 1, 2, VP.stone[2 + (i % 3)]);
  b.line(12, base - 3, 28, base - 5, VP.wood[2]); b.line(13, base - 5, 27, base - 2, VP.wood[3]);
  return S(b, 20, base);
}
export function wakaBuild(): Sprite {
  const W = 150, H = 40, b = new PixelBuffer(W, H), base = H - 1;
  // two trestles
  for (const tx of [30, 112]) { b.line(tx - 8, base, tx, base - 14, VP.wood[2]); b.line(tx + 8, base, tx, base - 14, VP.wood[2]); b.rect(tx - 9, base - 15, 18, 2, VP.wood[3]); }
  // the hull: a long trunk, the near half adzed smooth, the far end still bark; adze marks
  for (let x = 0; x < 140; x++) {
    const t = x / 140, top = 8 + Math.round(Math.sin(t * Math.PI) * -2), bot = 24 - Math.round((1 - Math.sin(t * Math.PI)) * 6);
    for (let y = top; y < bot; y++) {
      const rough = t > 0.68;
      const adze = !rough && ((x * 3 + y * 5) % 11 === 0);
      b.set(x + 5, y, rough ? dpick(VP.bark, 2.4 - (y - top) / 6, x + 5, y) : adze ? VP.wood[2] : dpick(VP.wood, 4.2 - (y - top) / 5, x + 5, y));
    }
    if (x < 90) b.set(x + 5, top + 1, hex('#e0b880'));
  }
  // the hollowed top (dark inside) along the finished part
  for (let x = 14; x < 92; x++) b.set(x, 9, hex('#2a140a'));
  // chips under it
  const rng = new Rng(4);
  for (let i = 0; i < 26; i++) b.set(10 + Math.round(rng.next() * 130), base - Math.round(rng.next() * 2), rng.next() < 0.5 ? hex('#d8b080') : hex('#b08858'));
  return S(b, 75, base);
}
export function laundry(seed: number): Sprite {
  const W = 92, H = 50, b = new PixelBuffer(W, H), rng = new Rng(seed), base = H - 1;
  for (const px of [2, 88]) for (let y = 6; y <= base; y++) { b.set(px, y, VP.grey[3]); b.set(px + 1, y, VP.grey[2]); }
  const line = (x: number) => 9 + Math.round(Math.sin((x - 2) / 86 * Math.PI) * 5);
  for (let x = 3; x < 88; x++) b.set(x, line(x), VP.cream[2]);
  const cols = ['#c83a2a', '#2a5a9a', '#e8dcc0', '#3a7a4a', '#d8a030', '#7a3a8a', '#f0f0e8'];
  let x = 8;
  while (x < 80) {
    const kind = Math.floor(rng.next() * 3), col = hex(cols[Math.floor(rng.next() * cols.length)]), ly = line(x);
    if (kind === 0) {
      // a shirt
      for (let y = 0; y < 13; y++) for (let k = -5; k <= 5; k++) { if (y < 4 || Math.abs(k) < 4) b.set(x + 5 + k, ly + 1 + y, (k + y) % 7 === 0 ? shade(col, -0.25) : col); }
      x += 14;
    } else if (kind === 1) {
      // a towel
      for (let y = 0; y < 16; y++) for (let k = 0; k < 8; k++) b.set(x + k, ly + 1 + y, y % 5 === 0 ? shade(col, 0.2) : col);
      x += 11;
    } else {
      // a little dress
      for (let y = 0; y < 12; y++) { const ww = 2 + Math.floor(y / 3); for (let k = -ww; k <= ww; k++) b.set(x + 4 + k, ly + 1 + y, col); }
      x += 12;
    }
    b.set(x - 2, ly - 1, VP.wood[4]);
  }
  return S(b, 45, base);
}

// ------------------------------------------------------------------ small things
export function toy(kind: 'top' | 'waka' | 'ball' | 'hoop'): Sprite {
  const b = new PixelBuffer(16, 12), base = 11;
  if (kind === 'top') { b.poly([4, 4, 12, 4, 8, 10], VP.ochre[3]); b.rect(4, 3, 9, 2, VP.ochre[4]); b.set(8, 1, VP.wood[2]); b.set(8, 2, VP.wood[2]); for (let x = 5; x < 12; x += 2) b.set(x, 5, VP.white); }
  else if (kind === 'waka') { for (let x = 1; x < 15; x++) { b.set(x, 8, VP.wood[3]); b.set(x, 9, VP.wood[2]); } b.set(14, 7, VP.ochre[3]); b.set(14, 6, VP.ochre[3]); b.set(1, 7, VP.wood[3]); b.rect(7, 2, 1, 6, VP.wood[2]); b.poly([8, 2, 12, 6, 8, 6], VP.cream[4]); }
  else if (kind === 'ball') { b.discFn(8, 7, 4, (x, y, nx, ny) => ((x + y) % 3 === 0 ? VP.flax[2] : dpick(VP.flax, 4 - nx - ny, x, y))); }
  else { for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; b.set(8 + Math.cos(t) * 5, 6 + Math.sin(t) * 5, VP.wood[4]); } }
  return S(b, 8, base);
}
export function kete(n: number, seed: number): Sprite {
  const W = 10 + n * 9, H = 16, b = new PixelBuffer(W, H), rng = new Rng(seed), base = H - 1;
  for (let i = 0; i < n; i++) {
    const cx = 6 + i * 9, h = 7 + Math.floor(rng.next() * 3);
    for (let y = 0; y < h; y++) for (let k = -4; k <= 4; k++) { const X = cx + k, Y = base - y; b.set(X, Y, (X + Y) % 2 ? VP.flax[3] : VP.flax[4]); }
    b.line(cx - 3, base - h, cx, base - h - 3, VP.flax[2]); b.line(cx + 3, base - h, cx, base - h - 3, VP.flax[2]);
    // kūmara or fish peeking out
    if (rng.next() < 0.6) b.disc(cx, base - h, 2, rng.next() < 0.5 ? hex('#8a3a5a') : hex('#b8c0c4'));
  }
  return S(b, Math.floor(W / 2), base);
}
export function gourds(seed: number): Sprite {
  const b = new PixelBuffer(30, 18), rng = new Rng(seed), base = 17;
  for (let i = 0; i < 3; i++) {
    const cx = 6 + i * 9, r = 4 + rng.next() * 1.5;
    b.discFn(cx, base - r, r, (x, y, nx, ny) => dpick(VP.thatch, 4.2 - nx - ny * 1.2, x, y));
    b.discFn(cx, base - r * 2 - 1.5, r * 0.55, (x, y, nx, ny) => dpick(VP.thatch, 4 - nx - ny, x, y));
    b.set(cx, base - r * 2 - 3.5, VP.wood[1]);
  }
  return S(b, 15, base);
}
export function bench(w: number): Sprite {
  const b = new PixelBuffer(w, 10), base = 9;
  for (let x = 0; x < w; x++) { b.set(x, 2, VP.wood[4]); b.set(x, 3, VP.wood[3]); b.set(x, 4, VP.wood[2]); }
  for (const px of [3, w - 4]) for (let y = 5; y <= base; y++) { b.set(px, y, VP.wood[2]); b.set(px + 1, y, VP.wood[1]); }
  return S(b, Math.floor(w / 2), base);
}
export function logSeat(w: number): Sprite {
  const b = new PixelBuffer(w, 9), base = 8;
  for (let x = 0; x < w; x++) for (let y = 1; y <= base; y++) b.set(x, y, dpick(VP.bark, 4 - y * 0.4 + (x === 0 || x === w - 1 ? -1 : 0), x, y));
  b.ellipse(1, 4, 1, 3, hex('#c8a070'));
  return S(b, Math.floor(w / 2), base);
}
export function pigPen(w: number): Sprite {
  const H = 26, b = new PixelBuffer(w, H), base = H - 1;
  // mud, a trough, the low fence front
  for (let x = 2; x < w - 2; x++) for (let y = base - 2; y <= base; y++) b.set(x, y, dpick(VP.soil, 1.6 + Math.sin(x * 0.4) * 0.5, x, y));
  b.rect(w - 26, base - 6, 18, 5, VP.wood[2]); b.rect(w - 25, base - 6, 16, 1, hex('#5a6a3a'));
  for (let x = 0; x < w; x += 7) for (let y = 8; y <= base; y++) b.set(x, y, VP.wood[2]);
  for (const yy of [11, 18]) for (let x = 0; x < w; x++) b.set(x, yy, dpick(VP.wood, 3.6, x, yy));
  return S(b, 0, base);
}
export function coop(): Sprite {
  const b = new PixelBuffer(40, 40), base = 39;
  for (const px of [6, 32]) for (let y = 22; y <= base; y++) b.set(px, y, VP.wood[2]);
  slabWall(b, 4, 12, 32, 12, VP.wood, 91, 4);
  thatchGable(b, 20, 2, 20, 11, VP.thatch, 92);
  b.rect(16, 16, 7, 8, hex('#0c0606'));
  // the ramp
  for (let i = 0; i < 18; i++) { b.set(22 + i, 24 + Math.round(i * 0.85), VP.wood[3]); if (i % 4 === 0) b.set(22 + i, 23 + Math.round(i * 0.85), VP.wood[4]); }
  return S(b, 20, base);
}
export function shelter(w: number): Sprite {
  const H = 56, b = new PixelBuffer(w, H), base = H - 1;
  for (const px of [3, w - 5]) for (let y = 12; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  // a lean-to roof of nīkau fronds
  for (let y = 4; y < 14; y++) for (let x = 0; x < w; x++) {
    const frond = Math.sin(x * 1.2 + y) > 0.2;
    if (y > 12 && (x % 3)) continue;
    b.set(x, y, frond ? dpick(VP.thatch, 3 - (y - 4) * 0.15, x, y) : VP.thatch[1]);
  }
  for (let x = 0; x < w; x += 3) b.line(x, 14, x + 1, 17 + (x % 2), VP.thatch[2]);
  // a flax mat on the ground
  for (let x = 6; x < w - 6; x++) { b.set(x, base, (x % 3) ? VP.flax[4] : VP.flax[3]); b.set(x, base - 1, (x % 3) ? VP.flax[3] : VP.flax[2]); }
  return S(b, Math.floor(w / 2), base);
}
export function jetty(w: number): Sprite {
  const H = 24, b = new PixelBuffer(w, H), base = H - 1;
  for (let x = 0; x < w; x++) for (let y = 4; y < 7; y++) b.set(x, y, dpick(VP.grey, 3.8 - (y - 4) * 0.8 + (x % 9 === 0 ? -1.4 : 0), x, y));
  for (let x = 3; x < w; x += 16) for (let y = 7; y <= base; y++) { b.set(x, y, VP.wood[2]); b.set(x + 1, y, VP.wood[1]); }
  // a coil of rope and a bucket on the planks
  b.ellipse(w - 12, 2, 4, 2, VP.cream[2]); b.set(w - 12, 2, VP.cream[0]);
  return S(b, 0, 5);
}
export function netPoles(seed: number): Sprite {
  const W = 50, H = 52, b = new PixelBuffer(W, H), base = H - 1;
  for (const px of [6, 44]) for (let y = 2; y <= base; y++) b.set(px, y, VP.wood[3]);
  // the net sagging between them
  for (let y = 4; y < 34; y++) for (let x = 7; x < 44; x++) {
    const sag = Math.sin((x - 7) / 37 * Math.PI) * 6;
    const ly = y - sag;
    if (ly < 4 || ly > 30 - Math.sin((x - 7) / 37 * Math.PI) * 4) continue;
    if ((x + Math.round(ly)) % 4 === 0 || (x - Math.round(ly) + 100) % 4 === 0) b.set(x, y, VP.cream[2]);
  }
  // floats
  for (let x = 9; x < 43; x += 6) b.disc(x, 4 + Math.round(Math.sin((x - 7) / 37 * Math.PI) * 6), 1.4, VP.ochre[4]);
  void seed;
  return S(b, 25, base);
}
export function hinaki(): Sprite {
  const b = new PixelBuffer(30, 16), base = 15;
  b.ellipseFn(15, 9, 13, 6, (x, y, nx) => ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0 ? dpick(VP.thatch, 3 - nx, x, y) : -1));
  b.ellipse(3, 9, 2, 5, VP.thatch[2]);
  return S(b, 15, base);
}
export function shed(w: number): Sprite {
  const H = 62, b = new PixelBuffer(w, H), base = H - 1;
  for (const px of [4, w - 6]) for (let y = 14; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) { const X = x, Y = y + Math.round(x / w * 4); if (Y < H) b.set(X, Y, dpick(VP.thatch, 3.4 - y * 0.12, X, Y)); }
  // tools hanging under the roof: an adze, a mallet, chisels
  b.line(18, 18, 18, 30, VP.wood[3]); b.rect(16, 30, 5, 2, VP.stone[4]);
  b.line(30, 18, 30, 28, VP.wood[3]); b.rect(28, 28, 5, 4, VP.wood[2]);
  for (let i = 0; i < 4; i++) b.line(42 + i * 3, 18, 42 + i * 3, 25, VP.iron[3]);
  return S(b, Math.floor(w / 2), base);
}

// ------------------------------------------------------------------ festival lights
export function torch(): Sprite {
  const b = new PixelBuffer(10, 40), base = 39;
  for (let y = 8; y <= base; y++) { b.set(4, y, VP.wood[3]); b.set(5, y, VP.wood[2]); }
  // a flax-wrapped head soaked in oil
  for (let y = 4; y < 10; y++) for (let x = 2; x < 8; x++) b.set(x, y, (x + y) % 2 ? VP.flax[1] : VP.thatch[1]);
  return S(b, 5, base);
}
export function lanternString(w: number, seed: number): Sprite {
  const H = 26, b = new PixelBuffer(w, H), rng = new Rng(seed);
  const line = (x: number) => 3 + Math.round(Math.sin(x / w * Math.PI) * 10);
  for (let x = 0; x < w; x++) b.set(x, line(x), VP.cream[1]);
  for (let x = 6; x < w - 4; x += 12) {
    const y = line(x) + 1, col = rng.next() < 0.5 ? hex('#f0b048') : hex('#e87040');
    for (let k = 0; k < 6; k++) for (let j = -2; j <= 2; j++) if (Math.abs(j) <= (k < 1 || k > 4 ? 1 : 2)) b.set(x + j, y + 1 + k, (j + k) % 3 === 0 ? shade(col, -0.25) : col);
    b.set(x, y, VP.wood[2]);
  }
  return { buf: b, ax: 0, ay: 0 };
}

// ------------------------------------------------------------------ Hinerua
/** Hinerua's pou at the river landing: a tall carved post, the serpent coiling up it, shell eyes */
export function hineruaPou(): Sprite {
  const W = 40, H = 120, b = new PixelBuffer(W, H), base = H - 1, cx = 20;
  // the post: red ochre, a carved ancestor face near the top
  for (let y = 10; y <= base - 6; y++) for (let k = -5; k <= 5; k++) {
    let c = dpick(VP.ochre, 3.4 - (k + 5) / 10 * 1.6, cx + k, y);
    if ((y + Math.abs(k) * 2) % 9 === 0) c = VP.ochre[1];
    b.set(cx + k, y, c);
  }
  b.ellipse(cx, 18, 6, 7, VP.ochre[3]);
  b.set(cx - 3, 16, VP.paua); b.set(cx + 3, 16, VP.paua); b.set(cx - 3, 15, VP.black); b.set(cx + 3, 15, VP.black);
  b.rect(cx - 3, 22, 7, 1, VP.black); b.set(cx - 4, 21, VP.black); b.set(cx + 4, 21, VP.black);
  // Hinerua: a scaled serpent body winding up round the post, her head over the top looking out
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push([cx + Math.sin(t * Math.PI * 5) * 9, base - 10 - t * 92]); }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const front = Math.cos((i / 60) * Math.PI * 5) > -0.2;
    const r = 3.4 - i / 60 * 1.2;
    for (let s = 0; s <= 4; s++) {
      const x = x0 + (x1 - x0) * s / 4, y = y0 + (y1 - y0) * s / 4;
      b.discFn(x, y, r, (X, Y, nx, ny) => {
        if (!front && Math.abs(X - cx) < 5) return -1;
        const scale = ((X + Y * 2) % 4 === 0) ? -1 : 0;
        return dpick([hex('#0e1a14'), hex('#1a3428'), hex('#28503a'), hex('#3a6e4a'), hex('#58905c'), hex('#84b47a')], 3.2 - nx * 0.8 - ny * 0.6 + scale, X, Y);
      });
    }
  }
  // her head at the top: a wide, gentle serpent's head with fins like a crown, pāua eyes
  const hx0 = cx + 2, hy0 = 8;
  b.ellipseFn(hx0, hy0, 9, 5, (X, Y, nx, ny) => dpick([hex('#0e1a14'), hex('#1a3428'), hex('#28503a'), hex('#3a6e4a'), hex('#58905c'), hex('#84b47a')], 3.6 - nx * 0.6 - ny, X, Y));
  for (let i = 0; i < 4; i++) b.line(hx0 - 6 + i * 3, hy0 - 4, hx0 - 8 + i * 3, hy0 - 8, hex('#a8342a'));
  b.set(hx0 + 4, hy0 - 1, VP.paua); b.set(hx0 + 5, hy0 - 1, VP.white);
  b.line(hx0 + 4, hy0 + 2, hx0 + 9, hy0 + 2, VP.black);
  // the flat offering stone at the foot
  b.ellipseFn(cx, base - 2, 14, 3, (X, Y, nx, ny) => dpick(VP.stone, 4 - ny * 1.4 - nx * 0.5, X, Y));
  return S(b, cx, base);
}
/** the waharoa: the carved gateway, Hinerua along the lintel, her head over the opening */
export function gateway(): Sprite {
  const W = 70, H = 104, b = new PixelBuffer(W, H), base = H - 1;
  for (const px of [6, 54]) for (let y = 14; y <= base; y++) for (let k = 0; k < 10; k++) {
    let c = dpick(VP.ochre, 3.4 - k * 0.18, px + k, y);
    if ((y + k * 2) % 8 === 0) c = VP.ochre[1];
    if (y % 30 === 20 && (k === 3 || k === 7)) c = VP.paua;
    b.set(px + k, y, c);
  }
  // the lintel: Hinerua's body undulating along it
  for (let x = 2; x < 68; x++) {
    const yc = 10 + Math.sin(x * 0.22) * 3;
    for (let y = -4; y <= 4; y++) {
      const Y = Math.round(yc + y);
      b.set(x, Y, (x + Y * 2) % 4 === 0 ? hex('#1a3428') : dpick([hex('#0e1a14'), hex('#1a3428'), hex('#28503a'), hex('#3a6e4a'), hex('#58905c'), hex('#84b47a')], 3.4 - y * 0.35, x, Y));
    }
  }
  b.ellipse(35, 8, 7, 5, hex('#3a6e4a'));
  b.set(32, 7, VP.paua); b.set(38, 7, VP.paua);
  for (let i = 0; i < 3; i++) b.line(31 + i * 4, 3, 30 + i * 4, 0, hex('#a8342a'));
  return S(b, 35, base);
}

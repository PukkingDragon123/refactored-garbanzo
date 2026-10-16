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
// (people are ~62 px tall: the porch is 90 high, the door 50)
export function wharenui(): Sprite {
  const W = 260, H = 214;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, base = H - 1;
  const roofTop = 26, roofH = 86, half = 120;
  const wallTop = roofTop + roofH - 2;
  // the long thatched body of the house going back, behind the gable
  for (let y = roofTop + 12; y < wallTop + 8; y++) for (let x = cx - half - 5; x <= cx + half + 5; x++) {
    const t = (y - roofTop) / roofH;
    if (Math.abs(x - cx) > t * (half + 5) + 2) continue;
    b.set(x, y, dpick(VP.thatch, 1.2 + Math.sin(x * 1.3) * 0.3, x, y));
  }
  // porch: the front wall (in shadow), the floor
  const porchL = cx - half + 22, porchR = cx + half - 22;
  slabWall(b, porchL, wallTop, porchR - porchL, base - wallTop - 7, VP.wood, 7, 6);
  for (let y = wallTop; y < base - 7; y++) for (let x = porchL; x < porchR; x++) b.set(x, y, mix(b.get(x, y), hex('#120a08'), 0.42 + (bayer(x, y) < 0.25 ? 0.06 : 0)));
  // tukutuku panels alternating with carved poupou along the porch wall, both sides of the door
  const dw = 24, dh = 50, door0 = cx - dw / 2 - 18;
  const panelW = 16;
  const slots: number[] = [];
  for (let x = porchL + 3; x + panelW < door0 - 4; x += panelW + 3) slots.push(x);
  for (let x = porchR - 3 - panelW; x > cx + 40; x -= panelW + 3) slots.push(x);
  slots.forEach((px0, i) => {
    for (let y = wallTop + 8; y < base - 11; y++) for (let x = px0; x < px0 + panelW; x++) {
      const lx = x - px0, ly = y - wallTop - 8;
      if (i % 2 === 0) {
        // poupou: an ancestor post, red with spiral notches, pāua eyes in the face at the top
        const face = ly < 16;
        let c = dpick(VP.ochre, 3.2 - lx / panelW * 1.2, x, y);
        if ((lx + ly) % 6 === 0 || (lx - ly + 60) % 6 === 0) c = VP.ochre[1];
        if (face && (lx === 4 || lx === 11) && ly === 6) c = VP.paua;
        if (face && lx > 5 && lx < 10 && ly === 11) c = VP.black;
        if (ly > 30 && Math.abs(lx - 8) < 3 && ly % 12 < 2) c = VP.white;
        b.set(x, y, c);
      } else {
        // tukutuku: a cream lattice on dark slats, stepped poutama and a niho taniwha band
        const step = (Math.floor(lx / 3) + Math.floor(ly / 3)) % 4 === 0;
        const cross = lx % 3 === 1 && ly % 3 === 1;
        const band = ly % 24 < 3 && (lx + ly) % 4 < 2;
        b.set(x, y, band ? VP.ochre[3] : step ? hex('#e8d8a8') : cross ? hex('#c8a040') : (lx % 3 === 0 ? VP.wood[1] : VP.wood[2]));
      }
    }
  });
  // the door (tatau) with its carved lintel (pare), and the window (matapihi)
  b.rect(door0, base - 7 - dh, dw, dh, hex('#0c0606'));
  for (let x = door0 - 5; x < door0 + dw + 5; x++) for (let y = base - 7 - dh - 10; y < base - 7 - dh; y++) b.set(x, y, ((x + y) % 5 === 0) ? VP.ochre[1] : dpick(VP.ochre, 3, x, y));
  b.set(door0 + 7, base - 7 - dh - 6, VP.paua); b.set(door0 + dw - 8, base - 7 - dh - 6, VP.paua);
  for (const s of [-1, 1]) for (let y = base - 7 - dh; y < base - 7; y++) b.set(s < 0 ? door0 - 1 : door0 + dw, y, VP.ochre[2]);
  const wx = cx + 18, wy = base - 44;
  b.rect(wx, wy, 18, 14, hex('#0c0606'));
  for (let x = wx - 2; x < wx + 20; x++) { b.set(x, wy - 1, VP.ochre[3]); b.set(x, wy + 14, VP.ochre[2]); }
  // a pair of shoes left at the door: you go in barefoot
  b.rect(door0 - 12, base - 9, 4, 2, hex('#2a2018')); b.rect(door0 - 7, base - 9, 4, 2, hex('#2a2018'));
  // porch floor and the front step (paepae)
  for (let x = porchL - 6; x < porchR + 6; x++) { b.set(x, base - 7, VP.wood[4]); for (let y = base - 6; y <= base; y++) b.set(x, y, dpick(VP.wood, 2.2 - (y - base + 6) * 0.2, x, y)); }
  // porch rafters (heke) radiating under the gable, painted with kōwhaiwhai: white koru on red and black
  for (let y = roofTop + 10; y < wallTop; y++) {
    const t = (y - roofTop) / roofH, hw = t * half;
    for (let x = -hw + 8; x <= hw - 8; x++) {
      const X = Math.round(cx + x);
      const u = (x / Math.max(1, hw)) * 8;
      const inRafter = Math.abs(u - Math.round(u)) < 0.14;
      let c = hex('#1a0e0a');
      if (inRafter) { const s = Math.sin(y * 0.6 + Math.round(u) * 1.3); c = s > 0.55 ? VP.white : s < -0.45 ? VP.black : VP.ochre[3]; }
      b.set(X, y, c);
    }
  }
  // the maihi: thick red bargeboards, notched carving along them, pāua eyes
  for (let y = 0; y < roofH; y++) {
    const hw = (y / roofH) * half;
    for (const s of [-1, 1]) for (let k = 0; k < 10; k++) {
      const X = Math.round(cx + s * (hw - k)), Y = roofTop + y;
      let c = dpick(VP.ochre, 3.4 - k * 0.18 + (s > 0 ? -0.4 : 0.2), X, Y);
      if ((k === 2 || k === 6) && y % 3 === 0) c = VP.ochre[1];
      if (k === 4 && y % 14 === 7) c = VP.paua;
      if (k === 4 && y % 14 === 0) c = VP.white;
      b.set(X, Y, c);
    }
  }
  // raparapa: the carved "fingers" at the lower ends of the maihi
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) for (let y = 0; y < 11; y++) b.set(Math.round(cx + s * (half - 2 - i * 2)), roofTop + roofH - 1 + y, i % 2 ? VP.ochre[2] : VP.ochre[4]);
  // amo: the carved posts at the front holding up the maihi
  for (const s of [-1, 1]) {
    const ax = Math.round(cx + s * (half - 16));
    for (let y = wallTop - 6; y < base - 7; y++) for (let k = 0; k < 11; k++) {
      const X = ax + k - 5, ly = y - wallTop;
      let c = dpick(VP.ochre, 3.2 - (k / 11) * 1.4, X, y);
      if ((ly + k * 2) % 7 === 0) c = VP.ochre[1];
      if (ly % 30 === 8 && (k === 3 || k === 7)) c = VP.paua;
      b.set(X, y, c);
    }
  }
  // koruru face at the apex, the tekoteko figure standing on top
  const ky = roofTop + 8;
  b.ellipse(cx, ky, 8, 7, VP.ochre[3]);
  b.set(cx - 3, ky - 1, VP.paua); b.set(cx + 3, ky - 1, VP.paua); b.set(cx - 3, ky - 2, VP.black); b.set(cx + 3, ky - 2, VP.black);
  b.rect(cx - 3, ky + 4, 7, 1, VP.black);
  for (let y = 0; y < 22; y++) for (let x = -5; x <= 5; x++) {
    const Y = roofTop - 22 + y, w = y < 7 ? 4 : y < 16 ? 5 : 3;
    if (Math.abs(x) <= w) b.set(cx + x, Y, dpick(VP.ochre, 3.2 - (x + 5) / 11, cx + x, Y));
  }
  b.set(cx - 2, roofTop - 18, VP.paua); b.set(cx + 2, roofTop - 18, VP.paua);
  return S(b, Math.floor(cx), base);
}

// ------------------------------------------------------------------ family houses
export function whare(variant: number, seed: number): Sprite {
  const sizes: [number, number][] = [[112, 104], [98, 96], [128, 108], [92, 92]];
  const [w, h] = sizes[variant % sizes.length];
  const W = w + 30, H = h + 34;
  const b = new PixelBuffer(W, H);
  const cx = Math.floor(W / 2), base = H - 1;
  const wallH = Math.round(h * 0.52), roofH = Math.round(h * 0.6);
  const wallTop = base - wallH;
  const rng = new Rng(seed);
  // walls, a low stone footing
  if (variant % 2 === 0) slabWall(b, cx - w / 2, wallTop, w, wallH, VP.wood, seed, 6);
  else reedWall(b, cx - w / 2, wallTop, w, wallH, seed);
  for (let x = cx - w / 2; x < cx + w / 2; x++) for (let y = base - 3; y <= base; y++) b.set(x, y, dpick(VP.stone, 2.6 + Math.sin(x * 0.7) * 0.6, x, y));
  // door and a shuttered window
  const dw = 20, dh = 44;
  const dx = cx - dw / 2 + (variant === 2 ? -18 : -8);
  b.rect(dx, base - dh, dw, dh, hex('#0e0806'));
  for (let x = dx - 2; x < dx + dw + 2; x++) b.set(x, base - dh - 1, VP.wood[4]);
  for (let y = base - dh; y <= base; y++) { b.set(dx - 1, y, VP.wood[3]); b.set(dx + dw, y, VP.wood[2]); }
  const wx = dx + dw + 12, wy = base - 38;
  b.rect(wx, wy, 14, 12, hex('#0e0806'));
  for (let y = wy; y < wy + 12; y++) for (let k = 0; k < 4; k++) b.set(wx - 5 + k, y, (y + k) % 4 === 0 ? VP.wood[1] : VP.wood[3]);
  for (let x = wx - 1; x < wx + 15; x++) { b.set(x, wy - 1, VP.wood[4]); b.set(x, wy + 12, VP.wood[4]); }
  if (variant === 2) b.rect(wx + 2, wy + 2, 10, 3, hex('#e8c060'));
  // the roof: thatch, or salvaged iron with a rusty patch
  const top = base - wallH - roofH;
  const half = w / 2 + 14;
  if (variant === 3) {
    for (let y = 0; y < roofH; y++) {
      const hw = (y / roofH) * half;
      for (let x = -hw; x <= hw; x++) {
        const X = Math.round(cx + x), Y = top + y;
        const rib = (X - cx + 200) % 6 === 0;
        const rusty = (x > 6 && x < hw * 0.6 && y > roofH * 0.4) || Math.sin(X * 0.3 + Y * 0.2) > 0.92;
        b.set(X, Y, rusty ? dpick(VP.rust, 3 - (rib ? 1 : 0), X, Y) : dpick(VP.iron, 3.2 - (rib ? 1.2 : 0) - x / hw * 0.5, X, Y));
      }
    }
  } else thatchGable(b, cx, top, half, roofH, variant === 1 ? VP.raupo : VP.thatch, seed);
  // bargeboards: plain timber, red ochre on the bigger houses
  for (let y = 0; y < roofH; y++) {
    const hw = (y / roofH) * half;
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) b.set(Math.round(cx + s * (hw - k)), top + y, variant === 0 || variant === 2 ? (k === 1 || k === 2 ? VP.ochre[3] : VP.ochre[2]) : (k === 1 ? VP.wood[4] : VP.wood[2]));
  }
  // porch clutter: gumboots, a bench, a kete, a broom, a bucket
  if (rng.next() < 0.6) { b.rect(dx - 13, base - 9, 4, 9, hex('#141414')); b.rect(dx - 8, base - 8, 4, 8, hex('#141414')); b.set(dx - 13, base - 9, hex('#3a3a3a')); b.set(dx - 8, base - 8, hex('#3a3a3a')); }
  if (variant !== 3) {
    const bx0 = cx + 14, bx1 = cx + 40;
    for (let x = bx0; x < bx1; x++) { b.set(x, base - 14, VP.wood[4]); b.set(x, base - 13, VP.wood[3]); }
    for (const px of [bx0 + 2, bx1 - 3]) for (let y = base - 12; y <= base; y++) b.set(px, y, VP.wood[2]);
    b.ellipse(bx0 + 10, base - 18, 4, 3, VP.flax[3]); b.set(bx0 + 10, base - 22, VP.flax[2]);
  } else { b.ellipseFn(cx + 26, base - 6, 6, 6, (x, y, nx) => dpick(VP.iron, 3 - nx, x, y)); }
  for (let y = 0; y < 34; y++) b.set(dx + dw + 4 + Math.round(y * 0.12), base - 34 + y, VP.wood[3]);
  for (let x = -3; x <= 3; x++) for (let y = 0; y < 7; y++) b.set(dx + dw + 8 + x + Math.round(y * 0.2), base - 6 + y, VP.thatch[3 - (x & 1)]);
  return S(b, cx, base);
}

// ------------------------------------------------------------------ the pātaka
export function pataka(): Sprite {
  const W = 70, H = 140;
  const b = new PixelBuffer(W, H);
  const cx = 35, base = H - 1;
  // the post, carved at the top
  for (let y = 64; y <= base; y++) for (let k = -3; k <= 3; k++) b.set(cx + k, y, dpick(VP.wood, 3 - k * 0.4 + (y % 9 === 0 ? -1 : 0), cx + k, y));
  for (let y = 64; y < 74; y++) for (let k = -4; k <= 4; k++) b.set(cx + k, y, (y + k) % 3 === 0 ? VP.ochre[1] : VP.ochre[3]);
  // the house on top
  const top = 14, bodyTop = 40;
  slabWall(b, cx - 22, bodyTop, 44, 24, VP.wood, 33, 5);
  for (let y = 0; y < 27; y++) { const hw = (y / 27) * 30; for (let x = -hw; x <= hw; x++) b.set(Math.round(cx + x), top + y, dpick(VP.thatch, 3 - y / 27, Math.round(cx + x), top + y)); }
  for (let y = 0; y < 27; y++) { const hw = (y / 27) * 30; for (const s of [-1, 1]) for (let k = 0; k < 4; k++) b.set(Math.round(cx + s * (hw - k)), top + y, k === 1 || k === 2 ? VP.ochre[4] : VP.ochre[2]); }
  b.disc(cx, top + 4, 4, VP.ochre[3]); b.set(cx - 2, top + 3, VP.paua); b.set(cx + 2, top + 3, VP.paua);
  for (let y = 0; y < 10; y++) for (let x = -2; x <= 2; x++) b.set(cx + x, top - 10 + y, dpick(VP.ochre, 3 - x * 0.3, cx + x, top - 10 + y));
  b.rect(cx - 6, bodyTop + 6, 12, 16, hex('#0c0606'));
  for (let x = cx - 25; x <= cx + 25; x++) { b.set(x, bodyTop + 24, VP.wood[4]); b.set(x, bodyTop + 25, VP.wood[2]); }
  // the notched-log ladder leaning on it
  for (let y = 0; y < 74; y++) { const X = cx + 30 - Math.round(y * 0.3), Y = base - y; b.set(X, Y, VP.wood[3]); b.set(X + 1, Y, VP.wood[2]); if (y % 8 === 0) { b.set(X - 1, Y, VP.wood[1]); b.set(X + 2, Y, VP.wood[4]); } }
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
  const W = 70, H = 66, b = new PixelBuffer(W, H), rng = new Rng(seed), base = H - 1, D = 14;
  for (const px of [4, 64]) for (let y = 3; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  for (const yy of [5, 28]) for (let x = 2; x < 68; x++) { b.set(x, yy, VP.wood[4]); b.set(x, yy + 1, VP.wood[2]); }
  // the top rail: split fish and two long eels; the lower rail: flax drying in bundles
  for (let i = 0; i < 10; i++) {
    const x = 8 + i * 6;
    if (i === 3 || i === 7) { for (let y = 7; y < 7 + D + 8; y++) { b.set(x, y, hex('#2a2a22')); b.set(x + 1, y, hex('#44443a')); } continue; }
    for (let y = 7; y < 7 + D + (i % 3); y++) { const ww = y < 10 ? 1 : 2; for (let k = -ww; k <= ww; k++) b.set(x + k, y, y < 9 ? hex('#8a8070') : k < 0 ? hex('#c89a6a') : hex('#e0b480')); }
  }
  for (let i = 0; i < 8; i++) { const x = 10 + i * 7 + Math.round(rng.next() * 2); for (let y = 30; y < 30 + 16 + (i % 3) * 3; y++) { b.set(x, y, VP.flax[3]); b.set(x + 1, y, VP.flax[2]); } }
  return S(b, 35, base);
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
  const W = 96, H = 72, b = new PixelBuffer(W, H), rng = new Rng(seed), base = H - 1;
  for (const px of [2, 92]) for (let y = 6; y <= base; y++) { b.set(px, y, VP.grey[3]); b.set(px + 1, y, VP.grey[2]); }
  const line = (x: number) => 9 + Math.round(Math.sin((x - 2) / 90 * Math.PI) * 6);
  for (let x = 3; x < 92; x++) b.set(x, line(x), VP.cream[2]);
  const cols = ['#c83a2a', '#2a5a9a', '#e8dcc0', '#3a7a4a', '#d8a030', '#7a3a8a', '#f0f0e8'];
  let x = 8;
  while (x < 82) {
    const kind = Math.floor(rng.next() * 3), col = hex(cols[Math.floor(rng.next() * cols.length)]), ly = line(x);
    if (kind === 0) {
      for (let y = 0; y < 16; y++) for (let k = -6; k <= 6; k++) { if (y < 5 || Math.abs(k) < 5) b.set(x + 6 + k, ly + 1 + y, (k + y) % 7 === 0 ? shade(col, -0.25) : col); }
      x += 16;
    } else if (kind === 1) {
      for (let y = 0; y < 20; y++) for (let k = 0; k < 9; k++) b.set(x + k, ly + 1 + y, y % 5 === 0 ? shade(col, 0.2) : col);
      x += 12;
    } else {
      for (let y = 0; y < 14; y++) { const ww = 2 + Math.floor(y / 3); for (let k = -ww; k <= ww; k++) b.set(x + 5 + k, ly + 1 + y, col); }
      x += 13;
    }
    b.set(x - 2, ly - 1, VP.wood[4]);
  }
  // a basket of pegs and folded washing under the line
  b.ellipseFn(70, base - 4, 9, 5, (X, Y, nx) => ((X + Y) % 2 ? VP.flax[3] : VP.flax[4]));
  b.rect(64, base - 10, 12, 3, hex('#e8dcc0'));
  return S(b, 48, base);
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
export function bench(w: number, h = 15): Sprite {
  const b = new PixelBuffer(w, h + 1), base = h;
  for (let x = 0; x < w; x++) { b.set(x, 1, VP.wood[4]); b.set(x, 2, VP.wood[3]); b.set(x, 3, VP.wood[2]); }
  for (const px of [3, w - 4]) for (let y = 4; y <= base; y++) { b.set(px, y, VP.wood[2]); b.set(px + 1, y, VP.wood[1]); }
  return S(b, Math.floor(w / 2), base);
}

export function logSeat(w: number, h = 14): Sprite {
  // a big log lying on its side: round, bark lit along the top, the sawn end showing its rings
  const b = new PixelBuffer(w + 2, h + 2), base = h, r = h / 2, cy = base - r;
  for (let x = 0; x < w; x++) for (let y = 0; y <= base; y++) {
    const ny = (y - cy) / r;
    if (Math.abs(ny) > 1) continue;
    const ridge = Math.sin(x * 1.3 + y * 0.4) > 0.75 ? -0.9 : 0;
    b.set(x + 1, y, dpick(VP.bark, 3.6 - ny * 1.8 + ridge, x, y));
  }
  // the cut end at the left: an ellipse of pale wood with dark rings
  b.ellipseFn(2, cy, Math.max(2, r * 0.45), r, (x, y, nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.86 ? VP.bark[1] : Math.floor(d * 4) % 2 ? hex('#c09868') : hex('#a07848'); });
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
  const H = 86, b = new PixelBuffer(w, H), base = H - 1;
  for (const px of [3, w - 5]) for (let y = 12; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  // a lean-to roof of nīkau fronds, hanging ragged at the front
  for (let y = 4; y < 16; y++) for (let x = 0; x < w; x++) {
    const frond = Math.sin(x * 1.2 + y) > 0.2;
    b.set(x, y + Math.round(x / w * 3), frond ? dpick(VP.thatch, 3 - (y - 4) * 0.12, x, y) : VP.thatch[1]);
  }
  for (let x = 0; x < w; x += 2) b.line(x, 17 + Math.round(x / w * 3), x + 1, 21 + (x % 3) + Math.round(x / w * 3), VP.thatch[2]);
  // flax leaves drying over the rail, a flax mat on the ground
  for (let i = 0; i < 6; i++) for (let y = 22; y < 40 + (i % 3) * 4; y++) b.set(10 + i * 9, y, i % 2 ? VP.flax[3] : VP.flax[4]);
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
  const W = 54, H = 70, b = new PixelBuffer(W, H), base = H - 1;
  for (const px of [6, 48]) for (let y = 2; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  for (let y = 4; y < 44; y++) for (let x = 8; x < 48; x++) {
    const s0 = Math.sin((x - 8) / 40 * Math.PI);
    const ly = y - s0 * 7;
    if (ly < 4 || ly > 38 - s0 * 4) continue;
    if ((x + Math.round(ly)) % 4 === 0 || (x - Math.round(ly) + 100) % 4 === 0) b.set(x, y, VP.cream[2]);
  }
  for (let x = 10; x < 47; x += 6) b.disc(x, 4 + Math.round(Math.sin((x - 8) / 40 * Math.PI) * 7), 1.4, VP.ochre[4]);
  void seed;
  return S(b, 27, base);
}

export function hinaki(): Sprite {
  const b = new PixelBuffer(30, 16), base = 15;
  b.ellipseFn(15, 9, 13, 6, (x, y, nx) => ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0 ? dpick(VP.thatch, 3 - nx, x, y) : -1));
  b.ellipse(3, 9, 2, 5, VP.thatch[2]);
  return S(b, 15, base);
}
export function shed(w: number): Sprite {
  const H = 96, b = new PixelBuffer(w, H), base = H - 1;
  for (const px of [4, Math.floor(w / 2), w - 6]) for (let y = 14; y <= base; y++) { b.set(px, y, VP.wood[3]); b.set(px + 1, y, VP.wood[2]); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) { const Y = y + Math.round(x / w * 5); if (Y < H) b.set(x, Y, dpick(VP.thatch, 3.4 - y * 0.12, x, Y)); }
  for (let x = 0; x < w; x += 2) b.line(x, 16 + Math.round(x / w * 5), x, 19 + (x % 3) + Math.round(x / w * 5), VP.thatch[2]);
  // tools hanging under the roof: an adze, a mallet, chisels, a coil of cord
  b.line(18, 20, 18, 36, VP.wood[3]); b.rect(15, 36, 6, 3, VP.stone[4]);
  b.line(32, 20, 32, 32, VP.wood[3]); b.rect(29, 32, 7, 5, VP.wood[2]);
  for (let i = 0; i < 4; i++) b.line(46 + i * 3, 20, 46 + i * 3, 28, VP.iron[3]);
  b.ellipse(w - 24, 26, 5, 4, VP.cream[2]); b.ellipse(w - 24, 26, 2, 1, VP.cream[0]);
  return S(b, Math.floor(w / 2), base);
}

export function stakes(w: number, seed: number): Sprite {
  const H = 70, b = new PixelBuffer(w, H), base = H - 1, rng = new Rng(seed);
  for (let x = 0; x < w; x += 6) {
    const h = 54 + Math.floor(rng.next() * 12), lean = rng.next() < 0.2 ? (rng.next() < 0.5 ? -1 : 1) : 0;
    for (let y = H - h; y <= base; y++) for (let k = 0; k < 5; k++) {
      if (y < H - h + Math.abs(k - 2) * 2) continue;
      const X = x + k + (y < H - h + 12 ? lean : 0);
      b.set(X, y, dpick(VP.grey, 3.6 - k * 0.45 + (Math.sin(y * 0.4 + x) > 0.85 ? -1 : 0), X, y));
    }
  }
  // two lashed rails of vine
  for (const yy of [28, 46]) for (let x = 0; x < w; x++) { b.set(x, yy, VP.thatch[1]); if (x % 6 === 2) b.set(x, yy + 1, VP.thatch[2]); }
  return S(b, 0, base);
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

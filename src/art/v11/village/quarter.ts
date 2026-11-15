// V12 Te Huarahi, the market lane: the households of the families who came to Te Kāinga from across
// the sea long ago and stayed, each told through the everyday things round their houses. Front-on,
// lit from the upper left, outlined in the village's ink like props.ts; every house carries a `glow`
// (its lamplit windows, its interior at night) that the scene draws when the lamps are lit.
//   fale           a Tongan family's open fale: a domed thatch roof on posts, woven blinds rolled up
//                  under the eaves (one let down), mats and pillows on the floor, a lamp in the roof
//   ngatu          tapa cloth drying over the line, hand-painted in brown and black: a grid of squares,
//                  triangles, diamonds, sawtooth bands and pinwheels of triangles
//   umu            the earth oven, a mound under banana leaves and a wet sack, its stones round it
//   husks          coconut husks and split shells by the umu; tapaAnvil: the log anvil and beaters
//   store          the Lee family's corrugated-iron fruit and vegetable store: the hand-painted sign,
//                  the family name on a red board, the verandah, the steelyard in the door, produce
//   lantern        a red paper lantern (hangs from the verandah, glows at night)
//   vegBed         the market garden: cabbages, bok choy, spring onions, lettuces in their rows
//   beanFrame      bamboo poles with beans climbing them; shoulderPole: the carrying pole, two baskets
//   gumHut         the old Dalmatian gum-digger's slab-and-sacking hut: the iron roof weighed down with
//                  stones, the chimney, kauri gum glowing amber in jars on the porch shelf, the gum spear
//                  and spade, a hand-painted DOBRO DOŠLI over the door
//   pergola, vineCanopy   his grapevine over a pergola, the bunches hanging (the canopy swings)
//   tradeStore     the trading store: a weatherboard false front, the signboard, enamel signs, the
//                  windows full of jars and bolts of cloth, the tin lean-to; tins, sacks, bicycle
//   stall          a market stall under a patched tarp awning (fish, fruit, woven goods), a price board
//   hanging        what hangs from a stall's beam: bananas, an eel, kete
//   midHouse       the houses behind the lane (painted roofs, a water tank, a fale, a packing shed)

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { leaf } from '../../jungle-core';
import { Rng, bayer, clamp, noise1, fbm2 } from '../../../core/math';
import { VP } from './props';
import { R, S, pick, dpick, h01, QP, letters, lettersWidth, produce, crate, ramp6 } from './clutter';
import type { ProduceKind } from './clutter';

const TH = R('#2e2414', '#4a3c22', '#6a5632', '#8a7244', '#a88e58', '#c6ac72');
const AMB = R('#5a2c10', '#8a4a1a', '#c27a2a', '#eaa846', '#ffd27a', '#fff0b8');
const NIGHT_IN = hex('#0c0806');
/** a lamplit version of a pixel for the glow layer (brighter near the lamp) */
const lampLit = (c: C, k: number) => {
  const l = ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.55 + ((c >>> 16) & 255) * 0.15) / 255;
  return AMB[clamp(Math.round(l * 1.8 + k * 2.2 - 0.5), 0, 3)];
};
const withGlow = (b: PixelBuffer, g: PixelBuffer, ax: number, ay: number): Sprite => { b.outline(VP.ink); return { buf: b, ax, ay, glow: g }; };

// ------------------------------------------------------------------ building pieces
/** corrugated iron: ribs, overlapping sheets, nail rows bleeding rust, rust patches */
function corrugated(b: PixelBuffer, x0: number, y0: number, w: number, h: number, seed: number, o: { rust?: number; horiz?: boolean; dark?: number } = {}) {
  const rng = new Rng(seed);
  const rib = [0.9, 0.35, -0.45, -0.9];
  const sheetW = rng.int(22, 28), rustK = o.rust ?? 0.35;
  const sheets: number[] = [];
  for (let x = x0; x < x0 + w; x += sheetW + rng.int(-3, 3)) sheets.push(x);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const p = o.horiz ? y : x;
    const si = sheets.filter(s => s <= x).length - 1, sx = sheets[Math.max(0, si)];
    const age = h01(si, 0, seed) - 0.5;
    let v = 3.1 + rib[((p % 4) + 4) % 4] + age * 0.8 - (x - x0) / w * 0.7 - (o.dark ?? 0);
    if (x === sx && si > 0) v = 4.8;
    if (x === sx + 1 && si > 0) v = 1.2;
    // rust: blotches where the galvanising has gone, a ragged band along the foot of each sheet
    const rn = fbm2(x * 0.09, y * 0.07, 3, seed + si);
    const foot = y0 + h - y < 3 + noise1(x * 0.4, seed + 2) * 6 * rustK;
    const rusty = rn > 0.72 - rustK * 0.3 + (0.5 - Math.abs(age)) * 0.04 || (foot && h01(x, y, seed) < 0.75);
    b.set(x, y, dpick(rusty ? VP.rust : VP.iron, v - (rusty ? 0.3 : 0), x, y));
  }
  // nail rows and the rust run from each nail
  for (const ny of [y0 + 2, y0 + Math.round(h / 2), y0 + h - 3]) for (let x = x0 + 2; x < x0 + w; x += 8) {
    b.set(x, ny, VP.iron[5]);
    if (h01(x, ny, seed) < 0.5) for (let k = 1; k < 2 + rng.int(0, 5); k++) if (ny + k < y0 + h) b.set(x, ny + k, VP.rust[2 + (k & 1)]);
  }
}
/** horizontal weatherboards: a lit bevel, a shadow line, the paint peeling to grey wood */
function weatherboard(b: PixelBuffer, x0: number, y0: number, w: number, h: number, rp: C[], seed: number, dark = 0) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const k = (y - y0) % 5;
    let v = 3.4 - (x - x0) / w * 0.8 - dark + (k === 0 ? 0.9 : k === 4 ? -1.4 : 0);
    const peel = fbm2(x * 0.16, Math.floor((y - y0) / 5) * 0.7, 2, seed) > 0.66;
    b.set(x, y, dpick(peel ? VP.grey : rp, v - (peel ? 0.4 : 0), x, y));
  }
}
/** a vertical post: shaded, a split or two */
function post(b: PixelBuffer, x: number, y0: number, y1: number, w: number, rp: C[], seed: number) {
  for (let y = y0; y <= y1; y++) for (let k = 0; k < w; k++) b.set(x + k, y, dpick(rp, 3.8 - (k / Math.max(1, w - 1)) * 2.2 + (h01(x + k, y, seed) < 0.04 ? -1.4 : 0), x + k, y));
}
/** a window: a frame, four panes with the sky in them (or a curtain), the lamp in the glow layer */
function windowPane(b: PixelBuffer, g: PixelBuffer, x: number, y: number, w: number, h: number, frame: C[], seed: number, o: { curtain?: C; blind?: boolean; broken?: boolean } = {}) {
  const rng = new Rng(seed);
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    const X = x + i, Y = y + j;
    const edge = i < 0 || j < 0 || i === w || j === h || i === Math.floor(w / 2) || j === Math.floor(h / 2);
    if (edge) { b.set(X, Y, frame[i < 0 || j < 0 ? 4 : 2]); continue; }
    // the glass: dark, a slant of sky reflection, a curtain drawn to one side
    let c = dpick(R('#0c1418', '#16242c', '#24384a', '#3a5468', '#5a7a90', '#8aa8b8'), 1.4 + ((i - j + 40) % 9 < 2 ? 2.2 : 0), X, Y);
    const cur = o.curtain !== undefined && (i < 3 + (j > h / 2 ? 1 : 0) || i > w - 3);
    if (cur) c = dpick(ramp6(o.curtain!, 0.5), 3 - (i % 2) * 0.8, X, Y);
    if (o.blind && j < Math.round(h * 0.45)) c = dpick(QP.bamboo, j % 2 ? 2.6 : 3.6, X, Y);
    b.set(X, Y, c);
    // the lamplit window: warm, a curtain or blind glowing through
    const d = Math.hypot((i - w * 0.55) / w, (j - h * 0.9) / h);
    g.set(X, Y, cur || (o.blind && j < Math.round(h * 0.45)) ? AMB[clamp(Math.round(2.6 - d * 2 - (i % 2) * 0.6), 1, 2)] : AMB[clamp(Math.round(3.8 - d * 2.8 + (bayer(X, Y) - 0.5)), 1, 3)]);
  }
  if (o.broken) { const bx = x + rng.int(1, Math.max(1, Math.floor(w / 2) - 2)), by = y + 1; b.set(bx, by, QP.hessian[3]); b.set(bx + 1, by, QP.hessian[2]); b.set(bx, by + 1, QP.hessian[2]); g.set(bx, by, 0); g.set(bx + 1, by, 0); }
  // the sill
  for (let i = -2; i <= w + 1; i++) b.set(x + i, y + h + 1, frame[i < w / 2 ? 4 : 3]);
}
/** irregular stones laid in a course (a platform kerb, a chimney) */
function stones(b: PixelBuffer, x0: number, x1: number, y0: number, y1: number, rp: C[], seed: number, size = 8) {
  const rng = new Rng(seed);
  for (let y = y0; y <= y1; y += Math.max(3, Math.round(size * 0.6))) {
    let x = x0 - rng.int(0, size);
    while (x < x1) {
      const w = rng.int(Math.round(size * 0.6), Math.round(size * 1.4)), hh = Math.min(y1 - y + 1, rng.int(Math.round(size * 0.5), Math.round(size * 0.75)));
      const s = rng.int(0, 999);
      for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
        const X = x + i, Y = y + j;
        if (X < x0 || X >= x1) continue;
        const nx = (i + 0.5) / w * 2 - 1, ny = (j + 0.5) / hh * 2 - 1;
        const r = Math.hypot(nx * 0.9, ny) + (noise1(Math.atan2(ny, nx) * 2 + s, s) - 0.5) * 0.35;
        if (r > 1.08) { if (!b.opaque(X, Y)) b.set(X, Y, rp[0]); continue; }
        b.set(X, Y, dpick(rp, 3.4 - nx * 0.9 - ny * 1.3 + (r > 0.85 ? -0.9 : 0) + (h01(X, Y, s) < 0.05 ? -1.5 : 0), X, Y));
      }
      x += w;
    }
  }
}
/** a hand-painted signboard: a framed board, the lettering centred on it */
function signboard(b: PixelBuffer, x: number, y: number, w: number, h: number, board: C[], lines: { text: string; font: 3 | 5; col: C[]; dy: number }[], seed: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    const frame = i < 2 || j < 2 || i >= w - 2 || j >= h - 2;
    const peel = fbm2(i * 0.18, j * 0.3, 2, seed) > 0.76;
    b.set(X, Y, frame ? dpick(VP.wood, i < 1 || j < 1 ? 4.4 : 2.4, X, Y) : peel ? dpick(VP.grey, 3.4, X, Y) : dpick(board, 3.2 - i / w * 0.8 + ((j - 2) % 5 === 4 ? -0.8 : 0), X, Y));
  }
  for (const l of lines) {
    const lw = lettersWidth(l.text, l.font);
    letters(b, x + Math.round((w - lw) / 2), y + l.dy, l.text, l.font, { col: l.col, shadow: shade(board[1], -0.3), wobble: l.font === 5 ? 0.08 : 0.12, wear: l.font === 5 ? 0.015 : 0.04, seed: seed + l.dy });
  }
}

// ------------------------------------------------------------------ the fale
/**
 * The Tongan family's fale: a long domed roof of coconut-leaf thatch laid in courses (each with a
 * ragged lower edge and its shadow), the ridge bound in bundles, the thick eave fringe; posts lashed
 * with sennit, the plaited blinds rolled up and tied under the eaves (one bay let down), and inside,
 * in the shade, the back blinds, a back bay open to the world behind, mats, pillows, a stack of folded
 * mats, a ukulele, a radio, a lamp hanging from the roof; all on a raised platform of stones.
 */
export function fale(seed: number): Sprite {
  const W = 180, H = 124, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H), rng = new Rng(seed * 7 + 1);
  const base = H - 1, cx = 90, half = 80;
  const fy = base - 8, ey = fy - 44, ry = 10;
  const inside = new Uint8Array(W * H);
  // the platform: a kerb of stones, the floor's edge, a step
  stones(b, cx - half + 2, cx + half - 2, fy + 1, base, VP.stone, seed, 9);
  for (let x = cx - 14; x < cx + 12; x++) for (let y = base - 2; y <= base; y++) b.set(x, y, dpick(VP.stone, 4 - (y - base + 2) * 0.8 - (x - cx + 14) / 26, x, y));
  // the interior: roof underside, the back blinds, an open bay, the floor mats
  const xL = cx - half + 8, xR = cx + half - 8;
  const bays: number[] = [];
  const nPost = 6;
  for (let i = 0; i < nPost; i++) bays.push(Math.round(xL + (i * (xR - xL)) / (nPost - 1)));
  const openBay = rng.int(1, nPost - 3);
  for (let y = ey + 2; y <= fy; y++) for (let x = xL; x <= xR; x++) {
    const bi = bays.findIndex((bx, i) => i < nPost - 1 && x >= bx && x < bays[i + 1]);
    const t = (y - ey) / (fy - ey);
    let c: C;
    if (y < ey + 9) {
      // the roof inside: rafters radiating, purlins, all in deep shade
      const u = (x - cx) / half, raf = Math.abs(((u * 9 + 20) % 1) - 0.5) < 0.12;
      c = raf ? hex('#2a1e12') : (y - ey) % 4 === 0 ? hex('#1e160e') : hex('#140e0a');
    } else if (y >= fy - 2) {
      // the floor: a pandanus mat with a dark band near its edge
      c = dpick(R('#3a2e18', '#5a4828', '#7a6638', '#9a844a', '#b8a060', '#d0ba7a'), (y === fy ? 2.2 : 3.2) - (x - xL) / (xR - xL) * 1.2 + ((x + y) % 2 ? 0.3 : 0), x, y);
      if (y === fy - 1 && (x % 6 < 2)) c = hex('#2a1a0e');
    } else if (bi === openBay && y < fy - 8) {
      // the back of this bay is open: you see out the other side
      if (y > fy - 12) c = hex('#24180e');
      else { inside[y * W + x] = 2; continue; }
    } else {
      // the back blinds let down, plaited, in shade
      const a = Math.floor((x + y) / 2), cc = Math.floor((x - y + 300) / 2), over = (a + cc) % 2 === 0;
      c = dpick(R('#140e08', '#22180e', '#322416', '#44321e', '#584228', '#6e5434'), (over ? 2.6 : 1.8) + t * 0.4 - (x - xL) / (xR - xL) * 0.6, x, y);
    }
    b.set(x, y, c);
    inside[y * W + x] = 1;
  }
  // back posts, thinner and darker
  for (let i = 0; i < nPost - 1; i++) { const bx = Math.round((bays[i] + bays[i + 1]) / 2) + rng.int(-3, 3); for (let y = ey + 6; y < fy - 2; y++) { b.set(bx, y, hex('#2a1c10')); b.set(bx + 1, y, hex('#1c120a')); } }
  // things on the floor: folded mats, pillows, a ukulele, a radio, a basin
  const bx0 = bays[0] + 6;
  for (let k = 0; k < 4; k++) for (let x = bx0; x < bx0 + 20 - k * 2; x++) for (let y = 0; y < 2; y++) { const Y = fy - 3 - k * 2 - y; b.set(x + k, Y, dpick(k === 2 ? R('#2a0c08', '#4a1a10', '#6a2a18', '#8a3a24', '#a85232', '#c46c48') : R('#3a2e18', '#5a4828', '#7a6638', '#9a844a', '#b8a060', '#d0ba7a'), 3.4 - y * 1.2 - (x - bx0) / 20, x + k, Y)); }
  const pil = [hex('#c8281e'), hex('#e8b81e'), hex('#1e5aa8'), hex('#e05a8a')];
  for (let p = 0; p < 3; p++) {
    const px = bays[2] + 4 + p * 9 + rng.int(-1, 1), col = ramp6(pil[(p + seed) % pil.length], 0.55);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { if ((y === 0 || y === 4) && (x === 0 || x === 7)) continue; b.set(px + x, fy - 3 - y, dpick(col, 3.2 - x * 0.2 + (y === 4 ? 0.8 : 0) - (y === 0 ? 0.8 : 0), px + x, fy - 3 - y)); }
    b.set(px + 2, fy - 6, col[5]); b.set(px + 4, fy - 5, col[5]);
  }
  // the ukulele against a back post
  const ux = bays[3] + 10;
  for (let y = 0; y < 16; y++) { const X = ux + Math.round(y * 0.15); if (y < 8) b.set(X, fy - 3 - 16 + y, VP.wood[1]); else for (let k = -2 - (y > 12 ? 1 : 0); k <= 2 + (y > 12 ? 1 : 0); k++) b.set(X + k, fy - 3 - 16 + y, dpick(R('#3a1a08', '#6a3414', '#9a5422', '#c47a36', '#dca050', '#f0c070'), 3.6 - k * 0.5, X + k, fy - 19 + y)); }
  b.set(ux + 2, fy - 7, hex('#140a06'));
  // a radio on an upturned crate
  const rx = bays[4] - 16;
  for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) b.set(rx + x, fy - 3 - y, dpick(VP.wood, 3 - x * 0.15, rx + x, fy - 3 - y));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) b.set(rx + 1 + x, fy - 9 - y, x < 4 ? ((x + y) % 2 ? hex('#3a3a3a') : hex('#5a5a5a')) : dpick(R('#2a0a06', '#5a160c', '#8a2a16', '#b84020', '#d85a30', '#f07a44'), 3.2 - y * 0.2, rx + 1 + x, fy - 9 - y));
  b.set(rx + 7, fy - 12, hex('#f0e8c8')); for (let k = 0; k < 6; k++) b.set(rx + 9 + Math.round(k * 0.4), fy - 14 - k, VP.iron[4]);
  // front posts lashed with sennit at the top
  for (const px of bays) {
    post(b, px - 2, ey + 1, fy, 4, VP.wood, seed + px);
    for (let y = ey + 2; y < ey + 8; y++) for (let k = -2; k < 2; k++) if ((y + k) % 2 === 0) b.set(px + k, y, hex((y + k) % 4 === 0 ? '#c88a3a' : '#8a5422'));
    for (let y = ey + 1; y <= fy; y++) for (let k = -2; k < 2; k++) inside[y * W + px + k] = 0;
  }
  // the blinds rolled up under the eaves, tied with cord; one let halfway down
  const downBay = (openBay + 2) % (nPost - 1);
  for (let i = 0; i < nPost - 1; i++) {
    const a = bays[i] + 3, z = bays[i + 1] - 3;
    if (i === downBay) {
      const hh = rng.int(16, 22);
      for (let y = ey + 2; y < ey + 2 + hh; y++) for (let x = a; x < z; x++) {
        const rag = y > ey + hh - 1 && h01(x, y, seed) < 0.5;
        if (rag) continue;
        const aa = Math.floor((x + y) / 2), cc = Math.floor((x - y + 300) / 2), over = (aa + cc) % 2 === 0;
        b.set(x, y, dpick(TH, (over ? 3.6 : 2.6) - (x - a) / (z - a) * 0.8 + ((y - ey) % 6 === 0 ? -0.9 : 0), x, y));
        inside[y * W + x] = 0;
      }
      continue;
    }
    for (let y = 0; y < 5; y++) for (let x = a; x < z; x++) {
      const Y = ey + 2 + y, sp = Math.floor((x + y * 2) / 3) % 2;
      b.set(x, Y, dpick(TH, 4 - Math.abs(y - 1.2) * 0.9 - (x - a) / (z - a) * 0.7 - sp * 0.5, x, Y));
      inside[Y * W + x] = 0;
    }
    for (const tx of [a + 3, z - 4]) for (let y = 0; y < 8; y++) { b.set(tx, ey + 1 + y, y > 5 ? hex('#4a2e12') : hex('#7a4a1e')); inside[(ey + 1 + y) * W + tx] = 0; }
  }
  // the lamp hanging from the roof
  const lx = bays[2] + Math.round((bays[3] - bays[2]) / 2);
  for (let y = ey + 2; y < ey + 12; y++) b.set(lx, y, hex('#2a2a2a'));
  for (let y = 0; y < 6; y++) for (let x = -2; x <= 2; x++) if (Math.abs(x) < (y < 1 || y > 4 ? 2 : 3)) { b.set(lx + x, ey + 12 + y, dpick(QP.glass, 3 - x * 0.6, lx + x, ey + 12 + y)); g.set(lx + x, ey + 12 + y, AMB[y > 1 && y < 5 && Math.abs(x) < 2 ? 5 : 4]); }
  // the roof: courses of thatch with ragged edges, the ridge bound in bundles, the eave fringe
  const hw = half + 8;
  for (let x = cx - hw; x <= cx + hw; x++) {
    const u = (x - cx) / hw, au = Math.abs(u);
    const topY = (au < 0.24 ? ry + Math.round(au * 4) : ry + 1 + (ey - ry) * (1 - Math.sqrt(Math.max(0, 1 - ((au - 0.24) / 0.76) ** 2)))) + Math.round((noise1(x * 0.35, seed + 4) - 0.5) * 2.4);
    const botY = ey + 3 + Math.round(au ** 4 * 6);
    for (let y = Math.round(topY); y <= botY; y++) {
      const k = (y - ry) % 5, course = Math.floor((y - ry) / 5);
      const streak = (noise1(x * 0.7 + course * 3.1, seed) - 0.5) * 1.1;
      let v = 3.9 - u * 1 - (y - topY) / Math.max(1, botY - topY) * 0.7 + streak - (au > 0.8 ? (u > 0 ? 0.8 : -0.2) : 0);
      if (k === 4) v -= h01(x, course, seed) < 0.3 ? 0.2 : 1.5;
      else if (k === 3) v -= 0.45;
      else if (k === 0) v += 0.35;
      if (y === Math.round(topY)) v += 0.6;
      b.set(x, y, dpick(TH, v, x, y));
      g.set(x, y, 0);
    }
    // the eave fringe, the shadow under it
    const fl = rng.int(0, 3);
    for (let y = botY + 1; y <= botY + fl; y++) b.set(x, y, TH[1 + (y - botY === 1 ? 1 : 0)]);
    if (x > xL && x < xR) b.set(x, botY + fl + 1, hex('#0e0a06'));
  }
  // the ridge, bound into bundles
  for (let x = cx - Math.round(hw * 0.3); x <= cx + Math.round(hw * 0.3); x++) for (let y = ry - 3; y <= ry + 1; y++) {
    const tie = (x - cx + 200) % 8 < 2;
    b.set(x, y, tie ? hex(y === ry - 3 ? '#c88a3a' : '#7a4a1e') : dpick(TH, 2.8 - (y - ry + 3) * 0.35 - (x - cx) / hw * 0.8, x, y));
  }
  // the glow: the interior lit by the lamp; the open back bay stays dark
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = inside[y * W + x];
    if (m === 1) { const d = Math.hypot((x - lx) / 70, (y - (ey + 15)) / 36); g.set(x, y, lampLit(b.get(x, y), clamp(1 - d))); }
  }
  void NIGHT_IN;
  return withGlow(b, g, cx, base);
}

// ------------------------------------------------------------------ ngatu
const KOKA = R('#1e0c06', '#3a1a0c', '#5a2a12', '#7a3e1c', '#9a5428', '#b46c38');
const TAPA = R('#5e4426', '#8a6a40', '#b08e5c', '#ccae7a', '#e0c898', '#f0dcb4');
/**
 * A length of ngatu (tapa) drying over the line: beaten bark cloth (fibres running across it, thin
 * spots, ragged edges), folded over the line at the top, hand-painted in koka brown and black: a
 * grid of squares, each with its motif (big triangles, diamonds, pinwheels of triangles, parallel
 * lines), a sawtooth border along the bottom. Anchored on the line, so it swings.
 */
export function ngatu(seed: number): Sprite {
  const rng = new Rng(seed * 113 + 9);
  const w = rng.int(34, 44), h = rng.int(30, 40);
  const W = w + 4, H = h + 6, b = new PixelBuffer(W, H), x0 = 2, top = 2;
  const cell = rng.int(9, 12);
  const ink = (x: number, y: number, dark: boolean) => { if (b.opaque(x, y)) b.set(x, y, dark ? hex('#140a06') : dpick(KOKA, 2.6 + (h01(x, y, seed) - 0.5) * 1.2, x, y)); };
  // the cloth
  for (let i = 0; i < w; i++) {
    const yb = top + h - 1 - Math.round(Math.sin(i * 0.4 + seed) * 0.8 + (h01(i, 0, seed) < 0.2 ? 1 : 0));
    for (let y = top; y <= yb; y++) {
      const X = x0 + i;
      const fibre = noise1(y * 0.9 + i * 0.05, seed) - 0.5;
      let v = 3.6 + fibre * 1.2 - i / w * 0.9 + Math.sin(i * 0.8 + seed) * 0.35 * (y - top) / h;
      if (y < top + 3) v -= 0.9;
      if (h01(X, y, seed + 2) < 0.02) v += 1.4;
      b.set(X, y, dpick(TAPA, v, X, y));
    }
  }
  // a rubbed brown wash over the patterned field
  for (let y = top + 3; y < top + h; y++) for (let x = x0; x < x0 + w; x++) if (b.opaque(x, y) && noise1(x * 0.15 + y * 0.1, seed + 5) > 0.62) b.set(x, y, dpick(TAPA, 1.8 + (h01(x, y, seed) - 0.5), x, y));
  // the grid, painted freehand (a wobble now and then)
  const gy0 = top + 4, gyMax = top + h - 7;
  for (let y = gy0; y <= gyMax; y += cell) { let wob = 0; for (let x = x0; x < x0 + w; x++) { if (h01(x, y, seed) < 0.06) wob = wob ? 0 : (rng.chance(0.5) ? 1 : -1); ink(x, y + wob, true); } }
  for (let x = x0; x < x0 + w; x += cell) for (let y = gy0; y <= gyMax; y++) ink(x, y, true);
  // a motif in each square
  for (let cy = gy0; cy + cell <= gyMax + 1; cy += cell) for (let cx2 = x0; cx2 + cell <= x0 + w; cx2 += cell) {
    const m = rng.int(0, 4), s = cell - 1, X0 = cx2 + 1, Y0 = cy + 1;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const X = X0 + i, Y = Y0 + j;
      if (m === 0 && i + j < s - 1) ink(X, Y, false);
      else if (m === 0 && i + j === s - 1) ink(X, Y, true);
      else if (m === 1) { const d = Math.abs(i - s / 2 + 0.5) + Math.abs(j - s / 2 + 0.5); if (Math.round(d) === Math.floor(s / 2) - 1) ink(X, Y, true); else if (d < s / 2 - 2 && (i + j) % 2 === 0) ink(X, Y, false); }
      else if (m === 2) { const qx = i < s / 2, qy = j < s / 2; const inTri = qx === qy ? (qx ? i < j + 1 : i > j - 1) : (qx ? i + j < s - 1 : i + j > s - 1); if (inTri && (Math.abs(i - s / 2) > 0.6 || Math.abs(j - s / 2) > 0.6)) ink(X, Y, (i + j) % 3 === 0); }
      else if (m === 3) { if (j % 3 === 1) ink(X, Y, false); }
      else { if ((i === Math.floor(s / 2) || j === Math.floor(s / 2))) ink(X, Y, true); else if ((i % 4 === 1) && (j % 4 === 1)) ink(X, Y, false); }
    }
  }
  // a sawtooth border along the bottom, a band
  const by = gyMax + 2;
  for (let x = x0; x < x0 + w; x++) { const t = (x - x0) % 5; for (let y = 0; y <= 4 - t; y++) ink(x, by + y, y === 0); ink(x, by - 1, true); }
  return S(b, x0 + Math.floor(w / 2), top);
}

// ------------------------------------------------------------------ the umu
/** the umu: a mound of earth and hot stones under banana leaves and a wet sack, stones round its foot */
export function umu(seed: number): Sprite {
  const rng = new Rng(seed * 17 + 3);
  const W = 64, H = 24, b = new PixelBuffer(W, H), base = H - 1, cx = 32, rx = 26, mh = 12;
  const top = (x: number) => base - Math.round(mh * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) + (noise1(x * 0.3, seed) - 0.5) * 1.5);
  for (let x = cx - rx; x <= cx + rx; x++) for (let y = top(x); y <= base; y++) b.set(x, y, dpick(QP.mud, 3.4 - (x - cx) / rx * 1.1 - (y - top(x)) * 0.12, x, y));
  // the banana leaves laid over it: a midrib, parallel veins, torn edges, some gone brown
  const n = rng.int(4, 5);
  for (let i = 0; i < n; i++) {
    const x0 = cx - rx + 2 + i * ((2 * rx - 10) / n) + rng.int(-3, 3), len = rng.int(16, 24), wd = rng.range(3.5, 5);
    const rp = rng.chance(0.3) ? QP.dry : QP.banana;
    for (let t = 0; t <= len; t++) {
      const x = Math.round(x0 + t), my = top(clamp(x, cx - rx, cx + rx)) + 1;
      const ww = wd * Math.pow(Math.sin(Math.PI * t / len), 0.6);
      for (let k = -Math.round(ww); k <= Math.round(ww); k++) {
        const Y = my + k * 0.6 + (k > 0 ? 1 : 0);
        if (Math.abs(k) > 1 && noise1(t * 0.9 + (k > 0 ? 9 : 0), seed + i) > 0.7) continue;
        const vein = (t + Math.abs(k) * 2) % 3 === 0;
        b.set(x, Math.round(Y), dpick(rp, 3.4 - k * 0.35 - (vein ? 0.8 : 0) - (x - cx) / rx * 0.4, x, Math.round(Y)));
      }
      b.set(x, my, rp[5]);
    }
  }
  // a wet sack over one side
  const sx = cx + rng.int(-6, 6);
  for (let x = sx; x < sx + 14; x++) for (let y = top(x) + 1; y < top(x) + 6; y++) b.set(x, y, dpick(QP.hessian, 2.2 - (x - sx) * 0.08 + ((x + y) % 2 ? 0.3 : -0.3), x, y));
  // the stones round its foot
  for (let i = 0; i < 9; i++) { const x = cx - rx - 2 + i * 6.5 + rng.int(-1, 1), r = rng.range(1.8, 2.6); b.ellipseFn(x, base - r + 0.5, r + 0.6, r, (X, Y, nx, ny) => dpick(rng.chance(0.4) ? VP.stone : R('#0c0a0a', '#1e1a1a', '#2e2828', '#423a38', '#5a504c', '#766a64'), 3.6 - nx - ny * 1.2, X, Y)); }
  return S(b, cx, base);
}
/** coconut husks and split shells, a green nut or two */
export function husks(seed: number): Sprite {
  const rng = new Rng(seed * 19 + 5);
  const W = 40, H = 16, b = new PixelBuffer(W, H), base = H - 1;
  for (let i = 0; i < 7; i++) {
    const x = 4 + i * 5 + rng.int(-1, 1), y = base - (i % 2) * 2, len = rng.int(6, 9), ang = rng.range(-0.6, 0.6);
    // a husk: a fibrous wedge, the fibres running along it
    for (let t = 0; t < len; t++) for (let k = -2; k <= 2; k++) {
      if (Math.abs(k) > 2 - (t < 2 || t > len - 2 ? 1 : 0)) continue;
      const X = Math.round(x + Math.cos(ang) * t - Math.sin(ang) * k * 0.6), Y = Math.round(y - 2 + Math.sin(ang) * t + k * 0.7);
      b.set(X, Y, dpick(QP.husk, 3.2 - k * 0.5 + ((t + k) % 3 === 0 ? 0.9 : 0), X, Y));
    }
  }
  // split shells: brown outside, white meat inside
  for (let s = 0; s < 2; s++) {
    const x = 10 + s * 18 + rng.int(-2, 2);
    b.ellipseFn(x, base - 2, 4, 3, (X, Y, nx, ny) => (ny < -0.15 ? (Math.hypot(nx, ny) > 0.8 ? QP.husk[2] : hex(ny < -0.6 ? '#fff8ec' : '#ece4d4')) : dpick(QP.husk, 2.6 - nx - ny, X, Y)));
  }
  produce(b, 'coconut', 30, base, rng);
  return S(b, W / 2, base);
}
/** the log anvil for beating tapa, two beaters on it, strips of bark soaking in a basin */
export function tapaAnvil(seed: number): Sprite {
  const W = 48, H = 16, b = new PixelBuffer(W, H), base = H - 1, rng = new Rng(seed);
  for (let x = 2; x < 36; x++) for (let y = base - 8; y <= base; y++) { const ny = (y - (base - 4)) / 4.5; b.set(x, y, dpick(VP.wood, 3.6 - ny * 1.6 + (y === base - 8 ? 0.8 : 0) - (x % 13 === 0 ? 1 : 0), x, y)); }
  for (let y = base - 8; y <= base; y++) b.set(2, y, y % 2 ? hex('#c09868') : hex('#a07848'));
  // the beaters: square-section clubs, grooved
  for (let i = 0; i < 2; i++) { const y = base - 9 - i * 2, x0 = 6 + i * 12; for (let x = x0; x < x0 + 16; x++) { const head = x > x0 + 6; b.set(x, y, head ? (x % 2 ? VP.wood[2] : VP.wood[4]) : VP.wood[3]); b.set(x, y - 1, head ? VP.wood[4] : VP.wood[3]); } }
  // a strip of bark soaking in a basin
  for (let x = 38; x < 47; x++) for (let y = base - 4; y <= base; y++) b.set(x, y, dpick(QP.galv, 3.4 - (x - 38) * 0.2, x, y));
  for (let x = 39; x < 46; x++) b.set(x, base - 5, x % 3 ? QP.sky[3] : TAPA[4]);
  for (let y = 0; y < 5; y++) b.set(44, base - 6 - y, TAPA[3 + (y & 1)]);
  void rng;
  return S(b, W / 2, base);
}

// ------------------------------------------------------------------ the Lee family's store
const LANT = QP.lantern;
/**
 * The Lees' fruit and vegetable store: corrugated iron gone to rust at the foot, a flat false front
 * with the signboard hand-lettered LEE BROS. / FRUIT & VEGETABLES, the verandah on turned posts, under
 * it the shop front in the shade: the open door with the steelyard hanging in it and shelves of tins
 * and jars beyond, the window with a bamboo blind, the family name 李 painted gold on a red board,
 * a tiered stand of produce, sacks, a broom; a downpipe to a barrel at the corner.
 */
export function store(seed: number): Sprite {
  const W = 190, H = 138, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H), rng = new Rng(seed * 3 + 2);
  const base = H - 1, x0 = 16, x1 = 172, wallTop = base - 84, verY = base - 62;
  // the gable roof behind the false front, the false front itself
  for (let y = 0; y < 18; y++) { const hw = (y / 18) * 70; for (let x = -hw; x <= hw; x++) { const X = Math.round(94 + x), Y = wallTop - 22 + y; b.set(X, Y, dpick(VP.iron, 2.4 - x / 70 + ((X % 5) === 0 ? -0.8 : 0), X, Y)); } }
  corrugated(b, x0, wallTop - 8, x1 - x0, 92, seed, { rust: 0.3 });
  // the parapet's capping, stepped at the corners
  for (let x = x0 - 2; x < x1 + 2; x++) { const step = x < x0 + 10 || x > x1 - 11 ? 4 : 0; for (let y = 0; y < 3; y++) b.set(x, wallTop - 9 + step - y, dpick(VP.wood, 4 - y * 0.8, x, wallTop - 9 + step - y)); }
  for (let x = x0; x < x0 + 10; x++) for (let y = wallTop - 8; y < wallTop - 5; y++) b.set(x, y, 0);
  for (let x = x1 - 10; x < x1; x++) for (let y = wallTop - 8; y < wallTop - 5; y++) b.set(x, y, 0);
  // the signboard
  signboard(b, x0 + 14, wallTop - 4, x1 - x0 - 28, 24, R('#5a4c34', '#8a7a58', '#b8a67a', '#d6c696', '#ece0b4', '#f8f0d0'), [
    { text: 'LEE BROS.', font: 5, col: [hex('#8a1a10'), hex('#a8241a'), hex('#962014')], dy: 4 },
    { text: 'FRUIT & VEGETABLES', font: 3, col: [hex('#1e3a2a'), hex('#24442e')], dy: 15 },
  ], seed);
  // the shop front in the verandah's shade
  for (let y = verY; y <= base; y++) for (let x = x0; x < x1; x++) b.set(x, y, mix(b.get(x, y), hex('#120c0a'), 0.48));
  // the door: shelves of tins and jars inside, the steelyard hanging in the opening
  const dx = x0 + 22, dw = 28, dh = 50;
  for (let y = base - dh; y <= base; y++) for (let x = dx; x < dx + dw; x++) {
    const sh = (base - y) % 12;
    let c = hex('#0e0806');
    if (sh === 0) c = hex('#3a2416');
    else if (sh < 6 && sh > 0 && y < base - 8) { const it = Math.floor((x - dx) / 4); const col = [hex('#7a2a1a'), hex('#c8a040'), hex('#3a5a7a'), hex('#d8d0b8'), hex('#5a7a3a')][(it + Math.floor((base - y) / 12)) % 5]; c = (x - dx) % 4 === 3 ? hex('#0e0806') : shade(col, -0.45 + (sh > 3 ? 0.15 : 0)); }
    b.set(x, y, c);
    g.set(x, y, lampLit(c, 0.15 + (1 - (base - y) / dh) * 0.45));
  }
  for (let y = base - dh - 1; y <= base; y++) { b.set(dx - 1, y, VP.wood[3]); b.set(dx + dw, y, VP.wood[2]); }
  for (let x = dx - 1; x <= dx + dw; x++) b.set(x, base - dh - 1, VP.wood[4]);
  // the steelyard: a beam, a hook, the pan, the weight
  const sx = dx + 14;
  for (let y = base - dh; y < base - dh + 10; y++) b.set(sx, y, VP.iron[3]);
  for (let x = sx - 8; x < sx + 10; x++) b.set(x, base - dh + 10, VP.wood[4]);
  b.set(sx + 7, base - dh + 11, VP.iron[2]); b.set(sx + 7, base - dh + 12, VP.iron[3]); b.set(sx + 6, base - dh + 13, VP.iron[2]); b.set(sx + 7, base - dh + 13, VP.iron[3]);
  for (let k = 0; k < 6; k++) { b.set(sx - 7 + Math.round(k * 0.3), base - dh + 11 + k, VP.cream[2]); b.set(sx - 3 - Math.round(k * 0.3), base - dh + 11 + k, VP.cream[2]); }
  for (let x = sx - 9; x < sx; x++) b.set(x, base - dh + 17, x === sx - 9 || x === sx - 1 ? QP.galv[1] : QP.galv[3]);
  // the window with a bamboo blind
  windowPane(b, g, x0 + 66, base - 46, 30, 22, VP.wood, seed + 4, { blind: true });
  // the red board with the family name in gold: 李
  const rbx = x0 + 104, rby = base - 56;
  for (let y = 0; y < 30; y++) for (let x = 0; x < 15; x++) { const fr = x === 0 || x === 14 || y === 0 || y === 29; b.set(rbx + x, rby + y, fr ? hex('#2a0806') : dpick(LANT, 2.8 - x * 0.08 + (y % 7 === 0 ? -0.4 : 0), rbx + x, rby + y)); }
  const LI = ['.....#.....', '###########', '....###....', '...#.#.#...', '.##..#..##.', '#....#....#', '...........', '..#######..', '.......##..', '......#....', '###########', '.....#.....', '.....#.....', '...##......'];
  const GOLD = [hex('#e8b830'), hex('#f4d060'), hex('#c89a20')];
  LI.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') { b.set(rbx + 2 + x, rby + 6 + y, GOLD[(x + y) % 3]); b.set(rbx + 3 + x, rby + 7 + y, b.get(rbx + 3 + x, rby + 7 + y) === GOLD[0] ? GOLD[0] : hex('#4a0c06')); } });
  LI.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') b.set(rbx + 2 + x, rby + 6 + y, GOLD[(x * 3 + y) % 3]); });
  // a tiered stand of produce in front of the window
  const stx = x0 + 60, kinds: ProduceKind[] = ['cabbage', 'orange', 'onion', 'carrot', 'bokchoy', 'lemon', 'kumara', 'apple'];
  for (let tier = 0; tier < 3; tier++) {
    const ty = base - 6 - tier * 7, tx0 = stx + tier * 3, tx1 = stx + 46 - tier * 3;
    for (let x = tx0; x < tx1; x++) { b.set(x, ty, VP.wood[4]); b.set(x, ty + 1, VP.wood[2]); }
    for (let k = 0; k < 3; k++) { const kind = kinds[(tier * 3 + k + seed) % kinds.length]; for (let i = 0; i < 4; i++) produce(b, kind, tx0 + 4 + k * 13 + i * 3, ty, rng); }
  }
  for (const lx of [stx + 1, stx + 45]) for (let y = base - 20; y <= base; y++) b.set(lx, y, VP.wood[2]);
  // sacks of potatoes and onions by the door, a broom
  for (let s = 0; s < 2; s++) {
    const sx2 = x0 + 4 + s * 9;
    for (let y = 0; y < 13; y++) { const hw = y < 2 ? 2 : 4 - (y > 10 ? 1 : 0); for (let x = -hw; x <= hw; x++) b.set(sx2 + x, base - y, dpick(QP.hessian, 3.2 - x * 0.35 - (y > 11 ? 0.6 : 0), sx2 + x, base - y)); }
    produce(b, s ? 'onion' : 'potato', sx2, base - 11, rng); produce(b, s ? 'onion' : 'potato', sx2 + 2, base - 12, rng);
  }
  for (let y = 0; y < 36; y++) b.set(dx + dw + 4 + Math.round(y * 0.1), base - 36 + y, VP.wood[4]);
  for (let k = -2; k <= 2; k++) for (let y = 0; y < 6; y++) b.set(dx + dw + 7 + k + Math.round(y * 0.3 * Math.sign(k)), base - 6 + y, VP.thatch[3 + (k & 1)]);
  // the verandah: the iron roof's slope seen from below the eave, the fascia, turned posts
  for (let y = verY - 8; y < verY; y++) for (let x = x0 - 8; x < x1 + 8; x++) b.set(x, y, dpick(VP.iron, 3 - (y - verY + 8) * 0.1 + ((x % 4) < 2 ? 0.7 : -0.6) - (x - x0) / (x1 - x0) * 0.6, x, y));
  for (let x = x0 - 8; x < x1 + 8; x++) { b.set(x, verY, VP.wood[4]); b.set(x, verY + 1, hex('#a83a22')); b.set(x, verY + 2, hex('#8a2a18')); b.set(x, verY + 3, VP.wood[1]); }
  for (const px of [x0 - 6, Math.round((x0 + x1) / 2) + 6, x1 + 3]) {
    post(b, px, verY + 4, base, 3, VP.cream, seed + px);
    for (const yy of [verY + 8, base - 6]) { b.set(px - 1, yy, VP.cream[3]); b.set(px + 3, yy, VP.cream[2]); }
  }
  // the downpipe to a barrel at the corner
  for (let y = verY - 8; y < base - 18; y++) { b.set(x1 + 6, y, QP.galv[3]); b.set(x1 + 7, y, QP.galv[1]); }
  for (let y = base - 18; y <= base; y++) for (let x = x1 + 2; x < x1 + 14; x++) b.set(x, y, dpick(VP.wood, 3.4 - (x - x1 - 2) * 0.22 + ((y - base) % 7 === 0 ? -1 : 0), x, y));
  for (let x = x1 + 2; x < x1 + 14; x++) b.set(x, base - 18, QP.sky[3]);
  void rng;
  return withGlow(b, g, 94, base);
}
/** a red paper lantern on a cord, gold caps, a tassel (anchored at the top, so it swings) */
export function lantern(seed: number): Sprite {
  const W = 14, H = 24, b = new PixelBuffer(W, H), cx = 7;
  for (let y = 0; y < 4; y++) b.set(cx, y, hex('#2a1a10'));
  for (let x = -3; x <= 3; x++) { b.set(cx + x, 4, hex('#c89a20')); b.set(cx + x, 5, hex('#8a6410')); }
  for (let y = 0; y < 11; y++) {
    const t = (y + 0.5) / 11, hw = 2.5 + Math.sin(t * Math.PI) * 3.3;
    for (let x = -Math.round(hw); x <= Math.round(hw); x++) {
      const nx = x / hw, rib = y % 3 === 2;
      b.set(cx + x, 6 + y, dpick(LANT, 3.6 - nx * 1.4 - Math.abs(t - 0.4) * 1.2 - (rib ? 0.9 : 0), cx + x, 6 + y));
    }
  }
  b.set(cx - 2, 9, LANT[5]); b.set(cx - 3, 10, LANT[5]);
  for (let x = -2; x <= 2; x++) { b.set(cx + x, 17, hex('#c89a20')); b.set(cx + x, 18, hex('#8a6410')); }
  for (let y = 19; y < 23; y++) for (const x of [-1, 0, 1]) if ((x + y + seed) % 2 === 0 || x === 0) b.set(cx + x, y, x === 0 ? hex('#e8b830') : hex('#c8281e'));
  const s = S(b, cx, 0);
  const gl = new PixelBuffer(W, H);
  for (let y = 6; y < 17; y++) for (let x = 0; x < W; x++) { const c = b.get(x, y); if (c >>> 24 && c !== VP.ink) gl.set(x, y, pick(R('#a81808', '#e83a14', '#ff6a2a', '#ff9a4a', '#ffc070', '#ffe0a0'), 3.8 - Math.abs(x - cx) * 0.55 - Math.abs(y - 11) * 0.3)); }
  s.glow = gl;
  return s;
}

// ------------------------------------------------------------------ the market garden
export type VegKind = 'cabbage' | 'bokchoy' | 'onion' | 'lettuce';
/** a few plants of one kind in a row on a ridge of tilled earth, each one shaped by hand */
export function vegBed(kind: VegKind, seed: number): Sprite {
  const rng = new Rng(seed * 71 + 3);
  const W = 34, H = 22, b = new PixelBuffer(W, H), base = H - 1;
  // the ridge of earth, clods on it
  for (let x = 0; x < W; x++) { const hh = 3 + Math.round(Math.sin(x / W * Math.PI) * 1.5); for (let y = 0; y < hh; y++) b.set(x, base - y, dpick(VP.soil, 3.2 - y * 0.2 + (y === hh - 1 ? 1 : 0) - x / W * 0.6, x, base - y)); }
  const n = kind === 'cabbage' ? 3 : kind === 'lettuce' ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const px = Math.round(5 + i * (W - 10) / Math.max(1, n - 1)) + rng.int(-1, 1), py = base - 3;
    if (kind === 'cabbage') {
      // outer leaves spread low, blue-green, pale veins; the head pale and tight in the middle
      const CB = R('#102418', '#1c3c2c', '#2c5a42', '#427a58', '#62987a', '#94bca6');
      for (let l = 0; l < 6; l++) {
        const a = Math.PI + (l / 5) * Math.PI + rng.range(-0.15, 0.15);
        leaf(b, px, py, a, rng.range(5, 7), rng.range(2.4, 3.2), CB, l === 0 || l === 5 ? 2 : 3, 'round');
      }
      b.ellipseFn(px, py - 3, 3.6, 3.2, (X, Y, nx, ny) => dpick(R('#2c4a2a', '#466a3a', '#62884a', '#82a65e', '#a6c47c', '#cce0a2'), 3.8 - nx * 1.2 - ny * 1.4 + ((X - px + Y) % 3 === 0 ? -0.6 : 0), X, Y));
      b.set(px - 1, py - 5, hex('#e0eec0'));
    } else if (kind === 'bokchoy') {
      const BK = R('#0c2010', '#163418', '#204e22', '#2e6a2c', '#468a3a', '#6ca852');
      for (let s = -2; s <= 2; s++) {
        const lean = s * 0.32, len = 9 + (2 - Math.abs(s)) * 2 + rng.int(0, 1);
        for (let t = 0; t < len; t++) {
          const X = Math.round(px + lean * t), Y = py - t;
          if (t < 4) { b.set(X, Y, hex(t === 0 ? '#c8d6b8' : '#e6eedc')); continue; }
          const ww = t < len - 1 ? 1 : 0;
          for (let k = -ww; k <= ww; k++) b.set(X + k, Y, dpick(BK, 3 - s * 0.35 + (k < 0 ? 0.6 : -0.4) + (t === len - 1 ? 1 : 0), X + k, Y));
          if (t > 4 && t < len - 1) b.set(X, Y, BK[5]);
        }
      }
    } else if (kind === 'onion') {
      const ON = R('#14281a', '#1e3e26', '#2c5a34', '#3e7a44', '#5a9a58', '#88bc76');
      for (let s = 0; s < 7; s++) {
        const lean = (s - 3) * 0.18 + rng.range(-0.08, 0.08), len = rng.int(9, 14);
        for (let t = 0; t < len; t++) { const X = Math.round(px + lean * t + Math.sin(t * 0.3) * 0.4 * (s - 3)), Y = py - t; b.set(X, Y, t < 2 ? hex('#e8e4d0') : dpick(ON, 3.4 - (s - 3) * 0.3 + (t > len - 3 ? 0.8 : 0), X, Y)); }
      }
    } else {
      const LT = R('#1e3a14', '#2e5a1e', '#46802a', '#64a23a', '#8ac454', '#b8e07a');
      for (let l = 0; l < 9; l++) { const a = -Math.PI / 2 + (l - 4) * 0.36 + rng.range(-0.1, 0.1); leaf(b, px, py, a, rng.range(4, 6), rng.range(2.6, 3.4), LT, l % 2 ? 3 : 4, 'round'); }
      for (let k = 0; k < 6; k++) b.set(px - 3 + k, py - 5 - (k % 2), LT[5]);
    }
  }
  return S(b, W / 2, base);
}
/** bamboo poles lashed into an A-frame, beans climbing them: heart leaves, flowers, hanging pods */
export function beanFrame(seed: number): Sprite {
  const rng = new Rng(seed * 73 + 1);
  const W = 44, H = 66, b = new PixelBuffer(W, H), base = H - 1;
  const poles: [number, number, number, number][] = [[6, base, 24, 2], [38, base, 20, 2], [16, base, 28, 6], [30, base, 14, 6]];
  for (const [xa, ya, xb, yb] of poles) {
    const n = Math.round(Math.hypot(xb - xa, yb - ya));
    for (let i = 0; i <= n; i++) { const t = i / n, X = Math.round(xa + (xb - xa) * t), Y = Math.round(ya + (yb - ya) * t); const node = i % 11 === 0; b.set(X, Y, node ? QP.bamboo[1] : QP.bamboo[4]); b.set(X + 1, Y, node ? QP.bamboo[2] : QP.bamboo[2]); }
  }
  for (let k = 0; k < 4; k++) { b.set(21 + k, 6 + (k & 1), hex('#7a5a2a')); b.set(21 + k, 8, hex('#5a3e1a')); }
  // the vines winding up, leaves in threes, white flowers, green pods hanging
  const BN = R('#0e2410', '#183c18', '#245a20', '#347a2c', '#4c9a3c', '#74ba56');
  for (const [xa, ya, xb, yb] of poles.slice(0, 2)) {
    for (let t = 0.05; t < 0.92; t += 0.045) {
      const X = xa + (xb - xa) * t + Math.sin(t * 30 + seed) * 2, Y = ya + (yb - ya) * t;
      b.set(Math.round(X), Math.round(Y), BN[2]);
      if (rng.chance(0.55)) { const a = rng.range(0, Math.PI * 2); leaf(b, X, Y, a, rng.range(3.5, 5), rng.range(2.2, 3), BN, a > Math.PI ? 3 : 2, 'heart'); }
      if (rng.chance(0.12)) { b.set(Math.round(X) + 1, Math.round(Y) - 1, hex('#f4f0e4')); b.set(Math.round(X) + 2, Math.round(Y) - 1, hex('#dcd4c4')); }
      if (rng.chance(0.18)) for (let k = 0; k < rng.int(4, 7); k++) b.set(Math.round(X) + (k > 4 ? 1 : 0), Math.round(Y) + 1 + k, k % 3 ? BN[4] : BN[3]);
    }
  }
  return S(b, W / 2, base);
}
/** the carrying pole across two round baskets of greens and turnips set down on the ground */
export function shoulderPole(seed: number): Sprite {
  const rng = new Rng(seed * 79 + 5);
  const W = 64, H = 30, b = new PixelBuffer(W, H), base = H - 1;
  const fills: ProduceKind[][] = [['bokchoy', 'greens'], ['potato', 'onion'], ['orange', 'lemon']];
  for (const bx of [12, 50]) {
    const fill = fills[(bx + seed) % 3];
    for (let i = 0; i < 5; i++) produce(b, fill[i % 2], bx - 6 + i * 3, base - 9 - (i % 2), rng);
    // a shallow round basket of split bamboo: the weave, a lashed rim
    for (let y = 0; y < 10; y++) { const hw = 8 + Math.round(Math.min(y, 6) * 0.3) - (y < 2 ? 1 : 0); for (let x = -hw; x <= hw; x++) { const X = bx + x, Y = base - y; const wv = ((X + Y) % 4 < 2) !== (Y % 4 < 2); b.set(X, Y, dpick(QP.bamboo, 3.2 - x / hw * 1.2 + (wv ? 0.6 : -0.4), X, Y)); } }
    for (let x = -10; x <= 10; x++) b.set(bx + x, base - 10, x % 3 === 0 ? QP.bamboo[1] : QP.bamboo[5]);
    // the ropes up to the pole
    for (const s of [-1, 1]) b.line(bx + s * 9, base - 10, bx, base - 22, QP.rope[3]);
  }
  for (let x = 2; x < W - 2; x++) { const y = base - 23 + Math.round(Math.sin((x - 2) / (W - 4) * Math.PI) * 1.4); b.set(x, y, x % 14 === 0 ? QP.bamboo[1] : QP.bamboo[5]); b.set(x, y + 1, QP.bamboo[2]); }
  return S(b, W / 2, base);
}

// ------------------------------------------------------------------ the gum-digger
/**
 * The old Dalmatian gum-digger's hut: walls of split slabs gone silver, sacking nailed over the
 * gaps, a skillion roof of rusted iron weighed down with stones, a stone chimney at the end with an
 * iron flue; the door with a hand-painted DOBRO DOŠLI ("welcome") over it; under the porch a plank
 * shelf of jars of kauri gum, amber and glowing, loose lumps on a sorting bench, a lamp on a nail;
 * the gum spear (a long steel probe with a T handle) and the narrow gum spade against the wall.
 */
export function gumHut(seed: number): Sprite {
  const W = 156, H = 112, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H), rng = new Rng(seed * 5 + 3);
  const base = H - 1, x0 = 26, x1 = 116, wallTop = base - 50;
  // the chimney: a stone stack at the west end, an iron flue on top
  stones(b, x0 - 16, x0 + 2, wallTop - 14, base, VP.stone, seed + 1, 7);
  for (let y = wallTop - 30; y < wallTop - 14; y++) for (let x = x0 - 12; x < x0 - 4; x++) b.set(x, y, dpick(VP.rust, 3.2 - (x - x0 + 12) * 0.25 + (y % 6 === 0 ? -0.8 : 0), x, y));
  for (let x = x0 - 13; x < x0 - 3; x++) b.set(x, wallTop - 30, VP.iron[2]);
  // the walls: split slabs, silver-grey, gaps between them; sacking nailed over some
  const rngS = new Rng(seed);
  for (let x = x0; x < x1;) {
    const sw = rngS.int(4, 7), tone = rngS.range(2.4, 3.6);
    for (let i = 0; i < sw && x + i < x1; i++) for (let y = wallTop; y <= base; y++) {
      const X = x + i, edge = i === 0 ? -1.4 : i === sw - 1 ? -0.6 : 0, grain = Math.sin(y * 0.8 + X * 2.3) > 0.88 ? -0.8 : 0;
      b.set(X, y, dpick(VP.grey, tone + edge + grain - (y - wallTop) / 50 * 0.4, X, y));
    }
    x += sw;
  }
  const sack = (sx: number, sy: number, sw: number, sh: number, txt?: string) => {
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
      const wv = (x + y) % 2 === 0;
      b.set(x, y, dpick(QP.hessian, 3.2 + (wv ? 0.3 : -0.3) - (x - sx) / sw * 0.8 + (y === sy + sh - 1 ? -1 : 0) + Math.sin(x * 0.7 + y * 0.2) * 0.3, x, y));
    }
    for (let x = sx; x < sx + sw; x += 5) { b.set(x, sy, VP.iron[4]); b.set(x + 2, sy + sh - 1, VP.iron[3]); }
    if (txt) letters(b, sx + 3, sy + 3, txt, 3, { col: [hex('#3a2a6a'), hex('#4a3a7a')], wear: 0.35, seed: sx });
  };
  sack(x0 + 4, wallTop + 4, 22, 18, 'SUGAR');
  sack(x1 - 30, wallTop + 22, 20, 14);
  // the window: four small panes, one patched with sacking
  windowPane(b, g, x0 + 40, wallTop + 10, 14, 12, VP.grey, seed + 3, { broken: true, curtain: hex('#c8b890') });
  // the door, hung on leather hinges, a little ajar
  const dx = x0 + 62, dw = 18;
  for (let y = base - 40; y <= base; y++) for (let x = dx; x < dx + dw; x++) {
    const open = x < dx + 4;
    const c = open ? hex('#0e0806') : dpick(VP.wood, 2.8 + ((x - dx) % 6 === 0 ? -1 : 0) + ((base - y) % 13 === 0 ? 1 : 0), x, y);
    b.set(x, y, c);
    if (open) g.set(x, y, AMB[clamp(Math.round(3.2 - (base - y) / 40 * 1.4), 1, 4)]);
  }
  for (let x = dx - 1; x <= dx + dw; x++) b.set(x, base - 41, VP.grey[4]);
  // DOBRO DOŠLI on a board over the door
  signboard(b, dx - 15, base - 54, 48, 11, R('#1e2a1e', '#2e3e2a', '#40523a', '#54684a', '#6a805e', '#849a74'), [{ text: 'DOBRO DOŠLI', font: 3, col: [hex('#f0e8d0'), hex('#e0d4b4')], dy: 4 }], seed + 7);
  // the skillion roof: rusted iron, ribs running down the slope, stones and a log to hold it on
  for (let x = x0 - 6; x < x1 + 10; x++) {
    const t = (x - x0 + 6) / (x1 - x0 + 16), yT = wallTop - 14 + Math.round(t * 10);
    for (let y = yT; y < yT + 6; y++) b.set(x, y, dpick(noise1(x * 0.12, seed) > 0.55 ? VP.rust : VP.iron, 3.4 - (y - yT) * 0.35 + (x % 4 < 2 ? 0.6 : -0.6) - t * 0.6, x, y));
    b.set(x, yT + 6, hex('#140c08'));
  }
  for (let i = 0; i < 4; i++) { const sx2 = x0 + 4 + i * 24 + rng.int(-3, 3), t = (sx2 - x0 + 6) / (x1 - x0 + 16), y = wallTop - 15 + Math.round(t * 10); b.ellipseFn(sx2, y - 1, 3.4, 2.6, (X, Y, nx, ny) => dpick(VP.stone, 3.8 - nx - ny * 1.3, X, Y)); }
  // the porch to the east: a lean-to on two poles, the gum shelf under it
  const px0 = x1 + 2, px1 = x1 + 36;
  for (let x = px0; x < px1 + 2; x++) { const y = wallTop - 2 + Math.round((x - px0) * 0.18); for (let k = 0; k < 3; k++) b.set(x, y + k, dpick(VP.iron, 3 - k * 0.8 + (x % 4 < 2 ? 0.5 : -0.5), x, y + k)); }
  post(b, px1 - 2, wallTop + 5, base, 3, VP.bark, seed + 9);
  for (let y = wallTop + 1; y <= base; y++) for (let x = px0; x < px1 - 2; x++) b.set(x, y, dpick(VP.grey, 1.6 - (x - px0) * 0.02, x, y));
  const shelf = (sy: number) => { for (let x = px0 + 1; x < px1 - 3; x++) { b.set(x, sy, VP.wood[4]); b.set(x, sy + 1, VP.wood[2]); } b.set(px0 + 3, sy + 2, VP.iron[2]); b.set(px1 - 6, sy + 2, VP.iron[2]); };
  const jar = (jx: number, jy: number, fill: number) => {
    // a glass jar: the glass rim and sides catching light, kauri gum inside, amber, lit through
    for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) {
      const X = jx + x, Y = jy - y, side = x === 0 || x === 5, neck = y > 7;
      if (neck && (x === 0 || x === 5)) continue;
      const gum = y < fill && !side && y > 0;
      const lump = gum && h01(X, Y, seed) > 0.18;
      let c: C;
      if (y === 8) c = VP.iron[3];
      else if (side) c = QP.glass[x === 0 ? 4 : 2];
      else if (lump) c = dpick(QP.gum, 3.4 - (x - 2.5) * 0.5 + (y - fill / 2) * 0.25 + (h01(X, Y, seed + 1) < 0.18 ? 1.6 : 0), X, Y);
      else c = QP.glass[y === 0 ? 1 : 0];
      b.set(X, Y, c);
      if (lump) g.set(X, Y, pick(QP.gum, 4.2 + (x === 1 ? 1 : 0) - (y > fill - 2 ? 0.6 : 0)));
    }
    b.set(jx + 1, jy - 6, QP.glass[5]); b.set(jx + 1, jy - 5, QP.glass[4]);
  };
  shelf(base - 34); shelf(base - 20);
  for (let i = 0; i < 4; i++) jar(px0 + 3 + i * 7, base - 35, rng.int(4, 8));
  for (let i = 0; i < 3; i++) jar(px0 + 6 + i * 8, base - 21, rng.int(5, 8));
  // loose lumps of gum on the sorting bench, a scraping knife
  for (let x = px0 - 4; x < px1 - 4; x++) { b.set(x, base - 9, VP.wood[4]); b.set(x, base - 8, VP.wood[2]); }
  for (const lx of [px0 - 2, px1 - 7]) for (let y = base - 7; y <= base; y++) b.set(lx, y, VP.wood[2]);
  for (let i = 0; i < 6; i++) { const lx = px0 + i * 4 + rng.int(0, 2), r = rng.range(1, 1.8); b.ellipseFn(lx, base - 10 - r * 0.7, r + 0.4, r, (X, Y, nx, ny) => dpick(QP.gum, 3.8 - nx - ny * 1.2, X, Y)); g.set(lx, base - 11, QP.gum[5]); }
  for (let x = 0; x < 6; x++) b.set(px1 - 12 + x, base - 10, x < 3 ? VP.wood[3] : VP.iron[5]);
  // the lamp on a nail by the shelf
  for (let y = 0; y < 7; y++) for (let x = -1; x <= 1; x++) { const X = px0 + 30 + x, Y = base - 46 + y; b.set(X, Y, y < 1 || y > 5 ? VP.iron[3] : QP.glass[3 - Math.abs(x)]); if (y > 0 && y < 6) g.set(X, Y, AMB[5 - Math.abs(x)]); }
  // the gum spear and the gum spade against the wall
  for (let y = 0; y < 78; y++) { const X = x0 + 30 + Math.round(y * 0.07), Y = base - y; b.set(X, Y, y < 70 ? VP.iron[y % 9 === 0 ? 5 : 3] : VP.wood[3]); }
  for (let x = -4; x <= 4; x++) { b.set(x0 + 35 + x, base - 78, VP.wood[4]); b.set(x0 + 35 + x, base - 77, VP.wood[2]); }
  for (let y = 0; y < 46; y++) { const X = x0 + 24 + Math.round(y * 0.12), Y = base - y; if (y < 12) { for (let k = -1; k <= 1; k++) b.set(X + k, Y, dpick(QP.galv, 3.4 - k, X + k, Y)); } else { b.set(X, Y, VP.wood[4]); b.set(X + 1, Y, VP.wood[2]); } }
  for (let x = -2; x <= 2; x++) b.set(x0 + 30 + x, base - 46, VP.wood[3]);
  return withGlow(b, g, 70, base);
}
/** the pergola: two rough posts, a beam and rafter ends, the old grapevine twisting up the post */
export function pergola(seed: number): Sprite {
  const rng = new Rng(seed * 83 + 7);
  const W = 84, H = 72, b = new PixelBuffer(W, H), base = H - 1;
  post(b, 6, 10, base, 4, VP.bark, seed); post(b, 74, 10, base, 4, VP.bark, seed + 1);
  for (let x = 1; x < W - 1; x++) for (let y = 8; y < 13; y++) b.set(x, y, dpick(VP.bark, 3.8 - (y - 8) * 0.5 - x / W * 0.6, x, y));
  for (let x = 4; x < W - 4; x += 9) for (let y = 5; y < 8; y++) for (let k = 0; k < 3; k++) b.set(x + k, y, dpick(VP.bark, 3.6 - k * 0.6, x + k, y));
  // the vine trunk: gnarled, twisting round the post, forking along the beam
  const pts: [number, number][] = [];
  for (let y = base; y > 13; y--) pts.push([9 + Math.sin(y * 0.18 + seed) * 3 + (base - y) * 0.02, y]);
  for (const [x, y] of pts) for (let k = -2; k <= 1; k++) { const X = Math.round(x + k); b.set(X, y, dpick(VP.bark, 3 - k * 0.6 + (Math.sin(y * 1.3 + k) > 0.7 ? -1 : 0), X, y)); }
  for (let x = 10; x < W - 6; x++) { const y = 13 + Math.round(Math.sin(x * 0.2 + seed) * 1.2); b.set(x, y, VP.bark[3]); b.set(x, y + 1, VP.bark[2]); }
  // a small table under it, a demijohn in its wicker, a bench
  for (let x = 28; x < 56; x++) { b.set(x, base - 14, VP.wood[4]); b.set(x, base - 13, VP.wood[2]); }
  for (const lx of [30, 53]) for (let y = base - 12; y <= base; y++) b.set(lx, y, VP.wood[2]);
  for (let y = 0; y < 10; y++) for (let x = -4; x <= 4; x++) { const hw = y < 6 ? 4 : y < 8 ? 2 : 1; if (Math.abs(x) > hw) continue; const X = 40 + x, Y = base - 15 - y; b.set(X, Y, y < 5 ? ((X + Y) % 2 ? QP.husk[3] : QP.husk[4]) : dpick(R('#0e2a1a', '#18402a', '#24583a', '#367450', '#56946a', '#8abc96'), 3.4 - x * 0.5, X, Y)); }
  b.set(39, base - 22, R('#56946a', '#8abc96')[1]);
  for (let i = 0; i < 2; i++) { const cx2 = 48 + i * 4; b.set(cx2, base - 15, QP.glass[4]); b.set(cx2, base - 16, QP.glass[3]); b.set(cx2, base - 17, QP.glass[3]); }
  for (let x = 58; x < 72; x++) { b.set(x, base - 8, VP.wood[4]); b.set(x, base - 7, VP.wood[2]); }
  for (const lx of [60, 70]) for (let y = base - 6; y <= base; y++) b.set(lx, y, VP.wood[2]);
  void rng;
  return S(b, W / 2, base);
}
/** the grapevine's canopy along the beam: lobed leaves, tendrils, dark bunches hanging (it swings) */
export function vineCanopy(seed: number): Sprite {
  const rng = new Rng(seed * 89 + 3);
  const W = 86, H = 30, b = new PixelBuffer(W, H);
  const GL = R('#10260e', '#1c3e16', '#2c5a1e', '#3e7a28', '#5a9a36', '#86ba52');
  const AU = R('#3a2208', '#5e3a0e', '#8a5a16', '#b47e22', '#d4a434', '#ecc864');
  const leaves = (n: number, y0: number, y1: number, k: number) => {
    for (let i = 0; i < n; i++) {
      const x = rng.range(2, W - 2), y = rng.range(y0, y1 + Math.sin(x * 0.12 + seed) * 3);
      const a = Math.PI / 2 + rng.range(-1.2, 1.2);
      leaf(b, x, y, a, rng.range(4, 6.5), rng.range(3, 4.2), rng.chance(0.12) ? AU : GL, k + (rng.chance(0.3) ? 1 : 0), 'heart');
    }
  };
  leaves(60, 0, 9, 2);
  // bunches of grapes, each berry with its highlight
  const GR = R('#12061a', '#260c30', '#3e164a', '#5a2466', '#7a3a84', '#a464aa');
  for (let i = 0; i < 4; i++) {
    const bx = 10 + i * 20 + rng.int(-4, 4), by = 9 + rng.int(0, 4), rows = rng.int(3, 4);
    for (let r = 0; r < rows; r++) for (let k = 0; k < rows - r; k++) {
      const X = bx - (rows - r - 1) + k * 2 + (r % 2), Y = by + r * 2;
      b.set(X, Y, GR[2]); b.set(X + 1, Y, GR[1]); b.set(X, Y + 1, GR[1]); b.set(X + 1, Y + 1, GR[0]); b.set(X, Y, GR[4]);
      if ((k + r) % 3 === 0) b.set(X, Y, GR[5]);
    }
    b.set(bx, by - 1, VP.bark[3]); b.set(bx, by - 2, VP.bark[3]);
  }
  leaves(40, 0, 6, 3);
  // tendrils curling down
  for (let i = 0; i < 5; i++) { const x = rng.int(4, W - 4); for (let t = 0; t < 6; t++) b.set(x + Math.round(Math.sin(t * 1.2) * 1.5), 14 + t + rng.int(0, 3), GL[4]); }
  return S(b, W / 2, 0);
}

// ------------------------------------------------------------------ the trading store
/**
 * The trading store: a tin shed behind a weatherboard false front, the paint peeling to silver wood;
 * the signboard GENERAL STORE and TEA · FLOUR · KEROSENE painted under it; a verandah; the double
 * doors (one open on shelves), windows of lolly jars and bolts of cloth, enamel signs nailed up
 * (TEA, SOAP, OIL), chipped; a noticeboard of papers; a lean-to of rusted iron at the side.
 */
export function tradeStore(seed: number): Sprite {
  const W = 184, H = 140, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H), rng = new Rng(seed * 11 + 5);
  const base = H - 1, x0 = 14, x1 = 142, top = base - 116, verY = base - 60;
  // the tin lean-to on the east side, its open door full of kerosene tins
  corrugated(b, x1 - 2, base - 66, 40, 67, seed + 2, { rust: 0.6 });
  for (let x = x1 - 4; x < x1 + 42; x++) { const y = base - 70 + Math.round((x - x1) * 0.12); for (let k = 0; k < 4; k++) b.set(x, y + k, dpick(VP.rust, 3.2 - k * 0.7 + (x % 4 < 2 ? 0.5 : -0.5), x, y + k)); }
  for (let y = base - 38; y <= base; y++) for (let x = x1 + 12; x < x1 + 32; x++) {
    const iy = (base - y), tin = (x - x1 - 12) % 7 < 6 && iy % 10 < 9 && iy < 30;
    const c = tin ? dpick(QP.galv, 1.6 + ((x - x1 - 12) % 7 === 0 ? 0.8 : 0) + (iy % 10 === 8 ? 0.8 : 0), x, y) : hex('#0e0a08');
    b.set(x, y, c);
  }
  // the false front: weatherboards, paint flaking, stepped at the top
  weatherboard(b, x0, top + 6, x1 - x0, base - top - 5, QP.paint, seed);
  for (let x = x0; x < x1; x++) { const t = (x - x0) / (x1 - x0); const yy = top + 6 - (t > 0.3 && t < 0.7 ? 6 : t > 0.15 && t < 0.85 ? 3 : 0); for (let y = yy; y < top + 6; y++) b.set(x, y, dpick(QP.paint, 3.6 - (y - yy) * 0.2, x, y)); for (let k = 0; k < 2; k++) b.set(x, yy - 1 - k, dpick(VP.wood, 4 - k, x, yy - 1 - k)); }
  // the signboard
  signboard(b, x0 + 8, top + 8, x1 - x0 - 16, 22, R('#0e1e14', '#16301e', '#20442a', '#2c5838', '#3a6c46', '#4c8258'), [{ text: 'GENERAL STORE', font: 5, col: [hex('#f2e6c4'), hex('#e8dab4'), hex('#f8eed4')], dy: 8 }], seed + 3);
  letters(b, x0 + Math.round((x1 - x0 - lettersWidth('TEA · FLOUR · KEROSENE', 3)) / 2), top + 34, 'TEA · FLOUR · KEROSENE', 3, { col: [hex('#5a0e08'), hex('#6a140c')], wear: 0.03, wobble: 0.1, seed: seed + 4 });
  // the verandah's shade
  for (let y = verY; y <= base; y++) for (let x = x0; x < x1; x++) b.set(x, y, mix(b.get(x, y), hex('#120c0a'), 0.44));
  // the doors: one shut (panelled), one open on shelves of goods
  const dx = x0 + 52, dw = 30;
  for (let y = base - 46; y <= base; y++) for (let x = dx; x < dx + dw; x++) {
    const open = x >= dx + 15;
    let c: C;
    if (open) { const sh = (base - y) % 11; c = sh === 0 ? hex('#3a2416') : sh < 7 && y < base - 6 ? shade([hex('#c8a040'), hex('#7a2a1a'), hex('#d8d0b8'), hex('#3a5a7a')][(Math.floor((x - dx) / 3) + Math.floor((base - y) / 11)) % 4], -0.5) : hex('#0e0806'); g.set(x, y, lampLit(c, 0.6)); }
    else { const px = (x - dx) % 15, py = (base - y) % 23; c = dpick(R('#16261c', '#223a2a', '#2e4e38', '#3c644a', '#4e7a5c', '#669470'), 2.4 + (px === 2 || py === 3 ? 1 : px === 12 || py === 20 ? -0.8 : 0), x, y); }
    b.set(x, y, c);
  }
  b.set(dx + 12, base - 22, hex('#c8a040'));
  // the windows: lolly jars, bolts of cloth, tins
  for (const [wx, kind] of [[x0 + 10, 0], [x0 + 92, 1]] as [number, number][]) {
    windowPane(b, g, wx, base - 46, 32, 26, R('#16261c', '#223a2a', '#2e4e38', '#3c644a', '#4e7a5c', '#669470'), seed + wx);
    for (let i = 0; i < 4; i++) {
      const ix = wx + 2 + i * 8, iy = base - 22;
      if (kind === 0) { for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { const lol = y < 6 && x > 0 && x < 5; b.set(ix + x, iy - y, lol ? [hex('#e85a8a'), hex('#f0c838'), hex('#4ab0d8'), hex('#7ac04a'), hex('#f08a3a')][(x + y * 2 + i) % 5] : QP.glass[x === 0 ? 4 : 2]); if (lol) g.set(ix + x, iy - y, lampLit(b.get(ix + x, iy - y), 0.8)); } b.set(ix + 1, iy - 7, VP.iron[4]); }
      else { const col = ramp6([hex('#2c5a96'), hex('#c8281e'), hex('#e8dfc8'), hex('#3a7a4a')][i], 0.5); for (let y = 0; y < 10; y++) for (let x = 0; x < 7; x++) { b.set(ix + x, iy - y, dpick(col, 3.2 - x * 0.3 + (y % 3 === 0 ? 0.6 : 0), ix + x, iy - y)); g.set(ix + x, iy - y, lampLit(b.get(ix + x, iy - y), 0.7)); } }
    }
  }
  // enamel signs, chipped
  const enamel = (ex: number, ey: number, w: number, h: number, bg: C, fg: C, text: string) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue; const rim = x === 0 || y === 0 || x === w - 1 || y === h - 1; b.set(ex + x, ey + y, rim ? fg : shade(bg, ((w - x) / w) * 0.18 - (y / h) * 0.1)); }
    letters(b, ex + Math.round((w - lettersWidth(text, 3)) / 2), ey + Math.round((h - 5) / 2), text, 3, { col: [fg], seed: ex });
    for (let i = 0; i < 3; i++) { const cx2 = ex + rng.int(1, w - 2), cy2 = ey + rng.int(1, h - 2); b.set(cx2, cy2, hex('#141414')); if (rng.chance(0.5)) b.set(cx2 + 1, cy2, hex('#2a2a2a')); }
  };
  enamel(x1 + 12, base - 60, 18, 11, hex('#1e4a9a'), hex('#f2eee0'), 'TEA');
  enamel(x1 - 24, verY - 17, 20, 10, hex('#b8281c'), hex('#f2eee0'), 'SOAP');
  enamel(dx + 6, base - 58, 18, 9, hex('#e8c030'), hex('#1a1410'), 'OIL');
  // a noticeboard: papers pinned up, curling
  const nx = x1 - 34, ny = base - 52;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) b.set(nx + x, ny + y, x === 0 || y === 0 || x === 19 || y === 17 ? VP.wood[3] : dpick(R('#3a2414', '#5a3a1e', '#7a5028', '#9a6834', '#b88444', '#d0a05a'), 2.6, nx + x, ny + y));
  for (const [px, py, pw, ph, pin] of [[2, 2, 8, 12, 0], [11, 3, 7, 8, 1]] as number[][]) {
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const line = y > 1 && y % 2 === 0 && x > 0 && x < pw - 1 - ((y * 3 + px) % 3);
      b.set(nx + px + x, ny + py + y, line ? hex('#5a5650') : dpick(QP.paint, 4.6 - x * 0.12 - (x === pw - 1 && y === ph - 1 ? 2 : 0), nx + px + x, ny + py + y));
    }
    b.set(nx + px + Math.floor(pw / 2), ny + py, pin ? hex('#2a6ac8') : hex('#c8281e'));
  }
  // the verandah roof and fascia, the posts
  for (let y = verY - 7; y < verY; y++) for (let x = x0 - 8; x < x1 + 6; x++) b.set(x, y, dpick(VP.iron, 2.8 - (y - verY + 7) * 0.1 + ((x % 4) < 2 ? 0.7 : -0.6) - (x - x0) / (x1 - x0) * 0.5, x, y));
  for (let x = x0 - 8; x < x1 + 6; x++) { b.set(x, verY, VP.wood[4]); b.set(x, verY + 1, QP.paint[4]); b.set(x, verY + 2, QP.paint[2]); b.set(x, verY + 3, VP.wood[1]); }
  for (const px of [x0 - 5, x0 + 46, x1 + 1]) { post(b, px, verY + 4, base, 3, QP.paint, seed + px); b.set(px - 1, verY + 6, QP.paint[2]); b.set(px + 3, verY + 6, QP.paint[2]); }
  return withGlow(b, g, Math.round((x0 + x1) / 2), base);
}
/** four-gallon kerosene tins stacked unevenly: rims, screw caps, rust, a dent; one cut open as a bucket */
export function kerosene(seed: number): Sprite {
  const rng = new Rng(seed * 97 + 1);
  const W = 40, H = 34, b = new PixelBuffer(W, H), base = H - 1;
  const tin = (x: number, y: number, cut: boolean) => {
    for (let j = 0; j < 12; j++) for (let i = 0; i < 9; i++) {
      const X = x + i, Y = y - j;
      let v = 3.6 - i * 0.28 + (j === 1 || j === 10 ? 0.9 : 0) + (j === 0 ? -1.2 : 0);
      if (Math.abs(i - 5) + Math.abs(j - 6) < 2 && h01(x, y, seed) < 0.5) v -= 1.1;
      const rusty = noise1(X * 0.4 + Y * 0.3, seed) > 0.72;
      b.set(X, Y, dpick(rusty ? VP.rust : QP.galv, v, X, Y));
    }
    if (cut) { for (let i = 0; i < 9; i++) b.set(x + i, y - 12, hex('#141414')); for (let i = -1; i < 10; i++) b.set(x + i, y - 14 - Math.round(Math.sin((i + 1) / 10 * Math.PI) * 2), VP.wood[3]); }
    else { b.set(x + 6, y - 12, VP.iron[2]); b.set(x + 7, y - 12, VP.iron[3]); b.set(x + 6, y - 13, VP.iron[4]); }
  };
  tin(4, base, false); tin(14, base, false); tin(24, base, rng.chance(0.5));
  tin(8 + rng.int(-1, 1), base - 12, false);
  if (rng.chance(0.6)) tin(19 + rng.int(-1, 2), base - 12, false);
  return S(b, W / 2, base);
}
/** flour and sugar sacks: bulging calico, ears tied at the top, stencils, flour dust at the foot */
export function sacks(seed: number): Sprite {
  const rng = new Rng(seed * 101 + 3);
  const W = 44, H = 26, b = new PixelBuffer(W, H), base = H - 1;
  const CAL = R('#5a5440', '#868066', '#aea88a', '#cec8aa', '#e6e0c4', '#f6f2dc');
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const cx = 8 + i * 14 + rng.int(-1, 1), h = rng.int(17, 21), slump = rng.range(-0.15, 0.15);
    for (let y = 0; y < h; y++) {
      const t = y / h, hw = 5 + Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.85) * 2 - (y > h - 3 ? 2 : 0);
      for (let x = -Math.round(hw); x <= Math.round(hw); x++) {
        const X = Math.round(cx + x + slump * y), Y = base - y;
        const crease = Math.sin(x * 0.9 + y * 0.5 + i) > 0.85;
        b.set(X, Y, dpick(CAL, 3.6 - x / hw * 1.2 - (crease ? 1 : 0) - (y < 2 ? 0.8 : 0), X, Y));
      }
    }
    // the tied ears, the stencil
    const ty = base - h;
    b.set(Math.round(cx - 2 + slump * h), ty, CAL[3]); b.set(Math.round(cx + 2 + slump * h), ty, CAL[2]); b.set(Math.round(cx + slump * h), ty + 1, QP.rope[2]);
    const sy = base - Math.round(h * 0.55);
    if (i === n - 1) { const word = rng.pick(['FLOUR', 'SUGAR']); letters(b, Math.round(cx - lettersWidth(word, 3) / 2 + slump * h * 0.5), sy, word, 3, { col: [hex('#2a4a8a')], wear: 0.15, seed: i }); }
    else for (let x = -3; x <= 3; x++) { b.paint(Math.round(cx + x + slump * h * 0.5), sy, hex(i % 2 ? '#c8281e' : '#2a4a8a')); b.paint(Math.round(cx + x + slump * h * 0.5), sy + 2, hex(i % 2 ? '#c8281e' : '#2a4a8a')); }
  }
  for (let x = 2; x < W - 2; x++) if (rng.chance(0.4)) b.set(x, base, CAL[5]);
  return S(b, W / 2, base);
}
/** an old black roadster bicycle: spoked wheels, a leather saddle, swept bars, a basket on the front */
export function bicycle(seed: number): Sprite {
  const W = 48, H = 32, b = new PixelBuffer(W, H), base = H - 1, r = 9;
  const FR = R('#0e0e10', '#1c1c20', '#2c2c32', '#44444c', '#62626c', '#8a8a94');
  const wheel = (cx: number) => {
    const cy = base - r;
    for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI; b.line(Math.round(cx - Math.cos(t) * (r - 2)), Math.round(cy - Math.sin(t) * (r - 2)), Math.round(cx + Math.cos(t) * (r - 2)), Math.round(cy + Math.sin(t) * (r - 2)), VP.iron[2]); }
    b.discFn(cx, cy, r + 0.5, (X, Y, nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.86 ? pick(FR, 2.4 - ny * 1.6) : d > 0.76 ? pick(VP.iron, 4 - ny - nx) : -1; });
    b.set(cx, cy, VP.iron[5]); b.set(cx + 1, cy, VP.iron[3]);
  };
  wheel(10); wheel(37);
  const by = base - r;
  // the frame: chain stays, seat tube, top tube, down tube, fork, bars, saddle
  b.line(10, by, 20, by, FR[3]); b.line(10, by, 18, by - 13, FR[3]); b.line(20, by, 17, by - 15, FR[4]);
  b.line(17, by - 14, 33, by - 14, FR[4]); b.line(20, by, 33, by - 13, FR[3]); b.line(33, by - 15, 37, by, FR[4]);
  b.line(33, by - 15, 30, by - 18, FR[3]); b.line(30, by - 18, 27, by - 17, FR[4]);
  for (let x = 14; x < 21; x++) b.set(x, by - 17, x < 16 ? hex('#5a3418') : hex('#7a4a24'));
  b.set(15, by - 18, hex('#9a6430')); b.set(16, by - 18, hex('#9a6430'));
  for (let x = 16; x < 22; x++) b.set(x, by + 1, x % 2 ? VP.iron[4] : VP.iron[2]);
  b.discFn(20, by, 2, (X, Y, nx) => pick(VP.iron, 3 - nx));
  // a wicker basket over the front wheel
  for (let y = 0; y < 6; y++) for (let x = 0; x < 9; x++) { const X = 34 + x, Y = by - 21 + y; b.set(X, Y, (X + Y) % 2 ? QP.husk[3] : QP.husk[4]); }
  produce(b, 'bokchoy', 38, by - 20, new Rng(seed));
  return S(b, 24, base);
}

// ------------------------------------------------------------------ market stalls
export type StallKind = 'fish' | 'fruit' | 'woven';
const FISH = { snapper: R('#3a0e10', '#6a1e1e', '#a8343a', '#d05a5a', '#e88a84', '#f8c4b8'), kahawai: R('#0e2228', '#1e4048', '#3a6a6a', '#78a0a0', '#b8d0cc', '#eef6f2'), mullet: QP.fish };
function fish(b: PixelBuffer, x: number, y: number, kind: keyof typeof FISH, len: number, flip: boolean) {
  const rp = FISH[kind], s = flip ? -1 : 1;
  for (let t = 0; t < len; t++) {
    const u = t / len, hh = Math.round(Math.sin(Math.min(1, u * 1.15) * Math.PI) * 2.2 + (u < 0.85 ? 0.6 : 0));
    for (let k = -hh; k <= hh; k++) { const X = x + s * t, Y = y + k; b.set(X, Y, dpick(rp, 3.2 - k * 0.8 + (k === -hh ? -1.2 : 0) + (kind === 'kahawai' && k < 0 && (t % 3 === 0) ? -1 : 0), X, Y)); }
  }
  // the tail fork, the eye, the gill line
  const tx = x + s * len;
  b.set(tx, y - 2, rp[2]); b.set(tx + s, y - 3, rp[2]); b.set(tx, y + 2, rp[2]); b.set(tx + s, y + 3, rp[2]); b.set(tx, y - 1, rp[3]); b.set(tx, y + 1, rp[3]);
  b.set(x + s * 2, y - 1, hex('#101010')); b.set(x + s * 2, y - 2, rp[5]);
  b.set(x + s * 4, y, rp[1]); b.set(x + s * 4, y + 1, rp[1]);
}
/**
 * A market stall: a plank counter on trestles, two poles and an awning of patched tarp sagging
 * between them (its valance hanging ragged at the front, the stitches round each patch), guy ropes
 * to pegs, a chalk price board hung on a pole; on the counter what's for sale, under it what's left.
 */
export function stall(kind: StallKind, seed: number): Sprite {
  const W = 96, H = 82, b = new PixelBuffer(W, H), rng = new Rng(seed * 103 + 7), base = H - 1;
  const cx = 48, tY = base - 24, beamY = base - 66;
  const tarp = kind === 'fish' ? QP.tarp : kind === 'fruit' ? R('#3a1a06', '#64300c', '#8e4a16', '#b46622', '#d08634', '#e8aa52') : QP.tarpGreen;
  // the back poles and the back of the awning in shade
  for (const px of [18, 76]) for (let y = beamY + 2; y < tY; y++) b.set(px, y, VP.bark[1]);
  // the counter's cloth hanging at the front, and what's under it
  if (kind === 'fish') {
    // a chilly bin under the counter
    for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) b.set(14 + x, base - y, y > 9 ? dpick(R('#0e2a5a', '#1a3e7a', '#2a5a9a', '#3a74b4', '#5a92c8', '#86b4dc'), 3 - x * 0.08, 14 + x, base - y) : dpick(QP.paint, 4.4 - x * 0.06 - (y === 0 ? 1 : 0), 14 + x, base - y));
    for (let x = 18; x < 24; x++) b.set(x, base - 7, QP.paint[2]);
  } else if (kind === 'fruit') {
    const c = crate(18, 11, seed, 'pawpaw'); b.blit(c.buf, 12, base - c.ay, false, false);
    const c2 = crate(18, 11, seed + 3, 'coconut'); b.blit(c2.buf, 62, base - c2.ay, false, false);
  } else {
    for (let r2 = 0; r2 < 3; r2++) for (let x = 0; x < 22; x++) for (let y = 0; y < 3; y++) b.set(12 + x + r2, base - r2 * 3 - y, dpick(R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84'), 3.4 - y * 0.8 + ((x + y) % 2 ? 0.3 : -0.3), 12 + x, base - r2 * 3 - y));
  }
  // trestles and the counter
  for (const tx of [22, 72]) { b.line(tx - 6, base, tx, tY + 2, VP.wood[2]); b.line(tx + 6, base, tx, tY + 2, VP.wood[3]); }
  for (let x = 6; x < 90; x++) { b.set(x, tY, VP.wood[5]); b.set(x, tY + 1, VP.wood[3]); b.set(x, tY + 2, VP.wood[2]); }
  // what's for sale
  if (kind === 'fish') {
    for (let x = 8; x < 88; x++) for (let y = 0; y < 2; y++) b.set(x, tY - 1 - y, dpick(QP.banana, 3.4 - y + ((x * 3) % 7 === 0 ? -1 : 0), x, tY - 1 - y));
    const kinds: (keyof typeof FISH)[] = ['snapper', 'kahawai', 'mullet', 'snapper', 'kahawai'];
    for (let i = 0; i < 5; i++) fish(b, 12 + i * 15 + (i % 2 ? 12 : 0), tY - 4 - (i % 2) * 2, kinds[(i + seed) % 5], 12, i % 2 === 1);
    // a bucket of pipi
    for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) b.set(76 + x, tY - 1 - y, dpick(QP.galv, 3.4 - x * 0.3, 76 + x, tY - 1 - y));
    for (let i = 0; i < 6; i++) { const px = 77 + i * 1.3, py = tY - 8 - (i % 2); b.set(Math.round(px), py, hex('#e8dcc0')); b.set(Math.round(px) + 1, py, hex('#b8a888')); }
  } else if (kind === 'fruit') {
    const piles: ProduceKind[] = ['orange', 'pawpaw', 'lemon', 'coconut', 'kumara'];
    for (let p = 0; p < 5; p++) {
      const px = 13 + p * 16, k = piles[(p + seed) % piles.length];
      const rows = k === 'pawpaw' || k === 'coconut' ? 2 : 3;
      for (let r2 = 0; r2 < rows; r2++) for (let i = 0; i < rows - r2; i++) produce(b, k, px + i * (k === 'coconut' ? 6 : 4) - (rows - r2 - 1) * (k === 'coconut' ? 3 : 2), tY - r2 * (k === 'pawpaw' ? 4 : 3), rng);
    }
    // a pineapple: the diamond skin, the crown
    const ax = 86;
    for (let y = 0; y < 8; y++) for (let x = -2; x <= 2; x++) { if (Math.abs(x) === 2 && (y === 0 || y === 7)) continue; b.set(ax + x, tY - 1 - y, (x + y) % 2 ? dpick(R('#3a2a06', '#6a4a0c', '#9a6e14', '#c8941e', '#e8b432', '#fad466'), 3.4 - x * 0.6, ax + x, tY - 1 - y) : hex('#5a3e0a')); }
    for (let i = -2; i <= 2; i++) b.line(ax, tY - 9, ax + i * 2, tY - 14 + Math.abs(i), QP.banana[3 + (i & 1)]);
  } else {
    // fans, hats, a rolled mat, a small tapa folded
    for (let f2 = 0; f2 < 3; f2++) { const fx = 12 + f2 * 11; for (let y = 0; y < 10; y++) { const hw = Math.round(Math.sin((y + 1) / 11 * Math.PI) * 4); for (let x = -hw; x <= hw; x++) b.set(fx + x, tY - 4 - y, ((fx + x + y) % 3 === 0) ? hex('#8a6a34') : dpick(R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84'), 3.6 - x * 0.3, fx + x, tY - 4 - y)); } for (let y = 0; y < 4; y++) b.set(fx, tY - 1 - y, VP.wood[3]); }
    for (let hh = 0; hh < 3; hh++) for (let x = -7; x <= 7; x++) { const X = 56 + x, Y = tY - 1 - hh * 2; b.set(X, Y, dpick(R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84'), 3.6 - x * 0.15, X, Y)); if (Math.abs(x) < 4) b.set(X, Y - 1, dpick(R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84'), 3 - x * 0.2, X, Y - 1)); }
    b.set(55, tY - 7, hex('#c8281e')); b.set(57, tY - 7, hex('#c8281e'));
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) b.set(70 + x, tY - 1 - y, (x % 4 === 0 || y === 2) ? KOKA[1] : TAPA[3 + (y & 1)]);
  }
  // the front poles
  for (const px of [6, 88]) post(b, px, beamY, base, 3, VP.bark, seed + px);
  // the awning: the tarp's top sagging between the poles, the valance hanging ragged, patches
  for (let x = 2; x < 94; x++) {
    const t = (x - 2) / 92, sag = Math.round(Math.sin(t * Math.PI) * 4);
    const yTop = beamY - 10 + sag, yBot = beamY + 6 + sag + Math.round(Math.sin(x * 0.55 + seed) * 1.2) + (h01(x, 0, seed) < 0.1 ? 2 : 0);
    for (let y = yTop; y <= yBot; y++) {
      const valance = y > beamY + sag;
      let v = (valance ? 3 : 3.6) - t * 0.8 + (y === yTop ? 1 : 0) + (valance && (x % 9 === 0) ? -0.8 : 0) + Math.sin(x * 0.35) * 0.3;
      if (y === yBot) v -= 0.9;
      b.set(x, y, dpick(tarp, v, x, y));
    }
  }
  const patches = rng.int(2, 3);
  for (let p = 0; p < patches; p++) {
    const px = rng.int(8, 76), pw = rng.int(8, 13), py = beamY - 8 + rng.int(0, 4), ph = rng.int(5, 8);
    const pc = rng.pick([QP.canvas, QP.tarp, R('#3a0e08', '#5e1a10', '#8a2a1a', '#b03c24', '#cc5a36', '#e48256'), QP.tarpGreen].filter(r => r !== tarp));
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) if (b.opaque(x, y) && b.opaque(x, y + 1) && b.opaque(x, y - 1)) b.set(x, y, dpick(pc, 3.2 - (x - px) / pw, x, y));
    for (let x = px - 1; x <= px + pw; x += 2) { if (b.opaque(x, py - 1)) b.set(x, py - 1, pc[5]); if (b.opaque(x + 1, py + ph)) b.set(x + 1, py + ph, pc[5]); }
  }
  // guy ropes out to pegs
  b.line(4, beamY - 8, 0, base, QP.rope[3]); b.line(92, beamY - 8, 95, base, QP.rope[3]);
  // the chalk price board on the right pole
  const pbx = 70, pby = beamY + 14;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 22; x++) b.set(pbx + x, pby + y, x === 0 || y === 0 || x === 21 || y === 14 ? VP.wood[3] : dpick(R('#101412', '#1a201c', '#242c26', '#2e3830', '#3a443c', '#465048'), 2.4, pbx + x, pby + y));
  const price: Record<StallKind, [string, string]> = { fish: ['IKA', '$5'], fruit: ['3 FOR', '$2'], woven: ['KETE', '$20'] };
  const CH = [hex('#ece8dc'), hex('#d8d4c8'), hex('#c8c4b8')];
  letters(b, pbx + 3, pby + 2, price[kind][0], 3, { col: CH, wobble: 0.3, wear: 0.08, seed });
  letters(b, pbx + 3, pby + 8, price[kind][1], 3, { col: CH, wobble: 0.3, wear: 0.08, seed: seed + 1 });
  b.set(pbx + 11, pby - 1, QP.rope[3]); b.set(pbx + 10, pby - 2, QP.rope[3]);
  return S(b, cx, base);
}
/** what hangs from a stall's beam: a hand of bananas, an eel, a kete (anchored at the top: it swings) */
export function hanging(kind: 'bananas' | 'eel' | 'kete', seed: number): Sprite {
  const rng = new Rng(seed * 107 + 1);
  if (kind === 'bananas') {
    const W = 16, H = 20, b = new PixelBuffer(W, H);
    for (let y = 0; y < 4; y++) b.set(8, y, VP.wood[3]);
    for (let r2 = 0; r2 < 4; r2++) for (let i = 0; i < 4 - (r2 === 3 ? 1 : 0); i++) {
      const bx = 3 + i * 3 + (r2 % 2), by = 4 + r2 * 4;
      for (let t = 0; t < 6; t++) { const X = bx + Math.round(Math.sin(t / 5 * Math.PI) * -1), Y = by + t; b.set(X, Y, dpick(rng.chance(0.3) ? R('#3a3206', '#62540c', '#8e7c14', '#bca42a', '#dcc840', '#f4e47a') : QP.banana, 3.6 - i * 0.4 + (t === 5 ? -1.5 : 0), X, Y)); b.set(X + 1, Y, dpick(QP.banana, 2.6 - i * 0.3, X + 1, Y)); }
    }
    return S(b, 8, 0);
  }
  if (kind === 'eel') {
    const W = 8, H = 34, b = new PixelBuffer(W, H);
    b.set(4, 0, QP.rope[3]); b.set(4, 1, QP.rope[3]);
    for (let y = 2; y < H - 1; y++) { const X = 3 + Math.round(Math.sin(y * 0.25) * 1.2); for (let k = 0; k < 3; k++) b.set(X + k, y, dpick(R('#0c0e08', '#1a1e12', '#2a301c', '#3e4628', '#565e38', '#78804e'), 3.4 - k * 1.1 + (k === 0 && y % 4 === 0 ? 1 : 0), X + k, y)); }
    b.set(4, 4, hex('#c8c0a0'));
    return S(b, 4, 0);
  }
  const W = 16, H = 20, b = new PixelBuffer(W, H);
  for (let k = 0; k < 6; k++) { b.set(4 + k, Math.round(3 - Math.sin(k / 5 * Math.PI) * 3) + 1, QP.husk[2]); }
  for (let y = 4; y < 16; y++) { const hw = y < 6 ? 5 : 6 - (y > 13 ? 1 : 0); for (let x = -hw; x <= hw; x++) { const X = 7 + x, Y = y; const a = Math.floor((X + Y) / 2), c = Math.floor((X - Y + 99) / 2), over = (a + c) % 2 === 0; const band = Math.abs(y - 9 - (seed % 3)) < 1; b.set(X, Y, dpick(band ? (seed % 2 ? R('#100c08', '#1e1610', '#2c2218', '#3a2e20', '#4a3c2a', '#5c4c36') : VP.ochre) : R('#4a3e1a', '#6e5c28', '#927a38', '#b49a4c', '#ccb466', '#e2cc84'), (over ? 3.6 : 2.6) - x / hw, X, Y)); } }
  return S(b, 7, 0);
}

// ------------------------------------------------------------------ the houses behind the lane
/**
 * The bank the lane was cut into (the mid layer): a grassy lip, ragged, tufts standing up off it; the
 * cut face of the earth below with stones and roots in it, a dry-stone retaining wall where a house
 * stands on top, a flight of slab steps up.
 */
export function bank(w: number, h: number, seed: number, walls: [number, number][] = [], steps: number[] = []): Sprite {
  const rng = new Rng(seed * 7 + 5);
  const H = h + 8, b = new PixelBuffer(w, H), base = H - 1;
  const GRS = R('#142410', '#1e3816', '#2c4e1e', '#3e6826', '#548430', '#70a03c');
  const top = (x: number) => 8 + Math.round((noise1(x * 0.021, seed) - 0.5) * 6 + (noise1(x * 0.11, seed + 1) - 0.5) * 2);
  for (let x = 0; x < w; x++) {
    const t0 = top(x);
    for (let y = t0; y <= base; y++) {
      const d = y - t0;
      let c: C;
      if (d < 3) c = dpick(GRS, 4.2 - d * 0.9 - (x / w) * 0.4, x, y);
      else {
        const stone = fbm2(x * 0.16, y * 0.22, 2, seed + 3) > 0.7;
        c = stone ? dpick(VP.stone, 3.4 - (fbm2(x * 0.16, (y - 1) * 0.22, 2, seed + 3) > 0.7 ? 0.8 : -0.4), x, y) : dpick(VP.soil, 3.2 - d * 0.06 + (Math.sin(x * 0.7 + y * 0.3) > 0.92 ? -1.2 : 0), x, y);
        if (d < 6 && h01(x, y, seed) < 0.12) c = GRS[1];
      }
      b.set(x, y, c);
    }
    // grass standing up off the lip, roots hanging down the face
    if (rng.chance(0.55)) { const hh = rng.int(1, 4); for (let k = 1; k <= hh; k++) b.set(x, t0 - k, GRS[clamp(5 - k, 2, 5)]); }
    if (rng.chance(0.03)) { const len = rng.int(4, 10); for (let k = 0; k < len; k++) b.set(x + Math.round(Math.sin(k * 0.6) * 1), t0 + 3 + k, VP.bark[2]); }
  }
  for (const [a, z] of walls) stones(b, a, z, 10, base, VP.stone, seed + a, 7);
  for (const sx of steps) for (let i = 0; i < 6; i++) { const y = base - i * 5 - 4; for (let x = sx + i * 3; x < sx + i * 3 + 14; x++) for (let k = 0; k < 3; k++) b.set(x, y + k, dpick(VP.stone, 4 - k * 1.1 - (x - sx) * 0.03, x, y + k)); }
  return S(b, 0, base);
}

/**
 * Houses behind the lane (the mid layer), painted complete because the roofs and the gaps between
 * front buildings show them: 0 a weatherboard cottage under a red iron roof, a brick chimney, a water
 * tank on its stand; 1 a fale; 2 a packing shed of rusted iron, crates in its mouth; 3 a cottage with
 * a hipped green roof and a lean-to. Lamplit windows in the glow.
 */
export function midHouse(v: number, seed: number): Sprite {
  const rng = new Rng(seed * 109 + v);
  if (v === 1) return fale(seed + 50);
  const W = 150, H = 112, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H), base = H - 1;
  if (v === 2) {
    const x0 = 20, x1 = 130, wt = base - 56;
    corrugated(b, x0, wt, x1 - x0, 57, seed, { rust: 0.6 });
    for (let y = 0; y < 30; y++) { const hw = (y / 30) * 64; for (let x = -hw; x <= hw; x++) { const X = Math.round(75 + x), Y = wt - 30 + y; b.set(X, Y, dpick(noise1(X * 0.1, seed) > 0.6 ? VP.rust : VP.iron, 3 - x / 64 + ((X % 4) < 2 ? 0.5 : -0.5), X, Y)); } }
    for (let y = base - 34; y <= base; y++) for (let x = 50; x < 100; x++) b.set(x, y, hex('#0e0a08'));
    for (let i = 0; i < 4; i++) { const c = crate(14, 9, seed + i, i % 2 ? 'cabbage' : null); b.blit(c.buf, 54 + (i % 2) * 18 + (i > 1 ? 7 : 0), base - c.ay - (i > 1 ? 10 : 0), false, false); }
    return withGlow(b, g, 75, base);
  }
  const x0 = v === 0 ? 24 : 18, x1 = v === 0 ? 112 : 124, wt = base - 48;
  const paint = v === 0 ? QP.paint : R('#2a3a44', '#3e5462', '#567080', '#728c9a', '#94aab4', '#b8ccd2');
  weatherboard(b, x0, wt, x1 - x0, 49, paint, seed);
  const roof = v === 0 ? R('#2a0806', '#4e100c', '#761c14', '#9a2c1e', '#b8442c', '#d0603e') : R('#0e1e14', '#16301e', '#20442a', '#2c5838', '#3a6c46', '#4c8258');
  const rh = v === 0 ? 34 : 26, cx = Math.round((x0 + x1) / 2), half = (x1 - x0) / 2 + 8;
  for (let y = 0; y < rh; y++) {
    const hw = v === 0 ? (y / rh) * half : Math.min(half, half * 0.35 + (y / rh) * half * 0.65);
    for (let x = -hw; x <= hw; x++) { const X = Math.round(cx + x), Y = wt - rh + y; b.set(X, Y, dpick(roof, 3.4 - x / half - y / rh * 0.4 + ((X % 5) === 0 ? -0.8 : 0) + (noise1(X * 0.2 + Y * 0.1, seed) > 0.75 ? -0.8 : 0), X, Y)); }
  }
  for (let x = Math.round(cx - half); x <= cx + half; x++) b.set(x, wt, hex('#140c08'));
  // a chimney
  const chx = v === 0 ? cx + 18 : cx - 26;
  for (let y = wt - rh - 6; y < wt - rh * 0.4; y++) for (let x = 0; x < 7; x++) b.set(chx + x, y, (y + (Math.floor(x / 3) % 2) * 2) % 4 === 0 ? hex('#6a5a4a') : dpick(R('#3a140c', '#5a2014', '#7a301e', '#9a422a', '#b45a3a', '#c8764e'), 3.4 - x * 0.35, chx + x, y));
  // the door and windows
  windowPane(b, g, x0 + 10, wt + 12, 14, 14, QP.paint, seed + 1, { curtain: v ? hex('#e8c060') : hex('#d86a6a') });
  windowPane(b, g, x1 - 26, wt + 12, 14, 14, QP.paint, seed + 2, { curtain: v ? hex('#e8c060') : hex('#7aa0d8') });
  const dx = cx - 6;
  for (let y = base - 30; y <= base; y++) for (let x = dx; x < dx + 13; x++) b.set(x, y, dpick(v ? R('#3a1a0a', '#5a2a14', '#7a3e1e', '#9a5428', '#b46c38', '#c88650') : R('#16261c', '#223a2a', '#2e4e38', '#3c644a', '#4e7a5c', '#669470'), 2.8 + ((x - dx) === 1 || (base - y) % 15 === 2 ? 0.8 : 0), x, y));
  b.set(dx + 10, base - 15, hex('#c8a040'));
  for (let x = x0 - 4; x < x1 + 4; x++) for (let y = base - 2; y <= base; y++) b.set(x, y, dpick(VP.wood, 3.4 - (y - base + 2), x, y));
  if (v === 0) {
    // the water tank: a corrugated drum on a timber stand
    const tx = x1 + 6;
    for (const lx of [tx + 2, tx + 22]) for (let y = base - 18; y <= base; y++) { b.set(lx, y, VP.wood[3]); b.set(lx + 1, y, VP.wood[2]); }
    for (let x = tx; x < tx + 26; x++) b.set(x, base - 18, VP.wood[4]);
    for (let y = base - 46; y < base - 18; y++) for (let x = tx; x < tx + 26; x++) { const nx = (x - tx - 12.5) / 13; b.set(x, y, dpick(QP.galv, 3.4 - nx * 1.6 + ((y - base) % 3 === 0 ? 0.7 : -0.2), x, y)); }
    for (let x = tx + 2; x < tx + 24; x++) b.set(x, base - 47, QP.galv[2]);
    for (let y = base - 46; y < base - 30; y++) b.set(tx + 4, y, VP.rust[3]);
  } else {
    // a lean-to of iron off the side
    corrugated(b, x1, base - 30, 22, 31, seed + 5, { rust: 0.5 });
  }
  return withGlow(b, g, cx, base);
}
export { mix, shade, dpick, pick, h01 };

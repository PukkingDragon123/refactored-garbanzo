// V12 Te Ara Matatū, chapters 1 to 3: the props (the scenes: src/game/v12/arc/ch1.ts, ch2.ts, ch3.ts).
// Every one is painted pixel by pixel from a height field or hand-shaped silhouette: irregular outlines,
// form light from the top left, Worley-cracked stone, grain, moss and lichen, never a primitive shape.
//
//   carvedStone   a standing stone of the Old Pā, chipped and lichened, a koru spiral cut into its face
//                 with a pāua-shell eye at its heart (big: the lantern geckos' waystone in the valley)
//   STONE_EYE     where that eye is on the stone (from its anchor), for the scene's light fleck
//   sunFleck      the sliver of sun that comes through the watcher's gaze and lands on the stone
//   whare         the sealed whare dug into the top terrace: a thatched gable on carved maihi with the
//                 koruru face at the apex, carved amo posts, a lintel with three empty eye sockets, the
//                 earth bank round it. Open, the room behind the door (src/art/v11/village/interior.ts)
//   whareDoor     the stone slab that seals it (sinks into its slot when it opens)
//   WHARE         the door, the sockets and the size, from the anchor
//   rock          a falling chunk of the roof: angular, faceted, cracked (sizes 5..18)
//   rubbleHeap    the cave-in's heap of broken stone and earth, roots sticking out
//   boneTip       a curve of fossil bone just showing in disturbed earth (a dig site), and dug: the pit
//   giantSkull    the skull of the old taniwha laid out from its four pieces, the seams showing; its
//                 empty socket holds a mineral that still glows
//   lanternLog    a hollow fallen log glowing with fungus inside (a hiding place in the glow forest)

import { PixelBuffer } from '../../pixel';
import { hex, mix } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Rng, bayer, clamp } from '../../../core/math';
import { paintDoorway } from '../../v11/village/interior';

const R = (...h: string[]): C[] => h.map(v => hex(v));
const pick = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];
/** a ramp pick with an ordered dither between its steps */
const dp = (r: C[], v: number, x: number, y: number) => pick(r, v + (bayer(x, y) - 0.5) * 0.85);
const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
function vn(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h01(xi, yi, s), b = h01(xi + 1, yi, s), c = h01(xi, yi + 1, s), d = h01(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, s: number) => vn(x, y, s) * 0.55 + vn(x * 2.1, y * 2.1, s + 7) * 0.3 + vn(x * 4.3, y * 4.3, s + 13) * 0.15;
function worley(x: number, y: number, sx: number, sy: number, s: number) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const px = (cx + 0.15 + h01(cx, cy, s) * 0.7) * sx, py = (cy + 0.15 + h01(cx, cy, s + 1) * 0.7) * sy;
    const d = Math.hypot((x - px) / sx, (y - py) / sy);
    if (d < f1) { f2 = f1; f1 = d; id = h01(cx, cy, s + 2); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}
/** light from a height field's slope (key light top-left-front), 0..1 */
const slopeL = (gx: number, gy: number) => {
  const l = Math.hypot(gx, gy, 1);
  return clamp(0.5 + (-gx * -0.55 + -gy * -0.7 + 0.45) / l * 0.62 - 0.28, 0, 1);
};

export const AP = {
  stone: R('#16171a', '#26272a', '#3a3a3a', '#504e4a', '#6a665e', '#867f72', '#a49a88', '#c2b8a2'),
  stoneW: R('#1c1610', '#2e261c', '#443a2c', '#5c503e', '#766852', '#928468', '#b0a284', '#cec2a4'),
  lichen: R('#4a4a26', '#6e6e36', '#94924a', '#bab664', '#d8d488'),
  moss: R('#0e1a08', '#1c300e', '#2e4a14', '#46681c', '#64882a', '#86a83c'),
  ochre: R('#3a0e08', '#5e1a0e', '#842a16', '#a63e20'),
  paua: R('#0e1c3a', '#164a6a', '#1e7a7a', '#3aa08a', '#6a6ab0', '#9ad8e0', '#e6fff8'),
  wood: R('#140c08', '#24160e', '#3a2618', '#523822', '#6c4c30', '#886440', '#a68058'),
  woodG: R('#1e1c18', '#34302a', '#4c463c', '#665e52', '#82786a', '#a09486', '#beb4a4'),
  thatch: R('#1e1608', '#36280e', '#524016', '#6e5820', '#8c722e', '#aa8e42', '#c8ac60'),
  earth: R('#0e0a06', '#1a120a', '#2a1e12', '#3c2c1a', '#503c24', '#6a5030', '#866a40'),
  root: R('#1a100a', '#2e1e12', '#48301c', '#644428'),
  bone: R('#3a3020', '#5e4e34', '#857050', '#a89070', '#c8b290', '#e2d0ae', '#f6ead0'),
  boneD: R('#2a2216', '#463a26'),
  glow: R('#0a3a3a', '#2a8a86', '#6adcd0', '#c8fff4'),
  fungus: R('#2a3a3a', '#4a7a70', '#7ac8b4', '#c0ffee'),
};
const INK = hex('#0e0a08');

/** outline every transparent pixel next to the art in a deep tone of its neighbour (lit side lighter) */
function outline(b: PixelBuffer, skip?: (x: number, y: number) => boolean) {
  const W = b.w, H = b.h, src = b.data.slice();
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (src[y * W + x] >>> 24) > 100;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (op(x, y) || (skip && skip(x, y))) continue;
    let c = 0;
    if (op(x, y + 1)) c = src[(y + 1) * W + x];
    else if (op(x + 1, y)) c = src[y * W + x + 1];
    else if (op(x - 1, y)) c = src[y * W + x - 1];
    else if (op(x, y - 1)) c = src[(y - 1) * W + x];
    if (!c) continue;
    b.set(x, y, mix(c, INK, op(x, y + 1) || op(x + 1, y) ? 0.72 : 0.84));
  }
}

// ================================================================== the carved standing stones

export interface CarvedStone extends Sprite { eye: [number, number] }
/** the eye on a carved stone, from its anchor (bottom middle), for the given size */
export const STONE_EYE = (big = false): [number, number] => (big ? [-2, -40] : [-1, -31]);

/**
 * A standing stone (big: the waystone), its face carved with a koru spiral round a pāua eye.
 * Anchor: the middle of its foot.
 */
export function carvedStone(seed: number, big = false): CarvedStone {
  const W = big ? 46 : 32, H = big ? 66 : 50;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, base = H - 2;
  const [ex0, ey0] = STONE_EYE(big);
  const ex = cx + ex0, ey = base + ey0;
  // the silhouette: a slab that leans a little, wider at the foot, its top a broken, rounded edge
  const lean = (h01(1, 2, seed) - 0.5) * 3;
  const half = (y: number) => {
    const t = (base - y) / (H - 6);
    const w0 = (big ? 19 : 13) * (1 - t * 0.22) + Math.sin(t * 5 + seed) * 0.8 + (vn(y * 0.3, 1, seed) - 0.5) * 2.2;
    const top = t > 0.82 ? Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.2) ** 2)) : 1;
    return w0 * top;
  };
  const inside = (x: number, y: number) => {
    const mid = cx + lean * (base - y) / H;
    const hw = half(y);
    // chips knocked out of the edges
    const chip = h01(Math.floor(y / 3), x < mid ? 0 : 1, seed + 9) > 0.86 ? 1.6 : 0;
    return Math.abs(x + 0.5 - mid) < hw - chip;
  };
  // the height field: a domed slab, the carving cut into it
  const R0 = big ? 13 : 9.5;
  const z = (x: number, y: number) => {
    if (!inside(x, y)) return -4;
    const mid = cx + lean * (base - y) / H, hw = Math.max(1, half(y));
    let h = Math.sqrt(Math.max(0, 1 - ((x + 0.5 - mid) / hw) ** 2)) * 3 + fbm(x * 0.25, y * 0.25, seed) * 1.6;
    // the koru: a spiral groove round the eye, its arm sweeping down into a long curl
    const dx = x + 0.5 - ex, dy = (y + 0.5 - ey) * 1.08, r = Math.hypot(dx, dy);
    if (r < R0 + 2) {
      const th = Math.atan2(dy, dx) + (seed % 2 ? 0 : Math.PI);
      // distance to the nearest turn of the spiral r = a + b * theta
      const bb = (big ? 3.4 : 2.6) / (Math.PI * 2);
      let best = 9;
      for (let k = -1; k < 5; k++) { const rr = 2 + bb * (th + Math.PI + k * Math.PI * 2); if (rr > 0) best = Math.min(best, Math.abs(r - rr)); }
      if (r > 2 && r < R0 && best < 0.8) h -= 2.2;
      else if (r > 2 && r < R0 && best < 1.35) h += 0.5;
    }
    // the rim of the eye socket
    if (r < 2.4 && r > 1.4) h += 0.6;
    // a second carved band across the foot: notched teeth (pākati)
    const by = base - (big ? 14 : 9);
    if (Math.abs(y - by) < 2) h += (x % 3 === 0 ? -0.9 : 0.4);
    return h;
  };
  const ochreAt = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const gx = (z(x + 1, y) - z(x - 1, y)) * 0.5, gy = (z(x, y + 1) - z(x, y - 1)) * 0.5;
    let l = slopeL(gx * 1.3, gy * 1.3) * 6.2 + 0.4;
    const zz = z(x, y);
    // cracks: the stone splits along cells
    const w = worley(x, y, 9, 13, seed + 3);
    const crack = w.f2 - w.f1 < 0.06 && h01(Math.floor(w.id * 99), 0, seed) > 0.35;
    let ramp = fbm(x * 0.12, y * 0.09, seed + 4) > 0.52 ? AP.stoneW : AP.stone;
    if (crack) l -= 2.4;
    // weathering: darker toward the foot (damp), streaks running down
    l -= Math.max(0, (y - (base - 10)) / 10) * 1.1;
    if (vn(x * 0.9, y * 0.08, seed + 5) > 0.72) l -= 0.7;
    // red ochre left in the deepest grooves
    if (zz < 0.6 && Math.hypot(x + 0.5 - ex, y + 0.5 - ey) < R0 && Math.hypot(x + 0.5 - ex, y + 0.5 - ey) > 2.5) { ramp = AP.ochre; l = 1.5 + slopeL(gx, gy) * 2; ochreAt.add(y * W + x); }
    b.set(x, y, dp(ramp, l, x, y));
    // lichen rosettes on the lit face, moss on the top and down the shaded side
    const lich = vn(x * 0.6, y * 0.6, seed + 6) * 0.7 + h01(x, y, seed + 6) * 0.3;
    if (lich > 0.78 && !ochreAt.has(y * W + x) && zz > 1.2) b.set(x, y, dp(AP.lichen, 1 + (lich - 0.78) * 14 + (gx < 0 ? 0.6 : 0), x, y));
    const topY = (() => { let t = y; while (t > 0 && inside(x, t - 1)) t--; return t; })();
    const mossD = y - topY;
    if (mossD < 2 + vn(x * 0.4, 3, seed + 8) * 4 || (x > cx + 3 && vn(x * 0.5, y * 0.2, seed + 10) > 0.7)) b.set(x, y, dp(AP.moss, 2.2 + (mossD < 1 ? 1.4 : 0) + (gx < 0 ? 0.6 : -0.4) + h01(x, y, seed) * 0.8, x, y));
  }
  // the pāua eye: a lozenge of shell, its blues and greens and a violet flash, a white glint
  const pw = big ? 3 : 2;
  for (let y = -pw + 1; y <= pw - 1; y++) for (let x = -pw; x <= pw; x++) {
    if (Math.abs(x) / pw + Math.abs(y) / (pw - 0.4) > 1.15) continue;
    const v = h01(x + 9, y + 9, seed) * 3 + (x + y < 0 ? 2.5 : 0.5) + (x === 0 ? 1 : 0);
    b.set(Math.floor(ex) + x, Math.floor(ey) + y, pick(AP.paua, v));
  }
  b.set(Math.floor(ex) - 1, Math.floor(ey) - 1, AP.paua[6]);
  outline(b);
  // a few blades of grass and a fern at its foot
  for (let i = 0; i < (big ? 14 : 9); i++) {
    const gx0 = Math.round(cx - half(base) - 2 + h01(i, 3, seed) * (half(base) * 2 + 4)), hgt = 2 + Math.floor(h01(i, 4, seed) * 4);
    const bend = h01(i, 5, seed) > 0.5 ? 1 : -1;
    for (let k = 0; k < hgt; k++) b.set(gx0 + (k > hgt / 2 ? bend : 0), base + 1 - k, pick(AP.moss, 1.5 + k * 0.8));
  }
  return { buf: b, ax: Math.round(cx), ay: base + 1, eye: [ex - Math.round(cx), ey - (base + 1)] };
}

/** the sun through the watcher's gaze: a hand-cut sliver of light (drawn emissive, additive) */
export function sunFleck(): Sprite {
  const W = 9, H = 7, b = new PixelBuffer(W, H);
  const rows = ['...aa....', '..abba...', '.abccba..', 'abcccbba.', '.abccba..', '..abba...', '...a.....'];
  const col: Record<string, C> = { a: hex('#8a5a1e'), b: hex('#f0b450'), c: hex('#fff2c4') };
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') b.set(x, y, col[r[x]]); });
  return { buf: b, ax: 4, ay: 3 };
}

// ================================================================== the sealed whare

export const WHARE = { w: 112, h: 84, doorX: 0, doorW: 22, doorH: 32, sockets: [-8, 0, 8] as number[], socketY: -38 };

/**
 * The whare dug into the terrace bank, door sealed (or open: the room behind it lit by the doorway).
 * Anchor: the middle of the threshold.
 */
export function whare(seed: number, open = false): Sprite {
  const W = WHARE.w, H = WHARE.h, b = new PixelBuffer(W, H);
  const cx = W / 2, base = H - 2;
  const apexY = 6, eaveY = 44, halfW = 46;
  const dW = WHARE.doorW, dH = WHARE.doorH, dx0 = Math.round(cx - dW / 2), dy0 = base - dH;
  // ---- the earth bank behind and round it, roots and ferns in it
  for (let y = 10; y <= base; y++) for (let x = 0; x < W; x++) {
    const t = Math.abs(x - cx) / (W / 2);
    const top = 14 + t * t * 26 + (vn(x * 0.12, 1, seed) - 0.5) * 8;
    if (y < top) continue;
    const l = 2.6 - (y - top) * 0.05 + (vn(x * 0.3, y * 0.3, seed + 1) - 0.5) * 1.6 + (y - top < 2 ? 1 : 0);
    b.set(x, y, dp(AP.earth, l, x, y));
    if (y - top < 3 + vn(x * 0.2, 2, seed + 2) * 3) b.set(x, y, dp(AP.moss, 2 + (y - top < 1 ? 1.3 : 0) + h01(x, y, seed) * 0.8, x, y));
  }
  // roots crawling out of the bank
  const rng = new Rng(seed * 13 + 1);
  for (let i = 0; i < 7; i++) {
    let x = rng.range(4, W - 4), y = rng.range(20, 50);
    const dir = x < cx ? -1 : 1;
    for (let k = 0; k < 18; k++) {
      x += dir * rng.range(0.3, 1.2); y += rng.range(0.4, 1.3);
      if (Math.abs(x - cx) < halfW - 6 && y < base) continue;
      if (x < 0 || x >= W || y >= H) break;
      b.set(Math.round(x), Math.round(y), pick(AP.root, 2 + (k % 3 === 0 ? 1 : 0)));
      b.set(Math.round(x), Math.round(y) + 1, AP.root[0]);
    }
  }
  // ---- the thatch roof behind the maihi: raupō bundles in rows, mossed, a fern on the ridge
  const roofIn = (x: number, y: number) => y >= apexY + 2 && y <= eaveY + 2 && Math.abs(x - cx) <= (y - apexY) * (halfW / (eaveY - apexY)) + 2;
  for (let y = apexY; y <= eaveY + 2; y++) for (let x = 0; x < W; x++) {
    if (!roofIn(x, y)) continue;
    const row = Math.floor((y - apexY) / 4);
    const strand = Math.sin(x * 1.7 + row * 2.1) * 0.6 + (h01(x, row, seed) - 0.5) * 1.2;
    let l = 3.4 - ((y - apexY) % 4) * 0.45 + strand + (x < cx ? 0.5 : -0.4);
    if ((y - apexY) % 4 === 3) l -= 1.2;
    let r = AP.thatch;
    if (vn(x * 0.15, y * 0.2, seed + 3) > 0.62) { r = AP.moss; l += 0.3; }
    b.set(x, y, dp(r, l, x, y));
  }
  // ---- the porch back wall: weathered vertical planks, the light falling off into the porch
  for (let y = eaveY - 10; y <= base; y++) for (let x = Math.round(cx - halfW + 8); x <= Math.round(cx + halfW - 8); x++) {
    if (y < eaveY - 10 + Math.abs(x - cx) * ((eaveY - apexY) / halfW) * 0) continue;
    if (!(y > (apexY + 6) + Math.abs(x - cx) * ((eaveY - apexY) / halfW))) continue;
    const plank = Math.floor((x - 2) / 5);
    const seam = (x - 2) % 5 === 0;
    let l = 3 - (y - eaveY + 10) * 0.02 + (h01(plank, 0, seed) - 0.5) * 1 + vn(x * 0.5, y * 0.08, seed + 4) * 0.8 - 1.0;
    if (seam) l -= 1.6;
    b.set(x, y, dp(AP.woodG, l, x, y));
  }
  // tukutuku-like lattice panels each side of the door: crossed flax over dark slats
  for (const side of [-1, 1]) {
    const px0 = side < 0 ? Math.round(cx - halfW + 12) : Math.round(cx + dW / 2 + 5), px1 = side < 0 ? Math.round(cx - dW / 2 - 5) : Math.round(cx + halfW - 12);
    for (let y = base - 26; y <= base - 4; y++) for (let x = px0; x <= px1; x++) {
      const cross = (x + y) % 4 === 0 || (x - y + 400) % 4 === 0;
      b.set(x, y, cross ? dp(AP.thatch, 4 + (y % 2), x, y) : dp(AP.wood, 1.2, x, y));
    }
  }
  // ---- the door: the slab (sealed: drawn by whareDoor on top) or the room behind it
  if (open) {
    paintDoorway(b, dx0, dy0, dW, dH, 'meeting', seed);
  } else {
    for (let y = dy0; y <= base; y++) for (let x = dx0; x < dx0 + dW; x++) b.set(x, y, dp(AP.earth, 0.6, x, y));
  }
  // ---- the lintel (pare) over the door: carved, three eye sockets in a row
  const lx0 = dx0 - 5, lx1 = dx0 + dW + 4, ly0 = dy0 - 9, ly1 = dy0 - 1;
  for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) {
    const groove = (y === ly0 + 2 || y === ly1 - 2) && x % 2 === 0;
    let l = 4 - (y - ly0) * 0.25 + vn(x * 0.4, y * 0.6, seed + 5) * 0.8 - (groove ? 1.6 : 0);
    b.set(x, y, dp(AP.wood, l, x, y));
  }
  for (const sx of WHARE.sockets) {
    const scx = Math.round(cx + sx), scy = base + WHARE.socketY;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const d = Math.hypot(x, y * 1.2);
      if (d > 2.4) continue;
      b.set(scx + x, scy + y, d < 1.3 ? AP.wood[0] : y < 0 ? AP.wood[1] : AP.wood[5]);
    }
  }
  // ---- the carved amo (posts) each side of the porch, figures stacked up them
  for (const side of [-1, 1]) {
    const ax0 = Math.round(cx + side * (halfW - 7)) - 3;
    for (let y = eaveY - 2; y <= base; y++) for (let x = ax0; x < ax0 + 7; x++) {
      const u = (x - ax0) / 6, fig = Math.floor((y - eaveY) / 11), fy = ((y - eaveY) % 11 + 11) % 11;
      let l = 4.2 - Math.abs(u - 0.35) * 3.2 + (side > 0 ? -0.5 : 0.2);
      // a figure every 11 px: the head (eyes as pāua dots), the hands on the belly
      if (fy === 2 && (x === ax0 + 2 || x === ax0 + 4)) { b.set(x, y, AP.paua[3 + (fig % 2)]); continue; }
      if (fy === 1 || fy === 6 || fy === 10) l -= 1.5;
      if (fy >= 7 && fy <= 8 && (x === ax0 + 1 || x === ax0 + 5)) l -= 1.2;
      if ((x === ax0 || x === ax0 + 6) && h01(x, y, seed + 6) > 0.6) l -= 1;
      b.set(x, y, dp(AP.wood, l, x, y));
      if (fy === 5 && x === ax0 + 3) b.set(x, y, AP.ochre[2]);
    }
  }
  // ---- the maihi (bargeboards) down from the apex, carved in a running spiral, ends in raparapa fingers
  for (const side of [-1, 1]) {
    for (let s = 0; s <= halfW + 4; s += 0.5) {
      const x = cx + side * s, yc = apexY + s * ((eaveY - apexY) / halfW);
      for (let k = -2; k <= 3; k++) {
        const px = Math.round(x), py = Math.round(yc + k);
        if (px < 0 || px >= W) continue;
        const spiral = Math.sin(s * 0.9 + k * 1.2) > 0.6 && k > -2 && k < 3;
        let l = 4.6 - (k + 2) * 0.45 + (side < 0 ? 0.3 : -0.3) - (spiral ? 1.7 : 0);
        if (k === -2) l += 0.9;
        b.set(px, py, dp(AP.wood, l, px, py));
        if (spiral && h01(px, py, seed) > 0.7) b.set(px, py, AP.ochre[1]);
      }
    }
    // raparapa: fingers hanging off the board's end
    const endX = Math.round(cx + side * (halfW + 4)), endY = Math.round(apexY + (halfW + 4) * ((eaveY - apexY) / halfW));
    for (let f = 0; f < 3; f++) for (let k = 0; k < 4 + f; k++) {
      const px = endX + side * (f * 2 - 1), py = endY + 3 + k;
      b.set(px, py, dp(AP.wood, 3.4 - k * 0.4, px, py));
    }
  }
  // ---- the koruru: a carved face at the apex, two big pāua eyes, the tongue out
  const kx = Math.round(cx), ky = apexY - 2;
  for (let y = 0; y < 13; y++) for (let x = -5; x <= 5; x++) {
    const hw = y < 3 ? 3 + y : y > 9 ? 5 - (y - 9) : 5;
    if (Math.abs(x) > hw) continue;
    let l = 4.3 - Math.abs(x) * 0.3 - y * 0.08 + (x < 0 ? 0.4 : -0.2);
    if ((y === 4 || y === 5) && (Math.abs(x) === 2 || Math.abs(x) === 3)) { b.set(kx + x, ky + y, AP.paua[y === 4 ? 5 : 3]); continue; }
    if (y === 3 && Math.abs(x) >= 1 && Math.abs(x) <= 4) l -= 1.6;
    if (y === 8 && Math.abs(x) <= 3) l -= 2;
    if (y >= 9 && Math.abs(x) <= 1) { b.set(kx + x, ky + y, AP.ochre[3 - (y - 9)] ?? AP.ochre[1]); continue; }
    b.set(kx + x, ky + y, dp(AP.wood, l, kx + x, ky + y));
  }
  // moss on the boards and a fern on the ridge
  for (let i = 0; i < 40; i++) {
    const x = Math.round(rng.range(cx - halfW, cx + halfW)), y = Math.round(apexY + Math.abs(x - cx) * ((eaveY - apexY) / halfW) - 2);
    if (x >= 0 && x < W && y >= 0 && rng.chance(0.6)) b.set(x, y, pick(AP.moss, rng.range(2, 5)));
  }
  for (let k = 0; k < 7; k++) { const fx = Math.round(cx + 6 + k), fy = apexY + 2 - Math.round(Math.sin(k * 0.5) * 4); b.set(fx, fy, AP.moss[4]); b.set(fx, fy + 1, AP.moss[2]); if (k % 2) b.set(fx, fy - 1, AP.moss[5]); }
  outline(b);
  return { buf: b, ax: Math.round(cx), ay: base + 1 };
}

/** the stone slab sealing the door: dressed stone, clay in the seams, a carved spiral. Anchor: bottom middle. */
export function whareDoor(seed: number): Sprite {
  const W = WHARE.doorW, H = WHARE.doorH, b = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x === 0 || x === W - 1) && (y === 0 || h01(x, y, seed) > 0.8)) continue;
    const w = worley(x, y, 7, 8, seed);
    let l = 4.2 - y * 0.05 - (x / W) * 1.2 + (fbm(x * 0.3, y * 0.3, seed) - 0.5) * 1.5;
    if (w.f2 - w.f1 < 0.08) l -= 2;
    const dx = x - W / 2, dy = y - H * 0.4, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const rr = 1.5 + (th + Math.PI) * 0.9;
    if (r < 8 && Math.abs(r - rr) < 0.7) l -= 1.6;
    if (r < 8 && Math.abs(r - rr - 0.9) < 0.5) l += 0.7;
    b.set(x, y, dp(AP.stoneW, l, x, y));
  }
  // the clay pressed round its edges
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) if (b.get(x, y) >>> 24 && h01(x, y, seed + 1) > 0.45) b.set(x, y, dp(AP.earth, 4.5, x, y));
  return { buf: b, ax: Math.floor(W / 2), ay: H };
}

// ================================================================== falling rock and rubble

/** a chunk of rock: an angular silhouette, flat facets lit differently, a crack, grit. Anchor: its centre. */
export function rock(seed: number, size = 10): Sprite {
  const S = Math.ceil(size) + 4, b = new PixelBuffer(S, S);
  const c = S / 2, rng = new Rng(seed * 7 + 3);
  const n = 6 + rng.int(0, 3);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const r = size * 0.5 * rng.range(0.62, 1);
    pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r * rng.range(0.75, 1)]);
  }
  const inPoly = (x: number, y: number) => {
    let ins = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const ramp = rng.chance(0.5) ? AP.stone : AP.stoneW;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!inPoly(x + 0.5, y + 0.5)) continue;
    // facets: each Worley cell is a flat face tilted its own way
    const w = worley(x, y, size * 0.45, size * 0.45, seed);
    const tilt = (w.id - 0.5) * 2.4;
    let l = 3.6 + tilt - ((x - c) + (y - c) * 1.2) / size * 2.2;
    if (w.f2 - w.f1 < 0.08) l -= 1.5;
    if (h01(x, y, seed + 1) > 0.9) l += 0.6;
    b.set(x, y, dp(ramp, l, x, y));
  }
  outline(b);
  return { buf: b, ax: Math.floor(c), ay: Math.floor(c) };
}

/** the heap the cave-in leaves: broken stone tumbled over earth, a root and a snapped timber sticking out. Anchor: bottom middle. */
export function rubbleHeap(seed: number, w = 120, h = 46): Sprite {
  const b = new PixelBuffer(w + 8, h + 4), cx = (w + 8) / 2, base = h + 2;
  const top = (x: number) => base - h * Math.max(0, 1 - ((x - cx) / (w / 2)) ** 2) ** 0.8 - (vn(x * 0.1, 0, seed) - 0.5) * 8;
  for (let y = 0; y <= base; y++) for (let x = 0; x < b.w; x++) {
    const t = top(x);
    if (y < t) continue;
    b.set(x, y, dp(AP.earth, 3.2 - (y - t) * 0.05 + (vn(x * 0.3, y * 0.3, seed) - 0.5) * 1.8, x, y));
  }
  const rng = new Rng(seed);
  // stones: big ones low, small ones scattered up the slope, each lit and outlined
  for (let i = 0; i < 46; i++) {
    const x = rng.range(cx - w * 0.45, cx + w * 0.45);
    const sz = rng.range(4, 13) * (1 - Math.abs(x - cx) / w);
    const t = top(Math.round(x));
    const y = rng.range(t + sz * 0.2, Math.min(base - 2, t + h * 0.6));
    const s = rock(seed * 31 + i, Math.max(4, sz));
    for (let yy = 0; yy < s.buf.h; yy++) for (let xx = 0; xx < s.buf.w; xx++) {
      const c = s.buf.get(xx, yy);
      if (c >>> 24 < 100) continue;
      const px = Math.round(x - s.ax + xx), py = Math.round(y - s.ay + yy);
      if (px >= 0 && py >= 0 && px < b.w && py <= base) b.set(px, py, c);
    }
  }
  // a snapped timber (the old ridge pole) and a root poking out
  for (let k = 0; k < 26; k++) { const x = Math.round(cx - 18 + k), y = Math.round(top(cx - 4) + 6 - k * 0.42); for (let j = 0; j < 3; j++) b.set(x, y + j, dp(AP.wood, 4 - j * 1.2, x, y + j)); }
  for (let k = 0; k < 14; k++) { const x = Math.round(cx + 24 + k * 0.6), y = Math.round(top(cx + 24) + 4 - k * 0.6 + Math.sin(k) * 0.6); b.set(x, y, AP.root[2]); }
  outline(b);
  return { buf: b, ax: Math.round(cx), ay: base + 1 };
}

// ================================================================== the bone in the earth

/** a curve of fossil bone just showing in disturbed earth (dug: an empty pit). Anchor: bottom middle. */
export function boneTip(seed: number, dug = false): Sprite {
  const W = 30, H = 14, b = new PixelBuffer(W, H), cx = W / 2, base = H - 2;
  // the disturbed earth: a low mound of crumbs, or the pit
  for (let y = 0; y <= base + 1; y++) for (let x = 0; x < W; x++) {
    const t = (x - cx) / (W / 2 - 1);
    if (Math.abs(t) > 1) continue;
    const top = base - (dug ? 2 : 4) * (1 - t * t) - (vn(x * 0.5, 0, seed) - 0.5) * 2;
    if (y < top) continue;
    let l = 3.4 - (y - top) * 0.35 + (h01(x, y, seed) - 0.5) * 1.4;
    if (dug && Math.abs(t) < 0.6 && y > top + 1) l = 0.6 + (y - top) * 0.1;
    b.set(x, y, dp(AP.earth, l, x, y));
  }
  if (!dug) {
    // the bone: a curve breaking the surface, pitted, with a darker stain where the earth lay
    const ang0 = 0.2 + h01(1, 1, seed) * 0.5;
    for (let t = 0; t <= 1; t += 0.04) {
      const x = cx - 8 + t * 16, y = base - 3 - Math.sin(t * Math.PI) * (5 + ang0 * 3);
      for (let k = -1.6; k <= 1.6; k += 0.5) {
        const px = Math.round(x), py = Math.round(y + k);
        let l = 4.5 - k * 0.8 + (h01(px, py, seed) > 0.85 ? -1.4 : 0);
        if (t < 0.12 || t > 0.88) l -= 1;
        b.set(px, py, dp(AP.bone, l, px, py));
      }
    }
    // a few loose crumbs and a split stone beside it
    for (let i = 0; i < 6; i++) b.set(Math.round(cx - 12 + h01(i, 2, seed) * 24), base - Math.round(h01(i, 3, seed) * 2), pick(AP.earth, 5));
  }
  outline(b);
  return { buf: b, ax: Math.round(cx), ay: base + 1 };
}

// ================================================================== the skull

/** the old taniwha's skull, laid out from its four pieces (the seams show), a glowing mineral in the socket. Anchor: bottom middle. */
export function giantSkull(seed = 5): Sprite {
  const W = 84, H = 36, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H);
  const base = H - 3;
  // the profile: a long low snout, the cranium swelling behind the big socket, a crest, the jaw under
  const topY = (x: number) => {
    const t = x / W;
    if (t < 0.06) return base - 6;
    if (t < 0.55) return base - 7 - t * 9 + Math.sin(t * 9) * 0.6;
    if (t < 0.8) return base - 12 - Math.sin((t - 0.55) / 0.25 * Math.PI) * 10;
    return base - 12 - (t - 0.8) * 30 * 0.4;
  };
  const botY = (x: number) => base - (x / W > 0.82 ? (x / W - 0.82) * 40 : 0);
  const sock = { x: W * 0.64, y: base - 15, r: 5.2 };
  const nostril = { x: W * 0.12, y: base - 7.5 };
  const fen = { x: W * 0.43, y: base - 9, rx: 5, ry: 2.6 };
  for (let y = 0; y < H; y++) for (let x = 2; x < W - 2; x++) {
    const t0 = topY(x), b0 = botY(x);
    if (y < t0 || y > b0) continue;
    const v = (y - t0) / Math.max(1, b0 - t0);
    let l = 4.8 - v * 2.6 + (x < W * 0.3 ? 0.3 : 0);
    // openings: the eye socket, the nostril, the window in the cheek
    const ds = Math.hypot(x - sock.x, (y - sock.y) * 1.1);
    if (ds < sock.r) { b.set(x, y, ds > sock.r - 1.2 ? AP.boneD[1] : AP.boneD[0]); continue; }
    if (Math.hypot(x - nostril.x, (y - nostril.y) * 1.6) < 1.8) { b.set(x, y, AP.boneD[0]); continue; }
    if (Math.hypot((x - fen.x) / fen.rx, (y - fen.y) / fen.ry) < 1) { b.set(x, y, AP.boneD[0]); continue; }
    if (ds < sock.r + 1.4 && y < sock.y) l += 1;
    // the jaw line, pitted bone, hairline cracks
    if (Math.abs(y - (base - 3)) < 0.6 && x < W * 0.8) l -= 2;
    if (h01(x, y, seed) > 0.9) l -= 1;
    if (vn(x * 0.3, y * 0.6, seed) > 0.7) l -= 0.7;
    b.set(x, y, dp(AP.bone, l, x, y));
  }
  // teeth along the jaw: hooked fangs, the long one near the front
  for (let x = 6; x < W * 0.62; x += 3) {
    const long = Math.abs(x - 12) < 2;
    const n = long ? 6 : 2 + (x % 2);
    for (let k = 0; k < n; k++) b.set(x - (k > 3 ? 1 : 0), base - 2 + k, pick(AP.bone, 5 - k * 0.6));
  }
  // the seams where the four pieces meet, a darker line of glue-earth
  for (const sx of [W * 0.24, W * 0.5, W * 0.78]) for (let y = 0; y < H; y++) {
    const x = Math.round(sx + Math.sin(y * 0.8 + sx) * 1.4);
    if (b.get(x, y) >>> 24 && !(Math.hypot(x - sock.x, y - sock.y) < sock.r)) b.set(x, y, AP.bone[1]);
  }
  // the glowing stone lodged in the socket
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    if (Math.abs(x) + Math.abs(y) > 3) continue;
    const c = pick(AP.glow, 3 - (Math.abs(x) + Math.abs(y)) * 0.8);
    b.set(Math.round(sock.x) + x, Math.round(sock.y) + 1 + y, c);
    g.set(Math.round(sock.x) + x, Math.round(sock.y) + 1 + y, c);
  }
  outline(b);
  return { buf: b, ax: Math.round(W / 2), ay: base + 1, glow: g };
}

// ================================================================== the glowing log (a hide in the glow forest)

/** a hollow fallen log, fungus glowing in its mouth and along its back. Anchor: bottom middle. */
export function lanternLog(seed: number, L = 70): Sprite {
  const W = L + 10, H = 26, b = new PixelBuffer(W, H), g = new PixelBuffer(W, H);
  const base = H - 2, D = 16, x0 = 4, x1 = x0 + L;
  for (let x = x0; x <= x1; x++) {
    const top = base - D + Math.round((vn(x * 0.1, 0, seed) - 0.5) * 3);
    for (let y = top; y <= base; y++) {
      const v = (y - top) / (base - top);
      let l = 3.6 - v * 2.6 - (Math.sin(y * 1.9 + vn(x * 0.15, y * 0.3, seed) * 3) > 0.55 ? 1 : 0);
      let r = AP.wood;
      if (vn(x * 0.08, y * 0.2, seed + 3) > 0.62) { r = AP.moss; l += 0.4; }
      b.set(x, y, dp(r, l, x, y));
    }
  }
  // the open end: a dark hollow ringed with soft wood
  const ecx = x1 - 3, ecy = base - D / 2;
  for (let y = -D / 2; y <= D / 2; y++) for (let x = -4; x <= 3; x++) {
    const d = Math.hypot(x / 4, y / (D / 2));
    if (d > 1) continue;
    b.set(ecx + x, ecy + y, d < 0.7 ? AP.earth[0] : dp(AP.wood, 4 - d * 2, ecx + x, ecy + y));
  }
  // fungus: little caps clustered along the back and deep in the mouth, their glow on its own layer
  const rng = new Rng(seed * 3 + 7);
  for (let i = 0; i < 16; i++) {
    const inMouth = i < 5;
    const fx = inMouth ? ecx + rng.int(-2, 1) : Math.round(rng.range(x0 + 6, x1 - 8)), fy = inMouth ? ecy + rng.int(-3, 3) : base - D + Math.round(vn(fx * 0.1, 0, seed) * 3 - 2);
    const c = pick(AP.fungus, rng.range(1.5, 3.4));
    b.set(fx, fy, c); b.set(fx + 1, fy, pick(AP.fungus, 2)); g.set(fx, fy, AP.fungus[3]); g.set(fx + 1, fy, AP.fungus[2]);
    if (!inMouth) { b.set(fx, fy + 1, AP.wood[5]); }
  }
  outline(b);
  return { buf: b, ax: Math.round(W / 2), ay: base + 1, glow: g };
}

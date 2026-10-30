// V12 Backpack scene artwork. First person: Mori kneels and looks down at his old canvas rucksack
// lying open on the ground of wherever he is. Everything is painted here at 1x art px (24 px per grid
// cell, the item art's own scale) and stacked up by the scene (src/ui/v12/pack/scene.ts):
//   paintGround    the ground filling the view, by biome: sand, shells and wrack on the beach; roots,
//                  leaf litter and moss in the forest; the trodden camp ground in the fire's glow; rock
//                  slabs, gravel and tussock in the hills; planks aboard; wet rock in a cave
//   paintPack      the open pack from above: the side panels flopped out, the rolled canvas collar with
//                  its leather binding, the 5x3 compartments sewn into the lining, the front wall with
//                  the strap receivers, the haul loop, a luggage tag. paintLoops is the webbing that
//                  goes over the tools hanging in the side loops
//   paintLidOpen / paintLidShut   the lid flap thrown back (its underside, the mesh pocket, the straps)
//                  and buckled shut over the opening (fern patch, scuffs, the straps clipped in)
//   paintTurn      the brass swivel on its strap tab (the turn button)
//   paintChest     the camp stash: the old sea chest, open, its floor chalked into a grid
//   paintKnee / paintHand   Mori's knees and hands at the edges of the view
//   paintSign      the trail marker plank (Set off) when packing up at camp
// Plain PixelBuffer painting: ramps lit from the top left, ordered dither, selective outlines. No
// smooth gradients anywhere: light and shade are bands with dithered edges.

import { PixelBuffer } from '../../../art/pixel';
import type { C } from '../../../art/color';
import { hex, mix, rgba, R, G, B, A } from '../../../art/color';
import { bayer } from '../../../core/math';
import { noise } from '../../laptop-kit';
import { pxTextBuf } from '../../pxfont';

const H = (s: string, a = 255): C => hex(s, a);
export const CELL = 24;
export interface Rect { x: number; y: number; w: number; h: number }
export type Biome = 'beach' | 'forest' | 'camp' | 'hills' | 'deck' | 'cave';
export type Tod = 'dawn' | 'day' | 'dusk' | 'night';

// ---------------------------------------------------------------- palettes
const CV = [H('#16150b'), H('#2b2c17'), H('#3f4223'), H('#53572f'), H('#686d3d'), H('#80854f'), H('#9a9e66'), H('#b3b67f')]; // olive canvas
const FADE = [H('#2c2d1b'), H('#3c3d26'), H('#56583a'), H('#6e714c'), H('#868a61'), H('#a0a37b')]; // sun-faded canvas
const LT = [H('#170b04'), H('#311809'), H('#4f2a12'), H('#6d3d1b'), H('#8b5427'), H('#a86f38'), H('#c48d50')]; // leather
const BR = [H('#2a1804'), H('#5e3c06'), H('#9a6a10'), H('#d29c1c'), H('#f6cc48'), H('#fff0a0')]; // brass
const LN = [H('#0d0c07'), H('#16150d'), H('#1e1d13'), H('#27261a'), H('#323022'), H('#3e3c2b'), H('#4a4734')]; // lining
const UNDER = [H('#2a2a1a'), H('#45452c'), H('#5d5d3c'), H('#76764e'), H('#8f8e62'), H('#a8a67a')]; // lid underside
const WEB = [H('#0e0f0a'), H('#1c1e14'), H('#2b2e1f'), H('#3c402b'), H('#4f5439')]; // nylon webbing
const IRON = [H('#141414'), H('#26282a'), H('#3a3e42'), H('#555a5e'), H('#767c80')];
const THREAD = H('#d6c38c'), THREAD2 = H('#a8935e');
const OUT = H('#120e07');

/** pick from a ramp with ordered dithering between steps */
export function rp(r: C[], t: number, x: number, y: number): C {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1);
  const i = Math.floor(f);
  return f - i > 0.2 + bayer(x, y) * 0.6 ? r[Math.min(r.length - 1, i + 1)] : r[i];
}
/** smooth value noise 0..1 at a given cell size */
export function vnoise(x: number, y: number, s: number, seed: number): number {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const a = noise(ix, iy, seed), b = noise(ix + 1, iy, seed), c = noise(ix, iy + 1, seed), d = noise(ix + 1, iy + 1, seed);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
const fbm = (x: number, y: number, s: number, seed: number) => vnoise(x, y, s, seed) * 0.6 + vnoise(x, y, s / 2, seed + 7) * 0.28 + vnoise(x, y, s / 4, seed + 13) * 0.12;
/** a seeded generator */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { f, r: (a0: number, b0: number) => a0 + (b0 - a0) * f(), i: (a0: number, b0: number) => Math.floor(a0 + (b0 - a0 + 1) * f()), pick: <T>(xs: T[]): T => xs[Math.floor(f() * xs.length)] };
}
/** canvas weave: a 2-tone twill plus slubs */
const weave = (x: number, y: number) => ((x + y * 2) % 4 === 0 ? -0.07 : (x * 3 + y) % 7 === 0 ? 0.04 : 0) + (noise(x, y, 31) > 0.97 ? 0.08 : 0);
const grain = (x: number, y: number) => (vnoise(x, y, 3, 41) - 0.5) * 0.18 + (noise(x, y, 43) > 0.95 ? -0.12 : 0);
const darkMix = (c: C, k: number, to = H('#0a0806')) => mix(c, to, k);

function roundRect(b: PixelBuffer, r: Rect, rad: number, fn: (x: number, y: number, u: number, v: number, edge: number) => C | -1) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const dx = Math.min(x - r.x, r.x + r.w - 1 - x), dy = Math.min(y - r.y, r.y + r.h - 1 - y);
    let edge = Math.min(dx, dy);
    if (dx < rad && dy < rad) {
      const cx = rad - 1 - dx, cy = rad - 1 - dy, d = Math.sqrt(cx * cx + cy * cy);
      if (d > rad - 0.5) continue;
      edge = Math.min(edge, Math.floor(rad - 0.5 - d));
    }
    const c = fn(x, y, (x - r.x) / Math.max(1, r.w - 1), (y - r.y) / Math.max(1, r.h - 1), edge);
    if (c !== -1) b.set(x, y, c);
  }
}
function rivet(b: PixelBuffer, x: number, y: number) {
  b.set(x, y, BR[5]); b.set(x + 1, y, BR[3]); b.set(x, y + 1, BR[3]); b.set(x + 1, y + 1, BR[1]);
  b.set(x + 2, y + 1, OUT); b.set(x + 1, y + 2, OUT); b.set(x + 2, y + 2, darkMix(OUT, 0.3));
}
/** a vertical strap (webbing or leather) with stitched edges */
function vstrap(b: PixelBuffer, x: number, y0: number, y1: number, w = 6, ramp: C[] = LT, lit = 0) {
  for (let y = y0; y <= y1; y++) for (let k = 0; k < w; k++) {
    const t = 0.58 + lit - (k / w) * 0.3 + (ramp === LT ? grain(x + k, y) : ((y + k) % 3 === 0 ? -0.06 : 0));
    b.set(x + k, y, k === 0 ? ramp[Math.min(ramp.length - 1, 5)] : k === w - 1 ? ramp[1] : rp(ramp, t, x + k, y));
  }
  for (let y = y0 + 1; y < y1; y += 2) { b.set(x + 1, y, ramp === LT ? LT[6] : THREAD2); b.set(x + w - 2, y + 1, ramp === LT ? LT[5] : THREAD2); }
  b.rect(x - 1, y0, 1, y1 - y0 + 1, OUT); b.rect(x + w, y0, 1, y1 - y0 + 1, darkMix(OUT, 0.2));
}
/** a horizontal strap with stitched edges */
function hstrap(b: PixelBuffer, x0: number, x1: number, y: number, h = 5, ramp: C[] = WEB, lit = 0) {
  for (let x = x0; x <= x1; x++) for (let k = 0; k < h; k++) {
    const t = 0.62 + lit - (k / h) * 0.32 + ((x + k * 2) % 4 === 0 ? -0.08 : 0);
    b.set(x, y + k, k === 0 ? ramp[ramp.length - 1] : k === h - 1 ? ramp[1] : rp(ramp, t, x, y + k));
  }
  b.rect(x0, y - 1, x1 - x0 + 1, 1, OUT); b.rect(x0, y + h, x1 - x0 + 1, 1, darkMix(OUT, 0.1));
  // bar-tacks where it is sewn down
  for (const xx of [x0 + 1, x1 - 2]) for (let k = 1; k < h - 1; k++) { b.set(xx, y + k, THREAD2); b.set(xx + 1, y + k, (k % 2) ? THREAD : THREAD2); }
}
/** a side-release clip (the strap's male end), pointing down (dir 1) or up (-1) */
function clip(b: PixelBuffer, cx: number, y: number, dir: 1 | -1, open = false) {
  const w = 8, h = 7;
  const x = cx - 4;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const yy = dir > 0 ? y + j : y - j;
    const tip = j >= h - 2 && (i === 0 || i === w - 1);
    if (tip) continue;
    const edge = i === 0 || i === w - 1 || j === h - 1 || (j === 0);
    const c = edge ? OUT : (i === 3 || i === 4) && j > 1 && j < h - 2 ? (open ? IRON[1] : IRON[2]) : rp(IRON, 0.75 - j * 0.06 - i * 0.03, i, j);
    b.set(x + i, yy, c);
  }
  b.set(x + 2, dir > 0 ? y + 1 : y - 1, IRON[4]);
}
/** a receiver buckle on the front wall */
function receiver(b: PixelBuffer, r: Rect) {
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const edge = x === 0 || y === 0 || x === r.w - 1 || y === r.h - 1;
    const inner = x > 2 && x < r.w - 3 && y > 2 && y < r.h - 2;
    b.set(r.x + x, r.y + y, edge ? OUT : inner ? IRON[0] : rp(IRON, 0.8 - (x + y) * 0.04, x, y));
  }
  b.set(r.x + 1, r.y + 1, IRON[4]); b.set(r.x + 2, r.y + 1, IRON[4]);
}

// ---------------------------------------------------------------- the pack: layout

export interface PackLayout {
  W: number; H: number;
  cols: number; rows: number;
  /** the pack body */
  body: Rect;
  /** the block space (cols x rows cells of CELL px) */
  grid: Rect;
  /** the lid thrown back above the body (includes the strap ends dangling past it) */
  lid: Rect;
  /** the lid buckled shut over the opening (down to the receivers) */
  shut: Rect;
  /** tool loops on the flap (rows of four, top row first) */
  slots: { r: Rect }[];
  /** the haul loop on the hinge (shake and repack) */
  handle: Rect;
  /** the turn swivel hanging off the front wall */
  turn: Rect;
  /** the front receivers the lid straps clip into */
  recv: [Rect, Rect];
  /** x of the two lid straps */
  straps: [number, number];
}

/** toolRows: rows of webbing loops on the flap (four tools a row) */
export function packLayout(cols = 5, rows = 3, toolRows = 2): PackLayout {
  const SIDE = 13, RIM = 8, BACK = 8, FRONT = 13, TOPPAD = 12;
  const tr = Math.max(1, Math.min(3, toolRows));
  const LID = 14 + tr * 27;
  const bw = cols * CELL + RIM * 2, bh = BACK + rows * CELL + FRONT;
  const bx = SIDE, by = TOPPAD + LID - 3;
  const W = bx * 2 + bw;
  const body = { x: bx, y: by, w: bw, h: bh };
  const grid = { x: bx + RIM, y: by + BACK, w: cols * CELL, h: rows * CELL };
  const lid = { x: bx + 3, y: 0, w: bw - 6, h: TOPPAD + LID };
  // the lid straps run down its edges; the loops for the tools sit between them, four a row
  const s0 = lid.x + 5, s1 = lid.x + lid.w - 11;
  const slots: { r: Rect }[] = [];
  const inner = s1 - (s0 + 6) - 4, sw = Math.floor(inner / 4);
  for (let j = 0; j < tr; j++) for (let i = 0; i < 4; i++) slots.push({ r: { x: s0 + 8 + i * sw, y: TOPPAD + 6 + j * 27, w: sw - 2, h: 25 } });
  const recvY = grid.y + grid.h + 3;
  const recv: [Rect, Rect] = [{ x: s0 - 1, y: recvY, w: 8, h: 8 }, { x: s1 - 1, y: recvY, w: 8, h: 8 }];
  const turn = { x: bx + bw - 30, y: by + bh - 4, w: 15, h: 19 };
  return {
    W, H: by + bh + 20, cols, rows, body, grid, lid,
    shut: { x: bx + 1, y: by - 3, w: bw - 2, h: recvY + 10 - (by - 3) },
    slots,
    handle: { x: Math.round(W / 2) - 11, y: by - 6, w: 22, h: 11 },
    turn, recv, straps: [s0, s1],
  };
}

// ---------------------------------------------------------------- the pack: body

/** a padded shoulder strap hanging down the pack's side (behind it), a buckle and a webbing tail */
function shoulderStrap(b: PixelBuffer, x0: number, y0: number, y1: number, dir: 1 | -1) {
  const n = y1 - y0;
  for (let i = 0; i <= n; i++) {
    const y = y0 + i, k = i / n;
    // it hangs straight, then swings out a little at the bottom
    const cx = x0 + dir * Math.round(Math.sin(k * Math.PI * 0.5) * 5);
    const pad = k < 0.62;
    const w = pad ? 8 : 5;
    for (let q = 0; q < w; q++) {
      const t = pad ? 0.68 - Math.abs(q - (w - 1) / 2) / w * 0.6 + grain(cx + q, y) : 0.55 - q * 0.05 + ((y + q) % 3 === 0 ? -0.06 : 0);
      b.set(cx + q - Math.floor(w / 2), y, q === 0 || q === w - 1 ? OUT : rp(pad ? LT : WEB, t, cx + q, y));
    }
    if (pad && i % 3 === 1) { b.set(cx - 2, y, LT[6]); b.set(cx + 2, y, LT[6]); }
  }
  // the buckle where the pad meets the webbing
  const by = y0 + Math.round(n * 0.62), bx = x0 + dir * Math.round(Math.sin(0.62 * Math.PI * 0.5) * 5);
  for (let yy = -2; yy <= 3; yy++) for (let xx = -4; xx <= 4; xx++) {
    const e = Math.abs(xx) === 4 || yy === -2 || yy === 3;
    if (e) b.set(bx + xx, by + yy, OUT);
    else if (Math.abs(xx) === 3 || yy === -1 || yy === 2) b.set(bx + xx, by + yy, xx + yy < 0 ? BR[4] : BR[2]);
  }
  b.rect(bx, by - 1, 1, 4, BR[1]);
  // the tail's metal tip
  const ex = x0 + dir * 5;
  b.rect(ex - 2, y1 + 1, 5, 2, IRON[3]); b.set(ex - 2, y1 + 2, IRON[1]);
}

/** the open pack, floating face up in the air (shoulder straps hanging behind, the collar, the sewn
 *  compartments, the front wall with the strap receivers, the haul loop, a luggage tag) */
export function paintPack(L: PackLayout): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  // ---- the shoulder straps, hanging down behind the body
  const bb = L.body;
  shoulderStrap(b, bb.x + 1, bb.y + 8, bb.y + bb.h + 12, -1);
  shoulderStrap(b, bb.x + bb.w - 2, bb.y + 8, bb.y + bb.h + 12, 1);
  // ---- the body
  const g = L.grid, bd = L.body;
  const op = { x: g.x - 1, y: g.y - 1, w: g.w + 2, h: g.h + 2 };
  roundRect(b, bd, 8, (x, y, u, v, edge) => {
    if (edge === 0) return OUT;
    if (edge === 1) return (u + v < 0.9) ? LT[5] : LT[3];
    if (edge === 2) return (u + v < 0.9) ? LT[4] : LT[2];
    // inside the opening: lining (painted below)
    if (x >= op.x && x < op.x + op.w && y >= op.y && y < op.y + op.h) return LN[1];
    // the rolled collar: a tube of canvas round the opening, its crown catching the light
    const dx = x < op.x ? op.x - x : x >= op.x + op.w ? x - (op.x + op.w - 1) : 0;
    const dy = y < op.y ? op.y - y : y >= op.y + op.h ? y - (op.y + op.h - 1) : 0;
    const d = Math.max(dx, dy);
    const span = y >= op.y + op.h ? (bd.y + bd.h - 1 - (op.y + op.h)) : x < op.x ? op.x - bd.x : x >= op.x + op.w ? bd.x + bd.w - 1 - (op.x + op.w - 1) : op.y - bd.y;
    const k = Math.max(0, Math.min(1, d / Math.max(1, span)));
    const roll = Math.sin(k * Math.PI);
    const lit = (1 - u) * 0.12 + (1 - v) * 0.1;
    const t = 0.28 + roll * 0.42 + lit + weave(x, y) + (fbm(x, y, 7, 9) - 0.5) * 0.1;
    return rp(CV, t, x, y);
  });
  // the lining and the compartments
  for (let y = op.y; y < op.y + op.h; y++) for (let x = op.x; x < op.x + op.w; x++) {
    const ix = x - g.x, iy = y - g.y;
    // the inner walls in shadow (top and left: the light comes from the top left, over the collar)
    const shT = y - op.y, shL = x - op.x;
    if (ix < 0 || iy < 0 || ix >= g.w || iy >= g.h) { b.set(x, y, LN[0]); continue; }
    const cx = ix % CELL, cy = iy % CELL;
    let t: number;
    if (cx === 0 || cy === 0) t = 0.02;
    else if (cx === CELL - 1 || cy === CELL - 1) t = 0.62;
    else {
      // each pocket puffs up a little: lit at its top left, creased at the bottom
      const pu = 1 - (cx + cy) / (CELL * 2);
      t = 0.36 + pu * 0.26 + (cy > CELL - 5 ? -0.12 : 0) + ((x + y * 2) % 4 === 0 ? -0.05 : 0) + (noise(x, y, 77) > 0.975 ? 0.1 : 0);
    }
    if (shT < 5) t -= (5 - shT) * 0.07;
    if (shL < 4) t -= (4 - shL) * 0.06;
    b.set(x, y, rp(LN, t, x, y));
  }
  // seams: a running stitch beside every fold between the pockets
  for (let i = 1; i < L.cols; i++) { const x = g.x + i * CELL; for (let y = g.y + 2; y < g.y + g.h - 2; y++) if ((y >> 1) % 2 === 0) b.set(x + 1, y, THREAD2); }
  for (let j = 1; j < L.rows; j++) { const y = g.y + j * CELL; for (let x = g.x + 2; x < g.x + g.w - 2; x++) if ((x >> 1) % 2 === 0) b.set(x, y + 1, THREAD2); }
  // brass eyelets where the seams cross
  for (let j = 1; j < L.rows; j++) for (let i = 1; i < L.cols; i++) rivet(b, g.x + i * CELL - 1, g.y + j * CELL - 1);
  // the zip round the opening: teeth on the collar's inner lip
  for (let x = op.x + 2; x < op.x + op.w - 2; x++) { b.set(x, op.y - 1, (x & 1) ? IRON[3] : IRON[1]); b.set(x, op.y + op.h, (x & 1) ? IRON[2] : IRON[0]); }
  for (let y = op.y + 2; y < op.y + op.h - 2; y++) { b.set(op.x - 1, y, (y & 1) ? IRON[3] : IRON[1]); b.set(op.x + op.w, y, (y & 1) ? IRON[2] : IRON[0]); }
  // the zip pull hanging at the front right
  const zx = op.x + op.w - 14, zy = op.y + op.h + 1;
  b.rect(zx, zy, 3, 5, IRON[3]); b.set(zx + 1, zy + 1, IRON[0]); b.set(zx + 1, zy + 2, IRON[0]); b.rect(zx - 1, zy + 5, 5, 2, LT[3]); b.set(zx - 1, zy + 5, LT[5]);
  // stitching along the binding
  for (let x = bd.x + 9; x < bd.x + bd.w - 9; x += 3) { b.set(x, bd.y + 3, THREAD); b.set(x + 1, bd.y + bd.h - 4, THREAD2); }
  for (let y = bd.y + 9; y < bd.y + bd.h - 9; y += 3) { b.set(bd.x + 3, y, THREAD); b.set(bd.x + bd.w - 4, y + 1, THREAD2); }
  // wear: a patch sewn on the collar's left side, scuffs, a darker water stain
  const px = bd.x + 2, py = bd.y + 30;
  for (let y = 0; y < 13; y++) for (let x = 0; x < 6; x++) {
    const e = x === 0 || y === 0 || x === 5 || y === 12;
    b.set(px + x, py + y, e ? (y + x) % 2 ? THREAD : CV[2] : rp(RUST, 0.55 - y * 0.02 + weave(px + x, py + y), px + x, py + y));
  }
  for (let i = 0; i < 26; i++) {
    const x = bd.x + 2 + Math.floor(noise(i, 3, 91) * (bd.w - 4)), y = bd.y + 1 + Math.floor(noise(i, 5, 91) * 5);
    if (b.get(x, y) !== OUT && A(b.get(x, y))) b.set(x, y, CV[6]);
  }
  // ---- the front wall: two receivers on webbing tabs
  for (const r of L.recv) {
    hstrap(b, r.x - 3, r.x + r.w + 2, r.y + 1, 5, WEB, 0.05);
    receiver(b, r);
  }
  // ---- the haul loop on the hinge (the repack handle): an arch of leather on two riveted tabs
  paintHandle(b, L.handle);
  // ---- a luggage tag on a string from the front-left corner
  const tx = bd.x + 4, ty = bd.y + bd.h - 6;
  b.line(tx + 3, ty, tx - 2, ty + 7, H('#c8b88a'));
  const nm = pxTextBuf('MORI', { font: 'tiny', color: '#3a2a14' });
  const tw = nm.w + 7;
  const tag = new PixelBuffer(tw, 9);
  tag.rectFn(0, 0, tw, 9, (x, y) => (x + y < 2 || (x > tw - 3 && y < 2 - (tw - 1 - x)) ? -1 : rp([H('#8a7448'), H('#b89c64'), H('#d8c08a'), H('#ecdcae')], 0.75 - y * 0.03 + (noise(x, y, 7) > 0.9 ? -0.15 : 0), x, y)));
  tag.set(2, 2, H('#5a4a2a'));
  tag.blit(nm, 5, 1);
  tag.outline(OUT);
  b.blit(tag, tx - 8, ty + 6);
  return b;
}
const RUST = [H('#3a160c'), H('#5e2614'), H('#83391e'), H('#a8522c'), H('#c4703e')];

function paintHandle(b: PixelBuffer, r: Rect) {
  // tabs
  for (const x of [r.x, r.x + r.w - 6]) {
    for (let y = r.y + 4; y < r.y + r.h; y++) for (let k = 0; k < 6; k++) b.set(x + k, y, k === 0 || k === 5 ? OUT : rp(LT, 0.55 + grain(x + k, y) - (y - r.y) * 0.02, x + k, y));
    rivet(b, x + 2, r.y + r.h - 4);
  }
  // the loop
  const cx = r.x + r.w / 2;
  for (let x = r.x + 2; x < r.x + r.w - 2; x++) {
    const u = (x - cx) / (r.w / 2 - 2);
    const top = Math.round(r.y + 1 + u * u * 4);
    for (let k = 0; k < 4; k++) b.set(x, top + k, k === 0 ? LT[6] : k === 3 ? LT[1] : rp(LT, 0.62 - k * 0.12 + grain(x, k), x, k));
    b.set(x, top - 1, OUT); b.set(x, top + 4, OUT);
  }
}

/** the webbing bands across the side panels (they go over the tools hanging in them) */
export function paintLoops(L: PackLayout, filled: boolean[]): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  L.slots.forEach((s, i) => {
    const r = s.r, y = r.y + Math.round(r.h * 0.64) - 2;
    // a full loop bulges a little over what it holds
    hstrap(b, r.x - 2, r.x + r.w + 1, y, filled[i] ? 5 : 4, WEB, filled[i] ? 0.08 : 0);
    if (filled[i]) { b.set(r.x + 3, y - 2, OUT); b.set(r.x + r.w - 4, y - 2, OUT); }
  });
  return b;
}

// ---------------------------------------------------------------- the lid

/** the lid thrown back above the body: its underside, the mesh pocket, the straps running out past it */
export function paintLidOpen(L: PackLayout): PixelBuffer {
  const r = L.lid, b = new PixelBuffer(r.w, r.h);
  const top = 12;
  const lid: Rect = { x: 0, y: top - 2, w: r.w, h: r.h - top + 2 };
  roundRect(b, lid, 11, (x, y, u, v, edge) => {
    if (edge === 0) return OUT;
    if (edge === 1) return u < 0.5 ? LT[4] : LT[3];
    // the underside bellies a little; the hinge end (bottom) is in the pack's shadow
    const t = 0.66 - Math.abs(u - 0.5) * 0.26 - (v > 0.85 ? (v - 0.85) * 2.4 : 0) + weave(x, y) * 0.8 + (fbm(x, y, 8, 3) - 0.5) * 0.1;
    return rp(UNDER, t, x, y);
  });
  for (let x = 6; x < r.w - 6; x += 3) b.set(x, lid.y + 2, THREAD2);
  // frayed threads and scuffs along the worn far edge
  for (let x = 12; x < r.w - 12; x++) if (noise(x, 1, 71) > 0.86) { b.set(x, lid.y - 1, THREAD2); if (noise(x, 2, 71) > 0.5) b.set(x, lid.y - 2, THREAD2); }
  // a sewn-on pad behind each tool loop, its stitching round it
  for (const s of L.slots) {
    const sx = s.r.x - L.lid.x, sy = s.r.y - L.lid.y;
    for (let y = sy; y < sy + s.r.h; y++) for (let x = sx; x < sx + s.r.w; x++) {
      const e = x === sx || y === sy || x === sx + s.r.w - 1 || y === sy + s.r.h - 1;
      b.set(x, y, e ? (((x + y) & 1) ? THREAD2 : UNDER[1]) : rp(UNDER, 0.42 - (y - sy) / s.r.h * 0.12 + weave(x, y), x, y));
    }
  }
  // the straps: from the hinge out past the far edge, their clips dangling
  for (const sx of L.straps) {
    const x = sx - L.lid.x;
    vstrap(b, x, 4, r.h - 1, 6, WEB, 0.06);
    clip(b, x + 3, 3, -1);
  }
  return b;
}

/** the lid buckled shut over the opening (released: which clips are undone) */
export function paintLidShut(L: PackLayout, released: [boolean, boolean] = [false, false]): PixelBuffer {
  const r = L.shut, b = new PixelBuffer(r.w, r.h);
  const flap: Rect = { x: 0, y: 0, w: r.w, h: r.h - 9 };
  roundRect(b, flap, 12, (x, y, u, v, edge) => {
    if (edge === 0) return OUT;
    if (edge === 1) return u + v < 0.8 ? LT[5] : LT[3];
    if (edge === 2) return LT[2];
    // the flap is domed over what is inside: lit top-left, rolling into shade at the front
    const t = 0.7 - Math.abs(u - 0.5) * 0.3 - v * 0.24 + (v < 0.06 ? -0.15 : 0) + weave(x, y) + (fbm(x, y, 11, 21) - 0.5) * 0.14;
    return rp(CV, t, x, y);
  });
  for (let x = 12; x < r.w - 12; x += 3) b.set(x, flap.h - 4, THREAD2);
  for (let y = 12; y < flap.h - 12; y += 3) { b.set(3, y, THREAD); b.set(r.w - 4, y, THREAD2); }
  // the leather patch with the fern burned into it
  const px = Math.round(r.w / 2) - 13, py = 18;
  roundRect(b, { x: px, y: py, w: 26, h: 30 }, 4, (x, y, u, v, edge) => {
    if (edge === 0) return OUT;
    if (edge === 1) return (x + y) % 2 ? THREAD : LT[2];
    return rp(LT, 0.62 - v * 0.2 + grain(x, y), x, y);
  });
  for (let i = 0; i < 18; i++) {
    const y = py + 25 - i, x = px + 13 + Math.round(Math.sin(i * 0.22) * 1.5);
    b.set(x, y, LT[1]);
    if (i > 2 && i % 2 === 0) { const L2 = Math.max(1, Math.round((18 - i) * 0.45)); for (let k = 1; k <= L2; k++) { b.set(x - k, y - (k >> 1), LT[1]); b.set(x + k, y - (k >> 1), LT[1]); } }
  }
  // scuffs and a scorch mark from a camp fire long ago
  for (let i = 0; i < 40; i++) {
    const x = 6 + Math.floor(noise(i, 1, 55) * (r.w - 12)), y = 6 + Math.floor(noise(i, 2, 55) * (flap.h - 12));
    if (A(b.get(x, y)) && b.get(x, y) !== OUT) b.set(x, y, noise(i, 3, 55) > 0.5 ? CV[6] : CV[2]);
  }
  for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) {
    const dx = x - 4, dy = y - 3; if (dx * dx + dy * dy * 2 > 18) continue;
    const X = r.w - 30 + x, Y = 40 + y;
    if (A(b.get(X, Y))) b.set(X, Y, mix(b.get(X, Y), H('#140e06'), 0.55 + bayer(X, Y) * 0.3));
  }
  // the straps over the flap, down to the receivers
  L.straps.forEach((sx, i) => {
    const x = sx - L.shut.x;
    const rec = L.recv[i];
    const ry = rec.y - L.shut.y;
    const end = released[i] ? ry - 6 : ry;
    vstrap(b, x, 6, end - 1, 6, WEB, 0.08);
    clip(b, x + 3, end - 2, 1, released[i]);
  });
  return b;
}

// ---------------------------------------------------------------- the turn swivel

/** the brass swivel on its strap tab: the turn button (state: idle / hover / down) */
export function paintTurn(state: 'idle' | 'hover' | 'down'): PixelBuffer {
  const w = 15, h = 19, b = new PixelBuffer(w, h);
  const dy = state === 'down' ? 1 : 0;
  // the tab from the front wall
  for (let y = 0; y < 7; y++) for (let k = 0; k < 5; k++) b.set(5 + k, y, k === 0 || k === 4 ? OUT : rp(LT, 0.55 - y * 0.03 + grain(5 + k, y), k, y));
  b.set(7, 2, THREAD); b.set(7, 4, THREAD);
  // the disc
  const cx = 7, cy = 11 + dy, rr = 6.6;
  const lift = state === 'hover' ? 0.14 : state === 'down' ? -0.12 : 0;
  b.discFn(cx, cy, rr, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.86) return OUT;
    const t = 0.62 + lift - nx * 0.22 - ny * 0.28 + (d > 0.7 ? -0.14 : 0);
    return rp(BR, t, x, y);
  });
  // the engraved arrow, three quarters round, its head at the top
  for (let a = 0.5; a < 5.4; a += 0.12) {
    const x = Math.round(cx + Math.cos(a) * 3.2), y = Math.round(cy + Math.sin(a) * 3.2);
    b.set(x, y, BR[1]);
  }
  b.set(cx + 3, cy - 3, BR[1]); b.set(cx + 4, cy - 2, BR[1]); b.set(cx + 2, cy - 4, BR[1]); b.set(cx + 4, cy - 4, BR[1]);
  // a glint
  b.set(cx - 3, cy - 4, BR[5]); b.set(cx - 4, cy - 3, BR[5]);
  if (state === 'hover') { b.set(cx - 2, cy - 5, H('#ffffff')); b.set(cx - 5, cy - 2, BR[5]); }
  return b;
}

// ---------------------------------------------------------------- the camp stash chest

export interface ChestLayout { W: number; H: number; grid: Rect; box: Rect; lid: Rect }
export function chestLayout(cols: number, rows: number): ChestLayout {
  const WALL = 9, LID = 30;
  const gw = cols * CELL, gh = rows * CELL;
  const box = { x: 6, y: LID - 2, w: gw + WALL * 2, h: gh + WALL * 2 };
  return { W: box.w + 12, H: box.y + box.h + 3, grid: { x: box.x + WALL, y: box.y + WALL, w: gw, h: gh }, box, lid: { x: box.x + 2, y: 0, w: box.w - 4, h: LID } };
}
const WOOD = [H('#1e1008'), H('#352010'), H('#4c2e16'), H('#64401f'), H('#7e5530'), H('#9a6c42'), H('#b48858')];
/** the old sea chest, open, its floor chalked into a grid */
export function paintChest(L: ChestLayout, cols: number, rows: number): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  // the lid thrown back: planks running across, two iron bands, the boat's name stencilled on
  const ld = L.lid;
  for (let y = ld.y; y < ld.y + ld.h; y++) for (let x = ld.x; x < ld.x + ld.w; x++) {
    const iy = y - ld.y, plank = Math.floor(iy / 7), py = iy % 7;
    let t = 0.5 + (noise(plank, 0, 61) - 0.5) * 0.2 - (iy > ld.h - 5 ? 0.25 : 0) + Math.sin((x + plank * 37) * 0.31 + Math.sin(x * 0.07 + plank) * 2) * 0.06;
    if (py === 0) t = 0.08; else if (py === 1) t += 0.12;
    b.set(x, y, rp(WOOD, t, x, y));
  }
  for (const bx of [ld.x + 16, ld.x + ld.w - 22]) for (let y = ld.y; y < ld.y + ld.h; y++) for (let k = 0; k < 6; k++) b.set(bx + k, y, k === 0 || k === 5 ? OUT : rp(IRON, 0.6 - k * 0.05 + (y % 9 === 4 && (k === 2 || k === 3) ? 0.4 : 0), bx + k, y));
  const nm = pxTextBuf('KITTIWAKE', { font: 'bold', color: '#e8dcc0' });
  for (let y = 0; y < nm.h; y++) for (let x = 0; x < nm.w; x++) { const c = nm.get(x, y); if (A(c) && noise(x, y, 17) > 0.25) b.set(Math.round(ld.x + ld.w / 2 - nm.w / 2) + x, ld.y + 9 + y, mix(c, WOOD[3], 0.35)); }
  for (let x = ld.x; x < ld.x + ld.w; x++) { b.set(x, ld.y, OUT); }
  for (let y = ld.y; y < ld.y + ld.h; y++) { b.set(ld.x, y, OUT); b.set(ld.x + ld.w - 1, y, OUT); }
  // the box: thick walls with the planks along them, iron corners
  const bx = L.box, g = L.grid;
  for (let y = bx.y; y < bx.y + bx.h; y++) for (let x = bx.x; x < bx.x + bx.w; x++) {
    const inG = x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h;
    const edge = x === bx.x || y === bx.y || x === bx.x + bx.w - 1 || y === bx.y + bx.h - 1;
    if (edge) { b.set(x, y, OUT); continue; }
    if (inG) {
      // the floor: boards running across, a chalk grid
      const iy = y - g.y, ix = x - g.x, board = Math.floor(iy / 12);
      let t = 0.42 + (noise(board, 1, 63) - 0.5) * 0.18 + Math.sin((ix + board * 29) * 0.23 + Math.sin(ix * 0.05) * 3) * 0.05;
      if (iy % 12 === 0) t = 0.12;
      // the walls' shadow on the floor
      if (iy < 5) t -= (5 - iy) * 0.06;
      if (ix < 4) t -= (4 - ix) * 0.05;
      let c = rp(WOOD, t, x, y);
      if ((ix % CELL === 0 || iy % CELL === 0) && (ix + iy) % 3 !== 0 && noise(ix, iy, 64) > 0.15) c = mix(c, H('#e6e0d0'), 0.45);
      b.set(x, y, c);
      continue;
    }
    // the walls: the top edges of the planks, lit from the top left
    const dx = Math.min(x - bx.x, bx.x + bx.w - 1 - x), dy = Math.min(y - bx.y, bx.y + bx.h - 1 - y);
    const horiz = dy < dx;
    const t = 0.6 + (horiz ? (y < g.y ? 0.12 : -0.1) : (x < g.x ? 0.06 : -0.14)) + (horiz ? Math.sin(x * 0.4 + y) * 0.04 : Math.sin(y * 0.4 + x) * 0.04) + (noise(x, y, 65) > 0.95 ? -0.2 : 0);
    b.set(x, y, rp(WOOD, t, x, y));
  }
  // iron corner brackets with rivets
  for (const [cx, cy, fx, fy] of [[bx.x, bx.y, 1, 1], [bx.x + bx.w - 1, bx.y, -1, 1], [bx.x, bx.y + bx.h - 1, 1, -1], [bx.x + bx.w - 1, bx.y + bx.h - 1, -1, -1]] as const) {
    for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
      if (i > 3 && j > 3) continue;
      b.set(cx + fx * i, cy + fy * j, i === 0 || j === 0 || (i === 3 && j > 3) || (j === 3 && i > 3) || i === 8 || j === 8 ? OUT : rp(IRON, 0.6 - (i + j) * 0.03, i, j));
    }
    rivet(b, cx + fx * 2 - (fx < 0 ? 1 : 0), cy + fy * 2 - (fy < 0 ? 1 : 0));
  }
  // rope handles on the ends
  for (const x0 of [bx.x - 5, bx.x + bx.w + 1]) for (let y = bx.y + bx.h / 2 - 9; y < bx.y + bx.h / 2 + 9; y++) {
    const k = (y - (bx.y + bx.h / 2 - 9)) / 18, off = Math.round(Math.sin(k * Math.PI) * 2) * (x0 < bx.x ? -1 : 1);
    for (let q = 0; q < 3; q++) b.set(x0 + q + off + (x0 < bx.x ? 1 : -1), y, (y + q) % 3 === 0 ? H('#6a5430') : q === 1 ? H('#c8a868') : H('#9a7c48'));
  }
  void cols; void rows;
  return b;
}

// ---------------------------------------------------------------- the trail marker (Set off)

export function paintSign(): PixelBuffer {
  const w = 62, h = 22, b = new PixelBuffer(w, h);
  // an arrow-shaped plank lying on the ground, pointing right
  b.polyFn([1, 3, w - 12, 2, w - 1, h / 2, w - 12, h - 3, 1, h - 4], (x, y) => {
    const t = 0.62 + Math.sin(x * 0.28 + Math.sin(y * 0.6) * 1.5) * 0.06 - (y / h) * 0.26 + (noise(x, y, 66) > 0.94 ? -0.2 : 0);
    return rp(WOOD, t, x, y);
  });
  b.outline(OUT);
  const t = pxTextBuf('SET OFF', { font: 'bold', color: '#f2e2b8', shadow: '#2a1408' });
  b.blit(t, 6, Math.round(h / 2 - t.h / 2) + 1);
  rivet(b, 3, h / 2 - 1);
  return b;
}

// ---------------------------------------------------------------- the world behind, dimmed

/** the world dimmed by an ordered dither (no blur): dark pixels on and off, thinner round the spots
 *  that should stay lit (Mori, the pack) */
export function paintDim(w: number, h: number, spots: { x: number; y: number; r: number }[], max = 0.56): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const c = H('#07060c', 236);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let k = max;
    for (const s of spots) {
      const d = Math.hypot(x - s.x, (y - s.y) * 1.1) / s.r;
      if (d < 1) k = Math.min(k, max * (0.25 + 0.75 * d * d));
    }
    // quantised to the dither's own steps: bands, not a gradient
    if (bayer(x, y) < Math.round(k * 8) / 8) b.set(x, y, c);
  }
  return b;
}

/** the floating pack's shadow cast down on the world: a dithered oval */
export function paintFloatShadow(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
    if (d > 1) continue;
    const k = d < 0.55 ? 0.75 : d < 0.8 ? 0.5 : 0.25;
    if (bayer(x, y) < k) b.set(x, y, H('#050408', 220));
  }
  return b;
}

// ---------------------------------------------------------------- small helpers for the scene

/** a 1px soft ring round the opaque pixels of a picture (hover / selection), plus a dithered halo */
export function haloOf(src: PixelBuffer, col = '#fff2b0', halo = true): PixelBuffer {
  const pad = 2;
  const b = new PixelBuffer(src.w + pad * 2, src.h + pad * 2);
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < src.w && y < src.h && A(src.get(x, y)) > 40;
  const c1 = H(col), c2 = H(col, 150);
  for (let y = -pad; y < src.h + pad; y++) for (let x = -pad; x < src.w + pad; x++) {
    if (op(x, y)) continue;
    let near = false, far = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && Math.abs(dx) + Math.abs(dy) === 1 && op(x + dx, y + dy)) { near = true; break; }
    if (!near && halo) for (let dy = -2; dy <= 2 && !far; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && op(x + dx, y + dy)) { far = true; break; }
    if (near) b.set(x + pad, y + pad, c1);
    else if (far && ((x + y) & 1) === 0) b.set(x + pad, y + pad, c2);
  }
  return b;
}

/** a ghost of the cells an item would fill (ok: green, bad: red, merge: gold), dithered */
export function paintGhost(cells: [number, number][], w: number, h: number, kind: 'ok' | 'bad' | 'merge'): PixelBuffer {
  const b = new PixelBuffer(w * CELL, h * CELL);
  const c = kind === 'ok' ? H('#9cf070') : kind === 'bad' ? H('#ff6a4a') : H('#ffd24a');
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  for (const [cx, cy] of cells) for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const X = cx * CELL + x, Y = cy * CELL + y;
    const edgeL = x === 0 && !set.has(cx - 1 + ',' + cy), edgeR = x === CELL - 1 && !set.has(cx + 1 + ',' + cy);
    const edgeT = y === 0 && !set.has(cx + ',' + (cy - 1)), edgeB = y === CELL - 1 && !set.has(cx + ',' + (cy + 1));
    if (edgeL || edgeR || edgeT || edgeB) b.set(X, Y, c);
    else if ((X + Y) % 4 === 0) b.set(X, Y, H(kind === 'ok' ? '#9cf070' : kind === 'bad' ? '#ff6a4a' : '#ffd24a', 150));
  }
  return b;
}

/** the soft shadow an item casts on the ground or the lining (dithered, offset down-right) */
export function shadowOf(src: PixelBuffer, lift = 1): PixelBuffer {
  const o = lift + 1;
  const b = new PixelBuffer(src.w + o, src.h + o);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (A(src.get(x, y)) > 40 && ((x + y) & 1 || lift < 2)) b.set(x + o, y + o, H('#080604', 120));
  return b;
}
export { OUT as INK_OUT, BR as BRASS, LT as LEATHER };

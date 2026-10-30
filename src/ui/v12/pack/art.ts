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
  sideL: Rect; sideR: Rect;
  /** tool slots on the side panels (top to bottom, left side first) */
  slots: { side: 'L' | 'R'; r: Rect }[];
  /** the haul loop on the hinge (shake and repack) */
  handle: Rect;
  /** the turn swivel hanging off the front wall */
  turn: Rect;
  /** the front receivers the lid straps clip into */
  recv: [Rect, Rect];
  /** x of the two lid straps */
  straps: [number, number];
}

export function packLayout(cols = 5, rows = 3): PackLayout {
  const SIDE = 30, RIM = 8, BACK = 8, FRONT = 13, TOPPAD = 12, LID = 46;
  const bw = cols * CELL + RIM * 2, bh = BACK + rows * CELL + FRONT;
  const bx = SIDE - 2, by = TOPPAD + LID - 3;
  const W = bx * 2 + bw;
  const body = { x: bx, y: by, w: bw, h: bh };
  const grid = { x: bx + RIM, y: by + BACK, w: cols * CELL, h: rows * CELL };
  const sideH = bh + 4;
  const sideL = { x: 1, y: by - 2, w: SIDE + 2, h: sideH }, sideR = { x: W - SIDE - 3, y: by - 2, w: SIDE + 2, h: sideH };
  const n = 4, sh = Math.floor((sideH - 6) / n);
  const slots: { side: 'L' | 'R'; r: Rect }[] = [];
  for (const [side, r] of [['L', sideL], ['R', sideR]] as const) for (let i = 0; i < n; i++) slots.push({ side, r: { x: r.x + 4, y: r.y + 3 + i * sh, w: r.w - 8, h: sh } });
  const s0 = bx + 30, s1 = bx + bw - 36;
  const recvY = grid.y + grid.h + 3;
  const recv: [Rect, Rect] = [{ x: s0 - 1, y: recvY, w: 8, h: 8 }, { x: s1 - 1, y: recvY, w: 8, h: 8 }];
  const turn = { x: bx + bw - 30, y: by + bh - 4, w: 15, h: 19 };
  return {
    W, H: turn.y + turn.h + 2, cols, rows, body, grid,
    lid: { x: bx + 3, y: 0, w: bw - 6, h: TOPPAD + LID },
    shut: { x: bx + 1, y: by - 3, w: bw - 2, h: recvY + 10 - (by - 3) },
    sideL, sideR, slots,
    handle: { x: Math.round(W / 2) - 11, y: by - 6, w: 22, h: 11 },
    turn, recv, straps: [s0, s1],
  };
}

// ---------------------------------------------------------------- the pack: body

/** the open pack from above (side panels, collar, the sewn compartments, front wall, haul loop) */
export function paintPack(L: PackLayout): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  // ---- the side panels, flopped out on the ground
  for (const [r, left] of [[L.sideL, true], [L.sideR, false]] as const) {
    roundRect(b, r, 7, (x, y, u, v, edge) => {
      if (edge === 0) return OUT;
      if (edge === 1) return (left ? u < 0.5 : u > 0.5) ? LT[2] : LT[4];
      // the outer half bends down to the ground: darker toward the outside edge
      const out = left ? 1 - u : u;
      const t = 0.62 - out * 0.32 + (v < 0.08 ? 0.08 : 0) - (v > 0.92 ? 0.12 : 0) + weave(x, y) + (fbm(x, y, 9, 5) - 0.5) * 0.12;
      return rp(FADE, t, x, y);
    });
    // binding stitches
    for (let y = r.y + 4; y < r.y + r.h - 4; y += 3) b.set(left ? r.x + 2 : r.x + r.w - 3, y, THREAD2);
  }
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
  const tag = new PixelBuffer(13, 9);
  tag.rectFn(0, 0, 13, 9, (x, y) => (x + y < 2 || (x > 10 && y < 2 - (12 - x)) ? -1 : rp([H('#8a7448'), H('#b89c64'), H('#d8c08a'), H('#ecdcae')], 0.75 - y * 0.03 + (noise(x, y, 7) > 0.9 ? -0.15 : 0), x, y)));
  tag.set(2, 2, H('#5a4a2a'));
  const nm = pxTextBuf('MORI', { font: 'tiny', color: '#3a2a14' });
  tag.blit(nm, 4, 1);
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
  // the mesh pocket with its zip, a folded map and a pencil inside
  const m: Rect = { x: 14, y: lid.y + 8, w: r.w - 28, h: 21 };
  for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
    const ix = x - m.x, iy = y - m.y;
    let c = rp(UNDER, 0.3, x, y);
    // the map
    if (ix > 6 && ix < 40 && iy > 4 && iy < 18) c = (ix === 18 || ix === 29) ? H('#b8a888') : rp([H('#c8b894'), H('#ddd0b0'), H('#efe6cc')], 0.6 - iy * 0.02 + ((ix * 7 + iy * 3) % 11 === 0 ? -0.3 : 0), x, y);
    if (ix > 9 && ix < 38 && iy > 8 && iy < 16 && noise(ix, iy, 5) > 0.82) c = H('#6a8a5a');
    // the pencil
    if (iy >= 6 && iy <= 7 && ix > 48 && ix < 76) c = ix < 51 ? H('#e88a8a') : ix < 53 ? IRON[3] : ix > 72 ? (ix > 74 ? H('#3a3a3a') : H('#e8c89a')) : iy === 6 ? H('#f6d248') : H('#c89a1c');
    // the mesh over it all
    if ((ix + iy) % 3 === 0 || (ix - iy + 300) % 3 === 0) c = mix(c, WEB[1], 0.72);
    b.set(x, y, c);
  }
  for (let x = m.x - 1; x <= m.x + m.w; x++) { b.set(x, m.y - 1, (x & 1) ? IRON[3] : IRON[1]); b.set(x, m.y + m.h, OUT); }
  for (let y = m.y; y < m.y + m.h; y++) { b.set(m.x - 1, y, LT[3]); b.set(m.x + m.w, y, LT[2]); }
  b.rect(m.x + m.w - 8, m.y - 2, 3, 6, IRON[3]); b.set(m.x + m.w - 7, m.y, IRON[0]);
  // the straps: from the hinge out past the far edge, their clips dangling on the ground
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

// ---------------------------------------------------------------- Mori's knees and hands

const STONE = [H('#1a1712'), H('#36301f'), H('#544a34'), H('#726648'), H('#8e825e'), H('#aca07a'), H('#c4b892')];
const SKIN = [H('#3a1810'), H('#7a3a28'), H('#9a4a36'), H('#c8805e'), H('#f0a878'), H('#f8c090'), H('#ffe0b8')];
const OAT = [H('#2a2420'), H('#5a4c40'), H('#8c7c6a'), H('#b8a890'), H('#d4c6ae'), H('#ece0ca')];

/** rasterise a shape given in a rotated frame: u runs along `ang` from (ox, oy), v across it */
function along(b: PixelBuffer, ox: number, oy: number, ang: number, flip: boolean, fn: (u: number, v: number, x: number, y: number) => C | -1) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const X = flip ? b.w - 1 - x : x;
    const dx = X + 0.5 - ox, dy = y + 0.5 - oy;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const c = fn(u, v, x, y);
    if (c !== -1) b.set(x, y, c);
  }
}

/** Mori's thigh and knee, seen from above, coming in from the bottom corner of the view (right: the
 *  right leg, mirrored). The knee points in toward the pack. */
export function paintKnee(right: boolean): PixelBuffer {
  const b = new PixelBuffer(118, 78);
  const ang = -0.72;
  along(b, 4, 92, ang, right, (u, v, x, y) => {
    // a capsule 46 wide, its far end rounded into the knee
    const L = 104, R0 = 24 - Math.max(0, u - 60) * 0.06;
    if (u < -10) return -1;
    const end = u > L - R0 ? Math.sqrt(Math.max(0, R0 * R0 - (u - (L - R0)) ** 2)) : R0;
    if (Math.abs(v) > end) return -1;
    const k = v / Math.max(1, end);
    // round across the leg, the knee cap catching the light, folds where the knee bends
    const cap = Math.max(0, 1 - Math.hypot((u - (L - 16)) / 16, v / 14));
    const fold = u > 46 && u < 78 && Math.sin(u * 0.5 + k * 3) > 0.84 ? -0.2 : 0;
    const seam = Math.abs(k - 0.62) < 0.035 && u < L - 10 ? -0.16 : 0;
    const t = 0.56 - k * 0.3 - k * k * 0.18 + cap * 0.3 - (u < 20 ? (20 - u) * 0.012 : 0) + fold + seam + ((x + y * 2) % 4 === 0 ? -0.03 : 0);
    return rp(STONE, t, x, y);
  });
  b.outline(OUT);
  return b;
}

/** a hand resting on the knee, fingers curled over it, the forearm and rolled sleeve trailing back out
 *  of the view (right: mirrored). grip: curled to take hold of something */
export function paintHand(right: boolean, grip = false): PixelBuffer {
  const b = new PixelBuffer(46, 56);
  const ang = -1.05;
  along(b, 8, 62, ang, right, (u, v, x, y) => {
    // forearm (u 0..34), the wrist, the back of the hand (34..48), the fingers (48..60)
    if (u < -4 || u > 62) return -1;
    const lit = -v * 0.035;
    if (u < 34) {
      const half = 7.4 - u * 0.03;
      if (Math.abs(v) > half) return -1;
      const k = v / half;
      if (u < 12) return u > 10.5 ? OAT[1] : rp(OAT, 0.62 - k * 0.3 + (Math.floor(u) % 4 === 0 ? -0.15 : 0), x, y); // the rolled sleeve
      return rp(SKIN, 0.6 - k * 0.32 + lit, x, y);
    }
    if (u < 48) {
      const half = 6.6 + (u - 34) * 0.14;
      // the thumb on the inside edge
      if (v > half && v < half + 4 && u > 36 && u < 46 + (grip ? -3 : 0)) return rp(SKIN, 0.5 - (v - half) * 0.08, x, y);
      if (Math.abs(v) > half) return -1;
      const k = v / half;
      const tendon = u > 38 && Math.abs(Math.sin(v * 0.62)) < 0.12 ? -0.1 : 0;
      return rp(SKIN, 0.7 - k * 0.28 + tendon + (u > 46 ? 0.08 : 0), x, y);
    }
    // four fingers, a dark line between each, the middle ones longest; curled: shorter, darker tips
    const f = Math.floor((v + 8.6) / 4.3);
    if (f < 0 || f > 3) return -1;
    const len = (grip ? 54 : 58) + (f === 1 || f === 2 ? 3 : 0) - (f === 3 ? 2 : 0);
    if (u > len) return -1;
    const fv = (v + 8.6) - f * 4.3;
    if (fv < 0.6) return SKIN[1];
    const tip = u > len - 2;
    return rp(SKIN, 0.66 - (fv - 2.2) * 0.07 - (tip ? 0.12 : 0) - (Math.abs(u - 52) < 0.6 ? 0.18 : 0), x, y);
  });
  b.outline(H('#2a120a'));
  return b;
}

// ---------------------------------------------------------------- the ground

export interface GroundOpts {
  biome: Biome;
  tod: Tod;
  /** dark contact shadows under the pack and the chest (ground px) */
  shadows: Rect[];
  /** where the camp fire is (ground px; off the edge of the view) */
  fire?: [number, number] | null;
  seed?: number;
}

/** the ground filling the view, w x h art px */
export function paintGround(w: number, h: number, o: GroundOpts): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const seed = o.seed ?? 7;
  const R0 = rng(seed * 977 + w * 13 + h);
  switch (o.biome) {
    case 'forest': groundForest(b, R0, seed); break;
    case 'camp': groundCamp(b, R0, seed, o.fire ?? null); break;
    case 'hills': groundHills(b, R0, seed); break;
    case 'deck': groundDeck(b, R0); break;
    case 'cave': groundCave(b, R0, seed); break;
    default: groundBeach(b, R0, seed);
  }
  // contact shadows: dithered dark, densest under the middle
  for (const s of o.shadows) for (let y = s.y - 2; y < s.y + s.h + 4; y++) for (let x = s.x - 3; x < s.x + s.w + 5; x++) {
    const ex = Math.min(x - (s.x - 3), s.x + s.w + 4 - x) / 7, ey = Math.min(y - (s.y - 2), s.y + s.h + 3 - y) / 5;
    const k = Math.min(1, Math.min(ex, ey));
    if (k <= 0 || !b.inside(x, y)) continue;
    const a = 0.55 * k;
    if (a > bayer(x, y) * 0.8) b.set(x, y, mix(b.get(x, y), H('#080604'), 0.42));
  }
  grade(b, o.tod, o.biome === 'camp' ? o.fire ?? null : null);
  // a dithered vignette: the edges of the view fall away
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x / w - 0.5) * 2, dy = (y / h - 0.48) * 2;
    const d = Math.sqrt(dx * dx * 0.7 + dy * dy);
    const k = (d - 0.82) / 0.5;
    if (k > 0 && k * 0.55 > bayer(x, y)) b.set(x, y, mix(b.get(x, y), H('#0a0604'), 0.35 + Math.min(0.3, k * 0.2)));
  }
  return b;
}

type Rng = ReturnType<typeof rng>;

function fillBase(b: PixelBuffer, ramp: C[], fn: (x: number, y: number) => number) {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.set(x, y, rp(ramp, fn(x, y), x, y));
}
function blob(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, ang: number, fn: (x: number, y: number, nx: number, ny: number) => C | -1) {
  const c = Math.cos(ang), s = Math.sin(ang), m = Math.ceil(Math.max(rx, ry)) + 1;
  for (let y = -m; y <= m; y++) for (let x = -m; x <= m; x++) {
    const u = (x * c + y * s) / rx, v = (-x * s + y * c) / ry;
    if (u * u + v * v > 1) continue;
    const col = fn(cx + x, cy + y, u, v);
    if (col !== -1) b.set(Math.round(cx + x), Math.round(cy + y), col);
  }
}
/** a pebble: a lit dome with a dark rim and a drop shadow */
function pebble(b: PixelBuffer, x: number, y: number, rx: number, ry: number, ramp: C[], ang = 0) {
  blob(b, x + 1, y + 1, rx, ry, ang, (px, py) => mix(b.get(px, py), H('#0a0604'), 0.35));
  blob(b, x, y, rx, ry, ang, (px, py, u, v) => {
    const d = u * u + v * v;
    return d > 0.72 ? ramp[1] : rp(ramp, 0.75 - u * 0.25 - v * 0.35 - d * 0.2, px, py);
  });
}

/** grains: clumps of two or three pixels lighter or darker than the ground (not single-pixel static) */
const grains = (x: number, y: number, seed: number, k = 1) => { const g = vnoise(x, y, 1.6, seed + 50); return g > 0.86 ? 0.12 * k : g < 0.12 ? -0.11 * k : 0; };
/** a boot print pressed into soft ground: the sole and the heel, tread bars, the rim pushed up */
function bootPrint(b: PixelBuffer, x: number, y: number, ang: number, dark: C, lite: C) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let j = -12; j <= 12; j++) for (let i = -7; i <= 7; i++) {
    const u = i * ca - j * sa, v = i * sa + j * ca; // v along the foot (toe at -v)
    const sole = (u * u) / 16 + ((v + 3) * (v + 3)) / 49 <= 1 && v < 3;
    const heel = (u * u) / 10 + ((v - 6) * (v - 6)) / 9 <= 1;
    const X = Math.round(x + i), Y = Math.round(y + j);
    if (!b.inside(X, Y)) continue;
    if (sole || heel) b.set(X, Y, mix(b.get(X, Y), dark, Math.round(v + 20) % 3 === 0 ? 0.42 : 0.24));
    else {
      const rim = (u * u) / 22 + ((v + 2) * (v + 2)) / 72 <= 1 || (u * u) / 15 + ((v - 6) * (v - 6)) / 14 <= 1;
      if (rim && j < 0) b.set(X, Y, mix(b.get(X, Y), lite, 0.3));
    }
  }
}
/** a tuft of grass seen from above: blades fanning out from a dark heart */
function tuft(b: PixelBuffer, cx: number, cy: number, R: Rng, ramp: C[], n = 22, len = 14) {
  blob(b, cx + 2, cy + 2, len * 0.45, len * 0.32, 0, (x, y) => mix(b.get(x, y), H('#0a0806'), 0.3));
  for (let k = 0; k < n; k++) {
    const a = R.r(0, 6.28), l = R.r(len * 0.4, len), bend = R.r(-0.35, 0.35);
    for (let q = 0; q < l; q++) {
      const aa = a + bend * (q / l);
      const x = cx + Math.cos(aa) * q, y = cy + Math.sin(aa) * q * 0.72;
      b.set(x, y, rp(ramp, 0.25 + (q / l) * 0.6 + (k % 4) * 0.04, Math.round(x), Math.round(y)));
    }
  }
}
const MARRAM = [H('#2a2a0e'), H('#4a4a18'), H('#6e6a26'), H('#948c3a'), H('#b8ac56'), H('#d6ca7a')];

const SAND = [H('#7a5a32'), H('#94733f'), H('#ad8c50'), H('#c4a262'), H('#d6b676'), H('#e6c88c'), H('#f2dcaa')];
function groundBeach(b: PixelBuffer, R: Rng, seed: number) {
  fillBase(b, SAND, (x, y) => {
    // wind ripples across the sand
    const rip = Math.sin((x * 0.32 + y * 0.9 + fbm(x, y, 22, seed) * 9)) * 0.5 + 0.5;
    return 0.52 + (fbm(x, y, 26, seed) - 0.5) * 0.34 + (rip > 0.86 ? 0.1 : rip < 0.12 ? -0.09 : 0) + grains(x, y, seed);
  });
  // damp darker patches
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (fbm(x, y, 40, seed + 4) > 0.68 && bayer(x, y) < 0.6) b.set(x, y, mix(b.get(x, y), H('#5a4a30'), 0.28));
  // boot prints leading in from the bottom
  for (let i = 0; i < 5; i++) bootPrint(b, b.w * 0.5 + (i % 2 ? 16 : -16) + R.r(-3, 3), b.h - 10 - i * 30, R.r(-0.12, 0.12), H('#5a4426'), H('#f6e2b4'));
  // marram grass at the edges
  for (let i = 0; i < 5; i++) tuft(b, i % 2 ? R.r(b.w * 0.86, b.w + 6) : R.r(-6, b.w * 0.14), R.r(0, b.h * 0.8), R, MARRAM, 26, R.r(12, 20));
  // wrack: dried seaweed strands
  for (let i = 0; i < 5; i++) {
    let x = R.r(0, b.w), y = R.r(0, b.h), a = R.r(0, 6.28);
    const len = R.i(14, 30);
    for (let k = 0; k < len; k++) {
      a += R.r(-0.4, 0.4); x += Math.cos(a); y += Math.sin(a) * 0.7;
      b.set(x, y, k % 5 === 0 ? H('#5a4a18') : H('#2e2a10')); b.set(x + 1, y, H('#3e3a14'));
    }
  }
  // shells: cockles, a spiral, a paua glint
  const SHELL = [H('#6a5040'), H('#b89480'), H('#e2c4b0'), H('#f8ecdc')], PINK = [H('#7a4040'), H('#c47a70'), H('#eab0a0'), H('#fce0d4')];
  for (let i = 0; i < 26; i++) {
    const x = R.r(4, b.w - 4), y = R.r(4, b.h - 4), kind = R.i(0, 3);
    if (kind === 0) {
      // a cockle: a ribbed fan
      const r = R.r(2.5, 4), ramp = R.f() < 0.4 ? PINK : SHELL, ang = R.r(0, 6.28);
      blob(b, x + 1, y + 1, r, r * 0.8, ang, (px, py) => mix(b.get(px, py), H('#3a2a14'), 0.4));
      blob(b, x, y, r, r * 0.8, ang, (px, py, u, v) => (Math.abs(Math.sin(Math.atan2(v, u) * 5)) < 0.25 ? ramp[1] : rp(ramp, 0.85 - u * 0.2 - v * 0.3, px, py)));
    } else if (kind === 1) {
      // a spiral shell
      for (let t = 0; t < 9; t += 0.3) { const rr = t * 0.42; b.set(x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.8, t < 3 ? SHELL[1] : SHELL[2 + (Math.floor(t) % 2)]); }
      b.set(x, y, SHELL[3]);
    } else if (kind === 2) {
      // a broken shell shard
      b.set(x, y, SHELL[3]); b.set(x + 1, y, SHELL[2]); b.set(x, y + 1, SHELL[1]); b.set(x + 2, y + 1, SHELL[2]);
    } else {
      // a paua chip catching the light
      const c = [H('#2a6a7a'), H('#4aa0a0'), H('#8ad0c0'), H('#5a7ab0')];
      b.set(x, y, c[0]); b.set(x + 1, y, c[1]); b.set(x, y + 1, c[3]); b.set(x + 1, y + 1, c[2]); b.set(x + 2, y, c[1]);
    }
  }
  // pebbles
  const PEB = [H('#2a2622'), H('#4a443c'), H('#6a6258'), H('#8a8276'), H('#aaa294')];
  for (let i = 0; i < 18; i++) pebble(b, R.r(0, b.w), R.r(0, b.h), R.r(1.5, 3.5), R.r(1.2, 2.6), PEB, R.r(0, 3));
  // a bleached twig of driftwood
  const dx = R.r(b.w * 0.08, b.w * 0.25), dy = R.r(b.h * 0.15, b.h * 0.4);
  b.thickLine(dx, dy, dx + 34, dy + 9, 1.4, H('#9a8e78'));
  b.line(dx, dy - 1, dx + 34, dy + 8, H('#d8ccb4'));
  b.line(dx + 18, dy + 5, dx + 24, dy - 3, H('#b8ac94'));
  // tiny crab tracks
  for (let k = 0; k < 14; k++) { const x = b.w * 0.82 + k * 2.4, y = b.h * 0.3 + Math.sin(k * 0.8) * 6; b.set(x, y - 2, H('#7a5a32')); b.set(x, y + 2, H('#7a5a32')); }
}

const SOIL = [H('#140c06'), H('#1e140a'), H('#2a1c10'), H('#382616'), H('#46301c'), H('#563c24')];
const LEAF = [[H('#3a1a08'), H('#6a3010'), H('#9a4a18'), H('#c46a28')], [H('#3a2a0a'), H('#6a5016'), H('#9a7a26'), H('#c4a040')], [H('#1a2a0e'), H('#2e4a16'), H('#4a6a22'), H('#6a8a32')], [H('#2a1a10'), H('#4a3020'), H('#6a4a30'), H('#8a6a48')]];
const MOSS = [H('#16260a'), H('#24400e'), H('#365e16'), H('#4e7e20'), H('#6e9e30'), H('#94be4a')];
const BARK = [H('#140a06'), H('#26160c'), H('#3a2414'), H('#52341e'), H('#6a4628'), H('#845a36')];
function groundForest(b: PixelBuffer, R: Rng, seed: number) {
  fillBase(b, SOIL, (x, y) => 0.45 + (fbm(x, y, 18, seed) - 0.5) * 0.5 + grains(x, y, seed, 1.2));
  // roots: thick, winding, crossing the view
  for (let i = 0; i < 4; i++) {
    let x = R.f() < 0.5 ? -4 : b.w + 4, y = R.r(0, b.h), a = x < 0 ? R.r(-0.4, 0.4) : Math.PI + R.r(-0.4, 0.4);
    let r = R.r(3.5, 6.5);
    const pts: [number, number, number][] = [];
    for (let k = 0; k < 140 && r > 1; k++) {
      pts.push([x, y, r]);
      a += Math.sin(k * 0.13 + i) * 0.06 + R.r(-0.05, 0.05); x += Math.cos(a) * 2; y += Math.sin(a) * 2; r -= 0.025;
      if (x < -10 || x > b.w + 10 || y < -10 || y > b.h + 10) break;
    }
    // shadow, then the root lit from the top left with bark ridges
    for (const [px, py, pr] of pts) for (let yy = -pr - 1; yy <= pr + 2; yy++) for (let xx = -pr - 1; xx <= pr + 2; xx++) if (xx * xx + yy * yy <= (pr + 1.5) ** 2) { const X = px + xx + 2, Y = py + yy + 2; if (b.inside(X, Y)) b.set(X, Y, mix(b.get(X, Y), H('#050302'), 0.45)); }
    for (const [px, py, pr] of pts) for (let yy = -pr; yy <= pr; yy++) for (let xx = -pr; xx <= pr; xx++) {
      const d = (xx * xx + yy * yy) / (pr * pr);
      if (d > 1) continue;
      const X = Math.round(px + xx), Y = Math.round(py + yy);
      const t = 0.62 - (xx + yy) / (pr * 2) * 0.4 - d * 0.25 + (Math.sin((X + Y) * 0.9) > 0.8 ? -0.2 : 0);
      b.set(X, Y, rp(BARK, t, X, Y));
    }
  }
  // moss cushions
  for (let i = 0; i < 9; i++) {
    const cx = R.r(0, b.w), cy = R.r(0, b.h), rr = R.r(7, 16);
    for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
      const d = Math.sqrt(x * x + y * y) / rr + (vnoise(cx + x, cy + y, 3, seed + 9) - 0.5) * 0.6;
      if (d > 1) continue;
      const X = Math.round(cx + x), Y = Math.round(cy + y);
      b.set(X, Y, rp(MOSS, 0.6 - (x + y) / (rr * 2) * 0.3 - d * 0.25 + (noise(X, Y, 5) > 0.8 ? 0.2 : 0) + (noise(X, Y, 6) > 0.88 ? -0.25 : 0), X, Y));
    }
  }
  // leaf litter: hundreds of small leaves, some curled, some skeleton-dark
  for (let i = 0; i < Math.floor(b.w * b.h / 130); i++) {
    const x = R.r(0, b.w), y = R.r(0, b.h), ramp = LEAF[R.i(0, 3)], a = R.r(0, 6.28), l = R.r(2.2, 4.6), wd = l * R.r(0.38, 0.55);
    blob(b, x + 1, y + 1, l, wd, a, (px, py) => mix(b.get(px, py), H('#050302'), 0.3));
    blob(b, x, y, l, wd, a, (px, py, u, v) => (Math.abs(v) < 0.18 ? ramp[0] : rp(ramp, 0.7 - v * 0.3 - u * 0.15, px, py)));
  }
  // twigs
  for (let i = 0; i < 10; i++) { const x = R.r(0, b.w), y = R.r(0, b.h), a = R.r(0, 6.28), l = R.r(8, 20); b.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, BARK[3]); b.line(x + 1, y + 1, x + 1 + Math.cos(a) * l, y + 1 + Math.sin(a) * l, BARK[0]); }
  // a little clump of fern fronds at the edges and a bracket fungus on a root
  for (const [fx, fy] of [[R.r(4, 30), R.r(10, b.h * 0.5)], [b.w - R.r(4, 30), R.r(b.h * 0.2, b.h * 0.6)]] as [number, number][]) {
    for (let f = 0; f < 4; f++) {
      const a = -1.2 + f * 0.8 + R.r(-0.2, 0.2), len = R.r(18, 30);
      for (let k = 0; k < len; k++) {
        const x = fx + Math.cos(a) * k + Math.sin(k * 0.2) * 1.5, y = fy + Math.sin(a) * k * 0.8;
        b.set(x, y, MOSS[2]);
        const leafL = Math.max(1, Math.round((len - k) * 0.22));
        if (k % 2 === 0) for (let q = 1; q <= leafL; q++) { b.set(x + Math.cos(a + 1.3) * q, y + Math.sin(a + 1.3) * q, rp(MOSS, 0.75 - q * 0.06, x, y)); b.set(x + Math.cos(a - 1.3) * q, y + Math.sin(a - 1.3) * q, rp(MOSS, 0.55 - q * 0.06, x, y)); }
      }
    }
  }
}

const EARTH = [H('#2a1c10'), H('#3e2a18'), H('#564026'), H('#6e5434'), H('#887048'), H('#a28c60'), H('#bca878')];
function groundCamp(b: PixelBuffer, R: Rng, seed: number, fire: [number, number] | null) {
  // trodden sand and earth, darker where the feet go
  fillBase(b, EARTH, (x, y) => 0.56 + (fbm(x, y, 24, seed) - 0.5) * 0.4 + grains(x, y, seed) + (Math.sin(x * 0.4 + y * 0.8 + fbm(x, y, 16, seed) * 7) > 0.92 ? 0.06 : 0));
  // the paths worn between the tents and the fire: packed darker
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (Math.abs(fbm(x, y, 60, seed + 8) - 0.5) < 0.05 && bayer(x, y) < 0.55) b.set(x, y, mix(b.get(x, y), H('#2a1c10'), 0.18));
  // footprints everywhere (camp is busy)
  for (let i = 0; i < 10; i++) bootPrint(b, R.r(0, b.w), R.r(0, b.h), R.r(-0.7, 0.7), H('#2e2012'), H('#c8b488'));
  // dune grass where the camp meets the beach
  for (let i = 0; i < 4; i++) tuft(b, R.r(b.w * 0.55, b.w + 6), i < 2 ? R.r(-6, b.h * 0.18) : R.r(b.h * 0.2, b.h * 0.6), R, MARRAM, 24, R.r(12, 18));
  // the fire ring at the edge: stones round the ash, a charred log end, embers
  if (fire) {
    const [fx, fy] = fire;
    const ASH = [H('#1a1612'), H('#2e2a26'), H('#4a4642'), H('#6a6660'), H('#8a8680')];
    for (let y = -40; y <= 40; y++) for (let x = -40; x <= 40; x++) {
      const d = Math.sqrt(x * x + y * y * 1.3) / 34 + (vnoise(fx + x, fy + y, 4, 3) - 0.5) * 0.3;
      if (d > 1) continue;
      const X = Math.round(fx + x), Y = Math.round(fy + y);
      if (!b.inside(X, Y)) continue;
      b.set(X, Y, rp(ASH, 0.5 - d * 0.3 + (noise(X, Y, 3) > 0.9 ? 0.2 : 0), X, Y));
      if (d < 0.55 && noise(X, Y, 4) > 0.94) b.set(X, Y, noise(X, Y, 5) > 0.5 ? H('#ff9a3a') : H('#e8481c'));
    }
    const STN = [H('#1e1c1a'), H('#3a3632'), H('#56524a'), H('#767066'), H('#968e82')];
    for (let k = 0; k < 11; k++) { const a = k / 11 * 6.28; pebble(b, fx + Math.cos(a) * 40, fy + Math.sin(a) * 33, R.r(5, 8), R.r(4, 6), STN, a); }
    // a log, its burnt end in the ring
    const lx = fx + 10, ly = fy - 6;
    for (let k = 0; k < 70; k++) for (let w = -5; w <= 5; w++) {
      const X = Math.round(lx + k * 0.95), Y = Math.round(ly + k * 0.32 + w);
      if (!b.inside(X, Y)) continue;
      const burnt = k < 18;
      b.set(X, Y, burnt ? (noise(X, Y, 8) > 0.86 ? H('#ff7a2a') : rp([H('#0a0806'), H('#1a1410'), H('#2a2420')], 0.6 - w * 0.06, X, Y)) : rp(BARK, 0.62 - w * 0.07 + (Math.sin(k * 1.1) > 0.85 ? -0.2 : 0), X, Y));
    }
  }
  // a dropped tent peg and a coil of guy rope, a tin cup
  const gx = R.r(b.w * 0.7, b.w * 0.92), gy = R.r(b.h * 0.1, b.h * 0.3);
  b.thickLine(gx, gy, gx + 12, gy + 4, 0.8, IRON[3]); b.line(gx, gy - 1, gx + 12, gy + 3, IRON[4]); b.rect(gx - 2, gy - 2, 3, 4, IRON[2]);
  for (let t = 0; t < 26; t += 0.25) { const rr = 3 + t * 0.22; b.set(gx + 8 + Math.cos(t) * rr, gy + 18 + Math.sin(t) * rr * 0.75, (Math.floor(t * 4) % 3) ? H('#c8a868') : H('#8a6a38')); }
  // shells: camp is on the beach
  for (let i = 0; i < 10; i++) { const x = R.r(0, b.w), y = R.r(0, b.h); b.set(x, y, H('#f0e0cc')); b.set(x + 1, y, H('#c8a890')); b.set(x, y + 1, H('#a88870')); }
  for (let i = 0; i < 12; i++) pebble(b, R.r(0, b.w), R.r(0, b.h), R.r(1.5, 3), R.r(1.2, 2.2), [H('#2a2622'), H('#4a443c'), H('#6a6258'), H('#8a8276'), H('#aaa294')]);
}

const ROCK = [H('#1c1a18'), H('#2e2b28'), H('#43403b'), H('#5a5650'), H('#726d66'), H('#8c867d'), H('#a8a296')];
const GRAV = [H('#2a2420'), H('#463e36'), H('#625850'), H('#7e746a'), H('#9a9084')];
const TUSS = [H('#3a2e0e'), H('#5e4c16'), H('#86702a'), H('#ac9440'), H('#ccb45e'), H('#e6d084')];
function groundHills(b: PixelBuffer, R: Rng, seed: number) {
  fillBase(b, GRAV, (x, y) => 0.5 + (fbm(x, y, 14, seed) - 0.5) * 0.4 + grains(x, y, seed, 1.8) + grains(x + 31, y + 17, seed + 3, -1.2));
  // flat rock slabs with cracks and lichen
  for (let i = 0; i < 5; i++) {
    const cx = R.r(0, b.w), cy = R.r(0, b.h), rx = R.r(22, 46), ry = R.r(14, 26), a = R.r(-0.6, 0.6);
    blob(b, cx + 3, cy + 3, rx, ry, a, (x, y) => mix(b.get(x, y), H('#0a0806'), 0.4));
    blob(b, cx, cy, rx, ry, a, (x, y, u, v) => {
      const e = u * u + v * v + (vnoise(x, y, 5, seed + i) - 0.5) * 0.35;
      if (e > 1) return -1;
      let t = 0.58 - u * 0.15 - v * 0.2 + (e > 0.82 ? -0.2 : 0) + (fbm(x, y, 9, seed + 30 + i) - 0.5) * 0.3;
      if (Math.abs(Math.sin(x * 0.11 + y * 0.07 + i) * 30 - (y - cy)) < 0.6 && e < 0.8) t = 0.05;
      return rp(ROCK, t, x, y);
    });
    // lichen rosettes
    for (let k = 0; k < 6; k++) { const lx = cx + R.r(-rx * 0.6, rx * 0.6), ly = cy + R.r(-ry * 0.5, ry * 0.5), c = R.f() < 0.5 ? H('#d88a2a') : H('#a8b878'); blob(b, lx, ly, R.r(1.5, 3), R.r(1.5, 2.5), 0, (x, y) => (noise(Math.round(x), Math.round(y), 9) > 0.35 ? c : -1)); }
  }
  // tussock: golden tufts of long blades fanning out
  for (let i = 0; i < 9; i++) {
    const cx = R.r(0, b.w), cy = R.r(0, b.h);
    blob(b, cx + 2, cy + 3, 9, 6, 0, (x, y) => mix(b.get(x, y), H('#0a0806'), 0.35));
    for (let k = 0; k < 34; k++) {
      const a = R.r(0, 6.28), len = R.r(6, 16), bend = R.r(-0.3, 0.3);
      for (let q = 0; q < len; q++) {
        const aa = a + bend * q / len;
        const x = cx + Math.cos(aa) * q, y = cy + Math.sin(aa) * q * 0.75;
        b.set(x, y, rp(TUSS, 0.35 + q / len * 0.55 + (k % 3) * 0.05, Math.round(x), Math.round(y)));
      }
    }
  }
  for (let i = 0; i < 26; i++) pebble(b, R.r(0, b.w), R.r(0, b.h), R.r(1.5, 4), R.r(1.2, 3), ROCK.slice(1), R.r(0, 3));
}

function groundDeck(b: PixelBuffer, R: Rng) {
  const PL = [H('#2a1a0e'), H('#3e2814'), H('#58391c'), H('#704a26'), H('#8a5e32'), H('#a87a46')];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const plank = Math.floor(x / 22), px = x % 22;
    let t = 0.5 + (noise(plank, 0, 3) - 0.5) * 0.24 + Math.sin(y * 0.18 + plank * 3 + Math.sin(y * 0.03 + plank) * 4) * 0.06;
    if (px === 0) t = 0.02; else if (px === 1) t = 0.62; else if (px === 21) t -= 0.12;
    if ((y + plank * 37) % 120 === 0) t = 0.05;
    b.set(x, y, rp(PL, t, x, y));
  }
  for (let y = 10; y < b.h; y += 60) for (let x = 6; x < b.w; x += 22) { b.set(x, y + (x * 7) % 30, IRON[3]); b.set(x + 12, y + (x * 7) % 30, IRON[3]); }
  void R;
}

function groundCave(b: PixelBuffer, R: Rng, seed: number) {
  fillBase(b, ROCK, (x, y) => 0.3 + (fbm(x, y, 16, seed) - 0.5) * 0.5 + grains(x, y, seed));
  // puddles reflecting the cave's dim light
  for (let i = 0; i < 4; i++) {
    const cx = R.r(0, b.w), cy = R.r(0, b.h);
    blob(b, cx, cy, R.r(12, 26), R.r(6, 12), R.r(-0.3, 0.3), (x, y, u, v) => (u * u + v * v > 0.8 ? H('#1a2224') : rp([H('#0e1618'), H('#1a2a30'), H('#2a4048'), H('#4a6a74')], 0.5 - v * 0.4 + (Math.sin(x * 0.5) > 0.9 ? 0.3 : 0), x, y)));
  }
  for (let i = 0; i < 30; i++) pebble(b, R.r(0, b.w), R.r(0, b.h), R.r(1.5, 4), R.r(1.2, 3), ROCK.slice(0, 6), R.r(0, 3));
}

/** the time of day on the ground (night: dark and cool, a fire's warm pool), quantised and dithered */
function grade(b: PixelBuffer, tod: Tod, fire: [number, number] | null) {
  const night = tod === 'night', dusk = tod === 'dusk', dawn = tod === 'dawn';
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    let c = b.get(x, y);
    if (night) c = mix(c, H('#0a1020'), 0.62);
    else if (dusk) c = mix(c, H('#5a2a10'), 0.18);
    else if (dawn) c = mix(c, H('#4a3a5a'), 0.12);
    if (fire) {
      const d = Math.hypot(x - fire[0], (y - fire[1]) * 1.15);
      // warm light in bands (quantised), the band edges dithered
      const k = Math.max(0, 1 - d / (night ? 230 : 170));
      const band = Math.floor(k * 5 + bayer(x, y) * 0.9) / 5;
      if (band > 0) {
        const warm = night ? 0.55 : 0.22;
        c = rgba(Math.min(255, R(c) + band * 150 * warm), Math.min(255, G(c) + band * 70 * warm), Math.min(255, B(c) + band * 18 * warm), A(c));
      }
    }
    b.set(x, y, c);
  }
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

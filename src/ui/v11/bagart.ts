// V11 Backpack artwork: Mori's old field pack painted as pixel art at 1x (24 px per grid cell), in
// layers the Backpack screen stacks up with the items in between:
//   paintBag      the side panels with the tool holders, the canvas body, the rolled collar, the open
//                 compartment (dark lining, stitched cells, the zip round the opening), the leather base,
//                 the haul loop on top, the side pockets
//   paintBagOver  what sits in front of the tools: the straps across them, the mesh of the jar pocket
//   paintFlap     the lid flap closed over the opening (buckles, fern patch, wear, a scorch mark)
//   paintLid      the flap thrown back over the top: its underside, with the mesh lid pocket
//   paintScale    the brass tube spring balance the pack is weighed on (Mori weighs birds with it)
//   paintGround / paintPeg   the patch of ground the pack sits on and the peg the scale hangs from
//   paintChest    the camp stash: an old sea chest with its lid open
//   paintTag      the manila specimen tag the item card is written on
//   paintSign     the trail sign (Set off) for packing up at camp
// Everything is plain PixelBuffer painting: hue-shifted ramps lit from the top left, ordered dither,
// selective outlines.

import { PixelBuffer } from '../../art/pixel';
import type { C } from '../../art/color';
import { bayer } from '../../core/math';
import { H, noise, stitch, drawText, textWidth } from '../laptop-kit';
import type { Area } from '../../game/v11/backpack';

export const CELL = 24;
export interface Rect { x: number; y: number; w: number; h: number }

// ---------------------------------------------------------------- palettes
const CV = [H('#16150b'), H('#2b2c17'), H('#3f4223'), H('#53572f'), H('#686d3d'), H('#80854f'), H('#9a9e66'), H('#b3b67f')]; // olive canvas
const FADE = [H('#3c3d26'), H('#56583a'), H('#6e714c'), H('#868a61'), H('#a0a37b')]; // sun-faded canvas
const LT = [H('#170b04'), H('#311809'), H('#4f2a12'), H('#6d3d1b'), H('#8b5427'), H('#a86f38'), H('#c48d50')]; // leather
const BR = [H('#2a1804'), H('#5e3c06'), H('#9a6a10'), H('#d29c1c'), H('#f6cc48'), H('#fff0a0')]; // brass
const LN = [H('#0d0c07'), H('#16150d'), H('#1e1d13'), H('#27261a'), H('#323022'), H('#3e3c2b')]; // lining
const MESH = [H('#1a1f1c'), H('#2c3530'), H('#3d4a43'), H('#566a5f')];
const RUST = [H('#3a160c'), H('#5e2614'), H('#83391e'), H('#a8522c'), H('#c4703e')];
const THREAD = H('#d6c38c'), THREAD2 = H('#a8935e');
const OUT = H('#120e07');

/** pick from a ramp with ordered dithering between steps */
function rp(r: C[], t: number, x: number, y: number): C {
  const f = Math.max(0, Math.min(0.9999, t)) * (r.length - 1);
  const i = Math.floor(f);
  return f - i > 0.25 + bayer(x, y) * 0.5 ? r[Math.min(r.length - 1, i + 1)] : r[i];
}
/** smooth value noise 0..1 at a given cell size */
function vnoise(x: number, y: number, s: number, seed: number): number {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const a = noise(ix, iy, seed), b = noise(ix + 1, iy, seed), c = noise(ix, iy + 1, seed), d = noise(ix + 1, iy + 1, seed);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
/** canvas weave: a 2-tone twill plus slubs */
const weave = (x: number, y: number) => ((x + y * 2) % 4 === 0 ? -0.07 : (x * 3 + y) % 7 === 0 ? 0.04 : 0) + (noise(x, y, 31) > 0.97 ? 0.08 : 0);
/** leather grain */
const grain = (x: number, y: number) => (vnoise(x, y, 3, 41) - 0.5) * 0.18 + (noise(x, y, 43) > 0.95 ? -0.12 : 0);

function roundRect(b: PixelBuffer, r: Rect, rad: number, fn: (x: number, y: number, u: number, v: number, edge: number) => C | -1) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const dx = Math.min(x - r.x, r.x + r.w - 1 - x), dy = Math.min(y - r.y, r.y + r.h - 1 - y);
    if (dx < rad && dy < rad) {
      const cx = rad - 1 - dx, cy = rad - 1 - dy;
      if (cx * cx + cy * cy > (rad - 0.5) * (rad - 0.5)) continue;
    }
    const c = fn(x, y, (x - r.x) / Math.max(1, r.w - 1), (y - r.y) / Math.max(1, r.h - 1), Math.min(dx, dy));
    if (c !== -1) b.set(x, y, c);
  }
}
function outlineRect(b: PixelBuffer, r: Rect, rad: number, c: C) {
  const tmp = new PixelBuffer(r.w + 2, r.h + 2);
  roundRect(tmp, { x: 1, y: 1, w: r.w, h: r.h }, rad, () => 0xffffffff);
  tmp.outline(H('#000000'));
  for (let y = 0; y < tmp.h; y++) for (let x = 0; x < tmp.w; x++) if (tmp.data[y * tmp.w + x] === H('#000000')) b.set(r.x - 1 + x, r.y - 1 + y, c);
}
function rivet(b: PixelBuffer, x: number, y: number) {
  b.set(x, y, BR[4]); b.set(x + 1, y, BR[3]); b.set(x, y + 1, BR[2]); b.set(x + 1, y + 1, BR[1]);
  b.set(x - 1, y, OUT); b.set(x + 2, y + 1, OUT); b.set(x, y + 2, OUT); b.set(x + 1, y - 1, OUT);
}
/** a horizontal leather strap with stitched edges */
function strap(b: PixelBuffer, x0: number, x1: number, y: number, h = 5, lit = 0) {
  for (let x = x0; x <= x1; x++) for (let k = 0; k < h; k++) {
    const t = 0.55 + lit - k / h * 0.35 + grain(x, y + k);
    b.set(x, y + k, k === 0 ? LT[5] : k === h - 1 ? LT[1] : rp(LT, t, x, y + k));
  }
  for (let x = x0 + 1; x < x1; x += 2) { b.set(x, y + 1, LT[6]); }
  b.rect(x0, y - 1, x1 - x0 + 1, 1, OUT); b.rect(x0, y + h, x1 - x0 + 1, 1, OUT);
}
/** a brass roller buckle */
function buckle(b: PixelBuffer, x: number, y: number, w = 7, h = 7) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const edge = xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1;
    const ring = xx === 1 || yy === 1 || xx === w - 2 || yy === h - 2;
    if (edge) b.set(x + xx, y + yy, OUT);
    else if (ring) b.set(x + xx, y + yy, (xx + yy) < (w + h) / 2 ? BR[4] : BR[2]);
  }
  b.set(x + 2, y + 2, BR[5]);
  // the prong
  b.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, BR[1]);
}

// ---------------------------------------------------------------- layout

export type HolderId = 'camera' | 'binoculars' | 'jar' | 'net' | 'knife' | 'sling' | 'trowel' | 'hammer' | 'phone' | 'lamp' | 'cape' | 'pouch';
export interface BagLayout {
  W: number; H: number;
  body: Rect;
  /** the open compartment (the main grid) */
  open: Rect;
  /** every grid area's rect (main, sideL, sideR, lid) in bag coordinates */
  areas: Record<string, Rect>;
  holders: Partial<Record<HolderId, Rect>>;
  /** loops for tools without a holder of their own */
  spare: Rect[];
  /** the flap closed over the opening (hinged at its top edge) */
  flap: Rect;
  /** the flap thrown back over the top (its underside showing) */
  lid: Rect;
  loop: Rect;
  sides: boolean;
}

export function bagLayout(areas: Area[]): BagLayout {
  const main = areas.find(a => a.id === 'main') ?? { id: 'main', cols: 6, rows: 4 };
  const sides = areas.some(a => a.id === 'sideL');
  const lidA = areas.find(a => a.id === 'lid');
  const FL = sides ? 58 : 32, WALL = 8, COLLAR = 15, BASE = 15;
  const LIDH = lidA ? 40 : 24;
  const gw = main.cols * CELL, gh = main.rows * CELL;
  const body: Rect = { x: FL, y: LIDH, w: gw + WALL * 2, h: COLLAR + gh + BASE };
  const open: Rect = { x: body.x + WALL, y: body.y + COLLAR, w: gw, h: gh };
  const R0 = body.x + body.w;
  const W = R0 + FL, Hh = body.y + body.h + 12;
  const out: Record<string, Rect> = { main: open };
  const by = body.y;
  const holders: BagLayout['holders'] = {};
  const spare: Rect[] = [];
  if (!sides) {
    holders.camera = { x: 3, y: by + 3, w: 27, h: 27 };
    holders.binoculars = { x: 3, y: by + 34, w: 27, h: 21 };
    holders.jar = { x: 5, y: by + 59, w: 23, h: 27 };
    holders.net = { x: 3, y: by + 90, w: 27, h: 27 };
    holders.knife = { x: R0 + 2, y: by + 3, w: 27, h: 27 };
    holders.sling = { x: R0 + 2, y: by + 34, w: 27, h: 25 };
    holders.phone = { x: R0 + 4, y: by + 63, w: 23, h: 21 };
    spare.push({ x: R0 + 2, y: by + 88, w: 27, h: 27 });
  } else {
    holders.camera = { x: 3, y: by + 3, w: 27, h: 27 };
    holders.binoculars = { x: 31, y: by + 5, w: 25, h: 21 };
    holders.jar = { x: 4, y: by + 33, w: 23, h: 27 };
    holders.net = { x: 30, y: by + 30, w: 26, h: 30 };
    holders.knife = { x: R0 + 2, y: by + 3, w: 27, h: 27 };
    holders.sling = { x: R0 + 30, y: by + 3, w: 25, h: 27 };
    holders.phone = { x: R0 + 4, y: by + 34, w: 23, h: 21 };
    spare.push({ x: R0 + 30, y: by + 33, w: 25, h: 26 });
    const py = body.y + body.h - 4 - 2 * CELL - 4;
    out.sideL = { x: 5, y: py, w: 2 * CELL, h: 2 * CELL };
    out.sideR = { x: R0 + 5, y: py, w: 2 * CELL, h: 2 * CELL };
  }
  // tools strapped round the bottom and the top
  holders.trowel = { x: body.x - 10, y: body.y + body.h - 12, w: 24, h: 22 };
  holders.hammer = { x: R0 - 14, y: body.y + body.h - 12, w: 24, h: 22 };
  const cx = body.x + Math.round(body.w / 2);
  holders.lamp = { x: cx - 12, y: by - 15, w: 24, h: 16 };
  holders.cape = { x: body.x + 6, y: by - 11, w: Math.min(44, Math.round(body.w / 2) - 18), h: 13 };
  holders.pouch = { x: R0 - 6 - Math.min(44, Math.round(body.w / 2) - 18), y: by - 11, w: Math.min(44, Math.round(body.w / 2) - 18), h: 13 };
  const lid: Rect = { x: body.x + 5, y: 1, w: body.w - 10, h: LIDH + 4 };
  if (lidA) out.lid = { x: lid.x + Math.round((lid.w - lidA.cols * CELL) / 2), y: lid.y + 8, w: lidA.cols * CELL, h: CELL };
  const flap: Rect = { x: body.x + 2, y: body.y + 3, w: body.w - 4, h: COLLAR + gh - 2 };
  const loop: Rect = { x: cx - 7, y: by - 9, w: 14, h: 12 };
  return { W, H: Hh, body, open, areas: out, holders, spare, flap, lid, loop, sides };
}

// ---------------------------------------------------------------- the bag

/** the bag with its compartments and holders (items and tools go on top of this) */
export function paintBag(L: BagLayout): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  const { body } = L;
  // ---- side panels (seen edge-on, in shade on the right)
  const sideW = L.body.x - 2;
  for (const left of [true, false]) {
    const x0 = left ? 2 : body.x + body.w, x1 = left ? body.x : body.x + body.w + sideW;
    const r: Rect = { x: x0, y: body.y + 6, w: x1 - x0, h: body.h - 14 };
    roundRect(b, r, 4, (x, y, u, v) => {
      const t = (left ? 0.42 + u * 0.12 : 0.36 - u * 0.12) - v * 0.12 + weave(x, y) + (vnoise(x, y, 9, 7) - 0.5) * 0.12;
      return rp(CV, t, x, y);
    });
    outlineRect(b, r, 4, OUT);
    // the seam where the side meets the front
    for (let y = r.y + 2; y < r.y + r.h - 2; y++) b.set(left ? x1 - 1 : x0, y, CV[1]);
    for (let y = r.y + 4; y < r.y + r.h - 4; y += 3) b.set(left ? x1 - 3 : x0 + 2, y, THREAD2);
  }
  // ---- the body: faded olive canvas, lit from the top left, the sides bulging a little
  const bulge = (v: number) => Math.round(Math.sin(Math.PI * v) * 2);
  for (let y = body.y; y < body.y + body.h; y++) {
    const v = (y - body.y) / (body.h - 1);
    const bx0 = body.x - bulge(v), bx1 = body.x + body.w - 1 + bulge(v);
    for (let x = bx0; x <= bx1; x++) {
      const u = (x - bx0) / Math.max(1, bx1 - bx0);
      // rounded corners
      const dxl = x - bx0, dxr = bx1 - x, dyt = y - body.y, dyb = body.y + body.h - 1 - y;
      const rad = dyb < 8 ? 7 : 5;
      const dx = Math.min(dxl, dxr), dy = Math.min(dyt, dyb);
      if (dx < rad && dy < rad) { const cx = rad - 1 - dx, cy = rad - 1 - dy; if (cx * cx + cy * cy > (rad - 0.5) ** 2) continue; }
      const edge = Math.min(dx, dy);
      const wear = vnoise(x, y, 11, 3);
      let t = 0.62 - u * 0.18 - v * 0.2 + weave(x, y) + (edge < 2 ? -0.18 : edge < 4 ? -0.07 : 0);
      if (dxl < 3) t += 0.08;
      const c = wear > 0.72 && edge > 2 ? rp(FADE, t + 0.05, x, y) : rp(CV, t, x, y);
      b.set(x, y, c);
    }
  }
  // outline the body
  const tmp = new PixelBuffer(L.W, L.H);
  for (let i = 0; i < b.data.length; i++) tmp.data[i] = b.data[i];
  tmp.outline(OUT);
  for (let i = 0; i < b.data.length; i++) if (!b.data[i] && tmp.data[i]) b.data[i] = tmp.data[i];
  // ---- the leather base
  const baseY = body.y + body.h - 15;
  for (let y = baseY; y < body.y + body.h; y++) for (let x = body.x - 3; x < body.x + body.w + 3; x++) {
    if (!b.get(x, y) || b.get(x, y) === OUT) continue;
    const v = (y - baseY) / 15;
    b.set(x, y, y === baseY ? LT[1] : y === baseY + 1 ? LT[5] : rp(LT, 0.62 - v * 0.4 - (x - body.x) / body.w * 0.12 + grain(x, y), x, y));
  }
  stitch(b, body.x + 3, baseY + 4, body.x + body.w - 4, baseY + 4, THREAD, 2, 1);
  // scuffs on the base
  for (let i = 0; i < 9; i++) {
    const x = body.x + 6 + Math.floor(noise(i, 1, 77) * (body.w - 12)), y = baseY + 7 + Math.floor(noise(i, 2, 77) * 5);
    b.set(x, y, LT[6]); b.set(x + 1, y, LT[5]);
  }
  rivet(b, body.x + 4, baseY + 8); rivet(b, body.x + body.w - 6, baseY + 8);
  // ---- the rolled collar along the top, with its drawcord
  const colY = body.y;
  for (let y = colY + 1; y < colY + 14; y++) for (let x = body.x + 1; x < body.x + body.w - 1; x++) {
    if (!b.get(x, y) || b.get(x, y) === OUT) continue;
    const v = (y - colY) / 14;
    const roll = Math.sin(v * Math.PI);
    b.set(x, y, rp(CV, 0.3 + roll * 0.45 - (x - body.x) / body.w * 0.15 + weave(x, y), x, y));
  }
  b.rect(body.x + 2, colY + 13, body.w - 4, 1, CV[1]);
  b.rect(body.x + 3, colY + 3, body.w - 6, 1, CV[6]);
  // the cord: a light rope in and out of eyelets
  for (let x = body.x + 4; x < body.x + body.w - 4; x++) {
    const ey = (x - body.x) % 14 < 2;
    if (!ey) { b.set(x, colY + 8, (x % 3 === 0) ? H('#e8dcb0') : H('#c9b984')); b.set(x, colY + 9, H('#8a7a4e')); }
    else { b.set(x, colY + 8, BR[3]); b.set(x, colY + 9, BR[1]); }
  }
  // the cord lock (a wooden toggle) and the two loose ends
  const tx = body.x + body.w - 26;
  b.rect(tx, colY + 6, 5, 6, H('#5a3a1e')); b.rect(tx + 1, colY + 7, 3, 1, H('#9a6a3a')); b.set(tx + 2, colY + 9, OUT);
  for (let k = 0; k < 7; k++) { b.set(tx + 1 - (k >> 2), colY + 12 + k, H('#c9b984')); b.set(tx + 3 + (k >> 2), colY + 12 + k, H('#b8a874')); }
  // ---- the open compartment: dark lining with the cells stitched in, the zip round the edge
  const o = L.open;
  const well: Rect = { x: o.x - 3, y: o.y - 2, w: o.w + 6, h: o.h + 4 };
  roundRect(b, well, 3, (x, y, u, v) => {
    const sh = (y - well.y < 6 ? (6 - (y - well.y)) * 0.06 : 0) + (x - well.x < 4 ? (4 - (x - well.x)) * 0.04 : 0);
    return rp(LN, 0.62 - v * 0.15 - sh + weave(x, y) * 0.6 + (vnoise(x, y, 7, 13) - 0.5) * 0.1, x, y);
  });
  // the zip: teeth all round the opening
  for (let x = well.x; x < well.x + well.w; x++) {
    b.set(x, well.y - 1, (x & 1) ? H('#8c8f7c') : H('#46483c'));
    b.set(x, well.y + well.h, (x & 1) ? H('#8c8f7c') : H('#46483c'));
  }
  for (let y = well.y; y < well.y + well.h; y++) {
    b.set(well.x - 1, y, (y & 1) ? H('#8c8f7c') : H('#46483c'));
    b.set(well.x + well.w, y, (y & 1) ? H('#8c8f7c') : H('#46483c'));
  }
  // the zip puller hanging at the bottom right
  const zx = well.x + well.w - 3, zy = well.y + well.h + 1;
  b.rect(zx, zy, 3, 2, H('#a8ab98')); b.rect(zx + 1, zy + 2, 1, 4, H('#6a6c5c')); b.rect(zx, zy + 6, 3, 2, LT[3]);
  cellStitches(b, o, LN[4]);
  // ---- a sewn-on patch (rust canvas, cross-stitched) and a burn hole on the left wall
  const px = body.x + 1, py = body.y + body.h - 34;
  for (let y = py; y < py + 13; y++) for (let x = px; x < px + 8; x++) if (b.get(x, y) && b.get(x, y) !== OUT) b.set(x, y, rp(RUST, 0.55 - (y - py) / 26 + weave(x, y), x, y));
  for (let y = py; y < py + 13; y += 3) { b.set(px + 1, y, THREAD); b.set(px + 6, y + 1, THREAD); }
  b.set(body.x + body.w - 4, body.y + 30, CV[0]); b.set(body.x + body.w - 3, body.y + 31, CV[0]); b.set(body.x + body.w - 4, body.y + 31, H('#3a2a16'));
  // ---- the side pockets (canvas pouches with a dark inside)
  for (const k of ['sideL', 'sideR']) {
    const r = L.areas[k];
    if (!r) continue;
    const pr: Rect = { x: r.x - 3, y: r.y - 4, w: r.w + 6, h: r.h + 7 };
    roundRect(b, pr, 5, (x, y, u, v) => rp(CV, 0.5 - v * 0.25 - u * 0.1 + weave(x, y), x, y));
    outlineRect(b, pr, 5, OUT);
    roundRect(b, { x: r.x, y: r.y, w: r.w, h: r.h }, 2, (x, y, u, v) => rp(LN, 0.6 - v * 0.2 + weave(x, y) * 0.6, x, y));
    b.rect(pr.x + 1, pr.y + 1, pr.w - 2, 1, CV[6]);
    stitch(b, pr.x + 2, pr.y + pr.h - 2, pr.x + pr.w - 3, pr.y + pr.h - 2, THREAD, 2, 1);
    cellStitches(b, r, LN[4]);
  }
  // ---- holders (their backs)
  for (const [id, r] of Object.entries(L.holders) as [HolderId, Rect][]) holderBack(b, id, r);
  for (const r of L.spare) holderBack(b, 'knife', r, true);
  // ---- the haul loop on top
  const lp = L.loop;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * i / 12;
      const x = lp.x + lp.w / 2 - Math.cos(a) * (lp.w / 2 - k), y = lp.y + lp.h - Math.sin(a) * (lp.h - k);
      b.set(Math.round(x), Math.round(y), k === 0 ? OUT : k === 1 ? LT[5] : LT[3]);
    }
  }
  b.rect(lp.x - 1, lp.y + lp.h - 2, 4, 5, LT[3]); b.rect(lp.x + lp.w - 3, lp.y + lp.h - 2, 4, 5, LT[3]);
  b.set(lp.x, lp.y + lp.h, THREAD); b.set(lp.x + lp.w - 2, lp.y + lp.h, THREAD);
  return b;
}

/** faint stitched lines between the cells of a grid */
function cellStitches(b: PixelBuffer, r: Rect, c: C) {
  for (let gx = CELL; gx < r.w; gx += CELL) for (let y = r.y + 1; y < r.y + r.h - 1; y += 2) b.set(r.x + gx, y, c);
  for (let gy = CELL; gy < r.h; gy += CELL) for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) b.set(x, r.y + gy, c);
  // cell corner marks
  for (let gy = 0; gy <= r.h; gy += CELL) for (let gx = 0; gx <= r.w; gx += CELL) {
    const x = r.x + Math.min(gx, r.w - 1), y = r.y + Math.min(gy, r.h - 1);
    b.set(x, y, LN[5]);
  }
}

function holderBack(b: PixelBuffer, id: HolderId, r: Rect, spare = false) {
  if (id === 'cape' || id === 'pouch') {
    // a strap across the top for a rolled thing
    return;
  }
  if (id === 'lamp') return;
  if (id === 'trowel' || id === 'hammer') {
    // a short leather loop hanging off the base
    b.rect(r.x + 9, r.y - 2, 6, 6, LT[3]); b.rect(r.x + 10, r.y - 2, 4, 1, LT[5]);
    b.rect(r.x + 8, r.y - 3, 8, 1, OUT);
    return;
  }
  // a leather pocket backing sewn onto the side
  const leather = id === 'camera' || id === 'binoculars' || id === 'knife' || id === 'sling' || spare;
  const pr: Rect = { x: r.x, y: r.y + 2, w: r.w, h: r.h - 2 };
  roundRect(b, pr, 4, (x, y, u, v) => leather ? rp(LT, 0.45 - v * 0.25 - u * 0.1 + grain(x, y), x, y) : rp(CV, 0.42 - v * 0.2 + weave(x, y), x, y));
  outlineRect(b, pr, 4, OUT);
  stitch(b, pr.x + 2, pr.y + 2, pr.x + pr.w - 3, pr.y + 2, leather ? THREAD2 : THREAD, 1, 1);
  b.rect(pr.x + 2, pr.y + 3, pr.w - 4, pr.h - 6, leather ? LT[1] : CV[1]);
  rivet(b, pr.x + 2, pr.y + pr.h - 4); rivet(b, pr.x + pr.w - 4, pr.y + pr.h - 4);
}

/** what goes over the tools: a strap across each holder, the jar pocket's mesh, the bottom loops */
export function paintBagOver(L: BagLayout, filled: Set<string>): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  const strapOver = (r: Rect, yk: number, lit = 0) => {
    const y = Math.round(r.y + r.h * yk);
    strap(b, r.x - 1, r.x + r.w, y, 4, lit);
    buckle(b, r.x + r.w - 7, y - 1, 6, 6);
  };
  for (const [id, r] of Object.entries(L.holders) as [HolderId, Rect][]) {
    const has = filled.has(id);
    if (id === 'jar') {
      // the mesh pocket front
      for (let y = r.y + Math.round(r.h * 0.45); y < r.y + r.h; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if (((x + y) & 1) === 0) b.set(x, y, (y & 2) ? MESH[2] : MESH[1]);
      }
      b.rect(r.x, r.y + Math.round(r.h * 0.45) - 1, r.w, 2, CV[5]);
      b.rect(r.x, r.y + Math.round(r.h * 0.45) + 1, r.w, 1, OUT);
      continue;
    }
    if (id === 'cape' || id === 'pouch') {
      if (!has) continue;
      // two thin straps round a roll
      for (const k of [0.22, 0.72]) {
        const x = Math.round(r.x + r.w * k);
        b.rect(x, r.y - 1, 3, r.h + 2, LT[3]); b.rect(x, r.y - 1, 1, r.h + 2, LT[5]); b.rect(x + 3, r.y - 1, 1, r.h + 2, OUT);
      }
      continue;
    }
    if (id === 'lamp') continue;
    if (id === 'trowel' || id === 'hammer') {
      if (!has) continue;
      b.rect(r.x + 8, r.y + 3, 8, 3, LT[3]); b.rect(r.x + 8, r.y + 3, 8, 1, LT[5]); b.rect(r.x + 8, r.y + 6, 8, 1, OUT);
      continue;
    }
    if (id === 'net') { strapOver(r, 0.62, 0.05); continue; }
    strapOver(r, id === 'knife' ? 0.55 : 0.6, 0.05);
  }
  for (const r of L.spare) if (filled.has('spare')) strapOver(r, 0.6);
  return b;
}

// ---------------------------------------------------------------- the lid flap

/** the flap buckled shut over the opening (hinge at the top) */
export function paintFlap(L: BagLayout): PixelBuffer {
  const f = L.flap;
  const b = new PixelBuffer(f.w, f.h + 10);
  const r: Rect = { x: 1, y: 0, w: f.w - 2, h: f.h - 2 };
  roundRect(b, r, 6, (x, y, u, v, e) => {
    const wear = vnoise(x, y, 10, 21);
    const t = 0.66 - u * 0.2 - v * 0.22 + weave(x, y) + (e < 2 ? -0.16 : 0) + (y < 3 ? 0.1 : 0);
    return wear > 0.74 && e > 2 ? rp(FADE, t, x, y) : rp(CV, t, x, y);
  });
  outlineRect(b, r, 6, OUT);
  // a leather trim along the bottom edge
  for (let x = 3; x < f.w - 3; x++) for (let k = 0; k < 4; k++) {
    const y = r.y + r.h - 5 + k;
    if (b.get(x, y) && b.get(x, y) !== OUT) b.set(x, y, k === 0 ? LT[5] : rp(LT, 0.5 - k * 0.12 + grain(x, y), x, y));
  }
  stitch(b, 4, r.y + r.h - 7, f.w - 5, r.y + r.h - 7, THREAD, 2, 1);
  stitch(b, 4, 3, f.w - 5, 3, THREAD2, 2, 2);
  // the silver fern patch, a little off centre: a black oval with a curved frond
  const cx = Math.round(f.w * 0.42), cy = Math.round(r.h * 0.42);
  for (let y = -9; y <= 9; y++) for (let x = -7; x <= 7; x++) {
    const q = x * x / 49 + y * y / 81;
    if (q > 1) continue;
    b.set(cx + x, cy + y, q > 0.78 ? H('#0e0e12') : H('#1f2026'));
  }
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const sx = cx - 1 + Math.round(Math.sin(t * 2.4) * 2.2), sy = cy + 7 - i;
    b.set(sx, sy, H('#e4e8ea'));
    const len = Math.max(0, Math.round((1 - t) * 4.2 - (t < 0.12 ? 2 : 0)));
    if (i % 2 === 0) for (let k = 1; k <= len; k++) { b.set(sx + k, sy - Math.round(k * 0.4), H('#c4ccd0')); b.set(sx - k, sy - Math.round(k * 0.4), H('#aab4b8')); }
  }
  // a scorch mark from some campfire, a darn
  for (let i = 0; i < 14; i++) {
    const x = Math.round(f.w * 0.78 + Math.cos(i) * (i % 4)), y = Math.round(r.h * 0.3 + Math.sin(i * 1.7) * (i % 3));
    if (b.get(x, y) && b.get(x, y) !== OUT) b.set(x, y, i % 3 ? CV[1] : H('#2a1a0c'));
  }
  for (let k = 0; k < 6; k++) { b.set(Math.round(f.w * 0.2) + k, Math.round(r.h * 0.7) + (k & 1), THREAD2); }
  // the two straps hanging down to their buckles on the base
  for (const k of [0.24, 0.76]) {
    const x = Math.round(f.w * k) - 3;
    for (let y = r.y + r.h - 8; y < f.h + 9; y++) for (let xx = 0; xx < 6; xx++) {
      b.set(x + xx, y, xx === 0 || xx === 5 ? OUT : xx === 1 ? LT[5] : rp(LT, 0.5 + grain(x + xx, y), x + xx, y));
    }
    buckle(b, x - 1, f.h + 1, 8, 8);
    b.rect(x + 1, f.h + 4, 4, 1, LT[1]);
  }
  return b;
}

/** the flap thrown back over the top: its underside, with the zipped mesh lid pocket */
export function paintLid(L: BagLayout): PixelBuffer {
  const r = L.lid;
  const b = new PixelBuffer(r.w, r.h);
  const shape: Rect = { x: 0, y: 0, w: r.w, h: r.h };
  roundRect(b, shape, 7, (x, y, u, v, e) => {
    const t = 0.5 - v * 0.15 - u * 0.12 + weave(x, y) * 0.8 + (e < 2 ? -0.12 : 0);
    return e < 4 ? rp(CV, t + 0.05, x, y) : rp(LN, 0.75 - v * 0.2 + weave(x, y) * 0.6, x, y);
  });
  outlineRect(b, { x: 1, y: 1, w: r.w - 2, h: r.h - 2 }, 7, OUT);
  b.rect(4, 2, r.w - 8, 1, CV[6]);
  stitch(b, 5, 4, r.w - 6, 4, THREAD2, 2, 2);
  const g = L.areas.lid;
  if (g) {
    const gx = g.x - r.x, gy = g.y - r.y;
    // the mesh pocket: a dark well with a net in front and a zip along the top
    for (let y = gy; y < gy + g.h; y++) for (let x = gx; x < gx + g.w; x++) b.set(x, y, rp(LN, 0.45 + weave(x, y) * 0.5, x, y));
    for (let x = gx - 1; x <= gx + g.w; x++) { b.set(x, gy - 1, (x & 1) ? H('#8c8f7c') : H('#46483c')); }
    for (let y = gy; y < gy + g.h; y++) for (let x = gx; x < gx + g.w; x++) if (((x + y) % 4) === 0 && y > gy + 2) b.set(x, y, MESH[1]);
    cellStitches(b, { x: gx, y: gy, w: g.w, h: g.h }, LN[4]);
    b.rect(gx - 2, gy + g.h, g.w + 4, 1, CV[5]);
  } else {
    // no pocket yet: a name label stitched inside the lid
    const lx = Math.round(r.w / 2) - 14, ly = Math.round(r.h / 2) - 4;
    b.rect(lx, ly, 28, 9, H('#e8dcb8')); b.rect(lx, ly + 8, 28, 1, H('#a8986c'));
    stitch(b, lx, ly - 1, lx + 27, ly - 1, THREAD2, 1, 1);
    // M. T. scrawled in marker
    const ink = H('#2a2a4a');
    for (const [x, y] of [[4, 2], [4, 3], [4, 4], [4, 5], [5, 3], [6, 4], [7, 3], [8, 2], [8, 3], [8, 4], [8, 5], [10, 5], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [15, 3], [15, 4], [15, 5], [19, 5]]) b.set(lx + x + 2, ly + y, ink);
  }
  return b;
}

// ---------------------------------------------------------------- the spring balance

/** a brass tube spring balance (Pesola style): the tube with its scale, and the pull rod + hook
 *  (drawn separately so the screen can slide the rod out with the weight) */
export function paintScale(): { tube: PixelBuffer; rod: PixelBuffer; ring: PixelBuffer } {
  const TW = 11, TH = 52;
  const tube = new PixelBuffer(TW, TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const u = x / (TW - 1);
    const cap = y < 4 || y >= TH - 4;
    if (x === 0 || x === TW - 1) { tube.set(x, y, OUT); continue; }
    if (cap) { tube.set(x, y, rp(BR, 0.85 - u * 0.7, x, y)); continue; }
    // clear tube over a yellow-green scale card
    const glint = x === 2 || x === 3;
    const c = glint ? H('#f4f2d0') : x > 7 ? H('#7a9a3a') : H('#c8d86a');
    tube.set(x, y, c);
  }
  // the scale markings
  for (let y = 6; y < TH - 6; y += 2) { tube.set(5, y, H('#2a3a10')); if (((y - 6) / 2) % 5 === 0) { tube.set(6, y, H('#2a3a10')); tube.set(7, y, H('#2a3a10')); } }
  // the red zone near the bottom (over capacity)
  for (let y = TH - 14; y < TH - 5; y++) for (let x = 6; x < 9; x++) tube.set(x, y, H('#c83a24'));
  tube.rect(0, 0, TW, 1, OUT); tube.rect(0, TH - 1, TW, 1, OUT);
  const ring = new PixelBuffer(13, 13);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
    const d = Math.hypot(x - 6, y - 6);
    if (d < 6.2 && d > 3.6) ring.set(x, y, d > 5.4 || d < 4.3 ? OUT : (x + y < 12 ? BR[4] : BR[2]));
  }
  const rod = new PixelBuffer(13, 34);
  for (let y = 0; y < 22; y++) { rod.set(5, y, OUT); rod.set(6, y, H('#d8dad0')); rod.set(7, y, OUT); }
  // the hook
  const hk: [number, number][] = [];
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (i / 14) * 1.3 - 0.15; hk.push([6 + Math.sin(a) * 4.5, 26 + Math.cos(a) * 5]); }
  for (const [x, y] of hk) { rod.set(Math.round(x), Math.round(y), BR[3]); rod.set(Math.round(x) + 1, Math.round(y), OUT); }
  rod.rect(5, 21, 3, 2, BR[2]);
  return { tube, rod, ring };
}

/** the peg (a stub of branch, a nail in a post) the balance hangs from */
export function paintPeg(kind: GroundKind): PixelBuffer {
  const b = new PixelBuffer(60, 12);
  const wood = kind === 'deck' ? [H('#2a1a0c'), H('#5a3a1e'), H('#7a5028'), H('#9c6a36')] : [H('#1e140a'), H('#3e2a16'), H('#5c4024'), H('#7a5a36')];
  for (let x = 0; x < 60; x++) {
    const th = 5 + Math.round(Math.sin(x * 0.11) * 1.2) - (x > 44 ? Math.floor((x - 44) / 4) : 0);
    for (let y = 0; y < th; y++) b.set(x, 3 + y, y === 0 ? wood[3] : y === th - 1 ? wood[0] : rp(wood, 0.6 - y / th * 0.5 + (noise(x >> 1, y, 5) - 0.5) * 0.3, x, y));
  }
  if (kind === 'forest') for (let x = 4; x < 40; x += 3) { b.set(x, 2, H('#4a7a2a')); b.set(x + 1, 2, H('#6a9a3a')); if (x % 2) b.set(x, 1, H('#3a6a22')); }
  return b;
}

export type GroundKind = 'sand' | 'forest' | 'deck' | 'rock';
/** the ground the pack sits on: a strip with a soft shadow under the bag, a few pebbles and leaves */
export function paintGround(kind: GroundKind, w: number, h: number, shadow: Rect | null): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const pal = kind === 'sand' ? [H('#7a6646'), H('#9a845c'), H('#b8a072'), H('#d2bc8c'), H('#e6d4a6')]
    : kind === 'forest' ? [H('#1e1a10'), H('#2e2716'), H('#3e3520'), H('#52462a'), H('#6a5a36')]
      : kind === 'deck' ? [H('#2a1a0c'), H('#4a3018'), H('#6a4424'), H('#8a5c32'), H('#a87444')]
        : [H('#2a2a2a'), H('#3e3e3a'), H('#55554e'), H('#6e6e66'), H('#8a8a80')];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = y / (h - 1);
    // the top edge fades out into the dark
    const fade = Math.min(1, y / 6);
    let t = 0.35 + v * 0.35 + (vnoise(x, y, 6, 9) - 0.5) * 0.3;
    if (kind === 'deck') t += ((x % 22) === 0 ? -0.4 : 0) + (vnoise(x >> 3, y, 2, 17) - 0.5) * 0.2;
    if (shadow) {
      const dx = (x - (shadow.x + shadow.w / 2)) / (shadow.w / 2 + 6), dy = (y - shadow.y) / 7;
      const d = dx * dx + dy * dy;
      if (d < 1) t -= (1 - d) * 0.5;
    }
    const c = rp(pal, t, x, y);
    if (fade < 1 && bayer(x, y) > fade) continue;
    b.set(x, y, c);
  }
  // pebbles, twigs, leaves
  for (let i = 0; i < Math.round(w / 18); i++) {
    const x = Math.floor(noise(i, 3, 91) * w), y = 7 + Math.floor(noise(i, 4, 91) * (h - 9));
    if (shadow && x > shadow.x - 4 && x < shadow.x + shadow.w + 4 && y < shadow.y + 6) continue;
    const k = noise(i, 5, 91);
    if (kind === 'forest' && k < 0.5) { b.set(x, y, H('#5a7a2a')); b.set(x + 1, y, H('#7a9a3a')); b.set(x + 1, y - 1, H('#4a6a22')); }
    else if (kind === 'sand' && k < 0.3) { b.set(x, y, H('#f0e6d0')); b.set(x + 1, y, H('#c8b8a0')); }
    else { b.set(x, y, pal[0]); b.set(x + 1, y, pal[1]); b.set(x, y - 1, pal[4]); }
  }
  return b;
}

// ---------------------------------------------------------------- the camp stash (a sea chest)

export interface ChestLayout { W: number; H: number; grid: Rect; lid: Rect }
export function chestLayout(cols: number, rows: number): ChestLayout {
  const gw = cols * CELL, gh = rows * CELL;
  const lid: Rect = { x: 4, y: 0, w: gw + 20, h: 26 };
  const grid: Rect = { x: 14, y: lid.h + 10, w: gw, h: gh };
  return { W: gw + 28, H: lid.h + 10 + gh + 16, grid, lid };
}
export function paintChest(L: ChestLayout): PixelBuffer {
  const b = new PixelBuffer(L.W, L.H);
  const WD = [H('#1e1008'), H('#3a2210'), H('#5a3618'), H('#7a4c24'), H('#9a6432'), H('#b47e44')];
  // the open lid standing up behind (its inside, darker)
  const lr = L.lid;
  roundRect(b, lr, 4, (x, y, u, v) => rp(WD, 0.32 + v * 0.18 - u * 0.12 + (vnoise(x, y >> 2, 4, 61) - 0.5) * 0.2, x, y));
  outlineRect(b, lr, 4, OUT);
  for (let x = lr.x + 4; x < lr.x + lr.w - 4; x += 1) { b.set(x, lr.y + 8, WD[1]); b.set(x, lr.y + 16, WD[1]); }
  // a faded shipping stencil inside the lid
  const sy = lr.y + 10, sx = lr.x + 10;
  for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [0, 4], [1, 4], [2, 4], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [6, 0], [7, 1], [6, 2], [9, 0], [10, 0], [11, 0], [10, 1], [10, 2], [10, 3], [10, 4]]) b.set(sx + x, sy + y, H('#8a6a44'));
  // the box
  const box: Rect = { x: 2, y: lr.h + 2, w: L.W - 4, h: L.H - lr.h - 4 };
  roundRect(b, box, 3, (x, y, u, v) => rp(WD, 0.62 - v * 0.3 - u * 0.15 + ((y - box.y) % 9 === 0 ? -0.25 : 0) + (vnoise(x, y >> 2, 4, 63) - 0.5) * 0.18, x, y));
  outlineRect(b, box, 3, OUT);
  // brass corners and a hasp
  for (const [x, y] of [[box.x, box.y], [box.x + box.w - 6, box.y], [box.x, box.y + box.h - 6], [box.x + box.w - 6, box.y + box.h - 6]]) {
    b.rect(x, y, 6, 6, BR[2]); b.rect(x + 1, y + 1, 4, 1, BR[4]); b.set(x + 2, y + 3, OUT);
  }
  // the inside (where the grid is)
  const g = L.grid;
  roundRect(b, { x: g.x - 3, y: g.y - 3, w: g.w + 6, h: g.h + 6 }, 2, (x, y, u, v) => rp(WD, 0.12 + v * 0.1 + ((x - g.x) % 12 === 0 ? -0.08 : 0), x, y));
  for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) b.set(x, y, rp([H('#120a04'), H('#1c1208'), H('#28190c'), H('#34220f')], 0.5 - (y - g.y) / g.h * 0.2 + (noise(x >> 3, y, 7) - 0.5) * 0.2 + ((x - g.x) % 24 === 0 ? -0.2 : 0), x, y));
  cellStitches(b, g, H('#4a3218'));
  b.rect(g.x - 3, g.y - 4, g.w + 6, 1, WD[5]);
  b.rect(box.x + Math.round(box.w / 2) - 3, box.y - 1, 6, 5, BR[3]);
  return b;
}

// ---------------------------------------------------------------- paper

/** a manila specimen tag: a reinforced hole at the top, clipped corners, foxing, faint ruled lines */
export function paintTag(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const P = [H('#9a7e4a'), H('#b89a62'), H('#cdb27a'), H('#dcc48e'), H('#e8d4a2'), H('#f2e2b8')];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cut = 8;
    if (y < cut && (x < cut - y || x > w - 1 - (cut - y))) continue;
    const e = Math.min(x, w - 1 - x, y, h - 1 - y);
    const fox = vnoise(x, y, 9, 71);
    let t = 0.72 - y / h * 0.12 + (fox > 0.78 ? -0.18 : 0) + (noise(x, y, 73) > 0.96 ? -0.1 : 0) + (e < 2 ? -0.15 : 0);
    if (y > 30 && (y - 30) % 9 === 0 && x > 6 && x < w - 6) t -= 0.08;
    b.set(x, y, rp(P, t, x, y));
  }
  b.outline(H('#4a3818'));
  // the reinforced hole
  const cx = Math.round(w / 2), cy = 7;
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    const d = Math.hypot(x, y);
    if (d <= 5) b.set(cx + x, cy + y, d < 2.2 ? 0 : d < 3 ? H('#5a4628') : H('#c8a868'));
  }
  return b;
}

/** the impression an item leaves on the lining: its footprint cells, a pixel gap round the outside
 *  of the shape, lit on the top / left edge and shaded on the bottom / right */
export function paintFootprint(cs: [number, number][], w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w * CELL, h * CELL);
  const on = new Set(cs.map(([x, y]) => x + ',' + y));
  const has = (x: number, y: number) => on.has(x + ',' + y);
  const FILL = [H('#2f2d20', 230), H('#353324', 230)], LIT = H('#4e4b36', 240), DARK = H('#0e0d07', 230);
  for (const [cx, cy] of cs) for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const l = !has(cx - 1, cy), r = !has(cx + 1, cy), t = !has(cx, cy - 1), d = !has(cx, cy + 1);
    if ((l && x === 0) || (r && x === CELL - 1) || (t && y === 0) || (d && y === CELL - 1)) continue;
    // chamfered outside corners
    const cl = l && x <= 1, cr = r && x >= CELL - 2, ct = t && y <= 1, cd = d && y >= CELL - 2;
    if ((cl && ct) || (cr && ct) || (cl && cd) || (cr && cd)) continue;
    const gx = cx * CELL + x, gy = cy * CELL + y;
    const c = (t && y === 1) || (l && x === 1) ? LIT : (d && y === CELL - 2) || (r && x === CELL - 2) ? DARK : FILL[(gx + gy * 2) % 4 === 0 ? 1 : 0];
    b.set(gx, gy, c);
  }
  return b;
}

/** the paper tag on the spring balance: the load in inked pixel digits, "of" the comfortable load */
export function paintWeightTag(kg: number, cap: number): PixelBuffer {
  const b = paintTag(34, 28);
  const over = kg > cap;
  const ink = over ? H('#a8281a') : H('#2a2414'), soft = H('#7a6640');
  const t = kg < 10 ? kg.toFixed(1) : String(Math.round(kg));
  const tw = textWidth(t) + 1 + textWidth('KG');
  const x0 = Math.round((34 - tw) / 2);
  drawText(b, t, x0, 14, ink);
  drawText(b, 'KG', x0 + textWidth(t) + 2, 14, ink);
  const c = 'OF ' + Math.round(cap);
  drawText(b, c, Math.round((34 - textWidth(c)) / 2), 21, soft);
  if (over) for (let x = 4; x < 30; x++) if (x % 3) b.set(x, 12, H('#c83a24'));
  return b;
}

/** the trail sign, for "Set off" when packing up at camp */
export function paintSign(): PixelBuffer {
  const b = new PixelBuffer(64, 70);
  const WD = [H('#1e1008'), H('#3a2210'), H('#5a3618'), H('#7a4c24'), H('#9a6432'), H('#b47e44')];
  // the post
  for (let y = 14; y < 70; y++) for (let x = 28; x < 35; x++) b.set(x, y, x === 28 || x === 34 ? OUT : rp(WD, 0.6 - (x - 28) / 10 + (noise(x, y >> 1, 3) - 0.5) * 0.2, x, y));
  // the arrow board pointing right
  const pts: [number, number][] = [];
  for (let y = 4; y < 26; y++) for (let x = 4; x < 62; x++) {
    const tip = x > 50 ? (x - 50) * 0.95 : 0;
    if (y - 4 < tip * 0.0 || Math.abs(y - 15) > 11 - tip) continue;
    pts.push([x, y]);
    b.set(x, y, rp(WD, 0.7 - (y - 4) / 30 + ((y - 4) % 7 === 0 ? -0.2 : 0) + (noise(x >> 2, y, 9) - 0.5) * 0.15, x, y));
  }
  b.outline(OUT);
  for (const [x, y] of [[10, 9], [10, 21]]) { b.set(x, y, BR[3]); b.set(x + 1, y, BR[1]); }
  return b;
}

/** a crisp whole-pixel reduction of an image (for showing big artwork in a small holder) */
export function shrinkTo(src: HTMLCanvasElement | HTMLImageElement, maxW: number, maxH: number): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const k = Math.max(1, Math.ceil(Math.max(w / maxW, h / maxH)));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.floor(w / k)); out.height = Math.max(1, Math.floor(h / k));
  if (k === 1) { out.getContext('2d')!.drawImage(src, 0, 0); return out; }
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  // (read back on the CPU: no GPU round trip)
  const tg = tmp.getContext('2d', { willReadFrequently: true })!;
  tg.drawImage(src, 0, 0);
  const sd = tg.getImageData(0, 0, w, h).data;
  const og = out.getContext('2d')!;
  const od = og.createImageData(out.width, out.height);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    let r = 0, g = 0, bb = 0, a = 0, n = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const p = ((y * k + j) * w + (x * k + i)) * 4;
      const al = sd[p + 3];
      r += sd[p] * al; g += sd[p + 1] * al; bb += sd[p + 2] * al; a += al; n++;
    }
    const q = (y * out.width + x) * 4;
    if (a / n < 70) continue;
    od.data[q] = r / a; od.data[q + 1] = g / a; od.data[q + 2] = bb / a; od.data[q + 3] = 255;
  }
  og.putImageData(od, 0, 0);
  return out;
}

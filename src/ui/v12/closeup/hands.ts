// Mori's gloved hands in the close-ups: hand-drawn glove poses (sprites.ts) on the end of his olive
// shirt sleeve, which runs in from the edge of the set. A pose has an anchor (where the tool handle,
// the palm or the pinch is) so a scene just says where the action happens.

import { PixelBuffer, pmap, rd, ramp, dith, blit } from './kit';
import { GRIP, OPEN, PINCH, GLOVE_PAL } from './sprites';

export type Pose = 'grip' | 'open' | 'pinch';
interface PoseDef { b: PixelBuffer; ax: number; ay: number; wx: number; wy: number }
const SLEEVE = ramp('#1a200e', '#283214', '#36441c', '#4a5a26', '#5e7030', '#76883e', '#94a452');

let defs: Record<string, PoseDef> | null = null;
function rot90(b: PixelBuffer): PixelBuffer {
  // a quarter turn clockwise (exact, so the pixels stay as drawn)
  const o = new PixelBuffer(b.h, b.w);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) o.data[x * o.w + (b.h - 1 - y)] = b.data[y * b.w + x];
  return o;
}
function flipX(b: PixelBuffer): PixelBuffer {
  const o = new PixelBuffer(b.w, b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) o.data[y * b.w + (b.w - 1 - x)] = b.data[y * b.w + x];
  return o;
}
function pose(p: Pose, rot: 0 | 1 | 2 | 3, mirror: boolean): PoseDef {
  if (!defs) defs = {};
  const key = p + rot + (mirror ? 'm' : '');
  const hit = defs[key];
  if (hit) return hit;
  const base: PoseDef = p === 'grip' ? { b: pmap(GRIP, GLOVE_PAL), ax: 11, ay: 5, wx: 12, wy: 19 }
    : p === 'open' ? { b: pmap(OPEN, GLOVE_PAL), ax: 13, ay: 10, wx: 14, wy: 24 }
      : { b: pmap(PINCH, GLOVE_PAL), ax: 2, ay: 2, wx: 12, wy: 18 };
  let d = base;
  if (mirror) d = { b: flipX(d.b), ax: d.b.w - 1 - d.ax, ay: d.ay, wx: d.b.w - 1 - d.wx, wy: d.wy };
  for (let i = 0; i < rot; i++) d = { b: rot90(d.b), ax: d.b.h - 1 - d.ay, ay: d.ax, wx: d.b.h - 1 - d.wy, wy: d.wx };
  defs[key] = d;
  return d;
}

/** the shirt sleeve from (x0, y0) (off the edge of the set) to the wrist at (x1, y1) */
export function drawSleeve(px: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r = 7) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / L, uy = dy / L;
  const minx = Math.floor(Math.min(x0, x1) - r - 2), maxx = Math.ceil(Math.max(x0, x1) + r + 2);
  const miny = Math.floor(Math.min(y0, y1) - r - 2), maxy = Math.ceil(Math.max(y0, y1) + r + 2);
  for (let y = Math.max(0, miny); y <= Math.min(px.h - 1, maxy); y++) for (let x = Math.max(0, minx); x <= Math.min(px.w - 1, maxx); x++) {
    const rx = x + 0.5 - x0, ry = y + 0.5 - y0;
    const t = rx * ux + ry * uy;
    if (t < -2 || t > L + 1) continue;
    const d = rx * -uy + ry * ux;
    // the sleeve tapers a touch toward the cuff
    const rr = r * (1 - 0.12 * (t / L));
    if (Math.abs(d) > rr) continue;
    const edge = Math.abs(d) > rr - 1;
    let k = 0.62 - d / rr * 0.38;
    // cloth folds: soft creases across the sleeve, a little irregular
    const fold = Math.sin(t * 0.42 + Math.sin(t * 0.11) * 2 + d * 0.15);
    if (fold > 0.72) k -= 0.22; else if (fold > 0.5) k += 0.1;
    // the hem at the wrist
    if (t > L - 3) k = t > L - 1 ? 0.2 : 0.7;
    px.set(x, y, edge ? SLEEVE[0] : rd(SLEEVE, k, x, y));
  }
  // a seam down the sleeve, stitched
  for (let i = 4; i < L - 4; i += 3) {
    const sx = Math.round(x0 + ux * i - uy * r * 0.45), sy = Math.round(y0 + uy * i + ux * r * 0.45);
    if (dith(sx, sy) < 0.7) px.set(sx, sy, SLEEVE[2]);
  }
}

export interface HandOpts {
  /** quarter turns clockwise (1: the fingers point right) */
  rot?: 0 | 1 | 2 | 3;
  /** the left hand */
  left?: boolean;
  /** where the sleeve comes in from (default: straight down off the bottom of the set) */
  from?: [number, number];
  /** sleeve radius */
  r?: number;
  /** darken (in shadow) */
  dark?: number;
}
/** draw a gloved hand with its anchor at (x, y), the sleeve running in from o.from */
export function drawHand(px: PixelBuffer, p: Pose, x: number, y: number, o: HandOpts = {}) {
  const d = pose(p, o.rot ?? 0, !!o.left);
  const left = Math.round(x - d.ax), top = Math.round(y - d.ay);
  const wx = left + d.wx, wy = top + d.wy;
  const from = o.from ?? [wx + (o.left ? -18 : 18), px.h + 30];
  drawSleeve(px, from[0], from[1], wx, wy, o.r ?? 7);
  blit(px, d.b, left, top, { dark: o.dark });
}
/** where the wrist of a pose lands when its anchor is at (x, y) */
export function wristOf(p: Pose, x: number, y: number, o: HandOpts = {}): [number, number] {
  const d = pose(p, o.rot ?? 0, !!o.left);
  return [Math.round(x - d.ax) + d.wx, Math.round(y - d.ay) + d.wy];
}

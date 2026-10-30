// Mori's gloved hands in the close-ups: hand-drawn glove poses (sprites.ts), brought up to the fine
// grid with the EPX scaler and rim-lit, on the end of his olive shirt sleeve, which runs in from the
// edge of the set with its folds and seam painted at the fine grid. A pose has an anchor (where the
// tool handle, the palm or the pinch is) so a scene just says where the action happens (in units).

import { PixelBuffer, pmap, rd, ramp, dith, blitF, up, area, vnoise, Z } from './kit';
import { GRIP, OPEN, PINCH, GLOVE_PAL } from './sprites';

export type Pose = 'grip' | 'open' | 'pinch';
interface PoseDef { b: PixelBuffer; ax: number; ay: number; wx: number; wy: number }
const SLEEVE = ramp('#161c0c', '#222c12', '#303c18', '#404e20', '#52622a', '#667834', '#7e9040', '#98aa54');

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
/** the pose at 1 px per map pixel (anchor and wrist in map pixels) */
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

/** the shirt sleeve from (x0, y0) (off the edge of the set) to the wrist at (x1, y1), units */
export function drawSleeve(px: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r = 7) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / L, uy = dy / L;
  area(px, Math.min(x0, x1) - r - 2, Math.min(y0, y1) - r - 2, Math.max(x0, x1) + r + 2, Math.max(y0, y1) + r + 2, (u, v, fx, fy) => {
    const rx = u - x0, ry = v - y0;
    const t = rx * ux + ry * uy;
    if (t < -2 || t > L + 0.5) return -1;
    const d = rx * -uy + ry * ux;
    const rr = r * (1 - 0.1 * (t / L));
    if (Math.abs(d) > rr) return -1;
    if (Math.abs(d) > rr - 0.7) return SLEEVE[0];
    // round across the arm, lit from the upper left
    let k = 0.6 - d / rr * 0.42 - (d / rr) ** 2 * 0.12;
    // cloth folds: soft creases across the sleeve that bunch toward the cuff
    const f = Math.sin(t * 0.22 + Math.sin(t * 0.07 + d * 0.25) * 2.6 + d * 0.18 + vnoise(t * 0.1, d * 0.3, 8) * 2);
    if (f > 0.86) k -= 0.17; else if (f > 0.7) k -= 0.07; else if (f < -0.75) k += 0.06;
    k += (vnoise(u * 2, v * 2, 5) - 0.5) * 0.08;
    // the hem at the wrist: a turned-back band with its stitching
    if (t > L - 3.2) { k = t > L - 0.6 ? 0.15 : 0.72 - (t - (L - 3.2)) * 0.1; if (Math.abs(t - (L - 2.2)) < 0.25 && (fx + fy) % 3 === 0) return SLEEVE[7]; }
    return rd(SLEEVE, k, fx, fy);
  });
  // a stitched seam along the sleeve
  for (let i = 4; i < L - 4; i += 1.2) {
    const sx = x0 + ux * i - uy * r * 0.42, sy = y0 + uy * i + ux * r * 0.42;
    const fx = Math.round(sx * Z), fy = Math.round(sy * Z);
    if ((Math.floor(i / 1.2) % 2) && dith(fx, fy) < 0.9) px.set(fx, fy, SLEEVE[2]);
  }
}

export interface HandOpts {
  /** quarter turns clockwise (1: the fingers point right) */
  rot?: 0 | 1 | 2 | 3;
  /** the left hand */
  left?: boolean;
  /** where the sleeve comes in from (units; default: straight down off the bottom of the set) */
  from?: [number, number];
  /** sleeve radius (units) */
  r?: number;
  /** darken (in shadow) */
  dark?: number;
}
/** draw a gloved hand with its anchor at (x, y) units, the sleeve running in from o.from */
export function drawHand(px: PixelBuffer, p: Pose, x: number, y: number, o: HandOpts = {}) {
  const d = pose(p, o.rot ?? 0, !!o.left);
  const fine = up(d.b, Z);
  const left = Math.round(x * Z - (d.ax + 0.5) * Z), top = Math.round(y * Z - (d.ay + 0.5) * Z);
  const wx = (left + (d.wx + 0.5) * Z) / Z, wy = (top + (d.wy + 0.5) * Z) / Z;
  const from = o.from ?? [wx + (o.left ? -18 : 18), px.h / Z + 30];
  drawSleeve(px, from[0], from[1], wx, wy, o.r ?? 7);
  blitF(px, fine, left, top, { dark: o.dark });
}

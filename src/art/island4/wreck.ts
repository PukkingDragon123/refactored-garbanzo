// V4 island: the aft half of the Kittiwake, thrown up the beach by the wave. Built from the ship's own
// art (so every room is the one you walked around that morning), then wrecked: the deckhouse is gone
// (just splintered stumps), the forward end is torn open with ribs and cables hanging out, the hull is
// holed at the hold where you can climb in, barnacles and weed along the waterline, sand drifted in
// over the floor and a dune piled against the keel.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import { clamp, fbm1, hash2, noise1, noise2 } from '../../core/math';
import { paintShip4, S4 } from '../ship4';
import { WRECK } from './layout';

/** wreck space = ship space x [SX0, SX1), y [SY0, SY1) */
export const WSP = { SX0: WRECK.sx0, SX1: WRECK.sx1, SY0: 196, SY1: 392 };

export interface WreckArt {
  /** island-space top-left of every buffer */
  x: number;
  y: number;
  /** far bulwark and deck gear (behind everything) */
  back: PixelBuffer;
  /** the lower deck rooms (visible through the breach, and when you are inside) */
  inner: PixelBuffer;
  /** the hull side (fades away while you are inside) */
  hull: PixelBuffer;
  /** near rail and the sand drift against the keel (always in front) */
  front: PixelBuffer;
  /** puddles on the cabin sole (drawn again with the water material) */
  wet: PixelBuffer;
  /** skylights / holes that throw light shafts: island-space [x, y, width] */
  shafts: [number, number, number][];
}

let cache: WreckArt | null = null;

export function paintWreck(): WreckArt {
  if (cache) return cache;
  const ship = paintShip4({});
  const W = WSP.SX1 - WSP.SX0, H = WSP.SY1 - WSP.SY0;
  const mk = () => new PixelBuffer(W, H);
  const back = mk(), inner = mk(), hull = mk(), front = mk(), wet = mk();
  const blit = (dst: PixelBuffer, sp: { buf: PixelBuffer; x: number; y: number }, keep?: (sx: number, sy: number) => boolean) => {
    for (let j = 0; j < sp.buf.h; j++) for (let i = 0; i < sp.buf.w; i++) {
      const v = sp.buf.data[j * sp.buf.w + i];
      if (!(v >>> 24)) continue;
      const sx = sp.x + i, sy = sp.y + j;
      const X = sx - WSP.SX0, Y = sy - WSP.SY0;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      if (keep && !keep(sx, sy)) continue;
      dst.data[Y * W + X] = v;
    }
  };
  // deck gear only up to the aft ladder; the deckhouse and everything on it went over the side
  blit(back, ship.deckBack, (sx, sy) => sy > S4.main.y - 14 || sx < 480);
  blit(inner, ship.lower);
  blit(hull, ship.hull);
  blit(front, ship.deckFront);
  const at = (b: PixelBuffer, sx: number, sy: number) => {
    const X = Math.round(sx) - WSP.SX0, Y = Math.round(sy) - WSP.SY0;
    return X >= 0 && Y >= 0 && X < W && Y < H ? Y * W + X : -1;
  };
  const set = (b: PixelBuffer, sx: number, sy: number, c: C) => { const i = at(b, sx, sy); if (i >= 0) b.data[i] = c; };
  const get = (b: PixelBuffer, sx: number, sy: number) => { const i = at(b, sx, sy); return i >= 0 ? b.data[i] : 0; };
  const all = [back, inner, hull, front];

  // ---- torn forward end: a ragged vertical tear with bent frames and cables
  const tearX = (sy: number) => 928 + (noise1(sy / 9, 3) - 0.5) * 46 + (sy > 330 ? (sy - 330) * 0.35 : 0);
  for (let sy = WSP.SY0; sy < WSP.SY1; sy++) {
    const tx = tearX(sy);
    for (let sx = Math.floor(tx); sx < WSP.SX1; sx++) for (const b of all) set(b, sx, sy, 0);
    for (let k = 1; k <= 2; k++) {
      if (get(hull, tx - k, sy) >>> 24) set(hull, tx - k, sy, k === 1 ? hex('#2a2624') : hex('#6a5e52'));
      if (get(inner, tx - k, sy) >>> 24) set(inner, tx - k, sy, hex('#1a1614'));
    }
  }
  for (const sy of [286, 304, 322, 340]) {
    const tx = tearX(sy);
    const len = 8 + hash2(sy, 1, 5) * 12;
    for (let k = 0; k < len; k++) { set(hull, tx - 2 + k, sy + k * 0.35, hex('#7a4a2e')); set(hull, tx - 2 + k, sy + 1 + k * 0.35, hex('#4a2e1e')); }
  }
  for (let i = 0; i < 5; i++) {
    const x0 = 880 + i * 12, len = 18 + hash2(i, 2, 7) * 30;
    for (let k = 0; k < len; k++) set(inner, x0 + Math.sin(k * 0.2 + i) * 2, S4.lower.ceil + 2 + k, [hex('#c8402e'), hex('#2a2a30'), hex('#e8b840')][i % 3]);
  }

  // ---- the breach at the hold: a torn hole you can climb through
  const [b0, b1] = [WRECK.breach[0] - WRECK.dx, WRECK.breach[1] - WRECK.dx];
  const bcx = (b0 + b1) / 2, bcy = 334, brx = (b1 - b0) / 2, bry = 34;
  for (let sy = bcy - bry - 6; sy < bcy + bry + 6; sy++) for (let sx = b0 - 10; sx < b1 + 10; sx++) {
    const nx = (sx - bcx) / brx, ny = (sy - bcy) / bry;
    const q = nx * nx + ny * ny + (noise2(sx / 7, sy / 7, 11) - 0.5) * 0.5;
    if (q < 1) set(hull, sx, sy, 0);
    else if (q < 1.18 && get(hull, sx, sy) >>> 24) set(hull, sx, sy, hash2(sx, sy, 12) < 0.5 ? hex('#f0ead8') : hex('#5a4a3a'));
    else if (q < 1.35 && get(hull, sx, sy) >>> 24 && hash2(sx, sy, 13) < 0.4) set(hull, sx, sy, hex('#8a4a2a'));
  }
  // punctures elsewhere in the hull, showing the dark rooms behind
  for (const [hx, hy, r] of [[250, 318, 7], [700, 306, 5], [790, 340, 6], [360, 346, 4]] as const) {
    for (let sy = hy - r - 2; sy <= hy + r + 2; sy++) for (let sx = hx - r - 2; sx <= hx + r + 2; sx++) {
      const q = ((sx - hx) / r) ** 2 + ((sy - hy) / (r * 0.8)) ** 2 + (noise2(sx / 3, sy / 3, 17) - 0.5) * 0.6;
      if (q < 1) set(hull, sx, sy, 0);
      else if (q < 1.4 && get(hull, sx, sy) >>> 24) set(hull, sx, sy, hex('#5a4638'));
    }
  }

  // ---- the deckhouse stumps: splintered frames along the deck where the house stood
  for (let sx = 520; sx < 900; sx++) {
    if (sx > tearX(S4.main.y)) break;
    const hgt = Math.max(0, (fbm1(sx / 14, 3, 21) - 0.45) * 30) * (sx % 40 < 6 ? 1.7 : 1);
    for (let k = 0; k < hgt; k++) set(back, sx, S4.main.y - 1 - k, k > hgt - 2 ? hex('#3a2a1e') : sx % 40 < 6 ? hex('#56392a') : k > hgt - 4 ? hex('#8a7a66') : hex('#c8c0ae'));
  }
  // a hole in the deck above the hold (a light shaft falls through it)
  for (let sx = 560; sx < 600; sx++) for (let sy = S4.lower.ceil - 6; sy < S4.lower.ceil + 4; sy++) if (noise2(sx / 5, sy / 3, 23) > 0.3) { set(inner, sx, sy, 0); set(back, sx, sy, 0); }

  // ---- weathering: weed and barnacles at the waterline, paint scraped to primer, rust
  for (let sx = WSP.SX0; sx < WSP.SX1; sx++) for (let sy = 346; sy < WSP.SY1; sy++) {
    const i = at(hull, sx, sy);
    if (i < 0 || !(hull.data[i] >>> 24)) continue;
    const n = noise2(sx / 6, sy / 4, 31);
    if (sy > 356 && n > 0.55) hull.data[i] = mix(hull.data[i], hex('#3e5a2a'), 0.6);
    if (sy > 362 && hash2(sx, sy, 32) < 0.08) hull.data[i] = hex('#d8d0c0');
  }
  for (let k = 0; k < 10; k++) {
    // long scrapes where the rocks took the paint off
    const cx = WSP.SX0 + 30 + hash2(k, 3, 33) * (W - 80), cy = 290 + hash2(k, 4, 34) * 56, r = 2 + hash2(k, 5, 35) * 3;
    for (let sy = cy - r; sy < cy + r; sy++) for (let sx = cx - r * 5; sx < cx + r * 5; sx++) {
      const i = at(hull, sx, sy);
      if (i < 0 || !(hull.data[i] >>> 24)) continue;
      if (((sx - cx) / (r * 5)) ** 2 + ((sy - cy) / r) ** 2 + (noise2(sx / 2, sy / 2, k) - 0.5) * 0.7 < 1) hull.data[i] = k % 4 ? mix(hull.data[i], hex('#a09888'), 0.6) : hex('#9a5a3a');
    }
  }
  for (let k = 0; k < 26; k++) {
    const sx = WSP.SX0 + 10 + hash2(k, 6, 36) * (W - 40);
    const len = 8 + hash2(k, 7, 37) * 26;
    for (let j = 0; j < len; j++) {
      const i = at(hull, sx, S4.main.y + 4 + j);
      if (i >= 0 && hull.data[i] >>> 24) hull.data[i] = mix(hull.data[i], hex('#8a4a2a'), 0.55 * (1 - j / len));
    }
  }
  // kelp draped over the rail
  for (let k = 0; k < 9; k++) {
    const sx = 140 + k * 86 + hash2(k, 8, 38) * 30;
    if (sx > tearX(S4.main.y) - 10) continue;
    const len = 10 + hash2(k, 9, 39) * 22;
    for (let j = 0; j < len; j++) {
      set(front, sx + Math.sin(j * 0.3 + k) * 1.5, S4.main.y - 8 + j, j % 4 === 0 ? hex('#6a7a3a') : hex('#4a5a2a'));
      if (j % 5 === 2) set(front, sx + 1 + Math.sin(j * 0.3 + k) * 1.5, S4.main.y - 8 + j, hex('#8a8a3a'));
    }
  }

  // ---- inside: sand drifted over the sole, puddles, the lights dead
  for (let sx = WSP.SX0; sx < WSP.SX1; sx++) {
    const drift = Math.max(0, (fbm1(sx / 40, 3, 41) - 0.45) * 16) + (Math.abs(sx - bcx) < brx + 30 ? 5 * (1 - Math.abs(sx - bcx) / (brx + 30)) : 0);
    for (let k = 0; k < drift; k++) set(inner, sx, S4.lower.floor - k, k > drift - 1.5 ? hex('#e8cc92') : hex('#d4b07a'));
  }
  for (const [px, pw] of [[330, 26], [700, 34], [860, 20]] as const) {
    for (let sx = px - pw; sx < px + pw; sx++) for (let sy = S4.lower.floor - 1; sy <= S4.lower.floor + 1; sy++) {
      if (Math.abs(sx - px) / pw + (noise1(sx / 4, 43) - 0.5) * 0.3 > 1) continue;
      set(inner, sx, sy, hex('#3a5058'));
      set(wet, sx, sy, hex('#3a5058'));
    }
  }
  for (let i = 0; i < inner.data.length; i++) {
    const v = inner.data[i];
    if (v >>> 24) inner.data[i] = shade(v, -0.1);
  }

  // ---- the dune piled against the keel (the hull disappears into the sand)
  const sandTop = (sx: number) => 370 - Math.max(0, (fbm1(sx / 60, 3, 45) - 0.3)) * 18 - (sx < 160 ? (160 - sx) * 0.12 : 0);
  for (let sx = WSP.SX0; sx < WSP.SX1; sx++) {
    const top = sandTop(sx);
    for (let sy = Math.floor(top); sy < WSP.SY1; sy++) {
      const d = sy - top;
      let c = d < 1 ? hex('#f4dca6') : d < 3 ? hex('#e8cc92') : mix(hex('#dcbc84'), hex('#c8a46c'), clamp(d / 20));
      if (hash2(sx, sy, 46) < 0.05) c = shade(c, -0.06);
      set(front, sx, sy, c);
      set(hull, sx, sy, 0);
    }
  }

  cache = {
    x: WSP.SX0 + WRECK.dx, y: WSP.SY0 + WRECK.dy, back, inner, hull, front, wet,
    shafts: [[580 + WRECK.dx, S4.lower.ceil + WRECK.dy, 30], [bcx + WRECK.dx, bcy + WRECK.dy - 8, brx * 1.6], [250 + WRECK.dx, 318 + WRECK.dy, 10]],
  };
  return cache;
}

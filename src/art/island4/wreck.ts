// V4 island: the aft half of the Kittiwake, thrown up the beach by the wave. Built from the ship's own
// art (so every room is the one you walked around that morning), then wrecked: the deckhouse is gone
// (just splintered stumps), the forward end is torn open with ribs and cables hanging out, the hull is
// holed at the hold where you can climb in, barnacles and weed along the waterline, sand drifted in
// over the floor and a dune piled against the keel. The dune is a mound that rises out of the beach
// at both ends (never a slab with edges), and the art box reaches past the stern so the ensign staff
// and the crane are never cut off by the buffer.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import { clamp, fbm1, hash2, noise1, noise2, smoothstep } from '../../core/math';
import { paintShip4, S4 } from '../ship5';
import { deckY } from '../boat';
import { WRECK, groundY } from './layout';
import { RUNG_PITCH, RUNG_OFF, GRAB_H, RAIL_X, RAIL_W } from '../ladder';

/** wreck space = ship space x [SX0, SX1), y [SY0, SY1) (art only: a little wider than WRECK.sx0 so the
 *  stern's ensign staff and flag fit inside the buffers) */
export const WSP = { SX0: 2, SX1: WRECK.sx1, SY0: 60, SY1: 236 };

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
  blit(back, ship.house, (sx, sy) => sy > deckY(sx) - 15 || sx < 130);
  blit(inner, ship.lower, (sx, sy) => sy > S4.lower.ceil - 6);
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
  const tearX = (sy: number) => 500 + (noise1(sy / 9, 3) - 0.5) * 30 + (sy > 196 ? (sy - 196) * 0.35 : 0);
  for (let sy = WSP.SY0; sy < WSP.SY1; sy++) {
    const tx = tearX(sy);
    for (let sx = Math.floor(tx); sx < WSP.SX1; sx++) for (const b of all) set(b, sx, sy, 0);
    for (let k = 1; k <= 2; k++) {
      if (get(hull, tx - k, sy) >>> 24) set(hull, tx - k, sy, k === 1 ? hex('#2a2624') : hex('#6a5e52'));
      if (get(inner, tx - k, sy) >>> 24) set(inner, tx - k, sy, hex('#1a1614'));
    }
  }
  for (const sy of [134, 150, 166, 184]) {
    const tx = tearX(sy);
    const len = 8 + hash2(sy, 1, 5) * 12;
    for (let k = 0; k < len; k++) { set(hull, tx - 2 + k, sy + k * 0.35, hex('#7a4a2e')); set(hull, tx - 2 + k, sy + 1 + k * 0.35, hex('#4a2e1e')); }
  }
  for (let i = 0; i < 5; i++) {
    const x0 = 462 + i * 8, len = 14 + hash2(i, 2, 7) * 26;
    for (let k = 0; k < len; k++) set(inner, x0 + Math.sin(k * 0.2 + i) * 2, S4.lower.ceil + 2 + k, [hex('#c8402e'), hex('#2a2a30'), hex('#e8b840')][i % 3]);
  }

  // ---- the breach at the hold: a torn hole you can climb through
  const [b0, b1] = [WRECK.breach[0] - WRECK.dx, WRECK.breach[1] - WRECK.dx];
  const bcx = (b0 + b1) / 2, bcy = 178, brx = (b1 - b0) / 2, bry = 28;
  for (let sy = bcy - bry - 6; sy < bcy + bry + 6; sy++) for (let sx = b0 - 10; sx < b1 + 10; sx++) {
    const nx = (sx - bcx) / brx, ny = (sy - bcy) / bry;
    const q = nx * nx + ny * ny + (noise2(sx / 7, sy / 7, 11) - 0.5) * 0.5;
    if (q < 1) set(hull, sx, sy, 0);
    else if (q < 1.18 && get(hull, sx, sy) >>> 24) set(hull, sx, sy, hash2(sx, sy, 12) < 0.5 ? hex('#f0ead8') : hex('#5a4a3a'));
    else if (q < 1.35 && get(hull, sx, sy) >>> 24 && hash2(sx, sy, 13) < 0.4) set(hull, sx, sy, hex('#8a4a2a'));
  }
  // punctures elsewhere in the hull, showing the dark rooms behind
  for (const [hx, hy, r] of [[150, 160, 6], [262, 150, 4], [330, 180, 5], [470, 170, 4]] as const) {
    for (let sy = hy - r - 2; sy <= hy + r + 2; sy++) for (let sx = hx - r - 2; sx <= hx + r + 2; sx++) {
      const q = ((sx - hx) / r) ** 2 + ((sy - hy) / (r * 0.8)) ** 2 + (noise2(sx / 3, sy / 3, 17) - 0.5) * 0.6;
      if (q < 1) set(hull, sx, sy, 0);
      else if (q < 1.4 && get(hull, sx, sy) >>> 24) set(hull, sx, sy, hex('#5a4638'));
    }
  }

  // ---- the deckhouse stumps: splintered frames along the deck where the house stood
  for (let sx = 212; sx < 340; sx++) {
    if (sx > tearX(S4.main.y)) break;
    const hgt = Math.max(0, (fbm1(sx / 14, 3, 21) - 0.45) * 30) * (sx % 40 < 6 ? 1.7 : 1);
    for (let k = 0; k < hgt; k++) set(back, sx, deckY(sx) - 13 - k, k > hgt - 2 ? hex('#3a2a1e') : sx % 40 < 6 ? hex('#56392a') : k > hgt - 4 ? hex('#8a7a66') : hex('#c8c0ae'));
  }
  // a hole in the deck above the hold (a light shaft falls through it)
  for (let sx = 428; sx < 452; sx++) for (let sy = S4.lower.ceil - 8; sy < S4.lower.ceil + 4; sy++) if (noise2(sx / 5, sy / 3, 23) > 0.3) { set(inner, sx, sy, 0); set(back, sx, sy, 0); }

  // ---- weathering: weed and barnacles at the waterline, paint scraped to primer, rust
  for (let sx = WSP.SX0; sx < WSP.SX1; sx++) for (let sy = 196; sy < WSP.SY1; sy++) {
    const i = at(hull, sx, sy);
    if (i < 0 || !(hull.data[i] >>> 24)) continue;
    const n = noise2(sx / 6, sy / 4, 31);
    if (sy > 204 && n > 0.55) hull.data[i] = mix(hull.data[i], hex('#3e5a2a'), 0.6);
    if (sy > 210 && hash2(sx, sy, 32) < 0.08) hull.data[i] = hex('#d8d0c0');
  }
  for (let k = 0; k < 10; k++) {
    // long scrapes where the rocks took the paint off
    const cx = WSP.SX0 + 30 + hash2(k, 3, 33) * (W - 80), cy = 130 + hash2(k, 4, 34) * 70, r = 2 + hash2(k, 5, 35) * 3;
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
      const i = at(hull, sx, deckY(sx) + 4 + j);
      if (i >= 0 && hull.data[i] >>> 24) hull.data[i] = mix(hull.data[i], hex('#8a4a2a'), 0.55 * (1 - j / len));
    }
  }
  // kelp draped over the rail
  for (let k = 0; k < 9; k++) {
    const sx = 60 + k * 50 + hash2(k, 8, 38) * 20;
    if (sx > tearX(deckY(sx)) - 10) continue;
    const len = 10 + hash2(k, 9, 39) * 22;
    for (let j = 0; j < len; j++) {
      set(front, sx + Math.sin(j * 0.3 + k) * 1.5, deckY(sx) - 12 + j, j % 4 === 0 ? hex('#6a7a3a') : hex('#4a5a2a'));
      if (j % 5 === 2) set(front, sx + 1 + Math.sin(j * 0.3 + k) * 1.5, deckY(sx) - 12 + j, hex('#8a8a3a'));
    }
  }

  // ---- inside: sand drifted over the sole, puddles, the lights dead
  for (let sx = S4.lower.x0 - 40; sx < tearX(S4.lower.floor) - 2; sx++) {
    const drift = Math.max(0, (fbm1(sx / 40, 3, 41) - 0.45) * 16) + (Math.abs(sx - bcx) < brx + 30 ? 5 * (1 - Math.abs(sx - bcx) / (brx + 30)) : 0);
    for (let k = 0; k < drift; k++) set(inner, sx, S4.lower.floor - k, k > drift - 1.5 ? hex('#e8cc92') : hex('#d4b07a'));
  }
  for (const [px, pw] of [[150, 20], [300, 24], [440, 14]] as const) {
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

  // ---- the dune piled against the keel: a mound rising out of the beach, burying the hull's bottom.
  // It stops at the walk line (the ground takes over below), tapers into the sand at the stern and
  // spills out past the tear, so there is no box edge anywhere.
  const walk = (sx: number) => groundY(sx + WRECK.dx) - WRECK.dy;
  const tearB = tearX(WSP.SY1 - 20);
  const moundH = (sx: number) => {
    const rise = smoothstep(WSP.SX0, 22, sx) * 0.5 + smoothstep(22, 80, sx) * 0.5, fall = 1 - smoothstep(tearB - 40, tearB + 40, sx);
    const body = 19 + Math.max(0, fbm1(sx / 58, 3, 45) - 0.3) * 24 + (noise1(sx / 9, 46) - 0.5) * 2;
    // a little extra heaped against the hull at the breach (the sea pushed sand into the hold)
    const br = Math.max(0, 1 - Math.abs(sx - bcx) / (brx + 26)) * 6;
    return Math.max(2.5 * Math.min(1, rise * 4, fall * 4), (body + br) * rise * fall);
  };
  for (let sx = WSP.SX0; sx < WSP.SX1; sx++) {
    const g = walk(sx), mh = moundH(sx);
    const top = g - mh;
    const inHull = sx < tearX(top) - 1;
    for (let sy = Math.floor(top); sy < WSP.SY1; sy++) {
      // the buried hull: gone from the mound top down
      set(hull, sx, sy, 0);
      if (sy > top + 2) { set(back, sx, sy, 0); if (sy > S4.lower.floor + 3) set(inner, sx, sy, 0); }
      if (sy > g + 1) { set(front, sx, sy, 0); continue; }
      const d = sy - top, k = clamp((sy - top) / Math.max(1, mh));
      // dry and wind-lit on top, damp and darker toward the wet beach
      let c = d < 1 ? hex('#f6e2b0') : d < 2.5 ? hex('#ecd29c') : mix(mix(hex('#e2c48e'), hex('#caa670'), k), hex('#a08c6a'), smoothstep(0.62, 1, k) * 0.8);
      const rip = Math.sin((sx + sy * 3.1) * 0.55 + fbm1(sx / 20, 2, 47) * 6);
      if (d > 2 && rip > 0.86) c = shade(c, -0.07);
      if (hash2(sx, sy, 46) < 0.06) c = shade(c, hash2(sx, sy, 48) < 0.5 ? -0.07 : 0.05);
      if (hash2(sx, sy, 49) < 0.006 && d > 2) c = hash2(sx, sy, 50) < 0.5 ? hex('#fbf4e6') : hex('#4a4a2a');
      // contact shadow where the sand meets the hull above it
      if (inHull && d < 1.5 && get(hull, sx, sy - 2) >>> 24) c = mix(c, hex('#8a7456'), 0.35);
      set(front, sx, sy, c);
    }
  }
  // splintered frames and a snapped plank sticking out of the spill past the tear
  for (const [px, len, ang] of [[tearB + 6, 16, -1.2], [tearB + 18, 11, -0.7], [tearB - 8, 20, -1.45]] as const) {
    const g = walk(px) - moundH(px) + 2;
    for (let k = 0; k < len; k++) {
      const x = px + Math.cos(ang) * k, y = g + Math.sin(ang) * k;
      set(front, x, y, k > len - 2 ? hex('#3a2a1e') : hex('#7a5638'));
      set(front, x + 1, y, hex('#4a3222'));
    }
  }
  // kelp and a tangle of line washed up against the mound
  for (let k = 0; k < 14; k++) {
    const sx = WSP.SX0 + 40 + hash2(k, 11, 51) * (tearB - 30);
    const y0 = walk(sx) - 1;
    const len = 6 + hash2(k, 12, 52) * 12;
    for (let j = 0; j < len; j++) set(front, sx + j * (hash2(k, 13, 53) < 0.5 ? 1 : -1), y0 - Math.sin(j * 0.5) * 1.2, j % 3 ? hex('#4a4a22') : hex('#6a6428'));
  }

  // ---- the way in: a rope ladder (salvaged slats) hung from a beam lashed across the breach, on the same
  // rung grid as the ship's ladders (ladder.ts) so climbing hands and feet land on its slats; its ropes
  // run on up past the floor's lip to the beam as handholds
  {
    const lx = WRECK.climbX - WRECK.dx, ly0 = WRECK.floor - WRECK.dy, ly1 = groundY(WRECK.climbX) - WRECK.dy;
    const rope = [hex('#c8b07a'), hex('#a8905e'), hex('#6a5634')];
    const beamY = ly0 - GRAB_H - 2;
    for (let sx = lx - 13; sx <= lx + 13; sx++) {
      const sag = Math.round(Math.abs(sx - lx) > 11 ? (hash2(sx, 3, 61) - 0.5) * 2 : 0);
      set(front, sx, beamY + sag, hex('#8a6a46')); set(front, sx, beamY + 1 + sag, hex('#5a4030')); set(front, sx, beamY + 2 + sag, hex('#3a2a1e'));
    }
    for (const side of [-1, 1]) {
      const rx = side < 0 ? lx - RAIL_X - RAIL_W + 1 : lx + RAIL_X;
      for (let sy = beamY - 1; sy <= ly1; sy++) {
        const w = Math.round(Math.sin((sy - ly0) * 0.35 + side) * 0.4);
        set(front, rx + w, sy, rope[0]); set(front, rx + 1 + w, sy, rope[1]); set(front, rx + 2 + w, sy, rope[2]);
      }
      // the lashing round the beam
      set(front, rx - 1, beamY - 1, rope[1]); set(front, rx + 3, beamY - 1, rope[2]); set(front, rx + 1, beamY + 3, rope[2]);
    }
    for (let sy = ly0 + RUNG_OFF; sy < ly1 - 1; sy += RUNG_PITCH) {
      for (let sx = lx - RAIL_X + 1; sx < lx + RAIL_X; sx++) {
        set(front, sx, sy, hex('#b08a5a'));
        set(front, sx, sy + 1, hex('#7a5a3a'));
        set(front, sx, sy + 2, hex('#4a3624'));
      }
    }
  }

  cache = {
    x: WSP.SX0 + WRECK.dx, y: WSP.SY0 + WRECK.dy, back, inner, hull, front, wet,
    shafts: [[440 + WRECK.dx, S4.lower.ceil + WRECK.dy, 22], [bcx + WRECK.dx, bcy + WRECK.dy - 8, brx * 1.6], [150 + WRECK.dx, 160 + WRECK.dy, 8]],
  };
  return cache;
}

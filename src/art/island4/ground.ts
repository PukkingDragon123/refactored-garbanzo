// V4 island ground: the strip from the walk line down to the bottom of the screen, painted per
// column by zone. Returns two buffers per chunk: `base` (everything) and `wet` (the pixels drawn a
// second time with the renderer's water material, so wet sand, rock pools, the stream and the
// creek mirror the cast and the sky). The sand itself and the west rock shelf come from v9/sand.ts.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import { bayer, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';
import { ISL, SPOT, groundY, zoneAt } from './layout';
import { sandCol, sandPixel, shelfPixel, SandCol } from '../v9/sand';

export interface GroundChunk { x0: number; y0: number; base: PixelBuffer; wet: PixelBuffer }

const WET = 24;

const SAND = { lit: hex('#f0d8a2'), mid: hex('#e0c088'), low: hex('#caa46c'), deep: hex('#b08a58') };
const WETS = { a: hex('#6e6452'), b: hex('#a08c6a') };
const ROCK = [hex('#2e2a2a'), hex('#433c38'), hex('#5a5048'), hex('#72665a'), hex('#8a7e6e')];
const SOIL = [hex('#2a1e16'), hex('#3a2a1c'), hex('#4c3824'), hex('#604830')];

function sandWet(x: number, y: number, d: number): C {
  const k = d / WET;
  let c = mix(WETS.a, WETS.b, Math.pow(k, 0.8));
  // glossy sheen streaks and tiny ripple marks
  if (noise2(x / 34, y / 1.4, 11) > 0.74) c = mix(c, hex('#dcd4c4'), 0.22);
  if (Math.sin(x * 0.5 + Math.sin(y * 0.7) * 2 + y * 0.9) > 0.94) c = shade(c, -0.06);
  if (hash2(x, y, 21) < 0.004) c = hex('#4a4034'); // worm casts / crab holes
  return c;
}

function rock(x: number, y: number, d: number, wetTop: boolean): C {
  // layered basalt shelf: wavy strata, pits, a few thin cracks
  const strata = Math.sin(y * 0.33 + fbm2(x / 60, y / 20, 2, 30) * 5);
  const n = fbm2(x / 26, y / 12, 3, 31);
  const v = n * 0.85 + (strata > 0.62 ? 0.14 : strata < -0.72 ? -0.12 : 0) - Math.min(0.2, d * 0.002);
  let i = clamp(Math.floor(v * 5.2 - 0.3), 0, 4);
  const cr = Math.abs(noise2(x / 9, y / 40, 33) - 0.5);
  if (cr < 0.013) i = Math.max(0, i - 2);
  if (hash2(x, y, 34) < 0.012) i = 0;
  let c = ROCK[i];
  if (d < 2) c = ROCK[4];
  else if (d < 4) c = ROCK[3];
  if (wetTop && d < 22 && noise2(x / 10, y / 5, 35) > 0.62) c = mix(c, hex('#4e6a3a'), 0.5);
  if (hash2(x, y, 36) < 0.016 && d < 46) c = hex('#cfc6b4');
  return c;
}

function soil(x: number, y: number, d: number): C {
  const n = fbm2(x / 18, y / 12, 3, 41);
  let c = SOIL[clamp(Math.floor(n * 4.4 - 0.4), 0, 3)];
  if (d < 3) c = d < 1 ? hex('#6a8a3a') : hex('#4e6e2c'); // mossy lip
  const g = hash2(x, y, 43);
  // leaf litter: clumps of fallen leaves, not uniform speckle
  if (g < 0.09 && noise2(x / 12, y / 7, 44) > 0.5) c = [hex('#8a5a2a'), hex('#a8743a'), hex('#6e6a2a'), hex('#7a4a22')][Math.floor(g * 44) % 4];
  if (noise2(x / 14, y / 8, 45) > 0.8) c = mix(c, hex('#4a6a2a'), 0.35);
  // roots snaking through the bank
  const root = Math.abs(Math.sin(x * 0.045 + fbm2(x / 50, y / 30, 2, 47) * 6 + y * 0.05) - 0.2);
  if (root < 0.03 && d > 4 && d < 70 && noise1(x / 30, 48) > 0.45) c = hex('#6a4a2c');
  return c;
}

/** sand beach pixel: wet mirror band at the water's edge, wrack line, dry rippled sand, the stream */
function beach(col: SandCol, x: number, y: number, d: number, z: string): [C, boolean] {
  let [c, isWet] = sandPixel(col, x, y, d);
  // the stream: a shallow braided channel from the land to the sea
  const sx = x - SPOT.stream + d * 0.18;
  const half = 30 + d * 0.22 + Math.sin(d * 0.06) * 4;
  if (z === 'stream' && Math.abs(sx) < half) {
    const e = Math.abs(sx) / half;
    const bar = noise2(x / 9, y / 5, 65) > 0.74 && e > 0.35;
    if (!bar) {
      c = e > 0.9 ? mix(hex('#8a7a5c'), c, 0.4) : mix(hex('#5a8a90'), hex('#3a6a78'), clamp(d / 140));
      if (e < 0.9 && noise2(x / 5, y / 2.2 + d * 0.02, 67) > 0.78) c = mix(c, hex('#cfe6e4'), 0.45);
      isWet = true;
    } else c = mix(sandWet(x, y, 4), hex('#c8b48a'), 0.4);
  }
  return [c, isWet];
}

/** Paint the ground under the walk line for world x in [x0, x0 + w). */
export function paintGroundChunk(x0: number, w: number): GroundChunk {
  let minTop = 1e9;
  for (let x = x0; x < x0 + w; x++) minTop = Math.min(minTop, groundY(x));
  const y0 = Math.floor(minTop) - 6;
  const h = ISL.BOT - y0;
  const base = new PixelBuffer(w, h), wet = new PixelBuffer(w, h);
  const put = (x: number, y: number, c: C, isWet: boolean) => {
    const i = (y - y0) * w + (x - x0);
    base.data[i] = c;
    if (isWet) wet.data[i] = c;
  };
  for (let x = x0; x < x0 + w; x++) {
    const top = Math.round(groundY(x));
    const z = zoneAt(x);
    const col = sandCol(x);
    for (let y = top - 2; y < ISL.BOT; y++) {
      const d = y - top;
      let c: C = 0, isWet = false;
      const caveK = Math.min(smoothstep(5030, 5100, x), 1 - smoothstep(5400, 5470, x));
      const shelf = x < 460 ? shelfPixel(x, y, d) : null;
      const caveHere = caveK > 0 && fbm2(x / 20, y / 11, 2, 72) * 0.9 + 0.05 < caveK;
      if (shelf) {
        [c, isWet] = shelf;
      } else if (caveHere) {
        c = rock(x, y, d, false);
        c = shade(c, -0.18);
        if (Math.abs(x - 5250) < 44 && d > 0 && d < 40 - Math.abs(x - 5250) * 0.4) { c = mix(hex('#1e3a44'), hex('#12262e'), d / 40); isWet = true; }
        else if (noise2(x / 20, y / 6, 61) > 0.7) { c = mix(c, hex('#4a5a60'), 0.3); isWet = true; }
      } else if (z === 'forest') {
        const bank = smoothstep(5900, 6080, x);
        if (fbm2(x / 26, y / 14, 3, 73) * 1.1 > 1.02 - bank) c = soil(x, y, d);
        else [c, isWet] = beach(col, x, y, d, z);
        const cr = Math.abs(x - SPOT.creek);
        const half = 26 + d * 0.3 + (noise1(d / 9 + 3, 64) - 0.5) * 8;
        if (cr < half && d >= 0) {
          const e = cr / half;
          c = e > 0.86 ? hex('#5a5048') : mix(hex('#3a5a58'), hex('#2a4448'), clamp(d / 120));
          if (e < 0.86 && noise2(x / 6, y / 3, 63) > 0.8) c = mix(c, hex('#9ab8b0'), 0.4);
          if (e < 0.86) isWet = true;
          // stepping stones
          for (const [sx, sy] of [[SPOT.creek - 8, 6], [SPOT.creek + 10, 22], [SPOT.creek - 4, 44]]) {
            const nx = (x - sx) / 7, ny = (d - sy) / 3.4;
            if (nx * nx + ny * ny < 1) { c = ny < -0.3 ? hex('#8a8272') : hex('#5e564c'); isWet = false; }
          }
        }
      } else {
        [c, isWet] = beach(col, x, y, d, z);
      }
      if (y >= y0 && y < ISL.BOT) put(x, y, c, isWet);
    }
  }
  return { x0, y0, base, wet };
}

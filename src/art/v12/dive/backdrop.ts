// V12 Te Moana Rimurimu, the water behind the gameplay plane: bands of distant reef seen through the
// water on parallax layers, each pulled toward the water's colour by how far back it stands.
//
// A band is painted in its layer's own coordinates: its floor line is the stage's floor seen from that
// far back (compressed toward the eye line, so the far floor rises and the far surface sinks: the
// perspective of looking along the bottom), with a rocky skyline of distant outcrops, the drop-off's
// shelf falling away, the odd pinnacle out in the blue, and (on the nearer bands) whole stands of kelp
// reaching up to their surface. The colours go to the water's: green over the kelp, deep blue out past
// the drop-off, darker with depth.

import { PixelBuffer } from '../../pixel';
import { C, mix, shade } from '../../color';
import { bayer, clamp, fbm1, hash2, noise1 } from '../../../core/math';
import { REF_Y } from '../../../gfx/renderer';
import type { Sprite } from '../../jungle-core';
import { SURF, W, depthAt, floorAt, groveAt, layerSurface, waterRGB, zoneAt } from '../../../game/v12/dive/layout';
import { ROCK } from './seabed';
import { toC } from './seabed';
import { giantKelp, stalkedKelp } from './kelp';

export interface Band { buf: PixelBuffer; x0: number; y0: number }
export interface BandOpts {
  /** horizontal and vertical parallax of the layer */
  p: number;
  py: number;
  /** the band's span in layer x */
  x0: number;
  w: number;
  /** 0..1 how far it is pulled to the water colour */
  haze: number;
  seed: number;
  /** stands of kelp baked into the band (the far ones) */
  kelp?: boolean;
  /** how far the far floor sits above the stage's, px (it is further away) */
  lift?: number;
}

/** the world x a layer x is seen over (with the camera centred on it) */
const worldX = (lx: number, p: number) => clamp(lx / p, -200, W + 200);
/** the layer y of a world y, seen level */
const layerY = (wy: number, py: number) => REF_Y + (wy - REF_Y) * py;
/** the world y a layer y stands in for (for its depth colour) */
const worldY = (ly: number, py: number) => REF_Y + (ly - REF_Y) / py;

/** how far below its skyline a band is filled: as far as the view can see under it (half the view at
 *  zoom 1, since the camera never looks down from below the floor) */
const FILL = 196;

export function paintBand(o: BandOpts): Band {
  const Wd = Math.ceil(o.w);
  const lift = o.lift ?? 0;
  const zc: number[] = [];
  for (let i = 0; i < Wd; i++) zc.push(zoneAt(worldX(o.x0 + i, o.p)));
  const water = (lx: number, ly: number): C => toC(waterRGB(zc[clamp(Math.round(lx - o.x0), 0, Wd - 1)], depthAt(worldY(ly, o.py))));
  // the skyline: the stage's floor seen from here, plus the distant outcrops on it
  const sky: number[] = [];
  for (let i = 0; i < Wd; i++) {
    const lx = o.x0 + i, wx = worldX(lx, o.p);
    const fl = layerY(floorAt(wx), o.py) - lift;
    // outcrops: broad lumps and a crag here and there (they stand on the far floor)
    const lump = Math.max(0, fbm1(lx * 0.012, 3, o.seed) - 0.42) * 70 * o.py;
    const crag = Math.max(0, noise1(lx * 0.05, o.seed + 1) - 0.7) * 50 * o.py;
    // pinnacles out in the blue, rising tall and faint
    const pin = wx > 3900 ? Math.max(0, noise1(lx * 0.018, o.seed + 2) - 0.72) * 520 * o.py : 0;
    sky.push(fl - lump - crag - pin);
  }
  // the band's rows: from the surface line (kelp) or the highest skyline, to the fill under the lowest
  let lo = Infinity, hi = -Infinity;
  for (const y of sky) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  if (o.kelp) lo = Math.min(lo, layerSurface(o.p, o.py) - 4);
  const y0 = Math.floor(lo) - 4, H = Math.ceil(hi + FILL - y0);
  const b = new PixelBuffer(Wd, H);
  const O = { ...o, y0 };
  // the ground: dark rock with a lit rim along the skyline, settling darker down, all into the water
  for (let i = 0; i < Wd; i++) {
    const lx = o.x0 + i, top = Math.round(sky[i]);
    const left = sky[Math.max(0, i - 1)], right = sky[Math.min(Wd - 1, i + 1)];
    for (let y = Math.max(0, top - y0); y < Math.min(H, top - y0 + FILL); y++) {
      const ly = y + y0, e = ly - top;
      let f = 4.2 - Math.min(2.6, e * 0.035) + (bayer(lx, ly) - 0.5) * 0.6;
      if (e < 1) f = 6.6;
      else if (e < 3) f = 5.4;
      // the sides of the outcrops: the left faces lit, the right ones turned away
      if (e < 12 && right < top - 1) f -= 1.2;
      if (e < 12 && left < top - 1) f += 0.6;
      if (hash2(lx >> 2, ly >> 2, o.seed) < 0.06) f -= 0.7;
      const c = ROCK[clamp(Math.round(f), 0, ROCK.length - 1)];
      b.set(i, y, mix(c, water(lx, ly), clamp(o.haze + e * 0.0015)));
    }
  }
  if (o.kelp) bakeKelp(b, O, sky, water);
  return { buf: b, x0: o.x0, y0 };
}

/** stands of kelp on the band: giant kelp up to the surface over the shallows, stalked kelp beyond */
function bakeKelp(b: PixelBuffer, o: BandOpts & { y0: number }, sky: number[], water: (lx: number, ly: number) => C) {
  const cache = new Map<string, Sprite>();
  const surf = layerSurface(o.p, o.py) - 1;
  let lx = o.x0 + 6;
  let n = 0;
  while (lx < o.x0 + o.w - 6) {
    const wx = worldX(lx, o.p);
    const i = Math.round(lx - o.x0);
    // the far kelp grows thicker than the stage's own groves: the forest goes on behind them
    const dens = wx < 1500 ? 0.6 + 0.4 * groveAt(wx) + (fbm1(lx * 0.02, 3, o.seed + 5) - 0.4) : wx < 3000 ? fbm1(lx * 0.02, 3, o.seed + 6) - 0.25 : 0;
    const step = 9 + (1 - clamp(dens)) * 50 + hash2(lx, n, o.seed) * 10;
    if (dens > 0.2 && hash2(n, 3, o.seed) < 0.85) {
      const fy = sky[i];
      let s: Sprite;
      if (wx < 1500) {
        const Hk = Math.max(20, Math.round((fy - surf) / 6) * 6);
        const v = Math.floor(hash2(n, 5, o.seed) * 4);
        const key = `g${Hk}:${v}`;
        s = cache.get(key) ?? giantKelp(400 + v * 7 + Hk, Hk, { simple: true, lean: 0.4 });
        cache.set(key, s);
      } else {
        const v = Math.floor(hash2(n, 7, o.seed) * 3);
        const hk = Math.round((26 + v * 6) * o.py * 1.6);
        const key = `e${hk}:${v}`;
        s = cache.get(key) ?? stalkedKelp(500 + v * 5, hk, { lean: 0.5 });
        cache.set(key, s);
      }
      blitHazed(b, s, Math.round(lx - o.x0), Math.round(fy - o.y0 + 2), hash2(n, 9, o.seed) < 0.5, o, water);
    }
    lx += step;
    n++;
  }
}

function blitHazed(b: PixelBuffer, s: Sprite, x: number, y: number, flip: boolean, o: BandOpts & { y0: number }, water: (lx: number, ly: number) => C) {
  const src = s.buf;
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const c = src.data[j * src.w + i];
    if (!(c >>> 24)) continue;
    const dx = x + (flip ? s.ax - i : i - s.ax), dy = y + j - s.ay;
    if (dx < 0 || dy < 0 || dx >= b.w || dy >= b.h) continue;
    // a little darker than the rock (kelp stands in its own shade), then into the water
    b.data[dy * b.w + dx] = mix(shade(c, -0.12), water(dx + o.x0, dy + o.y0), clamp(o.haze + 0.04));
  }
}

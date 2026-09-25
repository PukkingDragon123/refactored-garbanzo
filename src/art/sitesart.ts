// Site-specific painters: canopy branches, cliffs, waterfalls, reeds, hanging moss, kelp, reef.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, withAlpha, rgba } from './color';
import { PAL, OUTLINE } from './palettes';
import { foliage } from './flora';
import { Rng, bayer, clamp, fbm1, fbm2, noise1 } from '../core/math';

/** Thick horizontal mossy branch, growing from the left end. */
export function paintBranch(seed: number, len: number, thick: number, dir = 1) {
  const rng = new Rng(seed);
  const W = Math.ceil(len + 10), H = Math.ceil(thick * 2 + 24);
  const b = new PixelBuffer(W, H);
  const cy = H - thick - 4;
  for (let x = 0; x < len; x++) {
    const t = x / len;
    const r = thick * (1 - t * 0.55);
    const yc = cy - Math.sin(t * 2.2) * 3 + t * 4;
    for (let y = Math.floor(yc - r); y <= yc + r; y++) {
      const v = (y + 0.5 - yc) / r;
      let l = -v * 0.7 + (fbm2(x * 0.15, y * 0.4, 2, seed) - 0.5) * 0.8 + (bayer(x, y) - 0.5) * 0.3;
      let c = PAL.bark[clamp(Math.round((l * 0.5 + 0.5) * 6) + 1, 1, 7)];
      if (v < -0.4 && fbm2(x * 0.1, y * 0.3, 2, seed + 4) > 0.4) c = PAL.moss[clamp(Math.round(3 + (1 - t) + l * 2), 2, 6)];
      b.set(dir > 0 ? x : W - 1 - x, y, c);
    }
  }
  // leaf tufts and hanging moss
  for (let i = 0; i < len / 30; i++) {
    const x = rng.range(10, len - 5), t = x / len;
    const yc = cy - Math.sin(t * 2.2) * 3 + t * 4 - thick * (1 - t * 0.55);
    if (rng.chance(0.6)) foliage(b, dir > 0 ? x : W - 1 - x, yc - 3, rng.range(5, 9), rng.range(3, 5), PAL.leafDeep.slice(1, 7), rng, 1.8);
    for (let k = 0; k < rng.range(4, 12); k++) b.set(dir > 0 ? x : W - 1 - x, yc + thick * 2 + k, PAL.moss[k % 2 ? 3 : 4]);
  }
  b.outline(c => shade(c, -0.6));
  return { buf: b, ax: dir > 0 ? 0 : W, ay: cy };
}

/** A towering trunk that spans the whole canopy view. */
export function paintGiantTrunk(seed: number, w: number, h: number) {
  const b = new PixelBuffer(w + 8, h);
  const cx = (w + 8) / 2;
  for (let y = 0; y < h; y++) {
    const half = w / 2 + (noise1(y * 0.04, seed) - 0.5) * 3;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const nx = (x + 0.5 - cx) / half;
      let l = -nx * 0.7 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.3 + (fbm2(x * 0.3, y * 0.05, 3, seed) - 0.5) * 0.9 + (bayer(x, y) - 0.5) * 0.3;
      let c = PAL.barkGrey[clamp(Math.round((l * 0.5 + 0.5) * 6) + 1, 1, 7)];
      if (fbm2(x * 0.12, y * 0.02, 3, seed + 9) > 0.55 && nx < 0.4) c = PAL.moss[clamp(Math.round(3 + l * 2), 1, 6)];
      if (Math.abs(nx) > 0.93) c = PAL.barkGrey[0];
      b.set(x, y, c);
    }
  }
  // climbing vines
  const rng = new Rng(seed);
  for (let v = 0; v < 3; v++) {
    let x = cx + rng.range(-w * 0.4, w * 0.4);
    for (let y = 0; y < h; y++) {
      x += Math.sin(y * 0.05 + v) * 0.3;
      b.set(x, y, PAL.leafDeep[2]);
      if (y % 6 === 0) { b.set(x + 1, y, PAL.leafDeep[4]); b.set(x + 2, y + 1, PAL.leafDeep[5]); }
    }
  }
  return { buf: b, ax: cx, ay: h };
}

/** Rock cliff face with strata, ledges and moss. `ledges` = y positions of ledges (px from top). */
export function paintCliff(seed: number, w: number, h: number, ramp: C[] = PAL.stoneWarm, ledges: number[] = [], edgeLeft = true) {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    const edge = edgeLeft ? 8 + fbm1(y * 0.03, 3, seed) * 26 : w;
    for (let x = 0; x < w; x++) {
      if (edgeLeft && x < edge - 6 * Math.sin(y * 0.02)) continue;
      const strata = Math.sin(y * 0.35 + fbm2(x * 0.02, y * 0.02, 2, seed) * 6);
      let l = (fbm2(x * 0.06, y * 0.1, 4, seed) - 0.5) * 1.3 + strata * 0.2 + (bayer(x, y) - 0.5) * 0.3;
      if (edgeLeft && x < edge + 3) l += 0.35;
      let c = ramp[clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 1, ramp.length - 1)];
      if (fbm2(x * 0.08, y * 0.08, 2, seed + 3) > 0.62) c = PAL.moss[clamp(Math.round(2 + l * 2), 1, 5)];
      b.set(x, y, c);
    }
  }
  for (const ly of ledges) {
    for (let x = 0; x < w; x++) {
      if (!b.opaque(x, ly)) continue;
      b.set(x, ly, shade(ramp[ramp.length - 1], 0.1));
      b.set(x, ly + 1, ramp[ramp.length - 2]);
      for (let k = 2; k < 6; k++) b.set(x, ly + k, ramp[1]);
      if (x % 7 === 0) b.set(x, ly - 1, PAL.moss[5]);
    }
  }
  return b;
}

/** Tileable waterfall streak texture (w x h, tile vertically). */
export function paintFallsTex(w: number, h: number, seed = 5) {
  const b = new PixelBuffer(w, h);
  const cols = [hex('#2f6f86'), hex('#4c93a8'), hex('#7cc0cc'), hex('#bfe8ec'), hex('#f2ffff')];
  for (let x = 0; x < w; x++) {
    const cx = x / w;
    const edge = Math.min(cx, 1 - cx) * 8;
    const colN = noise1(x * 0.35, seed);
    for (let y = 0; y < h; y++) {
      // periodic in y so it tiles
      const a = (y / h) * Math.PI * 2;
      const streak = fbm2(x * 0.25, Math.cos(a) * 3 + 10, 2, seed) * 0.6 + fbm2(x * 0.25 + 30, Math.sin(a) * 3 + 10, 2, seed) * 0.6;
      let v = colN * 0.5 + streak * 0.7 - 0.2 + (bayer(x, y) - 0.5) * 0.25;
      if (edge < 1) v -= (1 - edge) * 0.6;
      const i = clamp(Math.floor(v * 5), 0, 4);
      b.data[y * w + x] = withAlpha(cols[i], edge < 0.5 ? 170 : 245);
    }
  }
  return b;
}

export function paintReeds(seed: number, w: number, h: number) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  for (let i = 0; i < w / 1.6; i++) {
    const x0 = rng.range(2, w - 2), len = rng.range(h * 0.5, h), bend = rng.range(-0.3, 0.3);
    const c = rng.pick([PAL.leafOlive[3], PAL.leafOlive[4], PAL.leafOlive[5], PAL.moss[4]]);
    for (let s = 0; s < len; s++) {
      const t = s / len;
      b.set(x0 + bend * t * t * len * 0.4, h - 1 - s, t > 0.85 ? shade(c, 0.2) : c);
    }
    if (rng.chance(0.25)) {
      const tx = x0 + bend * len * 0.4, ty = h - len;
      b.rect(tx - 1, ty, 2, 5, PAL.bark[3]);
      b.set(tx, ty - 1, PAL.leafOlive[5]);
    }
  }
  b.outline(c => shade(c, -0.6));
  return { buf: b, ax: w / 2, ay: h };
}

/** Curtain of hanging moss (mangroves). */
export function paintHangingMoss(seed: number, w: number, h: number) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  for (let x = 0; x < w; x++) {
    const len = h * (0.3 + noise1(x * 0.15, seed) * 0.7);
    for (let y = 0; y < len; y++) if (rng.chance(0.7)) b.set(x + Math.sin(y * 0.1 + x) * 0.8, y, y > len - 4 ? PAL.moss[5] : rng.chance(0.5) ? PAL.moss[3] : PAL.leafOlive[2]);
  }
  return { buf: b, ax: w / 2, ay: 0 };
}

export function paintKelp(seed: number, h: number) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(24, h);
  let x = 12;
  for (let y = h - 1; y >= 0; y--) {
    x += Math.sin(y * 0.05 + seed) * 0.25;
    b.set(x, y, hex('#3e6a2a'));
    b.set(x + 1, y, hex('#2d5220'));
    if (y % 9 === 0) {
      const side = (y / 9) % 2 ? 1 : -1;
      for (let k = 1; k < 8; k++) {
        b.set(x + side * k, y + k * 0.6, k > 5 ? hex('#7aa84a') : hex('#5a8a38'));
        b.set(x + side * k, y + k * 0.6 + 1, hex('#44702c'));
      }
      b.disc(x + side * 2, y + 2, 1.2, hex('#9aba5a'));
    }
    void rng;
  }
  return { buf: b, ax: 12, ay: h };
}

export function paintSponge(seed: number) {
  const rng = new Rng(seed);
  const b = new PixelBuffer(26, 24);
  const cols = rng.pick([PAL.flowerPink, PAL.flowerViolet, PAL.canvasOrange, PAL.yellow]);
  for (let i = 0; i < rng.int(3, 6); i++) {
    const x = rng.range(5, 21), top = rng.range(3, 12);
    for (let y = 23; y > top; y--) {
      const r = 2 + (y - top) * 0.05;
      for (let k = -r; k <= r; k++) b.set(x + k, y, k < -r * 0.3 ? cols[5] : k > r * 0.4 ? cols[3] : cols[4]);
    }
    b.set(x, top, cols[2]);
    b.set(x - 1, top + 1, cols[2]);
  }
  b.outline(OUTLINE);
  return { buf: b, ax: 13, ay: 24 };
}

/** The colossal shed skin draped over rocks (story clue at Thunder Falls). */
export function paintGiantSkin(len = 180) {
  const b = new PixelBuffer(len + 10, 34);
  for (let x = 0; x < len; x++) {
    const y0 = 16 + Math.sin(x * 0.06) * 6 + (x > len * 0.7 ? (x - len * 0.7) * 0.2 : 0);
    const r = 7 * (1 - Math.pow(x / len, 2) * 0.7);
    for (let y = Math.floor(y0 - r); y <= y0 + r; y++) {
      const v = (y - y0) / r;
      const scale = ((Math.floor(x / 4) + Math.floor((y - y0 + 20) / 3)) % 2) === 0;
      let c = scale ? hex('#d8cfae') : hex('#c2b890');
      if (v < -0.6) c = hex('#ece6cc');
      if (v > 0.7) c = hex('#9a906c');
      b.set(x + 5, y, withAlpha(c, 235));
    }
  }
  b.outline(c => shade(c, -0.5));
  return { buf: b, ax: 5, ay: 34 };
}

export function paintMudbank(w: number, h: number, seed: number) {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = y / h;
      let l = 0.6 - t + (fbm2(x * 0.1, y * 0.2, 2, seed) - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.3;
      b.data[y * w + x] = PAL.soil[clamp(Math.round(l * 6), 0, 6)];
    }
  return b;
}

export { rgba, mix };

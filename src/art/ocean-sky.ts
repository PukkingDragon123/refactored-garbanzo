// art/ocean-sky.ts: sky, clouds, sun, lightning, birds and rain sprites for the prologue sea.
//
// API
//   export const SKY_W: number                                   // painted width (covers VW up to 860)
//   export function paintSkyGradient(h: number, storm: boolean): PixelBuffer   // dithered bands; last row = horizon
//   export function paintSun(): PixelBuffer                      // sun disc with a soft rim
//   export function paintSunGlow(rx?, ry?): PixelBuffer          // dithered warm halo (alpha) around the sun
//   export function paintCumulus(seed, w, h, o?: { dark?: boolean; flat?: number }): PixelBuffer
//   export function paintCirrus(seed, w, h): PixelBuffer
//   export function paintCloudBank(seed, w, h, storm): PixelBuffer   // tileable low bank on the horizon
//   export function paintStormDeck(seed, w, h): { base; lit }    // tileable overcast with billowed underside
//   export function paintStormTower(seed, w, h): { base; lit }   // cumulonimbus mass (+ lightning-lit version)
//   export function paintScud(seed, w, h): PixelBuffer           // ragged fast low cloud
//   export function paintBolt(seed, h, branchy?): { buf; ax; ay } // branching bolt, anchored at its top
//   export function paintBirds(): PixelBuffer[]                  // [wings up, glide, wings down] 7x3 specks
//   export function paintRainStreaks(): { angles; lengths; bufs } // angled streak sprites
//   export function paintRainCurtain(seed, w, h): PixelBuffer     // tileable veil of heavy rain (alpha)

import { PixelBuffer } from './pixel';
import { C, hex, mix, rgba, withAlpha } from './color';
import { Rng, bayer, clamp, fbm2, lerp, smoothstep } from '../core/math';
import { tfbm, tnoise } from './ocean';

export const SKY_W = 864;

const h = (s: string) => hex(s);

interface Stop { t: number; c: C }
function grad(stops: Stop[], t: number): C {
  if (t <= stops[0].t) return stops[0].c;
  for (let i = 1; i < stops.length; i++) if (t <= stops[i].t) return mix(stops[i - 1].c, stops[i].c, (t - stops[i - 1].t) / (stops[i].t - stops[i - 1].t));
  return stops[stops.length - 1].c;
}

const CALM_SKY: Stop[] = [
  { t: 0, c: h('#2a73c4') }, { t: 0.3, c: h('#3f8fd6') }, { t: 0.58, c: h('#6aafe3') },
  { t: 0.8, c: h('#9dcdec') }, { t: 0.93, c: h('#c4e4f0') }, { t: 1, c: h('#dcf0f1') },
];
const STORM_SKY: Stop[] = [
  { t: 0, c: h('#0c1114') }, { t: 0.35, c: h('#161e22') }, { t: 0.68, c: h('#222b30') },
  { t: 0.86, c: h('#283236') }, { t: 1, c: h('#1b2427') },
];

/**
 * Vertical sky gradient `h` px tall whose last row is the horizon; storm darkens toward the horizon.
 * (The sun glow is a separate sprite, see paintSunGlow.)
 */
export function paintSkyGradient(hh: number, storm: boolean): PixelBuffer {
  const W = SKY_W;
  const b = new PixelBuffer(W, hh);
  const stops = storm ? STORM_SKY : CALM_SKY;
  const bands = storm ? 22 : 34;
  for (let y = 0; y < hh; y++) {
    const t = y / (hh - 1);
    for (let x = 0; x < W; x++) {
      const q = Math.floor(t * bands + bayer(x, y) * 0.95) / bands;
      let c = grad(stops, clamp(q));
      if (storm) {
        // faint lighter band above the horizon where the rain curtains thin out
        const n = fbm2(x * 0.01, y * 0.03, 3, 17);
        const lb = smoothstep(0.55, 0.85, t) * (1 - smoothstep(0.9, 1, t)) * (n - 0.35);
        if (lb > 0.05 && lb * 3 > bayer(x, y)) c = mix(c, h('#34403f'), 0.6);
      }
      b.data[y * W + x] = c;
    }
  }
  return b;
}

export function paintSun(): PixelBuffer {
  const r = 9, s = r * 2 + 4;
  const b = new PixelBuffer(s, s);
  const core = h('#fffdf4'), rim = h('#fff2c2'), rim2 = h('#ffe7a6');
  b.discFn(s / 2, s / 2, r + 1.2, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.92) return bayer(x, y) > 0.5 ? withAlpha(rim2, 200) : -1;
    return d > 0.8 ? rim : core;
  });
  return b;
}

/** Dithered warm sun glow (alpha), to draw centred on the sun behind everything. */
export function paintSunGlow(rx = 200, ry = 160): PixelBuffer {
  const W = rx * 2, H = ry * 2;
  const b = new PixelBuffer(W, H);
  const c = h('#fff6dc');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - rx) / rx, (y + 0.5 - ry) / ry);
      let g = Math.max(0, 1 - d);
      g = g * g * 0.6;
      const q = Math.floor(g * 9 + bayer(x + 1, y + 2) * 0.95) / 9;
      if (q <= 0) continue;
      b.data[y * W + x] = withAlpha(c, Math.round(clamp(q) * 255));
    }
  return b;
}

// ------------------------------------------------------------------ cumulus

interface Lump { x: number; y: number; r: number }

const CUMULUS = [h('#8ea9c4'), h('#a9c0d6'), h('#c7d8e6'), h('#e2ecf3'), h('#f7fbfd'), h('#ffffff')];
const CUMULUS_DARK = [h('#5d7288'), h('#72889d'), h('#8ea2b4'), h('#aab9c6'), h('#c5d0d8'), h('#d9e1e6')];

/**
 * Fair-weather cumulus: lumps shaded as spheres lit from the upper left, painted back to front so
 * each lump's shaded lower-right edge reads against the one behind; flat, cooler base.
 */
export function paintCumulus(seed: number, w: number, hh: number, o: { dark?: boolean; flat?: number } = {}): PixelBuffer {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, hh);
  const ramp = o.dark ? CUMULUS_DARK : CUMULUS;
  const baseY = hh * (o.flat ?? 0.8);
  const lumps: Lump[] = [];
  const n = Math.max(4, Math.floor(w / 13));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.7);
    const r = (hh * 0.16 + rng.range(0, hh * 0.14)) * (0.5 + env * 0.75);
    lumps.push({ x: w * 0.08 + t * w * 0.84 + rng.range(-3, 3), y: baseY - r * rng.range(0.25, 0.6), r });
  }
  const heads = rng.int(1, 3);
  for (let i = 0; i < heads; i++) {
    const r = hh * rng.range(0.22, 0.3);
    lumps.push({ x: w * rng.range(0.3, 0.7), y: Math.max(r + 1, baseY - r * rng.range(1.0, 1.35)), r });
  }
  // secondary small bumps on top of the big ones
  const big = lumps.slice();
  for (const l of big) {
    if (l.r < hh * 0.18) continue;
    const k = rng.int(1, 3);
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + rng.range(-1.1, 1.1);
      lumps.push({ x: l.x + Math.cos(a) * l.r * 0.72, y: l.y + Math.sin(a) * l.r * 0.72, r: l.r * rng.range(0.35, 0.5) });
    }
  }
  // back (upper) lumps first, lower/front ones last
  lumps.sort((a, c) => (a.y - a.r * 0.3) - (c.y - c.r * 0.3));
  const lx = -0.55, ly = -0.75, lz = Math.sqrt(1 - lx * lx - ly * ly);
  for (const L of lumps) {
    b.discFn(L.x, L.y, L.r, (x, y, nx, ny) => {
      if (y > baseY + (tnoise(x / 5, 0, 999, seed) - 0.5) * 1.5) return -1;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let l = nx * lx + ny * ly + nz * lz; // -1..1
      l = l * 0.55 + 0.5;
      // shade toward the flat base
      l -= smoothstep(baseY - hh * 0.35, baseY, y) * 0.35;
      // occlusion inside the cloud mass: lower lumps are darker
      l -= (L.y / hh) * 0.12;
      const f = l * (ramp.length - 1) + (bayer(x, y) - 0.5) * 0.75;
      return ramp[clamp(Math.round(f), 0, ramp.length - 1)];
    });
  }
  // crisp darker base line
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(baseY); y > baseY - 3; y--) {
      if (b.opaque(x, y) && !b.opaque(x, y + 1)) {
        b.set(x, y, ramp[0]);
        break;
      }
    }
  }
  return b;
}

/** Wispy high cirrus streak. */
export function paintCirrus(seed: number, w: number, hh: number): PixelBuffer {
  const b = new PixelBuffer(w, hh);
  const c1 = withAlpha(h('#e8f3f8'), 190), c2 = withAlpha(h('#ffffff'), 230), c0 = withAlpha(h('#cfe2ee'), 130);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const tx = x / w, ty = (y + 0.5) / hh;
      const shape = Math.sin(tx * Math.PI) * (1 - Math.abs(ty - 0.5 - Math.sin(tx * 5 + seed) * 0.15) * 2.2);
      const n = fbm2(x * 0.04 + y * 0.18, y * 0.3, 3, seed);
      const v = shape * 1.2 - (1 - n) * 0.85;
      if (v + (bayer(x, y) - 0.5) * 0.2 > 0.1) b.data[y * w + x] = v > 0.42 ? c2 : v > 0.24 ? c1 : c0;
    }
  return b;
}

/** Tileable bank of small puffs sitting on the horizon (calm) or a dark lumpy wall (storm). */
export function paintCloudBank(seed: number, w: number, hh: number, storm: boolean): PixelBuffer {
  const b = new PixelBuffer(w, hh);
  const ramp = storm
    ? [h('#141b1f'), h('#1a2226'), h('#20292e'), h('#283237'), h('#313c41')]
    : [h('#a7c3d8'), h('#bcd3e3'), h('#d2e3ee'), h('#e6f0f6'), h('#f6fafc')];
  const per = w / 16;
  for (let x = 0; x < w; x++) {
    const top = hh * (0.25 + 0.6 * (1 - tfbm(x / 16, 0.5, per, 4, seed)));
    for (let y = Math.floor(top); y < hh; y++) {
      const d = (y - top) / (hh - top + 1e-3);
      // bumpy lumps: lighter tops of each bump
      const bump = tfbm(x / 5, y / 4, w / 5, 2, seed + 3);
      let l = (storm ? 0.45 : 0.75) - d * 0.55 + (bump - 0.5) * 0.6;
      if (y - top < 2) l += storm ? 0.1 : 0.25;
      const f = l * (ramp.length - 1) + (bayer(x, y) - 0.5) * 0.7;
      b.data[y * w + x] = ramp[clamp(Math.round(f), 0, ramp.length - 1)];
    }
  }
  return b;
}

// ------------------------------------------------------------------ storm clouds

const DECK = [h('#0a0e11'), h('#0f1519'), h('#151c21'), h('#1b2429'), h('#222c32'), h('#2a353c'), h('#34414a')];
const DECK_LIT = [h('#34435c'), h('#50638a'), h('#7a8fbb'), h('#aebfe4'), h('#e0e8fb')];

/**
 * Tileable overcast deck: a dark lid whose underside is a few rows of rolling billows lit faintly
 * from the low horizon light. `lit` is the lightning-lit version (drawn additively).
 */
export function paintStormDeck(seed: number, w: number, hh: number): { base: PixelBuffer; lit: PixelBuffer } {
  const rng = new Rng(seed * 53 + 1);
  const base = new PixelBuffer(w, hh), lit = new PixelBuffer(w, hh);
  const lidH = Math.round(hh * 0.38);
  // the lid: flat dark overcast with slow mottling
  for (let y = 0; y < lidH + 2; y++)
    for (let x = 0; x < w; x++) {
      const n = tfbm(x / 48, y / 12, w / 48, 3, seed);
      const f = 1.0 + (n - 0.5) * 2.2 + (y / lidH) * 0.8 + (bayer(x, y) - 0.5) * 0.8;
      base.data[y * w + x] = DECK[clamp(Math.round(f), 0, 3)];
    }
  // scalloped underside: layers of wide lobes hanging from the lid, back (high, broad, dark) to
  // front (low, narrower). Each lobe's upper part melts into darkness, its lower rim catches the
  // faint horizon light; creases between lobes stay dark.
  const layers = [
    { y: lidH * 1.05, rx: [34, 60], ry: [9, 14], bias: -0.1, litK: 0.35 },
    { y: lidH * 1.35, rx: [24, 46], ry: [8, 12], bias: 0.02, litK: 0.6 },
    { y: lidH * 1.62, rx: [16, 34], ry: [6, 10], bias: 0.12, litK: 0.85 },
    { y: lidH * 1.85, rx: [10, 22], ry: [4, 8], bias: 0.2, litK: 1 },
  ];
  for (let li = 0; li < layers.length; li++) {
    const Lr = layers[li];
    let x = rng.range(0, 20);
    while (x < w) {
      const rx = rng.range(Lr.rx[0], Lr.rx[1]), ry = rng.range(Lr.ry[0], Lr.ry[1]);
      const skip = li === layers.length - 1 && rng.chance(0.45);
      const cy = Lr.y + rng.range(-3, 3);
      if (!skip) {
        for (const ox of [-w, 0, w]) {
          const cx = x + ox;
          if (cx + rx < 0 || cx - rx > w) continue;
          for (let y = Math.floor(cy - ry * 1.6); y <= Math.ceil(cy + ry); y++) {
            if (y < 0 || y >= hh) continue;
            for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
              if (px < 0 || px >= w) continue;
              const nx = (px + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
              const edgeN = (tnoise(px / 4, y / 3, w / 4, seed + li * 7) - 0.5) * 0.3;
              const e = nx * nx + (ny > 0 ? ny * ny : (ny * ny) / 2.6) + edgeN;
              if (e > 1) continue;
              // lower rim lit, upper part dark and merging
              const rim = clamp((e - 0.62) / 0.38) * clamp(ny * 1.5 + 0.2);
              let l = 0.18 + Lr.bias + clamp(ny) * 0.35 + rim * 0.35 - clamp(-ny) * 0.25;
              l += (tnoise(px / 10, y / 5, w / 10, seed + 3) - 0.5) * 0.14;
              const f = l * (DECK.length - 1) + (bayer(px, y) - 0.5) * 0.8;
              base.data[y * w + px] = DECK[clamp(Math.round(f), 0, DECK.length - 1)];
              const lk = (clamp(ny) * 0.55 + rim * 0.9) * Lr.litK;
              if (lk > 0.1) {
                const fl = lk * (DECK_LIT.length - 1) + (bayer(px, y) - 0.5) * 0.8;
                lit.data[y * w + px] = DECK_LIT[clamp(Math.round(fl), 0, DECK_LIT.length - 1)];
              } else lit.data[y * w + px] = 0;
            }
          }
        }
      }
      x += rx * rng.range(1.0, 1.7);
    }
  }
  // stratus wisps across the underside
  for (let y = lidH; y < hh; y++)
    for (let x = 0; x < w; x++) {
      if (!base.opaque(x, y)) continue;
      const n = tfbm(x / 70, y / 2.2, w / 70, 3, seed + 31);
      if (n > 0.66 && n < 0.69) base.data[y * w + x] = mix(base.data[y * w + x], DECK[5], 0.5);
    }
  return { base, lit };
}

const TOWER = [h('#0c1114'), h('#12191d'), h('#192125'), h('#20292e'), h('#283238'), h('#323d44'), h('#3d4a52')];

/** Dark cumulonimbus mass lit faintly from above; `lit` = lightning glowing inside the cloud. */
export function paintStormTower(seed: number, w: number, hh: number): { base: PixelBuffer; lit: PixelBuffer } {
  const rng = new Rng(seed);
  const base = new PixelBuffer(w, hh), lit = new PixelBuffer(w, hh);
  const lumps: Lump[] = [];
  const baseY = hh * 0.9;
  const n = Math.floor(w / 18) + 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.6);
    const r = (hh * 0.15 + rng.range(0, hh * 0.12)) * (0.5 + env * 0.7);
    lumps.push({ x: w * 0.06 + t * w * 0.88 + rng.range(-4, 4), y: baseY - r * 0.5 - env * hh * rng.range(0.2, 0.55), r });
  }
  const big = lumps.slice();
  for (const l of big) {
    const k = rng.int(1, 2);
    for (let j = 0; j < k; j++) {
      const a = -Math.PI / 2 + rng.range(-1.3, 1.3);
      lumps.push({ x: l.x + Math.cos(a) * l.r * 0.75, y: l.y + Math.sin(a) * l.r * 0.75, r: l.r * rng.range(0.4, 0.6) });
    }
  }
  lumps.sort((a, c) => a.y - c.y);
  const lx = -0.35, ly = -0.8, lz = Math.sqrt(1 - lx * lx - ly * ly);
  for (const L of lumps) {
    base.discFn(L.x, L.y, L.r, (x, y, nx, ny) => {
      const e = Math.hypot(nx, ny) + (tnoise(x / 3, y / 3, 999, seed + 3) - 0.5) * 0.25;
      if (e > 1) return -1;
      if (y > baseY + (tnoise(x / 6, 1, 999, seed) - 0.5) * 5) return -1;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let l = (nx * lx + ny * ly + nz * lz) * 0.45 + 0.5;
      l -= (y / hh) * 0.35;
      l += (tnoise(x / 8, y / 6, 999, seed + 5) - 0.5) * 0.15;
      const f = l * (TOWER.length - 1) + (bayer(x, y) - 0.5) * 0.7;
      return TOWER[clamp(Math.round(f), 0, TOWER.length - 1)];
    });
  }
  // internal lightning: glow around a core, strongest where the mass is thin (near edges)
  const cx = w * rng.range(0.35, 0.65), cy = hh * rng.range(0.45, 0.65);
  const opaque = (x: number, y: number) => base.opaque(x, y);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue;
      let edge = 0;
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) if (!opaque(x + dx, y + dy)) edge++;
      const dd = Math.hypot((x - cx) / (w * 0.5), (y - cy) / (hh * 0.55));
      const nn = tnoise(x / 7, y / 5, 999, seed + 9);
      const lk = clamp(1 - dd) * (0.45 + nn * 0.5) + (edge / 8) * clamp(1.2 - dd) * 0.9;
      if (lk < 0.14) continue;
      const fl = lk * (DECK_LIT.length - 1) + (bayer(x, y) - 0.5) * 0.8;
      lit.data[y * w + x] = DECK_LIT[clamp(Math.round(fl), 0, DECK_LIT.length - 1)];
    }
  return { base, lit };
}

/** Ragged low scud: torn grey wisps. */
export function paintScud(seed: number, w: number, hh: number): PixelBuffer {
  const b = new PixelBuffer(w, hh);
  const ramp = [h('#1d262b'), h('#27323a'), h('#334049'), h('#3f4d56')];
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const tx = x / w, ty = (y + 0.5) / hh;
      const shape = Math.pow(Math.sin(tx * Math.PI), 0.6) * (1 - Math.abs(ty - 0.55) * 2);
      const n = fbm2(x * 0.06 - y * 0.12, y * 0.2, 3, seed);
      const v = shape * 1.35 - (1 - n) * 0.9;
      if (v + (bayer(x, y) - 0.5) * 0.25 <= 0.08) continue;
      const l = v * 1.6 - ty * 0.5 + 0.2;
      b.data[y * w + x] = withAlpha(ramp[clamp(Math.round(l * 3), 0, 3)], v > 0.2 ? 255 : 170);
    }
  return b;
}

// ------------------------------------------------------------------ lightning

/**
 * Branching bolt drawn top-down with a 1px white-violet core, a 1px blue halo and forks.
 * Anchor at the top of the main channel.
 */
export function paintBolt(seed: number, hh: number, branchy = 1): { buf: PixelBuffer; ax: number; ay: number } {
  const rng = new Rng(seed * 101 + 7);
  const W = Math.round(hh * 0.7) + 8;
  const b = new PixelBuffer(W, hh + 2);
  const core = rgba(255, 255, 255), inner = rgba(226, 226, 255), halo = rgba(150, 160, 255, 150), haloF = rgba(120, 130, 240, 80);
  const seg = (x0: number, y0: number, x1: number, y1: number, thick: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d === 0) continue;
          const c = d === 1 ? (thick > 1 ? inner : halo) : d === 2 && thick > 1 ? halo : haloF;
          if (d > (thick > 1 ? 3 : 2)) continue;
          const px = Math.floor(x + dx), py = Math.floor(y + dy);
          const cur = b.get(px, py);
          if (cur === core || cur === inner) continue;
          b.blend(px, py, c);
        }
    }
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      b.set(x, y, core);
      if (thick > 1) b.set(x + 1, y, core);
    }
  };
  const channel = (x: number, y: number, len: number, dir: number, thick: number, depth: number) => {
    let px = x, py = y;
    const steps = Math.max(3, Math.round(len / 9));
    for (let i = 0; i < steps; i++) {
      const nx = px + dir * rng.range(1, 5) + rng.range(-7, 7);
      const ny = py + len / steps * rng.range(0.7, 1.3);
      seg(px, py, clamp(nx, 3, W - 4), Math.min(ny, hh), thick);
      px = clamp(nx, 3, W - 4);
      py = Math.min(ny, hh);
      if (depth < 2 && rng.chance(0.28 * branchy)) {
        channel(px, py, len * rng.range(0.25, 0.5) * (1 - i / steps), rng.sign(), 1, depth + 1);
      }
      if (py >= hh) break;
    }
  };
  const x0 = W * rng.range(0.4, 0.6);
  channel(x0, 0, hh, rng.sign() * 0.6, 2, 0);
  return { buf: b, ax: x0, ay: 0 };
}

// ------------------------------------------------------------------ birds

/** Distant seabird specks: [wings up, glide, wings down]. Dark grey on transparent. */
export function paintBirds(): PixelBuffer[] {
  const c = h('#3a4652'), c2 = h('#56626e');
  const up = new PixelBuffer(7, 3);
  up.set(0, 0, c2); up.set(1, 1, c); up.set(2, 2, c); up.set(3, 2, c); up.set(4, 2, c); up.set(5, 1, c); up.set(6, 0, c2);
  const gl = new PixelBuffer(7, 3);
  gl.set(0, 1, c2); gl.set(1, 1, c); gl.set(2, 1, c); gl.set(3, 2, c); gl.set(4, 1, c); gl.set(5, 1, c); gl.set(6, 1, c2);
  const dn = new PixelBuffer(7, 3);
  dn.set(1, 2, c2); dn.set(2, 1, c); dn.set(3, 1, c); dn.set(4, 1, c); dn.set(5, 2, c2); dn.set(0, 2, c2); dn.set(6, 2, c2);
  return [up, gl, dn];
}

// ------------------------------------------------------------------ rain

/**
 * Angled rain streak sprites. bufs[a][l] is the streak for angles[a] (radians from vertical, leaning
 * toward -x as it falls; flip x for the other wind) and lengths[l] px. Bright head at the bottom.
 */
export function paintRainStreaks(): { angles: number[]; lengths: number[]; bufs: PixelBuffer[][] } {
  const angles = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  const lengths = [5, 9, 15, 24];
  const bufs = angles.map(a =>
    lengths.map(L => {
      const dx = Math.sin(a) * L, dy = Math.cos(a) * L;
      const W = Math.ceil(Math.abs(dx)) + 2, H = Math.ceil(dy) + 2;
      const b = new PixelBuffer(W, H);
      const n = Math.ceil(L * 1.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = W - 1.5 - dx * t, y = 0.5 + dy * t;
        const alpha = Math.round(40 + 200 * Math.pow(t, 1.3));
        const px = Math.floor(x), py = Math.floor(y);
        if ((b.get(px, py) >>> 24) < alpha) b.set(px, py, rgba(255, 255, 255, alpha));
      }
      return b;
    }),
  );
  return { angles, lengths, bufs };
}

/** Tileable veil of heavy rain (vertical streaks of varying density), alpha only. */
export function paintRainCurtain(seed: number, w: number, hh: number): PixelBuffer {
  const b = new PixelBuffer(w, hh);
  const per = w / 8;
  for (let x = 0; x < w; x++) {
    const dens = tfbm(x / 8, 0.5, per, 3, seed);
    for (let y = 0; y < hh; y++) {
      const t = y / hh;
      const fade = smoothstep(0, 0.25, t) * (1 - smoothstep(0.75, 1, t));
      const streak = tnoise(x / 1.0, y / 18, w, seed + 5);
      const v = (dens - 0.35) * 2.2 * fade * (0.5 + streak * 0.8);
      if (v <= 0.05) continue;
      const a = Math.round(clamp(v) * 4) / 4;
      if (a <= 0) continue;
      b.data[y * w + x] = rgba(255, 255, 255, Math.round(a * 120));
    }
  }
  return b;
}

export { lerp };

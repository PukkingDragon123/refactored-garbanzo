// art/ocean.ts: pre-rendered water textures for the prologue sea (Kittiwake voyage).
//
// Everything here is CPU-side pixel art, painted once at load and deterministic (seeded).
// The animated drawables that use these live in world/ocean.ts.
//
// API
//   export type BandName = 'horizon' | 'far' | 'mid' | 'near' | 'front';
//   export const BAND_NAMES: BandName[]                    // back to front
//   export interface BandSpec { name; p; texW; texH; col; glowH; detail; ampK }
//   export const BAND_SPECS: Record<BandName, BandSpec>
//   export const WRAP: number                              // extra wrap columns appended to every strip
//   export interface WaterPalette { rim; glow[3]; face[6] (light->dark); lightLine; lightLine2; darkLine; foam[3] (dark->light); deep; haze }
//   export const CALM: WaterPalette, STORM: WaterPalette, SHORE: WaterPalette
//   export function bandPalette(pal: WaterPalette, p: number): WaterPalette   // aerial perspective per band
//   export function paintBandStrip(spec: BandSpec, pal: WaterPalette, stormy: boolean, seed?: number): PixelBuffer
//        tileable strip (texW + WRAP) x texH; row 0 is the crest line, the bottom row equals pal.deep
//   export function paintCrestGlow(spec: BandSpec, pal: WaterPalette, seed?: number): PixelBuffer   // translucent overlay
//   export function paintWhitecap(spec: BandSpec, seed?: number): PixelBuffer                       // storm crest foam overlay
//   export function paintFoamTrail(spec: BandSpec, seed?: number): PixelBuffer                      // trailing streak overlay
//   export function paintFaceShade(h?, c?): PixelBuffer   // 1px-wide alpha gradient for shading lee faces
//   export function paintGlints(): PixelBuffer[]          // 4 additive sparkle sprites (1, 3, 5, 7 px)
//   export function paintSprayDrops(): PixelBuffer[]      // wind-torn spray (drops and streaks)
//   export function paintFoamPuffs(): PixelBuffer[]       // dithered foam blobs, 4 sizes
//   export function paintRipple(): PixelBuffer[]          // 3-frame raindrop splash on water
//   export function tnoise / tfbm                         // horizontally tileable value noise helpers
//   export function glowSprite(size, falloff): PixelBuffer // smooth radial glow for additive lights

import { PixelBuffer } from './pixel';
import { C, hex, mix, rgba, withAlpha, R, G, B, A } from './color';
import { Rng, bayer, clamp, hash2, lerp, smoothstep } from '../core/math';

export type BandName = 'horizon' | 'far' | 'mid' | 'near' | 'front';
export const BAND_NAMES: BandName[] = ['horizon', 'far', 'mid', 'near', 'front'];

export interface BandSpec {
  name: BandName;
  /** parallax factor of the stage layer this band belongs on */
  p: number;
  /** tile width of the strip texture */
  texW: number;
  /** strip height (texels); the band is filled below it with the deep colour */
  texH: number;
  /** column width used when drawing */
  col: number;
  /** rows of subsurface glow under the crest */
  glowH: number;
  /** wavelet scale (bigger = nearer) */
  detail: number;
  /** swell amplitude relative to the boat band */
  ampK: number;
}

export const BAND_SPECS: Record<BandName, BandSpec> = {
  horizon: { name: 'horizon', p: 0.06, texW: 512, texH: 44, col: 4, glowH: 1, detail: 0.18, ampK: 0.05 },
  far: { name: 'far', p: 0.3, texW: 512, texH: 64, col: 3, glowH: 2, detail: 0.4, ampK: 0.3 },
  mid: { name: 'mid', p: 0.6, texW: 640, texH: 88, col: 2, glowH: 3, detail: 0.65, ampK: 0.6 },
  near: { name: 'near', p: 1, texW: 768, texH: 120, col: 2, glowH: 5, detail: 1, ampK: 1 },
  front: { name: 'front', p: 1.3, texW: 896, texH: 150, col: 2, glowH: 6, detail: 1.35, ampK: 1.3 },
};

/** Extra columns duplicated past texW so a column sampled at any x < texW stays inside the texture. */
export const WRAP = 8;

export interface WaterPalette {
  rim: C;
  glow: C[]; // bright -> dim
  face: C[]; // light -> dark (top of band -> bottom)
  lightLine: C;
  lightLine2: C;
  darkLine: C;
  foam: C[]; // dark -> light
  deep: C;
  haze: C;
}

const h = (s: string) => hex(s);

/** Calm tropical sea: deep blue body, turquoise under the crests, sky-blue wavelets. */
export const CALM: WaterPalette = {
  rim: h('#e4fbff'),
  glow: [h('#8ff0e0'), h('#52cfc9'), h('#34a9b9')],
  face: [h('#3b9ed2'), h('#2f89c4'), h('#2675b3'), h('#1f63a1'), h('#19528d'), h('#154479')],
  lightLine: h('#6cc3ea'),
  lightLine2: h('#b6e8f6'),
  darkLine: h('#123f73'),
  foam: [h('#a3d4e8'), h('#cfeef8'), h('#f6feff')],
  deep: h('#133d6e'),
  haze: h('#bfe4ef'),
};

/** Full storm: dark slate-green, grey-green foam. */
export const STORM: WaterPalette = {
  rim: h('#d9e6e0'),
  glow: [h('#6fa08e'), h('#4d8072'), h('#39665c')],
  face: [h('#3c5c57'), h('#33524d'), h('#2b4844'), h('#243e3b'), h('#1e3533'), h('#182c2b')],
  lightLine: h('#557570'),
  lightLine2: h('#88a39b'),
  darkLine: h('#121f1f'),
  foam: [h('#8ea69f'), h('#b9ccc5'), h('#e6efea')],
  deep: h('#152625'),
  haze: h('#46595a'),
};

/** The storm whitecaps' foam (dark -> light): the white water riding the storm crests. */
export const STORM_WHITECAP: C[] = [h('#9fb3ac'), h('#c9d8d2'), h('#eef5f1'), h('#ffffff')];

/** Shallow lagoon water over sand for the beach camp. */
export const SHORE: WaterPalette = {
  rim: h('#f2fffb'),
  glow: [h('#b5f5e4'), h('#7fe3d2'), h('#57cdc4')],
  face: [h('#5fcfcf'), h('#48bcc6'), h('#37a6bb'), h('#2d90ad'), h('#257a9c'), h('#1f678a')],
  lightLine: h('#98e3e4'),
  lightLine2: h('#dcfaf6'),
  darkLine: h('#1f6a86'),
  foam: [h('#bfe9e8'), h('#e2f8f5'), h('#ffffff')],
  deep: h('#1f6384'),
  haze: h('#cdeff0'),
};

/** Aerial perspective: far bands pick up the horizon haze and lose contrast. */
export function bandPalette(pal: WaterPalette, p: number): WaterPalette {
  const k = clamp(Math.pow(1 - clamp(p / 1.3), 1.7) * 0.72);
  const m = (c: C, extra = 0) => mix(c, pal.haze, clamp(k + extra));
  return {
    rim: m(pal.rim, -0.2),
    glow: pal.glow.map(c => m(c)),
    face: pal.face.map((c, i) => m(c, -i * 0.02)),
    lightLine: m(pal.lightLine, -0.05),
    lightLine2: m(pal.lightLine2, -0.1),
    darkLine: m(pal.darkLine),
    foam: pal.foam.map(c => m(c, -0.15)),
    deep: m(pal.deep),
    haze: pal.haze,
  };
}

// ------------------------------------------------------------------ tileable noise

/** Value noise whose lattice wraps every `period` cells in x (so strips tile). */
export function tnoise(x: number, y: number, period: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const P = Math.max(1, Math.round(period));
  const x0 = ((ix % P) + P) % P, x1 = (x0 + 1) % P;
  const a = hash2(x0, iy, seed), b = hash2(x1, iy, seed);
  const c = hash2(x0, iy + 1, seed), d = hash2(x1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/** Tileable fbm: x, y in lattice cells of the first octave; `period` = cells per tile at octave 0. */
export function tfbm(x: number, y: number, period: number, oct = 3, seed = 0): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += tnoise(x * f, y * f, period * f, seed + i * 31) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

// ------------------------------------------------------------------ helpers

const wrapSet = (b: PixelBuffer, W: number, x: number, y: number, c: C) => b.set(((Math.floor(x) % W) + W) % W, y, c);
const wrapGet = (b: PixelBuffer, W: number, x: number, y: number) => b.get(((Math.floor(x) % W) + W) % W, y);
const wrapBlend = (b: PixelBuffer, W: number, x: number, y: number, c: C) => b.blend(((Math.floor(x) % W) + W) % W, y, c);

/** Copy the first WRAP columns past the tile so column reads never leave the texture. */
function finishWrap(b: PixelBuffer, W: number) {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < WRAP; x++) b.data[y * b.w + W + x] = b.data[y * b.w + x];
}

const rampAt = (ramp: C[], f: number) => ramp[clamp(Math.round(f), 0, ramp.length - 1)];

// ------------------------------------------------------------------ band strips

/**
 * Tileable wave strip for one depth band.
 * Row 0 is the crest line; below it a thin subsurface glow, then the wave face with perspective
 * wavelets (small far away at the top of the strip, bigger and sparser toward the bottom) that
 * cluster into ruffled "cat's paws" between glassy slicks, sky glints and (stormy) foam streaks,
 * marbling and lace.
 */
export function paintBandStrip(spec: BandSpec, pal: WaterPalette, stormy: boolean, seed = 1): PixelBuffer {
  const W = spec.texW, H = spec.texH;
  const b = new PixelBuffer(W + WRAP, H);
  const rng = new Rng(seed * 7919 + spec.texW);
  const F = pal.face, nF = F.length;
  const d = spec.detail;
  const cellX = 64; // noise lattice cells: W / 64 per tile
  const per = W / cellX;
  const glowH = spec.glowH;
  // --- body gradient with slow organic bands (no per-pixel noise, no dither: columns slide vertically)
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const v = tfbm(x / cellX, y / (10 + 22 * d), per, 3, seed) - 0.5;
      let f = Math.pow(t, 0.85) * (nF - 0.6) + v * 1.5;
      let c = rampAt(F, f);
      if (y >= H - 3) c = mix(c, pal.deep, (y - (H - 4)) / 3);
      b.data[y * b.w + x] = c;
    }
  }
  // --- glassy slicks: long smooth lighter streaks reflecting the sky (calm) / sheen (storm)
  const slick = (x: number, y: number) => tfbm(x / 90, y / (3 + 5 * d), W / 90, 3, seed + 57);
  for (let y = glowH + 2; y < H - 3; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const n = slick(x, y);
      if (n > 0.62 - t * 0.06) {
        const under = b.data[y * b.w + x];
        const k = stormy ? 0.18 : 0.3 + (n - 0.62) * 1.5;
        b.data[y * b.w + x] = mix(under, stormy ? pal.lightLine : pal.lightLine, clamp(k) * (1 - t * 0.5));
      }
    }
  }
  // --- subsurface glow just under the crest: turquoise light through the thin water
  for (let x = 0; x < W; x++) {
    const thick = glowH * (0.55 + tfbm(x / 24, 0.5, W / 24, 2, seed + 11) * 0.9);
    for (let y = 1; y < Math.ceil(thick) + 2 && y < H; y++) {
      const k = (y - 1) / Math.max(1, thick);
      if (k > 1.05) break;
      const c = k < 0.34 ? pal.glow[0] : k < 0.7 ? pal.glow[1] : pal.glow[2];
      const edge = k > 0.85 && ((x + y) & 1) === 0;
      if (!edge) b.data[y * b.w + x] = stormy ? mix(c, F[1], 0.25) : c;
    }
  }
  // --- dark trough strokes (sparse, give the face its ripple structure)
  const rowsDark = Math.round(H / (5 + 4 * d));
  for (let i = 0; i < rowsDark * 3; i++) {
    const y = Math.round(glowH + 3 + rng.next() * (H - glowH - 6));
    const t = y / H;
    const L = Math.round((3 + rng.next() * 7) * (0.5 + t) * (0.6 + d * 0.8));
    const x0 = rng.next() * W;
    for (let k = 0; k < L; k++) {
      const x = x0 + k;
      const under = wrapGet(b, W, x, y);
      wrapSet(b, W, x, y, mix(under, pal.darkLine, 0.5 + t * 0.3));
    }
  }
  // --- wavelets: perspective rows of little crests catching the sky, clustered
  const paw = (x: number, y: number) => tfbm(x / 70, y / (6 + 12 * d), W / 70, 3, seed + 99);
  let y = glowH + 3;
  while (y < H - 3) {
    const t = y / H;
    const scale = (0.45 + t * 1.2) * (0.5 + d * 0.75);
    const L0 = 3 + 7 * scale;
    const gapK = stormy ? 3.2 : 1.35;
    let x = rng.next() * L0 * 3;
    while (x < W) {
      const L = Math.max(2, Math.round(L0 * rng.range(0.55, 1.45)));
      const yy = y + rng.int(-1, 1);
      const m = paw(x, yy);
      // slicks are smooth; cat's paws are crowded with ripples
      const keep = m > 0.56 ? 1 : m > 0.42 ? 0.55 : 0.12;
      if (rng.next() < keep && slick(x, yy) < 0.62) wavelet(b, W, x, yy, L, pal, t, rng, stormy);
      x += L + L0 * gapK * rng.range(0.5, 1.6) * (m > 0.56 ? 0.6 : 1);
    }
    y += Math.max(2, Math.round(1.5 + scale * 3.2 * rng.range(0.8, 1.3)));
  }
  // --- sky glints (single bright pixels near the top where the surface is most reflective)
  const nGl = Math.round((W / 12) * (stormy ? 0.25 : 1));
  for (let i = 0; i < nGl; i++) {
    const gx = rng.next() * W;
    const gy = Math.round(glowH + 2 + Math.pow(rng.next(), 1.8) * (H * 0.55));
    wrapSet(b, W, gx, gy, stormy ? pal.lightLine2 : pal.rim);
    if (!stormy && rng.chance(0.3)) wrapSet(b, W, gx + 1, gy, pal.lightLine2);
  }
  if (stormy) stormFoam(b, spec, pal, seed, rng);
  // --- crest rim
  for (let x = 0; x < W; x++) {
    const n = tnoise(x / 6, 1.5, W / 6, seed + 21);
    if (stormy) {
      b.data[x] = n > 0.25 ? pal.foam[2] : pal.foam[1];
      if (n > 0.45) b.data[b.w + x] = pal.foam[1];
      else if (n > 0.3) b.data[b.w + x] = pal.foam[0];
    } else {
      b.data[x] = n > 0.12 ? pal.rim : pal.lightLine2;
      if (n > 0.8) b.data[b.w + x] = pal.lightLine2;
    }
  }
  finishWrap(b, W);
  return b;
}

/** One little crest: a light arc with a darker underside, brightest in the middle. */
function wavelet(b: PixelBuffer, W: number, x0: number, y: number, L: number, pal: WaterPalette, t: number, rng: Rng, stormy: boolean) {
  const light = stormy ? mix(pal.lightLine, pal.foam[0], 0.15) : pal.lightLine;
  const bright = stormy ? mix(pal.lightLine2, pal.foam[0], 0.3) : pal.lightLine2;
  if (L <= 3) {
    for (let k = 0; k < L; k++) wrapSet(b, W, x0 + k, y, light);
    wrapSet(b, W, x0 + L, y + 1, pal.darkLine);
    return;
  }
  const mid = L / 2;
  for (let k = 0; k < L; k++) {
    const e = Math.abs(k + 0.5 - mid) / mid; // 0 centre -> 1 ends
    const yy = e > 0.62 ? y + 1 : y;
    wrapSet(b, W, x0 + k, yy, e < 0.25 && L > 5 ? bright : light);
    // soft underside shadow (the back of the wavelet)
    if (e < 0.7) {
      const under = wrapGet(b, W, x0 + k + 1, yy + 1);
      wrapSet(b, W, x0 + k + 1, yy + 1, mix(under, pal.darkLine, 0.6));
    }
  }
  // bigger nearby wavelets get a second, fainter line (the swell of the ripple)
  if (L > 9 && rng.chance(0.6)) {
    const off = rng.int(2, 3);
    for (let k = 2; k < L - 2; k++) {
      const under = wrapGet(b, W, x0 + k + off, y + 2);
      wrapSet(b, W, x0 + k + off, y + 2, mix(under, light, 0.45));
    }
  }
  if (stormy && L > 7 && rng.chance(0.25 + t * 0.2)) {
    // a fleck of foam riding the wavelet
    const fx = x0 + mid + rng.int(-2, 2);
    wrapSet(b, W, fx, y - 1, pal.foam[1]);
  }
}

/** Foam for the storm strips: coherent marbling, flat lace rafts and long two-tone wind streaks. */
function stormFoam(b: PixelBuffer, spec: BandSpec, pal: WaterPalette, seed: number, rng: Rng) {
  const W = spec.texW, H = spec.texH;
  const d = spec.detail;
  // marbling: iso-lines of strongly stretched noise, fading with depth into the band
  const sx = 70 * (0.4 + d), sy = 4 * (0.5 + d);
  for (let y = 2; y < H - 2; y++) {
    const t = y / H;
    const dens = 1 - t * 0.8;
    for (let x = 0; x < W; x++) {
      const n = tfbm(x / sx, y / sy, W / sx, 3, seed + 41);
      const vein = Math.abs(n - 0.5);
      if (vein < 0.012 * dens + 0.003) {
        const under = b.data[y * b.w + x];
        b.data[y * b.w + x] = mix(under, pal.foam[0], 0.6 + dens * 0.25);
      }
    }
  }
  // lace rafts: flat foam patches with holes and a lit upper edge
  const nP = Math.round((W / 110) * (0.6 + d * 0.4));
  for (let i = 0; i < nP; i++) {
    const cx = rng.next() * W, cy = spec.glowH + 3 + Math.pow(rng.next(), 1.4) * (H * 0.55);
    const rx = rng.range(10, 28) * (0.5 + d * 0.6), ry = Math.max(1.5, rx * 0.16);
    for (let yy = Math.floor(cy - ry); yy <= cy + ry; yy++) {
      if (yy < 2 || yy >= H - 2) continue;
      for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
        const nx = (xx - cx) / rx, ny = (yy - cy) / ry;
        const e = nx * nx + ny * ny;
        if (e > 1) continue;
        const n = tnoise(xx / 3.5, yy / 1.2, W / 3.5, seed + 77);
        if (n < 0.42 + e * 0.35) continue; // holes
        const top = ny < -0.4;
        wrapSet(b, W, xx, yy, top && n > 0.6 ? pal.foam[2] : n > 0.7 ? pal.foam[1] : pal.foam[0]);
      }
    }
  }
  // long wind streaks: a light foam line with a darker trough line under it
  const nS = Math.round((W / 26) * (0.7 + d * 0.3));
  for (let i = 0; i < nS; i++) {
    let x = rng.next() * W;
    const y = Math.round(spec.glowH + 3 + Math.pow(rng.next(), 1.2) * (H - spec.glowH - 8));
    const L = rng.range(18, 80) * (0.5 + d * 0.5);
    const c = rng.chance(0.35) ? pal.foam[1] : pal.foam[0];
    let yy = y;
    for (let k = 0; k < L; k++, x++) {
      if (rng.chance(0.06)) yy += rng.chance(0.5) ? 1 : -1;
      if (yy < 2 || yy >= H - 3) continue;
      if (rng.chance(0.1)) continue;
      const a = Math.sin((k / L) * Math.PI);
      const under = wrapGet(b, W, x, yy);
      wrapSet(b, W, x, yy, mix(under, c, 0.35 + a * 0.5));
      if (a > 0.5 && rng.chance(0.7)) {
        const u2 = wrapGet(b, W, x, yy + 1);
        wrapSet(b, W, x, yy + 1, mix(u2, pal.darkLine, 0.45));
      }
    }
  }
  // drips of foam under the rim
  for (let x = 0; x < W; x += rng.int(3, 9)) {
    const L = rng.int(1, 4);
    for (let k = 0; k < L; k++) wrapSet(b, W, x, 2 + k, k === 0 ? pal.foam[1] : pal.foam[0]);
  }
}

/** Vertical shade gradient (alpha) used to darken the lee faces of big waves at runtime. */
export function paintFaceShade(hh = 28, c: C = hex('#0c1a1c')): PixelBuffer {
  const b = new PixelBuffer(1, hh);
  for (let y = 0; y < hh; y++) {
    const t = y / (hh - 1);
    const a = Math.round((1 - t) * (1 - t) * 4) / 4;
    b.set(0, y, withAlpha(c, Math.round(a * 200)));
  }
  return b;
}

// ------------------------------------------------------------------ overlays (drawn at runtime per column)

/** Translucent turquoise glow for wave crests (sun or lightning shining through thin water). */
export function paintCrestGlow(spec: BandSpec, pal: WaterPalette, seed = 3): PixelBuffer {
  const W = spec.texW, H = Math.round(10 + spec.detail * 12);
  const b = new PixelBuffer(W + WRAP, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = y / H;
      const n = tfbm(x / 20, y / 4, W / 20, 2, seed);
      // caustic-like brighter veins in the glow
      const vein = 1 - Math.abs(tfbm(x / 12, y / 3, W / 12, 2, seed + 9) - 0.5) * 7;
      let a = Math.pow(1 - t, 1.4) * (0.55 + n * 0.6) + clamp(vein) * 0.35 * (1 - t);
      a = clamp(a);
      // quantised alpha for a pixel-art look
      const q = Math.floor(a * 4 + bayer(x, y * 2) * 0.9) / 4;
      if (q <= 0) continue;
      const c = t < 0.25 ? pal.glow[0] : t < 0.6 ? pal.glow[1] : pal.glow[2];
      b.data[y * b.w + x] = withAlpha(vein > 0.6 && t < 0.5 ? pal.lightLine2 : c, Math.round(clamp(q) * 220));
    }
  finishWrap(b, W);
  return b;
}

/** Storm whitecap: ragged foam cap with spill streaks and bubbles trailing down the face. */
export function paintWhitecap(spec: BandSpec, seed = 5): PixelBuffer {
  const W = spec.texW, H = Math.round(12 + spec.detail * 20);
  const b = new PixelBuffer(W + WRAP, H);
  const rng = new Rng(seed * 131 + W);
  const foam = STORM_WHITECAP;
  for (let x = 0; x < W; x++) {
    const n = tfbm(x / 10, 0.3, W / 10, 3, seed);
    const depth = Math.round((0.25 + n * 0.75) * H * 0.55);
    for (let y = 0; y < depth; y++) {
      const t = y / Math.max(1, depth);
      const m = tnoise(x / 3, y / 2, W / 3, seed + 7);
      if (t > 0.55 && m < t * 0.8) continue; // lacy lower edge
      const c = t < 0.2 ? foam[3] : t < 0.45 ? foam[2] : m > 0.6 ? foam[1] : foam[0];
      b.data[y * b.w + x] = c;
    }
  }
  // spill streaks running down the face
  for (let i = 0; i < W / 5; i++) {
    const x = rng.next() * W;
    const y0 = rng.range(H * 0.2, H * 0.5);
    const L = rng.range(3, H * 0.6);
    for (let k = 0; k < L; k++) {
      const yy = Math.round(y0 + k);
      if (yy >= H) break;
      const a = 1 - k / L;
      wrapBlend(b, W, x + k * 0.15, yy, withAlpha(foam[k < 2 ? 2 : 1], Math.round(a * 200)));
    }
  }
  // bubbles
  for (let i = 0; i < W / 4; i++) {
    const x = rng.next() * W, y = rng.range(H * 0.3, H - 1);
    wrapBlend(b, W, x, y, withAlpha(foam[2], rng.int(120, 230)));
  }
  finishWrap(b, W);
  return b;
}

/** Long streaky foam trailing behind crests (drawn on the back slope of storm waves). */
export function paintFoamTrail(spec: BandSpec, seed = 8): PixelBuffer {
  const W = spec.texW, H = Math.round(10 + spec.detail * 16);
  const b = new PixelBuffer(W + WRAP, H);
  const rng = new Rng(seed * 17 + W);
  const foam = [h('#8ea69f'), h('#b9ccc5'), h('#e2ece8')];
  for (let i = 0; i < W / 3; i++) {
    let x = rng.next() * W;
    let y = rng.range(0, H - 1);
    const L = rng.range(6, 40) * (0.5 + spec.detail * 0.5);
    const c = rng.pick(foam);
    for (let k = 0; k < L; k++, x++) {
      if (rng.chance(0.07)) y += rng.chance(0.5) ? 1 : -1;
      if (y < 0 || y >= H) break;
      if (rng.chance(0.15)) continue;
      const a = Math.sin((k / L) * Math.PI);
      wrapBlend(b, W, x, Math.round(y), withAlpha(c, Math.round((0.4 + a * 0.6) * 230)));
    }
  }
  finishWrap(b, W);
  return b;
}

// ------------------------------------------------------------------ small sprites

/** Additive glints: 1px, 3px plus, 5px star, 7px star with diagonals. White, alpha-shaped. */
export function paintGlints(): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  const g1 = new PixelBuffer(1, 1);
  g1.set(0, 0, rgba(255, 255, 255));
  out.push(g1);
  const g3 = new PixelBuffer(3, 3);
  g3.set(1, 1, rgba(255, 255, 255));
  for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g3.set(x, y, rgba(255, 255, 255, 150));
  out.push(g3);
  const g5 = new PixelBuffer(5, 5);
  g5.set(2, 2, rgba(255, 255, 255));
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    const a = i === 1 || i === 3 ? 190 : 80;
    g5.set(i, 2, rgba(255, 255, 255, a));
    g5.set(2, i, rgba(255, 255, 255, a));
  }
  out.push(g5);
  const g7 = new PixelBuffer(7, 7);
  for (let i = 0; i < 7; i++) {
    const dd = Math.abs(i - 3);
    const a = dd === 0 ? 255 : dd === 1 ? 210 : dd === 2 ? 120 : 50;
    g7.set(i, 3, rgba(255, 255, 255, a));
    g7.set(3, i, rgba(255, 255, 255, a));
  }
  for (const [x, y] of [[2, 2], [4, 2], [2, 4], [4, 4]]) g7.set(x, y, rgba(255, 255, 255, 110));
  out.push(g7);
  return out;
}

/** Spray: [dot, 2x1, 2x2 blob, 5x1 streak, 8x2 streak, 3x3 drop]. White with alpha falloff. */
export function paintSprayDrops(): PixelBuffer[] {
  const W = rgba(255, 255, 255);
  const out: PixelBuffer[] = [];
  const d1 = new PixelBuffer(1, 1); d1.set(0, 0, W); out.push(d1);
  const d2 = new PixelBuffer(2, 1); d2.set(0, 0, W); d2.set(1, 0, rgba(255, 255, 255, 140)); out.push(d2);
  const d3 = new PixelBuffer(2, 2); d3.rect(0, 0, 2, 2, W); d3.set(1, 1, rgba(255, 255, 255, 120)); out.push(d3);
  const s5 = new PixelBuffer(5, 1);
  for (let i = 0; i < 5; i++) s5.set(i, 0, rgba(255, 255, 255, 255 - i * 45));
  out.push(s5);
  const s8 = new PixelBuffer(8, 2);
  for (let i = 0; i < 8; i++) {
    s8.set(i, 0, rgba(255, 255, 255, Math.max(0, 255 - i * 30)));
    if (i > 1 && i < 6) s8.set(i, 1, rgba(255, 255, 255, 90));
  }
  out.push(s8);
  const dr = new PixelBuffer(3, 3);
  dr.set(1, 0, rgba(255, 255, 255, 160)); dr.set(0, 1, rgba(255, 255, 255, 160)); dr.set(1, 1, W); dr.set(2, 1, rgba(255, 255, 255, 200)); dr.set(1, 2, rgba(255, 255, 255, 220));
  out.push(dr);
  return out;
}

/** Foam puffs: dithered pixel blobs with a lit top edge (r = 3, 5, 8, 12). White/grey. */
export function paintFoamPuffs(): PixelBuffer[] {
  return [3, 5, 8, 12].map((r, i) => {
    const s = r * 2 + 2;
    const b = new PixelBuffer(s, s);
    const rng = new Rng(40 + i);
    const lumps = Array.from({ length: 4 + i * 2 }, () => ({ x: s / 2 + rng.range(-r, r) * 0.45, y: s / 2 + rng.range(-r, r) * 0.35, r: r * rng.range(0.45, 0.7) }));
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        let v = 0;
        for (const l of lumps) v = Math.max(v, 1 - Math.hypot(x + 0.5 - l.x, y + 0.5 - l.y) / l.r);
        if (v <= 0) continue;
        if (v < 0.3 && bayer(x, y) > v * 3) continue;
        const up = y < s / 2 - r * 0.2;
        const c = v > 0.55 ? (up ? rgba(255, 255, 255) : rgba(236, 244, 242)) : v > 0.25 ? rgba(214, 228, 226) : rgba(186, 204, 202);
        b.set(x, y, withAlpha(c, v > 0.2 ? 255 : 200));
      }
    return b;
  });
}

/** Raindrop hitting water: 3 frames (7x4). */
export function paintRipple(): PixelBuffer[] {
  const W = rgba(235, 245, 250), Wa = rgba(235, 245, 250, 150);
  const f0 = new PixelBuffer(7, 4);
  f0.set(3, 1, W); f0.set(3, 2, Wa); f0.set(2, 3, Wa); f0.set(4, 3, Wa);
  const f1 = new PixelBuffer(7, 4);
  f1.set(2, 1, Wa); f1.set(4, 1, Wa); f1.set(1, 2, W); f1.set(5, 2, W); f1.set(3, 3, Wa);
  const f2 = new PixelBuffer(7, 4);
  f2.set(0, 3, Wa); f2.set(6, 3, Wa); f2.set(1, 3, W); f2.set(5, 3, W); f2.set(3, 0, Wa);
  return [f0, f1, f2];
}

/** Smooth radial glow (additive, not pixelated). */
export function glowSprite(size = 64, falloff = 2.2): PixelBuffer {
  const b = new PixelBuffer(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dd = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      const a = Math.pow(Math.max(0, 1 - dd), falloff);
      b.data[y * size + x] = rgba(255, 255, 255, a * 255);
    }
  return b;
}

/** Horizontal soft bar (additive haze / light streak), `w` x `h`, alpha peaks in the middle row. */
export function softBar(w: number, hh: number, sharp = 1.6): PixelBuffer {
  const b = new PixelBuffer(w, hh);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const ty = 1 - Math.abs((y + 0.5) / hh - 0.5) * 2;
      const tx = Math.sin(((x + 0.5) / w) * Math.PI);
      b.data[y * w + x] = rgba(255, 255, 255, Math.pow(ty, sharp) * Math.pow(tx, 0.6) * 255);
    }
  return b;
}

/** Mean colour of a strip row range (used for the deep filler under a band). */
export function rowColor(b: PixelBuffer, y0: number, y1: number): [number, number, number] {
  let r = 0, g = 0, bl = 0, n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < b.w; x += 3) {
      const c = b.data[y * b.w + x];
      if (A(c) === 0) continue;
      r += R(c); g += G(c); bl += B(c); n++;
    }
  n = Math.max(1, n);
  return [r / n / 255, g / n / 255, bl / n / 255];
}

export { smoothstep };

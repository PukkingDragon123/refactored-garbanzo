// Region Map terrain: the ground fields drawn as a 3/4 "diorama". Each column is walked from the
// front (south) to the back: a ground cell at height h shows h pixels above where it stands, the
// first pixel is its lit top, and where it stands taller than the cell in front the rest of its run
// is a cliff face (sea cliffs, the scarp under Thunder Falls, the gorge's striped walls, the pā's
// stone terraces, riverbanks, the sinkhole's far wall). Light comes from the north-west: a hillshade
// from the relief, long cast shadows from the range and the cliffs, and ambient occlusion in the
// valleys. Then the sea, coloured by depth (lagoon turquoise over sand, the reef, the shelf, the
// Deep) with foam hugging the visible coast.

import { C, hex, mix } from '../../../art/color';
import { bayer, clamp, fbm2, hash2, noise2, smoothstep } from '../../../core/math';
import { B, SEAFLOOR, LM } from '../mapgeo';
import type { Fields } from './field';
import { cliffAt, shelfAt, ellOf } from './field';
import { W, H, N, P, SEA, RIVER, HOTW, WK, TAG, Scr, band, darken, shadowed, slice } from './kit';

// the sun: from the north-west, about 40 degrees up
const LX = -0.6, LY = -0.52, LZ = 0.6;
const LN = Math.hypot(LX, LY, LZ);
const lx = LX / LN, ly = LY / LN, lz = LZ / LN;

export interface Light {
  /** 0..1 light on the ground (hillshade, cast shadow, occlusion) */
  lit: Uint8Array;
  /** 0..1 cast shadow */
  sh: Uint8Array;
}

/** hillshade, the cast shadows and the occlusion of the valleys (ground frame) */
export async function lighting(f: Fields): Promise<Light> {
  const { hgt } = f;
  const sh = new Uint8Array(N);
  // ---- cast shadows: sweep each line from the sun (north-west) to the south-east
  const SX = 1, SY = 0.9, drop = 0.95 * Math.hypot(SX, SY);
  for (let y0 = -Math.ceil(SY * W); y0 < H; y0++) {
    let s = -1e9;
    for (let x = 0; x < W; x++) {
      const y = Math.round(y0 + SY * x);
      if (y < 0) continue;
      if (y >= H) break;
      const i = y * W + x, h = hgt[i];
      s -= drop;
      if (h >= s) s = h;
      else sh[i] = Math.min(255, Math.round(clamp((s - h) / 5) * 255));
    }
    if ((y0 & 127) === 0) await slice();
  }
  // ---- occlusion: how far the ground sits below its neighbourhood (half resolution, blurred)
  const HW = W >> 1, HH = H >> 1;
  const a = new Float32Array(HW * HH), t = new Float32Array(HW * HH);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) a[j * HW + i] = hgt[(j * 2) * W + i * 2];
  const R = 9;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < HH; j++) { let s = 0; for (let k = -R; k <= R; k++) s += a[j * HW + clamp(k, 0, HW - 1)]; for (let i = 0; i < HW; i++) { t[j * HW + i] = s / (2 * R + 1); s += a[j * HW + Math.min(HW - 1, i + R + 1)] - a[j * HW + Math.max(0, i - R)]; } }
    for (let i = 0; i < HW; i++) { let s = 0; for (let k = -R; k <= R; k++) s += t[clamp(k, 0, HH - 1) * HW + i]; for (let j = 0; j < HH; j++) { a[j * HW + i] = s / (2 * R + 1); s += t[Math.min(HH - 1, j + R + 1) * HW + i] - t[Math.max(0, j - R) * HW + i]; } }
    await slice();
  }
  const lit = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) {
    if ((y & 63) === 0) await slice();
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const dx = (hgt[i + 1] - hgt[i - 1]) * 0.5, dy = (hgt[i + W] - hgt[i - W]) * 0.5;
      const nl = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const ndl = (-dx * lx - dy * ly + lz) * nl;
      const ao = clamp((a[(y >> 1) * HW + (x >> 1)] - hgt[i]) / 34);
      let v = 0.56 + (ndl - lz) * 1.35 - (sh[i] / 255) * 0.3 - ao * 0.32;
      if (!f.land[i]) v = 0.6 - (sh[i] / 255) * 0.3;
      lit[i] = Math.round(clamp(v) * 255);
    }
  }
  return { lit, sh };
}

// ------------------------------------------------------------------ materials
/** the animation tag of the pixel a material function just returned */
let tagOut = 0;
const STONEWALL = [hex('#3c3a34'), hex('#5a564c'), hex('#7a7466'), hex('#9a9484'), hex('#b8b2a0')];
const MOSS = [hex('#2a4a22'), hex('#3c6a2c'), hex('#56883a')];
const GUANO = hex('#e8e4d4');

/** how much snow lies at a height on a slope (0..1) */
const snowAt = (x: number, y: number, h: number, slope: number) => clamp((h - 178 + (noise2(x * 0.03, y * 0.03, 77) - 0.5) * 40) / 14) * (slope > 2.2 ? 0.25 : slope > 1.4 ? 0.65 : 1);

function surface(f: Fields, L: Light, x: number, r: number, gy: number, i: number, slope: number): C {
  const b = f.bio[i] as B, h = f.hgt[i];
  let v = L.lit[i] / 255;
  const tx = noise2(x * 0.21, r * 0.21, 81), hh = hash2(x, r, 82);
  switch (b) {
    case B.beach: {
      const d = f.cd[i];
      if (d < 3.5 + (noise2(x * 0.08, gy * 0.08, 83) - 0.5) * 3) return band(P.wetsand, v * 0.9 + (tx - 0.5) * 0.2, x, r);
      // wind ripples and the drift line of shells and weed
      v += Math.sin(x * 0.55 + gy * 0.3 + tx * 5) * 0.05 + (tx - 0.5) * 0.12;
      if (d > 6 && d < 8.5 && hh > 0.86) return hh > 0.97 ? hex('#fbf6ea') : P.sand[2];
      if (hh > 0.996) return P.sand[1];
      return band(P.sand, v * 0.9 + 0.08, x, r);
    }
    case B.dunes: {
      v += (tx - 0.5) * 0.18;
      if (hh > 0.9 && tx > 0.45) return band(P.tuss, v * 0.8 + 0.1, x, r);
      return band(P.dune, v, x, r);
    }
    case B.rock: {
      const cr = noise2(x * 0.3, r * 0.3, 84);
      if (Math.abs(cr - 0.5) < 0.03) return P.basalt[1];
      return band(P.rock, v * 0.8 + (tx - 0.5) * 0.3, x, r);
    }
    case B.swamp: {
      if (hh > 0.93) return band(P.mang, v * 0.6, x, r);
      return band(P.swamp, v * 0.85 + (tx - 0.5) * 0.25, x, r);
    }
    case B.wetland: return band(P.meadow, v * 0.7 + (tx - 0.5) * 0.3, x, r);
    case B.forest: case B.fern: case B.canopy: case B.sink: return band(P.floor, v * 0.8 + (tx - 0.5) * 0.3, x, r);
    case B.beech: return band(P.floor, v * 0.9 + (tx - 0.5) * 0.3, x, r);
    case B.glow: {
      if (hh > 0.992) { tagOut = TAG.glow; return hex('#5ef0d8'); }
      return band(P.glowfloor, v * 0.8 + (tx - 0.5) * 0.3, x, r);
    }
    case B.hills: {
      // golden tussock on the tops, greener in the hollows, grey rock and scree where it is steep
      const pn = noise2(x * 0.02, gy * 0.02, 87);
      if (slope > 1.15 || (pn > 0.7 && tx > 0.55)) return band(P.granite, v * 0.85 + (tx - 0.5) * 0.3, x, r);
      if (slope > 0.8 && hh > 0.6) return band(P.granite, v * 0.8 + 0.1, x, r);
      v += (tx - 0.5) * 0.22 + (hh > 0.8 ? 0.08 : hh < 0.12 ? -0.1 : 0);
      if (pn < 0.38 || L.lit[i] < 90) return band(P.meadow, v * 0.85, x, r);
      return band(P.tuss, v * 0.9, x, r);
    }
    case B.mountain: return mountainGround(x, r, gy, h, slope, v, tx, hh);
    case B.gorge: {
      if (slope > 1.1) return band(P.strata, 0.5 + v * 0.4, x, r);
      return band(P.tuss, v * 0.9 + (tx - 0.5) * 0.2, x, r);
    }
    case B.thermal: {
      // pale sinter crusts, orange and ochre mats where the hot water runs, sulphur round the vents
      const s = fbm2(x * 0.016 + 3, gy * 0.016, 3, 63), run = Math.abs(noise2(x * 0.03, gy * 0.05, 64) - 0.5);
      if (run < 0.04) return band(P.ochre, 0.55 + v * 0.3 + (tx - 0.5) * 0.2, x, r);
      if (run < 0.07) return band(P.ochre, 0.82 + (tx - 0.5) * 0.2, x, r);
      if (s < 0.34) return band(P.sulphur, 0.5 + v * 0.3 + (tx - 0.5) * 0.3, x, r);
      if (s > 0.6) return band(P.tuss, v * 0.75 + (tx - 0.5) * 0.25, x, r);
      return band(P.silica, v * 0.55 + 0.3 + (tx - 0.5) * 0.2, x, r);
    }
    case B.garden: return garden(x, r, gy, v, tx);
    case B.terraces: case B.plain: case B.meadow: case B.scrub: case B.coastal: default: {
      if (h > 170) return mountainGround(x, r, gy, h, slope, v, tx, hh);
      const pal = b === B.plain ? P.meadow : P.grass;
      v += (tx - 0.5) * 0.22;
      // tufts: a lit blade over a dark root
      if (hh > 0.93) v += 0.14; else if (hh < 0.05) v -= 0.16;
      if (hh > 0.9985) return [hex('#f2e04a'), hex('#f4f2e8'), hex('#e87a9a')][Math.floor(hash2(x, r, 85) * 3)];
      return band(pal, v, x, r);
    }
  }
}
function mountainGround(x: number, r: number, gy: number, h: number, slope: number, v: number, tx: number, hh: number): C {
  const sn = snowAt(x, gy, h, slope);
  if (sn > bayer(x, r) * 0.9 + 0.05) {
    if (hh > 0.995) return hex('#ffffff');
    return band(P.snow, 0.15 + v * 0.95, x, r);
  }
  if (h > 150 || slope > 1.4) {
    const cr = noise2(x * 0.18, r * 0.12, 86);
    if (Math.abs(cr - 0.5) < 0.025) return P.granite[0];
    return band(P.granite, v * 0.95 + (tx - 0.5) * 0.25, x, r);
  }
  if (h > 112) return band(P.alpine, v + (tx - 0.5) * 0.25 + (hh > 0.9 ? 0.1 : 0), x, r);
  return band(P.floor, v * 0.9 + (tx - 0.5) * 0.3, x, r);
}
function garden(x: number, r: number, gy: number, v: number, tx: number): C {
  const [vx, vy] = LM.village;
  if (Math.hypot(x - vx, (gy - vy) * 1.4) < 30 * 2.75) return band(P.marae, v * 0.9 + (tx - 0.5) * 0.25, x, r);
  const px = Math.floor((x + gy * 0.14) / 26), py = Math.floor(gy / 18);
  const kind = Math.floor(hash2(px, py, 121) * 4);
  const lx = (x + gy * 0.14) % 26, lyy = gy % 18;
  if (lx < 2 || lyy < 2) return band(P.marae, v * 0.7, x, r);
  if (kind === 0) return lyy % 3 === 0 ? band(P.soilrow, v * 0.8, x, r) : band(P.garden, v * 0.9 + 0.1, x, r);
  if (kind === 1) return (lx + lyy) % 4 === 0 ? band(P.garden, v + 0.2, x, r) : band(P.soilrow, v * 0.9, x, r);
  if (kind === 2) return lyy % 2 ? band(P.tuss, v * 0.9 + 0.1, x, r) : band(P.garden, v * 0.8, x, r);
  return band(P.grass, v * 0.9 + (tx - 0.5) * 0.2, x, r);
}

/** a cliff face pixel at height z of the cell it hangs from */
function face(f: Fields, L: Light, x: number, r: number, gy: number, i: number, z: number, k: number, n: number, dhx: number): C {
  const b = f.bio[i] as B, wk = f.wat[i];
  // light: the face looks south; turned toward the west it catches the sun
  let v = 0.4 + clamp(dhx * 0.1, -0.22, 0.26) - (L.sh[i] / 255) * 0.12;
  if (k === 0) v += 0.28; else if (k === 1) v += 0.12;
  if (k >= n - 2) v -= 0.14;
  const col = hash2(x, 3, 90), ns = noise2(x * 0.4, z * 0.15, 91);
  if (wk === WK.river || wk === WK.lake || wk === WK.hot || wk === WK.pool) {
    tagOut = TAG.fall;
    return ((x * 3 + r) & 3) === 0 ? hex('#ffffff') : ((r - x) & 3) === 1 ? hex('#9ccfe2') : hex('#dff0f6');
  }
  if (b === B.gorge || (b === B.plain && z > 80) || b === B.thermal) {
    const s = Math.floor(z * 0.42 + (ns - 0.5) * 2.5 + Math.sin(x * 0.05) * 1.5);
    const st = P.strata[((s % 8) + 8) % 8];
    return mix(darken(st, 0.6 + v * 0.55), P.strata[0], col > 0.8 ? 0.25 : 0);
  }
  if (b === B.terraces) {
    // dry-stone walls: courses of blocks
    const course = Math.floor(z / 2.5), off = course % 2 ? 3 : 0;
    if (Math.floor(z * 10) % 25 < 3 || (x + off) % 6 === 0) return STONEWALL[0];
    return STONEWALL[clamp(Math.round(1 + v * 3 + (hash2(Math.floor((x + off) / 6), course, 92) - 0.5) * 1.2), 1, 4)];
  }
  if (b === B.beach || b === B.dunes) return band(P.sand, v * 0.9, x, r);
  if (b === B.sink || b === B.glow) {
    if (ns > 0.7 && k > 1) return MOSS[clamp(Math.round(v * 2), 0, 2)];
    if (b === B.glow && hash2(x, r, 93) > 0.985) { tagOut = TAG.glow; return hex('#6af2dc'); }
    return band(P.basalt, v * 0.9 + (col - 0.5) * 0.25, x, r);
  }
  const ch = cliffAt(x, gy);
  const nearSea = f.cd[i] < 26 && ch > 8;
  if (nearSea) {
    // sea cliffs: dark basalt in courses, white where the seabirds roost, black and wet at the foot
    if (k >= n - 2) return P.basalt[0];
    const course = Math.floor(z / 4 + (ns - 0.5) * 1.5);
    let c = band(P.basalt, v * 1.05 + (course % 2 ? 0.08 : -0.04) + (col - 0.5) * 0.28, x, r);
    if (k < 3 && ch > 30 && hash2(x >> 1, r, 94) > 0.82) c = GUANO;
    if (k === 0 && hash2(x, 1, 95) > 0.4) c = MOSS[2];
    return c;
  }
  if (f.rd[i] < 26 && n < 18) {
    // riverbanks: earth, roots, a grass lip
    if (k === 0) return MOSS[2];
    if (k === 1 && hash2(x, 2, 96) > 0.5) return MOSS[1];
    return band(P.earth, v * 0.95 + (col - 0.5) * 0.3, x, r);
  }
  const hz = f.hgt[i];
  if (hz > 150) {
    const sn = snowAt(x, gy, z, 0.8) * (k < 3 ? 1 : 0.35);
    if (sn > 0.5 && ns > 0.45) return band(P.snow, 0.3 + v * 0.7, x, r);
    return band(P.granite, v * 0.85 + (col - 0.5) * 0.3 + (Math.floor(z / 6) % 2 ? 0.05 : 0), x, r);
  }
  // inland scarps: grey rock, moss on the ledges, ferns hanging from the lip
  if (k === 0) return MOSS[2];
  if (k < 3 && hash2(x, 5, 97) > 0.45) return MOSS[1];
  if (ns > 0.72) return MOSS[0];
  return band(P.rock, v * 0.9 + (col - 0.5) * 0.3 + (Math.floor(z / 5) % 2 ? 0.05 : -0.03), x, r);
}

function water(f: Fields, L: Light, x: number, r: number, i: number): C {
  const wk = f.wat[i];
  const v = L.lit[i] / 255;
  if (wk === WK.hot) return band(HOTW, 0.45 + (noise2(x * 0.2, r * 0.2, 101) - 0.5) * 0.5, x, r);
  if (wk === WK.pool) return band(P.mud, 0.35 + (noise2(x * 0.3, r * 0.3, 102) - 0.5) * 0.4, x, r);
  if (wk === WK.channel) return band(SEA.murk, 0.45 + (noise2(x * 0.12, r * 0.12, 103) - 0.5) * 0.5 - (L.sh[i] / 255) * 0.2, x, r);
  // rivers and lakes: darker in the middle, a glint of sky at the edges
  const d = f.rd[i];
  const edge = wk === WK.river ? clamp(1 - d / 7) : 0.4;
  return band(RIVER, 0.35 + edge * 0.3 + v * 0.25 + (noise2(x * 0.15, r * 0.15, 104) - 0.5) * 0.25, x, r);
}

// ------------------------------------------------------------------ the projection
export async function project(f: Fields, L: Light, scr: Scr) {
  const { hgt, wat } = f;
  scr.gy.fill(-1);
  for (let x = 0; x < W; x++) {
    if ((x & 15) === 0) await slice();
    let horizon = H;
    for (let gy = H - 1; gy >= 0 && horizon > 0; gy--) {
      const i = gy * W + x;
      const h = hgt[i];
      const sy = Math.round(gy - h);
      if (sy >= horizon) continue;
      const top = Math.max(0, sy);
      const hF = gy + 1 < H ? hgt[i + W] : h;
      const drop = h - hF;
      const n = horizon - sy;
      const mtn = f.bio[i] === B.mountain || (h > 150 && f.bio[i] !== B.gorge);
      const isFace = drop > (mtn ? 7 : 1.8) && n > 2;
      const hx0 = x > 0 ? hgt[i - 1] : h, hx1 = x < W - 1 ? hgt[i + 1] : h;
      const slope = Math.max(Math.abs(hx1 - hx0), Math.abs(hF - (gy > 0 ? hgt[i - W] : h))) * 0.5;
      const wk = wat[i];
      for (let rr = top; rr < horizon; rr++) {
        const j = rr * W + x;
        const k = rr - sy;
        scr.gy[j] = gy;
        if (wk === WK.sea) { scr.kind[j] = 2; scr.wat[j] = WK.sea; continue; }
        tagOut = 0;
        if (isFace && k >= 1) {
          scr.col[j] = face(f, L, x, rr, gy, i, gy - rr, k - 1, n - 1, (hx1 - hx0) * 0.5);
          scr.kind[j] = 1;
          if (tagOut === TAG.fall) { scr.tag[j] = TAG.fall; scr.wat[j] = WK.fall; } else if (tagOut) scr.tag[j] = tagOut;
          if (k === 1) scr.edge[j] = 1;
          continue;
        }
        if (wk) {
          scr.col[j] = water(f, L, x, rr, i);
          scr.kind[j] = 2; scr.wat[j] = wk; scr.flow[j] = f.flow[i];
          continue;
        }
        scr.col[j] = surface(f, L, x, rr, gy, i, slope);
        scr.kind[j] = 0;
        if (tagOut) scr.tag[j] = tagOut;
      }
      horizon = top;
    }
  }
  await slice();
  // ---- the sea, by depth, with foam hugging the visible coast
  const sd = screenSeaDist(scr);
  for (let y = 0; y < H; y++) {
    if ((y & 31) === 0) await slice();
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      if (scr.kind[j] !== 2 || scr.wat[j] !== WK.sea) continue;
      const gyy = scr.gy[j];
      const i = (gyy < 0 ? y : gyy) * W + x;
      scr.sea[j] = Math.min(255, Math.round(sd[j]));
      scr.col[j] = sea(f, L, x, y, i, sd[j]);
    }
  }
  // ---- outlines for the pen sketch: the visible coast, river banks
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const j = y * W + x;
    const k = scr.kind[j];
    if (k === 2) {
      const w0 = scr.wat[j];
      if (w0 !== WK.sea && (scr.kind[j - 1] !== 2 || scr.kind[j + 1] !== 2 || scr.kind[j - W] !== 2 || scr.kind[j + W] !== 2)) scr.edge[j] = 2;
      continue;
    }
    if (scr.wat[j - 1] === WK.sea || scr.wat[j + 1] === WK.sea || scr.wat[j - W] === WK.sea || scr.wat[j + W] === WK.sea) {
      scr.edge[j] = 1;
      // a dark lip where the land meets the water
      scr.col[j] = darken(scr.col[j], 0.78);
    }
  }
}

/** screen-space distance from each sea pixel to the land it shows against */
function screenSeaDist(scr: Scr): Float32Array {
  const d = new Float32Array(N).fill(1e4);
  const sea = (j: number) => scr.kind[j] === 2 && scr.wat[j] === WK.sea;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    if (!sea(j)) { d[j] = 0; continue; }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    if (d[j] === 0) continue;
    let b = d[j];
    if (x > 0) b = Math.min(b, d[j - 1] + 1);
    if (y > 0) { b = Math.min(b, d[j - W] + 1); if (x > 0) b = Math.min(b, d[j - W - 1] + 1.414); if (x < W - 1) b = Math.min(b, d[j - W + 1] + 1.414); }
    d[j] = b;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const j = y * W + x;
    if (d[j] === 0) continue;
    let b = d[j];
    if (x < W - 1) b = Math.min(b, d[j + 1] + 1);
    if (y < H - 1) { b = Math.min(b, d[j + W] + 1); if (x < W - 1) b = Math.min(b, d[j + W + 1] + 1.414); if (x > 0) b = Math.min(b, d[j + W - 1] + 1.414); }
    d[j] = b;
  }
  return d;
}

const reefF = ellOf(SEAFLOOR.reef), reefOF = ellOf(SEAFLOOR.reefOuter), shelfF = ellOf(SEAFLOOR.shelf), deepF = ellOf(SEAFLOOR.deep), kelpF = ellOf(SEAFLOOR.kelp);

let seaG: Float32Array | null = null;
const SG = 8, SGW = Math.ceil(W / SG) + 2;
function seaNoise(x: number, y: number): number {
  if (!seaG) { const gh = Math.ceil(H / SG) + 2; seaG = new Float32Array(SGW * gh); for (let j = 0; j < gh; j++) for (let i = 0; i < SGW; i++) seaG[j * SGW + i] = fbm2(i * SG * 0.008, j * SG * 0.008, 3, 111); }
  const fx = x / SG, fy = y / SG, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * SGW + i, g = seaG;
  return (g[k] + (g[k + 1] - g[k]) * u) * (1 - v) + (g[k + SGW] + (g[k + SGW + 1] - g[k + SGW]) * u) * v;
}
function sea(f: Fields, L: Light, x: number, y: number, i: number, sd: number): C {
  const cdv = f.cd[i], shore = f.shore[i];
  const nA = seaNoise(x, y), nB = noise2(x * 0.05, y * 0.05, 112);
  const sw = shelfAt(x, y) * (0.75 + nA * 0.6);
  let c: C;
  const dep = cdv / sw;
  if (shore === 4 && cdv < 46) c = band(SEA.murk, 0.75 - cdv / 70 + (nB - 0.5) * 0.3, x, y);
  else if (dep < 1) {
    // the lagoon: pale over the sand, sand ripples and weed patches showing through
    const t = 1 - dep;
    c = band(SEA.lagoon, 1 - t * 0.95 + (nB - 0.5) * 0.18, x, y);
    if (shore === 1 && t > 0.35) {
      const rip = Math.sin(x * 0.32 + y * 0.6 + nB * 4);
      if (rip > 0.86) c = mix(c, SEA.sandbed[2], 0.45);
    }
    if (shore !== 1 && nB > 0.68) c = band(SEA.reef, 0.25 + (nB - 0.68) * 2, x, y);
  } else {
    const d2 = clamp((cdv - sw) / 150 + (nA - 0.5) * 0.35);
    c = d2 < 0.45 ? band(SEA.mid, d2 / 0.45, x, y) : band(SEA.deep, (d2 - 0.45) / 0.55, x, y);
  }
  // the reef inside the islands' lee, the shelf's drop-off, the Deep
  const rf = 1 - reefF(x + (nA - 0.5) * 60, y + (nB - 0.5) * 10);
  if (rf > -0.25) {
    const n = fbm2(x * 0.06, y * 0.06, 2, 113);
    if (rf > 0 && n > 0.52 - rf * 0.2) {
      c = band(SEA.reef, (n - 0.4) * 1.8, x, y);
      if (hash2(x, y, 114) > 0.93) c = SEA.coral[Math.floor(hash2(x, y, 115) * 6)];
    } else if (rf > 0) c = band(SEA.lagoon, 0.25 + n * 0.3, x, y);
    // the crest: surf breaking on the outer edge
    if (rf > -0.06 && rf < 0.03 && hash2(x >> 1, y, 116) > 0.35) c = mix(c, SEA.foam[2], 0.75);
  }
  const ro = 1 - reefOF(x, y);
  if (ro > 0 && rf <= 0 && cdv > 30) c = mix(c, SEA.lagoon[4], 0.35 * clamp(ro * 3));
  const shf = 1 - shelfF(x + (nA - 0.5) * 80, y + (nA - 0.5) * 30);
  if (shf > 0 && y < SEAFLOOR.shelf[1] + Math.sin(x / 22) * 7) c = band(SEA.abyss, 0.3 + (nA - 0.5), x, y);
  const dp = 1 - deepF(x + (nA - 0.5) * 140, y + (nB - 0.5) * 30);
  if (dp > 0) c = mix(c, band(SEA.abyss, 0.2 + dp * 0.6 + (nB - 0.5) * 0.3, x, y), smoothstep(0, 0.35, dp));
  const kp = 1 - kelpF(x, y);
  if (kp > 0 && noise2(x * 0.05, y * 0.05, 117) > 0.5) c = band(SEA.kelp, 0.3 + nB * 0.5, x, y);
  // waves on the open water: little light chevrons
  if (cdv > 60 && dp <= 0) {
    const gx = Math.floor(x / 23), gy = Math.floor(y / 13), hh = hash2(gx, gy, 118);
    if (hh > 0.55) {
      const ox = gx * 23 + Math.floor(hash2(gx, gy, 119) * 12), oy = gy * 13 + Math.floor(hash2(gx, gy, 120) * 7);
      const lx0 = x - ox;
      if (lx0 >= 0 && lx0 < 7 && y === oy - [0, 1, 1, 2, 1, 1, 0][lx0]) c = hh > 0.85 ? SEA.wave2 : SEA.wave;
    }
  }
  // the land's shadow on the water
  if (L.sh[i] > 40) c = shadowed(c, 1 - (L.sh[i] / 255) * 0.32);
  // foam: the swash line, the broken white water, a second line further out on the beaches
  const fn = sd < 12 ? noise2(x * 0.12, y * 0.12, 121) : 0;
  if (sd <= 1.2) c = fn > 0.25 ? SEA.foam[2] : SEA.foam[1];
  else if (sd <= 2.4) c = fn > 0.45 ? SEA.foam[1] : mix(c, SEA.foam[0], 0.5);
  else if (sd <= 4 && fn > 0.62) c = mix(c, SEA.foam[1], 0.7);
  else if (shore === 1 && Math.abs(sd - 9 - nA * 4) < 0.7 && fn > 0.4) c = mix(c, SEA.foam[1], 0.55);
  return c;
}

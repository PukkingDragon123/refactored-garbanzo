// V12 Te Tuawhenua, the far land: bands of country rank after rank into the haze, each painted the
// whole width of the map with the stretch it lies behind, so what you see in the distance is the
// country ahead and behind: grey-green kānuka on rolling hills, a wide valley floor with the river's
// silver braids, the black burnt ridge bristling with dead spars and greening with regrowth, the dark
// bush of the fern gully pooled in its fold with tree-fern stars on top, golden tussock, and the grey
// crags of the claw gorge. Stepped and dithered haze, never a smooth gradient.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { mix } from '../../color';
import { bayer, clamp, fbm1, hash2, noise1 } from '../../../core/math';
import { HP } from '../../v11/hills/kit';
import { FP } from '../../v11/forest/kit';
import { TP, pick, hazeRamp, vgrid } from './kit';
import { BIOMES, bioW } from '../../../game/v12/backcountry/gen';
import type { Biome } from '../../../game/v12/backcountry/gen';

export interface TuaBandOpts {
  W: number;
  H: number;
  /** the layer x of the band's first column, and the layer's parallax (layer x / p ~ the world x behind) */
  lx0: number;
  p: number;
  seed: number;
  /** row of the band's lowest crests, and the band's scale of hills */
  base: number;
  amp: number;
  /** 0 the farthest .. 1 the nearest band: detail, contrast */
  k: number;
  fog: C;
  haze: number;
  /** an extra drop of the crest by layer x (a near band that follows the walk line's rises and dips) */
  lift?: (lx: number) => number;
  /** 0..1 how strongly the stretch behind shapes the hills (far bands: a little; near bands: fully) */
  bio?: number;
  /** a hedge behind the walk line (no river bed in it, the flats a grassy terrace) */
  hedge?: boolean;
}

const AMP: Record<Biome, number> = { scrub: 0.62, flats: 0.22, burnt: 0.9, boa: 0.7, tussock: 0.6, gorge: 1.25 };
const FREQ: Record<Biome, number> = { scrub: 1, flats: 0.7, burnt: 1.1, boa: 1.3, tussock: 0.9, gorge: 1.8 };

export function paintTuaBand(o: TuaBandOpts): PixelBuffer {
  const { W, H, seed, k } = o;
  const b = new PixelBuffer(W, H);
  const R = {
    tus: hazeRamp(HP.tussock, o.fog, o.haze), red: hazeRamp(HP.tussockRed, o.fog, o.haze), leaf: hazeRamp(TP.kleaf, o.fog, o.haze * 0.9),
    bush: hazeRamp(FP.canopy, o.fog, o.haze * 0.85), fern: hazeRamp(FP.fern, o.fog, o.haze * 0.9), ash: hazeRamp(TP.ash, o.fog, o.haze), char: hazeRamp(TP.char, o.fog, o.haze * 0.8),
    brk: hazeRamp(TP.bracken, o.fog, o.haze), rock: hazeRamp(TP.rock, o.fog, o.haze), warm: hazeRamp(TP.rockWarm, o.fog, o.haze), grav: hazeRamp(TP.gravel, o.fog, o.haze * 1.1),
    river: hazeRamp(TP.river, o.fog, o.haze * 0.7), dry: hazeRamp(HP.tussockDry, o.fog, o.haze),
  };
  // ---- per column: the crest, the blend of stretches, the dominant one
  const crest = new Float32Array(W + 8), wts = new Float32Array((W + 8) * 6);
  for (let x = -4; x < W + 4; x++) {
    const wx = (o.lx0 + x) / o.p + (noise1((o.lx0 + x) / 420, seed + 1) - 0.5) * 240;
    let ws = 0;
    for (let i = 0; i < 6; i++) { const w = bioW(wx, BIOMES[i]); wts[(x + 4) * 6 + i] = w; ws += w; }
    // each stretch's own hills, blended by weight (blending the frequency instead would tear the crest)
    const lx = o.lx0 + x, bio = o.bio ?? 1;
    let cr = 0;
    for (let i = 0; i < 6; i++) {
      const w = wts[(x + 4) * 6 + i] / (ws || 1);
      wts[(x + 4) * 6 + i] = w;
      if (w < 0.002) continue;
      const B = BIOMES[i];
      const f = 0.0055 * (1 + (FREQ[B] - 1) * bio);
      const n = fbm1(lx * f, 4, seed + i * 7);
      const ridged = 1 - Math.abs(n * 2 - 1);
      const v = n * 0.55 + ridged * 0.3 + fbm1(lx * f * 3.1, 2, seed + 9 + i) * 0.15;
      cr += w * clamp(v * 1.7 - 0.38, 0, 1.2) * (0.7 + (AMP[B] - 0.7) * bio);
    }
    const gw = wts[(x + 4) * 6 + 5], bw = wts[(x + 4) * 6 + 3];
    // crags in the gorge, a lumpy bush skyline over the gully, tufts and tips along a near crest
    const crag = gw * bio * (Math.pow(Math.abs(noise1(lx * 0.06, seed + 3) - 0.5) * 2, 3) * 18 * (0.4 + k));
    const lump = bw * bio * (noise1(lx * 0.18, seed + 4) - 0.5) * 7 * (0.3 + k);
    const tuft = k >= 0.9 ? (noise1(lx * 0.45, seed + 6) - 0.5) * 4 + (hash2(lx, 0, seed + 8) < 0.12 ? -2 - hash2(lx, 1, seed + 8) * 4 : 0) : 0;
    crest[x + 4] = o.base - cr * o.amp - crag - lump + tuft + (o.lift ? o.lift(lx) : 0);
  }
  const T = (x: number) => crest[clamp(Math.round(x), -4, W + 3) + 4];
  const dom = (x: number, r: number): Biome => {
    let acc = 0;
    const j = (clamp(Math.round(x), -4, W + 3) + 4) * 6;
    for (let i = 0; i < 6; i++) { acc += wts[j + i]; if (r <= acc) return BIOMES[i]; }
    return 'gorge';
  };
  // (coarse value-noise fields instead of noise2 per pixel: this band is thousands of px wide)
  const X0 = o.lx0;
  // (two octaves where a field is thresholded into patches, so the patches come out ragged, never boxy)
  const oct2 = (cx: number, cy: number, s2: number) => { const a = vgrid(X0, W, 0, H, cx, cy, s2), b = vgrid(X0, W, 0, H, cx * 0.43, cy * 0.43, s2 + 101); return (x: number, y: number) => a(x, y) * 0.62 + b(x, y) * 0.38; };
  const nG = vgrid(X0, W, 0, H, 50, 80, seed + 3, H), nW = vgrid(X0, W, 0, H, 20, 20, seed + 5), nGap = oct2(33, 20, seed + 11);
  const nReg = oct2(40, 25, seed + 17), nCl = vgrid(X0, W, 0, H, 8, 6, seed + 19), nRed = oct2(83, 33, seed + 23);
  const nWarm = oct2(50, 33, seed + 37), nBush = oct2(25, 25, seed + 41);
  const colBraid = new Float32Array(W), colBed = new Float32Array(W), rowFrac = new Float32Array(H);
  for (let x = 0; x < W; x++) { colBraid[x] = noise1((X0 + x) * 0.01, seed + 13) * 6; colBed[x] = fbm1((X0 + x) * 0.02, 2, seed + 29) * 6; }
  for (let y = 0; y < H; y++) rowFrac[y] = noise1(y * 0.05, seed + 31) * 3;
  for (let x = 0; x < W; x++) {
    const top = Math.round(T(x));
    const slope = (T(x + 4) - T(x - 4)) / 8;
    const lx = X0 + x;
    for (let y = Math.max(0, top); y < H; y++) {
      const d = y - top;
      const sx = x + d * 0.6 * Math.sign(slope || 1);
      const s2 = (T(sx + 4) - T(sx - 4)) / 8;
      let lit = -(s2 * 0.6 + slope * 0.4) * 2.4;
      lit += (nG(lx + d * 0.6, d) - 0.5) * 1.5 * Math.min(1, d / 18);
      lit = clamp(lit, -1.5, 1.5);
      const bz = bayer(x, y) - 0.5;
      const hz = hash2(lx, y, seed);
      const bio = dom(x + (nW(lx, y) - 0.5) * 24, hash2(lx, y, seed + 7) * 0.5 + (bz + 0.5) * 0.5);
      const fall = Math.min(2, d / 90);
      let c: C;
      switch (bio) {
        case 'scrub': {
          // kānuka canopy: fine grey-green bumps, golden grass in the gaps
          if (nGap(lx, y) < 0.32 && d > 3) c = pick(R.tus, 4.4 + lit * 1.8 - fall + bz * 0.8);
          else c = pick(R.leaf, 4.6 + lit * 2.2 - fall + bz * 0.8 + (k > 0.3 ? (hz > 0.82 ? 1 : hz < 0.12 ? -1.2 : 0) : 0));
          break;
        }
        case 'flats': {
          // the valley floor: grass terraces, the wide grey river bed and its silver braids
          const bed = !o.hedge && d > 4 + k * 6 + (nW(lx, y) - 0.5) * 10 && d < 18 + k * 40 + (nGap(lx, y) - 0.5) * 18;
          if (bed) {
            const br = Math.abs(Math.sin(lx * 0.013 + d * (0.22 - k * 0.12) + colBraid[x]));
            c = br < 0.1 + k * 0.05 ? pick(R.river, 8 - (br * 20) + bz) : pick(R.grav, 6 + lit + bz + (hz > 0.85 ? 1 : 0));
          } else c = pick(R.dry, 4 + lit * 1.6 - fall + bz * 0.8 + (hz > 0.86 ? 1 : 0));
          break;
        }
        case 'burnt': {
          // black slopes, grey ash, the green of the regrowth coming through
          const regrow = nReg(lx, y);
          c = regrow > 0.62 ? pick(R.brk, 3.6 + lit * 1.6 - fall + bz) : regrow < (o.hedge ? 0.2 : 0.3) ? pick(R.char, 3.4 + lit * 1.4 + bz) : pick(R.ash, 3.6 + lit * 2 - fall + bz + (hz > 0.9 ? 1.4 : 0));
          break;
        }
        case 'boa': {
          // dark wet bush in the fold, crowns lit on top
          c = pick(R.bush, 3.4 + lit * 1.6 + (nCl(lx, y) - 0.5) * 3 - fall + bz * 0.8);
          if (k > 0.4 && d < 6 && hz > 0.7) c = pick(R.fern, 5 + lit);
          break;
        }
        case 'tussock': {
          const redK = nRed(lx, y) > 0.66;
          let i = 5 + lit * 2.2 - fall + bz * 0.8;
          if (k > 0.3 && hz > 0.82) i += 0.9;
          if (k > 0.3 && hash2(lx, y + 1, seed + 1) > 0.9) i -= 1;
          c = pick(redK ? R.red : R.tus, redK ? i - 1.4 : i);
          break;
        }
        default: {
          // grey crags: bedded rock, fractures, the odd warm stain
          const sy = y + lx * 0.22 + colBed[x];
          const bedH = 3 + Math.round(k * 3), bv = ((sy % bedH) + bedH) % bedH;
          const bedL = bv < 1 ? 1.1 : bv >= bedH - 1 ? -1.3 : 0;
          const frac = Math.abs(Math.sin(lx * 0.09 + rowFrac[y])) < 0.05 ? -1.6 : 0;
          const warm = nWarm(lx, y) > 0.62;
          c = pick(warm ? R.warm : R.rock, 5 + lit * 2.4 + bedL * (0.4 + k * 0.6) + frac + bz - fall * 0.6);
          if (d > 30 + k * 30 && nBush(lx, y) > 0.55) c = pick(R.bush, 2.8 + lit + bz);
        }
      }
      // aerial perspective down the slopes (stepped and dithered)
      const hzk = Math.round((clamp((d - 26) / 170, 0, 1) * (0.55 - k * 0.45) + bz * 0.25) * 4) / 4;
      if (hzk > 0) c = mix(c, o.fog, Math.min(0.75, hzk * 0.6));
      b.data[y * W + x] = c;
    }
    // ---- what stands on the crest: dead spars on the burnt ridge, tree-fern stars over the gully
    if (k > 0.25) {
      const bio = dom(x, hash2(lx, 1, seed + 43));
      if (bio === 'burnt' && hash2(lx, 2, seed + 47) < 0.05 + k * 0.06) {
        const h = 6 + Math.floor(hash2(lx, 3, seed + 53) * (8 + k * 22)), wd = k > 0.6 && hash2(lx, 4, seed) < 0.5 ? 2 : 1;
        for (let j = 0; j < h; j++) for (let i = 0; i < wd; i++) {
          const yy = top - j + 1 + Math.floor(hash2(lx, 5, seed) * 3);
          if (yy < 0 || yy >= H) continue;
          b.data[yy * W + Math.min(W - 1, x + i)] = pick(i ? R.char : R.ash, i ? 2 : 3 + (j > h - 3 ? 1 : 0));
        }
        // a broken limb off the spar
        if (h > 12 && hash2(lx, 6, seed) < 0.5) for (let j = 0; j < 4; j++) { const yy = top - Math.round(h * 0.6) - j, xx = x + 1 + j; if (yy >= 0 && xx < W) b.data[yy * W + xx] = pick(R.char, 2); }
      }
      if (bio === 'boa' && hash2(lx, 7, seed + 59) < 0.035 + k * 0.03) {
        // a tree fern's crown above the bush: drooping fronds radiating from a short trunk
        const cy = top - 2 - Math.floor(k * 6), r = 3 + Math.floor(k * 6);
        for (let a = 0; a < 7; a++) {
          const ang = Math.PI * (1.05 + a * 0.14);
          for (let j = 1; j <= r; j++) {
            const xx = Math.round(x + Math.cos(ang) * j), yy = Math.round(cy + Math.sin(ang) * j * 0.55 + (j * j) / (r * 1.6));
            if (xx >= 0 && xx < W && yy >= 0 && yy < H) b.data[yy * W + xx] = pick(R.fern, 3 + (a < 3 ? 2 : 1));
          }
        }
        for (let j = 0; j < 2 + k * 4; j++) { const yy = cy + j + 1; if (yy >= 0 && yy < H) b.data[yy * W + x] = pick(R.bush, 1); }
      }
    }
  }
  return b;
}

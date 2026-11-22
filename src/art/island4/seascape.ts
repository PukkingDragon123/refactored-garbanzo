// The island's sea, sky pieces and offshore rocks, painted as pixel art (no vector shapes, no noise
// speckle). The sea seen from the beach is ONE continuous sheet from the horizon to the sand: every
// screen row is its own depth (its own parallax factor), so there are no stacked strips and no seams.
//
//   SEA_ROWS rows, row 0 is the horizon line. Row i sits at reference screen y SEA_HZ + i (camera at
//   y 180, zoom 1.25) with parallax seaRowP(SEA_HZ + i). Each row is painted in its own texel scale
//   (one texel = one screen pixel at the base zoom) and tiles every rows[i].w texels; the content is a
//   function of world x, so a swell crest stays one coherent line however far the camera walks.
//
//   SEA_FRAMES frames (stacked vertically in one sheet) loop the swell rolling one wavelength in:
//   perspective-compressed swell rows (sub-pixel far out, a dozen rows apart at the surf line), crests
//   broken into hand-placed lit dashes, darker faces and troughs, cat's-paw wavelet clusters that come
//   and go, long glassy wind lanes, and foam lace drifting over the turquoise shallows. Colour runs from
//   the hazy horizon through deep blue to turquoise over the sand in stepped tones with short,
//   stroke-shaped dither seams that follow the waves.

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade, withAlpha } from '../color';
import { tnoise } from '../ocean';
import { Rng, clamp, hash2, lerp, noise1, smoothstep } from '../../core/math';

export const SEA_HZ = 124;
export const SEA_ROWS = 100;
export const SEA_FRAMES = 12;
/** world-x period of the sea's content */
const PX = 1200;
const ZB = 1.25;

const ANCH: [number, number][] = [[124, 0.05], [126, 0.075], [138, 0.2], [158, 0.42], [186, 0.72], [217, 1.0], [260, 1.35]];
/** parallax factor of the sea at reference screen row sy */
export function seaRowP(sy: number): number {
  if (sy <= ANCH[0][0]) return ANCH[0][1];
  for (let i = 1; i < ANCH.length; i++) {
    const [y1, p1] = ANCH[i];
    if (sy <= y1) {
      const [y0, p0] = ANCH[i - 1];
      return lerp(p0, p1, (sy - y0) / (y1 - y0));
    }
  }
  return ANCH[ANCH.length - 1][1];
}

export interface SeaRow { p: number; w: number }
export interface SeaSheet { buf: PixelBuffer; rows: SeaRow[]; frameH: number }

// depth tones, far to near: [trough, face, base, light, crest]
const TONES: [number, string[]][] = [
  [1, ['#86b7d0', '#8fbed5', '#9ac6da', '#b0d4e3', '#d3e9ef']],
  [4, ['#5e9ac4', '#6aa4ca', '#78afd1', '#94c3dd', '#c4e2ec']],
  [10, ['#3c7fb6', '#4689bd', '#5395c5', '#72acd4', '#b2d8e8']],
  [20, ['#2a67a2', '#2f71ab', '#3a7fb7', '#5898c8', '#a8d4e8']],
  [34, ['#215893', '#26629d', '#2d6faa', '#4a8bc0', '#a4d6ea']],
  [50, ['#1d5a8a', '#216896', '#2a7aa6', '#4296bf', '#b0e2ee']],
  [62, ['#1b6a88', '#1f7895', '#2a8ca6', '#46a8bf', '#c2eef0']],
  [72, ['#217f92', '#2a91a2', '#38a6b3', '#5ebfc3', '#d8f8f4']],
  [82, ['#3398a0', '#40aaae', '#55bcbc', '#7dd0c8', '#ecfffa']],
  [90, ['#4aa9a4', '#5cbbb2', '#73cac0', '#98dccd', '#f4fffb']],
];
const TONE_C: C[][] = TONES.map(([, t]) => t.map(h => hex(h)));
const FOAM = [hex('#d8f4f0'), hex('#f2fffc'), hex('#ffffff')];

/** stepped depth index (fractional) for a row offset s */
function depthAt(s: number): number {
  for (let i = 1; i < TONES.length; i++) {
    if (s < TONES[i][0]) return i - 1 + (s - TONES[i - 1][0]) / (TONES[i][0] - TONES[i - 1][0]);
  }
  return TONES.length - 1;
}

/**
 * The continuous beach sea: every row from the horizon to the sand, SEA_FRAMES frames of the swell
 * coming in, stacked in one sheet (frame f occupies rows f * frameH ..).
 */
export function paintSeaSheet(seed = 7): SeaSheet {
  const rows: SeaRow[] = [];
  for (let i = 0; i < SEA_ROWS; i++) {
    const p = seaRowP(SEA_HZ + i);
    const nat = Math.round(PX * p * Math.pow(ZB, p));
    rows.push({ p, w: Math.max(420, nat) });
  }
  const W = Math.max(...rows.map(r => r.w));
  const F = SEA_FRAMES, H = SEA_ROWS;
  const buf = new PixelBuffer(W, H * F);
  const rng = new Rng(seed * 31 + 5);
  const LAM = 0.13;
  // ---- static fields per row (the swell's refraction over the bottom, cat's-paw patches, stroke seams)
  type RowF = { wig: Float32Array; patch: Float32Array; stroke: Float32Array; crs: Float32Array; lace: Float32Array | null; ripple: Uint8Array | null };
  const rf: RowF[] = [];
  for (let i = 0; i < H; i++) {
    const w = rows[i].w, s = i;
    const Z = 60 / (s + 0.5);
    const wig = new Float32Array(w), patch = new Float32Array(w), stroke = new Float32Array(w), crs = new Float32Array(w);
    const lc = s > 68 ? new Float32Array(w) : null;
    const rip: Uint8Array | null = null;
    // stroke threshold: horizontal runs a few px long that change every row (painted dabs, not checker)
    const sl = 3 + s * 0.09;
    for (let j = 0; j < w; j++) {
      const X = (j * PX) / w;
      wig[j] = (tnoise(X / 200, Z * 0.9, 6, seed) - 0.5) * 0.5 + (tnoise(X / 60, Z * 2.1 + 3, 20, seed + 1) - 0.5) * 0.14;
      patch[j] = tnoise(X / 150, s / 6, 8, seed + 2) * 0.7 + tnoise(X / 50, s / 3, 24, seed + 3) * 0.3;
      stroke[j] = tnoise(j / sl, i * 0.42, Math.max(1, Math.round(w / sl)), seed + 4) * 0.75 + tnoise(j / (sl * 0.5), i * 1.3, Math.max(1, Math.round((w * 2) / sl)), seed + 14) * 0.25;
      if (lc) {
        // foam left behind a passing crest: horizontal threads and clots, a static field the crest
        // phase sweeps over (so it fizzes in place and thins out as it ages)
        lc[j] = tnoise(X / 9, Z * 16, PX / 9, seed + 5) * 0.62 + tnoise(X / 3.5, Z * 40, Math.round(PX / 3.5), seed + 6) * 0.38;
        crs[j] = tnoise(X / 12, s * 0.7, PX / 12, seed + 9);
      } else crs[j] = tnoise(X / 12, s * 0.7, PX / 12, seed + 9);
    }
    rf.push({ wig, patch, stroke, crs, lace: lc, ripple: rip });
  }
  // ---- long glassy wind lanes (static): [row, start texel, length]
  const lanes: [number, number, number][] = [];
  for (let i = 1; i < 36; i++) {
    const n = rng.chance(0.5) ? rng.int(1, 2) : 0;
    for (let k = 0; k < n; k++) lanes.push([i, rng.int(0, rows[i].w - 1), Math.round(rng.range(14, 70) * (0.5 + i / 40))]);
  }
  // ---- wavelet dashes: per row a jittered set of cells, each with its own life window in the loop
  type Dash = { i: number; x: number; len: number; f0: number; d: number; crest: boolean };
  const dashes: Dash[] = [];
  for (let i = 2; i < 78; i++) {
    const w = rows[i].w;
    const cell = clamp(4 + i * 0.16, 4, 16);
    const n = Math.max(1, Math.round(w / cell));
    const dens = 0.14 + smoothstep(4, 24, i) * 0.14 - smoothstep(34, 64, i) * 0.18;
    for (let c = 0; c < n; c++) {
      const h0 = hash2(c, i, seed + 40);
      const x = Math.floor((c + hash2(c, i, seed + 41) * 0.7) * (w / n));
      if (h0 > dens * (0.35 + rf[i].patch[x % w] * 1.3)) continue;
      const len = (i > 12 ? 2 : 1) + Math.floor(hash2(c, i, seed + 42) * (1 + i / 11));
      dashes.push({ i, x, len, f0: Math.floor(hash2(c, i, seed + 43) * F), d: 3 + Math.floor(hash2(c, i, seed + 44) * 6), crest: hash2(c, i, seed + 45) < 0.08 });
    }
  }
  for (let f = 0; f < F; f++) {
    const phi = f / F;
    const oy = f * H;
    for (let i = 0; i < H; i++) {
      const w = rows[i].w, s = i, R = rf[i];
      const row = (oy + i) * W;
      if (i === 0) {
        // the horizon: one crisp hazy line, a touch brighter in long stretches
        for (let j = 0; j < w; j++) buf.data[row + j] = R.patch[j] > 0.62 ? hex('#cfe5ec') : hex('#b9d7e3');
        continue;
      }
      const Z = 60 / (s + 0.5);
      const rowsPer = (LAM * (s + 0.5) * (s + 0.5)) / 60;
      const A = smoothstep(16, 44, s) * (1 - 0.55 * smoothstep(70, 86, s));
      const cw = clamp(1.15 / rowsPer, 0.02, 0.5);
      const d0 = depthAt(s);
      for (let j = 0; j < w; j++) {
        const u = Z / LAM + phi + R.wig[j];
        const v = u - Math.floor(u);
        // tone: 0 trough, 1 face, 2 base, 3 light, 4 crest
        let sh = 0;
        if (v < cw) sh = 2;
        else if (v < 0.3) sh = 1.2 - (v - cw) / (0.3 - cw) * 0.8;
        else if (v < 0.55) sh = 0;
        else sh = -0.4 - ((v - 0.55) / 0.45) * 1.8;
        sh *= A;
        const st = R.stroke[j];
        let tone = 2 + Math.floor(sh + 0.5 + (st - 0.5) * (0.95 - 0.45 * A));
        // crest highlight only where the crest is sharp (broken, in clusters along the line)
        if (v < cw && A > 0.3 && R.crs[j] > 0.6 - A * 0.06) tone = 4;
        else tone = clamp(tone, 0, 3);
        // depth band with a stroke-shaped seam that follows the swell
        const dq = d0 + (v < 0.5 ? 0.3 : -0.3) * A + (st - 0.5) * 0.9 + (R.patch[j] - 0.5) * 0.6;
        const di = clamp(Math.floor(dq), 0, TONES.length - 1);
        let c = TONE_C[di][tone];
        // foam lace over the shallows, left behind each passing crest and fading as it ages
        if (R.lace && v < 0.42) {
          const k = smoothstep(70, 84, s);
          const thr = 0.6 + v * 0.75 - k * 0.12;
          if (R.lace[j] > thr) c = v < 0.12 ? FOAM[1] : v < 0.26 ? FOAM[0] : TONE_C[di][4];
        }
        buf.data[row + j] = c;
      }
    }
    // wind lanes: glassy lighter streaks, ragged at the ends
    for (const [i, x0, len] of lanes) {
      const w = rows[i].w, row = (oy + i) * W;
      const di = clamp(Math.floor(depthAt(i)), 0, TONES.length - 1);
      for (let k = 0; k < len; k++) {
        const end = Math.min(k, len - 1 - k);
        if (end < 4 && hash2(k, i, seed + 50) > end / 4) continue;
        const j = (x0 + k) % w;
        buf.data[row + j] = mix(TONE_C[di][3], TONE_C[di][2], 0.35);
      }
    }
    // wavelets: a lit dash with its little shadow under and one pixel to the right
    for (const d of dashes) {
      const age = (f - d.f0 + F) % F;
      if (age >= d.d) continue;
      const grow = age === 0 || age === d.d - 1 ? Math.max(1, d.len - 1) : d.len;
      const w = rows[d.i].w, row = (oy + d.i) * W;
      const di = clamp(Math.floor(depthAt(d.i)), 0, TONES.length - 1);
      const lit = d.crest && d.i > 8 ? TONE_C[di][4] : TONE_C[di][3];
      for (let k = 0; k < grow; k++) buf.data[row + ((d.x + k) % w)] = lit;
      if (d.i > 14 && d.i + 1 < H) {
        const w2 = rows[d.i + 1].w, row2 = (oy + d.i + 1) * W;
        for (let k = 1; k < grow; k++) buf.data[row2 + ((d.x + k) % w2)] = TONE_C[di][1];
      }
    }
  }
  return { buf, rows, frameH: H };
}

// ------------------------------------------------------------------ glitter

/** sun glitter: hand-shaped sparkle clusters (1px point, a short dash, a 3-arm star, a long dash) */
export function paintGlints(): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  const core = hex('#fffef4'), warm = hex('#fff0c4'), dim = withAlpha(hex('#ffe9b0'), 150);
  const pats: string[][] = [
    ['x'],
    ['ox'],
    ['oxxo'],
    ['.o.', 'oxo', '.o.'],
    ['..o..', 'oxxxo', '..o..'],
    ['ooxxxoo'],
  ];
  for (const p of pats) {
    const b = new PixelBuffer(p[0].length, p.length);
    p.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') b.set(x, y, core); else if (ch === 'o') b.set(x, y, y === Math.floor(p.length / 2) ? warm : dim); }));
    out.push(b);
  }
  return out;
}

// ------------------------------------------------------------------ sun and rainbow

/**
 * The sun: a crisp pixel disc (`halo` false) or its stepped, dithered halo (`halo` true), painted
 * separately so only the disc glows. No smooth glow sprites.
 */
export function paintIsleSun(halo = false): PixelBuffer {
  const R = 26, S = R * 2 + 1;
  const b = new PixelBuffer(S, S);
  const core = hex('#fffdf4'), rim = hex('#fff3cc');
  const h1 = withAlpha(hex('#fff6dc'), 120), h2 = withAlpha(hex('#fff4d8'), 70), h3 = withAlpha(hex('#fff2d2'), 40);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - R, dy = y - R;
    const d = Math.sqrt(dx * dx + dy * dy);
    // a softly irregular disc edge (the atmosphere wobbles it a pixel)
    const e = 6.6 + (noise1(Math.atan2(dy, dx) * 3 + 2, 9) - 0.5) * 0.9;
    if (d < e) { if (!halo) b.data[y * S + x] = d < e - 1.2 ? core : rim; }
    else if (!halo) continue;
    else if (d < 10) b.data[y * S + x] = (x + y) % 2 === 0 || d < 8 ? h1 : h2;
    else if (d < 16) { if ((x + y) % 2 === 0) b.data[y * S + x] = h2; }
    else if (d < R) { if ((x & 1) === 0 && (y & 1) === 0 && d < 16 + (R - 16) * (0.5 + hash2(x, y, 3) * 0.5)) b.data[y * S + x] = h3; }
  }
  return b;
}

/**
 * A faint morning rainbow: one leg only, rising out of the sea and fading out before the top, four
 * one-pixel hue bands, dithered thin and broken by passing haze. Painted at 1:1, never smooth.
 */
export function paintRainbowLeg(r = 150): PixelBuffer {
  const w = Math.round(r * 0.62), h = r + 2;
  const b = new PixelBuffer(w, h);
  const bands = [hex('#e87a6a'), hex('#eec070'), hex('#9ad08a'), hex('#7aa6e0')];
  // centre of the arc sits off the buffer to the left: the leg climbs from the bottom right
  const cx = -r * 0.42, cy = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - cx, y - cy);
    const k = r - d;
    if (k < 0 || k >= bands.length) continue;
    const t = 1 - y / h; // 0 at the sea, 1 at the top
    // strongest low down, gone well before the top; broken by haze patches
    const vis = smoothstep(0.62, 0.12, t) * (noise1(y / 14, 21) > 0.32 ? 1 : 0.3);
    const thr = ((x * 3 + y * 5) % 7) / 7;
    if (thr > vis * 0.85) continue;
    b.data[y * w + x] = withAlpha(bands[Math.floor(k)], 90 + Math.round(70 * vis));
  }
  return b;
}

// ------------------------------------------------------------------ clouds

/**
 * A cumulus painted as one piece: a hand-shaped silhouette (a lumpy, flattened crown with a flat,
 * ragged base), each billow lit from the upper left with a hard terminator, deep creases where one
 * billow tucks under the next, a sunlit rim and torn wisps at the ends. Four tones, no dither field.
 */
export function paintIsleCloud(seed: number, w: number, h: number, ramp: C[]): PixelBuffer {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  const baseY = Math.round(h * 0.8);
  type Bil = { x: number; y: number; rx: number; ry: number; ph: number };
  // back tier: a few big towers in the middle; front tier: smaller billows along the base, in front
  const back: Bil[] = [], front: Bil[] = [];
  const nb = rng.int(2, 3);
  for (let k = 0; k < nb; k++) {
    const rx = w * rng.range(0.13, 0.2), ry = Math.min(baseY - 1, rx * rng.range(0.85, 1.1));
    back.push({ x: w * (0.3 + (k + rng.range(-0.2, 0.2)) * (0.4 / Math.max(1, nb - 1))), y: baseY - ry * rng.range(0.55, 0.8), rx, ry, ph: rng.range(0, 9) });
  }
  let x = w * 0.07;
  while (x < w * 0.93) {
    const t = x / w;
    const edge = Math.pow(Math.sin(t * Math.PI), 0.6);
    const rx = w * rng.range(0.05, 0.11) * (0.6 + edge * 0.5), ry = rx * rng.range(0.7, 0.95);
    front.push({ x, y: baseY - ry * rng.range(0.25, 0.5), rx, ry, ph: rng.range(0, 9) });
    x += rx * rng.range(1.1, 1.6);
  }
  const all = [...front, ...back]; // front-most first
  const ns = seed * 3 + 1;
  const idAt = new Int16Array(w * h).fill(-1);
  const nxA = new Float32Array(w * h), nyA = new Float32Array(w * h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if (yy > baseY + Math.round((noise1(xx / 6, ns) - 0.5) * 3)) continue;
    for (let k = 0; k < all.length; k++) {
      const B = all[k];
      const dx = (xx + 0.5 - B.x) / B.rx, dy = (yy + 0.5 - B.y) / B.ry;
      const ang = Math.atan2(dy, dx);
      // cauliflower edge: small bulges along the rim of each billow
      const warp = (noise1(ang * 2.2 + B.ph, ns + 2) - 0.5) * 0.34 + (noise1(ang * 7 + B.ph, ns + 3) - 0.5) * 0.16;
      if (dx * dx + dy * dy < 1 + warp) { idAt[yy * w + xx] = k; nxA[yy * w + xx] = dx; nyA[yy * w + xx] = dy; break; }
    }
  }
  const [dark, mid, lite, hi] = ramp;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const i = yy * w + xx, id = idAt[i];
    if (id < 0) continue;
    const nx = nxA[i], ny = nyA[i];
    let l = -0.5 * nx - 0.85 * ny + (noise1(xx / 4 + yy / 5, ns + 4) - 0.5) * 0.22;
    l -= smoothstep(baseY - 8, baseY, yy) * 0.6; // the flat underside in shade
    const up = yy > 0 ? idAt[i - w] : -1;
    if (up < 0 && l > -0.2) l += 0.45; // sunlit top rim
    const dn = yy + 1 < h ? idAt[i + w] : -1;
    if (up > id) l += 0.35; // a front billow's top edge against the one behind it
    if (dn >= 0 && dn < id) l -= 0.75; // the crease on the back billow just above a front one
    const c = l > 0.62 ? hi : l > 0.08 ? lite : l > -0.45 ? mid : dark;
    b.data[i] = c;
  }
  // torn wisps trailing off the ends of the base
  for (let k = 0; k < 2; k++) {
    const dir = k ? 1 : -1;
    let x0 = -1;
    for (let xx = k ? w - 1 : 0; k ? xx >= 0 : xx < w; xx += k ? -1 : 1) if (idAt[(baseY - 1) * w + xx] >= 0) { x0 = xx; break; }
    if (x0 < 0) continue;
    const y0 = baseY - rng.int(1, 3);
    const len = rng.int(Math.round(w * 0.05), Math.round(w * 0.12));
    for (let j = 0; j < len; j++) {
      const xx = x0 + dir * j, yy = y0 + Math.round(Math.sin(j * 0.3 + k) * 0.8);
      if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
      if (j > len * 0.55 && (j + k) % 3 === 0) continue;
      if (!(b.data[yy * w + xx] >>> 24)) b.data[yy * w + xx] = j < len * 0.4 ? mid : withAlpha(lite, 170);
    }
  }
  return b;
}

// ------------------------------------------------------------------ far islands

/**
 * The far archipelago: hand-shaped silhouettes (a ragged volcano with a broken crater rim, long
 * ridged islands with shoulders and saddles, low headlands), lit from the morning sun with stepped
 * ridge facets, gullies running down from every notch, and the base sinking into the sea haze in
 * two dithered steps. No straight cone slopes.
 */
export function paintFarIsles(w: number, h = 80, seed = 3): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  // key points per island: [x, height 0..1] (left base .. right base), refined by midpoint displacement
  const isles: [number, number][][] = [
    [[0.02, 0], [0.06, 0.18], [0.1, 0.26], [0.14, 0.31], [0.19, 0.2], [0.22, 0]],
    [[0.13, 0], [0.18, 0.28], [0.215, 0.6], [0.235, 0.78], [0.245, 0.74], [0.255, 0.8], [0.275, 0.62], [0.31, 0.34], [0.36, 0]],
    [[0.37, 0], [0.4, 0.16], [0.43, 0.27], [0.46, 0.22], [0.49, 0]],
    [[0.52, 0], [0.55, 0.22], [0.58, 0.4], [0.61, 0.52], [0.635, 0.47], [0.66, 0.55], [0.7, 0.36], [0.74, 0.18], [0.77, 0]],
    [[0.79, 0], [0.82, 0.15], [0.84, 0.21], [0.87, 0.12], [0.89, 0]],
    [[0.88, 0], [0.91, 0.24], [0.935, 0.38], [0.96, 0.33], [0.99, 0.14], [1.0, 0.05]],
  ];
  const prof = new Float32Array(w);
  for (const pts of isles) {
    // densify with midpoint displacement for a natural ragged ridgeline
    let line = pts.map(([px, ph]) => [px * w, ph * h * 0.95] as [number, number]);
    for (let it = 0; it < 4; it++) {
      const nl: [number, number][] = [];
      for (let k = 0; k < line.length - 1; k++) {
        const [ax, ay] = line[k], [bx, by] = line[k + 1];
        nl.push([ax, ay]);
        const amp = (bx - ax) * 0.22 * (ay > 0 || by > 0 ? 1 : 0);
        nl.push([(ax + bx) / 2 + rng.range(-1, 1) * (bx - ax) * 0.08, Math.max(0, (ay + by) / 2 + rng.range(-0.6, 1) * amp)]);
      }
      nl.push(line[line.length - 1]);
      line = nl;
    }
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, ay] = line[k], [bx, by] = line[k + 1];
      for (let xx = Math.max(0, Math.floor(ax)); xx < Math.min(w, Math.ceil(bx)); xx++) {
        const t = (xx - ax) / Math.max(0.001, bx - ax);
        const v = lerp(ay, by, t);
        if (v > prof[xx]) prof[xx] = v;
      }
    }
  }
  // peaks, each with a spine running down it: left of the spine faces the morning sun
  const peaks: { x: number; top: number; end: number; sp: Float32Array }[] = [];
  for (let xx = 3; xx < w - 3; xx++) {
    const v = prof[xx];
    if (v < 6) continue;
    let ok = true;
    for (let k = 1; k <= 16 && ok; k++) if ((xx - k >= 0 && prof[xx - k] > v) || (xx + k < w && prof[xx + k] >= v)) ok = false;
    if (!ok) continue;
    const top = Math.round(h - v);
    const sp = new Float32Array(h);
    // the spur runs down and out from the peak, wandering, and dies out part way down
    let sx = xx;
    const out = (hash2(xx, 5, seed) < 0.5 ? -1 : 1) * (0.25 + hash2(xx, 6, seed) * 0.45);
    for (let yy = 0; yy < h; yy++) {
      if (yy > top) sx += out + (noise1(yy / 5 + xx * 0.37, seed + 11) - 0.5) * 1.2;
      sp[yy] = sx;
    }
    peaks.push({ x: xx, top, end: top + Math.round(v * (0.55 + hash2(xx, 7, seed) * 0.3)), sp });
  }
  const lit = [hex('#93adc8'), hex('#8ca7c3')], shadow = [hex('#5f7a9b'), hex('#5a7596')];
  const ridge = hex('#b4c8dc');
  const haze = hex('#a9c3d8'), haze2 = hex('#bcd2e2');
  // gullies: a few wavy creases running down-slope from the deeper notches
  const gully = new Uint8Array(w * h);
  let lastG = -99;
  for (let xx = 3; xx < w - 3; xx++) {
    const dl = prof[xx - 3] - prof[xx], dr = prof[xx + 3] - prof[xx];
    if (dl < 1.6 || dr < 1.6 || xx - lastG < 18) continue;
    lastG = xx;
    let gx = xx;
    const top = Math.round(h - prof[xx]) + 1;
    const len = Math.round(prof[xx] * rng.range(0.3, 0.7));
    for (let k = 0; k < len; k++) {
      const yy = top + k;
      if (yy >= h) break;
      gx += (noise1(k / 4 + xx, seed + 12) - 0.5) * 1.3;
      const gi = Math.round(gx);
      if (gi >= 0 && gi < w) gully[yy * w + gi] = 1;
    }
  }
  for (let xx = 0; xx < w; xx++) {
    const hh = prof[xx];
    if (hh < 0.6) continue;
    const top = Math.round(h - hh);
    for (let yy = top; yy < h; yy++) {
      const d = yy - top;
      const alt = (h - yy) / Math.max(1, hh); // 1 at the ridge .. 0 at the sea
      // the nearest spine at this height
      let best = 1e9, side = 0;
      for (const pk of peaks) {
        if (pk.top > yy || yy > pk.end) continue;
        const dx = xx - pk.sp[yy];
        if (Math.abs(dx) < Math.abs(best)) { best = dx; side = dx < 0 ? 1 : -1; }
      }
      const band = noise1(xx / 7 + Math.floor(yy / 5) * 3.1, seed + 13) > 0.6 ? 1 : 0;
      // below where the spurs die out the slopes merge into the plain flank
      let c = side > 0 ? lit[band] : side < 0 ? shadow[band] : mix(lit[1], shadow[0], 0.5);
      if (side > 0 && best > -1.5 && d < hh * 0.6) c = ridge; // the sunlit edge of the spine
      if (d < 1 && side > 0) c = mix(c, ridge, 0.6);
      if (gully[yy * w + xx]) c = side > 0 ? shadow[0] : shadow[1];
      // sink into the sea haze in two dithered steps
      const hz = 1 - alt;
      const bq = ((xx * 2 + yy * 3) % 4) / 4;
      if (hz > 0.8 || (hz > 0.66 && bq < (hz - 0.66) / 0.14)) c = mix(c, haze2, 0.62);
      else if (hz > 0.5 || (hz > 0.36 && bq < (hz - 0.36) / 0.14)) c = mix(c, haze, 0.4);
      else c = mix(c, haze, 0.26);
      b.data[yy * w + xx] = c;
    }
  }
  // a thread of steam off the volcano's crater
  const vx = Math.round(w * 0.245), vy = Math.round(h - prof[vx]);
  for (let k = 0; k < 18; k++) {
    const xx = vx + Math.round(k * 0.7 + Math.sin(k * 0.5) * 1.5), yy = vy - 2 - k;
    if (xx < 0 || xx >= w || yy < 0) continue;
    if (k > 10 && k % 2) continue;
    b.data[yy * w + xx] = withAlpha(hex('#dfe8ee'), 150 - k * 6);
    if (k > 4 && xx + 1 < w) b.data[yy * w + xx + 1] = withAlpha(hex('#cfdce6'), 90 - k * 3);
  }
  void shade;
  return b;
}

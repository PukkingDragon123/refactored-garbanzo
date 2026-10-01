// V4 island scenery: sky gradients for every time of the day, the far archipelago, the sea bands,
// the reef, sea stacks, headland cliffs, the sea cave (back wall and the rock arch in front of the
// camera), dappled leaf-shadow cookies and overhanging pōhutukawa branches.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, withAlpha, C } from '../color';
import * as L from '../landscape';
import * as O from '../ocean';
import { Rng, bayer, clamp, fbm1, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';
import type { Sprite } from '../jungle-core';

// ------------------------------------------------------------------ sky

export type SkyKey = 'morning' | 'day' | 'golden' | 'dusk' | 'night';
export const SKY_KEYS: SkyKey[] = ['morning', 'day', 'golden', 'dusk', 'night'];
const SKY_STOPS: Record<SkyKey, [number, string][]> = {
  morning: [[0, '#2a5fae'], [0.4, '#4f8fd2'], [0.72, '#94c4e8'], [0.9, '#d6e8ee'], [1, '#f4ead4']],
  day: [[0, '#2c6cc2'], [0.45, '#5a9edc'], [0.8, '#a4d2ee'], [1, '#e4f4f4']],
  golden: [[0, '#34508e'], [0.35, '#6a78ae'], [0.62, '#d49a8a'], [0.84, '#f4b878'], [1, '#ffd892']],
  dusk: [[0, '#161c44'], [0.3, '#3c2e66'], [0.56, '#8a4a78'], [0.8, '#e4706a'], [1, '#ffa45e']],
  night: [[0, '#04060e'], [0.45, '#08122c'], [0.8, '#12224a'], [1, '#1e3160']],
};

/** vertical sky gradient with dithered bands (w x h, horizon at the bottom row) */
export function paintSkyKey(k: SkyKey, w: number, h: number): PixelBuffer {
  const stops = SKY_STOPS[k].map(([t, c]) => ({ t, c: hex(c) }));
  const b = L.paintSky(w, h, stops, 34);
  // a few high cirrus streaks catching the light
  const rng = new Rng(k.length * 13 + 5);
  const lit = k === 'night' ? hex('#3a4a74') : k === 'dusk' ? hex('#ffb48a') : k === 'golden' ? hex('#ffe0b0') : hex('#ffffff');
  for (let i = 0; i < 16; i++) {
    const cx = rng.range(-40, w), cy = rng.range(h * 0.12, h * 0.7), len = rng.range(50, 160), a = k === 'night' ? 0.12 : 0.22;
    for (let j = 0; j < len; j++) {
      const x = Math.round(cx + j), y = Math.round(cy + Math.sin(j * 0.04 + i) * 3 + j * 0.03);
      if (x < 0 || x >= w || y < 0 || y >= h || (j + i) % 3 === 0) continue;
      const q = Math.sin((j / len) * Math.PI);
      b.data[y * w + x] = mix(b.data[y * w + x], lit, a * q);
    }
  }
  return b;
}

// ------------------------------------------------------------------ far archipelago

export function paintFarIslands(w: number, h = 80, seed = 3): PixelBuffer {
  // a chain of hazy islands: each a noisy bump; one volcano cone with a crater notch
  const b = new PixelBuffer(w, h);
  const isles: [number, number, number, boolean][] = [[w * 0.12, 0.34, 70, false], [w * 0.24, 0.95, 80, true], [w * 0.41, 0.28, 60, false], [w * 0.6, 0.52, 120, false], [w * 0.8, 0.22, 50, false], [w * 0.92, 0.4, 90, false]];
  const heightAt = (x: number) => {
    let best = 0;
    for (const [cx, k, rw, cone] of isles) {
      const d = Math.abs(x - cx) / rw;
      if (d >= 1) continue;
      let v = cone ? (1 - d) * (d < 0.05 ? 0.94 : 1) : Math.pow(Math.cos(d * Math.PI * 0.5), 1.4);
      v *= 1 + (fbm1(x / 30, 3, seed) - 0.5) * (cone ? 0.1 : 0.4);
      best = Math.max(best, v * k * h);
    }
    return best;
  };
  const body = hex('#6a88aa'), lit = hex('#88a4c2'), dark = hex('#57739a'), haze = hex('#a8c4dc');
  for (let x = 0; x < w; x++) {
    const hh = heightAt(x);
    if (hh < 1) continue;
    const slope = heightAt(x + 3) - heightAt(x - 3);
    for (let y = Math.round(h - hh); y < h; y++) {
      const d = y - (h - hh);
      let c = slope > 1.2 ? lit : slope < -1.2 ? dark : body;
      if (fbm2(x / 9, y / 6, 2, seed + 2) > 0.62 && d > 3) c = mix(c, dark, 0.5);
      const f = smoothstep(h * 0.35, h, y + (bayer(x, y) - 0.5) * 6);
      b.data[y * w + x] = mix(c, haze, 0.25 + f * 0.6);
    }
  }
  return b;
}

// ------------------------------------------------------------------ sea bands

export type SeaBand = 'horizon' | 'far' | 'mid' | 'near';
export const SEA: Record<SeaBand, { p: number; texW: number; texH: number; detail: number; shore: number }> = {
  horizon: { p: 0.06, texW: 512, texH: 18, detail: 0.18, shore: 0 },
  far: { p: 0.2, texW: 512, texH: 26, detail: 0.34, shore: 0.1 },
  mid: { p: 0.42, texW: 640, texH: 34, detail: 0.55, shore: 0.35 },
  near: { p: 0.72, texW: 768, texH: 46, detail: 0.8, shore: 0.85 },
};

function mixPal(a: O.WaterPalette, b: O.WaterPalette, t: number): O.WaterPalette {
  const m = (x: C, y: C) => mix(x, y, t);
  return {
    rim: m(a.rim, b.rim), glow: a.glow.map((c, i) => m(c, b.glow[i])), face: a.face.map((c, i) => m(c, b.face[i])),
    lightLine: m(a.lightLine, b.lightLine), lightLine2: m(a.lightLine2, b.lightLine2), darkLine: m(a.darkLine, b.darkLine),
    foam: a.foam.map((c, i) => m(c, b.foam[i])), deep: m(a.deep, b.deep), haze: m(a.haze, b.haze),
  };
}

/** tileable strip for one sea band (texW + WRAP wide) */
export function paintSeaBand(name: SeaBand, seed = 5): PixelBuffer {
  const s = SEA[name];
  const spec: O.BandSpec = { name: name === 'near' ? 'near' : name, p: s.p, texW: s.texW, texH: s.texH, col: 2, glowH: Math.max(1, Math.round(s.texH / 14)), detail: s.detail, ampK: s.p };
  const pal = O.bandPalette(mixPal(O.CALM, O.SHORE, s.shore), Math.max(0.3, s.p * 1.2));
  return O.paintBandStrip(spec, pal, false, seed);
}

// ------------------------------------------------------------------ offshore features

/** a tall rock stack with a green cap and guano streaks */
export function paintSeaStack(seed: number, w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const half = (w * 0.26 + t * w * 0.2) * (0.85 + (noise1(y / 9, seed) - 0.5) * 0.35);
    const off = (noise1(y / 30, seed + 3) - 0.5) * w * 0.12;
    for (let x = 0; x < w; x++) {
      const dx = x - cx - off;
      if (Math.abs(dx) > half) continue;
      const u = dx / half;
      const n = fbm2(x / 6, y / 4, 3, seed + 9);
      let c = u < -0.35 ? hex('#7a7068') : u > 0.45 ? hex('#3e3834') : n > 0.55 ? hex('#625850') : hex('#544a44');
      if (Math.sin(y * 0.5 + n * 4) > 0.85) c = shade(c, -0.1);
      if (y < h * 0.14 + (noise1(x / 5, seed + 1) - 0.5) * 6) c = mix(hex('#4a6a34'), hex('#6a8a44'), bayer(x, y));
      if (hash2(x, y, seed) < 0.03 && y > h * 0.12 && y < h * 0.7) c = hex('#e8e4d8');
      b.data[y * w + x] = c;
    }
  }
  void rng;
  return b;
}

/** low reef rocks awash in the mid band */
export function paintReef(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let x = 0; x < w; x++) {
    const top = h - 2 - Math.max(0, fbm1(x / 26, 3, seed) - 0.35) * h * 1.6;
    for (let y = Math.max(0, Math.round(top)); y < h; y++) {
      const d = y - top;
      b.data[y * w + x] = d < 1.5 ? hex('#8a8070') : d < 4 ? hex('#4e4640') : hex('#3a3430');
    }
  }
  return b;
}

// ------------------------------------------------------------------ cliffs and the sea cave

/** a headland cliff face with bush on top; `cave` cuts a dark arch (x range) at the base */
export function paintCliff(w: number, h: number, seed: number, o: { left?: number; right?: number; cave?: [number, number]; arch?: number } = {}): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const topAt = (x: number) => {
    let t = h * 0.12 + (fbm1(x / 90, 4, seed) - 0.5) * h * 0.22;
    if (o.left !== undefined) t = Math.max(t, h * (1 - smoothstep(o.left - 60, o.left + 40, x)) * 1.2);
    if (o.right !== undefined) t = Math.max(t, h * smoothstep(o.right - 40, o.right + 60, x) * 1.2);
    return t;
  };
  for (let x = 0; x < w; x++) {
    const top = topAt(x);
    for (let y = Math.max(0, Math.round(top)); y < h; y++) {
      const d = y - top;
      // columnar basalt: vertical joints, horizontal lava layers, lit from the upper left
      const col = Math.abs(Math.sin(x * 0.19 + fbm2(x / 40, y / 60, 2, seed + 1) * 4));
      const layer = Math.sin(y * 0.09 + fbm2(x / 90, y / 30, 2, seed + 2) * 3);
      const n = fbm2(x / 16, y / 10, 3, seed + 3);
      let v = 0.5 + (n - 0.5) * 0.45 + (layer > 0.7 ? 0.1 : 0) - (col < 0.12 ? 0.22 : 0) - smoothstep(h * 0.4, h, y) * 0.2;
      v += (bayer(x, y) - 0.5) * 0.12;
      const ramp = [hex('#2a2626'), hex('#3a3432'), hex('#4c4440'), hex('#5e5650'), hex('#766c62')];
      let c = ramp[clamp(Math.floor(v * 5), 0, 4)];
      // wet dark band at the base, bird streaks, lichen
      if (y > h - 14 - noise1(x / 20, seed) * 6) c = shade(c, -0.22);
      if (hash2(x, Math.floor(y / 3), seed + 4) < 0.004) for (let k = 0; k < 6; k++) if (y + k < h) b.data[(y + k) * w + x] = hex('#d8d4c8');
      if (noise2(x / 5, y / 4, seed + 5) > 0.8 && d > 6) c = mix(c, hex('#a8a060'), 0.25);
      if (col < 0.3) c = shade(c, col < 0.12 ? -0.1 : 0.06);
      // vegetation on the top: flax, bush, pōhutukawa crowns
      if (d < 10 + noise1(x / 14, seed + 6) * 12) {
        const g = noise2(x / 7, y / 5, seed + 7);
        c = g > 0.66 ? hex('#6a8a3e') : g > 0.4 ? hex('#4a6a30') : hex('#34502a');
        if (hash2(x, y, seed + 8) < 0.02) c = hex('#c8342a');
      }
      b.data[y * w + x] = c;
    }
  }
  if (o.cave) {
    const [c0, c1] = o.cave;
    const ah = o.arch ?? h * 0.62;
    for (let x = Math.max(0, c0); x < Math.min(w, c1); x++) {
      const u = (x - c0) / (c1 - c0);
      const hh = Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)) * ah + (noise1(x / 6, seed + 9) - 0.5) * 6;
      for (let y = Math.round(h - hh); y < h; y++) {
        const d = (y - (h - hh)) / hh;
        // the cave's back wall: wet dark rock with pale drip streaks, darkest up in the roof
        const n = fbm2(x / 14, y / 10, 3, seed + 12);
        const drip = Math.abs(Math.sin(x * 0.21 + fbm2(x / 24, y / 60, 2, seed + 13) * 3));
        let c = mix(hex('#2a2626'), hex('#3a3432'), clamp(n * 1.3 - 0.2));
        if (drip < 0.06) c = mix(c, hex('#6a706c'), 0.35);
        if (noise2(x / 8, y / 8, seed + 14) > 0.78) c = mix(c, hex('#3a4c48'), 0.5);
        c = shade(c, -clamp(1 - d * 1.6) * 0.25);
        b.data[y * w + x] = d < 0.03 ? hex('#141212') : c;
      }
    }
  }
  return b;
}

/** the inside of the sea cave: wet black rock with pale mineral streaks */
export function paintCaveBack(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm2(x / 20, y / 14, 4, seed);
    const drip = Math.abs(Math.sin(x * 0.13 + fbm2(x / 30, y / 80, 2, seed + 1) * 3));
    let c = mix(hex('#1c1a1c'), hex('#2e2a2a'), clamp(n * 1.3 - 0.2));
    if (drip < 0.05) c = mix(c, hex('#5a605e'), 0.4);
    if (noise2(x / 9, y / 9, seed + 2) > 0.76) c = mix(c, hex('#3a4a4a'), 0.5);
    c = shade(c, -smoothstep(h * 0.6, h, y) * 0.3);
    b.data[y * w + x] = c;
  }
  return b;
}

/**
 * The rock arch framing the camera inside the cave: a heavy ceiling with stalactites, dripping ferns
 * and roots at the two mouths, and a low rock lip along the bottom. `holes` are skylights (x, r).
 */
export function paintCaveArch(w: number, h: number, seed: number, holes: [number, number][]): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const ceil = (x: number) => {
    const u = x / w;
    const mouth = Math.min(smoothstep(0, 0.14, u), 1 - smoothstep(0.86, 1, u));
    return (h * 0.2 + fbm1(x / 30, 3, seed) * h * 0.12) * mouth + (1 - mouth) * -20;
  };
  const lip = (x: number) => {
    const u = x / w;
    const mouth = Math.min(smoothstep(0.04, 0.18, u), 1 - smoothstep(0.82, 0.96, u));
    return h - (h * 0.06 + fbm1(x / 26, 3, seed + 3) * h * 0.08) * mouth;
  };
  for (let x = 0; x < w; x++) {
    const ct = ceil(x);
    // stalactites
    const st = Math.max(0, noise1(x / 3.2, seed + 5) - 0.62) * 70 * (noise1(x / 40, seed + 6) > 0.4 ? 1 : 0.4);
    const bottom = ct + st;
    for (let y = 0; y < Math.min(h, bottom); y++) {
      if (ct < 0) break;
      const d = bottom - y;
      const n = fbm2(x / 10, y / 8, 3, seed + 7);
      let c = mix(hex('#141214'), hex('#2a2626'), clamp(n * 1.4 - 0.3));
      if (d < 2) c = hex('#3a3634');
      if (d < 1) c = hex('#5a5652');
      b.data[y * w + x] = c;
    }
    const lt = lip(x);
    for (let y = Math.max(0, Math.round(lt)); y < h; y++) {
      const d = y - lt;
      let c = mix(hex('#221e1e'), hex('#141212'), clamp(d / 30));
      if (d < 1.5) c = hex('#4a4644');
      b.data[y * w + x] = c;
    }
  }
  // skylights: ragged holes in the ceiling with fern fringes
  for (const [hx, hr] of holes) {
    for (let y = 0; y < h * 0.4; y++) for (let x = Math.floor(hx - hr * 1.6); x <= hx + hr * 1.6; x++) {
      if (x < 0 || x >= w) continue;
      const nx = (x - hx) / (hr * (1 + (noise1(y / 5, seed + x) - 0.5) * 0.4)), ny = y / (h * 0.4);
      const q = nx * nx + ny * ny * 0.15;
      if (q < 1 && y < ceil(x) + 4) b.data[y * w + x] = 0;
      else if (q < 1.4 && y < ceil(x) + 6 && b.data[y * w + x] >>> 24) b.data[y * w + x] = noise2(x / 3, y / 3, seed) > 0.5 ? hex('#4a7a34') : hex('#2e4e24');
    }
  }
  // hanging roots and ferns at the mouths
  const rng = new Rng(seed + 11);
  for (const [a, z] of [[0.08, 0.2], [0.8, 0.93]] as const) {
    for (let i = 0; i < 16; i++) {
      const x0 = Math.round(w * rng.range(a, z));
      const len = rng.range(10, 46);
      const y0 = Math.max(0, Math.round(ceil(x0)));
      for (let k = 0; k < len; k++) {
        const x = Math.round(x0 + Math.sin(k * 0.2 + i) * 1.5), y = y0 + k;
        if (x < 0 || x >= w || y >= h) continue;
        b.data[y * w + x] = rng.chance(0.4) ? hex('#4a6a2e') : hex('#3a2a1e');
        if (k % 6 === 3 && x + 1 < w) b.data[y * w + x + 1] = hex('#5a8a3a');
      }
    }
  }
  return b;
}

// ------------------------------------------------------------------ light and shadow cookies

/** dappled canopy shadow: clusters of leaf blobs with sun holes (alpha only) */
export function paintLeafShadow(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm2(x / 22, y / 11, 4, seed) + (noise2(x / 5, y / 3, seed + 1) - 0.5) * 0.2;
    if (n < 0.46) continue;
    const a = n > 0.56 ? 200 : 120;
    b.data[y * w + x] = withAlpha(hex('#000000'), a);
  }
  return b;
}

// ------------------------------------------------------------------ vegetation

/** an overhanging pōhutukawa branch (hangs from its top-left anchor) with crimson flowers */
export function paintPohutukawa(seed: number, w = 260, h = 120): Sprite {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  const leaf = [hex('#1e3a22'), hex('#2a4c2a'), hex('#3a6232'), hex('#4e7a3a')];
  // a gnarled limb reaching in from the left
  const limb: [number, number][] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; limb.push([t * w * 0.9, 6 + Math.sin(t * 3 + seed) * 8 + t * t * h * 0.35]); }
  for (let i = 0; i < limb.length; i++) {
    const [lx, ly] = limb[i];
    const r = 5 * (1 - i / limb.length) + 1.5;
    for (let y = -r; y <= r; y++) for (let x = -2; x <= 2; x++) {
      const X = Math.round(lx + x), Y = Math.round(ly + y);
      if (X >= 0 && Y >= 0 && X < w && Y < h) b.data[Y * w + X] = y < -r * 0.3 ? hex('#6a5444') : hex('#3e2e24');
    }
  }
  // leaf clusters along the limb and hanging twigs, lit from above
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const [lx, ly] = limb[rng.int(4, 40)];
    blobs.push([lx + rng.range(-14, 14), ly + rng.range(-6, 26), rng.range(10, 22)]);
  }
  for (const [cx, cy, r] of blobs) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const nx = (x - cx) / (r * 1.3), ny = (y - cy) / r;
      const q = nx * nx + ny * ny + (noise2(x / 3, y / 3, seed) - 0.5) * 0.7;
      if (q > 1) continue;
      const l = clamp(0.55 - ny * 0.45 - nx * 0.15 + (bayer(x, y) - 0.5) * 0.3);
      b.data[y * w + x] = leaf[clamp(Math.floor(l * 4), 0, 3)];
    }
  }
  // crimson pom-pom flowers on the upper surface
  for (let i = 0; i < 40; i++) {
    const [cx, cy, r] = blobs[rng.int(0, blobs.length - 1)];
    const x = Math.round(cx + rng.range(-r, r)), y = Math.round(cy - r * rng.range(0.2, 0.9));
    for (const [dx, dy, c] of [[0, 0, '#e8323a'], [1, 0, '#c8202e'], [0, -1, '#ff5a52'], [-1, 0, '#b8182a'], [0, 1, '#9a1424'], [1, -1, '#ffd24a']] as const) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && b.data[Y * w + X] >>> 24) b.data[Y * w + X] = hex(c);
    }
  }
  return { buf: b, ax: 0, ay: 0 };
}

/** marram / spinifex dune grass tuft with sand at its base (anchored bottom-centre) */
export function paintDuneGrass(seed: number, w = 60, h = 44): Sprite {
  // drawn on a canvas with margins (leaning blades reach past w) and trimmed, so no blade is cut off
  const M = Math.ceil(h * 0.5);
  const W = w + M * 2;
  const b = new PixelBuffer(W, h);
  const rng = new Rng(seed);
  for (let i = 0; i < 26; i++) {
    const x0 = M + w / 2 + rng.range(-w * 0.3, w * 0.3), lean = rng.range(-0.8, 0.8), len = rng.range(h * 0.45, h * 0.98);
    const c = rng.pick([hex('#9aa25a'), hex('#b8b86a'), hex('#7e8a46'), hex('#d0c880')]);
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = Math.round(x0 + lean * t * t * len * 0.6), y = h - 1 - k;
      if (x >= 0 && x < W && y >= 0) b.data[y * W + x] = t > 0.8 ? shade(c, 0.12) : c;
    }
  }
  // the little sand mound the tuft grows out of, tapering to nothing at both ends
  for (let x = 0; x < w; x++) {
    const hh = Math.max(0, Math.sin((x / w) * Math.PI) * 5 - 1);
    for (let y = h - Math.round(hh); y < h; y++) b.data[y * W + x + M] = y === h - Math.round(hh) ? hex('#f0d8a2') : hex('#e0c088');
  }
  const t = b.trim(0);
  return { buf: t.buf, ax: M + w / 2 - t.ox, ay: h - 1 - t.oy };
}

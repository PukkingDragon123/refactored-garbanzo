// Distant scenery painters: sky, clouds, celestial bodies, mountain ridges, tree lines, mist.

import { PixelBuffer } from './pixel';
import { C, hex, mix, shade, withAlpha, rgba } from './color';
import { Rng, bayer, clamp, fbm1, fbm2, noise1, smoothstep } from '../core/math';

export interface Stop { t: number; c: C }

export function gradientAt(stops: Stop[], t: number): C {
  if (t <= stops[0].t) return stops[0].c;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t) {
      const a = stops[i - 1], b = stops[i];
      return mix(a.c, b.c, (t - a.t) / (b.t - a.t));
    }
  }
  return stops[stops.length - 1].c;
}

/**
 * Banded, ordered-dithered vertical sky gradient. glow adds a warm radial bloom around (gx, gy).
 */
export function paintSky(w: number, h: number, stops: Stop[], bands = 28, glow?: { x: number; y: number; r: number; c: C; k: number }) {
  const buf = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let t = y / (h - 1);
      const q = Math.floor(t * bands + bayer(x, y) - 0.5 + 0.5) / bands;
      let c = gradientAt(stops, clamp(q));
      if (glow) {
        const d = Math.hypot((x - glow.x) / 1.6, y - glow.y) / glow.r;
        let g = Math.max(0, 1 - d);
        g = g * g * glow.k;
        const gq = Math.floor(g * 10 + bayer(x + 1, y + 2) - 0.5) / 10;
        if (gq > 0) c = mix(c, glow.c, clamp(gq));
      }
      buf.data[y * w + x] = c;
      t = 0;
    }
  }
  return buf;
}

/** Cumulus cloud: union of lumps, flat-ish base, lit from `lx` side. */
export function paintCloud(seed: number, w: number, h: number, ramp: C[], lx = -1, flat = 0.75) {
  const rng = new Rng(seed);
  const buf = new PixelBuffer(w, h);
  const lumps: { x: number; y: number; r: number }[] = [];
  const baseY = h * flat;
  const n = Math.floor(w / 14) + 3;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const edge = Math.pow(Math.sin(t * Math.PI), 0.8);
    const r = (h * 0.14 + rng.range(0, h * 0.16)) * (0.45 + edge * 0.8);
    lumps.push({ x: w * 0.1 + t * w * 0.8 + rng.range(-3, 3), y: baseY - r * rng.range(0.2, 0.5), r });
  }
  // a couple of towering heads
  for (let i = 0; i < 2; i++) {
    const r = h * rng.range(0.24, 0.3);
    lumps.push({ x: w * rng.range(0.32, 0.68), y: Math.max(r + 1, baseY - r * 1.1), r });
  }
  const inside = (x: number, y: number) => {
    if (y > baseY + (noise1(x * 0.2, seed) - 0.5) * 2) return -1;
    let best = -1;
    for (const l of lumps) {
      const d = Math.hypot(x - l.x, y - l.y) / l.r;
      if (d < 1) best = Math.max(best, 1 - d);
    }
    return best;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = inside(x + 0.5, y + 0.5);
      if (v < 0) continue;
      // lighting: sample towards the light, more material above = darker
      const up = inside(x + 0.5 - lx * 3, y + 0.5 - 3);
      const below = (y - (baseY - h * 0.5)) / (h * 0.5);
      let l = 0.62 - clamp(below) * 0.5 + (up < 0 ? 0.35 : 0) + v * 0.15;
      l += (bayer(x, y) - 0.5) * 0.22;
      const i = clamp(Math.round(l * (ramp.length - 1)), 0, ramp.length - 1);
      buf.data[y * w + x] = ramp[i];
    }
  return buf;
}

/** Long thin wispy cloud streak (stratus / cirrus) */
export function paintStreak(seed: number, w: number, h: number, c: C, c2: C) {
  const buf = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cx = x / w, cy = (y + 0.5) / h;
      const shape = Math.sin(cx * Math.PI) * (1 - Math.abs(cy - 0.5) * 2);
      const n = fbm2(x * 0.05, y * 0.35, 3, seed);
      const v = shape * 1.3 - (1 - n) * 0.9;
      if (v + (bayer(x, y) - 0.5) * 0.25 > 0.12) buf.data[y * w + x] = v > 0.45 ? c2 : c;
    }
  return buf;
}

export function paintSun(r: number, core: C, rim: C) {
  const s = Math.ceil(r * 2 + 2);
  const buf = new PixelBuffer(s, s);
  buf.discFn(s / 2, s / 2, r, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    return d > 0.82 + (bayer(x, y) - 0.5) * 0.2 ? rim : core;
  });
  return buf;
}

export function paintMoon(r: number, light: C, mid: C, dark: C, phase = 0) {
  const s = Math.ceil(r * 2 + 2);
  const buf = new PixelBuffer(s, s);
  const rng = new Rng(77);
  const craters = Array.from({ length: 7 }, () => ({ x: rng.range(-0.6, 0.6), y: rng.range(-0.6, 0.6), r: rng.range(0.1, 0.28) }));
  buf.discFn(s / 2, s / 2, r, (x, y, nx, ny) => {
    // terminator for crescent phases
    if (phase > 0 && Math.hypot(nx + phase * 1.2, ny) < 1) return -1;
    let c = light;
    for (const cr of craters) {
      const d = Math.hypot(nx - cr.x, ny - cr.y) / cr.r;
      if (d < 1) c = d > 0.7 && nx - cr.x < 0 ? dark : mid;
    }
    if (Math.hypot(nx, ny) > 0.86 && nx > 0.1) c = mid;
    return c;
  });
  return buf;
}

export interface RidgeOpts {
  seed: number;
  base: number;
  amp: number;
  freq: number;
  body: C;
  lit: C;
  shadow: C;
  snow?: C;
  snowLine?: number;
  fogTo?: C;
  fogStart?: number;
  sharp?: number;
  gullies?: number;
  /** optional absolute peak overrides [x, height] to shape landmark mountains (e.g. volcano) */
  peaks?: { x: number; h: number; w: number; cone?: boolean }[];
  lightDir?: number;
}

/** Mountain range silhouette with lit/shadow faces, gullies, snow and base fog. */
export function paintRidge(w: number, h: number, o: RidgeOpts) {
  const buf = new PixelBuffer(w, h);
  const sharp = o.sharp ?? 0.6;
  const ridgeAt = (x: number) => {
    const n = fbm1(x * o.freq, 5, o.seed);
    const ridged = 1 - Math.abs(n * 2 - 1);
    let v = n * (1 - sharp) + ridged * sharp;
    let y = o.base - v * o.amp;
    for (const p of o.peaks ?? []) {
      const d = Math.abs(x - p.x) / p.w;
      if (d < 1) {
        const prof = p.cone ? 1 - d : Math.cos(d * Math.PI * 0.5);
        const py = o.base - p.h * prof - (p.cone ? (noise1(x * 0.3, o.seed + 9) - 0.5) * 3 : 0);
        // volcano crater notch
        if (p.cone && d < 0.06) y = Math.min(y, py + 3);
        else y = Math.min(y, py);
      }
    }
    return y;
  };
  const M = 8;
  const ys = new Float32Array(w + M * 2 + 64);
  for (let x = -M; x < w + M + 64; x++) ys[x + M] = ridgeAt(x);
  const Y = (x: number) => ys[Math.max(0, Math.min(ys.length - 1, Math.round(x) + M))];
  const ld = o.lightDir ?? -1;
  for (let x = 0; x < w; x++) {
    const top = Math.round(Y(x));
    for (let y = Math.max(0, top); y < h; y++) {
      const depth = y - top;
      // faces slant down-and-away from peaks: sample the ridge slope further along as we descend
      const sx = x - ld * depth * 0.55;
      const slope = (Y(sx + 5) - Y(sx - 5)) / 10;
      const g = (fbm2(x * 0.045 + depth * 0.02, y * 0.03, 3, o.seed + 3) - 0.5) * (o.gullies ?? 1.2);
      let lit = -slope * ld * 1.6 + g * 0.8;
      lit *= Math.max(0.15, 1 - depth / 70);
      lit += (bayer(x, y) - 0.5) * 0.28;
      let c = lit > 0.22 ? o.lit : lit < -0.22 ? o.shadow : o.body;
      if (o.snow && o.snowLine !== undefined) {
        const sl = o.snowLine + (noise1(x * 0.08, o.seed + 5) - 0.5) * 12 + g * 8;
        if (y < sl + (bayer(x, y) - 0.5) * 4) c = lit > -0.15 ? o.snow : mix(o.snow, o.shadow, 0.45);
      }
      if (o.fogTo && o.fogStart !== undefined) {
        const f = smoothstep(o.fogStart, h, y);
        if (f > 0 && f + (bayer(x + 2, y) - 0.5) * 0.35 > 0.5) c = mix(c, o.fogTo, 0.35 + f * 0.65);
      }
      buf.data[y * w + x] = c;
    }
  }
  return buf;
}

export interface TreelineOpts {
  seed: number;
  base: number;
  amp: number;
  ramp: C[]; // 3-4 colours dark->light
  rMin: number;
  rMax: number;
  fern?: number;
  emergent?: number;
  palms?: number;
  fillTo?: number;
  lightDir?: number;
}

/** Distant forest canopy silhouette with emergent trees, tree-fern crowns and palm tufts. */
export function paintTreeline(w: number, h: number, o: TreelineOpts) {
  const rng = new Rng(o.seed);
  const buf = new PixelBuffer(w, h);
  const R = o.ramp;
  const baseAt = (x: number) => o.base - fbm1(x * 0.012, 3, o.seed) * o.amp;
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let x = -o.rMax; x < w + o.rMax; ) {
    const r = rng.range(o.rMin, o.rMax);
    blobs.push({ x, y: baseAt(x) - r * rng.range(0.1, 0.5), r });
    x += r * rng.range(0.7, 1.3);
  }
  // emergent tall trees behind
  const em: { x: number; y: number; r: number }[] = [];
  for (let x = 0; x < w; x += rng.range(40, 120)) {
    if (!rng.chance(o.emergent ?? 0.4)) continue;
    const r = rng.range(o.rMax * 0.8, o.rMax * 1.4);
    em.push({ x, y: baseAt(x) - r - rng.range(o.rMax * 0.8, o.rMax * 2), r });
  }
  const ld = o.lightDir ?? -1;
  const shadeBlob = (b: { x: number; y: number; r: number }, dark: number) => {
    buf.discFn(b.x, b.y, b.r, (x, y, nx, ny) => {
      // bumpy edge
      const edge = Math.hypot(nx, ny) + (fbm2(x * 0.25, y * 0.25, 2, o.seed) - 0.5) * 0.35;
      if (edge > 1) return -1;
      let l = -ny * 0.8 + nx * ld * -0.4 + (bayer(x, y) - 0.5) * 0.5 - dark;
      const i = l > 0.45 ? 3 : l > 0.05 ? 2 : l > -0.4 ? 1 : 0;
      return R[Math.min(i, R.length - 1)];
    });
  };
  for (const e of em) {
    // trunk
    const tx = Math.round(e.x);
    for (let y = Math.round(e.y); y < h; y++) {
      buf.set(tx, y, R[0]);
      if (e.r > 7) buf.set(tx + 1, y, R[0]);
    }
    const n = rng.int(3, 5);
    for (let k = 0; k < n; k++) shadeBlob({ x: e.x + rng.range(-e.r, e.r) * 0.7, y: e.y + rng.range(-e.r, e.r) * 0.3, r: e.r * rng.range(0.45, 0.7) }, 0.2);
  }
  for (const b of blobs) shadeBlob(b, 0);
  // fill below
  const fillTo = o.fillTo ?? h;
  for (let x = 0; x < w; x++) {
    let top = h;
    for (let y = 0; y < h; y++) if (buf.opaque(x, y)) { top = y; break; }
    for (let y = Math.max(top, Math.round(baseAt(x))); y < fillTo; y++) if (!buf.opaque(x, y)) buf.data[y * w + x] = R[0];
  }
  // tree-fern crowns poking out
  for (let x = rng.range(5, 30); x < w; x += rng.range(18, 60)) {
    if (!rng.chance(o.fern ?? 0.5)) continue;
    const by = baseAt(x) - rng.range(o.rMax * 0.6, o.rMax * 1.6);
    const tx = Math.round(x);
    for (let y = Math.round(by); y < baseAt(x); y++) buf.set(tx, y, R[0]);
    const fronds = rng.int(6, 9);
    const len = rng.range(o.rMax * 0.6, o.rMax * 1.0);
    for (let f = 0; f < fronds; f++) {
      const a = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * 3.0 + rng.range(-0.15, 0.15);
      for (let s = 0; s < len; s += 0.5) {
        const t = s / len;
        const px = x + Math.cos(a) * s;
        const py = by + Math.sin(a) * s + t * t * len * 0.55;
        buf.set(px, py, t < 0.5 ? R[1] : R[Math.min(2, R.length - 1)]);
      }
    }
  }
  // palm tufts
  for (let x = rng.range(10, 50); x < w; x += rng.range(40, 140)) {
    if (!rng.chance(o.palms ?? 0)) continue;
    const by = baseAt(x) - rng.range(o.rMax * 1.2, o.rMax * 2.2);
    for (let y = Math.round(by); y < baseAt(x); y++) buf.set(Math.round(x + (y - by) * 0.05), y, R[0]);
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI / 2 + (f / 6 - 0.5) * 3.4;
      const len = o.rMax * 0.9;
      for (let s = 0; s < len; s += 0.5) {
        const t = s / len;
        buf.set(x + Math.cos(a) * s, by + Math.sin(a) * s + t * t * len * 0.7, R[1]);
      }
    }
  }
  return buf;
}

/** Soft horizontal mist band (alpha dithered) used between layers. */
export function paintMist(w: number, h: number, c: C, seed: number, density = 0.6) {
  const buf = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const vy = Math.sin((y / h) * Math.PI);
      const n = fbm2(x * 0.015, y * 0.08, 4, seed);
      const v = vy * (n * 1.4 - 0.2) * density;
      if (v <= 0.02) continue;
      const a = Math.round(clamp(v) * 4) / 4;
      buf.data[y * w + x] = withAlpha(c, a * 200);
    }
  return buf;
}

/** Aurora curtain for the Antarctic intro. */
export function paintAurora(w: number, h: number, seed: number) {
  const buf = new PixelBuffer(w, h);
  const g = hex('#5dffb0'), t = hex('#3fd1c1'), v = hex('#9b6ee8');
  for (let x = 0; x < w; x++) {
    const baseY = h * 0.55 + Math.sin(x * 0.02 + seed) * h * 0.18 + (fbm1(x * 0.03, 3, seed) - 0.5) * h * 0.2;
    const inten = fbm1(x * 0.05, 3, seed + 3);
    for (let y = 0; y < h; y++) {
      const d = (baseY - y) / (h * 0.5);
      if (d < -0.08) continue;
      let a = d < 0 ? 1 + d / 0.08 : Math.exp(-d * 2.2);
      a *= inten * 1.4 * (0.6 + 0.4 * Math.sin(x * 0.4 + seed));
      if (a + (bayer(x, y) - 0.5) * 0.3 < 0.18) continue;
      const col = d < 0.15 ? g : d < 0.5 ? t : v;
      buf.data[y * w + x] = withAlpha(col, Math.round(clamp(a) * 3) * 60 + 40);
    }
  }
  return buf;
}

export function starField(w: number, h: number, seed: number, n: number) {
  const rng = new Rng(seed);
  return Array.from({ length: n }, () => ({
    x: rng.range(0, w), y: rng.range(0, h) * rng.range(0.3, 1), b: rng.range(0.3, 1), tw: rng.range(0.5, 3), big: rng.chance(0.08),
    c: rng.pick([rgba(255, 255, 255), rgba(200, 220, 255), rgba(255, 230, 200)]),
  }));
}

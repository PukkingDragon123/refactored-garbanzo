// V9 island art: the western headland behind the west rocks. A rugged basalt point that climbs out of
// the top of the frame at the west end of the world and steps down to the sea in broken ledges, ending
// in a detached stack. The face is shaded from a height field (columnar joints, lava flow bands, blocky
// facets, a few long cracks) lit from the upper left, with lichen, guano streaks under the ledges, a
// black wet zone and a barnacle band at the base where the surf washes it. The crest is bush, flax and
// flowering pōhutukawa, so the skyline is a ragged living silhouette, never a cut edge.

import { PixelBuffer } from '../pixel';
import { hex, mix, shade, C } from '../color';
import { Rng, bayer, clamp, fbm1, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';

const RAMP = ['#17161a', '#221f24', '#2d2a2e', '#3a3638', '#48423f', '#58514b', '#6c6358', '#827766', '#998c76'].map(h => hex(h));
const BUSH = ['#0f1c14', '#16281a', '#1e3620', '#284628', '#34582e', '#436c34', '#56823c', '#6e9846'].map(h => hex(h));
const POHU = ['#0e1a14', '#15261a', '#1d3421', '#274427', '#32552d'].map(h => hex(h));
const RED = ['#7a0e1a', '#a8182a', '#d02a34', '#f04a44', '#ff7a5e'].map(h => hex(h));
const FLAX = ['#1a2410', '#26341a', '#344520', '#445828', '#566a2e', '#6e7e38'].map(h => hex(h));

export interface Headland { buf: PixelBuffer; /** crest height above the base at buffer x (for placing things on it) */ top: (x: number) => number }

/**
 * Paint a w x h headland; the base (bottom row) sits at the waterline. `tail` is where the rock mass
 * ends (fraction of w); a sea stack and low rocks stand beyond it.
 */
export function paintHeadland(w: number, h: number, seed = 7, tail = 0.8): Headland {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed * 31 + 3);
  // ---- the crest line: a high plateau stepping down in broken ledges, then a spur into the sea
  const steps = [0, 0.18, 0.34, 0.5, 0.63, tail];
  const lv = [0.86, 0.8, 0.62, 0.46, 0.3, 0.06];
  const profile = (u: number) => {
    let v = 0;
    for (let i = 0; i < steps.length - 1; i++) {
      if (u < steps[i] || u >= steps[i + 1]) continue;
      const k = (u - steps[i]) / (steps[i + 1] - steps[i]);
      // each step: a flattish ledge, then a steep drop near its end
      v = lv[i] + (lv[i + 1] - lv[i]) * smoothstep(0.55, 0.95, k + (noise1(u * 40 + i, seed) - 0.5) * 0.2);
    }
    if (u >= tail) v = Math.max(0, lv[lv.length - 1] * (1 - (u - tail) / 0.04));
    return v;
  };
  const crest = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const u = x / w;
    let t = profile(u) * h * 0.94;
    t += (fbm1(x / 34, 3, seed + 1) - 0.5) * 16 * (t > 8 ? 1 : 0) + (noise1(x / 6, seed + 2) - 0.5) * 3;
    crest[x] = Math.max(0, t);
  }
  // the detached stack and a few awash rocks beyond the tail
  const stackX = w * (tail + (1 - tail) * 0.5), stackW = w * 0.035, stackH = h * 0.3;
  for (let x = 0; x < w; x++) {
    const d = Math.abs(x - stackX) / stackW;
    if (d < 1) crest[x] = Math.max(crest[x], stackH * Math.pow(1 - d * d, 0.35) * (0.9 + noise1(x / 3, seed + 3) * 0.2));
    const r1 = Math.abs(x - (stackX + stackW * 2.4)) / (stackW * 1.2);
    if (r1 < 1) crest[x] = Math.max(crest[x], h * 0.06 * Math.sqrt(1 - r1 * r1));
    const r2 = Math.abs(x - (w * tail + stackW * 0.8)) / (stackW * 1.6);
    if (r2 < 1) crest[x] = Math.max(crest[x], h * 0.08 * Math.sqrt(1 - r2 * r2) + noise1(x / 4, 9) * 2);
  }
  const topY = (x: number) => h - crest[clamp(Math.round(x), 0, w - 1)];

  // ---- rock face: fractured basalt facets on big buttress ribs, lit from the upper left
  const cell = (x: number, y: number, sx: number, sy: number, sd: number) => {
    const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
    let d1 = 9, d2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.15 + hash2(cx, cy, sd) * 0.7) * sx, py = (cy + 0.15 + hash2(cx, cy, sd + 1) * 0.7) * sy;
      const dd = Math.hypot((x - px) / sx, (y - py) / sy);
      if (dd < d1) { d2 = d1; d1 = dd; id = cx * 7919 + cy * 104729; } else if (dd < d2) d2 = dd;
    }
    return { id, edge: d2 - d1 };
  };
  const rib = (x: number) => fbm1(x / 46, 3, seed + 4) * 1.4 + fbm1(x / 17, 2, seed + 5) * 0.35;
  for (let x = 0; x < w; x++) {
    const t = topY(x);
    const slope = (rib(x + 2) - rib(x - 2)) * 4; // >0: the rib face turns toward the light
    for (let y = Math.max(0, Math.floor(t)); y < h; y++) {
      const d = y - t;
      // columnar facets (tall cells) broken by smaller blocks near the crest
      // tall columns (the joints wander a little), broken into smaller blocks near the crest
      const big = cell(x + (noise1(y / 34, seed + 6) - 0.5) * 10, y, 11, 44, seed + 7);
      const small = cell(x, y, 8, 9, seed + 8);
      const f = d < 22 + noise1(x / 20, seed + 9) * 22 ? small : big;
      const fn = hash2(f.id, 3, seed + 10), fn2 = hash2(f.id, 4, seed + 11);
      let l = 0.46 + (fn - 0.45) * 0.34 + slope * 0.9 + (fn2 - 0.5) * 0.1 + (noise2(x / 5, y / 9, seed + 17) - 0.5) * 0.12;
      // fracture lines: only some joints open into dark cracks, the rest are a change of tone
      const open = hash2(f.id, 6, seed) < 0.55 || f === small;
      if (f.edge < 0.045 && open) l = 0.1;
      else if (f.edge < 0.1) l += hash2(f.id, 5, seed) < 0.5 ? 0.08 : -0.1;
      // overhang shadow under the crest scrub, the lower face darker and wetter
      if (d > 1 && d < 9) l -= 0.18 * (1 - d / 9);
      if (d <= 1) l += 0.2;
      l -= smoothstep(h * 0.5, h, y) * 0.24;
      const i = clamp(Math.round(l * (RAMP.length - 1) + (bayer(x, y) - 0.5) * 0.7), 0, RAMP.length - 1);
      let c = RAMP[i];
      // lichen: rusty-gold patches up high, grey-green crusts lower down
      const li = noise2(x / 9, y / 6, seed + 12);
      if (li > 0.78 && y < h * 0.6 && i > 3 && f.edge > 0.14) c = mix(c, hex('#b08a3e'), 0.4);
      else if (li < 0.14 && y < h * 0.85 && i > 2) c = mix(c, hex('#7a8a6c'), 0.28);
      // the splash zone: black wet rock, a barnacle band, green weed right at the water
      const base = h - y;
      if (base < 26 + noise1(x / 20, seed + 13) * 12) c = mix(c, hex('#0e1013'), 0.5);
      if (base < 14 + noise1(x / 11, seed + 14) * 5 && hash2(x, y, seed + 15) < 0.14) c = hex('#cfc9b8');
      if (base < 7 + noise1(x / 9, seed + 16) * 4) c = mix(c, noise2(x / 3, y / 2, seed) > 0.5 ? hex('#3e5a2a') : hex('#2a4222'), 0.7);
      b.data[y * w + x] = c;
    }
  }
  // long cracks wandering down the face (dark with a lit lower lip)
  for (let k = 0; k < 7; k++) {
    let x = rng.range(w * 0.02, w * 0.7), y = topY(x) + rng.range(6, 30);
    const len = rng.range(30, 110);
    for (let s = 0; s < len && y < h - 12; s++) {
      if (b.data[Math.round(y) * w + Math.round(x)] >>> 24) {
        b.set(x, y, RAMP[0]);
        if (b.opaque(x, y + 1)) b.set(x, y + 1, RAMP[5]);
      }
      x += rng.range(-0.8, 0.9);
      y += 1;
    }
  }
  // guano streaks falling from a few ledges
  for (let k = 0; k < 10; k++) {
    const x = Math.round(rng.range(w * 0.05, w * tail));
    const y0 = topY(x) + rng.range(8, 70), len = rng.range(8, 34);
    for (let s = 0; s < len; s++) if (b.opaque(x, y0 + s)) b.set(x + (s > len * 0.6 && k % 2 ? 1 : 0), y0 + s, mix(b.get(x, y0 + s), hex('#e8e4d6'), 0.75 * (1 - s / len)));
  }

  // ---- the crest: bush, flax and pōhutukawa, a ragged living skyline
  const shadeDisc = (cx: number, cy: number, rx: number, ry: number, ramp: C[], lo: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const q = nx * nx + ny * ny + (noise2(x / 2.2, y / 2.2, seed + 20) - 0.5) * 0.55;
      if (q > 1) continue;
      const lit = clamp(0.55 - nx * 0.35 - ny * 0.55 + (noise2(x / 3, y / 3, seed + 21) - 0.5) * 0.5);
      b.data[y * w + x] = ramp[clamp(lo + Math.round(lit * (ramp.length - 1 - lo) + (bayer(x, y) - 0.5) * 0.8), 0, ramp.length - 1)];
    }
  };
  // low scrub hugging the whole crest
  for (let x = 0; x < w; x += rng.range(3, 7)) {
    if (crest[Math.round(x)] < 10) continue;
    const t = topY(x);
    shadeDisc(x, t + 1, rng.range(4, 9), rng.range(3, 6), BUSH, 0);
  }
  // rounded bushes and pōhutukawa crowns with crimson flowers
  for (let x = 6; x < w * (tail - 0.02); x += rng.range(14, 34)) {
    const t = topY(x);
    if (crest[Math.round(x)] < 20) continue;
    const pohu = rng.chance(0.35);
    const r = pohu ? rng.range(12, 22) : rng.range(6, 12);
    if (pohu) {
      // a gnarled trunk leaning out over the edge
      for (let k = 0; k < r * 0.9; k++) { b.set(x + k * 0.35, t - k, hex('#2e2220')); b.set(x + 1 + k * 0.35, t - k, hex('#46342a')); }
    }
    shadeDisc(x, t - r * 0.55, r * 1.25, r * 0.8, pohu ? POHU : BUSH, pohu ? 0 : 1);
    if (pohu) for (let k = 0; k < r * 3; k++) {
      const fx = x + rng.range(-r * 1.1, r * 1.1), fy = t - r * 0.55 + rng.range(-r * 0.75, r * 0.2);
      if (!b.opaque(fx, fy)) continue;
      const up = fy < t - r * 0.7;
      b.set(fx, fy, RED[up ? rng.int(2, 4) : rng.int(0, 2)]);
      if (up && rng.chance(0.5)) b.set(fx + 1, fy, RED[1]);
    }
  }
  // flax fans poking above the scrub, some with tall flower stalks
  for (let x = 10; x < w * tail; x += rng.range(24, 60)) {
    const t = topY(x);
    if (crest[Math.round(x)] < 14) continue;
    const n = rng.int(5, 9), H = rng.range(10, 22);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 1.8 + rng.range(-0.1, 0.1);
      const len = H * rng.range(0.6, 1);
      for (let s = 0; s < len; s++) {
        const u = s / len;
        const px = x + Math.cos(a) * s + Math.cos(a) * u * u * 3, py = t + 2 + Math.sin(a) * s + u * u * len * 0.35;
        if (px >= 0 && py >= 0 && px < w && py < h) b.set(px, py, FLAX[clamp(2 + (i % 3) + (u > 0.7 ? 1 : 0), 0, FLAX.length - 1)]);
      }
    }
    if (rng.chance(0.5)) {
      const sh = H * rng.range(1.2, 1.8);
      for (let s = 0; s < sh; s++) b.set(x + s * 0.08, t - s, s > sh - 5 ? hex('#8a2a1a') : hex('#3a2a1a'));
    }
  }
  // tufts clinging to ledges down the face
  for (let k = 0; k < 40; k++) {
    const x = rng.range(4, w * tail), t = topY(x);
    const y = t + rng.range(14, h * 0.7);
    if (y > h - 30 || !b.opaque(x, y)) continue;
    // only where the rock steps out (a lit pixel above a dark one)
    shadeDisc(x, y, rng.range(2.5, 5), rng.range(1.6, 3), BUSH, 1);
  }
  // ---- surf washing the base: foam heaped where the swell hits, thin lace between
  for (let x = 0; x < w; x++) {
    if (crest[x] < 2) continue;
    const f = noise1(x / 13, seed + 30), heap = Math.max(0, noise1(x / 40, seed + 31) - 0.5) * 16;
    const y0 = h - 2 - Math.round(f * 2 + heap);
    for (let y = y0; y < h; y++) {
      if (!b.opaque(x, y)) continue;
      const k = (y - y0) / Math.max(1, h - y0);
      if (hash2(x, y, seed + 32) < 0.75 - k * 0.3) b.set(x, y, mix(b.get(x, y), hex('#f2fbfb'), y === y0 ? 0.9 : 0.55 + (1 - k) * 0.2));
    }
    if (heap > 4 && hash2(x, 1, seed) < 0.35) b.set(x, y0 - 1 - Math.round(hash2(x, 2, seed) * 3), mix(b.get(x, y0 - 2), hex('#ffffff'), 0.6));
  }
  // cool haze over the whole mass (it stands a little way off)
  for (let i = 0; i < b.data.length; i++) { const c = b.data[i]; if (c >>> 24) b.data[i] = mix(c, hex('#8aa4b8'), 0.08); }
  void shade;
  return { buf: b, top: x => crest[clamp(Math.round(x), 0, w - 1)] };
}

// Tileable background strips for the V2 jungle: 4 forest depths, a canopy ceiling and a forest-floor
// ground strip. Every strip is seamless when repeated horizontally (periodic noise + wrapped
// drawing). See jungle.ts for the public API docs.

import { PixelBuffer } from './pixel';
import { C } from './color';
import { Rng, clamp, TAU } from '../core/math';
import {
  JP, Ramp, P, rc, haze, subRamp, pfbm1, pfbm2, pnoise1, pnoise2, mod, wrapX, leafMass, crown, frond, blade, tube, vine, leafStamp,
  drawStamp, stampW, sag, bigLeaf, mix, hex, shade,
} from './jungle-core';

export type StripDepth = 0 | 1 | 2 | 3;

/** Strip height (all depths). */
export const STRIP_H = 360;
/**
 * Design lines of each depth, in strip pixels: `top` = highest opaque content (roughly),
 * `ground` = forest-floor line (trunk bases / undergrowth tops), below which the strip is solid.
 */
export const STRIP_LINES: Record<StripDepth, { top: number; ground: number }> = {
  0: { top: 110, ground: 250 },
  1: { top: 95, ground: 215 },
  2: { top: 0, ground: 300 },
  3: { top: 0, ground: 312 },
};

/** Neutral daylight haze colour the far strips are pre-mixed toward (the renderer adds more fog). */
export const STRIP_FOG = hex('#9ec0b9');

// ------------------------------------------------------------------ helpers

/** Set a pixel with horizontal wrap. */
function wset(buf: PixelBuffer, x: number, y: number, c: C) {
  if (y < 0 || y >= buf.h) return;
  buf.data[Math.floor(y) * buf.w + mod(Math.floor(x), buf.w)] = c;
}

/** Periodic ridge/canopy line: y at pixel x for a strip of width W. */
function line(W: number, x: number, base: number, amp: number, cells: number, seed: number, oct = 4, sharp = 0) {
  const n = pfbm1((x / W) * cells, cells, oct, seed);
  const v = sharp > 0 ? n * (1 - sharp) + (1 - Math.abs(n * 2 - 1)) * sharp : n;
  return base - v * amp;
}

/** Vertical trunk for strips (wrapped): cylinder bands, vertical ridges, flare, simple moss. */
function stripTrunk(buf: PixelBuffer, x: number, top: number, bot: number, w: number, rp: Ramp, seed: number, o: { flare?: number; moss?: number; mossRamp?: Ramp; lean?: number; ridges?: boolean } = {}) {
  const n = rp.length - 1;
  const hw0 = w / 2;
  const flare = o.flare ?? 1.2;
  const lean = o.lean ?? 0;
  const mr = o.mossRamp ?? JP.moss;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(buf.h, Math.ceil(bot)); y++) {
    const fromBot = bot - y;
    const hw = hw0 * (1 + Math.exp(-fromBot / (w * 0.5)) * flare) + (pnoise1(y * 0.05, 64, seed) - 0.5) * 1.2;
    const cx = x + lean * (bot - y);
    for (let px = Math.floor(cx - hw); px <= Math.ceil(cx + hw); px++) {
      const nx = (px + 0.5 - cx) / hw;
      if (nx < -1 || nx > 1) continue;
      let k = nx < -0.75 ? 1.5 : nx < -0.35 ? 0.9 : nx < 0.05 ? 0.2 : nx < 0.45 ? -0.6 : nx < 0.8 ? -1.3 : -0.9;
      if (o.ridges !== false) {
        const r = Math.asin(nx) * hw * 0.35 + pnoise1(y * 0.012 + px * 0.01, 32, seed) * 3;
        if (r - Math.floor(r) < 0.18) k -= 0.9;
      }
      let c = rc(rp, n * 0.5 + k);
      if (o.moss) {
        const m = pnoise2((px / buf.w) * 60, y * 0.025, 60, seed + 7) + (nx < 0 ? 0.06 : -0.14) + Math.max(0, 1 - fromBot / 40) * 0.1;
        if (m > 1 - o.moss * 0.45) c = rc(mr, mr.length * 0.42 + k * 0.8 + (m > 1.06 - o.moss * 0.45 ? 0 : 0.8));
      }
      wset(buf, px, y, c);
    }
  }
}

/** Fill every column from its first opaque pixel (or `from`) down to the bottom with a colour function. */
function fillDown(buf: PixelBuffer, from: (x: number) => number, col: (x: number, y: number) => C) {
  for (let x = 0; x < buf.w; x++) {
    const y0 = Math.max(0, Math.floor(from(x)));
    for (let y = y0; y < buf.h; y++) {
      const i = y * buf.w + x;
      if (!(buf.data[i] >>> 24)) buf.data[i] = col(x, y);
    }
  }
}

/** Mist: blend opaque pixels toward `fog` by a banded (6-step) factor f(x, y) in 0..1. */
function mist(buf: PixelBuffer, fog: C, f: (x: number, y: number) => number, y0 = 0, strength = 0.85) {
  const cache = new Map<number, C>();
  for (let y = y0; y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) {
      const i = y * buf.w + x;
      const c = buf.data[i];
      if (!(c >>> 24)) continue;
      const lv = Math.round(clamp(f(x, y)) * 6);
      if (lv <= 0) continue;
      const key = (c & 0xffffff) * 8 + lv;
      let m = cache.get(key);
      if (m === undefined) { m = (mix(c, fog, (lv / 6) * strength) | 0xff000000) >>> 0; cache.set(key, m); }
      buf.data[i] = m;
    }
}

/** Precompute a periodic line into an array (index = x). */
function lineArr(W: number, base: number, amp: number, cells: number, seed: number, oct = 4, sharp = 0): Float32Array {
  const a = new Float32Array(W);
  for (let x = 0; x < W; x++) a[x] = line(W, x, base, amp, cells, seed, oct, sharp);
  return a;
}

// ------------------------------------------------------------------ depth 0: far misty ridges

function depth0(W: number, seed: number): PixelBuffer {
  const buf = new PixelBuffer(W, STRIP_H);
  const ridges = [
    { base: 168, amp: 62, cells: 4, sharp: 0.55, body: '#90b3b3', lit: '#a6c6c2', dark: '#80a2a5', bump: 1.2, mistY: 55 },
    { base: 214, amp: 50, cells: 6, sharp: 0.45, body: '#709a95', lit: '#86ada3', dark: '#618a8a', bump: 2, mistY: 45 },
    { base: 252, amp: 40, cells: 8, sharp: 0.3, body: '#537f77', lit: '#679580', dark: '#466f6c', bump: 3, mistY: 40 },
  ];
  const fog = hex('#b9d1cc');
  const d = buf.data;
  // near -> far: each farther ridge only fills pixels that are still empty (no overdraw)
  for (let ri = ridges.length - 1; ri >= 0; ri--) {
    const R = ridges[ri];
    const s0 = seed * 13 + ri * 101;
    // colour table [tone 0 dark,1 body,2 lit,3 crest][fog level 0,1,2]
    const baseCols = [hex(R.dark), hex(R.body), hex(R.lit), shade(hex(R.lit), 0.06)];
    const tab = baseCols.map(c => [c, (mix(c, fog, 0.3) | 0xff000000) >>> 0, (mix(c, fog, 0.58) | 0xff000000) >>> 0]);
    const smooth = lineArr(W, R.base, R.amp, R.cells, s0, 3, R.sharp);
    const slope = new Float32Array(W), crest = new Int32Array(W), b1 = new Float32Array(W), b2 = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      crest[x] = Math.round(smooth[x] - pfbm1((x / W) * 110, 110, 2, s0 + 5) * R.bump * 1.6 - pfbm1((x / W) * 26, 26, 2, s0 + 6) * R.bump * 1.2);
      slope[x] = (smooth[mod(x + 6, W)] - smooth[mod(x - 6, W)]) / 12;
      b1[x] = smooth[x] + R.mistY - pfbm1((x / W) * 9, 9, 2, s0 + 8) * 26;
      b2[x] = b1[x] + 22 + pfbm1((x / W) * 70, 70, 2, s0 + 3) * 14;
    }
    for (let x = 0; x < W; x++) {
      const top = Math.max(0, crest[x]);
      for (let y = top; y < STRIP_H; y++) {
        const i = y * W + x;
        if (d[i] >>> 24) break; // a nearer ridge already covers everything below
        const depth = y - crest[x];
        // spurs: faces lean away from the crest, sampled on the smoothed line
        const l = depth < 55 ? slope[mod(Math.round(x + depth * 0.45), W)] * 2.4 : 0;
        const tone = depth === 0 ? (l > -0.2 ? 3 : 1) : l > 0.32 ? 2 : l < -0.32 ? 0 : 1;
        const lv = y > b2[x] ? 2 : y > b1[x] ? 1 : 0;
        d[i] = tab[tone][lv];
      }
    }
  }
  return buf;
}

// ------------------------------------------------------------------ depth 1: distant canopy

function emergentKauri(buf: PixelBuffer, rng: Rng, x: number, baseY: number, h: number, rp: Ramp, W: number) {
  const tw = Math.max(2, h * 0.035);
  for (let y = Math.floor(baseY - h); y < baseY + 4; y++) for (let k = -tw; k <= tw; k++) wset(buf, x + k, y, rc(rp, k < 0 ? 3 : 1));
  // a few limbs + a broad flat umbrella crown
  const cy = baseY - h;
  for (const side of [-1, 1]) tube(buf, [[x, cy + 6], [x + side * h * 0.2, cy - 2]], () => tw * 0.6, rp, 2, { wrapW: W });
  crown(buf, rng, { cx: x, cy: cy - 5, rx: h * 0.42, ry: h * 0.14, ramp: rp, n: 5, lo: 1, hi: 3, steps: 2, shape: 'round', len: [3, 4], wid: [3, 3.5], density: 1, jag: 0.3, wrapW: W, flatBottom: 0.7 });
}

function silhouetteFern(buf: PixelBuffer, rng: Rng, x: number, baseY: number, h: number, rp: Ramp, W: number, base = 2) {
  for (let y = Math.floor(baseY - h); y < baseY + 2; y++) wset(buf, x, y, rc(rp, base - 1));
  const n = rng.int(7, 10);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3.2;
    frond(buf, { x, y: baseY - h, ang: a, len: h * 0.45, droop: 0.6 + Math.abs(Math.cos(a)) * 1.2, ramp: rp, base: base + (i % 2), pinna: Math.max(2, h * 0.06), pinnaW: 1.5, gap: 1.6, wrapW: W, bare: 0.05 });
  }
}

function silhouettePalm(buf: PixelBuffer, rng: Rng, x: number, baseY: number, h: number, rp: Ramp, W: number, base = 2) {
  const lean = rng.range(-0.06, 0.06);
  for (let y = 0; y < h; y++) { wset(buf, x + lean * y, baseY - y, rc(rp, base - 1)); if (h > 60) wset(buf, x + lean * y + 1, baseY - y, rc(rp, base - 2)); }
  const tx = x + lean * h, ty = baseY - h;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / 9 - 0.5) * 2.6;
    frond(buf, { x: tx, y: ty, ang: a, len: h * 0.3, droop: 0.4 + Math.abs(Math.cos(a)) * 1.3, ramp: rp, base: base + (i % 2), pinna: Math.max(2, h * 0.07), pinnaW: 1.2, gap: 1.5, sweep: 0.5, hang: 0.3, wrapW: W, bare: 0.04 });
  }
}

function depth1(W: number, seed: number): PixelBuffer {
  const buf = new PixelBuffer(W, STRIP_H);
  const rng = new Rng(seed * 11 + 3);
  const rp = haze(subRamp(JP.canopy, 1, 8, 7), STRIP_FOG, 0.42);
  const rpBack = haze(subRamp(JP.canopy, 1, 8, 7), STRIP_FOG, 0.55);
  const top = lineArr(W, 212, 42, 6, seed * 3 + 1, 4, 0.2);
  const topAt = (x: number) => top[mod(Math.round(x), W)];
  // emergents behind the canopy
  for (let x = rng.range(0, 60); x < W; x += rng.range(80, 170)) {
    const kind = rng.int(0, 2), h = rng.range(55, 105);
    const by = topAt(x) + 10;
    if (kind === 0) emergentKauri(buf, rng, x, by, h, rpBack, W);
    else if (kind === 1) silhouetteFern(buf, rng, x, by, h * 0.5, rpBack, W, 3);
    else silhouettePalm(buf, rng, x, by, h * 0.75, rpBack, W, 3);
  }
  // rows of crowns: the top row sits on the canopy line, lower rows are the shadowed crowns in
  // front, each a little darker; they fade into valley mist toward the bottom
  const rows = [
    { dy: -4, r: [16, 26], lo: 2, hi: 3, step: [14, 24] },
    { dy: 16, r: [14, 24], lo: 1, hi: 3, step: [12, 20] },
    { dy: 40, r: [14, 22], lo: 1, hi: 2, step: [12, 20] },
    { dy: 66, r: [14, 22], lo: 0, hi: 2, step: [14, 22], haze: 0.12 },
    { dy: 92, r: [14, 22], lo: 0, hi: 2, step: [16, 24], haze: 0.25 },
    { dy: 118, r: [16, 24], lo: 0, hi: 2, step: [18, 26], haze: 0.4 },
  ];
  const fogC = hex('#a9c7c0');
  for (const R of rows) {
    const rr = 'haze' in R ? haze(rp, fogC, (R as { haze: number }).haze) : rp;
    for (let x = rng.range(0, 10); x < W; x += rng.range(R.step[0], R.step[1])) {
      const r = rng.range(R.r[0], R.r[1]);
      const cy = topAt(x) + R.dy + r * 0.35;
      leafMass(buf, rng, { cx: x, cy, rx: r, ry: r * 0.72, ramp: rr, base: rng.int(R.lo, R.hi), steps: 3, shape: 'round', len: [4, 6], wid: [3.5, 4.5], density: 0.6, jag: 0.45, wrapW: W, shift: 0.16, shrink: 0.2 });
    }
  }
  const dark = rc(haze(rp, fogC, 0.5), 0);
  fillDown(buf, x => topAt(x) + 110, () => dark);
  const wave = new Float32Array(W);
  for (let x = 0; x < W; x++) wave[x] = pfbm1((x / W) * 7, 7, 2, seed) * 30;
  mist(buf, fogC, (x, y) => (y > top[x] + 150 + wave[x] ? 0.7 : 0), 150, 0.8);
  return buf;
}

// ------------------------------------------------------------------ depth 2: mid forest

function depth2(W: number, seed: number): PixelBuffer {
  const buf = new PixelBuffer(W, STRIP_H);
  const rng = new Rng(seed * 17 + 5);
  const rp = haze(subRamp(JP.canopy, 0, 8, 8), STRIP_FOG, 0.22);
  const fernRp = haze(subRamp(JP.fern, 0, 8, 8), STRIP_FOG, 0.22);
  const barkRp = haze(subRamp(JP.bark, 0, 8, 8), STRIP_FOG, 0.3);
  const greyRp = haze(subRamp(JP.kauri, 0, 8, 8), STRIP_FOG, 0.3);
  const mossRp = haze(JP.moss, STRIP_FOG, 0.25);
  const G = STRIP_LINES[2].ground;
  // trunks
  const trunks: { x: number; w: number; grey: boolean }[] = [];
  for (let x = rng.range(10, 60); x < W - 10; x += rng.range(55, 120)) trunks.push({ x, w: rng.range(10, 24), grey: rng.chance(0.4) });
  // back crowns across the top (canopy mass with a hanging lower edge)
  const canopyBot = (x: number) => 70 + pfbm1((x / W) * 10, 10, 3, seed + 9) * 45;
  for (let x = 0; x < W; x += rng.range(16, 26)) {
    const r = rng.range(22, 36);
    leafMass(buf, rng, { cx: x, cy: canopyBot(x) - r * 0.9, rx: r * 1.2, ry: r, ramp: rp, base: rng.int(1, 2), steps: 3, shape: 'oval', len: [5, 7], wid: [3.5, 4.5], density: 0.6, droop: 0.4, wrapW: W, jag: 0.4 });
  }
  // lianas between trunks
  for (let i = 0; i + 1 < trunks.length; i++) {
    if (!rng.chance(0.5)) continue;
    const a = trunks[i], b = trunks[i + 1];
    tube(buf, sag(a.x, rng.range(90, 150), b.x, rng.range(90, 170), rng.range(20, 60)), () => 1, barkRp, 3, { wrapW: W, rim: false });
  }
  for (const t of trunks) stripTrunk(buf, t.x, canopyBot(t.x) - 20, G + 6, t.w, t.grey ? greyRp : barkRp, seed + Math.round(t.x), { moss: 0.5, mossRamp: mossRp, flare: 1.5 });
  // tree ferns and hanging vines between trunks
  for (let x = rng.range(20, 60); x < W; x += rng.range(60, 130)) {
    const h = rng.range(60, 110);
    for (let y = 0; y < h; y++) { wset(buf, x, G - y, rc(barkRp, 2)); wset(buf, x + 1, G - y, rc(barkRp, 1)); }
    const n = rng.int(9, 12);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3.3;
      frond(buf, { x, y: G - h, ang: a, len: h * 0.5, droop: 0.6 + Math.abs(Math.cos(a)) * 1.1, ramp: fernRp, base: 3 + (i % 3), pinna: 5, pinnaW: 1.8, gap: 2, wrapW: W, bare: 0.08 });
    }
  }
  for (let i = 0; i < W / 30; i++) {
    const x = rng.range(0, W);
    vine(buf, rng, x, canopyBot(x) - 10, rng.range(30, 140), rp, rng.int(2, 4), { leafEvery: 4, leafLen: 3.5, wrapW: W });
  }
  // front crowns along the hanging lower edge (brighter tops)
  for (let x = rng.range(0, 20); x < W; x += rng.range(24, 40)) {
    const r = rng.range(14, 24);
    leafMass(buf, rng, { cx: x, cy: canopyBot(x) - r * 0.2, rx: r * 1.3, ry: r * 0.8, ramp: rp, base: rng.int(2, 3), steps: 3, shape: 'oval', len: [5, 7], wid: [3.5, 4.5], density: 0.6, droop: 0.55, wrapW: W, jag: 0.45 });
  }
  // undergrowth band
  const ugTop = (x: number) => G - 30 - pfbm1((x / W) * 12, 12, 3, seed + 21) * 36;
  for (let x = 0; x < W; x += rng.range(14, 26)) {
    const r = rng.range(16, 28);
    leafMass(buf, rng, { cx: x, cy: ugTop(x) + r * 0.7, rx: r * 1.1, ry: r * 0.75, ramp: rp, base: rng.int(1, 2), steps: 3, shape: rng.chance(0.5) ? 'oval' : 'point', len: [5, 7], wid: [3.5, 4.5], density: 0.65, wrapW: W, jag: 0.4 });
  }
  for (let x = rng.range(0, 20); x < W; x += rng.range(20, 45)) {
    const n = rng.int(6, 9), L = rng.range(20, 34);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 2.8;
      frond(buf, { x, y: ugTop(x) + 22, ang: a, len: L, droop: 0.6 + Math.abs(Math.cos(a)), ramp: fernRp, base: 4 + (i % 2), pinna: 4, pinnaW: 1.8, gap: 1.8, wrapW: W, bare: 0.1 });
    }
  }
  fillDown(buf, x => ugTop(x) + 30, () => rc(rp, 0));
  return buf;
}

// ------------------------------------------------------------------ depth 3: near trunk wall

function depth3(W: number, seed: number): PixelBuffer {
  const buf = new PixelBuffer(W, STRIP_H);
  const rng = new Rng(seed * 19 + 7);
  const rp = subRamp(JP.canopy, 0, 9, 10);
  const G = STRIP_LINES[3].ground;
  const trunks: { x: number; w: number; rp: Ramp }[] = [];
  for (let x = rng.range(20, 80); x < W - 20; x += rng.range(110, 210)) trunks.push({ x, w: rng.range(30, 56), rp: rng.pick([JP.bark, JP.kauri, JP.rata, JP.fig]) });
  // a few high branches with leaf clumps at the top
  for (const t of trunks) {
    if (!rng.chance(0.6)) continue;
    const side = rng.sign();
    const y0 = rng.range(20, 80);
    const pts: P[] = [[t.x, y0 + 20], [t.x + side * 60, y0], [t.x + side * 120, y0 - 25]];
    tube(buf, pts, tt => 6 - tt * 3, t.rp, 5, { wrapW: W });
    leafMass(buf, rng, { cx: t.x + side * 120, cy: y0 - 30, rx: 40, ry: 26, ramp: rp, base: 2, steps: 4, shape: 'point', len: [5, 8], wid: [3, 4], density: 0.75, wrapW: W });
  }
  for (const t of trunks) {
    stripTrunk(buf, t.x, 0, G + 8, t.w, t.rp, seed + Math.round(t.x), { moss: 0.45, flare: 1.6 });
    // plank buttress fins
    for (const side of [-1, 1]) {
      const h = t.w * rng.range(1.2, 1.8), L = t.w * rng.range(0.9, 1.4);
      const x0 = t.x + side * t.w * 0.35;
      const pts: P[] = [];
      for (let s = 0; s <= 12; s++) { const u = s / 12; pts.push([x0 + side * L * u, G - h * Math.pow(1 - u, 2) + u * 4]); }
      tube(buf, pts, u => t.w * 0.14 * (1 - u) + 1.5, t.rp, 5 + (side < 0 ? 1 : -1), { wrapW: W });
    }
    // lianas and epiphytes
    if (rng.chance(0.7)) vine(buf, rng, t.x + rng.range(-t.w * 0.3, t.w * 0.3), rng.range(0, 60), rng.range(120, 240), JP.kawakawa, 4, { leafEvery: 4, leafLen: 5, wrapW: W });
    for (let k = 0; k < 2; k++) {
      const ey = rng.range(60, G - 80);
      const n = rng.int(7, 10);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 3;
        blade(buf, { x: t.x + rng.range(-t.w * 0.4, 0), y: ey, ang: a, len: rng.range(12, 20), droop: 1 + Math.abs(Math.cos(a)), w0: 3, ramp: JP.astelia, base: 4 + (i % 2), wrapW: W });
      }
    }
  }
  // dense undergrowth: giant leaves, ferns, flax, shrubs
  const ugTop = (x: number) => G - 44 - pfbm1((x / W) * 14, 14, 3, seed + 31) * 50;
  for (let x = 0; x < W; x += rng.range(16, 28)) {
    const r = rng.range(20, 34);
    leafMass(buf, rng, { cx: x, cy: ugTop(x) + r * 0.8, rx: r * 1.15, ry: r * 0.8, ramp: rp, base: rng.int(1, 2), steps: 4, shape: rng.chance(0.5) ? 'oval' : 'point', len: [5, 8], wid: [3, 4.5], density: 0.8, wrapW: W, jag: 0.4 });
  }
  for (let x = rng.range(0, 40); x < W; x += rng.range(50, 110)) {
    const kind = rng.int(0, 2);
    const by = ugTop(x) + 40;
    if (kind === 0) {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.7 + rng.range(-0.2, 0.2);
        const tip: P = [x + Math.cos(a) * 34, by + Math.sin(a) * 34];
        tube(buf, [[x, by + 10], tip], () => 1.5, JP.taro, 4, { wrapW: W });
        bigLeaf(buf, { x: tip[0], y: tip[1], ang: a + Math.PI * 0.5 * (a < -Math.PI / 2 ? -1 : 1) * 0.6 + Math.PI / 2 * 0.3, len: rng.range(26, 38), wid: rng.range(18, 26), ramp: JP.taro, base: 4 + (i % 2), shape: 'heart', droop: 0.4, veins: 5, wrapW: W });
      }
    } else if (kind === 1) {
      const n = rng.int(8, 11), L = rng.range(34, 50);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 2.9;
        frond(buf, { x, y: by, ang: a, len: L, droop: 0.6 + Math.abs(Math.cos(a)), ramp: JP.fern, base: 4 + (i % 3), pinna: 6, pinnaW: 2, gap: 2.2, wrapW: W, bare: 0.1, rachisTop: i % 3 === 2 });
      }
    } else {
      const n = rng.int(12, 16), L = rng.range(40, 60);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        blade(buf, { x: x + t * 8, y: by + 6, ang: -Math.PI / 2 + t * 2.2, len: L * (1 - Math.abs(t) * 0.3), droop: 0.2 + Math.abs(t), w0: 4, ramp: JP.flax, base: 3 + (i % 3), edge: rc(JP.flaxEdge, 1), wrapW: W });
      }
    }
  }
  // shadowed leaf silhouettes in the dark band so it is not a flat fill
  for (let x = 0; x < W; x += rng.range(10, 18)) {
    const r = rng.range(14, 22);
    leafMass(buf, rng, { cx: x, cy: ugTop(x) + 50 + rng.range(0, 30), rx: r * 1.2, ry: r * 0.7, ramp: rp, base: 0, steps: 1, shape: 'point', len: [5, 8], wid: [3, 4], density: 0.7, wrapW: W, jag: 0.5 });
  }
  fillDown(buf, x => ugTop(x) + 44, () => rc(rp, 0));
  return buf;
}

// ------------------------------------------------------------------ canopy ceiling

/** Gap centres (x, px) and widths in a canopy ceiling strip, for placing god rays. */
export function canopyGaps(seed: number, width = 768): { x: number; w: number }[] {
  const rng = new Rng(seed * 23 + 11);
  const n = Math.max(1, Math.round(width / 260));
  const out: { x: number; w: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: Math.round(((i + rng.range(0.25, 0.75)) / n) * width), w: Math.round(rng.range(26, 46)) });
  return out;
}

/**
 * Hanging foliage along the top edge for below-canopy scenes (width × 200, tileable, transparent
 * below). Light gaps from canopyGaps() are left open, with sunlit, backlit leaves around them.
 */
export function canopyCeiling(seed: number, width = 768, height = 200): PixelBuffer {
  const W = Math.round(width), H = Math.round(height);
  const buf = new PixelBuffer(W, H);
  const rng = new Rng(seed * 29 + 13);
  const gaps = canopyGaps(seed, W);
  const gapK = (x: number) => {
    let k = 0;
    for (const g of gaps) {
      let d = Math.abs(x - g.x);
      d = Math.min(d, W - d);
      k = Math.max(k, clamp(1 - d / (g.w * 1.3)));
    }
    return k;
  };
  const rp = subRamp(JP.canopy, 0, 7, 8);
  const lit: Ramp = JP.kawakawa.slice(3, 10);
  const depthAt = (x: number) => (40 + pfbm1((x / W) * 12, 12, 3, seed) * 55) * (1 - gapK(x) * 0.85);
  // lianas & vines hanging (behind the foliage)
  for (let i = 0; i < W / 70; i++) {
    const x0 = rng.range(0, W), x1 = x0 + rng.range(40, 120);
    tube(buf, sag(x0, 20, x1, 25, rng.range(40, 110)), () => 1.3, JP.bark, 3, { wrapW: W, rim: false });
  }
  for (let i = 0; i < W / 14; i++) {
    const x = rng.range(0, W);
    if (gapK(x) > 0.6) continue;
    vine(buf, rng, x, depthAt(x) * 0.6, rng.range(20, H - depthAt(x)) * (1 - gapK(x)), rp, rng.int(3, 5), { leafEvery: 4, leafLen: 4, wrapW: W });
  }
  // solid band at the very top + hanging lobes (seen from below: darker undersides)
  for (let x = 0; x < W; x++) for (let y = 0; y < 8 * (1 - gapK(x)); y++) buf.data[y * W + x] = rc(rp, 0);
  for (let x = 0; x < W; x += rng.range(8, 16)) {
    const d = depthAt(x);
    if (d < 8) continue;
    const r = rng.range(12, 22);
    leafMass(buf, rng, { cx: x, cy: d * 0.55, rx: r * 1.2, ry: d * 0.55, ramp: rp, base: 1, steps: 3, shape: 'point', len: [5, 8], wid: [3, 4], droop: 0.75, density: 0.8, wrapW: W, jag: 0.5, shift: 0.08 });
  }
  // backlit / sunlit leaves around the gaps (bright, translucent lime)
  for (const g of gaps) {
    for (let i = 0; i < 26; i++) {
      const side = rng.sign();
      const x = g.x + side * rng.range(g.w * 0.45, g.w * 1.4);
      const y = rng.range(2, depthAt(x) * 0.9 + 6);
      const st = leafStamp('point', rng.range(5, 9), rng.range(3, 4.5), Math.PI / 2 + rng.range(-0.9, 0.9));
      stampW(buf, st, x, y, lit, rng.int(3, 5), W, 12);
    }
  }
  // hanging fern fronds
  for (let i = 0; i < W / 60; i++) {
    const x = rng.range(0, W);
    if (gapK(x) > 0.5) continue;
    frond(buf, { x, y: depthAt(x) * 0.7, ang: Math.PI / 2 + rng.range(-0.6, 0.6), len: rng.range(22, 40), droop: 0.3, ramp: JP.fern, base: 3, pinna: 5, pinnaW: 2, gap: 2, wrapW: W, bare: 0.05 });
  }
  return buf;
}

// ------------------------------------------------------------------ forest floor ground strip

/**
 * Tileable forest-floor ground strip (width × height): mossy lip and grass on top, then soil
 * with leaf litter, roots and pebbles. The walkable surface is at y = FLOOR_TOP (6 px).
 */
export const FLOOR_TOP = 6;
export function forestFloor(seed: number, width = 768, height = 90): PixelBuffer {
  const W = Math.round(width), H = Math.round(height);
  const buf = new PixelBuffer(W, H);
  const rng = new Rng(seed * 31 + 17);
  const surf = (x: number) => FLOOR_TOP + Math.round((pfbm1((x / W) * 24, 24, 2, seed) - 0.5) * 4);
  for (let x = 0; x < W; x++) {
    const s = surf(x);
    for (let y = s; y < H; y++) {
      const d = y - s;
      const n = pfbm2((x / W) * 64, y * 0.12, 64, 2, seed + 3);
      let k = 5.2 - d * 0.045 + (n - 0.5) * 2.2;
      if (d < 2) k += 1;
      buf.data[y * W + x] = rc(JP.soil, k);
    }
  }
  // leaf litter
  for (let i = 0; i < W * H * 0.05; i++) {
    const x = rng.range(0, W), y = FLOOR_TOP + rng.range(0, H * 0.7) * Math.pow(rng.next(), 1.5);
    const st = leafStamp(rng.chance(0.5) ? 'oval' : 'point', rng.range(3, 5), rng.range(2, 3), rng.range(-0.6, 0.6) + (rng.chance(0.5) ? Math.PI : 0));
    const pal = rng.chance(0.18) ? JP.moss : JP.litter;
    const tone = rng.int(1, pal.length - 3) - (y > H * 0.5 ? 1 : 0);
    // only over soil (mode 2), wrapped
    drawStamp(buf, st, mod(x, W), y, pal, tone, 2);
    if (mod(x, W) < 6) drawStamp(buf, st, mod(x, W) + W, y, pal, tone, 2);
    if (mod(x, W) > W - 6) drawStamp(buf, st, mod(x, W) - W, y, pal, tone, 2);
  }
  // roots
  for (let i = 0; i < W / 90; i++) {
    const x0 = rng.range(0, W), len = rng.range(40, 120);
    const pts: P[] = [];
    let y = FLOOR_TOP + rng.range(4, 20);
    for (let s = 0; s <= len; s += 6) { pts.push([x0 + s, y]); y = clamp(y + rng.range(-3, 3), FLOOR_TOP + 2, H - 8); }
    tube(buf, pts, t => 1.2 + Math.sin(t * Math.PI) * 1.5, JP.bark, 4, { wrapW: W, mode: 2 });
  }
  // pebbles
  for (let i = 0; i < W / 25; i++) {
    const x = rng.range(0, W), y = FLOOR_TOP + rng.range(6, H - 6), r = rng.range(1.2, 2.6);
    for (let yy = -2; yy <= 2; yy++) for (let xx = -3; xx <= 3; xx++) {
      const nx = xx / (r * 1.3), ny = yy / r;
      if (nx * nx + ny * ny > 1) continue;
      wset(buf, x + xx, y + yy, rc(JP.rock, 5 + (ny < -0.3 ? 2 : 0) - (nx > 0.4 ? 1 : 0)));
    }
  }
  // mossy lip and grass tufts on top
  for (let x = 0; x < W; x++) {
    const s = surf(x);
    const m = pfbm1((x / W) * 40, 40, 2, seed + 9);
    if (m > 0.45) {
      wset(buf, x, s, rc(JP.moss, 6));
      wset(buf, x, s + 1, rc(JP.moss, 4));
      if (m > 0.6) wset(buf, x, s - 1, rc(JP.moss, 5));
    }
  }
  for (let i = 0; i < W / 9; i++) {
    const x = rng.range(0, W);
    const n = rng.int(3, 6), h = rng.range(3, 7);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / Math.max(1, n - 1) - 0.5) * 1.4;
      for (let s = 0; s < h; s++) wset(buf, x + Math.cos(a) * s, surf(Math.round(mod(x, W))) - Math.sin(-a) * s, rc(JP.moss, 5 + (s > h * 0.6 ? 1 : 0)));
    }
  }
  return buf;
}

// ------------------------------------------------------------------ public

/**
 * Tileable forest strip, width × 360 px (width 512–1024, default 768), transparent sky above.
 * depth 0: far misty ridges; 1: distant canopy with emergent kauri/ferns/palms; 2: mid forest
 * (canopy, trunks, lianas, tree ferns, undergrowth); 3: near trunk wall with buttresses and dense
 * undergrowth. See STRIP_LINES for each depth's design lines.
 */
export function forestStrip(depth: StripDepth, seed: number, width = 768): PixelBuffer {
  const W = Math.round(clamp(width, 128, 2048));
  switch (depth) {
    case 0: return depth0(W, seed);
    case 1: return depth1(W, seed);
    case 2: return depth2(W, seed);
    case 3: return depth3(W, seed);
  }
}

export { TAU };

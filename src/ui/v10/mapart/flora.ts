// Region Map flora: the plants of each part of the island painted one by one (no stamps): tawa and
// pūriri crowns, rimu with weeping foliage, kauri giants standing out of the canopy on pale trunks,
// tree ferns in the gullies, nīkau and coconut palms leaning over the beaches, pōhutukawa in red
// bloom on the coast, little beech crowns packed into the southern bush, mangroves on their stilt
// roots, flax and cabbage trees by the water, raupō, tussock and tors on the hills, the glowing
// valley's trees and fungi, dead snags in the hot ground. Sizes, species and colours drift in patches
// (old growth, young stands, clearings), crowns pick up the light of the slope they stand on.

import { C, hex, mix } from '../../../art/color';
import { Rng, clamp, hash2, noise2 } from '../../../core/math';
import { B, LM, WALLOWS } from '../mapgeo';
import type { Fields } from './field';
import type { Light } from './terrain';
import { W, H, P, WK, TAG, slice } from './kit';
import { Layer, crown, trunk, shadeIdx } from './sprites';

export interface Feat { gy: number; gx: number; f: () => void }

// ------------------------------------------------------------------ painters
const PALM_BARK = [hex('#3e3428'), hex('#5a4c3a'), hex('#76664e'), hex('#927f62'), hex('#ac9878')];
const NIKAU_BARK = [hex('#3a4030'), hex('#525a44'), hex('#6a7458'), hex('#848e6c'), hex('#9aa47e')];
const FERN_TRUNK = [hex('#1a120c'), hex('#2a1c12'), hex('#3a2a1a'), hex('#4c3824')];
const FLAX = [hex('#1a2c16'), hex('#26401e'), hex('#345426'), hex('#44682e'), hex('#567c38')];
const FLAX_STALK = [hex('#3a1c10'), hex('#5a2a14'), hex('#c4501e'), hex('#e8782a')];
const CABBAGE = [hex('#2e3a1c'), hex('#425024'), hex('#58682e'), hex('#70823a'), hex('#8c9c4a')];
const REED = [hex('#3a3a1c'), hex('#545426'), hex('#6e6c32'), hex('#8a8640'), hex('#4a2c14')];
const SPINIFEX = [hex('#7a7444'), hex('#949054'), hex('#aeaa68'), hex('#c8c482')];
const MANUKA = [hex('#1a2618'), hex('#24341e'), hex('#304426'), hex('#3e542e'), hex('#4e6638'), hex('#627a44')];
const SNAG = [hex('#3a3632'), hex('#5a5550'), hex('#7c766e'), hex('#9e978c'), hex('#c0b9ac')];
const DRIFT = [hex('#5a5248'), hex('#7c7266'), hex('#a09684'), hex('#c4baa6'), hex('#e0d8c6')];
const ROOT = [hex('#1e140c'), hex('#2e2014'), hex('#40301e')];
const MUSH = [[hex('#2e0e3a'), hex('#521860'), hex('#7a2a8a'), hex('#a848b0'), hex('#d070d0'), hex('#f4a8f0')], [hex('#062a2e'), hex('#0c4448'), hex('#146664'), hex('#22887e'), hex('#3cb0a0'), hex('#7ae6d0')]];

/** a palm: a ringed trunk curving up, a star of arching fronds (seen from a little above) */
function palm(l: Layer, x: number, y: number, th: number, lean: number, seed: number, light: number, nikau: boolean) {
  const rng = new Rng(seed);
  const bark = nikau ? NIKAU_BARK : PALM_BARK;
  const bend = rng.range(-0.6, 0.6);
  let tx = x, ty = y;
  for (let k = 0; k < th; k++) {
    const u = k / th;
    tx = x + lean * k + bend * u * u * 3;
    ty = y - k;
    const c = k % 2 ? bark[2] : bark[1];
    l.px(Math.round(tx), Math.round(ty), k === 0 ? bark[0] : c, k);
    if (th > 9) l.px(Math.round(tx) + 1, Math.round(ty), k % 2 ? bark[1] : bark[0], k);
  }
  const cx = Math.round(tx), cy = Math.round(ty) - 1;
  if (nikau) { l.px(cx, cy + 1, hex('#7a8a5a'), th); l.px(cx + 1, cy + 1, hex('#5e6c46'), th); }
  const pal = P.palm, n = pal.length;
  const nf = 8 + (seed % 3);
  const fronds: { a: number; L: number }[] = [];
  for (let f = 0; f < nf; f++) fronds.push({ a: (f / nf) * Math.PI * 2 + rng.range(-0.25, 0.25), L: rng.range(6, 9.5) * (th > 9 ? 1.1 : 0.9) });
  // back fronds first (pointing away), the front ones over them
  fronds.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  for (const fr of fronds) {
    const ca = Math.cos(fr.a), sa = Math.sin(fr.a);
    const facing = -ca * 0.6 - sa * 0.5;
    for (let t = 0.6; t <= fr.L; t += 0.5) {
      const u = t / fr.L;
      const droop = u * u * 4.2 - u * 1.2;
      const fx = cx + ca * t, fy = cy + sa * t * 0.55 + droop;
      const z = th + 2 - droop;
      const v = 0.55 + facing * 0.35 + (light - 0.5) * 0.4 - u * 0.2;
      const idx = shadeIdx(n, v, Math.round(fx), Math.round(fy));
      l.px(Math.round(fx), Math.round(fy), pal[idx], z, TAG.crown);
      // leaflets hanging off both sides
      if (u > 0.15 && u < 0.92) {
        const w = u < 0.6 ? 1.5 : 1;
        l.px(Math.round(fx - sa * w), Math.round(fy + ca * w * 0.55 + 0.6), pal[Math.max(0, idx - 1)], z - 1, TAG.crown);
        l.px(Math.round(fx + sa * w), Math.round(fy - ca * w * 0.55 + 0.6), pal[Math.max(0, idx - 2)], z - 1, TAG.crown);
      }
    }
  }
  l.px(cx, cy, pal[n - 1], th + 3, TAG.gust);
  if (!nikau && seed % 2) { l.px(cx - 1, cy + 1, hex('#6a4a22'), th + 1); l.px(cx + 1, cy + 1, hex('#5a3c1a'), th + 1); }
}

/** a tree fern: a short dark trunk and a rosette of fronds, a pale koru in the middle */
function treeFern(l: Layer, x: number, y: number, th: number, L: number, seed: number, light: number) {
  const rng = new Rng(seed);
  for (let k = 0; k < th; k++) l.px(x, y - k, FERN_TRUNK[k === 0 ? 0 : 1 + (k % 2)], k);
  const cx = x, cy = y - th;
  const pal = P.fern, n = pal.length;
  const nf = 7 + (seed % 3);
  const fr: number[] = [];
  for (let f = 0; f < nf; f++) fr.push((f / nf) * Math.PI * 2 + rng.range(-0.3, 0.3));
  fr.sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of fr) {
    const ca = Math.cos(a), sa = Math.sin(a), len = L * rng.range(0.8, 1.1);
    const facing = -ca * 0.5 - sa * 0.55;
    for (let t = 0.5; t <= len; t += 0.5) {
      const u = t / len;
      const droop = u * u * 2.4;
      const fx = cx + ca * t, fy = cy + sa * t * 0.62 + droop;
      const v = 0.5 + facing * 0.32 + (light - 0.5) * 0.4 + (1 - u) * 0.15;
      const idx = shadeIdx(n, v, Math.round(fx), Math.round(fy));
      const z = th + 2 - droop;
      l.px(Math.round(fx), Math.round(fy), pal[idx], z, u < 0.4 && facing > 0 ? TAG.gust : TAG.crown);
      if (u > 0.2 && u < 0.9 && ((t * 2) | 0) % 2 === 0) {
        l.px(Math.round(fx - sa), Math.round(fy + ca * 0.6), pal[Math.max(0, idx - 1)], z - 1, TAG.crown);
        l.px(Math.round(fx + sa), Math.round(fy - ca * 0.6), pal[Math.max(0, idx - 2)], z - 1, TAG.crown);
      }
    }
  }
  l.px(cx, cy, FERN_TRUNK[3], th + 2);
  l.px(cx, cy - 1, pal[n - 1], th + 3, TAG.gust);
}

/** harakeke: a fan of sword leaves, sometimes a flower stalk */
function flax(l: Layer, x: number, y: number, seed: number, s: number) {
  const rng = new Rng(seed);
  const nl = 5 + (seed % 3);
  for (let k = 0; k < nl; k++) {
    const a = -Math.PI * (0.18 + (k / (nl - 1)) * 0.64) + rng.range(-0.1, 0.1);
    const len = rng.range(3.5, 6) * s;
    for (let t = 0; t <= len; t += 0.5) {
      const fx = x + Math.cos(a) * t, fy = y + Math.sin(a) * t + (t / len) * (t / len) * 1.5;
      l.px(Math.round(fx), Math.round(fy), FLAX[clamp(Math.round(1 + (1 - t / len) * 2 + (k % 2)), 0, 4)], -Math.sin(a) * t);
    }
  }
  if (seed % 3 === 0) {
    const hh = Math.round(6 * s + rng.range(0, 3));
    for (let k = 0; k < hh; k++) l.px(x + (k > hh * 0.6 ? 1 : 0), y - k, FLAX_STALK[k > hh - 3 ? 2 + (k % 2) : 1], k);
  }
}

/** tī kōuka: a slim trunk and a spiky ball of leaves */
function cabbageTree(l: Layer, x: number, y: number, th: number, seed: number, light: number) {
  const rng = new Rng(seed);
  const lean = rng.range(-0.15, 0.15);
  trunk(l, x, y, th, P.bark, 1, lean);
  const tx = Math.round(x + lean * th), ty = y - th;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(2, 3.6);
    for (let t = 0; t <= len; t += 0.7) {
      const fx = tx + Math.cos(a) * t, fy = ty + Math.sin(a) * t * 0.8 + (Math.sin(a) > 0 ? t * 0.3 : 0);
      const v = 0.55 - Math.cos(a) * 0.25 - Math.sin(a) * 0.25 + (light - 0.5) * 0.4;
      l.px(Math.round(fx), Math.round(fy), CABBAGE[clamp(Math.round(v * 4), 0, 4)], th + 2, TAG.crown);
    }
  }
  l.px(tx, ty, CABBAGE[4], th + 3, TAG.gust);
}

function tussock(l: Layer, x: number, y: number, s: number, seed: number, pal: C[]) {
  const n = pal.length;
  const w = Math.round(2 + s * 1.5);
  for (let k = -w; k <= w; k++) {
    const hh = Math.round((1 - Math.abs(k) / (w + 1)) * (2 + s) + hash2(k, seed, 7) * 1.4);
    for (let j = 0; j < hh; j++) {
      const lean = k < 0 ? -1 : k > 0 ? 1 : 0;
      const xx = x + k + (j > 1 ? lean : 0);
      const v = 0.3 + (j / Math.max(1, hh)) * 0.6 - (k > 0 ? 0.15 : 0) + (hash2(xx, j, seed) - 0.5) * 0.2;
      l.px(xx, y - j, pal[clamp(Math.round(v * (n - 1)), 0, n - 1)], j);
    }
  }
}

function reeds(l: Layer, x: number, y: number, seed: number) {
  const rng = new Rng(seed);
  for (let k = 0; k < 5; k++) {
    const xx = x + Math.round(rng.range(-3, 3)), hh = Math.round(rng.range(3, 7));
    for (let j = 0; j < hh; j++) l.px(xx + (j > hh - 2 && k % 2 ? 1 : 0), y - j, REED[j === hh - 1 ? 3 : 1 + (j % 2)], j);
    if (rng.next() < 0.45) { l.px(xx, y - hh, REED[4], hh); l.px(xx, y - hh - 1, REED[4], hh + 1); }
  }
}

function shrub(l: Layer, x: number, y: number, r: number, pal: C[], seed: number, light: number, flower?: C) {
  l.px(x, y, P.trunk[1], 0);
  crown(l, x, y - r * 0.7, r, pal, light, seed, 0, { clumps: 3, squash: 0.8 });
  if (flower) for (let k = 0; k < Math.round(r * 2); k++) {
    const fx = x + Math.round((hash2(seed, k, 8) - 0.5) * r * 1.6), fy = Math.round(y - r * 0.7 + (hash2(seed, k, 9) - 0.6) * r * 1.2);
    if (l.scr.gy[fy * W + fx] === l.gy) l.px(fx, fy, flower, r * 1.5);
  }
}

/** a boulder: lit on its upper left, a dark underside, lichen */
export function boulder(l: Layer, x: number, y: number, r: number, pal: C[], seed: number, light: number, moss = false) {
  const n = pal.length;
  const sq = 0.78;
  for (let yy = Math.floor(y - r * 1.5); yy <= y; yy++) for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
    const dx = (xx + 0.5 - x) / r, dy = (yy + 0.5 - (y - r * sq)) / (r * sq);
    const d2 = dx * dx + dy * dy;
    if (d2 > 1 + (hash2(xx, yy, seed) - 0.5) * 0.3) continue;
    const nz = Math.sqrt(Math.max(0, 1 - d2));
    let v = 0.5 - dx * 0.35 - dy * 0.4 + nz * 0.2 + (light - 0.5) * 0.3;
    if (d2 > 0.72 && dx + dy > 0.2) v = 0.05;
    let c = pal[shadeIdx(n, v, xx, yy)];
    if (moss && dy < -0.3 && hash2(xx, yy, seed + 1) > 0.5) c = hash2(xx, yy, seed + 2) > 0.5 ? hex('#5a7a34') : hex('#7a9a44');
    else if (hash2(xx, yy, seed + 3) > 0.94) c = hex('#c8c27a');
    l.px(xx, yy, c, (1 - dy) * r * sq);
  }
}

/** a tor: boulders stacked into a little tower */
function tor(l: Layer, x: number, y: number, seed: number, light: number, size: number) {
  const rng = new Rng(seed);
  const rows = 2 + Math.floor(rng.next() * 2 + size);
  let yy = y, wid = 2.4 + size * 1.4;
  for (let row = 0; row < rows; row++) {
    const k = row === 0 ? 2 + Math.floor(rng.next() * 2) : row < rows - 1 ? 1 + Math.floor(rng.next() * 2) : 1;
    for (let j = 0; j < k; j++) {
      const r = rng.range(1.8, 3.2) * (1 - row * 0.12) * (0.8 + size * 0.35);
      const bx = x + (k === 1 ? rng.range(-1, 1) : (j - (k - 1) / 2) * wid);
      boulder(l, Math.round(bx), Math.round(yy), r, P.granite, seed + row * 7 + j, light, row === 0);
    }
    yy -= Math.round(2.6 + size);
    wid *= 0.72;
  }
}

function mangrove(l: Layer, x: number, y: number, r: number, seed: number, light: number) {
  const rng = new Rng(seed);
  for (let k = 0; k < 4; k++) {
    const ox = Math.round((k - 1.5) * r * 0.5 + rng.range(-1, 1));
    for (let t = 0; t <= 3; t++) l.px(x + Math.round(ox * (t / 3)), y - 3 + t, ROOT[t === 3 ? 0 : 1 + (t % 2)], 3 - t);
  }
  crown(l, x, y - 3 - r * 0.45, r, P.mang, light, seed, 3, { squash: 0.62, clumps: 5, spread: 1.15 });
}

function mushroom(l: Layer, x: number, y: number, r: number, seed: number) {
  const pal = MUSH[seed % 2];
  const sh = Math.round(r * 1.2 + 2);
  for (let k = 0; k < sh; k++) l.px(x, y - k, k % 2 ? hex('#d8d0c0') : hex('#b4ac9c'), k);
  const cy = y - sh;
  for (let yy = Math.floor(cy - r * 0.75); yy <= cy + 1; yy++) for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
    const dx = (xx + 0.5 - x) / (r + 0.5), dy = (yy + 0.5 - cy) / (r * 0.75 + 0.5);
    if (dx * dx + dy * dy > 1 || yy > cy + 1) continue;
    const v = 0.55 - dx * 0.3 - dy * 0.35 - (yy === cy + 1 ? 0.4 : 0);
    let c = pal[clamp(Math.round(v * 5), 0, 5)], tag = 0;
    if (hash2(xx, yy, seed) > 0.8 && yy < cy) { c = hex('#e8fff8'); tag = TAG.fungi; }
    l.px(xx, yy, c, sh + (cy - yy), tag);
  }
}

function snag(l: Layer, x: number, y: number, th: number, seed: number) {
  const rng = new Rng(seed);
  for (let k = 0; k < th; k++) l.px(x, y - k, SNAG[k % 2 ? 2 : 1], k);
  for (let b = 0; b < 3; b++) {
    const by = y - Math.round(th * (0.45 + b * 0.18)), dir = b % 2 ? 1 : -1, len = Math.round(rng.range(2, 4));
    for (let t = 1; t <= len; t++) l.px(x + dir * t, by - Math.round(t * 0.7), SNAG[3], th);
  }
}

export function driftwood(l: Layer, x: number, y: number, len: number, seed: number) {
  const tilt = (hash2(seed, 1, 5) - 0.5) * 0.4;
  for (let t = 0; t < len; t++) {
    const yy = Math.round(y + tilt * t);
    l.px(x + t, yy - 1, DRIFT[t === 0 || t === len - 1 ? 2 : 3 + ((t * 7 + seed) % 2)], 1);
    l.px(x + t, yy, DRIFT[1], 0);
  }
  if (seed % 2) { l.px(x + len, Math.round(y + tilt * len) - 2, DRIFT[2], 2); l.px(x + len + 1, Math.round(y + tilt * len) - 3, DRIFT[2], 3); }
}

// ------------------------------------------------------------------ the species of each place
const shiftRamp = (pal: C[], seed: number): C[] => {
  // individual trees vary a little: warmer, cooler, a bit lighter or darker
  const t = hash2(seed, 3, 401);
  if (t < 0.18) return pal.map(c => mix(c, hex('#8a9a20'), 0.12));
  if (t < 0.32) return pal.map(c => mix(c, hex('#1e5a5a'), 0.12));
  if (t > 0.9) return pal.map(c => mix(c, hex('#c8d878'), 0.08));
  return pal;
};
const RAMPS = new Map<string, C[][]>();
function ramps(name: string, pal: C[]): C[][] {
  let r = RAMPS.get(name);
  if (!r) { r = Array.from({ length: 8 }, (_, k) => shiftRamp(pal, k * 13 + 1)); RAMPS.set(name, r); }
  return r;
}

/** which broadleaf grows here: stands of one kind drift across the forest */
function speciesAt(x: number, y: number, r: number): 'tawa' | 'puriri' | 'mahoe' {
  const n = noise2(x * 0.009, y * 0.009, 531) + (r - 0.5) * 0.35;
  return n < 0.36 ? 'puriri' : n > 0.62 ? 'mahoe' : 'tawa';
}

export function placeFlora(f: Fields, L: Light, l: Layer, feats: Feat[]) {
  const { land, bio, hgt, wat, cd, rd, patch } = f;
  const lit = L.lit;
  const at = (x: number, y: number) => (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 ? -1 : (y | 0) * W + (x | 0));
  const dry = (i: number) => i >= 0 && land[i] === 1 && wat[i] === 0 && wat[i - 1] === 0 && wat[i + 1] === 0 && wat[i - W] === 0 && wat[i + W] === 0;
  // clearings: the camp, the village, the pā's top, wallows, the falls' pool, the sinkhole
  const clear: [number, number, number][] = [
    [LM.tent[0] + 10, LM.tent[1], 52], [LM.wreck[0], LM.wreck[1], 30], [LM.village[0], LM.village[1] - 6, 136], [LM.pa[0], LM.pa[1], 44], [LM.lookout[0] + 24, LM.lookout[1] + 8, 40],
    [LM.plunge[0], LM.plunge[1], 20], [LM.sink[0], LM.sink[1], 0], [LM.boatyard[0], LM.boatyard[1], 20], [LM.signpost[0], LM.signpost[1], 8],
    [LM.whale[0], LM.whale[1], 20], ...WALLOWS.map(([x, y, r]) => [x, y, r + 8] as [number, number, number]),
  ];
  const inClear = (x: number, y: number) => clear.some(([cx, cy, r]) => { const dx = x - cx, dy = (y - cy) * 1.3; return dx * dx + dy * dy < r * r; });
  const sinkK = (x: number, y: number) => Math.hypot((x - LM.sink[0]) / 118, (y - LM.sink[1]) / 54);
  const add = (gx: number, gy: number, fn: (sx: number, sy: number, lv: number) => void) => {
    const i = at(gx, gy);
    if (i < 0) return;
    const sy = Math.round(gy - hgt[i]), lv = lit[i] / 255;
    feats.push({ gy, gx, f: () => { l.begin(gy); fn(Math.round(gx), sy, lv); } });
  };
  const same = (x: number, y: number, b: number) => { const i = at(x, y); return i >= 0 && bio[i] === b ? 1 : 0; };
  const step = 4;
  for (let gy = 2; gy < H - 2; gy += step) {
    for (let gx = 2; gx < W - 2; gx += step) {
      const x = gx + Math.floor(hash2(gx, gy, 501) * step), y = gy + Math.floor(hash2(gx, gy, 502) * step);
      const i = at(x, y);
      if (i < 0 || !land[i]) continue;
      const b = bio[i] as B;
      const r0 = hash2(gx, gy, 503), r1 = hash2(gx, gy, 504), r2 = hash2(gx, gy, 505);
      const seed = (gx * 73856093) ^ (gy * 19349663);
      const ok = dry(i);
      const pt = patch[i];
      if (inClear(x, y)) {
        if (ok && r0 < 0.05 && b !== B.beach) add(x, y, (sx, sy, lv) => tussock(l, sx, sy, 0.6, seed, P.grass));
        continue;
      }
      // a stand thins out toward its edge
      const edge = (same(x - 12, y, b) + same(x + 12, y, b) + same(x, y - 12, b) + same(x, y + 12, b)) / 4;
      const accept = (spacing: number, dens = 1) => r0 < (step * step) / (spacing * spacing) * dens * (0.35 + edge * 0.65);
      const h = hgt[i];
      const gully = rd[i] < 28;
      switch (b) {
        case B.forest: case B.fern: {
          if (!ok) break;
          const fern = b === B.fern || (gully && r2 < 0.7);
          if (!accept(fern ? 6.4 : 8.2, 1 - Math.max(0, pt - 0.68) * 2.5)) break;
          const big = 0.82 + pt * 0.45;
          if (fern && r1 < (b === B.fern ? 0.72 : 0.8)) { const th = 2 + Math.floor(r2 * 4), Lf = 4.5 + r1 * 3.5; add(x, y, (sx, sy, lv) => treeFern(l, sx, sy, th, Lf, seed, lv)); break; }
          if (cd[i] < 150 && r1 < 0.2) { const th = 7 + Math.floor(r2 * 6); add(x, y, (sx, sy, lv) => palm(l, sx, sy, th, (r2 - 0.5) * 0.25, seed, lv, true)); break; }
          if (r1 < 0.035 && h > 24) { const rr = 9 + r2 * 3; add(x, y, (sx, sy, lv) => kauri(l, sx, sy, rr, seed, lv)); break; }
          if (r1 < 0.28) { const rr = (4.4 + r2 * 1.8) * big; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 4, P.trunk, 1); crown(l, sx, sy - 3 - rr * 0.8, rr, ramps('rimu', P.rimu)[seed & 7], lv, seed, 3, { weep: true, squash: 0.95, clumps: 6 }); }); break; }
          if (r1 < 0.31) { const rr = (4 + r2 * 1.5) * big; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 3, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, P.kowhai, lv, seed, 2, { clumps: 5 }); }); break; }
          { const rr = (5.6 + r2 * 2.6) * big; const sp = speciesAt(x, y, r2); add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 4, P.trunk, r2 > 0.7 ? 2 : 1); crown(l, sx, sy - 3 - rr * 0.8, rr, ramps(sp, P[sp])[seed & 7], lv, seed, 3); }); }
          break;
        }
        case B.canopy: {
          if (!ok || !accept(8.4)) break;
          if (r1 < 0.32) { const rr = 10 + r2 * 4; add(x, y, (sx, sy, lv) => kauri(l, sx, sy, rr, seed, lv)); break; }
          if (gully && r1 < 0.5) { add(x, y, (sx, sy, lv) => treeFern(l, sx, sy, 3, 6, seed, lv)); break; }
          { const rr = 5.5 + r2 * 2.2; const pal = r2 < 0.3 ? P.rimu : P.tawa; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 4, P.trunk, 1); crown(l, sx, sy - 3 - rr * 0.8, rr, ramps(pal === P.rimu ? 'rimu' : 'tawa', pal)[seed & 7], lv, seed, 3, { weep: pal === P.rimu }); }); }
          break;
        }
        case B.beech: case B.mountain: {
          if (!ok) break;
          if (b === B.mountain && h > 132) {
            // above the bush line: tussock, then bare rock and boulders
            if (h < 168 && r0 < 0.16) add(x, y, (sx, sy) => tussock(l, sx, sy, 0.6 + r1, seed, P.alpine));
            else if (r0 < 0.03 && h < 172) { const rr = 1.6 + r1 * 2.2; add(x, y, (sx, sy, lv) => boulder(l, sx, sy, rr, P.granite, seed, lv)); }
            break;
          }
          const line = clamp((132 - h) / 30);
          if (!accept(5.6, b === B.mountain ? 0.4 + line * 0.6 : 1 - Math.max(0, pt - 0.72) * 2)) break;
          if (gully && r1 < 0.3) { add(x, y, (sx, sy, lv) => treeFern(l, sx, sy, 2, 4.6, seed, lv)); break; }
          if (r1 < 0.08) { const rr = 5 + r2 * 1.5; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 4, P.trunk, 1); crown(l, sx, sy - 3 - rr * 0.8, rr, ramps('rimu', P.rimu)[seed & 7], lv, seed, 3, { weep: true, squash: 0.95 }); }); break; }
          { const rr = (3.4 + r2 * 1.7) * (0.75 + line * 0.25) * (0.88 + pt * 0.3); add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 2, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, ramps('beech', P.beech)[seed & 7], lv, seed, 2, { clumps: 4 }); }); }
          break;
        }
        case B.coastal: {
          if (!ok || !accept(6.5)) break;
          if (r1 < 0.34) { const rr = 6 + r2 * 3; add(x, y, (sx, sy, lv) => pohutukawa(l, sx, sy, rr, seed, lv)); break; }
          if (r1 < 0.72) { const th = 8 + Math.floor(r2 * 7); add(x, y, (sx, sy, lv) => palm(l, sx, sy, th, (r2 - 0.5) * 0.4, seed, lv, r2 < 0.6)); break; }
          if (r1 < 0.86) add(x, y, (sx, sy) => flax(l, sx, sy, seed, 1));
          else { const rr = 2.6 + r2; add(x, y, (sx, sy, lv) => shrub(l, sx, sy, rr, MANUKA, seed, lv, hex('#f4f2e8'))); }
          break;
        }
        case B.dunes: {
          if (!ok) break;
          // the palm grove behind the home beach, leaning toward the sea
          const grove = x > 560 && x < 700 && y < 360;
          if (grove && accept(9)) { const th = 9 + Math.floor(r2 * 7); add(x, y, (sx, sy, lv) => palm(l, sx, sy, th, -0.05 + (r2 - 0.5) * 0.3, seed, lv, false)); break; }
          if (r0 < 0.12) add(x, y, (sx, sy) => tussock(l, sx, sy, 0.4 + r1 * 0.6, seed, SPINIFEX));
          else if (r0 < 0.14 && cd[i] < 140) { const th = 9 + Math.floor(r2 * 6); add(x, y, (sx, sy, lv) => palm(l, sx, sy, th, (r2 - 0.5) * 0.5, seed, lv, false)); }
          else if (r0 < 0.152) add(x, y, (sx, sy) => flax(l, sx, sy, seed, 0.8));
          break;
        }
        case B.beach: {
          if (!ok) break;
          if (r0 < 0.008 && cd[i] > 8) { const len = 4 + Math.floor(r1 * 6); add(x, y, (sx, sy) => driftwood(l, sx, sy, len, seed)); }
          break;
        }
        case B.rock: {
          if (r0 < 0.09) { const rr = 1.4 + r1 * 2.4; add(x, y, (sx, sy, lv) => boulder(l, sx, sy, rr, r2 < 0.5 ? P.basalt : P.rock, seed, lv)); }
          break;
        }
        case B.swamp: {
          let wet = false;
          for (let k = 0; k < 8 && !wet; k++) { const j = at(x + Math.cos(k) * 7, y + Math.sin(k) * 5); if (j >= 0 && wat[j]) wet = true; }
          if (!accept(6.5, wet ? 1.15 : 0.55)) break;
          if (wet && r1 < 0.75) { const rr = 3.6 + r2 * 2.2; add(x, y, (sx, sy, lv) => mangrove(l, sx, sy, rr, seed, lv)); break; }
          if (r1 < 0.85) add(x, y, (sx, sy) => reeds(l, sx, sy, seed));
          else if (r1 < 0.93) { const th = 6 + Math.floor(r2 * 5); add(x, y, (sx, sy) => snag(l, sx, sy, th, seed)); }
          else { const th = 6 + Math.floor(r2 * 4); add(x, y, (sx, sy, lv) => cabbageTree(l, sx, sy, th, seed, lv)); }
          break;
        }
        case B.wetland: {
          if (!ok || r0 > 0.32) break;
          if (r1 < 0.55) add(x, y, (sx, sy) => reeds(l, sx, sy, seed));
          else if (r1 < 0.8) add(x, y, (sx, sy) => flax(l, sx, sy, seed, 0.9));
          else { const th = 6 + Math.floor(r2 * 5); add(x, y, (sx, sy, lv) => cabbageTree(l, sx, sy, th, seed, lv)); }
          break;
        }
        case B.glow: {
          if (!ok || !accept(6.8)) break;
          if (r1 < 0.94) { const rr = 4.5 + r2 * 2.5; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 3, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, P.glowc, lv * 0.6, seed, 2, { glow: 0.012 }); }); }
          else { const rr = 1.6 + r2 * 2.2; add(x, y, (sx, sy) => mushroom(l, sx, sy, rr, seed)); }
          break;
        }
        case B.sink: {
          if (!ok || sinkK(x, y) < 1.08 || !accept(6.5)) break;
          if (r1 < 0.55) add(x, y, (sx, sy, lv) => treeFern(l, sx, sy, 3, 5.5, seed, lv));
          else { const rr = 4.5 + r2 * 2; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 3, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, ramps('tawa', P.tawa)[seed & 7], lv, seed, 2); }); }
          break;
        }
        case B.hills: {
          if (!ok) break;
          if (r0 < 0.22) add(x, y, (sx, sy) => tussock(l, sx, sy, 0.5 + r1 * 0.8, seed, P.tuss));
          else if (r0 < 0.24) { const rr = 1.5 + r1 * 2.5; add(x, y, (sx, sy, lv) => boulder(l, sx, sy, rr, P.granite, seed, lv)); }
          else if (r0 < 0.255 && gully) { const rr = 2.4 + r1 * 1.2; add(x, y, (sx, sy, lv) => shrub(l, sx, sy, rr, MANUKA, seed, lv)); }
          break;
        }
        case B.plain: case B.gorge: {
          if (!ok) break;
          if (r0 < 0.07) add(x, y, (sx, sy) => tussock(l, sx, sy, 0.5 + r1 * 0.6, seed, b === B.gorge ? P.tuss : SPINIFEX));
          else if (r0 < 0.085) { const rr = 1.4 + r1 * 1.6; add(x, y, (sx, sy, lv) => boulder(l, sx, sy, rr, P.granite, seed, lv)); }
          else if (r0 < 0.1 && pt > 0.45) { const rr = 2.2 + r1 * 1.4; add(x, y, (sx, sy, lv) => shrub(l, sx, sy, rr, MANUKA, seed, lv)); }
          break;
        }
        case B.thermal: {
          if (!ok) break;
          if (r0 < 0.012) { const th = 6 + Math.floor(r1 * 5); add(x, y, (sx, sy) => snag(l, sx, sy, th, seed)); }
          else if (r0 < 0.03 && pt < 0.5) { const rr = 2 + r1 * 1.2; add(x, y, (sx, sy, lv) => shrub(l, sx, sy, rr, MANUKA, seed, lv)); }
          break;
        }
        case B.garden: break;
        case B.terraces: {
          if (!ok) break;
          if (r0 < 0.05) { const rr = 4 + r1 * 2; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 3, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, ramps('tawa', P.tawa)[seed & 7], lv, seed, 2); }); }
          else if (r0 < 0.12) add(x, y, (sx, sy) => tussock(l, sx, sy, 0.6, seed, P.grass));
          break;
        }
        case B.meadow: case B.scrub: default: {
          if (!ok) break;
          // the open country is a mosaic: groves, mānuka scrub, grass
          const gv = noise2(x * 0.0085, y * 0.0085, 541) * 0.7 + noise2(x * 0.02, y * 0.02, 542) * 0.3;
          if (gv > 0.62) {
            if (!accept(7.4)) break;
            if (r1 < 0.12) { const th = 6 + Math.floor(r2 * 5); add(x, y, (sx, sy, lv) => cabbageTree(l, sx, sy, th, seed, lv)); break; }
            const rr = 4.4 + r2 * 2.2, sp = r1 < 0.2 ? 'kowhai' as const : speciesAt(x, y, r2);
            add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 3, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, sp === 'kowhai' ? P.kowhai : ramps(sp, P[sp])[seed & 7], lv, seed, 2, { lift: 0.04 }); });
            break;
          }
          if (gv > 0.53) {
            if (!accept(5.2)) break;
            const rr = 2.2 + r2 * 1.4; add(x, y, (sx, sy, lv) => shrub(l, sx, sy, rr, MANUKA, seed, lv, r1 < 0.25 ? hex('#f4f2e8') : undefined));
            break;
          }
          // scrubland in patches, lone trees, cabbage trees and flax near water
          const scrub = clamp((pt - 0.35) * 3);
          if (r0 < 0.03 + scrub * 0.12) { const rr = 2.2 + r1 * 1.6; add(x, y, (sx, sy, lv) => shrub(l, sx, sy, rr, MANUKA, seed, lv, r2 < 0.3 ? hex('#f4f2e8') : undefined)); }
          else if (r0 < 0.036 + scrub * 0.13) { const rr = 4.5 + r1 * 2; add(x, y, (sx, sy, lv) => { trunk(l, sx, sy, 3, P.trunk, 1); crown(l, sx, sy - 2 - rr * 0.8, rr, ramps('tawa', P.tawa)[seed & 7], lv, seed, 2, { lift: 0.05 }); }); }
          else if (r0 < 0.042 + scrub * 0.13 && gully) add(x, y, (sx, sy) => flax(l, sx, sy, seed, 1));
          else if (r0 < 0.046 + scrub * 0.13) { const th = 6 + Math.floor(r1 * 5); add(x, y, (sx, sy, lv) => cabbageTree(l, sx, sy, th, seed, lv)); }
          else if (r0 < 0.07 + scrub * 0.13) add(x, y, (sx, sy) => tussock(l, sx, sy, 0.4 + r1 * 0.5, seed, P.grass));
          break;
        }
      }
    }
  }
  // flax and ferns crowding the riverbanks
  for (let gy = 2; gy < H - 2; gy += 5) for (let gx = 2; gx < W - 2; gx += 5) {
    const x = gx + Math.floor(hash2(gx, gy, 511) * 5), y = gy + Math.floor(hash2(gx, gy, 512) * 5);
    const i = at(x, y);
    if (i < 0 || !dry(i) || rd[i] > 9 || rd[i] < 3) continue;
    const r0 = hash2(gx, gy, 513);
    if (r0 > 0.4) continue;
    const seed = (gx * 9176) ^ (gy * 31337);
    const b = bio[i];
    if (b === B.hills || b === B.mountain && hgt[i] > 132 || b === B.thermal || b === B.beach) continue;
    if (r0 < 0.22) add(x, y, (sx, sy) => flax(l, sx, sy, seed, 0.9));
    else add(x, y, (sx, sy, lv) => treeFern(l, sx, sy, 2, 4, seed, lv));
  }
  // tors on the hilltops
  for (let gy = 6; gy < H - 6; gy += 18) for (let gx = 6; gx < W - 6; gx += 18) {
    const x = gx + Math.floor(hash2(gx, gy, 521) * 18), y = gy + Math.floor(hash2(gx, gy, 522) * 18);
    const i = at(x, y);
    if (i < 0 || !dry(i)) continue;
    const b = bio[i];
    if (b !== B.hills && !(b === B.mountain && hgt[i] > 120 && hgt[i] < 200)) continue;
    const hc = hgt[i];
    let top = true;
    for (let k = 0; k < 8 && top; k++) { const j = at(x + Math.cos(k * 0.785) * 14, y + Math.sin(k * 0.785) * 14); if (j >= 0 && hgt[j] > hc + 0.5) top = false; }
    if (!top || hash2(gx, gy, 523) > (b === B.hills ? 0.9 : 0.35)) continue;
    const seed = gx * 131 + gy * 977, size = hash2(gx, gy, 524);
    add(x, y, (sx, sy, lv) => tor(l, sx, sy, seed, lv, size));
  }
  void noise2; void slice;
}

/** a kauri: a pale massive trunk standing out of the canopy, a crown of flat-topped clumps */
function kauri(l: Layer, x: number, y: number, r: number, seed: number, light: number) {
  const th = Math.round(r * 0.9 + 4);
  trunk(l, x, y, th, P.bark, 3);
  // big limbs reaching out under the crown
  for (const dir of [-1, 1]) for (let t = 1; t <= Math.round(r * 0.5); t++) l.px(x + dir * t, y - th + 1 - Math.round(t * 0.5), P.bark[3 - (dir > 0 ? 1 : 0)], th);
  crown(l, x, y - th - r * 0.45, r, ramps('kauri', P.kauri)[seed & 7], light, seed, th, { flat: true, clumps: 8, squash: 0.7, spread: 1.15, lift: 0.04 });
}

/** a pōhutukawa: a broad spreading crown in red bloom on the sunny side */
function pohutukawa(l: Layer, x: number, y: number, r: number, seed: number, light: number) {
  const lean = (hash2(seed, 4, 601) - 0.5) * 0.6;
  trunk(l, x, y, 3, P.trunk, 2, lean);
  crown(l, Math.round(x + lean * 3), y - 3 - r * 0.6, r, P.pohu, light, seed, 3, { squash: 0.66, spread: 1.2, clumps: 8, bloom: P.bloom, bloomK: 0.3 });
}

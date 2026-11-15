// V12 Te Rua Pōuri, the features of the way down (each its own irregular silhouette, shaded and
// hand-detailed, nothing built from bare shapes): the water wall (a sheet of wet flowstone down a
// shaft, with two bosses to rest on), scree heaps at the foot of every step, the cracked hanging slabs
// of the loose roofs, the scree ramp up the back wall of the scree hall, the giant crystal blades of
// the deepest chamber and mud-caked rocks on the mud slope.

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import { Rng, bayer, clamp, hash2, noise1, noise2 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import type { FloorMat } from '../../../game/v12/cave/layout';
import { FP } from './floor';
import { paintBoulder } from './rock';

const H = (s: string) => hex(s);
const S = (b: PixelBuffer, ax: number, ay: number): Sprite => ({ buf: b, ax, ay } as Sprite);
const pk = (ramp: C[], v: number, x: number, y: number, k = 0.9) => ramp[clamp(Math.floor(v + (bayer(x, y) - 0.5) * k + 0.5), 0, ramp.length - 1)];
const INK = H('#07060a');
const WETHI = H('#b8d2dc');

/**
 * The water wall: wet flowstone poured down the shaft's face from the lip of the shore, in lobes and
 * flutes like candle wax, banded cream and rust, glistening wet streaks running down it, a drip off
 * every lobe. `knobs`: rows (from its top) of the two bosses where a climber can rest.
 * Anchored at its top right (it hangs off the face to the left of the anchor).
 */
export function paintFlowWall(seed: number, w: number, h: number, knobs: number[]): Sprite {
  const W = w + 18, b = new PixelBuffer(W, h + 8);
  const r = new Rng(seed);
  const bulge = (y: number) => knobs.reduce((m, k) => Math.max(m, Math.max(0, 1 - Math.abs(y - k) / 10) ** 1.4 * 10), 0);
  // its outer edge (left): lobes like wax run down a candle, flaring out over the lip at the top; its
  // inner edge (right) where it grows out of the wall, ragged too
  const outer = (y: number) => {
    const lobes = Math.pow(Math.abs(Math.sin(y * 0.05 + seed)), 0.7) * 11 + (noise1(y / 9, seed) - 0.5) * 8 + (noise1(y / 3.4, seed + 1) - 0.5) * 2.5;
    return W - 4 - (w * 0.4 + lobes + bulge(y) + (y < 16 ? (16 - y) * 0.9 : 0));
  };
  // (the inner edge sinks back into the rock in a ragged, shadowed seam)
  const inner = (y: number) => W - 1 - Math.max(0, (noise1(y / 6, seed + 9) - 0.3) * 10) - Math.max(0, (noise1(y / 2.2, seed + 10) - 0.6) * 5);
  const wet = (c: C, k: number) => mix(c, FP.wet[2], k);
  for (let y = 0; y < h; y++) {
    const ex = outer(y), ix = inner(y);
    for (let x = Math.floor(ex); x < ix; x++) {
      const u = (x - ex) / Math.max(1, ix - ex); // 0 at its outer edge .. 1 at the wall
      // flutes running down it, each lit on its left with a dark groove between
      const fl = Math.sin(x * 1.05 + noise1(y / 14, seed + 2) * 2.5 + y * 0.02);
      const band = Math.floor((y + noise1(x / 6, seed + 3) * 10) / 8) % 4;
      let l = 5 - u * 2.8 - (u > 0.82 ? 1.6 : 0) + fl * 1.1 + (fl < -0.85 ? -1.2 : 0) + (band === 0 ? 0.6 : band === 2 ? -0.6 : 0) + (u < 0.1 ? 1.4 : 0);
      for (const k of knobs) { const dy = y - k; if (Math.abs(dy) < 10 && u < 0.75) l += dy < -3 ? 1.4 : dy > 4 ? -1.8 : 0.5; }
      let c = pk(FP.flow, l, x, y);
      if (band === 3 && u > 0.3) c = mix(c, FP.rust[2], 0.3);
      b.set(x, y, wet(c, 0.18 + u * 0.3));
    }
    b.set(Math.floor(ex), y, mix(FP.flow[8], WETHI, 0.4));
  }
  // wet streaks running down it (they glint), and drips hanging off the lobes
  for (let i = 0; i < 11; i++) {
    const x = Math.round(W - 4 - r.range(2, w * 0.8)), y0 = r.int(0, h * 0.7), len = r.int(18, 60);
    for (let y = y0; y < Math.min(h - 1, y0 + len); y++) if (b.get(x, y) && (y + i) % 6 !== 0) b.set(x, y, mix(b.get(x, y), WETHI, 0.55));
  }
  for (let y = 8; y < h - 4; y++) {
    const a = outer(y), c = outer(y + 1);
    if (c > a + 1.2) { const x = Math.floor(a) + 1; b.set(x, y + 1, H('#9ab8c4')); b.set(x, y + 2, H('#5a7a8a')); y += 6; }
  }
  // the foot: it spreads over the floor in a low lobed apron, a pale wet rim on its top
  const foot0 = Math.floor(outer(h - 1)) - 9;
  for (let x = foot0; x < W - 2; x++) {
    const t = (x - foot0) / Math.max(1, W - 2 - foot0);
    const ht = Math.round(1 + t * 3 + Math.abs(Math.sin(x * 0.45 + seed)) * 2 + (noise1(x / 2.5, seed + 4) - 0.5) * 2);
    for (let y = h - ht; y < h + 2; y++) {
      if (y < 0 || b.get(x, y) !== 0 && y < h - 1) continue;
      const top = y === h - ht;
      b.set(x, y, top ? mix(FP.flow[7], WETHI, 0.3) : wet(pk(FP.flow, 4.4 - (y - h + ht) * 0.6, x, y), 0.25));
    }
  }
  b.outline(INK);
  return S(b, W - 6, 0);
}

/**
 * A heap of scree at the foot of a step: a lumpy pile of broken stones, each its own tone, lit on its
 * top left, packed with grit; `mat` tints it for where it lies (mud-caked, crystal chips, guano-crusted).
 * Anchored at the middle of its foot.
 */
export function paintRubble(seed: number, w: number, h: number, mat: FloorMat = 'rubble'): Sprite {
  const W = w + 4, Hh = h + 4;
  const b = new PixelBuffer(W, Hh);
  const r = new Rng(seed);
  const ramp = mat === 'mud' ? FP.mud : mat === 'guano' ? FP.guano : mat === 'flow' || mat === 'rim' || mat === 'moon' ? FP.calc : FP.peb;
  // stones dropped onto a pile: big ones low and to the front, small ones high on the heap; each a
  // lumpy flattened lump with its own tone (drawn back to front: the low ones overlap the high ones)
  interface St { x: number; y: number; rx: number; ry: number; t: number; ph: number }
  const st: St[] = [];
  const n = Math.round(w * h / 10) + 3;
  for (let i = 0; i < n; i++) {
    const lvl = Math.pow(r.next(), 1.6); // 0 at the foot .. 1 at the crest
    const span = (w / 2) * (1 - lvl * 0.78);
    const rx = r.range(1.6, 3.4) * (1.25 - lvl * 0.5), ry = rx * r.range(0.55, 0.8);
    st.push({ x: W / 2 + r.range(-span, span), y: Hh - 1 - ry - lvl * (h - ry * 1.2), rx, ry, t: r.range(-1.6, 1.6), ph: r.range(0, 6) });
  }
  st.sort((a, c) => a.y - c.y);
  const owner = new Int16Array(W * Hh).fill(-1);
  for (let si = 0; si < st.length; si++) {
    const s = st[si];
    for (let y = Math.floor(s.y - s.ry - 1); y <= Math.ceil(s.y + s.ry + 1); y++) for (let x = Math.floor(s.x - s.rx - 1); x <= Math.ceil(s.x + s.rx + 1); x++) {
      if (x < 0 || x >= W || y < 0 || y >= Hh) continue;
      const dx = (x + 0.5 - s.x) / s.rx, dy = (y + 0.5 - s.y) / s.ry;
      const ang = Math.atan2(dy, dx), lump = 1 + Math.sin(ang * 3 + s.ph) * 0.14 + Math.sin(ang * 5 + s.ph * 2) * 0.07;
      const q = (dx * dx + dy * dy) / (lump * lump);
      if (q > 1) continue;
      owner[y * W + x] = si;
      let l = ramp.length * 0.5 + s.t - dx * 1.1 - dy * 1.5 + (q > 0.72 ? -1.2 : 0);
      if (dy < -0.55 && q < 0.7) l += 0.9;
      let c = pk(ramp, l, x, y, 0.6);
      if (mat === 'crystal' && hash2(x, y, seed) > 0.9) c = FP.crys[5];
      if (mat === 'mud' && dy < -0.3 && hash2(x, y, seed + 1) > 0.6) c = pk(FP.mud, 5 - dy * 2, x, y, 0.5);
      if (mat === 'guano' && hash2(x, y, seed + 2) > 0.94) c = FP.fleck[1];
      b.set(x, y, c);
    }
  }
  // dark seams where stones meet
  for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
    const o = owner[y * W + x];
    if (o < 0) continue;
    const up = owner[(y - 1) * W + x], lf = owner[y * W + x - 1];
    if ((up >= 0 && up !== o && st[up].y < st[o].y) || (lf >= 0 && lf !== o && hash2(x, y, seed + 3) > 0.4)) b.set(x, y, pk(ramp, 0.6, x, y, 0.4));
  }
  b.outline(INK);
  return S(b, Math.round(W / 2), Hh - 1);
}

/**
 * The cracked roof of a loose stretch: a slab sagging out of the roof, split across by a dark crack,
 * wedges broken out of its underside, a rust stain where water gets in. Anchored at its top middle.
 */
export function paintLooseRoof(seed: number, w: number, h: number): Sprite {
  const b = new PixelBuffer(w + 4, h + 4);
  const cx = (w + 4) / 2;
  const botAt = (x: number) => {
    const u = (x + 0.5 - cx) / (w / 2);
    if (Math.abs(u) >= 1) return -1;
    return 2 + h * Math.pow(1 - u * u, 0.6) + (noise1(x / 3, seed) - 0.5) * 4 - (hash2(Math.floor(x / 4), 0, seed) > 0.7 ? 2 : 0);
  };
  const crackA = (x: number) => h * 0.45 + Math.sin(x * 0.35 + seed) * 2 + (noise1(x / 2, seed + 1) - 0.5) * 2;
  for (let x = 0; x < w + 4; x++) {
    const bot = botAt(x);
    if (bot < 0) continue;
    for (let y = 0; y < bot; y++) {
      const ca = crackA(x);
      const below = y > ca;
      let l = 4.2 - y * 0.08 + (noise2(x / 5, y / 4, seed + 2) - 0.5) * 1.6 + (below ? -0.6 : 0.4) + (bayer(x, y) - 0.5) * 0.5;
      if (Math.abs(y - ca) < 0.8) l = 0.4;
      else if (y > bot - 1.5) l += 1.4; // the lit lower lip of the slab
      else if (y < ca && y > ca - 1.6) l -= 0.8;
      // a vertical joint through the lower half (the wedge that will go first)
      if (below && Math.abs(x - cx - Math.sin(y * 0.5) * 1.2 - (seed % 7) + 3) < 0.6) l = 0.6;
      let c = pk(FP.slab, l + 2.5, x, y, 0.5);
      if (noise2(x / 6, y / 8, seed + 3) > 0.7 && y < ca) c = mix(c, FP.rust[2], 0.4);
      b.set(x, y, c);
    }
  }
  b.outline(INK);
  return S(b, Math.round(cx), 0);
}

/**
 * The scree ramp up the back wall of the scree hall (its walk line `pts`): stones and grit heaped
 * against the wall, lumpy along the top, the slope's foot spread in a fan, darker down into the dark.
 * Returns where its buffer sits in the world.
 */
export function paintScreeRamp(pts: [number, number][], seed: number, floor?: (x: number) => number): { buf: PixelBuffer; x0: number; y0: number } {
  const x0 = Math.floor(pts[0][0]) - 10, x1 = Math.ceil(pts[pts.length - 1][0]) + 4;
  const yAt = (x: number) => {
    if (x <= pts[0][0]) return pts[0][1] + (pts[0][0] - x) * 0.6;
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t; }
    return pts[pts.length - 1][1];
  };
  let ymin = 1e9, ymax = -1e9;
  for (let x = x0; x <= x1; x++) { ymin = Math.min(ymin, yAt(x)); ymax = Math.max(ymax, yAt(x)); }
  const y0 = Math.floor(ymin) - 4, Hh = Math.ceil(ymax - ymin) + 54;
  const b = new PixelBuffer(x1 - x0, Hh);
  for (let x = x0; x < x1; x++) {
    const top = yAt(x) - 1 - Math.max(0, noise1(x / 3.2, seed) - 0.55) * 4 + (noise1(x / 9, seed + 1) - 0.5) * 1.2;
    const thick = 18 + (noise1(x / 21, seed + 2) - 0.5) * 12 + (x < pts[0][0] + 20 ? (pts[0][0] + 20 - x) * 0.6 : 0);
    const yMax = floor ? floor(x) - 1 : 1e9;
    for (let y = Math.floor(top); y < Math.min(yMax, top + thick + 20); y++) {
      const by = y - y0;
      if (by < 0 || by >= Hh) continue;
      const d = y - top;
      if (d > thick && hash2(x, y, seed) > 1 - (d - thick) / 20) continue;
      // stones: small near the top of the heap, bigger further down where they roll to (jittered rows,
      // each stone lit on its top left, a dark seam under it)
      const sz = 4 + d * 0.1;
      const row = Math.floor((y + noise1(x / 7, seed + 5) * 2) / (sz * 0.62));
      const off = hash2(row, 0, seed + 6) * sz;
      const gx = Math.floor((x + off + noise1(y / 4, seed + 3) * 2) / sz);
      const hh = hash2(gx, row, seed + 4);
      const fx = ((x + off) / sz) - gx, fy = ((y + noise1(x / 7, seed + 5) * 2) / (sz * 0.62)) - row;
      let l = 5 - d * 0.1 + (hh - 0.5) * 3 + (fx < 0.25 ? 0.9 : fx > 0.8 ? -1.1 : 0) + (fy < 0.28 ? 0.9 : fy > 0.78 ? -1.6 : 0);
      if (fx > 0.9 || fy > 0.88) l = 0.8;
      if (d < 1.2) l += 1.2;
      let c = pk(hh > 0.8 ? FP.pebW : FP.peb, hh > 0.8 ? l - 1.6 : l, x, y, 0.6);
      if (hh > 0.93) c = pk(FP.slab, l + 2, x, y, 0.5);
      // far back: the whole heap dimmed and cooled a little
      b.set(x - x0, by, mix(c, H('#0e0e14'), 0.22));
    }
  }
  b.outline(mix(INK, H('#101018'), 0.5));
  return { buf: b, x0, y0 };
}

/**
 * A giant crystal of the deepest chamber: two or three hexagonal blades taller than a man leaning out
 * of a heel of broken rock, each with a lit face, a mid face and a dark face, a bright ridge, ghost
 * phantoms inside, fracture lines and a pointed termination. Returns its glowing pixels too.
 */
export function paintGiantCrystal(seed: number, hgt: number, tint: string): Sprite & { glow: [number, number][] } {
  const r = new Rng(seed);
  const w = Math.round(hgt * 0.7) + 16, h = hgt + 12;
  const b = new PixelBuffer(w, h);
  const glow: [number, number][] = [];
  const g = hex(tint);
  const ramp = [shade(g, -0.78), shade(g, -0.6), shade(g, -0.4), shade(g, -0.18), g, mix(g, H('#ffffff'), 0.4), mix(g, H('#ffffff'), 0.75)];
  const base = h - 5;
  // the heel of rock it grows out of: a broken mound, chipped, lit on its top left
  for (let x = 2; x < w - 2; x++) {
    const u = (x - w / 2) / (w / 2 - 2);
    const hh = Math.round((1 - Math.pow(Math.abs(u), 1.6)) * 9 + (noise1(x / 3.5, seed) - 0.5) * 5 - (hash2(Math.floor(x / 4), 2, seed) > 0.75 ? 2 : 0));
    if (hh < 1) continue;
    for (let y = base - hh + 4; y < h; y++) {
      const d = y - (base - hh + 4);
      b.set(x, y, pk(FP.slab, 5.2 - d * 0.35 - u * 1.2 + (noise1(x / 2, seed + 1) - 0.5) * 2 + (d === 0 ? 1.6 : 0), x, y, 0.6));
    }
  }
  const n = 2 + r.int(0, 1);
  const blades = Array.from({ length: n }, (_, i) => ({
    len: hgt * (i === 0 ? 1 : r.range(0.45, 0.75)),
    ang: -Math.PI / 2 + (i === 0 ? r.range(-0.12, 0.12) : (i % 2 ? 1 : -1) * r.range(0.3, 0.6)),
    bw: (i === 0 ? hgt * 0.11 : hgt * r.range(0.06, 0.09)) + 2,
    sx: w / 2 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * r.range(3, w * 0.18)),
  })).sort((a, c) => a.len - c.len);
  // the smaller blades behind, the big one in front
  for (const bl of blades) {
    const dx = Math.cos(bl.ang), dy = Math.sin(bl.ang);
    const tipLen = bl.bw * 1.9;
    for (let s = 0; s < bl.len; s += 0.5) {
      const half = s > bl.len - tipLen ? bl.bw * (bl.len - s) / tipLen : bl.bw;
      for (let q = -half; q <= half; q += 0.5) {
        const x = Math.round(bl.sx + dx * s - dy * q), y = Math.round(base + dy * s + dx * q);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const u = q / Math.max(0.5, bl.bw);
        // three faces: lit (left), mid, dark (right), the termination's facets brighter
        let face = u < -0.38 ? 5 : u < 0.22 ? 3.6 : 1.6;
        if (s > bl.len - tipLen) face += u < 0 ? 0.9 : 0.3;
        // a ridge between the faces, phantoms (ghost tips) inside, fractures across
        if (Math.abs(u + 0.38) < 0.06 || Math.abs(u - 0.22) < 0.05) face = 6;
        const ph = Math.abs(((s + 0.5 * Math.abs(u) * bl.bw) % 17) - 8.5) < 0.6 && s < bl.len - tipLen && s > 6;
        if (ph) face -= 1.2;
        if (Math.abs(noise2(s / 9, q / 3, seed + bl.len) - 0.5) < 0.02) face -= 1.6;
        if (s < 3) face -= 2;
        // growth striations along the blade, a few inclusions, a milky root, a clearer tip
        if (Math.abs(((q * 1.7 + noise1(s / 11, seed + 7) * 2) % 3 + 3) % 3 - 1.5) < 0.22 && face < 6) face -= 0.7;
        if (hash2(x, y, seed + 3) > 0.985) face -= 1.5;
        face += (noise2(s / 7, q / 2, seed + 8) - 0.5) * 1.2;
        let c = ramp[clamp(Math.round(face + (bayer(x, y) - 0.5) * 0.7), 0, ramp.length - 1)];
        if (s < bl.len * 0.22) c = mix(c, H('#d8dce4'), 0.35 * (1 - s / (bl.len * 0.22)));
        b.set(x, y, c);
        if (face >= 3.4 && s > 4 && hash2(x, y, seed) > 0.55) glow.push([x, y]);
      }
    }
  }
  b.outline(H('#05060a'));
  return Object.assign(S(b, Math.round(w / 2), h - 1), { glow });
}

/** a rock sunk in the mud slope, caked in mud over its top and running in drips down its sides */
export function paintMudRock(seed: number, w: number, h: number): Sprite {
  const s = paintBoulder(seed, w, h);
  const b = s.buf;
  for (let x = 0; x < b.w; x++) {
    let top = -1;
    for (let y = 0; y < b.h; y++) if (b.get(x, y) !== 0) { top = y; break; }
    if (top < 0) continue;
    const coat = 3 + Math.round(noise1(x / 2.5, seed) * 4) + (hash2(x, 0, seed) > 0.8 ? 4 : 0);
    for (let y = top; y < Math.min(b.h, top + coat); y++) {
      if (b.get(x, y) === 0) continue;
      const l = 4.4 - (y - top) * 0.5 + (y === top + 1 ? 2.4 : 0) + (hash2(x, y, seed + 1) > 0.9 ? 1.5 : 0);
      b.set(x, y, pk(FP.mud, l, x, y, 0.6));
    }
    // the lower half: a skin of wet mud darkening the stone
    for (let y = top + coat; y < b.h; y++) if (b.get(x, y) !== 0 && b.get(x, y) !== INK) b.set(x, y, mix(b.get(x, y), FP.mud[2], 0.45));
  }
  return s;
}

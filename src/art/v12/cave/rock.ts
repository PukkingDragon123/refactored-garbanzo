// V12 Te Rua Pōuri, the deep dark cave: the rock. The cave is painted as a section through the
// headland: the passages (their far walls dim and cool, wet streaks down them, darker toward the rock),
// and the rock between them cut in limestone beds (wavy bedding planes, joints breaking each bed into
// blocks, each block catching the light on its top-left lip and shadowed under, calcite veins, grit),
// lit where it meets the open (a pale lip on every floor, a dark dripping underside on every roof) and
// falling away into black a few hand-widths into the rock. Every tone steps through a hand-picked ramp
// with ordered dithering between steps: no smooth gradients.
//
// Props (each its own irregular silhouette, shaded and hand-detailed): stalactites, stalagmites,
// flowstone curtains, crystal clusters, glowing fungi, rock shelves for the wet pitch, boulders, the
// lost caver's camp, the old ladder, the plank bridge, the lure pole.

import { PixelBuffer } from '../../pixel';
import { hex, mix, shade } from '../../color';
import type { C } from '../../color';
import { Rng, bayer, clamp, hash2, noise1, noise2 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';

const H = (s: string) => hex(s);
/** the limestone, dark to pale (cool shadows, warm lights) */
export const LIME = ['#060508', '#0e0c11', '#17141a', '#211d24', '#2d282e', '#3a3439', '#4a4246', '#5c5356', '#706664', '#867b74', '#a09485', '#bcb09c'].map(H);
/** the far walls of the passages: colder, lower */
const BACK = ['#050507', '#09090d', '#0f0f15', '#16161d', '#1e1d25', '#26252e', '#302e37', '#3b3841', '#47434b'].map(H);
const MUD = ['#2a2018', '#3e3022', '#56422e', '#6e5a40', '#8a7458'].map(H);
const WET = H('#7a8c96');

export interface CaveHole { x0: number; x1: number; top: (x: number) => number; bot: (x: number) => number }

const pick = (ramp: C[], t: number, x: number, y: number) => ramp[clamp(Math.floor(t * (ramp.length - 1) + bayer(x, y) - 0.25), 0, ramp.length - 1)];

/**
 * One chunk of the cave (world x0, y0, w x h). `null` when it is all deep rock (nothing to see).
 * The walk lines are exact: the rock under a floor starts on the line itself.
 */
export function paintCaveRock(x0: number, y0: number, w: number, h: number, holes: CaveHole[], seed: number): PixelBuffer | null {
  const M = 44; // margin read around the chunk (distances reach across chunk edges)
  const W = w + M * 2, Hh = h + M * 2;
  const open = new Uint8Array(W * Hh);
  // per hole: per column its roof and floor, per row a wobble for its side walls
  let any = false;
  for (let hi = 0; hi < holes.length; hi++) {
    const hl = holes[hi];
    const ax = Math.max(0, Math.floor(hl.x0 - 14 - (x0 - M))), bx = Math.min(W - 1, Math.ceil(hl.x1 + 14 - (x0 - M)));
    if (ax > bx) continue;
    const jl = new Float32Array(Hh), jr = new Float32Array(Hh);
    for (let j = 0; j < Hh; j++) {
      const wy = y0 - M + j;
      jl[j] = (noise1(wy / 11, seed + hi * 7) - 0.5) * 16 + (noise1(wy / 3.1, seed + hi * 7 + 1) - 0.5) * 4;
      jr[j] = (noise1(wy / 13, seed + hi * 7 + 2) - 0.5) * 16 + (noise1(wy / 2.9, seed + hi * 7 + 3) - 0.5) * 4;
    }
    for (let i = ax; i <= bx; i++) {
      const wx = x0 - M + i;
      const top = hl.top(wx), bot = hl.bot(wx);
      // the roof: ragged, with little teeth hanging (the big stalactites are props)
      const tooth = Math.max(0, noise1(wx / 4.3, seed + hi) - 0.62) * 22 + (noise1(wx / 17, seed + hi + 5) - 0.5) * 5;
      const j0 = Math.max(0, Math.floor(top + tooth - (y0 - M))), j1 = Math.min(Hh - 1, Math.floor(bot - (y0 - M)));
      for (let j = j0; j <= j1; j++) {
        if (wx < hl.x0 + jl[j] || wx > hl.x1 - jr[j]) continue;
        open[j * W + i] = 1;
        any = true;
      }
    }
  }
  if (!any) return null;
  // distance (chamfer, capped) from every rock pixel to the open, and from every open pixel to the rock
  const CAP = 60;
  const dist = new Uint8Array(W * Hh).fill(CAP);
  const dOpen = new Uint8Array(W * Hh).fill(CAP);
  for (let k = 0; k < W * Hh; k++) { if (open[k]) dist[k] = 0; else dOpen[k] = 0; }
  const pass = (d: Uint8Array) => {
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      let v = d[k];
      if (!v) continue;
      if (i > 0) v = Math.min(v, d[k - 1] + 2);
      if (j > 0) { v = Math.min(v, d[k - W] + 2); if (i > 0) v = Math.min(v, d[k - W - 1] + 3); if (i < W - 1) v = Math.min(v, d[k - W + 1] + 3); }
      d[k] = v;
    }
    for (let j = Hh - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i;
      let v = d[k];
      if (!v) continue;
      if (i < W - 1) v = Math.min(v, d[k + 1] + 2);
      if (j < Hh - 1) { v = Math.min(v, d[k + W] + 2); if (i < W - 1) v = Math.min(v, d[k + W + 1] + 3); if (i > 0) v = Math.min(v, d[k + W - 1] + 3); }
      d[k] = v;
    }
  };
  pass(dist); pass(dOpen);
  // is there anything near enough to the open to paint?
  let near = false;
  for (let j = M; j < M + h && !near; j += 2) for (let i = M; i < M + w; i += 2) if (dist[j * W + i] < CAP) { near = true; break; }
  if (!near) return null;

  const b = new PixelBuffer(w, h);
  const D = b.data;
  for (let j = 0; j < h; j++) {
    const J = j + M, wy = y0 + j;
    for (let i = 0; i < w; i++) {
      const I = i + M, k = J * W + I, wx = x0 + i;
      const d = dist[k] / 2; // in pixels
      if (open[k]) {
        // ---- the far wall of the passage
        const dd = dOpen[k] / 2;
        let t = 0.46 + stone(wx, wy, seed, 0.55);
        // wet streaks running down
        const streak = noise1(wx / 2.3, seed + 40);
        if (streak > 0.78 && noise1(wy / 40 + wx, seed + 41) > 0.4) t += 0.12;
        // darker in toward the middle of a big space, a soft lip of light near the rock it meets
        t -= Math.min(0.32, dd * 0.012);
        if (dd < 2.5) t += 0.08;
        const c = pick(BACK, clamp(t), wx, wy);
        D[j * w + i] = streak > 0.9 && t > 0.5 ? mix(c, WET, 0.18) : c;
        continue;
      }
      if (d >= 29) { D[j * w + i] = (hash2(wx, wy, seed) > 0.985) ? LIME[1] : LIME[0]; continue; }
      // ---- the rock in section: beds, joints, blocks
      let t = 0.58 + stone(wx, wy, seed, 1);
      // falling away into the dark (stepped, dithered)
      t -= d * 0.026 + Math.max(0, d - 12) * 0.012;
      // where it meets the open: what faces it
      const up1 = open[k - W], up2 = open[k - 2 * W], up3 = open[k - 3 * W];
      const dn1 = open[k + W], dn2 = open[k + 2 * W];
      const lf = open[k - 1] || open[k - 2], rt = open[k + 1] || open[k + 2];
      let c: C;
      if (up1) {
        // the lip of a floor: worn pale, mud and grit on it
        const mud = noise1(wx / 14, seed + 50) > 0.55;
        c = mud ? MUD[clamp(3 + Math.round(noise1(wx / 3, seed + 51) - 0.3), 0, 4)] : LIME[10 + (hash2(wx, wy, seed + 3) > 0.7 ? 1 : 0)];
      } else if (up2) {
        c = noise1(wx / 14, seed + 50) > 0.55 ? MUD[2] : LIME[8];
      } else if (up3) {
        c = pick(LIME, clamp(t + 0.06), wx, wy);
      } else if (dn1) {
        // the underside of a roof: dark, dripping
        c = hash2(wx, 7, seed + 9) > 0.8 ? LIME[5] : LIME[2];
      } else if (dn2) {
        c = LIME[3];
      } else {
        if (lf || rt) t += 0.1;
        c = pick(LIME, clamp(t), wx, wy);
      }
      D[j * w + i] = c;
    }
  }
  return b;
}

/** limestone texture at a world pixel: bedding, joints, block bevels, veins, grit (about -0.3 .. +0.3) */
function stone(wx: number, wy: number, seed: number, amp: number): number {
  // bedding: wavy planes of uneven thickness, the crack between beds broken in places (beds fuse)
  const by = wy + (noise1(wx / 43, seed + 1) - 0.5) * 14 + (noise1(wx / 10, seed + 2) - 0.5) * 2.6;
  const bh = 13 + (noise1(wx / 90, seed + 11) - 0.5) * 6;
  const bed = Math.floor(by / bh), fy = by - bed * bh;
  const open = noise1(wx / 19 + bed * 3.7, seed + 3) > 0.34;
  let t = (noise1(wx / 64 + bed * 5.3, seed + 5) - 0.5) * 0.16; // each bed its own tone, drifting
  // fractures: wandering lines through the beds (contours of a stretched noise), lit on one side
  const n = noise2(wx / 15, wy / 8, seed + 4);
  const crack = Math.abs(n - 0.5) < 0.016;
  if ((fy < 1 && open) || crack) t -= 0.34;
  else {
    if (fy < 2.4 && open) t += 0.13; // the lip of the bed under the crack catches the light
    if (fy > bh - 2.2) t -= 0.06;
    if (n > 0.5 && n < 0.54) t += 0.06;
  }
  // solution pockets: little scalloped hollows worn by water
  const pk = noise2(wx / 7, wy / 6, seed + 12);
  if (pk > 0.74) t -= (pk - 0.74) * 1.4;
  else if (pk > 0.7) t += 0.05;
  // calcite veins
  const v = noise2(wx / 26, wy / 26, seed + 8);
  if (v > 0.495 && v < 0.505) t += 0.22;
  // big soft variation and grit
  t += (noise2(wx / 70, wy / 55, seed + 9) - 0.5) * 0.24;
  const g = hash2(wx, wy, seed + 10);
  if (g > 0.95) t += 0.1; else if (g < 0.04) t -= 0.12;
  return t * amp;
}

// ================================================================== props
const S = (b: PixelBuffer, ax: number, ay: number): Sprite => ({ buf: b, ax, ay } as Sprite);
const STONE = ['#100e12', '#1e1a1f', '#2e292c', '#423a3b', '#584e4c', '#706460', '#8a7d74', '#a8998a', '#c4b6a2', '#ddd0ba'].map(H);
const FLOW = ['#2a1a10', '#4a3020', '#6e4a30', '#946a44', '#b88e5e', '#d4ae7c', '#ecd2a4', '#fbecd0'].map(H);

/** a stalactite hanging from (ax, 0): a lumpy tapering cone, wet, ringed, a drip at the tip */
export function paintStalactite(seed: number, len: number, wid: number): Sprite {
  const r = new Rng(seed);
  const w = Math.ceil(wid * 1.6) + 8, h = len + 4;
  const b = new PixelBuffer(w, h);
  const cx = w / 2 + r.range(-1, 1);
  const lean = r.range(-0.1, 0.1);
  const ramp = r.chance(0.4) ? FLOW : STONE;
  // a soda straw tip on some: a thin tube hanging out of the cone
  const straw = r.chance(0.4) ? Math.round(len * r.range(0.12, 0.25)) : 0;
  const body = len - straw;
  for (let y = 0; y < len; y++) {
    const t = Math.min(1, y / Math.max(1, body));
    // the root flares into the roof; the cone narrows in lumps (drapery rings), each edge its own
    let half = (wid / 2) * Math.pow(1 - t, 0.8) * (1 + Math.sin(y * 0.55 + seed) * 0.12) + (t < 0.15 ? (0.15 - t) * wid * 1.6 : 0);
    if (y >= body) half = 0.6;
    const hl = half * (1 + (noise1(y / 4.5, seed + 2) - 0.5) * 0.7), hr = half * (1 + (noise1(y / 5.2, seed + 3) - 0.5) * 0.7);
    const mx = cx + lean * y + (noise1(y / 9, seed + 1) - 0.5) * 2;
    for (let x = Math.floor(mx - hl - 0.5); x <= Math.ceil(mx + hr + 0.5); x++) {
      const fx = x + 0.5 - mx;
      const u = fx < 0 ? fx / Math.max(0.6, hl) : fx / Math.max(0.6, hr);
      if (Math.abs(u) > 1) continue;
      let l = 0.6 - u * 0.42 - t * 0.1 + (Math.sin(y * 0.55 + seed) > 0.7 ? 0.12 : 0) + (bayer(x, y) - 0.5) * 0.2;
      if (Math.abs(u) > 0.8) l -= 0.18;
      if (y >= body) l = 0.75;
      b.set(x, y, ramp[clamp(Math.round(l * (ramp.length - 1)), 0, ramp.length - 1)]);
    }
  }
  // the wet shine down the lit side, and a drip at the tip
  for (let y = 2; y < body - 2; y += 1) if (noise1(y / 4, seed + 3) > 0.45) b.set(Math.round(cx + lean * y - wid * 0.2 * (1 - y / body)), y, mix(ramp[ramp.length - 1], WET, 0.3));
  b.set(Math.round(cx + lean * len), len, H('#a8c4d0'));
  b.set(Math.round(cx + lean * len), len + 1, H('#6a8a9a'));
  b.outline(H('#07060a'));
  return S(b, Math.round(cx), 0);
}

/** a stalagmite growing up to (ax, ay): a lumpy column, broad at its foot where it spreads over the
 *  floor, a rounded wet top with a splash cup, growth rings like a stack of melted candles */
export function paintStalagmite(seed: number, hgt: number, wid: number): Sprite {
  const r = new Rng(seed);
  const w = Math.ceil(wid * 1.8) + 8, h = hgt + 2;
  const b = new PixelBuffer(w, h);
  const cx = w / 2 + r.range(-1, 1), ramp = r.chance(0.5) ? FLOW : STONE;
  const lean = r.range(-0.08, 0.08);
  for (let y = 0; y < hgt; y++) {
    const t = y / Math.max(1, hgt - 1); // 0 at the top, 1 at the foot
    let half = (wid / 2) * (0.3 + 0.7 * Math.pow(t, 0.7)) * (1 + Math.sin(y * 0.42 + seed) * 0.14) + (t > 0.82 ? (t - 0.82) * wid * 2.2 : 0);
    // the rounded top
    if (y < 3) half *= [0.45, 0.75, 0.9][y];
    const hl = half * (1 + (noise1(y / 5, seed + 2) - 0.5) * 0.6), hr = half * (1 + (noise1(y / 4.4, seed + 3) - 0.5) * 0.6);
    const mx = cx + lean * (hgt - y) + (noise1(y / 10, seed + 1) - 0.5) * 2;
    for (let x = Math.floor(mx - hl - 0.5); x <= Math.ceil(mx + hr + 0.5); x++) {
      const fx = x + 0.5 - mx;
      const u = fx < 0 ? fx / Math.max(0.6, hl) : fx / Math.max(0.6, hr);
      if (Math.abs(u) > 1) continue;
      // growth rings: bands that sag at the edges like melted wax
      const ring = Math.sin((y + u * u * 3) * 0.55 + seed);
      let l = 0.58 - u * 0.4 + (1 - t) * 0.12 + (ring > 0.75 ? 0.13 : ring < -0.85 ? -0.1 : 0) + (bayer(x, y) - 0.5) * 0.2;
      if (Math.abs(u) > 0.82) l -= 0.18;
      b.set(x, y, ramp[clamp(Math.round(l * (ramp.length - 1)), 0, ramp.length - 1)]);
    }
  }
  // the splash cup and its wet shine
  const tx = Math.round(cx + lean * hgt);
  b.set(tx, 0, ramp[ramp.length - 1]);
  b.set(tx, 1, H('#2a2a30'));
  b.set(tx - 1, 1, ramp[ramp.length - 2]);
  b.outline(H('#07060a'));
  return S(b, Math.round(cx), hgt - 1);
}

/** a flowstone curtain down a wall: folds like a drape, banded cream and rust, translucent lit edges */
export function paintCurtain(seed: number, w: number, hgt: number): Sprite {
  const b = new PixelBuffer(w + 2, hgt + 2);
  for (let x = 0; x < w; x++) {
    const fold = Math.sin(x * 0.55 + noise1(x / 5, seed) * 3);
    const len = hgt * (0.55 + 0.45 * noise1(x / 6, seed + 1)) * (1 - Math.pow(Math.abs(x / w - 0.5) * 2, 3) * 0.6);
    for (let y = 0; y < len; y++) {
      const band = Math.floor((y + noise1(x / 8, seed + 2) * 6) / 5) % 3;
      let l = 0.5 + fold * 0.28 + (band === 0 ? 0.14 : band === 2 ? -0.08 : 0) + (y > len - 3 ? 0.2 : 0) + (bayer(x, y) - 0.5) * 0.2;
      if (fold < -0.8) l -= 0.15;
      b.set(x + 1, y, FLOW[clamp(Math.round(l * (FLOW.length - 1)), 0, FLOW.length - 1)]);
    }
  }
  b.outline(H('#0a0806'));
  return S(b, Math.round(w / 2) + 1, 0);
}

/** a cluster of cave crystals (calcite and something that glows), standing out of a broken rock heel;
 *  returns the glowing pixels (sprite-local) for the light pass too */
export function paintCrystals(seed: number, size: number, tint = '#7ae8ff'): Sprite & { glow: [number, number][] } {
  const r = new Rng(seed);
  const w = Math.round(size * 1.6) + 8, h = Math.round(size * 1.2) + 6;
  const b = new PixelBuffer(w, h);
  const glow: [number, number][] = [];
  const base = h - 3;
  const g = hex(tint);
  const ramp = [shade(g, -0.7), shade(g, -0.5), shade(g, -0.28), g, mix(g, H('#ffffff'), 0.45), mix(g, H('#ffffff'), 0.8)];
  // the rock heel
  for (let x = 2; x < w - 2; x++) {
    const hh = 3 + Math.round(noise1(x / 3, seed) * 3);
    for (let y = base - hh + 3; y < h; y++) b.set(x, y, STONE[clamp(2 + Math.round((noise1(x / 2, seed + 1) - 0.4) * 3) + (y === base - hh + 3 ? 2 : 0), 0, 9)]);
  }
  // the blades: hexagonal prisms, each a lit face, a dark face, a bright ridge and a pointed tip
  const n = 4 + r.int(0, 3);
  for (let i = 0; i < n; i++) {
    const len = size * r.range(0.45, 1.05), ang = -Math.PI / 2 + r.range(-0.75, 0.75), bw = r.range(1.6, 3.2);
    const sx = w / 2 + r.range(-size * 0.45, size * 0.45), sy = base;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let s = 0; s < len; s++) {
      const half = s > len - bw * 1.6 ? bw * (len - s) / (bw * 1.6) : bw;
      for (let q = -half; q <= half; q += 0.5) {
        const x = Math.round(sx + dx * s - dy * q), y = Math.round(sy + dy * s + dx * q);
        const face = q < -0.3 ? 4 : q > 0.6 ? 1 : 3;
        const c = ramp[clamp(face + (s > len * 0.7 ? 1 : 0) - (s < 2 ? 2 : 0), 0, 5)];
        b.set(x, y, c);
        if (face >= 3 && s > len * 0.3 && hash2(x, y, seed) > 0.6) glow.push([x, y]);
      }
    }
  }
  b.outline(H('#06070a'));
  return Object.assign(S(b, Math.round(w / 2), h - 1), { glow });
}

/** a cluster of glowing ghost fungi on a rotten root: pale caps with gills, the glowing pixels listed */
export function paintFungi(seed: number, n: number): Sprite & { glow: [number, number][] } {
  const r = new Rng(seed);
  const w = 26 + n * 4, h = 22;
  const b = new PixelBuffer(w, h);
  const glow: [number, number][] = [];
  // ghost fungus: caps nearly white, a cold green-blue in their shade and gills (where they glow)
  const cap = ['#24343a', '#3e5a5c', '#6e9a92', '#a8d4c4', '#d8f2e6', '#f6fff8'].map(H);
  const stem = ['#46504c', '#7a8680', '#b4beb6', '#dfe6dc'].map(H);
  // the root they grow on: a twisted dark knuckle
  for (let x = 1; x < w - 1; x++) {
    const y0 = h - 3 - Math.round(noise1(x / 5, seed) * 2);
    for (let y = y0; y < h; y++) b.set(x, y, [H('#1a120c'), H('#2c1e14'), H('#3e2a1a')][clamp(Math.round(1 + (noise1(x / 2, seed + 2) - 0.5) * 2 - (y - y0) * 0.4), 0, 2)]);
  }
  for (let i = 0; i < n; i++) {
    const cx = 4 + r.range(0, w - 8), ch = r.range(5, 13), cw = r.range(3, 6.5), tilt = r.range(-0.25, 0.25);
    const top = h - 3 - ch;
    // stem
    for (let y = top + 1; y < h - 2; y++) { const x = Math.round(cx + tilt * (h - y)); b.set(x, y, stem[2]); b.set(x + 1, y, stem[1]); if (y % 3 === 0) b.set(x - 1, y, stem[3]); }
    // cap: a hand-shaped dome, not an ellipse: flattened top, a turned-down rim, gills under it
    const capX = cx + tilt * ch;
    for (let q = -cw; q <= cw; q++) {
      const u = q / cw;
      const hgt = Math.round((1 - u * u) * cw * 0.55 + (Math.abs(u) > 0.85 ? -0.5 : 0.6));
      for (let y = 0; y <= hgt; y++) {
        const x = Math.round(capX + q), yy = top - y + 1;
        const l = 3 + (u < -0.2 ? 1 : 0) + (y === hgt ? 1 : 0) - (u > 0.55 ? 1 : 0) - (y === 0 ? 1 : 0);
        b.set(x, yy, cap[clamp(l, 0, 5)]);
      }
      // the gills under the rim: the part that glows
      if (Math.abs(q) < cw - 0.5) { const x = Math.round(capX + q); b.set(x, top + 2, q % 2 ? hex('#5affc0') : hex('#2a9a7a')); glow.push([x, top + 2]); }
    }
  }
  b.outline(H('#07090a'));
  return Object.assign(S(b, Math.round(w / 2), h - 1), { glow });
}

/** a rock shelf jutting from the wall: thick, broken at its edge, wet on top (the wet pitch's ledges) */
export function paintShelf(seed: number, w: number, th: number): Sprite & { top: (x: number) => number } {
  const b = new PixelBuffer(w + 6, th + 14);
  const tops: number[] = [];
  for (let x = 0; x < w + 6; x++) {
    const edge = Math.min(x, w + 5 - x);
    const under = th + Math.round((noise1(x / 6, seed) - 0.5) * 8) - Math.max(0, 8 - edge) - (x > w - 10 ? (x - (w - 10)) * 0.6 : 0);
    const y0 = 2 + (edge < 3 ? 3 - edge : 0);
    tops.push(y0);
    for (let y = y0; y < under; y++) {
      const top = y - y0;
      let l = top === 0 ? 8 : top === 1 ? 7 : 5 - top * 0.08 + (noise1(x / 4, seed + y) - 0.5) * 1.6 + (bayer(x, y) - 0.5);
      if (y > under - 3) l -= 2;
      b.set(x, y, STONE[clamp(Math.round(l), 0, 9)]);
    }
    // the wet sheen on top and drips off the lip
    if (x % 3 === 0 && noise1(x / 5, seed + 4) > 0.5) b.set(x, y0, mix(STONE[9], WET, 0.4));
  }
  b.outline(H('#07060a'));
  return Object.assign(S(b, 3, 2), { top: (x: number) => tops[clamp(Math.round(x + 3), 0, tops.length - 1)] - 2 });
}

/** a boulder fallen from the roof: a chipped block of limestone, every broken face its own tone (lit
 *  from the top left), dark cracks where the faces meet, a bedding line across it, a flat heel */
export function paintBoulder(seed: number, w: number, hgt: number): Sprite {
  const b = new PixelBuffer(w + 4, hgt + 4);
  const r = new Rng(seed);
  // the faces: planes cut round a lopsided body (big flat ones and a few small chips)
  const n = 6 + r.int(0, 3);
  const faces = Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + r.range(-0.35, 0.35), k: r.range(0.66, 1), t: r.range(-0.12, 0.12) }));
  faces.push({ a: Math.PI / 2, k: 0.62, t: 0 }); // the flat heel it sits on
  const cx = (w + 4) / 2 + r.range(-2, 2), cy = hgt * 0.6 + 2;
  for (let y = 0; y < hgt + 4; y++) for (let x = 0; x < w + 4; x++) {
    const dx = (x + 0.5 - cx) / (w / 2), dy = (y + 0.5 - cy) / (hgt * 0.62);
    // the binding plane (and how close the next one is: a crack where two faces meet)
    let best = 1e9, second = 1e9, bf = faces[0];
    for (const f of faces) {
      const d = (dx * Math.cos(f.a) + dy * Math.sin(f.a)) / f.k;
      const m = 1 - d;
      if (m < best) { second = best; best = m; bf = f; } else if (m < second) second = m;
    }
    if (best < 0) continue;
    // each face lit by where it points, its own grain, a bedding line across the whole block
    // (the chipped faces round the rim; inside, the block's broad shoulder catching the light)
    const rim = best < 0.3;
    let l = (rim ? 0.52 - Math.cos(bf.a + 0.9) * 0.28 + bf.t : 0.6 - dx * 0.22 - dy * 0.3) + (noise2(x / 4, y / 4, seed) - 0.5) * 0.22 + (bayer(x, y) - 0.5) * 0.18;
    if (rim && second - best < 0.035) l -= 0.3;
    else if (best < 0.05) l -= 0.12;
    if (Math.abs(noise2(x / 9, y / 7, seed + 3) - 0.5) < 0.018) l -= 0.3;
    if (Math.abs(y - cy + 2 + Math.sin(x * 0.3 + seed) * 1.5) < 0.6 && best > 0.1) l -= 0.18;
    if (hash2(x, y, seed) > 0.96) l += 0.15;
    b.set(x, y, STONE[clamp(Math.round(l * 9), 0, 9)]);
  }
  b.outline(H('#07060a'));
  return S(b, Math.round(cx), hgt + 1);
}

/** a broken calcite column fallen in pieces, or bones: a little heap of the cave's leavings */
export function paintGuano(seed: number, w: number): Sprite {
  const b = new PixelBuffer(w, 10);
  for (let x = 0; x < w; x++) {
    const t = x / w, hh = Math.round(Math.sin(t * Math.PI) * 6 + (noise1(x / 2.5, seed) - 0.5) * 3);
    for (let y = 9 - hh; y < 10; y++) b.set(x, y, [H('#1e1610'), H('#32261a'), H('#4a3a28'), H('#6a5638')][clamp(Math.round(2 + (y === 9 - hh ? 1 : 0) - (y - (9 - hh)) * 0.3 + (hash2(x, y, seed) - 0.5)), 0, 3)]);
    if (hash2(x, 3, seed) > 0.8) b.set(x, 9 - hh, H('#c8b898'));
  }
  return S(b, Math.round(w / 2), 9);
}

// ------------------------------------------------------------------ the lost caver's camp
/** the camp: a collapsed canvas tent, a bedroll, a primus stove, a smashed lantern, a ration tin */
export function paintCamp(seed: number): Sprite {
  const w = 110, h = 52;
  const b = new PixelBuffer(w, h);
  const canvas = ['#2a2416', '#433a24', '#5e5434', '#7a6e48', '#968a60', '#b2a67a'].map(H);
  const rr = new Rng(seed);
  // the tent: one pole still up, the canvas sagging off it to the ground in folds, a rip
  const pole = 30;
  for (let y = 8; y < h - 2; y++) { b.set(pole, y, H('#4a3a28')); b.set(pole + 1, y, H('#2a2016')); }
  for (let x = 4; x < 84; x++) {
    const top = x < pole ? 8 + (pole - x) * 1.2 : 8 + (x - pole) * 0.62 + Math.sin(x * 0.35) * 2;
    for (let y = Math.round(top); y < h - 3; y++) {
      const fold = Math.sin(x * 0.42 + y * 0.08);
      let l = 3 + fold * 1.4 - (x < pole ? 1 : 0) + (y - top < 2 ? 1 : 0) + (bayer(x, y) - 0.5) * 0.8;
      if (x > 54 && x < 62 && y > top + 6 && y < top + 16) l = 0; // the rip, dark inside
      b.set(x, y, canvas[clamp(Math.round(l), 0, 5)]);
    }
  }
  // guy line
  for (let i = 0; i < 26; i++) b.set(pole - 2 - i, 9 + i * 1.4, H('#6a5a40'));
  // the bedroll, half out of the tent
  for (let x = 60; x < 96; x++) for (let y = h - 9; y < h - 3; y++) b.set(x, y, [H('#3a1e1a'), H('#5a2e26'), H('#7a4234'), H('#3a2a40')][(x + Math.floor(y / 2)) % 7 === 0 ? 3 : clamp(Math.round(1 + (y === h - 9 ? 1 : 0) + Math.sin(x * 0.5) * 0.6), 0, 2)]);
  // the primus stove: brass tank, burner, pot
  const sx = 98;
  for (let y = h - 10; y < h - 3; y++) for (let x = sx - 4; x <= sx + 4; x++) b.set(x, y, [H('#5a3a10'), H('#8a6020'), H('#c49a40'), H('#f0d080')][clamp(Math.round(2 - (x - sx) * 0.3 + (y === h - 10 ? 1 : 0)), 0, 3)]);
  for (let x = sx - 3; x <= sx + 3; x++) b.set(x, h - 12, H('#3a3a3a'));
  b.set(sx, h - 11, H('#2a2a2a'));
  for (let y = h - 18; y < h - 12; y++) for (let x = sx - 5; x <= sx + 5; x++) b.set(x, y, [H('#2a2c30'), H('#4a4c52'), H('#70747a')][clamp(Math.round(1 - (x - sx) * 0.2 + (y === h - 18 ? 1 : 0)), 0, 2)]);
  // scattered: a ration tin, a rope coil, spent matches
  for (let x = 12; x < 20; x++) for (let y = h - 7; y < h - 3; y++) b.set(x, y, [H('#5a5a50'), H('#8a8a7a'), H('#b4b4a0')][clamp(Math.round(1 + (y === h - 7 ? 1 : 0) - (x === 19 ? 1 : 0)), 0, 2)]);
  for (let a = 0; a < 18; a++) { const ang = a * 0.7; b.set(Math.round(44 + Math.cos(ang) * (3 + a * 0.2)), Math.round(h - 6 + Math.sin(ang) * (1 + a * 0.06)), a % 2 ? H('#a08458') : H('#6a5434')); }
  for (let i = 0; i < 5; i++) { const x = 22 + rr.int(0, 14); b.set(x, h - 3, H('#c8b080')); b.set(x + 1, h - 3, H('#1a1410')); }
  b.outline(H('#0a0806'));
  return S(b, Math.round(w / 2), h - 3);
}

/** the caver's journal: a swollen oilskin notebook with a pencil, lying open on a flat stone */
export function paintJournal(): Sprite {
  const b = new PixelBuffer(18, 10);
  for (let x = 1; x < 17; x++) for (let y = 6; y < 10; y++) b.set(x, y, STONE[clamp(4 + (y === 6 ? 2 : 0) - (x > 14 ? 1 : 0), 0, 9)]);
  for (let x = 3; x < 15; x++) for (let y = 2; y < 6; y++) b.set(x, y, x === 8 || x === 9 ? H('#7a6a50') : y === 2 ? H('#e8dcc0') : H('#cbbd9c'));
  for (let x = 4; x < 8; x++) if (x % 2 === 0) b.set(x, 4, H('#4a4030'));
  for (let x = 10; x < 14; x++) if (x % 2 === 1) b.set(x, 3, H('#4a4030'));
  b.set(12, 5, H('#4a4030'));
  for (let i = 0; i < 6; i++) b.set(13 + i * 0.5, 1 + i * 0.3, i === 0 ? H('#2a2a2a') : H('#c8a040'));
  b.outline(H('#0a0806'));
  return S(b, 9, 9);
}

/** the caver's pole: a length of old scaffold pipe driven into the shingle, a hook at the top */
export function paintPole(hgt: number): Sprite {
  const b = new PixelBuffer(10, hgt + 4);
  for (let y = 4; y < hgt + 3; y++) {
    b.set(4, y, H('#2e3236'));
    b.set(5, y, y % 9 === 0 ? H('#8a5a30') : H('#6a7076'));
    b.set(6, y, H('#3e4246'));
  }
  // rust blooms and the hook
  for (let y = 10; y < hgt; y += 7) b.set(5, y, H('#7a4a2a'));
  b.set(5, 3, H('#6a7076')); b.set(6, 2, H('#6a7076')); b.set(7, 2, H('#6a7076')); b.set(8, 3, H('#6a7076')); b.set(8, 4, H('#3e4246'));
  // stones packed round its foot
  for (let x = 1; x < 9; x++) b.set(x, hgt + 3, STONE[4 + (x % 3)]);
  b.outline(H('#07060a'));
  return S(b, 5, hgt + 3);
}

/** the old caver's ladder: two flat iron rails, rungs, rust, bolts into the rock (drawn whole) */
export function paintLadder(len: number): Sprite {
  const b = new PixelBuffer(13, len + 6);
  const iron = ['#1a1a1c', '#2e2e32', '#4a4a50', '#6a6a70', '#8a8a90'].map(H);
  const rust = ['#3a1e10', '#6a3418', '#8e4a22'].map(H);
  for (let y = 0; y < len + 6; y++) {
    for (const x of [1, 11]) {
      const ru = noise1(y / 6, x) > 0.6;
      b.set(x, y, ru ? rust[1] : iron[3]);
      b.set(x + 1, y, ru ? rust[0] : iron[1]);
    }
    if (y % 8 === 3) for (let x = 2; x < 11; x++) b.set(x, y, noise1(x + y, 9) > 0.65 ? rust[2] : iron[4 - (x > 8 ? 1 : 0)]);
    if (y % 8 === 4) for (let x = 2; x < 11; x++) b.set(x, y, iron[1]);
    // the bolts into the rock
    if (y % 40 === 10) { b.set(0, y, iron[4]); b.set(12, y, iron[4]); }
  }
  // the hooked top
  b.set(1, 0, iron[4]); b.set(11, 0, iron[4]);
  b.outline(H('#060608'));
  return S(b, 6, 0);
}

/** the caver's planks over the hole: three weathered boards, nails, one split */
export function paintPlanks(w: number): Sprite {
  const b = new PixelBuffer(w + 8, 8);
  const wood = ['#1e140c', '#3a2816', '#5a4024', '#7a5a36', '#9a7a50'].map(H);
  for (let x = 0; x < w + 8; x++) for (let y = 1; y < 6; y++) {
    const board = Math.floor((x + 3) / 18);
    let l = 2 + (y === 1 ? 2 : y === 5 ? -1 : 0) + Math.round((noise1(x / 3 + board * 9, 4) - 0.5) * 1.4);
    if ((x + 3) % 18 === 0) l = 0;
    if (board === 1 && x > 24 && x < 30 && y === 3) l = 0;
    b.set(x, y, wood[clamp(l, 0, 4)]);
  }
  for (let x = 3; x < w + 6; x += 18) { b.set(x, 2, H('#8a8a90')); b.set(x + 12, 4, H('#8a8a90')); }
  b.outline(H('#0a0806'));
  return S(b, 4, 1);
}

/** a rusted iron anchor bolt with a ring and the rope's knot (where a rope is tied off) */
export function paintAnchor(): Sprite {
  const b = new PixelBuffer(12, 10);
  const iron = ['#2a2a2e', '#4a4a50', '#7a7a80', '#a8a8ae'].map(H);
  b.set(2, 6, iron[1]); b.set(3, 6, iron[2]); b.set(4, 6, iron[3]); b.set(5, 6, iron[2]);
  for (const [x, y] of [[6, 4], [7, 3], [8, 3], [9, 4], [9, 5], [8, 6], [7, 6], [6, 5]] as const) b.set(x, y, y < 5 ? iron[3] : iron[1]);
  // the knot: a fat figure-of-eight of flax rope
  for (const [x, y, c] of [[7, 7, '#a8844c'], [8, 7, '#c8a46c'], [7, 8, '#7a5a30'], [8, 8, '#a8844c'], [6, 8, '#5a4020']] as const) b.set(x, y, H(c));
  b.outline(H('#060608'));
  return S(b, 7, 9);
}

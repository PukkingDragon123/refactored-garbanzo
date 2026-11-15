// V12 the night the Bearer comes to Te Kāinga: the village's defences and the marks the fight leaves.
//   barricade   a lashed chevaux-de-frise: sharpened mānuka stakes crossed in pairs, flax-rope
//               lashings, a sack of earth and a salvaged door panel at the foot; three states
//               (sound, cracked and leaning, smashed to stubs and splinters)
//   clawScar    the gouges Matikuku Nui leaves across the gateway's post (four ragged furrows with
//               splintered lips and pale torn wood inside)
//   resolvePlaque  the HUD object for its nerve: a carved bone tag on a cord with the great claw
//               inlaid and six notches cut along its edge that crack off as its nerve breaks
// All painted pixel by pixel in the village palette (src/art/v11/village/props.ts VP), lit from the
// upper left, outlined in the village ink.

import { PixelBuffer } from '../../pixel';
import { hex, shade } from '../../color';
import type { C } from '../../color';
import type { Sprite } from '../../jungle-core';
import { Rng, bayer, clamp } from '../../../core/math';
import { VP } from '../../v11/village/props';

const pick = (r: C[], v: number) => r[clamp(Math.round(v), 0, r.length - 1)];
const dpick = (r: C[], v: number, x: number, y: number) => pick(r, v + (bayer(x, y) - 0.5) * 0.9);
const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** one sharpened stake from (x0,y0) to (x1,y1) with bark, a whittled pale point and knots */
function stake(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r: number, seed: number, snapAt = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len * 1.4);
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  for (let i = 0; i <= n * snapAt; i++) {
    const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    // the point: the last 18% is whittled to a tip, pale fresh wood
    const tip = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
    const rr = Math.max(0.6, r * tip * (0.92 + Math.sin(t * 9 + seed) * 0.08));
    for (let k = -Math.ceil(rr); k <= Math.ceil(rr); k++) {
      if (Math.abs(k) > rr) continue;
      const X = Math.round(cx + nx * k), Y = Math.round(cy + ny * k);
      const side = k / Math.max(1, rr);
      const pale = t > 0.82;
      const knot = h01(Math.round(t * 40), seed, 3) > 0.93 && Math.abs(k) < rr * 0.5;
      const ramp = pale ? VP.thatch : VP.bark;
      let v = (pale ? 3.6 : 3.1) - side * 1.6 - (Math.sin(t * 60 + seed) > 0.8 ? 0.7 : 0);
      if (knot) v -= 1.6;
      b.set(X, Y, dpick(ramp, v, X, Y));
    }
  }
  // a ragged snapped end
  if (snapAt < 1) {
    const t = snapAt, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    for (let k = -r - 1; k <= r + 1; k++) {
      const X = Math.round(cx + nx * k + (x1 - x0) / len * (h01(k, seed, 9) * 3)), Y = Math.round(cy + ny * k + (y1 - y0) / len * (h01(k, seed, 9) * 3));
      b.set(X, Y, VP.thatch[4 - (Math.abs(k) & 1)]);
    }
  }
}

/** a flax-rope lashing wound round a crossing */
function lashing(b: PixelBuffer, cx: number, cy: number, seed: number) {
  for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) {
    const X = cx + i + (j === 0 ? 0 : j), Y = cy + j * 2 + Math.round(i * 0.6);
    if (h01(i, j, seed) < 0.15) continue;
    b.set(X, Y, (i + j) & 1 ? VP.raupo[3] : VP.raupo[1]);
  }
  b.set(cx + 4, cy + 3, VP.raupo[2]); b.set(cx + 5, cy + 4, VP.raupo[1]); b.set(cx + 5, cy + 5, VP.raupo[2]);
}

/** a hessian sack of earth slumped at the foot */
function sack(b: PixelBuffer, x: number, base: number, w: number, seed: number) {
  const h = Math.round(w * 0.62);
  for (let y = 0; y < h; y++) {
    const k = y / h, half = w / 2 * (0.62 + Math.sin(k * Math.PI * 0.95) * 0.42) + (h01(y, 1, seed) - 0.5);
    for (let xx = -half; xx <= half; xx++) {
      const X = Math.round(x + xx), Y = base - h + y;
      const weave = ((X + Y) & 1) && h01(X, Y, seed) > 0.6 ? -0.5 : 0;
      const fold = Math.sin(xx * 0.9 + y * 0.4 + seed) > 0.75 ? -0.8 : 0;
      b.set(X, Y, dpick(VP.raupo, 3.3 - (xx / half) * 0.9 - k * 0.5 + weave + fold, X, Y));
    }
  }
  // the tied neck
  for (let i = -2; i <= 1; i++) b.set(x + i, base - h - 1, VP.raupo[2]);
  b.set(x - 1, base - h - 2, VP.raupo[3]); b.set(x + 1, base - h - 3, VP.raupo[2]);
}

/**
 * A lashed barricade across the lane. state 0 sound, 1 cracked and leaning, 2 smashed to stubs.
 * About 64 x 48; anchored at the bottom centre.
 */
export function barricade(seed: number, state: 0 | 1 | 2): Sprite {
  const W = 72, H = 56, base = H - 2, b = new PixelBuffer(W, H), rng = new Rng(seed * 31 + 7);
  const lean = state === 1 ? 5 : 0;
  // a salvaged door panel behind (slabs, a rusted hinge), skipped when smashed
  if (state < 2) {
    const px0 = 18, pw = 34, ptop = base - 30 + (state ? 3 : 0);
    for (let x = 0; x < pw; x++) for (let y = ptop; y <= base - 4; y++) {
      const slab = Math.floor(x / 6), gap = x % 6 === 5;
      const crack = state === 1 && Math.abs(x - 17 - (y - ptop) * 0.3) < 0.8;
      const X = px0 + x + Math.round((base - y) * lean / 40), Y = y;
      b.set(X, Y, gap || crack ? VP.wood[0] : dpick(VP.wood, 2.6 + (slab % 2) * 0.4 - x / pw * 0.8 + (Math.sin(y * 0.8 + slab * 3) > 0.85 ? -0.7 : 0), X, Y));
    }
    for (let y = ptop + 3; y < ptop + 7; y++) b.set(px0 + 2 + Math.round((base - y) * lean / 40), y, VP.rust[3]);
  }
  // the crossed pairs of stakes, points out toward the east (the backcountry)
  const pairs = [10, 34, 58];
  pairs.forEach((cx, i) => {
    const s = seed + i * 13;
    if (state === 2) {
      // snapped stubs and a stake lying in the dirt
      stake(b, cx - 8, base, cx + 2 + rng.range(-2, 2), base - 22, 2.1, s, 0.5 + rng.next() * 0.2);
      stake(b, cx + 8, base, cx - 1, base - 18, 2, s + 1, 0.45 + rng.next() * 0.2);
      if (i === 1) stake(b, cx - 26, base - 1, cx + 14, base - 4, 1.8, s + 2);
      return;
    }
    const tilt = state === 1 && i === 2 ? 9 : lean;
    stake(b, cx - 10, base, cx + 9 + tilt, base - 40, 2.2, s, state === 1 && i === 2 ? 0.82 : 1);
    stake(b, cx + 10, base, cx - 7 + tilt, base - 42, 2.1, s + 1);
    lashing(b, cx + Math.round(tilt * 0.5), base - 20, s);
  });
  // the long rail that ties the pairs together (snapped in two when cracked)
  const railY = base - 25;
  for (let x = 4; x < W - 4; x++) {
    if (state === 2) break;
    if (state === 1 && x > 44 && x < 48) continue;
    const y = railY + Math.round(Math.sin(x * 0.12) * 0.8) + (state === 1 && x >= 48 ? Math.round((x - 48) * 0.25) : 0) - Math.round((x / W) * lean * 0.3);
    for (let k = 0; k < 3; k++) b.set(x, y + k, dpick(VP.bark, 3.4 - k * 0.9 + (h01(x, k, seed) > 0.9 ? -1 : 0), x, y + k));
  }
  // sacks of earth, and splinters strewn when it has been hit
  sack(b, 14, base + 1, 14, seed + 4);
  if (state < 2) sack(b, 52, base + 1, 12, seed + 5);
  if (state > 0) for (let i = 0; i < (state === 2 ? 26 : 10); i++) {
    const x = Math.round(rng.range(4, W - 4)), y = base - Math.round(rng.range(0, state === 2 ? 3 : 2));
    const L = 2 + rng.int(0, 3), dx = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < L; k++) b.set(x + k * dx, y - (k >> 1), k ? VP.thatch[3] : VP.thatch[4]);
  }
  b.outline(VP.ink);
  return { buf: b, ax: W >> 1, ay: base };
}

/** the four claw gouges across a carved post, about 28 x 40 (drawn over the gateway after the raid) */
export function clawScar(seed: number): Sprite {
  const W = 30, H = 42, b = new PixelBuffer(W, H);
  for (let g = 0; g < 4; g++) {
    const x0 = 4 + g * 6 + (h01(g, 0, seed) - 0.5) * 2, y0 = 2 + g * 2, x1 = x0 + 7 + h01(g, 1, seed) * 3, y1 = H - 6 - (3 - g) * 2;
    const n = Math.ceil(y1 - y0);
    for (let i = 0; i <= n; i++) {
      const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      const w = 2.3 * Math.sin(Math.PI * Math.min(1, t * 1.12)) + 0.5;
      for (let k = -3; k <= 3; k++) {
        const X = Math.round(cx + k), Y = Math.round(cy);
        if (Math.abs(k) > w + 1) continue;
        // dark depth in the middle, torn pale wood inside, splintered lips on each side
        const c = Math.abs(k) <= w * 0.45 ? (h01(X, Y, seed + 1) > 0.8 ? VP.wood[1] : VP.wood[0]) : Math.abs(k) <= w ? (k < 0 ? VP.thatch[4] : VP.thatch[1]) : (h01(X, Y, seed) > 0.5 ? (k < 0 ? VP.thatch[5] : VP.wood[2]) : 0);
        if (c) b.set(X, Y, c);
      }
    }
  }
  return { buf: b, ax: W >> 1, ay: H - 1 };
}

/**
 * The Bearer's resolve as an object: a carved bone tag on a flax cord, the great claw inlaid in dark
 * wood, six notches along the bottom edge. `k` is its nerve left (0..1): notches crack and fall dark as
 * it drops. `hit` (0..1) flashes the tag's rim warm. About 76 x 30 art px.
 */
export function resolvePlaque(k: number, hit = 0): PixelBuffer {
  const W = 78, H = 32, b = new PixelBuffer(W, H);
  const bone = [hex('#3a2c1e'), hex('#6a5640'), hex('#9a8466'), hex('#c4b08c'), hex('#e2d2ac'), hex('#f4e8c8')];
  const inlay = [hex('#140a06'), hex('#2a160c'), hex('#44261a'), hex('#5e3826')];
  const top = 7, bot = H - 4;
  // the cord: two strands through a drilled hole, out of frame at the top
  for (let y = 0; y < top + 3; y++) { b.set(37 + (y & 1), y, VP.raupo[2]); b.set(40 - (y & 1), y, VP.raupo[3]); }
  // the tag: an irregular rounded slab, thicker at the left (an old jaw bone, worked flat)
  for (let y = top; y <= bot; y++) {
    const v = (y - top) / (bot - top);
    const inset = Math.round(Math.abs(v - 0.45) ** 2 * 10 + (h01(y, 7, 3) > 0.8 ? 1 : 0));
    // an old jaw bone worked flat: thick at the left, tapering to the right, a chip out of the corner
    const taper = Math.round(Math.abs(v - 0.4) * 9);
    const chip = v > 0.62 && v < 0.86 ? Math.round(4 - Math.abs(v - 0.74) * 30) : 0;
    const x0 = 3 + inset, x1 = W - 4 - inset - taper - Math.max(0, chip);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      let t = 3.6 - v * 1.4 - u * 0.5 + (x === x0 || y === top ? 1 : 0) - (x === x1 || y === bot ? 1.4 : 0);
      if (h01(x, y, 11) > 0.92) t -= 0.8; // pores
      if (Math.sin(x * 0.35 + y * 0.9) > 0.94) t -= 0.6; // growth lines
      b.set(x, y, dpick(bone, t, x, y));
    }
  }
  // the hole for the cord
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b.set(38 + dx, top + 2 + dy, inlay[0]);
  b.set(37, top + 2, bone[1]); b.set(40, top + 3, bone[4]);
  // the great claw inlaid along the tag: a long hook, darkest at the base, a pale worn edge
  const cl = (t: number): [number, number] => [10 + t * 50, top + 13 - Math.sin(t * Math.PI * 0.85) * 7 + t * t * 9];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, [cx, cy] = cl(t);
    // the knuckle swells at the base, the keratin narrows to a hooked point
    const r = 4.6 * (1 - t) ** 0.75 + 0.5 + (t < 0.12 ? Math.sin(t / 0.12 * Math.PI) * 1.4 : 0);
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      if (Math.abs(dy) > r) continue;
      const X = Math.round(cx), Y = Math.round(cy + dy);
      const ridge = dy <= -r + 1.2, belly = dy >= r - 1;
      const groove = Math.abs(dy + r * 0.2) < 0.5 && t > 0.15 && t < 0.8;
      b.set(X, Y, ridge ? inlay[3] : belly ? inlay[0] : groove ? inlay[0] : t > 0.75 ? inlay[2] : inlay[1]);
    }
  }
  // a worn pale glint along the ridge
  for (let i = 30; i < 80; i += 9) { const [cx, cy] = cl(i / 120); const r = 4.6 * (1 - i / 120) ** 0.75 + 0.5; b.set(Math.round(cx), Math.round(cy - r + 1), bone[4]); }
  // the six notches: cut along the bottom edge, lit amber while its nerve holds
  const live = Math.ceil(clamp(k) * 6 - 1e-6);
  for (let n = 0; n < 6; n++) {
    const x = 14 + n * 9, y = bot - 5;
    const on = n < live;
    const amber = [hex('#5a1a0c'), hex('#a8401c'), hex('#e88a2c'), hex('#ffd27a')];
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      if (dx + dy < 1 || (4 - dx) + dy < 1) continue;
      const X = x + dx, Y = y + dy;
      if (on) b.set(X, Y, amber[dy === 0 ? 3 : dy < 2 ? 2 : dy < 4 ? 1 : 0]);
      else {
        // a cracked-off notch: a jagged dark gap with a pale broken edge
        const gone = dy > 1 || h01(X, Y, n) > 0.4;
        b.set(X, Y, gone ? inlay[1] : bone[4]);
      }
    }
    if (!on) { b.set(x + 2, y - 1, inlay[2]); b.set(x + 3, y - 2, inlay[2]); }
  }
  b.outline(hit > 0.05 ? shade(hex('#ffcf7a'), -0.2 * (1 - hit)) : VP.ink);
  return b;
}

/** the cut stakes waiting to be lashed: a criss-crossed pile of sharpened mānuka poles, a coil of flax rope */
export function stakePile(seed: number): Sprite {
  const W = 52, H = 22, base = H - 2, b = new PixelBuffer(W, H), rng = new Rng(seed * 7 + 3);
  for (let i = 0; i < 7; i++) {
    const y = base - 1 - Math.floor(i / 2) * 3 - rng.int(0, 1);
    const x0 = 2 + rng.int(0, 6), x1 = W - 3 - rng.int(0, 8);
    const tilt = rng.range(-2.5, 2.5);
    if (i % 2) stake(b, x1, y + tilt * 0.3, x0, y - tilt, 1.6, seed + i);
    else stake(b, x0, y - tilt * 0.3, x1, y + tilt, 1.6, seed + i);
  }
  // the coil of rope on top at the left
  for (let a = 0; a < 3; a++) for (let t = 0; t < 26; t++) {
    const ang = (t / 26) * Math.PI * 2, rx = 6 - a, ry = 2.4 - a * 0.5;
    const X = Math.round(10 + Math.cos(ang) * rx), Y = Math.round(base - 9 + Math.sin(ang) * ry - a);
    b.set(X, Y, (t + a) % 3 ? VP.raupo[3] : VP.raupo[1]);
  }
  b.set(16, base - 8, VP.raupo[2]); b.set(17, base - 7, VP.raupo[2]); b.set(18, base - 6, VP.raupo[3]);
  b.outline(VP.ink);
  return { buf: b, ax: W >> 1, ay: base };
}

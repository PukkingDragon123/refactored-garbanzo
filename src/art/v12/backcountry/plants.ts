// V12 Te Tuawhenua, the trees and plants of the open country, painted pixel by pixel:
//   kānuka and mānuka   several thin, sinuous stems from one foot, bark peeling in long papery strips,
//                       twiggy limbs, a feathery crown of tiny grey-green leaves in lumpy clumps,
//                       mānuka spangled with white (or pink) five-petal flowers
//   charred trunks      the burnt ridge's dead standing trees: alligator-checked charcoal with a silver
//                       sheen on each block, patches where the bark fell away to sun-silvered wood, a
//                       fire scar hollowed into the foot, broken limbs, a splintered top (or running up
//                       out of the frame); stumps the same, short and split
//   fireweed, bracken   the regrowth: magenta flower spikes on red stems, bracken's ladder fronds
// Any trunk can carry the Bearer's claw marks (clawScore in ./signs.ts). Lit from the upper left; a
// dark ink edge on the lower right. Anchors: bottom centre.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { Rng, hash2, noise1 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { tube, crown, outlineSel, trimSprite } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { TP, pick, vor, VO } from './kit';
import { clawScore } from './signs';

const set = (b: PixelBuffer, x: number, y: number, c: C) => { if (c) b.set(Math.floor(x), Math.floor(y), c); };

// ---------------------------------------------------------------- kānuka / mānuka
export interface KanukaOpts { flower?: 'white' | 'pink' | null; claw?: boolean; lean?: number }
export function paintKanuka(seed: number, h: number, o: KanukaOpts = {}): Sprite {
  const rng = new Rng(seed * 61 + 17);
  const W = Math.round(h * 1.05 + 24), H = h + 10;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const lean = o.lean ?? rng.range(-0.18, 0.18);
  // papery bark: long vertical strips, some lifting pale at their edges
  const bark = (x: number, y: number) => {
    const s = hash2(Math.floor(x), Math.floor(y / 4), seed);
    return s < 0.22 ? 1.3 : s > 0.86 ? -1.1 : hash2(Math.floor(x), Math.floor(y / 9), seed + 1) < 0.12 ? 0.7 : 0;
  };
  const n = rng.int(3, 5);
  const tips: P[] = [];
  const stems: P[][] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * 2 - 1;
    const pts: P[] = [];
    const sh = h * rng.range(0.52, 0.72) * (1 - Math.abs(s) * 0.18);
    const out = s * rng.range(0.16, 0.3) + lean;
    const wig = rng.range(2, 5), ph = rng.range(0, 6);
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push([cx + s * 2 + out * sh * t + Math.sin(t * 5 + ph) * wig * t, gy - sh * t]);
    }
    // (a marked tree has one big old stem: the Bearer chose it)
    const r0 = Math.max(1.4, h * 0.02 * (1 - Math.abs(s) * 0.3)) * (o.claw && i === Math.floor(n / 2) ? 2.3 : 1);
    tube(b, pts, t => r0 * (1 - t * 0.55) + (t < 0.06 ? (0.06 - t) * 14 : 0), TP.kbark, 5, { texture: bark, spread: 2.2 });
    stems.push(pts);
    tips.push(pts[12]);
    // twiggy limbs off the upper stem, up and out
    for (let j = 0; j < 3; j++) {
      const at = pts[rng.int(6, 11)];
      const side = rng.sign();
      const L = h * rng.range(0.1, 0.22);
      const a = -Math.PI / 2 + side * rng.range(0.4, 1);
      const lp: P[] = [];
      for (let k = 0; k <= 5; k++) { const t = k / 5; lp.push([at[0] + Math.cos(a) * L * t + Math.sin(t * 3) * 1, at[1] + Math.sin(a) * L * t]); }
      tube(b, lp, t => Math.max(0.6, r0 * 0.45 * (1 - t)), TP.kbark, 5, { spread: 1.6 });
      tips.push(lp[5]);
    }
  }
  // peeling strips hanging off the stems
  for (let k = 0; k < Math.round(h / 14); k++) {
    const st = stems[rng.int(0, stems.length - 1)];
    const [sx, sy] = st[rng.int(1, 7)];
    const L = rng.range(3, 7), side = rng.sign();
    for (let j = 0; j < L; j++) set(b, sx + side * (1 + j * 0.25), sy + j, pick(TP.kpaper, 4 - j * 0.4 + (side < 0 ? 1 : 0)));
  }
  // the bearer's scoring on the biggest stem
  if (o.claw) clawScore(b, stems[Math.floor(n / 2)], gy, h, seed, TP.kbark);
  // the crown: feathery clumps at the limb tips, flat-ish underneath
  const topY = Math.min(...tips.map(t => t[1]));
  // (kānuka grows in loose tiers of small feathery sprays: many little clumps with sky between them,
  // so the twiggy limbs show through, never one round ball)
  const clumps: { x: number; y: number; rx: number; ry: number }[] = [];
  for (const [x, y] of tips) {
    clumps.push({ x: x + rng.range(-3, 3), y: y + rng.range(-2, 3), rx: h * rng.range(0.08, 0.13), ry: h * rng.range(0.045, 0.07) });
    if (rng.chance(0.6)) clumps.push({ x: x + rng.sign() * h * rng.range(0.06, 0.12), y: y + h * rng.range(0.02, 0.07), rx: h * rng.range(0.06, 0.1), ry: h * rng.range(0.035, 0.055) });
  }
  clumps.push({ x: cx + lean * h * 0.6, y: topY - h * 0.03, rx: h * 0.12, ry: h * 0.06 });
  crown(b, rng, { cx: cx + lean * h * 0.5, cy: topY + h * 0.06, rx: h * 0.42, ry: h * 0.22, ramp: TP.kleaf, lo: 2, hi: 9, steps: 3, shape: 'point', len: [1, 3], wid: [1, 1], density: 0.95, droop: 0.4, jag: 0.75, flatBottom: 0.55, clumps, sparkle: 0.5 });
  // blossom on the lit side of the crown
  if (o.flower) {
    const ramp = o.flower === 'pink' ? TP.bloomPink : TP.bloom;
    for (let k = 0; k < Math.round(h * 0.7); k++) {
      const c = clumps[rng.int(0, clumps.length - 1)];
      const x = Math.round(c.x + rng.range(-c.rx, c.rx * 0.6)), y = Math.round(c.y + rng.range(-c.ry, c.ry * 0.5));
      if (!(b.get(x, y) >>> 24)) continue;
      set(b, x, y, ramp[4]); set(b, x - 1, y, ramp[3]); set(b, x + 1, y, ramp[2]); set(b, x, y - 1, ramp[3]); set(b, x, y + 1, ramp[1]);
      if (rng.chance(0.4)) set(b, x, y, pick(TP.lichenGold, 3));
    }
  }
  outlineSel(b, 0.5);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

// ---------------------------------------------------------------- the burnt ridge
/** alligator-checked charcoal: irregular blocks (taller than wide, staggered like real char) with dark
 *  cracks between them, each block bulging and lit on its upper left, a silver sheen on the best-lit */
function charTex(seed: number) {
  return (x: number, y: number) => {
    vor(x, y, 3.8, 5.4, seed);
    if (VO.e < 0.9) return -2;
    return (-VO.dx * 0.9 - VO.dy * 1.1) * 1.4 + (VO.id - 0.5) * 0.9 + (VO.e < 1.6 && VO.dy < 0 ? 0.7 : 0);
  };
}
export interface CharredOpts { broken?: boolean; claw?: boolean; limbs?: number; scar?: boolean }
/** a dead burnt tree standing: h is its height (make it taller than the frame to run out of it) */
export function paintCharredTrunk(seed: number, h: number, w: number, o: CharredOpts = {}): Sprite {
  const rng = new Rng(seed * 43 + 5);
  const W = Math.round(w * 3 + h * 0.3 + 20), H = h + 12;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const lean = rng.range(-0.06, 0.06);
  const pts: P[] = [];
  const wob = Math.min(w * 0.6, 6);
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([cx + lean * h * t + Math.sin(t * 3.2 + seed) * wob * Math.min(1, t * 3) + Math.sin(t * 11 + seed * 2) * 0.8, gy - h * t]); }
  const r0 = w / 2;
  const radius = (t: number) => r0 * (1 - t * 0.55) * (1 + (noise1(t * 9, seed + 5) - 0.5) * 0.22) + (t < 0.07 ? (0.07 - t) * r0 * 9 : 0);
  // the char, and the patches where the bark fell off to silver wood
  const tex = charTex(seed);
  tube(b, pts, radius, TP.char, 4, { texture: tex, spread: 1.7 });
  const silverT = (x: number, y: number) => (noise1(y / 6, seed + 3) - 0.5) * 1.6 + (hash2(Math.floor(x), Math.floor(y / 3), seed) < 0.18 ? -1.4 : 0);
  for (let p = 0; p < rng.int(1, 3); p++) {
    const t0 = rng.range(0.15, 0.7), t1 = t0 + rng.range(0.08, 0.22);
    const sub = pts.filter((_, i) => i / 16 >= t0 && i / 16 <= t1);
    if (sub.length < 2) continue;
    const side = rng.sign();
    tube(b, sub.map(([x, y]) => [x + side * r0 * 0.35, y] as P), t => radius(t0 + (t1 - t0) * t) * 0.55, TP.silver, 5, { texture: silverT, spread: 2, mode: 2 });
  }
  // broken limbs
  const nl = o.limbs ?? rng.int(2, 4);
  for (let i = 0; i < nl; i++) {
    const t = rng.range(0.3, 0.85);
    const [sx, sy] = pts[Math.round(t * 16)];
    const side = i % 2 ? 1 : -1;
    const a = -Math.PI / 2 + side * rng.range(0.6, 1.2);
    const L = Math.max(6, w * rng.range(0.6, 1.5));
    const lp: P[] = [[sx, sy], [sx + Math.cos(a) * L * 0.5, sy + Math.sin(a) * L * 0.5], [sx + Math.cos(a - side * 0.2) * L, sy + Math.sin(a - side * 0.2) * L]];
    tube(b, lp, tt => Math.max(0.8, r0 * 0.38 * (1 - tt * 0.5)), TP.char, 4, { texture: tex, spread: 1.6 });
    const [ex, ey] = lp[2];
    for (let j = 0; j < 3; j++) set(b, ex + Math.cos(a) * j, ey + Math.sin(a) * j - (j & 1), pick(TP.silver, 6 - j));
  }
  // the top: splintered, pale inside (or the trunk simply runs on out of the frame)
  if (o.broken !== false) {
    const [tx, ty] = pts[16];
    const tr = Math.max(1.5, radius(1));
    for (let i = -Math.ceil(tr); i <= Math.ceil(tr); i++) {
      const sp = 1 + Math.floor(hash2(i, 3, seed) * 7);
      for (let j = 0; j < sp; j++) set(b, tx + i, ty - j, j === sp - 1 ? pick(TP.silver, 8) : j > sp - 3 ? pick(TP.silver, 5 + (i < 0 ? 1 : 0)) : pick(TP.char, 3 + (i < 0 ? 1 : 0)));
    }
  }
  // the fire scar: a ragged hollow burned into one side of the foot, glossy charcoal inside
  if (o.scar !== false && w > 9) {
    const sh = Math.round(w * rng.range(1.1, 2)), sw = Math.max(2.5, w * rng.range(0.28, 0.4));
    const sx = cx + rng.sign() * r0 * rng.range(0.1, 0.35);
    for (let j = 0; j < sh; j++) {
      const t = j / sh;
      const lean = Math.sin(t * 2.4 + seed) * 1.6;
      const hw = sw * Math.pow(Math.max(0, 1 - t), 0.6) * (1 + (noise1(j / 2.5, seed + 9) - 0.5) * 0.7);
      const l0 = -hw * (0.8 + (noise1(j / 3, seed + 10) - 0.5) * 0.5), r1 = hw * (1 + (noise1(j / 3, seed + 11) - 0.5) * 0.6);
      for (let i = Math.floor(l0); i <= Math.ceil(r1); i++) {
        const e = i < 0 ? i / Math.min(-0.5, l0) : i / Math.max(0.5, r1);
        set(b, sx + lean + i, gy - j, e > 0.8 ? pick(TP.charSheen, 1 + (i < 0 ? 1 : 0)) : pick(TP.char, e > 0.5 ? 1 : 0));
      }
    }
  }
  if (o.claw) clawScore(b, pts, gy, h, seed, TP.char);
  // ash heaped round the foot
  for (let i = -Math.round(w * 1.2); i <= Math.round(w * 1.2); i++) {
    const hh = Math.round((1 - Math.abs(i) / (w * 1.2)) * 3 + hash2(i, 9, seed) * 1.5);
    for (let j = 0; j < hh; j++) set(b, cx + i, gy - j, pick(TP.ash, 5 + j - (i > 0 ? 1 : 0) + (hash2(i, j, seed) < 0.2 ? 2 : 0)));
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

/** a burnt stump: split and charred, silver where the wood split */
export function paintCharredStump(seed: number, w: number, h: number): Sprite {
  const s = paintCharredTrunk(seed, h, w, { broken: true, limbs: 0, scar: w > 12 });
  return s;
}

// ---------------------------------------------------------------- the regrowth
/** fireweed: a few magenta flower spikes on red stems, leaves like willow */
export function paintFireweed(seed: number, h: number): Sprite {
  const rng = new Rng(seed * 71 + 3);
  const W = Math.round(h * 0.7 + 10), H = h + 4;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const s = (i / Math.max(1, n - 1)) * 2 - 1;
    const sh = h * rng.range(0.6, 1) * (1 - Math.abs(s) * 0.2);
    const bend = s * rng.range(0.08, 0.2);
    const top = gy - sh;
    for (let y = gy; y > top; y--) {
      const t = (gy - y) / sh;
      const x = cx + s * 3 + bend * sh * t * t;
      set(b, x, y, pick(TP.ember, 3 + (t > 0.5 ? 1 : 0)));
      // narrow leaves along the lower stem
      if (t < 0.6 && hash2(i, y, seed) < 0.3) {
        const side = hash2(i, y, seed + 1) < 0.5 ? -1 : 1;
        for (let j = 1; j < 5; j++) set(b, x + side * j, y - j * 0.5, pick(TP.bracken, 4 + (side < 0 ? 1 : 0) - (j > 3 ? 1 : 0)));
      }
      // the spike: buds at the tip, open flowers lower down
      if (t > 0.55) {
        const open = t < 0.85;
        if (hash2(i, y, seed + 2) < (open ? 0.8 : 0.55)) {
          const sd = (y & 1) ? -1 : 1;
          set(b, x + sd, y, pick(TP.fire, open ? 4 + (sd < 0 ? 1 : 0) : 2));
          if (open) { set(b, x + sd * 2, y, pick(TP.fire, 3)); set(b, x + sd, y - 1, pick(TP.fire, 5 + (sd < 0 ? 1 : 0))); }
        }
      }
    }
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

/** bracken: stiff ladder fronds on bare stalks, some gone rusty */
export function paintBracken(seed: number, h: number): Sprite {
  const rng = new Rng(seed * 83 + 11);
  const W = Math.round(h * 1.6 + 8), H = h + 4;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const dry = rng.chance(0.25);
    const rp = dry ? TP.brackenDry : TP.bracken;
    const s = (i / Math.max(1, n - 1)) * 2 - 1;
    const sh = h * rng.range(0.55, 0.95);
    const ang = -Math.PI / 2 + s * 0.7 + rng.range(-0.1, 0.1);
    // the stalk rises, then the frond bends over horizontally with pinnae hanging off both sides
    const pts: P[] = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const a = ang + t * t * (s >= 0 ? 1.1 : -1.1);
      const p0 = pts[pts.length - 1] ?? [cx + s * 2, gy];
      pts.push(k === 0 ? [cx + s * 2, gy] : [p0[0] + Math.cos(a) * sh / 14, p0[1] + Math.sin(a) * sh / 14]);
    }
    for (let k = 0; k < pts.length; k++) {
      const [x, y] = pts[k], t = k / 14;
      set(b, x, y, pick(rp, 3 + (t > 0.5 ? 1 : 0)));
      if (t > 0.35) {
        const L = (1 - t) * h * 0.22 + 2;
        for (const side of [-1, 1]) for (let j = 1; j < L; j++) set(b, x + side * j * 0.5, y + j * 0.75, pick(rp, 4 + (side < 0 ? 1 : 0) - (j > L - 2 ? 1 : 0) + (hash2(k, j, seed) < 0.15 ? 1 : 0)));
      }
    }
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}


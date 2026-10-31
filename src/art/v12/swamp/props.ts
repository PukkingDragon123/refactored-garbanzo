// V12 Te Repo Raupō, the swamp's plants and props, painted pixel by pixel: raupō (bulrush) clumps with
// their velvet cigar heads, pukio sedge on its pedestal of old leaf bases, tī kōuka (cabbage trees),
// bleached drowned trees and broken stumps standing in the water, stepping logs and stones, the old
// boardwalk on its piles, the maimai (a hunters' hide) and its catwalk, the peat bank of the hollow,
// and the eel-fisher's whare raupō on the hidden island. Lit from the upper left; a dark ink edge on
// the lower right. All anchors are the bottom centre unless a painter says otherwise.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { mix, shade } from '../../color';
import { Rng, clamp, fbm2, hash2, noise1, noise2, smoothstep } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { tube, blade, outlineSel, trimSprite } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { SWP, pk, dz } from './kit';

const set = (b: PixelBuffer, x: number, y: number, c: C) => { if (c) b.set(Math.floor(x), Math.floor(y), c); };

// ---------------------------------------------------------------- raupō
/** one raupō blade: long, nearly upright, twisting edge-on here and there, yellowing at the tip */
function raupoBlade(b: PixelBuffer, x: number, y: number, ang: number, len: number, w0: number, base: number, dry: number, seed: number) {
  const steps = Math.ceil(len * 2);
  const twist = 0.35 + hash2(seed, 1, 3) * 0.4;
  let px = x, py = y, a = ang;
  const bend = (hash2(seed, 2, 3) - 0.5) * 0.012;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    a += bend + (t > 0.7 ? Math.sign(Math.cos(ang)) * 0.004 : 0);
    px += Math.cos(a) * 0.5; py += Math.sin(a) * 0.5;
    // twisting: where the blade turns edge-on it narrows to a line and the lit face flips
    const tw = Math.cos(t * Math.PI * 2.2 + twist * 6);
    const hw = Math.max(0.5, (w0 / 2) * Math.pow(1 - t, 0.55) * (0.35 + Math.abs(tw) * 0.65));
    const nx = -Math.sin(a), ny = Math.cos(a);
    const dryT = smoothstep(1 - dry, 1, t);
    for (let v = -hw; v <= hw; v += 0.5) {
      const lit = (v < 0) === (tw > 0);
      let k = base + (lit ? 1.2 : -0.6) + (Math.abs(v) > hw - 0.6 && hw > 1 ? (lit ? 0.8 : -1) : 0) + (t > 0.5 ? 0.4 : 0);
      if (hash2(Math.floor(px + nx * v), Math.floor(py + ny * v), seed) < 0.04) k -= 1;
      const c = dryT > 0.45 || (dryT > 0.15 && hash2(i, 9, seed) < dryT) ? pk(SWP.raupoDry, k - 0.5) : pk(SWP.raupo, k);
      set(b, px + nx * v, py + ny * v, c);
    }
  }
}
/** a cigar head on its stalk: the velvet female spike, the thin male spike above it (or a burst of fluff) */
function raupoHead(b: PixelBuffer, x: number, gy: number, h: number, lean: number, seed: number) {
  const top = gy - h;
  for (let y = gy; y > top; y--) {
    const t = (gy - y) / h;
    const sx = x + lean * t * t * h;
    set(b, sx, y, pk(SWP.raupo, 3 + (hash2(y, 4, seed) < 0.3 ? 1 : 0)));
    if (t < 0.3) set(b, sx + 1, y, pk(SWP.raupo, 2));
  }
  const hl = 7 + Math.floor(hash2(seed, 5, 1) * 6), hw = 2 + (hash2(seed, 6, 1) < 0.5 ? 1 : 0);
  const hy = top + 6 + Math.floor(hash2(seed, 7, 1) * 3);
  const burst = hash2(seed, 8, 1) < 0.18;
  for (let j = 0; j < hl; j++) {
    const y = hy + j, sx = Math.round(x + lean * h * Math.pow(1 - j / h, 2));
    const w = hw - (j === 0 || j === hl - 1 ? 1 : 0);
    for (let i = -w; i <= w; i++) {
      const lit = i < 0 ? 1.6 : i === 0 ? 0.6 : -0.6;
      let c = pk(SWP.cigar, 3 + lit + (j < 2 ? 0.6 : 0) + dz(sx + i, y, 0.8) + (hash2(sx + i, y, seed) < 0.12 ? -1.2 : 0));
      if (burst && hash2(i, j, seed) < 0.45) c = pk(SWP.fluff, 1 + (i < 0 ? 2 : 0) + hash2(j, i, seed));
      set(b, sx + i, y, c);
    }
  }
  // the male spike above the head: thin, pale and frayed
  for (let j = 1; j < 7; j++) set(b, Math.round(x + lean * h) + (j > 4 && hash2(j, 3, seed) < 0.5 ? 1 : 0), hy - j, pk(SWP.pollen, 2 - j * 0.25));
  if (burst) for (let k = 0; k < 6; k++) set(b, x + (hash2(k, 1, seed) - 0.5) * 8 + lean * h, hy + hash2(k, 2, seed) * hl, pk(SWP.fluff, 3));
}
/** a clump of raupō: blades in three layers, cigar heads among them */
export function paintRaupo(seed: number, h: number, o: { heads?: number; dry?: number; width?: number } = {}): Sprite {
  const rng = new Rng(seed * 31 + 7);
  const W = Math.round((o.width ?? h * 0.5) + 16), H = h + 12;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const n = Math.round(h / 5) + rng.int(5, 9);
  const heads = o.heads ?? rng.int(1, 4);
  const dry = o.dry ?? 0.18;
  const bl = Array.from({ length: n }, (_, i) => ({ x: cx + rng.range(-W * 0.22, W * 0.22), a: -Math.PI / 2 + rng.range(-0.22, 0.22), len: h * rng.range(0.5, 1), w: rng.range(2.4, 3.6), layer: i % 3, s: rng.int(1, 9999) }));
  for (const L of [0, 1, 2]) {
    for (const q of bl) if (q.layer === L) raupoBlade(b, q.x, gy, q.a + (q.x - cx) / W * 0.5, q.len, q.w, 1.6 + L * 1.6, dry + rng.range(-0.08, 0.1), q.s);
    if (L === 1) for (let k = 0; k < heads; k++) raupoHead(b, cx + rng.range(-W * 0.16, W * 0.16), gy, h * rng.range(0.78, 1.04), rng.range(-0.08, 0.08), seed * 7 + k);
  }
  // the clump's foot: old dead leaves bent over, dark and wet
  for (let k = 0; k < W * 0.6; k++) {
    const x = cx + rng.range(-W * 0.28, W * 0.28), L = rng.range(3, 8), s = Math.sign(x - cx) || 1;
    for (let j = 0; j < L; j++) set(b, x + s * j, gy - 1 - Math.max(0, 3 - j) * 0.6, pk(SWP.raupoDry, 1 + (j > L * 0.6 ? 1 : 0)));
  }
  outlineSel(b, 0.42);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

// ---------------------------------------------------------------- pukio, the swamp sedge on its pedestal
export function paintPukio(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 13 + 5);
  const W = Math.round(size * 1.6 + 10), H = Math.round(size * 1.15 + 8);
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const ph = Math.round(size * 0.32), pw = Math.max(4, Math.round(size * 0.18));
  // the pedestal: a trunk of old leaf bases, fibrous, dark, wider at the foot
  for (let y = 0; y < ph; y++) {
    const w = pw + Math.round((1 - y / ph) * 2 + Math.sin(y * 0.7 + seed) * 0.6);
    for (let i = -w; i <= w; i++) {
      const strand = Math.sin((i + noise1(y / 3, seed) * 3) * 1.9);
      const lit = i < -w * 0.3 ? 1.2 : i > w * 0.4 ? -0.9 : 0;
      set(b, cx + i, gy - y, pk(SWP.wood, 3 + lit + (strand > 0.6 ? 1 : strand < -0.7 ? -1 : 0) + dz(i, y, 0.6)));
    }
  }
  // the fountain: fine blades rising and falling over on every side
  const n = Math.round(size * 1.1) + 14;
  const top = gy - ph;
  for (let k = 0; k < n; k++) {
    const t = k / n - 0.5;
    const a = -Math.PI / 2 + t * 2.6 + rng.range(-0.1, 0.1);
    const L = size * rng.range(0.55, 0.95) * (1 - Math.abs(t) * 0.3);
    const pts: P[] = [];
    let x = cx + rng.range(-pw * 0.6, pw * 0.6), y = top + rng.range(0, 2);
    let aa = a;
    const droop = 0.06 + Math.abs(t) * 0.09 + rng.range(0, 0.04);
    for (let s = 0; s < L * 2; s++) { aa += droop * (Math.cos(aa) > 0 ? 0.06 : -0.06) * 2.4; x += Math.cos(aa) * 0.5; y += Math.sin(aa) * 0.5; aa += Math.cos(aa) > 0 ? droop * 0.05 : -droop * 0.05; pts.push([x, y]); }
    const bronze = rng.chance(0.35);
    pts.forEach(([px, py], i) => {
      const tt = i / pts.length;
      const lit = hash2(k, i >> 3, seed) < 0.4 ? 1 : 0;
      set(b, px, py, tt > 0.8 && bronze ? pk(SWP.raupoDry, 3 + lit) : pk(SWP.sedge, (bronze ? 4 : 3) + lit + (k % 3 === 0 ? -1 : 0) + tt));
    });
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

// ---------------------------------------------------------------- tī kōuka, the cabbage tree
export function paintTiKouka(seed: number, h: number): Sprite {
  const rng = new Rng(seed * 17 + 3);
  const W = Math.round(h * 0.9 + 30), H = h + 30;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const fork = gy - h * rng.range(0.5, 0.62);
  const heads: P[] = [];
  const bark = (x: number, y: number) => (Math.sin(y * 0.9 + noise1(x / 2, seed) * 4) > 0.55 ? -0.9 : 0) + (hash2(x, y, seed) < 0.08 ? 1 : 0);
  tube(b, [[cx, gy], [cx + rng.range(-2, 2), (gy + fork) / 2], [cx, fork]], t => 3.6 - t * 1.1, SWP.wood, 4, { texture: bark, spread: 2.2 });
  const nb = rng.int(2, 3);
  for (let i = 0; i < nb; i++) {
    const a = -Math.PI / 2 + (i - (nb - 1) / 2) * 0.62 + rng.range(-0.1, 0.1);
    const L = h * rng.range(0.32, 0.46);
    const ex = cx + Math.cos(a) * L, ey = fork + Math.sin(a) * L;
    tube(b, [[cx, fork], [cx + Math.cos(a) * L * 0.5 + Math.cos(a) * 3, fork + Math.sin(a) * L * 0.55], [ex, ey]], t => 2.4 - t * 0.9, SWP.wood, 4, { texture: bark, spread: 2 });
    heads.push([ex, ey]);
  }
  for (const [hx, hy] of heads) {
    // the skirt of dead leaves hanging under the head
    for (let k = 0; k < 16; k++) {
      const x0 = hx + rng.range(-4, 4), L = rng.range(8, 16);
      for (let j = 0; j < L; j++) set(b, x0 + Math.sin(j * 0.3 + k) * 0.6 + (x0 - hx) * j * 0.05, hy + 1 + j, pk(SWP.raupoDry, 2 + (j < 3 ? 1 : 0) + (k % 4 === 0 ? 1 : 0)));
    }
    // the head: long narrow leaves bursting out, the upper ones stiff, the lower ones drooping
    for (let k = 0; k < 26; k++) {
      const t = k / 26;
      const a = -Math.PI / 2 + (t - 0.5) * 3.6 + rng.range(-0.1, 0.1);
      blade(b, { x: hx, y: hy, ang: a, len: rng.range(12, 20), droop: Math.abs(t - 0.5) * 0.8 + 0.05, w0: 2.2, ramp: SWP.raupo, base: 4 + (k % 3) - (Math.abs(t - 0.5) > 0.35 ? 1 : 0), fold: true });
    }
    // a sprig of creamy flowers on one head
    if (rng.chance(0.45)) for (let j = 0; j < 8; j++) set(b, hx + 3 + (j & 1), hy - 6 - j, pk(SWP.fluff, 2 + (j & 1)));
  }
  outlineSel(b, 0.45);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

// ---------------------------------------------------------------- drowned trees and stumps
/** silver bark-less wood: long cracks following the grain, a knot, lichen spots */
const boneTex = (seed: number) => (x: number, y: number) => {
  const crack = Math.abs(Math.sin(x * 1.3 + noise1(y / 6, seed) * 5 + noise1(y / 23, seed + 1) * 3));
  return (crack < 0.12 ? -1.6 : crack < 0.25 ? -0.5 : 0) + (hash2(x, y >> 1, seed) < 0.06 ? 0.8 : 0) + (noise2(x / 3, y / 7, seed + 2) - 0.5) * 0.6;
};
/** a drowned tree: a tall bleached snag, its bark long gone, broken limbs reaching up; the foot dark
 *  and waterlogged where it stands in the swamp */
export function paintDrownedTree(seed: number, h: number): Sprite {
  const rng = new Rng(seed * 29 + 11);
  const W = Math.round(h * 0.75 + 30), H = h + 8;
  const b = new PixelBuffer(W, H);
  const cx = W / 2 + rng.range(-4, 4), gy = H - 2;
  const r0 = Math.max(3, h * 0.055);
  const lean = rng.range(-0.12, 0.12);
  const trunk: P[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; trunk.push([cx + lean * h * t * t + Math.sin(t * 5 + seed) * 1.5, gy - h * t * 0.86]); }
  const tex = boneTex(seed);
  tube(b, trunk, t => r0 * (1 - t * 0.6) + (t < 0.08 ? (0.08 - t) * r0 * 12 : 0), SWP.bone, 6, { texture: tex, spread: 2.6 });
  // limbs: broken off short, or reaching up and forking into dead twigs
  const nl = rng.int(2, 4);
  for (let i = 0; i < nl; i++) {
    const t = rng.range(0.42, 0.82);
    const [sx, sy] = trunk[Math.round(t * 8)];
    const side = i % 2 ? 1 : -1;
    const a = -Math.PI / 2 + side * rng.range(0.45, 1.05);
    const L = h * rng.range(0.16, 0.34) * (1 - t * 0.4);
    const pts: P[] = [[sx, sy], [sx + Math.cos(a) * L * 0.5, sy + Math.sin(a) * L * 0.5 + 2], [sx + Math.cos(a - side * 0.25) * L, sy + Math.sin(a - side * 0.25) * L]];
    tube(b, pts, tt => r0 * 0.45 * (1 - tt * 0.6), SWP.bone, 6, { texture: tex, spread: 2.2 });
    const [ex, ey] = pts[2];
    if (rng.chance(0.6)) for (let k = 0; k < 3; k++) {
      const ta = a + (k - 1) * 0.5;
      const L2 = rng.range(4, 9);
      for (let j = 0; j < L2; j++) set(b, ex + Math.cos(ta) * j, ey + Math.sin(ta) * j, pk(SWP.bone, 5 + (j < 2 ? 1 : 0) + (ta > -Math.PI / 2 ? -1 : 0)));
    }
    else { set(b, ex, ey - 1, pk(SWP.bone, 9)); set(b, ex + side, ey, pk(SWP.bone, 8)); }
  }
  // the broken top: a jagged splintered end, pale inside
  const [tx, ty] = trunk[8];
  const tr = Math.max(1.5, r0 * 0.4);
  for (let i = -Math.ceil(tr); i <= Math.ceil(tr); i++) {
    const sp = 1 + Math.floor(hash2(i, 3, seed) * 5);
    for (let j = 0; j < sp; j++) set(b, tx + i, ty - j, j === sp - 1 ? pk(SWP.bone, 10) : pk(SWP.bone, 7 + (i < 0 ? 1 : 0)));
  }
  // a knothole, lichen spots and old-man's-beard hanging off the limbs
  const kh = trunk[3];
  for (let j = 0; j < 4; j++) for (let i = -1; i <= 1; i++) if (Math.abs(i) + Math.abs(j - 1.5) < 2.4) set(b, kh[0] + i, kh[1] + j, pk(SWP.bone, j < 1 ? 1 : 0));
  set(b, kh[0] - 1, kh[1] - 1, pk(SWP.bone, 9));
  for (let k = 0; k < h * 0.4; k++) {
    const [lx, ly] = trunk[rng.int(2, 7)];
    const x = lx + rng.range(-r0, r0), y = ly + rng.range(-6, 6);
    if (!(b.get(Math.floor(x), Math.floor(y)) >>> 24)) continue;
    set(b, x, y, pk(SWP.lichen, rng.int(1, 4)));
    if (rng.chance(0.4)) set(b, x + 1, y, pk(SWP.lichen, 2));
  }
  for (let k = 0; k < 5; k++) {
    const [lx, ly] = trunk[rng.int(4, 7)];
    const x = lx + rng.range(-r0 * 2, r0 * 2), L = rng.range(5, 12);
    for (let j = 0; j < L; j++) set(b, x + Math.sin(j * 0.5 + k) * 0.7, ly + 2 + j, pk(SWP.lichen, 3 - (j > L * 0.6 ? 1 : 0)));
  }
  // the waterlogged foot: dark to a line, slick, with a pale scum ring
  for (let y = gy - 10; y <= gy; y++) for (let x = 0; x < W; x++) {
    const c = b.get(x, y);
    if (!(c >>> 24)) continue;
    const k = (y - (gy - 10)) / 10;
    b.set(x, y, y === gy - 10 || (y === gy - 9 && hash2(x, 1, seed) < 0.5) ? pk(SWP.sheen, 2) : mix(c, pk(SWP.wood, 1 + (x % 3 === 0 ? 1 : 0)), 0.55 + k * 0.35));
  }
  outlineSel(b, 0.5);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

/** a broken stump standing in the water: splintered top, pale inner wood, a moss cap and a fern */
export function paintStump(seed: number, w: number, h: number): Sprite {
  const rng = new Rng(seed * 23 + 1);
  const W = w + 10, H = h + 12;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, gy = H - 2;
  const tex = boneTex(seed);
  for (let x = -w / 2; x <= w / 2; x++) {
    const flare = Math.max(0, 1 - (gy - 0) / 1);
    void flare;
    const top = gy - h + Math.floor(hash2(Math.floor(x / 2), 1, seed) * (h * 0.35)) + Math.round(Math.abs(x) * 0.3);
    for (let y = top; y <= gy; y++) {
      const u = x / (w / 2);
      const l = -u * 1.4 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.6;
      const foot = y > gy - 4 ? (gy - y) * 0 + Math.round((4 - (gy - y)) * 0.6) : 0;
      void foot;
      let c = pk(rng.next() < 0 ? SWP.wood : SWP.bone, 4 + l * 2 + tex(x + 40, y));
      if (y < top + 2) c = pk(SWP.bone, 9 - (y - top) * 2 + (u < 0 ? 0 : -1));
      set(b, cx + x, y, c);
    }
  }
  // the root flare into the water
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1, x0 = cx + s * (w / 2 - 1);
    for (let j = 0; j < 5; j++) { set(b, x0 + s * j, gy - 3 + j * 0.6, pk(SWP.bone, 4 - j * 0.3)); set(b, x0 + s * j, gy - 2 + j * 0.6, pk(SWP.bone, 2)); }
  }
  // moss on the cap, a little crown fern
  for (let x = -w / 2 + 1; x < w / 2 - 1; x++) if (hash2(x, 3, seed) < 0.55) {
    const y = gy - h + Math.floor(hash2(Math.floor(x / 2), 1, seed) * (h * 0.35)) + Math.round(Math.abs(x) * 0.3) + 1;
    set(b, cx + x, y, pk(SWP.sphag, 3 + (x < 0 ? 1 : 0)));
  }
  if (rng.chance(0.6)) for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.45;
    for (let j = 0; j < 7; j++) set(b, cx + 1 + Math.cos(a) * j, gy - h * 0.7 + Math.sin(a) * j + j * j * 0.05, pk(SWP.sphag, 3 + (j & 1)));
  }
  for (let y = gy - 6; y <= gy; y++) for (let x = 0; x < W; x++) { const c = b.get(x, y); if (c >>> 24) b.set(x, y, y === gy - 6 ? pk(SWP.sheen, 2) : mix(c, pk(SWP.wood, 1), 0.6)); }
  outlineSel(b, 0.5);
  return trimSprite({ buf: b, ax: Math.round(cx), ay: gy + 1 });
}

// ---------------------------------------------------------------- stepping logs and stones
/** a stepping log (anchor: the top of the log at its west end); top(x) is the log's top at local x */
export function paintStepLog(seed: number, len: number, dia: number): { buf: PixelBuffer; ax: number; ay: number; top: (x: number) => number } {
  const W = len + 4, H = dia + 8;
  const b = new PixelBuffer(W, H);
  const T = 3;
  const topAt = (x: number) => T + Math.round(Math.sin(x * 0.05 + seed) * 0.8 + (x / len - 0.5) * 1.2);
  for (let x = 0; x < len; x++) {
    const t0 = topAt(x);
    const end = Math.min(x, len - 1 - x);
    const jag = end < 3 ? Math.floor(hash2(x, 2, seed) * 3) * (3 - end) : 0;
    for (let y = t0 + (end < 2 ? jag : 0); y < t0 + dia - (end < 2 ? jag : 0); y++) {
      const v = (y - t0) / dia * 2 - 1;
      const l = -v * 1.5 + Math.sqrt(Math.max(0, 1 - v * v)) * 0.4;
      // bark ridges running along the log
      const ridge = Math.sin((y - t0) * 2.1 + noise1(x / 9, seed) * 3) > 0.6 ? -1 : 0;
      let c = pk(SWP.wood, 4 + l * 1.8 + ridge + dz(x, y, 0.6));
      // the cut ends: rings
      if (end < 3) { const rr = Math.abs(v) * 4 + end * 0.5; c = pk(SWP.plank, 6 + (Math.floor(rr * 1.6) % 2 ? -2 : 0) - end); }
      // moss along the top, wet and black under the waterline
      if (y - t0 < 2 && hash2(x, y, seed) < 0.7) c = pk(SWP.sphag, 3 + (y - t0 === 0 ? 1 : 0) + (hash2(x, 5, seed) < 0.2 ? 1 : 0));
      if (v > 0.45) c = mix(c, pk(SWP.wood, 0), 0.6);
      set(b, x + 2, y, c);
    }
    // a bracket fungus on the side
    if (hash2(Math.floor(x / 6), 9, seed) < 0.08 && x > 6 && x < len - 6) { set(b, x + 2, t0 + dia * 0.4, pk(SWP.raupoDry, 5)); set(b, x + 3, t0 + dia * 0.4, pk(SWP.raupoDry, 4)); }
  }
  outlineSel(b, 0.5);
  return { buf: b, ax: 2, ay: T, top: x => topAt(x - 2) - T };
}
/** a flat-topped stepping stone, sunk in the water, with a moss cap; anchor the middle of its top */
export function paintStepStone(seed: number, w: number): { buf: PixelBuffer; ax: number; ay: number } {
  const H = Math.round(w * 0.6) + 6, W = w + 6;
  const b = new PixelBuffer(W, H);
  const cx = W / 2, T = 2;
  for (let x = 0; x < W; x++) {
    const u = (x - cx) / (w / 2);
    if (Math.abs(u) > 1.05) continue;
    const top = T + Math.round(Math.pow(Math.abs(u), 3) * 3 + (noise1(x / 3, seed) - 0.5) * 1.6);
    for (let y = top; y < H; y++) {
      const v = (y - top) / (H - top);
      const facet = Math.floor(noise2(x / 4, y / 3, seed) * 3);
      const l = -u * 1.2 - (v < 0.2 ? -1.2 : 0) + facet * 0.4 - v * 0.6;
      let c = pk(SWP.stone, 4 + l + dz(x, y, 0.7));
      if (y - top < 2 + (hash2(x, 1, seed) < 0.4 ? 1 : 0)) c = pk(SWP.sphag, 3 + (y === top ? 1 : 0) - (u > 0.3 ? 1 : 0));
      if (v > 0.55) c = mix(c, pk(SWP.peat, 2), 0.6);
      set(b, x, y, c);
    }
  }
  outlineSel(b, 0.5);
  return { buf: b, ax: Math.round(cx), ay: T };
}

// ---------------------------------------------------------------- the old boardwalk
/** a boardwalk of old planks on piles: deck(x) is the deck top (world y) over local x 0..len, water(x)
 *  the water's surface under it; anchor: the top-left of the buffer at world y y0 */
export function paintBoardwalk(len: number, deck: (x: number) => number, water: (x: number) => number, seed: number): { buf: PixelBuffer; y0: number } {
  let y0 = 1e9, y1 = -1e9;
  for (let x = 0; x <= len; x++) { y0 = Math.min(y0, deck(x) - 4); y1 = Math.max(y1, water(x) + 3); }
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const W = len + 2, H = y1 - y0 + 2;
  const b = new PixelBuffer(W, H);
  const Y = (y: number) => Math.round(y) - y0;
  // the piles: tōtara posts, every few strides, some leaning, a rope round one or two
  for (let x = 3; x < len - 2; x += 26 + Math.floor(hash2(x, 1, seed) * 10)) {
    const top = Y(deck(x)) + 3, bot = Y(water(x)) + 1;
    const leanP = (hash2(x, 2, seed) - 0.5) * 0.12;
    for (let y = top; y <= bot; y++) for (let i = 0; i < 3; i++) {
      const xx = x + i + Math.round((y - top) * leanP);
      const wet = y > bot - 4;
      set(b, xx, y, wet ? pk(SWP.wood, 1 + (i === 0 ? 1 : 0)) : pk(SWP.wood, 3 + (i === 0 ? 2 : i === 2 ? -1 : 0) + (hash2(xx, y >> 1, seed) < 0.1 ? -1 : 0)));
    }
    // the water's ring round the pile
    set(b, x - 1, bot, pk(SWP.sheen, 2)); set(b, x + 3, bot, pk(SWP.sheen, 1));
    if (hash2(x, 3, seed) < 0.35) for (let i = -1; i <= 3; i++) { set(b, x + i, top + 3, pk(SWP.flaxRope, 3)); set(b, x + i, top + 4, pk(SWP.flaxRope, 1 + (i & 1))); }
    // slime and weed trailing at the waterline
    for (let k = 0; k < 3; k++) set(b, x + k, bot - 1 - (k & 1), pk(SWP.duck, 2 + k));
  }
  // the stringer under the plank ends
  for (let x = 0; x <= len; x++) { const y = Y(deck(x)) + 3; set(b, x, y, pk(SWP.wood, 4)); set(b, x, y + 1, pk(SWP.wood, 2)); }
  // the planks: each its own width and age; a few missing, warped, cracked, one broken and hanging
  let x = 0;
  while (x < len) {
    const pw = 3 + Math.floor(hash2(x, 4, seed) * 3);
    const miss = hash2(x, 5, seed) < 0.07;
    const broken = !miss && hash2(x, 6, seed) < 0.035;
    const tone = (hash2(x, 7, seed) - 0.5) * 2.2 + (noise1(x / 40, seed) - 0.5) * 1.4;
    const warp = hash2(x, 8, seed) < 0.15 ? -1 : 0;
    if (!miss) for (let i = 0; i < pw && x + i <= len; i++) {
      const xx = x + i;
      const top = Y(deck(xx)) + warp + (broken ? i : 0);
      const e = i === 0 || i === pw - 1;
      set(b, xx, top, pk(SWP.plank, 7 + tone - (e ? 1 : 0)));
      set(b, xx, top + 1, pk(SWP.plank, 5 + tone - (e ? 1 : 0)));
      set(b, xx, top + 2, pk(SWP.plank, 3 + tone));
      if (i === 1 && hash2(xx, 9, seed) < 0.2) set(b, xx, top + 1, pk(SWP.rust, 2));
      if (hash2(xx, 10, seed) < 0.18) set(b, xx, top - 1, pk(SWP.sphag, 3 + (hash2(xx, 11, seed) < 0.4 ? 1 : 0)));
    }
    x += pw + (hash2(x, 12, seed) < 0.6 ? 1 : 0) + (miss ? 2 : 0);
  }
  // a marker pole with a flax ribbon now and then
  for (let mx = 40; mx < len - 30; mx += 160 + Math.floor(hash2(mx, 13, seed) * 120)) {
    const top = Y(deck(mx)) - 22;
    for (let y = top; y < Y(deck(mx)) + 3; y++) { set(b, mx, y, pk(SWP.wood, 5)); set(b, mx + 1, y, pk(SWP.wood, 3)); }
    for (let k = 0; k < 6; k++) { set(b, mx + 2 + k * 0.7, top + 2 + Math.sin(k) * 1.2, pk(SWP.rust, 3)); set(b, mx + 2 + k * 0.7, top + 3 + Math.sin(k) * 1.2, pk(SWP.rust, 2)); }
  }
  outlineSel(b, 0.5);
  return { buf: b, y0 };
}

// ---------------------------------------------------------------- the maimai and its catwalk
/** the hunters' hide on poles over the raupō, and the catwalk from it; deck(x) world y over local x;
 *  ground(x) the walk line under it; ladders at local x `ups` */
export function paintMaimai(len: number, deck: (x: number) => number, ground: (x: number) => number, ups: number[], seed: number): { buf: PixelBuffer; y0: number } {
  let y0 = 1e9, y1 = -1e9;
  for (let x = 0; x <= len; x++) { y0 = Math.min(y0, deck(x) - 34); y1 = Math.max(y1, ground(x) + 2); }
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const W = len + 4, H = y1 - y0 + 2;
  const b = new PixelBuffer(W, H);
  const Y = (y: number) => Math.round(y) - y0;
  // the poles, cross-braced, lashed with flax
  const poles: number[] = [];
  for (let x = 2; x < len; x += 30 + Math.floor(hash2(x, 1, seed) * 8)) poles.push(x);
  poles.push(len - 2);
  for (const px of poles) {
    for (let y = Y(deck(px)); y <= Y(ground(px)); y++) { set(b, px, y, pk(SWP.wood, 5)); set(b, px + 1, y, pk(SWP.wood, 3 + (hash2(px, y, seed) < 0.1 ? -1 : 0))); }
    for (let i = -1; i <= 2; i++) set(b, px + i, Y(deck(px)) + 2, pk(SWP.flaxRope, 3));
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], c = poles[i + 1];
    const ya = Y(deck(a)) + 6, yb = Y(ground(c)) - 8;
    for (let k = 0; k <= c - a; k++) { const t = k / (c - a); set(b, a + k, ya + (yb - ya) * t, pk(SWP.wood, 3 + (k & 1))); }
  }
  // the deck: rough slabs
  for (let x = 0; x <= len; x++) {
    const y = Y(deck(x));
    const seam = hash2(Math.floor(x / 5), 2, seed) < 0.2 && x % 5 === 0;
    set(b, x, y, seam ? pk(SWP.plank, 3) : pk(SWP.plank, 7 + (hash2(x, 3, seed) - 0.5) * 2));
    set(b, x, y + 1, pk(SWP.plank, 4)); set(b, x, y + 2, pk(SWP.wood, 2));
  }
  // the hide box at the west end: raupō bundles lashed to a frame, a slot to look out of
  const hx0 = 6, hx1 = Math.min(len - 6, 46);
  for (let x = hx0; x <= hx1; x++) {
    const top = Y(deck(x)) - 24 - (x < hx0 + 3 || x > hx1 - 3 ? 0 : Math.round(hash2(x, 4, seed) * 2));
    for (let y = top; y < Y(deck(x)); y++) {
      const slot = y > top + 7 && y < top + 11 && x > hx0 + 8 && x < hx1 - 8;
      if (slot) { set(b, x, y, pk(SWP.wood, 0)); continue; }
      const bundle = Math.floor((x - hx0) / 3);
      const lash = (y - top) % 9 === 4;
      set(b, x, y, lash ? pk(SWP.flaxRope, 2 + ((x & 1) ? 1 : 0)) : pk(SWP.thatch, 3 + ((x - hx0) % 3 === 0 ? -1 : (x - hx0) % 3 === 1 ? 1 : 0) + (bundle % 2 ? 0.5 : 0) + dz(x, y, 0.5)));
    }
    // ragged tops of the bundles
    if (hash2(x, 5, seed) < 0.6) set(b, x, Y(deck(x)) - 25 - (hash2(x, 6, seed) < 0.4 ? 1 : 0), pk(SWP.thatch, 5));
  }
  // ladders: two rails and rungs
  for (const lx of ups) {
    const top = Y(deck(lx)), bot = Y(ground(lx));
    for (let y = top; y <= bot; y++) { set(b, lx - 3, y, pk(SWP.wood, 4)); set(b, lx + 3, y, pk(SWP.wood, 3)); if ((y - top) % 5 === 2) for (let i = -2; i <= 2; i++) set(b, lx + i, y, pk(SWP.plank, 6 - (i > 0 ? 1 : 0))); }
  }
  outlineSel(b, 0.5);
  return { buf: b, y0 };
}

// ---------------------------------------------------------------- the peat bank of a hollow
/** the bank behind the walk line where it drops into the hollow or the channel: cut peat in layers,
 *  roots hanging out of it, seeps running dark down its face, sphagnum and ferns at the lip; drawn
 *  from rim(x) (the top) to base(x) (the water), world y; anchor top-left at world y y0 */
export function paintPeatBank(w: number, rim: (x: number) => number, base: (x: number) => number, seed: number): { buf: PixelBuffer; y0: number } {
  let y0 = 1e9, y1 = -1e9;
  for (let x = 0; x < w; x++) { y0 = Math.min(y0, rim(x) - 8); y1 = Math.max(y1, base(x) + 2); }
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const b = new PixelBuffer(w, y1 - y0 + 1);
  for (let x = 0; x < w; x++) {
    const top = Math.round(rim(x) - 2 - noise1(x / 9, seed) * 3), bot = Math.round(base(x));
    if (bot - top < 3) continue;
    for (let y = top; y <= bot; y++) {
      const k = (y - top) / Math.max(1, bot - top);
      // layers of peat, the older ones darker and more compressed
      const layer = Math.sin(y * 0.55 + noise1(x / 30, seed) * 4) + (noise2(x / 14, y / 3, seed + 1) - 0.5) * 1.4;
      let c = pk(SWP.mud, 3.4 - k * 1.6 + (layer > 0.8 ? 1 : layer < -0.9 ? -1 : 0) + dz(x, y, 0.7));
      // seeps: dark wet streaks down the face, glinting
      const seep = noise1(x / 5, seed + 2);
      if (seep > 0.78) c = hash2(x, y, seed) < 0.08 ? pk(SWP.sheen, 2) : pk(SWP.mud, 1);
      // the lip: sphagnum and sedge
      if (y - top < 3) c = pk(SWP.sphag, 4 - (y - top) + (hash2(x, y, seed + 3) < 0.15 ? 1 : 0));
      // the waterline: slick and black
      if (bot - y < 3) c = pk(SWP.peat, 1 + (bot - y === 2 && hash2(x, 4, seed) < 0.3 ? 4 : 0));
      b.set(x, y - y0, c);
    }
    // roots hanging out of the face
    if (hash2(x, 5, seed) < 0.05) {
      let rx = x, ry = top + 3;
      const L = 6 + Math.floor(hash2(x, 6, seed) * Math.max(4, (bot - top) * 0.6));
      for (let j = 0; j < L && ry < bot - 1; j++) { b.set(Math.round(rx), Math.round(ry) - y0, pk(SWP.wood, j < 2 ? 5 : 4)); rx += (noise1(j / 3 + x, seed) - 0.5) * 0.9; ry += 1; }
    }
    // a little hanging fern
    if (hash2(x, 7, seed) < 0.025) for (let j = 0; j < 6; j++) { b.set(x + Math.round(j * 0.6), top + 2 + j - y0, pk(SWP.raupo, 5 - (j > 3 ? 1 : 0))); b.set(x - 1 + Math.round(j * 0.6), top + 3 + j - y0, pk(SWP.raupo, 3)); }
  }
  return { buf: b, y0 };
}

// ---------------------------------------------------------------- the eel-fisher's whare
/** a low whare raupō on the hidden island: walls of raupō bundles lashed to a pole frame, a heavy
 *  thatch sagging off its ridge with a hole in it, a low dark doorway, a hīnaki (eel pot) leaning by
 *  it and a drying rack (anchor bottom centre) */
export function paintWhare(seed: number): Sprite {
  const W = 96, H = 52;
  const b = new PixelBuffer(W, H);
  const gy = H - 2, cx = 46;
  const x0 = cx - 26, x1 = cx + 26, eave = gy - 16, ridge = gy - 42;
  // the back slope (darker), then the walls, then the front thatch
  const roofY = (x: number) => { const t = Math.abs(x - cx) / 32; return ridge + t * (eave - ridge + 6) + Math.sin(x * 0.4) * 0.6 + (Math.abs(x - cx) < 4 ? 1 : 0); };
  // walls
  for (let x = x0; x <= x1; x++) for (let y = eave - 4; y <= gy; y++) {
    const bundle = (x - x0) % 4;
    const lash = (y - eave) % 6 === 3;
    let c = lash ? pk(SWP.flaxRope, 2 + (x & 1)) : pk(SWP.thatch, 2.4 + (bundle === 0 ? -1 : bundle === 1 ? 1 : 0) + (x < cx ? 0.6 : -0.4) + dz(x, y, 0.5));
    if (y > gy - 3) c = mix(c, pk(SWP.mud, 1), 0.5);
    set(b, x, y, c);
  }
  // the doorway: low and dark, a worn sill, a carved lintel board
  for (let x = cx - 6; x <= cx + 6; x++) for (let y = gy - 13; y <= gy; y++) set(b, x, y, pk(SWP.wood, y < gy - 11 ? 1 : 0));
  for (let x = cx - 8; x <= cx + 8; x++) { set(b, x, gy - 15, pk(SWP.wood, 5 + (x % 3 === 0 ? 1 : 0))); set(b, x, gy - 14, pk(SWP.wood, 3)); if ((x - cx) % 4 === 0) set(b, x, gy - 15, pk(SWP.lilyRed, 3)); }
  // the thatch: layered rows of raupō, ragged at the eaves, combed downward, moss on the ridge
  for (let x = x0 - 8; x <= x1 + 8; x++) {
    const top = Math.round(roofY(x)), bot = eave + (Math.abs(x - cx) > 30 ? 4 : 0) + Math.floor(hash2(x, 1, seed) * 3);
    for (let y = top; y <= bot; y++) {
      const row = Math.floor((y - top) / 5);
      const comb = Math.sin(x * 2.3 + row * 1.7 + noise1(y / 2, seed) * 2);
      const l = (x < cx ? 1 : -0.6) + (comb > 0.5 ? 1 : comb < -0.6 ? -1 : 0) + ((y - top) % 5 === 4 ? -1 : 0);
      set(b, x, y, pk(SWP.thatch, 4 + l + dz(x, y, 0.6) - (y - top) * 0.03));
    }
    if (hash2(x, 2, seed) < 0.5) set(b, x, top - (hash2(x, 3, seed) < 0.3 ? 1 : 0), pk(SWP.sphag, 3 + (x & 1)));
  }
  // a hole in the thatch, the rafters showing
  for (let x = cx + 10; x < cx + 17; x++) for (let y = Math.round(roofY(x)) + 5; y < Math.round(roofY(x)) + 10; y++) set(b, x, y, (x - cx) % 3 === 0 ? pk(SWP.wood, 3) : pk(SWP.wood, 0));
  // the ridge pole sticking out front, and its maihi boards
  for (let x = x0 - 12; x <= x1 + 10; x++) set(b, x, Math.round(ridge) + 1, pk(SWP.wood, 4 + (x < cx ? 1 : 0)));
  // the hīnaki: a woven eel pot leaning by the door
  for (let j = 0; j < 22; j++) for (let i = 0; i < 6 - Math.max(0, j - 16); i++) {
    const x = x1 + 4 + i + Math.round(j * 0.25), y = gy - j;
    set(b, x, y, (i + j) % 3 === 0 ? pk(SWP.flaxRope, 1) : pk(SWP.flaxRope, 3 + (i < 2 ? 1 : 0)));
  }
  // the drying rack: two forked sticks and a pole with a net on it
  for (const px of [x0 - 14, x0 - 2]) for (let y = gy - 20; y <= gy; y++) set(b, px, y, pk(SWP.wood, 4));
  for (let x = x0 - 15; x <= x0 - 1; x++) set(b, x, gy - 20, pk(SWP.wood, 5));
  for (let x = x0 - 13; x < x0 - 2; x++) for (let y = gy - 19; y < gy - 9 + Math.sin(x) * 1.5; y++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) set(b, x, y, pk(SWP.flaxRope, 2));
  outlineSel(b, 0.5);
  return trimSprite({ buf: b, ax: cx, ay: gy + 1 });
}

/** reflections of the props in the peat water: a darker, flipped, wavering copy (helpers for the scene) */
export const darkenFor = (c: C, k: number) => shade(c, -k);
void fbm2; void clamp;

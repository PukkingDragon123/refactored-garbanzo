// Hand-drawn organic painters shared by the flora, jungle and camp kits: a bush grown from a branching
// skeleton with leaf sprays, a log with a broken end and a ringed cut face, mushrooms with
// hand-shaped caps, and a plank crate and a stave barrel built board by board. No primitive is the
// final look: every silhouette is irregular, shaded by form and broken up by texture.

import { PixelBuffer } from './pixel';
import type { C } from './color';
import { shade } from './color';
import { PAL } from './palettes';
import { Rng, bayer, clamp, fbm2, noise1 } from '../core/math';
import { LIGHT, leaf, tube, outlineSel, flower } from './jungle-core';
import type { LeafShape, P } from './jungle-core';

const h01 = (x: number, y: number, s: number) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const bez = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, n: number): P[] => {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    out.push([a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2]);
  }
  return out;
};

// ------------------------------------------------------------------ the bush

export interface ShrubOpts {
  /** base centre (the bottom row) */
  x: number;
  y: number;
  /** the crown's spread and height */
  w: number;
  h: number;
  ramp: C[];
  /** mid leaf tone index (defaults to the middle of the ramp) */
  base?: number;
  bark?: C[];
  /** leaf length and width */
  leaf?: [number, number];
  shape?: LeafShape;
  flowers?: C[];
  berries?: C[];
  /** -1..1: the crown leans and the wind side is lower */
  lean?: number;
  /** spray density */
  density?: number;
}

/**
 * A bush grown, not stamped: woody stems fork up out of the ground into a lumpy, leaning crown;
 * every branch ends in sprays of separate pointed leaves fanning along it. A dark pass of the same
 * sprays makes the deep interior, the stems show through the gaps, then the sprays are painted again
 * in order of how much they face the light (upper left), so the clusters read as masses with form.
 * A few edge-on leaves break the outline, sparkles catch the sun on top, berries or flowers sit in
 * the lit sprays, and the bottom sits in shadow on the ground.
 */
export function organicShrub(buf: PixelBuffer, rng: Rng, o: ShrubOpts) {
  const rp = o.ramp, top = rp.length - 1;
  const mid = o.base ?? Math.round(top * 0.55);
  const bark = o.bark ?? PAL.bark;
  const [LL, LW] = o.leaf ?? [Math.max(3, o.h * 0.11), Math.max(2, o.h * 0.065)];
  const shape = o.shape ?? 'point';
  const lean = o.lean ?? rng.range(-0.35, 0.35);
  const seed = rng.int(1, 9999);
  const lump = (u: number) => 1 + (noise1(u * 2.4 + 3, seed) - 0.5) * 0.55 + (noise1(u * 6.3 + 9, seed + 1) - 0.5) * 0.25;
  const envH = (u: number) => o.h * Math.pow(Math.max(0, 1 - u * u), 0.42) * lump(u) * (1 + lean * u * 0.3);
  const ux = (u: number) => o.x + u * o.w * 0.5;
  // the skeleton: stems fanning out of the ground, each forking toward the crown's edge
  const branches: { pts: P[]; r: number }[] = [];
  const stems = rng.int(3, 5);
  for (let i = 0; i < stems; i++) {
    const tu = clamp(((i + 0.5) / stems - 0.5) * 1.5 + lean * 0.25 + rng.range(-0.12, 0.12), -0.85, 0.85);
    const tx = ux(tu), ty = o.y - envH(tu) * rng.range(0.66, 0.86);
    const bx = o.x + rng.range(-o.w * 0.07, o.w * 0.07);
    const pts = bez(bx, o.y, (bx + tx) / 2 + rng.range(-o.w * 0.1, o.w * 0.1), o.y + (ty - o.y) * 0.6, tx, ty, 10);
    branches.push({ pts, r: Math.max(1, o.h * 0.045) });
    for (let f = rng.int(1, 3); f > 0; f--) {
      const k = rng.int(4, 8), [px, py] = pts[k];
      const fu = clamp(tu + rng.range(-0.5, 0.5), -0.95, 0.95);
      const fx = ux(fu), fy = o.y - envH(fu) * rng.range(0.6, 0.92);
      branches.push({ pts: bez(px, py, (px + fx) / 2 + rng.range(-3, 3), (py + fy) / 2 - rng.range(0, 3), fx, fy, 7), r: Math.max(0.7, o.h * 0.03) });
    }
  }
  // the sprays: at every branch tip and along the upper half of each branch, plus fill in the crown
  type Spray = { x: number; y: number; a: number; s: number; f: number };
  const sprays: Spray[] = [];
  const facing = (x: number, y: number) => {
    const nx = (x - o.x) / (o.w * 0.5), ny = (y - (o.y - o.h * 0.55)) / (o.h * 0.55);
    const l = Math.hypot(nx, ny) || 1;
    return (nx / l) * LIGHT[0] + (ny / l) * LIGHT[1];
  };
  for (const b of branches) {
    const n = b.pts.length;
    for (let k = n - 1; k >= 2; k -= rng.int(1, 3)) {
      const [px, py] = b.pts[k], [qx, qy] = b.pts[k - 1];
      sprays.push({ x: px, y: py, a: Math.atan2(py - qy, px - qx), s: k === n - 1 ? 1 : rng.range(0.55, 0.85), f: facing(px, py) });
    }
  }
  // (a bush is leafy right down to the ground: the fill reaches the bottom rows)
  const fill = Math.round((o.w * o.h) / 45 * (o.density ?? 1));
  for (let i = 0; i < fill; i++) {
    const u = rng.range(-0.95, 0.95), v = rng.range(0.06, 0.95);
    const x = ux(u), y = o.y - envH(u) * v - 1;
    sprays.push({ x, y, a: Math.atan2(-0.8 - v, u * 1.4), s: rng.range(0.5, 0.9), f: facing(x, y) });
  }
  const drawSpray = (sp: Spray, base: number, grow: number) => {
    const m = Math.round((4 + 4 * sp.s) * grow);
    for (let j = 0; j < m; j++) {
      // leaves fan along the branch, the outer ones drooping a little under their own weight
      let a = sp.a + ((j + 0.5) / m - 0.5) * 2.4 + rng.range(-0.2, 0.2);
      a += Math.cos(a) * 0.15;
      const len = LL * rng.range(0.75, 1.25) * (0.75 + 0.35 * sp.s) * grow;
      const d = rng.range(0, 1.6);
      leaf(buf, sp.x + Math.cos(a) * d, sp.y + Math.sin(a) * d, a, len, LW * rng.range(0.85, 1.15), rp, base, shape);
    }
  };
  // 1. the deep interior: the same sprays, larger and dark
  for (const sp of sprays) drawSpray(sp, clamp(mid - 2 + (sp.f > 0.4 ? 1 : 0), 1, top), 1.15);
  // 2. the stems, showing through the gaps
  for (const b of branches) tube(buf, b.pts, t => b.r * (1 - t * 0.55) + 0.4, bark, 3, { spread: 1.2 });
  // 3. the sprays in light order: shadowed ones first, sunlit ones over them
  sprays.sort((a, b) => a.f - b.f);
  for (const sp of sprays) {
    const low = sp.y > o.y - o.h * 0.28 ? -1 : 0;
    const k = clamp(Math.round(mid + sp.f * 1.7 + low + rng.range(-0.4, 0.4)), 1, top - 1);
    drawSpray(sp, k, 1);
  }
  // 4. edge-on leaves breaking the outline, and sparkles where the sun catches the top
  for (let i = 0; i < Math.max(1, o.w / 16); i++) {
    const u = rng.range(-0.8, 0.8), x = ux(u), y = o.y - envH(u) + rng.range(1, 3);
    const a = Math.atan2(-0.6, u * 1.6) + rng.range(-0.3, 0.3);
    leaf(buf, x, y, a, LL * rng.range(0.7, 0.95), 1.5, rp, clamp(mid + (u < 0 ? 1 : 0), 1, top), 'point');
  }
  const lit = sprays.slice(Math.floor(sprays.length * 0.82));
  for (const sp of lit) {
    const x = Math.round(sp.x + Math.cos(sp.a) * LL * 0.7), y = Math.round(sp.y + Math.sin(sp.a) * LL * 0.7);
    if (buf.opaque(x, y) && rng.chance(0.6)) buf.set(x, y, rp[top]);
  }
  // 5. berries or flowers in the lit sprays
  if (o.berries || o.flowers) {
    const n = Math.round(o.w / 6);
    for (let i = 0; i < n; i++) {
      const sp = sprays[Math.floor(sprays.length * rng.range(0.35, 1))];
      if (!sp) continue;
      const x = Math.round(sp.x + rng.range(-2, 2)), y = Math.round(sp.y + rng.range(-2, 1));
      if (!buf.opaque(x, y)) continue;
      if (o.flowers) {
        const fp = o.flowers, pi = Math.round(fp.length * 0.6);
        flower(buf, x, y, 1, fp, sp.f > 0 ? pi + 1 : pi, PAL.flowerGold[sp.f > 0 ? 5 : 4]);
      } else if (o.berries) {
        const bc = o.berries, bt = bc.length - 1;
        buf.set(x, y, bc[bt]);
        buf.set(x + 1, y, bc[bt - 2]);
        buf.set(x, y + 1, bc[bt - 3]);
        if (rng.chance(0.5)) buf.set(x + 1, y + 1, bc[bt - 4]);
      }
    }
  }
  // 6. it sits on the ground: the bottom rows darken, a few fallen leaves at the foot
  for (let y = Math.floor(o.y - 2); y <= o.y; y++) for (let x = 0; x < buf.w; x++) if (buf.opaque(x, y)) buf.set(x, y, shade(buf.get(x, y), -0.18));
  for (let x = Math.round(o.x - o.w * 0.45); x < o.x + o.w * 0.45; x++) if (!buf.opaque(x, Math.round(o.y)) && h01(x, 1, seed) < 0.3) buf.set(x, Math.round(o.y), rp[clamp(mid - 2, 1, top)]);
}

// ------------------------------------------------------------------ the log

/**
 * A fallen log: a bowed, tapering trunk with a lumpy bark silhouette, plates and fissures running
 * along the grain, knots and a snapped branch stub, a splintered broken end on the left and a sawn
 * face on the right with wobbly growth rings, sapwood, a check crack and a bark rim, moss on the top.
 */
export function organicLog(seed: number, len: number, r: number) {
  const rng = new Rng(seed * 31 + 7);
  const W = Math.ceil(len + 4), H = Math.ceil(r * 2 + 6);
  const buf = new PixelBuffer(W, H);
  const B = PAL.bark, M = PAL.moss, bt = B.length - 1;
  const base = H - 1, face = Math.max(2, Math.round(r * 0.55));
  const x0 = 2, x1 = W - 2 - face;
  const bow = rng.range(-0.6, 0.6) * Math.min(2, r * 0.3);
  // per-column centre and radii (bark plates make the top edge lumpy)
  const cyA: number[] = [], rT: number[] = [], rB: number[] = [];
  for (let x = 0; x < W; x++) {
    const t = clamp((x - x0) / Math.max(1, x1 - x0), 0, 1);
    const R = r * (1.04 - t * 0.12);
    cyA[x] = base - R - Math.sin(t * Math.PI) * bow;
    rT[x] = R + Math.round((noise1(x * 0.32, seed) - 0.5) * 2.2);
    rB[x] = Math.min(R, base - cyA[x]);
  }
  // the broken left end: a jagged profile with splinters
  const brk: number[] = [];
  for (let y = 0; y < H; y++) brk[y] = x0 + Math.round(Math.abs(noise1(y * 0.7, seed + 3) - 0.5) * r * 1.1 + (h01(0, y, seed) < 0.2 ? 2 : 0));
  // 1. the bark
  for (let x = x0; x <= x1; x++) {
    for (let y = Math.floor(cyA[x] - rT[x]); y <= Math.min(base, Math.ceil(cyA[x] + rB[x])); y++) {
      if (y < 0 || x < brk[y]) continue;
      const ny = (y + 0.5 - cyA[x]) / r;
      if (ny < -rT[x] / r - 0.02) continue;
      // grain: fissures running along the trunk, split into plates
      const fis = fbm2(x * 0.06, y * 0.55, 2, seed + 5);
      const plate = noise1(x * 0.15 + Math.round(y * 0.5) * 9.7, seed + 6);
      let l = -ny * 0.85 + (plate - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.25;
      if (fis < 0.36) l -= 0.75;
      else if (fis < 0.4) l += 0.35;
      if (ny > 0.55) l -= 0.35;
      let c = B[clamp(Math.round((l * 0.5 + 0.55) * (bt - 1)) + 1, 1, bt - 1)];
      // moss on the upper faces, in clumps with a lit edge
      const mo = fbm2(x * 0.09, y * 0.25, 2, seed + 7);
      if (ny < -0.3 && mo > 0.47) c = M[clamp(Math.round(3 + (mo - 0.47) * 8 - (ny + 0.3) * 2 + (h01(x, y, seed) < 0.12 ? 1 : 0)), 1, M.length - 1)];
      buf.set(x, y, c);
    }
  }
  // 2. knots and a snapped branch stub
  for (let i = 0; i < Math.max(1, Math.round(len / 40)); i++) {
    const kx = Math.round(rng.range(x0 + r * 2, x1 - r)), ky = Math.round(cyA[kx] + rng.range(-r * 0.4, r * 0.2));
    buf.set(kx, ky, B[0]); buf.set(kx + 1, ky, B[1]); buf.set(kx - 1, ky - 1, B[bt - 1]); buf.set(kx, ky - 1, B[bt - 2]); buf.set(kx + 1, ky + 1, B[2]);
  }
  if (len > 30) {
    const sx = Math.round(rng.range(x0 + len * 0.3, x1 - len * 0.2)), sy = Math.round(cyA[sx] - rT[sx] + 1);
    const ex = sx + rng.range(-3, 3) + 2, ey = sy - Math.max(3, r * 0.8);
    tube(buf, [[sx, sy + 1], [ex, ey]], t => 1.4 - t * 0.5, B, 4, { spread: 1.2 });
    buf.set(Math.round(ex), Math.round(ey), B[bt - 1]);
    buf.set(Math.round(ex) + 1, Math.round(ey), B[bt - 2]);
  }
  // 3. the sawn face: wobbly rings, pale sapwood, a check crack, a bark rim
  const fcx = x1 + face * 0.5, fcy = cyA[x1], ph = rng.range(0, 6);
  for (let y = Math.floor(fcy - r - 1); y <= base; y++) {
    for (let x = x1 - 1; x < W; x++) {
      const dx = (x + 0.5 - fcx) / (face * 0.5 + 0.5), dy = (y + 0.5 - fcy) / r;
      const a = Math.atan2(dy, dx);
      const wob = 1 + (noise1(a * 1.6 + ph, seed + 9) - 0.5) * 0.22;
      const d = Math.hypot(dx, dy) / wob;
      if (d > 1 || y > base) continue;
      let c: C;
      if (d > 0.84) c = B[x < fcx ? 2 : 1];
      else if (d > 0.7) c = B[bt - 1];
      else {
        const ring = Math.floor(d * 5 + (noise1(a * 2.3, seed + 11) - 0.5) * 0.6);
        c = ring % 2 ? B[bt - 2] : B[bt - 1];
        if (d < 0.12) c = B[bt - 3];
        if (Math.abs(a - 0.6) < 0.18 && d > 0.15) c = B[2];
      }
      if (dy > 0.5 && d > 0.6) c = shade(c, -0.15);
      buf.set(x, y, c);
    }
  }
  // 4. splinters on the broken end
  for (let i = 0; i < 3; i++) {
    const y = Math.round(cyA[x0] + rng.range(-r * 0.7, r * 0.6));
    for (let k = 0; k < rng.int(2, 4); k++) buf.set(brk[clamp(y, 0, H - 1)] - k, y - (k > 1 ? 1 : 0), B[bt - 2 - (k % 2)]);
  }
  buf.set(x0, base, B[1]);
  outlineSel(buf, 0.6, 0.25);
  return { buf, ax: W / 2, ay: H };
}

// ------------------------------------------------------------------ mushrooms

/**
 * A little clump of mushrooms, each cap drawn by hand-shaped columns: an asymmetric dome tipped a
 * little off its stem, a rolled lip and a row of gills beneath, a lit shoulder and a shadowed far
 * side, a few pale scales; stems curve, swell at the foot and sit in a tuft of litter.
 */
export function organicMushrooms(seed: number, glow = false) {
  const rng = new Rng(seed * 13 + 5);
  const W = 18, H = 12;
  const buf = new PixelBuffer(W, H);
  const cap = glow ? PAL.glowCyan : PAL.canvasOrange, stem = glow ? PAL.glowCyan : PAL.white;
  const ct = cap.length - 1;
  const n = rng.int(2, 4);
  const list = Array.from({ length: n }, (_, i) => ({ x: 3 + i * (12 / Math.max(1, n - 1)) + rng.range(-1, 1), h: rng.range(4, 9), w: rng.int(4, 7) }));
  list.sort((a, b) => a.h - b.h);
  for (const m of list) {
    const tilt = rng.range(-0.8, 0.8), sx = Math.round(m.x);
    const capY = Math.round(H - m.h);
    // the stem: a slight curve, a swollen foot
    for (let y = H - 1; y > capY; y--) {
      const t = (H - 1 - y) / Math.max(1, H - 1 - capY);
      const x = Math.round(sx + tilt * t * t * 1.5);
      buf.set(x, y, stem[t < 0.15 ? 3 : 5]);
      if (t < 0.25 || m.w > 5) buf.set(x + 1, y, stem[3]);
      if (t < 0.12) buf.set(x - 1, y, stem[4]);
    }
    // the cap: columns of an off-centre dome
    const cx = sx + Math.round(tilt * 1.5), w = m.w, ch = Math.max(2, Math.round(w * 0.45 + rng.range(0, 1)));
    const peak = rng.range(-0.25, 0.25);
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w * 2 - 1;
      const hgt = Math.round(ch * Math.pow(Math.max(0, 1 - (u - peak) * (u - peak) / 1.6), 0.6) + (h01(i, seed, 3) < 0.25 ? -1 : 0));
      const x = cx - Math.floor(w / 2) + i;
      for (let k = 0; k <= hgt; k++) {
        const y = capY - k;
        const lit = u < 0.1 && k > hgt * 0.3;
        let c = cap[k === hgt ? (u < 0 ? ct : ct - 1) : lit ? ct - 1 : u > 0.5 ? ct - 3 : ct - 2];
        if (!glow && k > 0 && k < hgt && h01(x, y, seed) < 0.16) c = PAL.white[6];
        buf.set(x, y, c);
      }
      // the lip and the gills under it
      buf.set(x, capY + 1, i === 0 || i === w - 1 ? cap[ct - 3] : (i % 2 ? cap[1] : cap[2]));
    }
    if (glow) buf.set(cx - 1, capY - ch + 1, cap[ct]);
  }
  // litter at the foot
  for (let x = 1; x < W - 1; x++) if (buf.opaque(x, H - 2) || rng.chance(0.25)) buf.set(x, H - 1, (rng.chance(0.5) ? PAL.moss[2] : PAL.bark[3]));
  outlineSel(buf, 0.55);
  return { buf, ax: W / 2, ay: H };
}

// ------------------------------------------------------------------ crate and barrel

/**
 * A plank crate built board by board: uneven planks with their own grain and tone, dark gaps between
 * them, end battens and a diagonal brace standing proud, nail heads, a chipped corner and a proud
 * plank on the top edge, a worn hand-painted stencil, lit from the upper left.
 */
export function organicCrate(w = 18, h = 14, stencil = true, seed = 4) {
  const rng = new Rng(seed * 17 + 3);
  const buf = new PixelBuffer(w, h);
  const B = PAL.bark, bt = B.length - 1;
  // planks: uneven heights, each its own tone
  const rows: { y0: number; y1: number; k: number }[] = [];
  for (let y = 1; y < h - 1;) {
    const ph = Math.min(h - 1 - y, rng.int(3, 5));
    rows.push({ y0: y, y1: y + ph, k: rng.range(-0.25, 0.25) });
    y += ph;
  }
  const bat = Math.max(2, Math.round(w * 0.13));
  const proud = rng.int(bat + 1, w - bat - 3);
  const set = (x: number, y: number, l: number) => buf.set(x, y, B[clamp(Math.round(l), 1, bt)]);
  for (const r of rows) {
    for (let y = r.y0; y < r.y1; y++) for (let x = 0; x < w; x++) {
      const gap = y === r.y1 - 1;
      const grain = noise1(x * 0.35 + r.y0 * 5.3, seed) - 0.5 + (h01(x, y, seed) < 0.06 ? -0.6 : 0);
      let l = 4.3 + r.k * 3 + grain * 1.6 - (x / w) * 1.2 - (y / h) * 0.8;
      if (gap) l = 1.6;
      set(x, y, l);
    }
  }
  // the top edge and the bottom: a top board with one plank standing proud, a shadowed foot
  for (let x = 0; x < w; x++) set(x, 0, 6 - (x / w) * 1.5);
  for (let x = proud; x < proud + 3; x++) set(x, 0, 6.4);
  buf.set(proud + 1, 0, B[bt]);
  for (let x = 0; x < w; x++) set(x, h - 1, 2);
  // the battens and the brace, proud of the planks
  for (let y = 0; y < h; y++) for (let b = 0; b < bat; b++) {
    set(b, y, b === 0 ? 6 : 5 - (y / h));
    set(w - 1 - b, y, b === 0 ? 2.2 : 3.6 - (y / h) * 0.6);
  }
  for (let y = 1; y < h - 1; y++) {
    const x = Math.round(bat + ((y - 1) / (h - 3)) * (w - bat * 2 - 2));
    set(x, y, 5.2); set(x + 1, y, 4.2); if (x + 2 < w - bat) set(x + 2, y, 2.6);
  }
  // nails where the battens cross the planks
  for (const r of rows) for (const x of [Math.floor(bat / 2), w - 1 - Math.floor(bat / 2)]) { buf.set(x, r.y0 + 1, PAL.metal[6]); buf.set(x, r.y0 + 2, PAL.metal[2]); }
  // the stencil, hand-painted and worn
  if (stencil && w >= 14) {
    const sx = Math.round(w / 2 - 3), sy = Math.round(h / 2 - 1);
    const glyph = ['#.#.##', '.#..#.', '#.#.##'];
    glyph.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#' && h01(i, j, seed) > 0.18) buf.set(sx + i, sy + j, PAL.white[3 + (i + j) % 2]); }));
  }
  // wear: a chipped top corner, a splinter, a scuff
  buf.set(w - 1, 0, 0); buf.set(w - 2, 0, 0); buf.set(w - 1, 1, 0);
  buf.set(0, 0, 0);
  const sy2 = rows[Math.min(rows.length - 1, 1)]?.y0 ?? 3;
  buf.set(w - bat - 2, sy2, B[bt]); buf.set(w - bat - 3, sy2, B[bt - 1]);
  buf.outline(c => shade(c, -0.6));
  return { buf, ax: w / 2, ay: h };
}

/**
 * A painted stave barrel: a bulging silhouette made of staves with dark seams, cylinder light from the
 * left, iron hoops with a highlight and rust, a lid rim, paint worn through to the wood at the
 * edges, and a dent.
 */
export function organicBarrel(color: C[] = PAL.blue, seed = 3) {
  const W = 12, H = 17;
  const buf = new PixelBuffer(W, H);
  const ct = color.length - 1, Mt = PAL.metal, Bk = PAL.bark;
  const cx = W / 2;
  const hoops = [2, 8, H - 3];
  for (let y = 1; y < H; y++) {
    const t = (y - 1) / (H - 2);
    const hw = 4.2 + Math.sin(t * Math.PI) * 1.4;
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - cx) / hw;
      if (Math.abs(nx) > 1) continue;
      // staves: bands about two pixels wide, curving with the bulge, each a touch different
      const sv = Math.floor((nx * 0.5 + 0.5) * 5.2);
      let l = -nx * 2.1 + (h01(sv, 0, seed) - 0.5) * 0.7 + 3.4;
      const seam = Math.abs(((nx * 0.5 + 0.5) * 5.2) % 1) < 0.16 && Math.abs(nx) < 0.85;
      let c = color[clamp(Math.round(l), 0, ct)];
      if (seam) c = color[clamp(Math.round(l) - 2, 0, ct)];
      // worn paint at the rims and edges shows the wood
      if ((y <= 2 || y >= H - 2 || Math.abs(nx) > 0.82) && h01(x, y, seed + 1) < 0.3) c = Bk[clamp(Math.round(l + 1), 1, Bk.length - 1)];
      if (hoops.includes(y)) {
        c = Mt[clamp(Math.round(l + 1), 1, Mt.length - 1)];
        if (h01(x, y, seed + 2) < 0.18) c = PAL.canvasOrange[2];
      } else if (hoops.includes(y - 1)) c = shade(c, -0.25);
      buf.set(x, y, c);
    }
  }
  // the lid rim and a dent
  for (let x = 2; x < W - 2; x++) buf.set(x, 1, x < cx ? Mt[5] : Mt[3]);
  buf.set(Math.round(cx) + 2, 11, color[1]); buf.set(Math.round(cx) + 2, 12, color[ct - 1]);
  buf.set(3, 4, color[ct]); buf.set(3, 5, color[ct]); buf.set(3, 10, color[ct]);
  buf.outline(c => shade(c, -0.6));
  return { buf, ax: W / 2, ay: H };
}

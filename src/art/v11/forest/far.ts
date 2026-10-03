// V11 Te Wao Nui, the far forest: the colonnade of giants behind the walk line, fading rank after rank
// into the mist. Each layer is one wide strip (painted with horizontal wrap so tiles repeat cleanly):
// trunks rising out of the top into a canopy band, lianas and hanging vines between them, tree ferns
// and nīkau, an undergrowth band along the ground line with the forest floor solid below it, and low
// mist banks pooled between the trunks. `k` runs from the farthest layer (0: pale, thin, few details)
// to the nearest far layer (1: bigger trunks, moss, epiphytes, more contrast).

import { PixelBuffer } from '../../pixel';
import { C, mix, shade } from '../../color';
import { Rng, clamp, smoothstep } from '../../../core/math';
import { leafMass, frond, tube, vine, pnoise1, pnoise2, pfbm1, pfbm2, sag, rc } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { FP, ws, pick, hazeRamp } from './kit';

export interface FarOpts {
  W: number;
  H: number;
  /** ground line row: the trunk bases and the undergrowth's foot */
  gl: number;
  seed: number;
  /** 0 the farthest .. 1 the nearest far layer */
  k: number;
  /** the haze colour, and how much every colour is pre-mixed toward it */
  fog: C;
  haze: number;
  /** trunk spacing scale (1 = default) */
  density?: number;
  /** what to paint (all by default): the undergrowth band alone makes the near-back hedge */
  parts?: { trunks?: boolean; ferns?: boolean; canopy?: boolean; under?: boolean; mist?: boolean };
  /** undergrowth band scale (1 = default) */
  under?: number;
}

type Bark = 'kauri' | 'podo' | 'rata';

/** a wrapped trunk column from `bot` up to `top` */
function trunk(buf: PixelBuffer, x: number, top: number, bot: number, w: number, rp: C[], bark: Bark, seed: number, o: { lean: number; flare: number; moss: number; mossRp: C[]; light: number }) {
  const W = buf.w;
  // x noise exactly periodic over the strip (lattice x * P / W with P cells across it)
  const P1 = Math.max(1, Math.round(W * 0.22)), P2 = Math.max(1, Math.round(W * 0.18)), P3 = Math.max(1, Math.round(W * 0.08));
  const n = rp.length - 1;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(buf.h, Math.ceil(bot)); y++) {
    const fromBot = bot - y;
    const hw = (w / 2) * (1 + Math.exp(-fromBot / Math.max(2, w * 0.55)) * o.flare) + (pnoise1(y * 0.045, 64, seed) - 0.5) * Math.min(2, w * 0.08);
    const cx = x + o.lean * fromBot + (pnoise1(y * 0.008, 32, seed + 3) - 0.5) * w * 0.18;
    for (let px = Math.floor(cx - hw); px <= Math.ceil(cx + hw); px++) {
      const nx = (px + 0.5 - cx) / hw;
      if (nx < -1 || nx > 1) continue;
      // cylinder lit from the upper left, a cool bounce on the far edge
      let l = -nx * 1.05 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.35 - 0.1;
      if (nx > 0.86) l += 0.35;
      const u = Math.asin(nx) * hw;
      if (bark === 'kauri') {
        // hammered flakes: rounded scales, darker seams between them
        const f = pnoise2((px * P1) / W + nx * 2, y * 0.11, P1, seed + 7);
        l += (f - 0.5) * 0.7;
        if (Math.abs(pnoise2((px * P2) / W, y * 0.07, P2, seed + 9) - 0.5) < 0.03) l -= 0.6;
      } else if (bark === 'podo') {
        // long fibrous strips
        const s = Math.sin(u * 0.9 + pnoise1(y * 0.02, 64, seed + 11) * 5);
        if (s > 0.72) l -= 0.75;
        l += (pnoise2(u * 0.3, y * 0.05, 64, seed + 13) - 0.5) * 0.5;
      } else {
        // twisting ridges climbing the trunk
        const s = Math.sin(u * 0.5 + y * 0.09 + pnoise1(y * 0.03, 64, seed + 17) * 3);
        if (s > 0.6) l -= 0.8;
        else if (s < -0.7) l += 0.3;
      }
      let c = pick(rp, n * (0.42 + o.light * 0.12) + l * n * 0.2);
      if (o.moss > 0) {
        // moss on the lit, wet side and the root flare
        const m = pnoise2((px * P3) / W, y * 0.05 + nx, P3, seed + 21) * 0.75 + (1 - nx) * 0.12 + Math.max(0, 1 - fromBot / (w * 1.6)) * 0.25;
        if (m > 1 - o.moss * 0.5) c = pick(o.mossRp, o.mossRp.length * 0.45 + l * 2 + (m - 1 + o.moss * 0.5) * 6);
      }
      ws(buf, px, y, c);
    }
  }
}

/** a tree fern silhouette: a thin trunk and a crown of arching fronds */
function treeFern(buf: PixelBuffer, rng: Rng, x: number, gl: number, h: number, trunkRp: C[], fernRp: C[], k: number) {
  const W = buf.w;
  const lean = rng.range(-0.12, 0.12);
  const tw = Math.max(1.5, 1.6 + k * 2.6);
  const pts: P[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x + lean * h * t + Math.sin(t * 3 + x) * 1.5, gl - h * t]); }
  tube(buf, pts, t => tw * (1.25 - t * 0.35), trunkRp, 3, { wrapW: W, rim: false });
  const [tx, ty] = pts[pts.length - 1];
  const n = rng.int(6, 9);
  const len = h * rng.range(0.45, 0.62) + 8;
  // the back fronds darker, then the front ones
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n - 0.5) * 2.9 + rng.range(-0.15, 0.15);
    frond(buf, { x: tx, y: ty, ang: a, len: len * rng.range(0.8, 1.1), droop: 0.95, ramp: fernRp, base: pass ? 5 : 3, pinna: 2 + k * 3.5, pinnaW: 1.6 + k, gap: 1.6 + k * 0.6, wrapW: W, bare: 0.08, sweep: 0.95 });
  }
}

/** a nīkau palm: ringed slender trunk, a bulging crownshaft, a shuttlecock of stiff fronds */
function nikau(buf: PixelBuffer, rng: Rng, x: number, gl: number, h: number, trunkRp: C[], leafRp: C[], k: number) {
  const W = buf.w;
  const tw = 1.4 + k * 1.8;
  for (let y = gl; y > gl - h; y--) {
    const ring = (gl - y) % 5 === 0;
    for (let dx = -tw; dx <= tw; dx++) ws(buf, x + dx, y, pick(trunkRp, (ring ? 2 : 4) + (dx < 0 ? 1 : 0)));
  }
  const top = gl - h;
  for (let y = top - 6; y < top + 2; y++) for (let dx = -tw - 1; dx <= tw + 1; dx++) ws(buf, x + dx, y, pick(leafRp, 3 + (dx < 0 ? 1 : 0)));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.4;
    frond(buf, { x, y: top - 6, ang: a, len: h * 0.42 + 6, droop: 0.55, ramp: leafRp, base: 4, pinna: 3 + k * 4, pinnaW: 1.4, gap: 1.4, wrapW: W, sweep: 0.5, bare: 0.04 });
  }
  void rng;
}

/** the colonnade strip: see the header */
export function paintColonnade(o: FarOpts): PixelBuffer {
  const { W, H, gl, seed, k } = o;
  const buf = new PixelBuffer(W, H);
  const rng = new Rng(seed * 97 + 13);
  const hz = (rp: C[], extra = 0) => hazeRamp(rp, o.fog, clamp(o.haze + extra, 0, 0.95));
  const dens = o.density ?? 1;
  const canopyRp = hz(FP.canopy, 0.04), mossRp = hz(FP.moss, 0.05), fernRp = hz(FP.fern, 0.02), trunkFern = hz(FP.podo, 0.12);
  const barks: [Bark, C[]][] = [['kauri', hz(FP.kauri)], ['podo', hz(FP.podo)], ['rata', hz(FP.rata)], ['kauri', hz(FP.kauri, 0.05)]];
  // ---- two ranks of trunks: a hazier, thinner back rank, then the main rank
  const ranks = [
    { step: (120 - 40 * k) * dens, w: [6 + 10 * k, 12 + 18 * k], haze: 0.16, moss: 0 },
    { step: (190 - 60 * k) * dens, w: [12 + 22 * k, 22 + 46 * k], haze: 0, moss: 0.25 + k * 0.6 },
  ];
  const parts = o.parts ?? {};
  const on = (k: keyof NonNullable<FarOpts['parts']>) => parts[k] !== false;
  const uk = o.under ?? 1;
  const trunkXs: number[] = [];
  if (on('trunks')) for (const [ri, rk] of ranks.entries()) {
    for (let x = rng.range(0, rk.step); x < W; x += rk.step * rng.range(0.6, 1.4)) {
      const [bark, rp0] = barks[rng.int(0, barks.length - 1)];
      const rp = rk.haze ? hazeRamp(rp0, o.fog, rk.haze) : rp0;
      const w = rng.range(rk.w[0], rk.w[1]);
      trunk(buf, x, -4, gl + 3 - ri * 2, w, rp, bark, seed + Math.round(x), { lean: rng.range(-0.025, 0.025), flare: ri ? rng.range(0.6, 1.2) : 0.5, moss: rk.moss, mossRp, light: rng.range(-1, 1) });
      if (ri === 1) trunkXs.push(x);
      // a few limbs high up, angling into the canopy
      if (ri === 1 && rng.chance(0.6)) {
        const y0 = rng.range(gl * 0.05, gl * 0.3), dir = rng.sign();
        tube(buf, [[x + dir * w * 0.3, y0 + w], [x + dir * w * 1.2, y0], [x + dir * w * 2.2, y0 - w * 0.9]], t => Math.max(1, w * 0.18 * (1 - t * 0.6)), rp, 5, { wrapW: W, rim: false });
      }
      // epiphyte nests on the main rank (astelia and nest ferns perched in the forks)
      if (ri === 1 && k > 0.25) for (let e = 0; e < rng.int(0, 2); e++) {
        const ey = rng.range(gl * 0.2, gl * 0.75), ex = x + rng.range(-w * 0.45, w * 0.45);
        leafMass(buf, rng, { cx: ex, cy: ey, rx: w * 0.42 + 3, ry: w * 0.24 + 2, ramp: fernRp, base: 3, steps: 2, shape: 'lance', len: [3, 5 + k * 3], wid: [1.5, 2.5], density: 0.8, droop: 0.6, wrapW: W, jag: 0.55 });
      }
    }
  }
  // ---- lianas looping between the trunks, vines hanging out of the canopy
  if (on('trunks')) for (let i = 0; i + 1 < trunkXs.length; i++) {
    if (!rng.chance(0.55)) continue;
    const a = trunkXs[i], b = trunkXs[i + 1];
    const y0 = rng.range(gl * 0.1, gl * 0.45), y1 = y0 + rng.range(-20, 20);
    tube(buf, sag(a, y0, b, y1, rng.range(20, 60) * (0.6 + k * 0.6)), () => 0.6 + k * 0.9, hz(FP.podo, 0.05), 3, { wrapW: W, rim: false });
  }
  if (on('canopy')) for (let i = 0; i < (W / 40) * (0.5 + k); i++) {
    const x = rng.range(0, W);
    vine(buf, rng, x, rng.range(0, gl * 0.2), rng.range(gl * 0.15, gl * 0.6), fernRp, 3 + Math.round(k * 2), { leafEvery: 3 + Math.round(3 - k * 2), leafLen: 2 + k * 3, wrapW: W, wave: 1 + k });
  }
  // ---- tree ferns and nīkau in the gaps
  if (on('ferns')) for (let x = rng.range(0, 80); x < W; x += rng.range(70, 170) * dens) {
    const h = rng.range(36, 70) + k * rng.range(30, 70);
    if (rng.chance(0.18 + k * 0.1)) nikau(buf, rng, x, gl + 2, h * 1.3, hz(FP.stone, 0.05), hz(FP.fern, 0.04), k);
    else treeFern(buf, rng, x, gl + 2, h, trunkFern, fernRp, k);
  }
  // ---- the canopy band at the top: dense masses, lobes hanging into the trunks
  const cb = gl * (0.22 - k * 0.04);
  if (on('canopy')) for (let x = 0; x < W; x += rng.range(14, 26)) {
    const r = rng.range(14, 26) * (0.8 + k * 0.6);
    const yy = rng.range(-6, cb * 0.55);
    leafMass(buf, rng, { cx: x, cy: yy, rx: r * 1.3, ry: r * 0.8, ramp: canopyRp, base: 2, steps: 2, shape: 'point', len: [3 + k * 2, 5 + k * 3], wid: [2, 3 + k], density: 0.85, droop: 0.7, wrapW: W, jag: 0.5 });
  }
  if (on('canopy')) for (let y = 0; y < Math.max(4, cb * 0.35); y++) for (let x = 0; x < W; x++) if (!(buf.data[y * W + x] >>> 24)) buf.data[y * W + x] = rc(canopyRp, 1);
  if (on('canopy')) for (let x = 0; x < W; x += rng.range(20, 40)) {
    if (!rng.chance(0.6)) continue;
    const r = rng.range(10, 18) * (0.8 + k * 0.5);
    leafMass(buf, rng, { cx: x, cy: cb + rng.range(-4, 14), rx: r, ry: r * 1.15, ramp: canopyRp, base: 3, steps: 2, shape: 'point', len: [3, 5 + k * 2], wid: [2, 3], density: 0.75, droop: 0.85, wrapW: W, jag: 0.6 });
  }
  // ---- the undergrowth along the ground line, solid floor below
  const floorRp = hz(FP.soil, 0.1), shrubRp = hz(FP.fern, 0.06);
  const PF = Math.max(1, Math.round(W * 0.05));
  if (on('under')) for (let x = 0; x < W; x++) {
    const top = gl + 2 + Math.round((pfbm1((x / W) * 30, 30, 2, seed + 41) - 0.5) * 4);
    for (let y = top; y < H; y++) {
      const d = y - top;
      const m = pnoise2((x * PF) / W, y * 0.12, PF, seed + 43);
      ws(buf, x, y, m > 0.55 ? pick(mossRp, 4 - d * 0.05 + (m - 0.55) * 6) : pick(floorRp, 5 - d * 0.06 + (m - 0.5) * 3));
    }
  }
  // (the band swells and thins along the strip: low gaps let the eye on through, deeper in)
  const swell = (x: number) => 0.3 + 0.7 * smoothstep(0.32, 0.68, pfbm1((x / W) * 14, 14, 2, seed + 61));
  if (on('under')) for (let x = rng.range(0, 20); x < W; x += rng.range(10, 24)) {
    const sw = swell(x);
    if (sw < 0.45 && rng.chance(0.5)) continue;
    const r = rng.range(8, 18) * (0.7 + k * 0.7) * uk * sw;
    leafMass(buf, rng, { cx: x, cy: gl - r * 0.35, rx: r * 1.3, ry: r * 0.75, ramp: rng.chance(0.4) ? mossRp : shrubRp, base: 2, steps: 3, shape: rng.chance(0.5) ? 'oval' : 'lance', len: [3, 4 + k * 3], wid: [2, 3 + k], density: 0.9, droop: 0.3, wrapW: W, jag: 0.5, flatBottom: 0.6 });
  }
  if (on('under')) for (let i = 0; i < (W / 22) * (0.4 + k); i++) {
    const x = rng.range(0, W), a = -Math.PI / 2 + rng.range(-1.1, 1.1);
    frond(buf, { x, y: gl + 2, ang: a, len: rng.range(10, 22) * (0.7 + k * 0.7) * uk, droop: 0.7, ramp: fernRp, base: 4, pinna: (2 + k * 2) * Math.sqrt(uk), pinnaW: 1.4, gap: 1.5, wrapW: W, bare: 0.05 });
  }
  // ---- mist: pooled low between the trunks, banked and drifting, thinner up in the canopy
  const per = Math.max(8, Math.round(W / 60));
  if (on('mist')) for (let y = 0; y < H; y++) {
    const low = smoothstep(gl - 60 - k * 30, gl + 6, y) * (0.32 - k * 0.12);
    const high = (1 - smoothstep(0, gl * 0.5, y)) * 0.12 * (1 - k);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, c = buf.data[i];
      if (!(c >>> 24)) continue;
      const bank = pfbm2((x / W) * per, y * 0.03, per, 2, seed + 51);
      const f = low * (0.45 + bank * 1.1) + high;
      if (f > 0.01) buf.data[i] = mix(c, o.fog, clamp(f, 0, 0.8));
    }
  }
  return buf;
}

/**
 * The farthest backdrop: luminous mist with the ghosts of giants in it (a vertical gradient from
 * the canopy-dark top through the bright light-filled middle to the shaded floor), tileable.
 */
export function paintBackdrop(W: number, H: number, mid: number, seed: number, cols: { top: C; mid: C; low: C; ghost: C }): PixelBuffer {
  const buf = new PixelBuffer(W, H);
  const rng = new Rng(seed * 61 + 5);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const c = y < mid ? mix(cols.top, cols.mid, smoothstep(0, mid, y) ** 0.8) : mix(cols.mid, cols.low, smoothstep(mid, H, y));
    for (let x = 0; x < W; x++) {
      // faint banding of light in the haze
      const n = pfbm2((x / W) * 10, y * 0.02, 10, 2, seed + 3);
      buf.data[y * W + x] = mix(c, shade(c, 0.06), clamp((n - 0.45) * 1.6, 0, 1) * (1 - Math.abs(t - 0.45)));
    }
  }
  // the ghosts of the farthest trunks, barely darker than the air
  for (let x = rng.range(0, 60); x < W; x += rng.range(60, 140)) {
    const w = rng.range(5, 16), lean = rng.range(-0.02, 0.02);
    for (let y = 0; y < H; y++) {
      const fade = smoothstep(0, mid * 0.6, y) * (1 - smoothstep(H * 0.82, H, y)) * 0.55;
      const hw = w / 2 * (1 + Math.exp(-(H * 0.85 - y) / 10) * 0.6);
      const cx = x + lean * (H - y);
      for (let px = Math.floor(cx - hw); px <= Math.ceil(cx + hw); px++) {
        const i = y * W + (((px % W) + W) % W);
        buf.data[i] = mix(buf.data[i], cols.ghost, fade * (0.6 + 0.4 * (px < cx ? 0.6 : 1)));
      }
    }
  }
  return buf;
}

// V9 sea cave pieces, layered from the camera inward:
//   paintCaveFront   the rock right in front of the camera (front layer): a heavy roof with ribs and
//                    clusters of dripping stalactites, ragged skylights fringed with ferns and roots,
//                    the entrance pillars at both mouths (bush and vines on their sunlit outer sides)
//                    and a lip of tumbled, wet boulders along the bottom of the frame;
//   paintCaveColumn  flowstone columns and curtains standing between the walk line and the back wall;
//   paintStalagmite  a dripstone cone on the floor (with a wet glossy tip).
// All silhouettes are built from noise and overlapping shapes, never straight cuts.

import { PixelBuffer } from '../pixel';
import { C, hex, mix, shade } from '../color';
import { Rng, bayer, clamp, fbm1, fbm2, hash2, noise1, noise2, smoothstep } from '../../core/math';
import { JP, Sprite, rc, frond, blade, outlineSel } from '../jungle-core';

const H = (s: string) => hex(s);
const RK = ['#0b0a0d', '#121014', '#19161b', '#211d23', '#2b262c', '#363037', '#433c42', '#544b50', '#685d5e'].map(H);
const pick = (r: C[], v: number) => r[clamp(Math.floor(v), 0, r.length - 1)];

export interface CaveFront {
  buf: PixelBuffer;
  /** stalactite tips (buffer px) where drips form */
  tips: [number, number][];
}

/**
 * w x h buffer; the roof's underside sits around `roof` px from the top, the lip rises `lip` px from
 * the bottom, the entrance pillars stand `pillar` px wide at both ends; skylights [x, radius].
 */
export function paintCaveFront(w: number, h: number, seed: number, o: { roof: number; lip: number; pillar: number; skylights: [number, number][] }): CaveFront {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  const tips: [number, number][] = [];
  const P = o.pillar;
  // pillars stand well into the frame: wide crags of rock
  // the pillars' inner edges (ragged), the roof's underside, the lip's top
  const pillarL = (y: number) => P * (0.75 + (fbm1(y / 26, 3, seed) - 0.5) * 0.7) + Math.max(0, (o.roof - y)) * 0.6 + Math.max(0, y - (h - o.lip)) * 0.5;
  const pillarR = (y: number) => w - P * (0.75 + (fbm1(y / 24, 3, seed + 1) - 0.5) * 0.7) - Math.max(0, (o.roof - y)) * 0.6 - Math.max(0, y - (h - o.lip)) * 0.5;
  const roofAt = (x: number) => o.roof * (0.78 + fbm1(x / 46, 3, seed + 2) * 0.4) + (noise1(x / 9, seed + 3) - 0.5) * 10;
  const lipAt = (x: number) => h - o.lip * (0.55 + fbm1(x / 30, 3, seed + 4) * 0.8);
  // the outer hull: the mass reaches the buffer's sides only up in the roof (off the top of the
  // screen); lower down its outer faces are ragged crags, so no straight edge ever shows outside
  const hullL = (y: number) => P * 0.42 * smoothstep(o.roof * 0.15, h * 0.9, y) * (0.7 + fbm1(y / 14, 3, seed + 12) * 0.7) + (noise1(y / 3, seed + 13) - 0.5) * 3;
  const hullR = (y: number) => w - P * 0.42 * smoothstep(o.roof * 0.15, h * 0.9, y) * (0.7 + fbm1(y / 15, 3, seed + 14) * 0.7) - (noise1(y / 3, seed + 15) - 0.5) * 3;
  // ---- rock everywhere outside the opening
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < hullL(y) || x > hullR(y)) continue;
    const inL = x < pillarL(y), inR = x > pillarR(y);
    const roof = roofAt(x), lip = lipAt(x);
    const inRoof = y < roof, inLip = y > lip;
    if (!inL && !inR && !inRoof && !inLip) continue;
    // edge distance for the rim light (the lit underside of the roof, the inner faces of the pillars)
    const dRoof = roof - y, dLip = y - lip, dL = pillarL(y) - x, dR = x - pillarR(y);
    let v = 2.4 + (fbm2(x / 14, y / 10, 3, seed + 5) - 0.5) * 2.2;
    // rock ribs across the roof, cracks in the pillars
    if (inRoof && Math.abs(Math.sin(x * 0.07 + fbm2(x / 30, y / 20, 2, seed + 6) * 4)) < 0.08) v -= 1.2;
    let c = pick(RK, v + (bayer(x, y) - 0.5) * 0.6);
    if (inRoof && dRoof < 2.5 && !inL && !inR) c = pick(RK, 6.5 - dRoof);
    if (inLip && dLip < 2 && !inL && !inR) c = pick(RK, 7 - dLip * 1.5);
    if (inL && dL < 2.5 && !inRoof) c = pick(RK, 6 - dL);
    if (inR && dR < 2.5 && !inRoof) c = pick(RK, 5 - dR);
    // the outer, sunlit faces of the pillars: greener, lighter, with bush
    const outer = inL ? (x - hullL(y)) / P : inR ? (hullR(y) - x) / P : 9;
    if (outer < 0.3) {
      // sunlit rock with clumps of moss and fern clinging in patches, not a green wall
      const g = noise2(x / 3, y / 3, seed + 7), patch = noise2(x / 9, y / 14, seed + 18);
      c = pick(RK, 4.5 + g * 2.5 - outer * 6);
      if (patch > 0.62 && outer < 0.16) c = g > 0.55 ? rc(JP.moss, 3 + g * 4) : rc(JP.fern, 2 + g * 3);
    }
    // wet streaks on the lip and the pillar feet
    if ((inLip || y > h - o.lip * 1.2) && noise2(x / 2, y / 6, seed + 8) > 0.74) c = mix(c, H('#4a5658'), 0.5);
    b.data[y * w + x] = c;
  }
  // ---- boulders on the lip, rounder silhouettes breaking its line
  for (let i = 0; i < 9; i++) {
    const bx = rng.range(P * 0.8, w - P * 0.8), r = rng.range(10, 24);
    const by = lipAt(bx) + r * 0.45;
    b.ellipseFn(bx, by, r * 1.3, r, (x, y, nx, ny) => {
      const l = -nx * 0.4 - ny * 0.8 + (fbm2(x / 4, y / 3, 2, seed + i) - 0.5) * 0.6;
      let c = pick(RK, 3 + l * 2.6);
      if (ny < -0.6 && hash2(x, y, seed + 9) < 0.4) c = H('#6a7270');
      return c;
    });
  }
  // ---- stalactite clusters hanging from the roof
  for (let x = P; x < w - P; x += rng.range(3, 9)) {
    const r0 = roofAt(x);
    const cl = noise1(x / 22, seed + 10);
    if (cl < 0.35 && !rng.chance(0.2)) continue;
    const len = rng.range(6, 18) + cl * 34 * rng.next();
    const wid = Math.max(1.5, len * rng.range(0.1, 0.18));
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const hw = wid * (1 - t) * (1 - t * 0.3);
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        if (Math.abs(dx) > hw + 0.3) continue;
        const px = Math.round(x + dx + Math.sin(k * 0.3 + x) * 0.4), py = Math.round(r0 - 2 + k);
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const l = -dx / Math.max(1, hw);
        b.data[py * w + px] = pick(RK, 3.5 + l * 2 + (t > 0.85 ? 1.5 : 0));
      }
    }
    if (len > 14) tips.push([Math.round(x), Math.round(r0 - 2 + len)]);
    // a glossy wet tip
    b.set(x, r0 - 3 + len, H('#9aaeb0'));
  }
  // ---- skylights: ragged holes in the roof, ferns and roots dangling through
  for (const [sx, sr] of o.skylights) {
    for (let y = 0; y < o.roof * 1.2; y++) for (let x = Math.floor(sx - sr * 3); x <= sx + sr * 3; x++) {
      if (x < 0 || x >= w) continue;
      // a shaft through the rock that opens out upward, its sides chipped and stepped
      const rr = sr * (0.8 + (1 - y / o.roof) * 0.9) * (1 + (noise1(y / 5 + sx, seed + 16) - 0.5) * 0.6);
      const nx = (x - sx - (noise1(y / 11, seed + 17) - 0.5) * sr) / rr, ny = y / (o.roof * 1.1);
      const q = nx * nx + ny * ny * 0.15;
      if (q < 1 && y < roofAt(x) + 3) b.data[y * w + x] = 0;
      else if (q < 1.5 && b.data[y * w + x] >>> 24 && y < roofAt(x)) b.data[y * w + x] = noise2(x / 2.5, y / 2.5, seed + 11) > 0.45 ? rc(JP.moss, 5) : rc(JP.fern, 3);
    }
    for (let i = 0; i < 7; i++) {
      const x0 = sx + rng.range(-sr * 1.4, sr * 1.4);
      const y0 = roofAt(x0) - 2;
      if (rng.chance(0.5)) frond(b, { x: x0, y: y0, ang: Math.PI / 2 + rng.range(-0.6, 0.6), len: rng.range(8, 16), droop: 0.3, ramp: JP.fern, base: 4, pinna: 2.6, rng });
      else for (let k = 0; k < rng.range(10, 28); k++) b.set(x0 + Math.sin(k * 0.25 + i) * 1.2, y0 + k, k % 5 === 2 ? rc(JP.moss, 5) : H('#3a2a1e'));
    }
  }
  // ---- bush on the pillars' outer faces: flax and ferns leaning out into the light
  for (const side of [0, 1]) for (let i = 0; i < 7; i++) {
    const y = rng.range(o.roof * 0.5, h - o.lip * 0.6);
    const x = side ? hullR(y) - rng.range(0, 4) : hullL(y) + rng.range(0, 4);
    if (rng.chance(0.5)) blade(b, { x, y, ang: (side ? -0.6 : -2.5) + rng.range(-0.3, 0.3), len: rng.range(14, 26), droop: 0.4, w0: 2.6, ramp: JP.flax, base: 5 });
    else frond(b, { x, y, ang: (side ? -0.3 : -2.8) + rng.range(-0.4, 0.4), len: rng.range(12, 20), droop: 0.7, ramp: JP.fern, base: 5, pinna: 3, rng });
  }
  return { buf: b, tips };
}

/** a flowstone column joining roof and floor, or a curtain hanging partway (mid layer) */
export function paintCaveColumn(seed: number, w: number, h: number, full: boolean): Sprite {
  const rng = new Rng(seed);
  const b = new PixelBuffer(w, h);
  const cx = w / 2;
  const bot = full ? h : h * rng.range(0.45, 0.7);
  for (let y = 0; y < bot; y++) {
    const t = y / h;
    // waisted in the middle, flaring at the roof and the floor, rippled by flowstone
    const waist = full ? 0.38 + 0.62 * Math.pow(Math.abs(t - 0.55) * 2, 1.6) : 1 - Math.pow(y / bot, 1.4) * 0.9;
    const hw = (w / 2 - 1) * clamp(waist, 0.12, 1) * (1 + (noise1(y / 7, seed) - 0.5) * 0.22);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      if (x < 0 || x >= w) continue;
      const nx = (x + 0.5 - cx) / Math.max(1, hw);
      const ripple = Math.sin(x * 0.9 + noise1(y / 12, seed + 1) * 3) * 0.4;
      const l = -nx * 0.9 + ripple + (fbm2(x / 3, y / 6, 2, seed + 2) - 0.5) * 0.6;
      let c = pick(RK, 3.6 + l * 1.8);
      if (nx < -0.75) c = pick(RK, 6.5);
      if (noise2(x / 1.5, y / 8, seed + 3) > 0.8) c = mix(c, H('#7a8486'), 0.35);
      b.data[y * w + x] = c;
    }
  }
  void rng;
  return { buf: b, ax: Math.round(cx), ay: h - 1 };
}

/** a dripstone cone with a glossy wet tip */
export function paintStalagmite(seed: number, w: number, h: number): Sprite {
  const b = new PixelBuffer(w, h + 1);
  const cx = w / 2;
  for (let y = 0; y <= h; y++) {
    const t = y / h;
    const hw = (w / 2) * Math.pow(t, 0.75) * (1 + (noise1(y / 3, seed) - 0.5) * 0.25);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      const nx = (x + 0.5 - cx) / Math.max(0.6, hw);
      const l = -nx * 0.9 + (1 - t) * 0.4;
      let c = pick(RK, 3.4 + l * 2 + (bayer(x, y) - 0.5) * 0.6);
      if (t < 0.12) c = H('#a8b4b4');
      b.set(x, y, c);
    }
  }
  outlineSel(b, 0.4);
  return { buf: b, ax: Math.round(cx), ay: h };
}

export { shade, smoothstep };

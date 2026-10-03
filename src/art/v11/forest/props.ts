// V11 Te Wao Nui props: the fallen kauri (a nurse log you can walk along, moss-carpeted and sprouting
// ferns and seedlings, bracket fungi down its flank, a splintered hollow broken end) with its root plate
// standing up at the thick end like a wall of tangled roots, soil and stones; Joshu's sea boot stuck
// fast in the mud; a mossy spring-stone pair where the stream comes out of the ferns.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix, shade } from '../../color';
import { Rng, clamp, hash2, noise1, noise2 } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { JP, tube, frond, mossBlob, outlineSel, leafMass, rc, arc } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { plant, fungus } from '../../jungle-plants';
import { FP, pick } from './kit';

/** blit a sprite into a buffer with its anchor at (x, y) */
function put(dst: PixelBuffer, s: Sprite, x: number, y: number, flip = false) {
  dst.blit(s.buf, Math.round(x - (flip ? s.buf.w - s.ax : s.ax)), Math.round(y - s.ay), flip);
}

export interface FallenLog extends Sprite { /** the log's top surface (buffer y) at buffer x */ top: (bx: number) => number; plateW: number }

/**
 * The fallen giant, len px long and dia thick, lying along the walk line behind it: anchor at the
 * bottom of the root plate's west face (so world x of the anchor = where the plate meets the ground).
 */
export function paintFallenLog(seed: number, len: number, dia: number): FallenLog {
  const rng = new Rng(seed);
  const plateH = Math.round(dia * 2.25), plateW = Math.round(dia * 0.62);
  const W = len + plateW + 40, Hh = plateH + 26;
  const b = new PixelBuffer(W, Hh);
  const ground = Hh - 6;
  const lx0 = plateW - 6, lx1 = lx0 + len;
  // the log's silhouette: a long cylinder resting on the ground, tapering toward the broken top,
  // bulging at the old knots
  const knots = [0.18, 0.43, 0.66, 0.84].map(t => lx0 + t * len + rng.range(-20, 20));
  const rAt = (x: number) => {
    let r = (dia / 2) * (1 - clamp((x - lx0) / len) * 0.2) + (noise1(x / 40, seed) - 0.5) * 3;
    for (const k of knots) r += 3.2 * Math.exp(-(((x - k) / 9) ** 2));
    return r;
  };
  const cyAt = (x: number) => ground - rAt(x) + 2 + (noise1(x / 90, seed + 1) - 0.5) * 2;
  const bark = JP.deadwood;
  for (let x = lx0; x < lx1; x++) {
    const r = rAt(x), cy = cyAt(x);
    // the broken end is jagged
    const brk = x > lx1 - 26 ? (noise1(x * 0.5, seed + 2) * 0.8 + (x - (lx1 - 26)) / 26 * 0.9) : 0;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      const ny = (y + 0.5 - cy) / r;
      if (Math.abs(ny) > 1) continue;
      if (brk > 0.75 && Math.abs(ny) < brk - 0.55) continue; // the splintered end: the top and bottom stand longer than the middle
      // a horizontal cylinder lit from above-left: brightest on the upper flank, dark underneath
      let l = -ny * 1.1 + Math.sqrt(Math.max(0, 1 - ny * ny)) * 0.3 - 0.1;
      // the grain runs along the log now it lies on its side: long checked cracks, plates of bark
      const g1 = Math.abs(noise2(x / 26, (ny * r) / 2.6, seed + 3) - 0.5);
      const g2 = Math.abs(noise2(x / 11, (ny * r) / 1.6, seed + 5) - 0.5);
      if (g1 < 0.035) l -= 1.1;
      else if (g2 < 0.025) l -= 0.6;
      else l += (noise2(x / 7, (ny * r) / 3, seed + 4) - 0.5) * 0.6;
      // bark sloughed off in patches: pale bare wood beneath
      const bare = noise2(x / 34, ny * 3, seed + 6) > 0.72 && ny < 0.3;
      let c = bare ? pick(JP.wood, 4 + l * 2.2) : pick(bark, 4.4 + l * 2.6);
      // a sunlit rim just under the moss, damp darkness and the ground's shadow underneath
      if (ny < -0.82 && ny > -0.95) c = pick(bark, 7 + l);
      if (ny > 0.5) c = shade(c, -(ny - 0.5) * 0.7);
      b.data[y * W + x] = c;
    }
  }
  // knot holes and the stubs of snapped branches
  for (const k of knots.slice(1, 3)) b.ellipseFn(k, cyAt(k) + rAt(k) * 0.15, 3.4, 2.4, (_x, _y, nx, ny) => (nx * nx + ny * ny > 0.55 ? pick(JP.wood, 5 - ny * 2) : FP.soil[0]));
  for (const k of [knots[0], knots[2], knots[3]]) {
    const up = rng.range(-1.9, -1.2);
    tube(b, arc(k, cyAt(k) - rAt(k) * 0.7, up, rng.range(14, 26), 0.1), t => 3.4 - t * 1.8, bark, 5, { spread: 2.4 });
  }
  // the hollow broken end: dark heart, pale splinters
  const ex = lx1 - 8, ecy = cyAt(ex), er = rAt(ex);
  b.ellipseFn(ex + 2, ecy, er * 0.26, er * 0.6, (_x, _y, nx, ny) => (Math.abs(nx) > 0.8 ? rc(FP.podo, 6) : pick(FP.soil, 0.5 + (ny + 1) * 0.6)));
  for (let i = 0; i < 9; i++) {
    const y = ecy + rng.range(-er * 0.9, er * 0.9);
    tube(b, [[ex - 4, y], [ex + rng.range(4, 14), y + rng.range(-3, 3)]], t => 1.4 * (1 - t) + 0.3, JP.wood, 7, { rim: false });
  }
  // moss carpet along the top, thick and lumpy, spilling down the flank in tongues
  for (let x = lx0; x < lx1 - 16; x += 5) {
    const top = cyAt(x) - rAt(x);
    mossBlob(b, rng, x + rng.range(-2, 2), top + 2, rng.range(5, 9), rng.range(2.5, 4), JP.moss, rng.int(4, 6), true);
    if (rng.chance(0.3)) mossBlob(b, rng, x, top + rAt(x) * rng.range(0.4, 0.9), rng.range(3, 6), rng.range(3, 7), JP.moss, rng.int(3, 5));
  }
  // what grows on a nurse log: crown ferns, kidney ferns, a few seedlings, little fungi
  const top = (x: number) => cyAt(x) - rAt(x) + 1;
  for (let x = lx0 + 18; x < lx1 - 30; x += rng.range(26, 54)) {
    const k = rng.next();
    const s = k < 0.4 ? plant('crownfern', 900 + Math.round(x), rng.range(18, 30)) : k < 0.6 ? plant('kidneyfern', 910 + Math.round(x), 14) : k < 0.8 ? plant('seedling', 920 + Math.round(x), rng.range(14, 26)) : plant('moss', 930 + Math.round(x), 12);
    put(b, s, x, top(x) + 2, rng.chance(0.5));
  }
  for (let x = lx0 + 30; x < lx1 - 40; x += rng.range(50, 90)) {
    const s = fungus(rng.chance(0.5) ? 'bracket' : 'coral', 940 + Math.round(x), rng.range(10, 16));
    put(b, s, x, cyAt(x) + rng.range(-2, rAt(x) * 0.5));
  }
  // ---- the root plate standing up at the thick end
  const px0 = 4, pcx = px0 + plateW * 0.5, ptop = ground - plateH;
  // soil and clay caught in the roots: a ragged slab
  for (let y = ptop; y < ground; y++) {
    const t = (y - ptop) / plateH;
    const half = plateW * 0.5 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5)) + (noise1(y / 6, seed + 9) - 0.5) * 6;
    for (let x = Math.floor(pcx - half); x <= Math.ceil(pcx + half); x++) {
      const nx = (x - pcx) / half;
      const l = -nx * 0.7 + (noise2(x / 4, y / 4, seed + 10) - 0.5) * 1.2;
      let c = pick(FP.soil, 3.2 + l * 1.8);
      if (noise2(x / 9, y / 7, seed + 11) > 0.68) c = pick(FP.mud, 4 + l);
      if (hash2(x, y, seed + 12) < 0.012) c = FP.stone[6];
      b.data[y * W + x] = c;
    }
  }
  // stones locked in the plate
  for (let i = 0; i < 7; i++) {
    const x = pcx + rng.range(-plateW * 0.3, plateW * 0.3), y = ptop + rng.range(plateH * 0.15, plateH * 0.85), r = rng.range(2.5, 5);
    b.ellipseFn(x, y, r * 1.2, r, (_x, _y, nx, ny) => pick(FP.stone, 4 - nx * 1.5 - ny * 2));
  }
  // the roots: thick tubes radiating from the stump end, thin ones dangling
  const hub: P = [lx0 + 10, cyAt(lx0 + 10)];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + rng.range(-1.35, 1.35);
    const L = rng.range(plateH * 0.35, plateH * 0.62);
    const p1: P = [hub[0] + Math.cos(a) * L * 0.4, hub[1] + Math.sin(a) * L * 0.8];
    const p2: P = [pcx + rng.range(-plateW * 0.35, plateW * 0.35), clamp(hub[1] + Math.sin(a) * L * 1.15, ptop + 4, ground - 2)];
    tube(b, [hub, p1, p2], t => (i < 6 ? 5 : 2.6) * (1 - t * 0.7) + 0.6, FP.podo, 5, { spread: 2.4, texture: (x, y) => (noise2(x / 3, y / 3, seed + 13 + i) - 0.5) * 0.7 });
  }
  for (let i = 0; i < 26; i++) {
    const x = pcx + rng.range(-plateW * 0.45, plateW * 0.45), y = ptop + rng.range(plateH * 0.25, plateH * 0.95);
    const pts = arc(x, y, Math.PI / 2 + rng.range(-0.5, 0.5), rng.range(6, 22), 0.3);
    tube(b, pts, t => 1 - t * 0.5, FP.podo, 6, { rim: false });
  }
  // ferns, moss and a seedling sprouting from the top of the plate
  for (let i = 0; i < 4; i++) frond(b, { x: pcx + rng.range(-plateW * 0.3, plateW * 0.3), y: ptop + rng.range(2, 10), ang: -Math.PI / 2 + rng.range(-1, 1), len: rng.range(12, 22), droop: 0.8, ramp: JP.fern, base: 5, pinna: 3, rng });
  mossBlob(b, rng, pcx, ptop + 4, plateW * 0.4, 4, JP.moss, 5, true);
  leafMass(b, rng, { cx: pcx + 4, cy: ptop - 4, rx: 10, ry: 7, ramp: JP.kawakawa, base: 3, steps: 3, shape: 'heart', len: [4, 6], wid: [3, 4], density: 0.8 });
  outlineSel(b, 0.5);
  return {
    buf: b, ax: px0, ay: ground, plateW,
    top: (bx: number) => top(bx),
  };
}

/** one of Joshu's sea boots, stuck fast in the mud up to the ankle (anchor: the mud line) */
export function paintStuckBoot(): Sprite {
  const b = new PixelBuffer(22, 18);
  const boot = [hex('#1a1412'), hex('#2a201a'), hex('#3c2e24'), hex('#54412f'), hex('#6e5640')];
  // the boot shaft leaning out of the mud, the cuff turned down
  for (let y = 2; y < 15; y++) {
    const t = (y - 2) / 13;
    const cx = 10 + (1 - t) * 3, hw = 3.4 + t * 0.4;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const nx = (x - cx) / hw;
      b.set(x, y, pick(boot, 2.4 - nx * 1.5 + (y < 5 ? 1 : 0)));
    }
  }
  for (let x = 9; x < 18; x++) b.set(x, 2, boot[4]);
  b.set(12, 6, hex('#8a8a7a')); b.set(13, 6, hex('#8a8a7a')); // a lace eyelet
  // the mud collar around it, wet and glossy
  for (let x = 1; x < 21; x++) {
    const h = 3 - Math.abs(x - 11) * 0.22 + (noise1(x * 0.8, 5) - 0.5) * 1.5;
    for (let y = 14; y < 14 + Math.max(1, h); y++) b.set(x, y, pick(FP.mud, 3 + (y === 14 ? 2 : 0) - Math.abs(x - 11) * 0.08));
  }
  b.set(6, 14, FP.water[6]); b.set(15, 15, FP.water[5]);
  outlineSel(b, 0.5);
  return { buf: b, ax: 11, ay: 16 };
}

/** a strip of navy wool snagged on a bush lawyer cane (anchor bottom centre of the cane) */
export function paintSnag(): Sprite {
  const b = new PixelBuffer(30, 34);
  const cane = [hex('#2a3418'), hex('#3c4a20'), hex('#56662a')];
  const pts: P[] = [[15, 33], [14, 24], [17, 14], [24, 6], [28, 3]];
  tube(b, pts, t => 1.4 - t * 0.6, cane, 1, { rim: false });
  // hooked prickles along the cane
  for (const [x, y] of [[15, 27], [15, 20], [18, 13], [21, 9], [25, 5]] as const) b.set(x + 1, y - 1, hex('#c8b070'));
  // the scrap of wool
  const navy = [hex('#121a2e'), hex('#1c2846'), hex('#28385e'), hex('#3a4c78')];
  b.poly([17, 13, 23, 12, 22, 24, 19, 21, 16, 25], navy[1]);
  for (let y = 14; y < 23; y++) b.set(19 + (y % 3 === 0 ? 1 : 0), y, navy[3]);
  b.set(18, 24, navy[2]); b.set(21, 25, navy[0]);
  outlineSel(b, 0.5);
  return { buf: b, ax: 15, ay: 33 };
}

/** dark, damp ground under the bracken where the stream comes out: two mossy stones (anchor bottom centre) */
export function paintSpringStones(seed: number): Sprite {
  const rng = new Rng(seed);
  const b = new PixelBuffer(96, 40);
  for (const [x, w, h] of [[22, 30, 22], [70, 34, 26]] as const) {
    b.ellipseFn(x, 38 - h / 2, w / 2, h / 2, (px, py, nx, ny) => {
      const l = -nx * 0.6 - ny * 0.8 + (noise2(px / 4, py / 4, seed) - 0.5) * 0.6;
      return ny < -0.1 && noise2(px / 3, py / 2, seed + 1) > 0.35 ? pick(FP.moss, 4 + l * 3) : pick(FP.stone, 3.4 + l * 2.6);
    });
  }
  for (let i = 0; i < 5; i++) frond(b, { x: rng.range(10, 86), y: rng.range(16, 30), ang: -Math.PI / 2 + rng.range(-1.2, 1.2), len: rng.range(10, 18), droop: 0.8, ramp: JP.fern, base: 5, pinna: 3, rng });
  outlineSel(b, 0.5);
  return { buf: b, ax: 48, ay: 38 };
}

export { mix };
export type { C };

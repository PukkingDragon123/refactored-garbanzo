// Foreground occluders for parallax p ≈ 1.2–1.6: very close, big, dark shapes with a rim of light.
// Their alpha is a solid mask (used for photo obstruction), so there are no half-transparent pixels.
// See jungle.ts for the public API docs.

import { PixelBuffer } from './pixel';
import { Rng, TAU } from '../core/math';
import { Sprite, JP, Ramp, P, rc, bigLeaf, frond, blade, tube, vine, leafMass, crown, leafStamp, drawStamp, along, trimSprite, outlineSel, arc } from './jungle-core';

export type ForegroundKind = 'leaves' | 'fronds' | 'branch' | 'vines' | 'grass' | 'flax' | 'palm' | 'monstera';
export const FOREGROUND_KINDS: ForegroundKind[] = ['leaves', 'fronds', 'branch', 'vines', 'grass', 'flax', 'palm', 'monstera'];
/** Kinds that hang from the top edge (anchor top-centre); the others rise from the bottom (anchor bottom-centre). */
export const FOREGROUND_HANGING: ForegroundKind[] = ['branch', 'vines', 'palm'];

/** Dark, saturated ramps for close foliage in shade (index 0..9 like JP, but compressed toward the dark end). */
const FG_TARO: Ramp = JP.taro.slice(0, 8);
const FG_FERN: Ramp = JP.fern.slice(0, 8);
const FG_CANOPY: Ramp = JP.canopy.slice(0, 8);

function canvas(w: number, h: number) {
  return new PixelBuffer(Math.ceil(w), Math.ceil(h));
}

/** Hard alpha: every pixel fully opaque or fully transparent (it's a camera occlusion mask). */
function solidify(buf: PixelBuffer) {
  const d = buf.data;
  for (let i = 0; i < d.length; i++) {
    const a = d[i] >>> 24;
    if (a === 0) continue;
    d[i] = a < 128 ? 0 : (d[i] | 0xff000000) >>> 0;
  }
}

function finish(buf: PixelBuffer, ax: number, ay: number, hanging = false): Sprite {
  outlineSel(buf, 0.45);
  solidify(buf);
  const s = trimSprite({ buf, ax: Math.round(ax), ay: Math.round(ay) }, 0);
  if (hanging) s.ay = 0; // top edge of the sprite sits on the anchor
  return s;
}

/** A cluster of huge leaves on stalks rising from the bottom edge. */
function leaves(seed: number, H: number, monstera = false): Sprite {
  const rng = new Rng(seed * 223 + 5);
  const W = H * 1.3;
  const buf = canvas(W, H);
  const x = W / 2, y = H;
  const n = rng.int(3, 5);
  const list = Array.from({ length: n }, (_, i) => ({ a: ((i + 0.5) / n - 0.5) * 1.5 + rng.range(-0.15, 0.15), h: H * rng.range(0.45, 0.72), len: H * rng.range(0.5, 0.68), layer: i % 2 }));
  list.sort((a, b) => a.layer - b.layer);
  for (const l of list) {
    const tipx = x + Math.sin(l.a) * l.h * 0.8, tipy = y - l.h;
    tube(buf, [[x + rng.range(-8, 8), y + 2], [x + Math.sin(l.a) * l.h * 0.3, y - l.h * 0.5], [tipx, tipy]], t => H * 0.018 * (1 - t * 0.5) + 1, FG_TARO, 3 + l.layer, { spread: 1.5 });
    const side = l.a < 0 ? -1 : 1;
    const ang = (side < 0 ? Math.PI * 0.72 : Math.PI * 0.28) + rng.range(-0.2, 0.2) - side * 0.3;
    bigLeaf(buf, {
      x: tipx, y: tipy, ang: ang - side * 0.5, len: l.len, wid: l.len * (monstera ? 0.85 : 0.62), ramp: FG_TARO, base: 3 + l.layer, shape: monstera ? 'heart' : 'point',
      droop: 0.35, veins: monstera ? 7 : 9, rib: 1, ao: 0.5, rng, holes: monstera ? rng.int(3, 6) : 0, tears: monstera ? rng.int(3, 5) : rng.int(0, 2),
    });
  }
  return finish(buf, x, y);
}

/** Huge fern fronds arching up from the bottom corners. */
function fronds(seed: number, H: number): Sprite {
  const rng = new Rng(seed * 227 + 7);
  const W = H * 1.4;
  const buf = canvas(W, H);
  const x = W / 2, y = H + 4;
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * 2.2 + rng.range(-0.12, 0.12);
    const len = H * rng.range(0.85, 1.15);
    frond(buf, { x: x + t * W * 0.25, y, ang: a, len, droop: 0.6 + Math.abs(t) * 1.6, ramp: FG_FERN, base: 3 + (i % 2), pinna: H * 0.11, pinnaW: H * 0.028 + 2, gap: H * 0.034 + 1, sweep: 0.9, hang: 0.12, bare: 0.08, rachis: rc(FG_FERN, 1) });
  }
  return finish(buf, x, H);
}

/** Leafy branch reaching in from the top (anchor top-centre). */
function branch(seed: number, H: number): Sprite {
  const rng = new Rng(seed * 229 + 11);
  const W = H * 1.5;
  const buf = canvas(W, H);
  const dir = rng.sign();
  const x0 = dir > 0 ? -10 : W + 10;
  const pts: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([x0 + dir * W * 0.95 * t, H * 0.02 + Math.sin(t * Math.PI * 0.9) * H * 0.2 + t * H * 0.1]);
  }
  tube(buf, pts, t => H * 0.05 * (1 - t * 0.7) + 1.5, JP.bark.slice(0, 7), 2.5, { spread: 1.6 });
  // twigs and heavy leaf clusters hanging off it
  for (let k = 0; k < 6; k++) {
    const p = along(pts, 0.15 + k * 0.14 + rng.range(-0.04, 0.04));
    const cy = p.y + H * rng.range(0.12, 0.3);
    tube(buf, [[p.x, p.y], [p.x + rng.range(-10, 10), cy - H * 0.08]], t => 2.2 - t, JP.bark.slice(0, 7), 3, { spread: 1.2 });
    leafMass(buf, rng, { cx: p.x, cy, rx: H * rng.range(0.13, 0.2), ry: H * rng.range(0.1, 0.16), ramp: FG_CANOPY, base: 1, steps: 3, shape: 'point', len: [H * 0.05, H * 0.08], wid: [H * 0.022 + 2, H * 0.03 + 2], droop: 0.6, density: 0.9 });
  }
  for (let k = 0; k < 4; k++) {
    const p = along(pts, rng.range(0.2, 0.9));
    vine(buf, rng, p.x, p.y, H * rng.range(0.3, 0.8), FG_CANOPY, 3, { leafEvery: 5, leafLen: H * 0.035 + 3, wave: 3 });
  }
  return finish(buf, W / 2, 0, true);
}

/** Curtain of vines and hanging foliage from the top edge (anchor top-centre). */
function vines(seed: number, H: number): Sprite {
  const rng = new Rng(seed * 233 + 13);
  const W = H * 0.9;
  const buf = canvas(W, H);
  // leafy lintel along the top
  for (let x = 0; x < W; x += H * 0.12) leafMass(buf, rng, { cx: x, cy: H * 0.02, rx: H * 0.12, ry: H * 0.08, ramp: FG_CANOPY, base: 1, steps: 2, shape: 'point', len: [H * 0.04, H * 0.06], wid: [H * 0.02 + 1.5, H * 0.025 + 2], droop: 0.8 });
  const n = Math.round(W / (H * 0.035 + 3));
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, W);
    vine(buf, rng, x, 0, H * rng.range(0.35, 1), FG_CANOPY, rng.int(2, 4), { leafEvery: Math.round(H * 0.02 + 3), leafLen: H * 0.03 + 3, wave: 3, shape: rng.chance(0.5) ? 'heart' : 'point' });
  }
  return finish(buf, W / 2, 0, true);
}

/** Tall grass / sedge blades from the bottom edge. */
function grass(seed: number, H: number, flaxy = false): Sprite {
  const rng = new Rng(seed * 239 + 17);
  const W = H * (flaxy ? 1.1 : 0.9);
  const buf = canvas(W, H);
  const x = W / 2, y = H + 2;
  const n = flaxy ? rng.int(10, 14) : rng.int(18, 26);
  const rp = flaxy ? JP.flax.slice(0, 8) : JP.moss.slice(0, 8);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * (flaxy ? 1.6 : 1.3) + rng.range(-0.12, 0.12);
    blade(buf, { x: x + t * W * 0.5 + rng.range(-6, 6), y, ang: a, len: H * rng.range(0.6, 1.05), droop: rng.range(0.15, 0.6) + Math.abs(t) * 0.8, w0: flaxy ? H * 0.05 + 3 : H * 0.022 + 2, ramp: rp, base: 2 + (i % 3), edge: flaxy ? rc(JP.flaxEdge, 1) : undefined });
  }
  return finish(buf, x, H);
}

/** Palm fronds drooping in from the top (beach scenes, anchor top-centre). */
function palm(seed: number, H: number): Sprite {
  const rng = new Rng(seed * 241 + 19);
  const W = H * 1.6;
  const buf = canvas(W, H);
  const x = W / 2 + rng.range(-W * 0.2, W * 0.2), y = H * 0.04;
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    // left fronds launch up-left, right ones up-right, then droop under their own weight
    const a = t < 0 ? Math.PI - 0.05 + -t * 0.5 : 0.05 - t * 0.5;
    frond(buf, { x, y, ang: a, len: H * rng.range(0.8, 1.1), droop: 1.1, ramp: JP.palmLeaf.slice(0, 8), base: 2 + (i % 3), pinna: H * 0.2, pinnaW: H * 0.02 + 2, gap: H * 0.026 + 1.5, sweep: 0.5, hang: 0.7, bare: 0.02 });
  }
  return finish(buf, W / 2, 0, true);
}

/** Default heights per foreground kind (px). */
export const FOREGROUND_SIZE: Record<ForegroundKind, number> = { leaves: 240, fronds: 260, branch: 200, vines: 240, grass: 200, flax: 220, palm: 220, monstera: 240 };

/**
 * Foreground occluder (hard alpha mask). size = sprite height in px. Anchor: bottom-centre for
 * kinds rising from the ground, top-centre for FOREGROUND_HANGING kinds (place them at the top
 * edge of the view). Draw at p 1.2–1.6, usually tinted darker by the scene.
 */
export function foreground(kind: ForegroundKind, seed: number, size?: number): Sprite {
  const H = Math.round(size ?? FOREGROUND_SIZE[kind]);
  switch (kind) {
    case 'leaves': return leaves(seed, H);
    case 'monstera': return leaves(seed, H, true);
    case 'fronds': return fronds(seed, H);
    case 'branch': return branch(seed, H);
    case 'vines': return vines(seed, H);
    case 'grass': return grass(seed, H);
    case 'flax': return grass(seed, H, true);
    case 'palm': return palm(seed, H);
  }
}

export { crown, leafStamp, drawStamp, arc, TAU };

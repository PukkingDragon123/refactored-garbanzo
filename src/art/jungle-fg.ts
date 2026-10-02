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

/**
 * Canvas for a w x h plant plus margins. Leaves, blades and fronds reach well past the nominal box
 * (droop, sway, splayed stalks) and every sprite is trimmed to its content afterwards, so the margins
 * cost nothing but make sure no leaf is ever sliced off by the buffer edge. Only the side a plant
 * grows out of (the bottom, or the top for hanging kinds) is left without margin.
 */
function canvas(w: number, h: number, side = 0, top = 0, bottom = 0) {
  return new PixelBuffer(Math.ceil(w + side * 2), Math.ceil(h + top + bottom));
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

function finish(buf: PixelBuffer, ax: number, ay: number, hanging = false, above = 0): Sprite {
  outlineSel(buf, 0.45);
  solidify(buf);
  const s = trimSprite({ buf, ax: Math.round(ax), ay: Math.round(above > 0 ? above : ay) }, 0);
  // top edge of the sprite sits on the anchor (or, when it carries on up `above` px, the old top line)
  if (hanging && above <= 0) s.ay = 0;
  return s;
}

/** A cluster of huge leaves on stalks rising from the bottom edge. */
function leaves(seed: number, H: number, monstera = false): Sprite {
  const rng = new Rng(seed * 223 + 5);
  const W = H * 1.3, M = Math.round(H * 0.55);
  const buf = canvas(W, H, M, M);
  const x = W / 2 + M, y = H + M;
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
  const W = H * 1.4, M = Math.round(H * 0.7);
  const buf = canvas(W, H, M, M);
  const x = W / 2 + M, y = H + 4 + M;
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * 2.2 + rng.range(-0.12, 0.12);
    const len = H * rng.range(0.85, 1.15);
    frond(buf, { x: x + t * W * 0.25, y, ang: a, len, droop: 0.6 + Math.abs(t) * 1.6, ramp: FG_FERN, base: 3 + (i % 2), pinna: H * 0.11, pinnaW: H * 0.028 + 2, gap: H * 0.034 + 1, sweep: 0.9, hang: 0.12, bare: 0.08, rachis: rc(FG_FERN, 1) });
  }
  return finish(buf, x, H + M);
}

/** Leafy branch reaching in from the top (anchor top-centre). */
function branch(seed: number, H: number, above = 0): Sprite {
  const rng = new Rng(seed * 229 + 11);
  const W = H * 1.5, M = Math.round(H * 0.45);
  const dir = rng.sign();
  const A = Math.max(0, Math.round(above));
  // the limb enters from one side (that end is meant to sit off-screen); margins everywhere else.
  // With `above`, its root instead sweeps up into a bough that leaves through the top of the buffer
  // `A` px above the anchor line, so wherever the branch hangs it is visibly attached to something
  // above the frame (and room is made on the entering side for the curve).
  const E = A > 0 ? Math.round(A * 0.45) : 0;
  const buf = new PixelBuffer(Math.ceil(W + M + E), Math.ceil(H + M + A));
  const ox = (dir > 0 ? 0 : M) + (dir > 0 ? E : 0);
  const x0 = (dir > 0 ? (A > 0 ? 6 : -10) : W + (A > 0 ? -6 : 10)) + ox;
  const pts: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([x0 + dir * W * 0.95 * t, A + H * 0.02 + Math.sin(t * Math.PI * 0.9) * H * 0.2 + t * H * 0.1]);
  }
  if (A > 0) {
    // the bough: tangent to the limb at its root, curving back and up out of the top
    const [rx, ry] = pts[0];
    const q0: P = [rx - dir * E * 0.9, -6], q1: P = [rx - dir * E * 0.75, ry * 0.7], q2: P = [rx, ry];
    const bough: P[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, u = 1 - t;
      bough.push([u * u * q0[0] + 2 * u * t * q1[0] + t * t * q2[0], u * u * q0[1] + 2 * u * t * q1[1] + t * t * q2[1]]);
    }
    const r0 = H * 0.05 + 1.5;
    tube(buf, bough, t => r0 * (1.7 - t * 0.7), JP.bark.slice(0, 7), 2.5, { spread: 1.6 });
    // leaf clusters along the bough so it reads as part of a crown above
    for (let k = 0; k < Math.round(A / 60); k++) {
      const b = along(bough, rng.range(0.1, 0.8));
      leafMass(buf, rng, { cx: b.x + dir * H * 0.08, cy: b.y + H * 0.05, rx: H * rng.range(0.1, 0.16), ry: H * rng.range(0.08, 0.12), ramp: FG_CANOPY, base: 1, steps: 3, shape: 'point', len: [H * 0.05, H * 0.08], wid: [H * 0.022 + 2, H * 0.03 + 2], droop: 0.6, density: 0.9 });
    }
  }
  // tapering right down to a twig at the tip, which ends in leaves (never a blunt, cut-off end)
  tube(buf, pts, t => H * 0.05 * (1 - t * 0.88) + 1 - t * 0.4, JP.bark.slice(0, 7), 2.5, { spread: 1.6 });
  {
    const tip = pts[pts.length - 1];
    leafMass(buf, rng, { cx: tip[0] + dir * H * 0.03, cy: tip[1] + H * 0.04, rx: H * 0.11, ry: H * 0.08, ramp: FG_CANOPY, base: 1, steps: 3, shape: 'point', len: [H * 0.05, H * 0.08], wid: [H * 0.022 + 2, H * 0.03 + 2], droop: 0.6, density: 0.9 });
  }
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
  return finish(buf, W / 2 + ox, 0, true, A);
}

/** Curtain of vines and hanging foliage from the top edge (anchor top-centre). */
function vines(seed: number, H: number, above = 0): Sprite {
  const rng = new Rng(seed * 233 + 13);
  const W = H * 0.9, M = Math.round(H * 0.2);
  const A = Math.max(0, Math.round(above));
  const buf = canvas(W, H, M, A, M);
  // with `above`: the foliage the vines hang from carries on up out of the top of the buffer, a
  // ragged-sided mass rather than a lintel with a straight top edge
  if (A > 0) {
    const ur = new Rng(seed * 61 + 3);
    for (let y = A; y > -H * 0.1; y -= H * 0.1) {
      for (let x = M + ur.range(-4, H * 0.06); x < W + M; x += H * ur.range(0.11, 0.16)) {
        leafMass(buf, ur, { cx: x, cy: y, rx: H * ur.range(0.1, 0.15), ry: H * ur.range(0.08, 0.11), ramp: FG_CANOPY, base: ur.int(0, 1), steps: 2, shape: 'point', len: [H * 0.04, H * 0.06], wid: [H * 0.02 + 1.5, H * 0.025 + 2], droop: 0.6 });
      }
    }
  }
  // leafy lintel along the top
  for (let x = M; x < W + M; x += H * 0.12) leafMass(buf, rng, { cx: x, cy: A + H * 0.02, rx: H * 0.12, ry: H * 0.08, ramp: FG_CANOPY, base: 1, steps: 2, shape: 'point', len: [H * 0.04, H * 0.06], wid: [H * 0.02 + 1.5, H * 0.025 + 2], droop: 0.8 });
  const n = Math.round(W / (H * 0.035 + 3));
  for (let i = 0; i < n; i++) {
    const x = M + rng.range(0, W);
    vine(buf, rng, x, A, H * rng.range(0.35, 1), FG_CANOPY, rng.int(2, 4), { leafEvery: Math.round(H * 0.02 + 3), leafLen: H * 0.03 + 3, wave: 3, shape: rng.chance(0.5) ? 'heart' : 'point' });
  }
  return finish(buf, W / 2 + M, 0, true, A);
}

/** Tall grass / sedge blades from the bottom edge. */
function grass(seed: number, H: number, flaxy = false): Sprite {
  const rng = new Rng(seed * 239 + 17);
  const W = H * (flaxy ? 1.1 : 0.9), M = Math.round(H * 0.7);
  const buf = canvas(W, H, M, M);
  const x = W / 2 + M, y = H + 2 + M;
  const n = flaxy ? rng.int(10, 14) : rng.int(18, 26);
  const rp = flaxy ? JP.flax.slice(0, 8) : JP.moss.slice(0, 8);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const a = -Math.PI / 2 + t * (flaxy ? 1.6 : 1.3) + rng.range(-0.12, 0.12);
    blade(buf, { x: x + t * W * 0.5 + rng.range(-6, 6), y, ang: a, len: H * rng.range(0.6, 1.05), droop: rng.range(0.15, 0.6) + Math.abs(t) * 0.8, w0: flaxy ? H * 0.05 + 3 : H * 0.022 + 2, ramp: rp, base: 2 + (i % 3), edge: flaxy ? rc(JP.flaxEdge, 1) : undefined });
  }
  return finish(buf, x, H + M);
}

/** Palm fronds drooping in from the top (beach scenes, anchor top-centre). */
function palm(seed: number, H: number, above = 0): Sprite {
  const rng = new Rng(seed * 241 + 19);
  const W = H * 1.6, M = Math.round(H * 0.6), A = Math.max(0, Math.round(above)), T = Math.round(H * 0.35) + A;
  let buf = canvas(W, H, M, T, Math.round(H * 0.3));
  const x = W / 2 + M + rng.range(-W * 0.2, W * 0.2), y = H * 0.04 + T;
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    // left fronds launch up-left, right ones up-right, then droop under their own weight
    const a = t < 0 ? Math.PI - 0.05 + -t * 0.5 : 0.05 - t * 0.5;
    frond(buf, { x, y, ang: a, len: H * rng.range(0.8, 1.1), droop: 1.1, ramp: JP.palmLeaf.slice(0, 8), base: 2 + (i % 3), pinna: H * 0.2, pinnaW: H * 0.02 + 2, gap: H * 0.026 + 1.5, sweep: 0.5, hang: 0.7, bare: 0.02 });
  }
  if (A <= 0) return finish(buf, W / 2 + M, 0, true);
  // with `above`: the palm's own trunk, leaning in from above the frame to the crown (painted
  // behind the fronds). The anchor stays the top of the fronds, where it was without the trunk.
  let top = 0;
  while (top < buf.h - 1 && !rowHas(buf, top)) top++;
  const tb = new PixelBuffer(buf.w, buf.h);
  const lean = (x < W / 2 + M ? 1 : -1) * H * 0.3;
  const trunk: P[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; trunk.push([x - lean * (1 - t) * (1 - t), -6 + (y + 6) * t]); }
  tube(tb, trunk, t => H * 0.05 * (1.15 - t * 0.3) + 2, JP.palmTrunk.slice(0, 7), 2.5, { spread: 1.4 });
  tb.blit(buf, 0, 0);
  buf = tb;
  return finish(buf, W / 2 + M, 0, true, top);
}

function rowHas(b: PixelBuffer, y: number) {
  for (let x = 0; x < b.w; x++) if (b.data[y * b.w + x] >>> 24) return true;
  return false;
}

/** Default heights per foreground kind (px). */
export const FOREGROUND_SIZE: Record<ForegroundKind, number> = { leaves: 240, fronds: 260, branch: 200, vines: 240, grass: 200, flax: 220, palm: 220, monstera: 240 };

/**
 * Foreground occluder (hard alpha mask). size = sprite height in px. Anchor: bottom-centre for
 * kinds rising from the ground, top-centre for FOREGROUND_HANGING kinds (place them at the top
 * edge of the view). Draw at p 1.2–1.6, usually tinted darker by the scene.
 */
export function foreground(kind: ForegroundKind, seed: number, size?: number, o: { above?: number } = {}): Sprite {
  const H = Math.round(size ?? FOREGROUND_SIZE[kind]);
  // hanging kinds can carry on `above` px up out of the top of the frame (their bough, canopy or
  // trunk), so a camera looking up never finds where they were cut off; the anchor stays the old top
  const up = o.above ?? 0;
  switch (kind) {
    case 'leaves': return leaves(seed, H);
    case 'monstera': return leaves(seed, H, true);
    case 'fronds': return fronds(seed, H);
    case 'branch': return branch(seed, H, up);
    case 'vines': return vines(seed, H, up);
    case 'grass': return grass(seed, H);
    case 'flax': return grass(seed, H, true);
    case 'palm': return palm(seed, H, up);
  }
}

export { crown, leafStamp, drawStamp, arc, TAU };

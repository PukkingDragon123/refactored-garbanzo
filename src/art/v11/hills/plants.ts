// V11 Rocky Hills, the plants above the bush line: snow tussock (a golden fountain of fine blades with
// feathery seed heads) and red tussock, spaniard (a rosette of stiff, needle-tipped blue-green blades
// and its spiny golden flower spike), mountain daisies (silver rosettes with big white flowers),
// hebe (a tight glossy dome with white and lilac spikes), the wind-bent beech at the bush line (its
// crown flagged away from the prevailing wind, beard lichen hanging off it), gentians and moss cushions.
// Anchors: bottom centre.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { hex, mix } from '../../color';
import { Rng, clamp } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { blade, tube, crown, flower, outlineSel, trimSprite, leafMass } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { HP } from './kit';

/** snow tussock: a fountain of fine blades from a tight base */
export function paintTussock(seed: number, size: number, o: { red?: boolean; seed?: boolean; dry?: number } = {}): Sprite {
  const rng = new Rng(seed * 41 + 7);
  const W = Math.round(size * 2.2), H = Math.round(size * 1.25);
  const b = new PixelBuffer(W, H);
  const ox = W / 2, oy = H - 2;
  const ramp = o.red ? HP.tussockRed : HP.tussock;
  const n = Math.round(26 + size * 0.9);
  // back blades first (darker), then the front ones over them
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n / 2; i++) {
      const s = rng.range(-1, 1);
      const ang = -Math.PI / 2 + s * 1.15 + rng.range(-0.12, 0.12);
      const dry = rng.chance(o.dry ?? 0.18);
      blade(b, {
        x: ox + s * size * 0.12 + rng.range(-1.5, 1.5), y: oy, ang, len: size * rng.range(0.7, 1.05) * (1 - Math.abs(s) * 0.2), droop: 0.55 + Math.abs(s) * 0.7,
        w0: rng.range(1.2, 2), ramp: dry ? HP.tussockDry : ramp, base: pass === 0 ? rng.int(3, 4) : rng.int(5, 7), fold: true,
      });
    }
  }
  // seed heads: thin stalks with feathery panicles above the fountain
  if (o.seed !== false && rng.chance(0.7)) {
    for (let i = 0; i < rng.int(2, 5); i++) {
      const s = rng.range(-0.5, 0.5);
      const pts = blade(b, { x: ox + s * 4, y: oy, ang: -Math.PI / 2 + s * 0.5, len: size * rng.range(1, 1.15), droop: 0.18, w0: 0.6, ramp: HP.tussockDry, base: 4, fold: false });
      const tip = pts[pts.length - 1];
      for (let k = 0; k < 9; k++) b.set(tip[0] + rng.range(-1.5, 1.5) + (k % 2), tip[1] + k * 0.9, HP.tussockDry[6 - (k % 3)]);
    }
  }
  outlineSel(b, 0.35);
  return trimSprite({ buf: b, ax: ox, ay: oy + 1 }, 0);
}

/** spaniard: a rosette of stiff sharp blades (and sometimes its spiny golden flower spike) */
export function paintSpaniard(seed: number, size: number, o: { spike?: boolean } = {}): Sprite {
  const rng = new Rng(seed * 53 + 3);
  const spike = o.spike ?? rng.chance(0.18);
  const W = Math.round(size * 2), H = Math.round(size * (spike ? 2.1 : 1.15));
  const b = new PixelBuffer(W, H);
  const ox = W / 2, oy = H - 2;
  const n = 18 + Math.round(size * 0.5);
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * 2 - 1 + rng.range(-0.05, 0.05);
    const ang = -Math.PI / 2 + s * 1.35;
    const pts = blade(b, { x: ox + s * 2, y: oy, ang, len: size * rng.range(0.7, 1) * (1 - Math.abs(s) * 0.25), droop: 0.06 + Math.abs(s) * 0.12, w0: rng.range(2.2, 3.2), ramp: HP.spaniard, base: Math.abs(s) < 0.5 ? 6 : 4, fold: true });
    // the needle tips: hard, yellow-orange
    const tp = pts[pts.length - 1], tq = pts[Math.max(0, pts.length - 4)];
    b.set(tp[0], tp[1], hex('#e0b860'));
    b.set(tq[0], tq[1], hex('#a89048'));
  }
  if (spike) {
    // the flower spike: a stout stalk ringed with spiny golden bracts
    const top = oy - size * 1.9;
    for (let y = oy - 2; y > top; y--) {
      const t = (oy - y) / (oy - top);
      const r = 1.1 - t * 0.5;
      for (let dx = -r; dx <= r; dx++) b.set(ox + dx, y, mix(HP.gold[1], HP.gold[3], dx < 0 ? 0.6 : 0.1));
      if ((oy - y) % 5 === 0 && t > 0.15) {
        const L = (1 - t) * size * 0.22 + 2;
        for (const sd of [-1, 1]) for (let k = 0; k < L; k++) b.set(ox + sd * (k + 1), y - k * 0.7, k > L - 2 ? hex('#d8c070') : HP.gold[k < 2 ? 1 : 2]);
      }
    }
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: ox, ay: oy + 1 }, 0);
}

/** mountain daisy: a silver rosette with a few big white daisies on woolly stalks */
export function paintDaisy(seed: number, size: number): Sprite {
  const rng = new Rng(seed * 67 + 11);
  const W = Math.round(size * 2.2), H = Math.round(size * 1.7);
  const b = new PixelBuffer(W, H);
  const ox = W / 2, oy = H - 2;
  for (let i = 0; i < 12; i++) {
    const s = (i / 11) * 2 - 1;
    blade(b, { x: ox + s * 2, y: oy, ang: -Math.PI / 2 + s * 1.2, len: size * rng.range(0.55, 0.75), droop: 0.5, w0: rng.range(3, 4.2), ramp: HP.silver, base: 4 + (Math.abs(s) < 0.4 ? 2 : 0), fold: true });
  }
  const nf = rng.int(1, 3);
  for (let i = 0; i < nf; i++) {
    const s = (i / Math.max(1, nf - 1)) * 2 - 1;
    const pts: P[] = [];
    const len = size * rng.range(0.9, 1.25), lean = s * 0.35 + rng.range(-0.1, 0.1);
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([ox + s * 3 + Math.sin(lean) * len * t + Math.sin(t * 3) * 0.6, oy - Math.cos(lean) * len * t]); }
    tube(b, pts, () => 0.7, HP.silver, 4, { rim: false });
    const [fx, fy] = pts[pts.length - 1];
    const r = size * rng.range(0.11, 0.14) + 1;
    flower(b, fx, fy, r, HP.daisy, 3, HP.gold[3], 9, rng.range(0, 1));
    b.set(fx, fy, HP.gold[4]);
  }
  outlineSel(b, 0.35);
  return trimSprite({ buf: b, ax: ox, ay: oy + 1 }, 0);
}

/** hebe: a tight, glossy dome of small leaves with a few short flower spikes */
export function paintHebe(seed: number, w: number, h: number, o: { flowers?: C } = {}): Sprite {
  const rng = new Rng(seed * 71 + 17);
  const W = Math.round(w + 8), H = Math.round(h + 10);
  const b = new PixelBuffer(W, H);
  crown(b, rng, { cx: W / 2, cy: H - h / 2 - 2, rx: w / 2, ry: h / 2, ramp: HP.hebe, n: 7, lo: 2, hi: 5, steps: 3, shape: 'oval', len: [3, 4], wid: [2, 3], density: 1.4, droop: 0.1, jag: 0.25, flatBottom: 0.7, sparkle: 0.25 });
  const fc = o.flowers ?? (rng.chance(0.5) ? hex('#eef0f4') : hex('#c8b4e0'));
  for (let i = 0; i < Math.round(w / 5); i++) {
    const x = W / 2 + rng.range(-w * 0.4, w * 0.4), y = H - h - 2 + Math.abs(x - W / 2) * (h / w) * 0.9 + rng.range(0, 3);
    for (let k = 0; k < 4; k++) { b.set(x, y - k, k === 3 ? mix(fc, hex('#ffffff'), 0.4) : fc); if (k < 2) b.set(x + 1, y - k, mix(fc, hex('#506080'), 0.25)); }
  }
  outlineSel(b, 0.45);
  return trimSprite({ buf: b, ax: W / 2, ay: H - 2 }, 0);
}

/** the wind-bent beech at the bush line: a leaning trunk, the crown flagged downwind (to the right) */
export function paintWindTree(seed: number, w: number, h: number, o: { lichen?: number; dead?: boolean } = {}): Sprite {
  const rng = new Rng(seed * 89 + 23);
  const W = Math.round(w * 1.5), H = Math.round(h + 10);
  const b = new PixelBuffer(W, H);
  const bx = W * 0.32, by = H - 2;
  // the trunk: leaning downwind, kinked where old storms broke it
  const pts: P[] = [];
  const lean = rng.range(0.35, 0.55);
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    pts.push([bx + Math.sin(lean * t) * h * 0.55 * t + Math.sin(t * 7 + seed) * 2, by - h * 0.62 * t]);
  }
  tube(b, pts, t => (w * 0.07) * (1 - t * 0.55) + (t < 0.08 ? (0.08 - t) * 30 : 0), HP.bark, 5, { rim: true });
  // limbs streaming downwind
  const top = pts[pts.length - 1];
  const limbs: P[] = [];
  for (let i = 0; i < 5; i++) {
    const at = pts[8 + i * 2] ?? top;
    const L = w * rng.range(0.25, 0.5);
    const lp: P[] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; lp.push([at[0] + L * t, at[1] - L * 0.25 * t + Math.sin(t * 3) * 1.5]); }
    tube(b, lp, t => (w * 0.035) * (1 - t * 0.7), HP.bark, 4, { rim: false });
    limbs.push(lp[lp.length - 1]);
  }
  if (!o.dead) {
    // the flagged crown: flat-topped, sheared by the wind, dense on the lee side
    const cx = top[0] + w * 0.22, cy = top[1] + 4;
    crown(b, rng, {
      cx, cy, rx: w * 0.55, ry: h * 0.2, ramp: HP.beech, n: 9, size: [0.3, 0.48], lo: 1, hi: 6, steps: 3, shape: 'round', len: [2, 3], wid: [2, 3], density: 1.2, droop: 0.2, jag: 0.4, flatBottom: 0.3,
      clumps: [...limbs.map(([x, y]) => ({ x, y: y - 2, rx: w * 0.2, ry: h * 0.1 })), { x: cx, y: cy - 4, rx: w * 0.28, ry: h * 0.12 }, { x: cx + w * 0.25, y: cy, rx: w * 0.22, ry: h * 0.1 }],
    });
  }
  // beard lichen hanging from the limbs
  const lk = o.lichen ?? 0.8;
  for (let i = 0; i < Math.round(10 * lk); i++) {
    const p = pts[rng.int(6, 16)] ?? top;
    const x = p[0] + rng.range(0, w * 0.4), y = p[1] + rng.range(-2, 6);
    const len = rng.range(4, 10);
    for (let k = 0; k < len; k++) b.set(x + Math.sin(k * 0.8) * 0.6, y + k, HP.lichenPale[clamp(3 - Math.floor(k / 3), 0, 4)]);
  }
  outlineSel(b, 0.5);
  return trimSprite({ buf: b, ax: bx, ay: by + 1 }, 0);
}

/** a cushion of moss and tiny alpine plants (cushion plants, gentians) */
export function paintCushion(seed: number, w: number): Sprite {
  const rng = new Rng(seed * 97 + 29);
  const h = Math.round(w * 0.45);
  const b = new PixelBuffer(w + 6, h + 8);
  leafMass(b, rng, { cx: (w + 6) / 2, cy: h / 2 + 5, rx: w / 2, ry: h / 2, ramp: rng.chance(0.5) ? HP.spaniard : HP.beech, base: 3, steps: 3, shape: 'round', len: [2, 2], wid: [2, 2], density: 1.6, droop: 0, jag: 0.2, core: true, flatBottom: 0.9, sparkle: 0.3 });
  // gentians: little white cups
  for (let i = 0; i < Math.round(w / 6); i++) {
    const x = rng.range(4, w + 2), y = rng.range(3, h * 0.6 + 3);
    b.set(x, y, hex('#f4f4f0')); b.set(x + 1, y, hex('#dcdcd8')); b.set(x, y - 1, hex('#ffffff'));
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: (w + 6) / 2, ay: h + 6 }, 0);
}

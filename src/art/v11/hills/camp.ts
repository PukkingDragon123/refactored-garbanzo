// V11 Rocky Hills, the hunters' camp under the bluff (left empty: the hunters come and go): a ring of
// fire-blackened stones around an ash bed and charred stubs, a lean-to of mānuka poles thatched with
// tussock and flax against the rock, and an A-frame meat-drying rack with its crossbars lashed on.
// Anchors: bottom centre.

import { PixelBuffer } from '../../pixel';
import { hex, mix } from '../../color';
import { Rng, bayer } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { tube, blade, outlineSel, trimSprite } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { HP, pick } from './kit';

/** the fire ring: stones around an ash bed, charred stubs in the middle */
export function paintFireRing(seed: number, w = 46): Sprite {
  const rng = new Rng(seed * 7 + 1);
  const h = 16;
  const b = new PixelBuffer(w + 4, h + 4);
  const cx = (w + 4) / 2, cy = h * 0.62 + 2;
  // the ash bed
  b.ellipseFn(cx, cy, w * 0.42, h * 0.3, (x, y) => pick(HP.ash, 3 + (bayer(x, y) - 0.5) * 2 + (rng.next() < 0.08 ? -2 : 0)));
  // charred stubs
  for (let i = 0; i < 4; i++) {
    const a = rng.range(-0.6, 0.6);
    const pts: P[] = [[cx - 8 + i * 5, cy + 1], [cx - 8 + i * 5 + Math.sin(a) * 9, cy - 3 - Math.cos(a) * 2]];
    tube(b, pts, () => 1.4, HP.ash, 1, { rim: false });
  }
  // the stones, back row then front row
  const n = 11;
  for (const front of [false, true]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const fy = Math.sin(a);
      if ((fy > 0) !== front) continue;
      const x = cx + Math.cos(a) * w * 0.44, y = cy + fy * h * 0.34;
      const rx = rng.range(3.2, 4.6), ry = rng.range(2.4, 3.2);
      b.ellipseFn(x, y - ry * 0.5, rx, ry, (px, py) => {
        const l = ((px - x) * -0.5 + (py - y + ry * 0.5) * -0.7) / rx;
        // fire-blackened on the inside face
        const inner = (px - x) * -Math.cos(a) + (py - y) * -fy > 0;
        return pick(inner ? HP.ash : HP.granite, 3 + l * 2.5 + (bayer(px, py) - 0.5));
      });
    }
  }
  b.outline(hex('#141210'));
  return { buf: b, ax: Math.round(cx), ay: Math.round(cy + h * 0.34 + 3) };
}

/** a lean-to seen from the side: a thatched roof sloping from a forked post (left) to the ground (right),
 *  the dark space under it, the rafters' ends showing, flax lashings */
export function paintLeanTo(seed: number, w = 74, h = 50): Sprite {
  const rng = new Rng(seed * 11 + 3);
  const W = w + 12, H = h + 10;
  const b = new PixelBuffer(W, H);
  const gy = H - 2, px = 8, top = gy - h;
  // the dark space under the roof
  b.polyFn([px, top + 6, W - 6, gy, px, gy], (x, y) => mix(hex('#080706'), hex('#2a221a'), clamp01((x - px) / (W - px) * 0.6 + (bayer(x, y) - 0.5) * 0.1)));
  // the forked post and a back pole
  tube(b, [[px, gy], [px + 1, top + 2]], () => 1.8, HP.wood, 3, { rim: true });
  tube(b, [[px + 18, gy], [px + 18, top + 16]], () => 1.2, HP.wood, 2, { rim: false });
  // the roof: bundles of dry tussock and flax laid down the slope, ragged at the eave
  const roofY = (x: number) => top + 2 + (x - px) * (h - 4) / (W - 8 - px);
  for (let i = 0; i < 70; i++) {
    const x = rng.range(px - 4, W - 10);
    const y = roofY(x) + rng.range(-3, 2);
    blade(b, { x, y, ang: Math.atan2(h, W - px) + rng.range(-0.15, 0.15), len: rng.range(10, 18), droop: 0.15, w0: rng.range(1.4, 2.2), ramp: rng.chance(0.3) ? HP.flaxDry : HP.tussockDry, base: rng.int(2, 5), fold: true });
  }
  // the rafters' ends poking out at the top, the ridge pole's lashing
  for (let i = 0; i < 3; i++) tube(b, [[px - 3 + i * 2, top - 2 - i], [px + 6 + i * 2, top + 6 - i]], () => 0.8, HP.wood, 4, { rim: false });
  for (let k = 0; k < 4; k++) { b.set(px - 1 + k, top + 3, HP.flaxDry[5]); b.set(px - 1 + k, top + 5, HP.flaxDry[4]); }
  outlineSel(b, 0.45);
  return trimSprite({ buf: b, ax: Math.round(W / 2), ay: gy + 1 }, 0);
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** the meat-drying rack: two A-frames and two crossbars, flax ties dangling (empty) */
export function paintDryingRack(seed: number, w = 64, h = 46): Sprite {
  const rng = new Rng(seed * 13 + 5);
  const W = w + 8, H = h + 6;
  const b = new PixelBuffer(W, H);
  const gy = H - 2;
  for (const fx of [6, W - 6]) {
    const top: P = [fx, gy - h];
    tube(b, [[fx - 8, gy], [top[0] + 1, top[1]]], () => 1.2, HP.wood, 3, { rim: true });
    tube(b, [[fx + 8, gy], [top[0] - 1, top[1]]], () => 1.2, HP.wood, 4, { rim: true });
    for (let k = 0; k < 3; k++) b.set(fx - 1 + k, gy - h + 3, HP.flaxDry[5]);
  }
  // crossbars
  tube(b, [[2, gy - h + 3], [W - 2, gy - h + 4]], () => 1.3, HP.wood, 5, { rim: true });
  tube(b, [[8, gy - h * 0.55], [W - 8, gy - h * 0.55 + 1]], () => 1, HP.wood, 4, { rim: false });
  // flax ties, waiting
  for (let i = 0; i < 5; i++) {
    const x = 12 + i * ((W - 24) / 4) + rng.range(-1, 1);
    const len = rng.range(4, 8);
    for (let k = 0; k < len; k++) b.set(x + Math.sin(k * 0.7) * 0.5, gy - h + 5 + k, HP.flaxDry[k % 2 ? 4 : 5]);
  }
  outlineSel(b, 0.45);
  return trimSprite({ buf: b, ax: Math.round(W / 2), ay: gy + 1 }, 0);
}

/** a stack of split firewood under the overhang */
export function paintWoodpile(seed: number, w = 30): Sprite {
  const rng = new Rng(seed * 17 + 9);
  const H = 16;
  const b = new PixelBuffer(w + 4, H + 2);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5 - row; i++) {
      const x = 4 + row * 3 + i * 6 + rng.range(-0.5, 0.5), y = H - 3 - row * 4.5;
      b.ellipseFn(x, y, 3.1, 2.4, (px, py) => {
        const d = Math.hypot(px - x, py - y);
        return d < 1.2 ? HP.wood[6] : d < 2 ? HP.wood[5] : pick(HP.wood, 2 + (bayer(px, py) - 0.5));
      });
    }
  }
  outlineSel(b, 0.4);
  return trimSprite({ buf: b, ax: Math.round((w + 4) / 2), ay: H }, 0);
}

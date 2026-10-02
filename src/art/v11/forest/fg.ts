// V11 Te Wao Nui, the out-of-focus foreground: big dark shapes right in front of the camera (tree fern
// fronds rising from the bottom of the frame and hanging from the top, giant leaves, a colossal trunk
// passing close by), cooled toward the shade colour and blurred, so the view looks out from inside the
// forest instead of at a stage. Anchors: bottom centre for rising kinds, top centre for hanging ones.

import { PixelBuffer } from '../../pixel';
import type { C } from '../../color';
import { Rng } from '../../../core/math';
import type { Sprite } from '../../jungle-core';
import { JP, frond, tube, leafMass, outlineSel, trimSprite } from '../../jungle-core';
import type { P } from '../../jungle-core';
import { foreground } from '../../jungle-fg';
import type { ForegroundKind } from '../../jungle-fg';
import { blurBuf, silhouette } from './kit';
import { paintGiant } from './trees';
import type { GiantKind } from './trees';

/** pad, darken and blur a sprite (the anchor follows) */
export function soften(s: Sprite, blur: number, to: C, dark: number): Sprite {
  const pad = blur * 3 + 2;
  const b = new PixelBuffer(s.buf.w + pad * 2, s.buf.h + pad * 2);
  b.blit(s.buf, pad, pad);
  silhouette(b, to, dark);
  return { buf: blur > 0 ? blurBuf(b, blur, 2) : b, ax: s.ax + pad, ay: s.ay + pad };
}

/** a jungle-kit foreground plant, softened */
export function fgPlant(kind: ForegroundKind, seed: number, size: number, blur: number, to: C, dark: number, above = 0): Sprite {
  return soften(foreground(kind, seed, size, { above }), blur, to, dark);
}

/** a spray of tree fern fronds, right up close: rising from the bottom edge, or hanging from above */
export function fgFernSpray(seed: number, size: number, hanging: boolean, blur: number, to: C, dark: number): Sprite {
  const rng = new Rng(seed * 59 + 3);
  const W = Math.round(size * 2.2), H = Math.round(size * 1.3);
  const b = new PixelBuffer(W, H);
  const ox = W / 2, oy = hanging ? 2 : H - 2;
  const n = rng.int(4, 7);
  for (let i = 0; i < n; i++) {
    const spread = ((i + 0.5) / n - 0.5) * 2.2;
    const ang = hanging ? Math.PI / 2 + spread * 0.8 : -Math.PI / 2 + spread;
    frond(b, {
      x: ox + rng.range(-size * 0.1, size * 0.1), y: oy, ang, len: size * rng.range(0.75, 1.05), droop: hanging ? -0.15 : 0.9,
      ramp: JP.fern, base: rng.int(3, 5), pinna: size * 0.09, pinnaW: Math.max(2, size * 0.022), gap: Math.max(2, size * 0.028), sweep: 0.95, bare: 0.04, rng,
    });
  }
  outlineSel(b, 0.4);
  const t = trimSprite({ buf: b, ax: ox, ay: oy }, 0);
  return soften(t, blur, to, dark);
}

/** a giant trunk passing close in front of the camera (very dark, soft) */
export function fgTrunk(kind: GiantKind, seed: number, w: number, h: number, blur: number, to: C, dark: number): Sprite {
  return soften(paintGiant(kind, seed, w, h, { epiphytes: 0.6, vines: 0.6, fadeTop: 40 }), blur, to, dark);
}

/** a hanging curtain of supplejack and kiekie from the top of the frame */
export function fgVines(seed: number, w: number, h: number, blur: number, to: C, dark: number): Sprite {
  const rng = new Rng(seed * 71 + 9);
  const b = new PixelBuffer(w, h);
  for (let i = 0; i < Math.round(w / 9); i++) {
    const x = rng.range(4, w - 4), len = h * rng.range(0.35, 1);
    const pts: P[] = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([x + Math.sin(t * 3 + i) * 3, t * len]); }
    tube(b, pts, () => rng.range(1, 2.2), JP.bark, 3, { rim: false });
    if (rng.chance(0.6)) leafMass(b, rng, { cx: x, cy: len, rx: rng.range(6, 12), ry: rng.range(4, 8), ramp: JP.kawakawa, base: 2, steps: 2, shape: 'heart', len: [4, 7], wid: [3, 4], density: 0.7, droop: 0.8 });
  }
  leafMass(b, rng, { cx: w / 2, cy: 6, rx: w * 0.55, ry: 14, ramp: JP.canopy, base: 1, steps: 2, shape: 'point', len: [5, 8], wid: [3, 4], density: 0.9, droop: 0.8 });
  outlineSel(b, 0.4);
  return soften({ buf: b, ax: Math.round(w / 2), ay: 0 }, blur, to, dark);
}

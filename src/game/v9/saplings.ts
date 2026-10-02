// Saplings under the island's loose twigs: every twig sprite on the bush track (perches, the mantis,
// the zombie-cap hornets, the jacket scraps) is the side shoot of a young tree rooted in the forest
// floor below it. Built once per scene from the twig roots; the sprites are cached by variant and
// height in the scene atlas.

import type { Renderer, Frame } from '../../gfx/renderer';
import type { Drawable } from '../../world/stage';
import { sprite } from '../sites2/common';
import { paintSapling, saplingLean } from '../../art/v9/wild/sapling';
import { groundY } from '../../art/island4/layout';

/** heights are rounded to this step so a handful of sprites serve the whole track */
const STEP = 2;

export class Saplings implements Drawable {
  private list: { f: Frame; x: number; y: number }[] = [];
  /** roots: world points where each twig meets its stem */
  constructor(public z: number, roots: [number, number][], seed = 0) {
    roots.forEach(([x, y], i) => this.add(x, y, seed + i));
  }
  add(x: number, y: number, v: number) {
    v = ((v % 4) + 4) % 4;
    const fx = Math.round(x - saplingLean(v));
    const gy = Math.round(groundY(fx)) + 1;
    const h = Math.max(6, Math.ceil((gy - y) / STEP) * STEP);
    const s = sprite(`v9:sapling:${v}:${h}`, () => paintSapling(v, h));
    if (s) this.list.push({ f: s.f, x: fx, y: Math.round(y) + h });
  }
  draw(r: Renderer) {
    const x0 = r.visibleX0(20), x1 = r.visibleX1(20);
    for (const q of this.list) if (q.x > x0 && q.x < x1) r.draw(q.f, q.x, q.y);
  }
}

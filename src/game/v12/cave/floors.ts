// V12 cave floors for the side-view caves (the sea grotto, the deep): the textured cave floor of
// src/art/v12/cave/floor.ts (slabs, scree, puddles, flowstone, rimstone, sand drifts, a ragged front
// edge into the dark) laid under the site's own walk line, in place of a flat ground strip. Only the
// look changes: the walk line (and so every route, den and dive spot on it) is the site's own.

import type { FieldScene } from '../../scenes/field';
import { Prop } from '../../../world/props';
import { bigFrame } from '../../../gfx/atlas';
import { game } from '../../game';
import { paintFloorStrip } from '../../../art/v12/cave/floor';
import type { CaveFloorMat } from '../../../art/v12/cave/floor';

/** paint the floor under `ground` across the site and lay the walk line on it (like groundStrip) */
export function caveFloorStrip(f: FieldScene, width: number, ground: (x: number) => number, o: { mat: (x: number) => CaveFloorMat; seed: number; h?: number; tint?: number }) {
  const { buf, y0 } = paintFloorStrip(width, ground, { mat: o.mat, seed: o.seed, h: o.h });
  f.main.add(new Prop({ ...bigFrame(game.r, buf), ax: 0, ay: 0 }, 0, y0, -10, o.tint !== undefined ? { tint: o.tint } : {}));
  const pts: [number, number][] = [];
  for (let x = 0; x <= width; x += 8) pts.push([x, ground(x)]);
  f.st.terrain.addGround(pts, 'ground');
}

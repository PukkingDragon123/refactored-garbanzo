// V9 island dressing for the west half: the west rocks, the wreck of the Kittiwake, the landing beach
// and the palm grove (world x 0 .. WEST_END). The legacy V4/V5 dressing still runs in isleprops.ts
// for the whole shore; its props in this range are pruned here and replaced by a composed, layered
// set: the basalt headland behind the rocks, beach wrack and Kittiwake debris on the sand, dune plants
// at the foot of the frame and big foreground flora in front of the camera.

import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import type { Layer } from '../../world/stage';
import { Prop } from '../../world/props';
import { paintHeadland } from '../../art/v9/headland';
import type { IslandScene4 } from '../v4/island';
import { layerY } from '../v4/island';

/** everything west of this world x is dressed here (the stream mouth and beyond belong to isleprops) */
export const WEST_END = 3300;

export interface WestLayers { mid: Layer; back: Layer; main: Layer; front: Layer }

/** drop the legacy props that stand west of WEST_END on a layer (x is in that layer's own space) */
function prune(l: Layer) {
  const x1 = WEST_END * l.p;
  l.items = l.items.filter(d => !(d instanceof Prop) || d.x >= x1);
  l.markDirty();
}

export function dressWest(s: IslandScene4, L: WestLayers) {
  const r = game.r;
  for (const l of [L.back, L.main, L.front]) prune(l);
  void s;

  // ---------------------------------------------------------------- the headland (back layer, p .9)
  // it climbs out of the top of the frame past the west end of the world and steps down to the sea
  const pb = L.back.p;
  const hd = paintHeadland(760, 300, 7, 0.8);
  L.back.add(new Prop(bigFrame(r, hd.buf, 0, hd.buf.h), -170, layerY(pb, 216) + 5, 0));
}

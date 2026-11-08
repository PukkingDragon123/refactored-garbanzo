// V12 Te Tuawhenua's old carvings (the painters: src/art/v12/statues.ts): whoever carved the Old Pā knew
// this country too. At the mouth of the claw gorge, Matikuku Nui in stone, rearing, its claw snapped off
// and lying in the moss; where the feathered gully begins, a serpent carving toppled and broken in two.

import { Prop } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { sprite } from '../../sites2/common';
import { bearerStatue, fallenSerpent } from '../../../art/v12/statues';
import { tuaHooks } from './hooks';
import { tuaGround } from './gen';

const PLACES: [number, string, () => ReturnType<typeof bearerStatue>, number][] = [
  [11640, 'tu:statue:bearer', () => bearerStatue(77), -3.2],
  [6905, 'tu:statue:fallen', () => fallenSerpent(83), -2.2],
];

tuaHooks.build.push(f => {
  for (const [x, key, gen, z] of PLACES) {
    const s = sprite(key, gen);
    if (s) f.main.add(new Prop(s.f, x, tuaGround(x) + 3, z, { foliage: false, tint: packColor(0.9, 0.9, 0.86, 1) }));
  }
});

// The backpack. V12: the first-person Backpack scene (src/ui/v12/pack): Mori swings his pack off, the
// view drops to the ground where he kneels, and the open pack lies there with its 5x3 compartments,
// the tools in the webbing loops and the ground round it. Opened by inspecting Mori (click him or
// press Tab, then the backpack: src/ui/v12/inspect.ts), and by everything that opened the old pack.

import { openPack12 } from './v12/pack';
import type { PackOpts12 } from './v12/pack';
// cooking registers the billy can's Use and the recipe notebook with the pack
import './v11/cooking';

/** Open the backpack. Resolves when it closes. (onEat is kept for old callers but not called: eating
 *  goes through v10/forage10 eatFood and the V12 hunger contract.) */
export async function openBackpack(o: PackOpts12 = {}): Promise<void> {
  await openPack12(o);
}

// The backpack. V11: the old slot grid and tool belt are gone; the pack is now the physical Backpack
// (src/ui/v11/backpack.ts): Mori swings it off, it opens up on the ground, and its tile grid holds
// every item in its own shape, the tools ride in their holders round the outside and a spring
// balance weighs the load. Everything that opened the old backpack still calls openBackpack.

import { openBackpack11 } from './v11/backpack';
import type { PackOpts } from './v11/backpack';
// cooking registers the billy can's Use and the recipe notebook with the pack
import './v11/cooking';

/** Open the backpack. Resolves when it closes. (onEat is kept for old callers but not called: eating
 *  goes through v10/forage10 eatFood, as it did in the V10 pack.) */
export async function openBackpack(o: { onEat?: (id: string) => void | Promise<void> } & PackOpts = {}): Promise<void> {
  await openBackpack11(o);
}

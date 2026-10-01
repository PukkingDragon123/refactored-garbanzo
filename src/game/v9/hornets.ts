// V9 jewel hornets: colourful fruit-eating hornets that nest underground, ant-style, beneath ember
// bushes. Harvesting berries over a nest can set the colony off.
//
// Contract used by the foraging code (src/game/v9/forage.ts):
//   nestUnder(x)          is there a hornet nest under the bush at world x?
//   hornetAmbush(s, x, y) the colony bursts out of the ground at (x, y) and chases the player;
//                         resolves when the encounter is over.

import type { IslandScene4 } from '../v4/island';

export type AmbushEnd = 'escaped' | 'stung';

export function nestUnder(x: number): boolean {
  void x;
  return false;
}

export async function hornetAmbush(s: IslandScene4, x: number, y: number): Promise<AmbushEnd> {
  void s; void x; void y;
  return 'escaped';
}

/** debug: an ambush at the nearest nest (zl.ambush) */
export async function debugAmbush(s: IslandScene4): Promise<AmbushEnd> {
  return hornetAmbush(s, s.player.x, s.player.y);
}

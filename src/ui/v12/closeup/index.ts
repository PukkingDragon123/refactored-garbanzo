// V12 close-ups: the hands-on pixel-art scenes that replace the small in-world QTEs for the moments
// worth zooming in on (cooking, digging out a find, pulling a plant, catching a critter, developing
// photos). The old QTEs stay behind the 'v12:oldqte' save flag. Debug: zl.closeup('cook' | 'dig' |
// 'pull' | 'catch' | 'dark'), or ?closeup=<kind> in the URL.

import { game } from '../../../game/game';

/** the close-ups are on (the save flag 'v12:oldqte' brings back the old QTEs) */
export const closeupsOn = () => !game.save?.flags?.['v12:oldqte'];

export type CloseupKind = 'cook' | 'dig' | 'fossil' | 'root' | 'pull' | 'flax' | 'catch' | 'frog' | 'crab' | 'dark';

/** open a close-up for testing */
export async function debugCloseup(kind: CloseupKind = 'cook'): Promise<unknown> {
  if (kind === 'cook') return (await import('./cook')).runCookCloseup({ where: 'camp', coach: 'joshu', title: 'Dinner for four', debug: true });
  return null;
}

function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (!w.zl) { setTimeout(hookZl, 500); return; }
  w.zl.closeup = (k: CloseupKind) => debugCloseup(k);
}
hookZl();

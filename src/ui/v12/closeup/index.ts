// V12 close-ups: the hands-on pixel-art scenes that replace the small in-world QTEs for the moments
// worth zooming in on (cooking, digging out a find, pulling a plant, catching a critter, developing
// photos). The old QTEs stay behind the 'v12:oldqte' save flag. Debug: zl.closeup('cook' | 'dig' |
// 'pull' | 'catch' | 'dark'), or ?closeup=<kind> in the URL.

import { game } from '../../../game/game';

/** the close-ups are on (the save flag 'v12:oldqte' brings back the old QTEs) */
export const closeupsOn = () => !game.save?.flags?.['v12:oldqte'];

export type CloseupKind = 'cook' | 'dig' | 'fossil' | 'root' | 'pull' | 'flax' | 'catch' | 'frog' | 'crab' | 'dark';

/** what a QTE call site asks for when the moment is worth a close-up */
export interface CloseupSpec {
  scene: 'dig' | 'pull' | 'catch';
  /** dig: what's buried */
  buried?: 'fossil' | 'ammonite' | 'root' | 'find';
  /** the item it's for (its art, its name on the tag) */
  item?: string;
  difficulty?: number;
}
/** run a close-up in a QTE's place; the same contract as the QTE: ok, score 0..1, perfect */
export async function closeupQte(s: CloseupSpec, world?: [number, number]): Promise<{ ok: boolean; score: number; perfect: boolean }> {
  let r: { ok: boolean; score: number; perfect: boolean };
  if (s.scene === 'dig') r = await (await import('./dig')).runDig({ buried: s.buried ?? 'find', item: s.item, difficulty: s.difficulty, world });
  else return { ok: false, score: 0, perfect: false };
  return { ok: r.ok, score: r.score, perfect: r.perfect };
}

/** open a close-up for testing */
export async function debugCloseup(kind: CloseupKind = 'cook'): Promise<unknown> {
  if (kind === 'cook') return (await import('./cook')).runCookCloseup({ where: 'camp', coach: 'joshu', title: 'Dinner for four', debug: true });
  if (kind === 'dig' || kind === 'fossil') return closeupQte({ scene: 'dig', buried: 'fossil', item: 'fos_vertebra' });
  if (kind === 'root') return closeupQte({ scene: 'dig', buried: 'root', item: 'vil_kumara' });
  return null;
}

function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (!w.zl) { setTimeout(hookZl, 500); return; }
  w.zl.closeup = (k: CloseupKind) => debugCloseup(k);
}
hookZl();

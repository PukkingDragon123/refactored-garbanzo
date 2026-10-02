// V11 contract: Blueprints replace the skill tree. Blueprints unlock crafting recipes, tools,
// equipment, survival upgrades and research technology; they are researched (Research Points at the
// laptop / bench) or earned from questlines (grantBlueprint). The blueprints module owns the real
// implementation (data, papers UI, crafting); everyone else only calls this API.
import { game } from '../game';
import { bucket } from '../v10/store';

export type BlueprintKind = 'tool' | 'equipment' | 'survival' | 'research' | 'recipe' | 'camp' | 'weapon';
export interface BlueprintDef {
  id: string;
  name: string;
  kind: BlueprintKind;
  desc: string;
  /** how it is usually obtained, for the papers UI ('research' | 'quest:<npc>' | 'found') */
  source?: string;
}

export const BLUEPRINTS: Record<string, BlueprintDef> = {};
export function defineBlueprint(d: BlueprintDef): BlueprintDef { BLUEPRINTS[d.id] = d; return d; }

const S = () => bucket('blueprints', () => ({ owned: {} as Record<string, { from: string; t: number; seen?: boolean }> }));
type BpFn = (id: string, from: string) => void;
const fns: BpFn[] = [];

export function hasBlueprint(id: string): boolean { return !!S().owned[id]; }
export function ownedBlueprints(): string[] { return Object.keys(S().owned); }
/** give a blueprint (a quest reward, a find, a research result); false if already owned */
export function grantBlueprint(id: string, from = 'quest'): boolean {
  const s = S();
  if (s.owned[id]) return false;
  s.owned[id] = { from, t: Date.now() };
  for (const f of fns.slice()) { try { f(id, from); } catch (e) { console.error(e); } }
  game.persist();
  return true;
}
export function onBlueprint(fn: BpFn): () => void { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; }

// known so far (the blueprints module adds the rest)
defineBlueprint({ id: 'slingshot', name: 'Slingshot', kind: 'weapon', desc: 'Aroha’s design: a forked mānuka frame, a rubber band from the wreck and a leather pouch. Scares off predators.', source: 'quest:aroha' });

// Crafting recipes (workbench, fire, by hand) and camp construction projects.

import { game } from './game';
import { hasSkill } from './skills';
import { ITEMS } from './items';
import { add, count, fits, hasTool, remove } from './inventory';

export type Station = 'hand' | 'bench' | 'fire';

export interface Recipe {
  id: string;
  out: string;
  n: number;
  needs: [string, number][];
  station: Station;
  /** seconds of crafting animation */
  time: number;
  /** skill that unlocks the recipe (none = known from the start) */
  skill?: string;
  /** story flag that unlocks it instead of a skill */
  flag?: string;
  /** tool the player must own */
  tool?: string;
}

export const RECIPES: Recipe[] = [
  { id: 'flax', out: 'flax', n: 3, needs: [['flaxleaf', 1]], station: 'hand', time: 1.2, tool: 'knife' },
  { id: 'rope', out: 'rope', n: 1, needs: [['flax', 3]], station: 'hand', time: 1.6 },
  { id: 'fruitlure', out: 'fruitlure', n: 1, needs: [['moonfruit', 2], ['kawakawa', 1]], station: 'bench', time: 2 },
  { id: 'grublure', out: 'grublure', n: 1, needs: [['grub', 3], ['wood', 1]], station: 'bench', time: 2, skill: 'lurecraft' },
  { id: 'fishbait', out: 'fishbait', n: 2, needs: [['mussel', 3]], station: 'bench', time: 1.6, skill: 'lurecraft' },
  { id: 'caller', out: 'caller', n: 1, needs: [['wood', 1], ['flaxleaf', 1]], station: 'bench', time: 2.4, skill: 'caller', tool: 'knife' },
  { id: 'scentlure', out: 'scentlure', n: 1, needs: [['dropping', 1], ['resin', 1]], station: 'bench', time: 2.4, skill: 'advlures', tool: 'gloves' },
  { id: 'glowlure', out: 'glowlure', n: 1, needs: [['glowcap', 2], ['resin', 1]], station: 'bench', time: 2.4, skill: 'advlures' },
  { id: 'trap', out: 'trap', n: 1, needs: [['scrap', 2], ['battery', 1], ['rope', 1]], station: 'bench', time: 3.5, skill: 'traps' },
  { id: 'net', out: 'net', n: 1, needs: [['flax', 4], ['wood', 1]], station: 'bench', time: 3, skill: 'net' },
  { id: 'ghillie', out: 'ghillie', n: 1, needs: [['fernfrond', 5], ['rope', 2]], station: 'bench', time: 4, skill: 'ghillie' },
  { id: 'tea', out: 'tea', n: 1, needs: [['kawakawa', 2]], station: 'fire', time: 2, flag: 'kitchen' },
  { id: 'stew', out: 'stew', n: 1, needs: [['moonfruit', 2], ['bracket', 1], ['mussel', 2]], station: 'fire', time: 3, flag: 'kitchen' },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map(r => [r.id, r]));

export function recipeKnown(r: Recipe) {
  if (r.skill && !hasSkill(r.skill)) return false;
  if (r.flag && !game.save.flags[r.flag]) return false;
  return true;
}

export function recipeState(r: Recipe): 'ok' | 'missing' | 'tool' | 'full' | 'locked' {
  if (!recipeKnown(r)) return 'locked';
  if (r.tool && !hasTool(r.tool)) return 'tool';
  if (!r.needs.every(([id, n]) => count(id) >= n)) return 'missing';
  if (ITEMS[r.out]?.kind !== 'tool' && ITEMS[r.out]?.kind !== 'key' && !fitsAfter(r)) return 'full';
  if (ITEMS[r.out]?.kind === 'tool' && hasTool(r.out)) return 'full';
  return 'ok';
}

/** would the output fit once the ingredients are consumed? (approximation: consuming frees whole stacks) */
function fitsAfter(r: Recipe) {
  if (fits(r.out, r.n)) return true;
  return r.needs.some(([id, n]) => count(id) === n);
}

/** Consume ingredients and add the output. Returns true on success. */
export function craft(r: Recipe): boolean {
  if (recipeState(r) !== 'ok') return false;
  for (const [id, n] of r.needs) remove(id, n);
  add(r.out, r.n);
  game.save.vars['crafted'] = (game.save.vars['crafted'] ?? 0) + 1;
  game.persist();
  return true;
}

// ---------------------------------------------------------------- camp builds

export interface BuildStage {
  needs: [string, number][];
  /** seconds of hammering */
  time: number;
  tool?: string;
  label: string;
}

export interface BuildDef {
  id: string;
  name: string;
  desc: string;
  stages: BuildStage[];
  /** player anim while working on it */
  anim: 'hammer' | 'build' | 'kneel';
}

export const BUILDS: Record<string, BuildDef> = {
  tent: {
    id: 'tent', name: 'Tent', desc: 'Somewhere dry to sleep, and a place for the laptop.', anim: 'hammer',
    stages: [
      { label: 'Stake out the pegs', needs: [], time: 2.5, tool: 'hammer' },
      { label: 'Raise the poles', needs: [['poles', 4]], time: 3, tool: 'hammer' },
      { label: 'Pull the canvas over', needs: [['canvas', 1]], time: 3 },
      { label: 'Tie down the guy ropes', needs: [['rope', 2]], time: 2.5, tool: 'hammer' },
    ],
  },
  fire: {
    id: 'fire', name: 'Campfire', desc: 'Warmth, light and Lou’s cooking.', anim: 'kneel',
    stages: [
      { label: 'Build a stone ring', needs: [['stone', 6]], time: 2.5 },
      { label: 'Stack the firewood', needs: [['wood', 5]], time: 2 },
      { label: 'Light it', needs: [], time: 1.5 },
    ],
  },
  bench: {
    id: 'bench', name: 'Workbench', desc: 'Craft lures, traps and tools.', anim: 'build',
    stages: [
      { label: 'Set up the trestles', needs: [['plank', 2]], time: 2.5, tool: 'hammer' },
      { label: 'Nail down the top', needs: [['plank', 2], ['scrap', 1]], time: 3, tool: 'hammer' },
    ],
  },
  radio: {
    id: 'radio', name: 'Radio mast', desc: 'Pip thinks she can reach the mainland with enough parts.', anim: 'build',
    stages: [
      { label: 'Raise the mast', needs: [['scrap', 4], ['rope', 2]], time: 3, tool: 'hammer' },
      { label: 'Wire the transmitter', needs: [['wire', 3], ['battery', 1]], time: 3 },
    ],
  },
};

export function buildLevel(id: string) {
  return game.save.builds[id] ?? 0;
}
export function buildDone(id: string) {
  return buildLevel(id) >= BUILDS[id].stages.length;
}
export function nextStage(id: string): BuildStage | null {
  return BUILDS[id].stages[buildLevel(id)] ?? null;
}
export function stageState(id: string): 'ok' | 'missing' | 'tool' | 'done' {
  const st = nextStage(id);
  if (!st) return 'done';
  if (st.tool && !hasTool(st.tool)) return 'tool';
  if (!st.needs.every(([it, n]) => count(it) >= n)) return 'missing';
  return 'ok';
}
/** Consume the next stage's materials and advance the build. */
export function advanceBuild(id: string): boolean {
  if (stageState(id) !== 'ok') return false;
  const st = nextStage(id)!;
  for (const [it, n] of st.needs) remove(it, n);
  game.save.builds[id] = buildLevel(id) + 1;
  game.persist();
  return true;
}
export function missingText(needs: [string, number][]) {
  return needs.filter(([id, n]) => count(id) < n).map(([id, n]) => `${ITEMS[id]?.name ?? id} ${count(id)}/${n}`).join(', ');
}

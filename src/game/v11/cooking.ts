// V11 cooking: what can be cooked, how, and what it does.
//
// Three ways to cook over a fire: the pot (stews, chowder, porridge, tea: simmer and stir), the pan
// (a flat pan on the stones: fritters, fries, compote: hot, and flip it) and the skewer (green sticks
// across the flames: grilled fish, roast bulbs, kebabs: turn it). Ingredients are the island's food
// (and a few plants); some want chopping first. A recipe is a dish made one way from certain
// ingredients; Mori learns them by experimenting (cook the right things the right way) or because
// someone teaches him (Joshu while he cooks, Aroha, the villagers: teachRecipe). Anything else he
// throws together still makes something to eat (a castaway hotpot, a mystery fry, charred bits).
//
// Dishes are food items: they restore energy and give a buff (well fed today = walking costs less;
// steady hands / light feet = the old expedition buffs), and the leftovers pack into the Backpack as
// tins and leaf parcels (they take grid room). How well it was cooked matters: perfect gives an extra
// portion and the dish's buff, burnt gives charcoal.
//
// The cooking close-up is src/ui/v11/cooking.ts; this module is data and rules only.

import { game } from '../game';
import { ITEMS, defineItem } from '../items';
import { bucket } from '../v10/store';
import { defineFood, foodInfo, onEaten } from '../v10/forage10';
import { dayState, dayNumber } from '../v10/day';
import { registerFootprint } from './footprints';

export type Method = 'pot' | 'pan' | 'skewer';
export type Tag = 'fish' | 'shellfish' | 'starch' | 'fruit' | 'herb' | 'grub' | 'mushroom' | 'bread';
export type Quality = 'raw' | 'good' | 'perfect' | 'burnt';

/** what each ingredient counts as, whether it wants chopping, and its colours (raw -> cooked) */
export interface Ingredient { tags: Tag[]; chop?: boolean; raw: string; cooked: string }
export const INGREDIENTS: Record<string, Ingredient> = {
  v10_fish: { tags: ['fish'], chop: true, raw: '#c8d0d8', cooked: '#e8c890' },
  mussel: { tags: ['shellfish'], raw: '#3a3a5a', cooked: '#e8a868' },
  pipi: { tags: ['shellfish'], raw: '#e8dcc0', cooked: '#f0c890' },
  ration: { tags: ['starch', 'bread'], raw: '#d8b878', cooked: '#c89048' },
  vil_rewena: { tags: ['starch', 'bread'], chop: true, raw: '#e0c088', cooked: '#b87838' },
  vil_kumara: { tags: ['starch'], chop: true, raw: '#a8583a', cooked: '#e8a050' },
  plant_dunelily: { tags: ['starch'], chop: true, raw: '#e8e0c8', cooked: '#e0b060' },
  berry_ember: { tags: ['fruit'], raw: '#d83028', cooked: '#8a1a28' },
  berry_dusk: { tags: ['fruit'], raw: '#6a4a8a', cooked: '#4a2a5a' },
  berry_gold: { tags: ['fruit'], raw: '#f0c030', cooked: '#d88a20' },
  moonfruit: { tags: ['fruit'], chop: true, raw: '#f0f0d8', cooked: '#e8d088' },
  kawakawa: { tags: ['herb'], chop: true, raw: '#3a8a3a', cooked: '#2a5a22' },
  plant_seaholly: { tags: ['herb'], chop: true, raw: '#8ab0c0', cooked: '#5a7a6a' },
  plant_saltfern: { tags: ['herb'], chop: true, raw: '#7aa060', cooked: '#4a6a32' },
  grub: { tags: ['grub'], raw: '#f0e8c8', cooked: '#d8a050' },
  glowcap: { tags: ['mushroom'], chop: true, raw: '#7af0e0', cooked: '#3a8a80' },
  inkcap: { tags: ['mushroom'], chop: true, raw: '#8a5ab0', cooked: '#4a2a5a' },
};
export const isIngredient = (id: string) => !!INGREDIENTS[id];

/** a need: one specific item, or anything with a tag */
export interface Need { id?: string; tag?: Tag; n: number }
export interface Recipe {
  id: string;
  name: string;
  method: Method;
  needs: Need[];
  /** the dish item it makes, and how many portions (a perfect one makes one more) */
  dish: string;
  portions: number;
  /** seconds over the right heat to be done */
  time: number;
  /** the heat it wants (0..1 of the fire) */
  heat: [number, number];
  /** who teaches it, and their line when they do */
  teach?: { who: string; line: string };
  /** a hint in the notebook before Mori knows it */
  hint: string;
}

/** the dishes (food items that pack as tins and leaf parcels) */
interface DishDef { id: string; name: string; desc: string; energy: number; eat?: 'steady' | 'quiet' | 'energy'; hearty?: boolean; fp: [number, number]; kg: number; stack: number }
const DISHES: DishDef[] = [
  { id: 'dish_chowder', name: 'Pipi chowder', desc: 'Creamy, briny and full of little clams. A tin of it keeps you going all morning.', energy: 42, hearty: true, fp: [1, 2], kg: 0.6, stack: 2 },
  { id: 'dish_fishstew', name: 'Kawakawa fish stew', desc: 'Joshu’s stew: flaky fish in a peppery green broth. Steadies the hands.', energy: 48, eat: 'steady', fp: [1, 2], kg: 0.7, stack: 2 },
  { id: 'dish_grilledfish', name: 'Grilled fish', desc: 'Smoky, crisp-skinned and charred at the edges, wrapped in a flax leaf.', energy: 34, fp: [2, 1], kg: 0.5, stack: 2 },
  { id: 'dish_porridge', name: 'Berry porridge', desc: 'Ship biscuits soaked soft and cooked with berries until everything turns purple.', energy: 36, hearty: true, fp: [1, 2], kg: 0.5, stack: 2 },
  { id: 'dish_fritters', name: 'Dune lily fritters', desc: 'Aroha’s fritters: roasting breaks down the bulb’s needles. Crispy, nutty, safe.', energy: 30, fp: [1, 1], kg: 0.2, stack: 6 },
  { id: 'dish_roastbulbs', name: 'Ember-roast bulbs', desc: 'Bulbs roasted black outside, soft and sweet inside. Eat them hot.', energy: 24, fp: [2, 1], kg: 0.3, stack: 4 },
  { id: 'dish_skewers', name: 'Mussel skewers', desc: 'Mussels threaded on a green stick and roasted until the shells pop.', energy: 30, fp: [2, 1], kg: 0.3, stack: 3 },
  { id: 'dish_compote', name: 'Moonfruit compote', desc: 'Moonfruit and berries cooked down sticky-sweet. Somehow calming.', energy: 26, eat: 'quiet', fp: [1, 1], kg: 0.3, stack: 3 },
  { id: 'dish_grubfry', name: 'Huhu grub fry', desc: 'Fried in their own fat they taste like peanut butter. Do not think about it.', energy: 32, eat: 'energy', fp: [1, 1], kg: 0.2, stack: 4 },
  { id: 'dish_hotpot', name: 'Castaway hotpot', desc: 'Whatever was in the pack, boiled together. It is food. Mostly.', energy: 22, fp: [1, 2], kg: 0.6, stack: 2 },
  { id: 'dish_mysteryfry', name: 'Mystery fry', desc: 'Something fried. Several somethings. Crunchy.', energy: 18, fp: [1, 1], kg: 0.2, stack: 4 },
  { id: 'dish_charred', name: 'Charcoal surprise', desc: 'It was food once. Chunk will still eat it.', energy: 6, fp: [1, 1], kg: 0.2, stack: 6 },
];
for (const d of DISHES) {
  if (!ITEMS[d.id]) defineItem({ id: d.id, name: d.name, kind: 'food', stack: d.stack, desc: d.desc, eat: d.eat ?? 'energy', energy: d.energy, weight: d.kg, where: 'Cooked at the fire' });
  defineFood(d.id, { energy: d.energy });
  registerFootprint(d.id, { w: d.fp[0], h: d.fp[1] });
}
const HEARTY = new Set(DISHES.filter(d => d.hearty).map(d => d.id));
export const isDish = (id: string) => DISHES.some(d => d.id === id);

export const RECIPES: Recipe[] = [
  { id: 'chowder', name: 'Pipi chowder', method: 'pot', needs: [{ tag: 'shellfish', n: 3 }, { tag: 'starch', n: 1 }], dish: 'dish_chowder', portions: 2, time: 14, heat: [0.45, 0.75],
    teach: { who: 'joshu', line: 'Shellfish, something starchy to thicken it, a slow simmer and keep it moving. That’s a chowder, lad.' }, hint: 'Shellfish and something starchy, simmered in the pot.' },
  { id: 'fishstew', name: 'Kawakawa fish stew', method: 'pot', needs: [{ tag: 'fish', n: 1 }, { tag: 'herb', n: 1 }], dish: 'dish_fishstew', portions: 2, time: 16, heat: [0.45, 0.75],
    teach: { who: 'joshu', line: 'Fish, cut small. A handful of greens for the pepper. Never let it boil hard or the fish falls to bits.' }, hint: 'A fish and a peppery leaf, in the pot.' },
  { id: 'grilledfish', name: 'Grilled fish', method: 'skewer', needs: [{ tag: 'fish', n: 1 }], dish: 'dish_grilledfish', portions: 1, time: 12, heat: [0.4, 0.7],
    teach: { who: 'joshu', line: 'Whole fish on a green stick. Turn it before the skin sticks. You want it singing, not screaming.' }, hint: 'A whole fish over the flames.' },
  { id: 'porridge', name: 'Berry porridge', method: 'pot', needs: [{ id: 'ration', n: 2 }, { tag: 'fruit', n: 3 }], dish: 'dish_porridge', portions: 2, time: 10, heat: [0.35, 0.65],
    teach: { who: 'jenna', line: 'Ship biscuits plus berries plus stirring until your arm falls off equals porridge. It’s basically science.' }, hint: 'Two ship biscuits and a handful of berries, stirred soft.' },
  { id: 'fritters', name: 'Dune lily fritters', method: 'pan', needs: [{ id: 'plant_dunelily', n: 2 }], dish: 'dish_fritters', portions: 3, time: 9, heat: [0.6, 0.9],
    teach: { who: 'aroha', line: 'Grate the bulbs, press them flat, a hot stone. The heat takes the sting out. Raw, they burn your mouth.' }, hint: 'Dune lily bulbs, chopped and pan-fried hot.' },
  { id: 'roastbulbs', name: 'Ember-roast bulbs', method: 'skewer', needs: [{ tag: 'starch', n: 2 }], dish: 'dish_roastbulbs', portions: 2, time: 11, heat: [0.5, 0.8],
    teach: { who: 'aroha', line: 'Kūmara, lily bulbs, whatever is starchy. Into the heat until the skin is black. Then the inside is sweet.' }, hint: 'Two starchy roots on the skewer.' },
  { id: 'skewers', name: 'Mussel skewers', method: 'skewer', needs: [{ id: 'mussel', n: 4 }], dish: 'dish_skewers', portions: 2, time: 8, heat: [0.45, 0.75], hint: 'Mussels threaded on a stick.' },
  { id: 'compote', name: 'Moonfruit compote', method: 'pan', needs: [{ id: 'moonfruit', n: 2 }, { tag: 'fruit', n: 2 }], dish: 'dish_compote', portions: 2, time: 8, heat: [0.35, 0.6], hint: 'Moonfruit and berries, cooked down slowly in the pan.' },
  { id: 'grubfry', name: 'Huhu grub fry', method: 'pan', needs: [{ id: 'grub', n: 3 }], dish: 'dish_grubfry', portions: 2, time: 6, heat: [0.6, 0.9],
    teach: { who: 'aroha', line: 'Huhu grubs. Hot pan, no oil, they bring their own. Taste like butter. Close your eyes if you must.' }, hint: 'Three huhu grubs, fried hot.' },
  { id: 'tea', name: 'Kawakawa tea', method: 'pot', needs: [{ id: 'kawakawa', n: 2 }], dish: 'tea', portions: 2, time: 7, heat: [0.4, 0.8],
    teach: { who: 'aroha', line: 'The leaves with the most holes are the best. Steep them, don’t boil them to death.' }, hint: 'Two kawakawa leaves, steeped in the pot.' },
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map(r => [r.id, r]));

// ---------------------------------------------------------------- the notebook

interface CookState { known: Record<string, { from: string; t: number }>; cooked: Record<string, number>; best: Record<string, Quality>; billy?: boolean }
const S = () => bucket<CookState>('cook11', () => ({ known: {}, cooked: {}, best: {} }));
export const knowsRecipe = (id: string) => !!S().known[id];
export const knownRecipes = () => RECIPES.filter(r => knowsRecipe(r.id));
export const timesCooked = (id: string) => S().cooked[id] ?? 0;
export const bestQuality = (id: string): Quality | null => S().best[id] ?? null;

type LearnFn = (r: Recipe, from: string) => void;
const learnFns: LearnFn[] = [];
export function onLearn(fn: LearnFn): () => void { learnFns.push(fn); return () => { const i = learnFns.indexOf(fn); if (i >= 0) learnFns.splice(i, 1); }; }
/** someone teaches Mori a recipe (crew, villagers, a find); false if he knew it */
export function teachRecipe(id: string, from = 'experiment'): boolean {
  const r = RECIPE_BY_ID[id];
  if (!r || knowsRecipe(id)) return false;
  S().known[id] = { from, t: Date.now() };
  for (const f of learnFns.slice()) { try { f(r, from); } catch (e) { console.error(e); } }
  game.persist();
  return true;
}
/** the next recipe this crew member would teach (null when they've taught all theirs) */
export function nextToTeach(who: string): Recipe | null { return RECIPES.find(r => r.teach?.who === who && !knowsRecipe(r.id)) ?? null; }

/** Mori's billy can (the small pot for cooking out on an expedition) */
export const hasBilly = () => !!S().billy || game.save.tools.includes('billy');
defineItem({ id: 'billy', name: 'Billy can', kind: 'tool', stack: 1, weight: 0.5, desc: 'Joshu’s old blackened billy can with a wire handle. Cook out in the field over a little fire.' });
registerFootprint('billy', { w: 1, h: 2 });

// ---------------------------------------------------------------- matching

const tagCount = (ids: string[], tag: Tag) => ids.filter(id => INGREDIENTS[id]?.tags.includes(tag)).length;
/** does this pot / pan / skewer of ingredients make the recipe? (extra ingredients are fine for a pot, not for the pan or skewer) */
export function matches(r: Recipe, method: Method, ids: string[]): boolean {
  if (r.method !== method) return false;
  const pool = ids.slice();
  for (const nd of r.needs) {
    for (let k = 0; k < nd.n; k++) {
      const i = pool.findIndex(id => nd.id ? id === nd.id : INGREDIENTS[id]?.tags.includes(nd.tag!));
      if (i < 0) return false;
      pool.splice(i, 1);
    }
  }
  return method === 'pot' || pool.length <= 1;
}
/** the recipe these ingredients make this way (the most specific match), or null */
export function recipeFor(method: Method, ids: string[]): Recipe | null {
  const ok = RECIPES.filter(r => matches(r, method, ids));
  ok.sort((a, b) => b.needs.reduce((s, n) => s + n.n + (n.id ? 0.5 : 0), 0) - a.needs.reduce((s, n) => s + n.n + (n.id ? 0.5 : 0), 0));
  return ok[0] ?? null;
}
/** how a method cooks when it's no recipe */
export const ADHOC: Record<Method, { dish: string; time: number; heat: [number, number] }> = {
  pot: { dish: 'dish_hotpot', time: 11, heat: [0.4, 0.75] },
  pan: { dish: 'dish_mysteryfry', time: 7, heat: [0.5, 0.85] },
  skewer: { dish: 'dish_mysteryfry', time: 9, heat: [0.45, 0.8] },
};
/** what the cook-pot would make, its timing and heat */
export function plan(method: Method, ids: string[]): { recipe: Recipe | null; dish: string; time: number; heat: [number, number]; portions: number } {
  const r = recipeFor(method, ids);
  if (r) return { recipe: r, dish: r.dish, time: r.time, heat: r.heat, portions: r.portions };
  const a = ADHOC[method];
  return { recipe: null, dish: a.dish, time: a.time + ids.length, heat: a.heat, portions: Math.max(1, Math.min(3, Math.floor(ids.length / 2))) };
}
/** any poisonous or unknown forage in the mix? (cooking doesn't make it safe) */
export function riskyIn(ids: string[]): string[] { return ids.filter(id => { const f = foodInfo(id); return f.risky && f.verdict !== 'safe'; }); }

export interface CookResult { dish: string; portions: number; quality: Quality; recipe: Recipe | null; learned: boolean }
/** record a finished dish (the close-up hands over the portions) */
export function finishCook(method: Method, ids: string[], doneness: number, care: number): CookResult {
  const p = plan(method, ids);
  // doneness 1 = just right; care 0..1 (stirred / turned / chopped well)
  let quality: Quality = doneness < 0.72 ? 'raw' : doneness > 1.18 ? 'burnt' : doneness >= 0.88 && doneness <= 1.08 && care >= 0.55 ? 'perfect' : 'good';
  let dish = p.dish, portions = p.portions;
  if (quality === 'burnt') { dish = 'dish_charred'; portions = Math.max(1, portions - 1); }
  if (quality === 'perfect') portions += 1;
  if (quality === 'raw') portions = Math.max(1, portions - 1);
  let learned = false;
  if (p.recipe && quality !== 'burnt') learned = teachRecipe(p.recipe.id, 'experiment');
  const s = S();
  if (p.recipe) {
    s.cooked[p.recipe.id] = (s.cooked[p.recipe.id] ?? 0) + 1;
    const rank = { raw: 0, burnt: 0, good: 1, perfect: 2 } as const;
    if (!s.best[p.recipe.id] || rank[quality] > rank[s.best[p.recipe.id]]) s.best[p.recipe.id] = quality;
  }
  game.persist();
  void quality;
  return { dish, portions, quality, recipe: p.recipe, learned };
}

/** energy from a portion eaten straight off the fire (raw is worse, perfect better) */
export function servingEnergy(dish: string, q: Quality): number {
  const base = ITEMS[dish]?.energy ?? 15;
  return Math.round(base * (q === 'perfect' ? 1.3 : q === 'good' ? 1 : q === 'raw' ? 0.6 : 0.3));
}

/** Joshu's packed lunch from the camp stores (the trail sign): a tin of whatever he has */
export function lunchFor(fish: boolean, tea: boolean): { id: string; n: number }[] {
  const out = [{ id: fish ? 'dish_grilledfish' : 'ration', n: fish ? 1 : 2 }];
  if (tea) out.push({ id: 'tea', n: 1 });
  return out;
}

// a hearty dish eaten from the pack: well fed for the day (gearFx.wellFed)
onEaten((id, fx) => {
  if (!HEARTY.has(id) || fx !== 'none') return;
  dayState().buff = { id: 'hearty', day: dayNumber() };
});

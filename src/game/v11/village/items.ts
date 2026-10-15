// V11 Te Kāinga items: village food you can taste or pack (a hāngī parcel, smoked tuna, parāoa
// parai, boiled eggs), the shed serpent skin (Hinerua's gift, washed into the reeds by the river),
// the hue kiri (Mori's own, made by Aunty Ngaio), Hēmi's bone pendant of Hinerua, and the two dishes
// the village teaches (Nanny Huia's boil-up, Rāwiri's eel stew) with their recipes.

import { ITEMS, defineItem } from '../../items';
import { defineFood } from '../../v10/forage10';
import { registerFootprint } from '../footprints';
import { INGREDIENTS, RECIPES, RECIPE_BY_ID } from '../cooking';
import type { Recipe } from '../cooking';
import '../../../art/v11/village/itemart';

interface Def { id: string; name: string; kind: 'food' | 'material' | 'key'; desc: string; stack: number; kg: number; energy?: number; eat?: string; fp: [number, number] }
const DEFS: Def[] = [
  { id: 'vil_hangi', name: 'Hāngī parcel', kind: 'food', stack: 3, kg: 0.6, energy: 40, fp: [2, 1], desc: 'Kūmara, pumpkin, fish and pork, steamed for hours in the earth oven and wrapped in leaves. Smoky, soft, enormous.' },
  { id: 'vil_tuna', name: 'Smoked tuna', kind: 'food', stack: 4, kg: 0.3, energy: 26, fp: [2, 1], desc: 'Eel from Rāwiri’s hīnaki, smoked golden over mānuka on the rack. Rich and oily. Keeps for days.' },
  { id: 'vil_paraoa', name: 'Parāoa parai', kind: 'food', stack: 6, kg: 0.15, energy: 20, fp: [1, 1], desc: 'Nanny Huia’s fried bread with a drip of golden syrup. Still warm. Gone in three bites.' },
  { id: 'vil_egg', name: 'Boiled eggs', kind: 'food', stack: 6, kg: 0.2, energy: 12, fp: [1, 1], desc: 'Three brown eggs from the village hens, boiled in the pot by the hāngī.' },
  { id: 'vil_kiri', name: 'Shed serpent skin', kind: 'material', stack: 3, kg: 0.05, fp: [2, 1], desc: 'A papery, translucent moult, every scale printed in it. The river leaves them in the reeds when the serpents shed: Hinerua’s gift, the village says. Nobody was harmed for it.' },
  { id: 'vil_huekiri', name: 'Hue kiri', kind: 'key', stack: 1, kg: 1.2, fp: [2, 3], desc: 'Your own hue kiri, made by Aunty Ngaio: a gourd body with a shed serpent skin stretched over its face, a neck ending in a carved serpent head, two strings of muka. It hums when the wind blows.' },
  { id: 'vil_hei', name: 'Hinerua pendant', kind: 'key', stack: 1, kg: 0.05, fp: [1, 1], desc: 'A small bone carving of Hinerua coiled on herself, on a flax cord. Uncle Hēmi carved it for you after the festival. “So she knows you.”' },
];
for (const d of DEFS) {
  if (!ITEMS[d.id]) defineItem({ id: d.id, name: d.name, kind: d.kind, stack: d.stack, desc: d.desc, weight: d.kg, where: 'Te Kāinga', ...(d.kind === 'food' ? { eat: d.eat ?? 'energy', energy: d.energy } : {}) });
  if (d.kind === 'food') defineFood(d.id, { energy: d.energy });
  registerFootprint(d.id, { w: d.fp[0], h: d.fp[1] });
}

// the village dishes
const DISHES = [
  { id: 'dish_boilup', name: 'Kūmara boil-up', desc: 'Nanny Huia’s boil-up: fish, kūmara and peppery greens simmered together until the broth is gold. Fills you to the boots.', energy: 46, kg: 0.7 },
  { id: 'dish_eelstew', name: 'Tuna stew', desc: 'Rāwiri’s stew: smoked eel with greens, simmered slow. Steadies the hands.', energy: 44, kg: 0.6, eat: 'steady' },
];
for (const d of DISHES) {
  if (!ITEMS[d.id]) defineItem({ id: d.id, name: d.name, kind: 'food', stack: 2, desc: d.desc, eat: d.eat ?? 'energy', energy: d.energy, weight: d.kg, where: 'Cooked at the fire' });
  defineFood(d.id, { energy: d.energy });
  registerFootprint(d.id, { w: 1, h: 2 });
}
INGREDIENTS.vil_tuna ??= { tags: ['fish'], chop: true, raw: '#a8682a', cooked: '#c88a3a' };
const NEW: Recipe[] = [
  { id: 'boilup', name: 'Kūmara boil-up', method: 'pot', needs: [{ tag: 'fish', n: 1 }, { id: 'vil_kumara', n: 1 }, { tag: 'herb', n: 1 }], dish: 'dish_boilup', portions: 2, time: 15, heat: [0.45, 0.75],
    teach: { who: 'huia', line: 'Fish, kūmara, a handful of greens. Everything in the one pot and leave it alone. A boil-up is patience, not cleverness.' }, hint: 'Fish, kūmara and greens, simmered together in the pot.' },
  { id: 'eelstew', name: 'Tuna stew', method: 'pot', needs: [{ id: 'vil_tuna', n: 1 }, { tag: 'herb', n: 1 }], dish: 'dish_eelstew', portions: 2, time: 13, heat: [0.4, 0.7],
    teach: { who: 'rawiri', line: 'Smoked tuna, broken up, and greens. Low heat, bro. The smoke does the work.' }, hint: 'Smoked eel and a peppery leaf, in the pot.' },
];
for (const r of NEW) if (!RECIPE_BY_ID[r.id]) { RECIPES.push(r); RECIPE_BY_ID[r.id] = r; }

export const VILLAGE_FOODS = ['vil_hangi', 'vil_tuna', 'vil_paraoa', 'vil_egg', 'vil_rewena', 'vil_kumara', 'vil_tea'];

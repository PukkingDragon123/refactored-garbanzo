// V10/V11: Te Kāinga, the village of Aroha's whānau, the kaitiaki (guardians) of the island. Up the
// river from the mangroves, on a terrace: the canoe landing and Hinerua's pou, the eel traps and the
// smoking rack, the kūmara gardens and the pig pen, the carved wharenui and the marae in front of it,
// the hāngī, the carving shed with a waka on its trestles, the family houses, the pātaka, the hens,
// the goats and the carved gateway to the old track up to the pā. Eleven people with their own days
// (src/game/v11/village/people.ts), animals, chores and food, Hinerua's story by the fire at night,
// the offering, Koro's blessing, the hue kiri lessons and the festival night.
// The scene itself is built by src/game/v11/village/scene.ts.

import type { Site10 } from './kit';
import { arrive10, game } from './kit';
import { discover } from '../v10/regions';
import { buildVillage, enterVillage, villageGround, villageCtx, W, G, X } from '../v11/village/scene';

export { villageGround };
const F = () => game.save.flags;

export const VILLAGE: Site10 = {
  id: 'village', loc: 'village', name: 'Te Kāinga', width: W, camY: 176, spawnX: 120, exitX: 34, waterY: G + 6,
  ambience: 'forest', music: 'aroha', ground: 'grass', noGuide: false,
  build: f => buildVillage(f),
  spawns: [
    { species: 'nutcracker', n: [2, 4], x: [500, 1700], herd: true, times: ['dawn', 'day'], chance: 0.6 },
    { species: 'barkgecko', n: [1, 2], x: [300, 2300], chance: 0.6 },
    { species: 'snakestork', n: [1, 1], x: [30, 220], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'galehawk', n: [1, 1], x: [200, 2400], medium: 'air', times: ['day'], chance: 0.5 },
  ],
  insects: [
    { kind: 'butterfly', x: [300, 2200], y: [200, 270], n: 6, times: ['day', 'dawn'] },
    { kind: 'bee', x: [420, 700], y: [240, 275], n: 6, times: ['day'] },
    { kind: 'dragonfly', x: [0, 230], y: [260, 290], n: 4, times: ['day', 'dusk'] },
    { kind: 'firefly', x: [0, W], y: [190, 280], n: 16, times: ['dusk', 'night'] },
  ],
  onEnter: async f => {
    if (!villageCtx()?.festival) await arrive10(f, 'Te Kāinga', 'Aroha’s whānau', 'Welcome to my home, Mori. Take your shoes off at the wharenui, and let Koro speak first.');
    if (!F()['v10:villageMet']) {
      F()['v10:villageMet'] = true;
      game.persist();
      discover({ id: 'vil:kainga', kind: 'village', name: 'Te Kāinga', loc: 'village', x: X.wharenui, note: 'The kaitiaki village: Aroha’s whānau.' }, true);
    }
    await enterVillage(f);
  },
  v10: {
    points: [
      { id: 'vil:wharenui', kind: 'village', name: 'The wharenui', x: X.wharenui, photo: { w: 200, h: 160 }, note: 'The carved meeting house: the ancestors are its ridgepole, its rafters, its posts.' },
      { id: 'vil:waka', kind: 'artifact', name: 'The waka', x: X.waka, photo: { w: 130, h: 22 }, note: 'A river canoe with a carved prow, dug from a single trunk.' },
      { id: 'vil:pou', kind: 'village', name: 'Hinerua’s pou', x: X.pou, photo: { w: 40, h: 120 }, note: 'A carved post at the landing: Hinerua, the serpent guardian of the river, coiling up it.' },
      { id: 'vil:pataka', kind: 'village', name: 'The pātaka', x: X.pataka, photo: { w: 52, h: 86 }, note: 'A storehouse on a post, safe from rats and floods.' },
      { id: 'vil:gardens', kind: 'plant', name: 'Kūmara gardens', x: 560, photo: { w: 280, h: 20 }, note: 'Rows of kūmara mounds facing the sun.' },
      { id: 'vil:wakabuild', kind: 'artifact', name: 'A waka in the making', x: X.wakaBuild, photo: { w: 150, h: 40 }, note: 'Uncle Hēmi’s new waka: a tōtara trunk on trestles, half adzed, chips everywhere.' },
      { id: 'vil:gate', kind: 'village', name: 'The carved gateway', x: X.gate, photo: { w: 70, h: 104 }, note: 'The waharoa, gateway to the old track up to the pā. Hinerua lies along its lintel.' },
    ],
  },
};

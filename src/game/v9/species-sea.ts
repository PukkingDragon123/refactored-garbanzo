// V9 field guide: open-ocean animals seen from the Kittiwake. Entries use the shared Species
// format (see ../species.ts); the optional
// `research` sheet is what MoriOS shows once a photo of the animal has been uploaded.

import type { Species } from '../species';
import { ph } from './ev';

export const SEA9: Species[] = [
  {
    id: 'albatross', name: 'Wandering Albatross', sci: 'Diomedea exulans', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '3.1 m wingspan', blurb: 'Toroa. The biggest wingspan of any living bird. It can glide for hours without a single flap, and sleeps on the wing.',
    behaviors: { soaring: 'Dynamic soaring', skimming: 'Skimming the swell' },
    facts: [{ id: 'albatross-soar', cat: 'Adaptation', q: 'How does the albatross travel so far without flapping?', options: ['Dynamic soaring on the wind over the waves', 'It rests on the water every few minutes', 'It follows ships'], answer: 0, text: 'It uses the wind gradient above the swell, climbing and diving in long arcs to harvest energy.', evidence: [ph('albatross', 'soaring')], hint: 'Photograph it soaring past the mast.' }],
  },
  {
    id: 'redgull', name: 'Red-billed Gull', sci: 'Chroicocephalus scopulinus', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '37 cm', blurb: 'Tarāpunga. Loud, bold and absolutely certain your lunch belongs to it.',
    behaviors: { flying: 'Flying', begging: 'Begging' },
    facts: [{ id: 'gull-beg', cat: 'Behaviour', q: 'Why do gulls follow fishing boats?', options: ['Scraps and bait', 'Shade', 'Warmth from the engine'], answer: 0, text: 'Easy food: bait, scraps and stunned fish churned up in the wake.', evidence: [ph('redgull', 'begging')], hint: 'Catch one hovering near the fishing spot.' }],
  },
  {
    id: 'shearwater', name: 'Sooty Shearwater', sci: 'Ardenna grisea', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '45 cm', blurb: 'Tītī. Flies 64,000 km every year in a giant figure-eight around the Pacific, skimming the waves.',
    behaviors: { skimming: 'Skimming' },
    facts: [{ id: 'shear-skim', cat: 'Behaviour', q: 'How did the shearwater get its name?', options: ['It shears the wave tops with its wingtips', 'It cuts fish in half', 'It sheds its feathers'], answer: 0, text: 'It flies so low it seems to shear the water with its wingtips.', evidence: [ph('shearwater', 'skimming')], hint: 'Photograph one skimming the swell.' }],
  },
  {
    id: 'hectors', name: 'Hector’s Dolphin', sci: 'Cephalorhynchus hectori', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '1.4 m', blurb: 'Upokohue. One of the smallest dolphins in the world, with a round dorsal fin shaped like a Mickey Mouse ear.',
    behaviors: { leaping: 'Leaping', bowriding: 'Bow-riding' },
    facts: [{ id: 'hectors-bow', cat: 'Behaviour', q: 'Why do dolphins ride a ship’s bow wave?', options: ['Free push from the pressure wave, and fun', 'To clean their skin', 'To escape sharks'], answer: 0, text: 'The bow wave gives them a free ride. They seem to do it simply because it’s fun.', evidence: [ph('hectors', 'leaping')], hint: 'Watch the water off the bow.' }],
  },
  {
    id: 'flyingfish', name: 'Flying Fish', sci: 'Cheilopogon pinnatibarbatus', group: 'Fish', sites: [], times: ['day'],
    rarity: 2, danger: 0, size: '35 cm', blurb: 'Maroro. Beats its tail at the surface and glides on wing-like fins for up to 50 metres to escape predators.',
    behaviors: { gliding: 'Gliding' },
    facts: [{ id: 'ff-glide', cat: 'Adaptation', q: 'Why does a flying fish leave the water?', options: ['To escape predators', 'To catch insects', 'To breathe'], answer: 0, text: 'A burst into the air leaves tuna and dolphins guessing where it went.', evidence: [ph('flyingfish', 'gliding')], hint: 'They burst out of the swell near the boat.' }],
  },
  {
    id: 'rightwhale', name: 'Southern Right Whale', sci: 'Eubalaena australis', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '16 m', blurb: 'Tohorā. A gentle giant with a V-shaped blow. Once hunted almost to nothing, slowly coming back.',
    behaviors: { spouting: 'Spouting', fluking: 'Fluking' },
    facts: [{ id: 'rw-blow', cat: 'Anatomy', q: 'Why is a right whale’s blow V-shaped?', options: ['It has two blowholes', 'It spins as it breathes', 'Wind splits it'], answer: 0, text: 'Baleen whales have two blowholes side by side, so the spout splits into a V.', evidence: [ph('rightwhale', 'spouting')], hint: 'Watch the horizon for a spout.' }],
  },
];

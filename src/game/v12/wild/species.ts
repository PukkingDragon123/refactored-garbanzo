// V12 the glow-worms of Te Tuawhenua for the field guide: titiwai, under the mossy overhang by the creek
// in the feathered gully (the scene side, the dark and the glow: ./encounters.ts). Not an Animal: the
// colony is one photo subject that shows only in the dark (at night, or when Mori sits still in the
// recess until his eyes adjust).
//
// Imported by ../../species.ts (so the guide, the camera and the research log know them from boot).

import type { Species } from '../../species';
import { FUN } from '../../../ui/v10/funfacts';
import './items';

export const TITIWAI_ID = 'titiwai';
const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });

export const TITIWAI_SPECIES: Species = {
  id: TITIWAI_ID, name: 'Titiwai (glow-worm)', sci: 'Arachnocampa luminosa', group: 'Insect', sites: [], times: ['dusk', 'night'],
  rarity: 3, danger: 0, size: 'A larva 3 cm long; its lines hang 10 to 40 cm',
  blurb: 'Under a dark wet overhang the ceiling is full of stars: hundreds of blue-green lights, each hanging a curtain of silk threads beaded with sticky droplets. Every light is the tail of a fly larva, fishing in the dark.',
  behaviors: { glowing: 'Glowing in the dark' },
  facts: [
    {
      id: 'tw-light', cat: 'Behaviour', q: 'Why do titiwai glow?', options: ['To lure flying insects up into their sticky fishing lines', 'To scare off predators', 'To keep warm on cold nights'], answer: 0,
      text: 'Midges and mayflies hatching from the creek fly toward the light, thinking it is the open sky, and blunder into the hanging threads. The hungrier the larva, the brighter it glows.',
      evidence: [ph(TITIWAI_ID, 'glowing')], hint: 'Sit still under the mossy overhang by the creek in the feathered gully until your eyes adjust, or come back after dark.',
    },
    {
      id: 'tw-worm', cat: 'Anatomy', q: 'What is a glow-worm, really?', options: ['The larva of a fungus gnat: a kind of fly', 'A true worm', 'A beetle'], answer: 0,
      text: 'It is not a worm at all. It is a maggot of a small fly, and the adult fly has no mouth: it lives a few days, mates, lays its eggs, and dies. The light comes from an organ at the end of the larva\'s gut.',
      evidence: [ph(TITIWAI_ID, 'glowing')], hint: 'A clear photo of the lights in the dark.',
    },
    {
      id: 'tw-lines', cat: 'Diet', q: 'What are the hanging threads made of?', options: ['Silk beaded with droplets of sticky mucus', 'Spider web it borrows', 'Fungus threads'], answer: 0,
      text: 'Each larva lowers up to seventy lines from its silk hammock, every one strung with glue droplets like a necklace. When something sticks, it hauls the line up and eats it.',
      evidence: [ph(TITIWAI_ID, 'glowing')], hint: 'Get close enough to the glow that the threads show in the photo.',
    },
  ],
  research: {
    habitat: 'Dark, damp, still places out of the wind: overhanging creek banks, caves, tunnels of tree fern. They need the air wet so their lines don\'t dry out.',
    diet: 'Midges, mosquitoes, mayflies, the odd moth: whatever flies up out of the creek and into the threads.',
    anatomy: 'A soft, see-through larva in a tube of silk and slime, a light organ at its tail. The lines are silk beaded with mucus droplets.',
    ecology: 'They depend on the creek: no hatching insects, no food. In turn they get eaten by harvestmen and by each other.',
    behaviour: 'They dim when disturbed by light and noise and come back up slowly in the dark and quiet. The light is brightest when the larva is hungriest.',
    notes: [
      'Sat in the dark under the bank and waited. My eyes adjusted and the whole ceiling came on, like someone turned the stars up.',
      'Aroha says her nan called them titiwai: lights reflected in water. I can see why.',
      'Do NOT shine a torch at them. They switch off and sulk.',
    ],
    status: 'Common in the right places',
  },
};

FUN[TITIWAI_ID] = 'Titiwai are not worms: they are the larvae of a small fly, and they glow brightest when they are hungriest.';

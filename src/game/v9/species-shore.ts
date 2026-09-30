// V9 field guide: the island shore (tide line, rocks, cave, cove, bush edge). Entries use the
// shared Species format (see ../species.ts); the optional
// `research` sheet is what MoriOS shows once a photo of the animal has been uploaded.

import type { Species } from '../species';
import { ph } from './ev';

export const SHORE9: Species[] = [
  {
    id: 'corvexseal', name: 'Corvex Seal', sci: 'Corvexocephalus rubrifrons', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 2, size: '3.6 m', blurb: 'A huge shaggy black seal with a crimson face and white markings. Sleeps like a boulder, wakes like a landslide, and gallops far faster than anything that heavy has any right to.',
    behaviors: { sleeping: 'Sleeping', charging: 'Charging', exhausted: 'Exhausted' },
    facts: [{ id: 'corvex-sprint', cat: 'Adaptation', q: 'Why does a Corvex Seal give up a chase so quickly?', options: ['Huge muscles built for short bursts, very little stamina on land', 'It is frightened of dogs', 'Hot sand burns its flippers'], answer: 0, text: 'On land it is all sprint and no marathon: a few hundred metres and it has to flop down and pant.', evidence: [ph('corvexseal', 'exhausted')], hint: 'Photograph it once it has tired itself out.' }],
  },
  {
    id: 'glasscrab', name: 'Glass Crab', sci: 'Hyalocarcinus pellucidus', group: 'Crustacean', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '2 cm', blurb: 'A thumbnail-sized crab with see-through claws. It sprints sideways into its burrow at the first footstep.',
    behaviors: { scuttling: 'Scuttling', burrowing: 'Burrowing' },
    facts: [{ id: 'glasscrab-hide', cat: 'Behaviour', q: 'How does the Glass Crab escape gulls?', options: ['It dives into a burrow in the wet sand', 'It plays dead', 'It pinches'], answer: 0, text: 'Every crab has a burrow within a few body lengths, and it knows exactly where it is.', evidence: [ph('glasscrab', 'scuttling')], hint: 'Creep up slowly on the wet sand.' }],
  },
  {
    id: 'swashrunner', name: 'Swashrunner', sci: 'Charadrius undarum', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '17 cm', blurb: 'A tiny plover that chases every retreating wave down the sand to snatch sand-hoppers, then sprints back up ahead of the next one.',
    behaviors: { running: 'Chasing the waves', feeding: 'Feeding' },
    facts: [{ id: 'swash-run', cat: 'Diet', q: 'Why does the Swashrunner chase the waves?', options: ['Sand-hoppers surface as the water drains away', 'It is playing', 'To wash its feet'], answer: 0, text: 'The backwash exposes hoppers and worms for a second or two. Speed is everything.', evidence: [ph('swashrunner', 'running')], hint: 'Watch the edge of the water.' }],
  },
  {
    id: 'torea', name: 'Variable Oystercatcher', sci: 'Haematopus unicolor', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '48 cm', blurb: 'Tōrea pango. Jet black with a carrot-orange bill it uses as a crowbar to prise open shellfish. Very loud about everything.',
    behaviors: { probing: 'Probing', calling: 'Piping' },
    facts: [{ id: 'torea-bill', cat: 'Adaptation', q: 'What is the oystercatcher’s long bill for?', options: ['Prising open shellfish', 'Fighting', 'Catching flies'], answer: 0, text: 'It stabs between the two halves of a mussel and snips the muscle that holds it shut.', evidence: [ph('torea', 'probing')], hint: 'Look along the rocks and the wrack line.' }],
  },
  {
    id: 'korora', name: 'Little Penguin', sci: 'Eudyptula minor', group: 'Bird', sites: [], times: ['dusk', 'night'],
    rarity: 2, danger: 0, size: '30 cm', blurb: 'Kororā. The smallest penguin in the world, blue as the sea. Comes ashore at dusk and waddles home to its burrow.',
    behaviors: { waddling: 'Waddling home' },
    facts: [{ id: 'korora-dusk', cat: 'Activity', q: 'Why do kororā come ashore at dusk?', options: ['The dark hides them from predators', 'The sand is cooler', 'To watch the sunset'], answer: 0, text: 'They fish all day at sea and only cross the open beach once it is dark enough to be safe.', evidence: [ph('korora', 'waddling')], hint: 'Wait on the beach as the light goes.' }],
  },
  {
    id: 'kelpskink', name: 'Kelp Skink', sci: 'Oligosoma algae', group: 'Reptile', sites: [], times: ['day'],
    rarity: 1, danger: 0, size: '12 cm', blurb: 'A copper-striped skink that hunts sand-hoppers in the rotting kelp of the wrack line and basks on sun-warmed rocks.',
    behaviors: { basking: 'Basking', hunting: 'Hunting' },
    facts: [{ id: 'skink-bask', cat: 'Behaviour', q: 'Why does the skink lie flat on the rocks?', options: ['To soak up heat', 'To hide from birds', 'To sleep'], answer: 0, text: 'It is cold-blooded: it has to warm up before it is fast enough to hunt.', evidence: [ph('kelpskink', 'basking')], hint: 'Warm rocks in the sun.' }],
  },
  {
    id: 'titiwai', name: 'Titiwai', sci: 'Arachnocampa luminosa', group: 'Insect', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 2, danger: 0, size: '3 cm', blurb: 'The New Zealand glowworm: not a worm at all but the larva of a fungus gnat. It hangs sticky silk threads from the cave roof and glows to lure insects in.',
    behaviors: { glowing: 'Glowing' },
    facts: [{ id: 'titiwai-glow', cat: 'Diet', q: 'Why does the titiwai glow?', options: ['To lure insects onto its sticky threads', 'To see in the dark', 'To scare bats'], answer: 0, text: 'Midges and moths fly toward the light and get stuck in the fishing lines.', evidence: [ph('titiwai', 'glowing')], hint: 'Look up inside the sea cave.' }],
  },
  {
    id: 'piwakawaka', name: 'Fantail', sci: 'Rhipidura fuliginosa', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '16 cm', blurb: 'Pīwakawaka. Flits around anyone walking through the bush, fanning its tail and snapping up the insects they disturb.',
    behaviors: { flitting: 'Following you' },
    facts: [{ id: 'fantail-follow', cat: 'Behaviour', q: 'Why does the fantail follow people?', options: ['Footsteps flush out insects', 'It is curious', 'It wants crumbs'], answer: 0, text: 'Walkers kick up moths and flies. The fantail just hangs around and eats them.', evidence: [ph('piwakawaka', 'flitting')], hint: 'Walk the bush track and look around you.' }],
  },
  {
    id: 'wheke', name: 'Rock Pool Octopus', sci: 'Pinnoctopus cordiformis', group: 'Mollusc', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '60 cm', blurb: 'Wheke. Changes colour and texture in a blink, and can squeeze through any gap wider than its beak.',
    behaviors: { peeking: 'Peeking out', hiding: 'Camouflaged' },
    facts: [{ id: 'wheke-colour', cat: 'Adaptation', q: 'How does the octopus change colour so fast?', options: ['Muscles squeeze pigment sacs in its skin', 'It holds its breath', 'The water changes'], answer: 0, text: 'Thousands of chromatophores open and close in a fraction of a second.', evidence: [ph('wheke', 'peeking')], hint: 'The rock pools at the west end of the beach.' }],
  },
];

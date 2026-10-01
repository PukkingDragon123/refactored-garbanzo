// V9 field guide: the island's stranger residents (the Trycop crab, fruit hornets, parasites and the
// small life of the sand, turf and bush). Shared Species format; see ../species.ts.

import type { Species } from '../species';
import { ph, vid } from './ev';

export const WILD9: Species[] = [
  {
    id: 'trycop', name: 'Trycop Crab', sci: 'Tricopis ocellata', group: 'Crustacean', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 1, size: '38 cm across the legs',
    blurb: 'A big vermilion rock crab covered in ringed cream spots. "Trycop" means three choppers: a black-tipped crusher, a long saw-edged cutter, and a little third claw that grows out of its mouthparts and eats with the manners of a fork.',
    behaviors: { foraging: 'Picking algae', scuttling: 'Scuttling sideways', threat: 'Threat display', snapping: 'Snapping', hiding: 'Hiding in its crevice' },
    facts: [
      { id: 'trycop-fork', cat: 'Anatomy', q: 'What is the Trycop’s third claw for?', options: ['Picking algae and feeding the mouth', 'Fighting rivals', 'Digging burrows'], answer: 0, text: 'A pair of mouthparts fused into one small pincer: it plucks algae and scraps off the rock and feeds them straight to the jaws while the big claws stand guard.', evidence: [ph('trycop', 'foraging')], hint: 'Creep up crouched and photograph one eating.' },
      { id: 'trycop-display', cat: 'Behaviour', q: 'Why does the Trycop rear up and spread its claws?', options: ['To look as big as possible to a threat', 'To catch the wind', 'To warm its underside'], answer: 0, text: 'Reared up with both claws gaping it is nearly twice its size. Most gulls, dogs and naturalists get the message.', evidence: [ph('trycop', 'threat')], hint: 'Walk up to one. It will tell you when you are too close.' },
      { id: 'trycop-crevice', cat: 'Ecology', q: 'Where does a harassed Trycop go?', options: ['Backwards into its own rock crevice', 'Into the sea', 'Up a palm tree'], answer: 0, text: 'Every crab keeps a crevice near its feeding rocks and backs into it, leaving only the eye stalks peeking over the lip.', evidence: [ph('trycop', 'hiding')], hint: 'Keep pestering one and watch where it runs.' },
    ],
    research: {
      habitat: 'Wave-washed basalt at the seal rocks and the west rock pools, always within a quick scuttle of a deep crevice.',
      diet: 'Grazes algae films and scavenges scraps with its fork claw; the crusher cracks limpets and small snails.',
      anatomy: 'Three working claws: a massive crusher with molar knobs and black tips, a slim saw-edged cutter, and a median fork claw evolved from fused third maxillipeds. Eyes on long swivelling stalks. The round spots are ringed like eyes (ocelli), which is where "ocellata" comes from.',
      ecology: 'Top grazer of the pool edges. Hunted by the oystercatchers when small; adults have no island enemies except the root barnacle, a parasite that castrates it and hijacks its body.',
      behaviour: 'Forages by day, scuttles sideways on a four-and-four alternating gait, and puts on a rearing claws-up display at the first sign of trouble. Pushed further, it snaps once and then retreats to its crevice.',
      notes: ['Froths at the mouth when it’s out of the water. It is breathing, not furious. (It is also furious.)', 'One of the big ones at the seal rocks carries something orange under its abdomen. Get it to rear up and look.', 'Found a whole shed crusher claw near the rocks. It moults its entire armour at once.'],
      status: 'Locally common',
    },
  },
  {
    id: 'rootbarnacle', name: 'Root Barnacle', sci: 'Rhizokopis tricopae', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 4, danger: 0, size: '3 cm sac, roots through the whole host',
    blurb: 'Not a crab’s egg sac but a parasite: a barnacle that gave up its shell and legs, and grows as roots through the Trycop’s body. All you ever see is the orange sac it pushes out under the crab’s abdomen.',
    behaviors: { attached: 'On its host' },
    facts: [
      { id: 'rootbarn-host', cat: 'Ecology', q: 'Why does an infected Trycop guard the orange sac?', options: ['The parasite makes it treat the sac like its own eggs', 'The sac is its food store', 'It doesn’t notice it'], answer: 0, text: 'The root barnacle takes over its host’s brood care: the crab cleans, airs and defends the parasite’s sac as if it were its own clutch of eggs.', evidence: [ph('rootbarnacle', 'attached'), ph('trycop', 'threat')], hint: 'Only visible when the crab rears up. Get close.' },
    ],
    research: {
      habitat: 'Inside Trycop crabs. The larvae drift in the rock pools looking for a host.',
      diet: 'Absorbs nutrients from the crab’s blood through a web of roots that runs all the way to its legs.',
      anatomy: 'An adult has no shell, no legs, no gut: just the root network inside the host and the external sac (the externa) full of eggs. You can only tell it is a barnacle from its larvae.',
      ecology: 'Castrates its host and redirects the crab’s energy into making more parasites. An infected crab stops moulting, so it keeps its scars and barnacle crust for life.',
      behaviour: 'None of its own: it behaves through its host, which fans, cleans and guards the sac.',
      notes: ['The crab carrying it reared up and there it was: a bright orange lump where its eggs should be.', 'Parasites that eat their host from the inside and then steer it... I am never going to sleep again.'],
      status: 'Seen on one crab',
    },
  },
];
void vid;

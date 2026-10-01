// V9 field guide: the island's stranger residents (the Trycop crab, fruit hornets, parasites and the
// small life of the sand, turf and bush). Shared Species format; see ../species.ts.

import type { Species } from '../species';
import { ph, vid } from './ev';
import '../../art/v9/wild/register';

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
  {
    id: 'jewelhornet', name: 'Jewel Hornet', sci: 'Chrysovespa baccivora', group: 'Insect', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 1, size: '3 cm',
    blurb: 'A hornet in stained glass: banded gold, violet and teal, with huge gold eyes. It gave up hunting for fruit, nests underground like an ant beneath the ember bushes, and defends its berries with total commitment.',
    behaviors: { foraging: 'Feeding on berries', nesting: 'At the nest', swarming: 'Swarming' },
    facts: [
      { id: 'hornet-fruit', cat: 'Diet', q: 'What do jewel hornets eat?', options: ['Ripe fruit and berry juice', 'Other insects', 'Nectar only'], answer: 0, text: 'They chew open emberberries and drink the juice; their guts are full of pulp, not meat.', evidence: [ph('jewelhornet', 'foraging')], hint: 'Watch an ember bush and photograph one at a berry.' },
      { id: 'hornet-nest', cat: 'Behaviour', q: 'Where do jewel hornets nest?', options: ['Underground, under the berry bushes', 'Paper nests in trees', 'In the sea cave'], answer: 0, text: 'Like ants they dig galleries under the roots of their food plant, so the larder is right on the doorstep.', evidence: [ph('jewelhornet', 'nesting')], hint: 'Look for holes at the foot of an ember bush.' },
      { id: 'hornet-swarm', cat: 'Ecology', q: 'Why does the whole colony attack berry pickers?', options: ['The bush is their food store and they defend it', 'They are attracted to sweat', 'They mistake people for flowers'], answer: 0, text: 'Pick their berries and you are robbing the larder. A scout checks you out, then the colony pours out.', evidence: [ph('jewelhornet', 'swarming')], hint: 'This one you may not want to photograph up close.' },
    ],
    research: {
      habitat: 'Under the ember bushes on the landing beach, in the palm grove and up the bush track.',
      diet: 'Berry juice and soft fruit, chewed open with saw-edged mandibles. Larvae are fed chewed pulp.',
      anatomy: 'The colours are structural, like a beetle’s: layered cuticle that bends the light. A short, thick stinger whose venom is mostly alarm signal and swelling.',
      ecology: 'Spreads ember bush seeds in its droppings, so the bushes grow best over a nest. Host of the zombie-cap fungus.',
      behaviour: 'Foragers commute between the nest holes and the berries all day; a guard hovers over the entrances. Disturb the bush over a nest and the ground hums and a scout comes up to look at you. Keep picking and the colony erupts.',
      notes: ['They hum before they attack. Listen to the ground.', 'Escape routes: run, jump in the stream or the creek, or crouch in the flax. Do not argue with them.', 'My cheek still looks like a tomato.'],
      status: 'Common',
    },
  },
  {
    id: 'hornetcap', name: 'Zombie-cap', sci: 'Thanatomyces vespicola', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 0, size: '1.5 cm stalk',
    blurb: 'A fungus that infects jewel hornets. It steers its dying host up a twig, makes it bite down and hold on, then bursts out of its back as a pale stalk with an orange knob that rains spores on the nest below.',
    behaviors: { sporing: 'Releasing spores' },
    facts: [
      { id: 'zcap-climb', cat: 'Ecology', q: 'Why are the dead hornets always clamped high on twigs?', options: ['The fungus makes them climb and bite down before they die', 'Birds stick them there', 'They die of cold up there'], answer: 0, text: 'The fungus hijacks its host’s behaviour: a high perch spreads the spores furthest, right over the next nest.', evidence: [ph('hornetcap', 'sporing')], hint: 'Look along the twigs on the bush track.' },
    ],
    research: {
      habitat: 'Twigs and leaf tips on the bush track, above the jewel hornet nests.',
      diet: 'Digests its host from the inside, keeping the vital organs going until the last moment.',
      anatomy: 'Threads (hyphae) fill the hornet’s body; the fruiting stalk breaks out between the thorax plates and ends in a spore-bearing knob.',
      ecology: 'Keeps the hornet colonies in check.',
      behaviour: 'Puffs spores every few seconds, most on warm, still mornings.',
      notes: ['Nature has a horror department and it is fully staffed.'],
      status: 'Uncommon',
    },
  },
  {
    id: 'puppetfluke', name: 'Puppeteer Fluke', sci: 'Marionetta ocularis', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '1 cm (inside a snail)',
    blurb: 'A parasitic flatworm that lives in amber snails and swells one eye stalk into a fat, throbbing, green-and-yellow banded tube. It drives its host to climb into the open, where a bird will mistake the stalk for a caterpillar.',
    behaviors: { climbing: 'Climbing into the open', pulsing: 'Pulsing eye stalk' },
    facts: [
      { id: 'fluke-bird', cat: 'Ecology', q: 'Why does the fluke make its snail climb to the top of a stem?', options: ['So a bird eats it, carrying the fluke to its next host', 'To find food', 'To dry out'], answer: 0, text: 'The fluke can only breed inside a bird. A snail in the open with a "caterpillar" on its head is a bird magnet.', evidence: [ph('puppetfluke', 'climbing'), ph('ambersnail', 'grazing')], hint: 'Compare an infected snail with a healthy one.' },
      { id: 'fluke-pulse', cat: 'Behaviour', q: 'Why does the swollen eye stalk throb?', options: ['The moving bands look like a wriggling caterpillar', 'The snail is breathing', 'It is cooling down'], answer: 0, text: 'The fluke’s brood sacs pump in time, so the stripes seem to crawl.', evidence: [ph('puppetfluke', 'pulsing')], hint: 'Wait for one to reach the top of its stem.' },
    ],
    research: {
      habitat: 'Inside amber snails at the bush edge and in the palm grove.',
      diet: 'Absorbs food from the snail’s gut; as an adult, from a bird’s intestine.',
      anatomy: 'In the snail it grows as a branching sac; the brood tubes push into an eye stalk and stretch it into a banded bulb.',
      ecology: 'Snail, then bird, then snail again: its eggs come out in bird droppings, which the snails eat.',
      behaviour: 'An infected snail stops hiding and climbs toward the light, day after day.',
      notes: ['Healthy snails stay low and tuck in when you come close. The infected ones just keep climbing.'],
      status: 'Uncommon',
    },
  },
  {
    id: 'ambersnail', name: 'Amber Snail', sci: 'Succinea insularis', group: 'Mollusc', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 1, danger: 0, size: '2 cm',
    blurb: 'A small land snail with a glossy amber shell banded in chocolate. It grazes the damp leaf litter and pulls in at the slightest bump.',
    behaviors: { grazing: 'Grazing', hiding: 'Withdrawn' },
    facts: [
      { id: 'snail-tuck', cat: 'Behaviour', q: 'How does an amber snail protect itself?', options: ['It pulls into its shell', 'It squirts ink', 'It plays dead'], answer: 0, text: 'Shake the ground near it and the whole snail vanishes into its shell.', evidence: [ph('ambersnail', 'hiding')], hint: 'Walk past one without creeping.' },
    ],
    research: {
      habitat: 'Damp litter at the bush edge and under the palms.',
      diet: 'Rasps algae, fungus and soft leaves with a tongue covered in thousands of tiny teeth.',
      anatomy: 'A thin, glossy shell; two pairs of tentacles, the long upper pair carrying the eyes.',
      ecology: 'Host of the puppeteer fluke. Eaten by birds and skinks.',
      behaviour: 'Active when it is damp; seals itself in during dry afternoons.',
      status: 'Common',
    },
  },
  {
    id: 'canhermit', name: 'Tin-can Hermit', sci: 'Paguristes kittiwakei', group: 'Crustacean', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 2, danger: 0, size: '6 cm',
    blurb: 'Hermit crabs that have moved into the wreck’s rubbish: a dog-food tin, a bottle cap, a jam-jar lid. Some of them look very pleased with the upgrade.',
    behaviors: { wandering: 'Out and about', hiding: 'Inside its tin' },
    facts: [
      { id: 'hermit-shell', cat: 'Adaptation', q: 'Why do hermit crabs carry a "house"?', options: ['Their soft abdomen needs armour they cannot grow', 'To store food', 'To attract mates'], answer: 0, text: 'A hermit crab’s rear end is soft and curled. It borrows armour, and rubbish works as well as a shell.', evidence: [ph('canhermit', 'wandering')], hint: 'Look on the sand around the wreck.' },
      { id: 'hermit-hide', cat: 'Behaviour', q: 'What does a tin-can hermit do when you come close?', options: ['Pulls in and plugs the door with its claw', 'Runs into the sea', 'Pinches your toes'], answer: 0, text: 'The big claw fits the opening like a lid.', evidence: [ph('canhermit', 'hiding')], hint: 'Walk up to one.' },
    ],
    research: {
      habitat: 'The sand around the wreck of the Kittiwake and the top of the landing beach.',
      diet: 'Scavenges anything: wrack, dead hoppers, and judging by the tin, dog food.',
      anatomy: 'A soft, spiral abdomen that grips the inside of its home; one oversized right claw used as a door.',
      ecology: 'There are more crabs than good shells on the island, so the Kittiwake’s rubbish set off a housing boom.',
      behaviour: 'Wanders slowly, dragging its home; pulls in at the first shadow and peeks out a few seconds later.',
      notes: ['One of them lives in a can of Chunky Chow. Chunk is furious. Chunk is also not allowed near it.'],
      status: 'Common near the wreck',
    },
  },
  {
    id: 'periscopeeel', name: 'Periscope Sand Eel', sci: 'Heteroconger speculator', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '25 cm (mostly underground)',
    blurb: 'Colonies of slender spotted eels standing out of the wet sand like a field of periscopes, snapping plankton from the backwash. Come close and they sink back into their burrows one after another.',
    behaviors: { peeking: 'Standing out of the sand', feeding: 'Snapping plankton', hiding: 'Down the burrow' },
    facts: [
      { id: 'eel-hide', cat: 'Behaviour', q: 'How do periscope eels avoid danger?', options: ['They drop back tail-first into their burrows', 'They swim away fast', 'They bury themselves in kelp'], answer: 0, text: 'Each eel lives in its own mucus-lined burrow and never fully leaves it, so it can vanish in a blink.', evidence: [ph('periscopeeel', 'peeking')], hint: 'Creep up crouched; they rise again when everything is still.' },
      { id: 'eel-feed', cat: 'Diet', q: 'What do they eat?', options: ['Plankton washed past by the waves', 'Crabs', 'Seaweed'], answer: 0, text: 'They face the swash and snap tiny drifting animals out of each wave.', evidence: [ph('periscopeeel', 'feeding')], hint: 'Watch one for a few seconds.' },
    ],
    research: {
      habitat: 'The firm wet sand of the swash zone, in colonies of a few to a dozen.',
      diet: 'Plankton and drifting larvae.',
      anatomy: 'A long, stiff body and a short upturned face with big eyes; the hardened tail tip digs the burrow.',
      ecology: 'Swashrunners and oystercatchers try for them and are almost never fast enough.',
      behaviour: 'Feeds only when calm. The whole colony drops in a ripple when one eel sees danger.',
      status: 'Locally common',
    },
  },
  {
    id: 'wrackhopper', name: 'Wrack Hopper', sci: 'Talorchestia saltatrix', group: 'Crustacean', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 1, danger: 0, size: '1.5 cm',
    blurb: 'Sand hoppers living by the thousand under the rotting kelp of the wrack line. Walk through a pile and they spray up like popcorn.',
    behaviors: { leaping: 'Leaping' },
    facts: [
      { id: 'hopper-leap', cat: 'Adaptation', q: 'How does a sand hopper jump so high?', options: ['It flicks its tail down like a spring', 'It has long back legs', 'The wind blows it'], answer: 0, text: 'It snaps its abdomen down against the sand, firing itself fifty times its own length.', evidence: [ph('wrackhopper', 'leaping')], hint: 'Walk through a pile of kelp on the beach.' },
    ],
    research: {
      habitat: 'Under every pile of wrack along the shore.',
      diet: 'Rotting kelp, which they recycle into food for everything else.',
      anatomy: 'Not insects but tiny crustaceans (amphipods), cousins of the crabs.',
      ecology: 'Food for swashrunners, kelp skinks, oystercatchers, gobies and the tin-can hermits.',
      behaviour: 'Buried by day, out at night; a footstep sets a whole pile leaping.',
      status: 'Abundant',
    },
  },
  {
    id: 'leafmantis', name: 'Leaf-veil Mantis', sci: 'Phyllomantis velata', group: 'Insect', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '5 cm',
    blurb: 'A mantis disguised as a leaf: its abdomen is a broad green blade with a midrib and a browned edge, and it sways with the breeze while it waits for a fly to wander into range.',
    behaviors: { swaying: 'Swaying like a leaf', striking: 'Striking' },
    facts: [
      { id: 'mantis-sway', cat: 'Adaptation', q: 'Why does the mantis rock back and forth?', options: ['To move like a leaf in the wind', 'It is dizzy', 'To keep warm'], answer: 0, text: 'A perfectly still leaf on a windy day looks wrong. A swaying one looks like every other leaf.', evidence: [ph('leafmantis', 'swaying')], hint: 'Look very closely at the twigs in the grove.' },
      { id: 'mantis-strike', cat: 'Diet', q: 'How does it catch flies?', options: ['A lightning grab with spiked forelegs', 'A sticky tongue', 'A web'], answer: 0, text: 'The folded forelegs shoot out and snap shut in a fraction of a second.', evidence: [ph('leafmantis', 'striking')], hint: 'Wait for a fly to come close to one.' },
    ],
    research: {
      habitat: 'Twigs in the palm grove and the bush.',
      diet: 'Flies, moths and the occasional young hornet.',
      anatomy: 'Flattened leaf-shaped extensions on the abdomen and thorax, with fake veins and a fake brown edge of "leaf damage".',
      ecology: 'An ambush predator of the flower visitors.',
      behaviour: 'Sits for hours on one twig, rocking in time with the wind.',
      notes: ['I walked past it three times. It was RIGHT THERE.'],
      status: 'Rarely seen (it is very good at this)',
    },
  },
  {
    id: 'lanternmoth', name: 'Lantern Moth', sci: 'Lychnopteryx bioculata', group: 'Insect', sites: [], times: ['dusk', 'night'],
    rarity: 2, danger: 0, size: '4 cm wingspan',
    blurb: 'A mottled moth with two spots on its wings that glow pale gold, but only in flight. At dusk the bush track twinkles with them.',
    behaviors: { flying: 'Flying (glowing)', resting: 'Resting' },
    facts: [
      { id: 'moth-glow', cat: 'Adaptation', q: 'Why do the lantern moth’s spots only glow in flight?', options: ['A flash startles hunters, then it vanishes when it lands', 'To find flowers', 'They are charging up'], answer: 0, text: 'A hunter homes in on the glow, and the moment the moth lands the lights go out and it disappears.', evidence: [ph('lanternmoth', 'flying'), ph('lanternmoth', 'resting')], hint: 'Out at dusk on the bush track and around the flowers.' },
    ],
    research: {
      habitat: 'Flowers along the beach edge and the bush track, from dusk.',
      diet: 'Nectar, through a long coiled tongue.',
      anatomy: 'Each glowing spot is a patch of luminous scales fed by a pouch of glowing bacteria; the flight muscles squeeze it.',
      ecology: 'Pollinates the night flowers. Hunted by the leaf-veil mantis.',
      behaviour: 'Flutters round flowers in loose groups after sunset.',
      status: 'Common at dusk',
    },
  },
  {
    id: 'skipgoby', name: 'Mudskip Goby', sci: 'Periophthalmus velifer', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '9 cm',
    blurb: 'A fish that lives out of the water on the stream-mouth mud, walking on its fins, flaring a blue-and-orange sail at rivals, and skipping away across the water when startled.',
    behaviors: { basking: 'Basking on the mud', display: 'Sail display', skipping: 'Skipping away' },
    facts: [
      { id: 'goby-air', cat: 'Adaptation', q: 'How does the goby breathe out of water?', options: ['A mouthful of water held in its gills, and its wet skin', 'It has lungs', 'It holds its breath'], answer: 0, text: 'It carries water in its gill chambers like a scuba tank and absorbs oxygen through wet skin.', evidence: [ph('skipgoby', 'basking')], hint: 'Find them on the mud at the stream mouth.' },
      { id: 'goby-sail', cat: 'Behaviour', q: 'What is the bright sail fin for?', options: ['Showing off to rivals and mates', 'Gliding', 'Steering underwater'], answer: 0, text: 'Males raise the sail to claim a patch of mud.', evidence: [ph('skipgoby', 'display')], hint: 'Wait quietly near a group.' },
    ],
    research: {
      habitat: 'The wet mud and sandbars at the stream mouth.',
      diet: 'Small crabs, worms and sand hoppers.',
      anatomy: 'Eyes on top of the head that retract for wetting; muscular pectoral fins used as crutches.',
      ecology: 'Prey for oystercatchers. Competes with the glass crabs for the best mud.',
      behaviour: 'Basks, displays and squabbles at low tide; skips across the surface when disturbed.',
      status: 'Common',
    },
  },
  {
    id: 'jewelbeetle', name: 'Jewel Beetle', sci: 'Chrysochroa insulana', group: 'Insect', sites: [], times: ['day'],
    rarity: 1, danger: 0, size: '1.5 cm',
    blurb: 'A metallic green-and-gold beetle that spends its days head-down in flowers, and lifts off with an indignant buzz if you come too close.',
    behaviors: { feeding: 'Feeding on flowers', flying: 'Flying' },
    facts: [
      { id: 'beetle-shine', cat: 'Anatomy', q: 'Where does the beetle’s colour come from?', options: ['Layers in its shell that bend light', 'Green pigment', 'Pollen dust'], answer: 0, text: 'There is no green pigment at all: the shine is structural, like a soap bubble.', evidence: [ph('jewelbeetle', 'feeding')], hint: 'Check the flower clumps.' },
    ],
    research: {
      habitat: 'Flower clumps on the beach edge, in the grove and up the track.',
      diet: 'Pollen and petals.',
      anatomy: 'Hard metallic wing cases over folded flying wings.',
      ecology: 'A pollinator, and a snack for the leaf-veil mantis.',
      behaviour: 'Feeds in the sun and flies between clumps.',
      status: 'Common',
    },
  },
];
void vid;

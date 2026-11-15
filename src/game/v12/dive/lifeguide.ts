// V12 Te Moana Rimurimu: the kelp dive's life in the field guide. The Glasseye Whaler, the hāpuku, the
// kingfish, the blue cod, the ocean sunfish and its cleanerfish, the eagle ray (art: src/art/v12/dive/),
// the Corvex Seal's underwater behaviours (its swim anims: src/art/v9/shore/seal.ts), and the catch the
// speargun brings home (kingfish fillet, blue cod) as food for the cooking loop.
//
// Imported by ../../species.ts at boot (so the guide, the camera and the research log know them, and
// saves that carry the catch load anywhere). Light on purpose: the brains are in ./species.ts.

import type { Species, Fact, Evidence } from '../../species';
import { registerBeast } from '../../../art/beasts';
import { GLASSEYE } from '../../../art/v12/dive/shark';
import { HAPUKU, KINGFISH, BLUECOD, SUNFISH, CLEANER, diveFishStill } from '../../../art/v12/dive/bigfish';
import { EAGLERAY } from '../../../art/v12/dive/ray';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';
import { defineItem, ITEMS } from '../../items';
import { defineFood } from '../../v10/forage10';
import { registerItemArt, registerItemArtBuffer, itemArtBuffer } from '../../../art/v11/itemart';
import { PixelBuffer } from '../../../art/pixel';
import { hex, rgba } from '../../../art/color';

export const SHARK_ID = 'glasseye';
export const HAPUKU_ID = 'hapuku';
export const KING_ID = 'kingfish';
export const COD_ID = 'bluecod';
export const SUN_ID = 'sunfish';
export const CLEAN_ID = 'cleanerfish';
export const RAY_ID = 'eagleray';
export const SEAL_ID = 'corvexseal';

registerBeast(SHARK_ID, GLASSEYE);
registerBeast(HAPUKU_ID, HAPUKU);
registerBeast(KING_ID, KINGFISH);
registerBeast(COD_ID, BLUECOD);
registerBeast(SUN_ID, SUNFISH);
registerBeast(CLEAN_ID, CLEANER);
registerBeast(RAY_ID, EAGLERAY);

const ph = (species: string, behavior: string): Evidence => ({ kind: 'photo', species, behavior });
const ALL: Species['times'] = ['dawn', 'day', 'dusk', 'night'];

// ==================================================================== the Glasseye Whaler
export const GLASSEYE_SPECIES: Species = {
  id: SHARK_ID, name: 'Glasseye Whaler', sci: 'Carcharhinus vitreus', group: 'Fish', sites: [], times: ALL,
  rarity: 4, danger: 2, size: 'About 3 m long',
  blurb: 'A big bronze whaler shark of the drop-off and the blue: a sleek, heavy body in countershaded bronze over white, long sickle pectorals, a scarred snout, and the eye that gives it its name, pale and glassy as a marble. It patrols the edge of the reef, and it has learned that a diver with a speargun means a struggling fish.',
  behaviors: {
    patrolling: 'Patrolling the drop-off', circling: 'Circling', warning: 'The warning hunch', charging: 'Charging',
    stealing: 'Stealing a catch', veering: 'Veering off',
  },
  facts: [
    {
      id: 'gw-hunch', cat: 'Behaviour', q: 'Why does a Glasseye Whaler hump its back and point its pectoral fins down?', options: ['It is a warning: "back off, or I charge". The display comes before an attack', 'It is resting', 'It is about to give birth'], answer: 0,
      text: 'Many whaler sharks threaten before they attack: the back hunches, the snout lifts, the pectoral fins jam straight down and the swimming turns stiff and exaggerated. It is a bluff and a warning in one. Read it and get out of its way, or into the kelp.',
      evidence: [ph(SHARK_ID, 'warning')], hint: 'Photograph the hunch. It only does it right before it charges you, so be ready to move straight after.',
    },
    {
      id: 'gw-steal', cat: 'Diet', q: 'Why does the shark turn up as soon as you spear a fish?', options: ['It feels the struggling fish\'s thrashing through its lateral line and smells the blood from far off', 'It follows the boat\'s engine', 'It recognises Mori'], answer: 0,
      text: 'A row of pressure-sensing pores runs down a shark\'s flank, the lateral line, and it picks up the low, uneven thrashing of a hurt fish a long way off. Blood in the water does the rest. Spearfishing near a whaler is like ringing a dinner bell.',
      evidence: [ph(SHARK_ID, 'circling'), ph(SHARK_ID, 'stealing')], hint: 'Spear a fish out by the drop-off and watch what comes. Photograph it circling, or making off with your catch.',
    },
    {
      id: 'gw-eye', cat: 'Anatomy', q: 'Why does the Glasseye Whaler\'s eye look pale and glassy?', options: ['A mirror layer behind the retina bounces light back through the eye, for sight in the dim blue', 'It is blind in that eye', 'It is a scar from fighting'], answer: 0,
      text: 'Behind the retina sharks have a tapetum, a layer of tiny mirror plates that sends incoming light back through the eye for a second chance at being seen. It makes their sight sharp in deep, dim water, and in this one it shows through as a pale silver gleam. When it bites, a third eyelid rolls up white over it to protect it.',
      evidence: [ph(SHARK_ID, 'patrolling')], hint: 'A sharp side-on photograph of one patrolling, close enough to see the eye.',
    },
    {
      id: 'gw-kelp', cat: 'Ecology', q: 'Why won\'t the shark follow Mori into thick kelp?', options: ['A big, fast swimmer needs open water to charge: in the kelp it can\'t turn or see far', 'Kelp is poisonous to sharks', 'It is afraid of the seals that live there'], answer: 0,
      text: 'The whaler hunts in open water where it can build up speed and come at its prey from below. A forest of kelp blades is a maze to a three-metre shark. Small fish, seals and divers hide there for exactly that reason.',
      evidence: [ph(SHARK_ID, 'veering'), ph(SHARK_ID, 'circling')], hint: 'Get into the thick kelp when it closes in, and photograph it giving up and veering away.',
    },
  ],
  research: {
    habitat: 'The drop-off and the open blue beyond Te Moana Rimurimu, cruising the reef\'s lip and the walls, now and then up into the reef when there is something worth the trip.',
    diet: 'Kingfish, snapper, rays, octopus, other sharks; and lately, whatever a diver has on the end of a spear.',
    anatomy: 'A classic whaler: torpedo body, long falcate pectorals, a tall first dorsal set behind them, a heterocercal tail with a long upper lobe. Bronze above, white below, with a pale tongue of white running forward on the flank. The snout is criss-crossed with healed scars. The eye gleams pale from a mirror layer behind the retina, and a third eyelid shuts white over it when it bites.',
    ecology: 'The top predator of the drop-off. It keeps the kingfish schools fast and nervous. The Corvex Seals mostly stay in the kelp shallows, where it will not follow them.',
    behaviour: 'Patrols slowly along the reef\'s edge. A speared fish draws it in: it circles, closes, then gives the hunch (back up, snout up, fins down) and charges. It bumps and grabs rather than bites a diver, and it is after the fish. A sharp knock on the snout makes it think again.',
    notes: [
      'That eye. It does not blink. It does not look AT you, it looks at your fish bag.',
      'Joshu says every whaler on the coast knows the sound of a speargun now. "Dinner bell, boy."',
      'It took my kingfish. Not me. My kingfish. I have never been so relieved and so annoyed at the same time.',
      'Into the kelp, Mori. Always into the kelp.',
    ],
    status: 'A few patrol the drop-off',
  },
};

// ==================================================================== Hāpuku
export const HAPUKU_SPECIES: Species = {
  id: HAPUKU_ID, name: 'Hāpuku', sci: 'Polyprion oxygeneios', group: 'Fish', sites: [], times: ALL,
  rarity: 4, danger: 0, size: 'Up to 1.5 m, 60 kg',
  blurb: 'The giant groper: a massive slate-grey fish with a head a third of its length, a jutting lower jaw and a mouth you could put your head in. This one has guarded the same cave at the foot of the outcrop out in the blue for longer than anyone can remember. It does not come out for people in a hurry.',
  behaviors: { hiding: 'Hiding in its cave', peering: 'Peering out', guarding: 'Guarding its cave', gaping: 'Gaping', swimming: 'Swimming' },
  facts: [
    {
      id: 'hp-patience', cat: 'Behaviour', q: 'How do you get a hāpuku to come out of its cave?', options: ['Wait: stay still nearby and it comes to the mouth to look at you', 'Shine a light in', 'Swim straight in after it'], answer: 0,
      text: 'Big, old groper are cautious and curious at once. Rush the cave and it backs into the dark. Settle down a little way off and keep still, and after a while it eases out to the mouth to see what you are.',
      evidence: [ph(HAPUKU_ID, 'guarding')], hint: 'Stay still near the cave at the foot of the outcrop in the blue. Patience. Then photograph it at the mouth.',
    },
    {
      id: 'hp-gulp', cat: 'Diet', q: 'How does a hāpuku catch its prey?', options: ['It throws its huge mouth open and the rush of water sucks the prey straight in', 'It chases it down over long distances', 'It stings it with its dorsal spines'], answer: 0,
      text: 'Groper are suction feeders: the mouth and gill covers flare open so fast that the water, and the fish or crayfish in it, rush in. The bigger the mouth, the bigger the gulp.',
      evidence: [ph(HAPUKU_ID, 'gaping')], hint: 'Watch it at its cave mouth for long enough and it gapes. Have the camera up.',
    },
    {
      id: 'hp-old', cat: 'Ecology', q: 'Why are really big hāpuku so rare now?', options: ['They grow slowly and live for decades, so a fished-out reef takes a lifetime to recover', 'They are eaten by seals', 'They only live in caves'], answer: 0,
      text: 'A hāpuku can live sixty years or more and takes many years to grow to breeding size. Each big one that is caught is decades of growing that can\'t be put back quickly. The old cave guardians are survivors.',
      evidence: [ph(HAPUKU_ID, 'peering'), ph(HAPUKU_ID, 'guarding')], hint: 'Photograph the old giant of the outcrop cave.',
    },
  ],
  research: {
    habitat: 'Deep rocky reefs and caves; this one holds the cave at the foot of the big outcrop out in the blue.',
    diet: 'Fish, crayfish, octopus: anything that fits in that mouth, inhaled at the cave mouth.',
    anatomy: 'A heavy grouper body, slate and bronze with faint dark mottling, a huge head with a jutting lower jaw and a bony ridge on each gill cover, eleven stout dorsal spines, a broad square tail.',
    ecology: 'The landlord of the outcrop. Small fish shelter in the cave\'s edges; the groper ignores them.',
    behaviour: 'Hangs in the cave mouth by day, sculling with its pectorals and pumping its gills. Shy of fast movement, curious about still things.',
    notes: ['It looked at me the way Koro looks at a bad knot.', 'I stayed still so long a cleanerfish had a go at my ear. Then it came out. Worth it.', 'Hāpuku is a taonga species. Joshu says the old ones should be left in their caves. Agreed.'],
    status: 'One old giant at the outcrop cave',
  },
};

// ==================================================================== Kingfish
export const KINGFISH_SPECIES: Species = {
  id: KING_ID, name: 'Kingfish', sci: 'Seriola lalandi', group: 'Fish', sites: [], times: ALL,
  rarity: 2, danger: 0, size: 'Around 1 m',
  blurb: 'Haku, the yellowtail kingfish: a streamlined torpedo of muscle, blue-green over silver with a brassy stripe from snout to tail and a bright yellow forked tail. Schools sweep through the reef\'s mid-water, curious and fast. Prized food, and the shark knows it too.',
  behaviors: { schooling: 'Schooling', darting: 'Darting away', cruising: 'Cruising' },
  facts: [
    {
      id: 'kf-school', cat: 'Behaviour', q: 'Why do kingfish swim in schools?', options: ['Many eyes and a confusing wall of flashing bodies make it hard for a predator to pick one out', 'To keep warm', 'They are all one family'], answer: 0,
      text: 'A predator needs to fix on one target. A school turning together, silver flanks flashing, makes that hard: the confusion effect. And more eyes see the shark sooner.',
      evidence: [ph(KING_ID, 'schooling')], hint: 'Photograph the school on the reef together, several in one frame.',
    },
    {
      id: 'kf-speed', cat: 'Adaptation', q: 'What makes a kingfish so fast?', options: ['A stiff, deeply forked tail on a narrow tail stock, driven by a torpedo of muscle', 'Its yellow fins', 'It is lighter than water'], answer: 0,
      text: 'Like a tuna, a kingfish is built for speed: a stiff, crescent-forked tail, a slim tail stock and a body that is nearly all swimming muscle. Spook a school and it is gone in a blink.',
      evidence: [ph(KING_ID, 'darting')], hint: 'Startle the school and catch it darting away.',
    },
  ],
  research: {
    habitat: 'The reef\'s mid-water and the edges of the drop-off, in schools.',
    diet: 'Small fish and squid, run down in fast group attacks.',
    anatomy: 'Torpedo body, blue-green back, silver-white flanks and belly, a brass stripe from snout to tail, yellow forked tail.',
    ecology: 'A mid-water hunter that is itself hunted by the Glasseye Whaler. Its schools are what the shark patrols for.',
    behaviour: 'Schools cruise in loose loops and come close to look at divers. A spear or a sudden move sends the whole school darting off together.',
    notes: ['Curious. They came to look at me, then looked at each other, then left. Rude.', 'Joshu wants one for the fire. "Kingfish, a bit of lemon, nothing else."'],
    status: 'Common on the reef',
  },
};

// ==================================================================== Blue cod
export const BLUECOD_SPECIES: Species = {
  id: COD_ID, name: 'Blue cod', sci: 'Parapercis colias', group: 'Fish', sites: [], times: ALL,
  rarity: 1, danger: 0, size: 'Around 45 cm',
  blurb: 'Rāwaru: a round, stocky bottom fish, blue-green mottled with bronze over a white belly, with big lips and its eyes set high on its head for watching above. It rests propped on its forward-set fins among the reef\'s boulders and comes over to look at anything new. Excellent eating.',
  behaviors: { resting: 'Resting on its fins', curious: 'Coming to look', swimming: 'Swimming' },
  facts: [
    {
      id: 'bc-curious', cat: 'Behaviour', q: 'What does a blue cod do when a diver stops nearby?', options: ['Swims over to look, and follows: blue cod are famously curious', 'Buries itself in the sand', 'Changes colour to match the rock'], answer: 0,
      text: 'Blue cod are bold and nosy. Stop on the reef and one usually comes over to have a look, hanging in front of your mask, sometimes nibbling at whatever you\'re holding.',
      evidence: [ph(COD_ID, 'curious')], hint: 'Keep still on the reef near the boulders. One will come to you.',
    },
    {
      id: 'bc-prop', cat: 'Anatomy', q: 'How does a blue cod sit still on the reef?', options: ['It props itself up on its pelvic fins, set far forward under its throat', 'It holds on with a sucker', 'It wedges its tail into a crack'], answer: 0,
      text: 'A blue cod\'s pelvic fins sit forward under its head, and it rests on them like a pair of elbows, eyes on top of its head watching the water above for food and danger.',
      evidence: [ph(COD_ID, 'resting')], hint: 'Photograph one resting on the reef floor.',
    },
  ],
  research: {
    habitat: 'Rocky reef and the sand at its edges, by the boulders.',
    diet: 'Crabs, small fish, worms, anything that falls to the floor.',
    anatomy: 'Cylindrical body, blue-green above with bronze mottling (the big males bluest), white belly, thick lips, high eyes, a long low dorsal fin and pelvic fins set forward as props.',
    ecology: 'A bottom fish of the reef, eaten by bigger fish, seals and the shark. Blue cod start life female; the biggest switch to male.',
    behaviour: 'Rests on the reef, darts to new perches, and comes to investigate divers.',
    notes: ['This one followed me for ten metres. I think it wanted my camera.', 'Big lips. Big opinions.'],
    status: 'Common around the reef\'s boulders',
  },
};

// ==================================================================== Ocean sunfish
export const SUNFISH_SPECIES: Species = {
  id: SUN_ID, name: 'Ocean sunfish', sci: 'Mola mola', group: 'Fish', sites: [], times: ALL,
  rarity: 5, danger: 0, size: 'About 2 m long, 2.5 m fin to fin',
  blurb: 'Kōtiri: a fish that looks like the front half of a much bigger fish. A huge silver-grey disc with a tall fin above and below, a little beak of a mouth, and at the back, instead of a tail, the clavus, a scalloped rudder. It drifts in the blue, sculling slowly with its fins, while small fish pick it clean.',
  behaviors: { drifting: 'Drifting', cleaned: 'Being cleaned', turning: 'Turning' },
  facts: [
    {
      id: 'sf-clean', cat: 'Ecology', q: 'Why do small fish swarm all over the sunfish?', options: ['They are cleanerfish eating the parasites off its skin: the sunfish carries dozens of kinds', 'They are attacking it', 'They are its babies'], answer: 0,
      text: 'An ocean sunfish carries more parasites than almost any other fish, dozens of species of them. It drifts near reefs and lets cleanerfish pick them off: the cleaners get a meal and the sunfish gets cleaned. A partnership.',
      evidence: [ph(SUN_ID, 'cleaned'), ph(CLEAN_ID, 'cleaning')], hint: 'Find the sunfish out in the blue and photograph the cleanerfish at work on it.',
    },
    {
      id: 'sf-fins', cat: 'Anatomy', q: 'A sunfish has no tail. How does it swim?', options: ['It beats its tall dorsal and anal fins together from side to side, and steers with the clavus', 'It doesn\'t: it only drifts', 'It jets water out of its gills'], answer: 0,
      text: 'The sunfish lost its tail as it evolved. What looks like a tail is the clavus, a rudder made from the back edges of the dorsal and anal fins. It swims by flapping the two tall fins together, like a bird flapping on its side.',
      evidence: [ph(SUN_ID, 'drifting')], hint: 'A clear side-on photograph of the whole fish, both fins in frame.',
    },
  ],
  research: {
    habitat: 'The open blue past the drop-off, drifting in from the deep ocean.',
    diet: 'Jellyfish and salps, mostly. A lot of them: it is a big animal living on a watery diet.',
    anatomy: 'A tall, flat disc of a body with thick, leathery, blotched skin, tall dorsal and anal fins, the scalloped clavus where a tail should be, small round pectorals and a beak of fused teeth.',
    ecology: 'A drifting island for parasites, and for the cleanerfish that eat them.',
    behaviour: 'Drifts and sculls, turns slowly, sometimes lies flat at the surface to warm up after a deep dive.',
    notes: ['It looked at me with total calm. Like a very large, very confused moon.', 'Jenna: "It\'s a head. It\'s just a swimming head." She is not wrong.'],
    status: 'A rare visitor to the blue',
  },
};

// ==================================================================== Crimson cleanerfish
export const CLEANER_SPECIES: Species = {
  id: CLEAN_ID, name: 'Crimson cleanerfish', sci: 'Suezichthys aylingi', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
  rarity: 2, danger: 0, size: '10 cm',
  blurb: 'A slim little wrasse, pink-white with a crimson stripe down its side, that makes its living picking parasites off bigger fish. Out in the blue, a few of them follow the sunfish around.',
  behaviors: { cleaning: 'Cleaning', swimming: 'Swimming' },
  facts: [
    {
      id: 'cf-job', cat: 'Diet', q: 'What does the cleanerfish eat?', options: ['Parasites, dead skin and mucus picked off bigger fish', 'Kelp', 'The sunfish\'s eggs'], answer: 0,
      text: 'Cleaners advertise with bright stripes and a dancing swim; big fish come to them and hold still. It is one of the sea\'s great deals: food for one, a scrub for the other.',
      evidence: [ph(CLEAN_ID, 'cleaning')], hint: 'Photograph one pecking at the sunfish.',
    },
  ],
  research: {
    habitat: 'Reefs and, out here, the sunfish.', diet: 'Parasites off other fish.', anatomy: 'A slim wrasse, pink-white with a crimson stripe.',
    ecology: 'A partner of the sunfish and the reef\'s big fish.', behaviour: 'Darts in, pecks, darts out.',
    notes: ['Tiny. Fearless. Picking at a fish a thousand times its size.'], status: 'Common',
  },
};

// ==================================================================== Eagle ray
export const RAY_SPECIES: Species = {
  id: RAY_ID, name: 'Eagle ray', sci: 'Myliobatis tenuicaudatus', group: 'Fish', sites: [], times: ALL,
  rarity: 3, danger: 1, size: '1.5 m across',
  blurb: 'Whai repo: a ray that flies. Its pectoral fins are broad pointed wings that it beats slowly over the sand; the head juts out ahead like an eagle\'s, the eyes on its sides; a long whip of a tail trails behind with a venomous spine at its root. Olive-grey with pale blue spots and wavy bars.',
  behaviors: { gliding: 'Gliding', flying: 'Flying (wingbeats)', feeding: 'Digging for shellfish', turning: 'Banking' },
  facts: [
    {
      id: 'er-dig', cat: 'Diet', q: 'What is the eagle ray doing with its nose in the sand?', options: ['Blasting the sand away to dig out clams and crabs, then crushing them with plate-like teeth', 'Sleeping', 'Laying eggs'], answer: 0,
      text: 'It flaps its wings and squirts water from its mouth to blow pits in the sand, then grinds up the shellfish it uncovers with flat crushing tooth plates. Eagle-ray feeding pits pock the sand channels.',
      evidence: [ph(RAY_ID, 'feeding')], hint: 'Watch the ray over the sand channel in the reef until it stops to dig.',
    },
    {
      id: 'er-fly', cat: 'Anatomy', q: 'What are an eagle ray\'s "wings"?', options: ['Its pectoral fins, grown huge and fused to its head', 'Flaps of skin from its belly', 'Its gills'], answer: 0,
      text: 'A ray is a flattened shark. Its pectoral fins have grown out into a disc fused to the head, and the eagle rays beat them like wings, flying through the water rather than swimming.',
      evidence: [ph(RAY_ID, 'flying'), ph(RAY_ID, 'gliding')], hint: 'Photograph it mid-wingbeat over the sand.',
    },
  ],
  research: {
    habitat: 'Sand flats and sand channels between reefs; here the channel through the boulder reef.',
    diet: 'Clams, crabs, worms: dug out of the sand and crushed.',
    anatomy: 'A wide diamond disc of pectoral wings, a jutting head with eyes and spiracles on its sides, a whip tail with a small dorsal fin and a venomous spine at its root.',
    ecology: 'Digs the sand over as it feeds, and the snapper and wrasse follow it for the scraps it stirs up. The Glasseye Whaler hunts it in the open.',
    behaviour: 'Flies slow loops over the sand, glides, and stops to dig.',
    notes: ['It flew past me. Flew. Underwater. I made a noise into my regulator.', 'Do not step on one. Joshu was very clear about that.'],
    status: 'One works the sand channel on the reef',
  },
};

// ==================================================================== the Corvex Seal underwater
/** the seal's behaviours and facts in the water, merged into its shore entry by ../../species.ts */
export const SEAL_SWIM: { behaviors: Record<string, string>; facts: Fact[] } = {
  behaviors: { swimming: 'Swimming', barrelroll: 'Barrel roll', bubbles: 'Blowing bubbles', mimicking: 'Copying you', stealing: 'Stealing your fish' },
  facts: [
    {
      id: 'corvex-water', cat: 'Adaptation', q: 'On land the Corvex Seal flops and gallops. How does it move underwater?', options: ['It flies on its long fore-flippers like wings, steering with its hind flippers: graceful, fast and acrobatic', 'It walks along the bottom', 'It wriggles like an eel'], answer: 0,
      text: 'Out of the water it is all heaving bulk. In it, the long fore-flippers become wings, the hind flippers a rudder, and the whole animal rolls, loops and corkscrews. The barrel rolls are partly play and partly a way to scan every direction at once.',
      evidence: [ph(SEAL_ID, 'barrelroll')], hint: 'Dive in the kelp shallows where the pod plays and catch one mid-roll.',
    },
    {
      id: 'corvex-bubble', cat: 'Behaviour', q: 'Why does a Corvex Seal stop in front of you and blow bubbles?', options: ['It is checking you out: a curious, playful seal\'s greeting (and a test of how you react)', 'It is running out of air', 'It is trying to scare you off'], answer: 0,
      text: 'Young seals blow streams of bubbles at each other in play, and at anything new. Mori counts as new. It usually means "play with me".',
      evidence: [ph(SEAL_ID, 'bubbles')], hint: 'Hang still in the kelp shallows. A curious seal will come right up to you.',
    },
    {
      id: 'corvex-mimic', cat: 'Behaviour', q: 'Why does the seal copy everything Mori does?', options: ['Play and learning: seals learn by copying, and a diver is a fascinating new playmate', 'It is mocking him', 'It thinks he is food'], answer: 0,
      text: 'Swim up and it swims up; stop and it hangs upright, head cocked, waiting for the next move. Copying is how young seals learn to hunt, and it is how they play.',
      evidence: [ph(SEAL_ID, 'mimicking'), ph(SEAL_ID, 'stealing')], hint: 'Swim about near a curious seal, then stop. Photograph it copying you. And mind your fish bag.',
    },
  ],
};

export const DIVE_SPECIES: Species[] = [GLASSEYE_SPECIES, HAPUKU_SPECIES, KINGFISH_SPECIES, BLUECOD_SPECIES, SUNFISH_SPECIES, CLEANER_SPECIES, RAY_SPECIES];

FUN[SHARK_ID] = 'Whaler sharks are named after the whalers who saw them following the ships, waiting for scraps from the hunt. This one has simply swapped whalers for divers.';
FUN[HAPUKU_ID] = 'A hāpuku can live more than sixty years. The giant at the outcrop cave may have been guarding it since before Koro was born.';
FUN[KING_ID] = 'Kingfish are so curious that a school will swing past a diver for a second look, and sometimes a third.';
FUN[COD_ID] = 'Every blue cod starts life as a female. The biggest ones change into males, and turn bluer as they do.';
FUN[SUN_ID] = 'A sunfish lays more eggs than any other animal with a backbone: up to 300 million at once.';
FUN[CLEAN_ID] = 'Cleaner wrasse can recognise their regular "clients", and are on better behaviour when another fish is watching.';
FUN[RAY_ID] = 'Eagle rays sometimes leap clean out of the water, landing with a slap that carries a kilometre.';
WEB.push(
  [SHARK_ID, 'eats', KING_ID, 'patrols the reef for the schools'],
  [SHARK_ID, 'eats', RAY_ID, 'takes them over the open sand'],
  [SHARK_ID, 'robs', SEAL_ID, 'steals what the seals and divers catch'],
  [SEAL_ID, 'eats', COD_ID, 'snatched off the reef'],
  [HAPUKU_ID, 'eats', COD_ID, 'gulped at the cave mouth'],
  [CLEAN_ID, 'partner', SUN_ID, 'picks off its parasites'],
  [RAY_ID, 'eats', 'pipi', 'dug out of the sand'],
);

// ==================================================================== the catch, as food
export const KING_ITEM = 'kingfish_fillet';
export const COD_ITEM = 'blue_cod';
if (!ITEMS[KING_ITEM]) {
  defineItem({ id: KING_ITEM, name: 'Kingfish fillet', kind: 'food', stack: 4, weight: 0.6, eat: 'energy', energy: 28, where: 'Speared on Te Moana Rimurimu\'s reef',
    desc: 'A thick fillet off a speared kingfish, the blue-green skin still on, the flesh pink and firm. Joshu\'s favourite: on the fire, a squeeze of something sour, nothing else.' });
  defineItem({ id: COD_ITEM, name: 'Blue cod', kind: 'food', stack: 3, weight: 0.7, eat: 'energy', energy: 24, where: 'Speared among the reef\'s boulders',
    desc: 'A whole blue cod off the reef, blue-green and bronze, big-lipped. White, sweet, flaky flesh: the best fish-and-chips fish there is, Joshu says.' });
}
defineFood(KING_ITEM, { energy: 28 });
defineFood(COD_ITEM, { energy: 24 });
// the cooking loop: both are fish (grilled fish, the fish stew); chopped on the board first
setTimeout(() => {
  import('../../v11/cooking').then(m => {
    m.INGREDIENTS[KING_ITEM] ??= { tags: ['fish'], chop: true, raw: '#e8a0a0', cooked: '#f0d8b8' };
    m.INGREDIENTS[COD_ITEM] ??= { tags: ['fish'], chop: true, raw: '#e0e8ec', cooked: '#f4ecd8' };
  }).catch(e => console.warn('[dive] cooking', e));
}, 0);

// item art: the blue cod whole, the kingfish as a fillet (2 x 1 cells, 48 x 24 at 1x)
const FP = { w: 2, h: 1 };
function itemCanvas(id: string) { return (itemArtBuffer(id) ?? new PixelBuffer(48, 24)).toCanvas(1); }
function codArt(): PixelBuffer {
  const out = new PixelBuffer(48, 24);
  const f = diveFishStill(COD_ID, 44);
  out.blit(f, Math.round((48 - f.w) / 2), Math.round((24 - f.h) / 2), false, false);
  dropShadow(out);
  return out;
}
/** the kingfish fillet: a thick tapered slab, the blue-green skin and its brass line along the top, pink
 *  flesh in muscle flakes (the chevrons of the myomeres), a dark bloodline, a wet glint */
function filletArt(): PixelBuffer {
  const b = new PixelBuffer(48, 24);
  const FLESH = ['#8a3e46', '#b25a5e', '#d27c78', '#e8a09a', '#f6c4ba', '#ffe4dc'].map(c => hex(c));
  const SKIN = ['#0a2228', '#123640', '#1c4c58', '#2a6474'].map(c => hex(c));
  const INK = hex('#2a0c12');
  const top = (x: number) => 7 - Math.sin(((x - 3) / 41) * Math.PI) * 4 + (x > 38 ? (x - 38) * 0.5 : 0);
  const bot = (x: number) => 18 + Math.sin(((x - 3) / 41) * Math.PI) * 2.5 - (x > 36 ? (x - 36) * 0.9 : 0) - (x < 8 ? (8 - x) * 0.6 : 0);
  for (let x = 3; x <= 44; x++) for (let y = 0; y < 24; y++) {
    const t0 = top(x), b0 = bot(x);
    if (y + 0.5 < t0 || y + 0.5 > b0) continue;
    const v = (y + 0.5 - t0) / Math.max(1, b0 - t0);
    let c: number;
    if (y + 0.5 - t0 < 1.6) c = SKIN[y + 0.5 - t0 < 0.8 ? 1 : 2];
    else if (Math.abs(y + 0.5 - t0 - 2) < 0.5 && x > 6 && x < 40) c = hex('#c8a438');
    else {
      // the myomeres: flaky chevrons pointing toward the head end, the bloodline along the middle
      const k = ((x * 0.36 + Math.abs(v - 0.45) * 5) % 1);
      let t = 3.2 - v * 1.4 + (k < 0.16 ? -1.2 : k < 0.3 ? 0.6 : 0);
      if (Math.abs(v - 0.42) < 0.07 && x > 8 && x < 38) t = 1;
      if (x < 6 || x > 41) t -= 0.7;
      c = FLESH[Math.max(0, Math.min(5, Math.round(t)))];
    }
    b.data[y * 48 + x] = c;
  }
  // the wet glint
  for (const [x, y] of [[14, 9], [15, 9], [16, 9], [27, 9], [28, 9]] as [number, number][]) if (b.data[y * 48 + x] >>> 24) b.data[y * 48 + x] = hex('#fff6f2');
  // outline
  const src = b.data.slice();
  for (let y = 0; y < 24; y++) for (let x = 0; x < 48; x++) {
    if (src[y * 48 + x] >>> 24) continue;
    const n = (x > 0 && src[y * 48 + x - 1] >>> 24) || (x < 47 && src[y * 48 + x + 1] >>> 24) || (y > 0 && src[(y - 1) * 48 + x] >>> 24) || (y < 23 && src[(y + 1) * 48 + x] >>> 24);
    if (n) b.data[y * 48 + x] = INK;
  }
  dropShadow(b);
  return b;
}
/** the item art's two-step drop shadow, down-right under the object */
function dropShadow(b: PixelBuffer) {
  const src = b.data.slice(), W = b.w, H = b.h;
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    if (src[y * W + x] >>> 24) continue;
    const a = x > 0 && y > 0 && src[(y - 1) * W + x - 1] >>> 24 === 255, c = x > 1 && y > 1 && src[(y - 2) * W + x - 2] >>> 24 === 255;
    if (a) b.data[y * W + x] = rgba(12, 6, 18, 110); else if (c) b.data[y * W + x] = rgba(12, 6, 18, 50);
  }
}
registerItemArtBuffer(COD_ITEM, codArt);
registerItemArt(COD_ITEM, () => itemCanvas(COD_ITEM), FP);
registerItemArtBuffer(KING_ITEM, filletArt);
registerItemArt(KING_ITEM, () => itemCanvas(KING_ITEM), FP);

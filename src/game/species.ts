// The Zealandia Field Guide: species, observable behaviours, deducible facts and field clues.

import type { TimeOfDay } from '../world/timeofday';

export type SiteId = 'fernwood' | 'canopy' | 'falls' | 'mangrove' | 'coast';
export type Group = 'Serpent' | 'Bird' | 'Mammal' | 'Reptile' | 'Amphibian' | 'Fish' | 'Crustacean' | 'Mollusc' | 'Insect';

export type Evidence =
  | { kind: 'photo'; species: string; behavior: string }
  | { kind: 'video'; species: string; behavior: string }
  | { kind: 'clue'; clue: string };

export interface Fact {
  id: string;
  cat: 'Diet' | 'Behaviour' | 'Adaptation' | 'Ecology' | 'Anatomy' | 'Activity';
  q: string;
  options: string[];
  answer: number;
  text: string;
  evidence: Evidence[];
  hint: string;
}

export interface Species {
  id: string;
  name: string;
  sci: string;
  group: Group;
  sites: SiteId[];
  times: TimeOfDay[];
  rarity: number;
  danger: number;
  size: string;
  blurb: string;
  behaviors: Record<string, string>;
  facts: Fact[];
}

export interface ClueDef {
  id: string;
  name: string;
  desc: string;
  site: SiteId;
  icon: string;
}

const ph = (species: string, behavior: string): Evidence => ({ kind: 'photo', species, behavior });
const vid = (species: string, behavior: string): Evidence => ({ kind: 'video', species, behavior });
const cl = (clue: string): Evidence => ({ kind: 'clue', clue });

export const SPECIES: Species[] = [
  // ------------------------------------------------------------ V4: THE OPEN OCEAN (seen from the Kittiwake)
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
  // ------------------------------------------------------------ V4: THE ISLAND SHORE
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
  // ------------------------------------------------------------ SERPENTS
  {
    id: 'strider', name: 'Strider Serpent', sci: 'Pedophis ambulans', group: 'Serpent', sites: ['fernwood', 'falls'], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '1.2 m', blurb: 'A four-legged forest serpent that ambles over leaf litter like a lizard that forgot to stop growing. Zealandia’s most common snake, and surprisingly curious.',
    behaviors: { foraging: 'Foraging', digging: 'Digging', basking: 'Basking', scenting: 'Tongue-scenting' },
    facts: [
      { id: 'strider-diet', cat: 'Diet', q: 'What does the Strider Serpent dig for?', options: ['Fallen fruit', 'Beetle grubs', 'Bird eggs'], answer: 1, text: 'Digs beetle grubs out of rotten wood and soft soil with its clawed forelegs.', evidence: [ph('strider', 'digging'), cl('grub-shells')], hint: 'Photograph one digging, and look for what it leaves behind.' },
      { id: 'strider-legs', cat: 'Adaptation', q: 'Why would a serpent keep its legs?', options: ['To swim faster', 'To climb cliffs', 'To walk quietly over leaf litter'], answer: 2, text: 'Its legs lift the body off crunchy leaf litter, letting it stalk grubs almost silently.', evidence: [ph('strider', 'foraging')], hint: 'Photograph one walking across the forest floor.' },
      { id: 'strider-bask', cat: 'Behaviour', q: 'Why does it lie in sunbeams?', options: ['To warm its body', 'To hide from hawks', 'To shed its skin'], answer: 0, text: 'Like all reptiles it is cold-blooded; it basks in light shafts each morning to warm up.', evidence: [ph('strider', 'basking')], hint: 'Catch one resting in a shaft of sunlight.' },
    ],
  },
  {
    id: 'sprinter', name: 'Sprint Viper', sci: 'Dromophis rapax', group: 'Serpent', sites: ['fernwood', 'falls'], times: ['dusk', 'night'],
    rarity: 3, danger: 1, size: '1.8 m', blurb: 'A bipedal viper that runs on two powerful hind legs, tail held out like a counterweight. It hunts by running prey down at dusk.',
    behaviors: { running: 'Sprinting', hunting: 'Hunting', threat: 'Threat display', resting: 'Resting' },
    facts: [
      { id: 'sprinter-run', cat: 'Adaptation', q: 'How does the Sprint Viper chase prey?', options: ['It glides from trees', 'It runs upright on two legs', 'It burrows underneath'], answer: 1, text: 'It sprints upright on two legs at over 30 km/h, balancing with its stiff tail.', evidence: [vid('sprinter', 'running')], hint: 'Record a video of one running.' },
      { id: 'sprinter-diet', cat: 'Diet', q: 'What does the Sprint Viper hunt?', options: ['Small mammals', 'Fish', 'Nectar'], answer: 0, text: 'It runs down small mammals such as Tunnel Delvers and young Shieldbacks.', evidence: [ph('sprinter', 'hunting'), cl('fur-tuft')], hint: 'Photograph it hunting, and look for signs of its prey.' },
      { id: 'sprinter-time', cat: 'Activity', q: 'When is the Sprint Viper active?', options: ['Midday', 'Dusk and night', 'Only in rain'], answer: 1, text: 'Crepuscular and nocturnal: its heat-sensing pits find warm prey in the dark.', evidence: [ph('sprinter', 'threat')], hint: 'Its threat display is a sight you only see after sundown.' },
    ],
  },
  {
    id: 'skyribbon', name: 'Skyribbon Glider', sci: 'Volophis iridis', group: 'Serpent', sites: ['canopy'], times: ['dawn', 'day'],
    rarity: 2, danger: 0, size: '1.5 m', blurb: 'An iridescent tree snake that flings itself between canopy giants, flattening its ribs into a living ribbon.',
    behaviors: { gliding: 'Gliding', coiled: 'Coiled on a branch', hunting: 'Snatching insects' },
    facts: [
      { id: 'skyribbon-glide', cat: 'Adaptation', q: 'How does the Skyribbon glide?', options: ['It has feathered scales', 'It flattens its ribs and undulates', 'It inflates air sacs'], answer: 1, text: 'It spreads its ribs to flatten into a ribbon, undulating mid-air to steer between trees.', evidence: [vid('skyribbon', 'gliding')], hint: 'Record a full glide on video.' },
      { id: 'skyribbon-diet', cat: 'Diet', q: 'What does the Skyribbon eat?', options: ['Canopy insects', 'Seeds', 'Eggs of ground birds'], answer: 0, text: 'It snaps cicadas and moths out of the air from its branch perch.', evidence: [ph('skyribbon', 'hunting')], hint: 'Photograph one snatching prey from a branch.' },
      { id: 'skyribbon-pred', cat: 'Ecology', q: 'Which predator hunts Skyribbons in the air?', options: ['Ironjaw Crocodile', 'Gale Hawk', 'Quillhog'], answer: 1, text: 'Gale Hawks ambush gliding Skyribbons mid-flight; gliding is a gamble.', evidence: [ph('galehawk', 'carrying'), cl('shed-ribbon')], hint: 'Something in the sky carries Skyribbons away.' },
    ],
  },
  {
    id: 'lurevip', name: 'Lantern Lure-Viper', sci: 'Photophis lychnurus', group: 'Serpent', sites: ['canopy'], times: ['dusk', 'night'],
    rarity: 3, danger: 1, size: '1.3 m', blurb: 'A violet pit viper whose tail tip glows like a lantern. At night it dangles the light to lure curious animals within striking range.',
    behaviors: { luring: 'Tail-luring', striking: 'Striking', coiled: 'Coiled' },
    facts: [
      { id: 'lurevip-lure', cat: 'Adaptation', q: 'What is the glowing tail for?', options: ['Communicating with mates', 'Luring prey close', 'Scaring off hawks'], answer: 1, text: 'Bioluminescent bacteria in the tail tip glow; waving it lures moths and gliders close.', evidence: [ph('lurevip', 'luring')], hint: 'Photograph the glow being used at night.' },
      { id: 'lurevip-diet', cat: 'Diet', q: 'Which animal falls for the lure most often?', options: ['Sail Possum', 'Crag Auk', 'Ironjaw'], answer: 0, text: 'Nectar-hunting Sail Possums mistake the glow for luminous flowers.', evidence: [ph('lurevip', 'striking'), ph('sailglider', 'feeding')], hint: 'Who visits glowing things for food?' },
      { id: 'lurevip-time', cat: 'Activity', q: 'When does it hunt?', options: ['Night', 'Morning', 'Midday'], answer: 0, text: 'Strictly nocturnal: the lure is useless in daylight.', evidence: [ph('lurevip', 'coiled')], hint: 'Find where it rests.' },
    ],
  },
  {
    id: 'titan', name: 'Titan Constrictor', sci: 'Gigantophis rex', group: 'Serpent', sites: ['mangrove'], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 5, danger: 3, size: '16 m', blurb: 'The apex predator of Zealandia. A colossal constrictor whose mottled coils vanish among mangrove roots. Do not let it see you.',
    behaviors: { ambush: 'Ambushing', digesting: 'Digesting', swimming: 'Swimming', hunting: 'Hunting' },
    facts: [
      { id: 'titan-size', cat: 'Anatomy', q: 'How long can a Titan Constrictor grow?', options: ['About 3 m', 'About 8 m', 'Over 15 m'], answer: 2, text: 'Shed skins exceed 15 metres — the largest snake ever recorded.', evidence: [cl('giant-skin'), ph('titan', 'swimming')], hint: 'The shed skin at the falls tells half the story.' },
      { id: 'titan-diet', cat: 'Diet', q: 'What can a Titan swallow?', options: ['Only insects', 'Adult crocodiles', 'Fruit'], answer: 1, text: 'It overpowers and swallows adult Ironjaw crocodiles, then rests for weeks.', evidence: [ph('titan', 'digesting'), cl('croc-scute')], hint: 'Look for a huge bulge, and what is left of its meals.' },
      { id: 'titan-hunt', cat: 'Behaviour', q: 'How does the Titan hunt?', options: ['Chases prey on land', 'Lies in ambush in water', 'Hunts in packs'], answer: 1, text: 'It lies submerged among roots for days, striking whatever wades close.', evidence: [ph('titan', 'ambush')], hint: 'Photograph it lying in wait.' },
    ],
  },
  {
    id: 'leviathan', name: 'Finned Leviathan', sci: 'Thalassophis pinnatus', group: 'Serpent', sites: ['coast'], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 5, danger: 2, size: '25 m', blurb: 'An enormous marine serpent with a rippling dorsal fin and feathery crimson gill fronds. Sailors’ legends were true.',
    behaviors: { surfacing: 'Surfacing', breathing: 'Gill-breathing', hunting: 'Hunting a shoal' },
    facts: [
      { id: 'leviathan-gills', cat: 'Anatomy', q: 'How does the Leviathan breathe underwater?', options: ['It holds its breath', 'External gill fronds', 'It never dives'], answer: 1, text: 'Feathery external gill fronds behind the head pull oxygen from the water, like a giant axolotl.', evidence: [ph('leviathan', 'breathing')], hint: 'Get close enough underwater to see behind its head.' },
      { id: 'leviathan-diet', cat: 'Diet', q: 'What does it hunt?', options: ['Shoals of glassfin', 'Seabirds', 'Kelp'], answer: 0, text: 'It herds and gulps entire shoals of glassfin fish.', evidence: [ph('leviathan', 'hunting')], hint: 'Watch it near the fish shoals.' },
      { id: 'leviathan-surface', cat: 'Behaviour', q: 'Why does it surface?', options: ['To bask and gulp air for buoyancy', 'To lay eggs', 'To hunt birds'], answer: 0, text: 'It surfaces to bask and gulp air, adjusting its buoyancy for deep dives.', evidence: [ph('leviathan', 'surfacing')], hint: 'Photograph it breaking the surface.' },
    ],
  },
  {
    id: 'mudribbon', name: 'Mudribbon', sci: 'Limnophis fasciatus', group: 'Serpent', sites: ['mangrove'], times: ['day', 'dusk', 'night'],
    rarity: 2, danger: 0, size: '1.7 m', blurb: 'A banded water snake of the mangrove channels, with nostrils set high on its snout like a crocodile.',
    behaviors: { swimming: 'Swimming', fishing: 'Fishing' },
    facts: [
      { id: 'mudribbon-diet', cat: 'Diet', q: 'What does the Mudribbon eat?', options: ['Fish and mudskippers', 'Leaves', 'Birds'], answer: 0, text: 'It ambushes mudskippers and small fish in the shallows.', evidence: [ph('mudribbon', 'fishing')], hint: 'Photograph it catching a meal.' },
      { id: 'mudribbon-nose', cat: 'Adaptation', q: 'Why are its nostrils on top of its snout?', options: ['To smell flowers', 'To breathe while almost submerged', 'To hear better'], answer: 1, text: 'High nostrils let it breathe while its body stays hidden under murky water.', evidence: [ph('mudribbon', 'swimming')], hint: 'Watch how it swims.' },
      { id: 'mudribbon-pred', cat: 'Ecology', q: 'Who is its main predator?', options: ['Serpent Stork', 'Sail Possum', 'Delver'], answer: 0, text: 'Serpent Storks stalk the channels and spear Mudribbons.', evidence: [ph('snakestork', 'catching')], hint: 'Something tall hunts the shallows.' },
    ],
  },
  {
    id: 'cragviper', name: 'Crag Viper', sci: 'Petrophis oophagus', group: 'Serpent', sites: ['falls'], times: ['day', 'dusk'],
    rarity: 3, danger: 1, size: '1.4 m', blurb: 'A granite-grey viper with keeled belly scales that let it climb sheer rock. It is why cliff birds nest where they do.',
    behaviors: { climbing: 'Climbing rock', raiding: 'Raiding a nest', basking: 'Basking' },
    facts: [
      { id: 'cragviper-diet', cat: 'Diet', q: 'What does the Crag Viper raid?', options: ['Bee hives', 'Bird nests', 'Crab burrows'], answer: 1, text: 'It specialises in eggs and chicks of cliff-nesting birds.', evidence: [ph('cragviper', 'raiding'), cl('eggshell')], hint: 'Watch the nests, and check below them.' },
      { id: 'cragviper-climb', cat: 'Adaptation', q: 'How does it climb sheer rock?', options: ['Sticky toe pads', 'Keeled belly scales', 'It jumps'], answer: 1, text: 'Ridged belly scales catch tiny cracks, letting it climb near-vertical cliffs.', evidence: [ph('cragviper', 'climbing')], hint: 'Photograph it on the cliff face.' },
      { id: 'cragviper-eco', cat: 'Ecology', q: 'Why do Crag Auks nest on the highest, sheerest ledges?', options: ['For the view', 'To escape Crag Vipers', 'To be near fish'], answer: 1, text: 'Constant raids push auks onto the sheerest ledges — an evolutionary arms race.', evidence: [ph('cragauk', 'nesting'), ph('cragviper', 'climbing')], hint: 'Compare where the auks nest with where vipers climb.' },
    ],
  },
  // ------------------------------------------------------------ BIRDS
  {
    id: 'galehawk', name: 'Gale Hawk', sci: 'Anemoaetus ophiophagus', group: 'Bird', sites: ['canopy', 'falls'], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '2.1 m wingspan', blurb: 'A powerful raptor built for speed, evolved in a world where the prey fly back. It snatches gliding serpents out of the air.',
    behaviors: { soaring: 'Soaring', diving: 'Stooping dive', carrying: 'Carrying prey', perched: 'Perched' },
    facts: [
      { id: 'galehawk-diet', cat: 'Diet', q: 'What does the Gale Hawk carry off?', options: ['Fish', 'Serpents', 'Fruit'], answer: 1, text: 'Serpents make up most of its diet, especially gliding Skyribbons.', evidence: [ph('galehawk', 'carrying')], hint: 'Photograph it with prey in its talons.' },
      { id: 'galehawk-dive', cat: 'Adaptation', q: 'How does it catch gliding prey?', options: ['A steep folded-wing dive', 'It waits on the ground', 'It chases on foot'], answer: 0, text: 'It folds its wings and stoops at over 200 km/h onto gliding snakes.', evidence: [vid('galehawk', 'diving')], hint: 'Record a dive on video.' },
      { id: 'galehawk-perch', cat: 'Behaviour', q: 'Where does it watch for prey?', options: ['Emergent treetops', 'Burrows', 'Under waterfalls'], answer: 0, text: 'It perches on emergent treetops scanning the canopy for glides.', evidence: [ph('galehawk', 'perched')], hint: 'Find its lookout.' },
    ],
  },
  {
    id: 'cragauk', name: 'Crag Auk', sci: 'Rupialca aurigula', group: 'Bird', sites: ['falls'], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '45 cm', blurb: 'A stocky black-and-white seabird with a golden throat, nesting on ledges so sheer only wings can reach them.',
    behaviors: { nesting: 'Nesting', diving: 'Fishing dive', display: 'Courtship display', flying: 'Flying' },
    facts: [
      { id: 'cragauk-nest', cat: 'Behaviour', q: 'Where do Crag Auks nest?', options: ['In burrows', 'On sheer cliff ledges', 'In reeds'], answer: 1, text: 'Colonies crowd the sheerest cliff ledges above the falls and sea.', evidence: [ph('cragauk', 'nesting')], hint: 'Photograph one on its ledge.' },
      { id: 'cragauk-diet', cat: 'Diet', q: 'What do Crag Auks eat?', options: ['Small fish', 'Snakes', 'Berries'], answer: 0, text: 'They dive from the air to catch small fish in the plunge pool and surf.', evidence: [ph('cragauk', 'diving')], hint: 'Watch them over the water.' },
      { id: 'cragauk-display', cat: 'Behaviour', q: 'What is the golden throat for?', options: ['Camouflage', 'Courtship display', 'Keeping warm'], answer: 1, text: 'Pairs flare their golden throats in noisy courtship displays.', evidence: [ph('cragauk', 'display')], hint: 'Catch a display.' },
    ],
  },
  {
    id: 'torrentdipper', name: 'Torrent Dipper', sci: 'Cinclops cataractae', group: 'Bird', sites: ['falls'], times: ['dawn', 'day'],
    rarity: 3, danger: 0, size: '20 cm', blurb: 'A slate-blue songbird that walks underwater along the stream bed and nests behind the waterfall curtain itself.',
    behaviors: { diving: 'Walking underwater', bobbing: 'Bobbing', flying: 'Flying' },
    facts: [
      { id: 'dipper-nest', cat: 'Behaviour', q: 'Where does the Torrent Dipper nest?', options: ['Behind the waterfall', 'In the canopy', 'On the beach'], answer: 0, text: 'It builds mossy nests behind the waterfall curtain, where no snake can reach.', evidence: [cl('falls-nest'), ph('torrentdipper', 'flying')], hint: 'Something is hidden behind the falls.' },
      { id: 'dipper-dive', cat: 'Adaptation', q: 'How does it feed?', options: ['Walks underwater', 'Catches insects in flight', 'Eats seeds'], answer: 0, text: 'Dense bones and oiled feathers let it walk along the stream bed hunting larvae.', evidence: [ph('torrentdipper', 'diving')], hint: 'Photograph it going under.' },
      { id: 'dipper-bob', cat: 'Behaviour', q: 'Why does it bob constantly?', options: ['To signal over the roar of water', 'It is cold', 'To dry off'], answer: 0, text: 'Its bobbing and white eyelid flashes signal to mates over the thunder of the falls.', evidence: [ph('torrentdipper', 'bobbing')], hint: 'Watch it on a wet rock.' },
    ],
  },
  {
    id: 'snakestork', name: 'Thunder Stork', sci: 'Ophiociconia armata', group: 'Bird', sites: ['mangrove'], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '1.4 m', blurb: 'A tall stork with armoured leg scales and a dagger bill, specialising in spearing water snakes.',
    behaviors: { stalking: 'Stalking', catching: 'Catching a serpent', display: 'Bill-clatter display', flying: 'Flying' },
    facts: [
      { id: 'stork-diet', cat: 'Diet', q: 'What does the Serpent Stork eat?', options: ['Water snakes', 'Leaves', 'Crabs only'], answer: 0, text: 'It spears Mudribbons and young serpents from the shallows.', evidence: [ph('snakestork', 'catching')], hint: 'Photograph a successful catch.' },
      { id: 'stork-armor', cat: 'Adaptation', q: 'Why are its legs covered in thick scales?', options: ['Protection from bites', 'For swimming', 'Decoration'], answer: 0, text: 'Armoured leg scales shrug off bites from the snakes it hunts.', evidence: [ph('snakestork', 'stalking')], hint: 'Look closely at it wading.' },
      { id: 'stork-display', cat: 'Behaviour', q: 'How do Serpent Storks court?', options: ['Loud bill-clattering', 'Singing', 'Dancing on water'], answer: 0, text: 'Pairs clatter their bills with wings raised in a loud duet.', evidence: [ph('snakestork', 'display')], hint: 'Catch a display.' },
    ],
  },
  // ------------------------------------------------------------ MAMMALS
  {
    id: 'shieldback', name: 'Shieldback', sci: 'Loricatherium volvens', group: 'Mammal', sites: ['fernwood', 'falls'], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '60 cm', blurb: 'An armoured mammal plated like a pangolin. At the first flick of a forked tongue it rolls into a bite-proof ball.',
    behaviors: { foraging: 'Foraging', rolled: 'Rolled up', digging: 'Digging' },
    facts: [
      { id: 'shield-roll', cat: 'Adaptation', q: 'How does the Shieldback defend itself?', options: ['Rolls into an armoured ball', 'Runs up trees', 'Sprays scent'], answer: 0, text: 'Overlapping plates lock into a sphere no snake jaw can grip.', evidence: [ph('shieldback', 'rolled')], hint: 'Startle one, or wait for a serpent to pass.' },
      { id: 'shield-diet', cat: 'Diet', q: 'What does the Shieldback eat?', options: ['Roots and fungi', 'Birds', 'Fish'], answer: 0, text: 'It roots through the soil for tubers and truffle-like fungi.', evidence: [ph('shieldback', 'foraging')], hint: 'Photograph it snuffling for food.' },
      { id: 'shield-eco', cat: 'Ecology', q: 'Why are Shieldbacks armoured?', options: ['Constant serpent predation', 'Cold winters', 'Falling trees'], answer: 0, text: 'Millions of years of snake predation favoured armour over speed.', evidence: [cl('scute'), ph('shieldback', 'digging')], hint: 'A lost plate is a clue.' },
    ],
  },
  {
    id: 'quillhog', name: 'Quillhog', sci: 'Echinomys nocturnus', group: 'Mammal', sites: ['fernwood', 'falls'], times: ['dusk', 'night'],
    rarity: 2, danger: 0, size: '45 cm', blurb: 'A nocturnal forager bristling with white-tipped quills that it rattles and raises at anything with scales.',
    behaviors: { foraging: 'Foraging', quills: 'Quill display', eating: 'Eating fruit' },
    facts: [
      { id: 'quill-display', cat: 'Adaptation', q: 'What does it do when threatened?', options: ['Raises and rattles its quills', 'Plays dead', 'Climbs a tree'], answer: 0, text: 'It fans barbed quills and rattles them; snakes learn fast.', evidence: [ph('quillhog', 'quills')], hint: 'Photograph its defence.' },
      { id: 'quill-diet', cat: 'Diet', q: 'What does the Quillhog love to eat?', options: ['Fallen fruit', 'Snails only', 'Eggs'], answer: 0, text: 'It gorges on fallen fruit; a fruit lure brings it running.', evidence: [ph('quillhog', 'eating')], hint: 'Try a fruit lure at night.' },
      { id: 'quill-time', cat: 'Activity', q: 'When is it active?', options: ['At night', 'At midday', 'Only at dawn'], answer: 0, text: 'Nocturnal: it avoids day-hunting hawks and basking serpents.', evidence: [ph('quillhog', 'foraging')], hint: 'Look after dark.' },
    ],
  },
  {
    id: 'delver', name: 'Tunnel Delver', sci: 'Fossorimys vigil', group: 'Mammal', sites: ['fernwood', 'falls'], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '25 cm', blurb: 'A pink-nosed burrower that lives in huge tunnel towns and pops up to keep watch for serpents.',
    behaviors: { peeking: 'Keeping watch', digging: 'Digging', eating: 'Eating roots' },
    facts: [
      { id: 'delver-home', cat: 'Behaviour', q: 'Where do Delvers live?', options: ['Tunnel networks', 'Tree hollows', 'Floating nests'], answer: 0, text: 'Colonies dig tunnel towns with dozens of entrances.', evidence: [cl('burrow'), ph('delver', 'digging')], hint: 'Find their burrows.' },
      { id: 'delver-watch', cat: 'Behaviour', q: 'Why do Delvers pop up and freeze?', options: ['Sentinels watching for serpents', 'Sunbathing', 'Sleeping'], answer: 0, text: 'Sentinels stand guard and squeak an alarm when serpents approach.', evidence: [ph('delver', 'peeking')], hint: 'Photograph a sentinel.' },
      { id: 'delver-diet', cat: 'Diet', q: 'What do they eat?', options: ['Roots and tubers', 'Insects', 'Fish'], answer: 0, text: 'They graze on roots underground and nibble tubers at the surface.', evidence: [ph('delver', 'eating')], hint: 'Catch one eating.' },
    ],
  },
  {
    id: 'sailglider', name: 'Sail Possum', sci: 'Velopetaurus nectarius', group: 'Mammal', sites: ['canopy'], times: ['dusk', 'night', 'dawn'],
    rarity: 2, danger: 0, size: '30 cm', blurb: 'A big-eyed glider with a sail of skin between its limbs, drifting from blossom to blossom at dusk.',
    behaviors: { gliding: 'Gliding', feeding: 'Sipping nectar', grooming: 'Grooming' },
    facts: [
      { id: 'sail-glide', cat: 'Adaptation', q: 'How does the Sail Possum travel?', options: ['Gliding on skin membranes', 'Swinging on vines', 'Flying with feathers'], answer: 0, text: 'A patagium of skin stretched between wrists and ankles lets it glide 50 m.', evidence: [vid('sailglider', 'gliding')], hint: 'Record a glide.' },
      { id: 'sail-diet', cat: 'Diet', q: 'What does it feed on?', options: ['Rata nectar', 'Snake eggs', 'Beetles'], answer: 0, text: 'It laps nectar from red rata blossoms with a brush-tipped tongue.', evidence: [ph('sailglider', 'feeding')], hint: 'Watch the red flowers.' },
      { id: 'sail-pred', cat: 'Ecology', q: 'Why does it avoid bright lights at night?', options: ['Lure-Vipers use glowing lures', 'It is shy of the moon', 'Bright lights burn it'], answer: 0, text: 'Young possums that chase glowing lures often end up as Lure-Viper meals.', evidence: [ph('lurevip', 'luring')], hint: 'What glows in the night canopy?' },
    ],
  },
  {
    id: 'flicker', name: 'Flicker Marten', sci: 'Ophiomachus velox', group: 'Mammal', sites: ['canopy', 'fernwood'], times: ['dawn', 'day', 'dusk'],
    rarity: 4, danger: 0, size: '70 cm', blurb: 'A blindingly fast marten that picks fights with serpents twice its size and wins — Zealandia’s mongoose.',
    behaviors: { leaping: 'Leaping', fighting: 'Fighting a serpent', alert: 'On alert' },
    facts: [
      { id: 'flicker-diet', cat: 'Diet', q: 'What does the Flicker Marten hunt?', options: ['Serpents', 'Fruit', 'Fish'], answer: 0, text: 'It hunts serpents, dodging strikes with lightning reflexes.', evidence: [ph('flicker', 'fighting')], hint: 'Photograph a fight with a serpent.' },
      { id: 'flicker-agility', cat: 'Adaptation', q: 'How does it avoid being bitten?', options: ['Extreme speed and agility', 'Thick armour', 'It hides underground'], answer: 0, text: 'Reflexes twice as fast as a viper strike; it leaps clear, then bites the neck.', evidence: [vid('flicker', 'leaping')], hint: 'Record its acrobatics.' },
      { id: 'flicker-venom', cat: 'Anatomy', q: 'What protects it from venom?', options: ['Venom-resistant blood', 'Feathers', 'Nothing'], answer: 0, text: 'Its blood proteins resist serpent venom, like a mongoose.', evidence: [cl('scat-scales'), ph('flicker', 'alert')], hint: 'Its droppings tell you what it eats — and survives.' },
    ],
  },
  // ------------------------------------------------------------ REPTILE
  {
    id: 'ironjaw', name: 'Ironjaw Crocodile', sci: 'Crocodylus ferrognathus', group: 'Reptile', sites: ['mangrove'], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 2, size: '5 m', blurb: 'An armoured crocodile that rules the mangrove channels. Only the Titan Constrictor dares challenge it.',
    behaviors: { basking: 'Basking, jaws open', lurking: 'Lurking', swimming: 'Swimming', lunging: 'Lunging' },
    facts: [
      { id: 'croc-bask', cat: 'Behaviour', q: 'Why does the Ironjaw bask with its jaws open?', options: ['To cool down', 'To scare rivals', 'To catch flies'], answer: 0, text: 'Gaping lets heat escape from the mouth — it is air conditioning.', evidence: [ph('ironjaw', 'basking')], hint: 'Photograph it on the mudbank.' },
      { id: 'croc-hunt', cat: 'Behaviour', q: 'How does it hunt?', options: ['Lurks with only its eyes above water', 'Climbs trees', 'Chases prey inland'], answer: 0, text: 'It drifts with only eyes and nostrils showing, then lunges.', evidence: [ph('ironjaw', 'lurking')], hint: 'Look for eyes on the water.' },
      { id: 'croc-diet', cat: 'Diet', q: 'What does the Ironjaw prey on?', options: ['Storks and serpents at the water edge', 'Seaweed', 'Insects'], answer: 0, text: 'Anything at the water’s edge: storks, Mudribbons, even young Titans.', evidence: [ph('ironjaw', 'lunging'), cl('vertebrae')], hint: 'What is left on the bank?' },
    ],
  },
  // ------------------------------------------------------------ V2 ADDITIONS
  {
    id: 'boneface', name: 'Forest Boneface', sci: 'Osteoprosopus silvanus', group: 'Mammal', sites: ['fernwood'], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 1, size: '2.4 m', blurb: 'A great, placid browser with a face of solid bone. Herds wander the Fernwood stripping leaves, calves bouncing at their heels. Threaten the young, though, and the placid part is over.',
    behaviors: { browsing: 'Browsing', charging: 'Charging', playing: 'Calves playing', wallowing: 'Wallowing' },
    facts: [
      { id: 'bf-shield', cat: 'Adaptation', q: 'What is the Boneface’s bony face for?', options: ['Shoving through thorny thickets and turning aside fangs', 'Digging burrows', 'Attracting mates with colour'], answer: 0, text: 'The fused bony shield turns aside serpent fangs and lets it bulldoze through thorny undergrowth to reach fresh leaves.', evidence: [ph('boneface', 'browsing'), cl('boneface-track')], hint: 'Watch one feeding, and look at where it has pushed through.' },
      { id: 'bf-herd', cat: 'Behaviour', q: 'Why are Boneface calves so relaxed?', options: ['The adults form a living wall and charge at threats', 'Nothing hunts them', 'They can outrun anything'], answer: 0, text: 'Adults close ranks around the calves and charge anything that comes too close, even a photographer.', evidence: [ph('boneface', 'charging'), ph('boneface', 'playing')], hint: 'Photograph the calves at play, and see what happens if you get too close.' },
      { id: 'bf-mud', cat: 'Behaviour', q: 'Why do Bonefaces wallow in mud?', options: ['Mud protects their skin from sun and biting insects', 'To hide from the Titan', 'To find roots'], answer: 0, text: 'A coat of drying mud is sunscreen and insect repellent in one.', evidence: [ph('boneface', 'wallowing')], hint: 'Find a muddy spot they like.' },
    ],
  },
  {
    id: 'hunterbat', name: 'Hunter Bat', sci: 'Ambulochiroptera venator', group: 'Mammal', sites: ['fernwood', 'falls'], times: ['dusk', 'night'],
    rarity: 3, danger: 0, size: '1.1 m span', blurb: 'A big-eared bat that folds its wings into forelegs and stalks the forest floor on all fours, snatching frogs and wētā in the dark.',
    behaviors: { hunting: 'Hunting on foot', hanging: 'Roosting', flying: 'Flying' },
    facts: [
      { id: 'hb-walk', cat: 'Adaptation', q: 'How does the Hunter Bat catch frogs?', options: ['It walks on its folded wings and pounces', 'It spits venom', 'It dives into water'], answer: 0, text: 'With no small birds to compete with, these bats took to the ground. Folded wings become strong forelegs.', evidence: [ph('hunterbat', 'hunting'), cl('bat-roost')], hint: 'Find where it roosts, and watch it hunt at night.' },
      { id: 'hb-echo', cat: 'Anatomy', q: 'What are the huge ears for?', options: ['Echolocation, and hearing prey footsteps', 'Cooling off', 'Display'], answer: 0, text: 'The ears pick up its own clicks bouncing back, and the tiny footsteps of a wētā on bark.', evidence: [vid('hunterbat', 'flying')], hint: 'Record it flying: listen for the clicks.' },
      { id: 'hb-roost', cat: 'Behaviour', q: 'Where does it spend the day?', options: ['Hanging upside-down from high branches', 'In burrows', 'In old birds’ nests'], answer: 0, text: 'It roosts high under branches, wrapped in its wings, out of reach of climbing serpents.', evidence: [ph('hunterbat', 'hanging')], hint: 'Look up.' },
    ],
  },
  {
    id: 'mossfrog', name: 'Moss Frog', sci: 'Bryobatrachus cantor', group: 'Amphibian', sites: ['fernwood', 'falls', 'mangrove'], times: ['dusk', 'night', 'dawn'],
    rarity: 1, danger: 0, size: '6 cm', blurb: 'A frog so covered in mossy skin flaps that it vanishes on any log. At night the whole forest throbs with their chorus.',
    behaviors: { calling: 'Calling', hunting: 'Catching insects', hiding: 'Camouflaged' },
    facts: [
      { id: 'mf-camo', cat: 'Adaptation', q: 'Why is it covered in moss-like flaps?', options: ['Camouflage against serpents and bats', 'To keep warm', 'To store water'], answer: 0, text: 'Its skin flaps break up its outline completely. You can be looking right at one.', evidence: [ph('mossfrog', 'hiding')], hint: 'Find one sitting still on a mossy log. Good luck.' },
      { id: 'mf-call', cat: 'Behaviour', q: 'Why do Moss Frogs call back and forth?', options: ['Males answer each other to attract mates', 'To scare predators', 'They’re lost'], answer: 0, text: 'Males take turns calling so each one can be heard: a chorus with rules.', evidence: [vid('mossfrog', 'calling')], hint: 'Record a calling frog at night.' },
      { id: 'mf-diet', cat: 'Diet', q: 'What do they eat?', options: ['Insects caught with a sticky tongue', 'Algae', 'Fish fry'], answer: 0, text: 'The tongue shoots out in a fifteenth of a second. Moths never see it coming.', evidence: [ph('mossfrog', 'hunting'), cl('frog-spawn')], hint: 'Watch one hunting, and look for its eggs.' },
    ],
  },
  {
    id: 'barkgecko', name: 'Bark Gecko', sci: 'Corticolus violaceus', group: 'Reptile', sites: ['fernwood', 'canopy'], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '18 cm', blurb: 'A gecko patterned exactly like kauri bark. Rival males flare violet dewlaps at each other in silent duels up and down the trunks.',
    behaviors: { display: 'Dewlap display', hunting: 'Hunting moths', clinging: 'Clinging to bark' },
    facts: [
      { id: 'bg-dewlap', cat: 'Behaviour', q: 'What is the violet dewlap for?', options: ['Displaying to rivals and mates', 'Storing food', 'Breathing'], answer: 0, text: 'A flash of violet says “this trunk is mine” without a fight.', evidence: [ph('barkgecko', 'display')], hint: 'Two on one trunk means trouble. Watch.' },
      { id: 'bg-toes', cat: 'Anatomy', q: 'How does it cling to smooth bark?', options: ['Millions of microscopic hairs on its toe pads', 'Suction cups', 'Sticky slime'], answer: 0, text: 'Its toe pads grip with molecular forces. It could hang from glass.', evidence: [ph('barkgecko', 'clinging'), cl('gecko-shed')], hint: 'Photograph one on a trunk, and find a shed skin.' },
      { id: 'bg-diet', cat: 'Diet', q: 'What does it hunt?', options: ['Moths and small insects', 'Birds’ eggs', 'Fruit'], answer: 0, text: 'It waits motionless for moths to land on the bark, then snaps.', evidence: [ph('barkgecko', 'hunting')], hint: 'Watch one hunting.' },
    ],
  },
  {
    id: 'pteramander', name: 'Pteramander', sci: 'Pterotriton volans', group: 'Amphibian', sites: ['mangrove', 'falls'], times: ['dusk', 'night'],
    rarity: 2, danger: 0, size: '25 cm', blurb: 'A salamander with skin flaps between its legs that glides from trunk to trunk above the mangrove water, out of reach of the Mudribbons below.',
    behaviors: { gliding: 'Gliding', climbing: 'Climbing', hunting: 'Hunting' },
    facts: [
      { id: 'pt-glide', cat: 'Adaptation', q: 'How does the Pteramander get between trees?', options: ['Gliding on skin flaps between its legs', 'Swimming', 'Hopping'], answer: 0, text: 'It spreads its limbs and the flaps become wings. It can glide ten metres.', evidence: [vid('pteramander', 'gliding')], hint: 'Record a glide.' },
      { id: 'pt-why', cat: 'Ecology', q: 'Why does it avoid the water?', options: ['Mudribbons and Thunder Storks hunt the water’s edge', 'It can’t swim', 'The water is too salty'], answer: 0, text: 'An amphibian that fears water: in the Blackwater, the water is where the danger is.', evidence: [ph('pteramander', 'climbing'), ph('mudribbon', 'fishing')], hint: 'Watch what hunts in the water below it.' },
      { id: 'pt-diet', cat: 'Diet', q: 'What does it eat?', options: ['Insects on the trunks', 'Fish', 'Leaves'], answer: 0, text: 'It licks ants and midges off the mangrove bark.', evidence: [ph('pteramander', 'hunting')], hint: 'Watch it hunt.' },
    ],
  },
  {
    id: 'monarch', name: 'Monarch', sci: 'Regivultur immensus', group: 'Bird', sites: ['falls', 'coast'], times: ['dawn', 'day'],
    rarity: 4, danger: 0, size: '5 m span', blurb: 'The largest flying animal anyone has ever seen: a soaring scavenger with a bare pale neck, riding thermals over the cliffs for hours without a single wingbeat.',
    behaviors: { soaring: 'Soaring', feeding: 'Scavenging' },
    facts: [
      { id: 'mo-soar', cat: 'Adaptation', q: 'How does the Monarch stay aloft for hours?', options: ['Soaring on rising warm air', 'Flapping constantly', 'Floating on gas sacs'], answer: 0, text: 'It circles in thermals and slope winds, almost never flapping. Flapping a body that big would be exhausting.', evidence: [vid('monarch', 'soaring')], hint: 'Record it soaring.' },
      { id: 'mo-diet', cat: 'Diet', q: 'What does the Monarch eat?', options: ['Carrion: dead animals', 'Live serpents', 'Fish'], answer: 0, text: 'It cleans up what the Titan and the Ironjaw leave behind.', evidence: [ph('monarch', 'feeding'), cl('monarch-feather')], hint: 'Find where it lands.' },
      { id: 'mo-neck', cat: 'Anatomy', q: 'Why is its neck bare?', options: ['Feathers would get fouled while feeding inside carcasses', 'To attract mates', 'To cool its brain'], answer: 0, text: 'Like a vulture: a bald neck stays clean.', evidence: [ph('monarch', 'feeding')], hint: 'Get a clear shot of it feeding.' },
    ],
  },
  {
    id: 'nutcracker', name: 'Nutcracker', sci: 'Nucifraga crassirostris', group: 'Bird', sites: ['canopy', 'fernwood'], times: ['dawn', 'day'],
    rarity: 1, danger: 0, size: '22 cm', blurb: 'A plump bird with a beak like a pair of pliers. Flocks crack moonfruit seeds nobody else can open, while one of them always keeps watch.',
    behaviors: { cracking: 'Cracking seeds', sentinel: 'Keeping watch', flocking: 'Flocking' },
    facts: [
      { id: 'nc-beak', cat: 'Adaptation', q: 'What is that massive beak for?', options: ['Cracking hard seeds', 'Fighting serpents', 'Digging'], answer: 0, text: 'Its beak can crack a moonfruit seed that a hammer struggles with.', evidence: [ph('nutcracker', 'cracking'), cl('cracked-seeds')], hint: 'Watch one feeding, and look at what it leaves.' },
      { id: 'nc-sentinel', cat: 'Behaviour', q: 'Why does one bird sit apart from the flock?', options: ['It’s a sentinel watching for predators', 'It’s the leader', 'It’s sick'], answer: 0, text: 'A sentinel keeps watch from a perch and barks an alarm when a hawk or glider appears.', evidence: [ph('nutcracker', 'sentinel')], hint: 'Look up from the flock.' },
      { id: 'nc-flock', cat: 'Behaviour', q: 'Why do they feed in flocks?', options: ['More eyes to spot gliding serpents and hawks', 'To share warmth', 'To confuse the fruit'], answer: 0, text: 'In a land of gliding snakes, feeding alone is a bad idea.', evidence: [ph('nutcracker', 'flocking')], hint: 'Photograph the flock.' },
    ],
  },
];

export const CLUES: ClueDef[] = [
  { id: 'grub-shells', name: 'Chewed grub casings', desc: 'Empty beetle-larva husks beside freshly dug soil, with claw marks.', site: 'fernwood', icon: 'shells' },
  { id: 'fur-tuft', name: 'Tuft of fur', desc: 'Brown fur caught on a thorn, next to two-toed running tracks.', site: 'fernwood', icon: 'fur' },
  { id: 'scute', name: 'Armour plate', desc: 'A shed Shieldback scute, scored with fang marks that failed to pierce it.', site: 'fernwood', icon: 'scute' },
  { id: 'burrow', name: 'Burrow mound', desc: 'A ring of loose earth around a hole; more holes nearby.', site: 'fernwood', icon: 'burrow' },
  { id: 'scat-scales', name: 'Scaly droppings', desc: 'Mammal droppings packed with serpent scales and a fang.', site: 'canopy', icon: 'scat' },
  { id: 'shed-ribbon', name: 'Iridescent shed skin', desc: 'A rainbow shed skin snagged on a treetop far above the ground.', site: 'canopy', icon: 'skin' },
  { id: 'giant-skin', name: 'Colossal shed skin', desc: 'A shed skin so large it drapes the rocks like a tarp. Something enormous lives nearby.', site: 'falls', icon: 'bigskin' },
  { id: 'eggshell', name: 'Eggshell fragments', desc: 'Cracked, gold-speckled eggshells beneath the nesting cliff.', site: 'falls', icon: 'egg' },
  { id: 'falls-nest', name: 'Mossy nest', desc: 'A nest of moss behind the waterfall curtain, dripping but warm.', site: 'falls', icon: 'nest' },
  { id: 'croc-scute', name: 'Crocodile scute', desc: 'A bony plate from an adult Ironjaw, etched by stomach acid.', site: 'mangrove', icon: 'scute' },
  { id: 'boneface-track', name: 'Three-toed tracks', desc: 'Deep three-toed prints and a tunnel of stripped, shoved-aside branches through the thorn scrub.', site: 'fernwood', icon: 'tracks' },
  { id: 'bat-roost', name: 'Roost litter', desc: 'A pile of wētā legs and frog bones under a high branch. Something eats up there.', site: 'falls', icon: 'bones' },
  { id: 'frog-spawn', name: 'Frog spawn', desc: 'A jelly egg mass on a leaf hanging over the water, speckled with tiny green dots.', site: 'mangrove', icon: 'egg' },
  { id: 'gecko-shed', name: 'Tiny shed skin', desc: 'A gecko-shaped shed skin clinging to bark, toe pads and all.', site: 'canopy', icon: 'skin' },
  { id: 'monarch-feather', name: 'Colossal feather', desc: 'A dark flight feather longer than your arm, stuck in the rocks.', site: 'falls', icon: 'feather' },
  { id: 'cracked-seeds', name: 'Cracked seeds', desc: 'Moonfruit seeds split cleanly in half under a tree. Nothing you own could crack them.', site: 'canopy', icon: 'shells' },
  { id: 'vertebrae', name: 'Serpent vertebrae', desc: 'A string of snake vertebrae on the mudbank, crushed by massive jaws.', site: 'mangrove', icon: 'bones' },
];

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const CLUE_BY_ID: Record<string, ClueDef> = Object.fromEntries(CLUES.map(c => [c.id, c]));
export const ALL_FACTS = SPECIES.flatMap(s => s.facts.map(f => ({ species: s.id, fact: f })));

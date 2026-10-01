// V9 field guide: the fish of the Southern Ocean and the island's waters (caught at the stern, in
// the stream and the rock pools). Shared Species format; see ../species.ts.
//
// The ten stern-fishing species (their fight and bite data live in ../../ui/v4/fishing.ts FISH, their
// art in ../../art/v9/fish.ts) and the snout louse, a parasite that sometimes turns up inside a
// snout bass's trunk. A catch photo (behaviour 'caught') is taken automatically when you land one.

import type { Species } from '../species';
import { ph } from './ev';

export const FISH9: Species[] = [
  {
    id: 'snoutbass', name: 'Snout Bass', sci: 'Rhynchoperca radicans', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '30–58 cm', blurb: 'A stocky olive bass with a long, flexible, trunk-like snout that it roots through the sand with, like a tiny underwater elephant.',
    behaviors: { caught: 'Caught', swimming: 'Swimming', rooting: 'Rooting in the sand' },
    facts: [
      { id: 'snoutbass-trunk', cat: 'Anatomy', q: 'What is the Snout Bass’s trunk for?', options: ['Rooting buried prey out of the sand', 'Breathing air at the surface', 'Fighting rivals'], answer: 0, text: 'The trunk is a fleshy extension of the upper lip, packed with taste buds. It ploughs the sand and sniffs out buried crabs and worms.', evidence: [ph('snoutbass', 'caught')], hint: 'Land one and look closely at its face.' },
      { id: 'snoutbass-louse', cat: 'Ecology', q: 'Who lives inside some Snout Bass trunks?', options: ['A parasitic isopod', 'A cleaner shrimp', 'Nobody'], answer: 0, text: 'The snout louse crawls into the trunk and clings on for life, stealing a share of every meal.', evidence: [ph('snoutlouse', 'attached')], hint: 'Some snout bass have a passenger. Keep catching them.' },
    ],
    research: {
      habitat: 'Sandy flats and the edges of reefs, from about 5 to 30 m. Rarely far from the bottom.',
      diet: 'Buried crabs, worms, clams and sand-hoppers. It ploughs the sand with its trunk and snaps up whatever wriggles out.',
      anatomy: 'The trunk is a hugely stretched upper lip with its own muscles, lined with taste buds and pressure pits. It can bend in any direction and curls up out of the way when the fish swallows. Otherwise it is a classic ambush bass: big mouth, spiny dorsal, strong tail.',
      ecology: 'Followed around by wrasses and stingrays hoping to grab what its digging turns up. Hunted by seals and big snapper. Host to the snout louse.',
      behaviour: 'Forages alone at dawn and dusk, leaving long zig-zag furrows in the sand. When hooked it heads straight for the bottom and tries to root itself in.',
      notes: ['It smells the bait long before it sees it. The trunk sways toward the hook like a dowsing rod.', 'Joshu calls them “hoover fish”. He is not wrong.'],
      status: 'Common',
    },
  },
  {
    id: 'lanterncod', name: 'Lantern Cod', sci: 'Lychnogadus barbilux', group: 'Fish', sites: [], times: ['dawn', 'dusk', 'night', 'day'],
    rarity: 2, danger: 0, size: '28–50 cm', blurb: 'A big-headed, deep-blue cod that dangles a glowing bulb on the end of its chin barbel, and swallows whatever comes to look.',
    behaviors: { caught: 'Caught', luring: 'Luring', swimming: 'Swimming' },
    facts: [
      { id: 'lanterncod-lure', cat: 'Adaptation', q: 'What makes the Lantern Cod’s chin bulb glow?', options: ['Glowing bacteria living inside it', 'It reflects the sun', 'An electric charge'], answer: 0, text: 'The bulb is a pouch farmed by luminous bacteria. The cod feeds them; they light its lure.', evidence: [ph('lanterncod', 'caught')], hint: 'Land one and look at its chin.' },
    ],
    research: {
      habitat: 'Shady places in mid water: under reef overhangs, in kelp and in the shadow of boats, 10 to 40 m.',
      diet: 'Small fish, squid and shrimp drawn in by the light.',
      anatomy: 'The chin barbel that ordinary cod use to taste the seabed has grown long and ends in a bulb of glowing bacteria. Huge eyes gather what little light there is. Three dorsal fins, like all cod.',
      ecology: 'Its lure attracts glassfin, young kahawai and shrimp. Eaten by seals and sharks. It lives in the Kittiwake’s shadow as happily as under a rock.',
      behaviour: 'Hangs still and flicks the bulb in little circles. Pulls hard and steady when hooked, with few runs.',
      notes: ['You can see the lure through the water as a little blue spark.'],
      status: 'Common',
    },
  },
  {
    id: 'sixfinger', name: 'Sixfinger Gurnard', sci: 'Hexadactylus ambulans', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '24–42 cm', blurb: 'A red, bony-headed gurnard that walks across the seabed on six finger-rays, and opens huge turquoise “wings” when startled. It grunts when you catch it.',
    behaviors: { caught: 'Caught', walking: 'Walking on the seabed', display: 'Wing display' },
    facts: [
      { id: 'sixfinger-fingers', cat: 'Anatomy', q: 'What are the Sixfinger Gurnard’s “legs”?', options: ['Separate rays of its pectoral fins', 'Real legs with bones', 'Whiskers'], answer: 0, text: 'The first six rays of the pectoral fins split off into free, jointed fingers. They walk, and they taste the sand as they go.', evidence: [ph('sixfinger', 'caught')], hint: 'Catch one off the stern.' },
    ],
    research: {
      habitat: 'Open sand and gravel on the bottom, 5 to 60 m.',
      diet: 'Shrimp, crabs and worms that it finds by touch and taste with its fingers.',
      anatomy: 'Six free finger-rays (three a side) with their own muscles and taste cells, used to walk and to feel. A bony armoured head and big fan-like pectoral fins, teal with blue spots and an electric edge.',
      ecology: 'Shares the sand with the snout bass (they dig up each other’s dinner). Eaten by sharks, seals and shags.',
      behaviour: 'Strolls along the bottom tapping the sand. Flashes its wings to startle predators. Grunts loudly with its swim bladder when caught.',
      notes: ['It really does walk. I watched one step over a shell.'],
      status: 'Common',
    },
  },
  {
    id: 'mirrordory', name: 'Mirror Dory', sci: 'Specularia tenuis', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '24–48 cm', blurb: 'A paper-thin dory with flanks like polished chrome and a dark thumbprint spot. Head-on it all but disappears.',
    behaviors: { caught: 'Caught', stalking: 'Stalking', swimming: 'Swimming' },
    facts: [
      { id: 'mirrordory-mirror', cat: 'Adaptation', q: 'Why is the Mirror Dory shaped like a coin with mirror sides?', options: ['Head-on it is nearly invisible to prey', 'To attract a mate', 'To keep cool'], answer: 0, text: 'Its mirror sides reflect the water around it and it is only millimetres thick head-on, so it can drift right up to small fish unseen.', evidence: [ph('mirrordory', 'caught')], hint: 'Catch one off the stern.' },
    ],
    research: {
      habitat: 'Mid water over reefs and kelp, 10 to 50 m.',
      diet: 'Small fish and shrimp, sucked in by a mouth that shoots forward like a telescope.',
      anatomy: 'Guanine crystals in the skin make a true mirror. The body is so thin you can almost see light through it. The dark spot with a gold ring looks like a big eye and confuses predators about which way it is facing.',
      ecology: 'Stalks glassfin schools. Eaten by kahawai and seals, when they can find it.',
      behaviour: 'Drifts slowly, turning to keep its thin edge toward whatever it is watching. When hooked it turns side-on and sinks, using its broad body like a kite.',
      notes: ['I caught my own reflection in it. Very flattering.'],
      status: 'Uncommon',
    },
  },
  {
    id: 'hammersnapper', name: 'Hammerbrow Snapper', sci: 'Pagrus malleifrons', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '34–74 cm', blurb: 'A pink, blue-spotted snapper with a heavy bony hammer of a brow that it uses to knock shellfish off the rocks.',
    behaviors: { caught: 'Caught', ramming: 'Ramming shellfish', swimming: 'Swimming' },
    facts: [
      { id: 'hammersnapper-brow', cat: 'Anatomy', q: 'What is the Hammerbrow Snapper’s brow made of?', options: ['A thick bony ridge on the skull', 'Fat', 'Cartilage filled with air'], answer: 0, text: 'The forehead bones grow into a solid battering ram. Big old males have the biggest hammers.', evidence: [ph('hammersnapper', 'caught')], hint: 'Catch one far out.' },
    ],
    research: {
      habitat: 'Rocky reefs, usually 15 to 60 m, often well away from the boat.',
      diet: 'Mussels, paua-like limpets, crabs and urchins, knocked loose and crushed with molar-like teeth.',
      anatomy: 'A bony brow ridge with a flat striking face overhangs the eyes; the neck muscles behind it are huge. Electric-blue spots scattered over a pink body, like its snapper cousins.',
      ecology: 'By breaking shells it feeds a crowd of small fish that pick up the scraps. Keeps urchins from eating the kelp forests bare.',
      behaviour: 'Long-lived and cautious: it circles a bait before biting. Hooked, it makes short, violent headbutting runs.',
      notes: ['The clack of one ramming a mussel carries through the hull.'],
      status: 'Uncommon',
    },
  },
  {
    id: 'bubblepuffer', name: 'Bubble Puffer', sci: 'Physogaster aerophagus', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 1, size: '14–26 cm', blurb: 'A round yellow puffer that gulps air at the surface to blow itself up into a floating, spiky ball. Captain Bubbles in the tank is one.',
    behaviors: { caught: 'Caught', inflated: 'Inflated', swimming: 'Swimming' },
    facts: [
      { id: 'bubblepuffer-air', cat: 'Adaptation', q: 'What does the Bubble Puffer fill itself with?', options: ['Air gulped at the surface', 'Seawater', 'Gas made in its gut'], answer: 0, text: 'Most puffers swallow water. This one gulps air, so when it inflates it floats up to the surface where predators can’t reach it from below.', evidence: [ph('bubblepuffer', 'caught')], hint: 'Catch one near the boat.' },
    ],
    research: {
      habitat: 'The surface layer and the shallows, often near floating weed and boats.',
      diet: 'Tiny crabs, barnacles and jellyfish, nibbled with a beak of fused teeth.',
      anatomy: 'A stretchy stomach that can hold three times the fish’s own volume in air, and skin with folded-down prickles that stand up when it inflates. Its flesh is mildly poisonous.',
      ecology: 'Grazes the barnacles off boat hulls (including ours). Few things dare eat it.',
      behaviour: 'Slow and curious. When hooked it puffs up and bobs to the surface, which makes it the easiest fish on the list to land.',
      notes: ['Do not eat. Joshu agrees, reluctantly.'],
      status: 'Common',
    },
  },
  {
    id: 'ribboneel', name: 'Ribbon Eelfish', sci: 'Taeniosoma iridis', group: 'Fish', sites: [], times: ['dusk', 'night', 'dawn', 'day'],
    rarity: 3, danger: 0, size: '60–120 cm', blurb: 'A long silver ribbon of a fish with a red dorsal fin that runs its whole length and a crest of red plumes on its head. Probably where sea-serpent stories come from.',
    behaviors: { caught: 'Caught', hovering: 'Hovering head-up', swimming: 'Swimming' },
    facts: [
      { id: 'ribboneel-swim', cat: 'Behaviour', q: 'How does the Ribbon Eelfish swim?', options: ['By rippling its long dorsal fin', 'By wriggling like a snake', 'By jet propulsion'], answer: 0, text: 'It keeps its body straight and sends waves down its endless dorsal fin, gliding forward or backward without a ripple of the body.', evidence: [ph('ribboneel', 'caught')], hint: 'Catch one off the stern.' },
    ],
    research: {
      habitat: 'The open water column, 10 to 200 m, rising at dusk.',
      diet: 'Krill and tiny shrimp, strained out of the water.',
      anatomy: 'The body is thin as a belt and iridescent; the red dorsal fin runs from head to tail. Long red plumes on the head and paddle-tipped pelvic “oars”.',
      ecology: 'Follows the krill up at dusk. Eaten by sharks and big tuna.',
      behaviour: 'Hovers head-up, rippling its fin. When hooked it twists and thrashes, then suddenly goes limp and lets itself be pulled. Then it twists again.',
      notes: ['Sailors used to report these as sea serpents. To be fair, from a distance...'],
      status: 'Uncommon',
    },
  },
  {
    id: 'glassmaomao', name: 'Glass Maomao', sci: 'Scorpis hyalina', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '18–32 cm', blurb: 'A schooling maomao so clear you can count its ribs and see its bright blue gut. Gerald in the tank is one.',
    behaviors: { caught: 'Caught', schooling: 'Schooling', swimming: 'Swimming' },
    facts: [
      { id: 'glassmaomao-clear', cat: 'Adaptation', q: 'Why is the Glass Maomao see-through?', options: ['Camouflage in open water, where there is nowhere to hide', 'It has no blood', 'It is sick'], answer: 0, text: 'In open water the best hiding place is to be invisible. Only its eyes, spine and gut show.', evidence: [ph('glassmaomao', 'caught')], hint: 'Catch one near the surface.' },
    ],
    research: {
      habitat: 'Near the surface in open water and over reefs, in schools of dozens.',
      diet: 'Plankton picked from the water one by one.',
      anatomy: 'Muscles and skin with almost no pigment and a special arrangement of fibres that lets light straight through. The gut is blue, possibly to hide the glow of the plankton it eats.',
      ecology: 'A staple food for kahawai, gannets, shags and dolphins.',
      behaviour: 'Schools that turn all at once. Hooked, it darts up toward the light.',
      notes: ['Gerald has now been renamed “Gerald the Glass”. He did not ask for this.'],
      status: 'Common',
    },
  },
  {
    id: 'spinnaker', name: 'Spinnaker Kahawai', sci: 'Arripis velifer', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '40–70 cm', blurb: 'A fast green-and-silver kahawai with a huge blue sail of a dorsal fin that it raises to herd baitfish and to turn at speed.',
    behaviors: { caught: 'Caught', herding: 'Herding baitfish', leaping: 'Leaping' },
    facts: [
      { id: 'spinnaker-sail', cat: 'Behaviour', q: 'What does the Spinnaker Kahawai use its sail for?', options: ['Herding baitfish into a tight ball', 'Catching the wind at the surface', 'Keeping warm'], answer: 0, text: 'A few of them swim around a school with sails raised, squeezing it into a ball, then take turns charging through.', evidence: [ph('spinnaker', 'caught')], hint: 'Cast far out, near the surface.' },
    ],
    research: {
      habitat: 'Surface waters far from the boat, often under diving birds.',
      diet: 'Glassfin, glass maomao and krill.',
      anatomy: 'A torpedo body built for sprinting and a sail-like dorsal fin that folds flat into a groove when it’s at full speed.',
      ecology: 'Its feeding frenzies drive baitfish to the surface, where shearwaters and gulls join in.',
      behaviour: 'Hunts in small groups. Hooked, it runs hard and leaps clear of the water.',
      notes: ['It fights like it has somewhere very important to be.'],
      status: 'Common',
    },
  },
  {
    id: 'sunwheel', name: 'Sun-Wheel Opah', sci: 'Lampris rotasolis', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 5, danger: 0, size: '0.9–1.5 m', blurb: 'A great round, rose-and-silver moonfish with crimson fins, a sunburst of gold around its eye and round pectoral fins that spin like wheels. Warm-blooded, and very rarely seen.',
    behaviors: { caught: 'Caught', swimming: 'Swimming' },
    facts: [
      { id: 'sunwheel-warm', cat: 'Adaptation', q: 'How does the Sun-Wheel Opah stay warm in the cold deep?', options: ['Constantly beating its round fins makes heat, and its gills keep it in', 'It basks at the surface', 'Thick fat'], answer: 0, text: 'Its wheel-like fins never stop. The muscles that drive them make heat, and a counter-current net in its gills keeps that warmth in its blood.', evidence: [ph('sunwheel', 'caught')], hint: 'Cast as far as you can, and be patient.' },
    ],
    research: {
      habitat: 'Deep, cold water far from land, 50 to 400 m. Rarely comes near the surface.',
      diet: 'Squid and deep-sea fish, chased down in the cold dark.',
      anatomy: 'A deep round body, crimson fins, and pectoral fins shaped into round “wheels” with radiating spokes. The first fish found to be warm-blooded all over.',
      ecology: 'A top predator of the twilight zone. Only big sharks trouble an adult.',
      behaviour: 'Solitary and wary. Hooked, it circles slowly and pulls like a car.',
      notes: ['A once-in-a-lifetime catch. I may cry.'],
      status: 'Rare — seen once in a lifetime',
    },
  },
  {
    id: 'snoutlouse', name: 'Snout Louse', sci: 'Cymothoa rhynchophila', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 0, size: '2–4 cm', blurb: 'A pale, armoured isopod that crawls into a snout bass’s trunk and clings on for life, stealing a share of every meal. Sometimes you catch one looking back at you.',
    behaviors: { attached: 'Riding in a trunk' },
    facts: [
      { id: 'snoutlouse-life', cat: 'Ecology', q: 'How does the Snout Louse feed?', options: ['It steals food as it passes through the trunk', 'It eats plankton', 'It drinks seawater'], answer: 0, text: 'It sits just inside the tip of the trunk with its hooked legs dug in, and grabs a share of whatever the bass sniffs up.', evidence: [ph('snoutlouse', 'attached')], hint: 'Some snout bass have a passenger in their trunk.' },
    ],
    research: {
      habitat: 'Inside the trunk of a snout bass. Nowhere else.',
      diet: 'Scraps of worm and crab stolen from its host, and a little mucus.',
      anatomy: 'Seven armoured plates, fourteen hooked legs that lock into the trunk’s lining, and two dark eyes near the front. Its relatives replace the tongues of other fish.',
      ecology: 'A parasite: the bass is a little thinner for carrying it, but lives. Young lice swim free and look for a trunk to move into.',
      behaviour: 'Stays put for life once it has found a host. Pokes its head out when the trunk is still.',
      notes: ['That’s snot what I expected to find.', 'It looked at me. I looked at it. Neither of us enjoyed it.'],
      status: 'Found in about one snout bass in three',
    },
  },
];

// V9 field guide: the island shore (tide line, rocks, cave, cove, bush edge). Every animal here is
// new to science: the Corvex Seal and its crown leeches, and the invented shore species painted in
// src/art/v9/shore. Entries use the shared Species format (see ../species.ts); the `research` sheet
// is what MoriOS shows once a photo of the animal has been uploaded. Behaviour keys match the
// behaviour ids the animals report to the camera (src/game/v4/shorelife.ts, seal.ts).

import type { Species } from '../species';
import { ph } from './ev';

export const SHORE9: Species[] = [
  {
    id: 'corvexseal', name: 'Corvex Seal', sci: 'Corvexocephalus rubrifrons', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 2, size: '3.6 m', blurb: 'A huge shaggy black seal-thing with a bare crimson face, a hooked ivory beak-plate over its muzzle and white star spots down its flanks. Sleeps like a boulder, wakes like a landslide, and gallops far faster than anything that heavy has any right to.',
    behaviors: { sleeping: 'Sleeping', scratching: 'Scratching at its leeches', flicking: 'Flicking sand', yawning: 'Yawning', roaring: 'Roaring', charging: 'Charging', exhausted: 'Exhausted', pinning: 'Lying on you' },
    facts: [
      { id: 'corvex-sprint', cat: 'Adaptation', q: 'Why does a Corvex Seal give up a chase so quickly?', options: ['Huge muscles built for short bursts, very little stamina on land', 'It is frightened of dogs', 'Hot sand burns its flippers'], answer: 0, text: 'On land it is all sprint and no marathon: a few hundred metres and it has to flop down and pant.', evidence: [ph('corvexseal', 'exhausted')], hint: 'Photograph it once it has tired itself out.' },
      { id: 'corvex-sac', cat: 'Anatomy', q: 'What is the crimson balloon under its beak?', options: ['A throat sac that turns its roar into a boom', 'A pouch for carrying fish', 'A swollen infection'], answer: 0, text: 'It gulps air into an elastic throat sac before it roars; the sac resonates like a drum and the roar carries right down the beach.', evidence: [ph('corvexseal', 'roaring')], hint: 'Get a shot of it reared up and roaring. From a safe distance. Ideally.' },
      { id: 'corvex-sand', cat: 'Behaviour', q: 'Why does it flick wet sand over its back in its sleep?', options: ['To cool down: that black coat soaks up the sun', 'To bury food for later', 'To scrub off its leeches'], answer: 0, text: 'A black pelt on a sunny beach overheats fast. Wet sand on the back is evaporative cooling, applied by flipper.', evidence: [ph('corvexseal', 'flicking'), ph('corvexseal', 'sleeping')], hint: 'Watch it sleep for a while. It is a restless sleeper.' },
    ],
    research: {
      habitat: 'Hauls out on the seal rocks between the stream mouth and the cliffs; sleeps on warm boulders and the firm sand at their foot. Hunts in the kelp beds offshore.',
      diet: 'Shellfish, crabs and kelp-bed fish. The keratin beak-plate crushes mussels and paua that a normal seal muzzle could not open.',
      anatomy: 'A bony "corvex" (raven-beak) plate sheathes the muzzle in hooked ivory keratin, with whisker pits along its edge. The face is bare crimson skin, which flushes darker when it is angry. Long fore-flippers carry three hooked claws and work like arms on land; the hind flippers swing forward under the hips to gallop. A mane of guard hair covers the nape; an elastic throat sac under the beak inflates for the roar.',
      ecology: 'Top predator of the rocky shore. Its neck creases are home to crown leeches, which seem to do it little harm. Shellwrenches pick over the shell middens it leaves on the rocks.',
      behaviour: 'Mostly asleep. In its sleep it scratches, yawns and flicks wet sand onto its back to stay cool. Woken suddenly it rears up and roars with the sac ballooned, then charges in heaving bounds, and stops dead a few hundred metres later, exhausted.',
      notes: ['Chunk woke it up. I would like that on the record.', 'If it catches you it does not bite. It lies on you. It is warm and it smells of a thousand fish.', 'The white spots on each flank are never the same twice. I think I can tell individuals apart by their "constellations".'],
      status: 'Known only from this island. A few individuals on the seal rocks.',
    },
  },
  {
    id: 'crownleech', name: 'Crown Leech', sci: 'Coronobdella corvexi', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 0, size: '6 cm', blurb: 'A glossy indigo leech that lives in a ring round the Corvex Seal\'s neck, in the bare skin crease behind the skull. Its head carries a crown of pale feathery gill-fronds that it opens like a tiny sea anemone while its host sleeps.',
    behaviors: { crowning: 'Crowns open', clinging: 'Clinging on', inching: 'Inching back', questing: 'Tasting the air' },
    facts: [
      { id: 'leech-crown', cat: 'Anatomy', q: 'What is the feathery crown on its head?', options: ['Gills: it breathes through them when it is out of the water', 'A sucker for drinking blood', 'Antennae for smelling seals'], answer: 0, text: 'The crown is a ring of gill-fronds. Underwater it breathes like any leech; on a sleeping seal it opens the crown to the damp air in the skin fold.', evidence: [ph('crownleech', 'crowning')], hint: 'Creep right up to the sleeping seal and photograph its neck.' },
      { id: 'leech-return', cat: 'Behaviour', q: 'What does a crown leech do when it is shaken off onto the sand?', options: ['Loops back toward its seal like an inchworm, rearing up to sense it', 'Burrows into the sand to wait', 'Swims out to sea'], answer: 0, text: 'It inches across the sand toward its host, stopping to rear up and "taste" the air. It can find the seal from metres away.', evidence: [ph('crownleech', 'inching'), ph('crownleech', 'questing')], hint: 'When the seal wakes and shakes, look at the sand around it.' },
    ],
    research: {
      habitat: 'The neck crease of the Corvex Seal, where the mane parts and the skin is thin, warm and damp. Breeds in the rock pools below the seal rocks.',
      diet: 'Blood, in tiny amounts: the crease is full of surface blood vessels the seal uses to shed heat, so the leeches never have to dig deep.',
      anatomy: 'A ringed, glossy indigo body with pale side stripes, a rear sucker and a crown of six to eight gill-fronds round the mouth. The fronds fold flat into a groove when the host moves.',
      ecology: 'A parasite that hardly hurts its host. Seals scratch at them in their sleep but never seem to get them all off; the leeches crawl straight back.',
      behaviour: 'Crowns open while the seal sleeps and clamped shut the moment it moves. Leeches knocked off on the sand inch back toward the seal, rearing up every few seconds to find it by smell.',
      notes: ['They sit in a ring round its neck like a crown. Hence the name. I am very pleased with that name.', 'I did not touch one. I want that on the record too.'],
      status: 'Found only on Corvex Seals.',
    },
  },
  {
    id: 'glasscrab', name: 'Glass Crab', sci: 'Hyalocarcinus pellucidus', group: 'Crustacean', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '2 cm', blurb: 'A thumbnail ghost crab of the wet sand with a shell as clear as sea glass: you can watch its red heart beating and its orange liver lobes working. On wet sand only the organs seem to float there. It sprints sideways into its burrow at the first footstep.',
    behaviors: { scuttling: 'Scuttling', feeding: 'Feeding on the backwash', waving: 'Claw-waving', burrowing: 'Digging in', peeking: 'Peeking out' },
    facts: [
      { id: 'glasscrab-hide', cat: 'Behaviour', q: 'How does the Glass Crab escape gulls and shorebirds?', options: ['It bolts into a burrow in the wet sand', 'It plays dead', 'It pinches'], answer: 0, text: 'Every crab keeps a burrow within a few body lengths and knows exactly where it is. It digs in and waits, then peeks out on its eyestalks.', evidence: [ph('glasscrab', 'burrowing'), ph('glasscrab', 'peeking')], hint: 'Walk up to one, then stand still and wait.' },
      { id: 'glasscrab-clear', cat: 'Adaptation', q: 'Why is its shell see-through?', options: ['Camouflage: on wet sand a clear crab is almost invisible', 'It has not hardened yet', 'To warm its organs in the sun'], answer: 0, text: 'Light passes straight through the shell, so it takes on the colour of the sand under it. Only its organs give it away.', evidence: [ph('glasscrab', 'feeding')], hint: 'Creep up slowly (crouch) and photograph one feeding.' },
      { id: 'glasscrab-wave', cat: 'Behaviour', q: 'Why does it wave one huge claw?', options: ['Males signal to rivals and females', 'To cool down', 'To dig'], answer: 0, text: 'Males grow one oversized claw and wave it at each other across the sand. A big claw is an advertisement, not a weapon.', evidence: [ph('glasscrab', 'waving')], hint: 'Watch two crabs that are close together.' },
    ],
    research: {
      habitat: 'The firm wet sand of the swash zone on the landing beach and the grove shore, each crab in its own burrow.',
      diet: 'The film of algae, diatoms and scraps every wave leaves behind; it sifts the sand with its claws as the backwash drains away.',
      anatomy: 'A glass-clear carapace and claws, with the heart, liver lobes, gills and gut showing through. Long eyestalks fold flat into grooves in the shell when it burrows. Males have one oversized claw.',
      ecology: 'Food for swashrunners, shellwrenches, kelp skinks and the periscope octopus. Its burrows aerate the sand.',
      behaviour: 'Feeds in the backwash, digs in as each wave arrives, bolts for its burrow at footsteps, peeks out on its eyestalks when things are quiet.',
      notes: ['I watched its heart beat. Through its BACK.', 'Crouching works. Running does not. Shocking, I know.'],
      status: 'Common on the island beaches.',
    },
  },
  {
    id: 'swashrunner', name: 'Swashrunner', sci: 'Charadrius undarum', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '17 cm', blurb: 'A tiny sand-pale plover with a black necklace that chases every retreating wave down the beach to snatch sand-hoppers, then sprints back up ahead of the next one on huge lobed "snowshoe" toes. Flocks move as one.',
    behaviors: { running: 'Chasing the waves', feeding: 'Feeding', flying: 'Flock flight', resting: 'Resting on one leg' },
    facts: [
      { id: 'swash-run', cat: 'Diet', q: 'Why does the Swashrunner chase the waves?', options: ['Sand-hoppers surface as the water drains away', 'It is playing', 'To wash its feet'], answer: 0, text: 'The backwash exposes hoppers and worms for a second or two. Speed is everything.', evidence: [ph('swashrunner', 'running')], hint: 'Watch the edge of the water as a wave goes out.' },
      { id: 'swash-toes', cat: 'Adaptation', q: 'What are its wide lobed toes for?', options: ['Spreading its weight so it never sinks into wet sand', 'Swimming', 'Digging'], answer: 0, text: 'Fringes of skin splay each toe into a little snowshoe. It can sprint across sand so wet that your boots sink.', evidence: [ph('swashrunner', 'feeding')], hint: 'A sharp close-up of one standing still.' },
      { id: 'swash-flock', cat: 'Behaviour', q: 'What happens when you scare one swashrunner?', options: ['The whole flock lifts off together', 'Only that one runs', 'They attack'], answer: 0, text: 'One alarm and the whole flock takes off at once, wheels low over the water and settles further down the beach.', evidence: [ph('swashrunner', 'flying')], hint: 'Get a shot of the flock in the air.' },
    ],
    research: {
      habitat: 'The swash zone of every sandy beach on the island, in flocks of three to six.',
      diet: 'Sand-hoppers, tiny worms and the odd young glass crab, grabbed in the second after a wave drains away.',
      anatomy: 'Long legs, a short touch-sensitive bill and long toes fringed with lobes of skin that spread its weight on soft wet sand.',
      ecology: 'Prey for the island\'s hawks; competes with glass crabs for the backwash food.',
      behaviour: 'Runs the tideline in step with the waves. Flocks feed, rest and flee together.',
      notes: ['Tiny legs. So much commitment.'],
      status: 'Common.',
    },
  },
  {
    id: 'shellwrench', name: 'Pied Shellwrench', sci: 'Strepsirhamphus conchoclastes', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '46 cm', blurb: 'A stocky black-and-white wader of the wrack line whose orange bill is crossed at the tip like a pair of pliers. It jams the crossed tips into a mussel\'s gape and twists it open. Loud about everything, especially its neighbours.',
    behaviors: { probing: 'Probing the wrack', prying: 'Twisting a mussel open', piping: 'Piping display', alarm: 'Alarm-calling', flying: 'Flying' },
    facts: [
      { id: 'wrench-bill', cat: 'Adaptation', q: 'What is its crossed bill tip for?', options: ['Twisting shellfish open like a pair of pliers', 'Fighting', 'Catching flies'], answer: 0, text: 'It jams the crossed tips into the gape of a mussel and twists its head; the cross works like a lever and pops the shell open.', evidence: [ph('shellwrench', 'prying')], hint: 'Watch one on the wrack line until it finds a mussel.' },
      { id: 'wrench-pipe', cat: 'Behaviour', q: 'Why do two shellwrenches run side by side, bills down, piping?', options: ['It is a territorial display between neighbours', 'They are courting a seal', 'They are hunting together'], answer: 0, text: 'Piping is how neighbours settle borders on the wrack line without fighting: lots of noise, no damage.', evidence: [ph('shellwrench', 'piping')], hint: 'Watch two neighbours meet.' },
    ],
    research: {
      habitat: 'The wrack line of rotting kelp and shells along the landing beach, the grove and the stream mouth; nests on the shingle.',
      diet: 'Mussels, limpets and worms. It probes the wrack and the sand under it with its bill.',
      anatomy: 'A long, slim, laterally flattened bill whose upper and lower tips cross over each other. Orange carpal spurs on the wrists are used to hammer limpets off rocks and in fights.',
      ecology: 'Leaves middens of opened shells. Shares the wrack line with kelp skinks.',
      behaviour: 'Probes and pries all day; pipes at its neighbours; alarm-calls at anything walking up the beach and flies off low along the shore.',
      notes: ['It flew off yelling at me. Fair.', 'The bill really does cross. Like a crossbill, but for shellfish.'],
      status: 'Fairly common; pairs hold territories along the beach.',
    },
  },
  {
    id: 'kelpskink', name: 'Kelp Skink', sci: 'Oligosoma phycophilum', group: 'Reptile', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '14 cm', blurb: 'A copper-striped skink of the wrack line with ruffled flaps of skin down its sides that look exactly like torn kelp fronds. It basks with the flaps spread and hides by pressing into the drift until it is just another strand of seaweed.',
    behaviors: { basking: 'Basking', hunting: 'Hunting hoppers', hiding: 'Hiding in the kelp', displaying: 'Throat display' },
    facts: [
      { id: 'skink-bask', cat: 'Adaptation', q: 'Why does it spread its kelp flaps while basking?', options: ['The flaps are full of blood vessels that soak up heat', 'To look bigger to birds', 'To dry them out'], answer: 0, text: 'Spread flat in the sun the flaps work like solar panels and warm the skink up fast enough to hunt.', evidence: [ph('kelpskink', 'basking')], hint: 'Warm drift on a sunny morning.' },
      { id: 'skink-hide', cat: 'Behaviour', q: 'How does the Kelp Skink hide?', options: ['It lies flat in the wrack and looks like a strand of kelp', 'It burrows', 'It swims away'], answer: 0, text: 'It dashes into the drift and presses its flaps down; even shellwrenches walk right past.', evidence: [ph('kelpskink', 'hiding')], hint: 'Startle one, then look closely where it went.' },
    ],
    research: {
      habitat: 'Rotting kelp and drift on the wrack line, and the warm rocks of the west point and the cove.',
      diet: 'Sand-hoppers, kelp flies and small beetles, stalked and pounced on.',
      anatomy: 'Ruffled skin flaps along the flanks and tail, coloured and shaped like torn kelp. Males have an orange throat they flare in display.',
      ecology: 'Hunts the same hoppers as swashrunners; hunted by shellwrenches and hawks.',
      behaviour: 'Basks, hunts, hides. Males head-bob at rivals with the orange throat flared.',
      notes: ['I thought it was seaweed until the seaweed blinked.'],
      status: 'Common.',
    },
  },
  {
    id: 'duskwaddler', name: 'Duskwaddler', sci: 'Talpisphenus crepuscularis', group: 'Bird', sites: [], times: ['dusk', 'night'],
    rarity: 2, danger: 0, size: '30 cm', blurb: 'A little flightless seabird whose feathers have turned into a dense shaggy pelt like fur. It fishes all day and comes ashore at dusk, waddles up the beach in single file and digs into the dunes with broad shovel feet.',
    behaviors: { landing: 'Coming ashore', waddling: 'Waddling home', preening: 'Preening', digging: 'Digging its burrow', calling: 'Braying from the burrow' },
    facts: [
      { id: 'waddler-dusk', cat: 'Activity', q: 'Why do duskwaddlers only cross the beach at dusk?', options: ['The half-light hides them from hawks and gulls', 'The sand is cooler', 'To watch the sunset'], answer: 0, text: 'On open sand a flightless bird is an easy target. They wait offshore until the light goes.', evidence: [ph('duskwaddler', 'waddling')], hint: 'Wait on the landing beach as the light goes.' },
      { id: 'waddler-feet', cat: 'Anatomy', q: 'What are its broad webbed shovel feet for?', options: ['Swimming and digging burrows in the dunes', 'Climbing trees', 'Fighting'], answer: 0, text: 'The same broad webs that drive it through the water dig its burrow: it kicks sand out behind it like a dog.', evidence: [ph('duskwaddler', 'digging')], hint: 'Follow one up the beach to its burrow.' },
      { id: 'waddler-fur', cat: 'Adaptation', q: 'Why do its feathers look like fur?', options: ['Hair-like feathers shed water and keep it warm in a damp burrow', 'It is moulting', 'It is a mammal'], answer: 0, text: 'Its feathers have lost their vanes and become fine strands, a pelt that sheds water like fur.', evidence: [ph('duskwaddler', 'landing')], hint: 'Catch one shaking off as it comes out of the surf.' },
    ],
    research: {
      habitat: 'At sea by day; burrows in the dunes behind the landing beach, the camp and the stream mouth.',
      diet: 'Small fish and squid, chased underwater with its stubby flipper-wings.',
      anatomy: 'Hair-like, vane-less feathers form a slate-blue pelt; broad webbed shovel feet with spade claws; a hooked bill with tube nostrils; pale spectacles round big dusk-adapted eyes.',
      ecology: 'Prey for the hawks and gulls that hunt the beach in daylight, which is why it waits for dusk. Its burrows shelter skinks and beetles.',
      behaviour: 'Comes ashore in small groups at dusk, shakes off, waddles in single file to its burrow and digs in; brays from the burrow after dark.',
      notes: ['They walk in a line. Like little commuters.', 'The braying at night is not a ghost. It is the duskwaddlers. Probably.'],
      status: 'Uncommon; small colonies in the dunes.',
    },
  },
  {
    id: 'periscope', name: 'Periscope Octopus', sci: 'Loricopus stylops', group: 'Mollusc', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 3, danger: 0, size: '45 cm', blurb: 'A rock-pool octopus in a suit of armour: its mantle is plated with overlapping shell scutes crusted with coralline and barnacles, so pulled down in its pool it is just another rock. Its eyes ride on long stalks it raises out of the water like periscopes.',
    behaviors: { hiding: 'Disguised as a rock', periscoping: 'Periscoping', peeking: 'Peeking out', hunting: 'Hunting', flashing: 'Ring-flash display' },
    facts: [
      { id: 'scope-eyes', cat: 'Adaptation', q: 'Why are its eyes on stalks?', options: ['It can watch the shore while its body stays hidden under water', 'To see in the dark', 'To scare birds'], answer: 0, text: 'Only the eyestalks break the surface. Nothing on the rim can see it, but it can see everything.', evidence: [ph('periscope', 'periscoping')], hint: 'Approach the west rock pool slowly and wait.' },
      { id: 'scope-armour', cat: 'Anatomy', q: 'What is the armour on its back made of?', options: ['Shell scutes grown from its own skin', 'Stones it glues on', 'A stolen crab shell'], answer: 0, text: 'Its ancestors lost their shell, like other octopuses; this one grew a new one in plates. Coralline algae and barnacles finish the disguise.', evidence: [ph('periscope', 'hiding'), ph('periscope', 'peeking')], hint: 'Photograph it hiding, then again when it climbs up onto the rim.' },
      { id: 'scope-flash', cat: 'Behaviour', q: 'What do the electric blue rings mean?', options: ['A warning: back off', 'It is happy', 'It is about to change colour for camouflage'], answer: 0, text: 'Cornered, it flashes rings of blue across its skin and arms. It is mostly bluff, but you do not want to test it.', evidence: [ph('periscope', 'flashing')], hint: 'Get close while it is out of the water... but not too close.' },
    ],
    research: {
      habitat: 'The big rock pool on the west point, one octopus to a pool.',
      diet: 'Glass crabs and other small crabs, snatched off the rim with one long arm, and limpets prised off the rocks.',
      anatomy: 'Overlapping shell scutes over the mantle; retractable eyestalks with golden eyes and bar-shaped pupils; chromatophore rings that flash electric blue.',
      ecology: 'The top predator of its pool. Glass crabs on the rim are its favourite meal.',
      behaviour: 'Hides as a rock, periscopes, peeks over the rim, hunts with one arm, flashes blue rings when threatened and sinks back out of sight.',
      notes: ['I have been staring at a rock for ten minutes. The rock has been staring back.'],
      status: 'Only one seen so far.',
    },
  },
  {
    id: 'twinfan', name: 'Twinfan', sci: 'Diplorhipis flabellans', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '16 cm', blurb: 'A little bush flycatcher whose tail is split into two separate fans, upper and lower, which it flares alternately to flush insects out of the leaves. It follows anyone walking through the bush to eat the bugs their footsteps stir up.',
    behaviors: { following: 'Following you', fanning: 'Fan-flushing', hawking: 'Hawking insects', calling: 'Calling' },
    facts: [
      { id: 'twinfan-follow', cat: 'Behaviour', q: 'Why does the twinfan follow people through the bush?', options: ['Footsteps flush out insects', 'It is curious', 'It wants crumbs'], answer: 0, text: 'Walkers kick up moths and flies. The twinfan just hangs around and eats them.', evidence: [ph('twinfan', 'following'), ph('twinfan', 'hawking')], hint: 'Walk the bush track and look around you.' },
      { id: 'twinfan-fans', cat: 'Anatomy', q: 'What are its two tail fans for?', options: ['Flaring them flushes hidden insects out of the leaves', 'Steering in fast flight only', 'Attracting mates only'], answer: 0, text: 'It flicks the upper and lower fans open in turn; the flash of white and the draught startle insects off the leaves.', evidence: [ph('twinfan', 'fanning')], hint: 'Catch it with both fans open on a twig.' },
    ],
    research: {
      habitat: 'The bush along the track above the cove.',
      diet: 'Moths, flies and small beetles caught on the wing.',
      anatomy: 'A split tail of two independent fans, dark with white tips and edges; rictal bristles round a broad little bill.',
      ecology: 'Follows walkers, seals and anything else that stirs up insects.',
      behaviour: 'Flits from twig to twig around you, fans its tails, sallies out after insects and comes straight back.',
      notes: ['It has followed me for a kilometre. I think we are friends now.'],
      status: 'Common in the bush.',
    },
  },
  {
    id: 'starweb', name: 'Starweb Weaver', sci: 'Astronema speluncae', group: 'Insect', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 2, danger: 0, size: '3 cm', blurb: 'The glowing fisher-grub of the sea cave: a glassy green larva in a silk hammock under the roof, with a blue-green lantern in its tail and a star of sticky fishing lines beaded with glowing droplets hanging round it.',
    behaviors: { glowing: 'Glowing', fishing: 'Reeling in a catch', dimmed: 'Lights out' },
    facts: [
      { id: 'starweb-glow', cat: 'Diet', q: 'Why does the starweb weaver glow?', options: ['To lure insects onto its sticky lines', 'To see in the dark', 'To scare bats'], answer: 0, text: 'Midges and moths fly toward the light and stick to the beaded lines. The grub reels them up and eats them.', evidence: [ph('starweb', 'glowing'), ph('starweb', 'fishing')], hint: 'Look up inside the sea cave, and be patient.' },
      { id: 'starweb-dim', cat: 'Behaviour', q: 'Why does the whole colony go dark at once?', options: ['A loud disturbance: the grubs switch their lights off to hide', 'They are tired', 'The tide came in'], answer: 0, text: 'Running, splashing, even a camera shutter: the colony dims together and slowly lights up again when it is quiet.', evidence: [ph('starweb', 'dimmed')], hint: 'Make some noise in the cave. Then wait.' },
    ],
    research: {
      habitat: 'The roof of the sea cave, out of the wind and always damp.',
      diet: 'Midges, small moths and the cave\'s own adult weavers, caught on sticky fishing lines.',
      anatomy: 'A glassy segmented larva with a bioluminescent lantern in the tail, lying in a silk hammock and letting down a radial "star" of beaded lines.',
      ecology: 'The adults have no mouths and live only a few days; many end up on their relatives\' lines.',
      behaviour: 'Glows in slow synchronised waves; reels in a catch hand over hand; the colony dims together when disturbed.',
      notes: ['A whole sky on the cave roof.', 'Joshu walked straight through this. I need to talk to him about priorities.'],
      status: 'One colony, in the sea cave.',
    },
  },
];

// V9 field guide: the open-ocean animals seen from the Kittiwake's deck on Day 1 (painted in
// src/art/v9/sea, alive in src/game/v4/seafauna.ts). Entries use the shared Species format (see
// ../species.ts); the `research` sheet is what MoriOS shows once a photo has been uploaded.
// Every behaviour key here is one the deck critters report to the camera.

import type { Species } from '../species';
import { ph } from './ev';
// register the painters at boot so the field guide can show their icons before the deck scene loads
import '../../art/v9/sea';

export const SEA9: Species[] = [
  {
    id: 'vanebill', name: 'Fluting Vanebill', sci: 'Anemorhynchus tibicen', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 2, danger: 0, size: '3.4 m wingspan',
    blurb: 'A white ocean wanderer with a coral keel standing on its bill like a weather vane, and wings that lock at three joints. Its tube nostrils whistle as it swings into the wind, so you often hear one before you see it.',
    behaviors: { soaring: 'Dynamic soaring', fluting: 'Fluting into the wind', snatching: 'Snatching a kitefish', resting: 'Resting on the swell', skypointing: 'Sky-pointing display', takeoff: 'Running take-off' },
    facts: [
      { id: 'vane-soar', cat: 'Adaptation', q: 'How does the vanebill cross whole oceans without flapping?', options: ['It climbs into the wind and glides down it, again and again', 'It rides the boat’s slipstream', 'It sleeps on the water most of the day'], answer: 0, text: 'Dynamic soaring: wind is slower near the waves, so each climb into the wind and dive down it harvests a little energy. Three locked wing joints hold the long wing rigid without effort.', evidence: [ph('vanebill', 'soaring')], hint: 'Photograph it looping round the mast.' },
      { id: 'vane-flute', cat: 'Anatomy', q: 'What makes the vanebill’s whistle?', options: ['Wind across the tips of its tube nostrils', 'Its bill clacking shut', 'Feathers vibrating'], answer: 0, text: 'The paired tubes on its bill end in open flute holes. Turned into the wind, they pipe a note; the keel on the bill keeps the head pointed true, like a vane.', evidence: [ph('vanebill', 'fluting')], hint: 'Listen for the whistle as it climbs into the wind, then shoot.' },
      { id: 'vane-diet', cat: 'Diet', q: 'What does the vanebill hunt over open water?', options: ['Kitefish in mid-glide', 'Gulls', 'Kelp'], answer: 0, text: 'It plucks Whiptail Kitefish out of the air when they burst from the swell, a meal that never has to be dived for.', evidence: [ph('vanebill', 'snatching'), ph('kitefish', 'gliding')], hint: 'Watch it when the kitefish fly.' },
    ],
    research: {
      habitat: 'Open Southern Ocean, far from land. Follows ships for hours, circling the mast and the wake.',
      diet: 'Kitefish snatched in mid-glide, squid and offal skimmed from the surface.',
      anatomy: 'Wings with an extra "knuckle" joint, so each locks at elbow, wrist and knuckle (a horny hinge spur marks each); on the water they fold into a Z-pack along the back. A bony coral keel on the bill acts as a wind vane. Tube nostrils double as salt glands and flutes.',
      ecology: 'Top aerial predator of the kitefish. Has no real enemies in the air; Sackjaw Gulls mob it to make it drop food.',
      behaviour: 'Soars in great figure-eights, climbing into the wind and gliding down it. Rests on the swell drifting with the current, sky-points and flutes to its mate, and takes off with a long running patter across the water.',
      notes: ['Heard it before I saw it: a low two-note whistle as it turned into the wind. Joshu says it’s good luck. Joshu says a lot of things are good luck.', 'Three joints per wing. That’s one more than it needs and I love it.', 'The keel on the bill always points into the wind. It’s a living weathervane.'],
      status: 'Uncommon. Usually one bird per ship.',
    },
  },
  {
    id: 'sackjaw', name: 'Sackjaw Gull', sci: 'Saccolarus furax', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '1.2 m wingspan',
    blurb: 'A loud grey gull with a serrated bill and a stretchy orange throat sack. It begs, it steals, it shouts at its neighbours, and it is absolutely certain your lunch belongs to it.',
    behaviors: { hovering: 'Hanging on the wind', begging: 'Begging', stealing: 'Stealing bait', perched: 'Perched on the boat', displaying: 'Sack display', swimming: 'Riding the wake', flying: 'Flying' },
    facts: [
      { id: 'sack-pouch', cat: 'Anatomy', q: 'What is the Sackjaw’s throat sack for?', options: ['Carrying stolen food and shouting down rivals', 'Floating', 'Keeping its eggs warm'], answer: 0, text: 'The elastic sack stretches to hold a whole fish, so a thief can grab and go. Blown up like a balloon, it is a threat display to other gulls.', evidence: [ph('sackjaw', 'displaying'), ph('sackjaw', 'stealing')], hint: 'Watch two gulls that land on the same rail, and keep an eye on your bait.' },
      { id: 'sack-beg', cat: 'Behaviour', q: 'Why do Sackjaws hang over the stern of a boat?', options: ['Bait, scraps and stunned fish', 'The engine is warm', 'They are lost'], answer: 0, text: 'A boat is a moving buffet: bait, scraps, and fish churned up in the wake. A head wind lets them hang in the air for free.', evidence: [ph('sackjaw', 'begging')], hint: 'Stand at the stern and see who comes.' },
      { id: 'sack-bill', cat: 'Adaptation', q: 'Why are the edges of its bill serrated?', options: ['To grip slippery fish', 'To saw rope', 'To look scary'], answer: 0, text: 'Rows of tiny horny teeth along the cutting edges hold a wriggling fish like a bread knife holds a crust.', evidence: [ph('sackjaw', 'perched')], hint: 'Get a close shot of one sitting on the rail.' },
    ],
    research: {
      habitat: 'Coasts and shipping lanes; follows fishing boats far offshore.',
      diet: 'Anything: bait, scraps, fish stolen from other birds, stranded crabs, and lice picked off the backs of basking Reefbacks.',
      anatomy: 'A heavy hooked bill with serrated tomia and a red gape spot that chicks peck to beg; a stretchy gular sack that can hold a whole fish or balloon to twice the size of the head; a pale eye in a red orbital ring.',
      ecology: 'Kleptoparasite: it lives by robbing others. Mobs the Fluting Vanebill until it drops its catch. Picks crown lice off Reefbacks, which may be the closest it gets to doing anyone a favour.',
      behaviour: 'Kites over the stern on the wind, begs loudly at anyone holding food, perches on rails and roofs, and squabbles with sack displays when another gull lands too close. Rides the wake on the water between raids.',
      notes: ['It looked me in the eye and stole my bait. Directly. No shame.', 'Two of them blew their throat sacks up at each other on the stern rail. It went on for some time.', 'Jenna’s fish counter thinks they’re clouds. They are not clouds.'],
      status: 'Common. Very, very common.',
    },
  },
  {
    id: 'scythewing', name: 'Scythewing Petrel', sci: 'Xiphoptera fluctisecans', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
    rarity: 1, danger: 0, size: '18 cm',
    blurb: 'Sparrow-sized petrels whose outer wing feathers are fused into one stiff, glossy blade. Flocks skim so low over the swell that the blades slice the wave tops.',
    behaviors: { skimming: 'Skimming the swell', wheeling: 'Wheeling flock', pattering: 'Pattering on the water', rafting: 'Rafting' },
    facts: [
      { id: 'scythe-blade', cat: 'Adaptation', q: 'Why does the Scythewing cut the tops of the waves?', options: ['The cut stirs up plankton it can snatch', 'To cool its wings', 'To scare fish into the air'], answer: 0, text: 'The fused keratin blade is stiff enough to slice a crest without catching; the cut flicks tiny animals to the surface right in front of the flock.', evidence: [ph('scythewing', 'skimming')], hint: 'Photograph the flock low over the swell.' },
      { id: 'scythe-flash', cat: 'Behaviour', q: 'Why does the whole flock turn at once?', options: ['A flash of white undersides confuses predators', 'They follow the oldest bird', 'The wind turns them'], answer: 0, text: 'When the flock wheels, every bird shows its white underwing in the same instant: a flicker that makes it hard for a hunter to pick out one target.', evidence: [ph('scythewing', 'wheeling')], hint: 'Catch the moment the flock turns.' },
      { id: 'scythe-patter', cat: 'Diet', q: 'What are they doing when they hang over one spot, feet down?', options: ['Pattering: walking on the water to pick up plankton', 'Drinking', 'Washing their feet'], answer: 0, text: 'With wings held up and long legs dangling, they patter across the surface picking plankton and fish eggs from the film.', evidence: [ph('scythewing', 'pattering')], hint: 'Wait for the flock to stop over the water.' },
    ],
    research: {
      habitat: 'The open swell, often over the bow wave of a boat or where porpoises feed.',
      diet: 'Plankton, fish eggs and tiny shrimp from the surface film.',
      anatomy: 'Outer primaries fused into a single scythe-shaped keratin blade; short, stiff, swept-back wings. Long legs with yellow-webbed feet for pattering. A bright white rump band.',
      ecology: 'Follows feeding Moonfin pods and Reefbacks for the plankton they stir up. Hunted by Sackjaws when it rafts.',
      behaviour: 'Flocks of ten to a hundred skim, wheel and patter together. Rafts on the water to rest, then lifts off in one burst.',
      notes: ['Like a handful of thrown knives.', 'Every time the flock turned, it blinked white. I took forty photos of the blink.'],
      status: 'Abundant in flocks.',
    },
  },
  {
    id: 'moonfin', name: 'Moonfin Porpoise', sci: 'Lampocetus selenopterus', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 2, danger: 0, size: '1.4 m',
    blurb: 'A small, stocky porpoise with a round pale "moon" fin and two lines of glowing photophores along each flank. Pods love to surf the bow wave of a moving boat.',
    behaviors: { bowriding: 'Bow-riding', porpoising: 'Porpoising', breaching: 'Spinning breach', tailslapping: 'Tail-slapping', swimming: 'Swimming' },
    facts: [
      { id: 'moon-bow', cat: 'Behaviour', q: 'Why does the pod ride just ahead of the bow?', options: ['The pressure wave pushes them along for free', 'They are guiding the boat', 'To clean their skin on the hull'], answer: 0, text: 'The bow wave is a free ride: they surf it with barely a flick of the flukes. Mostly, it seems, because it’s fun.', evidence: [ph('moonfin', 'bowriding')], hint: 'Stand at the bow while the engine runs.' },
      { id: 'moon-glow', cat: 'Anatomy', q: 'What are the glowing lines on its flanks?', options: ['Photophores full of glowing bacteria, for keeping formation in the dark', 'Scars', 'Reflections of the water'], answer: 0, text: 'Symbiotic bacteria in two lines of skin pockets glow blue-green. At night the pod keeps formation by them and uses them to herd lanternfish.', evidence: [ph('moonfin', 'porpoising')], hint: 'Get a sharp shot of one in mid-leap.' },
      { id: 'moon-fin', cat: 'Adaptation', q: 'What is the round moon fin for?', options: ['Dumping heat after a sprint, and flagging its position', 'Steering', 'Storing fat'], answer: 0, text: 'The disc is a thin sheet of skin over a dense net of blood vessels: a radiator for a fast animal in cold water, and a flag the rest of the pod can see.', evidence: [ph('moonfin', 'breaching')], hint: 'Watch for a high, spinning leap.' },
    ],
    research: {
      habitat: 'Cold, open water; bow waves; around kelp rafts and feeding Reefbacks.',
      diet: 'Lanternfish, squid and Whiptail Kitefish (they chase the kitefish into the air).',
      anatomy: 'A disc-shaped dorsal "moon" fin packed with blood vessels; two lines of bacterial photophores along each flank; a blunt melon and a short smiling beak; a white belly patch and a dark eye mask.',
      ecology: 'Drives kitefish out of the water, which feeds the vanebill too. Scythewings follow its pods for the stirred-up plankton.',
      behaviour: 'Pods of three to eight. Bow-ride, porpoise in low arcs, breach with a spin, and slap their tails on the surface, possibly to stun fish, possibly to show off.',
      notes: ['They came to the bow the moment I stood there. I’m choosing to believe they like me.', 'The glow lines are visible even in daylight if you look just under the surface.'],
      status: 'Common in pods.',
    },
  },
  {
    id: 'kitefish', name: 'Whiptail Kitefish', sci: 'Tetrapterichthys flagellicauda', group: 'Fish', sites: [], times: ['day'],
    rarity: 2, danger: 0, size: '40 cm',
    blurb: 'A flying fish with four barred, kite-like wings and a tail that runs out into a long whip. It glides over the swell, dips the whip into a crest and sculls off again without landing.',
    behaviors: { launching: 'Bursting out of the swell', gliding: 'Gliding', skipping: 'Skipping a crest' },
    facts: [
      { id: 'kite-skip', cat: 'Adaptation', q: 'How does a kitefish stretch one flight across several waves?', options: ['It dips its whip tail into a crest and sculls back up', 'It flaps its wings', 'It bounces off the water on its belly'], answer: 0, text: 'The long lower tail lobe works like an outboard motor: dropped into a wave top, a few strokes relaunch the glide.', evidence: [ph('kitefish', 'skipping')], hint: 'Follow one through a whole flight.' },
      { id: 'kite-why', cat: 'Behaviour', q: 'Why do kitefish burst out ahead of the boat?', options: ['To escape what is hunting them: the hull, porpoises, tuna', 'To see where they are going', 'To catch insects'], answer: 0, text: 'The bow and the hunting Moonfins flush them. In the air they vanish from fish that hunt underwater; the vanebill knows this trick too.', evidence: [ph('kitefish', 'launching')], hint: 'Watch the water ahead of the bow.' },
    ],
    research: {
      habitat: 'The surface layer of the open sea, in schools.',
      diet: 'Plankton and tiny shrimp.',
      anatomy: 'Huge pectoral fins and a second, smaller pair of pelvic fins, all with barred membranes; a whip-like lower tail lobe tipped with an orange flag; big eyes adapted to see in air and water.',
      ecology: 'Prey for nearly everything: Moonfins below, the Fluting Vanebill above, Sackjaws when they land.',
      behaviour: 'Schools burst out of the swell together, glide up to 80 metres, and skip crests with the whip.',
      notes: ['They don’t fly, they kite. Four wings, one tail, zero chill.', 'Saw the vanebill take one out of the air. Nature is beautiful and also terrible.'],
      status: 'Common.',
    },
  },
  {
    id: 'reefback', name: 'Reefback', sci: 'Hortocetus insularis', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 4, danger: 1, size: '30 m',
    blurb: 'A colossal, slow grazer whose back is a living reef: barnacle terraces, coral crust, anemones and kelp, with a whole crowd of riders. It breathes through two snorkels on its head and blows a splayed double plume.',
    behaviors: { surfacing: 'Surfacing', basking: 'Basking', spouting: 'Spouting', rolling: 'Rolling, flipper up', fluking: 'Fluke-up dive' },
    facts: [
      { id: 'reef-snork', cat: 'Anatomy', q: 'Why does the Reefback breathe through snorkels?', options: ['So it can rest with its reef just under the surface', 'To smell food', 'To call to its calf'], answer: 0, text: 'Its two blowholes sit on fleshy tubes that it raises like snorkels. It can lie with its back barely awash for hours, keeping the garden wet, and the blow comes out as a split double plume.', evidence: [ph('reefback', 'spouting')], hint: 'Watch the horizon for a double blow.' },
      { id: 'reef-garden', cat: 'Ecology', q: 'Why would an animal grow a reef on its back?', options: ['Armour, camouflage, and a moving oasis that draws fish to it', 'It cannot clean itself', 'For warmth'], answer: 0, text: 'From below, the reef looks like drifting kelp; the crust is armour; and the fish that shelter in its garden are the snacks it grazes between kelp meadows.', evidence: [ph('reefback', 'basking')], hint: 'Get a good look at its back while it rests at the surface.' },
      { id: 'reef-riders', cat: 'Ecology', q: 'What hangs from its flukes when it dives?', options: ['Pennant leeches, metre-long parasites', 'Kelp', 'Fishing nets'], answer: 0, text: 'The ribbons dangling from the flukes and flippers are Pennant Leeches. Crown lice crowd round its snorkels. A reef carries its pests too.', evidence: [ph('reefback', 'fluking'), ph('pennantleech', 'dangling')], hint: 'Photograph the fluke-up dive, and look closely.' },
    ],
    research: {
      habitat: 'Open ocean between seamount kelp meadows; it drifts on currents for weeks.',
      diet: 'Floating kelp rafts and seamount meadows, cropped with a horny rasp-plate instead of teeth; the small fish that shelter in its own garden.',
      anatomy: 'A thick, pitted skin that larvae settle on; two snorkel blowholes on the head; a rough white callosity round them; barnacle-crusted flippers; flukes as wide as the Kittiwake is long.',
      ecology: 'A whole floating ecosystem: barnacles, coralline algae, anemones, kelp, crabs and fish live on it; Scythewings and Moonfins follow it for the plankton it stirs; Sackjaws pick its lice. Parasites: Crown Lice and Pennant Leeches.',
      behaviour: 'Surfaces with water sheeting off the reef, basks with the snorkels up, blows every few minutes, sometimes rolls a flipper into the air, then lifts its flukes and dives for half an hour.',
      notes: ['I thought it was an island. Then the island breathed.', 'Jenna asked if something like this could have hit the boat. I said no. I hope I’m right.', 'There were crabs on it. On the whale. The whale has crabs.'],
      status: 'Rare. Only seen far out, and once, close.',
    },
  },
  {
    id: 'crownlouse', name: 'Crown Louse', sci: 'Cyamops coronarius', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 0, size: '4 cm',
    blurb: 'Pale orange, crab-like lice that crowd the rough white callosity round a Reefback’s snorkels, grazing its skin. A whole colony lives and dies on one host.',
    behaviors: { swarming: 'Swarming the crown' },
    facts: [
      { id: 'louse-crown', cat: 'Ecology', q: 'Why do crown lice gather round the snorkels?', options: ['The rough callosity gives them grip and the blow keeps it wet', 'They eat the air', 'It’s warmer there'], answer: 0, text: 'The callosity is a craggy patch of thick skin: perfect grip on a host that never stops moving. They graze dead skin and the algae that grow in its cracks.', evidence: [ph('crownlouse', 'swarming')], hint: 'Zoom in on the Reefback’s head when it comes up close.' },
    ],
    research: {
      habitat: 'Only on Reefbacks: the callosity round the snorkels, and scars along the back.',
      diet: 'Dead skin, mucus and algae on the host.',
      anatomy: 'Flattened, crab-like amphipods with hooked claws on every leg; no swimming stage once they settle.',
      ecology: 'Parasite (or at worst a nuisance) of the Reefback. Eaten by Sackjaw Gulls that land on basking Reefbacks.',
      behaviour: 'Crowds in a crawling crust; mothers carry their young in a brood pouch, so a colony spreads only when Reefbacks touch.',
      notes: ['The white patch on its head moved. It moved because it was covered in lice. Science is not always pretty.'],
      status: 'Common, on its host.',
    },
  },
  {
    id: 'pennantleech', name: 'Pennant Leech', sci: 'Vexillobdella hortoceti', group: 'Parasite', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
    rarity: 3, danger: 0, size: '1.2 m',
    blurb: 'A flat, dark-red ribbon of a leech that anchors to a Reefback’s thin skin behind the flippers and on the flukes, and streams in the current like a flag.',
    behaviors: { trailing: 'Trailing from the flank', dangling: 'Dangling from fluke or flipper' },
    facts: [
      { id: 'leech-flag', cat: 'Adaptation', q: 'Why is the pennant leech so long and flat?', options: ['A long flat body hangs in the current without tearing loose', 'To look like kelp', 'To glide'], answer: 0, text: 'Anchored by a single sucker ring, its ribbon body streams behind the host like a pennant, with almost no drag to tear it off.', evidence: [ph('pennantleech', 'trailing')], hint: 'Look along the Reefback’s flanks while it basks close by.' },
      { id: 'leech-where', cat: 'Ecology', q: 'Where on the Reefback do the leeches attach?', options: ['Where the skin is thin: behind the flippers and on the flukes', 'In its mouth', 'On the barnacles'], answer: 0, text: 'The reef crust is too hard to bite. The thin skin behind the flippers and on the flukes is where blood runs close to the surface.', evidence: [ph('pennantleech', 'dangling')], hint: 'Watch the flukes as it dives, or a flipper when it rolls.' },
    ],
    research: {
      habitat: 'On Reefbacks: thin skin behind the flippers, the tail stock and the flukes.',
      diet: 'Blood. It turns from dark red to purple as it fills.',
      anatomy: 'A ribbon body up to 1.2 m long, a single sucker ring at the head end, no rear sucker; the edges ripple to keep it from twisting in the current.',
      ecology: 'Parasite of the Reefback. Drops off to breed in kelp rafts.',
      behaviour: 'Hangs and streams; strings of them dangle from the flukes when the host dives.',
      notes: ['Those weren’t ribbons of kelp on the tail. They were leeches. Metre-long leeches.', 'I have decided not to go swimming today.'],
      status: 'Common, on its host.',
    },
  },
];

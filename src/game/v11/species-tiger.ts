// V11 field guide: the Cerebral Tiger, the great forest's ambush predator (art: src/art/v11/tiger.ts,
// behaviour: ./predators-tiger.ts). Shared Species format (see ../species.ts); this module also gives
// the wildlife brain its ecology entry, the encyclopedia its fun fact and food-web links, and defines
// the slingshot tool (Aroha's blueprint; the blueprints module crafts it).
//
// Imported by ../species.ts (so the guide, the camera and the research log know the species from boot).

import type { Species } from '../species';
import { ECO } from '../wild/ecology';
import { ITEMS, defineItem } from '../items';
import { registerBeast } from '../../art/beasts';
import { TIGER_DEF } from '../../art/v11/tiger';
import { FUN } from '../../ui/v10/funfacts';
import { WEB } from '../../ui/v10/foodweb';

export const TIGER_ID = 'cerebraltiger';

registerBeast(TIGER_ID, TIGER_DEF);

const ph = (behavior: string) => ({ kind: 'photo' as const, species: TIGER_ID, behavior });
const vid = (behavior: string) => ({ kind: 'video' as const, species: TIGER_ID, behavior });

export const TIGER_SPECIES: Species = {
  id: TIGER_ID, name: 'Cerebral Tiger', sci: 'Cerebrotigris pelophilus', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 4, danger: 3, size: '3.4 m long, about 400 kg',
  blurb: 'A tiger built like a hippo: a barrel of a body slung low on short, massive legs, caked in mud from the elbows down. Over its small eyes rises a high domed brow, striped in a maze that looks exactly like a brain. It lies under the forest wallows with only its eyes, ears and nostrils showing, and it thinks before it moves.',
  behaviors: {
    lurking: 'Lurking in the mud', stalking: 'Stalking', charging: 'Charging', roaring: 'Roaring', wallowing: 'Wallowing',
    shaking: 'Shaking off mud', prowling: 'Prowling',
  },
  facts: [
    {
      id: 'ctiger-lurk', cat: 'Behaviour', q: 'How does the Cerebral Tiger hunt?', options: ['It lies under a mud wallow and bursts out', 'It runs prey down over long distances', 'It drops on prey from the trees'], answer: 0,
      text: 'It lies submerged in a wallow with only its eyes, ears and nostrils above the mud, waits for something to come close, and erupts.',
      evidence: [ph('lurking')], hint: 'Photograph the eyes in the mud. From far away. Very carefully.',
    },
    {
      id: 'ctiger-dome', cat: 'Anatomy', q: 'What is the domed brow for?', options: ['A sinus that throws its roar through mud and ground', 'A bigger brain', 'Storing fat for the dry season'], answer: 0,
      text: 'The dome is mostly air: a resonating sinus that makes its roar boom through the mud and the forest floor. The brain-like maze over it is just stripes.',
      evidence: [ph('roaring')], hint: 'Photograph it roaring. You will know when.',
    },
    {
      id: 'ctiger-mud', cat: 'Adaptation', q: 'Why does it spend so long in the mud?', options: ['The mud cools it, keeps the flies off and hides its smell', 'It is digging for roots', 'It cannot walk on dry ground'], answer: 0,
      text: 'A coat of mud keeps a heavy animal cool, keeps the biting flies off, and hides its scent from what it hunts. Its eyes, ears and nostrils seal shut when it goes under.',
      evidence: [ph('wallowing'), ph('shaking')], hint: 'Watch one in a wallow, and when it comes out.',
    },
    {
      id: 'ctiger-deter', cat: 'Behaviour', q: 'What makes a Cerebral Tiger back off?', options: ['A sharp sting on the brow and a lot of noise', 'Running away fast', 'Lying down and keeping still'], answer: 0,
      text: 'It is an ambush hunter that hates a fair fight. Stung on the brow, shouted at and peppered, it backs into the mud to think it over. Running only tells it you are prey.',
      evidence: [vid('charging')], hint: 'Record one charging. Aroha knows the rest.',
    },
  ],
  research: {
    habitat: 'The mud wallows and wet hollows of Te Wao Nui, the great forest inland of the beach. It moves between wallows along old animal paths under the tree ferns.',
    diet: 'Big, slow prey: Forest Bonefaces at the wallows, Shieldbacks (it cracks them like eggs), Quillhogs (carefully). It eats a huge meal, then lies up in the mud for days.',
    anatomy: 'Built for mud. A low, heavy barrel of a body on short, enormously strong legs; wide paws with four splayed, webbed toes that spread its weight on soft ground; eyes raised on bony turrets, nostrils on top of the snout and ears that fold flat, all three sealing shut when it goes under; a thick, muscular tail it sculls with. The high domed brow is a resonating sinus. The short, sleek coat sheds mud as it dries.',
    ecology: 'The forest’s top ambush predator. Bonefaces wallow in the same mud and keep a nervous lookout; Monarchs follow it for its leftovers; Moss Frogs breed in its abandoned wallows. Nothing on the island hunts it.',
    behaviour: 'Solitary. It spends the hot hours under the mud and prowls at dawn and dusk. It stalks low, then charges in a short, crushing rush and a pounce. If the first rush fails it rarely presses on: stung, shouted at or peppered, it retreats into the mud to try again another day.',
    notes: [
      'It shut its EARS. Like a door. Then it was gone and the mud was flat again.',
      'Aroha says it remembers faces. Wonderful. Great. Love that for me.',
      'Do not run. Do not run. Do not... I ran. Do not do what I did.',
      'The maze on its forehead is only stripes. I checked. From a distance. With a long lens.',
    ],
    status: 'Rare, and very dangerous',
  },
};

// the wildlife brain: a bold, patient ambush hunter (its acts live in ./predators-tiger.ts)
ECO[TIGER_ID] = {
  loco: 'walker', medium: 'ground', walk: 20, run: 150, bold: 0.97, aggro: 0.85, curious: 0.25, social: 0, alert: 0.75,
  sight: 240, hear: 1.3, flightDist: 0, food: [], prey: ['boneface', 'shieldback', 'quillhog'], fears: [], defense: ['charge'],
  attacksPlayer: 0.9, group: [1, 1], calls: { threat: 'callGrowl' }, size: 6,
  idle: [
    { act: 'lurk', w: 4, poi: 'mud', dur: [25, 45] }, { act: 'prowl', w: 2.5, dur: [10, 18] }, { act: 'wallow', w: 1.5, poi: 'mud', dur: [12, 22] },
    { act: 'rest', w: 1, dur: [6, 12] },
  ],
  photo: {
    lurk: 'lurking', stalk: 'stalking', charge: 'charging', attack: 'charging', pounce: 'charging', roar: 'roaring', threat: 'roaring',
    wallow: 'wallowing', shake: 'shaking', prowl: 'prowling', wander: 'prowling', hunt: 'stalking', retreat: 'prowling',
  },
};

FUN[TIGER_ID] = 'The “brain” on its forehead is only stripes, but the dome under them is hollow: its roar comes up through the ground, and you feel it in your feet before you hear it.';
WEB.push(
  [TIGER_ID, 'eats', 'boneface', 'ambushes them at the wallows'],
  [TIGER_ID, 'eats', 'shieldback', 'cracks them like eggs'],
  [TIGER_ID, 'eats', 'quillhog', 'very carefully'],
  ['monarch', 'partner', TIGER_ID, 'cleans up its leftovers'],
  ['mossfrog', 'partner', TIGER_ID, 'breeds in its old wallows'],
);

// the slingshot (the blueprints module adds the recipe; defined here too so the tool exists from boot)
if (!ITEMS.slingshot) {
  defineItem({ id: 'slingshot', name: 'Slingshot', kind: 'tool', stack: 1, weight: 0.3, desc: 'A forked mānuka frame, a band cut from the wreck’s inner tube and a leather pouch: Aroha’s design. Press G to ready it, hold to draw, release to let fly. A sharp sting on the brow sends most predators back where they came from.' });
}

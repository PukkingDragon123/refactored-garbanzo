// V12 The Claw and the Plume: the field guide's two new giants of the backcountry (art:
// src/art/v12/feud/bearer.ts and the plumeboa look in src/art/fauna.ts; behaviour: ./bearer.ts,
// ./plumeboa.ts, ./director.ts). Shared Species format (see ../../species.ts, which imports this
// module so the guide, the camera and the research log know both from boot); this module also gives
// the wildlife brain its ecology entries and the encyclopedia its fun facts and food-web links.
//
// Photo behaviours (the act -> behaviour map is ECO[...].photo below):
//   bearer    clawdisplay (rearing, claw spread; the swipe), pin, fight, steal, cache, dig, sleep,
//             eating, roaming, sniffing, charging, roaring
//   plumeboa  constrict, ruff (the threat display), fight, steal, swallow, ambush, gliding, striking

import type { Species } from '../../species';
import { ECO } from '../../wild/ecology';
import { registerBeast } from '../../../art/beasts';
import { BEARER_DEF } from '../../../art/v12/feud/bearer';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';

export const BEARER_ID = 'bearer';
export const PLUMEBOA_ID = 'plumeboa';
/** what both of them hunt (and fight over): the backcountry's big grazers */
export const FEUD_PREY = ['torhopper', 'boneface', 'quillhog', 'shieldback'];

registerBeast(BEARER_ID, BEARER_DEF);

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });
const vid = (species: string, behavior: string) => ({ kind: 'video' as const, species, behavior });

export const BEARER_SPECIES: Species = {
  id: BEARER_ID, name: 'Bearer', sci: 'Ungulursus falcifer', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 5, danger: 3, size: '4.6 m long, 2.4 m at the hump; standing, over 4 m. About 900 kg',
  blurb: 'Matikuku Nui, the great claw. A shaggy brown giant built like a bear crossed with a ground sloth, with a hump of muscle over the shoulders and one foreleg ending in a single hooked claw as long as a man is tall. It walks on its knuckles with the claw folded back along its arm. It is a serpent-eater: it hunts the big boas, and steals what they kill.',
  behaviors: {
    clawdisplay: 'Claw display', pin: 'Pinning a kill', fight: 'Fighting', steal: 'Stealing a kill', cache: 'Caching food', dig: 'Digging',
    sleep: 'Sleeping', eating: 'Eating', roaming: 'Roaming', sniffing: 'Following a scent', charging: 'Charging', roaring: 'Roaring',
  },
  facts: [
    {
      id: 'bearer-pin', cat: 'Adaptation', q: 'What is the Bearer’s great claw for?', options: ['Pinning a big serpent and hooking it behind the skull', 'Digging burrows', 'Climbing trees'], answer: 0,
      text: 'Matikuku Nui kills a boa with one hook: it pins the serpent’s head with its weight and drives the claw in behind the skull, out of reach of the coils.',
      evidence: [ph(BEARER_ID, 'pin')], hint: 'Photograph the claw coming down on something. From very far away.',
    },
    {
      id: 'bearer-steal', cat: 'Ecology', q: 'Where does the Bearer get most of its meat?', options: ['It steals the feathered boa’s kills', 'It runs down torhoppers', 'It fishes the rivers'], answer: 0,
      text: 'It is slow and loud, so it rarely catches anything itself. It follows its nose to a fresh boa kill, drives the boa off, and drags the carcass away.',
      evidence: [ph(BEARER_ID, 'steal')], hint: 'Watch a boa make a kill, and wait for the smell to carry.',
    },
    {
      id: 'bearer-cache', cat: 'Behaviour', q: 'What does it do with a kill it can’t finish?', options: ['Buries it in a cache and comes back for it', 'Leaves it for the scavengers', 'Carries it up a tree'], answer: 0,
      text: 'It scrapes a hollow, drags the carcass in and heaps earth, sticks and fern over it, then sleeps nearby. The boas know where the caches are.',
      evidence: [ph(BEARER_ID, 'cache'), ph(BEARER_ID, 'dig')], hint: 'Follow one that is dragging a kill.',
    },
    {
      id: 'bearer-display', cat: 'Behaviour', q: 'How does a Bearer warn you off?', options: ['It rears up, spreads the claw and roars', 'It hides and waits', 'It stamps the ground'], answer: 0,
      text: 'Before it swipes it rears up on its hind legs to twice a man’s height and holds the great claw high. It is a warning. Take it.',
      evidence: [ph(BEARER_ID, 'clawdisplay')], hint: 'It only does it when something gets too close. Use a long lens.',
    },
    {
      id: 'bearer-sleep', cat: 'Activity', q: 'When is a Bearer at its most dangerous?', options: ['When it is woken next to its cache', 'At midday', 'In the rain'], answer: 0,
      text: 'After a big meal it sleeps for hours on top of, or right beside, its cache. Woken, it comes up fighting.',
      evidence: [ph(BEARER_ID, 'sleep')], hint: 'Find one asleep. Do not wake it.',
    },
  ],
  research: {
    habitat: 'Te Tuawhenua, the backcountry: gorges, burnt ridges and the wet fern gullies where the big boas live. It keeps a den under an overhang and a few caches round it.',
    diet: 'Serpents first: big boas, and their kills. Anything a boa has caught, a Bearer will try to take. Roots, grubs and carrion between times.',
    anatomy: 'A hump of muscle over the shoulders to drive the claw, a deep chest, short heavy hind legs. The great claw on the right hand grows all its life, like a fingernail: it folds back along the forearm when it walks and locks open to strike. The coat is long and shaggy, frosted at the tips. A bare ridge of bone guards the small eyes from a striking serpent.',
    ecology: 'The backcountry’s top predator and its biggest thief. The feathered boa is its rival and its main source of meat; boa bites scar its shoulders, claw scars line the boas. Ravens and weka follow it for scraps.',
    behaviour: 'Solitary. It roams slowly with its nose low, rears and roars rather than fights when it can, and drives rivals off kills by sheer size. Once it has a kill it drags it to a cache and sleeps on it.',
    notes: [
      'The claw is longer than I am. I checked. I did not get close enough to check properly.',
      'Old bite scars across its shoulder, in neat curved rows. Something with a mouth that wide bit it, and lost.',
      'It walks on its knuckles. The claw just rides along, folded up, like a pocket knife.',
      'Aroha says when the elders saw one rear up they called it “the tree that walks”.',
    ],
    status: 'Rare. Very dangerous at close quarters',
  },
};

export const PLUMEBOA_SPECIES: Species = {
  id: PLUMEBOA_ID, name: 'Giant Feathered Boa', sci: 'Plumaconstrictor magnificus', group: 'Serpent', sites: [], times: ['dawn', 'day', 'dusk'],
  rarity: 4, danger: 3, size: '18 m long, thick as a man’s waist',
  blurb: 'Huruhuru. Here the serpents took the birds’ place, and this one wears the plumage to prove it: a barred bronze body with a fringe of feathers down the spine, a crest on the crown and a ruff behind the head that it throws up into a blazing frill. It lies in ambush for the big grazers, crushes them in its coils and swallows them whole.',
  behaviors: {
    constrict: 'Constricting', ruff: 'Ruff display', fight: 'Fighting', steal: 'Stealing a kill', swallow: 'Swallowing',
    ambush: 'Lying in ambush', gliding: 'Gliding through the grass', striking: 'Striking',
  },
  facts: [
    {
      id: 'plumeboa-ruff', cat: 'Behaviour', q: 'What is the boa’s ruff for?', options: ['It is a display: raised to warn rivals off', 'It keeps the boa warm', 'It helps it fly'], answer: 0,
      text: 'The plume is a display. Flat, the boa is a bronze shadow in the fern; raised, the ruff turns into a frill of gold, crimson and oil-green eyes that makes it look three times the size.',
      evidence: [ph(PLUMEBOA_ID, 'ruff')], hint: 'Photograph it with the ruff raised. Something has to annoy it first.',
    },
    {
      id: 'plumeboa-constrict', cat: 'Diet', q: 'How does the feathered boa kill?', options: ['It throws its coils round its prey and squeezes', 'It poisons it', 'It drowns it'], answer: 0,
      text: 'It strikes from ambush, grips with its teeth and throws three coils round the animal. Every breath out, the coils tighten.',
      evidence: [ph(PLUMEBOA_ID, 'constrict')], hint: 'Find where it lies in wait. Then wait too.',
    },
    {
      id: 'plumeboa-swallow', cat: 'Diet', q: 'What does it do with a kill when nothing interrupts it?', options: ['Swallows it whole, head first', 'Tears it apart', 'Buries it'], answer: 0,
      text: 'Its jaws unhinge and it walks them over the carcass head first. For days afterwards you can see the shape of the meal moving down its body.',
      evidence: [ph(PLUMEBOA_ID, 'swallow')], hint: 'If the Bearer doesn’t come, the boa eats. Be patient.',
    },
    {
      id: 'plumeboa-feud', cat: 'Ecology', q: 'Who are the Bearer and the boa to each other?', options: ['Rivals that steal each other’s kills', 'Partners that hunt together', 'Predator and prey, nothing more'], answer: 0,
      text: 'Each feeds off the other. The Bearer steals the boa’s kills; the boa raids the Bearer’s caches; when they meet over a carcass they fight, and the loser goes hungry.',
      evidence: [ph(PLUMEBOA_ID, 'fight'), ph(BEARER_ID, 'fight')], hint: 'Photograph them fighting. Both of them, in one frame.',
    },
    {
      id: 'plumeboa-steal', cat: 'Behaviour', q: 'Why does the boa dig up the Bearer’s caches?', options: ['To steal back the meat the Bearer stole', 'To lay its eggs there', 'To hide from hawks'], answer: 0,
      text: 'It knows where the caches are. While the Bearer sleeps it slides in, noses the earth away and drags the carcass off.',
      evidence: [ph(PLUMEBOA_ID, 'steal')], hint: 'Watch a Bearer’s cache. The boa comes when the Bearer sleeps.',
    },
  ],
  research: {
    habitat: 'Te Tuawhenua, the backcountry: the wet fern gullies, river flats and burnt scrub, wherever the big grazers come down to feed and drink.',
    diet: 'Torhoppers, Bonefaces, Quillhogs: anything big enough to be worth the effort. One meal lasts it weeks. And whatever it can steal back from a Bearer’s cache.',
    anatomy: 'A constrictor eighteen metres long. Its scales grew into feathers along the spine and round the head: a barred fringe that sheds water, a crest on the crown, and a ruff of long display plumes over a skin frill it can raise, each tipped with an eye-spot. Heat pits along the lips find warm prey in the fern.',
    ecology: 'One of the backcountry’s two giants. Its rival is the Bearer, which steals its kills and kills boas when it can; their feud keeps the grazers moving and feeds every scavenger in the hills.',
    behaviour: 'An ambush hunter. It lies still for hours, then strikes, coils and squeezes. Threatened, it rears and throws up the ruff with a hiss like a kettle. It will strike if stepped on, and it is very easy to step on.',
    notes: [
      'The feathers move when it breathes. All of them. At once.',
      'It hissed and the whole ruff went up like an umbrella. I sat down without deciding to.',
      'Thick as my waist. Longer than the boat. Feathered. I am fine.',
      'There are claw scars on its side. Old ones. It knows the Bearer.',
    ],
    status: 'Rare',
  },
};

// the wildlife brains (their acts live in ./bearer.ts and ./plumeboa.ts; the feud in ./director.ts)
ECO[BEARER_ID] = {
  loco: 'walker', medium: 'ground', walk: 24, run: 150, bold: 1, aggro: 0.7, curious: 0.3, social: 0, alert: 0.6,
  sight: 260, hear: 1.2, flightDist: 0, food: ['carrion', 'roots', 'grub'], prey: [], fears: [], defense: ['charge'],
  attacksPlayer: 0.8, group: [1, 1], calls: { threat: 'callGrowl' }, size: 7,
  idle: [
    { act: 'wander', w: 2.5, dur: [10, 18] }, { act: 'sniff', w: 1.5, dur: [4, 7] }, { act: 'dig', w: 1, dur: [5, 8] },
    { act: 'sleep', w: 1, dur: [14, 24] },
  ],
  photo: {
    threat: 'clawdisplay', rear: 'clawdisplay', brawl: 'fight', windup: 'clawdisplay', swipe: 'clawdisplay', smash: 'clawdisplay', pin: 'pin', fight: 'fight', steal: 'steal',
    drag: 'steal', cache: 'cache', dig: 'dig', sleep: 'sleep', rest: 'sleep', eat: 'eating', wander: 'roaming', prowl: 'roaming',
    sniff: 'sniffing', charge: 'charging', roar: 'roaring', retreat: 'roaming',
  },
};
ECO[PLUMEBOA_ID] = {
  loco: 'serpent', medium: 'ground', walk: 22, run: 80, bold: 0.95, aggro: 0.6, curious: 0.2, social: 0, alert: 0.5,
  sight: 200, hear: 1, flightDist: 0, food: [], prey: FEUD_PREY.slice(0, 3), fears: [], defense: ['strike'],
  attacksPlayer: 0.5, group: [1, 1], calls: { threat: 'callHiss' }, size: 6,
  idle: [{ act: 'ambush', w: 3, dur: [16, 30] }, { act: 'wander', w: 2, dur: [8, 14] }, { act: 'rest', w: 1, dur: [10, 18] }],
  photo: {
    constrict: 'constrict', threat: 'ruff', ruff: 'ruff', fight: 'fight', brawl: 'fight', steal: 'steal', drag: 'steal', swallow: 'swallow', digest: 'swallow',
    ambush: 'ambush', wander: 'gliding', retreat: 'gliding', strike: 'striking', attack: 'striking',
  },
};

FUN[BEARER_ID] = 'Its great claw never stops growing. A Bearer that can’t find enough boas to wear it down on ends up walking on the tip, like a man in shoes three sizes too long.';
FUN[PLUMEBOA_ID] = 'Every feather on the boa is a scale that kept growing. The eye-spots on its ruff are in the same place on every boa in the backcountry, and Bearers have learned to swipe below them.';
WEB.push(
  [BEARER_ID, 'robs', PLUMEBOA_ID, 'takes its kills'],
  [PLUMEBOA_ID, 'robs', BEARER_ID, 'raids its caches'],
  [BEARER_ID, 'eats', PLUMEBOA_ID, 'pins it and hooks it behind the skull'],
  [PLUMEBOA_ID, 'eats', 'torhopper', 'ambushes them at the gully mouths'],
  [PLUMEBOA_ID, 'eats', 'boneface', 'crushes them in its coils'],
  [BEARER_ID, 'eats', 'torhopper', 'mostly stolen'],
);

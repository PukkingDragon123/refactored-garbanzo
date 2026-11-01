// V12 Te Rua Pōuri's own animals for the field guide (art: src/art/v12/cave/beasts.ts), with their
// ecology entries and their minds (the scene side: the lantern, the ripples, the hits, catching a
// salamander: ./life.ts):
//
//   Blind Salamander  pale, eyeless, gilled, in the stream pools. It feels light on its skin and hates
//                     it: a bright lantern near the pool and it is gone under the ledge. Shutter the
//                     lantern, keep still, and after a while they come out again.
//   Ghost Gulper      the giant of the lake (legendary). It lurks deep, sensed by its ripples and its
//                     bubbles. Light and footsteps at the shore draw it in. Its TELL: rings closing in
//                     on one spot, then bubbles; then it rises, gapes, and lunges at the shore. Lure it
//                     with the lantern hung on the caver's pole (or bait) and hide: then it gapes long
//                     enough for the photo of its life.
//   Cave Wētā         on every wall. The big ones jump at a bright lantern (the tell: the crouch, the
//                     antennae swept forward). Shutter it, or step back.
//   Cave Harvestman   on stilts, harmless; bobs in a blur when bothered.
//   Cave Centipede    the gallery's hunter (a rare spot): rears with its claws open, bites if crowded.
//
// Imported by ../../species.ts (so the guide, the camera and the research log know them from boot).

import type { Species } from '../../species';
import { ECO } from '../../wild/ecology';
import { SPECIALS, HOOKS } from '../../wild/animal';
import type { Animal } from '../../wild/animal';
import { registerBeast } from '../../../art/beasts';
import { BLINDSAL, GULPER, CAVEWETA, HARVESTMAN, CENTIPEDE } from '../../../art/v12/cave/beasts';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';
import { rand, clamp } from '../../../core/math';
import { POOLS, TIERS, LAKE, floorOf, poolTop, SPOT } from './layout';
import './items';

export const SAL_ID = 'blindsal', GULPER_ID = 'gulper', WETA_ID = 'caveweta', HARV_ID = 'harvestman', CENT_ID = 'cavecentipede';
registerBeast(SAL_ID, BLINDSAL);
registerBeast(GULPER_ID, GULPER);
registerBeast(WETA_ID, CAVEWETA);
registerBeast(HARV_ID, HARVESTMAN);
registerBeast(CENT_ID, CENTIPEDE);
// (the quests come in after boot, free of the import cycle through the quest list)
setTimeout(() => { void import('./quests').then(m => m.registerCaveQuests()); }, 0);

export type LureKind = 'pole' | 'bait' | 'mori';
/** what the cave scene tells its animals, and what they ask of it (./life.ts fills it in) */
export const CAVE_CTX = {
  /** how strongly the bright lantern reaches (x, y): 0 none .. 1 right in it */
  lit: (_x: number, _y: number): number => 0,
  /** Mori moving about near (x, y): 0 still .. 1 stomping past */
  stir: (_x: number, _y: number): number => 0,
  /** seconds Mori has been still with the lantern shuttered (or hung on the pole) */
  calmT: 0,
  hidden: (): boolean => false,
  /** what draws the Gulper, where, how strongly per second (null: nothing) */
  lure: (): { x: number; k: number; kind: LureKind } | null => null,
  /** the Gulper's signs: rings on the surface (closing in for the tell), bubbles, its sounds */
  ring: (_x: number, _r: number, _inward: boolean): void => {},
  bubbles: (_x: number, _n: number, _big: boolean): void => {},
  rumble: (_a: Animal): void => {},
  surface: (_a: Animal): void => {},
  gape: (_a: Animal): void => {},
  /** the snap: the scene decides what it caught */
  gulp: (_a: Animal, _x: number, _kind: LureKind): void => {},
  /** the big wētā's crouch, and its landing on Mori */
  wetaWind: (_a: Animal): void => {},
  wetaHit: (_a: Animal): boolean => false,
  /** the centipede's warning and its bite */
  rear: (_a: Animal): void => {},
  bite: (_a: Animal): void => {},
};

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });

// ================================================================== the field guide
export const BLINDSAL_SPECIES: Species = {
  id: SAL_ID, name: 'Blind Salamander', sci: 'Proteus zealandicus', group: 'Amphibian', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 4, danger: 0, size: '30 cm long, lighter than an egg',
  blurb: 'A salamander that never comes out of the dark: long as an eel, pale pink and nearly see-through, with no eyes at all and three feathery scarlet gills each side of its head. It lives in the still pools of Te Rua Pōuri\'s dark stream and feels light on its skin. Bring a bright lantern and it is gone.',
  behaviors: { gills: 'Breathing through its gills', swimming: 'Swimming', resting: 'Resting on the pool bed', hunting: 'Snapping up a springtail', fleeing: 'Fleeing the light' },
  facts: [
    {
      id: 'bs-eyes', cat: 'Adaptation', q: 'Why has the Blind Salamander no eyes?', options: ['In total darkness eyes are useless, so over many generations they shrank away under the skin', 'It lost them in fights', 'Its eyes are on the underside of its head'], answer: 0,
      text: 'Eyes are costly to grow and to keep. In a cave with no light at all, the salamanders with smaller eyes did just as well and spent less doing it. The eyes are still there as specks under the skin, like an old address.',
      evidence: [ph(SAL_ID, 'resting'), ph(SAL_ID, 'gills')], hint: 'A clear side-on photo, close. You will need to shutter the lantern and wait by the pool.',
    },
    {
      id: 'bs-gills', cat: 'Anatomy', q: 'Why does it keep its feathery gills all its life?', options: ['It never finishes growing up: it stays in its larval shape and breeds that way', 'It is still a baby', 'The gills are for smelling'], answer: 0,
      text: 'Most salamanders lose their gills when they leave the water. This one never leaves it, so it never bothers to change. Biologists call that neoteny: staying young forever. The gills are red because you are seeing its blood through the thinnest skin it has.',
      evidence: [ph(SAL_ID, 'gills')], hint: 'Photograph one still in the water, breathing. The gills flutter.',
    },
    {
      id: 'bs-light', cat: 'Behaviour', q: 'How does an animal with no eyes know your lantern is on?', options: ['Its skin has light-sensitive cells: it feels light, and light means danger', 'It hears the flame', 'It smells the lamp oil'], answer: 0,
      text: 'Even without eyes it can tell light from dark through its skin. Out in the light it would be easy to see, and down here nothing good comes with light. It flees from a bright lantern and comes back when the dark does.',
      evidence: [ph(SAL_ID, 'fleeing')], hint: 'Walk up to a pool with the lantern bright, camera ready.',
    },
    {
      id: 'bs-starve', cat: 'Diet', q: 'How long can a Blind Salamander go without eating?', options: ['Years: it lives so slowly that one springtail can last it weeks', 'One day', 'It never eats'], answer: 0,
      text: 'Food is rare in a cave. It has the slowest life it can manage: it hardly moves, it grows for decades, and it can live a hundred years. It eats springtails, shrimp and anything that falls in the pool.',
      evidence: [ph(SAL_ID, 'hunting')], hint: 'Watch one by the surface where the springtails hop. Patience.',
    },
  ],
  research: {
    habitat: 'The still pools of Te Rua Pōuri\'s dark stream, and the plunge pool under the falls. Never in the light, never out of the water.',
    diet: 'Springtails off the water\'s skin, blind shrimp, worms, and whatever the stream washes down. Slowly.',
    anatomy: 'An eel\'s body on four tiny legs, three fingers in front and two toes behind. Skin so thin the blood and the gut show through; no pigment at all. A flat spade of a snout. Feathery external gills kept for life. Eyes shrunk to specks under the skin.',
    ecology: 'The top predator of the stream pools, and prey for nothing but the Ghost Gulper when it strays into the lake. Its eggs hang under the stones of the pools.',
    behaviour: 'Hangs still in the water for hours, breathing. Feels light through its skin: a bright lamp sends it under the ledges, and it comes out again when the dark and the quiet come back.',
    notes: [
      'No eyes. None. Just a smudge under the skin where eyes should be. And it STILL knew I was there.',
      'Aroha says Koro calls them ngā tamariki a te kēhua: the ghost\'s children. I don\'t like what that makes the big one.',
      'You have to sit in the dark with them. Lantern shut. Breathe slow. Then they come back, one by one.',
    ],
    status: 'Only in Te Rua Pōuri',
  },
};

export const GULPER_SPECIES: Species = {
  id: GULPER_ID, name: 'Ghost Gulper', sci: 'Andrias megastomus', group: 'Amphibian', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 5, danger: 3, size: '4.5 m long, heavier than the dinghy',
  blurb: 'A giant salamander the length of three men, living in the black lake at the bottom of Te Rua Pōuri. Pale as a drowned moon and nearly see-through, with skin hanging in wrinkled folds, two pinprick eyes it cannot see with, frilled gills behind its head and a paddle of a tail. Its mouth runs right across its head and opens into a cavern you could stand up in. It comes to light, and to footsteps.',
  behaviors: { lurking: 'Lurking under the black water', swimming: 'Swimming', rising: 'Rising to the surface', opening: 'Opening its jaws', gaping: 'Gaping wide (the megamouth)', gulping: 'Gulping' },
  facts: [
    {
      id: 'gg-pale', cat: 'Adaptation', q: 'Why is the Ghost Gulper so pale you can almost see through it?', options: ['In a place with no light, colour is wasted: it never needed pigment to hide or to signal', 'It is a ghost', 'It is sick'], answer: 0,
      text: 'Colour is for being seen or not being seen, and down here nobody sees anything. Over a long time in the dark it lost its pigment, like every other animal of Te Rua Pōuri. What you see through it is its blood and its gut.',
      evidence: [ph(GULPER_ID, 'lurking'), ph(GULPER_ID, 'swimming')], hint: 'Watch the lake from the shore. It shows as a pale shape under the water.',
    },
    {
      id: 'gg-light', cat: 'Behaviour', q: 'What brings the Ghost Gulper to the shore?', options: ['Light and vibration: moths and wētā drawn to light fall in, and anything stamping on the shore might be food', 'It wants to come out of the water', 'It is curious about people'], answer: 0,
      text: 'In the dark the lake gives very little. Whatever falls into it is a meal: moths that flutter at the glowworms, wētā that miss their footing, the caver\'s lantern once. It has learned that light and footsteps mean something to eat.',
      evidence: [ph(GULPER_ID, 'rising')], hint: 'Rings closing in on one spot, then bubbles. Then it comes up. Be ready, and be well back.',
    },
    {
      id: 'gg-pouch', cat: 'Anatomy', q: 'What is the great pleated pouch under its jaw for?', options: ['Suction: it opens its mouth so fast the pouch balloons and sucks in water and prey together', 'To store air', 'To carry its eggs'], answer: 0,
      text: 'Like other giant salamanders it feeds by suction. The jaw drops, the pleated throat balloons, and the water rushes in carrying whatever was in front of it. The megamouth simply does it bigger than anything else alive.',
      evidence: [ph(GULPER_ID, 'gaping')], hint: 'The photo of a lifetime: its mouth fully open. Lure it to the shore and hide.',
    },
    {
      id: 'gg-sense', cat: 'Adaptation', q: 'How does it hunt with eyes like pinpricks?', options: ['Sense organs along its head and sides feel the smallest ripple in the water', 'It smells everything', 'Echolocation, like a bat'], answer: 0,
      text: 'Rows of pits along its head and flanks feel pressure waves in the water: a moth struggling on the surface, a foot on the shingle. That is why it comes to footsteps. And why you should stop moving.',
      evidence: [ph(GULPER_ID, 'gulping')], hint: 'Photograph the snap. From a safe distance. Please.',
    },
  ],
  research: {
    habitat: 'Te Waha o te Pō, the black lake at the bottom of Te Rua Pōuri. Cold, still, deep water under a roof of glowworms. Probably connected to the sea, far down.',
    diet: 'Blind shrimp, eels from the deep passages, salamanders that stray in, moths and wētā that fall into the lake, and once, the caver\'s lantern. It sucks things in whole.',
    anatomy: 'A giant salamander: a flat head as wide as a doorway with a mouth across its whole front, a pleated throat pouch, tiny milky eyes, frilled gill stalks, loose wrinkled skin (it breathes through its skin as much as its gills), four stout legs and a long paddle of a tail with a fin above and below.',
    ecology: 'The top of the cave\'s food web. Everything in the dark ends up in the lake, and everything in the lake ends up in the Gulper. There is probably only one.',
    behaviour: 'Lurks deep, sensed by its ripples and its bubbles. Comes to light and vibration at the shore. Before it lunges the rings close in on one spot and bubbles rise: back off then. Patient: it will hang under a light for a long time, mouth open, waiting.',
    notes: [
      'It came up out of the black water like a sunrise made of bone. My hands haven\'t stopped shaking.',
      'Its mouth. ITS MOUTH. I could have walked in there standing up.',
      'The caver\'s journal said it took his lantern. I believe him now. Light draws it. So: give it a light that isn\'t me.',
      'Koro\'s word for it is te Kēhua, the ghost. Aroha says it is the kaitiaki of the dark water. I am going to show it a LOT of respect.',
    ],
    status: 'One known animal',
  },
};

export const WETA_SPECIES: Species = {
  id: WETA_ID, name: 'Cave Wētā', sci: 'Pallidoplectron profundum', group: 'Insect', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 1, danger: 1, size: '4 cm body, antennae longer than your hand',
  blurb: 'A humpbacked amber cricket with no wings, banded brown, with antennae three times its length forever feeling the air and enormous spiny hind legs. They crowd the walls of Te Rua Pōuri in their thousands. The big ones jump at a bright light, and they land hard.',
  behaviors: { clinging: 'Clinging to the wall', feeling: 'Feeling the air with its antennae', leaping: 'Leaping', feeding: 'Feeding' },
  facts: [
    {
      id: 'cw-ant', cat: 'Adaptation', q: 'Why are a cave wētā\'s antennae so long?', options: ['In the dark it feels its way: the antennae taste and touch everything long before its body arrives', 'To catch moths', 'To keep its balance when it jumps'], answer: 0,
      text: 'Its eyes are small and nearly useless down here. The antennae are its eyes: covered in touch and taste sensors, they map the rock, find food and warn it of anything moving.',
      evidence: [ph(WETA_ID, 'feeling')], hint: 'A side-on photo of one on the wall, antennae out.',
    },
    {
      id: 'cw-jump', cat: 'Behaviour', q: 'Why does the big cave wētā jump at your lantern?', options: ['It leaps away from danger blindly: the heat and the light startle it and it jumps toward the brightest thing', 'It wants to eat the flame', 'It is defending its eggs'], answer: 0,
      text: 'A startled wētā fires its huge hind legs and goes wherever it was pointing. Pointing at the lantern, it flies straight at you. Shutter the lantern and it calms down.',
      evidence: [ph(WETA_ID, 'leaping')], hint: 'Bright lantern near a big one: watch for the crouch. Then duck, or dim.',
    },
    {
      id: 'cw-crowd', cat: 'Ecology', q: 'Why do cave wētā crowd together on the walls?', options: ['Together they keep in the damp air: a crowd loses less water than one alone', 'They are cold', 'They are waiting for the sun'], answer: 0,
      text: 'Cave air is damp but a wētā can still dry out. Packed together they share the moisture. At night many of them walk out to the mouth of the cave to feed, and back before dawn.',
      evidence: [ph(WETA_ID, 'clinging')], hint: 'Any wall of the wētā hall.',
    },
  ],
  research: {
    habitat: 'Every wall of Te Rua Pōuri, thickest in the wētā hall and the mouth. Some walk out at night to feed in the bush.',
    diet: 'Anything: fungi, dead insects, bat leavings, each other.',
    anatomy: 'No wings, a humped body for leaping, antennae three times its length, long spiny hind legs with drumstick thighs. Small eyes.',
    ecology: 'The cave\'s great middlemen: they bring food in from outside. Eaten by centipedes, harvestmen and anything in the lake they fall into.',
    behaviour: 'Clings in crowds, antennae waving. Startled, it leaps blindly. Big ones leap at bright lights.',
    notes: ['THOUSANDS of them. On every wall. All waving at me.', 'One jumped on my FACE. Note to self: shutter the lantern near the big ones.'],
    status: 'Everywhere in the cave',
  },
};

export const HARV_SPECIES: Species = {
  id: HARV_ID, name: 'Cave Harvestman', sci: 'Phalangium tenebrarum', group: 'Arachnid', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 2, danger: 0, size: 'a body like a lentil on legs as long as a pencil',
  blurb: 'Not a spider: a harvestman, one round little body slung between eight legs as thin as hairs, knees high. Bother one and it bounces its body up and down so fast it blurs.',
  behaviors: { resting: 'Resting', walking: 'Walking on its stilts', bobbing: 'Bobbing (its defence)' },
  facts: [
    {
      id: 'hm-spider', cat: 'Anatomy', q: 'How do you tell a harvestman from a spider?', options: ['One round body (a spider has two parts), two eyes, and no silk at all', 'It has six legs', 'It is bigger'], answer: 0,
      text: 'Spiders have a waist between two body parts, eight eyes and silk. Harvestmen are one round piece, have two eyes on a little turret, and never spin a thread.',
      evidence: [ph(HARV_ID, 'resting'), ph(HARV_ID, 'walking')], hint: 'A close side-on photo.',
    },
    {
      id: 'hm-bob', cat: 'Behaviour', q: 'Why does it bounce up and down when you come close?', options: ['The blur makes it hard to grab and hard to see where it really is', 'It is dancing', 'It is shaking off water'], answer: 0,
      text: 'A body vibrating in a blur is a hard target. A cluster of them all bobbing together looks like the wall itself is moving.',
      evidence: [ph(HARV_ID, 'bobbing')], hint: 'Get close with the lantern bright, camera up.',
    },
  ],
  research: {
    habitat: 'Walls and floors of the cave\'s middle halls, often in clusters.',
    diet: 'Small insects, springtails, fungus, scraps. It tastes with its legs.',
    anatomy: 'One round body, two eyes on a turret, eight hair-thin legs it can drop to escape (they grow back).',
    ecology: 'Eats the smallest things; eaten by centipedes.',
    behaviour: 'Walks slowly on its stilts; bobs in a blur when bothered.',
    notes: ['Legs like hairs. How does it even stand up?'],
    status: 'Common in the cave',
  },
};

export const CENT_SPECIES: Species = {
  id: CENT_ID, name: 'Cave Centipede', sci: 'Scolopendra lucifuga', group: 'Myriapod', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 4, danger: 2, size: '25 cm, forty legs',
  blurb: 'The hunter of the crystal gallery: a flat amber body banded dark, forty legs moving in a wave, long feelers, and under its head a pair of curved venom claws. It only comes out of the cracks when the gallery is dark and quiet.',
  behaviors: { hunting: 'Hunting', threat: 'Rearing, claws open', resting: 'Resting in a crack' },
  facts: [
    {
      id: 'cc-claws', cat: 'Anatomy', q: 'What are the curved claws under its head?', options: ['Its first pair of legs, turned into venom fangs', 'Its jaws', 'Its antennae'], answer: 0,
      text: 'A centipede\'s venom claws are not mouthparts: they are legs, the first pair, changed over a very long time into hollow fangs.',
      evidence: [ph(CENT_ID, 'threat')], hint: 'It rears when you crowd it. Photograph it then, and step back.',
    },
    {
      id: 'cc-hunt', cat: 'Diet', q: 'What does the Cave Centipede hunt?', options: ['Cave wētā, much bigger than its head, grabbed and held with its claws', 'Fungus', 'Salamanders'], answer: 0,
      text: 'It runs down wētā on the walls, wraps them in its legs and holds on while the venom works.',
      evidence: [ph(CENT_ID, 'hunting')], hint: 'Wait for it in the dark gallery and watch it hunt.',
    },
  ],
  research: {
    habitat: 'The cracks of the crystal gallery, Te Ana Tioata. Hates light.',
    diet: 'Cave wētā, harvestmen, anything it can hold.',
    anatomy: 'Twenty pairs of legs, the first pair venom claws; long feelers; a flat body to fit cracks.',
    ecology: 'The top hunter of the walls.',
    behaviour: 'Comes out in the dark; rears with claws open when crowded; bites if you stay.',
    notes: ['Forty legs. I counted. From a distance.'],
    status: 'Rare: the crystal gallery',
  },
};

// ================================================================== where a cave animal is
const ALL = ['dawn', 'day', 'dusk', 'night'] as const;
interface Keep { tier: string; big: boolean; cool: number; interest: number; strikeX: number; kind: 'pole' | 'bait' | 'mori'; t: number }
const KEEP = new WeakMap<Animal, Keep>();
export function caveKeep(a: Animal): Keep {
  let k = KEEP.get(a);
  if (!k) {
    // the tier it was put on: the walk line nearest under it
    let tier = 't0', bd = 1e9;
    for (const t of TIERS) {
      if (a.x < t.x0 - 10 || a.x > t.x1 + 10) continue;
      const d = Math.abs(floorOf(t.id, clamp(a.x, t.x0, t.x1)) - a.y);
      if (d < bd && a.y < floorOf(t.id, clamp(a.x, t.x0, t.x1)) + 30) { bd = d; tier = t.id; }
    }
    k = { tier, big: a.species === WETA_ID && Math.abs(a.x - SPOT.bigWeta) < 40, cool: 0, interest: 0, strikeX: LAKE.x0, kind: 'mori', t: 0 };
    if (k.big) a.scale = 1.7;
    KEEP.set(a, k);
  }
  return k;
}
const tierOf = (a: Animal) => TIERS.find(t => t.id === caveKeep(a).tier) ?? TIERS[0];
const floorAt = (a: Animal, x: number) => { const t = tierOf(a); return floorOf(t.id, clamp(x, t.x0, t.x1)); };

// ================================================================== the Blind Salamander's mind
ECO[SAL_ID] = {
  loco: 'swimmer', medium: 'water', walk: 10, run: 60, bold: 0.2, aggro: 0, curious: 0, social: 0, alert: 0.9,
  sight: 0, hear: 0.6, flightDist: 0, food: [], defense: ['flee'], group: [1, 1], calls: {}, size: 1,
  idle: [{ act: 'drift', w: 3, dur: [4, 9] }, { act: 'swim', w: 2, dur: [3, 6] }, { act: 'rest', w: 2, dur: [5, 10] }, { act: 'hunt', w: 1.4, dur: [3, 5] }],
  photo: { drift: 'gills', swim: 'swimming', rest: 'resting', hunt: 'hunting', flee: 'fleeing', emerge: 'swimming' },
};
const poolOf = (a: Animal) => {
  const mid = (a.home[0] + a.home[1]) / 2;
  return POOLS.find(p => mid >= p.x0 - 20 && mid <= p.x1 + 20) ?? POOLS[0];
};
/** a point in its pool: x in the water, y between the skin of the water and the bed */
const inPool = (a: Animal, x: number, depth: number): [number, number] => {
  const p = poolOf(a), top = poolTop(p);
  const xx = clamp(x, p.x0 + 10, p.x1 - 10);
  const bed = floorOf(p.tier, xx) - 1.5;
  return [xx, clamp(top + 3 + (bed - top - 3) * depth, top + 3, Math.max(top + 3, bed))];
};
const swimTo = (a: Animal, tx: number, ty: number, sp: number, dt: number) => {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const s = Math.min(d, sp * dt);
  a.x += (dx / d) * s; a.y += (dy / d) * s;
  a.vx = (dx / d) * sp;
  if (Math.abs(dx) > 0.5) a.facing = dx > 0 ? 1 : -1;
  return false;
};
/** too much light or too much stomping: back under the ledge */
const scared = (a: Animal) => CAVE_CTX.lit(a.x, a.y) > 0.32 || CAVE_CTX.stir(a.x, a.y) > 0.55;
SPECIALS[SAL_ID] = {
  drift(a, dt) {
    a.anim = 'idle'; a.hidden = 0;
    if (a.mem.tx === undefined) { const [x, y] = inPool(a, a.x + rand.range(-14, 14), rand.range(0.3, 0.9)); a.mem.tx = x; a.mem.ty = y; }
    swimTo(a, a.mem.tx, a.mem.ty, 3, dt);
    if (a.actT > a.actDur) return false;
  },
  swim(a, dt) {
    a.anim = 'swim'; a.hidden = 0;
    if (a.mem.tx === undefined) { const p = poolOf(a); const [x, y] = inPool(a, rand.range(p.x0, p.x1), rand.range(0.2, 1)); a.mem.tx = x; a.mem.ty = y; }
    if (swimTo(a, a.mem.tx, a.mem.ty, 14, dt) || a.actT > a.actDur) return false;
  },
  rest(a, dt) {
    a.anim = 'rest'; a.hidden = 0;
    const [x, y] = inPool(a, a.x, 1);
    swimTo(a, x, y, 4, dt);
    if (a.actT > a.actDur) return false;
  },
  hunt(a, dt) {
    a.hidden = 0;
    const [x, y] = inPool(a, a.x + a.facing * 6, 0);
    const there = swimTo(a, x, y + 1, 8, dt);
    a.anim = there && a.actT % 1.6 < 0.3 ? 'snap' : 'swim';
    if (there && a.actT % 1.6 < 0.02) a.host.sfx('bubble', a.x, 0.12, 2.2);
    if (a.actT > a.actDur) return false;
  },
  /** away from the light, fast, to the far end of the pool and under its ledge */
  flee(a, dt) {
    a.anim = 'flee'; a.hidden = Math.min(0.5, a.hidden);
    if (a.mem.tx === undefined) {
      const p = poolOf(a), mx = a.host.player.x;
      const far = Math.abs(mx - p.x0) > Math.abs(mx - p.x1) ? p.x0 + 8 : p.x1 - 8;
      const [x, y] = inPool(a, far, 1); a.mem.tx = x; a.mem.ty = y;
    }
    if (swimTo(a, a.mem.tx, a.mem.ty, 46, dt)) { a.setAct('hide', 8); return; }
  },
  /** under the ledge: nearly out of sight, until the dark and the quiet come back */
  hide(a) {
    a.anim = 'rest'; a.vx = 0;
    a.hidden = Math.min(0.94, a.hidden + 0.05);
    if (!a.mem.need) a.mem.need = rand.range(3.2, 6.5);
    if (!scared(a) && CAVE_CTX.calmT > a.mem.need) { a.setAct('emerge', 2.2); return; }
    if (a.actT > a.actDur) a.actDur = a.actT + 4;
  },
  emerge(a, dt) {
    a.anim = 'walk';
    a.hidden = Math.max(0, a.hidden - dt * 0.6);
    const p = poolOf(a);
    const [x, y] = inPool(a, (p.x0 + p.x1) / 2 + rand.range(-8, 8), 0.7);
    swimTo(a, x, y, 5, dt);
    if (a.actT > a.actDur) { a.hidden = 0; return false; }
  },
  sleep(a) { a.setAct('rest', 6); },
};
HOOKS[SAL_ID] = {
  ...(HOOKS[SAL_ID] ?? {}),
  onThreat(a) { a.fear = 0; return true; },
  decide(a) {
    // (its own scripted acts end themselves: the generic mind must not pick a new one under them)
    if (a.act === 'flee' || a.act === 'hide' || a.act === 'emerge') return true;
    if (scared(a) && CAVE_CTX.calmT < 1) { a.setAct('flee', 4); a.host.sfx('splash', a.x, 0.12, 2.4); return true; }
    return false;
  },
  tick(a) { a.fear = 0; caveKeep(a); },
};

// ================================================================== the Ghost Gulper's mind
ECO[GULPER_ID] = {
  loco: 'swimmer', medium: 'water', walk: 18, run: 60, bold: 1, aggro: 0, curious: 0, social: 0, alert: 0.4,
  sight: 0, hear: 1.4, flightDist: 0, food: [], defense: ['dive'], group: [1, 1], calls: {}, size: 8,
  idle: [{ act: 'lurk', w: 4, dur: [10, 20] }, { act: 'swim', w: 1.5, dur: [8, 14] }],
  photo: { lurk: 'lurking', swim: 'swimming', tell: 'lurking', approach: 'swimming', rise: 'rising', gape: 'opening', gapeHold: 'gaping', gulp: 'gulping', sink: 'swimming' },
};
/** the depths it keeps (the anchor is the belly): deep, just under, head up out of it */
const DEEP = 104, SHALLOW = 58, UP = 40;
/** the anchor sits this far behind the snout when it faces the shore with its jaws open */
const SNOUT = 112;
const gy = (d: number) => LAKE.top + d;
const lurkX = [1060, 2240] as const;
SPECIALS[GULPER_ID] = {
  lurk(a, dt) {
    a.anim = 'lurk'; a.hidden = 0.7; a.alpha = 0.9;
    if (a.mem.tx === undefined) { a.mem.tx = rand.range(lurkX[0], lurkX[1]); a.mem.bt = rand.range(2, 5); }
    const dx = a.mem.tx - a.x;
    if (Math.abs(dx) > 4) { a.x += Math.sign(dx) * Math.min(Math.abs(dx), 6 * dt); a.facing = dx > 0 ? 1 : -1; }
    a.y += (gy(DEEP) - a.y) * Math.min(1, dt * 1.2);
    // it is sensed before it is seen: a slow ring now and then, a few bubbles from its gills
    a.mem.bt -= dt;
    if (a.mem.bt <= 0) { a.mem.bt = rand.range(3, 7); CAVE_CTX.bubbles(a.x + a.facing * 60, rand.int(2, 4), false); if (rand.chance(0.5)) CAVE_CTX.ring(a.x + a.facing * 40, 26, false); }
    if (a.actT > a.actDur) return false;
  },
  swim(a, dt) {
    a.anim = 'swim'; a.hidden = 0.45; a.alpha = 0.9;
    if (a.mem.tx === undefined) a.mem.tx = rand.range(lurkX[0], lurkX[1]);
    const dx = a.mem.tx - a.x;
    a.facing = dx > 0 ? 1 : -1;
    a.x += Math.sign(dx) * Math.min(Math.abs(dx), 22 * dt);
    a.y += (gy(SHALLOW + 16) - a.y) * Math.min(1, dt);
    if (rand.chance(dt * 1.5)) CAVE_CTX.ring(a.x - a.facing * 90, 34, false);
    if (Math.abs(dx) < 4 || a.actT > a.actDur) return false;
  },
  /** drawn in: deep under the water toward the place it will strike */
  approach(a, dt) {
    const k = caveKeep(a);
    a.anim = 'swim'; a.hidden = 0.6;
    const tx = k.strikeX + SNOUT;
    a.facing = -1;
    const dx = tx - a.x;
    a.x += Math.sign(dx) * Math.min(Math.abs(dx), 34 * dt);
    a.y += (gy(DEEP - 10) - a.y) * Math.min(1, dt);
    if (Math.abs(dx) < 3) { a.setAct('tell', 2.8); return; }
    if (a.actT > 30) return false;
  },
  /** the TELL: rings closing in on the spot, then bubbles boiling up there */
  tell(a, dt) {
    const k = caveKeep(a);
    a.anim = 'lurk'; a.hidden = 0.55; a.facing = -1;
    a.y += (gy(SHALLOW) - a.y) * Math.min(1, dt * 0.8);
    const t = a.actT;
    if (!a.mem.r0) { a.mem.r0 = 1; CAVE_CTX.rumble(a); }
    if (t < 1.7) { if (Math.floor(t / 0.4) !== Math.floor((t - dt) / 0.4)) CAVE_CTX.ring(k.strikeX + 8, 44, true); }
    else if (Math.floor(t / 0.2) !== Math.floor((t - dt) / 0.2)) CAVE_CTX.bubbles(k.strikeX + rand.range(-6, 14), 2, true);
    if (t > a.actDur) { a.setAct('rise', 1); CAVE_CTX.surface(a); return; }
  },
  rise(a, dt) {
    a.anim = 'rise'; a.hidden = 0.1; a.alpha = 0.94; a.facing = -1;
    a.y += (gy(UP) - a.y) * Math.min(1, dt * 4);
    if (a.actT > a.actDur) { a.setAct('gape', 1); CAVE_CTX.gape(a); return; }
  },
  /** the jaws coming open */
  gape(a, dt) {
    a.anim = 'gape'; a.hidden = 0; a.alpha = 0.95;
    a.y += (gy(UP) - a.y) * Math.min(1, dt * 4);
    if (a.actT > a.actDur) {
      // a light on a pole that doesn't move: it hangs there gaping, waiting; at Mori it doesn't wait long
      const k = caveKeep(a);
      a.setAct('gapeHold', k.kind === 'mori' ? 1.1 : CAVE_CTX.hidden() ? 3.6 : 2.2);
      return;
    }
  },
  gapeHold(a) {
    a.anim = 'gapeHold'; a.hidden = 0; a.alpha = 0.95;
    if (a.actT > a.actDur) { a.setAct('gulp', 0.6); return; }
  },
  /** the lunge and the snap */
  gulp(a) {
    const k = caveKeep(a);
    a.anim = 'gulp'; a.hidden = 0;
    if (!a.mem.g && a.actT > 0.12) { a.mem.g = 1; CAVE_CTX.gulp(a, k.strikeX, k.kind); }
    if (a.actT > a.actDur) { a.setAct('sink', 1.4); return; }
  },
  sink(a, dt) {
    a.anim = 'sink'; a.hidden = Math.min(0.7, a.hidden + dt * 0.5);
    a.y += (gy(DEEP) - a.y) * Math.min(1, dt * 1.4);
    if (a.actT > a.actDur) { const k = caveKeep(a); k.cool = 16; k.interest = 0; a.setAct('lurk', 12); return; }
  },
  sleep(a) { a.setAct('lurk', 12); },
};
HOOKS[GULPER_ID] = {
  ...(HOOKS[GULPER_ID] ?? {}),
  onThreat(a) { a.fear = 0; return true; },
  decide(a) {
    const k = caveKeep(a);
    if (a.act === 'approach' || a.act === 'tell' || a.act === 'rise' || a.act === 'gape' || a.act === 'gapeHold' || a.act === 'gulp' || a.act === 'sink') return true;
    if (k.cool <= 0 && k.interest >= 1) {
      const L = CAVE_CTX.lure();
      if (L) { k.strikeX = L.x; k.kind = L.kind; a.setAct('approach', 30); return true; }
    }
    return false;
  },
  tick(a, dt) {
    const k = caveKeep(a);
    a.fear = 0;
    if (k.cool > 0) { k.cool -= dt; return; }
    const L = CAVE_CTX.lure();
    k.interest = L ? Math.min(1.2, k.interest + L.k * dt) : Math.max(0, k.interest - 0.08 * dt);
    // the lure moved off (the lantern taken down, Mori backed off) while it was still on its way
    if (!L && a.act === 'approach' && k.interest < 0.5) a.setAct('lurk', 8);
    if (L && (a.act === 'approach' || a.act === 'tell')) { k.kind = L.kind; }
  },
};

// ================================================================== the Cave Wētā's mind
ECO[WETA_ID] = {
  loco: 'climber', medium: 'trunk', walk: 8, run: 50, bold: 0.6, aggro: 0, curious: 0, social: 0.4, alert: 0.6,
  sight: 0, hear: 0.6, flightDist: 0, food: [], defense: ['flee'], group: [1, 1], calls: {}, size: 1,
  idle: [{ act: 'cling', w: 4, dur: [4, 10] }, { act: 'crawl', w: 2, dur: [2, 5] }, { act: 'feed', w: 1, dur: [3, 6] }],
  photo: { cling: 'clinging', crawl: 'feeling', feed: 'feeding', hop: 'leaping', leap: 'leaping', windup: 'feeling' },
};
SPECIALS[WETA_ID] = {
  cling(a) {
    a.vx = 0; a.anim = 'idle'; a.hidden = 0;
    const k = caveKeep(a);
    // the big one and a bright lantern close by: the crouch (the tell), then the leap
    if (k.big && k.cool <= 0 && CAVE_CTX.lit(a.x, a.y) > 0.5) { a.setAct('windup', 1.1); CAVE_CTX.wetaWind(a); return; }
    if (!k.big && CAVE_CTX.stir(a.x, a.y) > 0.7 && rand.chance(0.02)) { a.setAct('hop', 0.6); return; }
    if (a.actT > a.actDur) return false;
  },
  crawl(a, dt) {
    a.anim = 'walk'; a.hidden = 0;
    if (a.mem.tx === undefined) { a.mem.tx = clamp(a.x + rand.range(-30, 30), a.home[0], a.home[1]); a.mem.ty = a.y + rand.range(-8, 8); a.face(a.mem.tx); }
    const dx = a.mem.tx - a.x, dy = a.mem.ty - a.y, d = Math.hypot(dx, dy);
    if (d < 1.5 || a.actT > a.actDur) return false;
    a.x += (dx / d) * 7 * dt; a.y += (dy / d) * 7 * dt; a.vx = (dx / d) * 7;
  },
  feed(a) { a.vx = 0; a.anim = 'feed'; if (a.actT > a.actDur) return false; },
  /** a startled hop to another spot on the wall */
  hop(a, dt) {
    a.anim = 'jump';
    if (a.mem.x0 === undefined) { a.mem.x0 = a.x; a.mem.y0 = a.y; a.mem.tx = clamp(a.x + rand.range(-40, 40), a.home[0], a.home[1]); a.mem.ty = a.y + rand.range(-12, 6); a.face(a.mem.tx); }
    const t = Math.min(1, a.actT / 0.5);
    a.x = a.mem.x0 + (a.mem.tx - a.mem.x0) * t;
    a.y = a.mem.y0 + (a.mem.ty - a.mem.y0) * t - Math.sin(t * Math.PI) * 18;
    void dt;
    if (t >= 1) return false;
  },
  /** the tell: down on its haunches, antennae swept forward at the light, a dry tk-tk-tk */
  windup(a) {
    a.vx = 0; a.anim = 'windup'; a.hidden = 0;
    const p = a.host.player;
    a.face(p.x);
    if (Math.floor(a.actT * 8) % 2 === 0) a.x += a.facing * 0.15;
    if (a.actT < a.actDur) return;
    // shuttered or backed off in time: it settles
    if (CAVE_CTX.lit(a.x, a.y) < 0.35) { caveKeep(a).cool = 5; a.setAct('cling', 6); return; }
    a.setAct('leap', 0.55);
  },
  /** straight at the lantern */
  leap(a) {
    a.anim = 'jump';
    const p = a.host.player;
    if (a.mem.x0 === undefined) { a.mem.x0 = a.x; a.mem.y0 = a.y; a.mem.tx = p.x; a.mem.ty = p.y - 26; a.face(a.mem.tx); }
    const t = Math.min(1, a.actT / 0.5);
    a.x = a.mem.x0 + (a.mem.tx - a.mem.x0) * t;
    a.y = a.mem.y0 + (a.mem.ty - a.mem.y0) * t - Math.sin(t * Math.PI) * 14;
    if (t >= 1) {
      const k = caveKeep(a);
      k.cool = 28;
      CAVE_CTX.wetaHit(a);
      // it drops off and scuttles back to its wall
      a.y = floorAt(a, a.x) - 2;
      a.setAct('crawl', 6); a.mem.tx = clamp(a.x + (a.x < p.x ? -50 : 50), a.home[0], a.home[1]); a.mem.ty = floorAt(a, a.mem.tx) - 30;
      return;
    }
  },
  sleep(a) { a.setAct('cling', 6); },
};
HOOKS[WETA_ID] = {
  ...(HOOKS[WETA_ID] ?? {}),
  decide(a) { return a.act === 'windup' || a.act === 'leap' || a.act === 'hop'; },
  onThreat(a) { a.fear = 0; return true; },
  tick(a, dt) { const k = caveKeep(a); a.fear = 0; if (k.cool > 0) k.cool -= dt; },
};

// ================================================================== the Cave Harvestman's mind
ECO[HARV_ID] = {
  loco: 'walker', medium: 'trunk', walk: 6, run: 20, bold: 0.5, aggro: 0, curious: 0, social: 0.5, alert: 0.5,
  sight: 0, hear: 0.5, flightDist: 0, food: [], defense: ['freeze'], group: [1, 1], calls: {}, size: 1,
  idle: [{ act: 'sit', w: 3, dur: [5, 12] }, { act: 'amble', w: 2, dur: [3, 6] }],
  photo: { sit: 'resting', amble: 'walking', bob: 'bobbing' },
};
SPECIALS[HARV_ID] = {
  sit(a) {
    a.vx = 0; a.anim = 'idle'; a.hidden = 0;
    a.y = floorAt(a, a.x);
    if (CAVE_CTX.lit(a.x, a.y) > 0.55 && CAVE_CTX.stir(a.x, a.y) > 0.3) { a.setAct('bob', rand.range(1.6, 2.6)); return; }
    if (a.actT > a.actDur) return false;
  },
  amble(a, dt) {
    a.anim = 'walk'; a.hidden = 0;
    if (a.mem.tx === undefined) { a.mem.tx = clamp(a.x + rand.range(-24, 24), a.home[0], a.home[1]); a.face(a.mem.tx); }
    const dx = a.mem.tx - a.x;
    if (Math.abs(dx) < 1 || a.actT > a.actDur) return false;
    a.x += Math.sign(dx) * 6 * dt; a.vx = Math.sign(dx) * 6;
    a.y = floorAt(a, a.x);
  },
  bob(a) { a.vx = 0; a.anim = 'bob'; a.y = floorAt(a, a.x); if (a.actT > a.actDur) return false; },
  sleep(a) { a.setAct('sit', 8); },
};
HOOKS[HARV_ID] = { ...(HOOKS[HARV_ID] ?? {}), onThreat(a) { a.fear = 0; return true; }, tick(a) { a.fear = 0; caveKeep(a); } };

// ================================================================== the Cave Centipede's mind
ECO[CENT_ID] = {
  loco: 'serpent', medium: 'trunk', walk: 16, run: 50, bold: 0.8, aggro: 0, curious: 0, social: 0, alert: 0.7,
  sight: 0, hear: 0.8, flightDist: 0, food: [], defense: ['strike'], group: [1, 1], calls: { threat: 'callHiss' }, size: 2,
  idle: [{ act: 'prowl', w: 3, dur: [4, 8] }, { act: 'still', w: 2, dur: [3, 7] }],
  photo: { prowl: 'hunting', still: 'resting', rear: 'threat', strike: 'threat' },
};
SPECIALS[CENT_ID] = {
  prowl(a, dt) {
    a.anim = 'walk'; a.hidden = 0;
    if (a.mem.tx === undefined) { a.mem.tx = clamp(a.x + rand.range(-70, 70), a.home[0], a.home[1]); a.face(a.mem.tx); }
    const dx = a.mem.tx - a.x;
    if (Math.abs(dx) < 2 || a.actT > a.actDur) return false;
    a.x += Math.sign(dx) * 16 * dt; a.vx = Math.sign(dx) * 16;
    a.y = floorAt(a, a.x);
  },
  still(a) { a.vx = 0; a.anim = 'idle'; a.y = floorAt(a, a.x); if (a.actT > a.actDur) return false; },
  /** the warning: the front third reared up, claws open, a dry hiss */
  rear(a) {
    a.vx = 0; a.anim = 'rear'; a.hidden = 0;
    const p = a.host.player;
    a.face(p.x);
    if (!a.mem.h) { a.mem.h = 1; CAVE_CTX.rear(a); }
    if (a.actT < a.actDur) return;
    if (Math.abs(p.x - a.x) < 26 && Math.abs(p.y - a.y) < 20) { a.setAct('strike', 0.4); return; }
    caveKeep(a).cool = 4; return false;
  },
  strike(a) {
    a.anim = 'strike';
    if (!a.mem.b && a.actT > 0.12) { a.mem.b = 1; CAVE_CTX.bite(a); }
    if (a.actT > a.actDur) { caveKeep(a).cool = 8; a.setAct('prowl', 3); a.mem.tx = clamp(a.x - a.facing * 60, a.home[0], a.home[1]); return; }
  },
  sleep(a) { a.setAct('still', 6); },
};
HOOKS[CENT_ID] = {
  ...(HOOKS[CENT_ID] ?? {}),
  onThreat(a) { a.fear = 0; return true; },
  decide(a) {
    const k = caveKeep(a), p = a.host.player;
    if (a.act === 'rear' || a.act === 'strike') return true;
    if (k.cool > 0) return false;
    if (Math.abs(p.x - a.x) < 40 && Math.abs(p.y - a.y) < 24 && CAVE_CTX.lit(a.x, a.y) > 0.3) { a.setAct('rear', 1.4); return true; }
    return false;
  },
  tick(a, dt) { const k = caveKeep(a); a.fear = 0; if (k.cool > 0) k.cool -= dt; },
};

FUN[SAL_ID] = 'A Blind Salamander can live a hundred years and go years without eating. It has no eyes, but it can feel your lantern on its skin.';
FUN[GULPER_ID] = 'The Ghost Gulper feeds by suction: its jaw drops so fast that its pleated throat balloons and the water rushes in, carrying dinner with it.';
FUN[WETA_ID] = 'A cave wētā\'s antennae can be three times as long as its body. In the dark they are its eyes.';
FUN[HARV_ID] = 'Harvestmen are not spiders: one round body, two eyes, and not a single thread of silk.';
FUN[CENT_ID] = 'A centipede\'s venom fangs are its first pair of legs, turned into weapons.';
WEB.push(
  [GULPER_ID, 'eats', SAL_ID, 'when one strays out of the stream into the lake'],
  [CENT_ID, 'eats', WETA_ID, 'running them down on the walls'],
  [CENT_ID, 'eats', HARV_ID, 'when it can catch one'],
);
void ALL;

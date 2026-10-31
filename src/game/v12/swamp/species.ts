// V12 Te Repo Raupō's own animals for the field guide (art: src/art/v12/swamp/toads.ts), with their
// ecology entries and their acts (the scene side: the rain, the tongue reaching Mori, catching an
// ember toad, is ./toads.ts):
//
//   Giant Bellowtoad  the old one of the dark pool. By day it lies sunk beside its mud island with only
//                     its eyes and back above the water; at dusk it heaves itself out onto the island.
//                     It only booms at dusk or night, in rain, and only when nothing is moving near it:
//                     come crouched or hidden and wait. Territorial: come at it through the water and
//                     it rears up, puffs and glares (the TELL), then its tongue lashes out and knocks
//                     you flat. Photographing it calling is the prize.
//   Ember Toad        a thumb-sized, coal-bright toad of the moss hummocks. It doesn't run: it swells up
//                     stiff-legged and tips back to flash its scarlet belly. Its skin is poison: touch
//                     it bare-handed and the world tilts. With grip gloves it can be caught and its
//                     toxin taken for the lab.
//
// Imported by ../../species.ts (so the guide, the camera and the research log know them from boot).

import type { Species } from '../../species';
import { ECO } from '../../wild/ecology';
import { SPECIALS, HOOKS } from '../../wild/animal';
import type { Animal } from '../../wild/animal';
import { registerBeast } from '../../../art/beasts';
import { BELLOWTOAD, EMBERTOAD } from '../../../art/v12/swamp/toads';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';
import { rand } from '../../../core/math';
import './items';

export const TOAD_ID = 'bellowtoad';
export const EMBER_ID = 'embertoad';
registerBeast(TOAD_ID, BELLOWTOAD);
registerBeast(EMBER_ID, EMBERTOAD);
// (the quests come in after boot, free of the import cycle through the quest list)
setTimeout(() => { void import('./quests').then(m => m.registerSwampQuests()); }, 0);

/** what the swamp scene tells the toads, and what they ask of it (./toads.ts fills it in) */
export const SWAMP_CTX = {
  /** 0..1 rain where the toad is */
  rain: (): number => 0,
  /** seconds nothing has moved near the pool (Mori far off, or crouched / hidden and still) */
  quietT: 0,
  /** is Mori out of sight (hidden, or crouched in cover) */
  hidden: (): boolean => false,
  /** the big toad's boom, its tell's growl, a heavy landing, the tongue reaching its full length */
  boom: (_a: Animal): void => {},
  growl: (_a: Animal): void => {},
  thump: (_a: Animal): void => {},
  lash: (_a: Animal): void => {},
  /** an ember toad flashing its belly */
  flash: (_a: Animal): void => {},
};

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });

export const BELLOWTOAD_SPECIES: Species = {
  id: TOAD_ID, name: 'Giant Bellowtoad', sci: 'Megabufo tonitrans', group: 'Amphibian', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 5, danger: 3, size: '1.1 m long, about 40 kg',
  blurb: 'A toad bigger than a man is tall when it stretches: a boulder of olive-umber skin heaped with warts, a bony crest over each great gold eye and a parotoid gland like a loaf behind it. It owns the dark pool in the raupō swamp. On wet nights it fills its throat into a pale balloon bigger than its own head and booms, and the whole swamp feels it in the water.',
  behaviors: { sitting: 'Sitting on its island', calling: 'Booming in the rain', threat: 'Rearing up (the warning)', tongue: 'Lashing its tongue', hopping: 'Heaving itself across the pool', lurking: 'Lurking in the water' },
  facts: [
    {
      id: 'bt-call', cat: 'Behaviour', q: 'Why does the Giant Bellowtoad only boom on rainy nights?', options: ['Rain fills the breeding pools, so it calls females to spawn while the water is high', 'It is frightened of thunder', 'It is calling its lost young home'], answer: 0,
      text: 'The boom carries kilometres through water and peat. The breeding season is the wet season: it calls when the rain has topped the pools up, so the spawn has water deep enough to survive.',
      evidence: [ph(TOAD_ID, 'calling')], hint: 'Be down in its hollow at dusk when it rains. Hide in the raupō, keep still, and wait for the boom.',
    },
    {
      id: 'bt-sac', cat: 'Anatomy', q: 'What is the huge pale balloon under its chin?', options: ['A vocal sac: air pumped back and forth over the vocal cords makes it ring like a drum', 'A store of water for dry spells', 'A pouch where it keeps its eggs'], answer: 0,
      text: 'With its nostrils and mouth shut it shunts the same air between its lungs and the sac. The stretched skin resonates: that is the drum. It can call for an hour on one breath.',
      evidence: [ph(TOAD_ID, 'calling')], hint: 'A photo of it calling shows the sac at full stretch.',
    },
    {
      id: 'bt-tongue', cat: 'Diet', q: 'How does it catch prey as big as a moss frog?', options: ['A sticky tongue nearly as long as a man, flicked out faster than a blink', 'It lies on them', 'It sucks them in through its nostrils'], answer: 0,
      text: 'The tongue is folded back in its mouth and thrown out like a whip. The tip is coated in a slime that is runny as it hits and sticky as it pulls back, so prey cannot slip off.',
      evidence: [ph(TOAD_ID, 'tongue')], hint: 'Get close to it in the water and it will show you. Then get out of the way.',
    },
    {
      id: 'bt-gland', cat: 'Adaptation', q: 'What are the big swollen lumps behind its eyes?', options: ['Parotoid glands full of bitter poison: nothing that bites one does it twice', 'Its ears', 'Fat stores for the winter'], answer: 0,
      text: 'Squeezed, the glands ooze a milky toxin. Eels, herons and even ironjaws leave it alone. Like its cousin the ember toad, it advertises less and relies on size.',
      evidence: [ph(TOAD_ID, 'sitting'), ph(TOAD_ID, 'lurking')], hint: 'A clear side-on photo of it on its island, or lying in the water.',
    },
  ],
  research: {
    habitat: 'The deepest, darkest pools of Te Repo Raupō, in peat hollows ringed with raupō. One old animal holds each pool for decades: the dark pool under the fallen kahikatea has been its for longer than Koro has been alive.',
    diet: 'Anything that fits in its mouth: moss frogs, eels, crayfish, ducklings, mice, the odd unlucky ember toad (it spits those out). It sits and waits for food to come past, and the tongue does the rest.',
    anatomy: 'Built like a boulder: a broad flat head, a body as wide as it is long, short massive arms and great folded thighs for its rare heavy hops. Warty skin that holds water; a bony crest over each eye; parotoid poison glands behind them; a horizontal pupil; a vocal sac that inflates bigger than its head.',
    ecology: 'The top of the pool\'s food web, and its keeper: its tadpoles fill the swamp each spring and feed half the birds in it. Nothing preys on the adults. The people of Te Kāinga leave its pool alone.',
    behaviour: 'Sits all night on its mud island; lies submerged by day with only its eyes above the water. Calls only at dusk or at night in rain, and falls silent the moment something moves near it. Territorial: it rears up and glares before it lashes, so watch for the tell.',
    notes: [
      'It BOOMED and I felt it in my knees. Through the water. Through my boots.',
      'Aroha says Koro calls it Te Tupuna o te Repo, the grandfather of the swamp. He says to show it respect. I am showing it a LOT of respect. From the raupō.',
      'The throat sac was bigger than its head. I could see the rain bouncing off it.',
      'It blinks by pulling its eyes down into its head. Slowly. Like it is thinking about you.',
    ],
    status: 'One known animal',
  },
};

export const EMBER_SPECIES: Species = {
  id: EMBER_ID, name: 'Ember Toad', sci: 'Pyrobufo vexillarius', group: 'Amphibian', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 3, danger: 2, size: '4 cm, lighter than a coin',
  blurb: 'A toad no bigger than a thumb, the colour of a live coal: fiery orange spotted black, every wart tipped yellow. Threaten one and it swells up stiff-legged and tips back to flash a scarlet belly marbled with black. The colours are a warning, and they are telling the truth.',
  behaviors: { sitting: 'Sitting in plain sight', hopping: 'Hopping', warning: 'Flashing its warning colours', feeding: 'Flicking up an insect', calling: 'Trilling' },
  facts: [
    {
      id: 'et-flash', cat: 'Adaptation', q: 'Why does the Ember Toad flash its scarlet belly at you?', options: ['A warning: bright colours advertise that it is poisonous', 'To attract a mate', 'It is cooling down'], answer: 0,
      text: 'Most frogs hide. This one shows off. A predator that has tasted one never forgets the colours, so the next toad is left alone. The swelling up makes it too big and too stiff to swallow, too.',
      evidence: [ph(EMBER_ID, 'warning')], hint: 'Get close to one and it puffs up and shows you. Do NOT touch it.',
    },
    {
      id: 'et-toxin', cat: 'Diet', q: 'Where does its poison come from?', options: ['From the ants and beetles it eats: its skin glands store their chemicals', 'It makes it from the sun', 'From the peat water'], answer: 0,
      text: 'Raised on a diet without the right ants it would be harmless. It eats bitter ants and lantern beetles, and its skin glands concentrate their chemicals into something much worse.',
      evidence: [ph(EMBER_ID, 'feeding')], hint: 'Watch one hunting on the hummocks.',
    },
    {
      id: 'et-bold', cat: 'Behaviour', q: 'Why doesn\'t it hop away from you like other frogs?', options: ['It doesn\'t need to: almost nothing dares to eat it', 'It cannot see you', 'It is too slow'], answer: 0,
      text: 'Fleeing costs energy and hides the warning. Ember toads sit in the open, in daylight, on the brightest moss they can find, and simply dare you.',
      evidence: [ph(EMBER_ID, 'sitting'), ph(EMBER_ID, 'hopping')], hint: 'They sit out in the open on the moss hummocks among the drowned trees.',
    },
  ],
  research: {
    habitat: 'The sphagnum hummocks of Te Repo Raupō, especially among the drowned trees, and the rim of the dark pool. Always in the open, always in the wet.',
    diet: 'Ants, small beetles and mites, picked off the moss with a flick of the tongue. The bitter ones are the point: their chemicals become its poison.',
    anatomy: 'Tiny and squat, with granular skin crowded with poison glands; warning colours on the back and a hidden scarlet belly freckled blue. Short stiff legs it locks straight in the warning display.',
    ecology: 'Hardly anything eats it. The giant bellowtoad tries now and then and spits it out. Its tadpoles are as poisonous as the adults.',
    behaviour: 'Out by day and on wet nights, bold as anything. Threatened, it puffs up and tips back to flash its belly; touched, its skin weeps a toxin that numbs, burns and makes the world tilt.',
    notes: [
      'I touched one. Once. The world went sideways for a full minute. Gloves, Mori. GLOVES.',
      'It looked me right in the eye and puffed up like a tiny angry orange.',
      'Jenna says the toxin might be a painkiller in very small doses. In very, very small doses.',
    ],
    status: 'Common on the hummocks',
  },
};

// ---------------------------------------------------------------- the giant toad's mind
ECO[TOAD_ID] = {
  loco: 'hopper', medium: 'ground', walk: 9, run: 30, bold: 1, aggro: 0.7, curious: 0.05, social: 0, alert: 0.5,
  sight: 170, hear: 1.2, flightDist: 70, food: ['insect'], prey: [], defense: ['freeze'],
  group: [1, 1], calls: { contact: 'callCroak', threat: 'callGrowl' }, size: 5,
  idle: [{ act: 'sit', w: 5, dur: [6, 12] }],
  photo: { sit: 'sitting', idle: 'sitting', call: 'calling', warn: 'threat', lash: 'tongue', hop: 'hopping', lurk: 'lurking', sleep: 'lurking' },
};
const dist = (a: Animal) => { const p = a.host.player; return { dx: Math.abs(p.x - a.x), dy: Math.abs(p.y - a.y), x: p.x }; };
const dayNow = (a: Animal) => a.host.tod === 'day' || a.host.tod === 'dawn';
/** what outlasts an act (a.mem is wiped on every change of act): the cool-down after a lash */
const KEEP = new WeakMap<Animal, { cool: number }>();
export const toadKeep = (a: Animal) => { let k = KEEP.get(a); if (!k) { k = { cool: 0 }; KEEP.set(a, k); } return k; };
/** the toad's home (its island) and its lie (in the water beside it) */
const homeX = (a: Animal) => (a.home[0] + a.home[1]) / 2;
const lieX = (a: Animal) => homeX(a) + 52;
const gy = (a: Animal, x: number) => a.host.terrain.groundY(x);

/** one heavy hop toward x; true on landing */
function heave(a: Animal, tx: number, dt: number): boolean {
  const m = a.mem;
  if (m.hx0 === undefined) { m.hx0 = a.x; m.hy0 = a.y; m.ht = 0; m.htx = a.x + Math.sign(tx - a.x) * Math.min(46, Math.abs(tx - a.x)); a.face(tx); }
  m.ht += dt / 0.75;
  const t = Math.min(1, m.ht);
  const ty = gy(a, m.htx);
  a.x = m.hx0 + (m.htx - m.hx0) * t;
  a.y = m.hy0 + (ty - m.hy0) * t - Math.sin(t * Math.PI) * 26;
  a.anim = 'hop';
  if (t >= 1) { delete m.hx0; a.y = ty; SWAMP_CTX.thump(a); return true; }
  return false;
}

SPECIALS[TOAD_ID] = {
  ...(SPECIALS[TOAD_ID] ?? {}),
  sit(a) {
    a.vx = 0; a.anim = 'idle'; a.hidden = 0;
    const d = dist(a);
    if (d.dx < 260 && Math.floor(a.actT / 2.5) !== a.mem.turn) { a.mem.turn = Math.floor(a.actT / 2.5); a.face(d.x); }
    if (dayNow(a)) { a.setAct('lurk', 40); return; }
    if (Math.abs(a.x - homeX(a)) > 10) { a.setAct('hop', 6); a.mem.to = homeX(a); return; }
    if (SWAMP_CTX.rain() > 0.45 && SWAMP_CTX.quietT > 6 && toadKeep(a).cool <= 0) a.setAct('call', rand.range(10, 16));
  },
  call(a) {
    a.vx = 0; a.anim = 'call'; a.hidden = 0;
    // a boom at the top of each swell
    const k = Math.floor(a.actT / 1.35);
    if (k !== a.mem.boom) { a.mem.boom = k; SWAMP_CTX.boom(a); }
    if (SWAMP_CTX.rain() < 0.3 || dayNow(a)) return false;
    if (a.actT > a.actDur) return false;
  },
  /** the tell: up on its arms, puffed up, glaring, a growl like a door in the wind */
  warn(a, dt) {
    a.vx = 0; a.anim = 'threat'; a.hidden = 0;
    const p = a.host.player;
    a.face(p.x);
    if (!a.mem.g) { a.mem.g = 1; SWAMP_CTX.growl(a); a.showEmote('anger', 1.2, true); }
    if (Math.floor(a.actT * 8) !== Math.floor((a.actT - dt) * 8)) a.x += Math.floor(a.actT * 8) % 2 ? 0.6 : -0.6;
    if (a.actT < a.actDur) return;
    const d = dist(a);
    if (d.dx < 130 && d.dy < 40 && !SWAMP_CTX.hidden()) { a.setAct('lash', 0.8); a.mem.tx = p.x; a.mem.ty = p.y - 22; return; }
    toadKeep(a).cool = 2; return false;
  },
  /** the lash: the tongue thrown out to where Mori stood, then reeled back */
  lash(a, dt) {
    a.vx = 0; a.hidden = 0;
    a.anim = 'tongue';
    const t = a.actT;
    a.mem.ext = t < 0.14 ? t / 0.14 : t < 0.26 ? 1 : Math.max(0, 1 - (t - 0.26) / 0.34);
    if (t >= 0.14 && !a.mem.hit) { a.mem.hit = 1; SWAMP_CTX.lash(a); }
    void dt;
    if (t > a.actDur) { a.mem.ext = 0; toadKeep(a).cool = 3.5; return false; }
  },
  /** heaving itself across the pool: to its island, or into the water */
  hop(a, dt) {
    a.hidden = 0;
    const to = a.mem.to ?? homeX(a);
    if (Math.abs(a.x - to) < 6) { a.anim = 'idle'; return false; }
    if (a.mem.rest > 0) { a.mem.rest -= dt; a.anim = 'idle'; return; }
    if (heave(a, to, dt)) a.mem.rest = 0.5;
  },
  /** by day: sunk in the water beside its island, only its eyes and back above the surface */
  lurk(a, dt) {
    a.vx = 0;
    if (!dayNow(a)) { a.setAct('hop', 8); a.mem.to = homeX(a); return; }
    if (Math.abs(a.x - lieX(a)) > 6) {
      if (a.mem.hx0 === undefined && a.mem.rest > 0) { a.mem.rest -= dt; a.anim = 'idle'; return; }
      if (heave(a, lieX(a), dt)) a.mem.rest = 0.5;
      return;
    }
    a.anim = 'hide';
    a.hidden = 0.15;
    a.y = gy(a, a.x) + 5;
  },
  sleep(a) { a.setAct('sit', 6); },
};
HOOKS[TOAD_ID] = {
  ...(HOOKS[TOAD_ID] ?? {}),
  // territorial, not timid: whatever comes at it through the water gets the tell, and then the tongue
  onThreat(a) {
    a.fear = 0;
    return true;
  },
  decide(a) {
    if (a.act === 'warn' || a.act === 'lash' || (a.act === 'hop' && a.mem.hx0 !== undefined)) return false;
    const d = dist(a);
    if (d.dx < 112 && d.dy < 34 && !SWAMP_CTX.hidden() && toadKeep(a).cool <= 0) { a.setAct('warn', 1.1); return true; }
    // calling, and something moves near: it falls silent and stares
    if (a.act === 'call' && SWAMP_CTX.quietT < 0.5) { toadKeep(a).cool = 4; a.setAct('sit', 8); a.showEmote('question', 1.4, true); return true; }
    return false;
  },
  tick(a, dt) {
    const k = toadKeep(a);
    if (k.cool > 0) k.cool -= dt;
    a.fear = 0;
  },
};

// ---------------------------------------------------------------- the ember toad's mind
ECO[EMBER_ID] = {
  loco: 'hopper', medium: 'ground', walk: 10, run: 60, bold: 0.9, aggro: 0, curious: 0.25, social: 0.5, alert: 0.7,
  sight: 110, hear: 1, flightDist: 50, food: ['insect'], fears: [], defense: ['freeze'],
  group: [2, 3], calls: { contact: 'callTrill', song: 'callTrill', songWhen: ['dusk', 'night'] }, size: 1,
  idle: [{ act: 'sit', w: 3, dur: [3, 7] }, { act: 'hunt', w: 2.4 }, { act: 'hop', w: 2 }, { act: 'call', w: 1.4, when: ['dusk', 'night'] }],
  photo: { sit: 'sitting', idle: 'sitting', hop: 'hopping', walk: 'hopping', hunt: 'feeding', eat: 'feeding', puff: 'warning', call: 'calling' },
};
SPECIALS[EMBER_ID] = {
  ...(SPECIALS[EMBER_ID] ?? {}),
  sit(a) { a.vx = 0; a.anim = 'idle'; a.hidden = 0; },
  hunt(a, dt) {
    a.vx = 0;
    a.anim = a.actT % 2 < 0.33 ? 'tongue' : 'idle';
    if (a.actT % 2 < dt && a.host.catchInsect?.(a.x + a.facing * 8, a.y - 3, 14)) { a.hunger = Math.max(0, a.hunger - 0.2); a.showEmote('heart', 0.8); }
    if (a.actT > a.actDur) return false;
  },
  hop(a, dt) {
    if (!a.mem.h) {
      a.mem.h = 1; a.mem.vy = -80; a.mem.y0 = a.y;
      // (it keeps to its hummock: hop back toward the middle of it)
      const mid = (a.home[0] + a.home[1]) / 2;
      a.facing = Math.abs(a.x - mid) > (a.home[1] - a.home[0]) * 0.3 ? (a.x < mid ? 1 : -1) : rand.chance(0.5) ? 1 : -1;
      a.mem.dx = a.facing * rand.range(18, 34) * (a.mem.away ? 1.8 : 1);
    }
    a.mem.vy += 420 * dt;
    a.x += a.mem.dx * dt;
    a.y += a.mem.vy * dt;
    a.anim = 'hop';
    const g = a.host.terrain.groundY(a.x);
    if (a.y >= g && a.mem.vy > 0) { a.y = g; a.settle(); return false; }
  },
  /** the warning: swelling up stiff-legged and tipping back to flash the scarlet belly */
  puff(a) {
    a.vx = 0; a.anim = 'puff'; a.hidden = 0;
    const p = a.host.player;
    a.face(p.x);
    if (!a.mem.f) { a.mem.f = 1; SWAMP_CTX.flash(a); a.host.sfx('callTrill', a.x, 0.35, 2.2); }
    if (a.actT > a.actDur) {
      // still right on top of it: it gives up the display and hops off
      if (Math.abs(p.x - a.x) < 16) { a.setAct('hop', 2); a.mem.away = 1; a.facing = p.x < a.x ? 1 : -1; return; }
      return false;
    }
  },
  call(a) {
    a.vx = 0; a.anim = 'call';
    if (Math.floor(a.actT * 2) !== a.mem.c && a.actT < 3) { a.mem.c = Math.floor(a.actT * 2); a.call('song'); }
    if (a.actT > 3.5) return false;
  },
};
HOOKS[EMBER_ID] = {
  ...(HOOKS[EMBER_ID] ?? {}),
  onThreat(a) {
    if (a.act !== 'puff' && a.act !== 'hop') a.setAct('puff', rand.range(2.2, 3.2));
    return true;
  },
};

FUN[TOAD_ID] = 'A Giant Bellowtoad can call for an hour on one breath: it shunts the same air back and forth between its lungs and its throat sac.';
FUN[EMBER_ID] = 'An Ember Toad raised without bitter ants to eat would be harmless. Its poison is borrowed from its dinner.';
WEB.push(
  [TOAD_ID, 'eats', 'mossfrog', 'flicks them off the raupō with its tongue'],
  ['embertoad', 'eats', 'lanternbeetle', 'and borrows their chemicals for its poison'],
);

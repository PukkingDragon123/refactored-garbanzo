// V12 the crawlers: two animals of the wet bush for the field guide, with their ecology, their minds and
// the hooks the scenes use to stage them (art: src/art/v12/wild/crawlers.ts).
//
//   Tuna          the New Zealand longfin eel of the deep pool. By day it lies in its hole under the bank
//                 with only its head out, breathing. Drop food into the water and, after a moment, it
//                 slides out, glides along the bottom to under the food, rises, takes it at the surface
//                 with a swirl, turns and goes home. At dusk and through the night it patrols the pool on
//                 its own, slowly. Come at the pool loud (sprinting along the edge, jumping or swimming in)
//                 and it dashes back to its hole and stays deep in it for a while.
//   Ngaokeoke     a giant velvet worm under the big rotten log. Roll the log off it and it curls up; then,
//                 if you are still close, it rears and squirts two jets of sticky slime at you (they glue
//                 and set), and crawls off, slowly, to new cover. At night it comes out to hunt: it
//                 squirts slime over a wētā or a moth and feeds on it.
//
// ------------------------------------------------------------------ API
//   TUNA_ID = 'tuna'          spawnTuna(f, { x0, x1, surfaceY, bottomY, lairX }): Animal
//        The pool spans x0..x1, its surface at surfaceY and its bed at bottomY (y down); the eel's hole is
//        under the bank at lairX. a.x, a.y is the eel's body centre (the head is ~19 px ahead of it:
//        tunaHead(anim) in the art module). It never leaves the water.
//   tunaFeed(a, x)            food dropped into the water at x: it comes for it after 1.5-3 s (later if it
//                             has been spooked), takes it at the surface and goes home.
//   tunaStartle(a)            spook it now (it dashes home); it also spooks itself, see startled().
//   tunaKeep(a)               its state: { pool, food, took (how many it has eaten), spook (s left) }.
//   TUNA_CTX.took(a, x)       it has eaten the food at x (also a.mem.took = 1 during the 'take' act).
//   TUNA_CTX.splash(a, x)     its head breaks the surface at x.
//   Acts: lurk (in the hole), home (swimming back), patrol (night), seek (gliding to the food), rise,
//   take (at the surface), back (diving after it), flee (the dash home).
//
//   WORM_ID = 'ngaokeoke'     spawnWorm(f, x, { hidden?, stay? }): Animal
//        hidden: it lies under cover at x (a.hidden 0.95, act 'hide', drawn as just the antennae and the
//        tip of the head: anim 'peek'); stay (default true when hidden): it stays there until wormReveal,
//        even at night.
//   wormReveal(a)             the cover came off it: it curls up for ~2 s, squirts at Mori if he is within
//                             40 px, then crawls off (5 px/s) 45-70 px to new cover (a 'cover' POI if one is
//                             near, else a patch of litter) and hides again.
//   wormKeep(a)               its state: { cover (x of its cover), stay, ... }.
//   WORM_CTX.slimed(a)        a jet reached Mori (he is within ~34 px in front of it).
//   WORM_CTX.squirt(a)        it fires (sound cue).          WORM_CTX.hid(a, x)   it has hidden in cover at x.
//   Acts: hide, curl, squirt, creep (crawling to cover), prowl (night hunting), feed.
//
// Imported by ../../species.ts (so the guide, the camera and the research log know them from boot).

import type { Species } from '../../species';
import type { FieldScene } from '../../scenes/field';
import type { PlayerLike } from '../../wild/world';
import { ECO } from '../../wild/ecology';
import { Animal, SPECIALS, HOOKS } from '../../wild/animal';
import type { Body } from '../../wild/animal';
import { registerBeast } from '../../../art/beasts';
import { TUNA, NGAOKEOKE, tunaHead, TUNA_SURF, WORM_REACH } from '../../../art/v12/wild/crawlers';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';
import { rand, clamp } from '../../../core/math';

export const TUNA_ID = 'tuna';
export const WORM_ID = 'ngaokeoke';
registerBeast(TUNA_ID, TUNA);
registerBeast(WORM_ID, NGAOKEOKE);

/** what the eel tells the scene */
export const TUNA_CTX = {
  /** it has taken the food dropped at x */
  took: (_a: Animal, _x: number): void => {},
  /** its head breaks the surface at x */
  splash: (_a: Animal, _x: number): void => {},
};
/** what the velvet worm tells the scene */
export const WORM_CTX = {
  /** a slime jet reached Mori */
  slimed: (_a: Animal): void => {},
  /** it fires its jets (at Mori or at prey) */
  squirt: (_a: Animal): void => {},
  /** it has settled into cover at x */
  hid: (_a: Animal, _x: number): void => {},
};

// the body maker comes in after boot (bodies.ts pulls in the renderer and the game: keep it out of the
// import cycle through the species list)
let mkBody: ((a: Animal) => Body) | null = null;
const loadBodies = () => import('../../wild/bodies').then(m => { mkBody = m.makeBody; return m.makeBody; });
setTimeout(() => { void loadBodies(); }, 0);
function enter(f: FieldScene, a: Animal) {
  const add = (mk: (a: Animal) => Body) => { a.body = mk(a); f.animals.push(a); f.main.add(a); };
  if (mkBody) add(mkBody);
  else void loadBodies().then(add);
}

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });
/** an act that ends itself after d seconds (a.mem.d): its own duration is kept long so the generic mind,
 *  which steps in when an act's time is up, leaves it alone */
function timed(a: Animal, act: string, d: number) { a.setAct(act, d + 60); a.mem.d = d; }

// ================================================================== the field guide
export const TUNA_SPECIES: Species = {
  id: TUNA_ID, name: 'Tuna (Longfin Eel)', sci: 'Anguilla dieffenbachii', group: 'Fish', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 3, danger: 1, size: '1.4 m long, about 12 kg',
  blurb: 'The great eel of the deep pools: a thick, smooth, slime-slick body as long as Mori is tall, dark olive-brown above and pale grey-brown below, with a broad head, thick fleshy lips and a small dark eye. Its back fin starts far forward, well ahead of the fin underneath: that is how you know a longfin. It can live a hundred years in the same pool, and only ever leaves it once.',
  behaviors: { lurking: 'Lurking in its hole under the bank', swimming: 'Swimming', rising: 'Rising to the surface', feeding: 'Taking food at the surface' },
  facts: [
    {
      id: 'tu-fin', cat: 'Anatomy', q: 'How can you tell a longfin eel from its cousin the shortfin?', options: ['Its back fin starts far forward, well ahead of the fin underneath', 'Its tail is longer', 'It has spots along its fins'], answer: 0,
      text: 'In a longfin the dorsal fin begins about a quarter of the way down the body, far in front of the anal fin; in a shortfin the two begin at almost the same point. The corner of a longfin\'s mouth also reaches back past its eye.',
      evidence: [ph(TUNA_ID, 'swimming')], hint: 'A clear side-on photo of it swimming, the whole eel in frame. It patrols the deep pool after dusk, or comes out to food you drop in.',
    },
    {
      id: 'tu-age', cat: 'Activity', q: 'How long can a longfin eel live?', options: ['Sixty to a hundred years or more: it grows slowly for decades before it breeds', 'About five years', 'One summer'], answer: 0,
      text: 'Longfins grow slowly in cold water and may spend most of a century in one stretch of river. The biggest, always females, reach two metres and more than twenty kilograms. A big eel in a pool may be older than anyone who fishes it.',
      evidence: [ph(TUNA_ID, 'lurking')], hint: 'By day it lies in its hole under the bank of the deep pool with only its head out. Come quietly and look under the bank.',
    },
    {
      id: 'tu-sea', cat: 'Behaviour', q: 'Where does a longfin eel go to breed?', options: ['Thousands of kilometres out into the Pacific, probably near Tonga, where it spawns once and dies', 'It lays its eggs under the bank of its pool', 'Up into a mountain lake'], answer: 0,
      text: 'At the end of its life the eel stops eating, its eyes grow large and its belly turns bronze, and on a dark autumn night it swims down to the sea and away into the deep ocean. Its young drift back as see-through leaves, become glass eels at the river mouths, and the elvers climb wet rock and even dams on their way upstream.',
      evidence: [ph(TUNA_ID, 'rising')], hint: 'Photograph it rising toward the surface for food: drop something into the deep pool and wait.',
    },
    {
      id: 'tu-taonga', cat: 'Ecology', q: 'Why do the people of Te Kāinga leave the old eel of the deep pool alone?', options: ['Tuna are taonga: a treasured kai harvested with care, and some old eels are guardians of their pools', 'They are afraid of it', 'It tastes of mud'], answer: 0,
      text: 'Tuna have fed people here for as long as there have been people: caught in hīnaki and weirs, dried for winter, shared at hui, and taken with tikanga that leaves the breeders and the young. Some great eels are kaitiaki, guardians of a place, and are never taken at all.',
      evidence: [ph(TUNA_ID, 'feeding')], hint: 'Drop a huhu grub into the deep pool and wait, still. It comes up and takes it at the surface.',
    },
  ],
  research: {
    habitat: 'The deep pool below the bank, and every stream and swamp that joins it. Longfins live far inland and high up, in cold, clear, shaded water, and keep a home hole under a bank, a log or a root mat for years.',
    diet: 'Almost anything: kōura, insects and grubs that fall in, smaller fish, frogs, and the odd duckling. It hunts mostly by smell, mostly at night, and takes food off the surface with a slurp and a swirl.',
    anatomy: 'A long, thick, smooth body slick with mucus; scales so tiny they sit buried in the skin. A broad head with thick fleshy lips, a mouth reaching back past a small eye, tubular nostrils for smelling the water, small round pectoral fins, and one long fin running from a quarter of the way down its back, round the tail and forward underneath. It can breathe through its skin, and wriggle over wet ground from one pool to the next.',
    ecology: 'The top predator of the stream. Herons and shags take the elvers; nothing much takes a big one, except people. The old ones are the breeders the whole river depends on: they leave once, for the sea, and never come back.',
    behaviour: 'Out at dusk and in the dark, patrolling slowly; by day in its hole with only its head out, mouth working as it breathes. Shy of noise and footfalls: stamp along the bank and it is gone, deep in its hole, for a long time. Be still, and drop food in.',
    notes: [
      'Koro says the old one in the deep pool was there when he was a boy, and it was big then. He says his koro fed it. I believe him. It looked at me like it remembered.',
      'Its mouth opens and closes, opens and closes, the whole time it lies there. Breathing. Like it is quietly telling the pool a very long story.',
      'Aroha dropped a huhu grub in and the eel came up and SLURPED it. The whole pool swirled. I yelled. It was gone for ten minutes. Lesson learned.',
      'It is going to swim to TONGA one day. On its own. To have babies and die. I can barely walk to the dunny in the dark.',
    ],
    status: 'Declining across the country: one old resident here',
  },
};

export const NGAOKEOKE_SPECIES: Species = {
  id: WORM_ID, name: 'Ngaokeoke (Giant Velvet Worm)', sci: 'Peripatoides titan', group: 'Worm', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 4, danger: 0, size: '35 cm long, about as heavy as an apple',
  blurb: 'A soft caterpillar of a thing as long as a forearm, clothed in velvet: deep indigo-blue shading to blue-green, an orange diamond row down its back and sixteen pairs of stubby little legs. It lives under rotten logs in the damp bush and comes out at night on its stumpy legs, ringed antennae feeling the air. Disturb it and it fires two jets of sticky slime that set like glue.',
  behaviors: { crawling: 'Crawling on its stubby legs', curled: 'Curled up', squirting: 'Squirting slime', feeding: 'Feeding on its catch' },
  facts: [
    {
      id: 'nk-slime', cat: 'Diet', q: 'How does the Ngaokeoke catch a wētā almost as big as itself?', options: ['It squirts two jets of sticky slime from beside its mouth that tangle the prey and set in seconds', 'It stings it', 'It digs a pit trap'], answer: 0,
      text: 'Two glands as long as half its body fill with slime. Squeezed, it shoots from the papillae beside the mouth; the nozzles swing as it goes, so the jets wiggle across the target and lash it down. The proteins in it set as it dries. Then it bites through, drips in saliva, and drinks its meal. It eats the dried slime too: too costly to waste.',
      evidence: [ph(WORM_ID, 'squirting'), ph(WORM_ID, 'feeding')], hint: 'Roll over the big rotten log and stay close: it will show you. Or watch it hunting at night.',
    },
    {
      id: 'nk-old', cat: 'Ecology', q: 'How old is the velvet worms\' family?', options: ['Over 500 million years: older than the dinosaurs, and barely changed', 'They appeared after the dinosaurs died out', 'They arrived with the first people'], answer: 0,
      text: 'Their cousins crawled on the sea floor in the Cambrian, more than 500 million years ago, and their kind came ashore long before the dinosaurs. Velvet worms sit somewhere between worms and insects on the tree of life. Aotearoa has dozens of species: living fossils under the logs.',
      evidence: [ph(WORM_ID, 'crawling')], hint: 'A clear side-on photo of it crawling: count the legs.',
    },
    {
      id: 'nk-legs', cat: 'Anatomy', q: 'Its stubby legs have no joints at all. How does it walk?', options: ['They are fluid-filled: it squeezes its body fluid into them like water balloons and steps on hydrostatic pressure', 'It rolls along', 'It slides on its slime'], answer: 0,
      text: 'A velvet worm has no hard skeleton. Its body is a bag of fluid wrapped in muscle; squeezing it pushes fluid into the legs, which stiffen and step, each one a little after the one behind it, so a wave runs forward along them. Each leg ends in a pad and a pair of tiny claws.',
      evidence: [ph(WORM_ID, 'crawling'), ph(WORM_ID, 'curled')], hint: 'Watch it crawl away after you uncover it, slowly. It is never in a hurry.',
    },
    {
      id: 'nk-damp', cat: 'Adaptation', q: 'Why does it hide under rotten logs all day?', options: ['Its skin loses water fast: in dry air it would shrivel in an hour, so it keeps to damp, dark places and comes out at night', 'It is hiding from the moon', 'It sleeps all winter'], answer: 0,
      text: 'It breathes through hundreds of tiny tubes all over its body that cannot close, so it leaks water all the time. Under a log the air is wet; out in the sun it would dry out. Uncovered, it curls up tight to keep its soft underside in.',
      evidence: [ph(WORM_ID, 'curled')], hint: 'Roll over the big rotten log. It curls up the moment the light hits it: be quick.',
    },
  ],
  research: {
    habitat: 'The wet floor of the old bush: under rotten logs, in punky wood and deep leaf litter, anywhere the air stays damp and dark. Each one keeps to a few logs and the ground between them.',
    diet: 'Wētā, beetles, moths, spiders, slaters, anything it can glue down. It hunts at night, feeling ahead with its antennae, and fires its slime from a hand\'s length away.',
    anatomy: 'A soft body clothed in velvet: fine rings, each set with tiny papillae that shed water; sixteen pairs of stubby lobopod legs, each with a pad and two small claws; a pair of ringed antennae with a tiny eye at the base of each; jaws hidden in the mouth, and a slime gland behind each oral papilla. No hard parts at all: it can squeeze through a gap a third its width.',
    ecology: 'A small top predator of the litter. Mothers give birth to live young after carrying them for over a year. Weka and kiwi eat them; logging and drying out the bush eat more.',
    behaviour: 'Hides by day; walks at night, slowly, legs rippling. Uncovered, it curls up to keep in its water. Crowd it and it squirts. The slime is harmless to people, if you don\'t mind it in your hair.',
    notes: [
      'IT SQUIRTED ME. Two jets. From its FACE. My boot was glued to a fern. Aroha laughed so hard she had to sit down in the mud.',
      'Koro says the old people called them ngaokeoke and said not to disturb them. He says it with a straight face. I think he knew about the slime.',
      'Sixteen pairs of legs. I counted twice. They walk in a wave, back to front, like a stadium crowd.',
      'Older than the dinosaurs and it lives under a log near my tent. I have so many questions and it has slime.',
    ],
    status: 'Rare: only under the oldest logs',
  },
};

// ================================================================== Tuna's mind
ECO[TUNA_ID] = {
  loco: 'swimmer', medium: 'water', walk: 13, run: 72, bold: 0.6, aggro: 0, curious: 0.1, social: 0, alert: 0.45,
  sight: 110, hear: 0.75, nocturnal: true, flightDist: 40, food: [], fears: [], defense: ['dive'],
  group: [1, 1], calls: {}, size: 3,
  idle: [{ act: 'patrol', w: 3, dur: [18, 34] }, { act: 'lurk', w: 1, dur: [8, 16] }],
  photo: { lurk: 'lurking', sleep: 'lurking', home: 'swimming', patrol: 'swimming', seek: 'swimming', back: 'swimming', flee: 'swimming', rise: 'rising', take: 'feeding' },
};

export interface TunaPool { x0: number; x1: number; surfaceY: number; bottomY: number; lairX: number }
export interface TunaKeep {
  pool: TunaPool;
  /** food in the water: where, how long it waits before it leaves its hole, how long it has been there */
  food: { x: number; wait: number; age: number } | null;
  /** how many it has eaten */
  took: number;
  /** seconds left of being spooked (it stays deep in its hole) */
  spook: number;
  /** which way the hole faces (out into the pool) */
  out: 1 | -1;
}
const TK = new WeakMap<Animal, TunaKeep>();
export const tunaKeep = (a: Animal): TunaKeep | undefined => TK.get(a);

/** the head's offset from the body centre in each pose (facing right) */
const HEADS: Record<string, [number, number]> = {};
const headOff = (anim: string): [number, number] => {
  const k = anim === 'turn' ? 'swim' : anim;
  return (HEADS[k] ??= tunaHead(k));
};
const dayNow = (a: Animal) => a.host.tod === 'day' || a.host.tod === 'dawn';
/** the acts that run their own course (the mind leaves them alone) */
const TUNA_SEQ = new Set(['seek', 'rise', 'take', 'back', 'home', 'flee']);

/** where the head lies in the hole (pulled further in while spooked) */
function lairHead(k: TunaKeep): [number, number] {
  const P = k.pool;
  return [P.lairX + k.out * (k.spook > 0 ? 1 : 4), clamp(P.bottomY - 10, P.surfaceY + 8, P.bottomY - 4)];
}
/** the body centre, swimming, that puts the head at the hole's mouth once it has turned to face out */
function lairCentre(k: TunaKeep): [number, number] {
  const [hx, hy] = lairHead(k), H = headOff('swim');
  return [hx - k.out * H[0], hy - H[1]];
}
/** keep a swimming eel inside its pool */
function clampIn(a: Animal, k: TunaKeep) {
  const P = k.pool, [lx, ly] = lairCentre(k);
  let lo = P.x0 + 24, hi = P.x1 - 24;
  if (lo > hi) lo = hi = (P.x0 + P.x1) / 2;
  a.x = clamp(a.x, Math.min(lo, lx), Math.max(hi, lx));
  a.y = clamp(a.y, Math.min(P.surfaceY + 7, ly), Math.max(P.bottomY - 6, ly));
}
/** change pose keeping the head where it is (the body swings round it) */
function pose(a: Animal, anim: string) {
  if (a.anim === anim) return;
  if (a.anim !== 'turn' && anim !== 'turn' && TUNA.anims[a.anim]) {
    const h0 = headOff(a.anim), h1 = headOff(anim);
    a.x += a.facing * (h0[0] - h1[0]);
    a.y += h0[1] - h1[1];
  }
  a.anim = anim;
}
/** the turn: the head swings round toward us and the body follows (about its middle); true while turning */
const TURN_T = 0.5;
function turnStep(a: Animal, dir: number, dt: number): boolean {
  if (a.mem.turnT === undefined) {
    if (dir === 0 || dir === a.facing) return false;
    if (a.anim !== 'swim') pose(a, 'swim');
    a.mem.turnT = 0;
  }
  a.mem.turnT += dt;
  a.anim = 'turn';
  const damp = Math.max(0, 1 - dt * 4);
  a.vx *= damp; a.vy *= damp;
  if (a.mem.turnT >= TURN_T) { a.facing = a.facing > 0 ? -1 : 1; delete a.mem.turnT; a.anim = 'swim'; return false; }
  return true;
}
/** ease the body centre toward (tx, ty); true on arrival */
function glide(a: Animal, k: TunaKeep | null, tx: number, ty: number, sp: number, dt: number): boolean {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 1.2) { a.vx = a.vy = 0; return true; }
  const want = Math.min(sp, d * 2.4), acc = Math.max(40, sp * 2.2);
  a.vx += clamp((dx / d) * want - a.vx, -acc * dt, acc * dt);
  a.vy += clamp((dy / d) * want - a.vy, -acc * 0.7 * dt, acc * 0.7 * dt);
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  if (k) clampIn(a, k);
  return false;
}
/** swim the body centre to (cx, cy), turning first if it lies well behind; true on arrival */
function travel(a: Animal, k: TunaKeep, cx: number, cy: number, sp: number, dt: number, fast = false): boolean {
  const dir = Math.abs(cx - a.x) > 12 ? Math.sign(cx - a.x) : a.facing;
  if (turnStep(a, dir, dt)) return false;
  pose(a, fast ? 'dash' : 'swim');
  return glide(a, k, cx, cy, sp, dt);
}
/** Mori making a racket at the pool: sprinting along the edge, jumping or falling in, swimming */
function startled(a: Animal, k: TunaKeep): boolean {
  const p = a.host.player as PlayerLike & { running?: boolean; onGround?: boolean; vy?: number; swimming?: boolean };
  const P = k.pool;
  if (p.x < P.x0 - 34 || p.x > P.x1 + 34) return false;
  if (p.state === 'swim' || p.swimming) return true;
  if (p.running && Math.abs(p.vx) > 70) return true;
  return p.onGround === false && (p.vy ?? 0) > 60 && p.x > P.x0 - 4 && p.x < P.x1 + 4;
}
function spook(a: Animal, k: TunaKeep) {
  const fresh = k.spook <= 0;
  k.spook = 12;
  // already in its hole (lying there, or waiting there for the food to settle): it just pulls further in
  if (a.act === 'lurk' || a.act === 'flee' || a.anim === 'lurk') return;
  a.setAct('flee', 20);
  if (fresh) a.showEmote('exclaim', 0.9, true);
}
export function tunaStartle(a: Animal) {
  const k = TK.get(a);
  if (k) spook(a, k);
}

SPECIALS[TUNA_ID] = {
  ...(SPECIALS[TUNA_ID] ?? {}),
  /** in its hole under the bank, facing out, the head out and the mouth breathing */
  lurk(a, dt) {
    const k = TK.get(a);
    if (!k) return false;
    a.vx = a.vy = 0;
    if (a.anim !== 'lurk') {
      const [cx, cy] = lairCentre(k);
      if (Math.hypot(a.x - cx, a.y - cy) > 4) { a.setAct('home', 30); return; }
      if (turnStep(a, k.out, dt)) return;
      a.x = cx; a.y = cy;
      pose(a, 'lurk');
    }
    // spooked, it lies further back in the dark
    const [hx, hy] = lairHead(k), H = headOff('lurk');
    a.x += (hx - a.facing * H[0] - a.x) * Math.min(1, dt * 2);
    a.y += (hy - H[1] - a.y) * Math.min(1, dt * 2);
    a.hidden = k.spook > 0 ? 0.5 : 0.18;
  },
  /** swimming back to its hole */
  home(a, dt) {
    const k = TK.get(a);
    if (!k) return false;
    a.hidden = 0;
    const [cx, cy] = lairCentre(k);
    if (!a.mem.at) { if (!travel(a, k, cx, cy, a.eco.walk * 1.7, dt)) return; a.mem.at = 1; }
    if (turnStep(a, k.out, dt)) return;
    a.setAct('lurk', dayNow(a) ? 40 : rand.range(8, 16));
  },
  /** dusk and night: slow lengths of the pool, pausing to hang in the water */
  patrol(a, dt) {
    const k = TK.get(a);
    if (!k) return false;
    a.hidden = 0;
    const P = k.pool;
    if (a.mem.pause > 0) { a.mem.pause -= dt; if (a.anim !== 'turn') pose(a, 'idle'); a.vx *= 0.95; a.vy *= 0.95; return; }
    if (a.mem.tx === undefined) {
      a.mem.tx = rand.range(P.x0 + 30, P.x1 - 30);
      a.mem.ty = rand.range(P.surfaceY + 10, Math.max(P.surfaceY + 11, P.bottomY - 8));
    }
    if (travel(a, k, a.mem.tx, a.mem.ty, a.eco.walk, dt)) { a.mem.pause = rand.range(1, 3.5); delete a.mem.tx; }
  },
  /** food in the water: a moment's wait (longer while spooked), then out and along the bottom to under it */
  seek(a, dt) {
    const k = TK.get(a);
    const f = k?.food;
    if (!k || !f) { a.setAct('home', 30); return; }
    if (a.mem.w === undefined) a.mem.w = f.wait;
    if (a.mem.w > 0 || k.spook > 0) {
      a.mem.w -= dt;
      if (a.anim !== 'lurk' && a.anim !== 'turn') { pose(a, 'idle'); a.vx *= 0.9; a.vy *= 0.9; }
      return;
    }
    a.hidden = 0;
    const P = k.pool, H = headOff('swim');
    const hy = clamp(P.surfaceY + 14, P.surfaceY + 8, P.bottomY - 6);
    // face the food (keeping the way it faces when the food is only just behind the head)
    const headX = a.x + a.facing * H[0];
    const dir = Math.abs(f.x - headX) > 22 ? Math.sign(f.x - a.x) || a.facing : a.facing;
    if (turnStep(a, dir, dt)) return;
    pose(a, 'swim');
    if (glide(a, k, f.x - a.facing * H[0], hy - H[1], 26, dt)) a.setAct('rise', 10);
  },
  /** angled up, rising under the food */
  rise(a, dt) {
    const k = TK.get(a);
    const f = k?.food;
    if (!k || !f) { timed(a, 'back', 1.2); return; }
    pose(a, 'rise');
    a.hidden = 0;
    const H = headOff('rise');
    if (glide(a, null, f.x - a.facing * H[0], k.pool.surfaceY + 3 - H[1], 22, dt)) timed(a, 'take', 0.85);
  },
  /** the take: the head breaks the surface, the mouth gapes, the snap and the swirl */
  take(a) {
    const k = TK.get(a);
    if (!k) return false;
    a.vx = a.vy = 0;
    a.hidden = 0;
    if (a.mem.fx === undefined) {
      a.mem.fx = k.food?.x ?? a.x + a.facing * headOff('take')[0];
      a.anim = 'take';
      // the water line in the sprite on the surface, the head over the food
      a.x = a.mem.fx - a.facing * headOff('take')[0];
      a.y = k.pool.surfaceY - TUNA_SURF;
    }
    const t = a.actT;
    if (!a.mem.sp && t >= 0.02) { a.mem.sp = 1; TUNA_CTX.splash(a, a.mem.fx); a.host.sounds.push({ x: a.mem.fx, y: k.pool.surfaceY, kind: 'splash', src: a, species: a.species, radius: 160, t: a.host.time + 0.0001 }); }
    if (!a.mem.took && t >= 0.24) {
      a.mem.took = 1;
      k.took++;
      if (k.food && Math.abs(k.food.x - a.mem.fx) < 2) k.food = null;
      a.hunger = 0;
      TUNA_CTX.took(a, a.mem.fx);
    }
    if (t >= a.mem.d) timed(a, 'back', 1.2);
  },
  /** away under again, then home */
  back(a, dt) {
    const k = TK.get(a);
    if (!k) return false;
    pose(a, 'swim');
    const P = k.pool, H = headOff('swim');
    const hy = P.surfaceY + (P.bottomY - P.surfaceY) * 0.55;
    if (a.mem.x0 === undefined) a.mem.x0 = a.x + a.facing * 12;
    glide(a, k, a.mem.x0, hy - H[1], 24, dt);
    if (a.actT >= a.mem.d) a.setAct(k.food ? 'seek' : 'home', 30);
  },
  /** the dash home */
  flee(a, dt) {
    const k = TK.get(a);
    if (!k) return false;
    a.hidden = 0;
    const [cx, cy] = lairCentre(k);
    if (!a.mem.at) { if (!travel(a, k, cx, cy, a.eco.run, dt, true)) return; a.mem.at = 1; pose(a, 'swim'); }
    if (turnStep(a, k.out, dt)) return;
    k.spook = Math.max(k.spook, 8);
    a.setAct('lurk', 30);
  },
  sleep(a) { a.setAct('lurk', 30); },
  swim(a) { a.setAct('patrol', rand.range(18, 34)); },
  wander(a) { a.setAct('patrol', rand.range(18, 34)); },
  dive(a) { a.setAct('flee', 20); },
};
HOOKS[TUNA_ID] = {
  ...(HOOKS[TUNA_ID] ?? {}),
  // it is shy of noise, not of a quiet watcher: only a real fright sends it home
  onThreat(a) {
    const k = TK.get(a);
    if (!k) return false;
    if (a.fear > 0.85 || startled(a, k)) spook(a, k);
    a.fear *= 0.5;
    return true;
  },
  decide(a) {
    const k = TK.get(a);
    if (!k || TUNA_SEQ.has(a.act)) return false;
    if (k.food) { a.setAct('seek', 60); return true; }
    const expired = a.actT > a.actDur;
    if (dayNow(a)) {
      if (a.act === 'lurk') { if (expired) a.actDur = a.actT + 40; return false; }
      a.setAct('home', 30);
      return true;
    }
    // dusk and night: patrol the pool, resting in the hole now and then
    if ((a.act === 'patrol' || a.act === 'lurk') && !expired) return false;
    if (a.act === 'patrol' && rand.chance(0.3)) a.setAct('home', 30);
    else a.setAct('patrol', rand.range(18, 34));
    return true;
  },
  tick(a, dt) {
    const k = TK.get(a);
    if (!k) return;
    if (k.spook > 0) k.spook -= dt;
    if (k.food) { k.food.age += dt; if (k.food.age > 45 && a.act !== 'rise' && a.act !== 'take') k.food = null; }
    if (a.act !== 'flee' && startled(a, k)) spook(a, k);
  },
};

/** put the longfin eel in its pool: lying in its hole under the bank at lairX */
export function spawnTuna(f: FieldScene, pool: { x0: number; x1: number; surfaceY: number; bottomY: number; lairX: number }): Animal {
  const P: TunaPool = { ...pool };
  const out: 1 | -1 = P.lairX - P.x0 < P.x1 - P.lairX ? 1 : -1;
  const k: TunaKeep = { pool: P, food: null, took: 0, spook: 0, out };
  const a = new Animal(TUNA_ID, P.lairX, P.surfaceY + 10, { medium: 'water', home: [P.x0, P.x1] });
  TK.set(a, k);
  a.host = f;
  a.medium = 'water';
  a.facing = out;
  const [hx, hy] = lairHead(k), H = headOff('lurk');
  a.x = hx - out * H[0];
  a.y = hy - H[1];
  a.anim = 'lurk';
  a.setAct('lurk', 30);
  enter(f, a);
  return a;
}
/** food dropped into the water at x */
export function tunaFeed(a: Animal, x: number): void {
  const k = TK.get(a);
  if (!k) return;
  const P = k.pool;
  x = clamp(x, P.x0 + 6, P.x1 - 6);
  k.food = { x, wait: rand.range(1.5, 3), age: 0 };
  // fleeing, or already on its way: it comes for it when it can (seek and rise follow the food)
  if (a.act === 'flee' || a.act === 'seek' || a.act === 'rise' || a.act === 'take') return;
  a.setAct('seek', 60);
}

// ================================================================== Ngaokeoke's mind
ECO[WORM_ID] = {
  loco: 'walker', medium: 'ground', walk: 5, run: 7, bold: 0.75, aggro: 0, curious: 0.1, social: 0, alert: 0.5,
  sight: 34, hear: 0.5, nocturnal: true, flightDist: 26, food: [], fears: [], defense: ['freeze'],
  group: [1, 1], calls: {}, size: 1,
  idle: [{ act: 'prowl', w: 3, dur: [16, 30] }],
  photo: { prowl: 'crawling', creep: 'crawling', walk: 'crawling', wander: 'crawling', curl: 'curled', squirt: 'squirting', feed: 'feeding' },
};
export interface WormKeep {
  /** x of the cover it lives under */
  cover: number;
  /** keep to its cover until revealed (even at night) */
  stay: boolean;
  /** seconds before it will squirt at Mori again */
  cool: number;
  /** the squirt in hand is at prey (then it feeds) or at Mori */
  prey: boolean; atMori: boolean;
  /** misses since its last catch */
  tries: number;
}
const WK = new WeakMap<Animal, WormKeep>();
export const wormKeep = (a: Animal): WormKeep | undefined => WK.get(a);
const moriNear = (a: Animal, r: number) => { const p = a.host.player; return Math.abs(p.x - a.x) < r && Math.abs(p.y - a.y) < 34; };

/** pick new cover 45-70 px off, away from Mori: a 'cover' point if one is near, else a patch of litter */
function newCover(a: Animal, k: WormKeep): number {
  const p = a.host.player;
  const away = Math.sign(a.x - p.x) || (rand.chance(0.5) ? 1 : -1);
  let best: number | null = null, bs = -Infinity;
  for (const c of a.host.pois) {
    if (c.kind !== 'cover') continue;
    const d = Math.abs(c.x - a.x);
    if (d < 25 || d > 95 || Math.abs(c.x - k.cover) < 8) continue;
    const s = (Math.sign(c.x - a.x) === away ? 50 : 0) - Math.abs(d - 60);
    if (s > bs) { bs = s; best = c.x; }
  }
  if (best !== null) return best;
  const x = a.x + away * rand.range(45, 70);
  return clamp(x, a.home[0], a.home[1]);
}

SPECIALS[WORM_ID] = {
  ...(SPECIALS[WORM_ID] ?? {}),
  /** under cover: only the antennae out, feeling the air; out to hunt at night unless it keeps to its log */
  hide(a, dt) {
    const k = WK.get(a);
    a.vx = 0;
    a.hidden = Math.min(0.95, a.hidden + dt * 0.45);
    a.anim = a.hidden > 0.55 ? 'peek' : 'idle';
    a.actDur = a.actT + 5;
    if (k && !k.stay && a.host.tod === 'night' && a.actT > (a.mem.out ??= rand.range(20, 40)) && !moriNear(a, 50)) {
      a.hidden = 0;
      a.setAct('prowl', rand.range(16, 30));
    }
  },
  /** rolled up tight, exposed */
  curl(a) {
    const k = WK.get(a);
    a.vx = 0;
    a.hidden = 0;
    a.anim = 'curl';
    if (a.actT < (a.mem.d ?? 2) || !k) return;
    if (moriNear(a, 40) && k.cool <= 0) { k.atMori = true; k.prey = false; a.face(a.host.player.x); timed(a, 'squirt', 1.6); return; }
    a.setAct('creep', 40);
  },
  /** rearing up and firing the two slime jets */
  squirt(a) {
    const k = WK.get(a);
    a.vx = 0;
    a.hidden = 0;
    a.anim = 'squirt';
    if (!k) return false;
    if (!a.mem.s) { a.mem.s = 1; WORM_CTX.squirt(a); a.host.sfx('callHiss', a.x, 0.3, 2.4); }
    if (!a.mem.hit && a.actT >= 0.3) {
      a.mem.hit = 1;
      if (k.atMori) {
        const p = a.host.player, dx = p.x - a.x;
        if (dx * a.facing > -6 && Math.abs(dx) <= WORM_REACH && Math.abs(p.y - a.y) < 36) WORM_CTX.slimed(a);
        k.cool = 6;
      }
    }
    if (a.actT < (a.mem.d ?? 1.5)) return;
    k.atMori = false;
    if (k.prey) { k.prey = false; a.setAct('feed', rand.range(6, 10)); return; }
    a.setAct('creep', 40);
  },
  /** slowly off to cover, then in under it */
  creep(a, dt) {
    const k = WK.get(a);
    if (!k) return false;
    a.hidden = 0;
    if (a.mem.tx === undefined) a.mem.tx = newCover(a, k);
    if (moriNear(a, 18) && k.cool <= 0) { timed(a, 'curl', 1.4); return; }
    a.anim = 'crawl';
    if (a.groundTo(a.mem.tx, a.eco.walk, dt) || a.mem.blocked) {
      k.cover = a.x;
      a.setAct('hide', 30);
      WORM_CTX.hid(a, a.x);
    }
  },
  /** night: out on the litter, antennae feeling ahead, slime ready */
  prowl(a, dt) {
    const k = WK.get(a);
    if (!k) return false;
    a.hidden = 0;
    if (a.mem.pause > 0) { a.mem.pause -= dt; a.vx = 0; a.anim = 'idle'; }
    else {
      if (a.mem.tx === undefined) a.mem.tx = clamp(k.cover + rand.range(-60, 60), a.home[0], a.home[1]);
      a.anim = 'crawl';
      if (a.groundTo(a.mem.tx, a.eco.walk * 0.8, dt) || a.mem.blocked) { delete a.mem.tx; a.mem.blocked = 0; a.mem.pause = rand.range(1.5, 4); }
    }
    a.mem.hunt = (a.mem.hunt ?? rand.range(3, 6)) - dt;
    if (a.mem.hunt <= 0) {
      a.mem.hunt = rand.range(4, 8);
      const got = a.host.catchInsect?.(a.x + a.facing * 18, a.y - 4, 16) ?? false;
      // (and now and then something in the litter: a slater, a springtail)
      if (got || (++k.tries >= 3 && rand.chance(0.4))) { k.tries = 0; k.prey = true; k.atMori = false; a.face(a.x + a.facing); timed(a, 'squirt', 1.4); }
    }
  },
  /** head down over its glued catch */
  feed(a) {
    a.vx = 0;
    a.hidden = 0;
    a.anim = 'feed';
    a.hunger = Math.max(0, a.hunger - 0.01);
    if (a.actT > a.actDur) return false;
  },
  sleep(a) {
    const k = WK.get(a);
    if (k && Math.abs(a.x - k.cover) < 4) a.setAct('hide', 30);
    else { a.setAct('creep', 60); if (k) a.mem.tx = k.cover; }
  },
  wander(a) { a.setAct('prowl', rand.range(16, 30)); },
  flee(a) { timed(a, 'curl', 2); },
  freeze(a) { timed(a, 'curl', 2); },
};
HOOKS[WORM_ID] = {
  ...(HOOKS[WORM_ID] ?? {}),
  // it does not run: under cover it keeps still; in the open it curls up (and then perhaps squirts)
  onThreat(a) {
    const k = WK.get(a);
    a.fear *= 0.6;
    if (!k || a.act === 'hide' || a.act === 'curl' || a.act === 'squirt' || a.act === 'creep') return true;
    if (moriNear(a, 26)) timed(a, 'curl', rand.range(1.6, 2.4));
    return true;
  },
  decide(a) {
    const k = WK.get(a);
    if (!k || a.act === 'curl' || a.act === 'squirt' || a.act === 'creep' || a.act === 'feed') return false;
    const night = a.host.tod === 'night' || a.host.tod === 'dusk';
    if (!night) {
      // day: back under its cover (a worm out in the day finishes its walk first)
      if (a.act === 'prowl' && a.actT <= a.actDur) return false;
      a.setAct('creep', 60);
      a.mem.tx = k.cover;
      return true;
    }
    if (a.act === 'prowl' && a.actT <= a.actDur) return false;
    a.setAct('prowl', rand.range(16, 30));
    return true;
  },
  tick(a, dt) {
    const k = WK.get(a);
    if (k && k.cool > 0) k.cool -= dt;
  },
};

/** put a velvet worm at x: out in the open, or hidden under the cover the scene draws there */
export function spawnWorm(f: FieldScene, x: number, o: { hidden?: boolean; stay?: boolean } = {}): Animal {
  const a = new Animal(WORM_ID, x, f.st.terrain.groundY(x), { home: [x - 100, x + 100] });
  WK.set(a, { cover: x, stay: o.stay ?? !!o.hidden, cool: 0, prey: false, atMori: false, tries: 0 });
  a.host = f;
  a.facing = rand.chance(0.5) ? 1 : -1;
  a.settle();
  if (o.hidden) { a.hidden = 0.95; a.anim = 'peek'; a.setAct('hide', 30); }
  else a.setAct('prowl', rand.range(16, 30));
  enter(f, a);
  return a;
}
/** the cover came off it: it curls up, then squirts at Mori if he is close, then crawls off to new cover */
export function wormReveal(a: Animal): void {
  const k = WK.get(a);
  if (!k) return;
  k.stay = false;
  a.hidden = 0;
  timed(a, 'curl', rand.range(1.8, 2.4));
  a.showEmote('exclaim', 0.9, true);
}

FUN[TUNA_ID] = 'A longfin eel may live a hundred years in one pool, then swim thousands of kilometres to the deep Pacific near Tonga to spawn, once, and die. Its babies drift all the way back, and climb waterfalls taller than a house to get home.';
FUN[WORM_ID] = 'A Ngaokeoke mother carries her young inside her for more than a year and gives birth to live babies: tiny velvet worms, legs, antennae, slime and all.';
WEB.push(
  [TUNA_ID, 'eats', 'mossfrog', 'off the surface at night'],
  [TUNA_ID, 'eats', 'torrentdipper', 'a chick that swims too close'],
  ['bellowtoad', 'eats', TUNA_ID, 'the young ones'],
  ['snakestork', 'eats', TUNA_ID, 'spears the elvers'],
  [WORM_ID, 'eats', 'weta', 'glues it down with slime'],
  [WORM_ID, 'eats', 'lanternbeetle'],
  ['quillhog', 'eats', WORM_ID, 'if it can stand the glue'],
);

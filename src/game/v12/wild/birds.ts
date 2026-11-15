// V12 two birds of the high country and the old forest, for the field guide (art: src/art/v12/wild/birds.ts),
// with their ecology entries, their minds and the API the scenes use:
//
//   Kea   the alpine parrot: bold, curious, a clown. Mori comes within ~150 px without sprinting and it
//         hops over to look at him (stopping ~20 px off), peers, calls. Stand still beside it for ~4 s
//         and it goes for the pack: tugs at it (peck), then KEA_CTX.steal(a); with loot it throws up its
//         wings (the orange-scarlet flash) and flies 180-300 px off along its home range, lands, plays
//         with it for a few seconds and KEA_CTX.drop(a, item, x, y)s it there. Sprint at it within
//         ~60 px and it bursts into the air (underwings flashing) and lands again ~150 px away.
//   Ruru  the morepork, a small brown owl. By day it roosts in its tree hollow, only its head and
//         shoulders over the lip, eyes shut to slits. ruruKnock(a): Mori knocked on the trunk; it wakes,
//         stares (act 'peek'), looks right round over its back ('headturn'), calls "more-pork" twice
//         ('call'), blinks at you ('blink') and settles ('roost') after ~10 s; knocked again within 20 s,
//         it just glares ('peek') and turns its head away ('headturn', the snub anim).
//         At dusk it climbs out and flies to a low perch near its tree (RURU_CTX.perch, else a 'perch' /
//         'branch' POI, else a spot 30-80 px out and 30-50 px up), calls now and then, pounces on
//         insects (catchInsect), and goes back into the hollow at dawn.
//
// API
//   KEA_ID, RURU_ID; KEA_SPECIES, RURU_SPECIES (the scene's species list registers them)
//   KEA_CTX { steal(a): string | null, drop(a, item, x, y) }     (filled in by the scene)
//   RURU_CTX { perch(a): [x, y] | null }                          (optional night perch, filled in by the scene)
//   spawnKea(f, x, { y?, home? }): Animal      y = a perch height (post, rock); default the ground
//   spawnRuru(f, hollowX, hollowY): Animal     hollowY = the hollow's lip line (draw the lip in front)
//   ruruKnock(a)                               Mori knocked on the ruru's trunk
//   ruruInHollow(a)                            is it in its hollow (head and shoulders only)

import type { Species } from '../../species';
import { ECO } from '../../wild/ecology';
import { Animal, SPECIALS, HOOKS } from '../../wild/animal';
import type { Body } from '../../wild/animal';
import type { PlayerLike } from '../../wild/world';
import type { FieldScene } from '../../scenes/field';
import type { FloatOpts } from '../../../ui/v12/float';
import { registerBeast } from '../../../art/beasts';
import { KEA, RURU } from '../../../art/v12/wild/birds';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';
import { rand, clamp } from '../../../core/math';

export const KEA_ID = 'kea';
export const RURU_ID = 'ruru';
registerBeast(KEA_ID, KEA);
registerBeast(RURU_ID, RURU);

/** what the scene does for a kea (the pack is the scene's business) */
export const KEA_CTX = {
  /** the kea has tugged at Mori's pack: take an item id out of it, or null if nothing came loose */
  steal: (_a: Animal): string | null => null,
  /** the kea has finished playing with the loot: put it on the ground at (x, y) */
  drop: (_a: Animal, _item: string, _x: number, _y: number): void => {},
};
/** what the scene can tell a ruru: where it sits at night (null: a perch POI near home, else open air near its tree) */
export const RURU_CTX = {
  perch: (_a: Animal): [number, number] | null => null,
};

// (the body painter and the floating text are loaded after boot, free of the import cycle through the
// species list: the scenes only spawn birds long after both have arrived)
let BODIES: typeof import('../../wild/bodies') | null = null;
let FLOAT: typeof import('../../../ui/v12/float') | null = null;
setTimeout(() => {
  import('../../wild/bodies').then(m => { BODIES = m; }).catch(e => console.warn('[birds] bodies', e));
  import('../../../ui/v12/float').then(m => { FLOAT = m; }).catch(e => console.warn('[birds] float', e));
}, 0);
function bodyFor(a: Animal): Body {
  if (BODIES) return BODIES.makeBody(a);
  let real: Body | null = null;
  const get = () => (real ??= BODIES ? BODIES.makeBody(a) : null);
  return {
    update: (dt, an) => get()?.update(dt, an),
    draw: (r, an) => get()?.draw(r, an),
    bounds: an => get()?.bounds(an) ?? { x0: an.x - 8, y0: an.y - 14, x1: an.x + 8, y1: an.y },
    head: an => get()?.head(an) ?? [an.x, an.y - 10],
    points: an => get()?.points(an) ?? [[an.x, an.y - 6]],
  };
}
function float(o: FloatOpts) {
  if (FLOAT) { void FLOAT.floatText(o); return; }
  import('../../../ui/v12/float').then(m => { FLOAT = m; void m.floatText(o); }).catch(() => {});
}

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });

// ==================================================================== the field guide
export const KEA_SPECIES: Species = {
  id: KEA_ID, name: 'Kea', sci: 'Nestor notabilis', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk'],
  rarity: 3, danger: 0, size: '46 cm long, about 1 kg, a metre across the wings',
  blurb: 'The parrot of the snow line: a big, solid olive-green parrot, every feather tipped black so it looks scaled, with a long, narrow, wickedly hooked grey bill. It is named for its cry, "keee-aa". Folded, it is the colour of the scrub; the moment it lifts its wings, the undersides and the rump blaze orange-scarlet. Bold, endlessly curious and a thief: it will take your lunch, your laces and your patience.',
  behaviors: {
    perched: 'Perched, looking about', hopping: 'Hopping about', investigating: 'Investigating', stealing: 'Raiding a pack',
    flying: 'Taking off (the orange underwings)', playing: 'Playing', calling: 'Calling "keee-aa"',
  },
  facts: [
    {
      id: 'kea-alpine', cat: 'Ecology', q: 'What makes the Kea unlike any other parrot?', options: ['It lives in the high mountains, above the bushline, right through the snowy winters', 'It cannot fly', 'It lives on the seashore and eats fish'], answer: 0,
      text: 'Parrots are birds of warm forests. The kea is the world\'s only alpine parrot: it lives up in the tussock, scree and snow, where food is scarce and every new thing might be worth eating. That hard life is why it is so bold and so curious.',
      evidence: [ph(KEA_ID, 'perched'), ph(KEA_ID, 'calling')], hint: 'A clear photo of one sitting about up in the high country. Don\'t worry about finding them: they find you.',
    },
    {
      id: 'kea-wings', cat: 'Anatomy', q: 'Why does a Kea flash orange when it takes off?', options: ['Its underwings and rump are orange-scarlet, hidden under the olive until it lifts its wings', 'It is warning that it is poisonous', 'It blushes when it is startled'], answer: 0,
      text: 'At rest the kea is the colour of the scrub and the rocks. The underwing lining and the rump are a blazing orange-red that only shows in flight, as if the bird had a sunset folded under its arms.',
      evidence: [ph(KEA_ID, 'flying')], hint: 'Catch one as it lifts off: run at it and shoot the take-off, or photograph its getaway when it flies off with something of yours.',
    },
    {
      id: 'kea-thief', cat: 'Behaviour', q: 'Why do Kea pull things apart and steal from people?', options: ['Curiosity: they test everything new with the bill, and they are clever enough to solve puzzles and use sticks as tools', 'They are starving', 'They line their nests with shiny things'], answer: 0,
      text: 'Kea work out multi-step puzzle boxes, use sticks as tools and even weigh up odds. Zips, buckles and tent pegs are just more puzzles. Young kea learn their whole world this way, beak first, and a backpack left alone is the best puzzle on the mountain.',
      evidence: [ph(KEA_ID, 'stealing'), ph(KEA_ID, 'investigating')], hint: 'Stand still beside a curious one and guard your pack... or don\'t. Photograph it at work.',
    },
    {
      id: 'kea-play', cat: 'Behaviour', q: 'Kea roll on their backs, toss stones and tumble together. Why?', options: ['Play: kea are among the few birds that really play, and their play call makes other kea start playing too', 'They are scratching an itch they cannot reach', 'They are fighting over territory'], answer: 0,
      text: 'Kea play like puppies: on their backs, feet in the air, juggling sticks and stones, wrestling and chasing through the air. A playing kea gives a warbling call, and when other kea hear it they join in. The urge to play is catching.',
      evidence: [ph(KEA_ID, 'playing')], hint: 'Watch one with something it has stolen: it can\'t help playing with it.',
    },
  ],
  research: {
    habitat: 'The high country above Te Kāinga: tussock, scree and the last twisted beech at the bushline, up into the snow. Gangs of young kea come down to the huts and the trail heads, because that is where the interesting things are: people.',
    diet: 'Almost anything. Berries, seeds, roots, shoots and nectar; beetle grubs dug and levered out of rotten wood with that bill; the odd lunch out of the odd pack.',
    anatomy: 'A big, heavy parrot, olive-green with every feather tipped black and a bronze sheen on the back. The upper bill is long, narrow and strongly hooked, a pick and a crowbar in one. Two toes forward and two back: feet that hold things like hands. Under the wings and on the rump, orange-scarlet.',
    ecology: 'A gardener of the mountains: it spreads the seeds of the alpine shrubs and turns over the ground digging for grubs and roots. It nests in burrows among rocks and roots, and the eggs and chicks are its weak point.',
    behaviour: 'Bold, curious and clownish. Kea live in loose gangs, the young ones most of all, and they test everything with the bill: boots, zips, tent pegs, Mori. They play, roll and wrestle, and a playing kea\'s warbling call sets the others off.',
    notes: [
      'It took my sandwich. Not some of my sandwich. All of it. Then it looked at me like I should say thank you.',
      'Koro says the kea is the mountain\'s clown and its alarm clock. "Keeee-aaa." At dawn. Every dawn.',
      'Aroha\'s advice: zip your pack and never leave your boots outside. My boots have new laces now. Well. Fewer laces.',
      'When it flew off with my pouch the underwings went up like a sunset and I forgot to be annoyed. For about a second.',
    ],
    status: 'A few gangs in the high country',
  },
};

export const RURU_SPECIES: Species = {
  id: RURU_ID, name: 'Ruru', sci: 'Ninox novaeseelandiae', group: 'Bird', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 3, danger: 0, size: '29 cm, about 175 g',
  blurb: 'The morepork: a small, dark owl the colour of chocolate, the breast streaked and blotched buff and white, white spots on the wings, a dark face with pale eyebrows and two huge yellow eyes. By day it dozes in a tree hollow; at night it calls "more-pork, more-pork" through the forest and drops without a sound on moths and wētā.',
  behaviors: {
    roosting: 'Roosting in its hollow', peeking: 'Staring out of its hollow', 'head-turning': 'Turning its head right round',
    calling: 'Calling "more-pork"', flying: 'Flying', hunting: 'Pouncing on prey',
  },
  facts: [
    {
      id: 'ru-call', cat: 'Behaviour', q: 'How did the Ruru get its English name, Morepork?', options: ['From its call: a soft double note, "more-pork", over and over through the night', 'Early travellers fed it scraps of pork', 'From the colour of its feathers'], answer: 0,
      text: 'Its name in te reo Māori, ruru, and its English name both come from its voice. The two-note call carries a long way through the forest at night, and pairs answer each other.',
      evidence: [ph(RURU_ID, 'calling')], hint: 'Knock on the old tree\'s trunk by day: it calls before it settles back down. Or wait near it after dark.',
    },
    {
      id: 'ru-silent', cat: 'Adaptation', q: 'How can a Ruru fly without making a sound?', options: ['The edges of its flight feathers are soft and comb-fringed, breaking up the rushing air', 'It only ever glides', 'It flies too slowly to make a noise'], answer: 0,
      text: 'The leading edge of each flight feather is fringed like a comb and the surfaces are velvety. The air slips over the wing without the whoosh other birds make, so the moth never hears it coming, and the owl can still hear the moth.',
      evidence: [ph(RURU_ID, 'flying')], hint: 'Be near its tree at dusk, when it climbs out of the hollow and flies.',
    },
    {
      id: 'ru-diet', cat: 'Diet', q: 'What does a Ruru hunt?', options: ['Mostly big insects (moths, beetles, wētā), and now and then a mouse or a small bird', 'Fruit and nectar', 'Fish from the streams'], answer: 0,
      text: 'It watches from a low perch, head swivelling, then drops onto whatever moves below, talons first. Moths are snatched out of the air. It hunts by ear as much as by eye.',
      evidence: [ph(RURU_ID, 'hunting')], hint: 'At night it sits on a low branch near its tree and drops on moths and wētā. Be ready when it pounces.',
    },
    {
      id: 'ru-neck', cat: 'Anatomy', q: 'Why does a Ruru turn its whole head to look at you?', options: ['Its eyes are fixed in their sockets, so it turns its head instead: about three-quarters of the way round', 'It is deaf in one ear', 'Its eyes only see straight ahead in daylight'], answer: 0,
      text: 'Owl eyes are long tubes, not balls, and they cannot roll in the skull. Instead the neck has extra vertebrae and a special blood supply, and the head swings round about 270 degrees without cutting off the blood.',
      evidence: [ph(RURU_ID, 'head-turning')], hint: 'Knock on the trunk of its tree and wait: after it stares at you, it looks right round over its back.',
    },
  ],
  research: {
    habitat: 'Old forest and its edges, wherever there are hollow trees to sleep in by day. Koro says there has been a ruru in the old tree near Te Kāinga since he was a boy. (Or its grandchildren. He is not sure. Neither is the ruru.)',
    diet: 'Big insects mostly: moths, beetles and wētā, snatched in the air or dropped on from a low branch. Now and then a mouse or a sleeping small bird.',
    anatomy: 'Small and dark: chocolate brown streaked buff and white below, white spots on the wings, a barred tail. A dark facial disc, pale brows, and big forward-facing yellow eyes fixed in their sockets, so the head turns instead, nearly all the way round. Soft, comb-edged flight feathers make it silent in the air. Yellow feet.',
    ecology: 'The night shift: it keeps the moths and wētā in check. By day the small birds sometimes find it roosting and mob it, scolding until it gives up and moves.',
    behaviour: 'Asleep by day in a hollow or thick leaves. At dusk it comes out to a low perch, calls "more-pork" and listens. It hears a moth in the dark and drops on it without a sound.',
    notes: [
      'I knocked on its tree. It opened one eye. Then the other. Then it looked at me like I owed it money.',
      'Koro says ruru is a watchful guardian, a kaitiaki. Tonight it was watching me very hard.',
      'Its head went round. And round. And further. I had to check my own neck afterwards.',
      'It flew right past my ear and I heard nothing. Not a whisper. Aroha heard me squeak, though.',
    ],
    status: 'Common in the old forest, by night',
  },
};

// ==================================================================== shared helpers
type Pl = PlayerLike & { running?: boolean; facing?: number };
const pl = (a: Animal) => a.host.player as Pl;
const sprinting = (a: Animal) => { const p = pl(a); return !!p.running || (p.noise >= 0.9 && Math.abs(p.vx) > 80); };
const gy = (a: Animal, x: number) => a.host.terrain.groundY(x);
/** standing on a walkable surface at its feet (else it is up on a perch, or in the air) */
const onSurface = (a: Animal) => { const s = a.host.terrain.surfaceBelow(a.x, a.y - 3, 0); return !!s && Math.abs(s.y - a.y) < 3; };

// ==================================================================== the kea's mind
ECO[KEA_ID] = {
  loco: 'flier', medium: 'ground', walk: 24, run: 95, bold: 1, aggro: 0, curious: 0.95, social: 0.6, alert: 0.45,
  sight: 210, hear: 1.1, flightDist: 16, food: ['fruit', 'seeds', 'roots', 'grub', 'insect', 'nectar'], defense: ['flee'],
  group: [1, 3], calls: { contact: 'callScreech', alarm: 'callScreech' }, size: 2,
  idle: [
    { act: 'perch', w: 3, dur: [4, 9] }, { act: 'hop', w: 2.4, dur: [4, 9] }, { act: 'peck', w: 2, dur: [3, 6] },
    { act: 'call', w: 1, dur: [2, 3] }, { act: 'play', w: 1, dur: [3, 6] },
  ],
  photo: {
    perch: 'perched', idle: 'perched', sit: 'perched', hop: 'hopping', wander: 'hopping', investigate: 'investigating', peck: 'investigating',
    steal: 'stealing', flee: 'flying', flyoff: 'flying', fly: 'flying', play: 'playing', toy: 'playing', call: 'calling',
  },
};

interface KeaKeep {
  /** its perch (a post, a rock) if it has one, else null */
  perch: [number, number] | null;
  /** seconds Mori has stood still right beside it */
  stillT: number;
  /** seconds before it takes an interest in Mori again */
  cool: number;
  /** the loot */
  item: string | null;
  /** where a flight is going */
  tx: number; ty: number;
}
const KK = new WeakMap<Animal, KeaKeep>();
const kk = (a: Animal) => { let k = KK.get(a); if (!k) { k = { perch: null, stillT: 0, cool: 0, item: null, tx: a.x, ty: a.y }; KK.set(a, k); } return k; };
/** acts that run to their own end: the brain keeps its hands off */
const KEA_LOCK = new Set(['steal', 'flyoff', 'toy', 'flee']);

/** a kea flight: up off its feet, flapping, a gliding approach, down onto (tx, ty); true on landing */
function keaFly(a: Animal, tx: number, ty: number, dt: number, anim = 'fly', speed = 0.85): boolean {
  if (a.medium !== 'air') { a.medium = 'air'; a.vy = -70; a.vx = Math.sign(tx - a.x || a.facing) * 30; a.host.sfx('wingFlap', a.x, 0.45, 1.1); }
  const d = Math.abs(tx - a.x);
  // an arc: climb while far off, then come down onto the spot
  const cruise = Math.min(a.y, ty) - clamp(d * 0.35, 6, 46);
  const aimY = d > 40 ? cruise : ty;
  const arrived = a.flyTo(tx, aimY, a.eco.run * speed, dt, 260) && d < 8;
  a.anim = anim === 'fly' ? (a.vy < -6 || d > 70 || Math.floor(a.actT * 3) % 2 === 0 ? 'fly' : 'glide') : anim;
  if (arrived || (d < 10 && Math.abs(a.y - ty) < 6)) {
    a.x = tx; a.y = ty; a.vx = a.vy = 0;
    a.medium = 'ground';
    if (onSurface(a) || Math.abs(ty - gy(a, tx)) < 4) a.settle();
    return true;
  }
  return false;
}
/** get to x: bouncing hops along the ground, or a short flight when it is up on a perch */
function keaGo(a: Animal, tx: number, dt: number, speed = 1): boolean {
  if (a.medium === 'air' || !onSurface(a)) return keaFly(a, tx, gy(a, tx), dt);
  a.anim = 'walk';
  const done = a.groundTo(tx, a.eco.walk * speed, dt);
  if (a.mem.blocked) { a.mem.blocked = 0; return keaFly(a, tx, gy(a, tx), dt); }
  return done;
}
const keaRest = (a: Animal, secs?: number) => a.setAct('perch', secs ?? rand.range(4, 8));
/** off its perch (or out of the air) down onto the ground a little way ahead */
function keaDown(a: Animal, dt: number) {
  if (a.mem.dx === undefined) a.mem.dx = a.x + a.facing * 20;
  keaFly(a, a.mem.dx, gy(a, a.mem.dx), dt);
}

SPECIALS[KEA_ID] = {
  ...(SPECIALS[KEA_ID] ?? {}),
  /** sitting about (on its perch if it has one): looking round, a head tilt, a preen */
  perch(a, dt) {
    a.vx = 0;
    if (a.medium === 'air') { keaFly(a, a.x, gy(a, a.x), dt); return; }
    a.anim = Math.floor(a.actT / 2.2) % 4 === 3 ? 'alert' : 'idle';
    const p = pl(a);
    if (Math.abs(p.x - a.x) < 220 && Math.floor(a.actT / 3) !== a.mem.look) { a.mem.look = Math.floor(a.actT / 3); a.face(p.x); }
  },
  /** bouncing about its home range */
  hop(a, dt) {
    const k = kk(a);
    if (a.mem.tx === undefined) {
      // a little way about its range (off a perch that is a flight down), now and then back up to its perch
      a.mem.tx = clamp(a.x + rand.range(-70, 70), a.home[0], a.home[1]);
      if (k.perch && onSurface(a) && rand.chance(0.35)) { a.mem.tx = k.perch[0]; a.mem.up = 1; }
    }
    if (a.mem.up) {
      if (keaFly(a, k.perch![0], k.perch![1], dt)) { keaRest(a); }
      return;
    }
    if (keaGo(a, a.mem.tx, dt)) keaRest(a, rand.range(2, 5));
  },
  /** working at something on the ground with the bill */
  peck(a, dt) {
    a.vx = 0;
    if (a.medium === 'air' || !onSurface(a)) { keaDown(a, dt); return; }
    a.anim = 'peck';
  },
  eat(a) { a.vx = 0; a.anim = 'eat'; },
  /** "keee-aa", head up */
  call(a) {
    a.vx = 0;
    a.anim = 'call';
    if (!a.mem.c) { a.mem.c = 1; a.call('contact'); if (rand.chance(0.5)) float({ text: 'keee-aa!', style: 'happy', x: a.x, y: a.y - 24, ms: 1100, voice: 0 }); }
    if (a.actT > 1.8) keaRest(a);
  },
  /** rolling on its back, feet kicking, tumbling upright again */
  play(a, dt) {
    a.vx = 0;
    if (a.medium === 'air' || !onSurface(a)) { keaDown(a, dt); return; }
    a.anim = 'play';
    if (!a.mem.e) { a.mem.e = 1; a.showEmote('music', 1.2); }
  },
  sleep(a, dt) {
    a.vx = 0;
    if (a.medium === 'air') { keaFly(a, a.x, gy(a, a.x), dt); return; }
    a.anim = 'sleep';
    if (a.actT > 1 && !a.emote && rand.chance(dt * 0.2)) a.showEmote('zzz', 2.2);
  },
  /** Mori is near: hop over to him, stop a beak's reach off, peer, call */
  investigate(a, dt) {
    const p = pl(a), k = kk(a);
    const d = p.x - a.x, ad = Math.abs(d);
    // (it stays as long as it likes, not as long as the generic brain allows)
    a.actDur = Math.max(a.actDur, a.actT + 2);
    if (!a.mem.q) { a.mem.q = 1; a.showEmote('question', 1.3, true); }
    if (ad > 190 || k.cool > 0) { keaRest(a, rand.range(3, 6)); return; }
    const want = 20;
    if (ad > want + 4 || a.medium === 'air' || !onSurface(a)) {
      keaGo(a, p.x - Math.sign(d || 1) * want, dt, 1.15);
      a.face(p.x);
      return;
    }
    a.vx = 0;
    a.face(p.x);
    // peering at him, head cocked; a call now and then
    const beat = Math.floor(a.actT / 1.6);
    if (beat !== a.mem.beat) {
      a.mem.beat = beat;
      a.mem.mode = rand.chance(0.18) ? 2 : rand.chance(0.5) ? 1 : 0;
      if (a.mem.mode === 2) { a.call('contact'); if (rand.chance(0.4)) float({ text: 'keee-aa?', style: 'happy', x: a.x, y: a.y - 24, ms: 1000, voice: 0 }); }
    }
    a.anim = a.mem.mode === 2 ? 'call' : a.mem.mode === 1 ? 'alert' : 'idle';
    // still beside it long enough: the pack
    if (k.stillT > 4 && k.cool <= 0) { a.setAct('steal', 30); return; }
    a.curio = Math.max(a.curio, 0.6);
    if (a.actT > 28) { k.cool = 12; keaRest(a); }
  },
  /** at the pack: tug, tug, tug... */
  steal(a, dt) {
    const p = pl(a), k = kk(a);
    const back = -(p.facing ?? (a.x < p.x ? -1 : 1));
    const tx = p.x + back * 7;
    if (Math.abs(p.x - a.x) > 40 || sprinting(a)) { k.cool = 10; a.showEmote('question', 1); keaRest(a); return; }
    if (!a.mem.at) {
      if (Math.abs(tx - a.x) > 2) { keaGo(a, tx, dt, 1.3); a.face(p.x); return; }
      a.mem.at = 1; a.mem.t0 = a.actT;
    }
    a.vx = 0; a.face(p.x);
    a.anim = 'peck';
    if (a.actT - a.mem.t0 > 1.8) {
      const item = KEA_CTX.steal(a);
      k.stillT = 0;
      if (!item) { k.cool = 14; a.showEmote('question', 1.3, true); a.setAct('investigate', 8); return; }
      k.item = item;
      a.showEmote('heart', 1.2, true);
      a.call('contact');
      // a getaway spot 180-300 px off, along its home range, away from Mori where it can
      const dir = a.x < p.x ? -1 : 1;
      let gx = a.x + dir * rand.range(180, 300);
      if (gx < a.home[0] - 60 || gx > a.home[1] + 60) gx = a.x - dir * rand.range(180, 300);
      k.tx = clamp(gx, a.host.minX + 30, a.host.maxX - 30);
      k.ty = gy(a, k.tx);
      a.setAct('flyoff', 30);
    }
  },
  /** off with the loot: wings thrown up (the flash), then away, carrying it */
  flyoff(a, dt) {
    const k = kk(a);
    if (a.actT < 0.4) { a.anim = 'flash'; a.vx = 0; a.face(k.tx); return; }
    if (keaFly(a, k.tx, k.ty, dt, 'carry', 0.9)) { a.anim = 'toy'; a.setAct('toy', rand.range(3.5, 6)); }
  },
  /** playing with the loot, then leaving it */
  toy(a) {
    const k = kk(a);
    a.vx = 0;
    a.anim = 'toy';
    if (!a.mem.e) { a.mem.e = 1; a.showEmote('music', 1.2); }
    if (a.actT > a.actDur) {
      if (k.item) KEA_CTX.drop(a, k.item, a.x + a.facing * 6, gy(a, a.x + a.facing * 6));
      k.item = null; k.cool = 20;
      keaRest(a, rand.range(5, 9));
    }
  },
  /** burst into the air, the orange flashing, and down again ~150 px off */
  flee(a, dt) {
    const k = kk(a), p = pl(a);
    if (!a.mem.go) {
      a.mem.go = 1;
      const dir = a.x < p.x ? -1 : 1;
      k.tx = clamp(a.x + dir * rand.range(130, 170), a.host.minX + 30, a.host.maxX - 30);
      k.ty = gy(a, k.tx);
      a.call('alarm');
    }
    if (a.actT < 0.3) { a.anim = 'flash'; a.vx = 0; return; }
    if (keaFly(a, k.tx, k.ty, dt, 'fly', 1)) { a.setAct('perch', rand.range(3, 6)); a.anim = 'alert'; }
  },
};

HOOKS[KEA_ID] = {
  ...(HOOKS[KEA_ID] ?? {}),
  // bold: Mori walking up is no threat (only a sprint is, and tick handles that)
  onThreat(a) { a.fear = 0; return true; },
  decide(a) {
    // (these end themselves; the brain only takes over if one has clearly hung)
    if (KEA_LOCK.has(a.act) && a.actT < a.actDur + 10) return true;
    const p = pl(a), k = kk(a);
    const d = Math.abs(p.x - a.x);
    if (a.host.tod === 'night') { if (a.act !== 'sleep') a.setAct('sleep', rand.range(10, 20)); return true; }
    if (d < 150 && !sprinting(a) && k.cool <= 0 && Math.abs(p.y - a.y) < 60) { a.setAct('investigate', 30); return true; }
    return false;
  },
  tick(a, dt) {
    const k = kk(a), p = pl(a);
    a.fear = 0;
    if (k.cool > 0) k.cool -= dt;
    // the pack-raid clock: Mori right beside it and barely moving
    if (a.act === 'investigate' && Math.abs(p.x - a.x) < 26 && Math.abs(p.vx) < 8) k.stillT += dt;
    else if (a.act !== 'steal') k.stillT = Math.max(0, k.stillT - dt * 3);
    // a sprint at it: off it goes
    if (a.act !== 'flee' && a.act !== 'flyoff' && a.act !== 'toy' && sprinting(a)) {
      const d = a.x - p.x;
      if (Math.abs(d) < 60 && Math.abs(p.y - a.y) < 50 && (Math.sign(p.vx) === Math.sign(d) || Math.abs(d) < 24)) { k.cool = 8; a.setAct('flee', 20); }
    }
  },
};

/** put a kea in the scene at x (on a perch at y, or on the ground) */
export function spawnKea(f: FieldScene, x: number, o: { y?: number; home?: [number, number] } = {}): Animal {
  const ground = f.st.terrain.groundY(x);
  const y = o.y ?? ground;
  const a = new Animal(KEA_ID, x, y, { home: o.home ?? [x - 260, x + 260], medium: 'ground' });
  a.host = f;
  a.facing = f.player.x > x ? 1 : -1;
  const k = kk(a);
  if (o.y !== undefined && Math.abs(o.y - ground) > 3) k.perch = [x, o.y];
  else a.settle();
  a.body = bodyFor(a);
  f.animals.push(a);
  f.main.add(a);
  a.setAct(f.tod === 'night' ? 'sleep' : 'perch', rand.range(2, 5));
  return a;
}

// ==================================================================== the ruru's mind
ECO[RURU_ID] = {
  loco: 'flier', medium: 'trunk', walk: 8, run: 72, bold: 0.7, aggro: 0, curious: 0.3, social: 0, alert: 0.6,
  sight: 190, hear: 1.8, nocturnal: true, flightDist: 34, food: ['insect'], defense: ['freeze'],
  group: [1, 1], calls: { contact: 'callHoot', song: 'callHoot', songWhen: ['dusk', 'night'] }, size: 1,
  idle: [{ act: 'roost', w: 1, dur: [20, 40] }],
  photo: {
    roost: 'roosting', sleep: 'roosting', peek: 'peeking', blink: 'peeking', emerge: 'peeking', headturn: 'head-turning', call: 'calling', nightcall: 'calling', leave: 'flying', homeward: 'flying', relocate: 'flying', watch: 'hunting', pounce: 'hunting',
  },
};

interface RuruKeep {
  hollow: [number, number];
  /** host time of the last knock (-1: never) */
  knockT: number;
  /** its perch for the night */
  perch: [number, number] | null;
  /** the insect it is going for */
  tx: number; ty: number;
  /** seconds to the next call / the next look for prey */
  callT: number; huntT: number;
  /** knocked again too soon: the next peek is a glare */
  annoyed: boolean;
}
const RK = new WeakMap<Animal, RuruKeep>();
const rk = (a: Animal) => { let k = RK.get(a); if (!k) { k = { hollow: [a.x, a.y], knockT: -1, perch: null, tx: a.x, ty: a.y, callT: rand.range(4, 10), huntT: rand.range(3, 8), annoyed: false }; RK.set(a, k); } return k; };
const RURU_HOLLOW = new Set(['roost', 'peek', 'headturn', 'call', 'blink', 'emerge']);
/** the ruru is in its hollow (head and shoulders over the lip) */
export const ruruInHollow = (a: Animal) => RURU_HOLLOW.has(a.act);
const RURU_LOCK = new Set(['peek', 'headturn', 'call', 'blink', 'emerge', 'leave', 'homeward', 'watch', 'pounce', 'relocate', 'nightcall']);
const dark = (a: Animal) => a.host.tod === 'dusk' || a.host.tod === 'night';
/** sit at the hollow's lip, sunk inside: never falls to the ground */
function atHollow(a: Animal) {
  const k = rk(a);
  a.x = k.hollow[0]; a.y = k.hollow[1]; a.vx = a.vy = 0;
  a.medium = 'trunk';
  a.hidden = 0;
}
function hoot(a: Animal) {
  a.call('song');
  const [hx, hy] = a.headPos();
  float({ text: 'more-pork!', style: 'whisper', x: hx, y: Math.min(hy, a.y) - 8, ms: 1600, voice: 0 });
}
/** its night perch: what the scene says, a perch / branch POI near home, or a spot near its tree */
function nightPerch(a: Animal): [number, number] {
  const k = rk(a);
  const ctx = RURU_CTX.perch(a);
  if (ctx) return ctx;
  const pois = a.host.pois.filter(p => (p.kind === 'perch' || p.kind === 'branch') && Math.abs(p.x - k.hollow[0]) < 110 && (p.p ?? 1) === 1);
  if (pois.length) { const q = pois[Math.floor(rand.next() * pois.length)]; return [q.x, q.y]; }
  const x = clamp(k.hollow[0] + (rand.chance(0.5) ? -1 : 1) * rand.range(30, 80), a.host.minX + 20, a.host.maxX - 20);
  return [x, gy(a, x) - rand.range(30, 50)];
}
/** an owl's flight: silent flapping, gliding in to the spot */
function ruruFly(a: Animal, tx: number, ty: number, dt: number): boolean {
  if (a.medium !== 'air') { a.medium = 'air'; a.vy = -30; }
  const d = Math.hypot(tx - a.x, ty - a.y);
  const arrived = a.flyTo(tx, ty, a.eco.run * 0.6, dt, 200);
  a.anim = d < 26 || Math.floor(a.actT * 2.5) % 3 === 2 ? 'glide' : 'fly';
  if (arrived || d < 3) { a.x = tx; a.y = ty; a.vx = a.vy = 0; a.medium = 'trunk'; return true; }
  return false;
}

SPECIALS[RURU_ID] = {
  ...(SPECIALS[RURU_ID] ?? {}),
  /** by day: dozing in the hollow, eyes shut to slits; a noisy Mori close by gets one eye opened */
  roost(a) {
    atHollow(a);
    const p = pl(a);
    const near = Math.abs(p.x - a.x) < 70 && p.noise > 0.5;
    if (near && !a.mem.stir) { a.mem.stir = a.actT; a.face(p.x); }
    a.anim = a.mem.stir && a.actT - a.mem.stir < 1.6 ? 'blink' : 'roost';
    if (a.mem.stir && a.actT - a.mem.stir > 6) a.mem.stir = 0;
  },
  sleep(a) { if (rk(a) && a.medium !== 'air' && Math.abs(a.y - rk(a).hollow[1]) < 2 && Math.abs(a.x - rk(a).hollow[0]) < 2) a.setAct('roost', 30); else a.setAct('homeward', 40); },
  // ---- the knock: stare, look right round, "more-pork" twice, settle. Knocked again too soon (annoyed):
  // a glare, and the head turned away
  peek(a) {
    const k = rk(a);
    atHollow(a); a.face(pl(a).x);
    a.anim = 'peek';
    if (!a.mem.e) { a.mem.e = 1; a.showEmote(k.annoyed ? 'anger' : 'exclaim', k.annoyed ? 1.6 : 1, true); }
    if (a.actT > (k.annoyed ? 1.4 : 2.0)) a.setAct('headturn', k.annoyed ? 3 : 2.0);
  },
  headturn(a) {
    const k = rk(a);
    atHollow(a);
    a.anim = k.annoyed ? 'snub' : 'headturn';
    if (a.actT > a.actDur) {
      if (k.annoyed) { k.annoyed = false; a.setAct('roost', 30); }
      else a.setAct('call', 2.6);
    }
  },
  call(a) {
    atHollow(a); a.face(pl(a).x);
    a.anim = 'call';
    // the call anim's beats land 0.2 s into each 1.2 s cycle: one "more-pork" a cycle, twice
    const beat = Math.floor((a.actT + 1.0) / 1.2);
    if (beat !== a.mem.beat && a.actT < 2.4) { a.mem.beat = beat; hoot(a); }
    if (a.actT > 2.6) a.setAct('blink', 3.6);
  },
  blink(a) {
    atHollow(a);
    a.anim = 'blink';
    if (a.actT > a.actDur) a.setAct('roost', 30);
  },
  // ---- dusk: a look out, up onto the lip, and away to its perch
  emerge(a) {
    atHollow(a);
    a.anim = a.actT < 0.8 ? 'peek' : 'perch';
    if (a.actT > 2.0) { const k = rk(a); k.perch = nightPerch(a); a.face(k.perch[0]); a.host.sfx('wingFlap', a.x, 0.12, 1.4); a.setAct('leave', 30); }
  },
  leave(a, dt) {
    const k = rk(a);
    if (!k.perch) k.perch = nightPerch(a);
    if (ruruFly(a, k.perch[0], k.perch[1], dt)) a.setAct('nightperch', rand.range(14, 26));
  },
  /** on its night perch: head swivelling, listening, a call now and then, an eye out for insects */
  nightperch(a, dt) {
    const k = rk(a);
    if (!k.perch) k.perch = nightPerch(a);
    if (a.medium === 'air' || Math.abs(a.x - k.perch[0]) > 2 || Math.abs(a.y - k.perch[1]) > 2) { if (!ruruFly(a, k.perch[0], k.perch[1], dt)) return; }
    a.vx = a.vy = 0; a.medium = 'trunk';
    a.anim = Math.floor(a.actT / 3) % 3 === 2 ? 'idle' : 'perch';
    k.callT -= dt; k.huntT -= dt;
    if (k.callT <= 0) { k.callT = rand.range(9, 20); a.setAct('nightcall', 2.6); return; }
    if (k.huntT <= 0) {
      k.huntT = rand.range(5, 10);
      const prey = spotInsect(a);
      if (prey) { k.tx = prey[0]; k.ty = prey[1]; a.face(prey[0]); a.setAct('watch', 1.2); return; }
    }
  },
  nightcall(a) {
    a.vx = a.vy = 0;
    a.anim = 'perchcall';
    const beat = Math.floor((a.actT + 1.0) / 1.2);
    if (beat !== a.mem.beat && a.actT < 2.4) { a.mem.beat = beat; hoot(a); }
    if (a.actT > 2.6) a.setAct('nightperch', rand.range(10, 20));
  },
  /** prey spotted: a still, fixed stare, head bobbing to range it */
  watch(a) {
    a.vx = a.vy = 0;
    a.anim = Math.floor(a.actT * 4) % 2 ? 'perch' : 'idle';
    a.face(rk(a).tx);
    if (a.actT > 1.2) a.setAct('pounce', 6);
  },
  /** the drop: wings up, talons forward, onto it; a moment on the ground; back up to the perch */
  pounce(a, dt) {
    const k = rk(a);
    if (!a.mem.ph) {
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = 20; }
      const d = Math.hypot(k.tx - a.x, k.ty - a.y);
      const hit = a.flyTo(k.tx, k.ty, a.eco.run * 0.9, dt, 420);
      a.anim = d < 34 ? 'pounce' : 'glide';
      if (hit || d < 5) {
        a.x = k.tx; a.y = k.ty; a.vx = a.vy = 0;
        a.mem.ph = 1; a.mem.t1 = a.actT;
        if (a.host.catchInsect?.(k.tx, k.ty - 3, 16)) { a.hunger = Math.max(0, a.hunger - 0.25); a.jaw = 1; a.showEmote('heart', 0.9, true); }
      }
      return;
    }
    if (a.mem.ph === 1) {
      a.anim = 'pounce';
      if (a.actT - a.mem.t1 > 0.9) a.mem.ph = 2;
      return;
    }
    if (!k.perch) k.perch = nightPerch(a);
    if (ruruFly(a, k.perch[0], k.perch[1], dt)) a.setAct('nightperch', rand.range(10, 20));
  },
  /** disturbed on its perch: off to another */
  relocate(a, dt) {
    const k = rk(a);
    if (!a.mem.go) { a.mem.go = 1; k.perch = nightPerch(a); }
    if (ruruFly(a, k.perch![0], k.perch![1], dt)) a.setAct('nightperch', rand.range(10, 20));
  },
  /** dawn: back to the hollow, onto the lip, and in */
  homeward(a, dt) {
    const k = rk(a);
    if (!a.mem.home) {
      if (ruruFly(a, k.hollow[0], k.hollow[1], dt)) { a.mem.home = 1; a.mem.t1 = a.actT; }
      return;
    }
    atHollow(a);
    a.anim = 'perch';
    if (a.actT - a.mem.t1 > 0.9) a.setAct('roost', 30);
  },
};

/** an insect within reach below its perch (the scene's flying insects), else sometimes a guess at a rustle on the ground */
function spotInsect(a: Animal): [number, number] | null {
  const bugs = (a.host as unknown as { insects?: { bugs?: { x: number; y: number; dead?: boolean; kind?: string }[] } }).insects?.bugs;
  if (bugs) {
    let best: [number, number] | null = null, bd = 1e9;
    for (const b of bugs) {
      if (b.dead || b.kind === 'ant' || b.kind === 'cicada') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 110 || dy < -10 || dy > 90) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = [b.x, b.y]; }
    }
    if (best) return best;
  }
  // a rustle in the leaf litter: worth a look (a wētā, maybe)
  if (rand.chance(0.45)) { const x = a.x + (rand.chance(0.5) ? -1 : 1) * rand.range(24, 70); return [x, gy(a, x)]; }
  return null;
}

HOOKS[RURU_ID] = {
  ...(HOOKS[RURU_ID] ?? {}),
  onThreat(a) {
    // in the hollow it trusts the tree; out on a perch, a close, fast Mori moves it on
    if (ruruInHollow(a) || RURU_LOCK.has(a.act)) { a.fear = 0; return true; }
    a.fear = 0.2;
    a.setAct('relocate', 20);
    return true;
  },
  decide(a) {
    // (these end themselves; the brain only takes over if one has clearly hung)
    if (RURU_LOCK.has(a.act) && a.actT < a.actDur + 10) return true;
    if (ruruInHollow(a)) {
      if (dark(a)) { a.setAct('emerge', 3); return true; }
      if (a.act !== 'roost') a.setAct('roost', 30); else a.actDur = a.actT + 30;
      return true;
    }
    if (!dark(a)) { a.setAct('homeward', 40); return true; }
    if (a.act !== 'nightperch') a.setAct('nightperch', rand.range(12, 24)); else a.actDur = a.actT + 20;
    return true;
  },
  tick(a) {
    if (ruruInHollow(a)) { a.fear = 0; atHollow(a); }
  },
};

/** put a ruru in its hollow: hollowY is the lip line (the scene draws the lip in front of it) */
export function spawnRuru(f: FieldScene, hollowX: number, hollowY: number): Animal {
  const a = new Animal(RURU_ID, hollowX, hollowY, { home: [hollowX - 80, hollowX + 80], medium: 'trunk' });
  a.host = f;
  a.facing = f.player.x > hollowX ? 1 : -1;
  rk(a).hollow = [hollowX, hollowY];
  a.body = bodyFor(a);
  f.animals.push(a);
  f.main.add(a);
  if (f.tod === 'dusk' || f.tod === 'night') { a.setAct('emerge', 3); a.actT = 1.9; }
  else a.setAct('roost', 30);
  return a;
}

/** Mori knocked on the ruru's trunk */
export function ruruKnock(a: Animal): void {
  const k = rk(a);
  const now = a.host.time;
  const again = k.knockT >= 0 && now - k.knockT < 20;
  k.knockT = now;
  a.face(pl(a).x);
  if (!ruruInHollow(a)) { a.showEmote('question', 1.2, true); return; }
  k.annoyed = again;
  // (restart the stare even if it is already staring)
  a.setAct('roost', 1);
  a.setAct('peek', again ? 1.4 : 2.0);
}

FUN[KEA_ID] = 'A kea\'s play call is catching: play a recording of it to wild kea and they start rolling, tossing things and chasing each other. Scientists compare it to laughter.';
FUN[RURU_ID] = 'A ruru cannot move its eyes in their sockets, so it turns its whole head instead: about 270 degrees, three-quarters of the way round.';
WEB.push(
  [KEA_ID, 'eats', 'jewelbeetle', 'digs the grubs out of rotten wood'],
  [RURU_ID, 'eats', 'lanternmoth', 'snatched out of the dark by sound'],
  [RURU_ID, 'eats', 'caveweta', 'waits for them at the cave mouth'],
  [RURU_ID, 'rival', 'hunterbat', 'the same moths, the same night'],
);

// V12 Te Ara Matatū, chapters 4-7: the three new animals for the field guide, their ecology and the
// small scripting kit the chapters stage them with (art: src/art/v12/arc/cephalopod.ts, eggthief.ts,
// ancient.ts).
//
//   Te Wheke Kōhatu (WHEKE_ID 'wheke')         the giant stone-den octopus of the Deep, chapter 5
//   Kaipāhua (THIEF_ID 'kaipahua')             the ash robber crab of Motu Ahi, chapter 6
//   Te Ngārara Nui (ANCIENT_ID 'ngararanui')   the Old One of Te Korokoro, the finale
//
// All three are driven by the chapters (they do not wander on their own minds): spawnArc() puts one in
// a scene, and the script calls below run it. Each act name is also its photo behaviour (ECO.photo).
//
// ------------------------------------------------------------------ API
//   spawnArc(f, id, x, y, { facing?, act?, anim?, medium? }): Animal
//   arcHold(a, act, anim)                       hold a pose (the act is what the camera reads) until the next call
//   arcWait(a, act, anim, secs): Promise        hold a pose for secs
//   arcGo(a, act, anim, tx, ty, speed, o?): Promise   move (ground animals keep to the ground) to tx, ty;
//                                               o.face: which way it faces while moving (default: the way it goes)
//   arcTask(a, act, anim, tick): Promise        run tick(a, dt) each frame until it returns true
//   arcBusy(a)                                  a move or wait is running
// Photo keys (species / behaviour): wheke: denning display jetting inking colour crawling hovering grabbing;
//   kaipahua: sneaking stealing feeding threat fleeing hiding; ngararanui: tell strike retreat basking calling walking.

import type { Species } from '../../species';
import type { FieldScene } from '../../scenes/field';
import { ECO } from '../../wild/ecology';
import { Animal, SPECIALS, HOOKS } from '../../wild/animal';
import type { Body } from '../../wild/animal';
import { registerBeast } from '../../../art/beasts';
import { WHEKE } from '../../../art/v12/arc/cephalopod';
import { EGGTHIEF } from '../../../art/v12/arc/eggthief';
import { ANCIENT } from '../../../art/v12/arc/ancient';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';

export const WHEKE_ID = 'wheke';
export const THIEF_ID = 'kaipahua';
export const ANCIENT_ID = 'ngararanui';
registerBeast(WHEKE_ID, WHEKE);
registerBeast(THIEF_ID, EGGTHIEF);
registerBeast(ANCIENT_ID, ANCIENT);

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });

// ================================================================== the field guide
export const WHEKE_SPECIES: Species = {
  id: WHEKE_ID, name: 'Te Wheke Kōhatu (Stone-den Octopus)', sci: 'Enteroctopus lithophilus', group: 'Mollusc', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 5, danger: 2, size: 'Arms 2.6 m across, about 40 kg',
  blurb: 'A giant octopus of the cold Deep, brick red and warty, with a gold eye barred black under a twisted horn of skin. It lives in a den it builds itself, a heap of boulders it drags into place, and it decorates the doorway with whatever catches its eye: shells, bones, glass, and one carved stone eye it will not give up without a fight.',
  behaviors: { denning: 'In its den, watching', display: 'The ghost display (pale, arms flung wide)', jetting: 'Jetting', inking: 'Throwing ink', colour: 'A passing cloud of colour', crawling: 'Walking on its arms', hovering: 'Hovering over the bed', grabbing: 'Reaching to grab' },
  facts: [
    {
      id: 'wk-den', cat: 'Behaviour', q: 'How does Te Wheke Kōhatu make its den?', options: ['It drags boulders into a heap and works a hollow under them, then piles stones in the doorway behind it', 'It digs a burrow in the sand', 'It moves into an old shipwreck'], answer: 0,
      text: 'Giant octopuses are builders. This one carries stones heavier than Mori across the bed with its arms and piles them into a den with a narrow door, and at night it pulls a stone across behind itself like a gate.',
      evidence: [ph(WHEKE_ID, 'denning')], hint: 'Find its den under the drowned watcher in the Deep. Come slowly; it watches from the door.',
    },
    {
      id: 'wk-ghost', cat: 'Adaptation', q: 'Why does it suddenly go ghost-white with a black ring round its eye?', options: ['A startle display: the sudden change makes a predator hesitate long enough for it to escape', 'It is frightened sick', 'It is about to lay eggs'], answer: 0,
      text: 'Octopus skin is packed with colour cells it opens and closes with muscle, thousands at once. Going pale with dark edges and throwing its arms wide makes it look twice the size in a heartbeat. Most things that see it think again.',
      evidence: [ph(WHEKE_ID, 'display')], hint: 'Crowd it at its den and it will show you. Have the camera up.',
    },
    {
      id: 'wk-cloud', cat: 'Anatomy', q: 'What are the dark waves that roll across its body when it is still?', options: ['"Passing clouds": waves of colour cells firing in sequence, maybe to startle prey into moving', 'Its blood moving', 'Shadows of kelp'], answer: 0,
      text: 'A dark band sweeps over the skin from the arms to the mantle and back, again and again. Octopuses do it while hunting: a crab that twitches at the moving shadow gives itself away.',
      evidence: [ph(WHEKE_ID, 'colour'), ph(WHEKE_ID, 'hovering')], hint: 'Watch it hover over the bed outside its den. Wait for the colour to move.',
    },
    {
      id: 'wk-jet', cat: 'Behaviour', q: 'How does it move when it is in a hurry?', options: ['Jet propulsion: it fills its mantle and squeezes the water out through its funnel, mantle first', 'It swims with its arms like a frog', 'It rolls along the bottom'], answer: 0,
      text: 'Walking on its arms is its everyday gait. In a hurry it jets, arms streamed behind, and if that is not enough it fires a cloud of ink the shape of itself and leaves the cloud to take the blame.',
      evidence: [ph(WHEKE_ID, 'jetting'), ph(WHEKE_ID, 'inking')], hint: 'Take what it guards and it will come after you. Fast.',
    },
  ],
  research: {
    habitat: 'The cold floor of the Deep under the headland, among drowned stones. Each one holds a den for years, often the same den its mother held.',
    diet: 'Crabs, crayfish, shellfish it drills or prises open, the odd fish; it hunts at dusk and night by feel, tasting with its suckers.',
    anatomy: 'A soft mantle holding the gills and the heart (three of them), eight arms each lined with two rows of suckers that taste and grip, a parrot beak of horn at the centre of the web, big camera eyes with a bar-shaped pupil, and skin that changes colour and texture in a blink.',
    ecology: 'Top of the bed. The Leviathan takes one now and then; seals avoid them. Its middens of empty shells around the den feed whole crowds of small scavengers.',
    behaviour: 'A curious, careful animal that learns faces. It collects: shiny shells, glass, bones, carved stone. Take something from its door and it follows, jetting, grabbing, inking, until it gets it back or you get out of its water.',
    notes: [
      'It looked at me. Not at the camera. At ME. And then it looked at the eye stone. Then at me again.',
      'Three hearts, blue blood, and it can taste with its arms. I have one heart and I can barely taste with my mouth.',
      'It went WHITE. All at once. Like someone switched it off. I nearly breathed in the sea.',
      'Koro says a great wheke chased Kupe all the way across the ocean to this land. I believe the octopus part.',
    ],
    status: 'One known: the den under the drowned watcher',
  },
};

export const THIEF_SPECIES: Species = {
  id: THIEF_ID, name: 'Kaipāhua (Ash Robber Crab)', sci: 'Cinerocarcinus praedator', group: 'Crustacean', sites: [], times: ['dusk', 'night'],
  rarity: 4, danger: 1, size: '45 cm across the shell, about 4 kg',
  blurb: 'A land crab of Motu Ahi as heavy as a cat: a basalt-black shell gritty with pale granules, ember-orange joints and leg tips, eyes on long stalks, and one enormous ivory-fingered crusher claw for cracking eggs. By day it hides down the warm cracks round the vents; at dusk it comes up in gangs to raid the seabird colony.',
  behaviors: { sneaking: 'Sneaking low toward the nests', stealing: 'Stealing an egg', feeding: 'Cracking an egg', threat: 'Claws up (the threat)', fleeing: 'Bolting for the cracks', hiding: 'Hunkered flat' },
  facts: [
    {
      id: 'kp-claw', cat: 'Anatomy', q: 'Why is one of its claws so much bigger than the other?', options: ['The big one is a crusher for cracking eggs and shells; the small one picks out the food', 'The small one is growing back', 'The big one is only for fighting'], answer: 0,
      text: 'Its crusher has blunt molar-like teeth and a muscle that fills the whole palm. The small claw is a fine tool for picking and feeding. Lose either and it grows a new one over a few moults.',
      evidence: [ph(THIEF_ID, 'feeding'), ph(THIEF_ID, 'threat')], hint: 'Photograph it cracking an egg, or with its claws up at you.',
    },
    {
      id: 'kp-heat', cat: 'Adaptation', q: 'Why does it live down the cracks round the steam vents?', options: ['The warm, wet air keeps its gills damp and the ground is too hot for the birds to dig it out', 'It eats sulphur', 'It is cooking its food'], answer: 0,
      text: 'Land crabs still breathe with gills and must keep them wet. The vent cracks are a steam bath, and no seabird will follow it down into the heat.',
      evidence: [ph(THIEF_ID, 'hiding')], hint: 'Scare one and it runs for the vents. Catch it hunkered down.',
    },
    {
      id: 'kp-gang', cat: 'Behaviour', q: 'How do the robber crabs raid a colony full of angry birds?', options: ['In waves at dusk: the birds chase the first few, and the rest slip in behind', 'One at a time at noon', 'They dig up under the nests'], answer: 0,
      text: 'The colony is loudest at dusk, the parents coming in from the sea. The crabs come up together; while the birds mob the first ones, the others get to the eggs.',
      evidence: [ph(THIEF_ID, 'sneaking'), ph(THIEF_ID, 'stealing')], hint: 'Keep watch over the nests at dusk.',
    },
    {
      id: 'kp-flash', cat: 'Behaviour', q: 'What is the surest way to send a robber crab back down its hole without hurting it?', options: ['Startle it: a sudden flash, a loud noise or a rush toward it, and it bolts', 'Feed it something else', 'Stand very still'], answer: 0,
      text: 'Its stalked eyes are very sensitive to sudden light and movement: a flash or a shout and it drops everything, egg and all, and runs. The birds know it too: they mob it with their wings.',
      evidence: [ph(THIEF_ID, 'fleeing')], hint: 'A photo of one fleeing. The camera flash will do it.',
    },
  ],
  research: {
    habitat: 'The warm cracks and steam vents of Motu Ahi; up to the colony ledges at dusk.',
    diet: 'Eggs, chicks that fall, fish the birds drop, carrion, fallen fruit of the coastal scrub. Anything.',
    anatomy: 'A heavy basalt-coloured shell, gills kept wet in chambers it tops up from dew and the vents, four pairs of spiny walking legs, stalked eyes that fold into grooves, a crusher and a picker.',
    ecology: 'The colony\'s great thief, and in its way its gardener: it takes the weak eggs first. Gale hawks and the crag viper hunt it; the auks mob it.',
    behaviour: 'Shy and bold at once: it creeps, freezes, rushes. It will threaten anything that corners it, claws up and spread, but it would always rather run.',
    notes: [
      'It held the egg up in that massive claw like a trophy. And then it looked at me. The audacity.',
      'One flash and it dropped the egg (the egg was fine, it landed in the down) and ran sideways at a speed I did not think crabs were allowed.',
      'Aroha says her nan called them kaipāhua, plunderers. Nan was right.',
    ],
    status: 'Common on Motu Ahi',
  },
};

export const ANCIENT_SPECIES: Species = {
  id: ANCIENT_ID, name: 'Te Ngārara Nui (the Old One)', sci: 'Sphenodon kaitiaki', group: 'Reptile', sites: [], times: ['dawn', 'day', 'dusk', 'night'],
  rarity: 5, danger: 4, size: 'Seven metres, snout to tail. Age unknown.',
  blurb: 'A tuatara as long as a waka, the last of a line older than the dinosaurs, living in the warm throat of the island. The heavy wedge of a head with a beaked jaw and the long closed smile, a dark eye under a heavy brow, a third eye on its crown that catches the light, and a crest of soft white spines it raises like a mane. Lichen grows on its back. The old stone watchers of the island are carved in its shape.',
  behaviors: { tell: 'The warning (crest up, throat swelling, the third eye)', strike: 'The strike', retreat: 'Going back into the dark', basking: 'Basking on warm stone', calling: 'Calling', walking: 'Walking' },
  facts: [
    {
      id: 'ng-tell', cat: 'Behaviour', q: 'What does Te Ngārara Nui do before it strikes?', options: ['It rises on straight legs, raises its crest, swells its throat and lifts its head: a warning, always given', 'Nothing: it strikes from stillness', 'It hisses and spits'], answer: 0,
      text: 'Tuatara settle quarrels with display before they ever bite: the crest erect and pale, the body lifted and turned side-on to look bigger, the throat puffed. The Old One gives the warning every time. It is a fair animal.',
      evidence: [ph(ANCIENT_ID, 'tell')], hint: 'Photograph the warning. Keep your distance while you do.',
    },
    {
      id: 'ng-strike', cat: 'Anatomy', q: 'What is unusual about the Old One\'s bite?', options: ['Its teeth are part of the jawbone itself, and the lower jaw slides forward as it closes, like a saw', 'It has no teeth at all', 'Its bite is venomous'], answer: 0,
      text: 'Tuatara teeth are not set in sockets: they are serrations of the jawbone, a double row above meeting a single row below, and the jaw shears forward as it shuts. Nothing else alive bites quite like it.',
      evidence: [ph(ANCIENT_ID, 'strike')], hint: 'Photograph the strike itself. It is fast: the moment the head drives forward.',
    },
    {
      id: 'ng-eye', cat: 'Adaptation', q: 'What is the pale scale on top of its head?', options: ['The parietal eye: a third eye with a lens and retina under the skin, that reads light and the seasons', 'A scar', 'A horn that has worn down'], answer: 0,
      text: 'The parietal eye is a true eye, covered by scales, wired to the brain. In young tuatara you can see it; in the Old One it shows when the crest lifts. It may keep its clock, and tell it the season.',
      evidence: [ph(ANCIENT_ID, 'tell'), ph(ANCIENT_ID, 'retreat')], hint: 'A clear side-on photo, the head lit.',
    },
    {
      id: 'ng-old', cat: 'Activity', q: 'How can a tuatara live so long?', options: ['It lives slowly: a low body temperature, a slow heart, years between breeding, growing until it is over a hundred', 'It hibernates for decades', 'It sheds its skin and starts again'], answer: 0,
      text: 'Tuatara are active in cold that would stop any other reptile, breathe once an hour when resting, and grow until they are thirty-five. The old ones are past a century. The Old One of the throat may be far, far older than that.',
      evidence: [ph(ANCIENT_ID, 'retreat'), ph(ANCIENT_ID, 'basking')], hint: 'Watch it go back into the dark. Do not follow.',
    },
  ],
  research: {
    habitat: 'Te Korokoro, the throat of the island: a sinkhole kept warm by the steam that rises through it.',
    diet: 'Unknown. Its droppings are full of eel bones and crayfish shell from the throat\'s lake, and the bones of very large birds.',
    anatomy: 'A tuatara grown huge: beaked jaw with teeth of the bone itself, a third eye on its crown, a crest of soft spines, granular scales, a long heavy tail it can sweep like a log.',
    ecology: 'Nothing on the island could hurt it. It is the island\'s oldest witness: the watchers were carved in its image by people who knew it was here and left it alone.',
    behaviour: 'Slow, careful, utterly fair: it warns before it strikes and strikes once. It does not chase. When it has made its point it goes back into the dark.',
    notes: [
      'I did not fight it. I would not have known how. I took three photographs and I breathed, and it let me.',
      'Its eye is not a lizard\'s eye. It is an old man\'s eye. It looked at me like Koro does when I have done something stupid and also something right.',
      'The watchers were never pointing at treasure. They were pointing at it. Saying: here. Mind your manners.',
      'I am not telling the agency. Some things do not go in a report.',
    ],
    status: 'One. Only one. Leave it be.',
  },
};

// ================================================================== the ecology (minds stay out of the way)
const still = (photo: Record<string, string>) => ({
  bold: 1, aggro: 0, curious: 0, social: 0, alert: 0.2, sight: 140, hear: 0.5, flightDist: 0, food: [], fears: [], defense: ['freeze'],
  group: [1, 1], calls: {}, idle: [{ act: 'idle', w: 1, dur: [999, 999] }], photo,
});
ECO[WHEKE_ID] = { loco: 'swimmer', medium: 'water', walk: 20, run: 80, size: 3, ...still({ den: 'denning', display: 'display', jet: 'jetting', ink: 'inking', flash: 'colour', crawl: 'crawling', idle: 'hovering', grab: 'grabbing' }) } as never;
ECO[THIEF_ID] = { loco: 'walker', medium: 'ground', walk: 26, run: 90, size: 1, ...still({ sneak: 'sneaking', grab: 'stealing', carry: 'stealing', crack: 'feeding', threat: 'threat', flee: 'fleeing', hide: 'hiding', walk: 'sneaking' }) } as never;
ECO[ANCIENT_ID] = { loco: 'walker', medium: 'ground', walk: 18, run: 40, size: 4, ...still({ tell: 'tell', strike: 'strike', retreat: 'retreat', bask: 'basking', call: 'calling', walk: 'walking' }) } as never;

// ================================================================== the scripting kit
type Tick = (a: Animal, dt: number) => boolean;
interface Run { tick: Tick | null; done: (() => void) | null }
const RUN = new WeakMap<Animal, Run>();
const runner = (a: Animal, dt: number) => {
  const r = RUN.get(a);
  a.actDur = a.actT + 999;
  if (!r?.tick) return;
  if (r.tick(a, dt)) { const d = r.done; r.tick = null; r.done = null; d?.(); }
};
const ACTS = ['idle', 'den', 'display', 'jet', 'ink', 'flash', 'crawl', 'grab', 'sneak', 'walk', 'carry', 'crack', 'threat', 'flinch', 'flee', 'hide', 'tell', 'strike', 'retreat', 'bask', 'call', 'sleep', 'wander', 'swim', 'freeze'];
for (const id of [WHEKE_ID, THIEF_ID, ANCIENT_ID]) {
  SPECIALS[id] = { ...(SPECIALS[id] ?? {}), ...Object.fromEntries(ACTS.map(k => [k, runner])) };
  HOOKS[id] = { onThreat: a => { a.fear = 0; return true; }, decide: () => true, tick: a => { a.fear = 0; a.anger = 0; } };
}

let mkBody: ((a: Animal) => Body) | null = null;
const loadBodies = () => import('../../wild/bodies').then(m => { mkBody = m.makeBody; return m.makeBody; });
setTimeout(() => { void loadBodies(); }, 0);

/** put one of the arc's animals in a scene (x, y: its anchor) */
export function spawnArc(f: FieldScene, id: string, x: number, y: number, o: { facing?: 1 | -1; act?: string; anim?: string; medium?: 'water' | 'ground' } = {}): Animal {
  const a = new Animal(id, x, y, { medium: o.medium ?? (id === WHEKE_ID ? 'water' : 'ground'), home: [x - 600, x + 600] });
  a.host = f;
  a.medium = o.medium ?? (id === WHEKE_ID ? 'water' : 'ground');
  a.facing = o.facing ?? 1;
  a.x = x; a.y = y;
  RUN.set(a, { tick: null, done: null });
  a.setAct(o.act ?? 'idle', 999);
  a.anim = o.anim ?? o.act ?? 'idle';
  const add = (mk: (a: Animal) => Body) => { a.body = mk(a); f.animals.push(a); f.main.add(a); };
  if (mkBody) add(mkBody); else void loadBodies().then(add);
  return a;
}
function begin(a: Animal, act: string, anim: string, tick: Tick | null): Promise<void> {
  let r = RUN.get(a);
  if (!r) { r = { tick: null, done: null }; RUN.set(a, r); }
  const prev = r.done;
  r.tick = null; r.done = null;
  prev?.();
  a.setAct(act, 999);
  a.anim = anim;
  if (!tick) return Promise.resolve();
  return new Promise<void>(res => { r!.tick = tick; r!.done = res; });
}
export const arcBusy = (a: Animal) => !!RUN.get(a)?.tick;
/** hold a pose until the next call */
export function arcHold(a: Animal, act: string, anim = act) { void begin(a, act, anim, null); a.vx = 0; a.vy = 0; }
/** hold a pose for secs */
export function arcWait(a: Animal, act: string, anim: string, secs: number): Promise<void> {
  let t = 0;
  return begin(a, act, anim, (_a, dt) => { t += dt; a.vx = 0; return t >= secs || a.gone; });
}
/** run tick each frame until it returns true */
export function arcTask(a: Animal, act: string, anim: string, tick: Tick): Promise<void> { return begin(a, act, anim, tick); }
/** move to (tx, ty) at speed px/s; ground animals keep to the ground */
export function arcGo(a: Animal, act: string, anim: string, tx: number, ty: number | null, speed: number, o: { face?: 1 | -1 } = {}): Promise<void> {
  return begin(a, act, anim, (_a, dt) => {
    if (a.gone) return true;
    const ground = a.medium !== 'water';
    const gy = ground ? a.host.st.terrain.groundY(a.x) : 0;
    const dx = tx - a.x, dy = ground ? 0 : (ty ?? a.y) - a.y, d = Math.hypot(dx, dy);
    a.facing = o.face ?? (Math.abs(dx) > 1 ? (dx > 0 ? 1 : -1) : a.facing);
    if (d < Math.max(1, speed * dt)) { a.x = tx; if (!ground && ty !== null) a.y = ty; else a.y = a.host.st.terrain.groundY(a.x); a.vx = a.vy = 0; return true; }
    a.vx = dx / d * speed; a.vy = dy / d * speed;
    a.x += a.vx * dt;
    a.y = ground ? a.host.st.terrain.groundY(a.x) : a.y + a.vy * dt;
    void gy;
    return false;
  });
}

FUN[WHEKE_ID] = 'An octopus has three hearts and blue blood, and two thirds of its brain is in its arms: each arm can taste, decide and grab on its own.';
FUN[THIEF_ID] = 'Land crabs still breathe through gills. A robber crab tops up the water in its gill chambers from dew, puddles and the steam of the vents.';
FUN[ANCIENT_ID] = 'Tuatara are the only survivors of an order of reptiles that walked with the first dinosaurs, over 200 million years ago. They are not lizards at all.';
WEB.push(
  [WHEKE_ID, 'eats', 'trycop', 'drilled through the shell'],
  ['leviathan', 'eats', WHEKE_ID, 'now and then'],
  [THIEF_ID, 'eats', 'cragauk', 'the eggs'],
  ['cragviper', 'eats', THIEF_ID, 'a young one'],
  ['galehawk', 'eats', THIEF_ID],
  [ANCIENT_ID, 'eats', 'tuna', 'from the throat\'s lake'],
);

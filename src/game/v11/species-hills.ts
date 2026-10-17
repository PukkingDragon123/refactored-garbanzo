// V11 field guide: the Rocky Hills' own grazer, the Torhopper (art: src/art/v11/hills/torhopper.ts).
// Shared Species format (see ../species.ts); this module also gives the wildlife brain its ecology entry
// and its rock-hopping act (it bounds up onto tors and boulders and stands sentinel there, then leaps
// down and away when something comes), the encyclopedia its fun fact and food-web links, and defines
// the hills' finds (./hills/items.ts) so saves that carry them load anywhere.
//
// Imported by ../species.ts (so the guide, the camera and the research log know the species from boot).

import type { Species } from '../species';
import { ECO } from '../wild/ecology';
import { SPECIALS, HOOKS, ACTS } from '../wild/animal';
import type { Animal } from '../wild/animal';
import { registerBeast } from '../../art/beasts';
import { TORHOPPER } from '../../art/v11/hills/torhopper';
import { FUN } from '../../ui/v10/funfacts';
import { WEB } from '../../ui/v10/foodweb';
import { rand } from '../../core/math';
import './hills/items';

export const TORHOPPER_ID = 'torhopper';

registerBeast(TORHOPPER_ID, TORHOPPER);

const ph = (behavior: string) => ({ kind: 'photo' as const, species: TORHOPPER_ID, behavior });
const vid = (behavior: string) => ({ kind: 'video' as const, species: TORHOPPER_ID, behavior });

export const TORHOPPER_SPECIES: Species = {
  id: TORHOPPER_ID, name: 'Torhopper', sci: 'Saxisaltor carinatus', group: 'Mammal', sites: [], times: ['dawn', 'day', 'dusk'],
  rarity: 3, danger: 1, size: '75 cm at the shoulder, about 18 kg',
  blurb: 'A stocky little grazer of the open tops that stands on the very tips of its hooves. Grizzled grey wool the colour of granite and dry tussock, a black-and-white face mask, two ridged shields swept back over its brow, and a keel of bony plates down its spine. It bounds from boulder to boulder as if gravity were a suggestion.',
  behaviors: { grazing: 'Grazing tussock', sentinel: 'Standing sentinel', leaping: 'Leaping between rocks', whistling: 'Whistling the alarm', butting: 'Butting heads', resting: 'Resting' },
  facts: [
    {
      id: 'torhop-hooves', cat: 'Adaptation', q: 'How does the Torhopper land on bare rock without slipping?', options: ['Its hooves are rubbery cups that grip like suction pads', 'It has claws like a cat', 'It only lands on moss'], answer: 0,
      text: 'Each hoof is a hard rim around a soft, rubbery pad. Landing squashes the pad flat and the rim bites: it grips granite like a climbing shoe, and it lands on a boulder the size of a dinner plate.',
      evidence: [ph('leaping')], hint: 'Photograph one mid-leap between the tors.',
    },
    {
      id: 'torhop-sentinel', cat: 'Behaviour', q: 'Why does one Torhopper always stand on a rock while the rest graze?', options: ['It keeps watch and whistles when it sees a hawk', 'It is the oldest, resting', 'It is warming up in the sun'], answer: 0,
      text: 'Herd members take turns as sentinel on the highest rock. Head up, ears turning, it watches the sky for Galehawks and the tussock for serpents, and gives a piercing whistle at the first sign of either.',
      evidence: [ph('sentinel'), vid('whistling')], hint: 'Watch the herd at the tors. One of them is not eating.',
    },
    {
      id: 'torhop-keel', cat: 'Anatomy', q: 'What are the bony plates down its back for?', options: ['Armour against serpents striking down from the rocks', 'Storing water', 'Attracting a mate'], answer: 0,
      text: 'Crag Vipers ambush from above, from ledges and the tops of boulders, and strike at the neck and spine. The keel of overlapping scutes turns a strike aside; the fangs skid off.',
      evidence: [ph('grazing'), ph('resting')], hint: 'A clear side-on photo shows the keel.',
    },
    {
      id: 'torhop-shields', cat: 'Behaviour', q: 'What do the brow-shields do?', options: ['Rivals clash them together in head-butting contests', 'They dig up roots', 'They shade the eyes'], answer: 0,
      text: 'The shields are layered keratin over a thickened skull. Young rams rear up and crash them together; the ridges lock so that they shove instead of slipping and hurting each other.',
      evidence: [ph('butting')], hint: 'Young ones spar when they think nobody is looking.',
    },
  ],
  research: {
    habitat: 'The open tops above the bush line: tussock basins, scree and the tor fields of Ngā Puke Kōhatu. Herds rest under the bluff in bad weather and come down to the bush edge in hard winters.',
    diet: 'Tussock, the flowers of mountain daisies, hebe tips, and spaniard (eaten from the top down, slowly, lips curled back from the needles). It grazes in the cool of the morning and evening and chews the cud on a rock at midday.',
    anatomy: 'Built for leaping: long slender legs on the tips of the hooves, a compact body, a short tail with a white flag that flashes when it runs. Each hoof is a hard rim round a rubbery suction pad. Dense two-layer wool against the wind. A keel of small bony scutes along the spine, and two ridged keratin brow-shields swept back over a thick skull. Horizontal pupils, like a goat’s, give it a wide view of the ground and the sky.',
    ecology: 'The main grazer of the tops: by cropping the tussock it keeps the cushion plants and daisies in the light. Galehawks take its young; Crag Vipers strike at adults from the rocks; Monarchs pick over the winter dead. Hunters from Te Kāinga take a few each year, and its wool lines their cloaks.',
    behaviour: 'Herds of three to eight with a sentinel on the highest rock. The whistle sends them all bounding up the nearest tor, where nothing on four legs can follow. Young rams spar with their brow-shields at dawn. They are curious: stand still long enough in the tussock and the herd will come and look at you.',
    notes: [
      'It landed on a rock the size of my hand. On the TIPS of its hooves. I can barely stand on a kitchen chair.',
      'The sentinel whistled before I even saw the hawk. Then the whole herd went straight up the tor like it was an escalator.',
      'Aroha says the hunters call the wool “the wind’s coat”.',
      'Its pupils are sideways. Like a goat’s. It looks at me as if I am a disappointing piece of furniture.',
    ],
    status: 'Locally common on the tops',
  },
};

// the wildlife brain: a skittish, social grazer that takes refuge on the rocks
ECO[TORHOPPER_ID] = {
  loco: 'walker', medium: 'ground', walk: 18, run: 120, bold: 0.35, aggro: 0.05, curious: 0.6, social: 0.95, alert: 0.85,
  sight: 210, hear: 1.2, flightDist: 95, food: ['leaves', 'seeds'], fears: ['galehawk', 'cragviper', 'sprinter', 'cerebraltiger'], rival: true,
  defense: ['flee'], group: [3, 7], young: 0.35, calls: { contact: 'callChirp', alarm: 'callTrill' }, size: 3,
  idle: [
    { act: 'forage', w: 3.5, dur: [6, 12] }, { act: 'browse', w: 1.5, poi: 'leaves', dur: [5, 10] }, { act: 'tor', w: 2.4, poi: 'rock', dur: [10, 20] },
    { act: 'rest', w: 1, when: ['day'], dur: [6, 12] }, { act: 'wander', w: 1 },
  ],
  photo: {
    forage: 'grazing', browse: 'grazing', eat: 'grazing', wander: 'grazing', tor: 'sentinel', sentinel: 'sentinel', alert: 'sentinel',
    hop: 'leaping', flee: 'leaping', play: 'butting', call: 'whistling', rest: 'resting', sleep: 'resting',
  },
};

/** a ballistic hop from where it stands to (tx, ty) over `dur` seconds; returns true on landing */
function hop(a: Animal, tx: number, ty: number, dur: number, dt: number): boolean {
  const m = a.mem;
  if (m.hx0 === undefined) { m.hx0 = a.x; m.hy0 = a.y; m.ht = 0; a.face(tx); a.host.sfx('rustle', a.x, 0.2, 1.6); }
  m.ht += dt / dur;
  const t = Math.min(1, m.ht);
  a.x = m.hx0 + (tx - m.hx0) * t;
  const arc = Math.max(24, Math.abs(ty - m.hy0) * 0.6 + 18);
  a.y = m.hy0 + (ty - m.hy0) * t - Math.sin(t * Math.PI) * arc;
  a.vx = (tx - m.hx0) / dur;
  a.anim = 'leap';
  if (t >= 1) { delete m.hx0; a.y = ty; a.vx = 0; a.host.sfx('land', a.x, 0.25, 1.5); return true; }
  return false;
}
const groundY = (a: Animal, x: number) => a.host.terrain.surfaceBelow(x, -400)?.y ?? a.host.terrain.groundY(x);

SPECIALS[TORHOPPER_ID] = {
  ...(SPECIALS[TORHOPPER_ID] ?? {}),
  /** bound up onto a rock (a tor or a boulder), stand sentinel, then hop down again */
  tor(a, dt) {
    const g = a.goal?.poi;
    const m = a.mem;
    if (!g || g.kind !== 'rock') return false;
    m.ph = m.ph ?? 0;
    if (m.ph === 0) {
      // trot to the foot of the rock
      const side = a.x < g.x ? -1 : 1;
      const fx = g.x + side * 26;
      a.anim = 'walk';
      if (a.groundTo(fx, a.eco.walk * 1.4, dt) || m.blocked) { m.ph = 1; m.blocked = 0; }
      return;
    }
    if (m.ph === 1) { if (hop(a, g.x, g.y, 0.75, dt)) { m.ph = 2; m.perched = 1; a.surf = null; } return; }
    if (m.ph === 2) {
      // sentinel: head up, scanning both ways; the alarm whistle if it spots trouble
      a.vx = 0;
      a.anim = a.actT % 7 < 5 ? 'alert' : 'idle';
      const k = Math.floor(a.actT / 1.8);
      if (k !== m.k) { m.k = k; if (rand.chance(0.6)) a.facing = -a.facing; }
      if (a.noticed && a.aw > 0.8 && !m.whistled) { m.whistled = 1; a.call('alarm'); a.anim = 'call'; }
      if (a.actT > a.actDur - 1) { m.ph = 3; m.dx = a.facing * 34; }
      return;
    }
    // down again
    const tx = a.x + (m.dx ?? 30);
    if (m.ty === undefined) m.ty = groundY(a, tx);
    if (hop(a, tx, m.ty, 0.65, dt)) { m.perched = 0; delete m.ty; a.settle(); return false; }
  },
  /** flee: bounding, with a hop off any rock first */
  flee(a, dt) {
    const m = a.mem;
    if (m.perched) {
      const dir = a.threat ? Math.sign(a.x - a.threat.x) || a.facing : a.facing;
      if (m.fx === undefined) { m.fx = a.x + dir * 40; m.fy = groundY(a, m.fx); }
      if (hop(a, m.fx, m.fy, 0.6, dt)) { m.perched = 0; delete m.fx; a.settle(); }
      return;
    }
    return ACTS.flee(a, dt);
  },
};
HOOKS[TORHOPPER_ID] = {
  ...(HOOKS[TORHOPPER_ID] ?? {}),
  onThreat(a) {
    // the sentinel whistles first; then everyone bounds away
    if (a.act === 'tor' && a.mem.ph === 2 && !a.mem.whistled) { a.mem.whistled = 1; a.call('alarm'); }
    const perched = !!a.mem.perched;
    a.setAct('flee', rand.range(4, 7));
    if (perched) a.mem.perched = 1;
    return true;
  },
};

FUN[TORHOPPER_ID] = 'A Torhopper can land on a rock no bigger than a dinner plate from three metres away, on the tips of its hooves: each one is a rubbery suction cup inside a hard rim.';
WEB.push(
  ['galehawk', 'eats', TORHOPPER_ID, 'takes the young on the open tops'],
  ['cragviper', 'eats', TORHOPPER_ID, 'strikes from the rocks (the keel turns it aside)'],
  ['monarch', 'eats', TORHOPPER_ID, 'picks over the winter dead'],
);

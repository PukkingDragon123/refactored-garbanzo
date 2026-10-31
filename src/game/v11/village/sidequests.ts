// V12 Te Kāinga side quests. Each is offered in floating dialogue by the villager it belongs to (a "!"
// over their head while there's something to offer or hand in), lives in the ordinary quest book
// (src/game/quests.ts: the HUD note and the notebook track it, the steps tick themselves), and sends
// Mori out along the trails for something only that place has:
//
//   The Anuhe in the Kūmara   Tamati    caterpillars are eating the kūmara. Look over the mounds;
//                                       gather kawakawa (it grows by the Fernwood stream); smoke the
//                                       mounds with Tamati at dusk (hold to fan); pick off the last
//                                       three by hand. Ember-roast kūmara recipe, hearts
//   Paretaniwha               Mere      the bronze harakeke her grandmother planted by the Fernwood
//                                       stream: find it, ease out three outer leaves (the pull close-
//                                       up), bring them; she soaks them a night. The camera-strap
//                                       blueprint, hearts
//   Where's Taewa?            Manu      his kunekune piglet is gone: the chewed rope at the pen, trotter
//                                       prints at the landing, Taewa rooting in the mangroves (coax him
//                                       with a kūmara, scoop him up). Huhu grub fry recipe, hearts, and
//                                       a trail clue: the cave that breathes
//   A Hawk for the Prow       Hēmi      a developed photo of a Gale Hawk soaring or diving (two stars or
//                                       better); a day later the carved prow. Hawk decoy blueprint,
//                                       hearts, and a trail clue: the forest that glows
//   Stones for the Hāngī      Huia      three black river stones full of holes (the landing, the
//                                       Fernwood stream, the hills: the dig close-up; not the pale
//                                       sandstone), then lift the hāngī with her at dusk. The hāngī pit
//                                       blueprint, a fish stew recipe, a feast, hearts all round
//   Songs by the Fire         Hana      the guitar lessons at the evening fire (src/ui/v12/closeup/
//                                       guitar.ts): Te Ahi, then Hoki Mai played well earns her
//                                       father's guitar; a song for the crew at camp ends it

import { game } from '../../game';
import type { FieldScene } from '../../scenes/field';
import type { Actor } from '../../../world/actor';
import type { Interactable } from '../../../world/npc';
import type { BubbleLine } from '../../../ui/bubbles';
import { Custom, Prop } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { A } from '../../assets';
import { rand } from '../../../core/math';
import { audio } from '../../../core/audio';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../../quests';
import type { QuestDef, Giver } from '../../quests';
import { ITEMS, defineItem } from '../../items';
import { count, give, remove } from '../../inventory';
import { addAffinity } from '../social';
import { teachRecipe, RECIPE_BY_ID } from '../cooking';
import { defineBlueprint, grantBlueprint, BLUEPRINTS } from '../blueprints';
import { rumour, addNote, discover } from '../../v10/regions';
import { dayNumber, addBond } from '../../v10/day';
import { restore } from '../../v10/energy';
import { floatNotice, floatChoices } from '../../../ui/v12/float';
import { sprite } from '../../sites2/common';
import { plant } from '../../../art/jungle-plants';
import * as LA from '../../../art/v11/village/lifeart';
import type { Sprite } from '../../../art/jungle-core';
import type { TripRun } from '../../v10/field10';
import type { VCtx } from './ctx';
import { say, sleep } from './ctx';
import { X } from './layout';
import { vf } from './lore';
import { setSideMark, holdV } from './people';
import { villagePhase, raiseMood } from './life';
import { Livestock } from './livestock';

// ------------------------------------------------------------------ state
const qf = (k: string) => !!game.save.flags['v12q:' + k];
const setQf = (k: string, v = true) => { game.save.flags['v12q:' + k] = v; game.persist(); };
const qv = (k: string) => game.save.vars['v12q:' + k] ?? 0;
const setQv = (k: string, n: number) => { game.save.vars['v12q:' + k] = n; game.persist(); };
const songBest = (id: string) => game.save.vars['v12g:best:' + id] ?? 0;
const active = (id: string) => questStatus(id) === 'active';
const think = (text: string, choices: string[]): BubbleLine => ({ who: 'mori', text, style: 'think', choices });
const refresh = () => (game.scene as unknown as { hud?: { refresh(f?: boolean): void } } | null)?.hud?.refresh(true);

// ------------------------------------------------------------------ things, recipes, blueprints
function defs() {
  const item = (id: string, name: string, kind: 'key' | 'material', desc: string, o: { stack?: number; weight?: number; where?: string } = {}) => {
    if (!ITEMS[id]) defineItem({ id, name, kind, stack: o.stack ?? 1, desc, weight: o.weight, where: o.where });
  };
  item('q_paretaniwha', 'Paretaniwha leaf', 'material', 'A blade of bronze harakeke with a red line down each edge. Cut from the outside of the bush, never the heart.', { stack: 3, weight: 0.2, where: 'By the Fernwood stream' });
  item('q_kohatu', 'Hāngī stone', 'material', 'Black river stone full of tiny holes. It drinks the fire’s heat and gives it back slowly, and it won’t burst.', { stack: 3, weight: 2.5, where: 'River and stream beds' });
  item('q_taewa', 'Taewa the piglet', 'key', 'Manu’s kunekune piglet, muddy to the ears, wriggling in your kete. He smells of mangrove and is not sorry.', { weight: 3, where: 'Rooting in the mangroves' });
  item('vil_guitar', 'Hana’s guitar', 'key', 'Her father’s old steel-string: a tobacco burst worn pale under the pick, a pāua rosette. Three songs live in it.', { weight: 2.2 });
  LA.registerLifeItemArt();
  if (!BLUEPRINTS.flax_strap) defineBlueprint({ id: 'flax_strap', name: 'Paretaniwha camera strap', kind: 'equipment', by: 'village', source: 'quest:mere', desc: 'Whaea Mere’s plaited strap of bronze muka. It sits on the neck like a hand on the shoulder, and the camera hangs steady.', effect: 'Steadier hands: photos come out a little sharper.', notes: ['Three strands, never four.', 'Soak the muka a night.'] });
  if (!BLUEPRINTS.hawk_decoy) defineBlueprint({ id: 'hawk_decoy', name: 'Carved hawk decoy', kind: 'research', by: 'village', source: 'quest:hemi', desc: 'Uncle Hēmi’s pattern for a small carved hawk on a stick. Set it on a branch and the little birds freeze and sit still.', effect: 'Small birds hold still longer for the camera.', notes: ['Tōtara, not pine.', 'Eyes of pāua: they must catch the light.'] });
}

// ------------------------------------------------------------------ the quests
const step = (text: string, k: string, hint?: string) => ({ text, done: () => qf(k), hint });
const HAWK_BEH = new Set(['soaring', 'diving', 'carrying']);
let hawkCache = { t: 0, v: false };
/** a developed photo of a Gale Hawk with its wings open, taken since Hēmi asked */
export function hawkPhoto(): boolean {
  const now = performance.now();
  if (now - hawkCache.t < 800) return hawkCache.v;
  const from = qv('prow:album0');
  const v = (game.save.album ?? []).some(p => p.species === 'galehawk' && HAWK_BEH.has(p.behavior ?? '') && p.stars >= 2 && p.id >= from);
  hawkCache = { t: now, v };
  return v;
}
export const SIDE_QUESTS: QuestDef[] = [
  {
    id: 'v12_kumara', title: 'The Anuhe in the Kūmara', giver: 'tamati' as Giver, main: false,
    desc: 'Something is eating Tamati’s kūmara leaves to lace overnight. He knows what it is, and he knows the old cure: kawakawa smoke, and patient fingers.',
    steps: [
      step('Look over the chewed kūmara mounds', 'kum:look', 'The gardens at the west end of the village, past the smoking rack.'),
      { text: 'Gather kawakawa leaves for the smoke', done: () => qf('kum:smoked') || count('kawakawa') >= 4, progress: () => [Math.min(4, count('kawakawa') + (qf('kum:smoked') ? 4 : 0)), 4], hint: 'Kawakawa grows in the shade along the Fernwood stream.' },
      step('Smoke the mounds with Tamati when the sun is low', 'kum:smoked', 'The anuhe come out to feed at dusk. Meet Tamati in the garden in the evening.'),
      { text: 'Pick off the last anuhe', done: () => qv('kum:picked') >= 3, progress: () => [Math.min(3, qv('kum:picked')), 3], hint: 'They cling under the leaves of the smoked mounds.' },
      step('Tell Tamati', 'kum:done', 'He’s in the gardens by day, at the fire after dark.'),
    ],
    reward: { rp: 25, items: [['vil_kumara', 4]], text: 'Tamati’s ember-roast kūmara, and a kete of them.' },
  },
  {
    id: 'v12_flax', title: 'Paretaniwha', giver: 'mere' as Giver, main: false,
    desc: 'Whaea Mere is weaving a cloak for Koro. Its border must be paretaniwha: a bronze harakeke with a red edge that her grandmother planted by the Fernwood stream, near where the old tōtara fell.',
    steps: [
      step('Find the bronze harakeke by the Fernwood stream', 'flax:found', 'Fernwood, along the stream near the fallen tōtara.'),
      { text: 'Cut three outer leaves (never the heart)', done: () => qf('flax:given') || count('q_paretaniwha') >= 3, progress: () => [Math.min(3, count('q_paretaniwha') + (qf('flax:given') ? 3 : 0)), 3], hint: 'Ease each leaf out from its base. A torn leaf is no use to her.' },
      step('Bring the leaves to Whaea Mere', 'flax:given', 'She weaves under the shelter by the pig pen.'),
      step('Come back for the weaving the next day', 'flax:done', 'The leaves soak a night before she can strip the muka.'),
    ],
    reward: { rp: 25, text: 'A camera strap of paretaniwha muka, and the pattern for it.' },
  },
  {
    id: 'v12_taewa', title: 'Where’s Taewa?', giver: 'manu' as Giver, main: false,
    desc: 'Manu’s kunekune piglet Taewa chewed through his rope in the night and is gone. Manu is pretending very hard not to be upset.',
    steps: [
      step('Look for clues at the pig pen', 'pig:pen', 'The pen is by the gardens, west of the wharenui.'),
      step('Follow the trotter prints', 'pig:landing', 'Little prints in the mud. Where does the mud stay wet?'),
      step('Find Taewa down the river', 'pig:caught', 'The prints go down the river path toward the mangroves. A kūmara might tempt him.'),
      step('Bring Taewa home to Manu', 'pig:done'),
    ],
    reward: { rp: 25, text: 'Manu’s thanks, his huhu grub fry, and a secret.' },
  },
  {
    id: 'v12_prow', title: 'A Hawk for the Prow', giver: 'hemi' as Giver, main: false,
    desc: 'Uncle Hēmi is carving the tauihu, the prow of his waka, as a Gale Hawk with its wings open. He has only ever seen them from below, against the sun. He needs a photograph.',
    steps: [
      { text: 'Photograph a Gale Hawk with its wings open, and develop it', done: () => qf('prow:shown') || hawkPhoto(), hint: 'Gale Hawks hunt over the village on fine days, and over the canopy and the falls. Soaring or diving, two stars or better. Develop it at the laptop.' },
      step('Show Uncle Hēmi the photograph', 'prow:shown', 'He’s at the waka in the carving shed.'),
      step('Come back when the prow is carved', 'prow:done', 'Give him a day with the adze.'),
    ],
    reward: { rp: 30, text: 'The carved prow, Hēmi’s decoy pattern, and an old carver’s secret.' },
  },
  {
    id: 'v12_stones', title: 'Stones for the Hāngī', giver: 'huia' as Giver, main: false,
    desc: 'Nanny Huia’s hāngī stones have cracked. New ones must be the right kind: black river stone full of little holes, that holds the heat and won’t burst. Never the pretty pale ones.',
    steps: [
      { text: 'Find three black hāngī stones', done: () => qf('stones:given') || count('q_kohatu') >= 3, progress: () => [Math.min(3, count('q_kohatu') + (qf('stones:given') ? 3 : 0)), 3], hint: 'River stones: the landing below the village, the Fernwood stream, the stony beds in the hills.' },
      step('Bring the stones to Nanny Huia', 'stones:given', 'She’s at the cooking fire by day.'),
      step('Lift the hāngī with Huia at dusk', 'stones:done', 'The hāngī comes up when the sun goes down. Meet her at the pit.'),
    ],
    reward: { rp: 25, items: [['vil_hangi', 3]], text: 'A hāngī for the whole village, and Huia’s pit for camp.' },
  },
  {
    id: 'v12_guitar', title: 'Songs by the Fire', giver: 'hana' as Giver, main: false,
    desc: 'Aunty Hana plays her father’s old guitar by the fire most evenings. She says anyone can learn three chords. She says it like a threat.',
    steps: [
      { text: 'Play “Te Ahi” with Aunty Hana at the evening fire', done: () => songBest('ahi') >= 45, hint: 'Hana plays by the marae fire in the evening. Talk to her there.' },
      { text: 'Play “Hoki Mai” well (GOOD or better)', done: () => songBest('hoki') >= 70, hint: 'Another evening at the fire.' },
      step('Play a song for the crew at camp', 'guitar:camp', 'Her guitar is yours now. Play at the camp fire in the evening.'),
    ],
    reward: { rp: 30, text: 'The guitar, three songs, and a camp that sings.' },
  },
];
const UNLOCK: Record<string, () => boolean> = {
  v12_kumara: () => vf('met:tamati'),
  v12_flax: () => !!game.save.flags['v10:kete'],
  v12_taewa: () => vf('met:manu'),
  v12_prow: () => vf('met:hemi'),
  v12_stones: () => vf('huiaMet'),
  v12_guitar: () => vf('met:hana'),
};
const offerable = (id: string) => questStatus(id) === 'hidden' && !!UNLOCK[id]?.();

let booting: Promise<void> | null = null;
/** register the quests (at boot, so the HUD and the notebook know them anywhere) and the far spots */
export function bootSideQuests(): Promise<void> {
  if (booting) return booting;
  defs();
  for (const q of SIDE_QUESTS) if (!QUEST_BY_ID[q.id]) { QUESTS.push(q); QUEST_BY_ID[q.id] = q; }
  setSideMark(sideMark);
  booting = import('../../v10/field10').then(({ onLocEnter }) => onLocEnter(farSpots));
  return booting;
}

// ------------------------------------------------------------------ a "!" over whoever has something
function sideMark(id: string): boolean {
  const c = curCtx;
  const evening = villagePhase(c) === 'evening';
  switch (id) {
    case 'tamati': return offerable('v12_kumara') || (active('v12_kumara') && qv('kum:picked') >= 3 && !qf('kum:done'));
    case 'mere': return offerable('v12_flax') || (active('v12_flax') && ((!qf('flax:given') && count('q_paretaniwha') >= 3) || (qf('flax:given') && !qf('flax:done') && dayNumber() > qv('flax:day'))));
    case 'manu': return offerable('v12_taewa') || (active('v12_taewa') && count('q_taewa') > 0);
    case 'hemi': return offerable('v12_prow') || (active('v12_prow') && ((!qf('prow:shown') && hawkPhoto()) || (qf('prow:shown') && !qf('prow:done') && dayNumber() > qv('prow:day'))));
    case 'huia': return offerable('v12_stones') || (active('v12_stones') && !qf('stones:given') && count('q_kohatu') >= 3);
    case 'hana': return evening && (offerable('v12_guitar') || active('v12_guitar'));
  }
  return false;
}

// ------------------------------------------------------------------ talking
let curCtx: VCtx | null = null;
/** the villagers' side-quest lines come first; false: nothing here, carry on with the usual talk */
export async function sideTalk(c: VCtx, id: string, a: Actor): Promise<boolean> {
  await bootSideQuests();
  curCtx = c;
  switch (id) {
    case 'tamati': return talkTamati(c);
    case 'mere': return talkMere(c);
    case 'manu': return talkManu(c);
    case 'hemi': return talkHemi(c);
    case 'huia': return talkHuia(c);
    case 'hana': return talkHana(c, a);
  }
  return false;
}
async function offer(c: VCtx, id: string, ask: BubbleLine[], yes: BubbleLine[], no: BubbleLine): Promise<boolean> {
  const k = await say(c.f, [...ask, think('Will you help?', ['I’ll help', 'Not right now'])]);
  if (k !== 0) { await say(c.f, [no]); return true; }
  startQuest(id);
  if (yes.length) await say(c.f, yes);
  return true;
}
function payout(o: { aff?: [string, number][]; recipe?: [string, string]; blueprint?: [string, string]; note?: string }) {
  for (const [who, n] of o.aff ?? []) addAffinity(who, n, 'side quest');
  const bits: string[] = [];
  if (o.recipe && teachRecipe(o.recipe[0], o.recipe[1])) bits.push(`Recipe learned: ${RECIPE_BY_ID[o.recipe[0]]?.name ?? o.recipe[0]}`);
  if (o.blueprint && grantBlueprint(o.blueprint[0], o.blueprint[1])) bits.push(`New blueprint: ${BLUEPRINTS[o.blueprint[0]]?.name ?? o.blueprint[0]}`);
  if (o.note) bits.push(o.note);
  bits.forEach((b, i) => setTimeout(() => floatNotice(b, 3000), i * 900));
  audio.play('discover', { vol: 0.5 });
  refresh();
}

// ---------------------------------------------------------------- Tamati: the anuhe
async function talkTamati(c: VCtx): Promise<boolean> {
  if (offerable('v12_kumara')) return offer(c, 'v12_kumara', [
    { who: 'tamati', text: 'Bro. Come look at this. No, closer. See the leaves? Lace. Something’s eating my kūmara down to the veins.', expr: 'worried' },
    { who: 'tamati', text: 'Anuhe. Big green caterpillars with a horn on the bum. They hide by day and feed at dusk.', expr: 'grumpy' },
    { who: 'tamati', text: 'The old people smoked them out with kawakawa. Burn the leaves, fan the smoke through the mounds, then pick off the stubborn ones by hand.', expr: 'serious' },
  ], [{ who: 'tamati', text: 'Choice. Look over the mounds first. Then kawakawa, four good handfuls. It grows in the shade along the Fernwood stream.', expr: 'happy' }],
  { who: 'tamati', text: 'All good. The anuhe aren’t going anywhere. That’s the problem.', expr: 'neutral' });
  if (active('v12_kumara') && qv('kum:picked') >= 3 && !qf('kum:done')) {
    setQf('kum:done');
    await say(c.f, [
      { who: 'tamati', text: 'Look at that. Clean leaves. You’ve got good fingers for a scientist.', expr: 'happy' },
      { who: 'tamati', text: 'Here. Ember-roast kūmara: straight in the coals in their skins, turn them twice, eat them burning your fingers. That’s the recipe. That’s all of it.', expr: 'happy' },
    ]);
    payout({ aff: [['tamati', 14], ['mere', 4]], recipe: ['roastbulbs', 'tamati'] });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- Mere: paretaniwha
async function talkMere(c: VCtx): Promise<boolean> {
  if (offerable('v12_flax')) return offer(c, 'v12_flax', [
    { who: 'mere', text: 'I’m weaving Koro a cloak. Don’t tell him. The border has to be paretaniwha: bronze leaves with a red edge.', expr: 'neutral' },
    { who: 'mere', text: 'My grandmother planted a bush of it by the Fernwood stream, where the old tōtara fell across. I haven’t the knees for that walk any more.', expr: 'sad' },
  ], [{ who: 'mere', text: 'Three outer leaves. Never the heart, never the leaves beside it: those are the baby and its parents. Ease them out from the base. A torn leaf is firewood.', expr: 'serious' }],
  { who: 'mere', text: 'Another day, then. The bush has waited forty years.', expr: 'neutral' });
  if (!active('v12_flax')) return false;
  if (!qf('flax:given') && count('q_paretaniwha') >= 3) {
    remove('q_paretaniwha', 3);
    setQv('flax:day', dayNumber());
    setQf('flax:given');
    await say(c.f, [
      { who: 'mere', text: 'Oh. Look at the colour on them. She’d have been pleased, my nan.', expr: 'happy' },
      { who: 'mere', text: 'They soak tonight. Come back tomorrow and I’ll have something for you.', expr: 'teasing' },
    ]);
    refresh();
    return true;
  }
  if (qf('flax:given') && !qf('flax:done') && dayNumber() > qv('flax:day')) {
    setQf('flax:done');
    await say(c.f, [
      { who: 'mere', text: 'Here. The leftover muka, plaited three strands. A strap for your camera, so it sits on you like a hand on your shoulder.', expr: 'happy' },
      { who: 'mori', text: 'Whaea... it’s beautiful. It’s warm, somehow.', expr: 'happy' },
      { who: 'mere', text: 'And the pattern, so you can make another when you lose that one. You will. Men do.', expr: 'teasing' },
    ]);
    payout({ aff: [['mere', 15], ['koro', 3]], blueprint: ['flax_strap', 'quest:mere'] });
    return true;
  }
  if (qf('flax:given') && !qf('flax:done')) { await say(c.f, [{ who: 'mere', text: 'Tomorrow. The leaves are still soaking. Patience is half of weaving.', expr: 'neutral' }]); return true; }
  return false;
}

// ---------------------------------------------------------------- Manu: Taewa
async function talkManu(c: VCtx): Promise<boolean> {
  if (offerable('v12_taewa')) return offer(c, 'v12_taewa', [
    { who: 'manu', text: 'Have you seen a little pig? Ginger and black. Tassels. Answers to Taewa. Doesn’t answer, actually.', expr: 'worried' },
    { who: 'manu', text: 'He chewed his rope in the night. I’m not upset. He’s just a pig. ...He’s my pig.', expr: 'sad' },
  ], [{ who: 'manu', text: 'Start at the pen. Mikaere says he saw tracks but Mikaere also says he saw an eel walking.', expr: 'neutral' }],
  { who: 'manu', text: 'Yeah. Okay. It’s fine. He’ll come back. Probably.', expr: 'sad' });
  if (active('v12_taewa') && count('q_taewa') > 0) {
    remove('q_taewa', 1);
    setQf('pig:done');
    await say(c.f, [
      { who: 'manu', text: 'TAEWA! You stink! Where did you... the MANGROVES? You idiot. You beautiful idiot.', expr: 'excited' },
      { who: 'manu', text: 'Thanks, Mori. For real. Here: huhu grub fry. Mum doesn’t know I make it. Crunchy outside, creamy inside, like peanut butter.', expr: 'happy' },
      { who: 'manu', text: 'And... a secret. Last winter, chasing him, I found a cave by the sea that breathes. In and out. Koro says it’s the cave that breathes and not to go in. So I didn’t. Much.', expr: 'serious' },
    ]);
    rumour('grotto');
    addNote({ id: 'note:manu-cave', loc: 'village', x: X.pen[0], text: 'Manu: a sea cave that breathes in and out. Koro calls it the cave that breathes.' });
    payout({ aff: [['manu', 16], ['pipi', 4], ['mere', 4]], recipe: ['grubfry', 'manu'], note: 'Trail clue: the cave that breathes' });
    if (c.live) c.live.add('pig', X.pen[0] + 30, [X.pen[0] + 8, X.pen[1] - 10], { v: 2 });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- Hēmi: the prow
async function talkHemi(c: VCtx): Promise<boolean> {
  if (offerable('v12_prow')) {
    // only photographs taken from now on count (the next one the album files)
    setQv('prow:album0', Math.max(-1, ...(game.save.album ?? []).map(p => p.id)) + 1);
    hawkCache.t = 0;
  }
  if (offerable('v12_prow')) return offer(c, 'v12_prow', [
    { who: 'hemi', text: 'The tauihu. The prow. She’ll be a Gale Hawk, wings open, leading the waka up the river.', expr: 'neutral' },
    { who: 'hemi', text: 'Problem. I’ve only ever seen them from underneath, against the sun. A black cross in the sky. I need to see the shape of the wings. Your camera sees things.', expr: 'thinking' },
  ], [{ who: 'hemi', text: 'Wings open: soaring, or stooping. A sharp one. They hunt over the village on fine days, and over the canopy.', expr: 'neutral' }],
  { who: 'hemi', text: 'Hm. The wood will wait.', expr: 'neutral' });
  if (active('v12_prow') && !qf('prow:shown')) {
    const h = (game.save.album ?? []).find(p => p.species === 'galehawk' && HAWK_BEH.has(p.behavior ?? '') && p.stars >= 2 && p.id >= qv('prow:album0'));
    if (!h) return false;
    setQf('prow:shown');
    setQv('prow:day', dayNumber());
    await say(c.f, [
      { who: 'mori', text: 'Uncle, look. I got one: wings right open.', expr: 'happy' },
      { who: 'hemi', text: '...Look at the primaries. Spread like fingers. I had them wrong. I had them all wrong.', expr: 'surprised' },
      { who: 'hemi', text: 'Leave it with me a day.', expr: 'serious' },
    ]);
    refresh();
    return true;
  }
  if (active('v12_prow') && qf('prow:shown') && !qf('prow:done') && dayNumber() > qv('prow:day')) {
    setQf('prow:done');
    await say(c.f, [
      { who: 'hemi', text: 'There. Look on the bench. Her wings are right now. You gave her those.', expr: 'happy' },
      { who: 'hemi', text: 'For you: a little one, the pattern for it. Set it on a branch and the small birds freeze. Good for your camera.', expr: 'neutral' },
      { who: 'hemi', text: 'And something the old carvers knew. The blue in the old pā carvings came from a forest that glows at night, up past the hills. Nobody’s been for a long time.', expr: 'serious' },
    ]);
    rumour('glowforest');
    addNote({ id: 'note:hemi-glow', loc: 'village', x: X.shed, text: 'Hēmi: the old carvers’ blue came from a forest that glows at night, past the hills.' });
    payout({ aff: [['hemi', 16], ['rawiri', 4]], blueprint: ['hawk_decoy', 'quest:hemi'], note: 'Trail clue: the forest that glows' });
    return true;
  }
  if (active('v12_prow') && qf('prow:shown') && !qf('prow:done')) { await say(c.f, [{ who: 'hemi', text: 'Not yet. Tomorrow.', expr: 'neutral' }]); return true; }
  return false;
}

// ---------------------------------------------------------------- Huia: the stones
async function talkHuia(c: VCtx): Promise<boolean> {
  if (offerable('v12_stones')) return offer(c, 'v12_stones', [
    { who: 'huia', text: 'My stones cracked. Twenty years, those stones. Cracked like old teeth.', expr: 'sad' },
    { who: 'huia', text: 'I need new ones. Black river stone, full of little holes like a sponge. It drinks the heat and gives it back slow. Three of them.', expr: 'serious' },
    { who: 'huia', text: 'NOT the pretty pale ones. Sandstone. It holds water inside, and in the fire it goes BANG. I lost an eyebrow in 1971.', expr: 'grumpy' },
  ], [{ who: 'huia', text: 'Rivers. The landing down there, the Fernwood stream, the stony beds up in the hills. Dig them out gently.', expr: 'neutral' }],
  { who: 'huia', text: 'Then I’ll cook on cracked stones and blame you.', expr: 'teasing' });
  if (!active('v12_stones')) return false;
  if (!qf('stones:given') && count('q_kohatu') >= 3) {
    remove('q_kohatu', 3);
    setQf('stones:given');
    await say(c.f, [
      { who: 'huia', text: 'Let me see. Heavy. Black. Holes. ...Good boy. These will see me out.', expr: 'happy' },
      { who: 'huia', text: 'They go in the fire now and the kai goes down on them. Come to the pit at dusk and help me lift it.', expr: 'neutral' },
    ]);
    refresh();
    return true;
  }
  if (qf('stones:given') && !qf('stones:done')) {
    await say(c.f, [{ who: 'huia', text: villagePhase(c) === 'evening' ? 'It’s time! To the pit, quick, before it overcooks.' : 'At dusk. The hāngī comes up when the sun goes down.', expr: 'neutral' }]);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- Hana: the guitar at the fire
async function talkHana(c: VCtx, a: Actor): Promise<boolean> {
  if (villagePhase(c) !== 'evening' || Math.abs(a.x - X.fire) > 200) return false;
  const first = questStatus('v12_guitar') === 'hidden';
  if (first) {
    await say(c.f, [
      { who: 'hana', text: 'You’ve been watching my hands all night. Come here. Sit. This was my father’s guitar.', expr: 'happy' },
      { who: 'hana', text: 'Three chords and the truth, he used to say. I’ll teach you the chords. The truth is your problem.', expr: 'teasing' },
    ]);
    startQuest('v12_guitar');
  }
  const { SONGS, songOpen } = await import('../../../ui/v12/closeup/guitar');
  const open = SONGS.filter(s => songOpen(s.id));
  const opts = [...open.map(s => `Play “${s.name}”`), 'Just listen a while', 'Something else'];
  const k = await say(c.f, [think('Aunty Hana holds out the guitar, neck first.', opts)]);
  if (k === opts.length - 1) return false;
  if (k === opts.length - 2) { await listen(c); return true; }
  const song = open[k];
  if (!song) return true;
  await lesson(c, song.id);
  return true;
}
async function listen(c: VCtx) {
  const f = c.f;
  f.player.poseOverride = 'sitGround';
  raiseMood(c, 0.25);
  restore(6);
  await sleep(2800);
  f.player.poseOverride = null;
  await say(f, [rand.pick<BubbleLine>([
    { who: 'hana', text: 'See? Nobody claps for a good listener. They should.', expr: 'happy' },
    { who: 'koro', text: 'Her father played that one the night she was born.', expr: 'happy' },
    { who: 'aroha', text: 'I used to fall asleep right here. Somebody always carried me home.', expr: 'happy' },
  ])]);
}
/** a song at the fire with Hana: the close-up, then what everyone thinks of it */
async function lesson(c: VCtx, song: string) {
  const f = c.f;
  const { runGuitar } = await import('../../../ui/v12/closeup/guitar');
  f.player.poseOverride = 'sitGround';
  const r = await runGuitar({ song, who: 'hana', world: [f.player.x, f.player.y - 20] });
  f.player.poseOverride = null;
  if (r.aborted) { await say(f, [{ who: 'hana', text: 'Too shy? It gets easier. Everything does.', expr: 'neutral' }]); return; }
  const g = r.grade;
  addAffinity('hana', g === 'perfect' ? 7 : g === 'good' ? 5 : g === 'rough' ? 2 : 1, 'played guitar by the fire');
  if (g === 'perfect' || g === 'good') for (const id of Object.keys(c.vill)) if (id !== 'hana' && Math.abs(c.vill[id].a.x - X.fire) < 180) addAffinity(id, 1, 'a song by the fire');
  raiseMood(c, g === 'perfect' ? 1 : g === 'good' ? 0.7 : 0.3);
  if (g !== 'fail') restore(g === 'perfect' ? 12 : 6);
  const L: Record<string, BubbleLine[]> = {
    perfect: [{ who: 'hana', text: 'E hoa! Listen to that! Everybody heard that!', expr: 'excited' }, { who: 'koro', text: 'Again. Play it again.', expr: 'happy' }],
    good: [{ who: 'hana', text: 'Ka pai! You played a song. Not at a song. A song.', expr: 'happy' }],
    rough: [{ who: 'hana', text: 'Rough as guts. But it was music. Tomorrow it’ll be better music.', expr: 'teasing' }],
    fail: [{ who: 'hana', text: 'Ha! Don’t worry. My first time, the dog left.', expr: 'laugh' }],
  };
  await say(f, L[g] ?? L.rough);
  // Hoki Mai played well: her father's guitar goes with him
  if (song === 'hoki' && r.acc >= 0.7 && count('vil_guitar') === 0) {
    await say(f, [
      { who: 'hana', text: 'Take her. No, take her. She hasn’t been anywhere since Dad. She wants to travel.', expr: 'serious' },
      { who: 'hana', text: 'Play for your crew. A camp that sings together sticks together.', expr: 'happy' },
    ]);
    give('vil_guitar', 1);
    const [cx, cy] = f.css(f.player.x, f.player.y - 30);
    f.hud?.flyItem('vil_guitar', 1, ITEMS.vil_guitar?.name ?? 'Guitar', cx, cy);
    addAffinity('hana', 6, 'the guitar');
  }
  refresh();
}

/** at camp in the evening: a song for the crew (the camp's fire station calls this) */
export async function campSong(host: { s: { player: { x: number; y: number; poseOverride: string | null }; hud?: { refresh(f?: boolean): void } | null } }): Promise<void> {
  await bootSideQuests();
  const { SONGS, songOpen, runGuitar } = await import('../../../ui/v12/closeup/guitar');
  const open = SONGS.filter(s => songOpen(s.id));
  const pick = await floatChoices([...open.map(s => ({ text: s.name })), { text: 'Not tonight' }]);
  if (pick === null || pick >= open.length) return;
  const p = host.s.player;
  p.poseOverride = 'sitGround';
  const r = await runGuitar({ song: open[pick].id, who: 'crew', world: [p.x, p.y - 20] });
  p.poseOverride = null;
  if (r.aborted) return;
  game.save.vars['v12g:campDay'] = dayNumber();
  const g = r.grade, n = g === 'perfect' ? 5 : g === 'good' ? 3 : g === 'rough' ? 1 : 0;
  for (const who of ['jenna', 'joshu', 'aroha'] as const) addBond(who, n);
  if (g !== 'fail') { restore(g === 'perfect' ? 16 : 8); setQf('guitar:camp'); }
  const lines: Record<string, [string, string][]> = {
    perfect: [['joshu', 'MORI! Where’ve you been hiding THAT?'], ['jenna', 'Okay. That was actually beautiful.']],
    good: [['aroha', 'That’s Aunty Hana’s song! You learned it!'], ['joshu', 'Not bad, Doc. Not bad at all.']],
    rough: [['jenna', 'I think the guitar was trying its best.'], ['joshu', 'Ha! Again tomorrow, eh?']],
    fail: [['joshu', 'Right. Who wants a cup of tea?'], ['aroha', 'Practice with Hana. She’ll fix you.']],
  };
  const ls = lines[g] ?? lines.rough;
  ls.forEach(([who, text], i) => setTimeout(() => game.ui.bubbles.bark(who, text, { expr: g === 'fail' ? 'laugh' : 'happy' }), 300 + i * 2600));
  if (n) setTimeout(() => floatNotice(g === 'perfect' ? 'The whole camp is singing (bond +5, rested)' : 'The crew are in good spirits (bond +' + n + ')', 3000), 5600);
  host.s.hud?.refresh(true);
}

// ------------------------------------------------------------------ spots in the village
function it(c: VCtx, o: Interactable) { (c.f.interact as Interactable[]).push(o); }
function prop(f: FieldScene, key: string, gen: () => Sprite | null, x: number, y: number, z: number, when: () => boolean, glint = false) {
  const cc = sprite(key, gen);
  if (!cc) return;
  const p = new Prop(cc.f, x, y, z);
  f.main.add(new Custom(z, (rr, st) => {
    if (!when()) return;
    p.draw(rr, st);
    if (glint) { const k = Math.max(0, Math.sin(st.time * 2.1 + x) - 0.55) / 0.45; if (k > 0) rr.fxDraw(A.spark, x + Math.sin(st.time) * 2, y - 8, 0.6, 0.6, st.time, packColor(1, 0.95, 0.75, 1), 1.3 * k); }
  }));
}
async function busy(f: FieldScene, fn: () => Promise<void>) {
  if (f.cutscene) return;
  f.cutscene = true;
  try { await fn(); } catch (e) { console.error(e); } finally { f.cutscene = false; refresh(); }
}
export function placeSideQuests(c: VCtx) {
  void bootSideQuests();
  curCtx = c;
  const f = c.f, g = c.ground;
  // ---- Tamati's garden: the anuhe on the mounds, the smoke, the picking
  const gx = X.garden[0] + 150;
  const kumOn = () => active('v12_kumara') && !qf('kum:done');
  for (let i = 0; i < 5; i++) {
    const x = gx - 40 + i * 19, y = g(x) - 4 - (i % 2) * 3;
    prop(f, 'vil12:anuhe', LA.anuhe, x, y, -2.2, () => kumOn() && (qf('kum:smoked') ? i < 3 - qv('kum:picked') : true));
  }
  it(c, {
    x: gx, y: g(gx), w: 40, h: 16, standX: gx - 24,
    get label() { return !qf('kum:look') ? 'Look at the chewed leaves' : !qf('kum:smoked') ? 'Smoke the mounds with kawakawa' : `Pick off an anuhe (${Math.max(0, 3 - qv('kum:picked'))} left)`; },
    enabled: () => kumOn() && qv('kum:picked') < 3,
    quest: () => kumOn() && (!qf('kum:look') || (count('kawakawa') >= 4 && villagePhase(c) === 'evening') || qf('kum:smoked')),
    action: () => busy(f, () => garden(c, gx)),
  } as Interactable);
  // ---- Manu's pen gate and the prints at the landing
  const pgx = X.pen[0] - 4;
  it(c, { x: pgx, y: g(pgx), w: 14, h: 18, standX: pgx - 18, label: 'Look at the pen gate', enabled: () => active('v12_taewa') && !qf('pig:pen'), quest: () => true,
    action: () => busy(f, async () => {
      f.player.facing = 1;
      await f.player.doWork('kneel', 1.4);
      setQf('pig:pen');
      await say(f, [
        { who: 'mori', text: 'The rope’s chewed clean through. And... little trotter prints. Heading west, toward the river.', expr: 'thinking' },
      ]);
    }) } as Interactable);
  const tx = X.reeds[1] + 6;
  prop(f, 'vil12:trotters', LA.trotters, tx, g(tx) + 2, -1.2, () => active('v12_taewa') && !qf('pig:caught'));
  it(c, { x: tx, y: g(tx), w: 22, h: 10, standX: tx + 18, label: 'Look at the prints in the mud', enabled: () => active('v12_taewa') && qf('pig:pen') && !qf('pig:landing'), quest: () => true,
    action: () => busy(f, async () => {
      f.player.facing = -1;
      await f.player.doWork('kneel', 1.4);
      setQf('pig:landing');
      await say(f, [
        { who: 'mori', text: 'The same prints, all the way down to the water’s edge... then along the bank. Downriver. Toward the mangroves.', expr: 'thinking' },
        { who: 'aroha', text: 'Kunekune love mangrove mud. He’ll be rooting for crabs. Bring a kūmara: no pig says no to a kūmara.', expr: 'happy' },
      ]);
    }) } as Interactable);
  // ---- Huia's stones: one in the shallows below the pou, and the pale one she warned about
  const sx = 262;
  prop(f, 'vil12:kohatu0', () => LA.kohatu(1), sx, g(sx) + 3, -1.1, () => active('v12_stones') && !qf('stone:landing') && !qf('stones:given'), true);
  it(c, { x: sx, y: g(sx), w: 14, h: 10, standX: sx + 14, label: 'Dig out the black stone', enabled: () => active('v12_stones') && !qf('stone:landing') && !qf('stones:given'), quest: () => true,
    action: () => busy(f, () => digStone(f, 'landing', sx, g(sx))) } as Interactable);
  const px2 = 306;
  prop(f, 'vil12:pale', () => LA.kohatu(0, true), px2, g(px2) + 3, -1.1, () => active('v12_stones') && !qf('stones:given'));
  it(c, { x: px2, y: g(px2), w: 14, h: 10, standX: px2 - 14, label: 'Look at the pale stone', enabled: () => active('v12_stones') && !qf('stones:given'),
    action: () => busy(f, async () => { await say(f, [{ who: 'mori', text: 'Pale, smooth, pretty. Sandstone. Nanny Huia said these go bang in the fire. Leave it.', expr: 'thinking' }]); }) } as Interactable);
  // ---- the hāngī at dusk
  it(c, { x: X.hangi, y: g(X.hangi), w: 22, h: 14, standX: X.hangi - 22, label: 'Lift the hāngī with Nanny Huia', enabled: () => active('v12_stones') && qf('stones:given') && !qf('stones:done') && villagePhase(c) === 'evening', quest: () => true,
    action: () => busy(f, () => liftHangi(c)) } as Interactable);
  // ---- Hēmi's finished prow on the shed bench
  const hx = X.shed + 56;
  prop(f, 'vil12:tauihu', LA.tauihu, hx, g(hx) + 1, -2.4, () => qf('prow:done'));
}

async function garden(c: VCtx, gx: number) {
  const f = c.f;
  const Q = await import('../../v12/qte');
  if (!qf('kum:look')) {
    await f.player.doWork('kneel', 1.6);
    setQf('kum:look');
    await say(f, [
      { who: 'mori', text: 'Leaves eaten to lace... and there. Fat green caterpillars, striped, a little horn on the tail. Dozens.', expr: 'surprised' },
      { who: 'mori', text: 'Kawakawa smoke, Tamati said. Four handfuls. It grows along the Fernwood stream.', expr: 'thinking' },
    ]);
    return;
  }
  if (!qf('kum:smoked')) {
    if (count('kawakawa') < 4) { await say(f, [{ who: 'mori', text: `Not enough kawakawa yet: ${count('kawakawa')} of 4 handfuls. It grows along the Fernwood stream.`, style: 'think' }]); return; }
    if (villagePhase(c) !== 'evening') { await say(f, [{ who: 'tamati', text: 'Not now, bro. They hide by day. At dusk, when they come out to feed.', expr: 'neutral' }]); return; }
    // Tamati comes over with an ember from the fire
    const t = c.vill.tamati;
    if (t && t.a.visible) { holdV(c, 'tamati', true); void t.a.walkTo(gx + 26, 60, 'walk'); }
    await say(f, [{ who: 'tamati', text: 'Here’s an ember. Leaves on, and fan it low through the mounds. Steady. Too hard and you blow it out.', expr: 'serious' }]);
    const r = await Q.qte({ kind: 'hold', f, x: gx, y: c.ground(gx) - 30, label: 'FAN THE SMOKE...', difficulty: 0.4 });
    if (!r.ok) { if (t) holdV(c, 'tamati', false); await say(f, [{ who: 'tamati', text: 'Blew it out. Again, gentler. You’ve still got the leaves.', expr: 'neutral' }]); return; }
    remove('kawakawa', 4);
    setQf('kum:smoked');
    const P = f.main.particles;
    for (let i = 0; i < 60; i++) setTimeout(() => P.spawn({ frame: A.soft, x: gx - 50 + Math.random() * 100, y: c.ground(gx) - 4, vx: (Math.random() - 0.5) * 8 + f.st.wind * 8, vy: -8 - Math.random() * 10, life: 3 + Math.random() * 2, color: [0.78, 0.8, 0.74], alpha: 0.32, alpha1: 0, size: 0.4, size1: 2.2 }), i * 60);
    audio.play('rustle', { vol: 0.4 });
    await sleep(1800);
    await say(f, [
      { who: 'tamati', text: 'Look at them go! Dropping off like they’ve seen my mother-in-law.', expr: 'laugh' },
      { who: 'tamati', text: 'A few stubborn ones hanging on. Pick them off. Gently, they’re only hungry.', expr: 'happy' },
    ]);
    if (t) holdV(c, 'tamati', false);
    return;
  }
  const r = await Q.qte({ kind: 'ring', f, x: gx - 30 + qv('kum:picked') * 19, y: c.ground(gx) - 20, label: 'PICK IT OFF!', difficulty: 0.45 });
  if (!r.ok) { floatNotice('It curled up and hung on tighter', 2200); return; }
  setQv('kum:picked', qv('kum:picked') + 1);
  audio.play('collectPop', { vol: 0.4 });
  floatNotice(qv('kum:picked') >= 3 ? 'The last anuhe! Tell Tamati' : `Anuhe picked off (${qv('kum:picked')} of 3)`, 2400);
}

async function digStone(f: FieldScene, where: string, x: number, y: number) {
  const { closeupQte } = await import('../../../ui/v12/closeup/index');
  f.player.facing = x >= f.player.x ? 1 : -1;
  const r = await closeupQte({ scene: 'dig', buried: 'find', item: 'q_kohatu', difficulty: 0.45 }, [x, y - 6]);
  if (!r.ok) { floatNotice('It’s still stuck fast. Try again.', 2200); return; }
  setQf('stone:' + where);
  give('q_kohatu', 1);
  const [cx, cy] = f.css(x, y - 14);
  f.hud?.flyItem('q_kohatu', 1, 'Hāngī stone', cx, cy);
  floatNotice(`Hāngī stone (${Math.min(3, count('q_kohatu'))} of 3)`, 2400);
}

async function liftHangi(c: VCtx) {
  const f = c.f;
  const Q = await import('../../v12/qte');
  const h = c.vill.huia;
  if (h && h.a.visible) { holdV(c, 'huia', true); void h.a.walkTo(X.hangi + 18, 50, 'walk').then(() => { h.a.facing = -1; h.a.setAnim('kneelWork'); }); }
  await say(f, [{ who: 'huia', text: 'Earth off, sacks off... now the baskets. Together, on three. One, two...', expr: 'serious' }]);
  const r = await Q.qte({ kind: 'mash', f, x: X.hangi, y: c.ground(X.hangi) - 30, label: 'HEAVE!', difficulty: 0.45 });
  if (!r.ok) { if (h) holdV(c, 'huia', false); await say(f, [{ who: 'huia', text: 'Ooh, heavy! Get your back into it, boy. Again.', expr: 'teasing' }]); return; }
  setQf('stones:done');
  const P = f.main.particles, gy = c.ground(X.hangi);
  for (let i = 0; i < 40; i++) P.spawn({ frame: A.soft, x: X.hangi + (Math.random() - 0.5) * 30, y: gy - 6, vx: (Math.random() - 0.5) * 14, vy: -20 - Math.random() * 20, life: 2 + Math.random() * 1.5, color: [0.92, 0.92, 0.9], alpha: 0.4, alpha1: 0, size: 0.4, size1: 2 });
  audio.play('discover', { vol: 0.4 });
  await say(f, [
    { who: 'huia', text: 'Smell that! Pork, kūmara, pumpkin, steamed in the earth on YOUR stones. KAI’S UP!', expr: 'excited' },
    { who: 'huia', text: 'Take this too: how to dig a pit like mine at your camp. And my kawakawa fish stew, because you’re still too thin.', expr: 'happy' },
  ]);
  payout({ aff: [['huia', 15], ['koro', 3], ['tamati', 2], ['mere', 2], ['manu', 2], ['hana', 2], ['rawiri', 2], ['hemi', 2], ['pipi', 2], ['ani', 2], ['mikaere', 2]], blueprint: ['hangi_oven', 'quest:huia'], recipe: ['fishstew', 'huia'] });
  raiseMood(c, 0.8);
  if (h) setTimeout(() => holdV(c, 'huia', false), 4000);
}

// ------------------------------------------------------------------ out on the trails
type Ground = (x: number) => number;
async function farSpots(f: FieldScene, loc: string | null, r: TripRun | null) {
  if (!loc) return;
  const g: Ground = x => (r ? r.groundAt(x) : f.st.terrain.groundY(x));
  try {
    if (loc === 'fernwood' || loc === 'forest') {
      const { toWorld } = await import('../../v12/region');
      fernwood(f, g, loc === 'forest' ? toWorld('fernwood', 0) : 0);
    } else if (loc === 'mangrove') mangrove(f, g);
    else if (loc === 'hills') hills(f, g);
  } catch (e) { console.warn('[sidequests] spots', loc, e); }
}
function itF(f: FieldScene, o: Interactable) { (f.interact as Interactable[]).push(o); }

function fernwood(f: FieldScene, g: Ground, ox: number) {
  // the paretaniwha bush by the stream
  const fx = ox + 1430;
  prop(f, 'vil12:paretaniwha', () => LA.paretaniwha(931, 34), fx, g(fx) + 3, -1.6, () => true);
  itF(f, {
    x: fx, y: g(fx), w: 20, h: 26, standX: fx - 18,
    get label() { return !qf('flax:found') ? 'Look at the bronze harakeke' : 'Ease out an outer leaf'; },
    enabled: () => active('v12_flax') && !qf('flax:given') && (!qf('flax:found') || count('q_paretaniwha') < 3),
    quest: () => true,
    action: () => busy(f, async () => {
      if (!qf('flax:found')) {
        setQf('flax:found');
        discover({ id: 'vil12:paretaniwha', kind: 'plant', name: 'Paretaniwha', loc: 'fernwood', x: Math.round(fx - ox), note: 'Mere’s grandmother’s bronze harakeke, by the stream.' }, true);
        await say(f, [{ who: 'mori', text: 'Bronze leaves, a thin red line down every edge. This is it. Forty years old and still here.', expr: 'happy' }]);
        return;
      }
      const { closeupQte } = await import('../../../ui/v12/closeup/index');
      const res = await closeupQte({ scene: 'pull', flax: true, difficulty: 0.55 }, [fx, g(fx) - 14]);
      if (!res.ok) { floatNotice('Torn. Mere won’t want that one. Gently...', 2400); return; }
      give('q_paretaniwha', 1);
      const [cx, cy] = f.css(fx, g(fx) - 20);
      f.hud?.flyItem('q_paretaniwha', 1, 'Paretaniwha leaf', cx, cy);
      floatNotice(`Paretaniwha leaf (${Math.min(3, count('q_paretaniwha'))} of 3)`, 2400);
    }),
  } as Interactable);
  // kawakawa in the shade, two patches, a couple of handfuls a day each
  for (const [i, kx] of [[0, ox + 960], [1, ox + 1580]] as [number, number][]) {
    prop(f, `vil12:kawakawa:${i}`, () => plant('kawakawa' as never, 950 + i, 26), kx, g(kx) + 3, -1.5, () => true);
    itF(f, { x: kx, y: g(kx), w: 18, h: 20, standX: kx - 16, label: 'Pick kawakawa leaves', enabled: () => qv('kawa:' + i) !== dayNumber(), quest: () => active('v12_kumara') && !qf('kum:smoked') && count('kawakawa') < 4,
      action: () => busy(f, async () => {
        const ok = await f.player.doWork('kneel', 1.6);
        if (!ok) return;
        setQv('kawa:' + i, dayNumber());
        const got = give('kawakawa', 2);
        const [cx, cy] = f.css(kx, g(kx) - 16);
        f.hud?.flyItem('kawakawa', 2, 'Kawakawa leaf', cx, cy);
        void got;
        floatNotice('Kawakawa leaves (2)', 2000);
      }) } as Interactable);
  }
  // a hāngī stone in the stream bed
  stoneSpot(f, g, 'fernwood', ox + 1255);
}
function hills(f: FieldScene, g: Ground) {
  const W = f.site.width ?? 3200;
  stoneSpot(f, g, 'hills', Math.round(W * 0.42));
}
function stoneSpot(f: FieldScene, g: Ground, where: string, x: number) {
  const on = () => active('v12_stones') && !qf('stones:given') && !qf('stone:' + where);
  prop(f, `vil12:kohatu:${where}`, () => LA.kohatu(where === 'hills' ? 0 : 1), x, g(x) + 3, -1.1, on, true);
  itF(f, { x, y: g(x), w: 14, h: 10, standX: x - 14, label: 'Dig out the black stone', enabled: on, quest: () => true, action: () => busy(f, () => digStone(f, where, x, g(x))) } as Interactable);
}
function mangrove(f: FieldScene, g: Ground) {
  if (!active('v12_taewa') || qf('pig:caught') || !qf('pig:landing')) return;
  const x0 = 1300;
  const live = new Livestock(f, g);
  const pig = live.add('pig', x0, [x0 - 70, x0 + 70], { v: 2 });
  live.mount(40);
  let gone = false;
  live.interact(pig, 'Coax Taewa with a kūmara', () => busy(f, async () => {
    if (count('vil_kumara') < 1) { await say(f, [{ who: 'mori', text: 'He won’t come to an empty hand. A kūmara would do it. Tamati and Rāwiri always have some.', style: 'think' }]); return; }
    f.player.facing = pig.x > f.player.x ? 1 : -1;
    await f.player.doWork('kneel', 1.2);
    pig.tx = f.player.x + 14 * f.player.facing; pig.anim = 'walk'; pig.left = 4;
    await sleep(1200);
    const Q = await import('../../v12/qte');
    const r = await Q.qte({ kind: 'ring', f, x: pig.x, y: pig.y - 24, label: 'SCOOP HIM UP!', difficulty: 0.5 });
    if (!r.ok) {
      pig.tx = Math.max(x0 - 70, Math.min(x0 + 70, pig.x + (pig.x > f.player.x ? 60 : -60))); pig.anim = 'walk'; pig.left = 3; pig.speed *= 2.4;
      setTimeout(() => { pig.speed /= 2.4; }, 1500);
      floatNotice('He squealed and bolted. Try again, slower.', 2400);
      return;
    }
    remove('vil_kumara', 1);
    give('q_taewa', 1);
    setQf('pig:caught');
    gone = true;
    live.list.splice(live.list.indexOf(pig), 1);
    const [cx, cy] = f.css(f.player.x, f.player.y - 20);
    f.hud?.flyItem('q_taewa', 1, 'Taewa the piglet', cx, cy);
    audio.play('collectPop', { vol: 0.5 });
    await say(f, [{ who: 'mori', text: 'Got you! Ugh, you’re all mud. Into the kete. Manu’s going to be so happy.', expr: 'happy' }]);
  }), () => !gone && active('v12_taewa') && !qf('pig:caught'));
}

// ------------------------------------------------------------------ testing (dev points)
const PREFIX: Record<string, string> = { v12_kumara: 'kum:', v12_flax: 'flax:', v12_taewa: 'pig:', v12_prow: 'prow:', v12_stones: 'stone', v12_guitar: 'guitar:' };
/** set a side quest back to its offer (everyone met, its giver ready to ask); start: already accepted */
export function stageQuest(id: string, start = false) {
  defs();
  void bootSideQuests();
  for (const v of ['koro', 'huia', 'mere', 'tamati', 'manu', 'rawiri', 'hemi', 'hana', 'pipi', 'ani', 'mikaere']) game.save.flags['v11v:met:' + v] = true;
  game.save.flags['v11v:huiaMet'] = true;
  game.save.flags['v10:kete'] = true;
  const pre = 'v12q:' + (PREFIX[id] ?? '#');
  for (const k of Object.keys(game.save.flags)) if (k.startsWith(pre)) delete game.save.flags[k];
  for (const k of Object.keys(game.save.vars)) if (k.startsWith(pre)) delete game.save.vars[k];
  delete game.save.quests[id];
  if (start) { startQuest(id, true); game.save.tracked = id; }
  game.persist();
}

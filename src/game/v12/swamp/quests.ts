// V12 Te Repo Raupō, what there is to do: the swamp's finds (a peat core, a raupō root, the whare on the
// hidden island and the matau buried in its floor, the giant toad's shed skin, the places to photograph)
// and three side quests from the crew, pinned to the camp board like the others (src/game/v10/campquests.ts):
//
//   The Voice in the Swamp   Aroha: Koro says something booms in Te Repo Raupō on wet nights. Find its
//                            pool, and bring back a photo of it calling (dusk, in the rain, from cover).
//   Koro's Matau             Aroha: Koro's grandfather lost his pounamu fish hook at his eel-fishing
//                            whare, on an island in the swamp. Find the island, dig it out, bring it home.
//   Hot to Handle            Jenna: an ember toad toxin sample for the lab. Grip gloves on.

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID } from '../../quests';
import type { QuestDef, QuestStep } from '../../quests';
import { REQUESTS, REQ_BY_ID } from '../../v10/campquests';
import type { Req } from '../../v10/campquests';
import { count } from '../../inventory';
import { ITEMS } from '../../items';
import { dayNumber } from '../../v10/day';
import { findArt } from '../../v10/finds';
import type { Point10 } from '../../sites10/kit';
import { CHANNEL, POOL, MAIMAI, swGround } from './layout';
import { TOAD_ID, EMBER_ID } from './species';

const F = (k: string) => !!game.save.flags[k];
const given = (id: string) => F(`v10:req:${id}:given`);
const docBeh = (sp: string, beh: string) => { const e = game.save.research?.[sp]; return !!e && (e.beh.includes(beh) || e.vid.includes(beh)); };
const have = (id: string, item: string, n: number): QuestStep => ({
  text: `Collect ${n} ${ITEMS[item]?.name ?? item}`, done: () => given(id) || count(item) >= n, progress: () => [Math.min(n, given(id) ? n : count(item)), n],
});

// ---------------------------------------------------------------- the finds
export const SWAMP_POINTS: Point10[] = [
  { id: 'eco:sw:repo', kind: 'ecosystem', name: 'Te Repo Raupō', x: 3000, photo: { w: 320, h: 120 }, note: 'A raupō swamp: peat under black water, bulrush beds, kahikatea on buttresses. Eels, toads and wading birds; the whole thing a sponge for the forest\'s rain.' },
  { id: 'lm:sw:kahikatea', kind: 'landmark', name: 'The white pine swamp', x: 1400, photo: { w: 200, h: 200 }, note: 'Kahikatea standing in the water on great buttresses: the swamp forest, the oldest trees here.' },
  { id: 'lm:sw:maimai', kind: 'landmark', name: 'The maimai', x: MAIMAI.x0 + 20, photo: { w: 60, h: 110, dy: 0 }, note: 'An old hunters\' hide on poles over the raupō. Somebody sat up here for the ducks, a long time ago.' },
  { id: 'lm:sw:drowned', kind: 'landmark', name: 'The drowned trees', x: 6000, photo: { w: 260, h: 180 }, note: 'A whole stand of trees killed when the water rose, bleached silver and still standing.' },
  {
    id: 'lm:sw:whare', kind: 'ruin', name: 'The eel-fisher\'s whare', x: CHANNEL.hut, photo: { w: 90, h: 50 },
    note: 'A whare raupō on an island in the channel: walls of bulrush bundles, a thatch with a hole in it, an eel pot by the door.',
    look: { verb: 'Look inside the whare', lines: () => [
      { who: 'mori', text: 'Someone lived out here. Eel pots, a drying rack... a fire pit in the floor. Nobody\'s been in for years.', expr: 'wow' },
      { who: 'aroha', text: 'This was Koro\'s grandfather\'s. He took eels here every autumn. Kia tūpato: careful in there.', expr: 'serious' },
    ] },
    after: () => { game.save.flags['sw:whare'] = true; game.persist(); },
  },
  {
    id: 'pt:sw:matau', kind: 'artifact', name: 'Pounamu matau', x: CHANNEL.hut - 22, y: swGround(CHANNEL.hut - 22),
    art: () => findArt.dig('#2c2016'), note: 'A greenstone fish hook, buried in the whare\'s floor by the hearth.',
    take: { item: 'swp_matau', verb: 'Dig in the whare\'s floor by the hearth', time: 2.2, line: 'Something green... a hook. Greenstone. Oh, Aroha is going to want to see this.', aroha: 'That\'s Koro\'s grandfather\'s matau. It has to go home to him.' },
    when: () => F('sw:whare'),
  },
  { id: 'pt:sw:peat', kind: 'sample', name: 'Peat core', x: 2420, art: () => findArt.dig('#20160e'), take: { item: 'smp_peat', verb: 'Take a peat core', time: 1.8, line: 'Layers and layers. The bottom of this core is older than anybody on the island.' } },
  { id: 'pt:sw:raupo', kind: 'plant', name: 'Raupō root', x: 3500, art: () => findArt.plant('#8a6a3a', 16), take: { item: 'plt_raupo', verb: 'Pull up a raupō root', time: 1.6, line: 'All starch! Aroha says they baked these. And made bread from the POLLEN.' } },
  {
    id: 'pt:sw:skin', kind: 'sample', name: 'A shed toad skin', x: POOL.x1 + 30,
    art: () => findArt.sampleSpot('#b8ae86'), note: 'A toad\'s shed skin, papery and warty, big as a raincoat.',
    look: { verb: 'Look at the papery thing', lines: () => [
      { who: 'mori', text: 'Is that... skin? A shed skin. Warts and all. It\'s as big as a raincoat. What sheds a skin as big as a RAINCOAT?', expr: 'worried' },
      { who: 'aroha', text: 'The old one in the pool. It eats its skin, usually. This one it forgot.', expr: 'neutral' },
    ] },
  },
];

// ---------------------------------------------------------------- the side quests
const REQS: Req[] = [
  {
    id: 'r_bellow', giver: 'aroha', title: 'The Voice in the Swamp', unlock: () => dayNumber() >= 3 || F('visit:swamp'),
    desc: 'Koro says something in Te Repo Raupō booms on wet nights, a sound like a drum under the water. Aroha wants to know what it is, and to see it.',
    steps: [
      { text: 'Find the dark pool in Te Repo Raupō', done: () => F('sw:pool'), hint: 'Past the bulrush beds, where the boardwalk ends at a fallen kahikatea. Go down the bank, quietly.' },
      { text: 'Photograph the Giant Bellowtoad calling', done: () => docBeh(TOAD_ID, 'calling'), hint: 'It only booms at dusk or night when it rains. Hide in the raupō at the pool\'s edge and keep very still. Then develop the photo at the laptop.' },
    ],
    reward: { rp: 60, bond: 8, text: 'Aroha listens to the boom on your camera three times. Koro, she says, will want to hear it too.' },
    ask: 'Koro says there\'s a voice in the raupō swamp on wet nights. A drum, under the water. He says it\'s old. I want to see it. Will you bring me a picture of it, singing?',
    thanks: 'That\'s it. That\'s Te Tupuna o te Repo. Koro was right. Look at its THROAT.',
  },
  {
    id: 'r_matau', giver: 'aroha', title: 'Koro\'s Matau', unlock: () => dayNumber() >= 3 || F('visit:swamp'),
    desc: 'Koro\'s grandfather took eels from a whare on an island in Te Repo Raupō. He lost his pounamu matau, a greenstone fish hook, there the year the water rose. Koro has never been back.',
    steps: [
      { text: 'Find the hidden island in Te Repo Raupō', done: () => F('sw:whare'), hint: 'Past the drowned trees there\'s a channel with a swing bridge. Go down under it and wade. Look for the raupō walls.' },
      have('r_matau', 'swp_matau', 1),
    ],
    give: [['swp_matau', 1]],
    reward: { rp: 45, bond: 12, items: [['ration', 2]], text: 'Aroha wraps the matau in flax to take to Koro. She doesn\'t say anything for a while.' },
    ask: 'There was a whare on an island in the raupō swamp. Koro\'s grandfather\'s. He lost his matau there, his greenstone hook. If it\'s still in the floor... it should come home.',
    thanks: 'Koro\'s grandfather wore this. I... thank you, Mori. Really. He\'s going to cry, and pretend he isn\'t.',
  },
  {
    id: 'r_toxin', giver: 'jenna', title: 'Hot to Handle', unlock: () => F('visit:swamp'),
    desc: 'Jenna read that some frog toxins are painkillers in tiny doses. She wants an ember toad toxin sample for the lab. Grip gloves ON.',
    steps: [have('r_toxin', 'smp_embertoxin', 1)],
    give: [['smp_embertoxin', 1]],
    reward: { rp: 35, bond: 6, text: 'Jenna labels the vial in big red letters and puts it on the highest shelf.' },
    ask: 'Those little orange toads in the swamp? Their skin\'s full of toxin. Some of those are painkillers! In tiny doses! Get me a sample. Gloves, Mori. GLOVES.',
    thanks: 'Ooh, it\'s ORANGE. Okay. Highest shelf. Nobody touch it. Especially Joshu.',
  },
];

let done = false;
/** pin the swamp's requests to the camp board (after boot, free of the import cycle) */
export function registerSwampQuests() {
  if (done) return;
  done = true;
  for (const r of REQS) {
    if (REQ_BY_ID[r.id]) continue;
    REQUESTS.push(r);
    REQ_BY_ID[r.id] = r;
    const steps = [...r.steps];
    if (r.give) steps.push({ text: `Hand ${r.give.map(([id, n]) => `${n} ${ITEMS[id]?.name ?? id}`).join(' and ')} in at the camp board`, done: () => given(r.id), hint: 'The board on two driftwood posts, between the drying rack and Aroha’s lean-to.' });
    const q: QuestDef = { id: r.id, title: r.title, giver: r.giver === 'agency' ? 'story' : r.giver, main: false, desc: r.desc, steps, reward: { rp: r.reward.rp, items: r.reward.items, text: r.reward.text } };
    if (!QUEST_BY_ID[q.id]) { QUESTS.push(q); QUEST_BY_ID[q.id] = q; }
  }
}
void EMBER_ID;

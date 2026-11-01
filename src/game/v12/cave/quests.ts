// V12 Te Rua Pōuri, what there is to find and do: the places to photograph (the wētā hall, the glowworm
// curtains, the fungus hall, the crystal gallery, the falls, the glowworm sky over the lake), the
// samples (cave water, a crystal, bat guano), the lost caver's camp and his journal, and two side
// quests pinned to the camp board (src/game/v10/campquests.ts):
//
//   Te Kēhua o te Pō      Aroha: Koro's story of a pale ghost in the black water under the hill, that
//   (the Ghost in the     swallows the lights of those who go too deep. A caver went down in 1974 and
//   Dark Water)           never came back. Reach the lake, find what happened to him, and bring back
//                         a photo of the ghost with its jaws wide open. And his journal, for Koro.
//   Samples from the      Jenna: cave water, a cave crystal and bat guano for the lab.
//   Dark

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID } from '../../quests';
import type { QuestDef, QuestStep } from '../../quests';
import { REQUESTS, REQ_BY_ID } from '../../v10/campquests';
import type { Req } from '../../v10/campquests';
import { count, add } from '../../inventory';
import { ITEMS } from '../../items';
import { dayNumber } from '../../v10/day';
import { findArt } from '../../v10/finds';
import type { Point10 } from '../../sites10/kit';
import { gateOk } from '../gear';
import { floatNotice } from '../../../ui/v12/float';
import { SPOT, TIER, floorOf, FALLS } from './layout';
import { GULPER_ID } from './species';

const F = (k: string) => !!game.save.flags[k];
const given = (id: string) => F(`v10:req:${id}:given`);
const docBeh = (sp: string, beh: string) => { const e = game.save.research?.[sp]; return !!e && (e.beh.includes(beh) || e.vid.includes(beh)); };
const have = (id: string, item: string, n: number): QuestStep => ({
  text: `Collect ${n} ${ITEMS[item]?.name ?? item}`, done: () => given(id) || count(item) >= n, progress: () => [Math.min(n, given(id) ? n : count(item)), n],
});
const at = (tier: string, x: number) => ({ x, y: floorOf(tier, x) });

// ---------------------------------------------------------------- the finds
export const CAVE_POINTS: Point10[] = [
  { id: 'eco:dc:mouth', kind: 'cave', name: 'Te Rua Pōuri', ...at('t0', 260), photo: { w: 220, h: 110 }, note: 'Behind the glowworm cave a dry chimney climbs into the headland, then the cave drops away in tiers into the dark.' },
  { id: 'lm:dc:roost', kind: 'landmark', name: 'The bat roost', ...at('t0', 930), photo: { w: 120, h: 90, dy: 0 }, note: 'Long-tailed bats hanging from the roof of the mouth, and a heap of their guano under them.' },
  { id: 'pt:dc:guano', kind: 'sample', name: 'Bat guano', ...at('t0', 950), art: () => findArt.dig('#3a2a1a'), take: { item: 'smp_guano', verb: 'Scoop up some guano (ew)', time: 1.6, line: 'For SCIENCE. Breathe through your mouth, Mori.' } },
  { id: 'lm:dc:wetahall', kind: 'landmark', name: 'The wētā hall', ...at('t1', 1180), photo: { w: 260, h: 200 }, note: 'A hall as tall as a house, every wall crawling with cave wētā, antennae waving at the lantern.' },
  { id: 'eco:dc:glowworms', kind: 'ecosystem', name: 'Glowworm curtains', ...at('t3', 1320), photo: { w: 200, h: 140, dy: 30 }, note: 'Glowworms on the roof of the dark stream: each a larva in a silk tube, fishing with threads of glue beads that catch the light.' },
  { id: 'eco:dc:fungi', kind: 'ecosystem', name: 'The fungus hall', ...at('t2', 1150), photo: { w: 240, h: 120 }, note: 'Ghost fungi growing on old roots washed down the cave, their gills glowing green in the dark.' },
  { id: 'lm:dc:gallery', kind: 'landmark', name: 'Te Ana Tioata, the crystal gallery', ...at('g', SPOT.crystals), photo: { w: 220, h: 100 }, note: 'A side gallery walled with crystals that keep glowing blue after the lantern has gone.' },
  { id: 'pt:dc:crystal', kind: 'sample', name: 'Cave crystal', ...at('g', SPOT.crystals + 30), art: () => findArt.glint('#7ae8ff'), take: { item: 'smp_cavecrystal', verb: 'Snap off a crystal blade', time: 2.2, line: 'It\'s glowing in my hand. Even with the lantern shut. Especially with the lantern shut.' } },
  { id: 'pt:dc:water', kind: 'sample', name: 'Cave water', ...at('t3', 1250), art: () => findArt.sampleSpot('#3a5a64'), take: { item: 'smp_cavewater', verb: 'Fill a jar from the pool', time: 1.6, line: 'Freezing! There\'s something tiny and white swimming in it. A shrimp. A BLIND shrimp.' } },
  { id: 'lm:dc:falls', kind: 'landmark', name: 'Te Tāheke, the hidden falls', x: FALLS.x, y: FALLS.bottom, photo: { w: 80, h: 300, dy: 0 }, note: 'The dark stream sinks through the floor and comes out of the wall again as a waterfall, falling into the lake chamber.' },
  { id: 'eco:dc:lake', kind: 'ecosystem', name: 'Te Waha o te Pō', ...at('t4', 700), photo: { w: 300, h: 220, dy: 40 }, note: 'The lake at the bottom of the dark: black water under a sky of glowworms. Something lives in it.' },
  {
    id: 'ruin:dc:camp', kind: 'ruin', name: 'The lost caver\'s camp', ...at('t4', SPOT.camp), photo: { w: 110, h: 50 },
    note: 'A camp from 1974: a collapsed canvas tent, a bedroll, a primus stove, a smashed lantern. Nobody came back for it.',
    look: { verb: 'Look round the old camp', lines: () => [
      { who: 'mori', text: 'Someone camped down here. A long time ago. The tent\'s rotted... the stove\'s still got fuel in it. A smashed lantern.', expr: 'worried' },
      { who: 'mori', text: 'He left everything. Who leaves everything?', expr: 'scared' },
    ] },
    after: () => { game.save.flags['dc:camp'] = true; game.persist(); },
  },
  {
    id: 'art:dc:journal', kind: 'artifact', name: 'The caver\'s journal', ...at('t4', SPOT.journal), note: 'D. Pike\'s journal, 1974: his last entries, by the lake.',
    look: { verb: 'Read the journal on the stone', lines: () => [
      { who: 'mori', text: '"D. Pike, NZ Speleological Society, 1974." Neat pencil. Let\'s see...', expr: 'thinking' },
      { who: 'mori', text: '"Day 3. Reached the lake. Blind salamanders in the stream pools: no eyes, gills like red feathers. They flee the lamp. Sat in the dark an hour. They came back."', expr: 'wow' },
      { who: 'mori', text: '"Day 4. Something in the lake. Rings on the water that close IN on a spot, then bubbles. Took a step back. Glad I did."', expr: 'worried' },
      { who: 'mori', text: '"Day 5. It took the lantern. Off the shingle, in one gulp. A mouth like a doorway, white as a ghost. It wants LIGHT, not me. Light on the pole, hide behind the rock: that\'s the photograph."', expr: 'shocked' },
      { who: 'mori', text: '"Day 6. Last candle. Going up while I can still see the ladder. If anyone finds this: it is not a monster. It is just very, very hungry."', expr: 'sad' },
      { who: 'mori', text: '...He went up in the dark. With one candle. I hope he made it. I\'m taking this home.', expr: 'sad' },
    ] },
    after: () => {
      if (!F('dc:journal')) {
        game.save.flags['dc:journal'] = true;
        if (count('dc_journal') < 1) { add('dc_journal', 1); floatNotice('Collected: The caver\'s journal', 2600); }
        game.persist();
      }
    },
  },
];

// ---------------------------------------------------------------- the side quests
const unlocked = () => F('visit:deepcave') || gateOk('lantern') || dayNumber() >= 6;
const REQS: Req[] = [
  {
    id: 'r_gulper', giver: 'aroha', title: 'Te Kēhua o te Pō', unlock: unlocked,
    desc: 'Koro tells of a pale ghost in black water under the hill, behind the glowworm cave: it swallows the lights of those who go too deep. In 1974 a caver went down there and never came back. Aroha wants to know if the story is true.',
    steps: [
      { text: 'Reach the lake at the bottom of Te Rua Pōuri', done: () => F('dc:lake'), hint: 'Up the dry chimney behind the glowworms (storm lantern), then down: the old ladder, the scree, the rope pitch, the wet pitch beside the falls. You\'ll need a climbing rope.' },
      { text: 'Find out what happened to the lost caver', done: () => F('dc:journal'), hint: 'His camp is by the lake, against the west wall. Look for a notebook on a flat stone.' },
      { text: 'Photograph the Ghost Gulper with its jaws wide open', done: () => docBeh(GULPER_ID, 'gaping'), hint: 'Light draws it. Hang the lantern on the caver\'s pole at the water\'s edge and get behind the rock. When the rings close in and the bubbles come, keep still. Then develop the photo at the laptop.' },
    ],
    give: [['dc_journal', 1]],
    reward: { rp: 110, bond: 14, items: [['ration', 2]], text: 'Aroha studies the photo for a long time. "Te Kēhua," she says. "Koro will want this. And the journal: his name was Pike. Someone should know where he got to."' },
    ask: 'Koro has a story about the glowworm cave. Behind it, he says, the hill is hollow, and in the dark at the bottom there\'s a ghost in the water that swallows lights. A caver went down in 1974 and never came out. Will you go and see? Carefully. Please.',
    thanks: 'Look at its MOUTH. Koro was right. And Mr Pike... at least now someone knows.',
  },
  {
    id: 'r_darksamples', giver: 'jenna', title: 'Samples from the Dark', unlock: unlocked,
    desc: 'Jenna has never had anything from a cave. She wants water from the dark stream, a crystal from the walls and (her words) "the bat stuff".',
    steps: [have('r_darksamples', 'smp_cavewater', 1), have('r_darksamples', 'smp_cavecrystal', 1), have('r_darksamples', 'smp_guano', 1)],
    give: [['smp_cavewater', 1], ['smp_cavecrystal', 1], ['smp_guano', 1]],
    reward: { rp: 60, bond: 6, text: 'Jenna holds the crystal up in her cupped hands in the dark of the tent and squeaks.' },
    ask: 'A CAVE? Bring me samples! Water, a crystal, and... the bat stuff. Yes. The bat stuff. In a jar. A sealed jar.',
    thanks: 'Ooh. Ooh! It glows! And the water has... shrimp! Blind shrimp! The bat stuff can go outside.',
  },
];

let done = false;
/** pin the cave's requests to the camp board (after boot, free of the import cycle) */
export function registerCaveQuests() {
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
void TIER;

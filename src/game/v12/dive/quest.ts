// V12 Te Ara Moana, the sea path: Joshu's request that takes Mori under Te Moana Rimurimu, the kelp-forest
// dive. Four steps: build the dive kit, catch a seal's barrel roll on camera, spear dinner and get it
// home past the sharks, and find the old hāpuku in its cave in the blue. Its flags also feed four feats
// (feats.ts: Seal Dance, Not Today, The Blue, Full Basket).

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID } from '../../quests';
import type { Giver } from '../../quests';
import { REQUESTS, REQ_BY_ID } from '../../v10/campquests';
import type { Req } from '../../v10/campquests';
import { isActive, hasBlueprint } from '../../v11/blueprints';
import { count } from '../../inventory';
import { floatText } from '../../../ui/v12/float';
import { onPhoto } from '../arc/common4';
import { onHarpoon } from '../arsenal-harpoon';
import { DIVE_CTX } from './ctx';
import { SEAL_ID, HAPUKU_ID, SHARK_ID, KING_ITEM, COD_ITEM } from './lifeguide';
import type { FieldScene } from '../../scenes/field';

const F = (k: string) => !!game.save.flags['dive:' + k];
const setF = (k: string) => { if (F(k)) return; game.save.flags['dive:' + k] = true; game.persist(); };
const fish = () => count(KING_ITEM) + count(COD_ITEM);

export const DIVE_QUEST: Req = {
  id: 'dive_moana', giver: 'joshu', title: 'Te Ara Moana',
  unlock: () => isActive('wetsuit') || hasBlueprint('air_tank'),
  desc: 'Joshu dived the kelp off this island forty years ago, before his knees went. He wants to know if the seals still dance down there, and if the old hāpuku is still in its cave. And he wants a fish for dinner that he did not have to wait for.',
  steps: [
    { text: 'Build the dive kit: the air tank and the speargun', done: () => isActive('air_tank') && isActive('speargun'), hint: 'Research them from the fins up, then build them at camp. Jenna has the plans.' },
    { text: 'Photograph a seal barrel-rolling under the kelp', done: () => F('roll'), hint: 'Sail to Te Moana Rimurimu and dive. The pod plays in the kelp shallows by the boat.' },
    { text: 'Spear dinner and get it home past the sharks', done: () => F('dinner'), hint: 'Kingfish school on the reef, blue cod sit on the rocks. Sharks come to a struggling fish: hide in thick kelp, or give them the blunt end.' },
    { text: 'Find the old hāpuku in its cave in the blue', done: () => F('groper'), hint: 'Out past the drop-off. Stay still by the cave and let it come to you.' },
  ],
  reward: { rp: 90, bond: 10, text: 'Joshu’s old dive knife, and a story about a hāpuku that took his whole catch bag in 1984.' },
  ask: 'Lad. Before my knees went I dived that kelp every summer. Seals dancing round you like dogs. An old hāpuku in a cave, big as a dinghy. Go see if they’re still there. And bring an old man a fish.',
  thanks: 'Still dancing, are they. And the old fella’s still in his cave. ...Good. Good. Now give me that fish before the sharks change their minds.',
};

/** the hooks on each dive: the photos, the dinner, the full basket */
const hooked = new WeakSet<FieldScene>();
let lastCatch = 0, wasDiving = false;
function tick() {
  const f = DIVE_CTX.scene;
  if (f && !hooked.has(f)) {
    hooked.add(f);
    onPhoto(f, [SEAL_ID, HAPUKU_ID, SHARK_ID, 'leviathan'], (sub, stars) => {
      if (stars < 2) return;
      if (sub.species === 'leviathan') setF('serpent');
      if (sub.species === SEAL_ID && sub.behavior === 'barrelroll' && !F('roll')) {
        setF('roll');
        void floatText({ text: 'A barrel roll! It’s showing off. ...It’s SHOWING OFF for me.', style: 'happy', ms: 2600 });
      }
      if (sub.species === HAPUKU_ID && ['peering', 'guarding', 'gaping'].includes(sub.behavior ?? '') && !F('groper')) {
        setF('groper');
        void floatText({ text: '(bubbles) Big as a dinghy. Joshu wasn’t exaggerating. For once.', style: 'whisper', ms: 3000 });
      }
    });
  }
  if (f) { lastCatch = DIVE_CTX.catches.length; wasDiving = true; return; }
  if (wasDiving) {
    // the dive is over: whatever was still in the catch bag came home
    wasDiving = false;
    if (lastCatch >= 5) setF('basket');
    if (lastCatch > 0 || fish() > 0) setF('dinner');
    lastCatch = 0;
  }
}

let registered = false;
/** put the request on the camp board and in the quest book, and hook the dives (idempotent) */
export function registerDiveQuest() {
  if (registered) return;
  registered = true;
  if (!REQ_BY_ID[DIVE_QUEST.id]) { REQUESTS.push(DIVE_QUEST); REQ_BY_ID[DIVE_QUEST.id] = DIVE_QUEST; }
  if (!QUEST_BY_ID[DIVE_QUEST.id]) {
    const d = { id: DIVE_QUEST.id, title: DIVE_QUEST.title, giver: DIVE_QUEST.giver as Giver, main: false, desc: DIVE_QUEST.desc, steps: DIVE_QUEST.steps, reward: { rp: DIVE_QUEST.reward.rp, text: DIVE_QUEST.reward.text } };
    QUESTS.push(d);
    QUEST_BY_ID[d.id] = d;
  }
  onHarpoon(ev => { if (ev === 'bang') setF('bang'); });
  setInterval(tick, 400);
}

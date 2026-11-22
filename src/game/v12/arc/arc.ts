// V12 Te Ara Matatū, the path of the watchers: the main arc after the night of the claw (user: "more
// quests, a whole six hours of gameplay ... super exciting always"). Seven chapters, one per old place
// the stone watchers point to, each with its own set piece:
//   arc_ch1 The Ruins' Eyes         the ruins: three carved eyes lit by the sun, the sealed whare, a cave-in
//   arc_ch2 The Fossil Wall         the fossils: a giant skull dug out piece by piece, Varga's race, the scree
//   arc_ch3 The Glow Forest         the glowforest at night: the lantern gecko unseen, the hunter in the dark
//   arc_ch4 The Ground Breathes     the Hot Valley: the geyser field and the eruption
//   arc_ch5 The Drowned Eye         the grotto and the deep: the octopus, a breath-held chase to the coast
//   arc_ch6 The Plunderers          the storm crossing to Motu Ahi, the crabs at the nests
//   arc_ch7 Te Korokoro             the five eyes open the gate; the Old One, a photography boss; the end
// This module registers the chain, starts it (Aroha brings Koro's word to camp once the raid is over and
// Mori has sat with Koro) and installs every chapter's scene content.

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../../quests';
import type { QuestDef } from '../../quests';
import { addCampEvent, dayNumber, addBond } from '../../v10/day';
import type { CampDay } from '../../v10/campday';
import { C10 } from '../../v10/campcrew';
import { groundY } from '../../../art/island4/layout';
import { cineBars } from '../../v11/cine';
import { ARC_CH1 } from './ch1';
import { ARC_CH2 } from './ch2';
import { ARC_CH3 } from './ch3';
import { ARC_CH4 } from './ch4';
import { ARC_CH5 } from './ch5';
import { ARC_CH6 } from './ch6';
import { ARC_CH7 } from './ch7';
import { installArc1to3 } from './arc1to3';
import { installArc4to7 } from './arc4to7';

export const ARC_QUESTS: QuestDef[] = [ARC_CH1, ARC_CH2, ARC_CH3, ARC_CH4, ARC_CH5, ARC_CH6, ARC_CH7];
const F = (k: string) => !!game.save.flags[k];

let registered = false;
export function registerArc() {
  if (registered) return;
  registered = true;
  for (const q of ARC_QUESTS) if (!QUEST_BY_ID[q.id]) { QUESTS.push(q); QUEST_BY_ID[q.id] = q; }
}

/** the arc can begin: the Bearer was turned back from Te Kāinga and Mori has sat with Koro since */
export const arcReady = () => F('raid:won') && (F('raid:report') || questStatus('feud_raid') === 'done');

let booted = false;
export function bootArc() {
  if (booted) return;
  booted = true;
  registerArc();
  installArc1to3();
  installArc4to7();
}

// ---------------------------------------------------------------- the start: Koro's word comes to camp
const campOf = (ctx: { camp: unknown }) => ctx.camp as CampDay;
addCampEvent({
  id: 'arcWatchers', slot: 'dinner', prio: 7,
  when: () => arcReady() && questStatus(ARC_CH1.id) === 'hidden' && dayNumber() >= 2,
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s;
    registerArc();
    await st.cut(async () => {
      cd.seatAll();
      s.hud?.show(false);
      cd.frame(C10.fire + 10, groundY(C10.fire) - 34, 1.9);
      cineBars(true);
      await st.say([
        { who: 'aroha', text: 'Koro sent me with a message. He says he should have told you before the raid. He did not think you would live through it.', expr: 'serious' },
        { who: 'mori', text: 'That is... very reassuring. Thank you, Koro.', expr: 'nervous' },
        { who: 'aroha', text: 'The stone animals. The broken ones out in the bush and the backcountry. They are not just statues. They are watchers.', expr: 'serious' },
        { who: 'aroha', text: 'Every one of them is looking somewhere. Koro says follow where they look and you find the old places. Six of them.', expr: 'serious', style: 'whisper' },
        { who: 'jenna', text: 'And at the end of the six?', expr: 'curious' },
        { who: 'aroha', text: 'Te Korokoro. The throat of the island. Nobody has opened it in his grandfather\'s time. Something old sleeps there.', expr: 'serious' },
        { who: 'joshu', text: 'Something old. Something BIG old, or something nice old?', expr: 'nervous' },
        { who: 'aroha', text: '(she grins) Ask Mori. He is the one who keeps running toward things.', expr: 'teasing' },
        { who: 'mori', text: 'The first watchers are at the old pā above the village. The ruins. I\'m going at first light.', expr: 'excited' },
      ]);
      game.save.flags['arc:heard'] = true;
      startQuest(ARC_CH1.id);
      addBond('aroha', 3);
      game.persist();
      cineBars(false);
      s.hud?.show(true);
      cd.release();
    });
  },
});

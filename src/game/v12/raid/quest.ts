// V12 Te Pō o te Matikuku, the night of the claw: the Bearer comes to Te Kāinga. The quest (tracked on
// the HUD's objective note and in Mori's notebook), its flags, and the boot that hooks the village.
//
// It starts once "The Claw and the Plume" is reported to Koro (flag feud:raidSoon, src/game/v12/feud).
// By day the village gets ready (./prep.ts: three barricades lashed across Te Huarahi, the market
// lane, and a word with Big Hank for something stronger than a sling); after dark Matikuku Nui comes
// through the gateway for the goats (./fight.ts). Put it to sleep with darts, or break its nerve so it
// runs; it must not reach the goats. Then photograph it, and sit with Koro by the fire.
//
// Flags (game.save.flags):
//   raid:started     the fight began (the gate went down)
//   raid:won         it was stopped: raid:asleep (tranquillised) or raid:fled (its nerve broke)
//   raid:lost        it took a goat (the night can be tried again)
//   raid:photo       photographed in the aftermath
//   raid:report      sat with Koro by the fire afterwards
// Vars: raid:built (barricades lashed, 0..3), raid:tries (nights it came)

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest, currentStepIndex } from '../../quests';
import type { QuestDef } from '../../quests';

export const RAID_ID = 'feud_raid';
export const F = (k: string) => !!game.save.flags[k];
export const setF = (k: string, v = true) => { game.save.flags[k] = v; game.persist(); };
export const V = (k: string) => game.save.vars[k] ?? 0;
export const setV = (k: string, n: number) => { game.save.vars[k] = n; game.persist(); };

export const BARRICADES = 3;
export const builtN = () => Math.min(BARRICADES, V('raid:built'));
/** any of Big Hank's weapons on the belt (the arsenal is optional: the sling alone can do it, barely) */
export const armed = () => game.save.tools.some(t => ['bolas', 'flaregun', 'bangers', 'netgun', 'tranq', 'bearspray'].includes(t));
export const raidActive = () => questStatus(RAID_ID) === 'active';
export const raidWon = () => F('raid:won');
export function raidStep(): number { return raidActive() ? currentStepIndex(RAID_QUEST) : -1; }

export const RAID_QUEST: QuestDef = {
  id: RAID_ID, title: 'The Night of the Claw', giver: 'aroha', main: true,
  desc: 'Matikuku Nui has lost its kills to the plumed boa once too often, and it has smelt the goats of Te Kāinga. Koro thinks it will come through the gateway after dark. Nobody wants it dead: it was here first. But it cannot have the goats.',
  steps: [
    { text: 'Lash three barricades across Te Huarahi, the market lane', done: () => builtN() >= BARRICADES || F('raid:started'), progress: () => [builtN(), BARRICADES], hint: 'The stakes are cut and stacked in the lane. Lash them where the lane narrows, between the gate and the goats.' },
    { text: 'Ask Big Hank for something stronger than a sling (if you like)', done: () => armed() || F('raid:started'), hint: 'His lean-to is at the end of the lane, by the crossroads. Darts would put it to sleep; flares and bangers break its nerve.' },
    { text: 'Defend Te Kāinga when night falls: keep it from the goats', done: () => F('raid:won'), hint: 'Be in the village after dark. Darts build up until it sleeps; flares, bangers, spray and the sling break its nerve. Stay out of reach of the claw: watch for it rearing.' },
    { text: 'Photograph Matikuku Nui up close', done: () => F('raid:photo') || F('raid:fled'), hint: 'While it sleeps it is safe to get close. Quietly.' },
    { text: 'Sit with Koro by the fire', done: () => F('raid:report'), hint: 'Koro waits at the fire on the marae.' },
  ],
  reward: { rp: 220, text: 'Koro gives you the name the village keeps for those who stand at the gate. Matikuku Nui’s claw marks stay on the gateway.' },
};

let registered = false;
export function registerRaid() {
  if (registered) return;
  registered = true;
  if (!QUEST_BY_ID[RAID_ID]) { QUESTS.push(RAID_QUEST); QUEST_BY_ID[RAID_ID] = RAID_QUEST; }
}

/** start the quest once the feud has been reported to Koro (idempotent) */
export function maybeStartRaid(quiet = false): boolean {
  registerRaid();
  if (questStatus(RAID_ID) !== 'hidden' || !F('feud:raidSoon')) return false;
  startQuest(RAID_ID, quiet);
  return true;
}

// V12 Te Ara Matatū (the path of the watchers), chapter 1: Ngā Kanohi o te Pā, the Ruins' Eyes. The quest and
// its install; the scene (the carved stones, the sealed whare, the cave-in) is ./ch1scene.ts, loaded when
// Mori walks into the Old Pā.
//
// Flags (all arc:ch1:*) and the full story beats: see the header of ./ch1scene.ts.

import type { QuestDef } from '../../quests';
import { game } from '../../game';

const F = (k: string) => !!game.save.flags[k];
const active = (id: string) => game.save.quests?.[id] === 'active';

// ------------------------------------------------------------------ the quest
export const ARC_CH1: QuestDef = {
  id: 'arc_ch1', title: 'The Ruins\' Eyes', giver: 'story', main: true,
  desc: 'Koro says the stone watchers of the old people look toward five old places, and that the first of them is at the Old Pā. "The watchers open their eyes when the sun looks with them."',
  steps: [
    { text: 'Go to the Old Pā and find what the watchers are looking at', done: () => F('arc:ch1:arrived'), hint: 'The Old Pā, Te Pā Tawhito: up the old track from Te Kāinga.' },
    { text: 'Photograph the three carved eyes when the sun lands in them', done: () => F('arc:ch1:eye1') && F('arc:ch1:eye2') && F('arc:ch1:eye3'),
      progress: () => [['arc:ch1:eye1', 'arc:ch1:eye2', 'arc:ch1:eye3'].filter(F).length, 3],
      hint: 'A sliver of sun slides across each stone through the day. The morning stone on the low terrace, the noon stone by the great carving, the afternoon stone on the top terrace. Sit by one to wait for the light.' },
    { text: 'Open the sealed whare the watchers are looking at', done: () => F('arc:ch1:open'), hint: 'On the top terrace, dug into the bank.' },
    { text: 'Make a rubbing of the painted rafters inside', done: () => F('arc:ch1:rubbing') },
    { text: 'Get out before the terrace comes down!', done: () => F('arc:ch1:escaped'), hint: 'Sprint (Shift), but don\'t run your breath out. Watch the ground for falling rocks.' },
    { text: 'Read the rubbing with Aroha', done: () => F('arc:ch1:done') },
  ],
  reward: { rp: 120, text: 'The kōwhaiwhai rubbing' },
  next: 'arc_ch2',
};

const shown = () => F('arc:ch1:arrived') || active('arc_ch1') || F('arc:ch1:done');

let installed = false;
/** put the chapter's scene content into 'ruins' whenever Mori walks in (once the chapter has begun) */
export function installCh1() {
  if (installed) return;
  installed = true;
  void import('../../v10/field10').then(m => m.onLocEnter(async (f, loc, r) => {
    if (loc !== 'ruins' || !shown()) return;
    const sc = await import('./ch1scene');
    try { sc.build(f); } catch (e) { console.warn('[arc ch1] build', e); }
  }));
}

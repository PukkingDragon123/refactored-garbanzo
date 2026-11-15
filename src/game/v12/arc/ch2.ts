// V12 Te Ara Matatū, chapter 2: Te Pakitara Iwi, the Fossil Wall. The quest and its install; the scene (the
// skull pieces, Dr Varga's race, the rockfall down the scree) is ./ch2scene.ts, loaded at the Bone Cliffs.
//
// Flags (all arc:ch2:*) and the full story beats: see the header of ./ch2scene.ts.

import type { QuestDef } from '../../quests';
import { game } from '../../game';

const F = (k: string) => !!game.save.flags[k];
const active = (id: string) => game.save.quests?.[id] === 'active';

// ------------------------------------------------------------------ the quest
export const ARC_CH2: QuestDef = {
  id: 'arc_ch2', title: 'The Fossil Wall', giver: 'story', main: true,
  desc: 'The rubbing\'s hardest-pressed eye is Te Toka Iwi, the Bone Cliffs above the falls, where Koro says the old taniwha went to sleep and the rock grew over them.',
  steps: [
    { text: 'Follow the rubbing to Te Toka Iwi, the Bone Cliffs', done: () => F('arc:ch2:arrived'), hint: 'Up the gorge above Thunder Falls, or down off the ridge from the hills.' },
    { text: 'Dig out the pieces of the giant skull', done: () => F('arc:ch2:dug1') && F('arc:ch2:dug2') && F('arc:ch2:dug3'),
      progress: () => [['arc:ch2:dug1', 'arc:ch2:dug2', 'arc:ch2:dug3'].filter(F).length, 3],
      hint: 'Look for curves of bone showing in disturbed earth: on the bone terrace, out on the high ledge and down by the river.' },
    { text: 'Beat Dr Varga to the last piece, up on the scree', done: () => F('arc:ch2:race'), hint: 'She walks there, then digs. Sprint, but save some breath.' },
    { text: 'Outrun the rockfall down the scree!', done: () => F('arc:ch2:escaped'), hint: 'Sprint for the big rock at the bottom. Run out of breath and it has you.' },
    { text: 'Lay out the skull and see what it shows', done: () => F('arc:ch2:done') },
  ],
  reward: { rp: 150, text: 'The skull of the old taniwha' },
  next: 'arc_ch3',
};

const shown = () => active('arc_ch2') || F('arc:ch2:done');

let installed = false;
/** put the chapter's scene content into 'fossils' whenever Mori walks in (once the chapter has begun) */
export function installCh2() {
  if (installed) return;
  installed = true;
  void import('../../v10/field10').then(m => m.onLocEnter(async (f, loc, r) => {
    if (loc !== 'fossils' || !shown()) return;
    const sc = await import('./ch2scene');
    try { sc.build(f, r); } catch (e) { console.warn('[arc ch2] build', e); }
  }));
}

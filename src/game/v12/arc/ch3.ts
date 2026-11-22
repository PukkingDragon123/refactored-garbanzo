// V12 Te Ara Matatū, chapter 3: Te Pō Kānapanapa, the Glow Forest at Night. The quest and its install; the
// scene (camp, the lantern gecko stalk, the hunter, the waystone) is ./ch3scene.ts, loaded in the valley.
//
// Flags (all arc:ch3:*) and the full story beats: see the header of ./ch3scene.ts.

import type { QuestDef } from '../../quests';
import { game } from '../../game';

const F = (k: string) => !!game.save.flags[k];
const active = (id: string) => game.save.quests?.[id] === 'active';

// ------------------------------------------------------------------ the quest
export const ARC_CH3: QuestDef = {
  id: 'arc_ch3', title: 'The Glow Forest at Night', giver: 'story', main: true,
  desc: 'The skull\'s eye glows the green of Te Ngahere Kānapanapa, the valley below the cleft. Aroha says what the old people followed there only comes out after dark.',
  steps: [
    { text: 'Go down into the glowing forest and make camp for the night', done: () => F('arc:ch3:camp'), hint: 'The valley below the cleft at the head of the Bone Cliffs. Camp by the big glowcap at its mouth.' },
    { text: 'Photograph the moving light without it seeing you', done: () => F('arc:ch3:unseen'), hint: 'Lamp off (L). Crouch, keep to cover, keep still. Catch it swinging its lantern, or licking the glowcaps.' },
    { text: 'Survive the hunter: hide until it gives up, or slip out of the valley', done: () => F('arc:ch3:survived'), hint: 'It hunts lights. Lamp OFF. Crouch in a bush or behind a glowing log. Never run while it can see you.' },
    { text: 'Follow the lights when they come back', done: () => F('arc:ch3:done') },
  ],
  reward: { rp: 180, text: 'A new species: the Mokotūrama' },
  next: 'arc_ch4',
};

const shown = () => active('arc_ch3') || F('arc:ch3:done');

let installed = false;
/** put the chapter's scene content into 'glowforest' whenever Mori walks in (once the chapter has begun) */
export function installCh3() {
  if (installed) return;
  installed = true;
  void import('../../v10/field10').then(m => m.onLocEnter(async (f, loc, r) => {
    if (loc !== 'glowforest' || !shown()) return;
    const sc = await import('./ch3scene');
    try { sc.build(f); } catch (e) { console.warn('[arc ch3] build', e); }
  }));
}

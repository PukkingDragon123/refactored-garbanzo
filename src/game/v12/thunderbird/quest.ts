// V12 The Thunderbird: Aroha's legendary hunt. The quest itself (registered in the quest system so the
// HUD's objective note and Mori's notebook track it), the gear and bait it needs (blueprints, items and
// their backpack art), and the camp scenes: the teaser in the morning, the legend of Te Pouākai by the
// fire, and the telling of it when Mori comes home.
//
// Flags (game.save.flags):
//   tb:legend             heard the legend at camp
//   tb:sign:feather       the shed primary in the Fernwood
//   tb:sign:talons        the gouged boulder at Thunder Falls
//   tb:sign:kill          the kill site in the Rocky Hills' tussock basin
//   tb:storm              the hunt began: the storm front came over the ridge
//   tb:photo              photographed it up close
//   tb:driven / tb:tagged it was driven off with the sling / a band was fitted to its leg
//   tb:report             told the camp
//
// It unlocks mid-game: Day 4 or later, once Aroha's Lesson is done (the slingshot is in Mori's hands).

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest, currentStepIndex } from '../../quests';
import type { QuestDef } from '../../quests';
import { count } from '../../inventory';
import { defineItem, ITEMS } from '../../items';
import { defineBlueprint, grantBlueprint, isActive } from '../../v11/blueprints';
import '../../v11/bpdata';
import { addCampEvent, dayNumber, addBond } from '../../v10/day';
import type { CampDay } from '../../v10/campday';
import { C10 } from '../../v10/campcrew';
import { groundY } from '../../../art/island4/layout';
import { cineBars } from '../../v11/cine';
import { registerItemArt } from '../../../art/v11/itemart';
import { hideCloakCanvas, baitCanvas } from '../../../art/v12/thunderbird';

const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };

export const TB_ID = 'thunderbird';
export const SIGNS = ['tb:sign:feather', 'tb:sign:talons', 'tb:sign:kill'] as const;
export const signsFound = () => SIGNS.filter(F).length;
export const hasCloak = () => game.save.tools.includes('hide_cloak');
export const hasKahu = () => isActive('sling_kahu');
export const baitN = () => count('tb_bait');
export const prepN = () => (hasCloak() ? 1 : 0) + (hasKahu() ? 1 : 0) + (baitN() > 0 ? 1 : 0);
export const tbActive = () => questStatus(TB_ID) === 'active';
/** the quest's current step (0 legend, 1 signs, 2 prepare, 3 hunt, 4 photo, 5 drive off / tag, 6 report); -1 not active */
export function tbStep(): number {
  if (!tbActive()) return -1;
  return currentStepIndex(TB_QUEST);
}
export const tbDone = () => F('tb:driven') || F('tb:tagged');

// ---------------------------------------------------------------- the quest
export const TB_QUEST: QuestDef = {
  id: TB_ID, title: 'The Thunderbird', giver: 'aroha', main: true,
  desc: 'Aroha’s koro tells of Te Pouākai: a bird with wings so wide its shadow put out cooking fires, that rode the front of every storm over the tops. Aroha thinks the last one still hunts the Rocky Hills. Find it, photograph it, and let it go.',
  steps: [
    { text: 'Hear Aroha’s story by the fire after dinner', done: () => F('tb:legend'), hint: 'Aroha tells it in the evening, round the fire.' },
    { text: 'Find its signs: a shed feather, talon marks, a kill', done: () => signsFound() >= 3, progress: () => [signsFound(), 3], hint: 'A feather in the Fernwood, gouges on a boulder at Thunder Falls, a kill in the Rocky Hills’ tussock basin.' },
    { text: 'Get ready: the hide cloak, the kahu band on your slingshot, a bait bundle', done: () => prepN() >= 3 || F('tb:storm'), progress: () => [prepN(), 3], hint: 'Aroha’s sheets are in your blueprints: make them at Jenna’s bench.' },
    { text: 'Hunt with Aroha: up to the ridge top in the Rocky Hills', done: () => F('tb:storm'), hint: 'The storm comes over the ridge in the afternoon. Aroha follows; tell her to wait if you want to go alone.' },
    { text: 'Photograph the Pouākai up close', done: () => F('tb:photo'), hint: 'It only comes close when it strikes, or lands on the bait. Hide in the blind, wait under its shadow.' },
    { text: 'Drive it off with the sling, or snare it and tag its leg. Don’t kill it.', done: tbDone, hint: 'Hit it while it’s down: after a dive, or on the bait.' },
    { text: 'Tell the camp', done: () => F('tb:report') },
  ],
  reward: { rp: 150, text: 'The first photograph of Te Pouākai. Aroha says her koro will want a copy for the wharenui.' },
};

let registered = false;
export function registerThunderbird() {
  if (registered) return;
  registered = true;
  if (!QUEST_BY_ID[TB_ID]) { QUESTS.push(TB_QUEST); QUEST_BY_ID[TB_ID] = TB_QUEST; }
  // the gear and the bait
  if (!ITEMS.hide_cloak) defineItem({ id: 'hide_cloak', name: 'Hide cloak', kind: 'tool', stack: 1, weight: 0.8, where: 'Craft it (Aroha’s blueprint)',
    desc: 'A cape of flax weave thatched with tussock and dull feathers. Crouch in it and you are a clump of grass: animals lose track of you, even ones that were coming for you.' });
  if (!ITEMS.tb_bait) defineItem({ id: 'tb_bait', name: 'Storm bait', kind: 'lure', stack: 4, weight: 0.4, where: 'Craft it (Aroha’s blueprint)',
    desc: 'A smoked eel wrapped tight in flax with a feather tied on to flutter. Laid out (F, in the field) it draws hunters from a long way off. And from the sky.' });
  registerItemArt('hide_cloak', hideCloakCanvas, { w: 2, h: 2 });
  registerItemArt('tb_bait', baitCanvas, { w: 2, h: 1 });
  defineBlueprint({ id: 'hide_cloak', name: 'Hide cloak', kind: 'equipment', by: 'aroha', source: 'quest:aroha', hint: 'The Thunderbird',
    desc: 'Aroha’s hunting cloak: harakeke woven loose and thatched with tussock, a few dull feathers. Under it, crouched and still, you are part of the hillside.',
    effect: 'Crouch to hide anywhere: animals see you far less, and lose track of you mid-charge',
    needs: [['flaxleaf', 4], ['rope', 1], ['feather', 1]], out: ['hide_cloak', 1],
    notes: ['thatch it downward, like rain runs', 'no shiny buttons', 'stay STILL. the cloak can’t do that part'],
    line: 'You look like a haystack. A very sneaky haystack.' });
  defineBlueprint({ id: 'sling_kahu', name: 'Kahu band', kind: 'weapon', by: 'aroha', source: 'quest:aroha', hint: 'The Thunderbird', req: ['slingshot'],
    desc: 'A doubled band of inner tube, tapered and lashed with leather. Named for the harrier: it hits harder and further, and a solid hit stuns.',
    effect: 'Slingshot shots hit 35% harder and draw faster: a clean hit stuns',
    needs: [['rubber_band', 2], ['leather_scrap', 1]],
    notes: ['taper it: thick at the fork', 'pull to the jaw', 'never at birds. except THIS one, and only to send it home'],
    line: 'Two bands. Twice the snap. Please don’t test it on me.' });
  defineBlueprint({ id: 'tb_bait', name: 'Storm bait', kind: 'recipe', by: 'aroha', source: 'quest:aroha', hint: 'The Thunderbird', repeat: true,
    desc: 'Smoked fish wrapped in flax, a feather tied to it so it flutters like something hurt. Hunters in the sky see the flutter long before they smell it.',
    effect: 'Makes a storm bait: lay it out to draw hunters (and the Pouākai) to it',
    needs: [['fishbait', 1], ['flaxleaf', 1], ['feather', 1]], out: ['tb_bait', 1],
    notes: ['tie the feather loose', 'lay it in the open, hide downwind'] });
}
registerThunderbird();

// ---------------------------------------------------------------- the camp scenes
const campOf = (ctx: { camp: unknown }) => ctx.camp as CampDay;
const ready = () => dayNumber() >= 4 && F('aroha:blueprint');

// morning: Aroha has found something on the beach
addCampEvent({
  id: 'tbTeaser', slot: 'morning', prio: 7,
  when: () => ready() && questStatus(TB_ID) === 'hidden',
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s, p = cd.p, ar = s.aroha;
    await st.cut(async () => {
      cd.hold('aroha');
      st.place(ar, p.x + 56, -1, 'armsCrossed');
      p.facing = 1;
      await st.say([
        { who: 'aroha', text: 'Did you hear it last night? Thunder up in the hills. With no storm under it.', expr: 'serious' },
        { who: 'mori', text: 'I thought that was Joshu’s stomach.', expr: 'happy' },
        { who: 'aroha', text: '(she doesn’t smile) Tonight, after dinner. There’s a story you need to hear before you go up on the tops.', expr: 'serious', style: 'whisper' },
      ]);
      startQuest(TB_ID);
      cd.release('aroha');
    });
  },
});

// after dinner: the legend of Te Pouākai
addCampEvent({
  id: 'tbLegend', slot: 'dinner', prio: 8,
  when: () => tbActive() && !F('tb:legend'),
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s;
    await st.cut(async () => {
      cd.seatAll();
      s.hud?.show(false);
      cd.frame(C10.fire + 10, groundY(C10.fire) - 34, 1.9);
      cineBars(true);
      await st.say([
        { who: 'aroha', text: 'My koro tells it like this.', expr: 'serious', style: 'whisper' },
        { who: 'aroha', text: 'Long ago a bird lived up on the tops. Te Pouākai. Wings so wide its shadow put out the cooking fires.', expr: 'serious' },
        { who: 'aroha', text: 'It rode the front of every storm. When the sky went black over the ridge, people stayed under the trees. Because that’s when it hunted.', expr: 'serious' },
        { who: 'jenna', text: 'Like... a really big eagle?', expr: 'nervous' },
        { who: 'aroha', text: 'Like a big eagle the way the sea is like a big puddle.', expr: 'teasing' },
        { who: 'joshu', text: '(he moves his log a little closer to the fire)', expr: 'scared' },
        { who: 'aroha', text: 'The old people didn’t beat it with spears. They beat it with patience. A hide, a bait, and the nerve to wait under its shadow.', expr: 'serious' },
        { who: 'mori', text: 'Aroha. If something like that is still up there...', expr: 'thinking' },
        { who: 'aroha', text: 'Then it’s the last one. And nobody has ever seen it close and drawn it.', expr: 'serious' },
        { who: 'mori', text: '...I could photograph it.', expr: 'excited' },
        { who: 'aroha', text: '(the smile) I knew you’d say that. So: first you learn its signs. Its feathers. Its talon marks. Where it eats.', expr: 'happy' },
        { who: 'aroha', text: 'Then we get you ready. A hide cloak, a harder band on that sling, bait it can see from the clouds. Then we go up. Together.', expr: 'determined' },
        { who: 'aroha', text: 'And Mori. We don’t kill it. We look it in the eye, and we let it go.', expr: 'serious', style: 'whisper' },
      ]);
      const got = ['hide_cloak', 'sling_kahu', 'tb_bait'].filter(id => grantBlueprint(id, 'quest:aroha'));
      setF('tb:legend');
      addBond('aroha', 8);
      if (got.length) game.ui.toast('New blueprints: <b>Hide cloak</b>, <b>Kahu band</b>, <b>Storm bait</b>', 'BLUEPRINT', 'teal', 5200);
      cineBars(false);
      s.hud?.show(true);
      cd.release();
    });
  },
});

// home again: tell the camp
addCampEvent({
  id: 'tbReport', slot: 'dinner', prio: 9,
  when: () => tbActive() && tbDone() && !F('tb:report'),
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s;
    const tagged = F('tb:tagged');
    await st.cut(async () => {
      cd.seatAll();
      s.hud?.show(false);
      cd.frame(C10.fire + 10, groundY(C10.fire) - 34, 1.9);
      cineBars(true);
      await st.say([
        { who: 'jenna', text: 'Well?! Did you see it?', expr: 'excited' },
        { who: 'mori', text: 'Jenna. Its wings went from here... to the tent. It screamed and the rain went sideways.', expr: 'excited', style: 'shout' },
        tagged
          ? { who: 'aroha', text: 'He snared it. Walked right up to it in the storm and put a band on its leg. Then we let it go.', expr: 'proud' }
          : { who: 'aroha', text: 'He stood his ground. Three good shots while it was down, and it went home over the ridge. Nobody hurt.', expr: 'proud' },
        { who: 'joshu', text: 'And the photo? Tell me there’s a photo.', expr: 'excited' },
        { who: 'mori', text: '(he turns the camera round) ...There’s a photo.', expr: 'happy' },
        { who: 'aroha', text: 'My koro will want a copy. For the wharenui. Next to the old carvings of it.', expr: 'happy', style: 'whisper' },
      ]);
      setF('tb:report');
      addBond('aroha', 12);
      cineBars(false);
      s.hud?.show(true);
      cd.release();
    });
  },
});

// a reload into an old save mid-quest keeps its place in the story
void C10;

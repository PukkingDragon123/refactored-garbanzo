// V12 The Claw and the Plume: the quest. Aroha's koro tells of Matikuku Nui, the great claw, and the
// feathered boa it has fought since before anyone remembers; Mori goes into the backcountry to find
// them, photograph them, and see the feud for himself; then he tells Koro Wiremu what he saw, and Koro
// knows what it means: the Bearer has been losing its kills, and a hungry Matikuku Nui comes down to
// the valleys (feud:raidSoon starts the village fight).
//
// Flags (game.save.flags):
//   feud:heard            heard of Matikuku Nui (Aroha by the fire after dinner, or the first claw-scored trunk)
//   feud:sign:trunk       a trunk scored by the great claw        } markSign('trunk' | 'plume' | 'bones'):
//   feud:sign:plume       a shed plume from the boa's ruff        } the backcountry's props call it when
//   feud:sign:bones       a bone pile at an old kill              } Mori looks at them
//   feud:photo:constrict  photographed the boa constricting (./director.ts)
//   feud:photo:bearer     photographed the Bearer
//   feud:witness          watched a fight between them
//   feud:photo:fight      photographed them fighting, both in the frame
//   feud:report           told Koro Wiremu in Te Kāinga
//   feud:raidSoon         ...and he says the Bearer will come down to the village (the boss fight)

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest, currentStepIndex } from '../../quests';
import type { QuestDef } from '../../quests';
import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import { addCampEvent, dayNumber, addBond } from '../../v10/day';
import type { CampDay } from '../../v10/campday';
import { C10 } from '../../v10/campcrew';
import { groundY } from '../../../art/island4/layout';
import { cineBars } from '../../v11/cine';
import { audio } from '../../../core/audio';
import { floatText, floatNotice } from '../../../ui/v12/float';
import './species';

const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };

export const FEUD_ID = 'feud';
export type SignId = 'trunk' | 'plume' | 'bones';
export const FEUD_SIGNS: Record<SignId, string> = { trunk: 'feud:sign:trunk', plume: 'feud:sign:plume', bones: 'feud:sign:bones' };
export const feudSignsFound = () => (Object.values(FEUD_SIGNS) as string[]).filter(F).length;
export const feudActive = () => questStatus(FEUD_ID) === 'active';
/** the quest's current step (0 hear, 1 signs, 2 the boa constricting, 3 the Bearer, 4 the fight, 5 Koro); -1 not active */
export function feudStep(): number { return feudActive() ? currentStepIndex(FEUD_QUEST) : -1; }

export const FEUD_QUEST: QuestDef = {
  id: FEUD_ID, title: 'The Claw and the Plume', giver: 'aroha', main: false,
  desc: 'Matikuku Nui, the great claw: a shaggy giant with one claw as long as a man, that hunts the big boas of the backcountry. And Huruhuru, the feathered boa, that steals back what the claw steals from it. Koro Wiremu says they have fought since before anyone remembers. Find them, and see it for yourself.',
  steps: [
    { text: 'Hear of Matikuku Nui, the great claw', done: () => F('feud:heard'), hint: 'Aroha knows the story. Or the backcountry will tell you itself.' },
    { text: 'Find its signs in the backcountry: a claw-scored trunk, a shed plume, a pile of bones', done: () => feudSignsFound() >= 3, progress: () => [feudSignsFound(), 3], hint: 'Te Tuawhenua, past the village. Look at the trees, the ground, the old kills.' },
    { text: 'Photograph the feathered boa constricting its prey', done: () => F('feud:photo:constrict'), hint: 'It waits where the grazers feed. Be patient, and keep your distance.' },
    { text: 'Photograph Matikuku Nui, the Bearer', done: () => F('feud:photo:bearer'), hint: 'It follows its nose to a fresh kill. Don’t get between it and its dinner.' },
    { text: 'Witness the feud: photograph the claw and the plume fighting', done: () => F('feud:witness') && F('feud:photo:fight'), hint: 'When the Bearer comes for the boa’s kill, they fight. Both of them in one frame.' },
    { text: 'Tell Koro Wiremu in Te Kāinga what you saw', done: () => F('feud:report'), hint: 'He sits in front of the wharenui.' },
  ],
  reward: { rp: 160, text: 'The first photographs of Matikuku Nui and Huruhuru together. Koro wants one for the wharenui.' },
};

/**
 * Mori looks at one of the feud's signs (the backcountry's props call this): flags it, starts the
 * quest if it hasn't started (a claw-scored trunk counts as hearing of the Bearer), and says how many
 * of the three he has. Returns true if it was new.
 */
export function markSign(id: SignId): boolean {
  const k = FEUD_SIGNS[id];
  if (!k || F(k)) return false;
  registerFeud();
  game.save.flags[k] = true;
  if (id === 'trunk') game.save.flags['feud:heard'] = true;
  if (questStatus(FEUD_ID) === 'hidden') startQuest(FEUD_ID);
  game.persist();
  audio.play('discover', { vol: 0.35, pitch: 0.85 });
  const n = feudSignsFound();
  setTimeout(() => floatNotice(n >= 3 ? 'All three signs. It’s out here. Both of them are.' : `${n} of 3 signs of the feud.`, 2600, { tag: 'SIGN' }), 1200);
  return true;
}

let registered = false;
export function registerFeud() {
  if (registered) return;
  registered = true;
  if (!QUEST_BY_ID[FEUD_ID]) { QUESTS.push(FEUD_QUEST); QUEST_BY_ID[FEUD_ID] = FEUD_QUEST; }
  // home from the backcountry: Koro hears it (any visit to the village once the feud has been seen)
  void import('../../v10/field10').then(({ onLocEnter }) => onLocEnter((f, loc) => { if (loc === 'village') placeKoroReport(f); }));
}

// ---------------------------------------------------------------- the camp: Aroha tells of Matikuku Nui
const campOf = (ctx: { camp: unknown }) => ctx.camp as CampDay;
addCampEvent({
  id: 'feudRumour', slot: 'dinner', prio: 6,
  when: () => dayNumber() >= 3 && !F('feud:heard') && questStatus(FEUD_ID) === 'hidden' && !!game.save.flags['aroha:met'],
  run: async ctx => {
    const cd = campOf(ctx), st = cd.st, s = cd.s;
    registerFeud();
    await st.cut(async () => {
      cd.seatAll();
      s.hud?.show(false);
      cd.frame(C10.fire + 10, groundY(C10.fire) - 34, 1.9);
      cineBars(true);
      await st.say([
        { who: 'joshu', text: 'Aroha. What’s the biggest thing on this island? Honestly.', expr: 'curious' },
        { who: 'aroha', text: 'Honestly? Koro says there are two. And they hate each other.', expr: 'serious' },
        { who: 'aroha', text: 'Matikuku Nui. The great claw. Shaggy, bigger than a truck, and on one hand a single claw as long as you are tall.', expr: 'serious' },
        { who: 'aroha', text: 'It eats snakes. Big ones. It pins the head and hooks the claw in, right behind the skull.', expr: 'serious', style: 'whisper' },
        { who: 'jenna', text: 'And the other one?', expr: 'nervous' },
        { who: 'aroha', text: 'Huruhuru. A boa as long as the boat, wearing feathers. It kills the big grazers. Then Matikuku Nui smells it, comes, and takes the kill.', expr: 'serious' },
        { who: 'aroha', text: 'So the boa steals it back. Digs up the claw’s caches while it sleeps. Up and down the backcountry, forever.', expr: 'teasing' },
        { who: 'mori', text: '...Has anyone ever photographed them? Together?', expr: 'excited' },
        { who: 'aroha', text: '(she sighs) I knew you would ask that. Look for the claw marks on the trees first. And Mori. Stay well back.', expr: 'serious' },
      ]);
      setF('feud:heard');
      startQuest(FEUD_ID);
      addBond('aroha', 4);
      cineBars(false);
      s.hud?.show(true);
      cd.release();
    });
  },
});

// ---------------------------------------------------------------- the village: tell Koro Wiremu
function placeKoroReport(f: FieldScene) {
  const koro = () => f.actors.get('koro') ?? null;
  const ready = () => feudStep() === 5 && !F('feud:report');
  let busy = false;
  const it: Interactable = {
    // (a hair nearer Mori than Koro's own "Talk to" prompt, so this wins while it's the quest's step)
    get x() { const k = koro(); return k ? k.x + Math.sign(f.player.x - k.x) * 2 : -9999; }, get y() { return koro()?.y ?? 0; }, w: 16, h: 22,
    label: 'Tell Koro Wiremu about Matikuku Nui',
    get standX() { const a = koro(); return a ? a.x - 22 * (a.facing ?? 1) : 0; },
    enabled: () => ready() && !!koro()?.visible && !busy,
    quest: () => ready(),
    action: async () => {
      const a = koro();
      if (!a || busy || f.cutscene) return;
      busy = true;
      f.cutscene = true;
      try {
        a.faceTo(f.player.x);
        const { say } = await import('../../v11/village/ctx');
        await say(f, [
          { who: 'mori', text: 'Koro. I saw them. Matikuku Nui and the feathered boa. They fought over a kill, right in front of me.', expr: 'excited' },
          { who: 'koro', text: 'Did they. And who kept the meat?', expr: 'serious' },
          { who: 'mori', text: 'It... went both ways. The boa took back what the claw cached, and the claw was hungry. Thin, even, under all that fur.', expr: 'thinking' },
          { who: 'koro', text: '(he is quiet a long time) When I was a boy the snakes had a good year, and the claw had a bad one.', expr: 'serious' },
          { who: 'koro', text: 'A hungry Matikuku Nui does not stay in the backcountry. It follows its nose down the river. To us. To the pigs, the goats, the smoke from the hāngī.', expr: 'serious', style: 'whisper' },
          { who: 'koro', text: 'It is coming, e tama. Soon. Tell your friends. We will need the fences mended, and every one of you.', expr: 'serious' },
        ]);
        setF('feud:report');
        setF('feud:raidSoon');
        void floatText({ text: 'Matikuku Nui is coming down to the village...', style: 'notice', ms: 3200 });
      } catch (e) { console.error(e); }
      finally { f.cutscene = false; busy = false; f.hud?.refresh(); }
    },
  };
  f.interact.push(it);
}

void C10;

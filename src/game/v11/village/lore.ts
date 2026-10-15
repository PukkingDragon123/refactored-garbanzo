// V11 Te Kāinga lore and quests.
//
// HINERUA, the serpent taniwha of this island's own lore (a fictional guardian in the tradition of
// taniwha as kaitiaki, guardian beings, not a real iwi's story). When the first people came up the
// river from their waka, hungry, she could have eaten them; instead she pushed her body through the
// hills so the river would run past their terrace with fish and clean water. The river's bends are
// her coils. Tired from the work, she lay down in the heart of the land to sleep: her resting place is
// Te Korokoro, the Throat, and the warm wind breathing out of it is her breath. When the island's
// serpents moult, so does she, and the river carries pieces of skin down to the reeds by the landing:
// her gift. The village makes the hue kiri from it, and sings to her so she sleeps well. Once a year,
// at the moulting, they hold Te Pō o Hinerua: a night of food, music and the serpent dance.
// Nobody goes into her house without asking. That is what Koro's blessing is for.
//
// Quests (side quests the HUD tracks; giver Aroha, it is her family):
//   The Guardian of the River   ask Koro about the pou at the landing; hear the story by the fire at
//                               night; find a shed skin in the reeds; make the offering at the pou with
//                               Koro when the sun is low; his blessing at the gateway (v10:koroBlessing,
//                               which opens the old track to the pā and so the way down to Te Korokoro)
//   The Hue Kiri                listen to Aunty Ngaio play; bring her a shed skin, she makes you your
//                               own; learn the first song (the rhythm lessons: src/ui/v11/rhythm.ts)
//   Te Pō o Hinerua             help Nanny Huia with the hāngī (firewood, kai), practise the serpent
//                               dance with Ngaio and the kids, then come back after dark: the festival

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../../quests';
import type { QuestDef } from '../../quests';
import { count } from '../../inventory';
import { defineBlueprint, BLUEPRINTS } from '../blueprints';

export const TANIWHA = 'Hinerua';
export const FESTIVAL = 'Te Pō o Hinerua';

export const vf = (k: string) => !!game.save.flags['v11v:' + k];
export const setVf = (k: string, v = true) => { game.save.flags['v11v:' + k] = v; game.persist(); };
export const vv = (k: string) => game.save.vars['v11v:' + k] ?? 0;
export const setVv = (k: string, n: number) => { game.save.vars['v11v:' + k] = n; game.persist(); };
export const blessed = () => !!game.save.flags['v10:koroBlessing'];

// ------------------------------------------------------------------ blueprints the village gives
if (!BLUEPRINTS.hangi_oven) defineBlueprint({ id: 'hangi_oven', name: 'Hāngī pit', kind: 'camp', desc: 'Nanny Huia’s earth oven: a pit, river stones heated in a fire, wet sacks and earth over the food. Cooks a feast for everyone at camp while you are out.', source: 'quest:huia' });
if (!BLUEPRINTS.hinaki) defineBlueprint({ id: 'hinaki', name: 'Hīnaki eel trap', kind: 'survival', desc: 'Rāwiri’s woven eel trap: a funnel of split vine the eels swim into and can’t find their way out of. Set it in a stream overnight.', source: 'quest:rawiri' });
if (!BLUEPRINTS.huekiri) defineBlueprint({ id: 'huekiri', name: 'Hue kiri', kind: 'tool', desc: 'How Aunty Ngaio builds a hue kiri: a dried gourd, a carved neck, a shed serpent skin soaked and stretched over the face, two strings of muka.', source: 'quest:ngaio' });

// ------------------------------------------------------------------ the quests
const step = (text: string, k: string, hint?: string) => ({ text, done: () => vf(k), hint });
export const VILLAGE_QUESTS: QuestDef[] = [
  {
    id: 'v11_hinerua', title: 'The Guardian of the River', giver: 'aroha', main: false,
    desc: 'A carved post stands at the canoe landing: a serpent coiling up it, looking out over the river. The same serpent coils round the hole in the earth on the old pā’s great carving. Koro Wiremu knows her story.',
    steps: [
      step('Ask Koro Wiremu about the serpent pou at the landing', 'askPou', 'Koro sits in front of the wharenui.'),
      step('Hear Koro’s story by the fire, after dark', 'story', 'Sit by the hāngī fire and rest until dark. The whole village gathers at the fire at night.'),
      { text: 'Find a shed serpent skin in the reeds by the landing', done: () => vf('skinFound'), hint: 'The river leaves the moults in the reeds below the pou, at the west end of the village.' },
      step('Make the offering at Hinerua’s pou with Koro, when the sun is low', 'offering', 'Koro makes the offering at dusk, dawn or after dark. Rest by the fire until evening.'),
      { text: 'Receive Koro’s blessing at the gateway', done: () => !!game.save.flags['v10:koroBlessing'], hint: 'Talk to Koro: he will walk you to the waharoa.' },
    ],
    reward: { rp: 30, items: [['vil_hangi', 1]], text: 'Koro’s blessing: the old track up to the pā is open to you.' },
  },
  {
    id: 'v11_huekiri', title: 'The Hue Kiri', giver: 'aroha', main: false,
    desc: 'Aunty Ngaio plays an instrument nobody outside this island has ever heard: a gourd with a shed serpent skin stretched over its face. She has offered to teach you, if you bring her a skin.',
    steps: [
      step('Listen to Aunty Ngaio play', 'heardNgaio', 'Ngaio sits on the bench by the houses at the east end, playing.'),
      { text: 'Bring Ngaio a shed serpent skin', done: () => vf('kiriGiven'), progress: () => [Math.min(1, count('vil_kiri') + (vf('kiriGiven') ? 1 : 0)), 1], hint: 'The river leaves them in the reeds by the landing, below Hinerua’s pou.' },
      step('Learn “Te Awa” on your hue kiri', 'song:awa', 'Talk to Ngaio for a lesson.'),
    ],
    reward: { rp: 20, text: 'Your own hue kiri. More songs as you learn them.' },
  },
  {
    id: 'v11_festival', title: 'Te Pō o Hinerua', giver: 'aroha', main: false,
    desc: 'The serpents are moulting: it is time for the village’s night for Hinerua. Food from the hāngī, music, and the serpent dance. Help the village get ready, and learn the steps.',
    steps: [
      step('Split firewood for Nanny Huia’s hāngī', 'prep:wood', 'The woodpile by the hāngī, in the middle of the village.'),
      { text: 'Bring two fish or eels for the feast', done: () => vf('prep:kai'), progress: () => [Math.min(2, count('v10_fish') + count('vil_tuna') + (vf('prep:kai') ? 2 : 0)), 2], hint: 'Rāwiri’s eel trap at the landing, or your own catch. Give them to Nanny Huia.' },
      step('Practise the serpent dance with Aunty Ngaio', 'prep:dance', 'Ngaio and the kids practise on the marae in front of the wharenui.'),
      step('Come back after dark for the festival', 'festival', 'Rest by the fire until dark.'),
    ],
    reward: { rp: 40, text: 'A night nobody in the village will let you forget.' },
  },
];

let registered = false;
export function registerVillageQuests() {
  if (registered) return;
  registered = true;
  for (const q of VILLAGE_QUESTS) if (!QUEST_BY_ID[q.id]) { QUESTS.push(q); QUEST_BY_ID[q.id] = q; }
}
export function startVillageQuest(id: string, quiet = false) {
  registerVillageQuests();
  if (questStatus(id) === 'hidden') startQuest(id, quiet);
}

// ------------------------------------------------------------------ Koro's story, in beats
/** the story of Hinerua as Koro tells it by the fire (each beat: his line, and what the fire shows) */
export const STORY: { text: string; show: 'river' | 'waka' | 'coil' | 'sleep' | 'skin' | 'ask' }[] = [
  { text: 'Long ago, when our tūpuna came to this shore, they were tired and hungry. Their waka had been at sea a very long time.', show: 'waka' },
  { text: 'In the hills above lived Hinerua. A serpent as long as the river is now, scales green as pounamu, eyes like the inside of a pāua shell.', show: 'coil' },
  { text: 'She watched them come up the beach, thin as sticks. She could have eaten them all in one mouthful. Many would have.', show: 'coil' },
  { text: 'Instead she pushed her great body down through the hills, all night, so that the river would run past this terrace, full of fish and clean water.', show: 'river' },
  { text: 'Every bend in our river is one of her coils. When you swim in it, you swim in the shape of her.', show: 'river' },
  { text: 'The work made her so tired that she lay down in the middle of the land to sleep. That place is Te Korokoro. The warm wind that breathes out of it is her breath.', show: 'sleep' },
  { text: 'When the serpents shed their skins, so does she. The river brings pieces of it down to the reeds by our landing. Her gift. We make the hue kiri from it, and sing to her so she sleeps well.', show: 'skin' },
  { text: 'So. We do not go into her house without asking. Not because she is cruel. Because it is her house.', show: 'ask' },
];

// ------------------------------------------------------------------ ambient talk between villagers
/** pairs of villagers chatting when they are near each other (each line through the translator) */
export const CHATTER: { a: string; b: string; lines: [string, string][] }[] = [
  { a: 'mere', b: 'huia', lines: [['Is the hāngī down yet, Nanny?', 'Since dawn. Don’t you dare lift it early.'], ['Your moko ate the last of the rēwena.', 'Which one? I have eleven.']] },
  { a: 'hemi', b: 'rawiri', lines: [['The hull’s nearly hollow, boy. Two more days.', 'You said that last week, Dad.'], ['Hold the adze like it owes you money.', 'Like what?']] },
  { a: 'pipi', b: 'ani', lines: [['I’m the taniwha and you’re the waka!', 'No, I was the taniwha last time!'], ['Bet you can’t catch the rooster.', 'Bet I can.']] },
  { a: 'tamati', b: 'mere', lines: [['The kūmara are fat this year.', 'Because I told you where to plant them.'], ['Tipene left the pig gate open again.', 'He gets that from you.']] },
  { a: 'ngaio', b: 'ani', lines: [['Shoulders loose. The serpent doesn’t have shoulders.', 'Then how does she dance?'], ['Again, from the start. Slow like the river.', 'Slow like the river...']] },
  { a: 'koro', b: 'huia', lines: [['The skins are coming down the river, sister.', 'Then it’s nearly her night.'], ['Did you see the scientist eat three bowls?', 'He has a good appetite. That’s something.']] },
  { a: 'tipene', b: 'mikaere', lines: [['Don’t chase the goats.', 'I’m not chasing them, I’m racing them.'], ['Feed the hens or no fried bread.', 'Fine. FINE.']] },
];

/** what the kids shout while they run about */
export const KID_BARKS = ['Tag! You’re it!', 'Pīpī cheats!', 'Look, the rooster!', 'Bet you can’t catch me!', 'Taniwha coming! RUN!', 'Mikaere fell in the mud again!'];

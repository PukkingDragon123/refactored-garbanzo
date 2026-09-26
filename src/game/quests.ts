// Quests: the main story chain plus crew side quests. Steps are checked against the save each frame
// (cheap predicates); completing the last step pays the reward and starts any follow-up quest.

import { game } from './game';
import { add, count } from './inventory';
import { buildDone, buildLevel } from './crafting';
import { ITEMS } from './items';
import { SPECIES, SPECIES_BY_ID } from './species';

export type Giver = 'story' | 'rowan' | 'crowe' | 'aroha' | 'lou' | 'pip';

export interface QuestStep {
  text: string;
  done: () => boolean;
  /** optional progress readout, e.g. [2, 5] */
  progress?: () => [number, number];
  hint?: string;
}

export interface QuestDef {
  id: string;
  title: string;
  giver: Giver;
  main: boolean;
  desc: string;
  steps: QuestStep[];
  reward?: { rp?: number; items?: [string, number][]; flag?: string; text?: string };
  /** quest started automatically when this one completes */
  next?: string;
  /** chapter number the main quest represents */
  chapter?: number;
}

const f = (k: string) => () => !!game.save.flags[k];
const has = (id: string, n = 1) => () => count(id) >= n;
const prog = (id: string, n: number) => (): [number, number] => [Math.min(n, count(id)), n];
const seenN = () => Object.keys(game.save.seen).length;
const v = (k: string) => game.save.vars[k] ?? 0;
const cluesN = () => Object.keys(game.save.clues).length;

export const QUESTS: QuestDef[] = [
  // ============================================================ MAIN
  {
    id: 'voyage', title: 'The Voyage', giver: 'story', main: true, chapter: 0,
    desc: 'Three weeks out of Bluff aboard the Kittiwake, chasing reports of an uncharted current. Settle in and get to know the crew.',
    steps: [
      { text: 'Talk to Captain Crowe at the helm', done: f('talk:crowe') },
      { text: 'Check on Pip up at the bow', done: f('talk:pip') },
      { text: 'Have lunch on the aft deck with Lou', done: f('ate') },
      { text: 'Photograph the giant bird circling the boat', done: f('photo:monarch'), hint: 'Press Q (or hold right mouse) to raise the camera, left click to shoot.' },
      { text: 'Review the shot on your camera', done: f('reviewed:first') },
    ],
    next: 'storm',
  },
  {
    id: 'storm', title: 'Batten Down', giver: 'crowe', main: true, chapter: 0,
    desc: 'The glass is falling faster than Crowe has ever seen. Secure the deck before the storm hits.',
    steps: [
      { text: 'Secure the loose crates on deck', done: () => v('crates') >= 3, progress: () => [Math.min(3, v('crates')), 3] },
      { text: 'Get to the wheelhouse!', done: f('storm:done') },
    ],
    next: 'castaways',
  },
  {
    id: 'castaways', title: 'Castaways', giver: 'crowe', main: true, chapter: 1,
    desc: 'The Kittiwake is on the rocks and the radio is dead. Nobody is coming soon. Make camp before nightfall.',
    steps: [
      { text: 'Salvage the tent canvas and poles from the wreck', done: () => (count('canvas') >= 1 && count('poles') >= 4) || buildLevel('tent') >= 3 },
      { text: 'Find the hammer in the wreck', done: () => game.save.tools.includes('hammer') },
      { text: 'Build the workbench from wreck planks and scrap', done: () => buildDone('bench') || buildDone('tent') },
      { text: 'Make rope at the workbench (flax leaf → fibre → rope)', done: () => count('rope') >= 2 || buildDone('tent'), progress: () => [Math.min(2, count('rope')), 2], hint: 'Cut flax leaves with your knife, then strip and twist them at the workbench.' },
      { text: 'Build the tent', done: () => buildDone('tent') },
      { text: 'Gather firewood and stones, then build a campfire', done: () => buildDone('fire'), progress: () => [Math.min(5, count('wood')) + Math.min(6, count('stone')), 11] },
      { text: 'Collect a plant or mushroom sample at the jungle edge', done: f('sample:first') },
      { text: 'Analyse it on the laptop in your tent', done: () => v('analyses') >= 1 },
      { text: 'Get some sleep', done: f('slept:1') },
    ],
    next: 'noise',
  },
  {
    id: 'noise', title: 'Something in the Dark', giver: 'story', main: true, chapter: 1,
    desc: 'A noise in the bushes, in the middle of the night, on an island nobody has ever charted.',
    steps: [
      { text: 'Investigate the noise at the edge of the jungle', done: f('noise:found') },
      { text: 'Talk to the stranger', done: f('aroha:met') },
    ],
    next: 'contact',
  },
  {
    id: 'contact', title: 'First Contact', giver: 'aroha', main: true, chapter: 2,
    desc: 'Aroha knows this land better than anyone alive. She has offered to show you the Fernwood.',
    steps: [
      { text: 'Open Aroha’s map at camp and travel to the Fernwood Floor', done: f('visit:fernwood') },
      { text: 'Photograph and identify 3 different species', done: () => seenN() >= 3, progress: () => [Math.min(3, seenN()), 3], hint: 'Photos only count once you review them on the laptop and tag the animals.' },
      { text: 'Tell Crowe what you found', done: f('report:contact') },
    ],
    next: 'canopy',
  },
  {
    id: 'canopy', title: 'Up in the Trees', giver: 'aroha', main: true, chapter: 3,
    desc: 'Aroha says snakes fly between the treetops in the Emerald Canopy. Crowe says she’s pulling your leg.',
    steps: [
      { text: 'Photograph a Skyribbon Glider in the Emerald Canopy', done: () => !!game.save.seen.skyribbon },
      { text: 'Solve 3 facts in the Field Guide', done: () => Object.keys(game.save.facts).length >= 3, progress: () => [Math.min(3, Object.keys(game.save.facts).length), 3] },
      { text: 'Report back at camp', done: f('report:canopy') },
    ],
    next: 'falls',
  },
  {
    id: 'falls', title: 'Thunder Falls', giver: 'aroha', main: true, chapter: 4,
    desc: 'Cliff nesters, divers, and rocks that smell of snake. Aroha won’t say why she avoids the plunge pool.',
    steps: [
      { text: 'Explore Thunder Falls', done: f('visit:falls') },
      { text: 'Find out what shed the colossal skin', done: () => !!game.save.clues['giant-skin'] },
      { text: 'Show the crew', done: f('report:falls') },
    ],
    next: 'titan',
  },
  {
    id: 'titan', title: 'The Titan', giver: 'crowe', main: true, chapter: 5,
    desc: 'Whatever left that skin went south, into the Blackwater Mangroves. Stay low. Stay hidden.',
    steps: [
      { text: 'Photograph the owner of the skin in the Blackwater Mangroves', done: () => !!game.save.seen.titan },
      { text: 'Get back to camp alive', done: f('report:titan') },
    ],
    next: 'deep',
  },
  {
    id: 'deep', title: 'The Deep', giver: 'pip', main: true, chapter: 6,
    desc: 'The fin you saw in the storm was real. Pip has patched the Kittiwake’s old dive suit together. Mostly.',
    steps: [
      { text: 'Bring Pip scrap metal and rope to finish the dive gear', done: () => !!game.save.flags['divegear'], progress: () => [Math.min(4, count('scrap')) + Math.min(2, count('rope')), 6] },
      { text: 'Dive at the Serpent Coast and photograph the Finned Leviathan', done: () => !!game.save.seen.leviathan },
      { text: 'Tell the crew', done: f('report:deep') },
    ],
    next: 'guide',
  },
  {
    id: 'guide', title: 'The Field Guide', giver: 'rowan', main: true, chapter: 7,
    desc: 'Every species tells a story about the others. Finish the Zealandia Field Guide, and maybe Pip’s radio will reach someone who can read it.',
    steps: [
      { text: `Identify every species`, done: () => seenN() >= SPECIES.length, progress: () => [seenN(), SPECIES.length] },
      { text: 'Solve every fact in the Field Guide', done: () => Object.keys(game.save.facts).length >= SPECIES.reduce((a, s) => a + s.facts.length, 0), progress: () => [Object.keys(game.save.facts).length, SPECIES.reduce((a, s) => a + s.facts.length, 0)] },
    ],
  },

  // ============================================================ SIDE
  {
    id: 'pipe', title: 'The Captain’s Pipe', giver: 'crowe', main: false,
    desc: 'Crowe lost his pipe in the wreck. He says he doesn’t care. He mentions it every hour.',
    steps: [
      { text: 'Search the tide pools around the wreck', done: () => has('pipe')() || f('pipe:returned')() },
      { text: 'Return the pipe to Crowe', done: f('pipe:returned') },
    ],
    reward: { rp: 40, items: [['binoculars', 1]], text: 'Crowe gives you his old brass binoculars.' },
  },
  {
    id: 'kitchen', title: 'Island Kitchen', giver: 'lou', main: false,
    desc: 'Lou can’t cook with seawater and biscuits forever. Find some local ingredients.',
    steps: [
      { text: 'Bring Lou 3 moonfruit', done: () => has('moonfruit', 3)() || f('kitchen')(), progress: prog('moonfruit', 3) },
      { text: 'Bring Lou 2 kawakawa leaves', done: () => has('kawakawa', 2)() || f('kitchen')(), progress: prog('kawakawa', 2) },
      { text: 'Bring Lou a shelf bracket fungus', done: () => has('bracket', 1)() || f('kitchen')(), progress: prog('bracket', 1) },
      { text: 'Hand them over', done: f('kitchen') },
    ],
    reward: { rp: 30, items: [['stew', 2]], text: 'Lou can now cook stew and brew kawakawa tea at the campfire.' },
  },
  {
    id: 'radio', title: 'Radio Days', giver: 'pip', main: false,
    desc: 'The Kittiwake’s radio is soaked, but Pip swears she can build a mast from the wreck and reach the mainland.',
    steps: [
      { text: 'Gather 4 scrap metal and 2 rope, then raise the mast', done: () => buildLevel('radio') >= 1 },
      { text: 'Strip 3 copper wire from the wreck and find a battery, then wire the transmitter', done: () => buildDone('radio') },
      { text: 'Talk to Pip', done: f('radio:talked') },
    ],
    reward: { rp: 60, text: 'The radio crackles. Nobody answers yet, but Pip is thrilled.' },
  },
  {
    id: 'glow', title: 'Glow Getter', giver: 'pip', main: false,
    desc: 'Your phone torch won’t last. Pip wants glowcaps and a battery to build you a proper headlamp.',
    steps: [
      { text: 'Collect 3 glowcaps', done: () => has('glowcap', 3)() || f('glow:done')(), progress: prog('glowcap', 3), hint: 'Glowcaps grow on rotten logs. You need a trowel.' },
      { text: 'Bring them to Pip', done: f('glow:done') },
    ],
    reward: { rp: 30, items: [['headlamp', 1]], text: 'Received a headlamp: night expeditions unlocked.' },
  },
  {
    id: 'snares', title: 'Old Snare Lines', giver: 'aroha', main: false,
    desc: 'Aroha’s whānau used to run snare lines for pests. Some old snares are still out there, and animals leave hair and feathers on them.',
    steps: [
      { text: 'Check the old snares marked on the map', done: () => v('snares') >= 3, progress: () => [Math.min(3, v('snares')), 3] },
      { text: 'Tell Aroha what you found', done: f('snares:done') },
    ],
    reward: { rp: 50, text: 'Aroha teaches you a trick for walking quietly (Soft steps is cheaper to learn).', flag: 'aroha:lesson' },
  },
  {
    id: 'tracks', title: 'Reading the Land', giver: 'aroha', main: false,
    desc: 'Aroha: "You look at the animals. Look at what they leave behind."',
    steps: [
      { text: 'Find 4 animal signs (clues) for the Field Guide', done: () => cluesN() >= 4, progress: () => [Math.min(4, cluesN()), 4] },
      { text: 'Show Aroha', done: f('tracks:done') },
    ],
    reward: { rp: 60 },
  },
  {
    id: 'hawk', title: 'A Bird’s Eye', giver: 'crowe', main: false,
    desc: 'Crowe has watched gale hawks dive on snakes from the wheelhouse for weeks. He wants proof for his logbook.',
    steps: [
      { text: 'Photograph a Gale Hawk diving', done: () => !!game.save.evPhoto['galehawk:diving'] || !!game.save.evVideo['galehawk:diving'] },
      { text: 'Show Crowe', done: f('hawk:done') },
    ],
    reward: { rp: 50 },
  },
  {
    id: 'snacker', title: 'Midnight Snacker', giver: 'lou', main: false,
    desc: 'Something keeps stealing Lou’s moonfruit at night. Lou wants a photo of the culprit.',
    steps: [
      { text: 'Photograph a Quillhog eating', done: () => !!game.save.evPhoto['quillhog:eating'] || !!game.save.evVideo['quillhog:eating'] },
      { text: 'Show Lou', done: f('snacker:done') },
    ],
    reward: { rp: 40, items: [['tea', 2]] },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map(q => [q.id, q]));

export type QuestStatus = 'hidden' | 'active' | 'done';

export function questStatus(id: string): QuestStatus {
  return game.save.quests[id] ?? 'hidden';
}

export function startQuest(id: string, quiet = false) {
  const q = QUEST_BY_ID[id];
  if (!q || questStatus(id) !== 'hidden') return;
  game.save.quests[id] = 'active';
  if (q.main && q.chapter !== undefined) game.save.chapter = Math.max(game.save.chapter, q.chapter);
  if (!game.save.tracked || q.main) game.save.tracked = id;
  game.persist();
  if (!quiet) game.ui.toast(`${q.main ? 'New objective' : 'New quest'}: <b>${q.title}</b>`, q.main ? 'STORY' : 'QUEST', 'teal', 3600);
  onQuestEvent?.('start', q);
}

/** Index of the first unfinished step, or steps.length when all are done. */
export function currentStepIndex(q: QuestDef) {
  for (let i = 0; i < q.steps.length; i++) if (!q.steps[i].done()) return i;
  return q.steps.length;
}

export function currentStep(id: string): QuestStep | null {
  const q = QUEST_BY_ID[id];
  if (!q || questStatus(id) !== 'active') return null;
  return q.steps[currentStepIndex(q)] ?? null;
}

export function activeQuests(): QuestDef[] {
  return QUESTS.filter(q => questStatus(q.id) === 'active');
}

export function trackedQuest(): QuestDef | null {
  const t = game.save.tracked;
  if (t && questStatus(t) === 'active') return QUEST_BY_ID[t];
  return activeQuests().find(q => q.main) ?? activeQuests()[0] ?? null;
}

export function completeQuest(id: string) {
  const q = QUEST_BY_ID[id];
  if (!q || questStatus(id) !== 'active') return;
  const s = game.save;
  s.quests[id] = 'done';
  const r = q.reward;
  const bits: string[] = [];
  if (r?.rp) { s.rp += r.rp; s.totalRp += r.rp; bits.push(`+${r.rp} RP`); }
  if (r?.items) for (const [it, n] of r.items) { add(it, n); bits.push(`${ITEMS[it]?.name ?? it}${n > 1 ? ' ×' + n : ''}`); }
  if (r?.flag) s.flags[r.flag] = true;
  if (s.tracked === id) s.tracked = null;
  game.persist();
  game.ui.toast(`${q.main ? 'Chapter complete' : 'Quest complete'}: <b>${q.title}</b>${bits.length ? ' · ' + bits.join(', ') : ''}${r?.text ? '<br>' + r.text : ''}`, 'DONE', 'teal', 4600);
  onQuestEvent?.('done', q);
  if (q.next) startQuest(q.next);
}


/** Optional hook for scenes (e.g. play a jingle, trigger dialogue). */
export let onQuestEvent: ((kind: 'start' | 'done', q: QuestDef) => void) | null = null;
export function setQuestHook(h: typeof onQuestEvent) {
  onQuestEvent = h;
}

let checkT = 0;
/** Call every frame; checks active quests a few times per second and completes finished ones. */
export function updateQuests(dt: number) {
  checkT -= dt;
  if (checkT > 0) return;
  checkT = 0.25;
  for (const q of activeQuests()) if (currentStepIndex(q) >= q.steps.length) completeQuest(q.id);
}

/** Side quests an NPC can offer right now. */
export function offerable(giver: Giver): QuestDef[] {
  const s = game.save;
  const ch = s.chapter;
  const gates: Record<string, () => boolean> = {
    pipe: () => ch >= 1 && !!s.flags['aroha:met'],
    kitchen: () => ch >= 1 && buildDone('fire'),
    glow: () => ch >= 2,
    radio: () => ch >= 2 && buildDone('bench'),
    snares: () => ch >= 2 && !!s.flags['visit:fernwood'],
    tracks: () => ch >= 3,
    hawk: () => ch >= 3,
    snacker: () => ch >= 3,
  };
  return QUESTS.filter(q => !q.main && q.giver === giver && questStatus(q.id) === 'hidden' && (gates[q.id]?.() ?? true));
}

export function speciesName(id: string) {
  return SPECIES_BY_ID[id]?.name ?? id;
}

// V10 camp requests: small jobs the crew pin to the camp board ("sea glass for my lamp", "fish for the
// smoker", "find my whānau's village") and requests from the agency's field office that come in over
// the laptop radio ("photograph a nesting jewel hornet", "bring back a fossil", "survey a new region").
// They are ordinary side quests (the HUD tracks them, they complete on their own and pay out); a
// request that wants things handed over completes when you hand them in at the camp board.
//
// Also the day's to-do list ("Day N at camp"), a main quest that is reset every morning.

import { game } from '../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../quests';
import type { QuestDef, QuestStep, Giver } from '../quests';
import { count, remove } from '../inventory';
import { ITEMS } from '../items';
import { discoveries, location } from './regions';
import type { DiscoveryKind } from './regions';
import { dayState, dayNumber, addBond } from './day';
import type { Crew } from './day';

export type ReqGiver = Crew | 'agency';
export interface Req {
  id: string;
  giver: ReqGiver;
  title: string;
  desc: string;
  /** offered on the board / in conversation once this holds */
  unlock: () => boolean;
  /** what has to happen (besides handing things in) */
  steps: QuestStep[];
  /** handed in at the board when the steps are done */
  give?: [string, number][];
  reward: { rp?: number; items?: [string, number][]; bond?: number; text?: string };
  /** the giver asking (talk / board) and thanking */
  ask: string;
  thanks: string;
}

const F = (k: string) => !!game.save.flags[k];
const research = (sp: string) => game.save.research?.[sp] ?? null;
const docBeh = (sp: string, ...beh: string[]) => { const e = research(sp); return !!e && beh.some(b => e.beh.includes(b) || e.vid.includes(b)); };
const found = (kind: DiscoveryKind) => discoveries().some(d => d.kind === kind);
const v = (k: string) => game.save.vars[k] ?? 0;
const given = (id: string) => F(`v10:req:${id}:given`);
const have = (id: string, item: string, n: number): QuestStep => ({
  text: `Collect ${n} ${ITEMS[item]?.name ?? item}`, done: () => given(id) || count(item) >= n, progress: () => [Math.min(n, given(id) ? n : count(item)), n],
});

export const REQUESTS: Req[] = [
  // ------------------------------------------------------------ the crew
  {
    id: 'r_glass', giver: 'jenna', title: 'Sea Glass Lamp', unlock: () => dayNumber() >= 2,
    desc: 'Jenna wants tumbled sea glass for a lamp shade, so the camp lights stop looking like “a sad fish tank”.',
    steps: [have('r_glass', 'driftglass', 4)], give: [['driftglass', 4]], reward: { rp: 15, bond: 6, text: 'Jenna’s new lamp throws little green waves all over camp.' },
    ask: 'Mori. MORI. I need sea glass. Four bits. Frosty ones. I am making a lamp and it is going to be BEAUTIFUL.',
    thanks: 'Look at it! Little green waves on everything! I’m a genius and you’re my supplier.',
  },
  {
    id: 'r_firewood', giver: 'joshu', title: 'Wood for the Smoker', unlock: () => dayNumber() >= 2,
    desc: 'Joshu is building a smokehouse out of the Kittiwake’s fish hold door. It runs on dry driftwood.',
    steps: [have('r_firewood', 'wood', 6)], give: [['wood', 6]], reward: { rp: 10, bond: 6, items: [['ration', 2]], text: 'The smoker’s going. Joshu packs you ship biscuits for the road.' },
    ask: 'Smokehouse needs feeding, lad. Six good armfuls of driftwood, the bleached stuff above the tide line.',
    thanks: 'That’ll keep her smoking for days. Take a couple of biscuits for your pack.',
  },
  {
    id: 'r_tea', giver: 'aroha', title: 'Kawakawa', unlock: () => dayNumber() >= 2,
    desc: 'Aroha’s kawakawa tea keeps the camp’s bellies happy. She’s running low on leaves.',
    steps: [have('r_tea', 'kawakawa', 4)], give: [['kawakawa', 4]], reward: { bond: 8, items: [['tea', 2]], text: 'Two flasks of kawakawa tea for the trail.' },
    ask: 'Bring me kawakawa? The leaves with the most holes. The insects always know which ones are best.',
    thanks: 'Ka pai. Good ones, full of holes. Here, tea for your next walk.',
  },
  {
    id: 'r_fish', giver: 'joshu', title: 'Fish for the Smoker', unlock: () => dayNumber() >= 3,
    desc: 'The smokehouse is drawing nicely. Now it needs fish: catch three off the rocks at camp.',
    steps: [{ text: 'Catch 3 fish off the camp rocks', done: () => v('v10:campFish') - v('v10:r_fish:base') >= 3, progress: () => [Math.min(3, v('v10:campFish') - v('v10:r_fish:base')), 3], hint: 'The flat rock at the west end of camp. Rod’s wedged in the crack.' }],
    reward: { rp: 20, bond: 6, items: [['ration', 2]] },
    ask: 'Smoker’s hot and empty. Three fish off the rocks, lad. The big flat one by the wreck end of camp.',
    thanks: 'Ha! Smoked fish for a week. You fish like you were born on a boat.',
  },
  {
    id: 'r_sealroar', giver: 'jenna', title: 'The Sofa With Teeth', unlock: () => dayNumber() >= 3,
    desc: 'Jenna wants proof the Corvex seal really roars “like a foghorn in a cathedral”. Document it roaring.',
    steps: [{ text: 'Document the Corvex seal roaring', done: () => docBeh('corvexseal', 'roaring'), hint: 'Photograph it reared up and roaring, then upload the photo. From a safe distance.' }],
    reward: { rp: 25, bond: 6 },
    ask: 'I need a picture of the seal ROARING. For science. And for my lock screen.',
    thanks: 'LOOK AT ITS LITTLE THROAT BALLOON. Lock screen. Immediately.',
  },
  {
    id: 'r_waddler', giver: 'aroha', title: 'The Burrows', unlock: () => dayNumber() >= 3,
    desc: 'Aroha counts the duskwaddler burrows every season. Document one digging its burrow or calling from it.',
    steps: [{ text: 'Document a duskwaddler at its burrow', done: () => docBeh('duskwaddler', 'digging', 'calling'), hint: 'They waddle home up the dunes at dusk. Be still and be quiet.' }],
    reward: { rp: 30, bond: 8 },
    ask: 'The little dune birds that waddle home at dusk. Photograph one at its burrow? My koro and I count them every year.',
    thanks: 'Ka pai. I’ll mark that burrow on my map. Koro will want to see this.',
  },
  {
    id: 'r_village', giver: 'aroha', title: 'Find the Village', unlock: () => F('v10:ev:arohaFamily'),
    desc: 'Aroha’s whānau live inland, past the ranges. Nobody has heard from them since the storm. Find the village.',
    steps: [{ text: 'Find Aroha’s village', done: () => found('village'), hint: 'Somewhere inland, beyond the ranges. Check the region map for new places.' }],
    reward: { rp: 60, bond: 15 },
    ask: 'If you go inland... look for smoke. Gardens. Carvings. If you find my village, tell me. Please.',
    thanks: 'You found them. You found home. I... thank you, Mori. Thank you.',
  },
  {
    id: 'r_flax', giver: 'joshu', title: 'Rope Work', unlock: () => dayNumber() >= 4,
    desc: 'Joshu needs rope, a lot of it. Harakeke twists into the best rope there is.',
    steps: [have('r_flax', 'flaxleaf', 6)], give: [['flaxleaf', 6]], reward: { rp: 20, bond: 5 },
    ask: 'Six flax leaves, lad. Cut low on the outside, never the heart. Aroha’ll check.',
    thanks: 'Good long leaves. Cut clean, too. We’ll make a sailor of you yet.',
  },
  {
    id: 'r_feathers', giver: 'jenna', title: 'Antenna Feathers', unlock: () => dayNumber() >= 4 && F('v10:agency'),
    desc: 'Jenna swears three big feathers on the radio mast will “catch the signal better”. Nobody believes her.',
    steps: [have('r_feathers', 'feather', 3)], give: [['feather', 3]], reward: { rp: 15, bond: 6 },
    ask: 'Hypothesis: feathers on the antenna improve reception. Method: you bring me three feathers. Conclusion: I’m right.',
    thanks: 'Signal strength... exactly the same. But it LOOKS faster. Science!',
  },
  // ------------------------------------------------------------ the agency (over the laptop radio)
  {
    id: 'a_species3', giver: 'agency', title: 'Survey: Three New Species', unlock: () => F('v10:agency'),
    desc: 'The field office wants the island’s fauna on record. Document three species that aren’t in the research log yet.',
    steps: [{ text: 'Document 3 new species (upload sharp photos)', done: () => Object.keys(game.save.research).length - v('v10:a_species3:base') >= 3, progress: () => [Math.min(3, Object.keys(game.save.research).length - v('v10:a_species3:base')), 3] }],
    reward: { rp: 50 },
    ask: 'First survey request: three species we don’t have on file. Photograph them and upload. Clean shots, please.',
    thanks: 'Three new species logged and verified. The board here is very excited. Well done.',
  },
  {
    id: 'a_hornet', giver: 'agency', title: 'Survey: Nesting Hornets', unlock: () => F('v10:agency') && !!research('jewelhornet'),
    desc: 'Jewel hornets that nest underground under their food plant? The office wants that documented.',
    steps: [{ text: 'Document a jewel hornet at its nest', done: () => docBeh('jewelhornet', 'nesting'), hint: 'Look for holes at the foot of an ember bush. Do not stand in front of them for long.' }],
    reward: { rp: 60 },
    ask: 'Your hornet photos caused an argument in the lab. Ground-nesting? Prove it: one at the nest entrance, please.',
    thanks: 'A ground nest. Under the food plant. That settles the argument, and somebody here owes me a coffee.',
  },
  {
    id: 'a_fossil', giver: 'agency', title: 'Survey: A Fossil', unlock: () => F('v10:agency') && dayNumber() >= 3,
    desc: 'If Zealandia has been cut off for as long as the office thinks, the rocks will show it. Find a fossil.',
    steps: [{ text: 'Find a fossil', done: () => found('fossil') || game.save.inv.some(s => s.id.includes('fossil')), hint: 'Cliffs, stream cuts and caves: anywhere old rock is exposed.' }],
    reward: { rp: 80 },
    ask: 'Geology wants a fossil. Anything: a shell in a rock, a bone, a leaf print. Old rock, eroded faces.',
    thanks: 'A fossil! Geology just did a little dance on the video call. I have never seen geology dance.',
  },
  {
    id: 'a_region', giver: 'agency', title: 'Survey: New Ground', unlock: () => F('v10:agency') && dayNumber() >= 3,
    desc: 'The office’s maps of Zealandia are blank past the coast. Survey a place beyond the home island.',
    steps: [{ text: 'Discover a place beyond the home island', done: () => discoveries().some(d => d.kind === 'location' && (location(d.loc)?.region ?? 'home') !== 'home') }],
    reward: { rp: 50 },
    ask: 'Our satellite images are all cloud. Get somewhere new and tell us what is there.',
    thanks: 'New ground on the map. Our cartographer is naming a coffee mug after you.',
  },
  {
    id: 'a_video', giver: 'agency', title: 'Survey: On Video', unlock: () => F('v10:agency') && dayNumber() >= 4,
    desc: 'Still photos only tell half the story. Record any animal behaviour on video and upload it.',
    steps: [{ text: 'Upload a video of an animal behaviour', done: () => Object.values(game.save.research).some(e => e.vid.length > 0) }],
    reward: { rp: 40 },
    ask: 'Behaviour on video, please: still frames get argued about, footage does not.',
    thanks: 'Footage received. Played it four times in the meeting. Lovely work.',
  },
  {
    id: 'a_eco', giver: 'agency', title: 'Survey: An Ecosystem', unlock: () => F('v10:agency') && dayNumber() >= 4,
    desc: 'The office wants a whole community documented: who eats whom, who lives where.',
    steps: [{ text: 'Document an ecosystem', done: () => found('ecosystem') }],
    reward: { rp: 70 },
    ask: 'Next: a whole community. A reef, a forest stand, a cave. How it fits together.',
    thanks: 'That food web is going straight into the report. Superb.',
  },
  {
    id: 'a_artifact', giver: 'agency', title: 'Survey: Made by Hands', unlock: () => F('v10:agency') && dayNumber() >= 4,
    desc: 'The office wants to know whether anybody else has lived on Zealandia. Find something made by people.',
    steps: [{ text: 'Find a ruin or an artifact', done: () => found('artifact') || found('ruin') }],
    reward: { rp: 70 },
    ask: 'A question nobody here can answer: has anyone else lived out there? Look for anything made by hands.',
    thanks: 'Somebody was there before us. The office is very, very quiet right now. In a good way.',
  },
];
export const REQ_BY_ID: Record<string, Req> = Object.fromEntries(REQUESTS.map(r => [r.id, r]));

const giverOf = (g: ReqGiver): Giver => (g === 'agency' ? 'story' : g);

// ---------------------------------------------------------------- the daily to-do list
const today = () => dayNumber();
const phase = () => dayState().phase;
const photosToday = () => game.save.raw.filter(p => p.day === today()).length;
export const DAY_QUEST: QuestDef = {
  id: 'v10day', title: 'A Day at Camp', giver: 'story', main: true,
  desc: 'Breakfast, plans, an expedition, home before dark, research, dinner and stories round the fire.',
  steps: [
    { text: 'Have breakfast at the fire', done: () => dayState().meals.breakfast === today() || phase() !== 'morning', hint: 'Joshu cooks at the fire pit in the middle of camp. A hot breakfast makes the day’s walking easier.' },
    { text: 'Pack your bag and set off', done: () => phase() !== 'morning', hint: 'The trail sign at the east end of camp. The camp board has requests; Jenna’s bench upgrades your gear.' },
    { text: 'Make it back to camp', done: () => phase() === 'evening' || phase() === 'night', hint: 'Mind your energy: run it down to nothing and somebody has to carry you home.' },
    { text: 'Upload today’s photos', done: () => (phase() === 'evening' || phase() === 'night') && photosToday() === 0, hint: 'The laptop on your research table (or press L).' },
    { text: 'Dinner and stories at the fire', done: () => dayState().meals.dinner === today(), hint: 'Everyone gathers at the fire pit when the sun goes down.' },
    { text: 'Get some sleep in your tent', done: () => false, hint: 'Your tarp tent, next to the big blue one.' },
  ],
};

// ---------------------------------------------------------------- registration
function toQuest(r: Req): QuestDef {
  const steps = [...r.steps];
  if (r.give) steps.push({ text: `Hand ${r.give.map(([id, n]) => `${n} ${ITEMS[id]?.name ?? id}`).join(' and ')} in at the camp board`, done: () => given(r.id), hint: 'The board on two driftwood posts, between the drying rack and Aroha’s lean-to.' });
  return { id: r.id, title: r.title, giver: giverOf(r.giver), main: false, desc: r.desc, steps, reward: { rp: r.reward.rp, items: r.reward.items, text: r.reward.text } };
}
let registered = false;
export function registerCampQuests() {
  if (registered) return;
  registered = true;
  for (const q of [DAY_QUEST, ...REQUESTS.map(toQuest)]) {
    if (QUEST_BY_ID[q.id]) continue;
    QUESTS.push(q);
    QUEST_BY_ID[q.id] = q;
  }
}
registerCampQuests();

/** reset and restart the day's to-do list (each morning) */
export function startDayQuest() {
  const q = QUEST_BY_ID['v10day'];
  if (!q) return;
  q.title = `Day ${today()} at Camp`;
  if (game.save.quests['v10day'] !== 'active') { delete game.save.quests['v10day']; startQuest('v10day', true); }
  // the day's list is the tracked quest unless a story quest is running
  const t = game.save.tracked;
  if (!t || questStatus(t) !== 'active' || !(QUEST_BY_ID[t]?.main)) game.save.tracked = 'v10day';
  game.persist();
}

// ---------------------------------------------------------------- the board's view of requests
export type ReqState = 'locked' | 'open' | 'active' | 'ready' | 'done';
export function reqState(r: Req): ReqState {
  const st = questStatus(r.id);
  if (st === 'done') return 'done';
  if (st === 'active') return r.give && r.steps.every(s => s.done()) && !given(r.id) ? 'ready' : 'active';
  return r.unlock() ? 'open' : 'locked';
}
/** take a request on (snapshots any counters it measures from) */
export function acceptReq(id: string) {
  const r = REQ_BY_ID[id];
  if (!r || questStatus(id) !== 'hidden') return;
  if (id === 'r_fish') game.save.vars['v10:r_fish:base'] = v('v10:campFish');
  if (id === 'a_species3') game.save.vars['v10:a_species3:base'] = Object.keys(game.save.research).length;
  startQuest(id);
}
/** hand the things over at the board (the quest then completes on its own) */
export function handIn(id: string): boolean {
  const r = REQ_BY_ID[id];
  if (!r?.give || reqState(r) !== 'ready') return false;
  if (r.give.some(([it, n]) => count(it) < n)) return false;
  for (const [it, n] of r.give) remove(it, n);
  game.save.flags[`v10:req:${id}:given`] = true;
  game.persist();
  return true;
}
/** requests a crew member could offer in conversation right now */
export function offerable(who: ReqGiver): Req[] {
  return REQUESTS.filter(r => r.giver === who && reqState(r) === 'open');
}

/** completed requests not yet thanked for (the bond bonus and a thank-you line next time you talk) */
export function pendingThanks(who: ReqGiver): Req[] {
  const d = dayState() as unknown as { thanked?: string[] };
  const done = d.thanked ?? [];
  return REQUESTS.filter(r => r.giver === who && questStatus(r.id) === 'done' && !done.includes(r.id));
}
export function markThanked(r: Req) {
  const d = dayState() as unknown as { thanked?: string[] };
  (d.thanked ??= []).push(r.id);
  if (r.giver !== 'agency' && r.reward.bond) addBond(r.giver, r.reward.bond);
  game.persist();
}

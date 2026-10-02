// Developer panel, part 1: every story point, scene and place the game can jump to, the save state
// each one needs to start consistently, and the rules for skipping quest steps so the story itself
// moves on (the flags, counters and boat / camp state the scenes read, not just the quest tracker).
//
// Loaded lazily with the developer panel (src/debug/devpanel.ts); nothing here runs in normal play.
//
// Story points on Day 0/1 rebuild a fresh save and replay the story's flags up to that point (the
// CHAIN below), so jumping backwards works too. Day 2+ points and expeditions keep the current save
// when it has already finished Day 1 (otherwise they build the Day 1 save first).

import { game } from '../game/game';
import { newSave } from '../game/save';
import type { UploadRecord, ResearchEntry } from '../game/save';
import { QUESTS, QUEST_BY_ID, completeQuest, startQuest, questStatus, currentStepIndex } from '../game/quests';
import type { QuestDef } from '../game/quests';
import { add, count, remove } from '../game/inventory';
import { BUILDS } from '../game/crafting';
import { SPECIES } from '../game/species';
import { dayState, dayNumber, setPhase } from '../game/v10/day';
import type { Phase } from '../game/v10/day';
import { boatSave, setBoatStage, BOAT_JOBS, BOAT_FLAG, CURE_FALLBACK } from '../game/v10/boat';
import type { JobId } from '../game/v10/boat';
import { LOCATIONS, findLocation, discover, syncReachable } from '../game/v10/regions';
import type { DiscoveryKind } from '../game/v10/regions';
import { REQ_BY_ID } from '../game/v10/campquests';
import { refill } from '../game/v10/energy';
import { endTrip } from '../game/v10/expedition';
import { SPOT, WRECK } from '../art/island4/layout';
import type { TimeOfDay } from '../world/timeofday';
import type { SiteId } from '../game/species';

// ---------------------------------------------------------------- small helpers
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const isBusy = () => (game as unknown as { busy: boolean }).busy;
/** wait for a running scene change to finish */
export async function idle(ms = 20000) {
  const t0 = performance.now();
  while (isBusy() && performance.now() - t0 < ms) await sleep(50);
}
/** wait until the active scene passes `pred` and no scene change is running */
export async function sceneWhere(pred: (s: unknown) => boolean, ms = 25000) {
  const t0 = performance.now();
  await sleep(80);
  while ((!pred(game.scene) || isBusy()) && performance.now() - t0 < ms) await sleep(60);
  return pred(game.scene);
}

async function until(pred: () => boolean, ms: number) {
  const t0 = performance.now();
  while (!pred() && performance.now() - t0 < ms) await sleep(100);
}

const F = (...ks: string[]) => { for (const k of ks) game.save.flags[k] = true; };
const V = (k: string, n: number) => { game.save.vars[k] = n; };
const tool = (...ids: string[]) => { for (const id of ids) if (!game.save.tools.includes(id)) game.save.tools.push(id); };
/** quest statuses: these done, these active (the last main one becomes the tracked quest) */
function Q(done: string[], active: string[] = []) {
  const s = game.save;
  for (const id of done) s.quests[id] = 'done';
  for (const id of active) if (s.quests[id] !== 'done') s.quests[id] = 'active';
  for (const id of [...done, ...active]) { const ch = QUEST_BY_ID[id]?.chapter; if (ch !== undefined) s.chapter = Math.max(s.chapter, ch); }
  const main = [...active].reverse().find(id => QUEST_BY_ID[id]?.main);
  if (main) s.tracked = main;
  else if (s.tracked && done.includes(s.tracked)) s.tracked = null;
}
/** a brand-new expedition (settings kept), the way the title screen starts one */
function fresh() {
  const s = newSave();
  s.settings = { ...game.save.settings };
  s.flags['v4'] = true;
  game.save = s;
}

let fakeN = 0;
/** a research-log entry (and a stand-in upload so photo viewers have something to show) */
export function documentSpecies(sp: string, beh: string[] = [], vid: string[] = []) {
  const s = game.save;
  s.research ??= {};
  s.uploads ??= [];
  let e = s.research[sp] as ResearchEntry | undefined;
  if (!e) {
    const id = -100000 - Date.now() % 100000 - (fakeN++);
    const up: UploadRecord = {
      id, img: placeholderImg(sp), day: dayNumber(), time: 'day', site: 'dev', video: vid.length > 0, n: s.uploads.length + 1,
      subjects: [{ species: sp, beh: [...beh, ...vid], bbox: [0.3, 0.3, 0.7, 0.7], ok: true, stars: 2, n: 1 }],
    };
    s.uploads.push(up);
    e = { first: id, cover: id, photos: [id], beh: [], vid: [], facts: [], day: dayNumber(), n: Object.keys(s.research).length + 1, stars: 2 };
    s.research[sp] = e;
  }
  for (const b of beh) if (!e.beh.includes(b)) e.beh.push(b);
  for (const b of vid) if (!e.vid.includes(b)) e.vid.push(b);
  s.seen[sp] = true;
}
function placeholderImg(label: string): string {
  try {
    const c = document.createElement('canvas');
    c.width = 96; c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#3a6a5a'; x.fillRect(0, 0, 96, 64);
    x.fillStyle = '#f2e4bc'; x.font = '10px monospace'; x.fillText('DEV PHOTO', 18, 28); x.fillText(label.slice(0, 14), 6, 44);
    return c.toDataURL('image/jpeg', 0.6);
  } catch { return ''; }
}
const disc = (kind: DiscoveryKind, name: string, loc = 'camp') => discover({ id: `dev:${kind}:${loc}`, kind, name, loc }, true);

/** Kitten repair: everything up to stage n (materials handed in, finds, the waits) */
export function boatTo(n: number) {
  const b = boatSave();
  if (n >= 1) b.found.tender = true;
  const giveAll = (job: JobId) => { for (const [id, k] of BOAT_JOBS[job].needs) b.given[`${job}:${id}`] = k; };
  if (n >= 2) { giveAll('patch'); b.cureDay = 1; b.cureT = b.playT - CURE_FALLBACK - 1; }
  if (n >= 3) { b.found.log = true; giveAll('ama'); }
  if (n >= 4) { b.found.outboard = true; b.found.fuel = true; b.motorFixed = true; }
  if (n >= 5) { giveAll('sail'); giveAll('rig'); b.sailDay = 1; b.sailT = b.playT - CURE_FALLBACK - 1; }
  if (b.stage > n) b.stage = n;
  else setBoatStage(n);
  if (n >= 6) { game.save.flags[BOAT_FLAG] = true; Q(['v10kitten', 'v10ama', 'v10motor', 'v10sail', 'v10launch']); }
  else delete game.save.flags[BOAT_FLAG];
  try { syncReachable(); } catch { /* map not ready */ }
  game.persist();
}

// ---------------------------------------------------------------- the story, beat by beat
interface Beat { id: string; apply(): void }
const SHELLS = ['shell_sunwhorl', 'shell_fan', 'shell_cone', 'shell_opal', 'shell_trycop'];
const JOBS = ['firewood', 'supplies', 'tent', 'research', 'rack', 'bed'];
const CHAIN: Beat[] = [
  // ---- Day 0 aboard the Kittiwake (ship4)
  { id: 'ship:wake', apply: () => fresh() },
  { id: 'ship:morning', apply: () => { F('v4:woke'); Q([], ['v4morning']); } },
  { id: 'ship:engineCall', apply: () => {
    F('v4:noodles', 'v4:ate', 'v4:round:tank', 'v4:round:engine', 'v4:round:jenna', 'v4:round:joshu', 'v9:morningBird', 'v4:report');
    V('v4:rounds', 4);
    Q(['v4morning']);
  } },
  { id: 'ship:engine', apply: () => { F('v4:engineCall'); Q([], ['v4engine']); } },
  { id: 'ship:deck', apply: () => { F('v4:engineArrive', 'v4:engineFixed'); Q(['v4engine'], ['v4deck']); } },
  { id: 'ship:fishing', apply: () => { V('v4:photoSpecies', 3); F('v9:uploadShip'); } },
  { id: 'ship:storm', apply: () => { V('v4:fishCaught', 1); F('v4:fishToJoshu', 'v4:fishUsed', 'v4:joshuCooking'); Q(['v4deck']); } },
  { id: 'ship:gear', apply: () => { F('v4:stormStarted'); Q([], ['v4storm']); } },
  { id: 'ship:carry', apply: () => F('v4:raincoat', 'v4:chunkFound') },
  { id: 'ship:wave', apply: () => F('v4:bridge') },
  // ---- Day 1 on the island
  { id: 'beach:wake', apply: () => Q(['v4storm']) },
  { id: 'isle:sand', apply: () => F('v4:beachWoke') },
  { id: 'isle:jenna', apply: () => { F('v4:isleWoke'); Q([], ['v4shore']); V('v9:px', SPOT.moriWake); } },
  { id: 'isle:chunk', apply: () => {
    F('v4:jennaAwake', 'v9:kit', 'v9:shadow', 'v9:laptop'); tool('headlamp', 'trowel', 'net'); Q([], ['v9notes']); V('v9:px', WRECK.climbX - 40);
  } },
  { id: 'isle:split', apply: () => F('v4:chunkWreck') },
  { id: 'isle:seal', apply: () => {
    F('v4:split', 'trg:radio1', 'trg:tracks', 'trg:radio2'); tool('binoculars'); Q(['v4shore'], ['v4joshu', 'v9jenna']); V('v9:px', SPOT.sealRock - 185);
  } },
  { id: 'isle:joshu', apply: () => { F('v4:sealDone', 'trg:seal1', 'trg:seal2', 'trg:cave', 'v4:shoes'); V('v9:px', SPOT.joshu - 100); } },
  { id: 'isle:walkBack', apply: () => {
    F('v4:joshuFound', 'trg:joshu', 'v4:joshuChecked', 'v4:splashed', 'v4:water', 'v4:joshuAwake'); tool('knife'); Q(['v4joshu'], ['v4return']); V('v9:px', 4020);
  } },
  { id: 'isle:standoff', apply: () => {
    V('v4:wood', 3); V('v4:plants', 2); V('v4:food', 2); V('v4:minerals', 1); V('v4:islePhotos', 2); F('v4:back'); Q(['v4return'], ['v4aroha']);
  } },
  { id: 'isle:camp', apply: () => { F('v4:arohaJoined'); Q(['v4aroha'], ['v4camp']); V('v9:px', 2060); } },
  { id: 'isle:dinner', apply: () => { for (const j of JOBS) F('v4:job:' + j); V('v4:campJobs', 6); } },
  { id: 'isle:night', apply: () => F('v4:dinner', 'v4:campDone') },
];
const chainIndex = (id: string) => CHAIN.findIndex(b => b.id === id);
/** a fresh save with the story played up to (and including) beat `id` */
export function stateAt(id: string) {
  const n = chainIndex(id);
  for (let i = 0; i <= n; i++) CHAIN[i].apply();
  game.persist();
}

/** Day 1 is done (the camp loop runs): keep the save if it got there, else build it */
function ensureLoop() {
  const f = game.save.flags;
  if (!f['v4:day1']) {
    stateAt('isle:night');
    game.save.flags['v4:day1'] = true;
    Q(['v4camp']);
    game.save.day = 2;
    const d = dayState();
    d.phase = 'morning'; d.woke = 2; d.arrive = null; d.went = null; d.clock = 0.3;
  }
  if ((game.save.day ?? 1) < 2) game.save.day = 2;
  try { endTrip(); } catch { /* no trip */ }
  game.persist();
}

// ---------------------------------------------------------------- going places
const flow = () => import('../game/scenes/flow');
async function goShip(post?: (s: ShipLike) => Promise<void> | void) {
  await idle();
  await (await flow()).goShip4();
  const { ShipScene4 } = await import('../game/v4/ship');
  if (!(await sceneWhere(s => s instanceof ShipScene4))) return;
  await sleep(500);
  if (post) await post(game.scene as unknown as ShipLike);
}
async function goIsle(post?: (s: IsleLike) => Promise<void> | void) {
  await idle();
  const { goIsland } = await import('../game/v4/islandflow');
  await goIsland();
  const { IslandScene4 } = await import('../game/v4/island');
  if (!(await sceneWhere(s => s instanceof IslandScene4))) return;
  await sleep(500);
  if (post) await post(game.scene as unknown as IsleLike);
}
interface PlayerLike { x: number; y: number; vx: number; vy: number; facing: number; state: string; onGround: boolean }
interface ShipLike { player: PlayerLike; snapCamera(): void; cutscene: boolean; story: unknown }
interface IsleLike { player: PlayerLike; snapCamera(): void; cutscene: boolean; story: { camp: { lightsOut(): Promise<void> } } | null; clock: { set(t: number): void } }

async function campLoop(ph: Phase | 'wake', post?: () => Promise<void>) {
  ensureLoop();
  const d = dayState(), day = dayNumber();
  d.arrive = null;
  d.went = null;
  if (ph === 'wake') { d.phase = 'morning'; d.woke = day - 1; d.clock = 0.05; }
  else {
    d.woke = day;
    d.phase = ph;
    d.clock = ph === 'morning' ? 0.4 : ph === 'out' ? 1.6 : ph === 'evening' ? 2.7 : 3.8;
    if (ph !== 'morning') d.meals.breakfast = day;
    if (ph === 'night') d.meals.dinner = day;
  }
  V('v9:px', 2000);
  game.persist();
  await goIsle(async () => {
    if (!post) return;
    const { campReady } = await import('../game/v10/campday');
    await campReady();
    await sleep(400);
    await post();
  });
}

/** Region Map location: fast travel from camp (energy refilled after) */
export async function goLocation(id: string) {
  ensureLoop();
  const L = LOCATIONS.find(l => l.id === id);
  if (!L) return;
  if ((L.needs ?? []).includes(BOAT_FLAG)) boatTo(6);
  for (const f of L.needs ?? []) game.save.flags[f] = true;
  findLocation(id);
  const d = dayState();
  if (id !== 'camp') { d.phase = 'out'; d.went = id; d.woke = dayNumber(); d.meals.breakfast = dayNumber(); }
  game.persist();
  await idle();
  const ex = await import('../game/v10/expedition');
  await ex.goExpedition(id);
  refill();
}
export async function goTrip(id: string, stop = false) {
  ensureLoop();
  boatTo(6);
  const d = dayState();
  d.phase = 'out'; d.woke = dayNumber();
  game.persist();
  await idle();
  const oc = await import('../game/sites10/ocean');
  if (!stop) { await oc.goBoatTrip(id); return; }
  // straight to the far end: start the trip state, then land
  await oc.goBoatTrip(id);
  await sceneWhere(() => !!oc.currentTrip());
  await idle();
  await oc.goStop(id);
}

// ---------------------------------------------------------------- the list
export interface DevPoint {
  id: string;
  name: string;
  sub?: string;
  icon?: string;
  /** small buttons on the row instead of one big one (e.g. times of day) */
  variants?: { label: string; run: () => Promise<void> }[];
  run?: () => Promise<void>;
}
export interface DevChapter { id: string; name: string; points: DevPoint[] }

const zl = () => (window as unknown as { zl?: Record<string, (...a: unknown[]) => Promise<unknown>> }).zl ?? {};
const TODS: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
const TOD_LABEL: Record<TimeOfDay, string> = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };

export async function chapters(): Promise<DevChapter[]> {
  await import('../game/sites10/ocean');
  const { TRIPS } = await import('../game/sites10/ocean');
  const sh = (id: string, post?: (s: ShipLike) => Promise<void> | void) => async () => { stateAt(id); await goShip(post); };
  const isle = (id: string, post?: (s: IsleLike) => Promise<void> | void) => async () => { stateAt(id); await goIsle(post); };
  const out: DevChapter[] = [];
  out.push({ id: 'start', name: 'Start', points: [
    { id: 'title', name: 'Title screen', icon: 'play', run: async () => { await idle(); await (await flow()).goTitle(); } },
    { id: 'continue', name: 'Continue the current save', sub: 'Wherever the save left off', icon: 'skip', run: async () => { await idle(); await (await flow()).continueV4(); } },
  ] });
  out.push({ id: 'day0', name: 'Day 0 · Aboard the Kittiwake', points: [
    { id: 'ship:wake', name: 'Morning: wake up with Chunk', sub: 'A brand-new save, from the very first scene', icon: 'sun', run: sh('ship:wake') },
    { id: 'ship:morning', name: 'Morning: noodles, rounds, report', sub: 'Up and about (the wake-up skipped)', icon: 'sun', run: sh('ship:morning') },
    { id: 'ship:engineCall', name: 'Engine trouble: Jenna calls', sub: 'The morning report is written', icon: 'scroll', run: sh('ship:engineCall') },
    { id: 'ship:engine', name: 'Engine repair', sub: 'Straight into the engine room minigame', icon: 'wrench', run: sh('ship:engine', async s => {
      // walk Mori into the engine room (the story starts the repair when he gets there)
      for (let i = 0; i < 40 && !game.save.flags['v4:engineArrive'] && game.scene === (s as unknown); i++) {
        if (!s.cutscene) { s.player.x = 190; s.snapCamera(); }
        await sleep(250);
      }
    }) },
    { id: 'ship:deck', name: 'Deck photography', sub: 'Afternoon: wildlife round the boat', icon: 'film', run: sh('ship:deck') },
    { id: 'ship:fishing', name: 'Fishing at the stern', sub: 'Photos uploaded; the rod is in your hands', icon: 'target', run: sh('ship:fishing', async s => {
      await until(() => !s.cutscene && !game.ui.blocking, 8000);
      const { SPOTS } = await import('../game/v4/ship');
      s.player.x = SPOTS.fishing[0] + 8; s.player.y = SPOTS.fishing[1]; s.player.facing = -1; s.snapCamera();
      const st = s.story as { fish?: () => Promise<void> } | null;
      void st?.fish?.call(st);
    }) },
    { id: 'ship:storm', name: 'Storm start', sub: 'The calm before, then the impact', icon: 'bolt', run: sh('ship:storm') },
    { id: 'ship:gear', name: 'After the impact: oilskins, Chunk pops out', sub: 'Get your gear from Joshu in the bunk room', icon: 'bolt', run: sh('ship:gear') },
    { id: 'ship:carry', name: 'Carry Chunk to the wheelhouse', sub: 'Geared up, Chunk in your arms', icon: 'heart', run: sh('ship:carry') },
    { id: 'ship:wave', name: 'The giant wave', sub: 'The rogue wave finale and the blackout', icon: 'boat', run: sh('ship:wave') },
  ] });
  out.push({ id: 'day1', name: 'Day 1 · Washed ashore', points: [
    { id: 'beach:wake', name: 'Beach wake-up (first person)', sub: 'wake4', icon: 'sun', run: async () => { stateAt('beach:wake'); await idle(); await (await flow()).goBeachWake(); } },
    { id: 'isle:sand', name: 'Island: waking on the sand', icon: 'sun', run: isle('isle:sand') },
    { id: 'isle:jenna', name: 'Find Jenna', sub: 'Pink hair down the beach', icon: 'heart', run: isle('isle:jenna') },
    { id: 'isle:chunk', name: 'Find Chunk in the wreck', sub: 'Field kit found; something crunching in the dark', icon: 'heart', run: isle('isle:chunk') },
    { id: 'isle:split', name: 'Split up to search for Joshu', icon: 'map', run: isle('isle:split') },
    { id: 'isle:seal', name: 'The seal chase', sub: 'The snoring rock across the beach', icon: 'target', run: isle('isle:seal') },
    { id: 'isle:joshu', name: 'Joshu rescue', sub: 'Out cold by the creek', icon: 'heart', run: isle('isle:joshu') },
    { id: 'isle:walkBack', name: 'The long walk back', sub: 'Gather with Joshu on the way', icon: 'gift', run: isle('isle:walkBack') },
    { id: 'isle:standoff', name: 'Aroha standoff', sub: 'The dognapper', icon: 'scroll', run: isle('isle:standoff') },
    { id: 'isle:camp', name: 'Camp build', sub: 'Six jobs before dark', icon: 'wrench', run: isle('isle:camp') },
    { id: 'isle:dinner', name: 'Dinner round the fire', icon: 'heart', run: isle('isle:dinner') },
    { id: 'isle:night', name: 'Night at camp', sub: 'Tidy up and get some sleep', icon: 'moon', run: isle('isle:night') },
    { id: 'isle:day1end', name: 'Day 1 complete', sub: 'Lights out and the end card', icon: 'star', run: isle('isle:night', async s => { await until(() => !s.cutscene && !game.ui.blocking, 8000); void s.story?.camp.lightsOut(); }) },
  ] });
  out.push({ id: 'loop', name: 'Day 2+ · The camp loop', points: [
    { id: 'camp:wake', name: 'Morning: wake up in the tent', sub: 'The day’s wake-up scene (and any wake event)', icon: 'sun', run: () => campLoop('wake') },
    { id: 'camp:morning', name: 'Morning at camp', sub: 'Breakfast, the board, the bench, the trail', icon: 'sun', run: () => campLoop('morning') },
    { id: 'camp:evening', name: 'Evening at camp', sub: 'Back home: uploads and dinner', icon: 'sun', run: () => campLoop('evening') },
    { id: 'camp:night', name: 'Night at camp', sub: 'After dinner: the night talk, bed', icon: 'moon', run: () => campLoop('night') },
    { id: 'camp:arrive', name: 'Coming home', sub: 'The arrival cutscene', icon: 'skip', variants: (['walk', 'blackout', 'boat'] as const).map(how => ({
      label: how === 'walk' ? 'On foot' : how === 'blackout' ? 'Carried' : 'By boat',
      run: async () => {
        if (how === 'boat') { ensureLoop(); boatTo(6); }
        await campLoop('out', async () => { const { arriveAtCamp } = await import('../game/v10/day'); await arriveAtCamp(how); });
      },
    })) },
    { id: 'camp:dayN', name: 'Sleep to the next day', sub: 'No cutscene: the next morning', icon: 'moon', run: async () => {
      ensureLoop();
      const { startNextDay } = await import('../game/v10/day');
      await startNextDay();
      await goIsle();
    } },
  ] });
  // the Region Map
  const order = ['home', 'interior', 'south', 'east', 'ocean', 'isle2'];
  const locs = [...LOCATIONS].filter(l => !l.trip).sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region));
  out.push({ id: 'map', name: 'Region Map · Expeditions', points: locs.map(l => ({
    id: 'loc:' + l.id, name: l.name, sub: `${l.sub ? l.sub + ' · ' : ''}${l.region}${l.secret ? ' · secret' : ''}`, icon: l.kind === 'camp' ? 'flag' : l.kind === 'cave' ? 'moon' : 'map',
    run: () => goLocation(l.id),
  })) });
  out.push({ id: 'boat', name: 'Boat trips (the Kitten)', points: Object.values(TRIPS).map(t => ({
    id: 'trip:' + t.id, name: t.name, sub: t.sub, icon: 'boat',
    variants: t.stop === 'land' || t.stop === 'reef'
      ? [{ label: 'Sail out', run: () => goTrip(t.id) }, { label: t.stop === 'reef' ? 'Dive' : 'Landed', run: () => goTrip(t.id, true) }]
      : undefined,
    run: () => goTrip(t.id),
  })) });
  // the V2 scenes
  const sites: SiteId[] = ['fernwood', 'canopy', 'falls', 'mangrove', 'coast'];
  const siteName: Record<string, string> = { fernwood: 'Fernwood Floor', canopy: 'Emerald Canopy', falls: 'Thunder Falls', mangrove: 'Blackwater Mangroves', coast: 'Serpent Coast' };
  out.push({ id: 'v2', name: 'V2 classic scenes', points: [
    { id: 'v2:boat', name: 'V2 prologue: the boat', icon: 'boat', run: async () => { await idle(); await (await flow()).goPrologue(); } },
    { id: 'v2:camp', name: 'V2 beach camp', icon: 'flag', variants: TODS.map(t => ({ label: TOD_LABEL[t], run: async () => { game.save.campTime = t; await idle(); await (await flow()).goCamp(); } })) },
    { id: 'v2:tent', name: 'Camp tent', icon: 'moon', variants: [
      { label: 'Day', run: async () => { await idle(); await (await flow()).goTent(false); } },
      { label: 'Night', run: async () => { await idle(); await (await flow()).goTent(true); } },
    ] },
    ...sites.map(id => ({ id: 'v2:' + id, name: siteName[id] + ' (V2 site)', icon: 'map', variants: TODS.map(t => ({ label: TOD_LABEL[t], run: async () => { await idle(); await (await flow()).goField(id, t); } })) })),
    { id: 'v2:deep', name: 'The Deep (dive)', icon: 'boat', variants: TODS.slice(1, 3).map(t => ({ label: TOD_LABEL[t], run: async () => {
      await idle();
      const { COAST_DEEP } = await import('../game/sites2');
      const { FieldScene } = await import('../game/scenes/field');
      await game.go(() => new FieldScene(COAST_DEEP, t));
    } })) },
  ] });
  out.push({ id: 'mini', name: 'Minigames and screens', points: [
    { id: 'm:engine', name: 'Engine repair minigame', icon: 'wrench', run: async () => { await zl().engine?.(); } },
    { id: 'm:noodles', name: 'Instant noodles', icon: 'heart', run: async () => { await zl().noodles?.(); } },
    { id: 'm:ramen', name: 'Ramen pour', icon: 'heart', run: async () => { await zl().ramen?.(); } },
    { id: 'm:standoff', name: 'Aroha negotiation', icon: 'scroll', run: async () => { await zl().standoff?.(); } },
    { id: 'm:steady', name: 'Tent pole: hold steady', icon: 'timer', run: async () => { await zl().steady?.(); } },
    { id: 'm:knot', name: 'Lashing knot', icon: 'spin', run: async () => { await zl().knot?.(); } },
    { id: 'm:fishfight', name: 'Fish fight (ship scene)', sub: 'Jumps to the ship deck first if needed', icon: 'target', run: async () => {
      const { ShipScene4 } = await import('../game/v4/ship');
      if (!(game.scene instanceof ShipScene4)) { stateAt('ship:fishing'); await goShip(); }
      await zl().fishFight?.();
    } },
    { id: 'm:laptop', name: 'MoriOS laptop', icon: 'film', run: async () => { await zl().moriOS?.(false, false); } },
    { id: 'm:regionmap', name: 'Region Map (pick a place to go)', icon: 'map', run: async () => {
      const { openRegionMap } = await import('../ui/v10/regionmap');
      const to = await openRegionMap({});
      if (to) await goLocation(to);
    } },
    { id: 'm:pack', name: 'Backpack', icon: 'gift', run: async () => { await zl().pack?.(); } },
    { id: 'm:review', name: 'Photo review', icon: 'film', run: async () => { await zl().review?.(); } },
    { id: 'm:journal', name: 'Field Guide', icon: 'scroll', run: async () => { (await import('../ui/journal')).openJournal(); } },
  ] });
  return out;
}

// ---------------------------------------------------------------- reloading the scene (after a skip)
/** rebuild the active scene from the save, so the story reads the new flags */
export async function reloadScene(): Promise<boolean> {
  await idle();
  const sc = game.scene as unknown as { player?: { x: number } } | null;
  const [{ ShipScene4 }, { IslandScene4 }, { FieldScene }, ex] = await Promise.all([
    import('../game/v4/ship'), import('../game/v4/island'), import('../game/scenes/field'), import('../game/v10/expedition'),
  ]);
  if (sc instanceof ShipScene4) { await goShip(); return true; }
  if (sc instanceof IslandScene4) {
    if (sc.player) game.save.vars['v9:px'] = Math.round(sc.player.x);
    await goIsle();
    return true;
  }
  const fs = sc as unknown as { constructor: unknown; site?: unknown; tod?: TimeOfDay } | null;
  const isPlainField = !!fs && Object.getPrototypeOf(fs) === FieldScene.prototype;
  if (fs && isPlainField && fs.site) {
    const tag = ex.sceneTag(fs);
    const site = fs.site as ConstructorParameters<typeof FieldScene>[0], tod = fs.tod ?? 'day';
    await game.go(() => { const f = new FieldScene(site, tod); if (tag) ex.tagScene(f, tag); return f; });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- quest skipping
type Skip = () => void;
const giveTo = (id: string, n: number) => { const k = n - count(id); if (k > 0) add(id, k); };
const build = (id: string) => { const b = BUILDS[id]; if (b) game.save.builds[id] = b.stages.length; };
const seeN = (n: number) => { for (const s of SPECIES.slice(0, n)) game.save.seen[s.id] = true; };
const dayQ = () => dayNumber();

const SKIPS: Record<string, Skip[]> = {
  // ---- V4 Day 0
  v4morning: [
    () => F('v4:noodles'),
    () => F('v4:ate'),
    () => { F('v4:round:tank', 'v4:round:engine', 'v4:round:jenna', 'v4:round:joshu'); V('v4:rounds', 4); },
    () => F('v9:morningBird'),
    () => F('v4:report'),
  ],
  v4engine: [() => F('v4:engineCall', 'v4:engineArrive'), () => F('v4:engineFixed')],
  v4deck: [
    () => V('v4:photoSpecies', 3),
    () => F('v9:uploadShip'),
    () => V('v4:fishCaught', Math.max(1, game.save.vars['v4:fishCaught'] ?? 0)),
    () => F('v4:fishToJoshu', 'v4:fishUsed', 'v4:joshuCooking'),
  ],
  v4storm: [() => F('v4:stormStarted', 'v4:raincoat', 'v4:chunkFound'), () => F('v4:bridge')],
  // ---- V4 Day 1
  v4shore: [
    () => F('v4:isleWoke', 'v4:jennaAwake'),
    () => { F('v9:kit', 'v9:shadow', 'v9:laptop'); tool('headlamp', 'trowel', 'net'); },
    () => F('v4:chunkWreck'),
    () => { F('v4:split'); tool('binoculars'); },
  ],
  v4joshu: [
    () => F('v4:sealDone', 'trg:seal1', 'trg:seal2'),
    () => F('v4:shoes'),
    () => F('v4:joshuFound', 'trg:joshu'),
    () => { F('v4:joshuChecked', 'v4:splashed', 'v4:water', 'v4:joshuAwake'); tool('knife'); },
  ],
  v4return: [
    () => V('v4:wood', 3), () => V('v4:plants', 2), () => V('v4:food', 2), () => V('v4:minerals', 1), () => V('v4:islePhotos', 2), () => F('v4:back'),
  ],
  v4aroha: [() => F('v4:arohaJoined')],
  v4camp: [
    () => { for (const j of JOBS) F('v4:job:' + j); V('v4:campJobs', 6); },
    () => F('v4:dinner', 'v4:campDone'),
    () => { F('v4:day1'); if ((game.save.day ?? 1) < 2) game.save.day = 2; },
  ],
  v9jenna: [() => F('v4:photo:glasscrab', 'v9:shot:glasscrab'), () => F('v4:photo:corvexseal', 'v9:shot:corvexseal')],
  v9shells: [() => { for (const id of SHELLS) F('v9:found:' + id); }],
  v9notes: [
    () => { for (const sp of SPECIES.slice(0, 6)) F('v4:photo:' + sp.id); },
    () => { for (const sp of SPECIES.slice(0, 6)) documentSpecies(sp.id); },
  ],
  // ---- V2 story
  voyage: [() => F('talk:crowe'), () => F('talk:pip'), () => F('ate'), () => F('photo:monarch'), () => F('reviewed:first')],
  storm: [() => V('crates', 3), () => F('storm:done')],
  castaways: [
    () => { giveTo('canvas', 1); giveTo('poles', 4); },
    () => tool('hammer'),
    () => build('bench'),
    () => giveTo('rope', 2),
    () => build('tent'),
    () => build('fire'),
    () => F('sample:first'),
    () => V('analyses', Math.max(1, game.save.vars['analyses'] ?? 0)),
    () => F('slept:1'),
  ],
  noise: [() => F('noise:found'), () => F('aroha:met')],
  contact: [() => F('visit:fernwood'), () => seeN(3), () => F('report:contact')],
  canopy: [() => { game.save.seen['skyribbon'] = true; }, () => { for (const s of SPECIES) for (const fa of s.facts.slice(0, 1)) game.save.facts[fa.id] = true; }, () => F('report:canopy')],
  falls: [() => F('visit:falls'), () => { game.save.clues['giant-skin'] = true; }, () => F('report:falls')],
  titan: [() => { game.save.seen['titan'] = true; }, () => F('report:titan')],
  deep: [() => F('divegear'), () => { game.save.seen['leviathan'] = true; }, () => F('report:deep')],
  guide: [() => seeN(SPECIES.length), () => { for (const s of SPECIES) for (const fa of s.facts) game.save.facts[fa.id] = true; }],
  pipe: [() => giveTo('pipe', 1), () => F('pipe:returned')],
  kitchen: [() => giveTo('moonfruit', 3), () => giveTo('kawakawa', 2), () => giveTo('bracket', 1), () => F('kitchen')],
  radio: [() => { game.save.builds['radio'] = Math.max(1, game.save.builds['radio'] ?? 0); }, () => build('radio'), () => F('radio:talked')],
  glow: [() => giveTo('glowcap', 3), () => F('glow:done')],
  snares: [() => V('snares', 3), () => F('snares:done')],
  tracks: [() => { for (const c of ['dev-clue-1', 'dev-clue-2', 'dev-clue-3', 'dev-clue-4']) game.save.clues[c] = true; }, () => F('tracks:done')],
  hawk: [() => { game.save.evPhoto['galehawk:diving'] = true; }, () => F('hawk:done')],
  snacker: [() => { game.save.evPhoto['quillhog:eating'] = true; }, () => F('snacker:done')],
  // ---- V10 boat
  v10kitten: [
    () => { boatSave().found.tender = true; },
    () => setBoatStage(1),
    () => { boatSave().given['patch:plank'] = 4; },
    () => { boatSave().given['patch:resin'] = 2; },
    () => { boatSave().given['patch:flaxleaf'] = 3; },
    () => { setBoatStage(2); const b = boatSave(); b.cureDay = Math.max(1, dayNumber()); b.cureT = b.playT; },
    () => { const b = boatSave(); b.cureDay = 1; b.cureT = b.playT - CURE_FALLBACK - 1; },
  ],
  v10ama: [
    () => { boatSave().found.log = true; },
    () => { boatSave().given['ama:wood'] = 4; },
    () => { boatSave().given['ama:flaxleaf'] = 3; },
    () => setBoatStage(3),
  ],
  v10motor: [
    () => { boatSave().found.outboard = true; },
    () => { boatSave().found.fuel = true; },
    () => { boatSave().motorFixed = true; },
    () => setBoatStage(4),
  ],
  v10sail: [
    () => { const b = boatSave(); b.given['sail:flaxleaf'] = 6; if (!b.sailDay) { b.sailDay = Math.max(1, dayNumber()); b.sailT = b.playT; } },
    () => { const b = boatSave(); b.sailDay = 1; b.sailT = b.playT - CURE_FALLBACK - 1; },
    () => { boatSave().given['rig:wood'] = 2; },
    () => { boatSave().given['rig:plank'] = 2; },
    () => setBoatStage(5),
  ],
  v10launch: [() => { setBoatStage(6); try { syncReachable(); } catch { /* */ } }],
  // ---- V10 day to-do list
  v10day: [
    () => { dayState().meals.breakfast = dayQ(); },
    () => { if (dayState().phase === 'morning') setPhase('out'); },
    () => setPhase('evening'),
    () => { setPhase(dayState().phase === 'night' ? 'night' : 'evening'); game.save.raw = game.save.raw.filter(p => p.day !== dayQ()); },
    () => { dayState().meals.dinner = dayQ(); },
    () => { /* sleeping is the next day: see skipToNext */ },
  ],
};

/** camp board / agency requests: built from their own definitions */
function reqSkips(id: string): Skip[] | null {
  const r = REQ_BY_ID[id];
  if (!r) return null;
  const v = (k: string) => game.save.vars[k] ?? 0;
  const per: Record<string, Skip> = {
    r_fish: () => V('v10:campFish', v('v10:r_fish:base') + 3),
    r_sealroar: () => documentSpecies('corvexseal', ['roaring']),
    r_waddler: () => documentSpecies('duskwaddler', ['digging', 'calling']),
    r_village: () => disc('village', 'Te Kāinga', 'village'),
    a_species3: () => { const have = new Set(Object.keys(game.save.research)); let n = 0; for (const s of SPECIES) { if (n >= 3) break; if (!have.has(s.id)) { documentSpecies(s.id); n++; } } },
    a_hornet: () => documentSpecies('jewelhornet', ['nesting']),
    a_fossil: () => disc('fossil', 'A fossil (dev)', 'fossils'),
    a_region: () => findLocation('fernwood'),
    a_video: () => documentSpecies(Object.keys(game.save.research)[0] ?? SPECIES[0].id, [], ['moving']),
    a_eco: () => disc('ecosystem', 'An ecosystem (dev)', 'glowforest'),
    a_artifact: () => disc('artifact', 'An artifact (dev)', 'ruins'),
  };
  const steps: Skip[] = r.steps.map(() => per[id] ?? (() => { for (const [it, n] of r.give ?? []) giveTo(it, n); }));
  if (r.give) steps.push(() => { for (const [it, n] of r.give!) remove(it, Math.min(n, count(it))); F(`v10:req:${id}:given`); });
  return steps;
}

export function skipsFor(q: QuestDef): Skip[] | null {
  return SKIPS[q.id] ?? reqSkips(q.id);
}
export function canSkipStep(q: QuestDef, i: number) {
  const s = skipsFor(q);
  return !!s && !!s[i];
}

/** make step i of a quest true in the save (the flags / counters / state its check reads) */
export function completeStep(q: QuestDef, i = currentStepIndex(q)): boolean {
  const s = skipsFor(q);
  const fn = s?.[i];
  if (!fn) return false;
  fn();
  game.persist();
  return true;
}

/** every remaining step, then the quest itself (pays its reward and starts its follow-up) */
export function completeWhole(q: QuestDef) {
  const s = skipsFor(q);
  if (s) for (let i = currentStepIndex(q); i < q.steps.length; i++) { try { s[i]?.(); } catch (e) { console.warn('[dev] skip', q.id, i, e); } }
  if (questStatus(q.id) === 'hidden') startQuest(q.id, true);
  completeQuest(q.id);
  game.persist();
}

/** where the story picks up after each main story quest (a consistent jump instead of a guess) */
const NEXT_POINT: Record<string, string> = {
  v4morning: 'ship:engineCall', v4engine: 'ship:deck', v4deck: 'ship:storm', v4storm: 'beach:wake',
  v4shore: 'isle:seal', v4joshu: 'isle:walkBack', v4return: 'isle:standoff', v4aroha: 'isle:camp', v4camp: 'camp:wake',
};
export const nextPointId = (q: QuestDef): string | null => NEXT_POINT[q.id] ?? null;
/** finish the quest and go on to the next one; story quests jump to where the next one starts */
export async function skipToNext(q: QuestDef, all: DevChapter[]): Promise<string> {
  const pid = NEXT_POINT[q.id];
  if (pid) {
    const p = all.flatMap(c => c.points).find(x => x.id === pid);
    if (p?.run) { await p.run(); return `Jumped to “${p.name}”.`; }
  }
  if (q.id === 'v10day') {
    const { startNextDay } = await import('../game/v10/day');
    await startNextDay();
    await goIsle();
    return `Slept through to Day ${dayNumber()}.`;
  }
  completeWhole(q);
  const nx = q.next ? QUEST_BY_ID[q.next] : null;
  if (nx && questStatus(nx.id) === 'hidden') startQuest(nx.id, true);
  return nx ? `Done. Next quest: ${nx.title}.` : 'Done (no follow-up quest).';
}

export { QUESTS, QUEST_BY_ID, questStatus, currentStepIndex, startQuest };
export type { QuestDef };

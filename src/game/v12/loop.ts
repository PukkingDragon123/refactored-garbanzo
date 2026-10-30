// V12 the loop, made clear (after Dave the Diver: plain day phases, one obvious goal, satisfying
// moments in between):
//
//   morning   wake at camp; breakfast at the fire, where a crew member tells you TODAY'S GOAL (it is
//             also the day's quest in the notebook); pack Joshu's lunch at the stash chest
//   out       walk out of camp along the beach: the trip starts the moment you leave (the crew shout a
//             send-off, and a warning if you skipped breakfast or packed no food). Walk the trails,
//             explore, photograph, gather (QTEs). Your stomach growls; eat or you can't take photos.
//   dusk      17:15 Jenna radios: the sun's getting low, start back. 19:30 Joshu radios, worried.
//             Still out at 20:30 (or starving on the trail) and Aroha comes looking: the carry-home.
//   evening   walk back into camp: the arrival, then develop the day's photos at the laptop, cook,
//             dinner and stories round the fire, sleep. A short stroll that never really left camp
//             doesn't end the day.
//
// The camp's own cutscenes (wake-up, meals, arrivals, sleep) stay in campscenes.ts / camparrive.ts;
// this module is the glue around them, installed into every field scene by field10.ts.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import { Custom } from '../../world/props';
import { ITEMS } from '../items';
import { SPECIES_BY_ID } from '../species';
import { QUEST_BY_ID, trackedQuest, currentStep } from '../quests';
import type { Giver } from '../quests';
import { bucket } from '../v10/store';
import { currentExpedition, expeditionHour, beginTrip, endTrip, returnToCamp, setExpeditionHour, isIslandScene, tripTrail, arrivedAt } from '../v10/expedition';
import { dayPhase, setPhase, leaveCamp, dayState, dayNumber, arriveAtCamp } from '../v10/day';
import { islandLocAt, location, isIsland } from '../v10/regions';
import { fireBlackout } from '../v10/energy';
import { BLUEPRINTS, hasBlueprint } from '../v11/blueprints';
import { floatText, floatNotice } from '../../ui/v12/float';
import { setHungerQuiet, onStarving, tooHungryForPhotos, HUNGER_ZL } from './hunger';
import { clockOfHour, hourOfClock, DUSK_HOUR, DARK_HOUR, FETCH_HOUR } from './clock';
import { TRAILS, depthOf, hourNow, TRAILS_ZL } from './trails';
import { GATES, gateNeed, gateOk } from './gear';
import { RARE, installRare } from './rare';
import { setDayGoal } from '../v10/campquests';

/** camp, on the beach (world x): walking past these is leaving camp */
export const CAMP_X0 = 1330, CAMP_X1 = 2680;

interface LoopState {
  day: number;
  /** dusk warnings given today: 1 Jenna, 2 Joshu, 3 Aroha came */
  warned: number;
  /** island clock hour when Mori set off today */
  left: number;
  /** today's goal */
  goal: { kind: GoalKind; id: string } | null;
  /** research count at dawn (the fallback goal counts from it) */
  research0: number;
  /** evening stroll warning given */
  dark: number;
}
const S = (): LoopState => {
  const s = bucket<LoopState>('v12loop', () => ({ day: 0, warned: 0, left: 0, goal: null, research0: 0, dark: 0 }));
  if (s.day !== dayNumber()) { s.day = dayNumber(); s.warned = 0; s.left = 0; s.goal = null; s.research0 = Object.keys(game.save.research ?? {}).length; s.dark = 0; }
  return s;
};

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const v10On = () => !!game.save.flags['v4:day1'] || !!game.save.flags['v10'];
type CrewId = 'jenna' | 'joshu' | 'aroha';

// ---------------------------------------------------------------- per scene
/** field10 hands every field scene here */
export function attachLoop(f: FieldScene) {
  installRare(f);
  f.main.add(new Custom(0, () => {}, dt => tick(f, dt)));
}

let campT = 0;
function tick(f: FieldScene, dt: number) {
  if (game.scene !== f || !v10On() || !(dt > 0)) return;
  const island = isIslandScene(f);
  const clock = (f as unknown as { clock?: { t: number; target: number; rate: number } }).clock;
  // the forest's sky follows the expedition clock (the island's own clock is the clock on the beach)
  if (!island && clock && currentExpedition()) { clock.target = clockOfHour(expeditionHour()); clock.rate = 0.01; }
  if (f.cutscene || game.ui.blocking) return;
  if (island && clock) tickIsland(f, clock);
  campT -= dt;
  if (campT <= 0) { campT = 1; dusk(f); }
}

function tickIsland(f: FieldScene, clock: { t: number; target: number; rate: number }) {
  const x = f.player.x, inCamp = x > CAMP_X0 && x < CAMP_X1;
  const ph = dayPhase(), d = dayState();
  if (d.arrive) return;
  if (ph === 'morning') { if (!inCamp) setOff(f, clock); return; }
  if (ph === 'out') {
    const cur = currentExpedition();
    if (cur && isIsland(location(cur))) {
      setExpeditionHour(hourOfClock(clock.t));
      const z = islandLocAt(x);
      if (z !== 'camp' && z !== cur) arrivedAt(z);
    }
    if (inCamp && x > CAMP_X0 + 60 && x < CAMP_X1 - 60) homeAgain(f, clock);
    return;
  }
  // evening / night: no wandering off into the dark
  const s = S();
  if ((x < CAMP_X0 - 420 || x > CAMP_X1 + 420) && s.dark < dayNumber()) {
    s.dark = dayNumber();
    say(f, 'joshu', ph === 'night' ? 'Oi! It’s the middle of the night, lad! Back to camp!' : 'It’s getting dark, Doc! Don’t go far!', 'shout');
  }
}

/** Mori walks out of camp in the morning: the day's trip starts */
function setOff(f: FieldScene, clock: { t: number; target: number; rate: number }) {
  const s = S(), d = dayState();
  const h = hourOfClock(clock.t);
  s.left = h;
  leaveCamp('home');
  beginTrip(islandLocAt(f.player.x), h);
  clock.target = 4;
  clock.rate = 0.0014;
  const ate = d.meals.breakfast === dayNumber();
  const food = game.save.inv.some(it => ITEMS[it.id]?.kind === 'food');
  const line = !ate ? 'Oi! No breakfast?! Your stomach’ll be growling by mid-morning!'
    : !food ? 'No lunch in that pack? You’ll be eating sand by noon, lad!'
    : pick(['Off you go! Back before dark!', 'Fair winds, Doc! Mind the light!', 'Bring us back something good!']);
  say(f, 'joshu', line, 'shout');
  const g = todayGoal();
  if (g) setTimeout(() => floatNotice(`Today: ${g.text}`, 4200), 2200);
}

/** back into camp: the evening, or (a quick stroll that never really left) the morning goes on */
function homeAgain(f: FieldScene, clock: { t: number; target: number; rate: number }) {
  const s = S();
  const cur = currentExpedition();
  const h = hourOfClock(clock.t);
  const went = tripTrail().some(l => !isIsland(location(l)));
  const real = went || h - (s.left || h) >= 1.5 || h >= 15.5;
  if (!real) {
    endTrip();
    setPhase('morning');
    clock.target = 2.5;
    clock.rate = 0.0011;
    say(f, 'joshu', pick(['Back already? Forget something?', 'That was quick. The island’s that way, Doc.']), 'say');
    return;
  }
  if (cur) void returnToCamp('walk');
  else void arriveAtCamp('walk');
}

// ---------------------------------------------------------------- dusk: the crew on the radio, then Aroha
function dusk(f: FieldScene) {
  const out = currentExpedition() !== null || dayPhase() === 'out';
  if (!out || dayState().arrive) return;
  const s = S(), h = hourNow(f);
  const atCamp = isIslandScene(f) && f.player.x > CAMP_X0 && f.player.x < CAMP_X1;
  if (atCamp) return;
  const far = depthOf(currentExpedition() ?? 'camp');
  if (h >= DUSK_HOUR && s.warned < 1) {
    s.warned = 1;
    radio('jenna', far >= 2 ? 'Mori? Jenna. The sun’s getting low and you’re miles out. Start heading back. Now-ish. Now.' : 'Mori? Jenna here. Sun’s getting low! Start heading back to camp!');
    setTimeout(() => void floatText({ text: pick(['On my way. Ish.', 'Heading back! Just... one more photo.', 'Copy that. Turning round.']), style: 'think', ms: 2400 }), 3200);
    game.persist();
  } else if (h >= DARK_HOUR && s.warned < 2) {
    s.warned = 2;
    radio('joshu', 'Son, it’s nearly dark. WHERE ARE YOU? Come home. Now.', true);
    setTimeout(() => void floatText({ text: '...walking faster.', style: 'whisper', ms: 2200 }), 3000);
    game.persist();
  } else if (h >= FETCH_HOUR && s.warned < 3 && !f.cutscene) {
    s.warned = 3;
    game.save.vars['v12:fetch'] = 1;
    game.persist();
    void floatText({ text: 'MORI! MORI?! ...There you are.', style: 'shout', ms: 2400, x: f.player.x - 120, y: f.player.y - 90 });
    setTimeout(() => fireBlackout(), 1800);
  }
}

/** the crew on the walkie-talkie: floating radio text by Mori */
function radio(who: CrewId, text: string, shout = false) {
  audio().then(a => a.play('scanBeep', { vol: 0.3, pitch: 0.7 }));
  const name = who === 'jenna' ? 'Jenna' : who === 'joshu' ? 'Joshu' : 'Aroha';
  void floatText({ text: `${name}: ${text}`, style: shout ? 'shout' : 'radio', ms: 4200 });
}
const audio = () => import('../../core/audio').then(m => m.audio);

function say(f: FieldScene, who: CrewId, text: string, style: 'say' | 'shout' | 'happy' = 'say') {
  const a = f.actors.get(who);
  if (a && a.visible && Math.abs(a.x - f.player.x) < 600) void floatText({ actor: a, text, style, ms: 2800 });
  else radio(who, text, style === 'shout');
}

// ---------------------------------------------------------------- starving out on the trail
onStarving(() => {
  const out = currentExpedition() !== null || dayPhase() === 'out';
  if (!out) return;
  game.save.vars['v12:fetch'] = 2;
  game.persist();
  void floatText({ text: 'I... need to sit down. Just for a... minute...', style: 'whisper', ms: 2200 });
  setTimeout(() => fireBlackout(), 1600);
});
setHungerQuiet(() => {
  const s = game.scene as unknown as { cutscene?: boolean } | null;
  return !s || !!s.cutscene || game.ui.blocking || game.ui.bubbles.active;
});

// ---------------------------------------------------------------- today's goal
export type GoalKind = 'quest' | 'gear' | 'points' | 'place' | 'rare' | 'survey';
export interface DayGoal { kind: GoalKind; text: string; who: CrewId; line: string; done: () => boolean }

const crewOf = (g: Giver): CrewId => (g === 'jenna' || g === 'joshu' || g === 'aroha' ? g : 'aroha');
const been = (loc: string) => isIsland(location(loc)) || !!game.save.flags['v12:been:' + loc];
const placeName = (loc: string) => location(loc)?.name ?? loc;

/** the way into a place, in words ("up the stream at the stream mouth crossroads") */
function wayTo(loc: string): string {
  const t = TRAILS.find(q => (q.a.loc === loc && been(q.b.loc)) || (q.b.loc === loc && been(q.a.loc)));
  if (!t) return '';
  const from = t.a.loc === loc ? t.b : t.a;
  const where = isIsland(location(from.loc)) ? (from.loc === 'isle-stream' ? 'from the stream mouth crossroads' : from.loc === 'isle-cave' ? 'from the glowworm cave' : 'at the end of the bush track') : `from ${placeName(from.loc)}`;
  return `${from.arm === 'up' ? 'up the branch ' : from.arm === 'down' ? 'down the branch ' : 'on '}${where}`;
}

function build(kind: GoalKind, id: string): DayGoal | null {
  if (kind === 'quest') {
    const q = QUEST_BY_ID[id];
    const st = q ? currentStep(id) : null;
    if (!q || !st) return null;
    const txt = st.text;
    return { kind, text: txt, who: crewOf(q.giver), line: `Today, let’s see you finish this: ${txt.charAt(0).toLowerCase()}${txt.slice(1)}.`, done: () => currentStep(id)?.text !== txt };
  }
  if (kind === 'gear' || kind === 'points') {
    const t = TRAILS.find(q => q.id === id);
    if (!t?.gate) return null;
    const g = GATES[t.gate], bp = g.bp ? BLUEPRINTS[g.bp] : null;
    if (!bp) return null;
    const to = depthOf(t.a.loc) > depthOf(t.b.loc) ? t.a.loc : t.b.loc;
    const need = gateNeed(t.gate);
    if (kind === 'points') return { kind, text: `Earn ${bp.rp ?? 40} research points (photograph and develop new animals) for the ${bp.name} blueprint: it opens the way to ${placeName(to)}`, who: 'jenna', line: `The ${bp.name} sheet costs ${bp.rp ?? 40} points. Photos, uploads, SCIENCE. Then ${placeName(to)} is ours.`, done: () => (game.save.rp ?? 0) >= (bp.rp ?? 40) || hasBlueprint(bp.id) };
    return {
      kind, text: need === 'craft' ? `Craft the ${bp.name} at Jenna’s bench: it opens the way to ${placeName(to)}` : `Research the ${bp.name} blueprint at the laptop: it opens the way to ${placeName(to)}`,
      who: 'jenna', line: need === 'craft' ? `You’ve got the ${bp.name} sheet. Bring me the bits and I’ll build it. Then: ${placeName(to)}!` : `If we research the ${bp.name}, you can get to ${placeName(to)}. Laptop, Blueprints. Go go go.`,
      done: () => gateOk(t.gate),
    };
  }
  if (kind === 'place') {
    const w = wayTo(id);
    return { kind, text: `Find ${placeName(id)}${w ? ` (${w})` : ''}`, who: 'aroha', line: `${placeName(id)}. You haven’t been yet. ${w ? `Go ${w}.` : ''} Back before dark.`, done: () => been(id) };
  }
  if (kind === 'rare') {
    const r = RARE.find(q => q.species === id);
    const sp = SPECIES_BY_ID[id];
    if (!r || !sp) return null;
    return { kind, text: `Photograph a ${sp.name} at ${placeName(r.loc)}: ${r.goal}`, who: 'jenna', line: `I want a ${sp.name}. ${r.goal.charAt(0).toUpperCase()}${r.goal.slice(1)}. Patience, Doc.`, done: () => !!game.save.seen[id] };
  }
  const base = S().research0;
  return { kind: 'survey', text: 'Research three species you haven’t yet (photograph, then develop at the laptop)', who: 'jenna', line: 'Three new species on my screen by tonight. Photos, then the laptop. Chop chop.', done: () => Object.keys(game.save.research ?? {}).length >= base + 3 };
}

function chooseGoal(): { kind: GoalKind; id: string } {
  // a story or crew quest under way comes first
  const q = trackedQuest();
  if (q && q.id !== 'v10day' && currentStep(q.id)) return { kind: 'quest', id: q.id };
  // the next shut way, nearest camp first, from somewhere Mori has been
  const shut = TRAILS.filter(t => t.gate && !gateOk(t.gate) && GATES[t.gate].bp)
    .map(t => ({ t, from: depthOf(t.a.loc) <= depthOf(t.b.loc) ? t.a.loc : t.b.loc }))
    .filter(x => been(x.from))
    .sort((a, b) => depthOf(a.from) - depthOf(b.from));
  // somewhere new that is open now
  const open = TRAILS.map(t => (depthOf(t.a.loc) <= depthOf(t.b.loc) ? { from: t.a.loc, to: t.b.loc, t } : { from: t.b.loc, to: t.a.loc, t }))
    .filter(x => been(x.from) && !been(x.to) && gateOk(x.t.gate))
    .sort((a, b) => depthOf(a.to) - depthOf(b.to));
  const day = dayNumber();
  if (open.length && (day % 2 === 0 || !shut.length)) return { kind: 'place', id: open[0].to };
  if (shut.length) {
    const t = shut[0].t, g = GATES[t.gate!], bp = BLUEPRINTS[g.bp!];
    const need = gateNeed(t.gate!);
    if (need === 'research' && bp && (game.save.rp ?? 0) < (bp.rp ?? 40)) return { kind: 'points', id: t.id };
    return { kind: 'gear', id: t.id };
  }
  if (open.length) return { kind: 'place', id: open[0].to };
  const rare = RARE.filter(r => been(r.loc) && !game.save.seen[r.species]);
  if (rare.length) return { kind: 'rare', id: rare[day % rare.length].species };
  return { kind: 'survey', id: '' };
}

let cache: { day: number; key: string; g: DayGoal | null } | null = null;
/** today's goal (picked once a day; the notebook's day quest shows it) */
export function todayGoal(): DayGoal | null {
  const s = S();
  if (!s.goal) { s.goal = chooseGoal(); game.persist(); }
  const key = s.goal.kind + ':' + s.goal.id;
  if (!cache || cache.day !== s.day || cache.key !== key) cache = { day: s.day, key, g: build(s.goal.kind, s.goal.id) ?? build('survey', '') };
  return cache.g;
}

setDayGoal(() => todayGoal());

/** at breakfast: whoever has today's job says it, by the fire */
export async function tellGoal(cd: { s: FieldScene }): Promise<void> {
  const g = todayGoal();
  if (!g) return;
  const a = cd.s.actors.get(g.who);
  await floatText(a ? { actor: a, text: g.line, style: 'say', ms: 3600 } : { text: g.line, style: 'say', ms: 3600 });
  floatNotice(`Today: ${g.text}`, 4600);
  if (tooHungryForPhotos()) setTimeout(() => void floatText({ text: 'And eat something first. I can hear your stomach from here.', style: 'happy', ms: 2600, actor: cd.s.actors.get('joshu') }), 1400);
}

/** debug handle: zl.loop */
export const LOOP_ZL = {
  goal: () => todayGoal()?.text ?? null,
  reroll: () => { S().goal = null; cache = null; return todayGoal()?.text ?? null; },
  hunger: HUNGER_ZL,
  trails: TRAILS_ZL,
  state: () => ({ ...S(), hour: hourNow(), phase: dayPhase(), exp: currentExpedition() }),
};
function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (w.zl) w.zl.loop = LOOP_ZL;
  else setTimeout(hookZl, 500);
}
if (typeof window !== 'undefined') hookZl();

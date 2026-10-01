// V10 day loop at camp: wake up, camp life, expedition, return, upload, sleep, next day.
//
// Day 1 (the ship, the storm, the island, making camp) ends on the "Day 1 Complete" card; from then
// on every day runs the same loop at the beach camp:
//
//   morning   Mori wakes in his tent (camp.ts / campscenes.ts), breakfast at the fire, talk to the
//             crew, take requests at the camp board, upgrade gear at Jenna's bench, fish off the rocks,
//             pack at the trail sign and set off (the region map)
//   out       on an expedition (the map module's scenes), or walking the home island
//   evening   back at camp (arriveAtCamp: on foot, by boat, or carried home after a blackout); upload
//             the day's photos, dinner and stories round the fire (the day's finds), a story event
//   night     after dinner: the night talk, lights out, sleep in the tent -> the next morning
//
// This file is the small public API other modules call; the camp scene itself lives in camp*.ts and
// loads lazily. State is in the 'day' bucket of game.save.v10; game.save.day is the day number.

import { game } from '../game';
import { bucket } from './store';
import { onBlackout, refill } from './energy';
import { discoveries } from './regions';

export type Phase = 'morning' | 'out' | 'evening' | 'night';
export type ArriveHow = 'walk' | 'blackout' | 'boat';
/** when in the day a camp event runs */
export type Slot = 'wake' | 'morning' | 'return' | 'dinner' | 'night';

export interface DayState {
  phase: Phase;
  /** the last day whose wake-up has played */
  woke: number;
  /** meal -> the day it was last eaten ('breakfast', 'dinner') */
  meals: Record<string, number>;
  /** where Mori went today (location id), set when he leaves camp */
  went: string | null;
  /** island clock (0 morning .. 4 night) to restore on a reload */
  clock: number;
  /** an arrival that has not finished playing yet (resumed on a reload) */
  arrive: ArriveHow | null;
  /** how Mori came home last, and on which day */
  lastArrive: ArriveHow | null;
  lastArriveDay: number;
  /** crew member -> the day Mori last talked with them */
  talked: Record<string, number>;
  /** crew member -> how many times they have talked (the daily rotation) */
  talks: Record<string, number>;
  /** relationship 0..100 */
  bond: Record<string, number>;
  /** camp event id -> the day it ran */
  events: Record<string, number>;
  /** crew member -> discovery / research ids they have already commented on */
  seen: Record<string, string[]>;
  /** snapshot at dawn, for the day's summary and the evening reactions */
  dawn: { research: number; rp: number; uploads: number; photos: number; fish: number; finds: number };
  /** day Jenna last drew on Mori's face (the blackout penalty), and how many blackouts so far */
  doodle: number;
  blackouts: number;
  /** fish caught off the camp rocks today */
  fishDay: number;
  fishN: number;
  /** fish in the camp larder (Joshu cooks and smokes them) */
  larder: number;
  /** today's meal buff */
  buff: { id: string; day: number } | null;
  /** the last wake-up variant (so two mornings in a row differ) */
  lastWake: string;
  /** finished requests the giver has thanked Mori for (campquests.ts) */
  thanked?: string[];
}

export function dayState(): DayState {
  return bucket<DayState>('day', () => ({
    phase: 'morning', woke: 1, meals: {}, went: null, clock: 0.2, arrive: null, lastArrive: null, lastArriveDay: 0,
    talked: {}, talks: {}, bond: { jenna: 10, joshu: 10, aroha: 4 }, events: {}, seen: {},
    dawn: { research: 0, rp: 0, uploads: 0, photos: 0, fish: 0, finds: 0 },
    doodle: 0, blackouts: 0, fishDay: 0, fishN: 0, larder: 0, buff: null, lastWake: '',
  }));
}

/** the day being played (Day 1 runs until its end card; then 2, 3, ...) */
export function dayNumber(): number { return Math.max(1, game.save.day || 1); }
/** Day 2 or later: the camp day loop is running */
export const loopStarted = () => !!game.save.flags['v4:day1'];
export function dayPhase(): Phase { return dayState().phase; }

export function setPhase(p: Phase) {
  const d = dayState();
  if (d.phase === p) return;
  d.phase = p;
  game.persist();
  for (const f of phaseFns) try { f(p); } catch (e) { console.warn('[day] phase hook', e); }
}

/** Mori sets off from camp (the pack screen calls this before the region map; the map module may too) */
export function leaveCamp(locId: string | null = null) {
  const d = dayState();
  d.went = locId ?? d.went;
  setPhase('out');
}

// ---------------------------------------------------------------- relationships
export type Crew = 'jenna' | 'joshu' | 'aroha';
export const CREW: Crew[] = ['jenna', 'joshu', 'aroha'];
export function bond(who: Crew): number { return dayState().bond[who] ?? 0; }
export function addBond(who: Crew, n: number) {
  const d = dayState();
  d.bond[who] = Math.max(0, Math.min(100, (d.bond[who] ?? 0) + n));
  game.persist();
}
/** 0 new, 1 friendly, 2 close, 3 family */
export function bondTier(who: Crew): 0 | 1 | 2 | 3 {
  const b = bond(who);
  return b >= 80 ? 3 : b >= 45 ? 2 : b >= 20 ? 1 : 0;
}

// ---------------------------------------------------------------- hooks for other modules
type DayFn = (day: number) => void;
type ArriveFn = (how: ArriveHow, day: number) => void | Promise<void>;
const dayFns: DayFn[] = [];
const arriveFns: ArriveFn[] = [];
const phaseFns: ((p: Phase) => void)[] = [];
/** a new morning starts (after the night's sleep, before the wake-up plays) */
export function onNewDay(fn: DayFn) { dayFns.push(fn); }
/** Mori is back at camp (runs inside the arrival cutscene, before the crew greets him) */
export function onArrive(fn: ArriveFn) { arriveFns.push(fn); }
export function onPhase(fn: (p: Phase) => void) { phaseFns.push(fn); }
export const _hooks = { dayFns, arriveFns };

/** what a camp event gets to work with (the camp scene's helpers; see campday.ts) */
export interface CampCtx {
  /** the island story (IsleStory: say, cut, pan, place, props...) */
  st: unknown;
  /** the camp day controller (CampDay: seat everyone at the fire, crew brains, props...) */
  camp: unknown;
  day: number;
}
/**
 * A special story event at camp. The camp runs at most one per slot each day, the highest `prio`
 * whose `when()` holds; `once` events (the default) never repeat. Other modules (the boat repair
 * milestones, the village) can add their own.
 */
export interface CampEvent {
  id: string;
  slot: Slot;
  prio?: number;
  once?: boolean;
  when(): boolean;
  run(ctx: CampCtx): Promise<void>;
}
export const CAMP_EVENTS: CampEvent[] = [];
export function addCampEvent(ev: CampEvent) {
  const i = CAMP_EVENTS.findIndex(e => e.id === ev.id);
  if (i >= 0) CAMP_EVENTS[i] = ev; else CAMP_EVENTS.push(ev);
}
export const eventDone = (id: string) => dayState().events[id] !== undefined;

// ---------------------------------------------------------------- the clock on a reload
/** where the sun should be when the island loads for a Day 2+ save (islestory's dayTimeForSave) */
export function campDayTime(): number {
  const d = dayState();
  if (dayNumber() <= 1) return 3.96;
  if (d.arrive) return d.arrive === 'blackout' ? 3.12 : 2.7;
  if (d.woke < dayNumber()) return 0.05;
  const t = d.clock;
  if (d.phase === 'morning') return Math.min(Math.max(t, 0.1), 2.4);
  if (d.phase === 'out') return Math.min(Math.max(t, 0.6), 3.2);
  if (d.phase === 'evening') return Math.min(Math.max(t, 2.5), 3.7);
  return Math.max(t, 3.75);
}

// ---------------------------------------------------------------- arrivals
let arriving: Promise<void> | null = null;

/** called by the expedition module when Mori is back at camp (after it loaded the camp scene) */
export async function arriveAtCamp(how: 'walk' | 'blackout' | 'boat'): Promise<void> {
  if (arriving) return arriving;
  const d = dayState();
  d.arrive = how;
  game.persist();
  arriving = (async () => {
    try {
      const m = await import('./camparrive');
      await m.playArrival(how);
    } catch (e) {
      console.error('[day] arrival failed', e);
      d.arrive = null;
      setPhase('evening');
    }
  })().finally(() => { arriving = null; });
  return arriving;
}

// ---------------------------------------------------------------- blackouts
// Energy ran out (energy.ts fires this once): Mori collapses where he is, and Aroha carries him home.
let collapsing = false;
onBlackout(() => { void blackout(); });
async function blackout() {
  if (collapsing || arriving || dayState().arrive) return;
  collapsing = true;
  try {
    const m = await import('./camparrive');
    await m.collapse();
    const ex = await import('./expedition');
    if (ex.currentExpedition()) {
      // the expedition module takes Mori home and calls arriveAtCamp('blackout') once the camp is loaded
      await ex.returnToCamp('blackout');
      await new Promise(r => setTimeout(r, 300));
    }
    // (nobody did: on the home island, or the expedition module left it to us)
    if (!arriving && !dayState().arrive && !(dayState().lastArrive === 'blackout' && dayState().lastArriveDay === dayNumber())) await arriveAtCamp('blackout');
    else if (arriving) await arriving;
  } finally {
    collapsing = false;
  }
}

/** start the next day: the day number, the energy refill, the dawn snapshot (the scene reloads after) */
export async function startNextDay() {
  const s = game.save, d = dayState();
  s.day = Math.max(2, dayNumber() + 1);
  if (!s.flags['v4:day1']) s.flags['v4:day1'] = true;
  d.phase = 'morning';
  d.went = null;
  d.arrive = null;
  d.clock = 0.08;
  d.buff = null;
  d.dawn = { research: Object.keys(s.research ?? {}).length, rp: s.totalRp, uploads: s.uploads.length, photos: s.vars['v10:photosTaken'] ?? 0, fish: s.vars['v4:fishCaught'] ?? 0, finds: 0 };
  try { d.dawn.finds = discoveries().length; } catch { /* no atlas yet */ }
  try { refill(); } catch (e) { console.warn('[day] refill', e); }
  for (const f of dayFns) try { f(s.day); } catch (e) { console.warn('[day] new day hook', e); }
  game.persist();
}

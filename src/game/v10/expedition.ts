// V10 expedition flow, V12 edition: there is no fast travel. Mori walks out of camp along the beach
// (loop.ts starts the trip), walks the trails between places (src/game/v12/trails.ts: walk off a
// scene's edge or take a branch at a signposted crossroads), and comes home on foot, by boat, or carried
// by Aroha (starving, or still out after dark). While out, an expedition clock runs: every trail takes
// hours, exploring takes time, and each scene opens at the time of day the clock has reached.
// The per-scene runtime (map reveal, finds, swimming, hazards, events) is in field10.ts;
// FieldScene.enter() hands every scene to onFieldEnter(). State: game.save.v10.expedition.

import { game } from '../game';
import type { FieldScene, FieldSite } from '../scenes/field';
import type { TimeOfDay } from '../../world/timeofday';
import { bucket } from './store';
import { location, tripCost, homeCost, findLocation } from './regions';
import type { LocationDef } from './regions';
import type { RouteDef } from './atlas';
import { arriveAtCamp, dayNumber, dayState } from './day';
import * as Energy from './energy';
import { energy, spend } from './energy';
import { fx10 } from './skills10';
import { regionOf } from '../v12/region';

export type ReturnHow = 'walk' | 'blackout' | 'boat';

/**
 * Physical effort (a route, a long walk): the energy module's effort() scales it by Field Skills, the
 * pack's weight and the place's difficulty; with an older energy module, just the skill multiplier.
 */
export function effortSpend(n: number, why: string) {
  if (!(n > 0)) return;
  const ef = (Energy as unknown as { effort?: (n: number, why: string) => void }).effort;
  if (ef) ef(n, why); else spend(n * fx10.energyMult(), why);
}

interface TripLog { day: number; locs: string[]; how: ReturnHow; back: number }
interface ExpState {
  cur: string | null;
  /** the expedition clock, in hours (7.5 = half past seven in the morning) */
  hour: number;
  /** places visited on this trip, in order */
  trail: string[];
  /** the way being travelled (the next scene marks it on the map) */
  pend: { from: string; to: string } | null;
  day: number;
  /** hour Mori got back to camp last time */
  back: number;
  trips: TripLog[];
}
const E = () => bucket<ExpState>('expedition', () => ({ cur: null, hour: 7.5, trail: [], pend: null, day: 0, back: 0, trips: [] }));

/** where Mori stands when he walks back into camp */
export const CAMP_X = 1960;

/** the location being explored, or null at camp */
export function currentExpedition(): string | null { return E().cur; }
/** the expedition clock (hours, 0..24+) */
export function expeditionHour(): number { return E().hour; }
/** places visited on the current (or last) trip */
export function tripTrail(): string[] { return [...E().trail]; }
/** hour Mori got back to camp after the last trip (0 = no trip yet) */
export function lastReturnHour(): number { return E().back; }
/** the last few trips (for the day's report) */
export function tripLog(): TripLog[] { return E().trips; }
/** the camp module can set the hour the next trip leaves at (default half past seven) */
export function setDepartureHour(h: number) { game.save.vars['v10:hour'] = h; }
/** time passes on the expedition (exploring, waiting out the rain, a detour) */
export function passTime(hours: number) { const s = E(); if (s.cur) s.hour += hours; }

export function todAt(h: number): TimeOfDay {
  const t = ((h % 24) + 24) % 24;
  if (t < 5.5) return 'night';
  if (t < 8) return 'dawn';
  if (t < 17) return 'day';
  if (t < 19.5) return 'dusk';
  return 'night';
}
export function clockText(h = E().hour): string {
  const t = ((h % 24) + 24) % 24, hh = Math.floor(t), mm = Math.floor((t - hh) * 60 / 15) * 15;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ scenes
const tags = new WeakMap<object, string>();
/** remember which location a scene (or a site definition) plays */
export function tagScene(o: object, loc: string) { tags.set(o, loc); }
export const sceneTag = (o: object | null | undefined) => (o ? tags.get(o) ?? null : null);

/** the island scene (camp + the shore) is a FieldScene as wide as the island */
export function isIslandScene(s: unknown): s is FieldScene {
  const f = s as FieldScene | null;
  return !!f && !!f.site && f.site.noExit === true && f.site.width === 6900;
}
export function isFieldScene(s: unknown): s is FieldScene {
  const f = s as FieldScene | null;
  return !!f && !!f.site && !!f.player && typeof f.site.build === 'function';
}

/** a site definition by id: the V2 sites, the deep, and the V10 sites */
export async function siteDef(id: string): Promise<FieldSite | null> {
  const s2 = await import('../sites2');
  if (id === 'deep') return s2.COAST_DEEP;
  const v2 = (s2.SITES2 as Record<string, FieldSite>)[id];
  if (v2) return v2;
  const s10 = await import('../sites10');
  return (s10.SITES10[id] as unknown as FieldSite) ?? null;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** wait for a running scene change to finish (game.go ignores calls while one is in progress) */
async function idle(ms = 12000) {
  const t0 = performance.now();
  while ((game as unknown as { busy: boolean }).busy && performance.now() - t0 < ms) await sleep(50);
}
async function waitFor(pred: (s: unknown) => boolean, ms = 20000) {
  const t0 = performance.now();
  while (!pred(game.scene) && performance.now() - t0 < ms) await sleep(60);
  await idle(ms);
}

/** V12 walking transitions use the renderer's short dithered fade instead of the journal page */
export type LoadStyle = 'page' | 'walk';

async function loadLocation(L: LocationDef, enter?: number, style: LoadStyle = 'page') {
  await idle();
  const { setNextTransition } = await import('../../ui/v11/paper/transition');
  if (L.scene.type === 'island') {
    if (style === 'walk') setNextTransition('dissolve');
    return islandAt(enter ?? L.scene.x, style);
  }
  if (L.scene.type === 'custom') {
    if (style === 'walk') setNextTransition('dissolve');
    return L.scene.go(enter);
  }
  const def = await siteDef(L.scene.type === 'ocean' ? 'deep' : L.scene.site);
  if (!def) { console.warn('no scene for', L.id); return; }
  const site = enter !== undefined ? { ...def, spawnX: enter } : def;
  const tod = todAt(E().hour);
  const { FieldScene } = await import('../scenes/field');
  // V11: setting off turns the journal's page to the place you're going (V12: walking in, a short fade)
  if (style === 'walk') setNextTransition('dissolve');
  else setNextTransition('page', { title: L.name, sub: L.sub });
  await game.go(() => { const f = new FieldScene(site, tod); tagScene(f, L.id); return f; }, [0, 0, 0], style === 'walk' ? 3.2 : 2.2);
}

/** the island: walk along the beach (same scene) or load it with Mori at x */
async function islandAt(x: number, style: LoadStyle = 'page') {
  const sc = game.scene;
  if (isIslandScene(sc)) { await shoreWalk(sc, x); return; }
  game.save.vars['v9:px'] = x;
  // V12: the beach opens at the hour the trail brought Mori back at
  if (style === 'walk' && E().cur) {
    const { clockForHour } = await import('../v11/forest');
    dayState().clock = +clockForHour(E().hour).toFixed(3);
  }
  const { goIsland } = await import('../v4/islandflow');
  await goIsland();
  await waitFor(isIslandScene);
}

/** a jump along the shore inside the island scene: fade, move, fade (V12: only the carry-home and
 *  debug use it; Mori walks the beach himself) */
async function shoreWalk(f: FieldScene, x: number) {
  if (Math.abs(f.player.x - x) < 40) return;
  f.cutscene = true;
  await game.fadeTo(1, 2.4);
  const p = f.player;
  p.x = x;
  p.y = f.st.terrain.surfaceBelow(x, -400)?.y ?? f.st.terrain.groundY(x);
  p.vx = p.vy = 0;
  p.state = 'normal';
  f.snapCamera();
  game.save.vars['v9:px'] = Math.round(x);
  await sleep(250);
  f.cutscene = false;
  await game.fadeTo(0, 1.8);
}

// ------------------------------------------------------------------ leaving and coming home
let busy = false;

/** V12: a trip starts when Mori walks out of camp (loop.ts), at the hour the island clock says */
export function beginTrip(locId: string, hour: number) {
  const s = E();
  if (s.cur !== null) return;
  s.hour = hour;
  s.trail = [locId];
  s.day = dayNumber();
  s.cur = locId;
  s.pend = null;
  game.persist();
}
/** V12: the island clock is the clock while Mori is on the beach (loop.ts keeps them together) */
export function setExpeditionHour(h: number) { const s = E(); if (s.cur) s.hour = h; }

/**
 * Go to a location. V12: there is no fast travel. Mori walks the trails (src/game/v12/trails.ts calls
 * this with `hours` for the trail and style 'walk'); `route` is the old way deeper; with neither (the
 * boat, the debug panel) the old known-trail cost applies, hours only. `at`: arrive at that world x.
 */
export async function goExpedition(locId: string, o: { route?: RouteDef; from?: string; at?: number; hours?: number; startHour?: number; style?: LoadStyle } = {}): Promise<void> {
  if (busy) return;
  const L = location(locId);
  if (!L) return;
  busy = true;
  try {
    const s = E();
    const fromCamp = s.cur === null;
    if (fromCamp) {
      s.hour = o.startHour ?? game.save.vars['v10:hour'] ?? 7.5;
      s.trail = [];
      s.day = dayNumber();
    }
    if (o.route && o.from) {
      s.hour += o.route.hours;
      s.pend = { from: o.from, to: locId };
    } else if (o.hours !== undefined) {
      s.hour += o.hours;
      s.pend = o.from ? { from: o.from, to: locId } : null;
    } else if (fromCamp && locId !== 'camp') {
      const t = tripCost(locId);
      if (t) s.hour += t.hours;
      s.pend = null;
    }
    s.cur = locId === 'camp' ? null : locId;
    if (s.cur && !s.trail.includes(locId)) s.trail.push(locId);
    game.persist();
    await loadLocation(L, o.route?.enter ?? o.at, o.style ?? 'page');
  } finally {
    busy = false;
  }
}

/** called by field10 when a scene opens: keep the state right whichever way Mori got here */
export function arrivedAt(locId: string) {
  const s = E();
  if (s.cur !== locId) {
    if (s.cur === null) { s.hour = game.save.vars['v10:hour'] ?? 7.5; s.trail = []; s.day = dayNumber(); }
    s.cur = locId;
  }
  if (!s.trail.includes(locId)) s.trail.push(locId);
  const pend = s.pend;
  s.pend = null;
  return pend;
}

/** a stroll that never really left camp: no trip after all (no arrival, nothing spent) */
export function endTrip() {
  const s = E();
  s.cur = null;
  s.pend = null;
}

let returning = false;
let pendingHow: ReturnHow = 'walk';

/**
 * Back to the camp scene; the day module plays the arrival cutscene for `how`. V12: 'walk' is Mori
 * walking into camp along the beach (no jump), 'blackout' is Aroha carrying him home (the hours
 * of the walk home pass), 'boat' is the Kitten bringing him back.
 */
export async function returnToCamp(how: ReturnHow): Promise<void> {
  if (returning) { if (how === 'blackout') pendingHow = 'blackout'; return; }
  returning = true;
  pendingHow = how;
  try {
    const s = E();
    const loc = s.cur;
    const sc = game.scene;
    const x = isFieldScene(sc) ? sc.player.x : 0;
    if (loc) {
      const onBeach = isIslandScene(sc);
      // (in a region scene the place's own x: src/game/v12/region.ts)
      const hc = homeCost(loc, x - (regionOf(loc)?.part.x0 ?? 0));
      if (pendingHow === 'blackout') s.hour += hc.hours * 1.4;
      else if (!onBeach) s.hour += hc.hours;
      s.trips.push({ day: s.day || dayNumber(), locs: [...s.trail], how: pendingHow, back: s.hour });
      if (s.trips.length > 20) s.trips.splice(0, s.trips.length - 20);
    }
    s.cur = null;
    s.pend = null;
    s.back = s.hour;
    findLocation('camp');
    game.persist();
    await idle();
    if (isIslandScene(game.scene)) { if (Math.abs(game.scene.player.x - CAMP_X) > 420) await shoreWalk(game.scene, CAMP_X); }
    else {
      game.save.vars['v9:px'] = CAMP_X;
      const { goIsland } = await import('../v4/islandflow');
      await goIsland();
      await waitFor(isIslandScene);
    }
    await arriveAtCamp(pendingHow);
  } finally {
    returning = false;
  }
}

// ------------------------------------------------------------------ the blackout
// (The camp module's day.ts owns the blackout listener: it plays the collapse, calls
// returnToCamp('blackout') and the carry-home arrival. V12: unused here; kept for reference.)

/** Mori folds up on the trail; Aroha (when she's along) runs to him; fade to black */
async function collapse(f: FieldScene, onTheWayHome: boolean) {
  f.cutscene = true;
  try { f.cam?.raise(false); } catch { /* no camera */ }
  const p = f.player;
  p.cancelWork();
  p.vx = 0;
  p.body.setExpr('tired');
  p.poseOverride = 'tired';
  game.ui.toast(onTheWayHome ? 'Too tired for the long walk home...' : 'Out of energy...', 'ENERGY', 'coral', 3000);
  await sleep(900);
  p.poseOverride = 'fallBack';
  await sleep(500);
  p.poseOverride = 'unconscious';
  p.body.setExpr('sleep');
  f.st.shake(2, 0.3);
  const g = f.guide?.a ?? (f.actors.get('aroha')?.visible ? f.actors.get('aroha') : null);
  if (g) {
    g.walkTo(p.x - p.facing * 16, 150, 'run');
    const { tr } = await import('./translator');
    void f.say([{ who: 'aroha', ...tr('Mori? MORI! Hold on. I’ve got you. I’ve got you.', { shout: true }), expr: 'scared', close: false, auto: 1600 } as never]);
  }
  await sleep(1300);
  await game.fadeTo(1, 0.9);
  p.poseOverride = null;
}

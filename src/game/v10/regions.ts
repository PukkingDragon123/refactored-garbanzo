// V10 region atlas: locations, discoveries and the explored map. Other modules register locations and
// report discoveries through it; the Region Map (src/ui/v10/regionmap.ts) draws it. Each location's
// scene runs along a path on the map (world x0..x1 -> the polyline in atlas.ts); walking a stretch
// physically marks its bins explored (revealMap), which lifts the fog around it. Found locations are
// fast-travel points. State lives in game.save.v10.regions.

import { game } from '../game';
import { bucket } from './store';
import { dayNumber } from './day';
import { ATLAS, ISLE_W } from './atlas';
import type { RouteDef } from './atlas';

export type Region10 = 'home' | 'interior' | 'south' | 'east' | 'ocean' | 'isle2';
export type LocKind = 'camp' | 'site' | 'village' | 'ruin' | 'cave' | 'fossil' | 'ecosystem' | 'ocean' | 'island';
export type DiscoveryKind = 'species' | 'plant' | 'village' | 'ruin' | 'artifact' | 'cave' | 'fossil' | 'ecosystem' | 'location' | 'landmark' | 'sample';

export interface LocationDef {
  id: string;
  name: string;
  region: Region10;
  kind: LocKind;
  /** position on the region map, 0..1 */
  pos: [number, number];
  /** how it is played: a V2 FieldScene site, a stretch of the home island, the sea, or a custom scene */
  scene: { type: 'site'; site: string; depth?: number } | { type: 'island'; x: number } | { type: 'ocean' } | { type: 'custom'; go: () => Promise<void> };
  /** 1..5: how hard the route is (energy, climbing, swimming, hazards) */
  difficulty: number;
  /** flags needed before it can be reached (e.g. 'v10:boat') */
  needs?: string[];
  desc: string;
  // ---- V10 map extensions (all optional; see atlas.ts)
  /** te reo name / subtitle */
  sub?: string;
  /** the scene's walk on the map (0..1 points); world x runs along it */
  path?: [number, number][];
  /** world x of each path point (default: spread evenly over xr) */
  knots?: number[];
  /** world x range the path covers (default 0..2400) */
  xr?: [number, number];
  /** ways in ("go deeper" from a shallower place) */
  routes?: RouteDef[];
  /** found from the start */
  known?: boolean;
  /** shown as "???" until found */
  secret?: boolean;
  /** a fixed trip from camp (boat destinations: no trail, the Kitten takes you), hours and energy each way */
  trip?: { hours: number; energy: number };
  /** terrain words for the map card */
  terrain?: string;
}

export interface Discovery {
  id: string;
  kind: DiscoveryKind;
  name: string;
  loc: string;
  /** world x within the location (for the map note) */
  x?: number;
  day: number;
  note?: string;
  /** V10 map: icon id (a species or an item) */
  icon?: string;
}

/** a hand-inked note on the map (events, Aroha's place names); not a research discovery */
export interface MapNote { id: string; loc: string; x: number; text: string; day: number; glyph?: string }

export const LOCATIONS: LocationDef[] = [];
export function addLocation(d: LocationDef) { if (!LOCATIONS.some(l => l.id === d.id)) LOCATIONS.push(d); }
export function location(id: string) { return LOCATIONS.find(l => l.id === id) ?? null; }
for (const d of ATLAS) addLocation(d);

// ------------------------------------------------------------------ state
/** explored bins along each location's path */
export const BINS = 48;
interface RegionState {
  found: Record<string, number>;
  disc: Discovery[];
  /** location -> explored bins as a '0'/'1' string */
  seen: Record<string, string>;
  /** 'from>to' -> day first travelled */
  routes: Record<string, number>;
  /** location -> day first heard of */
  rumour: Record<string, number>;
  notes: MapNote[];
  /** where Mori was last (for "you are here") */
  last: { loc: string; x: number } | null;
  migrated?: number;
}
const S = (): RegionState => {
  const s = bucket<RegionState>('regions', () => ({ found: {}, disc: [], seen: {}, routes: {}, rumour: {}, notes: [], last: null }));
  if (!s.migrated) migrate(s);
  return s;
};

type Listener = () => void;
const listeners = new Set<Listener>();
/** the map UI redraws when anything changes */
export function onMapChange(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
function changed() { for (const f of listeners) { try { f(); } catch (e) { console.warn(e); } } }

let persistT = 0;
/** save soon (exploring changes the map every second; localStorage gets one write every few seconds) */
function persistSoon() {
  if (persistT) return;
  persistT = window.setTimeout(() => { persistT = 0; game.persist(); }, 4000);
}

/** older saves: the V4 story already walked the shore (wake up, the wreck, the seal, the cove, the bush track) */
function migrate(s: RegionState) {
  s.migrated = 1;
  const f = game.save.flags;
  const all = '1'.repeat(BINS);
  const mark = (id: string) => { s.found[id] ??= 1; s.seen[id] = all; };
  if (f['v4:isleWoke']) { mark('camp'); mark('isle-wreck'); }
  if (f['v4:split']) { mark('isle-grove'); mark('isle-stream'); }
  if (f['v4:sealDone']) mark('isle-seals');
  if (f['v4:shoes']) mark('isle-cave');
  if (f['v4:joshuFound']) mark('isle-track');
}

// ------------------------------------------------------------------ locations
/** discovered = a fast-travel point */
export function isFound(locId: string): boolean {
  const l = location(locId);
  return !!l && (!!l.known || !!S().found[locId]);
}
export function foundDay(locId: string): number { return S().found[locId] ?? 0; }

/** record a newly reached location (the map pins it as a fast-travel point); returns true the first time */
export function findLocation(locId: string): boolean {
  const l = location(locId);
  const s = S();
  if (!l || s.found[locId]) return false;
  s.found[locId] = dayNumber();
  delete s.rumour[locId];
  discover({ id: 'loc:' + locId, kind: 'location', name: l.name, loc: locId, note: l.sub }, true);
  changed();
  game.persist();
  return true;
}

/** places with a fixed trip (the boat's destinations) go on the map as soon as their flags are set */
export function syncReachable(): void {
  for (const l of LOCATIONS) {
    if (!l.trip || isFound(l.id)) continue;
    if ((l.needs ?? []).every(f => !!game.save.flags[f])) findLocation(l.id);
  }
}

/** heard of a place (Aroha, a villager, a carving): a "?" on the map */
export function rumour(locId: string): boolean {
  const s = S();
  if (isFound(locId) || s.rumour[locId]) return false;
  s.rumour[locId] = dayNumber();
  changed();
  persistSoon();
  return true;
}
export const isRumoured = (locId: string) => !!S().rumour[locId] && !isFound(locId);

/** the route between two places has been travelled (drawn on the map) */
export function markRoute(from: string, to: string) {
  const s = S(), k = from + '>' + to;
  if (s.routes[k]) return;
  s.routes[k] = dayNumber();
  changed();
  persistSoon();
}
export const routeTravelled = (from: string, to: string) => !!S().routes[from + '>' + to];
export const travelledRoutes = (): [string, string][] => Object.keys(S().routes).map(k => k.split('>') as [string, string]);

// ------------------------------------------------------------------ discoveries
/** record a discovery (also draws a note on the map); returns true the first time */
export function discover(d: Omit<Discovery, 'day'>, quiet = false): boolean {
  const s = S();
  if (s.disc.some(x => x.id === d.id)) return false;
  s.disc.push({ ...d, day: dayNumber() });
  if (!quiet && game.ui) game.ui.toast(`Map: <b>${d.name}</b> noted${d.kind === 'species' ? '' : ` (${KIND_WORD[d.kind]})`}.`, 'MAP', 'teal', 2600);
  changed();
  persistSoon();
  return true;
}
const KIND_WORD: Record<DiscoveryKind, string> = {
  species: 'wildlife', plant: 'plant', village: 'village', ruin: 'ruin', artifact: 'artifact', cave: 'cave', fossil: 'fossil',
  ecosystem: 'ecosystem', location: 'place', landmark: 'landmark', sample: 'sample',
};
export function discoveries(): Discovery[] { return S().disc; }
export const hasDiscovery = (id: string) => S().disc.some(d => d.id === id);
export const discoveriesAt = (locId: string) => S().disc.filter(d => d.loc === locId);

/** an ink note on the map; returns true the first time */
export function addNote(n: Omit<MapNote, 'day'>): boolean {
  const s = S();
  if (s.notes.some(x => x.id === n.id)) return false;
  s.notes.push({ ...n, day: dayNumber() });
  changed();
  persistSoon();
  return true;
}
export const mapNotes = (): MapNote[] => S().notes;

// ------------------------------------------------------------------ the explored map
export function xRange(l: LocationDef): [number, number] {
  return l.xr ?? (l.scene.type === 'island' ? [0, ISLE_W] : [0, 2400]);
}

/** mark world x0..x1 of a location as physically explored (fog lifts on the map) */
export function revealMap(locId: string, x0: number, x1: number): void {
  const l = location(locId);
  if (!l || !l.path) return;
  const [a, b] = xRange(l);
  const lo = Math.max(a, Math.min(x0, x1)), hi = Math.min(b, Math.max(x0, x1));
  if (hi < lo) return;
  const s = S();
  const bins = (s.seen[locId] ?? '0'.repeat(BINS)).split('');
  let any = false;
  const i0 = Math.max(0, Math.floor(((lo - a) / (b - a)) * BINS)), i1 = Math.min(BINS - 1, Math.floor(((hi - a) / (b - a)) * BINS));
  for (let i = i0; i <= i1; i++) if (bins[i] !== '1') { bins[i] = '1'; any = true; }
  if (!any) return;
  s.seen[locId] = bins.join('');
  changed();
  persistSoon();
}
/** explored bins of a location (true = seen) */
export function seenBins(locId: string): boolean[] {
  const s = S().seen[locId];
  return Array.from({ length: BINS }, (_, i) => !!s && s[i] === '1');
}
/** 0..1 how much of a location has been walked */
export function explored(locId: string): number {
  const s = S().seen[locId];
  return s ? s.split('').filter(c => c === '1').length / BINS : 0;
}

/** where world x of a location lies on the map (0..1) */
export function mapPoint(locId: string, x: number): [number, number] {
  const l = location(locId);
  if (!l) return [0.5, 0.5];
  const p = l.path;
  if (!p || p.length < 2) return l.pos;
  const [a, b] = xRange(l);
  const knots = l.knots && l.knots.length === p.length ? l.knots : p.map((_, i) => a + ((b - a) * i) / (p.length - 1));
  if (x <= knots[0]) return p[0];
  for (let i = 1; i < p.length; i++) {
    if (x <= knots[i]) {
      const t = (x - knots[i - 1]) / Math.max(1e-6, knots[i] - knots[i - 1]);
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
    }
  }
  return p[p.length - 1];
}
/** map point of a path bin's centre */
export function binPoint(locId: string, i: number): [number, number] {
  const l = location(locId);
  if (!l) return [0.5, 0.5];
  const [a, b] = xRange(l);
  return mapPoint(locId, a + ((i + 0.5) / BINS) * (b - a));
}

/** last place Mori stood (the map's "you are here") */
export function setLastPos(loc: string, x: number) { S().last = { loc, x }; }
export const lastPos = () => S().last;

// ------------------------------------------------------------------ travel costs
/** the island stretches all hang off camp (one long beach) */
export const isIsland = (l: LocationDef | null) => l?.scene.type === 'island';

export interface Leg { from: string; to: string; route: RouteDef }
/** the shortest known chain of ways from camp to a location (null if it can't be reached yet) */
export function routeChain(locId: string, knownOnly = true): Leg[] | null {
  if (locId === 'camp') return [];
  const target = location(locId);
  if (!target) return null;
  if (isIsland(target)) return [];
  // breadth-first over the ways in, starting from every island stretch (they're all a walk from camp)
  const prev = new Map<string, Leg | null>();
  const q: string[] = [];
  for (const l of LOCATIONS) if (isIsland(l) && (!knownOnly || isFound(l.id) || l.id === 'camp')) { prev.set(l.id, null); q.push(l.id); }
  while (q.length) {
    const cur = q.shift()!;
    if (cur === locId) break;
    for (const l of LOCATIONS) {
      if (prev.has(l.id) || (knownOnly && !isFound(l.id))) continue;
      const r = l.routes?.find(rt => rt.from === cur);
      if (!r) continue;
      prev.set(l.id, { from: cur, to: l.id, route: r });
      q.push(l.id);
    }
  }
  if (!prev.has(locId)) return null;
  const legs: Leg[] = [];
  for (let c = prev.get(locId); c; c = prev.get(c.from) ?? null) legs.unshift(c);
  return legs;
}

/** walking distance along the beach from camp to an island x, as hours and energy */
export function beachCost(x: number): { hours: number; energy: number } {
  const d = Math.abs(x - 1980);
  return { hours: Math.round((d / 2400) * 4) / 4, energy: Math.round(d / 950) };
}

export interface Trip { hours: number; energy: number; legs: Leg[] }
/** fast travel from camp along the known trail (a known way is quicker than finding it) */
export function tripCost(locId: string): Trip | null {
  const l = location(locId);
  if (!l) return null;
  if (isIsland(l)) return { ...beachCost((l.scene as { x: number }).x), legs: [] };
  if (l.trip) return { ...l.trip, legs: [] };
  const legs = routeChain(locId);
  if (!legs) return null;
  const first = location(legs[0]?.from ?? 'camp');
  const beach = first && isIsland(first) ? beachCost(legs[0].route.at) : { hours: 0, energy: 0 };
  const h = legs.reduce((a, g) => a + g.route.hours, 0), e = legs.reduce((a, g) => a + g.route.energy, 0);
  return { hours: Math.max(0.5, Math.round((beach.hours + h * 0.7) * 2) / 2), energy: Math.round(beach.energy + e * 0.35), legs };
}
/** the walk home from a location at world x */
export function homeCost(locId: string, x = 0): { hours: number; energy: number } {
  const l = location(locId);
  if (!l) return { hours: 0, energy: 0 };
  if (isIsland(l)) return beachCost(x || (l.scene as { x: number }).x);
  if (l.trip) return { ...l.trip };
  const legs = routeChain(locId, false) ?? [];
  const first = location(legs[0]?.from ?? 'camp');
  const beach = first && isIsland(first) ? beachCost(legs[0].route.at) : { hours: 0, energy: 0 };
  const h = legs.reduce((a, g) => a + g.route.hours, 0), e = legs.reduce((a, g) => a + g.route.energy, 0);
  return { hours: Math.max(0.5, Math.round((beach.hours + h * 0.7) * 2) / 2), energy: Math.round(beach.energy + e * 0.25) };
}

/** which island location a world x of the home island belongs to */
export function islandLocAt(x: number): string {
  for (const l of LOCATIONS) {
    if (!isIsland(l)) continue;
    const [a, b] = xRange(l);
    if (x >= a && x < b) return l.id;
  }
  return x < 0 ? 'isle-wreck' : 'isle-track';
}

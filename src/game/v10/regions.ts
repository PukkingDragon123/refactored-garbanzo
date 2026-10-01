// V10 region atlas: locations, discoveries and the explored map. (Contract stub: the map module
// fills this in; other modules register locations and report discoveries through it.)

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
}

export const LOCATIONS: LocationDef[] = [];
export function addLocation(d: LocationDef) { if (!LOCATIONS.some(l => l.id === d.id)) LOCATIONS.push(d); }
export function location(id: string) { return LOCATIONS.find(l => l.id === id) ?? null; }
/** discovered = a fast-travel point */
export function isFound(locId: string): boolean { void locId; return false; }
export function findLocation(locId: string): void { void locId; }
/** record a discovery (also draws a note on the map); returns true the first time */
export function discover(d: Omit<Discovery, 'day'>): boolean { void d; return false; }
export function discoveries(): Discovery[] { return []; }
/** mark world x0..x1 of a location as physically explored (fog lifts on the map) */
export function revealMap(locId: string, x0: number, x1: number): void { void locId; void x0; void x1; }

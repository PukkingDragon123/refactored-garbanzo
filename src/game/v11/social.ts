// V11 contract: relationships with everyone (crew, villagers, rangers, researchers, hunters...).
// The NPC/relationships module owns the real implementation (people registry, gifts, side quests,
// optional light romance with adults only); other modules only call this API. Crew bond from
// src/game/v10/day.ts (bond/addBond) stays the source for the four crew members.
import { game } from '../game';
import { bucket } from '../v10/store';

export interface PersonDef {
  id: string;
  name: string;
  /** e.g. 'crew' | 'village' | 'ranger' | 'researcher' | 'hunter' | 'craft' */
  group: string;
  /** adults only can ever be romance options */
  adult: boolean;
  romanceable?: boolean;
}
export const PEOPLE: Record<string, PersonDef> = {};
export function definePerson(d: PersonDef): PersonDef { PEOPLE[d.id] = d; return d; }

const S = () => bucket('social', () => ({ aff: {} as Record<string, number>, met: {} as Record<string, number>, partner: null as string | null }));
type SocialFn = (id: string, delta: number, why: string) => void;
const fns: SocialFn[] = [];

/** affinity 0..100 */
export function affinity(id: string): number { return S().aff[id] ?? 0; }
export function addAffinity(id: string, n: number, why = ''): void {
  const s = S();
  s.aff[id] = Math.max(0, Math.min(100, (s.aff[id] ?? 0) + n));
  for (const f of fns.slice()) { try { f(id, n, why); } catch (e) { console.error(e); } }
  game.persist();
}
export function meet(id: string): void { const s = S(); if (!s.met[id]) { s.met[id] = Date.now(); game.persist(); } }
export function hasMet(id: string): boolean { return !!S().met[id]; }
export function onSocial(fn: SocialFn): void { fns.push(fn); }
/** the person Mori has chosen to grow closer to (optional light romance), or null */
export function partner(): string | null { return S().partner; }

// V11: relationships with everyone (crew, villagers, rangers, researchers, hunters, craftspeople...).
//
// One model for every person Mori knows:
//   people      a registry (definePerson): who they are (group, age, adult or not, a role and a line
//               about them, where they live), what they like and dislike as gifts
//   affinity    0..100 per person, in tiers (0 acquaintance, 1 friend, 2 close friend, 3 dear friend)
//               plus "not met yet". For the crew (Jenna, Joshu, Aroha) the number IS their camp bond
//               (src/game/v10/day.ts bond / addBond), so talks at camp, requests and story events all
//               feed the same relationship the gifts and side quests do
//   gifts       give one thing from the backpack, once a day per person: they love it, like it, don't
//               mind, or would rather not (and say so); what they think is remembered for the
//               relationships page
//   talk        conversations change with affinity and story: modules register a talk provider per
//               person (defineTalk) and the NPC module plays it
//   romance     optional and light, adults only, only people marked romanceable, one partner at a
//               time, and every step is the player's choice with a clear "let's stay friends": stages
//               0 none, 1 a walk together, 2 a shared meal, 3 partners (after a confession). Choosing
//               friends closes the subject for good unless the player reopens it
//   the page    relationships() gives whatever a UI needs to draw a people page (src/ui/v11/social.ts
//               has one; the journal / book UI can show the same data)
//
// The NPC module (src/game/v11/npcs) fills the registry and plays all of this out in the world;
// other modules only call the API. The village's festival reads partner() / dancePartner().

import { game } from '../game';
import { bucket } from '../v10/store';
import { bond, addBond, dayNumber, CREW } from '../v10/day';
import type { Crew } from '../v10/day';
import { count, remove } from '../inventory';
import { ITEMS } from '../items';

export interface PersonDef {
  id: string;
  name: string;
  /** e.g. 'crew' | 'village' | 'ranger' | 'researcher' | 'hunter' | 'craft' | 'naturalist' */
  group: string;
  /** adults only can ever be romance options */
  adult: boolean;
  romanceable?: boolean;
  /** extended (all optional) */
  age?: number;
  /** a short role line ("Senior ranger, Te Puni station") */
  role?: string;
  /** a line or two about them for the people page */
  blurb?: string;
  /** location id where they're usually found */
  home?: string;
  /** a human-readable "where to find them" */
  where?: string;
  /** gift tastes: item ids, or 'kind:<ItemKind>' for a whole kind */
  loves?: string[];
  likes?: string[];
  dislikes?: string[];
  hates?: string[];
  /** what they say to each reaction (a random one) */
  giftLines?: Partial<Record<GiftReaction, string[]>>;
  /** name colour on the page */
  color?: string;
  /** they and Mori never become romance options with each other (family, already partnered) */
  taken?: boolean;
}
export const PEOPLE: Record<string, PersonDef> = {};
export function definePerson(d: PersonDef): PersonDef { PEOPLE[d.id] = { ...(PEOPLE[d.id] ?? {}), ...d }; return PEOPLE[d.id]; }

export type GiftReaction = 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
interface SocialState {
  aff: Record<string, number>;
  met: Record<string, number>;
  partner: string | null;
  /** romance stage per person (0..3) */
  rom?: Record<string, number>;
  /** people Mori chose to stay friends with (the subject stays closed unless he reopens it) */
  friends?: Record<string, number>;
  /** day each person last got a gift */
  gift?: Record<string, number>;
  /** what Mori has learned about their tastes: person -> item -> reaction */
  tastes?: Record<string, Record<string, GiftReaction>>;
  /** person -> the day of the last conversation */
  talked?: Record<string, number>;
  /** a small per-person memory for talk providers (counters, seen topics) */
  mem?: Record<string, Record<string, number>>;
  /** the day partners got together (for the crew's reactions) */
  since?: number;
}
const S = () => {
  const s = bucket<SocialState>('social', () => ({ aff: {}, met: {}, partner: null }));
  s.rom ??= {}; s.friends ??= {}; s.gift ??= {}; s.tastes ??= {}; s.talked ??= {}; s.mem ??= {};
  return s as Required<SocialState>;
};
type SocialFn = (id: string, delta: number, why: string) => void;
const fns: SocialFn[] = [];
const isCrew = (id: string): id is Crew => (CREW as string[]).includes(id);

// ---------------------------------------------------------------- affinity
/** affinity 0..100 (the crew's camp bond for Jenna, Joshu and Aroha) */
export function affinity(id: string): number { return isCrew(id) ? bond(id) : S().aff[id] ?? 0; }
export function addAffinity(id: string, n: number, why = ''): void {
  if (isCrew(id)) addBond(id, n);
  else { const s = S(); s.aff[id] = Math.max(0, Math.min(100, (s.aff[id] ?? 0) + n)); }
  if (n > 0) meet(id);
  for (const f of fns.slice()) { try { f(id, n, why); } catch (e) { console.error(e); } }
  game.persist();
}
export function meet(id: string): void { const s = S(); if (!s.met[id]) { s.met[id] = Date.now(); game.persist(); } }
/** the crew have always "met" Mori */
export function hasMet(id: string): boolean { return isCrew(id) || id === 'chunk' || !!S().met[id]; }
export function onSocial(fn: SocialFn): void { fns.push(fn); }

/** the same thresholds as the crew's bond tiers: 0 acquaintance, 1 friend (20), 2 close (45), 3 dear (80) */
export type Tier = 0 | 1 | 2 | 3;
export const TIER_AT = [0, 20, 45, 80];
export function tier(id: string): Tier { const a = affinity(id); return a >= 80 ? 3 : a >= 45 ? 2 : a >= 20 ? 1 : 0; }
export const TIER_NAMES = ['Acquaintance', 'Friend', 'Close friend', 'Dear friend'];
export function tierName(id: string): string {
  if (!hasMet(id)) return 'Not met yet';
  if (partner() === id) return 'Partner';
  if (id === 'joshu' || id === 'jenna' || id === 'aroha') return tier(id) === 3 ? 'Family' : TIER_NAMES[tier(id)];
  return TIER_NAMES[tier(id)];
}
/** 0..10 half-heart units for a UI */
export const hearts = (id: string) => Math.round(affinity(id) / 10);

// ---------------------------------------------------------------- per-person memory (talk providers)
export function memo(id: string, key: string): number { return S().mem[id]?.[key] ?? 0; }
export function setMemo(id: string, key: string, v: number) { (S().mem[id] ??= {})[key] = v; game.persist(); }
export function talkedToday(id: string): boolean { return S().talked[id] === dayNumber(); }
export function markTalked(id: string) { S().talked[id] = dayNumber(); game.persist(); }

// ---------------------------------------------------------------- gifts
const tasteIn = (list: string[] | undefined, item: string) => !!list && (list.includes(item) || list.includes('kind:' + (ITEMS[item]?.kind ?? '')));
/** what this person thinks of a gift */
export function giftReaction(id: string, item: string): GiftReaction {
  const p = PEOPLE[id];
  if (!p) return 'neutral';
  if (tasteIn(p.hates, item)) return 'hate';
  if (tasteIn(p.loves, item)) return 'love';
  if (tasteIn(p.dislikes, item)) return 'dislike';
  if (tasteIn(p.likes, item)) return 'like';
  return 'neutral';
}
export const GIFT_DELTA: Record<GiftReaction, number> = { love: 8, like: 4, neutral: 1, dislike: -2, hate: -5 };
export const giftedToday = (id: string) => S().gift[id] === dayNumber();
/** things in the pack that can be given (not tools, not quest papers) */
export function giftable(): string[] {
  const out: string[] = [];
  for (const st of game.save.inv) {
    const d = ITEMS[st.id];
    if (!d || d.kind === 'tool' || out.includes(st.id) || st.n <= 0) continue;
    if (st.id.startsWith('q_') || st.id.startsWith('art_tag')) continue;
    out.push(st.id);
  }
  return out;
}
export interface GiftResult { reaction: GiftReaction; delta: number; line: string }
/** give one of `item` from the backpack to `id` (one gift a day each); null if it can't be given */
export function giveGift(id: string, item: string): GiftResult | null {
  if (giftedToday(id) || count(item) < 1 || !PEOPLE[id]) return null;
  remove(item, 1);
  const reaction = giftReaction(id, item);
  const s = S();
  s.gift[id] = dayNumber();
  (s.tastes[id] ??= {})[item] = reaction;
  const delta = GIFT_DELTA[reaction];
  addAffinity(id, delta, 'gift:' + item);
  const pool = PEOPLE[id].giftLines?.[reaction] ?? DEFAULT_GIFT_LINES[reaction];
  const line = pool[Math.floor(Math.random() * pool.length)].replace(/\{item\}/g, (ITEMS[item]?.name ?? item).toLowerCase());
  game.persist();
  return { reaction, delta, line };
}
const DEFAULT_GIFT_LINES: Record<GiftReaction, string[]> = {
  love: ['A {item}? For me? This is perfect. Thank you!'],
  like: ['Oh, a {item}. That’s kind of you. Thanks.'],
  neutral: ['A {item}. Well... thank you.'],
  dislike: ['Ah. A {item}. That’s... thoughtful. I’ll find a use for it.'],
  hate: ['A {item}? Mori. Please. Take it back.'],
};
/** what Mori has found out about someone's tastes */
export function knownTastes(id: string): Record<string, GiftReaction> { return { ...(S().tastes[id] ?? {}) }; }
/** a taste hint someone can drop in conversation (reveals one love) */
export function revealTaste(id: string, item: string) { const r = giftReaction(id, item); (S().tastes[id] ??= {})[item] = r; game.persist(); }

// ---------------------------------------------------------------- talk providers
export interface TalkLine { who: string; text: string; expr?: string }
export type TalkProvider = () => TalkLine[] | null;
const TALK: Record<string, TalkProvider[]> = {};
/** register a conversation source for someone (the first that returns lines wins, newest first) */
export function defineTalk(id: string, fn: TalkProvider) { (TALK[id] ??= []).unshift(fn); }
/** the conversation someone has for Mori right now, if any provider has one */
export function conversation(id: string): TalkLine[] | null {
  for (const f of TALK[id] ?? []) { try { const l = f(); if (l && l.length) return l; } catch (e) { console.error(e); } }
  return null;
}

// ---------------------------------------------------------------- romance (optional, light, adults only)
export type RomanceStage = 0 | 1 | 2 | 3;
export const ROMANCE_STAGES = ['', 'Went for a walk together', 'Shared a meal', 'Together'];
/** the person Mori has chosen to grow closer to (optional light romance), or null */
export function partner(): string | null { return S().partner; }
export function romanceStage(id: string): RomanceStage { return (S().rom[id] ?? 0) as RomanceStage; }
export const isFriendsOnly = (id: string) => !!S().friends[id];
/** could this person ever be a romance option? */
export function romanceable(id: string): boolean {
  const p = PEOPLE[id];
  return !!p && p.adult && !!p.romanceable && !p.taken && (p.age === undefined || p.age >= 18);
}
/** is the next romance step open with them right now (close friends, met, not friends-only, no one else) */
export function canGrowCloser(id: string): boolean {
  if (!romanceable(id) || !hasMet(id) || isFriendsOnly(id)) return false;
  const p = partner();
  if (p && p !== id) return false;
  const st = romanceStage(id);
  if (st >= 3) return false;
  // a walk once they're close friends, a meal a little after, the confession when they're dear
  return st === 0 ? affinity(id) >= 45 : st === 1 ? affinity(id) >= 58 : affinity(id) >= 75;
}
type PartnerFn = (now: string | null, before: string | null) => void;
const partnerFns: PartnerFn[] = [];
export function onPartner(fn: PartnerFn) { partnerFns.push(fn); }
/** move a romance on a step (the scenes call this when the player says yes) */
export function advanceRomance(id: string): RomanceStage {
  if (!romanceable(id)) return romanceStage(id);
  const s = S();
  const st = Math.min(3, romanceStage(id) + 1) as RomanceStage;
  s.rom[id] = st;
  if (st === 3) {
    const before = s.partner;
    // one partner at a time: anyone else goes back to being a friend, kindly
    for (const k of Object.keys(s.rom)) if (k !== id && (s.rom[k] ?? 0) > 0) s.rom[k] = 0;
    s.partner = id;
    s.since = dayNumber();
    for (const f of partnerFns.slice()) { try { f(id, before); } catch (e) { console.error(e); } }
  }
  game.persist();
  return st;
}
/** "let's stay friends": the subject is closed with this person (no hard feelings, no affinity lost) */
export function stayFriends(id: string) {
  const s = S();
  const was = s.partner;
  s.friends[id] = dayNumber();
  s.rom[id] = 0;
  if (was === id) { s.partner = null; for (const f of partnerFns.slice()) { try { f(null, was); } catch (e) { console.error(e); } } }
  game.persist();
}
/** the player reopens the subject with someone he'd said "friends" to */
export function reopenRomance(id: string) { delete S().friends[id]; game.persist(); }
/** the day the current partners got together (0 if none) */
export const partnerSince = () => (S().partner ? S().since ?? 0 : 0);
/** the festival's dance partner: the partner, or else the closest adult friend Mori has met */
export function dancePartner(): string | null {
  const p = partner();
  if (p) return p;
  let best: string | null = null, a = -1;
  for (const d of Object.values(PEOPLE)) if (d.adult && hasMet(d.id) && affinity(d.id) > a && d.id !== 'mori') { a = affinity(d.id); best = d.id; }
  return best;
}

// ---------------------------------------------------------------- the people page
export interface PersonView {
  id: string; name: string; group: string; role: string; blurb: string; where: string;
  age: number | null; adult: boolean; met: boolean;
  affinity: number; tier: Tier; tierName: string; hearts: number;
  partner: boolean; romanceable: boolean; romance: RomanceStage; romanceLabel: string; friendsOnly: boolean; canGrowCloser: boolean;
  giftedToday: boolean;
  tastes: { item: string; name: string; reaction: GiftReaction }[];
  color: string;
}
export const GROUP_ORDER = ['crew', 'village', 'ranger', 'researcher', 'hunter', 'craft', 'naturalist'];
export const GROUP_NAMES: Record<string, string> = { crew: 'The crew', village: 'Te Kāinga', ranger: 'The ranger station', researcher: 'Helix camp', hunter: 'The hills', craft: 'Craftspeople', naturalist: 'The palm grove' };
/** everything a people page needs, people Mori has met first (crew, then by group) */
export function relationships(o: { includeUnmet?: boolean } = {}): PersonView[] {
  const out: PersonView[] = [];
  for (const d of Object.values(PEOPLE)) {
    const met = hasMet(d.id);
    if (!met && !o.includeUnmet) continue;
    const t = knownTastes(d.id);
    out.push({
      id: d.id, name: d.name, group: d.group, role: d.role ?? '', blurb: d.blurb ?? '', where: d.where ?? '',
      age: d.age ?? null, adult: d.adult, met,
      affinity: affinity(d.id), tier: tier(d.id), tierName: tierName(d.id), hearts: hearts(d.id),
      partner: partner() === d.id, romanceable: romanceable(d.id), romance: romanceStage(d.id), romanceLabel: ROMANCE_STAGES[romanceStage(d.id)],
      friendsOnly: isFriendsOnly(d.id), canGrowCloser: canGrowCloser(d.id), giftedToday: giftedToday(d.id),
      tastes: Object.entries(t).map(([item, reaction]) => ({ item, name: ITEMS[item]?.name ?? item, reaction })),
      color: d.color ?? '#4a6a2a',
    });
  }
  const g = (v: PersonView) => { const i = GROUP_ORDER.indexOf(v.group); return i < 0 ? 99 : i; };
  return out.sort((a, b) => Number(b.met) - Number(a.met) || g(a) - g(b) || b.affinity - a.affinity);
}

// ---------------------------------------------------------------- the crew are always in the book
definePerson({ id: 'jenna', name: 'Jenna', group: 'crew', adult: true, romanceable: true, age: 24, role: 'Engineer of the Kittiwake', color: '#d04890' });
definePerson({ id: 'joshu', name: 'Joshu', group: 'crew', adult: true, age: 58, role: 'Skipper of the Kittiwake', color: '#2c3a5a', taken: true });
definePerson({ id: 'aroha', name: 'Aroha', group: 'crew', adult: true, romanceable: true, age: 22, role: 'Ranger of the island’s iwi', color: '#8a4b2a' });
definePerson({ id: 'chunk', name: 'Chunk', group: 'crew', adult: false, role: 'A pug of very good character', color: '#c8402e' });

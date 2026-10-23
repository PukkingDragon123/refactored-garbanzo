// V11 Blueprints: they replace the skill tree. A blueprint is a sheet of paper (a design) that unlocks
// a crafting recipe, a tool, a piece of equipment, a survival upgrade or a research technology.
//
// HOW YOU GET ONE
//   research   spend Research Points at the laptop (Blueprints app) or Jenna's bench; the agency's R&D
//              office works on it overnight and the sheet is waiting in the morning (BlueprintDef.rp/hours)
//   quests     NPC questlines hand them out: grantBlueprint(id, 'quest:<npc>')
//   finds      a few sheets lie about in the world (the wreck, the ranger's box, the sea cave...)
//
// WHAT IT DOES
//   A blueprint with materials (needs) has to be CRAFTED at the camp workbench (Jenna's bench) before it
//   does anything: a tool lands on the belt (save.tools), a consumable in the pack, equipment / camp
//   upgrades are fitted ("built"). A blueprint without materials is pure know-how: it works as soon as
//   it is owned. isActive(id) says whether its effect is on; gameplay reads the effects through
//   fx10 (src/game/v10/skills10.ts) and gearFx (src/game/v10/campgear.ts), never this file directly.
//
// FOR OTHER MODULES (NPC quests, the village, the story)
//   grantBlueprint('<id>', 'quest:<npc>')  -> true if it was new. Ids are STABLE; the full list with
//   suggested givers is QUEST_BLUEPRINTS below (and BLUEPRINT_IDS for everything). The data and the
//   papers live in src/game/v11/bpdata.ts (definitions), src/game/v11/bpcraft.ts (crafting, research,
//   finds) and src/ui/v11/blueprints/* (the drafting table). openFolio() there shows the sheets.
import { game } from '../game';
import { bucket } from '../v10/store';

export type BlueprintKind = 'tool' | 'equipment' | 'survival' | 'research' | 'recipe' | 'camp' | 'weapon';
/** who drew the sheet: sets the paper, the ink and the handwriting on it */
export type Designer = 'aroha' | 'jenna' | 'joshu' | 'ranger' | 'agency' | 'mori' | 'whaler' | 'village';
/** a step of one of the old gear upgrade chains (campgear.ts GEAR) */
export type GearChain = 'camera' | 'pack' | 'boots' | 'wetsuit' | 'headlamp' | 'translator';

export interface BlueprintDef {
  id: string;
  name: string;
  kind: BlueprintKind;
  desc: string;
  /** how it is usually obtained, for the papers UI ('research' | 'quest:<npc>' | 'found:<place>') */
  source?: string;
  /** one line: what it does in play */
  effect?: string;
  /** materials used up when it is crafted (none = know-how, active once owned) */
  needs?: [string, number][];
  /** the item it makes (a tool goes on the belt, anything else into the pack) */
  out?: [string, number];
  /** can be crafted again and again (consumables, lures) */
  repeat?: boolean;
  /** research cost in RP (absent = it can't be researched: quests and finds only) */
  rp?: number;
  /** research time in hours (<= 12: overnight; 24 per extra day) */
  hours?: number;
  /** blueprints that must be owned (and built, if they need building) first */
  req?: string[];
  /** a story requirement: returns the reason it is blocked, or null */
  gate?: () => string | null;
  /** who drew it */
  by?: Designer;
  /** margin notes in the designer's hand */
  notes?: string[];
  /** a gear upgrade step: [chain, level 1..n] (gearLevel counts the built steps in order) */
  chain?: [GearChain, number];
  /** the line the designer says when it is made (Jenna's bench scene) */
  line?: string;
  /** where a found / quest sheet comes from, as a hint on the blank sheet */
  hint?: string;
}

export const BLUEPRINTS: Record<string, BlueprintDef> = {};
export function defineBlueprint(d: BlueprintDef): BlueprintDef { BLUEPRINTS[d.id] = Object.assign(BLUEPRINTS[d.id] ?? {}, d); return BLUEPRINTS[d.id]; }

interface Owned { from: string; t: number; seen?: boolean; day?: number }
export interface BpSave {
  owned: Record<string, Owned>;
  /** crafted / built: id -> times made */
  made: Record<string, number>;
  /** research in progress at the agency */
  lab: { id: string; day: number; ready: number } | null;
  /** old progress already moved over (skills10, gear) */
  migrated?: boolean;
}
export const bpSave = (): BpSave => {
  const b = bucket<BpSave>('blueprints', () => ({ owned: {}, made: {}, lab: null }));
  if (!b.owned) b.owned = {};
  if (!b.made) b.made = {};
  if (b.lab === undefined) b.lab = null;
  return b;
};
const S = bpSave;
type BpFn = (id: string, from: string) => void;
const fns: BpFn[] = [];
type MadeFn = (id: string) => void;
const madeFns: MadeFn[] = [];

/** testing: ?flags=v10:allSkills (or v11:allBlueprints) owns and builds everything */
const all = () => !!game.save?.flags?.['v10:allSkills'] || !!game.save?.flags?.['v11:allBlueprints'];

export function hasBlueprint(id: string): boolean { return !!S().owned[id] || all(); }
export function ownedBlueprints(): string[] { return Object.keys(S().owned); }
/** give a blueprint (a quest reward, a find, a research result); false if already owned */
export function grantBlueprint(id: string, from = 'quest'): boolean {
  const s = S();
  if (s.owned[id]) return false;
  if (!BLUEPRINTS[id]) console.warn('grantBlueprint: unknown blueprint', id);
  s.owned[id] = { from, t: Date.now(), day: game.save.day || 1 };
  for (const f of fns.slice()) { try { f(id, from); } catch (e) { console.error(e); } }
  game.persist();
  return true;
}
export function onBlueprint(fn: BpFn): () => void { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; }

/** does it need crafting / building before it works? */
export const needsBuilding = (id: string): boolean => !!BLUEPRINTS[id]?.needs?.length;
/** how many times it has been made (0 = never) */
export function timesMade(id: string): number { return S().made[id] ?? 0; }
/** built / crafted at least once */
export function isBuilt(id: string): boolean { return timesMade(id) > 0 || all(); }
/** its effect is on: owned, and built if it needs building */
export function isActive(id: string): boolean { return hasBlueprint(id) && (!needsBuilding(id) || isBuilt(id)); }
/** record a craft (the crafting module calls this; listeners refresh HUDs and stats) */
export function markMade(id: string, n = 1) {
  const s = S();
  s.made[id] = (s.made[id] ?? 0) + n;
  game.persist();
  for (const f of madeFns.slice()) { try { f(id); } catch (e) { console.error(e); } }
}
/** called after anything is crafted / built */
export function onMade(fn: MadeFn): () => void { madeFns.push(fn); return () => { const i = madeFns.indexOf(fn); if (i >= 0) madeFns.splice(i, 1); }; }
/** a sheet the player hasn't looked at yet (the NEW badge) */
export const isFreshBlueprint = (id: string) => !!S().owned[id] && !S().owned[id].seen;
export function markBlueprintSeen(id: string) { const o = S().owned[id]; if (o && !o.seen) { o.seen = true; game.persist(); } }

/**
 * Blueprint ids other modules may grant (NPC questlines, the village, story beats), with who would
 * naturally hand each one over. Keep these ids stable. Most can also be researched, so a quest is the
 * friendly way to get one, not the only way.
 */
export const QUEST_BLUEPRINTS: { id: string; giver: string; why: string }[] = [
  { id: 'slingshot', giver: 'aroha', why: 'Aroha’s Lesson (src/game/v11/arohalesson.ts) grants it' },
  { id: 'pebble_pouch', giver: 'aroha', why: 'a bigger pouch for the slingshot' },
  { id: 'smoke_bomb', giver: 'aroha', why: 'kawakawa smoke balls that blind a predator' },
  { id: 'walking_staff', giver: 'aroha', why: 'a mānuka staff for long walks' },
  { id: 'remedy_kit', giver: 'village', why: 'a healer’s kawakawa and charcoal remedies (poison)' },
  { id: 'plant_press', giver: 'village', why: 'a weaver’s / healer’s plant knowledge' },
  { id: 'shelter', giver: 'village', why: 'a thatched lean-to the village way' },
  { id: 'rain_catcher', giver: 'village', why: 'a flax gutter and gourd for rainwater' },
  { id: 'flax_straps', giver: 'aroha', why: 'harakeke pack straps' },
  { id: 'canteen', giver: 'joshu', why: 'a clay water bottle in a leather sling' },
  { id: 'smoker', giver: 'joshu', why: 'Joshu’s fish smoker' },
  { id: 'braided_line', giver: 'joshu', why: 'a flax fishing line that won’t snap' },
  { id: 'fishing_reel', giver: 'joshu', why: 'the Kittiwake’s old reel (also found in the wreck)' },
  { id: 'climbing_gloves', giver: 'jenna', why: 'grip gloves for rock and water' },
  { id: 'trap', giver: 'ranger', why: 'the island rangers’ live-trap design (also found)' },
  { id: 'storm_lantern', giver: 'whaler', why: 'an old whaler’s lantern (found in the sea cave)' },
  { id: 'survey_kit', giver: 'ranger', why: 'transect tape and quadrat' },
  { id: 'fruit_lure', giver: 'village', why: 'a fruit bait recipe' },
  { id: 'glow_lure', giver: 'village', why: 'a glow-moss lure for night insects' },
  { id: 'telephoto_lens', giver: 'joshu', why: 'the long lens from the Kittiwake’s locker' },
];

/** every blueprint id (after bpdata.ts has loaded) */
export const BLUEPRINT_IDS = (): string[] => Object.keys(BLUEPRINTS);

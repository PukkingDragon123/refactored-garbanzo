// Zealandia Encyclopedia: the model behind the app. Six categories built from what the expedition
// has uploaded and handed in: Fauna (the field guide's species, documented by photos), Flora (plant
// and fungus specimens and plant field notes), Artifacts & Culture, Fossils, Samples (animal and
// mineral specimens, shells) and Places (the atlas' locations and the map's field notes). Every entry
// has a 0..1 progress, so each category and the whole encyclopedia have a completion percentage.

import { game } from '../../game/game';
import { SPECIES, SPECIES_BY_ID } from '../../game/species';
import type { Species } from '../../game/species';
import { ITEMS } from '../../game/items';
import { count } from '../../game/inventory';
import { LOCATIONS, discoveries, isFound } from '../../game/v10/regions';
import type { Discovery, LocationDef, DiscoveryKind } from '../../game/v10/regions';
import {
  r10, entry, secOf, itemCat, v2Only, crateCount, analysedTimes, encSeen, filedDay, PLACE_KINDS,
} from '../../game/v9/research9';
import type { ItemCat } from '../../game/v9/research9';
import { tiesOf } from './foodweb';
import { funFact } from './funfacts';

export type Cat = 'fauna' | 'flora' | 'culture' | 'fossils' | 'samples' | 'places';
export const CATS: { id: Cat; name: string; icon: string; empty: string }[] = [
  { id: 'fauna', name: 'Fauna', icon: 'c_fauna', empty: 'A species gets its page once a sharp, close photo of it is uploaded from the camera.' },
  { id: 'flora', name: 'Flora', icon: 'c_flora', empty: 'Collect plant and fungus samples (knife or trowel) and hand them in at the camp laptop.' },
  { id: 'culture', name: 'Artifacts & Culture', icon: 'c_culture', empty: 'Nothing yet. Ruins and villages may hold taonga, treasured objects: document them with care and respect.' },
  { id: 'fossils', name: 'Fossils', icon: 'c_fossils', empty: 'No fossils yet. Look in cliffs, caves and stream beds: old rock keeps old secrets.' },
  { id: 'samples', name: 'Samples', icon: 'c_samples', empty: 'Feathers, scales, shells, droppings: hand them in at camp and the lab will tell you who left them.' },
  { id: 'places', name: 'Places', icon: 'c_places', empty: 'Explore the region: every place you find and note down is filed here when you upload.' },
];
export const CAT_OF_ITEM: Record<ItemCat, Cat> = { flora: 'flora', sample: 'samples', artifact: 'culture', fossil: 'fossils' };
const DISC_CAT: Partial<Record<DiscoveryKind, Cat>> = { plant: 'flora', artifact: 'culture', fossil: 'fossils', sample: 'samples' };

export type Thumb =
  | { t: 'photo'; species: string }
  | { t: 'item'; id: string }
  | { t: 'icon'; name: string }
  | { t: 'none' };

export interface EncEntry {
  /** 'sp:<species>', 'it:<item>', 'dc:<discovery>', 'loc:<location>' */
  key: string;
  cat: Cat;
  /** shown name ('???' while unknown) */
  name: string;
  known: boolean;
  /** 0..1 */
  progress: number;
  fresh: boolean;
  thumb: Thumb;
  sub: string;
  /** a short state line ('In your backpack', 'Sighted, no photo yet'...) */
  state?: string;
  sort: number;
}

// ---------------------------------------------------------------- fauna

const siteReachable = (site: string) => LOCATIONS.some(l => l.scene.type === 'site' && l.scene.site === site);
const sighted = (id: string) => discoveries().some(d => d.kind === 'species' && (d.id === id || d.id === 'sp:' + id) && !!filedDay(d.id));

/** the species the expedition can find (the island and ocean, plus the old field sites once the atlas reaches them) */
export function faunaPool(): Species[] {
  return SPECIES.filter(s => !s.sites.length || s.sites.some(siteReachable) || !!game.save.research[s.id] || sighted(s.id) || !!game.save.hints[s.id]);
}

export interface Sec { key: string; title: string; text?: string; list?: string[]; web?: boolean; fun?: boolean }
const TIMES: Record<string, string> = { dawn: 'dawn', day: 'day', dusk: 'dusk', night: 'night' };
const SITES: Record<string, string> = { fernwood: 'the Fernwood', canopy: 'the canopy', falls: 'the waterfall gorge', mangrove: 'the Blackwater mangroves', coast: 'the coast' };

/** a species' research sheet, in reveal order (Habitat, Diet, Behaviour, Anatomy, Ecology, notes, fun fact) */
export function speciesSections(sp: Species): Sec[] {
  const R = sp.research;
  const out: Sec[] = [];
  const web = tiesOf(sp.id).length > 0;
  if (R) {
    out.push({ key: 'hab', title: 'Habitat', text: R.habitat });
    out.push({ key: 'diet', title: 'Diet', text: R.diet });
    out.push({ key: 'bhv', title: 'Behaviour', text: R.behaviour });
    out.push({ key: 'ana', title: 'Anatomy', text: R.anatomy });
    out.push({ key: 'eco', title: 'Ecosystem connections', text: R.ecology, web });
    if (R.notes?.length) out.push({ key: 'notes', title: 'Mori’s field notes', list: R.notes });
  } else {
    const where = sp.sites.map(s => SITES[s] ?? s).join(', ');
    out.push({ key: 'hab', title: 'Habitat', text: `${where ? `Found in ${where}. ` : ''}Active at ${sp.times.map(t => TIMES[t] ?? t).join(', ')}. Size: ${sp.size}.` });
    if (web) out.push({ key: 'eco', title: 'Ecosystem connections', web: true });
  }
  out.push({ key: 'fun', title: 'Fun fact', text: funFact(sp), fun: true });
  return out;
}

export function speciesProgress(id: string): number {
  const e = entry(id), sp = SPECIES_BY_ID[id];
  if (!e || !sp) return 0;
  const nb = Object.keys(sp.behaviors).length, nf = sp.facts.length, ns = speciesSections(sp).length;
  const beh = nb ? e.beh.filter(b => b in sp.behaviors).length / nb : 1;
  const fac = nf ? e.facts.length / nf : 1;
  const sec = ns ? Math.min(1, secOf(id) / ns) : 1;
  return Math.min(1, 0.2 + 0.3 * sec + 0.3 * beh + 0.2 * fac);
}

function faunaEntries(): EncEntry[] {
  return faunaPool().map((sp, i) => {
    const e = entry(sp.id);
    if (e) return { key: 'sp:' + sp.id, cat: 'fauna', name: sp.name, known: true, progress: speciesProgress(sp.id), fresh: !!e.fresh, thumb: { t: 'photo', species: sp.id }, sub: sp.group, sort: e.n } as EncEntry;
    const hint = !!game.save.hints[sp.id], seen = sighted(sp.id);
    if (hint || seen) return { key: 'sp:' + sp.id, cat: 'fauna', name: sp.name, known: true, progress: 0.05, fresh: false, thumb: { t: 'none' }, sub: sp.group, state: seen ? 'Sighted: no photo yet' : 'A sample points to it', sort: 5000 + i } as EncEntry;
    return { key: 'sp:' + sp.id, cat: 'fauna', name: '???', known: false, progress: 0, fresh: false, thumb: { t: 'none' }, sub: sp.group, sort: 9000 + i } as EncEntry;
  });
}

// ---------------------------------------------------------------- specimens (flora, samples, artifacts, fossils)

/** has the expedition ever had this item (pack, crate, lab or a first-find flag)? */
export const everHad = (id: string) => count(id) > 0 || crateCount(id) > 0 || analysedTimes(id) > 0 || !!game.save.flags['v9:found:' + id] || !!r10().crate.some(c => c.id === id);
const v2Reachable = () => ['fernwood', 'canopy', 'falls', 'mangrove'].some(siteReachable);

const KIND_NAME: Record<string, string> = { plant: 'Plant', fungus: 'Fungus', insect: 'Insect', animal: 'Animal sign', shell: 'Shell', food: 'Wild food', material: 'Mineral', key: 'Object' };

function itemEntries(cat: Cat): EncEntry[] {
  const out: EncEntry[] = [];
  const ids = Object.keys(ITEMS).filter(id => { const c = itemCat(id); return !!c && CAT_OF_ITEM[c] === cat && (!v2Only(id) || v2Reachable() || everHad(id)); });
  const discs = new Map(discoveries().map(d => [d.id, d]));
  ids.forEach((id, i) => {
    const d = ITEMS[id];
    const rec = r10().lab[id];
    const times = analysedTimes(id);
    const sub = cat === 'culture' ? 'Artifact' : cat === 'fossils' ? 'Fossil' : KIND_NAME[d.kind] ?? 'Specimen';
    const disc = discs.get(id);
    if (times > 0) {
      out.push({ key: 'it:' + id, cat, name: d.name, known: true, progress: 1, fresh: !encSeen('it:' + id), thumb: { t: 'item', id }, sub, sort: rec?.day ?? 1 });
    } else if (count(id) > 0) {
      out.push({ key: 'it:' + id, cat, name: d.name, known: true, progress: 0.15, fresh: false, thumb: { t: 'item', id }, sub, state: 'In your backpack: hand it in at camp', sort: 3000 + i });
    } else if (disc && filedDay(disc.id)) {
      out.push({ key: 'it:' + id, cat, name: d.name, known: true, progress: 0.5, fresh: !encSeen('it:' + id), thumb: { t: 'item', id }, sub, state: 'Noted in the field', sort: 2000 + i });
    } else {
      out.push({ key: 'it:' + id, cat, name: '???', known: false, progress: 0, fresh: false, thumb: { t: 'none' }, sub, sort: 9000 + i });
    }
  });
  // field notes of this category that are not an item (a carving too big to carry, a fossil in a cliff)
  for (const dc of discoveries()) {
    if (DISC_CAT[dc.kind] !== cat || ITEMS[dc.id] || !filedDay(dc.id)) continue;
    out.push({ key: 'dc:' + dc.id, cat, name: dc.name, known: true, progress: 1, fresh: !encSeen('dc:' + dc.id), thumb: { t: 'icon', name: cat === 'fossils' ? 'c_fossils' : cat === 'flora' ? 'c_flora' : cat === 'culture' ? 'c_culture' : 'c_samples' }, sub: 'Field note', sort: 1000 + filedDay(dc.id) });
  }
  return out;
}

// ---------------------------------------------------------------- places

const LOC_ICON: Record<string, string> = { camp: 'k_camp', site: 'k_site', village: 'k_village', ruin: 'k_ruin', cave: 'k_cave', fossil: 'k_fossil', ecosystem: 'k_ecosystem', ocean: 'k_ocean', island: 'k_island', location: 'k_location', landmark: 'k_landmark' };
export const placeIcon = (kind: string) => LOC_ICON[kind] ?? 'k_location';
const KIND_LABEL: Record<string, string> = { camp: 'Camp', site: 'Field site', village: 'Village', ruin: 'Ruin', cave: 'Cave', fossil: 'Fossil site', ecosystem: 'Ecosystem', ocean: 'Open water', island: 'Island', location: 'Location', landmark: 'Landmark' };
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

/** a filed discovery that stands for a whole atlas location */
const locNote = (l: LocationDef) => discoveries().find(d => filedDay(d.id) && (d.id === l.id || d.id === 'loc:' + l.id || (d.kind === 'location' && d.loc === l.id)));

function placeEntries(): EncEntry[] {
  const out: EncEntry[] = [];
  LOCATIONS.forEach((l, i) => {
    const note = locNote(l);
    const found = isFound(l.id) || !!note;
    const photos = game.save.uploads.some(u => u.site === l.id);
    const notes = discoveries().some(d => filedDay(d.id) && d.loc === l.id);
    const progress = !found ? 0 : 0.6 + (photos || notes ? 0.4 : 0);
    out.push({ key: 'loc:' + l.id, cat: 'places', name: found ? l.name : '???', known: found, progress, fresh: found && !encSeen('loc:' + l.id), thumb: found ? { t: 'icon', name: placeIcon(l.kind) } : { t: 'none' }, sub: found ? kindLabel(l.kind) : `Somewhere in the ${l.region === 'home' ? 'home island' : l.region}`, sort: found ? i : 9000 + i });
  });
  const covered = new Set(LOCATIONS.map(l => locNote(l)?.id).filter(Boolean));
  for (const d of discoveries()) {
    if (!PLACE_KINDS.includes(d.kind) || !filedDay(d.id) || covered.has(d.id)) continue;
    out.push({ key: 'dc:' + d.id, cat: 'places', name: d.name, known: true, progress: 1, fresh: !encSeen('dc:' + d.id), thumb: { t: 'icon', name: placeIcon(d.kind) }, sub: kindLabel(d.kind), sort: 500 + filedDay(d.id) });
  }
  return out;
}

// ---------------------------------------------------------------- categories & completion

export function entries(cat: Cat): EncEntry[] {
  const list = cat === 'fauna' ? faunaEntries() : cat === 'places' ? placeEntries() : itemEntries(cat);
  return list.sort((a, b) => +b.known - +a.known || a.sort - b.sort);
}
export interface CatStat { cat: Cat; known: number; total: number; pct: number; fresh: number }
export function catStat(cat: Cat): CatStat {
  const l = entries(cat);
  const sum = l.reduce((a, e) => a + e.progress, 0);
  return { cat, known: l.filter(e => e.known && e.progress > 0.1).length, total: l.length, pct: l.length ? (sum / l.length) * 100 : 0, fresh: l.filter(e => e.fresh).length };
}
export function overall(): { pct: number; stats: CatStat[] } {
  const stats = CATS.map(c => catStat(c.id));
  const tot = stats.reduce((a, s) => a + s.total, 0);
  const sum = stats.reduce((a, s) => a + (s.pct / 100) * s.total, 0);
  return { pct: tot ? (sum / tot) * 100 : 0, stats };
}
export const freshTotal = () => CATS.reduce((a, c) => a + catStat(c.id).fresh, 0);

/** the discovery behind a 'dc:' key, the location behind 'loc:' */
export const discByKey = (key: string): Discovery | null => discoveries().find(d => 'dc:' + d.id === key) ?? null;
export const locByKey = (key: string): LocationDef | null => LOCATIONS.find(l => 'loc:' + l.id === key) ?? null;
/** which category an entry key belongs to */
export function catOfKey(key: string): Cat {
  if (key.startsWith('sp:')) return 'fauna';
  if (key.startsWith('loc:')) return 'places';
  if (key.startsWith('it:')) { const c = itemCat(key.slice(3)); return c ? CAT_OF_ITEM[c] : 'samples'; }
  const d = discByKey(key);
  return d ? DISC_CAT[d.kind] ?? 'places' : 'places';
}

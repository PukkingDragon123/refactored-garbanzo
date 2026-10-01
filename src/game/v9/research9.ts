// V9 research: the camera -> laptop pipeline. Photos stay on the camera (save.raw) until they are
// uploaded in MoriOS. Uploading stores a downscaled copy (save.uploads), frees the camera copy and
// runs the identification rules of ../photos on every animal in frame. An identified animal creates
// or extends its species' research log entry (save.research): that photo, the behaviours it shows,
// and any field-guide findings (Fact.evidence) whose evidence has now been uploaded. Undocumented
// species have no entry at all.
// Also: the field laptop on the island (flag v9:laptop): HUD button, L hotkey, the camp table.
// V10 (bottom of the file): the research loop at camp. All research RP comes from the agency that
// sent the expedition (scaled by fx10.rpMult) and is logged per day and week; the backpack's samples,
// artifacts and fossils are handed in to the research crate and analysed (ItemDef.lab, or a generic
// result); the map's field notes (v10/regions discoveries) are filed; each upload reveals research
// sheet sections (fx10.infoDepth); weekly agency targets; the agency's mailbox. State lives in
// game.save.v10.research (see ../v10/store).

import { game } from '../game';
import type { RawPhoto, PhotoSubject } from '../photos';
import { judgeSubject, idProblem, NEW_SPECIES_RP, NEW_EVIDENCE_RP } from '../photos';
import { SPECIES_BY_ID, CLUE_BY_ID } from '../species';
import type { Species, Fact, Evidence } from '../species';
import type { UploadRecord, UploadSubject, ResearchEntry } from '../save';
import { addEvidence, addClue, FACT_RP } from '../research';
import { questStatus } from '../quests';
import { ITEMS } from '../items';
import { count, remove } from '../inventory';
import { RECIPES } from '../crafting';
import { bucket } from '../v10/store';
import { fx10 } from '../v10/skills10';
import { dayNumber } from '../v10/day';
import { discoveries, LOCATIONS } from '../v10/regions';
import type { Discovery, DiscoveryKind } from '../v10/regions';
import { currentExpedition } from '../v10/expedition';
import { SEA9 } from './species-sea';
import { SHORE9 } from './species-shore';
import { FISH9 } from './species-fish';
import { WILD9 } from './species-wild';
import type { FieldScene } from '../scenes/field';

/** width of the stored copy of an uploaded photo */
export const UPLOAD_W = 320;
const UPLOAD_Q = 0.78;

// ---------------------------------------------------------------- the camera roll

/** photos still on the camera (not uploaded yet), oldest first */
export function cameraRoll(): RawPhoto[] {
  return game.save.raw;
}
export const pendingCount = () => game.save.raw.length;

// ---------------------------------------------------------------- analysis

export interface Finding {
  species: string;
  /** species data (null for an animal the field guide doesn't know yet) */
  sp: Species | null;
  ok: boolean;
  why?: string;
  stars: number;
  /** behaviours of the identified individuals */
  beh: string[];
  bbox: [number, number, number, number];
  n: number;
}

/**
 * V10 data analysis: the identification bonus (fx10.idBonus, 0..1) lets the laptop's software clean
 * up a borderline subject before it is judged: blur and shake are partly corrected and small subjects
 * enhanced. A subject that is out of frame or hidden stays as it is.
 */
function enhanced(s: PhotoSubject): PhotoSubject {
  const k = Math.max(0, Math.min(1, fx10.idBonus()));
  if (k <= 0) return s;
  const fix = (v: number) => v + (1 - v) * k * 0.5;
  return { ...s, focus: fix(s.focus), motion: fix(s.motion), shake: fix(s.shake), size: s.size * (1 + k * 0.6) };
}

/** what the laptop makes of a photo: one finding per species in frame, identified ones first */
export function analyse(p: RawPhoto): Finding[] {
  const by = new Map<string, PhotoSubject[]>();
  for (const s of p.subjects) { const l = by.get(s.species) ?? []; l.push(s); by.set(s.species, l); }
  const out: Finding[] = [];
  for (const [id, subs] of by) {
    const sp = SPECIES_BY_ID[id] ?? null;
    const judged = subs.map(s => ({ s, j: judgeSubject(enhanced(s), p) }));
    const good = judged.filter(x => x.j.identified).sort((a, b) => b.j.score - a.j.score);
    if (sp && good.length) {
      const beh = [...new Set(good.map(x => x.s.behavior).filter((b): b is string => !!b))];
      out.push({ species: id, sp, ok: true, stars: good[0].j.stars, beh, bbox: good[0].s.bbox, n: subs.length });
    } else {
      // the least-bad individual explains the failure
      const best = judged.sort((a, b) => b.s.inFrame * b.s.visible * b.s.size - a.s.inFrame * a.s.visible * a.s.size)[0];
      out.push({ species: id, sp, ok: false, why: sp ? idProblem(best.j, best.s) : 'Unknown animal: not in the field guide yet', stars: 0, beh: [], bbox: best.s.bbox, n: subs.length });
    }
  }
  return out.sort((a, b) => +b.ok - +a.ok || b.stars - a.stars);
}

// ---------------------------------------------------------------- uploading

export interface UploadOutcome {
  rec: UploadRecord;
  found: Finding[];
  newSpecies: string[];
  /** [species, behaviour key] */
  newBeh: [string, string][];
  /** [species, fact] */
  newFacts: [string, Fact][];
  rp: number;
}

async function downscale(src: string, w: number, q: number): Promise<string> {
  try {
    const im = new Image();
    im.src = src;
    await im.decode();
    if (im.naturalWidth <= w) return src;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.round((w * im.naturalHeight) / im.naturalWidth);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } catch {
    return src;
  }
}

/**
 * Upload one camera photo: store it, take it off the camera and document whatever it identifies.
 * where: 'ship' (the bunk-room laptop) or 'field' (the salvaged laptop on the island).
 */
export async function uploadPhoto(p: RawPhoto, where: 'ship' | 'field'): Promise<UploadOutcome> {
  const s = game.save;
  const img = await downscale(p.img, UPLOAD_W, UPLOAD_Q);
  const found = analyse(p);
  const n = (s.vars['v9:uploads'] ?? 0) + 1;
  s.vars['v9:uploads'] = n;
  const subjects: UploadSubject[] = found.map(f => ({ species: f.species, beh: f.beh, bbox: f.bbox, ok: f.ok, why: f.why, stars: f.stars, n: f.n }));
  const rec: UploadRecord = { id: p.id, img, day: p.day, time: p.time, site: p.site, video: p.video, n, subjects, notes: p.notes.length ? p.notes : undefined };
  s.uploads = s.uploads.filter(u => u.id !== p.id);
  s.uploads.push(rec);
  s.raw = s.raw.filter(r => r.id !== p.id);
  const out: UploadOutcome = { rec, found, newSpecies: [], newBeh: [], newFacts: [], rp: 0 };
  const day = daySum();
  day.photos++;
  logEv('photo', String(rec.id), 0);
  const depth = Math.max(1, Math.round(fx10.infoDepth()));
  for (const f of found) {
    if (!f.ok || !f.sp) continue;
    let e = s.research[f.species];
    // research sheet sections: the first photo reveals one less than the analysis depth, every
    // later one the full depth, every new behaviour one more (see secOf)
    if (!e) {
      e = { first: rec.id, cover: rec.id, photos: [], beh: [], vid: [], facts: [], day: rec.day, n: Object.keys(s.research).length + 1, stars: 0, fresh: true };
      s.research[f.species] = e;
      out.newSpecies.push(f.species);
      out.rp += awardRp(NEW_SPECIES_RP, 'species', f.species);
      day.species.push(f.species);
      r10().sec[f.species] = Math.max(1, depth - 1);
    } else if (!e.photos.includes(rec.id)) r10().sec[f.species] = secOf(f.species) + depth;
    if (!e.photos.includes(rec.id)) e.photos.push(rec.id);
    e.stars = Math.max(e.stars, f.stars);
    for (const b of f.beh) {
      if (p.video && !e.vid.includes(b)) e.vid.push(b);
      if (!(b in f.sp.behaviors) || e.beh.includes(b)) continue;
      e.beh.push(b);
      out.newBeh.push([f.species, b]);
      out.rp += awardRp(NEW_EVIDENCE_RP, 'beh', f.species + ':' + b);
      day.beh.push(f.species + ':' + b);
      r10().sec[f.species] = secOf(f.species) + 1;
    }
    // the old field-guide bookkeeping (sightings, evidence) follows the uploads too
    addEvidence(f.species, null, p.video);
    for (const b of f.beh) addEvidence(f.species, b, p.video);
  }
  if (found.some(f => f.ok)) day.ok++;
  // findings: any fact of a documented species whose evidence has now all been uploaded
  for (const [id, e] of Object.entries(s.research)) {
    const sp = SPECIES_BY_ID[id];
    if (!sp) continue;
    for (const f of sp.facts) {
      if (e.facts.includes(f.id) || !f.evidence.every(evidenceUploaded)) continue;
      e.facts.push(f.id);
      s.facts[f.id] = true;
      out.newFacts.push([id, f]);
      out.rp += awardRp(FACT_RP, 'fact', f.id);
      day.facts.push(f.id);
    }
  }
  s.flags['v9:upload:' + where] = true;
  if (where === 'ship') s.flags['v9:uploadShip'] = true;
  game.persist();
  return out;
}

/** has a piece of field-guide evidence been uploaded (or found, for clues)? */
export function evidenceUploaded(ev: Evidence): boolean {
  if (ev.kind === 'clue') return !!game.save.clues[ev.clue];
  const e = game.save.research[ev.species];
  if (!e) return false;
  return ev.kind === 'video' ? e.vid.includes(ev.behavior) : e.beh.includes(ev.behavior) || e.vid.includes(ev.behavior);
}

// ---------------------------------------------------------------- the log

export const entry = (id: string): ResearchEntry | null => game.save.research[id] ?? null;
export const upload = (id: number): UploadRecord | null => game.save.uploads.find(u => u.id === id) ?? null;

/** documented species, in the order they were documented */
export function documented(): { id: string; sp: Species; e: ResearchEntry }[] {
  return Object.entries(game.save.research)
    .filter(([id]) => !!SPECIES_BY_ID[id])
    .map(([id, e]) => ({ id, sp: SPECIES_BY_ID[id], e }))
    .sort((a, b) => a.e.n - b.e.n);
}

/** how many species are out there (the island and ocean field guide) */
export function speciesTotal(): number {
  const ids = new Set([...SEA9, ...SHORE9, ...FISH9, ...WILD9].map(s => s.id));
  for (const id of Object.keys(game.save.research)) ids.add(id);
  return ids.size;
}

/** the photo shown for an entry (its cover, else any photo of it still stored) */
export function coverOf(id: string): UploadRecord | null {
  const e = entry(id);
  if (!e) return null;
  return upload(e.cover) ?? upload(e.first) ?? [...e.photos].reverse().map(upload).find(Boolean) ?? null;
}

/** the stored photos of a species, oldest first */
export function photosOf(id: string): UploadRecord[] {
  const e = entry(id);
  if (!e) return [];
  const ids = new Set([e.first, e.cover, ...e.photos]);
  return game.save.uploads.filter(u => ids.has(u.id));
}

export function setCover(id: string, photo: number) {
  const e = entry(id);
  if (!e || !upload(photo)) return;
  e.cover = photo;
  if (!e.photos.includes(photo)) e.photos.push(photo);
  game.persist();
}

export function markSeen(id: string) {
  const e = entry(id);
  if (e?.fresh) { e.fresh = false; game.persist(); }
}
export const freshCount = () => Object.values(game.save.research).filter(e => e.fresh).length;

// ---------------------------------------------------------------- the ship quest nudge

/** the ship's afternoon quest wants the photos uploaded (laptop quest marker) */
export function shipUploadDue() {
  return questStatus('v4deck') === 'active' && !game.save.flags['v9:uploadShip'] && (game.save.vars['v4:photoSpecies'] ?? 0) >= 1 && pendingCount() > 0;
}

// ---------------------------------------------------------------- the field laptop (island)

export const hasFieldLaptop = () => !!game.save.flags['v9:laptop'];

/** open MoriOS in field mode from anywhere on the island (or at the camp research table) */
export async function openFieldLaptop(s: FieldScene, o: { table?: boolean } = {}) {
  if (s.cutscene || game.ui.blocking) return;
  s.cutscene = true;
  s.cam?.raise(false);
  if (o.table) s.player.poseOverride = 'type';
  try {
    const { openMoriOS } = await import('../../ui/v4/moriOS');
    await openMoriOS({ report: false, field: true });
  } finally {
    if (o.table) s.player.poseOverride = null;
    s.cutscene = false;
    s.hud?.refresh(true);
  }
}

/** hook the island scene up: HUD belt button and the L hotkey (shown once v9:laptop is set) */
export function enableFieldLaptop(s: FieldScene) {
  s.hud?.setLaptop({ shown: hasFieldLaptop, badge: uploadDueCount, open: () => void openFieldLaptop(s) });
}

// ================================================================ V10: the research loop at camp

/** what a backpack item is to the research crate (null: it stays in the pack) */
export type ItemCat = 'flora' | 'sample' | 'artifact' | 'fossil';
/** ledger entries (one per thing documented, with the RP it paid) */
export type EvKind = 'photo' | 'species' | 'beh' | 'fact' | 'flora' | 'sample' | 'artifact' | 'fossil' | 'place' | 'note' | 'bonus';

export interface CrateItem { id: string; n: number; day: number; cat: ItemCat; returned?: number }
export interface LabRecord {
  /** day of the first analysis */
  day: number;
  /** specimens analysed in total (first + replicates) */
  times: number;
  rp: number;
  text: string;
  /** measurement lines of the first analysis */
  lines: string[];
  /** no ItemDef.lab: the laptop's best guess */
  generic: boolean;
  cat: ItemCat;
}
export interface LedgerEv { d: number; k: EvKind; id: string; rp: number }
export interface Mail { id: string; day: number; from: string; subj: string; html: string; read?: boolean; tag?: string }
export interface DaySum { day: number; photos: number; ok: number; species: string[]; beh: string[]; facts: string[]; items: string[]; places: string[]; rp: number; sessions: number }
interface R10 {
  crate: CrateItem[];
  lab: Record<string, LabRecord>;
  /** research sheet sections revealed per species */
  sec: Record<string, number>;
  /** discovery id -> day its field note was filed */
  filed: Record<string, number>;
  ev: LedgerEv[];
  mail: Mail[];
  days: Record<string, DaySum>;
  /** encyclopedia entries opened (key -> day) */
  seen: Record<string, number>;
  /** week -> 'met' (bonus paid) / 'sent' (targets mailed) / 'missed' */
  weeks: Record<string, string>;
  /** one-off agency firsts and milestones already celebrated */
  firsts: Record<string, number>;
}

const R10_INIT = (): R10 => ({ crate: [], lab: {}, sec: {}, filed: {}, ev: [], mail: [], days: {}, seen: {}, weeks: {}, firsts: {} });
/** the V10 research state (created on first use; fields added later are filled in) */
export function r10(): R10 {
  const r = bucket<R10>('research', R10_INIT);
  const d = R10_INIT() as unknown as Record<string, unknown>;
  for (const k of Object.keys(d)) if ((r as unknown as Record<string, unknown>)[k] === undefined) (r as unknown as Record<string, unknown>)[k] = d[k];
  return r;
}

export const today = () => Math.max(1, dayNumber());
export const weekNo = (day = today()) => Math.floor((Math.max(1, day) - 1) / 7) + 1;
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** deterministic pick from a list (same item, same answer) */
export const pickBy = <T>(seed: string, list: T[]): T => list[hash(seed) % list.length];

function logEv(k: EvKind, id: string, rp: number) {
  const r = r10();
  r.ev.push({ d: today(), k, id, rp });
  if (r.ev.length > 800) r.ev.splice(0, r.ev.length - 800);
}

/** the day's research report (all upload sessions of the day) */
export function daySum(day = today()): DaySum {
  const r = r10();
  let d = r.days[day];
  if (!d) {
    d = { day, photos: 0, ok: 0, species: [], beh: [], facts: [], items: [], places: [], rp: 0, sessions: 0 };
    r.days[day] = d;
    const keys = Object.keys(r.days).map(Number).sort((a, b) => a - b);
    for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete r.days[k];
  }
  return d;
}

/**
 * Pay research points from the agency: the base amount scaled by fx10.rpMult(), added to the RP
 * balance and lifetime total and logged for the day and the weekly targets. Returns what was paid.
 */
export function awardRp(base: number, k: EvKind, id: string): number {
  const rp = base > 0 ? Math.max(1, Math.round(base * fx10.rpMult())) : 0;
  const s = game.save;
  s.rp += rp;
  s.totalRp += rp;
  logEv(k, id, rp);
  daySum().rp += rp;
  return rp;
}

/** the first time something happens (for agency firsts and milestones) */
export function markFirst(key: string): boolean {
  const r = r10();
  if (r.firsts[key]) return false;
  r.firsts[key] = today();
  return true;
}
export const hadFirst = (key: string) => !!r10().firsts[key];

// ---------------------------------------------------------------- research sheet sections

/** sections of a species' research sheet revealed so far (estimated for entries made before V10) */
export function secOf(id: string): number {
  const r = r10();
  const v = r.sec[id];
  if (v !== undefined) return v;
  const e = game.save.research[id];
  if (!e) return 0;
  const est = 1 + Math.max(0, e.photos.length - 1) * 2 + e.beh.length;
  r.sec[id] = est;
  return est;
}

// ---------------------------------------------------------------- the research crate

const V2_ONLY = new Set(['ratabloom', 'pitcher', 'moonfruit', 'moss', 'glowcap', 'bracket', 'inkcap', 'lanternbeetle', 'weta', 'skymoth', 'mantis', 'dragonfly', 'grub', 'furtuft', 'scale', 'shedskin', 'dropping', 'quill', 'bone', 'eggshell', 'plate', 'fernfrond']);
/** an item only found at the old V2 field sites (not on the island) */
export const v2Only = (id: string) => V2_ONLY.has(id);

const ART_RE = /\b(artifacts?|artefacts?|taonga|relics?|carv(ed|ing)|pounamu|greenstone|hei[- ]?tiki|toki|adze|patu|mere|kete|korowai|cloak|figurine|figure|statuette|pendant|amulet|idol|potsherd|pottery|sherd|coins?|tablet|mask|waka|paddle|fish ?hook|matau|flute|comb|necklace|beads?|ornament|ceremonial|ancient|antique|heirloom)\b/i;
const FOSSIL_RE = /\b(fossils?|fossili[sz]ed|ammonites?|trilobites?|petrified|imprint|moa bone)\b/i;
const discOf = (id: string) => discoveries().find(d => d.id === id) ?? null;

/** what the crate makes of a backpack item: plants and fungi, animal/mineral samples, artifacts, fossils */
export function itemCat(id: string): ItemCat | null {
  const d = ITEMS[id];
  if (!d || d.kind === 'tool' || d.kind === 'lure') return null;
  const dk = discOf(id)?.kind;
  if (dk === 'artifact') return 'artifact';
  if (dk === 'fossil') return 'fossil';
  if (/^(fossil|fos)_/.test(id) || FOSSIL_RE.test(d.name)) return 'fossil';
  if (/^(art|artifact|artefact|taonga|relic)_/.test(id) || ART_RE.test(d.name)) return 'artifact';
  if (d.kind === 'key') return null;
  if (d.kind === 'plant' || d.kind === 'fungus') return 'flora';
  if (d.kind === 'insect' || d.kind === 'animal' || d.kind === 'shell') return 'sample';
  if (dk === 'sample' || dk === 'plant') return dk === 'plant' ? 'flora' : 'sample';
  if (d.lab) return /berr|fruit|nut|seed|leaf|root|bulb|tuber|flower|bloom|moss|fern|herb/i.test(id + ' ' + d.name) ? 'flora' : 'sample';
  return null;
}

/** lower case without macrons (so word boundaries work on te reo words) */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const TAONGA_NAME = /\b(taonga|pounamu|greenstone|hei[- ]?tiki|toki|patu|mere|kete|korowai|waka|matau|whakairo|marae|tupuna|tipuna|iwi|hapu|maori)\b/;
const TAONGA_TEXT = /\b(taonga|pounamu|whakairo|marae|tupuna|tipuna|iwi|hapu|maori|korowai|kete|hei[- ]?tiki|village|aroha's people)\b/;
/** Māori taonga (treasured objects): documented without touching, kept safe, returned to the village */
export function isTaonga(id: string): boolean {
  const d = ITEMS[id];
  if (!d || itemCat(id) !== 'artifact') return false;
  const disc = discOf(id);
  const loc = disc ? LOCATIONS.find(l => l.id === disc.loc) : null;
  if (loc?.kind === 'village' || /^taonga_/.test(id)) return true;
  return TAONGA_NAME.test(plain(`${id.replace(/_/g, ' ')} ${d.name}`)) || TAONGA_TEXT.test(plain(`${d.desc} ${d.where ?? ''} ${disc?.note ?? ''}`));
}

/** food or a crafting ingredient: only one specimen goes to the lab, the rest stays in the pack */
export function usefulItem(id: string): 'food' | 'crafting' | null {
  const d = ITEMS[id];
  if (!d) return null;
  if (d.eat || d.kind === 'food' || (d.energy ?? 0) > 0) return 'food';
  if (RECIPES.some(r => r.needs.some(([x]) => x === id))) return 'crafting';
  return null;
}

export const analysedTimes = (id: string) => Math.max(r10().lab[id]?.times ?? 0, game.save.analyzed[id] ?? 0);

export interface HandIn { id: string; n: number; take: number; cat: ItemCat; keep: 'food' | 'crafting' | null; analysed: number }
/** the backpack's research items and how many of each go to the crate by default */
export function handInPlan(): HandIn[] {
  const seen = new Set<string>();
  const out: HandIn[] = [];
  for (const st of game.save.inv) {
    if (seen.has(st.id)) continue;
    seen.add(st.id);
    const cat = itemCat(st.id);
    if (!cat) continue;
    const n = count(st.id);
    if (n <= 0) continue;
    const keep = cat === 'artifact' || cat === 'fossil' ? null : usefulItem(st.id);
    const analysed = analysedTimes(st.id);
    out.push({ id: st.id, n, take: keep ? (analysed ? 0 : 1) : n, cat, keep, analysed });
  }
  const ord: Record<ItemCat, number> = { artifact: 0, fossil: 1, sample: 2, flora: 3 };
  return out.sort((a, b) => ord[a.cat] - ord[b.cat] || +!!a.analysed - +!!b.analysed);
}
/** specimens the default plan would hand in */
export const handInCount = () => handInPlan().reduce((a, h) => a + h.take, 0);

/** the research crate is at camp: hand-ins only happen there */
export const atCamp = () => currentExpedition() === null;

export function crate(): CrateItem[] { return r10().crate; }
export const crateCount = (id: string) => r10().crate.filter(c => c.id === id && !c.returned).reduce((a, c) => a + c.n, 0);
/** take specimens back out of the crate (crafting, or giving something back); returns how many */
export function takeFromCrate(id: string, n = 1): number {
  let left = n;
  for (const c of r10().crate) {
    if (c.id !== id || c.returned || left <= 0) continue;
    const k = Math.min(c.n, left);
    c.n -= k;
    left -= k;
  }
  r10().crate = r10().crate.filter(c => c.n > 0);
  game.persist();
  return n - left;
}
/** a taonga has gone home to its village (stays in the encyclopedia, leaves the crate) */
export function markReturned(id: string) {
  for (const c of r10().crate) if (c.id === id && !c.returned) c.returned = today();
  game.persist();
}
export const returnedDay = (id: string) => r10().crate.find(c => c.id === id && c.returned)?.returned ?? 0;

export interface LabOutcome {
  id: string; name: string; cat: ItemCat;
  /** specimens handed in this time */
  n: number;
  /** first analysis of this item type */
  first: boolean;
  /** replicates filed this time (extra specimens that still taught something) */
  reps: number;
  rp: number;
  text: string;
  lines: string[];
  generic: boolean;
  taonga: boolean;
  clue?: { id: string; name: string; isNew: boolean };
  species?: { id: string; name: string; documented: boolean };
  /** a lab.fact that is not a field-guide fact id: a fun fact */
  fact?: string;
  /** first of its kind ever (first artifact, first fossil...) */
  firstOfCat: boolean;
}

const BASE_RP: Record<ItemCat, number> = { flora: 6, sample: 8, artifact: 20, fossil: 18 };
const REP_MAX = 3;

/** measurement lines for an analysis (stable for an item) */
function measure(id: string, cat: ItemCat, taonga: boolean): string[] {
  const h = hash(id);
  const code = `ZEA-${String(h % 9000 + 1000)}-${id.slice(0, 3).toUpperCase()}`;
  const mass = cat === 'artifact' || cat === 'fossil' ? 40 + (h % 900) : 1 + ((h >> 4) % 60) / 4;
  const len = 2 + ((h >> 9) % 200) / 10;
  if (taonga) return [`Catalogue ${code}`, `Photographed from 12 angles · ${len.toFixed(1)} cm`, 'Not cleaned, not sampled, not altered'];
  if (cat === 'artifact') return [`Catalogue ${code}`, `${len.toFixed(1)} cm · ${mass} g`, 'Surface scan only: no samples taken'];
  if (cat === 'fossil') return [`Catalogue ${code}`, `${len.toFixed(1)} cm · ${mass} g`, `Matrix: ${pickBy(id + 'm', ['mudstone', 'sandstone', 'limestone', 'volcanic ash', 'siltstone'])}`];
  return [`Sample ${code}`, `${mass.toFixed(1)} g`, pickBy(id + 's', ['Microscope ×400', 'Spectrometer scan', 'Stain and slide', 'Chemical panel', 'DNA barcode (partial)'])];
}

/** the laptop's best guess about an item with no lab sheet (fun, and stable per item) */
function genericResult(id: string, name: string, cat: ItemCat, taonga: boolean): string {
  if (taonga) return pickBy(id, [
    `Documented with care and without touching the worked surfaces. What the ${name} is, who made it and what it means are not Mori's to guess: its story belongs to its people, and Aroha says the right thing to do is ask.`,
    `Recorded in photographs and measurements only. Some objects carry the whakapapa of a family; this one is kept wrapped and safe at camp until it can go home.`,
  ]);
  const P: Record<ItemCat, string[]> = {
    flora: [
      `Cell walls thick, chlorophyll present, opinions mixed. The ${name} is definitely a plant, which narrows it down to about 400,000 possibilities.`,
      `62% water, 30% fibre, 8% mystery. Mori sniffed it and it smells green. The lab software agrees.`,
      `Under the microscope the ${name} is a city of tiny cells. One of them appears to contain a springtail. Hello, springtail.`,
      `Leaf pores (stomata) are packed tight: a plant that hates losing water. Sensible, given the salt wind.`,
    ],
    sample: [
      `Contains salt, sand, keratin and one (1) pug hair. The pug hair has been removed from the data. The pug has not been removed from the lab.`,
      `The spectrometer reads it as "organic, crunchy". Mori has filed a complaint with the spectrometer.`,
      `Under the microscope the ${name} looks exactly like a ${name}, but enormous. Science.`,
      `DNA barcode is partial, but it is definitely from something alive, recently, and probably annoyed about it.`,
    ],
    fossil: [
      `Mineralised all the way through. Older than the laptop, the Kittiwake and Joshu's jokes combined.`,
      `The agency's palaeontologist replied to the scan with seven exclamation marks and no words.`,
      `A perfect impression in the stone, down to fine ridges. Something lived and died here long before the island had a name.`,
    ],
    artifact: [
      `Hand-made and worn smooth by use. Whoever made the ${name} had more patience than Mori, and better tools.`,
      `Tool marks under the microscope: cut, ground, polished. Made with intent, kept with care.`,
      `Surface scan only. The ${name} has a story, and the laptop knows none of it. Filed as a question, not an answer.`,
    ],
  };
  return pickBy(id, P[cat]);
}

/**
 * Hand specimens of one item type in to the research crate and analyse them: the first specimen
 * is the full analysis (ItemDef.lab, or a generic result), up to three later ones are replicates
 * worth a fifth of it, the rest are filed. Artifacts and fossils are never consumed: they stay in the
 * crate (taonga until they can go back to their village). Returns null if there is nothing to hand in.
 */
export function handIn(id: string, take: number): LabOutcome | null {
  const def = ITEMS[id];
  const cat = itemCat(id);
  const n = Math.min(take, count(id));
  if (!def || !cat || n <= 0 || !atCamp()) return null;
  remove(id, n);
  const r = r10();
  const s = game.save;
  const old = r.crate.find(c => c.id === id && !c.returned);
  if (old) old.n += n; else r.crate.push({ id, n, day: today(), cat });
  const taonga = isTaonga(id);
  const prev = analysedTimes(id);
  const first = prev === 0;
  const base = def.lab?.rp ?? BASE_RP[cat];
  const repsLeft = cat === 'artifact' || cat === 'fossil' ? 0 : Math.max(0, REP_MAX - Math.max(0, prev - 1));
  const reps = Math.min(repsLeft, n - (first ? 1 : 0));
  // one ledger entry per hand-in that taught something (the weekly target counts these)
  const pay = (first ? base : 0) + (reps > 0 ? Math.max(1, Math.round(base * 0.2)) * reps : 0);
  let rp = 0;
  if (pay > 0) rp = awardRp(pay, cat, id); else logEv(cat, id + ':filed', 0);
  const firstOfCat = first && (cat === 'artifact' || cat === 'fossil') && markFirst('first:' + cat);
  if (firstOfCat) rp += awardRp(25, 'bonus', 'first:' + cat);
  const lines = measure(id, cat, taonga);
  const generic = !def.lab;
  const text = def.lab?.text ?? genericResult(id, def.name, cat, taonga);
  const times = prev + n;
  const rec = r.lab[id];
  if (rec) { rec.times = Math.max(rec.times, times); rec.rp += rp; }
  else r.lab[id] = { day: today(), times, rp, text, lines, generic, cat };
  s.analyzed[id] = Math.max(s.analyzed[id] ?? 0, times);
  s.flags['v10:researched:' + id] = true;
  s.vars['analyses'] = (s.vars['analyses'] ?? 0) + 1;
  const out: LabOutcome = {
    id, name: def.name, cat, n, first, reps, rp, generic, taonga, firstOfCat,
    text: first ? text : reps ? `Replicate${reps === 1 ? '' : 's'} filed: consistent with the first sample.` : cat === 'artifact' || cat === 'fossil' ? 'Another one, catalogued beside the first.' : 'Already catalogued. Filed in the crate.',
    lines: first ? lines : [],
  };
  if (first && def.lab?.clue) { const isNew = addClue(def.lab.clue); out.clue = { id: def.lab.clue, name: CLUE_BY_ID[def.lab.clue]?.name ?? def.lab.clue, isNew }; }
  if (def.lab?.species) {
    s.hints[def.lab.species] = true;
    const sp = SPECIES_BY_ID[def.lab.species];
    if (sp) out.species = { id: sp.id, name: sp.name, documented: !!s.research[sp.id] };
  }
  if (first && def.lab?.fact && !Object.values(SPECIES_BY_ID).some(sp => sp.facts.some(f => f.id === def.lab!.fact))) out.fact = def.lab.fact;
  daySum().items.push(id);
  game.persist();
  return out;
}

// ---------------------------------------------------------------- field notes (map discoveries)

export const PLACE_KINDS: DiscoveryKind[] = ['location', 'landmark', 'village', 'ruin', 'cave', 'ecosystem'];
const NOTE_RP: Record<DiscoveryKind, number> = { location: 10, landmark: 6, village: 15, ruin: 12, cave: 10, ecosystem: 12, artifact: 12, fossil: 12, plant: 5, species: 3, sample: 4 };

/** the map's discoveries not filed into the encyclopedia yet (oldest first) */
export function pendingNotes(): Discovery[] {
  const f = r10().filed;
  return discoveries().filter(d => !f[d.id]).sort((a, b) => a.day - b.day);
}
export const filedDay = (id: string) => r10().filed[id] ?? 0;
/** file a discovery's field note: RP by kind; places also count for the day and the weekly targets */
export function fileNote(d: Discovery): number {
  const r = r10();
  if (r.filed[d.id]) return 0;
  r.filed[d.id] = today();
  const place = PLACE_KINDS.includes(d.kind);
  const rp = awardRp(NOTE_RP[d.kind] ?? 5, place ? 'place' : 'note', d.id);
  if (place) daySum().places.push(d.id);
  game.persist();
  return rp;
}

/** everything waiting at the laptop: photos, specimens for the crate (at camp) and field notes */
export const uploadDueCount = () => pendingCount() + (atCamp() ? handInCount() : 0) + pendingNotes().length;

// ---------------------------------------------------------------- upload sessions & weekly targets

/** one run of uploads (the Camera app or Upload Everything), for the day report and the agency */
export interface Session {
  day: number;
  photos: number;
  /** photos with something identified */
  ok: number;
  species: string[];
  beh: [string, string][];
  facts: [string, Fact][];
  items: LabOutcome[];
  notes: { d: Discovery; rp: number }[];
  rp: number;
}
export const newSession = (): Session => ({ day: today(), photos: 0, ok: 0, species: [], beh: [], facts: [], items: [], notes: [], rp: 0 });
/** fold one photo upload into a session */
export function addUpload(ses: Session, o: UploadOutcome) {
  ses.photos++;
  if (o.found.some(f => f.ok)) ses.ok++;
  ses.species.push(...o.newSpecies);
  ses.beh.push(...o.newBeh);
  ses.facts.push(...o.newFacts);
  ses.rp += o.rp;
}
/** a session is over: count it for the day */
export function endSession(ses: Session) {
  if (ses.photos || ses.items.length || ses.notes.length) daySum(ses.day).sessions++;
  game.persist();
}

export type TargetKey = 'species' | 'beh' | 'items' | 'places' | 'photos';
export interface Target { k: TargetKey; label: string; need: number; have: number }
export interface Week { week: number; days: [number, number]; targets: Target[]; bonus: number; met: boolean; paid: boolean }

const evKinds: Record<TargetKey, EvKind[]> = { species: ['species'], beh: ['beh'], items: ['flora', 'sample', 'artifact', 'fossil'], places: ['place'], photos: ['photo'] };
/** the agency's targets for a week (they grow week by week) and the progress made so far */
export function weekTargets(w = weekNo()): Week {
  const d0 = (w - 1) * 7 + 1, d1 = w * 7;
  const ev = r10().ev.filter(e => e.d >= d0 && e.d <= d1 && !e.id.endsWith(':filed'));
  const have = (k: TargetKey) => ev.filter(e => evKinds[k].includes(e.k)).length;
  const places = LOCATIONS.length > 0 || discoveries().length > 0;
  const T = (k: TargetKey, label: string, need: number): Target => ({ k, label, need, have: Math.min(need, have(k)) });
  const targets = [T('species', 'New species documented', 2 + w), T('items', 'Samples & finds analysed', 2 + w * 2)];
  targets.push(places && w >= 2 ? T('places', 'Places filed', w - 1) : T('beh', 'Behaviours recorded', 1 + w * 2));
  const st = r10().weeks[w];
  return { week: w, days: [d0, d1], targets, bonus: 20 + 15 * w, met: targets.every(t => t.have >= t.need), paid: st === 'met' };
}
/** pay the weekly bonus once the targets are met; returns the RP paid (0 if not due) */
export function claimWeek(w = weekNo()): number {
  const wk = weekTargets(w);
  if (!wk.met || wk.paid) return 0;
  r10().weeks[w] = 'met';
  const rp = awardRp(wk.bonus, 'bonus', 'week:' + w);
  game.persist();
  return rp;
}

// ---------------------------------------------------------------- the agency mailbox

export const mails = () => r10().mail;
export const unreadMail = () => r10().mail.filter(m => !m.read).length;
export function addMail(m: Omit<Mail, 'day'> & { day?: number }): Mail | null {
  const r = r10();
  if (r.mail.some(x => x.id === m.id)) return null;
  const full: Mail = { ...m, day: m.day ?? today() };
  r.mail.push(full);
  if (r.mail.length > 80) r.mail.splice(0, r.mail.length - 80);
  game.persist();
  return full;
}
export function markMailRead(id: string) {
  const m = r10().mail.find(x => x.id === id);
  if (m && !m.read) { m.read = true; game.persist(); }
}

// ---------------------------------------------------------------- encyclopedia bookkeeping

export const encSeen = (key: string) => !!r10().seen[key];
export function markEncSeen(key: string) {
  const r = r10();
  if (r.seen[key]) return;
  r.seen[key] = today();
  game.persist();
}

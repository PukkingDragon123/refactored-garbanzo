// V9 research: the camera -> laptop pipeline. Photos stay on the camera (save.raw) until they are
// uploaded in MoriOS. Uploading stores a downscaled copy (save.uploads), frees the camera copy and
// runs the identification rules of ../photos on every animal in frame. An identified animal creates
// or extends its species' research log entry (save.research): that photo, the behaviours it shows,
// and any field-guide findings (Fact.evidence) whose evidence has now been uploaded. Undocumented
// species have no entry at all.
// Also: the field laptop on the island (flag v9:laptop): HUD button, L hotkey, the camp table.

import { game } from '../game';
import type { RawPhoto, PhotoSubject } from '../photos';
import { judgeSubject, idProblem, NEW_SPECIES_RP, NEW_EVIDENCE_RP } from '../photos';
import { SPECIES_BY_ID } from '../species';
import type { Species, Fact, Evidence } from '../species';
import type { UploadRecord, UploadSubject, ResearchEntry } from '../save';
import { addEvidence, FACT_RP } from '../research';
import { questStatus } from '../quests';
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

/** what the laptop makes of a photo: one finding per species in frame, identified ones first */
export function analyse(p: RawPhoto): Finding[] {
  const by = new Map<string, PhotoSubject[]>();
  for (const s of p.subjects) { const l = by.get(s.species) ?? []; l.push(s); by.set(s.species, l); }
  const out: Finding[] = [];
  for (const [id, subs] of by) {
    const sp = SPECIES_BY_ID[id] ?? null;
    const judged = subs.map(s => ({ s, j: judgeSubject(s, p) }));
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
  for (const f of found) {
    if (!f.ok || !f.sp) continue;
    let e = s.research[f.species];
    if (!e) {
      e = { first: rec.id, cover: rec.id, photos: [], beh: [], vid: [], facts: [], day: rec.day, n: Object.keys(s.research).length + 1, stars: 0, fresh: true };
      s.research[f.species] = e;
      out.newSpecies.push(f.species);
      out.rp += NEW_SPECIES_RP;
    }
    if (!e.photos.includes(rec.id)) e.photos.push(rec.id);
    e.stars = Math.max(e.stars, f.stars);
    for (const b of f.beh) {
      if (p.video && !e.vid.includes(b)) e.vid.push(b);
      if (!(b in f.sp.behaviors) || e.beh.includes(b)) continue;
      e.beh.push(b);
      out.newBeh.push([f.species, b]);
      out.rp += NEW_EVIDENCE_RP;
    }
    // the old field-guide bookkeeping (sightings, evidence) follows the uploads too
    addEvidence(f.species, null, p.video);
    for (const b of f.beh) addEvidence(f.species, b, p.video);
  }
  // findings: any fact of a documented species whose evidence has now all been uploaded
  for (const [id, e] of Object.entries(s.research)) {
    const sp = SPECIES_BY_ID[id];
    if (!sp) continue;
    for (const f of sp.facts) {
      if (e.facts.includes(f.id) || !f.evidence.every(evidenceUploaded)) continue;
      e.facts.push(f.id);
      s.facts[f.id] = true;
      out.newFacts.push([id, f]);
      out.rp += FACT_RP;
    }
  }
  s.rp += out.rp;
  s.totalRp += out.rp;
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
  s.hud?.setLaptop({ shown: hasFieldLaptop, badge: pendingCount, open: () => void openFieldLaptop(s) });
}

// Raw (unreviewed) photos and the review step.
// A shutter press stores what the camera actually saw: every animal in frame with how visible,
// sharp, large and well-placed it was. Nothing counts until the photo is reviewed and the animals
// in it are tagged by the player; blurry or obstructed animals can't be identified.

import type { TimeOfDay } from '../world/timeofday';
import type { SiteId } from './species';
import { SPECIES_BY_ID } from './species';
import { game } from './game';
import { perks } from './skills';
import { fx10 } from './v10/skills10';
import { addEvidence } from './research';
import type { PhotoRecord } from './save';

export interface PhotoSubject {
  species: string;
  behavior: string | null;
  /** normalised photo coordinates x0, y0, x1, y1 (0..1, y down) */
  bbox: [number, number, number, number];
  /** unobstructed fraction of the silhouette (leaves, branches, rocks in front) */
  visible: number;
  /** fraction of the silhouette inside the frame */
  inFrame: number;
  /** 1 = perfectly in the focal plane */
  focus: number;
  /** 1 = frozen, 0 = smeared by subject movement */
  motion: number;
  /** 1 = steady, 0 = ruined by camera shake */
  shake: number;
  /** subject height as a fraction of the frame height */
  size: number;
  /** how much of the head/face is visible (0 = rear view) */
  facing: number;
  /** composition: 1 = on a thirds power point or well centred */
  centre: number;
  /** the animal was reacting to the photographer (fleeing / staring) */
  noticed: boolean;
  juvenile?: boolean;
  /** how many of this species are in frame */
  group?: number;
}

export interface RawPhoto {
  id: number;
  /** jpeg data URL, blur/shake baked in */
  img: string;
  site: SiteId | 'camp' | 'sea';
  time: TimeOfDay;
  day: number;
  video: boolean;
  /** 0..1 exposure quality (dark night shots without a lamp are poor) */
  light: number;
  subjects: PhotoSubject[];
  /** what the autofocus locked onto: a species id, 'foreground' (a leaf!) or null */
  af: string | null;
  notes: string[];
}

/** what stopped an identification (see judgeSubject) */
export type IdProblem = 'frame' | 'hidden' | 'small' | 'dark' | 'leaf' | 'focus' | 'motion' | 'shake';

export interface Judgement {
  identified: boolean;
  /** why identification failed */
  reason?: string;
  /** the same, as a code */
  code?: IdProblem;
  score: number;
  stars: number;
  sharp: number;
}

export interface ReviewHit {
  subject: PhotoSubject;
  judge: Judgement;
  name: string;
  newSpecies: boolean;
  evidence: string[];
  rp: number;
}

export interface ReviewResult {
  photo: RawPhoto;
  hits: ReviewHit[];
  /** tags that hit nothing */
  misses: number;
  /** subjects the player didn't tag */
  missed: number;
  stars: number;
  rp: number;
  kept: boolean;
}

const MAX_RAW = 30;
export const STAR_RP = [0, 3, 6, 12, 20, 32];
export const NEW_SPECIES_RP = 25;
export const NEW_EVIDENCE_RP = 8;

export function rawPhotos(): RawPhoto[] {
  return game.save.raw;
}

export function addRawPhoto(p: Omit<RawPhoto, 'id'>): RawPhoto {
  const s = game.save;
  const photo: RawPhoto = { ...p, id: s.photoId++ };
  s.raw.push(photo);
  if (s.raw.length > MAX_RAW) s.raw.splice(0, s.raw.length - MAX_RAW);
  game.persist();
  return photo;
}

export function deleteRawPhoto(id: number) {
  const s = game.save;
  s.raw = s.raw.filter(p => p.id !== id);
  game.persist();
}

/** Subject under a normalised click point (small tolerance). Prefers the smallest box. */
export function subjectAt(p: RawPhoto, x: number, y: number, tol = 0.02): PhotoSubject | null {
  let best: PhotoSubject | null = null, area = Infinity;
  for (const s of p.subjects) {
    const [x0, y0, x1, y1] = s.bbox;
    if (x >= x0 - tol && x <= x1 + tol && y >= y0 - tol && y <= y1 + tol) {
      const a = (x1 - x0) * (y1 - y0);
      if (a < area) { area = a; best = s; }
    }
  }
  return best;
}

export function sharpness(s: PhotoSubject) {
  return s.focus * s.motion * s.shake;
}

/** Decide whether an animal in a photo can be identified, and how good the shot of it is. */
export function judgeSubject(s: PhotoSubject, p: RawPhoto): Judgement {
  const sharp = sharpness(s);
  const fail = (reason: string, code: IdProblem): Judgement => ({ identified: false, reason, code, score: 0, stars: 0, sharp });
  // V10 Research skills: identify from blurrier, smaller, more hidden animals
  const idb = fx10.idBonus();
  if (s.inFrame < 0.35 * (1 - idb * 0.3)) return fail('Mostly out of frame', 'frame');
  if (s.visible < perks.idVisible() * (1 - idb * 0.4)) return fail(`Hidden behind cover (${Math.round(s.visible * 100)}% visible)`, 'hidden');
  if (s.size < 0.045 * (1 - idb * 0.45)) return fail('Too far away to identify', 'small');
  if (p.light < 0.25 && !perks.nightClean()) return fail('Too dark to make out', 'dark');
  if (sharp < perks.idSharp() * (1 - idb * 0.45)) {
    const worst = Math.min(s.focus, s.motion, s.shake);
    return worst === s.focus ? (p.af === 'foreground' ? fail('The focus grabbed a leaf in front', 'leaf') : fail('Out of focus', 'focus')) : worst === s.motion ? fail('Motion blur, it moved too fast', 'motion') : fail('Camera shake', 'shake');
  }
  // size: ideal is roughly a quarter to two-thirds of the frame height
  const sizeK = s.size < 0.25 ? s.size / 0.25 : s.size > 0.85 ? Math.max(0.5, 1 - (s.size - 0.85) * 2) : 1;
  let score =
    0.26 * Math.min(1, sharp / 0.85) +
    0.18 * Math.min(1, (s.visible - 0.3) / 0.6) +
    0.18 * sizeK +
    0.1 * s.centre +
    0.1 * s.facing +
    0.1 * Math.min(1, s.inFrame) +
    0.08 * Math.min(1, p.light + (perks.nightClean() ? 0.4 : 0));
  if (s.behavior) score += 0.12;
  if (s.noticed && s.behavior !== 'threat' && s.behavior !== 'alert') score -= 0.08;
  const rarity = SPECIES_BY_ID[s.species]?.rarity ?? 1;
  score += (rarity - 1) * 0.02;
  score = Math.max(0, Math.min(1, score));
  let stars = score >= 0.84 ? 5 : score >= 0.7 ? 4 : score >= 0.55 ? 3 : score >= 0.38 ? 2 : 1;
  if (s.behavior && fx10.behaviourStar()) stars = Math.min(5, stars + 1);
  return { identified: true, score, stars, sharp };
}

/**
 * Review a raw photo with the player's tags (normalised click points).
 * Identified subjects count as sightings, give evidence and RP. keep=true files the photo in the album.
 * The photo is removed from the raw roll either way.
 */
export function reviewPhoto(id: number, tags: [number, number][], keep: boolean): ReviewResult | null {
  const s = game.save;
  const p = s.raw.find(r => r.id === id);
  if (!p) return null;
  const tagged = new Set<PhotoSubject>();
  let misses = 0;
  for (const [x, y] of tags) {
    const sub = subjectAt(p, x, y);
    if (sub) tagged.add(sub);
    else misses++;
  }
  const hits: ReviewHit[] = [];
  let rp = 0, best = 0;
  for (const sub of tagged) {
    const judge = judgeSubject(sub, p);
    const sp = SPECIES_BY_ID[sub.species];
    const hit: ReviewHit = { subject: sub, judge, name: sp?.name ?? sub.species, newSpecies: false, evidence: [], rp: 0 };
    if (judge.identified && sp) {
      hit.newSpecies = !s.seen[sub.species];
      const ev = addEvidence(sub.species, judge.stars >= 2 ? sub.behavior : null, p.video);
      hit.evidence = ev;
      hit.rp = STAR_RP[judge.stars] * (1 + (sp.rarity - 1) * 0.25);
      if (hit.newSpecies) hit.rp += NEW_SPECIES_RP;
      hit.rp += ev.filter(e => !e.startsWith('New species')).length * NEW_EVIDENCE_RP;
      hit.rp = Math.round(hit.rp * perks.rpMul());
      rp += hit.rp;
      best = Math.max(best, judge.stars);
      const prev = s.best[sub.species];
      if (!prev || prev.stars < judge.stars) s.best[sub.species] = { thumb: p.img, stars: judge.stars, behavior: sub.behavior };
      s.vars['identified'] = (s.vars['identified'] ?? 0) + 1;
    }
    hits.push(hit);
  }
  const missed = p.subjects.filter(x => !tagged.has(x)).length;
  s.rp += rp;
  s.totalRp += rp;
  s.vars['reviewed'] = (s.vars['reviewed'] ?? 0) + 1;
  s.raw = s.raw.filter(r => r !== p);
  if (keep) {
    const main = hits.filter(h => h.judge.identified).sort((a, b) => b.judge.stars - a.judge.stars)[0];
    const rec: PhotoRecord = {
      id: p.id, species: main?.subject.species ?? null, behavior: main?.subject.behavior ?? null,
      others: hits.filter(h => h !== main && h.judge.identified).map(h => h.subject.species),
      stars: best, score: main?.judge.score ?? 0, site: p.site, time: p.time, video: p.video, thumb: p.img, notes: p.notes,
    };
    s.album.push(rec);
  }
  game.persist();
  return { photo: p, hits, misses, missed, stars: best, rp, kept: keep };
}

/** the bit of an animal that pokes into the frame when the rest of it is cropped off */
const CROP_PART: Record<string, string> = {
  Bird: 'a wingtip', Fish: 'a tail', Mammal: 'a tail', Reptile: 'a tail', Amphibian: 'a tail', Serpent: 'a tail',
  Crustacean: 'a leg', Insect: 'a leg', Arachnid: 'a leg', Mollusc: 'a tentacle', Cnidarian: 'a tentacle', Worm: 'a wriggly end', Parasite: 'a speck',
};

/** V9 laptop upload: a failed identification in plain words ('Too blurry to identify', 'Only a tail in frame') */
export function idProblem(j: Judgement, s: PhotoSubject): string {
  switch (j.code) {
    case 'frame': return `Only ${CROP_PART[SPECIES_BY_ID[s.species]?.group ?? ''] ?? 'a sliver'} in frame`;
    case 'hidden': return `Hidden behind something (${Math.round(s.visible * 100)}% visible)`;
    case 'small': return 'Too small to identify: just a speck';
    case 'dark': return 'Too dark to make out';
    case 'leaf': return 'Out of focus: the focus grabbed the foreground';
    case 'focus': return 'Out of focus';
    case 'motion': return 'Too blurry to identify: it moved';
    case 'shake': return 'Too blurry to identify: camera shake';
  }
  return j.reason ?? 'Not identifiable';
}

/** Best-case preview used by the camera HUD right after a shot ("looks sharp" / "blurry"). */
export function quickVerdict(p: RawPhoto): string {
  if (!p.subjects.length) return p.af === 'foreground' ? 'Focused on the foliage.' : 'No animals in frame.';
  const j = p.subjects.map(s => judgeSubject(s, p));
  const ok = j.filter(x => x.identified);
  if (!ok.length) return j[0].reason ?? 'Unusable.';
  return ok.length > 1 ? `${ok.length} animals, looks usable` : 'Looks usable';
}

// V12 what a photo is worth: every identified animal in a shot gets a shot key (who, doing what, how
// it is framed, where, by day or night, and with whom), and the shot ledger remembers the best stars
// each key has been paid for. A new key pays by its stars; the same picture again pays nothing; the
// same picture done better pays only the difference. So the loop rewards a new angle, a new behaviour,
// a new place or a rare meeting, and never a burst of the same frame.
//
// The field camera stamps the verdict on the instant print the moment the shutter fires (fieldcam.ts)
// and the laptop pays it on upload (src/game/v9/research9.ts uploadPhoto).

import { game } from '../game';
import { bucket } from '../v10/store';
import { SPECIES_BY_ID } from '../species';
import { judgeSubject } from '../photos';
import type { PhotoSubject, RawPhoto } from '../photos';

/** points for a new shot by its stars (0..5) */
export const SHOT_PTS = [0, 2, 4, 7, 11, 16];

export type ShotKind = 'new' | 'better' | 'same' | 'blurry' | 'empty';

export interface ShotVerdict {
  species: string;
  key: string;
  stars: number;
  kind: ShotKind;
  /** points this shot is worth (0 for a repeat) */
  pts: number;
  /** the best stars already paid for this key (0 if never) */
  had: number;
}

interface Ledger { best: Record<string, number>; n: number }
const ledger = () => bucket<Ledger>('shots', () => ({ best: {}, n: 0 }));

const frameOf = (s: PhotoSubject) => (s.size < 0.16 ? 'wide' : s.size < 0.42 ? 'mid' : 'close');
const behOf = (s: PhotoSubject) => s.behavior ?? 'still';

/** the shot key: the things that make one photo of an animal a different picture from another */
export function shotKey(s: PhotoSubject, p: Pick<RawPhoto, 'site' | 'time' | 'subjects'>): string {
  const face = s.facing >= 0.5 ? 'face' : 'side';
  const herd = (s.group ?? 1) > 1 ? 'herd' : 'solo';
  const night = p.time === 'night' ? 'night' : 'day';
  // two species in one frame is its own picture (a hunt, a fight, a theft)
  const others = [...new Set(p.subjects.filter(o => o.species !== s.species && o.visible > 0.3).map(o => o.species))].sort();
  const withK = others.length ? 'with:' + others.join('+') : '';
  return [s.species, behOf(s), frameOf(s), face, herd, p.site, night, withK].join('|');
}

/** the identified subjects of a photo, the best one per species */
function bestPerSpecies(p: RawPhoto): { s: PhotoSubject; stars: number }[] {
  const by = new Map<string, { s: PhotoSubject; stars: number; score: number }>();
  for (const s of p.subjects) {
    if (!SPECIES_BY_ID[s.species]) continue;
    const j = judgeSubject(s, p);
    if (!j.identified) continue;
    const cur = by.get(s.species);
    if (!cur || j.score > cur.score) by.set(s.species, { s, stars: j.stars, score: j.score });
  }
  return [...by.values()];
}

/**
 * Judge a photo against the ledger (and, for a shot still on the camera, against the other photos on
 * the roll): one verdict per species identified. Nothing is recorded.
 */
export function judgeShot(p: RawPhoto, roll: RawPhoto[] = []): ShotVerdict[] {
  const best = ledger().best;
  // what the other photos on the camera already cover (they will be paid first on upload)
  const pending = new Map<string, number>();
  for (const o of roll) {
    if (o.id === p.id) continue;
    for (const { s, stars } of bestPerSpecies(o)) {
      const k = shotKey(s, o);
      pending.set(k, Math.max(pending.get(k) ?? 0, stars));
    }
  }
  const out: ShotVerdict[] = [];
  for (const { s, stars } of bestPerSpecies(p)) {
    const key = shotKey(s, p);
    const had = Math.max(best[key] ?? 0, pending.get(key) ?? 0);
    const pts = Math.max(0, SHOT_PTS[stars] - SHOT_PTS[had]);
    const kind: ShotKind = had === 0 ? 'new' : pts > 0 ? 'better' : 'same';
    out.push({ species: s.species, key, stars, kind, pts, had });
  }
  return out.sort((a, b) => b.pts - a.pts);
}

/**
 * While aiming: is the picture in the viewfinder of `species` one already on file (paid, or on the
 * roll)? Returns the best stars on file for that framing (0 = a new picture).
 */
export function onFile(subjects: PhotoSubject[], species: string, site: RawPhoto['site'], time: RawPhoto['time'], roll: RawPhoto[]): number {
  const s = subjects.filter(x => x.species === species).sort((a, b) => b.size * b.visible - a.size * a.visible)[0];
  if (!s) return 0;
  const key = shotKey(s, { site, time, subjects });
  let had = ledger().best[key] ?? 0;
  for (const o of roll) for (const { s: os, stars } of bestPerSpecies(o)) if (os.species === species && shotKey(os, o) === key) had = Math.max(had, stars);
  return had;
}

/** one word for the whole photo: the best verdict in it, or why it is worth nothing */
export function photoVerdict(p: RawPhoto, v: ShotVerdict[]): { kind: ShotKind; pts: number } {
  if (!v.length) return { kind: p.subjects.length ? 'blurry' : 'empty', pts: 0 };
  const pts = v.reduce((a, x) => a + x.pts, 0);
  const kind: ShotKind = v.some(x => x.kind === 'new') ? 'new' : v.some(x => x.kind === 'better') ? 'better' : 'same';
  return { kind, pts };
}

/** pay a photo on upload: records each key's best stars and returns the verdicts (with the points due) */
export function recordShot(p: RawPhoto): ShotVerdict[] {
  const L = ledger();
  const v = judgeShot(p);
  for (const x of v) if (x.stars > (L.best[x.key] ?? 0)) L.best[x.key] = x.stars;
  L.n++;
  game.persist();
  return v;
}

/** how many different pictures have been paid for (all species, or one) */
export function shotsKnown(species?: string): number {
  const keys = Object.keys(ledger().best);
  return species ? keys.filter(k => k.startsWith(species + '|')).length : keys.length;
}

/** the short words stamped on a print (and on the upload screen) */
export function verdictWords(kind: ShotKind, pts: number): { word: string; small: string; ink: string } {
  switch (kind) {
    case 'new': return { word: `NEW +${pts}`, small: 'A picture you did not have', ink: '#2f7d32' };
    case 'better': return { word: `BETTER +${pts}`, small: 'A better take on one you had', ink: '#2d6aa0' };
    case 'same': return { word: 'SAME SHOT', small: 'You already have this picture: no points', ink: '#a3301f' };
    case 'blurry': return { word: 'NO ID', small: 'Too poor to identify anything', ink: '#6b5a44' };
    default: return { word: 'NO ANIMAL', small: 'Nothing to research in this one', ink: '#6b5a44' };
  }
}

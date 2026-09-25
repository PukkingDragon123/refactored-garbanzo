// Evidence bookkeeping and fact deduction.

import { game } from './game';
import { Evidence, Fact, SPECIES_BY_ID, CLUE_BY_ID } from './species';
import { audio } from '../core/audio';

export const evKey = (species: string, behavior: string) => `${species}:${behavior}`;

export function hasEvidence(e: Evidence) {
  const s = game.save;
  if (e.kind === 'photo') return !!s.evPhoto[evKey(e.species, e.behavior)] || !!s.evVideo[evKey(e.species, e.behavior)];
  if (e.kind === 'video') return !!s.evVideo[evKey(e.species, e.behavior)];
  return !!s.clues[e.clue];
}

export function evidenceLabel(e: Evidence) {
  if (e.kind === 'clue') return CLUE_BY_ID[e.clue]?.name ?? e.clue;
  const sp = SPECIES_BY_ID[e.species];
  const beh = sp?.behaviors[e.behavior] ?? e.behavior;
  const name = game.save.seen[e.species] ? sp.name : '???';
  return `${e.kind === 'video' ? 'Video' : 'Photo'}: ${name} — ${beh}`;
}

export function factState(f: Fact): 'solved' | 'ready' | 'locked' {
  if (game.save.facts[f.id]) return 'solved';
  return f.evidence.every(hasEvidence) ? 'ready' : 'locked';
}

export function readyFactCount() {
  let n = 0;
  for (const sp of Object.values(SPECIES_BY_ID)) for (const f of sp.facts) if (factState(f) === 'ready') n++;
  return n;
}

export const FACT_RP = 30;

export function solveFact(f: Fact) {
  game.save.facts[f.id] = true;
  game.save.rp += FACT_RP;
  game.save.totalRp += FACT_RP;
  audio.play('fact');
  game.persist();
}

/** Record evidence from a photo/video; returns list of newly gained evidence labels. */
export function addEvidence(species: string, behavior: string | null, video: boolean): string[] {
  const s = game.save;
  const out: string[] = [];
  if (!s.seen[species]) {
    s.seen[species] = true;
    out.push(`New species: <b>${SPECIES_BY_ID[species].name}</b>`);
  }
  if (behavior) {
    const k = evKey(species, behavior);
    const map = video ? s.evVideo : s.evPhoto;
    if (!map[k]) {
      map[k] = true;
      out.push(`${video ? 'Video' : 'Photo'} evidence: ${SPECIES_BY_ID[species].name} — ${SPECIES_BY_ID[species].behaviors[behavior] ?? behavior}`);
    }
  }
  return out;
}

export function addClue(id: string) {
  if (game.save.clues[id]) return false;
  game.save.clues[id] = true;
  return true;
}

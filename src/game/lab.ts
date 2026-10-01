// Laptop sample analysis: turn collected specimens into research points, clues and species hints.

import { game } from './game';
import { ITEMS, isSample } from './items';
import { count, remove } from './inventory';
import { perks } from './skills';
import { fx10 } from './v10/skills10';
import { addClue } from './research';
import { CLUE_BY_ID, SPECIES_BY_ID } from './species';

export interface LabResult {
  item: string;
  name: string;
  rp: number;
  text: string;
  /** a field-guide clue unlocked by this analysis */
  clue?: string;
  clueName?: string;
  clueNew: boolean;
  /** species this sample points to (hint only; doesn't count as a sighting) */
  species?: string;
  speciesName?: string;
  first: boolean;
  /** how many times this sample type has been analysed, including this one */
  times: number;
}

/** Samples in the backpack that the lab can analyse. */
export function labSamples(): { id: string; n: number; times: number }[] {
  const out: { id: string; n: number; times: number }[] = [];
  const seen = new Set<string>();
  for (const st of game.save.inv) {
    if (seen.has(st.id) || !isSample(st.id) || !ITEMS[st.id].lab) continue;
    seen.add(st.id);
    out.push({ id: st.id, n: count(st.id), times: game.save.analyzed[st.id] ?? 0 });
  }
  return out;
}

export function analysisTime(id: string) {
  return (ITEMS[id]?.lab?.time ?? 3) * perks.labTime() * fx10.sampleTime();
}

/** RP the next analysis of this item would give. */
export function analysisRp(id: string) {
  const lab = ITEMS[id]?.lab;
  if (!lab) return 0;
  const times = game.save.analyzed[id] ?? 0;
  const base = times === 0 ? lab.rp : times < 4 ? Math.max(1, Math.round(lab.rp * 0.2)) : 0;
  return Math.round(base * perks.labRp() * perks.rpMul() * fx10.sampleRp());
}

/** Consume one sample and analyse it. */
export function analyze(id: string): LabResult | null {
  const def = ITEMS[id];
  if (!def?.lab || count(id) < 1) return null;
  const s = game.save;
  const rp = analysisRp(id);
  remove(id, 1);
  const times = (s.analyzed[id] ?? 0) + 1;
  s.analyzed[id] = times;
  s.rp += rp;
  s.totalRp += rp;
  s.vars['analyses'] = (s.vars['analyses'] ?? 0) + 1;
  let clueNew = false;
  if (def.lab.clue) clueNew = addClue(def.lab.clue);
  if (def.lab.species) s.hints[def.lab.species] = true;
  game.persist();
  return {
    item: id, name: def.name, rp, text: times === 1 ? def.lab.text : times < 5 ? 'Consistent with the first sample. Filed as a replicate.' : 'Already catalogued. Nothing new to learn from another one.',
    clue: def.lab.clue, clueName: def.lab.clue ? CLUE_BY_ID[def.lab.clue]?.name : undefined, clueNew,
    species: def.lab.species, speciesName: def.lab.species ? SPECIES_BY_ID[def.lab.species]?.name : undefined,
    first: times === 1, times,
  };
}

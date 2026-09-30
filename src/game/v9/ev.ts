// Evidence helpers for the field guide files (kept apart from species.ts so the v9 guide files can
// import them without a cycle).

import type { Evidence } from '../species';

export const ph = (species: string, behavior: string): Evidence => ({ kind: 'photo', species, behavior });
export const vid = (species: string, behavior: string): Evidence => ({ kind: 'video', species, behavior });
export const cl = (clue: string): Evidence => ({ kind: 'clue', clue });

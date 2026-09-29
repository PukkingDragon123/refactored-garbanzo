// V4 people: public API for the anime cast (Mori, Jenna, Joshu, Aroha) and Chunk the pug.
// Implements the Actor's PeopleArt interface: per-anim body frames, heads with any expression,
// talking mouth, blinking and look direction, posture transitions and Stardew-style portraits.
// Old V2 ids are aliased (rowan → mori, pip → jenna, crowe/lou → joshu) so older scenes still work.

import { PixelBuffer } from '../pixel';
import { renderAnimeHead, AnimeId, HeadOpts, Look } from './heads';
import { paintAnimeBody } from './body';
import { ANIME_CHARS, ANIME_INFO } from './cast';
import { ANIME_ANIMS, ANIME_COMMON, TRANSITIONS, animePose, AnimInfo } from './anims';
import { CHUNK_ANIMS, renderChunkBody, renderChunkHead } from './chunk';
import { renderAnimePortrait, PORTRAIT_EXPRS } from './portraits';

export type { AnimeId, HeadOpts, Look, AnimInfo };
export { PORTRAIT_EXPRS };

export const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };
export const norm = (id: string) => ALIAS[id] ?? id;

/** default anim table (the humans); Chunk has his own, see animFor */
export const ANIMS: Record<string, AnimInfo> = ANIME_ANIMS;

export function animFor(id: string, anim: string): AnimInfo | null {
  return (norm(id) === 'chunk' ? CHUNK_ANIMS[anim] : ANIME_ANIMS[anim]) ?? null;
}

const SPECIALS: Record<string, string[]> = {
  mori: [],
  jenna: [],
  joshu: [],
  aroha: [],
};
const human = (id: string) => [...ANIME_COMMON, ...(SPECIALS[id] ?? [])];
export const CHAR_ANIMS: Record<string, string[]> = {
  mori: human('mori'), jenna: human('jenna'), joshu: human('joshu'), aroha: human('aroha'),
  chunk: Object.keys(CHUNK_ANIMS),
};
for (const [a, b] of Object.entries(ALIAS)) CHAR_ANIMS[a] = CHAR_ANIMS[b];

export const CHAR_INFO: Record<string, { name: string; short: string; voice: number; height: number }> = { ...ANIME_INFO };
for (const [a, b] of Object.entries(ALIAS)) CHAR_INFO[a] = ANIME_INFO[b];

const CHUNK_TRANS: Record<string, Record<string, string>> = {
  idle: { sit: 'sitDown', lie: 'lieDown', sleep: 'lieDown', beg: 'sitDown' },
  walk: { sit: 'sitDown', lie: 'lieDown' },
  sit: { idle: 'standUp', walk: 'standUp', run: 'standUp' },
  lie: { idle: 'getUp', walk: 'getUp', run: 'getUp' },
  sleep: { idle: 'getUp', walk: 'getUp', run: 'getUp' },
};

/** transition clip to play when switching posture (sit down, stand up, lie down, get up...) */
export function transitionFor(id: string, from: string, to: string): string | null {
  const t = norm(id) === 'chunk' ? CHUNK_TRANS : TRANSITIONS;
  return t[from]?.[to] ?? null;
}

export function renderBody(id: string, anim: string, frame: number) {
  id = norm(id);
  if (id === 'chunk') {
    const a = CHUNK_ANIMS[anim] ? anim : 'idle';
    return renderChunkBody(a, frame % CHUNK_ANIMS[a].frames);
  }
  const ch = ANIME_CHARS[id as AnimeId] ?? ANIME_CHARS.mori;
  const a = ANIME_ANIMS[anim] ? anim : 'idle';
  const info = ANIME_ANIMS[a];
  const pose = animePose(id, a, ch.build, frame % Math.max(1, info.frames));
  return paintAnimeBody(ch, pose, a, info.frames > 1 ? frame / info.frames : 0);
}

export function renderHead(id: string, o: HeadOpts): { buf: PixelBuffer; ax: number; ay: number } {
  id = norm(id);
  if (id === 'chunk') return renderChunkHead(o);
  return renderAnimeHead((id in ANIME_CHARS ? id : 'mori') as AnimeId, o);
}

/** Stardew-style front-facing portrait bust for dialogue and UI. */
export function renderPortrait(id: string, expr: string, o: { mouth?: 0 | 1 | 2; blink?: boolean } = {}): PixelBuffer {
  return renderAnimePortrait(norm(id), expr, o.mouth ?? 0, !!o.blink);
}

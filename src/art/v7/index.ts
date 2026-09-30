// V7 people: public API (the Actor's PeopleArt) for the 3D-built anime cast turned toward the camera.
// Bodies come from the pose library lifted into 3D (body.ts), heads are small 3D heads with dot
// eyes (head.ts); Chunk and the dialogue portraits carry over unchanged.

import { PixelBuffer } from '../pixel';
import { renderBody7, Frame7 } from './body';
import { renderHead7, HeadOpts7 } from './head';
import { CAST7, INFO7 } from './cast';
import { ANIMS7, pose7 } from './anims7';
import { ANIME_COMMON, TRANSITIONS, AnimInfo } from '../anime/anims';
import { CHUNK_ANIMS, renderChunkBody, renderChunkHead } from '../anime/chunk';
import { renderAnimePortrait, PORTRAIT_EXPRS } from '../anime/portraits';

export { PORTRAIT_EXPRS };
export type { AnimInfo };

export const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };
export const norm = (id: string) => ALIAS[id] ?? id;

export const ANIMS: Record<string, AnimInfo> = ANIMS7;

export function animFor(id: string, anim: string): AnimInfo | null {
  id = norm(id);
  if (id === 'chunk') return CHUNK_ANIMS[anim] ?? null;
  return ANIMS7[anim] ?? null;
}

const human = () => [...ANIME_COMMON];
export const CHAR_ANIMS: Record<string, string[]> = { mori: human(), jenna: human(), joshu: human(), aroha: human(), chunk: Object.keys(CHUNK_ANIMS) };
for (const [a, b] of Object.entries(ALIAS)) CHAR_ANIMS[a] = CHAR_ANIMS[b];

export const CHAR_INFO: Record<string, { name: string; short: string; voice: number; height: number }> = { ...INFO7 };
for (const [a, b] of Object.entries(ALIAS)) CHAR_INFO[a] = INFO7[b];

const CHUNK_TRANS: Record<string, Record<string, string>> = {
  idle: { sit: 'sitDown', lie: 'lieDown', sleep: 'lieDown', beg: 'sitDown' },
  walk: { sit: 'sitDown', lie: 'lieDown' },
  sit: { idle: 'standUp', walk: 'standUp', run: 'standUp' },
  lie: { idle: 'getUp', walk: 'getUp', run: 'getUp' },
  sleep: { idle: 'getUp', walk: 'getUp', run: 'getUp' },
};
export function transitionFor(id: string, from: string, to: string): string | null {
  const t = norm(id) === 'chunk' ? CHUNK_TRANS : TRANSITIONS;
  return t[from]?.[to] ?? null;
}

const cache = new Map<string, Frame7>();
export function renderBody(id: string, anim: string, frame: number): Frame7 {
  id = norm(id);
  if (id === 'chunk') {
    const a = CHUNK_ANIMS[anim] ? anim : 'idle';
    return renderChunkBody(a, frame % CHUNK_ANIMS[a].frames) as unknown as Frame7;
  }
  const a = ANIMS7[anim] ? anim : 'idle';
  const n = Math.max(1, ANIMS7[a].frames);
  const fi = ((frame % n) + n) % n;
  const key = `${id}|${a}|${fi}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ch = CAST7[id] ?? CAST7.mori;
  const pose = pose7(id, a, ch.build, fi);
  const out = renderBody7(ch, pose);
  // hair trails while moving fast
  out.hair = a === 'run' || a === 'carryPupRun' ? ((pose.sway ?? 0) > 0.4 ? 2 : 1) : (pose.sway ?? 0) > 0.75 ? 1 : 0;
  if (cache.size > 1500) cache.clear();
  cache.set(key, out);
  return out;
}

export function renderHead(id: string, o: HeadOpts7): { buf: PixelBuffer; ax: number; ay: number } {
  id = norm(id);
  if (id === 'chunk') return renderChunkHead(o);
  return renderHead7(id, o);
}

export function renderPortrait(id: string, expr: string, o: { mouth?: 0 | 1 | 2; blink?: boolean } = {}): PixelBuffer {
  return renderAnimePortrait(norm(id), expr, o.mouth ?? 0, !!o.blink);
}

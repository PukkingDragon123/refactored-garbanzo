// V5 people: public API for the reference-style cast (Mori, Jenna, Joshu, Aroha) and Chunk.
// Implements the Actor's PeopleArt interface. Bodies reuse the shared pose library (poses scale
// with each build) and are adapted to the 3/4 view here: shoulders and hips spread wide while the
// torso is upright, both feet keep their own track, and the spread folds away as the body tips
// over (lying, crawling) so horizontal poses still read. Heads get secondary hair motion.

import { PixelBuffer } from '../pixel';
import type { Build, Pose } from '../people-rig';
import { renderHead5, V5Id, HeadOpts5, Look } from './heads';
import { paint5Body, BodyFrame5 } from './body';
import { V5_CHARS, V5_INFO } from './cast';
import { ANIME_ANIMS, ANIME_COMMON, TRANSITIONS, animePose, AnimInfo } from '../anime/anims';
import { CHUNK_ANIMS, renderChunkBody, renderChunkHead } from '../anime/chunk';
import { renderAnimePortrait, PORTRAIT_EXPRS } from '../anime/portraits';
import { renderClone, cloneClip, cloneFrames } from './clone';

export type { V5Id, HeadOpts5 as HeadOpts, Look, AnimInfo };
export { PORTRAIT_EXPRS };

export const ALIAS: Record<string, string> = { rowan: 'mori', pip: 'jenna', crowe: 'joshu', lou: 'joshu' };
export const norm = (id: string) => ALIAS[id] ?? id;

export const ANIMS: Record<string, AnimInfo> = ANIME_ANIMS;

export function animFor(id: string, anim: string): AnimInfo | null {
  id = norm(id);
  if (id === 'chunk') return CHUNK_ANIMS[anim] ?? null;
  const c = cloneClip(id, anim);
  if (c) return { frames: cloneFrames(id, anim), fps: c.fps, loop: c.loop };
  return ANIME_ANIMS[anim] ?? null;
}

const human = () => [...ANIME_COMMON];
export const CHAR_ANIMS: Record<string, string[]> = {
  mori: human(), jenna: human(), joshu: human(), aroha: human(),
  chunk: Object.keys(CHUNK_ANIMS),
};
for (const [a, b] of Object.entries(ALIAS)) CHAR_ANIMS[a] = CHAR_ANIMS[b];

export const CHAR_INFO: Record<string, { name: string; short: string; voice: number; height: number }> = { ...V5_INFO };
for (const [a, b] of Object.entries(ALIAS)) CHAR_INFO[a] = V5_INFO[b];

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

// ------------------------------------------------------------------ 3/4 adaptation

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** the build with shoulder/hip spread folded by how upright the torso is */
function spreadBuild(b: Build, lean: number): Build {
  const v = clamp01(Math.cos(lean)) ** 2;
  const k = 0.3 + 0.7 * v;
  return { ...b, shF: b.shF * k, shB: b.shB * k, legF: b.legF * k, legB: b.legB * k };
}

/** give each foot its own track under its hip while the leg is roughly vertical */
function spreadFeet(p: Pose, b: Build): Pose {
  const span = Math.max(1, b.hipH - b.ankleH);
  const track = (f: [number, number], off: number): [number, number] => {
    const vert = clamp01((p.hip[1] - f[1]) / span);
    return [f[0] + off * 0.72 * vert, f[1]];
  };
  return { ...p, fl: { ...p.fl, f: track(p.fl.f, b.legF) }, bl: { ...p.bl, f: track(p.bl.f, b.legB) } };
}

function pose34(id: string, anim: string, base: Build, frame: number): { pose: Pose; build: Build } {
  const p0 = animePose(id, anim, base, frame);
  const b = spreadBuild(base, p0.lean);
  const p1 = animePose(id, anim, b, frame);
  return { pose: spreadFeet(p1, b), build: b };
}

/** hair trail (0..2 px) from the pose's secondary sway */
function hairOf(p: Pose, anim: string): number {
  if (anim === 'run' || anim === 'carryPupRun') return (p.sway ?? 0) > 0.4 ? 2 : 1;
  const s = p.sway ?? 0;
  return s > 0.75 ? 1 : 0;
}

export function renderBody(id: string, anim: string, frame: number): BodyFrame5 {
  id = norm(id);
  if (id === 'chunk') {
    const a = CHUNK_ANIMS[anim] ? anim : 'idle';
    return renderChunkBody(a, frame % CHUNK_ANIMS[a].frames);
  }
  const cl = renderClone(id, anim, frame);
  if (cl) return cl;
  const ch = V5_CHARS[id] ?? V5_CHARS.mori;
  const a = ANIME_ANIMS[anim] ? anim : 'idle';
  const info = ANIME_ANIMS[a];
  const fi = frame % Math.max(1, info.frames);
  const { pose, build } = pose34(id, a, ch.build, fi);
  const out = paint5Body({ ...ch, build }, pose, a, info.frames > 1 ? fi / info.frames : 0);
  out.hair = hairOf(pose, a);
  return out;
}

export function renderHead(id: string, o: HeadOpts5): { buf: PixelBuffer; ax: number; ay: number } {
  id = norm(id);
  if (id === 'chunk') return renderChunkHead(o);
  return renderHead5((id in V5_CHARS ? id : 'mori') as V5Id, o);
}

/** front-facing portrait bust for dialogue and UI */
export function renderPortrait(id: string, expr: string, o: { mouth?: 0 | 1 | 2; blink?: boolean } = {}): PixelBuffer {
  return renderAnimePortrait(norm(id), expr, o.mouth ?? 0, !!o.blink);
}

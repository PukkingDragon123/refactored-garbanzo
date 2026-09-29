// Cloned reference frames as game sprites: decodes the palette-indexed frames in clonedata.ts into
// pixel buffers (cached) and maps game animations onto the cloned clips. Joshu and Aroha reuse the
// same frames recoloured into their own outfits, so the whole cast shares one hand-pixelled style.

import { PixelBuffer } from '../pixel';
import { hex, C } from '../color';
import { CLONES } from './clonedata';
import type { BodyFrame5 } from './body';

export interface CloneClip { src: string; clip: string; fps: number; loop: boolean; headBehind?: number[] }

/** which cloned clip plays for a game animation, per character */
const BASE: Record<string, Record<string, CloneClip>> = {
  mori: {
    idle: { src: 'mori', clip: 'idle', fps: 6, loop: true },
    walk: { src: 'mori', clip: 'walk', fps: 11, loop: true },
    run: { src: 'mori', clip: 'run', fps: 14, loop: true },
    armsCrossed: { src: 'mori', clip: 'idle2', fps: 3, loop: true },
    think: { src: 'mori', clip: 'idle2', fps: 3, loop: true },
    talk: { src: 'mori', clip: 'idle', fps: 6, loop: true },
  },
  jenna: {
    idle: { src: 'jenna', clip: 'idle', fps: 6, loop: true },
    walk: { src: 'jenna', clip: 'walk', fps: 11, loop: true },
    run: { src: 'jenna', clip: 'walk', fps: 16, loop: true },
    talk: { src: 'jenna', clip: 'talk', fps: 6, loop: true },
    scared: { src: 'jenna', clip: 'protect', fps: 6, loop: true, headBehind: [1, 2] },
    cower: { src: 'jenna', clip: 'protect', fps: 4, loop: true, headBehind: [1, 2] },
    brace: { src: 'jenna', clip: 'protect', fps: 4, loop: true, headBehind: [1, 2] },
  },
};
/** Joshu wears the boy's clips, Aroha the girl's */
BASE.joshu = Object.fromEntries(Object.entries(BASE.mori).map(([k, v]) => [k, { ...v }]));
BASE.aroha = Object.fromEntries(Object.entries(BASE.jenna).map(([k, v]) => [k, { ...v }]));

export function cloneClip(id: string, anim: string): CloneClip | null {
  return BASE[id]?.[anim] ?? null;
}
export function cloneFrames(id: string, anim: string): number {
  const c = cloneClip(id, anim);
  return c ? CLONES[c.src].anims[c.clip].length : 0;
}

const cache = new Map<string, BodyFrame5>();

export function renderClone(id: string, anim: string, frame: number): BodyFrame5 | null {
  const clip = cloneClip(id, anim);
  if (!clip) return null;
  const set = CLONES[clip.src];
  const list = set.anims[clip.clip];
  const i = ((frame % list.length) + list.length) % list.length;
  const key = `${id}.${clip.src}.${clip.clip}.${i}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [w, h, ax, ay, hx, hy, px] = list[i];
  // Joshu / Aroha wear the same frames in their own outfit colours (Aroha's legs are bare below the skirt)
  const alt = set.alt?.[id];
  const pal: C[] = (alt?.pal ?? set.pal).map(p => hex(p));
  const legs: C[] | null = alt?.legs ? alt.legs.map(p => hex(p)) : null;
  const legY = ay - (alt?.legY ?? 0);
  const buf = new PixelBuffer(w, h);
  for (let k = 0; k < px.length; k++) {
    const ch = px[k];
    if (ch === '.') continue;
    const j = set.key.indexOf(ch);
    buf.data[k] = legs && Math.floor(k / w) >= legY ? legs[j] : pal[j];
  }
  const out: BodyFrame5 = {
    back: buf, front: null, ax, ay, hx, hy, look: 'fwd',
    hand: [ax + 5, ay - Math.round(h * 0.42)],
    headBehind: clip.headBehind?.includes(i) || undefined,
    hair: anim === 'run' ? 1 : 0,
  };
  cache.set(key, out);
  return out;
}

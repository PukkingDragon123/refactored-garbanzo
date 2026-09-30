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
  const W5 = id === 'joshu' ? bigBuild(buf, ax, ay, hx, hy) : { buf, ax, ay, hx, hy };
  const out: BodyFrame5 = {
    back: W5.buf, front: null, ax: W5.ax, ay: W5.ay, hx: W5.hx, hy: W5.hy, look: 'fwd',
    hand: [W5.ax + 5, W5.ay - Math.round(W5.buf.h * 0.42)],
    headBehind: clip.headBehind?.includes(i) || undefined,
    hair: anim === 'run' ? 1 : 0,
  };
  cache.set(key, out);
  return out;
}

/**
 * Joshu is built bigger than the boy whose frames he wears: a wider frame (a column through the
 * middle of the body is repeated), a belly that pushes the front of his gansey out, and more
 * height (rows repeated through the chest and the legs, spread out so no step shows).
 */
function bigBuild(src: PixelBuffer, ax: number, ay: number, hx: number, hy: number) {
  const WIDEN = 4, BELLY = 3;
  const w = src.w, h = src.h;
  // 1. widen: repeat the column just behind the neck line
  const cx = Math.max(1, Math.min(w - 2, hx));
  const w1 = w + WIDEN + BELLY;
  const a = new PixelBuffer(w1, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w1; x++) {
    const sx = x <= cx ? x : x <= cx + WIDEN ? cx : x - WIDEN;
    a.data[y * w1 + x] = sx < w ? src.data[y * w + sx] : 0;
  }
  // 2. belly: the front half of the torso rows shifts forward along a round profile
  const b0 = hy + 7, b1 = Math.min(h - 1, hy + 24), xs = cx + WIDEN + 3;
  for (let y = b0; y <= b1; y++) {
    const t = (y - b0) / (b1 - b0);
    const k = Math.round(BELLY * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.7);
    if (k <= 0) continue;
    const row = a.data.slice(y * w1, y * w1 + w1);
    for (let x = xs; x < w1; x++) a.data[y * w1 + x] = x - k >= xs ? row[x - k] : row[xs];
  }
  // 3. height: repeat rows through the chest and the shins
  const dup = new Set([hy + 5, hy + 9, hy + 13, hy + 17, ay - 14, ay - 11, ay - 9, ay - 7, ay - 5].filter(y => y > 0 && y < h));
  const h1 = h + dup.size;
  const o = new PixelBuffer(w1, h1);
  let yo = 0;
  for (let y = 0; y < h; y++) {
    o.data.set(a.data.subarray(y * w1, y * w1 + w1), yo * w1); yo++;
    if (dup.has(y)) { o.data.set(a.data.subarray(y * w1, y * w1 + w1), yo * w1); yo++; }
  }
  const below = (yy: number) => [...dup].filter(d => d < yy).length;
  return { buf: o, ax: ax + (ax > cx ? WIDEN : WIDEN >> 1), ay: ay + below(ay), hx: hx + (WIDEN >> 1) + 1, hy: hy + below(hy) };
}

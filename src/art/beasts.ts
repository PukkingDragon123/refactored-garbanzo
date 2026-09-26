// V2 beasts of Zealandia: mammals, birds, the moss frog and insects as pose frames.
//
// Everything faces RIGHT (the game mirrors for left). Every frame of one (species, anim, variant)
// shares the same buffer size and anchor, so the frames can be packed as one strip.
// Anchors: walkers/standers -> ground contact under the feet (the outline row under the feet sits on
// the ground line); fliers/gliders/swimmers -> body centre; climb/hang -> grip point.

import { PixelBuffer } from './pixel';
import { Sk, SpeciesDef, BeastEye as CoreEye, V2 } from './beasts-core';
import { SHIELDBACK } from './beasts-shieldback';
import { QUILLHOG } from './beasts-quillhog';
import { DELVER } from './beasts-delver';
import { SAILGLIDER } from './beasts-sailglider';
import { FLICKER } from './beasts-flicker';
import { BONEFACE } from './beasts-boneface';
import { HUNTERBAT } from './beasts-hunterbat';
import { GALEHAWK, CRAGAUK, TORRENTDIPPER, SNAKESTORK, MONARCH, NUTCRACKER } from './beasts-birds';
import { MOSSFROG } from './beasts-frog';

export type BeastId = 'shieldback' | 'quillhog' | 'delver' | 'sailglider' | 'flicker' | 'boneface' | 'hunterbat' | 'galehawk' | 'cragauk' | 'torrentdipper' | 'snakestork' | 'monarch' | 'nutcracker' | 'mossfrog';
export type BeastEye = CoreEye;
export interface BeastFrame { buf: PixelBuffer; ax: number; ay: number; head: [number, number]; eye: [number, number] }

const SPECIES: Partial<Record<BeastId, SpeciesDef>> = {
  shieldback: SHIELDBACK,
  quillhog: QUILLHOG,
  delver: DELVER,
  sailglider: SAILGLIDER,
  flicker: FLICKER,
  boneface: BONEFACE,
  hunterbat: HUNTERBAT,
  galehawk: GALEHAWK,
  cragauk: CRAGAUK,
  torrentdipper: TORRENTDIPPER,
  snakestork: SNAKESTORK,
  monarch: MONARCH,
  nutcracker: NUTCRACKER,
  mossfrog: MOSSFROG,
};

export const BEAST_IDS = Object.keys(SPECIES) as BeastId[];

export const BEAST_ANIMS = Object.fromEntries(
  Object.entries(SPECIES).map(([id, s]) => [id, s!.anims]),
) as Record<BeastId, Record<string, { frames: number; fps: number; loop: boolean }>>;

export const BEAST_INFO = Object.fromEntries(
  Object.entries(SPECIES).map(([id, s]) => [id, { name: s!.name, kind: s!.kind, len: s!.len, height: s!.height }]),
) as Record<BeastId, { name: string; kind: 'mammal' | 'bird' | 'amphibian'; len: number; height: number }>;

/** What the anchor of an anim means: 'ground' (feet), 'centre' (body centre) or 'grip'. */
export function beastAnchorKind(id: BeastId, anim: string): 'ground' | 'centre' | 'grip' {
  return SPECIES[id]?.anchor?.[anim] ?? 'ground';
}

interface Raw { buf: PixelBuffer; head: V2; eye: V2; ox: number; oy: number }
function renderRaw(def: SpeciesDef, anim: string, frame: number, eye: BeastEye, juv: boolean): Raw {
  const cv = def.canvas(anim, juv);
  const sk = new Sk(cv.w, cv.h, cv.ox, cv.oy);
  const o = def.draw(sk, anim, frame, eye, juv);
  const buf = sk.resolve();
  return { buf, head: [o.head[0] + sk.ox, o.head[1] + sk.oy], eye: [o.eye[0] + sk.ox, o.eye[1] + sk.oy], ox: sk.ox, oy: sk.oy };
}

interface Box { x0: number; y0: number; x1: number; y1: number }
function bounds(b: PixelBuffer): Box | null {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      if (b.data[y * b.w + x] >>> 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
function crop(b: PixelBuffer, box: Box): PixelBuffer {
  const out = new PixelBuffer(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1);
  for (let y = box.y0; y <= box.y1; y++) {
    if (y < 0 || y >= b.h) continue;
    for (let x = box.x0; x <= box.x1; x++) {
      if (x < 0 || x >= b.w) continue;
      out.data[(y - box.y0) * out.w + (x - box.x0)] = b.data[y * b.w + x];
    }
  }
  return out;
}

const boxCache = new Map<string, Box>();
const frameCache = new Map<string, BeastFrame>();
const CACHE_MAX = 320;
function remember(key: string, f: BeastFrame) {
  if (frameCache.size >= CACHE_MAX) {
    const first = frameCache.keys().next().value;
    if (first !== undefined) frameCache.delete(first);
  }
  frameCache.set(key, f);
}

function pack(r: Raw, box: Box): BeastFrame {
  return {
    buf: crop(r.buf, box),
    ax: r.ox - box.x0,
    ay: r.oy - box.y0,
    head: [r.head[0] - box.x0, r.head[1] - box.y0],
    eye: [r.eye[0] - box.x0, r.eye[1] - box.y0],
  };
}

/**
 * Render one frame. Unknown anims fall back to 'idle'; frame wraps. `eye` overrides the anim's
 * default eye state. variant 'juvenile' draws a young animal (boneface calves are spotted).
 */
export function renderBeast(id: BeastId, anim: string, frame: number, eye?: BeastEye, variant: 'adult' | 'juvenile' = 'adult'): BeastFrame {
  const def = SPECIES[id];
  if (!def) throw new Error('unknown beast ' + id);
  if (!def.anims[anim]) anim = 'idle';
  const A = def.anims[anim];
  const f = ((Math.floor(frame) % A.frames) + A.frames) % A.frames;
  const juv = variant === 'juvenile';
  const bkey = id + '|' + anim + '|' + (juv ? 'j' : 'a');
  const eyeOf = (i: number) => eye ?? def.eyeFor?.(anim, i) ?? 'open';
  const fkey = bkey + '|' + f + '|' + eyeOf(f);
  const hit = frameCache.get(fkey);
  if (hit) return hit;
  let box = boxCache.get(bkey);
  if (!box) {
    // render the whole strip once: the union of all frames fixes a shared size and anchor
    const raws: Raw[] = [];
    let u: Box | null = null;
    for (let i = 0; i < A.frames; i++) {
      const r = renderRaw(def, anim, i, eyeOf(i), juv);
      raws.push(r);
      const b = bounds(r.buf);
      if (b) u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
    }
    const r0 = raws[0];
    u = u ?? { x0: r0.ox, y0: r0.oy, x1: r0.ox, y1: r0.oy };
    // keep the anchor inside the box and leave a 1px margin for eye-state differences
    box = {
      x0: Math.min(u.x0, r0.ox) - 1, y0: Math.min(u.y0, r0.oy) - 1,
      x1: Math.max(u.x1, r0.ox) + 1, y1: Math.max(u.y1, r0.oy - 1) + 1,
    };
    boxCache.set(bkey, box);
    raws.forEach((r, i) => remember(bkey + '|' + i + '|' + eyeOf(i), pack(r, box!)));
    const got = frameCache.get(fkey);
    if (got) return got;
  }
  const r = renderRaw(def, anim, f, eyeOf(f), juv);
  const out = pack(r, box);
  remember(fkey, out);
  return out;
}

/** Uncached full-canvas render (debug / benchmarking). */
export function renderBeastRaw(id: BeastId, anim: string, frame: number, eye: BeastEye = 'open', variant: 'adult' | 'juvenile' = 'adult') {
  const def = SPECIES[id];
  if (!def) throw new Error('unknown beast ' + id);
  return renderRaw(def, def.anims[anim] ? anim : 'idle', frame, eye, variant === 'juvenile');
}

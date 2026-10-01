// V10 site toolkit: the types the expedition runtime reads from a site (discovery points, water to
// swim, hazards, hard climbs) and shared builders on top of the V2 kit (src/game/sites2/common.ts):
// a lake you swim in (the water drawn in front of the swimmer), trail markers, stone, signs, steam.

import type { FieldScene, FieldSite } from '../scenes/field';
import type { DiscoveryKind } from '../v10/regions';
import type { BubbleLine } from '../../ui/bubbles';
import type { Sprite } from '../../art/jungle-core';
import { packColor } from '../../gfx/renderer';
import { Custom, Prop } from '../../world/props';
import { PixelBuffer } from '../../art/pixel';
import { C, hex, mix, shade } from '../../art/color';
import { A } from '../assets';
import { Rng, bayer, clamp, rand } from '../../core/math';
import { sprite } from '../sites2/common';

/** something to find at a site: photograph it, look at it, or carefully collect it */
export interface Point10 {
  id: string;
  kind: DiscoveryKind;
  name: string;
  x: number;
  /** ground y (default: the terrain under x) */
  y?: number;
  /** the field note written on the map */
  note?: string;
  /** a sprite painter (cached per scene) */
  art?: () => Sprite | null;
  z?: number;
  /** photographable: a world box w x h standing on (x, y), lifted by dy */
  photo?: { w: number; h: number; dy?: number };
  /** collect it: the item, the verb on the prompt, how long it takes */
  take?: { item: string; n?: number; verb: string; time?: number; tools?: string[]; line?: string; aroha?: string };
  /** look at it: the prompt and what is said */
  look?: { verb: string; lines: () => BubbleLine[] };
  /** only there when this says so */
  when?: () => boolean;
}
/** a stretch of deep water: the walk line there is the swimmer's line (surface + SWIM_DEPTH) */
export interface Swim10 { x0: number; x1: number; top: number; bottom: number; cold?: boolean; col?: [number, number, number] }
export const SWIM_DEPTH = 14;
export type HazardKind = 'thorns' | 'scald' | 'spores' | 'rockfall' | 'slip' | 'mud';
export interface Hazard10 { x0: number; x1: number; kind: HazardKind; dmg: number; period?: number; warn?: string }
export interface Extras10 {
  points?: Point10[];
  swims?: Swim10[];
  hazards?: Hazard10[];
  /** climbs (by x) that are hard going: energy per second while on them */
  hardClimbs?: { x: number; rate: number }[];
}
/** a V10 site: a FieldSite with its own location id and the extras above */
export type Site10 = Omit<FieldSite, 'id'> & { id: string; loc: string; v10?: Extras10 };

// ------------------------------------------------------------------ builders

/** deep water you can swim in: the bed below, a translucent body drawn in front of the swimmer, glints */
export function swimWater(f: FieldScene, s: Swim10) {
  const col = s.col ?? [0.08, 0.22, 0.26];
  f.st.terrain.water.push([s.x0, s.x1, s.top, s.bottom]);
  // the body of water behind (reflective) ...
  f.main.add(new Custom(-3, rr => {
    rr.water(0.85, 1.2, 0.8);
    rr.rect(s.x0, s.top, s.x1 - s.x0, s.bottom - s.top, packColor(col[0], col[1], col[2], 1));
    rr.water(0);
  }));
  // ... and in front: the swimmer is half under it
  f.main.add(new Custom(62, (rr, st) => {
    rr.rect(s.x0, s.top + 3, s.x1 - s.x0, s.bottom - s.top - 3, packColor(col[0] * 0.9, col[1] * 0.95, col[2], 0.62));
    rr.rect(s.x0, s.top, s.x1 - s.x0, 3, packColor(col[0] + 0.25, col[1] + 0.3, col[2] + 0.3, 0.5));
    for (let i = 0; i < (s.x1 - s.x0) / 34; i++) {
      const gx = s.x0 + ((i * 47.3) % (s.x1 - s.x0)), a = Math.max(0, Math.sin(st.time * 1.6 + i * 2.3));
      rr.fxDraw(A.dot2, gx, s.top + 1, 1.6, 0.4, 0, packColor(1, 1, 0.95, 1), a * 0.55);
    }
  }));
  f.pois.push({ kind: 'water', x: (s.x0 + s.x1) / 2, y: s.top, y1: s.bottom, w: (s.x1 - s.x0) / 2 });
}

/** a trail marker: a stake with a flax ribbon (where a way goes on, deeper) */
export function markerSprite(col = '#c8402e'): Sprite {
  const b = new PixelBuffer(16, 34);
  const wood = [hex('#3a2414'), hex('#5a3a20'), hex('#7a5430')];
  for (let y = 6; y < 34; y++) { b.set(7, y, wood[1]); b.set(8, y, y % 5 === 0 ? wood[0] : wood[2]); }
  b.rect(6, 4, 4, 3, wood[2]);
  const r = hex(col), r2 = shade(r, -0.3);
  for (let i = 0; i < 9; i++) { b.set(9 + i * 0.6, 8 + Math.sin(i * 0.9) * 1.5, r); b.set(9 + i * 0.6, 9 + Math.sin(i * 0.9) * 1.5, r2); }
  b.outline(hex('#140c08'));
  return { buf: b, ax: 8, ay: 33 } as Sprite;
}

/** a weathered rock face / boulder in a ramp, with optional strata stripes */
export function boulder(seed: number, w: number, h: number, ramp: C[], o: { strata?: C[]; moss?: number } = {}): Sprite {
  const b = new PixelBuffer(w, h);
  const rng = new Rng(seed);
  const cx = w / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x - cx) / (w / 2), ny = (h - y) / h;
    const edge = 1 - nx * nx - Math.pow(1 - ny, 2) * 0.6 + (rng.next() - 0.5) * 0.04;
    if (edge < 0.08 && y < h - 2) continue;
    if (Math.abs(nx) > 0.98) continue;
    const lit = clamp(0.55 - nx * 0.35 + (1 - ny) * -0.25 + ny * 0.2);
    let c = ramp[Math.min(ramp.length - 1, Math.floor(lit * (ramp.length - 1) + bayer(x, y) * 0.9))];
    if (o.strata) { const band = Math.floor((y + Math.sin(x * 0.07 + seed) * 3) / 6) % o.strata.length; c = mix(c, o.strata[band], 0.45); }
    if (o.moss && y < h * 0.35 && rng.next() < o.moss) c = mix(c, hex('#5c7c25'), 0.6);
    b.set(x, y, c);
  }
  b.outline(hex('#120e0c'));
  return { buf: b, ax: Math.floor(w / 2), ay: h - 1 } as Sprite;
}

/** add a cached sprite as a prop on the gameplay plane */
export function propAt(f: FieldScene, key: string, gen: () => Sprite | null, x: number, y: number, z = -4, o: { sway?: number; flip?: boolean; tint?: number } = {}) {
  const c = sprite(key, gen);
  if (c) f.main.add(new Prop(c.f, x, y, z, o));
  return c;
}

/** steam rising from a vent or a hot pool */
export function steam(f: FieldScene, x: number, y: number, w = 10, k = 1) {
  const lp = f.main.particles;
  f.main.add(new Custom(30, () => {}, dt => {
    if (rand.chance(dt * 6 * k)) lp.spawn({ frame: A.soft, x: x + rand.range(-w, w), y, vx: rand.range(-4, 4) + f.st.wind * 4, vy: rand.range(-26, -14), life: rand.range(1.6, 3), color: [0.92, 0.94, 0.96], alpha: 0.32, alpha1: 0, size: rand.range(0.3, 0.5), size1: rand.range(1.2, 2) });
  }));
}

export { sprite, rand, Rng, hex, mix, shade, clamp };

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
import { Rng, bayer, clamp, rand, fbm2, smoothstep } from '../../core/math';
import { sprite } from '../sites2/common';
import { paintRock } from '../../art/flora';
import type { Env, Frame } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { layerSpan } from '../../world/scenery';
import { PAL } from '../../art/palettes';
import type { Interactable } from '../../world/npc';

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
  /** after it has been looked at / collected (a rumour, a flag, a map note) */
  after?: () => void;
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
  /** climbs (by x) that are hard going: extra energy per second while climbing them */
  hardClimbs?: { x: number; rate: number }[];
  /** a dark place: a soft light travels with Mori (0..1 strength) */
  dark?: number;
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

/** a shaded boulder (the V2 rock painter), optionally striped with strata */
export function boulder(seed: number, w: number, h: number, ramp: C[], o: { strata?: C[]; moss?: number } = {}): Sprite {
  const r = paintRock(seed, w, h, ramp, o.moss ?? 0.25);
  if (o.strata) {
    const st = o.strata;
    r.buf.map((c, x, y) => ((c >>> 24) > 0 ? mix(c, st[Math.floor((y + Math.sin(x * 0.08 + seed) * 2) / 5) % st.length], 0.35) : c));
  }
  return { buf: r.buf, ax: Math.round(r.ax), ay: r.ay - 1 } as Sprite;
}

/** a cave column / stalagmite: a tapered, lumpy pillar lit from the left */
export function pillar(seed: number, w: number, h: number, ramp: C[], o: { top?: boolean } = {}): Sprite {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const half = (w / 2) * (o.top ? 0.55 + 0.45 * Math.abs(t - 0.5) * 2 : 0.25 + 0.75 * t) * (0.85 + 0.15 * Math.sin(y * 0.11 + seed)) + (fbm2(y * 0.08, seed, 2, seed) - 0.5) * 3;
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / Math.max(1, half);
      if (Math.abs(dx) > 1) continue;
      const l = -dx * 0.55 + (fbm2(x * 0.15, y * 0.06, 3, seed) - 0.5) * 0.8 + (bayer(x, y) - 0.5) * 0.3 + (Math.sin(y * 0.6) > 0.85 ? 0.25 : 0);
      b.set(x, y, ramp[clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 0, ramp.length - 1)]);
    }
  }
  b.outline(hex('#0c0a0a'));
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

// ------------------------------------------------------------------ caves, valleys, climbs, glow

/** darker, tinted light for caves and sunken valleys (k 0..1), layered on whatever env hook exists */
export function dim(f: FieldScene, k: number, tint: [number, number, number] = [0.75, 0.88, 1], o: { bloom?: number; vignette?: number; fog?: [number, number, number] } = {}) {
  const prev = f.st.envHook;
  f.st.envHook = (env: Env, dt: number) => {
    prev?.(env, dt);
    const m = 1 - k;
    const mul = (c: [number, number, number], w = 1): [number, number, number] => [c[0] * (m + (1 - m) * 0.15 * w) * tint[0], c[1] * (m + (1 - m) * 0.15 * w) * tint[1], c[2] * (m + (1 - m) * 0.15 * w) * tint[2]];
    env.ambientTop = mul(env.ambientTop);
    env.ambientBottom = mul(env.ambientBottom, 0.6);
    if (o.fog) { env.fogTop = [...o.fog]; env.fogBottom = [o.fog[0] * 1.2, o.fog[1] * 1.2, o.fog[2] * 1.2]; }
    else { env.fogTop = mul(env.fogTop); env.fogBottom = mul(env.fogBottom); }
    env.bloom += o.bloom ?? k * 0.45;
    env.bloomThreshold = Math.min(env.bloomThreshold, 0.8 - k * 0.2);
    env.vignette += o.vignette ?? k * 0.35;
  };
}

/** a strip of rock wall (cracks, strata, wet sheen), its top edge hanging in stalactites when `drips` */
export function paintRockWall(w: number, h: number, seed: number, ramp: C[], o: { drips?: boolean; strata?: number; moss?: number } = {}): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const n = fbm2(x * 0.035, y * 0.05, 4, seed), crack = Math.abs(fbm2(x * 0.02, y * 0.06, 3, seed + 9) - 0.5) < 0.012;
      let l = (n - 0.5) * 1.4 + (bayer(x, y) - 0.5) * 0.35;
      if (o.strata) l += Math.sin(y * o.strata + fbm2(x * 0.01, y * 0.01, 2, seed) * 5) * 0.18;
      let c = ramp[clamp(Math.round((l * 0.5 + 0.5) * (ramp.length - 1)), 0, ramp.length - 1)];
      if (crack) c = ramp[0];
      if (o.moss && fbm2(x * 0.07, y * 0.07, 2, seed + 4) > 1 - o.moss) c = mix(c, PAL.moss[2], 0.55);
      b.set(x, y, c);
    }
  }
  if (o.drips) {
    // the top edge: an uneven roof line with stalactites hanging from it
    const rng = new Rng(seed);
    for (let x = 0; x < w; x++) {
      const cut = Math.round(fbm2(x * 0.05, 0.5, 3, seed) * 10);
      for (let y = 0; y < cut; y++) b.set(x, h - 1 - y, 0);
    }
    for (let i = 0; i < w / 12; i++) {
      const x = rng.range(0, w), len = rng.range(6, 30), r0 = rng.range(1.5, 4.5);
      for (let y = 0; y < len; y++) { const r = r0 * (1 - y / len); for (let dx = -r; dx <= r; dx++) b.set(x + dx, h - 12 + y, ramp[clamp(Math.round(2 + (dx < 0 ? 1 : 0) + (1 - y / len) * 2), 0, ramp.length - 1)]); }
    }
  }
  return b;
}

/** a backdrop layer of rock wall, tiled across the layer's span */
export function wallLayer(f: FieldScene, name: string, p: number, fog: number, y: number, h: number, seed: number, ramp: C[], o: { drips?: boolean; strata?: number; moss?: number; tint?: number; receive?: number } = {}) {
  const r = game.r, st = f.st;
  const span = layerSpan(st, p);
  const tw = Math.min(1024, span.w);
  const buf = paintRockWall(tw, h, seed, ramp, o);
  const fr = bigFrame(r, buf);
  const lay = st.addLayer(name, p, fog, o.receive ?? 0.35, 0);
  for (let x = 0; x < span.w; x += tw) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, span.x0 + x, y, 0, { tint: o.tint }));
  return lay;
}

/** a climbable rope / vine / ladder with E prompts at both ends (keyboard players use W / S too) */
export function climbSpot(f: FieldScene, x: number, yTop: number, yBot: number, kind: 'rope' | 'vine' | 'ladder', up: string, down: string) {
  f.st.terrain.addClimb(x, yTop, yBot, kind);
  const ld = { x, y0: yTop, y1: yBot };
  const col = kind === 'rope' ? packColor(0.66, 0.52, 0.32, 1) : kind === 'vine' ? packColor(0.3, 0.46, 0.22, 1) : packColor(0.45, 0.32, 0.2, 1);
  const leaf = packColor(0.42, 0.62, 0.3, 1);
  f.main.add(new Custom(-1, (rr, st) => {
    const sway = Math.sin(st.time * 0.9 + x) * 1.2;
    for (let y = yTop - 6; y < yBot; y += 2) {
      const t = (y - yTop) / Math.max(1, yBot - yTop);
      rr.rect(x + sway * t - 1, y, 2, 2, col);
      if (kind === 'vine' && Math.floor(y / 6) % 2 === 0) rr.rect(x + sway * t + (Math.floor(y / 12) % 2 ? 1 : -3), y, 2, 1, leaf);
      if (kind === 'ladder' && Math.floor(y) % 8 === 0) rr.rect(x - 5, y, 10, 1, col);
    }
    if (kind === 'ladder') { rr.rect(x - 5, yTop - 6, 1, yBot - yTop + 6, col); rr.rect(x + 4, yTop - 6, 1, yBot - yTop + 6, col); }
  }));
  (f.interact as Interactable[]).push({ x, y: yBot, w: 14, h: 18, label: up, standX: x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - yBot) < 12, action: () => f.climbLadder(ld, -1) });
  (f.interact as Interactable[]).push({ x, y: yTop, w: 14, h: 18, label: down, standX: x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - yTop) < 12, action: () => f.climbLadder(ld, 1) });
}

/** a rock ledge you can stand on (a one-way platform) with its art */
export function ledge(f: FieldScene, x0: number, x1: number, y: number, ramp: C[], seed: number, th = 12) {
  f.st.terrain.addPlatform([[x0, y], [x1, y]], 'rock');
  const w = Math.round(x1 - x0) + 8;
  const b = new PixelBuffer(w, th + 6);
  for (let x = 0; x < w; x++) {
    const bot = th - 2 + Math.round((fbm2(x * 0.08, 1, 2, seed) - 0.3) * 8 * Math.min(1, Math.min(x, w - x) / 14));
    for (let yy = 0; yy < bot; yy++) b.set(x, yy, yy < 2 ? ramp[ramp.length - 1] : ramp[clamp(Math.round(ramp.length - 2 - yy * 0.4 + (bayer(x, yy) - 0.5)), 0, ramp.length - 1)]);
  }
  b.outline(hex('#120e0c'));
  const c = sprite(`ledge:${seed}:${w}`, () => ({ buf: b, ax: 0, ay: 1 } as Sprite));
  if (c) f.main.add(new Prop(c.f, x0 - 4, y, -3));
}

/** glowing points (glowworms, spores, crystals): emissive dots that twinkle, a few real lights among them */
export function glowField(f: FieldScene, x0: number, x1: number, y0: number, y1: number, n: number, col: [number, number, number], seed: number, o: { lights?: number; size?: number; z?: number; drift?: boolean; radius?: number } = {}) {
  const rng = new Rng(seed);
  const pts = Array.from({ length: n }, () => ({ x: rng.range(x0, x1), y: rng.range(y0, y1), ph: rng.range(0, 6.28), s: rng.range(0.6, 1.2) * (o.size ?? 1) }));
  const lights = Array.from({ length: o.lights ?? Math.ceil(n / 40) }, () => ({ x: rng.range(x0, x1), y: rng.range(y0, y1) }));
  const c = packColor(col[0], col[1], col[2], 1);
  f.main.add(new Custom(o.z ?? -5, (rr, st) => {
    const vx0 = rr.visibleX0(20), vx1 = rr.visibleX1(20);
    for (const p of pts) {
      if (p.x < vx0 || p.x > vx1) continue;
      const k = 0.55 + 0.45 * Math.sin(st.time * 1.3 + p.ph);
      const dx = o.drift ? Math.sin(st.time * 0.3 + p.ph) * 6 : 0, dy = o.drift ? Math.cos(st.time * 0.25 + p.ph) * 4 : 0;
      rr.fxDraw(A.dot, p.x + dx, p.y + dy, p.s, p.s, 0, c, 1.6 * k);
    }
    for (const L of lights) if (L.x > vx0 - 100 && L.x < vx1 + 100) rr.light(L.x, L.y, o.radius ?? 90, col[0], col[1], col[2], 0.35, 0.05);
  }));
  for (const L of lights) f.lights.push({ x: L.x, y: L.y, r: 80, k: 0.25 });
}

/** the first time at a V10 place: a title card, and Aroha's line (the translator handles it) */
export async function arrive10(f: FieldScene, name: string, sub: string, aroha: string) {
  const key = 'arrived:' + (f.site as unknown as Site10).loc;
  if (!game.save.flags[key]) {
    game.save.flags[key] = true;
    await game.ui.titleCard('Expedition', name, sub, 2600);
  }
  if (f.guide) setTimeout(() => f.bark('aroha', aroha, { expr: 'neutral' }), 1200);
}

/** a smooth bump for ground functions */
export const bump = (x: number, a: number, b: number, h: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI) * h);
export { smoothstep, fbm2, bayer, PAL, layerSpan, bigFrame, game };
export type { Frame };

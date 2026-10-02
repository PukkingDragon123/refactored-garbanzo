// Shared builders for V2 expedition sites: layered jungle walls, dense undergrowth, foreground
// foliage that really blocks your camera, light shafts, resource nodes and hide spots.

import type { Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import type { Layer } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import { layerSpan, addSky, addClouds } from '../../world/scenery';
import { local, A } from '../assets';
import { PixelBuffer } from '../../art/pixel';
import * as Lsc from '../../art/landscape';
import { C, hex, mix, shade } from '../../art/color';
import { Rng, bayer, clamp, rand } from '../../core/math';
import type { Sprite } from '../../art/jungle-core';
import { tree, canopyClump, TreeKind } from '../../art/jungle-trees';
import { plant, fungus, deadwood, PlantKind, FungusKind, DeadwoodKind } from '../../art/jungle-plants';
import { foreground, ForegroundKind, FOREGROUND_HANGING } from '../../art/jungle-fg';
import { ResourceNode, NodeArt } from '../../world/resources';
import type { HideSpot } from '../../world/player';

type AnyFn = (...a: unknown[]) => unknown;
let jungleX: Record<string, AnyFn> | null = null;
/** the rest of the environment kit (src/art/jungle.ts: forestStrip, canopyCeiling, resourceSprite) */
export function bindSiteArt(j: Record<string, unknown> | null) {
  jungleX = j as Record<string, AnyFn> | null;
}
export const jcall = <T>(name: string, ...args: unknown[]): T | null => {
  try {
    const f = jungleX?.[name];
    return f ? (f(...args) as T) : null;
  } catch (e) {
    console.warn('site art', name, e);
    return null;
  }
};

let uid = 0;
const cache = new Map<string, { f: Frame; s: Sprite; g: Frame | null }>();
let cacheOwner: unknown = null;
/** add a generated sprite to the scene atlas once and reuse it */
export function sprite(key: string, gen: () => Sprite | null): { f: Frame; s: Sprite; g: Frame | null } | null {
  if (cacheOwner !== local) { cache.clear(); cacheOwner = local; }
  let c = cache.get(key);
  if (!c) {
    const s = gen();
    if (!s) return null;
    c = { f: local.add(`s2:${key}:${uid++}`, s.buf, s.ax, s.ay), s, g: s.glow ? local.add(`s2g:${key}:${uid++}`, s.glow, s.ax, s.ay) : null };
    cache.set(key, c);
  }
  return c;
}

export interface Ground { y: (x: number) => number }

/** Create the gameplay plane (call after the background layers, before foreground). */
export function mainLayer(f: FieldScene) {
  f.main = f.st.addLayer('main', 1, 0, 1, 0);
  return f.main;
}

/** Sky, clouds and distant ridge for open sites. */
export function skyAndRidge(f: FieldScene, o: { ridge?: boolean; seed?: number; base?: number } = {}) {
  const r = game.r, st = f.st;
  addSky(st, r);
  addClouds(st, r, 0.03, 30, 150, 7, o.seed ?? 11, 0.05);
  if (o.ridge !== false) {
    const span = layerSpan(st, 0.07);
    const buf = Lsc.paintRidge(span.w, 170, {
      seed: o.seed ?? 5, base: 170, amp: 80, freq: 0.009, body: hex('#4a5f7c'), lit: hex('#6e84a4'), shadow: hex('#3a4a66'), snow: hex('#e6ecf4'), snowLine: 30,
      fogTo: hex('#94a6c0'), fogStart: 90, sharp: 0.6,
    });
    const l = st.addLayer('ridge', 0.07, 0.5, 0, 0);
    l.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, (o.base ?? 250) - buf.h + 40));
  }
}

/** Layered jungle walls behind the gameplay plane: strips from the kit, else painted treelines. */
export function jungleWalls(f: FieldScene, groundY: number, layers: { p: number; fog: number; depth: 0 | 1 | 2 | 3; seed: number; lift?: number }[]) {
  const r = game.r, st = f.st;
  for (const L of layers) {
    const span = layerSpan(st, L.p);
    let buf = jcall<PixelBuffer>('forestStrip', L.depth, L.seed, span.w);
    if (!buf) {
      const ramps = [['#152a2c', '#1c3634', '#244640', '#2e5a4b'], ['#1c3634', '#244640', '#2e5a4b', '#3c6e56'], ['#1f3a2e', '#2a4c38', '#355e42', '#46744c'], ['#223f2c', '#2e5334', '#3b683e', '#4f804a']][L.depth];
      buf = Lsc.paintTreeline(span.w, 260, { seed: L.seed, base: 200, amp: 50, ramp: ramps.map(h => hex(h)), rMin: 12, rMax: 24, fern: 0.8, emergent: 0.4, palms: 0.1 });
    }
    const lay = st.addLayer('wall' + L.depth, L.p, L.fog, 0.2 + L.depth * 0.12, 0);
    // tile horizontally if the strip is shorter than the span
    for (let x = 0; x < span.w; x += buf.w) lay.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0 + x, groundY + (L.lift ?? 8) - buf.h));
  }
}

/** A canopy ceiling hanging from the top of the view (forest-floor sites). */
export function ceiling(f: FieldScene, p: number, y: number, seed: number) {
  const r = game.r, st = f.st;
  // forest-floor sites have no sky: behind everything, the misty air the farthest ridges stand in
  // (on a far, fogged layer so it takes the same haze and light as they do), so the gaps between the
  // far walls and the ceiling (looking up with the camera) are never empty black
  if (!st.hasLayer('sky') && !st.hasLayer('canopy-shade')) {
    const bg = st.addLayer('canopy-shade', 0.1, 0.6, 0, 0, 0.1);
    st.layers.splice(st.layers.indexOf(bg), 1);
    st.layers.unshift(bg);
    const c = packColor(0.69, 0.8, 0.78, 1);
    bg.add(new Custom(0, rr => { const k = rr.layerZoom; rr.rect(rr.wx(0) - 4, rr.wy(0) - 4, rr.VW / k + 8, rr.VH / k + 8, c); }));
  }
  const span = layerSpan(st, p, 60);
  // (with 260 rows of canopy above the strip, so looking up never reaches a straight top edge)
  const UP = 260;
  let buf = jcall<PixelBuffer>('canopyCeiling', seed, span.w, 200, UP);
  const lay = st.addLayer('ceiling', p, 0.02, 0.3, 0);
  if (buf) {
    const up = buf.h - 200;
    for (let x = 0; x < span.w; x += buf.w) lay.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0 + x, y - up));
    return lay;
  }
  const rng = new Rng(seed);
  for (let x = span.x0 - 60; x < span.x0 + span.w; x += rng.range(120, 200)) {
    const c = sprite(`clump${rng.int(0, 5)}`, () => canopyClump(rng.int(1, 999), 260, 130));
    if (c) lay.add(new Prop(c.f, x, y + rng.range(60, 110), rng.next(), { sway: 0.3 }));
  }
  return lay;
}

/** Place trees on a layer, reusing a handful of generated variants per kind. */
export function trees(f: FieldScene, layer: Layer, x0: number, x1: number, step: [number, number], kinds: TreeKind[], ground: Ground, seed: number, o: { variants?: number; tint?: number; z?: number; heights?: [number, number]; p?: number } = {}) {
  const rng = new Rng(seed);
  const p = o.p ?? layer.p;
  for (let x = x0; x < x1; x += rng.range(step[0], step[1])) {
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const v = rng.int(0, (o.variants ?? 3) - 1);
    const h = o.heights ? Math.round(rng.range(o.heights[0], o.heights[1]) / 20) * 20 : undefined;
    const c = sprite(`tree:${kind}:${v}:${h ?? 0}`, () => tree(kind, 100 + v * 17 + seed, h));
    if (!c) continue;
    layer.add(new Prop(c.f, x * p, ground.y(x) + 2, (o.z ?? 0) + rng.next(), { sway: kind === 'treefern' || kind === 'nikau' || kind === 'palm' ? 1.1 : 0.25, flip: rng.chance(0.5), tint: o.tint }));
  }
}

/** Dense ground cover along the gameplay plane (and glowing fungi at night). */
export function undergrowth(f: FieldScene, layer: Layer, x0: number, x1: number, density: number, ground: Ground, seed: number, mix0: { plants: PlantKind[]; fungi?: FungusKind[]; wood?: DeadwoodKind[] }, z = 1) {
  const rng = new Rng(seed);
  const night = f.tod === 'night';
  for (let x = x0; x < x1; x += rng.range(14, 30) / density) {
    const k = rng.next();
    let key: string, gen: () => Sprite;
    if (k < 0.72 || (!mix0.fungi && !mix0.wood)) { const pk = mix0.plants[rng.int(0, mix0.plants.length - 1)]; const v = rng.int(0, 3); key = `pl:${pk}:${v}`; gen = () => plant(pk, 300 + v * 13); }
    else if (k < 0.86 && mix0.fungi) { const fk = mix0.fungi[rng.int(0, mix0.fungi.length - 1)]; const v = rng.int(0, 2); key = `fu:${fk}:${v}`; gen = () => fungus(fk, 400 + v * 7); }
    else { const wk = (mix0.wood ?? ['log'])[rng.int(0, (mix0.wood ?? ['log']).length - 1)]; const v = rng.int(0, 2); key = `dw:${wk}:${v}`; gen = () => deadwood(wk, 500 + v * 11); }
    const c = sprite(key, gen);
    if (!c) continue;
    const y = ground.y(x) + 2;
    layer.add(new Prop(c.f, x, y, z + rng.next() * 0.5, { sway: 0.9, flip: rng.chance(0.5) }));
    if (c.g) {
      const g = c.g;
      layer.add(new Custom(z + 0.6, rr => {
        if (!night && f.tod !== 'dusk') return;
        rr.emissive(1);
        rr.draw(g, x, y);
        rr.emissive();
        rr.light(x, y - 6, 28, 0.35, 1, 0.9, 0.7);
      }));
      f.lights.push({ x, y: y - 6, r: 30, k: 0.2 });
    }
  }
}

/** Big dark foliage right in front of the camera; registered as photo occluders. */
export function frontFoliage(f: FieldScene, x0: number, x1: number, step: [number, number], kinds: ForegroundKind[], p: number, y: number, seed: number, o: { hang?: boolean; tint?: number } = {}) {
  const st = f.st;
  const layer = st.hasLayer('front') ? st.layer('front') : st.addLayer('front', p, 0, 0.45, 0);
  const rng = new Rng(seed);
  for (let x = x0; x < x1; x += rng.range(step[0], step[1])) {
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const v = rng.int(0, 2);
    // hanging kinds carry their bough / canopy / trunk 300 px up out of the top: far enough that the
    // photo camera aimed up from the highest climbable branch never finds where they end
    const hangs = FOREGROUND_HANGING.includes(kind);
    const c = sprite(`fg:${kind}:${v}${hangs ? ':up' : ''}`, () => foreground(kind, 600 + v * 19, undefined, { above: hangs ? 300 : 0 }));
    if (!c) continue;
    const flip = rng.chance(0.5);
    const wx = x * p, wy = o.hang ? y : y + rng.range(-8, 16);
    layer.add(new Prop(c.f, wx, wy, rng.next(), { sway: 0.5, flip, tint: o.tint ?? packColor(0.5, 0.58, 0.55, 1) }));
    f.occluders.push({ mask: c.s.buf, x: wx, y: wy, ax: c.s.ax, ay: c.s.ay, sx: flip ? -1 : 1, sy: 1, p: layer.p, z: 0 });
  }
  return layer;
}

/** Bushes on the gameplay plane you can hide in (they also block photos from behind). */
export function hideBush(f: FieldScene, x: number, ground: Ground, seed: number, cover = 0.8): HideSpot {
  const c = sprite(`bush:${seed % 4}`, () => plant('shrub', 700 + (seed % 4) * 5, 44));
  const y = ground.y(x) + 2;
  if (c) {
    f.main.add(new Prop(c.f, x, y, 70, { sway: 0.8 }));
    f.occluders.push({ mask: c.s.buf, x, y, ax: c.s.ax, ay: c.s.ay, sx: 1, sy: 1, p: 1, z: 70 });
  }
  f.pois.push({ kind: 'cover', x, y, w: 18 });
  return { x, w: 34, y, cover };
}

/** Volumetric light shafts with dust motes. */
export function shafts(f: FieldScene, layer: Layer, list: { x: number; w: number; a: number }[], color: [number, number, number], topY: number, len: number, intensity = 1) {
  const st = f.st;
  layer.add(new Custom(200, (r, s) => {
    for (const sh of list) {
      const k = (0.75 + 0.25 * Math.sin(s.time * 0.4 + sh.x)) * intensity;
      const col = packColor(color[0], color[1], color[2], 1);
      r.fxDraw(A.shaft, sh.x, topY, sh.w / 48, len / 256, sh.a, col, 0.5 * k);
      r.lightTex(A.shaft, sh.x, topY, sh.w / 48, len / 256, sh.a, col, 1.2 * k);
    }
  }, dt => {
    for (const sh of list) {
      if (rand.chance(dt * 2.5 * intensity)) {
        const t = rand.next();
        const y = topY + t * len * 0.95;
        const x = sh.x - Math.sin(sh.a) * (y - topY) + rand.range(-sh.w * 0.3, sh.w * 0.3);
        layer.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-2, 2), vy: rand.range(-1, 2), life: rand.range(3, 6), color: [1, 0.95, 0.8], alpha: 0.9, alpha1: 0, fadeIn: 0.3, glow: true, intensity: 1.6, wobble: 3, wobbleF: 0.8 });
      }
    }
  }));
  for (const sh of list) {
    f.sunspots.push({ x: sh.x - Math.sin(sh.a) * (f.st.terrain.groundY(sh.x) - topY), w: sh.w * 0.8 });
    f.pois.push({ kind: 'sun', x: sh.x - Math.sin(sh.a) * (f.st.terrain.groundY(sh.x) - topY), y: f.st.terrain.groundY(sh.x) });
  }
  void st;
}

/** Paint the walkable ground strip (soil with leaf litter / sand / mud) on the main layer. */
export function groundStrip(f: FieldScene, width: number, ground: Ground, top: C[], deep: C, seed: number, h = 110) {
  const r = game.r;
  const yTop = Math.min(...Array.from({ length: Math.ceil(width / 20) + 1 }, (_, i) => ground.y(i * 20))) - 4;
  const buf = new PixelBuffer(width, h);
  const rng = new Rng(seed);
  for (let x = 0; x < width; x++) {
    const gy = Math.round(ground.y(x) - yTop);
    for (let y = Math.max(0, gy); y < h; y++) {
      const d = y - gy;
      let c = d < 3 ? top[Math.min(top.length - 1, 3 - d)] : mix(top[0], deep, clamp(d / 50));
      if (d > 2 && bayer(x, y) < 0.08) c = shade(c, 0.1);
      if (d > 4 && ((x * 13 + y * 7) % 37 === 0)) c = shade(c, -0.12);
      buf.data[y * width + x] = c;
    }
    // leaf litter flecks on top
    if (rng.chance(0.3)) buf.set(x, gy - 1, top[rng.int(0, top.length - 1)]);
  }
  f.main.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, 0, yTop, -10));
  const pts: [number, number][] = [];
  for (let x = 0; x <= width; x += 8) pts.push([x, ground.y(x)]);
  f.st.terrain.addGround(pts, 'ground');
}

/** Add a resource node with kit art (falls back to a marker). */
export function node(f: FieldScene, key: string, kind: string, x: number, y?: number) {
  const s0 = sprite(`res:${kind}:0`, () => jcall<Sprite>('resourceSprite', kind, false, 1));
  const s1 = sprite(`res:${kind}:1`, () => jcall<Sprite>('resourceSprite', kind, true, 1));
  const art: NodeArt = { normal: s0?.f ?? A.blob, depleted: s1?.f ?? null, glow: s0?.g ?? null };
  const n = new ResourceNode(`${f.site.id}:${key}`, kind, x, (y ?? f.st.terrain.groundY(x)) + 2, art);
  f.addNode(n);
  return n;
}

export { hex, mix, shade, Rng, rand, clamp };

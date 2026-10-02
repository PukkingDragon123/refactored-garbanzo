// V4 island dressing: everything static along the shoreline. Offshore: sea stacks and the reef. Behind
// the beach: the long cliff with the sea cave, the forest walls of the bush track. On the sand: leaning palms, rocks, driftwood and
// wreckage. In front of the camera: dune grass, flax, logs, pōhutukawa branches, big ferns, and the
// rock arch that frames the cave. The west half (the rocks, the wreck, the landing beach and the palm
// grove) is dressed by v9/beach.ts, which prunes this file's props west of its WEST_END.

import type { Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import type { Layer } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import { layerSpan } from '../../world/scenery';
import { sprite, jcall } from '../sites2/common';
import * as SF from '../../art/ship4/furniture';
import { tree, canopyClump } from '../../art/jungle-trees';
import { plant, deadwood, fungus } from '../../art/jungle-plants';
import { foreground } from '../../art/jungle-fg';
import type { PixelBuffer } from '../../art/pixel';
import { Rng, clamp, smoothstep } from '../../core/math';
import { ISL, SPOT, groundY, zoneAt } from '../../art/island4/layout';
import { paintSeaStack, paintReef, paintCliff, paintDuneGrass } from '../../art/island4/scenery';
import { dressWest } from '../v9/beach';
import type { IslandScene4 } from './island';
import { layerY } from './island';
import { dressEast } from '../v9/east';

export interface IsleLayers { mid: Layer; near: Layer; back: Layer; main: Layer; front: Layer }

export function dressIsland(s: IslandScene4, L: IsleLayers) {
  const r = game.r, st = s.st;
  const rng = new Rng(77);
  // ---------------------------------------------------------------- offshore (p .42)
  const pm = L.mid.p;
  const midY = layerY(pm, 176);
  for (const [x, h, seed] of [[260, 96, 3], [980, 60, 5], [2350, 120, 7], [3120, 70, 9], [4480, 110, 11], [5200, 84, 13]] as const) {
    const b = paintSeaStack(seed, Math.round(h * 0.46), h);
    const f = bigFrame(r, b, b.w / 2, b.h - 2);
    L.mid.add(new Prop(f, x * pm, midY + 2, 1));
  }
  for (let x = 300; x < ISL.W; x += rng.range(380, 760)) {
    const b = paintReef(rng.int(36, 90), 9, rng.int(1, 99));
    const f = bigFrame(r, b, 0, b.h - 1);
    const lx = x * pm;
    const ry = midY - 4 + rng.range(-10, 8);
    L.mid.add(new Prop(f, lx, ry, 0.5));
    // surf bursting over the reef
    L.mid.add(new Custom(2, (rr, t) => {
      const k = Math.max(0, Math.sin(t.time * 0.9 + x));
      if (k < 0.3) return;
      for (let i = 0; i < 6; i++) rr.fxDraw(A.dot2, lx + 4 + i * (b.w - 8) / 6, ry - 3 - k * 5 - (i % 3), 2, 1, 0, packColor(1, 1, 1, 1), (k - 0.3) * 1.6, false);
    }));
  }

  // ---------------------------------------------------------------- forest walls behind the bush track
  const forestL: [number, number, 1 | 2 | 3][] = [[0.35, 0.3, 1], [0.6, 0.16, 2], [0.82, 0.06, 3]];
  const lines = { 1: 215, 2: 300, 3: 312 } as const;
  let insertAt = st.layers.indexOf(L.back);
  for (const [p, fog, depth] of forestL) {
    const lay = st.addLayer('forest' + depth, p, fog, 0.2 + depth * 0.1, 0, p);
    st.layers.splice(st.layers.indexOf(lay), 1);
    st.layers.splice(insertAt++, 0, lay);
    const span = layerSpan(st, p);
    const x0 = 5620 * p, x1 = span.x0 + span.w;
    const w = Math.min(2048, Math.ceil(x1 - x0) + 40);
    const buf = jcall<PixelBuffer>('forestStrip', depth, 40 + depth, w);
    if (!buf) continue;
    // the left edge, over the cove: a ragged, tapering silhouette (the forest thinning out toward the
    // cliff edge), never a dithered fade or a straight cut
    const edgeRng = new Rng(300 + depth);
    const ph = [edgeRng.range(0, 6), edgeRng.range(0, 6), edgeRng.range(0, 6)];
    for (let yy = 0; yy < buf.h; yy++) {
      const v = yy / buf.h;
      const e = 220 * (0.62 - v * 0.4) + Math.sin(yy * 0.021 + ph[0]) * 34 + Math.sin(yy * 0.067 + ph[1]) * 14 + Math.sin(yy * 0.29 + ph[2]) * 4;
      for (let xx = 0; xx < Math.min(buf.w, Math.ceil(e)); xx++) buf.data[yy * buf.w + xx] = 0;
    }
    const floorY = 180 - 66 * p + 42 / Math.pow(1.25, p);
    const f = bigFrame(r, buf);
    lay.add(new Prop({ ...f, ax: 0, ay: 0 }, x0, floorY - lines[depth] + 4));
  }

  // ---------------------------------------------------------------- behind the beach (p .9)
  const pb = L.back.p;
  const backY = layerY(pb, 216);
  // (the west headland is painted by v9/beach.ts, the long cliff with the sea cave and the cove by v9/east.ts)
  // boulders at the foot of the cliffs and around the west point
  for (const x of [120, 340, 520, 4620, 4760, 4880, 5580, 5700]) {
    const c = sprite(`boulder:${x % 3}`, () => deadwood('rock', 60 + (x % 3), 40 + (x % 3) * 12));
    if (c) L.back.add(new Prop(c.f, x * pb, backY + 6, 1, { flip: x % 2 === 0 }));
  }

  // ---------------------------------------------------------------- on the sand (main)
  const main = L.main;
  // palms leaning out over the water in the grove, and a couple by the landing beach
  for (const [x, h, lean] of [[2640, 190, -1], [2760, 220, 1], [2890, 170, -1], [3010, 240, 1], [3140, 200, -1], [3240, 180, 1], [1380, 200, -1], [2540, 210, 1], [5760, 190, 1]] as const) {
    const c = sprite(`palm:${h}`, () => tree('palm', 300 + h, h));
    if (c) main.add(new Prop(c.f, x, groundY(x) - 1, -4, { sway: 1.2, flip: lean < 0 }));
  }
  // rocks and drift on the walk line (behind the actors)
  for (let x = 460; x < 5000; x += rng.range(120, 260)) {
    const z = zoneAt(x);
    if (z === 'wreck' && x > 470 && x < 1310) continue;
    if (Math.abs(x - SPOT.stream) < 70) continue;
    const k = rng.next();
    const key = k < 0.4 ? 'drift' : k < 0.7 ? 'rock' : 'shells';
    const c = key === 'drift' ? sprite(`dw:${x % 4}`, () => deadwood('branch', 70 + (x % 4), 26)) : key === 'rock' ? sprite(`rk:${x % 4}`, () => deadwood('rock', 80 + (x % 4), 22)) : sprite(`sh:${x % 3}`, () => deadwood('litter', 90 + (x % 3), 14));
    if (c) main.add(new Prop(c.f, x, groundY(x) + 1, -3, { flip: rng.chance(0.5) }));
  }
  // wreckage from the Kittiwake strewn along the shore
  const junk: [number, () => PixelBuffer, number, number][] = [
    [1460, () => SF.lifeRing(), 0.4, 3], [2330, () => SF.deckChair(), -0.5, 2], [2720, () => SF.cooler(), 0.12, 2],
    [3260, () => SF.crate(20, 16, undefined, true), -0.2, 3], [3480, () => SF.bucket(), 1.4, 2], [3990, () => SF.ropeCoil(), 0, 2],
    [4560, () => SF.barrel(18), 1.57, 4], [4880, () => SF.crate(16, 14), 0.3, 3], [5640 + 60, () => SF.sack(), 0, 2], [5520, () => SF.chair(), 1.2, 3],
  ];
  for (const [x, paint, rot, sink] of junk) {
    const b = paint();
    const f = bigFrame(r, b, b.w / 2, b.h - 1);
    main.add(new Prop(f, x, groundY(x) + sink, -3.5, { rot }));
  }
  // the bush track: trees, tree ferns and undergrowth on the plateau
  for (let x = 5980; x < ISL.W; x += rng.range(60, 120)) {
    const kinds = ['treefern', 'nikau', 'broadleaf', 'treefern', 'kauri'] as const;
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const v = rng.int(0, 2);
    const c = sprite(`ft:${kind}:${v}`, () => tree(kind, 500 + v * 13, kind === 'kauri' ? 380 : kind === 'broadleaf' ? 280 : undefined));
    if (c) main.add(new Prop(c.f, x, groundY(x) + 1, -4 + rng.next(), { sway: kind === 'treefern' || kind === 'nikau' ? 1 : 0.2, flip: rng.chance(0.5) }));
  }
  for (let x = 5900; x < ISL.W; x += rng.range(14, 30)) {
    if (Math.abs(x - SPOT.creek) < 30) continue;
    const k = rng.next();
    const c = k < 0.4 ? sprite(`fp:fern:${x % 4}`, () => plant('fern', 600 + (x % 4))) : k < 0.55 ? sprite(`fp:crown:${x % 3}`, () => plant('crownfern', 610 + (x % 3))) : k < 0.7 ? sprite(`fp:kawa:${x % 3}`, () => plant('kawakawa', 620 + (x % 3))) : k < 0.8 ? sprite(`fp:moss:${x % 3}`, () => plant('moss', 630 + (x % 3))) : k < 0.9 ? sprite(`fp:log:${x % 2}`, () => deadwood('rottenlog', 640 + (x % 2))) : sprite(`fp:fun:${x % 3}`, () => fungus(x % 2 ? 'inkcap' : 'glowcap', 650 + (x % 3)));
    if (c) main.add(new Prop(c.f, x, groundY(x) + 2, -2 + rng.next() * 0.5, { sway: 0.8, flip: rng.chance(0.5) }));
  }
  // flax and bush where the beach meets the land at the grove and the stream
  for (let x = 3540; x < 4060; x += rng.range(40, 90)) {
    if (Math.abs(x - SPOT.stream) < 80) continue;
    const c = sprite(`flx:${x % 3}`, () => plant('flax', 660 + (x % 3), 40));
    if (c) main.add(new Prop(c.f, x, groundY(x) + 1, -3, { sway: 1.2 }));
  }

  // ---------------------------------------------------------------- in front of the camera (p 1.25)
  const pf = L.front.p;
  const fy = layerY(pf, 372);
  const tint = packColor(0.62, 0.66, 0.6, 1);
  const beach = (x: number) => { const z = zoneAt(x); return z !== 'forest' && z !== 'cave' && z !== 'rocks'; };
  for (let x = 400; x < 5900; x += rng.range(70, 170)) {
    if (!beach(x)) continue;
    const k = rng.next();
    let f: Frame | null = null;
    if (k < 0.5) { const c = sprite(`dune:${x % 5}`, () => paintDuneGrass(700 + (x % 5), 70, 56)); f = c?.f ?? null; }
    else if (k < 0.7) { const c = sprite(`fflax:${x % 3}`, () => foreground('flax', 710 + (x % 3), 150)); f = c?.f ?? null; }
    else if (k < 0.85) { const c = sprite(`flog:${x % 3}`, () => deadwood('log', 720 + (x % 3), 60)); f = c?.f ?? null; }
    else { const c = sprite(`fgrass:${x % 3}`, () => foreground('grass', 730 + (x % 3), 140)); f = c?.f ?? null; }
    if (f) L.front.add(new Prop(f, x * pf, fy + rng.range(-6, 10), rng.next(), { sway: k < 0.7 ? 0.9 : 0, flip: rng.chance(0.5), tint }));
  }
  // rocks framing the west point
  for (const x of [40, 180, 300]) {
    const c = sprite(`frock:${x % 3}`, () => deadwood('rock', 750 + (x % 3), 110));
    if (c) L.front.add(new Prop(c.f, x * pf, fy + 20, 1, { tint }));
  }
  // the bush: big fronds and leaves, canopy overhead
  for (let x = 5980; x < ISL.W + 100; x += rng.range(130, 220)) {
    const kind = (['fronds', 'leaves', 'monstera', 'flax'] as const)[rng.int(0, 3)];
    const c = sprite(`ff:${kind}:${x % 3}`, () => foreground(kind, 760 + (x % 3)));
    if (c) L.front.add(new Prop(c.f, x * pf, fy + 30, rng.next(), { sway: 0.6, tint: packColor(0.45, 0.52, 0.48, 1), flip: rng.chance(0.5) }));
  }
  for (let x = 6000; x < ISL.W + 200; x += rng.range(150, 260)) {
    const c = sprite(`fcan:${x % 3}`, () => canopyClump(770 + (x % 3), 300, 140));
    if (c) L.front.add(new Prop(c.f, x * pf, layerY(pf, -30) + rng.range(-10, 20), 3, { sway: 0.2, tint: packColor(0.42, 0.5, 0.46, 1) }));
  }

  // ---------------------------------------------------------------- V5 dressing: the old site kit's density
  // walk-line flora along the beach (behind the cast): grasses, sedge, flax, astelia, shore flowers
  const spots = Object.values(SPOT);
  const clear = (x: number, w: number) => spots.some(v => Math.abs(v - x) < w);
  const shore = (x: number) => { const z = zoneAt(x); return z === 'landing' || z === 'grove' || z === 'stream' || z === 'seal' || z === 'cove' || z === 'rocks'; };
  const flora = ['grass', 'sedge', 'flax', 'astelia', 'flowers', 'grass', 'flowers', 'kawakawa'] as const;
  for (let x = 60; x < 5900; x += rng.range(22, 58)) {
    if (!shore(x) || clear(x, 46) || Math.abs(x - SPOT.stream) < 90) continue;
    const kind = flora[rng.int(0, flora.length - 1)];
    const v = rng.int(0, 3);
    const size = kind === 'flax' ? rng.range(26, 38) : kind === 'flowers' ? rng.range(14, 22) : kind === 'astelia' ? 26 : kind === 'kawakawa' ? 30 : rng.range(16, 24);
    const c = sprite(`wl:${kind}:${v}:${Math.round(size / 4)}`, () => plant(kind, 800 + v * 7, size));
    if (c) main.add(new Prop(c.f, x, groundY(x) + 2, -2.6 + rng.next() * 0.3, { sway: 1.1, flip: rng.chance(0.5) }));
  }
  // mossy rocks with grass tufts at the headlands
  for (const x of [80, 210, 330, 4050, 4210, 4640, 5520, 5820]) {
    const c = sprite(`mrock:${x % 4}`, () => deadwood('rock', 820 + (x % 4), 34 + (x % 3) * 8));
    if (c) main.add(new Prop(c.f, x, groundY(x) + 3, -3.2, { flip: x % 2 === 1 }));
    const g = sprite(`mrg:${x % 3}`, () => plant('grass', 830 + (x % 3), 18));
    if (g) main.add(new Prop(g.f, x + 8, groundY(x + 8) - 6, -3.1, { sway: 1 }));
  }
  // more palms along the landing beach and the seal rocks
  for (const [x, h, lean] of [[1560, 230, 1], [1900, 175, -1], [2260, 205, 1], [4140, 215, -1], [4380, 185, 1], [5640, 225, -1]] as const) {
    if (clear(x, 40)) continue;
    const c = sprite(`palm:${h}`, () => tree('palm', 300 + h, h));
    if (c) main.add(new Prop(c.f, x, groundY(x) - 1, -4.2, { sway: 1.2, flip: lean < 0 }));
  }
  // denser foreground: flax, grasses, ferns and flowers right in front of the camera
  const fgKinds = ['grass', 'flax', 'fronds', 'grass', 'flax', 'leaves'] as const;
  for (let x = 380; x < 5950; x += rng.range(46, 110)) {
    if (!beach(x) && zoneAt(x) !== 'cove') continue;
    const kind = fgKinds[rng.int(0, fgKinds.length - 1)];
    const v = rng.int(0, 2);
    const c = sprite(`fg2:${kind}:${v}`, () => foreground(kind, 900 + v * 11, kind === 'fronds' || kind === 'leaves' ? 170 : 150));
    if (c) L.front.add(new Prop(c.f, x * pf, fy + 18 + rng.range(-6, 14), rng.next(), { sway: 0.8, flip: rng.chance(0.5), tint: packColor(0.5, 0.56, 0.52, 1) }));
    if (rng.chance(0.35)) {
      const fl = sprite(`fgfl:${v}`, () => plant('flowers', 910 + v, 34));
      if (fl) L.front.add(new Prop(fl.f, (x + 30) * pf, fy + 4 + rng.range(-4, 8), rng.next(), { sway: 1, tint }));
    }
  }
  // palm fronds hanging into the top of the frame over the grove and the landing beach
  for (let x = 1500; x < 4100; x += rng.range(260, 420)) {
    // (each with its trunk leaning in from above the frame)
    const c = sprite(`fpalm:${x % 2}`, () => foreground('palm', 930 + (x % 2), 220, { above: 240 }));
    if (c) L.front.add(new Prop(c.f, x * pf, layerY(pf, -40) + rng.range(-10, 10), 2, { sway: 0.5, flip: rng.chance(0.5), tint: packColor(0.4, 0.46, 0.42, 1) }));
  }
  // (the sea cave's rock arch is v9/east.ts too)
  void clamp; void smoothstep;
  // V9: the east half (x >= 3300) is hand-dressed in v9/east.ts, the west half in v9/beach.ts
  dressEast(s, L);
  dressWest(s, { mid: L.mid, back: L.back, main: L.main, front: L.front });
}


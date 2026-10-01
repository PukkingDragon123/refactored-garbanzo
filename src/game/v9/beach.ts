// V9 island dressing for the west half: the west rocks, the wreck of the Kittiwake, the landing beach
// and the palm grove (world x 0 .. WEST_END). The legacy V4/V5 dressing still runs in isleprops.ts
// for the whole shore; its props in this range are pruned here and replaced by a composed, layered
// set in three depths:
//  - the walk line (behind the cast): shore boulders, kelp, drift logs, palms, a few planks;
//  - the ground band (between the cast and the camera, drawn over them, scaled up a little with
//    distance): the wrack line, Kittiwake debris, driftwood, shells and the dune plants;
//  - the front layer (p 1.25, rising out of the bottom of the frame): big dune flora, flax, toetoe,
//    shrubs, rocks and logs, darker as they're nearest the lens.
// Everything is placed from a fixed seed, kept clear of story spots, culled by the visible range.

import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor, WHITE } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import type { Layer, Stage, Drawable } from '../../world/stage';
import { Prop } from '../../world/props';
import { sprite } from '../sites2/common';
import { tree } from '../../art/jungle-trees';
import type { Sprite } from '../../art/jungle-core';
import { paintHeadland } from '../../art/v9/headland';
import * as D from '../../art/v9/beach-debris';
import * as W from '../../art/v9/beach-wrack';
import * as F from '../../art/v9/beach-flora';
import type { Bed } from '../../art/v9/kit';
import { sandCol } from '../../art/v9/sand';
import { Rng } from '../../core/math';
import { SPOT, WRECK, groundY } from '../../art/island4/layout';
import type { IslandScene4 } from '../v4/island';
import { layerY } from '../v4/island';

/** everything west of this world x is dressed here (the stream mouth and beyond belong to isleprops) */
export const WEST_END = 3300;

export interface WestLayers { mid: Layer; back: Layer; main: Layer; front: Layer }

/** drop the legacy props that stand west of WEST_END on a layer (x is in that layer's own space) */
function prune(l: Layer) {
  const x1 = WEST_END * l.p;
  l.items = l.items.filter(d => !(d instanceof Prop) || d.x >= x1);
  l.markDirty();
}

interface Item { f: Frame; x: number; y: number; s: number; flip: boolean; sway: number; ph: number; tint: number; sh: number }

/** a batch of static props on one layer, drawn in order and culled by the visible x range */
class Strip implements Drawable {
  items: Item[] = [];
  private pad = 0;
  constructor(public z: number, readonly shadows = true) {}
  add(f: Frame, x: number, y: number, o: Partial<Item> = {}) {
    const it: Item = { f, x, y, s: 1, flip: false, sway: 0, ph: (x * 0.37) % 6.28, tint: WHITE, sh: 0, ...o };
    this.items.push(it);
    this.pad = Math.max(this.pad, f.w * it.s);
    return it;
  }
  /** draw nearer things last */
  sortByY() { this.items.sort((a, b) => a.y - b.y); }
  draw(r: Renderer, st: Stage) {
    const x0 = r.visibleX0(this.pad + 8), x1 = r.visibleX1(this.pad + 8);
    if (this.shadows) {
      r.beginShadows();
      for (const it of this.items) {
        if (!it.sh || it.x < x0 || it.x > x1) continue;
        r.draw(A.shadow, it.x, it.y + 0.5, it.sh * it.s / 32, 0.55 * it.s, 0, packColor(0, 0, 0, 0.32));
      }
      r.endShadows();
    }
    const w = st.wind, t = st.time;
    for (const it of this.items) {
      if (it.x < x0 || it.x > x1) continue;
      const sx = it.flip ? -it.s : it.s;
      if (it.sway) {
        const s = (Math.sin(t * 1.3 + it.ph) * 0.7 + Math.sin(t * 2.9 + it.ph * 1.7) * 0.3) * it.sway * (0.4 + w);
        r.drawSway(it.f, it.x, it.y, sx, it.s, s, it.tint);
      } else r.draw(it.f, it.x, it.y, sx, it.s, 0, it.tint);
    }
  }
}

export function dressWest(s: IslandScene4, L: WestLayers) {
  const r = game.r;
  for (const l of [L.back, L.main, L.front]) prune(l);

  // ---------------------------------------------------------------- the headland (back layer, p .9)
  // it climbs out of the top of the frame past the west end of the world and steps down to the sea
  const pb = L.back.p;
  const hd = paintHeadland(760, 300, 7, 0.8);
  L.back.add(new Prop(bigFrame(r, hd.buf, 0, hd.buf.h), -170, layerY(pb, 216) + 5, 0));

  const rng = new Rng(9091);
  const sp = (key: string, gen: () => Sprite) => sprite('v9w:' + key, gen)?.f ?? null;
  const walk = new Strip(-3.2), band = new Strip(56), front = new Strip(2, false);
  L.main.add(walk); L.main.add(band); L.front.add(front);

  // keep the story spots, the climb into the wreck, the camp and the gathering nodes readable
  const busy: [number, number][] = [[SPOT.moriWake - 40, SPOT.moriWake + 50], [SPOT.jenna - 40, SPOT.jenna + 40], [WRECK.climbX - 34, WRECK.climbX + 34],
    [2555, 2605], [2640, 2680], [2750, 2790], [2845, 2895], [2965, 3015], [3055, 3105], [3175, 3225], [3295, 3345]];
  const clearAt = (x: number, pad = 0) => !busy.some(([a, b]) => x > a - pad && x < b + pad);
  const camp = (x: number) => x > 1440 && x < 2320;
  const bedAt = (x: number, d: number): Bed => { const w = sandCol(x).wet; return d < w ? 'wet' : d < w + 8 ? 'damp' : 'dry'; };
  /** a ground-band prop d px toward the camera from the walk line */
  const onBand = (f: Frame | null, x: number, d: number, o: Partial<Item> = {}) => {
    if (!f) return;
    const k = 1 + d / 260;
    band.add(f, x, groundY(x) + d, { s: k, ...o });
  };

  // ---------------------------------------------------------------- the west rocks (0 .. 440)
  for (const [x, w, h] of [[24, 54, 34], [128, 40, 26], [212, 62, 30], [318, 36, 22], [404, 30, 16]] as const) {
    const f = sp(`sb:${x}`, () => W.boulder(x, w, h, 'shore', 'none'));
    if (f) walk.add(f, x, groundY(x) + 3, { flip: x % 2 === 0, sh: w });
  }
  for (let x = 30; x < 430; x += rng.range(34, 70)) {
    const d = rng.range(28, 96);
    if (rng.chance(0.55)) onBand(sp(`rb:${x % 5}`, () => W.boulder(200 + (x % 5), rng.range(16, 30), rng.range(10, 18), 'shore', 'none')), x, d, { flip: rng.chance(0.5), sh: 26 });
    else onBand(sp(`ks:${x % 3}`, () => W.kelpStrand(210 + (x % 3), 50, 'none')), x, d, { flip: rng.chance(0.5) });
  }

  // ---------------------------------------------------------------- the wreck, the beach, the grove: the walk line
  for (let x = 440; x < WEST_END; x += rng.range(40, 90)) {
    if (!clearAt(x, 10)) continue;
    const k = rng.next();
    const v = rng.int(0, 3);
    if (camp(x) && k > 0.55) continue;
    if (k < 0.14) walk.add(sp(`kh:${v}`, () => W.kelpHeap(300 + v, 22 + v * 7, 'none'))!, x, groundY(x) + 1, { flip: rng.chance(0.5) });
    else if (k < 0.45) walk.add(sp(`kst:${v}`, () => W.kelpStrand(310 + v, 50 + v * 10, 'none'))!, x, groundY(x) + 1, { flip: rng.chance(0.5) });
    else if (k < 0.58) walk.add(sp(`ws:${v}`, () => W.shellScatter(320 + v, 26, 8))!, x, groundY(x) + 1);
    else if (k < 0.72 && !camp(x)) walk.add(sp(`wl:${v}`, () => D.driftLog(330 + v, 60 + v * 18, 'wet'))!, x, groundY(x) + 2, { flip: rng.chance(0.5), sh: 60 + v * 18 });
    else if (k < 0.8 && x > 1000 && !camp(x)) walk.add(sp(`wb:${v}`, () => W.boulder(340 + v, 22 + v * 6, 12 + v * 3, 'shore', 'wet'))!, x, groundY(x) + 2, { sh: 24 + v * 6 });
    else walk.add(sp(`wf:${v}`, () => W.find((['feather', 'crab', 'jelly', 'pumice'] as const)[v], 350 + v, 'wet'))!, x, groundY(x) + 1);
  }
  // palms leaning out over the water in the grove and along the landing beach
  for (const [x, h, lean] of [[1380, 200, -1], [1560, 230, 1], [2260, 205, 1], [2540, 210, 1], [2640, 190, -1], [2760, 220, 1], [2890, 170, -1], [3010, 240, 1], [3140, 200, -1], [3240, 180, 1]] as const) {
    const c = sprite(`palm:${h}`, () => tree('palm', 300 + h, h));
    if (c) walk.add(c.f, x, groundY(x) - 1, { sway: 1.2, flip: lean < 0, sh: 24 });
  }

  // ---------------------------------------------------------------- the ground band
  // the fresh wrack line: heaps of kelp, shell grit, feathers and small finds at the swash's reach
  for (let x = 450; x < WEST_END; x += rng.range(30, 70)) {
    const d = sandCol(x).wet + 4 + rng.range(-2, 3);
    const k = rng.next(), v = rng.int(0, 4);
    if (k < 0.2) onBand(sp(`bk:${v}`, () => W.kelpHeap(400 + v, 18 + v * 6, 'none')), x, d, { flip: rng.chance(0.5) });
    else if (k < 0.36) onBand(sp(`bks:${v}`, () => W.kelpStrand(405 + v, 30 + v * 8, 'none')), x, d, { flip: rng.chance(0.5) });
    else if (k < 0.7) onBand(sp(`bs:${v}`, () => W.shellScatter(410 + v, 22 + v * 3, 6 + v)), x, d);
    else onBand(sp(`bf:${v}`, () => W.find((['paua', 'kina', 'star', 'cuttle', 'whelk'] as const)[v], 420 + v, 'damp')), x, d + rng.range(0, 4));
  }
  // the Kittiwake's debris field, densest below the wreck, thinning along the landing beach
  const debris: [number, number, () => Sprite, number][] = [
    [500, 44, () => D.plank(501, 60, 'hull', 'dry', 0.06), 50], [560, 70, () => D.rope(502, 120, 'dry'), 0], [640, 52, () => D.crate(503, 'dry'), 30],
    [700, 38, () => D.plank(504, 46, 'red', 'damp', -0.1), 40], [742, 82, () => D.driftLog(505, 110, 'dry'), 110], [870, 48, () => D.drum(506, 'dry'), 26],
    [930, 64, () => D.plank(507, 52, 'deck', 'dry', 0.14), 46], [985, 40, () => D.floats(508, 'damp'), 30], [1040, 76, () => D.tarp(509, 76, 'tarp', 'dry'), 76],
    [1110, 50, () => D.jerryCan('dry'), 16], [1150, 90, () => D.driftLog(510, 80, 'dry'), 80], [1200, 46, () => D.net(511, 44, 'dry'), 40],
    [1270, 62, () => D.plank(512, 40, 'grey', 'dry', -0.18), 36], [1330, 42, () => D.bottle('brown', 'damp'), 0], [1470, 54, () => D.lifeRing('dry'), 22],
    [1560, 70, () => D.oar(58, 'dry'), 40], [1640, 46, () => D.plank(513, 50, 'hull', 'dry', -0.05), 44], [1735, 58, () => D.nameBoard('dry'), 50],
    [1830, 86, () => D.driftLog(514, 96, 'dry'), 96], [1900, 44, () => D.crate(515, 'dry', 20, 14), 26], [2085, 40, () => D.bottle('green', 'damp'), 0],
    [2150, 62, () => D.cooler('dry'), 24], [2230, 50, () => D.plank(516, 36, 'deck', 'dry', 0.2), 30], [2330, 70, () => D.tarp(517, 86, 'sail', 'dry'), 84],
    [2440, 48, () => D.floats(518, 'dry'), 30], [2520, 92, () => D.driftLog(519, 120, 'dry'), 120], [2700, 60, () => D.driftBranch(520, 56, 'dry'), 50],
    [2960, 78, () => D.driftLog(521, 70, 'dry'), 70], [3150, 56, () => D.rope(522, 80, 'dry'), 0],
  ];
  for (const [x, d, gen, sh] of debris) onBand(sp(`db:${x}`, gen), x, d, { sh });
  // driftwood branches and bird-scattered shells across the dry sand
  for (let x = 470; x < WEST_END; x += rng.range(70, 150)) {
    const d = rng.range(44, 100), v = rng.int(0, 2);
    if (rng.chance(0.5)) onBand(sp(`dbr:${v}`, () => D.driftBranch(530 + v, 36 + v * 12, 'dry')), x, d, { flip: rng.chance(0.5), sh: 30 });
    else onBand(sp(`dss:${v}`, () => W.shellScatter(540 + v, 18, 5)), x, d);
  }
  // dune plants at the foot of the frame: spinifex, pīngao, marram, ice plant, pōhuehue; the grove
  // gets shrubs and flax under the palms
  for (let x = 450; x < WEST_END; x += rng.range(22, 52)) {
    const d = rng.range(84, 118), v = rng.int(0, 3);
    const grove = x > 2600;
    const k = rng.next();
    let f: Frame | null;
    if (grove && k < 0.22) f = sp(`gt:${v}`, () => F.taupata(600 + v, 26 + v * 5, 'dry'));
    else if (grove && k < 0.36) f = sp(`gh:${v}`, () => F.harakeke(610 + v, 34 + v * 6, 'dry', v % 2, v === 3));
    else if (k < 0.4) f = sp(`ds:${v}`, () => F.spinifex(620 + v, 18 + v * 4, 'dry', v % 3));
    else if (k < 0.58) f = sp(`dp:${v}`, () => F.pingao(630 + v, 14 + v * 4, 'dry'));
    else if (k < 0.7) f = sp(`dm:${v}`, () => F.marram(640 + v, 20 + v * 5, 'dry'));
    else if (k < 0.85) f = sp(`di:${v}`, () => F.icePlant(650 + v, 30 + v * 8, 'dry'));
    else f = sp(`dg:${v}`, () => F.morningGlory(660 + v, 40 + v * 8, 'dry'));
    onBand(f, x, d, { sway: k < 0.7 ? 0.6 : 0, flip: rng.chance(0.5) });
  }

  band.sortByY();

  // ---------------------------------------------------------------- the front layer (p 1.25)
  const pf = L.front.p;
  const fy = layerY(pf, 372);
  const dark = (k: number) => packColor(0.56 * k, 0.6 * k, 0.56 * k, 1);
  for (let x = 380; x < WEST_END + 60; x += rng.range(60, 140)) {
    const k = rng.next(), v = rng.int(0, 2);
    const grove = x > 2600;
    let f: Frame | null, sway = 0.7, y = fy + rng.range(4, 26);
    if (k < 0.2) f = sp(`fs:${v}`, () => F.spinifex(700 + v, 50 + v * 10, 'dry', 1 + v % 2));
    else if (k < 0.36) f = sp(`fp:${v}`, () => F.pingao(710 + v, 40 + v * 8, 'dry'));
    else if (k < 0.5) f = sp(`fm:${v}`, () => F.marram(720 + v, 64 + v * 10, 'dry'));
    else if (k < 0.64) { f = sp(`fh:${v}`, () => F.harakeke(730 + v, 90 + v * 20, 'dry', 1 + v % 2, v === 2)); y += 14; }
    else if (k < 0.74) { f = sp(`ft:${v}`, () => F.toetoe(740 + v, 80 + v * 14, 'dry', 3)); y += 14; }
    else if (k < 0.84 || (grove && k < 0.92)) { f = sp(`fu:${v}`, () => F.taupata(750 + v, 60 + v * 12, 'dry')); sway = 0.25; }
    else { f = sp(`fl:${v}`, () => D.driftLog(760 + v, 150 + v * 30, 'dry')); sway = 0; y = fy + rng.range(8, 20); }
    if (f) front.add(f, x * pf, y, { sway, flip: rng.chance(0.5), tint: dark(rng.range(0.82, 1)) });
  }
  // big shore boulders framing the west rocks
  for (const [x, w, h] of [[30, 120, 70], [170, 90, 56], [320, 130, 64]] as const) {
    const f = sp(`frk:${x}`, () => W.boulder(800 + x, w, h, 'shore', 'none'));
    if (f) front.add(f, x * pf, fy + 26, { tint: dark(1) });
  }
  void s;
}

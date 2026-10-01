// V9 dressing for the east half of the island (x >= EAST_X0: the stream mouth, the seal rocks, under
// the cliffs, the sea cave, the hidden cove, the bush track and the forest plateau). The shared scatter
// loops in v4/isleprops.ts run along the whole shore (so their random sequence, and the west half's
// layout, never shift); dressEast() drops what they put out here and lays down the hand-placed east:
// running water and wading physics, banks of reeds and flax, tide pools, fallen boulders, the cliffs
// with their seabirds, the layered sea cave, the cove and the forest in depth, with the environmental
// particles of each place.

import type { Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { local } from '../assets';
import type { Layer } from '../../world/stage';
import { Prop, Custom } from '../../world/props';
import { sprite } from '../sites2/common';
import type { PixelBuffer } from '../../art/pixel';
import * as SF from '../../art/ship4/furniture';
import { plant, deadwood, fungus } from '../../art/jungle-plants';
import { foreground } from '../../art/jungle-fg';
import { tree, canopyClump } from '../../art/jungle-trees';
import type { Sprite } from '../../art/jungle-core';
import { paintDuneGrass } from '../../art/island4/scenery';
import { ISL, SPOT, groundY } from '../../art/island4/layout';
import { Rng, rand } from '../../core/math';
import { EAST_X0 } from '../../art/v9/eastground';
import { MOUTH, CREEK, baseTop, persp, mouthAt, creekAt, tidePoolAt } from '../../art/v9/eastgeo';
import * as EA from '../../art/v9/eastart';
import { paintEastCliff } from '../../art/v9/eastcliff';
import { paintCaveFront, paintCaveColumn, paintStalagmite } from '../../art/v9/eastcave';
import { ChannelFx, DeltaFx, CascadeFx, PoolRings, MOUTH_CH, CREEK_CH } from './streamfx';
import { CaveDrips, CliffBirds, SeaSpray, Drifters, GroundMist } from './eastfx';
import { IsleWater } from './water';
import { layerY } from '../v4/island';
import type { IslandScene4 } from '../v4/island';
import type { IsleLayers } from '../v4/isleprops';

interface Ctx { s: IslandScene4; L: IsleLayers; rng: Rng }

/** drop the shared scatter's props east of EAST_X0 (only Props: the ground, fx and story are Customs) */
function clearEast(L: IsleLayers) {
  for (const l of [L.main, L.front, L.back]) {
    l.items = l.items.filter(d => !(d instanceof Prop) || d.x / l.p < EAST_X0);
    l.markDirty();
  }
}

/** a sprite from one of the east painters, cached per key in the scene atlas */
function sp(key: string, gen: () => Sprite) {
  return sprite('v9e:' + key, gen)!.f;
}
/** place on the ground plane `dd` rows in front of the walk line (z above the actors: it is nearer) */
function onGround(l: Layer, f: Frame, x: number, dd: number, o: { sway?: number; flip?: boolean; tint?: number; z?: number } = {}) {
  l.add(new Prop(f, x, baseTop(x) + dd, o.z ?? 60 + dd * 0.02, { sway: o.sway ?? 0, flip: o.flip, tint: o.tint }));
}

// ------------------------------------------------------------------ the stream mouth

function streamMouth(c: Ctx) {
  const { s, L, rng } = c;
  const main = L.main;
  // the animated surface, the delta and the stones the water breaks around
  const stones = [0, 1, 2, 3].map(i => sp('stone' + i, () => EA.paintStone(40 + i, 16 + i * 4, 8 + i * 2, { moss: i === 2 })));
  main.add(new ChannelFx(MOUTH_CH, s.clock, 31, stones));
  main.add(new DeltaFx(s.clock));
  // banks: raupō in the shallows, flax and toetoe higher up, sedge and fern tufts, driftwood caught
  const reeds = [0, 1, 2].map(i => sp('reeds' + i, () => EA.paintReeds(50 + i, 34 + i * 12)));
  const toetoe = [0, 1].map(i => sp('toetoe' + i, () => EA.paintToetoe(60 + i, 46 + i * 10)));
  const fern = [0, 1].map(i => sp('bfern' + i, () => EA.paintBankFern(70 + i, 12 + i * 5)));
  const flax = [0, 1, 2].map(i => sprite(`v9e:flax${i}`, () => plant('flax', 80 + i, 30 + i * 8))!.f);
  const sedge = [0, 1].map(i => sprite(`v9e:sedge${i}`, () => plant('sedge', 90 + i, 16 + i * 5))!.f);
  const drift = sp('drift0', () => EA.paintDriftwood(95, 52));
  // clumps along the banks: [side, row, what] - tall reeds and flax only well in front of the ford (so
  // nothing hides the crossing), low sedge at the delta's edges, bare gravel on the inside of bends
  const clumps: [number, number, 'reed' | 'flax' | 'toetoe' | 'fern' | 'sedge'][] = [
    [-1, 8, 'sedge'], [1, 6, 'sedge'], [-1, 22, 'sedge'], [1, 30, 'fern'],
    [-1, 52, 'reed'], [-1, 60, 'sedge'], [-1, 96, 'toetoe'], [-1, 104, 'reed'], [-1, 112, 'fern'], [-1, 150, 'reed'], [-1, 158, 'flax'],
    [1, 64, 'flax'], [1, 72, 'sedge'], [1, 118, 'reed'], [1, 126, 'reed'], [1, 132, 'sedge'], [1, 168, 'toetoe'],
  ];
  for (const [side, dd, kind] of clumps) {
    const [cx, hw] = mouthAt(dd);
    const P = persp(dd);
    const f = kind === 'reed' ? reeds[dd > 90 ? 2 : rng.int(0, 1)] : kind === 'flax' ? flax[rng.int(0, 2)] : kind === 'toetoe' ? toetoe[rng.int(0, 1)] : kind === 'fern' ? fern[rng.int(0, 1)] : sedge[rng.int(0, 1)];
    // rooted on the bank: the clump's inner half may lean over the water, never stand in it
    const x = cx + side * (hw + f.w * (kind === 'reed' ? 0.2 : 0.32) + rng.range(1, 4) * P);
    onGround(main, f, x, dd, { sway: 0.7, flip: rng.chance(0.5) });
    // small tufts crowding the big ones
    if (kind !== 'sedge') {
      const t = sedge[rng.int(0, 1)];
      onGround(main, t, x + side * (f.w * 0.4 + rng.range(2, 6) * P), dd + 2, { sway: 0.9, flip: rng.chance(0.5) });
      if (rng.chance(0.6)) onGround(main, sedge[0], x - side * f.w * 0.3, dd + 3, { sway: 0.9 });
    }
  }
  onGround(main, drift, mouthAt(84)[0] + mouthAt(84)[1] + 14, 84, { flip: true });
  // the shore either side of the ford: flax and sedge on the walk line, behind the cast
  for (const [x, i] of [[3662, 0], [3690, 2], [3875, 1], [3905, 0]] as const) main.add(new Prop(flax[i], x, baseTop(x) + 1, -3, { sway: 1.1, flip: x > MOUTH.x }));
  // pollen and thistle-down over the banks
  main.add(new Drifters(3420, 4000, 120, 215, 22, 'seed', s.clock));
  main.add(new Drifters(3500, 3950, 150, 225, 16, 'pollen', s.clock));
}

// ------------------------------------------------------------------ the creek on the plateau

function creek(c: Ctx) {
  const { s, L, rng } = c;
  const main = L.main;
  const stones = [0, 1, 2].map(i => sp('cstone' + i, () => EA.paintStone(140 + i, 14 + i * 5, 8 + i * 2, { moss: true })));
  main.add(new ChannelFx(CREEK_CH, s.clock, 37, stones));
  // the ledge behind the walk line and the fall over its notch
  const ledge = sp('ledge', () => EA.paintLedge(150, 116, CREEK.fall, CREEK.fallW + 1));
  main.add(new Prop(ledge, CREEK.x, baseTop(CREEK.x) - 1, -4.2));
  main.add(new CascadeFx(s.clock, main));
  const rings = new PoolRings(2.2, () => [CREEK.x + (Math.random() - 0.5) * CREEK.fallW * 2, baseTop(CREEK.x) + 2 + Math.random() * 4], 14);
  main.add(rings);
  // mossy banks with ferns spilling over, down toward the camera
  const fern = [0, 1, 2].map(i => sp('cfern' + i, () => EA.paintBankFern(160 + i, 12 + i * 5)));
  const mound = [0, 1].map(i => sp('cmound' + i, () => EA.paintMossMound(170 + i, 20 + i * 10)));
  for (const side of [-1, 1]) for (let dd = 16; dd < 170; dd += rng.range(10, 18)) {
    const [cx, hw] = creekAt(dd);
    const P = persp(dd);
    const f = rng.chance(0.65) ? fern[rng.int(0, 2)] : mound[rng.int(0, 1)];
    onGround(main, f, cx + side * (hw + f.w * 0.3 + rng.range(0, 4) * P), dd, { sway: 0.6, flip: side < 0 });
  }
}

// ------------------------------------------------------------------ the shore's wreckage (story flavour)

function wreckage(c: Ctx) {
  const junk: [number, () => PixelBuffer, number, number][] = [
    [3480, () => SF.bucket(), 1.4, 2], [3990, () => SF.ropeCoil(), 0, 2], [4560, () => SF.barrel(18), 1.57, 4],
    [4880, () => SF.crate(16, 14), 0.3, 3], [5700, () => SF.sack(), 0, 2], [5520, () => SF.chair(), 1.2, 3],
  ];
  for (const [x, paint, rot, sink] of junk) {
    const b = paint();
    c.L.main.add(new Prop(bigFrame(game.r, b, b.w / 2, b.h - 1), x, groundY(x) + sink, -3.5, { rot }));
  }
}

// ------------------------------------------------------------------ the seal rocks

function sealRocks(c: Ctx) {
  const { s, L, rng } = c;
  const main = L.main;
  // haul-out rocks along the back of the beach (behind the cast; the seal sleeps in front at 4330)
  for (const [x, w, h] of [[4030, 74, 34], [4120, 38, 20], [4205, 54, 26], [4400, 46, 22], [4480, 66, 32], [4575, 88, 40], [4655, 44, 22]] as const) {
    main.add(new Prop(sp(`brock${x}`, () => EA.paintBarnacleRock(x, w, h)), x, groundY(x) + 2, -3.4, { flip: x % 3 === 0 }));
  }
  // low flat basking rocks where the kelp skinks sun themselves (shorelife.ts puts them at groundY - 6)
  for (const x of [4260, 4700, 5600]) main.add(new Prop(sp(`skrock${x}`, () => EA.paintBarnacleRock(x + 1, 26, 7)), x, groundY(x) + 1, -3.3));
  // weed and kelp washed up along the tide line
  for (let x = 4010; x < 4700; x += rng.range(50, 130)) {
    const f = sprite(`v9e:kelp${x % 3}`, () => plant('sedge', 300 + (x % 3), 10))!.f;
    onGround(main, f, x, rng.range(14, 24), { tint: packColor(0.36, 0.34, 0.2, 1), z: -9.2, flip: rng.chance(0.5) });
  }
  // outer rocks in the surf, the swell bursting white over them
  const near = L.near, pn = near.p, ny = layerY(pn, 207);
  const outer: [number, number, number][] = [];
  for (const [x, w, h] of [[4090, 46, 18], [4300, 70, 26], [4520, 40, 16], [4640, 58, 22]] as const) {
    const X = x * pn;
    near.add(new Prop(sp(`orock${x}`, () => EA.paintBarnacleRock(x + 7, w, h)), X, ny, 7, { tint: packColor(0.78, 0.82, 0.86, 1) }));
    outer.push([X, ny - h * 0.8, w * 0.7]);
  }
  near.add(new SeaSpray(outer, near, s.clock));
  // tide pool life: anemones opening and closing, tiny fish darting
  const an = [0, 1, 2, 3].map(i => local.add(`v9:anem${i}`, EA.paintAnemone(i, i % 2 ? 0.2 : 1, i > 1), 4.5, 5));
  // anemones and fish live where the reef's pools really are (sampled from the same noise as the ground)
  const life: [number, number, number, number][] = [], fish: [number, number][] = [];
  for (let i = 0; i < 900 && life.length < 26; i++) {
    const x = rng.range(4000, 4720), dd = rng.range(6, 120);
    if (tidePoolAt(x, dd) > 0.04) { life.push([x, dd, rng.int(0, 1) * 2, rng.range(0, 9)]); if (life.length % 3 === 0) fish.push([x, dd]); }
  }
  main.add(new Custom(-9.25, (rr, st) => {
    const x0 = rr.visibleX0(10), x1 = rr.visibleX1(10);
    if (x1 < 4000 || x0 > 4720) return;
    for (const [x, dd, kind, ph] of life) {
      if (x < x0 || x > x1) continue;
      const open = Math.sin(st.time * 0.4 + ph) > -0.3 ? 0 : 1;
      rr.draw(an[kind + open], x, baseTop(x) + dd, 1, 1, 0, packColor(0.85, 0.85, 0.9, 1));
    }
    for (let i = 0; i < fish.length; i++) {
      const [px, pd] = fish[i];
      // hang still, then dart to a new spot
      const t = st.time * (0.5 + (i % 3) * 0.2) + i * 4;
      const a = Math.floor(t / 3), f = Math.min(1, (t % 3) * 5);
      const ox = Math.sin(a * 2.3 + i) * 5 * (1 - f) + Math.sin((a + 1) * 2.3 + i) * 5 * f;
      const fx = px + ox * persp(pd);
      if (fx < x0 || fx > x1) continue;
      rr.rect(Math.round(fx), Math.round(baseTop(fx) + pd + Math.cos(a * 1.7 + i)), 2, 1, packColor(0.1, 0.13, 0.13, 0.85));
    }
  }));
}

// ------------------------------------------------------------------ the cliffs and their foot

function cliffs(c: Ctx) {
  const { s, L, rng } = c;
  const back = L.back, pb = back.p, backY = layerY(pb, 216);
  const cx0 = Math.round(4520 * pb), cw = Math.round(6120 * pb) - cx0, H = 320;
  const cl = paintEastCliff(cw, H, 9, {
    left: 190, right: cw - 170, cave: [Math.round(4990 * pb) - cx0, Math.round(5500 * pb) - cx0], arch: 200,
    skylights: [Math.round(5190 * pb) - cx0, Math.round(5330 * pb) - cx0],
  });
  const top = backY + 4 - H;
  back.add(new Prop(bigFrame(game.r, cl.buf, 0, H), cx0, backY + 4, 0));
  back.add(new CliffBirds(cl.ledges.map(([a, b, y]) => [a + cx0, b + cx0, y + top] as [number, number, number]), 16, s.clock));
  // hanging plants on the cove's face: vines trailing from the ledges
  const vine = [0, 1, 2].map(i => sprite(`v9e:vine${i}`, () => plant('vine', 330 + i, 40 + i * 14))!.f);
  for (let x = 5470; x < 5940; x += rng.range(26, 60)) {
    const X = Math.round(x * pb) - cx0;
    const y = top + Math.max(cl.top(X) + 12, rng.range(H * 0.25, H * 0.7));
    back.add(new Prop(vine[rng.int(0, 2)], x * pb, y, 1, { sway: 0.5, flip: rng.chance(0.5) }));
  }
  // salt ferns along the cliff foot
  const fern = [0, 1].map(i => sp('cfern' + (i + 4), () => EA.paintBankFern(340 + i, 10 + i * 4)));
  for (let x = 4740; x < 5960; x += rng.range(30, 70)) {
    if (x > 4990 && x < 5500) continue;
    back.add(new Prop(fern[rng.int(0, 1)], x * pb, backY + 3, 1.2, { sway: 0.6, flip: rng.chance(0.5) }));
  }
  // fallen boulders at the cliff foot, ferns and flax among them (behind the cast)
  const main = L.main;
  for (const [x, w, h] of [[4728, 46, 24], [4790, 30, 16], [4850, 62, 30], [4935, 38, 20], [5010, 54, 28], [5470, 50, 26], [5530, 28, 14], [5860, 44, 22]] as const) {
    main.add(new Prop(sp(`boul${x}`, () => EA.paintStone(x, w, h, { moss: x % 2 === 0, wetLine: 0.15 })), x, groundY(x) + 2, -3.6, { flip: x % 3 === 0 }));
    main.add(new Prop(fern[x % 2], x + w * 0.4, groundY(x) + 1, -3.5, { sway: 0.7 }));
  }
  const flax = sprite('v9e:flax1', () => plant('flax', 81, 38))!.f;
  for (const x of [4760, 4900, 5560, 5820]) main.add(new Prop(flax, x, groundY(x) + 1, -3.2, { sway: 1.1, flip: x % 2 === 0 }));
  // salt haze hanging along the foot of the cliffs
  main.add(new Drifters(4700, 5060, 120, 205, 26, 'salt', s.clock));
}

// ------------------------------------------------------------------ the sea cave

function seaCave(c: Ctx) {
  const { s, L, rng } = c;
  const st = s.st, pf = L.front.p;
  // the rock in front of the camera: roof, entrance pillars, the lip of tumbled boulders
  // (the buffer runs from well above to well below the frame at every zoom from 1.0 up, so neither its
  // top nor its bottom edge can ever show)
  const fx0 = 4985 * pf, fw = Math.round((5515 - 4985) * pf), above = 90, below = 80, fh = 300 + above + below;
  const front = paintCaveFront(fw, fh, 5, { roof: 92 + above, lip: 54 + below, pillar: 88, skylights: [[Math.round(5190 * pf - fx0), 11], [Math.round(5330 * pf - fx0), 9]] });
  const ff = bigFrame(game.r, front.buf);
  const fy = layerY(pf, -8) - above;
  L.front.add(new Custom(4, rr => rr.draw(ff, fx0, fy, 1, 1, 0, packColor(0.8, 0.8, 0.84, 1))));
  // flowstone columns and curtains between the walk line and the back wall, on their own depth
  const mid = st.addLayer('cave-mid', 0.96, 0, 0.7, 0, 0.96);
  st.layers.splice(st.layers.indexOf(mid), 1);
  st.layers.splice(st.layers.indexOf(L.main), 0, mid);
  const pm = mid.p, my = layerY(pm, 214);
  for (const [x, w, full] of [[5122, 34, true], [5168, 22, false], [5236, 18, false], [5304, 42, true], [5372, 26, false], [5410, 30, true]] as const) {
    const f = sp(`col${x}`, () => paintCaveColumn(x, w, 200, full));
    mid.add(new Prop(f, x * pm, my, 0, { tint: packColor(0.72, 0.72, 0.76, 1) }));
  }
  // dripstone on the floor behind the walk line
  const main = L.main;
  for (const [x, w, h] of [[5112, 8, 18], [5140, 12, 30], [5160, 6, 12], [5318, 10, 22], [5352, 14, 34], [5376, 7, 14], [5420, 9, 20]] as const) {
    main.add(new Prop(sp(`mite${x}`, () => paintStalagmite(x, w, h)), x, groundY(x) + 1, -3.4));
  }
  // drips from the roof into the pool and onto the floor
  const rings = new PoolRings(0, () => null, 12);
  main.add(rings);
  const srcs: [number, number][] = [];
  for (let i = 0; i < 16; i++) srcs.push([Math.round(5120 + rng.next() * 290), Math.round(rng.range(58, 78))]);
  for (let i = 0; i < 6; i++) srcs.push([Math.round(5210 + rng.next() * 80), Math.round(rng.range(60, 74))]);
  main.add(new CaveDrips(srcs, rings, main, x => s.sfx('drip', x, 0.35, rand.range(0.85, 1.2))));
  // dust motes turning in the skylight shafts
  const shaft = (x: number) => Math.max(0, 1 - Math.abs(x - 5190) / 16, 1 - Math.abs(x - 5330) / 13);
  main.add(new Drifters(5150, 5370, 50, 205, 60, 'mote', s.clock, shaft));
}

// ------------------------------------------------------------------ the hidden cove

function cove(c: Ctx) {
  const main = c.L.main;
  const drift = [0, 1].map(i => sp('drift' + (i + 1), () => EA.paintDriftwood(410 + i, 56 + i * 24)));
  main.add(new Prop(drift[1], 5540, groundY(5540) + 2, -3.3));
  main.add(new Prop(drift[0], 5790, groundY(5790) + 2, -3.3, { flip: true }));
  onGround(main, drift[0], 5712, 48, { flip: true });
  const palm = sprite('palm:225', () => tree('palm', 525, 225))!.f;
  main.add(new Prop(palm, 5760, groundY(5760) - 1, -4, { sway: 1.2 }));
}

// ------------------------------------------------------------------ the bush track and the plateau

function bush(c: Ctx) {
  const { s, L, rng } = c;
  const main = L.main, back = L.back, pb = back.p;
  const clear = (x: number) => Math.abs(x - CREEK.x) < 56 || Math.abs(x - SPOT.joshu) < 22 || Math.abs(x - 6130) < 10;
  const treeF = (kind: 'treefern' | 'nikau' | 'broadleaf' | 'kauri' | 'rata', v: number) => sprite(`ft:${kind}:${v}`, () => tree(kind, 500 + v * 13, kind === 'kauri' ? 380 : kind === 'broadleaf' || kind === 'rata' ? 280 : undefined))!.f;
  // trees on the walk line (behind the cast)
  for (let x = 5975; x < ISL.W + 40; x += rng.range(55, 110)) {
    const kind = (['treefern', 'nikau', 'broadleaf', 'treefern', 'kauri', 'rata'] as const)[rng.int(0, 5)];
    const f = treeF(kind, rng.int(0, 2));
    if (clear(x)) continue;
    main.add(new Prop(f, x, groundY(x) + 1, -4 + rng.next(), { sway: kind === 'treefern' || kind === 'nikau' ? 1 : 0.2, flip: rng.chance(0.5) }));
  }
  // a second rank a little further back, hazier (back layer)
  for (let x = 5990; x < ISL.W + 120; x += rng.range(70, 140)) {
    const f = treeF((['treefern', 'nikau', 'kauri', 'broadleaf'] as const)[rng.int(0, 3)], rng.int(0, 2));
    back.add(new Prop(f, x * pb, layerY(pb, 216) + (groundY(x) - ISL.GY) * pb + 2, 2, { sway: 0.3, flip: rng.chance(0.5), tint: packColor(0.7, 0.76, 0.74, 1) }));
  }
  // undergrowth along the walk line
  const under = (x: number) => {
    const k = rng.next(), v = rng.int(0, 3);
    return k < 0.32 ? sprite(`fp:fern:${v}`, () => plant('fern', 600 + v))!.f
      : k < 0.46 ? sprite(`fp:crown:${v % 3}`, () => plant('crownfern', 610 + (v % 3)))!.f
        : k < 0.6 ? sprite(`fp:kawa:${v % 3}`, () => plant('kawakawa', 620 + (v % 3)))!.f
          : k < 0.7 ? sprite(`fp:kiokio:${v % 2}`, () => plant('kiokio', 625 + (v % 2)))!.f
            : k < 0.8 ? sprite(`fp:moss:${v % 3}`, () => plant('moss', 630 + (v % 3)))!.f
              : k < 0.9 ? sprite(`fp:log:${v % 2}`, () => deadwood('rottenlog', 640 + (v % 2)))!.f
                : sprite(`fp:fun:${x % 2}:${v % 3}`, () => fungus(x % 2 ? 'inkcap' : 'bracket', 650 + (v % 3)))!.f;
  };
  for (let x = 5905; x < ISL.W; x += rng.range(14, 30)) {
    const f = under(x);
    if (clear(x)) continue;
    main.add(new Prop(f, x, groundY(x) + 2, -2 + rng.next() * 0.5, { sway: 0.8, flip: rng.chance(0.5) }));
  }
  // the forest floor in front of the walk line: ferns, moss mounds, logs, stumps and fungi in depth
  const mound = [0, 1, 2].map(i => sp('fmound' + i, () => EA.paintMossMound(500 + i, 22 + i * 12)));
  const ffern = [0, 1, 2].map(i => sp('ffern' + i, () => EA.paintBankFern(510 + i, 14 + i * 6)));
  const logs = [0, 1].map(i => sprite(`v9e:flog${i}`, () => deadwood(i ? 'log' : 'rottenlog', 520 + i, 46 + i * 14))!.f);
  const stump = sprite('v9e:stump', () => deadwood('stump', 530, 34))!.f;
  const roots = sprite('v9e:roots', () => deadwood('roots', 531, 26))!.f;
  for (let x = 5960; x < ISL.W + 20; x += rng.range(22, 46)) {
    const dd = rng.range(14, 150);
    const P = persp(dd);
    const [ccx, chw] = creekAt(dd);
    const k = rng.next();
    const f = k < 0.4 ? ffern[rng.int(0, 2)] : k < 0.65 ? mound[rng.int(0, 2)] : k < 0.75 ? logs[rng.int(0, 1)] : k < 0.82 ? stump : k < 0.9 ? roots : under(x);
    if (Math.abs(x - ccx) < chw + 30 * P) continue;
    onGround(main, f, x, dd, { sway: 0.5, flip: rng.chance(0.5) });
  }
  // the air under the canopy: spores glinting at night, pollen in the sunny gaps; mist low down
  main.add(new Drifters(5950, 6900, 30, 170, 40, 'spore', s.clock));
  main.add(new Drifters(5950, 6900, 40, 170, 18, 'pollen', s.clock));
  main.add(new GroundMist(6250, 6900, s.clock));
}

// ------------------------------------------------------------------ in front of the camera (p 1.25)

/**
 * The foreground framing along the east: shore plants and rocks rising into the bottom of the frame,
 * forest fronds and trunks on the plateau, branches and canopy hanging into the top. Rows follow the
 * walk line up the bush track so the frame stays filled while the camera climbs with the player.
 */
function frontFraming(c: Ctx) {
  const { L, rng } = c;
  const F = L.front, pf = F.p;
  const fyAt = (x: number, sy = 372) => layerY(pf, sy) + (groundY(x) - ISL.GY) * pf;
  const shore = packColor(0.6, 0.64, 0.58, 1), bushT = packColor(0.44, 0.5, 0.46, 1), dark = packColor(0.3, 0.34, 0.33, 1);
  const zone = (x: number) => (x < 4000 ? 'stream' : x < 4700 ? 'seal' : x < 5030 ? 'cliffs' : x < 5470 ? 'cave' : x < 5900 ? 'cove' : 'forest');
  for (let x = EAST_X0 - 20; x < ISL.W + 140; x += rng.range(55, 120)) {
    const z = zone(x);
    if (z === 'cave') continue;
    const k = rng.next(), v = rng.int(0, 2);
    const X = x * pf;
    let f: Frame, dy = 0, sway = 0.8, tint = shore;
    if (z === 'forest') {
      const kind = (['fronds', 'leaves', 'fronds', 'flax', 'grass'] as const)[rng.int(0, 4)];
      f = sprite(`fg2:${kind}:${v}`, () => foreground(kind, 900 + v * 11, kind === 'fronds' || kind === 'leaves' ? 170 : 150))!.f;
      dy = 24 + rng.range(-8, 12);
      tint = bushT;
    } else if (z === 'stream' && x > 3640 && x < 3880) {
      // leave the stream's lower reach open to view; tall raupō frames it from the corners
      if (x < 3700 || x > 3830) { f = sp('fgreed' + v, () => EA.paintReeds(700 + v, 110 + v * 20)); dy = 26; sway = 0.7; }
      else continue;
    } else if (k < 0.34) {
      f = sprite(`dune:${v}`, () => paintDuneGrass(700 + v, 70, 56))!.f;
      dy = rng.range(-6, 10);
    } else if (k < 0.58) {
      f = sprite(`fflax:${v}`, () => foreground('flax', 710 + v, 150))!.f;
      dy = 10 + rng.range(-4, 10);
    } else if (k < 0.72 && (z === 'seal' || z === 'cliffs')) {
      f = sp('fgrock' + v, () => EA.paintBarnacleRock(720 + v, 110 + v * 30, 50 + v * 12));
      dy = 30 + rng.range(0, 14); sway = 0; tint = dark;
    } else if (k < 0.84) {
      f = sprite(`fgrass:${v}`, () => foreground('grass', 730 + v, 140))!.f;
      dy = 12 + rng.range(-6, 10);
    } else {
      f = sp('fgtoetoe' + v, () => EA.paintToetoe(740 + v, 90 + v * 14));
      dy = 20;
    }
    // the bottom of the frame at zoom 1.0 is ~40 px below the rest row: every sprite's foot goes under it
    F.add(new Prop(f, X, fyAt(x) + Math.max(dy, 0) + 46, rng.next(), { sway, flip: rng.chance(0.5), tint }));
  }
  // overhead: pōhutukawa limbs hanging in from above the frame over the stream and the cove
  const pohu = [0, 1].map(i => sprite(`v9e:pohu${i}`, () => EA.paintLimb(950 + i, 300, 150))!.f);
  for (const [x, flip] of [[3560, false], [4010, true], [5560, false], [5890, true]] as const) {
    F.add(new Prop(pohu[x % 2], x * pf + (flip ? 300 : 0), fyAt(x, -90), 2, { sway: 0.25, flip, tint: packColor(0.5, 0.52, 0.5, 1) }));
  }
  for (let x = 5960; x < ISL.W + 200; x += rng.range(130, 230)) {
    const f = sprite(`fcan:${x % 3}`, () => canopyClump(770 + (x % 3), 300, 140))!.f;
    F.add(new Prop(f, x * pf, fyAt(x, -30) + rng.range(-10, 20), 3, { sway: 0.2, tint: packColor(0.42, 0.5, 0.46, 1) }));
  }
  // big dark trunks right in front of the camera in the forest: the strongest depth cue up there
  for (const x of [6080, 6420, 6840]) {
    const f = sprite(`v9e:fgtrunk${x % 3}`, () => tree('broadleaf', 780 + (x % 3), 420))!.f;
    F.add(new Prop(f, x * pf, fyAt(x) + 40, 4, { tint: packColor(0.2, 0.24, 0.24, 1), flip: x % 2 === 0 }));
  }
}

export function dressEast(s: IslandScene4, L: IsleLayers) {
  clearEast(L);
  const c: Ctx = { s, L, rng: new Rng(901) };
  s.main.add(new IsleWater(s));
  streamMouth(c);
  creek(c);
  wreckage(c);
  sealRocks(c);
  cliffs(c);
  seaCave(c);
  cove(c);
  bush(c);
  frontFraming(c);
}

// V9 dressing for the east half of the island (x >= EAST_X0: the stream mouth, the seal rocks, under
// the cliffs, the sea cave, the hidden cove, the bush track and the forest plateau). The shared scatter
// loops in v4/isleprops.ts run along the whole shore (so their random sequence, and the west half's
// layout, never shift); dressEast() drops what they put out here and lays down the hand-placed east:
// running water and wading physics, banks of reeds and flax, tide pools, fallen boulders, the cave,
// the cove cliffs and the forest in depth, with the environmental particles of each place.

import type { Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import { local } from '../assets';
import type { Layer } from '../../world/stage';
import { Prop } from '../../world/props';
import { sprite } from '../sites2/common';
import { plant } from '../../art/jungle-plants';
import { foreground } from '../../art/jungle-fg';
import { tree, canopyClump } from '../../art/jungle-trees';
import { paintDuneGrass } from '../../art/island4/scenery';
import { ISL, groundY } from '../../art/island4/layout';
import { layerY } from '../v4/island';
import type { Sprite } from '../../art/jungle-core';
import { Rng } from '../../core/math';
import { EAST_X0 } from '../../art/v9/eastground';
import { MOUTH, CREEK, baseTop, persp, rowOf, mouthAt, creekAt } from '../../art/v9/eastgeo';
import * as EA from '../../art/v9/eastart';
import { ChannelFx, DeltaFx, CascadeFx, PoolRings, MOUTH_CH, CREEK_CH } from './streamfx';
import { IsleWater } from './water';
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

let uid = 0;
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
  void local; void uid; void packColor; void foreground;
}

// ------------------------------------------------------------------ the creek on the plateau

function creek(c: Ctx) {
  const { s, L, rng } = c;
  const main = L.main;
  const stones = [0, 1, 2].map(i => sp('cstone' + i, () => EA.paintStone(140 + i, 14 + i * 5, 8 + i * 2, { moss: true })));
  main.add(new ChannelFx(CREEK_CH, s.clock, 37, stones));
  // the ledge behind the walk line and the fall over its notch
  const ledge = sp('ledge', () => EA.paintLedge(150, 86, CREEK.fall + 4, CREEK.fallW + 1));
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
    const x = cx + side * (hw + rng.range(0, 5) * P);
    onGround(main, rng.chance(0.65) ? fern[rng.int(0, 2)] : mound[rng.int(0, 1)], x, dd, { sway: 0.6, flip: side < 0 });
  }
  void rowOf;
}

// ------------------------------------------------------------------ in front of the camera (p 1.25)

/**
 * The foreground framing along the east: shore plants and rocks rising into the bottom of the frame,
 * forest fronds and trunks on the plateau, canopy hanging into the top. Rows follow the walk line up
 * the bush track so the frame stays filled while the camera climbs with the player.
 */
function frontFraming(c: Ctx) {
  const { L, rng } = c;
  const F = L.front, pf = F.p;
  const fyAt = (x: number, sy = 372) => layerY(pf, sy) + (groundY(x) - ISL.GY) * pf;
  const shore = packColor(0.6, 0.64, 0.58, 1), bush = packColor(0.44, 0.5, 0.46, 1), dark = packColor(0.3, 0.34, 0.33, 1);
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
      tint = bush;
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
    F.add(new Prop(f, X, fyAt(x) + dy, rng.next(), { sway, flip: rng.chance(0.5), tint }));
  }
  // overhead: pōhutukawa and palm fronds over the stream and the cove, the canopy over the forest
  for (let x = 3340; x < 5900; x += rng.range(240, 420)) {
    if (x > 4650 && x < 5500) continue;
    const f = sprite(`fpalm:${x % 2}`, () => foreground('palm', 930 + (x % 2), 220))!.f;
    F.add(new Prop(f, x * pf, fyAt(x, -40) + rng.range(-10, 10), 2, { sway: 0.5, flip: rng.chance(0.5), tint: packColor(0.4, 0.46, 0.42, 1) }));
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
  frontFraming(c);
  void game;
}

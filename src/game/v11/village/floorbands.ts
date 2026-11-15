// V12 Te Kāinga's ground in depth (the painter: src/art/v11/village/floor.ts). Three bands from the walk
// line to the camera, each on its own parallax layer, so the near ground slides by faster than the walk
// line and swells when the photo camera zooms in:
//   the walk plane (p 1)      the paths, the gardens, the marae, the lane: where everyone walks
//   the near ground (p 1.1)   a step nearer: the same ground bigger, tufts and crumbs along its edge
//   the foreground (p 1.22)   right under the camera: big pebbles, tufts, puddles, footprints
// (the plants of the 'front' layer, p 1.35, stay in front of all of it). Each band is painted in 1000 px
// chunks, the base and its water (the river, puddles in the ruts) drawn as reflective water.

import type { FieldScene } from '../../scenes/field';
import { Custom } from '../../../world/props';
import { bigFrame } from '../../../gfx/atlas';
import { game } from '../../game';
import { fbm1 } from '../../../core/math';
import { paintVillageBand } from '../../../art/v11/village/floor';
import type { VFloor, VZone, FloorBand } from '../../../art/v11/village/floor';
import { W, RIVER, X } from './layout';

const SPANS: [number, number, VZone][] = [
  [-1e9, RIVER - 6, 'river'], [RIVER - 6, RIVER + 30, 'mud'], [RIVER + 30, 300, 'path'], [300, 380, 'grass'], [380, 420, 'path'],
  [X.garden[0], X.garden[1], 'tilled'], [X.garden[1], X.pen[0], 'path'], [X.pen[0], X.pen[1], 'straw'], [X.pen[1], 860, 'path'],
  [860, X.wharenui - 100, 'grass'], [X.wharenui - 100, X.marae[1] + 30, 'marae'], [X.marae[1] + 30, 1460, 'path'],
  [1460, 1610, 'chips'], [1610, 2160, 'path'], [2160, X.lane[0], 'straw'], [X.lane[0], X.palisade[0] - 6, 'lane'], [X.palisade[0] - 6, 1e9, 'gravel'],
];

/** the ground's kind at a walk-plane x: the spans, with patches of grass breaking up the paths */
export function villageZone(x: number): VZone {
  let z: VZone = 'grass';
  for (const [a, b, k] of SPANS) if (x >= a && x < b) { z = k; break; }
  if (z === 'path' && fbm1(x * 0.012, 2, 91) > 0.62) z = 'grass';
  return z;
}

const BANDS: (FloorBand & { name: string | null })[] = [
  { name: null, p: 1, dd0: -6, dd1: 30, edge: false },
  { name: 'floor1', p: 1.1, dd0: 18, dd1: 56, edge: true },
  { name: 'floor2', p: 1.22, dd0: 46, dd1: 118, edge: true },
];

/** lay the ground: call straight after the main layer is made (the near bands go in front of it) */
export function villageFloor(f: FieldScene, ground: (x: number) => number) {
  const F: VFloor = { W, ground, zoneAt: villageZone, flags: [[X.wharenui - 22, X.wharenui + 22]], seed: 7301 };
  const t0 = performance.now();
  for (const B of BANDS) {
    const layer = B.name ? f.st.addLayer(B.name, B.p, 0, 1, 0) : f.main;
    // a near band must reach as far as the camera can scroll it: the scene's width at its parallax
    const span = Math.ceil(W * B.p + game.r.VW);
    const CH = 1000;
    for (let x0 = 0; x0 < span; x0 += CH) {
      const w = Math.min(CH, span - x0);
      const ch = paintVillageBand(F, B, x0, w);
      const base = bigFrame(game.r, ch.base), wat = bigFrame(game.r, ch.water);
      layer.add(new Custom(B.name ? -20 : -10, rr => {
        if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return;
        rr.draw(base, x0, ch.y0);
        rr.water(0.5, 0.9);
        rr.draw(wat, x0, ch.y0);
        rr.water(0);
      }));
    }
  }
  if (location.search.includes('floorms')) console.log('[village floor] painted in', Math.round(performance.now() - t0), 'ms');
}

// V11 Te Wao Nui, the dressing: the layers of the forest from the misty backdrop to the blurred leaves
// right in front of the camera, back to front:
//   the luminous backdrop · five ranks of far giants fading into the mist (with mist banks pooled
//   between them) and the canopy overhead · the near-back hedge of ferns, nīkau and giants behind the
//   walk line · the gameplay plane: the forest floor, the giants whose trunks go up out of the frame,
//   tree ferns, the fallen kauri, the stream and the creek, ground cover that sways as you push
//   through it, props in front · the out-of-focus foreground framing the view top and bottom.
// Plus the terrain (the walk line, the log's top, the root-plate climb), POIs for the wildlife and
// the light, air and water effects (fx.ts).

import { packColor } from '../../../gfx/renderer';
import type { Frame } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { game } from '../../game';
import { local } from '../../assets';
import type { Layer } from '../../../world/stage';
import { Prop, Custom } from '../../../world/props';
import { layerSpan } from '../../../world/scenery';
import { PixelBuffer } from '../../../art/pixel';
import { hex, mix } from '../../../art/color';
import type { C } from '../../../art/color';
import type { Sprite } from '../../../art/jungle-core';
import { sprite } from '../../sites2/common';
import { tree, canopyClump } from '../../../art/jungle-trees';
import { canopyCeiling } from '../../../art/jungle-bg';
import { A } from '../../assets';
import { plant, fungus, deadwood } from '../../../art/jungle-plants';
import type { PlantKind } from '../../../art/jungle-plants';
import { paintStone, paintLedge, paintMossMound } from '../../../art/v9/eastart';
import { Rng, clamp } from '../../../core/math';
import type { Interactable } from '../../../world/npc';
import { layerY } from '../../v4/island';
import { FP } from '../../../art/v11/forest/kit';
import { paintColonnade, paintBackdrop } from '../../../art/v11/forest/far';
import { paintForestGround } from '../../../art/v11/forest/ground';
import { paintGiant } from '../../../art/v11/forest/trees';
import type { GiantKind } from '../../../art/v11/forest/trees';
import { paintFallenLog, paintSpringStones } from '../../../art/v11/forest/props';
import { fgPlant, fgFernSpray, fgTrunk, fgVines, soften } from '../../../art/v11/forest/fg';
import {
  FOREST, FORD, GULLY, LOG, MUD, FSPOT, fgroundY, baseY, logTop, farGroundScreenY, fordAt, creekAt, persp, fzoneAt,
} from './layout';
import { ForestRays, ForestMist, ForestAir, ForestShade, GroundCover, ForestWater, MudBubbles } from './fx';
import type { Mover } from './fx';
import type { ForestScene } from './scene';

const FOG = hex('#86ad9f');

/** authored y of a far layer's ground line */
const farY = (p: number) => layerY(p, farGroundScreenY(p));

/** add a wide buffer to a layer as ≤ 2048 px wide props (top-left at x, y) */
function addWide(layer: Layer, buf: PixelBuffer, x: number, y: number, z = 0, tint?: number) {
  const CH = 2048;
  for (let cx = 0; cx < buf.w; cx += CH) {
    const w = Math.min(CH, buf.w - cx);
    let sub = buf;
    if (buf.w > CH) {
      sub = new PixelBuffer(w, buf.h);
      for (let yy = 0; yy < buf.h; yy++) sub.data.set(buf.data.subarray(yy * buf.w + cx, yy * buf.w + cx + w), yy * w);
    }
    layer.add(new Prop({ ...bigFrame(game.r, sub), ax: 0, ay: 0 }, x + cx, y, z, { tint }));
  }
}

/** a sprite into the scene atlas (or its own texture when big) */
function frameOf(key: string, gen: () => Sprite): Frame & { sprite: Sprite } {
  const c = sprite('v11f:' + key, gen)!;
  return Object.assign(c.f, { sprite: c.s });
}

export function buildForest(f: ForestScene) {
  const st = f.st, clock = f.clock;
  const T0 = performance.now();
  const tick = (what: string) => { if ((window as unknown as { __ftime?: boolean }).__ftime) console.log(`[T] forest ${what} ${Math.round(performance.now() - T0)} ms`); };
  st.minX = 0; st.maxX = FOREST.W; st.minY = FOREST.minY; st.maxY = FOREST.maxY;
  st.waterY = null;
  const rng = new Rng(1111);

  // ---------------------------------------------------------------- the backdrop: luminous mist
  {
    const p = 0.05, lay = st.addLayer('fbg', p, 0.35, 0, 0, p);
    const span = layerSpan(st, p, 80);
    const y0 = -260, gy = farY(p);
    const H = Math.round(gy + 140 - y0);
    const buf = paintBackdrop(1024, H, Math.round(gy - y0 - 40), 5, { top: hex('#244a42'), mid: hex('#a8c8b4'), low: hex('#5f8a76'), ghost: hex('#7aa08e') });
    const fr = bigFrame(game.r, buf);
    for (let x = span.x0; x < span.x0 + span.w; x += 1024) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, x, y0));
  }

  tick('backdrop');
  // ---------------------------------------------------------------- the far giants, rank after rank
  const far = (name: string, p: number, fog: number, k: number, seed: number, haze: number, tile: number | null, mist: number, ceiling?: { p: number; seed: number; y: number }) => {
    const lay = st.addLayer(name, p, fog, 0.15 + k * 0.25, 0, p);
    const span = layerSpan(st, p, 60);
    const gy = farY(p);
    const yTop = Math.round(-40 - 120 * p);
    const gl = Math.round(gy - yTop), H = gl + Math.round(46 + 50 * p);
    const W = tile ?? span.w;
    const buf = paintColonnade({ W, H, gl, seed, k, fog: FOG, haze });
    if (tile) { const fr = bigFrame(game.r, buf); for (let x = span.x0; x < span.x0 + span.w; x += W) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, x, yTop)); }
    else addWide(lay, buf, span.x0, yTop);
    // low mist pooled along this rank's floor
    if (mist > 0) lay.add(new ForestMist(10, gy - 46 - k * 20, 2 + k * 3, clock, mist, seed + 3, 640, 70 + Math.round(k * 30)));
    if (ceiling) canopy(ceiling.p, ceiling.seed, ceiling.y);
    return lay;
  };
  /** the canopy overhead (the jungle kit's tileable ceiling, carried on up so looking up never ends) */
  const canopy = (p: number, seed: number, y: number) => {
    const lay = st.addLayer('ceil' + seed, p, 0.03 + (1 - p) * 0.25, 0.25, 0, p);
    const span = layerSpan(st, p, 60);
    const buf = canopyCeiling(seed, 1024, 200, 300);
    const fr = bigFrame(game.r, buf);
    for (let x = span.x0; x < span.x0 + span.w; x += buf.w) lay.add(new Prop({ ...fr, ax: 0, ay: 0 }, x, y - (buf.h - 200), 0, { tint: packColor(0.78 + p * 0.2, 0.84 + p * 0.14, 0.82 + p * 0.16, 1) }));
  };
  far('far0', 0.13, 0.5, 0, 21, 0.5, 1180, 0.5);
  far('far1', 0.24, 0.4, 0.22, 22, 0.4, 1560, 0.45, { p: 0.3, seed: 31, y: -26 });
  far('far2', 0.38, 0.3, 0.45, 23, 0.28, null, 0.4);
  far('far3', 0.54, 0.2, 0.7, 24, 0.17, null, 0.32);
  far('far4', 0.72, 0.1, 0.95, 25, 0.08, null, 0.25, { p: 0.78, seed: 32, y: -60 });

  tick('far');
  // ---------------------------------------------------------------- the near-back: the hedge behind the walk line
  const pb = 0.88;
  const back = st.addLayer('back', pb, 0.04, 0.6, 0, pb);
  {
    const gy = farY(pb);
    const span = layerSpan(st, pb, 60);
    // giants and tree ferns standing just behind the hedge
    const bx = (x: number) => x * pb;
    for (let x = 60; x < FOREST.W + 300; x += rng.range(230, 420)) {
      const kind = (['kauri', 'rimu', 'kahikatea', 'rata'] as GiantKind[])[rng.int(0, 3)];
      const w = rng.range(44, 82);
      const H = Math.round(gy + 170);
      const fr = frameOf(`bg:${kind}:${Math.round(w / 6)}:${rng.int(0, 2)}`, () => paintGiant(kind, 300 + Math.round(w), w, H, { epiphytes: 0.8, fadeTop: 90 }));
      back.add(new Prop(fr, bx(x), gy + 3, -2 + rng.next(), { flip: rng.chance(0.5), tint: packColor(0.84, 0.9, 0.88, 1) }));
    }
    for (let x = 20; x < FOREST.W + 200; x += rng.range(60, 140)) {
      const k = rng.next();
      const kind = k < 0.62 ? 'treefern' : k < 0.82 ? 'nikau' : 'broadleaf';
      const h = kind === 'treefern' ? rng.range(110, 190) : kind === 'nikau' ? rng.range(150, 230) : rng.range(200, 300);
      const v = rng.int(0, 3);
      const fr = frameOf(`bt:${kind}:${v}:${Math.round(h / 20)}`, () => tree(kind as 'treefern', 700 + v * 17 + Math.round(h), h));
      back.add(new Prop(fr, bx(x), gy + 2, 0 + rng.next(), { sway: kind === 'broadleaf' ? 0.15 : 0.6, flip: rng.chance(0.5), tint: packColor(0.8, 0.88, 0.86, 1) }));
    }
    // the hedge itself: a dense band of ferns and shrubs, solid below
    const yTop = Math.round(gy - 120);
    const hb = paintColonnade({ W: span.w, H: 200, gl: 120, seed: 41, k: 1.15, fog: FOG, haze: 0.03, parts: { trunks: false, ferns: false, canopy: false, mist: false }, under: 1.5 });
    addWide(back, hb, span.x0, yTop, 5);
  }

  tick('back');
  // ---------------------------------------------------------------- the gameplay plane
  const main = st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  // the forest floor, with its water and mud drawn again as reflective material
  const CH = 1000;
  for (let x0 = 0; x0 < FOREST.W; x0 += CH) {
    const w = Math.min(CH, FOREST.W - x0);
    const ch = paintForestGround(x0, w);
    const base = bigFrame(game.r, ch.base), wat = bigFrame(game.r, ch.water), mud = bigFrame(game.r, ch.mud);
    const hasMud = x0 + w > MUD.x0 && x0 < MUD.x1;
    main.add(new Custom(-10, rr => {
      if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return;
      rr.draw(base, x0, ch.y0);
      rr.water(0.42, 0.8);
      rr.draw(wat, x0, ch.y0);
      if (hasMud) { rr.water(0.16, 0.25); rr.draw(mud, x0, ch.y0); }
      rr.water(0);
    }));
  }
  tick('ground');
  // the giants on the walk line, their trunks going on up out of the frame
  const giants: [number, GiantKind, number][] = [
    [300, 'kauri', 118], [1060, 'rimu', 96], [1360, 'kauri', 150], [2160, 'kahikatea', 104], [2990, 'kauri', 132],
    [3860, 'rata', 112], [4240, 'kauri', 170], [4700, 'rimu', 104], [5110, 'kahikatea', 120], [5560, 'kauri', 140], [5930, 'rata', 100],
  ];
  for (const [x, kind, w] of giants) {
    const gy = fgroundY(x);
    const H = Math.round(gy - FOREST.minY + 60);
    const fr = frameOf(`giant:${x}`, () => paintGiant(kind, x, w, H, { epiphytes: 1.2, vines: 1.2 }));
    main.add(new Prop(fr, x, gy + 4, -6.5));
    f.pois.push({ kind: 'trunk', x, y: gy, y1: gy - 220 }, { kind: 'branch', x: x + w * 0.4, y: gy - rng.range(90, 160) }, { kind: 'perch', x: x - w * 0.3, y: gy - rng.range(120, 200) });
  }
  // tree ferns, nīkau and shrubs behind the walk line, crowding between the giants
  const busy = (x: number, r: number) => giants.some(([gx, , w]) => Math.abs(gx - x) < w * 0.7 + r) || Math.abs(x - FSPOT.joshu) < 60 || (x > LOG.x0 - 20 && x < LOG.x1 + 10) || Math.abs(x - FSPOT.lookout) < 30;
  for (let x = 120; x < FOREST.W - 40; x += rng.range(70, 150)) {
    if (busy(x, 30)) continue;
    const k = rng.next(), zone = fzoneAt(x);
    const kind = k < (zone === 'rata' ? 0.45 : 0.68) ? 'treefern' : k < 0.86 ? 'nikau' : 'broadleaf';
    const h = kind === 'treefern' ? rng.range(120, 210) : kind === 'nikau' ? rng.range(170, 250) : rng.range(240, 330);
    const v = rng.int(0, 3);
    const fr = frameOf(`mt:${kind}:${v}:${Math.round(h / 20)}`, () => tree(kind as 'treefern', 800 + v * 13 + Math.round(h), h));
    main.add(new Prop(fr, x, fgroundY(x) + 2, -5.6 + rng.next() * 0.3, { sway: kind === 'broadleaf' ? 0.15 : 0.7, flip: rng.chance(0.5) }));
  }
  // the fallen kauri behind the walk line: walk along its top, climb up its root plate
  const log = paintFallenLog(51, LOG.x1 - LOG.x0 - 40, LOG.h);
  const logF = local.add('v11f:log', log.buf, log.ax, log.ay);
  const lx = LOG.x0 - 6, lg = baseY(LOG.x0 + 30) - 3;
  main.add(new Prop(logF, lx, lg, -5.2));
  // (the platform follows the painted top of the log)
  const plat: [number, number][] = [];
  for (let x = LOG.x0 + log.plateW - 2; x <= LOG.x1 - 22; x += 8) plat.push([x, lg - log.ay + log.top(x - lx + log.ax) + 1]);
  st.terrain.addPlatform(plat, 'branch');
  const plateTop = lg - log.buf.h + 30;
  const climbX = LOG.roots;
  st.terrain.addClimb(climbX, plat[0][1], lg, 'vine');
  const ld = { x: climbX, y0: plat[0][1], y1: lg };
  f.interact.push({ x: climbX, y: lg, w: 14, h: 18, label: 'Climb up the roots onto the fallen kauri', standX: climbX, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - fgroundY(f.player.x)) < 10, action: () => f.climbLadder(ld, -1) } as Interactable);
  f.interact.push({ x: climbX, y: plat[0][1], w: 14, h: 18, label: 'Climb back down the roots', standX: climbX, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - plat[0][1]) < 10, action: () => f.climbLadder(ld, 1) } as Interactable);
  void plateTop;
  // where the stream comes out from under the ferns, and the creek's mossy step
  const spring = frameOf('spring', () => paintSpringStones(61));
  main.add(new Prop(spring, FORD.x + 4, baseY(FORD.x) - 1, -4.6));
  const ledge = frameOf('ledge', () => paintLedge(62, 110, 26, GULLY.w + 1));
  main.add(new Prop(ledge, GULLY.x, baseY(GULLY.x) - 1, -4.6));
  main.add(new Cascade(GULLY.x, baseY(GULLY.x) - 26, baseY(GULLY.x), GULLY.w));
  // stepping stones across the ford and the creek
  for (const [cx0, at, n] of [[FORD.x, fordAt, 4], [GULLY.x, creekAt, 3]] as const) {
    for (let i = 0; i < n; i++) {
      const dd = 4 + i * 9 + rng.range(-2, 2);
      const [cx, hw] = at(dd);
      const P = persp(dd);
      const s = frameOf(`step${i % 3}`, () => paintStone(70 + i, 16, 8, { moss: i % 2 === 0, wetLine: 0.35 }));
      main.add(new Prop(s, cx + (i % 2 ? 0.45 : -0.4) * hw, baseY(cx0) + dd + 2, 59 + dd * 0.02, { sx: P, sy: P }));
    }
  }

  tick('main trees');
  // ---- the ground cover: behind the walk line, and in front of it (over the feet)
  const movers = (): Mover[] => {
    const out: Mover[] = [{ x: f.player.x, y: f.player.y, vx: f.player.vx }];
    for (const a of f.actors.values()) if (a.visible) out.push({ x: a.x, y: a.y, vx: a.walking ? (a.facing * 40) : 0 });
    for (const an of f.animals) if (!an.dead && !an.gone && an.medium === 'ground') out.push({ x: an.x, y: an.y, vx: an.vx });
    return out;
  };
  const backCover = new GroundCover(-2.4, movers, () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx }));
  const frontCover = new GroundCover(58, movers, () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx }));
  f.covers.push(backCover, frontCover);
  main.add(backCover);
  main.add(frontCover);
  const tuft = (kinds: PlantKind[], sizes: [number, number]) => {
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const v = rng.int(0, 3);
    const s = Math.round(rng.range(sizes[0], sizes[1]) / 4) * 4;
    return frameOf(`tuft:${kind}:${v}:${s}`, () => plant(kind, 1200 + v * 7 + s, s));
  };
  const water = (x: number) => Math.abs(x - FORD.x) < FORD.w + 6 || Math.abs(x - GULLY.x) < GULLY.w + 6;
  const tall: PlantKind[] = ['fern', 'crownfern', 'kiokio', 'umbrellafern', 'kiokio', 'fern', 'astelia'];
  const low: PlantKind[] = ['kidneyfern', 'moss', 'seedling', 'fiddlehead', 'sedge', 'fern', 'crownfern'];
  for (let x = 30; x < FOREST.W - 10; x += rng.range(9, 20)) {
    if (water(x)) continue;
    const z = fzoneAt(x);
    const dense = z === 'gully' || z === 'rata' ? 1.25 : z === 'wallows' ? 0.5 : z === 'edge' ? 0.8 : 1;
    if (rng.next() > dense * 0.85) continue;
    const fr = tuft(z === 'wallows' ? ['sedge', 'grass', 'kidneyfern'] : tall, z === 'giants' ? [26, 46] : [22, 42]);
    backCover.add(fr, x, fgroundY(x) + 1, rng.chance(0.5));
  }
  for (let x = 20; x < FOREST.W - 10; x += rng.range(18, 40)) {
    if (water(x)) continue;
    const z = fzoneAt(x);
    if (z === 'wallows' && rng.chance(0.7)) continue;
    const fr = tuft(low, [12, 24]);
    frontCover.add(fr, x + rng.range(-4, 4), fgroundY(x) + rng.range(4, 9), rng.chance(0.5));
  }
  // hide spots in the thickest crown ferns
  for (const x of [640, 1290, 2240, 3010, 4060, 4920, 5400]) {
    const s = sprite(`v11f:hide:${x % 3}`, () => plant('crownfern', 1300 + (x % 3), 44));
    const y = fgroundY(x) + 3;
    if (s) {
      main.add(new Prop(s.f, x, y, 66, { sway: 0.6 }));
      f.occluders.push({ mask: s.s.buf, x, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x, y, w: 18 });
    f.hidesPending.push({ x, w: 30, y, cover: 0.8 });
  }
  // the floor in front of the walk line: moss mounds, logs, stumps, ferns and fungi, in depth
  const mounds = [0, 1, 2].map(i => frameOf(`mound${i}`, () => paintMossMound(1400 + i, 22 + i * 14)));
  const logs = [0, 1].map(i => frameOf(`flog${i}`, () => deadwood(i ? 'log' : 'rottenlog', 1410 + i, 50 + i * 16)));
  const stump = frameOf('stump', () => deadwood('stump', 1420, 34));
  const roots = frameOf('roots', () => deadwood('roots', 1421, 30));
  const fungi = [0, 1, 2].map(i => frameOf(`fun${i}`, () => fungus((['bracket', 'inkcap', 'veil'] as const)[i], 1430 + i, 16)));
  for (let x = 40; x < FOREST.W; x += rng.range(24, 50)) {
    const dd = rng.range(16, 160);
    const P = persp(dd);
    const [fx0, fhw] = fordAt(dd), [cx0, chw] = creekAt(dd);
    if (Math.abs(x - fx0) < fhw + 26 * P || Math.abs(x - cx0) < chw + 30 * P) continue;
    if (x > MUD.x0 - 20 && x < MUD.x1 + 20 && dd < 110) continue;
    const k = rng.next();
    const fr = k < 0.32 ? tuft(tall, [26, 44]) : k < 0.55 ? mounds[rng.int(0, 2)] : k < 0.66 ? logs[rng.int(0, 1)] : k < 0.72 ? stump : k < 0.8 ? roots : k < 0.88 ? fungi[rng.int(0, 2)] : tuft(low, [14, 22]);
    main.add(new Prop(fr, x, baseY(x) + dd, 60 + dd * 0.02, { sway: k < 0.32 || k > 0.88 ? 0.5 : 0, flip: rng.chance(0.5), sx: rng.chance(0.5) ? -1 : 1 }));
  }
  // POIs the wildlife uses
  for (const x of [990, 1030, 1075, 1110]) f.pois.push({ kind: 'burrow', x, y: fgroundY(x) });
  for (const x of [700, 1500, 2600, 3300, 4400, 5200]) f.pois.push({ kind: 'soft', x, y: fgroundY(x) });
  for (const x of [880, 1700, 3600, 4300, 5000]) f.pois.push({ kind: 'leaves', x, y: fgroundY(x), amount: 30 });
  for (const x of [4100, 4520, 4880]) f.pois.push({ kind: 'flower', x, y: fgroundY(x) - 60 });
  for (const x of [1820, 4380, 5300]) f.pois.push({ kind: 'fruit', x, y: fgroundY(x), amount: 20 });
  f.pois.push({ kind: 'water', x: FORD.x, y: baseY(FORD.x), y1: baseY(FORD.x) + 12, w: FORD.w }, { kind: 'water', x: GULLY.x, y: baseY(GULLY.x), y1: baseY(GULLY.x) + 10, w: GULLY.w });
  f.pois.push({ kind: 'mud', x: 2400, y: fgroundY(2400) }, { kind: 'mud', x: 2650, y: fgroundY(2650) }, { kind: 'bank', x: FORD.x + 60, y: fgroundY(FORD.x + 60) });

  tick('cover');
  // ---- light, air and water
  f.shade = new ForestShade(clock);
  main.add(f.shade);
  main.add(new ForestWater());
  main.add(new MudBubbles());
  main.add(new ForestRays(clock, main, [[160, 160, 1.2], [770, 120, 1], [1250, 60, 0.7], [1700, 90, 0.9], [2520, 120, 0.85], [3470, 140, 1], [4380, 70, 0.6], [5000, 90, 0.7], [5760, 110, 0.8]]));
  main.add(new ForestAir(main, clock));
  // a sunlit haze over the forest edge (the beach light behind)
  main.add(new Custom(186, rr => {
    const k = (1 - clock.night) * 0.9;
    if (k < 0.05 || rr.visibleX0(0) > 600) return;
    rr.light(-60, fgroundY(0) - 70, 260, 1, 0.95, 0.82, 0.45 * k, 0.02);
    rr.fxDraw(A.glow, -40, fgroundY(0) - 80, 6, 4, 0, packColor(1, 0.96, 0.85, 1), 0.14 * k);
  }));
  for (const sp of [[160, 150], [770, 120], [1700, 90], [2520, 110], [3470, 130], [5760, 100]] as const) f.sunspots.push({ x: sp[0] - 40, w: sp[1] });

  // ---------------------------------------------------------------- in front of the camera
  const pf = 1.32;
  const front = st.addLayer('front', pf, 0, 0.45, 0, pf);
  const dark = FP.canopy[0];
  const fyB = layerY(pf, 372) + 6, fyT = layerY(pf, -6);
  const occ = (s: Sprite, x: number, y: number, flip: boolean, p: number) => f.occluders.push({ mask: s.buf, x, y, ax: s.ax, ay: s.ay, sx: flip ? -1 : 1, sy: 1, p, z: 0 });
  // rising from the bottom of the frame: tree fern sprays, big leaves, fronds
  // (never in front of the story's spots: the prints, the scrap, the boot, Joshu, the fords)
  const keep = [FSPOT.prints, FSPOT.scrap, FSPOT.boot, FSPOT.joshu, FORD.x, GULLY.x, FSPOT.exit + 60];
  for (let x = 120; x < FOREST.W + 300; x += rng.range(160, 300)) {
    const k = rng.next(), v = rng.int(0, 2);
    if (keep.some(q => Math.abs(q - x) < 150)) continue;
    const fr = k < 0.45 ? frameOf(`fs:${v}`, () => fgFernSpray(1500 + v, 76 + v * 14, false, 1, dark, 0.62))
      : k < 0.7 ? frameOf(`fl:${v}`, () => fgPlant('leaves', 1510 + v, 92 + v * 12, 1, dark, 0.66))
        : k < 0.88 ? frameOf(`ff:${v}`, () => fgPlant('fronds', 1520 + v, 100, 1, dark, 0.64))
          : frameOf(`fm:${v}`, () => fgPlant('monstera', 1530 + v, 90, 1, dark, 0.66));
    const X = x * pf, flip = rng.chance(0.5), y = fyB + rng.range(4, 22);
    front.add(new Prop(fr, X, y, rng.next(), { sway: 0.45, flip }));
    occ(fr.sprite, X, y, flip, pf);
  }
  // hanging into the top of the frame: fronds, vines, canopy clumps carried on up
  for (let x = 60; x < FOREST.W + 300; x += rng.range(140, 260)) {
    const k = rng.next(), v = rng.int(0, 2);
    const fr = k < 0.4 ? frameOf(`fh:${v}`, () => fgFernSpray(1540 + v, 66 + v * 10, true, 1, dark, 0.6))
      : k < 0.7 ? frameOf(`fv:${v}`, () => fgVines(1550 + v, 80, 70 + v * 20, 1, dark, 0.6))
        : frameOf(`fc:${v}`, () => soften(canopyClump(1560 + v, 200, 70, { above: 260 }), 1, dark, 0.58));
    const X = x * pf, flip = rng.chance(0.5), y = k < 0.7 ? fyT - 14 + rng.range(-8, 4) : fyT + 10 + rng.range(-8, 8);
    front.add(new Prop(fr, X, y, 2 + rng.next(), { sway: 0.25, flip }));
  }
  // giant trunks passing close by
  for (const x of [470, 2930, 4120, 5250]) {
    const fr = frameOf(`ft:${x}`, () => fgTrunk(x % 2 ? 'kauri' : 'rimu', x, 96, 560, 2, dark, 0.8));
    const X = x * pf;
    front.add(new Prop(fr, X, fyB + 30, 4));
    occ(fr.sprite, X, fyB + 30, false, pf);
  }
  // even nearer: a few huge soft leaves in the corners of the frame
  const pn = 1.7;
  const near = st.addLayer('front2', pn, 0, 0.3, 0, pn);
  const nyB = layerY(pn, 380) + 10;
  for (let x = 400; x < FOREST.W + 300; x += rng.range(620, 1100)) {
    const v = rng.int(0, 1);
    if (keep.some(q => Math.abs(q - x) < 200)) continue;
    const fr = frameOf(`fn:${v}`, () => fgPlant(v ? 'fronds' : 'leaves', 1570 + v, 96, 3, dark, 0.86));
    near.add(new Prop(fr, x * pn, nyB + 24, 0, { sway: 0.3, flip: rng.chance(0.5) }));
  }

  tick('front');
  // ---------------------------------------------------------------- terrain
  const pts: [number, number][] = [];
  for (let x = 0; x <= FOREST.W; x += 6) pts.push([x, fgroundY(x)]);
  st.terrain.addGround(pts, 'ground');
  void clamp; void mix; void (0 as unknown as C);
}

/** the creek pouring over its mossy step behind the walk line into the pool */
class Cascade {
  z = -4.5;
  private t = 0;
  constructor(readonly x: number, readonly top: number, readonly bot: number, readonly hw: number) {}
  update(dt: number) { this.t += dt; }
  draw(rr: import('../../../gfx/renderer').Renderer) {
    const x0 = rr.visibleX0(40), x1 = rr.visibleX1(40);
    if (this.x < x0 || this.x > x1) return;
    const h = this.bot - this.top;
    for (let i = -this.hw * 0.6; i <= this.hw * 0.6; i += 1) {
      const ph = Math.sin(i * 1.7) * 3;
      for (let y = 0; y < h; y += 2) {
        const k = ((y + this.t * 60 + ph * 10) % 12) / 12;
        const a = 0.35 + 0.4 * (k < 0.3 ? 1 : 0);
        rr.rect(this.x + i, this.top + y, 1, 2, packColor(0.75, 0.9, 0.92, a));
      }
    }
    // foam at the foot
    for (let i = 0; i < 6; i++) rr.rect(this.x - this.hw * 0.7 + i * this.hw * 0.25, this.bot - 1 + Math.sin(this.t * 6 + i) * 0.8, 3, 1, packColor(0.92, 0.97, 0.98, 0.7));
  }
}

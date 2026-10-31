// V12 Te Repo Raupō, the raupō swamp (layout and walk line: ./layout.ts). One long site scene built on
// the woods kit's light and far forest (src/game/v11/woods/kit.ts: the misty backdrop, the ranks of
// far giants, the light under the canopy, the close low camera), with its own gameplay plane: the peat
// water floor in perspective (src/art/v12/swamp/floor.ts) with its reflections, the swamp's plants and
// props (src/art/v12/swamp/props.ts), the old boardwalks, the stepping logs and stones, the maimai on
// its poles, the fallen kahikatea over the dark pool, a swing bridge over the channel, and the whare on
// the hidden island; fog banks drifting at their own speeds, rain that comes and goes, marsh gas, the
// mosquitoes, fireflies at dusk and pale marsh lights at night. Wading: deep water slows Mori right
// down and makes him hungrier.

import type { FieldScene, SpawnV2 } from '../../scenes/field';
import type { Layer } from '../../../world/stage';
import type { Interactable } from '../../../world/npc';
import { Prop, Custom } from '../../../world/props';
import { packColor, WHITE } from '../../../gfx/renderer';
import type { Env } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { layerSpan } from '../../../world/scenery';
import { local } from '../../assets';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { Rng, clamp, damp, rand } from '../../../core/math';
import { hex } from '../../../art/color';
import type { Sprite } from '../../../art/jungle-core';
import { plant } from '../../../art/jungle-plants';
import type { PlantKind } from '../../../art/jungle-plants';
import { paintGiant } from '../../../art/v11/forest/trees';
import { soften, fgVines, fgFernSpray } from '../../../art/v11/forest/fg';
import { FP } from '../../../art/v11/forest/kit';
import { canopyClump } from '../../../art/jungle-trees';
import { paintSwingBridge } from '../../../art/v12/bridge';
import { layerY } from '../../v4/island';
import { DayClock } from '../../v4/islefx';
import { sprite } from '../../sites2/common';
import { arrive } from '../../sites2';
import { woodsFar, installWoodsEnv, addWide, clockForTod, farGroundScreenY, WOODS_ZOOM } from '../../v11/woods/kit';
import { ForestMist, GroundCover } from '../../v11/forest/fx';
import type { Mover } from '../../v11/forest/fx';
import { WoodsShade, WoodsAir } from '../../v11/woods/fx';
import { currentExpedition, expeditionHour } from '../../v10/expedition';
import { findArt } from '../../v10/finds';
import type { Site10 } from '../../sites10/kit';
import { registerPosts } from '../trails';
import type { RegionPost } from '../trails';
import { addHunger } from '../hunger';
import { floatText } from '../../../ui/v12/float';
import { SWP } from '../../../art/v12/swamp/kit';
import { paintSwampFloor, swampIsWater } from '../../../art/v12/swamp/floor';
import { wpersp } from '../../../art/v11/woods/floor';
import { paintLilyPads, paintRaupo, paintPukio, paintTiKouka, paintDrownedTree, paintStump, paintStepLog, paintStepStone, paintBoardwalk, paintMaimai, paintPeatBank, paintWhare } from '../../../art/v12/swamp/props';
import { SW, SW_SPOT, POOL, CHANNEL, WALKS, LOGS, STONES, MAIMAI, swBase, swBase0, swGround, swDepth, swWet, swCanopy, swZone, swHollow, deckY, maimaiY } from './layout';
import { Ripples, FrontWater, SwampRain, MarshBubbles, Mosquitoes, MarshLights } from './fx';
import { attachToads, installToadBody } from './toads';
import { SWAMP_POINTS } from './quests';

const todOf = (t: number) => (t < 0.35 ? 'dawn' : t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night') as 'dawn' | 'day' | 'dusk' | 'night';
const farY = (p: number) => layerY(p, farGroundScreenY(p), WOODS_ZOOM);

export interface SwampRuntime {
  clock: DayClock;
  rain: SwampRain;
  ripples: Ripples;
  main: Layer;
  hides: { x: number; w: number; y: number; cover: number }[];
  covers: GroundCover[];
  update(f: FieldScene, dt: number): void;
  enter(f: FieldScene): void;
}
let rt: SwampRuntime | null = null;
/** the swamp's runtime while it is the scene (the toads read the rain from it) */
export const swampRuntime = () => rt;

const SPAWNS: SpawnV2[] = [
  { species: 'mossfrog', n: [3, 5], x: [1200, 1500], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
  { species: 'mossfrog', n: [3, 4], x: [3480, 3700], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
  { species: 'mossfrog', n: [2, 4], x: [7660, 7840], herd: true, times: ['dusk', 'night', 'dawn'], chance: 0.9 },
  { species: 'snakestork', n: [1, 2], x: [2400, 3900], poi: 'shallows', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
  { species: 'snakestork', n: [1, 1], x: [8400, 9400], poi: 'shallows', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
  { species: 'pteramander', n: [1, 2], x: [900, 2200], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night'], chance: 0.9 },
  { species: 'hunterbat', n: [1, 2], x: [800, 7000], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.7 },
  { species: 'barkgecko', n: [2, 3], x: [800, 2250], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
  { species: 'strider', n: [1, 1], x: [5300, 6800], times: ['dawn', 'day', 'dusk'], chance: 0.6 },
  { species: 'ironjaw', n: [1, 1], x: [8700, 9300], poi: 'bank', times: ['dawn', 'day', 'dusk'], chance: 0.55 },
  // the swamp's own: the giant toad in its hollow, the poison toads on the moss hummocks
  { species: 'bellowtoad', n: [1, 1], x: [POOL.stage - 2, POOL.stage + 2], chance: 1 },
  ...SW_SPOT.embers.map(([a, b]): SpawnV2 => ({ species: 'embertoad', n: [2, 3], x: [a, b], herd: true, times: ['dawn', 'day', 'dusk', 'night'], chance: 1 })),
];

export const SWAMP: Site10 = {
  id: 'swamp', loc: 'swamp', name: 'Te Repo Raupō', width: SW.W, camY: 180, followY: true, minY: SW.minY, maxY: SW.maxY,
  spawnX: SW_SPOT.enter, exitX: SW_SPOT.exit, waterY: null, ambience: 'mangrove', music: 'explore', ground: 'leaves',
  build(f: FieldScene) { rt = buildSwamp(f); },
  onUpdate(f, dt) { rt?.update(f, dt); },
  spawns: SPAWNS,
  insects: [
    { kind: 'dragonfly', x: [700, 9600], y: [176, 212], n: 18, times: ['dawn', 'day', 'dusk'] },
    { kind: 'butterfly', x: [0, 760], y: [150, 200], n: 4, times: ['day'] },
    { kind: 'firefly', x: [0, SW.W], y: [150, 214], n: 56, times: ['dusk', 'night'] },
    { kind: 'skymoth', x: [400, 9400], y: [110, 200], n: 6, times: ['dusk', 'night'] },
    { kind: 'lanternbeetle', x: [760, 2300], y: [204, 214], n: 5, times: ['night'] },
    { kind: 'cicada', x: [0, 2300], y: [90, 160], n: 3, times: ['day'] },
  ],
  onEnter: f => {
    rt?.enter(f);
    return arrive(f, 'Te Repo Raupō', 'The raupō swamp', 'The old people took eels here, and raupō for their whare. Stay on the planks where there are planks, Doc.');
  },
  v10: { points: SWAMP_POINTS },
};

// ---------------------------------------------------------------- the crossroads' planks
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
async function climbUp(f: FieldScene, x: number, yTop: number, yBot: number) {
  const p = f.player;
  await Promise.race([p.walkTo(x, 60), sleep(4000)]);
  if (Math.abs(p.x - x) > 10 || Math.abs(p.y - yBot) > 14) return;
  await f.climbLadder({ x, y0: yTop, y1: yBot }, -1);
}
/** off the planks and down the bank into the water (past the end the planks are let go of) */
async function downInto(f: FieldScene, edge: number, to: number, say: string) {
  const p = f.player;
  await Promise.race([p.walkTo(edge - 5, 60), sleep(4000)]);
  p.dropT = 0.9;
  void floatText({ text: say, style: 'think', ms: 2000 });
  await Promise.race([p.walkTo(to, 40), sleep(9000)]);
}
const tierNote = (s: string) => `${s} <span style="opacity:.75">· the low way</span>`;
function posts(): RegionPost[] {
  return [
    { x: SW_SPOT.postBoard, arms: [
      { info: 'TE WAO NUI', go: 200, dir: 'left' },
      { tier: 'THE BLACK WATER', mark: 'down', dir: 'right', label: tierNote('Down off the bank, into the black water under the boardwalk'), go: f => downInto(f, WALKS[0][0], 980, 'Into the water. It’s... warm. Why is it warm.') },
      { info: 'NGĀ KAHIKATEA', go: 1100, dir: 'right' },
    ] },
    { x: SW_SPOT.postMaimai, arms: [
      { tier: 'THE MAIMAI', mark: 'up', dir: 'right', label: 'Climb the ladder up to the old maimai <span style="opacity:.75">· the high way</span>', go: f => climbUp(f, MAIMAI.up, maimaiY(MAIMAI.up), swGround(MAIMAI.up)) },
      { info: 'NGĀ KAHIKATEA', go: 2000, dir: 'left' },
      { info: 'TE ROTO PŌURI', go: 4120, dir: 'right' },
    ] },
    { x: SW_SPOT.postPool, arms: [
      { tier: 'THE DARK POOL', mark: 'down', dir: 'right', label: tierNote('Down the bank to the dark pool'), go: f => downInto(f, POOL.log[0], SW_SPOT.poolHide, 'Down into the hollow. Quietly. Something lives down here.') },
      { info: 'TE RAUPŌ', go: 3420, dir: 'left' },
      { info: 'NGĀ RĀKAU MATE', go: 5420, dir: 'right' },
    ] },
    { x: SW_SPOT.postChannel, arms: [
      { tier: 'THE CHANNEL', mark: 'down', dir: 'right', label: tierNote('Down the bank and wade the channel'), go: f => downInto(f, CHANNEL.x0, 7260, 'Down into the channel. Hold the camera up. Higher.') },
      { info: 'NGĀ RĀKAU MATE', go: 6200, dir: 'left' },
      { info: 'TE NGUTU AWA', go: 8420, dir: 'right' },
    ] },
  ];
}

// ---------------------------------------------------------------- building it
export function buildSwamp(f: FieldScene): SwampRuntime {
  const st = f.st, r = game.r;
  const clock = new DayClock();
  clock.set(clockForTod(f.tod, currentExpedition() ? expeditionHour() : undefined));
  // (the day loop drives a scene's `clock` from the expedition hour: src/game/v12/loop.ts)
  (f as unknown as { clock: DayClock }).clock = clock;
  installToadBody();
  st.minX = 0; st.maxX = SW.W; st.minY = SW.minY; st.maxY = SW.maxY;
  const rng = new Rng(1913);
  const frameOf = (key: string, gen: () => Sprite) => { const s = sprite('sw:' + key, gen)!; return Object.assign(s.f, { sprite: s.s }); };
  const FOG = hex('#8fa79a');

  // ---------------------------------------------------------------- the far swamp forest
  woodsFar(f, clock, { seed: 197, fog: FOG, backdrop: { top: hex('#2a4640'), mid: hex('#b2c8b8'), low: hex('#66887a'), ghost: hex('#86a494') }, open: 0.45 });
  // the mire: a sheet of still water between here and the far trees, with raupō beds and dead trees
  // standing in it, all in the haze
  {
    const p = 0.8, lay = st.addLayer('mire', p, 0.16, 0.5, 0, p);
    const span = layerSpan(st, p, 60);
    const gy = farY(p);
    lay.add(new Custom(-2, rr => {
      rr.water(0.7, 0.6, 0.5);
      rr.rect(span.x0, gy - 2, span.w, 14, packColor(0.07, 0.09, 0.075, 1));
      rr.water(0);
    }));
    const tint = packColor(0.62, 0.72, 0.7, 1), tint2 = packColor(0.52, 0.62, 0.6, 1);
    for (let x = span.x0; x < span.x0 + span.w; x += rng.range(14, 40)) {
      const k = rng.next();
      const v = rng.int(0, 3);
      if (k < 0.62) lay.add(new Prop(frameOf(`mr:${v}`, () => paintRaupo(300 + v, 34 + v * 6, { heads: 2 })), x, gy + 1, rng.next(), { sway: 0.5, tint: tint2 }));
      else if (k < 0.74) lay.add(new Prop(frameOf(`md:${v}`, () => paintDrownedTree(310 + v, 70 + v * 18)), x, gy + 2, -1, { tint }));
      else if (k < 0.86) lay.add(new Prop(frameOf(`mt:${v}`, () => paintTiKouka(320 + v, 60 + v * 10)), x, gy + 1, -0.5, { sway: 0.3, tint }));
      else lay.add(new Prop(frameOf(`mf:${v}`, () => plant('flax', 330 + v, 26)), x, gy + 1, 0.5, { sway: 0.4, tint: tint2 }));
    }
    lay.add(new ForestMist(10, gy - 34, 4, clock, 0.42, 51, 640, 60, '#c8d8cc'));
  }
  // the near back: kahikatea in the swamp forest stretches; tī kōuka, flax and raupō across the open beds
  {
    const pb = 0.9, back = st.addLayer('back', pb, 0.05, 0.6, 0, pb);
    const gy = farY(pb);
    for (let x = 40; x < SW.W + 300; x += rng.range(60, 150)) {
      const wx = x; // (roughly the world x it sits behind)
      const k = rng.next();
      const cov = swCanopy(wx);
      if (cov > 0.45 && k < 0.45) {
        const w = rng.range(40, 66), H = Math.round(gy + 160);
        back.add(new Prop(frameOf(`bk:${Math.round(w / 8)}:${rng.int(0, 2)}`, () => paintGiant('kahikatea', 400 + Math.round(w), w, H, { epiphytes: 0.9, fadeTop: 90 })), x * pb, gy + 4, -2 + rng.next(), { flip: rng.chance(0.5), tint: packColor(0.8, 0.88, 0.86, 1) }));
      } else if (k < 0.62) back.add(new Prop(frameOf(`bt:${rng.int(0, 3)}`, () => paintTiKouka(410 + rng.int(0, 3), 70 + rng.int(0, 3) * 12)), x * pb, gy + 3, rng.next(), { sway: 0.35, tint: packColor(0.82, 0.88, 0.86, 1), flip: rng.chance(0.5) }));
      else back.add(new Prop(frameOf(`br:${rng.int(0, 3)}`, () => paintRaupo(420 + rng.int(0, 3), 40 + rng.int(0, 3) * 6, { width: 46 })), x * pb, gy + 3, rng.next(), { sway: 0.7, tint: packColor(0.84, 0.9, 0.88, 1) }));
    }
  }

  // ---------------------------------------------------------------- the gameplay plane: the floor
  const main = st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  const floor = { base: swBase, wet: swWet, depth: swDepth, rows: 200, seed: 1931, hollow: swHollow };
  for (let x0 = 0; x0 < SW.W; x0 += 1000) {
    const w = Math.min(1000, SW.W - x0);
    const ch = paintSwampFloor(floor, x0, w);
    const base = bigFrame(r, ch.base), wat = bigFrame(r, ch.water);
    main.add(new Custom(-10, rr => {
      if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return;
      rr.draw(base, x0, ch.y0);
      rr.water(0.62, 0.7, 0.7);
      rr.draw(wat, x0, ch.y0);
      rr.water(0);
    }));
  }
  const ripples = new Ripples();
  main.add(ripples);
  // lily pads in rafts on the open water, smaller with distance (each raft its own prop)
  for (let x = 700; x < SW.W - 200; x += rng.range(18, 46)) {
    const dd = rng.range(4, 150);
    if (swampIsWater(floor, x, dd) < 0.12 || swampIsWater(floor, x + 14, dd) < 0.12 || swampIsWater(floor, x - 14, dd) < 0.12) continue;
    const P = wpersp(dd), v = rng.int(0, 7), bloom = v === 6 ? 1 : v === 7 ? 2 : 0;
    const w = Math.round((16 + (v % 3) * 6) * Math.min(1.6, P * 0.8) / 2) * 2;
    main.add(new Prop(frameOf(`lily:${v}:${w}`, () => paintLilyPads(1600 + v * 7 + w, w, bloom)), x, swBase(x) + dd, -8.4 + dd * 0.0005, { flip: rng.chance(0.5) }));
  }
  main.add(new MarshBubbles(ripples));
  // the hollow's and the channel's back banks: peat cut in layers, roots, seeps
  for (const [a, b, s] of [[POOL.x0 - 4, POOL.x1 + 4, 2001], [CHANNEL.x0 - 4, CHANNEL.x1 + 4, 2002]] as const) {
    const pb = paintPeatBank(b - a, x => swBase0(x + a) - 4, x => swBase(x + a), s);
    addWide(main, pb.buf, a, pb.y0, -7);
  }

  // ---------------------------------------------------------------- trees and the swamp's plants
  // kahikatea on their buttresses, standing in the black water (trunks out of the frame)
  const giants: [number, number][] = [[860, 58], [1060, 72], [1250, 54], [1420, 80], [1610, 62], [1800, 70], [1990, 56], [2180, 66], [560, 60], [4110, 74], [5130, 66], [6890, 60], [7930, 58]];
  for (const [x, w] of giants) {
    const gy = swGround(x);
    const H = Math.round(gy - SW.minY + 60);
    main.add(new Prop(frameOf(`giant:${x}`, () => paintGiant('kahikatea', x + 1931, w, H, { epiphytes: 1.1, vines: 0.8, sink: 8 })), x, gy + 6, -6.5));
    f.pois.push({ kind: 'trunk', x, y: gy, y1: gy - 220 }, { kind: 'branch', x: x + w * 0.4, y: gy - rng.range(100, 170) }, { kind: 'perch', x: x - w * 0.3, y: gy - rng.range(130, 200) });
  }
  const nearGiant = (x: number, rr: number) => giants.some(([gx, w]) => Math.abs(gx - x) < w * 0.6 + rr);
  const inHollow = (x: number) => (x > POOL.x0 + 20 && x < POOL.x1 - 20) || (x > CHANNEL.x0 + 20 && x < CHANNEL.x1 - 20);
  // drowned trees: the dead stand, and a few round the pool and down the channel
  const drowned = [5340, 5520, 5690, 5860, 6040, 6230, 6420, 6610, 4470, 4820, 7300, 7520, 2620, 3020, 9300];
  for (const x of drowned) {
    const h = rng.range(110, 210), v = rng.int(0, 2);
    main.add(new Prop(frameOf(`dead:${x}`, () => paintDrownedTree(x + 7 * v, h)), x, swGround(x) + 3, -6 + rng.next() * 0.3, { flip: rng.chance(0.5) }));
    f.pois.push({ kind: 'perch', x, y: swGround(x) - h * 0.8 }, { kind: 'trunk', x, y: swGround(x), y1: swGround(x) - h * 0.6 });
  }
  // stumps in the water
  for (let x = 820; x < SW.W - 200; x += rng.range(220, 520)) {
    if (swDepth(x) < 1 || nearGiant(x, 20)) continue;
    const v = rng.int(0, 3);
    main.add(new Prop(frameOf(`stump:${v}`, () => paintStump(500 + v, 12 + v * 4, 14 + v * 6)), x, swGround(x) + 2, -5.4));
    f.pois.push({ kind: 'perch', x, y: swGround(x) - 16 - v * 6 });
  }
  // (the plants Mori and the animals push through bend away from them and spring back, and sway in
  // the gusts: GroundCover, the woods' ground cover; each plant stays its own prop)
  const movers = (): Mover[] => {
    const out: Mover[] = [{ x: f.player.x, y: f.player.y, vx: f.player.vx }];
    for (const a of f.actors.values()) if (a.visible) out.push({ x: a.x, y: a.y, vx: a.walking ? a.facing * 40 : 0 });
    for (const an of f.animals) if (!an.dead && !an.gone && an.medium === 'ground') out.push({ x: an.x, y: an.y, vx: an.vx });
    return out;
  };
  const me = () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx });
  const reeds = new GroundCover(-5.3, movers, me);
  main.add(reeds);
  // behind the walk line: tī kōuka, flax, pukio and raupō beds (raupō thickest in the open beds)
  // (the whare on the hidden island stands clear of them, so it reads from down in the channel)
  const byHut = (x: number, r: number) => Math.abs(x - CHANNEL.hut) < r;
  for (let x = 30; x < SW.W - 30; x += rng.range(26, 70)) {
    if (nearGiant(x, 18) || byHut(x, 72)) continue;
    const cov = swCanopy(x), k = rng.next(), d = swDepth(x);
    const gy = swGround(x) + (d > 1 ? Math.min(d, 6) : 1);
    let fr;
    if (k < 0.08 && d < 2 && !inHollow(x)) { const v = rng.int(0, 3); fr = frameOf(`tk:${v}`, () => paintTiKouka(600 + v, 90 + v * 22)); }
    else if (k < 0.22 && d < 3) { const v = rng.int(0, 3); fr = frameOf(`fx:${v}`, () => plant('flax', 610 + v, 30 + v * 4)); }
    else if (k < 0.34 && cov > 0.3) { const v = rng.int(0, 3); fr = frameOf(`pk:${v}`, () => paintPukio(620 + v, 26 + v * 5)); }
    else { const v = rng.int(0, 5); fr = frameOf(`rp:${v}`, () => paintRaupo(630 + v, 46 + v * 8 + (cov < 0.3 ? 12 : 0))); }
    if (k < 0.08 && d < 2 && !inHollow(x)) main.add(new Prop(fr, x, gy, -5.4 + rng.next() * 0.3, { sway: 0.4, flip: rng.chance(0.5), tint: packColor(0.9, 0.95, 0.93, 1) }));
    else reeds.add(fr, x, gy, rng.chance(0.5), packColor(0.9, 0.95, 0.93, 1), k < 0.22 ? 'reed' : k < 0.34 ? 'bush' : 'reed');
  }

  // ---------------------------------------------------------------- the ways across: boardwalks, logs, stones
  const cuts: number[] = [];
  WALKS.forEach(([a, b], i) => {
    const bw = paintBoardwalk(b - a, x => deckY(x + a) ?? swBase(x + a), x => swBase(x + a), 2100 + i);
    addWide(main, bw.buf, a, bw.y0, -1.3);
    const pts: [number, number][] = [];
    for (let x = a; x <= b; x += 6) pts.push([x, (deckY(x) ?? swBase(x)) - 1]);
    if (pts[pts.length - 1][0] < b) pts.push([b, (deckY(b) ?? swBase(b)) - 1]);
    st.terrain.addPlatform(pts, 'bridge');
    if (swDepth(a) < 1) cuts.push(a);
    if (swDepth(b) < 1) cuts.push(b);
  });
  LOGS.forEach(([x, len], i) => {
    const L = paintStepLog(2200 + i, len, 11);
    const top = swBase(x + len / 2) - 3;
    main.add(new Prop(local.add(`sw:slog${i}`, L.buf, L.ax, L.ay), x, top, -1.1));
    const pts: [number, number][] = [];
    for (let k = 2; k <= len - 2; k += 4) pts.push([x + k, top + L.top(k)]);
    st.terrain.addPlatform(pts, 'branch');
  });
  STONES.forEach(([x, w], i) => {
    const S = paintStepStone(2300 + i, w);
    const top = swBase(x) - 2;
    main.add(new Prop(local.add(`sw:stone${i}`, S.buf, S.ax, S.ay), x, top, -1.1));
    st.terrain.addPlatform([[x - w / 2 + 2, top], [x + w / 2 - 2, top]], 'rock');
  });
  // the fallen kahikatea over the dark pool: the main path walks it rim to rim
  {
    const [a, b] = POOL.log;
    const L = paintStepLog(2401, b - a, 20);
    const y = Math.min(swBase0(a), swBase0(b)) - 1;
    main.add(new Prop(local.add('sw:poollog', L.buf, L.ax, L.ay), a, y, -1.0));
    const pts: [number, number][] = [];
    for (let k = 0; k <= b - a; k += 6) pts.push([a + k, y + L.top(k)]);
    st.terrain.addPlatform(pts, 'branch');
    cuts.push(a, b);
    // the old one's mud island under the log
    f.pois.push({ kind: 'bank', x: POOL.stage, y: swGround(POOL.stage) });
  }
  // the swing bridge over the channel round the hidden island
  {
    const x0 = CHANNEL.x0, x1 = CHANNEL.x1, len = x1 - x0;
    const sb = paintSwingBridge(len, 9, 2501);
    const y0 = swBase(x0) - 1, y1 = swBase(x1) - 1;
    main.add(new Prop(local.add('sw:bridge', sb.buf, sb.ax, sb.ay), x0, y0, -1.2));
    const pts: [number, number][] = [];
    for (let x = 0; x <= len; x += 6) pts.push([x0 + x, y0 + (y1 - y0) * (x / len) + sb.deck(x)]);
    st.terrain.addPlatform(pts, 'bridge');
    cuts.push(x0, x1);
    f.pois.push({ kind: 'perch', x: x0 + len * 0.3, y: y0 - 18 }, { kind: 'perch', x: x0 + len * 0.7, y: y1 - 18 });
  }
  // the maimai and its catwalk over the raupō: the high way
  {
    const { x0, x1 } = MAIMAI;
    const m = paintMaimai(x1 - x0, x => maimaiY(x + x0), x => swGround(x + x0), [MAIMAI.up - x0, MAIMAI.down - x0], 2601);
    addWide(main, m.buf, x0, m.y0, -1.4);
    st.terrain.addPlatform([[x0 + 2, maimaiY(x0 + 2)], [x1 - 2, maimaiY(x1 - 2)]], 'bridge');
    for (const [x, upL, downL] of [[MAIMAI.up, 'Climb the ladder up to the maimai', 'Climb down the ladder'], [MAIMAI.down, 'Climb the ladder up to the catwalk', 'Climb down into the shallows']] as const) {
      const ld = { x, y0: maimaiY(x), y1: swGround(x) };
      st.terrain.addClimb(x, ld.y0, ld.y1, 'ladder');
      (f.interact as Interactable[]).push({ x, y: ld.y1, w: 14, h: 18, label: upL, standX: x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - ld.y1) < 12, action: () => f.climbLadder(ld, -1) });
      (f.interact as Interactable[]).push({ x, y: ld.y0, w: 14, h: 18, label: downL, standX: x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - ld.y0) < 12, action: () => f.climbLadder(ld, 1) });
    }
    f.pois.push({ kind: 'perch', x: x1 - 30, y: maimaiY(x1 - 30) - 4 });
  }
  // the whare on the hidden island
  {
    const s = paintWhare(2701);
    main.add(new Prop(local.add('sw:whare', s.buf, s.ax, s.ay), CHANNEL.hut, swGround(CHANNEL.hut) + 2, -4));
  }

  // ---------------------------------------------------------------- the floor in front: in depth
  const backCover = new GroundCover(-2.4, movers, me), frontCover = new GroundCover(58, movers, me);
  main.add(backCover); main.add(frontCover);
  const tuft = (kinds: PlantKind[], sizes: [number, number]) => {
    const kind = kinds[rng.int(0, kinds.length - 1)], v = rng.int(0, 3), s = Math.round(rng.range(sizes[0], sizes[1]) / 4) * 4;
    return frameOf(`tuft:${kind}:${v}:${s}`, () => plant(kind, 1700 + v * 7 + s, s));
  };
  const reedTuft = () => { const v = rng.int(0, 4); return frameOf(`rt:${v}`, () => paintRaupo(700 + v, 22 + v * 5, { heads: v % 2, width: 18 })); };
  for (let x = 20; x < SW.W - 10; x += rng.range(10, 22)) {
    const d = swDepth(x);
    if (rng.next() > 0.8 || byHut(x, 58)) continue;
    const rt = d > 1 || rng.chance(0.5);
    backCover.add(rt ? reedTuft() : tuft(['sedge', 'grass', 'sedge', 'kiokio'], [20, 34]), x, swGround(x) + (d > 1 ? Math.min(d, 8) : 1), rng.chance(0.5), undefined, rt ? 'reed' : 'grass');
  }
  for (let x = 16; x < SW.W - 10; x += rng.range(18, 40)) {
    const d = swDepth(x);
    frontCover.add(d > 1 ? reedTuft() : tuft(['sedge', 'moss', 'grass', 'sedge', 'lily'], [12, 22]), x + rng.range(-4, 4), swBase(x) + rng.range(5, 10) + (d > 1 ? 4 : 0), rng.chance(0.5), undefined, d > 1 ? 'reed' : 'grass');
  }
  // further toward the camera: raupō clumps and pukio in the water and on the hummocks, stumps, logs
  for (let x = 30; x < SW.W; x += rng.range(22, 48)) {
    const dd = rng.range(18, 170);
    const k = rng.next();
    if (byHut(x, 60) && dd < 70) continue;
    const v = rng.int(0, 5);
    const fr = k < 0.55 ? frameOf(`fr:${v}`, () => paintRaupo(800 + v, 34 + v * 9, { width: 30 + v * 4 }))
      : k < 0.72 ? frameOf(`fp:${v % 3}`, () => paintPukio(810 + (v % 3), 22 + (v % 3) * 6))
        : k < 0.8 ? frameOf(`fs:${v % 3}`, () => paintStump(820 + (v % 3), 10 + (v % 3) * 4, 10 + (v % 3) * 5))
          : k < 0.9 ? tuft(['sedge', 'flax', 'lily'], [16, 28]) : frameOf(`fx2:${v % 2}`, () => plant('flax', 830 + (v % 2), 24));
    main.add(new Prop(fr, x, swBase(x) + dd, 60 + dd * 0.02, { sway: k < 0.72 || k > 0.8 ? 0.5 : 0, flip: rng.chance(0.5), foliage: k < 0.55 ? 'reed' : k < 0.72 ? 'bush' : k < 0.8 ? false : k < 0.9 ? 'grass' : 'reed' }));
  }
  // hide spots: the thickest raupō
  const hides: SwampRuntime['hides'] = [];
  const hideCover = new GroundCover(66, movers, me);
  main.add(hideCover);
  for (const x of [520, 1560, 2480, 3420, SW_SPOT.poolHide, 5960, 7360, 8840]) {
    const s = sprite(`sw:hide:${x % 3}`, () => paintRaupo(900 + (x % 3), 50, { heads: 3, width: 40 }));
    const y = swGround(x) + 3;
    if (s) {
      hideCover.add(s.f, x, y, false, undefined, 'reed');
      f.occluders.push({ mask: s.s.buf, x, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x, y, w: 18 });
    hides.push({ x, w: 30, y, cover: 0.85 });
  }

  // ---------------------------------------------------------------- water, light, air
  main.add(new FrontWater(() => {
    const out: [number, number][] = [[f.player.x, 13]];
    if (f.guide) out.push([f.guide.a.x, 12]);
    for (const a of f.animals) if (!a.gone && !a.dead && a.medium === 'ground') out.push([a.x, a.species === 'bellowtoad' ? 64 : 12]);
    return out;
  }));
  const shade = new WoodsShade(clock, swCanopy, swGround);
  main.add(shade);
  main.add(new WoodsAir(main, clock, swCanopy, swGround));
  // the fog: low banks over the water, drifting at their own speeds (thickest at dawn and dusk)
  main.add(new ForestMist(-3, 176, 5, clock, 0.5, 61, 640, 56, '#c4d4c8'));
  main.add(new ForestMist(-2.8, 196, -3, clock, 0.4, 62, 520, 44, '#d0dccf'));
  const rain = new SwampRain(clock, ripples);
  main.add(rain);
  main.add(new MarshLights(clock));
  main.add(new Mosquitoes(clock, () => (f.player ? { x: f.player.x, y: f.player.y } : null), () => {
    if (game.scene !== f || f.cutscene) return;
    void floatText({ text: rand.pick(['Bzzz. Mosquitoes. Of COURSE there are mosquitoes.', 'Ow! Something just drank me.', 'Get OFF. I am not dinner. I am a scientist.']), style: 'scared', ms: 2200 });
  }));
  // a low fog bank in front of everything too
  {
    const pf = 1.12, fl = st.addLayer('fogfront', pf, 0, 0.2, 0, pf);
    fl.add(new ForestMist(0, layerY(pf, 300, WOODS_ZOOM) - 30, 7, clock, 0.32, 63, 700, 60, '#c8d6cc'));
  }
  swampFront(f, frameOf, rng);

  // ---------------------------------------------------------------- terrain
  {
    const pts: [number, number][] = [];
    const cs = [...new Set(cuts)].sort((a, b) => a - b);
    for (let x = 0; x <= SW.W; x += 6) {
      const cut = cs.find(q => q > x - 6 && q <= x);
      if (cut !== undefined && cut > 0 && pts.length) {
        pts.push([cut, swGround(cut)]);
        st.terrain.addGround(pts.splice(0), 'ground');
        pts.push([cut, swGround(cut)]);
      }
      pts.push([x, swGround(x)]);
    }
    if (pts.length > 1) st.terrain.addGround(pts, 'ground');
  }
  // POIs the wildlife uses
  for (let x = 820; x < SW.W; x += 260) {
    const d = swDepth(x);
    if (d > 1 && d < 7) f.pois.push({ kind: 'shallows', x, y: swGround(x), w: 60 } as never);
    else if (d >= 7) f.pois.push({ kind: 'water', x, y: swBase(x), y1: swGround(x), w: 60 });
    else f.pois.push({ kind: 'bank', x, y: swGround(x), w: 60 } as never, { kind: 'mud', x: x + 30, y: swGround(x + 30) });
  }
  for (const x of [300, 2380, 3300, 5000, 8000]) f.pois.push({ kind: 'flower', x, y: swGround(x) - 30 });
  f.sunspots.push({ x: 2600, w: 900 }, { x: 5400, w: 1200 }, { x: 8400, w: 1100 });

  // ---------------------------------------------------------------- the light
  installWoodsEnv(f, clock, swCanopy, swBase, { open: 0.5 });
  const woodsEnv = st.envHook;
  st.envHook = (env: Env, edt: number) => {
    woodsEnv?.(env, edt);
    // the swamp's air: wetter, greyer, a touch of tea-brown in the low fog; rain dulls it all
    const k = rain.k, night = clock.night;
    const g = (c: [number, number, number], m: [number, number, number], s: number): [number, number, number] => [c[0] + (m[0] - c[0]) * s, c[1] + (m[1] - c[1]) * s, c[2] + (m[2] - c[2]) * s];
    env.fogBottom = g([...env.fogBottom], [0.5 - night * 0.36, 0.56 - night * 0.4, 0.5 - night * 0.36], 0.35 + k * 0.25);
    env.fogTop = g([...env.fogTop], [0.48 - night * 0.36, 0.55 - night * 0.4, 0.54 - night * 0.36], 0.3 + k * 0.3);
    env.exposure *= (1 - k * 0.12 * (1 - night * 0.6)) * (1 + night * 0.16);
    env.saturation *= 1 - k * 0.18;
    env.waterAxis = Math.round(swBase(f.player ? f.player.x : SW_SPOT.enter)) - 1;
  };

  // ---------------------------------------------------------------- the crossroads, the toads
  registerPosts(f, posts());
  const run: SwampRuntime = {
    clock, rain, ripples, main, hides, covers: [backCover, frontCover],
    enter: fs => {
      for (const h of hides) if (!fs.player.hides.some(q => q.x === h.x)) fs.player.hides.push(h);
      const cam = fs.st.cam;
      cam.zoom = cam.tzoom = WOODS_ZOOM;
      cam.y = cam.ty = Math.min(fs.player.y, swGround(fs.player.x)) - 34;
      placeKey = '';
      attachToads(fs);
      // (the rain's hiss stops when the swamp is left behind)
      const ex = fs.exit.bind(fs);
      fs.exit = () => { audio.setStorm(0); ex(); };
    },
    update: (fs, dt) => tick(fs, dt, run, shade),
  };
  return run;
}

// ---------------------------------------------------------------- the foreground framing
function swampFront(f: FieldScene, frameOf: (key: string, gen: () => Sprite) => import('../../../gfx/renderer').Frame & { sprite: Sprite }, rng: Rng) {
  const st = f.st;
  const pf = 1.32, front = st.addLayer('front', pf, 0, 0.45, 0, pf);
  const dark = FP.canopy[0];
  const yAt = (p: number, sy: number, x: number) => layerY(p, sy, WOODS_ZOOM) + (swBase(x) - 214) * p;
  const occ = (s: Sprite, x: number, y: number, flip: boolean, p: number) => f.occluders.push({ mask: s.buf, x, y, ax: s.ax, ay: s.ay, sx: flip ? -1 : 1, sy: 1, p, z: 0 });
  const keep = [SW_SPOT.postBoard, SW_SPOT.postMaimai, SW_SPOT.postPool, SW_SPOT.postChannel, POOL.stage, SW_SPOT.poolHide, CHANNEL.hut, 160, SW.W - 160];
  // raupō and flax right up close, rising from the bottom edge, out of focus
  for (let x = 100; x < SW.W + 300; x += rng.range(130, 260)) {
    if (keep.some(q => Math.abs(q - x) < 140)) continue;
    const k = rng.next(), v = rng.int(0, 2);
    const fr = k < 0.55 ? frameOf(`fgr:${v}`, () => soften(paintRaupo(1500 + v, 96 + v * 18, { width: 70 }), 1, dark, 0.6))
      : k < 0.8 ? frameOf(`fgf:${v}`, () => soften(plant('flax', 1510 + v, 70 + v * 10), 1, dark, 0.64))
        : frameOf(`fgs:${v}`, () => fgFernSpray(1520 + v, 70 + v * 10, false, 1, dark, 0.62));
    const X = x * pf, flip = rng.chance(0.5), y = yAt(pf, 372, x) + 4 + rng.range(4, 20);
    front.add(new Prop(fr, X, y, rng.next(), { sway: 0.5, flip }));
    occ(fr.sprite, X, y, flip, pf);
  }
  // hanging from above, only where the kahikatea close over
  for (let x = 60; x < SW.W + 300; x += rng.range(150, 280)) {
    if (swCanopy(x) < 0.5) continue;
    const k = rng.next(), v = rng.int(0, 2);
    const fr = k < 0.5 ? frameOf(`fgv:${v}`, () => fgVines(1530 + v, 80, 70 + v * 20, 1, dark, 0.6)) : frameOf(`fgc:${v}`, () => soften(canopyClump(1540 + v, 200, 70, { above: 260 }), 1, dark, 0.58));
    front.add(new Prop(fr, x * pf, yAt(pf, -6, x) + (k < 0.5 ? -14 : 10), 2 + rng.next(), { sway: 0.25, flip: rng.chance(0.5) }));
  }
}

// ---------------------------------------------------------------- every frame
let placeKey = '';
let stepT = 0, deepT = 0, toldDeep = false;
function tick(f: FieldScene, dt: number, run: SwampRuntime, shade: WoodsShade) {
  const p = f.player;
  if (!p) return;
  const clock = run.clock;
  clock.update(dt);
  // the scene's time of day key follows the clock (insects, animals, the ambience)
  const tod = todOf(clock.t);
  if (tod !== f.tod) {
    f.tod = tod;
    f.night = tod === 'night';
    f.insects.night = f.night;
    audio.setAmbience('mangrove', f.night);
  }
  // the camera: close and low, following the ground (down into the hollow, up on the catwalk)
  const cam = f.st.cam;
  if (!cam.locked && !f.cam.active) { cam.tzoom = damp(cam.tzoom, WOODS_ZOOM, 3, dt); cam.ty = Math.min(p.y, swGround(p.x)) - 34; }
  // dappled shade on everyone
  const tint = (a: { x: number; tint: number }) => { const s = shade.sample(a.x, f.st.time); const kk = 1 - s * 0.3; a.tint = s > 0.01 ? packColor(kk, kk, kk * 1.02, 1) : WHITE; };
  tint(p.body as unknown as { x: number; tint: number });
  for (const a of f.actors.values()) tint(a as unknown as { x: number; tint: number });
  // wading: knee-deep slows him, waist-deep slows him right down and he gets hungry fast
  const d = swDepth(p.x);
  const onBed = p.onGround && Math.abs(p.y - swGround(p.x)) < 4;
  if (onBed && d > 1.2 && p.state !== 'swim') {
    p.wadeK = d > 8 ? 0.5 : d > 4 ? 0.68 : 0.82;
    p.ground = 'water';
    const moving = Math.abs(p.vx) > 8;
    if (moving && d > 8 && !f.cutscene && !game.ui.blocking) {
      addHunger(dt * 0.0004, 'wade');
      deepT += dt;
      if (deepT > 6 && !toldDeep) { toldDeep = true; void floatText({ text: rand.pick(['Waist deep. Every step is like lifting a sack of flour.', 'This is SO much hungrier work than walking.']), style: 'think', ms: 2600 }); }
    }
    if (moving) {
      stepT -= dt * Math.abs(p.vx) / 40;
      if (stepT <= 0) {
        stepT = 0.5;
        audio.play('stepWater', { vol: 0.3, pitch: rand.range(0.5, 0.7) });
        run.ripples.add(p.x + rand.range(-3, 3), swBase(p.x) + 1, 7, 0.9, 0.6);
      }
    } else if (rand.chance(dt * 0.6)) run.ripples.add(p.x + rand.range(-5, 5), swBase(p.x) + 1, 5, 1.2, 0.35);
  } else if (p.wadeK < 1 && p.state !== 'swim') {
    p.wadeK = 1;
    p.ground = p.surface && p.surface.kind === 'bridge' ? 'wood' : 'leaves';
    deepT = 0;
  } else if (p.onGround) p.ground = p.surface && p.surface.kind === 'bridge' ? 'wood' : p.ground === 'water' ? 'leaves' : p.ground;
  // the place
  const [n, sub] = swZone(p.x);
  const key = n + '|' + sub;
  if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(n, `${sub} · Day ${game.save.day || 1}`); }
  void clamp;
}

/** for the dev points: where Mori stands on the highest thing at x */
export const SW_POINTS = { ...SW_SPOT };
void findArt; void SWP; void addWide;

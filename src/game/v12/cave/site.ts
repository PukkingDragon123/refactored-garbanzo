// V12 Te Rua Pōuri, the deep dark cave (the map and the walk lines: ./layout.ts). One tall scene: a
// section through the headland behind the glowworm cave, painted in limestone (src/art/v12/cave/rock.ts),
// tier under tier down to the black lake. The camera follows Mori down and up. It is dark: only what a
// light reaches can be seen (./dark.ts), and the deeper Mori goes the colder and hungrier he gets, and
// the longer the climb home. The old caver's ladders are still there; the deep pitches need a rope.
//
// Who lives here: ./bugs.ts (wētā on the walls, glowworms, harvestmen, centipedes, moths at the mouth,
// springtails on the pools), ./species.ts and ./sala.ts (the blind salamanders), ./gulper.ts (the
// Ghost Gulper in the lake). What to find and do: ./quests.ts.

import type { FieldScene, SpawnV2 } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Surface } from '../../../world/terrain';
import { Prop, Custom } from '../../../world/props';
import { packColor, WHITE } from '../../../gfx/renderer';
import type { Env } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { local, A } from '../../assets';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { Rng, clamp, damp, rand } from '../../../core/math';
import type { Sprite } from '../../../art/jungle-core';
import { DayClock } from '../../v4/islefx';
import { sprite } from '../../sites2/common';
import { clockForTod } from '../../v11/woods/kit';
import { currentExpedition, expeditionHour } from '../../v10/expedition';
import type { Site10 } from '../../sites10/kit';
import { registerPosts, hourNow } from '../trails';
import type { RegionPost } from '../trails';
import { gateOk, GATES } from '../gear';
import { addHunger } from '../hunger';
import { DARK_HOUR, hourWords } from '../clock';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { showWatch } from '../../../ui/v12/watch';
import { paintCaveRock, paintStalactite, paintStalagmite, paintCurtain, paintCrystals, paintFungi, paintShelf, paintBoulder, paintGuano, paintCamp, paintJournal, paintPole, paintLadder, paintPlanks, paintAnchor } from '../../../art/v12/cave/rock';
import { DC, TIERS, TIER, HOLES, LADDERS, ROPES, PLANKS, CHUTE, POOLS, chuteY, LAKE, FALLS, SPOT, floorOf, poolTop, climbOf, zoneAt, depthK } from './layout';
import { Darkness, LAMP, lampR, lanternFrames, drawLanternGlow } from './dark';
import type { CaveLight } from './dark';
import { Waterfall, CaveWater, Glowworms, breathPuff } from './fx';
import { CaveBugs } from './bugs';
import { attachLife } from './life';
import { CAVE_POINTS } from './quests';
import { CAVE_CTX } from './species';

const todOf = (t: number) => (t < 0.35 ? 'dawn' : t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night') as 'dawn' | 'day' | 'dusk' | 'night';
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface CaveRuntime {
  clock: DayClock;
  dark: Darkness;
  water: CaveWater;
  glow: Glowworms;
  /** the surface Mori stands on -> how far he may walk along it */
  limits: Map<Surface, [number, number]>;
  hides: { x: number; w: number; y: number; cover: number }[];
  /** lights that move (the lantern, the pole, the Gulper): added to each frame */
  extra: (() => CaveLight | null)[];
  /** where Mori's lantern is (null: hung on the pole) */
  lantern: () => [number, number] | null;
  update(f: FieldScene, dt: number): void;
  enter(f: FieldScene): void;
}
let rt: CaveRuntime | null = null;
/** the cave's runtime while it is the scene */
export const caveRuntime = () => rt;

/** who lives here (the animals' minds: ./species.ts; the small life in swarms: ./bugs.ts) */
const fy = (tier: string, x: number) => floorOf(tier, x);
const ALLT = ['dawn', 'day', 'dusk', 'night'] as SpawnV2['times'];
export const CAVE_SPAWNS: SpawnV2[] = [
  // blind salamanders in every pool of the dark stream, the plunge pool and the gallery's pool
  ...POOLS.map((p): SpawnV2 => ({ species: 'blindsal', n: p.tier === 'g' ? [1, 1] : p.tier === 't4' ? [2, 2] : [2, 3], x: [p.x0 + 14, p.x1 - 14], y: poolTop(p) + 5, medium: 'water', times: ALLT, chance: 1 })),
  // the Ghost Gulper, deep in the lake
  { species: 'gulper', n: [1, 1], x: [1500, 1800], y: LAKE.top + 104, medium: 'water', times: ALLT, chance: 1 },
  // cave wētā on the walls (the swarms are drawn by ./bugs.ts; these ones can be photographed), and the
  // big one in the wētā hall that jumps at a bright lantern
  { species: 'caveweta', n: [2, 3], x: [300, 700], y: fy('t0', 500) - 38, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 2], x: [1100, 1500], y: fy('t0', 1300) - 34, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [2, 3], x: [700, 1050], y: fy('t1', 900) - 56, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [2, 3], x: [1400, 1850], y: fy('t1', 1600) - 48, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 1], x: [SPOT.bigWeta - 4, SPOT.bigWeta + 4], y: fy('t1', SPOT.bigWeta) - 40, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 2], x: [1700, 2100], y: fy('t3', 1900) - 40, medium: 'trunk', times: ALLT, chance: 1 },
  // harvestmen on the floors of the halls
  { species: 'harvestman', n: [2, 3], x: [820, 1000], y: fy('t1', 900), medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'harvestman', n: [1, 2], x: [1500, 1700], y: fy('t2', 1600), medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'harvestman', n: [1, 2], x: [1380, 1520], y: fy('g', 1450), medium: 'trunk', times: ALLT, chance: 1 },
];

export const DEEPCAVE: Site10 = {
  id: 'deepcave', loc: 'deepcave', name: 'Te Rua Pōuri', width: DC.W, camY: 120, followY: true, minY: DC.minY, maxY: DC.maxY,
  spawnX: SPOT.enter, exitX: SPOT.exit, waterY: null, ambience: 'none', music: 'spooky', ground: 'sand',
  build(f: FieldScene) { rt = buildCave(f); },
  onUpdate(f, dt) { rt?.update(f, dt); },
  spawns: CAVE_SPAWNS,
  insects: [],
  onEnter: f => { rt?.enter(f); },
  v10: { points: CAVE_POINTS },
};

// ---------------------------------------------------------------- the crossroads
async function climbFrom(f: FieldScene, x: number, tier: string, dir: 1 | -1) {
  const p = f.player;
  await Promise.race([p.walkTo(x, 60), sleep(9000)]);
  if (Math.abs(p.x - x) > 10 || Math.abs(p.y - floorOf(tier, x)) > 14) return;
  const c = f.st.terrain.climbs.find(k => Math.abs(k.x - x) < 2);
  if (!c) { ropeRefuse(f); return; }
  await f.climbLadder({ x, y0: c.y0, y1: c.y1 }, dir);
}
function ropeRefuse(f: FieldScene) {
  audio.play('wrong', { vol: 0.4 });
  f.player.body.setExpr('thinking', 2);
  void floatText({ text: GATES.rope.why, style: 'think', ms: 3200 });
}
async function walkTo(f: FieldScene, x: number) { await Promise.race([f.player.walkTo(x, 60), sleep(12000)]); }
const dim = (s: string) => `${s} <span style="opacity:.75">· the way down</span>`;
function posts(): RegionPost[] {
  const rope = () => (gateOk('rope') ? '' : ' <span style="opacity:.75">(needs a climbing rope)</span>');
  return [
    { x: SPOT.postT0, y: TIER.t0.floor(SPOT.postT0), arms: [
      { info: 'TE KŪAHA', go: 120, dir: 'left' },
      { tier: 'THE OLD LADDER', mark: 'down', dir: 'right', label: dim('Climb down the old caver\'s ladder into the wētā hall'), go: f => climbFrom(f, LADDERS.t0.x, 't0', 1) },
    ] },
    { x: SPOT.postT1b, y: TIER.t1.floor(SPOT.postT1b), arms: [
      { tier: 'THE MOUTH', mark: 'up', dir: 'right', label: 'Climb the old ladder back up to the mouth <span style="opacity:.75">· the way out</span>', go: f => climbFrom(f, LADDERS.t0.x, 't1', -1) },
      { info: 'NGĀ WĒTĀ', go: 1100, dir: 'left' },
    ] },
    { x: SPOT.postT1a, y: TIER.t1.floor(SPOT.postT1a), arms: [
      { info: 'THE OLD LADDER', go: 1600, dir: 'right' },
      { tier: 'THE SCREE CHUTE', mark: 'down', dir: 'left', label: dim('Down the scree chute, carefully'), go: async f => { await walkTo(f, 450); await walkTo(f, 100); } },
    ] },
    { x: SPOT.postT2a, y: TIER.t2.floor(SPOT.postT2a), arms: [
      { tier: 'THE SCREE CHUTE', mark: 'up', dir: 'left', label: 'Scramble back up the scree <span style="opacity:.75">· the way out</span>', go: f => scramble(f) },
      { info: 'THE SQUEEZE', go: 700, dir: 'right' },
    ] },
    { x: SPOT.postT2b, y: TIER.t2.floor(SPOT.postT2b), arms: [
      { info: 'TE HARORE', go: 1100, dir: 'left' },
      { info: 'THE ROPE PITCH', go: 2150, dir: 'right' },
      { tier: 'CRYSTAL GALLERY', mark: 'down', dir: 'right', label: dim('Down the caver\'s ladder under the planks'), go: f => climbFrom(f, LADDERS.g.x, 't2', 1) },
    ] },
    { x: SPOT.postT2c, y: TIER.t2.floor(SPOT.postT2c), arms: [
      { info: 'TE HARORE', go: 1300, dir: 'left' },
      { tier: 'THE ROPE PITCH', mark: 'down', dir: 'right', get label() { return dim('Rope down the pitch to the dark stream') + rope(); }, go: f => climbFrom(f, ROPES.pitch.x, 't2', 1) },
    ] },
    { x: SPOT.postT3a, y: TIER.t3.floor(SPOT.postT3a), arms: [
      { tier: 'THE ROPE PITCH', mark: 'up', dir: 'right', label: 'Climb the rope back up <span style="opacity:.75">· the way out</span>', go: f => climbFrom(f, ROPES.pitch.x, 't3', -1) },
      { info: 'TE AWA PŌURI', go: 1300, dir: 'left' },
    ] },
    { x: SPOT.postT3b, y: TIER.t3.floor(SPOT.postT3b), arms: [
      { info: 'TE AWA PŌURI', go: 1400, dir: 'right' },
      { tier: 'THE WET PITCH', mark: 'down', dir: 'left', get label() { return dim('Rope down beside the falls') + rope(); }, go: f => climbFrom(f, ROPES.wetA.x, 't3', 1) },
    ] },
    { x: SPOT.postT4, y: TIER.t4.floor(SPOT.postT4), arms: [
      { tier: 'THE WET PITCH', mark: 'up', dir: 'left', label: 'Climb the ropes back up beside the falls <span style="opacity:.75">· the way out</span>', go: f => climbFrom(f, ROPES.wetC.x, 't4', -1) },
      { info: 'THE CAVER\'S CAMP', go: 200, dir: 'left' },
      { info: 'TE WAHA O TE PŌ', go: 760, dir: 'right' },
    ] },
  ];
}

/** up the scree chute from its foot: a hop onto the scree, then the scramble up */
async function scramble(f: FieldScene) {
  const p = f.player;
  await walkTo(f, 150);
  if (Math.abs(p.x - 150) > 12 || Math.abs(p.y - floorOf('t2', 150)) > 14) return;
  const s = f.st.terrain.surfaceBelow(150, chuteY(150) - 4, 0);
  if (!s) return;
  p.y = s.y; p.surface = s.s; p.onGround = true; p.vy = 0;
  p.body.react('jump');
  audio.play('rustle', { vol: 0.4, pitch: 0.7 });
  void floatText({ text: rand.pick(['Two steps up, one step back. Scree is the WORST.', 'Hands and feet. Hands and feet.']), style: 'think', ms: 2200 });
  await walkTo(f, 470);
}

// ---------------------------------------------------------------- building it
export function buildCave(f: FieldScene): CaveRuntime {
  const st = f.st, r = game.r;
  const clock = new DayClock();
  clock.set(clockForTod(f.tod, currentExpedition() ? expeditionHour() : undefined));
  (f as unknown as { clock: DayClock }).clock = clock;
  st.minX = 0; st.maxX = DC.W; st.minY = DC.minY; st.maxY = DC.maxY;
  const rng = new Rng(4127);
  const frameOf = (key: string, gen: () => Sprite) => { const s = sprite('dc:' + key, gen)!; return Object.assign(s.f, { sprite: s.s }); };

  // ---------------------------------------------------------------- the black behind everything
  const back = st.addLayer('void', 0.2, 0, 0, 0, 0.2);
  back.add(new Custom(0, rr => rr.rect(rr.wx(-4), rr.wy(-4), rr.VW / rr.layerZoom + 8, rr.VH / rr.layerZoom + 8, packColor(0.012, 0.01, 0.016, 1))));

  // ---------------------------------------------------------------- the gameplay plane: the rock
  const main = st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  const CH = 512;
  for (let y0 = Math.floor(DC.minY / CH) * CH; y0 < DC.maxY; y0 += CH) for (let x0 = 0; x0 < DC.W; x0 += CH) {
    const w = Math.min(CH, DC.W - x0), h = Math.min(CH, DC.maxY - y0);
    const buf = paintCaveRock(x0, y0, w, h, HOLES, 4127);
    if (!buf) continue;
    main.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, x0, y0, -10));
  }
  const water = new CaveWater(f);
  main.add(water);
  main.add(new Custom(62, (rr, s2) => water.front(rr, s2.time)));
  const glow = new Glowworms();
  main.add(glow);
  const dark = new Darkness();

  // ---------------------------------------------------------------- the terrain: every tier's walk line
  const limits = new Map<Surface, [number, number]>();
  const terr = st.terrain;
  const lineOf = (tier: string, a: number, b: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let x = a; x < b; x += 4) pts.push([x, floorOf(tier, x)]);
    pts.push([b, floorOf(tier, b)]);
    return pts;
  };
  const ground = (tier: string, a: number, b: number, lim: [number, number], kind: Surface['kind'] = 'ground') => {
    terr.addGround(lineOf(tier, a, b), kind);
    limits.set(terr.surfaces[terr.surfaces.length - 1], lim);
  };
  const T0 = TIER.t0, T1 = TIER.t1, T2 = TIER.t2, T3 = TIER.t3, T4 = TIER.t4;
  ground('t0', T0.x0, T0.x1, [12, T0.x1 - 4], 'rock');
  ground('t1', T1.x0, T1.x1, [100, T1.x1 - 4], 'rock');
  {
    const pts: [number, number][] = [];
    for (let x = CHUTE[0][0]; x < 440; x += 3) pts.push([x, chuteY(x)]);
    pts.push([440, T1.floor(440)]);
    terr.addGround(pts, 'rock');
    limits.set(terr.surfaces[terr.surfaces.length - 1], [100, T1.x1 - 4]);
  }
  ground('t2', T2.x0, PLANKS.x0, [100, T2.x1 - 4], 'rock');
  {
    const y = floorOf('t2', PLANKS.x0);
    terr.addPlatform([[PLANKS.x0 - 2, y], [PLANKS.x1 + 2, floorOf('t2', PLANKS.x1)]], 'bridge');
    limits.set(terr.surfaces[terr.surfaces.length - 1], [100, T2.x1 - 4]);
    const pl = paintPlanks(PLANKS.x1 - PLANKS.x0);
    main.add(new Prop(local.add('dc:planks', pl.buf, pl.ax, pl.ay), PLANKS.x0, y, -1.5));
  }
  ground('t2', PLANKS.x1, T2.x1, [100, T2.x1 - 4], 'rock');
  ground('g', TIER.g.x0, TIER.g.x1, [TIER.g.x0 + 6, TIER.g.x1 - 6], 'rock');
  ground('t3', T3.x0, T3.x1, [T3.x0 + 4, T3.x1 - 4], 'rock');
  for (const id of ['w1', 'w2'] as const) {
    const t = TIER[id];
    ground(id, t.x0, t.x1, [t.x0 + 4, t.x1 - 4], 'rock');
    const sh = paintShelf(2600 + t.x0, t.x1 - t.x0, 26);
    main.add(new Prop(local.add('dc:shelf:' + id, sh.buf, sh.ax, sh.ay), t.x0, t.floor(t.x0) + 1, -1.2));
  }
  ground('t4', T4.x0, T4.x1, [T4.x0 + 4, T4.x1 - 4], 'sand' as never);

  // ---------------------------------------------------------------- the ways down: ladders and ropes
  const climbIt = (c: { x: number; y0: number; y1: number }, kind: 'ladder' | 'rope', up: string, down: string, gate: boolean) => {
    const ok = !gate || gateOk('rope');
    if (ok) terr.addClimb(c.x, c.y0, c.y1, kind);
    (f.interact as Interactable[]).push({ x: c.x, y: c.y1, w: 14, h: 18, label: up, standX: c.x, enabled: () => ok && f.player.state !== 'climb' && Math.abs(f.player.y - c.y1) < 12, action: () => f.climbLadder(c, -1) });
    (f.interact as Interactable[]).push({ x: c.x, y: c.y0, w: 14, h: 18, get label() { return ok ? down : `${down} <span style="opacity:.75">(needs a climbing rope)</span>`; }, standX: c.x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - c.y0) < 12, action: () => (ok ? f.climbLadder(c, 1) : ropeRefuse(f)) });
    return ok;
  };
  for (const [k, L] of Object.entries(LADDERS)) {
    const c = climbOf(L);
    climbIt(c, 'ladder', k === 't0' ? 'Climb the old ladder up to the mouth' : 'Climb the ladder up through the planks', k === 't0' ? 'Climb down the old ladder' : 'Climb down into the crystal gallery', false);
    const ld = paintLadder(Math.round(c.y1 - c.y0));
    main.add(new Prop(local.add('dc:ladder:' + k, ld.buf, ld.ax, ld.ay), c.x, c.y0 - 4, -1.6));
  }
  const ropes: { x: number; y0: number; y1: number }[] = [];
  for (const [k, R] of Object.entries(ROPES)) {
    const c = climbOf(R);
    const label = k === 'pitch' ? ['Climb the rope up the pitch', 'Rope down the pitch'] : ['Climb the rope up beside the falls', 'Rope down beside the falls'];
    if (climbIt(c, 'rope', label[0], label[1], true)) ropes.push(c);
    const an = paintAnchor();
    main.add(new Prop(local.add('dc:anchor', an.buf, an.ax, an.ay), c.x - 6, c.y0 + 1, -1.4));
  }
  // the ropes: laid-up flax, two strands twisting, a knot every so often, swaying a little
  main.add(new Custom(-1.3, (rr, s2) => {
    const vy0 = rr.wy(0) - 10, vy1 = rr.wy(rr.VH) + 10;
    const a = packColor(0.78, 0.62, 0.38, 1), b = packColor(0.5, 0.36, 0.2, 1), k = packColor(0.9, 0.76, 0.5, 1);
    for (const c of ropes) {
      if (c.y1 < vy0 || c.y0 > vy1) continue;
      const p = f.player, on = p.state === 'climb' && p.climb && Math.abs(p.climb.x - c.x) < 2;
      for (let y = Math.max(c.y0, Math.floor(vy0)); y < Math.min(c.y1 + 6, vy1); y++) {
        const t = (y - c.y0) / Math.max(1, c.y1 - c.y0);
        const sw = Math.round(Math.sin(s2.time * 0.8 + c.x) * 1.4 * t * (on ? 0.3 : 1));
        rr.rect(c.x + sw - 1, y, 1, 1, (y >> 1) % 2 ? a : b);
        rr.rect(c.x + sw, y, 1, 1, (y >> 1) % 2 ? b : a);
        if ((y - c.y0) % 46 === 30) { rr.rect(c.x + sw - 2, y, 4, 2, k); rr.rect(c.x + sw - 1, y + 2, 2, 1, b); }
      }
    }
  }));

  // ---------------------------------------------------------------- the rock's furniture
  const keep = [SPOT.postT0, SPOT.postT1a, SPOT.postT1b, SPOT.postT2a, SPOT.postT2b, SPOT.postT2c, SPOT.postT3a, SPOT.postT3b, SPOT.postT4, LADDERS.t0.x, LADDERS.g.x, ROPES.pitch.x, ROPES.wetA.x, ROPES.wetB.x, ROPES.wetC.x];
  const clear = (x: number, rr2 = 26) => keep.every(k => Math.abs(k - x) > rr2);
  for (const t of TIERS) {
    if (t.id === 'w1' || t.id === 'w2') continue;
    // stalactites down from the roof
    for (let x = t.x0 + 10; x < t.x1 - 6; x += rng.range(22, 70)) {
      const roof = t.floor(x) - t.height(x);
      const len = Math.min(t.height(x) * 0.45, rng.range(8, 34) * (rng.chance(0.15) ? 1.8 : 1));
      if (len < 6 || (t.id === 't2' && x > SPOT.squeeze[0] - 20 && x < SPOT.squeeze[1] + 20)) continue;
      const v = rng.int(0, 5);
      main.add(new Prop(frameOf(`sti:${v}:${Math.round(len / 4)}`, () => paintStalactite(300 + v * 13 + Math.round(len), Math.round(len), 4 + len * 0.22)), x, roof - 4, -6));
    }
    // stalagmites and rubble along the floor, behind the walk line
    for (let x = t.x0 + 30; x < t.x1 - 20; x += rng.range(60, 170)) {
      if (!clear(x) || (t.id === 't2' && x > SPOT.squeeze[0] - 20 && x < SPOT.squeeze[1] + 20)) continue;
      const hh = Math.min(t.height(x) * 0.5, rng.range(10, 36));
      if (hh < 8) continue;
      const v = rng.int(0, 5);
      main.add(new Prop(frameOf(`stm:${v}:${Math.round(hh / 4)}`, () => paintStalagmite(400 + v * 11 + Math.round(hh), Math.round(hh), 6 + hh * 0.4)), x, floorOf(t.id, x) + 2, -5.5));
    }
  }
  // flowstone curtains high on the walls of the big rooms
  for (const [x, tier, w, hh] of [[1180, 't1', 40, 70], [1380, 't1', 30, 54], [900, 't1', 26, 40], [1220, 't2', 30, 46], [1600, 'g', 24, 34], [1500, 't3', 28, 38]] as const) {
    const t = TIER[tier];
    main.add(new Prop(frameOf(`cur:${x}`, () => paintCurtain(500 + x, w, hh)), x, t.floor(x) - t.height(x) + 2, -6.5));
  }
  for (const x of [1000, 1300, 1700, 2050, 2250]) main.add(new Prop(frameOf(`curL:${x}`, () => paintCurtain(600 + x, 30 + (x % 3) * 8, 50 + (x % 4) * 10)), x, HOLES[HOLES.length - 1].top(x) + 4, -6.5));
  // boulders
  for (const [x, tier, w, hh] of [[760, 't1', 34, 22], [1450, 't1', 26, 18], [1880, 't2', 30, 20], [1100, 't3', 24, 16], [1840, 't3', 36, 24], [140, 't4', 30, 26]] as const) {
    if (!clear(x)) continue;
    main.add(new Prop(frameOf(`bld:${x}`, () => paintBoulder(700 + x, w, hh)), x, floorOf(tier, x) + 3, -4.5));
  }
  // the bats' leavings under the roost at the mouth
  main.add(new Prop(frameOf('guano', () => paintGuano(5, 46)), 920, floorOf('t0', 920) + 2, -4));
  main.add(new Prop(frameOf('guano2', () => paintGuano(6, 30)), 980, floorOf('t0', 980) + 2, -4));

  // ---------------------------------------------------------------- lights: glowworms, fungi, crystals
  const gw = (x: number, y: number, n: number, spread = 18) => { const c = glow.add(x, y, n, 900 + Math.round(x * 3 + y), spread); dark.lights.push(c.light); return c; };
  const roofAt = (tier: string, x: number) => { const t = TIER[tier]; return t.floor(x) - t.height(x) + 1; };
  for (const x of [260, 420, 560, 1220, 1480]) gw(x, roofAt('t0', x), 8);
  for (const x of [700, 1040, 1320, 1600, 1840]) gw(x, roofAt('t1', x), 10, 22);
  for (const x of [200, 380, 1500, 1700, 2000]) gw(x, roofAt('t2', x), 8);
  for (let x = 820; x < 2260; x += rng.range(90, 160)) gw(x, roofAt('t3', x), 12, 22);
  // (a colony over every pool: the water and what lives in it sit in their faint blue light)
  for (const q of POOLS) { const mx = (q.x0 + q.x1) / 2; const c = gw(mx, roofAt(q.tier, mx), 16, (q.x1 - q.x0) * 0.35); c.light.y = poolTop(q) - 6; c.light.r = (q.x1 - q.x0) * 0.62; c.light.k = 0.5; }
  // the glowworm sky over the lake
  const lakeRoof = HOLES[HOLES.length - 1].top;
  for (let x = 440; x < 2360; x += rng.range(34, 70)) gw(x, Math.round(lakeRoof(x)) + 6, 10 + rng.int(0, 10), 26);
  for (const x of [SPOT.postT0, SPOT.postT1a, SPOT.postT1b, SPOT.postT2a, SPOT.postT2b, SPOT.postT2c]) {
    const t = x === SPOT.postT0 ? 't0' : x === SPOT.postT1a || x === SPOT.postT1b ? 't1' : 't2';
    dark.lights.push({ x, y: floorOf(t, x) - 30, r: 34, k: 0.5 });
  }
  for (const [x, t] of [[SPOT.postT3a, 't3'], [SPOT.postT3b, 't3'], [SPOT.postT4, 't4']] as const) dark.lights.push({ x, y: floorOf(t, x) - 30, r: 34, k: 0.5 });
  // the ghost fungi of the fungus hall (and a few deeper down)
  const glowPx: { x: number; y: number; k: number }[] = [];
  const fungi = (x: number, tier: string, n: number) => {
    const s = paintFungi(1300 + x, n);
    const y = floorOf(tier, x) + 1;
    main.add(new Prop(local.add(`dc:fungi:${x}`, s.buf, s.ax, s.ay), x, y, -4.2));
    for (const [gx, gy] of s.glow) if ((gx + gy) % 2 === 0) glowPx.push({ x: x - s.ax + gx, y: y - s.ay + gy, k: 0.5 });
    dark.lights.push({ x, y: y - 8, r: 30, k: 0.62 });
  };
  for (let x = SPOT.fungus[0]; x < SPOT.fungus[1]; x += rng.range(48, 90)) if (clear(x, 20)) fungi(x, 't2', 3 + rng.int(0, 3));
  for (const [x, t] of [[1080, 't3'], [1640, 't3'], [2010, 't3'], [260, 't4'], [560, 't4'], [1400, 'g']] as const) fungi(x, t, 3);
  // crystals: the gallery's walls of them (and the sample cluster)
  const crystal = (x: number, tier: string, size: number, tint: string, k = 0.86) => {
    const s = paintCrystals(1700 + x, size, tint);
    const y = floorOf(tier, x) + 2;
    main.add(new Prop(local.add(`dc:crys:${x}`, s.buf, s.ax, s.ay), x, y, -4.3));
    for (const [gx, gy] of s.glow) if ((gx * 3 + gy) % 4 === 0) glowPx.push({ x: x - s.ax + gx, y: y - s.ay + gy, k: 0.8 });
    dark.lights.push({ x, y: y - size * 0.5, r: 30 + size * 1.2, k });
  };
  for (const [x, sz, tint] of [[1360, 18, '#7ae8ff'], [1450, 26, '#9a8cff'], [SPOT.crystals, 30, '#7ae8ff'], [1730, 20, '#c08cff'], [1560, 14, '#7affc8']] as const) crystal(x, 'g', sz, tint);
  crystal(1960, 't3', 12, '#7ae8ff', 0.6);
  main.add(new Custom(-4, (rr, s2) => {
    const vx0 = rr.wx(0) - 4, vx1 = rr.wx(rr.VW) + 4, vy0 = rr.wy(0) - 4, vy1 = rr.wy(rr.VH) + 4;
    for (const g of glowPx) {
      if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
      const k = 0.7 + 0.3 * Math.sin(s2.time * 1.1 + g.x * 0.3 + g.y * 0.2);
      rr.fxRect(g.x, g.y, 1, 1, g.k > 0.6 ? packColor(0.55, 0.9, 1, 1) : packColor(0.55, 1, 0.6, 1), g.k * 1.3 * k, true);
    }
  }));

  // ---------------------------------------------------------------- the bottom: the falls, the camp, the pole
  const falls = new Waterfall(f);
  main.add(falls);
  gw(FALLS.x - 30, FALLS.top - 10, 14, 30);
  gw(FALLS.x + 60, 1300, 10, 24);
  {
    const s = paintCamp(41);
    main.add(new Prop(local.add('dc:camp', s.buf, s.ax, s.ay), SPOT.camp, floorOf('t4', SPOT.camp) + 2, -3.5));
    const j = paintJournal();
    main.add(new Prop(local.add('dc:journal', j.buf, j.ax, j.ay), SPOT.journal, floorOf('t4', SPOT.journal) + 1, -3));
    const pl = paintPole(46);
    main.add(new Prop(local.add('dc:pole', pl.buf, pl.ax, pl.ay), SPOT.pole, floorOf('t4', SPOT.pole) + 2, -2.5));
  }
  // the hide by the shore: a fallen block of the roof, in front of the walk line
  const hides: CaveRuntime['hides'] = [];
  {
    const s = sprite('dc:hide', () => paintBoulder(808, 44, 30));
    const y = floorOf('t4', SPOT.hide) + 6;
    if (s) {
      main.add(new Prop(s.f, SPOT.hide, y, 66));
      f.occluders.push({ mask: s.s.buf, x: SPOT.hide, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x: SPOT.hide, y: floorOf('t4', SPOT.hide), w: 18 });
    hides.push({ x: SPOT.hide, w: 30, y: floorOf('t4', SPOT.hide), cover: 0.9 });
  }

  // ---------------------------------------------------------------- the dark, and Mori's lantern
  dark.twilight = { x0: -60, x1: 430, y0: -80, y1: 260, k: 0.95 };
  const extra: CaveRuntime['extra'] = [];
  const lampLight: CaveLight = { x: 0, y: 0, r: 0, k: 1, flick: 1 };
  const lanternAt = (): [number, number] => {
    const p = f.player;
    if (p.state === 'climb') return [p.x + 5, p.y - 40];
    return [p.x + p.facing * 7, p.y - (p.crouch ? 18 : 26)];
  };
  dark.dyn = () => {
    const out: CaveLight[] = [];
    const R = lampR();
    if (R > 0) { const [x, y] = lanternAt(); lampLight.x = x; lampLight.y = y + 4; lampLight.r = R; out.push(lampLight); }
    for (const e of extra) { const L = e(); if (L) out.push(L); }
    return out;
  };
  main.add(new Custom(52, (rr, s2) => {
    if (LAMP.mode === 'pole') return;
    const [x, y] = lanternAt();
    const fr = lanternFrames();
    rr.draw(LAMP.mode === 'dim' ? fr.shut : fr.open, Math.round(x), Math.round(y), 1, 1, 0, WHITE);
    drawLanternGlow(rr, x, y, LAMP.mode, s2.time);
  }));
  main.add(new CaveBugs(f, (x, y) => CAVE_CTX.lit(x, y), () => (LAMP.mode === 'pole' ? null : lanternAt())));
  main.add(dark);
  main.add(new Custom(0, () => {}, dt => dark.update(dt)));

  // ---------------------------------------------------------------- POIs for the wildlife
  for (const t of TIERS) for (let x = t.x0 + 40; x < t.x1 - 30; x += 120) {
    f.pois.push({ kind: 'trunk', x, y: t.floor(x) - 4, y1: t.floor(x) - Math.min(90, t.height(x) - 10) });
  }

  // ---------------------------------------------------------------- the light
  st.envHook = (env: Env) => {
    env.ambientTop = [0.36, 0.37, 0.46];
    env.ambientBottom = [0.3, 0.31, 0.38];
    env.fogTop = [0.02, 0.02, 0.03];
    env.fogBottom = [0.02, 0.025, 0.035];
    env.bloom = 0.42; env.bloomThreshold = 0.62;
    env.vignette = 0.5;
    env.saturation = 0.92;
    const p = f.player;
    env.waterAxis = p && p.y > 1450 ? LAKE.top - 1 : null;
    env.waterTint = [0.2, 0.36, 0.42];
  };

  // ---------------------------------------------------------------- the crossroads
  registerPosts(f, posts());
  const run: CaveRuntime = {
    clock, dark, water, glow, limits, hides, extra,
    lantern: () => (LAMP.mode === 'pole' ? null : lanternAt()),
    enter: fs => enterCave(fs, run),
    update: (fs, dt) => tick(fs, dt, run),
  };
  return run;
}

// ---------------------------------------------------------------- arriving
let placeKey = '';
let seenTier = new Set<string>();
let stillT = 0, coldT = 0, dripT = 2, chuteT = 0, toldSqueeze = false, toldLamp = false, toldCold = 0;
function enterCave(f: FieldScene, run: CaveRuntime) {
  const p = f.player;
  for (const h of run.hides) if (!p.hides.some(q => q.x === h.x)) p.hides.push(h);
  // no headlamp cone: the storm lantern is the light down here
  f.lampOn = false;
  LAMP.mode = 'bright'; LAMP.auto = false;
  placeKey = ''; seenTier = new Set(); stillT = 0; coldT = 0; toldSqueeze = false; toldCold = 0;
  const cam = f.st.cam;
  cam.zoom = cam.tzoom = DC.zoom;
  cam.y = cam.ty = p.y - 36;
  // Aroha stays at the mouth with the spare rope: she won't go down there
  const g = f.guide;
  if (g) {
    f.guide = null;
    const a = g.a;
    a.x = SPOT.aroha; a.y = floorOf('t0', SPOT.aroha);
    a.idleAnim = 'staff'; a.setAnim('staff'); a.faceTo(400);
    run.extra.push(() => ({ x: a.x + 6, y: a.y - 24, r: 46, k: 0.7, flick: 1 }));
    if (!game.save.flags['dc:arohaWaits']) {
      game.save.flags['dc:arohaWaits'] = true;
      setTimeout(() => { if (game.scene === f) void floatText({ actor: a, text: 'I\'ll wait here with the spare rope. Koro says nobody comes back up from Te Rua Pōuri the same. Back before dark, Mori. I mean it.', style: 'whisper', ms: 4200 }); }, 2200);
    }
  }
  setTimeout(() => {
    if (game.scene !== f) return;
    if (!game.save.flags['dc:arrived']) {
      game.save.flags['dc:arrived'] = true;
      game.persist();
      void floatText({ text: 'Te Rua Pōuri. The dark pit. Lantern on. Okay. Okay okay okay.', style: 'scared', ms: 2800 });
    }
  }, 900);
  audio.setAmbience('none', false);
  ambFalls = false;
  attachLife(f, run);
}

// ---------------------------------------------------------------- every frame
function tick(f: FieldScene, dt: number, run: CaveRuntime) {
  const p = f.player;
  if (!p || !(dt > 0)) return;
  run.clock.update(dt);
  const tod = todOf(run.clock.t);
  if (tod !== f.tod) { f.tod = tod; f.night = tod === 'night'; f.insects.night = f.night; }
  run.dark.twilight!.k = tod === 'night' ? 0.32 : tod === 'dusk' || tod === 'dawn' ? 0.7 : 0.95;
  const free = !f.cutscene && !game.ui.blocking;
  const ty = p.y;
  // ---- the camera: close in the passages, wider over the lake, following Mori down and up
  const cam = f.st.cam;
  const atLake = ty > 1600;
  if (!cam.locked && !f.cam.active) {
    cam.tzoom = damp(cam.tzoom, atLake ? 1.18 : p.state === 'climb' ? 1.32 : DC.zoom, 2.5, dt);
    cam.ty = ty - (p.state === 'climb' ? 20 : 38);
  }
  // ---- how far Mori may walk on what he stands on (the rock walls of each tier)
  if (!f.cutscene && p.onGround && p.surface) {
    const lim = run.limits.get(p.surface);
    if (lim) { p.minX = lim[0]; p.maxX = lim[1]; }
  }
  // ---- the lantern: L shutters / opens it; crouching still shutters it by itself
  if (free && LAMP.mode !== 'pole') {
    if (game.input.keyHit('KeyL')) { LAMP.mode = LAMP.mode === 'bright' ? 'dim' : 'bright'; LAMP.auto = false; audio.play('lanternOn', { vol: 0.35, pitch: LAMP.mode === 'dim' ? 0.8 : 1.1 }); }
    const still = p.crouch && Math.abs(p.vx) < 5 && p.onGround;
    stillT = still ? stillT + dt : 0;
    if (stillT > 1.2 && LAMP.mode === 'bright') {
      LAMP.mode = 'dim'; LAMP.auto = true;
      audio.play('lanternOn', { vol: 0.25, pitch: 0.75 });
      if (!toldLamp) { toldLamp = true; floatNotice('Lantern shuttered. Stand up (or press L) to open it.', 2800, { tag: 'LAMP' }); }
    } else if (LAMP.auto && LAMP.mode === 'dim' && (!p.crouch || Math.abs(p.vx) > 12)) { LAMP.mode = 'bright'; LAMP.auto = false; audio.play('lanternOn', { vol: 0.25, pitch: 1.1 }); }
  }
  // ---- the squeeze: down on his knees, pushing the pack ahead
  const onT2 = Math.abs(ty - floorOf('t2', clamp(p.x, TIER.t2.x0, TIER.t2.x1))) < 10;
  const squeeze = onT2 && p.x > SPOT.squeeze[0] && p.x < SPOT.squeeze[1] && p.state === 'normal';
  if (squeeze) {
    p.wadeK = 0.55;
    p.crouch = true;
    p.anim = Math.abs(p.vx) > 3 ? 'crouchWalk' : 'crouch';
    if (Math.abs(p.vx) > 3 && rand.chance(dt * 1.2)) audio.play('rustle', { vol: 0.25, pitch: 0.6 });
    if (Math.abs(p.vx) > 3 && free) addHunger(dt * 0.00012, 'squeeze');
    if (!toldSqueeze) { toldSqueeze = true; void floatText({ text: rand.pick(['It\'s TIGHT. Pack in front. Breathe out. Wriggle.', 'If I get stuck here nobody will ever find me. Don\'t think about that.']), style: 'scared', ms: 2600 }); }
  } else if (p.wadeK === 0.55 && p.state !== 'swim') p.wadeK = 1;
  // ---- the scree: loose underfoot, slow going up, rattling down
  const onChute = p.onGround && p.x > 128 && p.x < 442 && Math.abs(ty - chuteY(p.x)) < 4;
  if (onChute && Math.abs(p.vx) > 5) {
    chuteT -= dt;
    p.wadeK = p.vx > 0 ? 0.62 : 0.9;
    if (chuteT <= 0) {
      chuteT = 0.25;
      audio.play('rustle', { vol: 0.25, pitch: 1.4 });
      for (let i = 0; i < 3; i++) f.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-4, 4), y: p.y - 1, vx: rand.range(-40, -10), vy: rand.range(-40, -10), ay: 300, life: 0.6, color: [0.5, 0.45, 0.4], alpha: 1, alpha1: 0.6, size: 0.5, size1: 0.5, floorY: p.y + 30 });
    }
  } else if (!squeeze && p.wadeK !== 1 && (p.wadeK === 0.62 || p.wadeK === 0.9)) p.wadeK = 1;
  // ---- the cold and the hunger: deeper is colder, and cold is hungry work
  const dk = depthK(ty);
  if (free) {
    addHunger(dt * (0.00006 + 0.00026 * dk), 'cold');
    coldT -= dt;
    if (dk > 0.4 && coldT <= 0) { coldT = rand.range(2.2, 3.6); const eyeY = p.y - p.height * 0.85; breathPuff(f, p.x + p.facing * 4, eyeY + 4, p.facing); }
    const lvl = dk > 0.85 ? 3 : dk > 0.55 ? 2 : dk > 0.3 ? 1 : 0;
    if (lvl > toldCold) {
      toldCold = lvl;
      const lines = ['', 'Colder down here. A LOT colder. I can see my breath.', 'My fingers are going numb. And I\'m starving. How am I starving?', 'Freezing. Everything down here is freezing. Except my stomach, which is furious.'];
      setTimeout(() => void floatText({ text: lines[lvl], style: 'scared', ms: 2600 }), 400);
    }
  }
  // ---- each new tier: a look at the pocket watch (how long down, how long back up)
  if (p.onGround && free) {
    const [n] = zoneAt(p.x, ty);
    const tier = TIERS.find(t => p.x >= t.x0 - 4 && p.x <= t.x1 + 4 && Math.abs(ty - floorOf(t.id, clamp(p.x, t.x0, t.x1))) < 8);
    if (tier && !seenTier.has(tier.id) && ['t2', 't3', 't4'].includes(tier.id)) {
      seenTier.add(tier.id);
      const h = hourNow(f);
      const late = h > DARK_HOUR - 3;
      showWatch({ mode: 'clock', hour: h, deadline: DARK_HOUR, anchor: 'mori', size: 28, hold: 4.5, red: late, shake: late ? 0.5 : 0 });
      const say = tier.id === 't4' ? `${cap(hourWords(h))}. The bottom. Every step down is a step I have to climb back up.` : late ? `${cap(hourWords(h))}. It's getting late up there. The climb out takes longer than the climb in.` : `${cap(hourWords(h))}. Deeper. Keep an eye on the time, Mori.`;
      setTimeout(() => void floatText({ text: say, style: late ? 'scared' : 'think', ms: 3000 }), 900);
    }
    // the place's name floats in the sky
    const [nn, sub] = zoneAt(p.x, ty);
    const key = nn + '|' + sub;
    if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(nn, `${sub} · Day ${game.save.day || 1}`); }
    void n;
  }
  // ---- the sound of the place: drips everywhere, the falls near the bottom
  dripT -= dt;
  if (dripT <= 0) { dripT = rand.range(1.2, 4); f.sfx('drip', p.x + rand.range(-200, 200), rand.range(0.15, 0.35), rand.range(0.8, 1.3)); }
  const nearFalls = Math.abs(p.x - FALLS.x) < 500 && ty > 1150;
  if (nearFalls !== ambFalls) { ambFalls = nearFalls; audio.setAmbience(nearFalls ? 'falls' : 'none', false); }
}
let ambFalls = false;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** for the dev points: where a tier's walk line is at x */
export const DC_POINTS = { ...SPOT };
void FALLS;

// V12 Te Rua Pōuri, the deep dark cave (the map and the walk lines: ./layout.ts). One tall scene: a
// section through the headland behind the glowworm cave, painted in limestone (src/art/v12/cave/rock.ts,
// its floors by src/art/v12/cave/floor.ts), tier under tier down to the black lake and on below it to
// the deepest chamber. The camera follows Mori down and up. It is dark: only what a light reaches can
// be seen (./dark.ts), and the deeper Mori goes the colder and hungrier he gets, and the longer the
// climb home. The way down is hard going and every piece of it is physical:
//
//   the choke        a boulder wedged in the mouth's narrows: heave it (a mash) and it rolls aside
//   crawls           low roofs: on hands and knees, the pack pushed ahead (slow)
//   the crack        across the mouth's floor: jump it, or fall in and scramble out
//   scrambles        hand over hand up the steps too high to jump: the chimney and the breakdown pile
//                    in the wētā hall are hard going (breath: the field watch's ring)
//   loose roofs      a rattle, a trickle of grit, then a rock comes down: wait for it, then go
//   the gear         the rope (the pitches), grip soles (the wet flowstone wall below the lake), grip
//                    gloves (the crystal squeeze), trail boots (the mud slope), a wetsuit or a snorkel
//                    (the sump): each way shows what it is, and Mori says what he'd need
//
// Who lives here: ./bugs.ts (wētā on the walls, glowworms, harvestmen, centipedes, moths at the mouth,
// springtails on the pools), ./species.ts (the blind salamanders, the Ghost Gulper in the lake, the
// salamanders' nursery in the deepest chamber). What to find and do: ./quests.ts.

import type { FieldScene, SpawnV2 } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import { Terrain } from '../../../world/terrain';
import type { Surface } from '../../../world/terrain';
import { Prop, Custom } from '../../../world/props';
import { packColor, WHITE } from '../../../gfx/renderer';
import type { Env, Frame } from '../../../gfx/renderer';
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
import type { GateId } from '../gear';
import { addHunger } from '../hunger';
import { stamina, STAMINA_ZL } from '../stamina';
import { hitMori } from '../wilds';
import { sfx11 } from '../../v11/predators-sfx';
import { DARK_HOUR, hourWords } from '../clock';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { showWatch } from '../../../ui/v12/watch';
import { paintCaveRock, paintStalactite, paintStalagmite, paintCurtain, paintCrystals, paintFungi, paintBoulder, paintGuano, paintCamp, paintJournal, paintPole, paintLadder, paintPlanks, paintAnchor } from '../../../art/v12/cave/rock';
import { paintFlowWall, paintRubble, paintLooseRoof, paintScreeRamp, paintGiantCrystal, paintMudRock } from '../../../art/v12/cave/features';
import {
  DC, TIERS, TIER, HOLES, SOLIDS, LINKS, LINK, FLOW_KNOBS, PLANKS, CHUTE, CHUTE_FOOT, POOLS, chuteY, LAKE, FALLS, SPOT, STEPS, CRAWLS, LOOSE, GATEWALLS, CHOKE, CRACK, MUD, SUMP, NURSERY,
  floorOf, poolTop, climbOf, zoneAt, depthK, tierSurfaces, tierUnder, limitsAt, floorMatAt, lakeRoof,
} from './layout';
import type { Tier, CaveGate } from './layout';
import { Darkness, LAMP, lampR, lanternFrames, drawLanternGlow } from './dark';
import type { CaveLight } from './dark';
import { Waterfall, CaveWater, Glowworms, breathPuff } from './fx';
import { CaveBugs } from './bugs';
import { attachLife } from './life';
import { CAVE_POINTS } from './quests';
import { CAVE_CTX, NURSERY_EGGS } from './species';

const todOf = (t: number) => (t < 0.35 ? 'dawn' : t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night') as 'dawn' | 'day' | 'dusk' | 'night';
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { game.save.flags[k] = true; game.persist(); };

export interface CaveRuntime {
  clock: DayClock;
  dark: Darkness;
  water: CaveWater;
  glow: Glowworms;
  /** which tier each walk surface belongs to (the chute and the planks too) */
  tierOf: Map<Surface, string>;
  chute: Surface | null;
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

/** the cave's own gear: the sump takes a wetsuit or a mask and snorkel */
export const caveGearOk = (g: CaveGate) => (g === 'sump' ? gateOk('wetsuit') || gateOk('snorkel') : gateOk(g as GateId));
const GEAR_WORDS: Record<CaveGate, string> = { rope: GATES.rope.gear, grip: GATES.grip.gear, gloves: GATES.gloves.gear, boots: GATES.boots.gear, sump: 'a wetsuit, or a mask and snorkel' };
/** what Mori says at each shut way, in the cave's own words */
const WHY: Record<string, string> = {
  rope: GATES.rope.why,
  flow: 'Wet flowstone, smooth as soap, all the way down. In these soles I\'d slide straight off. Grip soles.',
  crystal: 'Crystal blades all the way through, sharp as broken glass. Crawl in there bare-handed? Not without grip gloves.',
  mud: 'Mud like grease, straight down into the dark. I\'d go down on my backside and never get back up. Trail boots, with real lugs.',
  sump: 'The passage goes UNDER the water. Black, freezing, and it keeps going. Not without a wetsuit. Or at least a mask and snorkel.',
};
const SAY_OK: Record<string, string> = {
  flow: 'Grip soles, don\'t fail me now. Toes in. Weight in. Slowly.',
  crystal: 'Gloves on. The crystals click against them like teeth. Don\'t. Touch. Your face.',
  mud: 'Trail boots: earning their keep. Heel in, heel in... don\'t sit down.',
  sump: 'Mask on. Big breath. The lantern\'s sealed... I hope. One... two... three...',
};

/** who lives here (the animals' minds: ./species.ts; the small life in swarms: ./bugs.ts) */
const fy = (tier: string, x: number) => floorOf(tier, x);
const ALLT = ['dawn', 'day', 'dusk', 'night'] as SpawnV2['times'];
export const CAVE_SPAWNS: SpawnV2[] = [
  // blind salamanders in every pool of the dark stream, the plunge pool, the gallery's pool and the nursery
  ...POOLS.filter(p => !p.kind || p.kind === 'pool' || p.kind === 'nursery').map((p): SpawnV2 => ({ species: 'blindsal', n: p.kind === 'nursery' ? [3, 3] : p.tier === 'g' ? [1, 1] : p.tier === 't4' ? [2, 2] : [2, 3], x: [p.x0 + 14, p.x1 - 14], y: poolTop(p) + 5, medium: 'water', times: ALLT, chance: 1 })),
  // the Ghost Gulper, deep in the lake
  { species: 'gulper', n: [1, 1], x: [1500, 1800], y: LAKE.top + 104, medium: 'water', times: ALLT, chance: 1 },
  // cave wētā on the walls (the swarms are drawn by ./bugs.ts; these ones can be photographed), and the
  // big one on the breakdown pile in the wētā hall that jumps at a bright lantern
  { species: 'caveweta', n: [2, 3], x: [240, 520], y: fy('t0', 400) - 34, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 2], x: [1220, 1500], y: fy('t0', 1300) - 34, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [2, 3], x: [740, 980], y: fy('t1', 860) - 44, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [2, 3], x: [1640, 1900], y: fy('t1', 1760) - 48, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 1], x: [SPOT.bigWeta - 4, SPOT.bigWeta + 4], y: fy('t1', SPOT.bigWeta) - 40, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 2], x: [1700, 2100], y: fy('t3', 1900) - 40, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 2], x: [880, 1100], y: fy('t5', 1000) - 30, medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'caveweta', n: [1, 2], x: [1780, 2000], y: fy('t5', 1880) - 70, medium: 'trunk', times: ALLT, chance: 1 },
  // harvestmen on the floors of the halls
  { species: 'harvestman', n: [2, 3], x: [760, 960], y: fy('t1', 860), medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'harvestman', n: [1, 2], x: [1540, 1700], y: fy('t2', 1600), medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'harvestman', n: [1, 2], x: [1380, 1520], y: fy('g', 1450), medium: 'trunk', times: ALLT, chance: 1 },
  { species: 'harvestman', n: [1, 2], x: [900, 1100], y: fy('t5', 1000), medium: 'trunk', times: ALLT, chance: 1 },
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

// ---------------------------------------------------------------- refusing, and the crossroads
function refuse(f: FieldScene, line: string) {
  audio.play('wrong', { vol: 0.4 });
  f.player.body.setExpr('thinking', 2);
  f.player.body.showEmote?.('question', 1.4);
  void floatText({ text: line, style: 'think', ms: 3400 });
}
async function climbFrom(f: FieldScene, x: number, tier: string, dir: 1 | -1, why = WHY.rope) {
  const p = f.player;
  await walkTo(f, x);
  if (Math.abs(p.x - x) > 10 || Math.abs(p.y - floorOf(tier, x)) > 14) return;
  const c = f.st.terrain.climbs.find(k => Math.abs(k.x - x) < 2);
  if (!c) { refuse(f, why); return; }
  await f.climbLadder({ x, y0: c.y0, y1: c.y1 }, dir);
}
async function walkTo(f: FieldScene, x: number) { await Promise.race([f.player.walkTo(x, 60), sleep(12000)]); }
const dim = (s: string) => `${s} <span style="opacity:.75">· the way down</span>`;
const outLbl = (s: string) => `${s} <span style="opacity:.75">· the way out</span>`;
const needs = (g: CaveGate) => (caveGearOk(g) ? '' : ` <span style="opacity:.75">(needs ${GEAR_WORDS[g]})</span>`);
function posts(): RegionPost[] {
  const L = LINK;
  return [
    { x: SPOT.postT0, y: TIER.t0.floor(SPOT.postT0), arms: [
      { info: 'TE KŪAHA', go: 1440, dir: 'left' },
      { tier: 'THE OLD LADDER', mark: 'down', dir: 'right', label: dim('Climb down the old caver\'s ladder into the wētā hall'), go: f => climbFrom(f, L.ladder0.x, 't0', 1) },
    ] },
    { x: SPOT.postT1b, y: TIER.t1.floor(SPOT.postT1b), arms: [
      { tier: 'THE MOUTH', mark: 'up', dir: 'right', label: outLbl('Climb the old ladder back up to the mouth'), go: f => climbFrom(f, L.ladder0.x, 't1', -1) },
      { info: 'NGĀ WĒTĀ', go: 1640, dir: 'left' },
    ] },
    { x: SPOT.postT1a, y: TIER.t1.floor(SPOT.postT1a), arms: [
      { info: 'THE CHIMNEY', go: 680, dir: 'right' },
      { tier: 'THE SCREE CHUTE', mark: 'down', dir: 'left', label: dim('Down the scree chute, carefully'), go: async f => { await walkTo(f, 446); await walkTo(f, 150); } },
    ] },
    { x: SPOT.postT2a, y: TIER.t2.floor(SPOT.postT2a), arms: [
      { tier: 'THE SCREE CHUTE', mark: 'up', dir: 'left', label: outLbl('Scramble back up the scree'), go: f => scramble(f) },
      { info: 'THE SQUEEZE', go: 540, dir: 'right' },
    ] },
    { x: SPOT.postT2b, y: TIER.t2.floor(SPOT.postT2b), arms: [
      { info: 'TE HARORE', go: 1100, dir: 'left' },
      { info: 'THE ROPE PITCH', go: 1860, dir: 'right' },
      { tier: 'CRYSTAL GALLERY', mark: 'down', dir: 'right', label: dim('Down the caver\'s ladder under the planks'), go: f => climbFrom(f, L.ladderG.x, 't2', 1) },
    ] },
    { x: SPOT.postT2c, y: TIER.t2.floor(SPOT.postT2c), arms: [
      { info: 'TE HARORE', go: 1960, dir: 'left' },
      { tier: 'THE ROPE PITCH', mark: 'down', dir: 'right', get label() { return dim('Rope down the pitch to the dark stream') + needs('rope'); }, go: f => climbFrom(f, L.pitch.x, 't2', 1) },
    ] },
    { x: SPOT.postT3a, y: TIER.t3.floor(SPOT.postT3a), arms: [
      { tier: 'THE ROPE PITCH', mark: 'up', dir: 'right', label: outLbl('Climb the rope back up'), go: f => climbFrom(f, L.pitch.x, 't3', -1) },
      { info: 'TE AWA PŌURI', go: 1960, dir: 'left' },
    ] },
    { x: SPOT.postT3b, y: TIER.t3.floor(SPOT.postT3b), arms: [
      { info: 'TE AWA PŌURI', go: 1080, dir: 'right' },
      { tier: 'THE WET PITCH', mark: 'down', dir: 'left', get label() { return dim('Rope down beside the falls') + needs('rope'); }, go: f => climbFrom(f, L.wetA.x, 't3', 1) },
    ] },
    { x: SPOT.postT4, y: TIER.t4.floor(SPOT.postT4), arms: [
      { tier: 'THE WET PITCH', mark: 'up', dir: 'left', label: outLbl('Climb the ropes back up beside the falls'), go: f => climbFrom(f, L.wetC.x, 't4', -1) },
      { info: 'THE CAVER\'S CAMP', go: 330, dir: 'left' },
      { info: 'TE WAHA O TE PŌ', go: 760, dir: 'right' },
    ] },
    { x: SPOT.postT4w, y: TIER.t4.floor(SPOT.postT4w), arms: [
      { tier: 'TE PAKITARA WAI', mark: 'down', dir: 'left', get label() { return dim('Down the wet flowstone wall, under the lake') + needs('grip'); }, go: f => climbFrom(f, L.flow.x, 't4', 1, WHY.flow) },
      { info: 'THE LAKE', go: 700, dir: 'right' },
    ] },
    { x: SPOT.postT5, y: TIER.t5.floor(SPOT.postT5), arms: [
      { tier: 'THE SHORE', mark: 'up', dir: 'left', label: outLbl('Climb the flowstone back up to the lake shore'), go: f => climbFrom(f, L.flow.x, 't5', -1, WHY.flow) },
      { info: 'TE KŪITI TIOATA', go: 660, dir: 'right' },
    ] },
  ];
}

/** up the scree chute from its foot: a hop onto the scree, then the scramble up */
async function scramble(f: FieldScene) {
  const p = f.player;
  await walkTo(f, 162);
  if (Math.abs(p.x - 162) > 12 || Math.abs(p.y - floorOf('t2', 162)) > 14) return;
  onScree(f);
  void floatText({ text: rand.pick(['Two steps up, one step back. Scree is the WORST.', 'Hands and feet. Hands and feet.']), style: 'think', ms: 2200 });
  await walkTo(f, 446);
}
/** step from T2 onto the scree at its foot */
function onScree(f: FieldScene) {
  const p = f.player, c = rt?.chute;
  if (!c) return;
  const y = Terrain.yAt(c, p.x);
  if (y === null) return;
  p.y = y; p.surface = c; p.onGround = true; p.vy = 0;
  p.body.react('jump');
  audio.play('rustle', { vol: 0.4, pitch: 0.7 });
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
    const buf = paintCaveRock(x0, y0, w, h, HOLES, 4127, floorMatAt, SOLIDS);
    if (!buf) continue;
    main.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, x0, y0, -10));
  }
  // the scree ramp up the back wall of the scree hall (behind T2's walk line)
  {
    const s = paintScreeRamp(CHUTE.map(([x]) => [x, chuteY(x)] as [number, number]), 3311, x => TIER.t2.floor(Math.max(96, x)));
    main.add(new Prop(local.add('dc:ramp', s.buf, 0, 0), s.x0, s.y0, -9.4));
  }
  const water = new CaveWater(f);
  main.add(water);
  main.add(new Custom(62, (rr, s2) => water.front(rr, s2.time)));
  const glow = new Glowworms();
  main.add(glow);
  const dark = new Darkness();

  // ---------------------------------------------------------------- the terrain: every tier's walk lines
  const terr = st.terrain;
  const tierOf = new Map<Surface, string>();
  for (const t of TIERS) for (const s of tierSurfaces(t)) {
    if (s.piece.bridge) terr.addPlatform(s.pts, 'bridge'); else terr.addGround(s.pts, t.id === 't4' ? 'sand' as never : 'rock');
    tierOf.set(terr.surfaces[terr.surfaces.length - 1], t.id);
  }
  let chute: Surface | null = null;
  {
    const pts: [number, number][] = [];
    for (let x = CHUTE[0][0]; x < 440; x += 3) pts.push([x, chuteY(x)]);
    pts.push([440, TIER.t1.floor(440)]);
    terr.addGround(pts, 'rock');
    chute = terr.surfaces[terr.surfaces.length - 1];
    tierOf.set(chute, 'chute');
  }
  {
    const y = floorOf('t2', PLANKS.x0);
    const pl = paintPlanks(PLANKS.x1 - PLANKS.x0);
    main.add(new Prop(local.add('dc:planks', pl.buf, pl.ax, pl.ay), PLANKS.x0, y, -1.5));
  }
  // (the wet pitch's ledges are rock: layout.ts SOLIDS, painted with the cave)

  // ---------------------------------------------------------------- the ways down: ladders, ropes, the water wall
  const ok = (g?: CaveGate) => !g || caveGearOk(g);
  const climbIt = (c: { x: number; y0: number; y1: number }, kind: 'ladder' | 'rope' | 'vine', up: string, down: string, gate?: CaveGate, why = WHY.rope) => {
    const open = ok(gate);
    if (open) terr.addClimb(c.x, c.y0, c.y1, kind);
    (f.interact as Interactable[]).push({ x: c.x, y: c.y1, w: 14, h: 18, label: up, standX: c.x, enabled: () => open && f.player.state !== 'climb' && Math.abs(f.player.y - c.y1) < 12, action: () => f.climbLadder(c, -1) });
    (f.interact as Interactable[]).push({ x: c.x, y: c.y0, w: 14, h: 18, get label() { return open ? down : `${down}${gate ? needs(gate) : ''}`; }, standX: c.x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - c.y0) < 12, action: () => (open ? f.climbLadder(c, 1) : refuse(f, why)) });
    return open;
  };
  const ropes: { x: number; y0: number; y1: number }[] = [];
  const LBL: Record<string, [string, string]> = {
    ladder0: ['Climb the old ladder up to the mouth', 'Climb down the old ladder'],
    ladderG: ['Climb the ladder up through the planks', 'Climb down into the crystal gallery'],
    pitch: ['Climb the rope up the pitch', 'Rope down the pitch'],
    wetA: ['Climb the rope up beside the falls', 'Rope down beside the falls'],
    wetB: ['Climb the rope up beside the falls', 'Rope down beside the falls'],
    wetC: ['Climb the rope up beside the falls', 'Rope down beside the falls'],
    flow: ['Climb the wet flowstone up to the shore <span style="opacity:.75">· hard going</span>', 'Climb down the wet flowstone wall'],
  };
  for (const L of LINKS) {
    const c = climbOf(L);
    const kind = L.kind === 'flow' ? 'vine' : L.kind;
    const open = climbIt(c, kind, LBL[L.id][0], LBL[L.id][1], L.gate, L.kind === 'flow' ? WHY.flow : WHY.rope);
    if (L.kind === 'ladder') {
      const ld = paintLadder(Math.round(c.y1 - c.y0));
      main.add(new Prop(local.add('dc:ladder:' + L.id, ld.buf, ld.ax, ld.ay), c.x, c.y0 - 4, -1.6));
    } else if (L.kind === 'rope') {
      if (open) ropes.push(c);
      const an = paintAnchor();
      main.add(new Prop(local.add('dc:anchor', an.buf, an.ax, an.ay), c.x - 6, c.y0 + 1, -1.4));
    } else {
      // the water wall: a sheet of wet flowstone down the shaft's east face, with two bosses to rest on
      const s = paintFlowWall(5501, 30, Math.round(c.y1 - c.y0) + 8, FLOW_KNOBS.map(k => k - c.y0));
      main.add(new Prop(local.add('dc:flowwall', s.buf, s.ax, s.ay), c.x + 3, c.y0 - 2, -6));
    }
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
  // the scrambles: hand over hand up the risers (worn pale holds, a knotted old line on the long ones)
  const holds: { x: number; y0: number; y1: number; line: boolean }[] = [];
  for (const s of STEPS) {
    if (!s.climb) continue;
    const c = s.climb, low = s.dir > 0 ? 'right' : 'left';
    terr.addClimb(c.x, c.y0, c.y1, 'vine');
    const long = c.y1 - c.y0 > 40;
    const upL = long ? `Scramble up the rock <span style="opacity:.75">· hand over hand${c.hard >= 0.6 ? ', hard going' : ''}</span>` : 'Scramble up';
    (f.interact as Interactable[]).push({ x: c.x, y: c.y1, w: 12, h: 16, label: upL, standX: c.x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - c.y1) < 10 && Math.abs(f.player.x - c.x) < 14, action: () => f.climbLadder(c, -1) });
    (f.interact as Interactable[]).push({ x: c.x, y: c.y0, w: 10, h: 14, label: 'Climb down', standX: c.x, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - c.y0) < 8 && Math.abs(f.player.x - c.x) < 8, action: () => f.climbLadder(c, 1) });
    holds.push({ x: c.x + (low === 'right' ? -2 : 2), y0: c.y0, y1: c.y1, line: long });
  }
  main.add(new Custom(-1.35, rr => {
    const vy0 = rr.wy(0) - 10, vy1 = rr.wy(rr.VH) + 10, vx0 = rr.wx(0) - 10, vx1 = rr.wx(rr.VW) + 10;
    const pale = packColor(0.66, 0.62, 0.56, 0.75), dk = packColor(0.12, 0.1, 0.1, 0.8), rope = packColor(0.5, 0.4, 0.26, 1), ropeL = packColor(0.68, 0.56, 0.38, 1);
    for (const h of holds) {
      if (h.y1 < vy0 || h.y0 > vy1 || h.x < vx0 || h.x > vx1) continue;
      for (let y = h.y0 + 5, i = 0; y < h.y1 - 3; y += 7, i++) { const x = h.x - 2 + (i % 2) * 3; rr.rect(x, y, 2, 1, pale); rr.rect(x, y + 1, 2, 1, dk); }
      if (h.line) for (let y = h.y0 - 1; y < h.y1 - 2; y++) rr.rect(h.x + Math.round(Math.sin(y * 0.15) * 0.6), y, 1, 1, y % 9 === 0 ? ropeL : rope);
    }
  }));

  // ---------------------------------------------------------------- the rock's furniture
  const keep = [SPOT.postT0, SPOT.postT1a, SPOT.postT1b, SPOT.postT2a, SPOT.postT2b, SPOT.postT2c, SPOT.postT3a, SPOT.postT3b, SPOT.postT4, SPOT.postT4w, SPOT.postT5, ...LINKS.map(l => l.x), ...STEPS.map(s => s.x), CHOKE.x, CHOKE.rest];
  const clear = (x: number, rr2 = 26) => keep.every(k => Math.abs(k - x) > rr2);
  const inCrawl = (t: string, x: number, pad = 20) => CRAWLS.some(c => c.tier === t && x > c.x0 - pad && x < c.x1 + pad) || GATEWALLS.some(g => g.tier === t && Math.abs(g.x - x) < pad);
  for (const t of TIERS) {
    if (t.id === 'w1' || t.id === 'w2') continue;
    // stalactites down from the roof
    for (let x = t.x0 + 10; x < t.x1 - 6; x += rng.range(22, 70)) {
      const roof = t.roof(x);
      const len = Math.min(t.height(x) * 0.42, rng.range(8, 34) * (rng.chance(0.15) ? 1.8 : 1));
      if (len < 6 || inCrawl(t.id, x) || (t.id === 't5' && x > SUMP.x0 - 30 && x < SUMP.x1 + 10)) continue;
      const v = rng.int(0, 5);
      main.add(new Prop(frameOf(`sti:${v}:${Math.round(len / 4)}`, () => paintStalactite(300 + v * 13 + Math.round(len), Math.round(len), 4 + len * 0.22)), x, roof - 4, -6));
    }
    // stalagmites along the floor, behind the walk line
    for (let x = t.x0 + 30; x < t.x1 - 20; x += rng.range(60, 170)) {
      if (!clear(x) || inCrawl(t.id, x) || (t.id === 't5' && x > MUD.x0 - 20 && x < SUMP.x1 + 10)) continue;
      const hh = Math.min(t.height(x) * 0.5, rng.range(10, 36));
      if (hh < 8) continue;
      const v = rng.int(0, 5);
      main.add(new Prop(frameOf(`stm:${v}:${Math.round(hh / 4)}`, () => paintStalagmite(400 + v * 11 + Math.round(hh), Math.round(hh), 6 + hh * 0.4)), x, floorOf(t.id, x) + 2, -5.5));
    }
  }
  // rubble heaped at the foot of every step and riser (a step is a slab that broke away)
  for (const s of STEPS) {
    if (s.kind === 'walk') continue;
    const footX = s.x + s.dir * (s.kind === 'scramble' ? 16 : 10);
    const w = s.kind === 'scramble' ? 26 : 18, h = Math.min(14, Math.round((s.lo - s.hi) * 0.45) + 4);
    main.add(new Prop(frameOf(`rub:${s.tier}:${s.x}`, () => paintRubble(800 + s.x, w, h, floorMatAt(footX, s.lo))), footX, s.lo + 2, -4.8, { flip: s.dir < 0 }));
  }
  for (const [x, tier] of [[230, 't0'], [1290, 't0'], [1120, 't1'], [1440, 't1'], [1760, 't2'], [1840, 't2'], [1540, 't3'], [420, 't5']] as const) {
    main.add(new Prop(frameOf(`rubx:${x}`, () => paintRubble(900 + x, 22, 9, floorMatAt(x, floorOf(tier, x)))), x, floorOf(tier, x) + 2, -4.8));
  }
  // flowstone curtains high on the walls of the big rooms
  for (const [x, tier, w, hh] of [[1180, 't1', 40, 70], [1300, 't1', 30, 54], [900, 't1', 26, 30], [1220, 't2', 30, 46], [1600, 'g', 24, 34], [1500, 't3', 28, 38], [1860, 't5', 34, 60], [2080, 't5', 40, 74], [2260, 't5', 30, 56]] as const) {
    const t = TIER[tier];
    main.add(new Prop(frameOf(`cur:${x}:${tier}`, () => paintCurtain(500 + x, w, hh)), x, t.roof(x) + 2, -6.5));
  }
  for (const x of [1000, 1300, 1700, 2050, 2250]) main.add(new Prop(frameOf(`curL:${x}`, () => paintCurtain(600 + x, 30 + (x % 3) * 8, 50 + (x % 4) * 10)), x, lakeRoof(x) + 4, -6.5));
  // boulders
  for (const [x, tier, w, hh] of [[760, 't1', 34, 22], [1200, 't1', 26, 18], [1800, 't2', 30, 20], [1100, 't3', 24, 16], [1840, 't3', 36, 24], [600, 't4', 30, 22], [1000, 't5', 26, 16]] as const) {
    if (!clear(x)) continue;
    main.add(new Prop(frameOf(`bld:${x}`, () => paintBoulder(700 + x, w, hh)), x, floorOf(tier, x) + 3, -4.5));
  }
  // the bats' leavings under the roost at the mouth
  main.add(new Prop(frameOf('guano', () => paintGuano(5, 46)), SPOT.roost - 20, floorOf('t0', SPOT.roost - 20) + 2, -4));
  main.add(new Prop(frameOf('guano2', () => paintGuano(6, 30)), SPOT.roost + 40, floorOf('t0', SPOT.roost + 40) + 2, -4));
  // the mud slope: mud-caked rocks sunk in it, a trough where things have slid
  for (const [x, w, h] of [[1190, 18, 10], [1300, 24, 12], [1410, 16, 9]] as const) main.add(new Prop(frameOf(`mudr:${x}`, () => paintMudRock(950 + x, w, h)), x, floorOf('t5', x) + 3, -4.6));

  // ---------------------------------------------------------------- lights: glowworms, fungi, crystals
  const gw = (x: number, y: number, n: number, spread = 18) => { const c = glow.add(x, y, n, 900 + Math.round(x * 3 + y), spread); dark.lights.push(c.light); return c; };
  const roofAt = (tier: string, x: number) => TIER[tier].roof(x) + 1;
  for (const x of [260, 420, 560, 1260, 1480]) gw(x, roofAt('t0', x), 8);
  for (const x of [760, 1040, 1320, 1600, 1840]) gw(x, roofAt('t1', x), 10, 22);
  for (const x of [220, 380, 1500, 1700, 2000]) gw(x, roofAt('t2', x), 8);
  for (let x = 820; x < 2260; x += rng.range(90, 160)) gw(x, roofAt('t3', x), 12, 22);
  for (const x of [240, 600, 1000]) gw(x, roofAt('t5', x), 7, 16);
  // (a colony over every pool: the water and what lives in it sit in their faint blue light)
  for (const q of POOLS) {
    if (q.kind === 'sump') continue;
    const mx = (q.x0 + q.x1) / 2; const c = gw(mx, roofAt(q.tier, mx), 16, (q.x1 - q.x0) * 0.35);
    c.light.y = poolTop(q) - 6; c.light.r = (q.x1 - q.x0) * 0.62; c.light.k = 0.5;
  }
  // the glowworm sky over the lake
  for (let x = 440; x < 2360; x += rng.range(34, 70)) gw(x, Math.round(lakeRoof(x)) + 6, 10 + rng.int(0, 10), 26);
  for (const x of [SPOT.postT0, SPOT.postT1a, SPOT.postT1b, SPOT.postT2a, SPOT.postT2b, SPOT.postT2c]) {
    const t = x === SPOT.postT0 ? 't0' : x === SPOT.postT1a || x === SPOT.postT1b ? 't1' : 't2';
    dark.lights.push({ x, y: floorOf(t, x) - 30, r: 34, k: 0.5 });
  }
  for (const [x, t] of [[SPOT.postT3a, 't3'], [SPOT.postT3b, 't3'], [SPOT.postT4, 't4'], [SPOT.postT4w, 't4'], [SPOT.postT5, 't5']] as const) dark.lights.push({ x, y: floorOf(t, x) - 30, r: 34, k: 0.5 });
  // the ghost fungi of the fungus hall (and a few deeper down)
  const glowPx: { x: number; y: number; k: number }[] = [];
  const fungi = (x: number, tier: string, n: number) => {
    const s = paintFungi(1300 + x, n);
    const y = floorOf(tier, x) + 1;
    main.add(new Prop(local.add(`dc:fungi:${x}:${tier}`, s.buf, s.ax, s.ay), x, y, -4.2));
    for (const [gx, gy] of s.glow) if ((gx + gy) % 2 === 0) glowPx.push({ x: x - s.ax + gx, y: y - s.ay + gy, k: 0.5 });
    dark.lights.push({ x, y: y - 8, r: 30, k: 0.62 });
  };
  for (let x = SPOT.fungus[0]; x < SPOT.fungus[1]; x += rng.range(48, 90)) if (clear(x, 20)) fungi(x, 't2', 3 + rng.int(0, 3));
  for (const [x, t] of [[1080, 't3'], [1640, 't3'], [2010, 't3'], [300, 't4'], [560, 't4'], [1400, 'g'], [460, 't5'], [1060, 't5']] as const) fungi(x, t, 3);
  // crystals: the gallery's walls of them (and the sample cluster), the crystal squeeze, the deepest chamber
  const crystal = (x: number, tier: string, size: number, tint: string, k = 0.86, down = false) => {
    const s = paintCrystals(1700 + x + (down ? 77 : 0), size, tint, { down });
    const y = down ? TIER[tier].roof(x) - 3 : floorOf(tier, x) + 2;
    main.add(new Prop(local.add(`dc:crys:${x}:${tier}:${down ? 'd' : 'u'}`, s.buf, s.ax, s.ay), x, y, -4.3));
    for (const [gx, gy] of s.glow) if ((gx * 3 + gy) % 4 === 0) glowPx.push({ x: x - s.ax + gx, y: y - s.ay + gy, k: 0.8 });
    dark.lights.push({ x, y: down ? y + size * 0.5 : y - size * 0.5, r: 30 + size * 1.2, k });
  };
  for (const [x, sz, tint] of [[1360, 18, '#7ae8ff'], [1450, 26, '#9a8cff'], [SPOT.crystals, 30, '#7ae8ff'], [1740, 20, '#c08cff'], [1560, 14, '#7affc8']] as const) crystal(x, 'g', sz, tint);
  crystal(1960, 't3', 12, '#7ae8ff', 0.6);
  // the crystal squeeze: blades up from the floor and down from the roof, all the way through
  for (let x = CRAWLS[2].x0 + 6, i = 0; x < CRAWLS[2].x1; x += 22 + (i % 3) * 7, i++) {
    crystal(x, 't5', 9 + (i % 4) * 2, i % 3 === 0 ? '#9a8cff' : '#7ae8ff', 0.5, false);
    crystal(x + 11, 't5', 8 + ((i + 2) % 4) * 2, i % 2 ? '#7ae8ff' : '#c08cff', 0.45, true);
  }
  // the deepest chamber: blades taller than Mori, and a forest of small ones, all glowing
  const giants: [number, number, string][] = [[1770, 80, '#74d8ec'], [1880, 120, '#8c80ea'], [2010, 70, '#70e6bc'], [SPOT.giant, 150, '#74d8ec'], [2350, 96, '#b484e8']];
  for (const [x, h, tint] of giants) {
    const s = paintGiantCrystal(6100 + x, h, tint);
    const y = floorOf('t5', x) + 4;
    main.add(new Prop(local.add(`dc:giant:${x}`, s.buf, s.ax, s.ay), x, y, -5.2));
    for (const [gx, gy] of s.glow) if ((gx + gy * 2) % 5 === 0) glowPx.push({ x: x - s.ax + gx, y: y - s.ay + gy, k: 0.8 });
    dark.lights.push({ x, y: y - h * 0.45, r: 50 + h * 0.6, k: 0.78 });
  }
  for (const [x, sz, tint] of [[1730, 14, '#7ae8ff'], [1800, 10, '#9a8cff'], [1830, 18, '#c08cff'], [1920, 12, '#7affc8'], [1950, 16, '#7ae8ff'], [2050, 10, '#7ae8ff'], [2120, 12, '#7affc8'], [2180, 20, '#9a8cff'], [2240, 14, '#7ae8ff'], [2330, 16, '#7ae8ff']] as const) crystal(x, 't5', sz, tint, 0.7);
  for (const [x, sz, tint] of [[1740, 16, '#7affc8'], [1760, 22, '#7ae8ff'], [1840, 14, '#c08cff'], [1960, 26, '#9a8cff'], [2060, 18, '#7ae8ff'], [2150, 30, '#7ae8ff'], [2230, 16, '#9a8cff'], [2300, 22, '#7affc8'], [2360, 18, '#7ae8ff']] as const) crystal(x, 't5', sz, tint, 0.6, true);
  main.add(new Custom(-4, (rr, s2) => {
    const vx0 = rr.wx(0) - 4, vx1 = rr.wx(rr.VW) + 4, vy0 = rr.wy(0) - 4, vy1 = rr.wy(rr.VH) + 4;
    for (const g of glowPx) {
      if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
      const k = 0.7 + 0.3 * Math.sin(s2.time * 1.1 + g.x * 0.3 + g.y * 0.2);
      rr.fxRect(g.x, g.y, 1, 1, g.k > 0.6 ? packColor(0.55, 0.9, 1, 1) : packColor(0.55, 1, 0.6, 1), g.k * 1.3 * k, true);
    }
  }));
  // the nursery pool glows from below (the crystals under its water)
  dark.lights.push({ x: (NURSERY.x0 + NURSERY.x1) / 2, y: poolTop(NURSERY) - 4, r: 96, k: 0.72 });
  // the salamanders' eggs: clutches of big pale eggs tucked against the rimstone on the pool's bed,
  // each with a dark speck of an embryo, glowing faintly in the crystal light
  {
    const eggs: [number, number, number][] = [];
    const er = new Rng(5150);
    for (const ex of NURSERY_EGGS) for (let i = 0; i < 6; i++) { const x = Math.round(ex + er.range(-7, 7)); eggs.push([x, floorOf('t5', x) - 1 - (i % 3 === 2 ? 2 : 0), er.int(0, 3)]); }
    const shell = packColor(0.86, 0.9, 0.86, 1), shellD = packColor(0.6, 0.68, 0.66, 1), emb = packColor(0.36, 0.3, 0.3, 1);
    main.add(new Custom(-2.6, (rr, s2) => {
      if (rr.wx(rr.VW) < NURSERY.x0 - 10 || rr.wx(0) > NURSERY.x1 + 10 || rr.wy(rr.VH) < poolTop(NURSERY) - 20 || rr.wy(0) > poolTop(NURSERY) + 30) return;
      for (const [x, y, v] of eggs) {
        rr.rect(x - 1, y - 2, 3, 3, shell); rr.rect(x + 1, y, 1, 1, shellD); rr.rect(x - 1, y, 1, 1, shellD);
        if (v) rr.rect(x, y - 1, 1, 1, emb);
        rr.fxRect(x, y - 2, 1, 1, packColor(0.7, 1, 0.9, 1), 0.5 + 0.3 * Math.sin(s2.time * 1.3 + x), true);
      }
    }));
  }

  // ---------------------------------------------------------------- the bottom of the lake: the falls, the camp, the pole
  const falls = new Waterfall(f);
  main.add(falls);
  gw(FALLS.x - 30, FALLS.top - 10, 14, 30);
  gw(FALLS.x + 60, FALLS.top + 110, 10, 24);
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

  // ---------------------------------------------------------------- the obstacles
  buildChoke(f);
  const loose = buildLoose(f);
  buildGates(f);
  buildSump(f, water);
  buildDrips(f, water);

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
    const nearLake = p && p.y > LAKE.top - 120 && p.y < LAKE.top + 60 && p.x > 300;
    env.waterAxis = nearLake ? LAKE.top - 1 : null;
    env.waterTint = [0.2, 0.36, 0.42];
  };

  // ---------------------------------------------------------------- the crossroads
  registerPosts(f, posts());
  // the foot of the scree: step onto it
  (f.interact as Interactable[]).push({
    x: 162, y: floorOf('t2', 162), w: 14, h: 20, standX: 162, label: 'Scramble up the scree chute',
    enabled: () => f.player.state !== 'climb' && rt?.chute !== f.player.surface && Math.abs(f.player.y - floorOf('t2', 162)) < 10,
    action: () => scramble(f),
  });
  const run: CaveRuntime = {
    clock, dark, water, glow, tierOf, chute, hides, extra,
    lantern: () => (LAMP.mode === 'pole' ? null : lanternAt()),
    enter: fs => enterCave(fs, run),
    update: (fs, dt) => { tick(fs, dt, run); loose(fs, dt); },
  };
  return run;
}

// ---------------------------------------------------------------- the choke
function buildChoke(f: FieldScene) {
  const y0 = floorOf('t0', CHOKE.x);
  const s = paintBoulder(4407, CHOKE.w, CHOKE.h);
  const fr: Frame = local.add('dc:choke', s.buf, Math.round(s.buf.w / 2), Math.round(s.buf.h / 2));
  const moved = () => F('dc:choke');
  // its rolling: 0 wedged .. 1 come to rest in the hollow past the narrows
  let roll = moved() ? 1 : 0, rolling = false;
  const at = (k: number): [number, number, number] => {
    const x = CHOKE.x + (CHOKE.rest - CHOKE.x) * (1 - (1 - k) * (1 - k));
    const fl = floorOf('t0', x);
    const bounce = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 6;
    return [x, fl - s.buf.h / 2 + 3 - bounce + k * 2, (x - CHOKE.x) / (CHOKE.w * 0.45)];
  };
  const tint = packColor(0.62, 0.62, 0.66, 1);
  f.main.add(new Custom(66, rr => {
    if (roll >= 1 && !rolling) return;
    const [x, y, a] = at(roll);
    rr.draw(fr, Math.round(x), Math.round(y), 1, 1, a, WHITE);
  }, dt => {
    if (!rolling) return;
    roll = Math.min(1, roll + dt / 1.25);
    if (roll >= 1) {
      rolling = false;
      f.st.shake(3, 0.4);
      sfx11('thud', { x: CHOKE.rest, vol: 0.9, pitch: 0.6 });
      for (let i = 0; i < 18; i++) f.main.particles.spawn({ frame: A.dot2, x: CHOKE.rest + rand.range(-24, 24), y: floorOf('t0', CHOKE.rest) - rand.range(0, 8), vx: rand.range(-40, 40), vy: rand.range(-50, -10), ay: 120, life: rand.range(0.8, 1.6), color: [0.5, 0.46, 0.42], alpha: 0.7, alpha1: 0, size: 0.8, size1: 1.6 });
    }
  }));
  // at rest it sits back off the path, in the hollow (behind Mori, a little darker)
  f.main.add(new Custom(-4.5, rr => {
    if (roll < 1 || rolling) return;
    const [x, y, a] = at(1);
    rr.draw(fr, Math.round(x), Math.round(y) - 2, 0.94, 0.94, a, tint);
  }));
  const heave = async () => {
    if (moved() || rolling) return;
    const p = f.player;
    p.facing = 1;
    const Q = await import('../qte');
    const res = await Q.qte({ kind: 'mash', label: 'HEAVE!', difficulty: 0.48, count: 11, time: 5, f, x: CHOKE.x - 6, y: y0 - 56, pose: 'pull' });
    addHunger(0.004, 'heave');
    STAMINA_ZL.set(Math.max(0, stamina() - 0.25));
    if (!res.ok) {
      sfx11('thud', { x: CHOKE.x, vol: 0.4, pitch: 0.8 });
      void floatText({ text: rand.pick(['Ngh... it rocked. It MOVED. Again.', 'Heavier than it looks. Lower. Push with the legs.', 'It\'s jammed on something. Rock it. Rock it...']), style: 'say', ms: 2200 });
      return;
    }
    rolling = true;
    setF('dc:choke');
    audio.play('rustle', { vol: 0.6, pitch: 0.5 });
    sfx11('crack', { x: CHOKE.x, vol: 0.5, pitch: 0.7 });
    f.st.shake(1.5, 0.6);
    setTimeout(() => void floatText({ text: 'It\'s GOING... it\'s going... GONE. Ha! Te Rua Pōuri: nil. Mori: one.', style: 'happy', ms: 2600 }), 700);
  };
  for (const side of [-1, 1] as const) {
    const x = side < 0 ? CHOKE.wall - 4 : CHOKE.x + CHOKE.w / 2 + 6;
    (f.interact as Interactable[]).push({ x: side < 0 ? CHOKE.x - 12 : CHOKE.x + 12, y: floorOf('t0', x), w: 16, h: 30, standX: x, label: 'Heave the wedged boulder <span style="opacity:.75">· put your back into it</span>', enabled: () => !moved() && !rolling && f.player.state !== 'climb', action: heave });
  }
}

// ---------------------------------------------------------------- loose roofs: the tell, then the rock
interface Fall { x: number; y: number; vy: number; floor: number; a: number; va: number; fr: Frame }
function buildLoose(f: FieldScene): (f: FieldScene, dt: number) => void {
  const zones = LOOSE.map(z => ({ ...z, cool: rand.range(0.5, 1.5), tell: 0, tx: 0, n: 0 }));
  const falls: Fall[] = [];
  const grit: { x: number; y: number; vy: number; floor: number }[] = [];
  const frs = [0, 1, 2].map(i => { const s = paintBoulder(7700 + i * 13, 9 + i * 2, 8 + i); return local.add(`dc:fallrock:${i}`, s.buf, Math.round(s.buf.w / 2), Math.round(s.buf.h / 2)); });
  for (const z of LOOSE) {
    const t = TIER[z.tier];
    for (let x = z.x0 + 8, i = 0; x < z.x1; x += 30 + (i % 2) * 12, i++) {
      const s = paintLooseRoof(8800 + x, 22 + (i % 3) * 6, 12 + (i % 2) * 5);
      f.main.add(new Prop(local.add(`dc:loose:${x}`, s.buf, s.ax, s.ay), x, t.roof(x) - 2, -5.8));
    }
  }
  let told = false;
  const col = packColor(0.62, 0.56, 0.5, 1);
  f.main.add(new Custom(40, rr => {
    for (const g of grit) rr.rect(Math.round(g.x), Math.round(g.y), 1, 1, col);
    for (const r of falls) rr.draw(r.fr, Math.round(r.x), Math.round(r.y), 1, 1, r.a, WHITE);
  }));
  return (fs, dt) => {
    const p = fs.player;
    if (!p || !(dt > 0) || fs.cutscene) return;
    for (const z of zones) {
      const t = TIER[z.tier];
      const under = p.x > z.x0 - 24 && p.x < z.x1 + 24 && Math.abs(p.y - floorOf(z.tier, clamp(p.x, t.x0, t.x1))) < 30;
      if (z.tell > 0) {
        z.tell -= dt;
        if (rand.chance(dt * 30)) grit.push({ x: z.tx + rand.range(-5, 5), y: t.roof(z.tx) + 2, vy: rand.range(20, 60), floor: floorOf(z.tier, z.tx) });
        if (z.tell <= 0) {
          falls.push({ x: z.tx, y: t.roof(z.tx) + 6, vy: 10, floor: floorOf(z.tier, z.tx), a: 0, va: rand.range(-6, 6), fr: frs[z.n++ % 3] });
          sfx11('crack', { x: z.tx, vol: 0.45, pitch: 1.2 });
          z.cool = rand.range(3.2, 5.6);
        }
      } else if (under) {
        z.cool -= dt;
        if (z.cool <= 0) {
          // the tell: a rattle overhead and a trickle of grit where it will come down (just ahead of Mori)
          z.tx = clamp(p.x + p.vx * 0.85 + rand.range(-6, 6), z.x0, z.x1);
          z.tell = 1.25;
          audio.play('rustle', { vol: 0.5, pitch: 1.6 });
          sfx11('crack', { x: z.tx, vol: 0.2, pitch: 1.8 });
          if (!told) { told = true; setTimeout(() => void floatText({ text: 'Grit... falling on my hat. The roof\'s LOOSE. Watch where it trickles, wait for it to drop, THEN go.', style: 'scared', ms: 3200 }), 150); }
        }
      } else z.cool = Math.max(z.cool, 0.8);
    }
    for (let i = grit.length - 1; i >= 0; i--) { const g = grit[i]; g.vy += 300 * dt; g.y += g.vy * dt; if (g.y >= g.floor) grit.splice(i, 1); }
    for (let i = falls.length - 1; i >= 0; i--) {
      const r = falls[i];
      r.vy = Math.min(r.vy + 520 * dt, 420); r.y += r.vy * dt; r.a += r.va * dt;
      if (r.y + 5 < r.floor) continue;
      falls.splice(i, 1);
      fs.st.shake(1.6, 0.25);
      sfx11('thud', { x: r.x, vol: 0.6, pitch: 1.1 });
      for (let k = 0; k < 10; k++) fs.main.particles.spawn({ frame: A.dot2, x: r.x + rand.range(-4, 4), y: r.floor - 2, vx: rand.range(-70, 70), vy: rand.range(-90, -30), ay: 360, life: rand.range(0.4, 0.8), color: [0.52, 0.48, 0.44], alpha: 1, alpha1: 0.4, size: 0.6, size1: 0.5, floorY: r.floor });
      for (let k = 0; k < 6; k++) fs.main.particles.spawn({ frame: A.dot2, x: r.x + rand.range(-8, 8), y: r.floor - rand.range(0, 6), vx: rand.range(-20, 20), vy: rand.range(-24, -6), life: rand.range(0.9, 1.5), color: [0.46, 0.43, 0.4], alpha: 0.5, alpha1: 0, size: 1, size1: 2 });
      if (Math.abs(p.x - r.x) < 13 && Math.abs(p.y - r.floor) < 24 && p.state !== 'climb') {
        hitMori(fs, r.x, { sev: 1 });
        setTimeout(() => void floatText({ text: rand.pick(['OW. My HEAD. Okay: the trickle, THEN the rock. Wait for the rock.', 'That one had my name on it. Watch the grit, Mori.']), style: 'scared', ms: 2600 }), 600);
      }
    }
  };
}

// ---------------------------------------------------------------- the gear walls
function buildGates(f: FieldScene) {
  const what: Record<string, string> = { crystal: 'The crystal squeeze', mud: 'The mud slope', sump: 'The sump' };
  for (const g of GATEWALLS) {
    const x = g.x + g.from * 6;
    (f.interact as Interactable[]).push({
      x, y: floorOf(g.tier, x), w: 12, h: 24, standX: x,
      get label() { return `${what[g.id]}${needs(g.gate)}`; },
      enabled: () => !caveGearOk(g.gate) && f.player.state !== 'climb',
      action: () => refuse(f, WHY[g.id]),
    });
  }
}

// ---------------------------------------------------------------- the sump: an old diver's line through it
function buildSump(f: FieldScene, water: CaveWater) {
  const top = poolTop(SUMP), t = TIER.t5;
  const an = paintAnchor();
  f.main.add(new Prop(local.add('dc:sumpbolt', an.buf, an.ax, an.ay), SUMP.x0 - 8, floorOf('t5', SUMP.x0 - 8) - 2, -1.4));
  f.main.add(new Prop(local.add('dc:sumpbolt2', an.buf, an.ax, an.ay), SUMP.x1 + 10, floorOf('t5', SUMP.x1 + 10) - 2, -1.4, { flip: true }));
  // the line: tied off at both ends, sagging down along the bed, a tag knotted on it every so often
  const ln = packColor(0.86, 0.8, 0.62, 1), lnD = packColor(0.6, 0.54, 0.4, 1), tag = packColor(0.9, 0.5, 0.2, 1);
  f.main.add(new Custom(-2.8, (rr, s2) => {
    if (rr.wy(rr.VH) < top - 40 || rr.wy(0) > top + 90 || rr.wx(rr.VW) < SUMP.x0 - 20 || rr.wx(0) > SUMP.x1 + 20) return;
    for (let x = SUMP.x0 - 6; x < SUMP.x1 + 8; x++) {
      const bed = floorOf('t5', clamp(x, SUMP.x0, SUMP.x1)) - 6;
      const y = Math.round(Math.min(bed, top + Math.sin(((x - SUMP.x0) / (SUMP.x1 - SUMP.x0)) * Math.PI) * 54) + Math.sin(s2.time * 0.6 + x * 0.05) * 0.6);
      rr.rect(x, Math.max(y, t.roof(x) + 2), 1, 1, x % 3 ? ln : lnD);
      if ((x - SUMP.x0) % 40 === 20) { rr.rect(x - 1, y + 1, 3, 2, tag); rr.rect(x, y + 3, 1, 1, lnD); }
    }
  }));
  void water;
}

// ---------------------------------------------------------------- drips from the roof into the drip pools
function buildDrips(f: FieldScene, water: CaveWater) {
  const spots: { x: number; tier: string; t: number; top: number }[] = [];
  for (const q of POOLS) if (q.kind === 'drip' || q.kind === 'nursery') for (let x = q.x0 + 12; x < q.x1 - 8; x += 22) spots.push({ x, tier: q.tier, t: rand.range(0, 3), top: poolTop(q) });
  for (const [x, tier] of [[1200, 't3'], [1500, 't3'], [440, 't4'], [1040, 't2']] as const) spots.push({ x, tier, t: rand.range(0, 3), top: floorOf(tier, x) });
  const drops: { x: number; y: number; vy: number; top: number; wet: boolean }[] = [];
  const c1 = packColor(0.7, 0.85, 0.95, 0.95), c2 = packColor(0.5, 0.66, 0.78, 0.8);
  f.main.add(new Custom(-2, rr => { for (const d of drops) { rr.rect(Math.round(d.x), Math.round(d.y), 1, 2, c1); rr.rect(Math.round(d.x), Math.round(d.y) - 1, 1, 1, c2); } }, dt => {
    const p = f.player;
    if (!p || !(dt > 0)) return;
    for (const s of spots) {
      if (Math.abs(s.x - p.x) > 360 || Math.abs(s.top - p.y) > 260) continue;
      s.t -= dt;
      if (s.t > 0) continue;
      s.t = rand.range(1.2, 3.4);
      drops.push({ x: s.x + rand.range(-3, 3), y: TIER[s.tier].roof(s.x) + 3, vy: 0, top: s.top, wet: POOLS.some(q => q.tier === s.tier && s.x > q.x0 && s.x < q.x1) });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy = Math.min(d.vy + 420 * dt, 300); d.y += d.vy * dt;
      if (d.y < d.top) continue;
      drops.splice(i, 1);
      if (d.wet) water.ring(d.x, d.top, 5, 0.9, 0.7);
      else for (let k = 0; k < 3; k++) f.main.particles.spawn({ frame: A.dot2, x: d.x, y: d.top - 1, vx: rand.range(-20, 20), vy: rand.range(-40, -15), ay: 300, life: 0.3, color: [0.7, 0.85, 0.95], alpha: 0.9, alpha1: 0, size: 0.4, size1: 0.4, floorY: d.top });
      if (Math.abs(d.x - p.x) < 220 && rand.chance(0.5)) f.sfx('drip', d.x, rand.range(0.15, 0.3), rand.range(0.9, 1.4));
    }
  }));
}

// ---------------------------------------------------------------- arriving
let placeKey = '';
let seenTier = new Set<string>();
let stillT = 0, coldT = 0, dripT = 2, chuteT = 0, mudT = 0, bubT = 0, stuckT = 0, hintCool = 0, slipT = 0, crawlTold = new Set<string>(), gateTold = new Set<string>(), gateOkTold = new Set<string>(), toldLamp = false, toldCold = 0, swimming = false, lampBeforeSwim: typeof LAMP.mode = 'bright';
function enterCave(f: FieldScene, run: CaveRuntime) {
  const p = f.player;
  for (const h of run.hides) if (!p.hides.some(q => q.x === h.x)) p.hides.push(h);
  // no headlamp cone: the storm lantern is the light down here
  f.lampOn = false;
  LAMP.mode = 'bright'; LAMP.auto = false;
  placeKey = ''; seenTier = new Set(); stillT = 0; coldT = 0; toldCold = 0; stuckT = 0; hintCool = 0; slipT = 0; swimming = false;
  crawlTold = new Set(); gateTold = new Set(); gateOkTold = new Set();
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
/** the gear walls and the choke, for Mori on tier t at x: true where he can't go on */
function shutFor(px: number, t: Tier) {
  return (xx: number, dir: 1 | -1) => {
    for (const g of GATEWALLS) {
      if (g.tier !== t.id || caveGearOk(g.gate)) continue;
      if (dir > 0 ? px < g.x && xx >= g.x : px > g.x && xx <= g.x) return true;
    }
    if (t.id === CHOKE.tier && !F('dc:choke')) {
      const e = CHOKE.x + CHOKE.w / 2 - 2;
      if (dir > 0 ? px < CHOKE.wall && xx >= CHOKE.wall : px > e && xx <= e) return true;
    }
    return false;
  };
}
function tick(f: FieldScene, dt: number, run: CaveRuntime) {
  const p = f.player;
  if (!p || !(dt > 0)) return;
  run.clock.update(dt);
  const tod = todOf(run.clock.t);
  if (tod !== f.tod) { f.tod = tod; f.night = tod === 'night'; f.insects.night = f.night; }
  run.dark.twilight!.k = tod === 'night' ? 0.32 : tod === 'dusk' || tod === 'dawn' ? 0.7 : 0.95;
  const free = !f.cutscene && !game.ui.blocking;
  const ty = p.y;
  const onChute = p.onGround && p.surface === run.chute;
  // which tier: the one he stands on, or (in the air) the floor under him
  const tierId = p.onGround && p.surface ? run.tierOf.get(p.surface) : undefined;
  const T = tierId && tierId !== 'chute' ? TIER[tierId] : !p.onGround ? tierUnder(p.x, p.y) : null;
  // ---- the camera: close in the passages, wider over the lake and in the deepest chamber, following Mori down and up
  const cam = f.st.cam;
  const atLake = (T?.id === 't4' && p.x > 500) || (T?.id === 't5' && p.x > 1720);
  if (!cam.locked && !f.cam.active) {
    cam.tzoom = damp(cam.tzoom, atLake ? 1.18 : p.state === 'climb' ? 1.32 : DC.zoom, 2.5, dt);
    cam.ty = ty - (p.state === 'climb' ? 20 : 38);
  }
  // ---- the walls: how far Mori may go from here (steps, edges, the gear walls, the choke)
  if (p.state !== 'climb') {
    if (onChute) { p.minX = 100; p.maxX = 446; }
    else if (T) {
      const surf = p.onGround && p.surface ? (x: number) => Terrain.yAt(p.surface!, x) : undefined;
      const [lo, hi] = limitsAt(T, p.x, p.y, p.onGround, shutFor(p.x, T), surf);
      p.minX = Math.max(2, lo); p.maxX = Math.min(DC.W - 2, hi);
    }
    // a scripted walk that runs into a wall ends there (instead of holding Mori forever)
    if (p.state === 'script') {
      const tgt = (p as unknown as { scriptTarget: number | null }).scriptTarget;
      const pinned = tgt !== null && ((tgt > p.x && p.x >= p.maxX - 0.5) || (tgt < p.x && p.x <= p.minX + 0.5));
      stuckT = pinned ? stuckT + dt : 0;
      if (stuckT > 0.35) { stuckT = 0; (p as unknown as { finishScript(): void }).finishScript(); }
    } else stuckT = 0;
  }
  // ---- the scree's foot: up (W / the up key) steps onto it from T2
  if (free && p.onGround && tierId === 't2' && p.x > CHUTE_FOOT.x0 && p.x < CHUTE_FOOT.x1 && p.state === 'normal' && game.input.hit('up')) onScree(f);
  // ---- the lantern: L shutters / opens it; crouching still shutters it by itself
  if (free && LAMP.mode !== 'pole' && !swimming) {
    if (game.input.keyHit('KeyL')) { LAMP.mode = LAMP.mode === 'bright' ? 'dim' : 'bright'; LAMP.auto = false; audio.play('lanternOn', { vol: 0.35, pitch: LAMP.mode === 'dim' ? 0.8 : 1.1 }); }
    const still = p.crouch && Math.abs(p.vx) < 5 && p.onGround;
    stillT = still ? stillT + dt : 0;
    if (stillT > 1.2 && LAMP.mode === 'bright') {
      LAMP.mode = 'dim'; LAMP.auto = true;
      audio.play('lanternOn', { vol: 0.25, pitch: 0.75 });
      if (!toldLamp) { toldLamp = true; floatNotice('Lantern shuttered. Stand up (or press L) to open it.', 2800, { tag: 'LAMP' }); }
    } else if (LAMP.auto && LAMP.mode === 'dim' && (!p.crouch || Math.abs(p.vx) > 12)) { LAMP.mode = 'bright'; LAMP.auto = false; audio.play('lanternOn', { vol: 0.25, pitch: 1.1 }); }
  }
  // ---- what's underfoot: how fast he goes (one place decides, so nothing fights over it)
  let k = 1;
  const moving = Math.abs(p.vx) > 3;
  // crawls and squeezes: down on his knees, pushing the pack ahead
  const cz = T && p.onGround && p.state === 'normal' ? CRAWLS.find(c => c.tier === T.id && p.x > c.x0 && p.x < c.x1) : undefined;
  if (cz) {
    k = Math.min(k, cz.kind === 'crystal' ? 0.45 : cz.kind === 'squeeze' ? 0.55 : 0.6);
    p.crouch = true;
    p.anim = moving ? 'crouchWalk' : 'crouch';
    if (moving && rand.chance(dt * 1.2)) audio.play(cz.kind === 'crystal' ? 'jarClink' : 'rustle', { vol: 0.22, pitch: cz.kind === 'crystal' ? rand.range(1.6, 2.2) : 0.6 });
    if (moving && free) addHunger(dt * 0.00012, 'squeeze');
    if (!crawlTold.has(cz.kind)) {
      crawlTold.add(cz.kind);
      const lines = { crawl: ['The roof comes right down. Hands and knees, Mori. Lantern low.', 'Low. Lower. Crawl it.'], squeeze: ['It\'s TIGHT. Pack in front. Breathe out. Wriggle.', 'If I get stuck here nobody will ever find me. Don\'t think about that.'], crystal: ['Crystal all round me. They ring when the gloves touch them. Slowly...', 'Like crawling through a chandelier. A sharp one.'] }[cz.kind];
      void floatText({ text: rand.pick(lines), style: cz.kind === 'crystal' ? 'whisper' : 'scared', ms: 2600 });
    }
  }
  // the scree: loose underfoot, slow going up, rattling down
  if (onChute && moving) {
    chuteT -= dt;
    k = Math.min(k, p.vx > 0 ? 0.62 : 0.9);
    if (chuteT <= 0) {
      chuteT = 0.25;
      audio.play('rustle', { vol: 0.25, pitch: 1.4 });
      for (let i = 0; i < 3; i++) f.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-4, 4), y: p.y - 1, vx: rand.range(-40, -10), vy: rand.range(-40, -10), ay: 300, life: 0.6, color: [0.5, 0.45, 0.4], alpha: 1, alpha1: 0.6, size: 0.5, size1: 0.5, floorY: p.y + 30 });
    }
  }
  // the mud slope (with trail boots: heels in, slowly; uphill slower still)
  const onMud = T?.id === MUD.tier && p.onGround && p.x > MUD.x0 && p.x < MUD.x1;
  if (onMud) {
    k = Math.min(k, p.vx > 0 ? 0.72 : 0.5);
    if (moving) {
      mudT -= dt;
      if (mudT <= 0) {
        mudT = rand.range(0.3, 0.5);
        sfx11(rand.chance(0.3) ? 'glorp' : 'mudBurst', { x: p.x, vol: 0.18, pitch: rand.range(0.8, 1.2) });
        for (let i = 0; i < 3; i++) f.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-3, 3), y: p.y - 1, vx: -Math.sign(p.vx) * rand.range(10, 40), vy: rand.range(-50, -20), ay: 400, life: 0.5, color: [0.32, 0.24, 0.16], alpha: 1, alpha1: 0.8, size: 0.6, size1: 0.6, floorY: p.y + 2 });
      }
    }
  }
  // wading: the stream pools, the drip pools, the nursery; the sump is a swim
  const pool = T && p.onGround ? POOLS.find(q => q.tier === T.id && p.x > q.x0 + 3 && p.x < q.x1 - 3) : undefined;
  const top = pool ? poolTop(pool) : 0;
  const swimNow = !!pool && pool.kind === 'sump' && p.y - top > 22 && p.state !== 'climb';
  if (pool && !swimNow && p.y > top + 2) {
    k = Math.min(k, 0.74);
    splashT -= dt * Math.abs(p.vx) / 40;
    if (moving && splashT <= 0) { splashT = 0.5; audio.play('stepWater', { vol: 0.3, pitch: rand.range(0.6, 0.8) }); run.water.ring(p.x, top, 6, 0.8, 0.6); }
  }
  if (swimNow) {
    k = Math.min(k, 0.5);
    if (!swimming) {
      swimming = true;
      f.splash(p.x, top, 1.2);
      lampBeforeSwim = LAMP.mode === 'pole' ? 'bright' : LAMP.mode;
      if (LAMP.mode !== 'pole') { LAMP.mode = 'dim'; LAMP.auto = false; }
      if (!F('dc:dived')) { setF('dc:dived'); }
    }
    p.poseOverride = 'swim';
    bubT -= dt;
    if (bubT <= 0) { bubT = rand.range(0.4, 0.9); run.water.bubble(p.x + p.facing * 6, p.y - 30, top, rand.range(0.6, 1.2)); }
  } else if (swimming) {
    swimming = false;
    if (p.poseOverride === 'swim') p.poseOverride = null;
    f.splash(p.x, top || p.y, 1);
    LAMP.mode = lampBeforeSwim; LAMP.auto = false;
    audio.play('lanternOn', { vol: 0.3 });
    if (p.x > SUMP.x1 - 40 && !F('dc:sumpOut')) { setF('dc:sumpOut'); void floatText({ text: 'AIR. Oh, air. Lantern... still lit. Where AM I?', style: 'scared', ms: 2600 }); }
  }
  if (p.state === 'normal' || p.state === 'script') p.wadeK = k;
  // ---- the gear walls: what's in the way, and what he'd need (once a visit, then when he pushes on it)
  hintCool -= dt;
  if (T && free) for (const g of GATEWALLS) {
    if (g.tier !== T.id) continue;
    const d = (g.x - p.x) * -g.from;
    if (d < 0 || d > 60) continue;
    if (caveGearOk(g.gate)) {
      if (d < 26 && !gateOkTold.has(g.id)) { gateOkTold.add(g.id); void floatText({ text: SAY_OK[g.id], style: 'think', ms: 2800 }); }
      continue;
    }
    if (!gateTold.has(g.id) && d < 54) { gateTold.add(g.id); refuse(f, WHY[g.id]); hintCool = 5; }
    const pushing = Math.abs(p.x - (g.x + g.from)) < 2 && game.input.axisX() === -g.from;
    if (pushing && hintCool <= 0) { hintCool = 6; refuse(f, WHY[g.id].split('. ').slice(-1)[0]); }
  }
  // the flowstone wall (grip soles): the first time on it
  if (p.state === 'climb' && p.climb && Math.abs(p.climb.x - LINK.flow.x) < 2 && !gateOkTold.has('flow')) { gateOkTold.add('flow'); void floatText({ text: SAY_OK.flow, style: 'think', ms: 2600 }); }
  // ---- hard climbs: the chimney, the breakdown pile, the water wall burn breath even hanging still
  if (p.state === 'climb' && p.climb && free) {
    const c = p.climb;
    const flow = Math.abs(c.x - LINK.flow.x) < 2;
    const hard = flow ? LINK.flow.hard ?? 1 : STEPS.find(s => s.climb && Math.abs(s.climb.x - c.x) < 2 && Math.abs(s.climb.y0 - c.y0) < 3)?.climb?.hard ?? 0;
    const knob = flow && FLOW_KNOBS.some(y => Math.abs(p.y - y) < 6);
    if (hard > 0 && !knob && slipT <= 0) {
      const climbing = Math.abs(p.vy) > 1 || p.autoClimb !== 0 || game.input.down('up') || game.input.down('down');
      STAMINA_ZL.set(Math.max(0, stamina() - (climbing ? 0.07 : 0.24) * hard * dt));
      // out of breath on the water wall: his grip goes, and he slides to the boss below
      if (flow && stamina() < 0.02) {
        slipT = 0.8;
        audio.play('rustle', { vol: 0.5, pitch: 0.5 });
        void floatText({ text: rand.pick(['My arms... can\'t... HOLD...', 'Slipping! SLIPPING!']), style: 'scared', ms: 1800 });
      }
    }
    if (slipT > 0) {
      slipT -= dt;
      const below = [...FLOW_KNOBS, c.y1].filter(y => y > p.y + 2).sort((a, b) => a - b)[0] ?? c.y1;
      p.y = Math.min(below, p.y + 70 * dt);
      if (p.y >= below - 0.5) slipT = 0;
    }
    if (knob && flow && !F('dc:knobTip')) { setF('dc:knobTip'); floatNotice('A boss of flowstone: hang here and get your breath back.', 2800, { tag: 'CLIMB' }); }
  } else slipT = 0;
  // ---- the crack: the first time at its brink
  if (T?.id === CRACK.tier && p.onGround && Math.abs(p.x - CRACK.x0) < 30 && p.x < CRACK.x0 + 4 && !F('dc:crackTip')) {
    setF('dc:crackTip');
    void floatText({ text: 'A crack right across the floor. Black all the way down. Jump it. JUMP it. Don\'t look down. ...I looked down.', style: 'scared', ms: 3000 });
  }
  // the choke, the first time at it
  if (T?.id === 't0' && !F('dc:choke') && Math.abs(p.x - CHOKE.wall) < 40 && !crawlTold.has('choke')) {
    crawlTold.add('choke');
    void floatText({ text: 'A boulder, wedged right across the narrows. Nobody\'s squeezing round THAT. ...It rocks a bit, though.', style: 'think', ms: 3000 });
  }
  // ---- the cold and the hunger: deeper is colder, and cold is hungry work
  const dk = depthK(ty);
  if (free) {
    addHunger(dt * (0.00006 + 0.00026 * dk), 'cold');
    coldT -= dt;
    if (dk > 0.4 && coldT <= 0 && !swimming) { coldT = rand.range(2.2, 3.6); const eyeY = p.y - p.height * 0.85; breathPuff(f, p.x + p.facing * 4, eyeY + 4, p.facing); }
    const lvl = dk > 0.85 ? 3 : dk > 0.55 ? 2 : dk > 0.3 ? 1 : 0;
    if (lvl > toldCold) {
      toldCold = lvl;
      const lines = ['', 'Colder down here. A LOT colder. I can see my breath.', 'My fingers are going numb. And I\'m starving. How am I starving?', 'Freezing. Everything down here is freezing. Except my stomach, which is furious.'];
      setTimeout(() => void floatText({ text: lines[lvl], style: 'scared', ms: 2600 }), 400);
    }
  }
  // ---- each new tier: a look at the watch (how long down, how long back up)
  if (p.onGround && free && T) {
    if (!seenTier.has(T.id) && ['t2', 't3', 't4', 't5'].includes(T.id)) {
      seenTier.add(T.id);
      const h = hourNow(f);
      const late = h > DARK_HOUR - 3;
      showWatch({ mode: 'clock', hour: h, deadline: DARK_HOUR, anchor: 'mori', size: 28, hold: 4.5, red: late, shake: late ? 0.5 : 0 });
      const say = T.id === 't4' ? `${cap(hourWords(h))}. The lake. Every step down is a step I have to climb back up.` : T.id === 't5' ? `${cap(hourWords(h))}. Under the LAKE. The climb out is going to hurt.` : late ? `${cap(hourWords(h))}. It's getting late up there. The climb out takes longer than the climb in.` : `${cap(hourWords(h))}. Deeper. Keep an eye on the time, Mori.`;
      setTimeout(() => void floatText({ text: say, style: late ? 'scared' : 'think', ms: 3000 }), 900);
    }
    // the deepest chamber, the first time
    if (T.id === 't5' && p.x > SUMP.x1 + 20 && !F('dc:deepest')) {
      setF('dc:deepest');
      audio.play('discover', { vol: 0.5, pitch: 0.6 });
      setTimeout(() => void floatText({ text: 'Te Puna Tioata. Crystals taller than a house... and the pool GLOWS. Nobody has ever stood here. Nobody. Ever.', style: 'whisper', ms: 4000 }), 1200);
    }
    // the place's name floats in the sky
    const [nn, sub] = zoneAt(p.x, ty);
    const key = nn + '|' + sub;
    if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(nn, `${sub} · Day ${game.save.day || 1}`); }
  }
  // ---- the sound of the place: drips everywhere, the falls near the bottom
  dripT -= dt;
  if (dripT <= 0) { dripT = rand.range(1.2, 4); f.sfx('drip', p.x + rand.range(-200, 200), rand.range(0.15, 0.35), rand.range(0.8, 1.3)); }
  const nearFalls = Math.abs(p.x - FALLS.x) < 500 && ty > FALLS.top - 60 && ty < FALLS.bottom + 60;
  if (nearFalls !== ambFalls) { ambFalls = nearFalls; audio.setAmbience(nearFalls ? 'falls' : 'none', false); }
}
let ambFalls = false, splashT = 0;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** for the dev points: where a tier's walk line is at x */
export const DC_POINTS = { ...SPOT };

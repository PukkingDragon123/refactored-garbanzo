// V12 Te Tuawhenua, the backcountry (layout: ./gen.ts, a seeded generator). One 14,000 px site scene
// under the open sky (the island's continuous sky and clouds on the expedition clock), with its own far
// land: snow ranges, then four bands of country painted the whole width of the map with the stretch they
// lie behind (src/art/v12/backcountry/land.ts), mist lying in the far valleys, the Hot Valley's steam
// past the gorge's end; a near hedge that follows the walk line; and the gameplay plane: the ground in
// perspective (./floor.ts), the stretches dressed from the generator's lists with the hand-painted
// props (src/art/v12/backcountry/*: kānuka and mānuka, charred trunks, the claw-scored trunks, the
// feathered boa's plumes, wallow and shed skin, the kill sites, the Bearer's den and cache, cairns,
// gravel bars, the gorge's back wall) and the shared ones (tussock, tree ferns, boulders), ground cover
// with the plant physics, the foreground framing, the light (open sky, the gully's green shade, ash
// haze on the burnt ridge, the gorge's cold shadow), the wind, the air, the crossroads and the ledge.
//
// The creatures module attaches through tuaHooks (./hooks.ts): its builders run at the end of the
// build, its updates every frame.

import type { FieldScene, SpawnV2 } from '../../scenes/field';
import type { Layer } from '../../../world/stage';
import type { Interactable } from '../../../world/npc';
import type { Env, Frame } from '../../../gfx/renderer';
import { packColor, WHITE } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { Prop, Custom } from '../../../world/props';
import { layerSpan } from '../../../world/scenery';
import { game } from '../../game';
import { A } from '../../assets';
import { audio } from '../../../core/audio';
import type { Ambience } from '../../../core/audio';
import { Rng, damp, fbm1, noise1, rand, smoothstep } from '../../../core/math';
import * as Lsc from '../../../art/landscape';
import { hex } from '../../../art/color';
import type { C } from '../../../art/color';
import type { Sprite } from '../../../art/jungle-core';
import { plant, deadwood, fungus } from '../../../art/jungle-plants';
import type { PlantKind } from '../../../art/jungle-plants';
import { tree, canopyClump } from '../../../art/jungle-trees';
import { paintGiant } from '../../../art/v11/forest/trees';
import { soften, fgVines, fgFernSpray, fgPlant } from '../../../art/v11/forest/fg';
import { FP } from '../../../art/v11/forest/kit';
import { HP } from '../../../art/v11/hills/kit';
import { paintTussock, paintSpaniard, paintDaisy, paintHebe, paintWindTree, paintCushion } from '../../../art/v11/hills/plants';
import { paintBoulder, paintScreeStone } from '../../../art/v11/hills/rocks';
import { paintTiKouka } from '../../../art/v12/swamp/props';
import { wpersp } from '../../../art/v11/woods/floor';
import { paintMossMound } from '../../../art/v9/eastart';
import { DayClock, IsleSky, CloudDeck, envAt, lightKAt } from '../../v4/islefx';
import { sprite } from '../../sites2/common';
import { arrive } from '../../sites2';
import { addWide, clockForTod } from '../../v11/woods/kit';
import { GroundCover } from '../../v11/forest/fx';
import type { Mover } from '../../v11/forest/fx';
import { WoodsShade, WoodsWater, WoodsRays } from '../../v11/woods/fx';
import { MistBank } from '../../v11/hills/fx';
import { currentExpedition, expeditionHour } from '../../v10/expedition';
import { findArt } from '../../v10/finds';
import type { Site10, Point10 } from '../../sites10/kit';
import { registerPosts } from '../trails';
import type { RegionPost } from '../trails';
import { addHunger } from '../hunger';
import { floatText } from '../../../ui/v12/float';
import { TP } from '../../../art/v12/backcountry/kit';
import { paintTuaFloor, tuaChannels, streamAt } from '../../../art/v12/backcountry/floor';
import { paintTuaBand } from '../../../art/v12/backcountry/land';
import { paintKanuka, paintCharredTrunk, paintCharredStump, paintFireweed, paintBracken } from '../../../art/v12/backcountry/plants';
import { paintPlume, paintSkinLog, paintBonePile, paintWallow, paintDenMouth, paintCache, paintTrailCairn, paintGravelBar, paintLog, paintGorgeWall, paintCrag } from '../../../art/v12/backcountry/signs';
import { TUA, TUA_W, TUA_MIN_Y, TUA_MAX_Y, TUA_B0, TUA_SPOT, TUA_MORE, BIOMES, bioW, bioPick, tuaGround, tuaBase, tuaDepth, tuaCanopy, tuaZone } from './gen';
import type { Biome } from './gen';
import { tuaHooks } from './hooks';
import './statues';
import './feud';
import { TuaGusts, TuaAir, SteamPlumes, Cascade, Strip, TuaMist } from './fx';

export { TUA_SPOT, TUA_MORE, tuaGround, tuaHooks };

const todOf = (t: number) => (t < 0.35 ? 'dawn' : t < 2.6 ? 'day' : t < 3.4 ? 'dusk' : 'night') as 'dawn' | 'day' | 'dusk' | 'night';

// ---------------------------------------------------------------- the camera and the far layers' rows
/** the base zoom the far layers are laid out for, and how high over the walk line the camera rides */
const Z0 = 1.12, CAM_UP = 40;
/** the zoom per stretch: wider over the open flats, close in the gully */
const ZOOM: Record<Biome, number> = { scrub: 1.14, flats: 1.08, burnt: 1.12, boa: 1.24, tussock: 1.09, gorge: 1.16 };
const C0 = TUA_B0 - CAM_UP;
/** layer y for something that sits at screen y `sy` (of the 360-row view) with the camera at its nominal height */
const ly = (p: number, sy: number) => 180 + (C0 - 180) * p + (sy - 180) / Math.pow(Z0, p);
/** a near layer's y for the walk line at world x (it follows the rises and dips), `up` px further back */
const lyG = (p: number, x: number, up = 0) => 180 + (tuaGround(x) - CAM_UP - 180) * p + Math.pow(Z0, 1 - p) * (CAM_UP - up);
const zoomAt = (x: number) => { let z = 0, w = 0; for (const b of BIOMES) { const k = bioW(x, b); z += k * ZOOM[b]; w += k; } return w > 0 ? z / w : Z0; };

// ---------------------------------------------------------------- what lives here (besides the two big ones)
const S = TUA.S;
const R = (b: Biome, a = 0, e = 1): [number, number] => [Math.round(S[b].x0 + (S[b].x1 - S[b].x0) * a), Math.round(S[b].x0 + (S[b].x1 - S[b].x0) * e)];
/** the backcountry's ordinary wildlife, by stretch (the Bearer and the feathered boa come from their own module) */
export const TUA_SPAWNS: SpawnV2[] = [
  // the kānuka scrub: delver towns in the open patches, nutcrackers in the kānuka, geckos on the trunks
  { species: 'delver', n: [3, 5], x: R('scrub', 0.28, 0.44), herd: true, juveniles: 0.4, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
  { species: 'nutcracker', n: [3, 6], x: R('scrub', 0.55, 0.85), herd: true, times: ['dawn', 'day'], chance: 0.75 },
  { species: 'barkgecko', n: [2, 3], x: R('scrub', 0.1, 0.9), poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
  { species: 'quillhog', n: [1, 2], x: R('scrub', 0.1, 0.9), times: ['dusk', 'night'], chance: 0.75 },
  // the river flats: storks in the braids, a hawk over the gravel, torhoppers grazing the old bars
  { species: 'snakestork', n: [1, 2], x: R('flats', 0.12, 0.88), poi: 'shallows', times: ['dawn', 'day', 'dusk'], chance: 0.85 },
  { species: 'galehawk', n: [1, 1], x: R('flats', 0.2, 0.9), medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
  { species: 'strider', n: [1, 2], x: R('flats', 0.1, 0.9), times: ['dawn', 'day', 'dusk'], chance: 0.7 },
  { species: 'torhopper', n: [2, 4], x: R('flats', 0.6, 0.8), herd: true, juveniles: 0.3, times: ['dawn', 'day', 'dusk'], chance: 0.55 },
  // the burnt ridge: the scavengers over the kill, sprint vipers hunting the open ash at dusk
  { species: 'monarch', n: [1, 1], x: R('burnt', 0.6, 0.95), medium: 'air', times: ['dawn', 'day'], chance: 0.6 },
  { species: 'sprinter', n: [1, 1], x: R('burnt', 0.2, 0.8), times: ['dusk', 'night'], chance: 0.6 },
  { species: 'galehawk', n: [1, 1], x: R('burnt', 0.35, 0.7), medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.5 },
  // the feathered gully: frogs at the creek, a flicker marten (a snake hunter), bats and pteramanders at night
  { species: 'mossfrog', n: [3, 5], x: [TUA.creekX - 120, TUA.creekX + 120], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
  { species: 'flicker', n: [1, 1], x: R('boa', 0.1, 0.9), times: ['dawn', 'day', 'dusk'], chance: 0.55, later: true },
  { species: 'strider', n: [1, 1], x: R('boa', 0.1, 0.9), times: ['dawn', 'day', 'dusk'], chance: 0.6 },
  { species: 'hunterbat', n: [1, 2], x: R('boa', 0.1, 0.9), poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.75 },
  { species: 'pteramander', n: [1, 1], x: R('boa', 0.5, 0.9), poi: 'trunk', medium: 'trunk', times: ['dusk', 'night'], chance: 0.6 },
  { species: 'barkgecko', n: [1, 2], x: R('boa', 0.1, 0.9), poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
  // the tussock clearings: torhopper herds, delvers, shieldbacks
  { species: 'torhopper', n: [3, 6], x: R('tussock', 0.2, 0.8), herd: true, juveniles: 0.35, poi: 'rock', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
  { species: 'delver', n: [3, 4], x: R('tussock', 0.55, 0.75), herd: true, juveniles: 0.4, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
  { species: 'shieldback', n: [1, 2], x: R('tussock', 0.1, 0.9), times: ['dawn', 'day', 'dusk'], chance: 0.6 },
  // the claw gorge: auks and their vipers on the wall's ledges, bats, quillhogs
  { species: 'cragauk', n: [3, 5], x: R('gorge', 0.68, 0.9), poi: 'nest', herd: true, juveniles: 0.25, times: ['dawn', 'day', 'dusk'], chance: 0.8 },
  { species: 'cragviper', n: [1, 1], x: R('gorge', 0.68, 0.9), poi: 'nest', times: ['day', 'dusk'], chance: 0.45 },
  { species: 'hunterbat', n: [1, 2], x: R('gorge', 0.3, 0.9), poi: 'nest', medium: 'trunk', times: ['dusk', 'night'], chance: 0.6 },
  { species: 'quillhog', n: [1, 1], x: R('gorge', 0.1, 0.5), times: ['dusk', 'night'], chance: 0.6 },
];

// ---------------------------------------------------------------- what there is to find
const ksl = TUA.kills[1];
export const TUA_POINTS: Point10[] = [
  { id: 'eco:tu:scrub', kind: 'ecosystem', name: 'Kānuka scrubland', x: R('scrub', 0.5)[0], photo: { w: 300, h: 140 }, note: 'Kānuka and mānuka coming back over old open ground: the first trees after fire or flood. Bees in the flowers, geckos on the papery bark.' },
  { id: 'lm:tu:braids', kind: 'landmark', name: 'The braided river', x: TUA.streams[Math.floor(TUA.streams.length / 2)].x, photo: { w: 360, h: 80, dy: -10 }, note: 'A river that can\'t make up its mind: a dozen channels splitting and joining across a bed of grey stones, all moving every flood.' },
  { id: 'pt:tu:river', kind: 'sample', name: 'Braided river water', x: TUA.streams[0].x, art: () => findArt.sampleSpot('#7ab4b4'), note: 'Milky blue water off the high country.', take: { item: 'smp_falls', verb: 'Fill a sample jar from the braid', tools: ['jar'], time: 1.6, line: 'Milky. That\'s rock flour: mountains, ground to powder.' } },
  { id: 'lm:tu:crest', kind: 'landmark', name: 'The burnt ridge', x: Math.round((TUA.crest[0] + TUA.crest[1]) / 2), photo: { w: 320, h: 180, dy: 20 }, note: 'Dead trees standing black on the ridge after a fire, and the green coming back through the ash.' },
  { id: 'lm:tu:claw', kind: 'landmark', name: 'Claw-scored trunk', x: TUA.scored[3], photo: { w: 40, h: 90, dy: -40 },
    note: 'Four gouges raked down a trunk above head height, one of them twice as deep and hooked at the end.',
    look: { verb: 'Look at the gouges', lines: () => [
      { who: 'mori', text: 'Those are claw marks. Above my HEAD. And one of them is... one claw did that. One claw.', expr: 'worried' },
      { who: 'aroha', text: 'It marks its ground. Koro says you go round, not through, when you see those.', expr: 'serious' },
    ] } },
  { id: 'lm:tu:skin', kind: 'landmark', name: 'A shed skin, feathered', x: TUA.skins[0], photo: { w: 120, h: 40 },
    note: 'A shed serpent skin draped over a log, longer than the log, with little pits in every scale where feathers grew.',
    look: { verb: 'Look at the papery thing on the log', lines: () => [
      { who: 'mori', text: 'A shed skin. Every scale has a little pit in it... where a FEATHER grew. A feathered snake. As long as this log. Longer.', expr: 'wow' },
    ] } },
  { id: 'lm:tu:wallow', kind: 'landmark', name: 'The wallow', x: TUA.wallow, photo: { w: 130, h: 30, dy: 10 }, note: 'A coil of crushed fern pressed flat into the gully floor, the size of a hāngī pit. Something big lies here. Something coiled.' },
  { id: 'pt:tu:bone', kind: 'sample', name: 'A kill site', x: ksl + 4, y: tuaGround(ksl + 4), art: () => findArt.dig('#5a4a38'), note: 'Picked-clean ribs and a spine in the tussock. A serpent, a big one, and the bones are crushed.',
    take: { item: 'bone', verb: 'Pick up a crushed vertebra', time: 1.6, line: 'A vertebra the size of my fist. Crushed. What crushes a SNAKE\'S BACKBONE?' } },
  { id: 'cave:tu:den', kind: 'cave', name: 'The den under the overhang', x: TUA.den, photo: { w: 150, h: 100 }, note: 'A rock overhang in the claw gorge with a scraped bed of crushed fern in its mouth, bones pushed to the sides, claw scratches on the rock.' },
  { id: 'pt:tu:rock', kind: 'sample', name: 'Gorge rock', x: R('gorge', 0.12)[0], art: () => findArt.glint('#9a9aa0'), take: { item: 'smp_scree', verb: 'Chip a sample off the gorge wall', tools: ['trowel'], time: 2, line: 'Layer on layer, tipped up on its side. This rock used to be the sea floor.' } },
];

export const BACKCOUNTRY: Site10 = {
  id: 'backcountry', loc: 'backcountry', name: 'Te Tuawhenua', width: TUA_W, camY: C0, followY: true, minY: TUA_MIN_Y, maxY: TUA_MAX_Y,
  spawnX: TUA_MORE.enter, exitX: TUA_MORE.exit, waterY: null, ambience: 'canopy', music: 'wonder', ground: 'grass',
  build(f: FieldScene) { rt = buildBackcountry(f); },
  onUpdate(f, dt) { rt?.update(f, dt); },
  spawns: TUA_SPAWNS,
  insects: [
    { kind: 'bee', x: R('scrub', 0.05, 0.95), y: [130, 200], n: 6, times: ['day'] },
    { kind: 'butterfly', x: R('scrub'), y: [130, 200], n: 5, times: ['day', 'dawn'] },
    { kind: 'cicada', x: R('scrub'), y: [70, 150], n: 4, times: ['day'] },
    { kind: 'dragonfly', x: R('flats'), y: [190, 220], n: 10, times: ['dawn', 'day', 'dusk'] },
    { kind: 'butterfly', x: R('tussock'), y: [150, 210], n: 4, times: ['day'] },
    { kind: 'dragonfly', x: [TUA.creekX - 200, TUA.creekX + 200], y: [210, 245], n: 4, times: ['day', 'dusk'] },
    { kind: 'firefly', x: R('boa'), y: [150, 240], n: 40, times: ['dusk', 'night'] },
    { kind: 'skymoth', x: [0, TUA_W], y: [90, 200], n: 10, times: ['dusk', 'night'] },
    { kind: 'lanternbeetle', x: R('boa', 0.2, 0.9), y: [236, 248], n: 5, times: ['night'] },
    { kind: 'weta', x: R('gorge', 0.4, 0.8), y: [190, 210], n: 3, times: ['dusk', 'night'] },
  ],
  onEnter: f => {
    rt?.enter(f);
    return arrive(f, 'Te Tuawhenua', 'The backcountry', 'The backcountry. Nobody farms out here, Doc, nobody hunts out here. The old people left this land to two animals. Watch the trunks, and watch the ferns.');
  },
  v10: {
    points: TUA_POINTS,
    hazards: [{ x0: S.gorge.x0 + 220, x1: S.gorge.x0 + 640, kind: 'rockfall', dmg: 4, period: 8, warn: 'The gorge walls drop stones when the wind gets in. Keep moving through the narrows.' }],
  },
};

// ---------------------------------------------------------------- the runtime
interface TuaRuntime {
  clock: DayClock;
  main: Layer;
  hides: { x: number; w: number; y: number; cover: number }[];
  update(f: FieldScene, dt: number): void;
  enter(f: FieldScene): void;
}
let rt: TuaRuntime | null = null;
/** the backcountry's runtime while it is the scene */
export const tuaRuntime = () => rt;

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));
async function climbUp(f: FieldScene, x: number, yTop: number, yBot: number) {
  const p = f.player;
  await Promise.race([p.walkTo(x, 60), sleep(4000)]);
  if (Math.abs(p.x - x) > 10 || Math.abs(p.y - yBot) > 14) return;
  await f.climbLadder({ x, y0: yTop, y1: yBot }, -1);
}
/** the ledge over the den: its top (world y) */
const LEDGE_Y = Math.round(tuaGround(TUA.ledge.x1) - TUA.ledge.rise);

function posts(): RegionPost[] {
  const out: RegionPost[] = [];
  TUA.posts.forEach((x, i) => {
    const a = TUA.stretches[i], b = TUA.stretches[i + 1];
    out.push({ x, arms: [{ info: a.name.toUpperCase(), go: x - 400, dir: 'left' }, { info: b.name.toUpperCase(), go: x + 400, dir: 'right' }] });
  });
  const lx = TUA.ledge.climb - 46;
  out.push({ x: lx, arms: [
    { tier: 'THE LEDGE', mark: 'up', dir: 'right', label: 'Scramble up onto the ledge over the den <span style="opacity:.75">· the high way</span>', go: f => climbUp(f, TUA.ledge.climb, LEDGE_Y, tuaGround(TUA.ledge.climb)) },
    { info: 'NGĀ PĀTĪTĪ', go: lx - 400, dir: 'left' },
    { info: 'TE RUA MATIKUKU', go: lx + 400, dir: 'right' },
  ] });
  return out;
}

// ---------------------------------------------------------------- building it
export function buildBackcountry(f: FieldScene): TuaRuntime {
  const st = f.st, r = game.r;
  const clock = new DayClock();
  clock.set(clockForTod(f.tod, currentExpedition() ? expeditionHour() : undefined));
  // (the day loop drives a scene's `clock` from the expedition hour: src/game/v12/loop.ts)
  (f as unknown as { clock: DayClock }).clock = clock;
  st.minX = 0; st.maxX = TUA_W; st.minY = TUA_MIN_Y; st.maxY = TUA_MAX_Y;
  const rng = new Rng(TUA.seed ^ 0x5151);
  const frameOf = (key: string, gen: () => Sprite) => { const s = sprite('tua:' + key, gen)!; return Object.assign(s.f, { sprite: s.s }); };
  const FOG = hex('#b6c4c6');
  const G = tuaGround;

  // ---------------------------------------------------------------- the sky and the far ranges
  st.addScreenLayer('sky', 0.5).add(new IsleSky(clock));
  const cf = st.addLayer('clouds-far', 0.015, 0, 0, 0.5, 0.01);
  cf.add(new CloudDeck(clock, cf, 71, 9, -10, 64, true, layerSpan(st, 0.015, 260)));
  const range = (name: string, p: number, sy: number, o: Partial<Lsc.RidgeOpts> & { seed: number; amp: number; freq: number }, fogK: number, cols: [string, string, string]) => {
    const span = layerSpan(st, p, 60);
    const h = 200;
    const buf = Lsc.paintRidge(span.w, h, { base: h - 20, sharp: 0.7, body: hex(cols[0]), lit: hex(cols[1]), shadow: hex(cols[2]), fogTo: FOG, fogStart: 110, gullies: 1.4, ...o } as Lsc.RidgeOpts);
    const lay = st.addLayer(name, p, fogK, 0.05, 0, p);
    lay.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, span.x0, ly(p, sy) - h + 20));
    return lay;
  };
  range('alps', 0.04, 160, { seed: 181, amp: 104, freq: 0.0058, snow: hex('#eef3f8'), snowLine: 64 }, 0.5, ['#6f8296', '#92a6ba', '#56687e']);
  const cn = st.addLayer('clouds-near', 0.05, 0.1, 0, 0.5, 0.05);
  cn.add(new CloudDeck(clock, cn, 73, 5, 40, 96, false, layerSpan(st, 0.05, 200)));
  const r2 = range('range2', 0.08, 166, { seed: 182, amp: 70, freq: 0.0084, snow: hex('#e2e9f0'), snowLine: 118 }, 0.4, ['#5e7286', '#7e93a6', '#485a6e']);
  r2.add(new MistBank(5, ly(0.08, 150), 2, 0.35, 0, 11, 760, 70, '#e6edf2'));
  // ---------------------------------------------------------------- the country, band after band
  const band = (name: string, p: number, sy: number, o: { seed: number; amp: number; k: number; haze: number; bio: number }, fogK: number) => {
    const span = layerSpan(st, p, 60);
    const base = Math.round(o.amp * 1.5 + 30), H = base + 110;
    const buf = paintTuaBand({ W: span.w, H, lx0: span.x0, p, seed: o.seed, base, amp: o.amp, k: o.k, fog: FOG, haze: o.haze, bio: o.bio });
    const lay = st.addLayer(name, p, fogK, 0.25 + o.k * 0.3, 0, p);
    addWide(lay, buf, span.x0, ly(p, sy) - base);
    return lay;
  };
  const b4 = band('tb4', 0.15, 170, { seed: 191, amp: 52, k: 0.1, haze: 0.34, bio: 0.25 }, 0.2);
  b4.add(new MistBank(5, ly(0.15, 158), 3, 0.32, 0, 13, 760, 80, '#e6edf2'));
  const b3 = band('tb3', 0.26, 180, { seed: 192, amp: 56, k: 0.35, haze: 0.2, bio: 0.5 }, 0.13);
  b3.add(new TuaMist(5, ly(0.26, 168), 6, 0.26, 17, 700, 90, '#e8eef2', x => 0.6 + 0.4 * bioW(x / 0.26, 'flats') + bioW(x / 0.26, 'boa') * 0.6));
  b3.add(new SteamPlumes(0.26, ly(0.26, 176), 301, () => clock.night));
  const b2 = band('tb2', 0.42, 194, { seed: 193, amp: 60, k: 0.6, haze: 0.09, bio: 0.8 }, 0.06);
  b2.add(new SteamPlumes(0.42, ly(0.42, 192), 302, () => clock.night));
  band('tb1', 0.62, 210, { seed: 194, amp: 58, k: 0.9, haze: 0.03, bio: 1 }, 0.03);

  // ---------------------------------------------------------------- the near back: a hedge following the walk line, trees in it
  const pb = 0.86;
  const back = st.addLayer('back', pb, 0.03, 0.55, 0, pb);
  {
    const span = layerSpan(st, pb, 60);
    const amp = 26, base = 40;
    for (let cx0 = span.x0; cx0 < span.x0 + span.w; cx0 += 1024) {
      const w = Math.min(1024, span.x0 + span.w - cx0);
      let lo = 1e9, hi = -1e9;
      for (let x = cx0 - 6; x < cx0 + w + 6; x += 4) { const y = lyG(pb, x / pb, 10); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      const top = Math.floor(lo) - base, H = Math.ceil(hi - lo) + base + 64;
      const buf = paintTuaBand({ W: w, H, lx0: cx0, p: pb, seed: 195, base, amp, k: 1, fog: FOG, haze: 0.02, hedge: true, lift: lx => lyG(pb, lx / pb, 10) - (top + base) });
      back.add(new Prop({ ...bigFrame(r, buf), ax: 0, ay: 0 }, cx0, top, 5));
    }
  }
  const backStrip = new Strip(0, 260);
  back.add(backStrip);
  const bTint = packColor(0.82, 0.87, 0.88, 1);
  for (let x = 30; x < TUA_W + 200; x += rng.range(40, 120)) {
    const b = bioPick(x, rng.next());
    const k = rng.next(), v = rng.int(0, 3);
    const X = x * pb, Y = lyG(pb, x, 12);
    let fr: (Frame & { sprite: Sprite }) | null = null, sway = 0;
    if (b === 'scrub' || (b === 'tussock' && k < 0.15) || (b === 'flats' && k < 0.12)) {
      if (k < 0.85) { fr = frameOf(`bk:${v}`, () => paintKanuka(3100 + v, 70 + v * 18, { flower: v === 2 ? 'white' : null })); sway = 0.12; }
      else fr = frameOf(`btk:${v % 2}`, () => paintTiKouka(3110 + (v % 2), 70 + (v % 2) * 16));
    } else if (b === 'burnt') {
      if (k < 0.55) fr = frameOf(`bch:${v}`, () => paintCharredTrunk(3120 + v, 90 + v * 40, 6 + v * 2, { scar: false }));
      else if (k < 0.75) fr = frameOf(`bbr:${v}`, () => paintBracken(3130 + v, 30 + v * 6));
    } else if (b === 'boa') {
      // (the fern clearing stays open to the sky: nothing tall behind it)
      if (x > TUA.arena[0] - 80 && x < TUA.arena[1] + 80) { if (k < 0.5) { fr = frameOf(`bcl:${v}`, () => plant('crownfern', 3145 + v, 40 + v * 4)); sway = 0.5; } }
      else if (k < 0.55) { fr = frameOf(`bf:${v}`, () => tree('treefern', 3140 + v * 13, 150 + v * 26)); sway = 0.5; }
      else if (k < 0.8) { fr = frameOf(`bb:${v % 2}`, () => tree('broadleaf', 3150 + v, 220 + (v % 2) * 40)); sway = 0.12; }
      else { fr = frameOf(`bg:${v % 2}`, () => paintGiant(v % 2 ? 'rimu' : 'kahikatea', 3160 + v, 46 + v * 6, 330, { epiphytes: 0.8, fadeTop: 90 })); }
    } else if (b === 'tussock' || b === 'flats') {
      if (k < 0.5) { fr = frameOf(`btu:${v}`, () => paintTussock(3170 + v, 34 + v * 4, { red: v === 3 })); sway = 0.5; }
      else if (k < 0.62) fr = frameOf(`bbo:${v}`, () => paintBoulder(3180 + v, 30 + v * 10, 20 + v * 7, { ramp: HP.greywacke, moss: 0.2 }));
    } else if (b === 'gorge' && k < 0.4) { fr = frameOf(`bwt:${v % 2}`, () => paintWindTree(3190 + (v % 2), 70 + v * 10, 90 + v * 14)); sway = 0.1; }
    if (fr) backStrip.add(new Prop(fr, X, Y + 4, rng.next(), { sway, flip: rng.chance(0.5), tint: bTint, foliage: sway > 0.3 ? 'fern' : sway > 0 ? 'tree' : false }));
  }

  // ---------------------------------------------------------------- the gameplay plane: the ground
  const main = st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  for (let x0 = 0; x0 < TUA_W; x0 += 1000) {
    const w = Math.min(1000, TUA_W - x0);
    const ch = paintTuaFloor(x0, w);
    const base = bigFrame(r, ch.base), wat = bigFrame(r, ch.water);
    const wet = TUA.streams.some(s => s.x + s.hw * 3 + 200 > x0 && s.x - s.hw * 3 - 200 < x0 + w) || TUA.braids.some(q => q.x + 260 > x0 && q.x - 260 < x0 + w);
    main.add(new Custom(-10, rr => {
      if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return;
      rr.draw(base, x0, ch.y0);
      if (wet) { rr.water(0.5, 0.8, 0.6); rr.draw(wat, x0, ch.y0); rr.water(0); }
    }));
  }
  main.add(new WoodsWater(tuaChannels(), tuaBase));

  // ---------------------------------------------------------------- the claw gorge's back wall
  const den = TUA.den, ledge = TUA.ledge;
  {
    const g = S.gorge, wx0 = g.x0 + 30, len = TUA_W - wx0;
    const notch = TUA.gorgeStream;
    const height = (x: number) => {
      const u = x - wx0;
      // (the gorge mouth: the wall climbs out of the tussock in broken steps and crags; at the far end it
      // falls away again, and the Hot Valley's steam shows over it)
      const rise = smoothstep(0, 620, u) * (1 - 0.8 * smoothstep(TUA_W - 760, TUA_W - 160, x));
      const crag = (Math.pow(Math.abs(noise1(x / 26, 79) - 0.5) * 2, 2) * 46 + (noise1(x / 9, 80) - 0.5) * 10) * (0.5 + (1 - rise));
      const stepK = Math.floor((noise1(x / 60, 81) * 0.6 + rise * 0.7) * 5) / 5;
      let h = 26 + (rise * 0.4 + stepK * 0.6) * (230 + fbm1(x / 260, 3, 77) * 200) + (noise1(x / 34, 78) - 0.5) * 36 * rise + crag;
      h += 140 * smoothstep(den - 700, den - 300, x) * (1 - smoothstep(den + 300, den + 700, x));
      h *= 1 - 0.78 * Math.exp(-(((x - notch) / 70) ** 2));
      return Math.max(14, h);
    };
    const wall = paintGorgeWall(len, {
      base: lx => G(lx + wx0) - 1, top: lx => G(lx + wx0) - height(lx + wx0), seed: 4441,
      recess: [{ x: den - wx0, w: 150, h: 88 }],
      shelf: { x0: ledge.x0 - wx0, x1: ledge.x1 - wx0, y: () => LEDGE_Y },
    });
    addWide(main, wall.buf, wx0, wall.y0, -11);
    // the side creek falls down the notch to join the gorge stream
    const nTop = G(notch) - height(notch) + 4;
    main.add(new Cascade(-10.5, notch, nTop, G(notch) - 2, 2));
    // ledges for the auks, high on the wall
    for (let x = g.x0 + 600; x < TUA_W - 100; x += rng.range(90, 180)) f.pois.push({ kind: 'nest', x, y: G(x) - rng.range(90, Math.min(220, height(x) - 20)) });
  }

  // ---------------------------------------------------------------- the walk line: trees, trunks, rocks, the story
  const walk = new Strip(-5, 320);
  main.add(walk);
  const nearPost = (x: number, rr: number) => TUA.posts.some(q => Math.abs(q - x) < rr) || Math.abs(x - (ledge.climb - 46)) < rr;
  const wetAt = (x: number, rr: number) => TUA.streams.some(s => Math.abs(s.x - x) < s.hw + rr);
  const clearAt = (x: number, rr: number) => wetAt(x, rr) || nearPost(x, rr) || Math.abs(x - den) < 110 + rr || Math.abs(x - TUA.cache) < 40 + rr
    || (x > TUA.arena[0] + 20 - rr && x < TUA.arena[1] - 20 + rr) || (x > ledge.climb - 20 - rr && x < ledge.x1 + rr) || TUA.kills.some(k => Math.abs(k - x) < 24 + rr) || Math.abs(x - TUA.wallow) < 50 + rr;
  const scoredSet = new Set(TUA.scored);
  const trunkPoi = (x: number, h: number) => f.pois.push({ kind: 'trunk', x, y: G(x), y1: G(x) - h * 0.7 }, { kind: 'branch', x: x + 10, y: G(x) - h * rng.range(0.55, 0.8) });
  // the giants of the gully, their trunks running up out of the frame
  const giants: number[] = [];
  for (let x = S.boa.x0 + 200; x < S.boa.x1 - 150; x += rng.range(420, 760)) if (!clearAt(x, 60) && !TUA.skins.some(q => Math.abs(q - x) < 160)) giants.push(Math.round(x));
  for (const x of giants) {
    const w = rng.range(56, 80), H = Math.round(G(x) - TUA_MIN_Y + 60);
    walk.add(new Prop(frameOf(`giant:${x}`, () => paintGiant(rng.chance(0.5) ? 'rimu' : 'kahikatea', x, w, H, { epiphytes: 1.2, vines: 1 })), x, G(x) + 4, -6.5));
    f.pois.push({ kind: 'trunk', x, y: G(x), y1: G(x) - 220 }, { kind: 'perch', x: x - w * 0.3, y: G(x) - rng.range(120, 200) });
  }
  const nearGiant = (x: number, rr: number) => giants.some(g => Math.abs(g - x) < 50 + rr);
  for (let x = 40; x < TUA_W - 40;) {
    const b = bioPick(x, rng.next());
    let step = 80;
    const k = rng.next(), v = rng.int(0, 2);
    const flip = rng.chance(0.5);
    if (clearAt(x, 26) || nearGiant(x, 20) || scoredSet.has(x)) { x += 30; continue; }
    if (b === 'scrub') {
      // kānuka in stands with clearings between; mānuka in flower; the odd cabbage tree and flax
      step = noise1(x / 380, 801) < 0.33 ? rng.range(140, 260) : rng.range(46, 110);
      if (k < 0.72) {
        const h = Math.round(rng.range(96, 168) / 24) * 24, fl = rng.chance(0.35) ? (rng.chance(0.25) ? 'pink' : 'white') : null;
        walk.add(new Prop(frameOf(`ka:${v}:${h}:${fl ?? ''}`, () => paintKanuka(3200 + v * 7 + h, h, { flower: fl as 'white' | 'pink' | null })), x, G(x) + 2, -5.8 + rng.next() * 0.3, { sway: 0.1, flip, foliage: 'tree' }));
        trunkPoi(x, h);
        if (fl) f.pois.push({ kind: 'flower', x, y: G(x) - h * 0.7 });
      } else if (k < 0.82) walk.add(new Prop(frameOf(`tk:${v}`, () => paintTiKouka(3210 + v, 90 + v * 20)), x, G(x) + 2, -5.6, { sway: 0.4, flip, foliage: 'plant' }));
      else walk.add(new Prop(frameOf(`fx:${v}`, () => plant('flax', 3220 + v, 30 + v * 5)), x, G(x) + 2, -4.6, { sway: 0.5, flip, foliage: 'plant' }));
    } else if (b === 'flats') {
      // open gravel: flax on the banks, a few kānuka at the edges of the terrace
      step = rng.range(90, 220);
      const edge = Math.min(x - S.flats.x0, S.flats.x1 - x) < 360;
      if (wetAt(x, 70) && k < 0.7) walk.add(new Prop(frameOf(`ffx:${v}`, () => plant('flax', 3230 + v, 30 + v * 6)), x, G(x) + 2, -4.6, { sway: 0.5, flip, foliage: 'plant' }));
      else if (edge && k < 0.6) { const h = 80 + v * 20; walk.add(new Prop(frameOf(`fka:${v}`, () => paintKanuka(3240 + v, h)), x, G(x) + 2, -5.8, { sway: 0.1, flip, foliage: 'tree' })); trunkPoi(x, h); }
    } else if (b === 'burnt') {
      // the dead stand: tall charred trunks running out of the frame, broken ones, stumps
      step = rng.range(60, 180);
      if (k < 0.45) {
        // (one height for the whole ridge, tall enough to run out of the frame from its lowest foot)
        const w = 9 + v * 3, H = Math.round(TUA_B0 + 50 - TUA_MIN_Y + 80);
        walk.add(new Prop(frameOf(`ct:${v}`, () => paintCharredTrunk(3250 + v, H, w, { broken: false })), x, G(x) + 3, -6 + rng.next() * 0.3, { flip }));
        trunkPoi(x, 200);
      } else if (k < 0.78) {
        const h = 70 + v * 34;
        walk.add(new Prop(frameOf(`cb:${v}`, () => paintCharredTrunk(3260 + v, h, 7 + v * 2)), x, G(x) + 3, -5.8, { flip }));
        f.pois.push({ kind: 'perch', x, y: G(x) - h + 2 }, { kind: 'trunk', x, y: G(x), y1: G(x) - h * 0.8 });
      } else if (k < 0.9) walk.add(new Prop(frameOf(`cs:${v}`, () => paintCharredStump(3270 + v, 10 + v * 3, 14 + v * 6)), x, G(x) + 2, -4.4, { flip }));
    } else if (b === 'boa') {
      // tree ferns crowding the gully, the taller black mamaku, a broadleaf now and then
      step = rng.range(48, 110);
      if (wetAt(x, 40)) { x += 30; continue; }
      if (k < 0.7) {
        const h = Math.round(rng.range(130, 250) / 30) * 30;
        walk.add(new Prop(frameOf(`tf:${v}:${h}`, () => tree('treefern', 3280 + v * 13 + h, h)), x, G(x) + 2, -5.7 + rng.next() * 0.3, { sway: 0.6, flip, foliage: 'fern' }));
        f.pois.push({ kind: 'trunk', x, y: G(x), y1: G(x) - h * 0.7 });
      } else if (k < 0.85) {
        const h = Math.round(rng.range(260, 320) / 30) * 30;
        walk.add(new Prop(frameOf(`mk:${v}:${h}`, () => tree('treefern', 3290 + v * 23 + h, h)), x, G(x) + 2, -5.9, { sway: 0.5, flip, tint: packColor(0.86, 0.9, 0.86, 1), foliage: 'fern' }));
      } else walk.add(new Prop(frameOf(`bl:${v % 2}`, () => tree('broadleaf', 3300 + v, 240 + (v % 2) * 50)), x, G(x) + 2, -6.1, { sway: 0.12, flip, foliage: 'tree' }));
    } else if (b === 'tussock') {
      // open: a hebe, a lone cabbage tree
      step = rng.range(160, 320);
      if (k < 0.4) walk.add(new Prop(frameOf(`hb:${v}`, () => paintHebe(3310 + v, 30 + v * 8, 18 + v * 5)), x, G(x) + 2, -4.6, { sway: 0.2, flip, foliage: 'bush' }));
      else if (k < 0.55) walk.add(new Prop(frameOf(`ttk:${v % 2}`, () => paintTiKouka(3320 + (v % 2), 100 + (v % 2) * 24)), x, G(x) + 2, -5.6, { sway: 0.4, flip, foliage: 'plant' }));
    } else {
      // the gorge: wind-bent beech in the gaps, ferns at the wall foot
      step = rng.range(140, 300);
      if (k < 0.4) { const h = 100 + v * 16; walk.add(new Prop(frameOf(`gw:${v}`, () => paintWindTree(3330 + v, 70 + v * 12, h)), x, G(x) + 3, -6, { sway: 0.1, flip, foliage: 'tree' })); trunkPoi(x, h); }
    }
    x += step;
  }
  // the scored trunks: the Bearer's marks on its ground
  for (const x of TUA.scored) {
    const b = bioPick(x, 0.5), v = x % 3;
    if (b === 'burnt') walk.add(new Prop(frameOf(`scc:${x}`, () => paintCharredTrunk(3400 + x, 150 + v * 30, 13 + v * 2, { claw: true })), x, G(x) + 3, -5.5));
    else walk.add(new Prop(frameOf(`sck:${x}`, () => paintKanuka(3410 + x, 150 + v * 16, { claw: true, lean: 0.04 })), x, G(x) + 2, -5.5, { sway: 0.08, foliage: 'tree' }));
    f.pois.push({ kind: 'trunk', x, y: G(x), y1: G(x) - 120 });
  }
  // rocks: outcrops behind, boulders on the walk line
  const rockRamp = (x: number): C[] => (bioW(x, 'gorge') > 0.5 ? TP.rock : bioW(x, 'tussock') > 0.5 ? HP.granite : HP.greywacke);
  for (const o of TUA.outcrops) {
    const tor = paintBoulder(o.seed, o.w, o.h, { ramp: rockRamp(o.x), lichen: 0.9, moss: bioW(o.x, 'boa') > 0.3 ? 0.8 : 0.25 });
    const s = sprite(`tua:oc:${o.seed}`, () => tor);
    if (s) walk.add(new Prop(s.f, o.x, G(o.x) + 6, -6.3));
    f.pois.push({ kind: 'rock', x: o.x, y: G(o.x) - o.h + 8 }, { kind: 'perch', x: o.x + 4, y: G(o.x) - o.h + 4 }, { kind: 'sun', x: o.x - o.w * 0.6, y: G(o.x) });
  }
  for (const o of TUA.boulders) {
    const s = sprite(`tua:bo:${o.seed}`, () => paintBoulder(o.seed, o.w, o.h, { ramp: rockRamp(o.x), lichen: 0.7, moss: bioW(o.x, 'boa') > 0.3 ? 0.8 : 0.25 }));
    if (s) walk.add(new Prop(s.f, o.x, G(o.x) + 5, -4.8));
    f.pois.push({ kind: 'rock', x: o.x, y: G(o.x) - o.h + 6 });
  }
  for (const l of TUA.logs) {
    const b = bioPick(l.x, 0.5);
    const fr = b === 'boa' ? frameOf(`lg:b:${l.seed % 2}`, () => deadwood(l.seed % 2 ? 'log' : 'rottenlog', 3420 + (l.seed % 2), 60 + (l.seed % 2) * 20)) : frameOf(`lg:${b}:${l.seed}`, () => paintLog(l.seed, l.len, b === 'burnt' ? 'char' : 'drift'));
    walk.add(new Prop(fr, l.x + l.len / 2, G(l.x + l.len / 2) + 3, -4.2, { flip: l.seed % 2 === 0 }));
  }
  // the cairns marking the track
  for (const x of TUA.cairns) walk.add(new Prop(frameOf(`cairn:${x % 4}`, () => paintTrailCairn(3430 + (x % 4), 24 + (x % 4) * 4)), x, G(x) + 2, -3.4));
  // the feathered boa: its shed skins over logs, its wallow, plumes in the grass
  for (const x of TUA.skins) walk.add(new Prop(frameOf(`skin:${x}`, () => paintSkinLog(3440 + x, 120)), x, G(x) + 3, -4));
  main.add(new Prop(frameOf('wallow', () => paintWallow(3450, 130)), TUA.wallow, tuaBase(TUA.wallow) + 16, 58.6, { foliage: false }));
  f.pois.push({ kind: 'soft', x: TUA.wallow, y: G(TUA.wallow) });
  for (const x of TUA.feathers) {
    const up = rng.chance(0.35), v = rng.int(0, 3);
    const fr = frameOf(`pl:${v}:${up ? 1 : 0}`, () => paintPlume(3460 + v, 14 + v * 3, up));
    main.add(new Prop(fr, x, G(x) + (up ? 2 : rng.range(3, 9)), up ? -2 : 58.4, { sway: up ? 0.6 : 0, flip: rng.chance(0.5), foliage: up ? 'grass' : false }));
  }
  // the kill sites: picked-clean bones in the grass, the scavengers' carrion
  TUA.kills.forEach((x, i) => {
    walk.add(new Prop(frameOf(`kill:${i}`, () => paintBonePile(3470 + i, 64 + (i % 2) * 16, i === 2 ? 'beast' : 'serpent')), x, G(x) + 4, -3.2, { flip: i % 2 === 1 }));
    f.pois.push({ kind: 'carrion', x, y: G(x), amount: 20 });
  });
  // the Bearer's den mouth at the foot of the wall, its cache beside it
  walk.add(new Prop(frameOf('den', () => paintDenMouth(3480, 150, 88)), den, G(den) + 3, -8));
  walk.add(new Prop(frameOf('cache', () => paintCache(3481, 64)), TUA.cache, G(TUA.cache) + 3, -3.6));
  f.pois.push({ kind: 'den', x: den, y: G(den) }, { kind: 'carrion', x: TUA.cache, y: G(TUA.cache), amount: 30 });

  // ---------------------------------------------------------------- ground cover: behind the walk line and over the feet
  const movers = (): Mover[] => {
    const out: Mover[] = [{ x: f.player.x, y: f.player.y, vx: f.player.vx }];
    for (const a of f.actors.values()) if (a.visible) out.push({ x: a.x, y: a.y, vx: a.walking ? a.facing * 40 : 0 });
    for (const an of f.animals) if (!an.dead && !an.gone && an.medium === 'ground') out.push({ x: an.x, y: an.y, vx: an.vx });
    return out;
  };
  const me = () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx });
  const backCover = new GroundCover(-2.4, movers, me), frontCover = new GroundCover(58, movers, me);
  main.add(backCover); main.add(frontCover);
  const tuft = (kinds: PlantKind[], sizes: [number, number]) => {
    const kind = kinds[rng.int(0, kinds.length - 1)], v = rng.int(0, 3), s = Math.round(rng.range(sizes[0], sizes[1]) / 4) * 4;
    return frameOf(`tuft:${kind}:${v}:${s}`, () => plant(kind, 3500 + v * 7 + s, s));
  };
  const tus = (size: number, red = false) => { const v = rng.int(0, 3), s = Math.round(size / 4) * 4; return frameOf(`tu:${v}:${s}:${red ? 1 : 0}`, () => paintTussock(3510 + v * 7 + s, s, { red })); };
  const brk = (size: number) => { const v = rng.int(0, 3), s = Math.round(size / 6) * 6; return frameOf(`brk:${v}:${s}`, () => paintBracken(3520 + v + s, s)); };
  const fwd = (size: number) => { const v = rng.int(0, 2), s = Math.round(size / 6) * 6; return frameOf(`fw:${v}:${s}`, () => paintFireweed(3530 + v + s, s)); };
  const spn = () => { const v = rng.int(0, 2); return frameOf(`sp:${v}`, () => paintSpaniard(3540 + v, 24 + v * 4)); };
  const dsy = () => { const v = rng.int(0, 2); return frameOf(`ds:${v}`, () => paintDaisy(3550 + v, 16 + v * 3)); };
  const DENSE: Record<Biome, number> = { scrub: 0.72, flats: 0.32, burnt: 0.62, boa: 0.92, tussock: 0.95, gorge: 0.4 };
  // (the story props stay in view: no tall cover in front of a shed skin, a kill, a cairn)
  const storyAt = (x: number) => TUA.skins.some(q => Math.abs(q - x) < 76) || TUA.kills.some(q => Math.abs(q - x) < 46) || TUA.cairns.some(q => Math.abs(q - x) < 18);
  for (let x = 24; x < TUA_W - 10; x += rng.range(9, 20)) {
    if (wetAt(x, 4) || Math.abs(x - den) < 70 || nearPost(x, 10) || Math.abs(x - TUA.cache) < 30 || storyAt(x)) continue;
    const b = bioPick(x, rng.next());
    if (rng.next() > DENSE[b]) continue;
    const k = rng.next();
    const gy = G(x) + 1;
    if (b === 'scrub') backCover.add(k < 0.5 ? tus(rng.range(22, 36)) : k < 0.62 ? spn() : tuft(['grass', 'sedge', 'grass'], [20, 30]), x, gy, rng.chance(0.5), undefined, 'grass');
    else if (b === 'flats') backCover.add(wetAt(x, 40) ? tuft(['sedge', 'grass'], [16, 26]) : tus(rng.range(16, 26)), x, gy, rng.chance(0.5), undefined, 'grass');
    else if (b === 'burnt') { const f2 = k < 0.5 ? brk(rng.range(26, 44)) : k < 0.72 ? fwd(rng.range(24, 40)) : tus(rng.range(18, 28)); backCover.add(f2, x, gy, rng.chance(0.5), undefined, k < 0.5 ? 'fern' : k < 0.72 ? 'flower' : 'grass'); }
    else if (b === 'boa') backCover.add(x > TUA.arena[0] && x < TUA.arena[1] ? tuft(['fern', 'kidneyfern', 'moss', 'fern'], [14, 26]) : tuft(['crownfern', 'kiokio', 'umbrellafern', 'fern', 'kiokio'], [26, 48]), x, gy, rng.chance(0.5), undefined, 'fern');
    else if (b === 'tussock') backCover.add(k < 0.8 ? tus(rng.range(26, 44), rng.chance(0.3)) : k < 0.9 ? spn() : dsy(), x, gy, rng.chance(0.5), undefined, k < 0.8 ? 'grass' : 'plant');
    else backCover.add(k < 0.5 ? tuft(['fern', 'kiokio'], [20, 34]) : tus(rng.range(18, 28)), x, gy, rng.chance(0.5), undefined, k < 0.5 ? 'fern' : 'grass');
  }
  for (let x = 20; x < TUA_W - 10; x += rng.range(18, 40)) {
    if (wetAt(x, 10) || Math.abs(x - den) < 60 || storyAt(x)) continue;
    const b = bioPick(x, rng.next());
    if (rng.next() > DENSE[b] + 0.1) continue;
    const k = rng.next();
    const fr = b === 'boa' ? tuft(['kidneyfern', 'moss', 'fiddlehead', 'fern', 'seedling'], [12, 24])
      : b === 'burnt' ? (k < 0.6 ? brk(rng.range(14, 22)) : tuft(['seedling', 'grass'], [10, 16]))
        : b === 'tussock' || b === 'scrub' ? (k < 0.7 ? tus(rng.range(14, 22), rng.chance(0.2)) : k < 0.85 ? dsy() : tuft(['grass', 'sedge'], [12, 18]))
          : tuft(['sedge', 'grass', 'moss'], [10, 18]);
    frontCover.add(fr, x + rng.range(-4, 4), G(x) + rng.range(4, 9), rng.chance(0.5), undefined, b === 'boa' || (b === 'burnt' && k < 0.6) ? 'fern' : 'grass');
  }

  // ---------------------------------------------------------------- the floor in front of the walk line, in depth
  const floor = new Strip(60, 120);
  main.add(floor);
  const inWater = (x: number, dd: number) => TUA.streams.some(s => { if (Math.abs(s.x - x) > s.hw * 3 + 200) return false; const [cx, hw] = streamAt(s, dd); return Math.abs(x - cx) < hw + 24 * wpersp(dd); });
  const stones = [0, 1, 2, 3].map(i => frameOf(`st:${i}`, () => paintScreeStone(3600 + i, 7 + i * 3, 5 + i * 2)));
  const smallB = (x: number) => { const v = rng.int(0, 2); return frameOf(`sb:${v}:${bioW(x, 'gorge') > 0.5 ? 1 : 0}`, () => paintBoulder(3610 + v, 26 + v * 14, 18 + v * 9, { ramp: bioW(x, 'gorge') > 0.5 ? TP.rock : HP.greywacke, moss: 0.3 })); };
  const mounds = [0, 1].map(i => frameOf(`mm:${i}`, () => paintMossMound(3620 + i, 22 + i * 14)));
  const fungi = [0, 1].map(i => frameOf(`fu:${i}`, () => fungus(i ? 'bracket' : 'inkcap', 3630 + i, 16)));
  for (let x = 30; x < TUA_W; x += rng.range(22, 46)) {
    const dd = rng.range(16, 150);
    if (inWater(x, dd)) continue;
    const b = bioPick(x, rng.next());
    const k = rng.next();
    let fr: (Frame & { sprite: Sprite }) | null = null, fol: 'grass' | 'fern' | 'bush' | false = false, sway = 0;
    if (b === 'scrub') { if (k < 0.55) { fr = tus(rng.range(26, 40)); fol = 'grass'; sway = 0.5; } else if (k < 0.75) fr = stones[rng.int(0, 3)]; else if (k < 0.85) fr = smallB(x); else { fr = spn(); fol = 'bush'; sway = 0.3; } }
    else if (b === 'flats') { if (k < 0.3) fr = frameOf(`gb:${rng.int(0, 3)}`, () => paintGravelBar(3640 + rng.int(0, 3), 70 + rng.int(0, 3) * 18)); else if (k < 0.65) fr = stones[rng.int(0, 3)]; else if (k < 0.75) fr = frameOf(`tw:${rng.int(0, 2)}`, () => paintLog(3650 + rng.int(0, 2), 30, 'drift')); else if (k < 0.85) fr = smallB(x); else { fr = tuft(['sedge', 'grass'], [14, 22]); fol = 'grass'; sway = 0.5; } }
    else if (b === 'burnt') { if (k < 0.4) { fr = brk(rng.range(26, 42)); fol = 'fern'; sway = 0.5; } else if (k < 0.55) { fr = fwd(rng.range(24, 36)); fol = 'grass'; sway = 0.5; } else if (k < 0.75) fr = frameOf(`fcs:${rng.int(0, 2)}`, () => paintCharredStump(3660 + rng.int(0, 2), 7 + rng.int(0, 2) * 3, 10 + rng.int(0, 2) * 5)); else if (k < 0.85) fr = frameOf(`fcl:${rng.int(0, 1)}`, () => paintLog(3670 + rng.int(0, 1), 50, 'char')); else fr = stones[rng.int(0, 3)]; }
    else if (b === 'boa') { if (k < 0.45) { fr = tuft(['crownfern', 'kiokio', 'fern', 'umbrellafern'], [26, 44]); fol = 'fern'; sway = 0.5; } else if (k < 0.65) fr = mounds[rng.int(0, 1)]; else if (k < 0.75) fr = fungi[rng.int(0, 1)]; else if (k < 0.85) fr = frameOf(`frl:${rng.int(0, 1)}`, () => deadwood(rng.chance(0.5) ? 'rottenlog' : 'log', 3680 + rng.int(0, 1), 50)); else { fr = tuft(['kidneyfern', 'fiddlehead'], [14, 22]); fol = 'fern'; sway = 0.4; } }
    else if (b === 'tussock') { if (k < 0.6) { fr = tus(rng.range(28, 46), rng.chance(0.3)); fol = 'grass'; sway = 0.55; } else if (k < 0.7) { fr = spn(); fol = 'bush'; sway = 0.3; } else if (k < 0.78) { fr = dsy(); fol = 'grass'; sway = 0.4; } else if (k < 0.9) fr = stones[rng.int(0, 3)]; else fr = smallB(x); }
    else { if (k < 0.45) fr = stones[rng.int(0, 3)]; else if (k < 0.72) fr = smallB(x); else if (k < 0.86) { fr = tuft(['fern', 'kiokio'], [20, 32]); fol = 'fern'; sway = 0.4; } else { fr = frameOf(`gcu:${rng.int(0, 1)}`, () => paintCushion(3690 + rng.int(0, 1), 18)); } }
    if (!fr) continue;
    floor.add(new Prop(fr, x, tuaBase(x) + dd, 60 + dd * 0.02, { sway, flip: rng.chance(0.5), foliage: fol }));
  }
  // hide spots in the thickest cover
  const hides: TuaRuntime['hides'] = [];
  const hideCover = new GroundCover(66, movers, me);
  main.add(hideCover);
  const hideXs = [R('scrub', 0.36)[0], R('scrub', 0.7)[0], R('flats', 0.3)[0], R('burnt', 0.6)[0], TUA.arena[0] - 90, TUA.arena[1] + 90, R('boa', 0.86)[0], R('tussock', 0.42)[0], den - 560];
  for (let x of hideXs) {
    while (wetAt(x, 20) || nearPost(x, 30)) x += 30;
    const b = bioPick(x, 0.5);
    const s = sprite(`tua:hide:${b}`, () => (b === 'boa' ? plant('crownfern', 3700, 46) : b === 'burnt' ? paintBracken(3701, 46) : b === 'gorge' ? plant('fern', 3702, 44) : paintTussock(3703, 48, { red: b === 'tussock' })));
    const y = G(x) + 3;
    if (s) {
      hideCover.add(s.f, x, y, false, undefined, b === 'boa' || b === 'burnt' || b === 'gorge' ? 'fern' : 'grass');
      f.occluders.push({ mask: s.s.buf, x, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x, y, w: 18 });
    hides.push({ x, w: 30, y, cover: 0.82 });
  }

  // ---------------------------------------------------------------- the ledge over the den
  {
    const { x0, x1, climb } = ledge;
    st.terrain.addPlatform([[x0 + 2, LEDGE_Y], [x1 - 2, LEDGE_Y]], 'rock' as never);
    const ld = { x: climb, y0: LEDGE_Y, y1: G(climb) };
    st.terrain.addClimb(climb, ld.y0, ld.y1, 'vine');
    (f.interact as Interactable[]).push({ x: climb, y: ld.y1, w: 14, h: 18, label: 'Scramble up onto the ledge <span style="opacity:.75">(hand over hand)</span>', standX: climb, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - ld.y1) < 12, action: () => f.climbLadder(ld, -1) });
    (f.interact as Interactable[]).push({ x: climb, y: ld.y0, w: 14, h: 18, label: 'Climb back down', standX: climb, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - ld.y0) < 12, action: () => f.climbLadder(ld, 1) });
    // hand- and footholds: worn pale scuffs up the face, a knotted old rope left by somebody
    main.add(new Custom(-10.4, rr => {
      if (climb < rr.visibleX0(20) || climb > rr.visibleX1(20)) return;
      for (let y = LEDGE_Y + 5; y < G(climb) - 3; y += 8) rr.rect(climb - 3 + ((y / 8) % 2) * 4, y, 2, 1, packColor(0.72, 0.68, 0.6, 0.7));
      for (let y = LEDGE_Y - 2; y < G(climb) - 2; y += 1) rr.rect(climb + 1 + Math.round(Math.sin(y * 0.15) * 0.6), y, 1, 1, (y % 6) === 0 ? packColor(0.42, 0.32, 0.2, 1) : packColor(0.6, 0.5, 0.34, 1));
    }));
    f.pois.push({ kind: 'perch', x: x1 - 20, y: LEDGE_Y - 2 }, { kind: 'perch', x: x0 + 30, y: LEDGE_Y - 2 });
  }

  // ---------------------------------------------------------------- terrain
  {
    const pts: [number, number][] = [];
    for (let x = 0; x <= TUA_W; x += 6) pts.push([x, G(x)]);
    st.terrain.addGround(pts, 'ground');
  }
  // POIs the wildlife uses
  for (const s of TUA.streams) {
    f.pois.push({ kind: 'water', x: s.x, y: tuaBase(s.x), y1: G(s.x), w: s.hw });
    if (s.kind === 'braid' && s.depth < 5) f.pois.push({ kind: 'shallows', x: s.x, y: G(s.x), w: s.hw } as never);
    f.pois.push({ kind: 'bank', x: s.x - s.hw - 30, y: G(s.x - s.hw - 30) } as never, { kind: 'mud', x: s.x + s.hw + 26, y: G(s.x + s.hw + 26) });
  }
  for (let x = S.scrub.x0 + 400; x < S.scrub.x1; x += rng.range(160, 300)) f.pois.push({ kind: 'burrow', x, y: G(x) });
  for (let x = S.tussock.x0 + 300; x < S.tussock.x1; x += rng.range(200, 320)) f.pois.push({ kind: 'burrow', x, y: G(x) }, { kind: 'leaves', x: x + 60, y: G(x + 60), amount: 30 });
  for (let x = S.boa.x0 + 200; x < S.boa.x1; x += 300) f.pois.push({ kind: 'leaves', x, y: G(x), amount: 30 }, { kind: 'soft', x: x + 90, y: G(x + 90) });
  f.sunspots.push({ x: S.flats.x0, w: S.flats.x1 - S.flats.x0 }, { x: S.tussock.x0, w: S.tussock.x1 - S.tussock.x0 }, { x: TUA.crest[0] - 200, w: TUA.crest[1] - TUA.crest[0] + 400 });

  // ---------------------------------------------------------------- light, shade, air, wind
  const shade = new WoodsShade(clock, tuaCanopy, G);
  main.add(shade);
  main.add(new WoodsRays(clock, main, [[(TUA.arena[0] + TUA.arena[1]) / 2, 260, 1.1], [TUA.creekX, 140, 0.8], [S.boa.x0 + 260, 120, 0.7]], G));
  const gust = new TuaGusts();
  main.add(gust);
  main.add(new TuaAir(main, gust, () => clock.night));
  main.add(new TuaMist(-2.6, G(TUA.creekX) - 30, 4, 0.34, 61, 640, 56, '#d4e2d4', x => bioW(x, 'boa')));

  // ---------------------------------------------------------------- the foreground framing
  tuaFront(f, frameOf, rng);

  // ---------------------------------------------------------------- the light
  st.envHook = (env: Env) => {
    const e = envAt(clock.t);
    Object.assign(env, e);
    const px = f.player ? f.player.x : TUA_MORE.enter;
    const cov = tuaCanopy(px), wb = bioW(px, 'burnt'), wg = bioW(px, 'gorge'), wf = bioW(px, 'flats') + bioW(px, 'tussock') * 0.6;
    const night = clock.night;
    const g3 = (a: readonly number[], m: readonly number[], s: number): [number, number, number] => [a[0] * (1 - s) + m[0] * s, a[1] * (1 - s) + m[1] * s, a[2] * (1 - s) + m[2] * s];
    // under the gully's canopy: greener, cooler, misty (the woods' light)
    env.ambientTop = g3(e.ambientTop, [e.ambientTop[0] * 0.78, e.ambientTop[1] * 0.94, e.ambientTop[2] * 0.84], cov * 0.9);
    env.ambientBottom = g3(e.ambientBottom, [e.ambientBottom[0] * 0.72, e.ambientBottom[1] * 0.88, e.ambientBottom[2] * 0.8], cov);
    const mist = [0.56 - night * 0.42, 0.68 - night * 0.5, 0.62 - night * 0.42];
    env.fogTop = g3(env.fogTop, mist, cov * 0.8);
    env.fogBottom = g3(env.fogBottom, [mist[0] * 1.08, mist[1] * 1.08, mist[2] * 1.02], cov * 0.85);
    // the burnt ridge: a dry, ashy haze, the colour drained a little
    env.fogTop = g3(env.fogTop, [0.66 - night * 0.48, 0.62 - night * 0.46, 0.58 - night * 0.42], wb * 0.3);
    env.saturation *= 1 - wb * 0.12;
    // the gorge: down in the walls' shadow, cooler and harder
    env.ambientTop = g3(env.ambientTop, [env.ambientTop[0] * 0.9, env.ambientTop[1] * 0.94, env.ambientTop[2] * 1.02], wg * 0.6);
    env.contrast *= 1 + wg * 0.05;
    // the open flats and the tussock: big light
    env.exposure *= 1 + wf * 0.04 + cov * 0.07;
    env.bloom += cov * 0.08 + clock.morning * 0.06;
    env.vignette += cov * 0.12 + wg * 0.05;
    env.saturation *= 1 + cov * 0.08;
    env.waterAxis = Math.round(tuaBase(px)) - 1;
    st.preset.lightK = lightKAt(clock.t) * (1 + cov * 0.15) + cov * 0.08;
  };

  // ---------------------------------------------------------------- the crossroads, the residents
  registerPosts(f, posts());
  const run: TuaRuntime = {
    clock, main, hides,
    enter: fs => {
      for (const h of hides) if (!fs.player.hides.some(q => q.x === h.x)) fs.player.hides.push(h);
      const cam = fs.st.cam;
      cam.zoom = cam.tzoom = zoomAt(fs.player.x);
      cam.y = cam.ty = Math.min(fs.player.y, G(fs.player.x)) - CAM_UP;
      placeKey = ''; ambKey = '';
    },
    update: (fs, dt) => tick(fs, dt, run, shade),
  };
  for (const fn of tuaHooks.build) {
    try { fn(f); } catch (err) { console.error('[backcountry] build hook', err); }
  }
  return run;
}

// ---------------------------------------------------------------- the foreground framing
function tuaFront(f: FieldScene, frameOf: (key: string, gen: () => Sprite) => Frame & { sprite: Sprite }, rng: Rng) {
  const st = f.st;
  const pf = 1.32, front = st.addLayer('front', pf, 0, 0.45, 0, pf);
  const strip = new Strip(0, 260);
  front.add(strip);
  const dark = FP.canopy[0];
  // (rows at the base camera height over the local ground, as the woods do it)
  const yAt = (sy: number, x: number) => 180 + (sy - 180) / Math.pow(Z0, pf) + (tuaGround(x) - CAM_UP - 180) * pf;
  const occ = (s: Sprite, x: number, y: number, flip: boolean) => f.occluders.push({ mask: s.buf, x, y, ax: s.ax, ay: s.ay, sx: flip ? -1 : 1, sy: 1, p: pf, z: 0 });
  const keep = [...TUA.posts, TUA.den, TUA.cache, (TUA.arena[0] + TUA.arena[1]) / 2, TUA.wallow, TUA.ledge.climb, ...TUA.kills, ...TUA.skins, 160, TUA_W - 160];
  for (let x = 120; x < TUA_W + 300; x += rng.range(130, 280)) {
    if (keep.some(q => Math.abs(q - x) < 150)) continue;
    const b = bioPick(x, rng.next());
    const k = rng.next(), v = rng.int(0, 2);
    let fr: Frame & { sprite: Sprite };
    let sway = 0.45;
    if (b === 'boa') fr = k < 0.55 ? frameOf(`ffs:${v}`, () => fgFernSpray(3800 + v, 76 + v * 14, false, 1, dark, 0.62)) : frameOf(`ffl:${v}`, () => fgPlant(k < 0.8 ? 'fronds' : 'leaves', 3810 + v, 92 + v * 10, 1, dark, 0.64));
    else if (b === 'burnt') fr = k < 0.6 ? frameOf(`fbr:${v}`, () => soften(paintBracken(3820 + v, 70 + v * 12), 1, dark, 0.55)) : (sway = 0, frameOf(`fcs:${v}`, () => soften(paintCharredStump(3830 + v, 26 + v * 6, 40 + v * 16), 1, dark, 0.62)));
    else if (b === 'gorge') { sway = 0; fr = k < 0.5 ? frameOf(`fcr:${v}`, () => soften(paintCrag(3840 + v, 120 + v * 30, 520), 2, dark, 0.7)) : frameOf(`fbo:${v}`, () => soften(paintBoulder(3850 + v, 140 + v * 30, 100 + v * 20, { ramp: TP.rock, lichen: 0.5 }), 2, dark, 0.66)); }
    else if (b === 'scrub' && k < 0.35) fr = frameOf(`fka:${v}`, () => soften(paintKanuka(3860 + v, 150 + v * 20), 1, dark, 0.6));
    else fr = k < 0.65 ? frameOf(`ftu:${v}`, () => soften(paintTussock(3870 + v, 86 + v * 12, { red: v === 1 }), 1, dark, 0.5)) : frameOf(`ffx:${v}`, () => soften(plant('flax', 3880 + v, 70 + v * 10), 1, dark, 0.6));
    const X = x * pf, flip = rng.chance(0.5);
    const tall = b === 'gorge' && k < 0.5;
    const y = yAt(372, x) + 4 + rng.range(4, 20) + (b === 'gorge' ? 40 : 0) + (tall ? 30 : 0);
    strip.add(new Prop(fr, X, y, rng.next(), { sway, flip, foliage: sway ? (b === 'boa' ? 'fern' : 'grass') : false }));
    occ(fr.sprite, X, y, flip);
  }
  // hanging into the top of the frame, only where the gully's canopy closes over
  for (let x = 60; x < TUA_W + 300; x += rng.range(150, 280)) {
    if (tuaCanopy(x) < 0.4) continue;
    const k = rng.next(), v = rng.int(0, 2);
    const fr = k < 0.4 ? frameOf(`fh:${v}`, () => fgFernSpray(3890 + v, 66 + v * 10, true, 1, dark, 0.6)) : k < 0.7 ? frameOf(`fv:${v}`, () => fgVines(3900 + v, 80, 70 + v * 20, 1, dark, 0.6)) : frameOf(`fc:${v}`, () => soften(canopyClump(3910 + v, 200, 70, { above: 260 }), 1, dark, 0.58));
    strip.add(new Prop(fr, x * pf, yAt(-6, x) + (k < 0.7 ? -14 : 10), 2 + rng.next(), { sway: 0.25, flip: rng.chance(0.5), foliage: 'vine' }));
  }
}

// ---------------------------------------------------------------- every frame
let placeKey = '', ambKey = '';
let stepT = 0, deepT = 0, toldDeep = false, climbT = 0;
function tick(f: FieldScene, dt: number, run: TuaRuntime, shade: WoodsShade) {
  const p = f.player;
  if (!p) return;
  const clock = run.clock;
  clock.update(dt);
  const tod = todOf(clock.t);
  if (tod !== f.tod) { f.tod = tod; f.night = tod === 'night'; f.insects.night = f.night; ambKey = ''; }
  // the bed of sound: wind over the open country, the bush in the gully
  const amb: Ambience = bioW(p.x, 'boa') > 0.5 ? 'forest' : 'canopy';
  if (amb + f.night !== ambKey) { ambKey = amb + f.night; audio.setAmbience(amb, f.night); }
  // the camera: close in the gully, wider over the flats; riding over the ground, up onto the ledge
  const cam = f.st.cam;
  if (!cam.locked && !f.cam.active) { cam.tzoom = damp(cam.tzoom, zoomAt(p.x), 1.2, dt); cam.ty = Math.min(p.y, tuaGround(p.x)) - CAM_UP; }
  // dappled shade on everyone in the gully
  const tint = (a: { x: number; tint: number }) => { const s = shade.sample(a.x, f.st.time); const kk = 1 - s * 0.3; a.tint = s > 0.01 ? packColor(kk, kk, kk * 1.02, 1) : WHITE; };
  tint(p.body as unknown as { x: number; tint: number });
  for (const a of f.actors.values()) tint(a as unknown as { x: number; tint: number });
  // wading the braids and the creek: slower, wetter, hungrier
  const d = tuaDepth(p.x);
  const onBed = p.onGround && Math.abs(p.y - tuaGround(p.x)) < 4;
  const busy = f.cutscene || game.ui.blocking;
  if (onBed && d > 1.4 && p.state !== 'swim') {
    p.wadeK = d > 6 ? 0.6 : d > 3.5 ? 0.74 : 0.88;
    p.ground = 'water';
    const moving = Math.abs(p.vx) > 8;
    if (moving && !busy) {
      if (d > 4) addHunger(dt * 0.00028, 'wade');
      deepT += dt;
      if (d > 5.5 && deepT > 2.5 && !toldDeep) { toldDeep = true; void floatText({ text: rand.pick(['Cold! COLD. That\'s snow, that water. Yesterday it was snow.', 'Thigh deep and pushing. Feet sideways. Don\'t fight the current.']), style: 'scared', ms: 2600 }); }
      stepT -= dt * Math.abs(p.vx) / 40;
      if (stepT <= 0) {
        stepT = 0.5;
        audio.play('stepWater', { vol: 0.3, pitch: rand.range(0.55, 0.75) });
        for (let i = 0; i < 3; i++) f.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-4, 4), y: tuaBase(p.x) - 1, vx: rand.range(-20, 20), vy: rand.range(-40, -16), ay: 220, life: rand.range(0.3, 0.6), color: [0.85, 0.95, 0.96], alpha: 0.8, alpha1: 0 });
      }
    }
  } else if (p.wadeK < 1 && p.state !== 'swim' && p.ground === 'water') {
    p.wadeK = 1;
    p.ground = 'grass';
    deepT = 0;
  }
  // the long climbs (up the burnt ridge, up the gorge's steps) make him hungrier
  if (onBed && Math.abs(p.vx) > 20 && !busy) {
    const slope = (tuaGround(p.x + 6) - tuaGround(p.x - 6)) / 12 * Math.sign(p.vx);
    if (slope < -0.22) { climbT += dt; addHunger(dt * 0.00012, 'climb'); }
    else climbT = Math.max(0, climbT - dt);
  }
  // the place
  const [n, sub] = tuaZone(p.x);
  const key = n + '|' + sub;
  if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(n, `${sub} · Day ${game.save.day || 1}`); }
  for (const fn of tuaHooks.update) {
    try { fn(f, dt); } catch (err) { console.error('[backcountry] update hook', err); }
  }
}

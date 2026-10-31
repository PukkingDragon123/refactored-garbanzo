// V11 Fernwood Floor, Te Ngāhere, rebuilt on the Te Wao Nui kit (./kit.ts) and made much longer, so it
// reads as the next valley of the same great forest: over the ridge from Te Wao Nui, down through a
// grove of tree ferns, across the frog gully and its pool, under the giant black mamaku, to the
// colossal kauri you can climb to the canopy and the stream that leads uphill to Thunder Falls.
// The V2 site's content is kept (its clues, resource nodes, spawns, POIs and the ways on; the map's
// finds in v10/finds.ts follow the new layout).
//
//   0 ─ Te Pae, over the ridge ─ 800 ─ Ngā Ponga, the tree fern grove ─ 1720 ─ Te Kōawa Iti, the frog
//   gully ─ 2320 ─ Ngā Mamaku, the black tree ferns ─ 3340 ─ Te Kauri Nui, the giant kauri ─ 4400

import type { FieldScene, FieldSite } from '../../scenes/field';
import { Prop, Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { tree } from '../../../art/jungle-trees';
import { paintLedge } from '../../../art/v9/eastart';
import { paintGiant } from '../../../art/v11/forest/trees';
import { paintFallenLog } from '../../../art/v11/forest/props';
import { local } from '../../assets';
import { clamp, noise1, smoothstep } from '../../../core/math';
import { wpersp, wrealZ } from '../../../art/v11/woods/floor';
import type { Channel } from '../../../art/v11/woods/floor';
import { buildWoods } from './kit';
import type { WoodsRuntime, WoodsSeg } from './kit';
import { FOREST, forestBaseRaw } from '../forest/layout';
import { clueSpot, arrive } from '../../sites2';
import { node } from '../../sites2/common';
import { game } from '../../game';
import { currentExpedition, expeditionHour } from '../../v10/expedition';
import type { Interactable } from '../../../world/npc';

export const FW = { W: 4400, minY: -120, maxY: 410 };
export const FW_ZONES: [number, number, string, string][] = [
  [0, 800, 'Te Pae', 'Over the ridge'],
  [800, 1720, 'Ngā Ponga', 'The tree fern grove'],
  [1720, 2320, 'Te Kōawa Iti', 'The frog gully'],
  [2320, 3340, 'Ngā Mamaku', 'The black tree ferns'],
  [3340, 4401, 'Te Kauri Nui', 'The giant kauri'],
];
/** the frog gully: the walk line drops to a creek and its pool */
export const FW_GULLY = { x: 1990, top0: 1760, bot0: 1930, bot1: 2060, top1: 2240, depth: 40, w: 14 };
/** the stream that comes down from Thunder Falls (the way on, uphill) */
export const FW_STREAM = { x: 4300, w: 18 };
export const FW_SPOT = {
  enter: 90, exit: 30,
  kauri: 4000,
  /** the ways on: up the kauri to the canopy, up the stream to the falls */
  climb: 4060, falls: 4360,
  pool: FW_GULLY.x + 70,
  log: [2560, 2900] as [number, number],
};

const bump = (x: number, a: number, b: number, h: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI) * h);
function gullyDip(x: number) {
  const g = FW_GULLY;
  if (x <= g.top0 || x >= g.top1) return 0;
  return g.depth * smoothstep(g.top0, g.bot0, x) * (1 - smoothstep(g.bot1, g.top1, x));
}
/** V12 (the big region, src/game/v12/region.ts): Fernwood starts on Te Wao Nui's ridge, at exactly the
 *  height the forest's walk line ends at, and comes down off it through Te Pae */
let seamDy: number | null = null;
const ridgeDy = () => (seamDy ??= forestBaseRaw(FOREST.W) - fwBase0(0));
function fwBase0(x: number): number {
  return 214 + Math.sin(x * 0.0042 + 1.7) * 4 + Math.sin(x * 0.013 + 0.4) * 1.6 + (noise1(x / 90, 17) - 0.5) * 4;
}
/** the walk line without the water dips */
export function fwBase(x: number): number {
  let y = fwBase0(x);
  // down off the ridge from Te Wao Nui
  y += ridgeDy() * (1 - smoothstep(0, 820, x));
  // root humps by the giants
  y -= bump(x, 3920, 4080, 6) + bump(x, 1180, 1260, 3) + bump(x, 2880, 2960, 3);
  // the climb toward the falls at the east end
  y -= 16 * smoothstep(4100, 4400, x);
  return y + gullyDip(x);
}
const dip = (x: number, cx: number, w: number, d: number) => { const c = Math.abs(x - cx); return c < w + 26 ? d * (1 - smoothstep(w * 0.5, w + 26, c)) : 0; };
export function fwGround(x: number): number {
  return fwBase(x) + dip(x, FW_GULLY.x, FW_GULLY.w, 5) + dip(x, FW_STREAM.x, FW_STREAM.w, 5);
}
export function fwZone(x: number): [string, string] {
  for (const [a, b, n, s] of FW_ZONES) if (x >= a && x < b) return [n, s];
  return ['Fernwood Floor', 'Te Ngāhere'];
}
export function fwCanopy(x: number) {
  const gully = 1 - 0.3 * Math.exp(-(((x - FW_GULLY.x) / 160) ** 2));
  const stream = 1 - 0.3 * Math.exp(-(((x - FW_STREAM.x) / 120) ** 2));
  return clamp(0.82 * gully * stream + (x > 2320 && x < 3340 ? 0.1 : 0), 0, 1);
}
const creek = (cx0: number, w0: number, s: number): Channel => ({
  x: cx0, reach: 150, rocky: true, seed: s,
  at: dd => { const z = wrealZ(dd), P = wpersp(dd); return [cx0 + (Math.sin(z * 8 + s) * 11 + z * 26) * P, w0 * P * (1 + (noise1(dd / 6, s) - 0.5) * 0.3) + 8 * Math.exp(-(((dd - 7) / 10) ** 2))]; },
});

let rt: WoodsRuntime | null = null;
let placeKey = '';

export const FERNWOOD_V11: FieldSite = {
  id: 'fernwood', name: 'Fernwood Floor', width: FW.W, camY: 180, followY: true, minY: FW.minY, maxY: FW.maxY,
  spawnX: FW_SPOT.enter, exitX: FW_SPOT.exit, waterY: null, ambience: 'forest', music: 'explore', ground: 'leaves',
  build(f: FieldScene) {
    rt = buildFernwood(f);
  },
  onUpdate(f, dt) {
    rt?.update(f, dt);
    const [n, sub] = fwZone(f.player?.x ?? 0);
    const key = n + '|' + sub;
    if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(n, `${sub} · Day ${game.save.day || 1}`); }
  },
  spawns: [
    { species: 'boneface', n: [3, 6], x: [2400, 3300], herd: true, juveniles: 0.35, times: ['dawn', 'day', 'dusk'], chance: 0.85 },
    { species: 'shieldback', n: [1, 2], x: [700, 3600], times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'delver', n: [4, 6], x: [1140, 1300], herd: true, juveniles: 0.4, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'quillhog', n: [1, 2], x: [3000, 4200], times: ['dusk', 'night'], chance: 0.9 },
    { species: 'flicker', n: [1, 1], x: [2000, 4000], times: ['dawn', 'day', 'dusk'], chance: 0.6, later: true },
    { species: 'strider', n: [1, 2], x: [400, 3800], times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'sprinter', n: [1, 1], x: [1500, 3800], times: ['dusk', 'night'], chance: 0.7 },
    { species: 'hunterbat', n: [1, 2], x: [400, 3800], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
    { species: 'mossfrog', n: [3, 5], x: [1900, 2120], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'mossfrog', n: [2, 3], x: [4240, 4360], herd: true, times: ['dusk', 'night', 'dawn'], chance: 0.8 },
    { species: 'barkgecko', n: [2, 3], x: [400, 4000], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'nutcracker', n: [3, 6], x: [1400, 1700], herd: true, times: ['dawn', 'day'], chance: 0.7 },
    { species: 'sailglider', n: [1, 2], x: [3400, 4200], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night', 'dawn'], chance: 0.7 },
  ],
  insects: [
    { kind: 'butterfly', x: [200, 4200], y: [130, 200], n: 6, times: ['day', 'dawn'] },
    { kind: 'dragonfly', x: [1900, 2100], y: [180, 240], n: 4, times: ['day', 'dusk'] },
    { kind: 'dragonfly', x: [4220, 4380], y: [170, 220], n: 3, times: ['day', 'dusk'] },
    { kind: 'bee', x: [200, 4000], y: [150, 205], n: 5, times: ['day'] },
    { kind: 'skymoth', x: [200, 4200], y: [90, 200], n: 6, times: ['dusk', 'night'] },
    { kind: 'firefly', x: [0, 4400], y: [110, 210], n: 34, times: ['dusk', 'night'] },
    { kind: 'lanternbeetle', x: [1000, 3600], y: [200, 214], n: 6, times: ['night'] },
    { kind: 'ant', x: [300, 4000], y: [212, 214], n: 8 },
    { kind: 'cicada', x: [300, 4000], y: [80, 150], n: 4, times: ['day'] },
  ],
  onEnter: f => {
    rt?.enter(f);
    placeKey = '';
    return arrive(f, 'Fernwood Floor', 'Te Ngāhere', 'Kia tūpato: careful. Watch where the ferns are moving.');
  },
};

/** V12: Fernwood Floor's gameplay plane, on its own or as a stretch of the Te Wao Nui region (world x
 *  from `seg.ox`: src/game/v12/region.ts) */
export function buildFernwood(f: FieldScene, seg?: WoodsSeg): WoodsRuntime {
  const O = seg?.ox ?? 0;
  const w = buildWoods(f, {
    W: FW.W, minY: FW.minY, maxY: FW.maxY, seed: 131,
    floor: {
      ground: fwGround, base: fwBase, depth: 196, seed: 131,
      channels: [creek(FW_GULLY.x, FW_GULLY.w, 2.2), creek(FW_STREAM.x, FW_STREAM.w, 0.8)],
      pools: [{ x: FW_SPOT.pool + 30, rx: 90, dd: 46, rdd: 22, seed: 141 }],
      moss: x => (x > 1720 && x < 2320 ? 1 : x > 2320 && x < 3340 ? 0.5 : 0),
      ferns: x => (x > 800 && x < 3340 ? 1 : 0.4),
    },
    canopy: fwCanopy,
    giants: [[380, 'rimu', 96], [1060, 'kauri', 120], [1640, 'rata', 104], [2440, 'kahikatea', 110], [3180, 'rimu', 104], [3560, 'kauri', 132], [4000, 'kauri', 200]],
    ferns: x => (x < 800 ? 0.55 : x < 1720 ? 0.85 : x < 2320 ? 0.7 : x < 3340 ? 0.9 : 0.55),
    rays: [[200, 120, 1], [980, 90, 0.8], [1990, 150, 1.1], [2700, 80, 0.7], [3350, 100, 0.8], [4300, 130, 1]],
    keep: [FW_GULLY.x, FW_SPOT.climb, FW_SPOT.falls, 1180, 1220, 1320, 1900, 2700, FW_SPOT.exit + 60],
    // (V12: the high limb's span is kept clear of tree ferns in front of it: ../forest/region.ts)
    clear: [[3960, 4120], [1262, 1386], [3640, 3890]],
    hides: [700, 1400, 2290, 2960, 3700],
    frontTrunks: [560, 2140, 3420],
    dress: dressFernwood,
  }, currentExpedition() ? expeditionHour() : undefined, seg);
  // the V2 site's resource nodes, spread over the longer walk
  const N: [string, string, number][] = [
    ['flax1', 'flax', 300], ['fern1', 'treefern', 430], ['kawa1', 'kawakawa', 680], ['moon1', 'moonfruit', 1480], ['moss1', 'mossrock', 1640],
    ['glow1', 'glowcap', 1780], ['brack1', 'bracket', 2150], ['ink1', 'inkcap', 2240], ['grub1', 'grublog', 960], ['grub2', 'grublog', 3500],
    ['beetle1', 'lanternbeetle', 2000], ['weta1', 'weta', 2840], ['moth1', 'skymoth', 3100], ['mantis1', 'mantis', 1260], ['drag1', 'dragonfly', 2060],
    ['thorn1', 'thornfur', 3200], ['plate1', 'plate', 2400], ['quill1', 'quill', 3700], ['drop1', 'dropping', 3850], ['feath1', 'feather', 800],
    ['pitch1', 'pitcher', 1930], ['rata1', 'rata', 1660], ['snare1', 'snare', 1150], ['snare2', 'snare', 2310], ['snare3', 'snare', 3800],
  ];
  for (const [k, kind, x] of N) node(f, k, kind, x + O, fwGround(x), 'fernwood');
  // animal signs (Field Guide clues)
  clueSpot(f, 'grub-shells', O + 1180, fwGround(1180), 'Look at the dug-up soil', 'Chewed grub casings. Something with claws has been feasting here.');
  clueSpot(f, 'burrow', O + 1220, fwGround(1220), 'Examine the mound', 'A burrow… no, a whole network of them.');
  clueSpot(f, 'boneface-track', O + 2700, fwGround(2700), 'Examine the tracks', 'Three toes, and deep. Whatever made these is heavy.');
  // POIs the wildlife uses
  for (const x of [1150, 1190, 1240, 1290, 4200]) f.pois.push({ kind: 'burrow', x: x + O, y: fwGround(x) });
  for (const x of [740, 1960, 3260]) f.pois.push({ kind: 'soft', x: x + O, y: fwGround(x) });
  for (const x of [1250, 2300, 3600]) f.pois.push({ kind: 'leaves', x: x + O, y: fwGround(x), amount: 30 });
  for (const x of [1480, 3380]) f.pois.push({ kind: 'fruit', x: x + O, y: fwGround(x), amount: 20 });
  for (const x of [500, 2180, 3140]) f.pois.push({ kind: 'flower', x: x + O, y: fwGround(x) - 40 });
  f.pois.push({ kind: 'den', x: O + 4050, y: fwGround(4050) });
  f.pois.push({ kind: 'water', x: O + FW_GULLY.x, y: fwBase(FW_GULLY.x), y1: fwBase(FW_GULLY.x) + 10, w: FW_GULLY.w });
  f.pois.push({ kind: 'mud', x: O + FW_GULLY.x - 50, y: fwGround(FW_GULLY.x - 50) }, { kind: 'bank', x: O + FW_GULLY.x + 50, y: fwGround(FW_GULLY.x + 50) });
  return w;
}

/** the fern gully's mossy step and cascade, the pool, the black mamaku, the fallen kauri, the giant */
function dressFernwood(f: FieldScene, w: WoodsRuntime) {
  const main = w.main, rng = w.rng, O = w.ox;
  // the creek's mossy step behind the walk line, pouring into the gully
  const g = FW_GULLY;
  const ledge = w.frameOf('ledge', () => paintLedge(62, 120, 26, g.w + 1));
  main.add(new Prop(ledge, O + g.x, fwBase(g.x) - 1, -4.6));
  main.add(new Custom(-4.5, (rr, st) => {
    const x = O + g.x, top = fwBase(g.x) - 26, bot = fwBase(g.x);
    if (x < rr.visibleX0(40) || x > rr.visibleX1(40)) return;
    for (let i = -g.w * 0.6; i <= g.w * 0.6; i += 1) {
      const ph = Math.sin(i * 1.7) * 3;
      for (let y = 0; y < bot - top; y += 2) { const k = ((y + st.time * 60 + ph * 10) % 12) / 12; rr.rect(x + i, top + y, 1, 2, packColor(0.75, 0.9, 0.92, 0.35 + 0.4 * (k < 0.3 ? 1 : 0))); }
    }
    for (let i = 0; i < 6; i++) rr.rect(x - g.w * 0.7 + i * g.w * 0.25, bot - 1 + Math.sin(st.time * 6 + i) * 0.8, 3, 1, packColor(0.92, 0.97, 0.98, 0.7));
  }));
  // Ngā Mamaku: the black tree ferns, much taller than the rest, crowding the walk
  for (let x = 2360; x < 3320; x += rng.range(70, 120)) {
    if (Math.abs(x - 2440) < 80 || Math.abs(x - 3180) < 80 || (x > FW_SPOT.log[0] - 20 && x < FW_SPOT.log[1] + 10)) continue;
    const h = rng.range(250, 330), v = rng.int(0, 2);
    const fr = w.frameOf(`mamaku:${v}:${Math.round(h / 20)}`, () => tree('treefern', 900 + v * 23 + Math.round(h), h));
    main.add(new Prop(fr, O + x, fwGround(x) + 2, -5.8 + rng.next() * 0.2, { sway: 0.5, flip: rng.chance(0.5), tint: packColor(0.86, 0.9, 0.86, 1) }));
    f.pois.push({ kind: 'trunk', x: O + x, y: fwGround(x), y1: fwGround(x) - h * 0.75 });
  }
  // a fallen kauri behind the walk line in the mamaku: walk along its top, up its root plate
  {
    const [x0, x1] = FW_SPOT.log;
    const log = (() => { const L = paintFallenLog(77, x1 - x0 - 40, 60); return L; })();
    const logF = local.add('wd:fwlog', log.buf, log.ax, log.ay);
    const lx = x0 - 6, lg = fwBase(x0 + 30) - 3;
    main.add(new Prop(logF, O + lx, lg, -5.2));
    const plat: [number, number][] = [];
    for (let x = x0 + log.plateW - 2; x <= x1 - 22; x += 8) plat.push([O + x, lg - log.ay + log.top(x - lx + log.ax) + 1]);
    if (plat.length > 1) {
      f.st.terrain.addPlatform(plat, 'branch');
      const cx = O + x0 + 24;
      f.st.terrain.addClimb(cx, plat[0][1], lg, 'vine');
      const ld = { x: cx, y0: plat[0][1], y1: lg };
      (f.interact as Interactable[]).push({ x: cx, y: lg, w: 14, h: 18, label: 'Climb the roots onto the fallen kauri', standX: cx, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - fwGround(f.player.x - O)) < 10, action: () => f.climbLadder(ld, -1) });
      (f.interact as Interactable[]).push({ x: cx, y: plat[0][1], w: 14, h: 18, label: 'Climb back down the roots', standX: cx, enabled: () => f.player.state !== 'climb' && Math.abs(f.player.y - plat[0][1]) < 10, action: () => f.climbLadder(ld, 1) });
    }
  }
  // the giant kauri at the east end: the climb to the canopy (the way on) goes up its trunk
  {
    const x = FW_SPOT.kauri;
    f.pois.push({ kind: 'trunk', x: O + x, y: fwGround(x), y1: fwGround(x) - 300 }, { kind: 'perch', x: O + x + 40, y: fwGround(x) - 260 });
    void paintGiant;
  }
}

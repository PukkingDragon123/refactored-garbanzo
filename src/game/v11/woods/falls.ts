// V11 Thunder Falls, Te Wai Whatitiri, rebuilt on the Te Wao Nui kit (./kit.ts) and made longer: the
// bush along the river (the same great forest, the goat track up to the Rocky Hills leaving from it),
// then the falls themselves pouring off a towering basalt cliff into a plunge pool you wade across on
// the rock bar (the curtain mirrored in the pool, spray and mist boiling up, the river running off
// toward the camera), then the rocky shore under the cliff and its nesting ledges, with ropes up from
// ledge to ledge to the gorge at the top (the way on to the Bone Cliffs). The V2 site's clues, nodes,
// spawns and POIs are carried over; the map's finds (v10/finds.ts) follow the new layout.
//
//   0 ─ Te Awa, the bush by the river ─ 1150 ─ Te Wai Whatitiri, the falls and the pool ─ 1760 ─
//   Ngā Pari, the cliff ledges ─ 3300

import type { FieldScene, FieldSite } from '../../scenes/field';
import { Prop, Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { PixelBuffer } from '../../../art/pixel';
import { hex } from '../../../art/color';
import { game } from '../../game';
import { A } from '../../assets';
import { clamp, noise1, rand, smoothstep } from '../../../core/math';
import { paintStone } from '../../../art/v9/eastart';
import { wpersp, wrealZ } from '../../../art/v11/woods/floor';
import type { Channel } from '../../../art/v11/woods/floor';
import { paintFallsCliff, paintCurtain } from '../../../art/v11/woods/cliff';
import { buildWoods } from './kit';
import type { WoodsRuntime, WoodsSeg } from './kit';
import { fwBase, FW } from './fernwood';
import { clueSpot, arrive } from '../../sites2';
import { node, sprite } from '../../sites2/common';
import { climbSpot } from '../../sites10/kit';
import { currentExpedition, expeditionHour } from '../../v10/expedition';

export const FA = { W: 3300, minY: -250, maxY: 410 };
export const FA_ZONES: [number, number, string, string][] = [
  [0, 1150, 'Te Awa', 'The bush by the river'],
  [1150, 1760, 'Te Wai Whatitiri', 'Thunder Falls'],
  [1760, 3301, 'Ngā Pari', 'The cliff ledges'],
];
/** the falls' curtain (world x) and the pool across the walk line */
export const FALL = { x0: 1404, x1: 1524, top: -246 };
export const POOL = { x0: 1190, x1: 1730 };
/** the cliff (top-left x, its bottom sits on the walk line) and its ledges: x0, x1, world y */
export const CLIFF = { x0: 1060, x1: 3300, h: 470 };
export const LEDGES: [number, number, number][] = [[1800, 2520, 150], [2280, 2980, 92], [2780, 3290, 36]];
export const FA_SPOT = { enter: 90, exit: 30, hills: 620, gorge: 3200, nest: 1390, skin: 640, roost: 560, carrion: 2600, feather: 2660 };

/** V12 (the big region, src/game/v12/region.ts): the river bush starts at exactly the height Fernwood's
 *  stream bank ends at, and eases down to the river */
let seamDy: number | null = null;
const seamK = () => (seamDy ??= fwBase(FW.W) - faBase0(0));
function faBase0(x: number): number {
  return 214 + Math.sin(x * 0.0047 + 0.3) * 3 + Math.sin(x * 0.015 + 1.1) * 1.4 + (noise1(x / 80, 23) - 0.5) * 3;
}
/** the walk line without the water dips */
export function faBase(x: number): number {
  let y = faBase0(x) + seamK() * (1 - smoothstep(0, 640, x));
  // the rocky shore under the cliff sits a little higher
  y -= 6 * smoothstep(1700, 1900, x);
  return y;
}
/** the walk line: a shallow rock bar across the pool */
export function faGround(x: number): number {
  const inPool = smoothstep(POOL.x0, POOL.x0 + 40, x) * (1 - smoothstep(POOL.x1 - 40, POOL.x1, x));
  return faBase(x) + inPool * 5;
}
export function faZone(x: number): [string, string] {
  for (const [a, b, n, s] of FA_ZONES) if (x >= a && x < b) return [n, s];
  return ['Thunder Falls', 'Te Wai Whatitiri'];
}
export const faCanopy = (x: number) => clamp(0.85 * (1 - smoothstep(900, 1250, x)) + 0.1, 0, 1);
/** the river leaving the pool toward the camera */
const river: Channel = {
  x: 1640, reach: 320, rocky: true, seed: 3.1,
  at: dd => { const z = wrealZ(dd), P = wpersp(dd); return [1640 + (Math.sin(z * 6 + 1) * 18 + z * 70) * P, 34 * P * (1 + (noise1(dd / 8, 91) - 0.5) * 0.25)]; },
};

let rt: WoodsRuntime | null = null;
let placeKey = '';
let wadeT = 0;

export const FALLS_V11: FieldSite = {
  id: 'falls', name: 'Thunder Falls', width: FA.W, camY: 180, followY: true, minY: FA.minY, maxY: FA.maxY,
  spawnX: FA_SPOT.enter, exitX: FA_SPOT.exit, waterY: null, ambience: 'falls', music: 'wonder', ground: 'grass',
  build(f: FieldScene) {
    rt = buildFalls(f);
  },
  onUpdate(f, dt) {
    rt?.update(f, dt);
    const p = f.player;
    if (!p) return;
    // wading the rock bar across the pool, splashing
    const inPool = p.x > POOL.x0 + 10 && p.x < POOL.x1 - 10 && p.onGround && Math.abs(p.y - faGround(p.x)) < 4;
    if (inPool) {
      p.wadeK = 0.72; p.ground = 'water';
      wadeT -= dt * Math.abs(p.vx) / 40;
      if (wadeT <= 0 && Math.abs(p.vx) > 8) { wadeT = 0.5; f.splash(p.x, faGround(p.x) - 1, 0.4); }
    } else if (p.ground === 'water' && !f.st.terrain.water.length) { p.wadeK = 1; p.ground = 'grass'; }
    const [n, sub] = faZone(p.x);
    const key = n + '|' + sub;
    if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(n, `${sub} · Day ${game.save.day || 1}`); }
  },
  spawns: [
    { species: 'cragauk', n: [4, 7], x: [1800, 3200], poi: 'nest', herd: true, juveniles: 0.3, times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'torrentdipper', n: [1, 2], x: [1220, 1700], poi: 'rock', times: ['dawn', 'day'], chance: 1 },
    { species: 'galehawk', n: [1, 1], x: [300, 3100], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'monarch', n: [1, 1], x: [1500, 3100], medium: 'air', times: ['dawn', 'day'], chance: 0.8 },
    { species: 'cragviper', n: [1, 2], x: [1900, 3200], poi: 'nest', times: ['day', 'dusk'], chance: 0.8 },
    { species: 'strider', n: [1, 1], x: [200, 1100], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'sprinter', n: [1, 1], x: [200, 1100], times: ['dusk', 'night'], chance: 0.6 },
    { species: 'shieldback', n: [1, 1], x: [200, 1100], times: ['dawn', 'day', 'dusk'], chance: 0.5 },
    { species: 'quillhog', n: [1, 1], x: [200, 1100], times: ['dusk', 'night'], chance: 0.7 },
    { species: 'delver', n: [2, 4], x: [400, 480], herd: true, poi: 'burrow', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'hunterbat', n: [1, 1], x: [200, 1100], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
    { species: 'mossfrog', n: [2, 4], x: [1120, 1220], herd: true, times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'pteramander', n: [1, 2], x: [150, 1100], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night'], chance: 0.8 },
  ],
  insects: [
    { kind: 'dragonfly', x: [1150, 1750], y: [170, 214], n: 6, times: ['day', 'dawn', 'dusk'] },
    { kind: 'butterfly', x: [100, 1100], y: [130, 200], n: 4, times: ['day'] },
    { kind: 'firefly', x: [0, 1200], y: [110, 210], n: 16, times: ['dusk', 'night'] },
    { kind: 'skymoth', x: [100, 1100], y: [90, 200], n: 4, times: ['night'] },
  ],
  onEnter: f => {
    rt?.enter(f);
    placeKey = '';
    return arrive(f, 'Thunder Falls', 'Te Wai Whatitiri', 'Hear it? The auks nest up the cliff. And… stay away from the big rocks by the pool.');
  },
};

/** V12: Thunder Falls' gameplay plane, on its own or as the east end of the Te Wao Nui region (world x
 *  from `seg.ox`: src/game/v12/region.ts) */
export function buildFalls(f: FieldScene, seg?: WoodsSeg): WoodsRuntime {
  const O = seg?.ox ?? 0;
  const w = buildWoods(f, {
    W: FA.W, minY: FA.minY, maxY: FA.maxY, seed: 171, open: 0.4,
    floor: {
      ground: faGround, base: faBase, depth: 196, seed: 171,
      channels: [river],
      pools: [{ x: (POOL.x0 + POOL.x1) / 2, rx: (POOL.x1 - POOL.x0) / 2, dd: 26, rdd: 64, seed: 173 }],
      moss: x => (x > 1100 ? 1 : 0.2),
      ferns: x => (x > 1700 ? 0.7 : 0.5),
    },
    canopy: faCanopy,
    giants: [[200, 'rata', 92], [560, 'rimu', 104], [880, 'kauri', 126]],
    ferns: x => (x < 1150 ? 0.62 : 0.85),
    rays: [[340, 100, 0.9], [760, 80, 0.8], [1100, 160, 1.2], [1460, 220, 1.3]],
    keep: [FA_SPOT.skin, FA_SPOT.roost, FA_SPOT.nest, FA_SPOT.hills, FA_SPOT.feather, 1460, FA_SPOT.exit + 60],
    clear: [[POOL.x0 - 30, POOL.x1 + 20], [1800, 1900], [2300, 2360], [2800, 2860]],
    hides: [300, 760, 2100, 2700],
    frontTrunks: [460, 980],
    hangSkip: [[1700, 3400]],
    dress: dressFalls,
  }, currentExpedition() ? expeditionHour() : undefined, seg);
  // the V2 site's resource nodes, spread over the longer walk
  const N: [string, string, number][] = [
    ['fern1', 'treefern', 150], ['moss1', 'mossrock', 380], ['glow1', 'glowcap', 480], ['kawa1', 'kawakawa', 700], ['drag1', 'dragonfly', 1160],
    ['egg1', 'eggshell', 2060], ['egg2', 'eggshell', 2440], ['feath1', 'feather', 2200], ['quill1', 'quill', 820], ['weta1', 'weta', 540],
    ['stones1', 'stones', 1820], ['drop1', 'dropping', 2900], ['flax1', 'flax', 250],
  ];
  for (const [k, kind, x] of N) node(f, k, kind, O + x, f.st.terrain.surfaceBelow(O + x, -400)?.y ?? faGround(x), 'falls');
  clueSpot(f, 'giant-skin', O + FA_SPOT.skin, faGround(FA_SPOT.skin), 'Examine the… tarp?', 'That’s not a tarp. That’s a SKIN. It’s the size of a bus.');
  clueSpot(f, 'falls-nest', O + FA_SPOT.nest, faGround(FA_SPOT.nest), 'Look behind the curtain', 'A mossy nest, right behind the falling water. Clever.', { z: 29 });
  clueSpot(f, 'bat-roost', O + FA_SPOT.roost, faGround(FA_SPOT.roost), 'Look at the litter under the branch', 'Wētā legs and frog bones. Something eats up there.');
  clueSpot(f, 'monarch-feather', O + FA_SPOT.feather, faGround(FA_SPOT.feather), 'Pull out the feather', 'A feather longer than my arm. What on earth…');
  // POIs the wildlife uses
  for (const x of [420, 460]) f.pois.push({ kind: 'burrow', x: O + x, y: faGround(x) });
  f.pois.push({ kind: 'soft', x: O + 700, y: faGround(700) }, { kind: 'sun', x: O + 1100, y: faGround(1100) }, { kind: 'fruit', x: O + 520, y: faGround(520), amount: 15 });
  f.pois.push({ kind: 'carrion', x: O + FA_SPOT.carrion, y: faGround(FA_SPOT.carrion), amount: 40 });
  f.pois.push({ kind: 'water', x: O + (POOL.x0 + POOL.x1) / 2, y: faBase(1460), y1: faBase(1460) + 30, w: (POOL.x1 - POOL.x0) / 2 });
  for (const x of [1250, 1330, 1600, 1680]) f.pois.push({ kind: 'rock', x: O + x, y: faGround(x) - 2 });
  f.pois.push({ kind: 'perch', x: O + 1900, y: LEDGES[0][2] - 40 }, { kind: 'perch', x: O + 2600, y: LEDGES[1][2] - 40 });
  f.pois.push({ kind: 'bank', x: O + POOL.x0 - 20, y: faGround(POOL.x0 - 20) }, { kind: 'mud', x: O + POOL.x1 + 30, y: faGround(POOL.x1 + 30) });
  return w;
}

function dressFalls(f: FieldScene, w: WoodsRuntime) {
  const main = w.main, O = w.ox;
  // the cliff, its foot on the walk line
  const cw = CLIFF.x1 - CLIFF.x0, top = faBase(1460) - CLIFF.h + 6;
  const cliff = paintFallsCliff(cw, CLIFF.h, 1771, [FALL.x0 - CLIFF.x0, FALL.x1 - CLIFF.x0], LEDGES.map(([a, b, y]) => [a - CLIFF.x0, b - CLIFF.x0, Math.round(y - top)] as [number, number, number]));
  const CH = 1024;
  for (let cx = 0; cx < cw; cx += CH) {
    const ww = Math.min(CH, cw - cx);
    const sub = new PixelBuffer(ww, cliff.buf.h);
    for (let yy = 0; yy < cliff.buf.h; yy++) sub.data.set(cliff.buf.data.subarray(yy * cw + cx, yy * cw + cx + ww), yy * ww);
    main.add(new Prop({ ...bigFrame(game.r, sub), ax: 0, ay: 0 }, O + CLIFF.x0 + cx, top, -9));
  }
  // the ledges you can stand on, the ropes up between them
  for (const [x0, x1, y] of LEDGES) f.st.terrain.addPlatform([[O + x0 + 6, y], [O + x1 - 4, y]], 'rock' as never);
  climbSpot(f, O + 1850, LEDGES[0][2], faGround(1850), 'rope', 'Climb the rope to the first ledge', 'Climb down to the shore');
  climbSpot(f, O + 2330, LEDGES[1][2], LEDGES[0][2], 'rope', 'Climb up to the auk ledge', 'Climb down a ledge');
  climbSpot(f, O + 2830, LEDGES[2][2], LEDGES[1][2], 'rope', 'Climb up to the top ledge', 'Climb down a ledge');
  for (const [x0, x1, y] of LEDGES) for (let x = x0 + 60; x < x1 - 30; x += 110) f.pois.push({ kind: 'nest', x: O + x, y });
  // the falls: a dim back sheet and a bright front one, scrolling, mirrored in the pool
  const fw = FALL.x1 - FALL.x0;
  const backT = bigFrame(game.r, paintCurtain(fw + 16, 128, 5, false));
  const frontT = bigFrame(game.r, paintCurtain(fw - 6, 128, 9, true));
  const sheet = (rr: import('../../../gfx/renderer').Renderer, fr: typeof backT, x: number, y0: number, y1: number, speed: number, t: number, col: number) => {
    const H = fr.h;
    let o = (t * speed) % H;
    let y = y0;
    // first partial tile, then whole tiles, scrolling down
    let sy = H - o;
    while (y < y1) {
      const hh = Math.min(H - sy, y1 - y);
      rr.drawSub(fr, 0, sy, fr.w, hh, x, y, 1, 1, col);
      y += hh;
      sy = 0;
      o = 0;
    }
  };
  const gy = faBase(1460);
  main.add(new Custom(-8.8, (rr, st) => {
    if (O + FALL.x1 < rr.visibleX0(40) || O + FALL.x0 > rr.visibleX1(40)) return;
    const y0 = Math.max(top + 4, rr.wy(0) - 4), y1 = gy + 2;
    sheet(rr, backT, O + FALL.x0 - 8, y0, y1, 150, st.time, packColor(0.9, 0.95, 1, 1));
    rr.emissive(0.06);
    sheet(rr, frontT, O + FALL.x0 + 3, y0, y1, 240, st.time, packColor(0.9, 0.95, 0.97, 0.85));
    rr.emissive();
    // foam boiling at the foot, light thrown off the white water
    for (let i = 0; i < 9; i++) {
      const fx = O + FALL.x0 - 6 + i * (fw + 12) / 8, k = 0.6 + 0.4 * Math.sin(st.time * 5 + i * 1.7);
      rr.fxDraw(A.soft, fx, gy - 3 + Math.sin(st.time * 4 + i) * 1.5, 2 * k + 0.8, 1, 0, packColor(0.92, 0.98, 1, 1), 0.32 * k);
    }
    rr.light(O + FALL.x0 + fw / 2, gy - 40, 180, 0.8, 0.95, 1, 0.3, 0.03);
  }, (dt, st) => {
    // spray and mist rising off the plunge (only while it's anywhere near)
    if (Math.abs(st.cam.x - O - FALL.x0) > 700) return;
    if (rand.chance(dt * 28)) main.particles.spawn({ frame: A.dot2, x: O + rand.range(FALL.x0, FALL.x1), y: gy - 2, vx: rand.range(-60, 60), vy: rand.range(-80, -20), ay: 130, life: rand.range(0.6, 1.2), color: [0.92, 0.98, 1], alpha: 0.85, alpha1: 0 });
    if (rand.chance(dt * 5)) main.particles.spawn({ frame: A.soft, x: O + rand.range(FALL.x0 - 30, FALL.x1 + 30), y: gy - rand.range(0, 20), vx: rand.range(-14, 14), vy: rand.range(-22, -8), life: rand.range(2.5, 4.5), color: [0.92, 0.96, 0.98], alpha: 0.22, alpha1: 0, size: rand.range(1, 2), size1: rand.range(4, 6) });
  }));
  // stepping stones and boulders in the pool and down the river
  for (const [x, dd, s] of [[1250, 2, 0], [1330, 4, 1], [1600, 2, 2], [1680, 5, 0], [1300, 40, 1], [1560, 70, 2], [1700, 110, 0], [1210, 90, 1]] as const) {
    const st = w.frameOf(`fstone${s}:${dd > 20 ? 1 : 0}`, () => paintStone(90 + s, dd > 20 ? 30 : 20, dd > 20 ? 14 : 9, { moss: s !== 1, wetLine: 0.4 }));
    const P = wpersp(dd);
    main.add(new Prop(st, O + x, faBase(x) + dd + 2, dd > 6 ? 59 + dd * 0.02 : -2.4, { sx: P, sy: P }));
  }
  // the carrion on the rocky shore for the Monarch
  const carc = sprite('carcass', () => {
    const b = new PixelBuffer(40, 14);
    b.ellipseFn(20, 9, 18, 5, (x, y) => (((x >> 1) + y) % 4 === 0 ? hex('#e8e0c8') : hex('#7a3a30')));
    for (let i = 0; i < 6; i++) b.rect(6 + i * 5, 3, 1, 5, hex('#e8e0c8'));
    b.outline(hex('#1a1010'));
    return { buf: b, ax: 20, ay: 13 };
  });
  if (carc) main.add(new Prop(carc.f, O + FA_SPOT.carrion, faGround(FA_SPOT.carrion) + 1, 3));
}

// V11 the Emerald Canopy, Te Tāhuhu o te Ngāhere, rebuilt on the Te Wao Nui kit (./kit.ts) and made
// longer: high in the same great forest, a road of colossal branches from the top of the giant kauri's
// climb out through the epiphyte gardens to a lookout and the vine bridge across to the old pā. The far
// ranks of giants are seen across, crown to crown, their trunks dropping into mist far below; the
// walkway's giants run out of the frame top and bottom; ferns and astelia grow on the limbs, beard moss
// trails under them. The V2 site's clues, nodes, spawns and POIs are carried over (and the map finds).
//
//   0 ─ Te Arapiki, the top of the climb ─ 900 ─ Te Ara Peka, the branch road ─ 1800 ─ Ngā Māra Manu,
//   the epiphyte gardens ─ 2800 ─ Te Taumata, the lookout and the vine bridge ─ 3800

import type { FieldScene, FieldSite } from '../../scenes/field';
import { Prop, Custom } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { hex } from '../../../art/color';
import { game } from '../../game';
import { Rng, clamp, noise1 } from '../../../core/math';
import { DayClock } from '../../v4/islefx';
import { plant } from '../../../art/jungle-plants';
import type { PlantKind } from '../../../art/jungle-plants';
import { paintGiant } from '../../../art/v11/forest/trees';
import type { GiantKind } from '../../../art/v11/forest/trees';
import { paintBranchRoad, paintVineBridge } from '../../../art/v11/woods/limb';
import { woodsFar, woodsFront, installWoodsEnv, woodsCamera, clockForTod } from './kit';
import { WoodsRays, WoodsAir, WoodsShade } from './fx';
import { ForestMist, GroundCover } from '../forest/fx';
import type { Mover } from '../forest/fx';
import { clueSpot, arrive, trunkPOI } from '../../sites2';
import { node, sprite } from '../../sites2/common';
import { local } from '../../assets';
import { currentExpedition, expeditionHour } from '../../v10/expedition';
import type { Sprite } from '../../../art/jungle-core';
import type { Frame } from '../../../gfx/renderer';

export const CN = { W: 3800, minY: -160, maxY: 400 };
export const CN_ZONES: [number, number, string, string][] = [
  [0, 900, 'Te Arapiki', 'The top of the climb'],
  [900, 1800, 'Te Ara Peka', 'The branch road'],
  [1800, 2800, 'Ngā Māra Manu', 'The epiphyte gardens'],
  [2800, 3801, 'Te Taumata', 'The lookout'],
];
export const CN_TRUNKS: [number, GiantKind, number][] = [[260, 'kauri', 150], [880, 'rimu', 120], [1420, 'kauri', 170], [2060, 'kahikatea', 130], [2640, 'rata', 140], [3240, 'kauri', 160]];
export const CN_SPOT = { enter: 80, exit: 30, bridge: 3640, ruins: 3720, toki: 1185, view: 1620 };

/** the walkway's top: gentle rises and dips along the limbs */
export function cnGround(x: number): number {
  return 212 + Math.sin(x * 0.006 + 0.5) * 12 + Math.sin(x * 0.023) * 3 + Math.max(0, Math.sin(x * 0.0021 + 1)) * 8;
}
const thick = (x: number) => 26 + noise1(x / 50, 61) * 12 + CN_TRUNKS.reduce((a, [tx, , w]) => a + Math.max(0, 1 - Math.abs(x - tx) / (w * 0.9)) * 22, 0);
const canopy = (x: number) => clamp(0.45 + 0.25 * Math.sin(x * 0.003 + 1), 0.15, 0.8);
export function cnZone(x: number): [string, string] {
  for (const [a, b, n, s] of CN_ZONES) if (x >= a && x < b) return [n, s];
  return ['Emerald Canopy', 'Te Tāhuhu o te Ngāhere'];
}

let shade: WoodsShade | null = null;
let placeKey = '';
const HIDES: { x: number; w: number; y: number; cover: number }[] = [];

function build(f: FieldScene) {
  const st = f.st;
  const rng = new Rng(2121);
  st.minX = 0; st.maxX = CN.W; st.minY = CN.minY; st.maxY = CN.maxY;
  const clock = new DayClock();
  clock.set(clockForTod(f.tod, currentExpedition() ? expeditionHour() : undefined));
  const frameOf = (key: string, gen: () => Sprite) => { const s = sprite('cn11:' + key, gen)!; return Object.assign(s.f, { sprite: s.s }) as Frame & { sprite: Sprite }; };
  // the far giants seen across at crown height, their floors lost far below in the mist
  woodsFar(f, clock, { seed: 211, fog: hex('#9cbcb2'), open: 0.8, shift: 330, skip: ['ceil'], backdrop: { top: hex('#3c6a78'), mid: hex('#d2e6dc'), low: hex('#9ec2b0'), ghost: hex('#a8c8b8') } });
  // the mist in the depths below the walkway, drifting
  const depth = st.addLayer('depthmist', 0.9, 0.3, 0.85, 0, 0.9);
  // (a bank of cloud filling the depths, so the far ranks dissolve into it instead of ending)
  const fill = packColor(0.8, 0.88, 0.85, 1);
  const fill2 = packColor(0.86, 0.92, 0.89, 1);
  depth.add(new Custom(-1, (rr, st2) => {
    // a billowing top edge, drifting slowly
    const x0 = Math.floor(rr.visibleX0(8) / 3) * 3, x1 = rr.visibleX1(8);
    for (let x = x0; x < x1; x += 3) {
      const t = 214 + 58 + (noise1((x + st2.time * 3) / 34, 77) - 0.5) * 22 + (noise1((x - st2.time * 2) / 11, 78) - 0.5) * 6;
      rr.rect(x, t, 3, 3, fill2);
      rr.rect(x, t + 3, 3, 700, fill);
    }
  }));
  for (let i = 0; i < 4; i++) depth.add(new ForestMist(i, 214 + 10 + i * 22, 3 + i * 2, clock, 0.6 - i * 0.04, 71 + i, 700, 110, i >= 2 ? '#d0e0d8' : '#cfe2d8'));
  const main = st.addLayer('main', 1, 0, 1, 0);
  f.main = main;
  // the giants the walkway runs through: top and bottom out of the frame
  for (const [x, kind, w] of CN_TRUNKS) {
    const gy = cnGround(x) + 420;
    const H = Math.round(gy - CN.minY + 80);
    const fr = frameOf(`trunk:${x}`, () => paintGiant(kind, x + 9, w, H, { epiphytes: 1.4, vines: 1.3, sink: 0 }));
    main.add(new Prop(fr, x, gy, -6.5));
    trunkPOI(f, x, cnGround(x), 200, 3);
  }
  // mist in front of the trunks' lower reaches, behind the limbs
  main.add(new ForestMist(-5, 214 + 70, 6, clock, 0.4, 81, 640, 100, '#d6e6de'));
  main.add(new ForestMist(-4.8, 214 + 130, 9, clock, 0.5, 83, 700, 110, '#dcebe4'));
  // the branch road
  const CH = 950;
  for (let x0 = 0; x0 < CN.W; x0 += CH) {
    const w = Math.min(CH, CN.W - x0);
    const ch = paintBranchRoad(x0, w, cnGround, thick, 2201 + x0);
    const fr = bigFrame(game.r, ch.buf);
    main.add(new Custom(-3, rr => { if (x0 + w < rr.visibleX0(4) || x0 > rr.visibleX1(4)) return; rr.draw(fr, x0, ch.y0); }));
  }
  // the vine bridge off the east end, toward the stone terraces of the pā
  {
    const vb = paintVineBridge(420, 26);
    const fr = local.add('cn11:bridge', vb.buf, vb.ax, vb.ay);
    main.add(new Prop(fr, CN_SPOT.bridge, cnGround(CN_SPOT.bridge) + 1, -2.8));
  }
  // epiphytes on the limbs: ground cover that bends as you push through, big clumps by the trunks
  const movers = (): Mover[] => {
    const out: Mover[] = [{ x: f.player.x, y: f.player.y, vx: f.player.vx }];
    for (const a of f.actors.values()) if (a.visible) out.push({ x: a.x, y: a.y, vx: a.walking ? a.facing * 40 : 0 });
    for (const an of f.animals) if (!an.dead && !an.gone && an.medium === 'ground') out.push({ x: an.x, y: an.y, vx: an.vx });
    return out;
  };
  const me = () => ({ x: f.player.x, y: f.player.y, vx: f.player.vx });
  const back = new GroundCover(-2.4, movers, me), front = new GroundCover(58, movers, me);
  main.add(back); main.add(front);
  const tuft = (kinds: PlantKind[], sizes: [number, number]) => {
    const kind = kinds[rng.int(0, kinds.length - 1)], v = rng.int(0, 3), s = Math.round(rng.range(sizes[0], sizes[1]) / 4) * 4;
    return frameOf(`tuft:${kind}:${v}:${s}`, () => plant(kind, 2300 + v * 7 + s, s));
  };
  const garden = (x: number) => x > 1800 && x < 2800;
  for (let x = 20; x < CN.W - 20; x += rng.range(10, 24)) {
    if (Math.abs(x - CN_SPOT.bridge - 60) < 80) continue;
    if (rng.next() > (garden(x) ? 0.95 : 0.7)) continue;
    back.add(tuft(garden(x) ? ['astelia', 'flowers', 'lanternpod', 'kidneyfern', 'astelia'] : ['kidneyfern', 'fern', 'astelia', 'moss', 'seedling'], [14, 30]), x, cnGround(x) + 1, rng.chance(0.5));
  }
  for (let x = 30; x < CN.W - 20; x += rng.range(24, 50)) front.add(tuft(['moss', 'kidneyfern', 'seedling'], [10, 16]), x, cnGround(x) + rng.range(2, 4), rng.chance(0.5));
  for (const [x, , w] of CN_TRUNKS) {
    for (const dx of [-w * 0.55, w * 0.5]) {
      const v = rng.int(0, 2);
      const fr = frameOf(`clump:${v}`, () => plant('astelia', 2400 + v, 46));
      main.add(new Prop(fr, x + dx, cnGround(x + dx) + 2, 2, { sway: 0.4, flip: dx < 0 }));
    }
  }
  // hide spots: the thickest epiphyte clumps
  HIDES.length = 0;
  for (const x of [600, 1400 + 120, 1960, 2960]) {
    const s = sprite(`cn11:hide:${x % 3}`, () => plant('astelia', 2500 + (x % 3), 50));
    const y = cnGround(x) + 3;
    if (s) {
      main.add(new Prop(s.f, x, y, 66, { sway: 0.5 }));
      f.occluders.push({ mask: s.s.buf, x, y, ax: s.s.ax, ay: s.s.ay, sx: 1, sy: 1, p: 1, z: 66 });
    }
    f.pois.push({ kind: 'cover', x, y, w: 18 });
    HIDES.push({ x, w: 30, y, cover: 0.8 });
  }
  // light and air
  shade = new WoodsShade(clock, canopy, cnGround);
  main.add(shade);
  const rays: [number, number, number][] = [[420, 120, 1.2], [1100, 100, 1], [1700, 140, 1.2], [2350, 110, 1], [3000, 160, 1.3], [3550, 100, 1]];
  main.add(new WoodsRays(clock, main, rays, cnGround));
  main.add(new WoodsAir(main, clock, canopy, cnGround));
  for (const [x, w] of rays) f.sunspots.push({ x: x - 40, w });
  // the framing: canopy hanging in from the top, foliage of the trees below rising in at the bottom
  woodsFront(f, { W: CN.W, G: cnGround, keep: [CN_SPOT.bridge, CN_SPOT.ruins, CN_SPOT.toki, 770, 990, 1640, CN_SPOT.exit + 60], frontTrunks: [640, 2380], rise: 0.6, hang: 1.3 }, frameOf, rng);
  installWoodsEnv(f, clock, canopy, cnGround, { open: 0.8 });
  // terrain: the walkway
  const pts: [number, number][] = [];
  for (let x = 0; x <= CN.W; x += 6) pts.push([x, cnGround(x)]);
  st.terrain.addGround(pts, 'ground');
  // the V2 site's content
  for (const x of [520, 980, 1760, 2300, 3100]) f.pois.push({ kind: 'fruit', x, y: cnGround(x), amount: 25 });
  for (const [x] of CN_TRUNKS) f.pois.push({ kind: 'flower', x: x + 30, y: cnGround(x) - 80 });
  for (const x of [1900, 2200, 2500]) f.pois.push({ kind: 'flower', x, y: cnGround(x) - 20 });
  const N: [string, string, number][] = [
    ['moon1', 'moonfruit', 520], ['moon2', 'moonfruit', 1760], ['pitch1', 'pitcher', 640], ['moth1', 'skymoth', 880], ['moth2', 'skymoth', 2900],
    ['brack1', 'bracket', 1080], ['mantis1', 'mantis', 1300], ['rata1', 'rata', 2450], ['drop1', 'dropping', 2560], ['feath1', 'feather', 3000],
    ['beetle1', 'lanternbeetle', 1150], ['kawa1', 'kawakawa', 3350], ['moss1', 'mossrock', 400],
  ];
  for (const [k, kind, x] of N) node(f, k, kind, x, cnGround(x));
  clueSpot(f, 'gecko-shed', 770, cnGround(770), 'Examine the bark', 'A shed skin, gecko-shaped. Toe pads and all.');
  clueSpot(f, 'shed-ribbon', 1640, cnGround(1640), 'Look at the snagged skin', 'Rainbow scales… a snake shed this up HERE?');
  clueSpot(f, 'cracked-seeds', 990, cnGround(990), 'Look at the seeds', 'Split clean in half. I couldn’t do that with a hammer.');
  void packColor;
}

export const CANOPY_V11: FieldSite = {
  id: 'canopy', name: 'Emerald Canopy', width: CN.W, camY: 180, followY: true, minY: CN.minY, maxY: CN.maxY,
  spawnX: CN_SPOT.enter, exitX: CN_SPOT.exit, waterY: null, ambience: 'canopy', music: 'wonder', ground: 'wood',
  build,
  onUpdate(f, dt) {
    woodsCamera(f, cnGround, dt);
    const p = f.player;
    if (!p) return;
    const sh = shade;
    if (sh) {
      const tint = (a: { x: number; tint: number }) => { const s = sh.sample(a.x, f.st.time); const k = 1 - s * 0.3; a.tint = s > 0.01 ? packColor(k, k, k * 1.02, 1) : 0xffffffff; };
      tint(p.body as unknown as { x: number; tint: number });
      for (const a of f.actors.values()) tint(a as unknown as { x: number; tint: number });
    }
    const [n, sub] = cnZone(p.x);
    const key = n + '|' + sub;
    if (key !== placeKey && f.hud) { placeKey = key; f.hud.setPlace(n, `${sub} · Day ${game.save.day || 1}`); }
  },
  spawns: [
    { species: 'skyribbon', n: [2, 4], x: [250, 3500], poi: 'branch', medium: 'trunk', times: ['dawn', 'day'], chance: 1 },
    { species: 'lurevip', n: [1, 2], x: [250, 3500], poi: 'branch', medium: 'trunk', times: ['dusk', 'night'], chance: 0.9 },
    { species: 'galehawk', n: [1, 1], x: [300, 3600], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'sailglider', n: [2, 4], x: [250, 3500], poi: 'trunk', medium: 'trunk', times: ['dusk', 'night', 'dawn'], chance: 1 },
    { species: 'flicker', n: [1, 2], x: [400, 3500], times: ['dawn', 'day', 'dusk'], chance: 0.7 },
    { species: 'barkgecko', n: [2, 3], x: [250, 3500], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'nutcracker', n: [4, 7], x: [1900, 2400], herd: true, times: ['dawn', 'day'], chance: 0.9 },
  ],
  insects: [
    { kind: 'butterfly', x: [200, 3600], y: [120, 200], n: 10, times: ['day', 'dawn'] },
    { kind: 'bee', x: [1800, 2800], y: [150, 205], n: 8, times: ['day'] },
    { kind: 'skymoth', x: [200, 3600], y: [100, 200], n: 8, times: ['dusk', 'night'] },
    { kind: 'firefly', x: [0, 3800], y: [120, 210], n: 26, times: ['dusk', 'night'] },
    { kind: 'cicada', x: [200, 3600], y: [100, 180], n: 4, times: ['day'] },
  ],
  onEnter: f => {
    for (const h of HIDES) if (!f.player.hides.some(q => q.x === h.x)) f.player.hides.push(h);
    const cam = f.st.cam;
    cam.zoom = cam.tzoom = 1.25;
    cam.y = cam.ty = cnGround(f.player.x) - 34;
    placeKey = '';
    return arrive(f, 'Emerald Canopy', 'Te Tāhuhu o te Ngāhere', 'Don’t look down, Doc. And watch the branches: the snakes fly here.');
  },
};

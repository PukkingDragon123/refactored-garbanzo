// V11 Te Kāinga, built: a dense, lived-in village on a river terrace (layout.ts has where everything
// stands). The ground is trodden earth between the houses and grass at the edges; the forest is
// pushed back to the ends of the terrace so the sky opens over the roofs, with more houses, smoke and
// a second pātaka behind on the slope. Everything is placed to stand on the ground and overlap a
// little: a bench against a wall, kete on the porch, the dog asleep in front of a door.
//
// The time of day sets the village: by day everyone works; at dusk the hāngī comes up and Koro goes to
// the pou; after dark the fire on the marae is lit, the torches along the paths, and everyone gathers
// round it (and on the festival night, the lanterns and the dance: festival.ts).

import type { FieldScene } from '../../scenes/field';
import { game } from '../../game';
import { Prop, Custom, AnimProp, LightSource } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { bigFrame } from '../../../gfx/atlas';
import { PixelBuffer } from '../../../art/pixel';
import { hex, mix, shade } from '../../../art/color';
import type { C } from '../../../art/color';
import type { Sprite } from '../../../art/jungle-core';
import { plant } from '../../../art/jungle-plants';
import { tree } from '../../../art/jungle-trees';
import { PAL } from '../../../art/palettes';
import { Rng, bayer, clamp, rand } from '../../../core/math';
import { A, propAnims } from '../../assets';
import { sprite, skyAndRidge, jungleWalls, trees, undergrowth, frontFoliage, mainLayer } from '../../sites2/common';
import { steam } from '../../sites10/kit';
import type { Interactable } from '../../../world/npc';
import { count } from '../../inventory';
import * as P from '../../../art/v11/village/props';
import { registerAllVillagers } from '../../../art/v11/village/villagers2';
import { Livestock } from './livestock';
import type { VCtx } from './ctx';
import { say, bark, sleep } from './ctx';
import { W, G, RIVER, X } from './layout';
import { spawnVillagers, defineVillagePeople, welcome } from './people';
import { placeChores } from './chores';
import { installLife, bindLifeCtx } from './life';
import { registerVillageQuests, startVillageQuest, vf, setVf } from './lore';
import { questStatus } from '../../quests';
import './items';

export { W, G, RIVER, X };

/** the terrace: a gentle rise from the river bank, a few bumps, a little dip by the marae */
export const villageGround = (x: number) => (x < RIVER ? G + 10 - (x / RIVER) * 10 : G + Math.sin(x * 0.008) * 2 + Math.sin(x * 0.031) * 1 - (x > X.palisade[0] ? (x - X.palisade[0]) * 0.03 : 0));

let current: VCtx | null = null;
/** the village of the scene being played (or null) */
export const villageCtx = () => (current && game.scene === current.f ? current : null);

// ------------------------------------------------------------------ the ground
const PATHS: [number, number][] = [[RIVER, 300], [380, 420], [690, 720], [790, 860], [1060, 1460], [1580, 2060], [2380, 2600]];
const TILLED: [number, number][] = [[X.garden[0], X.garden[1]]];
function groundStrip(f: FieldScene) {
  const h = 120, yTop = G - 10;
  const buf = new PixelBuffer(W, h);
  const grass = PAL.moss, dirt = [hex('#2c1e14'), hex('#3e2c1e'), hex('#56402a'), hex('#6e5436'), hex('#8a6c46'), hex('#a08458')], till = PAL.soil;
  const rng = new Rng(77);
  const zone = (x: number, list: [number, number][]) => { let k = 0; for (const [a, b] of list) { const e = Math.min(x - a, b - x); if (e > 0) k = Math.max(k, clamp(e / 18)); } return k; };
  for (let x = 0; x < W; x++) {
    const gy = Math.round(villageGround(x) - yTop);
    const pk = zone(x, PATHS), tk = zone(x, TILLED);
    for (let y = Math.max(0, gy); y < h; y++) {
      const d = y - gy, dth = bayer(x, y);
      const usePath = pk > dth * 0.9 + 0.05, useTill = tk > dth * 0.9 + 0.05;
      let c: C;
      if (d < 4) {
        const top = useTill ? [till[2], till[3], till[4], till[5]] : usePath ? [dirt[2], dirt[3], dirt[4], dirt[5]] : [grass[3], grass[4], grass[5], grass[6]];
        c = top[clamp(3 - d, 0, 3)];
      } else c = mix(usePath || useTill ? dirt[1] : grass[1], hex('#140e0a'), clamp(d / 70));
      if (d > 3 && bayer(x, y) < 0.07) c = shade(c, 0.1);
      if (d > 5 && ((x * 13 + y * 7) % 41 === 0)) c = shade(c, -0.14);
      // pebbles and flecks in the trodden earth
      if (usePath && d > 0 && d < 10 && rng.next() < 0.012) c = hex('#9a8a72');
      buf.data[y * W + x] = c;
    }
    if (!usePathAt(x) && rng.chance(0.45)) buf.set(x, gy - 1, grass[rng.int(3, 6)]);
    if (usePathAt(x) && rng.chance(0.05)) buf.set(x, gy - 1, dirt[4]);
  }
  function usePathAt(x: number) { return zone(x, PATHS) > 0.5; }
  f.main.add(new Prop({ ...bigFrame(game.r, buf), ax: 0, ay: 0 }, 0, yTop, -10));
  const pts: [number, number][] = [];
  for (let x = 0; x <= W; x += 8) pts.push([x, villageGround(x)]);
  f.st.terrain.addGround(pts, 'ground');
}

// ------------------------------------------------------------------ placing things
function put(f: FieldScene, key: string, gen: () => Sprite | null, x: number, z = -4, o: { dy?: number; flip?: boolean; sway?: number; tint?: number; layer?: 'main' | 'mid' } = {}) {
  const c = sprite('vil11:' + key, gen);
  if (!c) return null;
  const y = villageGround(x) + (o.dy ?? 2);
  const layer = o.layer === 'mid' ? f.st.layer('mid') : f.main;
  const px = o.layer === 'mid' ? x * 0.8 : x;
  layer.add(new Prop(c.f, px, y, z, { flip: o.flip, sway: o.sway, tint: o.tint }));
  return c;
}
/** tufts of grass and flax at the foot of a building, so nothing looks pasted on */
function skirt(f: FieldScene, x0: number, x1: number, seed: number, z = -3.5) {
  const rng = new Rng(seed);
  for (let x = x0; x < x1; x += rng.range(7, 16)) {
    const k = rng.next() < 0.7 ? 'grass' : rng.next() < 0.5 ? 'flax' : 'fern';
    const v = rng.int(0, 2);
    const c = sprite(`vil11:tuft:${k}:${v}`, () => plant(k as never, 520 + v * 7, k === 'flax' ? 22 : 12));
    if (c) f.main.add(new Prop(c.f, x, villageGround(x) + 3, z + rng.next() * 0.2, { sway: 0.8, flip: rng.chance(0.5) }));
  }
}
function fire(f: FieldScene, x: number, big: number, z: number) {
  const y = villageGround(x);
  f.main.add(new AnimProp(propAnims.flame, x, y - 1, z, 12, { emissive: 1, sx: big, sy: big }));
  f.main.add(new AnimProp(propAnims.flame, x + 4 * big, y - 2, z + 0.1, 10, { emissive: 1, sx: 0.7 * big, sy: 0.8 * big }));
  f.main.add(new AnimProp(propAnims.flame, x - 4 * big, y - 1, z + 0.1, 9, { emissive: 1, sx: 0.6 * big, sy: 0.7 * big }));
  f.main.add(new LightSource(x, y - 16 * big, 120 * big, [1, 0.58, 0.26], 0.46, z + 1, A.glow, 0.22 * big, 0.16, 0.03));
  f.lights.push({ x, y: y - 10, r: 150 * big, k: 0.8 });
  let t = 0;
  f.main.add(new Custom(z + 2, () => {}, dt => {
    t -= dt;
    if (t > 0) return;
    t = 0.06 / big;
    f.main.glowParticles.spawn({ frame: A.dot, x: x + rand.range(-4, 4) * big, y: y - 8 * big, vx: rand.range(-10, 10), vy: rand.range(-60, -30), life: rand.range(0.8, 1.6), color: [1, 0.78, 0.38], alpha: 1, alpha1: 0, glow: true, intensity: 3, wobble: 6, wobbleF: 2 });
  }));
}
function smoke(f: FieldScene, x: number, y: number, k = 1) {
  const lp = f.main.particles;
  f.main.add(new Custom(-8, () => {}, dt => {
    if (rand.chance(dt * 3 * k)) lp.spawn({ frame: A.soft, x: x + rand.range(-2, 2), y, vx: rand.range(-2, 2) + f.st.wind * 6, vy: rand.range(-16, -9), life: rand.range(3, 5), color: [0.78, 0.78, 0.8], alpha: 0.22, alpha1: 0, size: rand.range(0.3, 0.45), size1: rand.range(1.4, 2.2) });
  }));
}

// ------------------------------------------------------------------ the build
export async function buildVillage(f: FieldScene) {
  registerAllVillagers();
  registerVillageQuests();
  defineVillagePeople();
  const st = f.st;
  const night = f.tod === 'night', lowSun = f.tod === 'dusk' || f.tod === 'dawn';
  const festival = night && questStatus('v11_festival') === 'active' && vf('prep:wood') && vf('prep:kai') && vf('prep:dance') && !vf('festival');
  const c: VCtx = { f, ground: villageGround, tod: f.tod, night, festival, vill: {}, live: null, hold: false };
  current = c;

  // sky, the far bush, and the slope behind the village
  skyAndRidge(f, { seed: 61, base: 220 });
  jungleWalls(f, G, [{ p: 0.2, fog: 0.45, depth: 1, seed: 411, lift: 64 }, { p: 0.4, fog: 0.28, depth: 2, seed: 412, lift: 52 }]);
  const mid = st.addLayer('mid', 0.8, 0.06, 0.55, 0);
  const midG = { y: (x: number) => villageGround(x / 0.8) };
  trees(f, mid, 0, 420, [70, 120], ['rata', 'broadleaf', 'treefern'], midG, 421, { variants: 3 });
  trees(f, mid, 2260, W / 0.8 + 200, [70, 120], ['rata', 'broadleaf', 'kauri', 'treefern'], midG, 422, { variants: 3 });
  // cabbage trees and nīkau scattered over the terrace behind the houses
  trees(f, mid, 520, 2200, [280, 460], ['nikau', 'treefern'], midG, 423, { variants: 3 });
  const midTint = packColor(0.74, 0.76, 0.8, 1);
  for (const [x, v] of [[560, 1], [1180, 3], [1460, 0], [1760, 2], [2080, 1]] as [number, number][]) {
    const cc = sprite(`vil11:midwhare:${v}:${x}`, () => P.whare(v, x));
    if (cc) mid.add(new Prop(cc.f, x * 0.8, villageGround(x) + 4, 1, { tint: midTint }));
  }
  const pt2 = sprite('vil11:midpataka', P.pataka);
  if (pt2) mid.add(new Prop(pt2.f, 1300 * 0.8, villageGround(1300) + 2, 1.5, { tint: midTint }));
  const mf = sprite('vil11:midfence', () => P.fence(260, 'wattle', 9));
  if (mf) mid.add(new Prop(mf.f, 520 * 0.8, villageGround(520) + 3, 2, { tint: midTint }));

  mainLayer(f);
  groundStrip(f);
  const main = f.main;

  // ---------------------------------------------------------------- the river and the landing
  main.add(new Custom(-2, (rr, s2) => {
    rr.water(0.85, 1.4, 0.8);
    rr.rect(0, G + 4, RIVER + 20, 60, packColor(0.1, 0.22, 0.2, 1));
    rr.water(0);
    for (let i = 0; i < 12; i++) rr.fxDraw(A.dot2, Math.round((i * 23 + s2.time * 12) % RIVER), G + 5 + (i % 3), 1.4, 0.4, 0, packColor(1, 1, 1, 1), 0.35);
  }));
  const jy = G - 1;
  st.terrain.addPlatform([[X.jetty[0], jy], [X.jetty[1], jy]], 'bridge');
  const jt = sprite('vil11:jetty', () => P.jetty(X.jetty[1] - X.jetty[0]));
  if (jt) main.add(new Prop(jt.f, X.jetty[0], jy, -1.8));
  put(f, 'waka', () => wakaMoored(), X.waka, -1.9, { dy: 6 });
  for (let x = X.reeds[0]; x < X.reeds[1]; x += 9) { const v = (x / 9) % 3 | 0; const cc = sprite(`vil11:reed:${v}`, () => plant('sedge', 610 + v, 26)); if (cc) main.add(new Prop(cc.f, x, villageGround(x) + 5, x < RIVER ? -1.7 : 1.2, { sway: 1.1, flip: v === 1 })); }
  put(f, 'pou', P.hineruaPou, X.pou, -2.4, { dy: 3 });
  put(f, 'hinaki', P.hinaki, X.hinaki, -1, { dy: 4 });
  put(f, 'hinaki2', P.hinaki, X.hinaki + 18, -1.1, { dy: 5, flip: true });
  put(f, 'nets', () => P.netPoles(3), X.nets, -3);
  put(f, 'smokerack', () => P.dryingRack(5), X.smokeRack, -3);
  smoke(f, X.smokeRack, villageGround(X.smokeRack) - 6, 1.6);
  put(f, 'gourds', () => P.gourds(4), X.gourds, -1);
  put(f, 'logseat1', () => P.logSeat(30), X.gourds + 26, -1);

  // ---------------------------------------------------------------- gardens and animals
  for (let x = X.garden[0]; x < X.garden[1] - 40; x += 92) put(f, `kumara:${x}`, () => P.kumaraRow(96, x), x + 48, -2.5, { dy: 3 });
  put(f, 'gfence', () => P.fence(X.garden[1] - X.garden[0] + 20, 'wattle', 21), X.garden[0] - 10, -5, { dy: 2 });
  put(f, 'ketek', () => P.kete(3, 7), X.kumaraKete, -1);
  put(f, 'pen', () => P.pigPen(X.pen[1] - X.pen[0]), X.pen[0], 1.5, { dy: 2 });
  put(f, 'shelter', () => P.shelter(70), X.shelter, -4);
  put(f, 'ketem', () => P.kete(2, 11), X.shelter + 24, -1);
  for (const [x, s] of [[X.flax, 30], [X.flax + 18, 26], [X.flax - 70, 24]] as [number, number][]) put(f, `flax:${x}`, () => plant('flax', 700 + x, s), x, -1.5, { sway: 0.9 });

  // ---------------------------------------------------------------- the wharenui and the marae
  put(f, 'wharenui', P.wharenui, X.wharenui, -6, { dy: 3 });
  skirt(f, X.wharenui - 104, X.wharenui - 70, 31);
  skirt(f, X.wharenui + 72, X.wharenui + 104, 32);
  put(f, 'koroBench', () => P.bench(26), X.koroSeat, -1, { dy: 1 });
  // the fire pit on the marae, its ring of logs
  put(f, 'firepit', () => firePit(), X.fire, -1, { dy: 1 });
  for (const dx of [-45, -105, 77, 97]) put(f, `fireLog:${dx}`, () => P.logSeat(dx === 97 ? 22 : 26), X.fire + dx, -1.2, { dy: 1 });
  if (night || f.tod === 'dusk') fire(f, X.fire, night ? 1.4 : 0.9, -0.6);

  // ---------------------------------------------------------------- the cooking
  put(f, 'hangi', P.hangiMound, X.hangi, -1.5, { dy: 1 });
  steam(f, X.hangi, villageGround(X.hangi) - 4, 14, lowSun || night ? 1.6 : 0.8);
  put(f, 'cookfire', P.cookFire, X.cookFire, -1.4, { dy: 1 });
  fire(f, X.cookFire, 0.55, -1.45);
  steam(f, X.cookFire, villageGround(X.cookFire) - 18, 4, 0.7);
  put(f, 'woodpile', () => P.woodpile(3), X.woodpile, -2);
  put(f, 'foodbench', () => P.bench(36), X.foodBench, -1.6);
  put(f, 'foodkete', () => P.kete(2, 23), X.foodBench, -1.5, { dy: -5 });

  // ---------------------------------------------------------------- the carving shed, the waka on its trestles
  put(f, 'shed', () => P.shed(150), X.shed, -5);
  put(f, 'wakabuild', P.wakaBuild, X.wakaBuild, -2);

  // ---------------------------------------------------------------- the houses and everything round them
  put(f, 'whare1', () => P.whare(0, 1), X.whare1, -6, { dy: 3 });
  put(f, 'laundry', () => P.laundry(5), X.laundry, -5.5, { sway: 0.4 });
  put(f, 'whare2', () => P.whare(1, 2), X.whare2, -6, { dy: 3 });
  put(f, 'whare3', () => P.whare(3, 3), X.whare3, -6, { dy: 3 });
  skirt(f, X.whare1 - 50, X.whare3 + 50, 41);
  put(f, 'toyTop', () => P.toy('top'), X.whare1 + 40, -1);
  put(f, 'toyBall', () => P.toy('ball'), X.whare1 + 70, -1);
  put(f, 'toyWaka', () => P.toy('waka'), X.whare2 + 46, -1);
  put(f, 'toyHoop', () => P.toy('hoop'), X.whare2 - 40, -1, { dy: 1 });
  put(f, 'hanaBench', () => P.bench(28), X.hanaBench, -1);
  put(f, 'ketew', () => P.kete(2, 31), X.whare3 + 30, -1);
  put(f, 'gourdsw', () => P.gourds(9), X.whare1 - 34, -1);
  put(f, 'pataka', P.pataka, X.pataka, -5, { dy: 3 });
  put(f, 'coop', P.coop, X.coop, -4, { dy: 2 });
  put(f, 'woodpile2', () => P.woodpile(8), X.whare3 - 50, -4);
  for (const x of [X.goats[0], X.goats[1]]) put(f, `tether:${x}`, () => tether(), x, -1);

  // ---------------------------------------------------------------- the palisade and the gateway
  for (let x = X.palisade[0]; x < W; x += 96) if (Math.abs(x + 48 - X.gate) > 70) put(f, `pal:${x}`, () => P.stakes(100, x), x, -7, { dy: 3 });
  put(f, 'gate', P.gateway, X.gate, -4, { dy: 3 });

  // ---------------------------------------------------------------- night: torches along the paths
  if (night || f.tod === 'dusk') {
    for (const x of [X.pou + 40, X.wharenui - 110, X.wharenui + 110, X.hangi + 60, X.whare1 + 60, X.whare3 - 60, X.gate - 40, X.gate + 40]) {
      put(f, `torch:${x}`, P.torch, x, -0.5);
      const y = villageGround(x) - 33;
      main.add(new AnimProp(propAnims.flame, x, y, -0.4, 11, { emissive: 1, sx: 0.5, sy: 0.6 }));
      main.add(new LightSource(x, y - 6, 70, [1, 0.62, 0.3], 0.5, -0.3, A.glow, 0.18, 0.2, 0.06));
      f.lights.push({ x, y, r: 80, k: 0.5 });
    }
  }
  // chimney smoke from the houses (cooking inside)
  for (const x of [X.whare1 - 16, X.whare2 + 10, X.whare3 - 6]) smoke(f, x, villageGround(x) - 58, 0.7);

  // ---------------------------------------------------------------- plants at the edges
  undergrowth(f, main, RIVER + 40, X.garden[0] - 20, 0.6, { y: villageGround }, 441, { plants: ['flax', 'grass', 'kawakawa', 'fern', 'flowers'] });
  undergrowth(f, main, X.palisade[0] - 60, W, 0.5, { y: villageGround }, 442, { plants: ['flax', 'grass', 'fern', 'astelia'] });
  frontFoliage(f, 300, X.garden[0], [260, 420], ['flax', 'grass', 'fronds'], 1.35, G + 112, 451);
  frontFoliage(f, X.palisade[0], W, [200, 320], ['flax', 'grass', 'fronds'], 1.35, G + 112, 452);
  for (const x of [600, 1300, 1900]) f.pois.push({ kind: 'fruit', x, y: villageGround(x), amount: 15 }, { kind: 'flower', x: x + 40, y: villageGround(x) - 30 });

  // ---------------------------------------------------------------- livestock
  const live = new Livestock(f, villageGround);
  c.live = live;
  for (let i = 0; i < 3; i++) live.add('pig', X.pen[0] + 14 + i * 26, [X.pen[0] + 8, X.pen[1] - 10], { v: i });
  for (let i = 0; i < 5; i++) live.add('hen', X.coop - 120 + i * 40, [X.whare3 - 40, X.goats[0] - 10], { v: i });
  live.add('rooster', X.coop + 20, [X.whare3, X.goats[0] - 10], { v: 0 });
  for (let i = 0; i < 3; i++) live.add('hen', X.hangi + 40 + i * 30, [X.hangi + 20, X.shed - 60], { v: i + 1 });
  live.add('dog', X.whare2 + 22, [X.whare2, X.whare2 + 40], { v: 0, lazy: true, anim: 'lie' });
  live.add('dog', X.whare1, [X.wakaBuild, X.whare3], { v: 1, follow: () => c.vill.mikaere?.a.x ?? null });
  live.add('dog', X.koroSeat + 22, [X.koroSeat + 10, X.koroSeat + 40], { v: 2, lazy: true, anim: 'sit' });
  for (let i = 0; i < 2; i++) live.add('goat', X.goats[0] + i * 50, [X.goats[0] - 10 + i * 50, X.goats[0] + 30 + i * 50], { v: i });
  live.mount(40);

  // ---------------------------------------------------------------- people, chores, the fire, the reeds
  spawnVillagers(c);
  placeChores(c);
  placeFire(c);
  placeReeds(c);
  bindLifeCtx(villageCtx);
  installLife(c);
  (await import('./sidequests')).placeSideQuests(c);
  if (festival) await (await import('./festival')).stageFestival(c);
}

// ------------------------------------------------------------------ small painters local to the scene
function wakaMoored(): Sprite {
  const b = new PixelBuffer(130, 22);
  const WD = P.VP.wood;
  for (let x = 0; x < 120; x++) {
    const t = x / 120, top = 10 - Math.sin(t * Math.PI) * 1.5, bot = 10 + Math.sin(t * Math.PI) * 8;
    for (let y = Math.floor(top); y < bot; y++) b.set(x + 4, y, y < top + 2 ? WD[5] : WD[clamp(Math.round(4 - (y - top) / 3), 0, 5)]);
  }
  // the carved prow (tauihu) and stern post, a paddle laid across
  for (let y = 0; y < 12; y++) { b.set(122 + (y < 4 ? 2 : 0), y, P.VP.ochre[3]); b.set(123, y, y % 3 ? P.VP.ochre[4] : P.VP.ochre[1]); }
  for (let y = 2; y < 10; y++) b.set(4, y, P.VP.ochre[3]);
  b.set(124, 3, P.VP.paua);
  for (let x = 30; x < 70; x++) b.set(x, 8, WD[3]);
  b.ellipse(72, 8, 4, 1, WD[3]);
  for (let x = 10; x < 110; x += 9) b.set(x, 9, hex('#e8e0c8'));
  b.outline(P.VP.ink);
  return { buf: b, ax: 65, ay: 17 };
}
function firePit(): Sprite {
  const b = new PixelBuffer(40, 10);
  for (let i = 0; i < 9; i++) b.disc(4 + i * 4, 7, 2.2, P.VP.stone[2 + (i % 3)]);
  b.line(10, 6, 30, 3, P.VP.wood[2]); b.line(11, 3, 29, 6, P.VP.wood[3]);
  b.rect(14, 5, 12, 2, hex('#2a1a12'));
  b.outline(P.VP.ink);
  return { buf: b, ax: 20, ay: 9 };
}
function tether(): Sprite {
  const b = new PixelBuffer(10, 20);
  for (let y = 4; y < 20; y++) { b.set(4, y, P.VP.wood[3]); b.set(5, y, P.VP.wood[2]); }
  b.line(5, 8, 9, 14, P.VP.cream[2]);
  b.outline(P.VP.ink);
  return { buf: b, ax: 5, ay: 19 };
}

/** the fire on the marae: sit and let the day go by */
function placeFire(c: VCtx) {
  const f = c.f;
  (f.interact as Interactable[]).push({
    x: X.fire, y: villageGround(X.fire), w: 18, h: 16, label: c.night ? 'Sit by the fire' : 'Sit by the fire and rest', standX: X.fire - 22,
    action: async () => {
      if (f.cutscene || c.hold) return;
      f.cutscene = true;
      try {
        const R = await import('./ritual');
        const opts: string[] = [];
        if (c.tod === 'day' || c.tod === 'dawn') opts.push('Rest until evening');
        if (!c.night) opts.push('Rest until dark');
        if (c.night && !vf('story') && vf('askPou')) opts.push('Ask Koro for the story');
        opts.push('Just sit a while');
        const k = await say(f, [{ who: 'mori', text: c.night ? 'The fire cracks. Someone passes round a cup of tea.' : 'The embers are warm. People come and go, someone always cooking something.', style: 'think', choices: opts }]);
        const pick = opts[k];
        if (pick === 'Rest until evening') await R.restUntil(c, 'dusk');
        else if (pick === 'Rest until dark') await R.restUntil(c, 'night');
        else if (pick === 'Ask Koro for the story') await R.storyByFire(c);
        else {
          f.player.poseOverride = 'sitGround';
          await sleep(2600);
          f.player.poseOverride = null;
          if (rand.next() < 0.5) bark('aroha', rand.pick(['This is my favourite place in the whole world. Don’t tell anyone.', 'Nanny Huia is watching you. She thinks you need feeding.', 'Listen. You can hear the river from everywhere in the village.']), { expr: 'happy' });
        }
      } finally { f.cutscene = false; }
    },
  } as Interactable);
}

/** the reeds below the pou catch the moulted skins the river brings down */
function placeReeds(c: VCtx) {
  const f = c.f;
  const avail = () => !vf('skinFound') || (count('vil_kiri') === 0 && !vf('kiriGiven') && game.save.vars['v11v:skinDay'] !== game.save.day);
  (f.interact as Interactable[]).push({
    x: X.skin, y: villageGround(X.skin), w: 16, h: 12, label: 'Search the reeds', standX: X.skin + 16, enabled: avail,
    quest: () => questStatus('v11_hinerua') === 'active' && vf('story') && !vf('skinFound'),
    action: async () => {
      if (f.cutscene || c.hold) return;
      f.cutscene = true;
      try {
        f.player.facing = -1;
        const ok = await f.player.doWork('kneel', 2.4);
        if (!ok) return;
        game.save.vars['v11v:skinDay'] = game.save.day;
        const { give } = await import('../../inventory');
        give('vil_kiri', 1);
        const [cx, cy] = f.css(X.skin, villageGround(X.skin) - 14);
        f.hud?.flyItem('vil_kiri', 1, 'Shed serpent skin', cx, cy);
        const first = !vf('skinFound');
        setVf('skinFound');
        if (first) {
          await say(f, [
            { who: 'mori', text: 'There’s something caught in the reeds... it’s a skin. A whole moulted skin, light as paper. You can see every scale.', expr: 'surprised' },
            { who: 'aroha', text: 'Her gift. Hold it gently, Mori. Nobody was hurt for it: the serpents grow out of their old skins and leave them behind.', expr: 'happy' },
          ]);
          startVillageQuest('v11_huekiri', true);
        } else await say(f, [{ who: 'mori', text: 'Another skin, snagged in the reeds. The river keeps bringing them.', expr: 'happy' }]);
      } finally { f.cutscene = false; f.hud?.refresh(); }
    },
  } as Interactable);
}

/** the first time, and every time: on entering the village */
export async function enterVillage(f: FieldScene) {
  const c = villageCtx();
  if (!c) return;
  if (!vf('entered')) { setVf('entered'); void welcome(c); }
  if (game.save.flags['v10:villageMet']) startVillageQuest('v11_hinerua', true);
  if (c.festival) { await (await import('./festival')).runFestival(c); return; }
  // Aroha's reminder about photographs
  let warned = vf('photoWarned');
  f.main.add(new Custom(0, () => {}, () => {
    if (warned || vf('photoOk') || !f.cam?.active) return;
    warned = true;
    setVf('photoWarned');
    bark('aroha', 'Mori. Ask before you photograph people. Ask Koro first. It’s manners.', { expr: 'serious' });
  }));
}

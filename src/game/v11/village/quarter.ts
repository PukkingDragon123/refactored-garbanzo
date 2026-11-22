// V12 Te Huarahi, the market lane, laid out (the art is src/art/v11/village/quarter.ts and clutter.ts),
// and the everyday mess of the whole village: washing strung between the houses, crates and barrels,
// buckets, rope, nets, tarps, ladders, a wheelbarrow, tools on the walls, puddles, firewood, a mat on
// its frame, kete, an old waka hull upturned on blocks, the kids' things, smoke.
//
// West to east along the lane: the Tongan family's fale with their taro, ngatu drying on the line and
// the umu steaming; the Lees' market garden and their store with its lanterns; the shared stalls
// (fish, fruit, woven goods); the trading store; the old gum-digger's grapevine and his hut. Behind
// them, on the slope (the mid layer), more roofs, a water tank, a packing shed, washing. The far end
// (X.dealer, the crossroads at X.backcountry) is left clear. At night the windows, the fale and the
// lanterns are lit with the rest of the village (the same hours as life.ts).
//
// Nothing here moves a story spot: the marae and the fire stay clear, every prop on the gameplay plane
// stands behind the people (z < 0) except low things like puddles, and the lane's buildings stop short
// of the dealer's lean-to.

import { Prop, Custom, LightSource, AnimProp } from '../../../world/props';
import type { Layer } from '../../../world/stage';
import type { FoliageKind } from '../../../world/foliage';
import { packColor } from '../../../gfx/renderer';
import type { Sprite } from '../../../art/jungle-core';
import { plant } from '../../../art/jungle-plants';
import { Rng, rand } from '../../../core/math';
import { A, propAnims } from '../../assets';
import { torch } from '../../../art/v11/village/props';
import { sprite, trees } from '../../sites2/common';
import { steam } from '../../sites10/kit';
import * as K from '../../../art/v11/village/clutter';
import * as Q from '../../../art/v11/village/quarter';
import type { LineSpec, WashStyle } from '../../../art/v11/village/clutter';
import type { VCtx } from './ctx';
import { X } from './layout';
import { villagePhase, hourOf } from './life';

const MID_P = 0.8;
const MID_TINT = packColor(0.74, 0.76, 0.8, 1);

interface PutOpts { dy?: number; y?: number; flip?: boolean; sway?: number; tint?: number; mid?: boolean; foliage?: FoliageKind | false; hang?: boolean }

export function placeQuarter(c: VCtx) {
  const f = c.f, g = c.ground, main = f.main;
  const mid: Layer = f.st.layer('mid');
  /** the lamps come on with the rest of the village (life.ts): evenings, and late at night for some */
  const lit = (late = true) => {
    const ph = villagePhase(c), h = hourOf(f);
    if (ph === null) return c.night || c.tod === 'dusk';
    if (ph === 'night') return late && !(h >= 1 && h < 5.5);
    if (ph !== 'evening') return false;
    return h >= 18 || c.tod === 'dusk' || c.tod === 'night';
  };

  // ------------------------------------------------------------------ placing
  const put = (key: string, gen: () => Sprite | null, x: number, z: number, o: PutOpts = {}) => {
    const cc = sprite('vil12q:' + key, gen);
    if (!cc) return null;
    const layer = o.mid ? mid : main;
    const px = o.mid ? x * MID_P : x;
    const y = o.y ?? g(x) + (o.dy ?? 2) + (o.mid ? 2 : 0);
    const p = new Prop(cc.f, px, y, z, { flip: o.flip, sway: o.sway, tint: o.tint ?? (o.mid ? MID_TINT : undefined), foliage: o.foliage ?? (o.sway ? false : undefined), hang: o.hang });
    layer.add(p);
    return { cc, p, x: px, y };
  };
  /** a house: its lamplit glow drawn when the lamps are lit, a warm light at its windows */
  const house = (key: string, gen: () => Sprite | null, x: number, z: number, o: PutOpts & { late?: boolean; r?: number } = {}) => {
    const h = put(key, gen, x, z, o);
    if (!h || !h.cc.g) return h;
    const gf = h.cc.g, s = h.cc.s, layer = o.mid ? mid : main;
    // where the light is: the middle of the glowing pixels
    let sx = 0, sy = 0, n = 0;
    const gb = s.glow!;
    for (let j = 0; j < gb.h; j += 2) for (let i = 0; i < gb.w; i += 2) if (gb.data[j * gb.w + i] >>> 24) { sx += i; sy += j; n++; }
    const lx = h.x - s.ax + (n ? sx / n : s.ax), ly = h.y - s.ay + (n ? sy / n : s.ay * 0.6);
    const late = o.late ?? true;
    const ls = new LightSource(lx, ly, (o.r ?? 70) * (o.mid ? MID_P : 1), [1, 0.64, 0.3], o.mid ? 0.22 : 0.3, z + 0.2, A.glow, o.mid ? 0.05 : 0.08, 0.1, 0.05);
    layer.add(new Custom(z + 0.01, rr => {
      const on = lit(late);
      ls.on = on;
      if (!on) return;
      rr.emissive(o.mid ? 0.5 : 0.7);
      rr.draw(gf, h.x, h.y);
      rr.emissive();
    }));
    layer.add(ls);
    if (!o.mid) f.lights.push({ x: lx, y: ly, r: 70, k: 0.4 });
    return h;
  };
  /** a washing line and what's pegged on it (each piece swings on its own in the wind) */
  const washing = (key: string, x0: number, sp: LineSpec, style: WashStyle, seeds: number[], z: number, o: { mid?: boolean; y?: number; ngatu?: number[] } = {}) => {
    const ln = put('line:' + key, () => K.washLine(sp), x0, z, { mid: o.mid, y: o.y });
    if (!ln) return;
    const gy = ln.y;
    let at = 4;
    const hangOne = (k: string, gen: () => Sprite) => {
      const cc = sprite('vil12q:' + k, gen);
      if (!cc) return;
      // its width on the line, from the painted pixels
      const b = cc.s.buf;
      let a = b.w, z2 = 0;
      for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (b.data[j * b.w + i] >>> 24) { a = Math.min(a, i); z2 = Math.max(z2, i); }
      const half = (z2 - a) / 2, cxOff = (a + z2) / 2 - cc.s.ax;
      const px = at + half - cxOff;
      if (at + (z2 - a) > sp.w - 2) return;
      if (sp.prop !== undefined && Math.abs(px - sp.prop) < half + 2) { at = sp.prop + 3; return hangOne(k, gen); }
      const wx = (o.mid ? ln.x : x0) + px * (o.mid ? 1 : 1), wy = gy - Math.round(K.lineHeight(sp, px));
      (o.mid ? mid : main).add(new Prop(cc.f, wx, wy, z + 0.05 + rand.next() * 0.02, { sway: o.mid ? 0.5 : 0.75, swaySpeed: 1.6 + rand.next() * 0.6, foliage: false, hang: true, tint: o.mid ? MID_TINT : undefined }));
      at += z2 - a + 2 + ((px * 7) % 3);
    };
    for (const s of o.ngatu ?? []) hangOne(`ngatu:${s}`, () => Q.ngatu(s));
    for (const s of seeds) hangOne(`g:${style}:${s}`, () => K.garment(style, s));
  };
  const smoke = (x: number, y: number, k = 1) => {
    const lp = main.particles;
    main.add(new Custom(-8, () => {}, dt => {
      if (rand.chance(dt * 3 * k)) lp.spawn({ frame: A.soft, x: x + rand.range(-2, 2), y, vx: rand.range(-2, 2) + f.st.wind * 6, vy: rand.range(-16, -9), life: rand.range(3, 5), color: [0.78, 0.78, 0.8], alpha: 0.22, alpha1: 0, size: rand.range(0.3, 0.45), size1: rand.range(1.4, 2.2) });
    }));
  };
  const tufts = (x0: number, x1: number, seed: number, z = -3.4) => {
    const rng = new Rng(seed);
    for (let x = x0; x < x1; x += rng.range(8, 18)) {
      const k = rng.next() < 0.75 ? 'grass' : 'fern', v = rng.int(0, 2);
      const cc = sprite(`vil11:tuft:${k}:${v}`, () => plant(k as never, 520 + v * 7, 12));
      if (cc) main.add(new Prop(cc.f, x, g(x) + 3, z + rng.next() * 0.2, { sway: 0.8, flip: rng.chance(0.5), foliage: 'grass' }));
    }
  };

  // ------------------------------------------------------------------ the slope behind the lane
  // the lane was cut out of the bush: the big trees on the slope give way to roofs, nīkau and cabbage trees
  for (const d of mid.items) if (d instanceof Prop && d.x / MID_P > X.lane[0] + 20 && d.x / MID_P < X.dealer[0] - 40) d.hidden = true;
  trees(f, mid, X.lane[0] + 40, X.dealer[0] - 60, [210, 330], ['nikau', 'treefern'], { y: x => g(x / MID_P) }, 431, { variants: 3 });
  // the houses stand up on the bank the lane was cut into, so their roofs show over the lane's
  const B0 = X.lane[0] - 30, B1 = X.dealer[1] - 40, UP = 26;
  const bw = Math.round((B1 - B0) * MID_P);
  const atB = (x: number) => Math.round(x * MID_P - B0 * MID_P);
  const midHouses: [number, number, number][] = [[2440, 0, 1], [2640, 3, 2], [2830, 2, 3], [3010, 0, 4], [3200, 1, 5], [3400, 3, 6], [3580, 2, 7]];
  const walls: [number, number][] = midHouses.map(([x]) => [atB(x) - 46, atB(x) + 46]);
  put('bank', () => Q.bank(bw, UP + 6, 17, walls, [atB(2540), atB(3110)]), B0, 0.9, { mid: true, dy: 2 });
  for (const [x, v, s] of midHouses) house(`mid:${v}:${s}`, () => Q.midHouse(v, s), x, 1.2 + (s % 3) * 0.05, { mid: true, dy: -(UP + 1), late: s % 2 === 0, r: 60 });
  washing('midA', 2520, { w: 70, hL: 44, hR: 40, sag: 6, posts: [true, true], seed: 11 }, 'mixed', [21, 22, 23, 24, 25], 1.3, { mid: true, y: g(2520) + 1 - UP });
  washing('midB', 3090, { w: 60, hL: 42, hR: 44, sag: 5, posts: [true, true], seed: 12 }, 'kids', [31, 32, 33, 34], 1.3, { mid: true, y: g(3090) + 1 - UP });
  // and in the old village, behind the houses and the cooking
  washing('midC', 1380, { w: 66, hL: 42, hR: 42, sag: 6, posts: [true, true], seed: 13 }, 'mixed', [41, 42, 43, 44], 1.3, { mid: true });
  washing('midD', 640, { w: 72, hL: 44, hR: 40, sag: 6, posts: [true, true], seed: 14 }, 'work', [51, 52, 53, 54, 55], 1.3, { mid: true });

  // ------------------------------------------------------------------ the Tongan family: fale, taro, ngatu, umu
  const fx = X.fale;
  put('taroBund', () => K.puddle(40, 7), fx - 104, -2.75, { dy: 2 });
  for (let i = 0; i < 5; i++) { const x = fx - 120 + i * 9, v = i % 3; put(`taro:${v}`, () => plant('taro', 800 + v * 11, 16 + v * 4), x, -2.6 + i * 0.01, { dy: 3, sway: 0.6, foliage: 'bush', flip: i % 2 === 1 }); }
  washing('pac', fx - 134, { w: 52, hL: 48, hR: 50, sag: 5, posts: [true, true], seed: 21 }, 'pacific', [1, 4, 6], -5.3);
  house('fale', () => Q.fale(3), fx, -6, { dy: 3, r: 90 });
  tufts(fx - 92, fx - 60, 61); tufts(fx + 56, fx + 92, 62);
  put('anvil', () => Q.tapaAnvil(1), fx - 34, -1.2, { dy: 2 });
  put('faleKete', () => K.ketePile(5), fx + 40, -1.3, { dy: 2 });
  washing('ngatu', fx + 78, { w: 92, hL: 54, hR: 52, sag: 4, posts: [true, true], seed: 22 }, 'pacific', [], -5.4, { ngatu: [2, 5] });
  const ux = fx + 128;
  put('umuWood', () => K.firewood(4), ux - 8, -3.2, { dy: 2 });
  put('umu', () => Q.umu(1), ux, -1.5, { dy: 2 });
  steam(f, ux, g(ux) - 6, 14, c.tod === 'dusk' || c.night ? 1.5 : 0.9);
  put('husks', () => Q.husks(1), ux + 30, -1.4, { dy: 2 });
  put('umuBucket', () => K.bucket(7), ux - 34, -1.25, { dy: 2 });

  // ------------------------------------------------------------------ the Lees: the market garden and the store
  const sx = X.leeStore, gx0 = sx - 200;
  put('beans1', () => Q.beanFrame(1), gx0 + 8, -4, { dy: 2, sway: 0.25, foliage: 'vine' });
  put('beans2', () => Q.beanFrame(2), gx0 + 58, -4, { dy: 2, sway: 0.25, foliage: 'vine', flip: true });
  (['cabbage', 'bokchoy', 'onion', 'lettuce'] as const).forEach((k, i) => put(`veg:${k}:${i}`, () => Q.vegBed(k, i + 1), gx0 + 2 + i * 29, -2.5 + i * 0.01, { dy: 3, sway: 0.3, foliage: 'bush' }));
  house('store', () => Q.store(1), sx, -6, { dy: 2, late: false });
  put('pole', () => Q.shoulderPole(1), sx - 80, -1.2, { dy: 2 });
  put('storeCrates', () => K.crateStack(3, ['orange', 'cabbage', 'kumara']), sx + 112, -1.3, { dy: 2 });
  put('storeLadder', () => K.ladder(56, 3), sx + 80, -5.5, { dy: 2 });
  // the red lanterns under the verandah, swinging; lit at night
  for (const [dx, s] of [[-72, 1], [46, 2]] as [number, number][]) {
    const lx = sx + dx, ly = g(sx) + 2 - 62 + 4;
    const lt = put(`lantern:${s}`, () => Q.lantern(s), lx, -5.8, { y: ly, sway: 0.9, foliage: false, hang: true });
    if (!lt) continue;
    const p = lt.p, ls = new LightSource(lx, ly + 12, 46, [1, 0.38, 0.2], 0.34, -5.6, A.glow, 0.08, 0.15, 0.06);
    main.add(ls);
    main.add(new Custom(-5.79, () => {}, () => { const on = lit(false); ls.on = on; p.emissive = on ? 0.9 : undefined; }));
  }

  // ------------------------------------------------------------------ the stalls: fish, fruit, woven goods
  const st0 = X.stalls;
  const stalls: [Q.StallKind, number][] = [['fish', st0], ['fruit', st0 + 78], ['woven', st0 + 156]];
  stalls.forEach(([k, x], i) => {
    put(`stall:${k}`, () => Q.stall(k, i + 1), x, -4.5 + i * 0.1, { dy: 2 });
    const hy = g(x) + 2 - 58;
    const hangs: [('bananas' | 'eel' | 'kete'), number][] = k === 'fish' ? [['eel', -30], ['eel', -22]] : k === 'fruit' ? [['bananas', -30], ['bananas', 6]] : [['kete', -32], ['kete', -14], ['kete', 4]];
    hangs.forEach(([h, dx], j) => put(`hang:${h}:${j}`, () => Q.hanging(h, j + i), x + dx, -4.45 + i * 0.1, { y: hy + (j % 2), sway: 0.8, foliage: false, hang: true }));
  });
  put('stallBucket', () => K.bucket(3), st0 + 40, -1.15, { dy: 2 });
  put('stallRope', () => K.ropeCoil(5), st0 + 84, -1.2, { dy: 2 });
  put('stallCart', () => K.kidsThing('cart', 2), st0 + 132, -1.1, { dy: 2 });

  // ------------------------------------------------------------------ the trading store
  const tx = X.tradeStore;
  house('trade', () => Q.tradeStore(1), tx, -6, { dy: 2, late: false });
  put('bike', () => Q.bicycle(1), tx - 46, -2, { dy: 2 });
  put('sacks', () => Q.sacks(1), tx + 36, -1.8, { dy: 2 });
  put('kero', () => Q.kerosene(1), tx + 80, -2.2, { dy: 2 });

  // ------------------------------------------------------------------ the gum-digger: his vine and his hut
  const hx = Math.min(X.gumHut, X.dealer[0] - 90);
  const px = hx - 66;
  put('pergola', () => Q.pergola(1), px, -5.5, { dy: 2 });
  put('vine', () => Q.vineCanopy(1), px, -5.45, { y: g(px) + 2 - 61, sway: 0.5, foliage: false, hang: true });
  house('gumHut', () => Q.gumHut(1), hx, -6, { dy: 2, r: 60 });
  put('gumBarrels', () => K.barrelGroup(5), hx - 16, -2, { dy: 2 });
  smoke(hx - 52, g(hx) - 80, 0.8);

  // ------------------------------------------------------------------ flax torches along the lane after dark
  if (c.night || c.tod === 'dusk') for (const x of [fx + 92, sx + 106, st0 + 116, tx + 104]) {
    put('torch', torch, x, -0.5, { dy: 2 });
    const y = g(x) - 33;
    main.add(new AnimProp(propAnims.flame, x, y, -0.4, 11, { emissive: 1, sx: 0.5, sy: 0.6 }));
    main.add(new LightSource(x, y - 6, 70, [1, 0.62, 0.3], 0.5, -0.3, A.glow, 0.18, 0.2, 0.06));
    f.lights.push({ x, y, r: 80, k: 0.5 });
  }

  // ------------------------------------------------------------------ the lane's ground: puddles, tufts
  for (const [x, w, s] of [[fx - 30, 22, 1], [sx + 60, 30, 2], [st0 + 112, 18, 3], [tx + 10, 26, 4], [hx + 50, 20, 5]] as [number, number, number][]) put(`puddle:${s}`, () => K.puddle(w, s + 10), x, -9.4, { dy: 1 });
  tufts(fx + 150, fx + 170, 63); tufts(hx + 70, hx + 84, 66);

  // ------------------------------------------------------------------ the old village, lived in
  // the river landing: an old hull upturned on blocks behind the racks, the net heap, a rope coil on the jetty
  put('hull', () => K.wakaHull(1), 352, -3.6, { dy: 2 });
  put('netHeap', () => K.netHeap(1), 330, -2.9, { dy: 2 });
  put('jettyRope', () => K.ropeCoil(1), 150, -1.7, { y: 284 - 1 });
  put('rackBucket', () => K.bucket(1), X.smokeRack + 26, -1.15, { dy: 2 });
  // the gardens: a wheelbarrow of weeds, tools on the fence, a bucket at the pen
  put('barrow', () => K.wheelbarrow(3), X.garden[0] + 40, -2.3, { dy: 2 });
  put('fenceTools', () => K.tools(1), X.garden[0] + 2, -4.8, { dy: 2 });
  put('penBucket', () => K.bucket(4), X.pen[0] - 10, -1.2, { dy: 2 });
  put('penPuddle', () => K.puddle(26, 3), X.pen[0] + 60, -9.4, { dy: 1 });
  // the weaving: a mat half-plaited on its frame (the strands swing), kete piled up
  put('matFrame', () => K.matFrame(1), X.shelter - 6, -4.2, { dy: 2 });
  put('matStrands', () => K.matStrands(1), X.shelter - 6, -4.15, { y: g(X.shelter - 6) + 2 - 43 + 5 + 16, sway: 0.7, foliage: false, hang: true });
  put('shelterKete', () => K.ketePile(1), X.shelter + 40, -1.3, { dy: 2 });
  // the cooking: a water barrel, a bucket, crates of kūmara behind the bench
  put('cookBarrel', () => K.barrel(15, 22, 3), X.hangi - 26, -3, { dy: 2 });
  put('cookBucket', () => K.bucket(2), X.hangi + 24, -1.3, { dy: 2 });
  put('cookCrates', () => K.crateStack(1, ['kumara', 'potato']), X.foodBench - 20, -2.6, { dy: 2 });
  put('cookPuddle', () => K.puddle(16, 5), X.cookFire + 30, -9.4, { dy: 1 });
  // the carving shed: a heap under a tarp in its back corner, firewood stacked by the house
  put('shedTarp', () => K.tarpHeap(1, 40), X.shed - 46, -5.2, { dy: 2 });
  put('shedWood', () => K.firewood(2), X.shed + 78, -4.6, { dy: 2 });
  put('shedBarrels', () => K.barrelGroup(1), X.shed + 62, -2.7, { dy: 2 });
  // the houses: a ladder up to the roof, the kids' cart and a tyre, firewood, a line of washing by the pātaka
  put('wLadder', () => K.ladder(64, 1), X.whare1 - 66, -5.8, { dy: 2 });
  put('kidCart', () => K.kidsThing('cart', 1), X.whare1 - 44, -1.2, { dy: 2 });
  put('tyre', () => K.kidsThing('tyre', 1), X.whare2 + 48, -1.25, { dy: 2 });
  put('w3Wood', () => K.firewood(3), X.whare3 - 76, -5.2, { dy: 2 });
  put('w2Tools', () => K.tools(3), X.whare2 + 58, -5.8, { dy: 2 });
  put('cricket', () => K.kidsThing('cricket', 1), X.whare3 + 70, -1.1, { dy: 2 });
  put('patakaKete', () => K.ketePile(3), X.pataka + 30, -1.4, { dy: 2 });
  washing('pataka', X.pataka + 16, { w: 84, hL: 52, hR: 50, sag: 6, posts: [true, true], prop: 44, seed: 31 }, 'mixed', [2, 3, 5, 7, 8, 9], -5.6);
  washing('w12', X.whare1 + 54, { w: 46, hL: 50, hR: 52, sag: 4, posts: [false, false], seed: 32 }, 'kids', [1, 2, 3], -5.55, { y: g(X.whare1 + 54) + 2 });
  // washing strung eave to eave between the second and third houses, over Hana's bench
  washing('w23', X.whare2 + 61, { w: 54, hL: 50, hR: 47, sag: 5, posts: [false, false], seed: 33 }, 'mixed', [10, 11, 12, 13], -5.55, { y: g(X.whare2 + 61) + 2 });
  put('w2Bucket', () => K.bucket(5), X.whare2 - 52, -1.3, { dy: 2 });
  put('w3Crates', () => K.crateStack(6, ['kumara', null]), X.pataka - 48, -4.6, { dy: 2 });
  put('w1Tarp', () => K.tarpHeap(3, 36), X.whare1 + 58, -5.7, { dy: 2 });
  put('carveRope', () => K.ropeCoil(2), X.wakaBuild - 52, -2.1, { dy: 2 });
  for (const [x, w, s] of [[X.whare1 + 20, 18, 6], [X.whare3 + 40, 24, 7], [X.goats[1] + 20, 20, 8], [X.wakaBuild + 70, 14, 9]] as [number, number, number][]) put(`oldPuddle:${s}`, () => K.puddle(w, s + 20), x, -9.4, { dy: 1 });
}

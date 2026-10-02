// V10 the Far Coast, reached by boat: grey shingle at the landing, a river running out across the
// beach (a Snakestork fishing the shallows, kelp holdfasts washed up on the bars, the kelp beds
// lying on the swell offshore), a wave-cut platform under tall layered sea cliffs with rock pools,
// auks on the ledges and a waterfall dropping straight off the cliff top (a Torrent Dipper in the
// plunge pool), then a track up into the coastal forest to a lookout. Home is the Kitten.

import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { Custom, Prop } from '../../world/props';
import { hash2, rand } from '../../core/math';
import * as Co from '../../art/v10/coast10';
import { deadwood } from '../../art/jungle-plants';
import { tree } from '../../art/jungle-trees';
import { sprite, trees, undergrowth, frontFoliage } from '../sites2/common';
import { LandingScene, LandingCfg } from './landing';

const { FC } = Co;
const g = Co.groundCoast;

const CFG: LandingCfg = {
  loc: 'farcoast', name: 'The Far Coast', sub: 'Te Tai Tawhiti', label: 'The Far Coast',
  W: FC.W, GY: FC.GY, BOT: FC.BOT, seaX: FC.SEA_X, water: FC.WATER,
  ground: g, paint: Co.paintCoastGround,
  boatX: 96, spawnX: 290,
  music: 'explore',
  spawns: [
    { species: 'snakestork', n: [1, 2], x: [590, 790], poi: 'shallows', times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'torrentdipper', n: [1, 2], x: [1230, 1370], poi: 'rock', times: ['dawn', 'day'], chance: 1 },
    { species: 'cragauk', n: [4, 7], x: [860, 1560], poi: 'nest', herd: true, juveniles: 0.25, times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'galehawk', n: [1, 1], x: [400, 2300], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.6 },
    { species: 'strider', n: [1, 2], x: [1700, 2400], times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'barkgecko', n: [1, 3], x: [1650, 2300], poi: 'trunk', medium: 'trunk', times: ['dawn', 'day', 'dusk'], chance: 0.9 },
    { species: 'flicker', n: [1, 1], x: [1700, 2400], times: ['dawn', 'day', 'dusk'], chance: 0.6 },
  ],
  insects: [
    { kind: 'dragonfly', x: [580, 800], y: [220, 252], n: 4, times: ['day', 'dusk'] },
    { kind: 'butterfly', x: [1650, 2450], y: [90, 200], n: 5, times: ['day', 'dawn'] },
    { kind: 'bee', x: [1650, 2400], y: [120, 210], n: 4, times: ['day'] },
  ],
  place: x => {
    if (x > FC.LOOK - 90) return 'Clifftop lookout';
    const z = Co.coastZone(x);
    return z === 'cove' || z === 'shingle' ? 'Shingle landing' : z === 'river' ? 'The river mouth' : z === 'platform' ? (Math.abs(x - 1300) < 120 ? 'The sea waterfall' : 'Under the sea cliffs') : 'The coast track';
  },
  first: [
    { who: 'mori', text: 'Look at those cliffs. And a river! Fresh water, running straight into the sea.', expr: 'excited', emote: 'sparkle' },
    { who: 'aroha', text: 'Te Tai Tawhiti, the far coast. The river comes down from the mountains. Nobody has walked up it in a hundred years.', expr: 'serious' },
    { who: 'joshu', text: 'I’ll stay with the boat. Mind the tide on that rock shelf; it comes in faster than you think.', expr: 'serious' },
  ],
  again: [{ who: 'mori', text: 'The far coast again. I can hear the waterfall from here.', expr: 'happy' }],
};

export class FarCoastScene extends LandingScene {
  private mistT = 0;

  constructor(clockT: number) { super(CFG, clockT); }

  protected dress() {
    const st = this.st, r = game.r, main = this.main;
    const G = { y: g };
    // ---- the forest behind the track (back layer) and the sea cliff behind the platform
    trees(this, this.L.back, FC.FOREST[0] - 40, FC.W + 200, [46, 84], ['rata', 'broadleaf', 'treefern', 'nikau'], { y: x => g(x) + 10 }, 71, { variants: 3, tint: packColor(0.8, 0.86, 0.84, 1) });
    const cl = Co.paintSeaCliff();
    const clF = bigFrame(r, cl.buf);
    main.add(new Custom(-8, rr => rr.draw(clF, cl.x, cl.y)));
    for (const [ly, x0, x1] of Co.CLEDGES) {
      st.terrain.addPlatform([[x0, ly - 1], [x1, ly - 1]], 'rock' as never);
      for (let x = x0 + 14; x < x1 - 6; x += 40) this.pois.push({ kind: 'nest', x, y: ly - 1 });
    }
    this.pois.push({ kind: 'perch', x: 1000, y: 56 }, { kind: 'perch', x: 1480, y: 50 });
    // ---- the waterfall off the cliff top into the plunge pool
    const [f0, f1] = FC.FALL, fTop = cl.y + 30, fBot = g(1300) + 1;
    main.add(new Custom(-6, (rr, s) => {
      if (rr.visibleX1(10) < f0 || rr.visibleX0(10) > f1) return;
      for (let x = f0; x < f1; x++) {
        const edge = Math.min(x - f0, f1 - 1 - x);
        for (let y = fTop; y < fBot; y += 4) {
          const v = (y - fTop + s.time * 140 + hash2(x, 0, 3) * 60) % 26;
          const a = edge < 2 ? 0.55 : 0.9;
          rr.rect(x, y, 1, 4, v < 15 ? packColor(0.92, 0.97, 1, a) : packColor(0.62, 0.8, 0.88, a * 0.9));
        }
      }
      for (let i = 0; i < 5; i++) rr.fxDraw(A.soft, f0 - 8 + i * 9, fBot - 4 + Math.sin(s.time * 3 + i) * 2, 1.6, 0.9, 0, packColor(0.92, 0.97, 1, 1), 0.5);
      rr.light((f0 + f1) / 2, fBot - 20, 120, 0.85, 0.95, 1, 0.4);
    }));
    // ---- the river across the beach
    const [r0, r1] = FC.RIVER, ry = FC.RIVER_Y;
    st.terrain.water.push([r0, r1, ry, ry + 40]);
    main.add(new Custom(24, (rr, s) => {
      if (rr.visibleX1(10) < r0 || rr.visibleX0(10) > r1) return;
      rr.water(0.75, 1.1, 0.8);
      for (let x = r0; x < r1; x += 4) {
        const depth = g(x + 2) - ry;
        if (depth <= 0) continue;
        rr.rect(x, ry, 4, depth + 8, packColor(0.2, 0.3, 0.3, 0.72));
      }
      rr.water(0);
      // ripples running down to the sea
      for (let i = 0; i < 9; i++) {
        const gx = r1 - ((i * 37 + s.time * 22) % (r1 - r0)), gy = ry + 1 + (i % 3);
        if (g(gx) - ry > 1) rr.fxDraw(A.dot2, gx, gy, 2.2, 0.4, 0, packColor(1, 1, 0.95, 1), 0.45);
      }
    }));
    for (const x of [620, 690, 750]) this.pois.push({ kind: 'shallows', x, y: ry + 2, w: 30 });
    this.pois.push({ kind: 'mud', x: 600, y: g(600) }, { kind: 'bank', x: 800, y: g(800) });
    // ---- kelp lying on the swell beyond the river mouth (near sea band)
    const kp = this.L.near.p, ky = this.ly(kp, 199);
    const rafts = [0, 1, 2].map(i => bigFrame(r, Co.kelpRaft(70 + i * 24, 5 + i)));
    this.L.near.add(new Custom(6, (rr, s) => {
      rafts.forEach((fr, i) => rr.draw(fr, (420 + i * 150) * kp, ky + Math.sin(s.time * 0.8 + i * 1.7) * 1.2 + i * 2, 1, 1, 0, packColor(0.85, 0.85, 0.8, 1)));
    }));
    // ---- the platform's rocks and the plunge pool
    for (const x of [1248, 1352, 1100, 1470]) {
      const c = sprite(`fcrock:${x % 3}`, () => deadwood('rock', 70 + (x % 3), 26 + (x % 3) * 6));
      if (c) main.add(new Prop(c.f, x, g(x) + 3, 3));
      this.pois.push({ kind: 'rock', x, y: g(x) - 8 });
    }
    for (const [a, b] of Co.ROCKPOOLS) main.add(new Custom(6, (rr, s) => {
      for (let i = 0; i < 2; i++) rr.fxDraw(A.dot2, a + 6 + ((i * 17 + s.time * 2) % (b - a - 10)), g(a) + 2, 1.2, 0.4, 0, packColor(1, 1, 0.95, 1), 0.5 * Math.max(0, Math.sin(s.time * 2.2 + i + a)));
    }));
    // ---- driftwood and flax on the shingle
    for (const [x, k] of [[250, 'log'], [520, 'branch'], [860, 'log']] as const) {
      const c = sprite(`fcdw:${k}:${x}`, () => deadwood(k, x, 40));
      if (c) main.add(new Prop(c.f, x, g(x) + 3, 2));
    }
    // ---- the forest on the track: trunks the geckos climb, the undergrowth, foliage up close
    for (const [x, kind, h] of [[1700, 'rata', 170], [1990, 'broadleaf', 150], [2210, 'kauri', 220], [2440, 'rata', 160]] as const) {
      const c = sprite(`fct:${kind}:${x}`, () => tree(kind, x, h));
      if (c) main.add(new Prop(c.f, x, g(x) + 3, -6, { sway: 0.25 }));
      this.pois.push({ kind: 'trunk', x, y: g(x), y1: g(x) - h * 0.8 }, { kind: 'branch', x: x + 18, y: g(x) - h * 0.6 }, { kind: 'perch', x, y: g(x) - h - 4 });
    }
    undergrowth(this, main, FC.FOREST[0], FC.W, 1.1, G, 81, { plants: ['flax', 'fern', 'kidneyfern', 'astelia', 'grass', 'kawakawa', 'crownfern'], wood: ['log', 'litter', 'roots'] });
    undergrowth(this, main, 200, 560, 0.35, G, 82, { plants: ['flax', 'grass', 'sedge'] });
    frontFoliage(this, FC.FOREST[0] + 60, FC.W, [200, 320], ['fronds', 'flax', 'leaves'], this.L.front.p, FC.GY + 104, 91);
    // ---- things to gather
    const hold = (seed: number) => { const o = Co.holdfastSprite(seed); return bigFrame(r, o.buf, o.ax, o.ay); };
    this.harvest({ key: 'drift1', x: 310, item: 'wood', n: 2, label: 'Gather driftwood', anim: 'grab', line: 'Silver driftwood, worn smooth. Some of it must have come from the mountains.' });
    this.harvest({ key: 'drift2', x: 470, item: 'wood', n: 2, label: 'Gather driftwood', anim: 'grab' });
    this.harvest({ key: 'kelp1', x: 612, item: 'v10_kelpholdfast', n: 1, label: 'Pick up the kelp holdfast', art: hold(1), line: 'A kelp holdfast. It’s full of tiny crabs and brittle stars... a whole city in my hand.' });
    this.harvest({ key: 'kelp2', x: 772, item: 'v10_kelpholdfast', n: 1, label: 'Pick up the kelp holdfast', art: hold(2) });
    this.harvest({ key: 'flax1', x: 1690, item: 'flaxleaf', n: 2, label: 'Cut harakeke', tool: 'knife', anim: 'grab' });
    this.harvest({ key: 'flax2', x: 2060, item: 'flaxleaf', n: 2, label: 'Cut harakeke', tool: 'knife', anim: 'grab' });
    this.harvest({ key: 'gum', x: 2228, item: 'resin', n: 1, label: 'Collect kauri gum', tool: 'knife', line: 'Kauri gum, out here too. The old trees are everywhere once you look.' });
    // ---- places to find
    this.landmark('mouth', 690, 'The river mouth', 'ecosystem', ['aroha', 'Where the river meets the sea, everything comes to eat. Fresh water on top, salt underneath.', 'serious']);
    this.landmark('falls', 1300, 'The sea waterfall', 'landmark', ['mori', 'A waterfall straight off a cliff into the sea. I didn’t know the world did that.', 'surprised']);
    this.landmark('lookout', FC.LOOK, 'The clifftop lookout', 'landmark', ['aroha', 'There. See the line of the river going inland? One day, Mori. One day we walk it.', 'happy']);
  }

  protected tick(dt: number) {
    // spray drifting off the foot of the falls
    this.mistT -= dt;
    if (this.mistT <= 0) {
      this.mistT = 0.1;
      if (Math.abs(this.st.cam.x - 1300) < 500) {
        const [f0, f1] = FC.FALL;
        this.main.particles.spawn({ frame: A.soft, x: rand.range(f0 - 6, f1 + 6), y: g(1300) - 4, vx: rand.range(-14, 14) + this.st.wind * 6, vy: rand.range(-22, -8), life: rand.range(1.4, 2.4), size: 0.4, size1: rand.range(1.2, 1.8), color: [0.94, 0.98, 1], alpha: 0.42, alpha1: 0, fadeIn: 0.1, drag: 0.4 });
      }
    }
  }

  protected arohaLines(x: number): [string, string][] {
    const z = Co.coastZone(x);
    if (z === 'cove' || z === 'shingle') return [['Grey stones, not sand. This coast is all rivers and mountains.', 'neutral'], ['My koro said this coast belonged to the wind. Listen to it.', 'serious']];
    if (z === 'river') return [['Walk where it’s shallow. A river mouth can pull your feet out from under you.', 'worried'], ['The kelp washes up after a southerly. The crabs come with it.', 'neutral']];
    if (z === 'platform') return [['The sea cut this shelf flat. Watch the pools: everything hides in them when the tide goes out.', 'serious'], ['Kia tūpato on the weed. It’s slippery as eels.', 'teasing']];
    return [['Pōhutukawa and kauri together. This forest is old, Mori. Older than any of us.', 'serious'], ['Shh. Listen... tūī. Or something that sounds like one.', 'happy']];
  }
}

/** land on the far coast (from the boat trip) */
export async function goFarCoast(clockT: number) {
  game.go(() => new FarCoastScene(clockT), [0.02, 0.03, 0.04], 1.2);
}

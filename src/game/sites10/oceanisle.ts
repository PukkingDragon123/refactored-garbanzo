// V10 Motu Ahi: the smoking islet, reached by boat. Black sand at the landing cove, a boulder beach
// of basalt and obsidian, the auk colony screaming on the ledges of a columnar-basalt cliff (Crag
// Auks nesting, fishing in the cove; a Crag Viper raiding; a Gale Hawk overhead), a steaming
// fumarole terrace with sulphur crusts and hot pools, and the rim trail up to the crater lake with
// the young cone smoking behind it. Pumice, obsidian, sulphur and colony down to gather; the colony,
// the fumaroles and the crater lake to find for the Region Map. Home is the Kitten (sailHome).

import { packColor } from '../../gfx/renderer';
import { bigFrame } from '../../gfx/atlas';
import { game } from '../game';
import { A } from '../assets';
import { Custom } from '../../world/props';
import { rand } from '../../core/math';
import * as I from '../../art/v10/isle10';
import { LandingScene, LandingCfg } from './landing';

const { MA } = I;

const CFG: LandingCfg = {
  loc: 'motuahi', name: 'Motu Ahi', sub: 'The smoking islet', label: 'Motu Ahi',
  W: MA.W, GY: MA.GY, BOT: MA.BOT, seaX: MA.SEA_X, water: MA.WATER,
  ground: I.groundIsle, paint: I.paintIsleGround,
  boatX: 96, spawnX: 290,
  music: 'wonder',
  spawns: [
    { species: 'cragauk', n: [10, 14], x: [860, 1380], poi: 'nest', herd: true, juveniles: 0.3, times: ['dawn', 'day', 'dusk'], chance: 1 },
    { species: 'cragviper', n: [1, 2], x: [880, 1340], poi: 'nest', times: ['day', 'dusk'], chance: 0.8 },
    { species: 'galehawk', n: [1, 1], x: [500, 2400], medium: 'air', times: ['dawn', 'day', 'dusk'], chance: 0.8 },
    { species: 'monarch', n: [1, 1], x: [1400, 2500], medium: 'air', times: ['dawn', 'day'], chance: 0.45 },
  ],
  insects: [
    { kind: 'butterfly', x: [2050, 2600], y: [60, 150], n: 4, times: ['day', 'dawn'] },
    { kind: 'dragonfly', x: [1600, 1950], y: [190, 222], n: 3, times: ['day', 'dusk'] },
  ],
  place: x => {
    if (x > MA.LOOK - 90) return 'Crater lookout';
    const z = I.isleZone(x);
    return z === 'cove' || z === 'beach' ? 'Black sand landing' : z === 'boulders' ? 'Obsidian beach' : z === 'colony' ? 'The auk colony' : z === 'vents' ? 'Fumarole terrace' : 'The rim trail';
  },
  first: [
    { who: 'mori', text: 'Listen to that! The whole cliff is SCREAMING. There must be ten thousand birds up there!', expr: 'excited', emote: 'sparkle' },
    { who: 'aroha', text: 'Motu Ahi. My nan’s nan came here for the birds, in a waka with no motor and no Jenna.', expr: 'serious' },
    { who: 'joshu', text: 'I’ll mind the Kitten. Back before dark, and watch your feet near the steam. Ground like that can be thin.', expr: 'serious' },
  ],
  again: [{ who: 'mori', text: 'Back on Motu Ahi. Hello, birds. Please don’t poo on the camera.', expr: 'happy' }],
};

export class MotuAhiScene extends LandingScene {
  private birds: { x: number; y: number; ph: number; k: number }[] = [];
  private fliers: { cx: number; cy: number; rx: number; ry: number; ph: number; v: number }[] = [];
  private plumeT = 0;
  private ventT = 0;
  private coneLayer: import('../../world/stage').Layer | null = null;
  private peak: [number, number] = [0, 0];

  constructor(clockT: number) { super(CFG, clockT); }

  protected dress() {
    const st = this.st, r = game.r, main = this.main, g = I.groundIsle;
    // ---- the young cone, smoking, behind the terrace and the rim (its own parallax layer)
    const CP = 0.6, CW = 900, CH = 220;
    const cone = st.addLayer('cone', CP, 0.18, 0.5, 0, CP);
    const coneF = bigFrame(r, I.paintCone(CW, CH));
    const cx = 2060 * CP - CW / 2, cy = 228 - CH;
    cone.add(new Custom(0, rr => rr.draw(coneF, cx, cy)));
    this.coneLayer = cone;
    this.peak = [cx + CW * 0.57, cy + 10];
    // (move the cone behind the back layer, in front of the sea)
    const ls = st.layers, i = ls.indexOf(cone), j = ls.indexOf(this.L.back);
    if (i > j && j >= 0) { ls.splice(i, 1); ls.splice(j, 0, cone); }
    // ---- the colony cliff: a wall of basalt columns behind the walk line, ledges streaked white
    const cl = I.paintColonyCliff();
    const clF = bigFrame(r, cl.buf);
    main.add(new Custom(-8, rr => rr.draw(clF, cl.x, cl.y)));
    for (const [ly, x0, x1] of I.LEDGES) {
      st.terrain.addPlatform([[x0, ly - 1], [x1, ly - 1]], 'rock' as never);
      for (let x = x0 + 12; x < x1 - 6; x += 38) this.pois.push({ kind: 'nest', x, y: ly - 1 });
      // the background colony: hundreds of auks shoulder to shoulder on every ledge
      for (let x = x0 + 3; x < x1 - 3; x += 4 + rand.int(0, 3)) if (rand.chance(0.7)) this.birds.push({ x, y: ly - 1, ph: rand.next() * 10, k: rand.range(0.5, 1.5) });
    }
    this.pois.push({ kind: 'perch', x: 1010, y: 64 }, { kind: 'perch', x: 1260, y: 52 }, { kind: 'perch', x: 2470, y: 110 });
    for (let i = 0; i < 26; i++) this.fliers.push({ cx: rand.range(860, 1400), cy: rand.range(40, 150), rx: rand.range(30, 120), ry: rand.range(10, 40), ph: rand.next() * 6.28, v: rand.range(0.4, 0.9) * (rand.chance(0.5) ? 1 : -1) });
    const b0 = local(this, 'cb0', () => ({ buf: I.colonyBird(0), ax: 2, ay: 4 })), b1 = local(this, 'cb1', () => ({ buf: I.colonyBird(1), ax: 2, ay: 4 }));
    main.add(new Custom(-7, (rr, s) => {
      if (rr.visibleX1(10) < 820 || rr.visibleX0(10) > 1440) return;
      const night = this.clock.night;
      for (const b of this.birds) {
        const flap = Math.sin(s.time * b.k * 1.3 + b.ph) > 0.93;
        rr.draw(flap ? b1 : b0, b.x, b.y, 1, 1, 0, night > 0.5 ? packColor(0.6, 0.6, 0.7, 1) : 0xffffffff);
      }
      // auks wheeling off the cliff
      for (const f of this.fliers) {
        const a = f.ph + s.time * f.v;
        rr.draw(Math.sin(s.time * 9 + f.ph) > 0 ? b1 : b0, f.cx + Math.cos(a) * f.rx, f.cy + Math.sin(a) * f.ry);
      }
    }));
    // ---- boulders on the obsidian beach, a few big ones in front of the camera
    for (let i = 0; i < 9; i++) {
      const x = 570 + i * 32 + rand.range(-8, 8);
      const f = local(this, 'bd' + (i % 4), () => I.findSprite('boulder', i % 4 + 1));
      main.add(new Custom(4 + (i % 3), rr => rr.draw(f, x, g(x) + 3 + (i % 3) * 2)));
    }
    for (const [wx, seed] of [[640, 2], [1180, 3], [1760, 1], [2240, 2]] as const) {
      const f = local(this, 'fb' + seed, () => I.findSprite('boulder', seed));
      this.L.front.add(new Custom(0, rr => rr.draw(f, wx * 1.25, 372, 2.4, 2.4, 0, packColor(0.32, 0.32, 0.38, 1))));
    }
    // ---- fumaroles and hot pools on the terrace
    I.VENT_XS.forEach((vx, i) => {
      const f = local(this, 'vent' + i, () => I.ventSprite(5 + i));
      main.add(new Custom(8, rr => { rr.draw(f, vx, g(vx) + 3); rr.light(vx, g(vx) - 10, 46, 1, 0.8, 0.5, 0.25 + this.clock.night * 0.4); }));
    });
    // the hot pools are painted into the ground: glints on them here
    for (const [a, b] of I.POOLS) {
      main.add(new Custom(6, (rr, s) => {
        const y = g((a + b) / 2) + 1;
        for (let i = 0; i < 3; i++) rr.fxDraw(A.dot2, a + 6 + ((i * 13 + s.time * 3) % (b - a - 10)), y + 1, 1.2, 0.4, 0, packColor(1, 1, 0.9, 1), 0.5 * Math.max(0, Math.sin(s.time * 2 + i)));
      }));
    }
    // ---- the crater lake beyond the rim at the lookout
    const crW = 340, crH = 110;
    const cr = bigFrame(r, I.paintCrater(crW, crH));
    // (behind the ground: the near rim cuts off its foot)
    main.add(new Custom(-11, rr => { if (rr.visibleX1(0) > MA.LOOK - crW) rr.draw(cr, MA.LOOK - crW / 2 + 60, g(MA.LOOK) - crH + 22); }));
    // ---- things to gather
    const fs = (k: 'pumice' | 'obsidian' | 'sulphur' | 'down', seed: number) => local(this, k + seed, () => I.findSprite(k, seed));
    this.harvest({ key: 'pumice1', x: 360, item: 'v10_pumice', n: 2, label: 'Pick up the pumice', art: fs('pumice', 1), line: 'Pumice! It’s so light. Rock full of bubbles... it actually floats.' });
    this.harvest({ key: 'pumice2', x: 505, item: 'v10_pumice', n: 1, label: 'Pick up the pumice', art: fs('pumice', 2) });
    this.harvest({ key: 'drift', x: 430, item: 'wood', n: 2, label: 'Gather driftwood', anim: 'grab', line: 'Driftwood, bleached like bone. Joshu will want this.' });
    this.harvest({ key: 'obs1', x: 690, item: 'v10_obsidian', n: 1, label: 'Prise out the obsidian', art: fs('obsidian', 1), anim: 'kneel', dur: 1.6, line: 'Volcanic glass. Look at that edge: sharper than a scalpel.' });
    this.harvest({ key: 'obs2', x: 795, item: 'v10_obsidian', n: 1, label: 'Prise out the obsidian', art: fs('obsidian', 2), anim: 'kneel', dur: 1.6 });
    this.harvest({ key: 'down1', x: 960, item: 'v10_down', n: 1, label: 'Gather moulted down', art: fs('down', 1), line: 'Moulted down from the ledges. Softest thing on the island.' });
    this.harvest({ key: 'down2', x: 1165, item: 'v10_down', n: 1, label: 'Gather moulted down', art: fs('down', 2) });
    this.harvest({ key: 'down3', x: 1330, item: 'v10_down', n: 1, label: 'Gather moulted down', art: fs('down', 3) });
    this.harvest({ key: 'sulf1', x: 1530, item: 'v10_sulphur', n: 1, label: 'Scrape off the sulphur crust', art: fs('sulphur', 1), tool: 'knife', dur: 1.5, line: 'Pure sulphur crystals. And the smell... a thousand rotten eggs.' });
    this.harvest({ key: 'sulf2', x: 1745, item: 'v10_sulphur', n: 1, label: 'Scrape off the sulphur crust', art: fs('sulphur', 2), tool: 'knife', dur: 1.5 });
    // ---- places to find
    this.landmark('colony', 1100, 'The auk colony of Motu Ahi', 'ecosystem', ['aroha', 'Every ledge, every crack. Nan said the birds come back to the same hand-width of rock every year.', 'serious']);
    this.landmark('vents', 1660, 'The fumarole terrace', 'ecosystem', ['mori', 'The ground is warm through my boots. The island is breathing.', 'surprised']);
    this.landmark('lookout', MA.LOOK, 'The crater lake of Motu Ahi', 'landmark', ['mori', 'A lake in the volcano. That colour isn’t even real. And look: home, way out there.', 'excited']);
  }

  protected tick(dt: number) {
    // the summit plume
    this.plumeT -= dt;
    const cone = this.coneLayer;
    if (cone && this.plumeT <= 0) {
      this.plumeT = 0.22;
      const [px, py] = this.peak;
      cone.particles.spawn({ frame: A.soft, x: px + rand.range(-6, 6), y: py, vx: rand.range(2, 6) + this.st.wind * 4, vy: rand.range(-12, -7), life: rand.range(7, 11), size: rand.range(0.7, 1.1), size1: rand.range(3, 4.4), color: [0.86, 0.86, 0.84], alpha: 0.42, alpha1: 0, fadeIn: 0.15, drag: 0.05 });
    }
    // fumarole steam (and from the hot pools)
    this.ventT -= dt;
    if (this.ventT <= 0) {
      this.ventT = 0.12;
      const vx = rand.pick(I.VENT_XS), x0 = this.st.cam.x;
      if (Math.abs(vx - x0) < 500) {
        const y = I.groundIsle(vx) - 4;
        this.main.particles.spawn({ frame: A.soft, x: vx + rand.range(-3, 3), y, vx: rand.range(-3, 3) + this.st.wind * 6, vy: rand.range(-26, -16), life: rand.range(2.2, 3.4), size: 0.3, size1: rand.range(1.2, 1.8), color: [0.95, 0.95, 0.92], alpha: 0.5, alpha1: 0, fadeIn: 0.1, drag: 0.3 });
      }
      const [a, b] = rand.pick(I.POOLS);
      if (rand.chance(0.35) && Math.abs(a - x0) < 500) this.main.particles.spawn({ frame: A.soft, x: rand.range(a, b), y: I.groundIsle(a) - 1, vx: this.st.wind * 4, vy: rand.range(-10, -6), life: 2.4, size: 0.25, size1: 0.9, color: [0.95, 0.97, 0.95], alpha: 0.32, alpha1: 0, fadeIn: 0.2 });
    }
    // standing in the steam: warm, wet, smelly
    const p = this.player;
    const near = I.VENT_XS.some(v => Math.abs(v - p.x) < 16);
    if (near && rand.chance(dt * 0.15) && !game.ui.bubbles.active) this.bark('mori', rand.pick(['Hot! Hot hot hot.', 'Ugh, my glasses are fogging up.', 'That smell is getting into my socks.']), { expr: 'grumpy' });
  }

  protected arohaLines(x: number): [string, string][] {
    const z = I.isleZone(x);
    if (z === 'cove' || z === 'beach') return [['The sand is black because the island is young. Not so long ago it was fire.', 'serious'], ['Pumice floats. Sometimes it drifts all the way to our beach, and the kids think it’s magic.', 'happy']];
    if (z === 'boulders') return [['Mataa: obsidian. My tūpuna traded it from island to island. Sharp enough to shave with.', 'serious']];
    if (z === 'colony') return [['Kia tūpato. Slowly, near the colony, or they all go up at once.', 'serious'], ['See all the white on the rocks? Years and years and years of birds.', 'teasing'], ['Watch the cracks between the ledges. Something long and patient hunts the eggs here.', 'worried']];
    if (z === 'vents') return [['Don’t step on the yellow crust. The ground is thin there, and hot underneath.', 'worried'], ['Rotten eggs: that is the sulphur. My nan used it on sore skin.', 'neutral']];
    return [['From the top you can see home. Just.', 'happy'], ['Rūaumoko is sleeping under here. Lightly.', 'serious']];
  }
}

const frames = new WeakMap<object, Map<string, import('../../gfx/renderer').Frame>>();
/** a cached frame for this scene */
function local(s: object, key: string, gen: () => { buf: import('../../art/pixel').PixelBuffer; ax: number; ay: number }) {
  let m = frames.get(s);
  if (!m) frames.set(s, (m = new Map()));
  let f = m.get(key);
  if (!f) { const o = gen(); f = bigFrame(game.r, o.buf, o.ax, o.ay); m.set(key, f); }
  return f;
}

/** land on Motu Ahi (from the boat trip) */
export async function goMotuAhi(clockT: number) {
  game.go(() => new MotuAhiScene(clockT), [0.02, 0.03, 0.04], 1.2);
}

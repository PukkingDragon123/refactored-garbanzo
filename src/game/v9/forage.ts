// V9 island foraging: collectibles and harvestables placed all along the shoreline. Half-buried shells
// and sea glass on the sand, kelp and sand hoppers on the wrack line, feathers, flint in the stream
// bed, clay in its banks, dig spots with breathing holes (pipi and tiger cones), opal ears in the rock
// pools (the Trycop moult on the seal rocks is the wildlife module's), shore plants (sea holly, salt fern, glow moss, dune lilies),
// berry bushes (duskberries, goldcurrants), jewel beetles on flowers, lantern moths at dusk, and the
// survival haul Joshu teaches on the walk back (driftwood, flax, kawakawa, mussels, pipi, a good stone).
//
// Each spot glints now and then, needs the right tool (a friendly bark if you don't have it), plays a
// pickup (crouch / kneel / dig / jar / net swing) with sound and particles, gives a "+1 <icon> item"
// toast and respawns after a few minutes of play. Survival finds also count for the v4return quest
// (vars v4:wood / v4:plants / v4:food / v4:minerals), even when the backpack is full.

import { game } from '../game';
import type { IslandScene4 } from '../v4/island';
import type { Interactable } from '../../world/npc';
import type { Frame, Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { audio, Sfx } from '../../core/audio';
import { ITEMS } from '../items';
import { add, fits } from '../inventory';
import { itemIconURL } from '../../art/itemicons';
import { groundY, zoneAt } from '../../art/island4/layout';
import { rand } from '../../core/math';
import { nestUnder, hornetAmbush } from './hornets';
import * as FA from '../../art/v9/forage-art';
import { startQuest, questStatus } from '../quests';
import type { ForageSprite } from '../../art/v9/forage-art';

export type Cat = 'wood' | 'plants' | 'food' | 'minerals';
type How = 'pick' | 'kneel' | 'dig' | 'jar' | 'net';
type Critter = 'beetle' | 'hopper' | 'moth';

interface Kind {
  item: string;
  n: [number, number];
  /** prompt verb */
  verb: string;
  tool?: 'trowel' | 'jar' | 'net' | 'knife';
  how: How;
  /** seconds of work */
  time: number;
  /** seconds of play before it's back (0 = one-off) */
  respawn: number;
  art: string;
  /** what's left once harvested (a bare bush, a dug pit); null = nothing */
  spent?: string;
  /** counts toward Joshu's walk-back haul */
  cat?: Cat;
  /** bonus find [item, chance] */
  bonus?: [string, number];
  /** only at some times (lantern moths at dusk) */
  when?: (s: IslandScene4) => boolean;
  critter?: Critter;
  sfx: Sfx;
  fx: [number, number, number];
  /** Mori's line the first time */
  first?: string;
  /** berry bush: might be over a jewel hornet nest */
  berry?: boolean;
}

const dusk = (s: IslandScene4) => s.clock.t > 2.45;
const SANDFX: [number, number, number] = [0.85, 0.75, 0.55], LEAFFX: [number, number, number] = [0.45, 0.75, 0.35], WATERFX: [number, number, number] = [0.7, 0.85, 1];

export const KINDS: Record<string, Kind> = {
  sunwhorl: { item: 'shell_sunwhorl', n: [1, 1], verb: 'Dig out the golden shell', how: 'pick', time: 0.8, respawn: 420, art: 'sunwhorl', sfx: 'dig', fx: SANDFX, first: 'A sunwhorl! Warm from the sun. I’m calling it a sunwhorl. Nobody can stop me.' },
  fan: { item: 'shell_fan', n: [1, 1], verb: 'Pick up the fanshell', how: 'pick', time: 0.6, respawn: 420, art: 'fan', sfx: 'pluck', fx: SANDFX, first: 'Pink and ribbed. Hold it to your ear and... yep. Surf. Obviously. We’re on a beach.' },
  opal: { item: 'shell_opal', n: [1, 1], verb: 'Reach into the rock pool', how: 'kneel', time: 1.2, respawn: 900, art: 'opal', sfx: 'splash', fx: WATERFX, first: 'An opal ear! Look at the lining, it’s like a tiny aurora.' },
  glass: { item: 'driftglass', n: [1, 1], verb: 'Pick up the sea glass', how: 'pick', time: 0.5, respawn: 360, art: 'glass', sfx: 'jarClink', fx: [0.7, 1, 0.9], first: 'Sea glass. Some bottle, years ago, tumbled frosty. Jenna will want this for SOMETHING.' },
  kelp: { item: 'kelp', n: [1, 2], verb: 'Pull up a kelp ribbon', how: 'kneel', time: 0.9, respawn: 240, art: 'kelp', sfx: 'pluck', fx: [0.5, 0.45, 0.2] },
  feather: { item: 'feather', n: [1, 1], verb: 'Pick up the feather', how: 'pick', time: 0.5, respawn: 400, art: 'feather', sfx: 'rustle', fx: [0.95, 0.95, 0.9], first: 'A flight feather. Something big nests on these cliffs.' },
  flint: { item: 'flint', n: [1, 1], verb: 'Fish a flint nodule out of the stream bed', how: 'kneel', time: 1.1, respawn: 300, art: 'flint', sfx: 'splash', fx: WATERFX, cat: 'minerals' },
  clay: { item: 'clay', n: [1, 2], verb: 'Dig clay from the bank', tool: 'trowel', how: 'dig', time: 1.4, respawn: 300, art: 'clay', sfx: 'dig', fx: [0.55, 0.55, 0.55] },
  dig: { item: 'pipi', n: [1, 2], verb: 'Dig where the breathing holes are', tool: 'trowel', how: 'dig', time: 1.5, respawn: 200, art: 'dig', spent: 'dug', sfx: 'dig', fx: [0.65, 0.55, 0.4], cat: 'food', bonus: ['shell_cone', 0.45], first: 'Pipi! Little bubbles in the sand mean little clams underneath. Breathing holes don’t lie.' },
  holly: { item: 'plant_seaholly', n: [1, 1], verb: 'Cut a sprig of sea holly', tool: 'knife', how: 'kneel', time: 1, respawn: 360, art: 'holly', sfx: 'pluck', fx: [0.6, 0.75, 0.85], first: 'Sea holly. Ow. OW. Spiky AND peppery. Respect.' },
  saltfern: { item: 'plant_saltfern', n: [1, 1], verb: 'Cut a salt fern frond', tool: 'knife', how: 'kneel', time: 1, respawn: 360, art: 'saltfern', sfx: 'pluck', fx: [0.9, 0.95, 0.9], first: 'Salt crystals on a fern. It sweats out the sea. Clever little plant.' },
  glowmoss: { item: 'plant_glowmoss', n: [1, 1], verb: 'Peel a little glow moss', tool: 'knife', how: 'kneel', time: 1.2, respawn: 400, art: 'glowmoss', sfx: 'pluck', fx: [0.6, 1, 0.65], first: 'It glows! Moss doesn’t glow. Something living IN the moss glows. Sample jar. Now.' },
  lily: { item: 'plant_dunelily', n: [1, 1], verb: 'Dig up the dune lily bulb', tool: 'trowel', how: 'dig', time: 1.4, respawn: 400, art: 'lily', sfx: 'dig', fx: SANDFX },
  dusk: { item: 'berry_dusk', n: [2, 4], verb: 'Pick duskberries', how: 'pick', time: 1, respawn: 300, art: 'duskbush', spent: 'duskbare', sfx: 'rustleBush', fx: [0.45, 0.25, 0.55], berry: true, first: 'Duskberries. Plum... and pine? Okay, one more. Two more. For science.' },
  gold: { item: 'berry_gold', n: [2, 4], verb: 'Pick goldcurrants', how: 'pick', time: 1, respawn: 300, art: 'goldbush', spent: 'goldbare', sfx: 'rustleBush', fx: [0.95, 0.75, 0.25], berry: true, first: 'Goldcurrants. SO sour. My whole face just folded in half.' },
  beetle: { item: 'bug_jewelbeetle', n: [1, 1], verb: 'Catch the jewel beetle in a jar', tool: 'jar', how: 'jar', time: 1.3, respawn: 180, art: 'flowers', spent: 'flowers', critter: 'beetle', sfx: 'jarClink', fx: [0.5, 1, 0.5], first: 'Gotcha. Green-gold and VERY grumpy about the jar.' },
  hopper: { item: 'bug_sandhopper', n: [1, 2], verb: 'Scoop sand hoppers into a jar', tool: 'jar', how: 'jar', time: 1.1, respawn: 150, art: 'wrack', spent: 'wrack', critter: 'hopper', sfx: 'jarClink', fx: SANDFX, first: 'Sand hoppers! They boing. They just boing everywhere.' },
  moth: { item: 'bug_lanternmoth', n: [1, 1], verb: 'Swing the bug net at the lantern moth', tool: 'net', how: 'net', time: 0.9, respawn: 150, art: 'none', critter: 'moth', when: dusk, sfx: 'netSwish', fx: [0.7, 1, 0.9], first: 'Got it! Its wing spots only glow when it flies. A flash, then darkness. Sneaky.' },
  // the walk-back haul
  drift: { item: 'wood', n: [1, 2], verb: 'Gather driftwood', how: 'pick', time: 0.9, respawn: 150, art: 'drift', sfx: 'rustle', fx: [0.75, 0.68, 0.55], cat: 'wood' },
  stones: { item: 'stone', n: [1, 2], verb: 'Pick up a good flat stone', how: 'pick', time: 0.7, respawn: 240, art: 'stones', sfx: 'dig', fx: [0.6, 0.6, 0.6], cat: 'minerals' },
  flax: { item: 'flaxleaf', n: [1, 2], verb: 'Cut harakeke (flax)', tool: 'knife', how: 'kneel', time: 1.2, respawn: 200, art: 'flax', sfx: 'pluck', fx: LEAFFX, cat: 'plants' },
  kawakawa: { item: 'kawakawa', n: [1, 2], verb: 'Pick kawakawa leaves', how: 'pick', time: 0.9, respawn: 200, art: 'kawakawa', sfx: 'pluck', fx: LEAFFX, cat: 'plants' },
  mussels: { item: 'mussel', n: [1, 2], verb: 'Pick mussels off the rocks', how: 'kneel', time: 1.1, respawn: 200, art: 'mussels', sfx: 'pluck', fx: WATERFX, cat: 'food' },
  warm: { item: 'stone', n: [1, 1], verb: 'Pick up the odd warm stone', how: 'kneel', time: 1, respawn: 0, art: 'warm', sfx: 'pluck', fx: [1, 0.6, 0.3], cat: 'minerals' },
};

/** [kind, x, dy] all along the shore, west to east */
const PLACES: [string, number, number][] = [
  // west point: rock pools and spray-zone ferns
  ['saltfern', 60, 1], ['opal', 120, 6], ['saltfern', 190, 1], ['opal', 250, 6], ['kelp', 300, 5], ['opal', 335, 6], ['glass', 395, 4],
  // in front of the wreck
  ['glass', 940, 4], ['drift', 1000, 4], ['stones', 1050, 5], ['kelp', 1110, 6], ['feather', 1180, 5], ['drift', 1240, 4], ['dig', 1290, 2], ['glass', 1330, 4],
  // the landing beach (camp goes up here)
  ['sunwhorl', 1505, 4], ['hopper', 1565, 7], ['holly', 1640, 9], ['dig', 1700, 2], ['sunwhorl', 1800, 4], ['fan', 1845, 5], ['lily', 1885, 9],
  ['feather', 1950, 5], ['fan', 2125, 5], ['dig', 2160, 2], ['sunwhorl', 2215, 4], ['hopper', 2315, 7], ['holly', 2345, 9], ['sunwhorl', 2445, 4],
  ['dig', 2475, 2], ['lily', 2505, 9], ['moth', 2590, 0], ['drift', 2615, 4],
  // the palm grove and tide pools (the ember bushes and their hornet nests are the wildlife's: 2705, 2880, 3095, 3240)
  ['mussels', 2660, 4], ['gold', 2745, 8], ['warm', 2790, 5], ['beetle', 2825, 8], ['drift', 2925, 4], ['moth', 2955, 0], ['feather', 2985, 5],
  ['kawakawa', 3015, 8], ['gold', 3050, 8], ['mussels', 3135, 4], ['moth', 3160, 0], ['beetle', 3178, 8], ['drift', 3203, 4], ['dig', 3320, 2],
  // the stream mouth
  ['kawakawa', 3420, 8], ['dig', 3460, 2], ['glass', 3500, 4], ['hopper', 3540, 7], ['drift', 3580, 4], ['sunwhorl', 3620, 4], ['flax', 3700, 8],
  ['clay', 3722, 6], ['flint', 3762, 5], ['flint', 3800, 5], ['clay', 3842, 6], ['flax', 3870, 8], ['drift', 3890, 4], ['stones', 3960, 5],
  // the seal rocks
  ['dig', 4060, 2], ['kelp', 4120, 6], ['opal', 4210, 6], ['glass', 4280, 4], ['feather', 4420, 5], ['opal', 4600, 6], ['saltfern', 4650, 1],
  // under the cliffs and in the sea cave
  ['stones', 4720, 5], ['saltfern', 4780, 1], ['feather', 4860, 5], ['saltfern', 4930, 1], ['glass', 4980, 4],
  ['glowmoss', 5140, 2], ['opal', 5232, 5], ['glowmoss', 5330, 2], ['glowmoss', 5410, 2],
  // the hidden cove
  ['kelp', 5480, 6], ['fan', 5505, 5], ['dig', 5545, 2], ['sunwhorl', 5705, 4], ['glass', 5760, 4], ['drift', 5850, 4],
  // the bush track (ember bushes at 6045, 6290, 6470, 6790)
  ['dusk', 5940, 7], ['moth', 6085, 0], ['beetle', 6210, 6], ['kawakawa', 6350, 6], ['moth', 6410, 0], ['dusk', 6720, 7], ['moth', 6850, 0],
];

interface Spot { key: string; k: Kind; x: number; y: number; ph: number; it: Interactable }

const ARTS: Record<string, () => ForageSprite> = {
  sunwhorl: FA.sunwhorl, fan: FA.fanshell, opal: FA.opalEar, glass: FA.seaGlass, kelp: FA.kelpHeap, feather: FA.feather,
  flint: FA.flintStone, clay: FA.clayBank, dig: () => FA.digSpot(false), dug: () => FA.digSpot(true), holly: FA.seaHolly, saltfern: FA.saltFern,
  glowmoss: FA.glowMoss, lily: FA.duneLily, duskbush: () => FA.berryBush('dusk'), duskbare: () => FA.berryBush('dusk', true),
  goldbush: () => FA.berryBush('gold'), goldbare: () => FA.berryBush('gold', true), flowers: FA.flowerClump, wrack: FA.wrack,
  drift: () => FA.driftwood(1), stones: FA.stones, flax: FA.flaxClump, kawakawa: FA.kawakawaShrub, mussels: FA.musselRock, warm: FA.warmStone,
  beetle0: () => FA.jewelBeetle(0), beetle1: () => FA.jewelBeetle(1), hopperbug: FA.sandHopper, moth0: () => FA.lanternMoth(0), moth1: () => FA.lanternMoth(1),
  net: FA.bugNet, jar: FA.specimenJar,
};

const TOOL_LINE: Record<string, string> = {
  trowel: 'I need my trowel for this. It’s in my field kit... which is somewhere in the wreck. In my bunk, if the sea was kind.',
  net: 'I need my bug net. Field kit. Wreck. Bunk. The usual.',
  jar: 'No jar, no beetle. I need a specimen jar.',
  knife: 'I need a knife to cut this cleanly.',
};

const NEED: Record<Cat, [string, number]> = { wood: ['v4:wood', 3], plants: ['v4:plants', 2], food: ['v4:food', 2], minerals: ['v4:minerals', 1] };
const SHELLS = ['shell_sunwhorl', 'shell_fan', 'shell_cone', 'shell_opal', 'shell_trycop'];
export const shellKinds = () => SHELLS.filter(id => game.save.flags['v9:found:' + id]).length;

export class Forage {
  spots: Spot[] = [];
  private fr: Record<string, { f: Frame; g: Frame | null }> = {};
  private marked = new Set<string>();
  private markT = 0;
  private saveT = 0;
  /** the pickup in progress (draws the net / jar at Mori's hand) */
  private work: { how: How; t: number; dur: number } | null = null;
  private lessons = new Set<Cat>();
  /** called with the category when a survival find counts for the walk back */
  onHaul: ((cat: Cat, kind: string) => void) | null = null;

  constructor(readonly s: IslandScene4) {}

  private frame(name: string) {
    let e = this.fr[name];
    if (!e) {
      const a = ARTS[name]();
      e = { f: local.add('fg:' + name, a.buf, a.ax, a.ay), g: a.glow ? local.add('fgg:' + name, a.glow, a.ax, a.ay) : null };
      this.fr[name] = e;
    }
    return e;
  }

  get playT() { return game.save.vars['v9:playT'] ?? 0; }
  avail(sp: Spot) {
    const d = game.save.nodes['fg:' + sp.key];
    if (d === -1) return false;
    if (d !== undefined && this.playT < d) return false;
    return !sp.k.when || sp.k.when(this.s);
  }
  /** while camp goes up, the landing beach belongs to the camp jobs */
  campHidden(sp: Spot) { const F = game.save.flags; return !!F['v4:arohaJoined'] && !F['v4:campDone'] && sp.x > 1440 && sp.x < 2500; }
  private missing(sp: Spot) { return sp.k.tool && !game.save.tools.includes(sp.k.tool) ? sp.k.tool : null; }

  start() {
    const s = this.s;
    PLACES.forEach(([kind, x, dy], i) => {
      const k = KINDS[kind];
      const key = `${kind}${x}`;
      const y = groundY(x) + dy;
      const self = this;
      const sp: Spot = { key, k, x, y, ph: (i * 1.37) % 6.28, it: null as unknown as Interactable };
      sp.it = {
        x, y: y - (k.critter === 'moth' ? 0 : 0), w: k.critter === 'moth' ? 16 : 10, h: 12, standX: x - 12,
        get label() { const m = self.missing(sp); return m ? `${k.verb} <span style="opacity:0.75">(needs ${ITEMS[m]?.name ?? m})</span>` : k.verb; },
        enabled: () => this.avail(sp) && !s.inWreck && !this.campHidden(sp),
        quest: () => this.marked.has(key),
        action: () => this.harvest(sp),
      } as Interactable;
      s.interact.push(sp.it);
      this.spots.push(sp);
      void i;
    });
    s.main.add(new Custom(-1.6, (r, st) => this.draw(r, st.time)));
    // net / jar at Mori's hand while he works (in front of him)
    s.main.add(new Custom(55, r => this.drawTool(r)));
  }

  // ---------------------------------------------------------------- harvesting
  async harvest(sp: Spot) {
    const s = this.s, p = s.player, k = sp.k, F = game.save.flags;
    const miss = this.missing(sp);
    if (miss) {
      audio.play('wrong', { vol: 0.45 });
      s.bark('mori', TOOL_LINE[miss], { expr: 'thinking', emote: 'question' });
      return;
    }
    const n = k.n[0] + Math.floor(rand.next() * (k.n[1] - k.n[0] + 1));
    const haul = !!k.cat && !F['v4:back'] && (game.save.vars[NEED[k.cat][0]] ?? 0) < NEED[k.cat][1] && !!F['v4:joshuAwake'];
    const room = fits(k.item, n);
    if (!room && !haul) {
      audio.play('wrong', { vol: 0.45 });
      s.bark('mori', 'My backpack’s full. Time to sort it out (Tab).', { expr: 'worried', emote: 'sweat' });
      return;
    }
    p.facing = sp.x >= p.x ? 1 : -1;
    const anim = k.how === 'pick' ? 'pick' : k.how === 'dig' ? 'dig' : k.how === 'net' ? 'grab' : 'kneel';
    this.work = { how: k.how, t: 0, dur: k.time };
    let fxT = 0, sfxT = k.how === 'net' ? 0.25 : 0;
    const ok = await p.doWork(anim, k.time, kk => {
      if (this.work) this.work.t = kk * k.time;
      fxT -= 1 / 60; sfxT -= 1 / 60;
      if (sfxT <= 0) { sfxT = k.how === 'net' ? 9 : 0.4; audio.play(k.sfx, { vol: 0.35, pitch: 0.9 + rand.next() * 0.25 }); }
      if (fxT <= 0 && (k.how === 'dig' || k.how === 'kneel')) { fxT = 0.2; this.fx(sp, 3); }
    });
    this.work = null;
    if (!ok) return;
    // the haul
    const gives: [string, number][] = [[k.item, n]];
    if (k.bonus && rand.next() < k.bonus[1]) gives.push([k.bonus[0], 1]);
    const [cx, cy] = s.css(sp.x, sp.y - 14);
    let i = 0, got = 0;
    for (const [id, m] of gives) {
      const g = room || id !== k.item ? add(id, m) : 0;
      if (g <= 0) continue;
      got += g;
      const fresh = !F['v9:found:' + id];
      F['v9:found:' + id] = true;
      setTimeout(() => s.hud?.flyItem(id, g, ITEMS[id]?.name ?? id, cx + i * 22, cy - i * 6), i * 180);
      game.ui.toast(`+${g} <img src="${itemIconURL(id, 2)}" style="width:1.5em;height:1.5em;vertical-align:-0.35em;image-rendering:pixelated"> <b>${ITEMS[id]?.name ?? id}</b>`, fresh ? 'NEW FIND' : 'FOUND', 'teal', fresh ? 2600 : 1700);
      if (fresh && SHELLS.includes(id)) { audio.play('discover', { vol: 0.4 }); if (questStatus('v9shells') === 'hidden') startQuest('v9shells'); }
      i++;
    }
    this.fx(sp, 12);
    audio.play('collectPop', { vol: 0.55 });
    p.body.react('bounce');
    // Mori's first-find line
    if (k.first && !F['v9:said:' + k.art + k.item]) {
      F['v9:said:' + k.art + k.item] = true;
      setTimeout(() => s.bark('mori', k.first!, { expr: 'excited' }), 300);
    }
    if (k.art === 'warm') {
      F['v4:emberStone'] = true;
      setTimeout(() => s.bark('mori', 'It’s warm... and it fizzes a little when I squeeze it. Pocket. Very gently.', { expr: 'surprised' }), 900);
    }
    // survival finds count for the walk back (and Joshu carries what won't fit)
    if (k.cat && !F['v4:back']) {
      const [v] = NEED[k.cat];
      game.save.vars[v] = (game.save.vars[v] ?? 0) + Math.max(1, Math.min(2, got || 1));
      if (!got && haul) setTimeout(() => s.bark('joshu', 'Give it here, lad. My pockets are bigger than your backpack.', { expr: 'teasing' }), 400);
      this.onHaul?.(k.cat, k.art);
      if (F['v4:joshuAwake'] && !this.lessons.has(k.cat)) this.lessons.add(k.cat);
    }
    game.save.nodes['fg:' + sp.key] = k.respawn > 0 ? this.playT + k.respawn : -1;
    game.persist();
    s.hud?.refresh(true);
    this.markT = 0;
    // a berry bush right over a jewel hornet nest...
    if (k.berry && nestUnder(sp.x)) await hornetAmbush(s, sp.x, sp.y);
  }

  private fx(sp: Spot, count: number) {
    const lp = this.s.main.particles, c = sp.k.fx;
    for (let i = 0; i < count; i++) lp.spawn({ frame: A.dot2, x: sp.x + rand.range(-6, 6), y: sp.y - rand.range(1, 8), vx: rand.range(-35, 35), vy: rand.range(-80, -25), ay: 240, life: rand.range(0.4, 0.8), color: c, alpha: 1, alpha1: 0, floorY: sp.y + 1 });
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    const s = this.s;
    game.save.vars['v9:playT'] = this.playT + dt;
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 15; game.persist(); }
    this.markT -= dt;
    if (this.markT <= 0) {
      this.markT = 0.5;
      this.marked.clear();
      const F = game.save.flags;
      // the walk back: a marker over the nearest find of each thing Joshu still needs
      if (F['v4:joshuAwake'] && !F['v4:back']) {
        for (const cat of Object.keys(NEED) as Cat[]) {
          const [v, need] = NEED[cat];
          if ((game.save.vars[v] ?? 0) >= need) continue;
          let best: Spot | null = null, bd = 1400;
          for (const sp of this.spots) {
            if (sp.k.cat !== cat || !this.avail(sp) || this.missing(sp)) continue;
            const d = Math.abs(sp.x - s.player.x) + (sp.x > s.player.x + 200 ? 300 : 0);
            if (d < bd) { bd = d; best = sp; }
          }
          if (best) this.marked.add(best.key);
        }
      }
    }
  }

  private draw(r: Renderer, t: number) {
    const x0 = r.visibleX0(30), x1 = r.visibleX1(30);
    const near = this.s.nearIt;
    const night = this.s.clock.night;
    for (const sp of this.spots) {
      if (sp.x < x0 || sp.x > x1 || this.campHidden(sp)) continue;
      const k = sp.k, on = this.avail(sp);
      const name = on ? k.art : k.spent;
      if (name && name !== 'none') {
        const e = this.frame(name);
        r.draw(e.f, sp.x, sp.y);
        if (e.g && on) { r.emissive(1); r.draw(e.g, sp.x, sp.y, 1, 1, 0, packColor(1, 1, 1, 0.65 + 0.35 * Math.sin(t * 2 + sp.ph))); r.emissive(); if (k.art === 'glowmoss' || k.art === 'warm') r.light(sp.x, sp.y - 4, 26, k.art === 'warm' ? 1 : 0.6, k.art === 'warm' ? 0.6 : 1, 0.6, 0.5); }
      }
      if (!on) continue;
      // critters
      if (k.critter === 'beetle') {
        const bx = sp.x + Math.sin(t * 0.6 + sp.ph) * 4, by = sp.y - 9 + Math.cos(t * 0.6 + sp.ph) * 1.5;
        r.draw(this.frame(Math.floor(t * 6) % 2 ? 'beetle1' : 'beetle0').f, bx, by, Math.cos(t * 0.6 + sp.ph) > 0 ? 1 : -1, 1);
      } else if (k.critter === 'hopper') {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.7 + i * 0.37 + sp.ph) % 1.6;
          const hop = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) * 6 : 0;
          r.draw(this.frame('hopperbug').f, sp.x - 6 + i * 6 + (ph < 0.35 ? ph * 8 : 2.8), sp.y - 1 - hop);
        }
      } else if (k.critter === 'moth') {
        const mx = sp.x + Math.sin(t * 1.3 + sp.ph) * 12, my = sp.y - 24 + Math.sin(t * 2.3 + sp.ph) * 6;
        const e = this.frame(Math.floor(t * 12 + sp.ph) % 2 ? 'moth1' : 'moth0');
        r.draw(e.f, mx, my, Math.cos(t * 1.3 + sp.ph) > 0 ? 1 : -1, 1);
        if (e.g) { r.emissive(1); r.draw(e.g, mx, my, 1, 1, 0, packColor(1, 1, 1, 0.5 + night * 0.5)); r.emissive(); r.light(mx, my, 18, 0.7, 1, 0.9, 0.25 + night * 0.5); }
      }
      // a gentle glint now and then (and always on the one you're next to)
      const hover = near === sp.it;
      const g = Math.sin(t * 1.5 + sp.ph * 3);
      if (hover || g > 0.94) {
        const kk = hover ? 0.8 + 0.2 * Math.sin(t * 6) : (g - 0.94) / 0.06;
        const top = k.critter === 'moth' ? sp.y - 26 : sp.y - (this.fr[k.art]?.f.ay ?? 6) + 2;
        r.fxDraw(A.spark, sp.x + Math.sin(t + sp.ph) * 3, top, 0.7, 0.7, t, packColor(1, 0.95, 0.75, 1), 1.4 * kk);
      }
    }
  }

  private drawTool(r: Renderer) {
    const w = this.work;
    if (!w || (w.how !== 'net' && w.how !== 'jar')) return;
    const p = this.s.player;
    const h = p.body.handPos() ?? [p.x + p.facing * 8, p.y - 30];
    if (w.how === 'net') {
      const k = Math.min(1, w.t / Math.max(0.1, w.dur));
      const rot = (-1.5 + k * 2.1) * p.facing;
      r.draw(this.frame('net').f, h[0], h[1] + 2, p.facing, 1, rot);
    } else r.draw(this.frame('jar').f, h[0] + p.facing * 2, h[1] + 3);
  }

  /** which kinds are on the island (for tests / zl) */
  list() { return this.spots.map(sp => ({ key: sp.key, item: sp.k.item, x: sp.x, on: this.avail(sp), tool: sp.k.tool ?? null, cat: sp.k.cat ?? null, zone: zoneAt(sp.x) })); }
}

let current: Forage | null = null;
/** spawn the island's pickups (called from the island story's enter) */
export function startForage(s: IslandScene4): Forage {
  current = new Forage(s);
  current.start();
  return current;
}
export const forage = () => current;

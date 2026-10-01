// V4 island story, part two: the long walk back with Joshu teaching survival (driftwood, flax and
// kawakawa, mussels and pipi, obsidian and a strange warm stone, and photographing what lives here),
// the dognapping and Aroha (see islearoha.ts), making camp together (Joshu builds and cooks, Jenna
// wires up the lights, Mori sets up research and survival gear, Aroha gathers and teaches, Chunk gets
// in the way), dinner round the fire, lights out one by one, and sleep. Then: Day 1 Complete.

import { game } from '../game';
import { startQuest, questStatus } from '../quests';
import { audio } from '../../core/audio';
import type { Renderer, Frame } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { sprite, jcall } from '../sites2/common';
import type { Sprite } from '../../art/jungle-core';
import { ISL, SPOT, groundY } from '../../art/island4/layout';
import * as CA from '../../art/island4/camp';
import { clamp, rand } from '../../core/math';
import type { IsleStory } from './islestory';
import { wait } from './islestory';
import { runStandoff } from './islearoha';
import { enableFieldLaptop, openFieldLaptop } from '../v9/research9';

/** camp layout on the landing beach */
export const CAMP = {
  salvage: 1470, storage: 1590, tent: 1720, research: 1850, bag: 1930, fire: 1990, bed: 2034, cook: 2090, rack: 2175, lean: 2280, elec: 1530,
  benchL: 1956, benchR: 2030, pole0: 1690, pole1: 1900, pole2: 2250, sticks: [1620, 2380, 2480] as number[],
};

const JOBS = ['firewood', 'supplies', 'tent', 'research', 'rack', 'bed'] as const;
type Job = typeof JOBS[number];
const JOB_NAME: Record<Job, string> = {
  firewood: 'Gather firewood', supplies: 'Carry supplies from the wreck', tent: 'Pitch the tent with Joshu',
  research: 'Set up your research table', rack: 'Build the drying rack with Aroha', bed: 'Make Chunk a warm bed',
};

export class IsleCamp {
  /** 0 unlit .. 1 roaring .. 0.3 embers */
  fire = 0;
  fireT = 0;
  bulbs: { x: number; y: number; on: boolean; c: [number, number, number] }[] = [];
  lanternOn = false;
  /** Mori is in the sleeping bag (the pose draws it) */
  inBag = false;
  laptopOn = false;
  sticks = 0;
  carrying: 'sticks' | 'crate' | null = null;
  private crates = 0;
  private lessons = new Set<string>();
  private doneBark = false;
  private chunkGagT = 0;
  private nagT = 0;
  private stickTaken = [false, false, false];
  private npcT = 0;

  constructor(readonly st: IsleStory) {}

  get s() { return this.st.s; }
  job(j: Job) { return !!game.save.flags['v4:job:' + j]; }
  jobs() { return JOBS.filter(j => this.job(j)).length; }
  private doneJob(j: Job) {
    if (this.job(j)) return;
    game.save.flags['v4:job:' + j] = true;
    game.save.vars['v4:campJobs'] = this.jobs();
    game.persist();
    this.s.hud?.refresh(true);
    audio.play('craft' as never, { vol: 0.6 });
    game.ui.toast(`Camp: <b>${JOB_NAME[j]}</b> done (${this.jobs()}/6)`, 'CAMP', 'teal', 3000);
  }

  // ---------------------------------------------------------------- setup
  setup() {
    const s = this.s, st = this.st;
    const F = (k: string) => !!game.save.flags[k];
    // (the walk-back haul is picked up from the shore by the forage module: src/game/v9/forage.ts)
    // ---- the camp, built up as the jobs get done
    const show = (j: Job) => () => this.job(j);
    st.prop('woodpile', CA.woodPile(3), CAMP.fire - 34, groundY(CAMP.fire - 34) + 4, () => this.job('firewood') && !F('v4:dinnerOver'), -2);
    st.prop('pit', CA.firePit(false), CAMP.fire, groundY(CAMP.fire) + 5, () => F('v4:arohaJoined'), -2);
    st.prop('storage', CA.storage(), CAMP.storage, groundY(CAMP.storage) + 2, () => this.crates >= 1 || this.job('supplies'), -3);
    st.prop('salvage', CA.storage(), CAMP.salvage, groundY(CAMP.salvage) + 2, () => F('v4:split'), -3);
    st.prop('tent', CA.domeTent(), CAMP.tent, groundY(CAMP.tent) + 2, show('tent'), -3);
    const rt = st.prop('research', CA.researchTable(), CAMP.research, groundY(CAMP.research) + 2, show('research'), -3);
    const baseGlow = rt.glow;
    rt.glow = undefined;
    s.main.add(new Custom(-2.9, rr => { if (this.job('research') && this.laptopOn && baseGlow) { rr.emissive(0.75); rr.draw(baseGlow, rt.x, rt.y, 1, 1, 0, packColor(0.7, 0.8, 0.9, 1)); rr.emissive(); rr.light(rt.x + 2, rt.y - 18, 34, 0.6, 0.85, 1, 0.3); } }));
    st.prop('rack', CA.dryingRack(), CAMP.rack, groundY(CAMP.rack) + 2, show('rack'), -3);
    st.prop('bed', CA.chunkBed(), CAMP.bed, groundY(CAMP.bed) + 4, show('bed'), -2);
    st.prop('bedroll', CA.bedroll(), CAMP.bag, groundY(CAMP.bag) + 4, () => this.job('research') && !this.inBag, -2.2);
    st.prop('cook', CA.cookBench(), CAMP.cook, groundY(CAMP.cook) + 2, () => this.job('firewood'), -3);
    st.prop('lean', CA.leanTo(), CAMP.lean, groundY(CAMP.lean) + 2, () => this.jobs() >= 4, -3);
    st.prop('elec', CA.electronics(), CAMP.elec, groundY(CAMP.elec) + 2, () => F('v4:arohaJoined'), -3);
    st.prop('benchL', CA.logBench(40), CAMP.benchL, groundY(CAMP.benchL) + 4, () => this.job('firewood'), -2);
    st.prop('benchR', CA.logBench(40), CAMP.benchR + 14, groundY(CAMP.benchR) + 4, () => this.job('firewood'), -2);
    for (const [i, x] of [CAMP.pole0, CAMP.pole1, CAMP.pole2].entries()) st.prop('pole' + i, CA.pole(52), x, groundY(x) + 2, () => this.jobs() >= 3, -2.5);
    const lan = st.prop('lantern', CA.lantern(), CAMP.research - 22, groundY(CAMP.research) - 18, () => this.job('research'), -2.8);
    const lanGlow = lan.glow;
    lan.glow = undefined;
    s.main.add(new Custom(-2.7, rr => { if (this.job('research') && this.lanternOn && lanGlow) { rr.emissive(0.75); rr.draw(lanGlow, lan.x, lan.y, 1, 1, 0, packColor(0.9, 0.8, 0.6, 1)); rr.emissive(); rr.light(lan.x, lan.y - 6, 55, 1, 0.82, 0.5, 0.45, 0.1); } }));
    // sticks of firewood lying on the beach for the firewood job
    const stickF = sprite('camp:stick', () => jcall<Sprite>('resourceSprite', 'driftwood', false, 7));
    CAMP.sticks.forEach((x, i) => s.main.add(new Custom(-2, rr => {
      if (!F('v4:arohaJoined') || this.job('firewood') || this.stickTaken[i] || !stickF) return;
      rr.draw(stickF.f, x, groundY(x) + 3);
    })));
    // string lights: sagging between the three poles
    const pts: [number, number][] = [[CAMP.pole0, groundY(CAMP.pole0) - 50], [CAMP.pole1, groundY(CAMP.pole1) - 50], [CAMP.pole2, groundY(CAMP.pole2) - 50]];
    const cols: [number, number, number][] = [[1, 0.85, 0.4], [1, 0.55, 0.35], [0.6, 0.9, 1], [1, 0.6, 0.85], [0.7, 1, 0.6]];
    for (let seg = 0; seg < 2; seg++) {
      const [ax, ay] = pts[seg], [bx, by] = pts[seg + 1];
      for (let x = ax + 10; x < bx - 6; x += 13) {
        const t = (x - ax) / (bx - ax);
        this.bulbs.push({ x, y: ay + (by - ay) * t + Math.sin(t * Math.PI) * 16, on: false, c: cols[this.bulbs.length % cols.length] });
      }
    }
    s.main.add(new Custom(-1, (rr, stg) => {
      if (this.jobs() < 3 && !F('v4:dinner')) return;
      // the wire
      for (let seg = 0; seg < 2; seg++) {
        const [ax, ay] = pts[seg], [bx, by] = pts[seg + 1];
        for (let x = ax; x < bx; x += 2) { const t = (x - ax) / (bx - ax); rr.rect(x, ay + (by - ay) * t + Math.sin(t * Math.PI) * 16 - 1, 2, 1, packColor(0.15, 0.13, 0.12, 1)); }
      }
      const night = this.s.clock.night * 0.7 + this.s.clock.dusk * 0.4;
      for (const b of this.bulbs) {
        rr.rect(b.x - 1, b.y, 2, 3, b.on ? packColor(b.c[0], b.c[1], b.c[2], 1) : packColor(0.35, 0.33, 0.3, 1));
        if (!b.on) continue;
        const tw = 0.9 + 0.1 * Math.sin(stg.time * 3 + b.x);
        rr.fxDraw(A.glow, b.x, b.y + 2, 0.12, 0.12, 0, packColor(b.c[0], b.c[1], b.c[2], 1), (0.35 + night * 0.5) * tw);
      }
      // a few real lights so the camp is lit (not one per bulb)
      if (this.bulbs.some(b => b.on)) {
        const on = this.bulbs.filter(b => b.on).length / this.bulbs.length;
        for (const x of [1780, 1900, 2060, 2180]) rr.light(x, groundY(x) - 40, 70, 1, 0.82, 0.55, 0.22 * on * (0.3 + night), 0.05);
      }
    }));
    // the fire
    s.main.add(new Custom(-1.5, (rr, stg) => {
      if (this.fire <= 0.01) return;
      const x = CAMP.fire, y = groundY(x);
      const k = (0.85 + 0.15 * Math.sin(stg.time * 11) * Math.sin(stg.time * 3.7)) * this.fire;
      const night = 0.45 + this.s.clock.night * 0.4;
      rr.light(x, y - 12, 70 + 100 * this.fire, 1, 0.6, 0.3, 0.8 * k * night, 0.15);
      rr.fxDraw(A.glow, x, y - 8, 0.45 * this.fire, 0.4 * this.fire, 0, packColor(1, 0.55, 0.2, 1), 0.7 * k);
    }, (dt, stg) => {
      if (this.fire <= 0.01) return;
      this.fireT -= dt;
      if (this.fireT > 0) return;
      this.fireT = 0.05 / Math.max(0.3, this.fire);
      const x = CAMP.fire, y = groundY(x) - 2;
      const m = this.s.main;
      m.glowParticles.spawn({ frame: A.soft, x: x + rand.range(-5, 5) * this.fire, y, vx: rand.range(-6, 6), vy: rand.range(-40, -24) * this.fire, life: rand.range(0.35, 0.75), color: [1, 0.74, 0.3], color1: [1, 0.25, 0.06], alpha: 0.95, alpha1: 0, size: rand.range(0.25, 0.42) * (0.5 + this.fire * 0.5), size1: 0.05, glow: true, intensity: 2.6 });
      if (rand.chance(0.15 * this.fire)) m.glowParticles.spawn({ frame: A.dot, x, y: y - 6, vx: rand.range(-12, 12), vy: rand.range(-60, -30), life: rand.range(1, 2), color: [1, 0.8, 0.4], alpha: 1, alpha1: 0, glow: true, intensity: 3, wobble: 6, wobbleF: 2 });
      if (rand.chance(0.05)) m.particles.spawn({ frame: A.soft, x, y: y - 16, vx: rand.range(-4, 4) + stg.wind * 6, vy: -14, life: 3, color: [0.4, 0.38, 0.4], alpha: 0.25, alpha1: 0, size: 0.3, size1: 1 });
    }));
    this.addCampInteractables();
    enableFieldLaptop(s);
  }

  private addCampInteractables() {
    const s = this.s, st = this.st;
    const F = (k: string) => !!game.save.flags[k];
    const camp = () => F('v4:arohaJoined') && !F('v4:campDone');
    const self = this;
    // firewood: three sticks on the beach, then the pit
    CAMP.sticks.forEach((x, i) => st.it({ x, y: groundY(x), w: 14, label: 'Pick up firewood', standX: x - 12, quest: () => true, enabled: () => camp() && !this.job('firewood') && !this.stickTaken[i] && this.carrying !== 'crate', action: () => this.pickStick(i) }));
    st.it({ x: CAMP.fire, y: groundY(CAMP.fire), w: 18, get label() { return self.sticks >= 3 ? 'Drop the firewood by the fire pit' : `Firewood (${self.sticks}/3)`; }, standX: CAMP.fire - 20, quest: () => true, enabled: () => camp() && !this.job('firewood') && this.sticks >= 3, action: () => this.dropWood() } as never);
    // supplies: two crates from Jenna's salvage pile to the storage spot
    st.it({ x: CAMP.salvage, y: groundY(CAMP.salvage), w: 20, get label() { return `Pick up a crate of salvage (${self.crates}/2)`; }, standX: CAMP.salvage + 22, quest: () => true, enabled: () => camp() && !this.job('supplies') && this.carrying === null, action: () => this.pickCrate() } as never);
    st.it({ x: CAMP.storage, y: groundY(CAMP.storage), w: 18, label: 'Stack the crate here', standX: CAMP.storage - 24, quest: () => true, enabled: () => camp() && this.carrying === 'crate', action: () => this.dropCrate() });
    st.it({ x: CAMP.tent, y: groundY(CAMP.tent), w: 20, label: JOB_NAME.tent, standX: CAMP.tent - 30, quest: () => true, enabled: () => camp() && !this.job('tent') && this.carrying === null, action: () => this.pitchTent() });
    st.it({ x: CAMP.research, y: groundY(CAMP.research), w: 20, label: JOB_NAME.research, standX: CAMP.research - 24, quest: () => true, enabled: () => camp() && !this.job('research') && this.carrying === null, action: () => this.research() });
    st.it({ x: CAMP.research, y: groundY(CAMP.research), w: 20, label: 'Use your laptop', standX: CAMP.research - 16, enabled: () => this.job('research') && this.carrying === null && !this.inBag, action: () => openFieldLaptop(s, { table: true }) });
    st.it({ x: CAMP.rack, y: groundY(CAMP.rack), w: 20, label: JOB_NAME.rack, standX: CAMP.rack - 26, quest: () => true, enabled: () => camp() && !this.job('rack') && this.carrying === null, action: () => this.rack() });
    st.it({ x: CAMP.bed, y: groundY(CAMP.bed), w: 16, label: JOB_NAME.bed, standX: CAMP.bed - 20, quest: () => true, enabled: () => camp() && !this.job('bed') && this.job('firewood') && this.carrying === null, action: () => this.chunkBed() });
    // after dinner: bed time
    st.it({ x: CAMP.bag, y: groundY(CAMP.bag), w: 18, label: 'Tidy up and get some sleep', standX: CAMP.bag - 14, quest: () => true, enabled: () => F('v4:dinner') && !F('v4:day1'), action: () => this.lightsOut() });
    // chat around camp
    const talk = (who: 'jenna' | 'joshu' | 'aroha', lines: () => string[][]) => st.it({ get x() { return s.actor(who).x; }, get y() { return s.actor(who).y; }, w: 14, label: `Talk to ${who === 'jenna' ? 'Jenna' : who === 'joshu' ? 'Joshu' : 'Aroha'}`, get standX() { return s.actor(who).x - 22; }, enabled: () => camp() && s.actor(who).visible && this.carrying === null, action: () => { const l = rand.pick(lines()); return st.say([{ who, text: l[0], expr: l[1] }]).then(() => {}); } } as never);
    talk('jenna', () => [['The battery from the wreck still holds a charge! Lights, radio, and if I find a USB cable, SNACK-POWERED LAPTOP.', 'excited'], ['I have named the crab in the fuse panel. His name is Kevin. Kevin stays.', 'smug'], ['Aroha’s slingshot rocks go POP. I need to know the chemistry. For science. And revenge.', 'teasing']]);
    talk('joshu', () => [['A tent’s only as good as its pegs, lad. Dig them in at an angle, into the wind.', 'neutral'], ['Mussels, pipi, a bit of fish. Tonight we eat like kings. Wet, sandy kings.', 'happy'], ['That girl knows this island. We’d do well to listen to her.', 'serious']]);
    talk('aroha', () => [['Harakeke. Cut from the outside, never the heart: the heart is the baby, the ones around it are the parents.', 'serious'], ['Kawakawa leaves with holes in them are the best ones. The bugs know.', 'happy'], ['Your pug just tried to eat a kelp strand bigger than he is. He is not a smart dog.', 'teasing']]);
  }

  // ---------------------------------------------------------------- restore
  async restore() {
    const s = this.s, st = this.st, F = (k: string) => !!game.save.flags[k];
    st.set('trg:tracks');
    this.hideAll();
    if (!F('v4:back')) {
      // walking back with Joshu
      st.place(s.joshu, s.player.x - 40, 1, 'injured');
      s.joshu.walkAnim = 'limp';
      st.joshuF.on = true;
      st.chunkFollow();
      st.jennaAtWreck();
      if (s.player.x > 4100) { s.player.x = 4020; s.player.y = groundY(4020); s.joshu.x = 3990; s.snapCamera(); }
      this.returnTriggers();
      return;
    }
    if (!F('v4:arohaJoined')) {
      s.player.x = 2300; s.player.y = groundY(2300); s.snapCamera();
      st.place(s.joshu, 2340, -1, 'injured');
      st.place(s.chunk, 2270, 1, 'idle');
      return runStandoff(st);
    }
    this.campMode();
    if (F('v4:dinner') && !F('v4:day1')) { this.nightMode(); return; }
    if (F('v4:day1')) { this.nightMode(true); return; }
    if (this.jobs() >= 6 && !F('v4:dinner')) await this.dinner();
  }

  hideAll() {
    const s = this.s;
    for (const a of [s.jenna, s.joshu, s.aroha]) this.st.hide(a);
  }

  // ---------------------------------------------------------------- the walk back
  async startReturn() {
    const s = this.s, st = this.st, p = s.player, jo = s.joshu;
    await st.cut(async () => {
      await st.say([
        { who: 'joshu', text: 'Here. Take my knife. Don’t lose it: it was my father’s.', expr: 'serious' },
        { who: 'mori', text: 'Joshu, I can’t...', expr: 'surprised' },
        { who: 'joshu', text: 'You can and you will. I can barely walk. You’re my hands today, lad.', expr: 'neutral' },
        { who: 'joshu', text: 'And we are NOT walking back empty-handed. Fire, food, shelter. Starting now.', expr: 'determined' },
      ]);
      if (!game.save.tools.includes('knife')) game.save.tools.push('knife');
      await st.fadeOut(1.1);
      s.clock.set(1.85);
      s.clock.target = 2.55;
      s.clock.rate = 0.0032;
      p.x = 4030; p.y = groundY(p.x); p.facing = -1;
      st.place(jo, 4070, -1, 'injured');
      jo.walkAnim = 'limp';
      st.joshuF.on = true;
      st.place(s.chunk, 4000, -1, 'idle');
      st.chunkFollow();
      s.snapCamera();
      await wait(400);
      await st.fadeIn(0.9);
      await st.say([
        { who: 'mori', text: 'Down the stream and out onto the beach. That shortcut cut off half the walk.', expr: 'happy' },
        { who: 'joshu', text: 'Water always knows the way to the sea. Remember that if you ever get lost.', expr: 'neutral' },
        { who: 'joshu', text: 'Right. Lesson one: the tide line. Everything above it is dry. Everything below it is somebody’s dinner.', expr: 'teasing' },
        { who: 'joshu', text: 'Driftwood above the line for the fire. Flax for rope. Shellfish off the rocks. And keep your eyes open for good stone.', expr: 'serious' },
        { who: 'joshu', text: 'And you’ll want photos of whatever lives here. If we’re sharing this beach, we should know who with.', expr: 'happy' },
      ]);
    });
    this.returnTriggers();
    if (questStatus('v4return') === 'hidden') startQuest('v4return');
  }

  private returnTriggers() {
    const st = this.st, s = this.s;
    const free = () => !s.cutscene && !game.ui.blocking;
    const near = (x: number, r = 70) => Math.abs(s.player.x - x) < r;
    const lesson = (id: string, x: number, lines: [string, string][]) => st.trigger('lesson:' + id, () => free() && near(x), async () => {
      s.joshu.faceTo(x);
      await st.say(lines.map(([t, e]) => ({ who: 'joshu', text: t, expr: e })));
    });
    lesson('flax', 3730, [['See that? Harakeke. Flax. Cut the outer leaves low, never the middle shoot.', 'neutral'], ['Split the leaf with your thumbnail and there’s fibre inside. Strong as rope once it’s twisted.', 'happy']]);
    lesson('flint', 3775, [['Flint, in the stream bed. See the dark ones? Fish one out.', 'surprised'], ['Strike it on the back of my knife and you’ve got a spark. That’s a fire you didn’t have to rub for.', 'serious']]);
    lesson('kawakawa', 3440, [['Heart-shaped leaves with holes in them. Kawakawa. My old bosun swore by it.', 'happy'], ['Tea for your belly, a poultice for cuts. The holey leaves are the best ones.', 'neutral']]);
    lesson('pipi', 3330, [['See the little breathing holes in the wet sand? Pipi. Get your trowel in under them, where the water’s just gone out.', 'excited']]);
    lesson('mussels', 3090, [['Green-lipped mussels on the rocks, below the tide line. Pick the big ones, leave the babies.', 'happy']]);
    lesson('ember', 2790, [['What in the... that stone’s warm. And it’s glowing. Look at it.', 'surprised'], ['Never seen the like. Pick it up careful, and keep it away from the fire until we know what it is.', 'serious']]);
  }

  gatherDone() {
    const v = (k: string) => game.save.vars[k] ?? 0;
    return v('v4:wood') >= 3 && v('v4:plants') >= 2 && v('v4:food') >= 2 && v('v4:minerals') >= 1 && v('v4:islePhotos') >= 2;
  }
  private missing() {
    const v = (k: string) => game.save.vars[k] ?? 0;
    const m: string[] = [];
    if (v('v4:wood') < 3) m.push('more driftwood');
    if (v('v4:plants') < 2) m.push('flax or kawakawa');
    if (v('v4:food') < 2) m.push('something to eat');
    if (v('v4:minerals') < 1) m.push('a good stone');
    if (v('v4:islePhotos') < 2) m.push('photos of the locals');
    return m.length > 1 ? m.slice(0, -1).join(', ') + ' and ' + m[m.length - 1] : m[0] ?? 'nothing';
  }

  /** a survival find from the shore counted for the walk back (forage.ts) */
  gatheredCat(cat: 'wood' | 'plants' | 'food' | 'minerals', kind: string) {
    const F = game.save.flags;
    this.s.hud?.refresh(true);
    if (!F['v4:joshuAwake'] || F['v4:back']) return;
    const praise: Record<string, string[]> = {
      wood: ['Good and dry. That’ll burn.', 'Bleached white. Been above the tide a good long while.', 'Driftwood. The sea delivers.'],
      plants: ['That’s it, low and clean.', 'Good. Aroha’s mum would... ah, never mind, you don’t know her. Good work.', 'Perfect.'],
      food: ['Dinner!', 'Look at the size of that. We eat tonight.', 'Leave the little ones. Good lad.'],
      minerals: ['Keep that one safe.', 'Handy. Very handy.'],
    };
    if (!this.lessons.has(cat)) { this.lessons.add(cat); setTimeout(() => this.s.bark('joshu', rand.pick(praise[cat]), { expr: 'happy' }), 1200); }
    void kind;
    if (this.gatherDone() && !this.doneBark) { this.doneBark = true; setTimeout(() => this.s.bark('joshu', 'That’ll do. Back to the wreck, then, before the light goes.', { expr: 'happy' }), 2600); }
  }

  // ---------------------------------------------------------------- camp
  /** everybody at camp doing their jobs */
  campMode() {
    const s = this.s, st = this.st;
    st.jennaF.on = false;
    st.joshuF.on = false;
    s.clock.target = Math.max(s.clock.t, 3.15);
    s.clock.rate = 0.0022;
    this.fire = this.job('firewood') ? 1 : 0;
    this.lanternOn = this.job('research');
    this.laptopOn = this.job('research');
    if (this.jobs() >= 3) for (const b of this.bulbs) b.on = true;
    st.place(s.jenna, CAMP.elec + 18, -1, 'wrench');
    st.place(s.joshu, this.job('firewood') ? CAMP.cook - 22 : CAMP.tent + 30, 1, this.job('firewood') ? 'cook' : 'hammer');
    st.place(s.aroha, CAMP.lean - 10, -1, 'pick');
    st.chunkFollow();
    if (questStatus('v4camp') === 'hidden') startQuest('v4camp');
    audio.setMusic('build' as never);
  }

  private async pickStick(i: number) {
    const s = this.s;
    this.stickTaken[i] = true;
    s.player.poseOverride = 'pick';
    audio.play('rustle', { vol: 0.5 });
    await wait(600);
    s.player.poseOverride = null;
    this.sticks++;
    this.carrying = 'sticks';
    s.player.animMap = { idle: 'carryIdle', walk: 'carry', run: 'carry' };
    if (this.sticks === 1) s.bark('aroha', 'Dry wood from above the tide line. You learn fast.', { expr: 'happy' });
    if (this.sticks === 2) this.chunkGag('stick');
  }
  private async dropWood() {
    const s = this.s, st = this.st;
    await st.cut(async () => {
      s.player.animMap = null;
      this.carrying = null;
      st.pose('kneel');
      audio.play('woodCreak', { vol: 0.5 });
      await wait(600);
      st.pose(null);
      this.doneJob('firewood');
      // Aroha lights it the old way
      s.aroha.walkTo(CAMP.fire + 20, 60);
      await wait(1200);
      s.aroha.faceTo(CAMP.fire);
      s.aroha.setAnim('kneel');
      await st.say([
        { who: 'jenna', text: 'I have a lighter! ...It’s full of seawater. I HAD a lighter.', expr: 'grumpy' },
        { who: 'aroha', text: 'Watch. Hard wood, soft wood. Rub a groove, fast, and don’t stop when your arms start crying.', expr: 'serious' },
      ]);
      s.aroha.setAnim('hammer');
      for (let i = 0; i < 4; i++) { audio.play('rustle', { vol: 0.3, pitch: 1.4 }); await wait(350); }
      audio.play('fireLight' as never, { vol: 0.7 });
      for (let i = 0; i <= 10; i++) { this.fire = i / 10; await wait(80); }
      s.aroha.setAnim('idle');
      await st.say([
        { who: 'mori', text: 'Fire. Actual fire. From STICKS.', expr: 'excited', react: 'bounce' },
        { who: 'aroha', text: 'Kia ora, ahi. Welcome, fire.', expr: 'happy' },
        { who: 'joshu', text: 'Now that is a proper galley. Leave the cooking to me.', expr: 'happy' },
      ]);
      s.joshu.walkTo(CAMP.cook - 22, 36, 'limp').then(() => { s.joshu.facing = 1; s.joshu.idleAnim = 'cook'; s.joshu.setAnim('cook'); });
      s.aroha.walkTo(CAMP.lean - 10, 60).then(() => { s.aroha.idleAnim = 'pick'; s.aroha.setAnim('pick'); });
    });
    this.afterJob();
  }

  private async pickCrate() {
    const s = this.s;
    s.player.poseOverride = 'grab';
    audio.play('woodCreak', { vol: 0.5, pitch: 1.2 });
    await wait(500);
    s.player.poseOverride = null;
    this.carrying = 'crate';
    s.player.animMap = { idle: 'carryHeavy', walk: 'carryHeavy', run: 'carryHeavy' };
    s.player.speedK = 0.6;
    if (this.crates === 0) s.bark('jenna', 'That one’s the good stuff! Tarps, rope, first aid, and Dad’s biscuits. Handle with love!', { expr: 'excited' });
  }
  private async dropCrate() {
    const s = this.s, st = this.st;
    s.player.animMap = null;
    s.player.speedK = 0.9;
    this.carrying = null;
    st.pose('kneel');
    audio.play('woodCreak', { vol: 0.6, pitch: 0.8 });
    await wait(500);
    st.pose(null);
    this.crates++;
    if (this.crates === 1) await this.chunkGag('crate');
    if (this.crates >= 2) {
      this.doneJob('supplies');
      await st.say([
        { who: 'mori', text: 'First-aid kit, water bottles, rope, both tarps, the fishing gear. Sorted, stacked and labelled.', expr: 'determined' },
        { who: 'jenna', text: 'LABELLED. He labelled them. With a label maker he rescued from a shipwreck. I’m so proud.', expr: 'excited' },
      ]);
      this.afterJob();
    }
  }

  private async pitchTent() {
    const s = this.s, st = this.st;
    await st.cut(async () => {
      s.joshu.walkTo(CAMP.tent + 26, 40, 'limp');
      await st.say([
        { who: 'joshu', text: 'Hold the poles, I’ll bang the pegs. Steady now... steady...', expr: 'neutral' },
      ]);
      s.joshu.facing = -1;
      s.joshu.setAnim('hammer');
      const { holdSteady } = await import('./islearoha');
      st.pose('grab');
      const ok = await holdSteady('Hold the tent pole steady', 'Press <span class="key">Space</span> as the pole comes upright. Three pegs!');
      st.pose(null);
      s.joshu.setAnim('idle');
      this.doneJob('tent');
      await st.say([
        { who: 'joshu', text: ok ? 'Tight as a drum. You’ve done this before.' : 'Bit wonky. She’ll hold. Probably. Don’t sneeze near it.', expr: ok ? 'happy' : 'teasing' },
        { who: 'jenna', text: 'Dibs on the side without the rock under it!', expr: 'excited' },
      ]);
      await this.chunkGag('tent');
    });
    this.afterJob();
  }

  private async research() {
    const s = this.s, st = this.st;
    await st.cut(async () => {
      st.pose('research');
      audio.play('jarClink', { vol: 0.5 });
      await wait(900);
      st.pose('type');
      await wait(700);
      st.pose(null);
      this.doneJob('research');
      this.laptopOn = true;
      this.lanternOn = true;
      audio.play('lanternOn' as never, { vol: 0.5 });
      await st.say([
        { who: 'mori', text: 'Microscope: sandy but alive. Sample jars: sorted. Field notebook: damp, but legible. Laptop...', expr: 'thinking' },
        { who: 'mori', text: '...boots up! Eleven percent battery and a wallpaper full of sand. Best day ever.', expr: 'excited', react: 'bounce' },
        { who: 'mori', text: 'Specimen station for the kawakawa and the flint. And the warm stone goes in its own jar. Far away from the fire.', expr: 'serious' },
      ]);
    });
    this.afterJob();
  }

  private async rack() {
    const s = this.s, st = this.st;
    await st.cut(async () => {
      s.aroha.walkTo(CAMP.rack + 22, 60);
      await st.say([
        { who: 'aroha', text: 'Drying rack. Two frames, one bar. I’ll show you the lashing: over, under, around, pull tight.', expr: 'serious' },
      ]);
      s.aroha.facing = -1;
      const { lashingKnot } = await import('./islearoha');
      st.pose('build');
      const ok = await lashingKnot();
      st.pose(null);
      this.doneJob('rack');
      await st.say([
        { who: 'aroha', text: ok ? 'Tika. Good. My koro would say you have clever hands.' : 'Loose. But it’s standing. We’ll fix it tomorrow.', expr: ok ? 'happy' : 'teasing' },
      ]);
      await this.chunkGag('rack');
      s.aroha.walkTo(CAMP.lean - 10, 60).then(() => s.aroha.setAnim('pick'));
    });
    this.afterJob();
  }

  private async chunkBed() {
    const s = this.s, st = this.st, c = s.chunk;
    await st.cut(async () => {
      st.pose('kneel');
      await wait(800);
      st.pose(null);
      this.doneJob('bed');
      s.buddy.mode = 'script';
      await st.say([{ who: 'mori', text: 'A crate, the orange blanket, right next to the fire. Chunk! Your royal bed awaits.', expr: 'happy' }]);
      c.walkTo(CAMP.bed, 60);
      await wait(1100);
      c.play('circle', 'idle').catch(() => {});
      await wait(1200);
      c.setAnim('sniff');
      await wait(800);
      c.walkTo(CAMP.bag + 4, 60);
      await wait(1000);
      c.setAnim('lie');
      await st.say([
        { who: 'chunk', text: '*flop*', expr: 'happy', close: false },
        { who: 'mori', text: 'That’s MY sleeping spot. The bed is RIGHT THERE.', expr: 'grumpy' },
        { who: 'aroha', text: 'He has chosen. You don’t argue with a chief.', expr: 'teasing' },
      ]);
      c.setAnim('idle');
      st.chunkFollow();
    });
    this.afterJob();
  }

  /** Chunk being Chunk while everyone works */
  private async chunkGag(kind: 'stick' | 'crate' | 'tent' | 'rack') {
    const s = this.s, st = this.st, c = s.chunk;
    s.buddy.mode = 'script';
    if (kind === 'stick') {
      c.walkTo(s.player.x + 20, 90, 'run');
      await wait(700);
      c.play('beg', 'idle').catch(() => {});
      await st.say([{ who: 'chunk', text: 'Boof! *wants the stick*', expr: 'excited' }, { who: 'mori', text: 'This is firewood, not a fetch stick. ...Fine. ONE throw.', expr: 'teasing' }]);
      c.walkTo(s.player.x + 140, 150, 'zoom');
      await wait(900);
      c.play('faceplant', 'idle').catch(() => {});
      await wait(800);
    } else if (kind === 'crate') {
      c.walkTo(CAMP.storage + 18, 70);
      await wait(800);
      c.setAnim('bellyUp');
      await st.say([
        { who: 'mori', text: 'Chunk. The second crate goes exactly where you are lying.', expr: 'grumpy' },
        { who: 'chunk', text: '...', expr: 'derp', close: false, auto: 900 },
        { who: 'jenna', text: 'He’s helping! He’s holding the spot! ...He’s asleep.', expr: 'laugh' },
      ]);
      c.setAnim('idle');
    } else if (kind === 'tent') {
      c.walkTo(CAMP.tent + 8, 90);
      await wait(700);
      c.setAnim('dig');
      await st.say([
        { who: 'joshu', text: 'Oi! OI! He’s digging up my pegs!', expr: 'angry' },
        { who: 'chunk', text: '*proudly trots off with a tent peg*', expr: 'happy', close: false },
        { who: 'jenna', text: 'CHUNK! Drop it! DROP IT! That’s a load-bearing peg!', expr: 'shocked', style: 'shout' },
      ]);
      c.walkTo(CAMP.tent - 160, 150, 'zoom');
      s.jenna.walkTo(CAMP.tent - 140, 110, 'run');
      await wait(1500);
      await st.say([{ who: 'jenna', text: 'Got it! Got... ew. It’s wet. Why is it wet.', expr: 'grumpy' }]);
      s.jenna.walkTo(CAMP.elec + 18, 90).then(() => { s.jenna.facing = -1; s.jenna.setAnim('wrench'); });
    } else {
      c.walkTo(CAMP.rack - 6, 80);
      await wait(700);
      c.play('jump', 'idle').catch(() => {});
      await st.say([
        { who: 'aroha', text: 'Kāo! No! That fish is for people!', expr: 'angry', style: 'shout' },
        { who: 'chunk', text: '*very small, very fake sneeze*', expr: 'sad', close: false },
        { who: 'aroha', text: '...Don’t look at me with those eyes. Fine. ONE little bit of skin.', expr: 'teasing' },
      ]);
    }
    st.chunkFollow();
  }

  private afterJob() {
    const s = this.s, st = this.st;
    const n = this.jobs();
    if (n === 3 && !this.bulbs[0].on) {
      void (async () => {
        await wait(600);
        await st.say([{ who: 'jenna', text: 'Everybody look at the poles! Three... two... one... LIGHTS!', expr: 'excited', style: 'shout' }]);
        for (const b of this.bulbs) { b.on = true; audio.play('bubblePop' as never, { vol: 0.15, pitch: 1.5 + rand.next() }); await wait(70); }
        await st.say([
          { who: 'mori', text: 'Jenna, that’s... that’s actually beautiful.', expr: 'happy' },
          { who: 'jenna', text: 'I know. I’m a genius. Salvaged battery, two strings of fairy lights from my cabin, zero fire hazards. Probably.', expr: 'smug' },
        ]);
      })();
    }
    if (n >= 6) void this.dinner();
  }

  // ---------------------------------------------------------------- dinner
  async dinner() {
    const s = this.s, st = this.st, F = game.save.flags;
    if (F['v4:dinner']) return;
    await wait(800);
    await st.cut(async () => {
      s.hud?.show(false);
      await st.say([{ who: 'joshu', text: 'Grub’s up! Mussel and fish stew, pipi on the side, sand for seasoning.', expr: 'happy', style: 'shout' }]);
      await st.fadeOut(1);
      game.save.flags['v4:campDone'] = true;
      s.clock.set(3.72);
      s.clock.target = 3.9;
      s.clock.rate = 0.004;
      this.fire = 1;
      for (const b of this.bulbs) b.on = true;
      // everyone round the fire
      const seat = (a: ReturnType<typeof s.actor>, x: number, f: number, anim = 'sit') => { st.place(a, x, f, anim); };
      s.player.x = CAMP.benchL + 8; s.player.y = groundY(s.player.x); s.player.facing = 1;
      st.pose('sit');
      seat(s.jenna, CAMP.benchL - 14, 1);
      seat(s.joshu, CAMP.benchR + 30, -1);
      seat(s.aroha, CAMP.benchR + 6, -1);
      s.buddy.mode = 'script';
      st.place(s.chunk, CAMP.fire - 16, 1, 'beg');
      const c = s.st.cam;
      c.locked = true;
      c.x = CAMP.fire; c.y = groundY(CAMP.fire) - 34; c.zoom = 1.6;
      audio.setMusic('camp' as never);
      await wait(300);
      await st.fadeIn(0.8);
      s.jenna.setAnim('eat'); s.joshu.setAnim('eat'); s.aroha.setAnim('eat');
      st.pose('eat');
      await st.say([
        { who: 'mori', text: 'Joshu. This is the best thing I have ever eaten.', expr: 'excited' },
        { who: 'joshu', text: 'You say that about instant noodles.', expr: 'teasing' },
        { who: 'mori', text: 'And I MEAN it every time.', expr: 'happy' },
        { who: 'aroha', text: 'Kawakawa tea. Drink it all. It’s good for the belly after the sea gets inside you.', expr: 'happy' },
        { who: 'jenna', text: 'It tastes like a forest. Like a nice forest. A forest that’s trying its best.', expr: 'thinking' },
        { who: 'aroha', text: '...That’s the nicest thing anyone has said about my tea.', expr: 'laugh' },
      ]);
      s.chunk.setAnim('beg');
      await st.say([
        { who: 'chunk', text: '...', expr: 'excited', close: false, auto: 1000 },
        { who: 'joshu', text: 'Don’t you dare. You ate a whole crate of dog food this morning. I SAW the cans.', expr: 'grumpy' },
        { who: 'chunk', text: '*the quietest, saddest whine ever recorded*', expr: 'sad', close: false },
        { who: 'jenna', text: 'He’s so dramatic. I love him. I would die for him. He’s getting nothing.', expr: 'laugh' },
      ]);
      const ch = await st.say([{ who: 'aroha', text: 'So. Mori. What kind of scientist gets chased down a beach by a seal?', expr: 'teasing', choices: ['A very fast one.', 'It was a STRATEGIC retreat.', 'Chunk woke it up! This is on Chunk!'] }]);
      const reply = [
        [{ who: 'aroha', text: 'Not fast enough. I saw the prints. You tripped twice.', expr: 'laugh' }],
        [{ who: 'joshu', text: 'Strategic! Ha! That’s what I said about my first marriage proposal.', expr: 'bellyLaugh' as never }],
        [{ who: 'jenna', text: 'CHUNK. Is this true?!', expr: 'shocked' }, { who: 'chunk', text: '*pretends to be asleep*', expr: 'sleep', close: false }],
      ][Math.max(0, ch)];
      await st.say(reply.map(l => ({ ...l, expr: l.expr === 'bellyLaugh' ? 'laugh' : l.expr })) as never);
      s.joshu.play('bellyLaugh', 'sit').catch(() => {});
      s.jenna.play('laugh', 'sit').catch(() => {});
      s.aroha.play('laugh', 'sit').catch(() => {});
      await st.say([
        { who: 'aroha', text: 'Those seals... we call them kekeno pango. The black ones. They only come ashore here, on this island.', expr: 'serious' },
        { who: 'mori', text: 'Only here? Then my photo is the first one. Ever.', expr: 'excited', emote: 'sparkle' },
        { who: 'aroha', text: 'The first photo taken by someone running away, definitely.', expr: 'teasing' },
        { who: 'joshu', text: 'Here’s to the Kittiwake. Best ship I ever had. She got us all here, every one of us, even the pug.', expr: 'sad' },
        { who: 'jenna', text: 'To the Kittiwake.', expr: 'sad' },
        { who: 'mori', text: 'To the Kittiwake.', expr: 'neutral' },
        { who: 'aroha', text: '...And to new friends. Even the ones who bring dogs.', expr: 'happy' },
        { who: 'jenna', text: 'AROHA. That was so wholesome. I’m going to cry into my stew.', expr: 'excited' },
      ]);
      s.jenna.setAnim('sit'); s.joshu.setAnim('sit'); s.aroha.setAnim('sit');
      st.pose(null);
      st.set('v4:dinner');
      c.locked = false;
      s.hud?.show(true);
      this.nightMode();
      s.bark('joshu', 'Right. Bowls in the tub, then bed, the lot of you. Big day tomorrow.', { expr: 'neutral' });
    });
  }

  // ---------------------------------------------------------------- night
  nightMode(done = false) {
    const s = this.s, st = this.st;
    this.campMode();
    s.clock.set(Math.max(s.clock.t, 3.85));
    s.clock.target = 3.95;
    this.fire = done ? 0.3 : 1;
    for (const b of this.bulbs) b.on = !done;
    this.lanternOn = !done;
    this.laptopOn = false;
    if (done) {
      for (const a of [s.jenna, s.joshu, s.aroha]) st.hide(a);
      s.buddy.mode = 'script';
      st.place(s.chunk, CAMP.bag + 6, 1, 'sleep', undefined);
      s.chunk.setExpr('sleep');
      return;
    }
    st.place(s.jenna, CAMP.benchL - 14, 1, 'sit');
    st.place(s.joshu, CAMP.benchR + 30, -1, 'sit');
    st.place(s.aroha, CAMP.benchR + 6, -1, 'sit');
    audio.setMusic('night' as never);
  }

  /** night cleanup, lights off one by one, everyone to bed, Chunk squeezes in... Day 1 Complete */
  async lightsOut() {
    const s = this.s, st = this.st, c = s.chunk, p = s.player;
    await st.cut(async () => {
      s.hud?.show(false);
      // tidy up
      st.pose('sweep');
      audio.play('jarClink', { vol: 0.4 });
      await wait(1100);
      st.pose(null);
      await st.say([{ who: 'mori', text: 'Bowls rinsed. Samples labelled. Warm stone still in its jar, glowing at me. Okay. Goodnight, weird rock.', expr: 'tired' }]);
      const cam = s.st.cam;
      cam.locked = true;
      cam.x = 1990; cam.y = groundY(1990) - 50; cam.zoom = 1.12;
      // Mori's laptop and the lantern
      p.x = CAMP.research - 16; p.y = groundY(p.x); p.facing = 1;
      st.pose('type');
      await wait(600);
      this.laptopOn = false;
      audio.play('ui', { vol: 0.3, pitch: 0.6 });
      await wait(500);
      this.lanternOn = false;
      audio.play('lanternOn' as never, { vol: 0.35, pitch: 0.7 });
      st.pose(null);
      await st.say([{ who: 'aroha', text: 'Pō mārie, everyone. Good night.', expr: 'happy', close: false, auto: 1500 }]);
      s.aroha.walkTo(CAMP.lean, 50).then(() => { s.aroha.setAnim('lieDown'); });
      // Jenna turns off the string lights one by one
      s.jenna.walkTo(CAMP.pole0 + 8, 70).then(() => s.jenna.setAnim('wrench'));
      await wait(1500);
      await st.say([{ who: 'jenna', text: 'Night, Dad. Night, Mori. Night, Aroha. Night, Chunk. Night, Kevin the crab.', expr: 'tired', close: false, auto: 1800 }]);
      for (let i = this.bulbs.length - 1; i >= 0; i--) { this.bulbs[i].on = false; audio.play('ui', { vol: 0.08, pitch: 2.2 }); await wait(160); }
      s.jenna.walkTo(CAMP.tent, 50).then(() => { s.jenna.visible = false; });
      // Joshu banks the fire
      s.joshu.walkTo(CAMP.fire + 16, 34, 'limp');
      await wait(1400);
      s.joshu.faceTo(CAMP.fire);
      s.joshu.setAnim('kneel');
      for (let i = 10; i >= 3; i--) { this.fire = i / 10; await wait(160); }
      s.joshu.setAnim('idle');
      await st.say([
        { who: 'joshu', text: 'Mori.', expr: 'neutral', close: false },
        { who: 'joshu', text: 'You did good today, son. Real good.', expr: 'happy', close: false, auto: 2200 },
      ]);
      s.joshu.walkTo(CAMP.tent + 4, 30, 'limp').then(() => { s.joshu.visible = false; });
      await wait(1500);
      // Mori crawls into his sleeping bag by the embers
      p.x = CAMP.bag; p.y = groundY(p.x); p.facing = 1;
      this.inBag = true;
      st.pose('sleepBag');
      p.body.setExpr('tired');
      cam.x = CAMP.bag + 6; cam.y = groundY(CAMP.bag) - 20;
      for (let i = 0; i < 40; i++) { cam.zoom = 1.12 + (i / 40) * 0.8; await wait(30); }
      // Chunk circles... and circles... and squeezes in
      s.buddy.mode = 'script';
      st.place(c, CAMP.bag + 24, -1, 'idle');
      await wait(400);
      for (let i = 0; i < 3; i++) await c.play('circle', 'idle');
      await st.say([{ who: 'mori', text: '...Chunk. There’s a whole bed. Right there. With a blanket.', expr: 'tired', close: false }]);
      c.walkTo(CAMP.bag + 8, 30);
      await wait(700);
      c.play('lieDown', 'sleep').catch(() => {});
      c.react('shrink');
      await wait(900);
      c.setExpr('sleep');
      await st.say([
        { who: 'chunk', text: '*wriggles right up against Mori, puffer jacket and all*', expr: 'happy', close: false },
        { who: 'mori', text: '...fine. You win. You’re warm, anyway.', expr: 'happy', close: false },
        { who: 'mori', text: 'Goodnight, buddy.', expr: 'sleep', close: false, auto: 2000 },
        { who: 'chunk', text: 'Hnnnnk... shnrrrk... hnnnnk...', expr: 'sleep', close: false, auto: 2600 },
      ]);
      p.body.setExpr('sleep');
      st.set('v4:day1');
      for (let i = 0; i < 60; i++) { cam.zoom += 0.004; cam.y -= 0.3; await wait(40); }
      await game.fadeTo(1, 0.25);
      await showDayComplete();
    });
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    const s = this.s, F = game.save.flags;
    this.npcT -= dt;
    this.chunkGagT -= dt;
    this.nagT -= dt;
    // back at the wreck with Joshu: only once the gathering is done
    if (F['v4:joshuAwake'] && !F['v4:back'] && !s.cutscene && !game.ui.blocking && s.player.x < 2440) {
      if (this.gatherDone()) { this.st.set('v4:back'); void runStandoff(this.st); }
      else if (this.nagT <= 0) { this.nagT = 18; s.bark('joshu', `Not yet, lad. We still need ${this.missing()}. The camp can wait five minutes.`, { expr: 'serious' }); }
    }
    // campers go about their jobs (small fidgets so camp feels alive)
    if (F['v4:arohaJoined'] && !F['v4:campDone'] && this.npcT <= 0 && !s.cutscene) {
      this.npcT = rand.range(5, 9);
      const a = s.aroha;
      if (a.visible && !a.walking && rand.chance(0.6)) {
        const to = rand.chance(0.5) ? CAMP.rack + 30 : CAMP.lean - 10;
        a.walkAnim = 'carry';
        a.walkTo(to, 44, 'carry').then(() => { a.walkAnim = 'walk'; a.setAnim(to === CAMP.lean - 10 ? 'pick' : 'build'); });
      }
      if (s.jenna.visible && !s.jenna.walking && rand.chance(0.4)) s.jenna.play(rand.pick(['typeFast', 'fingerGuns', 'hype']), 'wrench').catch(() => {});
    }
    void this.chunkGagT; void clamp; void ISL; void local; void (null as unknown as Frame);
  }
}

/** the end card: Day 1 Complete, a little summary, back to the title */
async function showDayComplete() {
  const { el } = await import('../../ui/ui');
  const v = (k: string) => game.save.vars[k] ?? 0;
  const photos = Object.keys(game.save.flags).filter(k => k.startsWith('v4:photo:')).length;
  const card = el('div', 'd1-card', `
    <style>
      .d1-card { position:absolute; inset:0; z-index:40; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#05060c;
        color:#f4ecd8; font-family:'Jersey 15', 'Pixelify Sans','Jersey 10', 'Silkscreen',monospace; text-align:center; animation:d1in 2.4s ease-out both; }
      @keyframes d1in { from { opacity:0 } }
      .d1-card .t { font-family:'Jersey 10', 'Silkscreen',monospace; font-size:clamp(26px,5vw,54px); letter-spacing:0.08em; color:#ffe6a8; text-shadow:0 0 18px rgba(255,190,90,0.45); animation:d1rise 3s ease-out both; }
      @keyframes d1rise { from { transform:translateY(12px); opacity:0 } }
      .d1-card .s { margin-top:0.6em; font-size:clamp(13px,1.8vw,18px); opacity:0.8; animation:d1in 3s 1.2s ease-out both; }
      .d1-card .st { margin-top:1.4em; display:flex; gap:1.6em; flex-wrap:wrap; justify-content:center; font-size:clamp(12px,1.6vw,16px); animation:d1in 2s 2.2s ease-out both; }
      .d1-card .st b { display:block; font-size:1.6em; color:#9ee6c8; }
      .d1-card button { margin-top:2em; animation:d1in 2s 3s ease-out both; }
    </style>
    <div class="t">Day 1 Complete</div>
    <div class="s">Four castaways, one pug, one camp on the edge of a very big island.</div>
    <div class="st"><div><b>${photos}</b>species photographed</div><div><b>${v('v4:fishCaught')}</b>fish caught</div><div><b>${v('v4:campJobs')}</b>camp jobs done</div><div><b>1</b>seal outrun (eventually)</div></div>
    <button class="btn">Back to the title</button>`);
  game.ui.modalLayer.appendChild(card);
  game.ui.modalOpen++;
  game.persist();
  await new Promise<void>(res => card.querySelector('button')!.addEventListener('click', () => res(), { once: true }));
  game.ui.modalOpen = Math.max(0, game.ui.modalOpen - 1);
  card.remove();
  const { goTitle } = await import('../scenes/flow');
  goTitle();
}

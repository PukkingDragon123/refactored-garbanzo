// V10 camp life: while the story doesn't need them, Jenna, Joshu and Aroha live their day at the beach
// camp. Each has a little brain (the crew-life style of src/game/v9/crewlife.ts, on one level): it
// picks an activity, walks there, does it for a while and picks the next.
//
//  Jenna  tinkers at her tech bench (soldering sparks, typing, hammering), fiddles with the battery
//         bank in her corner, raids Joshu's cooler for a snack, puts her headphones on and dances on
//         the log bench, checks the radio on the laptop, gives Chunk a scratch
//  Joshu  cooks at his bench, fishes off the rocks (when Mori isn't), carves driftwood on the log
//         bench, tends the smoker at the drying rack, has a mug of tea by the fire; limps the first
//         couple of days
//  Aroha  weaves flax under her lean-to, sharpens her tools, stands at the edge of camp watching the
//         forest, practises with her slingshot, turns the fish on the drying rack, gathers along the
//         tide line
//
// In the evening they drift toward the fire; after dinner they sit round it. A brain pauses on the spot
// whenever a cutscene, a dialogue or an interaction runs, and if the story moved someone meanwhile it
// drops what it was doing. `hold(id)` hands a character to the story until `release(id)`.

import { game } from '../game';
import type { Actor } from '../../world/actor';
import { rand } from '../../core/math';
import { audio } from '../../core/audio';
import { A } from '../assets';
import { groundY } from '../../art/island4/layout';
import { CAMP } from '../v4/islecamp';
import type { IslandScene4 } from '../v4/island';
import { dayNumber, dayState } from './day';
import type { Crew } from './day';
import { setCarry, carryOf } from '../v11/carry';
import type { CarryKind, CarryOpts } from '../v11/carry';

/** where things are at camp (the Day 1 layout plus the V10 props) */
export const C10 = {
  ...CAMP,
  rock: 1392, bench: 1650, board: 2226, sign: 2420, tent: 1788, target: 2532, watch: 2470,
  /** where everyone sits round the fire */
  seats: { mori: CAMP.benchL + 8, jenna: CAMP.benchL - 14, joshu: CAMP.benchR + 30, aroha: CAMP.benchR + 6 } as Record<string, number>,
};

class Abort extends Error {}
interface Waiter { done: () => boolean; res: () => void; rej: (e: unknown) => void }

export interface CrewHost {
  s: IslandScene4;
  /** the crew are held by the story (cutscene staging) */
  held: Set<string>;
  /** Mori is fishing off the rock (Joshu keeps away) */
  fishing: boolean;
}

abstract class Brain {
  t = 0;
  private waiters: Waiter[] = [];
  private walkX: number | null = null;
  private walkSpeed = 36;
  private walkAnim = 'walk';
  private paused = false;
  private snap: { x: number; idle: string } | null = null;
  private running = false;
  private wasOff = true;
  dead = false;
  protected myIdle = '';
  /** what they're doing (for the talk system: "What are you up to?") */
  doing = '';

  constructor(readonly h: CrewHost, readonly a: Actor, readonly id: Crew) {}
  get s() { return this.h.s; }
  /** daytime routine, the evening one, and the night (sitting at the fire) */
  protected abstract day(): Promise<void>;
  protected abstract evening(): Promise<void>;
  protected cleanup() { this.a.setExpr('neutral'); }

  off() { return this.h.held.has(this.id) || !this.a.visible; }

  start() {
    if (this.running) return this;
    this.running = true;
    void this.loop();
    return this;
  }
  private async loop() {
    while (!this.dead) {
      try {
        await this.until(() => !this.off());
        const ph = dayState().phase;
        if (ph === 'night') await this.night();
        else if (ph === 'evening' || this.s.clock.t > 2.75) await this.evening();
        else await this.day();
      } catch (e) {
        if (!(e instanceof Abort)) { console.warn('[campcrew]', e); await new Promise(r => setTimeout(r, 1000)); }
      }
    }
  }

  // ---------------------------------------------------------------- primitives
  protected until(done: () => boolean): Promise<void> {
    if (done()) return Promise.resolve();
    return new Promise((res, rej) => this.waiters.push({ done, res, rej }));
  }
  protected wait(sec: number) {
    const end = this.t + sec;
    return this.until(() => this.t >= end);
  }
  protected pose(anim: string) {
    this.a.idleAnim = anim;
    this.myIdle = anim;
    this.a.setAnim(anim);
  }
  protected async once(anim: string) {
    const a = this.a;
    let over = false;
    void a.play(anim, a.idleAnim).then(() => { over = true; });
    await this.until(() => over || a.anim !== anim);
  }
  get gait() { return this.id === 'joshu' && dayNumber() <= 3 ? 'limp' : 'walk'; }
  protected async walk(x: number, speed = this.id === 'joshu' && dayNumber() <= 3 ? 30 : 42) {
    x = Math.max(1380, Math.min(2600, x));
    if (Math.abs(this.a.x - x) < 1.5) return;
    this.walkX = x;
    this.walkSpeed = speed;
    this.walkAnim = this.gait;
    if (this.a.idleAnim !== 'idle') this.pose('idle');
    void this.a.walkTo(x, speed, this.walkAnim);
    await this.until(() => this.walkX === null || (Math.abs(this.a.x - x) < 1.5 && !this.a.walking));
    this.walkX = null;
  }
  /** walk somewhere carrying something real (v11/carry.ts), and put it down there */
  protected async carryTo(kind: CarryKind, x: number, o?: CarryOpts) {
    setCarry(this.a, kind, o);
    try { await this.walk(x); } finally { if (carryOf(this.a) === kind) setCarry(this.a, null); }
  }
  protected bark(text: string, o: { expr?: string; emote?: string } = {}) {
    if (!this.nearPlayer(200) || game.ui.bubbles.active) return;
    this.s.bark(this.id, text, o);
  }
  protected nearPlayer(d = 160) {
    const p = this.s.player;
    return Math.abs(p.x - this.a.x) < d && Math.abs(p.y - this.a.y) < 40;
  }
  protected sparks(x: number, y: number, n = 4, col: [number, number, number] = [1, 0.8, 0.4]) {
    for (let i = 0; i < n; i++) this.s.main.glowParticles.spawn({ frame: A.dot, x, y, vx: rand.range(-30, 30), vy: rand.range(-50, -15), ay: 160, life: rand.range(0.25, 0.5), color: col, alpha: 1, alpha1: 0, glow: true, intensity: 2.5 });
  }
  protected chips(x: number, y: number, n = 3) {
    for (let i = 0; i < n; i++) this.s.main.particles.spawn({ frame: A.dot2, x, y, vx: rand.range(-25, 25), vy: rand.range(-40, -10), ay: 220, life: 0.8, color: [0.85, 0.75, 0.55], alpha: 1, alpha1: 0, floorY: groundY(x) + 2 });
  }
  /** sit at your place by the fire */
  protected async toSeat() {
    const x = C10.seats[this.id];
    await this.walk(x);
    this.a.facing = this.id === 'jenna' ? 1 : -1;
    this.pose('sit');
  }
  /** after dinner: round the fire, now and then a laugh, a stretch, a line */
  protected async night() {
    await this.toSeat();
    this.doing = 'by the fire';
    await this.wait(8 + rand.next() * 10);
    const r = rand.next();
    if (r < 0.3) await this.once('laugh');
    else if (r < 0.45) { this.a.setExpr('tired', 3); }
    else if (r < 0.6) this.bark(rand.pick(NIGHT_BARKS[this.id]), { expr: 'happy' });
  }

  // ---------------------------------------------------------------- per frame
  private blocked() {
    const s = this.s as unknown as { cutscene: boolean; busyAction?: boolean };
    return s.cutscene || !!s.busyAction || game.ui.blocking;
  }
  update(dt: number) {
    const a = this.a;
    if (this.off()) {
      if (!this.wasOff) { this.wasOff = true; this.paused = false; this.snap = null; this.abort(); }
      return;
    }
    if (this.wasOff) { this.wasOff = false; this.abort(); }
    const block = this.blocked();
    if (!this.paused && block) {
      this.paused = true;
      this.snap = { x: a.x, idle: a.idleAnim };
      if (this.walkX !== null || a.walking) { a.stopWalk(); if (a.anim === 'walk' || a.anim === 'limp' || a.anim === a.mapped('walk')) a.setAnim('idle'); }
    }
    if (this.paused && !block) {
      const sn = this.snap!;
      const moved = Math.abs(a.x - sn.x) > 2 || a.idleAnim !== sn.idle;
      this.paused = false;
      this.snap = null;
      if (moved) this.abort();
      else if (this.walkX !== null) void a.walkTo(this.walkX, this.walkSpeed, this.walkAnim);
    }
    if (this.paused) return;
    this.t += dt;
    if (this.waiters.length) {
      const ready = this.waiters.filter(w => w.done());
      if (ready.length) {
        this.waiters = this.waiters.filter(w => !ready.includes(w));
        for (const w of ready) w.res();
      }
    }
  }
  abort() {
    const ws = this.waiters;
    this.waiters = [];
    this.walkX = null;
    if (carryOf(this.a)) setCarry(this.a, null);
    this.cleanup();
    for (const w of ws) w.rej(new Abort());
  }
  stop() { this.dead = true; this.abort(); }
}

const NIGHT_BARKS: Record<Crew, string[]> = {
  jenna: ['The stars here are RIDICULOUS.', 'Marshmallows. I would trade Dad for marshmallows.', 'Mmm. Fire. Warm. Good.'],
  joshu: ['Fair breeze tonight.', 'Ahh. That’s the stuff.', 'Southern Cross, right there. Old friend.'],
  aroha: ['Listen. Kororā, coming home.', 'Mm. Matariki will rise soon.', 'The fire likes driftwood. It sings.'],
};

// ------------------------------------------------------------------ Jenna
const JTYPE = ['Come onnn, compile...', 'Ha! Gotcha, little bug.', 'Why is it doing THAT.', 'Semicolon. It was a semicolon.', 'Solder. Solder solder solder.'];
const JHUM = ['♪ Hm hm hmmm... ♪', '♪ Doo-doo, da-daa... ♪', '♪ Nnn-tss, nnn-tss... ♪'];
class JennaBrain extends Brain {
  private lastPet = -999;
  protected cleanup() {
    if (this.a.outfit === 'shipPhones') this.a.outfit = 'ship';
    this.a.oy = 0;
    this.a.setExpr('neutral');
  }
  private phones(on: boolean) {
    const o = this.a.outfit;
    if (on && o === 'ship') this.a.outfit = 'shipPhones';
    else if (!on && o === 'shipPhones') this.a.outfit = 'ship';
  }
  protected async day() {
    const c = this.s.chunk, b = this.s.buddy;
    if (this.t - this.lastPet > 80 && b?.mode === 'wander' && !c.walking && Math.abs(c.x - this.a.x) < 70) { this.lastPet = this.t; await this.pet(); return; }
    const r = rand.next();
    if (r < 0.45) await this.bench();
    else if (r < 0.6) await this.corner();
    else if (r < 0.72) await this.snack();
    else if (r < 0.86) await this.music();
    else await this.radio();
  }
  protected async evening() {
    const r = rand.next();
    if (r < 0.4) await this.bench(true);
    else if (r < 0.75) await this.music();
    else await this.radio();
  }
  private async bench(short = false) {
    const a = this.a;
    this.doing = 'tinkering at her bench';
    if (!short && rand.next() < 0.3) await this.carryTo('crate', C10.bench + 22);
    else await this.walk(C10.bench + 22);
    a.facing = -1;
    const n = short ? 1 : 2 + Math.floor(rand.next() * 2);
    for (let i = 0; i < n; i++) {
      const k = rand.next();
      if (k < 0.4) {
        // soldering: little sparks off the iron
        this.pose('wrench');
        for (let j = 0; j < 6; j++) { await this.wait(0.7 + rand.next()); this.sparks(C10.bench + 14, groundY(C10.bench) - 22, 3); if (rand.next() < 0.4) audio.play('scanBeep', { vol: 0.05, pitch: 2 }); }
      } else if (k < 0.75) { this.pose('typeFast'); await this.wait(6 + rand.next() * 5); }
      else { this.pose('hammer'); for (let j = 0; j < 4; j++) { await this.wait(0.6); if (this.nearPlayer(220)) audio.play('hammer', { vol: 0.12, pitch: 1.5 }); } }
      const q = rand.next();
      if (q < 0.25) this.bark(rand.pick(JTYPE), { expr: 'happy' });
      else if (q < 0.4) { a.setExpr('tired', 3); await this.once('yawn'); }
    }
  }
  private async corner() {
    this.doing = 'fiddling with the battery bank';
    await this.walk(C10.elec + 18);
    this.a.facing = -1;
    this.pose('kneel');
    await this.wait(7 + rand.next() * 5);
    if (rand.next() < 0.5) this.bark(rand.pick(['Battery at sixty percent. The sun likes us today.', 'Kevin. KEVIN. Out of the fuse box.', 'Panel’s dusty. Panel is ALWAYS dusty.']), { expr: 'thinking' });
  }
  private async snack() {
    const a = this.a;
    this.doing = 'raiding the cooler';
    await this.walk(C10.cook + 34);
    a.facing = -1;
    this.pose('idle');
    await this.once('grab');
    if (rand.next() < 0.5) this.bark(rand.pick(['Brain food!', 'Don’t tell Dad.', 'Is this... smoked fish? For BREAKFAST? ...yes.']), { expr: 'happy' });
    a.facing = rand.next() < 0.5 ? -1 : 1;
    this.pose('snack');
    a.setExpr('happy');
    await this.wait(9 + rand.next() * 5);
    a.setExpr('neutral');
  }
  private async music() {
    const a = this.a;
    this.doing = 'listening to music';
    await this.walk(C10.seats.jenna);
    a.facing = 1;
    this.phones(true);
    a.setExpr('happy');
    this.pose('musicSit');
    a.showEmote('music', 2);
    const n = 2 + Math.floor(rand.next() * 2);
    for (let i = 0; i < n; i++) {
      await this.wait(6 + rand.next() * 4);
      const r = rand.next();
      if (r < 0.35) { this.pose('dance'); a.showEmote('music', 1.6); await this.wait(5 + rand.next() * 3); this.pose('musicSit'); }
      else if (r < 0.6) this.bark(rand.pick(JHUM), { expr: 'happy', emote: 'music' });
    }
    this.pose('idle');
    this.phones(false);
    a.setExpr('neutral');
  }
  private async radio() {
    this.doing = 'listening to the radio';
    await this.walk(C10.research + 20);
    this.a.facing = -1;
    this.pose('typeFast');
    await this.wait(8 + rand.next() * 6);
    if (rand.next() < 0.5) this.bark(game.save.flags['v10:agency'] ? rand.pick(['Field office, field office... no, that’s static.', 'Weather report says: weather. Thanks, radio.']) : rand.pick(['Static. Static. A whale? No, static.', 'If I just... wiggle this...']), { expr: 'thinking' });
  }
  private async pet() {
    const a = this.a, c = this.s.chunk, b = this.s.buddy;
    this.doing = 'petting Chunk';
    await this.walk(c.x + (a.x < c.x ? -13 : 13), 40);
    const held = b?.mode === 'wander' && Math.abs(c.x - a.x) < 22;
    if (held) { b.mode = 'stay'; c.stopWalk(); c.faceTo(a.x); c.idleAnim = 'sit'; c.setAnim('sit'); }
    try {
      a.faceTo(c.x);
      this.pose('pet');
      a.setExpr('happy');
      this.bark(rand.pick(['Hi, potato! Who’s a good potato?', 'Chunky! Scritches!', 'You smell like a rock pool. I love you.']), { expr: 'happy' });
      c.showEmote('heart', 1.6);
      await this.wait(4);
      this.pose('idle');
    } finally {
      if (held && b.mode === 'stay') b.release();
    }
  }
}

// ------------------------------------------------------------------ Joshu
class JoshuBrain extends Brain {
  protected async day() {
    const r = rand.next();
    if (r < 0.32) await this.cook();
    else if (r < 0.52 && !this.h.fishing) await this.fish();
    else if (r < 0.72) await this.carve();
    else if (r < 0.86) await this.smoker();
    else await this.tea();
  }
  protected async evening() {
    // dinner's on: mostly at the stove
    if (rand.next() < 0.7) await this.cook(true);
    else await this.tea();
  }
  private async cook(dinner = false) {
    const a = this.a;
    this.doing = dinner ? 'cooking dinner' : 'cooking';
    if (dinner && rand.next() < 0.5) {
      // the pot off the fire, carried over by its handles
      await this.walk(C10.fire + 16);
      a.facing = -1;
      await this.once('pick');
      await this.carryTo('pot', C10.cook - 22, { level: 1 });
    } else await this.walk(C10.cook - 22);
    a.facing = 1;
    this.pose('cook');
    for (let i = 0; i < 3; i++) {
      await this.wait(6 + rand.next() * 5);
      if (rand.next() < 0.35) this.bark(rand.pick(dinner ? ['Five minutes! ...Ten. Fifteen tops.', 'Nobody touch the pot.', 'Who ate the last onion. WHO.'] : ['Pipi in garlic. Well. Pipi in pipi.', 'Hand me that... never mind, got it.', 'Salt from the rocks. Best salt there is.']), { expr: 'happy' });
      if (this.nearPlayer(200) && rand.next() < 0.3) audio.play('bubble', { vol: 0.08, pitch: 0.7 });
    }
  }
  private async fish() {
    const a = this.a;
    this.doing = 'fishing off the rocks';
    await this.walk(C10.rock + 6);
    a.facing = -1;
    this.pose('fishWait');
    await this.wait(14 + rand.next() * 10);
    if (rand.next() < 0.35) {
      await this.once('fishReel');
      if (rand.next() < 0.45) {
        // a keeper: held up by the gills all the way to the smoker
        this.bark(rand.pick(['Ha! Now THAT is a fish.', 'Dinner, says hello.', 'Look at the size of him!']), { expr: 'happy' });
        await this.carryTo('fish', C10.rack - 30);
        this.a.facing = 1;
        this.pose('build');
        await this.wait(4);
        return;
      }
      this.bark(rand.pick(['Got one! ...Got a sock.', 'Ha! Tiddler. Back you go.', 'Nibbles. All nibbles, no bites.']), { expr: 'teasing' });
    }
    if (this.h.fishing) return;
    await this.wait(6);
  }
  private async carve() {
    const a = this.a;
    this.doing = 'carving driftwood';
    await this.walk(C10.seats.joshu);
    a.facing = -1;
    this.pose('sit');
    for (let i = 0; i < 4; i++) { await this.wait(3 + rand.next() * 3); this.chips(a.x - 6, a.y - 16, 2); }
    if (rand.next() < 0.4) this.bark(rand.pick(['It’s a whale. Obviously.', 'Every boat needs a figurehead. This one’s Chunk.', 'My old man carved. I mostly whittle.']), { expr: 'happy' });
  }
  private async smoker() {
    this.doing = 'tending the smoker';
    await this.carryTo('firewood', C10.rack - 30, { count: 3 });
    this.a.facing = 1;
    this.pose('build');
    await this.wait(8 + rand.next() * 5);
    if (rand.next() < 0.4) this.bark('Low and slow. Smoke does the work.', { expr: 'neutral' });
  }
  private async tea() {
    this.doing = 'having a cup of tea';
    await this.walk(C10.fire + 22);
    this.a.facing = -1;
    this.pose('sipTea');
    await this.wait(10 + rand.next() * 6);
    if (rand.next() < 0.4) this.bark(rand.pick(['Ahh. Proper tea.', 'Kawakawa. Grows on you. Like a barnacle.']), { expr: 'happy' });
  }
}

// ------------------------------------------------------------------ Aroha
class ArohaBrain extends Brain {
  protected async day() {
    const r = rand.next();
    if (r < 0.26) await this.weave();
    else if (r < 0.44) await this.sharpen();
    else if (r < 0.62) await this.watch();
    else if (r < 0.78) await this.sling();
    else if (r < 0.9) await this.rack();
    else await this.gather();
  }
  protected async evening() {
    const r = rand.next();
    if (r < 0.45) await this.weave();
    else if (r < 0.75) await this.watch();
    else await this.sharpen();
  }
  private async weave() {
    this.doing = 'weaving flax';
    await this.carryTo('flax', C10.lean - 14);
    this.a.facing = 1;
    this.pose('sitGround');
    await this.wait(5);
    for (let i = 0; i < 3; i++) { await this.once('pick'); this.pose('sitGround'); await this.wait(3 + rand.next() * 4); }
    if (rand.next() < 0.4) this.bark(rand.pick(['Over, under. Over, under.', 'A kete for your sample jars. You keep dropping them.', 'My nan could do this with her eyes shut. I can’t.']), { expr: 'happy' });
  }
  private async sharpen() {
    const a = this.a;
    this.doing = 'sharpening her tools';
    await this.walk(C10.lean + 24);
    a.facing = -1;
    this.pose('kneel');
    for (let i = 0; i < 5; i++) {
      await this.wait(1.3 + rand.next());
      this.sparks(a.x - 8, a.y - 8, 2, [1, 0.95, 0.8]);
      if (this.nearPlayer(160)) audio.play('saw', { vol: 0.06, pitch: 2.2 });
    }
    if (rand.next() < 0.4) this.bark(rand.pick(['A blunt knife is a dangerous knife.', 'Pounamu. Greenstone. Older than all of us.']), { expr: 'serious' });
  }
  private async watch() {
    const a = this.a;
    this.doing = 'watching the forest';
    await this.walk(C10.watch);
    a.facing = 1;
    this.pose('armsCrossed');
    await this.wait(9 + rand.next() * 8);
    if (rand.next() < 0.45) this.bark(rand.pick(['Kererū. Up in the canopy. Hear the wings?', 'The bush is quiet today. Too quiet.', 'Smoke on the ranges? ...No. Cloud.']), { expr: 'thinking' });
    await this.once('think');
  }
  private async sling() {
    const a = this.a;
    this.doing = 'slingshot practice';
    await this.walk(C10.target - 76);
    a.facing = 1;
    for (let i = 0; i < 3; i++) {
      this.pose('slingAim');
      await this.wait(1.4 + rand.next());
      await this.once('slingshot');
      this.pose('idle');
      if (this.nearPlayer(240)) audio.play('whoosh', { vol: 0.12, pitch: 1.8 });
      await this.wait(0.35);
      const hit = rand.next() < 0.7;
      if (this.nearPlayer(260)) audio.play(hit ? 'woodCreak' : 'dig', { vol: 0.15, pitch: hit ? 1.6 : 1 });
      this.chips(C10.target, groundY(C10.target) - (hit ? 22 : 2), hit ? 3 : 2);
      if (!hit && rand.next() < 0.4) this.bark('Tch. The wind.', { expr: 'grumpy' });
      await this.wait(1.2);
    }
  }
  private async rack() {
    this.doing = 'turning the fish on the rack';
    await this.carryTo('fish', C10.rack + 28);
    this.a.facing = -1;
    this.pose('build');
    await this.wait(8 + rand.next() * 4);
  }
  private async gather() {
    this.doing = 'gathering on the tide line';
    const x = rand.pick([2330, 2380, 2440, 2500]);
    await this.walk(x);
    this.a.facing = rand.next() < 0.5 ? 1 : -1;
    await this.once('pick');
    await this.wait(3);
    await this.once('pick');
    // the bucket of pipi, sloshing, back to Joshu's bench
    await this.carryTo('bucket', C10.cook + 14, { level: 1 });
    this.a.facing = -1;
    await this.once('pick');
  }
}

// ------------------------------------------------------------------ the crew
export class CampCrew {
  readonly brains: Record<Crew, Brain>;
  constructor(readonly h: CrewHost) {
    const s = h.s;
    this.brains = { jenna: new JennaBrain(h, s.jenna, 'jenna'), joshu: new JoshuBrain(h, s.joshu, 'joshu'), aroha: new ArohaBrain(h, s.aroha, 'aroha') };
  }
  start() { for (const b of Object.values(this.brains)) b.start(); return this; }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    for (const b of Object.values(this.brains)) b.update(dt);
  }
  /** what someone is up to right now */
  doing(id: Crew) { return this.brains[id].doing; }
  stop() { for (const b of Object.values(this.brains)) b.stop(); }
}

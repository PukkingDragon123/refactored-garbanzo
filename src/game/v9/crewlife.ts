// Crew life aboard the Kittiwake: while the story doesn't need them anywhere in particular, Jenna and
// Joshu live their day. Each has a little brain that picks an activity, walks there (taking the
// ladders like anyone else: walk to the foot, climb, step off), does it for a while, and picks the next.
//
//  Jenna  hammers away at her bench in the engine room, raids the galley for a sandwich, puts her cat-ear
//         headphones on and nods along to music in the bunk room (with a little dance when the song is
//         good), yawns and stretches, stops to give Chunk a scratch, and in the afternoon climbs up for
//         some sea air: a sit in the deck chair with her music, a stretch at the rail
//  Joshu  mostly at the wheel; steps over to the radio for the weather, bends over the charts, taps the
//         barometer, has a mug of tea at the window, then back to the helm
//
// Story first: a brain only runs while its character's story phase lets them roam (Jenna is scared in
// the engine room during 'engine' and is placed there by the story; after the morning rounds she goes
// back to her bench for the "teeny firmware update"; nobody roams once Joshu is cooking or the storm
// has started). It pauses on the spot whenever a cutscene, a dialogue or an interaction is running (so
// "Talk to Jenna" finds her standing still and facing Mori), and if the story moved or re-posed someone
// while it was paused it drops what it was doing and plans afresh from wherever they now are.
// Timers run on game time, so nothing advances while paused; climbing always finishes its rung run.

import { game } from '../game';
import type { ShipScene4 } from '../v4/ship';
import { SPOTS, S4 } from '../v4/ship';
import { LADDERS } from '../../art/ship5';
import type { Actor } from '../../world/actor';
import { rand } from '../../core/math';
import { questStatus } from '../quests';

const F = () => game.save.flags;
const V = () => game.save.vars;
type Lv = 'lower' | 'deck';
const levelOf = (y: number): Lv => (y > S4.lower.ceil ? 'lower' : 'deck');

class Abort extends Error {}
interface Waiter { done: () => boolean; res: () => void; rej: (e: unknown) => void }
interface Climb { x: number; from: number; to: number; speed: number; res: () => void }

type Mode = 'off' | 'free' | 'home';

/** one character's daily routine */
abstract class Brain {
  /** game time spent un-paused (all waits are measured on it) */
  t = 0;
  private waiters: Waiter[] = [];
  private walkX: number | null = null;
  private walkSpeed = 36;
  private climbing: Climb | null = null;
  private paused = false;
  private snap: { x: number; y: number; idle: string; mode: Mode } | null = null;
  private lastMode: Mode = 'off';
  private running = false;
  dead = false;
  /** an activity to do next (debugging / tests: zl crew tools) */
  private next: string | null = null;
  /** what the brain last set as the idle anim (to tell the story's changes from ours) */
  protected myIdle = '';

  constructor(readonly s: ShipScene4, readonly a: Actor) {}

  abstract mode(): Mode;
  /** one pass of the routine (must await something) */
  protected abstract routine(home: boolean): Promise<void>;
  /** tidy up after an abort (take the headphones off...) */
  protected cleanup() {}

  start() {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  private async loop() {
    while (!this.dead) {
      try {
        await this.until(() => this.mode() !== 'off');
        const n = this.next;
        this.next = null;
        const act = n ? (this as unknown as Record<string, () => Promise<void>>)[n] : null;
        if (act && this.mode() === 'free') await act.call(this);
        else await this.routine(this.mode() === 'home');
      } catch (e) {
        if (!(e instanceof Abort)) { console.warn('[crewlife]', e); await new Promise(r => setTimeout(r, 1000)); }
      }
    }
  }

  // ---------------------------------------------------------------- primitives (await these)
  protected until(done: () => boolean): Promise<void> {
    if (done()) return Promise.resolve();
    return new Promise((res, rej) => this.waiters.push({ done, res, rej }));
  }
  protected wait(sec: number) {
    const end = this.t + sec;
    return this.until(() => this.t >= end);
  }
  /** pose: loop an anim as the idle */
  protected pose(anim: string) {
    this.a.idleAnim = anim;
    this.myIdle = anim;
    this.a.setAnim(anim);
  }
  /** play a one-shot clip, then back to the idle */
  protected async once(anim: string) {
    const a = this.a;
    let over = false;
    void a.play(anim, a.idleAnim).then(() => { over = true; });
    await this.until(() => over || a.anim !== anim);
  }
  /** walk along the current level */
  protected async walk(x: number, speed = 36) {
    const [lo, hi] = this.span(levelOf(this.a.y));
    x = Math.max(lo, Math.min(hi, x));
    if (Math.abs(this.a.x - x) < 1.5) return;
    this.walkX = x;
    this.walkSpeed = speed;
    if (this.a.idleAnim !== 'idle') this.pose('idle');
    void this.a.walkTo(x, speed, 'walk');
    await this.until(() => this.walkX === null || (Math.abs(this.a.x - x) < 1.5 && !this.a.walking));
    this.walkX = null;
  }
  /** go anywhere on the boat: along the level, or to a ladder, up or down it, then along */
  protected async go(x: number, lv: Lv, speed = 36) {
    const here = levelOf(this.a.y);
    if (here !== lv) {
      // the ladder that saves the most walking
      const L = [...LADDERS].sort((p, q) => Math.abs(p.x - this.a.x) + Math.abs(p.x - x) - (Math.abs(q.x - this.a.x) + Math.abs(q.x - x)))[0];
      await this.walk(L.x, speed);
      this.a.faceTo(L.x + 1);
      await this.climb(L, lv === 'deck' ? -1 : 1);
    }
    await this.walk(x, speed);
  }
  private climb(L: { x: number; top: number; bottom: number }, dir: 1 | -1): Promise<void> {
    const a = this.a;
    a.stopWalk();
    a.x = L.x;
    a.terrain = null;
    a.setAnim('climb');
    return new Promise(res => { this.climbing = { x: L.x, from: dir > 0 ? L.top : L.bottom, to: dir > 0 ? L.bottom : L.top, speed: 26, res }; });
  }
  /** a spoken line (only if Mori is about to hear it) */
  protected bark(text: string, o: { expr?: string; emote?: string } = {}) {
    if (!this.nearPlayer(190)) return;
    this.s.bark(this.a.id, text, o);
  }
  protected nearPlayer(d = 160) {
    const p = this.s.player;
    return Math.abs(p.x - this.a.x) < d && Math.abs(p.y - this.a.y) < 40;
  }
  protected span(lv: Lv): [number, number] {
    return lv === 'lower' ? [S4.lower.x0 + 10, S4.lower.x1 - 10] : [S4.main.x0 + 12, S4.main.x1 - 12];
  }

  // ---------------------------------------------------------------- per frame
  private blocked() {
    const s = this.s as unknown as { cutscene: boolean; busyAction?: boolean };
    return s.cutscene || !!s.busyAction || game.ui.blocking;
  }

  update(dt: number) {
    const a = this.a;
    // a climb always runs to the end of the ladder (nobody hangs mid-air through a cutscene)
    const c = this.climbing;
    if (c) {
      const d = c.to - a.y, step = c.speed * dt;
      a.x = c.x;
      if (Math.abs(d) <= step) {
        a.y = c.to;
        a.terrain = this.s.st.terrain;
        this.climbing = null;
        a.setAnim(a.idleAnim === 'climb' ? 'idle' : a.idleAnim);
        c.res();
      } else a.y += Math.sign(d) * step;
    }
    const mode = this.mode();
    // the story has them now: stop once, then stand by until the phase lets them go again
    if (mode === 'off') {
      if (this.lastMode !== 'off') { this.lastMode = 'off'; this.paused = false; this.snap = null; a.stopWalk(); this.abort(); }
      return;
    }
    const block = this.blocked();
    if (!this.paused && block) {
      this.paused = true;
      this.snap = { x: a.x, y: a.y, idle: a.idleAnim, mode };
      if (this.walkX !== null || a.walking) { a.stopWalk(); if (a.anim === 'walk') a.setAnim('idle'); }
    }
    if (this.paused && !block && !this.climbing) {
      const sn = this.snap!;
      // the story moved or re-posed them, or the phase changed: drop the plan
      const moved = Math.abs(a.x - sn.x) > 2 || Math.abs(a.y - sn.y) > 2 || a.idleAnim !== sn.idle || sn.mode !== mode;
      this.paused = false;
      this.snap = null;
      this.lastMode = mode;
      if (moved) this.abort();
      else if (this.walkX !== null) void a.walkTo(this.walkX, this.walkSpeed, 'walk');
    }
    if (this.paused) return;
    if (mode !== this.lastMode) { const was = this.lastMode; this.lastMode = mode; if (was !== 'off') this.abort(); }
    this.t += dt;
    if (this.waiters.length) {
      const ready = this.waiters.filter(w => w.done());
      if (ready.length) {
        this.waiters = this.waiters.filter(w => !ready.includes(w));
        for (const w of ready) w.res();
      }
    }
  }

  /** stop whatever they were doing (the story has them now, or the phase changed) */
  abort() {
    const ws = this.waiters;
    this.waiters = [];
    this.walkX = null;
    if (this.climbing) {
      const c = this.climbing;
      this.climbing = null;
      this.a.y = Math.abs(this.a.y - c.from) < Math.abs(this.a.y - c.to) ? c.from : c.to;
      this.a.terrain = this.s.st.terrain;
      c.res();
    }
    this.cleanup();
    for (const w of ws) w.rej(new Abort());
  }

  /** drop what they're doing and do this activity next (e.g. 'music', 'snack', 'deckBreak', 'tea') */
  force(act: string) {
    this.next = act;
    this.abort();
  }

  stop() {
    this.dead = true;
    this.abort();
  }
}

// ------------------------------------------------------------------ Jenna

const HUMS = ['♪ Hm hm hmmm... ♪', '♪ Doo-doo, da-daa... ♪', '♪ Nnn-tss, nnn-tss... ♪', '♪ La la laaa... ♪'];
const TYPING = ['Come onnn, compile...', 'Ha! Gotcha, little bug.', 'Why is it doing THAT.', 'Okay. Okay okay okay. Yes!', 'Semicolon. It was a semicolon.'];

class JennaBrain extends Brain {
  private lastPet = -999;
  private trips = 0;
  private first = true;

  mode(): Mode {
    const s = this.s, f = F();
    if (!f['v4:woke'] || f['v4:stormStarted'] || f['v4:joshuCooking'] || f['v4:bridge']) return 'off';
    if (s.phase !== 'morning' && s.phase !== 'deck') return 'off';
    // the rounds are done: back to her bench for the "teeny firmware update" (the engine call is next)
    if (s.phase === 'morning' && ((V()['v4:rounds'] ?? 0) >= 4 || f['v4:report'])) return 'home';
    return 'free';
  }
  private get desk() { return SPOTS.jennaDesk[0]; }

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

  protected async routine(home: boolean) {
    const a = this.a;
    if (home) {
      this.phones(false);
      await this.go(this.desk, 'lower');
      a.facing = 1;
      this.pose('typeFast');
      await this.until(() => this.mode() !== 'home');
      return;
    }
    // Chunk's wandered over: say hello properly
    const c = this.s.chunk;
    if (this.t - this.lastPet > 70 && !c.walking && levelOf(c.y) === levelOf(a.y) && Math.abs(c.x - a.x) < 60 && Math.abs(c.y - a.y) < 8) {
      this.lastPet = this.t;
      await this.petChunk();
      return;
    }
    const deck = this.s.phase === 'deck';
    const atDesk = levelOf(a.y) === 'lower' && Math.abs(a.x - this.desk) < 6;
    // mostly work; every outing ends back at the bench
    if (!atDesk || this.first) { this.first = false; await this.work(); return; }
    const r = rand.next();
    if (r < 0.32) await this.snack();
    else if (r < 0.62) await this.music();
    else if (deck && r < 0.86 && this.trips < 99) await this.deckBreak();
    else await this.work(true);
  }

  private async work(short = false) {
    const a = this.a;
    await this.go(this.desk, 'lower');
    a.facing = 1;
    this.pose(rand.next() < 0.75 ? 'typeFast' : 'type');
    const n = short ? 1 : 2 + Math.floor(rand.next() * 2);
    for (let i = 0; i < n; i++) {
      await this.wait(9 + rand.next() * 8);
      const r = rand.next();
      if (r < 0.3) this.bark(rand.pick(TYPING), { expr: 'happy' });
      else if (r < 0.5) { a.setExpr('tired', 3); await this.once('yawn'); }
      else if (r < 0.65) await this.once('stretch');
      else if (r < 0.8) this.pose(a.idleAnim === 'type' ? 'typeFast' : 'type');
    }
  }

  private async snack() {
    const a = this.a;
    // to the fridge, grab something, eat it standing at the counter
    await this.go(SPOTS.fridge[0] - 9, 'lower');
    a.facing = 1;
    this.pose('idle');
    await this.wait(0.6);
    await this.once('grab');
    if (rand.next() < 0.5) this.bark(rand.pick(['Brain food!', 'Ooh, the good bread.', 'Don’t tell Dad.']), { expr: 'happy' });
    await this.walk(SPOTS.kettle[0] + 6);
    a.facing = rand.next() < 0.5 ? -1 : 1;
    this.pose('snack');
    a.setExpr('happy');
    await this.wait(11 + rand.next() * 6);
    a.setExpr('neutral');
    if (rand.next() < 0.4) { this.bark('Mmf. Okay. Back to work.', { expr: 'determined' }); }
    this.pose('idle');
    await this.wait(0.5);
  }

  private async music() {
    const a = this.a;
    // to the bunk room, headphones on, lost in it
    await this.go(388 + rand.next() * 18, 'lower');
    a.facing = rand.next() < 0.5 ? -1 : 1;
    this.pose('idle');
    await this.wait(0.5);
    this.phones(true);
    a.setExpr('happy');
    this.pose('music');
    a.showEmote('music', 2);
    const n = 2 + Math.floor(rand.next() * 2);
    for (let i = 0; i < n; i++) {
      await this.wait(6 + rand.next() * 4);
      const r = rand.next();
      if (r < 0.35) { this.pose('dance'); a.showEmote('music', 1.6); await this.wait(5 + rand.next() * 3); this.pose('music'); }
      else if (r < 0.6) this.bark(rand.pick(HUMS), { expr: 'happy', emote: 'music' });
      else if (r < 0.7) a.facing = -a.facing;
    }
    this.pose('idle');
    this.phones(false);
    a.setExpr('neutral');
    await this.wait(0.8);
  }

  private async deckBreak() {
    const a = this.a;
    this.trips++;
    this.bark(rand.pick(['Fresh air break!', 'Need. Sunlight.', 'Two minutes. Just two.']), { expr: 'happy' });
    // up the nearest ladder and along the deck to the foredeck
    // the striped deck chair (its back to the bow): she sits in its low sling, facing aft
    const chair = SPOTS.roofChair[0] + 3;
    await this.go(chair, 'deck');
    a.facing = -1;
    a.oy = 3;
    this.phones(true);
    a.setExpr('happy');
    this.pose('musicSit');
    await this.wait(14 + rand.next() * 8);
    this.pose('idle');
    a.oy = 0;
    this.phones(false);
    await this.wait(0.8);
    // a stretch at the rail, looking out at the sea
    await this.walk(476 + rand.next() * 24);
    a.facing = 1;
    await this.once('stretch');
    a.setExpr('happy', 4);
    if (rand.next() < 0.6) this.bark(rand.pick(['The sea’s so BIG today.', 'Hi, birds!', 'Sea air! Good for the... um. Lungs.']), { expr: 'happy' });
    await this.wait(4 + rand.next() * 3);
    a.setExpr('neutral');
    await this.go(this.desk, 'lower');
  }

  private async petChunk() {
    const a = this.a, c = this.s.chunk, b = this.s.buddy;
    const side = a.x < c.x ? -1 : 1;
    await this.walk(c.x + side * 13, 40);
    // he holds still for a scratch (if he's off on his own errands, not if the story has him)
    const held = b?.mode === 'wander' && Math.abs(c.x - a.x) < 20 && Math.abs(c.y - a.y) < 8;
    if (held) { b.mode = 'stay'; c.stopWalk(); c.faceTo(a.x); c.idleAnim = 'sit'; c.setAnim('sit'); }
    try {
      a.faceTo(c.x);
      this.pose('pet');
      a.setExpr('happy');
      this.bark(rand.pick(['Hi, potato! Who’s a good potato?', 'Chunky! Scritches!', 'You’re SO soft. How are you so soft.']), { expr: 'happy' });
      c.showEmote('heart', 1.6);
      await this.wait(4);
      this.pose('idle');
      a.setExpr('neutral');
    } finally {
      if (held && b.mode === 'stay') b.release();
    }
    await this.wait(0.6);
  }
}

// ------------------------------------------------------------------ Joshu

class JoshuBrain extends Brain {
  private get helm() { return SPOTS.helm[0] - 14; }

  mode(): Mode {
    const s = this.s, f = F();
    if (f['v4:stormStarted'] || f['v4:joshuCooking'] || f['v4:bridge']) return 'off';
    if (s.phase === 'storm' || s.phase === 'wave') return 'off';
    // the engine's died: he's at the wheel, shouting down the hatch
    if (s.phase === 'engine') return 'home';
    return 'free';
  }

  protected cleanup() { this.a.setExpr('neutral'); }

  private async steer(sec: number) {
    const a = this.a;
    await this.walk(this.helm, 26);
    a.facing = 1;
    this.pose('steer');
    await this.wait(sec);
  }

  protected async routine(home: boolean) {
    if (home || levelOf(this.a.y) !== 'deck') { await this.steer(4); return; }
    // mostly at the wheel, now and then a little errand about the wheelhouse
    await this.steer(28 + rand.next() * 26);
    const r = rand.next();
    if (r < 0.25) await this.radio();
    else if (r < 0.5) await this.charts();
    else if (r < 0.72) await this.barometer();
    else await this.tea();
  }

  private async radio() {
    const a = this.a;
    // (the wheelhouse lamp hangs over the radio and the chart table: he works them from the helm side, clear of the bulb)
    await this.walk(SPOTS.radio[0] + 22, 26);
    a.facing = -1;
    this.pose('radioTalk');
    this.bark(rand.pick(['Kittiwake, Kittiwake... weather check, over.', 'Bluff Radio, this is Kittiwake. Say again, over?', 'Roger that. Swell from the sou’west. Out.']), { expr: 'serious' });
    await this.wait(7 + rand.next() * 4);
  }

  private async charts() {
    const a = this.a;
    await this.walk(SPOTS.charts[0] + 9, 26);
    a.facing = -1;
    this.pose('charts');
    a.setExpr('thinking');
    await this.wait(7 + rand.next() * 5);
    if (rand.next() < 0.5) this.bark(rand.pick(['Hm. Two days to the Snares, give or take.', 'Current’s pushin’ us east. Course correction.']), { expr: 'thinking' });
    a.setExpr('neutral');
    await this.wait(1.5);
  }

  private async barometer() {
    const a = this.a, morning = this.s.phase === 'morning';
    await this.walk(this.helm + 16, 26);
    a.facing = 1;
    this.pose('idle');
    for (let i = 0; i < 2; i++) await this.once('tapGlass');
    a.setExpr(morning ? 'thinking' : 'serious', 3);
    this.bark(morning ? 'Glass is jumpin’ about again...' : 'Glass is droppin’. Hm.', { expr: 'thinking' });
    await this.wait(2.5);
  }

  private async tea() {
    const a = this.a;
    await this.walk(this.helm + 6, 26);
    a.facing = 1;
    this.pose('sipTea');
    await this.wait(10 + rand.next() * 6);
    if (rand.next() < 0.5) this.bark(rand.pick(['Ahh. Proper tea.', 'Nothin’ like a brew at sea.']), { expr: 'happy' });
    await this.wait(2);
  }
}

// ------------------------------------------------------------------ the crew

export class CrewLife {
  readonly jenna: JennaBrain;
  readonly joshu: JoshuBrain;
  constructor(readonly s: ShipScene4) {
    this.jenna = new JennaBrain(s, s.jenna);
    this.joshu = new JoshuBrain(s, s.joshu);
  }
  start() { this.jenna.start(); this.joshu.start(); return this; }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.jenna.update(dt);
    this.joshu.update(dt);
  }
  stop() { this.jenna.stop(); this.joshu.stop(); }
}

/**
 * Dress the crew for an ordinary day at sea and start their routines (from ShipStory.enter). Leaves
 * anyone already in other clothes alone (storm gear on a reload into the storm, say).
 */
export function startCrewLife(s: ShipScene4): CrewLife {
  if (!F()['v4:bridge'] && !F()['v4:stormStarted']) {
    for (const a of [s.player.body, s.jenna, s.joshu]) if (a.outfit === 'casual' || a.outfit === 'shipPhones') a.outfit = 'ship';
  }
  void questStatus;
  return new CrewLife(s).start();
}

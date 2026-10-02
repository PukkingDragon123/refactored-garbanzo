// V10 camp day controller: takes over the island camp from Day 2 on (IsleCamp.restore hands over once
// v4:day1 is set). It adds the V10 camp (Mori's tarp tent, Jenna's tech bench, the camp board, the
// trail sign, the fishing rock), the crew's camp life, the stations (talk, the fire for meals, the
// tent, the bench, the board, the trail sign, the rocks, the radio), the lights and the clock for the
// time of day, and decides what plays when the camp loads: a pending arrival, the morning wake-up, or
// free roam at whatever point of the day the save is at. Cutscenes live in campscenes.ts and
// camparrive.ts, story events in campevents.ts.

import { game } from '../game';
import { audio } from '../../core/audio';
import { packColor } from '../../gfx/renderer';
import { Custom } from '../../world/props';
import { local, A } from '../assets';
import { Actor } from '../../world/actor';
import { groundY } from '../../art/island4/layout';
import * as CA from '../../art/island4/camp';
import { setOutfit } from '../../art/v7/wardrobe';
import { rand } from '../../core/math';
import type { IsleStory } from '../v4/islestory';
import { wait } from '../v4/islestory';
import type { IsleCamp } from '../v4/islecamp';
import type { IslandScene4 } from '../v4/island';
import { openFieldLaptop } from '../v9/research9';
import { CampCrew, C10 } from './campcrew';
import type { CrewHost } from './campcrew';
import * as ART from './campart';
import { dayState, dayNumber, dayPhase, setPhase, startNextDay, CREW, arriveAtCamp, CAMP_EVENTS } from './day';
import type { Crew, Phase } from './day';
import { startDayQuest } from './campquests';
import { talkTo } from './camptalk';
import { currentExpedition } from './expedition';

let active: CampDay | null = null;
/** the camp controller of the island scene that is up right now (null elsewhere) */
export function activeCamp(): CampDay | null {
  return active && game.scene === active.s ? active : null;
}
/** resolves once the camp scene is set up (or null after `ms`) */
export async function campReady(ms = 20000): Promise<CampDay | null> {
  const t0 = performance.now();
  for (;;) {
    const a = activeCamp();
    if (a?.ready) return a;
    if (performance.now() - t0 > ms) return null;
    await new Promise(r => setTimeout(r, 100));
  }
}

/** IsleCamp.restore hands the camp over to the day loop once Day 1 is done */
export async function startCampDay(st: IsleStory) {
  const cd = new CampDay(st);
  active = cd;
  await cd.start();
}

const NAME: Record<Crew, string> = { jenna: 'Jenna', joshu: 'Joshu', aroha: 'Aroha' };

export class CampDay implements CrewHost {
  readonly s: IslandScene4;
  readonly camp: IsleCamp;
  held = new Set<string>();
  fishing = false;
  crew!: CampCrew;
  ready = false;
  /** Mori is in his tent (asleep / waking) */
  inTent = false;
  /** the pot on the fire (breakfast / dinner) */
  potOn = false;
  /** a stand-in Mori that the story can carry, drape over a shoulder, lay down (the blackout) */
  carried: Actor | null = null;
  private arrivalP: Promise<void> | null = null;
  private clockT = 0;
  private lightT = 0;
  private nagT = 40;
  private away = false;
  private lastPhase: Phase | null = null;

  constructor(readonly st: IsleStory) {
    this.s = st.s;
    this.camp = st.camp;
  }
  get d() { return dayState(); }
  get day() { return dayNumber(); }
  get p() { return this.s.player; }
  actor(id: Crew) { return this.s.actor(id); }

  // ---------------------------------------------------------------- setup
  async start() {
    const s = this.s, d = this.d;
    if (game.save.day < 2) await startNextDay();
    startDayQuest();
    this.props();
    this.stations();
    this.crew = new CampCrew(this);
    // per-frame upkeep
    s.main.add(new Custom(51, rr => this.drawDoodle(rr), dt => this.update(dt)));
    // Chunk potters about camp; his favourite spots now include Mori's tent and Jenna's bench
    this.st.chunkFollow();
    const b = s.buddy, base = b.haunts;
    b.haunts = () => [...(base?.() ?? []), { x: C10.tent + 10, y: groundY(C10.tent), anim: 'lie', dur: [8, 14], w: 0.8 }, { x: C10.bench - 16, y: groundY(C10.bench), anim: 'sniff', dur: [2, 4], w: 0.5 }];
    b.wanderSpan = () => [C10.salvage + 10, C10.lean + 60];
    this.ready = true;
    // what plays now
    if (d.arrive) { void this.arrive(d.arrive); return; }
    if (currentExpedition() || d.phase === 'out') { this.mode('out'); return; }
    if (d.woke < this.day) {
      const { wakeUp } = await import('./campscenes');
      await wakeUp(this);
      return;
    }
    this.mode(d.phase);
  }

  /** set the camp up for a point in the day (no cutscene): lights, clothes, the crew where they'd be */
  mode(ph: Phase) {
    const s = this.s;
    this.lastPhase = ph;
    const t = s.clock.t;
    if (ph === 'morning') { s.clock.target = 1.4; s.clock.rate = 0.0011; }
    else if (ph === 'out') { s.clock.target = 2.7; s.clock.rate = 0.0014; }
    else if (ph === 'evening') { s.clock.set(Math.max(t, 2.55)); s.clock.target = 3.5; s.clock.rate = 0.0009; }
    else { s.clock.set(Math.max(t, 3.72)); s.clock.target = 3.95; s.clock.rate = 0.0006; }
    this.dress(ph === 'night');
    this.lights();
    this.placeCrew(ph);
    audio.setMusic(ph === 'night' ? 'night' as never : ph === 'evening' ? 'camp' as never : 'build' as never);
  }

  /** everyone in their everyday clothes by day, the winter gear after dark */
  dress(night: boolean) {
    for (const id of ['mori', ...CREW]) setOutfit(id, night ? 'winter' : 'ship');
  }

  /** the fire, the string lights, the lantern and the laptop for the time of day */
  lights() {
    const t = this.s.clock.t, c = this.camp, ph = dayPhase();
    const dark = t > 2.9;
    for (const b of c.bulbs) b.on = dark && !(ph === 'night' && this.inTent);
    c.lanternOn = t > 2.75 && !this.inTent;
    c.laptopOn = !this.inTent;
    c.fire = this.inTent ? 0.3 : ph === 'night' || ph === 'evening' ? 1 : this.potOn ? 0.9 : 0.45;
  }

  /** the crew where they'd be at this point of the day (their brains take it from there) */
  placeCrew(ph: Phase) {
    const st = this.st, s = this.s;
    st.jennaF.on = false;
    st.joshuF.on = false;
    if (ph === 'night') {
      st.place(s.jenna, C10.seats.jenna, 1, 'sit');
      st.place(s.joshu, C10.seats.joshu, -1, 'sit');
      st.place(s.aroha, C10.seats.aroha, -1, 'sit');
    } else if (ph === 'evening') {
      st.place(s.jenna, C10.bench + 22, -1, 'wrench');
      st.place(s.joshu, C10.cook - 22, 1, 'cook');
      st.place(s.aroha, C10.lean - 14, 1, 'sitGround');
    } else {
      st.place(s.jenna, C10.bench + 22, -1, 'typeFast');
      st.place(s.joshu, C10.cook - 22, 1, 'cook');
      st.place(s.aroha, C10.lean + 24, -1, 'kneel');
    }
    for (const a of [s.jenna, s.joshu, s.aroha]) a.walkAnim = 'walk';
    this.crew.start();
  }

  // ---------------------------------------------------------------- the story's handles on the crew
  hold(...ids: Crew[]) { for (const id of ids.length ? ids : CREW) this.held.add(id); }
  release(...ids: Crew[]) { for (const id of ids.length ? ids : CREW) this.held.delete(id); }
  /** everyone sat round the fire (Mori on the left bench, facing it) */
  seatAll(withMori = true) {
    const st = this.st, s = this.s;
    this.hold();
    st.place(s.jenna, C10.seats.jenna, 1, 'sit');
    st.place(s.joshu, C10.seats.joshu, -1, 'sit');
    st.place(s.aroha, C10.seats.aroha, -1, 'sit');
    if (withMori) { const p = this.p; p.x = C10.seats.mori; p.y = groundY(p.x); p.facing = 1; st.pose('sit'); }
  }
  /** lock the camera on a point (a close-up hides the foreground plants until the cutscene is over) */
  frame(x: number, y: number, zoom: number) {
    const c = this.s.st.cam;
    c.locked = true;
    c.x = c.tx = x; c.y = c.ty = y; c.zoom = c.tzoom = zoom;
    this.front(zoom < 1.5);
  }
  /** the foreground layer (palms, flax spikes in front of the camera) */
  front(on: boolean) {
    const st = this.s.st;
    if (st.hasLayer('front')) st.layer('front').visible = on;
  }

  // ---------------------------------------------------------------- props
  private props() {
    const st = this.st, s = this.s;
    const tent = st.prop('v10tent', ART.tarpTent(), C10.tent, groundY(C10.tent) + 2, () => true, -3.1);
    // the hurricane lantern hung from the ridge pole at the tent's closed end, swinging in the wind; lit
    // after dark it throws warm light over the sailcloth and the sand
    const HL = ART.hangingLantern();
    const hlF = local.add('v10:hlan', HL.buf, HL.ax, HL.ay), hlG = local.add('v10:hlanG', HL.glow, HL.ax, HL.ay);
    s.main.add(new Custom(-3.05, (rr, stg) => {
      const hx = tent.x - 21, hy = tent.y - 41;
      const W = stg.wind, a = (Math.sin(stg.time * 1.7) * 0.6 + Math.sin(stg.time * 3.1 + 1) * 0.25) * 0.08 * (0.4 + W) + W * 0.05;
      rr.draw(hlF, hx, hy, 1, 1, -a);
      if (!this.camp.lanternOn || this.inTent) return;
      const fl = 0.9 + 0.1 * Math.sin(stg.time * 13) * Math.sin(stg.time * 5.3);
      rr.emissive(1);
      rr.draw(hlG, hx, hy, 1, 1, -a, packColor(1, 1, 1, fl));
      rr.emissive();
      const night = this.s.clock.night * 0.8 + this.s.clock.dusk * 0.4;
      const lx = hx + Math.sin(a) * 14, ly = hy + 14;
      rr.light(lx, ly, 58, 1, 0.78, 0.45, (0.18 + night * 0.4) * fl, 0.1);
      rr.fxDraw(A.glow, lx, ly, 0.14, 0.14, 0, packColor(1, 0.8, 0.5, 1), (0.3 + night * 0.4) * fl);
    }));
    st.prop('v10bag', CA.bedroll(), C10.tent + 2, groundY(C10.tent) + 3, () => !this.inTent, -2.9);
    const bench = st.prop('v10bench', ART.techBench(), C10.bench, groundY(C10.bench) + 2, () => true, -3);
    const glow = bench.glow;
    bench.glow = undefined;
    s.main.add(new Custom(-2.95, (rr, stg) => {
      if (!glow) return;
      const on = 0.75 + 0.25 * Math.sin(stg.time * 7) * Math.sin(stg.time * 2.3);
      rr.emissive(0.8);
      rr.draw(glow, bench.x, bench.y, 1, 1, 0, packColor(1, 1, 1, on));
      rr.emissive();
      const night = this.s.clock.night * 0.8 + this.s.clock.dusk * 0.3;
      rr.light(bench.x + 10, bench.y - 30, 40, 1, 0.92, 0.7, 0.35 + night * 0.5, 0.1);
    }));
    st.prop('v10board', ART.campBoard(), C10.board, groundY(C10.board) + 2, () => true, -3);
    st.prop('v10sign', ART.trailSign(), C10.sign, groundY(C10.sign) + 2, () => true, -3);
    st.prop('v10rock', ART.fishRock(), C10.rock - 4, groundY(C10.rock) + 9, () => true, -2.6);
    st.prop('v10rod', ART.rodInRock(), C10.rock + 12, groundY(C10.rock) - 2, () => !this.fishing && !this.joshuFishing(), -2.7);
    st.prop('v10pot', ART.pot(), C10.fire + 2, groundY(C10.fire) - 1, () => this.potOn, -1.4);
    // Aroha's slingshot target: a driftwood post with a shell on top
    st.prop('v10target', ART.target(), C10.target, groundY(C10.target) + 1, () => true, -3);
  }
  private joshuFishing() { const j = this.s.joshu; return j.visible && Math.abs(j.x - (C10.rock + 6)) < 4 && (j.anim === 'fishWait' || j.anim === 'fishReel'); }

  /** Jenna's doodle on Mori's face after a blackout (a moustache and a monobrow) */
  private drawDoodle(rr: Parameters<Custom['fn']>[0]) {
    const d = this.d;
    if (!d.doodle || d.doodle < this.day - 1) return;
    const p = this.p, b = p.body;
    if (!b.visible || p.alpha < 0.5 || this.inTent) return;
    const an = b.anim;
    if (an === 'sleepBag' || an === 'lie' || an === 'unconscious' || an.startsWith('camera') || an === 'photograph') return;
    const [hx, hy] = b.headTop();
    const f = p.facing >= 0 ? 1 : -1;
    const ink = packColor(0.08, 0.06, 0.12, 0.92);
    const x = Math.round(hx + f * 2), y = Math.round(hy + 11);
    // the moustache, curled at the ends
    rr.rect(x - 2, y, 5, 1, ink);
    rr.rect(x - 3, y - 1, 1, 1, ink); rr.rect(x + 3, y - 1, 1, 1, ink);
    // the monobrow
    rr.rect(x - 2, y - 5, 6, 1, ink);
  }

  // ---------------------------------------------------------------- stations
  private stations() {
    const st = this.st, s = this.s, self = this;
    const free = () => !s.cutscene && !game.ui.blocking && !this.fishing;
    // talk to the crew
    for (const who of CREW) {
      const a = this.actor(who);
      st.it({ get x() { return a.x; }, get y() { return a.y; }, w: 14, label: `Talk to ${NAME[who]}`, get standX() { return a.x + (s.player.x < a.x ? -22 : 22); },
        enabled: () => a.visible && !this.held.has(who) && free(), action: () => this.talk(who) } as never);
    }
    // the fire: breakfast, dinner, or just a sit
    st.it({ x: C10.fire, y: groundY(C10.fire), w: 16, get label() { return self.fireLabel(); }, standX: C10.fire - 26, quest: () => this.fireDue(),
      enabled: () => free() && dayPhase() !== 'out', action: () => this.atFire() } as never);
    // Mori's tent
    st.it({ x: C10.tent, y: groundY(C10.tent), w: 18, get label() { return self.tentLabel(); }, standX: C10.tent + 20, quest: () => dayPhase() === 'night',
      enabled: () => free(), action: () => this.atTent() } as never);
    // Jenna's bench
    st.it({ x: C10.bench, y: groundY(C10.bench), w: 18, label: 'Jenna’s workbench: upgrade your gear', standX: C10.bench - 24, enabled: free, action: () => this.atBench() });
    // the camp board
    st.it({ x: C10.board, y: groundY(C10.board), w: 14, label: 'The camp board: requests', standX: C10.board - 18, quest: () => this.boardDue(), enabled: free, action: () => this.atBoard() });
    // the trail sign
    st.it({ x: C10.sign, y: groundY(C10.sign), w: 14, get label() { return self.signLabel(); }, standX: C10.sign - 18, quest: () => dayPhase() === 'morning' && this.d.meals.breakfast === this.day,
      enabled: free, action: () => this.atSign() } as never);
    // the fishing rock
    st.it({ x: C10.rock, y: groundY(C10.rock), w: 14, get label() { return self.fishLabel(); }, standX: C10.rock, enabled: () => free() && dayPhase() !== 'night', action: () => this.atRock() } as never);
    // the radio in Jenna's corner (once the agency is on the line)
    st.it({ x: C10.elec, y: groundY(C10.elec), w: 16, label: 'Radio the field office', standX: C10.elec + 22, enabled: () => free() && !!game.save.flags['v10:agency'], action: () => this.atRadio() });
  }

  private fireDue() {
    const ph = dayPhase(), d = this.d;
    return (ph === 'morning' && d.meals.breakfast !== this.day) || (ph === 'evening' && d.meals.dinner !== this.day);
  }
  private fireLabel() {
    const ph = dayPhase(), d = this.d;
    if (ph === 'morning' && d.meals.breakfast !== this.day) return 'Breakfast at the fire';
    if (ph === 'evening' && d.meals.dinner !== this.day) return 'Dinner and stories at the fire';
    return 'Sit by the fire';
  }
  private tentLabel() {
    const ph = dayPhase();
    if (ph === 'night') return `Crawl into your tent (end Day ${this.day})`;
    if (ph === 'evening') return 'Your tent (dinner first)';
    if (ph === 'out') return 'Your tent';
    return 'Your tent: lie low until evening';
  }
  private signLabel() {
    const ph = dayPhase();
    if (ph === 'morning') return 'Pack your bag and set off';
    if (ph === 'out') return 'Call it a day (back at camp)';
    return 'The trail sign';
  }
  private fishLabel() {
    const d = this.d;
    const n = d.fishDay === this.day ? d.fishN : 0;
    return n >= 3 ? 'Fish off the rocks (the fish have wised up)' : 'Fish off the rocks';
  }
  private boardDue() { return this.boardNews(); }
  /** a request is ready to hand in, or something new is on the board */
  boardNews(): boolean {
    const m = boardMod;
    return !!m && m.news();
  }

  // ---------------------------------------------------------------- actions
  async talk(who: Crew) {
    const a = this.actor(who), s = this.s;
    s.player.facing = a.x > s.player.x ? 1 : -1;
    a.stopWalk();
    a.faceTo(s.player.x);
    await talkTo(who, { say: l => this.st.say(l), doing: w => this.crew.doing(w), doodled: () => this.doodled() });
  }
  doodled() { const d = this.d; return !!d.doodle && d.doodle >= this.day - 1; }

  private async atFire() {
    const ph = dayPhase(), d = this.d;
    const m = await import('./campscenes');
    if (ph === 'morning' && d.meals.breakfast !== this.day) return m.breakfast(this);
    if (ph === 'evening' && d.meals.dinner !== this.day) return m.dinner(this);
    return m.sitByFire(this);
  }
  private async atTent() {
    const ph = dayPhase();
    const m = await import('./campscenes');
    if (ph === 'night') return m.goToSleep(this);
    if (ph === 'evening') { this.s.bark('joshu', rand.pick(['Not on an empty stomach, lad. Dinner first!', 'Bed? It’s not even dark! Grub’s nearly up.']), { expr: 'teasing' }); return; }
    if (ph === 'out') { this.s.bark('mori', 'Not now. I’m still out exploring. Ish.', { expr: 'thinking' }); return; }
    return m.restUntilEvening(this);
  }
  private async atBench() {
    const { openBench } = await import('../../ui/v10/campbench');
    await openBench(this);
  }
  private async atBoard() {
    const { openBoard } = await import('../../ui/v10/campboard');
    await openBoard();
    this.s.hud?.refresh(true);
  }
  private async atSign() {
    const ph = dayPhase();
    if (ph === 'out') { await arriveAtCamp('walk'); return; }
    if (ph !== 'morning') { this.s.bark('mori', this.s.clock.t > 3.3 ? 'Too dark to head out now. Tomorrow.' : 'Too late for a proper trip today. Tomorrow, first thing.', { expr: 'thinking' }); return; }
    const { openPackPrep } = await import('../../ui/v10/camppack');
    await openPackPrep(this);
  }
  private async atRock() {
    const { fishAtCamp } = await import('./campfish');
    await fishAtCamp(this);
  }
  private async atRadio() {
    const { radioOffice } = await import('./campevents');
    await radioOffice(this);
  }

  /** play the return to camp (once; a second call waits for the first) */
  arrive(how: 'walk' | 'blackout' | 'boat'): Promise<void> {
    if (this.arrivalP) return this.arrivalP;
    this.arrivalP = (async () => {
      const { arrival } = await import('./camparrive');
      await arrival(this, how);
    })().finally(() => { this.arrivalP = null; });
    return this.arrivalP;
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number) {
    const s = this.s, d = this.d;
    if (game.scene !== s) return;
    this.crew?.update(dt);
    // remember the time of day for a reload
    this.clockT -= dt;
    if (this.clockT <= 0) { this.clockT = 2; d.clock = +s.clock.t.toFixed(3); }
    if (s.cutscene || game.ui.blocking) return;
    if (s.st.hasLayer('front') && !s.st.layer('front').visible) this.front(true);
    const ph = dayPhase();
    if (ph !== this.lastPhase) { this.lastPhase = ph; this.lights(); }
    // the lights follow the sun
    this.lightT -= dt;
    if (this.lightT <= 0) { this.lightT = 1.5; this.lights(); }
    // a whole day at camp: the evening comes on its own
    if (ph === 'morning' && s.clock.t > 1.35 && !this.arrivalP) {
      setPhase('evening');
      s.clock.target = 3.5;
      s.clock.rate = 0.0016;
      s.bark('joshu', 'Well, that’s the day gone. Grub at sundown, everyone.', { expr: 'neutral' });
    }
    // nudges
    this.nagT -= dt;
    if (this.nagT <= 0) {
      this.nagT = 70 + rand.next() * 40;
      if (ph === 'morning' && d.meals.breakfast !== this.day && s.clock.t < 0.9) s.bark('joshu', rand.pick(['Breakfast’s on the fire, lad!', 'Come and eat before Chunk does!']), { expr: 'happy' });
      else if (ph === 'morning' && s.clock.t > 0.8) s.bark('joshu', rand.pick(['Daylight’s burning, Doc. Pack up and go see something.', 'The island won’t photograph itself.']), { expr: 'teasing' });
      else if (ph === 'evening' && d.meals.dinner !== this.day && s.clock.t > 3.1) s.bark('joshu', 'Grub’s up! Come and get it!', { expr: 'happy' });
    }
    // out walking the home island: coming back into camp ends the trip
    if (ph === 'out' && !currentExpedition()) {
      const x = s.player.x;
      if (x < C10.salvage - 120 || x > C10.sign + 220) this.away = true;
      else if (this.away && x > C10.salvage && x < C10.sign) { this.away = false; void arriveAtCamp('walk'); }
    }
  }

  /** leave the camp scene (an expedition elsewhere): stop the brains */
  stop() {
    this.crew?.stop();
    if (active === this) active = null;
  }
}

/** debug handle (window.zl.day): the day state, arrivals, events, skipping ahead */
export const DAY_ZL = {
  state: () => ({ day: dayNumber(), ...dayState() }),
  /** play an arrival: zl.day.arrive('blackout') */
  arrive: (how: 'walk' | 'blackout' | 'boat' = 'walk') => arriveAtCamp(how),
  /** jump to a phase without a cutscene: 'morning' | 'out' | 'evening' | 'night' */
  phase: (p: Phase) => { setPhase(p); activeCamp()?.mode(p); return p; },
  /** run a camp event now by id (e.g. 'chunkHeist', 'agencyContact', 'translatorDemo') */
  event: async (id: string) => {
    const cd = activeCamp();
    await import('./campevents');
    const ev = CAMP_EVENTS.find(e => e.id === id);
    if (!cd || !ev) return 'no camp / no such event';
    dayState().events[id] = dayNumber();
    await ev.run({ st: cd.st, camp: cd, day: dayNumber() });
    cd.release();
    return 'ok';
  },
  /** sleep through to the next morning (no cutscene) */
  next: async () => { await startNextDay(); const { goIsland } = await import('../v4/islandflow'); await goIsland(); },
  scene: (name: 'breakfast' | 'dinner' | 'sleep' | 'wake' | 'night') => {
    const cd = activeCamp();
    if (!cd) return null;
    return import('./campscenes').then(m => name === 'breakfast' ? m.breakfast(cd) : name === 'dinner' ? m.dinner(cd) : name === 'sleep' ? m.goToSleep(cd) : name === 'night' ? m.nightTalk(cd) : m.wakeUp(cd));
  },
};
function hookZl() {
  const w = window as unknown as { zl?: Record<string, unknown> };
  if (w.zl) w.zl.day = DAY_ZL;
  else setTimeout(hookZl, 500);
}
hookZl();

// the board module, loaded once for the quest marker over the board
let boardMod: { news(): boolean } | null = null;
void import('../../ui/v10/campboard').then(m => { boardMod = m; }).catch(() => {});
void wait;

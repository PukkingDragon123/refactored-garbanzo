// V4 story aboard the Kittiwake: wake up with Chunk, instant noodles, the morning rounds, the report
// on the laptop, Jenna's engine emergency, an afternoon of photography and fishing, then the storm.

import { game } from '../game';
import type { ShipScene4 } from './ship';
import { SPOTS, S4 } from './ship';
import { startQuest, questStatus } from '../quests';
import { audio } from '../../core/audio';
import { animInfo } from '../../world/actor';
import type { Interactable } from '../../world/npc';
import type { BubbleLine } from '../../ui/bubbles';
import { ChunkBuddy } from './buddy';
import { rand } from '../../core/math';
import { shipUploadDue } from '../v9/research9';
import { SPECIES_BY_ID } from '../species';
import type { RawPhoto } from '../photos';
import { startCrewLife, CrewLife } from '../v9/crewlife';
import { LADDERS } from '../../art/ship5';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = () => game.save.flags;
const V = () => game.save.vars;

export function attachShipStory(sc: ShipScene4): ShipScene4 {
  const story = new ShipStory(sc);
  sc.story = story;
  const baseEnter = sc.enter.bind(sc);
  sc.enter = async () => {
    await baseEnter();
    await story.enter();
  };
  return sc;
}

export class ShipStory {
  constructor(readonly s: ShipScene4) {}

  private flag(k: string) { return !!F()[k]; }
  private set(k: string, v = true) { F()[k] = v; game.persist(); this.s.hud?.refresh(true); }
  private inc(k: string, n = 1) { V()[k] = (V()[k] ?? 0) + n; game.persist(); this.s.hud?.refresh(true); }
  private say(lines: BubbleLine[]) { return this.s.say(lines); }
  private get p() { return this.s.player; }

  /** hold a pose on the player (cutscenes) */
  private pose(anim: string | null) { this.p.poseOverride = anim; }
  private async once(anim: string) {
    const i = animInfo(anim, 'mori');
    this.pose(anim);
    await wait((i.frames / i.fps) * 1000);
  }

  // ---------------------------------------------------------------- setup
  async enter() {
    const s = this.s;
    s.player.ground = 'wood';
    s.player.speedK = 0.8;
    s.player.noRun = true;
    s.st.cam.tzoom = s.st.cam.zoom = 1.12;
    // Mori's bunk is a little platform so he can lie on it
    s.st.terrain.addPlatform([[348, 182], [398, 182]], 'bridge');
    s.buddy = new ChunkBuddy(s.chunk, { player: s.player, terrain: s.st.terrain, levelSpan: y => s.levelSpan(y), busy: () => s.cutscene });
    this.chunkRoams();
    // the seabirds are out all day: the morning report needs a real photo of one
    if (!this.flag('v4:stormStarted')) import('./seafauna').then(m => { m.startDeckLife(s); this.watchBirdPhotos(); });
    this.addInteractables();
    this.crew = startCrewLife(s);
    if (!this.flag('v4:woke')) {
      await this.wakeUp();
    } else {
      s.player.x = SPOTS.moriDesk[0];
      s.player.y = S4.lower.floor;
      s.chunk.x = s.player.x - 20;
      s.chunk.y = S4.lower.floor;
      s.snapCamera();
      this.restorePhase();
    }
  }

  private restorePhase() {
    const s = this.s;
    if (questStatus('v4morning') === 'hidden') startQuest('v4morning', true);
    if (this.flag('v4:report') && !this.flag('v4:engineCall')) this.engineCall();
    else if (this.flag('v4:engineCall') && !this.flag('v4:engineFixed')) {
      s.phase = 'engine';
      this.placeJenna('engine');
      audio.setEngine(0);
      // reloaded with the engine dead: she's adrift (no way on, no bow wave, no wake)
      s.engineOn = false;
    } else if (this.flag('v4:engineFixed')) {
      s.phase = 'deck';
      this.placeJenna('desk');
      // the afternoon's wildlife comes back after a reload
      if (!this.flag('v4:stormStarted')) void import('./seafauna').then(m => m.startDeckLife(s));
    }
    // the storm waits while the afternoon quest still wants its photos uploaded
    const deckOpen = questStatus('v4deck') === 'active' && !this.flag('v9:uploadShip');
    if (this.flag('v4:bridge')) {
      // reloaded during the rogue wave: it hits again (the beach is next)
      if (!this.flag('v4:beachWoke')) { this.stormArmed = true; void import('./storm').then(m => m.resumeWave(s)); }
    } else if (this.flag('v4:stormStarted')) {
      // reloaded mid-storm: straight back into it
      this.stormArmed = true;
      void this.storm();
    } else if (this.flag('v4:fishUsed') && !deckOpen) { this.stormArmed = true; this.stormIn = 1.5; }
  }

  /** Chunk lives his own life aboard: wanders, naps, visits his bowl and bed, drops by to see Mori */
  private chunkRoams() {
    const b = this.s.buddy, s = this.s;
    b.free = 'wander';
    b.mode = 'wander';
    const L = S4.lower.floor, H = SPOTS.tank[1];
    const deck = (x: number) => s.st.terrain.surfaceBelow(x, S4.main.y - 30, 2)?.y ?? S4.main.y;
    b.haunts = () => [
      { x: SPOTS.bowls[0] + 4, y: L, anim: 'eat', dur: [4, 7], expr: 'eat', face: -1, w: 1 },
      { x: SPOTS.chunkBed[0], y: L, anim: 'sleep', dur: [14, 26], expr: 'sleep', w: 1.4 },
      { x: SPOTS.moriDesk[0] - 6, y: L, anim: 'lie', dur: [6, 10], w: 0.8 },
      { x: SPOTS.jennaDesk[0] + 16, y: L, anim: 'sit', dur: [5, 8], face: -1, w: 0.6 },
      { x: SPOTS.tank[0] + 8, y: H, anim: 'tilt', dur: [3, 5], face: -1, w: 0.7 },
      { x: SPOTS.dogFood[0], y: H, anim: 'sniff', dur: [2, 4], w: 0.5 },
      { x: SPOTS.herbs[0] + 6, y: deck(SPOTS.herbs[0] + 6), anim: 'sniff', dur: [2, 4], w: 0.6 },
      { x: SPOTS.roofChair[0], y: deck(SPOTS.roofChair[0]), anim: 'lie', dur: [8, 14], w: 0.8 },
      { x: SPOTS.bow[0] - 30, y: deck(SPOTS.bow[0] - 30), anim: 'sit', dur: [5, 9], face: 1, w: 0.6 },
    ];
    // he changes deck only on a calm sea, while nobody needs him, and never in the storm
    b.hop = a => {
      if ((s.phase !== 'morning' && s.phase !== 'deck') || s.cutscene || s.carrying || this.s.weather.storm > 0.15) return null;
      const lower = a.y > S4.lower.ceil;
      // up on deck is a treat: less likely to go up than to come back down
      if (lower && rand.next() < 0.5) return null;
      const lads = [...LADDERS].sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
      const L0 = lads[0];
      if (Math.abs(L0.x - a.x) > 200) return null;
      const side = rand.pick([-1, 1]);
      return lower ? { x: L0.x, to: [L0.x + side * 10, s.st.terrain.surfaceBelow(L0.x + side * 10, L0.top - 12, 2)?.y ?? L0.top] }
        : { x: L0.x, to: [L0.x + side * 10, s.st.terrain.surfaceBelow(L0.x + side * 10, L0.bottom - 12, 2)?.y ?? L0.bottom] };
    };
  }

  // ---------------------------------------------------------------- wake up
  private async wakeUp() {
    const s = this.s, p = this.p;
    s.cutscene = true;
    s.buddy.mode = 'script';
    s.hud?.show(false);
    // Mori asleep in his bunk, Chunk curled up on his chest
    p.x = 374;
    p.y = 182;
    p.facing = -1;
    this.pose('sleepBunk');
    const c = s.chunk;
    c.terrain = null;
    c.x = 370; c.y = 175; c.facing = -1;
    c.idleAnim = 'sleep'; c.setAnim('sleep');
    c.setExpr('sleep');
    p.body.setExpr('sleep');
    s.snapCamera();
    s.st.cam.x = s.st.cam.tx = 372;
    s.st.cam.y = s.st.cam.ty = 150;
    s.st.cam.locked = true;
    game.r.post.fade = 1;
    game.fadeTo(1);
    await wait(900);
    audio.setAmbience('boatCalm', false);
    audio.play('woodCreak', { vol: 0.4 });
    game.fadeTo(0, 0.45);
    await wait(2200);
    await game.ui.titleCard('Day 1', 'The Kittiwake', 'Somewhere in the Southern Ocean', 2600);
    await this.say([
      { who: 'chunk', text: 'Hnnnnk... shnrrrrk... hnnnnk...', expr: 'sleep', close: false },
    ]);
    c.setExpr('surprised', 1.2);
    c.react('bounce');
    c.showEmote('exclaim', 1);
    audio.play('callGrunt', { vol: 0.35, pitch: 1.8 });
    await wait(500);
    c.setAnim('bark');
    await this.say([
      { who: 'chunk', text: '*slurp slurp slurp slurp*', expr: 'happy', close: false },
      { who: 'mori', text: 'Mmmh... five more minutes, Chunk.', expr: 'sleep' },
      { who: 'chunk', text: 'Boof.', expr: 'excited' },
      { who: 'chunk', text: '*SLURP*', expr: 'happy', close: false },
    ]);
    p.body.setExpr('tired');
    await this.once('wake');
    this.pose('sitGround');
    await this.say([
      { who: 'mori', text: '...Chunk. Buddy. Your breath smells like a tide pool.', expr: 'tired' },
      { who: 'chunk', text: 'Hff!', expr: 'happy' },
      { who: 'mori', text: 'Good morning to you too.', expr: 'happy' },
    ]);
    // Chunk hops down; Mori gets up, stretches, finds his glasses
    c.terrain = s.st.terrain;
    c.setAnim('jump');
    c.walkTo(SPOTS.chunkBed[0], 60, 'run');
    c.idleAnim = 'idle';
    await wait(400);
    c.y = S4.lower.floor;
    c.react('land');
    await wait(300);
    p.y = S4.lower.floor;
    p.x = 362;
    p.facing = -1;
    await this.once('standUp');
    await this.once('stretch');
    p.body.setExpr('neutral');
    await this.once('glasses');
    this.pose(null);
    c.play('wiggle', 'idle').catch(() => {});
    await this.say([
      { who: 'mori', text: 'Day twenty-three aboard the Kittiwake. Weather: gorgeous. Crew: alive. Coffee: tragically nonexistent.', expr: 'neutral' },
      { who: 'mori', text: 'Breakfast first. Noodles. It’s always noodles.', expr: 'happy' },
      { who: 'chunk', text: 'Boof! Boof!', expr: 'excited', react: 'jump' },
      { who: 'mori', text: 'No, YOU already had breakfast. I heard you eat it at four in the morning.', expr: 'teasing' },
      { who: 'chunk', text: '...snrk.', expr: 'derp' },
    ]);
    s.st.cam.locked = false;
    s.cutscene = false;
    s.buddy.release();
    s.hud?.show(true);
    this.set('v4:woke');
    startQuest('v4morning');
    game.ui.toast('Walk with <b>A</b>/<b>D</b> (hold <b>Shift</b> to run). Climb ladders with <b>W</b>/<b>S</b>. <b>E</b> interacts.', 'TIP', 'teal', 6500);
  }

  // ---------------------------------------------------------------- interactables
  private addInteractables() {
    const s = this.s;
    const it = (o: Partial<Interactable> & { x: number; y: number; label: string; action: () => void | Promise<void> }) => {
      // no object spread: getters (a moving actor's x, dynamic labels) must stay live
      const i = o as Interactable & { w?: number; h?: number };
      if (i.w === undefined) i.w = 12;
      if (i.h === undefined) i.h = 18;
      s.interact.push(i as Interactable);
    };
    const calm = () => s.phase !== 'storm' && s.phase !== 'wave';
    const fl = (k: string) => () => this.flag(k);
    const rounds = () => this.flag('v4:ate') && (V()['v4:rounds'] ?? 0) < 4;
    const L = S4.lower.floor, H = S4.house.floor, B = S4.bridge.floor, D = S4.main.y;

    // breakfast
    it({ x: SPOTS.kettle[0], y: H, label: 'Make instant noodles', standX: SPOTS.kettle[0] - 4, quest: () => true, enabled: () => this.flag('v4:woke') && !this.flag('v4:noodles'), action: () => this.noodles() });
    it({ x: SPOTS.messSeat[0], y: H, w: 16, label: 'Sit down and eat', standX: SPOTS.messSeat[0], quest: () => true, enabled: () => this.flag('v4:noodles') && !this.flag('v4:ate'), action: () => this.eat() });
    // rounds
    const self = this;
    it({ x: SPOTS.tank[0], y: L, w: 20, get label() { return self.flag('v4:fishToTank') && !self.flag('v4:fishUsed') ? 'Release your catch into the tank' : self.flag('v4:round:tank') ? 'Watch the fish' : 'Feed the fish'; }, standX: SPOTS.tank[0] + 22, quest: () => (rounds() && !this.flag('v4:round:tank')) || (this.flag('v4:fishToTank') && !this.flag('v4:fishUsed')), enabled: calm, action: () => (this.flag('v4:fishToTank') && !this.flag('v4:fishUsed') ? this.releaseFish() : this.tank()) } as never);
    it({ x: 160, y: L, w: 20, label: 'Check the engine gauges', standX: 160, quest: () => rounds() && !this.flag('v4:round:engine'), enabled: () => calm() && s.phase !== 'engine', action: () => this.gauges() });
    it({ get x() { return s.joshu.x; }, y: B, w: 14, get label() { return self.flag('v4:fishToJoshu') && !self.flag('v4:fishUsed') ? 'Give Joshu the fish' : 'Talk to Joshu'; }, get standX() { return s.joshu.x - 22; }, quest: () => (rounds() && !this.flag('v4:round:joshu')) || (this.flag('v4:fishToJoshu') && !this.flag('v4:fishUsed')), enabled: () => calm() && s.joshu.y === B, action: () => (this.flag('v4:fishToJoshu') && !this.flag('v4:fishUsed') ? this.giveFish() : this.talkJoshu()) } as never);
    // fishing at the stern
    it({ x: SPOTS.fishing[0], y: SPOTS.fishing[1], w: 18, label: 'Fish off the stern', standX: SPOTS.fishing[0] + 8, quest: () => (V()['v4:fishCaught'] ?? 0) < 1 && !this.flag('v4:fishUsed'), enabled: () => s.phase === 'deck', action: () => this.fish() });
    it({ get x() { return s.jenna.x; }, get y() { return s.jenna.y; }, w: 14, label: 'Talk to Jenna', get standX() { return s.jenna.x + 22; }, quest: () => rounds() && !this.flag('v4:round:jenna'), enabled: () => calm() && s.phase !== 'engine', action: () => this.talkJenna() } as never);
    s.questPoints.push({ x: () => 150, y: () => L - 34, on: () => s.phase === 'engine' && !this.flag('v4:engineArrive') });
    // once the rounds are done: up on deck for the photo of the day
    s.questPoints.push({ x: () => 120, y: () => D - 46, on: () => (V()['v4:rounds'] ?? 0) >= 4 && !this.flag('v9:morningBird') && s.level() === 'lower' });
    // laptop
    it({ x: SPOTS.moriDesk[0] - 4, y: L, label: 'Use your laptop', standX: SPOTS.moriDesk[0] + 8, quest: () => ((V()['v4:rounds'] ?? 0) >= 4 && this.flag('v9:morningBird') && !this.flag('v4:report')) || shipUploadDue(), enabled: calm, action: () => this.laptop() });
    // flavour: things to poke at around the boat
    const look = (x: number, y: number, label: string, lines: () => BubbleLine[], o: Partial<Interactable> = {}) => it({ x, y, label, standX: x, enabled: calm, action: () => this.say(lines()).then(() => {}), ...o });
    // (nothing to poke at on the mess table itself: it's where you sit down to eat)
    look(SPOTS.photosJ[0], B, 'The framed photos', () => [
      { who: 'mori', text: 'Little Jenna holding a fish bigger than she is. She looks thrilled. The fish looks less thrilled.', expr: 'happy' },
      { who: 'mori', text: 'And the woman in the sun hat... Jenna’s mum. Joshu keeps her right where he can see her from his bunk.', expr: 'sad' },
    ]);
    look(SPOTS.fridge[0], H, 'The fridge', () => [{ who: 'mori', text: 'Milk, eggs, a jar labelled “DO NOT EAT (SCIENCE)”, and a jar labelled “DO NOT EAT (JOSHU’S)”. I respect both.', expr: 'neutral' }]);
    look(SPOTS.herbs[0], SPOTS.herbs[1], 'Joshu’s herb garden', () => [{ who: 'mori', text: 'Basil, thyme, and a very determined chilli plant. Joshu talks to them every morning. They seem happier than me.', expr: 'happy' }]);
    look(SPOTS.microscope[0], L, 'The microscope', () => [{ who: 'mori', text: 'Yesterday’s plankton sample. Copepods, diatoms, and one very confused baby crab.', expr: 'happy' }]);
  }

  // ---------------------------------------------------------------- breakfast
  private async noodles() {
    const s = this.s;
    s.cutscene = true;
    this.p.facing = 1;
    await this.say([{ who: 'mori', text: 'Kettle on. Now: the most delicate procedure in all of marine science.', expr: 'determined' }]);
    this.pose('pour');
    const { runRamenPour } = await import('../../ui/v6/ramen');
    const res = await runRamenPour();
    this.pose(null);
    const line: Record<string, BubbleLine> = {
      perfect: { who: 'mori', text: 'Right on the line. Textbook noodle hydration.', expr: 'smug' },
      over: { who: 'mori', text: 'Aaand that’s soup now. Noodle soup. Still counts.', expr: 'worried' },
      under: { who: 'mori', text: 'Little crunchy. Crunchy is a texture.', expr: 'thinking' },
    };
    await this.say([line[res] ?? line.perfect]);
    // he heard the kettle: over he comes
    await Promise.race([s.buddy.come(this.p.x + 18, 80), wait(2500)]);
    s.chunk.stopWalk();
    s.chunk.alpha = 1;
    s.chunk.faceTo(this.p.x);
    s.chunk.idleAnim = 'beg';
    s.chunk.setAnim('beg');
    await this.say([
      { who: 'chunk', text: '...', expr: 'excited', close: false },
      { who: 'mori', text: 'Don’t look at me like that. Dogs can’t have noodles. We’ve been over this. With a vet.', expr: 'teasing' },
      { who: 'chunk', text: '*very quiet whine*', expr: 'sad', close: false },
    ]);
    s.chunk.idleAnim = 'idle';
    s.buddy.release();
    this.set('v4:noodles');
    s.cutscene = false;
    s.bark('mori', 'Three minutes. I’ll eat at the mess table.', { expr: 'happy' });
  }

  private async eat() {
    const s = this.s;
    s.cutscene = true;
    this.p.facing = 1;
    this.pose('sit');
    await wait(500);
    this.pose('eat');
    audio.play('munch', { vol: 0.5 });
    await this.say([
      { who: 'mori', text: 'Mmm. Chicken flavour. Which chicken? Nobody knows. Science can’t answer everything.', expr: 'eat' },
    ]);
    await Promise.race([s.buddy.come(this.p.x + 20, 80), wait(2500)]);
    s.chunk.stopWalk();
    s.chunk.alpha = 1;
    s.chunk.faceTo(this.p.x);
    s.chunk.idleAnim = 'beg';
    s.chunk.setAnim('beg');
    s.chunk.showEmote('heart', 1.4);
    await this.say([
      { who: 'chunk', text: '*stares with the full weight of his soul*', expr: 'excited', close: false },
      { who: 'mori', text: '...', expr: 'grumpy' },
      { who: 'mori', text: 'Fine. ONE biscuit. One.', expr: 'tired' },
    ]);
    s.chunk.idleAnim = 'eat';
    s.chunk.setAnim('eat');
    s.chunk.setExpr('eat');
    audio.play('munch', { vol: 0.4, pitch: 1.4 });
    await this.say([{ who: 'chunk', text: 'Snrf snrf snrf snrf.', expr: 'eat', close: false }]);
    await wait(600);
    s.chunk.setExpr('happy', 2);
    s.chunk.idleAnim = 'idle';
    s.buddy.release();
    this.pose('standUp');
    await wait(260);
    this.pose(null);
    this.set('v4:ate');
    s.cutscene = false;
    await this.say([{ who: 'mori', text: 'Right. Morning rounds: fish, engine, captain, Jenna. In order of how likely they are to bite me.', expr: 'determined' }]);
  }

  /** a sharp, visible seabird in a camera photo ticks the report's "photo of the day" step */
  private watchBirdPhotos() {
    const s = this.s;
    const prev = s.cam.onShot;
    s.cam.onShot = (ph: RawPhoto) => {
      prev?.(ph);
      if (this.flag('v9:morningBird') || !this.flag('v4:ate')) return;
      if (!ph.subjects.some(isBirdShot)) return;
      this.set('v9:morningBird');
      game.ui.toast('Photo of the day: <b>got one!</b> Write it up on your laptop.', 'REPORT', 'teal', 3600);
      s.bark('mori', 'Ooh. That one’s going in the report.', { expr: 'happy' });
    };
  }

  // ---------------------------------------------------------------- rounds
  private round(k: string) {
    if (this.flag('v4:round:' + k)) return;
    this.set('v4:round:' + k);
    this.inc('v4:rounds');
    const n = V()['v4:rounds'];
    if (n < 4) game.ui.toast(`Morning rounds: <b>${n}/4</b>`, 'ROUNDS', 'teal', 2200);
    else game.ui.toast('Rounds done. Time for the report.', 'ROUNDS', 'teal', 3000);
  }

  private async tank() {
    const first = !this.flag('v4:round:tank');
    this.p.facing = -1;
    if (first) {
      await this.p.doWork('pour', 1.4);
      await this.say([
        { who: 'mori', text: 'Morning, team! Gerald. Captain Bubbles. Tiny Tim. And... the one who never comes out.', expr: 'happy' },
        { who: 'mori', text: 'Breakfast is served. Eat up, you beautiful little data points.', expr: 'happy' },
      ]);
      this.round('tank');
    } else {
      await this.say([{ who: 'mori', text: rand.pick(['Gerald is doing laps again. Gerald has a lot of energy.', 'Captain Bubbles is judging me. I can tell.', 'Still haven’t seen the shy one. One day.']), expr: 'happy' }]);
    }
  }

  private async gauges() {
    const first = !this.flag('v4:round:engine');
    await this.say(first ? [
      { who: 'mori', text: 'Oil pressure’s a bit low. And is it supposed to rattle like that?', expr: 'thinking' },
      { who: 'mori', text: 'Jenna says the engine runs on “vibes and duct tape.” I’m choosing to believe that’s a joke.', expr: 'worried' },
    ] : [{ who: 'mori', text: 'Still rattling. Still running. That’s the whole engineering philosophy on this boat.', expr: 'neutral' }]);
    this.round('engine');
  }

  private async talkJoshu() {
    const s = this.s;
    s.joshu.faceTo(this.p.x);
    if (!this.flag('v4:round:joshu')) {
      await this.say([
        { who: 'joshu', text: 'Mornin’, Doc! Sleep alright?', expr: 'happy' },
        { who: 'mori', text: 'Chunk slept on my face again.', expr: 'tired' },
        { who: 'joshu', text: 'Hah! That dog’s got more sense than both of us. Warmest spot on the boat.', expr: 'laugh' },
        { who: 'joshu', text: 'Glass has been jumpy all mornin’, though. And my knee’s achin’. Old sailor’s barometer, that knee.', expr: 'thinking' },
        { who: 'mori', text: 'Is that... a scientific instrument?', expr: 'teasing' },
        { who: 'joshu', text: 'Forty years at sea, lad. Never been wrong.', expr: 'smug' },
        { who: 'joshu', text: '...Well. Twice.', expr: 'grumpy' },
        { who: 'joshu', text: 'Go on, do your rounds. Look after my girl, she’s been up all night with them computers again.', expr: 'happy' },
      ]);
      this.round('joshu');
    } else if (s.phase === 'deck') {
      await this.say([{ who: 'joshu', text: rand.pick(['Catch anything yet? Remember: patience, and a bit of bread on the hook when nobody’s looking.', 'That vanebill’s been following us since dawn. Hear it whistlin’? Good luck, that is.']), expr: 'happy' }]);
    } else {
      await this.say([{ who: 'joshu', text: rand.pick(['Sea’s like glass. Makes me nervous.', 'You want to steer? Ha! Maybe when you can tie a bowline without looking it up.', 'Jenna’s mum used to say the sea keeps secrets. She was usually right.']), expr: 'neutral' }]);
    }
    s.joshu.faceTo(s.joshu.x + 10);
  }

  private async talkJenna() {
    const s = this.s, j = s.jenna;
    j.faceTo(this.p.x);
    const was = j.idleAnim;
    j.setAnim('idle');
    if (!this.flag('v4:round:jenna')) {
      await this.say([
        { who: 'jenna', text: 'GOOOOD MORNING, MORI!!', expr: 'excited', style: 'shout', react: 'jump' },
        { who: 'mori', text: 'You’re wearing headphones. You don’t have to yell.', expr: 'tired' },
        { who: 'jenna', text: 'I’m not yelling, I’m ENTHUSIASTIC!', expr: 'laugh' },
        { who: 'jenna', text: 'Guess what! I trained the fish counter overnight! It can tell a gull from a cloud now! Mostly!', expr: 'excited' },
        { who: 'mori', text: '...Mostly?', expr: 'worried' },
        { who: 'jenna', text: 'It thinks Chunk is a potato. But honestly? Fair.', expr: 'teasing' },
        { who: 'chunk', text: 'Hff.', expr: 'grumpy' },
        { who: 'jenna', text: 'Go write your boring report, nerd! I’ll be here! Coding the FUTURE!', expr: 'happy' },
      ]);
      this.round('jenna');
    } else {
      await this.say([{ who: 'jenna', text: rand.pick(['Shh! I’m in the zone! The zone is very fragile!', 'Do you think the fish counter should have a voice? I’m thinking... pirate.', 'If Dad asks, I definitely slept.']), expr: 'happy' }]);
    }
    j.setAnim(was);
  }

  // ---------------------------------------------------------------- laptop
  private async laptop() {
    const s = this.s;
    s.cutscene = true;
    this.p.facing = -1;
    this.pose('type');
    const { openMoriOS } = await import('../../ui/v4/moriOS');
    const canReport = V()['v4:rounds'] >= 4 && this.flag('v4:ate') && this.flag('v9:morningBird');
    await openMoriOS({ report: canReport && !this.flag('v4:report') });
    this.pose(null);
    s.cutscene = false;
    if (!canReport && !this.flag('v4:report')) {
      const why = !this.flag('v4:ate') ? 'Breakfast first. I don’t write reports on an empty stomach.'
        : (V()['v4:rounds'] ?? 0) < 4 ? 'I can’t write the morning report before the morning rounds. That’s just fiction.'
        : 'The report needs a photo of the day. A real one. Up on deck, find a seabird, camera out.';
      await this.say([{ who: 'mori', text: why, expr: 'thinking' }]);
      return;
    }
    if (this.flag('v4:report') && !this.flag('v4:engineCall')) this.engineCall();
  }

  // ---------------------------------------------------------------- engine
  private placeJenna(where: 'engine' | 'desk') {
    const j = this.s.jenna;
    if (where === 'engine') { j.x = 146; j.y = S4.lower.floor; j.facing = -1; j.idleAnim = 'scared'; j.setAnim('scared'); }
    else { j.x = SPOTS.jennaDesk[0]; j.y = S4.lower.floor; j.facing = 1; j.idleAnim = 'typeFast'; j.setAnim('typeFast'); }
  }

  async engineCall() {
    const s = this.s;
    this.set('v4:engineCall');
    s.phase = 'engine';
    await wait(1200);
    s.cutscene = true;
    // the engine coughs and dies; the lights stutter
    for (let i = 0; i < 4; i++) { s.power = 0.2; await wait(90); s.power = 1; await wait(140 + i * 60); }
    audio.play('woodCreak', { vol: 0.6 });
    s.st.shake(2, 0.5);
    audio.setEngine(0);
    s.engineOn = false;
    this.placeJenna('engine');
    await wait(500);
    await this.say([
      { who: 'jenna', text: 'MORIIIIIIIIIIIIII!!!', style: 'shout', expr: 'shocked' },
      { who: 'jenna', text: 'ENGINE ROOM! NOW! IT’S DOING THE THING!', style: 'shout', expr: 'scared' },
      { who: 'mori', text: 'The... THING?!', expr: 'shocked' },
      { who: 'chunk', text: 'BOOF!', expr: 'surprised', react: 'jump' },
    ]);
    s.cutscene = false;
    startQuest('v4engine');
  }

  private async engineArrive() {
    const s = this.s;
    this.set('v4:engineArrive');
    s.cutscene = true;
    this.p.walkTo(282, 70).catch(() => {});
    s.jenna.faceTo(this.p.x);
    await this.say([
      { who: 'jenna', text: 'Okay so! Don’t panic! I was doing a TEENY firmware update on the fuel controller...', expr: 'worried' },
      { who: 'jenna', text: '...and it went *ka-CHUNK* and then *pssshhhhh* and now it’s just... sad.', expr: 'sad' },
      { who: 'mori', text: 'You updated the ENGINE?!', expr: 'shocked' },
      { who: 'jenna', text: 'It’s a smart engine now! ...Was. It WAS a smart engine.', expr: 'smug' },
      { who: 'joshu', text: 'Whatever you two did down there, UNDO IT! We’re driftin’!', style: 'shout', expr: 'angry' },
      { who: 'mori', text: 'Okay. Okay! We can fix this. What does the diagnostic say?', expr: 'determined' },
      { who: 'jenna', text: 'Air in the fuel line, a blown fuse, and the fuel valve’s stuck! Teamwork time!', expr: 'determined' },
    ]);
    s.jenna.idleAnim = 'type';
    s.jenna.setAnim('type');
    await this.engineFix();
  }

  private async engineFix() {
    const s = this.s;
    const { runEngineRepair } = await import('../../ui/v6/engine');
    const ok = await runEngineRepair({
      onStep: async (k: string) => {
        // mirror the minigame with the sprites
        const map: Record<string, [string, string]> = { valve: ['wrench', 'type'], bleed: ['pull', 'point'], fuse: ['grab', 'hype'], start: ['push', 'cheer'] };
        const m = map[k];
        if (m) { this.pose(m[0]); s.jenna.setAnim(m[1]); }
      },
    });
    this.pose(null);
    if (!ok) { s.cutscene = false; return; }
    audio.setEngine(0.5);
    s.engineOn = true;
    s.st.shake(1.5, 0.6);
    s.jenna.setAnim('hype');
    this.p.body.showEmote('sparkle', 1.4);
    await this.say([
      { who: 'jenna', text: 'WE DID IT!! Up top!', expr: 'excited', style: 'shout', react: 'jump' },
      { who: 'mori', text: 'Teamwork!', expr: 'laugh' },
      { who: 'chunk', text: 'Boof boof!', expr: 'excited', react: 'jump' },
      { who: 'joshu', text: 'THAT’s the sound I like! Good work, you two.', expr: 'laugh' },
      { who: 'joshu', text: 'Tell you what: take the afternoon. Weather’s holding, for now. Go take your pictures, Doc. And catch us some dinner!', expr: 'happy' },
      { who: 'jenna', text: 'I’m gonna go un-update everything. Quietly. Forever.', expr: 'teasing' },
    ]);
    this.placeJenna('desk');
    this.set('v4:engineFixed');
    s.phase = 'deck';
    s.cutscene = false;
    const { startDeckLife } = await import('./seafauna');
    startDeckLife(s);
  }

  /** the storm (see storm.ts) */
  async storm() {
    const { runStorm } = await import('./storm');
    await runStorm(this.s);
  }

  // ---------------------------------------------------------------- deck: fishing
  private async fish() {
    const s = this.s;
    this.p.facing = -1;
    s.cutscene = true;
    const { goFishing } = await import('../../ui/v4/fishing');
    // Mori keeps the catch in his hands while he decides what to do with it
    const c = await goFishing(s as never, { keepHeld: true });
    const putDown = () => { s.setHeld(null); this.pose(null); };
    if (!c) { s.cutscene = false; return; }
    if (this.flag('v4:fishToTank') || this.flag('v4:fishToJoshu') || this.flag('v4:fishUsed')) {
      await this.say([{ who: 'mori', text: `Another ${c.fish.name.toLowerCase()}! You’re free to go, buddy. Tell your friends I’m nice.`, expr: 'happy' }]);
      putDown();
      audio.play('splash', { vol: 0.3 });
      s.cutscene = false;
      return;
    }
    V()['v4:fishLen'] = c.len;
    F()['v4:fishName:' + c.fish.name] = true;
    this.caught = c.fish.name;
    this.caughtId = c.fish.id;
    F()['v4:fishId:' + c.fish.id] = true;
    const ch = await this.say([
      { who: 'mori', text: `A ${c.fish.name}! ${c.len} centimetres of pure science. Or dinner.`, expr: 'excited', choices: ['Study it in the hold tank', 'Give it to Joshu to cook'] },
    ]);
    putDown();
    s.cutscene = false;
    if (ch === 0) {
      this.set('v4:fishToTank');
      game.ui.toast(`Take the ${c.fish.name.toLowerCase()} to the <b>tank in the hold</b> (below deck, forward).`, 'FISH', 'teal', 4200);
    } else {
      this.set('v4:fishToJoshu');
      game.ui.toast(`Take the ${c.fish.name.toLowerCase()} to <b>Joshu in the wheelhouse</b>.`, 'FISH', 'teal', 4200);
    }
  }
  private caught = 'fish';
  private caughtId = 'snoutbass';

  private async releaseFish() {
    const s = this.s;
    s.cutscene = true;
    this.p.facing = -1;
    await this.p.doWork('pour', 1.2);
    const saved = Object.keys(F()).find(k => k.startsWith('v4:fishId:'));
    s.addTankFish(saved ? saved.slice(10) : this.caughtId);
    audio.play('splash', { vol: 0.4 });
    await this.say([
      { who: 'mori', text: `In you go. Gerald, Captain Bubbles, everyone: this is our new colleague, the ${this.caught.toLowerCase()}.`, expr: 'happy' },
      { who: 'mori', text: 'Field notes: healthy adult, bright eyes, good colour. Behaviour: deeply offended. Noted.', expr: 'thinking' },
      { who: 'chunk', text: '*nose pressed to the glass*', expr: 'excited', close: false },
    ]);
    s.cutscene = false;
    this.set('v4:fishUsed');
    game.ui.toast(`Research log: <b>${this.caught}</b> added.`, 'LAB', 'teal', 3000);
  }

  private async giveFish() {
    const s = this.s;
    s.cutscene = true;
    s.joshu.faceTo(this.p.x);
    await this.say([
      { who: 'joshu', text: `Now THAT’s a beauty! Look at the size of it!`, expr: 'laugh' },
      { who: 'joshu', text: 'I’ll have it in the pan before you can say “lemon butter.” Jenna! Dinner in twenty!', expr: 'happy' },
      { who: 'jenna', text: 'LEMON BUTTER!!', style: 'shout', expr: 'excited' },
      { who: 'joshu', text: 'Take the wheel a sec, Doc. Just... hold it straight. Nothin’ fancy.', expr: 'teasing' },
      { who: 'mori', text: 'Hold it straight. Nothing fancy. Got it.', expr: 'determined' },
    ]);
    // Joshu heads down to the galley to cook; Jenna comes to set the table
    const j = s.joshu;
    j.x = SPOTS.stove[0] + 6; j.y = S4.house.floor; j.facing = -1;
    j.idleAnim = 'cook'; j.setAnim('cook');
    const je = s.jenna;
    je.x = SPOTS.chess[0] + 8; je.y = S4.house.floor; je.facing = -1;
    je.idleAnim = 'talk'; je.setAnim('idle');
    this.set('v4:fishUsed');
    this.set('v4:joshuCooking');
    s.cutscene = false;
    game.ui.toast('Smells like lemon butter already.', 'GALLEY', 'teal', 2600);
  }

  /** the storm (see storm.ts) */
  private stormArmed = false;
  /** seconds until the storm breaks (0: not counting down) */
  private stormIn = 0;

  // ---------------------------------------------------------------- per frame
  /** the crew's daily routines (v9/crewlife.ts) */
  crew: CrewLife | null = null;
  update(dt: number) {
    const s = this.s, p = s.player;
    this.crew?.update(dt);
    if (s.phase === 'engine' && !this.flag('v4:engineArrive') && !s.cutscene && p.y > S4.lower.ceil && p.x < 196) this.engineArrive();
    // the afternoon ends: once the deck quest wraps up, the storm arrives
    if (s.phase === 'deck' && !this.stormArmed && questStatus('v4deck') === 'done' && !s.cutscene) {
      this.stormArmed = true;
      this.stormIn = 6;
    }
    // it only breaks while Mori is free (not mid-dialogue, at the laptop, fishing or on a ladder)
    if (this.stormIn > 0) {
      const free = !s.cutscene && !s.busyAction && !game.ui.blocking && !game.ui.bubbles.active && p.state === 'normal' && p.onGround && !s.cam.active;
      if (free || this.stormIn > 1) this.stormIn -= dt;
      if (this.stormIn <= 0) { this.stormIn = 0; void this.storm(); }
    }
    // Chunk shivers out on the open deck
    if (s.buddy) s.buddy.cold = s.level() !== 'lower' && s.inside < 0.5;
  }
}

/** a camera subject that counts as a usable seabird photo */
export function isBirdShot(x: { species: string; visible: number; inFrame: number; focus: number }) {
  return SPECIES_BY_ID[x.species]?.group === 'Bird' && x.visible > 0.4 && x.inFrame > 0.4 && x.focus > 0.35;
}

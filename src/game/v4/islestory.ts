// V4 island story, part one: washed ashore. Mori wakes on the sand, wakes Jenna, finds Chunk in the
// wreck happily eating canned dog food, and they split up to find Joshu. Along the shoreline: wildlife,
// Joshu's boot prints, the Corvex Seal (whom Chunk wakes up, naturally), the glowworm cave, Joshu's
// boots, a trail up the bush track and Joshu himself, out cold by the creek. Part two (the walk back,
// Aroha, making camp, the night) lives in islecamp.ts.

import { game } from '../game';
import type { IslandScene4, IsleHooks } from './island';
import { startQuest, questStatus } from '../quests';
import { audio } from '../../core/audio';
import { animInfo } from '../../world/actor';
import type { Actor } from '../../world/actor';
import type { Interactable } from '../../world/npc';
import type { BubbleLine } from '../../ui/bubbles';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { local, A } from '../assets';
import type { Frame } from '../../gfx/renderer';
import { ChunkBuddy } from './buddy';
import { CorvexSeal } from './seal';
import { startShoreLife } from './shorelife';
import { startWildlife9 } from '../v9/wildlife';
import { ISL, SPOT, WRECK, groundY } from '../../art/island4/layout';
import * as CA from '../../art/island4/camp';
import { clamp, rand, smoothstep } from '../../core/math';
import { IsleCamp } from './islecamp';

export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const F = () => game.save.flags;
const V = () => game.save.vars;

/** where the sun should be for this save when the island loads */
export function dayTimeForSave(): number {
  const f = F();
  if (f['v4:day1']) return 3.96;
  if (f['v4:dinner']) return 3.9;
  if (f['v4:arohaJoined']) return 2.85;
  if (f['v4:back']) return 2.55;
  if (f['v4:joshuAwake']) return 1.9;
  if (f['v4:split']) return 0.45;
  return 0.1;
}

export function attachIsleStory(s: IslandScene4): IslandScene4 {
  const st = new IsleStory(s);
  s.story = st;
  return s;
}

/** an NPC that trails the player at a gap */
export class Follower {
  on = true;
  constructor(readonly a: Actor, readonly s: IslandScene4, public gap = 34, public walk = 50, public run = 108, public walkAnim = 'walk') {}
  update() {
    if (!this.on) return;
    const p = this.s.player, a = this.a;
    const want = p.x - p.facing * this.gap;
    const d = want - a.x;
    if (Math.abs(d) > 60 || (Math.abs(d) > 20 && Math.abs(p.vx) < 5 && !a.walking)) {
      const run = Math.abs(d) > 120 || Math.abs(p.vx) > 90;
      if (!a.walking || Math.abs(d) > 40) a.walkTo(want, run ? this.run : this.walk, run && this.walkAnim === 'walk' ? 'run' : this.walkAnim);
    } else if (!a.walking) a.faceTo(p.x);
    if (Math.abs(a.y - p.y) > 16 && p.state !== 'climb') { a.x = p.x - p.facing * this.gap; a.y = p.y; }
  }
}

interface StoryProp { id: string; f: Frame; x: number; y: number; z: number; show: () => boolean; glow?: Frame }

export class IsleStory implements IsleHooks {
  seal!: CorvexSeal;
  jennaF!: Follower;
  joshuF!: Follower;
  camp: IsleCamp;
  private triggers: { id: string; when: () => boolean; run: () => Promise<void> | void }[] = [];
  private busy = false;
  private camTw: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; t: number; dur: number; res: () => void } | null = null;
  private props: StoryProp[] = [];
  private chaseStartX = SPOT.sealRock;

  constructor(readonly s: IslandScene4) {
    this.camp = new IsleCamp(this);
  }

  // ---------------------------------------------------------------- helpers
  flag(k: string) { return !!F()[k]; }
  set(k: string, v = true) { F()[k] = v; game.persist(); this.s.hud?.refresh(true); }
  inc(k: string, n = 1) { V()[k] = (V()[k] ?? 0) + n; game.persist(); this.s.hud?.refresh(true); }
  say(lines: BubbleLine[]) { return this.s.say(lines); }
  get p() { return this.s.player; }
  pose(anim: string | null) { this.p.poseOverride = anim; }
  async once(anim: string, a?: Actor) {
    if (a) { await a.play(anim); return; }
    const i = animInfo(anim, 'mori');
    this.pose(anim);
    await wait((i.frames / i.fps) * 1000);
  }
  place(a: Actor, x: number, facing = 1, anim = 'idle', y?: number) {
    a.stopWalk();
    a.x = x;
    a.y = y ?? groundY(x);
    a.facing = facing;
    a.visible = true;
    a.alpha = 1;
    a.idleAnim = anim;
    a.setAnim(anim);
  }
  hide(a: Actor) { a.stopWalk(); a.visible = false; a.x = -600; }
  async cut<T>(fn: () => Promise<T>): Promise<T> {
    const s = this.s;
    s.cutscene = true;
    this.busy = true;
    try { return await fn(); } finally { s.cutscene = false; this.busy = false; this.pose(null); }
  }
  /** glide the locked camera to a point (null = back to the player) */
  pan(x: number | null, y: number | null, zoom = this.s.zoomBase, dur = 1.2): Promise<void> {
    const c = this.s.st.cam;
    if (x === null) { c.locked = false; c.tzoom = zoom; return wait(dur * 600); }
    c.locked = true;
    return new Promise(res => { this.camTw = { x0: c.x, y0: c.y, z0: c.zoom, x1: x, y1: y ?? c.y, z1: zoom, t: 0, dur, res }; });
  }
  async fadeOut(speed = 1.6) { await game.fadeTo(1, speed); }
  async fadeIn(speed = 1.2) { await game.fadeTo(0, speed); }
  trigger(id: string, when: () => boolean, run: () => Promise<void> | void) {
    if (this.flag('trg:' + id)) return;
    this.triggers.push({ id, when, run });
  }
  prop(id: string, sp: CA.CampSprite, x: number, y: number, show: () => boolean, z = -2) {
    const f = local.add('isp:' + id, sp.buf, sp.ax, sp.ay);
    const glow = sp.glow ? local.add('ispg:' + id, sp.glow, sp.ax, sp.ay) : undefined;
    const P: StoryProp = { id, f, x, y, z, show, glow };
    this.props.push(P);
    this.s.main.add(new Custom(z, rr => {
      if (!P.show()) return;
      rr.draw(P.f, P.x, P.y);
      if (P.glow) { rr.emissive(1); rr.draw(P.glow, P.x, P.y); rr.emissive(); }
    }));
    return P;
  }
  it(o: Partial<Interactable> & { x: number; y: number; label: string; action: () => void | Promise<void> }) {
    // keep getters live (x/y/label can follow a moving actor): no object spread
    const it = o as Interactable & { w?: number; h?: number };
    if (it.w === undefined) it.w = 14;
    if (it.h === undefined) it.h = 18;
    this.s.interact.push(it as Interactable);
  }
  radio(text: string, expr = 'neutral'): BubbleLine { return { who: 'jenna', text: `<i>*kssht*</i> ${text}`, expr }; }

  // ---------------------------------------------------------------- setup
  async enter() {
    const s = this.s;
    s.chunk = s.addActor('chunk', -600, ISL.GY, 1);
    s.jenna = s.addActor('jenna', -600, ISL.GY, 1);
    s.joshu = s.addActor('joshu', -600, ISL.GY, 1);
    s.aroha = s.addActor('aroha', -600, ISL.GY, 1);
    for (const a of [s.chunk, s.jenna, s.joshu, s.aroha]) { a.visible = false; a.z = 44; }
    s.chunk.z = 46;
    s.buddy = new ChunkBuddy(s.chunk, { player: s.player, terrain: s.st.terrain });
    s.buddy.mode = 'script';
    s.buddy.cold = false;
    this.jennaF = new Follower(s.jenna, s, 30, 52, 112);
    this.jennaF.on = false;
    this.joshuF = new Follower(s.joshu, s, 40, 36, 60, 'limp');
    this.joshuF.on = false;
    this.seal = new CorvexSeal(s, SPOT.sealRock);
    this.seal.tireX = SPOT.sealTired;
    s.main.add(this.seal);
    s.animals.push(this.seal as never);
    this.seal.onCatch = () => { void this.caught(); };
    this.seal.onTired = () => { void this.sealTired(); };
    this.buildProps();
    this.addInteractables();
    startShoreLife(s);
    startWildlife9(s);
    s.onNewSpecies = sp => this.newSpecies(sp);
    this.camp.setup();
    await this.restore();
  }

  private buildProps() {
    const fl = (k: string) => () => this.flag(k);
    const notF = (k: string) => () => !this.flag(k);
    // in the wreck: the burst crate of Chunky Chow
    this.prop('chow', CA.chunkyChow(), SPOT.chunkEat + 14, WRECK.floor - 5, () => true, -5.2);
    // Joshu's boots in the cove, his jacket on a twig up the track
    this.prop('boots', CA.boots(), SPOT.boots, groundY(SPOT.boots) + 6, notF('v4:joshuAwake'), -2);
    this.prop('scrap', CA.jacketScrap(), 6130, groundY(6130) - 18, () => true, -2);
    // footprints: Joshu's boot prints along the beach (limping), then bare feet up the track
    const prints: [number, number, boolean][] = [];
    for (let x = 3440; x < 4960; x += 15) prints.push([x, groundY(x) + 30 + Math.sin(x * 0.05) * 3 + ((x / 15) % 2 ? 3 : 0), true]);
    for (let x = SPOT.boots + 20; x < SPOT.joshu - 30; x += 13) prints.push([x, groundY(x) + 6 + ((x / 13) % 2 ? 3 : 0), false]);
    this.s.main.add(new Custom(-9.5, rr => {
      const x0 = rr.visibleX0(10), x1 = rr.visibleX1(10);
      rr.beginShadows();
      for (const [x, y, boot] of prints) {
        if (x < x0 || x > x1) continue;
        if (!boot && !this.flag('v4:shoes')) continue;
        rr.draw(A.shadow, x, y, boot ? 0.2 : 0.14, 0.09, 0, packColor(0, 0, 0, boot ? 0.4 : 0.32));
      }
      rr.endShadows();
    }));
    void fl;
  }

  private addInteractables() {
    const s = this.s;
    const self = this;
    // wake Jenna
    this.it({ get x() { return s.jenna.x; }, get y() { return s.jenna.y; }, w: 20, label: 'Wake Jenna', get standX() { return s.jenna.x - 22; }, quest: () => true, enabled: () => this.flag('v4:isleWoke') && !this.flag('v4:jennaAwake'), action: () => this.wakeJenna() } as never);
    // the wreck: in and out through the breach
    const ld = { x: WRECK.climbX, y0: WRECK.floor, y1: groundY(WRECK.climbX) };
    this.it({ x: WRECK.climbX, y: ld.y1, w: 16, label: 'Climb in through the hole', standX: WRECK.climbX, quest: () => this.flag('v4:jennaAwake') && !this.flag('v4:chunkWreck'), enabled: () => !s.inWreck, action: () => this.climbIn(ld) });
    this.it({ x: WRECK.climbX, y: ld.y0, w: 16, label: 'Climb out onto the sand', standX: WRECK.climbX, enabled: () => s.inWreck && Math.abs(this.p.x - WRECK.climbX) < 40, action: () => s.climbLadder(ld, 1) });
    // Chunk, eating
    this.it({ get x() { return s.chunk.x; }, get y() { return s.chunk.y; }, w: 18, label: 'Chunk!', get standX() { return s.chunk.x - 26; }, quest: () => true, enabled: () => s.inWreck && this.flag('v4:jennaAwake') && !this.flag('v4:chunkWreck'), action: () => this.foundChunk() } as never);
    // Chunk found before Jenna is awake
    this.it({ get x() { return s.chunk.x; }, get y() { return s.chunk.y; }, w: 18, label: 'Chunk!', get standX() { return s.chunk.x - 26; }, enabled: () => s.inWreck && !this.flag('v4:jennaAwake'), action: () => this.say([
      { who: 'mori', text: 'Chunk! You’re okay! ...And you’re eating. Of course you are.', expr: 'surprised' },
      { who: 'chunk', text: '*crunch crunch crunch*', expr: 'eat', close: false },
      { who: 'mori', text: 'Stay right there, buddy. I have to find Jenna.', expr: 'determined' },
    ]).then(() => {}) } as never);
    // looks around the wreck
    const look = (x: number, y: number, label: string, lines: () => BubbleLine[], en: () => boolean = () => true) => this.it({ x, y, label, standX: x, enabled: en, action: () => this.say(lines()).then(() => {}) });
    look(SPOT.tank, WRECK.floor, 'The fish tank', () => [
      { who: 'mori', text: 'The tank held. Cracked, half empty... and Gerald is still doing laps.', expr: 'surprised' },
      { who: 'mori', text: 'Gerald, you absolute legend.', expr: 'happy' },
    ], () => s.inWreck);
    look(SPOT.engine, WRECK.floor, 'The engine', () => [{ who: 'mori', text: 'Full of sand and seawater. Jenna is going to cry. Then she is going to fix it. Then she is going to cry again.', expr: 'worried' }], () => s.inWreck);
    look(774, WRECK.floor, 'Mori’s bunk', () => [{ who: 'mori', text: 'My sample jars! ...Most of my sample jars. Somewhere out there is a very confused plankton colony.', expr: 'sad' }], () => s.inWreck);
    // Joshu's boots and the trail
    this.it({ x: SPOT.boots, y: groundY(SPOT.boots), w: 18, label: 'Boots in the sand', standX: SPOT.boots - 16, quest: () => true, enabled: () => this.flag('v4:sealDone') && !this.flag('v4:shoes'), action: () => this.boots() });
    this.it({ x: 6130, y: groundY(6130), w: 16, label: 'A scrap of navy cloth', standX: 6118, quest: () => true, enabled: () => this.flag('v4:shoes') && !this.flag('v4:joshuFound'), action: () => this.say([
      { who: 'mori', text: 'Navy wool, snagged on the twig. That’s from his jacket. He came this way, and not long ago.', expr: 'determined' },
      { who: 'chunk', text: '*sniff sniff sniff* BOOF.', expr: 'serious' },
    ]).then(() => {}) });
    // Joshu
    this.it({ get x() { return s.joshu.x; }, get y() { return s.joshu.y; }, w: 26, get label() { return self.joshuLabel(); }, get standX() { return s.joshu.x - 30; }, quest: () => true, enabled: () => this.flag('v4:joshuFound') && !this.flag('v4:joshuAwake'), action: () => this.helpJoshu() } as never);
    this.it({ x: SPOT.creek, y: groundY(SPOT.creek), w: 18, label: 'Scoop up creek water in your hat', standX: SPOT.creek - 14, quest: () => true, enabled: () => this.flag('v4:joshuChecked') && !this.flag('v4:water') && !this.flag('v4:joshuAwake'), action: () => this.fetchWater() });
  }

  private joshuLabel() {
    if (!this.flag('v4:joshuChecked')) return 'Check on Joshu';
    if (this.flag('v4:water') && !this.flag('v4:splashed')) return 'Splash water on his face';
    return 'Try to wake Joshu';
  }

  // ---------------------------------------------------------------- restore
  private async restore() {
    const s = this.s, f = F();
    if (!f['v4:isleWoke']) return this.wakeOnSand();
    if (questStatus('v4shore') === 'hidden') startQuest('v4shore', true);
    // the seal (a reload mid-chase counts as having outrun it)
    if (f['trg:seal2'] && !f['v4:sealDone']) this.set('v4:sealDone');
    if (f['v4:sealDone']) { this.seal.x = SPOT.sealTired + 10; this.seal.set('asleep'); }
    // Joshu out cold until found and woken
    if (!f['v4:joshuAwake']) this.place(s.joshu, SPOT.joshu, -1, 'unconscious');
    if (f['v4:joshuAwake']) return this.camp.restore();
    if (!f['v4:jennaAwake']) {
      this.place(s.jenna, SPOT.jenna, 1, 'unconscious');
      s.jenna.setExpr('sleep');
      this.chunkInWreck();
      return;
    }
    if (!f['v4:chunkWreck']) {
      this.place(s.jenna, s.player.x - 30, 1);
      this.jennaF.on = true;
      this.chunkInWreck();
      return;
    }
    // split up: Jenna salvaging at the wreck, Chunk with Mori
    this.jennaAtWreck();
    this.chunkFollow();
    if (!f['v4:split']) { this.p.x = WRECK.climbX + 40; this.p.y = groundY(this.p.x); s.snapCamera(); await this.split(); }
    this.shoreTriggers();
  }

  chunkInWreck() {
    const c = this.s.chunk;
    this.place(c, SPOT.chunkEat, 1, 'eat', WRECK.floor - 6);
    c.setExpr('eat');
    this.s.buddy.mode = 'script';
  }
  chunkFollow() {
    const s = this.s;
    if (!s.chunk.visible || Math.abs(s.chunk.x - s.player.x) > 300) this.place(s.chunk, s.player.x - 30, 1);
    s.buddy.mode = 'follow';
    s.buddy.reset();
  }
  jennaAtWreck() {
    this.jennaF.on = false;
    this.place(this.s.jenna, 1420, -1, 'pick');
  }

  // ---------------------------------------------------------------- chapter A: washed ashore
  private async wakeOnSand() {
    const s = this.s, p = this.p;
    await this.cut(async () => {
      s.hud?.show(false);
      p.x = SPOT.moriWake; p.y = groundY(p.x); p.facing = 1;
      this.pose('lie');
      p.body.setExpr('tired');
      this.place(s.jenna, SPOT.jenna, 1, 'unconscious');
      s.jenna.setExpr('sleep');
      this.chunkInWreck();
      s.snapCamera();
      const c = s.st.cam;
      c.locked = true;
      c.x = p.x + 20; c.y = p.y - 30; c.zoom = 1.7;
      game.r.post.fade = 1;
      await wait(400);
      this.fadeIn(0.8);
      audio.setAmbience('beach', false);
      await wait(1400);
      await this.say([
        { who: 'mori', text: '...ngh.', expr: 'tired', close: false, auto: 900 },
        { who: 'mori', text: 'Sand. In my mouth. In my ears. In places sand should never go.', expr: 'tired' },
      ]);
      await this.once('getUp');
      this.pose('sitGround');
      await wait(300);
      await this.once('glasses');
      this.pose('sitGround');
      await this.say([{ who: 'mori', text: 'Glasses. Still on my face. Thank you, elastic strap. Best nine dollars I ever spent.', expr: 'happy' }]);
      await this.pan(p.x - 520, p.y - 60, 1.05, 2.4);
      await wait(600);
      await this.say([
        { who: 'mori', text: 'The Kittiwake...', expr: 'shocked' },
        { who: 'mori', text: 'She broke in half. Half of her is on the beach and the other half is out on the reef.', expr: 'sad' },
      ]);
      await this.pan(p.x + 200, p.y - 40, 1.3, 1.8);
      await this.say([{ who: 'mori', text: 'Is that... pink hair? JENNA!', expr: 'surprised', react: 'jump' }]);
      await this.once('standUp');
      this.pose(null);
      await this.pan(null, null);
      s.hud?.show(true);
      await game.ui.titleCard('Day 1', 'Washed Ashore', 'An island with no name', 2600);
      this.set('v4:isleWoke');
      startQuest('v4shore');
      game.ui.toast('Walk with <b>A</b>/<b>D</b>, hold <b>Shift</b> to run. <b>E</b> interacts. <b>Q</b> raises your camera.', 'TIP', 'teal', 6000);
    });
  }

  private async wakeJenna() {
    const s = this.s, j = s.jenna;
    await this.cut(async () => {
      this.p.facing = 1;
      this.pose('kneel');
      await this.say([
        { who: 'mori', text: 'Jenna. Jenna! Wake up. Please wake up.', expr: 'worried' },
        { who: 'jenna', text: '...five more minutes... compiling...', expr: 'sleep', close: false },
        { who: 'mori', text: 'JENNA.', expr: 'shocked', react: 'shake' },
      ]);
      j.setAnim('sitGround');
      j.setExpr('shocked', 2);
      j.react('jump');
      audio.play('emoteSurprise', { vol: 0.6 });
      await wait(500);
      await this.say([
        { who: 'jenna', text: 'I’M AWAKE! I’m awake! I was not asleep, I was... buffering!', expr: 'shocked', style: 'shout' },
        { who: 'jenna', text: 'Why is there SAND in my EVERYTHING? Why does my hair taste like fish?!', expr: 'angry' },
        { who: 'mori', text: 'The wave. We washed up. You’re okay? Nothing broken?', expr: 'worried' },
        { who: 'jenna', text: 'I... think so? My headphones survived. My dignity did not.', expr: 'grumpy' },
        { who: 'jenna', text: 'Wait. Wait wait wait. Where’s Dad? Where’s CHUNK?', expr: 'scared', react: 'jump' },
        { who: 'mori', text: 'I don’t know yet. The back half of the ship is up the beach. If Chunk is anywhere...', expr: 'thinking' },
        { who: 'jenna', text: '...he’s near food. Oh my gosh. The hold. The DOG FOOD.', expr: 'excited' },
      ]);
      j.setAnim('idle');
      await wait(300);
      this.pose(null);
      j.idleAnim = 'idle';
      this.jennaF.on = true;
      this.set('v4:jennaAwake');
      s.bark('jenna', 'Lead the way, nature boy! I’m right behind you!', { expr: 'determined' });
    });
  }

  private async climbIn(ld: { x: number; y0: number; y1: number }) {
    const s = this.s;
    await s.climbLadder(ld, -1);
    if (!this.flag('v4:jennaAwake') || this.flag('trg:wreckIn')) return;
    this.set('trg:wreckIn');
    // crunch... crunch... slurp
    audio.play('munch', { vol: 0.6, pitch: 0.8 });
    setTimeout(() => audio.play('munch', { vol: 0.5, pitch: 0.9 }), 500);
    await this.say([
      { who: 'mori', text: 'It’s dark in here... and it smells like wet carpet and diesel.', expr: 'worried' },
      { who: 'mori', text: 'Shh. Hear that? Crunching.', expr: 'thinking', emote: 'question' },
      { who: 'chunk', text: '*crunch crunch crunch slurp crunch*', expr: 'eat', close: false },
    ]);
  }

  private async foundChunk() {
    const s = this.s, c = s.chunk, j = s.jenna;
    await this.cut(async () => {
      this.p.facing = 1;
      await this.pan(c.x - 10, c.y - 30, 1.7, 1);
      await this.say([
        { who: 'mori', text: 'Chunk...?', expr: 'surprised' },
        { who: 'chunk', text: '*CRUNCH*', expr: 'eat', close: false },
      ]);
      c.setAnim('idle');
      c.faceTo(this.p.x);
      c.setExpr('happy', 3);
      c.play('wiggle', 'idle').catch(() => {});
      await this.say([
        { who: 'chunk', text: 'Boof!', expr: 'happy' },
        { who: 'mori', text: 'We were thrown into the sea by a wave the size of a building. And you’re having BRUNCH?', expr: 'shocked' },
        { who: 'chunk', text: '...', expr: 'derp', close: false, auto: 900 },
      ]);
      c.setAnim('eat');
      c.setExpr('eat');
      audio.play('munch', { vol: 0.6 });
      // Jenna scrambles in
      this.jennaF.on = false;
      this.place(j, WRECK.climbX + 6, 1, 'idle', WRECK.floor);
      j.play('land', 'idle').catch(() => {});
      await wait(300);
      j.walkTo(c.x - 44, 110, 'run');
      await this.say([
        { who: 'jenna', text: 'CHUNK!!! You absolute POTATO!', expr: 'excited', style: 'shout', react: 'jump' },
        { who: 'jenna', text: 'He’s eating. He’s literally just eating. He opened a CAN. How did he open a can?!', expr: 'shocked' },
        { who: 'mori', text: 'Honestly? Not the weirdest thing he’s done this week.', expr: 'laugh' },
      ]);
      this.pose('kneel');
      c.setAnim('idle');
      c.faceTo(this.p.x);
      c.play('bark', 'idle').catch(() => {});
      audio.play('callBark', { vol: 0.35, pitch: 0.78 });
      await this.say([
        { who: 'mori', text: 'C’mere, buddy. You’re okay. You’re okay.', expr: 'happy' },
        { who: 'chunk', text: '*licks Mori’s entire glasses*', expr: 'happy', close: false },
        { who: 'mori', text: 'And now I can’t see. Great. Perfect. Love you too.', expr: 'teasing' },
      ]);
      this.pose(null);
      await this.pan(null, null, s.zoomBase, 0.6);
      this.set('v4:chunkWreck');
      await this.split();
    });
  }

  private async split() {
    const s = this.s, j = s.jenna;
    await this.cut(async () => {
      j.faceTo(this.p.x);
      await this.say([
        { who: 'jenna', text: 'Okay. Okay. Chunk: found. Mori: found. Me: extremely found.', expr: 'serious' },
        { who: 'jenna', text: '...Dad was on the bridge when the wave hit. The bridge is on the OTHER half of the ship.', expr: 'sad' },
        { who: 'mori', text: 'Joshu’s the toughest man I’ve ever met. If anyone swam out of that, it’s him.', expr: 'determined' },
        { who: 'jenna', text: 'Yeah. Yeah! He once punched a shark. Allegedly. He tells it differently every time.', expr: 'determined' },
        { who: 'mori', text: 'Then let’s split up. You search the wreck and the rocks back west. Chunk and I take the shoreline east.', expr: 'thinking' },
        { who: 'jenna', text: 'Deal. Take this. The emergency walkie-talkie from the hold. Channel three.', expr: 'happy' },
        { who: 'mori', text: 'You found it in the dark in ten seconds?', expr: 'surprised' },
        { who: 'jenna', text: 'I labelled every drawer on this boat. Colour-coded. You’re welcome.', expr: 'smug' },
        { who: 'jenna', text: 'Mori... find him. Please.', expr: 'worried' },
      ]);
      this.set('v4:split');
      this.jennaAtWreck();
      if (s.inWreck) {
        const ld = { x: WRECK.climbX, y0: WRECK.floor, y1: groundY(WRECK.climbX) };
        await s.climbLadder(ld, 1);
      }
      this.chunkFollow();
      this.shoreTriggers();
      s.clock.target = 1.2;
      s.clock.rate = 0.0045;
      game.ui.toast('Follow the shore east. Keep your camera handy: this island is full of wildlife nobody has catalogued.', 'TIP', 'teal', 6000);
    });
  }

  // ---------------------------------------------------------------- chapter B: the shoreline
  shoreTriggers() {
    const px = () => this.p.x;
    const st = () => !this.busy && !this.s.cutscene && !game.ui.blocking;
    this.trigger('radio1', () => st() && px() > 2700, async () => {
      await this.say([
        this.radio('Mori? Mori, come in. Over.'),
        { who: 'mori', text: 'I’m here. No sign of him yet. Over.', expr: 'neutral' },
        this.radio('I found the first-aid kit, two tarps, and Dad’s secret stash of chocolate biscuits. He is SO busted. Over.', 'teasing'),
      ]);
    });
    this.trigger('tracks', () => st() && px() > 3470, async () => {
      await this.cut(async () => {
        this.p.facing = 1;
        await this.say([
          { who: 'mori', text: 'Chunk. Look. Boot prints. Big ones.', expr: 'surprised', emote: 'exclaim' },
          { who: 'mori', text: 'Size thirteen... and the left one drags. Somebody’s limping.', expr: 'thinking' },
          { who: 'mori', text: 'Nobody else on this island has feet like that. It’s Joshu. He walked out of the sea!', expr: 'excited', react: 'bounce' },
          { who: 'chunk', text: '*sniff* ...*SNIFF* ...BOOF!', expr: 'serious' },
        ]);
      });
      startQuest('v4joshu');
    });
    this.trigger('radio2', () => st() && px() > 3900, async () => {
      await this.say([
        this.radio('Status report! The engine room is a sandbox now. A literal sandbox. There’s a crab living in the fuse panel. Over.', 'grumpy'),
        { who: 'mori', text: 'I found Joshu’s footprints. Heading east. He’s walking. Over.', expr: 'happy' },
        this.radio('...Oh thank goodness. Okay. OKAY. Go get him, nature boy. Over.', 'happy'),
      ]);
    });
    // the Corvex Seal
    this.trigger('seal1', () => st() && px() > SPOT.sealRock - 190 && !this.flag('v4:sealDone'), async () => {
      await this.cut(async () => {
        this.p.facing = 1;
        await this.pan(this.seal.x, this.seal.y - 40, 1.35, 1.2);
        await this.say([
          { who: 'mori', text: 'Is that a rock?', expr: 'thinking' },
          { who: 'mori', text: 'Rocks don’t snore.', expr: 'surprised' },
          { who: 'mori', text: 'Black shaggy fur... a red face... white markings. That’s no fur seal I know. That’s no seal ANYONE knows.', expr: 'excited', emote: 'sparkle' },
          { who: 'mori', text: 'It’s enormous. And it’s lying right across the beach. The footprints go straight past it.', expr: 'worried' },
          { who: 'mori', text: 'Okay, Chunk. We tiptoe. Very quietly. No barking. Nod if you understand.', expr: 'serious' },
          { who: 'chunk', text: '...', expr: 'derp', close: false, auto: 900 },
          { who: 'mori', text: 'That’s not a nod. That’s just your face.', expr: 'grumpy' },
        ]);
        await this.pan(null, null);
      });
      game.ui.toast('Sneak past: hold <b>S</b> (or <b>Ctrl</b>) to crouch. A photo of it sleeping would be something...', 'TIP', 'teal', 5200);
    });
    this.trigger('seal2', () => st() && px() > SPOT.sealRock + 100 && !this.flag('v4:sealDone'), () => this.sealWakes());
    this.trigger('cave', () => st() && this.flag('v4:sealDone') && px() > 5110 && px() < 5400, async () => {
      await this.say([
        { who: 'mori', text: '<i>(whispering)</i> Chunk... look up.', expr: 'surprised' },
        { who: 'mori', text: 'Titiwai. Glowworms. Thousands of them. They fish with glowing silk.', expr: 'happy', emote: 'sparkle' },
        { who: 'mori', text: 'Joshu... you walked through this and didn’t even stop to look, did you.', expr: 'teasing' },
      ]);
    });
    this.trigger('joshu', () => st() && this.flag('v4:shoes') && px() > SPOT.joshu - 110, () => this.findJoshu());
  }

  private async sealWakes() {
    const s = this.s, c = s.chunk;
    await this.cut(async () => {
      // Chunk has stopped. Right next to its face. Of course he has.
      s.buddy.mode = 'script';
      c.stopWalk();
      this.place(c, this.seal.x + 98, -1, 'sniff');
      this.p.facing = -1;
      await this.pan(this.seal.x + 40, this.seal.y - 40, 1.45, 0.9);
      await this.say([
        { who: 'mori', text: '<i>(whispering)</i> Chunk. CHUNK. Get back here. Slowly.', expr: 'scared' },
        { who: 'chunk', text: '*sniff sniff*', expr: 'thinking', close: false, auto: 900 },
      ]);
      c.play('bark', 'idle').catch(() => {});
      audio.play('callBark', { vol: 0.8, pitch: 0.7 });
      await this.say([{ who: 'chunk', text: 'BORF! BORF BORF!', expr: 'excited', style: 'shout', react: 'jump' }]);
      this.seal.set('wake');
      await wait(900);
      await this.say([{ who: 'mori', text: 'Oh no.', expr: 'shocked', close: false, auto: 700 }]);
      await wait(1500);
      c.setAnim('zoom');
      c.walkTo(this.p.x + 300, 180, 'zoom');
      await this.say([{ who: 'mori', text: 'RUN!!!', expr: 'scared', style: 'shout', react: 'jump' }]);
      await this.pan(null, null, 1.15, 0.3);
      this.p.facing = 1;
    });
    this.chaseStartX = this.p.x;
    this.seal.set('chase');
    audio.setMusic('tension');
    game.ui.toast('Hold <b>Shift</b> to run!', 'RUN', 'coral', 3000);
  }

  private async caught() {
    const s = this.s;
    await this.cut(async () => {
      audio.play('land', { vol: 0.9, pitch: 0.5 });
      s.st.shake(6, 0.5);
      this.pose('lie');
      this.p.vx = 0;
      this.seal.x = this.p.x - 10;
      await this.say([
        { who: 'mori', text: 'MMMPH!', expr: 'shocked', style: 'shout', close: false, auto: 700 },
        { who: 'mori', text: 'It’s... lying... on me... it’s so warm... and it smells like a thousand fish...', expr: 'injured' },
      ]);
      await this.fadeOut(1.8);
      this.seal.x = Math.max(this.chaseStartX - 60, this.p.x - 140);
      this.p.y = groundY(this.p.x);
      this.pose(null);
      this.seal.set('roar');
      s.snapCamera();
      await this.fadeIn(1.8);
      s.bark('mori', 'Nope. Nope nope nope. RUNNING NOW.', { expr: 'scared' });
    });
  }

  private async sealTired() {
    const s = this.s, c = s.chunk;
    audio.setMusic('none' as never);
    await this.cut(async () => {
      await this.pan(this.seal.x + 20, this.seal.y - 40, 1.35, 1);
      await this.say([
        { who: 'mori', text: '<i>(panting)</i> Is it... is it stopping?', expr: 'tired' },
      ]);
      await wait(1200);
      await this.say([
        { who: 'mori', text: 'It’s lying down. It’s... panting. It ran two hundred metres and now it’s having a nap.', expr: 'surprised' },
        { who: 'mori', text: 'All sprint, no stamina. I know the feeling, big guy.', expr: 'tired' },
      ]);
      await this.pan(null, null);
      this.place(c, this.p.x + 40, -1, 'idle');
      c.play('shake', 'idle').catch(() => {});
      await this.say([
        { who: 'mori', text: 'And YOU. You woke it up.', expr: 'angry' },
        { who: 'chunk', text: '*proud little sneeze*', expr: 'happy', close: false },
        { who: 'mori', text: 'Nobody is proud of you. Don’t do the proud face.', expr: 'grumpy' },
      ]);
      c.play('proud', 'idle').catch(() => {});
      this.chunkFollow();
      this.set('v4:sealDone');
    });
    game.ui.toast('It’s exhausted. Now might be a good time for a photo...', 'TIP', 'teal', 4200);
  }

  private async boots() {
    await this.cut(async () => {
      this.p.facing = 1;
      this.pose('kneel');
      await this.say([
        { who: 'mori', text: 'Joshu’s boots. Both of them. Laces knotted together, the way he always does.', expr: 'surprised' },
        { who: 'mori', text: 'Full of water. He must have taken them off to walk.', expr: 'thinking' },
        { who: 'mori', text: 'And look: bare footprints. Up the bank. Into the bush.', expr: 'determined', emote: 'exclaim' },
      ]);
      this.pose(null);
      this.set('v4:shoes');
      await this.say([
        this.radio('Mori? Anything? Over.', 'worried'),
        { who: 'mori', text: 'His boots. He’s alive, Jenna, he’s walking. I’m following the trail up into the trees. Over.', expr: 'determined' },
        this.radio('Go. Go go go. Over.', 'determined'),
      ]);
    });
  }

  private async findJoshu() {
    const s = this.s, jo = s.joshu;
    await this.cut(async () => {
      this.p.facing = 1;
      await this.pan(jo.x, jo.y - 30, 1.5, 1.2);
      await this.say([
        { who: 'mori', text: 'JOSHU!', expr: 'shocked', style: 'shout', react: 'jump' },
      ]);
      this.p.walkTo(jo.x - 34, 110);
      await wait(900);
      await this.pan(null, null);
      this.set('v4:joshuFound');
    });
  }

  private async helpJoshu() {
    const s = this.s;
    if (!this.flag('v4:joshuChecked')) {
      await this.cut(async () => {
        this.pose('kneel');
        await this.say([
          { who: 'mori', text: 'Joshu? Can you hear me?', expr: 'worried' },
          { who: 'mori', text: 'He’s breathing. Slow and steady. There’s a nasty bump on his head, and his ankle’s swollen up like a pumpkin.', expr: 'serious' },
          { who: 'mori', text: 'Water. Cold water. The creek’s right there.', expr: 'determined' },
        ]);
        this.pose(null);
        this.set('v4:joshuChecked');
      });
      return;
    }
    if (this.flag('v4:water') && !this.flag('v4:splashed')) {
      await this.cut(async () => {
        this.p.animMap = null;
        this.pose('kneel');
        audio.play('splash', { vol: 0.6 });
        s.joshu.react('shake');
        await this.say([
          { who: 'mori', text: 'Sorry, big guy.', expr: 'worried' },
          { who: 'joshu', text: '...hnnnnnnngh...', expr: 'sleep', close: false },
          { who: 'mori', text: 'Come on, Joshu. Come on...', expr: 'worried' },
        ]);
        this.pose(null);
        this.set('v4:splashed');
        await this.chunkWakesJoshu();
      });
      return;
    }
    await this.say([{ who: 'mori', text: 'He’s out cold. Cold water from the creek might help.', expr: 'thinking' }]);
  }

  private async fetchWater() {
    await this.cut(async () => {
      this.pose('kneel');
      audio.play('splash', { vol: 0.4, pitch: 1.3 });
      await wait(900);
      this.pose(null);
      this.set('v4:water');
      this.p.animMap = { idle: 'carryIdle', walk: 'carry', run: 'carry' };
      this.s.bark('mori', 'A hat full of freezing creek water. Joshu is going to love this.', { expr: 'teasing' });
    });
  }

  private async chunkWakesJoshu() {
    const s = this.s, c = s.chunk, jo = s.joshu;
    s.buddy.mode = 'script';
    c.walkTo(jo.x + 20, 70, 'walk');
    await wait(900);
    c.faceTo(jo.x);
    c.setAnim('sniff');
    await this.say([{ who: 'chunk', text: '*sniff sniff*', expr: 'thinking', close: false, auto: 800 }]);
    c.setAnim('beg');
    await this.say([{ who: 'chunk', text: '*SLURP SLURP SLURP SLURP*', expr: 'happy', close: false, auto: 1200 }]);
    jo.setAnim('sitGround');
    jo.setExpr('surprised', 2);
    jo.react('jump');
    await this.say([
      { who: 'joshu', text: 'GAH! ...Chunk?', expr: 'surprised' },
      { who: 'joshu', text: 'That breath. I’d know that breath anywhere. Smells like the bottom of a bait bucket.', expr: 'happy' },
      { who: 'mori', text: 'Joshu! You’re awake! How do you feel?', expr: 'excited' },
      { who: 'joshu', text: 'Like a tugboat ran me over, backed up, and ran me over again. Where...', expr: 'injured' },
      { who: 'joshu', text: 'JENNA. Mori, where’s my girl?', expr: 'scared', react: 'jump' },
      { who: 'mori', text: 'She’s fine. She’s at the wreck. Not a scratch. She’s been bossing me around on the radio all morning.', expr: 'happy' },
      { who: 'joshu', text: '...', expr: 'sad', close: false, auto: 1100 },
      { who: 'joshu', text: 'Thank God. Thank the sea. Thank YOU, lad.', expr: 'happy' },
      { who: 'joshu', text: 'I came to on the beach. Couldn’t see anyone. Walked east looking for you lot and fresh water. Must’ve slipped on the rocks up here.', expr: 'neutral' },
      { who: 'mori', text: 'Your ankle’s pretty bad. And there’s a lump on your head the size of an egg.', expr: 'worried' },
      { who: 'joshu', text: 'Head’s the hardest part of me. Ask Jenna’s mother. ...Help me up.', expr: 'teasing' },
    ]);
    // Mori helps him up
    this.pose('grab');
    await wait(700);
    await jo.play('standUp', 'idle');
    this.pose(null);
    jo.idleAnim = 'injured';
    jo.setAnim('injured');
    await this.say([
      this.radio('Mori? Mori, I heard yelling. Is that... is that DAD?', 'worried'),
      { who: 'joshu', text: 'Jenna, love. I’m here. I’m all right.', expr: 'happy' },
      this.radio('DAAAAD! You big stupid WALRUS! Don’t you EVER do that again! ...over!', 'excited'),
      { who: 'joshu', text: 'Ha! Aye aye. We’re coming back. Over.', expr: 'laugh' },
    ]);
    this.set('v4:joshuAwake');
    this.chunkFollow();
    await this.camp.startReturn();
  }

  newSpecies(sp: string) {
    const names: Record<string, string> = { corvexseal: 'Corvex Seal', crownleech: 'Crown Leech', glasscrab: 'Glass Crab', swashrunner: 'Swashrunner', shellwrench: 'Pied Shellwrench', kelpskink: 'Kelp Skink', duskwaddler: 'Duskwaddler', starweb: 'Starweb Weaver', twinfan: 'Twinfan', periscope: 'Periscope Octopus' };
    game.ui.toast(`New species photographed: <b>${names[sp] ?? sp}</b>`, 'FIELD GUIDE', 'teal', 3600);
    const lines: Record<string, string> = {
      corvexseal: this.seal.state === 'tired' || this.seal.state === 'asleep' ? 'Corvex seal. Exhausted, snoring, magnificent. First photo in history, probably.' : 'I photographed a monster seal! While it was ASLEEP. Like a pro.',
      crownleech: 'Leeches. In its neck. With little feathery crowns. Nature, you are disgusting and I love you.',
      glasscrab: 'You can see its heart beating through the shell! Glass crabs. I’m calling them glass crabs.',
      swashrunner: 'Look at it chase the waves. Snowshoe feet. So much commitment.',
      shellwrench: 'Its bill crosses at the tip like pliers. It just twisted a mussel open!',
      duskwaddler: 'Furry little penguin-things, waddling home to the dunes. My heart.',
      starweb: 'Starweb weavers. A whole sky of them on the cave roof. If that comes out, it’s going on the wall.',
      twinfan: 'It has TWO tails. Two fans! It’s following me to eat the bugs I stir up.',
      periscope: 'Eyes on stalks, poking out of the pool like periscopes. And it’s wearing armour.',
    };
    if (lines[sp] && !game.ui.bubbles.active) this.s.bark('mori', lines[sp], { expr: 'excited' });
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    const c = this.s.st.cam;
    const tw = this.camTw;
    if (tw) {
      tw.t += dt;
      const k = smoothstep(0, 1, clamp(tw.t / tw.dur));
      c.x = c.tx = tw.x0 + (tw.x1 - tw.x0) * k;
      c.y = c.ty = tw.y0 + (tw.y1 - tw.y0) * k;
      c.zoom = c.tzoom = tw.z0 + (tw.z1 - tw.z0) * k;
      if (tw.t >= tw.dur) { this.camTw = null; tw.res(); }
    }
    this.jennaF.update();
    this.joshuF.update();
    if (!this.busy && !game.ui.blocking) {
      for (let i = 0; i < this.triggers.length; i++) {
        const t = this.triggers[i];
        if (!t.when()) continue;
        this.triggers.splice(i, 1);
        F()['trg:' + t.id] = true;
        game.persist();
        void t.run();
        break;
      }
    }
    this.camp.update(dt);
    void rand;
  }
}

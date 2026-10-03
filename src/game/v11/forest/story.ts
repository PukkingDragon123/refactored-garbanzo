// V11 Te Wao Nui, the story in the forest.
//
// Day 1, the search for Joshu (Chunk stayed at the wreck with Jenna, so Mori is on his own): Joshu's
// boot prints come up the stream from the beach; Mori follows them in. Prints in the mud at the ford,
// a scrap of navy wool on the bush lawyer, one sea boot sucked off in the mud wallows, a red cap far
// off down in the gully seen with the binoculars from the top of the fallen kauri, and a terrible
// rumbling noise that turns out to be the most familiar snore in the southern ocean. Joshu is out
// cold by the creek at the bottom of the gully: check on him, carry cold creek water in cupped hands,
// splash him awake. Then the shortcut down the stream, out of the forest and back along the beach
// (islecamp.ts carries on from there: the walk back, the scream, the dognapper).
//
// Day 2 on, an expedition with Aroha: the first time she leads the way in, the forest goes quiet and a
// Cerebral Tiger ambushes the group (src/game/v11/predators.ts); once only.
//
// Flags: v11:inForest (Day 1, the scene to reload into), v11:trailIn, v11:fprints, v11:scrap,
// v9:sawCap, v4:shoes, v11:snore, v4:joshuFound, v4:joshuChecked, v4:water, v4:splashed,
// v4:joshuAwake, v11:forestOut, v11:tigerAmbush. Vars: v11:fx (where Mori stood), v11:dayT (the clock).

import { game } from '../../game';
import { audio } from '../../../core/audio';
import { startQuest, questStatus } from '../../quests';
import type { BubbleLine } from '../../../ui/bubbles';
import type { Actor } from '../../../world/actor';
import { animInfo } from '../../../world/actor';
import type { Interactable } from '../../../world/npc';
import { Custom, Prop } from '../../../world/props';
import { packColor } from '../../../gfx/renderer';
import { A } from '../../assets';
import { sprite } from '../../sites2/common';
import { rand } from '../../../core/math';
import { cineTo, cineRelease, cineBars } from '../cine';
import { tigerAmbush } from '../predators';
import { setCarry } from '../carry';
import { paintStuckBoot, paintSnag } from '../../../art/v11/forest/props';
import type { Sprite } from '../../../art/jungle-core';
import { FSPOT, FORD, GULLY, LOG, fgroundY, baseY, logTop } from './layout';
import type { ForestScene, ForestHooks } from './scene';

const F = () => game.save.flags;
const V = () => game.save.vars;
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** an actor that trails Mori at a gap (Joshu on the way out) */
class Trail {
  on = true;
  constructor(readonly a: Actor, readonly f: ForestScene, public gap = 40, public walk = 36, public run = 62, public anim = 'limp') {}
  update() {
    if (!this.on) return;
    const p = this.f.player, a = this.a;
    const want = p.x - p.facing * this.gap;
    const d = want - a.x;
    if (Math.abs(d) > 60 || (Math.abs(d) > 22 && Math.abs(p.vx) < 5 && !a.walking)) {
      if (!a.walking || Math.abs(d) > 40) a.walkTo(want, Math.abs(d) > 130 ? this.run : this.walk, this.anim);
    } else if (!a.walking) a.faceTo(p.x);
    a.y = fgroundY(a.x);
    if (Math.abs(d) > 420) { a.stopWalk(); a.x = p.x - Math.sign(p.x - a.x) * 160; a.y = fgroundY(a.x); }
  }
}

export class ForestStory implements ForestHooks {
  private triggers: { id: string; when: () => boolean; run: () => Promise<void> | void }[] = [];
  private busy = false;
  private sayQ: Promise<unknown> = Promise.resolve();
  private cutDepth = 0;
  joshu: Actor | null = null;
  private joshuF: Trail | null = null;
  private pxT = 0;
  private hintT = 40;
  private snoreT = 0;

  constructor(readonly f: ForestScene) {}

  // ---------------------------------------------------------------- helpers
  flag(k: string) { return !!F()[k]; }
  set(k: string, v = true) { F()[k] = v; game.persist(); this.f.hud?.refresh(true); }
  get p() { return this.f.player; }
  say(lines: BubbleLine[]): Promise<number> {
    const p = this.sayQ.then(() => this.f.say(lines));
    this.sayQ = p.catch(() => {});
    return p;
  }
  radio(text: string, expr = 'neutral'): BubbleLine { return { who: 'jenna', text: `<i>*kssht*</i> ${text}`, expr }; }
  pose(anim: string | null) { this.p.poseOverride = anim; }
  async once(anim: string) {
    const i = animInfo(anim, 'mori');
    this.pose(anim);
    await wait((i.frames / i.fps) * 1000);
  }
  place(a: Actor, x: number, facing = 1, anim = 'idle') {
    a.stopWalk();
    a.x = x; a.y = fgroundY(x); a.facing = facing; a.visible = true; a.alpha = 1;
    a.idleAnim = anim; a.setAnim(anim);
  }
  async cut<T>(fn: () => Promise<T>, bars = true): Promise<T> {
    const f = this.f;
    f.cutscene = true;
    this.busy = true;
    this.cutDepth++;
    if (this.cutDepth === 1) { f.hud?.show(false); if (bars) cineBars(true); }
    try { return await fn(); } finally {
      this.cutDepth = Math.max(0, this.cutDepth - 1);
      if (this.cutDepth === 0) {
        f.cutscene = false; this.busy = false; this.pose(null);
        cineBars(false);
        if (f.st.cam.locked) await cineRelease(f.st, 0.6).catch(() => { f.st.cam.locked = false; });
        f.st.cam.locked = false;
        f.hud?.show(true);
      }
    }
  }
  trigger(id: string, when: () => boolean, run: () => Promise<void> | void) {
    if (this.flag('trg:f:' + id)) return;
    this.triggers.push({ id, when, run });
  }
  it(o: Partial<Interactable> & { x: number; y: number; label: string; action: () => void | Promise<void> }) {
    const it = o as Interactable & { w?: number; h?: number };
    if (it.w === undefined) it.w = 14;
    if (it.h === undefined) it.h = 18;
    this.f.interact.push(it as Interactable);
  }
  /** a static sprite in the scene that can be shown or hidden */
  prop(key: string, gen: () => Sprite, x: number, y: number, z: number, show: () => boolean) {
    const c = sprite('v11fs:' + key, gen);
    if (!c) return;
    const pr = new Prop(c.f, x, y, z);
    this.f.main.add(new Custom(z, (rr, st) => { if (show()) pr.draw(rr, st); }));
  }

  // ---------------------------------------------------------------- setup
  async enter() {
    const f = this.f;
    f.onWalkOut = () => this.walkOut();
    // the way out at the west end (walking on into it does the same)
    this.it({ x: FSPOT.exit, y: fgroundY(FSPOT.exit), w: 18, h: 26, get label() { return f.day1 ? 'Back down the stream to the beach' : 'Down the stream: head back to camp'; }, standX: FSPOT.exit + 4,
      enabled: () => !f.cutscene && !f.leaving, action: () => f.walkOut() } as never);
    if (f.day1) await this.enterDay1();
    else this.enterExpedition();
  }

  private async enterDay1() {
    const f = this.f;
    this.set('v11:inForest');
    // Jenna is on the walkie-talkie from the wreck (no one standing there: the bubble docks)
    game.ui.bubbles.register('jenna', { name: 'Jenna · radio', voice: 1.5, color: '#d04890', anchor: () => null });
    // Joshu: out cold at the bottom of the gully, or (awake) limping along behind Mori
    const jo = f.addActor('joshu', FSPOT.joshu, fgroundY(FSPOT.joshu), -1);
    jo.z = 44;
    jo.walkAnim = 'limp';
    this.joshu = jo;
    f.pushers.push(jo);
    this.joshuF = new Trail(jo, f);
    if (this.flag('v4:joshuAwake')) {
      this.place(jo, Math.max(40, this.p.x - 40), 1, 'injured');
      this.joshuF.on = true;
    } else {
      this.place(jo, FSPOT.joshu, -1, 'unconscious');
      jo.setExpr('sleep');
      this.joshuF.on = false;
    }
    this.addClues();
    this.addJoshu();
    this.addHintMarks();
    // pick up where Mori was standing (a reload in the forest)
    const fx = V()['v11:fx'];
    if (fx && fx > 40 && fx < 5960 && this.flag('v11:trailIn')) { this.p.x = fx; this.p.y = fgroundY(fx); f.snapCamera(); }
    // the clock: the morning wears on toward midday while he searches
    f.clock.target = this.flag('v4:joshuAwake') ? Math.max(f.clock.t, 2.5) : Math.max(f.clock.t, 1.55);
    f.clock.rate = 0.0035;
    this.day1Triggers();
    if (!this.flag('v11:trailIn')) await this.arrive();
  }

  private enterExpedition() {
    const f = this.f;
    if (f.guide) this.set('v11:forestAroha');
    // a few things only Aroha would point out, and the forest's first ambush
    this.trigger('x:joshu', () => !this.busy && !f.cutscene && Math.abs(this.p.x - FSPOT.joshu) < 90 && !!f.guide, async () => {
      await this.say([
        { who: 'mori', text: 'This is where I found Joshu. Flat on his back by the creek, snoring loud enough to scare off a tiger.', expr: 'happy' },
        { who: 'aroha', text: 'Don’t joke about tigers in here.', expr: 'serious' },
      ]);
    });
    this.trigger('x:log', () => !this.busy && !f.cutscene && this.p.y < fgroundY(this.p.x) - 30 && !!f.guide, async () => {
      await this.say([{ who: 'aroha', text: 'Kauri fall maybe once in a thousand years. And then the whole forest grows on them. Ferns, moss, baby trees... a log like this is a nursery.', expr: 'happy' }]);
    });
    // the Cerebral Tiger: the first time the group comes in together with Aroha
    this.trigger('x:tiger', () => !this.busy && !f.cutscene && !game.ui.blocking && !!f.guide && !this.flag('v11:tigerAmbush') && this.p.x > FSPOT.tiger - 70 && this.p.x < FSPOT.tiger + 300 && this.p.onGround, () => this.tiger());
  }

  // ---------------------------------------------------------------- Day 1: the way in
  /** first steps into the forest: the giants, Jenna on the radio */
  private async arrive() {
    const f = this.f, p = this.p;
    await this.cut(async () => {
      p.x = 12; p.y = fgroundY(12); p.facing = 1;
      f.snapCamera();
      await wait(300);
      await Promise.race([p.walkTo(FSPOT.enter + 30, 52), wait(4000)]);
      await game.ui.titleCard('Day 1', 'Te Wao Nui', 'The Great Forest', 2600);
      // look up: the trunks just keep going
      await cineTo(f.st, { x: p.x + 230, y: fgroundY(p.x) - 120, zoom: 1.0, secs: 2.6 });
      await this.say([
        { who: 'mori', text: 'Whoa.', expr: 'surprised', close: false, auto: 1100 },
        { who: 'mori', text: 'Kauri. Real ones. They go up and up and they just... don’t stop.', expr: 'surprised', emote: 'sparkle' },
      ]);
      await cineRelease(f.st, 1.2);
      await this.say([
        this.radio('Mori? You went quiet. Over.', 'worried'),
        { who: 'mori', text: 'I’m in the forest. Joshu’s prints went up the stream, so I did too. Jenna, the trees in here are the size of office buildings. Over.', expr: 'excited' },
        this.radio('Cool cool cool. Find Dad first, nerd out second. Chunk says hi. Chunk is lying on the biscuit tin so nobody else can have one. Over.', 'teasing'),
        { who: 'mori', text: 'Tell him he’s a very good guard. Over.', expr: 'happy' },
      ]);
    });
    this.set('v11:trailIn');
    if (questStatus('v4joshu') === 'hidden') startQuest('v4joshu', true);
    try { (await import('../../v10/regions')).findLocation('forest'); } catch { /* the map module is optional here */ }
    game.ui.toast('Follow the stream inland and look for signs of Joshu. <b>Q</b> raises your camera: the forest is full of things nobody has photographed.', 'TIP', 'teal', 6000);
  }

  private addClues() {
    const f = this.f;
    // Joshu's boot prints: along the stream bank to the ford, then bare feet after the mud took his boot
    const prints: [number, number, number, boolean][] = [];
    for (let x = 140, i = 0; x < 2620; x += 15, i++) {
      if (Math.abs(x - FORD.x) < FORD.w + 4 || (x > LOG.x0 - 10 && x < LOG.x1 + 6 && i % 3)) continue;
      prints.push([x, fgroundY(x) + 6 + (i % 2 ? 3 : 0) + Math.sin(x * 0.05) * 1.2, i % 2, true]);
    }
    for (let x = 2672, i = 0; x < GULLY.top0 + 80; x += 13, i++) prints.push([x, fgroundY(x) + 6 + (i % 2 ? 3 : 0), i % 2, false]);
    f.main.add(new Custom(-9.4, rr => {
      if (this.flag('v4:joshuAwake')) return;
      const x0 = rr.visibleX0(10), x1 = rr.visibleX1(10);
      rr.beginShadows();
      for (const [x, y, left, boot] of prints) {
        if (x < x0 || x > x1) continue;
        if (boot) {
          rr.draw(A.shadow, x, y, 0.3, 0.13, 0, packColor(0, 0, 0, 0.5));
          rr.draw(A.shadow, x + 3, y, 0.12, 0.1, 0, packColor(0, 0, 0, 0.4));
          if (left) rr.draw(A.shadow, x - 8, y + 0.5, 0.42, 0.05, 0, packColor(0, 0, 0, 0.3));
        } else {
          rr.draw(A.shadow, x, y, 0.16, 0.09, 0, packColor(0, 0, 0, 0.4));
          for (let t = 0; t < 4; t++) rr.draw(A.shadow, x + 3 + t * 0.9, y - 1.6 + t * 0.4, 0.03, 0.03, 0, packColor(0, 0, 0, 0.38));
        }
      }
      rr.endShadows();
    }));
    // the scrap of navy wool on the bush lawyer, the boot in the mud
    this.prop('snag', () => paintSnag(), FSPOT.scrap, fgroundY(FSPOT.scrap) + 2, -2.2, () => true);
    this.prop('boot', () => paintStuckBoot(), FSPOT.boot, fgroundY(FSPOT.boot) + 5, 57, () => !this.flag('v4:shoes'));
    this.it({ x: FSPOT.scrap, y: fgroundY(FSPOT.scrap), w: 16, label: 'A scrap of navy wool on the brambles', standX: FSPOT.scrap - 14, quest: () => !this.flag('v11:scrap'), enabled: () => !this.flag('v11:scrap') && !this.flag('v4:joshuAwake'), action: () => this.scrap() });
    this.it({ x: FSPOT.boot, y: fgroundY(FSPOT.boot), w: 16, label: 'A boot, stuck fast in the mud', standX: FSPOT.boot - 16, quest: () => !this.flag('v4:shoes'), enabled: () => !this.flag('v4:shoes'), action: () => this.boot() });
    // the lookout at the broken top end of the fallen kauri
    const ly = () => logTop(FSPOT.lookout - 30);
    const self = this;
    this.it({ x: FSPOT.lookout - 30, get y() { return ly(); }, w: 16, label: 'Look out across the forest with the binoculars', standX: FSPOT.lookout - 34, quest: () => !this.flag('v9:sawCap') && !this.flag('v4:joshuFound'),
      enabled: () => !self.flag('v9:sawCap') && !self.flag('v4:joshuFound') && Math.abs(self.p.y - ly()) < 14 && game.save.tools.includes('binoculars'), action: () => this.lookout() } as never);
  }

  /** gold markers on the next thing to find (the boot, the lookout, Joshu) */
  private addHintMarks() {
    const f = this.f;
    // the root-plate climb, while the lookout is still to come
    f.questPoints.push({ x: () => LOG.roots, y: () => fgroundY(LOG.roots) - 40, on: () => !this.flag('v9:sawCap') && !this.flag('v4:joshuFound') && this.flag('v11:scrap') && this.p.x > LOG.x0 - 300 && this.p.x < LOG.x1 && this.p.y > fgroundY(this.p.x) - 10 });
    // the gully, once the boot is found
    f.questPoints.push({ x: () => FSPOT.joshu, y: () => fgroundY(FSPOT.joshu) - 40, on: () => this.flag('v4:shoes') && !this.flag('v4:joshuFound') && Math.abs(this.p.x - FSPOT.joshu) > 140 });
    // the way out, once Joshu is up
    f.questPoints.push({ x: () => FSPOT.exit + 10, y: () => fgroundY(FSPOT.exit) - 40, on: () => this.flag('v4:joshuAwake') });
  }

  private day1Triggers() {
    const f = this.f;
    const free = () => !this.busy && !f.cutscene && !game.ui.blocking;
    const px = () => this.p.x;
    this.trigger('prints', () => free() && px() > FSPOT.prints - 70 && px() < FSPOT.prints + 60 && !this.flag('v4:joshuAwake'), () => this.prints());
    this.trigger('log', () => free() && px() > LOG.x0 - 140 && px() < LOG.x0 && !this.flag('v4:joshuFound'), async () => {
      await this.say([
        { who: 'mori', text: 'A kauri, fallen right across the valley. The roots are taller than I am.', expr: 'surprised' },
        { who: 'mori', text: 'From up on top of that, I could see right across the forest.', expr: 'thinking', emote: 'idea' },
      ]);
    });
    this.trigger('mud', () => free() && px() > 2290 && px() < 2600 && !this.flag('v4:joshuFound'), async () => {
      await this.say([{ who: 'mori', text: 'Mud. Knee-deep, warm, and it smells like a thousand-year-old sock. Something big wallows in here.', expr: 'grumpy' }]);
    });
    this.trigger('snore', () => free() && px() > FSPOT.snore && !this.flag('v4:joshuFound'), () => this.snore());
    this.trigger('joshu', () => free() && px() > FSPOT.joshu - 150 && px() < FSPOT.joshu + 160 && !this.flag('v4:joshuFound'), () => this.findJoshu());
  }

  private async prints() {
    const p = this.p;
    await this.cut(async () => {
      p.facing = 1;
      await this.once('kneel');
      this.pose('kneel');
      await this.say([
        { who: 'mori', text: 'Boot prints in the mud. Big ones. Size thirteen.', expr: 'surprised', emote: 'exclaim' },
        { who: 'mori', text: 'The left one drags. He’s limping. He stopped here to drink... and then he went on up the stream.', expr: 'thinking' },
      ]);
    }, false);
    this.set('v11:fprints');
  }

  private async scrap() {
    await this.cut(async () => {
      this.p.facing = 1;
      await this.say([
        { who: 'mori', text: 'A strip of navy wool on the bush lawyer. That’s his gansey. Jenna knitted it, the arms are two different lengths.', expr: 'surprised' },
        { who: 'mori', text: 'He’s grabbing at branches as he goes. He’s hurt. Hang on, Joshu.', expr: 'worried' },
      ]);
    }, false);
    this.set('v11:scrap');
  }

  private async boot() {
    const p = this.p;
    await this.cut(async () => {
      p.facing = 1;
      this.pose('grab');
      audio.play('stepWater', { vol: 0.5, pitch: 0.45 });
      await wait(700);
      audio.play('pluck', { vol: 0.6, pitch: 0.5 });
      this.f.st.shake(1, 0.2);
      this.pose(null);
      await this.say([
        { who: 'mori', text: 'Joshu’s boot! Laces knotted the way he always does them.', expr: 'surprised' },
        { who: 'mori', text: 'The mud sucked it right off his foot, and he just... kept going. In his socks. That is the most Joshu thing I have ever seen.', expr: 'thinking' },
      ]);
      this.set('v4:shoes');
      await this.say([
        this.radio('Mori? Anything? Over.', 'worried'),
        { who: 'mori', text: 'His boot. He lost it in the mud. He’s alive, Jenna, and he’s walking. Mostly limping. Over.', expr: 'determined' },
        this.radio('Go. Go go go. Over.', 'determined'),
      ]);
    }, false);
  }

  /** from the top of the fallen kauri: binoculars far ahead, down into the gully, something red */
  private async lookout() {
    const f = this.f, p = this.p, jo = this.joshu!;
    await this.cut(async () => {
      p.facing = 1;
      this.pose('camera');
      audio.play('zoom', { vol: 0.5, pitch: 0.8 });
      await cineTo(f.st, { x: 2600, y: fgroundY(2600) - 40, zoom: 1.7, secs: 1.6 });
      await this.say([{ who: 'mori', text: 'Ferns... mud... more ferns... a very surprised bird...', expr: 'thinking' }]);
      await cineTo(f.st, { x: jo.x, y: jo.y - 14, zoom: 2.6, secs: 1.8 });
      await this.say([
        { who: 'mori', text: 'Something RED. Way down in that gully, by the water.', expr: 'thinking', emote: 'question' },
        { who: 'mori', text: 'A red cap. A big red cap on a big Joshu! He’s lying down. He’s not moving.', expr: 'shocked', style: 'shout', react: 'jump' },
      ]);
      this.set('v9:sawCap');
      await cineRelease(f.st, 1);
      this.pose(null);
    });
    this.f.bark('mori', 'Down off this log, through the mud, into the gully. Hang on, Joshu!', { expr: 'determined' });
  }

  /** the noise in the gully: a monster? no. */
  private async snore() {
    const f = this.f, p = this.p, jo = this.joshu!;
    const rumble = () => { audio.play('callGrowl', { vol: 0.55, pitch: 0.42 }); setTimeout(() => audio.play('callGrunt', { vol: 0.4, pitch: 0.38 }), 900); };
    await this.cut(async () => {
      p.vx = 0;
      rumble();
      f.st.shake(0.8, 0.6);
      await wait(1000);
      await this.say([
        { who: 'mori', text: '...What is THAT?', expr: 'scared', react: 'tremble' },
        { who: 'mori', text: 'Something big. Down in the gully. Breathing. Growling.', expr: 'scared', style: 'whisper' },
      ]);
      await cineTo(f.st, { x: jo.x - 60, y: fgroundY(jo.x) - 50, zoom: 1.35, secs: 1.4 });
      rumble();
      await wait(1300);
      await this.say([
        { who: 'mori', text: 'Hang on.', expr: 'thinking', close: false, auto: 900 },
        { who: 'mori', text: 'I know that noise. Seven years on a boat with that noise coming through the bunk room wall.', expr: 'surprised' },
        { who: 'mori', text: 'That’s not a monster. That’s JOSHU SNORING!', expr: 'excited', style: 'shout', react: 'bounce' },
      ]);
    });
    this.set('v11:snore');
    this.snoreT = 3;
  }

  private async findJoshu() {
    const f = this.f, p = this.p, jo = this.joshu!;
    await this.cut(async () => {
      p.facing = jo.x > p.x ? 1 : -1;
      await cineTo(f.st, { x: jo.x, y: jo.y - 30, zoom: 1.6, secs: 1.1 });
      await this.say([{ who: 'mori', text: 'JOSHU!', expr: 'shocked', style: 'shout', react: 'jump' }]);
      await Promise.race([p.walkTo(jo.x - 34, 80), wait(3500)]);
      this.set('v4:joshuFound');
      this.set('v4:shoes');
    });
  }

  private addJoshu() {
    const f = this.f, self = this;
    const jo = () => this.joshu!;
    this.it({ get x() { return jo().x; }, get y() { return jo().y; }, w: 26, get label() { return self.joshuLabel(); }, get standX() { return jo().x - 30; }, quest: () => true,
      enabled: () => this.flag('v4:joshuFound') && !this.flag('v4:joshuAwake') && !this.busy, action: () => this.helpJoshu() } as never);
    // (a fallback in case the walk-up trigger was missed)
    this.it({ get x() { return jo().x; }, get y() { return jo().y; }, w: 26, label: 'Joshu!', get standX() { return jo().x - 30; }, quest: () => this.flag('v9:sawCap') || this.flag('v11:snore'),
      enabled: () => !this.flag('v4:joshuFound') && !this.busy, action: () => { this.set('trg:f:joshu'); return this.findJoshu(); } } as never);
    // cold creek water, cupped in both hands
    this.it({ x: GULLY.x, y: baseY(GULLY.x), w: 18, label: 'Cup some cold creek water in your hands', standX: GULLY.x - 12, quest: () => true,
      enabled: () => this.flag('v4:joshuChecked') && !this.flag('v4:water') && !this.flag('v4:joshuAwake') && !this.busy, action: () => this.fetchWater() });
  }

  private joshuLabel() {
    if (!this.flag('v4:joshuChecked')) return 'Check on Joshu';
    if (this.flag('v4:water') && !this.flag('v4:splashed')) return 'Splash the water on his face';
    return 'Try to wake Joshu';
  }

  private async helpJoshu() {
    if (!this.flag('v4:joshuChecked')) {
      await this.cut(async () => {
        this.pose('kneel');
        await this.say([
          { who: 'mori', text: 'Joshu? Joshu, can you hear me?', expr: 'worried' },
          { who: 'mori', text: 'He’s breathing. Slow and steady. There’s a lump on his head the size of an egg, and his ankle’s swollen up like a pumpkin.', expr: 'serious' },
          { who: 'mori', text: 'He must have slipped coming down the bank and hit his head on the rocks.', expr: 'worried' },
          { who: 'mori', text: 'Water. Cold water. The creek’s right here.', expr: 'determined' },
        ]);
        this.pose(null);
        this.set('v4:joshuChecked');
      }, false);
      return;
    }
    if (this.flag('v4:water')) { await this.splash(); return; }
    await this.say([{ who: 'mori', text: 'He’s out cold. Cold water from the creek might bring him round.', expr: 'thinking' }]);
  }

  private async fetchWater() {
    const p = this.p;
    await this.cut(async () => {
      this.pose('kneel');
      audio.play('splash', { vol: 0.4, pitch: 1.3 });
      await wait(900);
      this.pose(null);
      this.set('v4:water');
      // water held in cupped hands, dripping between the fingers (the hands module draws it)
      setCarry(p.body, 'water');
      p.animMap = { idle: 'carryIdle', walk: 'carry', run: 'carry' };
      p.speedK = 0.7;
    }, false);
    this.f.bark('mori', 'Freezing. Joshu is going to LOVE this.', { expr: 'teasing' });
  }

  /** the splash, and Joshu coming round */
  private async splash() {
    const f = this.f, p = this.p, jo = this.joshu!;
    await this.cut(async () => {
      setCarry(p.body, null);
      p.animMap = null;
      p.speedK = 0.9;
      this.pose('kneel');
      audio.play('splash', { vol: 0.6 });
      for (let i = 0; i < 12; i++) f.main.particles.spawn({ frame: A.dot2, x: jo.x + rand.range(-6, 6), y: jo.y - 8, vx: rand.range(-40, 40), vy: rand.range(-70, -20), ay: 260, life: 0.7, color: [0.75, 0.9, 1], alpha: 0.9, alpha1: 0, floorY: jo.y + 1 });
      jo.react('shake');
      this.set('v4:splashed');
      await cineTo(f.st, { x: (jo.x + p.x) / 2, y: jo.y - 24, zoom: 1.75, secs: 0.9 });
      await this.say([
        { who: 'joshu', text: '...hnnnnnnngh...', expr: 'sleep', close: false },
        { who: 'mori', text: 'Joshu. Come on. Jenna’s waiting for you.', expr: 'worried' },
        { who: 'joshu', text: '...Jen... na...?', expr: 'sleep', close: false, auto: 1400 },
      ]);
      jo.setAnim('sitGround');
      jo.idleAnim = 'sitGround';
      jo.setExpr('surprised', 2);
      jo.react('jump');
      audio.play('emoteSurprise', { vol: 0.6 });
      await this.say([
        { who: 'joshu', text: 'JENNA!', expr: 'shocked', style: 'shout' },
        { who: 'joshu', text: '...Mori? Lad? What... where...', expr: 'surprised' },
        { who: 'mori', text: 'Joshu! You’re awake! How do you feel?', expr: 'excited', react: 'bounce' },
        { who: 'joshu', text: 'Like a tugboat ran me over, backed up, and ran me over again.', expr: 'injured' },
        { who: 'joshu', text: 'Mori. Where’s my girl?', expr: 'scared', react: 'jump' },
        { who: 'mori', text: 'She’s fine. She’s at the wreck with Chunk. Not a scratch. She’s been bossing me around on the radio all morning.', expr: 'happy' },
        { who: 'joshu', text: '...', expr: 'sad', close: false, auto: 1100 },
        { who: 'joshu', text: 'Thank God. Thank the sea. Thank YOU, lad.', expr: 'happy' },
      ]);
      // something has been living in his beard
      await this.say([
        { who: 'joshu', text: '...Mori. Why is there a weta in my beard.', expr: 'serious' },
        { who: 'mori', text: 'He likes you? You were very warm. And very still. For a long time.', expr: 'teasing' },
        { who: 'joshu', text: '*flicks a giant weta into the ferns with tremendous dignity*', expr: 'grumpy', close: false },
      ]);
      for (let i = 0; i < 4; i++) f.main.particles.spawn({ frame: A.dot2, x: jo.x + 6, y: jo.y - 20, vx: 60 + i * 10, vy: -60, ay: 300, life: 0.8, color: [0.45, 0.3, 0.18], alpha: 1, alpha1: 1, floorY: jo.y + 2 });
      await this.say([
        { who: 'joshu', text: 'I came to on the beach. Couldn’t see a soul. Walked looking for you lot, and for fresh water, and found the stream.', expr: 'neutral' },
        { who: 'joshu', text: 'Followed it up in here. Lost a boot in some mud. Then the bank went out from under me, and the lights went out.', expr: 'injured' },
        { who: 'mori', text: 'I’ve got your boot. And your ankle’s pretty bad, and there’s a lump on your head like an egg.', expr: 'worried' },
        { who: 'joshu', text: 'Head’s the hardest part of me. Ask Jenna’s mother. ...Help me up.', expr: 'teasing' },
      ]);
      // up he comes, with a hand
      this.pose('grab');
      await wait(700);
      await jo.play('standUp', 'injured').catch(() => {});
      this.pose(null);
      jo.idleAnim = 'injured';
      jo.setAnim('injured');
      await this.say([
        this.radio('Mori? Mori, I heard yelling. Is that... is that DAD?', 'worried'),
        { who: 'joshu', text: 'Jenna, love. I’m here. I’m all right.', expr: 'happy' },
        this.radio('DAAAAD! You big stupid WALRUS! Don’t you EVER do that again! ...over!', 'excited'),
        { who: 'joshu', text: 'Ha! Aye aye. We’re coming back. Over.', expr: 'laugh' },
        this.radio('Chunk says hurry up. Actually Chunk says nothing. He’s asleep on the biscuit tin. Over.', 'happy'),
      ]);
      this.set('v4:joshuAwake');
      if (!game.save.tools.includes('knife')) game.save.tools.push('knife');
      await this.say([
        { who: 'joshu', text: 'Here. Take my knife. Don’t lose it: it was my father’s.', expr: 'serious' },
        { who: 'mori', text: 'Joshu, I can’t...', expr: 'surprised' },
        { who: 'joshu', text: 'You can and you will. I can barely walk. You’re my hands today, lad.', expr: 'neutral' },
        { who: 'joshu', text: 'And we are NOT walking back empty-handed. Fire, food, shelter. Starting now.', expr: 'determined' },
        { who: 'joshu', text: 'Follow the water down. Water always knows the way to the sea. Remember that if you ever get lost.', expr: 'neutral' },
      ]);
      // the shortcut: down the creek and the stream, to where the beach light shows through the trees
      await game.fadeTo(1, 1.2);
      f.clock.set(Math.max(f.clock.t, 1.85));
      f.clock.target = 2.5;
      f.clock.rate = 0.003;
      p.x = 330; p.y = fgroundY(p.x); p.facing = -1;
      this.place(jo, 372, -1, 'injured');
      this.joshuF!.on = true;
      f.snapCamera();
      f.st.cam.locked = false;
      await wait(400);
      await game.fadeTo(0, 0.9);
      await this.say([
        { who: 'mori', text: 'There’s the beach. I can see the light through the trees.', expr: 'happy' },
        { who: 'joshu', text: 'Out we go, then. Slowly. I’ve only got the one good leg.', expr: 'teasing' },
      ]);
    });
    if (questStatus('v4return') === 'hidden') startQuest('v4return');
  }

  // ---------------------------------------------------------------- the way out
  private async walkOut() {
    const f = this.f, p = this.p;
    if (!f.day1) {
      const { returnToCamp } = await import('../../v10/expedition');
      await returnToCamp('walk');
      return;
    }
    // Day 1: back down the stream to the beach (with Joshu, the walk home begins)
    f.cutscene = true;
    try {
      if (!this.flag('v4:joshuAwake')) {
        const ch = await this.say([{ who: 'mori', text: 'Back to the beach? Joshu’s trail goes on up the stream...', expr: 'thinking', choices: ['Go back to the beach', 'Keep looking'] }]);
        if (ch !== 0) { f.cutscene = false; await Promise.race([p.walkTo(FSPOT.enter, 50), wait(2500)]); return; }
      } else {
        if (this.joshuF) this.joshuF.on = true;
        this.set('v11:forestOut');
      }
      await Promise.race([p.walkTo(2, 56), wait(1500)]);
      V()['v11:dayT'] = f.clock.t;
      delete F()['v11:inForest'];
      game.persist();
      const { backToBeach } = await import('./index');
      await backToBeach();
    } finally {
      if (game.scene === f) f.cutscene = false;
    }
  }

  // ---------------------------------------------------------------- Day 2+: the Cerebral Tiger
  private async tiger() {
    const f = this.f, p = this.p;
    this.set('v11:tigerAmbush');
    const g = f.guide?.a ?? null;
    await this.cut(async () => {
      p.vx = 0;
      p.facing = 1;
      if (g) { g.stopWalk(); g.faceTo(p.x + 100); g.setAnim('crouch'); }
      audio.setAmbience('none' as never);
      await wait(700);
      await this.say([
        { who: 'aroha', text: 'Stop.', expr: 'serious', style: 'whisper', close: false, auto: 1000 },
        { who: 'mori', text: 'What? What is it?', expr: 'worried', style: 'whisper' },
        { who: 'aroha', text: 'Listen. The birds. Everything just went quiet.', expr: 'scared', style: 'whisper' },
      ]);
      audio.play('rustleBush', { vol: 0.7, pitch: 0.6 });
      await cineTo(f.st, { x: FSPOT.tiger + 70, y: fgroundY(FSPOT.tiger) - 40, zoom: 1.45, secs: 1.2 });
      audio.play('woodCreak', { vol: 0.5, pitch: 1.6 });
      await wait(600);
      const t0 = performance.now();
      await tigerAmbush({ scene: f, x: FSPOT.tiger + 60, dir: 1 });
      // (until the predators module plays the real thing: something big slips away through the ferns)
      if (performance.now() - t0 < 300) {
        audio.play('rustleBush', { vol: 0.9, pitch: 0.5 });
        f.st.shake(1.2, 0.3);
        await wait(500);
        await this.say([
          { who: 'aroha', text: '...It’s gone. Whatever it was, it was watching us. Stay close to me in here.', expr: 'serious', style: 'whisper' },
        ]);
      }
    });
    audio.setAmbience('forest', f.night);
    if (g) g.setAnim(g.idleAnim);
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    const f = this.f;
    this.joshuF?.update();
    if (!this.busy && !game.ui.blocking && !f.cutscene) {
      for (let i = 0; i < this.triggers.length; i++) {
        const t = this.triggers[i];
        if (!t.when()) continue;
        this.triggers.splice(i, 1);
        F()['trg:f:' + t.id] = true;
        game.persist();
        void t.run();
        break;
      }
    }
    if (!f.day1) return;
    const p = this.p;
    // where Mori stands (a reload picks up from there)
    this.pxT -= dt;
    if (this.pxT <= 0 && !f.cutscene && p.onGround && p.state === 'normal') { this.pxT = 2; V()['v11:fx'] = Math.round(p.x); V()['v11:dayT'] = f.clock.t; }
    // Joshu snores on until he's woken (louder the closer you get)
    if (this.flag('v4:joshuFound') || this.flag('v11:snore')) {
      if (!this.flag('v4:splashed')) {
        this.snoreT -= dt;
        if (this.snoreT <= 0) { this.snoreT = rand.range(3.2, 4.4); f.sfx('callGrowl', this.joshu!.x, 0.35, 0.42); }
      }
    }
    // a nudge when Mori has wandered about for a long while without finding the next sign
    this.hintT -= dt;
    if (this.hintT <= 0 && !f.cutscene && !game.ui.bubbles.active && !this.flag('v4:joshuFound')) {
      this.hintT = 60;
      const line = !this.flag('v11:fprints') ? 'His prints went up the stream. Follow the water.'
        : !this.flag('v4:shoes') && !this.flag('v9:sawCap') ? 'If I could get up high, I could see a long way. That fallen kauri, maybe.'
          : 'He was heading east, deeper in. Toward that gully.';
      f.bark('mori', line, { expr: 'thinking' });
    }
  }

  exit() {
    setCarry(this.p.body, null);
  }
}

export function attachForestStory(f: ForestScene) {
  f.story = new ForestStory(f);
}
